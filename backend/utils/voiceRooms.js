const voiceRooms = new Map();

const getRoom = (groupId) => {
    const roomKey = String(groupId);

    if (!voiceRooms.has(roomKey)) {
        voiceRooms.set(roomKey, new Map());
    }

    return voiceRooms.get(roomKey);
};

const formatParticipant = (participant) => ({
    user_id: participant.user_id,
    username: participant.username,
    profile_picture_url: participant.profile_picture_url || null,
    mic_enabled: participant.mic_enabled,
    camera_enabled: participant.camera_enabled
});

export const listVoiceParticipants = (groupId) => {
    const room = voiceRooms.get(String(groupId));
    if (!room) {
        return [];
    }

    return Array.from(room.values()).map(formatParticipant);
};

const broadcastVoiceRoster = (io, groupId) => {
    io.to(`group-${groupId}`).emit('voice-roster-updated', {
        groupId: Number(groupId),
        participants: listVoiceParticipants(groupId)
    });
};

const removeUserFromAllVoiceRooms = (io, socket) => {
    const trackedGroups = socket.data.voiceGroups || [];

    trackedGroups.forEach((groupId) => {
        const room = voiceRooms.get(String(groupId));
        if (!room) {
            return;
        }

        const userId = socket.data.userId;
        if (userId && room.has(userId)) {
            room.delete(userId);
            if (room.size === 0) {
                voiceRooms.delete(String(groupId));
            }

            io.to(`voice-${groupId}`).emit('voice-user-left', {
                groupId: Number(groupId),
                user_id: userId
            });
            broadcastVoiceRoster(io, groupId);
        }

        socket.leave(`voice-${groupId}`);
    });

    socket.data.voiceGroups = [];
};

export const registerVoiceHandlers = (io) => {
    io.on('connection', (socket) => {
        socket.on('join-voice', (payload = {}) => {
            const groupId = Number(payload.groupId);
            const userId = Number(payload.userId);

            if (!groupId || !userId) {
                return;
            }

            const room = getRoom(groupId);
            const participant = {
                user_id: userId,
                username: payload.username || 'Unknown',
                profile_picture_url: payload.profile_picture_url || null,
                mic_enabled: false,
                camera_enabled: false,
                socket_id: socket.id
            };

            room.set(userId, participant);
            socket.join(`voice-${groupId}`);

            if (!socket.data.voiceGroups) {
                socket.data.voiceGroups = [];
            }

            if (!socket.data.voiceGroups.includes(groupId)) {
                socket.data.voiceGroups.push(groupId);
            }

            socket.data.userId = userId;

            const existingParticipants = listVoiceParticipants(groupId).filter(
                (entry) => entry.user_id !== userId
            );

            socket.emit('voice-participants', {
                groupId,
                participants: existingParticipants
            });

            socket.to(`voice-${groupId}`).emit('voice-user-joined', {
                groupId,
                participant: formatParticipant(participant)
            });

            broadcastVoiceRoster(io, groupId);
        });

        socket.on('leave-voice', (payload = {}) => {
            const groupId = Number(payload.groupId);
            const userId = Number(payload.userId);

            if (!groupId || !userId) {
                return;
            }

            const room = voiceRooms.get(String(groupId));
            if (room?.has(userId)) {
                room.delete(userId);
                if (room.size === 0) {
                    voiceRooms.delete(String(groupId));
                }
            }

            socket.leave(`voice-${groupId}`);

            if (socket.data.voiceGroups) {
                socket.data.voiceGroups = socket.data.voiceGroups.filter((id) => id !== groupId);
            }

            io.to(`voice-${groupId}`).emit('voice-user-left', {
                groupId,
                user_id: userId
            });

            broadcastVoiceRoster(io, groupId);
        });

        socket.on('voice-state-update', (payload = {}) => {
            const groupId = Number(payload.groupId);
            const userId = Number(payload.userId);

            if (!groupId || !userId) {
                return;
            }

            const room = voiceRooms.get(String(groupId));
            const participant = room?.get(userId);

            if (!participant) {
                return;
            }

            participant.mic_enabled = !!payload.micEnabled;
            participant.camera_enabled = !!payload.cameraEnabled;

            io.to(`voice-${groupId}`).emit('voice-state-changed', {
                groupId,
                user_id: userId,
                mic_enabled: participant.mic_enabled,
                camera_enabled: participant.camera_enabled
            });

            broadcastVoiceRoster(io, groupId);
        });

        socket.on('voice-signal', (payload = {}) => {
            const groupId = Number(payload.groupId);
            const toUserId = Number(payload.toUserId);
            const fromUserId = Number(payload.fromUserId);

            if (!groupId || !toUserId || !fromUserId || !payload.signal) {
                return;
            }

            const room = voiceRooms.get(String(groupId));
            const target = room?.get(toUserId);

            if (!target?.socket_id) {
                return;
            }

            io.to(target.socket_id).emit('voice-signal', {
                groupId,
                fromUserId,
                signal: payload.signal
            });
        });

        socket.on('get-voice-roster', (payload = {}) => {
            const groupId = Number(payload.groupId);

            if (!groupId) {
                return;
            }

            socket.emit('voice-roster-updated', {
                groupId,
                participants: listVoiceParticipants(groupId)
            });
        });

        socket.on('disconnect', () => {
            removeUserFromAllVoiceRooms(io, socket);
        });
    });
};
