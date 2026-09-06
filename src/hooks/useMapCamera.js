import { useState, useEffect, useCallback, useRef } from 'react';
import { svgToGameCoordinates } from '../utils/marchUtils';

export function useMapCamera({
  mainRef, activeView, selectedBuilding, eventMode, allianceCode,
  fixedBuildings, validPlayers, allianceStructures, TILE_SF, isReadOnly, t,
  handleAllianceStructureChange, setPlayerOverrides
}) {
  const [scale, setScale] = useState(0.8);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [draggedPlayerId, setDraggedPlayerId] = useState(null);
  
  const lastFramedKey = useRef(null);

  const getClampedPosition = useCallback((newPos, currentScale) => {
    if (!mainRef.current) return newPos;
    const rect = mainRef.current.getBoundingClientRect();
    
    if (activeView === 'alliance') {
      const centerTarget = allianceStructures?.find(s => s.id === 'alliance-bear-1') 
                        || allianceStructures?.find(s => s.type === 'beartrap') 
                        || allianceStructures?.find(s => s.type === 'headquarters') 
                        || { x: 500, y: 500 };
      
      let effX = Number(centerTarget.x);
      let effY = Number(centerTarget.y);
      if (centerTarget.type === 'headquarters' || centerTarget.type === 'beartrap') {
        effX += 0.5;
        effY += 0.5;
      }

      const targetX = 600 + (effX - effY) * TILE_SF;
      const targetY = 1150 - (effX + effY) * TILE_SF;
      
      const centerX = (rect.width / 2) - (targetX * currentScale);
      const centerY = (rect.height / 2) - (targetY * currentScale);
      
      // Limite di trascinamento ampliato per zoom molto spinti
      const maxDragDistance = 2500 * currentScale;

      return {
        x: Math.max(centerX - maxDragDistance, Math.min(centerX + maxDragDistance, newPos.x)),
        y: Math.max(centerY - maxDragDistance, Math.min(centerY + maxDragDistance, newPos.y))
      };
    }
    
    return {
      x: Math.max(-10000 * currentScale, Math.min(10000 * currentScale, newPos.x)),
      y: Math.max(-10000 * currentScale, Math.min(10000 * currentScale, newPos.y))
    };
  }, [activeView, allianceStructures, TILE_SF, mainRef]);

  useEffect(() => {
    const mapNode = mainRef.current;
    if (!mapNode) return;

    let isDataLoaded = false;
    let targetCoordsForMemory = "0,0";

    if (activeView === 'global') {
      isDataLoaded = allianceCode === 'DEMO' || (fixedBuildings && fixedBuildings.length > 0);
    } else if (activeView === 'alliance') {
      isDataLoaded = allianceStructures && allianceStructures.length > 0;
      
      const centerTarget = allianceStructures?.find(s => s.id === 'alliance-bear-1') 
                        || allianceStructures?.find(s => s.type === 'beartrap') 
                        || allianceStructures?.find(s => s.type === 'headquarters');
                        
      if (centerTarget) {
        targetCoordsForMemory = `${centerTarget.x},${centerTarget.y}`;
      }
    } else {
      isDataLoaded = true;
    }

    const currentKey = `${activeView}-${selectedBuilding?.id || 'none'}-${eventMode}-${isDataLoaded}-${targetCoordsForMemory}`;

    const doFrame = () => {
      const rect = mapNode.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;

      if (activeView === 'global') {
        const castle = fixedBuildings?.find(b => b.type?.toLowerCase() === 'castle' || b.name?.toLowerCase().includes('castello'));
        let targetX = 600, targetY = 600;
        
        if (allianceCode === 'DEMO') {
          targetX = 600; targetY = 1150 - 1600 * TILE_SF;
        } else if (castle) {
          targetX = 600 + (Number(castle.x) - Number(castle.y)) * TILE_SF;
          targetY = 1150 - (Number(castle.x) + Number(castle.y)) * TILE_SF;
        }
        
        const baseMapSize = 1000;
        const targetScale = Math.max(rect.width / baseMapSize, rect.height / baseMapSize);
        setPosition({ x: (rect.width / 2) - (targetX * targetScale), y: (rect.height / 2) - (targetY * targetScale) });
        setScale(targetScale);

      } else if (activeView === 'alliance') {
        const centerTarget = allianceStructures?.find(s => s.id === 'alliance-bear-1') 
                          || allianceStructures?.find(s => s.type === 'beartrap') 
                          || allianceStructures?.find(s => s.type === 'headquarters') 
                          || { x: 500, y: 500 };
        
        let effX = Number(centerTarget.x);
        let effY = Number(centerTarget.y);
        
        if (centerTarget.type === 'headquarters' || centerTarget.type === 'beartrap') {
          effX += 0.5;
          effY += 0.5;
        }

        const targetX = 600 + (effX - effY) * TILE_SF;
        const targetY = 1150 - (effX + effY) * TILE_SF;
        
        // 🎯 FOCUS RISTRETTO: Inquadriamo un'area di soli 10 rombi (zoom 2.5x più vicino rispetto a prima)
        const viewSizeSvg = 10 * TILE_SF; 

        let targetScale = Math.min(
          (rect.width * 0.8) / viewSizeSvg,
          (rect.height * 0.8) / viewSizeSvg
        );

        // Aumentato il tetto massimo dello scale iniziale per permettere zoom più spinti
        targetScale = Math.max(5, Math.min(targetScale, 150));

        setPosition({ x: (rect.width / 2) - (targetX * targetScale), y: (rect.height / 2) - (targetY * targetScale) });
        setScale(targetScale);

      } else if (activeView === 'tactical') {
        const radiusInTiles = 14;
        const boundingBoxSvgSize = (radiusInTiles * 4) * TILE_SF; 
        
        let targetX = selectedBuilding ? selectedBuilding.x : (eventMode === 'castle_battle' ? 600 : null);
        let targetY = selectedBuilding ? selectedBuilding.y : (eventMode === 'castle_battle' ? 600 : null);

        if (targetX !== null && targetY !== null) {
          let targetScale = Math.min(rect.width / boundingBoxSvgSize, rect.height / boundingBoxSvgSize) * 0.95;
          if (!selectedBuilding && eventMode === 'castle_battle') targetScale = targetScale * 0.6; 
          targetScale = Math.max(0.3, Math.min(targetScale, 40));

          const bSvgX = 600 + (Number(targetX) - Number(targetY)) * TILE_SF;
          const bSvgY = 1150 - (Number(targetX) + Number(targetY)) * TILE_SF;
          
          setPosition({ x: (rect.width / 2) - (bSvgX * targetScale), y: (rect.height / 2) - (bSvgY * targetScale) });
          setScale(targetScale);
        }
      }
      return true;
    };

    if (lastFramedKey.current !== currentKey) {
      const success = doFrame();
      if (success) {
        lastFramedKey.current = currentKey;
      }
    }

  }, [activeView, selectedBuilding, fixedBuildings, allianceStructures, allianceCode, eventMode, TILE_SF]);

  useEffect(() => {
    const mapNode = mainRef.current;
    if (!mapNode) return;
    const preventBrowserScroll = (e) => e.preventDefault();
    mapNode.addEventListener('wheel', preventBrowserScroll, { passive: false });
    return () => mapNode.removeEventListener('wheel', preventBrowserScroll);
  }, [mainRef]);

  const handleWheel = (e) => {
    if (!mainRef.current) return;
    
    const zoomFactor = 1.1; 
    const direction = e.deltaY < 0 ? 1 : -1;
    let newScale = direction > 0 ? scale * zoomFactor : scale / zoomFactor;
    
    // Tetto dello zoom incrementato a 250 per permettere primi piani estremi
    newScale = Math.max(0.2, Math.min(newScale, 250));
    
    const rect = mainRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const scaleRatio = newScale / scale;
    
    const newRawPosition = { 
      x: mouseX - (mouseX - position.x) * scaleRatio, 
      y: mouseY - (mouseY - position.y) * scaleRatio 
    };

    setPosition(getClampedPosition(newRawPosition, newScale));
    setScale(newScale);
  };

  const handleMouseDown = (e) => { 
    setIsDragging(true); 
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y }); 
  };
  
  const handleMouseMove = (e) => { 
    if (draggedPlayerId && !isReadOnly) {
      const svgElement = document.getElementById('map-svg');
      if (!svgElement) return;
      const pt = svgElement.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      const svgPoint = pt.matrixTransform(svgElement.getScreenCTM().inverse());
      const coords = svgToGameCoordinates(svgPoint.x, svgPoint.y);

      if (String(draggedPlayerId).startsWith('structure:')) {
        const structId = draggedPlayerId.split(':')[1];
        handleAllianceStructureChange(structId, 'x', Math.round(coords.x));
        handleAllianceStructureChange(structId, 'y', Math.round(coords.y));
      } else {
        const playerId = String(draggedPlayerId).startsWith('player:') ? draggedPlayerId.split(':')[1] : draggedPlayerId;
        setPlayerOverrides(prev => ({ ...prev, [playerId]: { x: Math.round(coords.x), y: Math.round(coords.y) } }));
      }
    } 
    else if (isDragging) {
      const newRawPosition = { x: e.clientX - dragStart.x, y: e.clientY - dragStart.y };
      setPosition(getClampedPosition(newRawPosition, scale));
    }
  };
  
  const handleMouseUp = () => { 
    setIsDragging(false); 
    setDraggedPlayerId(null); 
  };

  const handleResetView = () => {
    if (!mainRef.current) return;
    const rect = mainRef.current.getBoundingClientRect();
    let targetX = 600, targetY = 600, targetScale = 0.8;

    if (activeView === 'tactical') {
      const radiusInTiles = 14;
      const boundingBoxSvgSize = (radiusInTiles * 4) * TILE_SF; 
      let focusX = selectedBuilding ? selectedBuilding.x : (eventMode === 'castle_battle' ? 600 : null);
      let focusY = selectedBuilding ? selectedBuilding.y : (eventMode === 'castle_battle' ? 600 : null);

      if (focusX !== null && focusY !== null) {
        targetScale = Math.min(rect.width / boundingBoxSvgSize, rect.height / boundingBoxSvgSize) * 0.95;
        if (!selectedBuilding && eventMode === 'castle_battle') targetScale = targetScale * 0.6;
        targetScale = Math.max(0.3, Math.min(targetScale, 40));
        targetX = 600 + (Number(focusX) - Number(focusY)) * TILE_SF;
        targetY = 1150 - (Number(focusX) + Number(focusY)) * TILE_SF;
      }
    } else if (activeView === 'alliance') {
      const centerTarget = allianceStructures?.find(s => s.id === 'alliance-bear-1') 
                        || allianceStructures?.find(s => s.type === 'beartrap') 
                        || allianceStructures?.find(s => s.type === 'headquarters') 
                        || { x: 500, y: 500 };
                        
      let effX = Number(centerTarget.x);
      let effY = Number(centerTarget.y);
      if (centerTarget.type === 'headquarters' || centerTarget.type === 'beartrap') {
        effX += 0.5;
        effY += 0.5;
      }
      
      targetX = 600 + (effX - effY) * TILE_SF;
      targetY = 1150 - (effX + effY) * TILE_SF;
      
      const viewSizeSvg = 10 * TILE_SF; 
      targetScale = Math.min((rect.width * 0.8) / viewSizeSvg, (rect.height * 0.8) / viewSizeSvg);
      targetScale = Math.max(5, Math.min(targetScale, 150));

    } else {
      const castle = fixedBuildings?.find(b => b.type?.toLowerCase() === 'castle' || b.name?.toLowerCase().includes('castello'));
      if (allianceCode === 'DEMO') { targetX = 600; targetY = 1150 - 1600 * TILE_SF; } 
      else if (castle) {
        targetX = 600 + (Number(castle.x) - Number(castle.y)) * TILE_SF;
        targetY = 1150 - (Number(castle.x) + Number(castle.y)) * TILE_SF;
      }
      targetScale = Math.max(rect.width / 1000, rect.height / 1000);
    }
    
    setPosition({ x: (rect.width / 2) - (targetX * targetScale), y: (rect.height / 2) - (targetY * targetScale) });
    setScale(targetScale);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (isReadOnly) return alert(t('map.read_only_alert'));

    const dragData = e.dataTransfer.getData('text/plain');
    if (!dragData) return;
    const svgElement = document.getElementById('map-svg');
    if (!svgElement) return;
    const pt = svgElement.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const svgPoint = pt.matrixTransform(svgElement.getScreenCTM().inverse());
    const coords = svgToGameCoordinates(svgPoint.x, svgPoint.y);
    
    if (String(dragData).startsWith('structure:')) {
      const structId = dragData.split(':')[1];
      handleAllianceStructureChange(structId, 'x', Math.round(coords.x));
      handleAllianceStructureChange(structId, 'y', Math.round(coords.y));
    } else {
      const playerId = String(dragData).startsWith('player:') ? dragData.split(':')[1] : dragData;
      setPlayerOverrides(prev => ({ ...prev, [playerId]: { x: Math.round(coords.x), y: Math.round(coords.y) } }));
    }
  };

  const handleDragOver = (e) => { e.preventDefault(); };

  return {
    scale, position, isDragging, draggedPlayerId, setDraggedPlayerId,
    handleWheel, handleMouseDown, handleMouseMove, handleMouseUp,
    handleResetView, handleDrop, handleDragOver
  };
}