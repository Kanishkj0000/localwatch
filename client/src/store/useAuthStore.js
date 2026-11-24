import { create } from 'zustand';
import api from '../services/api';

const loadSavedSession = () => {
  try {
    const savedUser = localStorage.getItem('localwatch_user');
    const token = localStorage.getItem('localwatch_token');
    if (savedUser && token) {
      return {
        user: JSON.parse(savedUser),
        token,
        isAuthenticated: true,
      };
    }
  } catch (err) {
    console.warn('Could not parse saved user session:', err);
  }
  return {
    user: null,
    token: null,
    isAuthenticated: false,
  };
};

const initialSession = loadSavedSession();

export const useAuthStore = create((set, get) => ({
  user: initialSession.user,
  token: initialSession.token,
  isAuthenticated: initialSession.isAuthenticated,
  isLoading: false,
  error: null,
  isAuthModalOpen: false,
  authModalMode: 'login', // 'login' | 'register'

  openAuthModal: (mode = 'login') => set({ isAuthModalOpen: true, authModalMode: mode, error: null }),
  closeAuthModal: () => set({ isAuthModalOpen: false, error: null }),
  setAuthModalMode: (mode) => set({ authModalMode: mode, error: null }),

  // Production Login: verifies password against PostgreSQL bcrypt hash
  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const data = await api.login(email, password);
      set({
        user: data.user,
        token: data.token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        isAuthModalOpen: false,
      });
      return { success: true, user: data.user };
    } catch (err) {
      const msg = err.message || 'Login failed';
      set({ error: msg, isLoading: false });
      return { success: false, error: msg };
    }
  },

  // Production Registration: creates real account in PostgreSQL
  register: async (name, email, password) => {
    set({ isLoading: true, error: null });
    try {
      const data = await api.register(name, email, password);
      set({
        user: data.user,
        token: data.token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        isAuthModalOpen: false,
      });
      return { success: true, user: data.user };
    } catch (err) {
      const msg = err.message || 'Registration failed';
      set({ error: msg, isLoading: false });
      return { success: false, error: msg };
    }
  },

  // Logout: cleans all tokens and session state
  logout: () => {
    localStorage.removeItem('localwatch_token');
    localStorage.removeItem('localwatch_user');
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      error: null,
    });
  },

  // Check and refresh auth status from backend
  checkAuth: async () => {
    const token = localStorage.getItem('localwatch_token');
    if (!token) {
      set({ user: null, token: null, isAuthenticated: false });
      return;
    }

    try {
      const user = await api.getMe();
      set({ user, isAuthenticated: true });
    } catch (err) {
      // Token expired or invalid
      localStorage.removeItem('localwatch_token');
      localStorage.removeItem('localwatch_user');
      set({ user: null, token: null, isAuthenticated: false });
    }
  },
}));

export default useAuthStore;
