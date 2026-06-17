import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { createMessage, createVoiceMessage, getMessagesByGroup, deleteAllMessagesByGroup } from '../models/Message.js';
import { emitMessageSent, emitChatCleared } from '../utils/socket.js';
import { uploadVoiceMessage } from '../middleware/uploadVoiceMessage.js';

const router = express.Router();

router.post('/', requireAuth, async (req, res) => {
    try {
        const userId = req.userId;
        const { group_id, content } = req.body;

        if (!group_id) {
            return res.status(400).json({
                success: false,
                message: 'Group ID is required.'
            });
        }

        const groupId = parseInt(group_id);
        if (isNaN(groupId) || groupId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid group ID.'
            });
        }

        const message = await createMessage(groupId, userId, content);

        emitMessageSent(groupId, message);

        res.status(201).json({
            success: true,
            message: 'Message sent successfully',
            data: { message }
        });

    } catch (error) {
        console.error('Error sending message:', error);
        let statusCode = 400;
        if (error.message.includes('not found')) {
            statusCode = 404;
        } else if (error.message.includes('must be a member')) {
            statusCode = 403;
        }
        res.status(statusCode).json({
            success: false,
            message: error.message
        });
    }
});

router.post('/voice', requireAuth, uploadVoiceMessage.single('voice'), async (req, res) => {
    try {
        const userId = req.userId;
        const groupId = parseInt(req.body.group_id, 10);

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Voice recording is required.'
            });
        }

        if (isNaN(groupId) || groupId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid group ID.'
            });
        }

        const message = await createVoiceMessage(
            groupId,
            userId,
            req.file,
            req.body.duration_seconds
        );

        emitMessageSent(groupId, message);

        res.status(201).json({
            success: true,
            message: 'Voice message sent successfully',
            data: { message }
        });
    } catch (error) {
        console.error('Error sending voice message:', error);
        let statusCode = 400;
        if (error.message.includes('not found')) {
            statusCode = 404;
        } else if (error.message.includes('must be a member')) {
            statusCode = 403;
        }
        res.status(statusCode).json({
            success: false,
            message: error.message
        });
    }
});

router.get('/group/:groupId', requireAuth, async (req, res) => {
    try {
        const userId = req.userId;
        const groupId = parseInt(req.params.groupId);

        if (isNaN(groupId) || groupId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid group ID.'
            });
        }

        const limit = parseInt(req.query.limit) || 100;
        const before = req.query.before || null;

        const messages = await getMessagesByGroup(groupId, userId, limit, before);

        res.json({
            success: true,
            data: { messages }
        });

    } catch (error) {
        console.error('Error fetching messages:', error);
        let statusCode = 400;
        if (error.message.includes('not found')) {
            statusCode = 404;
        } else if (error.message.includes('must be a member')) {
            statusCode = 403;
        }
        res.status(statusCode).json({
            success: false,
            message: error.message
        });
    }
});

router.delete('/group/:groupId', requireAuth, async (req, res) => {
    try {
        const userId = req.userId;
        const groupId = parseInt(req.params.groupId);

        if (isNaN(groupId) || groupId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid group ID.'
            });
        }

        const result = await deleteAllMessagesByGroup(groupId, userId);

        emitChatCleared(groupId);

        res.json({
            success: true,
            message: 'Chat cleared successfully',
            data: result
        });

    } catch (error) {
        console.error('Error clearing chat:', error);
        let statusCode = 400;
        if (error.message.includes('not found')) {
            statusCode = 404;
        } else if (error.message.includes('Only the group owner')) {
            statusCode = 403;
        }
        res.status(statusCode).json({
            success: false,
            message: error.message
        });
    }
});

export default router;

