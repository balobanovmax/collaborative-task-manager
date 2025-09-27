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

/**
 * Get user's full profile (private - for own profile view)
 * @param {number} userId - The ID of the user
 * @returns {Object|null} User profile object with private info or null if not found
 */
export const getUserProfile = async (userId) => {
    try {
        // Validate input
        if (!userId || isNaN(userId) || userId <= 0) {
            throw new Error('Invalid user ID. Must be a positive number.');
        }
        
        // Query to get full profile (including email for own profile)
        const query = `
            SELECT 
                id,
                username,
                email,
                bio,
                profile_picture_url,
                created_at
            FROM users 
            WHERE id = $1
        `;
        
        const result = await pool.query(query, [userId]);
        
        // Return user profile or null if not found
        if (result.rows.length === 0) {
            return null;
        }
        
        return result.rows[0];
        
    } catch (error) {
        console.error('Error fetching user profile:', error);
        throw error;
    }
};

/**
 * Update user's profile information
 * @param {number} userId - The ID of the user to update
 * @param {Object} profileData - Object containing profile fields to update
 * @param {string} [profileData.bio] - User's bio (optional)
 * @param {string} [profileData.profile_picture_url] - URL to user's profile picture (optional)
 * @returns {Object} Updated user profile object
 */
export const updateUserProfile = async (userId, profileData) => {
    try {
        // Validate user ID
        if (!userId || isNaN(userId) || userId <= 0) {
            throw new Error('Invalid user ID. Must be a positive number.');
        }
        
        // Validate that profileData is provided and is an object
        if (!profileData || typeof profileData !== 'object') {
            throw new Error('Profile data is required and must be an object.');
        }
        
        // Extract and validate updateable fields
        const { bio, profile_picture_url } = profileData;
        
        // Check that at least one field is being updated
        if (bio === undefined && profile_picture_url === undefined) {
            throw new Error('At least one field (bio or profile_picture_url) must be provided for update.');
        }
        
        // Validate bio if provided
        if (bio !== undefined) {
            if (typeof bio !== 'string') {
                throw new Error('Bio must be a string.');
            }
            if (bio.length > 500) {
                throw new Error('Bio cannot exceed 500 characters.');
            }
        }
        
        // Validate profile_picture_url if provided
        if (profile_picture_url !== undefined) {
            if (typeof profile_picture_url !== 'string') {
                throw new Error('Profile picture URL must be a string.');
            }
            if (profile_picture_url.length > 255) {
                throw new Error('Profile picture URL cannot exceed 255 characters.');
            }
            // Basic URL validation (optional but good practice)
            if (profile_picture_url.trim() !== '' && !profile_picture_url.match(/^https?:\/\/.+/)) {
                throw new Error('Profile picture URL must be a valid HTTP/HTTPS URL or empty string.');
            }
        }
        
        // Check if user exists first
        const userExists = await getUserProfile(userId);
        if (!userExists) {
            throw new Error(`User with ID ${userId} not found.`);
        }
        
        // Build dynamic query based on provided fields
        const fieldsToUpdate = [];
        const queryValues = [];
        let paramCounter = 1;
        
        if (bio !== undefined) {
            fieldsToUpdate.push(`bio = $${paramCounter}`);
            // Convert empty string to NULL for better database semantics
            queryValues.push(bio.trim() === '' ? null : bio.trim());
            paramCounter++;
        }
        
        if (profile_picture_url !== undefined) {
            fieldsToUpdate.push(`profile_picture_url = $${paramCounter}`);
            // Convert empty string to NULL for better database semantics
            queryValues.push(profile_picture_url.trim() === '' ? null : profile_picture_url.trim());
            paramCounter++;
        }
        
        // Add user ID as the last parameter
        queryValues.push(userId);
        
        // Build and execute the update query
        const query = `
            UPDATE users 
            SET ${fieldsToUpdate.join(', ')}
            WHERE id = $${paramCounter}
            RETURNING id, username, email, bio, profile_picture_url, created_at
        `;
        
        const result = await pool.query(query, queryValues);
        
        // Return updated user profile
        return result.rows[0];
        
    } catch (error) {
        console.error('Error updating user profile:', error);
        throw error;
    }
};

/**
 * Get user's public profile (for viewing other users)
 * @param {number} userId - The ID of the user
 * @returns {Object|null} User public profile object (no email) or null if not found
 */
export const getUserPublicProfile = async (userId) => {
    try {
        // Validate input
        if (!userId || isNaN(userId) || userId <= 0) {
            throw new Error('Invalid user ID. Must be a positive number.');
        }
        
        // Query to get public profile (excluding email for privacy)
        const query = `
            SELECT 
                id,
                username,
                bio,
                profile_picture_url,
                created_at
            FROM users 
            WHERE id = $1
        `;
        
        const result = await pool.query(query, [userId]);
        
        // Return user public profile or null if not found
        if (result.rows.length === 0) {
            return null;
        }
        
        return result.rows[0];
        
    } catch (error) {
        console.error('Error fetching user public profile:', error);
        throw error;
    }
};

