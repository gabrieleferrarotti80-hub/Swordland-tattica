import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import ParticipantsModal from '../components/TriAlliance/ParticipantsModal';
import PlansModal from '../components/TriAlliance/PlansModal';
import ExportModal from '../components/TriAlliance/ExportModal';
import TeamBuilderModal, { TEAM_COLORS } from '../components/TriAlliance/TeamBuilderModal';
import LeftSidebar from '../components/TriAlliance/LeftSidebar';
import RightSidebar from '../components/TriAlliance/RightSidebar';
import HelpModal from '../components/TriAlliance/HelpModal';

import { useTranslation } from 'react-i18next';

import { 
  BUILDING_TYPES, UNKNOWN_BUILDING, TEAM_HEX_COLORS, 
  isNodeLocked, findPathThroughWaypoints, generateLogicalMovementsText 
} from '../utils/triAllianceConfig';

export default function TriAlliance({ auth, roster }) {
  
  const { t } = useTranslation();

  const [isLoading, setIsLoading] = useState(false);
  const [nodes, setNodes] = useState([]); 
  const [globalPaths, setGlobalPaths] = useState([]); 
  const [phasesData, setPhasesData] = useState({
    1: { assignments: {}, paths: [] },
    2: { assignments: {}, paths: [] },
    3: { assignments: {}, paths: [] }
  });
  const [participants, setParticipants] = useState([]); 
  const [savedPlans, setSavedPlans] = useState([]); 
  const [allianceDraft, setAllianceDraft] = useState({ teams: [], playerMeta: {} });
  const [homeBaseId, setHomeBaseId] = useState(null);

  const [adminTool, setAdminTool] = useState('none'); 
  const [drawMode, setDrawMode] = useState(false); 
  const [isManageParticipantsOpen, setIsManageParticipantsOpen] = useState(false);
  const [isPlansModalOpen, setIsPlansModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isTeamBuilderOpen, setIsTeamBuilderOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

  const [pathStartNode, setPathStartNode] = useState(null); 
  const [selectedNode, setSelectedNode] = useState(null);
  const [currentPhase, setCurrentPhase] = useState(1);
  const [marchesLeft, setMarchesLeft] = useState({});
  const [selectedPathIndex, setSelectedPathIndex] = useState(null);
  const [dragHoverNode, setDragHoverNode] = useState(null);

  const [showMarkers, setShowMarkers] = useState(true);
  const [showPaths, setShowPaths] = useState(true);
  const [focusedPlayerId, setFocusedPlayerId] = useState(null);

  const isAdmin = auth.role === 'admin';
  const canManageEvent = auth.role === 'admin' || ['officer', 'r4', 'r5', 'leader'].includes(String(auth.allianceRole).toLowerCase());

  const activeRoster = useMemo(() => roster.filter(p => participants.includes(p.id)), [roster, participants]);
  const currentAssignments = useMemo(() => phasesData[currentPhase]?.assignments || {}, [phasesData, currentPhase]);
  const currentPaths = useMemo(() => phasesData[currentPhase]?.paths || [], [phasesData, currentPhase]);

  useEffect(() => setSelectedPathIndex(null), [currentPhase]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedPathIndex !== null) {
        removeTacticalPath(selectedPathIndex);
        setSelectedPathIndex(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPathIndex, phasesData, currentPhase]);

  useEffect(() => {
    const fetchTriAllianceData = async () => {
      setIsLoading(true);
      try {
        const templateSnap = await getDoc(doc(db, "system", "tri_alliance_template"));
        if (templateSnap.exists()) {
          const rawNodes = templateSnap.data().nodes || [];
          const uniqueNodes = [];
          const seenIds = new Set();
          for (const n of rawNodes) { if (!seenIds.has(n.id)) { seenIds.add(n.id); uniqueNodes.push(n); } }
          setNodes(uniqueNodes);
          setGlobalPaths(templateSnap.data().paths || []);
        }

        if (auth.code && auth.code !== 'SINGLE') {
          const allianceSnap = await getDoc(doc(db, "events", `tri_${auth.code}`));
          if (allianceSnap.exists()) {
            const data = allianceSnap.data();
            if (data.phases) setPhasesData(data.phases);
            setParticipants(data.participants || []); 
            setSavedPlans(data.savedPlans || []);
            setAllianceDraft(data.allianceDraft || { teams: [], playerMeta: {} }); 
            setHomeBaseId(data.homeBaseId || null); 
          }
        }
      } catch (e) { console.error("Errore", e); }
      setIsLoading(false);
    };
    fetchTriAllianceData();
  }, [auth.code]);

  useEffect(() => {
    const marches = {};
    activeRoster.forEach(p => marches[p.id] = 3);
    Object.values(currentAssignments).forEach(assignedList => {
      assignedList?.forEach(playerId => { if (marches[playerId] > 0) marches[playerId] -= 1; });
    });
    setMarchesLeft(marches);
  }, [currentAssignments, activeRoster]);

  const scoreAnalysis = useMemo(() => {
    let totalExpected = 0;
    let totalAvailable = 0;
    const phases = [1, 2, 3].map(phase => {
      let expectedMin = 0;
      let availableMin = 0;
      nodes.forEach(node => {
        if (node.type === 'WAYPOINT') return;
        if (!isNodeLocked(node.type, phase)) {
          const pts = (BUILDING_TYPES[node.type] || UNKNOWN_BUILDING).pts;
          availableMin += pts;
          const assigned = phasesData[phase]?.assignments?.[node.id] || [];
          if (assigned.length > 0) expectedMin += pts;
        }
      });
      const expected = expectedMin * 20;
      const available = availableMin * 20;
      totalExpected += expected;
      totalAvailable += available;
      return { phase, expected, available };
    });
    return { phases, totalExpected, totalAvailable };
  }, [nodes, phasesData]);

  const saveAllianceDataToCloud = async (newPhases, newParticipants, newSavedPlans, newDraft, newHomeBaseId) => {
    try {
      await setDoc(doc(db, "events", `tri_${auth.code}`), { 
        phases: newPhases || phasesData,
        participants: newParticipants || participants,
        savedPlans: newSavedPlans || savedPlans,
        allianceDraft: newDraft || allianceDraft,
        homeBaseId: newHomeBaseId !== undefined ? newHomeBaseId : homeBaseId
      }, { merge: true });
    } catch (e) {}
  };

  const handleSetHomeBase = (nodeId) => {
    setHomeBaseId(nodeId);
    saveAllianceDataToCloud(null, null, null, null, nodeId);
  };

  const handleRotateStrategy = () => {
    if (!window.confirm(t('tri_alliance.alerts.rotateConfirm'))) return;

    const shiftMap = { 'A': 'B', 'B': 'C', 'C': 'A' };
    const rotateId = (id) => {
      if (!id) return id;
      const firstChar = id.charAt(0).toUpperCase();
      if (shiftMap[firstChar]) return shiftMap[firstChar] + id.slice(1);
      return id; 
    };

    const updatedPhases = {};
    [1, 2, 3].forEach(phase => {
      const currentPhaseState = phasesData[phase] || { assignments: {}, paths: [], orders: "" };
      const newAssignments = {};
      Object.keys(currentPhaseState.assignments).forEach(nodeId => {
        newAssignments[rotateId(nodeId)] = currentPhaseState.assignments[nodeId];
      });
      const newPaths = (currentPhaseState.paths || []).map(p => ({
        start: rotateId(p.start),
        end: rotateId(p.end)
      }));
      updatedPhases[phase] = { assignments: newAssignments, paths: newPaths, orders: currentPhaseState.orders || "" };
    });

    const newHomeBase = homeBaseId ? rotateId(homeBaseId) : null;
    setPhasesData(updatedPhases);
    setHomeBaseId(newHomeBase);
    saveAllianceDataToCloud(updatedPhases, null, null, null, newHomeBase);
    setSelectedNode(null);
  };

  const handleSaveAllianceDraft = (draftData) => {
    setAllianceDraft(draftData);
    saveAllianceDataToCloud(null, null, null, draftData);
    setIsTeamBuilderOpen(false);
  };

  const handleSaveParticipants = (newParticipants) => {
    const updatedPhases = JSON.parse(JSON.stringify(phasesData));
    [1, 2, 3].forEach(phase => {
      if (!updatedPhases[phase]) return;
      const cleanedAssignments = {};
      Object.keys(updatedPhases[phase].assignments).forEach(nodeId => {
        const validAssigned = updatedPhases[phase].assignments[nodeId].filter(id => newParticipants.includes(id));
        if (validAssigned.length > 0) cleanedAssignments[nodeId] = validAssigned;
      });
      updatedPhases[phase].assignments = cleanedAssignments;
    });
    setPhasesData(updatedPhases);
    setParticipants(newParticipants);
    saveAllianceDataToCloud(updatedPhases, newParticipants, null, null);
    setIsManageParticipantsOpen(false);
  };

  const handleSaveCurrentAsPlan = (planName) => {
    const newPlan = { 
      id: Date.now().toString(), name: planName, phases: phasesData, participants: participants,
      allianceDraft: allianceDraft, homeBaseId: homeBaseId,
      date: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString().slice(0, 5)
    };
    const updatedPlans = [...savedPlans, newPlan];
    setSavedPlans(updatedPlans);
    saveAllianceDataToCloud(null, null, updatedPlans, null, undefined);
  };

  const handleLoadPlan = (plan) => {
    if(!window.confirm(`Sovrascrivere la lavagna attuale col piano "${plan.name}"?`)) return;
    const loadedPhases = plan.phases || { 1: { assignments: {}, paths: [] }, 2: { assignments: {}, paths: [] }, 3: { assignments: {}, paths: [] } };
    setPhasesData(loadedPhases);
    setParticipants(plan.participants || []);
    setAllianceDraft(plan.allianceDraft || { teams: [], playerMeta: {} });
    setHomeBaseId(plan.homeBaseId || null);
    saveAllianceDataToCloud(loadedPhases, plan.participants || [], null, plan.allianceDraft || { teams: [], playerMeta: {} }, plan.homeBaseId || null);
    setIsPlansModalOpen(false);
  };

  const handleDeletePlan = (planId) => {
    if(!window.confirm("Eliminare piano dall'archivio?")) return;
    const updatedPlans = savedPlans.filter(p => p.id !== planId);
    setSavedPlans(updatedPlans);
    saveAllianceDataToCloud(null, null, updatedPlans, null);
  };

  const handleClearCurrentPhase = () => {
    if (!window.confirm(`${t('tri_alliance.alerts.clearConfirm')} ${currentPhase}?`)) return;
    const updatedPhases = JSON.parse(JSON.stringify(phasesData));
    updatedPhases[currentPhase].assignments = {};
    updatedPhases[currentPhase].paths = [];
    setPhasesData(updatedPhases);
    saveAllianceDataToCloud(updatedPhases, null, null, null);
    setSelectedNode(null); 
    setSelectedPathIndex(null);
  };

  const saveGlobalMap = async () => {
    setIsLoading(true);
    await setDoc(doc(db, "system", "tri_alliance_template"), { nodes, paths: globalPaths });
    alert(t('tri_alliance.alerts.netSaved'));
    setAdminTool('none');
    setIsLoading(false);
  };

  const handleAssignPlayer = (playerId, targetNodeId, sourceNodeId = null) => {
    const targetNode = nodes.find(n => n.id === targetNodeId);
    if (!targetNode) return;
    if (isNodeLocked(targetNode.type, currentPhase)) return alert(t('tri_alliance.alerts.buildingLocked'));

    const updatedPhases = JSON.parse(JSON.stringify(phasesData));
    const alreadyInTarget = (updatedPhases[currentPhase].assignments[targetNodeId] || []).includes(playerId);
    if (alreadyInTarget) return; 

    if (!sourceNodeId && marchesLeft[playerId] <= 0) {
      return alert(t('tri_alliance.alerts.marchesEmpty'));
    }

    for (let p = currentPhase; p <= 3; p++) {
      if (!updatedPhases[p]) updatedPhases[p] = { assignments: {}, paths: [] };
      if (sourceNodeId && updatedPhases[p].assignments[sourceNodeId]) {
        updatedPhases[p].assignments[sourceNodeId] = updatedPhases[p].assignments[sourceNodeId].filter(id => id !== playerId);
      }
      const nodeAssignments = updatedPhases[p].assignments[targetNodeId] || [];
      if (!nodeAssignments.includes(playerId)) {
        updatedPhases[p].assignments[targetNodeId] = [...nodeAssignments, playerId];
      }
    }

    setPhasesData(updatedPhases);
    saveAllianceDataToCloud(updatedPhases, null, null, null);
  };

  const handleDropPlayer = (e, node) => {
    e.preventDefault();
    setDragHoverNode(null);
    if (!canManageEvent) return;
    
    try {
      const payload = e.dataTransfer.getData('application/json');
      if (payload) {
        const data = JSON.parse(payload);
        handleAssignPlayer(data.playerId, node.id, data.sourceNodeId);
      } else {
        const playerId = e.dataTransfer.getData('text/plain');
        if (playerId) handleAssignPlayer(playerId, node.id, null);
      }
    } catch(err) {
      const playerId = e.dataTransfer.getData('text/plain');
      if (playerId) handleAssignPlayer(playerId, node.id, null);
    }
    
    setSelectedNode(node); 
  };

  const handleRemovePlayerFromNode = (playerId) => {
    const updatedPhases = JSON.parse(JSON.stringify(phasesData));
    for (let p = currentPhase; p <= 3; p++) {
      if (!updatedPhases[p]) continue;
      const nodeAssignments = updatedPhases[p].assignments[selectedNode.id] || [];
      updatedPhases[p].assignments[selectedNode.id] = nodeAssignments.filter(id => id !== playerId);
    }
    setPhasesData(updatedPhases);
    saveAllianceDataToCloud(updatedPhases, null, null, null);
  };

  const handleMapClick = (e) => {
    setSelectedPathIndex(null); 
    setFocusedPlayerId(null); 

    if (adminTool !== 'nodes' || !isAdmin) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const newNodeId = window.prompt("ID Edificio:");
    if (!newNodeId) return;
    const cleanId = newNodeId.toUpperCase().trim();
    if (nodes.some(n => n.id === cleanId)) return alert(t('tri_alliance.alerts.nodeExists'));
    const typeKey = window.prompt("Tipo:\n1=Temple, 2=HQ, 3=Garrison\n4=Cluster, 5=Ruins\n6=Hub, 7=Pillars\n8=SNODO FANTASMA (Curva)");
    const typesMap = { '1':'TEMPLE', '2':'HQ', '3':'GARRISON', '4':'CLUSTER', '5':'RUINS', '6':'HUB', '7':'PILLAR', '8':'WAYPOINT' };
    setNodes([...nodes, { id: cleanId, x, y, type: typesMap[typeKey] || 'PILLAR' }]);
  };

  const handleRemoveNode = (nodeId) => {
    if (!window.confirm(t('tri_alliance.alerts.removeNodeConfirm'))) return;
    setNodes(nodes.filter(n => n.id !== nodeId));
    setGlobalPaths(globalPaths.filter(p => p.start !== nodeId && p.end !== nodeId));
    setSelectedNode(null);
  };

  const handleNodeClick = (e, node) => {
    e.stopPropagation();
    setSelectedPathIndex(null); 
    setFocusedPlayerId(null);

    if (adminTool === 'links') {
      if (!pathStartNode) setPathStartNode(node);
      else {
        if (pathStartNode.id !== node.id) {
          const exists = globalPaths.findIndex(p => (p.start === pathStartNode.id && p.end === node.id) || (p.start === node.id && p.end === pathStartNode.id));
          exists >= 0 ? setGlobalPaths(globalPaths.filter((_, i) => i !== exists)) : setGlobalPaths([...globalPaths, { start: pathStartNode.id, end: node.id }]);
        }
        setPathStartNode(null);
      }
      return;
    }
    
    if (drawMode) {
      if (!pathStartNode) {
        setPathStartNode(node);
      } else {
        if (pathStartNode.id !== node.id) {
          const pathNodes = findPathThroughWaypoints(pathStartNode.id, node.id, globalPaths, nodes); 
          
          if (!pathNodes) {
            alert(t('tri_alliance.alerts.invalidPath'));
          } else {
            const updatedPhases = JSON.parse(JSON.stringify(phasesData));
            if (!updatedPhases[currentPhase]) updatedPhases[currentPhase] = { assignments: {}, paths: [] };
            
            const currentPhasePaths = updatedPhases[currentPhase].paths;
            
            const segments = [];
            for(let i = 0; i < pathNodes.length - 1; i++) {
              segments.push({ start: pathNodes[i], end: pathNodes[i+1] });
            }

            const allExist = segments.every(seg => 
              currentPhasePaths.some(p => (p.start === seg.start && p.end === seg.end) || (p.start === seg.end && p.end === seg.start))
            );

            if (allExist) {
               segments.forEach(seg => {
                  const idx = currentPhasePaths.findIndex(p => (p.start === seg.start && p.end === seg.end) || (p.start === seg.end && p.end === seg.start));
                  if(idx !== -1) currentPhasePaths.splice(idx, 1);
               });
            } else {
               segments.forEach(seg => {
                  const exists = currentPhasePaths.some(p => (p.start === seg.start && p.end === seg.end) || (p.start === seg.end && p.end === seg.start));
                  if (!exists) currentPhasePaths.push(seg);
               });
            }

            updatedPhases[currentPhase].paths = currentPhasePaths;
            setPhasesData(updatedPhases);
            saveAllianceDataToCloud(updatedPhases, null, null, null);
          }
        }
        setPathStartNode(null);
      }
      return;
    }
    setSelectedNode(node);
  };

  const removeTacticalPath = (index) => {
    const updatedPhases = JSON.parse(JSON.stringify(phasesData));
    updatedPhases[currentPhase].paths = updatedPhases[currentPhase].paths.filter((_, i) => i !== index);
    setPhasesData(updatedPhases);
    saveAllianceDataToCloud(updatedPhases, null, null, null);
  };

  return (
    <div className="h-screen flex bg-slate-950 text-white overflow-hidden font-sans select-none print:overflow-visible print:h-auto print:bg-white print:text-black">
      
      {isManageParticipantsOpen && <ParticipantsModal roster={roster} initialParticipants={participants} onClose={() => setIsManageParticipantsOpen(false)} onSave={handleSaveParticipants} />}
      {isPlansModalOpen && <PlansModal savedPlans={savedPlans} onClose={() => setIsPlansModalOpen(false)} onSaveAs={handleSaveCurrentAsPlan} onLoad={handleLoadPlan} onDelete={handleDeletePlan} />}
      
      {isExportModalOpen && (
        <ExportModal 
          isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} 
          phasesData={phasesData} activeRoster={activeRoster} nodes={nodes} 
          allianceDraft={allianceDraft} homeBaseId={homeBaseId} scoreAnalysis={scoreAnalysis} 
        />
      )}
      
      {isTeamBuilderOpen && <TeamBuilderModal isOpen={isTeamBuilderOpen} onClose={() => setIsTeamBuilderOpen(false)} activeRoster={activeRoster} draftData={allianceDraft} onSaveDraft={handleSaveAllianceDraft} />}
      {isHelpModalOpen && <HelpModal isOpen={isHelpModalOpen} onClose={() => setIsHelpModalOpen(false)} />}

      <div className="flex w-full h-full print:hidden">
        <LeftSidebar 
          canManageEvent={canManageEvent} participantsCount={participants.length} onOpenManage={() => setIsManageParticipantsOpen(true)}
          currentPhase={currentPhase} setCurrentPhase={setCurrentPhase} activeRoster={activeRoster} marchesLeft={marchesLeft} 
          scoreAnalysis={scoreAnalysis} 
          onOpenExportModal={() => setIsExportModalOpen(true)}
          onOpenTeamBuilder={() => setIsTeamBuilderOpen(true)}
          allianceDraft={allianceDraft}
          drawMode={drawMode} onToggleDrawMode={() => { setDrawMode(!drawMode); setPathStartNode(null); setSelectedNode(null); }}
          onClearPhase={handleClearCurrentPhase} onOpenPlans={() => setIsPlansModalOpen(true)}
          onRotateStrategy={handleRotateStrategy} 
          focusedPlayerId={focusedPlayerId} setFocusedPlayerId={setFocusedPlayerId}
          onOpenHelp={() => setIsHelpModalOpen(true)} 
        />

        <main className="flex-1 relative bg-[#111] overflow-hidden flex items-center justify-center p-4">
          <div id="tactical-map" className="relative inline-flex max-w-full max-h-full rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)]">
            <img src="/tri-map.jpg" alt="Tri-Alliance Map" className="max-w-full max-h-full object-contain block pointer-events-none rounded-2xl" />

            {focusedPlayerId && (
              <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-[1px] z-10 pointer-events-none transition-all duration-500 rounded-2xl"></div>
            )}

            <svg className="absolute inset-0 w-full h-full pointer-events-none z-15">
              <defs>
                <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#0ea5e9" /></marker>
                <marker id="arrowhead-selected" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#f59e0b" /></marker>
              </defs>

              {adminTool === 'links' && isAdmin && globalPaths.map((path, index) => {
                const startNode = nodes.find(n => n.id === path.start);
                const endNode = nodes.find(n => n.id === path.end);
                if (!startNode || !endNode) return null;
                const isBeingEdited = pathStartNode && (path.start === pathStartNode.id || path.end === pathStartNode.id);
                return <line key={`gp-${index}`} x1={`${startNode.x}%`} y1={`${startNode.y}%`} x2={`${endNode.x}%`} y2={`${endNode.y}%`} stroke="#d946ef" strokeWidth={isBeingEdited ? "4" : "3"} strokeDasharray="4,4" className={isBeingEdited ? "opacity-100 drop-shadow-[0_0_8px_rgba(217,70,239,0.8)]" : "opacity-80"} />;
              })}
              
              {showPaths && currentPaths.map((path, index) => {
                const startNode = nodes.find(n => n.id === path.start);
                const endNode = nodes.find(n => n.id === path.end);
                if (!startNode || !endNode || adminTool === 'links') return null;

                const hasContinuation = currentPaths.some(p => p.start === path.end);
                const isSelected = selectedPathIndex === index;
                const pathOpacity = focusedPlayerId ? 'opacity-10' : 'opacity-100';

                return (
                  <g key={`tp-${index}`} className={`pointer-events-auto cursor-pointer outline-none transition-all duration-500 ${pathOpacity}`} onClick={(e) => { e.stopPropagation(); if (canManageEvent) { setSelectedPathIndex(index); setPathStartNode(null); }}}>
                    <line x1={`${startNode.x}%`} y1={`${startNode.y}%`} x2={`${endNode.x}%`} y2={`${endNode.y}%`} stroke="transparent" strokeWidth="20" />
                    <line x1={`${startNode.x}%`} y1={`${startNode.y}%`} x2={`${endNode.x}%`} y2={`${endNode.y}%`} stroke={isSelected ? "#f59e0b" : "#0ea5e9"} strokeWidth={isSelected ? "4" : "3"} strokeDasharray="6,6" markerEnd={hasContinuation ? undefined : (isSelected ? "url(#arrowhead-selected)" : "url(#arrowhead)")} className={isSelected ? "drop-shadow-[0_0_10px_rgba(245,158,11,0.8)]" : "drop-shadow-[0_0_8px_rgba(14,165,233,0.8)] animate-[dash_1.5s_linear_infinite]"} />
                  </g>
                );
              })}
            </svg>

            <div className="absolute inset-0" onClick={handleMapClick} style={{ cursor: adminTool === 'nodes' ? 'crosshair' : 'default' }}>
              {nodes.map(node => {
                const isWaypoint = node.type === 'WAYPOINT';
                if (isWaypoint && adminTool === 'none') return null;
                
                const isLocked = isNodeLocked(node.type, currentPhase);
                const isSelected = selectedNode?.id === node.id;
                const isHomeBase = homeBaseId === node.id; 
                
                const assignedPlayers = currentAssignments[node.id] || [];
                const troopCount = assignedPlayers.length;
                const isDrawStart = pathStartNode?.id === node.id;
                const isConnected = adminTool === 'links' && globalPaths.some(p => p.start === node.id || p.end === node.id);

                let conicGradient = '';
                if (adminTool === 'none' && !isWaypoint && troopCount > 0) {
                  const teamCounts = {};
                  let unassignedCount = 0;
                  assignedPlayers.forEach(pId => {
                    const teamId = allianceDraft?.playerMeta?.[pId]?.teamId;
                    if (teamId) {
                      const team = allianceDraft.teams?.find(t => t.id === teamId);
                      if (team) { teamCounts[team.color] = (teamCounts[team.color] || 0) + 1; } 
                      else { unassignedCount++; }
                    } else { unassignedCount++; }
                  });

                  let gradientStops = [];
                  let currentPercentage = 0;
                  Object.entries(teamCounts).forEach(([colorKey, count]) => {
                    const percentage = (count / troopCount) * 100;
                    const hex = TEAM_HEX_COLORS[colorKey] || '#ffffff';
                    gradientStops.push(`${hex} ${currentPercentage}% ${currentPercentage + percentage}%`);
                    currentPercentage += percentage;
                  });
                  if (unassignedCount > 0) {
                    const percentage = (unassignedCount / troopCount) * 100;
                    gradientStops.push(`${TEAM_HEX_COLORS.unassigned} ${currentPercentage}% ${currentPercentage + percentage}%`);
                  }
                  conicGradient = `conic-gradient(${gradientStops.join(', ')})`;
                }

                const isPlayerHere = focusedPlayerId && assignedPlayers.includes(focusedPlayerId);
                const isOtherNode = focusedPlayerId && !isPlayerHere;

                return (
                  <div 
                    key={node.id} 
                    onClick={(e) => handleNodeClick(e, node)}
                    onDragOver={(e) => {
                      if (adminTool !== 'none' || drawMode || isWaypoint || isLocked) return;
                      e.preventDefault(); 
                      if (dragHoverNode !== node.id) setDragHoverNode(node.id);
                    }}
                    onDragLeave={() => setDragHoverNode(null)}
                    onDrop={(e) => {
                      if (adminTool !== 'none' || drawMode || isWaypoint || isLocked) return;
                      handleDropPlayer(e, node);
                    }}
                    className={`group absolute transform -translate-x-1/2 -translate-y-1/2 rounded-full flex items-center justify-center transition-all duration-500
                      ${adminTool === 'nodes' ? isWaypoint ? 'w-4 h-4 bg-gray-400 border z-30' : 'w-8 h-8 bg-rose-600/80 border-2 border-white text-[10px] font-black text-white z-30 hover:bg-rose-500' : adminTool === 'links' ? isConnected ? isWaypoint ? 'w-4 h-4 bg-fuchsia-400 border border-white z-30' : 'w-8 h-8 bg-fuchsia-500/80 border-2 border-white text-[10px] font-black text-white z-30 shadow-[0_0_15px_rgba(217,70,239,0.5)]' : isWaypoint ? 'w-4 h-4 bg-slate-700 border border-slate-500 z-30' : 'w-8 h-8 bg-slate-800/80 border border-slate-500 text-[10px] font-black text-slate-300 z-30' : isWaypoint ? 'w-6 h-6 bg-transparent hover:bg-cyan-500/40 border border-transparent hover:border-cyan-400/60 z-20' : 'w-8 h-8 bg-transparent border-0 hover:bg-cyan-500/20 hover:border hover:border-cyan-500/50' }
                      ${isSelected && adminTool === 'none' && !drawMode && !focusedPlayerId ? 'ring-2 ring-cyan-400 bg-cyan-400/20' : ''}
                      ${isDrawStart ? 'ring-4 ring-white bg-white/40 z-40 animate-pulse' : ''} 
                      ${isLocked && adminTool === 'none' && !isWaypoint ? 'cursor-not-allowed' : 'cursor-pointer'}
                      ${dragHoverNode === node.id ? 'scale-125 ring-4 ring-emerald-500 bg-emerald-500/40 z-50 shadow-[0_0_20px_rgba(16,185,129,0.8)]' : ''}
                      ${isPlayerHere ? 'ring-8 ring-indigo-400 scale-150 z-50 shadow-[0_0_40px_rgba(99,102,241,1)] animate-pulse bg-indigo-500/50' : 'z-20'}
                      ${isOtherNode ? 'opacity-10 grayscale scale-90' : 'opacity-100'}
                    `}
                    style={{ left: `${node.x}%`, top: `${node.y}%` }}
                  >
                    {adminTool !== 'none' && !isWaypoint && node.id}

                    {isHomeBase && adminTool === 'none' && !isWaypoint && (
                      <div className={`absolute -top-7 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-amber-600 to-yellow-500 text-slate-900 text-[9px] font-black px-2 py-0.5 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.6)] whitespace-nowrap z-50 border border-amber-300 pointer-events-none transition-opacity duration-300 ${isOtherNode ? 'opacity-0' : 'opacity-100'}`}>🏠 BASE</div>
                    )}
                    
                    {adminTool === 'none' && !isWaypoint && troopCount > 0 && (
                      <>
                        {showMarkers ? (
                          <>
                            <div className={`absolute inset-[-6px] rounded-full z-0 opacity-90 shadow-[0_0_15px_rgba(0,0,0,0.6)] pointer-events-none transition-all duration-300 ${isLocked ? 'grayscale opacity-50' : ''}`} style={{ background: conicGradient, WebkitMaskImage: 'radial-gradient(transparent 55%, black 56%)', maskImage: 'radial-gradient(transparent 55%, black 56%)' }}></div>
                            <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none"><span className={`text-[12px] font-black drop-shadow-[0_0_4px_rgba(0,0,0,1)] ${isLocked ? 'text-slate-400' : 'text-white'}`}>{troopCount}</span></div>
                          </>
                        ) : (
                          <div className={`absolute inset-[-4px] rounded-full z-0 opacity-80 shadow-[0_0_10px_rgba(0,0,0,0.5)] pointer-events-none transition-all duration-300 ${isLocked ? 'grayscale opacity-40' : ''}`} style={{ background: conicGradient, WebkitMaskImage: 'radial-gradient(transparent 85%, black 86%)', maskImage: 'radial-gradient(transparent 85%, black 86%)' }}></div>
                        )}

                        {!drawMode && (
                          <div className="absolute top-full mt-3 hidden group-hover:flex flex-col items-center z-50 pointer-events-none">
                            <div className="bg-slate-900/95 border border-slate-600 px-3 py-2 rounded-lg shadow-2xl flex flex-col gap-1 backdrop-blur-sm min-w-max">
                              {assignedPlayers.map(pId => {
                                const p = activeRoster.find(r => r.id === pId);
                                const teamId = allianceDraft?.playerMeta?.[pId]?.teamId;
                                const team = allianceDraft?.teams?.find(t => t.id === teamId);
                                const colorClass = team ? TEAM_COLORS[team.color]?.text : 'text-slate-400';

                                return (
                                  <span key={pId} className={`text-[10px] font-bold whitespace-nowrap drop-shadow-md ${colorClass} ${pId === focusedPlayerId ? 'bg-indigo-500 text-white px-1 rounded' : ''}`}>
                                    {team ? <span className="mr-1">●</span> : <span className="mr-1">○</span>}{p?.name || pId}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="absolute top-4 right-4 flex gap-2 z-40">
             {isAdmin && !drawMode && (
               <div className="bg-slate-900/80 backdrop-blur-md p-2 rounded-xl border border-fuchsia-900/50 flex gap-2 shadow-xl ml-2">
                 <button onClick={() => { setAdminTool(adminTool === 'nodes' ? 'none' : 'nodes'); setPathStartNode(null); setSelectedNode(null); }} className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${adminTool === 'nodes' ? 'bg-rose-600 text-white ring-2 ring-rose-400' : 'bg-slate-800 text-rose-300 hover:text-white'}`}>📍 {t('tri_alliance.map.editNodes')}</button>
                 <button onClick={() => { setAdminTool(adminTool === 'links' ? 'none' : 'links'); setPathStartNode(null); setSelectedNode(null); }} className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${adminTool === 'links' ? 'bg-fuchsia-600 text-white ring-2 ring-fuchsia-400' : 'bg-slate-800 text-fuchsia-300 hover:text-white'}`}>🔗 {t('tri_alliance.map.editLinks')}</button>
                 {adminTool !== 'none' && <button onClick={saveGlobalMap} disabled={isLoading} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-all shadow-lg ml-2">💾 {t('tri_alliance.map.saveNet')}</button>}
               </div>
             )}
          </div>
        </main>

        <RightSidebar 
          selectedNode={selectedNode} adminTool={adminTool} drawMode={drawMode} currentPhase={currentPhase}
          BUILDING_TYPES={BUILDING_TYPES} UNKNOWN_BUILDING={UNKNOWN_BUILDING} isNodeLocked={isNodeLocked}
          allianceAssignments={currentAssignments} activeRoster={activeRoster} marchesLeft={marchesLeft}
          onClose={() => setSelectedNode(null)} handleRemoveNode={handleRemoveNode} 
          handleAssignPlayer={handleAssignPlayer} 
          handleRemovePlayerFromNode={handleRemovePlayerFromNode}
          allianceDraft={allianceDraft} TEAM_COLORS={TEAM_COLORS}
          canManageEvent={canManageEvent} homeBaseId={homeBaseId} onSetHomeBase={handleSetHomeBase} 
          showMarkers={showMarkers} setShowMarkers={setShowMarkers}
          showPaths={showPaths} setShowPaths={setShowPaths}
        />
      </div>
    </div>
  );
}