import React, { useState } from 'react';

export default function RosterExcelModal({ isOpen, onClose, onImport, t }) {
  const [pastedData, setPastedData] = useState('');
  const [parsedPlayers, setParsedPlayers] = useState([]);
  const [isReviewing, setIsReviewing] = useState(false);

  if (!isOpen) return null;

  const handleParse = () => {
    if (!pastedData.trim()) return;

    // Excel incolla le righe separate da "a capo" (\n) e le colonne separate da "tab" (\t)
    const lines = pastedData.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const players = [];

    lines.forEach(line => {
      const cols = line.split('\t').map(c => c.trim());
      
      if (cols.length > 0) {
        let name = cols[0];
        
        // Salta l'eventuale riga di intestazione se l'utente la copia per sbaglio
        if (name.toLowerCase() === 'nome' || name.toLowerCase() === 'name') return;
        if (name.length < 1) return;

        let role = cols[1] ? cols[1].toUpperCase() : 'R1';
        if (!['R1', 'R2', 'R3', 'R4', 'R5'].includes(role)) role = 'R1';

        let level = cols[2] || '1';
        
        // Pulisce la potenza da eventuali virgole trasformandole in punti (es. 403,9 -> 403.9)
        let powerRaw = cols[3] ? cols[3].replace(',', '.') : '0';
        let power = parseFloat(powerRaw) || 0;

        let marches = parseInt(cols[4], 10);
        if (isNaN(marches)) {
           marches = power >= 180 ? 6 : power >= 90 ? 5 : 4; // Autocalcolo se assente
        }

        players.push({
          id: `excel-${Date.now()}-${Math.random()}`,
          name: name,
          role: role,
          level: level,
          power: power,
          marches: marches
        });
      }
    });

    setParsedPlayers(players);
    setIsReviewing(true);
  };

  const handleEditPlayer = (id, field, value) => {
    setParsedPlayers(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const handleRemovePlayer = (id) => {
    setParsedPlayers(prev => prev.filter(p => p.id !== id));
  };

  const handleConfirmImport = () => {
    onImport(parsedPlayers);
    setParsedPlayers([]);
    setPastedData('');
    setIsReviewing(false);
  };

  const closeModal = () => {
    setParsedPlayers([]);
    setPastedData('');
    setIsReviewing(false);
    onClose();
  };

  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 animate-in fade-in zoom-in-95 duration-200">
      <div className="bg-slate-900 border border-emerald-500/50 p-6 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] w-full max-w-4xl flex flex-col max-h-[90vh] relative overflow-hidden">
        
        <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/10 rounded-full blur-[50px] pointer-events-none"></div>

        <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4 shrink-0 relative z-10">
          <div>
            <h2 className="text-2xl font-black text-emerald-400 flex items-center gap-2"><span>📊</span> {t('roster_table.excel_modal_title', 'Importatore Excel')}</h2>
            <p className="text-xs text-slate-400 mt-1">{isReviewing ? "Fase 2: Revisione Dati Estratti" : t('roster_table.excel_modal_desc')}</p>
          </div>
          <button onClick={closeModal} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:bg-rose-900 hover:text-rose-400 transition-colors font-bold">✕</button>
        </div>
        
        <div className="flex flex-col gap-6 flex-1 overflow-y-auto custom-scrollbar pr-2 relative z-10">
          
          {!isReviewing ? (
            <div className="flex flex-col gap-3 h-full">
              <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800 flex items-center gap-2">
                <span className="text-emerald-400 font-black">💡 TIP:</span> 
                <span className="text-xs text-slate-300">Seleziona le celle nel tuo file Excel (solo le 5 colonne interessate), fai CTRL+C e fai CTRL+V nel box qui sotto.</span>
              </div>
              <textarea 
                value={pastedData}
                onChange={(e) => setPastedData(e.target.value)}
                placeholder={t('roster_table.excel_paste_placeholder')}
                className="flex-1 w-full bg-slate-950 border border-emerald-900/50 hover:border-emerald-500/50 focus:border-emerald-400 rounded-xl p-4 text-sm text-slate-200 font-mono resize-none focus:outline-none transition-colors h-64 shadow-inner"
              ></textarea>
            </div>
          ) : (
            <>
              <div className="bg-emerald-950/20 border border-emerald-900/50 p-4 rounded-xl">
                <p className="text-sm text-emerald-200">
                  Sono state lette <strong>{parsedPlayers.length}</strong> righe dal tuo incollamento. <br/>
                  Verifica i dati e premi Conferma per aggiungere tutto al Roster.
                </p>
              </div>

              <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-900 border-b border-slate-700">
                    <tr>
                      <th className="px-3 py-2 text-slate-400 font-bold text-[10px] uppercase w-12 text-center">Ruolo</th>
                      <th className="px-3 py-2 text-slate-400 font-bold text-[10px] uppercase">Nome in Gioco</th>
                      <th className="px-3 py-2 text-slate-400 font-bold text-[10px] uppercase w-16 text-center text-amber-400">Liv. TG</th>
                      <th className="px-3 py-2 text-slate-400 font-bold text-[10px] uppercase w-24 text-center">Potenza (M)</th>
                      <th className="px-3 py-2 text-slate-400 font-bold text-[10px] uppercase w-16 text-center">Marce</th>
                      <th className="px-3 py-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-sm">
                    {parsedPlayers.length === 0 ? (
                      <tr><td colSpan="6" className="text-center p-4 text-rose-400 text-xs font-bold">Nessun dato valido estratto. Assicurati di aver copiato correttamente le celle da Excel.</td></tr>
                    ) : (
                      parsedPlayers.map(p => (
                        <tr key={p.id} className="hover:bg-slate-900/50 transition-colors">
                          <td className="px-3 py-2 text-center text-indigo-400 font-black text-xs">
                            <select value={p.role} onChange={e => handleEditPlayer(p.id, 'role', e.target.value)} className="bg-transparent text-center font-black text-emerald-400 outline-none w-full cursor-pointer">
                                {['R1','R2','R3','R4','R5'].map(r => <option key={r} value={r} className="bg-slate-900">{r}</option>)}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input type="text" value={p.name} onChange={e => handleEditPlayer(p.id, 'name', e.target.value)} className="w-full bg-transparent text-white font-bold outline-none focus:border-b focus:border-emerald-500" />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <input type="text" value={p.level} onChange={e => handleEditPlayer(p.id, 'level', e.target.value)} className="w-full bg-transparent text-amber-400 font-black text-center outline-none focus:border-b focus:border-amber-500" />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <input type="number" value={p.power} onChange={e => handleEditPlayer(p.id, 'power', Number(e.target.value))} className="w-full bg-transparent text-emerald-300 font-mono font-bold text-center outline-none focus:border-b focus:border-emerald-500" />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <input type="number" value={p.marches} onChange={e => handleEditPlayer(p.id, 'marches', Number(e.target.value))} className="w-full bg-transparent text-cyan-300 font-bold text-center outline-none focus:border-b focus:border-cyan-500" />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button onClick={() => handleRemovePlayer(p.id)} className="text-rose-500 hover:text-rose-400 font-black">✕</button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

        </div>
        
        <div className="mt-4 pt-4 border-t border-slate-800 flex justify-end items-center shrink-0 relative z-10">
          <div className="flex gap-3">
            <button onClick={closeModal} className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white uppercase transition-colors">
              {t('roster_table.excel_close', 'Chiudi')}
            </button>
            
            {!isReviewing ? (
              <button onClick={handleParse} disabled={!pastedData.trim()} className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.4)] flex items-center gap-2 disabled:opacity-50">
                {t('roster_table.excel_process_btn', 'Analizza Dati')}
              </button>
            ) : (
              <button onClick={handleConfirmImport} disabled={parsedPlayers.length === 0} className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.4)] flex items-center gap-2 disabled:opacity-50">
                ✅ Conferma & Importa
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}