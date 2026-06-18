import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styles from './Dashboard.module.css';
import Navbar from '../components/common/Navbar';
import TaskInlineActions from '../components/tasks/TaskInlineActions';
import TaskQuickActionModal from '../components/tasks/TaskQuickActionModal';
import { getUser } from '../utils/auth';
import { userAPI } from '../services/api';
import { getTaskStatus, isTaskDueToday, isTaskOverdue, getStatusLabel } from '../utils/taskStatus';

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

function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [dashboard, setDashboard] = useState(null);
  const [taskQuickAction, setTaskQuickAction] = useState({ mode: null, task: null });
  const user = getUser();

  const loadDashboard = async () => {
    try {
      setIsLoading(true);
      setError('');
      const response = await userAPI.getDashboard();
      setDashboard(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (location.state?.message) {
      setNotificationMessage(location.state.message);
      setShowNotification(true);
      window.history.replaceState({}, document.title);

      const timer = setTimeout(() => {
        setShowNotification(false);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [location]);

  useEffect(() => {
    loadDashboard();
  }, []);

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
    loadDashboard();
  };

  const summary = dashboard?.summary || {};
  const myTasks = dashboard?.my_tasks || [];
  const joinRequests = dashboard?.pending_join_requests || [];
  const mentions = dashboard?.unread_mentions || [];

  const openTask = (task) => {
    navigate(`/groups/${task.group_id}`, { state: { expandTaskId: task.id } });
  };

  const openGroup = (groupId) => {
    navigate(`/groups/${groupId}`);
  };

  return (
    <>
      <Navbar />
      <div className={styles.container}>
        <button onClick={() => navigate('/')} className={styles.backButton}>
          ← Back
        </button>

        <div className={styles.content}>
          <div className={styles.welcomeSection}>
            <h1 className={styles.title}>Welcome back, {user?.username}!</h1>
            <p className={styles.subtitle}>Here is what needs your attention.</p>
          </div>

          {error && <p className={styles.errorMessage}>{error}</p>}

          {isLoading ? (
            <p className={styles.loadingMessage}>Loading dashboard...</p>
          ) : (
            <>
              <div className={styles.statsRow}>
                <div className={styles.statCard}>
                  <span className={styles.statValue}>{summary.active_tasks || 0}</span>
                  <span className={styles.statLabel}>Active tasks</span>
                </div>
                <div className={`${styles.statCard} ${summary.overdue_tasks ? styles.statCardAlert : ''}`}>
                  <span className={styles.statValue}>{summary.overdue_tasks || 0}</span>
                  <span className={styles.statLabel}>Overdue</span>
                </div>
                <div className={styles.statCard}>
                  <span className={styles.statValue}>{summary.due_today_tasks || 0}</span>
                  <span className={styles.statLabel}>Due today</span>
                </div>
                <div className={`${styles.statCard} ${summary.pending_join_requests ? styles.statCardAlert : ''}`}>
                  <span className={styles.statValue}>{summary.pending_join_requests || 0}</span>
                  <span className={styles.statLabel}>Join requests</span>
                </div>
                <div className={`${styles.statCard} ${summary.unread_mentions ? styles.statCardAlert : ''}`}>
                  <span className={styles.statValue}>{summary.unread_mentions || 0}</span>
                  <span className={styles.statLabel}>Mentions</span>
                </div>
              </div>

              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>My tasks</h2>
                  <button type="button" className={styles.linkButton} onClick={() => navigate('/my-tasks')}>
                    View all
                  </button>
                </div>

                {myTasks.length === 0 ? (
                  <p className={styles.emptyText}>No active tasks assigned to you.</p>
                ) : (
                  <ul className={styles.list}>
                    {myTasks.map((task) => (
                      <li key={task.id} className={styles.taskRow}>
                        <button type="button" className={styles.listItem} onClick={() => openTask(task)}>
                          <span className={styles.listItemTitle}>{task.title}</span>
                          <span className={styles.listItemMeta}>
                            {task.group_name} · {getStatusLabel(getTaskStatus(task))} · {formatDueDate(task.due_date)}
                            {isTaskOverdue(task) && ' · Overdue'}
                            {!isTaskOverdue(task) && isTaskDueToday(task) && ' · Due today'}
                          </span>
                        </button>
                        <TaskInlineActions
                          onEdit={() => openTaskEdit(task)}
                          onDelete={() => openTaskDelete(task)}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {(joinRequests.length > 0 || mentions.length > 0) && (
                <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>Needs your attention</h2>

                  {joinRequests.length > 0 && (
                    <div className={styles.subsection}>
                      <h3 className={styles.subsectionTitle}>Join requests</h3>
                      <ul className={styles.list}>
                        {joinRequests.map((request) => (
                          <li key={request.id}>
                            <button
                              type="button"
                              className={styles.listItem}
                              onClick={() => openGroup(request.group_id)}
                            >
                              <span className={styles.listItemTitle}>
                                {request.username} wants to join {request.group_name}
                              </span>
                              <span className={styles.listItemMeta}>Review in group settings</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {mentions.length > 0 && (
                    <div className={styles.subsection}>
                      <h3 className={styles.subsectionTitle}>Unread mentions</h3>
                      <ul className={styles.list}>
                        {mentions.map((mention) => (
                          <li key={mention.id}>
                            <button
                              type="button"
                              className={styles.listItem}
                              onClick={() => {
                                const groupId = mention.metadata?.group_id;
                                const taskId = mention.metadata?.task_id;
                                if (groupId) {
                                  navigate(
                                    `/groups/${groupId}`,
                                    taskId ? { state: { expandTaskId: taskId } } : undefined
                                  );
                                }
                              }}
                            >
                              <span className={styles.listItemTitle}>{mention.title}</span>
                              <span className={styles.listItemMeta}>{mention.message}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>
              )}

              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Quick links</h2>
                <div className={styles.actionsGrid}>
                  <button type="button" className={styles.actionButton} onClick={() => navigate('/my-groups')}>
                    My Groups
                  </button>
                  <button type="button" className={styles.actionButton} onClick={() => navigate('/create-group')}>
                    Create Group
                  </button>
                  <button type="button" className={styles.actionButton} onClick={() => navigate('/join-group')}>
                    Join Group
                  </button>
                  <button
                    type="button"
                    className={styles.actionButtonSecondary}
                    onClick={() => navigate('/settings', { state: { returnTo: '/dashboard' } })}
                  >
                    Settings
                  </button>
                </div>
              </section>
            </>
          )}
        </div>

        {showNotification && (
          <div className={styles.notification}>
            {notificationMessage}
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

export default Dashboard;
