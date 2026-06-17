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
  const user = getUser();

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

  const handleBack = () => {
    navigate('/');
  };

  return (
    <>
      <Navbar />
      <div className={styles.container}>
        <button onClick={handleBack} className={styles.backButton}>
          ← Back
        </button>
        
        <div className={styles.content}>
          <div className={styles.welcomeSection}>
            <h1 className={styles.title}>Welcome back, {user?.username}!</h1>
          </div>

          <div className={styles.actionsGrid}>
            <button 
              className={styles.actionButton}
              onClick={() => navigate('/my-groups')}
            >
              My Groups
            </button>

            <button 
              className={styles.actionButton}
              onClick={() => navigate('/create-group')}
            >
              Create Group
            </button>

            <button 
              className={styles.actionButton}
              onClick={() => navigate('/join-group')}
            >
              Join Group
            </button>

            <button 
              className={styles.actionButton}
              onClick={() => navigate('/settings', { state: { returnTo: '/dashboard' } })}
            >
              Profile Settings
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

