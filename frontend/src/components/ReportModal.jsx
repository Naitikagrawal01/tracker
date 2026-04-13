import React, { useState } from 'react';
import { AlertOctagon, Flame, Activity as MedIcon, Users, X } from 'lucide-react';

export default function ReportModal({ apiBase = 'http://localhost:5000' }) {
    console.log("API_BASE prop check:", apiBase);
    const [isOpen, setIsOpen] = useState(false);
    const [toastMsg, setToastMsg] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
  
    const handleReport = async (incidentType) => {
      try {
        setErrorMsg('');
        if (!("geolocation" in navigator)) {
          setErrorMsg("Geolocation is not supported by your browser.");
          return;
        }
  
        navigator.geolocation.getCurrentPosition(async (position) => {
        const payload = {
          reportId: localStorage.getItem('crowd_user_id') || 'anonymous',
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          description: incidentType,
          riskLevel: 'HIGH'
        };
        
        console.log("📤 Sending Report Payload:", payload);
  
        try {
          const res = await fetch(`${apiBase}/api/report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          
          const data = await res.json();
          
          if (!res.ok) {
            throw new Error(data.error || 'Failed to submit report');
          }
  
          setIsOpen(false);
          setToastMsg(`Success! '${incidentType}' reported.`);
          setTimeout(() => setToastMsg(''), 4000);
        } catch (err) {
          console.error("Failed to report within fetch:", err);
          setErrorMsg(`Error: ${err.message}`);
        }
      }, (error) => {
        console.error("Geolocation error callback:", error);
        setErrorMsg("Please allow location access to report incidents.");
      }, { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 });
    } catch (e) {
      console.error("Main click handler error caught:", e);
      setErrorMsg(`Error: ${e.message}`);
    }
  };
  return (
    <>
      {/* Toast Notification */}
      {toastMsg && (
        <div style={{
          position: 'fixed', bottom: '100px', right: '24px', zIndex: 3000,
          background: '#10b981', color: 'white', padding: '12px 20px',
          borderRadius: '8px', fontWeight: 'bold', boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}>
          ✅ {toastMsg}
        </div>
      )}

      {/* Floating Trigger Button */}
      <button 
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed', bottom: '30px', right: '30px', zIndex: 2000,
          background: '#ef4444', color: 'white', border: 'none',
          padding: '16px 20px', borderRadius: '50px', display: 'flex', alignItems: 'center', gap: '8px',
          fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer',
          boxShadow: '0 8px 20px rgba(239, 68, 68, 0.4)',
        }}
      >
        <AlertOctagon size={24} /> REPORT INCIDENT
      </button>

      {/* Modal Overlay */}
      {isOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(5px)',
          zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: '#1e293b', border: '1px solid #334155', borderRadius: '16px',
            padding: '24px', width: '90%', maxWidth: '400px', color: 'white',
            boxShadow: '0 25px 50px rgba(0,0,0,0.5)', position: 'relative'
          }}>
            <button onClick={() => setIsOpen(false)} style={{
              position: 'absolute', top: '16px', right: '16px', background: 'transparent',
              border: 'none', color: '#94a3b8', cursor: 'pointer'
            }}>
              <X size={24} />
            </button>
            <h2 style={{ margin: '0 0 20px 0', fontSize: '1.5rem' }}>Report Emergency</h2>
            
            {errorMsg && (
              <div style={{ background: '#7f1d1d', color: '#fecaca', padding: '10px', borderRadius: '6px', marginBottom: '16px', fontSize: '0.9rem', border: '1px solid #ef4444' }}>
                {errorMsg}
              </div>
            )}
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button 
                onClick={(e) => {
                  e.preventDefault();
                  try {
                    handleReport('Overcrowding');
                  } catch (err) {
                    console.error("Overcrowding button error:", err);
                  }
                }} 
                style={{ background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid #f59e0b', padding: '16px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '1.1rem', fontWeight: '600' }}
              ><Users /> Overcrowding</button>

              <button 
                onClick={(e) => {
                  e.preventDefault();
                  try {
                    handleReport('Stampede');
                  } catch (err) {
                    console.error("Stampede button error:", err);
                  }
                }} 
                style={{ background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid #ef4444', padding: '16px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '1.1rem', fontWeight: '600' }}
              ><AlertOctagon /> Stampede</button>

              <button 
                onClick={(e) => {
                  e.preventDefault();
                  try {
                    handleReport('Medical Emergency');
                  } catch (err) {
                    console.error("Medical Emergency button error:", err);
                  }
                }} 
                style={{ background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid #3b82f6', padding: '16px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '1.1rem', fontWeight: '600' }}
              ><MedIcon /> Medical Emergency</button>

              <button 
                onClick={(e) => {
                  e.preventDefault();
                  try {
                    handleReport('Fire');
                  } catch (err) {
                    console.error("Fire button error:", err);
                  }
                }} 
                style={{ background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid #f97316', padding: '16px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '1.1rem', fontWeight: '600' }}
              ><Flame /> Fire</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
