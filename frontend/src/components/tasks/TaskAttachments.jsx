import { useEffect, useRef, useState } from 'react';
import styles from './TaskAttachments.module.css';
import { taskAPI } from '../../services/api';
import { onTaskAttachmentAdded, onTaskAttachmentDeleted } from '../../services/socket';
import { getUser } from '../../utils/auth';
import UserAvatar from '../common/UserAvatar';
import ConfirmModal from '../common/ConfirmModal';
import { resolveMediaUrl } from '../../utils/backendUrl';

const formatFileSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getFileLabel = (mimeType) => {
  if (mimeType === 'application/pdf') return 'PDF';
  if (mimeType.startsWith('image/')) return 'Image';
  if (mimeType.includes('word')) return 'Document';
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'Spreadsheet';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'Presentation';
  if (mimeType === 'text/plain') return 'Text';
  return 'File';
};

const canPreviewInBrowser = (mimeType) =>
  mimeType === 'application/pdf' || mimeType.startsWith('image/') || mimeType === 'text/plain';

function TaskAttachments({
  taskId,
  initialCount = 0,
  taskCreatedBy,
  groupOwnerId,
  onAttachmentAdded
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [attachmentCount, setAttachmentCount] = useState(initialCount);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, attachmentId: null, fileName: '' });
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);
  const hasLoadedRef = useRef(false);
  const currentUser = getUser();

  useEffect(() => {
    setAttachmentCount(initialCount);
  }, [initialCount, taskId]);

  useEffect(() => {
    if (!isExpanded) {
      return undefined;
    }

    const unsubscribeAdded = onTaskAttachmentAdded((data) => {
      if (Number(data.taskId) !== Number(taskId)) {
        return;
      }

      setAttachments((prev) => {
        const exists = prev.some((item) => item.id === data.attachment.id);
        if (exists) {
          return prev;
        }

        setAttachmentCount((count) => count + 1);
        return [data.attachment, ...prev];
      });
    });

    const unsubscribeDeleted = onTaskAttachmentDeleted((data) => {
      if (Number(data.taskId) !== Number(taskId)) {
        return;
      }

      setAttachments((prev) => {
        const next = prev.filter((item) => item.id !== data.attachmentId);
        if (next.length !== prev.length) {
          setAttachmentCount((count) => Math.max(0, count - 1));
        }
        return next;
      });
    });

    return () => {
      unsubscribeAdded();
      unsubscribeDeleted();
    };
  }, [isExpanded, taskId]);

  const loadAttachments = async () => {
    try {
      setIsLoading(true);
      setError('');
      const response = await taskAPI.getAttachments(taskId);
      setAttachments(response.data.attachments || []);
      setAttachmentCount(response.data.attachments?.length || 0);
      hasLoadedRef.current = true;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load attachments');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = async () => {
    const nextExpanded = !isExpanded;
    setIsExpanded(nextExpanded);

    if (nextExpanded && !hasLoadedRef.current) {
      await loadAttachments();
    }
  };

  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      setIsUploading(true);
      setError('');
      const response = await taskAPI.uploadAttachment(taskId, file);
      const attachment = response.data.attachment;

      setAttachments((prev) => {
        const exists = prev.some((item) => item.id === attachment.id);
        if (exists) {
          return prev;
        }
        return [attachment, ...prev];
      });
      setAttachmentCount((prev) => prev + 1);
      onAttachmentAdded?.(taskId);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload attachment');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const openDeleteModal = (attachment) => {
    setDeleteModal({
      isOpen: true,
      attachmentId: attachment.id,
      fileName: attachment.original_filename
    });
  };

  const cancelDelete = () => {
    setDeleteModal({ isOpen: false, attachmentId: null, fileName: '' });
  };

  const confirmDelete = async () => {
    const { attachmentId } = deleteModal;
    if (!attachmentId) {
      return;
    }

    try {
      setDeletingId(attachmentId);
      setError('');
      cancelDelete();
      await taskAPI.deleteAttachment(taskId, attachmentId);
      setAttachments((prev) => prev.filter((item) => item.id !== attachmentId));
      setAttachmentCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete attachment');
    } finally {
      setDeletingId(null);
    }
  };

  const canDeleteAttachment = (attachment) => {
    const userId = Number(currentUser?.id);
    return (
      Number(attachment.user_id) === userId
      || Number(taskCreatedBy) === userId
      || Number(groupOwnerId) === userId
    );
  };

  return (
    <div className={styles.attachments}>
      <div
        className={styles.headerRow}
        role="button"
        tabIndex={0}
        onClick={handleToggle}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleToggle();
          }
        }}
        aria-expanded={isExpanded}
      >
        <span className={styles.toggleLabel}>Attachments ({attachmentCount})</span>

        <div
          className={styles.headerActions}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx,application/pdf,image/*,text/plain"
            className={styles.hiddenInput}
            onChange={handleFileSelect}
            disabled={isUploading}
          />
          <button
            type="button"
            className={styles.attachButton}
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? 'Uploading...' : 'Attach Document'}
          </button>
        </div>

        <span className={`${styles.expandArrow} ${isExpanded ? styles.expanded : ''}`}>▼</span>
      </div>

      <p className={styles.helperText}>
        PDF, images, TXT, DOC, DOCX, XLS, XLSX, PPT, PPTX. Max 10MB.
      </p>

      {error && !isExpanded && <div className={styles.errorMessage}>{error}</div>}

      {isExpanded && (
        <div className={styles.body}>
          {isLoading ? (
            <p className={styles.statusText}>Loading attachments...</p>
          ) : attachments.length === 0 ? (
            <p className={styles.statusText}>No attachments yet.</p>
          ) : (
            <div className={styles.list}>
              {attachments.map((attachment) => (
                <div key={attachment.id} className={styles.item}>
                  <div className={styles.itemMain}>
                    <UserAvatar
                      username={attachment.username}
                      profilePictureUrl={attachment.profile_picture_url}
                      size="sm"
                    />
                    <div className={styles.itemInfo}>
                      <div className={styles.fileNameRow}>
                        <span className={styles.fileType}>{getFileLabel(attachment.mime_type)}</span>
                        <span className={styles.fileName}>{attachment.original_filename}</span>
                      </div>
                      <div className={styles.fileMeta}>
                        {attachment.username} · {formatFileSize(attachment.file_size)} ·{' '}
                        {new Date(attachment.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  <div className={styles.itemActions}>
                    {canPreviewInBrowser(attachment.mime_type) && (
                      <a
                        href={resolveMediaUrl(attachment.file_path)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.actionLink}
                      >
                        View
                      </a>
                    )}
                    <a
                      href={resolveMediaUrl(attachment.file_path)}
                      download={attachment.original_filename}
                      className={styles.actionLink}
                    >
                      Download
                    </a>
                    {canDeleteAttachment(attachment) && (
                      <button
                        type="button"
                        className={styles.deleteButton}
                        onClick={() => openDeleteModal(attachment)}
                        disabled={deletingId === attachment.id}
                      >
                        {deletingId === attachment.id ? '...' : 'Delete'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && <div className={styles.errorMessage}>{error}</div>}
        </div>
      )}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        title="Delete Attachment"
        message={`Are you sure you want to delete "${deleteModal.fileName}"? This cannot be undone.`}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  );
}

export default TaskAttachments;
