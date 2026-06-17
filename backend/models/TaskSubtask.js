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
        throw new Error('You must be a member of this group to access task subtasks.');
    }

    return task;
};

const formatSubtask = (row) => ({
    id: row.id,
    task_id: row.task_id,
    title: row.title,
    is_completed: row.is_completed,
    sort_order: row.sort_order,
    created_by: row.created_by,
    created_at: row.created_at,
    completed_at: row.completed_at,
    completed_by: row.completed_by
});

export const getSubtasksByTask = async (taskId, userId) => {
    if (!taskId || isNaN(taskId) || taskId <= 0) {
        throw new Error('Invalid task ID.');
    }

    await ensureTaskMemberAccess(taskId, userId);

    const result = await pool.query(`
        SELECT id, task_id, title, is_completed, sort_order, created_by, created_at, completed_at, completed_by
        FROM task_subtasks
        WHERE task_id = $1
        ORDER BY sort_order ASC, id ASC
    `, [taskId]);

    return result.rows.map(formatSubtask);
};

export const createSubtask = async (taskId, userId, title) => {
    if (!taskId || isNaN(taskId) || taskId <= 0) {
        throw new Error('Invalid task ID.');
    }

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
        throw new Error('Subtask title is required.');
    }

    if (title.trim().length > 255) {
        throw new Error('Subtask title cannot exceed 255 characters.');
    }

    await ensureTaskMemberAccess(taskId, userId);

    const orderResult = await pool.query(
        'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM task_subtasks WHERE task_id = $1',
        [taskId]
    );

    const result = await pool.query(`
        INSERT INTO task_subtasks (task_id, title, sort_order, created_by)
        VALUES ($1, $2, $3, $4)
        RETURNING id, task_id, title, is_completed, sort_order, created_by, created_at, completed_at, completed_by
    `, [taskId, title.trim(), orderResult.rows[0].next_order, userId]);

    return formatSubtask(result.rows[0]);
};

export const updateSubtask = async (taskId, subtaskId, userId, updates = {}) => {
    if (!taskId || isNaN(taskId) || taskId <= 0) {
        throw new Error('Invalid task ID.');
    }

    if (!subtaskId || isNaN(subtaskId) || subtaskId <= 0) {
        throw new Error('Invalid subtask ID.');
    }

    await ensureTaskMemberAccess(taskId, userId);

    const existing = await pool.query(
        'SELECT * FROM task_subtasks WHERE id = $1 AND task_id = $2',
        [subtaskId, taskId]
    );

    if (existing.rows.length === 0) {
        throw new Error('Subtask not found.');
    }

    const subtask = existing.rows[0];
    const fields = [];
    const values = [];
    let param = 1;

    if (updates.title !== undefined) {
        if (!updates.title || typeof updates.title !== 'string' || updates.title.trim().length === 0) {
            throw new Error('Subtask title cannot be empty.');
        }
        fields.push(`title = $${param++}`);
        values.push(updates.title.trim());
    }

    if (updates.is_completed !== undefined) {
        const isCompleted = Boolean(updates.is_completed);
        fields.push(`is_completed = $${param++}`);
        values.push(isCompleted);
        fields.push(`completed_at = $${param++}`);
        values.push(isCompleted ? new Date() : null);
        fields.push(`completed_by = $${param++}`);
        values.push(isCompleted ? userId : null);
    }

    if (fields.length === 0) {
        throw new Error('No valid fields to update.');
    }

    values.push(subtaskId, taskId);

    const result = await pool.query(`
        UPDATE task_subtasks
        SET ${fields.join(', ')}
        WHERE id = $${param++} AND task_id = $${param}
        RETURNING id, task_id, title, is_completed, sort_order, created_by, created_at, completed_at, completed_by
    `, values);

    return {
        subtask: formatSubtask(result.rows[0]),
        previous: formatSubtask(subtask)
    };
};

export const deleteSubtask = async (taskId, subtaskId, userId) => {
    if (!taskId || isNaN(taskId) || taskId <= 0) {
        throw new Error('Invalid task ID.');
    }

    if (!subtaskId || isNaN(subtaskId) || subtaskId <= 0) {
        throw new Error('Invalid subtask ID.');
    }

    await ensureTaskMemberAccess(taskId, userId);

    const result = await pool.query(
        'DELETE FROM task_subtasks WHERE id = $1 AND task_id = $2 RETURNING id, title',
        [subtaskId, taskId]
    );

    if (result.rows.length === 0) {
        throw new Error('Subtask not found.');
    }

    return result.rows[0];
};
