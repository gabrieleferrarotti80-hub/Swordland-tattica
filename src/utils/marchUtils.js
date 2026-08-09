// src/utils/marchUtils.js

// (Mantieni la funzione calculateMarchTime che avevamo già inserito)
export const calculateMarchTime = (x1, y1, x2, y2) => {
  const deltaX = x1 - x2;
  const deltaY = y1 - y2;
  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  const speedFactor = 47 / Math.sqrt(365); 
  const totalSeconds = distance * speedFactor;
  
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  
  return {
    distance: distance.toFixed(1),
    formattedTime: `${minutes > 0 ? `${minutes}m ` : ''}${seconds}s`,
    totalSeconds: Math.round(totalSeconds)
  };
};

// NUOVA FUNZIONE: Converte i pixel SVG (svgX, svgY) nelle coordinate di gioco (0 - 1200)
export const svgToGameCoordinates = (svgX, svgY) => {
  const scaleFactor = 550 / 1200;
  
  // Invertiamo il sistema lineare isometrico
  // centerSvgX = 600 + (x - y) * scaleFactor
  // centerSvgY = 1150 - (x + y) * scaleFactor
  
  const deltaXFromCenter = svgX - 600;
  const deltaYFromBottom = 1150 - svgY;
  
  const sumTerm = deltaYFromBottom / scaleFactor;
  const diffTerm = deltaXFromCenter / scaleFactor;
  
  const gameX = Math.round((sumTerm + diffTerm) / 2);
  const gameY = Math.round((sumTerm - diffTerm) / 2);

  // Manteniamo i limiti della mappa tra 0 e 1200
  return {
    x: Math.max(0, Math.min(1200, gameX)),
    y: Math.max(0, Math.min(1200, gameY))
  };
};