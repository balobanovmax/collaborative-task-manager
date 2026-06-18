import pool from '../config/database.js';
import { getTasksAssignedToUser } from './Task.js';
import { getUnreadNotificationCount } from './Notification.js';

const MENTION_NOTIFICATION_TYPES = ['task_comment_mention', 'chat_mention'];

export const getUnreadMentionNotifications = async (userId, limit = 5) => {
    const result = await pool.query(`
        SELECT id, user_id, type, title, message, metadata, is_read, created_at
        FROM notifications
        WHERE user_id = $1
          AND is_read = FALSE
          AND type = ANY($2::varchar[])
        ORDER BY created_at DESC
        LIMIT $3
    `, [userId, MENTION_NOTIFICATION_TYPES, limit]);

    return result.rows;
};

export const getUnreadMentionCount = async (userId) => {
    const result = await pool.query(`
        SELECT COUNT(*)::int AS count
        FROM notifications
        WHERE user_id = $1
          AND is_read = FALSE
          AND type = ANY($2::varchar[])
    `, [userId, MENTION_NOTIFICATION_TYPES]);

    return result.rows[0].count;
};

export const getPendingJoinRequestsForOwner = async (ownerId, limit = 10) => {
    const result = await pool.query(`
        SELECT
            jr.id,
            jr.group_id,
            jr.user_id,
            jr.message,
            jr.created_at,
            u.username,
            g.name AS group_name
        FROM group_join_requests jr
        JOIN groups g ON jr.group_id = g.id
        JOIN users u ON jr.user_id = u.id
        WHERE g.owner_id = $1
          AND jr.status = 'pending'
        ORDER BY jr.created_at ASC
        LIMIT $2
    `, [ownerId, limit]);

    return result.rows;
};

export const getPendingJoinRequestCountForOwner = async (ownerId) => {
    const result = await pool.query(`
        SELECT COUNT(*)::int AS count
        FROM group_join_requests jr
        JOIN groups g ON jr.group_id = g.id
        WHERE g.owner_id = $1
          AND jr.status = 'pending'
    `, [ownerId]);

    return result.rows[0].count;
};

const countDueToday = (tasks) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return tasks.filter((task) => {
        if (task.status === 'done' || !task.due_date) {
            return false;
        }

        const due = new Date(task.due_date);
        due.setHours(0, 0, 0, 0);
        return due.getTime() === today.getTime();
    }).length;
};

export const getDashboardSummary = async (userId) => {
    const [
        myTasksResult,
        pendingJoinRequests,
        pendingJoinRequestCount,
        unreadMentions,
        unreadMentionCount,
        unreadNotificationCount
    ] = await Promise.all([
        getTasksAssignedToUser(userId, {
            includeDone: false,
            sortBy: 'due_date',
            sortOrder: 'ASC'
        }),
        getPendingJoinRequestsForOwner(userId, 5),
        getPendingJoinRequestCountForOwner(userId),
        getUnreadMentionNotifications(userId, 5),
        getUnreadMentionCount(userId),
        getUnreadNotificationCount(userId)
    ]);

    const activeTasks = myTasksResult.tasks;
    const dueTodayCount = countDueToday(activeTasks);

    return {
        summary: {
            active_tasks: myTasksResult.summary.total_tasks,
            overdue_tasks: myTasksResult.summary.overdue_tasks,
            due_today_tasks: dueTodayCount,
            pending_join_requests: pendingJoinRequestCount,
            unread_mentions: unreadMentionCount,
            unread_notifications: unreadNotificationCount
        },
        my_tasks: activeTasks.slice(0, 6),
        pending_join_requests: pendingJoinRequests,
        unread_mentions: unreadMentions
    };
};
