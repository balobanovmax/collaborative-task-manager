import pool from '../config/database.js';
import { deleteTaskAttachmentFile } from '../utils/taskAttachmentFiles.js';

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
        throw new Error('You must be a member of this group to access task attachments.');
    }

    return task;
};

const formatAttachment = (row) => ({
    id: row.id,
    task_id: row.task_id,
    user_id: row.user_id,
    username: row.username || 'Unknown',
    profile_picture_url: row.profile_picture_url || null,
    original_filename: row.original_filename,
    file_path: row.file_path,
    mime_type: row.mime_type,
    file_size: row.file_size,
    created_at: row.created_at
});

export const getAttachmentsByTask = async (taskId, userId) => {
    if (!taskId || isNaN(taskId) || taskId <= 0) {
        throw new Error('Invalid task ID.');
    }

    await ensureTaskMemberAccess(taskId, userId);

    const result = await pool.query(`
        SELECT
            ta.id,
            ta.task_id,
            ta.user_id,
            ta.original_filename,
            ta.file_path,
            ta.mime_type,
            ta.file_size,
            ta.created_at,
            u.username,
            u.profile_picture_url
        FROM task_attachments ta
        JOIN users u ON ta.user_id = u.id
        WHERE ta.task_id = $1
        ORDER BY ta.created_at DESC
    `, [taskId]);

    return result.rows.map(formatAttachment);
};

export const createTaskAttachment = async (taskId, userId, file) => {
    if (!taskId || isNaN(taskId) || taskId <= 0) {
        throw new Error('Invalid task ID.');
    }

    if (!file) {
        throw new Error('Attachment file is required.');
    }

    await ensureTaskMemberAccess(taskId, userId);

    const result = await pool.query(`
        INSERT INTO task_attachments (
            task_id,
            user_id,
            original_filename,
            stored_filename,
            file_path,
            mime_type,
            file_size
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, task_id, user_id, original_filename, file_path, mime_type, file_size, created_at
    `, [
        taskId,
        userId,
        file.originalname,
        file.filename,
        `/uploads/task-attachments/${file.filename}`,
        file.mimetype,
        file.size
    ]);

    const attachment = result.rows[0];

    const userResult = await pool.query(
        'SELECT username, profile_picture_url FROM users WHERE id = $1',
        [userId]
    );

    const user = userResult.rows[0];

    return formatAttachment({
        ...attachment,
        username: user?.username,
        profile_picture_url: user?.profile_picture_url
    });
};

export const deleteTaskAttachment = async (attachmentId, userId) => {
    if (!attachmentId || isNaN(attachmentId) || attachmentId <= 0) {
        throw new Error('Invalid attachment ID.');
    }

    const result = await pool.query(`
        SELECT
            ta.*,
            t.created_by,
            g.owner_id
        FROM task_attachments ta
        JOIN tasks t ON ta.task_id = t.id
        JOIN groups g ON t.group_id = g.id
        WHERE ta.id = $1
    `, [attachmentId]);

    if (result.rows.length === 0) {
        throw new Error('Attachment not found.');
    }

    const attachment = result.rows[0];

    await ensureTaskMemberAccess(attachment.task_id, userId);

    const canDelete =
        attachment.user_id === userId
        || attachment.created_by === userId
        || attachment.owner_id === userId;

    if (!canDelete) {
        throw new Error('You can only delete attachments you uploaded, or attachments on tasks you own.');
    }

    deleteTaskAttachmentFile(attachment.file_path);

    await pool.query('DELETE FROM task_attachments WHERE id = $1', [attachmentId]);

    return {
        id: attachment.id,
        task_id: attachment.task_id
    };
};

export const deleteAttachmentsForTask = async (taskId) => {
    const result = await pool.query(
        'SELECT file_path FROM task_attachments WHERE task_id = $1',
        [taskId]
    );

    result.rows.forEach((row) => {
        deleteTaskAttachmentFile(row.file_path);
    });

    await pool.query('DELETE FROM task_attachments WHERE task_id = $1', [taskId]);
};
