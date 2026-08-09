import React from 'react';
import { useTranslation } from 'react-i18next';
import { getTacticalShapePts } from '../utils/mapUtilsGen';

const getPlayerRank = (player) => {
  if (!player) return 'other';
  const roleStr = String(player.role || player.rank || '').toUpperCase().trim();
  if (roleStr === 'R5' || roleStr === '5' || roleStr.includes('LEADER') || roleStr.includes('CAPO')) return 'R5';
  if (roleStr === 'R4' || roleStr === '4' || roleStr.includes('OFFICER') || roleStr.includes('UFFICIALE')) return 'R4';
  return 'other';
};

export default function AllianceView(props) {
  const { t } = useTranslation();

  const { 
    fixedBuildings, 
    allianceStructures, 
    validPlayers, 
    inverseScale, 
    TILE_SF, 
    filters,
    selectedBuilding,
    setSelectedBuilding,
    marchOrigin,
    setMarchOrigin,
    marchDestination,
    setMarchDestination,
    selectedTool,
    showLabels,
    setDraggedPlayerId,
    hiveGridMeta 
  } = props;

  const shapeMinor  = getTacticalShapePts(6, TILE_SF * 0.85); 
  const shapePlayer = getTacticalShapePts(2, TILE_SF * 0.85); 
  const shapeTrap   = getTacticalShapePts(4, TILE_SF * 0.85); 
  const shapeHQ     = getTacticalShapePts(6, TILE_SF * 0.85); 

  const getIsoPoint = (x, y) => ({
    svgX: 600 + (Number(x) - Number(y)) * TILE_SF,
    svgY: 1150 - (Number(x) + Number(y)) * TILE_SF
  });

  const hq = allianceStructures?.find(s => s.type === 'headquarters');
  const gridCenterX = hiveGridMeta?.centerX ?? (hq ? Number(hq.x) : 500);
  const gridCenterY = hiveGridMeta?.centerY ?? (hq ? Number(hq.y) : 500);
  const GRID_RADIUS = hiveGridMeta?.radius ?? 30;
  const showGrid = hiveGridMeta?.showGrid ?? true;
  
  const gridLines = [];
  const startX = Math.floor((gridCenterX - GRID_RADIUS) / 2) * 2;
  const endX = Math.ceil((gridCenterX + GRID_RADIUS) / 2) * 2;
  const startY = Math.floor((gridCenterY - GRID_RADIUS) / 2) * 2;
  const endY = Math.ceil((gridCenterY + GRID_RADIUS) / 2) * 2;

  if (showGrid) {
    for (let x = startX; x <= endX; x++) {
      const isMajor = x % 2 === 0;
      const strokeColor = isMajor ? "rgba(34, 211, 238, 0.2)" : "rgba(34, 211, 238, 0.05)";
      const strokeWidth = isMajor ? 1.5 * inverseScale : 0.5 * inverseScale;
      const pt1 = getIsoPoint(x, startY);
      const pt2 = getIsoPoint(x, endY);
      gridLines.push(<line key={`gx-${x}`} x1={pt1.svgX} y1={pt1.svgY} x2={pt2.svgX} y2={pt2.svgY} stroke={strokeColor} strokeWidth={strokeWidth} className="pointer-events-none" />);
    }

    for (let y = startY; y <= endY; y++) {
      const isMajor = y % 2 === 0; 
      const strokeColor = isMajor ? "rgba(34, 211, 238, 0.2)" : "rgba(34, 211, 238, 0.05)";
      const strokeWidth = isMajor ? 1.5 * inverseScale : 0.5 * inverseScale;
      const pt1 = getIsoPoint(startX, y);
      const pt2 = getIsoPoint(endX, y);
      gridLines.push(<line key={`gy-${y}`} x1={pt1.svgX} y1={pt1.svgY} x2={pt2.svgX} y2={pt2.svgY} stroke={strokeColor} strokeWidth={strokeWidth} className="pointer-events-none" />);
    }
  }

  const pTop = getIsoPoint(startX, startY);
  const pRight = getIsoPoint(endX, startY);
  const pBottom = getIsoPoint(endX, endY);
  const pLeft = getIsoPoint(startX, endY);

  // 🗺️ RENDER TERRITORIO ALLEANZA (Poligono personalizzato)
  const territory = hiveGridMeta?.territory || [];
  const validTerritory = territory.filter(p => p.x !== '' && p.y !== '' && p.x !== null && p.y !== null);
  let territoryPolygon = null;
  
  if (validTerritory.length >= 3) {
    const pts = validTerritory.map(p => {
      const iso = getIsoPoint(p.x, p.y);
      return `${iso.svgX},${iso.svgY}`;
    }).join(' ');
    
    territoryPolygon = (
      <polygon 
        points={pts} 
        fill="rgba(59, 130, 246, 0.15)" 
        stroke="rgba(59, 130, 246, 0.5)" 
        strokeWidth={3 * inverseScale} 
        strokeDasharray={`${8 * inverseScale} ${4 * inverseScale}`}
        className="pointer-events-none"
      />
    );
  }

  return (
    <g>
      {/* 1. RENDER PAVIMENTO E GRIGLIA DELL'ALVEARE */}
      {showGrid && (
        <g className="hive-tactical-grid">
          <polygon 
            points={`${pTop.svgX},${pTop.svgY} ${pRight.svgX},${pRight.svgY} ${pBottom.svgX},${pBottom.svgY} ${pLeft.svgX},${pLeft.svgY}`}
            fill="rgba(15, 23, 42, 0.3)" 
            stroke="rgba(34, 211, 238, 0.3)"
            strokeWidth={2 * inverseScale}
            className="pointer-events-none"
          />
          {gridLines}
        </g>
      )}

      {/* 2. RENDER CONFINI TERRITORIO */}
      {territoryPolygon}

      {/* 3. STRUTTURE MINORI FISSE */}
      {fixedBuildings.map(building => {
        const isCastle = building.type?.toLowerCase() === 'castle' || building.name.toLowerCase().includes('castello');
        if (isCastle || !filters.others) return null;

        const { svgX, svgY } = getIsoPoint(building.x, building.y);
        const isSelected = selectedBuilding?.id === building.id;

        return (
          <g
            key={building.id}
            className="cursor-pointer group"
            transform={`translate(${svgX}, ${svgY})`}
            onClick={(e) => { e.stopPropagation(); setSelectedBuilding(building); }}
          >
            <polygon points={shapeMinor} fill="rgba(148, 163, 184, 0.4)" stroke="#94a3b8" strokeWidth={2 * inverseScale} className={`transition-colors duration-300 ${!isSelected && "group-hover:opacity-80"}`} />
          </g>
        );
      })}

      {/* 4. QUARTIER GENERALE DELL'ALLEANZA */}
      {allianceStructures.filter(s => s.type === 'headquarters').map(struct => {
        if (!filters.allianceHQ) return null;

        const { svgX, svgY } = getIsoPoint(struct.x, struct.y);
        const isSelected = selectedBuilding?.id === struct.id;

        return (
          <g
            key={struct.id}
            className="cursor-pointer group animate-fade-in"
            transform={`translate(${svgX}, ${svgY})`}
            onClick={(e) => { e.stopPropagation(); setSelectedBuilding(struct); }}
          >
            <polygon points={shapeHQ} fill="rgba(79, 70, 229, 0.5)" stroke={isSelected ? "#ffffff" : "#4f46e5"} strokeWidth={3 * inverseScale} />
            <g transform={`scale(${inverseScale})`} className="pointer-events-none z-10"><text x="-12" y="6" fontSize="18">🏰</text></g>
            <g transform={`scale(${inverseScale})`} className="pointer-events-none z-50">
              <g className={`${showLabels || isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity duration-200`}>
                <rect x="20" y="-12" width="150" height="28" rx="6" fill="rgba(15, 23, 42, 0.95)" stroke="rgba(79, 70, 229, 0.8)" strokeWidth="1" className="shadow-lg" />
                <text x="26" y="2" fill="#ffffff" fontSize="11" fontWeight="bold">[{struct.code}] {struct.name}</text>
                <text x="26" y="12" fill="#94a3b8" fontSize="9" fontWeight="bold">({struct.x}, {struct.y})</text>
              </g>
            </g>
          </g>
        );
      })}

      {/* 5. TRAPPOLE PER ORSI */}
      {allianceStructures.filter(s => s.type === 'beartrap').map(struct => {
        if (!filters.allianceTraps) return null;

        const { svgX, svgY } = getIsoPoint(struct.x, struct.y);
        const isSelected = selectedBuilding?.id === struct.id;

        return (
          <g
            key={struct.id}
            className="cursor-pointer group animate-fade-in"
            transform={`translate(${svgX}, ${svgY})`}
            onClick={(e) => { e.stopPropagation(); setSelectedBuilding(struct); }}
          >
            <polygon points={shapeTrap} fill="rgba(239, 68, 68, 0.4)" stroke={isSelected ? "#ffffff" : "#ef4444"} strokeWidth={3 * inverseScale} />
            <g transform={`scale(${inverseScale})`} className="pointer-events-none z-10"><text x="-10" y="5" fontSize="16">🐻</text></g>
            <g transform={`scale(${inverseScale})`} className="pointer-events-none z-50">
              <g className={`${showLabels || isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity duration-200`}>
                <rect x="20" y="-12" width="160" height="28" rx="6" fill="rgba(15, 23, 42, 0.95)" stroke="rgba(239, 68, 68, 0.8)" strokeWidth="1" className="shadow-lg" />
                <text x="26" y="2" fill="#ffffff" fontSize="11" fontWeight="bold">[{struct.code}] {struct.name}</text>
                <text x="26" y="12" fill="#fca5a5" fontSize="9" fontWeight="bold">({struct.x}, {struct.y})</text>
              </g>
            </g>
          </g>
        );
      })}

      {/* 6. MEMBRI DELL'ALLEANZA */}
      {validPlayers && validPlayers.map(player => {
        const rank = getPlayerRank(player);
        if (rank === 'R5' && !filters.alliesR5) return null;
        if (rank === 'R4' && !filters.alliesR4) return null;
        if (rank === 'other' && !filters.alliesOthers) return null;

        const { svgX, svgY } = getIsoPoint(player.numX, player.numY);
        const isSelected = selectedBuilding?.id === player.id;

        let polyFill = "rgba(59, 130, 246, 0.7)", polyStroke = "#3b82f6", polyStrokeW = 2;
        if (rank === 'R5') { polyFill = "rgba(250, 204, 21, 0.8)"; polyStroke = "#fef08a"; polyStrokeW = 3; } 
        else if (rank === 'R4') { polyFill = "rgba(168, 85, 247, 0.7)"; polyStroke = "#a855f7"; }
        if (isSelected) { polyStroke = "#ffffff"; polyStrokeW = 4; }

        return (
          <g 
            key={player.id} 
            className="cursor-pointer group animate-fade-in" 
            transform={`translate(${svgX}, ${svgY})`} 
            onMouseDown={(e) => { e.stopPropagation(); if(setDraggedPlayerId) setDraggedPlayerId(player.id); }}
            onClick={(e) => { 
              e.stopPropagation(); 
              const target = { ...player, isPlayer: true, code: player.tag || 'PLY', type: t('alliance_view.member_type') }; 
              setSelectedBuilding(target); 
            }}
          >
            <polygon points={shapePlayer} fill={polyFill} stroke={polyStroke} strokeWidth={polyStrokeW * inverseScale} className={`transition-colors duration-300 ${!isSelected && "group-hover:opacity-80"}`} />
            <g transform={`scale(${inverseScale})`} className="pointer-events-none z-50">
              <g className={`${showLabels || isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity duration-200`}>
                <rect x="15" y="-12" width="130" height="32" rx="6" fill="rgba(15, 23, 42, 0.9)" stroke="rgba(51, 65, 85, 0.8)" strokeWidth="1" />
                <text x="21" y="2" fill="#ffffff" fontSize="11" fontWeight="bold">[{player.tag || 'PLY'}] {player.name}</text>
                <text x="21" y="14" fill={rank === 'R5' ? '#facc15' : rank === 'R4' ? '#c084fc' : '#60a5fa'} fontSize="9" fontWeight="bold">({player.numX}, {player.numY}) | {player.role || player.rank}</text>
              </g>
            </g>
          </g>
        );
      })}
    </g>
  );
}