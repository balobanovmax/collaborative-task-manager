export const resolveAvatarUrl = (profilePictureUrl) => {
  if (!profilePictureUrl) {
    return null;
  }

  if (
    profilePictureUrl.startsWith('http://') ||
    profilePictureUrl.startsWith('https://') ||
    profilePictureUrl.startsWith('/')
  ) {
    return profilePictureUrl;
  }

  return profilePictureUrl;
};
