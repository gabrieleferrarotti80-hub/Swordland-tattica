import React, { useState, useMemo } from 'react';

export default function TacticalExportModal({ isOpen, onClose, playerOverrides, roster, targetBuilding }) {
  const [copiedPlayer, setCopiedPlayer] = useState(null);

  // Generiamo gli ordini solo per i giocatori che sono stati "spostati" nel simulatore
  const tacticalOrders = useMemo(() => {
    if (!playerOverrides || Object.keys(playerOverrides).length === 0) return {};

    const orders = {};
    const rawArray = Array.isArray(roster) ? roster : (roster?.players || []);

    Object.entries(playerOverrides).forEach(([playerId, coords]) => {
      const player = rawArray.find(p => String(p.id) === String(playerId));
      if (!player) return;

      const playerName = player.name || player.tag || `Giocatore_${playerId}`;
      const targetName = targetBuilding ? targetBuilding.name : 'Punto Tattico';

      orders[playerId] = {
        name: playerName,
        text: `📜 *ORDINI TATTICI: ${playerName.toUpperCase()}*\n\n` +
              `🎯 Evento: **${targetName}**\n` +
              `📍 Riposizionamento richiesto:\n` +
              `👉 Coordinate: **X: ${coords.x} | Y: ${coords.y}**\n\n` +
              `⚠️ Spostati in questa posizione prima dell'inizio dell'evento!`
      };
    });

    return orders;
  }, [playerOverrides, roster, targetBuilding]);

  const handleCopy = (playerId, text) => {
    navigator.clipboard.writeText(text);
    setCopiedPlayer(playerId);
    setTimeout(() => setCopiedPlayer(null), 2000);
  };

  if (!isOpen) return null;

  const ordersList = Object.entries(tacticalOrders);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        
        <div className="flex justify-between items-center p-6 border-b border-slate-800">
          <div>
            <h2 className="text-xl font-black text-cyan-400 uppercase tracking-widest">Esporta Ordini Tattici</h2>
            <p className="text-xs text-slate-400 mt-1">Copia le coordinate di schieramento per i membri dell'alleanza</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white transition-colors bg-slate-800 hover:bg-slate-700 rounded-full">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {ordersList.length === 0 ? (
            <div className="text-center text-slate-500 py-10">
              Nessun giocatore riposizionato. Trascina i membri sulla mappa per generare gli ordini.
            </div>
          ) : (
            ordersList.map(([id, item]) => (
              <div key={id} className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4 flex gap-4 items-start">
                <div className="flex-1 whitespace-pre-wrap text-sm font-mono text-slate-300">
                  {item.text}
                </div>
                <button
                  onClick={() => handleCopy(id, item.text)}
                  className={`shrink-0 px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${
                    copiedPlayer === id 
                      ? 'bg-emerald-500 text-white' 
                      : 'bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500 hover:text-white border border-cyan-500/30'
                  }`}
                >
                  {copiedPlayer === id ? '✓ Copiato' : 'Copia'}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}