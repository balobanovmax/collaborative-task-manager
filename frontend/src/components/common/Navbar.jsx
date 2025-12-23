import { Link, useNavigate } from 'react-router-dom';
import styles from './Navbar.module.css';
import { isAuthenticated, logout } from '../../utils/auth';

function Navbar() {
  const navigate = useNavigate();
  const loggedIn = isAuthenticated();

  const handleLogout = () => {
    logout();
    navigate('/', { state: { message: 'Logged out successfully.' }, replace: true });
  };

  return (
    <nav className={styles.navbar}>
      <div className={styles.navContent}>
        <Link to="/" className={styles.logo}>
          Task Manager
        </Link>
        
        <div className={styles.buttonGroup}>
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

