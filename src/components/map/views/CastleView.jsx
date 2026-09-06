import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getTacticalShapePts, GRID_SIZES } from '../utils/mapUtilsGen';
import { TEAM_COLORS } from '../../../utils/tacticalDeployment';

const getPlayerRank = (player) => {
  if (!player) return 'other';
  const roleStr = String(player.role || player.rank || '').toUpperCase().trim();
  if (roleStr === 'R5' || roleStr === '5' || roleStr.includes('LEADER') || roleStr.includes('CAPO')) return 'R5';
  if (roleStr === 'R4' || roleStr === '4' || roleStr.includes('OFFICER') || roleStr.includes('UFFICIALE')) return 'R4';
  return 'other';
};

export default React.memo(function CastleView(props) {
  const { t } = useTranslation();
  const { 
    fixedBuildings, 
    validPlayers, 
    inverseScale, 
    TILE_SF, 
    tacticalMeta,
    selectedBuilding, 
    setSelectedBuilding, 
    marchOrigin, 
    setMarchOrigin,
    marchDestination, 
    setMarchDestination, 
    selectedTool, 
    showLabels, 
    setDraggedPlayerId 
  } = props;

  const [gridCenter, setGridCenter] = useState(null);

  useEffect(() => {
    const castle = (fixedBuildings || []).find(b => {
      const type = String(b.type || '').toLowerCase();
      const name = String(b.name || '').toLowerCase();
      return type === 'castle' || name.includes('castello');
    });
    if (castle) setGridCenter(castle);
  }, [fixedBuildings]); 

  // Filtro edifici di battaglia (Castello e Torrette)
  const battleBuildings = (fixedBuildings || []).filter(b => {
    if (!b) return false;
    const bType = String(b.type || '').toLowerCase();
    const bName = String(b.name || '').toLowerCase();
    const bId = String(b.id || '').toLowerCase();
    
    return bType === 'castle' || bName.includes('castello') || 
           bType === 'turret' || bName.includes('torretta') || bId.includes('turret');
  });

  const shapePlayer = getTacticalShapePts(GRID_SIZES?.PLAYER || 2, TILE_SF);

  return (
    <g>
      {/* GRIGLIA TATTICA LOCALIZZATA */}
      {gridCenter && (() => {
        const effX = Number(gridCenter.x) + 2;
        const effY = Number(gridCenter.y) + 2;
        const cx = 600 + (effX - effY) * TILE_SF;
        const cy = 1150 - (effX + effY) * TILE_SF;
        const radius = 22; 

        const gridLines = [];
        for (let i = -radius; i <= radius; i++) {
          const startX1 = (-radius - i) * TILE_SF;
          const startY1 = -(-radius + i) * TILE_SF;
          const endX1 = (radius - i) * TILE_SF;
          const endY1 = -(radius + i) * TILE_SF;
          gridLines.push(<line key={`x-${i}`} x1={startX1} y1={startY1} x2={endX1} y2={endY1} stroke="rgba(34, 211, 238, 0.15)" strokeWidth={1 * inverseScale} />);
          
          const startX2 = (i - (-radius)) * TILE_SF;
          const startY2 = -(i + (-radius)) * TILE_SF;
          const endX2 = (i - radius) * TILE_SF;
          const endY2 = -(i + radius) * TILE_SF;
          gridLines.push(<line key={`y-${i}`} x1={startX2} y1={startY2} x2={endX2} y2={endY2} stroke="rgba(34, 211, 238, 0.15)" strokeWidth={1 * inverseScale} />);
        }

        const borderPts = `0,${2 * radius * TILE_SF} ${2 * radius * TILE_SF},0 0,${-2 * radius * TILE_SF} -${2 * radius * TILE_SF},0`;

        return (
          <g transform={`translate(${cx}, ${cy})`} className="animate-fade-in pointer-events-none">
            <polygon points={borderPts} fill="rgba(34, 211, 238, 0.04)" stroke="rgba(34, 211, 238, 0.5)" strokeWidth={2 * inverseScale} strokeDasharray={`${4 * inverseScale}, ${4 * inverseScale}`} />
            {gridLines}
          </g>
        );
      })()}

      {/* EDIFICI (Logica strutturale identica a GlobalView) */}
      {battleBuildings.map(building => {
        const bType = String(building.type || '').toLowerCase();
        const bName = String(building.name || '').toLowerCase();
        const isCastle = bType === 'castle' || bName.includes('castello');
        
        let sizeNum = isCastle ? 14 : 3;
        if (building.size && !isNaN(building.size) && building.size !== "") {
          sizeNum = Number(building.size);
        }
        
        const S = sizeNum * TILE_SF;
        const buildingShape = `0,-${S} ${S},0 0,${S} -${S},0`;

        let fillColor = "rgba(239, 68, 68, 0.7)"; 
        let strokeColor = "#ef4444";
        if (isCastle) { 
          fillColor = "rgba(250, 204, 21, 0.7)"; 
          strokeColor = "#facc15"; 
        }

        let effectiveX = Number(building.x);
        let effectiveY = Number(building.y);

        if (isCastle) {
          effectiveX += 2;
          effectiveY += 2;
        }

        const cx = 600 + (effectiveX - effectiveY) * TILE_SF;
        const cy = 1150 - (effectiveX + effectiveY) * TILE_SF;

        const isSelected = selectedBuilding?.id === building.id;
        const isOrigin = marchOrigin?.id === building.id;
        const isDestination = marchDestination?.id === building.id;

        let currentStrokeWidth = 1.5 * inverseScale;
        if (isOrigin) { fillColor = "rgba(6, 182, 212, 0.8)"; strokeColor = "#22d3ee"; currentStrokeWidth = 2.5 * inverseScale; }
        else if (isDestination) { currentStrokeWidth = 2.5 * inverseScale; }
        if (isSelected) { strokeColor = "#ffffff"; currentStrokeWidth = 3 * inverseScale; }

        return (
          <g
            key={building.id}
            className="cursor-pointer group animate-fade-in"
            transform={`translate(${cx}, ${cy})`}
            onClick={(e) => {
              e.stopPropagation();
              if (selectedTool === 'distance') {
                if (!marchOrigin) setMarchOrigin(building);
                else if (!marchDestination) setMarchDestination(building);
                else { setMarchOrigin(building); setMarchDestination(null); }
              } else {
                setSelectedBuilding(building); 
              }
            }}
          >
            <polygon
              points={buildingShape}
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth={currentStrokeWidth}
              className={`transition-colors duration-300 ${!isSelected && "group-hover:opacity-80"}`}
            />

            <g transform={`scale(${inverseScale})`} className="pointer-events-none z-50">
              {!isCastle && !showLabels && !isSelected && (
                <text x="0" y="5" fill="#ffffff" fontSize="16" fontWeight="black" textAnchor="middle" className="drop-shadow-md">T</text>
              )}
              {isOrigin && <text x="-12" y="24" fill="#ffffff" fontSize="12" fontWeight="black">🛫</text>}
              {isDestination && <text x="-12" y="24" fill="#ffffff" fontSize="12" fontWeight="black">🎯</text>}

              <g className={`${showLabels || isSelected || isOrigin || isDestination ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity duration-200`}>
                <rect x="15" y="-15" width="160" height="32" rx="6" fill="rgba(15, 23, 42, 0.95)" stroke="rgba(51, 65, 85, 0.8)" strokeWidth="1" className="shadow-lg" />
                <text x="21" y="0" fill="#ffffff" fontSize="11" fontWeight="bold">[{building.code || 'BLD'}] {building.name}</text>
                <text x="21" y="12" fill="#94a3b8" fontSize="9" fontWeight="bold">({building.x}, {building.y}){building.size ? ` | ${building.size}` : ''}</text>
              </g>
            </g>
          </g>
        );
      })}

      {/* GIOCATORI TATTICI (Logica originale intatta con svgX, svgY e Team Draft) */}
      {validPlayers && validPlayers.map(player => {
        const isSelected = selectedBuilding?.id === player.id;
        const isOrigin = marchOrigin?.id === player.id;
        const isDestination = marchDestination?.id === player.id;

        let polyFill = "rgba(100, 116, 139, 0.3)"; 
        let polyStroke = "rgba(100, 116, 139, 0.6)";
        let polyStrokeW = 1 * inverseScale;
        let isLeader = false;
        let roleText = player.role || player.rank || 'Membro';

        if (tacticalMeta?.draftData) {
          const meta = tacticalMeta.draftData.playerMeta[player.id];
          if (meta?.teamId) {
            const teams = tacticalMeta.draftData.teams;
            const teamIndex = teams.findIndex(t => t.id === meta.teamId);
            const baseColor = TEAM_COLORS[teamIndex % TEAM_COLORS.length];
            
            isLeader = (meta.role === 'Rally Leader' || meta.role === 'Capitano Difesa');
            if (meta.role) roleText = meta.role; 
            
            if (isLeader) { polyFill = baseColor; polyStroke = "#ffffff"; polyStrokeW = 3 * inverseScale; } 
            else { polyFill = `${baseColor}60`; polyStroke = baseColor; polyStrokeW = 1.5 * inverseScale; }
          }
        }

        if (isOrigin) { polyFill = "rgba(6, 182, 212, 0.9)"; polyStroke = "#22d3ee"; polyStrokeW = 3 * inverseScale; } 
        else if (isDestination) { polyStrokeW = 3 * inverseScale; }
        if (isSelected) { polyStroke = "#ffffff"; polyStrokeW = 4 * inverseScale; }

        return (
          <g 
            key={player.id} 
            className="cursor-pointer group animate-fade-in" 
            transform={`translate(${player.svgX}, ${player.svgY})`} 
            onMouseDown={(e) => { e.stopPropagation(); if(setDraggedPlayerId) setDraggedPlayerId(player.id); }}
            onClick={(e) => { 
              e.stopPropagation(); 
              const target = { ...player, isPlayer: true, code: player.originalTag || player.tag || 'PLY', type: t('alliance_view.member_type', 'Membro Alleanza'), x: player.numX, y: player.numY }; 
              if (selectedTool === 'distance') { 
                if (!marchOrigin) setMarchOrigin(target); 
                else if (!marchDestination) setMarchDestination(target); 
                else { setMarchOrigin(target); setMarchDestination(null); } 
              } else { setSelectedBuilding(target); } 
            }}
          >
            <polygon points={shapePlayer} fill={polyFill} stroke={polyStroke} strokeWidth={polyStrokeW} className={`transition-colors duration-300 ${!isSelected && "group-hover:opacity-80"}`} />
            <g transform={`scale(${inverseScale})`} className="pointer-events-none">
              {isOrigin && <text x="-10" y="20" fill="#ffffff" fontSize="12" fontWeight="black">🛫</text>}
              {isDestination && <text x="-10" y="20" fill="#ffffff" fontSize="12" fontWeight="black">🎯</text>}
              <g className={`${showLabels || isSelected || isOrigin || isDestination ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity duration-200`}>
                <rect x="15" y="-12" width="130" height="32" rx="6" fill="rgba(15, 23, 42, 0.9)" stroke="rgba(51, 65, 85, 0.8)" strokeWidth="1" />
                <text x="21" y="2" fill="#ffffff" fontSize="11" fontWeight="bold">[{player.originalTag || player.tag || 'PLY'}] {player.name}</text>
                <text x="21" y="14" fill={isLeader ? '#facc15' : '#60a5fa'} fontSize="9" fontWeight="bold">({player.numX}, {player.numY}) | {roleText}</text>
              </g>
            </g>
          </g>
        );
      })}
    </g>
  );
});