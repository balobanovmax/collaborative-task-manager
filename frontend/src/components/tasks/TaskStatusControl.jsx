import styles from './TaskStatusControl.module.css';
import {
  getTaskStatus,
  getNextStatus,
  getStatusLabel
} from '../../utils/taskStatus';

function TaskStatusControl({ task, onStatusChange, disabled = false, compact = false }) {
  const status = getTaskStatus(task);

  const handleClick = () => {
    if (disabled) {
      return;
    }
    onStatusChange(task.id, getNextStatus(status));
  };

  return (
    <button
      type="button"
      className={`${styles.statusButton} ${styles[status]} ${compact ? styles.compact : ''}`}
      onClick={handleClick}
      disabled={disabled}
      title={`Status: ${getStatusLabel(status)}. Click to change.`}
    >
      {getStatusLabel(status)}
    </button>
  );
}

export default TaskStatusControl;
