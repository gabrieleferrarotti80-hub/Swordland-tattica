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
    fixedBuildings, validPlayers, inverseScale, TILE_SF,tacticalMeta,
    selectedBuilding, setSelectedBuilding, marchOrigin, setMarchOrigin,
    marchDestination, setMarchDestination, selectedTool, showLabels, setDraggedPlayerId
  } = props;

  const [gridCenter, setGridCenter] = useState(null);

  useEffect(() => {
    const castle = fixedBuildings.find(b => {
      const type = (b.type || '').toLowerCase();
      const name = (b.name || '').toLowerCase();
      return type === 'castle' || name.includes('castello');
    });
    if (castle) setGridCenter(castle);
  }, [fixedBuildings]); 

  const shapeCastle = getTacticalShapePts(GRID_SIZES.CASTLE, TILE_SF);
  const shapeTurret = getTacticalShapePts(1.5, TILE_SF);
  const shapePlayer = getTacticalShapePts(GRID_SIZES.PLAYER, TILE_SF);

  const castleBuildings = fixedBuildings.filter(b => {
    if (!b) return false;
    const bType = (b.type || '').toLowerCase();
    const bName = (b.name || '').toLowerCase();
    const bId = (b.id || '').toLowerCase();
    
    return bType === 'castle' || 
           bName.includes('castello') || 
           bType === 'turret' || 
           bName.includes('torretta') ||
           bId.includes('turret');
  });

  return (
    <g>
      {gridCenter && (() => {
        const cx = 600 + (Number(gridCenter.x) - Number(gridCenter.y)) * TILE_SF;
        const cy = 1150 - (Number(gridCenter.x) + Number(gridCenter.y)) * TILE_SF;
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

        const borderPts = `0,${2 * radius * TILE_SF} ${2 * radius * TILE_SF},0 0,${-2 * radius * TILE_SF} ${-2 * radius * TILE_SF},0`;

        return (
          <g transform={`translate(${cx}, ${cy})`} className="animate-fade-in pointer-events-none">
            <polygon points={borderPts} fill="rgba(34, 211, 238, 0.04)" stroke="rgba(34, 211, 238, 0.5)" strokeWidth={2 * inverseScale} strokeDasharray={`${4 * inverseScale}, ${4 * inverseScale}`} />
            {gridLines}
          </g>
        );
      })()}

      {castleBuildings.map(building => {
        const bType = (building.type || '').toLowerCase();
        const bName = (building.name || '').toLowerCase();
        const isCastle = bType === 'castle' || bName.includes('castello');
        const buildingShape = isCastle ? shapeCastle : shapeTurret;
        
        let fillColor = isCastle ? "rgba(250, 204, 21, 0.5)" : "rgba(239, 68, 68, 0.9)"; 
        let strokeColor = isCastle ? "#facc15" : "#ff0000";

        const cx = 600 + (Number(building.x) - Number(building.y)) * TILE_SF;
        const cy = 1150 - (Number(building.x) + Number(building.y)) * TILE_SF;

        const isSelected = selectedBuilding?.id === building.id;
        const isOrigin = marchOrigin?.id === building.id;
        const isDestination = marchDestination?.id === building.id;

        let currentStrokeWidth = isCastle ? 2 : 3; 
        if (isOrigin) { fillColor = "rgba(6, 182, 212, 0.6)"; strokeColor = "#22d3ee"; currentStrokeWidth = 3; }
        else if (isDestination) { currentStrokeWidth = 3; }
        if (isSelected) { strokeColor = "#ffffff"; currentStrokeWidth = 4; }

        return (
          <g
            key={building.id}
            className="cursor-pointer group"
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
            <polygon points={buildingShape} fill={fillColor} stroke={strokeColor} strokeWidth={currentStrokeWidth * inverseScale} className={`transition-colors duration-300 ${!isSelected && "group-hover:opacity-80"}`} />
            <g transform={`scale(${inverseScale})`} className="pointer-events-none z-50">
              {!isCastle && !showLabels && !isSelected && <text x="0" y="5" fill="#ffffff" fontSize="14" fontWeight="black" textAnchor="middle" className="drop-shadow-md">T</text>}
              {isOrigin && <text x="-12" y="24" fill="#ffffff" fontSize="12" fontWeight="black">🛫</text>}
              {isDestination && <text x="-12" y="24" fill="#ffffff" fontSize="12" fontWeight="black">🎯</text>}
              <g className={`${showLabels || isSelected || isOrigin || isDestination ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity duration-200`}>
                <rect x="20" y="-12" width="140" height="28" rx="6" fill="rgba(15, 23, 42, 0.9)" stroke="rgba(51, 65, 85, 0.8)" strokeWidth="1" />
                <text x="26" y="2" fill="#ffffff" fontSize="11" fontWeight="bold">[{building.code}] {building.name}</text>
                <text x="26" y="12" fill="#94a3b8" fontSize="9" fontWeight="bold">({building.x}, {building.y}){building.occupiedBy ? ` | ${t('alliance_view.occupied', 'Occupato: ')}${building.occupiedBy}` : ''}</text>
              </g>
            </g>
          </g>
        );
      })}

      {validPlayers && validPlayers.map(player => {
        const isSelected = selectedBuilding?.id === player.id;
        const isOrigin = marchOrigin?.id === player.id;
        const isDestination = marchDestination?.id === player.id;

        let polyFill = "rgba(100, 116, 139, 0.3)"; 
        let polyStroke = "rgba(100, 116, 139, 0.6)";
        let polyStrokeW = 1;
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
            
            if (isLeader) { polyFill = baseColor; polyStroke = "#ffffff"; polyStrokeW = 3; } 
            else { polyFill = `${baseColor}60`; polyStroke = baseColor; polyStrokeW = 1.5; }
          }
        }

        if (isOrigin) { polyFill = "rgba(6, 182, 212, 0.9)"; polyStroke = "#22d3ee"; polyStrokeW = 3; } 
        else if (isDestination) { polyStrokeW = 3; }
        if (isSelected) { polyStroke = "#ffffff"; polyStrokeW = 4; }

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
                if (!marchOrigin) setOrigin(target); 
                else if (!marchDestination) setMarchDestination(target); 
                else { setMarchOrigin(target); setMarchDestination(null); } 
              } else { setSelectedBuilding(target); } 
            }}
          >
            <polygon points={shapePlayer} fill={polyFill} stroke={polyStroke} strokeWidth={polyStrokeW * inverseScale} className={`transition-colors duration-300 ${!isSelected && "group-hover:opacity-80"}`} />
            <g transform={`scale(${inverseScale})`} className="pointer-events-none">
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