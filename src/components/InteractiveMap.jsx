import React, { useState, useRef } from 'react';

const CastleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 20v-6h-2v6h-4v-4H8v4H4v-6H2v6h20z"/><path d="M22 14V6l-3-2-3 2v8M2 14V6l3-2 3 2v8"/><path d="M10 14V6l2-2 2 2v8"/></svg>
);

const getBasePosition = (idStr, teamBase) => {
  let hash = 0;
  for (let i = 0; i < idStr.length; i++) { hash = idStr.charCodeAt(i) + ((hash << 5) - hash); }
  const prng1 = Math.abs((Math.sin(hash) * 10000) % 1);
  const prng2 = Math.abs((Math.cos(hash) * 10000) % 1);
  const y = 30 + (prng1 * 40);
  let x = teamBase === 'blue' ? 3 + (prng2 * 13) : 84 + (prng2 * 13);
  return { x, y };
};

// Funzione di supporto infallibile per calcolare se l'entità è sopra un edificio
const checkIsAtBuilding = (x, y, buildingsArray) => {
  if (x == null || y == null) return null;
  const bMatch = buildingsArray.find(b => 
    b.x != null && b.y != null && 
    Math.sqrt(Math.pow(Number(x) - Number(b.x), 2) + Math.pow(Number(y) - Number(b.y), 2)) < 5
  );
  return bMatch ? bMatch.id : null;
};

// HELPER PRINCIPALE: Determina con precisione chirurgica lo stato dell'entità
const getEntityDisplayState = (entity, currentTime, draftPositions, healingEvents, teamBase, buildings) => {
  const isPlayer = entity.type === 'player';
  const healStart = isPlayer ? healingEvents[entity.id] : undefined;
  const isHealing = healStart !== undefined && currentTime >= healStart && currentTime < healStart + 12;

  if (isHealing) {
    const base = getBasePosition(entity.id, teamBase);
    return { isVisible: true, x: base.x, y: base.y, isHealing: true, isGarrisoned: false, marchType: 'attacco' };
  }

  const draftPos = draftPositions[entity.id];
  let posToUse = null;

  const isDraftForNewMarch = draftPos && draftPos.isNewMarch;

  if (draftPos && !(isPlayer && isDraftForNewMarch)) {
    if (draftPos.startTime !== undefined && draftPos.arrivalTime !== undefined) {
       if (draftPos.startTime <= currentTime && currentTime <= draftPos.arrivalTime) {
         posToUse = draftPos;
       } else if (currentTime > draftPos.arrivalTime) {
         posToUse = { ...draftPos, x: draftPos.targetX, y: draftPos.targetY };
       } else {
         posToUse = draftPos;
       }
    } else {
       posToUse = draftPos;
    }
  } else {
    if (entity.positions) {
      const minutes = Object.keys(entity.positions).map(Number).sort((a, b) => a - b);
      let activeStartMin = null;
      for (const min of minutes) {
        if (min <= currentTime) activeStartMin = min;
        else break;
      }
      if (activeStartMin !== null) posToUse = entity.positions[activeStartMin];
    }
  }

  if (!posToUse && isPlayer) {
    const base = getBasePosition(entity.id, teamBase);
    return { isVisible: true, x: base.x, y: base.y, isHealing: false, isGarrisoned: false, marchType: 'attacco' };
  }

  if (!posToUse || posToUse.removed) return { isVisible: false };

  const derivedMarchType = posToUse.marchType || entity.marchType || 'attacco';
  let targetBuildingId = posToUse.targetBuildingId;
  const startNum = posToUse.startTime !== undefined ? Number(posToUse.startTime) : null;
  const arrNum = posToUse.arrivalTime !== undefined ? Number(posToUse.arrivalTime) : null;
  const currentNum = Number(currentTime);

  const isActuallyMarching = startNum !== null && arrNum !== null;

  // 1. GESTIONE DELLA MARCIA IN CORSO
  if (isActuallyMarching) {
    if (currentNum >= arrNum) {
      // ARRIVATA: É UFFICIALMENTE DENTRO L'EDIFICIO
      return { 
        isVisible: true, 
        x: Number(posToUse.targetX), 
        y: Number(posToUse.targetY), 
        isHealing: false, 
        isMarching: false,
        isGarrisoned: !!targetBuildingId, 
        targetBuildingId, 
        marchType: derivedMarchType 
      };
    } else if (currentNum <= startNum) {
      // IN ATTESA DI PARTIRE
      return {
        isVisible: true,
        x: Number(posToUse.startX),
        y: Number(posToUse.startY),
        isHealing: false,
        isMarching: true,
        startX: Number(posToUse.startX),
        startY: Number(posToUse.startY),
        targetX: Number(posToUse.targetX),
        targetY: Number(posToUse.targetY),
        isGarrisoned: false,
        targetBuildingId,
        marchType: derivedMarchType
      };
    } else {
      // IN TRANSITO (Animazione)
      const totalTime = arrNum - startNum;
      const progress = (currentNum - startNum) / totalTime;
      const startX = Number(posToUse.startX);
      const startY = Number(posToUse.startY);
      const targetX = Number(posToUse.targetX);
      const targetY = Number(posToUse.targetY);
      
      const x = startX + (targetX - startX) * progress;
      const y = startY + (targetY - startY) * progress;
      return { 
        isVisible: true, 
        x, y, 
        isHealing: false,
        isMarching: true, 
        startX, startY, targetX, targetY,
        isGarrisoned: false,
        targetBuildingId,
        marchType: derivedMarchType
      };
    }
  }

  // 2. GESTIONE STATICA (Spawns, Drop manuali o Marce già concluse da tempo)
  const finalX = posToUse.x !== undefined ? Number(posToUse.x) : Number(posToUse.targetX);
  const finalY = posToUse.y !== undefined ? Number(posToUse.y) : Number(posToUse.targetY);

  if (isNaN(finalX) || isNaN(finalY)) {
    const base = getBasePosition(entity.id, teamBase);
    return { isVisible: true, x: base.x, y: base.y, isHealing: false, isGarrisoned: false, marchType: derivedMarchType };
  }

  // Se l'entità è stata rilasciata a mano e non ha l'ID dell'edificio salvato, lo cerchiamo per coordinate
  if (!targetBuildingId) {
    targetBuildingId = checkIsAtBuilding(finalX, finalY, buildings);
  }

  return { 
    isVisible: true, 
    x: finalX, 
    y: finalY, 
    isHealing: false, 
    isMarching: false,
    isGarrisoned: !!targetBuildingId, // Flag assoluta: se c'è un targetBuildingId è in guarnigione
    targetBuildingId,
    marchType: derivedMarchType 
  };
};

export const InteractiveMap = ({ 
  teamBase = 'blue', buildings = [], activeDeployment = [], marches = [], 
  onUpdatePosition, currentTime, draftPositions = {}, healingEvents = {},
  onDispatchMarch, getAvailableMarches
}) => {
  
  const mapRef = useRef(null);
  
  const [popupPlayerId, setPopupPlayerId] = useState(null);
  const [popupBuildingId, setPopupBuildingId] = useState(null);
  const [marchAssignments, setMarchAssignments] = useState({});

  const [modalPos, setModalPos] = useState({ x: 20, y: 20 });
  const [isDraggingModal, setIsDraggingModal] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const handleBuildingClick = (e, buildingId) => { 
    e.stopPropagation(); 
    setPopupBuildingId(popupBuildingId === buildingId ? null : buildingId); 
    setPopupPlayerId(null); 
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const dragData = e.dataTransfer.getData('text/plain');
    if (!dragData || !onUpdatePosition) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    onUpdatePosition(dragData, parseFloat(x.toFixed(2)), parseFloat(y.toFixed(2)));
  };

  const handleOpenPopup = (e, playerId) => { 
    e.stopPropagation(); 
    const isOpeningNew = popupPlayerId !== playerId;
    setPopupPlayerId(isOpeningNew ? playerId : null); 
    setPopupBuildingId(null);
    setMarchAssignments({}); 
    
    if (isOpeningNew && mapRef.current) {
      const rect = mapRef.current.getBoundingClientRect();
      setModalPos({ x: rect.width - 180, y: 20 });
    }
  };

  const updateMarchAssignment = (marchIdx, field, value) => {
    setMarchAssignments(prev => {
      const current = prev[marchIdx] || { buildingId: '', type: 'attacco' };
      return { ...prev, [marchIdx]: { ...current, [field]: value } };
    });
  };

  const handleConfirmDispatch = (playerId) => { 
    const assignments = Object.entries(marchAssignments).filter(([_, data]) => data.buildingId !== '');
    if (assignments.length > 0) {
      assignments.forEach(([marchIdx, data]) => {
        onDispatchMarch(playerId, data.buildingId, parseInt(marchIdx), data.type);
      });
      setPopupPlayerId(null); 
      setMarchAssignments({});
    } 
  };

  const handlePointerDownModal = (e) => {
    e.stopPropagation();
    setIsDraggingModal(true);
    setDragOffset({ x: e.clientX - modalPos.x, y: e.clientY - modalPos.y });
  };

  const handlePointerMoveMap = (e) => {
    if (!isDraggingModal) return;
    let newX = e.clientX - dragOffset.x;
    let newY = e.clientY - dragOffset.y;
    if (mapRef.current) {
      const rect = mapRef.current.getBoundingClientRect();
      if (newX < 0) newX = 0;
      if (newY < 0) newY = 0;
      if (newX > rect.width - 160) newX = rect.width - 160; 
      if (newY > rect.height - 80) newY = rect.height - 80; 
    }
    setModalPos({ x: newX, y: newY });
  };

  const handlePointerUpMap = () => {
    if (isDraggingModal) setIsDraggingModal(false);
  };

  const draftedNewMarches = Object.entries(draftPositions).filter(([id, draft]) => draft.isNewMarch).map(([id, draft]) => ({ id, type: 'march', leaderId: draft.leader, positions: {}, isDraft: true, marchType: draft.marchType }));

  const allMapEntities = [
    ...(activeDeployment || []).map(p => ({ ...p, type: 'player' })),
    ...(marches || []).map(m => ({ ...m, type: 'march', leaderId: m.leader })),
    ...draftedNewMarches
  ];

  // CALCOLO DELLE GUARNIGIONI E DELLE CATTURE
  const { capturedBuildingIds, buildingGarrisons } = React.useMemo(() => {
    const captured = new Set();
    const garrisons = {};
    buildings.forEach(b => garrisons[b.id] = []);

    allMapEntities.forEach(entity => {
      // Passiamo buildings alla funzione di stato
      const state = getEntityDisplayState(entity, currentTime, draftPositions, healingEvents, teamBase, buildings);
      
      // La logica è semplicissima: se è vivo, non è in cura, ed è in guarnigione, popola l'edificio
      if (state.isVisible && !state.isHealing && state.isGarrisoned && state.targetBuildingId) {
        const bId = state.targetBuildingId;
        
        if (garrisons[bId]) {
          // 🛡️ SCUDO ANTI-DUPLICATI: Ignora entità clonate da vecchi salvataggi corrotti
          if (garrisons[bId].some(g => String(g.id) === String(entity.id))) return;

          captured.add(bId);
          
          let leaderName = 'Sconosciuto';
          if (entity.type === 'player') {
            leaderName = entity.name || entity.tag || 'Singolo';
          } else if (entity.type === 'march') {
            const leader = activeDeployment.find(p => String(p.id) === String(entity.leaderId));
            // 🏷️ CHIAREZZA VISIVA: Aggiungiamo "(M)" per distinguere la marcia dal giocatore fisico
            leaderName = leader ? `${leader.name || leader.tag} (M)` : `Marcia`;
          }

          garrisons[bId].push({
            id: entity.id,
            leaderName: leaderName,
            marchType: state.marchType
          });
        }
      }
    });
    return { capturedBuildingIds: captured, buildingGarrisons: garrisons };
  }, [activeDeployment, marches, draftPositions, buildings, currentTime, healingEvents, teamBase]);
  return (
    <div 
      ref={mapRef}
      className="w-full h-full relative flex items-center justify-center overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900" 
      onClick={() => { setPopupPlayerId(null); setPopupBuildingId(null); setMarchAssignments({}); }}
      onPointerMove={handlePointerMoveMap}
      onPointerUp={handlePointerUpMap}
      onPointerLeave={handlePointerUpMap}
    >
      <div className="absolute inset-0 opacity-60 blur-[40px] scale-110 pointer-events-none z-0" style={{ backgroundImage: "url('/map-bg.png')", backgroundSize: 'cover', backgroundPosition: 'center' }}></div>

      <div className="relative z-10 inline-block border-8 border-slate-800/90 rounded-[2rem] shadow-[0_30px_60px_rgba(0,0,0,0.9)] overflow-hidden ring-1 ring-slate-600/50" onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>
        <img src="/map-bg.png" alt="Mappa Tattica" className="max-w-full max-h-[85vh] w-auto block object-contain pointer-events-none" />

        <div className="absolute inset-0 pointer-events-none">
          <svg className="absolute inset-0 w-full h-full z-[15]">
            {allMapEntities.map((entity, index) => {
              const state = getEntityDisplayState(entity, currentTime, draftPositions, healingEvents, teamBase, buildings);
              if (!state.isVisible || !state.isMarching) return null;
              
              let strokeColor = '#22d3ee'; 
              if (entity.type === 'march') {
                if (state.marchType === 'difesa') strokeColor = '#3b82f6';
                else if (state.marchType === 'supporto') strokeColor = '#10b981';
                else strokeColor = '#ef4444'; 
              }

              return (
                <line 
                  key={`line-${entity.type}-${entity.id}-${index}`}
                  x1={`${state.startX}%`} y1={`${state.startY}%`} 
                  x2={`${state.targetX}%`} y2={`${state.targetY}%`}
                  stroke={strokeColor} 
                  strokeWidth="2" 
                  strokeDasharray="4 4"
                  className="opacity-60 animate-pulse pointer-events-none"
                />
              );
            })}
          </svg>
        </div>

        <div className="absolute inset-0">
          {/* EDIFICI E TOOLTIPS (Garrisons) */}
          {buildings.map((building) => {
            const top = building.y ? `${building.y}%` : '50%';
            const left = building.x ? `${building.x}%` : '50%';
            const isCaptured = capturedBuildingIds.has(building.id);
            const garrison = buildingGarrisons[building.id] || [];
            const hasGarrison = garrison.length > 0;
            
            const isBottomHalf = building.y && building.y > 60;
            const tooltipPositionClass = isBottomHalf ? 'bottom-full mb-2' : 'top-full mt-2';

            return (
              <div key={building.id} className={`absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group cursor-pointer ${popupBuildingId === building.id ? 'z-[60]' : 'z-20 hover:z-40'}`} style={{ top, left }} onClick={(e) => handleBuildingClick(e, building.id)}>
                <div className="transition-all duration-300 group-hover:scale-110 relative">
                  {isCaptured && <div className="absolute inset-0 bg-cyan-500/20 rounded-full blur-md animate-pulse pointer-events-none"></div>}
                  
                  {/* LA BANDIERINA CHIESTA */}
                  {hasGarrison && (
                    <div className="absolute -top-1 -right-2 z-[70] flex flex-col items-center pointer-events-none">
                      <div className="text-xl drop-shadow-md animate-pulse">🚩</div>
                    </div>
                  )}

                  <div className="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center relative z-10 pointer-events-none" style={{ transform: `scale(${building.scale || 1})` }}>
                    {building.icon ? <img src={building.icon} alt={building.name} className="w-full h-full object-contain drop-shadow-xl pointer-events-none" /> : <div className="text-cyan-400 drop-shadow-lg"><CastleIcon /></div>}
                  </div>
                </div>

                {/* IL TOOLTIP CHE MOSTRA I NOMI */}
                {popupBuildingId !== building.id && (
                  <div className={`absolute ${tooltipPositionClass} bg-slate-800/95 px-3 py-2 rounded-lg text-xs font-bold text-slate-200 border border-slate-600 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-[100] shadow-xl flex flex-col gap-1`}>
                    <div className="text-cyan-400 uppercase text-center">{building.name}</div>
                    
                    {hasGarrison && (
                      <div className="flex flex-col gap-1 border-t border-slate-700 pt-1 mt-0.5">
                        <div className="text-amber-400 uppercase text-[9px] text-center tracking-widest">In Presidio</div>
                        {garrison.map((g, idx) => (
                           <div key={`${g.id}-${idx}`} className="flex items-center gap-1.5 text-[11px]">
                             <span>{g.marchType === 'difesa' ? '🛡️' : g.marchType === 'supporto' ? '🤝' : '⚔️'}</span>
                             <span>{g.leaderName}</span>
                           </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* GIOCATORI E MARCE MAPPATI */}
          {allMapEntities.map((entity, index) => {
            const state = getEntityDisplayState(entity, currentTime, draftPositions, healingEvents, teamBase, buildings);
            if (!state.isVisible) return null;

            // REGOLA INFALLIBILE: SE E' IN GUARNIGIONE NON ESISTE PIU' IL SEGNALINO GRAFICO!
            if (state.isGarrisoned) {
               return null; 
            }

            const isPlayer = entity.type === 'player';
            const leader = isPlayer ? entity : activeDeployment.find(p => String(p.id) === String(entity.leaderId));
            const isHealing = state.isHealing;

            const typeIcon = state.marchType === 'difesa' ? '🛡️' : state.marchType === 'supporto' ? '🤝' : '⚔️';
            const tag = isPlayer ? (entity.tag || '?') : (leader ? `${leader.tag} ${typeIcon}` : 'M');
            const displayName = leader ? (isPlayer ? leader.name : `Marcia ${typeIcon} di ${leader.name}`) : 'Sconosciuto';

            // Logica di offset mantenuta ESCLUSIVAMENTE per eventuali drop manuali "fuori" dagli edifici (Deserto)
            let offsetX = 0;
            let offsetY = 0;
            if (!isPlayer && !state.isMarching) {
              const leaderMarches = allMapEntities.filter(e => e.leaderId === entity.leaderId && e.type === 'march');
              const mIdx = leaderMarches.findIndex(m => m.id === entity.id);
              const angle = (mIdx * (Math.PI * 2 / 6)) + (Math.PI / 4); 
              offsetX = Math.round(Math.cos(angle) * 18);
              offsetY = Math.round(Math.sin(angle) * 18);
            }

            const zIndexClass = popupPlayerId === entity.id ? 'z-[60]' : (isPlayer ? 'z-40 hover:z-50' : 'z-20 hover:z-30');

            return (
              <div 
                key={`map-entity-${entity.type}-${entity.id}-${index}`} 
                className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-[1000ms] ease-linear group ${zIndexClass}`} 
                style={{ 
                  top: `calc(${state.y}% + ${offsetY}px)`, 
                  left: `calc(${state.x}% + ${offsetX}px)` 
                }}
              >
                {popupPlayerId !== entity.id && (
                  <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-slate-800/95 px-2 py-1.5 rounded text-[11px] font-bold text-slate-200 border border-slate-600 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl z-50">
                    {displayName}
                  </div>
                )}

                <div 
                  onClick={(e) => { if(isPlayer && !isHealing) handleOpenPopup(e, entity.id); }} 
                  draggable={isPlayer && !isHealing} 
                  onDragStart={(e) => { if (isPlayer && !isHealing) e.dataTransfer.setData('text/plain', `player:${entity.id}`); }}
                  className={`w-7 h-7 rounded-full border-[3px] flex items-center justify-center font-bold text-[10px] shadow-lg ${isPlayer ? 'cursor-pointer hover:scale-125 transition-transform duration-200' : 'cursor-default pointer-events-none'} ${isHealing ? 'bg-emerald-800 border-emerald-400 text-emerald-100' : (isPlayer ? 'bg-slate-700 border-cyan-400 text-slate-100' : 'bg-slate-800 border-amber-400 text-slate-100 scale-90')}`}
                >
                  {isHealing ? '🏥' : tag}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MODALE FLOTTANTE DRAGGABILE (Nascoso per brevità, invariato) */}
      {popupPlayerId && (
        (() => {
          const activePlayer = allMapEntities.find(e => e.id === popupPlayerId && e.type === 'player');
          if (!activePlayer) return null;
          
          return (
            <div 
              className="absolute bg-slate-800/95 backdrop-blur-md border border-slate-600 rounded-lg shadow-[0_10px_40px_rgba(0,0,0,0.8)] z-[200] flex flex-col overflow-hidden w-[160px] select-none"
              style={{ left: `${modalPos.x}px`, top: `${modalPos.y}px` }}
              onClick={(e) => e.stopPropagation()} 
            >
              <div 
                className={`flex justify-between items-center p-1.5 border-b border-slate-700 bg-slate-900/80 shrink-0 ${isDraggingModal ? 'cursor-grabbing' : 'cursor-grab'} hover:bg-slate-900 transition-colors`}
                onPointerDown={handlePointerDownModal}
              >
                <div className="font-bold text-[9px] text-cyan-400 uppercase flex items-center gap-1.5 pointer-events-none">
                  <span>📋</span> Ordini: {activePlayer.tag}
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); setPopupPlayerId(null); setMarchAssignments({}); }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="text-slate-400 hover:text-red-400 transition-colors w-4 h-4 flex items-center justify-center rounded-full hover:bg-slate-700 z-10 text-[8px]"
                  title="Chiudi"
                >
                  ✕
                </button>
              </div>
              
              <div className="max-h-[50vh] overflow-y-auto p-1.5 flex flex-col gap-1.5">
                {Array.from({ length: getAvailableMarches(activePlayer.id) }).map((_, i) => {
                  const marchIdx = i + 1;
                  const currentAssign = marchAssignments[marchIdx] || { buildingId: '', type: 'attacco' };
                  return (
                    <div key={`march-assign-${marchIdx}`} className="flex flex-col gap-1 bg-slate-700/30 p-1.5 rounded border border-slate-600/50">
                      <span className="text-cyan-300 text-[8px] font-bold tracking-wider uppercase">Marcia {marchIdx}</span>
                      
                      <div className="flex flex-col gap-1">
                        <select 
                          className="w-full bg-slate-900 border border-slate-700 rounded-sm p-0.5 text-[9px] text-slate-200 outline-none focus:border-cyan-500 cursor-pointer"
                          value={currentAssign.buildingId} 
                          onChange={(e) => updateMarchAssignment(marchIdx, 'buildingId', e.target.value)}
                        >
                          <option value="">Nessun bersaglio...</option>
                          {buildings.map(b => (<option key={b.id} value={b.id}>{b.name}</option>))}
                        </select>
                        
                        <select 
                          className="w-full bg-slate-900 border border-slate-700 rounded-sm p-0.5 text-[9px] text-slate-200 outline-none focus:border-cyan-500 cursor-pointer"
                          value={currentAssign.type} 
                          onChange={(e) => updateMarchAssignment(marchIdx, 'type', e.target.value)}
                        >
                          <option value="attacco">⚔️ Attacco</option>
                          <option value="difesa">🛡️ Difesa</option>
                          <option value="supporto">🤝 Supporto</option>
                        </select>
                      </div>
                    </div>
                  )
                })}

                {getAvailableMarches(activePlayer.id) === 0 && (
                  <div className="text-center text-slate-400 text-[9px] py-2 px-1 flex flex-col items-center gap-1">
                    <span className="text-sm">⚠️</span>
                    Tutte assegnate.
                  </div>
                )}
              </div>

              <div className="p-1.5 border-t border-slate-700 bg-slate-900/50 flex gap-1.5 shrink-0">
                <button 
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-[9px] font-semibold py-1 rounded-sm transition-colors cursor-pointer" 
                  onClick={() => { setPopupPlayerId(null); setMarchAssignments({}); }}
                >
                  Annulla
                </button>
                <button 
                  className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white text-[9px] font-bold py-1 rounded-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-md" 
                  onClick={() => handleConfirmDispatch(activePlayer.id)} 
                  disabled={Object.values(marchAssignments).filter(v => v.buildingId !== '').length === 0}
                >
                  Invia Ordini
                </button>
              </div>
            </div>
          );
        })()
      )}
    </div>
  );
};