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

export const useMarches = (activeDeployment, setActiveDeployment, buildings, teamBase, currentTime) => {
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

  const getCoordForEntity = (playerId) => {
    const playerEntity = activeDeployment.find(p => String(p.id) === String(playerId));
    const playerPos = getCurrentPosition({ id: playerId, positions: playerEntity?.positions });
    
    if (!playerPos || playerPos.removed) {
      return getBasePositionApp(String(playerId), teamBase);
    }
    
    if (playerPos.isMarching && playerPos.startTime !== undefined && playerPos.arrivalTime !== undefined) {
      if (currentTime >= playerPos.arrivalTime) return { x: playerPos.targetX, y: playerPos.targetY };
      if (currentTime <= playerPos.startTime) return { x: playerPos.startX, y: playerPos.startY };
      const progress = (currentTime - playerPos.startTime) / (playerPos.arrivalTime - playerPos.startTime);
      return {
        x: playerPos.startX + (playerPos.targetX - playerPos.startX) * progress,
        y: playerPos.startY + (playerPos.targetY - playerPos.startY) * progress
      };
    }
    
    return { 
      x: playerPos.x !== undefined ? playerPos.x : playerPos.targetX, 
      y: playerPos.y !== undefined ? playerPos.y : playerPos.targetY 
    };
  };

  // Aggiunto il parametro "membersData" (sesto parametro) per ricevere gli speedup
  const handleDispatchMarch = (playerId, targetBuildingId, marchIndex, marchType = 'attacco', members = [], membersData = []) => {
    const targetBuilding = buildings.find(b => String(b.id) === String(targetBuildingId));
    if (!targetBuilding) return;

    const leaderCoords = getCoordForEntity(playerId);
    const startX = leaderCoords.x;
    const startY = leaderCoords.y;

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
    
    const newDrafts = {};

    const leaderMarchId = `${playerId}-march-${Date.now()}-${marchIndex}`;
    newDrafts[leaderMarchId] = {
      isNewMarch: true, leader: playerId, 
      members,
      startTime: currentTime + rallyDelay,
      rallyCallTime: currentTime,
      startX, startY,
      targetX: targetBuilding.x, targetY: targetBuilding.y, removed: false,
      isMarching: travelTime > 0, isGarrison: true, targetName: targetBuilding.name,
      targetBuildingId: targetBuilding.id, arrivalTime, travelTime, marchType
    };

    if (marchType === 'rally' && members.length > 0) {
      members.forEach((memberId, mIdx) => {
        // Recuperiamo gli speedup associati al singolo membro
        const memData = membersData.find(m => (typeof m === 'object' ? m.id : m) === memberId) || {};
        const speedupsUsed = typeof memData === 'object' ? (memData.speedups || 0) : 0;

        const memCoords = getCoordForEntity(memberId);
        const memStartX = memCoords.x;
        const memStartY = memCoords.y;

        const dxMem = startX - memStartX;
        const dyMem = startY - memStartY;
        const memToLeaderDist = Math.sqrt(dxMem * dxMem + dyMem * dyMem);
        
        let memTravelTime = (memToLeaderDist / speed) / 60;

        // Applicazione del bonus di velocità dello Speedup (-25% per stack)
        if (speedupsUsed > 0) {
           memTravelTime = memTravelTime * Math.pow(0.75, speedupsUsed);
        }

        // Allineamento millimetrico per evitare sfasamenti coi 4 minuti del leader
        if (memTravelTime > 4.0 && speedupsUsed > 0) {
            memTravelTime = 3.99; 
        }

        const memArrivalTime = currentTime + memTravelTime;

        const memberMarchId = `${memberId}-march-${Date.now()}-join-${mIdx}`;
        newDrafts[memberMarchId] = {
          isNewMarch: true, 
          leader: memberId, 
          members: [], 
          startTime: currentTime, 
          startX: memStartX, startY: memStartY,
          targetX: startX, targetY: startY, 
          removed: true, 
          isMarching: true, isGarrison: false,
          targetBuildingId: null, 
          arrivalTime: memArrivalTime, travelTime: memTravelTime, 
          marchType: 'rally_join',
          speedupsUsed
        };
      });
    }

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
            newPositions[draft.rallyCallTime + 4] = {
              isMarching: true, startTime: draft.startTime, startX: draft.startX, startY: draft.startY,
              targetX: draft.targetX, targetY: draft.targetY, targetName: draft.targetName,
              targetBuildingId: draft.targetBuildingId, arrivalTime: draft.arrivalTime, marchType: draft.marchType
            };
            newPositions[draft.arrivalTime] = { x: draft.targetX, y: draft.targetY, removed: false, isGarrison: draft.isGarrison, marchType: draft.marchType, targetBuildingId: draft.targetBuildingId };
        } else if (draft.marchType === 'rally_join') {
            newPositions[currentTime] = {
              isMarching: true, startTime: draft.startTime, startX: draft.startX, startY: draft.startY,
              targetX: draft.targetX, targetY: draft.targetY, arrivalTime: draft.arrivalTime, marchType: draft.marchType
            };
            newPositions[draft.arrivalTime] = { x: draft.targetX, y: draft.targetY, removed: true }; 
        } else {
            newPositions[currentTime] = {
              isMarching: true, startTime: draft.startTime, startX: draft.startX, startY: draft.startY,
              targetX: draft.targetX, targetY: draft.targetY, targetName: draft.targetName,
              targetBuildingId: draft.targetBuildingId, arrivalTime: draft.arrivalTime, marchType: draft.marchType
            };
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
                newPositions[draft.rallyCallTime + 4] = {
                  isMarching: true, startTime: draft.startTime, startX: draft.startX, startY: draft.startY,
                  targetX: draft.targetX, targetY: draft.targetY, targetName: draft.targetName,
                  targetBuildingId: draft.targetBuildingId, arrivalTime: draft.arrivalTime, marchType: draft.marchType
                };
                newPositions[draft.arrivalTime] = { x: draft.targetX, y: draft.targetY, removed: false, isGarrison: draft.isGarrison, marchType: draft.marchType, targetBuildingId: draft.targetBuildingId };
            } else if (draft.marchType === 'rally_join') {
                newPositions[currentTime] = {
                  isMarching: true, startTime: draft.startTime, startX: draft.startX, startY: draft.startY,
                  targetX: draft.targetX, targetY: draft.targetY, arrivalTime: draft.arrivalTime, marchType: draft.marchType
                };
                newPositions[draft.arrivalTime] = { x: draft.targetX, y: draft.targetY, removed: true };
            } else {
                newPositions[currentTime] = {
                  isMarching: true, startTime: draft.startTime, startX: draft.startX, startY: draft.startY,
                  targetX: draft.targetX, targetY: draft.targetY, targetName: draft.targetName,
                  targetBuildingId: draft.targetBuildingId, arrivalTime: draft.arrivalTime, marchType: draft.marchType
                };
                newPositions[draft.arrivalTime] = { x: draft.targetX, y: draft.targetY, removed: false, isGarrison: draft.isGarrison, marchType: draft.marchType, targetBuildingId: draft.targetBuildingId };
            }
          } else {
            newPositions[currentTime] = { x: draft.targetX, y: draft.targetY, removed: draft.removed || false, isGarrison: draft.isGarrison, marchType: draft.marchType, targetBuildingId: draft.targetBuildingId };
          }
          
          newMarchesToAdd.push({ 
            id, 
            leader: draft.leader, 
            members: draft.members || [], 
            positions: newPositions, 
            marchType: draft.marchType,
            speedupsUsed: draft.speedupsUsed || 0
          });
        }
      });
      return [...updatedMarches, ...newMarchesToAdd];
    });
    setDraftPositions({});
  };

  const handleCancelMinute = () => setDraftPositions({});

  return {
    marches, setMarches, draftPositions, setDraftPositions,
    getCurrentPosition, handleDispatchMarch, handleConfirmMinute, handleCancelMinute
  };
};