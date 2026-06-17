import pool from '../config/database.js';
import { getGroupMembers } from './GroupMember.js';
import { parseMentionsFromContent } from '../utils/mentionParser.js';
import { getVoiceMessagePublicPath, deleteVoiceMessageFiles } from '../utils/voiceMessageFiles.js';

const MESSAGE_SELECT_FIELDS = `
    m.id,
    m.group_id,
    m.user_id,
    m.content,
    m.message_type,
    m.voice_url,
    m.voice_duration_seconds,
    m.created_at,
    u.username,
    u.profile_picture_url
`;

const formatMessageRow = (row, mentions = []) => ({
    id: row.id,
    group_id: row.group_id,
    user_id: row.user_id,
    username: row.username || 'Unknown',
    profile_picture_url: row.profile_picture_url || null,
    content: row.content,
    message_type: row.message_type || 'text',
    voice_url: row.voice_url || null,
    voice_duration_seconds: row.voice_duration_seconds ?? null,
    created_at: row.created_at,
    mentions
});

const ensureCanAccessGroupMessages = async (groupId, userId) => {
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
        throw new Error('You must be a member of this group to access messages.');
    }

    return group;
};

const ensureCanSendGroupMessages = async (groupId, userId) => {
    const groupCheck = await pool.query('SELECT id, owner_id FROM groups WHERE id = $1', [groupId]);
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
};

const fetchUserMeta = async (userId) => {
    const userQuery = await pool.query(
        'SELECT username, profile_picture_url FROM users WHERE id = $1',
        [userId]
    );
    return userQuery.rows[0];
};
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

const attachMentionsToMessages = async (messages) => {
    if (!messages.length) {
        return messages;
    }

    const messageIds = messages.map((message) => message.id);
    const mentionsResult = await pool.query(`
        SELECT mm.message_id, mm.mentioned_user_id, u.username
        FROM message_mentions mm
        JOIN users u ON mm.mentioned_user_id = u.id
        WHERE mm.message_id = ANY($1)
        ORDER BY mm.id ASC
    `, [messageIds]);

    const mentionsByMessageId = {};
    mentionsResult.rows.forEach((row) => {
        if (!mentionsByMessageId[row.message_id]) {
            mentionsByMessageId[row.message_id] = [];
        }
        mentionsByMessageId[row.message_id].push({
            user_id: row.mentioned_user_id,
            username: row.username
        });
    });

    return messages.map((message) => ({
        ...message,
        mentions: mentionsByMessageId[message.id] || []
    }));
};

const storeMessageMentions = async (messageId, mentions) => {
    if (!mentions.length) {
        return;
    }

    for (const mention of mentions) {
        await pool.query(`
            INSERT INTO message_mentions (message_id, mentioned_user_id)
            VALUES ($1, $2)
            ON CONFLICT (message_id, mentioned_user_id) DO NOTHING
        `, [messageId, mention.user_id]);
    }
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

    await ensureCanSendGroupMessages(groupId, userId);

    const members = await getGroupMembers(groupId);
    const mentions = parseMentionsFromContent(validation.cleanedContent, members);
    
    const result = await pool.query(`
        INSERT INTO messages (group_id, user_id, content, message_type)
        VALUES ($1, $2, $3, 'text')
        RETURNING id, group_id, user_id, content, message_type, voice_url, voice_duration_seconds, created_at
    `, [groupId, userId, validation.cleanedContent]);

    const message = result.rows[0];
    await storeMessageMentions(message.id, mentions);
    const user = await fetchUserMeta(userId);

    return formatMessageRow({ ...message, ...user }, mentions);
};

export const createVoiceMessage = async (groupId, userId, file, durationSeconds = null) => {
    if (!groupId || isNaN(groupId) || groupId <= 0) {
        throw new Error('Invalid group ID.');
    }

    if (!userId || isNaN(userId) || userId <= 0) {
        throw new Error('Invalid user ID.');
    }

    if (!file) {
        throw new Error('Voice recording is required.');
    }

    await ensureCanSendGroupMessages(groupId, userId);

    const parsedDuration = durationSeconds === null || durationSeconds === undefined || durationSeconds === ''
        ? null
        : Math.max(1, Math.round(Number(durationSeconds)));

    const voiceUrl = getVoiceMessagePublicPath(file.filename);

    const result = await pool.query(`
        INSERT INTO messages (group_id, user_id, content, message_type, voice_url, voice_duration_seconds)
        VALUES ($1, $2, NULL, 'voice', $3, $4)
        RETURNING id, group_id, user_id, content, message_type, voice_url, voice_duration_seconds, created_at
    `, [groupId, userId, voiceUrl, parsedDuration]);

    const message = result.rows[0];
    const user = await fetchUserMeta(userId);

    return formatMessageRow({ ...message, ...user }, []);
};

export const getMessagesByGroup = async (groupId, userId, limit = 100, before = null) => {
    if (!groupId || isNaN(groupId) || groupId <= 0) {
        throw new Error('Invalid group ID.');
    }
    
    if (!userId || isNaN(userId) || userId <= 0) {
        throw new Error('Invalid user ID.');
    }

    await ensureCanAccessGroupMessages(groupId, userId);
    
    let query;
    let queryParams;
    
    if (before) {
        query = `
            SELECT ${MESSAGE_SELECT_FIELDS}
            FROM messages m
            LEFT JOIN users u ON m.user_id = u.id
            WHERE m.group_id = $1 AND m.created_at < $2
            ORDER BY m.created_at DESC
            LIMIT $3
        `;
        queryParams = [groupId, before, limit];
    } else {
        query = `
            SELECT ${MESSAGE_SELECT_FIELDS}
            FROM messages m
            LEFT JOIN users u ON m.user_id = u.id
            WHERE m.group_id = $1
            ORDER BY m.created_at DESC
            LIMIT $2
        `;
        queryParams = [groupId, limit];
    }
    
    const result = await pool.query(query, queryParams);
    
    const messages = result.rows.map((row) => formatMessageRow(row));
    const messagesWithMentions = await attachMentionsToMessages(messages.reverse());
    return messagesWithMentions;
};

export const deleteAllMessagesByGroup = async (groupId, userId) => {
    if (!groupId || isNaN(groupId) || groupId <= 0) {
        throw new Error('Invalid group ID.');
    }
    
    if (!userId || isNaN(userId) || userId <= 0) {
        throw new Error('Invalid user ID.');
    }

    const group = await ensureCanAccessGroupMessages(groupId, userId);
    
    if (group.owner_id !== userId) {
        throw new Error('Only the group owner can clear the chat.');
    }

    const voiceMessages = await pool.query(
        'SELECT voice_url FROM messages WHERE group_id = $1 AND voice_url IS NOT NULL',
        [groupId]
    );
    deleteVoiceMessageFiles(voiceMessages.rows.map((row) => row.voice_url));
    
    const result = await pool.query('DELETE FROM messages WHERE group_id = $1', [groupId]);
    
    return {
        deleted_count: result.rowCount
    };
};
