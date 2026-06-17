import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Settings.module.css';
import Navbar from '../components/common/Navbar';
import UserAvatar from '../components/common/UserAvatar';
import { userAPI } from '../services/api';
import { getUser, updateStoredUser } from '../utils/auth';

function Settings() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const initialUser = getUser();

  const [username, setUsername] = useState(initialUser?.username || '');
  const [email, setEmail] = useState(initialUser?.email || '');
  const [bio, setBio] = useState(initialUser?.bio || '');
  const [profilePictureUrl, setProfilePictureUrl] = useState(initialUser?.profile_picture_url || null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setIsLoading(true);
        const response = await userAPI.getProfile();
        const user = response.data.user;

        setUsername(user.username || '');
        setEmail(user.email || '');
        setBio(user.bio || '');
        setProfilePictureUrl(user.profile_picture_url || null);
        updateStoredUser(user);
      } catch (error) {
        setErrorMessage('Failed to load profile. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setErrorMessage('Please choose a JPEG, PNG, GIF, or WebP image.');
      event.target.value = '';
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setErrorMessage('Avatar must be 2MB or smaller.');
      event.target.value = '';
      return;
    }

    setErrorMessage('');
    setSelectedFile(file);

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleRemoveAvatar = async () => {
    try {
      setIsSaving(true);
      setErrorMessage('');
      setSuccessMessage('');

      const response = await userAPI.removeAvatar();
      const user = response.data.user;

      setProfilePictureUrl(user.profile_picture_url || null);
      setSelectedFile(null);

      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      updateStoredUser(user);
      setSuccessMessage('Avatar removed successfully.');
    } catch (error) {
      setErrorMessage(error.response?.data?.message || 'Failed to remove avatar.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!username.trim()) {
      setErrorMessage('Username is required.');
      return;
    }

    try {
      setIsSaving(true);

      let latestUser;

      if (selectedFile) {
        const avatarResponse = await userAPI.uploadAvatar(selectedFile);
        latestUser = avatarResponse.data.user;
        setProfilePictureUrl(latestUser.profile_picture_url || null);
        setSelectedFile(null);

        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
          setPreviewUrl(null);
        }

        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }

      const profileResponse = await userAPI.updateProfile({
        username: username.trim(),
        bio: bio.trim()
      });

      latestUser = profileResponse.data.user;
      setUsername(latestUser.username || '');
      setBio(latestUser.bio || '');
      setProfilePictureUrl(latestUser.profile_picture_url || null);
      updateStoredUser(latestUser);
      setSuccessMessage('Profile updated successfully.');
    } catch (error) {
      setErrorMessage(error.response?.data?.message || 'Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const displayAvatarUrl = previewUrl || profilePictureUrl;

  return (
    <>
      <Navbar />
      <div className={styles.container}>
        <button onClick={() => navigate('/dashboard')} className={styles.backButton}>
          ← Back to Dashboard
        </button>

        <div className={styles.card}>
          <h1 className={styles.title}>Profile Settings</h1>
          <p className={styles.subtitle}>Update how you appear to your team across groups, chat, and tasks.</p>

          {isLoading ? (
            <div className={styles.loading}>Loading profile...</div>
          ) : (
            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.avatarSection}>
                <UserAvatar
                  username={username}
                  profilePictureUrl={displayAvatarUrl}
                  size="lg"
                  className={styles.avatarPreview}
                />
                <div className={styles.avatarActions}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    onChange={handleFileChange}
                    className={styles.hiddenInput}
                    id="avatar-upload"
                  />
                  <label htmlFor="avatar-upload" className={styles.uploadButton}>
                    Choose Photo
                  </label>
                  {(profilePictureUrl || previewUrl) && (
                    <button
                      type="button"
                      className={styles.removeAvatarButton}
                      onClick={handleRemoveAvatar}
                      disabled={isSaving}
                    >
                      Remove Photo
                    </button>
                  )}
                  <p className={styles.helperText}>JPEG, PNG, GIF, or WebP. Max 2MB.</p>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="username">Username</label>
                <input
                  id="username"
                  type="text"
                  className={styles.formInput}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  maxLength={50}
                  required
                  disabled={isSaving}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  className={`${styles.formInput} ${styles.readOnlyInput}`}
                  value={email}
                  readOnly
                />
                <p className={styles.helperText}>Email cannot be changed here.</p>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="bio">Bio</label>
                <textarea
                  id="bio"
                  className={styles.formTextarea}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={500}
                  rows={4}
                  placeholder="Tell your teammates a little about yourself..."
                  disabled={isSaving}
                />
              </div>

              {errorMessage && <div className={styles.errorMessage}>{errorMessage}</div>}
              {successMessage && <div className={styles.successMessage}>{successMessage}</div>}

              <div className={styles.buttonRow}>
                <button type="submit" className={styles.saveButton} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
}

export default Settings;
