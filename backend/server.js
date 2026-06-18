import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server } from 'socket.io';
import pool from './config/database.js';
import authRoutes from './routes/auth.js';
import groupRoutes from './routes/groups.js';
import userRoutes from './routes/users.js';
import taskRoutes from './routes/tasks.js';
import messageRoutes from './routes/messages.js';
import notificationRoutes from './routes/notifications.js';
import { startDueDateNotificationScheduler } from './utils/taskNotifications.js';
import { setSocketIO } from './utils/socket.js';
import { registerVoiceHandlers } from './utils/voiceRooms.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const httpServer = createServer(app);
const isLocalDevOrigin = (origin) => {
    if (!origin) {
        return true;
    }

    return /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/.test(origin);
};

const io = new Server(httpServer, {
    cors: {
        origin: (origin, callback) => {
            callback(null, isLocalDevOrigin(origin));
        },
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        credentials: true
    },
    transports: ['polling', 'websocket']
});

setSocketIO(io);

const PORT = process.env.PORT || 3000;

app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/', (req, res) => {
    res.send('Hello World');
});

app.get('/api/db', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW() as current_time');
        res.json({ 
            message: 'Database connected successfully!',
            timestamp: result.rows[0].current_time,
            database: 'collaborative-task-manager-db'
        });
    } catch (error) {
        console.error('Database test failed:', error);
        res.status(500).json({ 
            error: 'Database connection failed',
            details: error.message 
        });
    }
});

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('join-user', (userId) => {
        if (userId) {
            socket.join(`user-${userId}`);
            console.log(`Socket ${socket.id} joined user-${userId}`);
        }
    });

    socket.on('leave-user', (userId) => {
        if (userId) {
            socket.leave(`user-${userId}`);
            console.log(`Socket ${socket.id} left user-${userId}`);
        }
    });

    socket.on('join-group', (groupId) => {
        socket.join(`group-${groupId}`);
        console.log(`Socket ${socket.id} joined group-${groupId}`);
    });

    socket.on('leave-group', (groupId) => {
        socket.leave(`group-${groupId}`);
        console.log(`Socket ${socket.id} left group-${groupId}`);
    });

    socket.on('chat-typing', (payload = {}) => {
        const groupId = parseInt(payload.groupId, 10);
        const userId = parseInt(payload.userId, 10);
        const username = typeof payload.username === 'string' ? payload.username.trim() : '';

        if (!groupId || !userId || !username) {
            return;
        }

        socket.to(`group-${groupId}`).emit('chat-typing', {
            groupId,
            userId,
            username,
            isTyping: Boolean(payload.isTyping)
        });
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

registerVoiceHandlers(io);

httpServer.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    startDueDateNotificationScheduler();
});
