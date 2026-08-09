import { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import React from 'react';
import { mapBuildings } from '../data/mapBuildings';
import { calculateMarchTime, svgToGameCoordinates } from '../utils/marchUtils';

import MapSidebar from '../components/map/MapSidebar';
import MapDetails from '../components/map/MapDetails';

import GlobalView from '../components/map/views/GlobalView';
import TacticalView from '../components/map/views/TacticalView';
import AllianceView from '../components/map/views/AllianceView';
import TacticalExportModal from '../components/map/TacticalExportModal';

import { useMarches } from '../hooks/useMarches';

const INITIAL_BUILDINGS = mapBuildings.map(b => ({
  id: b.id, code: b.type ? b.type.substring(0, 3).toUpperCase() : `B${b.id}`,
  name: b.name + (b.level ? ` Lv.${b.level}` : ''), type: b.type || '',
  x: b.x, y: b.y, minX: b.x - 30, maxX: b.x + 30, minY: b.y - 30, maxY: b.y + 30, occupiedBy: b.occupant || ''
}));

export default function MapPage({ roster, userRole, allianceCode }) {
  const mainRef = useRef(null);

 // --- INTERCETTA IL PULSANTE PREMUTO NELLA HOME ---
  const location = useLocation();
  const initialView = location.state?.initialView || 'global';

  const [activeView, setActiveView] = useState(initialView); // CORRETTO: Ora ascolta la Home!
  const [selectedTool, setSelectedTool] = useState('buildings');
  const [isLoadingCloud, setIsLoadingCloud] = useState(false);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [marchOrigin, setMarchOrigin] = useState(null);
  const [marchDestination, setMarchDestination] = useState(null);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);

  // --- STATI SIMULATORE ---
  const [playerOverrides, setPlayerOverrides] = useState({});
  const [draggedPlayerId, setDraggedPlayerId] = useState(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isSavingSim, setIsSavingSim] = useState(false);
  // --- METADATI EVENTO (Per la Vista Tattica) ---
  const [tacticalMeta, setTacticalMeta] = useState({ eventName: '', date: '', time: '', targetBuilding: '', notes: '' });

  // --- STATI MODALE DISPACCIO TATTICO ---
  const [popupPlayerId, setPopupPlayerId] = useState(null);
  const [marchAssignments, setMarchAssignments] = useState({});
  const [modalPos, setModalPos] = useState({ x: 300, y: 300 });
  const [isDraggingModal, setIsDraggingModal] = useState(false);
  const [dragOffsetModal, setDragOffsetModal] = useState({ x: 0, y: 0 });

  const [filters, setFilters] = useState({
    castle: true, santuari: true, fortezze: true, builders: true,
    forager: true, harvest: true, scholar: true, armory: true,
    arsenal: true, drill: true, frontier: true, others: true,
    alliesR5: true, alliesR4: true, alliesOthers: true,
    allianceHQ: true, allianceTraps: true
  });
  
  const [showLabels, setShowLabels] = useState(false);
  const areAllFiltersActive = Object.values(filters).every(Boolean);

  const toggleFilter = (key) => setFilters(prev => ({ ...prev, [key]: !prev[key] }));
  const toggleAllFilters = () => {
    const newValue = !areAllFiltersActive;
    const newFilters = Object.keys(filters).reduce((acc, key) => { acc[key] = newValue; return acc; }, {});
    setFilters(newFilters);
  };

  const [fixedBuildings, setFixedBuildings] = useState(INITIAL_BUILDINGS);
  const [allianceStructures, setAllianceStructures] = useState([
    { id: 'alliance-hq', code: 'HQ', name: 'Quartier Generale', type: 'headquarters', x: 500, y: 500 },
    { id: 'alliance-bear-1', code: 'TRP1', name: 'Trappola per Orsi 1', type: 'beartrap', x: 520, y: 500 },
    { id: 'alliance-bear-2', code: 'TRP2', name: 'Trappola per Orsi 2', type: 'beartrap', x: 480, y: 500 }
  ]);

  const [allianceMeta, setAllianceMeta] = useState({ kingdom: '', tag: '' });
  const [enemyHQs, setEnemyHQs] = useState([]);

  const TILE_SF = 550 / 1200; 

  // --- GENERAZIONE GIOCATORI VIRTUALI ---
  const validPlayers = useMemo(() => {
    const arr = Array.isArray(roster) ? roster : (roster?.players || []);
    
    // FILTRO PARTECIPANTI: 
    // Di default l'array è vuoto ([]). In vista Tattica mostriamo SOLO chi ha la spunta.
    // Nelle altre viste (Globale/Territorio) li passiamo tutti (verranno poi nascosti dai filtri R5/R4 visivi).
    const participants = tacticalMeta?.participants || [];
    const filteredArr = activeView === 'tactical' ? arr.filter(p => participants.includes(p.id)) : arr;

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
  }, [roster, playerOverrides, TILE_SF, tacticalMeta?.participants, activeView]);

  // --- MOTORE DELLE MARCE E TIMELINE (Fino a 240 min) ---
  const [currentTime, setCurrentTime] = useState(0); 
  const [manualCaptures, setManualCaptures] = useState([]);
  const [healingEvents, setHealingEvents] = useState({});

  const { 
    marches, setMarches, draftPositions, setDraftPositions, 
    handleDispatchMarch, handleConfirmMinute, getAvailableMarches
  } = useMarches({
    roster, 
    activeDeployment: validPlayers, 
    setActiveDeployment: () => {},  
    buildings: fixedBuildings, 
    setBuildings: setFixedBuildings, 
    teamBase: 'blue', 
    currentTime, 
    setManualCaptures, 
    setHealingEvents
  });

  // --- CARICAMENTI DA FIREBASE ---
  useEffect(() => {
    if (allianceMeta.kingdom && allianceMeta.tag) {
      const fetchHQs = async () => {
        try {
          const docRef = doc(db, "enemyHQs", `${allianceMeta.kingdom}_${allianceMeta.tag}`);
          const snap = await getDoc(docRef);
          if (snap.exists()) setEnemyHQs(snap.data().hqs || []);
          else setEnemyHQs([]); 
        } catch (error) { console.error("Errore caricamento HQs:", error); }
      };
      fetchHQs();
    }
  }, [allianceMeta.kingdom, allianceMeta.tag]);

  const handleAddHQ = async (newHQ) => {
    const updatedHQs = [...enemyHQs, { id: `enemy-${Date.now()}`, ...newHQ, type: 'enemyHQ' }];
    setEnemyHQs(updatedHQs);
    if (allianceMeta.kingdom && allianceMeta.tag) {
      await setDoc(doc(db, "enemyHQs", `${allianceMeta.kingdom}_${allianceMeta.tag}`), { hqs: updatedHQs });
    }
  };

  const handleRemoveHQ = async (id) => {
    const updatedHQs = enemyHQs.filter(hq => hq.id !== id);
    setEnemyHQs(updatedHQs);
    if (allianceMeta.kingdom && allianceMeta.tag) {
      await setDoc(doc(db, "enemyHQs", `${allianceMeta.kingdom}_${allianceMeta.tag}`), { hqs: updatedHQs });
    }
  };

  // --- CARICAMENTO DATABASE MAPPA A DUE LIVELLI ---
  useEffect(() => {
    const fetchMapData = async () => {
      try {
        setIsLoadingCloud(true);
        // 1. Carica la MAPPA BASE (Quella gestita da te)
        let baseBuildings = [...INITIAL_BUILDINGS];
        const baseSnap = await getDoc(doc(db, "mapSettings", "fixedBuildings"));
        
        if (baseSnap.exists() && baseSnap.data().buildings) {
          const cloudData = baseSnap.data().buildings;
          baseBuildings = baseBuildings.map(baseB => {
            const cb = cloudData.find(c => c.id === baseB.id);
            return cb ? { ...baseB, ...cb } : baseB;
          });
          const customB = cloudData.filter(cb => !INITIAL_BUILDINGS.some(b => b.id === cb.id));
          baseBuildings = [...baseBuildings, ...customB];
        }

        // 2. SOVRASCRITTURA ALLEANZA (Se non sei tu, ma un'alleanza)
        if (userRole === 'alliance' && allianceCode) {
          const allianceSnap = await getDoc(doc(db, "allianceMapData", allianceCode));
          if (allianceSnap.exists() && allianceSnap.data().buildings) {
            const allianceData = allianceSnap.data().buildings;
            baseBuildings = baseBuildings.map(baseB => {
              const ab = allianceData.find(a => a.id === baseB.id);
              // Sovrascrive la mappa base con i dati dell'alleanza (es. chi occupa l'edificio)
              return ab ? { ...baseB, ...ab } : baseB;
            });
          }
        }

        setFixedBuildings(baseBuildings);
      } catch (error) { 
        console.error("Errore Firebase:", error); 
      } finally { 
        setIsLoadingCloud(false); 
      }
    };
    fetchMapData();
  }, [userRole, allianceCode]);

  // --- SALVATAGGIO MAPPA A DUE LIVELLI ---
  const handleSaveMapToCloud = async () => {
    setIsLoadingCloud(true);
    try {
      if (userRole === 'admin') {
        // Tu salvi la struttura portante globale
        await setDoc(doc(db, "mapSettings", "fixedBuildings"), { buildings: fixedBuildings });
        alert("✅ Mappa Base Globale Aggiornata!");
      } else if (userRole === 'alliance' && allianceCode) {
        // Le alleanze salvano solo la loro versione (es. occupazioni)
        await setDoc(doc(db, "allianceMapData", allianceCode), { buildings: fixedBuildings });
        alert(`✅ Mappa privata Alleanza [${allianceCode}] salvata!`);
      }
    } catch (error) {
      alert("❌ Errore durante il salvataggio della mappa.");
    }
    setIsLoadingCloud(false);
  }; 

 // --- CARICAMENTO E SALVATAGGIO PIANO TATTICO (Diviso per Alleanza) ---
  useEffect(() => {
    const fetchSimulation = async () => {
      // Se non c'è alleanza (non dovrebbe succedere), non carica nulla per evitare sovrascritture globali
      if (!allianceCode) return; 

      try {
        const docSnap = await getDoc(doc(db, "simulations", `${allianceCode}_tacticalPlan`));
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.overrides) setPlayerOverrides(data.overrides);
          if (data.marches) setMarches(data.marches);
          if (data.tacticalMeta) {
            // Passiamo anche l'autore ai metadati per mostrarlo nella UI
            setTacticalMeta({ ...data.tacticalMeta, author: data.author }); 
          }
        }
      } catch (error) { console.error("Errore caricamento simulazione:", error); }
    };
    fetchSimulation();
  }, [setMarches, allianceCode]); // Ricarica se cambi alleanza

  const handleSaveSimulation = async () => {
    if (!allianceCode) return alert("Nessuna alleanza selezionata!");
    setIsSavingSim(true);
    try {
      await setDoc(doc(db, "simulations", `${allianceCode}_tacticalPlan`), { 
        overrides: playerOverrides, 
        marches,
        tacticalMeta,
        author: userRole === 'admin' ? 'ADMIN' : 'ALLIANCE', // Il timbro!
        timestamp: new Date().toISOString()
      });
      alert(`✅ Piano Tattico salvato per l'alleanza [${allianceCode}]!`);
    } catch (error) {
      console.error("Errore salvataggio simulazione:", error);
      alert("❌ Errore durante il salvataggio.");
    }
    setIsSavingSim(false);
  };

  // --- LOGICA DELLA FOTOCAMERA E DELLA MAPPA ---
  const [scale, setScale] = useState(0.8);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const mapNode = mainRef.current;
    if (!mapNode) return;

    const updateCamera = () => {
      const rect = mapNode.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      if (activeView === 'global') {
        const castle = fixedBuildings.find(b => b.type?.toLowerCase() === 'castle' || b.name?.toLowerCase().includes('castello'));
        let targetX = 600, targetY = 600;
        if (castle) {
          targetX = 600 + (Number(castle.x) - Number(castle.y)) * TILE_SF;
          targetY = 1150 - (Number(castle.x) + Number(castle.y)) * TILE_SF;
        }
        const baseMapSize = 1000;
        const targetScale = Math.max(rect.width / baseMapSize, rect.height / baseMapSize);
        setPosition({ x: (rect.width / 2) - (targetX * targetScale), y: (rect.height / 2) - (targetY * targetScale) });
        setScale(targetScale);

      } else if (activeView === 'alliance') {
        const allElements = [...validPlayers];
        allianceStructures.forEach(struct => {
          allElements.push({ svgX: 600 + (Number(struct.x) - Number(struct.y)) * TILE_SF, svgY: 1150 - (Number(struct.x) + Number(struct.y)) * TILE_SF });
        });
        
        if (allElements.length > 0) {
          const minX = Math.min(...allElements.map(p => p.svgX));
          const maxX = Math.max(...allElements.map(p => p.svgX));
          const minY = Math.min(...allElements.map(p => p.svgY));
          const maxY = Math.max(...allElements.map(p => p.svgY));

          const centerX = (minX + maxX) / 2;
          const centerY = (minY + maxY) / 2;
          const width = Math.max(maxX - minX, 50);
          const height = Math.max(maxY - minY, 50);
          
          let targetScale = Math.min(rect.width / (width * 1.5), rect.height / (height * 1.5));
          targetScale = Math.max(5.0, targetScale); 

          setPosition({ x: (rect.width / 2) - (centerX * targetScale), y: (rect.height / 2) - (centerY * targetScale) });
          setScale(targetScale);
        }

      } else if (activeView === 'tactical' && selectedBuilding) {
        const radiusInTiles = 14;
        const boundingBoxSvgSize = (radiusInTiles * 4) * TILE_SF; 
        let targetScale = Math.min(rect.width / boundingBoxSvgSize, rect.height / boundingBoxSvgSize) * 0.95;
        targetScale = Math.max(0.3, Math.min(targetScale, 40));

        const bSvgX = 600 + (Number(selectedBuilding.x) - Number(selectedBuilding.y)) * TILE_SF;
        const bSvgY = 1150 - (Number(selectedBuilding.x) + Number(selectedBuilding.y)) * TILE_SF;
        
        setPosition({ x: (rect.width / 2) - (bSvgX * targetScale), y: (rect.height / 2) - (bSvgY * targetScale) });
        setScale(targetScale);
      }
    };

    const resizeObserver = new ResizeObserver(() => { updateCamera(); });
    resizeObserver.observe(mapNode); 
    updateCamera(); 
    return () => { resizeObserver.disconnect(); };
  }, [activeView, selectedBuilding, fixedBuildings, validPlayers, allianceStructures, isRightPanelOpen]);

  useEffect(() => {
    const mapNode = mainRef.current;
    if (!mapNode) return;
    const preventBrowserScroll = (e) => e.preventDefault();
    mapNode.addEventListener('wheel', preventBrowserScroll, { passive: false });
    return () => mapNode.removeEventListener('wheel', preventBrowserScroll);
  }, []);

  const handleWheel = (e) => {
    if (!mainRef.current) return;
    const zoomFactor = 1.15;
    const direction = e.deltaY < 0 ? 1 : -1;
    let newScale = direction > 0 ? scale * zoomFactor : scale / zoomFactor;
    newScale = Math.max(0.1, Math.min(newScale, 40));
    const rect = mainRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const scaleRatio = newScale / scale;
    setPosition(prev => ({ x: mouseX - (mouseX - prev.x) * scaleRatio, y: mouseY - (mouseY - prev.y) * scaleRatio }));
    setScale(newScale);
  };

  const handleMouseDown = (e) => { 
    setIsDragging(true); 
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y }); 
  };
  
  const handleMouseMove = (e) => { 
    if (draggedPlayerId) {
      const svgElement = document.getElementById('map-svg');
      if (!svgElement) return;
      const pt = svgElement.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const svgPoint = pt.matrixTransform(svgElement.getScreenCTM().inverse());
      const coords = svgToGameCoordinates(svgPoint.x, svgPoint.y);

      setPlayerOverrides(prev => ({
        ...prev,
        [draggedPlayerId]: { x: Math.round(coords.x), y: Math.round(coords.y) }
      }));
    } 
    else if (isDragging) {
      setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y }); 
    }
  };
  
  const handleMouseUp = () => { 
    setIsDragging(false); 
    setDraggedPlayerId(null); 
  };

  const handleResetView = () => {
    if (!mainRef.current) return;
    const rect = mainRef.current.getBoundingClientRect();
    let targetX = 600, targetY = 600, targetScale = 0.8;

    if (activeView === 'tactical' && selectedBuilding) {
      const radiusInTiles = 14;
      const boundingBoxSvgSize = (radiusInTiles * 4) * TILE_SF; 
      targetScale = Math.min(rect.width / boundingBoxSvgSize, rect.height / boundingBoxSvgSize) * 0.95;
      targetX = 600 + (Number(selectedBuilding.x) - Number(selectedBuilding.y)) * TILE_SF;
      targetY = 1150 - (Number(selectedBuilding.x) + Number(selectedBuilding.y)) * TILE_SF;
    } else {
      const castle = fixedBuildings.find(b => b.type?.toLowerCase() === 'castle' || b.name?.toLowerCase().includes('castello'));
      if (castle) {
        targetX = 600 + (Number(castle.x) - Number(castle.y)) * TILE_SF;
        targetY = 1150 - (Number(castle.x) + Number(castle.y)) * TILE_SF;
      }
      const baseMapSize = 1000;
      targetScale = Math.max(rect.width / baseMapSize, rect.height / baseMapSize);
    }

    setPosition({ x: (rect.width / 2) - (targetX * targetScale), y: (rect.height / 2) - (targetY * targetScale) });
    setScale(targetScale);
  };

  const handleSvgClick = (e) => {
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
    const freePointTarget = { id: `free-${Date.now()}`, code: 'POS', name: `Coordinate Mappa`, x: coords.x, y: coords.y, isCustomPoint: true };
    if (!marchOrigin) setMarchOrigin(freePointTarget);
    else if (!marchDestination) setMarchDestination(freePointTarget);
    else { setMarchOrigin(freePointTarget); setMarchDestination(null); }
  };

  const handleSelectBuilding = (b) => {
    setSelectedBuilding(b);
    if (b) setIsRightPanelOpen(true);
  };

  const handleDragOver = (e) => { e.preventDefault(); };

  const handleDrop = (e) => {
    e.preventDefault();
    const playerId = e.dataTransfer.getData('text/plain');
    if (!playerId) return;
    const svgElement = document.getElementById('map-svg');
    if (!svgElement) return;
    const pt = svgElement.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgPoint = pt.matrixTransform(svgElement.getScreenCTM().inverse());
    const coords = svgToGameCoordinates(svgPoint.x, svgPoint.y);
    setPlayerOverrides(prev => ({
      ...prev,
      [playerId]: { x: Math.round(coords.x), y: Math.round(coords.y) }
    }));
  };

  // Conferma degli ordini creati
  const handleConfirmTacticalDispatch = (playerId) => {
    Object.entries(marchAssignments).forEach(([idx, assign]) => {
      if (assign.buildingId) {
        // Estraiamo solo gli ID puri dai membri
        const cleanMembers = (assign.members || []).map(m => typeof m === 'object' ? m.id : m);
        // Lanciamo la marcia nel motore (registrandola al "currentTime" attuale)
        handleDispatchMarch(playerId, assign.buildingId, idx, assign.type, cleanMembers, assign.members);
      }
    });
    // Confermiamo i draft nel motore centrale
    handleConfirmMinute();
    
    // Resettiamo il form di selezione
    setMarchAssignments({});
    alert(`✅ Ordini registrati per il minuto ${currentTime}! (Esportali dal pulsante in sidebar sinistra)`);
  };

  const commonProps = {
    validPlayers, fixedBuildings, allianceStructures, filters, scale, inverseScale: 1 / scale, TILE_SF,
    selectedBuilding, setSelectedBuilding: handleSelectBuilding,
    marchOrigin, setMarchOrigin, marchDestination, setMarchDestination,
    selectedTool, showLabels, activeView, setActiveView, enemyHQs,
    setDraggedPlayerId, setPopupPlayerId 
  };

  return (
    <div className="h-screen w-screen bg-slate-950 flex text-slate-100 overflow-hidden select-none relative">
    <MapSidebar 
        roster={roster} selectedTool={selectedTool} setSelectedTool={setSelectedTool}
        filters={filters} toggleFilter={toggleFilter} toggleAllFilters={toggleAllFilters} areAllFiltersActive={areAllFiltersActive}
        showLabels={showLabels} setShowLabels={setShowLabels}
        marchOrigin={marchOrigin} setMarchOrigin={setMarchOrigin} marchDestination={marchDestination} setMarchDestination={setMarchDestination}
        fixedBuildings={fixedBuildings} handleBuildingChange={()=>{}} handleAddBuilding={()=>{}} handleDeleteBuilding={()=>{}}
        allianceStructures={allianceStructures} handleAllianceStructureChange={()=>{}}
        handleSaveToCloud={()=>{}} isLoadingCloud={isLoadingCloud} selectedBuilding={selectedBuilding}
        userRole={userRole}
        activeView={activeView}
        handleSaveSimulation={handleSaveSimulation}
        isSavingSim={isSavingSim}
        openExportModal={() => setIsExportModalOpen(true)}
        tacticalMeta={tacticalMeta}
        setTacticalMeta={setTacticalMeta}
        setSelectedBuilding={handleSelectBuilding} // <-- AGGIUNTA QUESTA RIGA
      />

      <main 
        ref={mainRef}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`flex-1 bg-slate-950 relative flex flex-col items-center justify-center overflow-hidden transition-all duration-300 ${isDragging || draggedPlayerId ? 'cursor-grabbing' : 'cursor-grab'}`}
        onWheel={handleWheel} 
        onMouseDown={handleMouseDown} 
        onMouseMove={handleMouseMove} 
        onMouseUp={handleMouseUp} 
        onMouseLeave={handleMouseUp}
      >
        
       {/* ========================================== */}
        {/* TIMELINE TATTICA ULTRA-COMPATTA (Solo in Tattica) */}
        {/* ========================================== */}
        {activeView === 'tactical' && (
          <div className="absolute bottom-6 left-6 z-50 bg-slate-900/90 backdrop-blur-md px-4 py-2 rounded-xl border border-slate-700/50 shadow-2xl flex items-center gap-3" onMouseDown={e => e.stopPropagation()}>
            <span className="text-[10px] font-black text-cyan-400 uppercase tracking-wider">⏱️ Minuto</span>
            
            <button onClick={() => setCurrentTime(Math.max(0, currentTime - 1))} className="w-7 h-7 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center text-xs transition-colors border border-slate-700">-</button>
            
            <input 
              type="range" 
              min="0" 
              max="240" 
              value={currentTime} 
              onChange={(e) => setCurrentTime(Number(e.target.value))}
              className="w-40 accent-cyan-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none"
            />
            
            <button onClick={() => setCurrentTime(Math.min(240, currentTime + 1))} className="w-7 h-7 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center text-xs transition-colors border border-slate-700">+</button>
            
            <span className="bg-slate-950 px-2.5 py-1 rounded border border-slate-800 text-white font-mono font-bold text-xs min-w-[45px] text-center">
              {currentTime}'
            </span>
          </div>
        )}

        <div className="absolute bottom-6 right-6 z-30 flex flex-col gap-2 bg-slate-900/90 p-2 rounded-xl border border-slate-800 shadow-2xl backdrop-blur-md">
          <button onClick={() => handleWheel({ preventDefault: ()=>{}, deltaY: -100, currentTarget: mainRef.current, clientX: window.innerWidth/2, clientY: window.innerHeight/2 })} className="w-10 h-10 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg flex items-center justify-center text-lg cursor-pointer">+</button>
          <button onClick={() => handleWheel({ preventDefault: ()=>{}, deltaY: 100, currentTarget: mainRef.current, clientX: window.innerWidth/2, clientY: window.innerHeight/2 })} className="w-10 h-10 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg flex items-center justify-center text-lg cursor-pointer">-</button>
          <button onClick={handleResetView} className="w-10 h-10 bg-slate-800 hover:bg-slate-700 text-cyan-400 font-bold rounded-lg flex items-center justify-center text-xs cursor-pointer">1:1</button>
        </div>

        <div 
          className={`absolute top-0 left-0 w-[1200px] h-[1200px] ${!isDragging && !draggedPlayerId ? 'transition-all duration-700 ease-in-out' : ''}`} 
          style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`, transformOrigin: '0 0' }}
        >
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
                <g transform={`scale(${1/scale})`}><text x="15" y="5" fill="#22d3ee" fontSize="18" fontWeight="bold">Origine (0:0)</text></g>
              </g>

              {activeView === 'global' && <GlobalView {...commonProps} />}
              {activeView === 'tactical' && <TacticalView {...commonProps} />}
              {activeView === 'alliance' && <AllianceView {...commonProps} />}
            </svg>
          </div>
        </div>
      </main>
      
      <MapDetails 
        selectedBuilding={selectedBuilding} 
        onClose={() => setIsRightPanelOpen(false)}
        enemyHQs={enemyHQs}
        onAddHQ={handleAddHQ}
        onRemoveHQ={handleRemoveHQ}
        allianceMeta={allianceMeta}
        setAllianceMeta={setAllianceMeta}
        activeView={activeView} 
        isOpen={isRightPanelOpen}
        setIsOpen={setIsRightPanelOpen}
        
        // --- NUOVI COLLEGAMENTI PER GLI ORDINI E TIMELINE ---
        currentTime={currentTime}
        marchAssignments={marchAssignments}
        setMarchAssignments={setMarchAssignments}
        handleConfirmDispatch={handleConfirmTacticalDispatch}
        buildings={fixedBuildings}
        getAvailableMarches={getAvailableMarches}
        activeDeployment={validPlayers}
      />

      <TacticalExportModal 
        isOpen={isExportModalOpen} 
        onClose={() => setIsExportModalOpen(false)} 
        playerOverrides={playerOverrides} 
        roster={roster}
        targetBuilding={selectedBuilding}
      />
    </div>
  );
}