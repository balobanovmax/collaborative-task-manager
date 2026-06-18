import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styles from './MyTasks.module.css';
import Navbar from '../components/common/Navbar';
import TaskStatusControl from '../components/tasks/TaskStatusControl';
import TaskPriorityBadge from '../components/tasks/TaskPriorityBadge';
import TaskFiltersBar from '../components/tasks/TaskFiltersBar';
import TaskInlineActions from '../components/tasks/TaskInlineActions';
import TaskQuickActionModal from '../components/tasks/TaskQuickActionModal';
import { taskAPI } from '../services/api';
import {
  getTaskStatus,
  isTaskDueToday,
  isTaskOverdue
} from '../utils/taskStatus';
import { getTaskPriority } from '../utils/taskPriority';
import { DEFAULT_TASK_FILTERS } from '../utils/taskFilters';

function MyTasks() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [summary, setSummary] = useState({ total_tasks: 0, overdue_tasks: 0 });
  const [includeDone, setIncludeDone] = useState(false);
  const [filters, setFilters] = useState(DEFAULT_TASK_FILTERS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [taskQuickAction, setTaskQuickAction] = useState({ mode: null, task: null });

  const fetchMyTasks = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');
      const response = await taskAPI.getMyTasks({
        includeDone,
        sortBy: 'due_date',
        sortOrder: 'ASC',
        search: filters.search,
        status: filters.status,
        priority: filters.priority,
        dueFrom: filters.dueFrom,
        dueTo: filters.dueTo,
        overdueOnly: filters.overdueOnly
      });
      setTasks(response.data.tasks || []);
      setSummary(response.data.summary || { total_tasks: 0, overdue_tasks: 0 });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load your tasks');
    } finally {
      setIsLoading(false);
    }
  }, [includeDone, filters]);

  useEffect(() => {
    fetchMyTasks();
  }, [fetchMyTasks]);

  const handleStatusChange = async (taskId, nextStatus) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task || getTaskStatus(task) === nextStatus || isUpdatingStatus) {
      return;
    }

    try {
      setIsUpdatingStatus(true);
      const response = await taskAPI.updateTaskStatus(taskId, nextStatus);
      const updatedTask = response.data.task;

      if (!includeDone && nextStatus === 'done') {
        setTasks((prev) => prev.filter((item) => item.id !== taskId));
        setSummary((prev) => ({
          total_tasks: Math.max(0, prev.total_tasks - 1),
          overdue_tasks: isTaskOverdue(task) ? Math.max(0, prev.overdue_tasks - 1) : prev.overdue_tasks
        }));
      } else {
        setTasks((prev) => prev.map((item) => (item.id === taskId ? updatedTask : item)));
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update task status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handlePriorityChange = async (taskId, nextPriority) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task || getTaskPriority(task) === nextPriority || isUpdatingStatus) {
      return;
    }

    try {
      setIsUpdatingStatus(true);
      const response = await taskAPI.updateTask(taskId, { priority: nextPriority });
      const updatedTask = response.data.task;
      setTasks((prev) => prev.map((item) => (item.id === taskId ? updatedTask : item)));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update task priority');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const formatDueDate = (dueDate) => {
    if (!dueDate) {
      return 'No due date';
    }

    return new Date(dueDate).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getDueClassName = (task) => {
    if (isTaskOverdue(task)) {
      return styles.dueOverdue;
    }
    if (isTaskDueToday(task)) {
      return styles.dueToday;
    }
    return '';
  };

  const openTaskEdit = (task) => {
    setTaskQuickAction({ mode: 'edit', task });
  };

  const openTaskDelete = (task) => {
    setTaskQuickAction({ mode: 'delete', task });
  };

  const closeTaskQuickAction = () => {
    setTaskQuickAction({ mode: null, task: null });
  };

  const handleQuickTaskActionSuccess = () => {
    fetchMyTasks();
  };

  return (
    <>
      <Navbar />
      <div className={styles.container}>
        <button type="button" onClick={() => navigate('/dashboard')} className={styles.backButton}>
          ← Back to Dashboard
        </button>

        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>My Tasks</h1>
            <p className={styles.subtitle}>
              Everything assigned to you across all groups, sorted by due date and priority.
            </p>
          </div>

          <div className={styles.filters}>
            <button
              type="button"
              className={`${styles.filterButton} ${!includeDone ? styles.filterButtonActive : ''}`}
              onClick={() => setIncludeDone(false)}
            >
              Active
            </button>
            <button
              type="button"
              className={`${styles.filterButton} ${includeDone ? styles.filterButtonActive : ''}`}
              onClick={() => setIncludeDone(true)}
            >
              All
            </button>
          </div>
        </div>

        <TaskFiltersBar
          filters={filters}
          onChange={setFilters}
          showAssignee={false}
        />

        {!isLoading && !error && (
          <div className={styles.summaryBar}>
            <span>{summary.total_tasks} task{summary.total_tasks === 1 ? '' : 's'}</span>
            {summary.overdue_tasks > 0 && (
              <span className={styles.overdueSummary}>
                {summary.overdue_tasks} overdue
              </span>
            )}
          </div>
        )}

        {isLoading ? (
          <div className={styles.stateMessage}>Loading your tasks...</div>
        ) : error ? (
          <div className={styles.errorMessage}>{error}</div>
        ) : tasks.length === 0 ? (
          <div className={styles.stateMessage}>
            {includeDone
              ? 'No tasks match your filters.'
              : 'You have no active assigned tasks matching your filters.'}
          </div>
        ) : (
          <div className={styles.taskList}>
            {tasks.map((task) => (
                <div key={task.id} className={styles.taskRow}>
                  <button
                    type="button"
                    className={styles.taskMain}
                    onClick={() => navigate(`/groups/${task.group_id}`, { state: { expandTaskId: task.id } })}
                  >
                    <div className={styles.taskInfo}>
                      <div className={styles.taskTitleRow}>
                        <span className={styles.taskTitle}>{task.title}</span>
                        <TaskPriorityBadge
                          task={task}
                          compact
                          onPriorityChange={handlePriorityChange}
                          disabled={isUpdatingStatus}
                        />
                      </div>
                      <span className={styles.taskGroup}>
                        in <strong>{task.group_name || 'Unknown group'}</strong>
                        {(task.subtask_count || 0) > 0 && (
                          <> · {task.subtask_completed_count || 0}/{task.subtask_count} steps</>
                        )}
                      </span>
                    </div>
                    <span className={`${styles.taskDue} ${getDueClassName(task)}`}>
                      {formatDueDate(task.due_date)}
                    </span>
                  </button>

                  <div className={styles.taskActions}>
                    <TaskInlineActions
                      onEdit={() => openTaskEdit(task)}
                      onDelete={() => openTaskDelete(task)}
                      disabled={isUpdatingStatus}
                    />
                    <TaskStatusControl
                      task={task}
                      onStatusChange={handleStatusChange}
                      disabled={isUpdatingStatus}
                      compact
                    />
                    <Link
                      to={`/groups/${task.group_id}`}
                      state={{ expandTaskId: task.id }}
                      className={styles.openLink}
                    >
                      Open
                    </Link>
                  </div>
                </div>
              ))}
          </div>
        )}

        <TaskQuickActionModal
          isOpen={Boolean(taskQuickAction.mode && taskQuickAction.task)}
          mode={taskQuickAction.mode}
          task={taskQuickAction.task}
          onClose={closeTaskQuickAction}
          onSuccess={handleQuickTaskActionSuccess}
        />
      </div>
    </>
  );
}

export default MyTasks;
