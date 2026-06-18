import axios from 'axios';
const api = axios.create({
  baseURL: '/api', 
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },

  register: async (username, email, password) => {
    const response = await api.post('/auth/register', { username, email, password });
    return response.data;
  },

  getCurrentUser: async () => {
    const response = await api.get('/users/profile');
    return response.data;
  }
};

export const userAPI = {
  getProfile: async () => {
    const response = await api.get('/users/profile');
    return response.data;
  },

  getPublicProfile: async (userId) => {
    const response = await api.get(`/users/${userId}`);
    return response.data;
  },

  updateProfile: async ({ username, bio }) => {
    const response = await api.put('/users/profile', { username, bio });
    return response.data;
  },

  uploadAvatar: async (file) => {
    const formData = new FormData();
    formData.append('avatar', file);
    const response = await api.post('/users/profile/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  removeAvatar: async () => {
    const response = await api.delete('/users/profile/avatar');
    return response.data;
  },

  changePassword: async (currentPassword, newPassword) => {
    const response = await api.put('/users/profile/password', {
      current_password: currentPassword,
      new_password: newPassword
    });
    return response.data;
  },

  getDashboard: async () => {
    const response = await api.get('/users/dashboard');
    return response.data;
  }
};

export const groupAPI = {
  getUserGroups: async () => {
    const response = await api.get('/users/groups');
    return response.data;
  },

  joinGroup: async (groupId, password = null) => {
    const response = await api.post(`/groups/${groupId}/join`, { password });
    return response.data;
  },

  createGroup: async (name, description, joinMode = 'public', password = null) => {
    const response = await api.post('/groups', {
      name,
      description,
      join_mode: joinMode,
      join_password: password
    });
    return response.data;
  },

  deleteGroup: async (groupId) => {
    const response = await api.delete(`/groups/${groupId}`);
    return response.data;
  },

  getGroupDetails: async (groupId) => {
    const response = await api.get(`/groups/${groupId}`);
    return response.data;
  },

  getGroupMembers: async (groupId) => {
    const response = await api.get(`/groups/${groupId}/members`);
    return response.data;
  },

  getGroupTasks: async (groupId, filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '' && value !== 'all' && value !== false) {
        params.set(key, String(value));
      }
    });
    const query = params.toString();
    const response = await api.get(`/tasks/group/${groupId}${query ? `?${query}` : ''}`);
    return response.data;
  },

  removeMember: async (groupId, userId) => {
    const response = await api.delete(`/groups/${groupId}/members/${userId}`);
    return response.data;
  },

  updateGroup: async (groupId, { name, description, join_mode, join_password } = {}) => {
    const payload = { name, description, join_mode };

    if (join_password) {
      payload.join_password = join_password;
    }

    const response = await api.put(`/groups/${groupId}`, payload);
    return response.data;
  },

  getJoinPreview: async (groupId) => {
    const response = await api.get(`/groups/${groupId}/join-preview`);
    return response.data;
  },

  submitJoinRequest: async (groupId, message = null) => {
    const response = await api.post(`/groups/${groupId}/join-requests`, { message });
    return response.data;
  },

  getJoinRequests: async (groupId) => {
    const response = await api.get(`/groups/${groupId}/join-requests`);
    return response.data;
  },

  reviewJoinRequest: async (groupId, requestId, action) => {
    const response = await api.patch(`/groups/${groupId}/join-requests/${requestId}`, { action });
    return response.data;
  },

  leaveGroup: async (groupId, transferToUserId = null) => {
    const config = transferToUserId
      ? { data: { transfer_to_user_id: transferToUserId } }
      : undefined;
    const response = await api.delete(`/groups/${groupId}/leave`, config);
    return response.data;
  }
};

export const notificationAPI = {
  getNotifications: async (limit = 50) => {
    const response = await api.get(`/notifications?limit=${limit}`);
    return response.data;
  },

  getUnreadCount: async () => {
    const response = await api.get('/notifications/unread-count');
    return response.data;
  },

  markRead: async (notificationId) => {
    const response = await api.patch(`/notifications/${notificationId}/read`);
    return response.data;
  },

  markAllRead: async () => {
    const response = await api.patch('/notifications/read-all');
    return response.data;
  }
};

export const taskAPI = {
  createTask: async (groupId, title, description, dueDate, assignedTo = null, priority = 'medium') => {
    const response = await api.post('/tasks', {
      group_id: groupId,
      title,
      description,
      due_date: dueDate,
      assigned_to: assignedTo,
      priority
    });
    return response.data;
  },

  updateTask: async (taskId, updateData) => {
    const response = await api.put(`/tasks/${taskId}`, updateData);
    return response.data;
  },

  deleteTask: async (taskId) => {
    const response = await api.delete(`/tasks/${taskId}`);
    return response.data;
  },

  updateTaskStatus: async (taskId, status) => {
    const response = await api.patch(`/tasks/${taskId}/status`, { status });
    return response.data;
  },

  getMyTasks: async ({
    includeDone = false,
    sortBy = 'due_date',
    sortOrder = 'ASC',
    search = '',
    status = 'all',
    priority = 'all',
    dueFrom = '',
    dueTo = '',
    overdueOnly = false
  } = {}) => {
    const params = new URLSearchParams({
      includeDone: String(includeDone),
      sortBy,
      sortOrder
    });

    if (search?.trim()) {
      params.set('search', search.trim());
    }
    if (status && status !== 'all') {
      params.set('status', status);
    }
    if (priority && priority !== 'all') {
      params.set('priority', priority);
    }
    if (dueFrom) {
      params.set('dueFrom', dueFrom);
    }
    if (dueTo) {
      params.set('dueTo', dueTo);
    }
    if (overdueOnly) {
      params.set('overdueOnly', 'true');
    }

    const response = await api.get(`/tasks/my-tasks?${params.toString()}`);
    return response.data;
  },

  toggleTaskCompletion: async (taskId) => {
    const response = await api.patch(`/tasks/${taskId}/toggle`);
    return response.data;
  },

  getComments: async (taskId) => {
    const response = await api.get(`/tasks/${taskId}/comments`);
    return response.data;
  },

  addComment: async (taskId, content) => {
    const response = await api.post(`/tasks/${taskId}/comments`, { content });
    return response.data;
  },

  getAttachments: async (taskId) => {
    const response = await api.get(`/tasks/${taskId}/attachments`);
    return response.data;
  },

  uploadAttachment: async (taskId, file) => {
    const formData = new FormData();
    formData.append('attachment', file);
    const response = await api.post(`/tasks/${taskId}/attachments`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  deleteAttachment: async (taskId, attachmentId) => {
    const response = await api.delete(`/tasks/${taskId}/attachments/${attachmentId}`);
    return response.data;
  },

  getDrawings: async (taskId) => {
    const response = await api.get(`/tasks/${taskId}/drawings`);
    return response.data;
  },

  uploadDrawing: async (taskId, file, title = 'Drawing') => {
    const formData = new FormData();
    formData.append('drawing', file);
    formData.append('title', title);
    const response = await api.post(`/tasks/${taskId}/drawings`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  deleteDrawing: async (taskId, drawingId) => {
    const response = await api.delete(`/tasks/${taskId}/drawings/${drawingId}`);
    return response.data;
  },

  getSubtasks: async (taskId) => {
    const response = await api.get(`/tasks/${taskId}/subtasks`);
    return response.data;
  },

  addSubtask: async (taskId, title) => {
    const response = await api.post(`/tasks/${taskId}/subtasks`, { title });
    return response.data;
  },

  updateSubtask: async (taskId, subtaskId, updates) => {
    const response = await api.patch(`/tasks/${taskId}/subtasks/${subtaskId}`, updates);
    return response.data;
  },

  deleteSubtask: async (taskId, subtaskId) => {
    const response = await api.delete(`/tasks/${taskId}/subtasks/${subtaskId}`);
    return response.data;
  },

  getTaskActivity: async (taskId, limit = 50) => {
    const response = await api.get(`/tasks/${taskId}/activity?limit=${limit}`);
    return response.data;
  }
};

export const messageAPI = {
  sendMessage: async (groupId, content) => {
    const response = await api.post('/messages', {
      group_id: groupId,
      content
    });
    return response.data;
  },

  getMessages: async (groupId, limit = 100, before = null) => {
    let url = `/messages/group/${groupId}?limit=${limit}`;
    if (before) {
      url += `&before=${before}`;
    }
    const response = await api.get(url);
    return response.data;
  },

  clearChat: async (groupId) => {
    const response = await api.delete(`/messages/group/${groupId}`);
    return response.data;
  },

  sendVoiceMessage: async (groupId, audioBlob, durationSeconds, filename = 'voice-message.webm') => {
    const formData = new FormData();
    formData.append('voice', audioBlob, filename);
    formData.append('group_id', String(groupId));
    formData.append('duration_seconds', String(durationSeconds));

    const response = await api.post('/messages/voice', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  }
};

export default api;
