import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styles from './Navbar.module.css';
import UserAvatar from './UserAvatar';
import { isAuthenticated, logout, getUser } from '../../utils/auth';
import { useTheme } from '../../context/ThemeContext';

function Navbar() {
  const navigate = useNavigate();
  const loggedIn = isAuthenticated();
  const [user, setUser] = useState(getUser());
  const { isDark, toggleTheme } = useTheme();

  useEffect(() => {
    const handleUserUpdated = (event) => {
      setUser(event.detail);
    };

    window.addEventListener('user-updated', handleUserUpdated);
    return () => window.removeEventListener('user-updated', handleUserUpdated);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/', { state: { message: 'Logged out successfully.' }, replace: true });
  };

  return (
    <nav className={styles.navbar}>
      <div className={styles.navContent}>
        <div className={styles.navLeft}>
          <Link to="/" className={styles.logo}>
            Task Manager
          </Link>
          {loggedIn && user?.username && (
            <div className={styles.userGreeting}>
              <UserAvatar
                username={user.username}
                profilePictureUrl={user.profile_picture_url}
                size="sm"
              />
              <span>Logged in as: {user.username}</span>
            </div>
          )}
        </div>
        
        <div className={styles.buttonGroup}>
          <button
            type="button"
            onClick={toggleTheme}
            className={styles.themeToggle}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? '☀ Light' : '☾ Dark'}
          </button>
          {loggedIn ? (
            <>
              <Link to="/settings" className={styles.btnSecondary}>
                Settings
              </Link>
              <button onClick={handleLogout} className={styles.btnSecondary}>
                Log Out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className={styles.btnSecondary}>
                Log In
              </Link>
              <Link to="/signup" className={styles.btnPrimary}>
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
