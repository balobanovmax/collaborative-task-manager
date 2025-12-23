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
      // Step 1: Register the user
      await authAPI.register(username, email, password);
      
      // Step 2: Automatically log them in
      const loginResponse = await authAPI.login(email, password);
      
      // Step 3: Store token and user data
      setAuthToken(loginResponse.token);
      setUser(loginResponse.user);
      
      // Step 4: Navigate to dashboard with success message (replace history)
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

