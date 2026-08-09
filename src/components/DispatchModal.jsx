import React from 'react';
import { useTranslation } from 'react-i18next'; // 🌍 Import i18n
import { getEntityDisplayState, getBasePosition } from './mapUtils';

export const DispatchModal = ({
  activePlayer,
  activeDeployment,
  marchAssignments,
  setMarchAssignments,
  setPopupPlayerId,
  handleConfirmDispatch,
  modalPos,
  setModalPos,
  isDraggingModal,
  setIsDraggingModal,
  dragOffset,
  setDragOffset,
  buildings,
  getAvailableMarches,
  healingEvents,
  currentTime,
  handlePointerDownModal,
  draftPositions = {},
  teamBase = 'blue',
  handleHeal,
  handleCancelHeal
}) => {
  const { t } = useTranslation(); // 🌍 Hook di traduzione
  
  if (!activePlayer) return null;

  const healStart = healingEvents[activePlayer.id];
  const isHealing = healStart !== undefined && currentTime >= healStart && currentTime < healStart + 12;
  const healRemaining = isHealing ? (healStart + 12) - currentTime : 0;

  const currentState = getEntityDisplayState(
    { ...activePlayer, type: 'player' }, 
    currentTime, 
    draftPositions, 
    healingEvents, 
    teamBase, 
    buildings
  );
  const currentX = currentState.x !== undefined ? currentState.x.toFixed(1) : '0.0';
  const currentY = currentState.y !== undefined ? currentState.y.toFixed(1) : '0.0';

  const updateMarchAssignment = (marchIdx, field, value) => {
    setMarchAssignments(prev => {
      const current = prev[marchIdx] || { buildingId: '', type: 'attacco', members: [] };
      return { ...prev, [marchIdx]: { ...current, [field]: value } };
    });
  };

  const calculateTravelTime = (buildingId) => {
    if (!buildingId || !activePlayer || !teamBase) return null;
    
    const targetBuilding = buildings.find(b => String(b.id) === String(buildingId));
    if (!targetBuilding) return null;

    const randomBase = getBasePosition(String(activePlayer.id), teamBase);
    
    const REFERENCE_POINTS = { blue: { x: 38, y: 200 }, red: { x: 200, y: 38 } };
    
    let startX = currentState.x;
    let startY = currentState.y;

    if (Math.abs(startX - randomBase.x) < 0.1 && Math.abs(startY - randomBase.y) < 0.1) {
      startX = REFERENCE_POINTS[teamBase].x;
      startY = REFERENCE_POINTS[teamBase].y;
    }
    
    const dxPlayer = targetBuilding.x - startX;
    const dyPlayer = targetBuilding.y - startY;
    const playerToTargetDist = Math.sqrt(dxPlayer * dxPlayer + dyPlayer * dyPlayer);

    const refPoint = REFERENCE_POINTS[teamBase];
    const dxRef = targetBuilding.x - refPoint.x;
    const dyRef = targetBuilding.y - refPoint.y;
    const refToTargetDist = Math.sqrt(dxRef * dxRef + dyRef * dyRef);

    const tableTimeSec = teamBase === 'blue' ? (targetBuilding.travelTimeBlue || 60) : (targetBuilding.travelTimeRed || 60);
    const speed = refToTargetDist / Math.max(1, tableTimeSec);
    
    const travelTimeMins = (playerToTargetDist / speed) / 60;
    
    const m = Math.floor(travelTimeMins);
    const s = Math.round((travelTimeMins - m) * 60);
    return `${m}m ${s < 10 ? '0' : ''}${s}s`;
  };

  const availablePlayers = activeDeployment.filter(p => 
    String(p.id) !== String(activePlayer.id) && 
    getAvailableMarches(p.id) > 0 &&
    !(healingEvents[p.id] !== undefined && currentTime >= healingEvents[p.id] && currentTime < healingEvents[p.id] + 12)
  );

  return (
    <div 
      className={`absolute backdrop-blur-md border rounded-lg shadow-[0_10px_40px_rgba(0,0,0,0.8)] z-[200] flex flex-col overflow-hidden w-[190px] select-none transition-colors duration-300 ${isHealing ? 'bg-emerald-950/95 border-emerald-600/50' : 'bg-slate-800/95 border-slate-600'}`}
      style={{ left: `${modalPos.x}px`, top: `${modalPos.y}px` }}
      onClick={(e) => e.stopPropagation()} 
    >
      <div 
        className={`flex justify-between items-center p-1.5 border-b shrink-0 ${isDraggingModal ? 'cursor-grabbing' : 'cursor-grab'} ${isHealing ? 'border-emerald-700/50 bg-emerald-900/80 hover:bg-emerald-800/80' : 'border-slate-700 bg-slate-900/80 hover:bg-slate-900'} transition-colors`}
        onPointerDown={handlePointerDownModal}
      >
        <div className={`font-bold text-[9px] uppercase flex items-center gap-1.5 pointer-events-none ${isHealing ? 'text-emerald-300' : 'text-cyan-400'}`}>
          <span>{isHealing ? '🏥' : '📋'}</span> 
          {isHealing ? t('dispatch_modal.healing_status', { time: healRemaining }) : `${t('dispatch_modal.orders')} ${activePlayer.name || activePlayer.tag || activePlayer.id}`}
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); setPopupPlayerId(null); setMarchAssignments({}); }}
          onPointerDown={(e) => e.stopPropagation()}
          className="text-slate-400 hover:text-red-400 transition-colors w-4 h-4 flex items-center justify-center rounded-full hover:bg-slate-700 z-10 text-[8px]"
          title={t('dispatch_modal.close')}
        >
          ✕
        </button>
      </div>

      <div className="px-2 py-1 bg-slate-900/80 border-b border-slate-700 flex justify-between items-center text-[9px]">
        <span className="text-slate-400">{t('dispatch_modal.position')}</span>
        <span className="text-cyan-400 font-mono font-bold">X: {currentX} | Y: {currentY}</span>
      </div>

      {isHealing ? (
        <div className="p-3 text-center flex flex-col gap-2">
          <span className="text-emerald-400 text-[10px] font-bold animate-pulse">
            {t('dispatch_modal.recovering_pt1')} <br/> {t('dispatch_modal.recovering_pt2')}
          </span>
          <button 
            onClick={(e) => { e.stopPropagation(); handleCancelHeal(e, activePlayer.id); }}
            className="bg-slate-800 hover:bg-red-700 text-white text-[9px] py-1.5 px-2 rounded border border-slate-600 transition-colors mt-1"
          >
            {t('dispatch_modal.stop_healing')}
          </button>
        </div>
      ) : (
        <>
          <div className="p-1.5 border-b border-slate-700/50 bg-slate-800/50">
            <button 
              onClick={(e) => { 
                e.stopPropagation(); 
                handleHeal(activePlayer.id); 
              }}
              className="w-full bg-emerald-900/40 hover:bg-emerald-700 text-emerald-200 border border-emerald-500/50 text-[9px] font-bold py-1.5 rounded transition-all shadow-sm flex items-center justify-center gap-1"
            >
              {t('dispatch_modal.send_heal')}
            </button>
          </div>
          
          <div className="max-h-[55vh] overflow-y-auto p-1.5 flex flex-col gap-1.5 scrollbar-thin">
            {Array.from({ length: getAvailableMarches(activePlayer.id) }).map((_, i) => {
              const marchIdx = i + 1;
              const currentAssign = marchAssignments[marchIdx] || { buildingId: '', type: 'attacco', members: [] };
              const assignedMembers = currentAssign.members || [];

              return (
                <div key={`march-assign-${marchIdx}`} className="flex flex-col gap-1 bg-slate-700/30 p-1.5 rounded border border-slate-600/50">
                  <div className="flex justify-between items-center">
                    <span className="text-cyan-300 text-[8px] font-bold tracking-wider uppercase">{t('dispatch_modal.march')} {marchIdx}</span>
                    {assignedMembers.length > 0 && <span className="text-[8px] text-slate-400">{assignedMembers.length + 1}/10</span>}
                  </div>
                  
                  <div className="flex flex-col gap-1">
                    <select 
                      className="w-full bg-slate-900 border border-slate-700 rounded-sm p-0.5 text-[9px] text-slate-200 outline-none focus:border-cyan-500 cursor-pointer"
                      value={currentAssign.buildingId} 
                      onChange={(e) => updateMarchAssignment(marchIdx, 'buildingId', e.target.value)}
                    >
                      <option value="">{t('dispatch_modal.no_target')}</option>
                      {buildings.map(b => (<option key={b.id} value={b.id}>{b.name}</option>))}
                    </select>

                    {currentAssign.buildingId && (
                      <div className="text-cyan-300 text-[9px] font-semibold flex items-center gap-1 bg-slate-900/50 p-1 rounded border border-slate-700">
                        {t('dispatch_modal.arriving_in')} {calculateTravelTime(currentAssign.buildingId)}
                      </div>
                    )}
                    
                    <select 
                      className="w-full bg-slate-900 border border-slate-700 rounded-sm p-0.5 text-[9px] text-slate-200 outline-none focus:border-cyan-500 cursor-pointer"
                      value={currentAssign.type} 
                      onChange={(e) => updateMarchAssignment(marchIdx, 'type', e.target.value)}
                    >
                      <option value="attacco">{t('dispatch_modal.attack')}</option>
                      <option value="difesa">{t('dispatch_modal.defense')}</option>
                      <option value="supporto">{t('dispatch_modal.support')}</option>
                      <option value="rally">{t('dispatch_modal.call_rally')}</option>
                    </select>
                    
                    {assignedMembers.length > 0 && (
                      <div className="flex flex-col gap-1.5 mt-2 bg-slate-900/50 p-1.5 rounded border border-slate-700">
                        <div className="text-[8px] text-slate-400 uppercase tracking-widest font-bold border-b border-slate-700 pb-1">
                          {currentAssign.type === 'rally' ? t('dispatch_modal.rally_members') : t('dispatch_modal.members')}
                        </div>
                        
                        {assignedMembers.map((memObj) => {
                            const isObj = typeof memObj === 'object';
                            const memId = isObj ? memObj.id : memObj;
                            const memSpeedups = isObj ? (memObj.speedups || 0) : 0;
                            const memBaseTime = isObj ? (memObj.baseTime || 0) : 0;
                            
                            const mem = activeDeployment.find(p => String(p.id) === String(memId));
                            const currentTimeCalc = memBaseTime * Math.pow(0.75, memSpeedups);
                            const isTooSlow = currentAssign.type === 'rally' && currentTimeCalc > 4.0;

                            return (
                              <div key={memId} className={`text-[9px] bg-slate-800 border ${isTooSlow ? 'border-red-500/50' : 'border-slate-600'} text-slate-300 px-1.5 py-1 rounded flex flex-col gap-1`}>
                                <div className="flex items-center justify-between">
                                  <span className="font-bold flex items-center gap-1">
                                    {mem?.name || mem?.tag || `Player ${memId}`}
                                    {memSpeedups > 0 && <span className="text-amber-400 text-[8px]">⚡x{memSpeedups}</span>}
                                  </span>
                                  <button 
                                    onClick={(e) => { 
                                      e.stopPropagation(); 
                                      updateMarchAssignment(marchIdx, 'members', assignedMembers.filter(m => String(typeof m === 'object' ? m.id : m) !== String(memId))); 
                                    }} 
                                    className="text-red-400 hover:text-red-300 font-bold leading-none"
                                  >
                                    ✕
                                  </button>
                                </div>

                                {currentAssign.type === 'rally' && (
                                  <div className="flex items-center justify-between border-t border-slate-700 pt-1">
                                    <span className={`${isTooSlow ? 'text-red-400 font-bold' : 'text-slate-400'}`}>
                                      {t('dispatch_modal.arrival')} {currentTimeCalc.toFixed(1)}m
                                    </span>
                                    
                                    {isTooSlow ? (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const updatedMembers = assignedMembers.map(m => {
                                            if (String(typeof m === 'object' ? m.id : m) === String(memId)) {
                                              return { 
                                                id: memId, 
                                                baseTime: memBaseTime,
                                                speedups: memSpeedups + 1 
                                              };
                                            }
                                            return m;
                                          });
                                          updateMarchAssignment(marchIdx, 'members', updatedMembers);
                                        }}
                                        className="bg-amber-600 hover:bg-amber-500 text-white text-[8px] px-1.5 py-0.5 rounded flex items-center gap-1 cursor-pointer transition-colors"
                                      >
                                        {t('dispatch_modal.use_speedup')}
                                      </button>
                                    ) : (
                                      <span className="text-emerald-400 text-[8px]">{t('dispatch_modal.on_time')}</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            )
                        })}
                      </div>
                    )}

                    {availablePlayers.length > 0 && assignedMembers.length < 9 && (
                      <select
                        className="w-full bg-slate-900 border border-slate-700 rounded-sm p-0.5 text-[8px] text-slate-400 outline-none focus:border-cyan-500 cursor-pointer mt-1"
                        value=""
                        onChange={(e) => {
                          const targetId = e.target.value;
                          
                          const leaderEntity = { ...activePlayer, type: 'player' };
                          const memRaw = activeDeployment.find(ent => String(ent.id) === String(targetId));
                          
                          if (!memRaw) return; 

                          const memEntity = { ...memRaw, type: 'player' };

                          const leaderState = getEntityDisplayState(leaderEntity, currentTime, draftPositions, healingEvents, teamBase, buildings);
                          const memState = getEntityDisplayState(memEntity, currentTime, draftPositions, healingEvents, teamBase, buildings);
                          
                          const dist = Math.sqrt(Math.pow(leaderState.x - memState.x, 2) + Math.pow(leaderState.y - memState.y, 2));
                          
                          const targetBuilding = buildings.find(b => String(b.id) === String(currentAssign.buildingId));
                          let calculatedBaseTime = 0;
                          
                          if (targetBuilding) {
                            const REFERENCE_POINTS = { blue: { x: 38, y: 200 }, red: { x: 200, y: 38 } };
                            const refPoint = REFERENCE_POINTS[teamBase];
                            const dxRef = targetBuilding.x - refPoint.x;
                            const dyRef = targetBuilding.y - refPoint.y;
                            const refToTargetDist = Math.sqrt(dxRef * dxRef + dyRef * dyRef);
                            
                            const tableTimeSec = teamBase === 'blue' ? (targetBuilding.travelTimeBlue || 60) : (targetBuilding.travelTimeRed || 60);
                            const speed = refToTargetDist / Math.max(1, tableTimeSec);
                            
                            calculatedBaseTime = (dist / speed) / 60;
                          }
                          
                          const newMembers = [...assignedMembers, { 
                            id: targetId, 
                            speedups: 0, 
                            baseTime: calculatedBaseTime 
                          }];
                          updateMarchAssignment(marchIdx, 'members', newMembers);
                        }}
                      >
                        <option value="" disabled>{t('dispatch_modal.join_player')}</option>
                        {availablePlayers.filter(p => !assignedMembers.some(m => String(typeof m === 'object' ? m.id : m) === String(p.id))).map(p => (
                            <option key={p.id} value={p.id}>{p.name} ({p.tag})</option>
                        ))}
                      </select>
                    )}

                  </div>
                </div>
              )
            })}

            {getAvailableMarches(activePlayer.id) === 0 && (
              <div className="text-center text-slate-400 text-[9px] py-2 px-1 flex flex-col items-center gap-1">
                <span className="text-sm">⚠️</span>
                {t('dispatch_modal.all_assigned')}
              </div>
            )}
          </div>

          <div className="p-1.5 border-t border-slate-700 bg-slate-900/50 flex gap-1.5 shrink-0 mt-2">
            <button 
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-[9px] font-semibold py-1 rounded-sm transition-colors cursor-pointer" 
              onClick={() => { setPopupPlayerId(null); setMarchAssignments({}); }}
            >
              {t('dispatch_modal.cancel')}
            </button>
            <button 
              className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white text-[9px] font-bold py-1 rounded-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-md" 
              onClick={() => handleConfirmDispatch(activePlayer.id)} 
              disabled={
                Object.values(marchAssignments).filter(v => v.buildingId !== '').length === 0 ||
                Object.values(marchAssignments).some(march => 
                  march.type === 'rally' && march.members?.some(m => {
                    const bTime = typeof m === 'object' ? (m.baseTime || 0) : 0;
                    const sUps = typeof m === 'object' ? (m.speedups || 0) : 0;
                    return (bTime * Math.pow(0.75, sUps)) > 4.0;
                  })
                )
              }
            >
              {t('dispatch_modal.send_orders')}
            </button>
          </div>
        </>
      )}
    </div>
  );
};