import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styles from './Dashboard.module.css';
import Navbar from '../components/common/Navbar';
import { getUser } from '../utils/auth';

function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [user, setUser] = useState(null);

  useEffect(() => {
    const userData = getUser();
    setUser(userData);

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

  return (
    <>
      <Navbar />
      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.welcomeSection}>
            <h1 className={styles.title}>Welcome back, {user?.username}!</h1>
            <p className={styles.subtitle}>What would you like to do today?</p>
          </div>

          <div className={styles.profileCard}>
            <h2 className={styles.cardTitle}>Your Profile</h2>
            <div className={styles.profileInfo}>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Username:</span>
                <span className={styles.infoValue}>{user?.username}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Email:</span>
                <span className={styles.infoValue}>{user?.email}</span>
              </div>
            </div>
          </div>

          <div className={styles.actionsGrid}>
            <button 
              className={`${styles.actionCard} ${styles.actionPrimary}`}
              onClick={() => navigate('/my-groups')}
            >
              <div className={styles.actionIcon}>📋</div>
              <h3 className={styles.actionTitle}>My Groups</h3>
              <p className={styles.actionDescription}>View and manage your groups</p>
            </button>

            <button 
              className={`${styles.actionCard} ${styles.actionSuccess}`}
              onClick={() => navigate('/create-group')}
            >
              <div className={styles.actionIcon}>➕</div>
              <h3 className={styles.actionTitle}>Create Group</h3>
              <p className={styles.actionDescription}>Start a new group</p>
            </button>

            <button 
              className={`${styles.actionCard} ${styles.actionInfo}`}
              onClick={() => navigate('/join-group')}
            >
              <div className={styles.actionIcon}>🔍</div>
              <h3 className={styles.actionTitle}>Join Group</h3>
              <p className={styles.actionDescription}>Find and join existing groups</p>
            </button>

            <button 
              className={`${styles.actionCard} ${styles.actionSecondary}`}
              onClick={() => navigate('/settings')}
            >
              <div className={styles.actionIcon}>⚙️</div>
              <h3 className={styles.actionTitle}>Settings</h3>
              <p className={styles.actionDescription}>Manage your account</p>
            </button>
          </div>
        </div>

        {showNotification && (
          <div className={styles.notification}>
            {notificationMessage}
          </div>
        )}
      </div>
    </>
  );
}

export default Dashboard;

