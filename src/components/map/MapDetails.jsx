import React, { useState, useEffect } from 'react';

export default function MapDetails({ 
  selectedBuilding, 
  onClose, 
  enemyHQs = [], 
  onAddHQ, 
  onRemoveHQ,
  allianceMeta,
  setAllianceMeta,
  activeView,
  isOpen,         
  setIsOpen,
  currentTime, 
  marchAssignments,
  setMarchAssignments,
  handleConfirmDispatch,
  buildings,
  getAvailableMarches,
  activeDeployment,
  roster, 
  allianceStructures = [] 
}) {
  const [newHQ, setNewHQ] = useState({ name: '', x: '', y: '' });
  const [currentTargetId, setCurrentTargetId] = useState('');

  useEffect(() => {
    if (selectedBuilding && !selectedBuilding.isPlayer) {
      setCurrentTargetId(selectedBuilding.id);
    }
  }, [selectedBuilding]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newHQ.name || !newHQ.x || !newHQ.y) return;
    onAddHQ(newHQ);
    setNewHQ({ name: '', x: '', y: '' });
  };

  const isPlayerSelected = selectedBuilding?.isPlayer;

  const updateMarchAssignment = (marchIdx, field, value) => {
    if (!setMarchAssignments) return;
    setMarchAssignments(prev => {
      const current = prev[marchIdx] || { buildingId: currentTargetId, type: 'attacco', members: [] };
      return { ...prev, [marchIdx]: { ...current, [field]: value } };
    });
  };

  // --- FORMATTATORE TEMPO (DA DECIMALE A MINUTI E SECONDI) ---
  const formatTimeMinSec = (decimalMinutes) => {
    if (isNaN(decimalMinutes) || decimalMinutes < 0) return "0m 00s";
    const m = Math.floor(decimalMinutes);
    let s = Math.round((decimalMinutes - m) * 60);
    let finalM = m;
    if (s === 60) { finalM += 1; s = 0; }
    return `${finalM}m ${s < 10 ? '0' : ''}${s}s`;
  };

  // --- CALCOLO MATEMATICO DISTANZA TRA COORDINATE ---
  const calculateDistanceMinutes = (targetX, targetY, originX, originY, speedups = 0) => {
    if (targetX === undefined || targetY === undefined || originX === undefined || originY === undefined) return 0;
    const tX = Number(targetX);
    const tY = Number(targetY);
    const oX = Number(originX);
    const oY = Number(originY);
    if (isNaN(tX) || isNaN(tY) || isNaN(oX) || isNaN(oY)) return 0;

    const dx = tX - oX;
    const dy = tY - oY;
    const distanceInTiles = Math.sqrt(dx * dx + dy * dy);
    
    // 4 secondi per casella
    const travelTimeMins = (distanceInTiles * 4) / 60; 
    
    // Ogni acceleratore applica un +25% di velocità (riduce il tempo al 75%)
    return travelTimeMins * Math.pow(0.75, speedups);
  };

  const calculateTravelTime = (buildingId, originX, originY, isRally = false) => {
    if (!buildingId || originX === undefined || !buildings) return null;
    const targetBuilding = buildings.find(b => String(b.id) === String(buildingId));
    if (!targetBuilding) return null;

    const travelTimeMins = calculateDistanceMinutes(targetBuilding.x, targetBuilding.y, originX, originY, 0);
    const delay = isRally ? 5 : 0;
    const arrivalMin = currentTime + delay + travelTimeMins;

    return {
      duration: formatTimeMinSec(travelTimeMins),
      arrival: formatTimeMinSec(arrivalMin)
    };
  };

  // Coordinate dell'Alveare (Primo QG dell'alleanza)
  const hiveHQ = allianceStructures?.find(s => s.type === 'headquarters');
  const HIVE_X = hiveHQ ? Number(hiveHQ.x) : 0;
  const HIVE_Y = hiveHQ ? Number(hiveHQ.y) : 0;

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`absolute top-1/2 -translate-y-1/2 z-50 bg-slate-900 hover:bg-slate-800 text-cyan-400 py-4 px-2 rounded-l-xl border-y border-l border-slate-700 shadow-[-8px_0_15px_rgba(0,0,0,0.6)] transition-all duration-300 flex items-center justify-center font-black ${isOpen ? 'right-[320px]' : 'right-0'}`}
        title={isOpen ? "Nascondi Pannello" : "Mostra Pannello"}
      >
        {isOpen ? '▶' : '◀'}
      </button>

      <aside className={`bg-slate-900 border-slate-800 flex flex-col z-40 shadow-2xl shrink-0 transition-all duration-300 overflow-hidden ${isOpen ? 'w-[320px] border-l' : 'w-0 border-l-0'}`}>
        
        <div className="w-[320px] h-screen flex flex-col overflow-y-auto custom-scrollbar">
          
          <div className="flex flex-col border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm shrink-0">
            <div className="p-4 bg-slate-950 flex justify-between items-center sticky top-0 z-10 border-b border-slate-800/80 shadow-md">
              <h2 className="text-sm font-black text-cyan-400 uppercase tracking-wider">
                {isPlayerSelected ? 'Comandante' : 'Info Edificio'}
              </h2>
              {selectedBuilding && (
                <button onClick={() => setIsOpen(false)} className="text-slate-500 hover:text-rose-400 text-lg font-bold transition-colors w-6 h-6 flex items-center justify-center rounded bg-slate-900 border border-slate-700">✕</button>
              )}
            </div>
            
            <div className="p-5">
              {selectedBuilding ? (
                <div className="flex flex-col gap-4 animate-fade-in">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      {isPlayerSelected ? 'Nome Giocatore' : 'Nome Identificativo'}
                    </span>
                    <h3 className="text-xl font-black text-white leading-tight mt-1">
                      {selectedBuilding.code && <span className="text-cyan-400 mr-2">[{selectedBuilding.code}]</span>}
                      {selectedBuilding.name}
                    </h3>
                  </div>
                  <div className="flex gap-3">
                    <div className="bg-slate-950 px-3 py-2 rounded-lg border border-slate-800 flex-1 shadow-inner">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">Coord X</span>
                      <span className="text-base font-mono font-bold text-cyan-400">{selectedBuilding.x}</span>
                    </div>
                    <div className="bg-slate-950 px-3 py-2 rounded-lg border border-slate-800 flex-1 shadow-inner">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">Coord Y</span>
                      <span className="text-base font-mono font-bold text-amber-400">{selectedBuilding.y}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center gap-3 mt-4 mb-4 opacity-50">
                  <span className="text-4xl">🖱️</span>
                  <span className="text-xs text-slate-400 font-medium leading-relaxed px-4">
                    Clicca su un edificio, un alleato o un QG nemico per esaminare le coordinate.
                  </span>
                </div>
              )}
            </div>
          </div>

          {activeView === 'tactical' && isPlayerSelected && (
            <div className="flex flex-col bg-slate-950 flex-1 animate-fade-in">
              <div className="p-4 border-b border-slate-800 bg-cyan-950/10">
                <h2 className="text-sm font-black text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                  <span>⚔️</span> Ordini Tattici
                </h2>
                <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                  <span className="text-amber-400 font-bold">Attenzione:</span> gli ordini creati verranno assegnati al Minuto <b>{currentTime}</b>.
                </p>
              </div>

              <div className="p-4 flex flex-col gap-3 flex-1 overflow-y-auto">
                {Array.from({ length: getAvailableMarches ? getAvailableMarches(selectedBuilding.id) : 0 }).map((_, i) => {
                  const marchIdx = i + 1;
                  const currentAssign = marchAssignments[marchIdx] || { buildingId: currentTargetId, type: 'attacco', members: [] };
                  const assignedMembers = currentAssign.members || [];
                  
                  const sourceList = (roster && roster.length > 0) ? roster : activeDeployment;
                  const availablePlayers = sourceList?.filter(p => 
                    String(p.id) !== String(selectedBuilding.id) && 
                    p.isParticipating !== false && 
                    getAvailableMarches(p.id) > 0
                  ) || [];

                  return (
                    <div key={`march-${marchIdx}`} className="bg-slate-900 border border-slate-700/50 rounded-xl p-3 flex flex-col gap-2 shadow-inner">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-cyan-300 text-[10px] font-black uppercase">Marcia {marchIdx}</span>
                        {assignedMembers.length > 0 && <span className="text-[10px] font-bold text-slate-400">{assignedMembers.length + 1}/10 Membri</span>}
                      </div>
                      
                      <select 
                        className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-xs font-bold text-slate-200 outline-none focus:border-cyan-500"
                        value={currentAssign.buildingId} 
                        onChange={(e) => updateMarchAssignment(marchIdx, 'buildingId', e.target.value)}
                      >
                        <option value="">-- Seleziona Bersaglio --</option>
                        {buildings?.map(b => (<option key={b.id} value={b.id}>[{b.code}] {b.name}</option>))}
                      </select>

                      {currentAssign.buildingId && (() => {
                        const isRally = currentAssign.type === 'rally';
                        const timing = calculateTravelTime(currentAssign.buildingId, selectedBuilding.x, selectedBuilding.y, isRally);
                        return timing && (
                          <div className="text-[10px] font-black flex flex-col gap-0.5 bg-slate-950 p-2 rounded border border-slate-800">
                            <span className="text-slate-400">Durata Viaggio: <span className="text-white">{timing.duration}</span></span>
                            <span className="text-amber-400">Impatto a Minuto: <span className="text-white">{timing.arrival}</span></span>
                          </div>
                        );
                      })()}
                      
                      <select 
                        className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-xs font-bold text-slate-200 outline-none focus:border-cyan-500"
                        value={currentAssign.type} 
                        onChange={(e) => updateMarchAssignment(marchIdx, 'type', e.target.value)}
                      >
                        <option value="attacco">⚔️ Attacco Singolo</option>
                        <option value="difesa">🛡️ Guarnigione / Difesa</option>
                        <option value="supporto">🤝 Supporto (Rinforzo)</option>
                        <option value="rally">🔥 Lancia Rally (5 min prep.)</option>
                      </select>

                      {assignedMembers.length > 0 && (
                        <div className="flex flex-col gap-1 mt-2 bg-slate-950 p-2 rounded border border-slate-800">
                          <div className="text-[9px] text-slate-500 uppercase font-black border-b border-slate-800 pb-1 mb-1">Membri Aggregati</div>
                          {assignedMembers.map((memObj) => {
                              const isObj = typeof memObj === 'object';
                              const memId = isObj ? memObj.id : memObj;
                              const memSpeedups = isObj ? (memObj.speedups || 0) : 0;
                              
                              const mem = roster?.find(p => String(p.id) === String(memId));
                              const isDeployed = mem?.numX !== undefined && mem?.numX !== '' && mem?.numX !== null;
                              
                              // Origine del membro (Sua posizione o Alveare)
                              const memX = isDeployed ? Number(mem.numX) : HIVE_X;
                              const memY = isDeployed ? Number(mem.numY) : HIVE_Y;
                              
                              // Bersaglio del membro:
                              // Se è un Rally, il bersaglio è il Capo Rally (selectedBuilding.x, selectedBuilding.y)
                              // Se è un attacco diretto, è la Struttura Nemica (currentAssign.buildingId)
                              let targetX, targetY;
                              if (currentAssign.type === 'rally') {
                                targetX = selectedBuilding.x;
                                targetY = selectedBuilding.y;
                              } else {
                                const targetB = buildings?.find(b => String(b.id) === String(currentAssign.buildingId));
                                targetX = targetB?.x;
                                targetY = targetB?.y;
                              }

                              const timeCalc = calculateDistanceMinutes(targetX, targetY, memX, memY, memSpeedups);
                              const isTooSlow = currentAssign.type === 'rally' && timeCalc > 5.0;

                              return (
                                <div key={memId} className={`text-[10px] bg-slate-900 border ${isTooSlow ? 'border-red-500/50' : 'border-slate-700'} text-slate-300 px-2 py-1.5 rounded flex flex-col gap-1`}>
                                  <div className="flex justify-between items-center">
                                    <span className="font-bold">
                                      {mem?.name || mem?.tag} 
                                      {!isDeployed && <span className="text-indigo-400 ml-1 font-normal opacity-80">(Alveare)</span>}
                                      {memSpeedups > 0 && <span className="text-amber-400 ml-1">⚡x{memSpeedups}</span>}
                                    </span>
                                    <button onClick={() => updateMarchAssignment(marchIdx, 'members', assignedMembers.filter(m => String(typeof m === 'object' ? m.id : m) !== String(memId)))} className="text-red-400 hover:text-red-300">✕</button>
                                  </div>
                                  
                                  {currentAssign.type === 'rally' && (
                                    <div className="flex justify-between border-t border-slate-800 pt-1 mt-1 text-[9px] items-center">
                                      <span className={isTooSlow ? 'text-red-400 font-bold' : 'text-slate-400'}>
                                        Viaggio: {formatTimeMinSec(timeCalc)}
                                      </span>
                                      
                                      <div className="flex gap-2 items-center">
                                        {isTooSlow ? (
                                          <span className="text-red-400 flex items-center gap-1 font-bold">⚠️ In ritardo</span>
                                        ) : (
                                          <span className="text-emerald-400 font-bold">✓ In tempo</span>
                                        )}
                                        <button 
                                          onClick={() => updateMarchAssignment(marchIdx, 'members', assignedMembers.map(m => String(typeof m === 'object' ? m.id : m) === String(memId) ? { id: memId, speedups: memSpeedups + 1 } : m))} 
                                          className={`px-1.5 py-0.5 rounded transition-colors ${isTooSlow ? 'bg-amber-600/40 text-amber-300 hover:bg-amber-600/60 border border-amber-500/50 font-bold' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'}`}
                                        >
                                          + Speedup
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )
                          })}
                        </div>
                      )}

                      {availablePlayers.length > 0 && assignedMembers.length < 9 && currentAssign.buildingId !== '' && (
                        <select
                          className="w-full bg-slate-950 border border-indigo-900/50 rounded p-1 text-[10px] font-bold text-indigo-400 mt-2 outline-none"
                          value=""
                          onChange={(e) => e.target.value && updateMarchAssignment(marchIdx, 'members', [...assignedMembers, { id: e.target.value, speedups: 0 }])}
                        >
                          <option value="" disabled>+ Aggiungi Membro...</option>
                          {availablePlayers.filter(p => !assignedMembers.some(m => String(typeof m === 'object' ? m.id : m) === String(p.id))).map(p => (
                              <option key={p.id} value={p.id}>[{p.tag}] {p.name}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  )
                })}
                
                {getAvailableMarches && getAvailableMarches(selectedBuilding.id) === 0 && (
                  <div className="text-center text-rose-400 font-bold text-xs py-3 bg-rose-950/20 border border-rose-900/50 rounded-lg">
                    ⚠️ Nessuna marcia disponibile per questo giocatore.
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-slate-800 bg-slate-900 shrink-0">
                <button 
                  className="w-full bg-cyan-700 hover:bg-cyan-600 text-white text-xs font-black py-3 rounded-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  onClick={() => handleConfirmDispatch(selectedBuilding.id)}
                  disabled={!marchAssignments || Object.values(marchAssignments).filter(v => v.buildingId !== '').length === 0}
                >
                  ✔ REGISTRA ORDINI
                </button>
              </div>
            </div>
          )}

          {activeView !== 'tactical' && (
            <div className="flex flex-col bg-slate-950 shrink-0 animate-fade-in">
              <div className="p-4 border-b border-slate-800 bg-rose-950/10">
                <h2 className="text-sm font-black text-rose-400 uppercase tracking-wider flex items-center gap-2">
                  <span>🎯</span> QG Avversari
                </h2>
                <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                  Gestisci le roccaforti nemiche. Compila Regno e Sigla per salvare in Cloud.
                </p>
              </div>
              <div className="p-3 border-b border-slate-800 bg-indigo-950/20">
                <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1.5">Identità Alleanza</h3>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Regno (es. 1007)" 
                    value={allianceMeta.kingdom} 
                    onChange={e => setAllianceMeta({...allianceMeta, kingdom: e.target.value})} 
                    className="bg-slate-900 border border-slate-700 text-white text-[11px] px-2 py-1.5 rounded focus:outline-none focus:border-indigo-500 w-full transition-colors" 
                  />
                  <input 
                    type="text" 
                    placeholder="Sigla (es. DTD)" 
                    value={allianceMeta.tag} 
                    onChange={e => setAllianceMeta({...allianceMeta, tag: e.target.value.toUpperCase()})} 
                    className="bg-slate-900 border border-slate-700 text-white text-[11px] px-2 py-1.5 rounded focus:outline-none focus:border-indigo-500 w-full transition-colors uppercase" 
                  />
                </div>
              </div>
              <form onSubmit={handleSubmit} className="p-4 border-b border-slate-800/50 flex flex-col gap-2 bg-slate-900/50">
                <input type="text" placeholder="Nome Alleanza Nemica" value={newHQ.name} onChange={e => setNewHQ({...newHQ, name: e.target.value})} className="bg-slate-950 border border-slate-700 text-white text-xs px-3 py-2.5 rounded focus:outline-none focus:border-rose-500 font-bold transition-colors" required />
                <div className="flex gap-2">
                  <input type="number" placeholder="X" value={newHQ.x} onChange={e => setNewHQ({...newHQ, x: e.target.value})} className="bg-slate-950 border border-slate-700 text-white text-xs px-3 py-2.5 rounded focus:outline-none focus:border-rose-500 w-full font-mono text-center transition-colors" required />
                  <input type="number" placeholder="Y" value={newHQ.y} onChange={e => setNewHQ({...newHQ, y: e.target.value})} className="bg-slate-950 border border-slate-700 text-white text-xs px-3 py-2.5 rounded focus:outline-none focus:border-rose-500 w-full font-mono text-center transition-colors" required />
                </div>
                <button type="submit" className="bg-rose-700 hover:bg-rose-600 text-white text-xs font-black uppercase tracking-wider py-2.5 rounded shadow-lg transition-colors mt-2">Aggiungi QG</button>
              </form>
              <div className="p-4 flex flex-col gap-2 mb-4">
                {enemyHQs.length === 0 ? (
                  <div className="text-[10px] text-slate-600 text-center italic mt-2">Nessun QG avversario tracciato.</div>
                ) : (
                  enemyHQs.map(hq => (
                    <div key={hq.id} className="bg-slate-900 border border-rose-900/30 rounded-lg p-2.5 flex justify-between items-center group shadow-sm hover:border-rose-700/50 transition-colors">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-rose-300 truncate w-40">{hq.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono mt-0.5">X:{hq.x} <span className="mx-1">|</span> Y:{hq.y}</span>
                      </div>
                      <button onClick={() => onRemoveHQ(hq.id)} className="w-6 h-6 flex items-center justify-center rounded bg-slate-950 text-slate-600 hover:text-white hover:bg-rose-600 font-bold transition-colors">✕</button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}