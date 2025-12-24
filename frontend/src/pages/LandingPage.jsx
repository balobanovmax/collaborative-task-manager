import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styles from './LandingPage.module.css';
import Navbar from '../components/common/Navbar';
import { isAuthenticated } from '../utils/auth';

function LandingPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const loggedIn = isAuthenticated();

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

  return (
    <>
      <Navbar />
      <div className={styles.container}>
        <h1 className={styles.title}>Collaborative Task Manager</h1>
        <p className={styles.subtitle}>
          Manage tasks with your friends.
        </p>

        {loggedIn && (
          <button 
            className={styles.dashboardButton}
            onClick={() => navigate('/dashboard')}
          >
            Go to Dashboard
          </button>
        )}

        {showNotification && (
          <div className={styles.notification}>
            {notificationMessage}
          </div>
        )}
      </div>
    </>
  );
}

export default LandingPage;

