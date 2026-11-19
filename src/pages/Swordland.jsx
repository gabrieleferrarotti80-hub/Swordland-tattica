import { db } from '../firebase';
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { initialBuildings } from '../data/buildings';
import { useEditorDrag } from '../hooks/useEditorDrag';

import { BuildingTable } from '../components/BuildingTable';
import { InteractiveMap } from '../components/InteractiveMap';
import { TimelineControls } from '../components/TimelineControls';
import { DeploymentPanel } from '../components/DeploymentPanel';
import { ExportModal } from '../components/ExportModal';
import { DispatchModal } from '../components/DispatchModal'; 
import EventManagerModal from '../components/map/EventManagerModal'; 
import { InstructionsModal } from '../components/InstructionsModal';
import { calculateDynamicScores } from '../utils/scoreEngine';
import { useMarches } from '../hooks/useMarches';
import QuickPlannerModal from '../components/map/QuickPlannerModal';
import { PlayerManagerModal } from '../components/PlayerManagerModal';
import QuickPlannerAdminModal from '../components/map/QuickPlannerAdminModal'; 

export default function Swordland({ roster, setRoster, allianceCode, userRole }) {
  const navigate = useNavigate();
  const { t } = useTranslation(); 
  
  const [isQuickPlannerAdminOpen, setIsQuickPlannerAdminOpen] = useState(false);
  const [isQuickPlannerOpen, setIsQuickPlannerOpen] = useState(false);
  const [isBuildingModalOpen, setIsBuildingModalOpen] = useState(false);
  const [isEditorModalOpen, setIsEditorModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isEventManagerOpen, setIsEventManagerOpen] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(false);
  
  const [planningMode, setPlanningMode] = useState('auto'); 
  
  const [isPlayerManagerOpen, setIsPlayerManagerOpen] = useState(false);
  const [playerManagerTab, setPlayerManagerTab] = useState('roster'); 

  // --- STATO CONDIVISO: DOTTRINA SELEZIONATA ---
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  const [showManualPanel, setShowManualPanel] = useState(false);
  const [manualPlayerId, setManualPlayerId] = useState('');
  const [manualX, setManualX] = useState('');
  const [manualY, setManualY] = useState('');
  const [plannerPreview, setPlannerPreview] = useState(null);

  const [popupPlayerId, setPopupPlayerId] = useState(null);
  const [marchAssignments, setMarchAssignments] = useState({});

  const [currentPlanId, setCurrentPlanId] = useState(null);
  const [currentPlanName, setCurrentPlanName] = useState('');
  const [isSavingQuick, setIsSavingQuick] = useState(false);

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

  const { editorPos, isDraggingEditor, handleEditorMouseDown } = useEditorDrag(isEditorModalOpen);

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
      return savedBuilding ? { 
        ...savedBuilding, 
        scale: initialBuilding.scale, 
        icon: initialBuilding.icon, 
        hitbox: savedBuilding.hitbox, 
        magnet: savedBuilding.magnet, 
        x: savedBuilding.x, 
        y: savedBuilding.y 
      } : initialBuilding;
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
  
  const handleEditMagnet = (id, bound, value) => {
    setBuildings(prev => prev.map(b => {
      if (b.id === id) {
        const currentMagnet = b.magnet || { xMin: b.x - 5, xMax: b.x + 5, yMin: b.y - 5, yMax: b.y + 5 };
        return { ...b, magnet: { ...currentMagnet, [bound]: value } };
      }
      return b;
    }));
  };
  
  const handleDeploy = () => {
    const playersToDeploy = roster.filter(p => p.isParticipating).map(p => ({ ...p, role: p.role || '', positions: p.positions || {} }));
    setActiveDeployment(playersToDeploy);
    setIsPlayerManagerOpen(false); 
  };

  const openPlayerManager = (tab) => {
    setPlayerManagerTab(tab);
    setIsPlayerManagerOpen(true);
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
    version: '1.5', teamBase, buildings, activeDeployment, marches, healingEvents, manualCaptures, roster
  }), [teamBase, buildings, activeDeployment, marches, healingEvents, manualCaptures, roster]);

  const handleLoadData = (data, planId, planName) => {
    if (window.confirm(t('swordland.confirm_load_plan', `⚠️ Vuoi caricare il piano "{{planName}}"? I dati non salvati andranno persi.`, { planName }))) {
      if (data.teamBase) setTeamBase(data.teamBase);
      if (data.buildings) setBuildings(data.buildings);
      
      if (data.activeDeployment) {
        const syncedDeployment = data.activeDeployment.map(deployedPlayer => {
          const globalMatch = roster.find(r => 
            r.id === deployedPlayer.id || 
            (r.name && deployedPlayer.name && r.name.toLowerCase() === deployedPlayer.name.toLowerCase())
          );
          if (globalMatch) return { ...deployedPlayer, tag: globalMatch.tag || deployedPlayer.tag, name: globalMatch.name || deployedPlayer.name, power: globalMatch.power !== undefined ? globalMatch.power : deployedPlayer.power, role: globalMatch.role || globalMatch.role };
          return deployedPlayer;
        });
        setActiveDeployment(syncedDeployment);
      }
      if (data.marches) setMarches(data.marches);
      if (data.healingEvents) setHealingEvents(data.healingEvents);
      if (data.manualCaptures) setManualCaptures(data.manualCaptures);
      if (data.roster) setRoster(data.roster);
      
      setCurrentTime(0); setDraftPositions({}); setIsPlaying(false); setCurrentPlanId(planId); setCurrentPlanName(planName); setIsEventManagerOpen(false);
    }
  };

  const handleCreateNewPlan = () => {
    if (window.confirm(t('swordland.confirm_reset_board', "⚠️ Vuoi azzerare la lavagna tattica? I dati della mappa master verranno mantenuti."))) {
      setTeamBase('blue'); setActiveDeployment([]); setMarches([]); setManualCaptures([]); setHealingEvents({}); 
      setCurrentTime(0); setDraftPositions({}); setIsPlaying(false); setCurrentPlanId(null); setCurrentPlanName(''); 
      setIsEventManagerOpen(false); setRoster(roster.map(p => ({ ...p, squad: '' })));
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
            <button onClick={() => setShowDemoWelcome(false)} className="mt-4 w-full bg-amber-700 hover:bg-amber-600 text-white font-black tracking-widest uppercase py-3 rounded-lg transition-colors">Inizia la Simulazione</button>
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

      <PlayerManagerModal 
        isOpen={isPlayerManagerOpen} 
        onClose={() => setIsPlayerManagerOpen(false)} 
        activeTab={playerManagerTab} 
        setActiveTab={setPlayerManagerTab} 
        roster={roster} 
        setRoster={setRoster} 
        activeDeployment={activeDeployment} 
        setActiveDeployment={setActiveDeployment} 
        userRole={userRole} 
        onDeploy={handleDeploy} 
        selectedTemplateId={selectedTemplateId} 
        setSelectedTemplateId={setSelectedTemplateId}
        planningMode={planningMode}
      />

      <aside className="w-[260px] bg-slate-900 border-r border-slate-800 flex flex-col z-20 shadow-2xl shrink-0 overflow-hidden select-none">
        
        <div className="p-4 border-b border-slate-800 flex justify-between items-center shrink-0 bg-slate-950">
          <h2 className="text-lg font-black text-rose-500 uppercase tracking-widest flex items-center gap-2">Swordland</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowInstructions(true)} className="w-8 h-8 flex items-center justify-center bg-cyan-900/30 hover:bg-cyan-700 text-cyan-400 hover:text-white text-sm font-black rounded-full border border-cyan-700/50 transition-colors shadow-sm" title="Guida all'Uso">?</button>
            <button onClick={() => navigate('/')} className="w-8 h-8 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-full border border-slate-700 transition-colors shadow-sm" title="Home">🏠</button>
          </div>
        </div>
        
        <div className="px-4 py-3 border-b border-slate-800 flex gap-2 shrink-0 bg-slate-950/50">
          <button onClick={() => setTeamBase('blue')} className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors border ${teamBase === 'blue' ? 'bg-cyan-600/20 text-cyan-400 border-cyan-500/50 shadow-[0_0_10px_rgba(34,211,238,0.2)]' : 'bg-slate-800/50 border-slate-700/50 text-slate-500 hover:text-slate-300'}`}>🟦 Base Blu</button>
          <button onClick={() => setTeamBase('red')} className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors border ${teamBase === 'red' ? 'bg-rose-600/20 text-rose-400 border-rose-500/50 shadow-[0_0_10px_rgba(244,63,94,0.2)]' : 'bg-slate-800/50 border-slate-700/50 text-slate-500 hover:text-slate-300'}`}>🟥 Base Rossa</button>
        </div>

        <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/80 flex flex-col gap-2 shrink-0">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">Modalità Operativa</span>
          <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-700/50 shadow-inner">
            <button onClick={() => setPlanningMode('manual')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${planningMode === 'manual' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}>🧠 Manuale</button>
            <button onClick={() => setPlanningMode('auto')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${planningMode === 'auto' ? 'bg-amber-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}>⚡ Dottrine</button>
          </div>
        </div>

        <div className="p-4 border-b border-slate-800 shrink-0 flex flex-col gap-4 bg-slate-900/40">
          {planningMode === 'auto' ? (
            <>
              <div className="flex flex-col gap-2">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest pl-1">1. Le Forze</span>
                <button onClick={() => openPlayerManager('roster')} className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase tracking-wider py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 border border-slate-700">👥 Database Roster</button>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest pl-1">2. Motore Tattico</span>
                <button onClick={() => setIsQuickPlannerOpen(true)} className="w-full bg-amber-900/40 hover:bg-amber-600 border border-amber-700/50 text-amber-300 hover:text-white font-black text-xs uppercase tracking-wider py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm">⚡ Apri Quick Planner</button>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest pl-1">3. Azione</span>
                <button onClick={() => setIsExportModalOpen(true)} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg">📤 Esporta Ordini</button>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest pl-1">1. Le Forze</span>
                <button onClick={() => openPlayerManager('roster')} className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[10px] uppercase tracking-wider py-2 rounded-xl transition-colors flex items-center justify-center gap-2 border border-slate-700">👥 Database Roster</button>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest pl-1">2. Organizzazione</span>
                <button onClick={() => openPlayerManager('squads')} className="w-full bg-indigo-900/40 hover:bg-indigo-600 border border-indigo-700/50 text-indigo-300 hover:text-white font-black text-[10px] uppercase tracking-wider py-2 rounded-xl transition-colors flex items-center justify-center gap-2">🛡️ Team Builder (Manuale)</button>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest pl-1">3. Salvataggio & Azione</span>
                <div className="grid grid-cols-2 gap-2">
                   <button onClick={() => setIsEventManagerOpen(true)} className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold text-[9px] uppercase tracking-wider py-2 rounded-xl transition-colors">💾 Salva Piano</button>
                   <button onClick={handleCreateNewPlan} className="w-full bg-rose-900/40 hover:bg-rose-700 border border-rose-800/50 text-rose-300 hover:text-white font-bold text-[9px] uppercase tracking-wider py-2 rounded-xl transition-colors">🆕 Reset</button>
                </div>
                <button onClick={() => setIsExportModalOpen(true)} className="w-full mt-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase tracking-wider py-2 rounded-xl transition-colors shadow-md">📤 Esporta Ordini</button>
              </div>
            </>
          )}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 bg-slate-950/20">
          <DeploymentPanel activeDeployment={activeDeployment} getAvailableMarches={getAvailableMarches} healingEvents={healingEvents} currentTime={currentTime} getCurrentPosition={getCurrentPosition} draftPositions={draftPositions} handleWithdraw={handleWithdraw} handleHeal={handleHeal} handleCancelHeal={handleGarrisonAction} />
        </div>

        {(userRole === 'admin' || userRole === 'consultant' || userRole === 'consulente') && (
          <div className="p-4 border-t border-slate-800 shrink-0 bg-slate-950">
            <button onClick={() => setIsAdminMenuOpen(!isAdminMenuOpen)} className="flex justify-between items-center w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-400 hover:text-fuchsia-400 transition-colors text-[10px] font-black uppercase tracking-wider">
              <span className="flex items-center gap-2">🛠️ Strumenti Admin</span>
              <span className="text-[8px]">{isAdminMenuOpen ? '▲' : '▼'}</span>
            </button>
            {isAdminMenuOpen && (
              <div className="flex flex-col gap-1.5 pl-2 mt-2 border-l-2 border-slate-800 ml-1 animate-in slide-in-from-bottom-2 duration-200">
                <button onClick={() => setIsQuickPlannerAdminOpen(true)} className="w-full text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-fuchsia-300 hover:bg-slate-800 rounded-lg transition-colors">📜 Editor Dottrine</button>
                {planningMode === 'auto' && (
                  <button onClick={() => setIsEventManagerOpen(true)} className="w-full text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-fuchsia-300 hover:bg-slate-800 rounded-lg transition-colors">☁️ Database Piani (Manuali)</button>
                )}
                <button onClick={() => setIsBuildingModalOpen(true)} className="w-full text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors">🏰 Gestione Edifici</button>
                {userRole === 'admin' && (
                  <button onClick={() => setIsEditorModalOpen(true)} className="w-full text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors">⚙️ Editor Master (Mappa)</button>
                )}
              </div>
            )}
          </div>
        )}
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
            plannerPreview={plannerPreview} 
         />
        </div>
        
        <div className={`w-full shrink-0 flex flex-col gap-3 xl:gap-4 z-10 transition-all duration-300 ease-in-out ${popupPlayerId ? 'h-full lg:w-[320px] xl:w-[380px]' : 'h-[350px] lg:h-full lg:w-36 xl:w-44'}`}>
          <div className="relative w-full z-[120] shrink-0 flex flex-col gap-2">
            <button onClick={() => setShowManualPanel(!showManualPanel)} className="w-full shrink-0 bg-slate-800 hover:bg-slate-700 border border-slate-700/50 text-cyan-400 font-black py-3 rounded-2xl xl:rounded-3xl text-[9px] xl:text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg backdrop-blur-xl transition-colors">📍 {showManualPanel ? 'Chiudi' : 'Sposta'}</button>
            <button onClick={() => handleCancelMinute(currentTime)} className="w-full bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60 text-rose-300 font-black py-2.5 px-2 rounded-2xl xl:rounded-3xl text-[9px] xl:text-[10px] uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-1">🗑️ Reset Min {currentTime}</button>

            {showManualPanel && (
              <div className="absolute top-full mt-2 right-0 bg-slate-800/95 p-4 rounded-xl border border-slate-600 shadow-2xl flex flex-col gap-3 w-56 sm:w-64 backdrop-blur-sm z-[150]">
                <h3 className="text-cyan-400 font-bold text-xs uppercase border-b border-slate-700 pb-1 tracking-wider">Coordinate Manuali</h3>
                <select className="bg-slate-900 border border-slate-600 text-slate-200 rounded p-2 text-sm focus:border-cyan-500 outline-none w-full" value={manualPlayerId} onChange={(e) => setManualPlayerId(e.target.value)}>
                  <option value="">Seleziona Giocatore</option>
                  {activeDeployment?.map(p => ( <option key={p.id} value={p.id}>{p.name || p.tag || `Giocatore ${p.id}`}</option> ))}
                </select>
                <div className="flex gap-2">
                  <input type="number" placeholder="X" className="bg-slate-900 border border-slate-600 text-slate-200 rounded p-2 text-sm w-full focus:border-cyan-500 outline-none" value={manualX} onChange={(e) => setManualX(e.target.value)} />
                  <input type="number" placeholder="Y" className="bg-slate-900 border border-slate-600 text-slate-200 rounded p-2 text-sm w-full focus:border-cyan-500 outline-none" value={manualY} onChange={(e) => setManualY(e.target.value)} />
                </div>
                <button onClick={handleManualPositioning} disabled={!manualPlayerId || manualX === '' || manualY === ''} className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold py-2 rounded">Teletrasporta</button>
              </div>
            )}
          </div>
          
          {popupPlayerId ? (
            <div className="flex-1 min-h-0 bg-slate-900/95 backdrop-blur-xl rounded-2xl xl:rounded-3xl border border-slate-700/50 shadow-2xl overflow-y-auto custom-scrollbar relative dispatch-sidebar-wrapper animate-in fade-in zoom-in-95 duration-200">
              <style>{`.dispatch-sidebar-wrapper > div { position: static !important; transform: none !important; width: 100% !important; height: auto !important; min-height: 100% !important; max-height: none !important; border: none !important; box-shadow: none !important; border-radius: 0 !important; margin: 0 !important; background: transparent !important; }`}</style>
           <DispatchModal 
            activePlayer={activeDeployment.find(p => String(p.id) === String(popupPlayerId))} activeDeployment={activeDeployment} marchAssignments={marchAssignments} setMarchAssignments={setMarchAssignments} setPopupPlayerId={setPopupPlayerId} handleConfirmDispatch={handleConfirmDispatch} buildings={buildings} getAvailableMarches={getAvailableMarches} healingEvents={healingEvents} currentTime={currentTime} draftPositions={draftPositions} teamBase={teamBase} handleHeal={handleHeal} handleCancelHeal={handleCancelHeal} lootDrops={lootDrops} marches={marches} buildingStates={buildingStates}
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

       <QuickPlannerModal 
        isOpen={isQuickPlannerOpen} 
        onClose={() => setIsQuickPlannerOpen(false)} 
        roster={roster} setRoster={setRoster} activeDeployment={activeDeployment} setActiveDeployment={setActiveDeployment} buildings={buildings} teamBase={teamBase}
        selectedTemplateId={selectedTemplateId} 
        setSelectedTemplateId={setSelectedTemplateId}
        onOpenManualBuilder={() => {
            setIsQuickPlannerOpen(false);
            openPlayerManager('squads');
        }}
        onGeneratePlan={(newDeployment, newEnemyCaptures, newMarches) => {
          setActiveDeployment(newDeployment);
          if (newEnemyCaptures) setManualCaptures(newEnemyCaptures);
          if (newMarches) setMarches(newMarches); 
          setIsQuickPlannerOpen(false); setCurrentTime(0); setDraftPositions({}); 
          alert('✅ Piano Tattico Generato! Le marce sono pronte e visibili in Esporta Ordini.');
        }}
      />
    <QuickPlannerAdminModal 
        isOpen={isQuickPlannerAdminOpen}  
        onClose={() => setIsQuickPlannerAdminOpen(false)} 
        buildings={buildings}
        onPreviewUpdate={(data) => setPlannerPreview(data)} 
      />
      <ExportModal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} marches={marches} activeDeployment={activeDeployment} roster={roster} />
      {showInstructions && <InstructionsModal onClose={() => setShowInstructions(false)} />}
      
      {isEditorModalOpen && (
        <div style={{ left: `${editorPos.x}px`, top: `${editorPos.y}px` }} className={`fixed z-[300] flex flex-col w-[450px] max-w-[95vw] max-h-[90vh] bg-slate-900/95 backdrop-blur-xl border border-slate-700 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] ${isDraggingEditor ? 'cursor-grabbing' : ''}`}>
         <div onMouseDown={handleEditorMouseDown} className="flex justify-between items-center p-5 border-b border-slate-800 shrink-0 bg-slate-950 cursor-grab active:cursor-grabbing select-none">
            <h2 className="text-lg font-black text-red-400 uppercase tracking-widest pointer-events-none">⚙️ Master Editor</h2>
            <div className="flex items-center gap-2">
              <button onClick={handleFactoryReset} className="bg-red-900/60 hover:bg-red-700 border border-red-700/50 text-red-200 text-[10px] font-black uppercase px-3 py-2 rounded-xl transition-colors shadow-md">🔄 Reset</button>
              <button onClick={handleSaveMasterToCloud} className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase px-3 py-2 rounded-xl transition-colors shadow-lg">☁️ Salva</button>
              <button onClick={() => setIsEditorModalOpen(false)} className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:bg-rose-900 hover:text-rose-400 transition-colors font-bold shrink-0">✕</button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar flex flex-col gap-4 pointer-events-auto">
            <div className="bg-amber-900/20 border border-amber-700/50 p-3 rounded-xl text-amber-200 text-xs text-center font-bold">Le modifiche si applicano in tempo reale. Quando sei soddisfatto, clicca Salva Cloud.</div>
           {buildings.map(b => (
              <div key={b.id} className="bg-slate-800/40 p-4 rounded-2xl border border-slate-700 shadow-inner flex flex-col gap-3">
                <h3 className="text-cyan-400 font-black uppercase tracking-wider text-sm border-b border-slate-700/50 pb-2 flex items-center gap-2"><span className="text-lg opacity-80">🏰</span> {b.name}</h3>
                
                <div className="grid grid-cols-3 gap-3">
                  <div><label className="text-[9px] text-slate-400 uppercase font-bold">Scala Visiva</label><input type="number" step="0.1" value={b.scale || 1} onChange={(e) => handleEditBuilding(b.id, 'scale', parseFloat(e.target.value))} className="w-full bg-slate-950 border border-slate-600 rounded-lg p-2 text-sm text-white mt-1 outline-none focus:border-cyan-500 font-mono" /></div>
                  <div><label className="text-[9px] text-slate-400 uppercase font-bold">Centro X</label><input type="number" value={b.x} onChange={(e) => handleEditBuilding(b.id, 'x', parseFloat(e.target.value))} className="w-full bg-slate-950 border border-cyan-900/50 rounded-lg p-2 text-sm text-cyan-200 mt-1 outline-none focus:border-cyan-500 font-mono" /></div>
                  <div><label className="text-[9px] text-slate-400 uppercase font-bold">Centro Y</label><input type="number" value={b.y} onChange={(e) => handleEditBuilding(b.id, 'y', parseFloat(e.target.value))} className="w-full bg-slate-950 border border-cyan-900/50 rounded-lg p-2 text-sm text-cyan-200 mt-1 outline-none focus:border-cyan-500 font-mono" /></div>
                </div>

                <div className="grid grid-cols-4 gap-2 mt-1">
                  <div><label className="text-[9px] text-cyan-500 uppercase font-bold">Mag X Min</label><input type="number" value={b.magnet?.xMin ?? b.x - 5} onChange={(e) => handleEditMagnet(b.id, 'xMin', parseFloat(e.target.value))} className="w-full bg-slate-950 border border-cyan-900/50 rounded-lg p-1.5 text-xs text-white mt-1 outline-none focus:border-cyan-500 font-mono" /></div>
                  <div><label className="text-[9px] text-cyan-500 uppercase font-bold">Mag X Max</label><input type="number" value={b.magnet?.xMax ?? b.x + 5} onChange={(e) => handleEditMagnet(b.id, 'xMax', parseFloat(e.target.value))} className="w-full bg-slate-950 border border-cyan-900/50 rounded-lg p-1.5 text-xs text-white mt-1 outline-none focus:border-cyan-500 font-mono" /></div>
                  <div><label className="text-[9px] text-cyan-500 uppercase font-bold">Mag Y Min</label><input type="number" value={b.magnet?.yMin ?? b.y - 5} onChange={(e) => handleEditMagnet(b.id, 'yMin', parseFloat(e.target.value))} className="w-full bg-slate-950 border border-cyan-900/50 rounded-lg p-1.5 text-xs text-white mt-1 outline-none focus:border-cyan-500 font-mono" /></div>
                  <div><label className="text-[9px] text-cyan-500 uppercase font-bold">Mag Y Max</label><input type="number" value={b.magnet?.yMax ?? b.y + 5} onChange={(e) => handleEditMagnet(b.id, 'yMax', parseFloat(e.target.value))} className="w-full bg-slate-950 border border-cyan-900/50 rounded-lg p-1.5 text-xs text-white mt-1 outline-none focus:border-cyan-500 font-mono" /></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}