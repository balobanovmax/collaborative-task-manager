import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import styles from './Navbar.module.css';
import UserAvatar from './UserAvatar';
import NotificationsPanel from './NotificationsPanel';
import { isAuthenticated, logout, getUser } from '../../utils/auth';
import { useTheme } from '../../context/ThemeContext';

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const loggedIn = isAuthenticated();
  const [user, setUser] = useState(getUser());
  const [menuOpen, setMenuOpen] = useState(false);
  const { isDark, toggleTheme } = useTheme();

  useEffect(() => {
    const handleUserUpdated = (event) => {
      setUser(event.detail);
    };

    window.addEventListener('user-updated', handleUserUpdated);
    return () => window.removeEventListener('user-updated', handleUserUpdated);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  const handleLogout = () => {
    setMenuOpen(false);
    logout();
    navigate('/', { state: { message: 'Logged out successfully.' }, replace: true });
  };

  const closeMenu = () => setMenuOpen(false);

  return (
    <nav className={styles.navbar}>
      <div className={styles.navContent}>
        <div className={styles.navLeft}>
          <Link to="/" className={styles.logo} onClick={closeMenu}>
            Task Manager
          </Link>
          {loggedIn && user?.username && (
            <div className={styles.userGreeting}>
              <UserAvatar
                username={user.username}
                profilePictureUrl={user.profile_picture_url}
                size="sm"
              />
              <span className={styles.userGreetingText}>Logged in as: {user.username}</span>
            </div>
          )}
        </div>

        <button
          type="button"
          className={styles.menuToggle}
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        >
          {menuOpen ? 'Close' : 'Menu'}
        </button>

        <div className={`${styles.buttonGroup} ${menuOpen ? styles.buttonGroupOpen : ''}`}>
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
              <NotificationsPanel onNavigate={closeMenu} />
              <Link to="/my-tasks" className={styles.btnSecondary} onClick={closeMenu}>
                My Tasks
              </Link>
              <Link
                to="/settings"
                state={{ returnTo: location.pathname }}
                className={styles.btnSecondary}
                onClick={closeMenu}
              >
                Settings
              </Link>
              <button onClick={handleLogout} className={styles.btnSecondary}>
                Log Out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className={styles.btnSecondary} onClick={closeMenu}>
                Log In
              </Link>
              <Link to="/signup" className={styles.btnPrimary} onClick={closeMenu}>
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>

      {menuOpen && (
        <button
          type="button"
          className={styles.menuBackdrop}
          aria-label="Close menu"
          onClick={closeMenu}
        />
      )}
    </nav>
  );
}

export default Navbar;
