import { useEffect, useState } from 'react';
import styles from './TaskQuickActionModal.module.css';
import EditTaskForm from './EditTaskForm';
import DeleteTaskForm from './DeleteTaskForm';
import { groupAPI } from '../../services/api';

function TaskQuickActionModal({
  isOpen,
  mode,
  task,
  members: providedMembers = null,
  onClose,
  onSuccess
}) {
  const [members, setMembers] = useState(providedMembers || []);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

  useEffect(() => {
    if (!isOpen || mode !== 'edit' || !task?.group_id) {
      return;
    }

    if (providedMembers?.length) {
      setMembers(providedMembers);
      return;
    }

    let cancelled = false;

    const loadMembers = async () => {
      try {
        setIsLoadingMembers(true);
        const response = await groupAPI.getGroupMembers(task.group_id);
        if (!cancelled) {
          setMembers(response.data.members || []);
        }
      } catch (error) {
        if (!cancelled) {
          setMembers([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingMembers(false);
        }
      }
    };

    loadMembers();

    return () => {
      cancelled = true;
    };
  }, [isOpen, mode, task?.group_id, providedMembers]);

  if (!isOpen || !task || !mode) {
    return null;
  }

  const handleSuccess = () => {
    onSuccess?.();
    onClose();
  };

  const title = mode === 'edit' ? 'Edit Task' : 'Delete Task';

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.panel}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-quick-action-title"
      >
        <div className={styles.panelHeader}>
          <h2 id="task-quick-action-title" className={styles.panelTitle}>
            {title}
          </h2>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className={styles.panelBody}>
          {mode === 'edit' && isLoadingMembers && !members.length ? (
            <p className={styles.loadingMessage}>Loading task form...</p>
          ) : null}

          {mode === 'edit' && (!isLoadingMembers || members.length > 0) ? (
            <EditTaskForm
              tasks={[task]}
              members={members}
              initialTask={task}
              hideTitle
              onSuccess={handleSuccess}
              onCancel={onClose}
            />
          ) : null}

          {mode === 'delete' ? (
            <DeleteTaskForm
              tasks={[task]}
              initialTask={task}
              hideTitle
              onSuccess={handleSuccess}
              onCancel={onClose}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default TaskQuickActionModal;
