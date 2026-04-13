import React, { useState } from 'react';
import { AlertTriangle, Users, Activity, X, Loader2 } from 'lucide-react';

/* ── Hazard type configs ── */
const HAZARDS = [
  {
    type: 'Blocked Exit',
    icon: AlertTriangle,
    borderColor: '#ef4444',
    gradient:
      'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(239,68,68,0.02))',
  },
  {
    type: 'Overcrowding',
    icon: Users,
    borderColor: '#f59e0b',
    gradient:
      'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(245,158,11,0.02))',
  },
  {
    type: 'Medical Issue',
    icon: Activity,
    borderColor: '#3b82f6',
    gradient:
      'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(59,130,246,0.02))',
  },
];

export default function ReportModal({
  apiBase = 'http://localhost:5000',
  socket,
  userPos,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReport = async (hazardType) => {
    if (loading) return;
    setErrorMsg('');
    setLoading(true);

    try {
      if (!('geolocation' in navigator)) {
        setErrorMsg('Geolocation is not supported by your browser.');
        setLoading(false);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const userId =
            localStorage.getItem('crowd_user_id') || 'anonymous';
          const payload = {
            reportId: userId,
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            description: hazardType,
            riskLevel: 'HIGH',
          };

          try {
            // REST POST to persist in database
            const res = await fetch(`${apiBase}/api/report`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });

            const data = await res.json();
            if (!res.ok)
              throw new Error(data.error || 'Failed to submit report');

            // Phase 2: Socket.IO emit for real-time broadcast to nearby users
            if (socket) {
              socket.emit('hazard_report', {
                type: hazardType,
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                userId,
              });
            }

            setIsOpen(false);
            setToastMsg(`'${hazardType}' reported successfully`);
            setTimeout(() => setToastMsg(''), 4000);
          } catch (err) {
            setErrorMsg(`Error: ${err.message}`);
          } finally {
            setLoading(false);
          }
        },
        () => {
          setErrorMsg('Please allow location access to report hazards.');
          setLoading(false);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    } catch (e) {
      setErrorMsg(`Error: ${e.message}`);
      setLoading(false);
    }
  };

  return (
    <>
      {/* ── Success Toast ── */}
      {toastMsg && (
        <div
          className="fade-in-up"
          style={{
            position: 'fixed',
            bottom: 100,
            right: 24,
            zIndex: 3000,
            background: 'linear-gradient(135deg, #10b981, #059669)',
            color: 'white',
            padding: '12px 20px',
            borderRadius: 'var(--radius-sm)',
            fontWeight: 600,
            boxShadow: '0 8px 20px rgba(16,185,129,0.35)',
            fontSize: '0.92rem',
          }}
        >
          ✅ {toastMsg}
        </div>
      )}

      {/* ── FAB — Warning / Amber style for Hazard ── */}
      <button
        id="report-fab"
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          bottom: 30,
          right: 30,
          zIndex: 2000,
          background: 'linear-gradient(135deg, #f59e0b, #d97706)',
          color: '#000',
          border: 'none',
          padding: '16px 22px',
          borderRadius: 'var(--radius-pill)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontWeight: 700,
          fontSize: '0.95rem',
          cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(245,158,11,0.4)',
          transition: 'transform 0.2s, box-shadow 0.2s',
          fontFamily: 'inherit',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.05)';
          e.currentTarget.style.boxShadow =
            '0 12px 30px rgba(245,158,11,0.55)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow =
            '0 8px 24px rgba(245,158,11,0.4)';
        }}
      >
        <AlertTriangle size={22} /> REPORT HAZARD
      </button>

      {/* ── Modal Overlay ── */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.72)',
            backdropFilter: 'blur(6px)',
            zIndex: 3000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
        >
          <div
            className="fade-in-up"
            style={{
              background:
                'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 'var(--radius-lg)',
              padding: 28,
              width: '92%',
              maxWidth: 420,
              color: 'white',
              boxShadow: '0 30px 60px rgba(0,0,0,0.6)',
              position: 'relative',
            }}
          >
            {/* Close */}
            <button
              onClick={() => setIsOpen(false)}
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#94a3b8',
                cursor: 'pointer',
                borderRadius: 8,
                padding: 6,
                display: 'grid',
                placeItems: 'center',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background =
                  'rgba(255,255,255,0.12)')
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background =
                  'rgba(255,255,255,0.06)')
              }
            >
              <X size={20} />
            </button>

            <h2
              style={{
                margin: '0 0 6px 0',
                fontSize: '1.4rem',
                fontWeight: 700,
              }}
            >
              Report Hazard
            </h2>
            <p
              style={{
                margin: '0 0 20px 0',
                fontSize: '0.85rem',
                color: 'var(--color-text-muted)',
              }}
            >
              Select the type of hazard — your GPS location is attached
              automatically
            </p>

            {/* Error */}
            {errorMsg && (
              <div
                style={{
                  background: 'rgba(127,29,29,0.5)',
                  color: '#fecaca',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: 16,
                  fontSize: '0.85rem',
                  border: '1px solid rgba(239,68,68,0.5)',
                }}
              >
                {errorMsg}
              </div>
            )}

            {/* Hazard buttons */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              {HAZARDS.map(
                ({ type, icon: Icon, borderColor, gradient }) => (
                  <button
                    id={`hazard-${type
                      .toLowerCase()
                      .replace(/\s+/g, '-')}`}
                    key={type}
                    disabled={loading}
                    onClick={(e) => {
                      e.preventDefault();
                      handleReport(type);
                    }}
                    style={{
                      background: gradient,
                      color: 'white',
                      border: `1px solid ${borderColor}55`,
                      padding: '15px 18px',
                      borderRadius: 'var(--radius-sm)',
                      cursor: loading ? 'wait' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      fontSize: '1.05rem',
                      fontWeight: 600,
                      fontFamily: 'inherit',
                      transition: 'border-color 0.2s',
                      opacity: loading ? 0.6 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (!loading)
                        e.currentTarget.style.borderColor = borderColor;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = `${borderColor}55`;
                    }}
                  >
                    {loading ? (
                      <Loader2
                        size={22}
                        style={{
                          animation: 'spin 0.8s linear infinite',
                        }}
                      />
                    ) : (
                      <Icon size={22} color={borderColor} />
                    )}
                    {type}
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
