import { useEffect, useState } from 'react';
import styles from './TaskChecklist.module.css';
import { taskAPI } from '../../services/api';

function TaskChecklist({ taskId, initialCount = 0, initialCompletedCount = 0, onSubtaskUpdated }) {
  const [subtasks, setSubtasks] = useState([]);
  const [completedCount, setCompletedCount] = useState(initialCompletedCount);
  const [totalCount, setTotalCount] = useState(initialCount);
  const [newItem, setNewItem] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState('');
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    setTotalCount(initialCount);
    setCompletedCount(initialCompletedCount);
  }, [initialCount, initialCompletedCount, taskId]);

  const loadSubtasks = async () => {
    try {
      setIsLoading(true);
      setError('');
      const response = await taskAPI.getSubtasks(taskId);
      const items = response.data.subtasks || [];
      setSubtasks(items);
      setTotalCount(items.length);
      setCompletedCount(items.filter((item) => item.is_completed).length);
      setHasLoaded(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load checklist');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSubtasks();
  }, [taskId]);

  const handleToggleExpanded = async () => {
    const next = !isExpanded;
    setIsExpanded(next);
    if (next && !hasLoaded) {
      await loadSubtasks();
    }
  };

  const handleAdd = async (event) => {
    event.preventDefault();
    if (!newItem.trim() || isSubmitting) {
      return;
    }

    const title = newItem.trim();
    setNewItem('');

    try {
      setIsSubmitting(true);
      setError('');
      const response = await taskAPI.addSubtask(taskId, title);
      setSubtasks((prev) => [...prev, response.data.subtask]);
      setTotalCount((prev) => prev + 1);
      onSubtaskUpdated?.(response.data.task);
    } catch (err) {
      setNewItem(title);
      setError(err.response?.data?.message || 'Failed to add checklist item');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleComplete = async (subtask) => {
    if (updatingId) {
      return;
    }

    try {
      setUpdatingId(subtask.id);
      setError('');
      const response = await taskAPI.updateSubtask(taskId, subtask.id, {
        is_completed: !subtask.is_completed
      });
      setSubtasks((prev) =>
        prev.map((item) => (item.id === subtask.id ? response.data.subtask : item))
      );
      setCompletedCount((prev) => prev + (response.data.subtask.is_completed ? 1 : -1));
      onSubtaskUpdated?.(response.data.task);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update checklist item');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (subtaskId) => {
    if (updatingId) {
      return;
    }

    try {
      setUpdatingId(subtaskId);
      setError('');
      const response = await taskAPI.deleteSubtask(taskId, subtaskId);
      const removed = subtasks.find((item) => item.id === subtaskId);
      setSubtasks((prev) => prev.filter((item) => item.id !== subtaskId));
      setTotalCount((prev) => Math.max(0, prev - 1));
      if (removed?.is_completed) {
        setCompletedCount((prev) => Math.max(0, prev - 1));
      }
      onSubtaskUpdated?.(response.data.task);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete checklist item');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className={styles.checklist}>
      <button
        type="button"
        className={styles.toggleButton}
        onClick={handleToggleExpanded}
        aria-expanded={isExpanded}
      >
        <span>
          Checklist ({completedCount}/{totalCount})
        </span>
        <span className={`${styles.expandArrow} ${isExpanded ? styles.expanded : ''}`}>▼</span>
      </button>

      {isExpanded && (
        <div className={styles.body}>
          {isLoading ? (
            <p className={styles.statusText}>Loading checklist...</p>
          ) : subtasks.length === 0 ? (
            <p className={styles.statusText}>No checklist items yet. Break this task into steps.</p>
          ) : (
            <ul className={styles.itemList}>
              {subtasks.map((subtask) => (
                <li key={subtask.id} className={styles.item}>
                  <label className={styles.itemLabel}>
                    <input
                      type="checkbox"
                      checked={subtask.is_completed}
                      disabled={updatingId === subtask.id}
                      onChange={() => handleToggleComplete(subtask)}
                    />
                    <span className={subtask.is_completed ? styles.itemTitleDone : styles.itemTitle}>
                      {subtask.title}
                    </span>
                  </label>
                  <button
                    type="button"
                    className={styles.deleteButton}
                    onClick={() => handleDelete(subtask.id)}
                    disabled={updatingId === subtask.id}
                    aria-label={`Delete ${subtask.title}`}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          {error && <div className={styles.errorMessage}>{error}</div>}

          <form className={styles.addForm} onSubmit={handleAdd}>
            <input
              type="text"
              className={styles.addInput}
              placeholder="Add a step..."
              value={newItem}
              onChange={(event) => setNewItem(event.target.value)}
              disabled={isSubmitting}
              maxLength={255}
            />
            <button
              type="submit"
              className={styles.addButton}
              disabled={!newItem.trim() || isSubmitting}
            >
              {isSubmitting ? '...' : 'Add'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default TaskChecklist;
