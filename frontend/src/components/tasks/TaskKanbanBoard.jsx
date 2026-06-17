import { useState } from 'react';
import styles from './TaskKanbanBoard.module.css';
import UserAvatar from '../common/UserAvatar';
import { getTaskStatus, getStatusLabel, TASK_STATUSES } from '../../utils/taskStatus';

function TaskKanbanBoard({ tasks, onStatusChange, getTaskAssignee, isUpdating = false }) {
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);

  const tasksByStatus = TASK_STATUSES.reduce((acc, status) => {
    acc[status] = tasks.filter((task) => getTaskStatus(task) === status);
    return acc;
  }, {});

  const handleDragStart = (event, taskId) => {
    setDraggedTaskId(taskId);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(taskId));
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (event, status) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverColumn(status);
  };

  const handleDragLeave = (status) => {
    if (dragOverColumn === status) {
      setDragOverColumn(null);
    }
  };

  const handleDrop = (event, status) => {
    event.preventDefault();
    const taskId = parseInt(event.dataTransfer.getData('text/plain'), 10);
    setDraggedTaskId(null);
    setDragOverColumn(null);

    if (!taskId) {
      return;
    }

    const task = tasks.find((entry) => entry.id === taskId);
    if (task && getTaskStatus(task) !== status) {
      onStatusChange(taskId, status);
    }
  };

  return (
    <div className={styles.board}>
      {TASK_STATUSES.map((status) => (
        <div
          key={status}
          className={`${styles.column} ${dragOverColumn === status ? styles.columnDragOver : ''}`}
          onDragOver={(event) => handleDragOver(event, status)}
          onDragLeave={() => handleDragLeave(status)}
          onDrop={(event) => handleDrop(event, status)}
        >
          <div className={styles.columnHeader}>
            <h3 className={styles.columnTitle}>{getStatusLabel(status)}</h3>
            <span className={styles.columnCount}>{tasksByStatus[status].length}</span>
          </div>

          <div className={styles.columnBody}>
            {tasksByStatus[status].length === 0 ? (
              <p className={styles.emptyColumn}>Drop tasks here</p>
            ) : (
              tasksByStatus[status].map((task) => {
                const assignee = getTaskAssignee(task);
                return (
                  <article
                    key={task.id}
                    className={`${styles.card} ${draggedTaskId === task.id ? styles.cardDragging : ''}`}
                    draggable={!isUpdating}
                    onDragStart={(event) => handleDragStart(event, task.id)}
                    onDragEnd={handleDragEnd}
                  >
                    <h4 className={styles.cardTitle}>{task.title}</h4>
                    {task.description && (
                      <p className={styles.cardDescription}>{task.description}</p>
                    )}
                    <div className={styles.cardFooter}>
                      {assignee ? (
                        <div className={styles.assignee}>
                          <UserAvatar
                            username={assignee.username}
                            profilePictureUrl={assignee.profile_picture_url}
                            size="sm"
                          />
                          <span>{assignee.username}</span>
                        </div>
                      ) : (
                        <span className={styles.unassigned}>Unassigned</span>
                      )}
                      {task.due_date && (
                        <span className={styles.dueDate}>
                          Due {new Date(task.due_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default TaskKanbanBoard;
