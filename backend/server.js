dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import pool from './config/database.js';
import authRoutes from './routes/auth.js';
import groupRoutes from './routes/groups.js';
import userRoutes from './routes/users.js';


const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json());

//authentication routes
app.use('/api/auth', authRoutes);

//group routes
app.use('/api/groups', groupRoutes);

//user routes
app.use('/api/users', userRoutes);

//text route
app.get('/', (req, res) => {
    res.send('Hello World');
});

app.get('/api/db', async (req, res) => {
    try {
        // Actually test the database connection
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

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});