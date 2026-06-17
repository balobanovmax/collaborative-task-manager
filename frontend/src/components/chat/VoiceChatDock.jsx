import styles from './VoiceChatDock.module.css';
import {
  MicOnIcon,
  MicOffIcon,
  CameraOnIcon,
  CameraOffIcon
} from './VoiceIcons';

function VoiceChatDock({
  isVisible,
  micEnabled,
  cameraEnabled,
  participantCount,
  onToggleMic,
  onToggleCamera,
  onExpand,
  onLeave
}) {
  if (!isVisible) {
    return null;
  }

  return (
    <div className={styles.dock} role="region" aria-label="Voice chat controls">
      <div className={styles.status}>
        <span className={styles.liveDot} aria-hidden="true" />
        In voice · {participantCount} connected
      </div>

      <button
        type="button"
        className={`${styles.iconButton} ${micEnabled ? styles.iconButtonActive : ''}`}
        onClick={onToggleMic}
        title={micEnabled ? 'Mute microphone' : 'Unmute microphone'}
        aria-label={micEnabled ? 'Mute microphone' : 'Unmute microphone'}
      >
        {micEnabled ? <MicOnIcon size={18} /> : <MicOffIcon size={18} />}
      </button>

      <button
        type="button"
        className={`${styles.iconButton} ${cameraEnabled ? styles.iconButtonActive : ''}`}
        onClick={onToggleCamera}
        title={cameraEnabled ? 'Turn camera off' : 'Turn camera on'}
        aria-label={cameraEnabled ? 'Turn camera off' : 'Turn camera on'}
      >
        {cameraEnabled ? <CameraOnIcon size={18} /> : <CameraOffIcon size={18} />}
      </button>

      <button
        type="button"
        className={styles.expandButton}
        onClick={onExpand}
      >
        Open panel
      </button>

      <button
        type="button"
        className={styles.leaveButton}
        onClick={onLeave}
        title="Leave voice chat"
        aria-label="Leave voice chat"
      >
        Leave
      </button>
    </div>
  );
}

export default VoiceChatDock;
