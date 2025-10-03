import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { createGroup, findGroupById, deleteGroup } from '../models/Group.js';
import { getMemberCount, addUserToGroup, getGroupMembers, removeUserFromGroup } from '../models/GroupMember.js';

const router = express.Router();

/**
 * Create a new group
 * POST /api/groups
 * Body: { name, description, is_public, join_password }
 * Auth: Required (user must be logged in)
 */
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
        await addUserToGroup(ownerId, newGroup.id);
        
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

/**
 * Get group details by ID
 * GET /api/groups/:id
 * Auth: Not required (public group info)
 */
router.get('/:id', async (req, res) => {
    try {
        // Extract and validate group ID from URL parameter
        const groupId = parseInt(req.params.id);
        
        if (isNaN(groupId) || groupId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid group ID. Must be a positive number.'
            });
        }
        
        // Get group details
        const group = await findGroupById(groupId);
        
        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }
        
        // Get member count for additional info
        const memberCount = await getMemberCount(groupId);
        
        // Send successful response with group details
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
        
        // Send appropriate error response
        res.status(500).json({
            success: false,
            message: 'Failed to fetch group details'
        });
    }
});

/**
 * Join a group
 * POST /api/groups/:id/join
 * Body: { password } (optional - only for private groups with passwords)
 * Auth: Required (user must be logged in)
 */
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
        
        // Use GroupMember model to join the group
        const result = await addUserToGroup(userId, groupId, password);
        
        // Send successful response
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

/**
 * Get group members
 * GET /api/groups/:id/members
 * Auth: Not required (public group info)
 */
router.get('/:id/members', async (req, res) => {
    try {
        // Extract and validate group ID from URL parameter
        const groupId = parseInt(req.params.id);
        
        if (isNaN(groupId) || groupId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid group ID. Must be a positive number.'
            });
        }
        
        // Check if group exists first
        const group = await findGroupById(groupId);
        
        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }
        
        // Get all group members with their details
        const members = await getGroupMembers(groupId);
        
        // Send successful response with member list
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
        
        // Send appropriate error response
        res.status(500).json({
            success: false,
            message: 'Failed to fetch group members'
        });
    }
});

/**
 * Leave a group
 * DELETE /api/groups/:id/leave
 * Auth: Required (user must be logged in)
 */
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
        
        // Use GroupMember model to remove user from group
        const result = await removeUserFromGroup(userId, groupId);
        
        // Send successful response
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

/**
 * Delete a group
 * DELETE /api/groups/:id
 * Auth: Required (only group owner can delete)
 */
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