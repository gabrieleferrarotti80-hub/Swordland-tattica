import { useState, useEffect } from 'react';

const getBasePositionApp = (idStr, teamBase) => {
  let hash = 0;
  for (let i = 0; i < idStr.length; i++) { hash = idStr.charCodeAt(i) + ((hash << 5) - hash); }
  const prng1 = Math.abs((Math.sin(hash) * 10000) % 1);
  const prng2 = Math.abs((Math.cos(hash) * 10000) % 1);
  const y = 30 + (prng1 * 40);
  let x = teamBase === 'blue' ? 3 + (prng2 * 13) : 84 + (prng2 * 13);
  return { x, y };
};

export const useMarches = ({
  roster, 
  activeDeployment, 
  setActiveDeployment, 
  buildings, 
  setBuildings, 
  teamBase, 
  currentTime, 
  setManualCaptures, 
  setHealingEvents
}) => {
  const [marches, setMarches] = useState(() => {
    const saved = localStorage.getItem('swordland-marches');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [draftPositions, setDraftPositions] = useState({});

  useEffect(() => {
    localStorage.setItem('swordland-marches', JSON.stringify(marches));
  }, [marches]);

  const getCurrentPosition = (entity) => {
    const draftPos = draftPositions[entity.id];
    if (draftPos) return draftPos;
    if (!entity.positions || Object.keys(entity.positions).length === 0) return null;

    const minutes = Object.keys(entity.positions).map(Number).sort((a, b) => a - b);
    let lastKnownPos = null;
    for (const min of minutes) { if (min <= currentTime) { lastKnownPos = entity.positions[min]; } }
    return lastKnownPos;
  };

  // NUOVA FUNZIONE: Recupera unicamente la posizione della "Città" (Segnalino Statico o Base)
  // Ignora completamente dove si trovano le marce attive, fondamentale per l'origine dei dispatch
  const getCityPosition = (playerId) => {
    const p = activeDeployment.find(x => String(x.id) === String(playerId));
    let lastStatic = null;
    if (p && p.positions) {
      const mins = Object.keys(p.positions).map(Number).sort((a,b) => a-b);
      for(const m of mins) { if (m <= currentTime) lastStatic = p.positions[m]; }
    }
    
    if (lastStatic && !lastStatic.removed && lastStatic.x !== undefined) {
       return { x: lastStatic.x, y: lastStatic.y };
    }
    return getBasePositionApp(String(playerId), teamBase);
  };

  const getExactPlayerPosition = (playerId) => {
    let latestStaticPos = null;

    const player = activeDeployment.find(p => String(p.id) === String(playerId));
    if (player && player.positions) {
      const mins = Object.keys(player.positions).map(Number).sort((a,b) => a-b);
      for (const min of mins) {
        if (min <= currentTime) {
          latestStaticPos = player.positions[min];
        }
      }
    }

    let latestMarchPos = null;
    let latestMarchTime = -1;

    marches.forEach(m => {
      const isLeader = String(m.leader) === String(playerId);
      const isMember = m.members && m.members.map(String).includes(String(playerId));
      
      if (isLeader || isMember) {
        if (m.positions) {
          const mins = Object.keys(m.positions).map(Number).sort((a,b) => a-b);
          for (const min of mins) {
            if (min <= currentTime) {
              if (min > latestMarchTime || (min === latestMarchTime && latestMarchPos && latestMarchPos.removed && !m.positions[min].removed)) {
                latestMarchTime = min;
                latestMarchPos = m.positions[min];
              }
            }
          }
        }
      }
    });

    let activePos = null;
    let dataSource = "";
    if (latestMarchPos && !latestMarchPos.removed) {
      activePos = latestMarchPos;
      dataSource = "Marcia Attiva";
    } else {
      activePos = latestStaticPos;
      dataSource = "Segnalino Statico";
    }

    if (!activePos || activePos.removed) {
      const basePos = getBasePositionApp(String(playerId), teamBase);
      return basePos;
    }

    if (activePos.isMarching && activePos.startTime !== undefined && activePos.arrivalTime !== undefined) {
      if (currentTime >= activePos.arrivalTime) {
        return { x: activePos.targetX, y: activePos.targetY };
      }
      if (currentTime <= activePos.startTime) {
        return { x: activePos.startX, y: activePos.startY };
      }
      const progress = (currentTime - activePos.startTime) / (activePos.arrivalTime - activePos.startTime);
      const progX = activePos.startX + (activePos.targetX - activePos.startX) * progress;
      const progY = activePos.startY + (activePos.targetY - activePos.startY) * progress;
      return { x: progX, y: progY };
    }

    const finalX = activePos.x !== undefined ? activePos.x : activePos.targetX;
    const finalY = activePos.y !== undefined ? activePos.y : activePos.targetY;
    return { x: finalX, y: finalY };
  };

  const getAvailableMarches = (playerId) => {
    const player = activeDeployment.find(p => String(p.id) === String(playerId));
    if (!player) return 0;
    const rosterPlayer = roster.find(p => String(p.id) === String(playerId));
    const capacityRaw = player.marches !== undefined ? player.marches : (rosterPlayer ? rosterPlayer.marches : 1);
    const total = parseInt(capacityRaw, 10) || 1;
    let used = 0;

    marches.forEach(m => {
      const isLeader = String(m.leader) === String(playerId);
      const isMember = m.members && m.members.map(String).includes(String(playerId));

      if (isLeader || isMember) {
        if (!m.positions || Object.keys(m.positions).length === 0) { used++; return; }
        const minutes = Object.keys(m.positions).map(Number).sort((a, b) => a - b);
        const startTime = minutes[0];
        let isDestroyedAtCurrentTime = false;

        for (const min of minutes) {
          if (min <= currentTime) { isDestroyedAtCurrentTime = m.positions[min].removed === true; }
        }
        if (currentTime >= startTime && !isDestroyedAtCurrentTime) { used++; }
      }
    });

    return Math.max(0, total - used);
  };

  const handleDispatchMarch = (playerId, targetBuildingId, marchIndex, marchType = 'attacco', members = [], membersData = []) => {
    console.log(`\n--- INIZIO DISPATCH MARCIA: ${marchType} verso edificio ${targetBuildingId} al min ${currentTime} ---`);
    
    // BLOCCO SICUREZZA LEADER: Verifica che il Leader sia effettivamente a casa (disponibile)
    const availableForLeader = getAvailableMarches(playerId);
    if (availableForLeader <= 0) {
      console.warn(`[TRACE DISPATCH] ERRORE: Il leader ${playerId} sta ancora marciando o è in presidio. Dispatch ANNULLATO.`);
      return;
    }

    const targetBuilding = buildings.find(b => String(b.id) === String(targetBuildingId));
    if (!targetBuilding) return;

    // Usiamo getCityPosition invece di getExactPlayerPosition per forzare la partenza dalla casa vera
    const leaderCoords = getCityPosition(playerId);
    const startX = leaderCoords.x;
    const startY = leaderCoords.y;

    console.log(`[TRACE POSIZIONE] Leader ${playerId} verificato alla Città a x:${startX.toFixed(2)}, y:${startY.toFixed(2)}`);

    const REFERENCE_POINTS = { blue: { x: 16, y: 50 }, red: { x: 84, y: 50 } };
    const dxPlayer = targetBuilding.x - startX;
    const dyPlayer = targetBuilding.y - startY;
    const playerToTargetDist = Math.sqrt(dxPlayer * dxPlayer + dyPlayer * dyPlayer);

    const refPoint = REFERENCE_POINTS[teamBase];
    const dxRef = targetBuilding.x - refPoint.x;
    const dyRef = targetBuilding.y - refPoint.y;
    const refToTargetDist = Math.sqrt(dxRef * dxRef + dyRef * dyRef);

    const tableTimeSec = teamBase === 'blue' ? (targetBuilding.travelTimeBlue || 60) : (targetBuilding.travelTimeRed || 60);
    const speed = refToTargetDist / Math.max(1, tableTimeSec);
    const travelTime = (playerToTargetDist / speed) / 60;

    const rallyDelay = marchType === 'rally' ? 4 : 0;
    const arrivalTime = currentTime + rallyDelay + travelTime;
    console.log(`[TRACE DISPATCH] LEADER ${playerId} partirà. Distanza: ${playerToTargetDist.toFixed(2)}. Tempo: ${travelTime.toFixed(2)} min. Arrivo previsto: ${arrivalTime.toFixed(2)}`);
    
    const newDrafts = {};
    const leaderMarchId = `${playerId}-march-${Date.now()}-${marchIndex}`;
    
    // Creazione Draft Leader
    newDrafts[leaderMarchId] = {
      isNewMarch: true, leader: playerId, members, // <-- Attenzione, aggiorneremo 'members' filtrando
      startTime: currentTime + rallyDelay, rallyCallTime: currentTime,
      startX, startY, targetX: targetBuilding.x, targetY: targetBuilding.y, removed: false,
      isMarching: travelTime > 0, isGarrison: true, targetName: targetBuilding.name,
      targetBuildingId: targetBuilding.id, arrivalTime, travelTime, marchType
    };

    let validMembers = [];

    if (marchType === 'rally' && members.length > 0) {
      members.forEach((memberId, mIdx) => {
        // BLOCCO SICUREZZA JOINER: Se il membro non è a casa, viene ignorato per questo rally
        if (getAvailableMarches(memberId) <= 0) {
          console.warn(`[TRACE DISPATCH] SKIP: Il joiner ${memberId} è occupato altrove e non si unirà al rally.`);
          return;
        }

        validMembers.push(memberId);

        const memData = membersData.find(m => (typeof m === 'object' ? m.id : m) === memberId) || {};
        const speedupsUsed = typeof memData === 'object' ? (memData.speedups || 0) : 0;

        // Usiamo getCityPosition per forzare la partenza del joiner da casa sua
        const memCoords = getCityPosition(memberId);
        const memStartX = memCoords.x;
        const memStartY = memCoords.y;

        const dxMem = startX - memStartX;
        const dyMem = startY - memStartY;
        const memToLeaderDist = Math.sqrt(dxMem * dxMem + dyMem * dyMem);
        
        let memTravelTime = (memToLeaderDist / speed) / 60;
        if (speedupsUsed > 0) memTravelTime = memTravelTime * Math.pow(0.75, speedupsUsed);
        if (memTravelTime > 4.0 && speedupsUsed > 0) memTravelTime = 3.99; 

        const memArrivalTime = currentTime + memTravelTime;
        console.log(`[TRACE DISPATCH] JOINER ${memberId} partirà da casa sua (x:${memStartX.toFixed(2)}, y:${memStartY.toFixed(2)}). Distanza: ${memToLeaderDist.toFixed(2)}. Tempo: ${memTravelTime.toFixed(2)} min.`);

        const memberMarchId = `${memberId}-march-${Date.now()}-join-${mIdx}`;
        
        newDrafts[memberMarchId] = {
          isNewMarch: true, leader: memberId, members: [], 
          startTime: currentTime, startX: memStartX, startY: memStartY,
          targetX: startX, targetY: startY, removed: true, 
          isMarching: true, isGarrison: false, targetBuildingId: null, 
          arrivalTime: memArrivalTime, travelTime: memTravelTime, 
          marchType: 'rally_join', speedupsUsed
        };
      });
    }

    // Aggiorniamo l'array del leader inserendo solo i validMembers che ce l'hanno fatta
    newDrafts[leaderMarchId].members = validMembers;

    setDraftPositions(prev => ({ ...prev, ...newDrafts }));
  };

  const handleConfirmMinute = () => {
    let newMarchesToAdd = [];
    const applyDraftToEntity = (entity) => {
      const draft = draftPositions[entity.id];
      if (!draft) return entity;
      const newPositions = { ...(entity.positions || {}) };
      
      if (draft.arrivalTime && draft.arrivalTime > currentTime) {
        if (draft.marchType === 'rally') {
            newPositions[currentTime] = { x: draft.startX, y: draft.startY, isGarrison: false, marchType: draft.marchType };
            newPositions[draft.rallyCallTime + 4] = { isMarching: true, startTime: draft.startTime, startX: draft.startX, startY: draft.startY, targetX: draft.targetX, targetY: draft.targetY, targetName: draft.targetName, targetBuildingId: draft.targetBuildingId, arrivalTime: draft.arrivalTime, marchType: draft.marchType };
            newPositions[draft.arrivalTime] = { x: draft.targetX, y: draft.targetY, removed: false, isGarrison: draft.isGarrison, marchType: draft.marchType, targetBuildingId: draft.targetBuildingId };
        } else if (draft.marchType === 'rally_join') {
            newPositions[currentTime] = { isMarching: true, startTime: draft.startTime, startX: draft.startX, startY: draft.startY, targetX: draft.targetX, targetY: draft.targetY, arrivalTime: draft.arrivalTime, marchType: draft.marchType };
            newPositions[draft.arrivalTime] = { x: draft.targetX, y: draft.targetY, removed: true }; 
        } else {
            newPositions[currentTime] = { isMarching: true, startTime: draft.startTime, startX: draft.startX, startY: draft.startY, targetX: draft.targetX, targetY: draft.targetY, targetName: draft.targetName, targetBuildingId: draft.targetBuildingId, arrivalTime: draft.arrivalTime, marchType: draft.marchType };
            newPositions[draft.arrivalTime] = { x: draft.targetX, y: draft.targetY, removed: false, isGarrison: draft.isGarrison, marchType: draft.marchType, targetBuildingId: draft.targetBuildingId };
        }
      } else {
        newPositions[currentTime] = { x: draft.targetX || draft.x, y: draft.targetY || draft.y, removed: draft.removed || false, isGarrison: draft.isGarrison, marchType: draft.marchType, targetBuildingId: draft.targetBuildingId };
      }
      return { ...entity, positions: newPositions, marchType: draft.marchType || entity.marchType };
    };

    setActiveDeployment(prev => prev.map(applyDraftToEntity));
    
    setMarches(prevMarches => {
      let updatedMarches = prevMarches.map(applyDraftToEntity);
      Object.entries(draftPositions).forEach(([id, draft]) => {
        if (draft.isNewMarch && !updatedMarches.find(m => String(m.id) === String(id))) {
          const newPositions = {};
          if (draft.arrivalTime && draft.arrivalTime > currentTime) {
            if (draft.marchType === 'rally') {
                newPositions[currentTime] = { x: draft.startX, y: draft.startY, isGarrison: false, marchType: draft.marchType };
                newPositions[draft.rallyCallTime + 4] = { isMarching: true, startTime: draft.startTime, startX: draft.startX, startY: draft.startY, targetX: draft.targetX, targetY: draft.targetY, targetName: draft.targetName, targetBuildingId: draft.targetBuildingId, arrivalTime: draft.arrivalTime, marchType: draft.marchType };
                newPositions[draft.arrivalTime] = { x: draft.targetX, y: draft.targetY, removed: false, isGarrison: draft.isGarrison, marchType: draft.marchType, targetBuildingId: draft.targetBuildingId };
            } else if (draft.marchType === 'rally_join') {
                newPositions[currentTime] = { isMarching: true, startTime: draft.startTime, startX: draft.startX, startY: draft.startY, targetX: draft.targetX, targetY: draft.targetY, arrivalTime: draft.arrivalTime, marchType: draft.marchType };
                newPositions[draft.arrivalTime] = { x: draft.targetX, y: draft.targetY, removed: true };
            } else {
                newPositions[currentTime] = { isMarching: true, startTime: draft.startTime, startX: draft.startX, startY: draft.startY, targetX: draft.targetX, targetY: draft.targetY, targetName: draft.targetName, targetBuildingId: draft.targetBuildingId, arrivalTime: draft.arrivalTime, marchType: draft.marchType };
                newPositions[draft.arrivalTime] = { x: draft.targetX, y: draft.targetY, removed: false, isGarrison: draft.isGarrison, marchType: draft.marchType, targetBuildingId: draft.targetBuildingId };
            }
          } else {
            newPositions[currentTime] = { x: draft.targetX, y: draft.targetY, removed: draft.removed || false, isGarrison: draft.isGarrison, marchType: draft.marchType, targetBuildingId: draft.targetBuildingId };
          }
          newMarchesToAdd.push({ id, leader: draft.leader, members: draft.members || [], positions: newPositions, marchType: draft.marchType, speedupsUsed: draft.speedupsUsed || 0 });
        }
      });
      return [...updatedMarches, ...newMarchesToAdd];
    });
    setDraftPositions({});
  };

  const handleCancelMinute = () => setDraftPositions({});
  const handleWithdraw = (id) => setDraftPositions(prev => ({ ...prev, [id]: { removed: true } }));

  const handleHeal = (playerId) => {
    if (!window.confirm("Attenzione: confermi di voler mandare in cura questo giocatore? Tutte le sue marce verranno ritirate.")) return;
    setActiveDeployment(prev => prev.map(p => String(p.id) === String(playerId) ? { ...p, positions: { ...(p.positions || {}), [currentTime]: { removed: true } } } : p));
    setMarches(prevMarches => {
      const updatedMarches = [];
      for (const march of prevMarches) {
        const isLeader = String(march.leader) === String(playerId);
        const isMember = march.members && march.members.map(String).includes(String(playerId));
        if (!isLeader && !isMember) { updatedMarches.push(march); continue; }
        let hasArrived = false;
        if (march.positions) {
          const minutes = Object.keys(march.positions).map(Number).sort((a, b) => a - b);
          let lastPos = null;
          for (const min of minutes) { if (min <= currentTime) lastPos = march.positions[min]; }
          if (lastPos && (lastPos.isGarrison || (lastPos.arrivalTime && lastPos.arrivalTime <= currentTime))) hasArrived = true;
        }
        if (hasArrived) {
           if (isLeader) {
              if (!march.members || march.members.length === 0) continue;
              let highestPowerMember = null;
              let maxPower = -1;
              march.members.forEach(memberId => {
                const player = activeDeployment.find(p => String(p.id) === String(memberId));
                if (player && player.power > maxPower) { maxPower = player.power; highestPowerMember = memberId; }
              });
              const newLeader = highestPowerMember || march.members[0];
              updatedMarches.push({ ...march, leader: newLeader, members: march.members.filter(mId => String(mId) !== String(newLeader)) });
           } else if (isMember) { updatedMarches.push({ ...march, members: march.members.filter(mId => String(mId) !== String(playerId)) }); }
        } else {
           if (isLeader) continue; else if (isMember) updatedMarches.push({ ...march, members: march.members.filter(mId => String(mId) !== String(playerId)) });
        }
      }
      return updatedMarches.filter(m => !(String(m.leader) === String(playerId) && m.marchType === 'rally_join'));
    });
    setDraftPositions(prev => {
      const newDrafts = { ...prev };
      Object.keys(newDrafts).forEach(draftId => { if (String(newDrafts[draftId].leader) === String(playerId) || draftId.startsWith(`${playerId}-`)) delete newDrafts[draftId]; });
      return newDrafts;
    });
    setHealingEvents(prev => ({ ...prev, [playerId]: currentTime }));
  };

  const handleCancelHeal = (e, playerId) => {
    e.stopPropagation();
    setHealingEvents(prev => { const newHeals = { ...prev }; delete newHeals[playerId]; return newHeals; });
  };

  const handleGarrisonAction = (actionType, buildingId, targetPlayerId = null) => {
    console.log(`\n--- INIZIO GARRISON ACTION: ${actionType} su edificio ${buildingId} al min ${currentTime} ---`);
    const targetBuilding = buildings.find(b => String(b.id) === String(buildingId));
    if (!targetBuilding) return;

    if (actionType === 'defeat') {
      const enemyTeam = teamBase === 'blue' ? 'red' : 'blue';
      setBuildings(prev => prev.map(b => String(b.id) === String(buildingId) ? { ...b, controlledBy: enemyTeam } : b));
      setManualCaptures(prev => [...prev, { time: currentTime, buildingId: String(buildingId), team: enemyTeam }]);
    } else if (actionType === 'retreat_all') {
      setBuildings(prev => prev.map(b => String(b.id) === String(buildingId) ? { ...b, controlledBy: 'neutral' } : b));
      setManualCaptures(prev => [...prev, { time: currentTime, buildingId: String(buildingId), team: 'neutral' }]);
    }

    const calcTravelTime = (x1, y1, x2, y2) => {
      const dist = Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
      return Math.max(1, Math.round(dist / 5)); 
    };

    setMarches(prevMarches => {
      const updatedMarches = [];
      for (const march of prevMarches) {
        let lastPos = null;
        if (march.positions) {
          const minutes = Object.keys(march.positions).map(Number).sort((a, b) => a - b);
          for (const min of minutes) { if (min <= currentTime) lastPos = march.positions[min]; }
        }

        const isAtBuilding = lastPos && !lastPos.removed && String(lastPos.targetBuildingId) === String(buildingId) && (!lastPos.isMarching || lastPos.arrivalTime <= currentTime);
        if (!isAtBuilding) { updatedMarches.push(march); continue; }

        console.log(`[TRACE RIENTRO] Individuata marcia coinvolta: ${march.id} guidata da ${march.leader}`);

        const cleanedPositions = {};
        if (march.positions) { Object.keys(march.positions).forEach(k => { if (Number(k) < currentTime) cleanedPositions[k] = march.positions[k]; }); }

        if (actionType === 'retreat_all' || actionType === 'defeat') {
          // 1. Il leader rientra calcolando la distanza verso la SUA città statica
          const leaderReturnPos = getCityPosition(march.leader);
          const tTime = calcTravelTime(targetBuilding.x, targetBuilding.y, leaderReturnPos.x, leaderReturnPos.y);
          console.log(`[TRACE RIENTRO] Leader marcia ${march.leader} rientra in ${tTime} min verso x:${leaderReturnPos.x.toFixed(2)}, y:${leaderReturnPos.y.toFixed(2)}`);
          
          updatedMarches.push({
            ...march,
            members: [], // SVUOTA: Il gruppo si scioglie
            marchType: 'ritirata',
            positions: {
              ...cleanedPositions,
              [currentTime]: { 
                startX: targetBuilding.x, 
                startY: targetBuilding.y, 
                x: targetBuilding.x, 
                y: targetBuilding.y, 
                targetX: leaderReturnPos.x, 
                targetY: leaderReturnPos.y, 
                isMarching: true, 
                isGarrison: false, 
                targetBuildingId: null, 
                startTime: currentTime, 
                arrivalTime: currentTime + tTime, 
                removed: false 
              },
              [currentTime + tTime]: { removed: true }
            }
          });

          // 2. Ogni membro calcola il viaggio verso la PROPRIA città
          if (march.members && march.members.length > 0) {
            march.members.forEach((memberId, idx) => {
              const memReturnPos = getCityPosition(memberId);
              const memTime = calcTravelTime(targetBuilding.x, targetBuilding.y, memReturnPos.x, memReturnPos.y);
              console.log(`[TRACE RIENTRO] Membro ${memberId} rientra da solo in ${memTime} min verso x:${memReturnPos.x.toFixed(2)}, y:${memReturnPos.y.toFixed(2)}`);

              updatedMarches.push({
                id: `return-${Date.now()}-${memberId}-${idx}`,
                leader: memberId,
                members: [],
                marchType: 'ritirata',
                positions: {
                  [currentTime]: {
                    startX: targetBuilding.x,
                    startY: targetBuilding.y,
                    x: targetBuilding.x,
                    y: targetBuilding.y,
                    targetX: memReturnPos.x,
                    targetY: memReturnPos.y,
                    isMarching: true,
                    isGarrison: false,
                    targetBuildingId: null,
                    startTime: currentTime,
                    arrivalTime: currentTime + memTime,
                    removed: false
                  },
                  [currentTime + memTime]: { removed: true }
                }
              });
            });
          }

        } else if (actionType === 'retreat_single' && targetPlayerId) {
          const isLeader = String(march.leader) === String(targetPlayerId);
          const isMember = march.members && march.members.map(String).includes(String(targetPlayerId));

          if (isLeader || isMember) {
            const returnPos = getCityPosition(targetPlayerId);
            const tTime = calcTravelTime(targetBuilding.x, targetBuilding.y, returnPos.x, returnPos.y);
            console.log(`[TRACE RIENTRO SINGOLO] Giocatore ${targetPlayerId} rientra in ${tTime} min verso x:${returnPos.x.toFixed(2)}, y:${returnPos.y.toFixed(2)}`);
            
            updatedMarches.push({ 
              id: `return-${Date.now()}-${targetPlayerId}`, leader: targetPlayerId, members: [], marchType: 'ritirata', 
              positions: { 
                [currentTime]: { 
                  startX: targetBuilding.x, 
                  startY: targetBuilding.y, 
                  x: targetBuilding.x, 
                  y: targetBuilding.y, 
                  targetX: returnPos.x, 
                  targetY: returnPos.y, 
                  isMarching: true, 
                  isGarrison: false, 
                  targetBuildingId: null, 
                  startTime: currentTime, 
                  arrivalTime: currentTime + tTime, 
                  removed: false 
                }, 
                [currentTime + tTime]: { removed: true } 
              } 
            });
          }

          if (isLeader) {
            if (!march.members || march.members.length === 0) { updatedMarches.push({ ...march, positions: { ...cleanedPositions, [currentTime]: { removed: true } } }); } 
            else {
              let newLeader = march.members[0];
              updatedMarches.push({ ...march, leader: newLeader, members: march.members.filter(mId => String(mId) !== String(newLeader)), positions: { ...march.positions } });
            }
          } else if (isMember) { updatedMarches.push({ ...march, members: march.members.filter(mId => String(mId) !== String(targetPlayerId)) }); } 
          else { updatedMarches.push(march); }
        }
      }
      return updatedMarches;
    });
  };

  const handleUpdatePosition = (dragData, newX, newY) => {
    const [type, id] = dragData.split(':');
    if (type === 'building') { setBuildings(prev => prev.map(b => String(b.id) === String(id) ? { ...b, x: newX, y: newY } : b)); return; }
    if (type === 'player') {
      setActiveDeployment(prev => prev.map(p => String(p.id) === String(id) ? { ...p, positions: { ...(p.positions || {}), [currentTime]: { x: newX, y: newY, removed: false } } } : p));
      
      setMarches(prevMarches => {
        const updatedMarches = [];
        for (const march of prevMarches) {
          const isLeader = String(march.leader) === String(id);
          const isMember = march.members && march.members.map(String).includes(String(id));
          if (!isLeader && !isMember) { updatedMarches.push(march); continue; }
          let hasArrived = false;
          if (march.positions) {
            const minutes = Object.keys(march.positions).map(Number).sort((a, b) => a - b);
            let lastPos = null;
            for (const min of minutes) { if (min <= currentTime) lastPos = march.positions[min]; }
            if (lastPos && (lastPos.isGarrison || (lastPos.arrivalTime && lastPos.arrivalTime <= currentTime))) hasArrived = true;
          }
          if (hasArrived) {
            if (isLeader) {
              if (!march.members || march.members.length === 0) continue;
              let highestPowerMember = null;
              let maxPower = -1;
              march.members.forEach(memberId => {
                const player = activeDeployment.find(p => String(p.id) === String(memberId));
                if (player && player.power > maxPower) { maxPower = player.power; highestPowerMember = memberId; }
              });
              const newLeader = highestPowerMember || march.members[0];
              updatedMarches.push({ ...march, leader: newLeader, members: march.members.filter(mId => String(mId) !== String(newLeader)) });
            } else if (isMember) { updatedMarches.push({ ...march, members: march.members.filter(mId => String(mId) !== String(id)) }); }
          } else {
            if (isLeader) continue; else if (isMember) updatedMarches.push({ ...march, members: march.members.filter(mId => String(mId) !== String(id)) });
          }
        }
        return updatedMarches.filter(m => !(String(m.leader) === String(id) && m.marchType === 'rally_join'));
      });
      setDraftPositions(prev => {
        const newDrafts = { ...prev };
        Object.keys(newDrafts).forEach(draftId => { if (String(newDrafts[draftId].leader) === String(id) || draftId.startsWith(`${id}-`)) delete newDrafts[draftId]; });
        return newDrafts;
      });
    }
  };

  return {
    marches, setMarches, draftPositions, setDraftPositions,
    getCurrentPosition, handleDispatchMarch, handleConfirmMinute, handleCancelMinute,
    getAvailableMarches, handleHeal, handleCancelHeal, handleGarrisonAction, handleUpdatePosition, handleWithdraw
  };
};