import { db } from '../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { initialBuildings } from '../data/buildings';

// Componenti
import { BuildingTable } from '../components/BuildingTable';
import { RosterTable } from '../components/RosterTable';
import { InteractiveMap } from '../components/InteractiveMap';
import { TimelineControls } from '../components/TimelineControls';
import { DeploymentPanel } from '../components/DeploymentPanel';
import { ExportModal } from '../components/ExportModal';
import { DispatchModal } from '../components/DispatchModal'; 
import EventManagerModal from '../components/map/EventManagerModal'; 
import { InstructionsModal } from '../components/InstructionsModal';
import { calculateDynamicScores } from '../utils/scoreEngine';
import { useMarches } from '../hooks/useMarches';

export default function Swordland({ roster, setRoster, allianceCode, userRole }) {
  const navigate = useNavigate();
  const { t } = useTranslation(); 
  
  const [isBuildingModalOpen, setIsBuildingModalOpen] = useState(false);
  const [isEditorModalOpen, setIsEditorModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isEventManagerOpen, setIsEventManagerOpen] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  
  const [isPlayerManagerOpen, setIsPlayerManagerOpen] = useState(false);
  const [playerManagerTab, setPlayerManagerTab] = useState('roster'); 

  const [showManualPanel, setShowManualPanel] = useState(false);
  const [manualPlayerId, setManualPlayerId] = useState('');
  const [manualX, setManualX] = useState('');
  const [manualY, setManualY] = useState('');

  const [popupPlayerId, setPopupPlayerId] = useState(null);
  const [marchAssignments, setMarchAssignments] = useState({});

  const [currentPlanId, setCurrentPlanId] = useState(null);
  const [currentPlanName, setCurrentPlanName] = useState('');

  const [activeDeployment, setActiveDeployment] = useState([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [teamBase, setTeamBase] = useState('blue');
  const [healingEvents, setHealingEvents] = useState({});
  const [movementMode, setMovementMode] = useState('march');
  
  const [teamScores, setTeamScores] = useState({ blue: 0, red: 0 });
  const [lootDrops, setLootDrops] = useState([]); 
  const [buildingStates, setBuildingStates] = useState({});

  const [showDemoWelcome, setShowDemoWelcome] = useState(false);
  const [selectedBuildingForEdit, setSelectedBuildingForEdit] = useState('');

  const [manualCaptures, setManualCaptures] = useState(() => {
    const saved = localStorage.getItem('swordland-manual-captures');
    return saved ? JSON.parse(saved) : [];
  });

  const [buildings, setBuildings] = useState(() => {
    const savedBuildings = localStorage.getItem('swordland-buildings-v3');
    if (!savedBuildings) return initialBuildings;
    const parsedBuildings = JSON.parse(savedBuildings);
    return initialBuildings.map(initialBuilding => {
      const savedBuilding = parsedBuildings.find(b => b.id === initialBuilding.id);
      return savedBuilding ? { ...savedBuilding, scale: initialBuilding.scale, icon: initialBuilding.icon, hitbox: savedBuilding.hitbox, x: savedBuilding.x, y: savedBuilding.y } : initialBuilding;
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
    if (allianceCode === 'DEMO') {
      setShowDemoWelcome(true);
      const demoPlayers = [
        { id: 'd1', name: 'Ragnar', tag: 'DEMO', role: 'R5', power: 120, marches: 2, isParticipating: true, positions: { 0: 'base-blue' }, squad: 'Assalto' },
        { id: 'd2', name: 'Lagertha', tag: 'DEMO', role: 'R4', power: 105, marches: 2, isParticipating: true, positions: { 0: 'base-blue' }, squad: 'Difesa' },
        { id: 'd3', name: 'Bjorn', tag: 'DEMO', role: 'R3', power: 90, marches: 2, isParticipating: true, positions: { 0: 'base-blue' }, squad: 'Supporto' }
      ];
      if (!roster || roster.length === 0) setRoster(demoPlayers);
      setActiveDeployment(demoPlayers);
    }
  }, [allianceCode]);

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
        }
      } catch (error) {}
    };
    fetchMasterBuildings();
  }, [t]);

  useEffect(() => { localStorage.setItem('swordland-buildings-v3', JSON.stringify(buildings)); }, [buildings]);
  useEffect(() => { localStorage.setItem('swordland-manual-captures', JSON.stringify(manualCaptures)); }, [manualCaptures]);

  useEffect(() => {
    const result = calculateDynamicScores(currentTime, activeDeployment, marches, manualCaptures, buildings, teamBase);
    setTeamScores(result.scores);
    setLootDrops(result.lootDrops);
    setBuildingStates(result.buildingStates); 
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
  
  const handleEditHitbox = (id, bound, value) => {
    setBuildings(prev => prev.map(b => {
      if (b.id === id) {
        const currentHitbox = b.hitbox || { xMin: b.x - 2, xMax: b.x + 2, yMin: b.y - 2, yMax: b.y + 2 };
        return { ...b, hitbox: { ...currentHitbox, [bound]: value } };
      }
      return b;
    }));
  };
  
  const handleDeploy = () => {
    const playersToDeploy = roster.filter(p => p.isParticipating).map(p => ({ ...p, role: p.role || '', positions: p.positions || {} }));
    setActiveDeployment(playersToDeploy);
    setIsPlayerManagerOpen(false); 
  };

  const handleEditPlayer = (id, field, value) => setRoster(roster.map(p => p.id === id ? { ...p, [field]: value } : p));

  const allParticipating = roster.length > 0 && roster.every(p => p.isParticipating);
  const handleToggleAllParticipating = () => {
    const newState = !allParticipating;
    setRoster(roster.map(p => ({ ...p, isParticipating: newState })));
  };

  const handleAutoAssignSquads = () => {
    const participating = roster.filter(p => p.isParticipating);
    if (participating.length === 0) { alert(t('swordland.select_player_alert', "Seleziona almeno un giocatore da assegnare!")); return; }
    if (window.confirm(t('swordland.confirm_auto_assign', "Vuoi dividere automaticamente i giocatori in 3 squadre bilanciate per Potere?"))) {
      const sorted = [...participating].sort((a, b) => (b.power || 0) - (a.power || 0));
      const squads = ['Assalto', 'Difesa', 'Supporto'];
      const snakePattern = [0, 1, 2, 2, 1, 0];
      const newRoster = roster.map(p => {
        if (!p.isParticipating) return { ...p, squad: '' }; 
        const idx = sorted.findIndex(s => s.id === p.id);
        if (idx !== -1) return { ...p, squad: squads[snakePattern[idx % 6]] };
        return p;
      });
      setRoster(newRoster);
      if (activeDeployment.length > 0) {
        setActiveDeployment(newRoster.filter(p => p.isParticipating).map(p => ({ ...p, role: p.role || '', positions: p.positions || {} })));
      }
    }
  };

  const openPlayerManager = (tab) => {
    setPlayerManagerTab(tab);
    setIsPlayerManagerOpen(true);
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
      .filter(p => p.isParticipating && (sqName === '' ? !['Assalto', 'Difesa', 'Supporto'].includes(p.squad) : p.squad === sqName))
      .reduce((sum, p) => sum + Number(p.power || 0), 0)
      .toFixed(1);
  };

  const handleManualPositioning = () => {
    if (manualPlayerId && manualX !== '' && manualY !== '') {
      setIsPlaying(false);
      handleUpdatePosition(`player:${manualPlayerId}`, parseFloat(manualX), parseFloat(manualY));
      setManualX('');
      setManualY('');
    }
  };

  const handleConfirmDispatch = (playerId) => { 
    const assignments = Object.entries(marchAssignments).filter(([_, data]) => data.buildingId !== '');
    if (assignments.length > 0) {
      assignments.forEach(([marchIdx, data]) => {
        const memberIds = (data.members || []).map(m => typeof m === 'object' ? m.id : m);
        const membersDataWithSpeedups = data.members || [];
        
        const targetLoot = lootDrops.find(l => l.id === data.buildingId);
        
        if (targetLoot) {
           handleDispatchMarch(playerId, data.buildingId, parseInt(marchIdx), data.type, memberIds, membersDataWithSpeedups, targetLoot);
        } else {
           handleDispatchMarch(playerId, data.buildingId, parseInt(marchIdx), data.type, memberIds, membersDataWithSpeedups, null);
        }
      });
      setPopupPlayerId(null); 
      setMarchAssignments({});
    } 
  };

  const handleTimeChange = (newTime) => { if (Object.keys(draftPositions).length === 0) { setIsPlaying(false); if (newTime >= 0 && newTime <= 60) setCurrentTime(newTime); } };
  const togglePlay = () => { if (Object.keys(draftPositions).length === 0) { if (!isPlaying && currentTime >= 60) setCurrentTime(0); setIsPlaying(!isPlaying); } };

  const currentEventData = useMemo(() => ({
    version: '1.5', teamBase, buildings, activeDeployment, marches, healingEvents, manualCaptures
  }), [teamBase, buildings, activeDeployment, marches, healingEvents, manualCaptures]);

  const handleLoadData = (data, planId, planName) => {
    if (window.confirm(t('swordland.confirm_load_plan', `⚠️ Vuoi caricare il piano "{{planName}}"? I dati non salvati andranno persi.`, { planName }))) {
      if (data.teamBase) setTeamBase(data.teamBase);
      if (data.buildings) setBuildings(data.buildings);
      if (data.activeDeployment) setActiveDeployment(data.activeDeployment);
      if (data.marches) setMarches(data.marches);
      if (data.healingEvents) setHealingEvents(data.healingEvents);
      if (data.manualCaptures) setManualCaptures(data.manualCaptures);
      setCurrentTime(0); setDraftPositions({}); setIsPlaying(false);
      setCurrentPlanId(planId); setCurrentPlanName(planName); setIsEventManagerOpen(false);
    }
  };

  const handleCreateNewPlan = () => {
    if (window.confirm(t('swordland.confirm_reset_board', "⚠️ Vuoi azzerare la lavagna tattica? I dati della mappa master verranno mantenuti."))) {
      setTeamBase('blue'); 
      setActiveDeployment([]); 
      setMarches([]); 
      setManualCaptures([]);
      setHealingEvents({}); 
      setCurrentTime(0); 
      setDraftPositions({}); 
      setIsPlaying(false);
      setCurrentPlanId(null); 
      setCurrentPlanName(''); 
      setIsEventManagerOpen(false);
      
      setRoster(roster.map(p => ({ ...p, squad: '' })));
    }
  };

  const handleSaveMasterToCloud = async () => {
    if (window.confirm(t('swordland.master_overwrite_warning'))) {
      try {
        await setDoc(doc(db, "projects", "MASTER_MAP_DATA"), { buildings: buildings, updatedAt: new Date().toISOString() });
        alert(t('swordland.master_updated'));
      } catch (error) { alert(t('swordland.cloud_update_error')); }
    }
  };

  const handleFactoryReset = async () => {
    if (window.confirm(t('swordland.confirm_factory_reset', "⚠️ Vuoi forzare il ripristino? Questo sovrascriverà la mappa in Cloud con i dati attuali del tuo file buildings.js locale."))) {
      setBuildings(initialBuildings);
      try {
        await setDoc(doc(db, "projects", "MASTER_MAP_DATA"), { buildings: initialBuildings, updatedAt: new Date().toISOString() });
        alert(t('swordland.reset_success', "✅ Reset completato! La mappa ora è perfettamente sincronizzata con il file originale."));
      } catch (error) { alert(t('swordland.reset_error', "❌ Errore nel reset Cloud.")); }
    }
  };

  const hasDrafts = Object.keys(draftPositions).length > 0;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 relative font-sans">
      
      {showDemoWelcome && (
        <div className="absolute inset-0 z-[300] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/50 rounded-2xl shadow-2xl max-w-2xl w-full p-6 flex flex-col gap-4 animate-fade-in">
            <h2 className="text-2xl font-black text-amber-400">{t('swordland.demo_title', 'Benvenuto in Swordland! ⚔️')}</h2>
            <p className="text-slate-300 text-sm leading-relaxed">{t('swordland.demo_desc_2', 'Sei in modalità Sandbox con 3 Vichinghi pronti.')}</p>
            <button onClick={() => setShowDemoWelcome(false)} className="mt-4 w-full bg-amber-700 hover:bg-amber-600 text-white font-black tracking-widest uppercase py-3 rounded-lg transition-colors">
              {t('swordland.demo_start_btn', 'Inizia la Simulazione')}
            </button>
          </div>
        </div>
      )}

      <EventManagerModal isOpen={isEventManagerOpen} onClose={() => setIsEventManagerOpen(false)} currentData={currentEventData} onLoadData={handleLoadData} onCreateNewPlan={handleCreateNewPlan} allianceCode={allianceCode} currentPlanId={currentPlanId} currentPlanName={currentPlanName} onPlanSaved={(id, name) => { setCurrentPlanId(id); setCurrentPlanName(name); }} dbCollection="swordland_plans" legacyCollection="projects" legacyIds={[allianceCode, allianceCode.split('_')[0]]} />
      
      {isBuildingModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-slate-800 shrink-0">
              <h2 className="text-xl font-black text-cyan-400 uppercase tracking-widest">{t('swordland.building_management', '🏰 Gestione Edifici')}</h2>
              <button onClick={() => setIsBuildingModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:bg-rose-900 hover:text-rose-400 transition-colors font-bold">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar"><BuildingTable buildings={buildings} onEdit={handleEditBuilding} /></div>
          </div>
        </div>
      )}

      {isPlayerManagerOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-slate-800 shrink-0 bg-slate-950">
              <div className="flex items-center gap-6">
                <h2 className="text-xl font-black text-white uppercase tracking-widest hidden md:flex items-center gap-2">
                  {playerManagerTab === 'roster' ? t('swordland.roster_db', '👥 Database Roster') : t('swordland.team_builder', '🛡️ Team Builder')}
                </h2>
                <div className="flex bg-slate-800 p-1 rounded-xl shadow-inner border border-slate-700/50">
                  <button onClick={() => setPlayerManagerTab('roster')} className={`px-4 py-2 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all ${playerManagerTab === 'roster' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}>{t('swordland.tab_select_players', '1. Seleziona Giocatori')}</button>
                  <button onClick={() => setPlayerManagerTab('squads')} className={`px-4 py-2 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all ${playerManagerTab === 'squads' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}>{t('swordland.tab_assign_squads', '2. Assegna Squadre')}</button>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                {playerManagerTab === 'roster' ? (
                  <>
                    <button onClick={handleToggleAllParticipating} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] sm:text-xs font-black uppercase tracking-wider rounded-xl transition-colors shadow-sm border border-slate-600">
                      {allParticipating ? t('swordland.deselect_all', '☐ Deseleziona Tutti') : t('swordland.select_all_check', '☑ Seleziona Tutti')}
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={handleAutoAssignSquads} className="px-4 py-2 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/50 text-[10px] sm:text-xs font-black uppercase tracking-wider rounded-xl transition-colors flex items-center gap-2">
                      {t('swordland.auto_balance', '⚖️ Auto-Bilancia')}
                    </button>
                  </>
                )}
                <div className="w-px h-6 bg-slate-700 mx-1 hidden sm:block"></div>
                <button onClick={handleDeploy} disabled={roster.filter(p => p.isParticipating).length === 0} className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-[10px] sm:text-xs font-black uppercase tracking-wider rounded-xl transition-colors shadow-lg">
                  {t('swordland.apply_map', '🎯 Applica in Mappa')}
                </button>
                <button onClick={() => setIsPlayerManagerOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:bg-rose-900 hover:text-rose-400 transition-colors font-bold sm:ml-2">✕</button>
              </div>
            </div>
            {playerManagerTab === 'roster' ? (
              <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                <RosterTable roster={roster} onAddPlayer={() => {}} onEdit={handleEditPlayer} onDelete={() => {}} onDeploy={handleDeploy} userRole={userRole} />
              </div>
            ) : (
              <div className="flex-1 p-4 grid grid-cols-4 gap-4 overflow-hidden bg-slate-950/50">
                {[
                  { id: '', title: t('swordland.unassigned', 'Da Assegnare'), bg: 'bg-slate-800/40', border: 'border-slate-700', text: 'text-slate-400', tag: 'bg-slate-950' },
                  { id: 'Assalto', title: t('swordland.squad_assault', '⚔️ Assalto'), bg: 'bg-rose-950/30', border: 'border-rose-900/50', text: 'text-rose-400', tag: 'bg-rose-950' },
                  { id: 'Difesa', title: t('swordland.squad_defense', '🛡️ Difesa'), bg: 'bg-blue-950/30', border: 'border-blue-900/50', text: 'text-blue-400', tag: 'bg-blue-950' },
                  { id: 'Supporto', title: t('swordland.squad_support', '🤝 Supporto'), bg: 'bg-emerald-950/30', border: 'border-emerald-900/50', text: 'text-emerald-400', tag: 'bg-emerald-950' }
                ].map(col => {
                  const columnPlayers = roster.filter(p => p.isParticipating && (col.id === '' ? !['Assalto', 'Difesa', 'Supporto'].includes(p.squad) : p.squad === col.id));
                  return (
                    <div key={col.id} className={`flex flex-col rounded-2xl border ${col.border} ${col.bg} overflow-hidden`} onDrop={e => handleSquadDrop(e, col.id)} onDragOver={e => e.preventDefault()}>
                      <div className={`p-3 border-b ${col.border} flex justify-between items-center bg-black/20 shrink-0`}>
                        <span className={`font-black uppercase text-xs tracking-wider ${col.text}`}>{col.title}</span>
                        <span className="bg-black/40 px-2 py-1 rounded-lg text-[10px] font-mono font-bold text-white">{getSquadPower(col.id)}M</span>
                      </div>
                      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2 custom-scrollbar">
                        {columnPlayers.map(p => (
                          <div key={p.id} draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', `squad_player:${p.id}`)} className={`p-2 rounded-xl border ${col.border} bg-slate-900/80 hover:bg-slate-800 cursor-grab active:cursor-grabbing flex items-center justify-between shadow-sm transition-colors`}>
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border ${col.border} ${col.text} ${col.tag} shrink-0`}>{p.originalTag || p.tag || 'PLY'}</span>
                              <span className="text-xs font-bold text-slate-200 truncate">{p.name}</span>
                            </div>
                            <span className="text-[10px] font-mono text-slate-400 shrink-0">{p.power}M</span>
                          </div>
                        ))}
                        {columnPlayers.length === 0 && (<div className="h-full flex items-center justify-center text-slate-600 text-xs font-bold uppercase opacity-50 border-2 border-dashed border-slate-700/50 rounded-xl m-2">{t('swordland.drag_here', 'Trascina Qui')}</div>)}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {isEditorModalOpen && (
        <div className="fixed inset-y-0 right-0 z-[200] flex flex-col w-full max-w-lg bg-slate-900/95 backdrop-blur-xl border-l border-slate-700 shadow-[0_0_50px_rgba(0,0,0,0.8)] animate-in slide-in-from-right duration-300">
         <div className="flex justify-between items-center p-5 border-b border-slate-800 shrink-0 bg-slate-950">
            <h2 className="text-lg font-black text-red-400 uppercase tracking-widest">{t('swordland.master_editor_title', '⚙️ Master Editor')}</h2>
            <div className="flex items-center gap-2">
              <button onClick={handleFactoryReset} className="bg-red-900/60 hover:bg-red-700 border border-red-700/50 text-red-200 text-[10px] font-black uppercase px-3 py-2 rounded-xl transition-colors flex items-center gap-1 shadow-md" title={t('swordland.restore_coords_tooltip', 'Ripristina alle coordinate originali')}>{t('swordland.btn_reset', '🔄 Reset')}</button>
              <button onClick={handleSaveMasterToCloud} className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase px-3 py-2 rounded-xl transition-colors shadow-lg flex items-center gap-1">{t('swordland.btn_save_cloud', '☁️ Salva')}</button>
              <button onClick={() => setIsEditorModalOpen(false)} className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:bg-rose-900 hover:text-rose-400 transition-colors font-bold shrink-0">✕</button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar flex flex-col gap-4">
            <div className="bg-amber-900/20 border border-amber-700/50 p-3 rounded-xl text-amber-200 text-xs text-center font-bold">{t('swordland.editor_warning', 'Le modifiche si applicano in tempo reale sulla mappa. Quando sei soddisfatto, clicca Salva Cloud.')}</div>
            {buildings.map(b => (
              <div key={b.id} className="bg-slate-800/40 p-4 rounded-2xl border border-slate-700 shadow-inner flex flex-col gap-3">
                <h3 className="text-cyan-400 font-black uppercase tracking-wider text-sm border-b border-slate-700/50 pb-2 flex items-center gap-2"><span className="text-lg opacity-80">🏰</span> {b.name}</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div><label className="text-[9px] text-slate-400 uppercase font-bold">{t('swordland.visual_scale', 'Scala Visiva')}</label><input type="number" step="0.1" value={b.scale || 1} onChange={(e) => handleEditBuilding(b.id, 'scale', parseFloat(e.target.value))} className="w-full bg-slate-950 border border-slate-600 rounded-lg p-2 text-sm text-white mt-1 outline-none focus:border-cyan-500 font-mono" /></div>
                  <div><label className="text-[9px] text-slate-400 uppercase font-bold">{t('swordland.center_x', 'Centro X')}</label><input type="number" value={b.x} onChange={(e) => handleEditBuilding(b.id, 'x', parseFloat(e.target.value))} className="w-full bg-slate-950 border border-cyan-900/50 rounded-lg p-2 text-sm text-cyan-200 mt-1 outline-none focus:border-cyan-500 font-mono" /></div>
                  <div><label className="text-[9px] text-slate-400 uppercase font-bold">{t('swordland.center_y', 'Centro Y')}</label><input type="number" value={b.y} onChange={(e) => handleEditBuilding(b.id, 'y', parseFloat(e.target.value))} className="w-full bg-slate-950 border border-cyan-900/50 rounded-lg p-2 text-sm text-cyan-200 mt-1 outline-none focus:border-cyan-500 font-mono" /></div>
                </div>
                <div className="grid grid-cols-4 gap-2 mt-1">
                  <div><label className="text-[9px] text-amber-500 uppercase font-bold">{t('swordland.hb_xmin', 'HB X Min')}</label><input type="number" value={b.hitbox?.xMin ?? b.x - 2} onChange={(e) => handleEditHitbox(b.id, 'xMin', parseFloat(e.target.value))} className="w-full bg-slate-950 border border-amber-900/50 rounded-lg p-1.5 text-xs text-white mt-1 outline-none focus:border-amber-500 font-mono" /></div>
                  <div><label className="text-[9px] text-amber-500 uppercase font-bold">{t('swordland.hb_xmax', 'HB X Max')}</label><input type="number" value={b.hitbox?.xMax ?? b.x + 2} onChange={(e) => handleEditHitbox(b.id, 'xMax', parseFloat(e.target.value))} className="w-full bg-slate-950 border border-amber-900/50 rounded-lg p-1.5 text-xs text-white mt-1 outline-none focus:border-amber-500 font-mono" /></div>
                  <div><label className="text-[9px] text-amber-500 uppercase font-bold">{t('swordland.hb_ymin', 'HB Y Min')}</label><input type="number" value={b.hitbox?.yMin ?? b.y - 2} onChange={(e) => handleEditHitbox(b.id, 'yMin', parseFloat(e.target.value))} className="w-full bg-slate-950 border border-amber-900/50 rounded-lg p-1.5 text-xs text-white mt-1 outline-none focus:border-amber-500 font-mono" /></div>
                  <div><label className="text-[9px] text-amber-500 uppercase font-bold">{t('swordland.hb_ymax', 'HB Y Max')}</label><input type="number" value={b.hitbox?.yMax ?? b.y + 2} onChange={(e) => handleEditHitbox(b.id, 'yMax', parseFloat(e.target.value))} className="w-full bg-slate-950 border border-amber-900/50 rounded-lg p-1.5 text-xs text-white mt-1 outline-none focus:border-amber-500 font-mono" /></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <aside className="w-[260px] bg-slate-900 border-r border-slate-800 flex flex-col z-20 shadow-2xl shrink-0 overflow-hidden select-none">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center shrink-0 bg-slate-950">
          <h2 className="text-lg font-black text-rose-500 uppercase tracking-widest flex items-center gap-2">Swordland</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowInstructions(true)} className="w-8 h-8 flex items-center justify-center bg-cyan-900/30 hover:bg-cyan-700 text-cyan-400 hover:text-white text-sm font-black rounded-full border border-cyan-700/50 transition-colors shadow-sm" title={t('swordland_manual.guide_btn', "Guida all'Uso")}>?</button>
            <button onClick={() => navigate('/')} className="w-8 h-8 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-full border border-slate-700 transition-colors shadow-sm" title={t('map.home', 'Home')}>🏠</button>
          </div>
        </div>
        <div className="p-4 border-b border-slate-800 flex flex-col gap-2 shrink-0 bg-slate-900/50">
          <button onClick={() => openPlayerManager('squads')} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-3 rounded-xl text-xs uppercase tracking-wider transition-colors shadow-[0_0_15px_rgba(79,70,229,0.3)] flex items-center justify-center gap-2">{t('swordland.squad_management', '🛡️ Gestione Squadre')}</button>
          <div className="grid grid-cols-2 gap-2 mt-1">
             <button onClick={() => openPlayerManager('roster')} className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold py-2 rounded-xl text-[10px] uppercase tracking-wider transition-colors shadow-sm flex justify-center items-center gap-1">{t('swordland.players_btn', '👥 Giocatori')}</button>
             {(userRole === 'admin' || userRole === 'consultant') && (
                <button onClick={() => setIsBuildingModalOpen(true)} className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold py-2 rounded-xl text-[10px] uppercase tracking-wider transition-colors shadow-sm flex justify-center items-center gap-1">{t('swordland.buildings_btn', '🏰 Edifici')}</button>
             )}
          </div>
        </div>
        <div className="px-4 py-2 border-b border-slate-800 flex gap-2 shrink-0 bg-slate-950/30">
          <button onClick={() => setTeamBase('blue')} className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors border ${teamBase === 'blue' ? 'bg-cyan-600/20 text-cyan-400 border-cyan-500/50 shadow-[0_0_10px_rgba(34,211,238,0.2)]' : 'bg-slate-800/50 border-slate-700/50 text-slate-500 hover:text-slate-300'}`}>{t('swordland.blue_base', '🟦 Base Blu')}</button>
          <button onClick={() => setTeamBase('red')} className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors border ${teamBase === 'red' ? 'bg-rose-600/20 text-rose-400 border-rose-500/50 shadow-[0_0_10px_rgba(244,63,94,0.2)]' : 'bg-slate-800/50 border-slate-700/50 text-slate-500 hover:text-slate-300'}`}>{t('swordland.red_base', '🟥 Base Rossa')}</button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 bg-slate-950/20">
          <DeploymentPanel activeDeployment={activeDeployment} getAvailableMarches={getAvailableMarches} healingEvents={healingEvents} currentTime={currentTime} getCurrentPosition={getCurrentPosition} draftPositions={draftPositions} handleWithdraw={handleWithdraw} handleHeal={handleHeal} handleCancelHeal={handleCancelHeal} />
        </div>
        <div className="p-3 border-t border-slate-800 shrink-0 flex flex-col gap-2 bg-slate-950">
          <button onClick={() => setIsExportModalOpen(true)} className="w-full bg-indigo-600/90 hover:bg-indigo-500 text-white font-black text-[10px] uppercase tracking-widest py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2">{t('swordland.export_orders_btn', '📤 Esporta Ordini')}</button>
          <button onClick={() => setIsEventManagerOpen(true)} className="w-full bg-emerald-600/90 hover:bg-emerald-500 text-white font-black text-[10px] uppercase tracking-widest py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2">{t('swordland.plans_db_btn', '☁️ Database Piani')}</button>
         {userRole === 'admin' && (
            <button onClick={() => setIsEditorModalOpen(true)} className="w-full mt-1 bg-slate-800 hover:bg-red-900/80 border border-slate-700 hover:border-red-500/50 text-slate-400 hover:text-red-400 font-bold text-[10px] uppercase tracking-wider py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm">
              {t('swordland.master_editor_btn', '⚙️ Editor Master')}
            </button>
          )}
        </div>
      </aside>
      
      <main className="flex-1 p-2 sm:p-4 flex flex-col lg:flex-row gap-3 sm:gap-4 min-w-0 min-h-0 h-full overflow-hidden">
        <div className="flex-1 relative min-w-0 min-h-0 rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl bg-slate-900/50 border border-slate-800/80">
        <InteractiveMap 
            teamBase={teamBase} buildings={buildings} activeDeployment={activeDeployment} marches={marches} 
            onUpdatePosition={(dragData, newX, newY) => { setIsPlaying(false); handleUpdatePosition(dragData, newX, newY); }} 
            currentTime={currentTime} draftPositions={draftPositions} healingEvents={healingEvents} 
            getAvailableMarches={getAvailableMarches} handleHeal={handleHeal} handleCancelHeal={handleCancelHeal} handleGarrisonAction={handleGarrisonAction} 
            isEditorMode={isEditorModalOpen} 
            popupPlayerId={popupPlayerId} setPopupPlayerId={setPopupPlayerId} 
            marchAssignments={marchAssignments} setMarchAssignments={setMarchAssignments} 
            lootDrops={lootDrops} 
            buildingStates={buildingStates} 
         />
        </div>
        
        <div className={`w-full shrink-0 flex flex-col gap-3 xl:gap-4 z-10 transition-all duration-300 ease-in-out ${popupPlayerId ? 'h-full lg:w-[320px] xl:w-[380px]' : 'h-[350px] lg:h-full lg:w-36 xl:w-44'}`}>
          <div className="relative w-full z-[120] shrink-0">
            <button onClick={() => setShowManualPanel(!showManualPanel)} className="w-full shrink-0 bg-slate-800 hover:bg-slate-700 border border-slate-700/50 text-cyan-400 font-black py-3 rounded-2xl xl:rounded-3xl text-[9px] xl:text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg backdrop-blur-xl transition-colors">
              📍 {showManualPanel ? t('interactive_map.close_panel', 'Chiudi') : t('interactive_map.move_marker', 'Sposta')}
            </button>
            {showManualPanel && (
              <div className="absolute top-full mt-2 right-0 bg-slate-800/95 p-4 rounded-xl border border-slate-600 shadow-2xl flex flex-col gap-3 w-56 sm:w-64 backdrop-blur-sm z-[150]">
                <h3 className="text-cyan-400 font-bold text-xs uppercase border-b border-slate-700 pb-1 tracking-wider">{t('interactive_map.manual_coords', 'Coordinate Manuali')}</h3>
                <select className="bg-slate-900 border border-slate-600 text-slate-200 rounded p-2 text-sm focus:border-cyan-500 outline-none w-full" value={manualPlayerId} onChange={(e) => setManualPlayerId(e.target.value)}>
                  <option value="">{t('interactive_map.select_player', 'Seleziona Giocatore')}</option>
                  {activeDeployment?.map(p => ( <option key={p.id} value={p.id}>{p.name || p.tag || `Giocatore ${p.id}`}</option> ))}
                </select>
                <div className="flex gap-2">
                  <input type="number" placeholder="X" className="bg-slate-900 border border-slate-600 text-slate-200 rounded p-2 text-sm w-full focus:border-cyan-500 outline-none" value={manualX} onChange={(e) => setManualX(e.target.value)} />
                  <input type="number" placeholder="Y" className="bg-slate-900 border border-slate-600 text-slate-200 rounded p-2 text-sm w-full focus:border-cyan-500 outline-none" value={manualY} onChange={(e) => setManualY(e.target.value)} />
                </div>
                <button onClick={handleManualPositioning} disabled={!manualPlayerId || manualX === '' || manualY === ''} className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold py-2 rounded">{t('interactive_map.teleport_btn', 'Teletrasporta')}</button>
              </div>
            )}
          </div>
          
          {popupPlayerId ? (
            <div className="flex-1 min-h-0 bg-slate-900/95 backdrop-blur-xl rounded-2xl xl:rounded-3xl border border-slate-700/50 shadow-2xl overflow-y-auto custom-scrollbar relative dispatch-sidebar-wrapper animate-in fade-in zoom-in-95 duration-200">
              <style>{`.dispatch-sidebar-wrapper > div { position: static !important; transform: none !important; width: 100% !important; height: auto !important; min-height: 100% !important; max-height: none !important; border: none !important; box-shadow: none !important; border-radius: 0 !important; margin: 0 !important; background: transparent !important; }`}</style>
           
           <DispatchModal 
            activePlayer={activeDeployment.find(p => String(p.id) === String(popupPlayerId))}
            activeDeployment={activeDeployment}
            marchAssignments={marchAssignments}
            setMarchAssignments={setMarchAssignments}
            setPopupPlayerId={setPopupPlayerId}
            handleConfirmDispatch={handleConfirmDispatch}
            buildings={buildings}
            getAvailableMarches={getAvailableMarches}
            healingEvents={healingEvents}
            currentTime={currentTime}
            draftPositions={draftPositions}
            teamBase={teamBase}
            handleHeal={handleHeal}
            handleCancelHeal={handleCancelHeal}
            lootDrops={lootDrops}
            marches={marches}
            buildingStates={buildingStates}
          />
            </div>
          ) : (
            <>
              <div className="bg-slate-900/40 backdrop-blur-xl rounded-2xl xl:rounded-3xl border border-slate-700/50 p-4 shadow-2xl flex flex-col gap-3 shrink-0 mt-auto animate-in fade-in duration-300">
                <div className="flex justify-between items-center border-b border-slate-700/50 pb-2">
                  <span className="text-[9px] xl:text-[10px] font-black text-cyan-400 uppercase tracking-widest">{t('swordland.team_blue')}</span>
                  <span className="text-xl xl:text-2xl font-black text-white drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]">{Math.floor(teamScores.blue)}</span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-[9px] xl:text-[10px] font-black text-red-400 uppercase tracking-widest">{t('swordland.team_red')}</span>
                  <span className="text-xl xl:text-2xl font-black text-white drop-shadow-[0_0_8px_rgba(248,113,113,0.5)]">{Math.floor(teamScores.red)}</span>
                </div>
              </div>
              <div className="flex-1 min-h-0 bg-slate-900/40 backdrop-blur-xl rounded-2xl xl:rounded-3xl border border-slate-700/50 shadow-2xl overflow-hidden animate-in fade-in duration-300">
                <TimelineControls currentTime={currentTime} hasDrafts={hasDrafts} handleTimeChange={handleTimeChange} movementMode={movementMode} setMovementMode={setMovementMode} isPlaying={isPlaying} togglePlay={togglePlay} playbackSpeed={playbackSpeed} setPlaybackSpeed={setPlaybackSpeed} handleConfirmMinute={handleConfirmMinute} handleCancelMinute={handleCancelMinute} />
              </div>
            </>
          )}
        </div>
      </main>
      
      <ExportModal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} marches={marches} activeDeployment={activeDeployment} roster={roster} />
      
      {showInstructions && (
        <InstructionsModal onClose={() => setShowInstructions(false)} />
      )}
    </div>
  );
}