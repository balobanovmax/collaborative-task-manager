import pool from '../config/database.js';
import { hashPassword, comparePassword } from '../utils/passwordHash.js';
import { getJoinMode, validateJoinMode } from '../utils/groupJoinMode.js';

const validateGroupInput = (name, description = '') => {
    const errors = [];

    if (!name || name.trim().length === 0) {
        errors.push('Group name is required');
    } else if (name.length < 3) {
        errors.push('Group name must be at least 3 characters');
    } else if (name.length > 100) {
        errors.push('Group name must be less than 100 characters');
    }

    if (description && description.length > 500) {
        errors.push('Description must be less than 500 characters');
    }

    return errors;
};

export const createGroup = async (name, ownerId, description = '', joinMode = 'public', joinPassword = null) => {
    try {
        const validationErrors = validateGroupInput(name, description);
        if (validationErrors.length > 0) {
            throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
        }

        if (!ownerId || typeof ownerId !== 'number') {
            throw new Error('Valid owner ID is required');
        }

        const normalizedJoinMode = validateJoinMode(joinMode);

        const normalizedName = name.trim();
        const normalizedDescription = description ? description.trim() : '';

        const existingGroup = await groupNameExistsForOwner(normalizedName, ownerId);
        if (existingGroup) {
            throw new Error('You already have a group with this name');
        }

        const isPublic = normalizedJoinMode === 'public';
        let joinPasswordHash = null;

        if (normalizedJoinMode === 'password') {
            if (!joinPassword || !joinPassword.trim()) {
                throw new Error('Password is required for password-protected groups');
            }
            joinPasswordHash = await hashPassword(joinPassword.trim());
        }

        const query = `
            INSERT INTO groups (name, owner_id, description, is_public, join_password_hash, created_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
            RETURNING id, name, owner_id, description, is_public, created_at
        `;

        const values = [normalizedName, ownerId, normalizedDescription, isPublic, joinPasswordHash];
        const result = await pool.query(query, values);

        if (!result.rows || result.rows.length === 0) {
            throw new Error('Group creation failed - no data returned');
        }

        const newGroup = result.rows[0];
        console.log('Group created successfully:', newGroup.id);

        return newGroup;

    } catch (error) {
        if (error.code === '23505') {
            throw new Error('Group name already exists');
        } else if (error.code === '23503') {
            throw new Error('Invalid owner ID - user does not exist');
        } else if (error.code === '23502') {
            throw new Error('Required field is missing');
        } else if (error.code === '22001') {
            throw new Error('Input data is too long');
        } else if (error.message.includes('Validation failed') ||
                   error.message.includes('already have a group') ||
                   error.message.includes('Valid owner ID')) {
            throw error;
        } else {
            console.error('Database error in createGroup:', error);
            throw new Error('Group creation failed due to server error');
        }
    }
};

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
            return null;
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

export const findGroupByIdWithPassword = async (groupId) => {
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
            return null;
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
        return false;  // Assume doesn't exist on error
    }
};

export const groupExists = async (groupId) => {
    try {
        const group = await findGroupById(groupId);
        return group !== null;
    } catch (error) {
        console.error('Error checking group existence:', error);
        return false;  // Assume doesn't exist on error
    }
};

export const deleteGroup = async (groupId, ownerId) => {
    try {

        if (!groupId || typeof groupId !== 'number' || groupId <= 0) {
            throw new Error('Valid group ID is required');
        }

        if (!ownerId || typeof ownerId !== 'number' || ownerId <= 0) {
            throw new Error('Valid owner ID is required');
        }

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
        throw error;
    }
};

export const verifyGroupPassword = async (groupId, plainPassword) => {
    try {

        if (!groupId || typeof groupId !== 'number' || groupId <= 0) {
            throw new Error('Valid group ID is required');
        }

        const group = await findGroupByIdWithPassword(groupId);
        if (!group) {
            throw new Error('Group not found');
        }

        // If group is public, no password needed
        if (group.is_public) {
            return true;
        }

        // If private group has no join password, require owner approval
        if (!group.join_password_hash) {
            throw new Error('This private group requires owner approval to join.');
        }

        // If password is required but not provided
        if (!plainPassword || typeof plainPassword !== 'string') {
            throw new Error('Password is required to join this private group');
        }

        const { comparePassword } = await import('../utils/passwordHash.js');
        const isValidPassword = await comparePassword(plainPassword, group.join_password_hash);

        if (!isValidPassword) {
            throw new Error('Incorrect group password');
        }

        return true;

    } catch (error) {
        console.error('Error verifying group password:', error);
        throw error;
    }
};

export const getGroupsByOwner = async (ownerId) => {
    try {
        if (!ownerId || typeof ownerId !== 'number' || ownerId <= 0) {
            throw new Error('Valid owner ID is required');
        }

        const { findUserById } = await import('./User.js');
        const user = await findUserById(ownerId);
        if (!user) {
            throw new Error('User not found');
        }

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

        return result.rows;

    } catch (error) {
        console.error('Error getting groups by owner:', error);
        throw error;
    }
};

export const updateGroup = async (groupId, ownerId, updateData) => {
    try {
        if (!groupId || typeof groupId !== 'number' || groupId <= 0) {
            throw new Error('Valid group ID is required');
        }

        if (!ownerId || typeof ownerId !== 'number' || ownerId <= 0) {
            throw new Error('Valid owner ID is required');
        }

        const group = await findGroupById(groupId);
        if (!group) {
            throw new Error('Group not found');
        }

        if (group.owner_id !== ownerId) {
            throw new Error('Only group owner can update the group');
        }

        const existingGroupWithPassword = await findGroupByIdWithPassword(groupId);

        const { name, description, join_mode, join_password, is_public } = updateData;

        if (name !== undefined) {
            const validationErrors = validateGroupInput(name, description !== undefined ? description : group.description);
            if (validationErrors.length > 0) {
                throw new Error(validationErrors.join(', '));
            }
        }

        const fieldsToUpdate = [];
        const values = [];
        let paramCount = 1;

        if (name !== undefined) {
            fieldsToUpdate.push(`name = $${paramCount}`);
            values.push(name.trim());
            paramCount++;
        }

        if (description !== undefined) {
            fieldsToUpdate.push(`description = $${paramCount}`);
            values.push(description ? description.trim() : '');
            paramCount++;
        }

        let joinModeToApply = join_mode;

        if (joinModeToApply === undefined && is_public !== undefined) {
            if (is_public) {
                joinModeToApply = 'public';
            } else if (join_password && join_password.trim()) {
                joinModeToApply = 'password';
            } else {
                joinModeToApply = getJoinMode(existingGroupWithPassword);
            }
        }

        if (joinModeToApply !== undefined) {
            const normalizedJoinMode = validateJoinMode(joinModeToApply);

            if (normalizedJoinMode === 'public') {
                fieldsToUpdate.push(`is_public = $${paramCount}`);
                values.push(true);
                paramCount++;

                fieldsToUpdate.push(`join_password_hash = $${paramCount}`);
                values.push(null);
                paramCount++;
            } else if (normalizedJoinMode === 'approval') {
                fieldsToUpdate.push(`is_public = $${paramCount}`);
                values.push(false);
                paramCount++;

                fieldsToUpdate.push(`join_password_hash = $${paramCount}`);
                values.push(null);
                paramCount++;
            } else if (normalizedJoinMode === 'password') {
                fieldsToUpdate.push(`is_public = $${paramCount}`);
                values.push(false);
                paramCount++;

                if (join_password && join_password.trim()) {
                    const joinPasswordHash = await hashPassword(join_password.trim());
                    fieldsToUpdate.push(`join_password_hash = $${paramCount}`);
                    values.push(joinPasswordHash);
                    paramCount++;
                } else if (!existingGroupWithPassword.join_password_hash) {
                    throw new Error('Password is required for password-protected groups');
                }
            }
        } else if (join_password && join_password.trim()) {
            if (existingGroupWithPassword.is_public) {
                throw new Error('Cannot set a password on a public group');
            }

            const joinPasswordHash = await hashPassword(join_password.trim());
            fieldsToUpdate.push(`join_password_hash = $${paramCount}`);
            values.push(joinPasswordHash);
            paramCount++;
        }

        if (fieldsToUpdate.length === 0) {
            throw new Error('No fields to update');
        }

        values.push(groupId);

        const query = `
            UPDATE groups
            SET ${fieldsToUpdate.join(', ')}
            WHERE id = $${paramCount}
            RETURNING id, name, owner_id, description, is_public, created_at
        `;

        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
            throw new Error('Failed to update group');
        }

        return result.rows[0];

    } catch (error) {
        console.error('Error updating group:', error);
        throw error;
    }
};

export const transferGroupOwnership = async (groupId, currentOwnerId, newOwnerId) => {
    try {
        if (!groupId || typeof groupId !== 'number' || groupId <= 0) {
            throw new Error('Valid group ID is required');
        }

        if (!currentOwnerId || typeof currentOwnerId !== 'number' || currentOwnerId <= 0) {
            throw new Error('Valid owner ID is required');
        }

        if (!newOwnerId || typeof newOwnerId !== 'number' || newOwnerId <= 0) {
            throw new Error('Valid new owner ID is required');
        }

        if (currentOwnerId === newOwnerId) {
            throw new Error('New owner must be a different group member');
        }

        const group = await findGroupById(groupId);
        if (!group) {
            throw new Error('Group not found');
        }

        if (group.owner_id !== currentOwnerId) {
            throw new Error('Only the group owner can transfer ownership');
        }

        const { isUserMember } = await import('./GroupMember.js');
        const newOwnerIsMember = await isUserMember(newOwnerId, groupId);
        if (!newOwnerIsMember) {
            throw new Error('New owner must be an existing group member');
        }

        const result = await pool.query(`
            UPDATE groups
            SET owner_id = $1
            WHERE id = $2 AND owner_id = $3
            RETURNING id, name, owner_id, description, is_public, created_at
        `, [newOwnerId, groupId, currentOwnerId]);

        if (result.rows.length === 0) {
            throw new Error('Failed to transfer group ownership');
        }

        return result.rows[0];
    } catch (error) {
        console.error('Error transferring group ownership:', error);
        throw error;
    }
};

