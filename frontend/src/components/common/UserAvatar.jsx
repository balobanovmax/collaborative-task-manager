import styles from './UserAvatar.module.css';

const getInitials = (username) => {
  if (!username) return '?';
  const parts = username.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return username.slice(0, 2).toUpperCase();
};

function UserAvatar({ username, profilePictureUrl, size = 'md', className = '' }) {
  const sizeClass = styles[size] || styles.md;

  if (profilePictureUrl) {
    return (
      <img
        src={profilePictureUrl}
        alt={username || 'User avatar'}
        className={`${styles.avatarImage} ${sizeClass} ${className}`}
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
