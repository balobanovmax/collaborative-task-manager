import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import styles from './Settings.module.css';
import Navbar from '../components/common/Navbar';
import UserAvatar from '../components/common/UserAvatar';
import { userAPI } from '../services/api';
import { getUser, updateStoredUser } from '../utils/auth';

function Settings() {
  const navigate = useNavigate();
  const location = useLocation();
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
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

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

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!currentPassword) {
      setPasswordError('Current password is required.');
      return;
    }

    if (!newPassword) {
      setPasswordError('New password is required.');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    try {
      setIsChangingPassword(true);
      const response = await userAPI.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSuccess(response.message || 'Password updated successfully.');
    } catch (error) {
      setPasswordError(error.response?.data?.message || 'Failed to change password.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const displayAvatarUrl = previewUrl || profilePictureUrl;

  const handleBack = () => {
    const returnTo = location.state?.returnTo;
    if (returnTo && returnTo !== '/settings') {
      navigate(returnTo);
      return;
    }
    navigate(-1);
  };

  return (
    <>
      <Navbar />
      <div className={styles.container}>
        <button type="button" onClick={handleBack} className={styles.backButton}>
          ← Back
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

          {!isLoading && (
            <>
              <div className={styles.sectionDivider} />
              <h2 className={styles.sectionTitle}>Change Password</h2>
              <p className={styles.sectionSubtitle}>
                Update your login password. You will stay signed in on this device.
              </p>

              <form onSubmit={handlePasswordSubmit} className={styles.form}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="currentPassword">Current Password</label>
                  <input
                    id="currentPassword"
                    type="password"
                    className={styles.formInput}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                    disabled={isChangingPassword}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="newPassword">New Password</label>
                  <input
                    id="newPassword"
                    type="password"
                    className={styles.formInput}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    minLength={6}
                    disabled={isChangingPassword}
                  />
                  <p className={styles.helperText}>At least 6 characters.</p>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="confirmPassword">Confirm New Password</label>
                  <input
                    id="confirmPassword"
                    type="password"
                    className={styles.formInput}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    minLength={6}
                    disabled={isChangingPassword}
                  />
                </div>

                {passwordError && <div className={styles.errorMessage}>{passwordError}</div>}
                {passwordSuccess && <div className={styles.successMessage}>{passwordSuccess}</div>}

                <div className={styles.buttonRow}>
                  <button type="submit" className={styles.saveButton} disabled={isChangingPassword}>
                    {isChangingPassword ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default Settings;
