import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TEAM_COLORS } from './TeamBuilderModal';
import { useTranslation } from 'react-i18next';

export default function LeftSidebar({
  canManageEvent, participantsCount, onOpenManage,
  currentPhase, setCurrentPhase, activeRoster, marchesLeft, 
  scoreAnalysis, 
  onOpenExportModal, onOpenTeamBuilder, allianceDraft,
  drawMode, onToggleDrawMode, onClearPhase, onOpenPlans,
  onRotateStrategy,
  focusedPlayerId, setFocusedPlayerId,
  onOpenHelp 
}) {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState('base'); 
  
  const { t } = useTranslation();

  const teams = allianceDraft?.teams || [];
  const unassignedPlayers = activeRoster.filter(p => !allianceDraft?.playerMeta?.[p.id]?.teamId);

  const handleDragStart = (e, playerId) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ playerId, sourceNodeId: null }));
    e.dataTransfer.setData('text/plain', playerId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const toggleFocus = (playerId) => {
    setFocusedPlayerId(prev => prev === playerId ? null : playerId);
  };

  return (
    <aside className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col z-20 shadow-2xl shrink-0">
      
      <div className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0">
        <button onClick={() => navigate('/')} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold transition-colors">⬅ {t('tri_alliance.sidebar.exit')}</button>
        
        <div className="flex gap-2">
          <button onClick={onOpenHelp} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1">
            <span>❓</span> {t('tri_alliance.sidebar.guide')}
          </button>
          
          {canManageEvent && (
            <button onClick={onOpenManage} className="px-3 py-1.5 bg-cyan-900/50 hover:bg-cyan-600 text-cyan-400 hover:text-white border border-cyan-800 hover:border-cyan-500 rounded-lg text-xs font-bold transition-all shadow-md">
              👥 {t('tri_alliance.sidebar.enrolled')} ({participantsCount})
            </button>
          )}
        </div>
      </div>

      {canManageEvent && (
        <div className="p-4 bg-slate-900 border-b border-slate-800 flex flex-col gap-2 shrink-0">
          <button onClick={onOpenPlans} className="w-full py-2 bg-indigo-900/20 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/30 hover:border-indigo-500/50 rounded-xl text-xs font-black transition-all flex justify-center items-center gap-2 uppercase tracking-wider">
            💾 {t('tri_alliance.sidebar.savedPlans')}
          </button>
          <button onClick={onOpenExportModal} className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white rounded-xl text-xs font-black transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] uppercase tracking-wider flex justify-center items-center gap-2">
            <span>📤</span> {t('tri_alliance.sidebar.export')}
          </button>
          <button onClick={onRotateStrategy} className="w-full py-2 mt-1 bg-slate-800 hover:bg-amber-600 text-amber-400 hover:text-white border border-amber-500/30 hover:border-amber-500 rounded-xl text-[10px] font-black transition-all flex justify-center items-center gap-2 uppercase tracking-wider shadow-sm">
            <span>🔄</span> {t('tri_alliance.sidebar.rotate')}
          </button>
        </div>
      )}

      <div className="p-4 bg-slate-950/50 border-b border-slate-800 flex flex-col gap-3 shrink-0">
        <div className="text-[10px] uppercase font-bold text-slate-500 tracking-widest text-center">{t('tri_alliance.sidebar.phase')}</div>
        <div className="flex bg-slate-800 p-1 rounded-lg">
          <button onClick={() => setCurrentPhase(1)} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${currentPhase === 1 ? 'bg-cyan-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>0-20m</button>
          <button onClick={() => setCurrentPhase(2)} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${currentPhase === 2 ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>20-40m</button>
          <button onClick={() => setCurrentPhase(3)} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${currentPhase === 3 ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>40m+</button>
        </div>

        {canManageEvent && (
          <div className="flex gap-2">
            <button onClick={onToggleDrawMode} className={`flex-1 py-2 rounded-lg text-[10px] font-black transition-all flex items-center justify-center gap-1 border uppercase tracking-wider ${drawMode ? 'bg-cyan-600 text-white border-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.4)]' : 'bg-slate-800 text-cyan-400 border-cyan-900/50 hover:bg-slate-700 hover:text-white'}`}>
              {drawMode ? `🖊️ ${t('tri_alliance.sidebar.drawOn')}` : `🖊️ ${t('tri_alliance.sidebar.drawOff')}`}
            </button>
            <button onClick={onClearPhase} className="flex-1 py-2 bg-rose-900/20 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/30 hover:border-rose-500/50 rounded-lg text-[10px] font-black transition-all flex justify-center items-center gap-1 uppercase tracking-wider">
              🗑️ {t('tri_alliance.sidebar.clearPhase')}
            </button>
          </div>
        )}
      </div>

      <div className="p-3 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center shrink-0">
        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">{t('tri_alliance.sidebar.alliedForces')}</span>
        <div className="flex bg-slate-900 rounded-lg border border-slate-700 p-0.5 shadow-inner">
          <button onClick={() => setViewMode('base')} className={`px-3 py-1 text-[9px] font-black rounded-md uppercase transition-colors ${viewMode === 'base' ? 'bg-cyan-600 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}>{t('tri_alliance.sidebar.baseView')}</button>
          <button onClick={() => setViewMode('advanced')} className={`px-3 py-1 text-[9px] font-black rounded-md uppercase transition-colors ${viewMode === 'advanced' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}>{t('tri_alliance.sidebar.advView')}</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 bg-slate-900/30">
        {activeRoster.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center opacity-50">
            <span className="text-4xl mb-4">👥</span>
            <p className="text-sm font-bold text-slate-400 mb-2">{t('tri_alliance.sidebar.noPlayers')}</p>
          </div>
        ) : (
          <>
            {viewMode === 'base' && activeRoster.map(player => {
              const teamId = allianceDraft?.playerMeta?.[player.id]?.teamId;
              const team = teams.find(t => t.id === teamId);
              const dotColor = team ? TEAM_COLORS[team.color]?.text : 'text-transparent';
              const canDrag = marchesLeft[player.id] > 0;
              const isFocused = focusedPlayerId === player.id;

              return (
                <div key={player.id} draggable={canManageEvent && canDrag} onDragStart={(e) => handleDragStart(e, player.id)} className={`flex items-center justify-between p-2 border transition-colors rounded-lg mb-1 ${isFocused ? 'bg-indigo-900/60 border-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]' : 'border-transparent hover:bg-slate-800/50 hover:border-slate-700'} ${canManageEvent && canDrag ? 'cursor-grab active:cursor-grabbing' : 'opacity-50'}`}>
                  <div className="font-bold text-xs flex items-center gap-2"><span className={dotColor}>●</span> {player.name}</div>
                  <div className="flex items-center gap-3">
                    {isFocused && <span className="text-[10px] text-indigo-400 font-bold uppercase animate-pulse">{t('tri_alliance.sidebar.focusActive')}</span>}
                    <button onClick={(e) => { e.stopPropagation(); toggleFocus(player.id); }} className={`w-6 h-6 flex items-center justify-center rounded transition-all ${isFocused ? 'bg-indigo-500 text-white shadow-[0_0_8px_rgba(99,102,241,0.8)]' : 'bg-slate-800 text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/20'}`}>👁️</button>
                    <div className="flex gap-1">
                      {[...Array(3)].map((_, i) => <div key={i} className={`w-2.5 h-2.5 rounded-full border ${i < marchesLeft[player.id] ? 'bg-emerald-500 border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-800 border-slate-700 opacity-50'}`}></div>)}
                    </div>
                  </div>
                </div>
              );
            })}

            {viewMode === 'advanced' && (
              <div className="flex flex-col gap-3">
                {canManageEvent && (
                  <button onClick={onOpenTeamBuilder} className="w-full py-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white rounded-lg text-xs font-black transition-all shadow-md uppercase tracking-wider flex justify-center items-center gap-2">
                    <span>🛡️</span> {t('tri_alliance.sidebar.editTeams')}
                  </button>
                )}
                {teams.map(team => {
                  const teamPlayers = activeRoster.filter(p => allianceDraft?.playerMeta?.[p.id]?.teamId === team.id);
                  if (teamPlayers.length === 0) return null;
                  const theme = TEAM_COLORS[team.color] || TEAM_COLORS.cyan;

                  return (
                    <div key={team.id} className="bg-slate-950/80 rounded-xl border border-slate-800 overflow-hidden shadow-md">
                      <div className={`px-3 py-2 border-b border-slate-800 flex justify-between items-center ${theme.zone}`}>
                        <span className={`text-[11px] font-black uppercase tracking-wider ${theme.text}`}>{team.name}</span>
                        <span className="text-[9px] font-bold text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700">{teamPlayers.length} {t('tri_alliance.sidebar.members')}</span>
                      </div>
                      <div className="flex flex-col p-1">
                        {teamPlayers.map(player => {
                          const canDrag = marchesLeft[player.id] > 0;
                          const isFocused = focusedPlayerId === player.id;
                          return (
                            <div key={player.id} draggable={canManageEvent && canDrag} onDragStart={(e) => handleDragStart(e, player.id)} className={`flex items-center justify-between p-2 rounded transition-colors border ${isFocused ? 'bg-indigo-900/60 border-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]' : 'border-transparent hover:bg-slate-800 hover:border-slate-700'} ${canManageEvent && canDrag ? 'cursor-grab active:cursor-grabbing' : 'opacity-50'}`}>
                              <span className="font-bold text-xs text-slate-300 truncate pr-2">{player.name}</span>
                              <div className="flex items-center gap-2 shrink-0">
                                <button onClick={(e) => { e.stopPropagation(); toggleFocus(player.id); }} className={`w-5 h-5 flex items-center justify-center rounded transition-all text-[10px] ${isFocused ? 'bg-indigo-500 text-white shadow-[0_0_8px_rgba(99,102,241,0.8)]' : 'bg-slate-800 text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/20'}`}>👁️</button>
                                <div className="flex gap-0.5">{[...Array(3)].map((_, i) => <div key={i} className={`w-2 h-2 rounded-full border ${i < marchesLeft[player.id] ? 'bg-emerald-500 border-emerald-400' : 'bg-slate-800 border-slate-700 opacity-50'}`}></div>)}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {unassignedPlayers.length > 0 && (
                  <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden shadow-md mt-2">
                    <div className="px-3 py-2 border-b border-slate-800 flex justify-between items-center bg-slate-800/30">
                      <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">{t('tri_alliance.sidebar.noTeam')}</span>
                      <span className="text-[9px] font-bold text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700">{unassignedPlayers.length} {t('tri_alliance.sidebar.members')}</span>
                    </div>
                    <div className="flex flex-col p-1">
                      {unassignedPlayers.map(player => {
                        const canDrag = marchesLeft[player.id] > 0;
                        const isFocused = focusedPlayerId === player.id;
                        return (
                          <div key={player.id} draggable={canManageEvent && canDrag} onDragStart={(e) => handleDragStart(e, player.id)} className={`flex items-center justify-between p-2 rounded transition-colors border ${isFocused ? 'bg-indigo-900/60 border-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]' : 'border-transparent hover:bg-slate-800/50 hover:border-slate-700'} ${canManageEvent && canDrag ? 'cursor-grab active:cursor-grabbing' : 'opacity-50'}`}>
                            <span className="font-bold text-xs text-slate-400 truncate pr-2">{player.name}</span>
                            <div className="flex items-center gap-2 shrink-0">
                                <button onClick={(e) => { e.stopPropagation(); toggleFocus(player.id); }} className={`w-5 h-5 flex items-center justify-center rounded transition-all text-[10px] ${isFocused ? 'bg-indigo-500 text-white shadow-[0_0_8px_rgba(99,102,241,0.8)]' : 'bg-slate-800 text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/20'}`}>👁️</button>
                                <div className="flex gap-0.5">{[...Array(3)].map((_, i) => <div key={i} className={`w-2 h-2 rounded-full border ${i < marchesLeft[player.id] ? 'bg-emerald-500 border-emerald-400' : 'bg-slate-800 border-slate-700 opacity-50'}`}></div>)}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <div className="p-3 border-t border-slate-800 bg-slate-900 flex flex-col gap-2 shadow-[0_-10px_20px_rgba(0,0,0,0.2)] shrink-0">
        <div className="text-[10px] uppercase font-bold text-slate-500 tracking-widest text-center">{t('tri_alliance.sidebar.projection')}</div>
        <div className="grid grid-cols-3 gap-1.5">
          {scoreAnalysis.phases.map(p => (
            <div key={p.phase} className={`flex flex-col items-center justify-center p-1.5 rounded-lg border transition-all ${currentPhase === p.phase ? 'bg-cyan-900/20 border-cyan-500/50 shadow-inner' : 'bg-slate-950 border-slate-800'}`}>
              <span className={`text-[9px] font-black uppercase tracking-wider ${currentPhase === p.phase ? 'text-cyan-400' : 'text-slate-500'}`}>{t('tri_alliance.sidebar.phaseLabel')} {p.phase}</span>
              <span className={`text-xs font-black mt-0.5 ${p.expected > 0 ? 'text-emerald-400' : 'text-slate-600'}`}>{p.expected.toLocaleString()}</span>
              <span className="text-[8px] font-bold text-slate-600">/ {p.available.toLocaleString()}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-between items-center bg-slate-950 p-2.5 rounded-xl border border-amber-900/30 mt-1">
          <span className="text-xs font-black text-amber-500 uppercase tracking-wider">{t('tri_alliance.sidebar.totalExpected')}</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-black text-amber-400 drop-shadow-md">{scoreAnalysis.totalExpected.toLocaleString()}</span>
            <span className="text-[10px] font-bold text-slate-600">/ {scoreAnalysis.totalAvailable.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}