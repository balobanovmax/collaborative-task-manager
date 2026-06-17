import styles from './TaskPriorityBadge.module.css';
import { getTaskPriority, getPriorityLabel, getNextPriority } from '../../utils/taskPriority';

function TaskPriorityBadge({
  task,
  onPriorityChange,
  disabled = false,
  compact = false
}) {
  const priority = getTaskPriority(task);

  const handleClick = (event) => {
    event.stopPropagation();
    if (disabled || !onPriorityChange) {
      return;
    }
    onPriorityChange(task.id, getNextPriority(priority));
  };

  const className = `${styles.badge} ${styles[priority]} ${compact ? styles.compact : ''}`;

  if (!onPriorityChange) {
    return (
      <span className={className} title={`Priority: ${getPriorityLabel(priority)}`}>
        {getPriorityLabel(priority)}
      </span>
    );
  }

  return (
    <button
      type="button"
      className={`${className} ${styles.clickable}`}
      onClick={handleClick}
      disabled={disabled}
      title={`Priority: ${getPriorityLabel(priority)}. Click to change.`}
    >
      {getPriorityLabel(priority)}
    </button>
  );
}

export default TaskPriorityBadge;
