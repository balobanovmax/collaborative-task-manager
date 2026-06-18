import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './NotificationsPanel.module.css';
import { notificationAPI } from '../../services/api';
import {
  connectSocket,
  joinUser,
  onNotificationReceived
} from '../../services/socket';
import { getUser } from '../../utils/auth';

const formatTime = (timestamp) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  return date.toLocaleDateString();
};

function NotificationsPanel({ onNavigate }) {
  const navigate = useNavigate();
  const user = getUser();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const panelRef = useRef(null);

  const fetchNotifications = async () => {
    try {
      setIsLoading(true);
      const response = await notificationAPI.getNotifications();
      setNotifications(response.data.notifications);
      setUnreadCount(response.data.unread_count);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.id) return;

    fetchNotifications();

    let unsubscribe = () => {};

    const setupSocket = async () => {
      await connectSocket();
      joinUser(user.id);

      unsubscribe = onNotificationReceived(({ notification }) => {
        setNotifications((prev) => [notification, ...prev]);
        setUnreadCount((prev) => prev + 1);
      });
    };

    setupSocket();

    return () => {
      unsubscribe();
    };
  }, [user?.id]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleToggle = () => {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    if (nextOpen) {
      fetchNotifications();
    }
  };

  const handleNotificationClick = async (notification) => {
    try {
      if (!notification.is_read) {
        await notificationAPI.markRead(notification.id);
        setNotifications((prev) =>
          prev.map((item) =>
            item.id === notification.id ? { ...item, is_read: true } : item
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }

      setIsOpen(false);

      const groupId = notification.metadata?.group_id;
      const taskId = notification.metadata?.task_id;
      if (groupId) {
        onNavigate?.();
        navigate(`/groups/${groupId}`, taskId ? { state: { expandTaskId: taskId } } : undefined);
      }
    } catch (error) {
      console.error('Failed to mark notification read:', error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationAPI.markAllRead();
      setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all notifications read:', error);
    }
  };

  return (
    <div className={styles.container} ref={panelRef}>
      <button
        type="button"
        className={styles.notificationsButton}
        onClick={handleToggle}
        aria-label="Notifications"
        title="Notifications"
      >
        Notifications
        {unreadCount > 0 && (
          <span className={styles.badge}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.dropdownHeader}>
            <span className={styles.dropdownTitle}>Notifications</span>
            {unreadCount > 0 && (
              <button
                type="button"
                className={styles.markAllButton}
                onClick={handleMarkAllRead}
              >
                Mark all read
              </button>
            )}
          </div>

          <div className={styles.list}>
            {isLoading && notifications.length === 0 && (
              <p className={styles.emptyState}>Loading...</p>
            )}

            {!isLoading && notifications.length === 0 && (
              <p className={styles.emptyState}>No notifications yet</p>
            )}

            {notifications.map((notification) => (
              <button
                key={notification.id}
                type="button"
                className={`${styles.notificationItem} ${!notification.is_read ? styles.unread : ''}`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className={styles.notificationTitle}>{notification.title}</div>
                <div className={styles.notificationMessage}>{notification.message}</div>
                <div className={styles.notificationTime}>
                  {formatTime(notification.created_at)}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationsPanel;
