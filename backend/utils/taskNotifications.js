import pool from '../config/database.js';
import { createNotification } from '../models/Notification.js';
import { emitNotification } from './socket.js';

export const hasRecentNotification = async (userId, type, taskId, withinHours = 20) => {
    const result = await pool.query(`
        SELECT 1
        FROM notifications
        WHERE user_id = $1
          AND type = $2
          AND metadata->>'task_id' = $3
          AND created_at > NOW() - ($4 || ' hours')::interval
        LIMIT 1
    `, [userId, type, String(taskId), String(withinHours)]);

    return result.rows.length > 0;
};

export const notifyTaskAssigned = async ({
    task,
    assigneeId,
    actorId,
    actorUsername,
    groupName
}) => {
    if (!assigneeId || Number(assigneeId) === Number(actorId)) {
        return null;
    }

    const alreadySent = await hasRecentNotification(assigneeId, 'task_assigned', task.id, 1);
    if (alreadySent) {
        return null;
    }

    const notification = await createNotification(
        assigneeId,
        'task_assigned',
        'Task assigned to you',
        `${actorUsername} assigned "${task.title}" in ${groupName}`,
        {
            group_id: task.group_id,
            task_id: task.id
        }
    );

    emitNotification(assigneeId, notification);
    return notification;
};

export const notifyChatMentions = async ({
    mentions,
    authorId,
    authorUsername,
    groupId,
    groupName,
    messageId
}) => {
    for (const mention of mentions) {
        if (Number(mention.user_id) === Number(authorId)) {
            continue;
        }

        const notification = await createNotification(
            mention.user_id,
            'chat_mention',
            'Mentioned in group chat',
            `${authorUsername} mentioned you in ${groupName}`,
            {
                group_id: groupId,
                message_id: messageId
            }
        );

        emitNotification(mention.user_id, notification);
    }
};

export const processDueDateNotifications = async () => {
    const result = await pool.query(`
        SELECT
            t.id,
            t.title,
            t.due_date,
            t.assigned_to,
            t.group_id,
            g.name AS group_name
        FROM tasks t
        JOIN groups g ON t.group_id = g.id
        WHERE t.status != 'done'
          AND t.due_date IS NOT NULL
          AND t.assigned_to IS NOT NULL
          AND (
            t.due_date::date < CURRENT_DATE
            OR t.due_date::date = CURRENT_DATE
            OR t.due_date::date = CURRENT_DATE + INTERVAL '1 day'
          )
    `);

    let sentCount = 0;

    for (const task of result.rows) {
        const dueDate = new Date(task.due_date);
        dueDate.setHours(0, 0, 0, 0);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        let type = null;
        let title = null;
        let message = null;

        if (dueDate < today) {
            type = 'task_overdue';
            title = 'Task overdue';
            message = `"${task.title}" in ${task.group_name} is overdue`;
        } else if (dueDate.getTime() === today.getTime()) {
            type = 'task_due_today';
            title = 'Task due today';
            message = `"${task.title}" in ${task.group_name} is due today`;
        } else if (dueDate.getTime() === tomorrow.getTime()) {
            type = 'task_due_tomorrow';
            title = 'Task due tomorrow';
            message = `"${task.title}" in ${task.group_name} is due tomorrow`;
        }

        if (!type) {
            continue;
        }

        const dedupeHours = type === 'task_overdue' ? 24 : 20;
        const alreadySent = await hasRecentNotification(task.assigned_to, type, task.id, dedupeHours);
        if (alreadySent) {
            continue;
        }

        const notification = await createNotification(
            task.assigned_to,
            type,
            title,
            message,
            {
                group_id: task.group_id,
                task_id: task.id
            }
        );

        emitNotification(task.assigned_to, notification);
        sentCount += 1;
    }

    return sentCount;
};

export const startDueDateNotificationScheduler = () => {
    const run = () => {
        processDueDateNotifications().catch((error) => {
            console.error('Due date notification job failed:', error);
        });
    };

    run();
    const intervalMs = 60 * 60 * 1000;
    return setInterval(run, intervalMs);
};
