import { useEffect, useRef, useState } from 'react';
import styles from './TaskDrawings.module.css';
import { taskAPI } from '../../services/api';
import { onTaskDrawingAdded, onTaskDrawingDeleted } from '../../services/socket';
import { getUser } from '../../utils/auth';
import UserAvatar from '../common/UserAvatar';
import ConfirmModal from '../common/ConfirmModal';
import DrawingCanvasModal from './DrawingCanvasModal';
import { resolveMediaUrl } from '../../utils/backendUrl';

function TaskDrawings({
  taskId,
  initialCount = 0,
  taskCreatedBy,
  groupOwnerId,
  onDrawingAdded
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [drawings, setDrawings] = useState([]);
  const [drawingCount, setDrawingCount] = useState(initialCount);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCanvasOpen, setIsCanvasOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, drawingId: null, title: '' });
  const [error, setError] = useState('');
  const hasLoadedRef = useRef(false);
  const currentUser = getUser();

  useEffect(() => {
    setDrawingCount(initialCount);
  }, [initialCount, taskId]);

  useEffect(() => {
    if (!isExpanded) {
      return undefined;
    }

    const unsubscribeAdded = onTaskDrawingAdded((data) => {
      if (Number(data.taskId) !== Number(taskId)) {
        return;
      }

      setDrawings((prev) => {
        const exists = prev.some((item) => item.id === data.drawing.id);
        if (exists) {
          return prev;
        }

        setDrawingCount((count) => count + 1);
        return [data.drawing, ...prev];
      });
    });

    const unsubscribeDeleted = onTaskDrawingDeleted((data) => {
      if (Number(data.taskId) !== Number(taskId)) {
        return;
      }

      setDrawings((prev) => {
        const next = prev.filter((item) => item.id !== data.drawingId);
        if (next.length !== prev.length) {
          setDrawingCount((count) => Math.max(0, count - 1));
        }
        return next;
      });
    });

    return () => {
      unsubscribeAdded();
      unsubscribeDeleted();
    };
  }, [isExpanded, taskId]);

  const loadDrawings = async () => {
    try {
      setIsLoading(true);
      setError('');
      const response = await taskAPI.getDrawings(taskId);
      setDrawings(response.data.drawings || []);
      setDrawingCount(response.data.drawings?.length || 0);
      hasLoadedRef.current = true;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load drawings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = async () => {
    const nextExpanded = !isExpanded;
    setIsExpanded(nextExpanded);

    if (nextExpanded && !hasLoadedRef.current) {
      await loadDrawings();
    }
  };

  const handleSaveDrawing = async (file, title) => {
    try {
      setIsSaving(true);
      setError('');
      const response = await taskAPI.uploadDrawing(taskId, file, title);
      const drawing = response.data.drawing;

      setDrawings((prev) => {
        const exists = prev.some((item) => item.id === drawing.id);
        if (exists) {
          return prev;
        }
        return [drawing, ...prev];
      });
      setDrawingCount((prev) => prev + 1);
      onDrawingAdded?.(taskId);
      setIsCanvasOpen(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save drawing');
    } finally {
      setIsSaving(false);
    }
  };

  const openDeleteModal = (drawing) => {
    setDeleteModal({
      isOpen: true,
      drawingId: drawing.id,
      title: drawing.title
    });
  };

  const cancelDelete = () => {
    setDeleteModal({ isOpen: false, drawingId: null, title: '' });
  };

  const confirmDelete = async () => {
    const { drawingId } = deleteModal;
    if (!drawingId) {
      return;
    }

    try {
      setDeletingId(drawingId);
      setError('');
      cancelDelete();
      await taskAPI.deleteDrawing(taskId, drawingId);
      setDrawings((prev) => prev.filter((item) => item.id !== drawingId));
      setDrawingCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete drawing');
    } finally {
      setDeletingId(null);
    }
  };

  const canDeleteDrawing = (drawing) => {
    const userId = Number(currentUser?.id);
    return (
      Number(drawing.user_id) === userId
      || Number(taskCreatedBy) === userId
      || Number(groupOwnerId) === userId
    );
  };

  return (
    <div className={styles.drawings}>
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
        <span className={styles.toggleLabel}>Drawings ({drawingCount})</span>

        <div
          className={styles.headerActions}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className={styles.createButton}
            onClick={() => {
              setError('');
              setIsCanvasOpen(true);
            }}
          >
            Make Drawing
          </button>
        </div>

        <span className={`${styles.expandArrow} ${isExpanded ? styles.expanded : ''}`}>▼</span>
      </div>

      {error && !isExpanded && <div className={styles.errorMessage}>{error}</div>}

      {isExpanded && (
        <div className={styles.body}>
          {isLoading ? (
            <p className={styles.statusText}>Loading drawings...</p>
          ) : drawings.length === 0 ? (
            <p className={styles.statusText}>No drawings yet. Click Make Drawing to sketch one.</p>
          ) : (
            <div className={styles.grid}>
              {drawings.map((drawing) => {
                const drawingUrl = resolveMediaUrl(drawing.file_path);
                return (
                <div key={drawing.id} className={styles.card}>
                  <a
                    href={drawingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.previewLink}
                  >
                    <img
                      src={drawingUrl}
                      alt={drawing.title}
                      className={styles.previewImage}
                    />
                  </a>
                  <div className={styles.cardInfo}>
                    <div className={styles.cardHeader}>
                      <UserAvatar
                        username={drawing.username}
                        profilePictureUrl={drawing.profile_picture_url}
                        size="sm"
                      />
                      <div className={styles.cardMeta}>
                        <span className={styles.cardTitle}>{drawing.title}</span>
                        <span className={styles.cardSubtext}>
                          {drawing.username} · {new Date(drawing.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className={styles.cardActions}>
                      <a
                        href={drawingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.actionLink}
                      >
                        View
                      </a>
                      <a
                        href={drawingUrl}
                        download={`${drawing.title}.png`}
                        className={styles.actionLink}
                      >
                        Download
                      </a>
                      {canDeleteDrawing(drawing) && (
                        <button
                          type="button"
                          className={styles.deleteButton}
                          onClick={() => openDeleteModal(drawing)}
                          disabled={deletingId === drawing.id}
                        >
                          {deletingId === drawing.id ? '...' : 'Delete'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}

          {error && <div className={styles.errorMessage}>{error}</div>}
        </div>
      )}

      <DrawingCanvasModal
        isOpen={isCanvasOpen}
        onClose={() => !isSaving && setIsCanvasOpen(false)}
        onSave={handleSaveDrawing}
        isSaving={isSaving}
      />

      <ConfirmModal
        isOpen={deleteModal.isOpen}
        title="Delete Drawing"
        message={`Are you sure you want to delete "${deleteModal.title}"? This cannot be undone.`}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  );
}

export default TaskDrawings;
