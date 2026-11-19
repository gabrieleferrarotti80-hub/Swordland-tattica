import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { db } from '../../firebase';
import { doc, getDoc } from 'firebase/firestore';

export default function QuickPlannerModal({ 
  isOpen, onClose, roster, setRoster, activeDeployment, setActiveDeployment, 
  buildings, teamBase, onGeneratePlan, onOpenManualBuilder,
  selectedTemplateId, setSelectedTemplateId 
}) {
  const { t } = useTranslation();
  
  const [templates, setTemplates] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [autoGather, setAutoGather] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const fetchTemplates = async () => {
        setIsLoading(true);
        try {
          const docSnap = await getDoc(doc(db, "systemSettings", "quickPlannerTemplates"));
          if (docSnap.exists() && docSnap.data().templates) {
            const fetched = docSnap.data().templates;
            setTemplates(fetched);
            if (fetched.length > 0 && !selectedTemplateId) setSelectedTemplateId(fetched[0].id);
          }
        } catch (e) {}
        setIsLoading(false);
      };
      fetchTemplates();
    }
  }, [isOpen, selectedTemplateId]);

  if (!isOpen) return null;

  const participatingPlayers = roster.filter(p => p.isParticipating);
  const allyCount = participatingPlayers.length;
  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  let isMissingSquads = false;
  if (selectedTemplate?.squads) {
    isMissingSquads = selectedTemplate.squads.some(sq => participatingPlayers.filter(p => p.squad === sq).length === 0);
  }

  const handleSelectStrategy = (template) => {
    setSelectedTemplateId(template.id);
    const missing = template.squads?.some(sq => participatingPlayers.filter(p => p.squad === sq).length === 0);
    
    if (missing) {
      setTimeout(() => {
        if (window.confirm(`⚠️ MANCANO ASSEGNAZIONI!\nLa Dottrina "${template.name}" richiede le seguenti squadre: ${template.squads.join(', ')}.\n\nVuoi andare al Team Builder per assegnare i giocatori?`)) {
          onOpenManualBuilder();
        }
      }, 100);
    }
  };

  const handleAutoAssignSquads = () => {
    if (allyCount === 0) { alert("Nessun giocatore selezionato dal Roster!"); return; }
    
    const activeSquadsList = selectedTemplate?.squads;
    if (!activeSquadsList || activeSquadsList.length === 0) return;

    if (window.confirm(`Vuoi assegnare automaticamente i giocatori rispettando le percentuali tattiche della dottrina?`)) {
      const sortedPlayers = [...participatingPlayers].sort((a, b) => Number(b.power || 0) - Number(a.power || 0));
      const totalParticipatingPower = sortedPlayers.reduce((sum, p) => sum + Number(p.power || 0), 0);
      
      const weights = selectedTemplate?.squadWeights || {};
      let totalWeight = activeSquadsList.reduce((sum, sq) => sum + Number(weights[sq] || 0), 0);
      if (totalWeight === 0) {
         activeSquadsList.forEach(sq => weights[sq] = 100 / activeSquadsList.length);
         totalWeight = 100;
      }

      const squadTargets = {};
      const squadCurrent = {};
      activeSquadsList.forEach(sq => {
         squadTargets[sq] = ((weights[sq] || 0) / totalWeight) * totalParticipatingPower;
         squadCurrent[sq] = 0;
      });

      const newRoster = roster.map(p => ({ ...p, squad: p.isParticipating ? '' : p.squad }));
      
      sortedPlayers.forEach(player => {
         let bestSquad = activeSquadsList[0];
         let maxDeficit = -Infinity;
         
         activeSquadsList.forEach(sq => {
            const deficit = squadTargets[sq] - squadCurrent[sq];
            if (deficit > maxDeficit) { maxDeficit = deficit; bestSquad = sq; }
         });

         const rosterIndex = newRoster.findIndex(p => p.id === player.id);
         if (rosterIndex !== -1) {
            newRoster[rosterIndex].squad = bestSquad;
            squadCurrent[bestSquad] += Number(player.power || 0);
         }
      });

      setRoster(newRoster);
      if (activeDeployment && activeDeployment.length > 0) {
        setActiveDeployment(newRoster.filter(p => p.isParticipating).map(p => ({ ...p, role: p.role || '', positions: p.positions || {} })));
      }
    }
  };

  const getMagnetPos = (buildingId, index) => {
    const b = buildings.find(x => String(x.id) === String(buildingId));
    if (!b) return { x: 120, y: 120 };
    const mLeft = b.magnet?.xMin ?? b.x - 5;
    const mRight = b.magnet?.xMax ?? b.x + 5;
    const mBottom = b.magnet?.yMax ?? b.y + 5;
    const spacing = 8;
    const cols = Math.floor(Math.max(8, mRight - mLeft) / spacing) + 1;
    return { x: mLeft + ((index % cols) * spacing), y: mBottom + (Math.floor(index / cols) * spacing) };
  };

  const handleGenerate = () => {
    if (allyCount === 0) { alert("Seleziona almeno un giocatore dal Database Roster prima di generare un piano."); return; }
    if (!selectedTemplate) { alert("Seleziona una Dottrina valida."); return; }

    const generatedMarches = [];
    const enemyCaptures = [];
    const baseCoords = teamBase === 'red' ? { x: 200, y: 38 } : { x: 38, y: 200 };

    const sorted = [...participatingPlayers].sort((a, b) => Number(b.power || 0) - Number(a.power || 0));
    const baseOffsets = sorted.map((_, i) => ({ x: baseCoords.x + (i % 6) * 4, y: baseCoords.y + Math.floor(i / 6) * 4 }));
    
    const tailwindColors = ['#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#d946ef'];
    const getSquadColor = (sq) => {
        if (!selectedTemplate.squads) return '#64748b';
        const idx = selectedTemplate.squads.indexOf(sq);
        return idx >= 0 ? tailwindColors[idx % tailwindColors.length] : '#64748b';
    };

    const generatedDeployment = sorted.map(p => ({
      ...p, role: p.role || '', markerColor: getSquadColor(p.squad), positions: {} 
    }));

    const groups = { all: generatedDeployment };
    if (selectedTemplate.squads) {
      selectedTemplate.squads.forEach(sq => {
        groups[sq] = generatedDeployment.filter(p => p.squad === sq);
      });
    }

    const getPlayerPosAtTime = (player, time) => {
        let latestTime = -1;
        let currentPos = null;
        Object.keys(player.positions).forEach(k => {
            const tk = Number(k);
            if (tk <= time && tk >= latestTime) { latestTime = tk; currentPos = player.positions[k]; }
        });
        
        if (!currentPos) {
           const idx = sorted.findIndex(sp => sp.id === player.id);
           return { x: baseOffsets[idx].x, y: baseOffsets[idx].y, anchoredBuildingId: null };
        }
        return currentPos;
    };

    const addAction = (playersGroup, squadName, startTime, targetId, actionType = 'solo', platoon = 'all', deployMode = 'teleport') => {
      const b = buildings.find(x => String(x.id) === String(targetId));
      if (!b && actionType !== 'ritirata') return; 
      if (playersGroup.length === 0) return;

      let numDivisions = selectedTemplate.squadDivisions?.[squadName] || 1;
      const platoonVal = platoon.replace('_cap', '');
      const isCapOnly = platoon.endsWith('_cap');

      let activeGroup = [];
      let idleGroup = [];

      if (platoonVal === 'all') {
          activeGroup = [...playersGroup];
      } else {
          const requestedPlatoon = parseInt(platoonVal);
          if (requestedPlatoon > numDivisions) numDivisions = requestedPlatoon;

          const platoonIndex = requestedPlatoon - 1;
          playersGroup.forEach((p, idx) => {
              if ((idx % numDivisions) === platoonIndex) activeGroup.push(p);
              else idleGroup.push(p);
          });
      }

      if (activeGroup.length === 0) return;

      let deployedPlayers = [];
      let rallyJoiners = []; 

      if (isCapOnly && actionType !== 'ritirata' && actionType !== 'raccolta') {
          deployedPlayers = [activeGroup[0]];
          rallyJoiners = activeGroup.slice(1);
      } else {
          deployedPlayers = [...activeGroup];
      }

      const targetPos = b ? { x: b.x, y: b.y } : { x: 0, y: 0 };
      const targetName = b ? b.name : 'Base';
      const leader = deployedPlayers[0]; 

      idleGroup.forEach(p => {
          const pStart = getPlayerPosAtTime(p, startTime);
          p.positions[startTime] = { ...pStart }; 
      });
      rallyJoiners.forEach(p => {
          const pStart = getPlayerPosAtTime(p, startTime);
          p.positions[startTime] = { ...pStart }; 
      });

      // 🚀 1. RIMOZIONE MARCE E AUTO-RACCOLTA IN USCITA
      const leavingGroups = {};
      
      deployedPlayers.forEach((p) => {
          const pStart = getPlayerPosAtTime(p, startTime);
          const oldTargetId = pStart.anchoredBuildingId; 
          const isLeaving = actionType !== 'raccolta';

          if (isLeaving) {
              if (autoGather && oldTargetId && oldTargetId !== targetId && actionType !== 'ritirata') {
                  if (!leavingGroups[oldTargetId]) leavingGroups[oldTargetId] = [];
                  leavingGroups[oldTargetId].push(p);
              }

              generatedMarches.forEach(m => {
                  if (m.leader === p.id && m.marchType !== 'raccolta') {
                      const times = Object.keys(m.positions).map(Number).sort((a, b) => a - b);
                      if (times.length > 0) {
                          const lastTime = times[times.length - 1];
                          if (lastTime <= startTime && !m.positions[lastTime].removed) {
                              m.positions[startTime] = { ...m.positions[lastTime], removed: true, isGarrison: false, targetBuildingId: null };
                          }
                      }
                  }
              });
          }
      });

      // 🚀 INIETTA MARCE DI RACCOLTA IN USCITA GRUPPATE
      Object.keys(leavingGroups).forEach(oldTargetId => {
          const gatherers = leavingGroups[oldTargetId];
          const gLeader = gatherers[0];
          const oldB = buildings.find(x => String(x.id) === String(oldTargetId));
          const oldBName = oldB ? oldB.name : 'Edificio';

          generatedMarches.push({
              id: `qp-auto-gath-out-${gLeader.id}-${startTime}`, leader: gLeader.id, buildingId: oldTargetId,
              startTime, arrivalTime: startTime, marchType: 'raccolta', members: gatherers.map(g => g.id),
              isBaseStart: false, travelTimeMin: 0, speedupsNeeded: 0, deploymentSize: platoon, deployMode: 'walk',
              isAutoGather: true, squadName, platoon, targetName: oldBName,
              positions: {}
          });
      });

      if (deployMode.startsWith('teleport') && b) {
          activeGroup.forEach((p, idx) => {
              if (deployMode === 'teleport_cap' && idx !== 0) return; 
              const newBasePos = getMagnetPos(targetId, Math.floor(Math.random() * 5));
              const playerIndex = sorted.findIndex(sp => sp.id === p.id);
              if (playerIndex >= 0) baseOffsets[playerIndex] = { x: newBasePos.x, y: newBasePos.y };
          });
      }

      if (actionType === 'ritirata') {
          deployedPlayers.forEach((p) => {
              const pStart = getPlayerPosAtTime(p, startTime);
              const bPos = baseOffsets[sorted.findIndex(sp => sp.id === p.id)];
              const distCalc = Math.sqrt(Math.pow(bPos.x - pStart.x, 2) + Math.pow(bPos.y - pStart.y, 2));
              const travelTimeCalc = Math.ceil(distCalc / 15);
              const arrivalTime = startTime + travelTimeCalc;

              p.positions[startTime] = { ...pStart, removed: false };
              p.positions[arrivalTime] = { x: bPos.x, y: bPos.y, removed: false, anchoredBuildingId: null, isGarrison: false };

              generatedMarches.push({
                id: `qp-march-ret-${p.id}-${startTime}`, leader: p.id, buildingId: null, startTime, arrivalTime, marchType: 'ritirata', members: [p.id],
                squadName, platoon, targetName: 'Base',
                positions: {
                  [startTime]: { isMarching: true, startTime, arrivalTime, startX: pStart.x, startY: pStart.y, targetX: bPos.x, targetY: bPos.y, marchType: 'ritirata' },
                  [arrivalTime]: { removed: true }
                }
              });
          });
          return; 
      }

      if (actionType === 'raccolta') {
          deployedPlayers.forEach((p) => {
              const pStart = getPlayerPosAtTime(p, startTime);
              const distCalc = Math.sqrt(Math.pow(targetPos.x - pStart.x, 2) + Math.pow(targetPos.y - pStart.y, 2));
              const travelTimeCalc = Math.ceil(distCalc / 15);

              p.positions[startTime] = { ...pStart };

              generatedMarches.push({
                id: `qp-march-gath-${p.id}-${startTime}`, leader: p.id, buildingId: targetId, startTime, arrivalTime: startTime + travelTimeCalc, marchType: 'raccolta', members: [p.id], 
                squadName, platoon, targetName,
                positions: {} 
              });
          });
          return; 
      }

      let maxTravelMin = 0; 
      let speedupsTotal = 0;
      
      deployedPlayers.forEach((p) => {
          const squadIdx = playersGroup.findIndex(sp => sp.id === p.id);
          const mPos = getMagnetPos(targetId, squadIdx >= 0 ? squadIdx : 0);
          const pStart = getPlayerPosAtTime(p, startTime);
          
          let travelTimeCalc = 0;
          if (!deployMode.startsWith('teleport')) {
              const distCalc = Math.sqrt(Math.pow(targetPos.x - pStart.x, 2) + Math.pow(targetPos.y - pStart.y, 2));
              travelTimeCalc = Math.ceil(distCalc / 15);
          }
          
          maxTravelMin = Math.max(maxTravelMin, travelTimeCalc);
          speedupsTotal += Math.max(0, travelTimeCalc - 4);

          const arrTime = startTime + travelTimeCalc;
          
          if (travelTimeCalc > 0) {
              p.positions[startTime] = { ...pStart, removed: false };
          }
          p.positions[arrTime] = { x: mPos.x, y: mPos.y, removed: false, isGarrison: false, anchoredBuildingId: targetId };
      });

      if (actionType === 'rally') {
        const leaderStart = getPlayerPosAtTime(leader, startTime);
        const arrivalTimeRally = startTime + maxTravelMin;

        const marchPos = {};
        if (maxTravelMin > 0) {
            marchPos[startTime] = { isMarching: true, startTime, arrivalTime: arrivalTimeRally, startX: leaderStart.x, startY: leaderStart.y, targetX: targetPos.x, targetY: targetPos.y, targetBuildingId: targetId, targetName, marchType: 'rally' };
        }
        marchPos[arrivalTimeRally] = { x: targetPos.x, y: targetPos.y, removed: false, isGarrison: true, targetBuildingId: targetId, marchType: 'rally' };

        generatedMarches.push({
          id: `qp-march-${leader.id}-${startTime}`, leader: leader.id, buildingId: targetId, startTime, arrivalTime: arrivalTimeRally, marchType: 'rally', 
          members: deployedPlayers.map(p => p.id),
          squadName, platoon, targetName,
          positions: marchPos
        });

      } else {
        deployedPlayers.forEach((p, idx) => {
          const isLeader = idx === 0;
          const mType = isLeader ? 'attacco' : 'difesa'; 
          const pStart = getPlayerPosAtTime(p, startTime);

          let travelTimeCalc = 0;
          if (!deployMode.startsWith('teleport')) {
              const distCalc = Math.sqrt(Math.pow(targetPos.x - pStart.x, 2) + Math.pow(targetPos.y - pStart.y, 2));
              travelTimeCalc = Math.ceil(distCalc / 15);
          }
          const speedupsCalc = Math.max(0, travelTimeCalc - 4);
          const arrTime = startTime + travelTimeCalc;

          const marchPos = {};
          if (travelTimeCalc > 0) {
              marchPos[startTime] = { isMarching: true, startTime, arrivalTime: arrTime, startX: pStart.x, startY: pStart.y, targetX: targetPos.x, targetY: targetPos.y, targetBuildingId: targetId, targetName, marchType: mType };
          }
          marchPos[arrTime] = { x: targetPos.x, y: targetPos.y, removed: false, isGarrison: true, targetBuildingId: targetId, marchType: mType };

          generatedMarches.push({
            id: `qp-march-${p.id}-${startTime}`, leader: p.id, buildingId: targetId, startTime, arrivalTime: arrTime, marchType: mType, members: [p.id],
            squadName, platoon, targetName,
            positions: marchPos
          });
        });
      }

      // 🚀 2. INIETTA AUTO-RACCOLTA IN ENTRATA
      if (autoGather && actionType !== 'ritirata' && actionType !== 'raccolta') {
          if (actionType === 'rally') {
              const arrivalTimeRally = startTime + maxTravelMin;
              const allArrivers = [...deployedPlayers, ...rallyJoiners];
              if (allArrivers.length > 0) {
                  generatedMarches.push({
                      id: `qp-auto-gath-in-${leader.id}-${arrivalTimeRally}`, leader: leader.id, buildingId: targetId,
                      startTime: arrivalTimeRally, arrivalTime: arrivalTimeRally, marchType: 'raccolta', members: allArrivers.map(g => g.id),
                      isBaseStart: false, travelTimeMin: 0, speedupsNeeded: 0, deploymentSize: platoon, deployMode: 'walk',
                      isAutoGather: true, squadName, platoon, targetName,
                      positions: {}
                  });
              }
          } else {
              const arriveGroups = {};
              deployedPlayers.forEach(p => {
                  const pStart = getPlayerPosAtTime(p, startTime);
                  let travelTimeCalc = 0;
                  if (!deployMode.startsWith('teleport')) {
                      const distCalc = Math.sqrt(Math.pow(targetPos.x - pStart.x, 2) + Math.pow(targetPos.y - pStart.y, 2));
                      travelTimeCalc = Math.ceil(distCalc / 15);
                  }
                  const arrTime = startTime + travelTimeCalc;
                  if (!arriveGroups[arrTime]) arriveGroups[arrTime] = [];
                  arriveGroups[arrTime].push(p);
              });

              Object.keys(arriveGroups).forEach(arrTimeStr => {
                  const arrTime = Number(arrTimeStr);
                  const gatherers = arriveGroups[arrTimeStr];
                  const gLeader = gatherers[0];
                  generatedMarches.push({
                      id: `qp-auto-gath-in-${gLeader.id}-${arrTime}`, leader: gLeader.id, buildingId: targetId,
                      startTime: arrTime, arrivalTime: arrTime, marchType: 'raccolta', members: gatherers.map(g => g.id),
                      isBaseStart: false, travelTimeMin: 0, speedupsNeeded: 0, deploymentSize: platoon, deployMode: 'walk',
                      isAutoGather: true, squadName, platoon, targetName,
                      positions: {}
                  });
              });
          }
      }

    };

    if (selectedTemplate.commands) {
      const sortedCommands = [...selectedTemplate.commands].sort((a, b) => a.time - b.time);
      sortedCommands.forEach(cmd => {
        const targetGroup = cmd.squad === 'all' ? groups.all : (groups[cmd.squad] || []);
        if (targetGroup.length > 0) addAction(targetGroup, cmd.squad, cmd.time, cmd.buildingId, cmd.type, cmd.platoon, cmd.deployMode || 'teleport');
      });
    }

    generatedDeployment.forEach((p, i) => {
        if (Object.keys(p.positions).length === 0) {
            const bPos = baseOffsets[i];
            p.positions[0] = { x: bPos.x, y: bPos.y, removed: false, targetBuildingId: null, isGarrison: false, anchoredBuildingId: null };
        }
    });

    buildings.forEach(b => {
      const time = b.unlockTime || 0;
      enemyCaptures.push({ id: `red-${b.id}-${time}`, time, buildingId: String(b.id), team: teamBase === 'blue' ? 'red' : 'blue' });
    });

    onGeneratePlan(generatedDeployment, enemyCaptures, generatedMarches);
  };

  const parseDetachmentLabel = (cmd) => {
    let lbl = '';
    if (!cmd.platoon || cmd.platoon === 'all') lbl = 'Tutti';
    else if (cmd.platoon === 'all_cap') lbl = 'Tutti (Solo Cap)';
    else if (cmd.platoon.includes('_cap')) lbl = `Plotone ${cmd.platoon.replace('_cap', '')} (Solo Cap)`;
    else lbl = `Plotone ${cmd.platoon}`;
    
    if (cmd.deployMode === 'teleport') lbl += ' ⚡(TP Tutti)';
    else if (cmd.deployMode === 'teleport_cap') lbl += ' ⚡(TP Cap)';
    return lbl;
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-amber-500/50 rounded-2xl shadow-[0_0_50px_rgba(245,158,11,0.2)] w-full max-w-5xl flex flex-col overflow-hidden relative">
        
        <div className="flex justify-between items-center p-5 border-b border-slate-700 bg-slate-950 shrink-0">
          <div className="flex items-center gap-4">
             <h2 className="text-xl font-black text-amber-400 uppercase tracking-widest flex items-center gap-2">⚡ Quick Planner Tattico</h2>
             
             <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg shadow-inner cursor-pointer hover:bg-slate-700 transition-colors" onClick={() => setAutoGather(!autoGather)} title="Se attivo, le squadre raccolgono automaticamente i punti sia in arrivo che in uscita.">
                <div className={`w-8 h-4 flex items-center rounded-full p-0.5 transition-colors ${autoGather ? 'bg-emerald-500' : 'bg-slate-600'}`}>
                   <div className={`bg-white w-3 h-3 rounded-full shadow-md transform transition-transform ${autoGather ? 'translate-x-4' : 'translate-x-0'}`}></div>
                </div>
                <span className="text-[10px] font-black uppercase text-slate-300 tracking-wider">Auto-Loot</span>
             </div>
          </div>
          
          <button onClick={onClose} className="text-slate-400 hover:text-rose-400 font-bold transition-colors w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center">✕</button>
        </div>
        
        <div className="p-6 flex flex-col lg:flex-row gap-6 bg-slate-900 min-h-[450px] max-h-[75vh] overflow-hidden">
          
          <div className="w-full lg:w-1/3 flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-2">
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-600 shadow-inner">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">I Tuoi Alleati (IN)</label>
              <div className="text-3xl font-black text-cyan-400 drop-shadow-md">{allyCount}</div>
            </div>

            <div className="mt-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">1. Seleziona Dottrina</label>
              {isLoading ? (
                <div className="text-slate-500 text-sm font-bold">Caricamento...</div>
              ) : templates.length === 0 ? (
                <div className="text-slate-500 text-xs border border-dashed border-slate-700 rounded-xl p-4 text-center">Nessuna Dottrina disponibile.</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {templates.map(strat => (
                    <div key={strat.id} onClick={() => handleSelectStrategy(strat)} className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col gap-1 ${selectedTemplateId === strat.id ? 'bg-amber-900/30 border-amber-500 shadow-sm' : 'bg-slate-950/50 border-slate-700 hover:bg-slate-800'}`}>
                      <div className="flex items-center gap-2"><span className="text-base">{strat.icon}</span><span className={`text-xs font-black uppercase tracking-wider ${selectedTemplateId === strat.id ? 'text-amber-400' : 'text-slate-300'}`}>{strat.name}</span></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="w-full lg:w-2/3 flex flex-col gap-3 overflow-hidden bg-slate-950 border border-slate-700 rounded-2xl p-5 shadow-inner relative">
            {selectedTemplate ? (
              <div className="flex flex-col h-full">
                <div className="border-b border-slate-800 pb-3 mb-4 flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-black text-white uppercase flex items-center gap-2">{selectedTemplate.icon} {selectedTemplate.name}</h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">{selectedTemplate.desc}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6 flex-1 min-h-0">
                  <div className="flex flex-col gap-2 overflow-y-auto custom-scrollbar pr-2">
                    <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest border-b border-slate-800 pb-1">2. Diagnostica Squadre</h4>
                    <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col gap-2">
                      <div className="flex justify-between items-center text-xs border-b border-slate-800/50 pb-1 mb-1">
                        <span className="text-slate-400 font-bold">Tutti (Global)</span>
                        <span className="text-cyan-400 font-black">{allyCount} ply</span>
                      </div>
                      
                      {selectedTemplate.squads?.map(sq => {
                        const count = participatingPlayers.filter(p => p.squad === sq).length;
                        const isMissing = count === 0;
                        return (
                          <div key={sq} className="flex justify-between items-center text-xs">
                            <span className={`font-bold ${isMissing ? 'text-rose-500' : 'text-slate-300'}`}>{sq}</span>
                            <span className={`font-black ${isMissing ? 'text-rose-500' : 'text-emerald-400'}`}>{count} ply {isMissing && '⚠️ VUOTA'}</span>
                          </div>
                        )
                      })}
                    </div>
                    
                    <div className="flex flex-col gap-2 mt-2">
                      <button onClick={handleAutoAssignSquads} className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[10px] uppercase tracking-wider rounded-lg transition-colors shadow-md">
                        ⚖️ Auto-Bilancia Squadre
                      </button>
                      <button onClick={onOpenManualBuilder} className="w-full py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white font-bold text-[10px] uppercase tracking-wider rounded-lg transition-colors">
                        🤚 Assegna Manualmente
                      </button>
                    </div>

                  </div>

                  <div className="flex flex-col gap-2 overflow-y-auto custom-scrollbar pr-2 border-l border-slate-800 pl-4">
                    <h4 className="text-[10px] font-black text-amber-400 uppercase tracking-widest border-b border-slate-800 pb-1">Timeline Operativa</h4>
                    <div className="flex flex-col gap-2">
                      {selectedTemplate.commands?.sort((a,b) => a.time - b.time).map(cmd => {
                         const targetName = cmd.type === 'ritirata' ? 'BASE' : (buildings.find(b=>b.id===cmd.buildingId)?.name || '');
                         return (
                          <div key={cmd.id} className="text-xs bg-slate-900 border border-slate-800 rounded p-2 flex flex-col gap-1">
                             <div className="flex items-center gap-1 font-bold">
                               <span className="text-amber-500">[{cmd.time}']</span>
                               <span className="text-indigo-300">{cmd.squad}</span>
                               <span className="text-slate-500">➔</span>
                               <span className="text-cyan-300">{targetName}</span>
                             </div>
                             <div className="text-[10px] text-slate-500 ml-6 flex flex-col">
                               <span>Azione: <span className="text-white uppercase">{cmd.type}</span></span>
                               <span>Schiera: <span className="text-white uppercase">{parseDetachmentLabel(cmd)}</span></span>
                             </div>
                          </div>
                         )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-600 text-sm font-bold uppercase">Seleziona una Dottrina a sinistra</div>
            )}
          </div>

        </div>
        <div className="p-4 border-t border-slate-700 bg-slate-950 shrink-0 flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">Annulla</button>
          
          {isMissingSquads ? (
            <button onClick={onOpenManualBuilder} className="px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider bg-rose-600 hover:bg-rose-500 text-white shadow-[0_0_15px_rgba(225,29,72,0.4)] transition-all flex items-center gap-2">
              🛡️ Assegna Giocatori Mancanti
            </button>
          ) : (
            <button onClick={handleGenerate} disabled={templates.length === 0} className="px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white shadow-[0_0_15px_rgba(217,119,6,0.4)] transition-all flex items-center gap-2">
              ⚙️ 3. Genera Timeline
            </button>
          )}

        </div>
      </div>
    </div>
  );
}