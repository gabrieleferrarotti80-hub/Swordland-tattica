import React, { useState } from 'react';

export default function ParticipantsModal({ roster, initialParticipants, onClose, onSave }) {
  const [tempParticipants, setTempParticipants] = useState([...initialParticipants]);

  const toggleParticipant = (playerId) => {
    if (tempParticipants.includes(playerId)) {
      setTempParticipants(tempParticipants.filter(id => id !== playerId));
    } else {
      setTempParticipants([...tempParticipants, playerId]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg flex flex-col max-h-[85vh] shadow-[0_0_50px_rgba(0,0,0,0.8)]">
        <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-950/50 rounded-t-2xl">
          <h2 className="text-xl font-black text-cyan-400">👥 Iscritti all'Evento</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-2">✕</button>
        </div>
        
        <div className="p-4 bg-slate-800 border-b border-slate-700 flex justify-between gap-4">
          <button onClick={() => setTempParticipants(roster.map(p => p.id))} className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 rounded text-xs font-bold transition-colors">Seleziona Tutti</button>
          <button onClick={() => setTempParticipants([])} className="flex-1 py-2 bg-slate-700 hover:bg-rose-600/50 hover:text-rose-200 rounded text-xs font-bold transition-colors">Deseleziona Tutti</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar flex flex-col gap-2">
           {roster.map(player => {
              const isSelected = tempParticipants.includes(player.id);
              return (
                <div 
                  key={player.id} 
                  onClick={() => toggleParticipant(player.id)}
                  className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all border ${isSelected ? 'bg-cyan-900/40 border-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.2)]' : 'bg-slate-950/50 border-slate-800 opacity-60 hover:opacity-100'}`}
                >
                  <span className={`font-bold ${isSelected ? 'text-cyan-300' : 'text-slate-400'}`}>{player.name}</span>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? 'bg-cyan-500 border-cyan-400' : 'bg-transparent border-slate-600'}`}>
                    {isSelected && <span className="text-xs text-slate-900">✓</span>}
                  </div>
                </div>
              );
           })}
        </div>

        <div className="p-4 border-t border-slate-700 flex justify-between items-center bg-slate-950/50 rounded-b-2xl">
           <div className="text-sm font-bold text-slate-400">Selezionati: <span className="text-cyan-400">{tempParticipants.length}</span></div>
           <button onClick={() => onSave(tempParticipants)} className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl shadow-lg transition-transform hover:scale-105">
             💾 Conferma e Salva
           </button>
        </div>
      </div>
    </div>
  );
}