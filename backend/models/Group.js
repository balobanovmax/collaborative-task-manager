import pool from '../config/database.js';
import { hashPassword, comparePassword } from '../utils/passwordHash.js';

/**
 * Validates group input data
 * @param {string} name - Group name
 * @param {string} description - Group description (optional)
 * @returns {string[]} Array of validation errors (empty if valid)
 */
const validateGroupInput = (name, description = '') => {
    const errors = [];
    
    // Group name validation
    if (!name || name.trim().length === 0) {
        errors.push('Group name is required');
    } else if (name.length < 3) {
        errors.push('Group name must be at least 3 characters');
    } else if (name.length > 100) {
        errors.push('Group name must be less than 100 characters');
    }
    
    // Description validation (optional)
    if (description && description.length > 500) {
        errors.push('Description must be less than 500 characters');
    }
    
    return errors;
};

/**
 * Create a new group
 * @param {string} name - Group name
 * @param {number} ownerId - User ID of group creator
 * @param {string} description - Group description (optional)
 * @param {boolean} isPublic - Whether group is public or private
 * @param {string} joinPassword - Password for private groups (optional)
 * @returns {object} Created group object (without password hash)
 */
export const createGroup = async (name, ownerId, description = '', isPublic = false, joinPassword = null) => {
    try {
        // Input validation
        const validationErrors = validateGroupInput(name, description);
        if (validationErrors.length > 0) {
            throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
        }
        
        // Validate owner ID
        if (!ownerId || typeof ownerId !== 'number') {
            throw new Error('Valid owner ID is required');
        }
        
        // Trim and normalize inputs
        const normalizedName = name.trim();
        const normalizedDescription = description ? description.trim() : '';
        
        // Check if group name already exists for this owner (prevent duplicate group names per user)
        const existingGroup = await groupNameExistsForOwner(normalizedName, ownerId);
        if (existingGroup) {
            throw new Error('You already have a group with this name');
        }
        
        // Hash join password if provided
        let joinPasswordHash = null;
        if (joinPassword) {
            joinPasswordHash = await hashPassword(joinPassword);
        }
        
        // Insert group into database
        const query = `
            INSERT INTO groups (name, owner_id, description, is_public, join_password_hash, created_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
            RETURNING id, name, owner_id, description, is_public, created_at
        `;
        
        const values = [normalizedName, ownerId, normalizedDescription, isPublic, joinPasswordHash];
        const result = await pool.query(query, values);
        
        // Ensure we got a result
        if (!result.rows || result.rows.length === 0) {
            throw new Error('Group creation failed - no data returned');
        }
        
        const newGroup = result.rows[0];
        console.log('Group created successfully:', newGroup.id);
        
        return newGroup;
        
    } catch (error) {
        // Handle specific database errors
        if (error.code === '23505') {
            // Duplicate key violation (if we add unique constraints later)
            throw new Error('Group name already exists');
        } else if (error.code === '23503') {
            // Foreign key violation
            throw new Error('Invalid owner ID - user does not exist');
        } else if (error.code === '23502') {
            // Not null violation
            throw new Error('Required field is missing');
        } else if (error.code === '22001') {
            // String too long
            throw new Error('Input data is too long');
        } else if (error.message.includes('Validation failed') || 
                   error.message.includes('already have a group') ||
                   error.message.includes('Valid owner ID')) {
            // Re-throw validation errors as-is
            throw error;
        } else {
            // Generic error
            console.error('Database error in createGroup:', error);
            throw new Error('Group creation failed due to server error');
        }
    }
};

/**
 * Find a group by its ID
 * @param {number} groupId - The group's ID
 * @returns {object|null} Group object or null if not found
 */
export const findGroupById = async (groupId) => {
    try {
        if (!groupId || typeof groupId !== 'number') {
            throw new Error('Valid group ID is required');
        }
        
        const query = `
            SELECT id, name, owner_id, description, is_public, created_at
            FROM groups 
            WHERE id = $1
        `;
        
        const result = await pool.query(query, [groupId]);
        
        if (result.rows.length === 0) {
            return null; // Group not found
        }
        
        return result.rows[0];
        
    } catch (error) {
        if (error.message.includes('Valid group ID')) {
            throw error;
        }
        console.error('Database error in findGroupById:', error);
        throw new Error('Failed to find group due to server error');
    }
};

/**
 * Check if a group name already exists for a specific owner
 * @param {string} name - Group name to check
 * @param {number} ownerId - Owner's user ID
 * @returns {boolean} True if group name exists for this owner
 */
export const groupNameExistsForOwner = async (name, ownerId) => {
    try {
        if (!name || typeof name !== 'string') {
            return false;
        }
        
        if (!ownerId || typeof ownerId !== 'number') {
            return false;
        }
        
        const normalizedName = name.trim();
        const query = 'SELECT id FROM groups WHERE name = $1 AND owner_id = $2';
        const result = await pool.query(query, [normalizedName, ownerId]);
        
        return result.rows.length > 0;
    } catch (error) {
        console.error('Error checking group name existence:', error);
        return false; // Assume doesn't exist on error
    }
};

/**
 * Check if a group exists by ID
 * @param {number} groupId - The group's ID
 * @returns {boolean} True if group exists
 */
export const groupExists = async (groupId) => {
    try {
        const group = await findGroupById(groupId);
        return group !== null;
    } catch (error) {
        console.error('Error checking group existence:', error);
        return false; // Assume doesn't exist on error
    }
};

