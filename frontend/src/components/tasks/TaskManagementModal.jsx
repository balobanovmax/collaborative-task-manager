import { useState } from 'react';
import styles from './TaskManagementModal.module.css';
import CreateTaskForm from './CreateTaskForm';
import EditTaskForm from './EditTaskForm';
import DeleteTaskForm from './DeleteTaskForm';
import ToggleTaskForm from './ToggleTaskForm';

function TaskManagementModal({ isOpen, onClose, groupId, tasks, members, onTaskUpdated }) {
  const [selectedOperation, setSelectedOperation] = useState(null);

  if (!isOpen) return null;

  const handleClose = () => {
    setSelectedOperation(null);
    onClose();
  };

  const handleSuccess = () => {
    setSelectedOperation(null);
    onTaskUpdated();
  };

  const renderContent = () => {
    if (!selectedOperation) {
      return (
        <div className={styles.menuContainer}>
          <h2 className={styles.modalTitle}>Manage Tasks</h2>
          <p className={styles.modalSubtitle}>Select an operation</p>
          <div className={styles.operationList}>
            <button 
              className={styles.operationButton}
              onClick={() => setSelectedOperation('create')}
            >
              Create Task
            </button>
            <button 
              className={styles.operationButton}
              onClick={() => setSelectedOperation('edit')}
              disabled={tasks.length === 0}
            >
              Edit Task
            </button>
            <button 
              className={styles.operationButton}
              onClick={() => setSelectedOperation('delete')}
              disabled={tasks.length === 0}
            >
              Delete Task
            </button>
            <button 
              className={styles.operationButton}
              onClick={() => setSelectedOperation('toggle')}
              disabled={tasks.length === 0}
            >
              Update Status
            </button>
          </div>
          <button className={styles.cancelButton} onClick={handleClose}>
            Cancel
          </button>
        </div>
      );
    }

    switch (selectedOperation) {
      case 'create':
        return (
          <CreateTaskForm 
            groupId={groupId}
            members={members}
            onSuccess={handleSuccess}
            onCancel={() => setSelectedOperation(null)}
          />
        );
      case 'edit':
        return (
          <EditTaskForm 
            tasks={tasks}
            members={members}
            onSuccess={handleSuccess}
            onCancel={() => setSelectedOperation(null)}
          />
        );
      case 'delete':
        return (
          <DeleteTaskForm 
            tasks={tasks}
            onSuccess={handleSuccess}
            onCancel={() => setSelectedOperation(null)}
          />
        );
      case 'toggle':
        return (
          <ToggleTaskForm 
            tasks={tasks}
            onSuccess={handleSuccess}
            onCancel={() => setSelectedOperation(null)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={handleClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        {renderContent()}
      </div>
    </div>
  );
}

export default TaskManagementModal;

