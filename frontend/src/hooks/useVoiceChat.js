import { useCallback, useEffect, useRef, useState } from 'react';
import { createVoiceChatSession } from '../services/voiceChat';
import { onVoiceRosterUpdated } from '../services/socket';
import { playLeaveVoiceSound } from '../utils/voiceSounds';

export function useVoiceChat(groupId, user) {
  const sessionRef = useRef(null);
  const [isInVoice, setIsInVoice] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [micEnabled, setMicEnabled] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');

  const resetState = useCallback(() => {
    setIsInVoice(false);
    setParticipants([]);
    setLocalStream(null);
    setRemoteStreams({});
    setMicEnabled(false);
    setCameraEnabled(false);
    setIsConnecting(false);
    setError('');
  }, []);

  const leave = useCallback(({ playSound = false } = {}) => {
    const wasInVoice = isInVoice;
    sessionRef.current?.leave();
    sessionRef.current = null;
    resetState();
    if (wasInVoice && playSound) {
      playLeaveVoiceSound();
    }
  }, [resetState, isInVoice]);

  const join = useCallback(async () => {
    if (!groupId || !user?.id || isConnecting || isInVoice) {
      return isInVoice;
    }

    setIsConnecting(true);
    setError('');

    const session = createVoiceChatSession({
      groupId,
      user,
      onRemoteStream: (remoteUserId, stream) => {
        setRemoteStreams((prev) => ({ ...prev, [remoteUserId]: stream }));
      },
      onRemoteStreamRemoved: (remoteUserId) => {
        setRemoteStreams((prev) => {
          const next = { ...prev };
          delete next[remoteUserId];
          return next;
        });
      },
      onError: (message) => {
        setError(message);
      }
    });

    sessionRef.current = session;

    try {
      const stream = await session.join();
      setLocalStream(stream);
      setMicEnabled(false);
      setCameraEnabled(false);
      setIsInVoice(true);
      return true;
    } catch (err) {
      sessionRef.current = null;
      setError(err.message || 'Failed to join voice chat.');
      return false;
    } finally {
      setIsConnecting(false);
    }
  }, [groupId, user, isConnecting, isInVoice]);

  const toggleMic = useCallback(() => {
    const enabled = sessionRef.current?.toggleMic();
    if (typeof enabled === 'boolean') {
      setMicEnabled(enabled);
    }
  }, []);

  const toggleCamera = useCallback(async () => {
    const enabled = await sessionRef.current?.toggleCamera();
    if (typeof enabled === 'boolean') {
      setCameraEnabled(enabled);
    }
  }, []);

  useEffect(() => {
    if (!groupId) {
      return undefined;
    }

    const unsubscribeRoster = onVoiceRosterUpdated(({ groupId: eventGroupId, participants: roster }) => {
      if (Number(eventGroupId) === Number(groupId)) {
        setParticipants(roster || []);
      }
    });

    return () => {
      unsubscribeRoster();
    };
  }, [groupId]);

  useEffect(() => {
    return () => {
      sessionRef.current?.leave();
      sessionRef.current = null;
    };
  }, [groupId]);

  return {
    isInVoice,
    isConnecting,
    error,
    participants,
    localStream,
    remoteStreams,
    micEnabled,
    cameraEnabled,
    join,
    leave,
    toggleMic,
    toggleCamera
  };
}
