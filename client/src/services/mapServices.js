// Free geocoding using OpenStreetMap's Nominatim API
// Free routing using OSRM (Open Source Routing Machine)

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const OSRM_BASE = 'https://router.project-osrm.org';

// Search for places by name — returns array of { name, lat, lng }
export async function searchPlaces(query) {
  if (!query || query.length < 3) return [];
  
  try {
    const res = await fetch(
      `${NOMINATIM_BASE}/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=in`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const data = await res.json();
    return data.map(item => ({
      name: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
    }));
  } catch (err) {
    console.error('Geocoding error:', err);
    return [];
  }
}

// Get driving route between waypoints — returns GeoJSON LineString + distance/duration
export async function getRoute(waypoints) {
  if (waypoints.length < 2) return null;
  
  const coords = waypoints.map(wp => `${wp.lng},${wp.lat}`).join(';');
  
  try {
    const res = await fetch(
      `${OSRM_BASE}/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`
    );
    const data = await res.json();
    
    if (data.code !== 'Ok' || !data.routes.length) return null;
    
    const route = data.routes[0];
    return {
      geometry: route.geometry, // GeoJSON LineString
      distance: route.distance, // meters
      duration: route.duration, // seconds
    };
  } catch (err) {
    console.error('Routing error:', err);
    return null;
  }
}

// Find issues that are within a certain distance (in km) of the route
export function findIssuesNearRoute(issues, routeGeometry, radiusKm = 0.5) {
  if (!routeGeometry || !routeGeometry.coordinates) return [];
  
  const routeCoords = routeGeometry.coordinates; // array of [lng, lat]
  
  return issues.filter(issue => {
    // Check if the issue is within radiusKm of any point on the route
    for (let i = 0; i < routeCoords.length; i += 5) { // Sample every 5th point for perf
      const [rLng, rLat] = routeCoords[i];
      const dist = haversineKm(rLat, rLng, issue.lat, issue.lng);
      if (dist <= radiusKm) return true;
    }
    return false;
  });
}

// Haversine formula — distance between two lat/lng points in km
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg) { return deg * Math.PI / 180; }
