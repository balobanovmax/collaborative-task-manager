import styles from './TaskInlineActions.module.css';

function TaskInlineActions({ onEdit, onDelete, disabled = false }) {
  return (
    <div className={styles.actions}>
      <button
        type="button"
        className={styles.editButton}
        onClick={onEdit}
        onMouseDown={(event) => event.stopPropagation()}
        disabled={disabled}
      >
        Edit
      </button>
      <button
        type="button"
        className={styles.deleteButton}
        onClick={onDelete}
        onMouseDown={(event) => event.stopPropagation()}
        disabled={disabled}
      >
        Delete
      </button>
    </div>
  );
}

export default TaskInlineActions;
