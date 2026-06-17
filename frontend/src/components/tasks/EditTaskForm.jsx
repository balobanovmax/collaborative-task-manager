import { useState } from 'react';
import styles from './EditTaskForm.module.css';
import { taskAPI } from '../../services/api';
import { getTaskStatus, getStatusLabel } from '../../utils/taskStatus';
import { TASK_PRIORITIES, getPriorityLabel, getTaskPriority } from '../../utils/taskPriority';

function EditTaskForm({ tasks, members = [], onSuccess, onCancel }) {
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [priority, setPriority] = useState('medium');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleTaskSelect = (task) => {
    setSelectedTaskId(task.id);
    setTitle(task.title || '');
    setDescription(task.description || '');
    if (task.due_date) {
      const date = new Date(task.due_date);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      setDueDate(`${year}-${month}-${day}`);
    } else {
      setDueDate('');
    }
    setAssignedTo(task.assigned_to ? String(task.assigned_to) : '');
    setPriority(getTaskPriority(task));
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

      await taskAPI.updateTask(selectedTaskId, {
        title: title.trim(),
        description: description.trim() || null,
        due_date: dueDate || null,
        assigned_to: assignedTo ? parseInt(assignedTo, 10) : null,
        priority
      });

      onSuccess();
    } catch (error) {
      setIsLoading(false);
      if (error.response && error.response.data && error.response.data.message) {
        setErrorMessage(error.response.data.message);
      } else {
        setErrorMessage('Failed to update task. Please try again.');
      }
    }
  };

  const handleBack = () => {
    setSelectedTaskId(null);
    setTitle('');
    setDescription('');
    setDueDate('');
    setAssignedTo('');
    setPriority('medium');
    setErrorMessage('');
  };

  if (selectedTaskId) {
    return (
      <div className={styles.formContainer}>
        <h2 className={styles.formTitle}>Edit Task</h2>

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
            <label className={styles.formLabel}>Assign To</label>
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
            <label className={styles.formLabel}>Priority</label>
            <select
              className={styles.formInput}
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              disabled={isLoading}
            >
              {TASK_PRIORITIES.map((level) => (
                <option key={level} value={level}>{getPriorityLabel(level)}</option>
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
            />
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
              type="submit" 
              className={styles.btnPrimary} 
              disabled={isLoading}
            >
              {isLoading ? 'Updating...' : 'Update Task'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className={styles.formContainer}>
      <h2 className={styles.formTitle}>Edit Task</h2>
      <p className={styles.formSubtitle}>Select a task to edit</p>

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
              <span className={`${styles.statusBadge} ${styles[getTaskStatus(task)]}`}>
                {getStatusLabel(getTaskStatus(task))}
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
            <p className={styles.taskItemMeta}>
              Assigned to: {task.assignee?.username || task.assignee_username || 'Unassigned'}
            </p>
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

export default EditTaskForm;

