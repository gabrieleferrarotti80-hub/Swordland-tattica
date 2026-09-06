import React from 'react';

export default function ResourceZonesEditor({
  globalResourceZones = [],
  setGlobalResourceZones,
  activeZoneId,
  setActiveZoneId
}) {
  const handleAddZone = () => {
    const newId = `zone-${Date.now()}`;
    // Inizializza la nuova zona con livello risorse di default
    const newZone = { id: newId, name: `Zona ${globalResourceZones.length + 1}`, resourceLevel: "1-5", points: [] };
    setGlobalResourceZones([...globalResourceZones, newZone]);
    setActiveZoneId(newId);
  };

  const handleDeleteZone = (id) => {
    setGlobalResourceZones(globalResourceZones.filter(z => z.id !== id));
    if (activeZoneId === id) setActiveZoneId(null);
  };

  const handleZoneNameChange = (id, newName) => {
    setGlobalResourceZones(globalResourceZones.map(z => 
      z.id === id ? { ...z, name: newName } : z
    ));
  };

  const handleZoneLevelChange = (id, newLevel) => {
    setGlobalResourceZones(globalResourceZones.map(z => 
      z.id === id ? { ...z, resourceLevel: newLevel } : z 
    ));
  };

  const handlePointChange = (zoneId, pointIndex, axis, value) => {
    const numValue = value === '' ? '' : Number(value);
    setGlobalResourceZones(globalResourceZones.map(z => {
      if (z.id !== zoneId) return z;
      const newPoints = [...z.points];
      newPoints[pointIndex] = { ...newPoints[pointIndex], [axis]: numValue };
      return { ...z, points: newPoints };
    }));
  };

  const handleRemovePoint = (zoneId, pointIndex) => {
    setGlobalResourceZones(globalResourceZones.map(z => {
      if (z.id !== zoneId) return z;
      const newPoints = z.points.filter((_, i) => i !== pointIndex);
      return { ...z, points: newPoints };
    }));
  };

  const handleAddPointManually = (zoneId) => {
    setGlobalResourceZones(globalResourceZones.map(z => {
      if (z.id !== zoneId) return z;
      return { ...z, points: [...(z.points || []), { x: 600, y: 600 }] };
    }));
  };

  return (
    <div className="flex flex-col gap-3 p-4 bg-slate-950 border border-rose-900/50 rounded-xl mt-2 animate-fade-in">
      <div className="flex justify-between items-center pb-2 border-b border-slate-800">
        <span className="text-xs font-black text-rose-400 uppercase tracking-widest">Zone Risorse</span>
        <button 
          onClick={handleAddZone} 
          className="px-2 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-[9px] font-bold uppercase rounded transition-colors"
        >
          + Nuova Zona
        </button>
      </div>
      
      {globalResourceZones.length === 0 ? (
        <div className="text-[10px] text-slate-500 text-center py-4 font-bold">
          Nessuna zona creata.<br/>Clicca "+ Nuova Zona" per iniziare.
        </div>
      ) : (
        <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
          {globalResourceZones.map(zone => {
            const isActive = activeZoneId === zone.id;
            return (
              <div 
                key={zone.id} 
                className={`flex flex-col gap-2 p-2.5 rounded-lg border transition-all ${isActive ? 'bg-rose-950/40 border-rose-500 shadow-[0_0_10px_rgba(225,29,72,0.2)]' : 'bg-slate-900 border-slate-700 hover:border-rose-500/50'}`}
                onClick={() => !isActive && setActiveZoneId(zone.id)}
              >
                <div className="flex items-center justify-between cursor-pointer">
                  <div className="flex flex-col gap-1 flex-1">
                    <input 
                      type="text"
                      value={zone.name}
                      onChange={(e) => handleZoneNameChange(zone.id, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className={`text-xs font-bold bg-transparent border-b outline-none ${isActive ? 'text-rose-300 border-rose-500/50' : 'text-slate-300 border-transparent'}`}
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-slate-500 font-bold tracking-wider uppercase">
                        {zone.points?.length || 0} Vertici
                      </span>
                      {zone.resourceLevel && (
                        <span className="text-[9px] text-amber-500 font-black tracking-wider">
                          | LV. {zone.resourceLevel}
                        </span>
                      )}
                    </div>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDeleteZone(zone.id); }} 
                    className="w-6 h-6 flex items-center justify-center rounded bg-slate-950 hover:bg-rose-900 text-slate-500 hover:text-rose-400 font-bold text-xs transition-colors ml-2 shrink-0"
                  >
                    ✕
                  </button>
                </div>

                {isActive && (
                  <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-rose-900/50 cursor-default" onClick={(e) => e.stopPropagation()}>
                    
                    {/* SELETTORE FASCIA RISORSE */}
                    <div className="flex items-center justify-between bg-slate-900 p-2 rounded border border-slate-800">
                      <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-1">
                        🌾 Livello Risorse
                      </span>
                      <select
                        value={zone.resourceLevel || "1-5"}
                        onChange={(e) => handleZoneLevelChange(zone.id, e.target.value)}
                        className="bg-slate-950 border border-slate-700 text-white text-[10px] font-bold px-2 py-1 rounded outline-none focus:border-amber-500 cursor-pointer"
                      >
                        <option value="1-5">Livelli 1 - 5 (Esterna)</option>
                        <option value="6-7">Livelli 6 - 7 (Intermedia)</option>
                        <option value="8">Livello 8 (Centro)</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5 mt-1">
                      {zone.points && zone.points.map((pt, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 bg-slate-900 p-1.5 rounded border border-slate-800">
                          <span className="text-[9px] text-slate-500 font-mono w-4">{idx + 1}.</span>
                          <div className="flex flex-1 items-center gap-1">
                            <span className="text-[9px] text-cyan-500 font-black">X</span>
                            <input 
                              type="number" 
                              value={pt.x} 
                              onChange={(e) => handlePointChange(zone.id, idx, 'x', e.target.value)}
                              className="w-full bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-[10px] text-white outline-none focus:border-rose-500 font-mono text-center"
                            />
                          </div>
                          <div className="flex flex-1 items-center gap-1">
                            <span className="text-[9px] text-amber-500 font-black">Y</span>
                            <input 
                              type="number" 
                              value={pt.y} 
                              onChange={(e) => handlePointChange(zone.id, idx, 'y', e.target.value)}
                              className="w-full bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-[10px] text-white outline-none focus:border-rose-500 font-mono text-center"
                            />
                          </div>
                          <button 
                            onClick={() => handleRemovePoint(zone.id, idx)}
                            className="text-rose-500 hover:text-rose-400 text-xs px-1"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>

                    <button 
                      onClick={() => handleAddPointManually(zone.id)}
                      className="mt-1 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-[9px] font-bold uppercase rounded transition-colors"
                    >
                      + Aggiungi Punto Manuale
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {activeZoneId && (
        <div className="text-[10px] text-emerald-400 font-bold text-center mt-2 bg-emerald-950/30 p-2 rounded border border-emerald-900/50">
          📍 Clicca sulla mappa o usa le coordinate per tracciare.
        </div>
      )}
    </div>
  );
}