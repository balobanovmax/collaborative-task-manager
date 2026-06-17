import styles from './MemberProfileModal.module.css';
import UserAvatar from '../common/UserAvatar';

function MemberProfileModal({ member, isGroupOwner, onClose }) {
  if (!member) {
    return null;
  }

  const joinedDate = member.joined_at
    ? new Date(member.joined_at).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    : null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={onClose} aria-label="Close profile">
          ×
        </button>

        <div className={styles.profileHeader}>
          <UserAvatar
            username={member.username}
            profilePictureUrl={member.profile_picture_url}
            size="lg"
            className={styles.profileAvatar}
          />
          <h2 className={styles.profileName}>{member.username}</h2>
          <div className={styles.badges}>
            {isGroupOwner && <span className={styles.ownerBadge}>Group Owner</span>}
          </div>
        </div>

        <div className={styles.profileSection}>
          <h3 className={styles.sectionLabel}>Bio</h3>
          <p className={styles.bioText}>
            {member.bio?.trim() ? member.bio : 'This member has not added a bio yet.'}
          </p>
        </div>

        {joinedDate && (
          <div className={styles.profileSection}>
            <h3 className={styles.sectionLabel}>Joined Group</h3>
            <p className={styles.metaText}>{joinedDate}</p>
          </div>
        )}

        <button className={styles.doneButton} onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

export default MemberProfileModal;
