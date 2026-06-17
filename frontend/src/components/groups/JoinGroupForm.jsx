import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './JoinGroupForm.module.css';
import { groupAPI } from '../../services/api';

function JoinGroupForm() {
  const [groupId, setGroupId] = useState('');
  const [password, setPassword] = useState('');
  const [requestMessage, setRequestMessage] = useState('');
  const [preview, setPreview] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const navigate = useNavigate();

  const resetPreview = () => {
    setPreview(null);
    setPassword('');
    setRequestMessage('');
    setErrorMessage('');
    setSuccessMessage('');
  };

  const handleLookup = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setIsPreviewLoading(true);

    try {
      const groupIdNum = parseInt(groupId);

      if (isNaN(groupIdNum) || groupIdNum <= 0) {
        setErrorMessage('Please enter a valid Group ID');
        setIsPreviewLoading(false);
        return;
      }

      const response = await groupAPI.getJoinPreview(groupIdNum);
      setPreview(response.data.preview);
    } catch (error) {
      if (error.response?.data?.message) {
        setErrorMessage(error.response.data.message);
      } else {
        setErrorMessage('Failed to look up group. Please try again.');
      }
      setPreview(null);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setIsLoading(true);

    try {
      const groupIdNum = parseInt(groupId);

      await groupAPI.joinGroup(groupIdNum, password || null);

      navigate('/my-groups', {
        state: { message: 'Successfully joined group!' },
        replace: true
      });
    } catch (error) {
      setIsLoading(false);

      if (error.response?.data?.message) {
        setErrorMessage(error.response.data.message);
      } else {
        setErrorMessage('Failed to join group. Please try again.');
      }
    }
  };

  const handleRequestAccess = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setIsLoading(true);

    try {
      const groupIdNum = parseInt(groupId);

      await groupAPI.submitJoinRequest(groupIdNum, requestMessage || null);

      setSuccessMessage('Request sent! The group owner will be notified.');
      setPreview((prev) => prev ? { ...prev, has_pending_request: true } : prev);
    } catch (error) {
      if (error.response?.data?.message) {
        setErrorMessage(error.response.data.message);
      } else {
        setErrorMessage('Failed to submit join request. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/dashboard');
  };

  const renderJoinAction = () => {
    if (!preview) return null;

    if (preview.is_member) {
      return (
        <div className={styles.previewBox}>
          <p className={styles.previewText}>You are already a member of <strong>{preview.name}</strong>.</p>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => navigate(`/groups/${preview.group_id}`)}
          >
            Go to Group
          </button>
        </div>
      );
    }

    if (preview.has_pending_request) {
      return (
        <div className={styles.previewBox}>
          <p className={styles.previewText}>
            Your request to join <strong>{preview.name}</strong> is pending owner approval.
          </p>
        </div>
      );
    }

    if (preview.is_public) {
      return (
        <form onSubmit={handleJoin}>
          <div className={styles.previewBox}>
            <p className={styles.previewText}>
              <strong>{preview.name}</strong> is a public group. You can join instantly.
            </p>
          </div>
          <div className={styles.buttonGroup}>
            <button type="submit" className={styles.btnPrimary} disabled={isLoading}>
              {isLoading ? 'Joining...' : 'Join Group'}
            </button>
            <button type="button" className={styles.btnSecondary} onClick={resetPreview} disabled={isLoading}>
              Back
            </button>
          </div>
        </form>
      );
    }

    if (preview.requires_password) {
      return (
        <form onSubmit={handleJoin}>
          <div className={styles.previewBox}>
            <p className={styles.previewText}>
              <strong>{preview.name}</strong> is a private group protected by a password.
            </p>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Group Password</label>
            <input
              type="password"
              className={styles.formInput}
              placeholder="Enter group password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
          <div className={styles.buttonGroup}>
            <button type="submit" className={styles.btnPrimary} disabled={isLoading}>
              {isLoading ? 'Joining...' : 'Join with Password'}
            </button>
            <button type="button" className={styles.btnSecondary} onClick={resetPreview} disabled={isLoading}>
              Back
            </button>
          </div>
        </form>
      );
    }

    if (preview.requires_approval) {
      return (
        <form onSubmit={handleRequestAccess}>
          <div className={styles.previewBox}>
            <p className={styles.previewText}>
              <strong>{preview.name}</strong> is a private group. Request access and the owner will approve or decline.
            </p>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Message to owner (optional)</label>
            <textarea
              className={styles.formTextarea}
              placeholder="Why would you like to join?"
              value={requestMessage}
              onChange={(e) => setRequestMessage(e.target.value)}
              disabled={isLoading}
              maxLength={500}
              rows={3}
            />
          </div>
          <div className={styles.buttonGroup}>
            <button type="submit" className={styles.btnPrimary} disabled={isLoading}>
              {isLoading ? 'Sending...' : 'Request Access'}
            </button>
            <button type="button" className={styles.btnSecondary} onClick={resetPreview} disabled={isLoading}>
              Back
            </button>
          </div>
        </form>
      );
    }

    return null;
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
        {successMessage && (
          <div className={styles.successMessage}>
            {successMessage}
          </div>
        )}
      </div>

      {!preview ? (
        <form onSubmit={handleLookup}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Group ID</label>
            <input
              type="number"
              className={styles.formInput}
              placeholder="Enter group ID"
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              required
              disabled={isPreviewLoading}
              min="1"
            />
            <p className={styles.helperText}>
              Ask the group owner for the Group ID
            </p>
          </div>

          <div className={styles.buttonGroup}>
            <button type="submit" className={styles.btnPrimary} disabled={isPreviewLoading}>
              {isPreviewLoading ? 'Looking up...' : 'Continue'}
            </button>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={handleCancel}
              disabled={isPreviewLoading}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        renderJoinAction()
      )}
    </div>
  );
}

export default JoinGroupForm;
