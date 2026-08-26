import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export default function MapDetails({ 
  selectedBuilding, onClose, enemyHQs = [], onAddHQ, onRemoveHQ,
  allianceMeta, setAllianceMeta, activeView, isOpen, setIsOpen,
  currentTime, marchAssignments, setMarchAssignments,
  handleConfirmDispatch, buildings, getAvailableMarches,
  activeDeployment, roster, allianceStructures = [],
  tacticalMeta, eventMode, playerOverrides = {} 
}) {
  const { t } = useTranslation();
  const [newHQ, setNewHQ] = useState({ name: '', x: '', y: '' });
  const [currentTargetId, setCurrentTargetId] = useState('');
  
  const [expandedMarches, setExpandedMarches] = useState({ 1: true });

  const rawRoster = Array.isArray(roster) ? roster : (roster?.players || []);

  useEffect(() => {
    if (selectedBuilding) {
      if (!selectedBuilding.isPlayer) {
        setCurrentTargetId(String(selectedBuilding.id));
      } else {
        if (eventMode === 'castle_battle') {
          const castle = buildings?.find(b => b.type === 'castle' || b.code === 'CAS' || String(b.id) === 'castle');
          if (castle && setMarchAssignments) {
            const castleIdStr = String(castle.id);
            setCurrentTargetId(castleIdStr); 
            setMarchAssignments(prev => {
              if (!prev[1] || !prev[1].buildingId) {
                return { ...prev, 1: { buildingId: castleIdStr, type: 'attacco', members: [] } };
              }
              return prev;
            });
          }
        }
      }
    }
  }, [selectedBuilding, eventMode, buildings, setMarchAssignments]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newHQ.name || !newHQ.x || !newHQ.y) return;
    onAddHQ(newHQ);
    setNewHQ({ name: '', x: '', y: '' });
  };

  const isPlayerSelected = selectedBuilding?.isPlayer;

  const toggleMarch = (idx) => {
    setExpandedMarches(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const updateMarchAssignment = (marchIdx, field, value) => {
    if (!setMarchAssignments) return;
    setMarchAssignments(prev => {
      const current = prev[marchIdx] || { buildingId: currentTargetId, type: 'attacco', members: [] };
      return { ...prev, [marchIdx]: { ...current, [field]: value } };
    });
    setExpandedMarches(prev => ({ ...prev, [marchIdx]: true }));
  };

  const handleTypeChange = (marchIdx, newType) => {
    updateMarchAssignment(marchIdx, 'type', newType);

    if (newType === 'rally') {
      const draftData = tacticalMeta?.draftData || {};
      const draftMeta = draftData.playerMeta || {};
      const leaderIdStr = String(selectedBuilding?.id);
      const currentLeaderTeamId = draftMeta[leaderIdStr]?.teamId;

      if (currentLeaderTeamId) {
        const teamMemberIds = Object.keys(draftMeta).filter(id => 
          String(draftMeta[id]?.teamId) === String(currentLeaderTeamId) && String(id) !== leaderIdStr
        );

        let fallbackMembers = [];
        if (draftData.teams) {
          const teamObj = draftData.teams.find(t => String(t.id) === String(currentLeaderTeamId));
          if (teamObj && teamObj.members) {
             fallbackMembers = teamObj.members.filter(mId => String(mId) !== leaderIdStr);
          }
        }

        const allFoundIds = Array.from(new Set([...teamMemberIds, ...fallbackMembers.map(String)]));
        const teamMembersToAutoAdd = allFoundIds.map(id => ({ id: String(id), speedups: 0 }));

        setMarchAssignments(prev => {
          const current = prev[marchIdx] || { buildingId: currentTargetId, type: 'attacco', members: [] };
          const existingMemberIds = new Set((current.members || []).map(m => String(typeof m === 'object' ? m.id : m)));
          const newMembers = [...(current.members || [])];

          for (let member of teamMembersToAutoAdd) {
            if (newMembers.length >= 9) break; 
            if (!existingMemberIds.has(member.id)) {
              newMembers.push(member);
            }
          }

          return { ...prev, [marchIdx]: { ...current, type: newType, members: newMembers } };
        });
      }
    }
  };

  const formatTimeMinSec = (decimalMinutes) => {
    if (isNaN(decimalMinutes) || decimalMinutes < 0) return "0m 00s";
    const m = Math.floor(decimalMinutes);
    let s = Math.round((decimalMinutes - m) * 60);
    let finalM = m;
    if (s === 60) { finalM += 1; s = 0; }
    return `${finalM}m ${s < 10 ? '0' : ''}${s}s`;
  };

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
    const travelTimeMins = (distanceInTiles * 4) / 60; 
    return travelTimeMins * Math.pow(0.75, speedups);
  };

  const calculateTravelTime = (buildingId, originX, originY, isRally = false) => {
    if (!buildingId || originX === undefined || !buildings) return null;
    const targetBuilding = buildings.find(b => String(b.id) === String(buildingId));
    if (!targetBuilding) return null;

    const travelTimeMins = calculateDistanceMinutes(targetBuilding.x, targetBuilding.y, originX, originY, 0);
    const delay = isRally ? 5 : 0;
    const arrivalMin = (currentTime / 60) + delay + travelTimeMins;

    return {
      duration: formatTimeMinSec(travelTimeMins),
      arrival: formatTimeMinSec(arrivalMin)
    };
  };

  const hiveHQ = allianceStructures?.find(s => s.type === 'headquarters');
  const HIVE_X = hiveHQ ? Number(hiveHQ.x) : 0;
  const HIVE_Y = hiveHQ ? Number(hiveHQ.y) : 0;

  const currentMinutes = Math.floor(currentTime / 60);
  const currentSeconds = (currentTime % 60).toString().padStart(2, '0');

  return (
    <>
      <button onClick={() => setIsOpen(!isOpen)} className={`absolute top-1/2 -translate-y-1/2 z-50 bg-slate-900 hover:bg-slate-800 text-cyan-400 py-4 px-2 rounded-l-xl border-y border-l border-slate-700 shadow-[-8px_0_15px_rgba(0,0,0,0.6)] transition-all duration-300 flex items-center justify-center font-black ${isOpen ? 'right-[320px]' : 'right-0'}`}>
        {isOpen ? '▶' : '◀'}
      </button>

      <aside className={`bg-slate-900 border-slate-800 flex flex-col z-40 shadow-2xl shrink-0 transition-all duration-300 overflow-hidden ${isOpen ? 'w-[320px] border-l' : 'w-0 border-l-0'}`}>
        <div className="w-[320px] h-screen flex flex-col overflow-y-auto custom-scrollbar">
          
          <div className="flex flex-col border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm shrink-0">
            <div className="p-4 bg-slate-950 flex justify-between items-center sticky top-0 z-10 border-b border-slate-800/80 shadow-md">
              <h2 className="text-sm font-black text-cyan-400 uppercase tracking-wider">{isPlayerSelected ? t('map.commander') : t('map.building_info')}</h2>
              {selectedBuilding && <button onClick={() => setIsOpen(false)} className="text-slate-500 hover:text-rose-400 text-lg font-bold transition-colors w-6 h-6 flex items-center justify-center rounded bg-slate-900 border border-slate-700">✕</button>}
            </div>
            
            <div className="p-5">
              {selectedBuilding ? (
                <div className="flex flex-col gap-4 animate-fade-in">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{isPlayerSelected ? t('map.player_name') : t('map.id_name')}</span>
                    <h3 className="text-xl font-black text-white leading-tight mt-1">{selectedBuilding.code && <span className="text-cyan-400 mr-2">[{selectedBuilding.code}]</span>}{selectedBuilding.name}</h3>
                  </div>
                  <div className="flex gap-3">
                    <div className="bg-slate-950 px-3 py-2 rounded-lg border border-slate-800 flex-1 shadow-inner">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">{t('map.coord_x')}</span>
                      <span className="text-base font-mono font-bold text-cyan-400">{selectedBuilding.x}</span>
                    </div>
                    <div className="bg-slate-950 px-3 py-2 rounded-lg border border-slate-800 flex-1 shadow-inner">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">{t('map.coord_y')}</span>
                      <span className="text-base font-mono font-bold text-amber-400">{selectedBuilding.y}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center gap-3 mt-4 mb-4 opacity-50">
                  <span className="text-4xl">🖱️</span>
                  <span className="text-xs text-slate-400 font-medium leading-relaxed px-4">{t('map.click_hint')}</span>
                </div>
              )}
            </div>
          </div>

          {activeView === 'tactical' && isPlayerSelected && (
            <div className="flex flex-col bg-slate-950 flex-1 animate-fade-in">
              
              <div className="p-4 border-b border-slate-800 bg-cyan-950/10 flex flex-col gap-4 shrink-0 shadow-sm">
                <div>
                  <h2 className="text-sm font-black text-cyan-400 uppercase tracking-wider flex items-center gap-2"><span>⚔️</span> {t('map.tactical_orders')}</h2>
                  <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                    <span className="text-amber-400 font-bold">{t('map_details.warning', 'Attenzione:')}</span> {t('map_details.orders_exact_time', 'gli ordini creati verranno assegnati esattamente a')} <b>{currentMinutes}' {currentSeconds}"</b>.
                  </p>
                </div>
                
                <button 
                  className="w-full bg-cyan-700 hover:bg-cyan-600 text-white text-xs font-black py-3 rounded-lg shadow-[0_0_15px_rgba(14,116,144,0.4)] disabled:opacity-50 disabled:cursor-not-allowed transition-all" 
                  onClick={() => handleConfirmDispatch(selectedBuilding.id)} 
                  disabled={!marchAssignments || Object.values(marchAssignments).filter(v => v.buildingId !== '').length === 0}
                >
                  {t('map.register_orders')}
                </button>
              </div>

              <div className="p-4 flex flex-col gap-3 flex-1 overflow-y-auto custom-scrollbar">
                {Array.from({ length: getAvailableMarches ? getAvailableMarches(selectedBuilding.id) : 0 }).map((_, i) => {
                  const marchIdx = i + 1;
                  const currentAssign = marchAssignments[marchIdx] || { buildingId: currentTargetId, type: 'attacco', members: [] };
                  const assignedMembers = currentAssign.members || [];
                  const availablePlayers = rawRoster.filter(p => String(p.id) !== String(selectedBuilding.id) && p.isParticipating !== false && (getAvailableMarches ? getAvailableMarches(p.id) > 0 : true));
                  
                  const isExpanded = !!expandedMarches[marchIdx];
                  const hasTarget = !!currentAssign.buildingId;

                  return (
                    <div key={`march-${marchIdx}`} className={`bg-slate-900 border transition-all flex flex-col shadow-inner ${hasTarget ? 'border-cyan-700/50' : 'border-slate-700/50'} ${isExpanded ? 'rounded-xl' : 'rounded-lg hover:border-slate-500'}`}>
                      
                      <div 
                        className={`flex justify-between items-center p-3 cursor-pointer transition-colors ${isExpanded ? 'bg-slate-800/80 rounded-t-xl border-b border-slate-800/50' : 'hover:bg-slate-800 rounded-lg'}`}
                        onClick={() => toggleMarch(marchIdx)}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-black uppercase ${hasTarget ? 'text-cyan-300' : 'text-slate-400'}`}>
                            {t('map.march')} {marchIdx}
                          </span>
                          {hasTarget && <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_5px_#10b981]" title={t('map_details.dest_selected', 'Destinazione Selezionata')}></div>}
                        </div>
                        <div className="flex items-center gap-3">
                          {assignedMembers.length > 0 && <span className="text-[10px] font-bold text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded">{assignedMembers.length + 1}/10</span>}
                          <span className="text-slate-500 text-[10px] font-mono">{isExpanded ? '▲' : '▼'}</span>
                        </div>
                      </div>
                      
                      {isExpanded && (
                        <div className="p-3 flex flex-col gap-2 bg-slate-900/50 rounded-b-xl">
                          <select className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-xs font-bold text-slate-200 outline-none focus:border-cyan-500" value={currentAssign.buildingId || ''} onChange={(e) => updateMarchAssignment(marchIdx, 'buildingId', e.target.value)}>
                            <option value="">{t('map.select_target')}</option>
                            {buildings?.map(b => (<option key={b.id} value={b.id}>[{b.code}] {b.name}</option>))}
                          </select>

                          {currentAssign.buildingId && (() => {
                            const isRally = currentAssign.type === 'rally';
                            const timing = calculateTravelTime(currentAssign.buildingId, selectedBuilding.x, selectedBuilding.y, isRally);
                            return timing && (
                              <div className="text-[10px] font-black flex flex-col gap-0.5 bg-slate-950 p-2 rounded border border-slate-800">
                                <span className="text-slate-400">{t('map.travel_duration')}: <span className="text-white">{timing.duration}</span></span>
                                <span className="text-amber-400">{t('map.impact_minute')}: <span className="text-white">{timing.arrival}</span></span>
                              </div>
                            );
                          })()}
                          
                          <select className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-xs font-bold text-slate-200 outline-none focus:border-cyan-500" value={currentAssign.type} onChange={(e) => handleTypeChange(marchIdx, e.target.value)}>
                            <option value="attacco">{t('map.single_attack')}</option>
                            <option value="difesa">{t('map.garrison_defense')}</option>
                            <option value="supporto">{t('map.support')}</option>
                            <option value="rally">{t('map_details.rally_5m', 'Lancia Rally (5 min prep.)')}</option>
                          </select>

                          {assignedMembers.length > 0 && (
                            <div className="flex flex-col gap-1 mt-2 bg-slate-950 p-2 rounded border border-slate-800">
                              <div className="text-[9px] text-slate-500 uppercase font-black border-b border-slate-800 pb-1 mb-1">{t('map.aggregated_members')}</div>
                              {assignedMembers.map((memObj) => {
                                  const isObj = typeof memObj === 'object';
                                  const memId = isObj ? memObj.id : memObj;
                                  const memSpeedups = isObj ? (memObj.speedups || 0) : 0;
                                  const mem = rawRoster.find(p => String(p.id) === String(memId));
                                  const memOverride = playerOverrides[memId] || playerOverrides[String(memId)];
                                  const isDeployed = memOverride && memOverride.x !== '' && memOverride.x != null;
                                  const memX = isDeployed ? Number(memOverride.x) : HIVE_X;
                                  const memY = isDeployed ? Number(memOverride.y) : HIVE_Y;
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
                                          {mem?.name || mem?.tag || t('map_details.unknown', 'Sconosciuto')} 
                                          {!isDeployed && <span className="text-indigo-400 ml-1 font-normal opacity-80">({t('map.hive')})</span>}
                                          {memSpeedups > 0 && <span className="text-amber-400 ml-1">⚡x{memSpeedups}</span>}
                                        </span>
                                        <button onClick={() => updateMarchAssignment(marchIdx, 'members', assignedMembers.filter(m => String(typeof m === 'object' ? m.id : m) !== String(memId)))} className="text-red-400 hover:text-red-300">✕</button>
                                      </div>
                                      {currentAssign.type === 'rally' && (
                                        <div className="flex justify-between border-t border-slate-800 pt-1 mt-1 text-[9px] items-center">
                                          <span className={isTooSlow ? 'text-red-400 font-bold' : 'text-slate-400'}>{t('map_details.travel', 'Viaggio:')} {formatTimeMinSec(timeCalc)}</span>
                                          <div className="flex gap-2 items-center">
                                            {isTooSlow ? <span className="text-red-400 flex items-center gap-1 font-bold">⚠️ {t('map.late')}</span> : <span className="text-emerald-400 font-bold">✓ {t('map.on_time')}</span>}
                                            <button onClick={() => updateMarchAssignment(marchIdx, 'members', assignedMembers.map(m => String(typeof m === 'object' ? m.id : m) === String(memId) ? { id: memId, speedups: memSpeedups + 1 } : m))} className={`px-1.5 py-0.5 rounded transition-colors ${isTooSlow ? 'bg-amber-600/40 text-amber-300 hover:bg-amber-600/60 border border-amber-500/50 font-bold' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'}`}>{t('map_details.btn_speedup', '+ Speedup')}</button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )
                              })}
                            </div>
                          )}

                          {availablePlayers.length > 0 && assignedMembers.length < 9 && currentAssign.buildingId !== '' && (
                            <select className="w-full bg-slate-950 border border-indigo-900/50 rounded p-1 text-[10px] font-bold text-indigo-400 mt-2 outline-none" value="" onChange={(e) => e.target.value && updateMarchAssignment(marchIdx, 'members', [...assignedMembers, { id: e.target.value, speedups: 0 }])}>
                              <option value="" disabled>{t('map.add_member')}</option>
                              {availablePlayers.filter(p => !assignedMembers.some(m => String(typeof m === 'object' ? m.id : m) === String(p.id))).map(p => (<option key={p.id} value={p.id}>[{p.tag}] {p.name}</option>))}
                            </select>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

            </div>
          )}
        </div>
      </aside>
    </>
  );
}