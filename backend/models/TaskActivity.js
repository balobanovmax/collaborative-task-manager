import pool from '../config/database.js';

const ensureTaskMemberAccess = async (taskId, userId) => {
    const taskResult = await pool.query(`
        SELECT t.id, t.group_id, g.owner_id
        FROM tasks t
        JOIN groups g ON t.group_id = g.id
        WHERE t.id = $1
    `, [taskId]);

    if (taskResult.rows.length === 0) {
        throw new Error('Task not found.');
    }

    const task = taskResult.rows[0];

    const memberCheck = await pool.query(`
        SELECT 1
        FROM group_members
        WHERE group_id = $1 AND user_id = $2
        UNION
        SELECT 1
        FROM groups
        WHERE id = $1 AND owner_id = $2
    `, [task.group_id, userId]);

    if (memberCheck.rows.length === 0) {
        throw new Error('You must be a member of this group to access task activity.');
    }

    return task;
};

export const logTaskActivity = async (taskId, userId, actionType, detail = null, metadata = null) => {
    if (!taskId || isNaN(taskId) || taskId <= 0) {
        return null;
    }

    const result = await pool.query(`
        INSERT INTO task_activity (task_id, user_id, action_type, detail, metadata)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, task_id, user_id, action_type, detail, metadata, created_at
    `, [taskId, userId || null, actionType, detail, metadata ? JSON.stringify(metadata) : null]);

    return result.rows[0];
};

export const getActivityByTask = async (taskId, userId, limit = 50) => {
    if (!taskId || isNaN(taskId) || taskId <= 0) {
        throw new Error('Invalid task ID.');
    }

    await ensureTaskMemberAccess(taskId, userId);

    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);

    const result = await pool.query(`
        SELECT
            ta.id,
            ta.task_id,
            ta.user_id,
            ta.action_type,
            ta.detail,
            ta.metadata,
            ta.created_at,
            u.username
        FROM task_activity ta
        LEFT JOIN users u ON ta.user_id = u.id
        WHERE ta.task_id = $1
        ORDER BY ta.created_at DESC
        LIMIT $2
    `, [taskId, parsedLimit]);

    return result.rows.map((row) => ({
        id: row.id,
        task_id: row.task_id,
        user_id: row.user_id,
        username: row.username || 'Unknown',
        action_type: row.action_type,
        detail: row.detail,
        metadata: row.metadata,
        created_at: row.created_at
    }));
};
