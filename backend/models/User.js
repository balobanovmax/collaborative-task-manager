import pool from '../config/database.js';
import { hashPassword, comparePassword } from '../utils/passwordHash.js';

const validateUserInput = (username, email, password) => {
    const errors = [];
    
    if (!username || username.trim().length === 0) {
        errors.push('Username is required');
    } else if (username.length < 3) {
        errors.push('Username must be at least 3 characters');
    } else if (username.length > 50) {
        errors.push('Username must be less than 50 characters');
    } else if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
        errors.push('Username can only contain letters, numbers, hyphens, and underscores');
    }
    
    if (!email || email.trim().length === 0) {
        errors.push('Email is required');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push('Invalid email format');
    } else if (email.length > 255) {
        errors.push('Email must be less than 255 characters');
    }
    
    if (!password) {
        errors.push('Password is required');
    } else if (password.length < 6) {
        errors.push('Password must be at least 6 characters');
    } else if (password.length > 128) {
        errors.push('Password must be less than 128 characters');
    }
    
    return errors;
};

export const createUser = async (username, email, password) => {
    try {
        // Input validation
        const validationErrors = validateUserInput(username, email, password);
        if (validationErrors.length > 0) {
            throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
        }
        
        // Trim and normalize inputs
        const normalizedUsername = username.trim();
        const normalizedEmail = email.trim().toLowerCase();
        
        // Hash the password
        const hashedPassword = await hashPassword(password);
        
        // Insert user into database
        const query = `
            INSERT INTO users (username, email, password_hash, created_at)
            VALUES ($1, $2, $3, NOW())
            RETURNING id, username, email, created_at
        `;
        
        const values = [normalizedUsername, normalizedEmail, hashedPassword];
        const result = await pool.query(query, values);
        
        // Ensure we got a result
        if (!result.rows || result.rows.length === 0) {
            throw new Error('User creation failed - no data returned');
        }
        
        return result.rows[0];
        
    } catch (error) {
        // Handle specific database errors
        if (error.code === '23505') {
            // Duplicate key violation
            if (error.constraint === 'users_username_key') {
                throw new Error('Username already exists');
            } else if (error.constraint === 'users_email_key') {
                throw new Error('Email already exists');
            } else {
                throw new Error('Username or email already exists');
            }
        } else if (error.code === '23502') {
            // Not null violation
            throw new Error('Required field is missing');
        } else if (error.code === '22001') {
            // String too long
            throw new Error('Input data is too long');
        } else if (error.message.includes('Validation failed')) {
            // Re-throw validation errors as-is
            throw error;
        } else {
            // Generic database error
            console.error('Database error in createUser:', error);
            throw new Error('User creation failed due to server error');
        }
    }
};

// Function 2: Find user by email with better validation
export const findUserByEmail = async (email) => {
    try {
        // Input validation
        if (!email || typeof email !== 'string') {
            throw new Error('Valid email is required');
        }
        
        // Trim first, then validate format
        const trimmedEmail = email.trim();
        if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
            throw new Error('Invalid email format');
        }
        
        const normalizedEmail = trimmedEmail.toLowerCase();
        
        const query = `
            SELECT id, username, email, password_hash, profile_picture_url, bio, created_at
            FROM users 
            WHERE email = $1
        `;
        
        const result = await pool.query(query, [normalizedEmail]);
        
        return result.rows[0] || null;
        
    } catch (error) {
        if (error.message.includes('email')) {
            // Re-throw validation errors
            throw error;
        }
        console.error('Database error in findUserByEmail:', error);
        throw new Error('User lookup failed due to server error');
    }
};

// Function 3: Find user by ID with validation
export const findUserById = async (userId) => {
    try {
        // Input validation
        if (!userId) {
            throw new Error('User ID is required');
        }
        
        // Ensure userId is a number
        const numericUserId = parseInt(userId, 10);
        if (isNaN(numericUserId) || numericUserId <= 0) {
            throw new Error('Invalid user ID format');
        }
        
        const query = `
            SELECT id, username, email, profile_picture_url, bio, created_at
            FROM users 
            WHERE id = $1
        `;
        
        const result = await pool.query(query, [numericUserId]);
        
        return result.rows[0] || null;
        
    } catch (error) {
        if (error.message.includes('User ID') || error.message.includes('Invalid')) {
            // Re-throw validation errors
            throw error;
        }
        console.error('Database error in findUserById:', error);
        throw new Error('User lookup failed due to server error');
    }
};

// Enhanced password verification with rate limiting consideration
export const verifyUserPassword = async (email, plainPassword) => {
    try {
        // Input validation
        if (!email || !plainPassword) {
            throw new Error('Email and password are required');
        }
        
        if (typeof plainPassword !== 'string') {
            throw new Error('Invalid password format');
        }
        
        // Get user with password hash
        const user = await findUserByEmail(email);
        if (!user) {
            // Don't reveal whether user exists or not (security)
            return null;
        }
        
        // Check if password matches
        const isValidPassword = await comparePassword(plainPassword, user.password_hash);
        if (!isValidPassword) {
            return null; // Wrong password
        }
        
        // Return user without password hash
        const { password_hash, ...userWithoutPassword } = user;
        return userWithoutPassword;
        
    } catch (error) {
        if (error.message.includes('required') || error.message.includes('Invalid')) {
            // Re-throw validation errors
            throw error;
        }
        console.error('Database error in verifyUserPassword:', error);
        throw new Error('Password verification failed due to server error');
    }
};

// Utility function to check if email exists (for registration)
export const emailExists = async (email) => {
    try {
        const user = await findUserByEmail(email);
        return user !== null;
    } catch (error) {
        console.error('Error checking email existence:', error);
        return false; // Assume doesn't exist on error
    }
};

export const usernameExists = async (username) => {
    try {
        if (!username || typeof username !== 'string') {
            return false;
        }
        
        const normalizedUsername = username.trim();
        const query = 'SELECT id FROM users WHERE username = $1';
        const result = await pool.query(query, [normalizedUsername]);
        
        return result.rows.length > 0;
    } catch (error) {
        console.error('Error checking username existence:', error);
        return false;
    }
};

