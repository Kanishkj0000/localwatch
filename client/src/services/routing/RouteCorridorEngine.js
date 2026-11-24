/**
 * RouteCorridorEngine
 * Calculates corridors around routes and determines which civic issues fall
 * within the route vicinity, their exact distance from the road, and sequential ordering.
 */

// Earth radius in meters
const EARTH_RADIUS_METERS = 6371000;

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * Convert lat/lng coordinates to local Euclidean meters relative to a reference origin
 */
function projectToMeters(lat, lng, refLat, refLng) {
  const x = toRad(lng - refLng) * EARTH_RADIUS_METERS * Math.cos(toRad(refLat));
  const y = toRad(lat - refLat) * EARTH_RADIUS_METERS;
  return { x, y };
}

/**
 * Calculates perpendicular distance from point P to line segment AB in meters
 * Returns { distanceMeters, t (0 to 1 along segment) }
 */
function pointToSegmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    // A and B are the same point
    return {
      distanceMeters: Math.hypot(px - ax, py - ay),
      t: 0,
    };
  }

  // Projection factor t of point P onto segment AB
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t)); // Clamp to segment

  const nearestX = ax + t * dx;
  const nearestY = ay + t * dy;

  return {
    distanceMeters: Math.hypot(px - nearestX, py - nearestY),
    t,
  };
}

export class RouteCorridorEngine {
  /**
   * Find issues located inside a route's corridor
   * @param {Array} issues - Array of issue objects
   * @param {Object} routeGeometry - GeoJSON LineString coordinates [[lng, lat], ...]
   * @param {number} corridorRadiusMeters - Corridor half-width in meters (e.g., 250m)
   * @returns {Array<CorridorIssue>}
   */
  static findIssuesInCorridor(issues, routeGeometry, corridorRadiusMeters = 250) {
    if (!routeGeometry || !Array.isArray(routeGeometry.coordinates) || routeGeometry.coordinates.length < 2) {
      return [];
    }

    const coords = routeGeometry.coordinates; // Array of [lng, lat]

    // 1. Calculate Bounding Box of the Route + Corridor Buffer for fast O(1) rejection
    let minLng = Infinity;
    let maxLng = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;

    for (let i = 0; i < coords.length; i++) {
      const [lng, lat] = coords[i];
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }

    // Convert corridorRadiusMeters buffer into approximate degrees
    const refLat = (minLat + maxLat) / 2;
    const refLng = (minLng + maxLng) / 2;
    const bufferLat = corridorRadiusMeters / 111320;
    const bufferLng = corridorRadiusMeters / (111320 * Math.cos(toRad(refLat)));

    const bbox = {
      west: minLng - bufferLng,
      east: maxLng + bufferLng,
      south: minLat - bufferLat,
      north: maxLat + bufferLat,
    };

    // Filter issues roughly within bounding box
    const candidateIssues = issues.filter(
      (iss) =>
        iss.lng >= bbox.west &&
        iss.lng <= bbox.east &&
        iss.lat >= bbox.south &&
        iss.lat <= bbox.north
    );

    if (candidateIssues.length === 0) return [];

    // 2. Pre-project route vertices to local Euclidean coordinates in meters
    const projectedCoords = coords.map(([lng, lat]) =>
      projectToMeters(lat, lng, refLat, refLng)
    );

    // Calculate cumulative segment lengths for journey progress tracking
    const cumulativeDistances = [0];
    let totalRouteLength = 0;
    for (let i = 0; i < projectedCoords.length - 1; i++) {
      const segLen = Math.hypot(
        projectedCoords[i + 1].x - projectedCoords[i].x,
        projectedCoords[i + 1].y - projectedCoords[i].y
      );
      totalRouteLength += segLen;
      cumulativeDistances.push(totalRouteLength);
    }

    const corridorIssues = [];

    // 3. For each candidate issue, find minimum distance to any route segment
    for (const issue of candidateIssues) {
      const p = projectToMeters(issue.lat, issue.lng, refLat, refLng);

      let minDistance = Infinity;
      let bestSegmentIndex = 0;
      let bestT = 0;

      for (let i = 0; i < projectedCoords.length - 1; i++) {
        const a = projectedCoords[i];
        const b = projectedCoords[i + 1];

        const { distanceMeters, t } = pointToSegmentDistance(p.x, p.y, a.x, a.y, b.x, b.y);

        if (distanceMeters < minDistance) {
          minDistance = distanceMeters;
          bestSegmentIndex = i;
          bestT = t;
        }
      }

      // Check if within corridor radius
      if (minDistance <= corridorRadiusMeters) {
        const segStartDist = cumulativeDistances[bestSegmentIndex] || 0;
        const segLen = (cumulativeDistances[bestSegmentIndex + 1] || segStartDist) - segStartDist;
        const distanceAlongRouteMeters = segStartDist + segLen * bestT;
        const progressFraction = totalRouteLength > 0 ? distanceAlongRouteMeters / totalRouteLength : 0;

        const isDirectlyOnRoute = minDistance <= 45; // within 45m considered right on the roadway

        corridorIssues.push({
          issue,
          distanceMeters: Math.round(minDistance),
          distanceAlongRouteMeters: Math.round(distanceAlongRouteMeters),
          progressFraction: Math.min(1, Math.max(0, progressFraction)),
          isDirectlyOnRoute,
          relativeLocationText: isDirectlyOnRoute
            ? 'Directly on route'
            : `${Math.round(minDistance)}m from route corridor`,
        });
      }
    }

    // 4. Sort issues sequentially in the order encountered along the route
    corridorIssues.sort((a, b) => a.distanceAlongRouteMeters - b.distanceAlongRouteMeters);

    return corridorIssues;
  }

  /**
   * Calculate summary metrics for a list of corridor issues
   */
  static summarizeRouteIssues(corridorIssues) {
    const total = corridorIssues.length;
    let criticalCount = 0;
    let highCount = 0;
    let mediumCount = 0;
    let directlyOnRouteCount = 0;
    const categoryCount = {};

    for (const item of corridorIssues) {
      const iss = item.issue;
      if (item.isDirectlyOnRoute) directlyOnRouteCount++;

      if (iss.urgency === 'Critical') criticalCount++;
      else if (iss.urgency === 'High') highCount++;
      else mediumCount++;

      categoryCount[iss.category] = (categoryCount[iss.category] || 0) + 1;
    }

    // Safety score out of 100
    const penalty = criticalCount * 30 + highCount * 15 + mediumCount * 5;
    const safetyScore = Math.max(10, Math.min(100, 100 - penalty));

    return {
      total,
      directlyOnRouteCount,
      vicinityCount: total - directlyOnRouteCount,
      criticalCount,
      highCount,
      mediumCount,
      categoryCount,
      safetyScore,
      safetyGrade: safetyScore >= 85 ? 'Clean' : safetyScore >= 60 ? 'Moderate' : 'Caution',
    };
  }
}

export default RouteCorridorEngine;
