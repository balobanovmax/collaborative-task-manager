import { getSocket, waitForSocketConnection, onSocketReconnect } from './socket';
import { webrtcAPI } from './api';

const DEFAULT_ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
];

const DEFAULT_RTC_CONFIG = {
    iceServers: DEFAULT_ICE_SERVERS,
    iceTransportPolicy: 'all',
    bundlePolicy: 'max-bundle'
};

const getMediaErrorMessage = (error) => {
    if (!error) {
        return 'Failed to access microphone.';
    }

    const name = error.name || '';

    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        return 'Microphone access was denied. Allow mic permission in your browser settings and try again.';
    }

    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        return 'No microphone was found on this device.';
    }

    if (name === 'NotReadableError' || name === 'TrackStartError') {
        return 'Your microphone is in use by another app. Close it and try again.';
    }

    if (name === 'SecurityError') {
        return 'Microphone access requires a secure HTTPS connection.';
    }

    return error.message || 'Failed to access microphone.';
};

const fetchRtcConfig = async () => {
    try {
        const data = await webrtcAPI.getIceServers();
        if (!data?.iceServers?.length) {
            return DEFAULT_RTC_CONFIG;
        }

        return {
            iceServers: data.iceServers,
            iceTransportPolicy: data.iceTransportPolicy || 'all',
            bundlePolicy: 'max-bundle'
        };
    } catch (error) {
        console.warn('Failed to fetch ICE servers, using STUN defaults:', error.message);
        return DEFAULT_RTC_CONFIG;
    }
};

const AUDIO_NEGOTIATION_OPTIONS = { voiceActivityDetection: false };

const getOpusPayloadTypes = (sdp) => {
    const types = [];
    sdp.split(/\r?\n/).forEach((line) => {
        const match = line.match(/^a=rtpmap:(\d+) opus\/48000/i);
        if (match) {
            types.push(match[1]);
        }
    });
    return types;
};

const optimizeAudioSdp = (sdp) => {
    const opusTypes = getOpusPayloadTypes(sdp);

    return sdp.split(/\r?\n/).map((line) => {
        const fmtpMatch = line.match(/^a=fmtp:(\d+) (.+)$/);
        if (!fmtpMatch || !opusTypes.includes(fmtpMatch[1])) {
            return line;
        }

        let params = fmtpMatch[2];

        if (params.includes('usedtx=1')) {
            params = params.replace('usedtx=1', 'usedtx=0');
        } else if (!params.includes('usedtx=')) {
            params += ';usedtx=0';
        }

        if (!params.includes('maxaveragebitrate=')) {
            params += ';maxaveragebitrate=128000';
        }

        if (!params.includes('minptime=')) {
            params += ';minptime=10';
        }

        return `a=fmtp:${fmtpMatch[1]} ${params}`;
    }).join('\r\n');
};

const setOptimizedLocalDescription = async (pc, description) => {
    const optimized = {
        type: description.type,
        sdp: optimizeAudioSdp(description.sdp)
    };
    await pc.setLocalDescription(optimized);
    return optimized;
};

const acquireLocalAudio = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Your browser does not support microphone access.');
    }

    try {
        return await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                channelCount: 1
            },
            video: false
        });
    } catch (error) {
        throw new Error(getMediaErrorMessage(error));
    }
};

const acquireLocalVideoTrack = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Your browser does not support camera access.');
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                width: { ideal: 640, max: 1280 },
                height: { ideal: 480, max: 720 },
                frameRate: { ideal: 24, max: 30 },
                facingMode: 'user'
            }
        });
        return stream.getVideoTracks()[0] || null;
    } catch (error) {
        throw new Error(getMediaErrorMessage(error));
    }
};

export const createVoiceChatSession = ({
    groupId,
    user,
    onRemoteStream,
    onRemoteStreamRemoved,
    onError
}) => {
    const peers = new Map();
    const remoteStreams = new Map();
    const pendingIceCandidates = new Map();
    let localStream = null;
    let socket = null;
    let joined = false;
    let micEnabled = false;
    let cameraEnabled = false;
    let handlers = null;
    let reconnectUnsubscribe = null;
    let rtcConfig = DEFAULT_RTC_CONFIG;

    const isPolitePeer = (remoteUserId) => Number(user.id) > Number(remoteUserId);

    const cleanupPeer = (remoteUserId) => {
        const peer = peers.get(remoteUserId);
        if (peer) {
            peer.close();
            peers.delete(remoteUserId);
        }
        pendingIceCandidates.delete(remoteUserId);
        remoteStreams.delete(remoteUserId);
        onRemoteStreamRemoved?.(remoteUserId);
    };

    const cleanupAllPeers = () => {
        peers.forEach((peer) => peer.close());
        peers.clear();
        pendingIceCandidates.clear();
        remoteStreams.forEach((_, remoteUserId) => {
            onRemoteStreamRemoved?.(remoteUserId);
        });
        remoteStreams.clear();
    };

    const sendSignal = (toUserId, signal) => {
        if (!socket?.connected) {
            return;
        }

        socket.emit('voice-signal', {
            groupId: Number(groupId),
            toUserId: Number(toUserId),
            fromUserId: Number(user.id),
            signal
        });
    };

    const flushPendingIceCandidates = async (remoteUserId, pc) => {
        const queue = pendingIceCandidates.get(remoteUserId) || [];
        pendingIceCandidates.delete(remoteUserId);

        for (const candidate of queue) {
            try {
                await pc.addIceCandidate(candidate);
            } catch (error) {
                console.error('ICE candidate flush error:', error);
            }
        }
    };

    const queueIceCandidate = (remoteUserId, candidate) => {
        if (!pendingIceCandidates.has(remoteUserId)) {
            pendingIceCandidates.set(remoteUserId, []);
        }
        pendingIceCandidates.get(remoteUserId).push(candidate);
    };

    const tuneAudioSender = async (pc) => {
        try {
            const sender = pc.getSenders().find((entry) => entry.track?.kind === 'audio');
            if (!sender) {
                return;
            }

            const params = sender.getParameters();
            if (!params.encodings?.length) {
                params.encodings = [{ maxBitrate: 128000 }];
            } else {
                params.encodings[0].maxBitrate = 128000;
            }
            await sender.setParameters(params);
        } catch {
            // Browser may reject parameter updates; safe to ignore.
        }
    };

    const tuneVideoSender = async (pc) => {
        try {
            const sender = pc.getSenders().find((entry) => entry.track?.kind === 'video');
            if (!sender) {
                return;
            }

            const params = sender.getParameters();
            if (!params.encodings?.length) {
                params.encodings = [{ maxBitrate: 500000, maxFramerate: 24 }];
            } else {
                params.encodings[0].maxBitrate = 500000;
                params.encodings[0].maxFramerate = 24;
            }
            await sender.setParameters(params);
        } catch {
            // Browser may reject parameter updates; safe to ignore.
        }
    };

    const tunePeerSenders = async (pc) => {
        await tuneAudioSender(pc);
        await tuneVideoSender(pc);
    };

    const updateRemoteStream = (remoteUserId, track) => {
        let stream = remoteStreams.get(remoteUserId);
        if (!stream) {
            stream = new MediaStream();
            remoteStreams.set(remoteUserId, stream);
        }

        const existingTrack = stream.getTracks().find((entry) => entry.kind === track.kind);
        if (existingTrack) {
            stream.removeTrack(existingTrack);
        }
        stream.addTrack(track);
        onRemoteStream?.(remoteUserId, stream);
    };

    const createPeerConnection = (remoteUserId) => {
        const existing = peers.get(remoteUserId);
        if (existing && existing.connectionState !== 'closed') {
            return existing;
        }

        const pc = new RTCPeerConnection(rtcConfig);

        if (localStream) {
            localStream.getTracks().forEach((track) => {
                pc.addTrack(track, localStream);
            });
        }

        pc.ontrack = (event) => {
            if (event.track) {
                updateRemoteStream(remoteUserId, event.track);
            }
        };

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                sendSignal(remoteUserId, {
                    type: 'ice',
                    candidate: event.candidate
                });
            }
        };

        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'connected') {
                tunePeerSenders(pc);
            } else if (pc.connectionState === 'failed') {
                console.warn(`Voice connection failed with user ${remoteUserId}, retrying...`);
                cleanupPeer(remoteUserId);
                if (joined) {
                    createAndSendOffer(remoteUserId);
                }
            } else if (pc.connectionState === 'closed') {
                cleanupPeer(remoteUserId);
            }
        };

        peers.set(remoteUserId, pc);
        return pc;
    };

    const createAndSendOffer = async (remoteUserId) => {
        if (Number(remoteUserId) === Number(user.id)) {
            return;
        }

        try {
            let pc = peers.get(remoteUserId);
            if (pc && pc.signalingState !== 'stable' && pc.connectionState !== 'connected') {
                cleanupPeer(remoteUserId);
                pc = null;
            }

            if (!pc) {
                pc = createPeerConnection(remoteUserId);
            }

            const offer = await pc.createOffer(AUDIO_NEGOTIATION_OPTIONS);
            await setOptimizedLocalDescription(pc, offer);
            sendSignal(remoteUserId, {
                type: 'offer',
                sdp: pc.localDescription
            });
        } catch (error) {
            onError?.('Failed to connect to a voice participant.');
            console.error('Voice offer error:', error);
        }
    };

    const handleSignal = async (fromUserId, signal) => {
        try {
            if (signal.type === 'offer') {
                const polite = isPolitePeer(fromUserId);
                let pc = peers.get(fromUserId);
                const offerCollision = pc && pc.signalingState !== 'stable';

                if (offerCollision) {
                    if (!polite) {
                        return;
                    }
                    cleanupPeer(fromUserId);
                    pc = null;
                }

                if (!pc) {
                    pc = createPeerConnection(fromUserId);
                }

                await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
                await flushPendingIceCandidates(fromUserId, pc);

                const answer = await pc.createAnswer(AUDIO_NEGOTIATION_OPTIONS);
                await setOptimizedLocalDescription(pc, answer);
                sendSignal(fromUserId, {
                    type: 'answer',
                    sdp: pc.localDescription
                });
                await tunePeerSenders(pc);
                return;
            }

            let pc = peers.get(fromUserId);
            if (!pc) {
                if (signal.type === 'ice' && signal.candidate) {
                    queueIceCandidate(fromUserId, new RTCIceCandidate(signal.candidate));
                }
                return;
            }

            if (signal.type === 'answer') {
                if (pc.signalingState === 'stable') {
                    return;
                }
                await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
                await flushPendingIceCandidates(fromUserId, pc);
            } else if (signal.type === 'ice' && signal.candidate) {
                const candidate = new RTCIceCandidate(signal.candidate);
                if (pc.remoteDescription) {
                    await pc.addIceCandidate(candidate);
                } else {
                    queueIceCandidate(fromUserId, candidate);
                }
            }
        } catch (error) {
            console.error('Voice signal error:', error);
        }
    };

    const emitStateUpdate = () => {
        socket?.emit('voice-state-update', {
            groupId: Number(groupId),
            userId: Number(user.id),
            micEnabled,
            cameraEnabled
        });
    };

    const emitJoinVoice = () => {
        socket?.emit('join-voice', {
            groupId: Number(groupId),
            userId: Number(user.id),
            username: user.username,
            profile_picture_url: user.profile_picture_url || null
        });
    };

    const connectToParticipants = (participants = []) => {
        participants.forEach((participant) => {
            if (Number(participant.user_id) !== Number(user.id)) {
                createAndSendOffer(participant.user_id);
            }
        });
    };

    const rejoinVoice = () => {
        if (!joined || !socket?.connected) {
            return;
        }

        cleanupAllPeers();
        emitJoinVoice();
        emitStateUpdate();
    };

    const attachVoiceHandlers = () => {
        if (!socket || handlers) {
            return;
        }

        handlers = {
            onVoiceParticipants: ({ groupId: eventGroupId, participants }) => {
                if (Number(eventGroupId) !== Number(groupId) || !joined) {
                    return;
                }

                connectToParticipants(participants);
            },
            onVoiceUserJoined: ({ groupId: eventGroupId, participant }) => {
                if (Number(eventGroupId) !== Number(groupId) || !joined || !participant) {
                    return;
                }

                if (Number(participant.user_id) !== Number(user.id)) {
                    createAndSendOffer(participant.user_id);
                }
            },
            onVoiceUserLeft: ({ groupId: eventGroupId, user_id: leftUserId }) => {
                if (Number(eventGroupId) !== Number(groupId)) {
                    return;
                }

                cleanupPeer(leftUserId);
            },
            onVoiceSignal: ({ groupId: eventGroupId, fromUserId, signal }) => {
                if (Number(eventGroupId) !== Number(groupId)) {
                    return;
                }

                handleSignal(fromUserId, signal);
            }
        };

        socket.on('voice-participants', handlers.onVoiceParticipants);
        socket.on('voice-user-joined', handlers.onVoiceUserJoined);
        socket.on('voice-user-left', handlers.onVoiceUserLeft);
        socket.on('voice-signal', handlers.onVoiceSignal);
    };

    const detachVoiceHandlers = () => {
        if (!socket || !handlers) {
            handlers = null;
            return;
        }

        socket.off('voice-participants', handlers.onVoiceParticipants);
        socket.off('voice-user-joined', handlers.onVoiceUserJoined);
        socket.off('voice-user-left', handlers.onVoiceUserLeft);
        socket.off('voice-signal', handlers.onVoiceSignal);
        handlers = null;
    };

    const join = async () => {
        if (joined) {
            return localStream;
        }

        socket = await waitForSocketConnection();
        rtcConfig = await fetchRtcConfig();

        if (import.meta.env.DEV) {
            console.log('Voice RTC config loaded:', {
                iceServerCount: rtcConfig.iceServers?.length || 0,
                iceTransportPolicy: rtcConfig.iceTransportPolicy
            });
        }

        localStream = await acquireLocalAudio();
        localStream.getAudioTracks().forEach((track) => {
            track.enabled = false;
        });

        attachVoiceHandlers();
        reconnectUnsubscribe = onSocketReconnect(rejoinVoice);

        joined = true;
        emitJoinVoice();
        emitStateUpdate();

        return localStream;
    };

    const leave = () => {
        if (!joined) {
            return;
        }

        reconnectUnsubscribe?.();
        reconnectUnsubscribe = null;

        socket?.emit('leave-voice', {
            groupId: Number(groupId),
            userId: Number(user.id)
        });

        detachVoiceHandlers();
        cleanupAllPeers();

        if (localStream) {
            localStream.getTracks().forEach((track) => track.stop());
            localStream = null;
        }

        joined = false;
        micEnabled = false;
        cameraEnabled = false;
    };

    const renegotiatePeer = async (remoteUserId, pc) => {
        const offer = await pc.createOffer(AUDIO_NEGOTIATION_OPTIONS);
        await setOptimizedLocalDescription(pc, offer);
        sendSignal(remoteUserId, {
            type: 'offer',
            sdp: pc.localDescription
        });
    };

    const ensureVideoTrack = async () => {
        if (!localStream) {
            return null;
        }

        let videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
            return videoTrack;
        }

        videoTrack = await acquireLocalVideoTrack();
        if (!videoTrack) {
            throw new Error('Unable to start camera on this device.');
        }

        videoTrack.enabled = false;
        localStream.addTrack(videoTrack);

        for (const [remoteUserId, pc] of peers.entries()) {
            pc.addTrack(videoTrack, localStream);
            if (!isPolitePeer(remoteUserId)) {
                await renegotiatePeer(remoteUserId, pc);
            }
        }

        return videoTrack;
    };

    const toggleMic = () => {
        if (!localStream) {
            return micEnabled;
        }

        micEnabled = !micEnabled;
        localStream.getAudioTracks().forEach((track) => {
            track.enabled = micEnabled;
        });
        emitStateUpdate();
        return micEnabled;
    };

    const toggleCamera = async () => {
        if (!localStream) {
            return cameraEnabled;
        }

        try {
            if (!cameraEnabled) {
                const videoTrack = await ensureVideoTrack();
                if (!videoTrack) {
                    throw new Error('Unable to start camera.');
                }
                cameraEnabled = true;
                videoTrack.enabled = true;
            } else {
                cameraEnabled = false;
                localStream.getVideoTracks().forEach((track) => {
                    track.enabled = false;
                });
            }

            emitStateUpdate();
            return cameraEnabled;
        } catch (error) {
            onError?.(error.message || 'Unable to access camera.');
            return cameraEnabled;
        }
    };

    return {
        join,
        leave,
        toggleMic,
        toggleCamera,
        getLocalStream: () => localStream,
        isMicEnabled: () => micEnabled,
        isCameraEnabled: () => cameraEnabled
    };
};

export const requestVoiceRoster = (groupId) => {
    const socket = getSocket();
    if (socket?.connected) {
        socket.emit('get-voice-roster', { groupId: Number(groupId) });
    }
};
