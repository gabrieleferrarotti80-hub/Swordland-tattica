import React, { useState, useMemo, useEffect } from 'react';
import { generateBearTrapWaves } from './rallyEngine';

export default function BearTrapManager({ roster, setRoster, onBack, allianceDbData }) {
  const [selectedTrap, setSelectedTrap] = useState(1);
  const [troopCap, setTroopCap] = useState(65000);
  
  // Coordinate della trappola (auto-compilate dal DB, ma modificabili)
  const [trapX, setTrapX] = useState('');
  const [trapY, setTrapY] = useState('');
  
  const [output, setOutput] = useState('');

  // 1. Lettura automatica delle coordinate dal Database dell'Alleanza
  useEffect(() => {
    // Cerchiamo le strutture salvate con type 'beartrap'
    const traps = allianceDbData?.structures?.filter(s => s.type === 'beartrap') || [];
    
    // Assumiamo che la prima nell'array sia la T1, la seconda la T2
    const currentTrap = traps[selectedTrap - 1];
    
    if (currentTrap && currentTrap.x && currentTrap.y) {
      setTrapX(currentTrap.x);
      setTrapY(currentTrap.y);
    } else {
      // Se non la trova, svuota per obbligare l'utente a inserirle
      setTrapX('');
      setTrapY('');
    }
  }, [selectedTrap, allianceDbData]);

  // 2. Filtriamo i giocatori per trappola e calcoliamo chi è online
  const trapPlayers = useMemo(() => {
    return roster.filter(p => (Number(p.assignedTrap) || 1) === selectedTrap)
                 .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [roster, selectedTrap]);

  const onlinePlayers = trapPlayers.filter(p => p.isParticipating);
  const onlineCount = onlinePlayers.length;

  // Analisi Statistica in Tempo Reale
  const targetJoinerTroops = 950000; // Assumendo che il Leader metta ~50k
  const REQUIRED_JOINERS = Math.max(1, Math.min(14, Math.ceil(targetJoinerTroops / (troopCap || 1))));
  
  const totalJoinerMarches = onlinePlayers.reduce((sum, p) => sum + (Number(p.marches) || 5), 0);
  const theoreticalConcurrentRallies = Math.floor(totalJoinerMarches / REQUIRED_JOINERS);

  // Gestione Presenze
  const togglePresence = (id) => {
    setRoster(prev => prev.map(p => p.id === id ? { ...p, isParticipating: !p.isParticipating } : p));
  };
  const setAllPresence = (status) => {
    setRoster(prev => prev.map(p => (Number(p.assignedTrap) || 1) === selectedTrap ? { ...p, isParticipating: status } : p));
  };

  // 🚀 Generazione Automatica Totale
  const handleGenerate = () => {
    if (onlineCount === 0) return alert("Nessun giocatore online!");
    if (!trapX || !trapY) return alert("Inserisci le coordinate X e Y della Trappola per calcolare le distanze!");
    
    // Passiamo le coordinate reali all'algoritmo
    const resultText = generateBearTrapWaves(onlinePlayers, troopCap, Number(trapX), Number(trapY));
    setOutput(resultText);
  };

  return (
    <div className="flex flex-col w-full px-2 md:px-8 gap-6 animate-in slide-in-from-right-8 duration-300 pb-10">
      <button onClick={onBack} className="text-slate-400 hover:text-white font-bold text-xs uppercase mb-2 text-left w-fit flex items-center px-6 py-3 border border-slate-700 bg-slate-900 rounded-full transition-colors">
        ⬅ Torna al Menu
      </button>

      <div className="bg-slate-900 border border-fuchsia-500/30 p-6 md:p-8 rounded-3xl shadow-xl flex flex-col gap-6 max-w-5xl mx-auto w-full">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-slate-800 pb-6">
          <div>
            <h2 className="text-3xl font-black text-fuchsia-400 flex items-center gap-3">
              <span>🐻</span> Bear Trap Manager
            </h2>
            <p className="text-slate-400 text-sm mt-1">Motore Bin Packing (Distanze Fisiche Reali).</p>
          </div>

          <div className="flex flex-wrap gap-4 bg-slate-950 p-3 rounded-2xl border border-slate-800">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Trappola</label>
              <select value={selectedTrap} onChange={(e) => { setSelectedTrap(Number(e.target.value)); setOutput(''); }} className="bg-slate-900 border border-fuchsia-900/50 text-fuchsia-300 font-black rounded-lg px-4 py-2 outline-none cursor-pointer">
                <option value={1}>TRAPPOLA 1</option>
                <option value={2}>TRAPPOLA 2</option>
              </select>
            </div>
            
            {/* Coordinate Auto-Compilate ma Modificabili */}
            <div className="flex gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Coord X</label>
                <input type="number" value={trapX} onChange={(e) => setTrapX(e.target.value)} className="bg-slate-900 border border-slate-700 text-cyan-300 font-bold rounded-lg px-2 py-2 outline-none w-16 text-center focus:border-cyan-500"/>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Coord Y</label>
                <input type="number" value={trapY} onChange={(e) => setTrapY(e.target.value)} className="bg-slate-900 border border-slate-700 text-amber-300 font-bold rounded-lg px-2 py-2 outline-none w-16 text-center focus:border-amber-500"/>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Cap Truppe</label>
              <input type="number" value={troopCap} onChange={(e) => setTroopCap(Number(e.target.value))} className="bg-slate-900 border border-slate-700 text-white font-bold rounded-lg px-4 py-2 outline-none w-28 text-center focus:border-fuchsia-500"/>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* COLONNA SINISTRA: APPELLO */}
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-end">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>📋</span> Appello Presenze
                <span className="bg-fuchsia-900/50 text-fuchsia-300 text-xs px-2 py-1 rounded-md ml-2">{onlineCount} Online</span>
              </h3>
              <div className="flex gap-2">
                <button onClick={() => setAllPresence(true)} className="text-[10px] font-bold bg-emerald-900/30 text-emerald-400 px-3 py-1.5 rounded hover:bg-emerald-800/50">TUTTI ON</button>
                <button onClick={() => setAllPresence(false)} className="text-[10px] font-bold bg-slate-800 text-slate-400 px-3 py-1.5 rounded hover:bg-slate-700">TUTTI OFF</button>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-2 h-[450px] overflow-y-auto custom-scrollbar flex flex-col gap-1 shadow-inner">
              {trapPlayers.length === 0 ? (
                <div className="text-slate-500 text-center py-8 text-sm italic">Nessun giocatore assegnato alla Trappola {selectedTrap}.</div>
              ) : (
                trapPlayers.map(p => (
                  <div key={p.id} onClick={() => togglePresence(p.id)} className={`flex justify-between items-center p-3 rounded-lg cursor-pointer transition-colors border ${p.isParticipating ? 'bg-emerald-950/20 border-emerald-900/50' : 'bg-slate-900 border-transparent hover:border-slate-700'}`}>
                    <div className="flex flex-col">
                      <span className={`font-bold ${p.isParticipating ? 'text-emerald-400' : 'text-slate-300'}`}>{p.name}</span>
                      <span className="text-[10px] text-slate-500 uppercase tracking-widest">{p.marches || 5} Marce Joiner • X:{p.x || '-'} Y:{p.y || '-'}</span>
                    </div>
                    <div className={`w-12 py-1 rounded text-center text-xs font-black shadow-inner ${p.isParticipating ? 'bg-emerald-500 text-slate-900' : 'bg-slate-800 text-slate-500'}`}>
                      {p.isParticipating ? 'ON' : 'OFF'}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* COLONNA DESTRA: DASHBOARD ANALITICA & MOTORE LOGICO */}
          <div className="flex flex-col gap-4">
            
            <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl flex flex-col gap-4 shadow-lg">
              <h3 className="text-white font-black text-sm uppercase tracking-widest border-b border-slate-800 pb-2">Analisi Parametri</h3>
              
              <div className="grid grid-cols-2 gap-4">
                 <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-center">
                    <div className="text-3xl font-black text-amber-400">{REQUIRED_JOINERS}</div>
                    <div className="text-[10px] text-slate-500 uppercase font-bold mt-1">Joiners richiesti per 1 Milione</div>
                 </div>
                 <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-center">
                    <div className="text-3xl font-black text-emerald-400">{theoreticalConcurrentRallies}</div>
                    <div className="text-[10px] text-slate-500 uppercase font-bold mt-1">Raduni Sostenibili in Contemporanea</div>
                 </div>
              </div>
            </div>

            <button 
              onClick={handleGenerate}
              className="w-full py-4 bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-black tracking-widest uppercase rounded-xl shadow-[0_0_20px_rgba(192,38,211,0.3)] transition-all"
            >
              🚀 Avvia Risolutore Matematico
            </button>

            <textarea 
              readOnly 
              value={output}
              placeholder="La timeline ottimizzata dei lanci apparirà qui..."
              className="w-full flex-1 min-h-[150px] bg-[#050505] border border-slate-800 rounded-xl p-4 text-xs font-mono text-fuchsia-200 focus:outline-none custom-scrollbar resize-none"
            />

            {output && (
              <button 
                onClick={() => { navigator.clipboard.writeText(output); alert("Copiato negli appunti!"); }}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase rounded-xl transition-colors"
              >
                Copia Timeline per la Chat
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}