import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './SignUpForm.module.css';
import Button from '../common/Button';
import { authAPI } from '../../services/api';
import { setAuthToken, setUser } from '../../utils/auth';

function SignUpForm() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    setErrorMessage('');
    setIsLoading(true);

    try {
      await authAPI.register(username, email, password);
      const loginResponse = await authAPI.login(email, password);
      setAuthToken(loginResponse.token);
      setUser(loginResponse.user);
      navigate('/dashboard', { state: { message: 'Account created successfully! Welcome!' }, replace: true });
    } catch (error) {
      setIsLoading(false);
      if (error.response && error.response.data && error.response.data.error) {
        setErrorMessage(error.response.data.error);
      } else {
        setErrorMessage('Sign up failed. Please try again.');
      }
    }
  };

  const handleCancel = () => {
    navigate('/');
  };

  return (
    <div className={styles.formContainer}>
      <h2 className={styles.formTitle}>Sign Up</h2>

      <div className={styles.demoNotice} role="note">
        <p className={styles.demoNoticeTitle}>Demo credentials only</p>
        <p className={styles.demoNoticeText}>
          This is a portfolio project. Auth is kept simple on purpose so the focus stays
          on real-time collaboration, not OAuth setup for a side project.
        </p>
        <p className={styles.demoNoticeText}>
          Please use fake credentials you do not use anywhere else. For example:
        </p>
        <ul className={styles.demoNoticeExample}>
          <li><strong>Username:</strong> demo_dev</li>
          <li><strong>Email:</strong> demo@example.com</li>
          <li><strong>Password:</strong> DemoPass123!</li>
        </ul>
      </div>
      
      <div className={styles.messageContainer}>
        {errorMessage && (
          <div className={styles.errorMessage}>
            {errorMessage}
          </div>
        )}
      </div>
      
      <form onSubmit={handleSubmit}>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Username</label>
          <input
            type="text"
            className={styles.formInput}
            placeholder="Choose a username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Email</label>
          <input
            type="email"
            className={styles.formInput}
            placeholder="demo@example.com"
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
            placeholder="Create a password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>

        <div className={styles.buttonGroup}>
          <Button type="submit" variant="primary" disabled={isLoading}>
            {isLoading ? 'Creating account...' : 'Sign Up'}
          </Button>
          <Button variant="secondary" onClick={handleCancel} disabled={isLoading}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

export default SignUpForm;

