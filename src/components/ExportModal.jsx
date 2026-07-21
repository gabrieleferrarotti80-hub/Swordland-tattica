import React, { useState, useMemo } from 'react';

export const ExportModal = ({ isOpen, onClose, marches, activeDeployment, roster = [] }) => {
  const [copiedLeader, setCopiedLeader] = useState(null);

  const playerStrategies = useMemo(() => {
    if (!marches || marches.length === 0) return {};

    const strategies = {};
    const movementsList = [];

    marches.forEach(march => {
      // 1. Cerchiamo prima in activeDeployment
      let player = activeDeployment.find(p => String(p.id) === String(march.leader));
      
      // 2. Se non c'è, cerchiamo nel roster generale
      if (!player) {
        player = roster.find(r => String(r.id) === String(march.leader));
      }

      // 3. Estraiamo il nome o il tag in modo sicuro
      const playerName = player ? (player.name || player.tag || `Giocatore_${march.leader}`) : `Comandante_${march.leader}`;

      if (march.positions) {
        Object.entries(march.positions).forEach(([minStr, pos]) => {
          if (pos.isMarching && pos.startTime !== undefined && pos.targetName) {
            movementsList.push({
              playerName: playerName,
              startMinute: Math.round(Number(pos.startTime)),
              arrivalMinute: Math.round(Number(pos.arrivalTime)),
              targetName: pos.targetName,
              marchType: pos.marchType || 'attacco'
            });
          }
        });
      }
    });

    // Ordiniamo cronologicamente per minuto di partenza
    movementsList.sort((a, b) => a.startMinute - b.startMinute);

    // Raggruppiamo usando il Nome del Giocatore
    movementsList.forEach(m => {
      if (!strategies[m.playerName]) {
        strategies[m.playerName] = {
          name: m.playerName,
          text: `📜 *ORDINI TATTICI: ${m.playerName.toUpperCase()}*\n\n`
        };
      }

      const iconType = m.marchType === 'difesa' ? '🛡️ Difesa' : m.marchType === 'supporto' ? '🤝 Supporto' : '⚔️ Attacco';

      strategies[m.playerName].text += `⏱️ **Minuto ${m.startMinute.toString().padStart(2, '0')}'**\n`;
      strategies[m.playerName].text += `👉 Tipo: ${iconType}\n`;
      strategies[m.playerName].text += `🎯 Bersaglio: **${m.targetName}**\n`;
      strategies[m.playerName].text += `🏁 Arrivo previsto: min ${m.arrivalMinute.toString().padStart(2, '0')}'\n\n`;
    });

    return strategies;
  }, [marches, activeDeployment, roster]);

  const handleCopy = (playerName, text) => {
    navigator.clipboard.writeText(text);
    setCopiedLeader(playerName);
    setTimeout(() => setCopiedLeader(null), 2000);
  };

  if (!isOpen) return null;

  const leaders = Object.values(playerStrategies);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        
        {/* Header Modal */}
        <div className="flex justify-between items-center p-6 border-b border-slate-800">
          <div>
            <h2 className="text-xl font-black text-cyan-400 uppercase tracking-widest">Condividi Strategia</h2>
            <p className="text-xs text-slate-400 mt-1">Copia gli ordini associati al nome corretto del giocatore</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white transition-colors bg-slate-800 hover:bg-slate-700 rounded-full">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body Modal */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
          {leaders.length === 0 ? (
            <div className="text-center text-slate-500 py-10">
              Nessuna marcia pianificata nella timeline al momento.
            </div>
          ) : (
            leaders.map(item => (
              <div key={item.name} className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4 flex gap-4 items-start">
                <div className="flex-1 whitespace-pre-wrap text-sm font-mono text-slate-300">
                  {item.text}
                </div>
                <button
                  onClick={() => handleCopy(item.name, item.text)}
                  className={`shrink-0 px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${
                    copiedLeader === item.name 
                      ? 'bg-emerald-500 text-white' 
                      : 'bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500 hover:text-white border border-cyan-500/30'
                  }`}
                >
                  {copiedLeader === item.name ? (
                    <>✓ Copiato</>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                      Copia
                    </>
                  )}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};