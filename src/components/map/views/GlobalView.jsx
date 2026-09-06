import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

const getPlayerRank = (player) => {
  if (!player) return 'other';
  const roleStr = String(player.role || player.rank || '').toUpperCase().trim();
  if (roleStr === 'R5' || roleStr === '5' || roleStr.includes('LEADER') || roleStr.includes('CAPO')) return 'R5';
  if (roleStr === 'R4' || roleStr === '4' || roleStr.includes('OFFICER') || roleStr.includes('UFFICIALE')) return 'R4';
  return 'other';
};

const getBuffLabel = (b) => {
  if (!b || !b.type) return "";
  const isPercent = b.type.includes('%');
  const name = b.type.replace(/\s?%\s?/, '').trim();
  return `⚡ ${name}: ${b.value || 0}${isPercent ? '%' : ''}`;
};

const getRewardLabel = (r) => {
  if (!r || !r.type) return "";
  const map = { gems: 'Gemme/Ora', alliance_pts: 'Punti/Ora', resources: 'Risorse/Ora', hero_fragments: 'Frammenti Eroe', teleports: 'Teletrasporti', mythic_expedition: 'Spedizioni Mitiche', skill_books: 'Libri', speedups: 'Acceleratori', equip_xp: 'XP Equip.', hero_xp: 'XP Eroe' };
  const name = map[r.type] || r.type;
  return `🎁 ${name}: +${r.value || 0}`;
};

export default function GlobalView(props) {
  const { t } = useTranslation();
  const { 
    fixedBuildings, 
    allianceStructures, 
    enemyHQs = [],
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
    isGlobalEditorMode,
    globalEditorTool,
    globalResourceZones = [],
    setGlobalResourceZones,
    activeZoneId
  } = props;

  const [previewPt, setPreviewPt] = useState(null);

  const isDrawingResources = isGlobalEditorMode && globalEditorTool === 'resources';
  
  const handleMouseMove = (e) => {
    if (!isDrawingResources) {
      if (previewPt) setPreviewPt(null);
      return;
    }
    const svgElement = document.getElementById('map-svg');
    if (!svgElement) return;
    const pt = svgElement.createSVGPoint();
    pt.x = e.clientX; 
    pt.y = e.clientY;
    const ctm = svgElement.getScreenCTM();
    if (!ctm) return;
    const svgPoint = pt.matrixTransform(ctm.inverse());
    
    const diffX = (svgPoint.x - 600) / TILE_SF;
    const sumY = (1150 - svgPoint.y) / TILE_SF;
    const gameX = Math.round((diffX + sumY) / 2);
    const gameY = Math.round((sumY - diffX) / 2);
    
    const snappedSvgX = 600 + (gameX - gameY) * TILE_SF;
    const snappedSvgY = 1150 - (gameX + gameY) * TILE_SF;

    setPreviewPt({ gameX, gameY, svgX: snappedSvgX, svgY: snappedSvgY });
  };

  const handleSvgClick = (e) => {
    e.stopPropagation(); 
    if (!isDrawingResources || !setGlobalResourceZones || !previewPt) return;
    
    const targetZone = globalResourceZones.find(z => z.id === activeZoneId) || globalResourceZones[0];
    
    if (!targetZone) {
      return;
    }

    const newPoints = [...(targetZone.points || []), { x: previewPt.gameX, y: previewPt.gameY }];
    
    const updatedZones = globalResourceZones.map(z => 
      z.id === targetZone.id ? { ...z, points: newPoints } : z
    );
    
    setGlobalResourceZones(updatedZones);
  };

  const getResourcePolygon = (zonePts) => {
    if (!zonePts || zonePts.length < 3) return null;
    return zonePts.map(p => {
      const px = 600 + (Number(p.x) - Number(p.y)) * TILE_SF;
      const py = 1150 - (Number(p.x) + Number(p.y)) * TILE_SF;
      return `${px},${py}`;
    }).join(' ');
  };

  return (
    <g onMouseMove={handleMouseMove} onClick={isDrawingResources ? handleSvgClick : undefined}>
      <defs>
        <pattern id="iso-grid" width="1" height="1" patternUnits="userSpaceOnUse">
          <rect 
            width="1" 
            height="1" 
            fill="none" 
            stroke="rgba(255, 255, 255, 0.15)" 
            vectorEffect="non-scaling-stroke" 
            strokeWidth={1.5 * (inverseScale || 1)} 
          />
        </pattern>
      </defs>

      {inverseScale < 0.6 && (
        <rect 
          x="0" 
          y="0" 
          width="1200" 
          height="1200" 
          fill="url(#iso-grid)" 
          transform={`matrix(${TILE_SF}, -${TILE_SF}, -${TILE_SF}, -${TILE_SF}, 600, 1150)`} 
          pointerEvents="none" 
        />
      )}
      
      {globalResourceZones && globalResourceZones.map((zone, idx) => {
        const polyStr = getResourcePolygon(zone.points);
        if (!polyStr) return null;
        
        const colors = [
          { fill: "rgba(16, 185, 129, 0.1)", stroke: "#10b981" },
          { fill: "rgba(59, 130, 246, 0.1)", stroke: "#3b82f6" },
          { fill: "rgba(245, 158, 11, 0.1)", stroke: "#f59e0b" } 
        ];
        const theme = colors[idx % colors.length];

        return (
          <g key={zone.id || idx}>
            <polygon points={polyStr} fill={theme.fill} stroke={theme.stroke} strokeWidth={2 * inverseScale} strokeDasharray="8 8" />
            {isDrawingResources && zone.points.map((pt, i) => {
               const px = 600 + (Number(pt.x) - Number(pt.y)) * TILE_SF;
               const py = 1150 - (Number(pt.x) + Number(pt.y)) * TILE_SF;
               return <circle key={i} cx={px} cy={py} r={4 * inverseScale} fill="#e11d48" />;
            })}
          </g>
        );
      })}

      {isDrawingResources && previewPt && (
        <g pointerEvents="none">
          <polygon 
            points={`${previewPt.svgX},${previewPt.svgY + TILE_SF} ${previewPt.svgX + TILE_SF},${previewPt.svgY} ${previewPt.svgX},${previewPt.svgY - TILE_SF} ${previewPt.svgX - TILE_SF},${previewPt.svgY}`} 
            fill="rgba(225, 29, 72, 0.4)" stroke="#e11d48" strokeWidth={2 * inverseScale} 
          />
          <g transform={`translate(${previewPt.svgX}, ${previewPt.svgY}) scale(${inverseScale})`}>
            <rect x="15" y="-35" width="80" height="24" rx="4" fill="rgba(15, 23, 42, 0.95)" stroke="#e11d48" strokeWidth="1.5" />
            <text x="55" y="-18" fill="#fff" fontSize="12" fontWeight="bold" textAnchor="middle" alignmentBaseline="middle">{previewPt.gameX}, {previewPt.gameY}</text>
          </g>
        </g>
      )}

      {isDrawingResources && (
        <rect width="1200" height="1200" fill="transparent" style={{ cursor: 'crosshair' }} />
      )}

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

        let sizeNum = isCastle ? 14 : (isSantuario || isFortezza ? 5 : 3);
        if (building.size && !isNaN(building.size) && building.size !== "") {
          sizeNum = Number(building.size);
        }
        
        // --- LOGICA DI VISUALIZZAZIONE COSTANTE E REALE ---
        // baseS è la dimensione fisica esatta sulla griglia di gioco
        const baseS = sizeNum * TILE_SF;
        
        // minVisualSize stabilisce la soglia minima di "pixel" su schermo a cui si ferma l'edificio
        let minVisualSize = 10;
        if (isCastle) minVisualSize = 18;
        else if (isMajorBuilding) minVisualSize = 14;

        // Se sei zoomato fuori, vince minVisualSize. Se sei molto vicino, vince baseS (aderendo alla griglia reale)
        const S = Math.max(baseS, minVisualSize * inverseScale);
        const buildingShape = `0,-${S} ${S},0 0,${S} -${S},0`;

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

        const hasBuff = building.buffs && building.buffs.type;
        const hasReward = building.rewards && building.rewards.type;
        
        let tooltipHeight = 32;
        if (hasBuff) tooltipHeight += 14;
        if (hasReward) tooltipHeight += 14;

        let currentStrokeWidth = 1.5 * inverseScale;
        if (isOrigin) { fillColor = "rgba(6, 182, 212, 0.8)"; strokeColor = "#22d3ee"; currentStrokeWidth = 2.5 * inverseScale; }
        else if (isDestination) { currentStrokeWidth = 2.5 * inverseScale; }
        if (isSelected) { strokeColor = "#ffffff"; currentStrokeWidth = 3 * inverseScale; }

        return (
          <g
            key={building.id}
            className="cursor-pointer group animate-fade-in"
            transform={`translate(${cx}, ${cy})`}
            onMouseDown={(e) => {
              if (isGlobalEditorMode && globalEditorTool === 'buildings' && setDraggedPlayerId) {
                e.stopPropagation();
                setDraggedPlayerId(`building:${building.id}`);
              }
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (isGlobalEditorMode && globalEditorTool === 'buildings') {
                 // Editor logic
              } else if (selectedTool === 'distance') {
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
              {isOrigin && <text x="-12" y="24" fill="#ffffff" fontSize="12" fontWeight="black">🛫</text>}
              {isDestination && <text x="-12" y="24" fill="#ffffff" fontSize="12" fontWeight="black">🎯</text>}

              <g className={`${showLabels || isSelected || isOrigin || isDestination ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity duration-200`}>
                <rect x="15" y="-15" width="180" height={tooltipHeight} rx="6" fill="rgba(15, 23, 42, 0.95)" stroke="rgba(51, 65, 85, 0.8)" strokeWidth="1" className="shadow-lg" />
                <text x="21" y="0" fill="#ffffff" fontSize="11" fontWeight="bold">[{building.code}] {building.name}</text>
                <text x="21" y="12" fill="#94a3b8" fontSize="9" fontWeight="bold">({building.x}, {building.y}){building.size ? ` | ${building.size}` : ''}</text>
                {hasBuff && <text x="21" y="26" fill="#fbbf24" fontSize="9" fontWeight="bold">{getBuffLabel(building.buffs)}</text>}
                {hasReward && <text x="21" y={hasBuff ? 40 : 26} fill="#34d399" fontSize="9" fontWeight="bold">{getRewardLabel(building.rewards)}</text>}
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
          <g key={struct.id} className="cursor-pointer group animate-fade-in" transform={`translate(${cx}, ${cy})`} onClick={(e) => { e.stopPropagation(); if (selectedTool === 'distance') { if (!marchOrigin) setMarchOrigin(struct); else if (!marchDestination) setMarchDestination(struct); else { setMarchOrigin(struct); setMarchDestination(null); } } else { setSelectedBuilding(struct); } }}>
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
          <g key={hq.id} className="cursor-pointer group animate-fade-in" transform={`translate(${cx}, ${cy})`} onClick={(e) => { e.stopPropagation(); if (selectedTool === 'distance') { if (!marchOrigin) setMarchOrigin(hq); else if (!marchDestination) setMarchDestination(hq); else { setMarchOrigin(hq); setMarchDestination(null); } } else { setSelectedBuilding(hq); } }}>
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

        let polyFill = "rgba(59, 130, 246, 0.7)", polyStroke = "#3b82f6", polyStrokeW = 1.5 * inverseScale;
        if (rank === 'R5') { polyFill = "rgba(250, 204, 21, 0.8)"; polyStroke = "#fef08a"; polyStrokeW = 2.5 * inverseScale; } 
        else if (rank === 'R4') { polyFill = "rgba(168, 85, 247, 0.7)"; polyStroke = "#a855f7"; }
        
        if (isOrigin) { polyFill = "rgba(6, 182, 212, 0.9)"; polyStroke = "#22d3ee"; polyStrokeW = 2.5 * inverseScale; } 
        else if (isDestination) { polyStrokeW = 2.5 * inverseScale; }
        if (isSelected) { polyStroke = "#ffffff"; polyStrokeW = 3 * inverseScale; }

        // --- STESSA LOGICA DI ZOOM ANCHE PER I GIOCATORI ---
        const pSize = 2;
        const pBaseS = pSize * TILE_SF;
        const pMinVisualSize = 8;
        const p_S = Math.max(pBaseS, pMinVisualSize * inverseScale);
        
        const shapePlayer = `0,-${p_S} ${p_S},0 0,${p_S} -${p_S},0`;
        
        const pEffectiveX = Number(player.numX);
        const pEffectiveY = Number(player.numY);
        const pcx = 600 + (pEffectiveX - pEffectiveY) * TILE_SF;
        const pcy = 1150 - (pEffectiveX + pEffectiveY) * TILE_SF;

        return (
          <g key={player.id} className="cursor-pointer group animate-fade-in" transform={`translate(${pcx}, ${pcy})`} onMouseDown={(e) => { e.stopPropagation(); if(setDraggedPlayerId) setDraggedPlayerId(player.id); }} onClick={(e) => { e.stopPropagation(); const target = { ...player, isPlayer: true, code: player.tag || 'PLY', type: t('alliance_view.member_type', 'Membro Alleanza'), x: player.numX, y: player.numY }; if (selectedTool === 'distance') { if (!marchOrigin) setOrigin(target); else if (!marchDestination) setMarchDestination(target); else { setMarchOrigin(target); setMarchDestination(null); } } else { setSelectedBuilding(target); } }}>
            <polygon points={shapePlayer} fill={polyFill} stroke={polyStroke} strokeWidth={polyStrokeW} className={`transition-colors duration-300 ${!isSelected && "group-hover:opacity-80"}`} />
            
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