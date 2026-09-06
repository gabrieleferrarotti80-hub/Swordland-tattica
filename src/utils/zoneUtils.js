export const getZoneResourceLevel = (x, y, globalResourceZones = []) => {
  const defaultOuterValue = "1-5"; 

  if (!globalResourceZones || globalResourceZones.length === 0) return defaultOuterValue;

  // Assegna pesi per ordinare i poligoni correttamente (Centro vince su Esterno)
  const getWeight = (levelString) => {
    if (levelString === "8") return 3;
    if (levelString === "6-7") return 2;
    return 1;
  };

  const sortedZones = [...globalResourceZones].sort((a, b) => {
     return getWeight(b.resourceLevel) - getWeight(a.resourceLevel);
  });

  for (const zone of sortedZones) {
    if (!zone.points || zone.points.length < 3) continue;

    let isInside = false;
    for (let i = 0, j = zone.points.length - 1; i < zone.points.length; j = i++) {
      const xi = zone.points[i].x, yi = zone.points[i].y;
      const xj = zone.points[j].x, yj = zone.points[j].y;
      
      const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) isInside = !isInside;
    }

    if (isInside) return zone.resourceLevel;
  }

  return defaultOuterValue; 
};