// src/components/beartrap/rallyEngine.js

export function calculateTravelSeconds(x1, y1, x2, y2) {
  if (x1 === '' || y1 === '' || x2 === '' || y2 === '' || x1 == null || y1 == null) return 40;
  const dx = Number(x1) - Number(x2);
  const dy = Number(y1) - Number(y2);
  const distance = Math.sqrt(dx * dx + dy * dy);
  return Math.max(8, Math.round(distance * 4)); // 4 secondi a casella (minimo fisiologico 8s)
}

export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function formatCountdownMinute(elapsedSeconds) {
  const remainingSec = Math.max(0, 1800 - elapsedSeconds);
  const m = Math.floor(remainingSec / 60);
  const s = remainingSec % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// Calcola il numero di gruppi (A..E) seguendo le soglie della guida
export function getRecommendedGroupsCount(onlineCount) {
  if (onlineCount <= 7) return 1;
  if (onlineCount <= 13) return 2;
  if (onlineCount <= 19) return 3;
  if (onlineCount <= 25) return 4;
  return 5;
}

// Suddivide i giocatori nei gruppi A, B, C, D, E con distribuzione a Serpentina (Snake Draft)
// per spalmare equamente i giocatori più forti su tutti i minuti di lancio
export function assignPlayersToWaveGroups(onlinePlayers, trapX = 500, trapY = 500) {
  const count = onlinePlayers.length;
  if (count === 0) return [];

  const numGroups = getRecommendedGroupsCount(count);
  const groupLabels = ['A', 'B', 'C', 'D', 'E'].slice(0, numGroups);
  
  const groups = groupLabels.map((label, idx) => ({
    label,
    offsetSeconds: idx * 60, // Gruppo A: +0s (Min 30), B: +60s (Min 29), C: +120s (Min 28)...
    startCountdownMin: 30 - idx,
    members: [],
    totalPower: 0
  }));

  // Ordiniamo i giocatori per Potenza pura decrescente (a parità, chi è più vicino alla trappola)
  const sorted = [...onlinePlayers].sort((a, b) => {
    const pDiff = (Number(b.power) || 0) - (Number(a.power) || 0);
    if (pDiff !== 0) return pDiff;
    const distA = calculateTravelSeconds(a.x, a.y, trapX, trapY);
    const distB = calculateTravelSeconds(b.x, b.y, trapX, trapY);
    return distA - distB;
  });

  // Distribuzione a Serpentina (es. 0,1,2,3 -> 3,2,1,0)
  sorted.forEach((player, index) => {
    const cycle = Math.floor(index / numGroups);
    const posInCycle = index % numGroups;
    const targetGroupIndex = (cycle % 2 === 0) ? posInCycle : (numGroups - 1 - posInCycle);

    const travelSec = calculateTravelSeconds(player.x, player.y, trapX, trapY);
    const singleCycleSec = 240 + (travelSec * 2) + 10;

    groups[targetGroupIndex].members.push({
      ...player,
      group: groups[targetGroupIndex].label,
      travelToTrap: travelSec,
      cycleSeconds: singleCycleSec
    });
    groups[targetGroupIndex].totalPower += (Number(player.power) || 0);
  });

  return groups;
}

export function generateBearTrapWaves(onlinePlayers, troopCap = 100000, trapX = 500, trapY = 500) {
  const TOTAL_TIME = 1800; // 30 minuti (1800s)
  const PREP_TIME = 240;   // 4 minuti di raduno
  const COMBAT_TIME = 10;  // 10s combattimento e riorganizzazione
  const TARGET_RALLIES_PER_PLAYER = 5;

  const REQUIRED_JOINERS = Math.min(15, Math.ceil(1000000 / (troopCap || 100000)));

  if (!onlinePlayers || onlinePlayers.length === 0) return "❌ Nessun giocatore online selezionato.";

  const waveGroups = assignPlayersToWaveGroups(onlinePlayers, trapX, trapY);
  const playerStats = {};

  onlinePlayers.forEach(p => {
    playerStats[p.id] = {
      name: p.name,
      power: Number(p.power) || 0,
      participation: Number(p.participation) || 2,
      travelSec: calculateTravelSeconds(p.x, p.y, trapX, trapY),
      ralliesLed: 0,
      launchTimes: []
    };
  });

  const timelineEvents = [];

  // Generazione dei 5 cicli per ciascun gruppo scaglionato
  waveGroups.forEach(group => {
    group.members.forEach(member => {
      // Il primo lancio avviene allo scaglionamento del gruppo (es. 0s per A, 60s per B, 120s per C...)
      let currentStartTime = group.offsetSeconds;

      for (let cycle = 1; cycle <= TARGET_RALLIES_PER_PLAYER; cycle++) {
        const impactTime = currentStartTime + PREP_TIME + member.travelToTrap;
        const returnTime = impactTime + member.travelToTrap + COMBAT_TIME;

        // Verifica che l'impatto avvenga entro i 30 minuti (1800s) dell'evento
        if (impactTime <= TOTAL_TIME) {
          timelineEvents.push({
            cycle,
            group: group.label,
            startTime: currentStartTime,
            impactTime,
            returnTime,
            leaderId: member.id,
            leaderName: member.name,
            leaderPower: Number(member.power) || 0,
            travelSec: member.travelToTrap
          });

          playerStats[member.id].ralliesLed += 1;
          playerStats[member.id].launchTimes.push(formatCountdownMinute(currentStartTime));
        }

        // Il raduno successivo dello stesso giocatore parte appena le sue truppe rientrano dal ciclo precedente
        currentStartTime = returnTime;
      }
    });
  });

  timelineEvents.sort((a, b) => a.startTime - b.startTime || b.leaderPower - a.leaderPower);

  return buildStructuredChatOutput(waveGroups, timelineEvents, playerStats, troopCap, REQUIRED_JOINERS);
}

function buildStructuredChatOutput(waveGroups, timelineEvents, playerStats, troopCap, reqJoiners) {
  let out = `🐻 PIANO COORDINATO TRAPPOLA DELL'ORSO 🐻\n`;
  out += `⚙️ Regola Truppe Joiner: ${troopCap.toLocaleString('it-IT')} truppe max (${reqJoiners} partecipanti per raduno)\n`;
  out += `🎯 Obiettivo: 5 Raduni garantiti per ogni giocatore + Flusso Join continuo\n\n`;

  out += `========================================\n`;
  out += `📋 COMPOSIZIONE GRUPPI (Banca Potenza Equilibrata)\n`;
  out += `========================================\n`;
  
  waveGroups.forEach(g => {
    const names = g.members.map(m => `${m.name} (${m.power}M)`).join(', ');
    out += `🚩 GRUPPO ${g.label} [Start: Minuto ${g.startCountdownMin}:00] — Tot: ${g.totalPower.toFixed(1)}M\n`;
    out += `   👥 Membri (${g.members.length}): ${names}\n\n`;
  });

  out += `========================================\n`;
  out += `⏱️ CRONOPROGRAMMA DEI 5 CICLI (Timer Evento 30:00 ➔ 00:00)\n`;
  out += `========================================\n`;

  for (let c = 1; c <= 5; c++) {
    const cycleEvents = timelineEvents.filter(e => e.cycle === c);
    if (cycleEvents.length === 0) continue;

    out += `\n🔥 ONDATA / CICLO #${c}\n`;
    
    waveGroups.forEach(g => {
      const groupCycleEvents = cycleEvents.filter(e => e.group === g.label);
      if (groupCycleEvents.length === 0) return;

      // Calcola la finestra temporale media del gruppo in questo ciclo
      const minStart = Math.min(...groupCycleEvents.map(e => e.startTime));
      const countdownStr = formatCountdownMinute(minStart);
      const leaderList = groupCycleEvents.map(e => e.leaderName).join(', ');

      out += `   • [Timer ~${countdownStr}] 🚩 Gruppo ${g.label} apre raduno: ${leaderList}\n`;
    });
  }

  out += `\n========================================\n`;
  out += `📊 RIEPILOGO RADUNI GUIDATI PER GIOCATORE\n`;
  out += `========================================\n`;

  Object.values(playerStats)
    .sort((a, b) => b.ralliesLed - a.ralliesLed || b.power - a.power)
    .forEach(st => {
      const statusIcon = st.ralliesLed >= 5 ? '✅' : '⚠️';
      out += `${statusIcon} ${st.name}: ${st.ralliesLed}/5 raduni (Viaggio: ${st.travelSec}s) ➔ Start a [${st.launchTimes.join(' | ')}]\n`;
    });

  out += `\n💡 REGOLE D'ORO IN EVENTO:\n`;
  out += `1. Apri il tuo raduno esattamente quando tocca al tuo Gruppo.\n`;
  out += `2. Con le altre marce, entra SEMPRE nel primo raduno in cima alla lista inviando ${troopCap.toLocaleString('it-IT')} truppe.\n`;
  out += `3. Non saltare nessun raduno!`;

  return out.trim();
}