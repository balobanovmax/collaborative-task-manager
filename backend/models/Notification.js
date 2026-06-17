import pool from '../config/database.js';

export const createNotification = async (userId, type, title, message, metadata = {}) => {
    const result = await pool.query(`
        INSERT INTO notifications (user_id, type, title, message, metadata)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, user_id, type, title, message, metadata, is_read, created_at
    `, [userId, type, title, message, JSON.stringify(metadata)]);

    return result.rows[0];
};

export const getNotificationsForUser = async (userId, limit = 50) => {
    const result = await pool.query(`
        SELECT id, user_id, type, title, message, metadata, is_read, created_at
        FROM notifications
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2
    `, [userId, limit]);

    return result.rows;
};

export const getUnreadNotificationCount = async (userId) => {
    const result = await pool.query(`
        SELECT COUNT(*)::int AS count
        FROM notifications
        WHERE user_id = $1 AND is_read = FALSE
    `, [userId]);

    return result.rows[0].count;
};

export const markNotificationRead = async (notificationId, userId) => {
    const result = await pool.query(`
        UPDATE notifications
        SET is_read = TRUE
        WHERE id = $1 AND user_id = $2
        RETURNING id, user_id, type, title, message, metadata, is_read, created_at
    `, [notificationId, userId]);

    if (result.rows.length === 0) {
        throw new Error('Notification not found');
    }

    return result.rows[0];
};

export const markAllNotificationsRead = async (userId) => {
    await pool.query(`
        UPDATE notifications
        SET is_read = TRUE
        WHERE user_id = $1 AND is_read = FALSE
    `, [userId]);
};
