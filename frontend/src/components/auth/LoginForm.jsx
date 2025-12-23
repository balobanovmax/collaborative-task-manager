import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './LoginForm.module.css';
import Button from '../common/Button';
import { authAPI } from '../../services/api';
import { setAuthToken, setUser } from '../../utils/auth';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Clear previous errors
    setErrorMessage('');
    setIsLoading(true);

    try {
      // Call backend API
      const response = await authAPI.login(email, password);
      
      // Store token and user data in localStorage
      setAuthToken(response.token);
      setUser(response.user);
      
      // Navigate to dashboard with success message (replace history)
      navigate('/dashboard', { state: { message: 'Logged in successfully.' }, replace: true });
      
    } catch (error) {
      // Handle errors
      setIsLoading(false);
      
      if (error.response && error.response.data && error.response.data.error) {
        // Backend returned an error message
        setErrorMessage(error.response.data.error);
      } else {
        // Network or other error
        setErrorMessage('Login failed. Please try again.');
      }
    }
  };

  const handleCancel = () => {
    navigate('/');
  };

  return (
    <div className={styles.formContainer}>
      <h2 className={styles.formTitle}>Log In</h2>
      
      <div className={styles.messageContainer}>
        {errorMessage && (
          <div className={styles.errorMessage}>
            {errorMessage}
          </div>
        )}
      </div>
      
      <form onSubmit={handleSubmit}>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Email</label>
          <input
            type="email"
            className={styles.formInput}
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Password</label>
          <input
            type="password"
            className={styles.formInput}
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>

        <div className={styles.buttonGroup}>
          <Button type="submit" variant="primary" disabled={isLoading}>
            {isLoading ? 'Logging in...' : 'Log In'}
          </Button>
          <Button variant="secondary" onClick={handleCancel} disabled={isLoading}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

export default LoginForm;

