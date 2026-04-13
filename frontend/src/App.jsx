import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { MapContainer, TileLayer, CircleMarker, Popup, ZoomControl } from 'react-leaflet';
import { ShieldAlert, Users, Activity } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import './index.css';

// Import new components
import ReportModal from './components/ReportModal';
import DemoSpoofer from './components/DemoSpoofer';

let socket = io("http://localhost:5000");
let API_BASE = "http://localhost:5000";

function App() {
  const [crowdData, setCrowdData] = useState([]);
  const [activeUsers, setActiveUsers] = useState(0);
  const [hasHighRisk, setHasHighRisk] = useState(false);
  const [geoError, setGeoError] = useState(false);

  useEffect(() => {
    const initDataFetching = async () => {
      try {
        let res = await fetch(`${API_BASE}/api/crowd-data`);
        let data = await res.json();
        setCrowdData(data.crowdData);
        setActiveUsers(data.totalActiveUsers);
        setHasHighRisk(data.crowdData.some(area => area.riskLevel === 'HIGH' || area.riskLevel === 'CRITICAL'));
      } catch (err) {
        console.warn("Port 5000 failed, falling back to 5001");
        API_BASE = "http://localhost:5001";
        socket.disconnect();
        socket = io(API_BASE); // Reconnect Socket to the fallback port
        
        try {
          let res = await fetch(`${API_BASE}/api/crowd-data`);
          let data = await res.json();
          setCrowdData(data.crowdData);
          setActiveUsers(data.totalActiveUsers);
          setHasHighRisk(data.crowdData.some(area => area.riskLevel === 'HIGH' || area.riskLevel === 'CRITICAL'));
        } catch (fallbackErr) {
          console.error("Could not fetch initial data from fallback port either:", fallbackErr);
        }
      }
    };

    initDataFetching();

    socket.on('crowd-update', (data) => {
      setCrowdData(data.crowdData);
      setActiveUsers(data.totalActiveUsers);
      setHasHighRisk(data.crowdData.some(area => area.riskLevel === 'HIGH' || area.riskLevel === 'CRITICAL'));
    });

    // Fix 1: Geolocation tracking
    let watchId;
    let userId = localStorage.getItem('crowd_user_id');
    if (!userId) {
      userId = crypto.randomUUID();
      localStorage.setItem('crowd_user_id', userId);
    }

    if ("geolocation" in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          setGeoError(false);
          const currentPos = [position.coords.latitude, position.coords.longitude];
          setMapCenter(currentPos); // Center map on real user instead of hardcoded fallback

          // Send location update silently in background
          fetch(`${API_BASE}/api/location-update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId,
              lat: position.coords.latitude,
              lng: position.coords.longitude
            })
          }).catch(err => console.error("Could not send location:", err));
        },
        (error) => {
          console.error("Geolocation error:", error);
          if (error.code === error.PERMISSION_DENIED) {
            setGeoError(true);
          }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      console.warn("Geolocation not supported");
    }

    return () => {
      socket.off('crowdUpdate');
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  const [mapCenter, setMapCenter] = useState(null); // No hardcoded default

  return (
    <div style={{ height: '100vh', width: '100vw', position: 'relative' }}>
      
      {/* Floating Glassmorphic Control Panel Overlay */}
      <div 
        className="glass-panel"
        style={{
          position: 'absolute',
          top: '24px',
          left: '24px',
          zIndex: 1000,
          padding: '24px',
          borderRadius: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          minWidth: '300px'
        }}
      >
        {/* Brand Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ padding: '12px', background: 'linear-gradient(135deg, #2563eb, #8b5cf6)', borderRadius: '14px', boxShadow: '0 4px 15px rgba(37,99,235,0.4)' }}>
            <Activity color="white" size={28} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700', letterSpacing: '-0.5px', color: '#fff' }}>Safeguard</h1>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#94a3b8', fontWeight: '400' }}>Live Crowd Monitor</p>
          </div>
        </div>

        {/* Global Stats Block */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.06)', padding: '14px 20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Users size={20} color="#94a3b8" />
            <span style={{ fontSize: '0.95rem', color: '#cbd5e1', fontWeight: '500' }}>Active Trackers</span>
          </div>
          <span style={{ fontSize: '1.4rem', fontWeight: '700', color: '#38bdf8', textShadow: '0 2px 10px rgba(56,189,248,0.4)' }}>
            {activeUsers}
          </span>
        </div>
      </div>

      {/* High Risk Alert Banner / Pill shape at top center */}
      {hasHighRisk && (
        <div 
          className="glass-panel danger-glow animate-slide-down"
          style={{
            position: 'absolute',
            top: '32px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            padding: '16px 28px',
            borderRadius: '9999px', // Pill shape
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          <div className="pulsate-icon" style={{ color: '#ef4444' }}>
            <ShieldAlert size={28} strokeWidth={2.5} />
          </div>
          <span style={{ fontWeight: '600', fontSize: '1.1rem', color: '#fecaca', letterSpacing: '0.5px' }}>
            CRITICAL: High crowd density detected nearby.
          </span>
        </div>
      )}
      
      {/* Immersive Dark Mode Map Container */}
      {mapCenter ? (
        <MapContainer 
          center={mapCenter} 
          zoom={13} 
          zoomControl={false} // Disable default so we can place it nicely
          style={{ height: '100%', width: '100%', zIndex: 1 }}
        >
          {/* We use CARTO's dark tiles for an out-of-the-box stunning dark UI map */}
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
          />
          
          {/* Custom Zoom Control position so it doesn't overlap our panel */}
          <ZoomControl position="bottomright" />

          {/* Dynamic Heatmap-style Circle Markers */}
          {crowdData.map((area, idx) => {
            let riskColor = '#10b981'; // Emerald - Low Risk
            if (area.riskLevel === 'MEDIUM') riskColor = '#f59e0b'; // Amber - Medium
            else if (area.riskLevel === 'HIGH') riskColor = '#ef4444'; // Red - High
            else if (area.riskLevel === 'CRITICAL') riskColor = '#7f1d1d'; // Dark Red - Critical

            return (
              <CircleMarker
                key={idx}
                center={[area.lat, area.lng]}
                radius={24} // large enough to click and look like a heat 'blob'
                pathOptions={{ 
                  color: riskColor, 
                  fillColor: riskColor, 
                  fillOpacity: 0.25, // Sleek translucent fill
                  weight: 2 // Crisp outer ring
                }}
              >
                <Popup>
                  <div style={{ textAlign: 'center', padding: '6px' }}>
                    <div style={{ 
                      display: 'inline-flex', padding: '4px 10px', borderRadius: '6px', 
                      background: riskColor, color: '#fff', fontWeight: '700', fontSize: '0.75rem', 
                      letterSpacing: '1px', marginBottom: '10px' 
                    }}>
                      {area.riskLevel.toUpperCase()} RISK
                    </div>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '1.3rem', color: '#0f172a' }}>
                      {area.crowdCount} Users
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                      Tracking active individuals in this zone.
                    </p>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      ) : (
        <div style={{ height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
          Finding your location to load the map...
        </div>
      )}

      {/* Geolocation Warning Banner */}
      {geoError && (
        <div style={{
          position: 'absolute', bottom: '24px', left: '24px', zIndex: 3000,
          background: '#f59e0b', color: '#000', padding: '12px 16px',
          borderRadius: '8px', fontWeight: 'bold', fontSize: '0.9rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)', maxWidth: '300px'
        }}>
          ⚠️ Location Access Required: Please enable location services to contribute to the live map!
        </div>
      )}

      {/* Fix 3 & 4 Components */}
      <ReportModal apiBase={API_BASE} />
      <DemoSpoofer />
    </div>
  );
}

export default App;
