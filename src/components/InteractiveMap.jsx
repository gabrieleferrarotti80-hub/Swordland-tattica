import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next'; 
import { getBasePosition, checkIsAtBuilding, isMarchGathering, getEntityDisplayState } from './mapUtils';

const CastleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 20v-6h-2v6h-4v-4H8v4H4v-6H2v6h20z"/><path d="M22 14V6l-3-2-3 2v8M2 14V6l3-2 3 2v8"/><path d="M10 14V6l2-2 2 2v8"/></svg>
);

const MAX_COORD = 240; 
const SCALE_X = 60; 
const SCALE_Y = 48; 
const CENTER_SUM = 234; 

const getVisualLeft = (x, y) => 50 + ((x - y) / MAX_COORD) * SCALE_X;
const getVisualTop = (x, y) => 50 - ((x + y - CENTER_SUM) / MAX_COORD) * SCALE_Y;

export const InteractiveMap = ({ 
  teamBase, buildings, activeDeployment, marches, onUpdatePosition, currentTime, draftPositions, healingEvents, 
  getAvailableMarches, handleHeal, handleCancelHeal, handleGarrisonAction, isEditorMode, selectedBuildingForEdit, setSelectedBuildingForEdit,
  popupPlayerId, setPopupPlayerId, marchAssignments, setMarchAssignments, 
  lootDrops = [],
  buildingStates = {} 
}) => {
  const { t } = useTranslation(); 
  
  const mapRef = useRef(null);
  const [popupBuildingId, setPopupBuildingId] = useState(null);

  const handleBuildingClick = (e, buildingId) => { 
    e.stopPropagation(); 
    if (isEditorMode && setSelectedBuildingForEdit) { setSelectedBuildingForEdit(buildingId); return; } 
    setPopupBuildingId(popupBuildingId === buildingId ? null : buildingId); 
    setPopupPlayerId(null); 
  };
  
  const handleDrop = (e) => { 
    e.preventDefault(); 
    if (isEditorMode) return; 
    const dragData = e.dataTransfer.getData('text/plain'); 
    if (!dragData || !onUpdatePosition) return; 
    const rect = e.currentTarget.getBoundingClientRect(); 
    const visX = ((e.clientX - rect.left) / rect.width) * 100; 
    const visY = ((e.clientY - rect.top) / rect.height) * 100; 
    const u = (visX - 50) * (MAX_COORD / SCALE_X); 
    const v = (50 - visY) * (MAX_COORD / SCALE_Y) + CENTER_SUM; 
    const isoX = (u + v) / 2; 
    const isoY = (v - u) / 2; 
    onUpdatePosition(dragData, parseFloat(isoX.toFixed(2)), parseFloat(isoY.toFixed(2))); 
  };
  
  const handleOpenPopup = (e, playerId) => { 
    e.stopPropagation(); 
    if (isEditorMode) return; 
    const isOpeningNew = popupPlayerId !== playerId;
    setPopupPlayerId(isOpeningNew ? playerId : null); 
    setPopupBuildingId(null);
    setMarchAssignments({}); 
  };

  const draftedNewMarches = Object.entries(draftPositions).filter(([id, draft]) => draft.isNewMarch).map(([id, draft]) => ({ id, type: 'march', leaderId: draft.leader, positions: {}, isDraft: true, marchType: draft.marchType, members: draft.members, speedupsUsed: draft.speedupsUsed }));
  const allMapEntities = [...(activeDeployment || []).map(p => ({ ...p, type: 'player' })), ...(marches || []).map(m => ({ ...m, type: 'march', leaderId: m.leader })), ...draftedNewMarches];

  const { capturedBuildingIds, buildingGarrisons } = React.useMemo(() => {
    const captured = new Set(); const garrisons = {}; 
    buildings.forEach(b => garrisons[String(b.id)] = []); 
    
    allMapEntities.forEach(entity => {
      const state = getEntityDisplayState(entity, currentTime, draftPositions, healingEvents, teamBase, buildings);
      
      let isGarr = state.isGarrisoned;
      let tbId = state.targetBuildingId;

      if (!isGarr && !state.isMarching && !state.isHealing && state.isVisible) {
         const b = buildings.find(build => {
            const dx = build.x - state.x;
            const dy = build.y - state.y;
            return Math.sqrt(dx * dx + dy * dy) < 12; 
         });
         if (b) { isGarr = true; tbId = b.id; }
      }

      if (!state.isHealing && isGarr && tbId && !String(tbId).startsWith('loot_')) {
        const strTbId = String(tbId);
        if (!garrisons[strTbId]) garrisons[strTbId] = [];

        if (garrisons[strTbId].some(g => String(g.id) === String(entity.id))) return;
        captured.add(strTbId);
        
        let leaderName = t('interactive_map.unknown');
        if (entity.type === 'player') { 
            leaderName = entity.name || entity.tag || t('interactive_map.single'); 
        } else if (entity.type === 'march') {
          const leader = activeDeployment.find(p => String(p.id) === String(entity.leaderId)); 
          leaderName = leader ? `${leader.name || leader.tag}` : t('interactive_map.march');
          if (entity.members && entity.members.length > 0) { 
              const memberTags = entity.members.map(mObj => { 
                  const mId = typeof mObj === 'object' ? mObj.id : mObj; 
                  const m = activeDeployment.find(p => String(p.id) === String(mId)); 
                  return m ? (m.tag || m.name) : ''; 
              }).filter(Boolean).join(', '); 
              if (memberTags) leaderName += ` [+ ${memberTags}]`; 
          }
        }
        garrisons[strTbId].push({ id: entity.id, leaderName: leaderName, marchType: state.marchType || 'attacco', entity: entity });
      }
    });
    return { capturedBuildingIds: captured, buildingGarrisons: garrisons };
  }, [activeDeployment, marches, draftPositions, buildings, currentTime, healingEvents, teamBase, t]);

  const getPlayersInBuilding = (bId) => {
    const strBId = String(bId);
    const players = [];
    const garrisonEntities = buildingGarrisons[strBId] || [];

    garrisonEntities.forEach(g => {
      const entity = g.entity;
      if (!entity) return;

      if (entity.type === 'player') {
          players.push({ id: entity.id, name: entity.name || entity.tag || t('interactive_map.single'), isLeader: true, marchType: g.marchType });
      } else if (entity.type === 'march') {
        const leader = activeDeployment.find(p => String(p.id) === String(entity.leaderId));
        if (leader) players.push({ id: leader.id, name: leader.name || leader.tag, isLeader: true, marchType: g.marchType });
        if (entity.members) {
            entity.members.forEach(mObj => {
                const mId = typeof mObj === 'object' ? mObj.id : mObj;
                const m = activeDeployment.find(p => String(p.id) === String(mId));
                if (m) players.push({ id: m.id, name: m.name || m.tag, isLeader: false, marchType: g.marchType });
            });
        }
      }
    });
    return players;
  };

  return (
    <div 
      ref={mapRef} 
      className={`w-full h-full relative overflow-hidden pointer-events-auto bg-[#241a16] ${isEditorMode ? 'border-4 border-amber-500 shadow-[inset_0_0_50px_rgba(245,158,11,0.5)]' : ''}`} 
      onClick={() => { setPopupPlayerId(null); setPopupBuildingId(null); setMarchAssignments({}); if(isEditorMode && setSelectedBuildingForEdit) setSelectedBuildingForEdit(''); }} 
      onDrop={handleDrop} 
      onDragOver={(e) => e.preventDefault()}
    >
      <img src="/map-bg.png" alt="Mappa Tattica" className="absolute inset-0 w-full h-full object-fill pointer-events-none block" />

      <svg className="absolute inset-0 w-full h-full z-[14] pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
        <polygon points={`${getVisualLeft(0, 200)},${getVisualTop(0, 200)} ${getVisualLeft(38, 200)},${getVisualTop(38, 200)} ${getVisualLeft(39, 239)},${getVisualTop(39, 239)}`} fill="rgba(34, 211, 238, 0.15)" stroke="rgba(34, 211, 238, 0.6)" strokeWidth="0.3" strokeDasharray="1 1" />
        <polygon points={`${getVisualLeft(200, 0)},${getVisualTop(200, 0)} ${getVisualLeft(200, 38)},${getVisualTop(200, 38)} ${getVisualLeft(239, 39)},${getVisualTop(239, 39)}`} fill="rgba(248, 113, 113, 0.15)" stroke="rgba(248, 113, 113, 0.6)" strokeWidth="0.3" strokeDasharray="1 1" />
      </svg>

      {!isEditorMode && (
        <svg className="absolute inset-0 w-full h-full z-[15] pointer-events-none">
          {allMapEntities.map((entity, index) => {
            const state = getEntityDisplayState(entity, currentTime, draftPositions, healingEvents, teamBase, buildings);
            if (!state.isVisible || !state.isMarching) return null;
            let strokeColor = '#22d3ee'; 
            if (entity.type === 'march') {
              if (state.marchType === 'difesa') strokeColor = '#3b82f6'; else if (state.marchType === 'supporto') strokeColor = '#10b981'; else if (state.marchType === 'rally' || state.marchType === 'rally_join') strokeColor = '#f59e0b'; else strokeColor = '#ef4444'; 
            }
            return ( <line key={`line-${entity.type}-${entity.id}-${index}`} x1={`${getVisualLeft(state.startX, state.startY)}%`} y1={`${getVisualTop(state.startX, state.startY)}%`} x2={`${getVisualLeft(state.targetX, state.targetY)}%`} y2={`${getVisualTop(state.targetX, state.targetY)}%`} stroke={strokeColor} strokeWidth="2" strokeDasharray="4 4" className="opacity-60 animate-pulse pointer-events-none" /> );
          })}
        </svg>
      )}

      <div className="absolute inset-0 pointer-events-none z-10">
        {!isEditorMode && lootDrops.map(loot => {
          const top = `${getVisualTop(loot.x, loot.y)}%`;
          const left = `${getVisualLeft(loot.x, loot.y)}%`;
          return (
            <div key={loot.id} className="absolute transform -translate-x-1/2 -translate-y-1/2 group pointer-events-auto flex flex-col items-center" style={{ top, left }}>
               <div className="text-xl animate-bounce drop-shadow-[0_0_10px_rgba(56,189,248,0.8)]">💎</div>
               <div className="bg-slate-900/90 text-cyan-300 text-[8px] font-black px-1.5 py-0.5 rounded border border-cyan-700/50 shadow-md whitespace-nowrap mt-0.5 tracking-wider">
                  {loot.shortName}
               </div>
            </div>
          )
        })}
      </div>

     <div className="absolute inset-0 pointer-events-none z-20">
        {buildings.map((building) => {
          const topPercent = building.y ? getVisualTop(building.x, building.y) : 50;
          const leftPercent = building.x ? getVisualLeft(building.x, building.y) : 50;
          
          const isCaptured = capturedBuildingIds.has(String(building.id));
          const garrison = buildingGarrisons[String(building.id)] || [];
          const hasGarrison = garrison.length > 0;
          const isBottomHalf = building.y && (building.x + building.y) < CENTER_SUM; 
          const isNearTop = topPercent < 30;
          
          const bState = buildingStates[building.id]; 
          
          // 💡 CONTROLLO BLOCCO VISIVO:
          const isLocked = (building.unlockTime || 0) > currentTime;

          return (
            <div key={building.id} className={`absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group cursor-pointer ${isEditorMode ? 'z-[60]' : (popupBuildingId === building.id ? 'z-[70]' : 'z-20 hover:z-40')} pointer-events-auto`} style={{ top: `${topPercent}%`, left: `${leftPercent}%` }} onClick={(e) => handleBuildingClick(e, building.id)}>
              <div className={`transition-all duration-300 ${isEditorMode ? 'scale-100 hover:scale-105' : 'group-hover:scale-110'} relative ${isLocked && !isEditorMode ? 'grayscale opacity-60' : ''}`}>
                {isEditorMode && <div className="absolute -inset-4 bg-amber-500/20 rounded-full blur-md animate-pulse pointer-events-none"></div>}
                {isCaptured && !isEditorMode && !isLocked && <div className="absolute inset-0 bg-cyan-500/20 rounded-full blur-md animate-pulse pointer-events-none"></div>}
                
                {/* Lucchetto per edifici non ancora sbloccati */}
                {isLocked && !isEditorMode && (
                   <div className="absolute -top-3 -right-3 z-[80] flex flex-col items-center pointer-events-none drop-shadow-lg">
                      <div className="text-2xl">🔒</div>
                      <div className="bg-slate-900/90 text-rose-400 border border-rose-500/50 text-[8px] font-black px-1.5 py-0.5 rounded shadow mt-0.5 whitespace-nowrap">
                         SBLOCCA A {building.unlockTime}'
                      </div>
                   </div>
                )}
                
                {hasGarrison && !isEditorMode && !isLocked && <div className="absolute -top-1 -right-2 z-[70] flex flex-col items-center pointer-events-none"><div className="text-xl drop-shadow-md animate-pulse">🚩</div></div>}
                
                <div className="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center relative z-10 pointer-events-none" style={{ transform: `scale(${building.scale || 1})` }}>
                  {building.icon ? <img src={building.icon} alt={building.name} className="w-full h-full object-contain drop-shadow-xl pointer-events-none" /> : <div className="text-cyan-400 drop-shadow-lg"><CastleIcon /></div>}
                </div>
              </div>

              {/* Tag Punti nascosto se l'edificio è chiuso */}
              {!isEditorMode && bState && !isLocked && (
                <div className="absolute top-full mt-1 flex flex-col items-center pointer-events-none w-max z-[80]">
                   {bState.owner !== 'neutral' && (
                     <div className={`text-[9px] font-black px-2 py-0.5 rounded shadow border flex items-center gap-1 ${bState.owner === 'blue' ? 'bg-blue-900/90 text-blue-200 border-blue-500' : 'bg-rose-900/90 text-rose-200 border-rose-500'}`}>
                       <span>🏦 Tot: {bState.totalPoints[bState.owner]}</span>
                       <span className="opacity-50">|</span>
                      <span className="text-amber-400" title="Bottino che cadrà a terra in caso di furto">📦 {Math.floor(bState.sessionPoints / 2)}</span>
                     </div>
                   )}
                   {bState.capturingTeam && (
                     <div className={`text-[8px] font-bold px-1.5 py-0.5 rounded mt-0.5 animate-pulse ${bState.capturingTeam === 'blue' ? 'bg-blue-600/90 text-white' : 'bg-rose-600/90 text-white'}`}>
                       ⚠️ Cattura in corso... {bState.captureProgress}/3
                     </div>
                   )}
                </div>
              )}

              {/* Tooltip Hover Semplice */}
              {!isEditorMode && popupBuildingId !== building.id && (
                <div className={`absolute ${isNearTop ? 'top-full mt-2' : 'bottom-full mb-2'} bg-slate-800/95 px-3 py-2 rounded-lg text-xs font-bold text-slate-200 border border-slate-600 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-[100] shadow-xl flex flex-col gap-1`}>
                  <div className="text-cyan-400 uppercase text-center">{building.name}</div>
                  {hasGarrison && !isLocked && (
                    <div className="flex flex-col gap-1 border-t border-slate-700 pt-1 mt-0.5">
                      <div className="text-amber-400 uppercase text-[9px] text-center tracking-widest">{t('interactive_map.in_garrison')}</div>
                      {garrison.map((g, idx) => ( <div key={`${g.id}-${idx}`} className="flex items-center gap-1.5 text-[11px]"><span>{g.marchType === 'difesa' ? '🛡️' : g.marchType === 'supporto' ? '🤝' : '⚔️'}</span><span>{g.leaderName}</span></div> ))}
                    </div>
                  )}
                </div>
              )}

              {/* GARRISON POPUP */}
              {popupBuildingId === building.id && !isEditorMode && getPlayersInBuilding(building.id).length > 0 && (
                <div 
                   className={`absolute ${isNearTop ? 'top-full mt-4' : 'bottom-full mb-4'} left-1/2 transform -translate-x-1/2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-4 flex flex-col gap-3 pointer-events-auto w-[280px] z-[9999] cursor-default`} 
                   onClick={(e) => e.stopPropagation()}
                >
                   <div className={`absolute left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent ${isNearTop ? 'bottom-full border-b-[8px] border-b-slate-700 mb-[1px]' : 'top-full border-t-[8px] border-t-slate-700 -mt-[1px]'}`}></div>
                   
                   <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                      <span className="text-cyan-400 font-black tracking-widest uppercase text-xs">{building.name}</span>
                      <button onClick={(e) => { e.stopPropagation(); setPopupBuildingId(null); }} className="text-slate-400 hover:text-red-400 font-bold w-6 h-6 flex items-center justify-center rounded-full hover:bg-slate-800 transition-colors">✕</button>
                   </div>
                   
                   <div className="flex flex-col gap-1.5 max-h-[150px] overflow-y-auto custom-scrollbar mt-1 pr-1">
                      {getPlayersInBuilding(building.id).map(p => (
                         <div key={p.id} className="flex justify-between items-center bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/50">
                            <span className="text-[11px] font-bold text-slate-200 flex items-center gap-2 truncate">
                              {p.isLeader ? <span title="Leader del Presidio" className="text-sm drop-shadow-sm">👑</span> : <span className="text-sm opacity-50 grayscale">👤</span>} 
                              {p.name}
                            </span>
                            {p.isLeader && (
                               <button onClick={(e) => { e.stopPropagation(); handleGarrisonAction('withdraw', building.id, p.id); }} className="bg-slate-700 hover:bg-amber-600 border border-slate-600 hover:border-amber-500 text-[9px] font-black tracking-wider px-2.5 py-1.5 rounded transition-all text-white shrink-0 shadow-sm">
                                 RITIRA
                               </button>
                            )}
                         </div>
                      ))}
                   </div>
                   
                   <div className="flex flex-col mt-2 border-t border-slate-700 pt-3">
                       <button onClick={(e) => { e.stopPropagation(); handleGarrisonAction('withdraw', building.id); setPopupBuildingId(null); }} className="w-full bg-slate-700 hover:bg-slate-600 border border-slate-600 text-white font-black uppercase tracking-wider py-3 rounded-lg text-[10px] shadow-md transition-colors flex items-center justify-center gap-2">
                          🚩 RITIRA TRUPPE
                       </button>
                   </div>
                </div>
              )}
            </div>
          );
        })}

        {!isEditorMode && allMapEntities.map((entity, index) => {
          const state = getEntityDisplayState(entity, currentTime, draftPositions, healingEvents, teamBase, buildings);
          
          const isPhysicallyAtBuilding = !state.isMarching && buildings.some(b => {
             const dx = b.x - state.x;
             const dy = b.y - state.y;
             return Math.sqrt(dx * dx + dy * dy) < 12; 
          });

          if (!state.isVisible || state.isGarrisoned || isPhysicallyAtBuilding) return null; 

          const isPlayer = entity.type === 'player';
          const isRallyAmmassamento = !isPlayer && entity.marchType === 'rally' && isMarchGathering(entity, currentTime);
          if (isRallyAmmassamento) return null;

          const isHealing = state.isHealing; 

          let isGatheringLeader = false;
          if (isPlayer) isGatheringLeader = allMapEntities.some(m => m.type === 'march' && m.leaderId === entity.id && m.marchType === 'rally' && isMarchGathering(m, currentTime));

          const leader = isPlayer ? entity : activeDeployment.find(p => String(p.id) === String(entity.leaderId));
          const typeIcon = state.marchType === 'difesa' ? '🛡️' : state.marchType === 'supporto' ? '🤝' : '⚔️';
          const tag = isPlayer ? (entity.tag || '?') : (leader ? `${leader.tag} ${typeIcon}` : 'M');
          const hoverTitle = isPlayer ? (entity.name || entity.tag || `${t('interactive_map.player')} ${entity.id}`) : (leader ? (leader.name || leader.tag || `${t('interactive_map.march_of')} ${leader.id}`) : t('interactive_map.march'));

          let offsetX = 0, offsetY = 0;
          if (!isPlayer && !state.isMarching) {
            const visibleLeaderMarches = allMapEntities.filter(e => e.leaderId === entity.leaderId && e.type === 'march' && !(e.marchType === 'rally' && isMarchGathering(e, currentTime)));
            const mIdx = visibleLeaderMarches.findIndex(m => m.id === entity.id);
            if (mIdx !== -1) { const angle = (mIdx * (Math.PI * 2 / 6)) + (Math.PI / 4); offsetX = Math.round(Math.cos(angle) * 18); offsetY = Math.round(Math.sin(angle) * 18); }
          }

          let tokenColors = '';
          if (isHealing) {
            tokenColors = 'bg-emerald-800 border-emerald-400 text-emerald-100';
          } else if (state.marchType === 'rally_join' || isGatheringLeader || (!isPlayer && state.marchType === 'rally')) {
            tokenColors = 'bg-amber-600 border-amber-300 text-amber-50 shadow-[0_0_15px_rgba(217,119,6,0.8)]';
          } else if (isPlayer) {
            const sq = (entity.squad || '').toLowerCase();
            if (sq.includes('assalt') || sq.includes('attacc')) { tokenColors = 'bg-rose-900 border-rose-500 text-rose-100 shadow-[0_0_12px_rgba(244,63,94,0.6)]'; } 
            else if (sq.includes('difes')) { tokenColors = 'bg-blue-900 border-blue-400 text-blue-100 shadow-[0_0_12px_rgba(59,130,246,0.6)]'; } 
            else if (sq.includes('support')) { tokenColors = 'bg-emerald-900 border-emerald-400 text-emerald-100 shadow-[0_0_12px_rgba(16,185,129,0.6)]'; } 
            else { tokenColors = 'bg-slate-700 border-cyan-400 text-slate-100 shadow-[0_0_10px_rgba(34,211,238,0.5)]'; }
          } else {
            tokenColors = 'bg-slate-800 border-cyan-500 text-cyan-100 scale-90';
          }

          const speedupsUsed = entity.speedupsUsed || 0;
          const hasSpeedup = speedupsUsed > 0;

          return (
            <div key={`map-entity-${entity.type}-${entity.id}-${index}`} title={hoverTitle} className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-[1000ms] ease-linear group pointer-events-auto ${popupPlayerId === entity.id ? 'z-[60]' : (isPlayer ? 'z-40 hover:z-50' : 'z-20 hover:z-30')}`} style={{ top: `calc(${getVisualTop(state.x, state.y)}% + ${offsetY}px)`, left: `calc(${getVisualLeft(state.x, state.y)}% + ${offsetX}px)` }}>
              <div onClick={(e) => { if(isPlayer && !isHealing) handleOpenPopup(e, entity.id); }} draggable={isPlayer && !isHealing} onDragStart={(e) => { if (isPlayer && !isHealing) e.dataTransfer.setData('text/plain', `player:${entity.id}`); }} className="relative w-12 h-12 flex items-center justify-center cursor-pointer hover:scale-125 transition-transform duration-200">
                {hasSpeedup && state.isMarching && <div className="absolute inset-0 bg-amber-400/40 rounded-full blur-md animate-ping pointer-events-none scale-75"></div>}
                <div className={`w-5 h-5 rounded-full border-[2px] flex items-center justify-center shadow-lg relative z-10 pointer-events-none ${tokenColors}`}>
                  <span className="absolute -top-4 text-[10px] font-bold text-white drop-shadow-[0_1px_1px_rgba(0,0,0,1)] tracking-wider">{isHealing ? '🏥' : tag}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {isEditorMode && (
        <div className="absolute inset-0 pointer-events-none z-[80]">
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            {buildings.map(b => {
              const currentHitbox = b.hitbox || { xMin: b.x - 2, xMax: b.x + 2, yMin: b.y - 2, yMax: b.y + 2 };
              const p1 = `${getVisualLeft(currentHitbox.xMin, currentHitbox.yMin)},${getVisualTop(currentHitbox.xMin, currentHitbox.yMin)}`;
              const p2 = `${getVisualLeft(currentHitbox.xMax, currentHitbox.yMin)},${getVisualTop(currentHitbox.xMax, currentHitbox.yMin)}`;
              const p3 = `${getVisualLeft(currentHitbox.xMax, currentHitbox.yMax)},${getVisualTop(currentHitbox.xMax, currentHitbox.yMax)}`;
              const p4 = `${getVisualLeft(currentHitbox.xMin, currentHitbox.yMax)},${getVisualTop(currentHitbox.xMin, currentHitbox.yMax)}`;
              return <polygon key={`hitbox-overlay-bulk-${b.id}`} points={`${p1} ${p2} ${p3} ${p4}`} fill="rgba(245, 158, 11, 0.4)" stroke="#f59e0b" strokeWidth="0.5" strokeDasharray="1 1" />;
            })}
          </svg>
        </div>
      )}
    </div>
  );
};