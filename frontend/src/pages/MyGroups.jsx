import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import styles from './MyGroups.module.css';
import Navbar from '../components/common/Navbar';
import ConfirmModal from '../components/common/ConfirmModal';
import { groupAPI } from '../services/api';

function MyGroups() {
  const navigate = useNavigate();
  const location = useLocation();
  const [ownedGroups, setOwnedGroups] = useState([]);
  const [memberGroups, setMemberGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState(null);

  useEffect(() => {
    fetchGroups();
    
    if (location.state?.message) {
      setNotificationMessage(location.state.message);
      setShowNotification(true);

      window.history.replaceState({}, document.title);

      const timer = setTimeout(() => {
        setShowNotification(false);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [location]);

  const fetchGroups = async () => {
    try {
      setIsLoading(true);
      setErrorMessage('');
      
      const response = await groupAPI.getUserGroups();
      
      setOwnedGroups(response.data.owned_groups);
      setMemberGroups(response.data.member_groups);
      setIsLoading(false);
    } catch (error) {
      setIsLoading(false);
      if (error.response && error.response.data && error.response.data.message) {
        setErrorMessage(error.response.data.message);
      } else {
        setErrorMessage('Failed to load groups. Please try again.');
      }
    }
  };

  const handleGroupClick = (groupId) => {
    navigate(`/groups/${groupId}`);
  };

  const handleDeleteGroup = async (e, groupId, groupName) => {
    e.stopPropagation();
    setGroupToDelete({ id: groupId, name: groupName });
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!groupToDelete) return;

    try {
      await groupAPI.deleteGroup(groupToDelete.id);
      setShowDeleteModal(false);
      setGroupToDelete(null);
      setNotificationMessage('Group deleted successfully');
      setShowNotification(true);
      
      setTimeout(() => {
        setShowNotification(false);
      }, 3000);
      
      fetchGroups();
    } catch (error) {
      setShowDeleteModal(false);
      setGroupToDelete(null);
      if (error.response && error.response.data && error.response.data.message) {
        setErrorMessage(error.response.data.message);
      } else {
        setErrorMessage('Failed to delete group. Please try again.');
      }
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setGroupToDelete(null);
  };

  const handleBack = () => {
    navigate('/dashboard');
  };

  const hasNoGroups = !isLoading && !errorMessage && ownedGroups.length === 0 && memberGroups.length === 0;

  return (
    <>
      <Navbar />
      <div className={styles.container}>
        <button onClick={handleBack} className={styles.backButton}>
          ← Back
        </button>
        
        <h1 className={`${styles.pageTitle} ${hasNoGroups ? styles.pageTitleCentered : ''}`}>My Groups</h1>

        {isLoading && (
          <div className={styles.loading}>Loading groups...</div>
        )}

        {errorMessage && (
          <div className={styles.errorMessage}>{errorMessage}</div>
        )}

        {!isLoading && !errorMessage && (
          <div className={styles.groupsContainer}>
            {ownedGroups.length > 0 && (
              <div className={styles.section}>
                <h2 className={styles.sectionTitle}>Groups You Own</h2>
                <div className={styles.groupsList}>
                  {ownedGroups.map((group) => (
                    <div
                      key={group.id}
                      className={styles.groupCardOwner}
                    >
                      <h3 className={styles.groupName}>{group.name}</h3>
                      <p className={styles.groupDescription}>{group.description || 'No description'}</p>
                      <div className={styles.groupMeta}>
                        <span className={styles.badge}>Owner</span>
                        <span className={styles.memberCount}>{group.member_count || 0} members</span>
                      </div>
                      <div className={styles.groupActions}>
                        <button 
                          className={styles.enterButton}
                          onClick={() => handleGroupClick(group.id)}
                        >
                          Enter
                        </button>
                        <button 
                          className={styles.deleteButton}
                          onClick={(e) => handleDeleteGroup(e, group.id, group.name)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {memberGroups.length > 0 && (
              <div className={styles.section}>
                <h2 className={styles.sectionTitle}>Groups You're In</h2>
                <div className={styles.groupsList}>
                  {memberGroups.map((group) => (
                    <div
                      key={group.id}
                      className={styles.groupCardMember}
                    >
                      <h3 className={styles.groupName}>{group.name}</h3>
                      <p className={styles.groupDescription}>{group.description || 'No description'}</p>
                      <div className={styles.groupMeta}>
                        <span className={styles.badge}>Member</span>
                        <span className={styles.memberCount}>{group.member_count || 0} members</span>
                      </div>
                      <div className={styles.groupActions}>
                        <button 
                          className={styles.enterButton}
                          onClick={() => handleGroupClick(group.id)}
                        >
                          Enter
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {ownedGroups.length === 0 && memberGroups.length === 0 && (
              <div className={styles.emptyState}>
                <p>You haven't joined any groups yet.</p>
                <button onClick={() => navigate('/join-group')} className={styles.joinButton}>
                  Join a Group
                </button>
              </div>
            )}
          </div>
        )}

        {showNotification && (
          <div className={styles.notification}>
            {notificationMessage}
          </div>
        )}

        <ConfirmModal
          isOpen={showDeleteModal}
          title="Delete Group"
          message={`Are you sure you want to delete "${groupToDelete?.name}"? This action cannot be undone and all tasks will be permanently deleted.`}
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
          confirmText="Delete"
          cancelText="Cancel"
        />
      </div>
    </>
  );
}

export default MyGroups;

