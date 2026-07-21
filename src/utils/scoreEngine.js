export const calculateDynamicScores = (currentTime, marchEvents, buildings) => {
  let globalScores = { blue: 0, red: 0 };
  let buildingStats = {};

  // 1. Inizializzazione: Tutti gli edifici partono NEUTRALI
  buildings.forEach(b => {
    buildingStats[String(b.id)] = {
      currentOwner: 'neutral',
      captureTime: b.unlockTime || 0,
      firstCaptureAwarded: false,
      currentGracePeriod: 3.0, // Di default 3 minuti
      totalPoints: { blue: 0, red: 0 }
    };
  });

  // 2. Creazione "Eventi Sintetici" per l'Auto-Conquista
  let allEvents = [...marchEvents.map(e => ({ ...e, isAutoCapture: false }))];
  
  buildings.forEach(b => {
    const unlock = b.unlockTime || 0;
    allEvents.push({
      targetBuildingId: String(b.id),
      arrivalTime: unlock + 3, // Regola: Diventa rosso 3 minuti dopo lo sblocco
      team: 'red',             // La "squadra avversaria" di default
      isAutoCapture: true
    });
  });

  // Ordine cronologico. In caso di parità, le marce reali (isAutoCapture: false) 
  // hanno la precedenza sull'auto-cattura.
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

    // --- REGOLA DEL NEUTRALE (AUTO-CATTURA) ---
    if (event.isAutoCapture) {
      // Se al minuto 3 l'edificio NON è più neutrale (è stato preso da qualcuno), annulla l'auto-cattura
      if (state.currentOwner !== 'neutral') return;
    } 
    // Se è una marcia reale ma arriva PRIMA dello sblocco, ignorala
    else if (event.arrivalTime < (bData.unlockTime || 0)) {
      return;
    }

    // Se l'edificio cambia proprietario (Cattura reale o Auto-Cattura)
    if (state.currentOwner !== event.team) {
      
      // Calcolo punti se si sta rubando a un nemico (escluso il neutrale)
      if (state.currentOwner !== 'neutral') {
        const timeHeld = event.arrivalTime - state.captureTime;
        const productiveTime = Math.max(0, timeHeld - state.currentGracePeriod);
        const sessionPoints = productiveTime * (bData.pointsPerMin || 0);

        const stolenPoints = sessionPoints * 0.5;
        const keptPoints = sessionPoints - stolenPoints;

        state.totalPoints[state.currentOwner] += keptPoints;
        state.totalPoints[event.team] += stolenPoints;
      }

      // Assegnazione Bonus Prima Occupazione (solo la prima volta in assoluto)
      if (!state.firstCaptureAwarded) {
        state.totalPoints[event.team] += (bData.firstControl || 0);
        state.firstCaptureAwarded = true;
      }

      // Aggiorna la proprietà
      state.currentOwner = event.team;
      state.captureTime = event.arrivalTime;
      
      // Salva il Grace Period calcolando il proprietario della Bell Tower IN QUESTO ESATTO MOMENTO
      const btOwner = buildingStats['bell-tower'] ? buildingStats['bell-tower'].currentOwner : 'neutral';
      state.currentGracePeriod = (btOwner === event.team) ? 1.5 : 3.0;
    }
  });

  // 4. Calcolo Punti in Corso (Fino alla posizione attuale della barra del tempo)
  buildings.forEach(b => {
    const state = buildingStats[String(b.id)];
    
    if (currentTime > state.captureTime && state.currentOwner !== 'neutral') {
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