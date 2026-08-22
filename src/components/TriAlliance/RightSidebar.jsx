import React from 'react';
import { useTranslation } from 'react-i18next';

export default function RightSidebar({
  selectedNode, adminTool, drawMode, currentPhase,
  BUILDING_TYPES, UNKNOWN_BUILDING, isNodeLocked,
  allianceAssignments, activeRoster, marchesLeft,
  onClose, handleRemoveNode, handleAssignPlayer, handleRemovePlayerFromNode,
  allianceDraft, TEAM_COLORS,
  canManageEvent, homeBaseId, onSetHomeBase,
  showMarkers, setShowMarkers, showPaths, setShowPaths
}) {
  const { t } = useTranslation();

  if (adminTool === 'nodes') {
    return (
      <aside className="w-72 bg-slate-900 border-l border-slate-800 p-6 flex flex-col z-20 shrink-0">
         <h3 className="text-lg font-black text-rose-500 mb-2">📍 {t('tri_alliance.map.editNodes')}</h3>
         <p className="text-xs text-slate-400">{t('tri_alliance.map.clickToPlace')}</p>
         {selectedNode && (
           <button onClick={() => handleRemoveNode(selectedNode.id)} className="mt-4 px-4 py-3 bg-rose-900/30 hover:bg-rose-600 text-rose-500 hover:text-white text-xs font-bold uppercase rounded-xl border border-rose-500/30 transition-colors">
             🗑️ {t('tri_alliance.map.deleteNode')} {selectedNode.id}
           </button>
         )}
      </aside>
    );
  }

  if (adminTool === 'links') {
    return (
      <aside className="w-72 bg-slate-900 border-l border-slate-800 p-6 flex flex-col z-20 shrink-0">
         <h3 className="text-lg font-black text-fuchsia-500 mb-2">🔗 {t('tri_alliance.map.globalNet')}</h3>
         <p className="text-xs text-slate-400 mb-4">{t('tri_alliance.map.netDesc1')}</p>
         <ul className="text-xs text-slate-300 list-disc list-inside space-y-1">
           <li>{t('tri_alliance.map.netDesc2')}</li>
           <li>{t('tri_alliance.map.netDesc3')}</li>
           <li>{t('tri_alliance.map.netDesc4')}</li>
         </ul>
      </aside>
    );
  }

  const assignedIds = selectedNode ? (allianceAssignments[selectedNode.id] || []) : [];
  const teams = allianceDraft?.teams || [];
  const playerMeta = allianceDraft?.playerMeta || {};

  const groupedAssigned = {};
  const unassignedAssigned = [];
  
  assignedIds.forEach(pId => {
    const tId = playerMeta[pId]?.teamId;
    if (tId && teams.find(t => t.id === tId)) {
      if (!groupedAssigned[tId]) groupedAssigned[tId] = [];
      groupedAssigned[tId].push(pId);
    } else {
      unassignedAssigned.push(pId);
    }
  });

  const availableToAssign = activeRoster.filter(p => !assignedIds.includes(p.id));
  const isHomeBase = selectedNode && homeBaseId === selectedNode.id;

  const handleDragStart = (e, playerId, sourceNodeId = null) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ playerId, sourceNodeId }));
    e.dataTransfer.setData('text/plain', playerId);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="w-72 bg-slate-900 border-l border-slate-800 flex flex-col z-20 shadow-2xl shrink-0 transition-all">
      
      <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
        {selectedNode && !drawMode ? (
          <>
            <div className="p-6 bg-slate-950 border-b border-slate-800 relative overflow-hidden shrink-0">
              {isHomeBase && <div className="absolute inset-0 bg-amber-500/10 z-0 pointer-events-none"></div>}
              
              <div className="relative z-10">
                <div className="flex justify-between items-start">
                  <h3 className={`text-2xl font-black ${isHomeBase ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'text-cyan-400'}`}>
                    {selectedNode.id}
                  </h3>
                  <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
                </div>
                
                {selectedNode.type === 'WAYPOINT' ? (
                  <div className="mt-4 bg-slate-900 p-3 rounded text-xs text-slate-400 font-bold border border-slate-700/50">
                    {t('tri_alliance.map.waypointDesc')}
                  </div>
                ) : (
                  <>
                    <div className="text-sm font-bold text-slate-300 mt-1">
                      {(BUILDING_TYPES[selectedNode.type] || UNKNOWN_BUILDING).name}
                    </div>
                    {canManageEvent && (
                      <button 
                        onClick={() => onSetHomeBase(isHomeBase ? null : selectedNode.id)}
                        className={`w-full mt-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2 border ${isHomeBase ? 'bg-amber-900/40 text-amber-400 border-amber-500/50 hover:bg-rose-900/40 hover:text-rose-400 hover:border-rose-500/50' : 'bg-slate-900 text-slate-400 border-slate-700 hover:bg-amber-600/20 hover:text-amber-400 hover:border-amber-500/50'}`}
                      >
                        {isHomeBase ? t('tri_alliance.map.removeBase') : t('tri_alliance.map.setBase')}
                      </button>
                    )}
                    {isNodeLocked(selectedNode.type) ? (
                      <div className="mt-4 bg-slate-900 p-2 rounded text-xs text-rose-400 font-bold border border-rose-900/50">
                        {t('tri_alliance.map.lockedPhase')} {currentPhase}.
                      </div>
                    ) : (
                      <div className="mt-4 bg-slate-900 p-2 rounded text-xs text-emerald-400 font-bold border border-emerald-900/50">
                        {t('tri_alliance.map.generates')}: +{(BUILDING_TYPES[selectedNode.type] || UNKNOWN_BUILDING).pts} pt/min
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {selectedNode.type !== 'WAYPOINT' && (
              <div className="p-4 flex flex-col gap-4">
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-500 tracking-widest border-b border-slate-800 pb-2 mb-3">{t('tri_alliance.map.currentGarrison')}</div>
                  
                  {assignedIds.length === 0 ? (
                    <div className="text-xs text-slate-600 italic text-center py-4">{t('tri_alliance.map.noTroops')}</div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {teams.map(team => {
                        const playersInTeam = groupedAssigned[team.id];
                        if (!playersInTeam || playersInTeam.length === 0) return null;
                        const theme = TEAM_COLORS[team.color] || TEAM_COLORS.cyan;

                        return (
                          <div key={team.id} className="flex flex-col gap-1.5">
                            <div className={`flex items-center gap-1.5 text-[10px] uppercase font-black tracking-widest ${theme.text}`}>
                              <span className="w-2 h-2 rounded-full bg-current"></span>
                              {team.name}
                            </div>
                            {playersInTeam.map(playerId => {
                              const player = activeRoster.find(p => p.id === playerId);
                              if (!player) return null;
                              return (
                                <div 
                                  key={playerId} 
                                  draggable={canManageEvent}
                                  onDragStart={(e) => handleDragStart(e, playerId, selectedNode.id)}
                                  className={`flex justify-between items-center bg-slate-950 border border-slate-800 p-2 rounded-lg border-l-2 ${theme.border} group ${canManageEvent ? 'cursor-grab active:cursor-grabbing hover:border-slate-500 hover:bg-slate-900' : ''}`}
                                >
                                  <span className="text-sm font-bold text-slate-300 truncate pr-2">{player.name}</span>
                                  <button onClick={() => handleRemovePlayerFromNode(playerId)} className="text-slate-600 hover:text-rose-500 text-xs font-bold opacity-50 group-hover:opacity-100 transition-opacity">✕</button>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}

                      {unassignedAssigned.length > 0 && (
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-1.5 text-[10px] uppercase font-black tracking-widest text-slate-500">
                            <span className="w-2 h-2 rounded-full bg-slate-600"></span>
                            {t('tri_alliance.sidebar.noTeam')}
                          </div>
                          {unassignedAssigned.map(playerId => {
                            const player = activeRoster.find(p => p.id === playerId);
                            if (!player) return null;
                            return (
                              <div 
                                key={playerId} 
                                draggable={canManageEvent}
                                onDragStart={(e) => handleDragStart(e, playerId, selectedNode.id)}
                                className={`flex justify-between items-center bg-slate-950 border border-slate-800 p-2 rounded-lg border-l-2 border-slate-600 group ${canManageEvent ? 'cursor-grab active:cursor-grabbing hover:border-slate-500 hover:bg-slate-900' : ''}`}
                              >
                                <span className="text-sm font-bold text-slate-300 truncate pr-2">{player.name}</span>
                                <button onClick={() => handleRemovePlayerFromNode(playerId)} className="text-slate-600 hover:text-rose-500 text-xs font-bold opacity-50 group-hover:opacity-100 transition-opacity">✕</button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {!isNodeLocked(selectedNode.type) && (
                  <div className="mt-2 border-t border-slate-800 pt-4 pb-4">
                    <div className="text-[10px] uppercase font-bold text-slate-500 tracking-widest border-b border-slate-800 pb-2 mb-2">{t('tri_alliance.map.assignPlayers')}</div>
                    <div className="flex flex-col gap-1">
                      {availableToAssign.length === 0 ? (
                        <div className="text-xs text-rose-400 italic text-center py-4">{t('tri_alliance.map.noAvailable')}</div>
                      ) : (
                        availableToAssign.map(player => {
                            const mLeft = marchesLeft[player.id];
                            const tId = playerMeta[player.id]?.teamId;
                            const team = teams.find(t => t.id === tId);
                            const theme = team ? TEAM_COLORS[team.color] : null;

                            return (
                              <button 
                                key={player.id} 
                                onClick={() => handleAssignPlayer(player.id, selectedNode.id, null)}
                                disabled={mLeft <= 0}
                                draggable={canManageEvent && mLeft > 0}
                                onDragStart={(e) => handleDragStart(e, player.id, null)}
                                className={`w-full text-left flex justify-between items-center p-2 rounded border transition-colors ${mLeft > 0 ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 cursor-pointer active:cursor-grabbing' : 'bg-slate-950 border-slate-900 opacity-50 cursor-not-allowed'}`}
                              >
                                <div className="flex items-center gap-2 truncate pr-2 pointer-events-none">
                                  <span className={`w-2 h-2 rounded-full shrink-0 ${theme ? theme.bg : 'bg-slate-600'}`}></span>
                                  <span className="text-xs font-bold text-slate-300 truncate">{player.name}</span>
                                </div>
                                <span className="text-[10px] text-slate-500 font-mono shrink-0 pointer-events-none">{mLeft}/3</span>
                              </button>
                            );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center opacity-40">
             <span className="text-5xl mb-4">{drawMode ? '🖊️' : '🗺️'}</span>
             <p className="text-sm font-bold text-slate-400">
               {drawMode ? t('tri_alliance.map.drawModeActive') : t('tri_alliance.map.clickBuilding')}
             </p>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-800 bg-slate-950 flex flex-col gap-2 shrink-0 shadow-[0_-10px_20px_rgba(0,0,0,0.2)]">
        <div className="text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-1 text-center">{t('tri_alliance.sidebar.visualFilters')}</div>
        
        <button 
          onClick={() => setShowMarkers(!showMarkers)}
          className={`w-full py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-between px-4 border ${showMarkers ? 'bg-slate-800 text-slate-300 hover:text-white border-slate-700 hover:bg-slate-700' : 'bg-indigo-600/20 text-indigo-400 border-indigo-500/50 hover:bg-indigo-600/30'}`}
        >
          <span>{showMarkers ? t('tri_alliance.sidebar.hideTroops') : t('tri_alliance.sidebar.showTroops')}</span>
          <span className="text-base">{showMarkers ? '👁️' : '👀'}</span>
        </button>

        <button 
          onClick={() => setShowPaths(!showPaths)}
          className={`w-full py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-between px-4 border ${showPaths ? 'bg-slate-800 text-slate-300 hover:text-white border-slate-700 hover:bg-slate-700' : 'bg-fuchsia-600/20 text-fuchsia-400 border-fuchsia-500/50 hover:bg-fuchsia-600/30'}`}
        >
          <span>{showPaths ? t('tri_alliance.sidebar.hidePaths') : t('tri_alliance.sidebar.showPaths')}</span>
          <span className="text-base">{showPaths ? '🔀' : '🛤️'}</span>
        </button>
      </div>

    </aside>
  );
}