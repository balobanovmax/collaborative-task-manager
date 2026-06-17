import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styles from './GroupView.module.css';
import Navbar from '../components/common/Navbar';
import TaskManagementModal from '../components/tasks/TaskManagementModal';
import TaskCommentThread from '../components/tasks/TaskCommentThread';
import TaskAttachments from '../components/tasks/TaskAttachments';
import TaskDrawings from '../components/tasks/TaskDrawings';
import ConfirmModal from '../components/common/ConfirmModal';
import MemberProfileModal from '../components/groups/MemberProfileModal';
import ChatPanel from '../components/chat/ChatPanel';
import VoiceChatPanel from '../components/chat/VoiceChatPanel';
import VoiceChatDock from '../components/chat/VoiceChatDock';
import VoiceRemoteAudio from '../components/chat/VoiceRemoteAudio';
import { MicStatusIcon, CameraStatusIcon } from '../components/chat/VoiceIcons';
import UserAvatar from '../components/common/UserAvatar';
import { groupAPI, userAPI } from '../services/api';
import { getUser } from '../utils/auth';
import { useVoiceChat } from '../hooks/useVoiceChat';
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
  onChatCleared,
  onGroupUpdated,
  onJoinRequestUpdated,
  onTaskCommentCreated,
  onTaskAttachmentAdded,
  onTaskDrawingAdded,
  onVoiceRosterUpdated
} from '../services/socket';
import { requestVoiceRoster } from '../services/voiceChat';

const getTaskAssignee = (task) => {
  if (task.assignee) {
    return task.assignee;
  }

  if (task.assigned_to) {
    return {
      id: task.assigned_to,
      username: task.assignee_username || 'Unknown',
      profile_picture_url: task.assignee_profile_picture_url || null
    };
  }

  return null;
};

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
  const [isVoiceChatOpen, setIsVoiceChatOpen] = useState(false);
  const [voiceParticipants, setVoiceParticipants] = useState([]);
  const voiceChat = useVoiceChat(parseInt(groupId, 10), currentUser);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [unreadMentionCount, setUnreadMentionCount] = useState(0);
  const isChatOpenRef = useRef(false);
  const currentUserIdRef = useRef(currentUser?.id);
  const [isMembersExpanded, setIsMembersExpanded] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editIsPublic, setEditIsPublic] = useState(true);
  const [editPassword, setEditPassword] = useState('');
  const [editError, setEditError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [selectedMember, setSelectedMember] = useState(null);
  const [joinRequests, setJoinRequests] = useState([]);
  const [isJoinRequestsExpanded, setIsJoinRequestsExpanded] = useState(true);
  const [reviewingRequestId, setReviewingRequestId] = useState(null);

  useEffect(() => {
    setAssigneeFilter('all');
    setSelectedMember(null);
    setJoinRequests([]);
  }, [groupId]);

  const filteredTasks = tasks.filter((task) => {
    if (assigneeFilter === 'all') {
      return true;
    }

    if (assigneeFilter === 'unassigned') {
      return !task.assigned_to;
    }

    if (assigneeFilter === 'me') {
      return Number(task.assigned_to) === Number(currentUser?.id);
    }

    return Number(task.assigned_to) === Number(assigneeFilter);
  });

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

      const loadedGroup = groupResponse.data.group;
      if (loadedGroup && Number(currentUser?.id) === Number(loadedGroup.owner_id)) {
        try {
          const requestsResponse = await groupAPI.getJoinRequests(parseInt(groupId));
          setJoinRequests(requestsResponse.data.requests || []);
        } catch {
          setJoinRequests([]);
        }
      } else {
        setJoinRequests([]);
      }

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
  }, [groupId, navigate, currentUser?.id]);

  useEffect(() => {
    fetchGroupData();
  }, [fetchGroupData]);

  useEffect(() => {
    isChatOpenRef.current = isChatOpen;
  }, [isChatOpen]);

  useEffect(() => {
    currentUserIdRef.current = currentUser?.id;
  }, [currentUser?.id]);

  useEffect(() => {
    setUnreadMessageCount(0);
    setUnreadMentionCount(0);
    setVoiceParticipants([]);
    setIsVoiceChatOpen(false);
  }, [groupId]);

  const handleEnterVoiceChat = async () => {
    if (!voiceChat.isInVoice && !voiceChat.isConnecting) {
      const joined = await voiceChat.join();
      if (!joined) {
        return;
      }
    }
    setIsVoiceChatOpen(true);
  };

  const handleLeaveVoiceChat = () => {
    voiceChat.leave();
    setIsVoiceChatOpen(false);
  };

  useEffect(() => {
    let mounted = true;
    const groupIdInt = parseInt(groupId);
    const unsubscribers = [];

    const setupSocket = async () => {
      await connectSocket();
      
      if (!mounted) return;
      
      joinGroup(groupIdInt);
      requestVoiceRoster(groupIdInt);

      unsubscribers.push(onVoiceRosterUpdated((data) => {
        if (mounted && Number(data.groupId) === groupIdInt) {
          setVoiceParticipants(data.participants || []);
        }
      }));

      unsubscribers.push(onTaskCreated((data) => {
        if (mounted) {
          setTasks(prevTasks => {
            const exists = prevTasks.some(t => t.id === data.task.id);
            if (exists) return prevTasks;
            return [...prevTasks, data.task];
          });
        }
      }));

      unsubscribers.push(onTaskUpdated((data) => {
        if (mounted) {
          setTasks(prevTasks => 
            prevTasks.map(task => 
              task.id === data.task.id ? data.task : task
            )
          );
        }
      }));

      unsubscribers.push(onTaskDeleted((data) => {
        if (mounted) {
          setTasks(prevTasks => 
            prevTasks.filter(task => task.id !== data.taskId)
          );
        }
      }));

      unsubscribers.push(onTaskToggled((data) => {
        if (mounted) {
          setTasks(prevTasks => 
            prevTasks.map(task => 
              task.id === data.task.id ? data.task : task
            )
          );
        }
      }));

      unsubscribers.push(onMemberJoined((data) => {
        if (mounted) {
          setMembers(prevMembers => {
            const exists = prevMembers.some(m => m.user_id === data.member.user_id);
            if (exists) return prevMembers;
            return [...prevMembers, data.member];
          });
        }
      }));

      unsubscribers.push(onMemberRemoved((data) => {
        if (mounted) {
          if (data.userId === currentUserIdRef.current) {
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
      }));

      unsubscribers.push(onMessageSent((data) => {
        if (!mounted || isChatOpenRef.current) {
          return;
        }

        const messageGroupId = Number(data.message.group_id);
        const messageUserId = Number(data.message.user_id);
        const viewerUserId = Number(currentUserIdRef.current);

        if (messageGroupId !== groupIdInt) {
          return;
        }

        if (messageUserId === viewerUserId) {
          return;
        }

        setUnreadMessageCount(prev => prev + 1);

        const mentionsCurrentUser = (data.message.mentions || []).some(
          (mention) => Number(mention.user_id) === viewerUserId
        );

        if (mentionsCurrentUser) {
          setUnreadMentionCount(prev => prev + 1);
        }
      }));

      unsubscribers.push(onChatCleared((data) => {
        if (mounted && !isChatOpenRef.current && Number(data.groupId) === groupIdInt) {
          setUnreadMessageCount(0);
          setUnreadMentionCount(0);
        }
      }));

      unsubscribers.push(onGroupUpdated(() => {
        if (mounted) {
          fetchGroupData(false);
        }
      }));

      unsubscribers.push(onJoinRequestUpdated((data) => {
        if (!mounted || Number(data.request.group_id) !== groupIdInt) {
          return;
        }

        if (data.action === 'approved' || data.action === 'rejected') {
          setJoinRequests((prev) => prev.filter((request) => request.id !== data.request.id));
        }
      }));

      unsubscribers.push(onTaskCommentCreated((data) => {
        if (!mounted) {
          return;
        }

        if (Number(data.comment.user_id) === Number(currentUserIdRef.current)) {
          return;
        }

        setTasks((prevTasks) =>
          prevTasks.map((task) =>
            Number(task.id) === Number(data.taskId)
              ? { ...task, comment_count: (task.comment_count || 0) + 1 }
              : task
          )
        );
      }));

      unsubscribers.push(onTaskAttachmentAdded((data) => {
        if (!mounted) {
          return;
        }

        if (Number(data.attachment.user_id) === Number(currentUserIdRef.current)) {
          return;
        }

        setTasks((prevTasks) =>
          prevTasks.map((task) =>
            Number(task.id) === Number(data.taskId)
              ? { ...task, attachment_count: (task.attachment_count || 0) + 1 }
              : task
          )
        );
      }));

      unsubscribers.push(onTaskDrawingAdded((data) => {
        if (!mounted) {
          return;
        }

        if (Number(data.drawing.user_id) === Number(currentUserIdRef.current)) {
          return;
        }

        setTasks((prevTasks) =>
          prevTasks.map((task) =>
            Number(task.id) === Number(data.taskId)
              ? { ...task, drawing_count: (task.drawing_count || 0) + 1 }
              : task
          )
        );
      }));
    };

    setupSocket();

    return () => {
      mounted = false;
      leaveGroup(groupIdInt);
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [groupId, fetchGroupData, navigate]);

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

  const handleTaskCommentAdded = (taskId) => {
    setTasks((prevTasks) =>
      prevTasks.map((task) =>
        Number(task.id) === Number(taskId)
          ? { ...task, comment_count: (task.comment_count || 0) + 1 }
          : task
      )
    );
  };

  const handleTaskAttachmentAdded = (taskId) => {
    setTasks((prevTasks) =>
      prevTasks.map((task) =>
        Number(task.id) === Number(taskId)
          ? { ...task, attachment_count: (task.attachment_count || 0) + 1 }
          : task
      )
    );
  };

  const handleTaskDrawingAdded = (taskId) => {
    setTasks((prevTasks) =>
      prevTasks.map((task) =>
        Number(task.id) === Number(taskId)
          ? { ...task, drawing_count: (task.drawing_count || 0) + 1 }
          : task
      )
    );
  };

  const handleRemoveMember = (memberId, memberName) => {
    setConfirmModal({ isOpen: true, memberId, memberName });
  };

  const handleReviewJoinRequest = async (requestId, action) => {
    setReviewingRequestId(requestId);
    setErrorMessage('');

    try {
      await groupAPI.reviewJoinRequest(parseInt(groupId), requestId, action);
      setJoinRequests((prev) => prev.filter((request) => request.id !== requestId));
      setSuccessMessage(action === 'approve' ? 'Join request approved' : 'Join request declined');
      fetchGroupData(false);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      if (error.response?.data?.message) {
        setErrorMessage(error.response.data.message);
      } else {
        setErrorMessage('Failed to review join request. Please try again.');
      }
    } finally {
      setReviewingRequestId(null);
    }
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

  const openMemberProfile = async (member) => {
    setSelectedMember(member);

    try {
      const response = await userAPI.getPublicProfile(member.user_id);
      setSelectedMember({
        ...member,
        ...response.data.user
      });
    } catch {
      setSelectedMember(member);
    }
  };

  const closeMemberProfile = () => {
    setSelectedMember(null);
  };

  const handleMemberCardKeyDown = (event, member, isCurrentUser) => {
    if (isCurrentUser) {
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openMemberProfile(member);
    }
  };

  const openEditModal = () => {
    setEditName(group?.name || '');
    setEditDescription(group?.description || '');
    setEditIsPublic(group?.is_public ?? true);
    setEditPassword('');
    setEditError('');
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setEditName('');
    setEditDescription('');
    setEditIsPublic(true);
    setEditPassword('');
    setEditError('');
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editName.trim()) return;

    try {
      setIsEditing(true);
      setEditError('');

      const updatePayload = {
        name: editName.trim(),
        description: editDescription.trim(),
        is_public: editIsPublic
      };

      if (!editIsPublic && editPassword.trim()) {
        updatePayload.join_password = editPassword.trim();
      }

      await groupAPI.updateGroup(parseInt(groupId), updatePayload);
      setIsEditModalOpen(false);
      setSuccessMessage('Group updated successfully');
      fetchGroupData(false);
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (error) {
      if (error.response && error.response.data && error.response.data.message) {
        setEditError(error.response.data.message);
      } else {
        setEditError('Failed to update group. Please try again.');
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
            {currentUser?.id === group?.owner_id && (
              <div className={styles.joinRequestsSection}>
                <button
                  className={styles.joinRequestsSectionHeader}
                  onClick={() => setIsJoinRequestsExpanded(!isJoinRequestsExpanded)}
                >
                  <span>
                    Join Requests
                    {joinRequests.length > 0 && (
                      <span className={styles.joinRequestsBadge}>{joinRequests.length}</span>
                    )}
                  </span>
                  <span className={`${styles.expandArrow} ${isJoinRequestsExpanded ? styles.expanded : ''}`}>
                    ▼
                  </span>
                </button>
                {isJoinRequestsExpanded && (
                  <div className={styles.joinRequestsList}>
                    {joinRequests.length === 0 ? (
                      <p className={styles.joinRequestsEmpty}>No pending requests</p>
                    ) : (
                      joinRequests.map((request) => (
                        <div key={request.id} className={styles.joinRequestCard}>
                          <div className={styles.joinRequestHeader}>
                            <UserAvatar
                              username={request.username}
                              profilePictureUrl={request.profile_picture_url}
                              size="sm"
                            />
                            <div className={styles.joinRequestInfo}>
                              <span className={styles.joinRequestName}>{request.username}</span>
                              {request.message && (
                                <p className={styles.joinRequestMessage}>{request.message}</p>
                              )}
                            </div>
                          </div>
                          <div className={styles.joinRequestActions}>
                            <button
                              type="button"
                              className={styles.approveButton}
                              onClick={() => handleReviewJoinRequest(request.id, 'approve')}
                              disabled={reviewingRequestId === request.id}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className={styles.rejectButton}
                              onClick={() => handleReviewJoinRequest(request.id, 'reject')}
                              disabled={reviewingRequestId === request.id}
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
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
                    <div
                      key={member.user_id}
                      className={`${styles.memberCard} ${!isCurrentUser ? styles.memberCardClickable : ''}`}
                      onClick={!isCurrentUser ? () => openMemberProfile(member) : undefined}
                      onKeyDown={(event) => handleMemberCardKeyDown(event, member, isCurrentUser)}
                      role={!isCurrentUser ? 'button' : undefined}
                      tabIndex={!isCurrentUser ? 0 : undefined}
                      title={!isCurrentUser ? `View ${member.username}'s profile` : undefined}
                    >
                      <UserAvatar
                        username={member.username}
                        profilePictureUrl={member.profile_picture_url}
                        size="sm"
                      />
                      <div className={styles.memberInfo}>
                        <div className={styles.memberNameRow}>
                          <span className={styles.memberName}>{member.username}</span>
                            {isCurrentUser && (
                            <span className={styles.youBadge}>You</span>
                            )}
                            {canRemove && (
                              <button
                                className={styles.removeMemberButton}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleRemoveMember(member.user_id, member.username);
                                }}
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
            <div className={styles.chatButtons}>
              <button
                className={`${styles.chatButton} ${unreadMessageCount > 0 ? styles.chatButtonNotification : ''} ${unreadMentionCount > 0 ? styles.chatButtonMention : ''}`}
                onClick={() => {
                  setIsChatOpen(true);
                  setUnreadMessageCount(0);
                  setUnreadMentionCount(0);
                }}
                title={
                  unreadMessageCount > 0
                    ? `${unreadMessageCount} unread message${unreadMessageCount === 1 ? '' : 's'}${unreadMentionCount > 0 ? `, ${unreadMentionCount} mentioned you` : ''}`
                    : 'Open text chat'
                }
              >
                Enter Text Chat
                {unreadMessageCount > 0 && (
                  <span className={`${styles.chatBadge} ${unreadMentionCount > 0 ? styles.chatBadgeMention : ''}`}>
                    {unreadMentionCount > 0 ? `@${unreadMessageCount > 99 ? '99+' : unreadMessageCount}` : (unreadMessageCount > 99 ? '99+' : unreadMessageCount)}
                  </span>
                )}
              </button>

              <button
                className={`${styles.voiceChatButton} ${(voiceParticipants.length > 0 || voiceChat.isInVoice) ? styles.voiceChatButtonActive : ''}`}
                onClick={handleEnterVoiceChat}
                disabled={voiceChat.isConnecting}
                title={
                  voiceChat.isInVoice
                    ? 'Open voice chat panel (you are connected)'
                    : voiceParticipants.length > 0
                      ? `${voiceParticipants.length} teammate${voiceParticipants.length === 1 ? '' : 's'} in voice chat`
                      : 'Join voice and video chat'
                }
              >
                {voiceChat.isInVoice ? 'Open Voice Chat' : 'Enter Voice Chat'}
                {(voiceParticipants.length > 0 || voiceChat.isInVoice) && (
                  <span className={styles.voiceBadge}>
                    {voiceParticipants.length > 99 ? '99+' : Math.max(voiceParticipants.length, voiceChat.isInVoice ? 1 : 0)}
                  </span>
                )}
              </button>
            </div>

            {voiceParticipants.length > 0 && (
              <div className={styles.voiceRosterSection}>
                <span className={styles.voiceRosterTitle}>In voice chat</span>
                <div className={styles.voiceRosterList}>
                  {voiceParticipants.map((participant) => (
                    <span key={participant.user_id} className={styles.voiceRosterChip}>
                      {participant.username}
                      <MicStatusIcon enabled={participant.mic_enabled} size={12} className={styles.voiceRosterIcon} />
                      <CameraStatusIcon enabled={participant.camera_enabled} size={12} className={styles.voiceRosterIcon} />
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className={styles.mainContent}>
            <div className={styles.tasksSection}>
              <div className={styles.tasksSectionHeader}>
                <div className={styles.tasksHeaderLeft}>
                  <h2 className={styles.sectionTitle}>
                    Tasks ({filteredTasks.length}{filteredTasks.length !== tasks.length ? ` / ${tasks.length}` : ''})
                  </h2>
                  <select
                    className={styles.assigneeFilter}
                    value={assigneeFilter}
                    onChange={(e) => setAssigneeFilter(e.target.value)}
                    aria-label="Filter tasks by assignee"
                  >
                    <option value="all">All assignees</option>
                    <option value="unassigned">Unassigned</option>
                    <option value="me">Assigned to me</option>
                    {members.map((member) => (
                      <option key={member.user_id} value={member.user_id}>
                        {member.username}
                      </option>
                    ))}
                  </select>
                </div>
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
              ) : filteredTasks.length === 0 ? (
                <div className={styles.emptyState}>
                  <p>No tasks match this assignee filter.</p>
                </div>
              ) : (
                <div className={styles.tasksList}>
                  {filteredTasks.map((task) => {
                    const status = task.is_completed ? 'completed' : 'pending';
                    const assignee = getTaskAssignee(task);
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

                      <div className={styles.assigneeRow}>
                        {assignee ? (
                          <>
                            <UserAvatar
                              username={assignee.username}
                              profilePictureUrl={assignee.profile_picture_url}
                              size="sm"
                            />
                            <span className={styles.assigneeLabel}>
                              Assigned to <strong>{assignee.username}</strong>
                            </span>
                          </>
                        ) : (
                          <span className={styles.unassignedLabel}>Unassigned</span>
                        )}
                      </div>
                      
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

                      <TaskCommentThread
                        taskId={task.id}
                        groupId={parseInt(groupId)}
                        initialCount={task.comment_count || 0}
                        onCommentAdded={handleTaskCommentAdded}
                      />

                      <TaskAttachments
                        taskId={task.id}
                        initialCount={task.attachment_count || 0}
                        taskCreatedBy={task.created_by}
                        groupOwnerId={group?.owner_id}
                        onAttachmentAdded={handleTaskAttachmentAdded}
                      />

                      <TaskDrawings
                        taskId={task.id}
                        initialCount={task.drawing_count || 0}
                        taskCreatedBy={task.created_by}
                        groupOwnerId={group?.owner_id}
                        onDrawingAdded={handleTaskDrawingAdded}
                      />
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
          members={members}
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

        <MemberProfileModal
          member={selectedMember}
          isGroupOwner={selectedMember?.user_id === group?.owner_id}
          onClose={closeMemberProfile}
        />

        <ChatPanel
          groupId={parseInt(groupId)}
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          isOwner={currentUser?.id === group?.owner_id}
          members={members}
        />

        {voiceChat.isInVoice && (
          <VoiceRemoteAudio remoteStreams={voiceChat.remoteStreams} />
        )}

        <VoiceChatDock
          isVisible={voiceChat.isInVoice && !isVoiceChatOpen}
          micEnabled={voiceChat.micEnabled}
          cameraEnabled={voiceChat.cameraEnabled}
          participantCount={voiceChat.participants.length || 1}
          onToggleMic={voiceChat.toggleMic}
          onToggleCamera={voiceChat.toggleCamera}
          onExpand={() => setIsVoiceChatOpen(true)}
          onLeave={handleLeaveVoiceChat}
        />

        <VoiceChatPanel
          groupId={parseInt(groupId, 10)}
          isOpen={isVoiceChatOpen}
          onMinimize={() => setIsVoiceChatOpen(false)}
          onLeave={handleLeaveVoiceChat}
          members={members}
          currentUser={currentUser}
          isInVoice={voiceChat.isInVoice}
          isConnecting={voiceChat.isConnecting}
          error={voiceChat.error}
          participants={voiceChat.participants}
          localStream={voiceChat.localStream}
          remoteStreams={voiceChat.remoteStreams}
          micEnabled={voiceChat.micEnabled}
          cameraEnabled={voiceChat.cameraEnabled}
          onToggleMic={voiceChat.toggleMic}
          onToggleCamera={voiceChat.toggleCamera}
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
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Privacy</label>
                  <div className={styles.radioGroup}>
                    <label className={styles.radioLabel}>
                      <input
                        type="radio"
                        name="editPrivacy"
                        checked={editIsPublic}
                        onChange={() => {
                          setEditIsPublic(true);
                          setEditPassword('');
                          setEditError('');
                        }}
                        disabled={isEditing}
                      />
                      <span>Public (anyone can join)</span>
                    </label>
                    <label className={styles.radioLabel}>
                      <input
                        type="radio"
                        name="editPrivacy"
                        checked={!editIsPublic}
                        onChange={() => setEditIsPublic(false)}
                        disabled={isEditing}
                      />
                      <span>Private (requires password)</span>
                    </label>
                  </div>
                </div>
                {!editIsPublic && (
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>
                      {group?.is_public ? 'Password' : 'New Password (optional)'}
                    </label>
                    <input
                      type="password"
                      className={styles.formInput}
                      placeholder={group?.is_public ? 'Enter group password' : 'Leave blank to keep current password'}
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      disabled={isEditing}
                    />
                    <p className={styles.helperText}>
                      {group?.is_public
                        ? 'Set a password for instant join, or leave blank for request-to-join'
                        : 'Enter a new password to change it, or leave blank to keep current settings'}
                    </p>
                  </div>
                )}
                {editError && (
                  <div className={styles.editError}>{editError}</div>
                )}
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

