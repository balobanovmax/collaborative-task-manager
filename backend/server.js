dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import pool from './config/database.js';
import authRoutes from './routes/auth.js';
import groupRoutes from './routes/groups.js';
import userRoutes from './routes/users.js';
import taskRoutes from './routes/tasks.js';
import messageRoutes from './routes/messages.js';
import { setSocketIO } from './utils/socket.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:3001'],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        credentials: true
    },
    transports: ['polling', 'websocket']
});

setSocketIO(io);

const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/messages', messageRoutes);

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

    socket.on('join-group', (groupId) => {
        socket.join(`group-${groupId}`);
        console.log(`Socket ${socket.id} joined group-${groupId}`);
    });

    socket.on('leave-group', (groupId) => {
        socket.leave(`group-${groupId}`);
        console.log(`Socket ${socket.id} left group-${groupId}`);
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

httpServer.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
