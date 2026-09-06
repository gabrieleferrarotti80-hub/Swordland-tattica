import React, { useMemo } from 'react';

function ExpansionView({ 
  validPlayers = [], 
  fixedBuildings = [], 
  allianceStructures = [], 
  setAllianceStructures,
  scale = 1, 
  inverseScale = 1, 
  TILE_SF = 0.458, 
  setDraggedPlayerId 
}) {
  const safeInvScale = (inverseScale && isFinite(inverseScale)) ? inverseScale : 1;

  const sortedEntities = useMemo(() => {
    const entities = [];
    
    (fixedBuildings || []).forEach(b => {
      if (b && b.x !== '' && b.y !== '' && !isNaN(b.x) && !isNaN(b.y)) {
        entities.push({ 
            type: 'fixed', id: b.id, gameX: Number(b.x), gameY: Number(b.y), 
            svgX: 600 + (Number(b.x) - Number(b.y)) * TILE_SF, 
            svgY: 1150 - (Number(b.x) + Number(b.y)) * TILE_SF, 
            data: b 
        });
      }
    });
    
    (allianceStructures || []).forEach(s => {
      if (s && s.x !== '' && s.y !== '' && !isNaN(s.x) && !isNaN(s.y)) {
        let effX = Number(s.x);
        let effY = Number(s.y);
        
        if (s.type === 'headquarters') { effX += 0.5; effY += 0.5; }

        entities.push({ 
            type: 'structure', id: s.id, gameX: effX, gameY: effY, 
            svgX: 600 + (effX - effY) * TILE_SF, 
            svgY: 1150 - (effX + effY) * TILE_SF, 
            data: s 
        });
      }
    });
    
    return entities.sort((a, b) => {
      const depthA = a.gameX + a.gameY;
      const depthB = b.gameX + b.gameY;
      if (depthA !== depthB) return depthB - depthA;
      return a.gameX - b.gameX;
    });
  }, [fixedBuildings, allianceStructures, TILE_SF]);

  return (
    <g id="expansion-layer">
      {allianceStructures.map(struct => {
        if (struct.x === '' || struct.y === '') return null;
        const bx = Number(struct.x);
        const by = Number(struct.y);
        const isHQ = struct.type === 'headquarters';
        
        const radius = isHQ ? 5 : 3;
        const pts = [
          { x: bx - radius, y: by - radius },
          { x: bx + radius, y: by - radius },
          { x: bx + radius, y: by + radius },
          { x: bx - radius, y: by + radius }
        ];
        
        const poly = pts.map(p => `${600 + (p.x - p.y) * TILE_SF},${1150 - (p.x + p.y) * TILE_SF}`).join(' ');
        
        return (
          <polygon 
            key={`area-${struct.id}`} 
            points={poly} 
            fill={isHQ ? "rgba(245, 158, 11, 0.1)" : "rgba(59, 130, 246, 0.15)"} 
            stroke={isHQ ? "#f59e0b" : "#3b82f6"} 
            strokeWidth={1.5 * safeInvScale} 
            strokeDasharray="4 4" 
            pointerEvents="none"
          />
        );
      })}

      {sortedEntities.map(entity => {
        if (!entity || isNaN(entity.svgX) || isNaN(entity.svgY)) return null;
        
        const isFixed = entity.type === 'fixed';
        const isHQ = entity.type === 'structure' && entity.data.type === 'headquarters';
        const isBanner = entity.type === 'structure' && entity.data.type === 'banner';
        
        const radiusTiles = isFixed ? 4 : (isHQ ? 3 : 1); 
        const rp = radiusTiles * TILE_SF;
        
        let width, height, imageHref, labelY, offsetX = 0, offsetY = 0;
        const baseU = TILE_SF; 
        
        if (isFixed) {
          width = 5 * baseU; height = 5 * baseU; 
          labelY = 2 * baseU; offsetY = -1.5 * baseU;
        } else if (isHQ) {
          width = (224 / 40) * baseU; height = (208 / 40) * baseU; imageHref = "/assets/hq.png"; 
          labelY = (120 / 40) * baseU; offsetX = (-2 / 40) * baseU; offsetY = (-13 / 40) * baseU;    
        } else if (isBanner) {
          width = (100 / 80) * baseU; height = (140 / 80) * baseU; 
          labelY = (80 / 80) * baseU; offsetY = (-20 / 80) * baseU;
        } 
        
        const imgX = -width / 2 + offsetX;
        const imgY = -height / 2 + offsetY;
        
        return (
          <g key={`grp-${entity.type}-${entity.id}`} transform={`translate(${entity.svgX}, ${entity.svgY})`} className="group cursor-pointer">
            <polygon 
              points={`0,${rp} ${rp},0 0,${-rp} ${-rp},0`} 
              fill={isFixed ? "rgba(255, 255, 255, 0.05)" : "rgba(34, 211, 238, 0.1)"} 
              stroke={isFixed ? "rgba(255, 255, 255, 0.2)" : "rgba(34, 211, 238, 0.5)"} 
              strokeWidth={1 * safeInvScale} 
            />
            
            {isFixed && (
              <g pointerEvents="none">
                 <circle cx="0" cy={offsetY} r={10 * safeInvScale} fill="#475569" stroke="#94a3b8" strokeWidth={2 * safeInvScale} />
                 <text x="0" y={offsetY + 25 * safeInvScale} fill="#f8fafc" fontSize={10 * safeInvScale} fontWeight="bold" textAnchor="middle">
                   {entity.data.name}
                 </text>
              </g>
            )}

            {!isFixed && isBanner && (
              <>
                <image href="/assets/banner_base.png" x={imgX} y={imgY} width={width} height={height} pointerEvents="none" />
                <image href="/assets/banner_cloth.png" x={imgX} y={imgY} width={width} height={height} style={{ filter: `hue-rotate(210deg) saturate(1.2)`, pointerEvents: 'none' }} />
              </>
            )}
            
            {!isFixed && isHQ && (
              <image href={imageHref} x={imgX} y={imgY} width={width} height={height} pointerEvents="none" />
            )}
            
            {!isFixed && (
              <rect 
                x={imgX} y={imgY} width={width} height={height} fill="transparent"
                style={{ cursor: 'grab', pointerEvents: 'auto' }}
                onMouseDown={(e) => { e.stopPropagation(); setDraggedPlayerId(`${entity.type}:${entity.id}`); }} 
              />
            )}

            {/* Tooltip SVG integrato che sostituisce il div HTML fluttuante */}
            {!isFixed && (
              <g transform={`scale(${safeInvScale})`} className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
                <rect x="-60" y={`-${labelY + 25}`} width="120" height="22" rx="4" fill="rgba(15, 23, 42, 0.95)" stroke="#3b82f6" strokeWidth="1.5" />
                <text x="0" y={`-${labelY + 14}`} fill="#f8fafc" fontSize="10" fontWeight="bold" textAnchor="middle" alignmentBaseline="middle">
                  {entity.data.name} ({entity.data.x}, {entity.data.y})
                </text>
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
}

export default React.memo(ExpansionView, (prev, next) => {
  return prev.fixedBuildings === next.fixedBuildings && 
         prev.allianceStructures === next.allianceStructures &&
         prev.inverseScale === next.inverseScale;
});