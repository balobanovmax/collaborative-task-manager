import pool from '../config/database.js';

/**
 * Add a user to a group (join group functionality)
 * @param {number} userId - The user's ID who wants to join
 * @param {number} groupId - The group's ID to join
 * @param {string} [password] - Password for private groups (optional)
 * @returns {object} Membership object with user_id, group_id, joined_at
 * @throws {Error} If validation fails or database error occurs
 */
export const addUserToGroup = async (userId, groupId, password = null) => {
    try {
        // 1. Input validation
        if (!userId || typeof userId !== 'number' || userId <= 0) {
            throw new Error('Valid user ID is required');
        }
        
        if (!groupId || typeof groupId !== 'number' || groupId <= 0) {
            throw new Error('Valid group ID is required');
        }
        
        // 2. Check if user exists
        const { findUserById } = await import('./User.js');
        const user = await findUserById(userId);
        if (!user) {
            throw new Error('User not found');
        }
        
        // 3. Check if group exists
        const { findGroupById } = await import('./Group.js');
        const group = await findGroupById(groupId);
        if (!group) {
            throw new Error('Group not found');
        }
        
        // 4. Check if user is already a member
        const existingMembership = await isUserMember(userId, groupId);
        if (existingMembership) {
            throw new Error('User is already a member of this group');
        }
        
        // 5. Verify group password (if required)
        const { verifyGroupPassword } = await import('./Group.js');
        const canJoin = await verifyGroupPassword(groupId, password);
        if (!canJoin) {
            throw new Error('Access denied - incorrect password or private group');
        }
        
        // 6. Add user to group
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
        
        console.log(`User ${userId} successfully joined group ${groupId}`);
        return {
            user_id: membership.user_id,
            group_id: membership.group_id,
            joined_at: membership.joined_at,
            message: 'Successfully joined group'
        };
        
    } catch (error) {
        console.error('Error adding user to group:', error);
        throw error; // Re-throw to handle in route
    }
};

/**
 * Check if a user is already a member of a group
 * @param {number} userId - The user's ID
 * @param {number} groupId - The group's ID
 * @returns {boolean} True if user is a member, false otherwise
 */
export const isUserMember = async (userId, groupId) => {
    try {
        // Input validation
        if (!userId || typeof userId !== 'number' || userId <= 0) {
            return false; // Invalid input, assume not a member
        }
        
        if (!groupId || typeof groupId !== 'number' || groupId <= 0) {
            return false; // Invalid input, assume not a member
        }
        
        const query = `
            SELECT 1 FROM group_members 
            WHERE user_id = $1 AND group_id = $2
        `;
        
        const result = await pool.query(query, [userId, groupId]);
        return result.rows.length > 0;
        
    } catch (error) {
        console.error('Error checking group membership:', error);
        return false; // Assume not a member on error
    }
};

/**
 * Remove a user from a group (leave group functionality)
 * @param {number} userId - The user's ID who wants to leave
 * @param {number} groupId - The group's ID to leave
 * @param {number} [requesterId] - ID of user making the request (optional, for owner removal)
 * @returns {object} Success message with details
 * @throws {Error} If validation fails or database error occurs
 */
export const removeUserFromGroup = async (userId, groupId, requesterId = null) => {
    try {
        // 1. Input validation
        if (!userId || typeof userId !== 'number' || userId <= 0) {
            throw new Error('Valid user ID is required');
        }
        
        if (!groupId || typeof groupId !== 'number' || groupId <= 0) {
            throw new Error('Valid group ID is required');
        }
        
        // 2. Check if user exists
        const { findUserById } = await import('./User.js');
        const user = await findUserById(userId);
        if (!user) {
            throw new Error('User not found');
        }
        
        // 3. Check if group exists
        const { findGroupById } = await import('./Group.js');
        const group = await findGroupById(groupId);
        if (!group) {
            throw new Error('Group not found');
        }
        
        // 4. Check if user is actually a member
        const isMember = await isUserMember(userId, groupId);
        if (!isMember) {
            throw new Error('User is not a member of this group');
        }
        
        // 5. Authorization check
        const isOwnerRemovingMember = requesterId && requesterId !== userId && group.owner_id === requesterId;
        const isUserLeavingVoluntarily = !requesterId || requesterId === userId;
        
        if (!isUserLeavingVoluntarily && !isOwnerRemovingMember) {
            throw new Error('You can only remove yourself or members from groups you own');
        }
        
        // 6. Special case: Owner leaving their own group
        if (userId === group.owner_id && isUserLeavingVoluntarily) {
            // Check if there are other members
            const memberCount = await getMemberCount(groupId);
            if (memberCount > 1) {
                throw new Error('Group owner cannot leave while other members exist. Transfer ownership or remove all members first.');
            }
            // If owner is the only member, they can leave (group becomes empty)
        }
        
        // 7. Remove user from group
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
        
        // 8. Determine action type for logging
        const actionType = isOwnerRemovingMember ? 'removed by owner' : 'left voluntarily';
        console.log(`User ${userId} ${actionType} from group ${groupId}`);
        
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
        throw error; // Re-throw to handle in route
    }
};

/**
 * Get the number of members in a group
 * @param {number} groupId - The group's ID
 * @returns {number} Number of members in the group
 * @throws {Error} If validation fails or database error occurs
 */
export const getMemberCount = async (groupId) => {
    try {
        // Input validation
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
        throw error; // Re-throw to handle in route
    }
};

/**
 * Get all members of a group with their user details
 * @param {number} groupId - The group's ID
 * @returns {Array} Array of member objects with user details
 * @throws {Error} If validation fails or database error occurs
 */
export const getGroupMembers = async (groupId) => {
    try {
        // Input validation
        if (!groupId || typeof groupId !== 'number' || groupId <= 0) {
            throw new Error('Valid group ID is required');
        }
        
        // Check if group exists
        const { findGroupById } = await import('./Group.js');
        const group = await findGroupById(groupId);
        if (!group) {
            throw new Error('Group not found');
        }
        
        // Debug: First let's see what's in group_members table for this group
        console.log(`Debug: Checking group_members for group ${groupId}`);
        const debugQuery1 = `SELECT * FROM group_members WHERE group_id = $1`;
        const debugResult1 = await pool.query(debugQuery1, [groupId]);
        console.log(`Found ${debugResult1.rows.length} raw memberships:`, debugResult1.rows);
        
        // Debug: Check if users exist
        if (debugResult1.rows.length > 0) {
            const userIds = debugResult1.rows.map(row => row.user_id);
            console.log(`Checking if users exist: ${userIds.join(', ')}`);
            const debugQuery2 = `SELECT id, username FROM users WHERE id = ANY($1)`;
            const debugResult2 = await pool.query(debugQuery2, [userIds]);
            console.log(`Found ${debugResult2.rows.length} users:`, debugResult2.rows);
        }
        
        // Debug: Check if group exists and get owner info
        const debugQuery3 = `SELECT id, name, owner_id FROM groups WHERE id = $1`;
        const debugResult3 = await pool.query(debugQuery3, [groupId]);
        console.log(`Group info:`, debugResult3.rows);
        
        // Simplified query to start - let's break down the problem
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
                is_owner DESC,  -- Owners first
                gm.joined_at ASC -- Then by join date (earliest first)
        `;
        
        const result = await pool.query(query, [groupId]);
        
        // Transform the results to clean objects
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
        
        console.log(`Found ${members.length} members in group ${groupId}`);
        return members;
        
    } catch (error) {
        console.error('Error getting group members:', error);
        throw error; // Re-throw to handle in route
    }
};

/**
 * Get all groups a user has joined (as a member)
 * @param {number} userId - The user's ID
 * @returns {Array} Array of group objects the user is a member of
 * @throws {Error} If validation fails or database error occurs
 */
export const getUserGroups = async (userId) => {
    try {
        // Input validation
        if (!userId || typeof userId !== 'number' || userId <= 0) {
            throw new Error('Valid user ID is required');
        }
        
        // Check if user exists
        const { findUserById } = await import('./User.js');
        const user = await findUserById(userId);
        if (!user) {
            throw new Error('User not found');
        }
        
        // Query to get all groups the user is a member of with group details
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
                is_owner DESC,        -- Groups owned by user first
                gm.joined_at DESC     -- Then by most recently joined
        `;
        
        const result = await pool.query(query, [userId]);
        
        // Transform the results to clean objects
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
        
        console.log(`User ${userId} is a member of ${userGroups.length} groups`);
        return userGroups;
        
    } catch (error) {
        console.error('Error getting user groups:', error);
        throw error; // Re-throw to handle in route
    }
};


