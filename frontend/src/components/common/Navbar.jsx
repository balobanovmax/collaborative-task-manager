import { Link, useNavigate } from 'react-router-dom';
import styles from './Navbar.module.css';
import { isAuthenticated, logout, getUser } from '../../utils/auth';
import { useTheme } from '../../context/ThemeContext';

function Navbar() {
  const navigate = useNavigate();
  const loggedIn = isAuthenticated();
  const user = getUser();
  const { isDark, toggleTheme } = useTheme();

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
            <span className={styles.userGreeting}>
              Logged in as: {user.username}
            </span>
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
            <button onClick={handleLogout} className={styles.btnSecondary}>
              Log Out
            </button>
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

