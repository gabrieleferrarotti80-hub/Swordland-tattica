import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { RosterTable } from './RosterTable';

export function PlayerManagerModal({
  isOpen, onClose, activeTab, setActiveTab, roster, setRoster,
  activeDeployment, setActiveDeployment, userRole, onDeploy,
  selectedTemplateId, setSelectedTemplateId,
  planningMode = 'auto'
}) {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState([]);
  
  // STATI PER LA MODALITÀ MANUALE
  const [manualSquads, setManualSquads] = useState([]);
  const [manualWeights, setManualWeights] = useState({});

  useEffect(() => {
    if (isOpen) {
      const fetchTemplates = async () => {
        const docSnap = await getDoc(doc(db, "systemSettings", "quickPlannerTemplates"));
        if (docSnap.exists() && docSnap.data().templates) {
          const fetched = docSnap.data().templates;
          setTemplates(fetched);
          if (fetched.length > 0 && !selectedTemplateId) {
            setSelectedTemplateId(fetched[0].id);
          }
        }
      };
      fetchTemplates();

      // Inizializza le squadre manuali in base ai giocatori già assegnati nel roster
      if (planningMode === 'manual') {
         const existingInRoster = [...new Set(roster.map(p => p.squad).filter(s => s && s !== ''))];
         if (manualSquads.length === 0 && existingInRoster.length === 0) {
            setManualSquads(['Squadra 1', 'Squadra 2']);
            setManualWeights({'Squadra 1': 50, 'Squadra 2': 50});
         } else if (existingInRoster.length > 0) {
            const toAdd = existingInRoster.filter(s => !manualSquads.includes(s));
            if (toAdd.length > 0) {
               const newSquads = [...manualSquads, ...toAdd];
               setManualSquads(newSquads);
               const newW = {...manualWeights};
               toAdd.forEach(s => { if(newW[s] === undefined) newW[s] = 0; });
               setManualWeights(newW);
            }
         }
      }
    }
  }, [isOpen, planningMode]);

  if (!isOpen) return null;

  const currentTemplate = templates.find(t => t.id === selectedTemplateId);
  
  // Seleziona automaticamente i Dati Manuali o della Dottrina
  const activeSquadsList = planningMode === 'manual' ? manualSquads : (currentTemplate?.squads || ['Assalto', 'Difesa', 'Supporto']);
  const activeWeights = planningMode === 'manual' ? manualWeights : (currentTemplate?.squadWeights || {});
  
  const participating = roster.filter(p => p.isParticipating);
  const totalParticipatingPower = participating.reduce((sum, p) => sum + Number(p.power || 0), 0);
  const allParticipating = roster.length > 0 && roster.every(p => p.isParticipating);

  const handleToggleAllParticipating = () => {
    const newState = !allParticipating;
    setRoster(roster.map(p => ({ ...p, isParticipating: newState })));
  };

  // GESTIONE SQUADRE MANUALI
  const handleAddManualSquad = () => {
    const name = prompt("Nome della nuova squadra?");
    if (name && !manualSquads.includes(name)) {
        setManualSquads([...manualSquads, name]);
        setManualWeights({ ...manualWeights, [name]: 0 });
    }
  };

  const handleRemoveManualSquad = (sqName) => {
    if(window.confirm(`Vuoi davvero eliminare la squadra "${sqName}"? I giocatori torneranno 'Da Assegnare'.`)) {
      setManualSquads(manualSquads.filter(s => s !== sqName));
      const newW = { ...manualWeights };
      delete newW[sqName];
      setManualWeights(newW);
      setRoster(roster.map(p => p.squad === sqName ? { ...p, squad: '' } : p));
    }
  };

  const handleWeightChange = (sqName, val) => {
    setManualWeights({ ...manualWeights, [sqName]: Number(val) });
  };

  const handleAutoAssignSquads = () => {
    if (participating.length === 0) { alert(t('swordland.select_player_alert', "Seleziona almeno un giocatore!")); return; }
    
    if (window.confirm(`Vuoi assegnare automaticamente i giocatori rispettando le percentuali tattiche impostate?`)) {
      
      const sortedPlayers = [...participating].sort((a, b) => Number(b.power || 0) - Number(a.power || 0));
      const weights = activeWeights;
      
      let totalWeight = activeSquadsList.reduce((sum, sq) => sum + Number(weights[sq] || 0), 0);
      if (totalWeight === 0) {
         activeSquadsList.forEach(sq => weights[sq] = 100 / activeSquadsList.length);
         totalWeight = 100;
      }

      const squadTargets = {};
      const squadCurrent = {};
      activeSquadsList.forEach(sq => {
         squadTargets[sq] = ((weights[sq] || 0) / totalWeight) * totalParticipatingPower;
         squadCurrent[sq] = 0;
      });

      const newRoster = roster.map(p => ({ ...p, squad: p.isParticipating ? '' : p.squad }));
      
      sortedPlayers.forEach(player => {
         let bestSquad = activeSquadsList[0];
         let maxDeficit = -Infinity;
         
         activeSquadsList.forEach(sq => {
            const deficit = squadTargets[sq] - squadCurrent[sq];
            if (deficit > maxDeficit) {
               maxDeficit = deficit;
               bestSquad = sq;
            }
         });

         const rosterIndex = newRoster.findIndex(p => p.id === player.id);
         if (rosterIndex !== -1) {
            newRoster[rosterIndex].squad = bestSquad;
            squadCurrent[bestSquad] += Number(player.power || 0);
         }
      });
      
      setRoster(newRoster);
      if (activeDeployment.length > 0) {
        setActiveDeployment(newRoster.filter(p => p.isParticipating).map(p => ({ ...p, role: p.role || '', positions: p.positions || {} })));
      }
    }
  };

  const handleSquadDrop = (e, targetSquad) => {
    e.preventDefault();
    const playerId = e.dataTransfer.getData('text/plain');
    if (playerId && playerId.startsWith('squad_player:')) {
      const pId = playerId.replace('squad_player:', '');
      const newRoster = roster.map(p => p.id === pId ? { ...p, squad: targetSquad } : p);
      setRoster(newRoster);
      if (activeDeployment.some(p => p.id === pId)) {
        setActiveDeployment(newRoster.filter(p => p.isParticipating).map(p => ({ ...p, role: p.role || '', positions: p.positions || {} })));
      }
    }
  };

  const getSquadPower = (sqName) => {
    return roster
      .filter(p => p.isParticipating && (sqName === '' ? !activeSquadsList.includes(p.squad) : p.squad === sqName))
      .reduce((sum, p) => sum + Number(p.power || 0), 0)
      .toFixed(1);
  };

  const handleEditPlayer = (id, field, value) => setRoster(roster.map(p => p.id === id ? { ...p, [field]: value } : p));

  const columnColors = [
    { bg: 'bg-rose-950/30', border: 'border-rose-900/50', text: 'text-rose-400', tag: 'bg-rose-950' },
    { bg: 'bg-blue-950/30', border: 'border-blue-900/50', text: 'text-blue-400', tag: 'bg-blue-950' },
    { bg: 'bg-emerald-950/30', border: 'border-emerald-900/50', text: 'text-emerald-400', tag: 'bg-emerald-950' },
    { bg: 'bg-amber-950/30', border: 'border-amber-900/50', text: 'text-amber-400', tag: 'bg-amber-950' },
    { bg: 'bg-fuchsia-950/30', border: 'border-fuchsia-900/50', text: 'text-fuchsia-400', tag: 'bg-fuchsia-950' }
  ];

  const totalWeightForCalc = activeSquadsList.reduce((sum, sq) => sum + (activeWeights[sq] ?? (100 / activeSquadsList.length)), 0);

  const dynamicColumns = [
    { id: '', title: t('swordland.unassigned', 'Da Assegnare'), bg: 'bg-slate-800/40', border: 'border-slate-700', text: 'text-slate-400', tag: 'bg-slate-950', targetPct: null },
    ...activeSquadsList.map((sq, i) => {
      const w = activeWeights[sq] ?? (100 / activeSquadsList.length);
      const pct = totalWeightForCalc > 0 ? (w / totalWeightForCalc) : 0;
      return { id: sq, title: sq, targetPct: pct, ...columnColors[i % columnColors.length] };
    })
  ];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl w-full max-w-[95vw] h-[90vh] flex flex-col overflow-hidden">
        <div className="flex justify-between items-center p-4 sm:p-6 border-b border-slate-800 shrink-0 bg-slate-950">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-black text-white uppercase tracking-widest hidden lg:flex items-center gap-2">🛡️ Team Builder</h2>
            <div className="flex bg-slate-800 p-1 rounded-xl shadow-inner border border-slate-700/50">
              <button onClick={() => setActiveTab('roster')} className={`px-4 py-2 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all ${activeTab === 'roster' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}>1. Roster</button>
              <button onClick={() => setActiveTab('squads')} className={`px-4 py-2 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all ${activeTab === 'squads' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}>2. Squadre</button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === 'roster' ? (
              <button onClick={handleToggleAllParticipating} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] sm:text-xs font-black uppercase tracking-wider rounded-xl transition-colors shadow-sm border border-slate-600">
                {allParticipating ? '☐ Deseleziona Tutti' : '☑ Seleziona Tutti'}
              </button>
            ) : (
              <div className="flex items-center gap-2 bg-slate-800/50 p-1.5 rounded-xl border border-slate-700">
                {planningMode === 'auto' ? (
                  templates.length > 0 && (
                    <select 
                      value={selectedTemplateId} 
                      onChange={e => setSelectedTemplateId(e.target.value)}
                      className="bg-slate-900 border border-indigo-500/50 text-indigo-300 text-[10px] sm:text-xs font-bold px-2 py-1.5 rounded-lg outline-none cursor-pointer max-w-[150px] truncate"
                    >
                      {templates.map(t => <option key={t.id} value={t.id}>📐 {t.name}</option>)}
                    </select>
                  )
                ) : (
                  <button onClick={handleAddManualSquad} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] sm:text-xs font-black uppercase tracking-wider rounded-lg transition-colors shadow-md flex items-center gap-1">
                    ➕ <span className="hidden sm:inline">Nuova Squadra</span>
                  </button>
                )}
                <button onClick={handleAutoAssignSquads} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] sm:text-xs font-black uppercase tracking-wider rounded-lg transition-colors shadow-md">
                  ⚖️ Auto-Bilancia %
                </button>
              </div>
            )}
            <div className="w-px h-6 bg-slate-700 mx-1"></div>
            <button onClick={onDeploy} disabled={roster.filter(p => p.isParticipating).length === 0} className="px-3 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-[10px] sm:text-xs font-black uppercase tracking-wider rounded-xl transition-colors shadow-lg">
              🎯 Applica
            </button>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:bg-rose-900 hover:text-rose-400 transition-colors font-bold ml-1">✕</button>
          </div>
        </div>
        
        {activeTab === 'roster' ? (
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            <RosterTable 
              roster={roster} 
              onAddPlayer={() => {}} 
              onEdit={handleEditPlayer} 
              onDelete={() => {}} 
              onDeploy={onDeploy} 
              userRole={userRole} 
              isSwordlandMode={true} 
              onBulkUpdate={setRoster} 
            />
          </div>
        ) : (
          <div className="flex-1 p-2 sm:p-4 grid gap-3 sm:gap-4 overflow-hidden bg-slate-950/50" style={{ gridTemplateColumns: `repeat(${dynamicColumns.length}, minmax(0, 1fr))` }}>
            {dynamicColumns.map(col => {
              
              const columnPlayers = roster
                .filter(p => p.isParticipating && (col.id === '' ? !activeSquadsList.includes(p.squad) : p.squad === col.id))
                .sort((a, b) => Number(b.power || 0) - Number(a.power || 0));

              const currentPower = getSquadPower(col.id);
              const targetPower = col.targetPct !== null ? (totalParticipatingPower * col.targetPct).toFixed(1) : null;

              return (
                <div key={col.id} className={`flex flex-col rounded-2xl border ${col.border} ${col.bg} overflow-hidden`} onDrop={e => handleSquadDrop(e, col.id)} onDragOver={e => e.preventDefault()}>
                  
                  <div className={`p-2 border-b ${col.border} flex flex-col bg-black/30 shrink-0 gap-1`}>
                    <div className="flex justify-between items-center gap-2">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className={`font-black uppercase text-[10px] xl:text-xs tracking-wider ${col.text} truncate`}>
                          {col.title}
                        </span>
                        {/* INPUT PESO PERCENTUALE MANUALE */}
                        {planningMode === 'manual' && col.id !== '' ? (
                          <div className="flex items-center gap-1 shrink-0" title="Inserisci peso per bilanciamento %">
                            <input type="number" min="0" value={manualWeights[col.id] || 0} onChange={e => handleWeightChange(col.id, e.target.value)} className={`w-10 bg-slate-900 border ${col.border} rounded px-1 py-0.5 text-[10px] font-bold text-white text-center outline-none`} />
                            <span className="text-[9px] text-slate-500">%</span>
                          </div>
                        ) : (
                          col.targetPct !== null && <span className={`opacity-70 text-[10px] font-bold shrink-0 ${col.text}`}>({Math.round(col.targetPct * 100)}%)</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="bg-black/60 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-white shadow-inner">
                          {currentPower}M
                        </span>
                        {/* PULSANTE RIMUOVI SQUADRA */}
                        {planningMode === 'manual' && col.id !== '' && (
                          <button onClick={() => handleRemoveManualSquad(col.id)} className="text-rose-500 hover:bg-rose-900 hover:text-white rounded w-5 h-5 flex items-center justify-center transition-colors font-bold text-xs leading-none shrink-0" title="Elimina Squadra">✕</button>
                        )}
                      </div>
                    </div>
                    {targetPower !== null && (
                      <div className="flex justify-between items-center text-[8px] uppercase tracking-widest text-slate-400 mt-1">
                        <span>Obiettivo: {targetPower}M</span>
                        <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                           <div className={`h-full ${col.bg.replace('/30', '')}`} style={{ width: `${Math.min(100, (currentPower / targetPower) * 100)}%` }}></div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto p-1.5 sm:p-2 flex flex-col gap-1.5 sm:gap-2 custom-scrollbar">
                    {columnPlayers.map((p, idx) => (
                      <div key={p.id} draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', `squad_player:${p.id}`)} className={`p-1.5 sm:p-2 rounded-xl border ${col.border} bg-slate-900/80 hover:bg-slate-800 cursor-grab active:cursor-grabbing flex flex-col sm:flex-row sm:items-center justify-between shadow-sm transition-colors gap-1`}>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`text-[7px] sm:text-[8px] font-black uppercase px-1 py-0.5 rounded border ${col.border} ${col.text} ${col.tag} shrink-0`}>
                            {p.originalTag || p.tag || 'PLY'}
                          </span>
                          <span className="text-[10px] sm:text-xs font-bold text-slate-200 truncate flex items-center gap-1">
                            {idx === 0 && col.id !== '' && <span title="Capitano della Squadra" className="drop-shadow-md text-sm">👑</span>}
                            {p.name}
                          </span>
                        </div>
                        <span className="text-[8px] sm:text-[10px] font-mono text-slate-400 shrink-0">{p.power}M</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  );
}