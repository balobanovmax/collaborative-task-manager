export const formatTypingLabel = (typingUsers) => {
  if (!typingUsers.length) {
    return '';
  }

  if (typingUsers.length === 1) {
    return `${typingUsers[0].username} is typing`;
  }

  if (typingUsers.length === 2) {
    return `${typingUsers[0].username} and ${typingUsers[1].username} are typing`;
  }

  return `${typingUsers[0].username} and ${typingUsers.length - 1} others are typing`;
};
