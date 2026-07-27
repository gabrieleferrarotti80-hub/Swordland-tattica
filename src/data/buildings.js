export const initialBuildings = [
  { 
    id: 'Swordshrine', 
    name: 'Swordshrine', 
    unlockTime: 15, 
    pointsPerMin: 1800, 
    pointsPerMinPlayer: 360, 
    firstControl: 9000, 
    x: 117, 
    y: 117,
    icon: '/Swordshrine.png',
    scale: 1.6,
    travelTimeBlue: 235, // 03:55 (Al centro, uguale per entrambi)
    travelTimeRed: 235
  },
  { 
    id: 'mercenary', 
    name: 'Mercenary Camp', 
    unlockTime: 15, 
    pointsPerMin: 240, 
    pointsPerMinPlayer: 48, 
    firstControl: 1200, 
    x: 169, 
    y: 169,
    icon: '/Mercenary.png',
    scale: 1,
    travelTimeBlue: 271, // Speculare di Reformation
    travelTimeRed: 272   // 04:32
  },
  { 
    id: 'reformation', 
    name: 'Reformation', 
    unlockTime: 15, 
    pointsPerMin: 240, 
    pointsPerMinPlayer: 48, 
    firstControl: 1200, 
    x: 69, 
    y: 69,
    icon: '/Reformation.png',
    scale: 1.1,
    travelTimeBlue: 272, // Speculare di Mercenary
    travelTimeRed: 271   // 04:31
  },
  { 
    id: 'sanctum-1', 
    name: 'Sanctum (Sinistra)', 
    unlockTime: 0, 
    pointsPerMin: 1200, 
    pointsPerMinPlayer: 240, 
    firstControl: 6000, 
    x: 86, 
    y: 197,
    icon: '/Sanctum.png',
    scale: 1,
    travelTimeBlue: 103, // Speculare di Sanctum Destra
    travelTimeRed: 377   // 06:17
  },
  { 
    id: 'sanctum-2', 
    name: 'Sanctum (Destra)', 
    unlockTime: 0, 
    pointsPerMin: 1200, 
    pointsPerMinPlayer: 240, 
    firstControl: 6000, 
    x: 153, 
    y: 42,
    icon: '/Sanctum.png',
    scale: 1,
    travelTimeBlue: 377, // Speculare di Sanctum Sinistra
    travelTimeRed: 103   // 01:43
  },
  { 
    id: 'bell-tower', 
    name: 'Bell Tower', 
    unlockTime: 0, 
    pointsPerMin: 240, 
    pointsPerMinPlayer: 48, 
    firstControl: 1200, 
    x: 175, 
    y: 230,
    icon: '/Bell Tower.png',
    scale: 1.1,
    travelTimeBlue: 279, // Speculare di Stables
    travelTimeRed: 374   // 06:14
  },
  { 
    id: 'stables', 
    name: 'Stables', 
    unlockTime: 0, 
    pointsPerMin: 240, 
    pointsPerMinPlayer: 48, 
    firstControl: 1200, 
    x: 64, 
    y: 9,
    icon: '/Stables.png',
    scale: 1.1,
    travelTimeBlue: 374, // Speculare di Bell Tower
    travelTimeRed: 279   // 04:39
  },
  { 
    id: 'abbey-1', 
    name: 'Abbey (Alto Destra)', 
    unlockTime: 0, 
    pointsPerMin: 600, 
    pointsPerMinPlayer: 120, 
    firstControl: 300, 
    x: 230, 
    y: 175,
    icon: '/Abbey.png',
    scale: 0.7,
    travelTimeBlue: 371, // Speculare di Abbey Basso Sx
    travelTimeRed: 283   // 04:43
  },
  { 
    id: 'abbey-2', 
    name: 'Abbey (Basso Sinistra)', 
    unlockTime: 0, 
    pointsPerMin: 600, 
    pointsPerMinPlayer: 120, 
    firstControl: 300, 
    x: 9, 
    y: 64,
    icon: '/Abbey.png',
    scale: 0.7,
    travelTimeBlue: 283, // Speculare di Abbey Alto Dx
    travelTimeRed: 371   // 06:11
  },
  { 
    id: 'abbey-3', 
    name: 'Abbey (Centro Sinistra)', 
    unlockTime: 0, 
    pointsPerMin: 600, 
    pointsPerMinPlayer: 120, 
    firstControl: 300, 
    x: 40, 
    y: 179,
    icon: '/Abbey.png',
    scale: 0.7,
    travelTimeBlue: 54,  // Speculare di Abbey Centro Dx
    travelTimeRed: 405   // 06:45
  },
  { 
    id: 'abbey-4', 
    name: 'Abbey (Centro Destra)', 
    unlockTime: 0, 
    pointsPerMin: 600, 
    pointsPerMinPlayer: 120, 
    firstControl: 300, 
    x: 199, 
    y: 60,
    icon: '/Abbey.png',
    scale: 0.7,
    travelTimeBlue: 405, // Speculare di Abbey Centro Sx
    travelTimeRed: 54    // 00:54
  }
];