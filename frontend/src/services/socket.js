import { io } from 'socket.io-client';
import { getSocketUrl } from '../utils/backendUrl';

let socket = null;
let connectionPromise = null;
const subscribers = {};

const sessionState = {
    userId: null,
    groupIds: new Set(),
    reconnectHandlers: new Set()
};

const SOCKET_EVENTS = [
    'task-created',
    'task-updated',
    'task-deleted',
    'task-toggled',
    'member-joined',
    'member-removed',
    'group-updated',
    'message-sent',
    'chat-cleared',
    'chat-typing',
    'notification-received',
    'join-request-updated',
    'task-comment-created',
    'task-attachment-added',
    'task-attachment-deleted',
    'task-drawing-added',
    'task-drawing-deleted',
    'voice-roster-updated'
];

const getSubscriberSet = (event) => {
    if (!subscribers[event]) {
        subscribers[event] = new Set();
    }
    return subscribers[event];
};

const attachFanOutListeners = () => {
    if (!socket) {
        return;
    }

    SOCKET_EVENTS.forEach((event) => {
        if (socket[`_fanOut_${event}`]) {
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
    });
};

const rejoinAllRooms = () => {
    if (!socket?.connected) {
        return;
    }

    if (sessionState.userId) {
        socket.emit('join-user', sessionState.userId);
    }

    sessionState.groupIds.forEach((groupId) => {
        socket.emit('join-group', groupId);
    });

    sessionState.reconnectHandlers.forEach((handler) => {
        try {
            handler();
        } catch (error) {
            console.error('Socket reconnect handler error:', error);
        }
    });
};

const subscribe = (event, callback) => {
    getSubscriberSet(event).add(callback);

    if (socket) {
        attachFanOutListeners();
    }

    return () => {
        getSubscriberSet(event).delete(callback);
    };
};

export const onSocketReconnect = (handler) => {
    sessionState.reconnectHandlers.add(handler);
    return () => {
        sessionState.reconnectHandlers.delete(handler);
    };
};

export const waitForSocketConnection = async (timeoutMs = 20000) => {
    await connectSocket();

    if (socket?.connected) {
        return socket;
    }

    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            socket?.off('connect', onConnect);
            reject(new Error('Unable to connect to real-time server. Check your connection and try again.'));
        }, timeoutMs);

        const onConnect = () => {
            clearTimeout(timer);
            socket?.off('connect', onConnect);
            resolve(socket);
        };

        socket?.once('connect', onConnect);
    });
};

export const connectSocket = () => {
    if (socket?.connected) {
        return Promise.resolve(socket);
    }

    if (connectionPromise) {
        return connectionPromise;
    }

    if (socket && !socket.connected) {
        connectionPromise = new Promise((resolve, reject) => {
            const connectTimeoutMs = 20000;
            const timer = setTimeout(() => {
                socket?.off('connect', onConnect);
                connectionPromise = null;
                reject(new Error('Unable to connect to real-time server.'));
            }, connectTimeoutMs);

            const onConnect = () => {
                clearTimeout(timer);
                socket?.off('connect', onConnect);
                rejoinAllRooms();
                resolve(socket);
            };

            socket.once('connect', onConnect);
        });

        return connectionPromise;
    }

    connectionPromise = new Promise((resolve, reject) => {
        const socketUrl = getSocketUrl();
        console.log('Connecting to socket...', socketUrl || '(same origin)');

        const socketOptions = {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 20000,
            path: '/socket.io',
            withCredentials: true
        };

        socket = socketUrl ? io(socketUrl, socketOptions) : io(socketOptions);
        attachFanOutListeners();

        let connectTimeoutId;

        const finishConnect = () => {
            clearTimeout(connectTimeoutId);
            rejoinAllRooms();
            resolve(socket);
        };

        socket.on('connect', () => {
            console.log('Socket connected:', socket.id);
            finishConnect();
        });

        socket.io.on('reconnect', (attemptNumber) => {
            console.log('Socket reconnected after', attemptNumber, 'attempts');
            rejoinAllRooms();
        });

        socket.on('disconnect', (reason) => {
            console.log('Socket disconnected:', reason);
        });

        socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error.message);
        });

        const connectTimeoutMs = 20000;
        connectTimeoutId = setTimeout(() => {
            if (!socket.connected) {
                connectionPromise = null;
                reject(new Error('Unable to connect to real-time server.'));
            }
        }, connectTimeoutMs);
    }).catch((error) => {
        connectionPromise = null;
        throw error;
    });

    return connectionPromise;
};

export const disconnectSocket = () => {
    if (socket) {
        socket.disconnect();
        socket = null;
        connectionPromise = null;
        sessionState.userId = null;
        sessionState.groupIds.clear();
        sessionState.reconnectHandlers.clear();
    }
};

export const getSocket = () => socket;

export const isSocketConnected = () => Boolean(socket?.connected);

export const joinUser = (userId) => {
    const id = Number(userId);
    if (!id) {
        return;
    }

    sessionState.userId = id;

    if (socket?.connected) {
        socket.emit('join-user', id);
    }
};

export const leaveUser = (userId) => {
    const id = Number(userId);
    if (sessionState.userId === id) {
        sessionState.userId = null;
    }

    if (socket && id) {
        socket.emit('leave-user', id);
    }
};

export const joinGroup = (groupId) => {
    const id = Number(groupId);
    if (!id) {
        return;
    }

    sessionState.groupIds.add(id);

    if (socket?.connected) {
        socket.emit('join-group', id);
        console.log('Joining group:', id);
    }
};

export const leaveGroup = (groupId) => {
    const id = Number(groupId);
    if (!id) {
        return;
    }

    sessionState.groupIds.delete(id);

    if (socket) {
        socket.emit('leave-group', id);
    }
};

export const emitChatTyping = (groupId, userId, username, isTyping) => {
    if (socket?.connected && groupId && userId && username) {
        socket.emit('chat-typing', {
            groupId,
            userId,
            username,
            isTyping: Boolean(isTyping)
        });
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
export const onChatTyping = (callback) => subscribe('chat-typing', callback);
export const onNotificationReceived = (callback) => subscribe('notification-received', callback);
export const onJoinRequestUpdated = (callback) => subscribe('join-request-updated', callback);
export const onTaskCommentCreated = (callback) => subscribe('task-comment-created', callback);
export const onTaskAttachmentAdded = (callback) => subscribe('task-attachment-added', callback);
export const onTaskAttachmentDeleted = (callback) => subscribe('task-attachment-deleted', callback);
export const onTaskDrawingAdded = (callback) => subscribe('task-drawing-added', callback);
export const onTaskDrawingDeleted = (callback) => subscribe('task-drawing-deleted', callback);
export const onVoiceRosterUpdated = (callback) => subscribe('voice-roster-updated', callback);

export const removeAllListeners = () => {
    Object.values(subscribers).forEach((callbackSet) => {
        callbackSet.clear();
    });
};
