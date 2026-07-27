// mapUtils.js

export const getBasePosition = (idStr, teamBase) => {
  let hash = 0;
  for (let i = 0; i < idStr.length; i++) { hash = idStr.charCodeAt(i) + ((hash << 5) - hash); }
  
  let r1 = Math.abs((Math.sin(hash) * 10000) % 1);
  let r2 = Math.abs((Math.cos(hash) * 10000) % 1);
  
  // Confina i punti all'interno del triangolo (Coordinate Baricentriche)
  if (r1 + r2 > 1) {
    r1 = 1 - r1;
    r2 = 1 - r2;
  }

  if (teamBase === 'blue') {
    // Vertici Blu: (0, 200), (38, 200), (39, 239)
    const x = 0 + r1 * (38 - 0) + r2 * (39 - 0);
    const y = 200 + r1 * (200 - 200) + r2 * (239 - 200);
    return { x, y };
  } else {
    // Vertici Rosso: (200, 0), (200, 38), (239, 39)
    const x = 200 + r1 * (200 - 200) + r2 * (239 - 200);
    const y = 0 + r1 * (38 - 0) + r2 * (39 - 0);
    return { x, y };
  }
};

export const checkIsAtBuilding = (x, y, buildingsArray) => {
  if (x == null || y == null) return null;
  const bMatch = buildingsArray.find(b => 
    b.x != null && b.y != null && 
    Math.sqrt(Math.pow(Number(x) - Number(b.x), 2) + Math.pow(Number(y) - Number(b.y), 2)) < 5
  );
  return bMatch ? bMatch.id : null;
};

export const isMarchGathering = (marchEntity, currentTime) => {
  if (marchEntity.isDraft) return true;
  if (marchEntity.positions) {
    const movePos = Object.values(marchEntity.positions).find(p => p.startTime !== undefined);
    if (movePos && currentTime < Number(movePos.startTime)) return true;
  }
  return false;
};

export const getEntityDisplayState = (entity, currentTime, draftPositions, healingEvents, teamBase, buildings) => {
  const isPlayer = entity.type === 'player';
  const healStart = isPlayer ? healingEvents[entity.id] : undefined;
  const isHealing = healStart !== undefined && currentTime >= healStart && currentTime < healStart + 12;

  if (isHealing) {
    const base = getBasePosition(entity.id, teamBase);
    return { isVisible: true, x: base.x, y: base.y, isHealing: true, isGarrisoned: false, marchType: 'attacco' };
  }

  const draftPos = draftPositions[entity.id];
  let posToUse = null;
  const isDraftForNewMarch = draftPos && draftPos.isNewMarch;

  if (draftPos && !(isPlayer && isDraftForNewMarch)) {
    if (draftPos.startTime !== undefined && draftPos.arrivalTime !== undefined) {
       if (draftPos.startTime <= currentTime && currentTime <= draftPos.arrivalTime) {
         posToUse = draftPos;
       } else if (currentTime > draftPos.arrivalTime) {
         posToUse = { ...draftPos, x: draftPos.targetX, y: draftPos.targetY };
       } else {
         posToUse = draftPos;
       }
    } else {
       posToUse = draftPos;
    }
  } else {
    if (entity.positions) {
      const minutes = Object.keys(entity.positions).map(Number).sort((a, b) => a - b);
      let activeStartMin = null;
      for (const min of minutes) {
        if (min <= currentTime) activeStartMin = min;
        else break;
      }
      if (activeStartMin !== null) posToUse = entity.positions[activeStartMin];
    }
  }

  if (!posToUse && isPlayer) {
    const base = getBasePosition(entity.id, teamBase);
    return { isVisible: true, x: base.x, y: base.y, isHealing: false, isGarrisoned: false, marchType: 'attacco' };
  }

  if (!posToUse || posToUse.removed) return { isVisible: false };

  const derivedMarchType = posToUse.marchType || entity.marchType || 'attacco';
  let targetBuildingId = posToUse.targetBuildingId;
  const startNum = posToUse.startTime !== undefined ? Number(posToUse.startTime) : null;
  const arrNum = posToUse.arrivalTime !== undefined ? Number(posToUse.arrivalTime) : null;
  const currentNum = Number(currentTime);

  const isActuallyMarching = startNum !== null && arrNum !== null;

  if (isActuallyMarching) {
    if (currentNum >= arrNum) {
      return { 
        isVisible: true, 
        x: Number(posToUse.targetX), 
        y: Number(posToUse.targetY), 
        isHealing: false, 
        isMarching: false,
        isGarrisoned: !!targetBuildingId, 
        targetBuildingId, 
        marchType: derivedMarchType 
      };
    } else if (currentNum <= startNum) {
      return {
        isVisible: true,
        x: Number(posToUse.startX),
        y: Number(posToUse.startY),
        isHealing: false,
        isMarching: true,
        startX: Number(posToUse.startX),
        startY: Number(posToUse.startY),
        targetX: Number(posToUse.targetX),
        targetY: Number(posToUse.targetY),
        isGarrisoned: false,
        targetBuildingId,
        marchType: derivedMarchType,
        startTime: startNum
      };
    } else {
      const totalTime = arrNum - startNum;
      const progress = (currentNum - startNum) / totalTime;
      const startX = Number(posToUse.startX);
      const startY = Number(posToUse.startY);
      const targetX = Number(posToUse.targetX);
      const targetY = Number(posToUse.targetY);
      
      const x = startX + (targetX - startX) * progress;
      const y = startY + (targetY - startY) * progress;
      return { 
        isVisible: true, 
        x, y, 
        isHealing: false,
        isMarching: true, 
        startX, startY, targetX, targetY,
        isGarrisoned: false,
        targetBuildingId,
        marchType: derivedMarchType
      };
    }
  }

  const finalX = posToUse.x !== undefined ? Number(posToUse.x) : Number(posToUse.targetX);
  const finalY = posToUse.y !== undefined ? Number(posToUse.y) : Number(posToUse.targetY);

  if (isNaN(finalX) || isNaN(finalY)) {
    const base = getBasePosition(entity.id, teamBase);
    return { isVisible: true, x: base.x, y: base.y, isHealing: false, isGarrisoned: false, marchType: derivedMarchType };
  }

  if (!targetBuildingId) {
    targetBuildingId = checkIsAtBuilding(finalX, finalY, buildings);
  }

  return { 
    isVisible: true, 
    x: finalX, 
    y: finalY, 
    isHealing: false, 
    isMarching: false,
    isGarrisoned: !!targetBuildingId,
    targetBuildingId,
    marchType: derivedMarchType 
  };
};