import { io } from 'socket.io-client';

let socket = null;
let connectionPromise = null;

export const connectSocket = () => {
    if (socket && socket.connected) {
        return Promise.resolve(socket);
    }

    if (connectionPromise) {
        return connectionPromise;
    }

    connectionPromise = new Promise((resolve) => {
        console.log('Connecting to socket...');

        socket = io({
            transports: ['polling', 'websocket'],
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
            timeout: 20000,
            path: '/socket.io'
        });

        socket.on('connect', () => {
            console.log('Socket connected:', socket.id);
            resolve(socket);
        });

        socket.on('disconnect', (reason) => {
            console.log('Socket disconnected:', reason);
        });

        socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error.message);
        });

        socket.on('reconnect', (attemptNumber) => {
            console.log('Socket reconnected after', attemptNumber, 'attempts');
        });

        setTimeout(() => {
            if (!socket.connected) {
                console.log('Socket connection timeout, resolving anyway');
                resolve(socket);
            }
        }, 5000);
    });

    return connectionPromise;
};

export const disconnectSocket = () => {
    if (socket) {
        socket.disconnect();
        socket = null;
        connectionPromise = null;
    }
};

export const getSocket = () => {
    return socket;
};

export const joinGroup = (groupId) => {
    if (socket) {
        socket.emit('join-group', groupId);
        console.log('Joining group:', groupId);
    }
};

export const leaveGroup = (groupId) => {
    if (socket) {
        socket.emit('leave-group', groupId);
    }
};

export const onTaskCreated = (callback) => {
    if (socket) {
        socket.off('task-created');
        socket.on('task-created', callback);
    }
};

export const onTaskUpdated = (callback) => {
    if (socket) {
        socket.off('task-updated');
        socket.on('task-updated', callback);
    }
};

export const onTaskDeleted = (callback) => {
    if (socket) {
        socket.off('task-deleted');
        socket.on('task-deleted', callback);
    }
};

export const onTaskToggled = (callback) => {
    if (socket) {
        socket.off('task-toggled');
        socket.on('task-toggled', callback);
    }
};

export const onMemberJoined = (callback) => {
    if (socket) {
        socket.off('member-joined');
        socket.on('member-joined', callback);
    }
};

export const onMemberRemoved = (callback) => {
    if (socket) {
        socket.off('member-removed');
        socket.on('member-removed', callback);
    }
};

export const onGroupUpdated = (callback) => {
    if (socket) {
        socket.off('group-updated');
        socket.on('group-updated', callback);
    }
};

export const onMessageSent = (callback) => {
    if (socket) {
        socket.off('message-sent');
        socket.on('message-sent', callback);
    }
};

export const onChatCleared = (callback) => {
    if (socket) {
        socket.off('chat-cleared');
        socket.on('chat-cleared', callback);
    }
};

export const removeAllListeners = () => {
    if (socket) {
        socket.off('task-created');
        socket.off('task-updated');
        socket.off('task-deleted');
        socket.off('task-toggled');
        socket.off('member-joined');
        socket.off('member-removed');
        socket.off('group-updated');
        socket.off('message-sent');
        socket.off('chat-cleared');
    }
};
