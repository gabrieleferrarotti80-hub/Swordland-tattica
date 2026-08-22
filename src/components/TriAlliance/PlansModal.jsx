import React, { useState } from 'react';

export default function PlansModal({ savedPlans, onClose, onSaveAs, onLoad, onDelete }) {
  const [newPlanName, setNewPlanName] = useState('');

  const handleSave = (e) => {
    e.preventDefault();
    if (!newPlanName.trim()) return;
    onSaveAs(newPlanName.trim());
    setNewPlanName('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        
        {/* HEADER */}
        <div className="p-6 border-b border-slate-800 flex justify-between items-start bg-slate-950/50 shrink-0">
          <div>
            <h2 className="text-xl font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
              <span>💾</span> Archivio Piani Tattici
            </h2>
            <p className="text-xs text-slate-400 mt-1">Salva la disposizione attuale o carica una strategia passata.</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-full w-8 h-8 flex items-center justify-center font-bold">✕</button>
        </div>

        <div className="p-6 flex flex-col gap-6 overflow-hidden">
          
          {/* SEZIONE SALVATAGGIO NUOVO PIANO */}
          <form onSubmit={handleSave} className="flex gap-3 bg-slate-800/50 p-4 rounded-2xl border border-indigo-900/50 shadow-inner shrink-0">
            <input 
              type="text" 
              value={newPlanName} 
              onChange={(e) => setNewPlanName(e.target.value)}
              placeholder="Nome della strategia (es. Tattica Base Sud)..." 
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 font-bold"
            />
            <button 
              type="submit" 
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-black px-6 py-3 rounded-xl transition-all shadow-lg whitespace-nowrap"
            >
              Salva Attuale
            </button>
          </form>

          {/* LISTA PIANI SALVATI */}
          <div className="flex flex-col gap-3 overflow-y-auto custom-scrollbar pr-2 pb-4">
            <div className="text-[10px] uppercase font-bold text-slate-500 tracking-widest border-b border-slate-800 pb-2">
              Strategie Archiviate ({savedPlans.length})
            </div>
            
            {savedPlans.length === 0 ? (
              <div className="text-center text-slate-500 italic py-10">
                <span className="text-3xl block mb-3 opacity-50">📂</span>
                Nessun piano salvato in archivio per questa Alleanza.
              </div>
            ) : (
              savedPlans.map(plan => (
                <div key={plan.id} className="bg-slate-950 border border-slate-800 p-4 rounded-2xl flex justify-between items-center group hover:border-indigo-500/50 transition-colors shadow-sm">
                  <div className="flex flex-col">
                    <span className="text-sm font-black text-white">{plan.name}</span>
                    <span className="text-[10px] text-slate-500 font-bold mt-1">🕒 Salvato il: {plan.date}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => onLoad(plan)}
                      className="bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white px-4 py-2 rounded-lg text-xs font-bold transition-all border border-emerald-500/30 uppercase tracking-wider"
                    >
                      Carica
                    </button>
                    <button 
                      onClick={() => onDelete(plan.id)}
                      className="bg-rose-900/30 text-rose-500 hover:bg-rose-600 hover:text-white w-8 h-8 rounded-lg flex items-center justify-center font-bold transition-all border border-rose-500/30"
                      title="Elimina"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

        </div>
      </div>
    </div>
  );
}