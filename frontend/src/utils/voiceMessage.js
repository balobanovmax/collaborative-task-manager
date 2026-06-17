export const MAX_VOICE_MESSAGE_SECONDS = 120;

export const getRecordingMimeType = () => {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg'
  ];

  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
};

export const getExtensionForMimeType = (mimeType) => {
  if (mimeType.includes('webm')) return 'webm';
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('mp4')) return 'm4a';
  return 'webm';
};

export const formatVoiceDuration = (seconds) => {
  const safeSeconds = Math.max(0, Math.round(Number(seconds) || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const remaining = safeSeconds % 60;
  return `${minutes}:${String(remaining).padStart(2, '0')}`;
};
