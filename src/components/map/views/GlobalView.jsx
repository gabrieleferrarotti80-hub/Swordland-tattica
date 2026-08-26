import React from 'react';
import { useTranslation } from 'react-i18next';
import { getGlobalShapePts, GRID_SIZES } from '../utils/mapUtilsGen';

const getPlayerRank = (player) => {
  if (!player) return 'other';
  const roleStr = String(player.role || player.rank || '').toUpperCase().trim();
  if (roleStr === 'R5' || roleStr === '5' || roleStr.includes('LEADER') || roleStr.includes('CAPO')) return 'R5';
  if (roleStr === 'R4' || roleStr === '4' || roleStr.includes('OFFICER') || roleStr.includes('UFFICIALE')) return 'R4';
  return 'other';
};

export default function GlobalView(props) {
  const { t } = useTranslation();
  const { 
    fixedBuildings, 
    allianceStructures, 
    enemyHQs = [],
    validPlayers, 
    inverseScale, 
    scale,
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
    setDraggedPlayerId
  } = props;

  let BUILDING_SCALE = 1.0;
  if (scale < 0.3) BUILDING_SCALE = 1.8;
  else if (scale < 0.5) BUILDING_SCALE = 1.4;
  else if (scale < 0.8) BUILDING_SCALE = 1.2;

  const shapeCastle = getGlobalShapePts(GRID_SIZES.CASTLE, BUILDING_SCALE);
  const shapeMajor  = getGlobalShapePts(GRID_SIZES.MAJOR, BUILDING_SCALE);
  const shapeMinor  = getGlobalShapePts(GRID_SIZES.MINOR, BUILDING_SCALE);
  const shapePlayer = getGlobalShapePts(GRID_SIZES.PLAYER, BUILDING_SCALE);

  return (
    <g>
      {fixedBuildings.map(building => {
        const bType = building.type ? building.type.toLowerCase() : '';
        const bName = building.name.toLowerCase();

        const isCastle = bType === 'castle' || bName.includes('castello');
        const isSantuario = bType === 'sanctuary' || bName.includes('santuario');
        const isFortezza = bType === 'fortress' || bName.includes('fortezza');
        const isBuilder = bType === 'builders guild' || bName.includes('builder');
        const isForager = bType === 'forager grove' || bName.includes('forager');
        const isHarvest = bType === 'harvest alter' || bName.includes('harvest');
        const isScholar = bType === 'scholars tower' || bName.includes('scholar');
        const isArmory = bType === 'armory' || bName.includes('armory');
        const isArsenal = bType === 'arsenal' || bName.includes('arsenal');
        const isDrill = bType === 'drill camp' || bName.includes('drill');
        const isFrontier = bType === 'frontier lodge' || bName.includes('frontier');
        
        const isMajorBuilding = isCastle || isSantuario || isFortezza;
        const isOther = !isMajorBuilding && !isBuilder && !isForager && !isHarvest && !isScholar && !isArmory && !isArsenal && !isDrill && !isFrontier;

        if (isCastle && !filters.castle) return null;
        if (isSantuario && !filters.santuari) return null;
        if (isFortezza && !filters.fortezze) return null;
        if (isBuilder && !filters.builders) return null;
        if (isForager && !filters.forager) return null;
        if (isHarvest && !filters.harvest) return null;
        if (isScholar && !filters.scholar) return null;
        if (isArmory && !filters.armory) return null;
        if (isArsenal && !filters.arsenal) return null;
        if (isDrill && !filters.drill) return null;
        if (isFrontier && !filters.frontier) return null;
        if (isOther && !filters.others) return null;

        let buildingShape = shapeMinor;
        if (isCastle) buildingShape = shapeCastle;
        else if (isSantuario || isFortezza) buildingShape = shapeMajor;

        let fillColor = "rgba(148, 163, 184, 0.6)"; 
        let strokeColor = "#94a3b8";
        if (isCastle) { fillColor = "rgba(250, 204, 21, 0.7)"; strokeColor = "#facc15"; }
        else if (isSantuario || isFortezza) { fillColor = "rgba(168, 85, 247, 0.7)"; strokeColor = "#a855f7"; }
        else if (isBuilder) { fillColor = "rgba(251, 146, 60, 0.6)"; strokeColor = "#fb923c"; }
        else if (isForager) { fillColor = "rgba(16, 185, 129, 0.6)"; strokeColor = "#10b981"; }
        else if (isHarvest) { fillColor = "rgba(163, 230, 53, 0.6)"; strokeColor = "#a3e635"; }
        else if (isScholar) { fillColor = "rgba(99, 102, 241, 0.6)"; strokeColor = "#6366f1"; }
        else if (isArmory) { fillColor = "rgba(244, 63, 94, 0.6)"; strokeColor = "#f43f5e"; }
        else if (isArsenal) { fillColor = "rgba(239, 68, 68, 0.6)"; strokeColor = "#ef4444"; }
        else if (isDrill) { fillColor = "rgba(20, 184, 166, 0.6)"; strokeColor = "#14b8a6"; }
        else if (isFrontier) { fillColor = "rgba(56, 189, 248, 0.6)"; strokeColor = "#38bdf8"; }

        const cx = 600 + (Number(building.x) - Number(building.y)) * TILE_SF;
        const cy = 1150 - (Number(building.x) + Number(building.y)) * TILE_SF;

        const isSelected = selectedBuilding?.id === building.id;
        const isOrigin = marchOrigin?.id === building.id;
        const isDestination = marchDestination?.id === building.id;

        let currentStrokeWidth = 1.5;
        if (isOrigin) { fillColor = "rgba(6, 182, 212, 0.8)"; strokeColor = "#22d3ee"; currentStrokeWidth = 2.5; }
        else if (isDestination) { currentStrokeWidth = 2.5; }
        if (isSelected) { strokeColor = "#ffffff"; currentStrokeWidth = 3; }

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
              transform={`scale(${inverseScale})`} 
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth={currentStrokeWidth}
              className={`transition-colors duration-300 ${!isSelected && "group-hover:opacity-80"}`}
            />

            <g transform={`scale(${inverseScale})`} className="pointer-events-none z-50">
              {isOrigin && <text x="-12" y="24" fill="#ffffff" fontSize="12" fontWeight="black">🛫</text>}
              {isDestination && <text x="-12" y="24" fill="#ffffff" fontSize="12" fontWeight="black">🎯</text>}

              <g className={`${showLabels || isSelected || isOrigin || isDestination ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity duration-200`}>
                <rect x="15" y="-15" width="160" height="32" rx="6" fill="rgba(15, 23, 42, 0.95)" stroke="rgba(51, 65, 85, 0.8)" strokeWidth="1" className="shadow-lg" />
                <text x="21" y="0" fill="#ffffff" fontSize="11" fontWeight="bold">[{building.code}] {building.name}</text>
                <text x="21" y="12" fill="#94a3b8" fontSize="9" fontWeight="bold">({building.x}, {building.y}){building.occupiedBy ? ` | ${t('alliance_view.occupied', 'Occupato: ')}${building.occupiedBy}` : ''}</text>
              </g>
            </g>
          </g>
        );
      })}

      {allianceStructures.filter(s => s.type === 'headquarters').map(struct => {
        if (!filters.allianceHQ) return null;

        const cx = 600 + (Number(struct.x) - Number(struct.y)) * TILE_SF;
        const cy = 1150 - (Number(struct.x) + Number(struct.y)) * TILE_SF;

        const isSelected = selectedBuilding?.id === struct.id;
        const isOrigin = marchOrigin?.id === struct.id;
        const isDestination = marchDestination?.id === struct.id;

        return (
          <g
            key={struct.id}
            className="cursor-pointer group animate-fade-in"
            transform={`translate(${cx}, ${cy})`}
            onClick={(e) => {
              e.stopPropagation();
              if (selectedTool === 'distance') {
                if (!marchOrigin) setMarchOrigin(struct);
                else if (!marchDestination) setMarchDestination(struct);
                else { setMarchOrigin(struct); setMarchDestination(null); }
              } else {
                setSelectedBuilding(struct);
              }
            }}
          >
            <g transform={`scale(${inverseScale})`} className="drop-shadow-xl">
              <path d="M0 -16 Q -8 -16 -8 -8 Q -8 0 0 8 Q 8 0 8 -8 Q 8 -16 0 -16 Z" fill="#4f46e5" stroke={isSelected ? "#ffffff" : "#3730a3"} strokeWidth="1" className="transition-colors" />
              <circle cx="0" cy="-8" r="2.5" fill="#ffffff" />
            </g>

            <g transform={`scale(${inverseScale})`} className="pointer-events-none z-50">
              {isOrigin && <text x="-12" y="20" fill="#ffffff" fontSize="12" fontWeight="black">🛫</text>}
              {isDestination && <text x="-12" y="20" fill="#ffffff" fontSize="12" fontWeight="black">🎯</text>}

              <g className={`${showLabels || isSelected || isOrigin || isDestination ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity duration-200`}>
                <rect x="12" y="-12" width="150" height="28" rx="6" fill="rgba(15, 23, 42, 0.95)" stroke="rgba(79, 70, 229, 0.8)" strokeWidth="1" className="shadow-lg" />
                <text x="18" y="2" fill="#ffffff" fontSize="11" fontWeight="bold">[{struct.code}] {struct.name}</text>
                <text x="18" y="12" fill="#94a3b8" fontSize="9" fontWeight="bold">({struct.x}, {struct.y})</text>
              </g>
            </g>
          </g>
        );
      })}

      {enemyHQs && enemyHQs.map(hq => {
        const cx = 600 + (Number(hq.x) - Number(hq.y)) * TILE_SF;
        const cy = 1150 - (Number(hq.x) + Number(hq.y)) * TILE_SF;

        const isSelected = selectedBuilding?.id === hq.id;
        const isOrigin = marchOrigin?.id === hq.id;
        const isDestination = marchDestination?.id === hq.id;

        return (
          <g
            key={hq.id}
            className="cursor-pointer group animate-fade-in"
            transform={`translate(${cx}, ${cy})`}
            onClick={(e) => {
              e.stopPropagation();
              if (selectedTool === 'distance') {
                if (!marchOrigin) setMarchOrigin(hq);
                else if (!marchDestination) setMarchDestination(hq);
                else { setMarchOrigin(hq); setMarchDestination(null); }
              } else {
                setSelectedBuilding(hq); 
              }
            }}
          >
            <g transform={`scale(${inverseScale})`} className="drop-shadow-xl">
              <path d="M0 -16 Q -8 -16 -8 -8 Q -8 0 0 8 Q 8 0 8 -8 Q 8 -16 0 -16 Z" fill="#9f1239" stroke={isSelected ? "#ffffff" : "#4c0519"} strokeWidth="1" className="transition-colors" />
              <circle cx="0" cy="-8" r="2.5" fill="#fca5a5" />
            </g>

            <g transform={`scale(${inverseScale})`} className="pointer-events-none z-50">
              {isOrigin && <text x="-12" y="20" fill="#ffffff" fontSize="12" fontWeight="black">🛫</text>}
              {isDestination && <text x="-12" y="20" fill="#ffffff" fontSize="12" fontWeight="black">🎯</text>}

              <g className={`${showLabels || isSelected || isOrigin || isDestination ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity duration-200`}>
                <rect x="12" y="-12" width="160" height="28" rx="6" fill="rgba(15, 23, 42, 0.95)" stroke="rgba(159, 18, 57, 0.8)" strokeWidth="1" className="shadow-lg" />
                <text x="18" y="2" fill="#fda4af" fontSize="11" fontWeight="bold">{t('alliance_view.enemy_tag', '[NEMICO]')} {hq.name}</text>
                <text x="18" y="12" fill="#94a3b8" fontSize="9" fontWeight="bold">({hq.x}, {hq.y})</text>
              </g>
            </g>
          </g>
        );
      })}

      {validPlayers && validPlayers.map(player => {
        const rank = getPlayerRank(player);
        if (rank === 'R5' && !filters.alliesR5) return null;
        if (rank === 'R4' && !filters.alliesR4) return null;
        if (rank === 'other' && !filters.alliesOthers) return null;

        const isSelected = selectedBuilding?.id === player.id;
        const isOrigin = marchOrigin?.id === player.id;
        const isDestination = marchDestination?.id === player.id;

        let polyFill = "rgba(59, 130, 246, 0.7)", polyStroke = "#3b82f6", polyStrokeW = 1.5;
        
        if (rank === 'R5') { polyFill = "rgba(250, 204, 21, 0.8)"; polyStroke = "#fef08a"; polyStrokeW = 2.5; } 
        else if (rank === 'R4') { polyFill = "rgba(168, 85, 247, 0.7)"; polyStroke = "#a855f7"; }
        
        if (isOrigin) { polyFill = "rgba(6, 182, 212, 0.9)"; polyStroke = "#22d3ee"; polyStrokeW = 2.5; } 
        else if (isDestination) { polyStrokeW = 2.5; }
        if (isSelected) { polyStroke = "#ffffff"; polyStrokeW = 3; }

        return (
          <g 
            key={player.id} 
            className="cursor-pointer group animate-fade-in" 
            transform={`translate(${player.svgX}, ${player.svgY})`} 
            
            onMouseDown={(e) => {
              e.stopPropagation(); 
              if(setDraggedPlayerId) setDraggedPlayerId(player.id);
            }}

            onClick={(e) => { 
              e.stopPropagation(); 
              const target = { ...player, isPlayer: true, code: player.tag || 'PLY', type: t('alliance_view.member_type', 'Membro Alleanza'), x: player.numX, y: player.numY }; 
              if (selectedTool === 'distance') { 
                if (!marchOrigin) setMarchOrigin(target); 
                else if (!marchDestination) setMarchDestination(target); 
                else { setMarchOrigin(target); setMarchDestination(null); } 
              } else { 
                setSelectedBuilding(target); 
              } 
            }}
          >
            <polygon 
              points={shapePlayer} 
              transform={`scale(${inverseScale})`}
              fill={polyFill} 
              stroke={polyStroke} 
              strokeWidth={polyStrokeW} 
              className={`transition-colors duration-300 ${!isSelected && "group-hover:opacity-80"}`} 
            />
            
            <g transform={`scale(${inverseScale})`} className="pointer-events-none">
              {isOrigin && <text x="-10" y="20" fill="#ffffff" fontSize="12" fontWeight="black">🛫</text>}
              {isDestination && <text x="-10" y="20" fill="#ffffff" fontSize="12" fontWeight="black">🎯</text>}
              
              <g className={`${showLabels || isSelected || isOrigin || isDestination ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity duration-200`}>
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