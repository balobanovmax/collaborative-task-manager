import { useState } from 'react';
import styles from './ToggleTaskForm.module.css';
import { taskAPI } from '../../services/api';

function ToggleTaskForm({ tasks, onSuccess, onCancel }) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleToggle = async (taskId) => {
    setErrorMessage('');
    setIsLoading(true);

    try {
      await taskAPI.toggleTaskCompletion(taskId);
      onSuccess();
    } catch (error) {
      setIsLoading(false);
      if (error.response && error.response.data && error.response.data.message) {
        setErrorMessage(error.response.data.message);
      } else {
        setErrorMessage('Failed to toggle task completion. Please try again.');
      }
    }
  };

  return (
    <div className={styles.formContainer}>
      <h2 className={styles.formTitle}>Toggle Task Completion</h2>
      <p className={styles.formSubtitle}>Click on a task to toggle its status</p>

      {errorMessage && (
        <div className={styles.errorMessage}>
          {errorMessage}
        </div>
      )}

      <div className={styles.taskList}>
        {tasks.map((task) => (
          <div 
            key={task.id} 
            className={styles.taskItem}
            onClick={() => !isLoading && handleToggle(task.id)}
          >
            <div className={styles.taskItemHeader}>
              <h3 className={styles.taskItemTitle}>{task.title}</h3>
              <span className={`${styles.statusBadge} ${task.is_completed ? styles.completed : styles.pending}`}>
                {task.is_completed ? 'Completed' : 'Pending'}
              </span>
            </div>
            {task.description && (
              <p className={styles.taskItemDescription}>{task.description}</p>
            )}
            {task.due_date && (
              <p className={styles.taskItemMeta}>
                Due: {new Date(task.due_date).toLocaleDateString()}
              </p>
            )}
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

