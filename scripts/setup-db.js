import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const getDatabaseConfig = () => {
    if (process.env.DATABASE_URL) {
        return {
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        };
    }

    return {
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'collaborative_task_manager',
        ssl: false
    };
};

async function setupDatabase() {
    const schemaPath = path.join(__dirname, '../database/schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');
    const pool = new Pool(getDatabaseConfig());

    try {
        await pool.query(sql);
        console.log('Database schema applied successfully.');
    } finally {
        await pool.end();
    }
}

setupDatabase().catch((error) => {
    console.error('Database setup failed:', error.message);
    process.exit(1);
});
