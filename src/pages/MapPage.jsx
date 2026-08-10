import { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import React from 'react';
import { mapBuildings } from '../data/mapBuildings';
import { calculateMarchTime, svgToGameCoordinates } from '../utils/marchUtils';
import { useTranslation } from 'react-i18next'; 

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

const DEFAULT_STRUCTURES = [
  { id: 'alliance-hq', code: 'HQ', name: 'Quartier Generale', type: 'headquarters', x: 500, y: 500 },
  { id: 'alliance-bear-1', code: 'TRP1', name: 'Trappola per Orsi 1', type: 'beartrap', x: 520, y: 500 },
  { id: 'alliance-bear-2', code: 'TRP2', name: 'Trappola per Orsi 2', type: 'beartrap', x: 480, y: 500 }
];

const DEMO_STRUCTURES = [
  { id: 'alliance-hq', code: 'HQ', name: 'QG Sandbox (Demo)', type: 'headquarters', x: 800, y: 800 },
  { id: 'alliance-bear-1', code: 'TRP1', name: 'Trappola per Orsi 1', type: 'beartrap', x: 820, y: 800 },
  { id: 'alliance-bear-2', code: 'TRP2', name: 'Trappola per Orsi 2', type: 'beartrap', x: 780, y: 800 }
];

const DEMO_ROSTER = [
  { id: 'd1', name: 'Ragnar', tag: 'DEMO', role: 'R5', power: 120 },
  { id: 'd2', name: 'Lagertha', tag: 'DEMO', role: 'R4', power: 105 },
  { id: 'd3', name: 'Bjorn', tag: 'DEMO', role: 'R3', power: 90 },
  { id: 'd4', name: 'Floki', tag: 'DEMO', role: 'R3', power: 85 },
  { id: 'd5', name: 'Ivar', tag: 'DEMO', role: 'R2', power: 70 }
];

const DEMO_OVERRIDES = {
  'd1': { x: 798, y: 798 }, 'd2': { x: 802, y: 798 }, 
  'd3': { x: 798, y: 802 }, 'd4': { x: 802, y: 802 }, 
  'd5': { x: 804, y: 800 }
};

// 💡 AGGIUNTA PROP `allianceRole`
export default function MapPage({ roster, userRole, allianceCode, allianceRole }) {
  const mainRef = useRef(null);
  const location = useLocation();
  const { t } = useTranslation(); 
  
  // 💡 VARIABILE DI SICUREZZA: Verifica se l'utente è un semplice membro o un ospite
  const isReadOnly = userRole === 'guest' || (userRole === 'alliance' && allianceRole === 'member');

  const initialView = location.state?.initialView || 'global';

  const [activeView, setActiveView] = useState(initialView);
  const [selectedTool, setSelectedTool] = useState('buildings');
  const [isLoadingCloud, setIsLoadingCloud] = useState(false);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [marchOrigin, setMarchOrigin] = useState(null);
  const [marchDestination, setMarchDestination] = useState(null);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);

  const [showDemoWelcome, setShowDemoWelcome] = useState(allianceCode === 'DEMO');

  const [playerOverrides, setPlayerOverrides] = useState({});
  const [draggedPlayerId, setDraggedPlayerId] = useState(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isSavingSim, setIsSavingSim] = useState(false);
  const [tacticalMeta, setTacticalMeta] = useState({ eventName: '', date: '', time: '', targetBuilding: '', notes: '' });

  const [hiveGridMeta, setHiveGridMeta] = useState({ centerX: 500, centerY: 500, radius: 30, showGrid: true, territory: [] });

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
  const [allianceStructures, setAllianceStructures] = useState(DEFAULT_STRUCTURES); 
  const [allianceMeta, setAllianceMeta] = useState({ kingdom: '', tag: '' });
  const [enemyHQs, setEnemyHQs] = useState([]);

  const TILE_SF = 550 / 1200; 

  const effectiveRoster = allianceCode === 'DEMO' && (!roster || roster.length === 0) ? DEMO_ROSTER : roster;

  useEffect(() => {
    if (allianceCode === 'DEMO') {
      setAllianceStructures(DEMO_STRUCTURES);
      setPlayerOverrides(DEMO_OVERRIDES);
      setHiveGridMeta(prev => ({ ...prev, centerX: 800, centerY: 800, radius: 25 }));
      setTacticalMeta(prev => ({ ...prev, participants: ['d1', 'd2', 'd3'] }));
    } else {
      setAllianceStructures(DEFAULT_STRUCTURES);
    }
  }, [allianceCode]);

  const handleBuildingChange = (id, field, value) => {
    if (isReadOnly) return;
    const parsedValue = (field === 'x' || field === 'y') ? (value === '' ? '' : Number(value)) : value;
    setFixedBuildings(prev => prev.map(b => b.id === id ? { ...b, [field]: parsedValue } : b));
  };

  const handleAddBuilding = () => {
    if (isReadOnly) return;
    const newB = { id: `custom-${Date.now()}`, code: 'NEW', name: 'Nuovo Edificio', type: 'others', x: 500, y: 500, occupiedBy: '' };
    setFixedBuildings(prev => [newB, ...prev]);
  };

  const handleDeleteBuilding = (id) => {
    if (isReadOnly) return;
    setFixedBuildings(prev => prev.filter(b => b.id !== id));
  };

  const handleAllianceStructureChange = (id, field, value) => {
    if (isReadOnly) return;
    const numVal = value === '' ? '' : Number(value);
    setAllianceStructures(prev => prev.map(s => s.id === id ? { ...s, [field]: numVal } : s));
  };

  const handleManualCoord = (type, axis, value) => {
    const numVal = value === '' ? '' : Number(value);
    if (type === 'origin') {
      setMarchOrigin(prev => prev ? { ...prev, [axis]: numVal, isCustomPoint: true, name: 'Punto Manuale' } : { id: 'manual-o', code: 'MAN', name: 'Punto Manuale', [axis]: numVal, isCustomPoint: true });
    } else {
      setMarchDestination(prev => prev ? { ...prev, [axis]: numVal, isCustomPoint: true, name: 'Punto Manuale' } : { id: 'manual-d', code: 'MAN', name: 'Punto Manuale', [axis]: numVal, isCustomPoint: true });
    }
  };

  const marchResult = useMemo(() => {
    if (!marchOrigin || !marchDestination) return null;
    if (marchOrigin.x === '' || marchOrigin.y === '' || marchDestination.x === '' || marchDestination.y === '') return null;
    const dx = marchOrigin.x - marchDestination.x;
    const dy = marchOrigin.y - marchDestination.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const timeMins = (distance * 4) / 60;
    const m = Math.floor(timeMins);
    const s = Math.round((timeMins - m) * 60);
    return { distance: distance.toFixed(1), formattedTime: `${m}m ${s < 10 ? '0' : ''}${s}s` };
  }, [marchOrigin, marchDestination]);

  const validPlayers = useMemo(() => {
    const arr = Array.isArray(effectiveRoster) ? effectiveRoster : (effectiveRoster?.players || []);
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
  }, [effectiveRoster, playerOverrides, TILE_SF, tacticalMeta?.participants, activeView]);

  const [currentTime, setCurrentTime] = useState(0); 
  const [manualCaptures, setManualCaptures] = useState([]);
  const [healingEvents, setHealingEvents] = useState({});

  const { 
    marches, setMarches, draftPositions, setDraftPositions, 
    handleDispatchMarch, handleConfirmMinute, getAvailableMarches
  } = useMarches({
    roster: effectiveRoster, activeDeployment: validPlayers, setActiveDeployment: () => {},  
    buildings: fixedBuildings, setBuildings: setFixedBuildings, 
    teamBase: 'blue', currentTime, setManualCaptures, setHealingEvents
  });

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
    if (isReadOnly) return alert(t('map.read_only_alert', 'Azione riservata agli Ufficiali (R4/R5).'));
    const updatedHQs = [...enemyHQs, { id: `enemy-${Date.now()}`, ...newHQ, type: 'enemyHQ' }];
    setEnemyHQs(updatedHQs);
    if (allianceMeta.kingdom && allianceMeta.tag) {
      await setDoc(doc(db, "enemyHQs", `${allianceMeta.kingdom}_${allianceMeta.tag}`), { hqs: updatedHQs });
    }
  };

  const handleRemoveHQ = async (id) => {
    if (isReadOnly) return alert(t('map.read_only_alert', 'Azione riservata agli Ufficiali (R4/R5).'));
    const updatedHQs = enemyHQs.filter(hq => hq.id !== id);
    setEnemyHQs(updatedHQs);
    if (allianceMeta.kingdom && allianceMeta.tag) {
      await setDoc(doc(db, "enemyHQs", `${allianceMeta.kingdom}_${allianceMeta.tag}`), { hqs: updatedHQs });
    }
  };

  useEffect(() => {
    const fetchMapData = async () => {
      try {
        setIsLoadingCloud(true);
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

        if (userRole === 'alliance' || userRole === 'admin' || userRole === 'consulente') {
          if (allianceCode && allianceCode !== 'DEMO') {
            const allianceSnap = await getDoc(doc(db, "allianceMapData", allianceCode));
            if (allianceSnap.exists()) {
              const allianceData = allianceSnap.data();
              if (allianceData.buildings) {
                baseBuildings = baseBuildings.map(baseB => {
                  const ab = allianceData.buildings.find(a => a.id === baseB.id);
                  return ab ? { ...baseB, ...ab } : baseB;
                });
              }
              if (allianceData.allianceStructures && allianceData.allianceStructures.length > 0) {
                setAllianceStructures(allianceData.allianceStructures);
              }
              if (allianceData.hivePositions) {
                setPlayerOverrides(prev => ({...prev, ...allianceData.hivePositions}));
              }
              if (allianceData.hiveGridMeta) {
                setHiveGridMeta(allianceData.hiveGridMeta);
              }
            }
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

  const handleSaveMapToCloud = async () => {
    // 💡 BLOCCO SALVATAGGIO MAPPA PER I MEMBRI
    if (isReadOnly) {
      return alert(t('map.read_only_alert', 'Azione riservata agli Ufficiali (R4/R5).'));
    }

    if (userRole === 'guest' || (allianceCode === 'DEMO' && userRole !== 'admin' && userRole !== 'consulente' && allianceRole !== 'officer')) {
      return alert(t('map.sandbox_action_denied'));
    }
    
    setIsLoadingCloud(true);
    try {
      if (activeView === 'alliance' && allianceCode) {
        await setDoc(doc(db, "allianceMapData", allianceCode), { 
          buildings: fixedBuildings,
          allianceStructures: allianceStructures,
          hivePositions: playerOverrides,
          hiveGridMeta: hiveGridMeta
        }, { merge: true });
        alert(t('map.alliance_map_saved', { code: allianceCode }));
      } else if (userRole === 'admin' || userRole === 'consulente') {
        await setDoc(doc(db, "mapSettings", "fixedBuildings"), { buildings: fixedBuildings }, { merge: true });
        alert(t('map.global_map_updated'));
      }
    } catch (error) {
      console.error("Errore salvataggio Firebase:", error);
      alert(`${t('map.map_save_error')} - Controlla la console.`);
    }
    setIsLoadingCloud(false);
  }; 

  useEffect(() => {
    const fetchSimulation = async () => {
      if (!allianceCode || allianceCode === 'DEMO') return; 

      try {
        const docSnap = await getDoc(doc(db, "simulations", `${allianceCode}_tacticalPlan`));
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.overrides) setPlayerOverrides(prev => ({...prev, ...data.overrides}));
          if (data.marches) setMarches(data.marches);
          if (data.tacticalMeta) {
            setTacticalMeta({ ...data.tacticalMeta, author: data.author }); 
          }
        }
      } catch (error) { console.error("Errore caricamento simulazione:", error); }
    };
    fetchSimulation();
  }, [setMarches, allianceCode]);

  const handleSaveSimulation = async () => {
    // 💡 BLOCCO SALVATAGGIO SIMULAZIONE PER I MEMBRI
    if (isReadOnly) {
      return alert(t('map.read_only_alert', 'Azione riservata agli Ufficiali (R4/R5).'));
    }

    if (userRole === 'guest' || (allianceCode === 'DEMO' && userRole !== 'admin' && userRole !== 'consulente' && allianceRole !== 'officer')) {
      return alert(t('map.sandbox_action_denied'));
    }
    if (!allianceCode) return alert(t('map.no_alliance_selected'));
    setIsSavingSim(true);
    try {
      await setDoc(doc(db, "simulations", `${allianceCode}_tacticalPlan`), { 
        overrides: playerOverrides, 
        marches,
        tacticalMeta,
        author: userRole.toUpperCase(), 
        timestamp: new Date().toISOString()
      }, { merge: true });
      alert(t('map.tactical_plan_saved', { code: allianceCode }));
    } catch (error) {
      console.error("Errore salvataggio simulazione:", error);
      alert(t('map.save_error'));
    }
    setIsSavingSim(false);
  };

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
        
        if (allianceCode === 'DEMO') {
          targetX = 600 + (800 - 800) * TILE_SF;
          targetY = 1150 - (800 + 800) * TILE_SF;
        } else if (castle) {
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
          targetScale = Math.max(15.0, targetScale); 

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
  }, [activeView, selectedBuilding, fixedBuildings, validPlayers, allianceStructures, isRightPanelOpen, allianceCode]);

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
    
    newScale = Math.max(0.1, Math.min(newScale, 250));
    
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
    if (draggedPlayerId && !isReadOnly) {
      const svgElement = document.getElementById('map-svg');
      if (!svgElement) return;
      const pt = svgElement.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const svgPoint = pt.matrixTransform(svgElement.getScreenCTM().inverse());
      const coords = svgToGameCoordinates(svgPoint.x, svgPoint.y);

      if (String(draggedPlayerId).startsWith('structure:')) {
        const structId = draggedPlayerId.split(':')[1];
        handleAllianceStructureChange(structId, 'x', Math.round(coords.x));
        handleAllianceStructureChange(structId, 'y', Math.round(coords.y));
      } else {
        const playerId = String(draggedPlayerId).startsWith('player:') ? draggedPlayerId.split(':')[1] : draggedPlayerId;
        setPlayerOverrides(prev => ({
          ...prev,
          [playerId]: { x: Math.round(coords.x), y: Math.round(coords.y) }
        }));
      }
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
      if (allianceCode === 'DEMO') {
        targetX = 600 + (800 - 800) * TILE_SF;
        targetY = 1150 - (800 + 800) * TILE_SF;
      } else if (castle) {
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
    // 💡 BLOCCO DROP PER I MEMBRI
    if (isReadOnly) {
      return alert(t('map.read_only_alert', 'Azione riservata agli Ufficiali (R4/R5).'));
    }

    const dragData = e.dataTransfer.getData('text/plain');
    if (!dragData) return;
    const svgElement = document.getElementById('map-svg');
    if (!svgElement) return;
    const pt = svgElement.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgPoint = pt.matrixTransform(svgElement.getScreenCTM().inverse());
    const coords = svgToGameCoordinates(svgPoint.x, svgPoint.y);
    
    if (String(dragData).startsWith('structure:')) {
      const structId = dragData.split(':')[1];
      handleAllianceStructureChange(structId, 'x', Math.round(coords.x));
      handleAllianceStructureChange(structId, 'y', Math.round(coords.y));
    } else {
      const playerId = String(dragData).startsWith('player:') ? dragData.split(':')[1] : dragData;
      setPlayerOverrides(prev => ({
        ...prev,
        [playerId]: { x: Math.round(coords.x), y: Math.round(coords.y) }
      }));
    }
  };

  const handleConfirmTacticalDispatch = (playerId) => {
    // 💡 BLOCCO DISPATCH ORDINI PER I MEMBRI
    if (isReadOnly) {
      return alert(t('map.read_only_alert', 'Azione riservata agli Ufficiali (R4/R5).'));
    }

    Object.entries(marchAssignments).forEach(([idx, assign]) => {
      if (assign.buildingId) {
        const cleanMembers = (assign.members || []).map(m => typeof m === 'object' ? m.id : m);
        handleDispatchMarch(playerId, assign.buildingId, idx, assign.type, cleanMembers, assign.members);
      }
    });
    handleConfirmMinute();
    setMarchAssignments({});
    alert(t('map.orders_registered', { time: currentTime }));
  };

  const commonProps = {
    validPlayers, fixedBuildings, allianceStructures, filters, scale, inverseScale: 1 / scale, TILE_SF,
    selectedBuilding, setSelectedBuilding: handleSelectBuilding,
    marchOrigin, setMarchOrigin, marchDestination, setMarchDestination,
    selectedTool, showLabels, activeView, setActiveView, enemyHQs,
    setDraggedPlayerId, setPopupPlayerId,
    hiveGridMeta 
  };

  return (
    <div className="h-screen w-screen bg-slate-950 flex text-slate-100 overflow-hidden select-none relative">
      
      {showDemoWelcome && (
        <div className="absolute inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-cyan-500/50 rounded-2xl shadow-2xl max-w-2xl w-full p-6 flex flex-col gap-4 animate-fade-in">
            <h2 className="text-2xl font-black text-cyan-400">Benvenuto nella Demo di Kingshot! 👑</h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              Sei in modalità Sandbox. Abbiamo caricato alcuni dati fittizi per te: esplora liberamente tutte le funzionalità della mappa senza paura di intaccare i database reali.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 hover:border-cyan-500/50 transition-colors">
                <h3 className="text-cyan-300 font-bold mb-2">🌍 Mappa Globale</h3>
                <p className="text-xs text-slate-400">Esplora la mappa, calcola le distanze esatte di marcia e filtra i centri di potere.</p>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-rose-900/50 hover:border-rose-500/50 transition-colors">
                <h3 className="text-rose-400 font-bold mb-2">⚔️ Sala Tattica</h3>
                <p className="text-xs text-slate-400">Pianifica attacchi al secondo. Usa lo slider in basso per spostare il tempo e lancia finti rally.</p>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-indigo-900/50 hover:border-indigo-500/50 transition-colors">
                <h3 className="text-indigo-400 font-bold mb-2">🐝 Gestione Alveare</h3>
                <p className="text-xs text-slate-400">Usa la Griglia Olografica. Trascina i giocatori dal menu direttamente sulla mappa per incastrarli.</p>
              </div>
            </div>
            <button onClick={() => setShowDemoWelcome(false)} className="mt-4 w-full bg-cyan-700 hover:bg-cyan-600 text-white font-black tracking-widest uppercase py-3 rounded-lg transition-colors">
              Inizia l'esplorazione
            </button>
          </div>
        </div>
      )}

      {/* 💡 PASSAGGIO DELLA PROP isReadOnly */}
      <MapSidebar 
        isReadOnly={isReadOnly}
        roster={effectiveRoster} selectedTool={selectedTool} setSelectedTool={setSelectedTool}
        filters={filters} toggleFilter={toggleFilter} toggleAllFilters={toggleAllFilters} areAllFiltersActive={areAllFiltersActive}
        showLabels={showLabels} setShowLabels={setShowLabels}
        
        marchOrigin={marchOrigin} setMarchOrigin={setMarchOrigin} marchDestination={marchDestination} setMarchDestination={setMarchDestination}
        marchResult={marchResult}
        handleManualCoord={handleManualCoord}
        fixedBuildings={fixedBuildings} 
        handleBuildingChange={handleBuildingChange} 
        handleAddBuilding={handleAddBuilding} 
        handleDeleteBuilding={handleDeleteBuilding}
        
        allianceStructures={allianceStructures} 
        handleAllianceStructureChange={handleAllianceStructureChange}
        
        handleSaveToCloud={handleSaveMapToCloud} isLoadingCloud={isLoadingCloud} selectedBuilding={selectedBuilding}
        userRole={userRole}
        activeView={activeView}
        handleSaveSimulation={handleSaveSimulation}
        isSavingSim={isSavingSim}
        openExportModal={() => setIsExportModalOpen(true)}
        tacticalMeta={tacticalMeta}
        setTacticalMeta={setTacticalMeta}
        setSelectedBuilding={handleSelectBuilding}
        playerOverrides={playerOverrides}       
        setPlayerOverrides={setPlayerOverrides} 

        hiveGridMeta={hiveGridMeta}
        setHiveGridMeta={setHiveGridMeta}
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
        
        {activeView === 'tactical' && (
          <div className="absolute bottom-6 left-6 z-50 bg-slate-900/90 backdrop-blur-md px-4 py-2 rounded-xl border border-slate-700/50 shadow-2xl flex items-center gap-3" onMouseDown={e => e.stopPropagation()}>
            <span className="text-[10px] font-black text-cyan-400 uppercase tracking-wider">⏱️ {t('map.minute')}</span>
            
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
                <g transform={`scale(${1/scale})`}><text x="15" y="5" fill="#22d3ee" fontSize="18" fontWeight="bold">{t('map.origin')} (0:0)</text></g>
              </g>

              {activeView === 'global' && <GlobalView {...commonProps} />}
              {activeView === 'tactical' && <TacticalView {...commonProps} />}
              {activeView === 'alliance' && <AllianceView {...commonProps} />}
            </svg>
          </div>
        </div>
      </main>
      
      {/* 💡 PASSAGGIO DELLA PROP isReadOnly */}
      <MapDetails 
        isReadOnly={isReadOnly}
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
        currentTime={currentTime}
        marchAssignments={marchAssignments}
        setMarchAssignments={setMarchAssignments}
        handleConfirmDispatch={handleConfirmTacticalDispatch}
        buildings={fixedBuildings}
        getAvailableMarches={getAvailableMarches}
        activeDeployment={validPlayers}
        roster={effectiveRoster} 
        allianceStructures={allianceStructures}
      />

      <TacticalExportModal 
        isOpen={isExportModalOpen} 
        onClose={() => setIsExportModalOpen(false)} 
        playerOverrides={playerOverrides} 
        roster={effectiveRoster}
        targetBuilding={selectedBuilding}
      />
    </div>
  );
}