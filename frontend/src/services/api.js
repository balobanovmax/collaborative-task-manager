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

export const groupAPI = {
  getUserGroups: async () => {
    const response = await api.get('/users/groups');
    return response.data;
  },

  joinGroup: async (groupId, password = null) => {
    const response = await api.post(`/groups/${groupId}/join`, { password });
    return response.data;
  },

  createGroup: async (name, description, isPublic, password = null) => {
    const response = await api.post('/groups', {
      name,
      description,
      is_public: isPublic,
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

  getGroupTasks: async (groupId) => {
    const response = await api.get(`/tasks/group/${groupId}`);
    return response.data;
  },

  removeMember: async (groupId, userId) => {
    const response = await api.delete(`/groups/${groupId}/members/${userId}`);
    return response.data;
  },

  updateGroup: async (groupId, name, description) => {
    const response = await api.put(`/groups/${groupId}`, { name, description });
    return response.data;
  }
};

export const taskAPI = {
  createTask: async (groupId, title, description, dueDate) => {
    const response = await api.post('/tasks', {
      group_id: groupId,
      title,
      description,
      due_date: dueDate
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

  toggleTaskCompletion: async (taskId) => {
    const response = await api.patch(`/tasks/${taskId}/toggle`);
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
  }
};

export default api;
