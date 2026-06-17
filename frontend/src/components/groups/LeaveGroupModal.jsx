import { useEffect, useState } from 'react';
import styles from './LeaveGroupModal.module.css';

function LeaveGroupModal({
  isOpen,
  onClose,
  onConfirm,
  isOwner,
  members = [],
  currentUserId,
  isSubmitting = false,
  error = ''
}) {
  const [transferToUserId, setTransferToUserId] = useState('');

  const otherMembers = members.filter(
    (member) => Number(member.user_id) !== Number(currentUserId)
  );
  const requiresTransfer = isOwner && otherMembers.length > 0;

  useEffect(() => {
    if (!isOpen) {
      setTransferToUserId('');
      return;
    }

    if (requiresTransfer && otherMembers.length === 1) {
      setTransferToUserId(String(otherMembers[0].user_id));
    }
  }, [isOpen, requiresTransfer, otherMembers]);

  if (!isOpen) {
    return null;
  }

  const canConfirm = !requiresTransfer || transferToUserId;

  const handleConfirm = () => {
    if (!canConfirm || isSubmitting) {
      return;
    }

    onConfirm(requiresTransfer ? Number(transferToUserId) : null);
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
        <h2 className={styles.title}>Leave Group</h2>

        {requiresTransfer ? (
          <>
            <p className={styles.message}>
              You are the group owner. Transfer ownership to another member before leaving.
            </p>
            <label className={styles.label} htmlFor="new-owner-select">
              New owner
            </label>
            <select
              id="new-owner-select"
              className={styles.select}
              value={transferToUserId}
              onChange={(event) => setTransferToUserId(event.target.value)}
              disabled={isSubmitting}
            >
              <option value="">Select a member</option>
              {otherMembers.map((member) => (
                <option key={member.user_id} value={member.user_id}>
                  {member.username}
                </option>
              ))}
            </select>
          </>
        ) : (
          <p className={styles.message}>
            {isOwner
              ? 'You are the only member. Leaving will remove you from this group.'
              : 'Are you sure you want to leave this group? You will lose access to its tasks and chat.'}
          </p>
        )}

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.actions}>
          <button type="button" className={styles.cancelButton} onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.confirmButton}
            onClick={handleConfirm}
            disabled={!canConfirm || isSubmitting}
          >
            {isSubmitting
              ? 'Leaving...'
              : requiresTransfer
                ? 'Transfer & Leave'
                : 'Leave Group'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default LeaveGroupModal;
