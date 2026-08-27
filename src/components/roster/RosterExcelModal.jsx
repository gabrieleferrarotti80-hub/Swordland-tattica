import React, { useState } from 'react';

const VALID_LEVELS = [
  ...Array.from({ length: 30 }, (_, i) => String(i + 1)),
  ...Array.from({ length: 11 }, (_, i) => `TG${i + 1}`)
];

const AVAILABLE_FIELDS = [
  { id: 'ignore', label: '❌ Ignora Colonna' },
  { id: 'name', label: '👤 Nome Giocatore' },
  { id: 'role', label: '🛡️ Ruolo (R1-R5)' },
  { id: 'level', label: '⭐ Livello (Es. 25, TG4)' },
  { id: 'power', label: '⚔️ Potenza (M)' },
  { id: 'marches', label: '👟 Marce' }
];

export default function RosterExcelModal({ isOpen, onClose, onImport, t }) {
  const [step, setStep] = useState(1);
  
  const [pastedData, setPastedData] = useState('');
  const [rawLines, setRawLines] = useState([]);
  
  const [hasHeader, setHasHeader] = useState(true);
  const [columnMapping, setColumnMapping] = useState({});
  
  const [parsedPlayers, setParsedPlayers] = useState([]);

  if (!isOpen) return null;

  // --- FASE 1: Estrazione Grezza ---
  const handleInitialParse = () => {
    if (!pastedData.trim()) return;
    const lines = pastedData.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    const parsed = lines.map(line => line.split('\t').map(c => c.trim()));
    if (parsed.length === 0) return;

    setRawLines(parsed);

    const initialMapping = {};
    const maxCols = Math.max(...parsed.map(r => r.length));
    for (let i = 0; i < maxCols; i++) {
       if (i === 0) initialMapping[i] = 'name';
       else if (i === 1 && maxCols === 5) initialMapping[i] = 'role';
       else if (i === 2 && maxCols === 5) initialMapping[i] = 'level';
       else if (i === 3 && maxCols === 5) initialMapping[i] = 'power';
       else if (i === 4 && maxCols === 5) initialMapping[i] = 'marches';
       else initialMapping[i] = 'ignore';
    }
    setColumnMapping(initialMapping);
    setStep(2);
  };

  // --- FASE 2: Mappatura ---
  const applyMappingAndProcess = () => {
    const players = [];
    const startIndex = hasHeader ? 1 : 0;

    for (let i = startIndex; i < rawLines.length; i++) {
      const cols = rawLines[i];
      let pData = { name: '', role: 'R1', level: '1', power: 0, marches: null };

      cols.forEach((colVal, colIdx) => {
        const field = columnMapping[colIdx];
        if (!field || field === 'ignore') return;
        const val = colVal || '';
        
        if (field === 'name') pData.name = val;
        if (field === 'role') pData.role = val.toUpperCase();
        if (field === 'level') pData.level = val;
        if (field === 'power') pData.power = val;
        if (field === 'marches') pData.marches = val;
      });

      if (!pData.name) continue;

      if (!['R1', 'R2', 'R3', 'R4', 'R5'].includes(pData.role)) pData.role = 'R1';

      let levelRaw = String(pData.level).toUpperCase();
      let finalLevel = '1';
      if (VALID_LEVELS.includes(levelRaw)) {
         finalLevel = levelRaw;
      } else {
         const match = levelRaw.match(/\d+/);
         if (match) {
            const num = parseInt(match[0], 10);
            if (levelRaw.includes('TG')) finalLevel = (num >= 1 && num <= 11) ? `TG${num}` : 'TG1';
            else finalLevel = (num >= 1 && num <= 30) ? String(num) : '30';
         }
      }
      pData.level = finalLevel;

      let powerRaw = String(pData.power).replace(',', '.');
      pData.power = parseFloat(powerRaw) || 0;

      let m = parseInt(pData.marches, 10);
      if (isNaN(m)) m = pData.power >= 180 ? 6 : pData.power >= 90 ? 5 : 4;
      pData.marches = m;

      players.push({ id: `excel-${Date.now()}-${Math.random()}`, ...pData });
    }

    setParsedPlayers(players);
    setStep(3);
  };

  // --- FASE 3: Modifica Finale ---
  const handleEditPlayer = (id, field, value) => setParsedPlayers(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  const handleRemovePlayer = (id) => setParsedPlayers(prev => prev.filter(p => p.id !== id));

  const handleConfirmImport = () => {
    onImport(parsedPlayers);
    closeModal();
  };

  const closeModal = () => {
    setStep(1); setPastedData(''); setRawLines([]); setParsedPlayers([]);
    onClose();
  };

  const maxCols = rawLines.length > 0 ? Math.max(...rawLines.map(r => r.length)) : 0;
  const previewLines = rawLines.slice(0, 4); 

  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 animate-in fade-in zoom-in-95 duration-200">
      <div className="bg-slate-900 border border-emerald-500/50 p-6 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] w-full max-w-5xl flex flex-col max-h-[90vh] relative overflow-hidden">
        
        <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/10 rounded-full blur-[50px] pointer-events-none"></div>

        <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4 shrink-0 relative z-10">
          <div>
            <h2 className="text-2xl font-black text-emerald-400 flex items-center gap-2"><span>📊</span> Importatore Excel Intelligente</h2>
            <p className="text-xs text-slate-400 mt-1">
              {step === 1 && "Fase 1: Incolla i dati."}
              {step === 2 && "Fase 2: Indica cosa contengono le colonne."}
              {step === 3 && "Fase 3: Revisione finale prima del salvataggio."}
            </p>
          </div>
          <button onClick={closeModal} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:bg-rose-900 hover:text-rose-400 transition-colors font-bold">✕</button>
        </div>
        
        <div className="flex flex-col gap-6 flex-1 overflow-y-auto custom-scrollbar pr-2 relative z-10">
          
          {step === 1 && (
            <div className="flex flex-col gap-3 h-full">
              <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800 flex items-center gap-2">
                <span className="text-emerald-400 font-black">💡 TIP:</span> 
                <span className="text-xs text-slate-300">Copia le celle dal tuo foglio Excel e incollale qui sotto. Non preoccuparti dell'ordine, deciderai le colonne nel prossimo step!</span>
              </div>
              <textarea 
                value={pastedData} onChange={(e) => setPastedData(e.target.value)}
                placeholder="Incolla qui le righe (es. CTRL+V)..."
                className="flex-1 w-full bg-slate-950 border border-emerald-900/50 hover:border-emerald-500/50 focus:border-emerald-400 rounded-xl p-4 text-sm text-slate-200 font-mono resize-none focus:outline-none transition-colors min-h-[300px] shadow-inner"
              ></textarea>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center bg-slate-950/50 p-4 rounded-xl border border-slate-800">
                <p className="text-sm text-emerald-200 font-bold">Usa i menu a tendina in cima ad ogni colonna per dire al sistema cosa stai importando.</p>
                <label className="flex items-center gap-2 cursor-pointer bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-700 hover:border-emerald-500/50">
                  <input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} className="accent-emerald-500 cursor-pointer" />
                  <span className="text-xs text-white font-bold uppercase tracking-wide">La prima riga è un'intestazione (ignorala)</span>
                </label>
              </div>

              <div className="overflow-x-auto bg-slate-950 rounded-xl border border-slate-800 custom-scrollbar pb-2">
                <table className="w-full text-left border-collapse min-w-max">
                  <thead className="bg-slate-900 border-b border-emerald-900/50">
                    <tr>
                      {Array.from({ length: maxCols }).map((_, colIdx) => (
                        <th key={`head-${colIdx}`} className="p-2 border-r border-slate-800 last:border-0 align-bottom">
                          <select 
                            value={columnMapping[colIdx] || 'ignore'} 
                            onChange={(e) => setColumnMapping(prev => ({ ...prev, [colIdx]: e.target.value }))}
                            className={`w-full text-xs font-black p-2 rounded-lg outline-none cursor-pointer border shadow-lg ${columnMapping[colIdx] === 'ignore' ? 'bg-slate-800 text-slate-500 border-slate-700' : 'bg-emerald-950 text-emerald-400 border-emerald-500'}`}
                          >
                            {AVAILABLE_FIELDS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                          </select>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50 text-sm font-mono text-slate-300">
                    {previewLines.map((row, rIdx) => (
                      <tr key={`row-${rIdx}`} className={hasHeader && rIdx === 0 ? 'bg-rose-950/20 opacity-50' : 'hover:bg-slate-900/50'}>
                        {Array.from({ length: maxCols }).map((_, cIdx) => (
                          <td key={`cell-${rIdx}-${cIdx}`} className="p-3 border-r border-slate-800/50 last:border-0 max-w-[150px] truncate" title={row[cIdx] || '-'}>
                             {row[cIdx] || <span className="text-slate-600 italic">- vuoto -</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-500 italic">Anteprima limitata alle prime 4 righe. Le eventuali colonne extra verranno ignorate.</p>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-4 h-full">
              <div className="bg-emerald-950/20 border border-emerald-900/50 p-4 rounded-xl flex justify-between items-center">
                <p className="text-sm text-emerald-200">
                  Estratti con successo <strong>{parsedPlayers.length}</strong> giocatori. <br/>
                  Il sistema riconoscerà automaticamente i nomi già presenti nell'Alleanza e aggiornerà solo le statistiche!
                </p>
                <button onClick={() => setStep(2)} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg transition-colors border border-slate-700">Torna alla Mappatura</button>
              </div>

              <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-y-auto custom-scrollbar flex-1">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-900 border-b border-slate-700 sticky top-0 z-10 shadow-md">
                    <tr>
                      <th className="px-3 py-2 text-slate-400 font-bold text-[10px] uppercase w-16 text-center">Ruolo</th>
                      <th className="px-3 py-2 text-slate-400 font-bold text-[10px] uppercase">Nome in Gioco</th>
                      <th className="px-3 py-2 text-slate-400 font-bold text-[10px] uppercase w-20 text-center text-amber-400">Liv. TG</th>
                      <th className="px-3 py-2 text-slate-400 font-bold text-[10px] uppercase w-24 text-center">Potenza (M)</th>
                      <th className="px-3 py-2 text-slate-400 font-bold text-[10px] uppercase w-20 text-center">Marce</th>
                      <th className="px-3 py-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-sm">
                    {parsedPlayers.map(p => (
                      <tr key={p.id} className="hover:bg-slate-900/50 transition-colors">
                        <td className="px-3 py-2 text-center text-indigo-400 font-black text-xs">
                          <select value={p.role} onChange={e => handleEditPlayer(p.id, 'role', e.target.value)} className="bg-transparent text-center font-black text-emerald-400 outline-none w-full cursor-pointer">
                              {['R1','R2','R3','R4','R5'].map(r => <option key={r} value={r} className="bg-slate-900">{r}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2"><input type="text" value={p.name} onChange={e => handleEditPlayer(p.id, 'name', e.target.value)} className="w-full bg-transparent text-white font-bold outline-none focus:border-b focus:border-emerald-500" /></td>
                        <td className="px-3 py-2 text-center"><input type="text" value={p.level} onChange={e => handleEditPlayer(p.id, 'level', e.target.value)} className="w-full bg-transparent text-amber-400 font-black text-center outline-none focus:border-b focus:border-amber-500" /></td>
                        <td className="px-3 py-2 text-center"><input type="number" value={p.power} onChange={e => handleEditPlayer(p.id, 'power', Number(e.target.value))} className="w-full bg-transparent text-emerald-300 font-mono font-bold text-center outline-none focus:border-b focus:border-emerald-500" /></td>
                        <td className="px-3 py-2 text-center"><input type="number" value={p.marches} onChange={e => handleEditPlayer(p.id, 'marches', Number(e.target.value))} className="w-full bg-transparent text-cyan-300 font-bold text-center outline-none focus:border-b focus:border-cyan-500" /></td>
                        <td className="px-3 py-2 text-center"><button onClick={() => handleRemovePlayer(p.id)} className="text-rose-500 hover:text-rose-400 font-black">✕</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
        
        <div className="mt-4 pt-4 border-t border-slate-800 flex justify-end items-center shrink-0 relative z-10">
          <div className="flex gap-3">
            <button onClick={closeModal} className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white uppercase transition-colors">
              Annulla
            </button>
            
            {step === 1 && (
              <button onClick={handleInitialParse} disabled={!pastedData.trim()} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-[0_0_15px_rgba(79,70,229,0.4)] disabled:opacity-50">
                Avanti ➔
              </button>
            )}

            {step === 2 && (
              <button onClick={applyMappingAndProcess} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-[0_0_15px_rgba(79,70,229,0.4)] disabled:opacity-50">
                Elabora Dati ➔
              </button>
            )}

            {step === 3 && (
              <button onClick={handleConfirmImport} disabled={parsedPlayers.length === 0} className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.4)] flex items-center gap-2 disabled:opacity-50">
                ✅ Conferma & Unisci
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}