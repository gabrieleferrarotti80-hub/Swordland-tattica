import React, { useMemo } from 'react';

function AllianceView({ 
  validPlayers = [], 
  allianceStructures = [], 
  hiveGridMeta = {}, 
  scale = 1, 
  inverseScale = 1, 
  TILE_SF = 0.458, 
  setDraggedPlayerId,
  isEditMode 
}) {

  const safeTileSF = (TILE_SF && !isNaN(Number(TILE_SF))) ? Number(TILE_SF) : 0.458;
  const safeInvScale = (inverseScale && isFinite(inverseScale)) ? inverseScale : 1;

  const sortedEntities = useMemo(() => {
    const entities = [];
    (validPlayers || []).forEach(p => {
      if (p && p.x !== '' && p.y !== '' && !isNaN(p.x) && !isNaN(p.y)) {
        entities.push({ 
            type: 'player', id: p.id, gameX: Number(p.x), gameY: Number(p.y), 
            svgX: p.svgX || (600 + (Number(p.x) - Number(p.y)) * safeTileSF), 
            svgY: p.svgY || (1150 - (Number(p.x) + Number(p.y)) * safeTileSF), 
            data: p 
        });
      }
    });
    
    (allianceStructures || []).forEach(s => {
      if (s && s.x !== '' && s.y !== '' && !isNaN(s.x) && !isNaN(s.y)) {
        let effX = Number(s.x);
        let effY = Number(s.y);
        if (s.type === 'headquarters' || s.type === 'beartrap') { effX += 0.5; effY += 0.5; }
        entities.push({ 
            type: 'structure', id: s.id, gameX: effX, gameY: effY, 
            svgX: 600 + (effX - effY) * safeTileSF, 
            svgY: 1150 - (effX + effY) * safeTileSF, 
            data: s 
        });
      }
    });
    
    return entities.sort((a, b) => (b.gameX + b.gameY) - (a.gameX + a.gameY) || a.gameX - b.gameX);
  }, [validPlayers, allianceStructures, safeTileSF]);

  const gridTranslateX = isNaN(600 - safeTileSF) ? 600 : 600 - safeTileSF;
  const gridTranslateY = isNaN(1150 - safeTileSF) ? 1150 : 1150 - safeTileSF;
  const patternSize = 2 * safeTileSF;

  return (
    <g>
      <defs>
        <pattern id="iso-1x1-grid" width={patternSize} height={patternSize} patternUnits="userSpaceOnUse" patternTransform={`translate(${gridTranslateX}, ${gridTranslateY})`}>
          {/* Opacità portata a 0.25 per renderla chiaramente visibile */}
          <path d={`M ${safeTileSF} 0 L ${2 * safeTileSF} ${safeTileSF} L ${safeTileSF} ${2 * safeTileSF} L 0 ${safeTileSF} Z`} fill="none" stroke="rgba(34, 211, 238, 0.25)" strokeWidth={1.2 * safeInvScale} />
          <path d={`M 0 0 L ${safeTileSF} ${safeTileSF} L 0 ${2 * safeTileSF} M ${2 * safeTileSF} 0 L ${safeTileSF} ${safeTileSF} L ${2 * safeTileSF} ${2 * safeTileSF}`} fill="none" stroke="rgba(34, 211, 238, 0.15)" strokeWidth={0.8 * safeInvScale} />
        </pattern>
      </defs>

      {/* Griglia 1x1 renderizzata sopra lo sfondo della mappa */}
      <rect x="0" y="0" width="1200" height="1200" fill="url(#iso-1x1-grid)" pointerEvents="none" />

      {hiveGridMeta?.territory?.length > 0 && (
        <g pointerEvents="none">
          {hiveGridMeta.territory.length > 2 && (
            <polygon 
              points={hiveGridMeta.territory.map(pt => `${600 + (Number(pt.x) - Number(pt.y)) * safeTileSF},${1150 - (Number(pt.x) + Number(pt.y)) * safeTileSF}`).join(' ')}
              fill="rgba(59, 130, 246, 0.08)" 
              stroke="#3b82f6" 
              strokeWidth={3 * safeInvScale}
              strokeDasharray={`${8 * safeInvScale}, ${4 * safeInvScale}`}
            />
          )}
          {hiveGridMeta.isDrawing && hiveGridMeta.territory.map((pt, idx) => {
            if (pt.x === '' || pt.y === '') return null;
            const px = 600 + (Number(pt.x) - Number(pt.y)) * safeTileSF;
            const py = 1150 - (Number(pt.x) + Number(pt.y)) * safeTileSF;
            return <circle key={`tpt-${idx}`} cx={px} cy={py} r={5 * safeInvScale} fill="#60a5fa" stroke="#2563eb" strokeWidth={2 * safeInvScale} />;
          })}
        </g>
      )}

      {sortedEntities.map(entity => {
        if (!entity || isNaN(entity.svgX) || isNaN(entity.svgY)) return null;
        
        const isStructure = entity.type === 'structure';
        const isHQ = isStructure && entity.data.type === 'headquarters';
        const isBanner = isStructure && entity.data.type === 'banner';
        
        let width, height, imageHref, labelY, offsetX = 0, offsetY = 0;
        const baseU = safeTileSF; 
        
        if (isHQ) {
          width = (224 / 40) * baseU; height = (208 / 40) * baseU; imageHref = "/assets/hq.png"; labelY = (120 / 40) * baseU; offsetX = (-2 / 40) * baseU; offsetY = (-13 / 40) * baseU;    
        } else if (isBanner) {
          const visualScale = 1.0; width = visualScale * (100 / 80) * baseU; height = visualScale * (140 / 80) * baseU; labelY = visualScale * (80 / 80) * baseU; offsetX = 0; offsetY = visualScale * (-20 / 80) * baseU;
        } else if (isStructure) {
          width = (243 / 40) * baseU; height = (243.75 / 40) * baseU; imageHref = "/assets/beartrap.png"; labelY = (135 / 40) * baseU; offsetX = 0; offsetY = (-0.75 / 40) * baseU;  
        } else {
          const visualScale = 1.45; width = visualScale * (180 / 80) * baseU; height = visualScale * (167 / 80) * baseU; labelY = visualScale * (60 / 80) * baseU; offsetX = visualScale * (-2 / 80) * baseU; offsetY = visualScale * (-31 / 80) * baseU;
          const playerRole = entity.data.role ? entity.data.role.toUpperCase() : '';
          if (playerRole === 'R5') { imageHref = "/assets/castle_r5.png"; } 
          else if (playerRole === 'R4') { imageHref = "/assets/castle_r4.png"; } 
          else { imageHref = "/assets/castle.png"; }
        }
        
        const imgX = -width / 2 + offsetX;
        const imgY = -height / 2 + offsetY;
        
        return (
          <g key={`grp-${entity.type}-${entity.id}`} transform={`translate(${entity.svgX}, ${entity.svgY})`} className="group cursor-pointer">
            
            {isStructure && (
              <polygon 
                points={`${0},${(isBanner ? 1 : 3) * safeTileSF} ${(isBanner ? 1 : 3) * safeTileSF},${0} ${0},${-(isBanner ? 1 : 3) * safeTileSF} ${-(isBanner ? 1 : 3) * safeTileSF},${0}`} 
                fill="rgba(34, 211, 238, 0.08)" stroke="rgba(34, 211, 238, 0.4)" strokeWidth={1 * safeInvScale} 
              />
            )}

            {isBanner ? (
              <g>
                <image href="/assets/banner_base.png" x={imgX} y={imgY} width={width} height={height} pointerEvents="none" imageRendering="optimizeSpeed" />
                <image href="/assets/banner_cloth.png" x={imgX} y={imgY} width={width} height={height} pointerEvents="none" imageRendering="optimizeSpeed" />
                <text x={0} y={offsetY + height * 0.15} fill="#f1f5f9" fontSize={width * 0.4} fontWeight="900" fontFamily="serif" textAnchor="middle" alignmentBaseline="middle" pointerEvents="none">K</text>
              </g>
            ) : (
              <image href={imageHref} x={imgX} y={imgY} width={width} height={height} pointerEvents="none" imageRendering="optimizeSpeed" />
            )}
            
            <rect 
              x={imgX} y={imgY} width={width} height={height} fill="transparent"
              onMouseDown={(e) => { if (!isEditMode) return; e.stopPropagation(); setDraggedPlayerId(`${entity.type}:${entity.id}`); }} 
            />

            <g transform={`scale(${safeInvScale})`} className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
              <rect x="-60" y={`-${labelY + 25}`} width="120" height="22" rx="4" fill="rgba(15, 23, 42, 0.95)" stroke="#22d3ee" strokeWidth="1.5" />
              <text x="0" y={`-${labelY + 14}`} fill="#f8fafc" fontSize="10" fontWeight="bold" textAnchor="middle" alignmentBaseline="middle">
                {entity.type === 'player' && entity.data.tag ? `[${entity.data.tag}] ` : ''} {entity.data.name}
              </text>
            </g>
          </g>
        );
      })}
    </g>
  );
}

export default React.memo(AllianceView, (prev, next) => {
  return prev.validPlayers === next.validPlayers && 
         prev.allianceStructures === next.allianceStructures &&
         prev.hiveGridMeta === next.hiveGridMeta &&
         prev.isEditMode === next.isEditMode &&
         prev.inverseScale === next.inverseScale;
});