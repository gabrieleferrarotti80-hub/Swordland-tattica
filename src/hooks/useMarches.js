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

  const handleDispatchMarch = (playerId, targetBuildingId, marchIndex, marchType = 'attacco') => {
    const playerEntity = activeDeployment.find(p => String(p.id) === String(playerId));
    const playerPos = getCurrentPosition({ id: playerId, positions: playerEntity?.positions });
    const targetBuilding = buildings.find(b => String(b.id) === String(targetBuildingId));
    
    if (!targetBuilding) return;

    const REFERENCE_POINTS = { blue: { x: 16, y: 50 }, red: { x: 84, y: 50 } };
    let startX, startY;
    let travelTime;

    if (!playerPos || playerPos.removed) {
      const basePos = getBasePositionApp(String(playerId), teamBase);
      startX = basePos.x; startY = basePos.y;
    } else {
      if (playerPos.isMarching && playerPos.startTime !== undefined && playerPos.arrivalTime !== undefined) {
          if (currentTime >= playerPos.arrivalTime) { startX = playerPos.targetX; startY = playerPos.targetY; } 
          else if (currentTime <= playerPos.startTime) { startX = playerPos.startX; startY = playerPos.startY; } 
          else {
              const progress = (currentTime - playerPos.startTime) / (playerPos.arrivalTime - playerPos.startTime);
              startX = playerPos.startX + (playerPos.targetX - playerPos.startX) * progress;
              startY = playerPos.startY + (playerPos.targetY - playerPos.startY) * progress;
          }
      } else {
          startX = playerPos.x !== undefined ? playerPos.x : playerPos.targetX;
          startY = playerPos.y !== undefined ? playerPos.y : playerPos.targetY;
      }
    }

    const dxPlayer = targetBuilding.x - startX;
    const dyPlayer = targetBuilding.y - startY;
    const playerToTargetDist = Math.sqrt(dxPlayer * dxPlayer + dyPlayer * dyPlayer);

    const refPoint = REFERENCE_POINTS[teamBase];
    const dxRef = targetBuilding.x - refPoint.x;
    const dyRef = targetBuilding.y - refPoint.y;
    const refToTargetDist = Math.sqrt(dxRef * dxRef + dyRef * dyRef);

    const tableTimeSec = teamBase === 'blue' ? (targetBuilding.travelTimeBlue || 60) : (targetBuilding.travelTimeRed || 60);

    if (!playerPos || playerPos.removed) {
      travelTime = tableTimeSec / 60;
    } else {
      const speed = refToTargetDist / Math.max(1, tableTimeSec);
      travelTime = (playerToTargetDist / speed) / 60;
    }

    const arrivalTime = currentTime + travelTime;
    
    // CORREZIONE CRITICA: Aggiunto Date.now() per garantire ID strutturalmente univoci
    const marchId = `${playerId}-march-${Date.now()}-${marchIndex}`;

    setDraftPositions(prev => ({
      ...prev,
      [marchId]: {
        isNewMarch: true, leader: playerId, startTime: currentTime, startX, startY,
        targetX: targetBuilding.x, targetY: targetBuilding.y, removed: false,
        isMarching: travelTime > 0, isGarrison: true, targetName: targetBuilding.name,
        targetBuildingId: targetBuilding.id, arrivalTime, travelTime, marchType
      }
    }));
  };

  const handleConfirmMinute = () => {
    let newMarchesToAdd = [];

    const applyDraftToEntity = (entity) => {
      const draft = draftPositions[entity.id];
      if (!draft) return entity;
      const newPositions = { ...(entity.positions || {}) };
      
      if (draft.arrivalTime && draft.arrivalTime > currentTime) {
        newPositions[currentTime] = {
          isMarching: true, startTime: draft.startTime, startX: draft.startX, startY: draft.startY,
          targetX: draft.targetX, targetY: draft.targetY, targetName: draft.targetName,
          targetBuildingId: draft.targetBuildingId, arrivalTime: draft.arrivalTime, marchType: draft.marchType
        };
        newPositions[draft.arrivalTime] = { x: draft.targetX, y: draft.targetY, removed: false, isGarrison: draft.isGarrison, marchType: draft.marchType, targetBuildingId: draft.targetBuildingId };
      } else {
        newPositions[currentTime] = { x: draft.targetX || draft.x, y: draft.targetY || draft.y, removed: draft.removed, isGarrison: draft.isGarrison, marchType: draft.marchType, targetBuildingId: draft.targetBuildingId };
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
            newPositions[currentTime] = {
              isMarching: true, startTime: draft.startTime, startX: draft.startX, startY: draft.startY,
              targetX: draft.targetX, targetY: draft.targetY, targetName: draft.targetName,
              targetBuildingId: draft.targetBuildingId, arrivalTime: draft.arrivalTime, marchType: draft.marchType
            };
            newPositions[draft.arrivalTime] = { x: draft.targetX, y: draft.targetY, removed: false, isGarrison: draft.isGarrison, marchType: draft.marchType, targetBuildingId: draft.targetBuildingId };
          } else {
            newPositions[currentTime] = { x: draft.targetX, y: draft.targetY, removed: draft.removed, isGarrison: draft.isGarrison, marchType: draft.marchType, targetBuildingId: draft.targetBuildingId };
          }
          newMarchesToAdd.push({ id, leader: draft.leader, members: [], positions: newPositions, marchType: draft.marchType });
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