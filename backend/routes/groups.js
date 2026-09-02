import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { createGroup, findGroupById, findGroupByIdWithPassword, deleteGroup, updateGroup, transferGroupOwnership } from '../models/Group.js';
import { formatGroupForResponse } from '../utils/groupJoinMode.js';
import { getMemberCount, addUserToGroup, getGroupMembers, removeUserFromGroup, isUserMember } from '../models/GroupMember.js';
import {
    getJoinPreview,
    createJoinRequest,
    getPendingJoinRequestsForGroup,
    reviewJoinRequest
} from '../models/GroupJoinRequest.js';
import {
    emitMemberJoined,
    emitMemberRemoved,
    emitGroupUpdated,
    emitNotification,
    emitJoinRequestUpdated
} from '../utils/socket.js';

const router = express.Router();

router.post('/', requireAuth, async (req, res) => {
    try {

        const ownerId = req.userId;

        const { name, description, join_mode, is_public, join_password } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                message: 'Group name is required'
            });
        }

        let resolvedJoinMode = join_mode;
        if (!resolvedJoinMode) {
            if (is_public === true || is_public === undefined) {
                resolvedJoinMode = 'public';
            } else if (join_password && join_password.trim()) {
                resolvedJoinMode = 'password';
            } else {
                resolvedJoinMode = 'approval';
            }
        }

        const newGroup = await createGroup(
            name,
            ownerId,
            description,
            resolvedJoinMode,
            join_password
        );

        await addUserToGroup(ownerId, newGroup.id, join_password, { skipPasswordCheck: true });

        res.status(201).json({
            success: true,
            message: 'Group created successfully',
            data: {
                group: {
                    ...newGroup,
                    join_mode: resolvedJoinMode,
                    has_join_password: resolvedJoinMode === 'password'
                }
            }
        });

    } catch (error) {
        console.error('Error creating group:', error);

        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

router.get('/:id/join-preview', requireAuth, async (req, res) => {
    try {
        const groupId = parseInt(req.params.id);

        if (isNaN(groupId) || groupId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid group ID. Must be a positive number.'
            });
        }

        const preview = await getJoinPreview(groupId, req.userId);

        res.json({
            success: true,
            data: { preview }
        });
    } catch (error) {
        console.error('Error fetching join preview:', error);

        let statusCode = 400;
        if (error.message.includes('not found')) {
            statusCode = 404;
        }

        res.status(statusCode).json({
            success: false,
            message: error.message
        });
    }
});

router.post('/:id/join-requests', requireAuth, async (req, res) => {
    try {
        const groupId = parseInt(req.params.id);

        if (isNaN(groupId) || groupId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid group ID. Must be a positive number.'
            });
        }

        const { message } = req.body;
        const result = await createJoinRequest(groupId, req.userId, message);

        emitNotification(result.notification.user_id, result.notification);

        res.status(201).json({
            success: true,
            message: 'Join request submitted. The group owner will be notified.',
            data: result
        });
    } catch (error) {
        console.error('Error creating join request:', error);

        let statusCode = 400;
        if (error.message.includes('not found')) {
            statusCode = 404;
        } else if (error.message.includes('already')) {
            statusCode = 409;
        }

        res.status(statusCode).json({
            success: false,
            message: error.message
        });
    }
});

router.get('/:id/join-requests', requireAuth, async (req, res) => {
    try {
        const groupId = parseInt(req.params.id);

        if (isNaN(groupId) || groupId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid group ID. Must be a positive number.'
            });
        }

        const requests = await getPendingJoinRequestsForGroup(groupId, req.userId);

        res.json({
            success: true,
            data: { requests }
        });
    } catch (error) {
        console.error('Error fetching join requests:', error);

        let statusCode = 400;
        if (error.message.includes('not found')) {
            statusCode = 404;
        } else if (error.message.includes('Only the group owner')) {
            statusCode = 403;
        }

        res.status(statusCode).json({
            success: false,
            message: error.message
        });
    }
});

router.patch('/:id/join-requests/:requestId', requireAuth, async (req, res) => {
    try {
        const groupId = parseInt(req.params.id);
        const requestId = parseInt(req.params.requestId);

        if (isNaN(groupId) || groupId <= 0 || isNaN(requestId) || requestId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid group ID or request ID.'
            });
        }

        const { action } = req.body;
        const result = await reviewJoinRequest(requestId, req.userId, action);

        if (result.notification) {
            emitNotification(result.notification.user_id, result.notification);
        }
        emitJoinRequestUpdated(groupId, result.request, result.action);

        if (result.action === 'approved' && result.member) {
            emitMemberJoined(groupId, result.member);
        }

        res.json({
            success: true,
            message: result.action === 'approved'
                ? 'Join request approved'
                : 'Join request rejected',
            data: result
        });
    } catch (error) {
        console.error('Error reviewing join request:', error);

        let statusCode = 400;
        if (error.message.includes('not found')) {
            statusCode = 404;
        } else if (error.message.includes('Only the group owner')) {
            statusCode = 403;
        } else if (error.message.includes('already been reviewed')) {
            statusCode = 409;
        }

        res.status(statusCode).json({
            success: false,
            message: error.message
        });
    }
});

router.get('/:id', requireAuth, async (req, res) => {
    try {
        const groupId = parseInt(req.params.id);
        const userId = req.userId;

        if (isNaN(groupId) || groupId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid group ID. Must be a positive number.'
            });
        }

        const group = await findGroupByIdWithPassword(groupId);

        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        const isMember = await isUserMember(userId, groupId);
        if (!isMember) {
            return res.status(403).json({
                success: false,
                message: 'You must be a member of this group to view its details'
            });
        }

        const memberCount = await getMemberCount(groupId);

        res.json({
            success: true,
            data: {
                group: {
                    ...formatGroupForResponse(group),
                    member_count: memberCount
                }
            }
        });

    } catch (error) {
        console.error('Error fetching group details:', error);

        res.status(500).json({
            success: false,
            message: 'Failed to fetch group details'
        });
    }
});

router.put('/:id', requireAuth, async (req, res) => {
    try {
        const groupId = parseInt(req.params.id);
        const userId = req.userId;

        if (isNaN(groupId) || groupId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid group ID.'
            });
        }

        const { name, description, join_mode, is_public, join_password } = req.body;

        const updatedGroup = await updateGroup(groupId, userId, {
            name,
            description,
            join_mode,
            is_public,
            join_password
        });

        const groupWithPassword = await findGroupByIdWithPassword(groupId);

        emitGroupUpdated(groupId);

        res.json({
            success: true,
            message: 'Group updated successfully',
            data: { group: formatGroupForResponse(groupWithPassword) }
        });

    } catch (error) {
        console.error('Error updating group:', error);
        let statusCode = 400;
        if (error.message.includes('not found')) {
            statusCode = 404;
        } else if (error.message.includes('Only group owner')) {
            statusCode = 403;
        }
        res.status(statusCode).json({
            success: false,
            message: error.message
        });
    }
});

router.post('/:id/join', requireAuth, async (req, res) => {
    try {

        const groupId = parseInt(req.params.id);

        if (isNaN(groupId) || groupId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid group ID. Must be a positive number.'
            });
        }

        const userId = req.userId;

        const { password } = req.body;

        const result = await addUserToGroup(userId, groupId, password);

        const members = await getGroupMembers(groupId);
        const newMember = members.find(m => m.user_id === userId);

        if (newMember) {
            emitMemberJoined(groupId, newMember);
        }

        res.status(201).json({
            success: true,
            message: 'Successfully joined group',
            data: result
        });

    } catch (error) {
        console.error('Error joining group:', error);

        let statusCode = 400;

        if (error.message.includes('not found')) {
            statusCode = 404;
        } else if (error.message.includes('already a member')) {
            statusCode = 409;
        } else         if (error.message.includes('Password is required') ||
                   error.message.includes('Incorrect group password') ||
                   error.message.includes('requires owner approval')) {
            statusCode = 403;
        }

        res.status(statusCode).json({
            success: false,
            message: error.message
        });
    }
});

router.get('/:id/members', requireAuth, async (req, res) => {
    try {
        const groupId = parseInt(req.params.id);
        const userId = req.userId;

        if (isNaN(groupId) || groupId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid group ID. Must be a positive number.'
            });
        }

        const group = await findGroupById(groupId);

        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        const isMember = await isUserMember(userId, groupId);
        if (!isMember) {
            return res.status(403).json({
                success: false,
                message: 'You must be a member of this group to view members'
            });
        }

        const members = await getGroupMembers(groupId);

        res.json({
            success: true,
            data: {
                group_id: groupId,
                group_name: group.name,
                members: members,
                total_members: members.length
            }
        });

    } catch (error) {
        console.error('Error fetching group members:', error);

        res.status(500).json({
            success: false,
            message: 'Failed to fetch group members'
        });
    }
});

router.delete('/:id/leave', requireAuth, async (req, res) => {
    try {

        const groupId = parseInt(req.params.id);

        if (isNaN(groupId) || groupId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid group ID. Must be a positive number.'
            });
        }

        const userId = req.userId;
        const transferToUserId = req.body?.transfer_to_user_id
            ? parseInt(req.body.transfer_to_user_id, 10)
            : null;

        if (req.body?.transfer_to_user_id && (isNaN(transferToUserId) || transferToUserId <= 0)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid transfer_to_user_id. Must be a positive number.'
            });
        }

        const group = await findGroupById(groupId);
        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        if (group.owner_id === userId && transferToUserId) {
            await transferGroupOwnership(groupId, userId, transferToUserId);
            emitGroupUpdated(groupId);
        }

        const result = await removeUserFromGroup(userId, groupId);

        emitMemberRemoved(groupId, userId);

        res.json({
            success: true,
            message: 'Successfully left the group',
            data: result
        });

    } catch (error) {
        console.error('Error leaving group:', error);

        let statusCode = 400;

        if (error.message.includes('not found')) {
            statusCode = 404;
        } else if (error.message.includes('not a member')) {
            statusCode = 409;
        } else if (error.message.includes('cannot remove the group owner') ||
                   error.message.includes('Transfer ownership') ||
                   error.message.includes('transfer ownership')) {
            statusCode = 403;
        }

        res.status(statusCode).json({
            success: false,
            message: error.message
        });
    }
});

router.delete('/:id/members/:userId', requireAuth, async (req, res) => {
    try {
        const groupId = parseInt(req.params.id);
        const targetUserId = parseInt(req.params.userId);
        const requestingUserId = req.userId;

        if (isNaN(groupId) || groupId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid group ID. Must be a positive number.'
            });
        }

        if (isNaN(targetUserId) || targetUserId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user ID. Must be a positive number.'
            });
        }

        const group = await findGroupById(groupId);

        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        if (group.owner_id !== requestingUserId) {
            return res.status(403).json({
                success: false,
                message: 'Only the group owner can remove members'
            });
        }

        if (targetUserId === group.owner_id) {
            return res.status(403).json({
                success: false,
                message: 'Cannot remove the group owner'
            });
        }

        const result = await removeUserFromGroup(targetUserId, groupId);

        emitMemberRemoved(groupId, targetUserId);

        res.json({
            success: true,
            message: 'Member removed successfully',
            data: result
        });

    } catch (error) {
        console.error('Error removing member:', error);

        let statusCode = 400;

        if (error.message.includes('not found')) {
            statusCode = 404;
        } else if (error.message.includes('not a member')) {
            statusCode = 409;
        }

        res.status(statusCode).json({
            success: false,
            message: error.message
        });
    }
});

router.delete('/:id', requireAuth, async (req, res) => {
    try {

        const groupId = parseInt(req.params.id);

        if (isNaN(groupId) || groupId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid group ID. Must be a positive number.'
            });
        }

        const ownerId = req.userId;

        const result = await deleteGroup(groupId, ownerId);

        res.json({
            success: true,
            message: 'Group deleted successfully',
            data: result
        });

    } catch (error) {
        console.error('Error deleting group:', error);

        let statusCode = 400;

        if (error.message.includes('not found')) {
            statusCode = 404;
        } else if (error.message.includes('not authorized') ||
                   error.message.includes('Only the group owner')) {
            statusCode = 403;
        }

        res.status(statusCode).json({
            success: false,
            message: error.message
        });
    }
});

export default router;