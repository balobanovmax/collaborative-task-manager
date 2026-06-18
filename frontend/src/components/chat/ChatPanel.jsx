import { useState, useEffect, useRef } from 'react';
import styles from './ChatPanel.module.css';
import { messageAPI } from '../../services/api';
import { onMessageSent, onChatCleared, onChatTyping, emitChatTyping, onSocketReconnect } from '../../services/socket';
import { getUser } from '../../utils/auth';
import {
  renderMessageWithMentions,
  getMentionQueryAtCursor,
  insertMention
} from '../../utils/renderMentions';
import {
  MAX_VOICE_MESSAGE_SECONDS,
  getRecordingMimeType,
  getExtensionForMimeType,
  formatVoiceDuration
} from '../../utils/voiceMessage';
import { resolveMediaUrl } from '../../utils/backendUrl';
import { formatTypingLabel } from '../../utils/chatTyping';
import UserAvatar from '../common/UserAvatar';
import ResizableWindow from '../common/ResizableWindow';
import ConfirmModal from '../common/ConfirmModal';
import VoiceMessagePlayer from './VoiceMessagePlayer';

const TYPING_IDLE_MS = 2000;
const TYPING_EXPIRE_MS = 4000;

function ChatPanel({ groupId, isOpen, onClose, isOwner = false, members = [], zIndex = 1000, onFocus }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [error, setError] = useState('');
  const [mentionQuery, setMentionQuery] = useState(null);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [voicePreview, setVoicePreview] = useState(null);
  const [isSendingVoice, setIsSendingVoice] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingStreamRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const voicePreviewRef = useRef(null);
  const ownTypingStopTimeoutRef = useRef(null);
  const isOwnTypingActiveRef = useRef(false);
  const typingExpiryTimeoutsRef = useRef(new Map());
  const currentUser = getUser();

  const mentionSuggestions = mentionQuery === null
    ? []
    : members.filter((member) =>
        member.username.toLowerCase().startsWith(mentionQuery.toLowerCase())
        && member.user_id !== currentUser?.id
      ).slice(0, 6);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen && groupId) {
      fetchMessages();
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, groupId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, typingUsers]);

  const clearTypingExpiry = (userId) => {
    const timeoutId = typingExpiryTimeoutsRef.current.get(userId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      typingExpiryTimeoutsRef.current.delete(userId);
    }
  };

  const removeTypingUser = (userId) => {
    clearTypingExpiry(userId);
    setTypingUsers((prev) => prev.filter((user) => Number(user.userId) !== Number(userId)));
  };

  const scheduleTypingExpiry = (userId) => {
    clearTypingExpiry(userId);
    const timeoutId = setTimeout(() => {
      removeTypingUser(userId);
    }, TYPING_EXPIRE_MS);
    typingExpiryTimeoutsRef.current.set(userId, timeoutId);
  };

  const stopOwnTyping = () => {
    if (ownTypingStopTimeoutRef.current) {
      clearTimeout(ownTypingStopTimeoutRef.current);
      ownTypingStopTimeoutRef.current = null;
    }

    if (!isOwnTypingActiveRef.current || !currentUser?.id || !groupId) {
      return;
    }

    isOwnTypingActiveRef.current = false;
    emitChatTyping(groupId, currentUser.id, currentUser.username, false);
  };

  const updateOwnTypingState = (value) => {
    if (!isOpen || !currentUser?.id || !groupId) {
      return;
    }

    const hasText = value.trim().length > 0;
    if (!hasText) {
      stopOwnTyping();
      return;
    }

    if (!isOwnTypingActiveRef.current) {
      isOwnTypingActiveRef.current = true;
      emitChatTyping(groupId, currentUser.id, currentUser.username, true);
    }

    if (ownTypingStopTimeoutRef.current) {
      clearTimeout(ownTypingStopTimeoutRef.current);
    }

    ownTypingStopTimeoutRef.current = setTimeout(() => {
      stopOwnTyping();
    }, TYPING_IDLE_MS);
  };

  useEffect(() => {
    voicePreviewRef.current = voicePreview;
  }, [voicePreview]);

  useEffect(() => {
    return () => {
      stopRecordingTimer();
      cleanupRecordingStream();
      revokeVoicePreview(voicePreviewRef.current);
      stopOwnTyping();
      typingExpiryTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
      typingExpiryTimeoutsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      return undefined;
    }

    stopOwnTyping();
    setTypingUsers([]);
    typingExpiryTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
    typingExpiryTimeoutsRef.current.clear();

    stopRecordingTimer();
    cleanupRecordingStream();
    revokeVoicePreview(voicePreviewRef.current);
    setVoicePreview(null);
    setIsRecording(false);
    setRecordingSeconds(0);
    setIsClearConfirmOpen(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const unsubscribeMessage = onMessageSent((data) => {
      if (Number(data.message.group_id) !== Number(groupId)) {
        return;
      }

      appendMessage(data.message);
    });

    const unsubscribeClear = onChatCleared((data) => {
      if (data.groupId !== groupId) {
        return;
      }

      setMessages([]);
    });

    const unsubscribeTyping = onChatTyping((data) => {
      if (Number(data.groupId) !== Number(groupId)) {
        return;
      }

      if (Number(data.userId) === Number(currentUser?.id)) {
        return;
      }

      if (!data.isTyping) {
        removeTypingUser(data.userId);
        return;
      }

      setTypingUsers((prev) => {
        const exists = prev.some((user) => Number(user.userId) === Number(data.userId));
        if (exists) {
          return prev.map((user) =>
            Number(user.userId) === Number(data.userId)
              ? { ...user, username: data.username }
              : user
          );
        }
        return [...prev, { userId: data.userId, username: data.username }];
      });
      scheduleTypingExpiry(data.userId);
    });

    return () => {
      unsubscribeMessage();
      unsubscribeClear();
      unsubscribeTyping();
    };
  }, [isOpen, groupId, currentUser?.id]);

  const fetchMessages = async ({ silent = false } = {}) => {
    try {
      if (!silent) {
        setIsLoading(true);
      }
      setError('');
      const response = await messageAPI.getMessages(groupId);
      setMessages(response.data.messages || []);
    } catch (err) {
      setError('Failed to load messages');
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  };

  const appendMessage = (message) => {
    if (!message) {
      return;
    }

    setMessages((prevMessages) => {
      const exists = prevMessages.some((entry) => entry.id === message.id);
      if (exists) {
        return prevMessages;
      }
      return [...prevMessages, message];
    });
  };

  useEffect(() => {
    if (!isOpen || !groupId) {
      return undefined;
    }

    const unsubscribeReconnect = onSocketReconnect(() => {
      fetchMessages({ silent: true });
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchMessages({ silent: true });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      unsubscribeReconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isOpen, groupId]);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setNewMessage(value);
    updateOwnTypingState(value);

    const query = getMentionQueryAtCursor(value, e.target.selectionStart);
    setMentionQuery(query);
    setActiveSuggestionIndex(0);
  };

  const handleInputBlur = () => {
    stopOwnTyping();
  };

  const applyMention = (username) => {
    const input = inputRef.current;
    if (!input) return;

    const { nextValue, nextCursor } = insertMention(
      newMessage,
      input.selectionStart,
      username
    );

    setNewMessage(nextValue);
    setMentionQuery(null);
    setActiveSuggestionIndex(0);

    setTimeout(() => {
      input.focus();
      input.setSelectionRange(nextCursor, nextCursor);
    }, 0);
  };

  const handleInputKeyDown = (e) => {
    if (!mentionSuggestions.length) {
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestionIndex((prev) =>
        prev + 1 >= mentionSuggestions.length ? 0 : prev + 1
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestionIndex((prev) =>
        prev - 1 < 0 ? mentionSuggestions.length - 1 : prev - 1
      );
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      applyMention(mentionSuggestions[activeSuggestionIndex].username);
    } else if (e.key === 'Escape') {
      setMentionQuery(null);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!newMessage.trim() || isSending) return;

    const messageToSend = newMessage.trim();
    setNewMessage('');
    setMentionQuery(null);
    stopOwnTyping();

    try {
      setIsSending(true);
      setError('');
      const response = await messageAPI.sendMessage(groupId, messageToSend);
      appendMessage(response.data?.message);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send message');
      setNewMessage(messageToSend);
    } finally {
      setIsSending(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  };

  const stopRecordingTimer = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const cleanupRecordingStream = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;

    if (recordingStreamRef.current) {
      recordingStreamRef.current.getTracks().forEach((track) => track.stop());
      recordingStreamRef.current = null;
    }

    recordingChunksRef.current = [];
  };

  const revokeVoicePreview = (preview) => {
    if (preview?.url) {
      URL.revokeObjectURL(preview.url);
    }
  };

  const handleCancelVoicePreview = () => {
    revokeVoicePreview(voicePreview);
    setVoicePreview(null);
  };

  const finalizeRecording = () => {
    stopRecordingTimer();
    setIsRecording(false);

    const mimeType = mediaRecorderRef.current?.mimeType || getRecordingMimeType();
    const blob = new Blob(recordingChunksRef.current, { type: mimeType || 'audio/webm' });

    cleanupRecordingStream();

    if (!blob.size) {
      setError('Recording was empty. Try again.');
      setRecordingSeconds(0);
      return;
    }

    revokeVoicePreview(voicePreview);
    setVoicePreview({
      blob,
      url: URL.createObjectURL(blob),
      duration: recordingSeconds,
      mimeType: blob.type
    });
    setRecordingSeconds(0);
  };

  const handleStartRecording = async () => {
    if (isRecording || isSending || isSendingVoice || voicePreview) {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Voice recording is not supported in this browser.');
      return;
    }

    const mimeType = getRecordingMimeType();
    if (!mimeType) {
      setError('Voice recording is not supported in this browser.');
      return;
    }

    try {
      setError('');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;
      recordingChunksRef.current = [];

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        finalizeRecording();
      };

      recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev + 1 >= MAX_VOICE_MESSAGE_SECONDS) {
            stopRecordingTimer();
            if (mediaRecorderRef.current?.state === 'recording') {
              mediaRecorderRef.current.stop();
            }
            return MAX_VOICE_MESSAGE_SECONDS;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      cleanupRecordingStream();
      setIsRecording(false);
      setRecordingSeconds(0);
      setError('Microphone access is required to record voice messages.');
    }
  };

  const handleStopRecording = () => {
    if (!isRecording || !mediaRecorderRef.current) {
      return;
    }

    stopRecordingTimer();

    if (mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      return;
    }

    finalizeRecording();
  };

  const handleSendVoiceMessage = async () => {
    if (!voicePreview || isSendingVoice) {
      return;
    }

    const extension = getExtensionForMimeType(voicePreview.mimeType);
    const filename = `voice-message.${extension}`;

    try {
      setIsSendingVoice(true);
      setError('');
      const response = await messageAPI.sendVoiceMessage(
        groupId,
        voicePreview.blob,
        voicePreview.duration,
        filename
      );
      appendMessage(response.data?.message);
      revokeVoicePreview(voicePreview);
      setVoicePreview(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send voice message');
    } finally {
      setIsSendingVoice(false);
    }
  };

  const handleOpenClearConfirm = () => {
    setIsClearConfirmOpen(true);
  };

  const handleCancelClearChat = () => {
    if (isClearing) {
      return;
    }
    setIsClearConfirmOpen(false);
  };

  const handleConfirmClearChat = async () => {
    if (isClearing) {
      return;
    }

    try {
      setIsClearing(true);
      setError('');
      await messageAPI.clearChat(groupId);
      setMessages([]);
      setIsClearConfirmOpen(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete chat history');
    } finally {
      setIsClearing(false);
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };

  const groupMessagesByDate = (msgs) => {
    const grouped = {};
    msgs.forEach(msg => {
      const dateKey = formatDate(msg.created_at);
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(msg);
    });
    return grouped;
  };

  const messageMentionsCurrentUser = (message) =>
    (message.mentions || []).some(
      (mention) => Number(mention.user_id) === Number(currentUser?.id)
    );

  const groupedMessages = groupMessagesByDate(messages);

  return (
    <>
    <ResizableWindow
      isOpen={isOpen}
      onClose={onClose}
      title="Text Chat"
      defaultPosition={{ x: 96, y: 88 }}
      defaultSize={{ width: 380, height: 560 }}
      zIndex={zIndex}
      onFocus={onFocus}
      ariaLabel="Text chat"
      headerActions={isOwner ? (
        <button
          type="button"
          className={styles.clearChatButton}
          onClick={handleOpenClearConfirm}
          disabled={isClearing || messages.length === 0}
          title="Delete all chat history"
        >
          {isClearing ? '...' : 'Clear history'}
        </button>
      ) : null}
    >
      <div className={styles.chatPanel}>
        <div className={styles.messagesContainer}>
          {isLoading ? (
            <div className={styles.loadingState}>Loading messages...</div>
          ) : messages.length === 0 ? (
            <div className={styles.emptyState}>
              No messages yet. Start the conversation!
            </div>
          ) : (
            Object.entries(groupedMessages).map(([date, msgs]) => (
              <div key={date}>
                <div className={styles.dateDivider}>
                  <span>{date}</span>
                </div>
                {msgs.map((msg) => {
                  const isOwn = msg.user_id === currentUser?.id;
                  const mentionsYou = messageMentionsCurrentUser(msg);
                  return (
                    <div
                      key={msg.id}
                      className={`${styles.messageWrapper} ${isOwn ? styles.ownMessage : ''} ${mentionsYou ? styles.mentionedMessage : ''}`}
                    >
                      {!isOwn && (
                        <UserAvatar
                          username={msg.username}
                          profilePictureUrl={msg.profile_picture_url}
                          size="sm"
                          className={styles.messageAvatar}
                        />
                      )}
                      <div className={styles.messageBubble}>
                        {!isOwn && (
                          <div className={styles.messageAuthor}>{msg.username}</div>
                        )}
                        {mentionsYou && !isOwn && (
                          <div className={styles.mentionedYouLabel}>mentioned you</div>
                        )}
                        <div className={styles.messageContent}>
                          {msg.message_type === 'voice' && msg.voice_url ? (
                            <VoiceMessagePlayer
                              src={resolveMediaUrl(msg.voice_url)}
                              durationSeconds={msg.voice_duration_seconds}
                              isOwn={isOwn}
                            />
                          ) : (
                            renderMessageWithMentions(
                              msg.content,
                              msg.mentions,
                              currentUser?.id,
                              styles.mention,
                              styles.mentionSelf
                            )
                          )}
                        </div>
                        <div className={styles.messageTime}>{formatTime(msg.created_at)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
          {typingUsers.length > 0 && (
            <div className={styles.typingIndicator} aria-live="polite">
              <span className={styles.typingLabel}>{formatTypingLabel(typingUsers)}</span>
              <span className={styles.typingDots} aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {error && <div className={styles.errorMessage}>{error}</div>}

        {isRecording && (
          <div className={styles.recordingBar}>
            <span className={styles.recordingDot} aria-hidden="true" />
            <span className={styles.recordingLabel}>
              Recording {formatVoiceDuration(recordingSeconds)}
            </span>
            <button
              type="button"
              className={styles.stopRecordingButton}
              onClick={handleStopRecording}
            >
              Stop
            </button>
          </div>
        )}

        {voicePreview && !isRecording && (
          <div className={styles.voicePreviewBar}>
            <audio
              src={voicePreview.url}
              controls
              className={styles.voicePreviewAudio}
            />
            <span className={styles.voicePreviewDuration}>
              {formatVoiceDuration(voicePreview.duration)}
            </span>
            <button
              type="button"
              className={styles.discardVoiceButton}
              onClick={handleCancelVoicePreview}
              disabled={isSendingVoice}
            >
              Discard
            </button>
            <button
              type="button"
              className={styles.sendVoiceButton}
              onClick={handleSendVoiceMessage}
              disabled={isSendingVoice}
            >
              {isSendingVoice ? '...' : 'Send voice'}
            </button>
          </div>
        )}

        <form className={styles.inputContainer} onSubmit={handleSendMessage}>
          <div className={styles.inputWrapper}>
            {mentionSuggestions.length > 0 && (
              <div className={styles.mentionSuggestions}>
                {mentionSuggestions.map((member, index) => (
                  <button
                    key={member.user_id}
                    type="button"
                    className={`${styles.mentionSuggestion} ${index === activeSuggestionIndex ? styles.mentionSuggestionActive : ''}`}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      applyMention(member.username);
                    }}
                  >
                    @{member.username}
                  </button>
                ))}
              </div>
            )}
            <input
              ref={inputRef}
              type="text"
              className={styles.messageInput}
              placeholder="Type a message... use @username to mention"
              value={newMessage}
              onChange={handleInputChange}
              onBlur={handleInputBlur}
              onKeyDown={handleInputKeyDown}
              disabled={isSending || isRecording || isSendingVoice}
              maxLength={2000}
            />
          </div>
          <button
            type="button"
            className={`${styles.micButton} ${isRecording ? styles.micButtonActive : ''}`}
            onClick={isRecording ? handleStopRecording : handleStartRecording}
            disabled={isSending || isSendingVoice || Boolean(voicePreview)}
            aria-label={isRecording ? 'Stop recording' : 'Record voice message'}
            title={isRecording ? 'Stop recording' : 'Record voice message'}
          >
            {isRecording ? 'Stop' : 'Rec'}
          </button>
          <button
            type="submit"
            className={styles.sendButton}
            disabled={!newMessage.trim() || isSending || isRecording || isSendingVoice}
          >
            {isSending ? '...' : 'Send'}
          </button>
        </form>
      </div>
    </ResizableWindow>

    <ConfirmModal
      isOpen={isClearConfirmOpen}
      compact
      title="Clear chat history?"
      message="Delete all text chat messages for this group? This cannot be undone."
      confirmText={isClearing ? 'Deleting...' : 'Delete history'}
      cancelText="Cancel"
      onConfirm={handleConfirmClearChat}
      onCancel={handleCancelClearChat}
      confirmDisabled={isClearing}
    />
    </>
  );
}

export default ChatPanel;
