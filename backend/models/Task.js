import pool from '../config/database.js';

const TASK_SELECT_FIELDS = `
    t.id,
    t.group_id,
    t.title,
    t.description,
    t.is_completed,
    t.created_by,
    t.created_at,
    t.due_date,
    t.completed_at,
    t.completed_by,
    t.assigned_to,
    u_creator.username as creator_username,
    u_creator.email as creator_email,
    u_completer.username as completer_username,
    u_completer.email as completer_email,
    u_assignee.username as assignee_username,
    u_assignee.profile_picture_url as assignee_profile_picture_url
`;

const formatTaskFromRow = (task, extra = {}) => ({
    id: task.id,
    group_id: task.group_id,
    group_name: task.group_name ?? extra.group_name,
    title: task.title,
    description: task.description,
    is_completed: task.is_completed,
    created_by: task.created_by,
    created_at: task.created_at,
    due_date: task.due_date,
    completed_at: task.completed_at,
    completed_by: task.completed_by,
    assigned_to: task.assigned_to,
    creator_username: task.creator_username,
    assignee_username: task.assignee_username,
    completer_username: task.completer_username,
    creator: task.created_by ? {
        id: task.created_by,
        username: task.creator_username,
        email: task.creator_email
    } : null,
    completer: task.completed_by ? {
        id: task.completed_by,
        username: task.completer_username,
        email: task.completer_email
    } : null,
    assignee: task.assigned_to ? {
        id: task.assigned_to,
        username: task.assignee_username,
        profile_picture_url: task.assignee_profile_picture_url
    } : null,
    comment_count: task.comment_count !== undefined ? parseInt(task.comment_count, 10) : 0,
    attachment_count: task.attachment_count !== undefined ? parseInt(task.attachment_count, 10) : 0,
    drawing_count: task.drawing_count !== undefined ? parseInt(task.drawing_count, 10) : 0
});

export const validateTaskAssignee = async (groupId, assigneeId) => {
    if (assigneeId === null || assigneeId === undefined || assigneeId === '') {
        return null;
    }

    const parsedAssigneeId = parseInt(assigneeId, 10);
    if (isNaN(parsedAssigneeId) || parsedAssigneeId <= 0) {
        throw new Error('Invalid assignee. Must be a valid group member.');
    }

    const memberCheck = await pool.query(`
        SELECT 1
        FROM group_members
        WHERE group_id = $1 AND user_id = $2
        UNION
        SELECT 1
        FROM groups
        WHERE id = $1 AND owner_id = $2
    `, [groupId, parsedAssigneeId]);

    if (memberCheck.rows.length === 0) {
        throw new Error('Assignee must be a member of this group.');
    }

    return parsedAssigneeId;
};

export const validateTaskInput = (title, description, dueDate) => {
    const errors = [];
    
    // Validate title (required)
    if (!title) {
        errors.push('Title is required.');
    } else if (typeof title !== 'string') {
        errors.push('Title must be a string.');
    } else if (title.trim().length === 0) {
        errors.push('Title cannot be empty.');
    } else if (title.trim().length > 255) {
        errors.push('Title cannot exceed 255 characters.');
    }
    
    // Validate description (optional)
    if (description !== undefined && description !== null) {
        if (typeof description !== 'string') {
            errors.push('Description must be a string.');
        } else if (description.length > 5000) {
            errors.push('Description cannot exceed 5000 characters.');
        }
    }
    
    // Validate due date (optional)
    if (dueDate !== undefined && dueDate !== null) {
        let dateToValidate;
        
        // Handle string dates
        if (typeof dueDate === 'string') {
            if (dueDate.trim() === '') {
                // Empty string is valid (means no due date)
                dateToValidate = null;
            } else {
                dateToValidate = new Date(dueDate);
            }
        } else if (dueDate instanceof Date) {
            dateToValidate = dueDate;
        } else {
            errors.push('Due date must be a valid date string or Date object.');
        }
        
        // Validate the date is valid and not in the past
        if (dateToValidate && isNaN(dateToValidate.getTime())) {
            errors.push('Due date must be a valid date.');
        } else if (dateToValidate && dateToValidate < new Date()) {
            errors.push('Due date cannot be in the past.');
        }
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors,
        // Return cleaned data
        cleanedData: {
            title: (title && typeof title === 'string') ? title.trim() : null,
            description: (description && typeof description === 'string') ? description.trim() : null,
            dueDate: dueDate && dueDate !== '' ? (typeof dueDate === 'string' ? new Date(dueDate) : dueDate) : null
        }
    };
};

export const createTask = async (groupId, createdBy, title, description, dueDate, assignedTo = null) => {
    try {
        // Validate required parameters
        if (!groupId || isNaN(groupId) || groupId <= 0) {
            throw new Error('Invalid group ID. Must be a positive number.');
        }
        
        if (!createdBy || isNaN(createdBy) || createdBy <= 0) {
            throw new Error('Invalid user ID. Must be a positive number.');
        }
        
        // Validate task input data
        const validation = validateTaskInput(title, description, dueDate);
        if (!validation.isValid) {
            throw new Error(validation.errors.join(' '));
        }
        
        const { title: cleanTitle, description: cleanDescription, dueDate: cleanDueDate } = validation.cleanedData;
        
        // Check if group exists
        const groupCheck = await pool.query('SELECT id FROM groups WHERE id = $1', [groupId]);
        if (groupCheck.rows.length === 0) {
            throw new Error(`Group with ID ${groupId} not found.`);
        }
        
        // Check if user is a member of the group (or owner)
        const memberCheck = await pool.query(`
            SELECT gm.user_id, g.owner_id 
            FROM groups g
            LEFT JOIN group_members gm ON g.id = gm.group_id AND gm.user_id = $1
            WHERE g.id = $2
        `, [createdBy, groupId]);
        
        if (memberCheck.rows.length === 0) {
            throw new Error('Group not found.');
        }
        
        const { user_id: memberUserId, owner_id: groupOwnerId } = memberCheck.rows[0];
        
        // User must be either a member or the group owner
        if (!memberUserId && createdBy !== groupOwnerId) {
            throw new Error('You must be a member of this group to create tasks.');
        }

        const validatedAssignee = await validateTaskAssignee(groupId, assignedTo);
        
        // Insert the new task
        const insertQuery = `
            INSERT INTO tasks (group_id, title, description, created_by, due_date, assigned_to)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
        `;
        
        const result = await pool.query(insertQuery, [
            groupId,
            cleanTitle,
            cleanDescription,
            createdBy,
            cleanDueDate,
            validatedAssignee
        ]);
        
        return findTaskById(result.rows[0].id);
        
    } catch (error) {
        console.error('Error creating task:', error);
        throw error;
    }
};

export const findTaskById = async (taskId) => {
    try {
        // Validate task ID
        if (!taskId || isNaN(taskId) || taskId <= 0) {
            throw new Error('Invalid task ID. Must be a positive number.');
        }
        
        // Query to get task with creator and completer details
        const query = `
            SELECT 
                ${TASK_SELECT_FIELDS},
                g.name as group_name
            FROM tasks t
            LEFT JOIN users u_creator ON t.created_by = u_creator.id
            LEFT JOIN users u_completer ON t.completed_by = u_completer.id
            LEFT JOIN users u_assignee ON t.assigned_to = u_assignee.id
            LEFT JOIN groups g ON t.group_id = g.id
            WHERE t.id = $1
        `;
        
        const result = await pool.query(query, [taskId]);
        
        if (result.rows.length === 0) {
            return null;
        }
        
        return formatTaskFromRow(result.rows[0]);
        
    } catch (error) {
        console.error('Error finding task by ID:', error);
        throw error;
    }
};

export const getTasksByGroup = async (groupId, options = {}) => {
    try {
        // Validate group ID
        if (!groupId || isNaN(groupId) || groupId <= 0) {
            throw new Error('Invalid group ID. Must be a positive number.');
        }
        
        // Check if group exists
        const groupCheck = await pool.query('SELECT id, name FROM groups WHERE id = $1', [groupId]);
        if (groupCheck.rows.length === 0) {
            throw new Error(`Group with ID ${groupId} not found.`);
        }
        
        const groupInfo = groupCheck.rows[0];
        
        // Extract options with defaults
        const {
            completedOnly = false,
            pendingOnly = false,
            assignedTo = null,
            unassignedOnly = false,
            sortBy = 'created_at',
            sortOrder = 'DESC'
        } = options;
        
        // Validate sort options
        const validSortFields = ['created_at', 'due_date', 'title', 'is_completed'];
        const validSortOrders = ['ASC', 'DESC'];
        
        if (!validSortFields.includes(sortBy)) {
            throw new Error(`Invalid sort field. Must be one of: ${validSortFields.join(', ')}`);
        }
        
        if (!validSortOrders.includes(sortOrder.toUpperCase())) {
            throw new Error('Invalid sort order. Must be ASC or DESC.');
        }
        
        // Build WHERE clause based on completion filter
        let whereClause = 'WHERE t.group_id = $1';
        if (completedOnly && !pendingOnly) {
            whereClause += ' AND t.is_completed = true';
        } else if (pendingOnly && !completedOnly) {
            whereClause += ' AND t.is_completed = false';
        } else if (pendingOnly && !completedOnly) {
            whereClause += ' AND t.is_completed = false';
        }

        const queryValues = [groupId];
        if (unassignedOnly) {
            whereClause += ' AND t.assigned_to IS NULL';
        } else if (assignedTo !== null && assignedTo !== undefined) {
            const parsedAssignedTo = parseInt(assignedTo, 10);
            if (isNaN(parsedAssignedTo) || parsedAssignedTo <= 0) {
                throw new Error('Invalid assignee filter.');
            }
            queryValues.push(parsedAssignedTo);
            whereClause += ` AND t.assigned_to = $${queryValues.length}`;
        }
        
        const orderClause = `ORDER BY t.${sortBy} ${sortOrder.toUpperCase()}`;
        
        const query = `
            SELECT 
                ${TASK_SELECT_FIELDS},
                (SELECT COUNT(*)::int FROM task_comments tc WHERE tc.task_id = t.id) AS comment_count,
                (SELECT COUNT(*)::int FROM task_attachments ta WHERE ta.task_id = t.id) AS attachment_count,
                (SELECT COUNT(*)::int FROM task_drawings td WHERE td.task_id = t.id) AS drawing_count
            FROM tasks t
            LEFT JOIN users u_creator ON t.created_by = u_creator.id
            LEFT JOIN users u_completer ON t.completed_by = u_completer.id
            LEFT JOIN users u_assignee ON t.assigned_to = u_assignee.id
            ${whereClause}
            ${orderClause}
        `;
        
        const result = await pool.query(query, queryValues);
        
        const tasks = result.rows.map((task) => formatTaskFromRow(task, { group_name: groupInfo.name }));
        
        // Calculate task statistics
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(task => task.is_completed).length;
        const pendingTasks = totalTasks - completedTasks;
        const overdueTasks = tasks.filter(task => 
            !task.is_completed && 
            task.due_date && 
            new Date(task.due_date) < new Date()
        ).length;
        
        return {
            group_id: groupId,
            group_name: groupInfo.name,
            summary: {
                total_tasks: totalTasks,
                completed_tasks: completedTasks,
                pending_tasks: pendingTasks,
                overdue_tasks: overdueTasks
            },
            tasks: tasks
        };
        
    } catch (error) {
        console.error('Error getting tasks by group:', error);
        throw error;
    }
};

export const updateTask = async (taskId, userId, updateData) => {
    try {
        // Validate task ID
        if (!taskId || isNaN(taskId) || taskId <= 0) {
            throw new Error('Invalid task ID. Must be a positive number.');
        }
        
        // Validate user ID
        if (!userId || isNaN(userId) || userId <= 0) {
            throw new Error('Invalid user ID. Must be a positive number.');
        }
        
        // Validate update data
        if (!updateData || typeof updateData !== 'object') {
            throw new Error('Update data is required and must be an object.');
        }
        
        const { title, description, due_date, assigned_to } = updateData;
        
        const hasContentUpdate = title !== undefined || description !== undefined || due_date !== undefined;
        const hasAssigneeUpdate = assigned_to !== undefined;

        if (!hasContentUpdate && !hasAssigneeUpdate) {
            throw new Error('At least one field must be provided for update.');
        }
        
        // Get the existing task with group info
        const taskQuery = `
            SELECT 
                t.*, 
                g.owner_id as group_owner_id,
                g.name as group_name
            FROM tasks t
            JOIN groups g ON t.group_id = g.id
            WHERE t.id = $1
        `;
        const taskResult = await pool.query(taskQuery, [taskId]);
        
        if (taskResult.rows.length === 0) {
            throw new Error(`Task with ID ${taskId} not found.`);
        }
        
        const existingTask = taskResult.rows[0];
        
        // Check if user is a member of the group
        const membershipQuery = `
            SELECT user_id FROM group_members 
            WHERE group_id = $1 AND user_id = $2
        `;
        const membershipResult = await pool.query(membershipQuery, [existingTask.group_id, userId]);
        
        if (membershipResult.rows.length === 0 && existingTask.group_owner_id !== userId) {
            throw new Error('You must be a member of the group to update tasks.');
        }
        
        const isTaskCreator = existingTask.created_by === userId;
        const isGroupOwner = existingTask.group_owner_id === userId;
        
        if (hasContentUpdate && !isTaskCreator && !isGroupOwner) {
            throw new Error('You can only update tasks you created or if you are the group owner.');
        }
        
        // Validate the update data (different from create - fields are optional)
        const errors = [];
        
        // Validate title (only if provided)
        if (title !== undefined) {
            if (title === null) {
                errors.push('Title cannot be null.');
            } else if (typeof title !== 'string') {
                errors.push('Title must be a string.');
            } else if (title.trim().length === 0) {
                errors.push('Title cannot be empty.');
            } else if (title.trim().length > 255) {
                errors.push('Title cannot exceed 255 characters.');
            }
        }
        
        // Validate description (only if provided)
        if (description !== undefined) {
            if (description !== null && typeof description !== 'string') {
                errors.push('Description must be a string.');
            } else if (description && description.length > 5000) {
                errors.push('Description cannot exceed 5000 characters.');
            }
        }
        
        // Validate due date (only if provided)
        if (due_date !== undefined) {
            if (due_date !== null) {
                let dateToValidate;
                
                if (typeof due_date === 'string') {
                    if (due_date.trim() === '') {
                        dateToValidate = null;
                    } else {
                        dateToValidate = new Date(due_date);
                    }
                } else if (due_date instanceof Date) {
                    dateToValidate = due_date;
                } else {
                    errors.push('Due date must be a valid date string or Date object.');
                }
                
                if (dateToValidate && isNaN(dateToValidate.getTime())) {
                    errors.push('Due date must be a valid date.');
                }
            }
        }

        let validatedAssignee;
        if (hasAssigneeUpdate) {
            validatedAssignee = await validateTaskAssignee(existingTask.group_id, assigned_to);
        }
        
        if (errors.length > 0) {
            throw new Error(errors.join(' '));
        }
        
        // Clean the data
        const cleanedData = {};
        if (title !== undefined) {
            cleanedData.title = title ? title.trim() : null;
        }
        if (description !== undefined) {
            cleanedData.description = description ? description.trim() : null;
        }
        if (due_date !== undefined) {
            if (due_date === null || due_date === '') {
                cleanedData.dueDate = null;
            } else {
                cleanedData.dueDate = typeof due_date === 'string' ? new Date(due_date) : due_date;
            }
        }
        
        // Build the update query dynamically
        const fieldsToUpdate = [];
        const queryValues = [];
        let paramCounter = 1;
        
        if (title !== undefined) {
            fieldsToUpdate.push(`title = $${paramCounter}`);
            queryValues.push(cleanedData.title);
            paramCounter++;
        }
        
        if (description !== undefined) {
            fieldsToUpdate.push(`description = $${paramCounter}`);
            queryValues.push(cleanedData.description);
            paramCounter++;
        }
        
        if (due_date !== undefined) {
            fieldsToUpdate.push(`due_date = $${paramCounter}`);
            queryValues.push(cleanedData.dueDate);
            paramCounter++;
        }

        if (hasAssigneeUpdate) {
            fieldsToUpdate.push(`assigned_to = $${paramCounter}`);
            queryValues.push(validatedAssignee);
            paramCounter++;
        }
        
        queryValues.push(taskId);
        
        const updateQuery = `
            UPDATE tasks 
            SET ${fieldsToUpdate.join(', ')}
            WHERE id = $${paramCounter}
            RETURNING id
        `;
        
        await pool.query(updateQuery, queryValues);
        
        return findTaskById(taskId);
        
    } catch (error) {
        console.error('Error updating task:', error);
        throw error;
    }
};

export const deleteTask = async (taskId, userId) => {
    try {
        // Validate task ID
        if (!taskId || isNaN(taskId) || taskId <= 0) {
            throw new Error('Invalid task ID. Must be a positive number.');
        }
        
        // Validate user ID
        if (!userId || isNaN(userId) || userId <= 0) {
            throw new Error('Invalid user ID. Must be a positive number.');
        }
        
        // Get the task with group info to check permissions
        const taskQuery = `
            SELECT 
                t.*, 
                g.owner_id as group_owner_id,
                g.name as group_name,
                u_creator.username as creator_username
            FROM tasks t
            JOIN groups g ON t.group_id = g.id
            LEFT JOIN users u_creator ON t.created_by = u_creator.id
            WHERE t.id = $1
        `;
        const taskResult = await pool.query(taskQuery, [taskId]);
        
        if (taskResult.rows.length === 0) {
            throw new Error(`Task with ID ${taskId} not found.`);
        }
        
        const task = taskResult.rows[0];
        
        // Check if user is a member of the group
        const membershipQuery = `
            SELECT user_id FROM group_members 
            WHERE group_id = $1 AND user_id = $2
        `;
        const membershipResult = await pool.query(membershipQuery, [task.group_id, userId]);
        
        if (membershipResult.rows.length === 0) {
            throw new Error('You must be a member of the group to delete tasks.');
        }
        
        // Check permissions: must be task creator OR group owner
        const isTaskCreator = task.created_by === userId;
        const isGroupOwner = task.group_owner_id === userId;
        
        if (!isTaskCreator && !isGroupOwner) {
            throw new Error('You can only delete tasks you created or if you are the group owner.');
        }
        
        // Store task info for return (before deletion)
        const taskInfo = {
            id: task.id,
            title: task.title,
            description: task.description,
            group_id: task.group_id,
            group_name: task.group_name,
            created_by: task.created_by,
            creator_username: task.creator_username,
            created_at: task.created_at,
            due_date: task.due_date,
            is_completed: task.is_completed,
            completed_at: task.completed_at,
            completed_by: task.completed_by
        };

        const { deleteAttachmentsForTask } = await import('./TaskAttachment.js');
        await deleteAttachmentsForTask(taskId);

        const { deleteDrawingsForTask } = await import('./TaskDrawing.js');
        await deleteDrawingsForTask(taskId);
        
        // Delete the task
        const deleteQuery = 'DELETE FROM tasks WHERE id = $1';
        await pool.query(deleteQuery, [taskId]);
        
        return {
            success: true,
            message: 'Task deleted successfully',
            deleted_task: taskInfo
        };
        
    } catch (error) {
        console.error('Error deleting task:', error);
        throw error;
    }
};

export const toggleTaskCompletion = async (taskId, userId) => {
    try {
        // Validate task ID
        if (!taskId || isNaN(taskId) || taskId <= 0) {
            throw new Error('Invalid task ID. Must be a positive number.');
        }
        
        // Validate user ID
        if (!userId || isNaN(userId) || userId <= 0) {
            throw new Error('Invalid user ID. Must be a positive number.');
        }
        
        // Get the task with group info
        const taskQuery = `
            SELECT 
                t.*,
                g.name as group_name
            FROM tasks t
            JOIN groups g ON t.group_id = g.id
            WHERE t.id = $1
        `;
        const taskResult = await pool.query(taskQuery, [taskId]);
        
        if (taskResult.rows.length === 0) {
            throw new Error(`Task with ID ${taskId} not found.`);
        }
        
        const task = taskResult.rows[0];
        
        // Check if user is a member of the group (any member can toggle completion)
        const membershipQuery = `
            SELECT user_id FROM group_members 
            WHERE group_id = $1 AND user_id = $2
        `;
        const membershipResult = await pool.query(membershipQuery, [task.group_id, userId]);
        
        if (membershipResult.rows.length === 0) {
            throw new Error('You must be a member of the group to toggle task completion.');
        }
        
        // Determine new completion status
        const newCompletionStatus = !task.is_completed;
        const currentTime = new Date();
        
        // Prepare update values based on completion status
        let updateQuery;
        let queryValues;
        
        if (newCompletionStatus) {
            // Marking as completed
            updateQuery = `
                UPDATE tasks 
                SET is_completed = true, completed_at = $1, completed_by = $2
                WHERE id = $3
                RETURNING id, group_id, title, description, is_completed, created_by, created_at, due_date, completed_at, completed_by
            `;
            queryValues = [currentTime, userId, taskId];
        } else {
            // Marking as incomplete
            updateQuery = `
                UPDATE tasks 
                SET is_completed = false, completed_at = NULL, completed_by = NULL
                WHERE id = $1
                RETURNING id, group_id, title, description, is_completed, created_by, created_at, due_date, completed_at, completed_by
            `;
            queryValues = [taskId];
        }
        
        // Execute the update
        const updateResult = await pool.query(updateQuery, queryValues);
        const updatedTask = updateResult.rows[0];
        
        // Get the full task details with user information
        const fullTaskResult = await findTaskById(taskId);
        
        return {
            success: true,
            message: newCompletionStatus ? 'Task marked as completed' : 'Task marked as incomplete',
            action: newCompletionStatus ? 'completed' : 'reopened',
            task: fullTaskResult
        };
        
    } catch (error) {
        console.error('Error toggling task completion:', error);
        throw error;
    }
};




