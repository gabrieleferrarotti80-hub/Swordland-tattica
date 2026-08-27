// src/components/beartrap/rallyEngine.js

/**
 * Calcola la distanza geometrica e la converte in secondi (es. 4 secondi per casella).
 */
export function calculateTravelSeconds(x1, y1, x2, y2) {
  if (x1 === '' || y1 === '' || x2 === '' || y2 === '') return 60; // Default di sicurezza
  const dx = Number(x1) - Number(x2);
  const dy = Number(y1) - Number(y2);
  const distance = Math.sqrt(dx * dx + dy * dy);
  return Math.round(distance * 4); // 4 secondi per casella
}

export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function generateBearTrapWaves(onlinePlayers, troopCap, trapX = 500, trapY = 500) {
  const TOTAL_TIME = 1800; // 30 minuti
  const PREP_TIME = 240;   // 4 minuti di preparazione fissa del raduno
  const BUFFER = 10;       // 10s di margine di sicurezza al rientro

  // Calcolo dinamico joiners necessari per 1M (assumendo ~50k del leader)
  const REQUIRED_JOINERS = Math.max(1, Math.min(14, Math.ceil(950000 / troopCap)));

  if (!onlinePlayers || onlinePlayers.length === 0) return "❌ Nessun giocatore online.";

  // 1. Inizializzazione code separate (1 Leader + N Joiners)
  const players = onlinePlayers.map(p => {
    const numJoinerMarches = Number(p.marches) || 5; 
    return {
      id: p.id,
      name: p.name,
      x: p.x,
      y: p.y,
      travelToTrap: calculateTravelSeconds(p.x, p.y, trapX, trapY), // Tempo base casa -> trappola
      leaderFreeAt: 0, 
      joinerFreeAt: Array(numJoinerMarches).fill(0), 
      ledCount: 0
    };
  });

  const timeline = [];

  // 2. Risolutore Temporale (Avanza di 5 secondi in 5 secondi)
  for (let t = 0; t <= TOTAL_TIME; t += 5) {
    
    // Leader idonei: Coda leader libera e tempo totale d'impatto entro i 30 min
    const potentialLeaders = [...players]
      .filter(p => p.leaderFreeAt <= t && (t + PREP_TIME + p.travelToTrap) <= (TOTAL_TIME - 2))
      .sort((a, b) => a.travelToTrap - b.travelToTrap); // Chi è più vicino alla trappola parte prima

    for (let leader of potentialLeaders) {
      
      // Filtriamo i Joiners disponibili in questo secondo (t) rispettando la fisica del gioco:
      // Il joiner deve avere almeno una marcia libera E deve fare in tempo ad arrivare 
      // alla CITTA DEL LEADER entro i 240 secondi di preparazione!
      const validJoiners = [];

      for (let p of players) {
        if (p.name === leader.name) continue; // Il leader non può joinare se stesso

        // Ha almeno una marcia joiner libera?
        const freeJoinerIndex = p.joinerFreeAt.findIndex(time => time <= t);
        if (freeJoinerIndex === -1) continue;

        // Fisica dell'Opzione A: Tempo di viaggio da Casa del Joiner a Casa del Leader
        const travelToLeader = calculateTravelSeconds(p.x, p.y, leader.x, leader.y);
        
        // Se il joiner ci mette più di 240 secondi ad arrivare dal leader, non fa in tempo!
        if (travelToLeader <= PREP_TIME) {
          validJoiners.push({ player: p, freeJoinerIndex });
        }
      }

      // Se abbiamo abbastanza joiners validi che arrivano in tempo dal leader, formiamo il raduno!
      if (validJoiners.length >= REQUIRED_JOINERS) {
        
        // Calcolo del tempo di ritorno a casa per il leader e i joiners:
        // Rientro = Tempo attuale + Prep(240s) + Viaggio Leader/Trappola + 10s combattimento + Viaggio ritorno a casa propria
        const leaderReturnTime = t + PREP_TIME + leader.travelToTrap + 10 + leader.travelToTrap + BUFFER;
        
        // 1. Blocchiamo la coda Leader
        leader.leaderFreeAt = leaderReturnTime;
        leader.ledCount++;
        
        // 2. Blocchiamo le marce dei joiners scelti (ognuno torna a casa sua con il proprio tempo di viaggio dalla trappola)
        const selectedJoinerNames = [];
        for (let i = 0; i < REQUIRED_JOINERS; i++) {
          const item = validJoiners[i];
          const joinerPlayer = item.player;
          
          const joinerReturnTime = t + PREP_TIME + leader.travelToTrap + 10 + joinerPlayer.travelToTrap + BUFFER;
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
        break; // Non ci sono abbastanza joiners validi in questo istante
      }
    }
  }

  return buildChatOutput(timeline, troopCap, REQUIRED_JOINERS, players);
}

function buildChatOutput(timeline, troopCap, reqJoiners, players) {
  const totalRallies = timeline.length;
  
  let out = `=== BEAR TRAP - TIMELINE FISICA (OPZIONE A) ===\n`;
  out += `[Cap Truppe: ${troopCap} | Joiners per Raduno: ${reqJoiners}]\n`;
  out += `🎯 TOTALE RADUNI: ${totalRallies}\n\n`;

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