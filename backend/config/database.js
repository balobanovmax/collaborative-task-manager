import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const getDatabaseConfig = () => {
    if (process.env.DATABASE_URL) {
        return {
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        };
    }
    return {
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'MaXim2006',
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'collaborative-task-manager-db',
        ssl: false
    };
};

const pool = new Pool(getDatabaseConfig());
// Test database connection
pool.on('connect', () => {
    console.log('🗄️  Connected to PostgreSQL database');
});

pool.on('error', (err) => {
    console.error('Database connection error:', err);
    process.exit(-1);
});

export default pool;
