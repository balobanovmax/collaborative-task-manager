import { useState, useEffect, useRef } from 'react';
import styles from './TaskCommentThread.module.css';
import { taskAPI } from '../../services/api';
import { onTaskCommentCreated } from '../../services/socket';
import { getUser } from '../../utils/auth';
import UserAvatar from '../common/UserAvatar';
import {
  renderMessageWithMentions,
  getMentionQueryAtCursor,
  insertMention
} from '../../utils/renderMentions';

function TaskCommentThread({ taskId, groupId, members = [], initialCount = 0, onCommentAdded }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentCount, setCommentCount] = useState(initialCount);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [mentionQuery, setMentionQuery] = useState(null);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const currentUser = getUser();
  const hasLoadedRef = useRef(false);
  const inputRef = useRef(null);

  const mentionSuggestions = mentionQuery === null
    ? []
    : members.filter((member) =>
        member.username.toLowerCase().startsWith(mentionQuery.toLowerCase())
      );

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

  const applyMention = (username) => {
    const input = inputRef.current;
    const cursorPosition = input?.selectionStart ?? newComment.length;
    const { nextValue, nextCursor } = insertMention(newComment, cursorPosition, username);
    setNewComment(nextValue);
    setMentionQuery(null);
    setActiveSuggestionIndex(0);

    requestAnimationFrame(() => {
      if (input) {
        input.focus();
        input.setSelectionRange(nextCursor, nextCursor);
      }
    });
  };

  const handleCommentChange = (event) => {
    const { value } = event.target;
    setNewComment(value);
    const query = getMentionQueryAtCursor(value, event.target.selectionStart);
    setMentionQuery(query);
    setActiveSuggestionIndex(0);
  };

  const handleCommentKeyDown = (event) => {
    if (!mentionSuggestions.length) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveSuggestionIndex((prev) =>
        prev + 1 >= mentionSuggestions.length ? 0 : prev + 1
      );
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveSuggestionIndex((prev) =>
        prev - 1 < 0 ? mentionSuggestions.length - 1 : prev - 1
      );
    } else if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      applyMention(mentionSuggestions[activeSuggestionIndex].username);
    } else if (event.key === 'Escape') {
      setMentionQuery(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmitting) {
      return;
    }

    const content = newComment.trim();
    setNewComment('');
    setMentionQuery(null);

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

  const commentMentionsCurrentUser = (comment) =>
    (comment.mentions || []).some(
      (mention) => Number(mention.user_id) === Number(currentUser?.id)
    );

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
                const mentionsYou = commentMentionsCurrentUser(comment);
                return (
                  <div
                    key={comment.id}
                    className={`${styles.commentItem} ${isOwn ? styles.ownComment : ''} ${mentionsYou ? styles.mentionedComment : ''}`}
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
                      {mentionsYou && !isOwn && (
                        <div className={styles.mentionedYouLabel}>mentioned you</div>
                      )}
                      <p className={styles.commentText}>
                        {renderMessageWithMentions(
                          comment.content,
                          comment.mentions,
                          currentUser?.id,
                          styles.mention,
                          styles.mentionSelf
                        )}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {error && <div className={styles.errorMessage}>{error}</div>}

          <form className={styles.commentForm} onSubmit={handleSubmit}>
            <div className={styles.inputWrapper}>
              {mentionSuggestions.length > 0 && (
                <div className={styles.mentionSuggestions}>
                  {mentionSuggestions.map((member, index) => (
                    <button
                      key={member.user_id}
                      type="button"
                      className={`${styles.mentionSuggestion} ${index === activeSuggestionIndex ? styles.mentionSuggestionActive : ''}`}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        applyMention(member.username);
                      }}
                    >
                      @{member.username}
                    </button>
                  ))}
                </div>
              )}
              <input
                ref={inputRef}
                type="text"
                className={styles.commentInput}
                placeholder='Add a comment... use @username to mention'
                value={newComment}
                onChange={handleCommentChange}
                onKeyDown={handleCommentKeyDown}
                disabled={isSubmitting}
                maxLength={2000}
              />
            </div>
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
