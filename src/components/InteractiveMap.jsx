import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next'; // 🌍 Import i18n
import { getBasePosition, checkIsAtBuilding, isMarchGathering, getEntityDisplayState } from './mapUtils';
import { DispatchModal } from './DispatchModal';
import { GarrisonPopup } from './GarrisonPopup'; 

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
  handleGarrisonAction,
  isEditorMode,                  
  selectedBuildingForEdit,       
  setSelectedBuildingForEdit     
}) => {
  const { t } = useTranslation(); // 🌍 Hook traduzione
  
  const mapRef = useRef(null);
  const [popupPlayerId, setPopupPlayerId] = useState(null);
  const [popupBuildingId, setPopupBuildingId] = useState(null);
  const [marchAssignments, setMarchAssignments] = useState({});
  const [modalPos, setModalPos] = useState({ x: 20, y: 20 });
  const [isDraggingModal, setIsDraggingModal] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const [showManualPanel, setShowManualPanel] = useState(false);
  const [manualPlayerId, setManualPlayerId] = useState('');
  const [manualX, setManualX] = useState('');
  const [manualY, setManualY] = useState('');

  const handleManualPositioning = () => {
    if (manualPlayerId && manualX !== '' && manualY !== '' && onUpdatePosition) {
      onUpdatePosition(`player:${manualPlayerId}`, parseFloat(manualX), parseFloat(manualY));
      setManualX('');
      setManualY('');
    }
  };

  const handleBuildingClick = (e, buildingId) => { 
    e.stopPropagation(); 
    
    if (isEditorMode && setSelectedBuildingForEdit) {
      setSelectedBuildingForEdit(buildingId);
      return;
    }

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
          
          let leaderName = t('interactive_map.unknown');
          if (entity.type === 'player') {
            leaderName = entity.name || entity.tag || t('interactive_map.single');
          } else if (entity.type === 'march') {
            const leader = activeDeployment.find(p => String(p.id) === String(entity.leaderId));
            leaderName = leader ? `${leader.name || leader.tag} (M)` : t('interactive_map.march');
            
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
            entity: entity 
          });
        }
      }
    });
    return { capturedBuildingIds: captured, buildingGarrisons: garrisons };
  }, [activeDeployment, marches, draftPositions, buildings, currentTime, healingEvents, teamBase, t]);

  const getPlayersInBuilding = (bId) => {
    const players = [];
    const garrisonEntities = buildingGarrisons[bId] || [];
    
    garrisonEntities.forEach(g => {
      const entity = g.entity;
      if (entity.type === 'player') {
        players.push({ id: entity.id, name: entity.name || entity.tag || t('interactive_map.single'), isLeader: true });
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
      className={`w-full h-full relative flex items-center justify-center overflow-hidden rounded-2xl border ${isEditorMode ? 'border-amber-500/80 shadow-[0_0_30px_rgba(245,158,11,0.2)]' : 'border-slate-700/50'} bg-slate-900`}
      onClick={() => { setPopupPlayerId(null); setPopupBuildingId(null); setMarchAssignments({}); if(isEditorMode && setSelectedBuildingForEdit) setSelectedBuildingForEdit(''); }}
      onPointerMove={handlePointerMoveMap}
      onPointerUp={handlePointerUpMap}
      onPointerLeave={handlePointerUpMap}
    >
      <div className="absolute inset-0 opacity-60 blur-[40px] scale-110 pointer-events-none z-0" style={{ backgroundImage: "url('/map-bg.png')", backgroundSize: 'cover', backgroundPosition: 'center' }}></div>

      {!isEditorMode && (
        <div className="absolute top-4 left-4 z-[110]" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => setShowManualPanel(!showManualPanel)}
            className="bg-slate-800 text-cyan-400 p-2 rounded-lg border border-cyan-500/50 shadow-lg hover:bg-slate-700 hover:border-cyan-400 transition-all font-bold text-sm flex items-center gap-2"
          >
            {showManualPanel ? t('interactive_map.close_panel') : t('interactive_map.move_marker')}
          </button>

          {showManualPanel && (
            <div className="mt-2 bg-slate-800/95 p-4 rounded-xl border border-slate-600 shadow-2xl flex flex-col gap-3 w-64 backdrop-blur-sm">
              <h3 className="text-cyan-400 font-bold text-xs uppercase border-b border-slate-700 pb-1 tracking-wider">{t('interactive_map.manual_coords')}</h3>
              <select className="bg-slate-900 border border-slate-600 text-slate-200 rounded p-2 text-sm focus:border-cyan-500 outline-none w-full" value={manualPlayerId} onChange={(e) => setManualPlayerId(e.target.value)}>
                <option value="">{t('interactive_map.select_player')}</option>
                {activeDeployment?.map(p => ( <option key={p.id} value={p.id}>{p.name || p.tag || `${t('interactive_map.player')} ${p.id}`}</option> ))}
              </select>
              <div className="flex gap-2">
                <input type="number" placeholder="X" className="bg-slate-900 border border-slate-600 text-slate-200 rounded p-2 text-sm w-full focus:border-cyan-500 outline-none" value={manualX} onChange={(e) => setManualX(e.target.value)} />
                <input type="number" placeholder="Y" className="bg-slate-900 border border-slate-600 text-slate-200 rounded p-2 text-sm w-full focus:border-cyan-500 outline-none" value={manualY} onChange={(e) => setManualY(e.target.value)} />
              </div>
              <button onClick={handleManualPositioning} disabled={!manualPlayerId || manualX === '' || manualY === ''} className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold py-2 rounded">{t('interactive_map.teleport_btn')}</button>
            </div>
          )}
        </div>
      )}

      {isEditorMode && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-amber-500/90 text-slate-900 font-bold px-4 py-2 rounded-lg z-[110] shadow-xl animate-pulse">
          {t('interactive_map.editor_mode_active')}
        </div>
      )}

      <div className="relative z-10 inline-block border-8 border-slate-800/90 rounded-[2rem] shadow-[0_30px_60px_rgba(0,0,0,0.9)] overflow-hidden ring-1 ring-slate-600/50" onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>
        <img src="/map-bg.png" alt="Mappa Tattica" className="max-w-full max-h-[85vh] w-auto block object-contain pointer-events-none" />

        <div className="absolute inset-0 pointer-events-none">
          <svg className="absolute inset-0 w-full h-full z-[14]" viewBox="0 0 100 100" preserveAspectRatio="none">
            <polygon points={`${getVisualLeft(0, 200)},${getVisualTop(0, 200)} ${getVisualLeft(38, 200)},${getVisualTop(38, 200)} ${getVisualLeft(39, 239)},${getVisualTop(39, 239)}`} fill="rgba(34, 211, 238, 0.15)" stroke="rgba(34, 211, 238, 0.6)" strokeWidth="0.3" strokeDasharray="1 1" />
            <polygon points={`${getVisualLeft(200, 0)},${getVisualTop(200, 0)} ${getVisualLeft(200, 38)},${getVisualTop(200, 38)} ${getVisualLeft(239, 39)},${getVisualTop(239, 39)}`} fill="rgba(248, 113, 113, 0.15)" stroke="rgba(248, 113, 113, 0.6)" strokeWidth="0.3" strokeDasharray="1 1" />
            
            {isEditorMode && buildings.map(b => {
              const currentHitbox = b.hitbox || { xMin: b.x - 2, xMax: b.x + 2, yMin: b.y - 2, yMax: b.y + 2 };
              const isSelected = selectedBuildingForEdit === b.id;
              
              if (isSelected) return null;

              const p1 = `${getVisualLeft(currentHitbox.xMin, currentHitbox.yMin)},${getVisualTop(currentHitbox.xMin, currentHitbox.yMin)}`;
              const p2 = `${getVisualLeft(currentHitbox.xMax, currentHitbox.yMin)},${getVisualTop(currentHitbox.xMax, currentHitbox.yMin)}`;
              const p3 = `${getVisualLeft(currentHitbox.xMax, currentHitbox.yMax)},${getVisualTop(currentHitbox.xMax, currentHitbox.yMax)}`;
              const p4 = `${getVisualLeft(currentHitbox.xMin, currentHitbox.yMax)},${getVisualTop(currentHitbox.xMin, currentHitbox.yMax)}`;
              
              return (
                <polygon 
                  key={`hitbox-bg-${b.id}`} 
                  points={`${p1} ${p2} ${p3} ${p4}`} 
                  fill="rgba(34, 211, 238, 0.15)" 
                  stroke="#22d3ee" 
                  strokeWidth="0.3"
                  strokeDasharray="2 2"
                />
              );
            })}
          </svg>

          {!isEditorMode && (
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
                    x1={`${getVisualLeft(state.startX, state.startY)}%`} y1={`${getVisualTop(state.startX, state.startY)}%`} 
                    x2={`${getVisualLeft(state.targetX, state.targetY)}%`} y2={`${getVisualTop(state.targetX, state.targetY)}%`}
                    stroke={strokeColor} strokeWidth="2" strokeDasharray="4 4" className="opacity-60 animate-pulse pointer-events-none"
                  />
                );
              })}
            </svg>
          )}
        </div>

        <div className="absolute inset-0">
          {buildings.map((building) => {
            const top = building.y ? `${getVisualTop(building.x, building.y)}%` : '50%';
            const left = building.x ? `${getVisualLeft(building.x, building.y)}%` : '50%';
            
            const isCaptured = capturedBuildingIds.has(building.id);
            const garrison = buildingGarrisons[building.id] || [];
            const hasGarrison = garrison.length > 0;
            const isBottomHalf = building.y && (building.x + building.y) < CENTER_SUM; 
            const tooltipPositionClass = isBottomHalf ? 'bottom-full mb-2' : 'top-full mt-2';
            
            const isSelectedEditor = isEditorMode && selectedBuildingForEdit === building.id;

            return (
              <div key={building.id} className={`absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group cursor-pointer ${popupBuildingId === building.id || isSelectedEditor ? 'z-[60]' : 'z-20 hover:z-40'}`} style={{ top, left }} onClick={(e) => handleBuildingClick(e, building.id)}>
                <div className={`transition-all duration-300 ${isEditorMode ? 'hover:scale-105' : 'group-hover:scale-110'} relative`}>
                  
                  {isSelectedEditor && <div className="absolute -inset-4 bg-amber-500/20 rounded-full blur-md animate-pulse pointer-events-none"></div>}
                  {isCaptured && !isEditorMode && <div className="absolute inset-0 bg-cyan-500/20 rounded-full blur-md animate-pulse pointer-events-none"></div>}
                  {hasGarrison && !isEditorMode && (
                    <div className="absolute -top-1 -right-2 z-[70] flex flex-col items-center pointer-events-none"><div className="text-xl drop-shadow-md animate-pulse">🚩</div></div>
                  )}

                  <div className="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center relative z-10 pointer-events-none" style={{ transform: `scale(${building.scale || 1})` }}>
                    {building.icon ? <img src={building.icon} alt={building.name} className="w-full h-full object-contain drop-shadow-xl pointer-events-none" /> : <div className="text-cyan-400 drop-shadow-lg"><CastleIcon /></div>}
                  </div>
                </div>

                {!isEditorMode && popupBuildingId !== building.id && (
                  <div className={`absolute ${tooltipPositionClass} bg-slate-800/95 px-3 py-2 rounded-lg text-xs font-bold text-slate-200 border border-slate-600 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-[100] shadow-xl flex flex-col gap-1`}>
                    <div className="text-cyan-400 uppercase text-center">{building.name}</div>
                    {hasGarrison && (
                      <div className="flex flex-col gap-1 border-t border-slate-700 pt-1 mt-0.5">
                        <div className="text-amber-400 uppercase text-[9px] text-center tracking-widest">{t('interactive_map.in_garrison')}</div>
                        {garrison.map((g, idx) => ( <div key={`${g.id}-${idx}`} className="flex items-center gap-1.5 text-[11px]"><span>{g.marchType === 'difesa' ? '🛡️' : g.marchType === 'supporto' ? '🤝' : '⚔️'}</span><span>{g.leaderName}</span></div> ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {popupBuildingId && !isEditorMode && (
            <GarrisonPopup building={buildings.find(b => b.id === popupBuildingId)} garrisonedPlayers={getPlayersInBuilding(popupBuildingId)} onClose={() => setPopupBuildingId(null)} handleGarrisonAction={handleGarrisonAction} />
          )}

          {!isEditorMode && allMapEntities.map((entity, index) => {
            const state = getEntityDisplayState(entity, currentTime, draftPositions, healingEvents, teamBase, buildings);
            if (!state.isVisible || state.isGarrisoned) return null; 

            const isPlayer = entity.type === 'player';
            const isRallyAmmassamento = !isPlayer && entity.marchType === 'rally' && isMarchGathering(entity, currentTime);
            if (isRallyAmmassamento) return null;

            let isGatheringLeader = false;
            if (isPlayer) isGatheringLeader = allMapEntities.some(m => m.type === 'march' && m.leaderId === entity.id && m.marchType === 'rally' && isMarchGathering(m, currentTime));

            const leader = isPlayer ? entity : activeDeployment.find(p => String(p.id) === String(entity.leaderId));
            const isHealing = state.isHealing;
            const typeIcon = state.marchType === 'difesa' ? '🛡️' : state.marchType === 'supporto' ? '🤝' : '⚔️';
            const tag = isPlayer ? (entity.tag || '?') : (leader ? `${leader.tag} ${typeIcon}` : 'M');
            
            const hoverTitle = isPlayer 
              ? (entity.name || entity.tag || `${t('interactive_map.player')} ${entity.id}`) 
              : (leader ? (leader.name || leader.tag || `${t('interactive_map.march_of')} ${leader.id}`) : t('interactive_map.march'));

            let offsetX = 0, offsetY = 0;
            if (!isPlayer && !state.isMarching) {
              const visibleLeaderMarches = allMapEntities.filter(e => e.leaderId === entity.leaderId && e.type === 'march' && !(e.marchType === 'rally' && isMarchGathering(e, currentTime)));
              const mIdx = visibleLeaderMarches.findIndex(m => m.id === entity.id);
              if (mIdx !== -1) {
                  const angle = (mIdx * (Math.PI * 2 / 6)) + (Math.PI / 4); 
                  offsetX = Math.round(Math.cos(angle) * 18); offsetY = Math.round(Math.sin(angle) * 18);
              }
            }

            let tokenColors = isHealing ? 'bg-emerald-800 border-emerald-400 text-emerald-100' : 
                              (state.marchType === 'rally_join' || isGatheringLeader || (!isPlayer && state.marchType === 'rally')) ? 'bg-amber-600 border-amber-300 text-amber-50 shadow-[0_0_10px_rgba(217,119,6,0.6)]' : 
                              isPlayer ? 'bg-slate-700 border-cyan-400 text-slate-100' : 'bg-slate-800 border-cyan-500 text-cyan-100 scale-90'; 

            const speedupsUsed = entity.speedupsUsed || 0;
            const hasSpeedup = speedupsUsed > 0;

            return (
              <div 
                key={`map-entity-${entity.type}-${entity.id}-${index}`} 
                title={hoverTitle} 
                className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-[1000ms] ease-linear group ${popupPlayerId === entity.id ? 'z-[60]' : (isPlayer ? 'z-40 hover:z-50' : 'z-20 hover:z-30')}`} 
                style={{ top: `calc(${getVisualTop(state.x, state.y)}% + ${offsetY}px)`, left: `calc(${getVisualLeft(state.x, state.y)}% + ${offsetX}px)` }}
              >
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

        {isEditorMode && selectedBuildingForEdit && (
          <div className="absolute inset-0 pointer-events-none z-[80]">
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              {buildings.filter(b => b.id === selectedBuildingForEdit).map(b => {
                const currentHitbox = b.hitbox || { xMin: b.x - 2, xMax: b.x + 2, yMin: b.y - 2, yMax: b.y + 2 };
                
                const p1 = `${getVisualLeft(currentHitbox.xMin, currentHitbox.yMin)},${getVisualTop(currentHitbox.xMin, currentHitbox.yMin)}`;
                const p2 = `${getVisualLeft(currentHitbox.xMax, currentHitbox.yMin)},${getVisualTop(currentHitbox.xMax, currentHitbox.yMin)}`;
                const p3 = `${getVisualLeft(currentHitbox.xMax, currentHitbox.yMax)},${getVisualTop(currentHitbox.xMax, currentHitbox.yMax)}`;
                const p4 = `${getVisualLeft(currentHitbox.xMin, currentHitbox.yMax)},${getVisualTop(currentHitbox.xMin, currentHitbox.yMax)}`;
                
                return (
                  <polygon 
                    key={`hitbox-overlay-${b.id}`} 
                    points={`${p1} ${p2} ${p3} ${p4}`} 
                    fill="rgba(245, 158, 11, 0.4)" 
                    stroke="#f59e0b" 
                    strokeWidth="0.8"
                  />
                );
              })}
            </svg>
          </div>
        )}
      </div>

      {popupPlayerId && !isEditorMode && (
        <DispatchModal activePlayer={allMapEntities.find(e => e.id === popupPlayerId && e.type === 'player')} activeDeployment={activeDeployment} marchAssignments={marchAssignments} setMarchAssignments={setMarchAssignments} setPopupPlayerId={setPopupPlayerId} handleConfirmDispatch={handleConfirmDispatch} modalPos={modalPos} setModalPos={setModalPos} isDraggingModal={isDraggingModal} setIsDraggingModal={setIsDraggingModal} dragOffset={dragOffset} setDragOffset={setDragOffset} buildings={buildings} getAvailableMarches={getAvailableMarches} healingEvents={healingEvents} currentTime={currentTime} handlePointerDownModal={handlePointerDownModal} handleHeal={handleHeal} handleCancelHeal={handleCancelHeal} />
      )}
    </div>
  );
};