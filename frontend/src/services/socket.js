import { io } from 'socket.io-client';

let socket = null;
let connectionPromise = null;
const subscribers = {};

const getSubscriberSet = (event) => {
    if (!subscribers[event]) {
        subscribers[event] = new Set();
    }
    return subscribers[event];
};

const ensureSocketFanOut = (event) => {
    if (!socket || socket[`_fanOut_${event}`]) {
        return;
    }

    socket[`_fanOut_${event}`] = true;
    socket.on(event, (data) => {
        getSubscriberSet(event).forEach((callback) => {
            try {
                callback(data);
            } catch (error) {
                console.error(`Error in ${event} listener:`, error);
            }
        });
    });
};

const subscribe = (event, callback) => {
    if (!socket) {
        return () => {};
    }

    ensureSocketFanOut(event);
    getSubscriberSet(event).add(callback);

    return () => {
        getSubscriberSet(event).delete(callback);
    };
};

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

export const joinUser = (userId) => {
    if (socket && userId) {
        socket.emit('join-user', userId);
    }
};

export const leaveUser = (userId) => {
    if (socket && userId) {
        socket.emit('leave-user', userId);
    }
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

export const onTaskCreated = (callback) => subscribe('task-created', callback);
export const onTaskUpdated = (callback) => subscribe('task-updated', callback);
export const onTaskDeleted = (callback) => subscribe('task-deleted', callback);
export const onTaskToggled = (callback) => subscribe('task-toggled', callback);
export const onMemberJoined = (callback) => subscribe('member-joined', callback);
export const onMemberRemoved = (callback) => subscribe('member-removed', callback);
export const onGroupUpdated = (callback) => subscribe('group-updated', callback);
export const onMessageSent = (callback) => subscribe('message-sent', callback);
export const onChatCleared = (callback) => subscribe('chat-cleared', callback);
export const onNotificationReceived = (callback) => subscribe('notification-received', callback);
export const onJoinRequestUpdated = (callback) => subscribe('join-request-updated', callback);

export const removeAllListeners = () => {
    Object.values(subscribers).forEach((callbackSet) => {
        callbackSet.clear();
    });
};
