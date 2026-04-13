import React, { useState, useEffect } from 'react';
import { Bot, CheckCircle } from 'lucide-react';

export default function DemoSpoofer() {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Hidden Spoofer button activated only by URL params
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('demo') === 'true') {
      setShow(true);
    }
  }, []);

  const injectCrowd = async () => {
    setLoading(true);
    setDone(false);

    // Hardcoded demo center: New York
    const centerLat = 40.7580;
    const centerLng = -73.9855;
    const count = 20;

    for (let i = 0; i < count; i++) {
      // Offset ± 0.008 degrees
      const latOffset = (Math.random() - 0.5) * 0.016;
      const lngOffset = (Math.random() - 0.5) * 0.016;

      const payload = {
        userId: crypto.randomUUID(),
        lat: centerLat + latOffset,
        lng: centerLng + lngOffset
      };

      try {
        await fetch('http://localhost:5000/api/location-update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch (err) {
        console.error("Spoofer inject failed:", err);
      }

      // Stagger POSTs with 100ms intervals to prevent network flood feeling
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    setLoading(false);
    setDone(true);
    setTimeout(() => setDone(false), 4000); // Hide toast after 4s
  };

  if (!show) return null;

  return (
    <>
      <button 
        onClick={injectCrowd}
        disabled={loading}
        style={{
          position: 'fixed', top: '24px', right: '24px', zIndex: 3000,
          background: '#8b5cf6', color: 'white', border: '1px solid #a78bfa',
          padding: '12px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px',
          fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.7 : 1, boxShadow: '0 4px 12px rgba(139, 92, 246, 0.4)'
        }}
      >
        <Bot size={20} />
        {loading ? 'Injecting Users...' : 'Inject Demo Crowd (NY)'}
      </button>

      {/* Success Toast Display */}
      {done && (
        <div style={{
          position: 'fixed', top: '80px', right: '24px', zIndex: 3000,
          background: '#10b981', color: 'white', padding: '10px 16px', border: '1px solid #34d399',
          borderRadius: '8px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}>
          <CheckCircle size={20} /> Demo crowd injected
        </div>
      )}
    </>
  );
}
