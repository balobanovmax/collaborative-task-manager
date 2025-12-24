import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './CreateGroupForm.module.css';
import { groupAPI } from '../../services/api';

function CreateGroupForm() {
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    setErrorMessage('');
    setIsLoading(true);

    try {
      if (!isPublic && !password.trim()) {
        setErrorMessage('Password is required for private groups');
        setIsLoading(false);
        return;
      }

      await groupAPI.createGroup(
        groupName.trim(),
        description.trim() || null,
        isPublic,
        !isPublic ? password : null
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
          <label className={styles.formLabel}>Privacy</label>
          <div className={styles.radioGroup}>
            <label className={styles.radioLabel}>
              <input
                type="radio"
                name="privacy"
                checked={isPublic}
                onChange={() => setIsPublic(true)}
                disabled={isLoading}
              />
              <span>Public (anyone can join)</span>
            </label>
            <label className={styles.radioLabel}>
              <input
                type="radio"
                name="privacy"
                checked={!isPublic}
                onChange={() => setIsPublic(false)}
                disabled={isLoading}
              />
              <span>Private (requires password)</span>
            </label>
          </div>
        </div>

        {!isPublic && (
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Password</label>
            <input
              type="password"
              className={styles.formInput}
              placeholder="Enter group password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required={!isPublic}
              disabled={isLoading}
            />
            <p className={styles.helperText}>
              Members will need this password to join
            </p>
          </div>
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

