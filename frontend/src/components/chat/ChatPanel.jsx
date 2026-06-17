import { useState, useEffect, useRef } from 'react';
import styles from './ChatPanel.module.css';
import { messageAPI } from '../../services/api';
import { onMessageSent, onChatCleared } from '../../services/socket';
import { getUser } from '../../utils/auth';

function ChatPanel({ groupId, isOpen, onClose, isOwner }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const currentUser = getUser();

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
  }, [messages]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const unsubscribeMessage = onMessageSent((data) => {
      if (data.message.group_id !== groupId) {
        return;
      }

      setMessages(prevMessages => {
        const exists = prevMessages.some(m => m.id === data.message.id);
        if (exists) return prevMessages;
        return [...prevMessages, data.message];
      });
    });

    const unsubscribeClear = onChatCleared((data) => {
      if (data.groupId !== groupId) {
        return;
      }

      setMessages([]);
    });

    return () => {
      unsubscribeMessage();
      unsubscribeClear();
    };
  }, [isOpen, groupId]);

  const fetchMessages = async () => {
    try {
      setIsLoading(true);
      setError('');
      const response = await messageAPI.getMessages(groupId);
      setMessages(response.data.messages || []);
    } catch (err) {
      setError('Failed to load messages');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!newMessage.trim() || isSending) return;

    const messageToSend = newMessage.trim();
    setNewMessage('');

    try {
      setIsSending(true);
      setError('');
      await messageAPI.sendMessage(groupId, messageToSend);
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

  const handleClearChat = async () => {
    if (!confirm('Are you sure you want to clear all messages? This cannot be undone.')) {
      return;
    }

    try {
      setIsClearing(true);
      setError('');
      await messageAPI.clearChat(groupId);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to clear chat');
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

  if (!isOpen) return null;

  const groupedMessages = groupMessagesByDate(messages);

  return (
    <div className={styles.chatOverlay} onClick={onClose}>
      <div className={styles.chatPanel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.chatHeader}>
          <h3 className={styles.chatTitle}>Group Chat</h3>
          <div className={styles.headerButtons}>
            {isOwner && (
              <button 
                className={styles.clearChatButton} 
                onClick={handleClearChat}
                disabled={isClearing || messages.length === 0}
              >
                {isClearing ? '...' : 'Clear'}
              </button>
            )}
            <button className={styles.closeButton} onClick={onClose}>
              ×
            </button>
          </div>
        </div>

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
                  return (
                    <div
                      key={msg.id}
                      className={`${styles.messageWrapper} ${isOwn ? styles.ownMessage : ''}`}
                    >
                      <div className={styles.messageBubble}>
                        {!isOwn && (
                          <div className={styles.messageAuthor}>{msg.username}</div>
                        )}
                        <div className={styles.messageContent}>{msg.content}</div>
                        <div className={styles.messageTime}>{formatTime(msg.created_at)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {error && <div className={styles.errorMessage}>{error}</div>}

        <form className={styles.inputContainer} onSubmit={handleSendMessage}>
          <button
            type="button"
            className={styles.closeChatButton}
            onClick={onClose}
          >
            Close
          </button>
          <input
            ref={inputRef}
            type="text"
            className={styles.messageInput}
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            disabled={isSending}
            maxLength={2000}
          />
          <button
            type="submit"
            className={styles.sendButton}
            disabled={!newMessage.trim() || isSending}
          >
            {isSending ? '...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default ChatPanel;

