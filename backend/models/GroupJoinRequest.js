import pool from '../config/database.js';
import { findGroupById, findGroupByIdWithPassword } from './Group.js';
import { isUserMember, addUserToGroup, getGroupMembers } from './GroupMember.js';
import { findUserById } from './User.js';
import { createNotification } from './Notification.js';

const formatJoinRequest = (row) => ({
    id: row.id,
    group_id: row.group_id,
    user_id: row.user_id,
    status: row.status,
    message: row.message,
    created_at: row.created_at,
    reviewed_at: row.reviewed_at,
    reviewed_by: row.reviewed_by,
    username: row.username,
    profile_picture_url: row.profile_picture_url,
    bio: row.bio,
    group_name: row.group_name
});

export const getJoinPreview = async (groupId, userId) => {
    const group = await findGroupByIdWithPassword(groupId);
    if (!group) {
        throw new Error('Group not found');
    }

    const isMember = await isUserMember(userId, groupId);
    const pendingRequest = await getPendingJoinRequestForUser(groupId, userId);

    return {
        group_id: group.id,
        name: group.name,
        description: group.description,
        is_public: group.is_public,
        requires_password: !group.is_public && !!group.join_password_hash,
        requires_approval: !group.is_public && !group.join_password_hash,
        is_member: isMember,
        has_pending_request: !!pendingRequest,
        pending_request: pendingRequest
    };
};

export const getPendingJoinRequestForUser = async (groupId, userId) => {
    const result = await pool.query(`
        SELECT id, group_id, user_id, status, message, created_at
        FROM group_join_requests
        WHERE group_id = $1 AND user_id = $2 AND status = 'pending'
    `, [groupId, userId]);

    return result.rows[0] || null;
};

export const createJoinRequest = async (groupId, userId, message = null) => {
    const group = await findGroupByIdWithPassword(groupId);
    if (!group) {
        throw new Error('Group not found');
    }

    if (group.is_public) {
        throw new Error('Public groups can be joined directly without a request.');
    }

    if (group.join_password_hash) {
        throw new Error('This group requires a password to join. Use the password join option instead.');
    }

    if (await isUserMember(userId, groupId)) {
        throw new Error('You are already a member of this group');
    }

    const existingPending = await getPendingJoinRequestForUser(groupId, userId);
    if (existingPending) {
        throw new Error('You already have a pending join request for this group');
    }

    const user = await findUserById(userId);
    if (!user) {
        throw new Error('User not found');
    }

    const cleanedMessage = message?.trim() || null;
    if (cleanedMessage && cleanedMessage.length > 500) {
        throw new Error('Request message cannot exceed 500 characters');
    }

    const result = await pool.query(`
        INSERT INTO group_join_requests (group_id, user_id, message)
        VALUES ($1, $2, $3)
        RETURNING id, group_id, user_id, status, message, created_at
    `, [groupId, userId, cleanedMessage]);

    const request = result.rows[0];

    const notification = await createNotification(
        group.owner_id,
        'join_request_received',
        'New join request',
        `${user.username} requested to join ${group.name}.`,
        {
            group_id: groupId,
            request_id: request.id,
            requester_id: userId,
            requester_username: user.username
        }
    );

    return {
        request: {
            ...request,
            username: user.username,
            profile_picture_url: user.profile_picture_url
        },
        notification
    };
};

export const getPendingJoinRequestsForGroup = async (groupId, ownerId) => {
    const group = await findGroupById(groupId);
    if (!group) {
        throw new Error('Group not found');
    }

    if (group.owner_id !== ownerId) {
        throw new Error('Only the group owner can view join requests');
    }

    const result = await pool.query(`
        SELECT
            jr.id,
            jr.group_id,
            jr.user_id,
            jr.status,
            jr.message,
            jr.created_at,
            u.username,
            u.profile_picture_url,
            u.bio
        FROM group_join_requests jr
        JOIN users u ON jr.user_id = u.id
        WHERE jr.group_id = $1 AND jr.status = 'pending'
        ORDER BY jr.created_at ASC
    `, [groupId]);

    return result.rows.map(formatJoinRequest);
};

export const reviewJoinRequest = async (requestId, ownerId, action) => {
    if (!['approve', 'reject'].includes(action)) {
        throw new Error('Action must be approve or reject');
    }

    const requestResult = await pool.query(`
        SELECT jr.*, g.name AS group_name, g.owner_id, u.username
        FROM group_join_requests jr
        JOIN groups g ON jr.group_id = g.id
        JOIN users u ON jr.user_id = u.id
        WHERE jr.id = $1
    `, [requestId]);

    if (requestResult.rows.length === 0) {
        throw new Error('Join request not found');
    }

    const request = requestResult.rows[0];

    if (request.owner_id !== ownerId) {
        throw new Error('Only the group owner can review join requests');
    }

    if (request.status !== 'pending') {
        throw new Error('This join request has already been reviewed');
    }

    if (action === 'approve') {
        if (await isUserMember(request.user_id, request.group_id)) {
            await pool.query(`
                UPDATE group_join_requests
                SET status = 'approved', reviewed_at = CURRENT_TIMESTAMP, reviewed_by = $1
                WHERE id = $2
            `, [ownerId, requestId]);

            return {
                action: 'approved',
                request,
                member: null,
                notification: null
            };
        }

        await addUserToGroup(request.user_id, request.group_id, null, { skipPasswordCheck: true });

        await pool.query(`
            UPDATE group_join_requests
            SET status = 'approved', reviewed_at = CURRENT_TIMESTAMP, reviewed_by = $1
            WHERE id = $2
        `, [ownerId, requestId]);

        const members = await getGroupMembers(request.group_id);
        const newMember = members.find((member) => member.user_id === request.user_id);

        const notification = await createNotification(
            request.user_id,
            'join_request_approved',
            'Join request approved',
            `Your request to join ${request.group_name} was approved.`,
            {
                group_id: request.group_id,
                request_id: requestId
            }
        );

        return {
            action: 'approved',
            request,
            member: newMember,
            notification
        };
    }

    await pool.query(`
        UPDATE group_join_requests
        SET status = 'rejected', reviewed_at = CURRENT_TIMESTAMP, reviewed_by = $1
        WHERE id = $2
    `, [ownerId, requestId]);

    const notification = await createNotification(
        request.user_id,
        'join_request_rejected',
        'Join request declined',
        `Your request to join ${request.group_name} was declined.`,
        {
            group_id: request.group_id,
            request_id: requestId
        }
    );

    return {
        action: 'rejected',
        request,
        notification
    };
};
