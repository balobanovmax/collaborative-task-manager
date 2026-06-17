import { useState } from 'react';
import styles from './ToggleTaskForm.module.css';
import { taskAPI } from '../../services/api';
import { getTaskStatus, getNextStatus, getStatusLabel } from '../../utils/taskStatus';
import TaskStatusControl from './TaskStatusControl';

function ToggleTaskForm({ tasks, onSuccess, onCancel }) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleStatusChange = async (taskId, nextStatus) => {
    setErrorMessage('');
    setIsLoading(true);

    try {
      await taskAPI.updateTaskStatus(taskId, nextStatus);
      onSuccess();
    } catch (error) {
      setIsLoading(false);
      if (error.response && error.response.data && error.response.data.message) {
        setErrorMessage(error.response.data.message);
      } else {
        setErrorMessage('Failed to update task status. Please try again.');
      }
    }
  };

  return (
    <div className={styles.formContainer}>
      <h2 className={styles.formTitle}>Update Task Status</h2>
      <p className={styles.formSubtitle}>Click a status badge to cycle To Do → Doing → Done</p>

      {errorMessage && (
        <div className={styles.errorMessage}>
          {errorMessage}
        </div>
      )}

      <div className={styles.taskList}>
        {tasks.map((task) => (
          <div key={task.id} className={styles.taskItem}>
            <div className={styles.taskItemHeader}>
              <h3 className={styles.taskItemTitle}>{task.title}</h3>
              <TaskStatusControl
                task={task}
                onStatusChange={handleStatusChange}
                disabled={isLoading}
              />
            </div>
            {task.description && (
              <p className={styles.taskItemDescription}>{task.description}</p>
            )}
            {task.due_date && (
              <p className={styles.taskItemMeta}>
                Due: {new Date(task.due_date).toLocaleDateString()}
              </p>
            )}
            <p className={styles.taskItemMeta}>
              Current: {getStatusLabel(getTaskStatus(task))} · Next: {getStatusLabel(getNextStatus(getTaskStatus(task)))}
            </p>
          </div>
        ))}
      </div>

      <div className={styles.buttonGroup}>
        <button 
          type="button" 
          className={styles.btnSecondary} 
          onClick={onCancel} 
          disabled={isLoading}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default ToggleTaskForm;
