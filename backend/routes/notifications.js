import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
    getNotificationsForUser,
    getUnreadNotificationCount,
    markNotificationRead,
    markAllNotificationsRead
} from '../models/Notification.js';

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const [notifications, unreadCount] = await Promise.all([
            getNotificationsForUser(req.userId, limit),
            getUnreadNotificationCount(req.userId)
        ]);

        res.json({
            success: true,
            data: {
                notifications,
                unread_count: unreadCount
            }
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch notifications'
        });
    }
});

router.get('/unread-count', requireAuth, async (req, res) => {
    try {
        const unreadCount = await getUnreadNotificationCount(req.userId);

        res.json({
            success: true,
            data: { unread_count: unreadCount }
        });
    } catch (error) {
        console.error('Error fetching unread notification count:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch unread count'
        });
    }
});

router.patch('/read-all', requireAuth, async (req, res) => {
    try {
        await markAllNotificationsRead(req.userId);

        res.json({
            success: true,
            message: 'All notifications marked as read'
        });
    } catch (error) {
        console.error('Error marking all notifications read:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to mark notifications as read'
        });
    }
});

router.patch('/:id/read', requireAuth, async (req, res) => {
    try {
        const notificationId = parseInt(req.params.id);

        if (isNaN(notificationId) || notificationId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid notification ID.'
            });
        }

        const notification = await markNotificationRead(notificationId, req.userId);

        res.json({
            success: true,
            data: { notification }
        });
    } catch (error) {
        console.error('Error marking notification read:', error);

        let statusCode = 400;
        if (error.message.includes('not found')) {
            statusCode = 404;
        }

        res.status(statusCode).json({
            success: false,
            message: error.message
        });
    }
});

export default router;
