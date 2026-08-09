import React from 'react';

export default function TacticalDispatchModal({
  activePlayer,
  activeDeployment,
  marchAssignments,
  setMarchAssignments,
  setPopupPlayerId,
  handleConfirmDispatch,
  modalPos,
  isDraggingModal,
  handlePointerDownModal,
  buildings,
  getAvailableMarches,
  TILE_SF // Ci serve per calcolare le distanze reali in caselle!
}) {
  
  if (!activePlayer) return null;

  // X e Y visivi (in caselle) del giocatore selezionato
  const currentX = activePlayer.numX !== undefined ? activePlayer.numX : 0;
  const currentY = activePlayer.numY !== undefined ? activePlayer.numY : 0;

  const updateMarchAssignment = (marchIdx, field, value) => {
    setMarchAssignments(prev => {
      const current = prev[marchIdx] || { buildingId: '', type: 'attacco', members: [] };
      return { ...prev, [marchIdx]: { ...current, [field]: value } };
    });
  };

  // Calcolo tempo di marcia (Versione Mappa Globale)
  // Formula Base: 1 casella = circa 4 secondi di marcia.
  const calculateTravelTime = (buildingId, originX, originY) => {
    if (!buildingId || originX === undefined) return null;
    const targetBuilding = buildings.find(b => String(b.id) === String(buildingId));
    if (!targetBuilding) return null;

    // Distanza geometrica (Teorema di Pitagora sulle coordinate X/Y)
    const dx = targetBuilding.x - originX;
    const dy = targetBuilding.y - originY;
    const distanceInTiles = Math.sqrt(dx * dx + dy * dy);
    
    // Assumiamo una velocità fissa per la mappa globale: 4 secondi per casella
    const SECONDS_PER_TILE = 4; 
    const travelTimeSecs = distanceInTiles * SECONDS_PER_TILE;
    
    const travelTimeMins = travelTimeSecs / 60;
    
    const m = Math.floor(travelTimeMins);
    const s = Math.round((travelTimeMins - m) * 60);
    return `${m}m ${s < 10 ? '0' : ''}${s}s`;
  };

  const getTravelTimeMinutes = (buildingId, originX, originY, speedups = 0) => {
    if (!buildingId || originX === undefined) return 0;
    const targetBuilding = buildings.find(b => String(b.id) === String(buildingId));
    if (!targetBuilding) return 0;
    
    const dx = targetBuilding.x - originX;
    const dy = targetBuilding.y - originY;
    const distanceInTiles = Math.sqrt(dx * dx + dy * dy);
    const travelTimeMins = (distanceInTiles * 4) / 60;
    
    return travelTimeMins * Math.pow(0.75, speedups);
  };

  const availablePlayers = activeDeployment.filter(p => 
    String(p.id) !== String(activePlayer.id) && 
    getAvailableMarches(p.id) > 0
  );

  return (
    <div 
      className={`absolute backdrop-blur-md border rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] z-[200] flex flex-col overflow-hidden w-[220px] select-none transition-colors duration-300 bg-slate-800/95 border-cyan-600/50`}
      style={{ left: `${modalPos.x}px`, top: `${modalPos.y}px` }}
      onClick={(e) => e.stopPropagation()} 
    >
      <div 
        className={`flex justify-between items-center p-2 border-b shrink-0 ${isDraggingModal ? 'cursor-grabbing' : 'cursor-grab'} border-slate-700 bg-slate-900/80 hover:bg-slate-900 transition-colors`}
        onPointerDown={handlePointerDownModal}
      >
        <div className="font-bold text-[10px] uppercase flex items-center gap-1.5 pointer-events-none text-cyan-400">
          <span>📋</span> 
          Ordini: {activePlayer.name || activePlayer.tag || 'Comandante'}
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); setPopupPlayerId(null); setMarchAssignments({}); }}
          onPointerDown={(e) => e.stopPropagation()}
          className="text-slate-400 hover:text-red-400 transition-colors w-5 h-5 flex items-center justify-center rounded-full hover:bg-slate-700 z-10 text-[10px] font-black"
        >
          ✕
        </button>
      </div>

      <div className="px-3 py-1.5 bg-slate-900/80 border-b border-slate-700 flex justify-between items-center text-[10px]">
        <span className="text-slate-400">Coordinate:</span>
        <span className="text-white font-mono font-bold">X: {currentX} | Y: {currentY}</span>
      </div>

      <div className="max-h-[55vh] overflow-y-auto p-2 flex flex-col gap-2 scrollbar-thin">
        {Array.from({ length: getAvailableMarches(activePlayer.id) }).map((_, i) => {
          const marchIdx = i + 1;
          const currentAssign = marchAssignments[marchIdx] || { buildingId: '', type: 'attacco', members: [] };
          const assignedMembers = currentAssign.members || [];

          return (
            <div key={`march-assign-${marchIdx}`} className="flex flex-col gap-1.5 bg-slate-700/30 p-2 rounded-lg border border-slate-600/50">
              <div className="flex justify-between items-center">
                <span className="text-cyan-300 text-[9px] font-black tracking-wider uppercase">Marcia {marchIdx}</span>
                {assignedMembers.length > 0 && <span className="text-[9px] font-bold text-slate-400">{assignedMembers.length + 1}/10 Membri</span>}
              </div>
              
              <div className="flex flex-col gap-1.5">
                <select 
                  className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-[10px] font-bold text-slate-200 outline-none focus:border-cyan-500 cursor-pointer"
                  value={currentAssign.buildingId} 
                  onChange={(e) => updateMarchAssignment(marchIdx, 'buildingId', e.target.value)}
                >
                  <option value="">Seleziona Bersaglio...</option>
                  {buildings.map(b => (<option key={b.id} value={b.id}>[{b.code}] {b.name}</option>))}
                </select>

                {currentAssign.buildingId && (
                  <div className="text-amber-400 text-[10px] font-black flex items-center gap-1 bg-slate-900/80 p-1.5 rounded border border-amber-900/50">
                    ⏱️ Arrivo: {calculateTravelTime(currentAssign.buildingId, currentX, currentY)}
                  </div>
                )}
                
                <select 
                  className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-[10px] font-bold text-slate-200 outline-none focus:border-cyan-500 cursor-pointer"
                  value={currentAssign.type} 
                  onChange={(e) => updateMarchAssignment(marchIdx, 'type', e.target.value)}
                >
                  <option value="attacco">⚔️ Attacco Singolo</option>
                  <option value="difesa">🛡️ Guarnigione / Difesa</option>
                  <option value="supporto">🤝 Supporto (Rinforzo)</option>
                  <option value="rally">🔥 Lancia Rally (5 min prep.)</option>
                </select>
                
                {assignedMembers.length > 0 && (
                  <div className="flex flex-col gap-1 mt-1 bg-slate-900/50 p-1.5 rounded border border-slate-700">
                    <div className="text-[9px] text-slate-400 uppercase tracking-widest font-black border-b border-slate-700 pb-1 mb-1">
                      Membri {currentAssign.type === 'rally' ? 'del Rally' : 'di Gruppo'}
                    </div>
                    
                    {assignedMembers.map((memObj) => {
                        const isObj = typeof memObj === 'object';
                        const memId = isObj ? memObj.id : memObj;
                        const memSpeedups = isObj ? (memObj.speedups || 0) : 0;
                        const mem = activeDeployment.find(p => String(p.id) === String(memId));
                        
                        const memX = mem?.numX !== undefined ? mem.numX : 0;
                        const memY = mem?.numY !== undefined ? mem.numY : 0;
                        
                        // Per il rally calcoliamo il tempo verso il LEADER, per gli altri verso il bersaglio
                        const targetX = currentAssign.type === 'rally' ? currentX : currentAssign.buildingId; 
                        const timeCalc = currentAssign.type === 'rally' 
                          ? getTravelTimeMinutes({id: 'temp', x: currentX, y: currentY}, memX, memY, memSpeedups)
                          : getTravelTimeMinutes(currentAssign.buildingId, memX, memY, memSpeedups);

                        // Rally a 5 minuti (non 4) per le regole standard
                        const isTooSlow = currentAssign.type === 'rally' && timeCalc > 5.0;

                        return (
                          <div key={memId} className={`text-[10px] bg-slate-800 border ${isTooSlow ? 'border-red-500/80' : 'border-slate-600'} text-slate-300 px-1.5 py-1 rounded flex flex-col gap-1`}>
                            <div className="flex items-center justify-between">
                              <span className="font-bold flex items-center gap-1">
                                {mem?.name || mem?.tag || `Player ${memId}`}
                                {memSpeedups > 0 && <span className="text-amber-400 text-[8px] bg-amber-900/40 px-1 rounded">⚡x{memSpeedups}</span>}
                              </span>
                              <button onClick={(e) => { e.stopPropagation(); updateMarchAssignment(marchIdx, 'members', assignedMembers.filter(m => String(typeof m === 'object' ? m.id : m) !== String(memId))); }} className="text-red-400 hover:text-red-300 font-black">✕</button>
                            </div>

                            {currentAssign.type === 'rally' && (
                              <div className="flex items-center justify-between border-t border-slate-700/50 pt-1 mt-0.5">
                                <span className={`${isTooSlow ? 'text-red-400 font-bold' : 'text-slate-400'}`}>
                                  Tempo: {timeCalc.toFixed(1)}m
                                </span>
                                {isTooSlow ? (
                                  <button onClick={(e) => {
                                      e.stopPropagation();
                                      updateMarchAssignment(marchIdx, 'members', assignedMembers.map(m => {
                                        if (String(typeof m === 'object' ? m.id : m) === String(memId)) return { id: memId, speedups: memSpeedups + 1 };
                                        return m;
                                      }));
                                    }} className="bg-amber-600 hover:bg-amber-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded transition-colors">+ Speedup</button>
                                ) : (
                                  <span className="text-emerald-400 text-[9px] font-bold">✓ Ok</span>
                                )}
                              </div>
                            )}
                          </div>
                        )
                    })}
                  </div>
                )}

                {availablePlayers.length > 0 && assignedMembers.length < 9 && currentAssign.buildingId !== '' && (
                  <select
                    className="w-full bg-slate-800 border border-indigo-700/50 rounded p-1 text-[9px] font-bold text-indigo-300 outline-none focus:border-indigo-400 cursor-pointer mt-1"
                    value=""
                    onChange={(e) => {
                      const targetId = e.target.value;
                      if (!targetId) return; 
                      updateMarchAssignment(marchIdx, 'members', [...assignedMembers, { id: targetId, speedups: 0 }]);
                    }}
                  >
                    <option value="" disabled>+ Unisci Giocatore...</option>
                    {availablePlayers.filter(p => !assignedMembers.some(m => String(typeof m === 'object' ? m.id : m) === String(p.id))).map(p => (
                        <option key={p.id} value={p.id}>[{p.tag}] {p.name}</option>
                    ))}
                  </select>
                )}

              </div>
            </div>
          )
        })}

        {getAvailableMarches(activePlayer.id) === 0 && (
          <div className="text-center text-rose-400 font-bold text-[10px] py-3 bg-rose-950/20 border border-rose-900/50 rounded-lg">
            ⚠️ Nessuna marcia disponibile per questo giocatore.
          </div>
        )}
      </div>

      <div className="p-2 border-t border-slate-700 bg-slate-900/80 flex gap-2 shrink-0">
        <button 
          className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-[10px] font-bold py-1.5 rounded transition-colors cursor-pointer border border-slate-600" 
          onClick={() => { setPopupPlayerId(null); setMarchAssignments({}); }}
        >
          Annulla
        </button>
        <button 
          className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] font-black py-1.5 rounded transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-md" 
          onClick={() => handleConfirmDispatch(activePlayer.id)} 
          disabled={Object.values(marchAssignments).filter(v => v.buildingId !== '').length === 0}
        >
          ✔ Conferma
        </button>
      </div>
    </div>
  );
}