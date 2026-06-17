let io = null;

export const setSocketIO = (socketIO) => {
    io = socketIO;
};

export const getSocketIO = () => {
    return io;
};

export const emitToGroup = (groupId, event, data) => {
    if (io) {
        console.log(`Emitting ${event} to group-${groupId}:`, data);
        io.to(`group-${groupId}`).emit(event, data);
    } else {
        console.log('Socket.IO not initialized');
    }
};

export const emitTaskCreated = (groupId, task) => {
    emitToGroup(groupId, 'task-created', { task });
};

export const emitTaskUpdated = (groupId, task) => {
    emitToGroup(groupId, 'task-updated', { task });
};

export const emitTaskDeleted = (groupId, taskId) => {
    emitToGroup(groupId, 'task-deleted', { taskId });
};

export const emitTaskToggled = (groupId, task) => {
    emitToGroup(groupId, 'task-toggled', { task });
};

export const emitMemberRemoved = (groupId, userId) => {
    emitToGroup(groupId, 'member-removed', { userId });
};

export const emitMemberJoined = (groupId, member) => {
    emitToGroup(groupId, 'member-joined', { member });
};

export const emitGroupUpdated = (groupId) => {
    emitToGroup(groupId, 'group-updated', { groupId });
};

export const emitMessageSent = (groupId, message) => {
    emitToGroup(groupId, 'message-sent', { message });
};

export const emitChatCleared = (groupId) => {
    emitToGroup(groupId, 'chat-cleared', { groupId });
};

export const emitToUser = (userId, event, data) => {
    if (io) {
        io.to(`user-${userId}`).emit(event, data);
    }
};

export const emitNotification = (userId, notification) => {
    emitToUser(userId, 'notification-received', { notification });
};

export const emitJoinRequestUpdated = (groupId, request, action) => {
    emitToGroup(groupId, 'join-request-updated', { request, action });
};

export const emitTaskCommentCreated = (groupId, taskId, comment) => {
    emitToGroup(groupId, 'task-comment-created', { taskId, comment });
};

