import pool from '../config/database.js';

export const validateMessageInput = (content) => {
    const errors = [];
    
    if (!content) {
        errors.push('Message content is required.');
    } else if (typeof content !== 'string') {
        errors.push('Message content must be a string.');
    } else if (content.trim().length === 0) {
        errors.push('Message content cannot be empty.');
    } else if (content.trim().length > 2000) {
        errors.push('Message content cannot exceed 2000 characters.');
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors,
        cleanedContent: content ? content.trim() : null
    };
};

export const createMessage = async (groupId, userId, content) => {
    if (!groupId || isNaN(groupId) || groupId <= 0) {
        throw new Error('Invalid group ID.');
    }
    
    if (!userId || isNaN(userId) || userId <= 0) {
        throw new Error('Invalid user ID.');
    }
    
    const validation = validateMessageInput(content);
    if (!validation.isValid) {
        throw new Error(validation.errors.join(' '));
    }
    
    const groupCheck = await pool.query('SELECT id FROM groups WHERE id = $1', [groupId]);
    if (groupCheck.rows.length === 0) {
        throw new Error('Group not found.');
    }
    
    const memberCheck = await pool.query(`
        SELECT gm.user_id, g.owner_id 
        FROM groups g
        LEFT JOIN group_members gm ON g.id = gm.group_id AND gm.user_id = $1
        WHERE g.id = $2
    `, [userId, groupId]);
    
    if (memberCheck.rows.length === 0) {
        throw new Error('Group not found.');
    }
    
    const { user_id: memberUserId, owner_id: groupOwnerId } = memberCheck.rows[0];
    
    if (!memberUserId && userId !== groupOwnerId) {
        throw new Error('You must be a member of this group to send messages.');
    }
    
    const insertQuery = `
        INSERT INTO messages (group_id, user_id, content)
        VALUES ($1, $2, $3)
        RETURNING id, group_id, user_id, content, created_at
    `;
    
    const result = await pool.query(insertQuery, [groupId, userId, validation.cleanedContent]);
    const message = result.rows[0];
    
    const userQuery = await pool.query(
        'SELECT username, profile_picture_url FROM users WHERE id = $1',
        [userId]
    );
    const user = userQuery.rows[0];
    
    return {
        id: message.id,
        group_id: message.group_id,
        user_id: message.user_id,
        username: user?.username || 'Unknown',
        profile_picture_url: user?.profile_picture_url || null,
        content: message.content,
        created_at: message.created_at
    };
};

export const getMessagesByGroup = async (groupId, userId, limit = 100, before = null) => {
    if (!groupId || isNaN(groupId) || groupId <= 0) {
        throw new Error('Invalid group ID.');
    }
    
    if (!userId || isNaN(userId) || userId <= 0) {
        throw new Error('Invalid user ID.');
    }
    
    const groupCheck = await pool.query('SELECT id, owner_id FROM groups WHERE id = $1', [groupId]);
    if (groupCheck.rows.length === 0) {
        throw new Error('Group not found.');
    }
    
    const group = groupCheck.rows[0];
    
    const memberCheck = await pool.query(
        'SELECT user_id FROM group_members WHERE group_id = $1 AND user_id = $2',
        [groupId, userId]
    );
    
    if (memberCheck.rows.length === 0 && group.owner_id !== userId) {
        throw new Error('You must be a member of this group to view messages.');
    }
    
    let query;
    let queryParams;
    
    if (before) {
        query = `
            SELECT m.id, m.group_id, m.user_id, m.content, m.created_at, u.username, u.profile_picture_url
            FROM messages m
            LEFT JOIN users u ON m.user_id = u.id
            WHERE m.group_id = $1 AND m.created_at < $2
            ORDER BY m.created_at DESC
            LIMIT $3
        `;
        queryParams = [groupId, before, limit];
    } else {
        query = `
            SELECT m.id, m.group_id, m.user_id, m.content, m.created_at, u.username, u.profile_picture_url
            FROM messages m
            LEFT JOIN users u ON m.user_id = u.id
            WHERE m.group_id = $1
            ORDER BY m.created_at DESC
            LIMIT $2
        `;
        queryParams = [groupId, limit];
    }
    
    const result = await pool.query(query, queryParams);
    
    const messages = result.rows.map(row => ({
        id: row.id,
        group_id: row.group_id,
        user_id: row.user_id,
        username: row.username || 'Unknown',
        profile_picture_url: row.profile_picture_url || null,
        content: row.content,
        created_at: row.created_at
    }));
    
    return messages.reverse();
};

export const deleteAllMessagesByGroup = async (groupId, userId) => {
    if (!groupId || isNaN(groupId) || groupId <= 0) {
        throw new Error('Invalid group ID.');
    }
    
    if (!userId || isNaN(userId) || userId <= 0) {
        throw new Error('Invalid user ID.');
    }
    
    const groupCheck = await pool.query('SELECT id, owner_id FROM groups WHERE id = $1', [groupId]);
    if (groupCheck.rows.length === 0) {
        throw new Error('Group not found.');
    }
    
    const group = groupCheck.rows[0];
    
    if (group.owner_id !== userId) {
        throw new Error('Only the group owner can clear the chat.');
    }
    
    const result = await pool.query('DELETE FROM messages WHERE group_id = $1', [groupId]);
    
    return {
        deleted_count: result.rowCount
    };
};

