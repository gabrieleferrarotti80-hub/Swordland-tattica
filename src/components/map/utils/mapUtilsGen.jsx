export const GRID_SIZES = {
  CASTLE: 18,        // Castello Centrale (18x18)
  MAJOR: 12,         // Fortezze, Santuari (12x12)
  MINOR: 6,          // Edifici standard (6x6)
  
  // Il giocatore occupa 4 quadratini (2x2). 
  // Impostiamo 1.8 (cioè il 90% di 2) così copre quasi tutta la sua area
  // ma lascia un millimetro di bordo per distaccarsi dagli altri.
  PLAYER: 1.5
};

// 1. TACTICAL VIEW: Usa le dimensioni MATEMATICHE per aderire alla griglia
export const getTacticalShapePts = (gridSize, tileSf) => {
  // NESSUNA divisione! gridSize 6 occupa esattamente 6x6 caselle.
  const r = gridSize * tileSf; 
  return `0,${-r} ${r},0 0,${r} ${-r},0`;
};

// 2. GLOBAL & ALLIANCE VIEW: Usa dimensioni VISIVE per comportarsi come un "Pin" su mappa
export const getGlobalShapePts = (gridSize, buildingScale = 1.0) => {
  // Mappiamo le dimensioni di gioco con un raggio fisso in pixel per lo schermo
  let visualRadius = 7; 
  
  if (gridSize === GRID_SIZES.CASTLE) visualRadius = 21;
  else if (gridSize === GRID_SIZES.MAJOR) visualRadius = 12;
  else if (gridSize === GRID_SIZES.MINOR) visualRadius = 7;
  else if (gridSize === GRID_SIZES.PLAYER) visualRadius = 5;

  const r = visualRadius * buildingScale;
  return `0,${-r} ${r},0 0,${r} ${-r},0`;
};