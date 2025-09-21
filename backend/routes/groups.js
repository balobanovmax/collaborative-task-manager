import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { createGroup, findGroupById } from '../models/Group.js';
import { getMemberCount } from '../models/GroupMember.js';

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

export default router;
//eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjE2LCJpYXQiOjE3NTg0MDY0MDgsImVtYWlsIjoidXNlcjFAZXhhbXBsZS5jb20iLCJleHAiOjE3NTkwMTEyMDh9.VrUi87sybuzI3vzvFY0T7lrvk49Sr5lX12gWZidO2KI