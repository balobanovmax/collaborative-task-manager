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
 * Find a group by ID including password hash (internal use only)
 * @param {number} groupId - The group's ID
 * @returns {object|null} Group object with password hash or null if not found
 */
const findGroupByIdWithPassword = async (groupId) => {
    try {
        if (!groupId || typeof groupId !== 'number') {
            throw new Error('Valid group ID is required');
        }
        
        const query = `
            SELECT id, name, owner_id, description, is_public, created_at, join_password_hash
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
        console.error('Database error in findGroupByIdWithPassword:', error);
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

/**
 * Delete a group (only owner can delete)
 * @param {number} groupId - The group's ID to delete
 * @param {number} ownerId - The owner's user ID (for authorization)
 * @returns {boolean} True if successfully deleted
 * @throws {Error} If validation fails or database error occurs
 */
export const deleteGroup = async (groupId, ownerId) => {
    try {
        // Input validation
        if (!groupId || typeof groupId !== 'number' || groupId <= 0) {
            throw new Error('Valid group ID is required');
        }
        
        if (!ownerId || typeof ownerId !== 'number' || ownerId <= 0) {
            throw new Error('Valid owner ID is required');
        }
        
        // Check if group exists and user is the owner
        const group = await findGroupById(groupId);
        if (!group) {
            throw new Error('Group not found');
        }
        
        if (group.owner_id !== ownerId) {
            throw new Error('Only group owner can delete the group');
        }
        
        // Delete the group (CASCADE will handle group_members and tasks)
        const query = 'DELETE FROM groups WHERE id = $1 AND owner_id = $2';
        const result = await pool.query(query, [groupId, ownerId]);
        
        if (result.rowCount === 0) {
            throw new Error('Failed to delete group');
        }
        
        console.log(`Group ${groupId} successfully deleted by owner ${ownerId}`);
        return true;
        
    } catch (error) {
        console.error('Error deleting group:', error);
        throw error; // Re-throw to handle in route
    }
};

/**
 * Verify group join password
 * @param {number} groupId - The group's ID
 * @param {string} plainPassword - Plain text password to verify
 * @returns {boolean} True if password is correct or no password required
 * @throws {Error} If validation fails or database error occurs
 */
export const verifyGroupPassword = async (groupId, plainPassword) => {
    try {
        // Input validation
        if (!groupId || typeof groupId !== 'number' || groupId <= 0) {
            throw new Error('Valid group ID is required');
        }
        
        // Find the group
        const group = await findGroupByIdWithPassword(groupId);
        if (!group) {
            throw new Error('Group not found');
        }
        
        // If group is public, no password needed
        if (group.is_public) {
            return true;
        }
        
        // If private group has no join password, allow joining
        if (!group.join_password_hash) {
            return true;
        }
        
        // If password is required but not provided
        if (!plainPassword || typeof plainPassword !== 'string') {
            throw new Error('Password is required to join this private group');
        }
        
        // Verify password using bcrypt
        const { comparePassword } = await import('../utils/passwordHash.js');
        const isValidPassword = await comparePassword(plainPassword, group.join_password_hash);
        
        if (!isValidPassword) {
            throw new Error('Incorrect group password');
        }
        
        return true;
        
    } catch (error) {
        console.error('Error verifying group password:', error);
        throw error; // Re-throw to handle in route
    }
};

/**
 * Get all groups owned by a specific user
 * @param {number} ownerId - The owner's user ID
 * @returns {Array} Array of group objects owned by the user
 * @throws {Error} If validation fails or database error occurs
 */
export const getGroupsByOwner = async (ownerId) => {
    try {
        // Input validation
        if (!ownerId || typeof ownerId !== 'number' || ownerId <= 0) {
            throw new Error('Valid owner ID is required');
        }
        
        // Check if user exists (optional validation)
        const { findUserById } = await import('./User.js');
        const user = await findUserById(ownerId);
        if (!user) {
            throw new Error('User not found');
        }
        
        // Query groups owned by the user
        const query = `
            SELECT 
                g.id, 
                g.name, 
                g.description, 
                g.is_public, 
                g.created_at,
                g.owner_id,
                (
                    SELECT COUNT(*) 
                    FROM group_members gm 
                    WHERE gm.group_id = g.id
                ) as member_count
            FROM groups g
            WHERE g.owner_id = $1 
            ORDER BY g.created_at DESC
        `;
        
        const result = await pool.query(query, [ownerId]);
        
        console.log(`Found ${result.rows.length} groups owned by user ${ownerId}`);
        return result.rows;
        
    } catch (error) {
        console.error('Error getting groups by owner:', error);
        throw error; // Re-throw to handle in route
    }
};


