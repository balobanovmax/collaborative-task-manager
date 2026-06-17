import { useEffect, useState } from 'react';
import styles from './UserAvatar.module.css';
import { resolveAvatarUrl } from '../../utils/avatar';

const getInitials = (username) => {
  if (!username) return '?';
  const parts = username.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return username.slice(0, 2).toUpperCase();
};

function UserAvatar({ username, profilePictureUrl, size = 'md', className = '' }) {
  const [imageError, setImageError] = useState(false);
  const sizeClass = styles[size] || styles.md;
  const avatarUrl = resolveAvatarUrl(profilePictureUrl);
  const showImage = avatarUrl && !imageError;

  useEffect(() => {
    setImageError(false);
  }, [profilePictureUrl]);

  if (showImage) {
    return (
      <img
        src={avatarUrl}
        alt={username || 'User avatar'}
        className={`${styles.avatarImage} ${sizeClass} ${className}`}
        onError={() => setImageError(true)}
      />
    );
  }

  return (
    <span
      className={`${styles.avatar} ${sizeClass} ${className}`}
      title={username}
      aria-hidden={!username}
    >
      {getInitials(username)}
    </span>
  );
}

export default UserAvatar;
