import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './JoinGroupForm.module.css';
import { groupAPI } from '../../services/api';

function JoinGroupForm() {
  const [groupId, setGroupId] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    setErrorMessage('');
    setIsLoading(true);

    try {
      const groupIdNum = parseInt(groupId);
      
      if (isNaN(groupIdNum) || groupIdNum <= 0) {
        setErrorMessage('Please enter a valid Group ID');
        setIsLoading(false);
        return;
      }

      await groupAPI.joinGroup(groupIdNum, password || null);
      
      navigate('/my-groups', { 
        state: { message: 'Successfully joined group!' },
        replace: true 
      });

    } catch (error) {
      setIsLoading(false);
      
      if (error.response && error.response.data && error.response.data.message) {
        setErrorMessage(error.response.data.message);
      } else {
        setErrorMessage('Failed to join group. Please try again.');
      }
    }
  };

  const handleCancel = () => {
    navigate('/dashboard');
  };

  return (
    <div className={styles.formContainer}>
      <h2 className={styles.formTitle}>Join a Group</h2>

      <div className={styles.messageContainer}>
        {errorMessage && (
          <div className={styles.errorMessage}>
            {errorMessage}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Group ID</label>
          <input
            type="number"
            className={styles.formInput}
            placeholder="Enter group ID"
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            required
            disabled={isLoading}
            min="1"
          />
          <p className={styles.helperText}>
            Ask the group owner for the Group ID
          </p>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Password (if private)</label>
          <input
            type="password"
            className={styles.formInput}
            placeholder="Enter password (optional)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
          />
          <p className={styles.helperText}>
            Leave blank for public groups
          </p>
        </div>

        <div className={styles.buttonGroup}>
          <button type="submit" className={styles.btnPrimary} disabled={isLoading}>
            {isLoading ? 'Joining...' : 'Join Group'}
          </button>
          <button 
            type="button" 
            className={styles.btnSecondary} 
            onClick={handleCancel} 
            disabled={isLoading}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export default JoinGroupForm;

