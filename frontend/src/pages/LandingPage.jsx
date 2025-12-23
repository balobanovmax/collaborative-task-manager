import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import styles from './LandingPage.module.css';
import Navbar from '../components/common/Navbar';

function LandingPage() {
  const location = useLocation();
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');

  useEffect(() => {
    if (location.state?.message) {
      setNotificationMessage(location.state.message);
      setShowNotification(true);

      // Clear the location state without causing re-render
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
          Manage tasks together with your team in real-time
        </p>

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

