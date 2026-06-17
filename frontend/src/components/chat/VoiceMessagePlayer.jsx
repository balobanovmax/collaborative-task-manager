import { useEffect, useRef, useState } from 'react';
import styles from './VoiceMessagePlayer.module.css';
import { formatVoiceDuration } from '../../utils/voiceMessage';

function VoiceMessagePlayer({ src, durationSeconds, isOwn = false }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loadedDuration, setLoadedDuration] = useState(durationSeconds || 0);

  useEffect(() => {
    setProgress(0);
    setIsPlaying(false);
    setLoadedDuration(durationSeconds || 0);
  }, [src, durationSeconds]);

  const handleTogglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    try {
      await audio.play();
      setIsPlaying(true);
    } catch (error) {
      console.error('Unable to play voice message:', error);
    }
  };

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) {
      return;
    }

    setProgress((audio.currentTime / audio.duration) * 100);
  };

  const handleLoadedMetadata = () => {
    const audio = audioRef.current;
    if (audio?.duration && Number.isFinite(audio.duration)) {
      setLoadedDuration(Math.round(audio.duration));
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setProgress(0);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  };

  return (
    <div className={`${styles.player} ${isOwn ? styles.playerOwn : ''}`}>
      <button
        type="button"
        className={styles.playButton}
        onClick={handleTogglePlay}
        aria-label={isPlaying ? 'Pause voice message' : 'Play voice message'}
      >
        {isPlaying ? '❚❚' : '▶'}
      </button>
      <div className={styles.track}>
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${progress}%` }} />
        </div>
        <span className={styles.duration}>{formatVoiceDuration(loadedDuration)}</span>
      </div>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        className={styles.hiddenAudio}
      />
    </div>
  );
}

export default VoiceMessagePlayer;
