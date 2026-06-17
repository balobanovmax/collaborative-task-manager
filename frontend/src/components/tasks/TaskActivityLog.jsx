import { useEffect, useState } from 'react';
import styles from './TaskActivityLog.module.css';
import { taskAPI } from '../../services/api';

function TaskActivityLog({ taskId }) {
  const [activity, setActivity] = useState([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasLoaded, setHasLoaded] = useState(false);

  const loadActivity = async () => {
    try {
      setIsLoading(true);
      setError('');
      const response = await taskAPI.getTaskActivity(taskId);
      setActivity(response.data.activity || []);
      setHasLoaded(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load activity');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setActivity([]);
    setHasLoaded(false);
    setIsExpanded(false);
  }, [taskId]);

  const handleToggle = async () => {
    const next = !isExpanded;
    setIsExpanded(next);
    if (next && !hasLoaded) {
      await loadActivity();
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
    <div className={styles.log}>
      <button
        type="button"
        className={styles.toggleButton}
        onClick={handleToggle}
        aria-expanded={isExpanded}
      >
        <span>Activity{hasLoaded ? ` (${activity.length})` : ''}</span>
        <span className={`${styles.expandArrow} ${isExpanded ? styles.expanded : ''}`}>▼</span>
      </button>

      {isExpanded && (
        <div className={styles.body}>
          {isLoading ? (
            <p className={styles.statusText}>Loading activity...</p>
          ) : error ? (
            <div className={styles.errorMessage}>{error}</div>
          ) : activity.length === 0 ? (
            <p className={styles.statusText}>No activity recorded yet.</p>
          ) : (
            <ul className={styles.activityList}>
              {activity.map((entry) => (
                <li key={entry.id} className={styles.activityItem}>
                  <div className={styles.activityHeader}>
                    <span className={styles.activityUser}>{entry.username}</span>
                    <span className={styles.activityTime}>{formatTime(entry.created_at)}</span>
                  </div>
                  <p className={styles.activityDetail}>{entry.detail}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default TaskActivityLog;
