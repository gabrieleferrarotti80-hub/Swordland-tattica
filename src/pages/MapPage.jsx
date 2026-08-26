import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { mapBuildings } from '../data/mapBuildings';
import { svgToGameCoordinates } from '../utils/marchUtils';

import MapSidebar from '../components/map/MapSidebar';
import MapDetails from '../components/map/MapDetails';
import GlobalView from '../components/map/views/GlobalView';
import TacticalView from '../components/map/views/TacticalView';
import CastleView from '../components/map/views/CastleView';
import AllianceView from '../components/map/views/AllianceView';
import TacticalExportModal from '../components/map/TacticalExportModal';
import EventManagerModal from '../components/map/EventManagerModal';
import MapHelpModal from '../components/map/MapHelpModal';
import AllianceBuilderModal from '../components/map/AllianceBuilderModal'; 

import { useMapData } from '../hooks/useMapData';
import { useMapCamera } from '../hooks/useMapCamera';
import { useMarches } from '../hooks/useMarches';

const INITIAL_BUILDINGS = mapBuildings.map(b => ({
  id: b.id, code: b.type ? b.type.substring(0, 3).toUpperCase() : `B${b.id}`,
  name: b.name + (b.level ? ` Lv.${b.level}` : ''), type: b.type || '',
  x: b.x, y: b.y, minX: b.x - 30, maxX: b.x + 30, minY: b.y - 30, maxY: b.y + 30, occupiedBy: b.occupant || ''
}));

export default function MapPage({ roster, userRole, allianceCode, allianceRole }) {
  const mainRef = useRef(null);
  const location = useLocation();
  const { t } = useTranslation();

 // 💡 Spostato qui dentro per poter tradurre i nomi delle strutture di default!
  const defaultStructures = useMemo(() => [
    { id: 'alliance-hq', code: 'HQ', name: t('map_page.hq_name', 'Quartier Generale'), type: 'headquarters', x: 500, y: 500 },
    { id: 'alliance-bear-1', code: 'TRP1', name: t('map_page.bear_trap_name', 'Trappola per Orsi 1'), type: 'beartrap', x: 520, y: 500 },
    { id: 'alliance-bear-2', code: 'TRP2', name: t('map_page.bear_trap_2_name', 'Trappola per Orsi 2'), type: 'beartrap', x: 480, y: 500 }
  ], [t]);

  const isReadOnly = userRole === 'guest' || (userRole === 'alliance' && allianceRole === 'member');
  const initialView = location.state?.initialView || 'global';
  const eventMode = location.state?.eventMode || null;
  const targetKingdom = location.state?.targetKingdom || null;

  const [activeView, setActiveView] = useState(initialView);
  const [selectedTool, setSelectedTool] = useState('buildings');
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [marchOrigin, setMarchOrigin] = useState(null);
  const [marchDestination, setMarchDestination] = useState(null);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  const [showDemoWelcome, setShowDemoWelcome] = useState(allianceCode === 'DEMO');
  
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isEventManagerOpen, setIsEventManagerOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);

  const [currentPlanId, setCurrentPlanId] = useState(null);
  const [currentPlanName, setCurrentPlanName] = useState('');

  const [popupPlayerId, setPopupPlayerId] = useState(null);
  const [marchAssignments, setMarchAssignments] = useState({});
  const [showLabels, setShowLabels] = useState(false);
  const [currentTime, setCurrentTime] = useState(0); 

  const [exportableOrders, setExportableOrders] = useState([]);
  const [isPlacementMode, setIsPlacementMode] = useState(true);

  const [filters, setFilters] = useState({
    castle: true, santuari: true, fortezze: true, builders: true,
    forager: true, harvest: true, scholar: true, armory: true,
    arsenal: true, drill: true, frontier: true, others: true,
    alliesR5: true, alliesR4: true, alliesOthers: true,
    allianceHQ: true, allianceTraps: true
  });
  
  const areAllFiltersActive = Object.values(filters).every(Boolean);
  const toggleFilter = (key) => setFilters(prev => ({ ...prev, [key]: !prev[key] }));
  const toggleAllFilters = () => {
    const newValue = !areAllFiltersActive;
    setFilters(Object.keys(filters).reduce((acc, key) => { acc[key] = newValue; return acc; }, {}));
  };

  const TILE_SF = 550 / 1200;

  const {
    effectiveRoster, isLoadingCloud, isSavingSim,
    fixedBuildings, setFixedBuildings, handleBuildingChange, handleAddBuilding, handleDeleteBuilding,
    allianceStructures, setAllianceStructures, handleAllianceStructureChange,
    enemyHQs, handleAddHQ, handleRemoveHQ,
    playerOverrides, setPlayerOverrides,
    tacticalMeta, setTacticalMeta,
    hiveGridMeta, setHiveGridMeta,
    allianceMeta, setAllianceMeta,
    loadedMarches, handleSaveMapToCloud, handleSaveSimulation
  } = useMapData({
    roster, allianceCode, userRole, allianceRole, eventMode, targetKingdom,
    isReadOnly, t, INITIAL_BUILDINGS, DEFAULT_STRUCTURES: defaultStructures, DEMO_STRUCTURES: [], DEMO_OVERRIDES: {}, DEMO_ROSTER: []
  });

  const rosterArray = Array.isArray(effectiveRoster) ? effectiveRoster : (effectiveRoster?.players || []);

  const validPlayers = useMemo(() => {
    const participants = tacticalMeta?.participants || [];
    const filteredArr = activeView === 'tactical' ? rosterArray.filter(p => participants.includes(p.id) || eventMode === 'castle_battle') : rosterArray;
    return filteredArr
      .map(p => {
        const override = playerOverrides[p.id];
        return override ? { ...p, x: override.x, y: override.y } : p;
      })
      .filter(p => p.x != null && p.y != null && !isNaN(Number(p.x)) && !isNaN(Number(p.y)))
      .map(p => ({
        ...p, numX: Number(p.x), numY: Number(p.y),
        svgX: 600 + (Number(p.x) - Number(p.y)) * TILE_SF,
        svgY: 1150 - (Number(p.x) + Number(p.y)) * TILE_SF
      }));
  }, [rosterArray, playerOverrides, TILE_SF, tacticalMeta?.participants, activeView, eventMode]);

  const {
    scale, position, isDragging, draggedPlayerId, setDraggedPlayerId,
    handleWheel, handleMouseDown, handleMouseMove, handleMouseUp,
    handleResetView, handleDrop, handleDragOver
  } = useMapCamera({
    mainRef, activeView, selectedBuilding, eventMode, allianceCode,
    fixedBuildings, validPlayers, allianceStructures, TILE_SF, isReadOnly, t,
    handleAllianceStructureChange, setPlayerOverrides
  });

  const [manualCaptures, setManualCaptures] = useState([]);
  const [healingEvents, setHealingEvents] = useState({});
  
  const {
    marches, setMarches, handleDispatchMarch, handleConfirmMinute, getAvailableMarches
  } = useMarches({
    roster: effectiveRoster, activeDeployment: validPlayers, setActiveDeployment: () => {},
    buildings: fixedBuildings, setBuildings: setFixedBuildings,
    teamBase: 'blue', 
    currentTime: currentTime / 60, 
    setManualCaptures, setHealingEvents
  });

  useEffect(() => {
    if (loadedMarches && loadedMarches.length > 0) setMarches(loadedMarches);
  }, [loadedMarches, setMarches]);

  const handleSelectBuilding = useCallback((b) => {
    if (activeView === 'tactical' && isPlacementMode) return;
    setSelectedBuilding(b);
    if (b) setIsRightPanelOpen(true);
  }, [activeView, isPlacementMode]);

  const handleManualCoord = useCallback((type, axis, value) => {
    const numVal = value === '' ? '' : Number(value);
    const pointName = t('map_page.manual_point', 'Punto Manuale');
    if (type === 'origin') {
      setMarchOrigin(prev => prev ? { ...prev, [axis]: numVal, isCustomPoint: true, name: pointName } : { id: 'manual-o', code: 'MAN', name: pointName, [axis]: numVal, isCustomPoint: true });
    } else {
      setMarchDestination(prev => prev ? { ...prev, [axis]: numVal, isCustomPoint: true, name: pointName } : { id: 'manual-d', code: 'MAN', name: pointName, [axis]: numVal, isCustomPoint: true });
    }
  }, [t]);

  const marchResult = useMemo(() => {
    if (!marchOrigin || !marchDestination || marchOrigin.x === '' || marchOrigin.y === '' || marchDestination.x === '' || marchDestination.y === '') return null;
    const dx = marchOrigin.x - marchDestination.x;
    const dy = marchOrigin.y - marchDestination.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const timeMins = (distance * 4) / 60;
    const m = Math.floor(timeMins);
    const s = Math.round((timeMins - m) * 60);
    return { distance: distance.toFixed(1), formattedTime: `${m}m ${s < 10 ? '0' : ''}${s}s` };
  }, [marchOrigin, marchDestination]);

  const handleConfirmTacticalDispatch = useCallback((playerId) => {
    if (isReadOnly) return alert(t('map.read_only_alert'));
    const newExportOrders = [];
    Object.entries(marchAssignments).forEach(([idx, assign]) => {
      if (assign.buildingId) {
        const cleanMembers = (assign.members || []).map(m => typeof m === 'object' ? m.id : m);
        handleDispatchMarch(playerId, assign.buildingId, idx, assign.type, cleanMembers, assign.members);
        newExportOrders.push({
          leaderId: playerId, targetId: assign.buildingId, marchType: assign.type,
          members: assign.members, startMinute: currentTime / 60 
        });
      }
    });

    if (newExportOrders.length > 0) {
      setExportableOrders(prev => [...prev, ...newExportOrders]);
      handleConfirmMinute();
      setMarchAssignments({});
      const m = Math.floor(currentTime / 60);
      const s = currentTime % 60;
      alert(t('map_page.orders_registered_success', `✅ Ordini registrati per il minuto {{m}}' {{s}}"`, { m, s: s.toString().padStart(2, '0') }));
    }
  }, [isReadOnly, marchAssignments, handleDispatchMarch, currentTime, handleConfirmMinute, t]);

  const handleSvgClick = useCallback((e) => {
    if (selectedTool !== 'distance') { 
      setSelectedBuilding(null); 
      setIsRightPanelOpen(false);
      return; 
    }
    const svgElement = e.currentTarget;
    const pt = svgElement.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const svgPoint = pt.matrixTransform(svgElement.getScreenCTM().inverse());
    const coords = svgToGameCoordinates(svgPoint.x, svgPoint.y);
    const freePointTarget = { id: `free-${Date.now()}`, code: 'POS', name: t('map_page.map_coords', 'Coordinate Mappa'), x: coords.x, y: coords.y, isCustomPoint: true };
    if (!marchOrigin) setMarchOrigin(freePointTarget);
    else if (!marchDestination) setMarchDestination(freePointTarget);
    else { setMarchOrigin(freePointTarget); setMarchDestination(null); }
  }, [selectedTool, marchOrigin, marchDestination, t]);

  const commonProps = useMemo(() => ({
    validPlayers, fixedBuildings, allianceStructures, filters, scale, inverseScale: 1 / scale, TILE_SF,
    selectedBuilding, setSelectedBuilding: handleSelectBuilding,
    marchOrigin, setMarchOrigin, marchDestination, setMarchDestination,
    selectedTool, showLabels, activeView, setActiveView, enemyHQs,
    setDraggedPlayerId, setPopupPlayerId, hiveGridMeta, eventMode, tacticalMeta
  }), [validPlayers, fixedBuildings, allianceStructures, filters, scale, TILE_SF, selectedBuilding, handleSelectBuilding, marchOrigin, marchDestination, selectedTool, showLabels, activeView, enemyHQs, setDraggedPlayerId, hiveGridMeta, eventMode, tacticalMeta]);

  const currentEventData = useMemo(() => ({
    tacticalMeta, playerOverrides, hiveGridMeta, exportableOrders,
    fixedBuildings, allianceStructures, marches, allianceMeta
  }), [tacticalMeta, playerOverrides, hiveGridMeta, exportableOrders, fixedBuildings, allianceStructures, marches, allianceMeta]);

  const handleLoadEventData = (data, planId, planName) => {
    if (window.confirm(t('map_page.confirm_load_plan', `⚠️ Vuoi caricare il piano "{{planName}}"? La mappa attuale verrà sovrascritta.`, { planName }))) {
      if (data.tacticalMeta) setTacticalMeta(data.tacticalMeta);
      else setTacticalMeta({ participants: [], draftData: { teams: [], playerMeta: {}, macroGroups: [] } });
      if (data.playerOverrides) setPlayerOverrides(data.playerOverrides);
      else setPlayerOverrides({});
      if (data.hiveGridMeta) setHiveGridMeta(data.hiveGridMeta);
      if (data.exportableOrders) setExportableOrders(data.exportableOrders);
      else setExportableOrders([]);
      if (data.fixedBuildings) setFixedBuildings(data.fixedBuildings);
      if (data.allianceStructures) setAllianceStructures(data.allianceStructures);
      if (data.marches) setMarches(data.marches);
      else setMarches([]);
      if (data.allianceMeta) setAllianceMeta(data.allianceMeta);
      setCurrentPlanId(planId || null); setCurrentPlanName(planName || '');
      setIsEventManagerOpen(false);
    }
  };

  const handleCreateNewPlan = () => {
    if (window.confirm(t('map_page.confirm_reset_map', "⚠️ Vuoi davvero azzerare la mappa? Perderai tutto il lavoro non salvato su squadre, posizioni e ordini."))) {
      setTacticalMeta({ participants: [], draftData: { teams: [], playerMeta: {}, macroGroups: [] } });
      setPlayerOverrides({}); setExportableOrders([]); setMarches([]); setMarchAssignments({});
      setCurrentPlanId(null); setCurrentPlanName(''); setIsEventManagerOpen(false);
    }
  };

  return (
    <div className="h-screen w-screen bg-slate-950 flex text-slate-100 overflow-hidden select-none relative">
      
      {showDemoWelcome && (
        <div className="absolute inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-cyan-500/50 rounded-2xl shadow-2xl max-w-2xl w-full p-6 flex flex-col gap-4 animate-fade-in">
            <h2 className="text-2xl font-black text-cyan-400">{t('map_page.demo_title', 'Benvenuto nella Demo di Kingshot! 👑')}</h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              {t('map_page.demo_desc', 'Sei in modalità Sandbox. Abbiamo caricato alcuni dati fittizi per te: esplora liberamente tutte le funzionalità della mappa senza paura di intaccare i database reali.')}
            </p>
            <button onClick={() => setShowDemoWelcome(false)} className="mt-4 w-full bg-cyan-700 hover:bg-cyan-600 text-white font-black tracking-widest uppercase py-3 rounded-lg transition-colors">
              {t('map_page.demo_start', "Inizia l'esplorazione")}
            </button>
          </div>
        </div>
      )}

      <MapHelpModal isOpen={isHelpModalOpen} onClose={() => setIsHelpModalOpen(false)} activeView={activeView} eventMode={eventMode} />
      
      <AllianceBuilderModal 
        isOpen={isBuilderOpen} 
        onClose={() => setIsBuilderOpen(false)} 
        roster={rosterArray} 
        draftData={tacticalMeta?.draftData} 
        onSaveDraft={(data) => { 
          setTacticalMeta({...tacticalMeta, draftData: data}); 
          alert(t('map_page.draft_saved', "✅ Lavoro memorizzato temporaneamente!\n\nRicordati di cliccare 'SALVA PIANO' per renderlo definitivo su Cloud.")); 
        }} 
      />

      <MapSidebar 
        isReadOnly={isReadOnly} roster={effectiveRoster} selectedTool={selectedTool} setSelectedTool={setSelectedTool}
        filters={filters} toggleFilter={toggleFilter} toggleAllFilters={toggleAllFilters} areAllFiltersActive={areAllFiltersActive}
        showLabels={showLabels} setShowLabels={setShowLabels} marchOrigin={marchOrigin} setMarchOrigin={setMarchOrigin} 
        marchDestination={marchDestination} setMarchDestination={setMarchDestination} marchResult={marchResult} handleManualCoord={handleManualCoord}
        fixedBuildings={fixedBuildings} handleBuildingChange={handleBuildingChange} handleAddBuilding={handleAddBuilding} handleDeleteBuilding={handleDeleteBuilding}
        allianceStructures={allianceStructures} handleAllianceStructureChange={handleAllianceStructureChange}
        handleSaveToCloud={handleSaveMapToCloud} isLoadingCloud={isLoadingCloud} selectedBuilding={selectedBuilding}
        userRole={userRole} activeView={activeView} handleSaveSimulation={handleSaveSimulation} isSavingSim={isSavingSim}
        openExportModal={() => setIsExportModalOpen(true)} openEventManager={() => setIsEventManagerOpen(true)}
        openBuilder={() => { setIsBuilderOpen(true); setIsRightPanelOpen(false); }} 
        onOpenHelp={() => setIsHelpModalOpen(true)} 
        tacticalMeta={tacticalMeta} setTacticalMeta={setTacticalMeta} setSelectedBuilding={handleSelectBuilding}
        playerOverrides={playerOverrides} setPlayerOverrides={setPlayerOverrides} hiveGridMeta={hiveGridMeta} setHiveGridMeta={setHiveGridMeta}
        exportableOrders={exportableOrders} setExportableOrders={setExportableOrders}
      />
      <main 
        ref={mainRef} onDragOver={handleDragOver} onDrop={handleDrop}
        className={`flex-1 bg-slate-950 relative flex flex-col items-center justify-center overflow-hidden transition-all duration-300 ${isDragging || draggedPlayerId ? 'cursor-grabbing' : 'cursor-grab'}`}
        onWheel={activeView === 'tactical' && isPlacementMode ? undefined : handleWheel} 
        onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
      >
        
        {activeView === 'tactical' && !isBuilderOpen && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-full border border-slate-700/50 shadow-2xl flex items-center gap-1">
            <button onClick={() => setIsPlacementMode(true)} className={`px-5 py-2.5 rounded-full text-[10px] font-black tracking-widest uppercase transition-colors shadow-lg ${isPlacementMode ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>{t('map_page.static_mode', '📍 Solo Segnalini (Mappa Statica)')}</button>
            <button onClick={() => setIsPlacementMode(false)} className={`px-5 py-2.5 rounded-full text-[10px] font-black tracking-widest uppercase transition-colors shadow-lg ${!isPlacementMode ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>{t('map_page.dynamic_mode', '🏰 Ordini & Edifici (Mappa Dinamica)')}</button>
          </div>
        )}
        
        {activeView === 'tactical' && (
          <div className="absolute bottom-6 left-6 z-50 bg-slate-900/90 backdrop-blur-md px-4 py-2 rounded-xl border border-slate-700/50 shadow-2xl flex items-center gap-3" onMouseDown={e => e.stopPropagation()}>
            <span className="text-[10px] font-black text-cyan-400 uppercase tracking-wider">⏱️ {t('map_page.time', 'TEMPO')}</span>
            <button onClick={() => setCurrentTime(Math.max(0, currentTime - 10))} className="w-7 h-7 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center text-xs transition-colors border border-slate-700">-</button>
            <input type="range" min="0" max="14400" step="10" value={currentTime} onChange={(e) => setCurrentTime(Number(e.target.value))} className="w-48 accent-cyan-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none"/>
            <button onClick={() => setCurrentTime(Math.min(14400, currentTime + 10))} className="w-7 h-7 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center text-xs transition-colors border border-slate-700">+</button>
            <span className="bg-slate-950 px-2.5 py-1 rounded border border-slate-800 text-white font-mono font-bold text-xs min-w-[70px] text-center">{Math.floor(currentTime / 60)}' {(currentTime % 60).toString().padStart(2, '0')}"</span>
          </div>
        )}
        <div className="absolute bottom-6 right-6 z-30 flex flex-col gap-2 bg-slate-900/90 p-2 rounded-xl border border-slate-800 shadow-2xl backdrop-blur-md">
          <button onClick={() => handleWheel({ preventDefault: ()=>{}, deltaY: -100, currentTarget: mainRef.current, clientX: window.innerWidth/2, clientY: window.innerHeight/2 })} className="w-10 h-10 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg flex items-center justify-center text-lg cursor-pointer">+</button>
          <button onClick={() => handleWheel({ preventDefault: ()=>{}, deltaY: 100, currentTarget: mainRef.current, clientX: window.innerWidth/2, clientY: window.innerHeight/2 })} className="w-10 h-10 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg flex items-center justify-center text-lg cursor-pointer">-</button>
          <button onClick={handleResetView} className="w-10 h-10 bg-slate-800 hover:bg-slate-700 text-cyan-400 font-bold rounded-lg flex items-center justify-center text-xs cursor-pointer">1:1</button>
        </div>
        <div className={`absolute top-0 left-0 w-[1200px] h-[1200px] ${!isDragging && !draggedPlayerId ? 'transition-all duration-700 ease-in-out' : ''}`} style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`, transformOrigin: '0 0' }}>
          <div className="relative w-full h-full bg-slate-900/30 rounded-3xl border border-slate-800/80 shadow-2xl overflow-hidden backdrop-blur-sm">
            <svg id="map-svg" viewBox="0 0 1200 1200" className="w-full h-full drop-shadow-[0_0_25px_rgba(0,0,0,0.9)]" onClick={handleSvgClick}>
              <defs>
                <pattern id="mapGrid" width="100" height="100" patternUnits="userSpaceOnUse"><path d="M 100 0 L 0 0 0 100" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1"/></pattern>
                <pattern id="subGrid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(34, 211, 238, 0.08)" strokeWidth="0.5"/></pattern>
              </defs>
              <rect width="1200" height="1200" fill="url(#subGrid)" />
              <rect width="1200" height="1200" fill="url(#mapGrid)" />
              <polygon points="600,50 1150,600 600,1150 50,600" fill="rgba(15, 23, 42, 0.85)" stroke="rgba(34, 211, 238, 0.6)" strokeWidth="3" />
              <g transform={`translate(600, 1150)`}>
                <circle cx="0" cy="0" r={4 * TILE_SF} fill="#22d3ee" opacity="0.3" className="animate-pulse" />
                <g transform={`scale(${1/scale})`}><text x="15" y="5" fill="#22d3ee" fontSize="18" fontWeight="bold">{t('map.origin')} (0:0)</text></g>
              </g>
              {activeView === 'global' && <GlobalView {...commonProps} />}
              {activeView === 'tactical' && eventMode !== 'castle_battle' && <TacticalView {...commonProps} />}
              {activeView === 'tactical' && eventMode === 'castle_battle' && <CastleView {...commonProps} />}
              {activeView === 'alliance' && <AllianceView {...commonProps} />}
            </svg>
          </div>
        </div>
      </main>
      <MapDetails 
        isReadOnly={isReadOnly} selectedBuilding={selectedBuilding} onClose={() => setIsRightPanelOpen(false)}
        enemyHQs={enemyHQs} onAddHQ={handleAddHQ} onRemoveHQ={handleRemoveHQ} allianceMeta={allianceMeta} setAllianceMeta={setAllianceMeta}
        activeView={activeView} isOpen={isRightPanelOpen} setIsOpen={setIsRightPanelOpen} currentTime={currentTime} 
        marchAssignments={marchAssignments} setMarchAssignments={setMarchAssignments} handleConfirmDispatch={handleConfirmTacticalDispatch} 
        buildings={fixedBuildings} getAvailableMarches={getAvailableMarches} activeDeployment={validPlayers}
        roster={effectiveRoster} allianceStructures={allianceStructures} tacticalMeta={tacticalMeta} eventMode={eventMode} playerOverrides={playerOverrides}
      />
      <TacticalExportModal 
        isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} playerOverrides={playerOverrides} roster={effectiveRoster} targetBuilding={selectedBuilding}
        exportableOrders={exportableOrders} activeDeployment={validPlayers} buildings={fixedBuildings} tacticalMeta={tacticalMeta}
      />
      <EventManagerModal 
        isOpen={isEventManagerOpen} onClose={() => setIsEventManagerOpen(false)} currentData={currentEventData} onLoadData={handleLoadEventData} onCreateNewPlan={handleCreateNewPlan}
        allianceCode={allianceCode} currentPlanId={currentPlanId} currentPlanName={currentPlanName} onPlanSaved={(id, name) => { setCurrentPlanId(id); setCurrentPlanName(name); }}
      />
    </div>
  );
}