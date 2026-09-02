import pool from '../config/database.js';
import { hashPassword, comparePassword } from '../utils/passwordHash.js';

const validateUsername = (username) => {
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

    return errors;
};

const isValidProfilePictureUrl = (profilePictureUrl) => {
    if (profilePictureUrl.trim() === '') {
        return true;
    }

    if (profilePictureUrl.startsWith('/uploads/avatars/')) {
        return true;
    }

    return /^https?:\/\/.+/.test(profilePictureUrl);
};

const validateUserInput = (username, email, password) => {
    const errors = [];

    if (!username || username.trim().length === 0) {
        errors.push('Username is required');
    } else {
        errors.push(...validateUsername(username.trim()));
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

        const validationErrors = validateUserInput(username, email, password);
        if (validationErrors.length > 0) {
            throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
        }

        const normalizedUsername = username.trim();
        const normalizedEmail = email.trim().toLowerCase();

        const hashedPassword = await hashPassword(password);

        const query = `
            INSERT INTO users (username, email, password_hash, created_at)
            VALUES ($1, $2, $3, NOW())
            RETURNING id, username, email, created_at
        `;

        const values = [normalizedUsername, normalizedEmail, hashedPassword];
        const result = await pool.query(query, values);

        if (!result.rows || result.rows.length === 0) {
            throw new Error('User creation failed - no data returned');
        }

        return result.rows[0];

    } catch (error) {

        if (error.code === '23505') {

            if (error.constraint === 'users_username_key') {
                throw new Error('Username already exists');
            } else if (error.constraint === 'users_email_key') {
                throw new Error('Email already exists');
            } else {
                throw new Error('Username or email already exists');
            }
        } else if (error.code === '23502') {

            throw new Error('Required field is missing');
        } else if (error.code === '22001') {

            throw new Error('Input data is too long');
        } else if (error.message.includes('Validation failed')) {

            throw error;
        } else {

            console.error('Database error in createUser:', error);
            throw new Error('User creation failed due to server error');
        }
    }
};

export const findUserByEmail = async (email) => {
    try {

        if (!email || typeof email !== 'string') {
            throw new Error('Valid email is required');
        }

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

            throw error;
        }
        console.error('Database error in findUserByEmail:', error);
        throw new Error('User lookup failed due to server error');
    }
};

export const findUserById = async (userId) => {
    try {

        if (!userId) {
            throw new Error('User ID is required');
        }

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

            throw error;
        }
        console.error('Database error in findUserById:', error);
        throw new Error('User lookup failed due to server error');
    }
};

export const verifyUserPassword = async (email, plainPassword) => {
    try {

        if (!email || !plainPassword) {
            throw new Error('Email and password are required');
        }

        if (typeof plainPassword !== 'string') {
            throw new Error('Invalid password format');
        }

        const user = await findUserByEmail(email);
        if (!user) {
            // Don't reveal whether user exists or not (security)
            return null;
        }

        const isValidPassword = await comparePassword(plainPassword, user.password_hash);
        if (!isValidPassword) {
            return null;
        }

        const { password_hash, ...userWithoutPassword } = user;
        return userWithoutPassword;

    } catch (error) {
        if (error.message.includes('required') || error.message.includes('Invalid')) {

            throw error;
        }
        console.error('Database error in verifyUserPassword:', error);
        throw new Error('Password verification failed due to server error');
    }
};

export const emailExists = async (email) => {
    try {
        const user = await findUserByEmail(email);
        return user !== null;
    } catch (error) {
        console.error('Error checking email existence:', error);
        return false;  // Assume doesn't exist on error
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

export const getUserProfile = async (userId) => {
    try {

        if (!userId || isNaN(userId) || userId <= 0) {
            throw new Error('Invalid user ID. Must be a positive number.');
        }

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

        if (result.rows.length === 0) {
            return null;
        }

        return result.rows[0];

    } catch (error) {
        console.error('Error fetching user profile:', error);
        throw error;
    }
};

export const updateUserProfile = async (userId, profileData) => {
    try {

        if (!userId || isNaN(userId) || userId <= 0) {
            throw new Error('Invalid user ID. Must be a positive number.');
        }

        if (!profileData || typeof profileData !== 'object') {
            throw new Error('Profile data is required and must be an object.');
        }

        const { bio, profile_picture_url, username } = profileData;

        if (bio === undefined && profile_picture_url === undefined && username === undefined) {
            throw new Error('At least one field must be provided for update.');
        }

        if (username !== undefined) {
            if (typeof username !== 'string') {
                throw new Error('Username must be a string.');
            }

            const usernameErrors = validateUsername(username.trim());
            if (usernameErrors.length > 0) {
                throw new Error(usernameErrors.join(' '));
            }
        }

        if (bio !== undefined) {
            if (typeof bio !== 'string') {
                throw new Error('Bio must be a string.');
            }
            if (bio.length > 500) {
                throw new Error('Bio cannot exceed 500 characters.');
            }
        }

        if (profile_picture_url !== undefined) {
            if (typeof profile_picture_url !== 'string') {
                throw new Error('Profile picture URL must be a string.');
            }
            if (profile_picture_url.length > 500) {
                throw new Error('Profile picture URL cannot exceed 500 characters.');
            }
            if (!isValidProfilePictureUrl(profile_picture_url)) {
                throw new Error('Profile picture URL must be a valid HTTP/HTTPS URL, an uploaded avatar path, or empty.');
            }
        }

        const userExists = await getUserProfile(userId);
        if (!userExists) {
            throw new Error(`User with ID ${userId} not found.`);
        }

        if (username !== undefined) {
            const normalizedUsername = username.trim();
            if (normalizedUsername !== userExists.username) {
                const duplicateCheck = await pool.query(
                    'SELECT id FROM users WHERE username = $1 AND id != $2',
                    [normalizedUsername, userId]
                );

                if (duplicateCheck.rows.length > 0) {
                    throw new Error('Username already exists');
                }
            }
        }

        const fieldsToUpdate = [];
        const queryValues = [];
        let paramCounter = 1;

        if (username !== undefined) {
            fieldsToUpdate.push(`username = $${paramCounter}`);
            queryValues.push(username.trim());
            paramCounter++;
        }

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

        queryValues.push(userId);

        const query = `
            UPDATE users
            SET ${fieldsToUpdate.join(', ')}
            WHERE id = $${paramCounter}
            RETURNING id, username, email, bio, profile_picture_url, created_at
        `;

        const result = await pool.query(query, queryValues);

        return result.rows[0];

    } catch (error) {
        console.error('Error updating user profile:', error);
        throw error;
    }
};

export const changeUserPassword = async (userId, currentPassword, newPassword) => {
    if (!userId || isNaN(userId) || userId <= 0) {
        throw new Error('Invalid user ID. Must be a positive number.');
    }

    if (!currentPassword || typeof currentPassword !== 'string') {
        throw new Error('Current password is required.');
    }

    if (!newPassword || typeof newPassword !== 'string') {
        throw new Error('New password is required.');
    }

    if (newPassword.length < 6) {
        throw new Error('New password must be at least 6 characters.');
    }

    if (newPassword.length > 128) {
        throw new Error('New password must be less than 128 characters.');
    }

    if (currentPassword === newPassword) {
        throw new Error('New password must be different from your current password.');
    }

    const userResult = await pool.query(
        'SELECT id, password_hash FROM users WHERE id = $1',
        [userId]
    );

    if (userResult.rows.length === 0) {
        throw new Error('User not found.');
    }

    const isValidPassword = await comparePassword(currentPassword, userResult.rows[0].password_hash);
    if (!isValidPassword) {
        throw new Error('Current password is incorrect.');
    }

    const hashedPassword = await hashPassword(newPassword);

    await pool.query(
        'UPDATE users SET password_hash = $1 WHERE id = $2',
        [hashedPassword, userId]
    );

    return { message: 'Password updated successfully.' };
};

export const getUserPublicProfile = async (userId) => {
    try {

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

        if (result.rows.length === 0) {
            return null;
        }

        return result.rows[0];

    } catch (error) {
        console.error('Error fetching user public profile:', error);
        throw error;
    }
};

