import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { createGroup, findGroupById, deleteGroup, updateGroup } from '../models/Group.js';
import { getMemberCount, addUserToGroup, getGroupMembers, removeUserFromGroup, isUserMember } from '../models/GroupMember.js';
import { emitMemberJoined, emitMemberRemoved, emitGroupUpdated } from '../utils/socket.js';

const router = express.Router();

router.post('/', requireAuth, async (req, res) => {
    try {
        // Get user ID from auth middleware
        const ownerId = req.userId;
        
        // Extract group data from request body
        const { name, description, is_public, join_password } = req.body;
        
        // Validate required fields
        if (!name) {
            return res.status(400).json({
                success: false,
                message: 'Group name is required'
            });
        }
        
        // Create the group using our Group model
        const newGroup = await createGroup(
            name,
            ownerId, 
            description,
            is_public,
            join_password
        );
        
        // Automatically add the group creator as a member
        // Pass the password so creator can join their own private group
        await addUserToGroup(ownerId, newGroup.id, join_password);
        
        // Send success response
        res.status(201).json({
            success: true,
            message: 'Group created successfully',
            data: {
                group: newGroup
            }
        });
        
    } catch (error) {
        console.error('Error creating group:', error);
        
        // Send appropriate error response
        res.status(400).json({
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
                message: 'You must be a member of this group to view its details'
            });
        }
        
        const memberCount = await getMemberCount(groupId);
        
        res.json({
            success: true,
            data: {
                group: {
                    ...group,
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
        
        const { name, description, is_public, join_password } = req.body;
        
        const updatedGroup = await updateGroup(groupId, userId, {
            name,
            description,
            is_public,
            join_password
        });
        
        emitGroupUpdated(groupId);
        
        res.json({
            success: true,
            message: 'Group updated successfully',
            data: { group: updatedGroup }
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
        // Extract and validate group ID from URL parameter
        const groupId = parseInt(req.params.id);
        
        if (isNaN(groupId) || groupId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid group ID. Must be a positive number.'
            });
        }
        
        // Get user ID from auth middleware
        const userId = req.userId;
        
        // Extract password from request body (optional)
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
        
        // Determine appropriate status code based on error message
        let statusCode = 400; // Default to Bad Request
        
        if (error.message.includes('not found')) {
            statusCode = 404; // Not Found
        } else if (error.message.includes('already a member')) {
            statusCode = 409; // Conflict
        } else if (error.message.includes('Password is required') || 
                   error.message.includes('Incorrect group password')) {
            statusCode = 403; // Forbidden
        }
        
        // Send appropriate error response
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
        // Extract and validate group ID from URL parameter
        const groupId = parseInt(req.params.id);
        
        if (isNaN(groupId) || groupId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid group ID. Must be a positive number.'
            });
        }
        
        // Get user ID from auth middleware
        const userId = req.userId;
        
        const result = await removeUserFromGroup(userId, groupId);
        
        emitMemberRemoved(groupId, userId);
        
        res.json({
            success: true,
            message: 'Successfully left the group',
            data: result
        });
        
    } catch (error) {
        console.error('Error leaving group:', error);
        
        // Determine appropriate status code based on error message
        let statusCode = 400; // Default to Bad Request
        
        if (error.message.includes('not found')) {
            statusCode = 404; // Not Found
        } else if (error.message.includes('not a member')) {
            statusCode = 409; // Conflict
        } else if (error.message.includes('cannot remove the group owner')) {
            statusCode = 403; // Forbidden
        }
        
        // Send appropriate error response
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
        // Extract and validate group ID from URL parameter
        const groupId = parseInt(req.params.id);
        
        if (isNaN(groupId) || groupId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid group ID. Must be a positive number.'
            });
        }
        
        // Get user ID from auth middleware
        const ownerId = req.userId;
        
        // Use Group model to delete the group (with owner validation)
        const result = await deleteGroup(groupId, ownerId);
        
        // Send successful response
        res.json({
            success: true,
            message: 'Group deleted successfully',
            data: result
        });
        
    } catch (error) {
        console.error('Error deleting group:', error);
        
        // Determine appropriate status code based on error message
        let statusCode = 400; // Default to Bad Request
        
        if (error.message.includes('not found')) {
            statusCode = 404; // Not Found
        } else if (error.message.includes('not authorized') || 
                   error.message.includes('Only the group owner')) {
            statusCode = 403; // Forbidden
        }
        
        // Send appropriate error response
        res.status(statusCode).json({
            success: false,
            message: error.message
        });
    }
});

export default router;