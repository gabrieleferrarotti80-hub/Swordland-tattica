export const initialBuildings = [
  { 
    id: 'Swordshrine', 
    name: 'Swordshrine', 
    unlockTime: 15, 
    pointsPerMin: 1800, 
    pointsPerMinPlayer: 360, 
    firstControl: 9000, 
    x: 50, 
    y: 50,
    icon: '/Swordshrine.png',
    scale: 1.6,
    travelTimeBlue: 210, // 03:30
    travelTimeRed: 210   // 03:30
  },
  { 
    id: 'mercenary', 
    name: 'Mercenary Camp', 
    unlockTime: 15, 
    pointsPerMin: 240, 
    pointsPerMinPlayer: 48, 
    firstControl: 1200, 
    x: 50, 
    y: 28,
    icon: '/Mercenary.png',
    scale: 1,
    travelTimeBlue: 240, // 04:00
    travelTimeRed: 240   // 04:00
  },
  { 
    id: 'reformation', 
    name: 'Reformation', 
    unlockTime: 15, 
    pointsPerMin: 240, 
    pointsPerMinPlayer: 48, 
    firstControl: 1200, 
    x: 50, 
    y: 72,
    icon: '/Reformation.png',
    scale: 1.1,
    travelTimeBlue: 240, // 04:00
    travelTimeRed: 240   // 04:00
  },
  { 
    id: 'sanctum-1', 
    name: 'Sanctum (Sinistra)', 
    unlockTime: 0, 
    pointsPerMin: 1200, 
    pointsPerMinPlayer: 240, 
    firstControl: 6000, 
    x: 23, 
    y: 40,
    icon: '/Sanctum.png',
    scale: 1,
    travelTimeBlue: 90,  // 01:30
    travelTimeRed: 330   // 05:30
  },
  { 
    id: 'sanctum-2', 
    name: 'Sanctum (Destra)', 
    unlockTime: 0, 
    pointsPerMin: 1200, 
    pointsPerMinPlayer: 240, 
    firstControl: 6000, 
    x: 77, 
    y: 60,
    icon: '/Sanctum.png',
    scale: 1,
    travelTimeBlue: 330, // 05:30
    travelTimeRed: 90    // 01:30
  },
  { 
    id: 'bell-tower', 
    name: 'Bell Tower', 
    unlockTime: 0, 
    pointsPerMin: 240, 
    pointsPerMinPlayer: 48, 
    firstControl: 1200, 
    x: 33, 
    y: 18,
    icon: '/Bell Tower.png',
    scale: 1.1,
    travelTimeBlue: 210, // 03:30 (Calcolato per simmetria con Stables)
    travelTimeRed: 330   // 05:30
  },
  { 
    id: 'stables', 
    name: 'Stables', 
    unlockTime: 0, 
    pointsPerMin: 240, 
    pointsPerMinPlayer: 48, 
    firstControl: 1200, 
    x: 67, 
    y: 82,
    icon: '/Stables.png',
    scale: 1.1,
    travelTimeBlue: 330, // 05:30
    travelTimeRed: 210   // 03:30 (Calcolato per simmetria con Bell Tower)
  },
  { 
    id: 'abbey-1', 
    name: 'Abbey (Alto Destra)', 
    unlockTime: 0, 
    pointsPerMin: 600, 
    pointsPerMinPlayer: 120, 
    firstControl: 300, 
    x: 67, 
    y: 18,
    icon: '/Abbey.png',
    scale: 0.9,
    travelTimeBlue: 330, // Simmetrica a Stables
    travelTimeRed: 210
  },
  { 
    id: 'abbey-2', 
    name: 'Abbey (Basso Sinistra)', 
    unlockTime: 0, 
    pointsPerMin: 600, 
    pointsPerMinPlayer: 120, 
    firstControl: 300, 
    x: 33, 
    y: 82,
    icon: '/Abbey.png',
    scale: 0.9,
    travelTimeBlue: 210, // Simmetrica a Bell Tower
    travelTimeRed: 330
  },
  { 
    id: 'abbey-3', 
    name: 'Abbey (Centro Sinistra)', 
    unlockTime: 0, 
    pointsPerMin: 600, 
    pointsPerMinPlayer: 120, 
    firstControl: 300, 
    x: 23, 
    y: 60,
    icon: '/Abbey.png',
    scale: 0.9,
    travelTimeBlue: 90,  // Simmetrica a Sanctum 1
    travelTimeRed: 330
  },
  { 
    id: 'abbey-4', 
    name: 'Abbey (Centro Destra)', 
    unlockTime: 0, 
    pointsPerMin: 600, 
    pointsPerMinPlayer: 120, 
    firstControl: 300, 
    x: 77, 
    y: 40,
    icon: '/Abbey.png',
    scale: 0.9,
    travelTimeBlue: 330, // Simmetrica a Sanctum 2
    travelTimeRed: 90
  }
];