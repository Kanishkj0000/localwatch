import OSRMProvider, { POPULAR_DESTINATIONS } from './OSRMProvider';
import RouteCorridorEngine from './RouteCorridorEngine';
import RoutingProvider from './RoutingProvider';

// Default routing provider is OSRMProvider
let currentProvider = new OSRMProvider();

export const routingService = {
  /**
   * Get current routing provider
   */
  getProvider() {
    return currentProvider;
  },

  /**
   * Switch the underlying routing provider (e.g. Mapbox, Google Maps, Valhalla)
   * Decoupled architecture as requested.
   */
  setProvider(provider) {
    if (!(provider instanceof RoutingProvider)) {
      throw new Error('Provider must extend RoutingProvider');
    }
    currentProvider = provider;
  },

  /**
   * Search for locations
   */
  async searchPlaces(query) {
    return currentProvider.searchPlaces(query);
  },

  /**
   * Calculate route alternatives between origin and destination
   */
  async getRouteAlternatives(origin, destination, options = {}) {
    return currentProvider.getRouteAlternatives(origin, destination, options);
  },

  /**
   * Find issues in corridor using the corridor engine
   */
  findIssuesInCorridor(issues, routeGeometry, corridorRadiusMeters = 250) {
    return RouteCorridorEngine.findIssuesInCorridor(issues, routeGeometry, corridorRadiusMeters);
  },

  /**
   * Summarize issues on a route
   */
  summarizeRouteIssues(corridorIssues) {
    return RouteCorridorEngine.summarizeRouteIssues(corridorIssues);
  },

  POPULAR_DESTINATIONS,
};

export { RouteCorridorEngine, RoutingProvider, OSRMProvider, POPULAR_DESTINATIONS };
export default routingService;
