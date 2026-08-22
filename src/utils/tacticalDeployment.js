// src/utils/tacticalDeployment.js

export const TEAM_COLORS = [
  '#ef4444', // Rosso
  '#3b82f6', // Blu
  '#10b981', // Smeraldo
  '#f59e0b', // Ambra
  '#8b5cf6', // Viola
  '#ec4899', // Rosa
  '#06b6d4', // Ciano
  '#84cc16'  // Lime
];

// =========================================================
// 1. MOTORE PRINCIPALE: SPINA DORSALE GLOBALE E SCIAME (Chebyshev)
// =========================================================
export const calculateGlobalDeployment = (teamsData, existingOverrides, castleBuilding = {x: 597, y: 597}) => {
  const occupied = new Set();
  const TOKEN_SIZE = 2; // I segnalini occupano 2x2
  const MAX_LIMIT = 45; // Limite invalicabile (3 minuti)

  const cx = castleBuilding.x;
  const cy = castleBuilding.y;

  // Helpers per la gestione griglia
  const isSpaceClear = (x, y) => {
    for (let ox = 0; ox < TOKEN_SIZE; ox++) {
      for (let oy = 0; oy < TOKEN_SIZE; oy++) {
        if (occupied.has(`${x + ox},${y + oy}`)) return false;
      }
    }
    return true;
  };

  const occupySpace = (x, y) => {
    for (let ox = 0; ox < TOKEN_SIZE; ox++) {
      for (let oy = 0; oy < TOKEN_SIZE; oy++) {
        occupied.add(`${x + ox},${y + oy}`);
      }
    }
  };

  // Mappiamo gli ostacoli già presenti sulla mappa
  Object.values(existingOverrides).forEach(pos => {
    if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
      occupySpace(pos.x, pos.y);
    }
  });

  // Blocchiamo i leader per evitare che vengano calpestati
  teamsData.forEach(team => {
    occupySpace(team.leaderX, team.leaderY);
  });

  const results = {};
  let missingSpace = false;

  // --- FASE 1: TUTTE LE SPINE DORSALI (5 Filler dritti per ogni squadra) ---
  teamsData.forEach(teamData => {
    const { leaderX, leaderY, fillers } = teamData;
    teamData.placedCount = 0; 

    const dx = leaderX - cx;
    const dy = leaderY - cy;

    let moveX = 0, moveY = 0;

    // MAGIA PER LE TORRETTE: Se il leader è esattamente su un angolo, esci in diagonale!
    if (Math.abs(dx) === Math.abs(dy) && dx !== 0) {
      moveX = dx > 0 ? 1 : -1;
      moveY = dy > 0 ? 1 : -1;
    } 
    // Muri laterali standard
    else if (Math.abs(dx) > Math.abs(dy)) {
      moveX = dx > 0 ? 1 : -1;
    } else {
      moveY = dy > 0 ? 1 : -1;
    }

    let depth = 1;
    // Piazziamo fino a 5 filler
    while (teamData.placedCount < 5 && teamData.placedCount < fillers.length && depth <= 15) {
      const nx = leaderX + (moveX * depth * TOKEN_SIZE);
      const ny = leaderY + (moveY * depth * TOKEN_SIZE);

      if (isSpaceClear(nx, ny)) {
         occupySpace(nx, ny);
         const filler = fillers[teamData.placedCount];
         results[filler.id] = { x: nx, y: ny };
         teamData.placedCount++;
      }
      depth++; 
    }
  });

  // --- FASE 2: TUTTI GLI SCIAMI (Riempi i buchi vicini) ---
  teamsData.forEach(teamData => {
    const { leaderX, leaderY, fillers, placedCount } = teamData;
    const remaining = fillers.length - placedCount;
    
    if (remaining <= 0) return; // Se la squadra è piccola e ha già finito, salta

    // SCUDO DI CHEBYSHEV: Calcola l'involucro quadrato del castello 
    const leaderChebyshev = Math.max(Math.abs(leaderX - cx), Math.abs(leaderY - cy));
    
    const candidateSlots = [];

    // Esploriamo una vasta area attorno al leader
    for (let xStep = -25; xStep <= 25; xStep++) {
      for (let yStep = -25; yStep <= 25; yStep++) {
        if (xStep === 0 && yStep === 0) continue;

        const nx = leaderX + (xStep * TOKEN_SIZE);
        const ny = leaderY + (yStep * TOKEN_SIZE);

        // Limite radiale dei 3 minuti di marcia
        const distFromLeader = Math.sqrt(Math.pow(nx - leaderX, 2) + Math.pow(ny - leaderY, 2));
        if (distFromLeader > MAX_LIMIT) continue;

        // VERIFICA SCUDO ANTI-CASTELLO
        const slotChebyshev = Math.max(Math.abs(nx - cx), Math.abs(ny - cy));
        if (slotChebyshev < leaderChebyshev - 1) continue;

        candidateSlots.push({ nx, ny, distance: distFromLeader });
      }
    }

    // Ordiniamo le caselle libere rigorosamente per vicinanza al leader
    candidateSlots.sort((a, b) => a.distance - b.distance);

    let currentPlaced = placedCount;
    for (let slot of candidateSlots) {
      if (currentPlaced >= fillers.length) break;

      if (isSpaceClear(slot.nx, slot.ny)) {
        occupySpace(slot.nx, slot.ny);
        const filler = fillers[currentPlaced];
        results[filler.id] = { x: slot.nx, y: slot.ny };
        currentPlaced++;
      }
    }

    if (currentPlaced < fillers.length) missingSpace = true;
  });

  return { results, missingSpace };
};

// =========================================================
// 2. FUNZIONE PONTE: PER LA COMPATIBILITA' CON TacticalTeamCard.jsx
// =========================================================
export const calculateDeployment = (leaderX, leaderY, fillersCount, existingOverrides, maxRadius = 40, castleBuilding = {x: 597, y: 597}) => {
  // Creiamo una squadra "finta" per farla digerire all'algoritmo globale
  const mockFillers = Array.from({length: fillersCount}).map((_, i) => ({ id: `mock_${i}` }));
  
  const teamsData = [{
    leaderX,
    leaderY,
    fillers: mockFillers,
    placedCount: 0
  }];

  // Sfruttiamo la nuova logica matematica (Spina Dorsale + Sciame)
  const { results } = calculateGlobalDeployment(teamsData, existingOverrides, castleBuilding);

  // Riconvertiamo l'output nel formato ad array vecchio (che TacticalTeamCard.jsx si aspetta)
  const placements = [];
  for (let i = 0; i < fillersCount; i++) {
    const id = `mock_${i}`;
    if (results[id]) {
      placements.push(results[id]);
    }
  }

  return {
    placements,
    success: placements.length === fillersCount
  };
};