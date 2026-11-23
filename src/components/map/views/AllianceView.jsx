import React, { useMemo } from 'react';

function AllianceView({
  validPlayers = [],
  allianceStructures = [],
  hiveGridMeta = {},
  scale = 1,
  inverseScale = 1,
  TILE_SF = 0.458,
  setDraggedPlayerId,
  isEditMode,
  highlightedEntity = null,
  onHighlightEntity
}) {
  const safeTileSF = (TILE_SF && !isNaN(Number(TILE_SF))) ? Number(TILE_SF) : 0.458;
  const safeInvScale = (inverseScale && isFinite(inverseScale)) ? inverseScale : 1;

  const sortedEntities = useMemo(() => {
    const entities = [];
    (validPlayers || []).forEach(p => {
      if (p && p.x !== '' && p.y !== '' && !isNaN(p.x) && !isNaN(p.y)) {
        entities.push({
          type: 'player',
          id: p.id,
          gameX: Number(p.x),
          gameY: Number(p.y),
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
        if (s.type === 'headquarters' || s.type === 'beartrap') {
          effX += 0.5;
          effY += 0.5;
        }
        entities.push({
          type: 'structure',
          id: s.id,
          gameX: effX,
          gameY: effY,
          svgX: 600 + (effX - effY) * safeTileSF,
          svgY: 1150 - (effX + effY) * safeTileSF,
          data: s
        });
      }
    });

    return entities.sort((a, b) => (b.gameX + b.gameY) - (a.gameX + a.gameY) || a.gameX - b.gameX);
  }, [validPlayers, allianceStructures, safeTileSF]);

  const activeHighlight = useMemo(() => {
    if (!highlightedEntity) return null;
    return sortedEntities.find(
      e => e.type === highlightedEntity.type && String(e.id) === String(highlightedEntity.id)
    ) || null;
  }, [sortedEntities, highlightedEntity]);

  const gridTranslateX = isNaN(600 - safeTileSF) ? 600 : 600 - safeTileSF;
  const gridTranslateY = isNaN(1150 - safeTileSF) ? 1150 : 1150 - safeTileSF;
  const patternSize = 2 * safeTileSF;

  const getEntityMetrics = (entity) => {
    const isStructure = entity.type === 'structure';
    const isHQ = isStructure && entity.data.type === 'headquarters';
    const isBanner = isStructure && entity.data.type === 'banner';
    const isResource = isStructure && entity.data.type === 'resource';
    const baseU = safeTileSF;

    if (isHQ) {
      return { isStructure, isHQ, isBanner, isResource, halfDiag: 3 * baseU, labelY: (120 / 40) * baseU };
    }
    if (isBanner) {
      return { isStructure, isHQ, isBanner, isResource, halfDiag: 1 * baseU, labelY: (80 / 80) * baseU };
    }
    if (isResource) {
      return { isStructure, isHQ, isBanner, isResource, halfDiag: 2 * baseU, labelY: 2.2 * baseU };
    }
    if (isStructure) {
      return { isStructure, isHQ, isBanner, isResource, halfDiag: 3 * baseU, labelY: (135 / 40) * baseU };
    }
    return { isStructure, isHQ, isBanner, isResource, halfDiag: 2 * baseU, labelY: 1.45 * (60 / 80) * baseU };
  };

  return (
    <g>
      <defs>
        <pattern
          id="iso-1x1-grid"
          width={patternSize}
          height={patternSize}
          patternUnits="userSpaceOnUse"
          patternTransform={'translate(' + gridTranslateX + ', ' + gridTranslateY + ')'}
        >
          <path
            d={'M ' + safeTileSF + ' 0 L ' + (2 * safeTileSF) + ' ' + safeTileSF + ' L ' + safeTileSF + ' ' + (2 * safeTileSF) + ' L 0 ' + safeTileSF + ' Z'}
            fill="none"
            stroke="rgba(34, 211, 238, 0.25)"
            strokeWidth={1.2 * safeInvScale}
          />
          <path
            d={'M 0 0 L ' + safeTileSF + ' ' + safeTileSF + ' L 0 ' + (2 * safeTileSF) + ' M ' + (2 * safeTileSF) + ' 0 L ' + safeTileSF + ' ' + safeTileSF + ' L ' + (2 * safeTileSF) + ' ' + (2 * safeTileSF)}
            fill="none"
            stroke="rgba(34, 211, 238, 0.15)"
            strokeWidth={0.8 * safeInvScale}
          />
        </pattern>
      </defs>

      <rect x="0" y="0" width="1200" height="1200" fill="url(#iso-1x1-grid)" pointerEvents="none" />

      {hiveGridMeta?.territory?.length > 0 && (
        <g pointerEvents="none">
          {hiveGridMeta.territory.length > 2 && (
            <polygon
              points={hiveGridMeta.territory
                .map(pt => (600 + (Number(pt.x) - Number(pt.y)) * safeTileSF) + ',' + (1150 - (Number(pt.x) + Number(pt.y)) * safeTileSF))
                .join(' ')}
              fill="rgba(59, 130, 246, 0.08)"
              stroke="#3b82f6"
              strokeWidth={3 * safeInvScale}
              strokeDasharray={(8 * safeInvScale) + ', ' + (4 * safeInvScale)}
            />
          )}
          {hiveGridMeta.isDrawing && hiveGridMeta.territory.map((pt, idx) => {
            if (pt.x === '' || pt.y === '') return null;
            const px = 600 + (Number(pt.x) - Number(pt.y)) * safeTileSF;
            const py = 1150 - (Number(pt.x) + Number(pt.y)) * safeTileSF;
            return <circle key={'tpt-' + idx} cx={px} cy={py} r={5 * safeInvScale} fill="#60a5fa" stroke="#2563eb" strokeWidth={2 * safeInvScale} />;
          })}
        </g>
      )}

      {sortedEntities.map(entity => {
        if (!entity || isNaN(entity.svgX) || isNaN(entity.svgY)) return null;

        const { isStructure, isHQ, isBanner, isResource, halfDiag, labelY } = getEntityMetrics(entity);
        const isHighlighted = Boolean(
          activeHighlight &&
          activeHighlight.type === entity.type &&
          String(activeHighlight.id) === String(entity.id)
        );

        let width, height, imageHref, offsetX = 0, offsetY = 0;
        const baseU = safeTileSF;

        if (isHQ) {
          width = (224 / 40) * baseU;
          height = (208 / 40) * baseU;
          imageHref = "/assets/hq.png";
          offsetX = (-2 / 40) * baseU;
          offsetY = (-13 / 40) * baseU;
        } else if (isBanner) {
          width = (100 / 80) * baseU;
          height = (140 / 80) * baseU;
          offsetX = 0;
          offsetY = (-20 / 80) * baseU;
        } else if (isResource) {
          width = 4 * baseU;
          height = 4 * baseU;
          offsetX = 0;
          offsetY = 0;
        } else if (isStructure) {
          width = (243 / 40) * baseU;
          height = (243.75 / 40) * baseU;
          imageHref = "/assets/beartrap.png";
          offsetX = 0;
          offsetY = (-0.75 / 40) * baseU;
        } else {
          const visualScale = 1.45;
          width = visualScale * (180 / 80) * baseU;
          height = visualScale * (167 / 80) * baseU;
          offsetX = visualScale * (-2 / 80) * baseU;
          offsetY = visualScale * (-31 / 80) * baseU;
          const playerRole = entity.data.role ? entity.data.role.toUpperCase() : '';
          if (playerRole === 'R5') { imageHref = "/assets/castle_r5.png"; }
          else if (playerRole === 'R4') { imageHref = "/assets/castle_r4.png"; }
          else { imageHref = "/assets/castle.png"; }
        }

        const imgX = -width / 2 + offsetX;
        const imgY = -height / 2 + offsetY;
        const diamondPoints = '0,' + halfDiag + ' ' + halfDiag + ',0 0,' + (-halfDiag) + ' ' + (-halfDiag) + ',0';

        return (
          <g key={'grp-' + entity.type + '-' + entity.id} transform={'translate(' + entity.svgX + ', ' + entity.svgY + ')'} className="group cursor-pointer">
            {isStructure && (
              <polygon
                points={diamondPoints}
                fill={isResource ? 'rgba(245, 158, 11, 0.28)' : 'rgba(34, 211, 238, 0.08)'}
                stroke={isResource ? '#f59e0b' : 'rgba(34, 211, 238, 0.4)'}
                strokeWidth={(isResource ? 1.8 : 1) * safeInvScale}
              />
            )}

            {isBanner ? (
              <g>
                <image href="/assets/banner_base.png" x={imgX} y={imgY} width={width} height={height} pointerEvents="none" imageRendering="optimizeSpeed" />
                <image href="/assets/banner_cloth.png" x={imgX} y={imgY} width={width} height={height} pointerEvents="none" imageRendering="optimizeSpeed" />
                <text x={0} y={offsetY + height * 0.15} fill="#f1f5f9" fontSize={width * 0.4} fontWeight="900" fontFamily="serif" textAnchor="middle" alignmentBaseline="middle" pointerEvents="none">K</text>
              </g>
            ) : isResource ? (
              <g pointerEvents="none">
                <line x1={-halfDiag * 0.55} y1={0} x2={halfDiag * 0.55} y2={0} stroke="rgba(251, 191, 36, 0.45)" strokeWidth={1 * safeInvScale} />
                <line x1={0} y1={-halfDiag * 0.55} x2={0} y2={halfDiag * 0.55} stroke="rgba(251, 191, 36, 0.45)" strokeWidth={1 * safeInvScale} />
                <text x={0} y={0.15 * baseU} fontSize={1.55 * baseU} textAnchor="middle" alignmentBaseline="middle">⛏️</text>
              </g>
            ) : (
              <image href={imageHref} x={imgX} y={imgY} width={width} height={height} pointerEvents="none" imageRendering="optimizeSpeed" />
            )}

            <rect
              x={imgX}
              y={imgY}
              width={width}
              height={height}
              fill="transparent"
              onClick={(e) => {
                e.stopPropagation();
                if (onHighlightEntity) {
                  onHighlightEntity({
                    type: entity.type,
                    id: entity.id,
                    x: entity.data.x,
                    y: entity.data.y,
                    structureType: entity.data.type
                  });
                }
              }}
              onMouseDown={(e) => {
                if (!isEditMode) return;
                e.stopPropagation();
                setDraggedPlayerId(entity.type + ':' + entity.id);
              }}
            />

            {!isHighlighted && (
              <g transform={'scale(' + safeInvScale + ')'} className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
                <rect x="-80" y={-(labelY + 32)} width="160" height="30" rx="6" fill="rgba(15, 23, 42, 0.95)" stroke={isResource ? '#f59e0b' : '#22d3ee'} strokeWidth="2" />
                <text x="0" y={-(labelY + 17)} fill="#f8fafc" fontSize="15" fontWeight="black" textAnchor="middle" alignmentBaseline="middle">
                  {entity.type === 'player' && entity.data.tag ? '[' + entity.data.tag + '] ' : ''}{entity.data.name}
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* Livello superiore: Faro pulsante + etichetta sempre visibile sull'elemento selezionato */}
      {activeHighlight && !isNaN(activeHighlight.svgX) && !isNaN(activeHighlight.svgY) && (() => {
        const { halfDiag, labelY } = getEntityMetrics(activeHighlight);
        const outerDiag = halfDiag * 1.38;
        const innerPoints = '0,' + halfDiag + ' ' + halfDiag + ',0 0,' + (-halfDiag) + ' ' + (-halfDiag) + ',0';
        const outerPoints = '0,' + outerDiag + ' ' + outerDiag + ',0 0,' + (-outerDiag) + ' ' + (-outerDiag) + ',0';
        const tagPrefix = activeHighlight.type === 'player' && activeHighlight.data.tag ? '[' + activeHighlight.data.tag + '] ' : '';
        const titleText = tagPrefix + (activeHighlight.data.name || '');
        const coordsText = 'X:' + Math.round(Number(activeHighlight.data.x)) + '  Y:' + Math.round(Number(activeHighlight.data.y));

        return (
          <g transform={'translate(' + activeHighlight.svgX + ', ' + activeHighlight.svgY + ')'} pointerEvents="none">
            {/* Alone pulsante esterno */}
            <polygon
              points={outerPoints}
              fill="rgba(250, 204, 21, 0.18)"
              stroke="#facc15"
              strokeWidth={3.5 * safeInvScale}
            >
              <animate attributeName="opacity" values="0.95;0.2;0.95" dur="1.1s" repeatCount="indefinite" />
            </polygon>

            {/* Contorno nitido sull'impronta reale */}
            <polygon
              points={innerPoints}
              fill="rgba(250, 204, 21, 0.25)"
              stroke="#fef08a"
              strokeWidth={2.5 * safeInvScale}
            />

            {/* Cerchio radar pulsante */}
            <circle cx="0" cy="0" r={halfDiag * 0.8} fill="none" stroke="#38bdf8" strokeWidth={2.5 * safeInvScale}>
              <animate attributeName="r" values={(halfDiag * 0.7) + ';' + (halfDiag * 1.9)} dur="1.4s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.9;0" dur="1.4s" repeatCount="indefinite" />
            </circle>

            {/* Targhetta luminosa fissa con nome e coordinate */}
            <g transform={'scale(' + safeInvScale + ')'}>
              <rect x="-95" y={-(labelY + 52)} width="190" height="44" rx="8" fill="rgba(15, 23, 42, 0.96)" stroke="#facc15" strokeWidth="2.5" />
              <text x="0" y={-(labelY + 34)} fill="#fef08a" fontSize="14" fontWeight="900" textAnchor="middle" alignmentBaseline="middle">
                🎯 {titleText}
              </text>
              <text x="0" y={-(labelY + 17)} fill="#38bdf8" fontSize="11" fontWeight="bold" fontFamily="monospace" textAnchor="middle" alignmentBaseline="middle">
                {coordsText}
              </text>
            </g>
          </g>
        );
      })()}
    </g>
  );
}

export default React.memo(AllianceView, (prev, next) => {
  return prev.validPlayers === next.validPlayers &&
         prev.allianceStructures === next.allianceStructures &&
         prev.hiveGridMeta === next.hiveGridMeta &&
         prev.isEditMode === next.isEditMode &&
         prev.inverseScale === next.inverseScale &&
         prev.highlightedEntity === next.highlightedEntity;
});