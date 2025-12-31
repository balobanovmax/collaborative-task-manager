import { useState } from 'react';
import styles from './DeleteTaskForm.module.css';
import { taskAPI } from '../../services/api';

function DeleteTaskForm({ tasks, onSuccess, onCancel }) {
  const [selectedTask, setSelectedTask] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleTaskSelect = (task) => {
    setSelectedTask(task);
  };

  const handleDelete = async () => {
    setErrorMessage('');
    setIsLoading(true);

    try {
      await taskAPI.deleteTask(selectedTask.id);
      onSuccess();
    } catch (error) {
      setIsLoading(false);
      if (error.response && error.response.data && error.response.data.message) {
        setErrorMessage(error.response.data.message);
      } else {
        setErrorMessage('Failed to delete task. Please try again.');
      }
    }
  };

  const handleBack = () => {
    setSelectedTask(null);
    setErrorMessage('');
  };

  if (selectedTask) {
    return (
      <div className={styles.formContainer}>
        <h2 className={styles.formTitle}>Delete Task</h2>

        {errorMessage && (
          <div className={styles.errorMessage}>
            {errorMessage}
          </div>
        )}

        <div className={styles.taskPreview}>
          <h3 className={styles.previewTitle}>Task Details</h3>
          <div className={styles.previewContent}>
            <p className={styles.previewLabel}>Title:</p>
            <p className={styles.previewValue}>{selectedTask.title}</p>
            {selectedTask.description && (
              <>
                <p className={styles.previewLabel}>Description:</p>
                <p className={styles.previewValue}>{selectedTask.description}</p>
              </>
            )}
            {selectedTask.due_date && (
              <>
                <p className={styles.previewLabel}>Due Date:</p>
                <p className={styles.previewValue}>
                  {new Date(selectedTask.due_date).toLocaleDateString()}
                </p>
              </>
            )}
          </div>
          <p className={styles.warningText}>
            This action cannot be undone.
          </p>
        </div>

        <div className={styles.buttonGroup}>
          <button 
            type="button" 
            className={styles.btnSecondary} 
            onClick={handleBack} 
            disabled={isLoading}
          >
            Back
          </button>
          <button 
            type="button" 
            className={styles.btnDanger} 
            onClick={handleDelete}
            disabled={isLoading}
          >
            {isLoading ? 'Deleting...' : 'Delete Task'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.formContainer}>
      <h2 className={styles.formTitle}>Delete Task</h2>
      <p className={styles.formSubtitle}>Select a task to delete</p>

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
            onClick={() => handleTaskSelect(task)}
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
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default DeleteTaskForm;

