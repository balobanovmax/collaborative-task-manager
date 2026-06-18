import { resolveMediaUrl } from './backendUrl';

export const resolveAvatarUrl = (profilePictureUrl) => {
  return resolveMediaUrl(profilePictureUrl);
};
