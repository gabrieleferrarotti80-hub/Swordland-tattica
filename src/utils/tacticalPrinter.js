import { cleanText } from '../hooks/useTacticalExport';

export const generateNativePrint = (params) => {
  const {
    positionedPlayers = [], 
    targetBuilding = null, 
    allianceStructures = [], 
    buildings = [], 
    tacticalMeta = {}, 
    rawArray = [], 
    flightMessages = [], 
    timelineSummaryObj = []
  } = params;

  const canvas = document.createElement('canvas');
  const size = 1600; 
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // ==========================================
  // 1. CALCOLO BOUNDING BOX (Inquadratura Mappa)
  // ==========================================
  let minRawX = 9999, maxRawX = -9999, minRawY = 9999, maxRawY = -9999;
  let hasValidPoints = false;
  
  const updateBounds = (x, y) => {
    if(x !== undefined && y !== undefined) {
       minRawX = Math.min(minRawX, Number(x)); maxRawX = Math.max(maxRawX, Number(x));
       minRawY = Math.min(minRawY, Number(y)); maxRawY = Math.max(maxRawY, Number(y));
       hasValidPoints = true;
    }
  };

  positionedPlayers.forEach(p => updateBounds(p.x, p.y));
  if (targetBuilding) updateBounds(targetBuilding.x, targetBuilding.y);
  const hiveHQ = allianceStructures.find(s => s.type === 'headquarters');
  if (hiveHQ) updateBounds(hiveHQ.x, hiveHQ.y);

  if (!hasValidPoints) { minRawX = 590; maxRawX = 610; minRawY = 590; maxRawY = 610; }

  const padding = 20;
  minRawX -= padding; maxRawX += padding;
  minRawY -= padding; maxRawY += padding;

  const rawWidth = maxRawX - minRawX;
  const rawHeight = maxRawY - minRawY;
  const rawSize = Math.max(rawWidth, rawHeight);
  const rawCx = minRawX + rawWidth / 2;
  const rawCy = minRawY + rawHeight / 2;

  minRawX = Math.floor((rawCx - rawSize / 2) / 2) * 2;
  maxRawX = Math.ceil((rawCx + rawSize / 2) / 2) * 2;
  minRawY = Math.floor((rawCy - rawSize / 2) / 2) * 2;
  maxRawY = Math.ceil((rawCy + rawSize / 2) / 2) * 2;

  const toIso = (x, y) => ({ x: x - y, y: -(x + y) });
  
  const c1 = toIso(minRawX, minRawY); const c2 = toIso(maxRawX, minRawY);
  const c3 = toIso(maxRawX, maxRawY); const c4 = toIso(minRawX, maxRawY);

  const minIsoX = Math.min(c1.x, c2.x, c3.x, c4.x); const maxIsoX = Math.max(c1.x, c2.x, c3.x, c4.x);
  const minIsoY = Math.min(c1.y, c2.y, c3.y, c4.y); const maxIsoY = Math.max(c1.y, c2.y, c3.y, c4.y);
  
  const scaleMap = size / Math.max(maxIsoX - minIsoX, maxIsoY - minIsoY);

  const isoCx = (minIsoX + maxIsoX) / 2;
  const isoCy = (minIsoY + maxIsoY) / 2;
  const centerPx = size / 2;
  const centerPy = size / 2;

  const mapToCanvas = (x, y) => {
     const iso = toIso(x, y);
     return { px: centerPx + (iso.x - isoCx) * scaleMap, py: centerPy + (iso.y - isoCy) * scaleMap };
  };

  // ==========================================
  // 2. DISEGNO SFONDO E GRIGLIA
  // ==========================================
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = '#141e33';
  const dp1 = mapToCanvas(minRawX, minRawY); const dp2 = mapToCanvas(maxRawX, minRawY);
  const dp3 = mapToCanvas(maxRawX, maxRawY); const dp4 = mapToCanvas(minRawX, maxRawY);
  ctx.beginPath(); ctx.moveTo(dp1.px, dp1.py); ctx.lineTo(dp2.px, dp2.py); ctx.lineTo(dp3.px, dp3.py); ctx.lineTo(dp4.px, dp4.py);
  ctx.closePath(); ctx.fill();

  ctx.strokeStyle = 'rgba(30, 41, 59, 0.8)';
  ctx.lineWidth = 2;
  for(let i = minRawX; i <= maxRawX + 2; i += 2) {
     const p1 = mapToCanvas(i - 1, minRawY - 1); 
     const p2 = mapToCanvas(i - 1, maxRawY + 1);
     ctx.beginPath(); ctx.moveTo(p1.px, p1.py); ctx.lineTo(p2.px, p2.py); ctx.stroke();
  }
  for(let j = minRawY; j <= maxRawY + 2; j += 2) {
     const p1 = mapToCanvas(minRawX - 1, j - 1); 
     const p2 = mapToCanvas(maxRawX + 1, j - 1);
     ctx.beginPath(); ctx.moveTo(p1.px, p1.py); ctx.lineTo(p2.px, p2.py); ctx.stroke();
  }

  const teamPalette = ['#ef4444', '#22c55e', '#a855f7', '#f59e0b', '#ec4899', '#38bdf8', '#a3e635', '#fb7185', '#8b5cf6', '#14b8a6'];
  const draftTeamsMap = tacticalMeta?.draftData?.teams || [];
  const draftMetaMap = tacticalMeta?.draftData?.playerMeta || {};
  const teamColorMap = {};
  draftTeamsMap.forEach((t, idx) => { teamColorMap[t.id] = teamPalette[idx % teamPalette.length]; });

  // ==========================================
  // 3. DISEGNO EDIFICI (CASTELLO E TORRETTE ESPANSE)
  // ==========================================
  // Disegna PRIMA il castello, così le torrette raddoppiate lo sovrascrivono integrandosi perfettamente
  const sortedBuildings = [...buildings].sort((a, b) => {
      const aIsCas = a.type === 'castle' || a.code === 'CAS';
      return aIsCas ? -1 : 1;
  });

  const castleObj = sortedBuildings.find(b => b.type === 'castle' || b.code === 'CAS');

  sortedBuildings.forEach(b => {
    if (b.x >= minRawX && b.x <= maxRawX && b.y >= minRawY && b.y <= maxRawY) {
       const isCastle = b.type === 'castle' || b.code === 'CAS';
       
       let r = 2; // 💡 RAGGIO TORRETTE RADDOPPIATO (era 1)
       let drawX = b.x;
       let drawY = b.y;
       
       if (isCastle) {
          r = 10; 
          const pDists = positionedPlayers.map(p => Math.max(Math.abs(p.x - b.x), Math.abs(p.y - b.y)));
          if (pDists.length > 0) {
             const minPlayerDist = Math.min(...pDists);
             if (minPlayerDist > 2) {
                 r = minPlayerDist - 1; 
             }
          }
       } else if (castleObj) {
          // 💡 SHIFT VETTORIALE INVERSO: Tira la torretta verso il centro del castello
          // Raddoppiando il raggio, questo spostamento fa combaciare la punta esterna al millimetro!
          if (drawX > castleObj.x) drawX -= 1;
          else if (drawX < castleObj.x) drawX += 1;
          
          if (drawY > castleObj.y) drawY -= 1;
          else if (drawY < castleObj.y) drawY += 1;
       }
       
       const cp1 = mapToCanvas(drawX - r, drawY - r); 
       const cp2 = mapToCanvas(drawX + r, drawY - r);
       const cp3 = mapToCanvas(drawX + r, drawY + r); 
       const cp4 = mapToCanvas(drawX - r, drawY + r);
       
       ctx.fillStyle = isCastle ? '#e11d48' : '#334155'; 
       ctx.beginPath(); ctx.moveTo(cp1.px, cp1.py); ctx.lineTo(cp2.px, cp2.py); ctx.lineTo(cp3.px, cp3.py); ctx.lineTo(cp4.px, cp4.py);
       ctx.closePath(); ctx.fill(); 
       
       ctx.strokeStyle = isCastle ? '#9f1239' : '#1e293b'; 
       ctx.lineWidth = isCastle ? 6 : 3; // Bordo bilanciato
       ctx.stroke();

       const { px, py } = mapToCanvas(drawX, drawY);
       ctx.fillStyle = '#ffffff'; 
       // 💡 FONT INGRANDITO per riempire il nuovo spazio della torretta raddoppiata
       ctx.font = `bold ${isCastle ? scaleMap * 3 : scaleMap * 1.5}px Arial, sans-serif`; 
       ctx.textAlign = 'center'; 
       ctx.textBaseline = 'middle'; 
       ctx.fillText(b.code || (isCastle ? 'CAS' : 'TUR'), px, py);
    }
  });

  allianceStructures.forEach(s => {
    if (s.x >= minRawX && s.x <= maxRawX && s.y >= minRawY && s.y <= maxRawY) {
       const r = 2.5; 
       const cp1 = mapToCanvas(s.x - r, s.y - r); const cp2 = mapToCanvas(s.x + r, s.y - r);
       const cp3 = mapToCanvas(s.x + r, s.y + r); const cp4 = mapToCanvas(s.x - r, s.y + r);
       
       ctx.fillStyle = '#4f46e5'; ctx.beginPath(); ctx.moveTo(cp1.px, cp1.py); ctx.lineTo(cp2.px, cp2.py); ctx.lineTo(cp3.px, cp3.py); ctx.lineTo(cp4.px, cp4.py);
       ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#312e81'; ctx.lineWidth = 4; ctx.stroke();
       
       const { px, py } = mapToCanvas(s.x, s.y);
       ctx.fillStyle = '#ffffff'; ctx.font = `bold ${scaleMap * 1.2}px Arial, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(s.code || 'HQ', px, py);
    }
  });

  // ==========================================
  // 4. DISEGNO TRUPPE E LEADER
  // ==========================================
  const leaderIds = new Set();
  draftTeamsMap.forEach(team => {
     const teamPlayers = positionedPlayers.filter(p => draftMetaMap[p.id]?.teamId === team.id);
     if (teamPlayers.length > 0) {
        const explicitLeader = teamPlayers.find(p => String(draftMetaMap[p.id]?.role || '').toUpperCase().includes('LEADER') || String(draftMetaMap[p.id]?.role || '').toUpperCase().includes('CAPITANO'));
        if (explicitLeader) leaderIds.add(explicitLeader.id); else leaderIds.add(teamPlayers[0].id);
     }
  });

  let leaderCounter = 1;
  const mapLegends = [];

  // DISEGNO PIASTRELLE GIOCATORI
  positionedPlayers.forEach(p => {
     if (p.x >= minRawX && p.x <= maxRawX && p.y >= minRawY && p.y <= maxRawY) {
       const tId = draftMetaMap[p.id]?.teamId;
       const color = (tId && teamColorMap[tId]) ? teamColorMap[tId] : '#64748b';
       
       const inset = 0.9; 
       const cp1 = mapToCanvas(p.x - inset, p.y - inset); 
       const cp2 = mapToCanvas(p.x + inset, p.y - inset);
       const cp3 = mapToCanvas(p.x + inset, p.y + inset); 
       const cp4 = mapToCanvas(p.x - inset, p.y + inset);

       ctx.fillStyle = color;
       ctx.beginPath(); ctx.moveTo(cp1.px, cp1.py); ctx.lineTo(cp2.px, cp2.py); ctx.lineTo(cp3.px, cp3.py); ctx.lineTo(cp4.px, cp4.py);
       ctx.closePath(); ctx.fill();
       
       ctx.strokeStyle = 'rgba(0,0,0,0.3)';
       ctx.lineWidth = 1; ctx.stroke();
     }
  });

  // DISEGNO MARKER CIRCOLARI PER I LEADER
  positionedPlayers.forEach(p => {
     if (p.x >= minRawX && p.x <= maxRawX && p.y >= minRawY && p.y <= maxRawY) {
       const pMeta = draftMetaMap[p.id] || {};
       const roleStr = String(pMeta.role || '').toUpperCase();
       const isExplicitLeader = roleStr.includes('LEADER') || roleStr.includes('CAPITANO');
       
       if (draftTeamsMap.length === 0 ? true : (isExplicitLeader || leaderIds.has(p.id))) {
         const { px, py } = mapToCanvas(p.x, p.y);
         const num = leaderCounter++;
         const tId = pMeta.teamId;
         const teamColor = (tId && teamColorMap[tId]) ? teamColorMap[tId] : '#64748b';
         mapLegends.push({ num, name: p.name, tag: p.originalTag || p.tag || '?', color: teamColor });
         
         const markerY = py - (scaleMap * 1.2); 
         
         ctx.fillStyle = '#0f172a'; ctx.beginPath(); ctx.arc(px, markerY, scaleMap * 0.9, 0, Math.PI * 2); ctx.fill();
         ctx.strokeStyle = teamColor; ctx.lineWidth = scaleMap * 0.2; ctx.stroke();
         ctx.fillStyle = '#ffffff'; ctx.font = `bold ${scaleMap}px Arial, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(num.toString(), px, markerY + (scaleMap * 0.05));
       }
     }
  });

  // Legenda colori interna alla mappa (In basso)
  if (draftTeamsMap.length > 0) {
    ctx.fillStyle = '#1e293b'; ctx.fillRect(0, size - 120, size, 120);
    ctx.font = 'bold 24px Arial, sans-serif';
    draftTeamsMap.forEach((t, idx) => {
        const color = teamPalette[idx % teamPalette.length];
        const lx = 60 + ((idx % 4) * (size / 4)); const ly = size - 80 + (Math.floor(idx / 4) * 45);
        ctx.fillStyle = color; ctx.beginPath(); ctx.arc(lx, ly, 12, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f8fafc'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(t.name, lx + 25, ly + 2);
    });
  }

  const radarDataUrl = canvas.toDataURL('image/png');
  const eventName = tacticalMeta?.eventName || 'Pianificazione Evento Kingshot';

  // ==========================================
  // 5. GENERAZIONE DOCUMENTO HTML (PDF NATIVO)
  // ==========================================
  let mapLegendHtml = '';
  if (mapLegends.length > 0) {
    const itemsHtml = mapLegends.map(l => `<div class="legend-item"><div class="legend-badge" style="background-color: ${l.color};">${l.num}</div><div class="legend-text"><b>[${l.tag}]</b> ${l.name}</div></div>`).join('');
    mapLegendHtml = `<div class="section-title bg-slate">LEGENDA POSIZIONI MAPPA</div><div class="legend-grid">${itemsHtml}</div>`;
  }

  let teamsHtml = draftTeamsMap.length > 0 
    ? draftTeamsMap.map(team => `<div class="team-block"><div class="team-name">Squadra: ${team.name} (${team.macro})</div>${rawArray.filter(p => draftMetaMap[p.id]?.teamId === team.id).map(p => `<div class="player-item">- ${draftMetaMap[p.id]?.tempTag ? `[${draftMetaMap[p.id]?.tempTag}] ` : ''}${p.name} <i>(${draftMetaMap[p.id]?.role || 'Membro'})</i></div>`).join('')}</div>`).join('')
    : `<p>Nessuna squadra configurata in questo piano.</p>`;

  let voliHtml = flightMessages.length > 0 
    ? flightMessages.map(msg => `<div class="team-block"><div class="team-name">Voli verso Alleanza [${msg.destination}]:</div>${msg.players.map(p => `<div class="player-item">- Da [${p.originalTag || p.tag || '?'}] ➔ <b>${p.name}</b></div>`).join('')}</div>`).join('')
    : `<p>Tutti i giocatori sono nell'alleanza corretta. Nessun volo richiesto.</p>`;

  let timelineHtml = timelineSummaryObj.length > 0 
    ? timelineSummaryObj.map(group => `<div class="timeline-group"><div class="timeline-time">[ Minuto ${group.formattedTime} ]</div>${group.actions.map(a => `<div class="timeline-action">• ${a}</div>`).join('')}</div>`).join('')
    : `<p>Nessun ordine tattico registrato nella Timeline.</p>`;

  const printWindow = window.open('', '_blank');
  if (!printWindow) return alert("⚠️ Il browser ha bloccato il popup. Consenti i popup per stampare.");

  printWindow.document.open();
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head><title>Dossier Tattico - ${eventName}</title><style>
      @page { size: A4 portrait; margin: 20mm; } body { font-family: Arial, sans-serif; color: #1e293b; line-height: 1.4; }
      .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; }
      .header h1 { color: #0891b2; margin: 0; font-size: 28px; text-transform: uppercase; } .header h2 { color: #64748b; margin: 10px 0 0 0; font-size: 18px; font-weight: normal; }
      .section-title { color: #fff; padding: 10px 15px; font-size: 14px; font-weight: bold; margin: 30px 0 15px 0; border-radius: 4px; page-break-after: avoid; }
      .bg-slate { background: #0f172a; } .bg-rose { background: #e11d48; } .bg-fuchsia { background: #c026d3; } .bg-amber { background: #d97706; }
      .map-container { text-align: center; margin-bottom: 10px; page-break-inside: avoid; } .map-image { width: 100%; max-width: 800px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
      .legend-grid { display: flex; flex-wrap: wrap; gap: 15px; margin-bottom: 25px; padding: 0 10px; page-break-inside: avoid; }
      .legend-item { width: calc(33.333% - 15px); display: flex; align-items: center; font-size: 14px; }
      .legend-badge { color: #fff; font-weight: bold; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 10px; font-size: 13px; box-shadow: 0 0 0 2px #fff, 0 0 0 3px #1e293b; }
      .team-block { margin-bottom: 20px; page-break-inside: avoid; } .team-name { font-weight: bold; font-size: 15px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
      .player-item { font-size: 13px; margin: 4px 0 4px 15px; color: #334155; }
      .timeline-group { margin-bottom: 15px; page-break-inside: avoid; } .timeline-time { font-weight: bold; color: #d97706; font-size: 14px; margin-bottom: 5px; } .timeline-action { font-size: 13px; margin: 3px 0 3px 15px; }
    </style></head>
    <body>
      <div class="header"><h1>DOSSIER TATTICO UFFICIALE</h1><h2>${eventName}</h2></div>
      <div class="section-title bg-slate">MAPPA TATTICA E POSIZIONAMENTI (RADAR)</div>
      <div class="map-container"><img class="map-image" src="${radarDataUrl}" /></div>
      ${mapLegendHtml}<div class="section-title bg-rose">1. SQUADRE D'ASSALTO E ASSEGNAZIONI</div>${teamsHtml}
      <div class="section-title bg-fuchsia">2. TRASFERIMENTI E LOGISTICA (VOLI)</div>${voliHtml}
      <div class="section-title bg-amber">3. TIMELINE OPERATIVA (CRONOLOGIA)</div>${timelineHtml}
      <script>window.onload = () => setTimeout(() => window.print(), 500);</script>
    </body></html>
  `);
  printWindow.document.close();
};