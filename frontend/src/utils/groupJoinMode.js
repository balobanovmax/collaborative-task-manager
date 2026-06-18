export const JOIN_MODES = ['public', 'password', 'approval'];

export const JOIN_MODE_LABELS = {
  public: 'Public (anyone can join)',
  password: 'Private (password required)',
  approval: 'Request to join (owner approval)'
};

export const getJoinModeFromGroup = (group) => {
  if (group?.join_mode && JOIN_MODES.includes(group.join_mode)) {
    return group.join_mode;
  }

  if (group?.is_public) {
    return 'public';
  }

  if (group?.has_join_password) {
    return 'password';
  }

  return 'approval';
};

export const getJoinModeLabel = (mode) => JOIN_MODE_LABELS[mode] || JOIN_MODE_LABELS.public;
