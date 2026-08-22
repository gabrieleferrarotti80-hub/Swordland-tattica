import { useState, useEffect } from 'react';
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

  useEffect(() => {
    const mapNode = mainRef.current;
    if (!mapNode) return;

    const updateCamera = () => {
      const rect = mapNode.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      if (activeView === 'global') {
        const castle = fixedBuildings.find(b => b.type?.toLowerCase() === 'castle' || b.name?.toLowerCase().includes('castello'));
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
        const allElements = [...validPlayers];
        allianceStructures.forEach(struct => {
          allElements.push({ svgX: 600 + (Number(struct.x) - Number(struct.y)) * TILE_SF, svgY: 1150 - (Number(struct.x) + Number(struct.y)) * TILE_SF });
        });
        
        if (allElements.length > 0) {
          const minX = Math.min(...allElements.map(p => p.svgX));
          const maxX = Math.max(...allElements.map(p => p.svgX));
          const minY = Math.min(...allElements.map(p => p.svgY));
          const maxY = Math.max(...allElements.map(p => p.svgY));

          const centerX = (minX + maxX) / 2;
          const centerY = (minY + maxY) / 2;
          const width = Math.max(maxX - minX, 50);
          const height = Math.max(maxY - minY, 50);
          
          let targetScale = Math.min(rect.width / (width * 1.5), rect.height / (height * 1.5));
          targetScale = Math.max(15.0, targetScale); 

          setPosition({ x: (rect.width / 2) - (centerX * targetScale), y: (rect.height / 2) - (centerY * targetScale) });
          setScale(targetScale);
        }

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
    };

    const resizeObserver = new ResizeObserver(() => { updateCamera(); });
    resizeObserver.observe(mapNode); 
    updateCamera(); 
    return () => { resizeObserver.disconnect(); };
  }, [activeView, selectedBuilding, fixedBuildings, validPlayers, allianceStructures, allianceCode, eventMode, TILE_SF]);

  useEffect(() => {
    const mapNode = mainRef.current;
    if (!mapNode) return;
    const preventBrowserScroll = (e) => e.preventDefault();
    mapNode.addEventListener('wheel', preventBrowserScroll, { passive: false });
    return () => mapNode.removeEventListener('wheel', preventBrowserScroll);
  }, [mainRef]);

  const handleWheel = (e) => {
    if (!mainRef.current) return;
    const zoomFactor = 1.15;
    const direction = e.deltaY < 0 ? 1 : -1;
    let newScale = direction > 0 ? scale * zoomFactor : scale / zoomFactor;
    newScale = Math.max(0.1, Math.min(newScale, 250));
    
    const rect = mainRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const scaleRatio = newScale / scale;
    setPosition(prev => ({ x: mouseX - (mouseX - prev.x) * scaleRatio, y: mouseY - (mouseY - prev.y) * scaleRatio }));
    setScale(newScale);
  };

  const handleMouseDown = (e) => { 
    setIsDragging(true); 
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y }); 
  };
  
  const handleMouseMove = (e) => { 
    // SBLOCCATO: Rimosso il blocco eventMode === 'castle_battle' per permettere la simulazione
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
      setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y }); 
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
    } else {
      const castle = fixedBuildings.find(b => b.type?.toLowerCase() === 'castle' || b.name?.toLowerCase().includes('castello'));
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
    // SBLOCCATO: Rimosso il blocco eventMode === 'castle_battle' per permettere la simulazione
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