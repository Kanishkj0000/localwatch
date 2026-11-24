import axios from 'axios';

// Automatically ensure /api prefix whether VITE_API_URL has it or not
const rawUrl = import.meta.env.VITE_API_URL || '';
const API_BASE_URL = rawUrl 
  ? (rawUrl.endsWith('/api') ? rawUrl : `${rawUrl.replace(/\/$/, '')}/api`)
  : '/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Automatically attach JWT Bearer token to all outgoing requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('localwatch_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const api = {
  // Auth: Login
  login: async (email, password) => {
    try {
      const res = await apiClient.post('/auth/login', { email, password });
      if (res.data.token) {
        localStorage.setItem('localwatch_token', res.data.token);
        localStorage.setItem('localwatch_user', JSON.stringify(res.data.user));
      }
      return res.data;
    } catch (err) {
      const message = err.response?.data?.error || err.message || 'Login failed';
      throw new Error(message);
    }
  },

  // Auth: Register
  register: async (name, email, password) => {
    try {
      const res = await apiClient.post('/auth/register', { name, email, password });
      if (res.data.token) {
        localStorage.setItem('localwatch_token', res.data.token);
        localStorage.setItem('localwatch_user', JSON.stringify(res.data.user));
      }
      return res.data;
    } catch (err) {
      const message = err.response?.data?.error || err.message || 'Registration failed';
      throw new Error(message);
    }
  },

  // Auth: Verify current session
  getMe: async () => {
    try {
      const res = await apiClient.get('/auth/me');
      return res.data.user;
    } catch (err) {
      localStorage.removeItem('localwatch_token');
      localStorage.removeItem('localwatch_user');
      throw err;
    }
  },

  // Viewport Discovery: query visible issues in map bounds
  getViewportIssues: async ({ minLng, minLat, maxLng, maxLat, category, status } = {}) => {
    try {
      const params = {};
      if (minLng !== undefined) params.minLng = minLng;
      if (minLat !== undefined) params.minLat = minLat;
      if (maxLng !== undefined) params.maxLng = maxLng;
      if (maxLat !== undefined) params.maxLat = maxLat;
      if (category && category !== 'all') params.category = category;
      if (status && status !== 'all') params.status = status;

      const res = await apiClient.get('/issues', { params });
      return res.data.issues || [];
    } catch (err) {
      console.error('Error fetching viewport issues:', err);
      return [];
    }
  },

  // My Reports: query only the authenticated user's reports
  getMyReports: async () => {
    try {
      const res = await apiClient.get('/issues/my');
      return res.data;
    } catch (err) {
      const message = err.response?.data?.error || err.message || 'Failed to fetch personal reports';
      throw new Error(message);
    }
  },

  // Submit Issue: with 1MB limit check
  createIssue: async (issueData) => {
    try {
      const res = await apiClient.post('/issues', issueData);
      return res.data;
    } catch (err) {
      const message = err.response?.data?.error || err.message || 'Failed to report issue';
      throw new Error(message);
    }
  },

  // Confirm / Vouch for an issue
  confirmIssue: async (id) => {
    try {
      const res = await apiClient.post(`/issues/${id}/confirm`);
      return res.data;
    } catch (err) {
      const message = err.response?.data?.error || err.message || 'Failed to update confirmation';
      throw new Error(message);
    }
  },

  // Status Update (Active <-> Resolved)
  updateStatus: async (id, status) => {
    try {
      const res = await apiClient.patch(`/issues/${id}/status`, { status });
      return res.data;
    } catch (err) {
      const message = err.response?.data?.error || err.message || 'Failed to update status';
      throw new Error(message);
    }
  },

  // Delete Issue
  deleteIssue: async (id) => {
    try {
      const res = await apiClient.delete(`/issues/${id}`);
      return res.data;
    } catch (err) {
      const message = err.response?.data?.error || err.message || 'Failed to delete issue';
      throw new Error(message);
    }
  },
};

export default api;
