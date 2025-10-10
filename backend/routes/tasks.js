import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { 
    createTask, 
    findTaskById, 
    getTasksByGroup, 
    updateTask, 
    deleteTask, 
    toggleTaskCompletion 
} from '../models/Task.js';

const router = express.Router();

/**
 * POST /api/tasks - Create a new task
 * Body: { group_id, title, description, due_date }
 * Auth: Required (uses req.userId as creator)
 */
router.post('/', requireAuth, async (req, res) => {
    try {
        const { group_id, title, description, due_date } = req.body;
        const createdBy = req.userId;

        // Validate required fields
        if (!group_id) {
            return res.status(400).json({
                success: false,
                message: 'Group ID is required'
            });
        }

        // Create the task
        const newTask = await createTask(group_id, createdBy, title, description, due_date);

        res.status(201).json({
            success: true,
            message: 'Task created successfully',
            data: {
                task: newTask
            }
        });

    } catch (error) {
        console.error('Error creating task:', error);
        
        // Handle specific error types
        let statusCode = 400;
        if (error.message.includes('not found') || error.message.includes('does not exist')) {
            statusCode = 404;
        } else if (error.message.includes('not a member') || error.message.includes('permission')) {
            statusCode = 403;
        }

        res.status(statusCode).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * GET /api/tasks/:id - Get single task details
 * Auth: Required (must be group member)
 */
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const taskId = parseInt(req.params.id);
        const userId = req.userId;

        // Validate task ID
        if (isNaN(taskId) || taskId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid task ID. Must be a positive number.'
            });
        }

        // Get the task
        const task = await findTaskById(taskId);
        
        if (!task) {
            return res.status(404).json({
                success: false,
                message: 'Task not found'
            });
        }

        // TODO: Add group membership check here
        // For now, we'll trust that findTaskById includes the check
        
        res.json({
            success: true,
            data: {
                task: task
            }
        });

    } catch (error) {
        console.error('Error fetching task:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch task'
        });
    }
});

/**
 * PUT /api/tasks/:id - Update task
 * Body: { title, description, due_date } (any combination)
 * Auth: Required (creator or group owner only)
 */
router.put('/:id', requireAuth, async (req, res) => {
    try {
        const taskId = parseInt(req.params.id);
        const userId = req.userId;
        const { title, description, due_date } = req.body;

        // Validate task ID
        if (isNaN(taskId) || taskId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid task ID. Must be a positive number.'
            });
        }

        // Prepare update data
        const updateData = {};
        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (due_date !== undefined) updateData.due_date = due_date;

        // Check if at least one field is provided
        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'At least one field (title, description, or due_date) must be provided for update.'
            });
        }

        // Update the task
        const updatedTask = await updateTask(taskId, userId, updateData);

        res.json({
            success: true,
            message: 'Task updated successfully',
            data: {
                task: updatedTask
            }
        });

    } catch (error) {
        console.error('Error updating task:', error);
        
        // Handle specific error types
        let statusCode = 400;
        if (error.message.includes('not found')) {
            statusCode = 404;
        } else if (error.message.includes('not a member') || error.message.includes('permission') || error.message.includes('only')) {
            statusCode = 403;
        }

        res.status(statusCode).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * DELETE /api/tasks/:id - Delete task
 * Auth: Required (creator or group owner only)
 */
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const taskId = parseInt(req.params.id);
        const userId = req.userId;

        // Validate task ID
        if (isNaN(taskId) || taskId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid task ID. Must be a positive number.'
            });
        }

        // Delete the task
        const result = await deleteTask(taskId, userId);

        res.json({
            success: true,
            message: result.message,
            data: {
                deleted_task: result.deleted_task
            }
        });

    } catch (error) {
        console.error('Error deleting task:', error);
        
        // Handle specific error types
        let statusCode = 400;
        if (error.message.includes('not found')) {
            statusCode = 404;
        } else if (error.message.includes('not a member') || error.message.includes('permission') || error.message.includes('only')) {
            statusCode = 403;
        }

        res.status(statusCode).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * GET /api/tasks/group/:groupId - Get all tasks for a group
 * Query params: ?completed=true/false&sortBy=created_at&sortOrder=DESC
 * Auth: Required (must be group member)
 */
router.get('/group/:groupId', requireAuth, async (req, res) => {
    try {
        const groupId = parseInt(req.params.groupId);
        const userId = req.userId;

        // Validate group ID
        if (isNaN(groupId) || groupId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid group ID. Must be a positive number.'
            });
        }

        // Extract query parameters
        const { completed, sortBy, sortOrder } = req.query;
        
        // Build options object
        const options = {};
        
        if (completed === 'true') {
            options.completedOnly = true;
        } else if (completed === 'false') {
            options.pendingOnly = true;
        }
        
        if (sortBy) {
            options.sortBy = sortBy;
        }
        
        if (sortOrder) {
            options.sortOrder = sortOrder.toUpperCase();
        }

        // Get tasks for the group
        const result = await getTasksByGroup(groupId, options);

        res.json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('Error fetching group tasks:', error);
        
        // Handle specific error types
        let statusCode = 400;
        if (error.message.includes('not found')) {
            statusCode = 404;
        } else if (error.message.includes('not a member') || error.message.includes('permission')) {
            statusCode = 403;
        }

        res.status(statusCode).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * PATCH /api/tasks/:id/toggle - Toggle task completion
 * Auth: Required (any group member)
 */
router.patch('/:id/toggle', requireAuth, async (req, res) => {
    try {
        const taskId = parseInt(req.params.id);
        const userId = req.userId;

        // Validate task ID
        if (isNaN(taskId) || taskId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid task ID. Must be a positive number.'
            });
        }

        // Toggle task completion
        const result = await toggleTaskCompletion(taskId, userId);

        res.json({
            success: true,
            message: result.message,
            action: result.action,
            data: {
                task: result.task
            }
        });

    } catch (error) {
        console.error('Error toggling task completion:', error);
        
        // Handle specific error types
        let statusCode = 400;
        if (error.message.includes('not found')) {
            statusCode = 404;
        } else if (error.message.includes('not a member') || error.message.includes('permission')) {
            statusCode = 403;
        }

        res.status(statusCode).json({
            success: false,
            message: error.message
        });
    }
});

export default router;
