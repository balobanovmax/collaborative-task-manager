import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { 
    createTask, 
    findTaskById, 
    getTasksByGroup, 
    updateTask, 
    deleteTask, 
    toggleTaskCompletion,
    updateTaskStatus,
    getTasksAssignedToUser
} from '../models/Task.js';
import { createTaskComment, getCommentsByTask } from '../models/TaskComment.js';
import {
    getSubtasksByTask,
    createSubtask,
    updateSubtask,
    deleteSubtask
} from '../models/TaskSubtask.js';
import { getActivityByTask, logTaskActivity } from '../models/TaskActivity.js';
import {
    createTaskAttachment,
    getAttachmentsByTask,
    deleteTaskAttachment
} from '../models/TaskAttachment.js';
import {
    createTaskDrawing,
    getDrawingsByTask,
    deleteTaskDrawing
} from '../models/TaskDrawing.js';
import { uploadTaskAttachment } from '../middleware/uploadTaskAttachment.js';
import { uploadTaskDrawing } from '../middleware/uploadTaskDrawing.js';
import { getTaskAttachmentPublicPath, deleteTaskAttachmentFile } from '../utils/taskAttachmentFiles.js';
import { getTaskDrawingPublicPath, deleteTaskDrawingFile } from '../utils/taskDrawingFiles.js';
import {
    emitTaskCreated,
    emitTaskUpdated,
    emitTaskDeleted,
    emitTaskToggled,
    emitTaskCommentCreated,
    emitTaskAttachmentAdded,
    emitTaskAttachmentDeleted,
    emitTaskDrawingAdded,
    emitTaskDrawingDeleted
} from '../utils/socket.js';

const router = express.Router();

router.post('/', requireAuth, async (req, res) => {
    try {
        const { group_id, title, description, due_date, assigned_to, priority } = req.body;
        const createdBy = req.userId;

        // Validate required fields
        if (!group_id) {
            return res.status(400).json({
                success: false,
                message: 'Group ID is required'
            });
        }

        const newTask = await createTask(group_id, createdBy, title, description, due_date, assigned_to, priority);

        emitTaskCreated(group_id, newTask);

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

router.get('/my-tasks', requireAuth, async (req, res) => {
    try {
        const userId = req.userId;
        const includeDone = req.query.includeDone === 'true';
        const sortBy = req.query.sortBy || 'due_date';
        const sortOrder = req.query.sortOrder || 'ASC';

        const result = await getTasksAssignedToUser(userId, {
            includeDone,
            sortBy,
            sortOrder,
            status: req.query.status || null,
            priority: req.query.priority || null,
            search: req.query.search || null,
            dueFrom: req.query.dueFrom || null,
            dueTo: req.query.dueTo || null,
            overdueOnly: req.query.overdueOnly === 'true'
        });

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Error fetching my tasks:', error);

        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

router.get('/:id/subtasks', requireAuth, async (req, res) => {
    try {
        const taskId = parseInt(req.params.id, 10);
        const userId = req.userId;

        if (isNaN(taskId) || taskId <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid task ID.' });
        }

        const subtasks = await getSubtasksByTask(taskId, userId);

        res.json({
            success: true,
            data: { subtasks }
        });
    } catch (error) {
        console.error('Error fetching subtasks:', error);
        let statusCode = 400;
        if (error.message.includes('not found')) statusCode = 404;
        if (error.message.includes('member')) statusCode = 403;
        res.status(statusCode).json({ success: false, message: error.message });
    }
});

router.post('/:id/subtasks', requireAuth, async (req, res) => {
    try {
        const taskId = parseInt(req.params.id, 10);
        const userId = req.userId;
        const { title } = req.body;

        if (isNaN(taskId) || taskId <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid task ID.' });
        }

        const subtask = await createSubtask(taskId, userId, title);
        const task = await findTaskById(taskId);

        await logTaskActivity(taskId, userId, 'subtask_added', `Added checklist item "${subtask.title}"`);

        emitTaskUpdated(task.group_id, task);

        res.status(201).json({
            success: true,
            message: 'Subtask created successfully',
            data: { subtask, task }
        });
    } catch (error) {
        console.error('Error creating subtask:', error);
        let statusCode = 400;
        if (error.message.includes('not found')) statusCode = 404;
        if (error.message.includes('member')) statusCode = 403;
        res.status(statusCode).json({ success: false, message: error.message });
    }
});

router.patch('/:id/subtasks/:subtaskId', requireAuth, async (req, res) => {
    try {
        const taskId = parseInt(req.params.id, 10);
        const subtaskId = parseInt(req.params.subtaskId, 10);
        const userId = req.userId;
        const { title, is_completed } = req.body;

        if (isNaN(taskId) || taskId <= 0 || isNaN(subtaskId) || subtaskId <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid task or subtask ID.' });
        }

        const result = await updateSubtask(taskId, subtaskId, userId, { title, is_completed });
        const task = await findTaskById(taskId);

        if (is_completed !== undefined && result.previous.is_completed !== result.subtask.is_completed) {
            const action = result.subtask.is_completed ? 'subtask_completed' : 'subtask_reopened';
            const detail = result.subtask.is_completed
                ? `Completed checklist item "${result.subtask.title}"`
                : `Reopened checklist item "${result.subtask.title}"`;
            await logTaskActivity(taskId, userId, action, detail);
        } else if (title !== undefined && result.previous.title !== result.subtask.title) {
            await logTaskActivity(taskId, userId, 'subtask_updated', `Renamed checklist item to "${result.subtask.title}"`);
        }

        emitTaskUpdated(task.group_id, task);

        res.json({
            success: true,
            message: 'Subtask updated successfully',
            data: { subtask: result.subtask, task }
        });
    } catch (error) {
        console.error('Error updating subtask:', error);
        let statusCode = 400;
        if (error.message.includes('not found')) statusCode = 404;
        if (error.message.includes('member')) statusCode = 403;
        res.status(statusCode).json({ success: false, message: error.message });
    }
});

router.delete('/:id/subtasks/:subtaskId', requireAuth, async (req, res) => {
    try {
        const taskId = parseInt(req.params.id, 10);
        const subtaskId = parseInt(req.params.subtaskId, 10);
        const userId = req.userId;

        if (isNaN(taskId) || taskId <= 0 || isNaN(subtaskId) || subtaskId <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid task or subtask ID.' });
        }

        const deleted = await deleteSubtask(taskId, subtaskId, userId);
        const task = await findTaskById(taskId);

        await logTaskActivity(taskId, userId, 'subtask_removed', `Removed checklist item "${deleted.title}"`);

        emitTaskUpdated(task.group_id, task);

        res.json({
            success: true,
            message: 'Subtask deleted successfully',
            data: { task }
        });
    } catch (error) {
        console.error('Error deleting subtask:', error);
        let statusCode = 400;
        if (error.message.includes('not found')) statusCode = 404;
        if (error.message.includes('member')) statusCode = 403;
        res.status(statusCode).json({ success: false, message: error.message });
    }
});

router.get('/:id/activity', requireAuth, async (req, res) => {
    try {
        const taskId = parseInt(req.params.id, 10);
        const userId = req.userId;
        const limit = parseInt(req.query.limit, 10) || 50;

        if (isNaN(taskId) || taskId <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid task ID.' });
        }

        const activity = await getActivityByTask(taskId, userId, limit);

        res.json({
            success: true,
            data: { activity }
        });
    } catch (error) {
        console.error('Error fetching task activity:', error);
        let statusCode = 400;
        if (error.message.includes('not found')) statusCode = 404;
        if (error.message.includes('member')) statusCode = 403;
        res.status(statusCode).json({ success: false, message: error.message });
    }
});

router.get('/:id/attachments', requireAuth, async (req, res) => {
    try {
        const taskId = parseInt(req.params.id);

        if (isNaN(taskId) || taskId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid task ID'
            });
        }

        const attachments = await getAttachmentsByTask(taskId, req.userId);

        res.json({
            success: true,
            data: { attachments }
        });
    } catch (error) {
        console.error('Error fetching task attachments:', error);

        let statusCode = 400;
        if (error.message.includes('not found')) {
            statusCode = 404;
        } else if (error.message.includes('must be a member')) {
            statusCode = 403;
        }

        res.status(statusCode).json({
            success: false,
            message: error.message
        });
    }
});

router.post('/:id/attachments', requireAuth, (req, res) => {
    uploadTaskAttachment.single('attachment')(req, res, async (uploadError) => {
        if (uploadError) {
            return res.status(400).json({
                success: false,
                message: uploadError.message || 'Failed to upload attachment'
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Attachment file is required'
            });
        }

        const taskId = parseInt(req.params.id);

        if (isNaN(taskId) || taskId <= 0) {
            deleteTaskAttachmentFile(getTaskAttachmentPublicPath(req.file.filename));
            return res.status(400).json({
                success: false,
                message: 'Invalid task ID'
            });
        }

        try {
            const attachment = await createTaskAttachment(taskId, req.userId, req.file);
            const task = await findTaskById(taskId);

            emitTaskAttachmentAdded(task.group_id, taskId, attachment);

            res.status(201).json({
                success: true,
                message: 'Attachment uploaded successfully',
                data: { attachment }
            });
        } catch (error) {
            deleteTaskAttachmentFile(getTaskAttachmentPublicPath(req.file.filename));

            console.error('Error saving task attachment:', error);

            let statusCode = 400;
            if (error.message.includes('not found')) {
                statusCode = 404;
            } else if (error.message.includes('must be a member')) {
                statusCode = 403;
            }

            res.status(statusCode).json({
                success: false,
                message: error.message || 'Failed to save attachment'
            });
        }
    });
});

router.delete('/:id/attachments/:attachmentId', requireAuth, async (req, res) => {
    try {
        const taskId = parseInt(req.params.id);
        const attachmentId = parseInt(req.params.attachmentId);

        if (isNaN(taskId) || taskId <= 0 || isNaN(attachmentId) || attachmentId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid task ID or attachment ID'
            });
        }

        const result = await deleteTaskAttachment(attachmentId, req.userId);
        const task = await findTaskById(taskId);

        emitTaskAttachmentDeleted(task.group_id, taskId, result.id);

        res.json({
            success: true,
            message: 'Attachment deleted successfully',
            data: result
        });
    } catch (error) {
        console.error('Error deleting task attachment:', error);

        let statusCode = 400;
        if (error.message.includes('not found')) {
            statusCode = 404;
        } else if (error.message.includes('must be a member') || error.message.includes('can only delete')) {
            statusCode = 403;
        }

        res.status(statusCode).json({
            success: false,
            message: error.message
        });
    }
});

router.get('/:id/drawings', requireAuth, async (req, res) => {
    try {
        const taskId = parseInt(req.params.id);

        if (isNaN(taskId) || taskId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid task ID'
            });
        }

        const drawings = await getDrawingsByTask(taskId, req.userId);

        res.json({
            success: true,
            data: { drawings }
        });
    } catch (error) {
        console.error('Error fetching task drawings:', error);

        let statusCode = 400;
        if (error.message.includes('not found')) {
            statusCode = 404;
        } else if (error.message.includes('must be a member')) {
            statusCode = 403;
        }

        res.status(statusCode).json({
            success: false,
            message: error.message
        });
    }
});

router.post('/:id/drawings', requireAuth, (req, res) => {
    uploadTaskDrawing.single('drawing')(req, res, async (uploadError) => {
        if (uploadError) {
            return res.status(400).json({
                success: false,
                message: uploadError.message || 'Failed to upload drawing'
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Drawing file is required'
            });
        }

        const taskId = parseInt(req.params.id);

        if (isNaN(taskId) || taskId <= 0) {
            deleteTaskDrawingFile(getTaskDrawingPublicPath(req.file.filename));
            return res.status(400).json({
                success: false,
                message: 'Invalid task ID'
            });
        }

        try {
            const drawing = await createTaskDrawing(taskId, req.userId, req.file, req.body.title);
            const task = await findTaskById(taskId);

            emitTaskDrawingAdded(task.group_id, taskId, drawing);

            res.status(201).json({
                success: true,
                message: 'Drawing saved successfully',
                data: { drawing }
            });
        } catch (error) {
            deleteTaskDrawingFile(getTaskDrawingPublicPath(req.file.filename));

            console.error('Error saving task drawing:', error);

            let statusCode = 400;
            if (error.message.includes('not found')) {
                statusCode = 404;
            } else if (error.message.includes('must be a member')) {
                statusCode = 403;
            }

            res.status(statusCode).json({
                success: false,
                message: error.message || 'Failed to save drawing'
            });
        }
    });
});

router.delete('/:id/drawings/:drawingId', requireAuth, async (req, res) => {
    try {
        const taskId = parseInt(req.params.id);
        const drawingId = parseInt(req.params.drawingId);

        if (isNaN(taskId) || taskId <= 0 || isNaN(drawingId) || drawingId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid task ID or drawing ID'
            });
        }

        const result = await deleteTaskDrawing(drawingId, req.userId);
        const task = await findTaskById(taskId);

        emitTaskDrawingDeleted(task.group_id, taskId, result.id);

        res.json({
            success: true,
            message: 'Drawing deleted successfully',
            data: result
        });
    } catch (error) {
        console.error('Error deleting task drawing:', error);

        let statusCode = 400;
        if (error.message.includes('not found')) {
            statusCode = 404;
        } else if (error.message.includes('must be a member') || error.message.includes('can only delete')) {
            statusCode = 403;
        }

        res.status(statusCode).json({
            success: false,
            message: error.message
        });
    }
});

router.get('/:id/comments', requireAuth, async (req, res) => {
    try {
        const taskId = parseInt(req.params.id);

        if (isNaN(taskId) || taskId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid task ID'
            });
        }

        const comments = await getCommentsByTask(taskId, req.userId);

        res.json({
            success: true,
            data: { comments }
        });
    } catch (error) {
        console.error('Error fetching task comments:', error);

        let statusCode = 400;
        if (error.message.includes('not found')) {
            statusCode = 404;
        } else if (error.message.includes('must be a member')) {
            statusCode = 403;
        }

        res.status(statusCode).json({
            success: false,
            message: error.message
        });
    }
});

router.post('/:id/comments', requireAuth, async (req, res) => {
    try {
        const taskId = parseInt(req.params.id);
        const { content } = req.body;

        if (isNaN(taskId) || taskId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid task ID'
            });
        }

        const comment = await createTaskComment(taskId, req.userId, content);
        const task = await findTaskById(taskId);

        emitTaskCommentCreated(task.group_id, taskId, comment);

        res.status(201).json({
            success: true,
            message: 'Comment added successfully',
            data: { comment }
        });
    } catch (error) {
        console.error('Error creating task comment:', error);

        let statusCode = 400;
        if (error.message.includes('not found')) {
            statusCode = 404;
        } else if (error.message.includes('must be a member')) {
            statusCode = 403;
        }

        res.status(statusCode).json({
            success: false,
            message: error.message
        });
    }
});

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

router.put('/:id', requireAuth, async (req, res) => {
    try {
        const taskId = parseInt(req.params.id);
        const userId = req.userId;
        const { title, description, due_date, assigned_to, priority } = req.body;

        // Validate task ID
        if (isNaN(taskId) || taskId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid task ID. Must be a positive number.'
            });
        }

        const updateData = {};
        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (due_date !== undefined) updateData.due_date = due_date;
        if (assigned_to !== undefined) updateData.assigned_to = assigned_to;
        if (priority !== undefined) updateData.priority = priority;

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'At least one field must be provided for update.'
            });
        }

        // Update the task
        const updatedTask = await updateTask(taskId, userId, updateData);

        emitTaskUpdated(updatedTask.group_id, updatedTask);

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

        emitTaskDeleted(result.deleted_task.group_id, taskId);

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

router.get('/group/:groupId', requireAuth, async (req, res) => {
    try {
        const groupId = parseInt(req.params.groupId);
        const userId = req.userId;

        if (isNaN(groupId) || groupId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid group ID. Must be a positive number.'
            });
        }

        const { isUserMember } = await import('../models/GroupMember.js');
        const isMember = await isUserMember(userId, groupId);
        if (!isMember) {
            return res.status(403).json({
                success: false,
                message: 'You must be a member of this group to view tasks'
            });
        }

        const {
            completed,
            sortBy,
            sortOrder,
            assignedTo,
            unassigned,
            status,
            priority,
            search,
            dueFrom,
            dueTo,
            overdueOnly
        } = req.query;
        
        const options = {};
        
        if (completed === 'true') {
            options.completedOnly = true;
        } else if (completed === 'false') {
            options.pendingOnly = true;
        }

        if (status && ['todo', 'doing', 'done'].includes(status)) {
            options.status = status;
        }

        if (priority && ['low', 'medium', 'high', 'urgent'].includes(priority)) {
            options.priority = priority;
        }

        if (search) {
            options.search = search;
        }

        if (dueFrom) {
            options.dueFrom = dueFrom;
        }

        if (dueTo) {
            options.dueTo = dueTo;
        }

        if (overdueOnly === 'true') {
            options.overdueOnly = true;
        }

        if (unassigned === 'true') {
            options.unassignedOnly = true;
        } else if (assignedTo) {
            options.assignedTo = assignedTo;
        }
        
        if (sortBy) {
            options.sortBy = sortBy;
        }
        
        if (sortOrder) {
            options.sortOrder = sortOrder.toUpperCase();
        }

        const result = await getTasksByGroup(groupId, options);

        res.json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('Error fetching group tasks:', error);
        
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

router.patch('/:id/status', requireAuth, async (req, res) => {
    try {
        const taskId = parseInt(req.params.id, 10);
        const userId = req.userId;
        const { status } = req.body;

        if (isNaN(taskId) || taskId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid task ID. Must be a positive number.'
            });
        }

        const result = await updateTaskStatus(taskId, userId, status);

        emitTaskUpdated(result.task.group_id, result.task);
        emitTaskToggled(result.task.group_id, result.task);

        res.json({
            success: true,
            message: result.message,
            action: result.action,
            data: {
                task: result.task
            }
        });
    } catch (error) {
        console.error('Error updating task status:', error);

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

        emitTaskToggled(result.task.group_id, result.task);

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
