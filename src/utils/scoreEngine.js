// src/utils/scoreEngine.js

export const calculateDynamicScores = (currentTime, activeDeployment, marches, manualCaptures, buildings, teamBase) => {
  let globalScores = { blue: 0, red: 0 };
  let buildingStats = {};

  // 1. Inizializzazione
  buildings.forEach(b => {
    buildingStats[String(b.id)] = {
      currentOwner: 'neutral',
      captureTime: b.unlockTime || 0,
      currentGracePeriod: 3.0,
      totalPoints: { blue: 0, red: 0 },
      firstCaptureAwarded: false
    };
  });

  // 2. Simulazione scorrere del tempo (Minuto per Minuto)
  for (let min = 0; min <= currentTime; min++) {
    
    // Mappiamo le presenze fisiche in questo minuto
    let presence = {};
    buildings.forEach(b => presence[String(b.id)] = { blue: 0, red: 0 });

    const checkEntityPresence = (entity) => {
      if (!entity.positions) return;
      const mins = Object.keys(entity.positions).map(Number).sort((a, b) => a - b);
      let lastPos = null;
      for (const m of mins) {
        if (m <= min) lastPos = entity.positions[m];
      }
      
      if (lastPos && !lastPos.removed && lastPos.targetBuildingId && (!lastPos.isMarching || lastPos.arrivalTime <= min)) {
        if (presence[String(lastPos.targetBuildingId)]) {
          presence[String(lastPos.targetBuildingId)][teamBase] += 1;
        }
      }
    };

    activeDeployment.forEach(checkEntityPresence);
    marches.forEach(checkEntityPresence);

    // Verifichiamo i cambi di fazione per ogni edificio
    buildings.forEach(b => {
      const bId = String(b.id);
      const state = buildingStats[bId];
      const pres = presence[bId];

      let newOwner = state.currentOwner;

      // Priorità 1: Catture/Ritirate manuali registrate al minuto attuale
      const mCap = manualCaptures.find(c => c.time === min && String(c.buildingId) === bId);
      
      if (mCap) {
        newOwner = mCap.team;
      } else {
        // Priorità 2: Valutazione Presenze Fisiche
        if (pres.blue > 0 && pres.red === 0) newOwner = 'blue';
        else if (pres.red > 0 && pres.blue === 0) newOwner = 'red';
        else if (pres.blue > 0 && pres.red > 0) newOwner = 'contested';
        // Priorità 3: Auto-Conquista del sistema (dopo 3 min dallo sblocco se vuoto)
        else if (min === (b.unlockTime || 0) + 3 && state.currentOwner === 'neutral') {
          newOwner = 'red';
        }
      }

      // Se cambia il proprietario logico
      if (state.currentOwner !== newOwner) {
        
        // Calcolo punti per il vecchio proprietario
        if (state.currentOwner === 'blue' || state.currentOwner === 'red') {
          const timeHeld = min - state.captureTime;
          const productiveTime = Math.max(0, timeHeld - state.currentGracePeriod);
          const sessionPoints = productiveTime * (b.pointsPerMin || 0);

          if (newOwner === 'contested' || newOwner === 'neutral') {
             // Diventa conteso o viene abbandonato: i punti vengono consolidati
             state.totalPoints[state.currentOwner] += sessionPoints;
          } else if (newOwner === 'blue' || newOwner === 'red') {
             // Cattura nemica: Furto del 50% dei punti maturati nella sessione
             const stolenPoints = sessionPoints * 0.5;
             const keptPoints = sessionPoints - stolenPoints;
             state.totalPoints[state.currentOwner] += keptPoints;
             state.totalPoints[newOwner] += stolenPoints;
          }
        }

        // Assegnazione Bonus Prima Occupazione (solo la prima volta in assoluto)
        if (!state.firstCaptureAwarded && (newOwner === 'blue' || newOwner === 'red')) {
          state.totalPoints[newOwner] += (b.firstControl || 0);
          state.firstCaptureAwarded = true;
        }

        // Aggiorna lo stato per il nuovo ciclo
        state.currentOwner = newOwner;
        state.captureTime = min;

        // Calcolo Dinamico del Grace Period
        if (newOwner === 'blue' || newOwner === 'red') {
          const stablesId = buildings.find(build => build.name.toLowerCase().includes('stables'))?.id;
          const btOwner = (stablesId && buildingStats[String(stablesId)]) ? buildingStats[String(stablesId)].currentOwner : 'neutral';
          // Se la squadra possiede le Scuderie, il grace period è dimezzato (1.5)
          state.currentGracePeriod = (btOwner === newOwner) ? 1.5 : 3.0;
        }
      }
    });
  } // Fine ciclo temporale minuto per minuto

  // 3. Consolidamento Finale per la GUI (Punti generati dal captureTime fino al currentTime attuale)
  buildings.forEach(b => {
    const state = buildingStats[String(b.id)];
    if (state.currentOwner === 'blue' || state.currentOwner === 'red') {
      const timeHeld = currentTime - state.captureTime;
      const productiveTime = Math.max(0, timeHeld - state.currentGracePeriod);
      const currentSessionPoints = productiveTime * (b.pointsPerMin || 0);
      
      state.totalPoints[state.currentOwner] += currentSessionPoints;
    }
    
    // Somma al tabellone globale
    globalScores.blue += state.totalPoints.blue;
    globalScores.red += state.totalPoints.red;
  });

  return globalScores;
};