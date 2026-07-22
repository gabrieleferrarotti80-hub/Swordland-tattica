// src/utils/scoreEngine.js

export const calculateDynamicScores = (currentTime, marchEvents, buildings) => {
  let globalScores = { blue: 0, red: 0 };
  let buildingStats = {};

  // 1. Inizializzazione: Tutti gli edifici partono NEUTRALI con tracciamento presenze
  buildings.forEach(b => {
    buildingStats[String(b.id)] = {
      currentOwner: 'neutral',
      captureTime: b.unlockTime || 0,
      firstCaptureAwarded: false,
      currentGracePeriod: 3.0, 
      totalPoints: { blue: 0, red: 0 },
      presence: { blue: 0, red: 0 } //[cite: 1]
    };
  });

  // 2. Creazione "Eventi Sintetici" per l'Auto-Conquista
  let allEvents = [...marchEvents.map(e => ({ ...e, isAutoCapture: false }))];
  
  buildings.forEach(b => {
    const unlock = b.unlockTime || 0;
    allEvents.push({
      targetBuildingId: String(b.id),
      arrivalTime: unlock + 3, 
      team: 'red',             
      isAutoCapture: true
    });
  });

  allEvents.sort((a, b) => {
    if (a.arrivalTime === b.arrivalTime) {
      return (a.isAutoCapture ? 1 : 0) - (b.isAutoCapture ? 1 : 0);
    }
    return a.arrivalTime - b.arrivalTime;
  });

  // 3. Processamento storico
  allEvents.forEach(event => {
    if (event.arrivalTime > currentTime) return;

    const bId = String(event.targetBuildingId);
    const bData = buildings.find(b => String(b.id) === bId);
    if (!bData) return; 

    const state = buildingStats[bId];

    // Se è una marcia reale ma arriva PRIMA dello sblocco, ignorala
    if (!event.isAutoCapture && event.arrivalTime < (bData.unlockTime || 0)) {
      return;
    }

    // Aggiorna il numero di giocatori presenti nell'edificio[cite: 1]
    if (!event.isAutoCapture) {
       state.presence[event.team] += 1;
    } else {
       // L'auto-cattura agisce solo se l'edificio è neutrale e completamente vuoto[cite: 1]
       if (state.currentOwner !== 'neutral' || state.presence.blue > 0 || state.presence.red > 0) return;
    }

    // Determina il nuovo proprietario logico in base alla presenza simultanea
    let newOwner = state.currentOwner;
    if (state.presence.blue > 0 && state.presence.red === 0) newOwner = 'blue';
    else if (state.presence.red > 0 && state.presence.blue === 0) newOwner = 'red';
    else if (state.presence.blue > 0 && state.presence.red > 0) newOwner = 'contested';
    else if (event.isAutoCapture) newOwner = event.team; 

    // Se l'edificio cambia proprietario (Cattura reale, Auto-Cattura, o diventa Conteso)
    if (state.currentOwner !== newOwner) {
      
      if (state.currentOwner === 'blue' || state.currentOwner === 'red') {
        const timeHeld = event.arrivalTime - state.captureTime;
        const productiveTime = Math.max(0, timeHeld - state.currentGracePeriod);
        const sessionPoints = productiveTime * (bData.pointsPerMin || 0);

        if (newOwner === 'contested') {
           // Se l'edificio diventa conteso, i punti generati finora si consolidano al proprietario
           state.totalPoints[state.currentOwner] += sessionPoints;
        } else {
           // Furto punti
           const stolenPoints = sessionPoints * 0.5;
           const keptPoints = sessionPoints - stolenPoints;
           state.totalPoints[state.currentOwner] += keptPoints;
           state.totalPoints[event.team] += stolenPoints;
        }
      }

      // Assegnazione Bonus Prima Occupazione (ignorando lo stato di contesa temporaneo)
      if (!state.firstCaptureAwarded && (newOwner === 'blue' || newOwner === 'red')) {
        state.totalPoints[newOwner] += (bData.firstControl || 0);
        state.firstCaptureAwarded = true;
      }

      // Aggiorna la proprietà
      state.currentOwner = newOwner;
      state.captureTime = event.arrivalTime;
      
      // Calcolo del Grace Period solo in caso di controllo totale (non conteso)[cite: 1]
      if (newOwner === 'blue' || newOwner === 'red') {
        const btOwner = buildingStats['bell-tower'] ? buildingStats['bell-tower'].currentOwner : 'neutral';
        state.currentGracePeriod = (btOwner === newOwner) ? 1.5 : 3.0;
      }
    }
  });

  // 4. Calcolo Punti in Corso (Fino alla posizione attuale della barra del tempo)
  buildings.forEach(b => {
    const state = buildingStats[String(b.id)];
    
    // I punti si generano solo se c'è un proprietario netto (no neutral, no contested)
    if (currentTime > state.captureTime && (state.currentOwner === 'blue' || state.currentOwner === 'red')) {
      const timeHeld = currentTime - state.captureTime;
      const productiveTime = Math.max(0, timeHeld - state.currentGracePeriod);
      const currentSessionPoints = productiveTime * (b.pointsPerMin || 0);

      state.totalPoints[state.currentOwner] += currentSessionPoints;
    }

    // Somma finale
    globalScores.blue += state.totalPoints.blue;
    globalScores.red += state.totalPoints.red;
  });

  return globalScores;
};