export const getBackendUrl = () => {
  const url = import.meta.env.VITE_BACKEND_URL?.trim();
  if (!url) {
    return '';
  }
  return url.replace(/\/$/, '');
};

export const getApiBaseUrl = () => {
  const backendUrl = getBackendUrl();
  return backendUrl ? `${backendUrl}/api` : '/api';
};

export const getSocketUrl = () => getBackendUrl();

export const resolveMediaUrl = (path) => {
  if (!path) {
    return path;
  }

  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  if (path.startsWith('/')) {
    const backendUrl = getBackendUrl();
    return backendUrl ? `${backendUrl}${path}` : path;
  }

  return path;
};
