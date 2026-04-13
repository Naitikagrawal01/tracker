import React, { useMemo } from 'react';
import { Polyline, Popup, CircleMarker } from 'react-leaflet';

/**
 * Calculate escape route from user position away from HIGH/CRITICAL zones.
 * Uses weighted repulsion vectors from all nearby danger zones.
 */
function calculateSafeRoute(userPos, highRiskZones) {
  if (!userPos || highRiskZones.length === 0) return null;

  // Find the nearest HIGH zone
  let nearestDist = Infinity;
  let nearestZone = null;

  for (const zone of highRiskZones) {
    const dLat = zone.lat - userPos[0];
    const dLng = zone.lng - userPos[1];
    const dist = Math.sqrt(dLat * dLat + dLng * dLng);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestZone = zone;
    }
  }

  // Only show route if user is within ~500m of a HIGH zone
  if (!nearestZone || nearestDist > 0.005) return null;

  // Escape vector: direction from nearest danger zone toward user (away from danger)
  let dLat = userPos[0] - nearestZone.lat;
  let dLng = userPos[1] - nearestZone.lng;
  const mag = Math.sqrt(dLat * dLat + dLng * dLng) || 0.001;
  dLat /= mag;
  dLng /= mag;

  // Add weighted repulsion from other nearby HIGH zones
  for (const zone of highRiskZones) {
    if (zone === nearestZone) continue;
    const zDist = Math.sqrt(
      (zone.lat - userPos[0]) ** 2 + (zone.lng - userPos[1]) ** 2
    );
    if (zDist < 0.01) {
      // Within ~1km — contribute repulsion
      const weight = 0.3 / (zDist + 0.001);
      dLat += ((userPos[0] - zone.lat) / (zDist || 0.001)) * weight;
      dLng += ((userPos[1] - zone.lng) / (zDist || 0.001)) * weight;
    }
  }

  // Re-normalize
  const newMag = Math.sqrt(dLat * dLat + dLng * dLng) || 0.001;
  dLat /= newMag;
  dLng /= newMag;

  // Generate 5 waypoints, each ~150m apart in the escape direction
  const step = 0.0014; // ~155m per step
  const waypoints = [userPos];
  for (let i = 1; i <= 5; i++) {
    waypoints.push([userPos[0] + dLat * step * i, userPos[1] + dLng * step * i]);
  }

  return { waypoints, destination: waypoints[waypoints.length - 1] };
}

export default function SafeRoute({ userPos, crowdData, visible }) {
  const highZones = useMemo(
    () =>
      (crowdData || []).filter(
        (z) => z.riskLevel === 'HIGH' || z.riskLevel === 'CRITICAL'
      ),
    [crowdData]
  );

  const route = useMemo(
    () => calculateSafeRoute(userPos, highZones),
    [userPos, highZones]
  );

  if (!visible || !route) return null;

  return (
    <>
      {/* Evacuation route polyline */}
      <Polyline
        positions={route.waypoints}
        pathOptions={{
          color: '#10b981',
          weight: 4,
          dashArray: '12, 8',
          opacity: 0.85,
          lineCap: 'round',
        }}
      >
        <Popup>
          <div style={{ textAlign: 'center', padding: 6 }}>
            <strong style={{ color: '#059669' }}>🛡️ Safe Evacuation Route</strong>
            <p
              style={{
                color: '#64748b',
                fontSize: '0.8rem',
                margin: '4px 0 0',
              }}
            >
              Follow this path away from danger zones
            </p>
          </div>
        </Popup>
      </Polyline>

      {/* Safe destination marker */}
      <CircleMarker
        center={route.destination}
        radius={14}
        pathOptions={{
          color: '#10b981',
          fillColor: '#10b981',
          fillOpacity: 0.25,
          weight: 2,
          dashArray: '4, 4',
        }}
      >
        <Popup>
          <div style={{ textAlign: 'center', padding: 4 }}>
            <strong style={{ color: '#059669' }}>✅ Safe Zone</strong>
            <p style={{ color: '#64748b', fontSize: '0.75rem', margin: '2px 0 0' }}>
              Evacuate to this area
            </p>
          </div>
        </Popup>
      </CircleMarker>
    </>
  );
}
