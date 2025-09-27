import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getUserProfile, updateUserProfile, getUserPublicProfile } from '../models/User.js';
import { getUserGroups } from '../models/GroupMember.js';
import { getGroupsByOwner } from '../models/Group.js';

const router = express.Router();

/**
 * Get current user's own profile (private)
 * GET /api/users/profile
 * Auth: Required (user must be logged in)
 */
router.get('/profile', requireAuth, async (req, res) => {
    try {
        // Get user ID from auth middleware
        const userId = req.userId;
        
        // Get user's full profile using User model
        const userProfile = await getUserProfile(userId);
        
        // Check if user exists (shouldn't happen if auth works correctly, but safety first)
        if (!userProfile) {
            return res.status(404).json({
                success: false,
                message: 'User profile not found'
            });
        }
        
        // Send successful response with full profile (including email)
        res.json({
            success: true,
            data: {
                user: userProfile
            }
        });
        
    } catch (error) {
        console.error('Error fetching user profile:', error);
        
        // Send appropriate error response
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user profile'
        });
    }
});

/**
 * Update current user's profile
 * PUT /api/users/profile
 * Body: { bio, profile_picture_url } (both optional)
 * Auth: Required (user must be logged in)
 */
router.put('/profile', requireAuth, async (req, res) => {
    try {
        // Get user ID from auth middleware
        const userId = req.userId;
        
        // Extract profile data from request body
        const { bio, profile_picture_url } = req.body;
        
        // Validate that at least one field is provided
        if (bio === undefined && profile_picture_url === undefined) {
            return res.status(400).json({
                success: false,
                message: 'At least one field (bio or profile_picture_url) must be provided for update.'
            });
        }
        
        // Build update object with only provided fields
        const updateData = {};
        if (bio !== undefined) updateData.bio = bio;
        if (profile_picture_url !== undefined) updateData.profile_picture_url = profile_picture_url;
        
        // Update user profile using User model
        const updatedProfile = await updateUserProfile(userId, updateData);
        
        // Send successful response with updated profile
        res.json({
            success: true,
            message: 'Profile updated successfully',
            data: {
                user: updatedProfile
            }
        });
        
    } catch (error) {
        console.error('Error updating user profile:', error);
        
        // Determine appropriate status code based on error message
        let statusCode = 400; // Default to Bad Request
        
        if (error.message.includes('not found')) {
            statusCode = 404; // Not Found
        } else if (error.message.includes('Bio cannot exceed') || 
                   error.message.includes('Profile picture URL cannot exceed') ||
                   error.message.includes('must be a string') ||
                   error.message.includes('must be a valid HTTP')) {
            statusCode = 400; // Bad Request (validation error)
        }
        
        // Send appropriate error response
        res.status(statusCode).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * Get current user's groups (owned and member groups)
 * GET /api/users/groups
 * Auth: Required (user must be logged in)
 * NOTE: This route MUST come before /:id route to avoid conflicts
 */
router.get('/groups', requireAuth, async (req, res) => {
    try {
        // Get user ID from auth middleware
        const userId = req.userId;
        
        // Get groups where user is the owner
        const ownedGroups = await getGroupsByOwner(userId);
        
        // Get groups where user is a member (includes owned groups)
        const allUserGroups = await getUserGroups(userId);
        
        // Filter out owned groups from member groups to avoid duplication
        const memberGroups = allUserGroups.filter(group => group.owner_id !== userId);
        
        // Calculate totals
        const totalOwnedGroups = ownedGroups.length;
        const totalMemberGroups = memberGroups.length;
        const totalGroups = totalOwnedGroups + totalMemberGroups;
        
        // Send successful response with separated groups
        res.json({
            success: true,
            data: {
                summary: {
                    total_groups: totalGroups,
                    owned_groups: totalOwnedGroups,
                    member_groups: totalMemberGroups
                },
                owned_groups: ownedGroups,
                member_groups: memberGroups
            }
        });
        
    } catch (error) {
        console.error('Error fetching user groups:', error);
        
        // Send appropriate error response
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user groups'
        });
    }
});

/**
 * Get user's public profile by ID
 * GET /api/users/:id
 * Auth: Not required (public endpoint)
 * NOTE: This route MUST come after /groups to avoid route conflicts
 */
router.get('/:id', async (req, res) => {
    try {
        // Extract and validate user ID from URL parameter
        const userId = parseInt(req.params.id);
        
        if (isNaN(userId) || userId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user ID. Must be a positive number.'
            });
        }
        
        // Get user's public profile using User model
        const userProfile = await getUserPublicProfile(userId);
        
        // Check if user exists
        if (!userProfile) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Send successful response with public profile (no email)
        res.json({
            success: true,
            data: {
                user: userProfile
            }
        });
        
    } catch (error) {
        console.error('Error fetching user public profile:', error);
        
        // Send appropriate error response
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user profile'
        });
    }
});

export default router;
