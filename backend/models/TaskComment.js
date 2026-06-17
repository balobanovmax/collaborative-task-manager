import pool from '../config/database.js';

const validateCommentInput = (content) => {
    const errors = [];

    if (!content) {
        errors.push('Comment content is required.');
    } else if (typeof content !== 'string') {
        errors.push('Comment content must be a string.');
    } else if (content.trim().length === 0) {
        errors.push('Comment cannot be empty.');
    } else if (content.trim().length > 2000) {
        errors.push('Comment cannot exceed 2000 characters.');
    }

    return {
        isValid: errors.length === 0,
        errors,
        cleanedContent: content ? content.trim() : null
    };
};

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
        throw new Error('You must be a member of this group to access task comments.');
    }

    return task;
};

const formatComment = (row) => ({
    id: row.id,
    task_id: row.task_id,
    user_id: row.user_id,
    username: row.username || 'Unknown',
    profile_picture_url: row.profile_picture_url || null,
    content: row.content,
    created_at: row.created_at
});

export const createTaskComment = async (taskId, userId, content) => {
    if (!taskId || isNaN(taskId) || taskId <= 0) {
        throw new Error('Invalid task ID.');
    }

    if (!userId || isNaN(userId) || userId <= 0) {
        throw new Error('Invalid user ID.');
    }

    const validation = validateCommentInput(content);
    if (!validation.isValid) {
        throw new Error(validation.errors.join(' '));
    }

    await ensureTaskMemberAccess(taskId, userId);

    const result = await pool.query(`
        INSERT INTO task_comments (task_id, user_id, content)
        VALUES ($1, $2, $3)
        RETURNING id, task_id, user_id, content, created_at
    `, [taskId, userId, validation.cleanedContent]);

    const comment = result.rows[0];

    const userResult = await pool.query(
        'SELECT username, profile_picture_url FROM users WHERE id = $1',
        [userId]
    );

    const user = userResult.rows[0];

    return formatComment({
        ...comment,
        username: user?.username,
        profile_picture_url: user?.profile_picture_url
    });
};

export const getCommentsByTask = async (taskId, userId) => {
    if (!taskId || isNaN(taskId) || taskId <= 0) {
        throw new Error('Invalid task ID.');
    }

    if (!userId || isNaN(userId) || userId <= 0) {
        throw new Error('Invalid user ID.');
    }

    await ensureTaskMemberAccess(taskId, userId);

    const result = await pool.query(`
        SELECT
            tc.id,
            tc.task_id,
            tc.user_id,
            tc.content,
            tc.created_at,
            u.username,
            u.profile_picture_url
        FROM task_comments tc
        JOIN users u ON tc.user_id = u.id
        WHERE tc.task_id = $1
        ORDER BY tc.created_at ASC
    `, [taskId]);

    return result.rows.map(formatComment);
};
