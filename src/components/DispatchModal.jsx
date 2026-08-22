import React from 'react';
import { useTranslation } from 'react-i18next'; 
import { getEntityDisplayState, getBasePosition } from './mapUtils';

export const DispatchModal = ({
  activePlayer, activeDeployment, marchAssignments, setMarchAssignments, setPopupPlayerId,
  handleConfirmDispatch, buildings, getAvailableMarches, healingEvents, currentTime,
  draftPositions = {}, teamBase = 'blue', handleHeal, handleCancelHeal,
  lootDrops = [], marches = [], buildingStates = {} 
}) => {
  const { t } = useTranslation(); 
  
  if (!activePlayer) return null;

  const healStart = healingEvents[activePlayer.id];
  const isHealing = healStart !== undefined && currentTime >= healStart && currentTime < healStart + 12;
  const healRemaining = isHealing ? (healStart + 12) - currentTime : 0;

  const currentState = getEntityDisplayState(
    { ...activePlayer, type: 'player' }, currentTime, draftPositions, healingEvents, teamBase, buildings
  );
  const currentX = currentState.x !== undefined ? currentState.x.toFixed(1) : '0.0';
  const currentY = currentState.y !== undefined ? currentState.y.toFixed(1) : '0.0';

  const isLoot = (targetId) => lootDrops.some(l => String(l.id) === String(targetId));
  const isBuildingOwned = (targetId) => buildingStates[targetId]?.owner === teamBase;

  const getClaimedLootIds = () => {
    const claimed = new Set();
    Object.entries(marchAssignments).forEach(([idx, ma]) => {
       if (ma.type === 'raccolta' && ma.buildingId) claimed.add(String(ma.buildingId));
    });
    Object.values(draftPositions).forEach(d => {
       if (d.marchType === 'raccolta' && d.targetBuildingId) claimed.add(String(d.targetBuildingId));
    });
    const checkActive = (entity) => {
       if (!entity.positions) return;
       Object.values(entity.positions).forEach(pos => {
          if (pos.targetBuildingId && pos.marchType === 'raccolta' && !pos.removed) {
             if (pos.arrivalTime >= currentTime || pos.startTime <= currentTime) {
                 claimed.add(String(pos.targetBuildingId));
             }
          }
       });
    };
    activeDeployment.forEach(checkActive);
    marches.forEach(checkActive);
    return claimed;
  };
  const claimedLoots = getClaimedLootIds();

  const handleTargetChange = (marchIdx, newTargetId) => {
    const currentType = marchAssignments[marchIdx]?.type || 'attacco';
    let newType = currentType;
    
    if (isLoot(newTargetId)) {
        newType = 'raccolta';
    } else {
        if (newType === 'raccolta') newType = 'attacco';
        if (newType.startsWith('rally') && isBuildingOwned(newTargetId)) newType = 'attacco';
    }

    setMarchAssignments(prev => ({
      ...prev,
      [marchIdx]: { ...(prev[marchIdx] || { members: [] }), buildingId: newTargetId, type: newType }
    }));
  };

  const updateMarchAssignment = (marchIdx, field, value) => {
    setMarchAssignments(prev => {
      const current = prev[marchIdx] || { buildingId: '', type: 'attacco', members: [] };
      return { ...prev, [marchIdx]: { ...current, [field]: value } };
    });
  };

  const getTravelTimeMins = (buildingId) => {
    if (!buildingId || !activePlayer || !teamBase) return 0;
    const targetBuilding = buildings.find(b => String(b.id) === String(buildingId));
    const targetLoot = lootDrops.find(l => String(l.id) === String(buildingId));
    const targetObj = targetBuilding || targetLoot;
    if (!targetObj) return 0;

    const randomBase = getBasePosition(String(activePlayer.id), teamBase);
    const REFERENCE_POINTS = { blue: { x: 38, y: 200 }, red: { x: 200, y: 38 } };
    let startX = currentState.x;
    let startY = currentState.y;

    if (Math.abs(startX - randomBase.x) < 0.1 && Math.abs(startY - randomBase.y) < 0.1) {
      startX = REFERENCE_POINTS[teamBase].x;
      startY = REFERENCE_POINTS[teamBase].y;
    }
    
    const dxPlayer = targetObj.x - startX;
    const dyPlayer = targetObj.y - startY;
    const playerToTargetDist = Math.sqrt(dxPlayer * dxPlayer + dyPlayer * dyPlayer);

    const refPoint = REFERENCE_POINTS[teamBase];
    const dxRef = targetObj.x - refPoint.x;
    const dyRef = targetObj.y - refPoint.y;
    const refToTargetDist = Math.sqrt(dxRef * dxRef + dyRef * dyRef);

    const baseTableTime = targetBuilding ? (teamBase === 'blue' ? (targetBuilding.travelTimeBlue || 60) : (targetBuilding.travelTimeRed || 60)) : 60;
    const speed = refToTargetDist / Math.max(1, baseTableTime);
    
    return (playerToTargetDist / speed) / 60;
  };

  const calculateTravelTime = (buildingId) => {
    const travelTimeMins = getTravelTimeMins(buildingId);
    if (!travelTimeMins) return null;
    const m = Math.floor(travelTimeMins);
    const s = Math.round((travelTimeMins - m) * 60);
    return `${m}m ${s < 10 ? '0' : ''}${s}s`;
  };

  const isArrivalTooEarly = (marchAssign) => {
      if (!marchAssign.buildingId) return false;
      const targetB = buildings.find(b => String(b.id) === String(marchAssign.buildingId));
      if (!targetB || !(targetB.unlockTime > 0)) return false;
      
      const travelMins = getTravelTimeMins(marchAssign.buildingId);
      // 💡 CALCOLO DINAMICO DEL RITARDO
      const isRally = marchAssign.type.startsWith('rally');
      const rallyDelay = marchAssign.type === 'rally_1' ? 1 : (isRally ? 4 : 0);
      const arrTime = currentTime + rallyDelay + travelMins;
      
      return arrTime < targetB.unlockTime;
  };

  const availablePlayers = activeDeployment.filter(p => 
    String(p.id) !== String(activePlayer.id) && 
    getAvailableMarches(p.id) > 0 &&
    !(healingEvents[p.id] !== undefined && currentTime >= healingEvents[p.id] && currentTime < healingEvents[p.id] + 12)
  );

  const getActiveTasks = () => {
    const tasks = [];
    const pid = String(activePlayer.id);

    marches.forEach(m => {
      if (m.marchType === 'rally_join') return; 

      const isLeader = String(m.leader) === pid;
      const isMember = m.members && m.members.map(String).includes(pid);

      if (isLeader || isMember) {
        if (!m.positions) return;
        const mins = Object.keys(m.positions).map(Number).sort((a, b) => a - b);
        let curState = null;
        for (const min of mins) { if (min <= currentTime) curState = m.positions[min]; }

        if (curState && !curState.removed) {
          let tName = curState.targetName || 'Sconosciuto';
          if (curState.targetBuildingId) {
             const build = buildings.find(x => String(x.id) === String(curState.targetBuildingId));
             const loot = lootDrops.find(x => String(x.id) === String(curState.targetBuildingId));
             if (build) tName = build.name;
             if (loot) tName = loot.name;
          }

          let status = '';
          let icon = '⚔️';
          if (curState.marchType === 'ritirata') {
              status = `In ritirata alla Base`;
              icon = '🔙';
          } else if (curState.isMarching) {
              status = `In viaggio verso ${tName}`;
              icon = curState.marchType === 'raccolta' ? '⛏️' : '🚀';
          } else {
              status = `In presidio a ${tName}`;
              icon = '🚩';
          }

          tasks.push({
             id: m.id,
             role: isLeader ? (curState.marchType === 'rally' ? 'Leader Rally' : 'Leader') : 'Membro Rally',
             status,
             icon
          });
        }
      }
    });
    return tasks;
  };

  const activeTasks = getActiveTasks();

  return (
    <div className="flex flex-col h-full w-full select-none" onClick={(e) => e.stopPropagation()}>
      
      <div className={`flex justify-between items-center p-4 border-b shrink-0 ${isHealing ? 'border-emerald-700 bg-emerald-900/50' : 'border-slate-700 bg-slate-900'}`}>
        <div className={`font-black text-sm uppercase tracking-wider flex items-center gap-2 ${isHealing ? 'text-emerald-400' : 'text-cyan-400'}`}>
          <span className="text-lg">{isHealing ? '🏥' : '📋'}</span> 
          {isHealing ? t('dispatch_modal.healing_status', { time: healRemaining }) : `${t('dispatch_modal.orders')} ${activePlayer.name || activePlayer.tag || activePlayer.id}`}
        </div>
        <button onClick={(e) => { e.stopPropagation(); setPopupPlayerId(null); setMarchAssignments({}); }} className="text-slate-400 hover:text-red-400 transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-800 font-bold" title={t('dispatch_modal.close')}>✕</button>
      </div>

      <div className="px-4 py-2 bg-slate-950/90 border-b border-slate-700 flex justify-between items-center text-xs shrink-0 relative z-20">
        <span className="text-slate-400 font-bold uppercase tracking-wider">{t('dispatch_modal.position')}</span>
        <span className="text-cyan-400 font-mono font-black text-sm">X: {currentX} <span className="opacity-50 mx-1">|</span> Y: {currentY}</span>
      </div>

      {isHealing ? (
        <div className="p-6 text-center flex flex-col items-center justify-center gap-4 flex-1">
          <span className="text-emerald-400 text-sm font-black uppercase tracking-widest animate-pulse leading-relaxed">
            {t('dispatch_modal.recovering_pt1')} <br/> {t('dispatch_modal.recovering_pt2')}
          </span>
          <button onClick={(e) => { e.stopPropagation(); handleCancelHeal(e, activePlayer.id); }} className="bg-slate-800 hover:bg-red-700 text-white font-black uppercase tracking-wider text-xs py-3 px-6 rounded-xl border border-slate-600 transition-all mt-4 shadow-lg">
            {t('dispatch_modal.stop_healing')}
          </button>
        </div>
      ) : (
        <>
          <div className="p-3 border-b border-slate-700 bg-slate-900/95 flex gap-3 shrink-0 shadow-lg relative z-20">
            <button className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-black uppercase tracking-widest py-3 rounded-xl transition-colors cursor-pointer border border-slate-700" onClick={() => { setPopupPlayerId(null); setMarchAssignments({}); }}>
              {t('dispatch_modal.cancel')}
            </button>
            <button 
              className="flex-[2] bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-black uppercase tracking-widest py-3 rounded-xl transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(34,211,238,0.3)] disabled:shadow-none border border-cyan-500" 
              onClick={() => {
                handleConfirmDispatch(activePlayer.id);
                setMarchAssignments({}); 
                setPopupPlayerId(null);  
              }} 
              disabled={
                Object.values(marchAssignments).filter(v => v.buildingId !== '').length === 0 ||
                Object.values(marchAssignments).some(march => {
                  const isRally = march.type.startsWith('rally');
                  const rTime = march.type === 'rally_1' ? 1 : 4;
                  return isRally && march.members?.some(m => {
                    const bTime = typeof m === 'object' ? (m.baseTime || 0) : 0;
                    const sUps = typeof m === 'object' ? (m.speedups || 0) : 0;
                    return (bTime * Math.pow(0.75, sUps)) > rTime;
                  });
                }) ||
                Object.values(marchAssignments).some(isArrivalTooEarly) 
              }
            >
              🚀 {t('dispatch_modal.send_orders')}
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 custom-scrollbar bg-slate-900/20 relative z-0">
            
            {activeTasks.length > 0 && (
              <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-700/50 flex flex-col gap-2 shrink-0 shadow-inner">
                <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest flex items-center justify-between border-b border-slate-700/80 pb-1.5">
                  <span>📡 {t('dispatch_modal.active_deployments', 'Unità Dispiegate')}</span>
                  <span className="bg-cyan-900/50 text-cyan-400 px-2 py-0.5 rounded-md border border-cyan-700/50">{activeTasks.length} in corso</span>
                </div>
                <div className="flex flex-col gap-1.5 max-h-32 overflow-y-auto custom-scrollbar pr-1">
                  {activeTasks.map((task, idx) => (
                     <div key={idx} className="bg-slate-800/80 border border-slate-600 p-2 rounded-lg flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 text-slate-200 font-medium truncate">
                           <span className="text-sm drop-shadow-md">{task.icon}</span>
                           <span className="truncate">{task.status}</span>
                        </div>
                        <div className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 ${task.role.includes('Leader') ? 'bg-amber-900/50 text-amber-400 border border-amber-700/50' : 'bg-slate-700 text-slate-300'}`}>
                           {task.role}
                        </div>
                     </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pb-1 border-b border-slate-700/50">
              <button onClick={(e) => { e.stopPropagation(); handleHeal(activePlayer.id); }} className="w-full bg-emerald-900/40 hover:bg-emerald-700 text-emerald-200 border border-emerald-500/50 text-xs font-black uppercase tracking-widest py-2 rounded-xl transition-all shadow-md flex items-center justify-center gap-2">
                🏥 {t('dispatch_modal.send_heal')}
              </button>
            </div>

            {Array.from({ length: getAvailableMarches(activePlayer.id) }).map((_, i) => {
              const marchIdx = i + 1;
              const currentAssign = marchAssignments[marchIdx] || { buildingId: '', type: 'attacco', members: [] };
              const assignedMembers = currentAssign.members || [];
              
              const currentTargetId = currentAssign.buildingId;
              const targetIsLoot = currentTargetId ? isLoot(currentTargetId) : false;
              const targetIsOwned = currentTargetId ? isBuildingOwned(currentTargetId) : false;
              
              const earlyArrival = isArrivalTooEarly(currentAssign);
              const targetB = buildings.find(b => String(b.id) === String(currentTargetId));

              return (
                <div key={`march-assign-${marchIdx}`} className={`flex flex-col gap-2 bg-slate-800/60 p-3 rounded-2xl border shadow-sm transition-colors ${earlyArrival ? 'border-rose-500/80 shadow-[0_0_10px_rgba(244,63,94,0.3)]' : 'border-slate-600/50'}`}>
                  
                  <div className="flex justify-between items-center border-b border-slate-700/50 pb-2">
                    <span className="text-cyan-400 text-xs font-black tracking-widest uppercase flex items-center gap-2">
                      <div className="bg-cyan-500/20 px-2 py-0.5 rounded text-cyan-300 border border-cyan-500/30">M-{marchIdx}</div>
                      {t('dispatch_modal.march')}
                    </span>
                    {assignedMembers.length > 0 && <span className="text-xs font-bold text-slate-400 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-700">{assignedMembers.length + 1}/10</span>}
                  </div>
                  
                  <div className="flex flex-col gap-2.5 pt-1">
                    
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-400 uppercase font-bold ml-1">Destinazione</label>
                      <select 
                        className="w-full bg-slate-950 border border-slate-600 rounded-xl p-2.5 text-xs font-bold text-slate-200 outline-none focus:border-cyan-500 cursor-pointer shadow-inner"
                        value={currentAssign.buildingId} 
                        onChange={(e) => handleTargetChange(marchIdx, e.target.value)}
                      >
                        <option value="">{t('dispatch_modal.no_target', 'Nessuna Destinazione')}</option>
                        <optgroup label="Edifici">
                          {buildings.map(b => (
                             <option key={b.id} value={b.id}>
                               {b.name} {(b.unlockTime && b.unlockTime > 0) ? ` (Sblocca a ${b.unlockTime}')` : ''}
                               {buildingStates[b.id]?.owner === teamBase ? ' 🛡️ (Tuo)' : ''}
                             </option>
                          ))}
                        </optgroup>
                        
                        {lootDrops.length > 0 && (
                          <optgroup label="Bottino sul Campo">
                            {lootDrops.map(l => {
                              const isClaimedByOther = claimedLoots.has(String(l.id)) && String(currentTargetId) !== String(l.id);
                              return (
                                <option key={l.id} value={l.id} disabled={isClaimedByOther}>
                                  💎 {l.name} {isClaimedByOther ? '⛔ (Occupato)' : ''}
                                </option>
                              );
                            })}
                          </optgroup>
                        )}
                      </select>
                    </div>

                    {currentAssign.buildingId && (
                      <div className="text-cyan-300 text-xs font-black uppercase tracking-wider flex items-center justify-between bg-cyan-950/30 p-2.5 rounded-xl border border-cyan-800/50 shadow-inner">
                        <span>⏱️ {t('dispatch_modal.arriving_in')}</span>
                        <span className="text-cyan-100 bg-cyan-900/80 px-2 py-0.5 rounded">{calculateTravelTime(currentAssign.buildingId)}</span>
                      </div>
                    )}
                    
                    {earlyArrival && targetB && (
                        <div className="text-rose-400 bg-rose-950/50 p-2.5 rounded-xl border border-rose-800/50 text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-inner text-center leading-tight">
                            <span className="text-lg">🔒</span> Arrivo Anticipato!<br/>L'edificio apre al minuto {targetB.unlockTime}
                        </div>
                    )}
                    
                    <div className="flex flex-col gap-1 mt-1">
                      <label className="text-[10px] text-slate-400 uppercase font-bold ml-1">Azione</label>
                      <select 
                        className="w-full bg-slate-950 border border-slate-600 rounded-xl p-2.5 text-xs font-bold text-slate-200 outline-none focus:border-cyan-500 cursor-pointer shadow-inner"
                        value={currentAssign.type} 
                        onChange={(e) => updateMarchAssignment(marchIdx, 'type', e.target.value)}
                      >
                        {!targetIsLoot && (
                           <option value="attacco">{t('dispatch_modal.attack', 'Attacco / Presidio')}</option>
                        )}
                        
                        {(targetIsLoot || !currentTargetId) && (
                           <option value="raccolta">⛏️ {t('dispatch_modal.gather', 'Raccolta')}</option>
                        )}
                        
                        {!targetIsLoot && !targetIsOwned && (
                           <option value="rally_4">{t('dispatch_modal.call_rally', 'Ammassamento')}</option>
                        )}
                      </select>
                    </div>

                    {/* 💡 NUOVO MENU A TENDINA: Appare solo se selezioni il Rally! */}
                    {currentAssign.type.startsWith('rally') && (
                      <div className="flex flex-col gap-1 mt-1 border-t border-slate-700/50 pt-2 pb-1">
                        <label className="text-[10px] text-amber-400 uppercase font-bold ml-1 tracking-widest">⏱️ Durata Ammassamento</label>
                        <select 
                          className="w-full bg-slate-900 border border-amber-600/50 rounded-xl p-2 text-xs font-bold text-amber-400 outline-none focus:border-amber-400 cursor-pointer shadow-inner"
                          value={currentAssign.type} 
                          onChange={(e) => updateMarchAssignment(marchIdx, 'type', e.target.value)}
                        >
                          <option value="rally_4">4 Minuti (Standard)</option>
                          <option value="rally_1">1 Minuto (Rapido)</option>
                        </select>
                      </div>
                    )}
                    
                    {assignedMembers.length > 0 && (
                      <div className="flex flex-col gap-2 mt-2 bg-slate-900 p-2.5 rounded-xl border border-slate-700 shadow-inner">
                        <div className="text-[10px] text-slate-400 uppercase tracking-widest font-black border-b border-slate-700/80 pb-1.5 mb-1">
                          {currentAssign.type.startsWith('rally') ? t('dispatch_modal.rally_members') : t('dispatch_modal.members')}
                        </div>
                        
                        {assignedMembers.map((memObj) => {
                            const isObj = typeof memObj === 'object';
                            const memId = isObj ? memObj.id : memObj;
                            const memSpeedups = isObj ? (memObj.speedups || 0) : 0;
                            const memBaseTime = isObj ? (memObj.baseTime || 0) : 0;
                            
                            const mem = activeDeployment.find(p => String(p.id) === String(memId));
                            const currentTimeCalc = memBaseTime * Math.pow(0.75, memSpeedups);
                            
                            // 💡 CONTROLLO VELOCITÀ DINAMICO IN BASE ALLA SCELTA (1 o 4)
                            const rTime = currentAssign.type === 'rally_1' ? 1 : 4;
                            const isTooSlow = currentAssign.type.startsWith('rally') && currentTimeCalc > rTime;

                            return (
                              <div key={memId} className={`text-xs bg-slate-800 border ${isTooSlow ? 'border-red-500/60 shadow-[0_0_10px_rgba(239,68,68,0.2)]' : 'border-slate-600'} text-slate-200 px-3 py-2 rounded-lg flex flex-col gap-1.5 transition-all`}>
                                <div className="flex items-center justify-between">
                                  <span className="font-bold flex items-center gap-1.5">
                                    {mem?.name || mem?.tag || `Player ${memId}`}
                                    {memSpeedups > 0 && <span className="text-amber-400 bg-amber-900/30 px-1.5 py-0.5 rounded text-[10px] ml-1">⚡x{memSpeedups}</span>}
                                  </span>
                                  <button onClick={(e) => { e.stopPropagation(); updateMarchAssignment(marchIdx, 'members', assignedMembers.filter(m => String(typeof m === 'object' ? m.id : m) !== String(memId))); }} className="text-red-400 hover:text-white bg-red-900/20 hover:bg-red-600 font-bold w-6 h-6 flex items-center justify-center rounded transition-colors">✕</button>
                                </div>

                                {currentAssign.type.startsWith('rally') && (
                                  <div className="flex items-center justify-between border-t border-slate-700/80 pt-1.5">
                                    <span className={`text-[11px] uppercase tracking-wider font-bold ${isTooSlow ? 'text-red-400' : 'text-slate-400'}`}>
                                      {t('dispatch_modal.arrival')} {currentTimeCalc.toFixed(1)}m
                                    </span>
                                    {isTooSlow ? (
                                      <button onClick={(e) => { e.stopPropagation(); const updatedMembers = assignedMembers.map(m => { if (String(typeof m === 'object' ? m.id : m) === String(memId)) { return { id: memId, baseTime: memBaseTime, speedups: memSpeedups + 1 }; } return m; }); updateMarchAssignment(marchIdx, 'members', updatedMembers); }} className="bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-black uppercase px-2 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition-colors shadow-md">
                                        ⚡ {t('dispatch_modal.use_speedup')}
                                      </button>
                                    ) : (
                                      <span className="text-emerald-400 text-[10px] font-black uppercase bg-emerald-900/30 px-2 py-1 rounded-md">{t('dispatch_modal.on_time')}</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            )
                        })}
                      </div>
                    )}

                    {availablePlayers.length > 0 && assignedMembers.length < 9 && (
                      <div className="flex flex-col gap-1 mt-1">
                        <select
                          className="w-full bg-slate-900 border border-slate-700 border-dashed rounded-xl p-2.5 text-[11px] font-bold text-slate-300 outline-none focus:border-cyan-500 cursor-pointer shadow-inner"
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
                            const newMembers = [...assignedMembers, { id: targetId, speedups: 0, baseTime: calculatedBaseTime }];
                            updateMarchAssignment(marchIdx, 'members', newMembers);
                          }}
                        >
                          <option value="" disabled>➕ {t('dispatch_modal.join_player')}</option>
                          {availablePlayers.filter(p => !assignedMembers.some(m => String(typeof m === 'object' ? m.id : m) === String(p.id))).map(p => (
                              <option key={p.id} value={p.id}>{p.name} ({p.tag})</option>
                          ))}
                        </select>
                      </div>
                    )}

                  </div>
                </div>
              )
            })}

            {getAvailableMarches(activePlayer.id) === 0 && (
              <div className="text-center text-slate-400 text-xs font-bold uppercase tracking-wider py-4 px-2 flex flex-col items-center gap-2 border-2 border-dashed border-slate-700/50 rounded-2xl mx-1 my-2 opacity-60">
                <span className="text-3xl">🪖</span>
                {t('dispatch_modal.all_assigned')}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};