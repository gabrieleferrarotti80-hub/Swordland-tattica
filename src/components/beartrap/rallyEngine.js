// src/components/beartrap/rallyEngine.js

export function calculateTravelSeconds(x1, y1, x2, y2) {
  if (x1 === '' || y1 === '' || x2 === '' || y2 === '') return 60;
  const dx = Number(x1) - Number(x2);
  const dy = Number(y1) - Number(y2);
  const distance = Math.sqrt(dx * dx + dy * dy);
  return Math.round(distance * 4); // 4 secondi a casella
}

export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function generateBearTrapWaves(onlinePlayers, troopCap, trapX = 500, trapY = 500) {
  const TOTAL_TIME = 1800; // 30 minuti
  const PREP_TIME = 240;   // 4 minuti di preparazione raduno
  const COMBAT_TIME = 10;  // 10 secondi stimati di combattimento
  const BUFFER = 10;       // 10s di margine per il rientro

  // Formula esatta: 1M truppe / Cap, con limite rigido a 15 Joiner massimi
  const REQUIRED_JOINERS = Math.min(15, Math.ceil(1000000 / (troopCap || 1)));

  if (!onlinePlayers || onlinePlayers.length === 0) return "❌ Nessun giocatore online.";

  // 1. Inizializzazione code
  const players = onlinePlayers.map(p => {
    // p.marches definisce ESCLUSIVAMENTE gli slot da joiner. Il ruolo leader ha una coda dedicata a sé stante.
    const numJoinerMarches = Number(p.marches) || 4; 
    return {
      id: p.id,
      name: p.name,
      x: p.x,
      y: p.y,
      travelToTrap: calculateTravelSeconds(p.x, p.y, trapX, trapY),
      leaderFreeAt: 0, 
      joinerFreeAt: Array(numJoinerMarches).fill(0), 
      ledCount: 0
    };
  });

  const timeline = [];

  // 2. Risolutore (Scorre di 5 secondi in 5 secondi)
  for (let t = 0; t <= TOTAL_TIME; t += 5) {
    
    // Il Leader deve avere la coda Leader libera e l'impatto deve avvenire prima della fine
    const potentialLeaders = [...players]
      .filter(p => p.leaderFreeAt <= t && (t + PREP_TIME + p.travelToTrap) <= (TOTAL_TIME - 2))
      .sort((a, b) => a.travelToTrap - b.travelToTrap); 

    for (let leader of potentialLeaders) {
      const validJoiners = [];

      for (let p of players) {
        if (p.name === leader.name) continue; // Non si può joinare da soli

        const freeJoinerIndex = p.joinerFreeAt.findIndex(time => time <= t);
        if (freeJoinerIndex === -1) continue;

        // Regola Opzione A: il Joiner fa in tempo ad arrivare alla città del leader?
        const travelToLeader = calculateTravelSeconds(p.x, p.y, leader.x, leader.y);
        if (travelToLeader <= PREP_TIME) {
          validJoiners.push({ player: p, freeJoinerIndex });
        }
      }

      if (validJoiners.length >= REQUIRED_JOINERS) {
        
        // Calcolo Rientro Leader: 240s prep + (Andata Leader + Combat + Ritorno Leader)
        const leaderReturnTime = t + PREP_TIME + (leader.travelToTrap * 2) + COMBAT_TIME + BUFFER;
        leader.leaderFreeAt = leaderReturnTime;
        leader.ledCount++;
        
        // Calcolo Rientro Joiners: 240s prep + Andata Leader + Combat + Ritorno DIRETTO a casa propria
        const selectedJoinerNames = [];
        for (let i = 0; i < REQUIRED_JOINERS; i++) {
          const item = validJoiners[i];
          const joinerPlayer = item.player;
          
          const joinerReturnTime = t + PREP_TIME + leader.travelToTrap + COMBAT_TIME + joinerPlayer.travelToTrap + BUFFER;
          joinerPlayer.joinerFreeAt[item.freeJoinerIndex] = joinerReturnTime;
          
          selectedJoinerNames.push(joinerPlayer.name);
        }
        
        timeline.push({
          time: t,
          leader: leader.name,
          joiners: selectedJoinerNames,
          impactTime: t + PREP_TIME + leader.travelToTrap
        });

      } else {
        break; // Non ci sono abbastanza joiners validi in questo preciso istante
      }
    }
  }

  return buildChatOutput(timeline, troopCap, REQUIRED_JOINERS, players);
}

function buildChatOutput(timeline, troopCap, reqJoiners, players) {
  const totalRallies = timeline.length;
  
  let out = `=== BEAR TRAP - TIMELINE FISICA ===\n`;
  out += `[Cap Truppe: ${troopCap} | Joiners richiesti: ${reqJoiners}]\n`;
  out += `🎯 TOTALE RADUNI LANCIATI: ${totalRallies}\n\n`;

  const timeBlocks = {};
  timeline.forEach(r => {
     const minStr = formatTime(r.time);
     if (!timeBlocks[minStr]) timeBlocks[minStr] = [];
     timeBlocks[minStr].push(r.leader);
  });

  out += `===== ORDINI DI LANCIO (START) =====\n`;
  Object.entries(timeBlocks).forEach(([timeStr, leaders]) => {
     out += `[Minuto ${timeStr}] 👑 Lanciano: ${leaders.join(', ')}\n`;
  });

  out += `\n===== STATISTICHE LEADER =====\n`;
  players.filter(p => p.ledCount > 0).sort((a,b) => b.ledCount - a.ledCount).forEach(p => {
    out += `${p.name}: ha guidato ${p.ledCount} raduni.\n`;
  });

  return out.trim();
}