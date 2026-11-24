import RoutingProvider from './RoutingProvider';

const OSRM_BASE = 'https://router.project-osrm.org';
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

// Popular default destinations in Delhi / NCR for instant 1-click autocomplete
export const POPULAR_DESTINATIONS = [
  { name: 'Connaught Place, New Delhi', lat: 28.6315, lng: 77.2167 },
  { name: 'India Gate, Rajpath', lat: 28.6129, lng: 77.2295 },
  { name: 'Cyber Hub, DLF Cyber City, Gurugram', lat: 28.4986, lng: 77.0878 },
  { name: 'Nehru Place Commercial Center', lat: 28.5494, lng: 77.2530 },
  { name: 'IGI Airport Terminal 3', lat: 28.5562, lng: 77.0999 },
  { name: 'Khan Market, Rabindra Nagar', lat: 28.6004, lng: 77.2270 },
  { name: 'Hauz Khas Village', lat: 28.5494, lng: 77.1944 },
  { name: 'Noida Sector 18 Market', lat: 28.5708, lng: 77.3260 },
];

export class OSRMProvider extends RoutingProvider {
  constructor() {
    super();
    this.routeCache = new Map();
    this.geocodeCache = new Map();
  }

  /**
   * Search for places using Nominatim + popular shortcuts
   */
  async searchPlaces(query) {
    if (!query || query.trim().length < 2) {
      return POPULAR_DESTINATIONS.slice(0, 5);
    }

    const qLower = query.toLowerCase().trim();

    // Check popular shortcuts first
    const matchedPopular = POPULAR_DESTINATIONS.filter((p) =>
      p.name.toLowerCase().includes(qLower)
    );

    // Check cache
    if (this.geocodeCache.has(qLower)) {
      return this.geocodeCache.get(qLower);
    }

    try {
      const res = await fetch(
        `${NOMINATIM_BASE}/search?format=json&q=${encodeURIComponent(
          query
        )}&limit=5&countrycodes=in`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await res.json();
      const results = (data || []).map((item) => ({
        name: item.display_name,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
      }));

      // Combine matched popular + api results without duplicates
      const combined = [...matchedPopular];
      for (const r of results) {
        if (!combined.some((c) => Math.hypot(c.lat - r.lat, c.lng - r.lng) < 0.005)) {
          combined.push(r);
        }
      }

      this.geocodeCache.set(qLower, combined);
      return combined;
    } catch (err) {
      console.warn('Geocoding search error, using popular fallbacks:', err.message);
      return matchedPopular.length > 0 ? matchedPopular : POPULAR_DESTINATIONS.slice(0, 4);
    }
  }

  /**
   * Calculate route alternatives between origin and destination
   */
  async getRouteAlternatives(origin, destination, options = {}) {
    if (!origin || !destination) return [];

    const cacheKey = `${origin.lng.toFixed(4)},${origin.lat.toFixed(4)}->${destination.lng.toFixed(4)},${destination.lat.toFixed(4)}`;
    if (this.routeCache.has(cacheKey)) {
      return this.routeCache.get(cacheKey);
    }

    const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
    const url = `${OSRM_BASE}/route/v1/driving/${coords}?alternatives=true&overview=full&geometries=geojson&steps=true`;

    let routes = [];

    try {
      const res = await fetch(url);
      const data = await res.json();

      if (data.code === 'Ok' && Array.isArray(data.routes) && data.routes.length > 0) {
        routes = data.routes.map((r, idx) => {
          const distanceKm = +(r.distance / 1000).toFixed(1);
          const durationMin = Math.round(r.duration / 60);

          // Generate recognizable name
          let routeName = `Route ${idx + 1}`;
          if (r.legs && r.legs[0] && r.legs[0].summary) {
            routeName = `via ${r.legs[0].summary}`;
          } else if (idx === 0) {
            routeName = 'Fastest Route';
          } else {
            routeName = `Alternative Corridor ${idx}`;
          }

          return {
            id: `route_${idx + 1}`,
            name: routeName,
            geometry: r.geometry,
            distanceMeters: Math.round(r.distance),
            distanceKm,
            durationSeconds: Math.round(r.duration),
            durationMin,
            summary: r.legs?.[0]?.summary || routeName,
            isRecommended: idx === 0,
          };
        });
      }
    } catch (err) {
      console.warn('OSRM primary route query failed:', err.message);
    }

    // If OSRM returned only 1 route (common on public servers), generate a realistic
    // alternative by routing through a perpendicular arterial waypoint
    if (routes.length === 1) {
      try {
        const altRoute = await this._generateSecondaryRoute(origin, destination, routes[0]);
        if (altRoute) {
          routes.push(altRoute);
        }
      } catch (e) {
        console.warn('Could not generate second alternative:', e.message);
      }
    }

    // Fallback if network totally failed: produce geometric interpolated routes
    if (routes.length === 0) {
      routes = this._createFallbackDirectRoutes(origin, destination);
    }

    this.routeCache.set(cacheKey, routes);
    return routes;
  }

  /**
   * Helper to request an alternate waypoint to force OSRM to find a distinct secondary corridor
   */
  async _generateSecondaryRoute(origin, destination, primaryRoute) {
    const midLng = (origin.lng + destination.lng) / 2;
    const midLat = (origin.lat + destination.lat) / 2;

    const dLng = destination.lng - origin.lng;
    const dLat = destination.lat - origin.lat;

    // Perpendicular vector for offset waypoint
    const offsetMag = 0.015; // ~1.5 km arterial offset
    const waypointLng = midLng - dLat * 0.4;
    const waypointLat = midLat + dLng * 0.4;

    const coords = `${origin.lng},${origin.lat};${waypointLng.toFixed(5)},${waypointLat.toFixed(5)};${destination.lng},${destination.lat}`;
    const url = `${OSRM_BASE}/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`;

    const res = await fetch(url);
    const data = await res.json();

    if (data.code === 'Ok' && data.routes && data.routes[0]) {
      const r = data.routes[0];
      const distanceKm = +(r.distance / 1000).toFixed(1);
      const durationMin = Math.round(r.duration / 60);

      return {
        id: 'route_2',
        name: 'via Outer Ring / Bypass',
        geometry: r.geometry,
        distanceMeters: Math.round(r.distance),
        distanceKm,
        durationSeconds: Math.round(r.duration),
        durationMin,
        summary: 'Alternate arterial corridor',
        isRecommended: false,
      };
    }
    return null;
  }

  /**
   * Fallback bezier-like multi-route generator in case network is completely blocked
   */
  _createFallbackDirectRoutes(origin, destination) {
    const steps = 25;
    const coords1 = [];
    const coords2 = [];

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      // Route 1 with slight curve
      const lng1 = origin.lng + t * (destination.lng - origin.lng) + Math.sin(t * Math.PI) * 0.006;
      const lat1 = origin.lat + t * (destination.lat - origin.lat);
      coords1.push([lng1, lat1]);

      // Route 2 with opposite curve
      const lng2 = origin.lng + t * (destination.lng - origin.lng) - Math.sin(t * Math.PI) * 0.008;
      const lat2 = origin.lat + t * (destination.lat - origin.lat);
      coords2.push([lng2, lat2]);
    }

    const approxDistMeters = Math.round(
      Math.hypot(destination.lng - origin.lng, destination.lat - origin.lat) * 111320
    );

    return [
      {
        id: 'route_1',
        name: 'Primary Arterial Road',
        geometry: { type: 'LineString', coordinates: coords1 },
        distanceMeters: approxDistMeters,
        distanceKm: +(approxDistMeters / 1000).toFixed(1),
        durationSeconds: Math.round((approxDistMeters / 1000 / 30) * 3600), // ~30km/h
        durationMin: Math.round((approxDistMeters / 1000 / 30) * 60),
        summary: 'Direct thoroughfare',
        isRecommended: true,
      },
      {
        id: 'route_2',
        name: 'via Parallel Avenue',
        geometry: { type: 'LineString', coordinates: coords2 },
        distanceMeters: Math.round(approxDistMeters * 1.15),
        distanceKm: +((approxDistMeters * 1.15) / 1000).toFixed(1),
        durationSeconds: Math.round(((approxDistMeters * 1.15) / 1000 / 28) * 3600),
        durationMin: Math.round(((approxDistMeters * 1.15) / 1000 / 28) * 60),
        summary: 'Residential detour',
        isRecommended: false,
      },
    ];
  }
}

export default OSRMProvider;
