import React, { useState, useRef } from 'react';
import { getBasePosition, checkIsAtBuilding, isMarchGathering, getEntityDisplayState } from './mapUtils';
import { DispatchModal } from './DispatchModal';
import { GarrisonPopup } from './GarrisonPopup'; // <-- IMPORTATO IL NUOVO COMPONENTE

const CastleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 20v-6h-2v6h-4v-4H8v4H4v-6H2v6h20z"/><path d="M22 14V6l-3-2-3 2v8M2 14V6l3-2 3 2v8"/><path d="M10 14V6l2-2 2 2v8"/></svg>
);

export const InteractiveMap = ({ 
  teamBase, 
  buildings, 
  activeDeployment, 
  marches, 
  onUpdatePosition, 
  currentTime, 
  draftPositions, 
  healingEvents, 
  onDispatchMarch, 
  getAvailableMarches,
  handleHeal,
  handleCancelHeal,
  handleGarrisonAction // <-- AGGIUNTA PROP
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
      const current = prev[marchIdx] || { buildingId: '', type: 'attacco', members: [] };
      return { ...prev, [marchIdx]: { ...current, [field]: value } };
    });
  };

  const handleConfirmDispatch = (playerId) => { 
    const assignments = Object.entries(marchAssignments).filter(([_, data]) => data.buildingId !== '');
    if (assignments.length > 0) {
      assignments.forEach(([marchIdx, data]) => {
        const memberIds = (data.members || []).map(m => typeof m === 'object' ? m.id : m);
        const membersDataWithSpeedups = data.members || [];
        onDispatchMarch(playerId, data.buildingId, parseInt(marchIdx), data.type, memberIds, membersDataWithSpeedups);
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
      if (newX > rect.width - 190) newX = rect.width - 190; 
      if (newY > rect.height - 80) newY = rect.height - 80; 
    }
    setModalPos({ x: newX, y: newY });
  };

  const handlePointerUpMap = () => {
    if (isDraggingModal) setIsDraggingModal(false);
  };

  const draftedNewMarches = Object.entries(draftPositions).filter(([id, draft]) => draft.isNewMarch).map(([id, draft]) => ({ id, type: 'march', leaderId: draft.leader, positions: {}, isDraft: true, marchType: draft.marchType, members: draft.members, speedupsUsed: draft.speedupsUsed }));

  const allMapEntities = [
    ...(activeDeployment || []).map(p => ({ ...p, type: 'player' })),
    ...(marches || []).map(m => ({ ...m, type: 'march', leaderId: m.leader })),
    ...draftedNewMarches
  ];

  const { capturedBuildingIds, buildingGarrisons } = React.useMemo(() => {
    const captured = new Set();
    const garrisons = {};
    buildings.forEach(b => garrisons[b.id] = []);

    allMapEntities.forEach(entity => {
      const state = getEntityDisplayState(entity, currentTime, draftPositions, healingEvents, teamBase, buildings);
      
      if (state.isVisible && !state.isHealing && state.isGarrisoned && state.targetBuildingId) {
        const bId = state.targetBuildingId;
        
        if (garrisons[bId]) {
          if (garrisons[bId].some(g => String(g.id) === String(entity.id))) return;
          captured.add(bId);
          
          let leaderName = 'Sconosciuto';
          if (entity.type === 'player') {
            leaderName = entity.name || entity.tag || 'Singolo';
          } else if (entity.type === 'march') {
            const leader = activeDeployment.find(p => String(p.id) === String(entity.leaderId));
            leaderName = leader ? `${leader.name || leader.tag} (M)` : `Marcia`;
            
            if (entity.marchType === 'rally' && entity.members && entity.members.length > 0) {
              const memberTags = entity.members.map(mObj => {
                  const mId = typeof mObj === 'object' ? mObj.id : mObj;
                  const m = activeDeployment.find(p => String(p.id) === String(mId));
                  return m ? (m.tag || m.name) : '';
              }).filter(Boolean).join(', ');
              
              if (memberTags) {
                  leaderName += ` [+ ${memberTags}]`;
              }
            }
          }

          garrisons[bId].push({
            id: entity.id,
            leaderName: leaderName,
            marchType: state.marchType,
            entity: entity // <-- SALVIAMO L'ENTITA' COMPLETA PER ESTRARRE I MEMBRI
          });
        }
      }
    });
    return { capturedBuildingIds: captured, buildingGarrisons: garrisons };
  }, [activeDeployment, marches, draftPositions, buildings, currentTime, healingEvents, teamBase]);

  // ---- NUOVA FUNZIONE: Estrae tutti i giocatori (leader + membri) in un edificio ----
  const getPlayersInBuilding = (bId) => {
    const players = [];
    const garrisonEntities = buildingGarrisons[bId] || [];
    
    garrisonEntities.forEach(g => {
      const entity = g.entity;
      if (entity.type === 'player') {
        players.push({ id: entity.id, name: entity.name || entity.tag || 'Singolo', isLeader: true });
      } else if (entity.type === 'march') {
        const leader = activeDeployment.find(p => String(p.id) === String(entity.leaderId));
        if (leader) players.push({ id: leader.id, name: leader.name || leader.tag, isLeader: true });
        
        if (entity.members) {
          entity.members.forEach(mObj => {
            const mId = typeof mObj === 'object' ? mObj.id : mObj;
            const m = activeDeployment.find(p => String(p.id) === String(mId));
            if (m) players.push({ id: m.id, name: m.name || m.tag, isLeader: false });
          });
        }
      }
    });
    return players;
  };

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
                else if (state.marchType === 'rally' || state.marchType === 'rally_join') strokeColor = '#f59e0b';
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
                  {hasGarrison && (
                    <div className="absolute -top-1 -right-2 z-[70] flex flex-col items-center pointer-events-none">
                      <div className="text-xl drop-shadow-md animate-pulse">🚩</div>
                    </div>
                  )}
                  <div className="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center relative z-10 pointer-events-none" style={{ transform: `scale(${building.scale || 1})` }}>
                    {building.icon ? <img src={building.icon} alt={building.name} className="w-full h-full object-contain drop-shadow-xl pointer-events-none" /> : <div className="text-cyan-400 drop-shadow-lg"><CastleIcon /></div>}
                  </div>
                </div>

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

          {/* RENDER DEL POPUP DEGLI EDIFICI AL CLICK */}
          {popupBuildingId && (
            <GarrisonPopup 
              building={buildings.find(b => b.id === popupBuildingId)}
              garrisonedPlayers={getPlayersInBuilding(popupBuildingId)}
              onClose={() => setPopupBuildingId(null)}
              handleGarrisonAction={handleGarrisonAction}
            />
          )}

          {allMapEntities.map((entity, index) => {
            const state = getEntityDisplayState(entity, currentTime, draftPositions, healingEvents, teamBase, buildings);
            if (!state.isVisible) return null;
            if (state.isGarrisoned) return null; 

            const isPlayer = entity.type === 'player';
            const isRallyAmmassamento = !isPlayer && entity.marchType === 'rally' && isMarchGathering(entity, currentTime);

            if (isRallyAmmassamento) return null;

            let isGatheringLeader = false;
            if (isPlayer) {
                isGatheringLeader = allMapEntities.some(m => 
                    m.type === 'march' && m.leaderId === entity.id && m.marchType === 'rally' && isMarchGathering(m, currentTime)
                );
            }

            const leader = isPlayer ? entity : activeDeployment.find(p => String(p.id) === String(entity.leaderId));
            const isHealing = state.isHealing;

            const typeIcon = state.marchType === 'difesa' ? '🛡️' : state.marchType === 'supporto' ? '🤝' : '⚔️';
            const tag = isPlayer ? (entity.tag || '?') : (leader ? `${leader.tag} ${typeIcon}` : 'M');
            
            const typeText = state.marchType === 'difesa' ? '🛡️' : state.marchType === 'supporto' ? '🤝' : state.marchType === 'rally' ? '🔥' : '⚔️';
            const displayName = leader ? (isPlayer ? leader.name : `Marcia ${typeText} di ${leader.name}`) : 'Sconosciuto';

            let offsetX = 0;
            let offsetY = 0;
            if (!isPlayer && !state.isMarching) {
              const visibleLeaderMarches = allMapEntities.filter(e => {
                  if (e.leaderId !== entity.leaderId || e.type !== 'march') return false;
                  return !(e.marchType === 'rally' && isMarchGathering(e, currentTime));
              });

              const mIdx = visibleLeaderMarches.findIndex(m => m.id === entity.id);
              if (mIdx !== -1) {
                  const angle = (mIdx * (Math.PI * 2 / 6)) + (Math.PI / 4); 
                  offsetX = Math.round(Math.cos(angle) * 18);
                  offsetY = Math.round(Math.sin(angle) * 18);
              }
            }

            const zIndexClass = popupPlayerId === entity.id ? 'z-[60]' : (isPlayer ? 'z-40 hover:z-50' : 'z-20 hover:z-30');

            let tokenColors = '';
            if (isHealing) {
              tokenColors = 'bg-emerald-800 border-emerald-400 text-emerald-100';
            } else if (state.marchType === 'rally_join' || isGatheringLeader || (!isPlayer && state.marchType === 'rally')) {
              tokenColors = 'bg-amber-600 border-amber-300 text-amber-50 shadow-[0_0_10px_rgba(217,119,6,0.6)]';
            } else if (isPlayer) {
              tokenColors = 'bg-slate-700 border-cyan-400 text-slate-100';
            } else {
              tokenColors = 'bg-slate-800 border-cyan-500 text-cyan-100 scale-90'; 
            }

            const speedupsUsed = entity.speedupsUsed || 0;
            const hasSpeedup = speedupsUsed > 0;

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
                  <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-slate-800/95 px-2 py-1.5 rounded text-[11px] font-bold text-slate-200 border border-slate-600 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl z-50 flex flex-col items-center gap-0.5">
                    <span>{displayName}</span>
                    {hasSpeedup && (
                      <span className="text-amber-400 text-[9px] flex items-center gap-1">
                        ⚡ In marcia forzata (x{speedupsUsed})
                      </span>
                    )}
                  </div>
                )}

                <div className="relative cursor-pointer hover:scale-125 transition-transform duration-200">
                  
                  {hasSpeedup && state.isMarching && (
                    <div className="absolute inset-0 bg-amber-400/40 rounded-full blur-md animate-ping pointer-events-none scale-150"></div>
                  )}

                  <div 
                    onClick={(e) => { if(isPlayer && !isHealing) handleOpenPopup(e, entity.id); }} 
                    draggable={isPlayer && !isHealing} 
                    onDragStart={(e) => { if (isPlayer && !isHealing) e.dataTransfer.setData('text/plain', `player:${entity.id}`); }}
                    className={`w-7 h-7 rounded-full border-[3px] flex items-center justify-center font-bold text-[10px] shadow-lg relative z-10 ${tokenColors}`}
                  >
                    {isHealing ? '🏥' : tag}
                  </div>

                  {hasSpeedup && state.isMarching && (
                    <div className="absolute -bottom-1.5 -right-1.5 bg-slate-900 border border-amber-400 text-[8px] rounded-full w-4 h-4 flex items-center justify-center text-amber-400 shadow-md z-20 pointer-events-none">
                      ⏩
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {popupPlayerId && (
        <DispatchModal 
          activePlayer={allMapEntities.find(e => e.id === popupPlayerId && e.type === 'player')}
          activeDeployment={activeDeployment}
          marchAssignments={marchAssignments}
          setMarchAssignments={setMarchAssignments}
          setPopupPlayerId={setPopupPlayerId}
          handleConfirmDispatch={handleConfirmDispatch}
          modalPos={modalPos}
          setModalPos={setModalPos}
          isDraggingModal={isDraggingModal}
          setIsDraggingModal={setIsDraggingModal}
          dragOffset={dragOffset}
          setDragOffset={setDragOffset}
          buildings={buildings}
          getAvailableMarches={getAvailableMarches}
          healingEvents={healingEvents}
          currentTime={currentTime}
          handlePointerDownModal={handlePointerDownModal}
          handleHeal={handleHeal}
          handleCancelHeal={handleCancelHeal}
        />
      )}
    </div>
  );
};