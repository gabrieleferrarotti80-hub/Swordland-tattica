import React from 'react';

const getConvexHull = (points) => {
  if (points.length < 3) return points;
  const sorted = [...points].sort((a, b) => a.x === b.x ? a.y - b.y : a.x - b.x);
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  
  const lower = [];
  for (let i = 0; i < sorted.length; i++) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], sorted[i]) <= 0) lower.pop();
    lower.push(sorted[i]);
  }
  const upper = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], sorted[i]) <= 0) upper.pop();
    upper.push(sorted[i]);
  }
  lower.pop(); upper.pop();
  return lower.concat(upper);
};

export default function AllianceLayer({ roster, isVisible }) {
  if (!isVisible || !roster || roster.length === 0) return null;

  const validPlayers = roster.filter(p => typeof p.x === 'number' && typeof p.y === 'number');
  if (validPlayers.length < 3) return null;

  const scaleFactor = 550 / 1200;
  const svgPoints = validPlayers.map(p => ({
    x: 600 + (p.x - p.y) * scaleFactor,
    y: 1150 - (p.x + p.y) * scaleFactor,
  }));

  const hullPoints = getConvexHull(svgPoints);
  const polygonString = hullPoints.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <g className="alliance-territory pointer-events-none animate-in fade-in duration-500">
      {/* Area Sfondata del Territorio Alleanza (Senza linee di bordo) */}
      <polygon 
        points={polygonString} 
        fill="rgba(79, 70, 229, 0.12)" 
        className="drop-shadow-[0_0_20px_rgba(79,70,229,0.4)]"
      />
    </g>
  );
}