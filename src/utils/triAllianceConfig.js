import i18next from 'i18next';

export const BUILDING_TYPES = {
  TEMPLE: { id: 'TEMPLE', get name() { return i18next.t('tri_alliance.buildings.temple', 'Temple of Tides'); }, pts: 1800 },
  HQ: { id: 'HQ', get name() { return i18next.t('tri_alliance.buildings.hq', 'Headquarters'); }, pts: 1800 },
  GARRISON: { id: 'GARRISON', get name() { return i18next.t('tri_alliance.buildings.garrison', 'Garrison'); }, pts: 1800 },
  CLUSTER: { id: 'CLUSTER', get name() { return i18next.t('tri_alliance.buildings.cluster', 'Cluster of Ruins'); }, pts: 600 },
  RUINS: { id: 'RUINS', get name() { return i18next.t('tri_alliance.buildings.ruins', 'Ruins'); }, pts: 180 },
  HUB: { id: 'HUB', get name() { return i18next.t('tri_alliance.buildings.hub', 'Transit Hub'); }, pts: 60 },
  PILLAR: { id: 'PILLAR', get name() { return i18next.t('tri_alliance.buildings.pillar', 'Pillars'); }, pts: 60 },
  WAYPOINT: { id: 'WAYPOINT', get name() { return i18next.t('tri_alliance.buildings.waypoint', 'Snodo (Curva)'); }, pts: 0 }
};

export const UNKNOWN_BUILDING = { id: 'UNKNOWN', get name() { return i18next.t('tri_alliance.buildings.unknown', 'Edificio Obsoleto'); }, pts: 0 };

export const TEAM_HEX_COLORS = {
  rose: '#f43f5e',
  cyan: '#06b6d4',
  emerald: '#10b981',
  amber: '#f59e0b',
  fuchsia: '#d946ef',
  unassigned: '#64748b' 
};

export const isNodeLocked = (nodeType, phase) => {
  if (nodeType === 'WAYPOINT') return true;
  if (phase === 1) return nodeType === 'TEMPLE' || nodeType === 'GARRISON';
  if (phase === 2) return nodeType === 'TEMPLE';
  return false;
};

// Algoritmo BFS per trovare la strada tra i nodi fantasma
export const findPathThroughWaypoints = (startId, endId, globalPaths, nodes) => {
  const queue = [[startId]];
  const visited = new Set([startId]);

  while (queue.length > 0) {
    const path = queue.shift();
    const current = path[path.length - 1];

    if (current === endId) return path;

    const neighbors = [];
    globalPaths.forEach(p => {
      if (p.start === current) neighbors.push(p.end);
      if (p.end === current) neighbors.push(p.start);
    });

    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        const nodeObj = nodes.find(n => n.id === neighbor);
        if (!nodeObj) continue;

        if (neighbor === endId) {
          return [...path, neighbor];
        } else if (nodeObj.type === 'WAYPOINT') {
          visited.add(neighbor);
          queue.push([...path, neighbor]);
        }
      }
    }
  }
  return null;
};

// Generatore intelligente di testo che nasconde i waypoint
export const generateLogicalMovementsText = (paths, allNodes) => {
  const nonWaypointStarts = paths.map(p => p.start).filter(id => {
     const n = allNodes.find(n => n.id === id);
     return n && n.type !== 'WAYPOINT';
  });

  const uniqueStarts = [...new Set(nonWaypointStarts)];
  let text = '';

  uniqueStarts.forEach(startId => {
     const visited = new Set();
     const queue = [startId];
     const destinations = new Set();

     while(queue.length > 0) {
        const current = queue.shift();
        const nextSegments = paths.filter(p => p.start === current);
        nextSegments.forEach(seg => {
           if (!visited.has(seg.end)) {
              visited.add(seg.end);
              const endNode = allNodes.find(n => n.id === seg.end);
              if (endNode && endNode.type === 'WAYPOINT') {
                 queue.push(seg.end);
              } else {
                 destinations.add(seg.end);
              }
           }
        });
     }

     destinations.forEach(dest => {
        text += i18next.t('tri_alliance.map.march_from_to', '- Marcia da {{start}} verso {{dest}}\n', { start: startId, dest: dest });
     });
  });
  return text;
};