import React, { useState, useEffect } from 'react';
import { Bot, CheckCircle, Loader2 } from 'lucide-react';

export default function DemoSpoofer({ apiBase = 'http://localhost:5000' }) {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('demo') === 'true') setShow(true);
  }, []);

  const injectCrowd = async () => {
    if (loading) return;
    setLoading(true);
    setDone(false);
    setProgress(0);

    // Get user's current position as center, fallback to Delhi
    let centerLat = 28.6139;
    let centerLng = 77.209;

    try {
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 5000,
        });
      });
      centerLat = pos.coords.latitude;
      centerLng = pos.coords.longitude;
    } catch {
      console.warn('DemoSpoofer: Using fallback center');
    }

    // Snap to grid center to ensure tight users land in same aggregation cell
    const snap = (v) => Math.round(v * 2000) / 2000;

    // Three clusters to demonstrate all risk levels:
    //   - 16 tight  → HIGH  (≥15 users in ~55m cell)
    //   - 7 medium  → MEDIUM (5-14 users in ~55m cell)
    //   - 2 scatter → LOW   (<5 users per cell)
    const clusters = [
      {
        count: 16,
        centerLat: snap(centerLat),
        centerLng: snap(centerLng),
        spread: 0.0002, // ~22m — all land in same grid cell → HIGH
      },
      {
        count: 7,
        centerLat: snap(centerLat + 0.003), // ~330m north
        centerLng: snap(centerLng + 0.002),
        spread: 0.0003, // ~33m — same cell → MEDIUM
      },
      {
        count: 2,
        centerLat: centerLat - 0.004, // ~440m south
        centerLng: centerLng - 0.003,
        spread: 0.005, // ~550m — scattered → LOW
      },
    ];

    const totalCount = clusters.reduce((sum, c) => sum + c.count, 0);
    let injected = 0;

    for (const cluster of clusters) {
      for (let i = 0; i < cluster.count; i++) {
        const latOffset = (Math.random() - 0.5) * 2 * cluster.spread;
        const lngOffset = (Math.random() - 0.5) * 2 * cluster.spread;

        const payload = {
          userId: `demo-${crypto.randomUUID()}`,
          lat: cluster.centerLat + latOffset,
          lng: cluster.centerLng + lngOffset,
        };

        try {
          await fetch(`${apiBase}/api/location-update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
        } catch (err) {
          console.error('DemoSpoofer inject failed:', err);
        }

        injected++;
        setProgress(Math.round((injected / totalCount) * 100));
        await new Promise((r) => setTimeout(r, 60));
      }
    }

    setLoading(false);
    setDone(true);
    setTimeout(() => setDone(false), 5000);
  };

  if (!show) return null;

  return (
    <>
      <button
        id="demo-spoofer"
        onClick={injectCrowd}
        disabled={loading}
        style={{
          position: 'fixed',
          top: 24,
          right: 24,
          zIndex: 3000,
          background: loading
            ? 'linear-gradient(135deg, #6d28d9, #4c1d95)'
            : 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
          color: 'white',
          border: '1px solid rgba(167,139,250,0.3)',
          padding: '12px 18px',
          borderRadius: 'var(--radius-sm)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontWeight: 700,
          fontSize: '0.88rem',
          cursor: loading ? 'wait' : 'pointer',
          boxShadow: '0 6px 18px rgba(139,92,246,0.35)',
          fontFamily: 'inherit',
          transition: 'transform 0.2s',
        }}
        onMouseEnter={(e) => {
          if (!loading) e.currentTarget.style.transform = 'scale(1.04)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        {loading ? (
          <>
            <Loader2
              size={18}
              style={{ animation: 'spin 0.8s linear infinite' }}
            />
            Injecting… {progress}%
          </>
        ) : (
          <>
            <Bot size={18} />
            Inject Demo Crowd (25)
          </>
        )}
      </button>

      {done && (
        <div
          className="fade-in-up"
          style={{
            position: 'fixed',
            top: 80,
            right: 24,
            zIndex: 3000,
            background: 'linear-gradient(135deg, #10b981, #059669)',
            color: 'white',
            padding: '10px 18px',
            borderRadius: 'var(--radius-sm)',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: '0 6px 16px rgba(16,185,129,0.35)',
            fontSize: '0.88rem',
          }}
        >
          <CheckCircle size={18} /> Demo crowd injected — HIGH, MEDIUM & LOW
          zones active
        </div>
      )}
    </>
  );
}
