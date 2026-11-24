import { create } from 'zustand';
import routingService from '../services/routing';

export const useRouteStore = create((set, get) => ({
  isDirectionsOpen: false,
  origin: null,
  destination: null,
  corridorRadiusMeters: 250, // 250 meters corridor buffer around route
  routeAlternatives: [],
  selectedRouteId: null,
  selectedCorridorIssue: null,
  isLoadingRoutes: false,
  error: null,

  openDirections: () => set({ isDirectionsOpen: true }),
  closeDirections: () =>
    set({
      isDirectionsOpen: false,
      routeAlternatives: [],
      selectedRouteId: null,
      selectedCorridorIssue: null,
      error: null,
    }),

  setOrigin: (origin) => {
    set({ origin, error: null });
  },

  setDestination: (destination) => {
    set({ destination, error: null });
  },

  setCorridorRadius: (radius) => {
    set({ corridorRadiusMeters: radius });
  },

  swapOriginDestination: () => {
    const { origin, destination } = get();
    if (!destination) return;
    set({
      origin: { ...destination, isCurrentLocation: false },
      destination: { ...origin },
      routeAlternatives: [],
      selectedRouteId: null,
      selectedCorridorIssue: null,
    });
  },

  // Calculate routes and evaluate issue corridors
  calculateRoutes: async (allIssues = []) => {
    const { origin, destination, corridorRadiusMeters } = get();
    if (!origin || !destination) {
      set({ error: 'Please specify both a starting point and destination.' });
      return;
    }

    set({ isLoadingRoutes: true, error: null, selectedCorridorIssue: null });

    try {
      // 1. Generate route alternatives using decoupled routing provider
      const rawRoutes = await routingService.getRouteAlternatives(origin, destination);

      if (!rawRoutes || rawRoutes.length === 0) {
        set({
          isLoadingRoutes: false,
          error: 'Could not find a driving route between these locations.',
        });
        return;
      }

      // 2. For every route alternative, compute corridor issues and summary statistics
      const enrichedRoutes = rawRoutes.map((route, idx) => {
        const corridorIssues = routingService.findIssuesInCorridor(
          allIssues,
          route.geometry,
          corridorRadiusMeters
        );
        const summaryStats = routingService.summarizeRouteIssues(corridorIssues);

        return {
          ...route,
          corridorIssues,
          summaryStats,
          isRecommended: idx === 0,
        };
      });

      set({
        routeAlternatives: enrichedRoutes,
        selectedRouteId: enrichedRoutes[0]?.id || null,
        isLoadingRoutes: false,
      });

      return enrichedRoutes;
    } catch (err) {
      console.error('Route calculation error:', err);
      set({
        isLoadingRoutes: false,
        error: 'Error generating routes. Please try again.',
      });
    }
  },

  selectRoute: (routeId) => {
    set({ selectedRouteId: routeId, selectedCorridorIssue: null });
  },

  selectCorridorIssue: (issue) => {
    set({ selectedCorridorIssue: issue });
  },

  clearRoutes: () => {
    set({
      destination: null,
      routeAlternatives: [],
      selectedRouteId: null,
      selectedCorridorIssue: null,
      error: null,
    });
  },
}));

export default useRouteStore;
