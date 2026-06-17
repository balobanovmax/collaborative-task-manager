import pool from '../config/database.js';

export const addUserToGroup = async (userId, groupId, password = null, options = {}) => {
    const { skipPasswordCheck = false } = options;

    try {
        if (!userId || typeof userId !== 'number' || userId <= 0) {
            throw new Error('Valid user ID is required');
        }

        if (!groupId || typeof groupId !== 'number' || groupId <= 0) {
            throw new Error('Valid group ID is required');
        }

        const { findUserById } = await import('./User.js');
        const user = await findUserById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        const { findGroupById } = await import('./Group.js');
        const group = await findGroupById(groupId);
        if (!group) {
            throw new Error('Group not found');
        }

        const existingMembership = await isUserMember(userId, groupId);
        if (existingMembership) {
            throw new Error('User is already a member of this group');
        }

        const { verifyGroupPassword } = await import('./Group.js');
        if (!skipPasswordCheck) {
            const canJoin = await verifyGroupPassword(groupId, password);
            if (!canJoin) {
                throw new Error('Access denied - incorrect password or private group');
            }
        }

        const query = `
            INSERT INTO group_members (user_id, group_id, joined_at)
            VALUES ($1, $2, CURRENT_TIMESTAMP)
            RETURNING user_id, group_id, joined_at
        `;

        const result = await pool.query(query, [userId, groupId]);

        if (result.rows.length === 0) {
            throw new Error('Failed to add user to group');
        }

        const membership = result.rows[0];

        return {
            user_id: membership.user_id,
            group_id: membership.group_id,
            joined_at: membership.joined_at,
            message: 'Successfully joined group'
        };

    } catch (error) {
        console.error('Error adding user to group:', error);
        throw error;
    }
};

export const isUserMember = async (userId, groupId) => {
    try {
        if (!userId || typeof userId !== 'number' || userId <= 0) {
            return false;
        }

        if (!groupId || typeof groupId !== 'number' || groupId <= 0) {
            return false;
        }

        const query = `
            SELECT 1 FROM group_members
            WHERE user_id = $1 AND group_id = $2
        `;

        const result = await pool.query(query, [userId, groupId]);
        return result.rows.length > 0;

    } catch (error) {
        console.error('Error checking group membership:', error);
        return false;
    }
};

export const removeUserFromGroup = async (userId, groupId, requesterId = null) => {
    try {
        if (!userId || typeof userId !== 'number' || userId <= 0) {
            throw new Error('Valid user ID is required');
        }

        if (!groupId || typeof groupId !== 'number' || groupId <= 0) {
            throw new Error('Valid group ID is required');
        }

        const { findUserById } = await import('./User.js');
        const user = await findUserById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        const { findGroupById } = await import('./Group.js');
        const group = await findGroupById(groupId);
        if (!group) {
            throw new Error('Group not found');
        }

        const isMember = await isUserMember(userId, groupId);
        if (!isMember) {
            throw new Error('User is not a member of this group');
        }

        const isOwnerRemovingMember = requesterId && requesterId !== userId && group.owner_id === requesterId;
        const isUserLeavingVoluntarily = !requesterId || requesterId === userId;

        if (!isUserLeavingVoluntarily && !isOwnerRemovingMember) {
            throw new Error('You can only remove yourself or members from groups you own');
        }

        if (userId === group.owner_id && isUserLeavingVoluntarily) {
            const memberCount = await getMemberCount(groupId);
            if (memberCount > 1) {
                throw new Error('Transfer ownership to another member before leaving the group.');
            }
        }

        const query = `
            DELETE FROM group_members
            WHERE user_id = $1 AND group_id = $2
            RETURNING user_id, group_id
        `;

        const result = await pool.query(query, [userId, groupId]);

        if (result.rows.length === 0) {
            throw new Error('Failed to remove user from group');
        }

        const removedMembership = result.rows[0];

        const actionType = isOwnerRemovingMember ? 'removed by owner' : 'left voluntarily';

        return {
            user_id: removedMembership.user_id,
            group_id: removedMembership.group_id,
            action: actionType,
            message: isOwnerRemovingMember
                ? `User ${userId} was removed from the group by owner`
                : `Successfully left the group`
        };

    } catch (error) {
        console.error('Error removing user from group:', error);
        throw error;
    }
};

export const getMemberCount = async (groupId) => {
    try {
        if (!groupId || typeof groupId !== 'number' || groupId <= 0) {
            throw new Error('Valid group ID is required');
        }

        const query = `
            SELECT COUNT(*) as member_count
            FROM group_members
            WHERE group_id = $1
        `;

        const result = await pool.query(query, [groupId]);
        const count = parseInt(result.rows[0].member_count);

        return count;

    } catch (error) {
        console.error('Error getting member count:', error);
        throw error;
    }
};

export const getGroupMembers = async (groupId) => {
    try {
        if (!groupId || typeof groupId !== 'number' || groupId <= 0) {
            throw new Error('Valid group ID is required');
        }

        const { findGroupById } = await import('./Group.js');
        const group = await findGroupById(groupId);
        if (!group) {
            throw new Error('Group not found');
        }

        const query = `
            SELECT
                gm.user_id,
                gm.group_id,
                gm.joined_at,
                u.username,
                u.email,
                u.profile_picture_url,
                u.bio,
                u.created_at as user_created_at,
                g.owner_id,
                CASE
                    WHEN g.owner_id = gm.user_id THEN true
                    ELSE false
                END as is_owner
            FROM group_members gm
            JOIN users u ON gm.user_id = u.id
            JOIN groups g ON gm.group_id = g.id
            WHERE gm.group_id = $1
            ORDER BY
                is_owner DESC,
                gm.joined_at ASC
        `;

        const result = await pool.query(query, [groupId]);

        const members = result.rows.map(row => ({
            user_id: row.user_id,
            username: row.username,
            email: row.email,
            profile_picture_url: row.profile_picture_url,
            bio: row.bio,
            is_owner: row.is_owner,
            joined_at: row.joined_at,
            user_created_at: row.user_created_at
        }));

        return members;

    } catch (error) {
        console.error('Error getting group members:', error);
        throw error;
    }
};

export const getUserGroups = async (userId) => {
    try {
        if (!userId || typeof userId !== 'number' || userId <= 0) {
            throw new Error('Valid user ID is required');
        }

        const { findUserById } = await import('./User.js');
        const user = await findUserById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        const query = `
            SELECT
                gm.user_id,
                gm.group_id,
                gm.joined_at,
                g.name as group_name,
                g.description,
                g.is_public,
                g.created_at as group_created_at,
                g.owner_id,
                CASE
                    WHEN g.owner_id = gm.user_id THEN true
                    ELSE false
                END as is_owner,
                (
                    SELECT COUNT(*)
                    FROM group_members gm2
                    WHERE gm2.group_id = g.id
                ) as member_count
            FROM group_members gm
            JOIN groups g ON gm.group_id = g.id
            WHERE gm.user_id = $1
            ORDER BY
                is_owner DESC,
                gm.joined_at DESC
        `;

        const result = await pool.query(query, [userId]);

        const userGroups = result.rows.map(row => ({
            id: row.group_id,
            name: row.group_name,
            description: row.description,
            is_public: row.is_public,
            is_owner: row.is_owner,
            member_count: parseInt(row.member_count),
            joined_at: row.joined_at,
            created_at: row.group_created_at,
            owner_id: row.owner_id
        }));

        return userGroups;

    } catch (error) {
        console.error('Error getting user groups:', error);
        throw error;
    }
};


