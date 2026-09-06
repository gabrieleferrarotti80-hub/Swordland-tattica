import React from 'react';

const PathfindingViewComponent = ({ 
  pathfindingData, 
  TILE_SF, 
  inverseScale 
}) => {
  if (!pathfindingData) return null;

  const { mode = 'path', markers, captured, targets, placements } = pathfindingData;
  const safeTileSF = (TILE_SF && !isNaN(Number(TILE_SF))) ? Number(TILE_SF) : 0.458;
  const safeInvScale = (inverseScale && isFinite(inverseScale)) ? inverseScale : 1;

  const getSvgCoord = (gx, gy) => ({
    x: 600 + (gx - gy) * safeTileSF,
    y: 1150 - (gx + gy) * safeTileSF
  });

  const getSquarePoly = (x, y, size) => {
    const pts = [ { x, y }, { x: x + size, y }, { x: x + size, y: y + size }, { x, y: y + size } ];
    return pts.map(p => `${getSvgCoord(p.x, p.y).x},${getSvgCoord(p.x, p.y).y}`).join(' ');
  };

  return (
    <g>
      {mode === 'path' && markers && (
        <>
          {markers.map((m, i) => {
            if (!m.px || !m.py) return null;
            const mSvg = getSvgCoord(m.x, m.y);
            return <line key={`link-${i}`} x1={getSvgCoord(m.px, m.py).x} y1={getSvgCoord(m.px, m.py).y} x2={mSvg.x} y2={mSvg.y} stroke="#34d399" strokeWidth={3 * safeInvScale} strokeDasharray="6 6" opacity="0.8" />;
          })}
          {targets && targets.map((b, i) => {
            const isCaptured = captured.some(c => c.uniqueKey === b.uniqueKey);
            const poly = getSquarePoly(b.x, b.y, b.size || 2);
            const centerSvg = getSvgCoord(b.centerX, b.centerY);
            
            return (
              <g key={`target-${i}`} style={{ pointerEvents: 'auto', cursor: 'help' }} className="group">
                <polygon points={poly} fill={isCaptured ? "rgba(6, 182, 212, 0.5)" : "rgba(244, 63, 94, 0.3)"} stroke={isCaptured ? "#22d3ee" : "#f43f5e"} strokeWidth={isCaptured ? 3 * safeInvScale : 2 * safeInvScale} strokeDasharray={isCaptured ? "none" : "4 4"} className={isCaptured ? "animate-pulse" : ""} />
                
                <g transform={`translate(${centerSvg.x}, ${centerSvg.y}) scale(${safeInvScale})`} className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
                  <rect x="-80" y="-60" width="160" height="45" rx="6" fill="rgba(15, 23, 42, 0.95)" stroke={isCaptured ? "#22d3ee" : "#f43f5e"} strokeWidth="1.5" />
                  <text x="0" y="-45" fill={isCaptured ? "#cffafe" : "#ffe4e6"} fontSize="11" fontWeight="bold" textAnchor="middle">{b.isPlayer ? `🏰 ${b.name}` : b.name}</text>
                  <text x="0" y="-30" fill="#94a3b8" fontSize="8" fontWeight="bold" textAnchor="middle">{b.isPlayer ? 'Castello Alleato' : `${b.type} • Liv. ${b.level}`} | ({b.x}, {b.y})</text>
                  <text x="0" y="-18" fill={isCaptured ? "#34d399" : "#fb7185"} fontSize="8" fontWeight="bold" textAnchor="middle">{isCaptured ? '✓ INCLUSO NELLA RETE' : '✕ SCARTATO DAL BUDGET'}</text>
                </g>
              </g>
            );
          })}
        </>
      )}

      {mode === 'layout' && placements && (
        <>
          {placements.map(p => {
             let stroke = '#3b82f6';
             if (p.type === 'beartrap') { stroke = '#ec4899'; }
             if (p.type === 'banner') { stroke = '#8b5cf6'; }
             if (p.type === 'headquarters') { stroke = '#f59e0b'; }

             // Applicazione ESPLICITA e cablata dell'offset visivo per tipologia
             let visualX = p.newX;
             let visualY = p.newY;
             
             if (p.type === 'banner') {
                 visualX -= 0.5;
                 visualY -= 0.5;
             } else if (p.type === 'headquarters' || p.type === 'beartrap' || p.isPlayer) {
                 // Castelli (isPlayer), Trappole e HQ ricevono il -1 netto
                 visualX -= 1.0;
                 visualY -= 1.0;
             }

             return (
               <g key={`layout-${p.id || p.name}`} pointerEvents="none">
                 {/* Ingombro fisico dell'edificio con solo i bordi visibili */}
                 <polygon 
                   points={getSquarePoly(visualX, visualY, p.size)} 
                   fill="transparent" 
                   stroke={stroke} 
                   strokeWidth={2 * safeInvScale} 
                 />
                 
                 {/* Perimetro del Territorio 7x7 anch'esso senza riempimento */}
                 {p.type === 'banner' && (
                   <polygon 
                     points={getSquarePoly(visualX - 3, visualY - 3, 7)} 
                     fill="transparent" 
                     stroke="#8b5cf6" 
                     strokeWidth={1 * safeInvScale} 
                     strokeDasharray="4 4" 
                   />
                 )}
               </g>
             );
          })}
        </>
      )}
    </g>
  );
};

export const PathfindingView = React.memo(PathfindingViewComponent, (prev, next) => {
  return prev.pathfindingData === next.pathfindingData && 
         prev.inverseScale === next.inverseScale;
});