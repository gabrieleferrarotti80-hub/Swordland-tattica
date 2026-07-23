import React from 'react';

export const GarrisonPopup = ({ 
  building, 
  garrisonedPlayers, 
  onClose, 
  handleGarrisonAction 
}) => {
  
  if (!building) return null;

  // Se l'edificio è nella metà superiore della mappa (y < 30%), mostriamo il popup verso il BASSO
  const isNearTop = building.y < 30;

  return (
    <div 
      className={`absolute z-[100] transform -translate-x-1/2 ${isNearTop ? 'mt-6' : '-mt-6 -translate-y-full'} drop-shadow-2xl`} 
      style={{ left: `${building.x}%`, top: `${building.y}%` }}
    >
      
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-64 overflow-hidden flex flex-col shadow-xl animate-in fade-in zoom-in duration-200 relative z-10">
        
        {/* Header Edificio */}
        <div className="bg-slate-800 px-4 py-2 flex justify-between items-center border-b border-slate-700">
          <span className="text-sm font-bold text-cyan-400 truncate tracking-wider uppercase">{building.name}</span>
          <button onClick={onClose} className="text-slate-400 hover:text-white flex items-center justify-center w-6 h-6 rounded-full hover:bg-slate-700 transition-colors">✕</button>
        </div>

        {/* Lista Giocatori */}
        <div className="max-h-48 overflow-y-auto p-2 space-y-1 scrollbar-thin scrollbar-thumb-slate-700">
          {garrisonedPlayers.length === 0 ? (
            <div className="text-xs text-slate-500 text-center py-3 italic">Nessun difensore in presidio.</div>
          ) : (
            garrisonedPlayers.map((player, idx) => (
              <div key={`${player.id}-${idx}`} className="flex justify-between items-center bg-slate-800/50 rounded px-2 py-1.5 hover:bg-slate-800 transition-colors">
                <span className="text-xs text-slate-300 font-medium truncate flex-1 flex items-center gap-1.5">
                  {player.isLeader ? <span title="Leader del Presidio" className="text-[14px]">👑</span> : <span className="text-[14px] opacity-50">⚔️</span>}
                  {player.name}
                </span>
                <button 
                  onClick={() => handleGarrisonAction('retreat_single', building.id, player.id)}
                  className="ml-2 px-2.5 py-1 bg-slate-700 hover:bg-amber-600 text-[10px] text-white font-bold uppercase tracking-wider rounded transition-colors shadow-sm"
                  title="Ritira questo giocatore alla base"
                >
                  Ritira
                </button>
              </div>
            ))
          )}
        </div>

        {/* Azioni Globali */}
        {garrisonedPlayers.length > 0 && (
          <div className="p-2 border-t border-slate-700 bg-slate-800/30 flex flex-col gap-2">
            <button 
              onClick={() => { handleGarrisonAction('retreat_all', building.id); onClose(); }}
              className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-[11px] font-bold text-white uppercase tracking-wider rounded transition-colors shadow-sm"
            >
              🏳️ Ritira Tutte le Truppe
            </button>
            
            <button 
              onClick={() => { handleGarrisonAction('defeat', building.id); onClose(); }}
              className="w-full py-2 bg-red-900/40 hover:bg-red-600 border border-red-700/50 text-[11px] font-bold text-red-200 hover:text-white uppercase tracking-wider rounded transition-colors shadow-sm"
              title="Ritira tutti e cedi l'edificio agli avversari"
            >
              💥 Sconfitta (Cedi Edificio)
            </button>
          </div>
        )}
      </div>
      
      {/* Triangolino Direzionale Adattivo */}
      <div className={`absolute ${isNearTop ? '-top-2' : '-bottom-2'} left-1/2 transform -translate-x-1/2 w-4 h-4 bg-slate-900 border-slate-700 rotate-45 pointer-events-none ${isNearTop ? 'border-t border-l' : 'border-b border-r'} z-20`}></div>
    </div>
  );
};