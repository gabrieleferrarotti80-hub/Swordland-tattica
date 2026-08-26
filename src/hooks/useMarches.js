import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next'; // 🌍 Import i18n

const getBasePositionApp = (idStr, teamBase) => {
  let hash = 0;
  for (let i = 0; i < idStr.length; i++) { hash = idStr.charCodeAt(i) + ((hash << 5) - hash); }
  let r1 = Math.abs((Math.sin(hash) * 10000) % 1);
  let r2 = Math.abs((Math.cos(hash) * 10000) % 1);
  if (r1 + r2 > 1) { r1 = 1 - r1; r2 = 1 - r2; }

  if (teamBase === 'blue') {
    return { x: 0 + r1 * 38 + r2 * 39, y: 200 + r2 * 39 };
  } else {
    return { x: 200 + r2 * 39, y: 0 + r1 * 38 + r2 * 39 };
  }
};

export const useMarches = ({ roster, activeDeployment, setActiveDeployment, buildings, setBuildings, teamBase, currentTime, setManualCaptures, setHealingEvents }) => {
  const { t } = useTranslation(); // 🌍 Hook in azione
  
  const [marches, setMarches] = useState(() => {
    const saved = localStorage.getItem('swordland-marches');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [draftPositions, setDraftPositions] = useState({});

  useEffect(() => { localStorage.setItem('swordland-marches', JSON.stringify(marches)); }, [marches]);

  const getCurrentPosition = (entity) => {
    const draftPos = draftPositions[entity.id];
    if (draftPos) return draftPos;
    if (!entity.positions || Object.keys(entity.positions).length === 0) return null;

    const minutes = Object.keys(entity.positions).map(Number).sort((a, b) => a - b);
    let lastKnownPos = null;
    for (const min of minutes) { if (min <= currentTime) { lastKnownPos = entity.positions[min]; } }
    return lastKnownPos;
  };

  const getCityPosition = (playerId) => {
    const p = activeDeployment.find(x => String(x.id) === String(playerId));
    let lastStatic = null;
    if (p && p.positions) {
      const mins = Object.keys(p.positions).map(Number).sort((a,b) => a-b);
      for(const m of mins) { if (m <= currentTime) lastStatic = p.positions[m]; }
    }
    if (lastStatic && !lastStatic.removed && lastStatic.x !== undefined) return { x: lastStatic.x, y: lastStatic.y };
    
    return getBasePositionApp(playerId, teamBase);
  };

  const getAvailableMarches = (playerId) => {
    const player = activeDeployment.find(p => String(p.id) === String(playerId));
    if (!player) return 0;
    const rosterPlayer = roster.find(p => String(p.id) === String(playerId));
    const capacityRaw = player.marches !== undefined ? player.marches : (rosterPlayer ? rosterPlayer.marches : 1);
    const total = parseInt(capacityRaw, 10) || 1;
    let used = 0;

    marches.forEach(m => {
      if (m.marchType === 'rally_join') return; 

      const isLeader = String(m.leader) === String(playerId);
      const isMember = m.members && m.members.map(String).includes(String(playerId));

      if (isLeader || isMember) {
        if (!m.positions || Object.keys(m.positions).length === 0) { used++; return; }
        const minutes = Object.keys(m.positions).map(Number).sort((a, b) => a - b);
        
        let isActive = false;
        let isDestroyed = false;

        for (const min of minutes) { 
            if (min <= currentTime) { 
                isActive = true;
                if (m.positions[min].removed !== undefined) {
                    isDestroyed = m.positions[min].removed;
                }
            } 
        }
        if (isActive && !isDestroyed) { used++; }
      }
    });

    Object.values(draftPositions).forEach(draft => {
       if (!draft.isNewMarch) return;
       if (draft.marchType === 'rally_join') return; 

       const isLeader = String(draft.leader) === String(playerId);
       const isMember = draft.members && draft.members.map(String).includes(String(playerId));

       if (isLeader || isMember) {
           used++;
       }
    });

    return Math.max(0, total - used);
  };

  const handleDispatchMarch = (playerId, targetId, marchIndex, rawMarchType = 'attacco', members = [], membersData = [], externalTarget = null) => {
    const availableForLeader = getAvailableMarches(playerId);
    if (availableForLeader <= 0) return;

    let marchType = rawMarchType;
    let rallyTime = 4;
    if (rawMarchType === 'rally_1') { marchType = 'rally'; rallyTime = 1; }
    if (rawMarchType === 'rally_4') { marchType = 'rally'; rallyTime = 4; }

    let targetX, targetY, targetName;
    let targetBuilding = null;

    if (externalTarget) {
      targetX = externalTarget.x;
      targetY = externalTarget.y;
      targetName = externalTarget.name || t('hooks.loot', 'Bottino');
    } else {
      targetBuilding = buildings.find(b => String(b.id) === String(targetId));
      if (!targetBuilding) return;
      targetX = targetBuilding.x;
      targetY = targetBuilding.y;
      targetName = targetBuilding.name;
    }

    const leaderCoords = getCityPosition(playerId);
    const startX = leaderCoords.x;
    const startY = leaderCoords.y;

    const REFERENCE_POINTS = { blue: { x: 38, y: 200 }, red: { x: 200, y: 38 } };
    const dxPlayer = targetX - startX;
    const dyPlayer = targetY - startY;
    const playerToTargetDist = Math.sqrt(dxPlayer * dxPlayer + dyPlayer * dyPlayer);

    const refPoint = REFERENCE_POINTS[teamBase];
    const dxRef = targetX - refPoint.x;
    const dyRef = targetY - refPoint.y;
    const refToTargetDist = Math.sqrt(dxRef * dxRef + dyRef * dyRef);

    const baseTableTime = targetBuilding ? (teamBase === 'blue' ? (targetBuilding.travelTimeBlue || 60) : (targetBuilding.travelTimeRed || 60)) : 60;
    const speed = refToTargetDist / Math.max(1, baseTableTime);
    const travelTime = (playerToTargetDist / speed) / 60;

    const rallyDelay = marchType === 'rally' ? rallyTime : 0;
    const arrivalTime = currentTime + rallyDelay + travelTime;
    
    let returnTravelTime = 0;
    if (marchType === 'raccolta') {
       returnTravelTime = travelTime; 
    }

    const newDrafts = {};
    const leaderMarchId = `${playerId}-march-${Date.now()}-${marchIndex}`;
    
    newDrafts[leaderMarchId] = {
      isNewMarch: true, leader: playerId, members,
      startTime: currentTime + rallyDelay, rallyCallTime: currentTime,
      rallyTime: marchType === 'rally' ? rallyTime : null,
      startX, startY, targetX, targetY, removed: false,
      isMarching: travelTime > 0, isGarrison: marchType !== 'raccolta', targetName,
      targetBuildingId: targetId, arrivalTime, travelTime, marchType,
      autoReturn: marchType === 'raccolta', 
      returnTime: marchType === 'raccolta' ? arrivalTime + returnTravelTime : null,
      returnX: startX, returnY: startY
    };

    let validMembers = [];

    if (marchType === 'rally' && members.length > 0) {
      members.forEach((memberId, mIdx) => {
        if (getAvailableMarches(memberId) <= 0) return;
        validMembers.push(memberId);
        const memData = membersData.find(m => (typeof m === 'object' ? m.id : m) === memberId) || {};
        const speedupsUsed = typeof memData === 'object' ? (memData.speedups || 0) : 0;

        const memCoords = getCityPosition(memberId);
        const memStartX = memCoords.x;
        const memStartY = memCoords.y;

        const dxMem = startX - memStartX;
        const dyMem = startY - memStartY;
        const memToLeaderDist = Math.sqrt(dxMem * dxMem + dyMem * dyMem);
        
        let memTravelTime = (memToLeaderDist / speed) / 60;
        if (speedupsUsed > 0) memTravelTime = memTravelTime * Math.pow(0.75, speedupsUsed);
        
        if (memTravelTime > rallyTime && speedupsUsed > 0) memTravelTime = rallyTime - 0.01; 

        const memArrivalTime = currentTime + memTravelTime;
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

    newDrafts[leaderMarchId].members = validMembers;
    setDraftPositions(prev => ({ ...prev, ...newDrafts }));
  };

  const handleConfirmMinute = () => {
    const applyDraftToEntity = (entity) => {
      const draft = draftPositions[entity.id];
      if (!draft) return entity;
      const newPositions = { ...(entity.positions || {}) };
      
      if (draft.arrivalTime && draft.arrivalTime > currentTime) {
        if (draft.autoReturn) {
            newPositions[currentTime] = { isMarching: true, startTime: draft.startTime, startX: draft.startX, startY: draft.startY, targetX: draft.targetX, targetY: draft.targetY, targetName: draft.targetName, targetBuildingId: draft.targetBuildingId, arrivalTime: draft.arrivalTime, marchType: draft.marchType };
            newPositions[draft.arrivalTime] = { isMarching: true, startTime: draft.arrivalTime, startX: draft.targetX, startY: draft.targetY, targetX: draft.returnX, targetY: draft.returnY, arrivalTime: draft.returnTime, targetBuildingId: null, marchType: 'ritirata' };
            newPositions[draft.returnTime] = { removed: true };
        } 
        else if (draft.marchType === 'rally') {
            const rTime = draft.rallyTime || 4; 
            newPositions[currentTime] = { x: draft.startX, y: draft.startY, isGarrison: false, marchType: draft.marchType };
            newPositions[draft.rallyCallTime + rTime] = { isMarching: true, startTime: draft.startTime, startX: draft.startX, startY: draft.startY, targetX: draft.targetX, targetY: draft.targetY, targetName: draft.targetName, targetBuildingId: draft.targetBuildingId, arrivalTime: draft.arrivalTime, marchType: draft.marchType };
            newPositions[draft.arrivalTime] = { x: draft.targetX, y: draft.targetY, removed: false, isGarrison: draft.isGarrison, marchType: draft.marchType, targetBuildingId: draft.targetBuildingId };
        } else if (draft.marchType === 'rally_join') {
            newPositions[currentTime] = { isMarching: true, startTime: draft.startTime, startX: draft.startX, startY: draft.startY, targetX: draft.targetX, targetY: draft.targetY, arrivalTime: draft.arrivalTime, marchType: draft.marchType };
            newPositions[draft.arrivalTime] = { x: draft.targetX, y: draft.targetY, removed: true }; 
        } else {
            newPositions[currentTime] = { isMarching: true, startTime: draft.startTime, startX: draft.startX, startY: draft.startY, targetX: draft.targetX, targetY: draft.targetX, targetName: draft.targetName, targetBuildingId: draft.targetBuildingId, arrivalTime: draft.arrivalTime, marchType: draft.marchType };
            newPositions[draft.arrivalTime] = { x: draft.targetX, y: draft.targetY, removed: false, isGarrison: draft.isGarrison, marchType: draft.marchType, targetBuildingId: draft.targetBuildingId };
        }
      } else {
        newPositions[currentTime] = { x: draft.targetX || draft.x, y: draft.targetY || draft.y, removed: draft.removed || false, isGarrison: draft.isGarrison, marchType: draft.marchType, targetBuildingId: draft.targetBuildingId };
      }
      return { ...entity, positions: newPositions, marchType: draft.marchType || entity.marchType };
    };

    setActiveDeployment(prev => prev.map(applyDraftToEntity));
    
    setMarches(prevMarches => {
      let newMarchesToAdd = [];
      let updatedMarches = prevMarches.map(applyDraftToEntity);
      
      Object.entries(draftPositions).forEach(([id, draft]) => {
        if (draft.isNewMarch && !updatedMarches.find(m => String(m.id) === String(id))) {
          const newPositions = {};
          if (draft.arrivalTime && draft.arrivalTime > currentTime) {
            if (draft.autoReturn) {
               newPositions[currentTime] = { isMarching: true, startTime: draft.startTime, startX: draft.startX, startY: draft.startY, targetX: draft.targetX, targetY: draft.targetY, targetName: draft.targetName, targetBuildingId: draft.targetBuildingId, arrivalTime: draft.arrivalTime, marchType: draft.marchType };
               newPositions[draft.arrivalTime] = { isMarching: true, startTime: draft.arrivalTime, startX: draft.targetX, startY: draft.targetY, targetX: draft.returnX, targetY: draft.returnY, arrivalTime: draft.returnTime, targetBuildingId: null, marchType: 'ritirata' };
               newPositions[draft.returnTime] = { removed: true };
            } 
            else if (draft.marchType === 'rally') {
                const rTime = draft.rallyTime || 4; 
                newPositions[currentTime] = { x: draft.startX, y: draft.startY, isGarrison: false, marchType: draft.marchType };
                newPositions[draft.rallyCallTime + rTime] = { isMarching: true, startTime: draft.startTime, startX: draft.startX, startY: draft.startY, targetX: draft.targetX, targetY: draft.targetY, targetName: draft.targetName, targetBuildingId: draft.targetBuildingId, arrivalTime: draft.arrivalTime, marchType: draft.marchType };
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
    if (!window.confirm(t('hooks.confirm_heal', "Confermi di voler mandare in cura questo giocatore?"))) return;
    setActiveDeployment(prev => prev.map(p => String(p.id) === String(playerId) ? { ...p, positions: { ...(p.positions || {}), [currentTime]: { removed: true } } } : p));
    setMarches(prevMarches => {
      const updatedMarches = [];
      for (const march of prevMarches) {
        const isLeader = String(march.leader) === String(playerId);
        const isMember = march.members && march.members.map(String).includes(String(playerId));
        if (!isLeader && !isMember) { updatedMarches.push(march); continue; }
        updatedMarches.push({ ...march, members: march.members.filter(mId => String(mId) !== String(playerId)) });
      }
      return updatedMarches.filter(m => !(String(m.leader) === String(playerId) && m.marchType === 'rally_join'));
    });
    setDraftPositions({});
    setHealingEvents(prev => ({ ...prev, [playerId]: currentTime }));
  };
  
  const handleCancelHeal = (e, playerId) => { e.stopPropagation(); setHealingEvents(prev => { const newHeals = { ...prev }; delete newHeals[playerId]; return newHeals; }); };
  
  const handleGarrisonAction = (actionType, buildingId, targetPlayerId = null) => {
    const isDefeat = actionType === 'defeat';
    const building = buildings.find(b => String(b.id) === String(buildingId));
    if (!building) return;

    const baseTableTime = teamBase === 'blue' ? (building.travelTimeBlue || 60) : (building.travelTimeRed || 60);

    const processEntityRetreat = (entity, isMarch) => {
      const pos = getCurrentPosition(entity);
      if (pos && !pos.removed && !pos.isMarching && String(pos.targetBuildingId) === String(buildingId)) {
        
        const entId = isMarch ? String(entity.leader) : String(entity.id);
        if (targetPlayerId && entId !== String(targetPlayerId)) return entity; 

        const startX = pos.x;
        const startY = pos.y;
        
        let targetBase = getCityPosition(entId);
        
        if (Math.abs(targetBase.x - startX) < 0.1 && Math.abs(targetBase.y - startY) < 0.1) {
            targetBase = getBasePositionApp(entId, teamBase);
        }
        
        const dx = startX - targetBase.x;
        const dy = startY - targetBase.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        const REFERENCE_POINTS = { blue: { x: 38, y: 200 }, red: { x: 200, y: 38 } };
        const dxRef = startX - REFERENCE_POINTS[teamBase].x;
        const dyRef = startY - REFERENCE_POINTS[teamBase].y;
        const refDist = Math.sqrt(dxRef * dxRef + dyRef * dyRef);
        
        const speed = refDist / Math.max(1, baseTableTime);
        const travelTime = (dist / speed) / 60;
        
        const returnTime = currentTime + travelTime;

        const newPositions = { ...(entity.positions || {}) };
        
        newPositions[currentTime] = { 
            isMarching: true, 
            startTime: currentTime, 
            startX: startX, startY: startY, 
            targetX: targetBase.x, targetY: targetBase.y, 
            arrivalTime: returnTime, 
            targetBuildingId: null, 
            marchType: 'ritirata' 
        };
        
        if (isMarch) {
            newPositions[returnTime] = { removed: true };
        } else {
            newPositions[returnTime] = { x: targetBase.x, y: targetBase.y, removed: false, isGarrison: false, targetBuildingId: null };
        }

        return { ...entity, positions: newPositions, marchType: 'ritirata' };
      }
      return entity;
    };

    if (window.confirm(isDefeat ? t('hooks.confirm_defeat', "Confermi di voler cedere {{building}}? Le truppe torneranno ai propri segnalini.", { building: building.name }) : t('hooks.confirm_withdraw', "Confermi di voler RITIRARE le truppe da {{building}}?", { building: building.name }))) {
       setActiveDeployment(prev => prev.map(p => processEntityRetreat(p, false)));
       setMarches(prev => prev.map(m => processEntityRetreat(m, true)));
    }
  };

  const handleUpdatePosition = (dragData, newX, newY) => {
     const [type, id] = dragData.split(':');
     if (type === 'building') { 
         setBuildings(prev => prev.map(b => String(b.id) === String(id) ? { ...b, x: newX, y: newY } : b)); 
     }
     else if (type === 'player') {
       setActiveDeployment(prev => prev.map(p => {
           if (String(p.id) === String(id)) {
               return { 
                   ...p, 
                   positions: { 
                       ...(p.positions || {}), 
                       [currentTime]: { x: newX, y: newY, removed: false, isGarrison: false, targetBuildingId: null } 
                   } 
               };
           }
           return p;
       }));

       setMarches(prev => prev.map(m => {
           if (String(m.leader) === String(id)) {
               return { ...m, positions: { ...(m.positions || {}), [currentTime]: { removed: true } } };
           }
           if (m.members && m.members.map(String).includes(String(id))) {
               return { ...m, members: m.members.filter(mId => String(mId) !== String(id)) };
           }
           return m;
       }));

       setDraftPositions(prev => {
          const newDrafts = { ...prev };
          Object.keys(newDrafts).forEach(draftId => {
              if (String(newDrafts[draftId].leader) === String(id)) {
                  delete newDrafts[draftId];
              }
          });
          return newDrafts;
       });
     }
  };

  return { marches, setMarches, draftPositions, setDraftPositions, getCurrentPosition, handleDispatchMarch, handleConfirmMinute, handleCancelMinute, getAvailableMarches, handleHeal, handleCancelHeal, handleGarrisonAction, handleUpdatePosition, handleWithdraw };
};