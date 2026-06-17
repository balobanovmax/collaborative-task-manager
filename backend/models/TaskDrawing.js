import pool from '../config/database.js';
import { deleteTaskDrawingFile } from '../utils/taskDrawingFiles.js';

const ensureTaskMemberAccess = async (taskId, userId) => {
    const taskResult = await pool.query(`
        SELECT t.id, t.group_id, t.created_by, g.owner_id
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
        throw new Error('You must be a member of this group to access task drawings.');
    }

    return task;
};

const formatDrawing = (row) => ({
    id: row.id,
    task_id: row.task_id,
    user_id: row.user_id,
    username: row.username || 'Unknown',
    profile_picture_url: row.profile_picture_url || null,
    title: row.title,
    file_path: row.file_path,
    file_size: row.file_size,
    created_at: row.created_at
});

export const getDrawingsByTask = async (taskId, userId) => {
    if (!taskId || isNaN(taskId) || taskId <= 0) {
        throw new Error('Invalid task ID.');
    }

    await ensureTaskMemberAccess(taskId, userId);

    const result = await pool.query(`
        SELECT
            td.id,
            td.task_id,
            td.user_id,
            td.title,
            td.file_path,
            td.file_size,
            td.created_at,
            u.username,
            u.profile_picture_url
        FROM task_drawings td
        JOIN users u ON td.user_id = u.id
        WHERE td.task_id = $1
        ORDER BY td.created_at DESC
    `, [taskId]);

    return result.rows.map(formatDrawing);
};

export const createTaskDrawing = async (taskId, userId, file, title = 'Drawing') => {
    if (!taskId || isNaN(taskId) || taskId <= 0) {
        throw new Error('Invalid task ID.');
    }

    if (!file) {
        throw new Error('Drawing file is required.');
    }

    await ensureTaskMemberAccess(taskId, userId);

    const cleanedTitle = (title?.trim() || 'Drawing').slice(0, 255);

    const result = await pool.query(`
        INSERT INTO task_drawings (
            task_id,
            user_id,
            title,
            stored_filename,
            file_path,
            file_size
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, task_id, user_id, title, file_path, file_size, created_at
    `, [
        taskId,
        userId,
        cleanedTitle,
        file.filename,
        `/uploads/task-drawings/${file.filename}`,
        file.size
    ]);

    const drawing = result.rows[0];

    const userResult = await pool.query(
        'SELECT username, profile_picture_url FROM users WHERE id = $1',
        [userId]
    );

    const user = userResult.rows[0];

    return formatDrawing({
        ...drawing,
        username: user?.username,
        profile_picture_url: user?.profile_picture_url
    });
};

export const deleteTaskDrawing = async (drawingId, userId) => {
    if (!drawingId || isNaN(drawingId) || drawingId <= 0) {
        throw new Error('Invalid drawing ID.');
    }

    const result = await pool.query(`
        SELECT
            td.*,
            t.created_by,
            g.owner_id
        FROM task_drawings td
        JOIN tasks t ON td.task_id = t.id
        JOIN groups g ON t.group_id = g.id
        WHERE td.id = $1
    `, [drawingId]);

    if (result.rows.length === 0) {
        throw new Error('Drawing not found.');
    }

    const drawing = result.rows[0];

    await ensureTaskMemberAccess(drawing.task_id, userId);

    const canDelete =
        drawing.user_id === userId
        || drawing.created_by === userId
        || drawing.owner_id === userId;

    if (!canDelete) {
        throw new Error('You can only delete drawings you created, or drawings on tasks you own.');
    }

    deleteTaskDrawingFile(drawing.file_path);

    await pool.query('DELETE FROM task_drawings WHERE id = $1', [drawingId]);

    return {
        id: drawing.id,
        task_id: drawing.task_id
    };
};

export const deleteDrawingsForTask = async (taskId) => {
    const result = await pool.query(
        'SELECT file_path FROM task_drawings WHERE task_id = $1',
        [taskId]
    );

    result.rows.forEach((row) => {
        deleteTaskDrawingFile(row.file_path);
    });

    await pool.query('DELETE FROM task_drawings WHERE task_id = $1', [taskId]);
};
