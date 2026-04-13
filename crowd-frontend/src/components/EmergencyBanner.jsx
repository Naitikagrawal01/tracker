import React from 'react';
import { AlertTriangle, ShieldAlert, X } from 'lucide-react';

export default function EmergencyBanner({ alerts, onDismiss }) {
  if (!alerts || alerts.length === 0) return null;

  const latest = alerts[alerts.length - 1];
  const isSOS = latest.severity === 'critical';

  return (
    <div
      className="animate-slide-down"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 4000,
        background: isSOS
          ? 'linear-gradient(135deg, rgba(127,29,29,0.96), rgba(185,28,28,0.96))'
          : 'linear-gradient(135deg, rgba(120,53,15,0.96), rgba(180,83,9,0.96))',
        backdropFilter: 'blur(12px)',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        borderBottom: `2px solid ${isSOS ? '#ef4444' : '#f59e0b'}`,
        boxShadow: isSOS
          ? '0 4px 30px rgba(239,68,68,0.4)'
          : '0 4px 30px rgba(245,158,11,0.3)',
      }}
    >
      <div className="pulsate-icon" style={{ display: 'grid' }}>
        {isSOS ? (
          <ShieldAlert size={28} color="#fecaca" strokeWidth={2.5} />
        ) : (
          <AlertTriangle size={28} color="#fde68a" strokeWidth={2.5} />
        )}
      </div>

      <div style={{ flex: 1 }}>
        <div
          style={{
            fontWeight: 700,
            fontSize: '0.88rem',
            color: isSOS ? '#fecaca' : '#fde68a',
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
          }}
        >
          {isSOS ? '🚨 SOS Emergency Alert' : '⚠️ Hazard Warning'}
        </div>
        <div
          style={{
            fontSize: '0.85rem',
            color: 'rgba(255,255,255,0.88)',
            marginTop: 3,
          }}
        >
          {latest.message}
        </div>
      </div>

      {/* Alert count badge */}
      {alerts.length > 1 && (
        <div
          style={{
            background: 'rgba(255,255,255,0.15)',
            borderRadius: '50%',
            width: 28,
            height: 28,
            display: 'grid',
            placeItems: 'center',
            fontSize: '0.75rem',
            fontWeight: 700,
            color: 'white',
          }}
        >
          {alerts.length}
        </div>
      )}

      <button
        onClick={() => onDismiss(latest)}
        style={{
          background: 'rgba(255,255,255,0.12)',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 6,
          padding: 6,
          cursor: 'pointer',
          color: 'white',
          display: 'grid',
          placeItems: 'center',
          transition: 'background 0.2s',
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.background = 'rgba(255,255,255,0.25)')
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')
        }
      >
        <X size={18} />
      </button>
    </div>
  );
}
