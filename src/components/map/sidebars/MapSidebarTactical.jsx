import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import TacticalTeamCard from '../TacticalTeamCard';
import { calculateGlobalDeployment } from '../../../utils/tacticalDeployment'; 

const formatDecimalToTime = (decimalMinutes) => {
  if (decimalMinutes < 0) decimalMinutes = 0;
  const m = Math.floor(decimalMinutes);
  let s = Math.round((decimalMinutes - m) * 60);
  let finalM = m;
  if (s === 60) { finalM += 1; s = 0; }
  return `${finalM.toString().padStart(2, '0')}' ${s.toString().padStart(2, '0')}"`;
};

export default function MapSidebarTactical({
  roster, isReadOnly, tacticalMeta, setTacticalMeta, playerOverrides, setPlayerOverrides,
  allianceStructures, exportableOrders, setExportableOrders, fixedBuildings,
  onOpenHelp, openBuilder, openEventManager, openExportModal
}) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [tacticalTab, setTacticalTab] = useState('teams');

  const rosterArray = (Array.isArray(roster) ? roster : (roster?.players || [])).filter(p => p !== null && p !== undefined);

  const groupedTimeline = useMemo(() => {
    const groups = {};
    const hiveHQ = allianceStructures?.find(s => s.type === 'headquarters');
    const HIVE_X = hiveHQ ? Number(hiveHQ.x) : 0;
    const HIVE_Y = hiveHQ ? Number(hiveHQ.y) : 0;

    exportableOrders.forEach((order, index) => {
      const leader = rosterArray.find(p => String(p.id) === String(order.leaderId));
      const leaderName = leader ? (leader.name || leader.tag || `Giocatore_${order.leaderId}`) : 'Sconosciuto';
      const targetB = fixedBuildings?.find(b => String(b.id) === String(order.targetId));
      const targetName = targetB ? targetB.name : 'Obiettivo';
      
      const dispatchTimeVal = Number(order.startMinute || 0);
      const isRally = order.marchType === 'rally';
      
      let travelTimeMins = 0;
      if (leader && targetB) {
        const override = playerOverrides[leader.id];
        const oX = override?.x ?? leader.x ?? HIVE_X;
        const oY = override?.y ?? leader.y ?? HIVE_Y;
        const tX = targetB.x;
        const tY = targetB.y;
        
        if (oX !== undefined && oY !== undefined && tX !== undefined && tY !== undefined) {
          const dx = tX - oX;
          const dy = tY - oY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          travelTimeMins = (dist * 4) / 60; 
        }
      }

      const delay = isRally ? 5 : 0;
      const arrivalDecimal = dispatchTimeVal + delay + travelTimeMins;
      const key = dispatchTimeVal.toFixed(4); 

      if (!groups[key]) groups[key] = { timeVal: dispatchTimeVal, orders: [] };
      
      groups[key].orders.push({
        originalIndex: index,
        leaderName,
        targetName,
        type: order.marchType,
        membersCount: (order.members || []).length,
        dispatchTime: dispatchTimeVal,
        arrivalTime: arrivalDecimal
      });
    });

    return Object.values(groups).sort((a, b) => a.timeVal - b.timeVal);
  }, [exportableOrders, rosterArray, fixedBuildings, playerOverrides, allianceStructures]);

  const handleDeleteOrder = (indexToRemove) => {
    if (window.confirm(t('map_sidebar.confirm_delete_order', "Cancellare questo ordine dalla programmazione?"))) {
      setExportableOrders(prev => prev.filter((_, i) => i !== indexToRemove));
    }
  };

  const handleResetFillersOnly = () => {
    if (isReadOnly) return;
    if (window.confirm(t('map_sidebar.confirm_reset_fillers', "Vuoi ritirare tutti i filler e mantenere sulla mappa SOLO i Leader?"))) {
      const draftTeams = tacticalMeta?.draftData?.teams || [];
      const draftMeta = tacticalMeta?.draftData?.playerMeta || {};
      const leaderIds = new Set();

      for (let team of draftTeams) {
        const teamPlayers = rosterArray.filter(p => draftMeta[p.id]?.teamId === team.id);
        const leader = teamPlayers.find(p => draftMeta[p.id]?.role === 'Rally Leader') 
                    || teamPlayers.find(p => draftMeta[p.id]?.role === 'Capitano Difesa')
                    || teamPlayers[0];
        if (leader) leaderIds.add(leader.id);
      }

      const newOverrides = {};
      for (let id in playerOverrides) {
        if (leaderIds.has(id)) {
          newOverrides[id] = playerOverrides[id];
        }
      }
      setPlayerOverrides(newOverrides);
    }
  };

  const handleResetAllDeployments = () => {
    if (isReadOnly) return;
    if (window.confirm(t('map_sidebar.confirm_reset_all', "Attenzione: vuoi riportare TUTTI i giocatori nella sidebar e ripartire da zero?"))) {
      setPlayerOverrides({});
    }
  };

  const handleDeployAllTeams = () => {
    if (isReadOnly) return;
    const draftTeams = tacticalMeta?.draftData?.teams || [];
    const draftMeta = tacticalMeta?.draftData?.playerMeta || {};

    if (draftTeams.length === 0) return alert(t('map_sidebar.no_teams_configured', "Nessuna squadra configurata."));

    const teamsData = [];
    for (let team of draftTeams) {
      const teamPlayers = rosterArray.filter(p => draftMeta[p.id]?.teamId === team.id);
      const leader = teamPlayers.find(p => draftMeta[p.id]?.role === 'Rally Leader') 
                  || teamPlayers.find(p => draftMeta[p.id]?.role === 'Capitano Difesa')
                  || teamPlayers[0];

      if (!leader) continue;

      const leaderOverride = playerOverrides[leader.id];
      const leaderX = leaderOverride?.x ?? leader.x;
      const leaderY = leaderOverride?.y ?? leader.y;

      if (leaderX === '' || leaderY === '' || leaderX == null || leaderY == null) {
        return alert(t('map_sidebar.error_missing_leader', "❌ Errore Globale: Posiziona prima TUTTI i Leader sulla mappa! Manca la coordinata di: [{{name}}]", { name: leader.name }));
      }

      const fillers = teamPlayers.filter(p => p.id !== leader.id);
      if (fillers.length > 0) {
        teamsData.push({ team, leader, leaderX, leaderY, fillers });
      }
    }

    const { results, missingSpace } = calculateGlobalDeployment(teamsData, playerOverrides, { x: 597, y: 597 });
    setPlayerOverrides({ ...playerOverrides, ...results });

    if (missingSpace) {
      alert(t('map_sidebar.deploy_warning_space', "⚠️ Schieramento globale completato, ma lo spazio esterno era così affollato che alcune squadre non hanno trovato posto per tutti i membri."));
    }
  };

  const draftTeams = tacticalMeta?.draftData?.teams || [];
  const draftMeta = tacticalMeta?.draftData?.playerMeta || {};
  const hasTeams = draftTeams.length > 0;
  const unassignedPlayers = rosterArray.filter(p => !draftMeta[p.id]?.teamId);

  return (
    <aside className="w-[360px] bg-slate-900 border-r border-slate-800 flex flex-col p-5 gap-4 z-20 shadow-2xl shrink-0 overflow-hidden">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-black tracking-wider text-rose-500">{t('map.tactical_room')}</h2>
          <button onClick={onOpenHelp} className="w-6 h-6 flex items-center justify-center bg-slate-800 hover:bg-cyan-900 text-cyan-400 rounded-full border border-slate-700 transition-colors text-xs font-bold" title={t('map_sidebar.guide_tooltip', 'Guida')}>?</button>
        </div>
        <button onClick={() => navigate('/')} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg border border-slate-700 transition-colors">🏠</button>
      </div>

      <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 shrink-0 shadow-inner">
        <button onClick={() => setTacticalTab('teams')} className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider rounded transition-all ${tacticalTab === 'teams' ? 'bg-rose-700 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}>{t('map_sidebar.tab_teams', '⚔️ Squadre')}</button>
        <button onClick={() => setTacticalTab('timeline')} className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider rounded transition-all ${tacticalTab === 'timeline' ? 'bg-cyan-700 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}>{t('map_sidebar.tab_timeline', '⏱️ Timeline')}</button>
      </div>

      {tacticalTab === 'teams' && (
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 flex flex-col gap-4 animate-in fade-in duration-300">
          <div className="bg-slate-950 p-4 rounded-xl border border-rose-900/50 flex flex-col gap-3">
            <div className="flex justify-between items-center mb-1">
              <h3 className="text-xs font-black text-rose-400 uppercase tracking-wider">{t('map.event_details')}</h3>
              {!isReadOnly && (
                <button onClick={openBuilder} className="bg-cyan-900/50 hover:bg-cyan-600 text-cyan-300 hover:text-white border border-cyan-800 hover:border-cyan-500 px-3 py-1 rounded text-[10px] font-bold transition-colors shadow-lg">
                  {t('map_sidebar.btn_builder', '🛠️ Costruttore')}
                </button>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">{t('map.event_name')}</label>
              <input disabled={isReadOnly} type="text" value={tacticalMeta?.eventName || ''} onChange={(e) => setTacticalMeta({...tacticalMeta, eventName: e.target.value})} className="bg-slate-900 border border-slate-700 text-white text-xs px-3 py-2 rounded focus:outline-none focus:border-rose-500 transition-colors disabled:opacity-50" placeholder={t('map.event_name_placeholder')} />
            </div>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-indigo-900/50 flex flex-col gap-3 flex-1">
            <div className="flex justify-between items-end mb-1">
              <h3 className="text-xs font-black text-indigo-400 uppercase tracking-wider">
                {hasTeams ? t('map_sidebar.assault_teams', "⚔️ Squadre d'Assalto") : t('map.forces_in_field')}
              </h3>
            </div>
            <div className="flex flex-col gap-2 overflow-y-auto custom-scrollbar pr-1 mt-1">
              {hasTeams && draftTeams.map((team, index) => (
                <TacticalTeamCard 
                  key={team.id} team={team} teamIndex={index}
                  teamPlayers={rosterArray.filter(p => draftMeta[p.id]?.teamId === team.id)}
                  draftMeta={draftMeta} playerOverrides={playerOverrides}
                  setPlayerOverrides={setPlayerOverrides} isReadOnly={isReadOnly}
                />
              ))}
              {unassignedPlayers.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-800">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 text-center">{t('map_sidebar.unassigned_troops', 'Truppe Non Assegnate ({{count}})', { count: unassignedPlayers.length })}</h4>
                  {unassignedPlayers.map(player => {
                    const override = playerOverrides[player.id];
                    const currentX = override?.x ?? player.x ?? '';
                    const currentY = override?.y ?? player.y ?? '';
                    return (
                      <div key={player.id} draggable={!isReadOnly} onDragStart={(e) => { if(!isReadOnly) e.dataTransfer.setData('text/plain', `player:${player.id}`); }} className="p-2 mb-1.5 rounded-lg flex justify-between items-center bg-slate-900 border border-slate-800/50 opacity-80 hover:opacity-100 transition-opacity">
                        <div className="flex flex-col min-w-0 pr-2">
                          <span className="text-[11px] font-bold text-slate-400 truncate">[{player.originalTag || player.tag || '?'}] {player.name}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <input disabled={isReadOnly} type="number" placeholder="X" value={currentX} onChange={(e) => { const val = e.target.value === '' ? '' : Number(e.target.value); setPlayerOverrides(prev => ({...prev, [player.id]: { x: val, y: currentY === '' ? 0 : currentY }})); }} className="w-10 bg-slate-950 border border-slate-700 text-cyan-300/50 text-center text-[10px] rounded p-0.5 font-mono outline-none" />
                          <input disabled={isReadOnly} type="number" placeholder="Y" value={currentY} onChange={(e) => { const val = e.target.value === '' ? '' : Number(e.target.value); setPlayerOverrides(prev => ({...prev, [player.id]: { x: currentX === '' ? 0 : currentX, y: val }})); }} className="w-10 bg-slate-950 border border-slate-700 text-amber-300/50 text-center text-[10px] rounded p-0.5 font-mono outline-none" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tacticalTab === 'timeline' && (
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 flex flex-col relative animate-in fade-in slide-in-from-right-4 duration-300">
          {groupedTimeline.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6 text-slate-500">
              <span className="text-4xl mb-2 opacity-50">⏳</span>
              <p className="text-sm font-bold">{t('map_sidebar.empty_timeline', 'Timeline Vuota')}</p>
              <p className="text-[10px] mt-1">{t('map_sidebar.empty_timeline_desc', 'Registra gli ordini dalla finestra di destra per vederli scorrere qui.')}</p>
            </div>
          ) : (
            <div className="relative pl-3 ml-2 border-l-2 border-cyan-800/50 py-4 flex flex-col gap-6">
              {groupedTimeline.map((group, i) => (
                <div key={i} className="relative">
                  <div className="absolute -left-[19px] top-0 w-3 h-3 rounded-full bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.8)] border-2 border-slate-900"></div>
                  <div className="flex flex-col gap-2">
                    <span className="text-cyan-400 font-black text-xs font-mono tracking-wider -mt-1">⏱️ {formatDecimalToTime(group.timeVal)}</span>
                    <div className="flex flex-col gap-3 mt-1">
                      {group.orders.map(order => {
                        const isRally = order.type === 'rally';
                        let typeIcon = '⚔️', typeColor = 'text-rose-400';
                        if (isRally) { typeIcon = '🔥'; typeColor = 'text-amber-500'; }
                        else if (order.type === 'difesa') { typeIcon = '🛡️'; typeColor = 'text-blue-400'; }
                        else if (order.type === 'supporto') { typeIcon = '🤝'; typeColor = 'text-emerald-400'; }

                        return (
                          <div key={order.originalIndex} className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex justify-between items-start group shadow-sm hover:border-cyan-700/50 transition-colors">
                            <div className="flex flex-col gap-1 min-w-0 pr-2 w-full">
                              <div className="text-sm font-black text-white truncate drop-shadow-md">{typeIcon} {order.leaderName}</div>
                              <div className={`text-[10px] font-black ${typeColor} uppercase tracking-widest`}>{isRally ? t('map_sidebar.launch_rally_5m', 'Lancia Rally (5m prep)') : order.type}</div>
                              <div className="text-[10px] text-slate-400 truncate flex items-center gap-1.5 mt-0.5"><span className="text-slate-500">{t('map_sidebar.on_target', 'Su:')}</span> <span className="text-slate-200 font-bold">{order.targetName}</span></div>
                              <div className="flex items-center gap-3 mt-2 bg-slate-900/50 p-2 rounded-lg border border-slate-700/50">
                                <div className="flex flex-col flex-1"><span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">{isRally ? t('map_sidebar.call', 'Chiamata') : t('map_sidebar.departure', 'Partenza')}</span><span className="text-xs text-cyan-400 font-mono font-black mt-0.5">{formatDecimalToTime(order.dispatchTime)}</span></div>
                                <div className="text-slate-600 text-xs font-black">➔</div>
                                <div className="flex flex-col flex-1 items-end"><span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">{t('map_sidebar.impact', 'Impatto')}</span><span className="text-xs text-amber-400 font-mono font-black mt-0.5">{formatDecimalToTime(order.arrivalTime)}</span></div>
                              </div>
                              {order.membersCount > 0 && <div className="text-[9px] font-bold text-slate-500 mt-1.5 bg-slate-800/40 inline-block self-start px-2 py-0.5 rounded">{t('map_sidebar.aggregated_troops', '+ {{count}} truppe aggregate', { count: order.membersCount })}</div>}
                            </div>
                            {!isReadOnly && <button onClick={() => handleDeleteOrder(order.originalIndex)} className="w-6 h-6 flex items-center justify-center rounded-lg bg-slate-800 text-slate-500 hover:bg-red-900/80 hover:text-red-400 border border-slate-700 opacity-0 group-hover:opacity-100">✕</button>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2 shrink-0 pt-3 border-t border-slate-800 mt-2">
        {!isReadOnly && <button onClick={openEventManager} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-widest py-3 rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.3)] flex justify-center gap-2">{t('map_sidebar.plans_db_btn', '☁️ Database Piani')}</button>}
        <button onClick={openExportModal} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-widest py-3 rounded-xl shadow-lg flex justify-center gap-2">{t('map_sidebar.export_chat_btn', '📤 Esporta Testi per Chat')}</button>
      </div>

      {!isReadOnly && tacticalTab === 'teams' && (
        <div className="flex gap-2 mt-2">
          <button onClick={handleResetFillersOnly} className="flex-1 bg-orange-700 hover:bg-orange-600 text-white text-[10px] font-black uppercase tracking-wider py-2 rounded-lg shadow-lg border border-orange-500/50">{t('map_sidebar.reset_fillers_btn', '🧹 Reset Filler')}</button>
          <button onClick={handleResetAllDeployments} className="flex-1 bg-red-800 hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-wider py-2 rounded-lg shadow-lg border border-red-500/50">{t('map_sidebar.reset_all_btn', '🗑️ Reset Totale')}</button>
        </div>
      )}
      {!isReadOnly && hasTeams && tacticalTab === 'teams' && (
        <button onClick={handleDeployAllTeams} className="w-full bg-blue-700 hover:bg-blue-600 text-white text-[10px] font-black uppercase tracking-wider py-2 mt-2 rounded-lg shadow-lg border border-blue-500/50">{t('map_sidebar.global_deploy_btn', '🚀 Schieramento Globale')}</button>
      )}

    </aside>
  );
}