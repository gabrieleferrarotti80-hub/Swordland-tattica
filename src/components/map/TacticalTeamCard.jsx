import React, { useState } from 'react';
import { useTranslation } from 'react-i18next'; // 🌍 Import i18n
import { calculateDeployment, TEAM_COLORS } from '../../utils/tacticalDeployment';

export default function TacticalTeamCard({ 
  team, 
  teamIndex,
  teamPlayers, 
  draftMeta, 
  playerOverrides, 
  setPlayerOverrides, 
  isReadOnly 
}) {
  const { t } = useTranslation(); // 🌍 Hook in azione
  const [isExpanded, setIsExpanded] = useState(false);
  const [maxRadius, setMaxRadius] = useState(20);
  const [history, setHistory] = useState(null); 

  const teamColor = TEAM_COLORS[teamIndex % TEAM_COLORS.length];

  const leader = teamPlayers.find(p => draftMeta[p.id]?.role === 'Rally Leader') 
              || teamPlayers.find(p => draftMeta[p.id]?.role === 'Capitano Difesa')
              || teamPlayers[0];

 const handleDeploy = (e) => {
    e.stopPropagation();
    if (isReadOnly || !leader) return;

    const leaderX = playerOverrides[leader.id]?.x ?? leader.x;
    const leaderY = playerOverrides[leader.id]?.y ?? leader.y;

    if (leaderX === '' || leaderY === '' || leaderX == null || leaderY == null) {
      return alert(t('tactical_team_card.error_leader_pos', { name: leader.name }));
    }

    const fillers = teamPlayers.filter(p => p.id !== leader.id);
    if (fillers.length === 0) return alert(t('tactical_team_card.error_no_fillers'));

    setHistory({ ...playerOverrides });

    const castleBuilding = { x: 597, y: 597 };

    const result = calculateDeployment(leaderX, leaderY, fillers.length, playerOverrides, maxRadius, castleBuilding);
    
    if (!result.success) alert(t('tactical_team_card.error_space', { radius: maxRadius }));

    const newOverrides = { ...playerOverrides };
    fillers.forEach((filler, index) => {
      if (result.placements[index]) newOverrides[filler.id] = result.placements[index];
    });
    setPlayerOverrides(newOverrides);
  };

const handleUndo = (e) => {
    e.stopPropagation();
    if (isReadOnly) return;

    const newOverrides = { ...playerOverrides };
    const fillers = teamPlayers.filter(p => p.id !== leader?.id);

    fillers.forEach(filler => {
      if (history && history[filler.id]) {
        newOverrides[filler.id] = history[filler.id];
      } else {
        delete newOverrides[filler.id];
      }
    });

    setPlayerOverrides(newOverrides);
    setHistory(null); 
  };

  return (
    <div className="bg-slate-900 border rounded-xl flex flex-col overflow-hidden shadow-sm transition-all mb-2" style={{ borderColor: `${teamColor}40` }}>
      
      <div 
        className="p-3 flex justify-between items-center cursor-pointer hover:bg-slate-800 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex flex-col min-w-0 pr-2 border-l-4 pl-2" style={{ borderColor: teamColor }}>
          <span className="text-xs font-black truncate tracking-wider" style={{ color: teamColor }}>{team.name}</span>
          <span className="text-[10px] text-slate-400 truncate mt-0.5">
            {t('tactical_team_card.leader')}<span className="font-bold text-white">{leader ? leader.name : t('tactical_team_card.nobody')}</span>
          </span>
        </div>
        
        <div className="flex flex-col items-end gap-1 shrink-0">
          <div className="flex items-center gap-1">
            {history && !isReadOnly && (
              <button onClick={handleUndo} className="bg-rose-900/80 hover:bg-rose-600 text-rose-200 px-2 py-0.5 rounded text-[9px] font-black uppercase transition-colors" title={t('tactical_team_card.undo_tooltip')}>
                {t('tactical_team_card.undo_btn')}
              </button>
            )}
            {!isReadOnly && leader && (
              <button onClick={handleDeploy} className="bg-emerald-600/80 hover:bg-emerald-500 text-white px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider transition-colors shadow-sm">
                {t('tactical_team_card.deploy_btn')}
              </button>
            )}
          </div>
          <span className="text-[9px] font-bold text-slate-500">{t('tactical_team_card.members', { count: teamPlayers.length })} {isExpanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {isExpanded && (
        <div className="p-2 border-t flex flex-col gap-1.5 bg-slate-950/50" style={{ borderColor: `${teamColor}20` }}>
          
          {!isReadOnly && (
            <div className="flex items-center justify-between bg-slate-900 p-1.5 rounded border border-slate-800 mb-1">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{t('tactical_team_card.radius')}</span>
              <div className="flex items-center gap-1">
                <input type="range" min="3" max="25" value={maxRadius} onChange={e => setMaxRadius(Number(e.target.value))} className="w-16 accent-emerald-500" />
                <span className="text-[9px] text-emerald-400 font-bold w-4">{maxRadius}</span>
              </div>
            </div>
          )}

          <div className="max-h-48 overflow-y-auto custom-scrollbar pr-1 flex flex-col gap-1">
            {teamPlayers.map(player => {
              const override = playerOverrides[player.id];
              const currentX = override?.x ?? player.x ?? '';
              const currentY = override?.y ?? player.y ?? '';
              const role = draftMeta[player.id]?.role;
              const isLeader = player.id === leader?.id;
              
              return (
                <div 
                  key={player.id} 
                  draggable={!isReadOnly}
                  onDragStart={(e) => { if(!isReadOnly) e.dataTransfer.setData('text/plain', `player:${player.id}`); }}
                  className={`p-1.5 rounded flex justify-between items-center group border ${isLeader ? 'bg-slate-800' : 'bg-slate-900/50 border-transparent'}`}
                  style={{ borderColor: isLeader ? teamColor : 'transparent' }}
                >
                  <div className="flex flex-col min-w-0 pr-1">
                    <span className={`text-[10px] font-bold truncate ${isLeader ? 'text-white' : 'text-slate-400'}`}>
                      [{player.originalTag || player.tag || '?'}] {player.name}
                    </span>
                    <span className="text-[8px] text-slate-500 font-bold uppercase">{role || t('tactical_team_card.member_role')}</span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <input disabled={isReadOnly} type="number" placeholder="X" value={currentX} onChange={(e) => { const val = e.target.value === '' ? '' : Number(e.target.value); setPlayerOverrides(prev => ({...prev, [player.id]: { x: val, y: currentY === '' ? 0 : currentY }})); }} className="w-9 bg-slate-950 border border-slate-700 focus:border-cyan-400 text-cyan-300 text-center text-[9px] rounded p-0.5 font-mono outline-none disabled:opacity-50" />
                    <input disabled={isReadOnly} type="number" placeholder="Y" value={currentY} onChange={(e) => { const val = e.target.value === '' ? '' : Number(e.target.value); setPlayerOverrides(prev => ({...prev, [player.id]: { x: currentX === '' ? 0 : currentX, y: val }})); }} className="w-9 bg-slate-950 border border-slate-700 focus:border-amber-400 text-amber-300 text-center text-[9px] rounded p-0.5 font-mono outline-none disabled:opacity-50" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}