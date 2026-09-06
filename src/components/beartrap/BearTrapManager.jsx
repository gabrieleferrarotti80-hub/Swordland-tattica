import React, { useState, useMemo, useEffect } from 'react';
import { generateBearTrapWaves, calculateTravelSeconds } from './rallyEngine';

export default function BearTrapManager({ roster, setRoster, onBack, allianceDbData }) {
  // --- STATI GLOBALI ---
  const [activeTab, setActiveTab] = useState('generator'); 
  const [selectedTrap, setSelectedTrap] = useState(1);
  const [trapX, setTrapX] = useState('');
  const [trapY, setTrapY] = useState('');
  
  // --- STATI GENERATORE ---
  const [troopCap, setTroopCap] = useState(65000);
  const [output, setOutput] = useState('');

  // --- STATI SIMULATORE ---
  const [simPlayerId, setSimPlayerId] = useState('');
  const [hypoX, setHypoX] = useState('');
  const [hypoY, setHypoY] = useState('');

  // Lettura automatica coordinate trappola dal DB
  useEffect(() => {
    const traps = allianceDbData?.structures?.filter(s => s.type === 'beartrap') || [];
    const currentTrap = traps[selectedTrap - 1];
    if (currentTrap && currentTrap.x && currentTrap.y) {
      setTrapX(currentTrap.x); setTrapY(currentTrap.y);
    } else {
      setTrapX(''); setTrapY('');
    }
  }, [selectedTrap, allianceDbData]);

  // Filtro e sorting Roster
  const trapPlayers = useMemo(() => {
    return roster.filter(p => (Number(p.assignedTrap) || 1) === selectedTrap)
                 .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [roster, selectedTrap]);

  const onlinePlayers = trapPlayers.filter(p => p.isParticipating);
  const onlineCount = onlinePlayers.length;
  const isSetupComplete = trapX !== '' && trapY !== '';

  // Analisi Statistica in Tempo Reale
  const targetJoinerTroops = 1000000; 
  const REQUIRED_JOINERS = Math.min(15, Math.ceil(targetJoinerTroops / (troopCap || 1)));
  const totalJoinerMarches = onlinePlayers.reduce((sum, p) => sum + (Number(p.marches) || 4), 0);
  const theoreticalConcurrentRallies = Math.floor(totalJoinerMarches / REQUIRED_JOINERS);

  // Azioni Generatore
  const togglePresence = (id) => setRoster(prev => prev.map(p => p.id === id ? { ...p, isParticipating: !p.isParticipating } : p));
  const setAllPresence = (status) => setRoster(prev => prev.map(p => (Number(p.assignedTrap) || 1) === selectedTrap ? { ...p, isParticipating: status } : p));

  const handleGenerate = () => {
    if (onlineCount === 0) return;
    if (!isSetupComplete) return;
    setOutput(generateBearTrapWaves(onlinePlayers, troopCap, Number(trapX), Number(trapY)));
  };

  // --- LOGICA SIMULATORE ---
  const simPlayer = trapPlayers.find(p => p.id === simPlayerId) || null;
  let currentTravelTime = 0, currentCycleTime = 0, currentMaxRallies = 0;
  let hypoTravelTime = 0, hypoCycleTime = 0, hypoMaxRallies = 0;

  if (simPlayer && isSetupComplete && simPlayer.x && simPlayer.y) {
    currentTravelTime = calculateTravelSeconds(simPlayer.x, simPlayer.y, trapX, trapY);
    currentCycleTime = 240 + (currentTravelTime * 2) + 10;
    currentMaxRallies = Math.floor(1800 / currentCycleTime);

    if (hypoX && hypoY) {
      hypoTravelTime = calculateTravelSeconds(hypoX, hypoY, trapX, trapY);
      hypoCycleTime = 240 + (hypoTravelTime * 2) + 10;
      hypoMaxRallies = Math.floor(1800 / hypoCycleTime);
    }
  }
  const ralliesGained = hypoMaxRallies - currentMaxRallies;

  return (
    <div className="flex flex-col w-full px-2 md:px-8 gap-6 animate-in slide-in-from-right-8 duration-300 pb-10">
      
      {/* TOP BAR / BACK BUTTON */}
      <button onClick={onBack} className="text-slate-400 hover:text-white font-bold text-xs uppercase mb-2 text-left w-fit flex items-center px-6 py-3 border border-slate-700 bg-slate-900 rounded-full transition-colors shadow-md">
        ⬅ Torna al Menu Alleanza
      </button>

      {/* CONTAINER PRINCIPALE */}
      <div className="bg-slate-900 border border-fuchsia-500/30 rounded-3xl shadow-2xl flex flex-col max-w-5xl mx-auto w-full overflow-hidden">
        
        {/* =========================================
            HEADER & SETUP GLOBALE
            ========================================= */}
        <div className="bg-slate-950 border-b border-slate-800 p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
          {/* Sfondo decorativo */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-fuchsia-600/5 rounded-full blur-[80px] pointer-events-none"></div>

          <div className="relative z-10">
            <h2 className="text-3xl font-black text-white flex items-center gap-3">
              <span className="drop-shadow-[0_0_15px_rgba(217,70,239,0.8)]">🐻</span> Centro Gestione Orso
            </h2>
            <p className="text-slate-400 text-sm mt-2 max-w-md">
              Il sistema calcola i tempi fisici di marcia sulla mappa per incastrare i raduni senza sprecare secondi preziosi.
            </p>
          </div>

          <div className="flex flex-col gap-2 relative z-10 bg-slate-900/80 p-4 rounded-2xl border border-slate-700 shadow-inner w-full md:w-auto">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-black text-fuchsia-400 uppercase tracking-widest">Step 1: Localizzazione</span>
              {!isSetupComplete && <span className="flex h-2 w-2 relative ml-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span></span>}
            </div>
            
            <div className="flex flex-wrap gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-500 font-bold uppercase">Obiettivo</label>
                <select value={selectedTrap} onChange={(e) => { setSelectedTrap(Number(e.target.value)); setOutput(''); }} className="bg-slate-950 border border-slate-700 text-white font-bold rounded-lg px-3 py-2 outline-none cursor-pointer focus:border-fuchsia-500 transition-colors">
                  <option value={1}>Trappola 1</option>
                  <option value={2}>Trappola 2</option>
                </select>
              </div>
              
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-500 font-bold uppercase">X Esatta</label>
                <input type="number" value={trapX} onChange={(e) => setTrapX(e.target.value)} placeholder="000" className={`bg-slate-950 border text-cyan-300 font-mono rounded-lg px-3 py-2 outline-none w-20 text-center transition-colors ${!trapX ? 'border-rose-500/50' : 'border-slate-700 focus:border-cyan-500'}`}/>
              </div>
              
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-500 font-bold uppercase">Y Esatta</label>
                <input type="number" value={trapY} onChange={(e) => setTrapY(e.target.value)} placeholder="000" className={`bg-slate-950 border text-amber-300 font-mono rounded-lg px-3 py-2 outline-none w-20 text-center transition-colors ${!trapY ? 'border-rose-500/50' : 'border-slate-700 focus:border-amber-500'}`}/>
              </div>
            </div>
            {!isSetupComplete && <p className="text-[10px] text-rose-400 font-bold mt-1">⚠️ Coordinate obbligatorie per il calcolo delle distanze.</p>}
          </div>
        </div>

        {/* NAVIGATION TABS */}
        <div className="flex bg-slate-950/50 border-b border-slate-800 shrink-0">
          <button onClick={() => setActiveTab('generator')} className={`flex-1 md:flex-none px-6 py-4 font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'generator' ? 'text-fuchsia-400 border-b-2 border-fuchsia-400 bg-slate-900' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900/50'}`}>
            ⚙️ Pianificatore
          </button>
          <button onClick={() => setActiveTab('simulator')} className={`flex-1 md:flex-none px-6 py-4 font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'simulator' ? 'text-cyan-400 border-b-2 border-cyan-400 bg-slate-900' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900/50'}`}>
            📍 Analisi Teletrasporto
          </button>
        </div>

        {/* =========================================
            TAB 1: GENERATORE RADUNI 
            ========================================= */}
        {activeTab === 'generator' && (
          <div className="p-6 md:p-8 grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-300">
            
            {/* COLONNA SINISTRA: APPELLO */}
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-end border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <span className="text-fuchsia-500">Step 2:</span> Appello Presenze
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">Seleziona chi è fisicamente online. Chi è rosso verrà escluso dai calcoli.</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="bg-emerald-900/30 text-emerald-400 text-xs font-bold px-3 py-1 rounded-full border border-emerald-500/30 shadow-inner">
                    {onlineCount} Giocatori Online
                  </span>
                  <div className="flex gap-2">
                    <button onClick={() => setAllPresence(true)} className="text-[10px] font-bold bg-slate-800 text-slate-300 px-2 py-1 rounded hover:bg-slate-700 transition-colors">TUTTI ON</button>
                    <button onClick={() => setAllPresence(false)} className="text-[10px] font-bold bg-slate-800 text-slate-300 px-2 py-1 rounded hover:bg-slate-700 transition-colors">TUTTI OFF</button>
                  </div>
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-2 h-[450px] overflow-y-auto custom-scrollbar flex flex-col gap-1 shadow-inner relative">
                {trapPlayers.length === 0 ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 text-sm italic">
                    <span>Nessun giocatore assegnato a questa trappola.</span>
                    <span className="text-xs">Vai nel menu Roster per assegnarli.</span>
                  </div>
                ) : (
                  trapPlayers.map(p => (
                    <div key={p.id} onClick={() => togglePresence(p.id)} className={`flex justify-between items-center p-3 rounded-lg cursor-pointer transition-all border ${p.isParticipating ? 'bg-slate-800/80 border-emerald-500/50 shadow-md' : 'bg-slate-900/30 border-transparent hover:border-slate-700 opacity-60'}`}>
                      <div className="flex flex-col">
                        <span className={`font-black text-sm ${p.isParticipating ? 'text-white' : 'text-slate-400'}`}>{p.name}</span>
                        <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-0.5">
                          {p.marches || 4} Marce Joiner <span className="mx-1">•</span> Coord: {p.x || '?'},{p.y || '?'}
                        </span>
                      </div>
                      <div className={`w-14 py-1.5 rounded-md text-center text-[10px] font-black uppercase tracking-wider shadow-inner transition-colors ${p.isParticipating ? 'bg-emerald-500 text-slate-950' : 'bg-slate-950 text-slate-600 border border-slate-800'}`}>
                        {p.isParticipating ? 'Online' : 'Offline'}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* COLONNA DESTRA: MOTORE */}
            <div className="flex flex-col gap-4">
              <div className="border-b border-slate-800 pb-3">
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <span className="text-fuchsia-500">Step 3:</span> Motore di Lancio
                </h3>
                <p className="text-xs text-slate-400 mt-1">Imposta il limite truppe per ogni singolo raduno.</p>
              </div>
              
              <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl flex flex-col gap-5 shadow-lg relative overflow-hidden">
                <div className="flex items-center justify-between z-10 relative bg-slate-900 p-4 rounded-xl border border-slate-700 shadow-inner">
                  <div className="flex flex-col">
                    <span className="text-white font-black text-sm uppercase">Cap Truppe Raduno</span>
                    <span className="text-xs text-slate-400">Es. 50000 per far entrare più persone.</span>
                  </div>
                  <input type="number" value={troopCap} onChange={(e) => setTroopCap(Number(e.target.value))} className="bg-slate-950 border border-slate-700 text-fuchsia-300 font-black text-lg rounded-lg px-4 py-2 outline-none w-32 text-center focus:border-fuchsia-500 transition-colors shadow-inner"/>
                </div>

                <div className="grid grid-cols-2 gap-4 z-10 relative">
                   <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex flex-col items-center text-center">
                      <div className="text-3xl font-black text-amber-400 mb-1">{REQUIRED_JOINERS}</div>
                      <div className="text-[10px] text-slate-400 uppercase font-bold leading-tight">Joiner Necessari<br/>(per 1 Milione)</div>
                   </div>
                   <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex flex-col items-center text-center">
                      <div className="text-3xl font-black text-emerald-400 mb-1">{theoreticalConcurrentRallies}</div>
                      <div className="text-[10px] text-slate-400 uppercase font-bold leading-tight">Ondate Parallele<br/>(Teoriche Attuali)</div>
                   </div>
                </div>
              </div>

              {!isSetupComplete ? (
                <button disabled className="w-full py-4 bg-slate-800 text-rose-400 font-black tracking-widest uppercase rounded-xl border border-rose-900/50 cursor-not-allowed flex items-center justify-center gap-2">
                  <span>⚠️</span> Completa Step 1: Inserisci Coordinate Trappola
                </button>
              ) : onlineCount === 0 ? (
                <button disabled className="w-full py-4 bg-slate-800 text-amber-400 font-black tracking-widest uppercase rounded-xl border border-amber-900/50 cursor-not-allowed flex items-center justify-center gap-2">
                  <span>⚠️</span> Segna almeno 1 giocatore Online (Step 2)
                </button>
              ) : (
                <button onClick={handleGenerate} className="w-full py-4 bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-500 hover:to-indigo-500 text-white font-black tracking-widest uppercase rounded-xl shadow-[0_0_20px_rgba(192,38,211,0.4)] transition-all transform hover:scale-[1.02] active:scale-95">
                  🚀 Genera Timeline Ottimizzata
                </button>
              )}

              <div className="relative flex-1 min-h-[200px] mt-2">
                <textarea readOnly value={output} placeholder="La timeline dei lanci apparirà qui..." className="absolute inset-0 w-full h-full bg-[#050505] border border-slate-800 rounded-xl p-4 text-xs font-mono text-fuchsia-200 focus:outline-none custom-scrollbar resize-none shadow-inner" />
              </div>

              {output && (
                <button onClick={() => { navigator.clipboard.writeText(output); alert("Copiato negli appunti!"); }} className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase rounded-xl transition-colors border border-slate-700 flex items-center justify-center gap-2">
                  <span>📋</span> Copia Testo per la Chat
                </button>
              )}
            </div>
          </div>
        )}

        {/* =========================================
            TAB 2: SIMULATORE LOGISTICO 
            ========================================= */}
        {activeTab === 'simulator' && (
          <div className="p-6 md:p-8 flex flex-col gap-8 animate-in fade-in zoom-in-95 duration-300">
            
            <div className="bg-cyan-950/20 border border-cyan-900/50 p-4 rounded-xl">
              <h3 className="text-cyan-400 font-black text-sm uppercase mb-1">Perché usare il simulatore?</h3>
              <p className="text-slate-300 text-xs leading-relaxed">
                Mostra a un membro dell'alleanza quanti raduni sta perdendo stando lontano dalla trappola. Inserisci una posizione ipotetica (es. attaccata all'orso) e il sistema calcolerà istantaneamente il guadagno netto in termini di punteggio.
              </p>
            </div>

            <div className="flex flex-col md:flex-row gap-8">
              {/* SELEZIONE GIOCATORE */}
              <div className="flex-1 bg-slate-950 border border-slate-800 p-6 rounded-2xl shadow-lg relative">
                <h3 className="text-white font-black text-sm uppercase tracking-widest border-b border-slate-800 pb-3 mb-5 flex items-center gap-2">
                  <span className="text-cyan-500">A.</span> Scegli Membro
                </h3>
                <select 
                  value={simPlayerId} 
                  onChange={(e) => { setSimPlayerId(e.target.value); setHypoX(''); setHypoY(''); }} 
                  className="w-full bg-slate-900 border border-slate-700 text-white font-bold rounded-xl px-4 py-3 outline-none cursor-pointer focus:border-cyan-500 transition-colors shadow-inner"
                >
                  <option value="">-- Seleziona dal Roster --</option>
                  {trapPlayers.map(p => <option key={p.id} value={p.id}>{p.name} (X:{p.x || '?'} Y:{p.y || '?'})</option>)}
                </select>

                {simPlayer && (!isSetupComplete) && (
                  <p className="text-rose-400 text-xs font-bold mt-4 p-3 bg-rose-950/30 rounded-lg border border-rose-900/50">
                    ⚠️ Torna al Pannello Superiore (Step 1) e inserisci le coordinate della trappola.
                  </p>
                )}
                {simPlayer && isSetupComplete && (!simPlayer.x || !simPlayer.y) && (
                  <p className="text-amber-400 text-xs font-bold mt-4 p-3 bg-amber-950/30 rounded-lg border border-amber-900/50">
                    ⚠️ {simPlayer.name} non ha coordinate registrate nel database. Vai nel Roster e aggiorna la sua X e Y per calcolare la distanza.
                  </p>
                )}
              </div>

              {/* INPUT IPOTETICO */}
              <div className="flex-1 bg-slate-950 border border-cyan-500/30 p-6 rounded-2xl shadow-[0_0_30px_rgba(6,182,212,0.1)] relative overflow-hidden">
                <div className="absolute -right-10 -bottom-10 text-9xl opacity-5 pointer-events-none">📍</div>
                <h3 className="text-white font-black text-sm uppercase tracking-widest border-b border-slate-800 pb-3 mb-5 flex items-center gap-2 relative z-10">
                  <span className="text-cyan-500">B.</span> Proponi Teletrasporto
                </h3>
                
                <div className="flex gap-4 relative z-10">
                  <div className="flex flex-col gap-1 w-full">
                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Nuova X (Ipotetica)</label>
                    <input type="number" value={hypoX} onChange={(e) => setHypoX(e.target.value)} disabled={!simPlayer} placeholder={trapX ? String(Number(trapX) - 2) : "000"} className="bg-slate-900 border border-slate-700 text-cyan-300 font-mono text-lg font-bold rounded-xl px-4 py-3 outline-none focus:border-cyan-500 w-full disabled:opacity-50 transition-colors shadow-inner"/>
                  </div>
                  <div className="flex flex-col gap-1 w-full">
                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Nuova Y (Ipotetica)</label>
                    <input type="number" value={hypoY} onChange={(e) => setHypoY(e.target.value)} disabled={!simPlayer} placeholder={trapY ? String(Number(trapY) + 2) : "000"} className="bg-slate-900 border border-slate-700 text-amber-300 font-mono text-lg font-bold rounded-xl px-4 py-3 outline-none focus:border-amber-500 w-full disabled:opacity-50 transition-colors shadow-inner"/>
                  </div>
                </div>
              </div>
            </div>

            {/* RISULTATI SIMULAZIONE */}
            {simPlayer && isSetupComplete && simPlayer.x && simPlayer.y && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-2">
                
                {/* SITUAZIONE ATTUALE */}
                <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 flex flex-col text-left shadow-lg">
                  <div className="flex justify-between items-start mb-6">
                    <h4 className="text-slate-400 font-black text-xs uppercase tracking-widest">Situazione Attuale</h4>
                    <span className="bg-slate-800 text-slate-400 text-[10px] font-bold px-2 py-1 rounded">Distanza: {currentTravelTime}s</span>
                  </div>
                  
                  <div className="text-center mb-6">
                    <div className="text-5xl font-black text-white mb-2">{currentMaxRallies} <span className="text-xl text-slate-500 font-bold">Max</span></div>
                    <p className="text-xs text-slate-400 uppercase tracking-widest">Raduni in 30 Minuti (Per Marcia)</p>
                  </div>
                  
                  <div className="w-full bg-slate-950 rounded-xl p-4 border border-slate-800 text-xs text-slate-300 font-mono space-y-2 shadow-inner">
                    <div className="flex justify-between items-center"><span className="text-slate-500">Preparazione Raduno:</span> <span className="text-amber-400 font-bold">240s</span></div>
                    <div className="flex justify-between items-center"><span className="text-slate-500">Viaggio Andata/Ritorno:</span> <span className="text-cyan-400 font-bold">{currentTravelTime * 2}s</span></div>
                    <div className="flex justify-between items-center"><span className="text-slate-500">Combattimento (Stimato):</span> <span className="text-rose-400 font-bold">10s</span></div>
                    <div className="flex justify-between items-center border-t border-slate-800 mt-2 pt-2 text-sm"><span className="font-bold text-white">Durata Ciclo Singolo:</span> <span className="text-white font-black">{currentCycleTime}s</span></div>
                  </div>
                </div>

                {/* PROIEZIONE FUTURA */}
                <div className={`rounded-2xl p-6 flex flex-col text-left transition-all duration-500 ${hypoX && hypoY ? 'bg-emerald-950/30 border-2 border-emerald-500 shadow-[0_0_40px_rgba(16,185,129,0.2)]' : 'bg-slate-900/50 border border-slate-800 opacity-50 grayscale'}`}>
                  <div className="flex justify-between items-start mb-6">
                    <h4 className={`font-black text-xs uppercase tracking-widest ${hypoX && hypoY ? 'text-emerald-400' : 'text-slate-500'}`}>Proiezione Teletrasporto</h4>
                    {hypoX && hypoY && <span className="bg-emerald-900/50 text-emerald-300 text-[10px] font-bold px-2 py-1 rounded border border-emerald-500/30">Nuova Dist: {hypoTravelTime}s</span>}
                  </div>
                  
                  {hypoX && hypoY ? (
                    <>
                      <div className="text-center mb-6">
                        <div className="text-5xl font-black text-emerald-400 mb-2">{hypoMaxRallies} <span className="text-xl text-emerald-600/50 font-bold">Max</span></div>
                        <p className="text-xs text-emerald-300/70 uppercase tracking-widest">Raduni in 30 Minuti (Per Marcia)</p>
                      </div>

                      <div className="w-full bg-slate-950/80 rounded-xl p-4 border border-emerald-900/50 text-xs text-slate-300 font-mono space-y-2 shadow-inner">
                        <div className="flex justify-between items-center opacity-50"><span className="text-slate-500">Preparazione Raduno:</span> <span>240s</span></div>
                        <div className="flex justify-between items-center"><span className="text-emerald-300">Nuovo Viaggio A/R:</span> <span className="text-emerald-400 font-bold">{hypoTravelTime * 2}s</span></div>
                        <div className="flex justify-between items-center opacity-50"><span className="text-slate-500">Combattimento (Stimato):</span> <span>10s</span></div>
                        <div className="flex justify-between items-center border-t border-emerald-900/50 mt-2 pt-2 text-sm"><span className="font-bold text-emerald-100">Nuovo Ciclo Singolo:</span> <span className="text-emerald-400 font-black">{hypoCycleTime}s</span></div>
                      </div>

                      <div className="mt-auto pt-6">
                        {ralliesGained > 0 ? (
                          <div className="px-4 py-3 bg-emerald-500 text-slate-950 font-black text-sm uppercase rounded-xl shadow-lg w-full text-center animate-pulse">
                            🔥 Guadagno Netto: +{ralliesGained} Raduni / Marcia!
                          </div>
                        ) : (
                          <div className="px-4 py-3 bg-slate-800 text-slate-400 font-black text-sm uppercase rounded-xl border border-slate-700 w-full text-center">
                            Nessun incremento netto in 30 minuti.
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                      <span className="text-4xl mb-3 opacity-20">📍</span>
                      <p className="text-sm text-slate-500 italic">
                        Compila le coordinate (Nuova X e Nuova Y) per sbloccare l'analisi comparativa.
                      </p>
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}