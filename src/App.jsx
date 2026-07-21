import { db } from './firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { useState, useEffect, useRef } from 'react';
import { initialBuildings } from './data/buildings';
import { BuildingTable } from './components/BuildingTable';
import { RosterTable } from './components/RosterTable';
import { InteractiveMap } from './components/InteractiveMap';
import { SidebarNav } from './components/SidebarNav';
import { TimelineControls } from './components/TimelineControls';
import { DeploymentPanel } from './components/DeploymentPanel';
import { MarchesPanel } from './components/MarchesPanel';
import { calculateDynamicScores } from './utils/scoreEngine';
import { useMarches } from './hooks/useMarches';
import { ExportModal } from './components/ExportModal';

function App() {
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
  const [newMarch, setNewMarch] = useState({ leader: '', members: [] });

  const [roster, setRoster] = useState(() => {
    const saved = localStorage.getItem('swordland-roster');
    return saved ? JSON.parse(saved) : [];
  });
  const [isLoadingRoster, setIsLoadingRoster] = useState(false);
  const fileInputRef = useRef(null);

  const [buildings, setBuildings] = useState(() => {
    const savedBuildings = localStorage.getItem('swordland-buildings');
    if (!savedBuildings) return initialBuildings;
    const parsedBuildings = JSON.parse(savedBuildings);
    return initialBuildings.map(initialBuilding => {
      const savedBuilding = parsedBuildings.find(b => b.id === initialBuilding.id);
      return savedBuilding ? { ...savedBuilding, scale: initialBuilding.scale, icon: initialBuilding.icon } : initialBuilding;
    });
  });

  // ---- HOOK CUSTOM PER LE MARCE ----
  const { 
    marches, setMarches, draftPositions, setDraftPositions, 
    getCurrentPosition, handleDispatchMarch, handleConfirmMinute, handleCancelMinute 
  } = useMarches(activeDeployment, setActiveDeployment, buildings, teamBase, currentTime);

  useEffect(() => { localStorage.setItem('swordland-roster', JSON.stringify(roster)); }, [roster]);
  useEffect(() => { localStorage.setItem('swordland-buildings', JSON.stringify(buildings)); }, [buildings]);

  // EFFETTO CALCOLO PUNTEGGI
  useEffect(() => {
    let events = [];
    const extractEvents = (entities) => {
      entities.forEach(entity => {
        if (entity.positions) {
          Object.values(entity.positions).forEach(pos => {
            if (pos.isMarching && pos.arrivalTime && pos.targetBuildingId) {
              events.push({ arrivalTime: pos.arrivalTime, targetBuildingId: pos.targetBuildingId, team: teamBase });
            }
          });
        }
      });
    };
    extractEvents(activeDeployment);
    extractEvents(marches);
    setTeamScores(calculateDynamicScores(currentTime, events, buildings));
  }, [currentTime, activeDeployment, marches, buildings, teamBase]);

  // TIMELINE E PLAYBACK
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

  const getAvailableMarches = (playerId) => {
    const player = activeDeployment.find(p => String(p.id) === String(playerId));
    if (!player) return 0;
    const total = player.marches || 1;
    let used = 0;
    marches.forEach(m => {
      if (String(m.leader) === String(playerId)) used++;
      if (m.members.map(String).includes(String(playerId))) used++;
    });
    return total - used;
  };

  const handleCreateMarch = () => {
    if (!newMarch.leader) return;
    const march = { id: `march-${Date.now()}`, leader: newMarch.leader, members: newMarch.members, positions: {} };
    setMarches([...marches, march]);
    setNewMarch({ leader: '', members: [] });
  };

  const handleDeleteMarch = (id) => {
    setMarches(marches.filter(m => String(m.id) !== String(id)));
    if (draftPositions[id]) {
      const newDrafts = { ...draftPositions };
      delete newDrafts[id];
      setDraftPositions(newDrafts);
    }
  };

  const handleRemoveFromMarch = (marchId, playerIdToRemove) => {
    setMarches(prevMarches => {
      const marchIndex = prevMarches.findIndex(m => String(m.id) === String(marchId));
      if (marchIndex === -1) return prevMarches;
      const march = prevMarches[marchIndex];

      if (march.members.map(String).includes(String(playerIdToRemove))) {
        const newMembers = march.members.filter(id => String(id) !== String(playerIdToRemove));
        const newMarches = [...prevMarches];
        newMarches[marchIndex] = { ...march, members: newMembers };
        return newMarches;
      }

      if (String(march.leader) === String(playerIdToRemove)) {
        if (march.members.length === 0) return prevMarches.filter(m => String(m.id) !== String(marchId));
        let highestPowerMember = null;
        let maxPower = -1;
        march.members.forEach(memberId => {
          const player = activeDeployment.find(p => String(p.id) === String(memberId));
          if (player && player.power > maxPower) { maxPower = player.power; highestPowerMember = memberId; }
        });
        if (highestPowerMember) {
          const newMembers = march.members.filter(id => String(id) !== String(highestPowerMember));
          const newMarches = [...prevMarches];
          newMarches[marchIndex] = { ...march, leader: highestPowerMember, members: newMembers };
          return newMarches;
        }
      }
      return prevMarches;
    });
  };

  const handleHeal = (e, playerId) => {
    e.stopPropagation();
    let marchesToDissolve = [];
    setMarches(prevMarches => {
      const updatedMarches = [];
      for (const march of prevMarches) {
        if (march.members.map(String).includes(String(playerId))) {
          updatedMarches.push({ ...march, members: march.members.filter(id => String(id) !== String(playerId)) });
        } else if (String(march.leader) === String(playerId)) {
          if (march.members.length === 0) marchesToDissolve.push(march.id);
          else {
            let highestPowerMember = null;
            let maxPower = -1;
            march.members.forEach(memberId => {
              const player = activeDeployment.find(p => String(p.id) === String(memberId));
              if (player && player.power > maxPower) { maxPower = player.power; highestPowerMember = memberId; }
            });
            if (highestPowerMember) {
              updatedMarches.push({ ...march, leader: highestPowerMember, members: march.members.filter(id => String(id) !== String(highestPowerMember)) });
            }
          }
        } else updatedMarches.push(march);
      }
      return updatedMarches;
    });

    setDraftPositions(prev => {
      const newDrafts = { ...prev };
      if (newDrafts[playerId]) delete newDrafts[playerId];
      marchesToDissolve.forEach(mId => { if (newDrafts[mId]) delete newDrafts[mId]; });
      return newDrafts;
    });
    setHealingEvents(prev => ({ ...prev, [playerId]: currentTime }));
    setActiveDeployment(prev => prev.map(p => String(p.id) === String(playerId) ? { ...p, positions: { ...(p.positions || {}), [currentTime]: { removed: true } } } : p));
  };

  const handleCancelHeal = (e, playerId) => {
    e.stopPropagation();
    setHealingEvents(prev => { const newHeals = { ...prev }; delete newHeals[playerId]; return newHeals; });
  };

  const handleUpdatePosition = (dragData, newX, newY) => {
    const [type, id] = dragData.split(':');
    if (type === 'building') { setBuildings(prev => prev.map(b => String(b.id) === String(id) ? { ...b, x: newX, y: newY } : b)); return; }
    if (type === 'player') {
      setActiveDeployment(prev => prev.map(p => String(p.id) === String(id) ? { ...p, positions: { ...(p.positions || {}), [currentTime]: { x: newX, y: newY, removed: false } } } : p));
      setMarches(prevMarches => prevMarches.filter(m => String(m.leader) !== String(id) && !m.members.map(String).includes(String(id))));
    }
    setIsPlaying(false);
  };

  const handleWithdraw = (id) => { setDraftPositions(prev => ({ ...prev, [id]: { removed: true } })); setIsPlaying(false); };

  const handleTimeChange = (newTime) => {
    if (Object.keys(draftPositions).length > 0) return;
    setIsPlaying(false);
    if (newTime >= 0 && newTime <= 60) setCurrentTime(newTime);
  };

  const togglePlay = () => {
    if (Object.keys(draftPositions).length > 0) return;
    if (!isPlaying && currentTime >= 60) setCurrentTime(0);
    setIsPlaying(!isPlaying);
  };

  // ROSTER E CLOUD FUNCTIONS
  const handleAddPlayer = (playerData) => setRoster(prev => [...prev, { id: `player-${Date.now()}`, ...playerData }]);
  const handleEditPlayer = (id, field, value) => setRoster(prev => prev.map(player => player.id === id ? { ...player, [field]: value } : player));
  const handleDeletePlayer = (id) => setRoster(prev => prev.filter(player => player.id !== id));

  const handleExportProject = () => {
    const projectData = { version: '1.2', teamBase, buildings, activeDeployment, marches, healingEvents };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(projectData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `tattica_swordland_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImportProject = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const projectData = JSON.parse(e.target.result);
        if (projectData.teamBase) setTeamBase(projectData.teamBase);
        if (projectData.buildings) setBuildings(projectData.buildings);
        if (projectData.activeDeployment) setActiveDeployment(projectData.activeDeployment);
        if (projectData.marches) setMarches(projectData.marches);
        if (projectData.healingEvents) setHealingEvents(projectData.healingEvents);
        setCurrentTime(0);
        setDraftPositions({});
        setIsPlaying(false);
        setActivePanel(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        alert("Progetto caricato con successo!");
      } catch (error) { alert("File di progetto non valido o corrotto."); }
    };
    reader.readAsText(file);
  };

  const handleSaveToFirebase = async () => {
    const code = window.prompt("Inserisci il Codice della tua Alleanza per SALVARE il progetto mappa in Cloud:", "");
    if (!code) return;
    try {
      const projectData = { version: '1.2', teamBase, buildings, activeDeployment, marches, healingEvents };
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
        const projectData = docSnap.data();
        if (projectData.teamBase) setTeamBase(projectData.teamBase);
        if (projectData.buildings) setBuildings(projectData.buildings);
        if (projectData.activeDeployment) setActiveDeployment(projectData.activeDeployment);
        if (projectData.marches) setMarches(projectData.marches);
        if (projectData.healingEvents) setHealingEvents(projectData.healingEvents);
        setCurrentTime(0); setDraftPositions({}); setIsPlaying(false); setActivePanel(null);
        alert(`Progetto mappa caricato con successo (Codice: ${code.toUpperCase()})`);
      } else alert("Nessun salvataggio mappa trovato per questo codice.");
    } catch (error) { alert("Errore durante il caricamento da Firebase."); }
  };

  const handleSaveRosterToCloud = async () => {
    const code = window.prompt("Inserisci il Codice della tua Alleanza per SALVARE il Roster in Cloud:");
    if (!code) return;
    try {
      await setDoc(doc(db, "rosters", code.toUpperCase()), { players: roster });
      alert(`Roster salvato in Cloud con il codice: ${code.toUpperCase()}`);
    } catch (error) { alert("Errore durante il salvataggio del Roster."); }
  };

  const handleLoadRosterFromCloud = async () => {
    const code = window.prompt("Inserisci il Codice della tua Alleanza per CARICARE il Roster dal Cloud:");
    if (!code) return;
    try {
      setIsLoadingRoster(true);
      const docSnap = await getDoc(doc(db, "rosters", code.toUpperCase()));
      if (docSnap.exists()) {
        setRoster(docSnap.data().players || []);
        alert(`Roster caricato con successo (Codice: ${code.toUpperCase()})`);
      } else alert("Nessun Roster trovato per questo codice.");
    } catch (error) { alert("Errore durante il caricamento del Roster."); }
    finally { setIsLoadingRoster(false); }
  };

  const handleNewProject = () => {
    if (window.confirm("Sei sicuro di voler avviare un nuovo progetto? Tutti i dati non salvati andranno persi.")) {
      setTeamBase('blue'); setBuildings(initialBuildings); setActiveDeployment([]); setMarches([]);
      setHealingEvents({}); setCurrentTime(0); setDraftPositions({}); setIsPlaying(false); setActivePanel(null);
    }
  };

  const hasDrafts = Object.keys(draftPositions).length > 0;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      <SidebarNav
        activePanel={activePanel} setActivePanel={setActivePanel}
        teamBase={teamBase} setTeamBase={setTeamBase}
        handleExportProject={handleExportProject} handleImportProject={handleImportProject}
        handleSaveToFirebase={handleSaveToFirebase} handleLoadFromFirebase={handleLoadFromFirebase}
        fileInputRef={fileInputRef} handleNewProject={handleNewProject}
      />
      
      {activePanel && (
        <aside className={`my-6 ml-6 app-panel flex flex-col z-20 shrink-0 transition-all duration-300 ease-in-out ${activePanel === 'buildings' ? 'w-[850px]' : activePanel === 'roster' ? 'w-[680px]' : 'w-[320px]'}`}>
          <div className="flex justify-between items-center p-4 border-b border-slate-700/50 shrink-0 bg-slate-800/50 rounded-t-xl">
            <h2 className="text-lg font-bold uppercase tracking-wider flex items-center gap-2">
              {activePanel === 'buildings' && <span className="text-cyan-400">Edifici</span>}
              {activePanel === 'roster' && <span className="text-cyan-400">Giocatori</span>}
              {activePanel === 'deployment' && <span className="text-amber-400">Singoli</span>}
              {activePanel === 'marches' && <span className="text-purple-400">Marce</span>}
            </h2>
            <button onClick={() => setActivePanel(null)} className="text-slate-400 hover:text-red-400 transition-colors w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-700">✕</button>
          </div>
          <div className="overflow-y-auto flex-1 w-full rounded-b-xl bg-slate-900/50">
            {activePanel === 'buildings' && <div className="px-6 pb-6 pt-4"><BuildingTable buildings={buildings} onEdit={handleEditBuilding} /></div>}
            
            {activePanel === 'roster' && (
              <div className="flex flex-col h-full">
                <div className="flex justify-between items-center px-6 pt-4 pb-4 border-b border-slate-700/50 bg-slate-800/20">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Database Alleanza</span>
                  <div className="flex gap-2">
                    <button onClick={handleLoadRosterFromCloud} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-bold rounded-lg transition-colors border border-slate-600 flex items-center gap-2 shadow-sm">⬇️ Carica</button>
                    <button onClick={handleSaveRosterToCloud} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-bold rounded-lg transition-colors border border-slate-600 flex items-center gap-2 shadow-sm">☁️ Salva</button>
                  </div>
                </div>
                <div className="px-6 pb-6 pt-4 overflow-y-auto">
                  {isLoadingRoster ? (
                    <div className="text-center text-slate-400 py-10 animate-pulse">Ricerca database in corso...</div>
                  ) : (
                    <RosterTable roster={roster} onAddPlayer={handleAddPlayer} onEdit={handleEditPlayer} onDelete={handleDeletePlayer} onDeploy={handleDeploy} />
                  )}
                </div>
              </div>
            )}

            {activePanel === 'deployment' && <DeploymentPanel activeDeployment={activeDeployment} getAvailableMarches={getAvailableMarches} healingEvents={healingEvents} currentTime={currentTime} getCurrentPosition={getCurrentPosition} draftPositions={draftPositions} handleWithdraw={handleWithdraw} handleHeal={handleHeal} handleCancelHeal={handleCancelHeal} />}
            {activePanel === 'marches' && <MarchesPanel newMarch={newMarch} setNewMarch={setNewMarch} activeDeployment={activeDeployment} getAvailableMarches={getAvailableMarches} healingEvents={healingEvents} currentTime={currentTime} handleCreateMarch={handleCreateMarch} marches={marches} getCurrentPosition={getCurrentPosition} draftPositions={draftPositions} handleDeleteMarch={handleDeleteMarch} handleRemoveFromMarch={handleRemoveFromMarch} handleWithdraw={handleWithdraw} />}
          </div>
        </aside>
      )}
      
{/* LAYOUT DEFINITIVO ADATTIVO E SENZA SCROLL */}
      <main className="flex-1 p-2 sm:p-4 flex gap-3 sm:gap-4 min-w-0 min-h-0 h-full overflow-hidden">
        
        {/* LA MAPPA */}
        <div className="flex-1 relative min-w-0 min-h-0 h-full rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl bg-slate-900/50 border border-slate-800/80">
          <InteractiveMap 
            teamBase={teamBase} 
            buildings={buildings} 
            activeDeployment={activeDeployment} 
            marches={marches} 
            onUpdatePosition={handleUpdatePosition} 
            currentTime={currentTime} 
            draftPositions={draftPositions} 
            healingEvents={healingEvents} 
            onDispatchMarch={handleDispatchMarch} 
            getAvailableMarches={getAvailableMarches} 
          />
        </div>

        {/* PANNELLO DESTRO (Niente più overflow-y-auto, si adatta e basta) */}
        <div className="w-48 xl:w-56 shrink-0 flex flex-col gap-3 xl:gap-4 z-10 h-full">
          
          {/* BOTTONE ESPORTA STRATEGIA */}
          <button 
            onClick={() => setIsExportModalOpen(true)}
            className="w-full shrink-0 bg-indigo-500/20 hover:bg-indigo-500 border border-indigo-500/50 text-indigo-400 hover:text-white font-bold py-2 xl:py-3 rounded-2xl xl:rounded-3xl text-[10px] xl:text-xs transition-all uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg backdrop-blur-xl"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Esporta Ordini
          </button>

          {/* SCOREBOARD COMPATTO A COLONNA */}
          <div className="bg-slate-900/40 backdrop-blur-xl rounded-2xl xl:rounded-3xl border border-slate-700/50 p-4 shadow-2xl flex flex-col gap-3 shrink-0">
            <div className="flex justify-between items-end border-b border-slate-700/50 pb-2">
              <span className="text-[9px] xl:text-[10px] font-bold text-cyan-400 uppercase tracking-widest pb-1">Team Blu</span>
              <span className="text-2xl xl:text-3xl font-black text-white drop-shadow-[0_0_8px_rgba(34,211,238,0.5)] leading-none">{Math.floor(teamScores.blue)}</span>
            </div>
            <div className="flex justify-between items-end pt-1">
              <span className="text-[9px] xl:text-[10px] font-bold text-red-400 uppercase tracking-widest pb-1">Team Rosso</span>
              <span className="text-2xl xl:text-3xl font-black text-white drop-shadow-[0_0_8px_rgba(248,113,113,0.5)] leading-none">{Math.floor(teamScores.red)}</span>
            </div>
          </div>

          {/* TIMELINE GLASSMORPHISM (flex-1 e min-h-0 per calcolare lo spazio perfetto) */}
          <div className="flex-1 min-h-0 bg-slate-900/40 backdrop-blur-xl rounded-2xl xl:rounded-3xl border border-slate-700/50 shadow-2xl overflow-hidden">
            <TimelineControls 
              currentTime={currentTime} 
              hasDrafts={hasDrafts} 
              handleTimeChange={handleTimeChange} 
              movementMode={movementMode} 
              setMovementMode={setMovementMode} 
              isPlaying={isPlaying} 
              togglePlay={togglePlay} 
              playbackSpeed={playbackSpeed} 
              setPlaybackSpeed={setPlaybackSpeed} 
              handleConfirmMinute={handleConfirmMinute} 
              handleCancelMinute={handleCancelMinute} 
            />
          </div>

        </div>
      </main>
     <ExportModal 
  isOpen={isExportModalOpen} 
  onClose={() => setIsExportModalOpen(false)} 
  marches={marches} 
  activeDeployment={activeDeployment}
  roster={roster}
/>
    </div>
  );
}

export default App;