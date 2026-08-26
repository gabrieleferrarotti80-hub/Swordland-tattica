import i18next from 'i18next';

export const calculateDynamicScores = (currentTime, activeDeployment, marches, manualCaptures, buildings, teamBase) => {
  let globalScores = { blue: 0, red: 0 };
  let buildingStats = {};
  let allLoot = [];
  
  const enemyTeam = teamBase === 'blue' ? 'red' : 'blue';

  const pseudoRandom = (seed) => {
    let x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };

  buildings.forEach(b => {
    buildingStats[String(b.id)] = {
      owner: 'neutral',          
      capturingTeam: null,       
      captureStart: -1,          
      captureProgress: 0,        
      sessionPoints: 0,          
      firstCaptureAwarded: false,
      totalPoints: { blue: 0, red: 0 } 
    };
  });

  for (let min = 0; min <= currentTime; min++) {
    let presence = {};
    buildings.forEach(b => presence[String(b.id)] = { blue: 0, red: 0 });

    const checkEntityPresence = (entity) => {
      if (!entity.positions) return;
      const mins = Object.keys(entity.positions).map(Number).sort((a, b) => a - b);
      let lastPos = null;
      for (const m of mins) { if (m <= min) lastPos = entity.positions[m]; }
      
      if (lastPos && !lastPos.removed && lastPos.targetBuildingId && (!lastPos.isMarching || lastPos.arrivalTime <= min)) {
        if (presence[String(lastPos.targetBuildingId)]) {
          presence[String(lastPos.targetBuildingId)][teamBase] += 1;
        }
      }
    };

    activeDeployment.forEach(checkEntityPresence);
    marches.forEach(checkEntityPresence);

    buildings.forEach(b => {
      const bId = String(b.id);
      const state = buildingStats[bId];
      const pres = presence[bId];

      if (min < (b.unlockTime || 0)) return;

      const mCap = manualCaptures.find(c => c.time === min && String(c.buildingId) === bId);
      if (mCap) {
        state.owner = mCap.team;
        state.capturingTeam = null;
        state.captureStart = -1;
        state.captureProgress = 0;
        state.sessionPoints = 0;
        if (!state.firstCaptureAwarded && (mCap.team === 'blue' || mCap.team === 'red')) {
          state.totalPoints[mCap.team] += (b.firstControl || 0);
          globalScores[mCap.team] += (b.firstControl || 0);
          state.firstCaptureAwarded = true;
        }
        return; 
      }

      let physicalControl = 'none';
      if (pres.blue > 0 && pres.red === 0) physicalControl = 'blue';
      else if (pres.red > 0 && pres.blue === 0) physicalControl = 'red';
      else if (pres.blue > 0 && pres.red > 0) physicalControl = 'contested';

      let effectiveControl = physicalControl === 'none' ? enemyTeam : physicalControl;

      if (effectiveControl === 'contested') {
         state.capturingTeam = null;
         state.captureStart = -1;
         state.captureProgress = 0;

      } else if (effectiveControl === state.owner) {
         state.capturingTeam = null;
         state.captureStart = -1;
         state.captureProgress = 0;
         state.sessionPoints += (b.pointsPerMin || 0);
         globalScores[state.owner] += (b.pointsPerMin || 0);

      } else {
         if (state.capturingTeam !== effectiveControl) {
             state.capturingTeam = effectiveControl;
             state.captureStart = min;
             state.captureProgress = 0;
         } else {
             state.captureProgress = min - state.captureStart; 
         }

         const bellTowerId = buildings.find(build => build.name?.toLowerCase().includes('bell tower'))?.id;
         const hasBuff = (bellTowerId && buildingStats[String(bellTowerId)].owner === state.capturingTeam);
         const reqMins = hasBuff ? 1.5 : 3.0; 

         if (state.captureProgress >= reqMins) {
             
             if (state.owner !== 'neutral') {
                const stolenPoints = Math.floor(state.sessionPoints / 2);
                globalScores[state.owner] -= stolenPoints; 
                
                state.totalPoints[state.owner] += (state.sessionPoints - stolenPoints);
                
                if (stolenPoints > 0) {
                    const numDrops = Math.min(5, stolenPoints);
                    const baseValue = Math.floor(stolenPoints / numDrops);
                    let remainder = stolenPoints % numDrops;

                    for (let dropIdx = 0; dropIdx < numDrops; dropIdx++) {
                        const dropValue = baseValue + (remainder > 0 ? 1 : 0);
                        remainder--;
                        
                        const seed = min + b.x + dropIdx * 10;
                        const angle = pseudoRandom(seed) * Math.PI * 2;
                        const radius = 15 + pseudoRandom(seed + 1) * 25; 
                        
                        const lx = Math.max(0, Math.min(240, b.x + Math.cos(angle) * radius));
                        const ly = Math.max(0, Math.min(240, b.y + Math.sin(angle) * radius));

                        const safeName = b.name || 'UNK';
                        const shortCode = safeName.substring(0, 3).toUpperCase();
                        const shortName = `${shortCode}-${dropIdx + 1}`;
                        
                        // 💡 MOTORE TRADUZIONI AGGANCIATO QUI
                        const fullName = i18next.t('hooks.loot_numbered', 'Bottino {{name}} #{{num}}', { name: safeName, num: dropIdx + 1 });

                        allLoot.push({
                          id: `loot_${bId}_${min}_${dropIdx}`,
                          name: fullName,           
                          shortName: shortName,     
                          x: lx, y: ly, value: dropValue, spawnTime: min,
                          gatheredBy: null, gatheredAt: null
                        });
                    }
                }
             }

             state.owner = state.capturingTeam;
             state.sessionPoints = 0;
             state.capturingTeam = null;
             state.captureStart = -1;
             state.captureProgress = 0;

             if (!state.firstCaptureAwarded) {
                 state.totalPoints[state.owner] += (b.firstControl || 0);
                 globalScores[state.owner] += (b.firstControl || 0);
                 state.firstCaptureAwarded = true;
             }
         }
      }
    });

    const checkGathering = (entity) => {
      if (!entity.positions) return;
      Object.values(entity.positions).forEach(pos => {
         if (pos.targetBuildingId && String(pos.targetBuildingId).startsWith('loot_')) {
           const arrTime = pos.arrivalTime !== undefined ? pos.arrivalTime : pos.startTime;
           if (arrTime > min - 1 && arrTime <= min) {
             const targetLoot = allLoot.find(l => l.id === String(pos.targetBuildingId));
             if (targetLoot && !targetLoot.gatheredBy && targetLoot.spawnTime <= arrTime) {
               targetLoot.gatheredBy = teamBase; 
               targetLoot.gatheredAt = arrTime;
               globalScores[teamBase] += targetLoot.value; 
             }
           }
         }
      });
    };

    activeDeployment.forEach(checkGathering);
    marches.forEach(checkGathering);
  } 

  buildings.forEach(b => {
    const state = buildingStats[String(b.id)];
    if (state.owner !== 'neutral') {
       state.totalPoints[state.owner] += state.sessionPoints; 
    }
  });

  return {
    scores: globalScores,
    lootDrops: allLoot.filter(l => !l.gatheredBy),
    buildingStates: buildingStats 
  };
};