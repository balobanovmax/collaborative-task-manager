import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './CreateGroupForm.module.css';
import { groupAPI } from '../../services/api';
import { JOIN_MODES, JOIN_MODE_LABELS } from '../../utils/groupJoinMode';

function CreateGroupForm() {
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [joinMode, setJoinMode] = useState('public');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    setErrorMessage('');

    if (joinMode === 'password' && !password.trim()) {
      setErrorMessage('Password is required for password-protected groups');
      return;
    }

    setIsLoading(true);

    try {
      await groupAPI.createGroup(
        groupName.trim(),
        description.trim() || null,
        joinMode,
        joinMode === 'password' ? password : null
      );
      
      navigate('/my-groups', { 
        state: { message: 'Group created successfully!' },
        replace: true 
      });

    } catch (error) {
      setIsLoading(false);
      
      if (error.response && error.response.data && error.response.data.message) {
        setErrorMessage(error.response.data.message);
      } else {
        setErrorMessage('Failed to create group. Please try again.');
      }
    }
  };

  const handleCancel = () => {
    navigate('/dashboard');
  };

  const handleJoinModeChange = (mode) => {
    setJoinMode(mode);
    if (mode !== 'password') {
      setPassword('');
    }
    setErrorMessage('');
  };

  return (
    <div className={styles.formContainer}>
      <h2 className={styles.formTitle}>Create a Group</h2>

      <div className={styles.messageContainer}>
        {errorMessage && (
          <div className={styles.errorMessage}>
            {errorMessage}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Group Name</label>
          <input
            type="text"
            className={styles.formInput}
            placeholder="Enter group name"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            required
            disabled={isLoading}
            maxLength={100}
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Description (optional)</label>
          <textarea
            className={styles.formTextarea}
            placeholder="What is this group about?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isLoading}
            rows={3}
            maxLength={500}
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Join Settings</label>
          <div className={styles.radioGroup}>
            {JOIN_MODES.map((mode) => (
              <label key={mode} className={styles.radioLabel}>
                <input
                  type="radio"
                  name="joinMode"
                  checked={joinMode === mode}
                  onChange={() => handleJoinModeChange(mode)}
                  disabled={isLoading}
                />
                <span>{JOIN_MODE_LABELS[mode]}</span>
              </label>
            ))}
          </div>
        </div>

        {joinMode === 'password' && (
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Group Password</label>
            <input
              type="password"
              className={styles.formInput}
              placeholder="Enter group password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              required
            />
            <p className={styles.helperText}>
              Members must enter this password to join instantly.
            </p>
          </div>
        )}

        {joinMode === 'approval' && (
          <p className={styles.helperText}>
            New members submit a join request and the group owner approves or declines it.
          </p>
        )}

        <div className={styles.buttonGroup}>
          <button type="submit" className={styles.btnPrimary} disabled={isLoading}>
            {isLoading ? 'Creating...' : 'Create Group'}
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

export default CreateGroupForm;
