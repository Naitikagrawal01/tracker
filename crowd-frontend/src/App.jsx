import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { io } from 'socket.io-client';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  ZoomControl,
  useMap,
} from 'react-leaflet';
import {
  ShieldAlert,
  Users,
  Activity,
  MapPin,
  Radio,
  Navigation,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import './index.css';

import ReportModal from './components/ReportModal';
import DemoSpoofer from './components/DemoSpoofer';
import SOSButton from './components/SOSButton';
import EmergencyBanner from './components/EmergencyBanner';
import SafeRoute from './components/SafeRoute';

/* ── API + Socket (module level, reassigned on port fallback) ── */
let API_BASE = "https://tracker-1-b1ri.onrender.com";
let socket = io(API_BASE, { transports: ['websocket', 'polling'] });

/* ── Recenter map on first GPS fix ── */
function RecenterMap({ center }) {
  const map = useMap();
  const hasCentered = useRef(false);
  useEffect(() => {
    if (center && !hasCentered.current) {
      map.flyTo(center, 14, { duration: 1.2 });
      hasCentered.current = true;
    }
  }, [center, map]);
  return null;
}

/* ── Risk colors & marker radius ── */
const RISK_COLORS = {
  LOW: '#10b981',
  MEDIUM: '#f59e0b',
  HIGH: '#ef4444',
  CRITICAL: '#dc2626',
};

const RISK_RADIUS = { LOW: 18, MEDIUM: 24, HIGH: 30, CRITICAL: 36 };

/* ═══════════════════════ App ═══════════════════════ */
function App() {
  const [crowdData, setCrowdData] = useState([]);
  const [activeUsers, setActiveUsers] = useState(0);
  const [hasHighRisk, setHasHighRisk] = useState(false);
  const [geoError, setGeoError] = useState(false);
  const [mapCenter, setMapCenter] = useState(null);
  const [userPos, setUserPos] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting');

  /* Phase 2: emergency alerts */
  const [emergencyAlerts, setEmergencyAlerts] = useState([]);

  /* Phase 3: safe route + predictions */
  const [showSafeRoute, setShowSafeRoute] = useState(false);
  const [predictions, setPredictions] = useState([]);

  /* ── Phase 1: overall risk for panel styling ── */
  const overallRisk = useMemo(() => {
    if (crowdData.some((z) => z.riskLevel === 'CRITICAL')) return 'CRITICAL';
    if (crowdData.some((z) => z.riskLevel === 'HIGH')) return 'HIGH';
    if (crowdData.some((z) => z.riskLevel === 'MEDIUM')) return 'MEDIUM';
    return 'LOW';
  }, [crowdData]);

  const applyData = useCallback((data) => {
    setCrowdData(data.crowdData || []);
    setActiveUsers(data.totalActiveUsers || 0);
    setHasHighRisk(
      (data.crowdData || []).some(
        (a) => a.riskLevel === 'HIGH' || a.riskLevel === 'CRITICAL'
      )
    );
  }, []);

  /* ── Socket + initial data fetch ── */
  useEffect(() => {
    const fetchInitial = async (base) => {
  const res = await fetch(`${base}/crowd-data`);
  return res.json();
};

    const bootstrap = async () => {
      try {
        applyData(await fetchInitial(API_BASE));
        setConnectionStatus('connected');
      } catch {
        console.warn('Port 5000 unavailable — falling back to 5001');
        API_BASE = 'http://localhost:5001';
        socket.disconnect();
        socket = io(API_BASE, { transports: ['websocket', 'polling'] });
        try {
          applyData(await fetchInitial(API_BASE));
          setConnectionStatus('connected');
        } catch {
          setConnectionStatus('offline');
        }
      }
    };

    bootstrap();

    socket.on('connect', () => setConnectionStatus('connected'));
    socket.on('disconnect', () => setConnectionStatus('reconnecting'));
    socket.on('crowd-update', applyData);

    /* Phase 2: emergency alerts from nearby hazard/SOS */
    socket.on('emergency_alert', (data) => {
      const id = Date.now() + Math.random();
      setEmergencyAlerts((prev) => [...prev, { ...data, id }]);
      // Auto-dismiss after 12 seconds
      setTimeout(() => {
        setEmergencyAlerts((prev) => prev.filter((a) => a.id !== id));
      }, 12000);
    });

    /* Phase 3: predictive warnings from backend AI */
    socket.on('predictive_warning', (preds) => {
      setPredictions(preds);
      setTimeout(() => setPredictions([]), 10000);
    });

    return () => {
      socket.off('crowd-update');
      socket.off('connect');
      socket.off('disconnect');
      socket.off('emergency_alert');
      socket.off('predictive_warning');
    };
  }, [applyData]);

  /* ── Geolocation tracking ── */
  useEffect(() => {
    let watchId;
    let userId = localStorage.getItem('crowd_user_id');
    if (!userId) {
      userId = crypto.randomUUID();
      localStorage.setItem('crowd_user_id', userId);
    }

    if ('geolocation' in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setGeoError(false);
          const coords = [pos.coords.latitude, pos.coords.longitude];
          setUserPos(coords);
          if (!mapCenter) setMapCenter(coords);

          // REST: persist location in database
          fetch(`${API_BASE}/api/location-update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId,
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            }),
          }).catch(() => {});

          // Socket: register for proximity-based alerts (Phase 2)
          socket.emit('register_location', {
            userId,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        (error) => {
          if (error.code === error.PERMISSION_DENIED) setGeoError(true);
          if (!mapCenter) setMapCenter([28.6139, 77.209]);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      if (!mapCenter) setMapCenter([28.6139, 77.209]);
    }

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Derived values ── */
  const statusColor =
    connectionStatus === 'connected'
      ? '#10b981'
      : connectionStatus === 'reconnecting'
      ? '#f59e0b'
      : '#ef4444';

  const panelBorderColor = RISK_COLORS[overallRisk];

  const dismissAlert = useCallback((alert) => {
    setEmergencyAlerts((prev) => prev.filter((a) => a.id !== alert.id));
  }, []);

  return (
    <div style={{ height: '100vh', width: '100vw', position: 'relative' }}>
      {/* ─── Phase 2: Emergency Alert Banner ─── */}
      <EmergencyBanner alerts={emergencyAlerts} onDismiss={dismissAlert} />

      {/* ─── Floating Control Panel ─── */}
      <div
        className="glass-panel control-panel fade-in-up"
        style={{
          position: 'absolute',
          top: 24,
          left: 24,
          zIndex: 1000,
          padding: 24,
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          minWidth: 300,
          borderLeft: `3px solid ${panelBorderColor}`,
          transition: 'border-color 0.5s ease',
        }}
      >
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              padding: 12,
              background: 'linear-gradient(135deg, #2563eb, #8b5cf6)',
              borderRadius: 'var(--radius-md)',
              boxShadow: '0 4px 18px var(--color-accent-glow)',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <Activity color="white" size={26} />
          </div>
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: '1.45rem',
                fontWeight: 700,
                letterSpacing: '-0.5px',
                color: '#fff',
              }}
            >
              CrowdSafe
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: '0.85rem',
                color: 'var(--color-text-muted)',
              }}
            >
              Live Crowd Monitor
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 10 }}>
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: 'rgba(255,255,255,0.04)',
              padding: '12px 16px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
            }}
          >
            <Users size={18} color="var(--color-text-muted)" />
            <div>
              <div
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--color-text-muted)',
                  fontWeight: 500,
                }}
              >
                Tracking
              </div>
              <div
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: '#38bdf8',
                  textShadow: '0 2px 10px rgba(56,189,248,0.35)',
                }}
              >
                {activeUsers}
              </div>
            </div>
          </div>
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: 'rgba(255,255,255,0.04)',
              padding: '12px 16px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
            }}
          >
            <MapPin size={18} color="var(--color-text-muted)" />
            <div>
              <div
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--color-text-muted)',
                  fontWeight: 500,
                }}
              >
                Zones
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#a78bfa' }}>
                {crowdData.length}
              </div>
            </div>
          </div>
        </div>

        {/* Phase 1: Overall Risk Status — dynamic color */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 14px',
            background: `${panelBorderColor}15`,
            borderRadius: 'var(--radius-sm)',
            border: `1px solid ${panelBorderColor}44`,
            transition: 'all 0.5s ease',
          }}
        >
          <TrendingUp size={18} color={panelBorderColor} />
          <span
            style={{
              fontSize: '0.82rem',
              fontWeight: 600,
              color: panelBorderColor,
            }}
          >
            Overall Risk: {overallRisk}
          </span>
        </div>

        {/* Connection + Safe Route toggle row */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 12px',
              background: 'rgba(255,255,255,0.03)',
              borderRadius: 'var(--radius-pill)',
              border: `1px solid ${statusColor}33`,
            }}
          >
            <Radio size={12} color={statusColor} />
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 600,
                color: statusColor,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              {connectionStatus}
            </span>
          </div>

          {/* Phase 3: Safe Route Toggle */}
          <button
            id="safe-route-toggle"
            onClick={() => setShowSafeRoute((v) => !v)}
            className={`safe-route-btn ${showSafeRoute ? 'active' : ''}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              background: showSafeRoute
                ? 'rgba(16,185,129,0.15)'
                : 'rgba(255,255,255,0.03)',
              borderRadius: 'var(--radius-pill)',
              border: `1px solid ${
                showSafeRoute ? '#10b98166' : 'var(--color-border)'
              }`,
              color: showSafeRoute ? '#10b981' : 'var(--color-text-muted)',
              cursor: 'pointer',
              fontSize: '0.7rem',
              fontWeight: 600,
              fontFamily: 'inherit',
              letterSpacing: '0.3px',
              transition: 'all 0.2s',
            }}
          >
            <Navigation size={12} />
            {showSafeRoute ? 'ROUTE ON' : 'SAFE ROUTE'}
          </button>
        </div>

        {/* Risk Legend */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {Object.entries(RISK_COLORS).map(([level, color]) => (
            <div
              key={level}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 9px',
                borderRadius: 'var(--radius-pill)',
                background: `${color}18`,
                border: `1px solid ${color}44`,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: color,
                  boxShadow: `0 0 6px ${color}`,
                }}
              />
              <span
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  color,
                  letterSpacing: '0.5px',
                }}
              >
                {level}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Critical Alert Banner ─── */}
      {hasHighRisk && (
        <div
          className="glass-panel danger-glow animate-slide-down"
          style={{
            position: 'absolute',
            top: 28,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            padding: '14px 28px',
            borderRadius: 'var(--radius-pill)',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            whiteSpace: 'nowrap',
          }}
        >
          <div
            className="pulsate-icon"
            style={{ color: '#ef4444', display: 'grid' }}
          >
            <ShieldAlert size={26} strokeWidth={2.5} />
          </div>
          <span
            style={{
              fontWeight: 600,
              fontSize: '1rem',
              color: '#fecaca',
              letterSpacing: '0.4px',
            }}
          >
            CRITICAL — High crowd density detected nearby
          </span>
        </div>
      )}

      {/* ─── Phase 3: Predictive Warning ─── */}
      {predictions.length > 0 && (
        <div
          className="fade-in-up prediction-badge"
          style={{
            position: 'absolute',
            top: hasHighRisk ? 90 : 28,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 999,
            padding: '10px 22px',
            borderRadius: 'var(--radius-pill)',
            background: 'rgba(120,53,15,0.85)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(245,158,11,0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            boxShadow: '0 8px 20px rgba(245,158,11,0.2)',
          }}
        >
          <AlertTriangle size={20} color="#f59e0b" />
          <span
            style={{
              fontSize: '0.85rem',
              fontWeight: 600,
              color: '#fde68a',
            }}
          >
            AI PREDICTION: {predictions[0].message}
          </span>
        </div>
      )}

      {/* ─── Map ─── */}
      {mapCenter ? (
        <MapContainer
          center={mapCenter}
          zoom={13}
          zoomControl={false}
          style={{ height: '100%', width: '100%', zIndex: 1 }}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
          />
          <ZoomControl position="bottomright" />
          <RecenterMap center={mapCenter} />

          {/* User's position beacon */}
          {userPos && (
            <CircleMarker
              center={userPos}
              radius={8}
              pathOptions={{
                color: '#2563eb',
                fillColor: '#60a5fa',
                fillOpacity: 0.9,
                weight: 3,
              }}
            >
              <Popup>
                <div style={{ textAlign: 'center', padding: 4 }}>
                  <strong style={{ color: '#0f172a' }}>📍 Your Location</strong>
                </div>
              </Popup>
            </CircleMarker>
          )}

          {/* Crowd zone markers */}
          {crowdData.map((area, idx) => {
            const color = RISK_COLORS[area.riskLevel] || RISK_COLORS.LOW;
            const radius = RISK_RADIUS[area.riskLevel] || 18;
            return (
              <CircleMarker
                key={`zone-${idx}`}
                center={[area.lat, area.lng]}
                radius={radius}
                pathOptions={{
                  color,
                  fillColor: color,
                  fillOpacity: 0.2,
                  weight: 2,
                }}
              >
                <Popup>
                  <div
                    style={{
                      textAlign: 'center',
                      padding: 8,
                      minWidth: 140,
                    }}
                  >
                    <div
                      style={{
                        display: 'inline-flex',
                        padding: '3px 10px',
                        borderRadius: 6,
                        background: color,
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: '0.72rem',
                        letterSpacing: '1px',
                        marginBottom: 10,
                      }}
                    >
                      {area.riskLevel} RISK
                    </div>
                    <h3
                      style={{
                        margin: '0 0 4px',
                        fontSize: '1.2rem',
                        color: '#0f172a',
                      }}
                    >
                      {area.crowdCount} Users
                    </h3>
                    <p
                      style={{
                        margin: 0,
                        fontSize: '0.8rem',
                        color: '#64748b',
                      }}
                    >
                      Active individuals in this zone
                    </p>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}

          {/* Phase 3: Safe evacuation route */}
          <SafeRoute
            userPos={userPos}
            crowdData={crowdData}
            visible={showSafeRoute}
          />
        </MapContainer>
      ) : (
        <div className="skeleton-map">
          <div className="loader-ring" />
          <span
            style={{
              fontSize: '0.95rem',
              color: 'var(--color-text-muted)',
              fontWeight: 500,
            }}
          >
            Locating you for the live map…
          </span>
        </div>
      )}

      {/* ─── Geo Error Warning ─── */}
      {geoError && (
        <div
          className="fade-in-up"
          style={{
            position: 'absolute',
            bottom: 24,
            left: 110,
            zIndex: 3000,
            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
            color: '#000',
            padding: '12px 18px',
            borderRadius: 'var(--radius-sm)',
            fontWeight: 600,
            fontSize: '0.88rem',
            boxShadow: '0 6px 16px rgba(0,0,0,0.3)',
            maxWidth: 320,
          }}
        >
          ⚠️ Location access required — enable GPS to contribute to the live map
        </div>
      )}

      {/* ─── Phase 2: SOS + Report Hazard ─── */}
      <SOSButton socket={socket} userPos={userPos} />
      <ReportModal apiBase={API_BASE} socket={socket} userPos={userPos} />
      <DemoSpoofer apiBase={API_BASE} />
    </div>
  );
}

export default App;
