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
  }
};

export default api;
