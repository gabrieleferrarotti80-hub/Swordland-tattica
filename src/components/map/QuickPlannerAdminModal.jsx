import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export default function QuickPlannerAdminModal({ isOpen, onClose, buildings }) {
  const [templates, setTemplates] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  
  // STATO PER I TAB: 'squads' | 'timeline'
  const [activeTab, setActiveTab] = useState('squads');
  
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [condition, setCondition] = useState('');
  const [icon, setIcon] = useState('📜');
  const [squads, setSquads] = useState([]);
  const [squadWeights, setSquadWeights] = useState({});
  const [squadDivisions, setSquadDivisions] = useState({}); 
  const [commands, setCommands] = useState([]);
  const [plannerPreview, setPlannerPreview] = useState(null);

  useEffect(() => {
    if (isOpen) fetchTemplates();
  }, [isOpen]);

  const fetchTemplates = async () => {
    const docSnap = await getDoc(doc(db, "systemSettings", "quickPlannerTemplates"));
    if (docSnap.exists() && docSnap.data().templates) {
      setTemplates(docSnap.data().templates);
    }
  };

  const handleSelectDropdown = (id) => {
    if (!id) return;
    const t = templates.find(temp => temp.id === id);
    if (t) handleSelect(t);
  };

  const handleSelect = (t) => {
    setSelectedId(t.id); setName(t.name); setDesc(t.desc); setCondition(t.condition);
    setIcon(t.icon || '📜'); setSquads(t.squads || []); setCommands(t.commands || []);
    
    const w = t.squadWeights || {};
    const d = t.squadDivisions || {};
    
    if (t.squads && Object.keys(w).length === 0) {
      t.squads.forEach(sq => w[sq] = Math.round(100 / t.squads.length));
    }
    if (t.squads && Object.keys(d).length === 0) {
      t.squads.forEach(sq => d[sq] = 1);
    }

    setSquadWeights(w);
    setSquadDivisions(d);
  };

  const handleCreateNew = () => {
    setSelectedId(`strat_${Date.now()}`);
    setName('Nuova Dottrina'); setDesc(''); setCondition(''); setIcon('⚡');
    setSquads(['Assalto', 'Difesa', 'Supporto']);
    setSquadWeights({ 'Assalto': 50, 'Difesa': 30, 'Supporto': 20 });
    setSquadDivisions({ 'Assalto': 1, 'Difesa': 1, 'Supporto': 1 });
    setCommands([]);
    setActiveTab('squads'); // Riporta alla scheda setup
  };

  const handleSave = async () => {
    const newTemplate = { id: selectedId, name, desc, condition, icon, squads, squadWeights, squadDivisions, commands };
    const updated = selectedId && templates.some(t => t.id === selectedId)
      ? templates.map(t => t.id === selectedId ? newTemplate : t)
      : [...templates, newTemplate];
    
    await setDoc(doc(db, "systemSettings", "quickPlannerTemplates"), { templates: updated });
    setTemplates(updated);
    alert('Dottrina Salvata!');
  };

  const handleAddSquad = () => {
    const sqName = prompt('Nome della squadra? (es. "Incursori")');
    if (sqName && !squads.includes(sqName)) {
      setSquads([...squads, sqName]);
      setSquadWeights({ ...squadWeights, [sqName]: 0 });
      setSquadDivisions({ ...squadDivisions, [sqName]: 1 });
    }
  };

  const handleWeightChange = (sq, value) => setSquadWeights({ ...squadWeights, [sq]: Number(value) });
  const handleDivChange = (sq, value) => setSquadDivisions({ ...squadDivisions, [sq]: Number(value) });

  const handleAddCommand = () => {
    const firstUnlockedBuilding = buildings.find(b => (b.unlockTime || 0) <= 0)?.id || buildings[0]?.id || '';
    setCommands([...commands, { 
        id: Date.now(), time: 0, squad: squads[0] || 'all', 
        platoon: 'all', type: 'rally', buildingId: firstUnlockedBuilding, deployMode: 'teleport' 
    }]);
  };

 const getPlatoonOptions = (sqName) => {
    if (sqName === 'all' || !sqName) return [
        {val: 'all', label: 'Intera (100%)'}, {val: 'all_cap', label: 'Intera (Solo Cap.)'}
    ];
    const divs = squadDivisions[sqName] || 1;
    const opts = [{val: 'all', label: 'Intera (100%)'}, {val: 'all_cap', label: 'Intera (Solo Cap.)'}];
    if (divs > 1) {
        for(let i = 1; i <= divs; i++) {
            opts.push({val: `${i}`, label: `Plotone ${i}`});
            opts.push({val: `${i}_cap`, label: `Plotone ${i} (Solo Cap.)`});
        }
    }
    return opts;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-fuchsia-500/50 rounded-2xl shadow-2xl w-full max-w-7xl h-[85vh] flex flex-col overflow-hidden">
        
        {/* HEADER MODAL POTENZIATO */}
        <div className="flex justify-between items-center p-4 lg:p-5 border-b border-slate-800 bg-slate-950 shrink-0">
          <div className="flex items-center gap-4 lg:gap-8">
            <h2 className="text-xl font-black text-fuchsia-400 uppercase tracking-widest flex items-center gap-2">
              📜 Editor Dottrine
            </h2>
            
            <div className="flex items-center gap-3">
              <select 
                value={selectedId} 
                onChange={(e) => handleSelectDropdown(e.target.value)}
                className="bg-slate-800 border border-slate-600 text-white rounded-lg px-4 py-2 text-xs font-bold outline-none focus:border-fuchsia-500 min-w-[250px] cursor-pointer shadow-inner"
              >
                <option value="" disabled>-- Seleziona una Dottrina --</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.icon} {t.name}</option>)}
              </select>
              
              <button 
                onClick={handleCreateNew} 
                className="bg-fuchsia-900/60 hover:bg-fuchsia-700 text-fuchsia-200 border border-fuchsia-700 px-5 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-colors shadow-sm whitespace-nowrap"
              >
                + Crea Nuova
              </button>
            </div>
          </div>
          
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:text-white transition-colors font-bold">✕</button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          
          {/* SIDEBAR TABS (Sinistra) */}
          <div className="w-[220px] lg:w-[260px] shrink-0 bg-slate-950/50 border-r border-slate-800 p-4 flex flex-col gap-3">
            <button 
              onClick={() => setActiveTab('squads')} 
              disabled={!selectedId}
              className={`py-4 px-4 rounded-xl font-black uppercase tracking-wider text-xs text-left transition-all flex items-center gap-3 ${!selectedId ? 'opacity-50 cursor-not-allowed bg-slate-900 border border-slate-800 text-slate-600' : (activeTab === 'squads' ? 'bg-cyan-900/40 text-cyan-400 border border-cyan-500/50 shadow-[inset_0_0_15px_rgba(6,182,212,0.2)]' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 border border-slate-700/50')}`}
            >
              <span className="text-lg">🛡️</span> Setup Squadre
            </button>
            
            <button 
              onClick={() => setActiveTab('timeline')} 
              disabled={!selectedId}
              className={`py-4 px-4 rounded-xl font-black uppercase tracking-wider text-xs text-left transition-all flex items-center gap-3 ${!selectedId ? 'opacity-50 cursor-not-allowed bg-slate-900 border border-slate-800 text-slate-600' : (activeTab === 'timeline' ? 'bg-amber-900/40 text-amber-400 border border-amber-500/50 shadow-[inset_0_0_15px_rgba(245,158,11,0.2)]' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 border border-slate-700/50')}`}
            >
              <span className="text-lg">⏱️</span> Timeline Ordini
            </button>
          </div>

          {/* MAIN EDITOR (Destra) */}
          <div className="flex-1 bg-slate-900 flex flex-col overflow-hidden relative">
            {!selectedId ? (
              <div className="flex-1 flex items-center justify-center text-slate-500 font-bold uppercase tracking-widest">
                Seleziona o crea una dottrina dal menu in alto
              </div>
            ) : (
              <>
                {/* --- TAB 1: SQUADRE & SETUP --- */}
                {activeTab === 'squads' && (
                  <div className="flex-1 p-6 overflow-y-auto custom-scrollbar flex flex-col gap-6 animate-in fade-in duration-200">
                    
                    <div className="grid grid-cols-4 gap-4 bg-slate-800/30 p-5 rounded-2xl border border-slate-700/50">
                      <div className="col-span-1">
                        <label className="text-[10px] text-slate-400 font-bold uppercase ml-1">Icona</label>
                        <input type="text" value={icon} onChange={e => setIcon(e.target.value)} className="w-full bg-slate-950 border border-slate-600 rounded-lg p-3 text-white outline-none focus:border-cyan-500 text-center text-xl mt-1" />
                      </div>
                      <div className="col-span-3">
                        <label className="text-[10px] text-slate-400 font-bold uppercase ml-1">Nome Dottrina</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-950 border border-slate-600 rounded-lg p-3 text-white font-black uppercase tracking-wider outline-none focus:border-cyan-500 mt-1" />
                      </div>
                    </div>

                    <div className="bg-slate-800/30 p-5 rounded-2xl border border-slate-700/50 flex-1 flex flex-col">
                      <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-700/50">
                        <h3 className="text-sm font-black text-cyan-400 uppercase tracking-widest">Gestione Squadre e Plotoni</h3>
                        <button onClick={handleAddSquad} className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg uppercase font-bold transition-colors shadow-sm">+ Aggiungi Squadra</button>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 auto-rows-max overflow-y-auto custom-scrollbar pr-2">
                        {squads.map(sq => (
                          <div key={sq} className="flex flex-col bg-slate-950 border border-slate-600 rounded-xl overflow-hidden shadow-md">
                            <div className="flex justify-between items-center bg-slate-800 px-4 py-2.5 border-b border-slate-600">
                              <span className="text-xs font-black text-white uppercase tracking-wider">{sq}</span>
                              <button onClick={() => setSquads(squads.filter(s => s !== sq))} className="text-rose-500 hover:text-rose-400 font-bold text-sm transition-colors">✕</button>
                            </div>
                            <div className="flex flex-col gap-3 p-4">
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Forza (% del Team)</span>
                                <div className="flex items-center gap-1">
                                  <input type="number" min="0" max="100" value={squadWeights[sq] || 0} onChange={e => handleWeightChange(sq, e.target.value)} className="w-16 bg-slate-900 border border-slate-600 rounded-lg p-1.5 text-center text-xs text-amber-400 font-black focus:border-cyan-500 outline-none" />
                                  <span className="text-xs text-slate-500 font-bold">%</span>
                                </div>
                              </div>
                              <div className="flex justify-between items-center border-t border-slate-800 pt-3">
                                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Divisione Plotoni</span>
                                <select value={squadDivisions[sq] || 1} onChange={e => handleDivChange(sq, e.target.value)} className="w-24 bg-slate-900 border border-slate-600 rounded-lg p-1.5 text-center text-xs text-fuchsia-400 font-black focus:border-cyan-500 outline-none cursor-pointer">
                                   <option value="1">1 Plotone</option>
                                   <option value="2">2 Plotoni</option>
                                   <option value="3">3 Plotoni</option>
                                   <option value="4">4 Plotoni</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* --- TAB 2: TIMELINE (Massimizzata al 100%) --- */}
                {activeTab === 'timeline' && (
                  <div className="flex-1 flex flex-col p-6 overflow-hidden animate-in fade-in duration-200">
                    <div className="flex-1 bg-slate-800/30 rounded-2xl border border-slate-700/50 flex flex-col overflow-hidden shadow-inner">
                      
                      <div className="flex justify-between items-center p-4 border-b border-slate-700/50 bg-slate-900/50 shrink-0 z-20">
                        <div className="flex items-center gap-3">
                          <h3 className="text-sm font-black text-amber-400 uppercase tracking-widest">Ordine delle Operazioni</h3>
                          <span className="bg-slate-800 text-slate-400 text-[10px] font-bold px-2 py-1 rounded-md">{commands.length} Ordini Totali</span>
                        </div>
                        <button onClick={handleAddCommand} className="text-[11px] bg-cyan-700 hover:bg-cyan-600 text-white px-6 py-2.5 rounded-xl uppercase font-black shadow-lg transition-colors flex items-center gap-2">
                           ➕ Aggiungi Nuovo Ordine
                        </button>
                      </div>
                      
                      <div className="flex-1 overflow-auto custom-scrollbar px-4 pb-4">
                        <table className="w-full min-w-[850px] table-fixed border-separate border-spacing-y-1.5 relative mt-2">
                          <thead className="sticky top-0 z-30">
                            <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center drop-shadow-md">
                              <th className="w-16 px-1 py-2.5 bg-slate-800 rounded-l-xl border-y border-l border-slate-600 shadow-sm">Min.</th>
                              <th className="w-36 px-1 py-2.5 bg-slate-800 border-y border-slate-600 shadow-sm">Squadra</th>
                              <th className="w-36 px-1 py-2.5 text-fuchsia-400 bg-slate-800 border-y border-slate-600 shadow-sm">Plotone</th>
                              <th className="w-32 px-1 py-2.5 text-amber-400 bg-slate-800 border-y border-slate-600 shadow-sm">Azione</th>
                              <th className="w-48 px-1 py-2.5 text-cyan-400 bg-slate-800 border-y border-slate-600 shadow-sm">Obiettivo</th>
                              <th className="w-40 px-1 py-2.5 text-emerald-400 bg-slate-800 border-y border-slate-600 shadow-sm">Teletrasporto Base</th>
                              <th className="w-12 px-1 py-2.5 bg-slate-800 rounded-r-xl border-y border-r border-slate-600 shadow-sm"></th>
                            </tr>
                          </thead>
                          
                          <tbody>
                            {commands.map(cmd => (
                              <tr key={cmd.id} className="bg-slate-950 shadow-sm group hover:bg-slate-900 transition-colors">
                                <td className="p-1 rounded-l-lg border-y border-l border-slate-700">
                                  <input type="number" min="0" max="60" value={cmd.time} onChange={e => setCommands(commands.map(c => c.id === cmd.id ? {...c, time: Number(e.target.value)} : c))} className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2 text-xs text-amber-400 text-center font-black outline-none focus:border-amber-500" title="Minuto" />
                                </td>
                                
                                <td className="p-1 border-y border-slate-700">
                                  <select value={cmd.squad} onChange={e => setCommands(commands.map(c => c.id === cmd.id ? {...c, squad: e.target.value, platoon: 'all'} : c))} className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2 text-[11px] font-bold text-white uppercase outline-none focus:border-cyan-500 cursor-pointer text-center">
                                    <option value="all">TUTTI</option>
                                    {squads.map(sq => <option key={sq} value={sq}>{sq}</option>)}
                                  </select>
                                </td>

                                <td className="p-1 border-y border-slate-700">
                                  <select value={cmd.platoon || 'all'} onChange={e => setCommands(commands.map(c => c.id === cmd.id ? {...c, platoon: e.target.value} : c))} className="w-full bg-slate-800 border border-fuchsia-900/50 rounded-lg p-2 text-[11px] font-bold text-fuchsia-300 uppercase shadow-inner outline-none focus:border-fuchsia-500 cursor-pointer text-center">
                                    {getPlatoonOptions(cmd.squad).map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
                                  </select>
                                </td>

                                <td className="p-1 border-y border-slate-700">
                                  <select value={cmd.type} onChange={e => setCommands(commands.map(c => c.id === cmd.id ? {...c, type: e.target.value} : c))} className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2 text-[11px] font-bold text-white uppercase outline-none focus:border-amber-500 cursor-pointer text-center">
                                    <option value="rally">⚔️ Rally</option>
                                    <option value="solo">🏃‍♂️ Solo</option>
                                    <option value="raccolta">⛏️ Raccolta</option>
                                    <option value="ritirata">🔙 Ritirata</option>
                                  </select>
                                </td>

                                <td className="p-1 border-y border-slate-700">
                                  <select 
                                     value={cmd.buildingId} 
                                     onChange={e => setCommands(commands.map(c => c.id === cmd.id ? {...c, buildingId: e.target.value} : c))} 
                                     className="w-full bg-slate-800 border border-cyan-900/50 rounded-lg p-2 text-[10px] font-bold uppercase truncate outline-none focus:border-cyan-500 cursor-pointer text-center"
                                  >
                                    {buildings.map(b => {
                                      const unlockTime = Number(b.unlockTime) || 0;
                                      const orderTime = Number(cmd.time) || 0;
                                      const isLocked = orderTime < unlockTime;
                                      return (
                                        <option key={b.id} value={b.id} disabled={isLocked} className={isLocked ? 'text-slate-500 bg-slate-900 italic' : 'text-cyan-300'}>
                                          {b.name} {isLocked ? `(🔒 Min ${unlockTime})` : ''}
                                        </option>
                                      );
                                    })}
                                  </select>
                                </td>

                                <td className="p-1 border-y border-slate-700">
                                  <select value={cmd.deployMode || 'teleport'} onChange={e => setCommands(commands.map(c => c.id === cmd.id ? {...c, deployMode: e.target.value} : c))} className="w-full bg-slate-800 border border-emerald-900/50 rounded-lg p-2 text-[10px] font-bold text-emerald-300 uppercase shadow-inner outline-none focus:border-emerald-500 cursor-pointer text-center">
                                     <option value="teleport">⚡ Sì (Tutta Squa.)</option>
                                     <option value="teleport_cap">⚡ Sì (Solo Cap.)</option>
                                     <option value="walk">🏃 No (Marcia)</option>
                                  </select>
                                </td>

                                <td className="p-1 rounded-r-lg border-y border-r border-slate-700 text-center">
                                  <button onClick={() => setCommands(commands.filter(c => c.id !== cmd.id))} className="text-slate-500 hover:text-rose-500 hover:bg-slate-800 p-1.5 rounded-lg transition-colors w-8 h-8 flex items-center justify-center mx-auto font-bold">✕</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* FOOTER SALVATAGGIO (Assoluto in basso) */}
            {selectedId && (
              <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-800 bg-slate-950/80 backdrop-blur-md flex justify-end z-40">
                 <button onClick={handleSave} className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-black uppercase tracking-wider px-8 py-3 rounded-xl shadow-[0_0_20px_rgba(192,38,211,0.4)] transition-all flex items-center gap-2">
                   💾 Salva Dottrina nel Database
                 </button>
              </div>
            )}
            
            {/* Aggiunto padding-bottom al contenitore per non far coprire l'ultimo elemento della lista dal footer fixed */}
            {selectedId && <div className="h-[76px] shrink-0"></div>}
            
          </div>
        </div>
      </div>
    </div>
  );
}
