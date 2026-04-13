/**
 * Crowd Analytics Utility Functions
 * Haversine distance, proximity search, and predictive analysis.
 */

/**
 * Calculate distance between two GPS coordinates in meters (Haversine formula).
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth's radius in meters
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Find all socket IDs within a radius (meters) of a given point.
 * @param {Map} socketLocations - socketId → { userId, lat, lng }
 * @param {number} lat - Center latitude
 * @param {number} lng - Center longitude
 * @param {number} radiusMeters - Search radius in meters
 * @returns {string[]} Array of socket IDs
 */
function findNearbySockets(socketLocations, lat, lng, radiusMeters) {
  const nearby = [];
  for (const [socketId, loc] of socketLocations.entries()) {
    if (haversineDistance(lat, lng, loc.lat, loc.lng) <= radiusMeters) {
      nearby.push(socketId);
    }
  }
  return nearby;
}

/**
 * Predict which zones will escalate to HIGH risk based on user movement velocity.
 * Projects each user's position forward by `minutesAhead` and re-aggregates.
 * @param {Map} locationHistory - userId → [{ lat, lng, timestamp }, ...]
 * @param {Array} currentZones - Current crowd data zones with riskLevel
 * @param {number} minutesAhead - Projection window (default: 5)
 * @returns {Array} Predicted high-risk zones not currently flagged
 */
function calculatePredictions(locationHistory, currentZones, minutesAhead = 5) {
  const predictions = [];
  const projectedPositions = [];
  const msAhead = minutesAhead * 60 * 1000;

  for (const [, history] of locationHistory.entries()) {
    if (history.length < 2) continue;

    const latest = history[history.length - 1];
    const previous = history[history.length - 2];
    const dt = latest.timestamp - previous.timestamp;

    // Skip if no real movement or stale data (>60s gap between updates)
    if (dt <= 0 || dt > 60000) continue;

    // Velocity in degrees per millisecond
    const vLat = (latest.lat - previous.lat) / dt;
    const vLng = (latest.lng - previous.lng) / dt;

    // Project position forward
    projectedPositions.push({
      lat: latest.lat + vLat * msAhead,
      lng: latest.lng + vLng * msAhead,
    });
  }

  if (projectedPositions.length === 0) return predictions;

  // Grid-based aggregation on projected positions (~55m cells)
  const gridFactor = 2000;
  const grid = {};

  projectedPositions.forEach((pos) => {
    const gridLat = Math.round(pos.lat * gridFactor) / gridFactor;
    const gridLng = Math.round(pos.lng * gridFactor) / gridFactor;
    const key = `${gridLat},${gridLng}`;
    if (!grid[key]) grid[key] = { lat: gridLat, lng: gridLng, count: 0 };
    grid[key].count++;
  });

  // Flag zones predicted to become HIGH that aren't currently HIGH
  for (const zone of Object.values(grid)) {
    if (zone.count >= 15) {
      const alreadyHigh = (currentZones || []).some(
        (z) =>
          haversineDistance(z.lat, z.lng, zone.lat, zone.lng) < 100 &&
          (z.riskLevel === 'HIGH' || z.riskLevel === 'CRITICAL')
      );

      if (!alreadyHigh) {
        predictions.push({
          lat: zone.lat,
          lng: zone.lng,
          predictedCount: zone.count,
          minutesAhead,
          type: 'predictive_warning',
          message: `Zone predicted to reach HIGH risk in ~${minutesAhead} min`,
        });
      }
    }
  }

  return predictions;
}

module.exports = { haversineDistance, findNearbySockets, calculatePredictions };
