import React, { useState } from 'react';

export default function CastleTestView() {
  // Base tile ridotta a 40px per far entrare l'enorme HQ nello schermo
  const TILE_PX = 40; 
  const [mode, setMode] = useState('trap'); // 'trap' o 'hq'

  // Memorie separate per non perdere il lavoro passando da uno all'altro
  const [trapSettings, setTrapSettings] = useState({ w: 320, h: 220, x: 0, y: -40 });
  const [hqSettings, setHqSettings] = useState({ w: 480, h: 350, x: 0, y: -60 });

  const isTrap = mode === 'trap';
  const radiusTiles = isTrap ? 4 : 6;
  const radiusPx = radiusTiles * TILE_PX;
  
  const current = isTrap ? trapSettings : hqSettings;
  const setCurrent = isTrap ? setTrapSettings : setHqSettings;

  const centerX = 400;
  const centerY = 400;

  const ptBottom = `${centerX},${centerY + radiusPx}`;
  const ptRight = `${centerX + radiusPx},${centerY}`;
  const ptTop = `${centerX},${centerY - radiusPx}`;
  const ptLeft = `${centerX - radiusPx},${centerY}`;

  return (
    <div style={{ position: 'relative', width: '800px', height: '800px', backgroundColor: '#0f172a', margin: '20px auto', border: '1px solid #334155' }}>
      
      {/* Selettore Modalità */}
      <div style={{ position: 'absolute', top: '15px', left: '15px', zIndex: 20, display: 'flex', gap: '10px' }}>
        <button 
          onClick={() => setMode('trap')} 
          style={{ padding: '8px 16px', background: isTrap ? '#0ea5e9' : '#334155', color: 'white', borderRadius: '8px', fontWeight: 'bold' }}
        >
          Trappola Orsi (Footprint 4x4)
        </button>
        <button 
          onClick={() => setMode('hq')} 
          style={{ padding: '8px 16px', background: !isTrap ? '#0ea5e9' : '#334155', color: 'white', borderRadius: '8px', fontWeight: 'bold' }}
        >
          Quartier Generale (Footprint 6x6)
        </button>
      </div>

      {/* Griglia Vettoriale */}
      <svg width="800" height="800" style={{ position: 'absolute', top: 0, left: 0 }}>
        <polygon points={`${ptBottom} ${ptRight} ${ptTop} ${ptLeft}`} fill="rgba(34, 211, 238, 0.15)" stroke="#22d3ee" strokeWidth="2" />
        <line x1={centerX - 15} y1={centerY} x2={centerX + 15} y2={centerY} stroke="#ef4444" strokeWidth="2" />
        <line x1={centerX} y1={centerY - 15} x2={centerX} y2={centerY + 15} stroke="#ef4444" strokeWidth="2" />
      </svg>

      {/* Immagine da Calibrare */}
      <div style={{
        position: 'absolute', left: `${centerX}px`, top: `${centerY}px`,
        width: `${current.w}px`, height: `${current.h}px`,
        transform: `translate(calc(-50% + ${current.x}px), calc(-50% + ${current.y}px))`,
        border: '1px dashed #facc15', pointerEvents: 'none'
      }}>
        <img 
          src={isTrap ? "/assets/beartrap.png" : "/assets/hq.png"} 
          alt="Test" 
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} 
          draggable="false" 
        />
      </div>

      {/* Controlli */}
      <div style={{ position: 'absolute', bottom: '15px', left: '15px', color: '#f8fafc', background: 'rgba(15, 23, 42, 0.95)', padding: '12px', borderRadius: '8px', fontSize: '12px', border: '1px solid #0ea5e9', zIndex: 10 }}>
        <div style={{ fontWeight: 'bold', marginBottom: '6px', color: '#22d3ee' }}>
          Parametri {isTrap ? 'Trappola' : 'HQ'} (Tile Base: {TILE_PX}px)
        </div>
        <div>Larghezza: {current.w}px</div>
        <div>Altezza: {current.h}px</div>
        <div>Offset X: {current.x}px | Offset Y: {current.y}px</div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', marginTop: '8px' }}>
          <button onClick={() => setCurrent(p => ({...p, w: p.w - 1}))}>W-</button>
          <button onClick={() => setCurrent(p => ({...p, w: p.w + 1}))}>W+</button>
          <button onClick={() => setCurrent(p => ({...p, h: p.h - 1}))}>H-</button>
          <button onClick={() => setCurrent(p => ({...p, h: p.h + 1}))}>H+</button>
          
          <button onClick={() => setCurrent(p => ({...p, x: p.x - 1}))}>X-</button>
          <button onClick={() => setCurrent(p => ({...p, x: p.x + 1}))}>X+</button>
          <button onClick={() => setCurrent(p => ({...p, y: p.y - 1}))}>Y-</button>
          <button onClick={() => setCurrent(p => ({...p, y: p.y + 1}))}>Y+</button>
        </div>
        
        {/* Controlli Veloci (+/- 10) */}
        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #334155', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
          <button onClick={() => setCurrent(p => ({...p, w: p.w - 10}))}>W -10</button>
          <button onClick={() => setCurrent(p => ({...p, w: p.w + 10}))}>W +10</button>
          <button onClick={() => setCurrent(p => ({...p, h: p.h - 10}))}>H -10</button>
          <button onClick={() => setCurrent(p => ({...p, h: p.h + 10}))}>H +10</button>
        </div>
      </div>
    </div>
  );
}