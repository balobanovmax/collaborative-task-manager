import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { uploadAvatar } from '../middleware/uploadAvatar.js';
import { getUserProfile, updateUserProfile, getUserPublicProfile, changeUserPassword } from '../models/User.js';
import { getUserGroups } from '../models/GroupMember.js';
import { getGroupsByOwner } from '../models/Group.js';
import { getDashboardSummary } from '../models/Dashboard.js';
import { processDueDateNotifications } from '../utils/taskNotifications.js';
import { deleteAvatarFile, getAvatarPublicPath } from '../utils/avatarFiles.js';

const router = express.Router();

router.get('/profile', requireAuth, async (req, res) => {
    try {
        const userId = req.userId;
        const userProfile = await getUserProfile(userId);
        
        if (!userProfile) {
            return res.status(404).json({
                success: false,
                message: 'User profile not found'
            });
        }
        
        res.json({
            success: true,
            data: {
                user: userProfile
            }
        });
        
    } catch (error) {
        console.error('Error fetching user profile:', error);
        
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user profile'
        });
    }
});

router.put('/profile', requireAuth, async (req, res) => {
    try {
        const userId = req.userId;
        const { bio, profile_picture_url, username } = req.body;
        
        if (bio === undefined && profile_picture_url === undefined && username === undefined) {
            return res.status(400).json({
                success: false,
                message: 'At least one field must be provided for update.'
            });
        }
        
        const updateData = {};
        if (bio !== undefined) updateData.bio = bio;
        if (profile_picture_url !== undefined) updateData.profile_picture_url = profile_picture_url;
        if (username !== undefined) updateData.username = username;

        if (profile_picture_url !== undefined) {
            const currentProfile = await getUserProfile(userId);
            if (
                currentProfile?.profile_picture_url &&
                currentProfile.profile_picture_url !== profile_picture_url
            ) {
                deleteAvatarFile(currentProfile.profile_picture_url);
            }
        }
        
        const updatedProfile = await updateUserProfile(userId, updateData);
        
        res.json({
            success: true,
            message: 'Profile updated successfully',
            data: {
                user: updatedProfile
            }
        });
        
    } catch (error) {
        console.error('Error updating user profile:', error);
        
        let statusCode = 400;
        
        if (error.message.includes('not found')) {
            statusCode = 404;
        } else if (error.message.includes('already exists')) {
            statusCode = 409;
        }
        
        res.status(statusCode).json({
            success: false,
            message: error.message
        });
    }
});

router.put('/profile/password', requireAuth, async (req, res) => {
    try {
        const userId = req.userId;
        const { current_password, new_password } = req.body;

        if (!current_password || !new_password) {
            return res.status(400).json({
                success: false,
                message: 'Current password and new password are required.'
            });
        }

        const result = await changeUserPassword(userId, current_password, new_password);

        res.json({
            success: true,
            message: result.message
        });
    } catch (error) {
        console.error('Error changing password:', error);

        let statusCode = 400;

        if (error.message.includes('not found')) {
            statusCode = 404;
        } else if (error.message.includes('incorrect')) {
            statusCode = 403;
        }

        res.status(statusCode).json({
            success: false,
            message: error.message
        });
    }
});

router.post('/profile/avatar', requireAuth, (req, res) => {
    uploadAvatar.single('avatar')(req, res, async (uploadError) => {
        if (uploadError) {
            return res.status(400).json({
                success: false,
                message: uploadError.message || 'Failed to upload avatar'
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Avatar file is required'
            });
        }

        try {
            const userId = req.userId;
            const avatarPath = getAvatarPublicPath(req.file.filename);
            const currentProfile = await getUserProfile(userId);

            if (currentProfile?.profile_picture_url) {
                deleteAvatarFile(currentProfile.profile_picture_url);
            }

            const updatedProfile = await updateUserProfile(userId, {
                profile_picture_url: avatarPath
            });

            res.json({
                success: true,
                message: 'Avatar uploaded successfully',
                data: {
                    user: updatedProfile
                }
            });
        } catch (error) {
            deleteAvatarFile(getAvatarPublicPath(req.file.filename));

            console.error('Error saving avatar:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to save avatar'
            });
        }
    });
});

router.delete('/profile/avatar', requireAuth, async (req, res) => {
    try {
        const userId = req.userId;
        const currentProfile = await getUserProfile(userId);

        if (!currentProfile) {
            return res.status(404).json({
                success: false,
                message: 'User profile not found'
            });
        }

        if (currentProfile.profile_picture_url) {
            deleteAvatarFile(currentProfile.profile_picture_url);
        }

        const updatedProfile = await updateUserProfile(userId, {
            profile_picture_url: ''
        });

        res.json({
            success: true,
            message: 'Avatar removed successfully',
            data: {
                user: updatedProfile
            }
        });
    } catch (error) {
        console.error('Error removing avatar:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to remove avatar'
        });
    }
});

router.get('/dashboard', requireAuth, async (req, res) => {
    try {
        processDueDateNotifications().catch((error) => {
            console.error('Due date notification check failed:', error);
        });

        const dashboard = await getDashboardSummary(req.userId);

        res.json({
            success: true,
            data: dashboard
        });
    } catch (error) {
        console.error('Error fetching dashboard:', error);

        res.status(500).json({
            success: false,
            message: 'Failed to fetch dashboard'
        });
    }
});

router.get('/groups', requireAuth, async (req, res) => {
    try {
        const userId = req.userId;
        
        const ownedGroups = await getGroupsByOwner(userId);
        const allUserGroups = await getUserGroups(userId);
        const memberGroups = allUserGroups.filter(group => group.owner_id !== userId);
        
        const totalOwnedGroups = ownedGroups.length;
        const totalMemberGroups = memberGroups.length;
        const totalGroups = totalOwnedGroups + totalMemberGroups;
        
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
        
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user groups'
        });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        
        if (isNaN(userId) || userId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user ID. Must be a positive number.'
            });
        }
        
        const userProfile = await getUserPublicProfile(userId);
        
        if (!userProfile) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        res.json({
            success: true,
            data: {
                user: userProfile
            }
        });
        
    } catch (error) {
        console.error('Error fetching user public profile:', error);
        
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user profile'
        });
    }
});

export default router;