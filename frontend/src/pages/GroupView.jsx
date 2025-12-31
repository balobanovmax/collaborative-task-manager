import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styles from './GroupView.module.css';
import Navbar from '../components/common/Navbar';
import TaskManagementModal from '../components/tasks/TaskManagementModal';
import ConfirmModal from '../components/common/ConfirmModal';
import ChatPanel from '../components/chat/ChatPanel';
import { groupAPI } from '../services/api';
import { getUser } from '../utils/auth';
import {
  connectSocket,
  joinGroup,
  leaveGroup,
  onTaskCreated,
  onTaskUpdated,
  onTaskDeleted,
  onTaskToggled,
  onMemberJoined,
  onMemberRemoved,
  onMessageSent,
  onGroupUpdated,
  removeAllListeners
} from '../services/socket';

function GroupView() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const currentUser = getUser();
  
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, memberId: null, memberName: '' });
  const [removedMessage, setRemovedMessage] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [isMembersExpanded, setIsMembersExpanded] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const fetchGroupData = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
      setIsLoading(true);
      }
      setErrorMessage('');
      setRemovedMessage('');

      const membersResponse = await groupAPI.getGroupMembers(parseInt(groupId));

      const [groupResponse, tasksResponse] = await Promise.all([
        groupAPI.getGroupDetails(parseInt(groupId)),
        groupAPI.getGroupTasks(parseInt(groupId))
      ]);

      setGroup(groupResponse.data.group);
      setMembers(membersResponse.data.members);
      setTasks(tasksResponse.data.tasks || []);
      setIsLoading(false);
    } catch (error) {
      setIsLoading(false);
      if (error.response && error.response.status === 403) {
        setRemovedMessage('You are not a member of this group');
        setTimeout(() => {
          navigate('/my-groups');
        }, 2000);
      } else if (error.response && error.response.status === 404) {
        setErrorMessage('Group not found');
      } else if (error.response && error.response.data && error.response.data.message) {
        setErrorMessage(error.response.data.message);
      } else {
        setErrorMessage('Failed to load group. Please try again.');
      }
    }
  }, [groupId, navigate]);

  useEffect(() => {
    fetchGroupData();
  }, [fetchGroupData]);

  useEffect(() => {
    let mounted = true;
    const groupIdInt = parseInt(groupId);

    const setupSocket = async () => {
      await connectSocket();
      
      if (!mounted) return;
      
      joinGroup(groupIdInt);

      onTaskCreated((data) => {
        if (mounted) {
          setTasks(prevTasks => {
            const exists = prevTasks.some(t => t.id === data.task.id);
            if (exists) return prevTasks;
            return [...prevTasks, data.task];
          });
        }
      });

      onTaskUpdated((data) => {
        if (mounted) {
          setTasks(prevTasks => 
            prevTasks.map(task => 
              task.id === data.task.id ? data.task : task
            )
          );
        }
      });

      onTaskDeleted((data) => {
        if (mounted) {
          setTasks(prevTasks => 
            prevTasks.filter(task => task.id !== data.taskId)
          );
        }
      });

      onTaskToggled((data) => {
        if (mounted) {
          setTasks(prevTasks => 
            prevTasks.map(task => 
              task.id === data.task.id ? data.task : task
            )
          );
        }
      });

      onMemberJoined((data) => {
        if (mounted) {
          setMembers(prevMembers => {
            const exists = prevMembers.some(m => m.user_id === data.member.user_id);
            if (exists) return prevMembers;
            return [...prevMembers, data.member];
          });
        }
      });

      onMemberRemoved((data) => {
        if (mounted) {
          if (data.userId === currentUser?.id) {
            setRemovedMessage('You have been removed from this group');
            setTimeout(() => {
              navigate('/my-groups');
            }, 2000);
          } else {
            setMembers(prevMembers => 
              prevMembers.filter(m => m.user_id !== data.userId)
            );
          }
        }
      });

      onMessageSent((data) => {
        if (mounted && data.message.user_id !== currentUser?.id) {
          setIsChatOpen(prev => {
            if (!prev) {
              setHasNewMessages(true);
            }
            return prev;
          });
        }
      });

      onGroupUpdated(() => {
        if (mounted) {
          fetchGroupData(false);
        }
      });
    };

    setupSocket();

    return () => {
      mounted = false;
      leaveGroup(groupIdInt);
      removeAllListeners();
    };
  }, [groupId, currentUser?.id, navigate]);

  const handleBack = () => {
    navigate('/my-groups');
  };

  const handleTaskUpdated = () => {
    setIsModalOpen(false);
    setSuccessMessage('Operation completed successfully!');
    fetchGroupData(false);
    setTimeout(() => {
      setSuccessMessage('');
    }, 3000);
  };

  const handleRemoveMember = (memberId, memberName) => {
    setConfirmModal({ isOpen: true, memberId, memberName });
  };

  const confirmRemoveMember = async () => {
    try {
      await groupAPI.removeMember(parseInt(groupId), confirmModal.memberId);
      setConfirmModal({ isOpen: false, memberId: null, memberName: '' });
      setSuccessMessage('Member removed successfully');
      fetchGroupData(false);
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (error) {
      setConfirmModal({ isOpen: false, memberId: null, memberName: '' });
      if (error.response && error.response.data && error.response.data.message) {
        setErrorMessage(error.response.data.message);
      } else {
        setErrorMessage('Failed to remove member. Please try again.');
      }
    }
  };

  const cancelRemoveMember = () => {
    setConfirmModal({ isOpen: false, memberId: null, memberName: '' });
  };

  const openEditModal = () => {
    setEditName(group?.name || '');
    setEditDescription(group?.description || '');
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setEditName('');
    setEditDescription('');
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editName.trim()) return;
    
    try {
      setIsEditing(true);
      await groupAPI.updateGroup(parseInt(groupId), editName.trim(), editDescription.trim());
      setIsEditModalOpen(false);
      setSuccessMessage('Group updated successfully');
      fetchGroupData(false);
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (error) {
      if (error.response && error.response.data && error.response.data.message) {
        setErrorMessage(error.response.data.message);
      } else {
        setErrorMessage('Failed to update group. Please try again.');
      }
    } finally {
      setIsEditing(false);
    }
  };

  if (isLoading) {
    return (
      <>
        <Navbar />
        <div className={styles.container}>
          <div className={styles.loading}>Loading group...</div>
        </div>
      </>
    );
  }

  if (errorMessage) {
    return (
      <>
        <Navbar />
        <div className={styles.container}>
          <button onClick={handleBack} className={styles.backButton}>
            ← Back to My Groups
          </button>
          <div className={styles.error}>{errorMessage}</div>
        </div>
      </>
    );
  }

  if (removedMessage) {
    return (
      <>
        <Navbar />
        <div className={styles.container}>
          <div className={styles.accessDenied}>
            <div className={styles.accessDeniedMessage}>{removedMessage}</div>
            <p className={styles.redirectingText}>Redirecting to My Groups...</p>
          </div>
        </div>
      </>
    );
  }

  if (!group) {
    return (
      <>
        <Navbar />
        <div className={styles.container}>
          <div className={styles.loading}>Loading group...</div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className={styles.container}>
        <button onClick={handleBack} className={styles.backButton}>
          ← Back to My Groups
        </button>

        <div className={styles.header}>
          <div className={styles.headerTop}>
            <div className={styles.headerTitleSection}>
              <h1 className={styles.groupName}>{group?.name}</h1>
              {currentUser?.id === group?.owner_id && (
                <button className={styles.editButton} onClick={openEditModal}>
                  Edit
                </button>
              )}
            </div>
            {group?.description && (
              <p className={styles.groupDescription}>{group.description}</p>
            )}
          </div>
          <div className={styles.groupIdBox}>
            <span className={styles.groupIdLabel}>Group ID</span>
            <span className={styles.groupIdValue}>{groupId}</span>
          </div>
        </div>

        <div className={styles.content}>
          <div className={styles.sidebar}>
            <div className={styles.membersSection}>
              <button 
                className={styles.membersSectionHeader}
                onClick={() => setIsMembersExpanded(!isMembersExpanded)}
              >
                <span>Members ({members.length})</span>
                <span className={`${styles.expandArrow} ${isMembersExpanded ? styles.expanded : ''}`}>
                  ▼
                </span>
              </button>
              {isMembersExpanded && (
                <div className={styles.membersList}>
                  {members.map((member) => {
                    const isOwner = member.user_id === group?.owner_id;
                    const isCurrentUser = member.user_id === currentUser?.id;
                    const canRemove = currentUser?.id === group?.owner_id && !isOwner && !isCurrentUser;
                    
                    return (
                    <div key={member.user_id} className={styles.memberCard}>
                      <div className={styles.memberInfo}>
                        <div className={styles.memberNameRow}>
                          <span className={styles.memberName}>{member.username}</span>
                            {isCurrentUser && (
                            <span className={styles.youBadge}>You</span>
                            )}
                            {canRemove && (
                              <button
                                className={styles.removeMemberButton}
                                onClick={() => handleRemoveMember(member.user_id, member.username)}
                                title="Remove member"
                              >
                                Manage
                              </button>
                            )}
                          </div>
                          {isOwner && (
                            <span className={styles.ownerBadge}>Owner</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <button
              className={`${styles.chatButton} ${hasNewMessages ? styles.chatButtonNotification : ''}`}
              onClick={() => {
                setIsChatOpen(true);
                setHasNewMessages(false);
              }}
            >
              {hasNewMessages ? 'New Messages!' : 'Enter Chat'}
            </button>
          </div>

          <div className={styles.mainContent}>
            <div className={styles.tasksSection}>
              <div className={styles.tasksSectionHeader}>
                <h2 className={styles.sectionTitle}>Tasks ({tasks.length})</h2>
                <button 
                  className={styles.manageTasksButton}
                  onClick={() => setIsModalOpen(true)}
                >
                  Manage Tasks
                </button>
              </div>

              {tasks.length === 0 ? (
                <div className={styles.emptyState}>
                  <p>No tasks yet. Create one to get started!</p>
                </div>
              ) : (
                <div className={styles.tasksList}>
                  {tasks.map((task) => {
                    const status = task.is_completed ? 'completed' : 'pending';
                    return (
                    <div key={task.id} className={styles.taskCard}>
                      <div className={styles.taskHeader}>
                        <h3 className={styles.taskTitle}>{task.title}</h3>
                          <span className={`${styles.statusBadge} ${styles[status]}`}>
                            {status}
                        </span>
                      </div>
                      
                      {task.description && (
                        <p className={styles.taskDescription}>{task.description}</p>
                      )}
                      
                      <div className={styles.taskMeta}>
                        <span className={styles.taskInfo}>
                            Created by: {task.creator_username || task.creator?.username || 'Unknown'}
                        </span>
                        {task.due_date && (
                          <span className={styles.taskInfo}>
                            Due: {new Date(task.due_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>

                        {task.is_completed && (task.completer_username || task.completer?.username) && (
                        <div className={styles.completedInfo}>
                            ✓ Completed by {task.completer_username || task.completer?.username}
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {successMessage && (
          <div className={styles.successNotification}>
            {successMessage}
          </div>
        )}

        <TaskManagementModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          groupId={parseInt(groupId)}
          tasks={tasks}
          onTaskUpdated={handleTaskUpdated}
        />

        <ConfirmModal
          isOpen={confirmModal.isOpen}
          title="Remove Member"
          message={`Are you sure you want to remove ${confirmModal.memberName} from this group?`}
          onConfirm={confirmRemoveMember}
          onCancel={cancelRemoveMember}
          confirmText="Remove"
          cancelText="Cancel"
        />

        <ChatPanel
          groupId={parseInt(groupId)}
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          isOwner={currentUser?.id === group?.owner_id}
        />

        {isEditModalOpen && (
          <div className={styles.modalOverlay} onClick={closeEditModal}>
            <div className={styles.editModal} onClick={(e) => e.stopPropagation()}>
              <h2 className={styles.editModalTitle}>Edit Group</h2>
              <form onSubmit={handleEditSubmit}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Group Name</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    maxLength={100}
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Description</label>
                  <textarea
                    className={styles.formTextarea}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    maxLength={500}
                    rows={4}
                  />
                </div>
                <div className={styles.editModalActions}>
                  <button
                    type="button"
                    className={styles.cancelButton}
                    onClick={closeEditModal}
                    disabled={isEditing}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={styles.saveButton}
                    disabled={isEditing || !editName.trim()}
                  >
                    {isEditing ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default GroupView;

