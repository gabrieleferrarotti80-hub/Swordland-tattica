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
import CastleTestView from '../components/map/views/CastleTestView';
import TacticalExportModal from '../components/map/TacticalExportModal';
import EventManagerModal from '../components/map/EventManagerModal';
import MapHelpModal from '../components/map/MapHelpModal';
import AllianceBuilderModal from '../components/map/AllianceBuilderModal'; 
import MapSidebarGlobalEditor from '../components/map/sidebars/MapSidebarGlobalEditor';
import MapSidebarExpansion from '../components/map/sidebars/MapSidebarExpansion';
import ExpansionView from '../components/map/views/ExpansionView';

import MapSidebarAlliance from '../components/map/sidebars/MapSidebarAlliance';
import MapSidebarTactical from '../components/map/sidebars/MapSidebarTactical';
import { AlliancePathfindingSidebar } from '../components/map/AlliancePathfindingSidebar';
import { PathfindingView } from '../components/map/views/PathfindingView';

import { useMapData } from '../hooks/useMapData';
import { useMapCamera } from '../hooks/useMapCamera';
import { useMarches } from '../hooks/useMarches';

const INITIAL_BUILDINGS = mapBuildings.map(b => ({
  id: b.id, code: b.type ? b.type.substring(0, 3).toUpperCase() : `B${b.id}`,
  name: b.name + (b.level ? ` Lv.${b.level}` : ''), type: b.type || '',
  x: b.x, y: b.y, minX: b.x - 30, maxX: b.x + 30, minY: b.y - 30, maxY: b.y + 30, occupiedBy: b.occupant || '',
  buffs: "", rewards: "", level: b.level || 1
}));

const DEMO_STRUCTURES = [];
const DEMO_OVERRIDES = {};
const DEMO_ROSTER = [];
const EMPTY_ARRAY = [];

export default function MapPage({ roster, setRoster, userRole, allianceCode, allianceRole }) {
  const mainRef = useRef(null);
  const location = useLocation();
  const { t } = useTranslation();

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
  const [isMapUnlocked, setIsMapUnlocked] = useState(false);

  const [marchAssignments, setMarchAssignments] = useState({});
  const [showLabels, setShowLabels] = useState(false);
  const [currentTime, setCurrentTime] = useState(0); 

  const [exportableOrders, setExportableOrders] = useState([]);
  const [isPlacementMode, setIsPlacementMode] = useState(true);

  const [isGlobalEditorMode, setIsGlobalEditorMode] = useState(false);
  const [globalEditorTool, setGlobalEditorTool] = useState('resources');
  const [activeZoneId, setActiveZoneId] = useState(null); 

  const [isPathfindingMode, setIsPathfindingMode] = useState(false);
  const [pathfindingData, setPathfindingData] = useState(null);

  const [filters, setFilters] = useState({
    castle: true, santuari: true, fortezze: true, builders: true,
    forager: true, harvest: true, scholar: true, armory: true,
    arsenal: true, drill: true, frontier: true, others: true,
    alliesR5: true, alliesR4: true, alliesOthers: true,
    allianceHQ: true, allianceTraps: true
  });
  
  const areAllFiltersActive = Object.values(filters).every(Boolean);
  const toggleFilter = useCallback((key) => setFilters(prev => ({ ...prev, [key]: !prev[key] })), []);
  const toggleAllFilters = useCallback(() => {
    setFilters(prev => {
      const newValue = !Object.values(prev).every(Boolean);
      return Object.keys(prev).reduce((acc, key) => { acc[key] = newValue; return acc; }, {});
    });
  }, []);

  const TILE_SF = 550 / 1200;

  const {
    effectiveRoster, isLoadingCloud, isSavingSim,
    globalResourceZones, setGlobalResourceZones,
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
    isReadOnly, t, INITIAL_BUILDINGS, DEFAULT_STRUCTURES: defaultStructures, 
    DEMO_STRUCTURES, DEMO_OVERRIDES, DEMO_ROSTER 
  });

  const rosterArray = useMemo(() => Array.isArray(effectiveRoster) ? effectiveRoster : (effectiveRoster?.players || EMPTY_ARRAY), [effectiveRoster]);

  const validPlayers = useMemo(() => {
    const participants = tacticalMeta?.participants || EMPTY_ARRAY;
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
    teamBase: 'blue', currentTime: currentTime / 60, setManualCaptures, setHealingEvents
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
    const svgElement = e.currentTarget;
    const pt = svgElement.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const svgPoint = pt.matrixTransform(svgElement.getScreenCTM().inverse());
    const coords = svgToGameCoordinates(svgPoint.x, svgPoint.y);

    if (activeView === 'alliance' && hiveGridMeta?.isDrawing) {
      setHiveGridMeta(prev => ({
        ...prev,
        territory: [...(prev?.territory || []), { x: coords.x, y: coords.y }]
      }));
      return; 
    }

    if (selectedTool !== 'distance') { 
      setSelectedBuilding(null); 
      setIsRightPanelOpen(false);
      return; 
    }
    
    const freePointTarget = { id: `free-${Date.now()}`, code: 'POS', name: t('map_page.map_coords', 'Coordinate Mappa'), x: coords.x, y: coords.y, isCustomPoint: true };
    if (!marchOrigin) setMarchOrigin(freePointTarget);
    else if (!marchDestination) setMarchDestination(freePointTarget);
    else { setMarchOrigin(freePointTarget); setMarchDestination(null); }
  }, [selectedTool, marchOrigin, marchDestination, t, activeView, hiveGridMeta?.isDrawing, setHiveGridMeta]);

  const patternSize = 2 * TILE_SF;
  const gridTranslateX = 600 - TILE_SF;
  const gridTranslateY = 1150 - TILE_SF;
  
  const isSplitScreen = isPathfindingMode && pathfindingData?.mode === 'layout' && pathfindingData?.splitScreen;

  const renderMapContent = (splitSide = 'full') => {
    let currentPlayers = validPlayers;
    let currentStructures = allianceStructures;
    let currentHiveGridMeta = hiveGridMeta;

    if (splitSide === 'right' && isSplitScreen && pathfindingData?.placements) {
      currentStructures = pathfindingData.placements
        .filter(p => !p.isPlayer)
        .map((p, i) => {
           const nx = Number(p.newX);
           const ny = Number(p.newY);
           return {
             ...p,
             x: nx, y: ny,
             id: p.id || `gen-struct-${i}`,
             type: p.type || 'structure'
           };
        });
      
      currentPlayers = pathfindingData.placements
        .filter(p => p.isPlayer)
        .map((p, i) => {
           const nx = Number(p.newX);
           const ny = Number(p.newY);
           return {
             ...p,
             numX: nx, numY: ny,
             x: nx, y: ny,
             svgX: 600 + (nx - ny) * TILE_SF,
             svgY: 1150 - (nx + ny) * TILE_SF,
             id: p.id || `gen-player-${i}`
           };
        });
    } else if (splitSide === 'right' && !isSplitScreen) {
      currentPlayers = EMPTY_ARRAY;
    }

    const showPathfinding = isPathfindingMode && (splitSide === 'full' || splitSide === 'right');

    return (
      <div className="relative w-full h-full bg-slate-900/30 rounded-3xl border border-slate-800/80 overflow-hidden backdrop-blur-sm">
        {activeView !== 'test' && (
          <svg id={splitSide === 'full' ? 'map-svg' : `map-svg-${splitSide}`} viewBox="0 0 1200 1200" className="w-full h-full" onClick={handleSvgClick}>
            <defs>
              <pattern id="mapGrid" width="100" height="100" patternUnits="userSpaceOnUse"><path d="M 100 0 L 0 0 0 100" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1"/></pattern>
              <pattern id="subGrid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(34, 211, 238, 0.08)" strokeWidth="0.5"/></pattern>
              
              <pattern id="iso-1x1-grid" width={patternSize} height={patternSize} patternUnits="userSpaceOnUse" patternTransform={`translate(${gridTranslateX}, ${gridTranslateY})`}>
                <path d={`M ${TILE_SF} 0 L ${2 * TILE_SF} ${TILE_SF} L ${TILE_SF} ${2 * TILE_SF} L 0 ${TILE_SF} Z`} fill="none" stroke="rgba(255, 255, 255, 0.05)" strokeWidth={1/scale} />
                <path d={`M 0 0 L ${TILE_SF} ${TILE_SF} L 0 ${2 * TILE_SF} M ${2 * TILE_SF} 0 L ${TILE_SF} ${TILE_SF} L ${2 * TILE_SF} ${2 * TILE_SF}`} fill="none" stroke="rgba(255, 255, 255, 0.05)" strokeWidth={1/scale} />
              </pattern>
            </defs>
            <rect width="1200" height="1200" fill="url(#subGrid)" />
            <rect width="1200" height="1200" fill="url(#mapGrid)" />
            <polygon points="600,50 1150,600 600,1150 50,600" fill="rgba(15, 23, 42, 0.85)" stroke="rgba(34, 211, 238, 0.6)" strokeWidth="3" />

            {activeView === 'alliance' && (
              <rect width="1200" height="1200" fill="url(#iso-1x1-grid)" pointerEvents="none" />
            )}
            
            <g transform={`translate(600, 1150)`}>
              <circle cx="0" cy="0" r={4 * TILE_SF} fill="#22d3ee" opacity="0.3" className="animate-pulse" />
              <g transform={`scale(${1/scale})`}><text x="15" y="5" fill="#22d3ee" fontSize="18" fontWeight="bold">{t('map.origin')} (0:0)</text></g>
            </g>

            {activeView === 'global' && <GlobalView validPlayers={currentPlayers} fixedBuildings={fixedBuildings} allianceStructures={currentStructures} filters={filters} scale={scale} inverseScale={1/scale} TILE_SF={TILE_SF} selectedBuilding={selectedBuilding} setSelectedBuilding={handleSelectBuilding} activeView={activeView} enemyHQs={enemyHQs} showLabels={showLabels} isGlobalEditorMode={isGlobalEditorMode} globalEditorTool={globalEditorTool} globalResourceZones={globalResourceZones} setGlobalResourceZones={setGlobalResourceZones} activeZoneId={activeZoneId} />}
            {((activeView === 'castle') || (activeView === 'tactical' && eventMode === 'castle_battle')) && <CastleView validPlayers={currentPlayers} fixedBuildings={fixedBuildings} allianceStructures={currentStructures} filters={filters} scale={scale} inverseScale={1/scale} TILE_SF={TILE_SF} selectedBuilding={selectedBuilding} setSelectedBuilding={handleSelectBuilding} activeView={activeView} showLabels={showLabels} tacticalMeta={tacticalMeta} setDraggedPlayerId={setDraggedPlayerId} />}
            {activeView === 'tactical' && eventMode !== 'castle_battle' && <TacticalView validPlayers={currentPlayers} fixedBuildings={fixedBuildings} allianceStructures={currentStructures} filters={filters} scale={scale} inverseScale={1/scale} TILE_SF={TILE_SF} selectedBuilding={selectedBuilding} setSelectedBuilding={handleSelectBuilding} activeView={activeView} showLabels={showLabels} tacticalMeta={tacticalMeta} setDraggedPlayerId={setDraggedPlayerId} />}
            {activeView === 'expansion' && <ExpansionView validPlayers={currentPlayers} fixedBuildings={fixedBuildings} allianceStructures={currentStructures} setAllianceStructures={setAllianceStructures} scale={scale} inverseScale={1/scale} TILE_SF={TILE_SF} setDraggedPlayerId={setDraggedPlayerId} />}
            
            {activeView === 'alliance' && (
              <AllianceView validPlayers={currentPlayers} fixedBuildings={fixedBuildings} allianceStructures={currentStructures} filters={filters} scale={scale} inverseScale={1/scale} TILE_SF={TILE_SF} selectedBuilding={selectedBuilding} setSelectedBuilding={handleSelectBuilding} activeView={activeView} showLabels={showLabels} hiveGridMeta={currentHiveGridMeta} setHiveGridMeta={setHiveGridMeta} setDraggedPlayerId={setDraggedPlayerId} isEditMode={isMapUnlocked} />
            )}

            {showPathfinding && (
              <PathfindingView 
                pathfindingData={pathfindingData} 
                TILE_SF={TILE_SF} 
                inverseScale={1/scale} 
              />
            )}
          </svg>
        )}
        {activeView === 'test' && <CastleTestView TILE_SF={TILE_SF} />}
      </div>
    );
  };

  return (
    <div className="h-screen w-screen bg-slate-950 flex text-slate-100 overflow-hidden select-none relative">
      
      {showDemoWelcome && (
        <div className="absolute inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-cyan-500/50 rounded-2xl shadow-2xl max-w-2xl w-full p-6 flex flex-col gap-4 animate-fade-in">
            <h2 className="text-2xl font-black text-cyan-400">{t('map_page.demo_title', 'Benvenuto nella Demo di Kingshot! 👑')}</h2>
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
          alert(t('map_page.draft_saved', "✅ Lavoro memorizzato temporaneamente!")); 
        }} 
      />

     {isPathfindingMode ? (
        <AlliancePathfindingSidebar 
          setPathfindingMode={(val) => { setIsPathfindingMode(val); if (!val) setActiveView('alliance'); }}
          allianceStructures={allianceStructures} fixedBuildings={fixedBuildings} validPlayers={validPlayers}
          roster={rosterArray} setPathfindingData={setPathfindingData} setActiveView={setActiveView}
          userRole={userRole} allianceCode={allianceCode}
          setRoster={setRoster} // <--- AGGIUNGI QUESTA RIGA
        />
      ) : activeView === 'alliance' ? (
        <MapSidebarAlliance 
          roster={rosterArray} setRoster={setRoster} isReadOnly={isReadOnly}
          hiveGridMeta={hiveGridMeta} setHiveGridMeta={setHiveGridMeta}
          allianceStructures={allianceStructures} setAllianceStructures={setAllianceStructures}
          handleAllianceStructureChange={handleAllianceStructureChange}
          playerOverrides={playerOverrides} setPlayerOverrides={setPlayerOverrides}
          onOpenHelp={() => setIsHelpModalOpen(true)} handleSaveToCloud={handleSaveMapToCloud}
          isLoadingCloud={isLoadingCloud} isMapUnlocked={isMapUnlocked} setIsMapUnlocked={setIsMapUnlocked}
          setActiveView={setActiveView} setPathfindingMode={setIsPathfindingMode}userRole={userRole} allianceCode={allianceCode}
        />
      ) : activeView === 'expansion' ? (
        <MapSidebarExpansion allianceStructures={allianceStructures} setAllianceStructures={setAllianceStructures} setActiveView={setActiveView} handleSaveToCloud={handleSaveMapToCloud} isLoadingCloud={isLoadingCloud} />
      ) : isGlobalEditorMode ? (
        <MapSidebarGlobalEditor setIsGlobalEditorMode={setIsGlobalEditorMode} globalEditorTool={globalEditorTool} setGlobalEditorTool={setGlobalEditorTool} fixedBuildings={fixedBuildings} handleBuildingChange={handleBuildingChange} handleAddBuilding={handleAddBuilding} handleDeleteBuilding={handleDeleteBuilding} handleSaveToCloud={handleSaveMapToCloud} isLoadingCloud={isLoadingCloud} globalResourceZones={globalResourceZones} setGlobalResourceZones={setGlobalResourceZones} activeZoneId={activeZoneId} setActiveZoneId={setActiveZoneId} />
      ) : (activeView === 'tactical' || activeView === 'castle' || eventMode === 'castle_battle') ? (
        <MapSidebarTactical 
          roster={rosterArray} isReadOnly={isReadOnly} tacticalMeta={tacticalMeta} setTacticalMeta={setTacticalMeta}
          playerOverrides={playerOverrides} setPlayerOverrides={setPlayerOverrides} allianceStructures={allianceStructures}
          exportableOrders={exportableOrders} setExportableOrders={setExportableOrders} fixedBuildings={fixedBuildings}
          onOpenHelp={() => setIsHelpModalOpen(true)} openBuilder={() => { setIsBuilderOpen(true); setIsRightPanelOpen(false); }}
          openEventManager={() => setIsEventManagerOpen(true)} openExportModal={() => setIsExportModalOpen(true)}
        />
      ) : (
        <MapSidebar 
          setIsGlobalEditorMode={setIsGlobalEditorMode} setActiveView={setActiveView} isMapUnlocked={isMapUnlocked} setIsMapUnlocked={setIsMapUnlocked} isReadOnly={isReadOnly} roster={effectiveRoster} setRoster={setRoster} selectedTool={selectedTool} setSelectedTool={setSelectedTool} filters={filters} toggleFilter={toggleFilter} toggleAllFilters={toggleAllFilters} areAllFiltersActive={areAllFiltersActive} showLabels={showLabels} setShowLabels={setShowLabels} marchOrigin={marchOrigin} setMarchOrigin={setMarchOrigin} marchDestination={marchDestination} setMarchDestination={setMarchDestination} marchResult={marchResult} handleManualCoord={handleManualCoord} fixedBuildings={fixedBuildings} handleBuildingChange={handleBuildingChange} handleAddBuilding={handleAddBuilding} handleDeleteBuilding={handleDeleteBuilding} allianceStructures={allianceStructures} setAllianceStructures={setAllianceStructures} handleAllianceStructureChange={handleAllianceStructureChange} handleSaveToCloud={handleSaveMapToCloud} isLoadingCloud={isLoadingCloud} selectedBuilding={selectedBuilding} userRole={userRole} activeView={activeView} handleSaveSimulation={handleSaveSimulation} isSavingSim={isSavingSim} openExportModal={() => setIsExportModalOpen(true)} openEventManager={() => setIsEventManagerOpen(true)} openBuilder={() => { setIsBuilderOpen(true); setIsRightPanelOpen(false); }} onOpenHelp={() => setIsHelpModalOpen(true)} tacticalMeta={tacticalMeta} setTacticalMeta={setTacticalMeta} setSelectedBuilding={handleSelectBuilding} playerOverrides={playerOverrides} setPlayerOverrides={setPlayerOverrides} hiveGridMeta={hiveGridMeta} setHiveGridMeta={setHiveGridMeta} exportableOrders={exportableOrders} setExportableOrders={setExportableOrders} allianceMeta={allianceMeta} setAllianceMeta={setAllianceMeta} 
        />
      )}
      
      <main 
        ref={mainRef} onDragOver={handleDragOver} onDrop={handleDrop}
        className={`flex-1 bg-slate-950 relative flex flex-col items-center justify-center overflow-hidden transition-all duration-300 ${isDragging || draggedPlayerId ? 'cursor-grabbing' : 'cursor-grab'}`}
        onWheel={activeView === 'tactical' && isPlacementMode ? undefined : handleWheel} 
        onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
      >
        <div className="absolute bottom-6 right-6 z-30 flex flex-col gap-2 bg-slate-900/90 p-2 rounded-xl border border-slate-800 shadow-2xl backdrop-blur-md">
          <button onClick={() => handleWheel({ preventDefault: ()=>{}, deltaY: -100, currentTarget: mainRef.current, clientX: window.innerWidth/2, clientY: window.innerHeight/2 })} className="w-10 h-10 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg flex items-center justify-center text-lg cursor-pointer">+</button>
          <button onClick={() => handleWheel({ preventDefault: ()=>{}, deltaY: 100, currentTarget: mainRef.current, clientX: window.innerWidth/2, clientY: window.innerHeight/2 })} className="w-10 h-10 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg flex items-center justify-center text-lg cursor-pointer">-</button>
          <button onClick={handleResetView} className="w-10 h-10 bg-slate-800 hover:bg-slate-700 text-cyan-400 font-bold rounded-lg flex items-center justify-center text-xs cursor-pointer">1:1</button>
        </div>

        {isSplitScreen ? (
          <div className="w-full h-full flex relative">
             <div className="flex-1 relative overflow-hidden border-r-2 border-indigo-500/50">
                <div className="absolute bottom-6 left-6 z-50 bg-slate-900/90 border border-slate-500 text-slate-200 px-4 py-2 rounded-xl font-black shadow-lg backdrop-blur-md pointer-events-none">
                  <span className="text-[10px] uppercase tracking-widest block opacity-70">Disposizione</span>
                  ATTUALE
                </div>
                <div className={`absolute top-0 left-0 w-[1200px] h-[1200px] ${!isDragging && !draggedPlayerId ? 'transition-all duration-700 ease-in-out' : ''}`} style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`, transformOrigin: '0 0' }}>
                   {renderMapContent('left')}
                </div>
             </div>
             <div className="flex-1 relative overflow-hidden">
                <div className="absolute bottom-6 left-6 z-50 bg-emerald-900/90 border border-emerald-500 text-emerald-200 px-4 py-2 rounded-xl font-black shadow-lg backdrop-blur-md pointer-events-none">
                  <span className="text-[10px] uppercase tracking-widest block opacity-70">Disposizione</span>
                  OTTIMIZZATA
                </div>
                <div className={`absolute top-0 left-0 w-[1200px] h-[1200px] ${!isDragging && !draggedPlayerId ? 'transition-all duration-700 ease-in-out' : ''}`} style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`, transformOrigin: '0 0' }}>
                   {renderMapContent('right')}
                </div>
             </div>
          </div>
        ) : (
          <div className={`absolute top-0 left-0 w-[1200px] h-[1200px] ${!isDragging && !draggedPlayerId ? 'transition-all duration-700 ease-in-out' : ''}`} style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`, transformOrigin: '0 0' }}>
             {renderMapContent('full')}
          </div>
        )}
      </main>
      
      {activeView !== 'alliance' && activeView !== 'expansion' && !isGlobalEditorMode && !isPathfindingMode && (
        <MapDetails isReadOnly={isReadOnly} selectedBuilding={selectedBuilding} onClose={() => setIsRightPanelOpen(false)} enemyHQs={enemyHQs} onAddHQ={handleAddHQ} onRemoveHQ={handleRemoveHQ} allianceMeta={allianceMeta} setAllianceMeta={setAllianceMeta} activeView={activeView} isOpen={isRightPanelOpen} setIsOpen={setIsRightPanelOpen} currentTime={currentTime} marchAssignments={marchAssignments} setMarchAssignments={setMarchAssignments} handleConfirmDispatch={handleConfirmTacticalDispatch} buildings={fixedBuildings} getAvailableMarches={getAvailableMarches} activeDeployment={validPlayers} roster={effectiveRoster} allianceStructures={allianceStructures} tacticalMeta={tacticalMeta} eventMode={eventMode} playerOverrides={playerOverrides} />
      )}
    </div>
  );
}