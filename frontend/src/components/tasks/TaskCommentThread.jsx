import { useState, useEffect, useRef } from 'react';
import styles from './TaskCommentThread.module.css';
import { taskAPI } from '../../services/api';
import { onTaskCommentCreated } from '../../services/socket';
import { getUser } from '../../utils/auth';
import UserAvatar from '../common/UserAvatar';

function TaskCommentThread({ taskId, groupId, initialCount = 0, onCommentAdded }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentCount, setCommentCount] = useState(initialCount);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const currentUser = getUser();
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    setCommentCount(initialCount);
  }, [initialCount, taskId]);

  useEffect(() => {
    if (!isExpanded) {
      return undefined;
    }

    const unsubscribe = onTaskCommentCreated((data) => {
      if (Number(data.taskId) !== Number(taskId)) {
        return;
      }

      setComments((prev) => {
        const exists = prev.some((comment) => comment.id === data.comment.id);
        if (exists) {
          return prev;
        }

        setCommentCount((count) => count + 1);
        return [...prev, data.comment];
      });
    });

    return unsubscribe;
  }, [isExpanded, taskId, currentUser?.id]);

  const loadComments = async () => {
    try {
      setIsLoading(true);
      setError('');
      const response = await taskAPI.getComments(taskId);
      setComments(response.data.comments || []);
      setCommentCount(response.data.comments?.length || 0);
      hasLoadedRef.current = true;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load comments');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = async () => {
    const nextExpanded = !isExpanded;
    setIsExpanded(nextExpanded);

    if (nextExpanded && !hasLoadedRef.current) {
      await loadComments();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmitting) {
      return;
    }

    const content = newComment.trim();
    setNewComment('');

    try {
      setIsSubmitting(true);
      setError('');
      const response = await taskAPI.addComment(taskId, content);
      const createdComment = response.data.comment;

      setComments((prev) => {
        const exists = prev.some((comment) => comment.id === createdComment.id);
        if (exists) {
          return prev;
        }
        return [...prev, createdComment];
      });
      setCommentCount((prev) => prev + 1);
      onCommentAdded?.(taskId);
    } catch (err) {
      setNewComment(content);
      setError(err.response?.data?.message || 'Failed to add comment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className={styles.thread}>
      <button
        type="button"
        className={styles.toggleButton}
        onClick={handleToggle}
        aria-expanded={isExpanded}
      >
        <span>Comments ({commentCount})</span>
        <span className={`${styles.expandArrow} ${isExpanded ? styles.expanded : ''}`}>▼</span>
      </button>

      {isExpanded && (
        <div className={styles.threadBody}>
          {isLoading ? (
            <p className={styles.statusText}>Loading comments...</p>
          ) : comments.length === 0 ? (
            <p className={styles.statusText}>No comments yet. Start the thread.</p>
          ) : (
            <div className={styles.commentList}>
              {comments.map((comment) => {
                const isOwn = Number(comment.user_id) === Number(currentUser?.id);
                return (
                  <div
                    key={comment.id}
                    className={`${styles.commentItem} ${isOwn ? styles.ownComment : ''}`}
                  >
                    <UserAvatar
                      username={comment.username}
                      profilePictureUrl={comment.profile_picture_url}
                      size="sm"
                    />
                    <div className={styles.commentContent}>
                      <div className={styles.commentHeader}>
                        <span className={styles.commentAuthor}>{comment.username}</span>
                        <span className={styles.commentTime}>{formatTime(comment.created_at)}</span>
                      </div>
                      <p className={styles.commentText}>{comment.content}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {error && <div className={styles.errorMessage}>{error}</div>}

          <form className={styles.commentForm} onSubmit={handleSubmit}>
            <input
              type="text"
              className={styles.commentInput}
              placeholder='Add a comment... e.g. "Blocked on API key"'
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              disabled={isSubmitting}
              maxLength={2000}
            />
            <button
              type="submit"
              className={styles.commentSubmit}
              disabled={!newComment.trim() || isSubmitting}
            >
              {isSubmitting ? '...' : 'Post'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default TaskCommentThread;
