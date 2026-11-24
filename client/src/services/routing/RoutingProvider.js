/**
 * RoutingProvider - Abstract Base Interface for Routing Services
 * Decouples the application from any specific routing engine (OSRM, Mapbox, Google Maps, Valhalla, etc.)
 */
export class RoutingProvider {
  /**
   * Search for locations / geocoding
   * @param {string} query
   * @returns {Promise<Array<{ name: string, lat: number, lng: number }>>}
   */
  async searchPlaces(query) {
    throw new Error('searchPlaces() must be implemented by routing provider');
  }

  /**
   * Calculate route alternatives between origin and destination
   * @param {{ lat: number, lng: number, name?: string }} origin
   * @param {{ lat: number, lng: number, name?: string }} destination
   * @param {Object} options
   * @returns {Promise<Array<{
   *   id: string,
   *   name: string,
   *   geometry: { type: 'LineString', coordinates: Array<[number, number]> },
   *   distanceMeters: number,
   *   distanceKm: number,
   *   durationSeconds: number,
   *   durationMin: number,
   *   summary: string,
   *   isRecommended: boolean
   * }>>}
   */
  async getRouteAlternatives(origin, destination, options = {}) {
    throw new Error('getRouteAlternatives() must be implemented by routing provider');
  }
}

export default RoutingProvider;
