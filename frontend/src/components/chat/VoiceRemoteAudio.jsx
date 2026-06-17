import { useEffect, useRef } from 'react';

function RemoteAudioTrack({ stream }) {
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return undefined;
    }

    if (stream) {
      const syncPlayback = () => {
        if (audio.srcObject !== stream) {
          audio.srcObject = stream;
        }
        audio.play().catch(() => {});
      };

      syncPlayback();
      stream.addEventListener('addtrack', syncPlayback);

      return () => {
        stream.removeEventListener('addtrack', syncPlayback);
        audio.srcObject = null;
      };
    }
  }, [stream]);

  return <audio ref={audioRef} autoPlay playsInline hidden />;
}

function VoiceRemoteAudio({ remoteStreams = {} }) {
  const entries = Object.entries(remoteStreams);

  if (entries.length === 0) {
    return null;
  }

  return (
    <>
      {entries.map(([userId, stream]) => (
        <RemoteAudioTrack key={userId} stream={stream} />
      ))}
    </>
  );
}

export default VoiceRemoteAudio;
