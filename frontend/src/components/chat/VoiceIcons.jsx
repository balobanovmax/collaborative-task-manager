function IconBase({ size = 16, className = '', children }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function MicOnIcon({ size = 16, className = '' }) {
  return (
    <IconBase size={size} className={className}>
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </IconBase>
  );
}

export function MicOffIcon({ size = 16, className = '' }) {
  return (
    <IconBase size={size} className={className}>
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </IconBase>
  );
}

export function CameraOnIcon({ size = 16, className = '' }) {
  return (
    <IconBase size={size} className={className}>
      <path d="M23 7l-7 5 7 5V7z" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </IconBase>
  );
}

export function CameraOffIcon({ size = 16, className = '' }) {
  return (
    <IconBase size={size} className={className}>
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h4a2 2 0 0 1 2 2v9.34m-7.72-2.06a4 4 0 1 1-5.56-5.56" />
    </IconBase>
  );
}

export function MicStatusIcon({ enabled, size = 14, className = '' }) {
  return enabled
    ? <MicOnIcon size={size} className={className} />
    : <MicOffIcon size={size} className={className} />;
}

export function CameraStatusIcon({ enabled, size = 14, className = '' }) {
  return enabled
    ? <CameraOnIcon size={size} className={className} />
    : <CameraOffIcon size={size} className={className} />;
}
