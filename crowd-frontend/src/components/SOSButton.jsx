import React, { useState, useEffect, useCallback } from 'react';
import { ShieldAlert } from 'lucide-react';

export default function SOSButton({ socket, userPos }) {
  const [countdown, setCountdown] = useState(null);
  const [sent, setSent] = useState(false);

  const startSOS = useCallback(() => {
    if (countdown !== null || sent) return;
    setCountdown(3);
  }, [countdown, sent]);

  const cancelSOS = useCallback(() => {
    setCountdown(null);
  }, []);

  useEffect(() => {
    if (countdown === null) return;

    if (countdown <= 0) {
      // Fire SOS
      const userId = localStorage.getItem('crowd_user_id') || 'anonymous';
      if (userPos && socket) {
        socket.emit('sos_alert', {
          lat: userPos[0],
          lng: userPos[1],
          userId,
        });
      }

      setSent(true);
      setCountdown(null);
      setTimeout(() => setSent(false), 8000);
      return;
    }

    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, socket, userPos]);

  return (
    <button
      id="sos-button"
      onClick={countdown !== null ? cancelSOS : startSOS}
      style={{
        position: 'fixed',
        bottom: 30,
        left: 30,
        zIndex: 2000,
        width: 72,
        height: 72,
        borderRadius: '50%',
        border:
          countdown !== null
            ? '3px solid #fecaca'
            : '3px solid rgba(220,38,38,0.3)',
        background:
          countdown !== null
            ? 'linear-gradient(135deg, #b91c1c, #7f1d1d)'
            : sent
            ? 'linear-gradient(135deg, #059669, #047857)'
            : 'linear-gradient(135deg, #dc2626, #991b1b)',
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        boxShadow:
          countdown !== null
            ? '0 0 30px rgba(239,68,68,0.6), 0 0 60px rgba(239,68,68,0.2)'
            : '0 8px 24px rgba(220,38,38,0.4)',
        fontFamily: 'inherit',
        transition: 'box-shadow 0.3s, transform 0.15s',
        animation: countdown !== null ? 'sosPulse 1s infinite' : 'none',
      }}
      onMouseEnter={(e) => {
        if (countdown === null) e.currentTarget.style.transform = 'scale(1.1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
      }}
    >
      {countdown !== null ? (
        <>
          <span style={{ fontSize: '1.5rem', fontWeight: 800, lineHeight: 1 }}>
            {countdown}
          </span>
          <span
            style={{
              fontSize: '0.45rem',
              fontWeight: 600,
              letterSpacing: '0.3px',
              marginTop: 2,
            }}
          >
            TAP CANCEL
          </span>
        </>
      ) : sent ? (
        <span style={{ fontSize: '0.7rem', fontWeight: 700 }}>SENT ✓</span>
      ) : (
        <>
          <ShieldAlert size={22} strokeWidth={2.5} />
          <span
            style={{
              fontSize: '0.55rem',
              fontWeight: 700,
              marginTop: 2,
              letterSpacing: '1px',
            }}
          >
            SOS
          </span>
        </>
      )}
    </button>
  );
}
