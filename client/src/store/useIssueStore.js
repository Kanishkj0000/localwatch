import { create } from 'zustand';
import api from '../services/api';

export const useIssueStore = create((set, get) => ({
  issues: [],
  myReports: [],
  isLoading: false,
  activeViewportBounds: null, // [minLng, minLat, maxLng, maxLat]
  selectedCategoryFilter: 'all',
  isViewportDrawerOpen: false,
  isMyReportsModalOpen: false,

  setViewportBounds: (bounds) => set({ activeViewportBounds: bounds }),
  setCategoryFilter: (cat) => set({ selectedCategoryFilter: cat }),
  openViewportDrawer: () => set({ isViewportDrawerOpen: true }),
  closeViewportDrawer: () => set({ isViewportDrawerOpen: false }),
  toggleViewportDrawer: () => set((s) => ({ isViewportDrawerOpen: !s.isViewportDrawerOpen })),
  openMyReportsModal: () => set({ isMyReportsModalOpen: true }),
  closeMyReportsModal: () => set({ isMyReportsModalOpen: false }),
  toggleMyReportsModal: () => set((s) => ({ isMyReportsModalOpen: !s.isMyReportsModalOpen })),

  // Fetch issues within visible map viewport from PostgreSQL via PostGIS ST_MakeEnvelope
  fetchIssuesInBounds: async (bounds) => {
    const currentBounds = bounds || get().activeViewportBounds;
    if (!currentBounds) return;

    set({ isLoading: true });
    try {
      const [minLng, minLat, maxLng, maxLat] = currentBounds;
      const category = get().selectedCategoryFilter;

      const data = await api.getViewportIssues({
        minLng,
        minLat,
        maxLng,
        maxLat,
        category,
      });

      set({
        issues: data || [],
        isLoading: false,
        activeViewportBounds: currentBounds,
      });
    } catch (err) {
      console.error('Failed to fetch viewport issues:', err);
      set({ isLoading: false });
    }
  },

  // Fetch only the authenticated user's own reports from PostgreSQL
  fetchMyReports: async () => {
    try {
      const data = await api.getMyReports();
      set({ myReports: data.issues || [] });
      return data;
    } catch (err) {
      console.error('Failed to fetch personal reports:', err);
      set({ myReports: [] });
    }
  },

  // Add new issue to PostgreSQL database
  addIssue: async (newIssueData) => {
    try {
      const created = await api.createIssue(newIssueData);
      set((state) => ({
        issues: [created, ...state.issues],
        myReports: [created, ...state.myReports],
      }));
      return created;
    } catch (err) {
      throw err;
    }
  },

  // Confirm or upvote an issue in PostgreSQL
  confirmIssue: async (id) => {
    try {
      const res = await api.confirmIssue(id);
      set((state) => ({
        issues: state.issues.map((item) =>
          item.id === id
            ? {
                ...item,
                confirmations: res.confirmations,
                confirmedBy: res.confirmedBy,
                hasConfirmed: res.hasConfirmed,
              }
            : item
        ),
        myReports: state.myReports.map((item) =>
          item.id === id
            ? {
                ...item,
                confirmations: res.confirmations,
                confirmedBy: res.confirmedBy,
                hasConfirmed: res.hasConfirmed,
              }
            : item
        ),
      }));
      return res;
    } catch (err) {
      console.error('Failed to confirm issue:', err);
      throw err;
    }
  },

  // Toggle issue status (Active <-> Resolved)
  toggleIssueStatus: async (id, currentStatus) => {
    const nextStatus = currentStatus === 'Resolved' ? 'Active' : 'Resolved';
    try {
      const updated = await api.updateStatus(id, nextStatus);
      set((state) => ({
        issues: state.issues.map((item) =>
          item.id === id ? { ...item, status: updated.status } : item
        ),
        myReports: state.myReports.map((item) =>
          item.id === id ? { ...item, status: updated.status } : item
        ),
      }));
      return updated;
    } catch (err) {
      console.error('Failed to update status:', err);
      throw err;
    }
  },

  // Delete an issue (owner only)
  removeIssue: async (id) => {
    try {
      await api.deleteIssue(id);
      set((state) => ({
        issues: state.issues.filter((item) => item.id !== id),
        myReports: state.myReports.filter((item) => item.id !== id),
      }));
    } catch (err) {
      console.error('Failed to delete issue:', err);
      throw err;
    }
  },
}));

export default useIssueStore;
