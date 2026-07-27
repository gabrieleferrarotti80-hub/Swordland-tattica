import { db } from '../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { initialBuildings } from '../data/buildings';
import { BuildingTable } from '../components/BuildingTable';
import { RosterTable } from '../components/RosterTable';
import { InteractiveMap } from '../components/InteractiveMap';
import { SidebarNav } from '../components/SidebarNav';
import { TimelineControls } from '../components/TimelineControls';
import { DeploymentPanel } from '../components/DeploymentPanel';
import { calculateDynamicScores } from '../utils/scoreEngine';
import { useMarches } from '../hooks/useMarches';
import { ExportModal } from '../components/ExportModal';

export default function Swordland({ roster, setRoster }) {
  const navigate = useNavigate();
  
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [activePanel, setActivePanel] = useState(null);
  const [activeDeployment, setActiveDeployment] = useState([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(5);
  const [teamBase, setTeamBase] = useState('blue');
  const [healingEvents, setHealingEvents] = useState({});
  const [movementMode, setMovementMode] = useState('march');
  const [teamScores, setTeamScores] = useState({ blue: 0, red: 0 });
  
  // STATO PER L'EDITOR DEGLI HITBOX E LA PASSWORD
  const [selectedBuildingForEdit, setSelectedBuildingForEdit] = useState('');
  const [isEditorUnlocked, setIsEditorUnlocked] = useState(false);
  const [editorPassword, setEditorPassword] = useState('');

  const [manualCaptures, setManualCaptures] = useState(() => {
    const saved = localStorage.getItem('swordland-manual-captures');
    return saved ? JSON.parse(saved) : [];
  });

  const fileInputRef = useRef(null);

  const [buildings, setBuildings] = useState(() => {
    const savedBuildings = localStorage.getItem('swordland-buildings');
    if (!savedBuildings) return initialBuildings;
    const parsedBuildings = JSON.parse(savedBuildings);
    return initialBuildings.map(initialBuilding => {
      const savedBuilding = parsedBuildings.find(b => b.id === initialBuilding.id);
      return savedBuilding ? { ...savedBuilding, scale: initialBuilding.scale, icon: initialBuilding.icon, hitbox: savedBuilding.hitbox } : initialBuilding;
    });
  });

  const { 
    marches, setMarches, draftPositions, setDraftPositions, 
    getCurrentPosition, handleDispatchMarch, handleConfirmMinute, handleCancelMinute,
    getAvailableMarches, handleHeal, handleCancelHeal, handleGarrisonAction, handleUpdatePosition, handleWithdraw
  } = useMarches({
    roster, activeDeployment, setActiveDeployment, 
    buildings, setBuildings, teamBase, currentTime, 
    setManualCaptures, setHealingEvents
  });

  useEffect(() => {
    const fetchMasterBuildings = async () => {
      try {
        const docSnap = await getDoc(doc(db, "projects", "MASTER_MAP_DATA"));
        if (docSnap.exists() && docSnap.data().buildings) {
          const cloudBuildings = docSnap.data().buildings;
          const mergedBuildings = initialBuildings.map(initial => {
            const cloudMatch = cloudBuildings.find(cb => cb.id === initial.id);
            return cloudMatch ? { ...initial, ...cloudMatch } : initial;
          });
          setBuildings(mergedBuildings);
          console.log("✅ Dati Edifici Master caricati dal Cloud!");
        }
      } catch (error) {
        console.warn("⚠️ Impossibile caricare il Master dal Cloud. Uso i dati locali.", error);
      }
    };
    
    fetchMasterBuildings();
  }, []);

  useEffect(() => { localStorage.setItem('swordland-buildings', JSON.stringify(buildings)); }, [buildings]);
  useEffect(() => { localStorage.setItem('swordland-manual-captures', JSON.stringify(manualCaptures)); }, [manualCaptures]);

  useEffect(() => {
    setTeamScores(calculateDynamicScores(currentTime, activeDeployment, marches, manualCaptures, buildings, teamBase));
  }, [currentTime, activeDeployment, marches, manualCaptures, buildings, teamBase]);

  useEffect(() => {
    let interval;
    if (isPlaying) {
      const msPerTick = 1000 / playbackSpeed;
      interval = setInterval(() => {
        setCurrentTime((prevTime) => {
          if (prevTime >= 60) { setIsPlaying(false); return 60; }
          return prevTime + 1;
        });
      }, msPerTick);
    }
    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed]);

  const handleEditBuilding = (id, field, value) => setBuildings(buildings.map(b => b.id === id ? { ...b, [field]: value } : b));
  
  const handleDeploy = () => {
    const playersToDeploy = roster.filter(p => p.isParticipating).map(p => ({ ...p, role: p.role || '', positions: p.positions || {} }));
    setActiveDeployment(playersToDeploy);
    setActivePanel('deployment');
  };

  const handleEditPlayer = (id, field, value) => {
    setRoster(roster.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const handleTimeChange = (newTime) => { if (Object.keys(draftPositions).length === 0) { setIsPlaying(false); if (newTime >= 0 && newTime <= 60) setCurrentTime(newTime); } };
  const togglePlay = () => { if (Object.keys(draftPositions).length === 0) { if (!isPlaying && currentTime >= 60) setCurrentTime(0); setIsPlaying(!isPlaying); } };

  const handleExportProject = () => {
    const projectData = { version: '1.4', teamBase, buildings, activeDeployment, marches, healingEvents, manualCaptures };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(projectData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `tattica_swordland_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchorNode); downloadAnchorNode.click(); downloadAnchorNode.remove();
  };

  const handleImportProject = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const pd = JSON.parse(e.target.result);
        if (pd.teamBase) setTeamBase(pd.teamBase);
        if (pd.buildings) setBuildings(pd.buildings);
        if (pd.activeDeployment) setActiveDeployment(pd.activeDeployment);
        if (pd.marches) setMarches(pd.marches);
        if (pd.healingEvents) setHealingEvents(pd.healingEvents);
        if (pd.manualCaptures) setManualCaptures(pd.manualCaptures);
        setCurrentTime(0); setDraftPositions({}); setIsPlaying(false); setActivePanel(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        alert("Progetto caricato con successo!");
      } catch (error) { alert("File non valido."); }
    };
    reader.readAsText(file);
  };

  const handleSaveMasterToCloud = async () => {
    if (window.confirm("ATTENZIONE: Stai per sovrascrivere le coordinate e gli hitbox per TUTTI gli utenti di Kingshot. Sei sicuro di voler aggiornare la mappa globale?")) {
      try {
        await setDoc(doc(db, "projects", "MASTER_MAP_DATA"), { 
          buildings: buildings,
          updatedAt: new Date().toISOString()
        });
        alert("✅ Mappa Globale aggiornata con successo su Firebase! Tutti gli utenti ora vedranno queste modifiche.");
      } catch (error) {
        console.error("Errore salvataggio Master:", error);
        alert("❌ Errore durante l'aggiornamento del Cloud.");
      }
    }
  };

  const handleSaveToFirebase = async () => {
    const code = window.prompt("Inserisci il Codice della tua Alleanza per SALVARE il progetto mappa in Cloud:", "");
    if (!code) return;
    try {
      const projectData = { version: '1.4', teamBase, buildings, activeDeployment, marches, healingEvents, manualCaptures };
      await setDoc(doc(db, "projects", code.toUpperCase()), projectData);
      alert(`Progetto salvato con successo per l'alleanza: ${code.toUpperCase()}`);
    } catch (error) { alert("Errore durante il salvataggio su Firebase."); }
  };

  const handleLoadFromFirebase = async () => {
    const code = window.prompt("Inserisci il Codice della tua Alleanza per CARICARE il progetto mappa dal Cloud:", "");
    if (!code) return;
    try {
      const docSnap = await getDoc(doc(db, "projects", code.toUpperCase()));
      if (docSnap.exists()) {
        const pd = docSnap.data();
        if (pd.teamBase) setTeamBase(pd.teamBase);
        if (pd.buildings) setBuildings(pd.buildings);
        if (pd.activeDeployment) setActiveDeployment(pd.activeDeployment);
        if (pd.marches) setMarches(pd.marches);
        if (pd.healingEvents) setHealingEvents(pd.healingEvents);
        if (pd.manualCaptures) setManualCaptures(pd.manualCaptures);
        setCurrentTime(0); setDraftPositions({}); setIsPlaying(false); setActivePanel(null);
        alert(`Progetto mappa caricato con successo (Codice: ${code.toUpperCase()})`);
      } else alert("Nessun salvataggio mappa trovato per questo codice.");
    } catch (error) { alert("Errore durante il caricamento."); }
  };

  const handleNewProject = () => {
    if (window.confirm("Sei sicuro di voler avviare un nuovo progetto? Tutti i dati non salvati andranno persi.")) {
      setTeamBase('blue'); setBuildings(initialBuildings); setActiveDeployment([]); setMarches([]); setManualCaptures([]);
      setHealingEvents({}); setCurrentTime(0); setDraftPositions({}); setIsPlaying(false); setActivePanel(null);
    }
  };

  // Funzione per sbloccare l'editor
  const handleUnlockEditor = () => {
    // CAMBIA QUESTA PASSWORD CON QUELLA CHE PREFERISCI
    if (editorPassword === 'FGgabriele1') {
      setIsEditorUnlocked(true);
      setEditorPassword('');
    } else {
      alert("❌ Password errata!");
      setEditorPassword('');
    }
  };

  const hasDrafts = Object.keys(draftPositions).length > 0;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 relative">
      <SidebarNav activePanel={activePanel} setActivePanel={setActivePanel} teamBase={teamBase} setTeamBase={setTeamBase} handleExportProject={handleExportProject} handleImportProject={handleImportProject} handleSaveToFirebase={handleSaveToFirebase} handleLoadFromFirebase={handleLoadFromFirebase} fileInputRef={fileInputRef} handleNewProject={handleNewProject} />
      
      {activePanel && (
        <aside className={`absolute lg:relative left-12 lg:left-0 top-0 bottom-0 my-6 lg:ml-6 app-panel flex flex-col z-50 shrink-0 transition-all duration-300 ease-in-out bg-slate-950/95 lg:bg-transparent shadow-2xl lg:shadow-none border lg:border-none border-slate-700/50 ${activePanel === 'buildings' ? 'w-[85vw] lg:w-[850px]' : activePanel === 'roster' ? 'w-[85vw] lg:w-[680px]' : 'w-[75vw] lg:w-[320px]'}`}>
          <div className="flex justify-between items-center p-4 border-b border-slate-700/50 shrink-0 bg-slate-800/50 rounded-t-xl">
            <h2 className="text-lg font-bold uppercase tracking-wider flex items-center gap-2">
              {activePanel === 'buildings' && <span className="text-cyan-400">Edifici</span>}
              {activePanel === 'roster' && <span className="text-cyan-400">Giocatori</span>}
              {activePanel === 'deployment' && <span className="text-amber-400">Singoli</span>}
              {activePanel === 'settings' && <span className="text-amber-400">Editor Hitbox</span>}
            </h2>
            <button onClick={() => { 
                setActivePanel(null); 
                setSelectedBuildingForEdit(''); 
                setIsEditorUnlocked(false); // Blocca di nuovo l'editor quando si chiude il pannello
              }} 
              className="text-slate-400 hover:text-red-400 transition-colors w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-700"
            >
              ✕
            </button>
          </div>
          <div className="overflow-y-auto flex-1 w-full rounded-b-xl bg-slate-900/50">
            {activePanel === 'buildings' && <div className="px-6 pb-6 pt-4"><BuildingTable buildings={buildings} onEdit={handleEditBuilding} /></div>}
            
            {activePanel === 'roster' && (
              <div className="flex flex-col h-full">
               <div className="flex justify-between items-center px-6 pt-4 pb-4 border-b border-slate-700/50 bg-slate-800/20">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Modifiche in Home</span>
                  <div className="flex gap-2">
                    <button onClick={() => navigate('/')} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-bold rounded-lg border border-slate-600 flex items-center shadow-sm">⬅ Hub</button>
                    <button onClick={handleDeploy} disabled={roster.filter(p => p.isParticipating).length === 0} className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg border border-amber-500 flex items-center shadow-sm ml-2">⚔️ Schieramento</button>
                  </div>
                </div>
                <div className="px-6 pb-6 pt-4 overflow-y-auto">
                  <RosterTable roster={roster} onAddPlayer={() => {}} onEdit={handleEditPlayer} onDelete={() => {}} onDeploy={handleDeploy} />
                </div>
              </div>
            )}

            {activePanel === 'deployment' && <DeploymentPanel activeDeployment={activeDeployment} getAvailableMarches={getAvailableMarches} healingEvents={healingEvents} currentTime={currentTime} getCurrentPosition={getCurrentPosition} draftPositions={draftPositions} handleWithdraw={handleWithdraw} handleHeal={handleHeal} handleCancelHeal={handleCancelHeal} />}

            {/* PANNELLO IMPOSTAZIONI / EDITOR HITBOX CON PASSWORD */}
            {activePanel === 'settings' && (
              <div className="flex flex-col h-full p-4 gap-4">
                
                {!isEditorUnlocked ? (
                  // SCHERMATA DI BLOCCO
                  <div className="bg-slate-800 p-6 rounded-xl border border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.1)] flex flex-col items-center justify-center gap-4 text-center mt-10">
                    <span className="text-4xl">🔒</span>
                    <div>
                      <h3 className="text-red-400 font-bold text-sm uppercase mb-1">Accesso Riservato</h3>
                      <p className="text-[10px] text-slate-400">Inserisci la password per modificare il Master della mappa globale.</p>
                    </div>
                    <input 
                      type="password" 
                      placeholder="Password..." 
                      value={editorPassword}
                      onChange={(e) => setEditorPassword(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleUnlockEditor(); }}
                      className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-slate-200 text-center outline-none focus:border-red-500 transition-colors"
                    />
                    <button 
                      onClick={handleUnlockEditor}
                      className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-2 rounded text-xs transition-colors shadow-md uppercase"
                    >
                      Sblocca Editor
                    </button>
                  </div>
                ) : (
                  // EDITOR VERO E PROPRIO (VISIBILE SOLO SE SBLOCCATO)
                  <>
                    <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                      <label className="block text-xs font-bold text-cyan-400 mb-2">Seleziona Edificio sulla Mappa o qui:</label>
                      <select value={selectedBuildingForEdit} onChange={(e) => setSelectedBuildingForEdit(e.target.value)} className="w-full bg-slate-900 border border-slate-600 text-slate-200 rounded p-2 text-sm outline-none">
                        <option value="">-- Nessuno Selezionato --</option>
                        {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </div>
                    
                    {selectedBuildingForEdit && (() => {
                       const b = buildings.find(x => x.id === selectedBuildingForEdit);
                       if (!b) return null;
                      return (
                      <div key={b.id} className="bg-slate-800 p-4 rounded-xl border border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.1)] flex flex-col gap-3 relative">
                        <h3 className="text-amber-400 font-bold text-xs uppercase">Coordinate Perimetro (Quadrati)</h3>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] text-slate-400 uppercase">X Minimo</label>
                            <input type="number" id="hb-xmin" defaultValue={b.hitbox?.xMin || b.x - 2} className="w-full bg-slate-900 border border-slate-600 rounded p-1.5 text-slate-200" />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 uppercase">Y Minimo</label>
                            <input type="number" id="hb-ymin" defaultValue={b.hitbox?.yMin || b.y - 2} className="w-full bg-slate-900 border border-slate-600 rounded p-1.5 text-slate-200" />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 uppercase">X Massimo</label>
                            <input type="number" id="hb-xmax" defaultValue={b.hitbox?.xMax || b.x + 2} className="w-full bg-slate-900 border border-slate-600 rounded p-1.5 text-slate-200" />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 uppercase">Y Massimo</label>
                            <input type="number" id="hb-ymax" defaultValue={b.hitbox?.yMax || b.y + 2} className="w-full bg-slate-900 border border-slate-600 rounded p-1.5 text-slate-200" />
                          </div>
                        </div>
                        
                        <div className="mt-1">
                          <label className="text-[10px] text-slate-400 uppercase">Scala Visiva Grafica</label>
                          <input type="number" step="0.1" id="hb-scale" defaultValue={b.scale || 1} className="w-full bg-slate-900 border border-slate-600 rounded p-1.5 text-slate-200" />
                        </div>

                        <div className="mt-2 pt-3 border-t border-slate-700/50">
                          <h3 className="text-cyan-400 font-bold text-xs uppercase mb-2">Centro Matematico (Marce)</h3>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[10px] text-slate-400 uppercase">Centro X</label>
                              <input type="number" id="hb-center-x" defaultValue={b.x} className="w-full bg-slate-900 border border-cyan-700/50 rounded p-1.5 text-cyan-100" />
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-400 uppercase">Centro Y</label>
                              <input type="number" id="hb-center-y" defaultValue={b.y} className="w-full bg-slate-900 border border-cyan-700/50 rounded p-1.5 text-cyan-100" />
                            </div>
                          </div>
                        </div>
                        
                        <button onClick={() => {
                          const xMin = parseFloat(document.getElementById('hb-xmin').value);
                          const yMin = parseFloat(document.getElementById('hb-ymin').value);
                          const xMax = parseFloat(document.getElementById('hb-xmax').value);
                          const yMax = parseFloat(document.getElementById('hb-ymax').value);
                          const scale = parseFloat(document.getElementById('hb-scale').value);
                          
                          const centerX = parseFloat(document.getElementById('hb-center-x').value);
                          const centerY = parseFloat(document.getElementById('hb-center-y').value);
                          
                          const updated = buildings.map(bd => 
                            bd.id === selectedBuildingForEdit 
                              ? { ...bd, hitbox: { xMin, xMax, yMin, yMax }, scale, x: centerX, y: centerY } 
                              : bd
                          );
                          setBuildings(updated);
                        }} className="mt-3 bg-amber-600 hover:bg-amber-500 text-white font-bold py-2 rounded text-xs transition-colors shadow-md">
                          Applica Hitbox, Scala e Centro
                        </button>
                      </div>
                       )
                    })()}

                    <div className="mt-auto pt-4 border-t border-slate-700/50">
                      <p className="text-[10px] text-slate-400 mb-3 leading-tight">
                        Quando hai finito di sistemare le coordinate di tutti gli edifici, salva le modifiche in Cloud. 
                        Diventeranno immediatamente effettive per tutti gli utenti dell'applicazione.
                      </p>
                      <button 
                        onClick={handleSaveMasterToCloud} 
                        className="w-full bg-indigo-600 hover:bg-indigo-500 border border-indigo-400 text-white font-bold text-xs py-3 rounded-lg flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(79,70,229,0.4)] transition-all"
                      >
                        ☁️ SALVA MASTER IN CLOUD
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </aside>
      )}
      
      <main className="flex-1 p-2 sm:p-4 flex flex-col lg:flex-row gap-3 sm:gap-4 min-w-0 min-h-0 h-full overflow-hidden">
        <div className="flex-1 relative min-w-0 min-h-0 rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl bg-slate-900/50 border border-slate-800/80">
         <InteractiveMap 
            teamBase={teamBase} 
            buildings={buildings} 
            activeDeployment={activeDeployment} 
            marches={marches} 
            onUpdatePosition={(dragData, newX, newY) => { setIsPlaying(false); handleUpdatePosition(dragData, newX, newY); }} 
            currentTime={currentTime} 
            draftPositions={draftPositions} 
            healingEvents={healingEvents} 
            onDispatchMarch={handleDispatchMarch} 
            getAvailableMarches={getAvailableMarches} 
            handleHeal={handleHeal} 
            handleCancelHeal={handleCancelHeal} 
            handleGarrisonAction={handleGarrisonAction}
            
            // PROPS PER L'EDITOR
            isEditorMode={activePanel === 'settings'}
            selectedBuildingForEdit={selectedBuildingForEdit}
            setSelectedBuildingForEdit={setSelectedBuildingForEdit}
         />
        </div>
        <div className="w-full lg:w-48 xl:w-56 shrink-0 flex flex-col gap-3 xl:gap-4 z-10 h-[350px] lg:h-full">
          <button onClick={() => navigate('/')} className="w-full shrink-0 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-bold py-2 xl:py-3 rounded-2xl xl:rounded-3xl text-[10px] xl:text-xs uppercase flex items-center justify-center gap-2 shadow-lg backdrop-blur-xl transition-all">
            ⬅ Hub Kingshot
          </button>
          <button onClick={() => setIsExportModalOpen(true)} className="w-full shrink-0 bg-indigo-500/20 hover:bg-indigo-500 border border-indigo-500/50 text-indigo-400 hover:text-white font-bold py-2 xl:py-3 rounded-2xl xl:rounded-3xl text-[10px] xl:text-xs uppercase flex items-center justify-center gap-2 shadow-lg backdrop-blur-xl">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            Esporta Ordini
          </button>
          
          <div className="bg-slate-900/40 backdrop-blur-xl rounded-2xl xl:rounded-3xl border border-slate-700/50 p-4 shadow-2xl flex flex-col gap-3 shrink-0">
            <div className="flex justify-between items-end border-b border-slate-700/50 pb-2">
              <span className="text-[9px] xl:text-[10px] font-bold text-cyan-400 uppercase pb-1">Team Blu</span>
              <span className="text-2xl xl:text-3xl font-black text-white drop-shadow-[0_0_8px_rgba(34,211,238,0.5)] leading-none">{Math.floor(teamScores.blue)}</span>
            </div>
            <div className="flex justify-between items-end pt-1">
              <span className="text-[9px] xl:text-[10px] font-bold text-red-400 uppercase pb-1">Team Rosso</span>
              <span className="text-2xl xl:text-3xl font-black text-white drop-shadow-[0_0_8px_rgba(248,113,113,0.5)] leading-none">{Math.floor(teamScores.red)}</span>
            </div>
          </div>
          <div className="flex-1 min-h-0 bg-slate-900/40 backdrop-blur-xl rounded-2xl xl:rounded-3xl border border-slate-700/50 shadow-2xl overflow-hidden">
            <TimelineControls currentTime={currentTime} hasDrafts={hasDrafts} handleTimeChange={handleTimeChange} movementMode={movementMode} setMovementMode={setMovementMode} isPlaying={isPlaying} togglePlay={togglePlay} playbackSpeed={playbackSpeed} setPlaybackSpeed={setPlaybackSpeed} handleConfirmMinute={handleConfirmMinute} handleCancelMinute={handleCancelMinute} />
          </div>
        </div>
      </main>
      
      <ExportModal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} marches={marches} activeDeployment={activeDeployment} roster={roster} />
    </div>
  );
}