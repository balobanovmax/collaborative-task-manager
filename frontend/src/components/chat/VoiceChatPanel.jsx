import { useEffect, useRef, useState, useCallback } from 'react';
import styles from './VoiceChatPanel.module.css';
import UserAvatar from '../common/UserAvatar';
import ResizableWindow from '../common/ResizableWindow';
import { MicStatusIcon, CameraStatusIcon, MicOnIcon, MicOffIcon, CameraOnIcon, CameraOffIcon } from './VoiceIcons';

const DEFAULT_TILE_WIDTH = 220;
const DEFAULT_TILE_HEIGHT = 186;
const MIN_TILE_WIDTH = 160;
const MAX_TILE_WIDTH = 520;
const MIN_TILE_HEIGHT = 132;
const MAX_TILE_HEIGHT = 420;

const DEFAULT_TILE_SIZE = {
  width: DEFAULT_TILE_WIDTH,
  height: DEFAULT_TILE_HEIGHT
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const clampTileSize = (size) => ({
  width: clamp(size.width, MIN_TILE_WIDTH, MAX_TILE_WIDTH),
  height: clamp(size.height, MIN_TILE_HEIGHT, MAX_TILE_HEIGHT)
});

function VideoTile({
  participant,
  stream,
  isLocal = false,
  micEnabled,
  cameraEnabled,
  tileSize = DEFAULT_TILE_SIZE,
  onTileSizeChange
}) {
  const videoRef = useRef(null);
  const resizeRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return undefined;
    }

    if (stream && cameraEnabled) {
      video.srcObject = stream;
      video.play().catch(() => {});
    } else {
      video.srcObject = null;
    }

    return () => {
      if (video) {
        video.srcObject = null;
      }
    };
  }, [stream, cameraEnabled]);

  useEffect(() => {
    const handleMouseMove = (event) => {
      if (!resizeRef.current || !onTileSizeChange) {
        return;
      }

      const { startX, startY, originWidth, originHeight } = resizeRef.current;
      onTileSizeChange(clampTileSize({
        width: originWidth + (event.clientX - startX),
        height: originHeight + (event.clientY - startY)
      }));
    };

    const handleMouseUp = () => {
      resizeRef.current = null;
      document.body.style.removeProperty('user-select');
      document.body.style.removeProperty('cursor');
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.removeProperty('user-select');
      document.body.style.removeProperty('cursor');
    };
  }, [onTileSizeChange]);

  const handleResizeStart = (event) => {
    event.preventDefault();
    event.stopPropagation();
    resizeRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originWidth: tileSize.width,
      originHeight: tileSize.height
    };
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'nwse-resize';
  };

  const handleResizeReset = (event) => {
    event.preventDefault();
    event.stopPropagation();
    onTileSizeChange?.(DEFAULT_TILE_SIZE);
  };

  const showVideo = stream && cameraEnabled;

  return (
    <div
      className={styles.videoTile}
      style={{
        width: `${tileSize.width}px`,
        height: `${tileSize.height}px`
      }}
    >
      <div className={styles.videoArea}>
        {showVideo ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`${styles.video} ${isLocal ? styles.localVideo : ''}`}
          />
        ) : (
          <div className={styles.videoPlaceholder}>
            <UserAvatar
              username={participant.username}
              profilePictureUrl={participant.profile_picture_url}
              size="lg"
            />
          </div>
        )}
      </div>
      <div className={styles.videoLabel}>
        <span>{isLocal ? `${participant.username} (You)` : participant.username}</span>
        <span className={styles.statusIcons}>
          <MicStatusIcon enabled={micEnabled} size={14} />
          <CameraStatusIcon enabled={cameraEnabled} size={14} />
        </span>
      </div>
      <div
        className={styles.tileResizeHandle}
        onMouseDown={handleResizeStart}
        onDoubleClick={handleResizeReset}
        title="Drag to resize · double-click to reset"
        aria-label="Resize participant tile"
      />
    </div>
  );
}

function VoiceChatPanel({
  groupId,
  isOpen,
  onMinimize,
  onLeave,
  members = [],
  currentUser,
  isInVoice,
  isConnecting,
  error,
  participants,
  localStream,
  remoteStreams,
  micEnabled,
  cameraEnabled,
  onToggleMic,
  onToggleCamera,
  zIndex = 1001,
  onFocus
}) {
  const [tileSizes, setTileSizes] = useState({});

  const getTileSize = useCallback(
    (userId) => tileSizes[userId] ?? DEFAULT_TILE_SIZE,
    [tileSizes]
  );

  const setTileSize = useCallback((userId, size) => {
    setTileSizes((prev) => ({
      ...prev,
      [userId]: clampTileSize(size)
    }));
  }, []);

  const getParticipantMeta = (userId) => {
    const rosterEntry = participants.find((p) => Number(p.user_id) === Number(userId));
    const memberEntry = members.find((m) => Number(m.user_id) === Number(userId));

    return {
      user_id: userId,
      username: rosterEntry?.username || memberEntry?.username || 'Unknown',
      profile_picture_url: rosterEntry?.profile_picture_url || memberEntry?.profile_picture_url || null,
      mic_enabled: rosterEntry?.mic_enabled ?? false,
      camera_enabled: rosterEntry?.camera_enabled ?? false
    };
  };

  if (!isOpen || !groupId || !currentUser?.id) {
    return null;
  }

  const localParticipant = {
    user_id: currentUser.id,
    username: currentUser.username,
    profile_picture_url: currentUser.profile_picture_url,
    mic_enabled: micEnabled,
    camera_enabled: cameraEnabled
  };

  const remoteParticipants = participants.filter(
    (participant) => Number(participant.user_id) !== Number(currentUser.id)
  );

  return (
    <ResizableWindow
      isOpen={isOpen}
      onClose={onMinimize}
      title="Voice & Video Chat"
      subtitle={
        isInVoice
          ? `${participants.length} teammate${participants.length === 1 ? '' : 's'} in voice · drag tile corners to resize`
          : 'Connecting...'
      }
      defaultPosition={{ x: 500, y: 88 }}
      defaultSize={{ width: 480, height: 620 }}
      zIndex={zIndex}
      onFocus={onFocus}
      ariaLabel="Voice and video chat"
    >
      <div className={styles.panel}>
        <div className={styles.participantList}>
          <span className={styles.participantListTitle}>In voice now</span>
          {participants.length === 0 ? (
            <span className={styles.participantEmpty}>No one else yet</span>
          ) : (
            participants.map((participant) => (
              <span key={participant.user_id} className={styles.participantChip}>
                {participant.username}
                <MicStatusIcon enabled={participant.mic_enabled} size={12} className={styles.chipIcon} />
                <CameraStatusIcon enabled={participant.camera_enabled} size={12} className={styles.chipIcon} />
              </span>
            ))
          )}
        </div>

        {isConnecting && (
          <div className={styles.loadingState}>Connecting to voice chat...</div>
        )}

        {error && <div className={styles.errorMessage}>{error}</div>}

        <div className={styles.videoGrid}>
          {isInVoice && (
            <VideoTile
              participant={localParticipant}
              stream={localStream}
              isLocal
              micEnabled={micEnabled}
              cameraEnabled={cameraEnabled}
              tileSize={getTileSize(localParticipant.user_id)}
              onTileSizeChange={(size) => setTileSize(localParticipant.user_id, size)}
            />
          )}

          {remoteParticipants.map((participant) => {
            const meta = getParticipantMeta(participant.user_id);
            return (
              <VideoTile
                key={participant.user_id}
                participant={meta}
                stream={remoteStreams[participant.user_id]}
                micEnabled={meta.mic_enabled}
                cameraEnabled={meta.camera_enabled}
                tileSize={getTileSize(participant.user_id)}
                onTileSizeChange={(size) => setTileSize(participant.user_id, size)}
              />
            );
          })}
        </div>

        <div className={styles.controls}>
          <button
            type="button"
            className={`${styles.controlButton} ${micEnabled ? styles.controlActive : ''}`}
            onClick={onToggleMic}
            disabled={isConnecting || !!error || !isInVoice}
          >
            {micEnabled ? <MicOnIcon size={16} /> : <MicOffIcon size={16} />}
            {micEnabled ? 'Mute' : 'Unmute'}
          </button>
          <button
            type="button"
            className={`${styles.controlButton} ${cameraEnabled ? styles.controlActive : ''}`}
            onClick={onToggleCamera}
            disabled={isConnecting || !!error || !isInVoice}
          >
            {cameraEnabled ? <CameraOnIcon size={16} /> : <CameraOffIcon size={16} />}
            {cameraEnabled ? 'Camera off' : 'Camera on'}
          </button>
          <button type="button" className={styles.minimizeButton} onClick={onMinimize}>
            Minimize
          </button>
          <button type="button" className={styles.leaveButton} onClick={onLeave}>
            Leave Voice
          </button>
        </div>
      </div>
    </ResizableWindow>
  );
}

export default VoiceChatPanel;
