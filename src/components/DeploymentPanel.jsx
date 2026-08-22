import React from 'react';
import { useTranslation } from 'react-i18next';

export const DeploymentPanel = ({ 
  activeDeployment, 
  getAvailableMarches, 
  healingEvents, 
  currentTime, 
  getCurrentPosition, 
  handleWithdraw, 
  handleHeal, 
  handleCancelHeal 
}) => {
  const { t } = useTranslation();

  if (!activeDeployment || activeDeployment.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 opacity-50 p-4 text-center">
        <span className="text-4xl mb-2">🏕️</span>
        <p className="text-xs font-bold uppercase tracking-widest">Nessuna truppa</p>
        <p className="text-[9px] mt-1">Approva lo schieramento dal Roster per iniziare.</p>
      </div>
    );
  }

  // 💡 Raggruppamento intelligente dei giocatori per Squadra
  const groupedPlayers = {
    'Assalto': [],
    'Difesa': [],
    'Supporto': [],
    'Altro': []
  };

  activeDeployment.forEach(player => {
    const sq = (player.squad || '').toLowerCase();
    if (sq.includes('assalt') || sq.includes('attacc')) groupedPlayers['Assalto'].push(player);
    else if (sq.includes('difes')) groupedPlayers['Difesa'].push(player);
    else if (sq.includes('support')) groupedPlayers['Supporto'].push(player);
    else groupedPlayers['Altro'].push(player);
  });

  const renderPlayerCard = (player, sqColors) => {
    const availableMarches = getAvailableMarches(player.id);
    const isHealingInfo = healingEvents[player.id];
    const isHealing = isHealingInfo && currentTime >= isHealingInfo.start && currentTime < isHealingInfo.end;
    const currentPos = getCurrentPosition(player.id);
    
    let positionText = null;
    let isDeployed = false;
    
    if (currentPos) {
      if (currentPos.type === 'march') { positionText = `In Marcia ➔ ${currentPos.targetId}`; isDeployed = true; } 
      else if (currentPos.type === 'garrison') { positionText = `In Presidio 🛡️`; isDeployed = true; } 
      else if (currentPos.type === 'returning') { positionText = `Ritorno in Base ↩️`; isDeployed = true; }
    }

    return (
      <div 
        key={player.id} 
        draggable={!isHealing && availableMarches > 0} 
        onDragStart={(e) => {
          if (isHealing || availableMarches === 0) { e.preventDefault(); return; }
          e.dataTransfer.setData('text/plain', `player:${player.id}`);
        }}
        className={`flex flex-col bg-slate-900 border rounded-xl overflow-hidden shadow-sm transition-all ${
          isHealing 
            ? 'border-emerald-900/50 opacity-80 cursor-not-allowed' 
            : availableMarches === 0 
              ? 'border-slate-800/50 opacity-60 cursor-not-allowed'
              : `${sqColors.border} hover:${sqColors.hoverBorder} cursor-grab active:cursor-grabbing`
        }`}
      >
        {/* RIGA 1: NOME E BOTTONI */}
        <div className={`p-2 flex items-center justify-between gap-1.5 ${sqColors.headerBg}`}>
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className={`${sqColors.tagBg} ${sqColors.tagBorder} ${sqColors.tagText} border font-bold text-[8px] px-1.5 py-0.5 rounded shrink-0 uppercase`}>
              {player.originalTag || player.tag || 'PLY'}
            </span>
            <span className="font-bold text-slate-100 text-[11px] truncate" title={player.name}>
              {player.name}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {isHealing ? (
              <button onClick={() => handleCancelHeal(player.id)} className="bg-emerald-900/80 hover:bg-emerald-700 text-emerald-300 px-1.5 py-0.5 rounded text-[8px] font-black uppercase transition-colors">✕ Ferma Cura</button>
            ) : (
              <button onClick={() => handleHeal(player.id)} className="bg-slate-800 hover:bg-emerald-900 border border-slate-600 hover:border-emerald-600 text-slate-300 hover:text-emerald-400 px-1.5 py-0.5 rounded text-[8px] font-black uppercase transition-colors flex items-center gap-0.5" title="Manda in Cura (12 minuti)">🏥 Cura</button>
            )}
            <span className="bg-slate-950 border border-slate-700 text-slate-400 text-[8px] font-black px-1.5 py-0.5 rounded uppercase">{player.role || player.level || 'LV'}</span>
          </div>
        </div>

        {/* RIGA 2: STATISTICHE */}
        <div className="px-2 pb-2 pt-1 flex items-center justify-between text-[9px] text-slate-400">
          <span className="flex items-center gap-1">Potere: <strong className="text-white">{player.power}M</strong></span>
          <span className="flex items-center gap-1">Marce: <strong className={availableMarches > 0 ? 'text-white' : 'text-slate-500'}>{availableMarches}/{player.marches}</strong></span>
        </div>

        {/* RIGA 3: STATUS BAR */}
        {isHealing && (
          <div className="bg-emerald-950/60 border-t border-emerald-900/50 px-2 py-1 flex justify-between items-center text-[9px] font-bold text-emerald-400 uppercase tracking-widest">
            <span>🏥 In Ospedale</span><span>Fine: {Math.floor(isHealingInfo.end)}'</span>
          </div>
        )}

        {!isHealing && isDeployed && (
          <div className="bg-indigo-950/40 border-t border-indigo-900/50 px-2 py-1 flex justify-between items-center">
            <span className="text-[9px] font-bold text-indigo-300 truncate pr-2">{positionText}</span>
            <button onClick={() => handleWithdraw(player.id, currentPos.targetId, currentPos.marchIndex)} className="shrink-0 text-[8px] font-black bg-rose-900/50 hover:bg-rose-600 text-rose-300 px-1.5 py-0.5 rounded uppercase transition-colors">↩️ Ritira</button>
          </div>
        )}
      </div>
    );
  };

  const renderSquadSection = (title, players, sqColors) => {
    if (players.length === 0) return null;
    return (
      <div className="mb-5">
        <h3 className={`text-[10px] font-black uppercase tracking-widest mb-2 px-2 border-l-2 ${sqColors.titleBorder} ${sqColors.titleText} flex items-center justify-between`}>
          <span>{title} <span className="opacity-50 ml-1">({players.length})</span></span>
        </h3>
        <div className="flex flex-col gap-2">
          {players.map(p => renderPlayerCard(p, sqColors))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col pb-4">
      {/* 💡 GENERAZIONE SEZIONI CON COLORI DINAMICI */}
      {renderSquadSection('⚔️ Squadra Assalto', groupedPlayers['Assalto'], {
        border: 'border-rose-900/50', hoverBorder: 'border-rose-500/80 shadow-[0_0_8px_rgba(244,63,94,0.3)]',
        headerBg: 'bg-rose-950/30', tagBg: 'bg-rose-950', tagBorder: 'border-rose-800', tagText: 'text-rose-300',
        titleBorder: 'border-rose-500', titleText: 'text-rose-400'
      })}
      {renderSquadSection('🛡️ Squadra Difesa', groupedPlayers['Difesa'], {
        border: 'border-blue-900/50', hoverBorder: 'border-blue-500/80 shadow-[0_0_8px_rgba(59,130,246,0.3)]',
        headerBg: 'bg-blue-950/30', tagBg: 'bg-blue-950', tagBorder: 'border-blue-800', tagText: 'text-blue-300',
        titleBorder: 'border-blue-500', titleText: 'text-blue-400'
      })}
      {renderSquadSection('🤝 Squadra Supporto', groupedPlayers['Supporto'], {
        border: 'border-emerald-900/50', hoverBorder: 'border-emerald-500/80 shadow-[0_0_8px_rgba(16,185,129,0.3)]',
        headerBg: 'bg-emerald-950/30', tagBg: 'bg-emerald-950', tagBorder: 'border-emerald-800', tagText: 'text-emerald-300',
        titleBorder: 'border-emerald-500', titleText: 'text-emerald-400'
      })}
      {renderSquadSection('⚪ Altre Formazioni', groupedPlayers['Altro'], {
        border: 'border-slate-700/80', hoverBorder: 'border-cyan-500/50 shadow-[0_0_8px_rgba(34,211,238,0.3)]',
        headerBg: 'bg-slate-800/20', tagBg: 'bg-cyan-950', tagBorder: 'border-cyan-800', tagText: 'text-cyan-300',
        titleBorder: 'border-slate-500', titleText: 'text-slate-400'
      })}
    </div>
  );
};