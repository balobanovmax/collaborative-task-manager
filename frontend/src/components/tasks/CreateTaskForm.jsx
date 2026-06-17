import { useState } from 'react';
import styles from './CreateTaskForm.module.css';
import { taskAPI } from '../../services/api';

function CreateTaskForm({ groupId, members = [], onSuccess, onCancel }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    try {
      if (!title.trim()) {
        setErrorMessage('Title is required');
        setIsLoading(false);
        return;
      }

      if (title.trim().length > 255) {
        setErrorMessage('Title cannot exceed 255 characters');
        setIsLoading(false);
        return;
      }

      if (description.length > 5000) {
        setErrorMessage('Description cannot exceed 5000 characters');
        setIsLoading(false);
        return;
      }

      await taskAPI.createTask(
        groupId,
        title.trim(),
        description.trim() || null,
        dueDate || null,
        assignedTo ? parseInt(assignedTo, 10) : null
      );

      onSuccess();
    } catch (error) {
      setIsLoading(false);
      if (error.response && error.response.data && error.response.data.message) {
        setErrorMessage(error.response.data.message);
      } else {
        setErrorMessage('Failed to create task. Please try again.');
      }
    }
  };

  return (
    <div className={styles.formContainer}>
      <h2 className={styles.formTitle}>Create Task</h2>

      {errorMessage && (
        <div className={styles.errorMessage}>
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Title</label>
          <input
            type="text"
            className={styles.formInput}
            placeholder="Enter task title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            disabled={isLoading}
            maxLength={255}
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Description (optional)</label>
          <textarea
            className={styles.formTextarea}
            placeholder="Enter task description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isLoading}
            rows={4}
            maxLength={5000}
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Assign To (optional)</label>
          <select
            className={styles.formInput}
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            disabled={isLoading}
          >
            <option value="">Unassigned</option>
            {members.map((member) => (
              <option key={member.user_id} value={member.user_id}>
                {member.username}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Due Date (optional)</label>
          <input
            type="date"
            className={styles.formInput}
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            disabled={isLoading}
            min={getTodayDate()}
          />
        </div>

        <div className={styles.buttonGroup}>
          <button type="submit" className={styles.btnPrimary} disabled={isLoading}>
            {isLoading ? 'Creating...' : 'Create Task'}
          </button>
          <button 
            type="button" 
            className={styles.btnSecondary} 
            onClick={onCancel} 
            disabled={isLoading}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export default CreateTaskForm;

