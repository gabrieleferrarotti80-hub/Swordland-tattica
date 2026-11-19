// src/utils/hivePdfExport.js

export function exportHiveToPdf({ players = [], structures = [], allianceCode = 'ALLEANZA' }) {
  // Normalizza i giocatori con coordinate valide
  const validPlayers = players
    .map(p => ({
      ...p,
      coordX: Number(p.newX !== undefined ? p.newX : p.x),
      coordY: Number(p.newY !== undefined ? p.newY : p.y),
      trap: Number(p.assignedTrap) || 1,
      part: Number(p.participation) || 2,
      pwr: Number(p.power) || 0
    }))
    .filter(p => !isNaN(p.coordX) && !isNaN(p.coordY) && p.coordX !== 0 && p.coordY !== 0);

  const validStructs = structures
    .map(s => ({
      ...s,
      coordX: Number(s.newX !== undefined ? s.newX : s.x),
      coordY: Number(s.newY !== undefined ? s.newY : s.y),
      size: Number(s.size) || (String(s.type).toLowerCase() === 'banner' || s.code === 'BAN' ? 1 : 3)
    }))
    .filter(s => !isNaN(s.coordX) && !isNaN(s.coordY));

  if (validPlayers.length === 0 && validStructs.length === 0) {
    alert("⚠️ Nessuna coordinata valida trovata per generare il PDF.");
    return;
  }

  // Proiezione isometrica (stessa formula usata in MapPage.jsx)
  const STEP = 18; // Dimensione scala per leggibilità perfetta dei nomi
  const toIso = (x, y) => ({
    isoX: (x - y) * STEP,
    isoY: -(x + y) * STEP
  });

  // Calcolo Bounding Box automatico per inquadrare solo l'Hive
  let minIsoX = Infinity, maxIsoX = -Infinity, minIsoY = Infinity, maxIsoY = -Infinity;

  const registerBounds = (x, y, size = 2) => {
    const corners = [
      toIso(x, y),
      toIso(x + size, y),
      toIso(x, y + size),
      toIso(x + size, y + size)
    ];
    corners.forEach(c => {
      if (c.isoX < minIsoX) minIsoX = c.isoX;
      if (c.isoX > maxIsoX) maxIsoX = c.isoX;
      if (c.isoY < minIsoY) minIsoY = c.isoY;
      if (c.isoY > maxIsoY) maxIsoY = c.isoY;
    });
  };

  validPlayers.forEach(p => registerBounds(p.coordX, p.coordY, 2));
  validStructs.forEach(s => registerBounds(s.coordX, s.coordY, s.size));

  const PADDING = STEP * 5;
  const viewX = minIsoX - PADDING;
  const viewY = minIsoY - PADDING;
  const viewW = Math.max(400, (maxIsoX - minIsoX) + PADDING * 2);
  const viewH = Math.max(400, (maxIsoY - minIsoY) + PADDING * 2);

  // Funzione che disegna un rombo isometrico di dimensione WxH
  const createDiamondPolygon = (x, y, size) => {
    const p1 = toIso(x, y);
    const p2 = toIso(x + size, y);
    const p3 = toIso(x + size, y + size);
    const p4 = toIso(x, y + size);
    return `${p1.isoX},${p1.isoY} ${p2.isoX},${p2.isoY} ${p3.isoX},${p3.isoY} ${p4.isoX},${p4.isoY}`;
  };

  // Costruzione elementi SVG per Strutture (QG, Trappole, Stendardi)
  const structsSvg = validStructs.map(s => {
    const typeLower = String(s.type || '').toLowerCase();
    const isBanner = typeLower === 'banner' || s.code === 'BAN';
    const isTrap = typeLower === 'beartrap' || String(s.code).startsWith('TRP');
    const size = isBanner ? 1 : 3;

    const fill = isBanner ? '#581c87' : isTrap ? '#831843' : '#1e3a8a';
    const stroke = isBanner ? '#c084fc' : isTrap ? '#f472b6' : '#60a5fa';
    const center = toIso(s.coordX + size / 2, s.coordY + size / 2);
    const label = isBanner ? '🚩' : (s.name || s.code || 'STRUTTURA');

    return `
      <g>
        <polygon points="${createDiamondPolygon(s.coordX, s.coordY, size)}" fill="${fill}" fill-opacity="0.85" stroke="${stroke}" stroke-width="2" />
        ${!isBanner ? `
          <rect x="${center.isoX - 48}" y="${center.isoY - 12}" width="96" height="24" rx="4" fill="#0f172a" stroke="${stroke}" stroke-width="1" />
          <text x="${center.isoX}" y="${center.isoY + 3}" text-anchor="middle" fill="#ffffff" font-size="9" font-weight="900" font-family="Arial, sans-serif">${label}</text>
          <text x="${center.isoX}" y="${center.isoY + 18}" text-anchor="middle" fill="${stroke}" font-size="7.5" font-weight="bold" font-family="monospace">(${s.coordX}:${s.coordY})</text>
        ` : `
          <text x="${center.isoX}" y="${center.isoY + 3}" text-anchor="middle" fill="#e9d5ff" font-size="7" font-family="Arial, sans-serif">🚩</text>
        `}
      </g>
    `;
  }).join('');

  // Costruzione elementi SVG per i Castelli Giocatori (2x2) con Nome sopra il Castello
  const castlesSvg = validPlayers.map(p => {
    const center = toIso(p.coordX + 1, p.coordY + 1);
    const isTrap2 = p.trap === 2;
    const fill = isTrap2 ? '#064e3b' : '#1e293b';
    const stroke = isTrap2 ? '#34d399' : '#38bdf8';
    const badgeBg = isTrap2 ? '#022c22' : '#0f172a';
    const safeName = String(p.name || 'Player').replace(/[<>&"']/g, '');

    return `
      <g>
        <polygon points="${createDiamondPolygon(p.coordX, p.coordY, 2)}" fill="${fill}" stroke="${stroke}" stroke-width="1.5" />
        <circle cx="${center.isoX}" cy="${center.isoY + 5}" r="4.5" fill="${stroke}" opacity="0.6" />
        <!-- Targhetta Nome sopra il Castello -->
        <rect x="${center.isoX - 34}" y="${center.isoY - 17}" width="68" height="14" rx="3" fill="${badgeBg}" fill-opacity="0.92" stroke="${stroke}" stroke-width="0.8" />
        <text x="${center.isoX}" y="${center.isoY - 7.5}" text-anchor="middle" fill="#ffffff" font-size="7.5" font-weight="bold" font-family="Arial, sans-serif">${safeName.slice(0, 13)}</text>
        <!-- Coordinate sotto il nome -->
        <text x="${center.isoX}" y="${center.isoY + 16}" text-anchor="middle" fill="#cbd5e1" font-size="6.5" font-weight="bold" font-family="monospace">${p.coordX}:${p.coordY}</text>
      </g>
    `;
  }).join('');

  // Ordinamento giocatori per il Foglio 2 (prima per Trappola, poi per Score Orso / Nome)
  const sortedForTable = [...validPlayers].sort((a, b) => {
    if (a.trap !== b.trap) return a.trap - b.trap;
    const scoreA = a.pwr * a.part;
    const scoreB = b.pwr * b.part;
    if (scoreB !== scoreA) return scoreB - scoreA;
    return String(a.name || '').localeCompare(String(b.name || ''));
  });

  const dateStr = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const rowsHtml = sortedForTable.map((p, idx) => `
    <tr>
      <td style="text-align:center; font-weight:bold; color:#64748b;">${idx + 1}</td>
      <td style="font-weight:bold; color:#0f172a;">${p.tag ? `<span style="color:#0284c7; font-size:10px;">[${p.tag}]</span> ` : ''}${p.name}</td>
      <td style="text-align:center; font-weight:bold; color:${p.trap === 2 ? '#059669' : '#0284c7'};">Trappola ${p.trap}</td>
      <td style="text-align:center;">${p.ring ? `Anello ${p.ring}` : '-'}</td>
      <td style="text-align:right; font-family:monospace; font-weight:bold;">${p.pwr} M</td>
      <td style="text-align:center;">${p.part}x</td>
      <td style="text-align:center; font-family:monospace; font-weight:900; font-size:13px; color:#0f172a; background:#f1f5f9;">X: ${p.coordX} &nbsp;|&nbsp; Y: ${p.coordY}</td>
    </tr>
  `).join('');

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="it">
    <head>
      <meta charset="UTF-8" />
      <title>Mappa_Hive_${allianceCode}</title>
      <style>
        @page { size: A4 landscape; margin: 10mm; }
        * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        body { margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background: #ffffff; color: #0f172a; }
        .page-map {
          width: 100%;
          height: 185mm;
          display: flex;
          flex-direction: column;
          background: #090e17;
          color: #f8fafc;
          border-radius: 12px;
          padding: 12px 16px;
          border: 2px solid #1e293b;
        }
        .map-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid #1e293b;
          padding-bottom: 8px;
          margin-bottom: 8px;
        }
        .legend { display: flex; gap: 14px; font-size: 11px; font-weight: bold; }
        .legend span { display: inline-flex; align-items: center; gap: 5px; }
        .dot { width: 12px; height: 12px; border-radius: 3px; display: inline-block; }
        .svg-wrapper { flex: 1; width: 100%; height: 100%; overflow: hidden; display: flex; align-items: center; justify-content: center; }
        
        .page-list {
          page-break-before: always;
          padding: 6px 4px;
        }
        .list-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          border-bottom: 2px solid #0f172a;
          padding-bottom: 8px;
          margin-bottom: 12px;
        }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th { background: #0f172a; color: #ffffff; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; padding: 7px 8px; border: 1px solid #0f172a; }
        td { padding: 5px 8px; border: 1px solid #cbd5e1; }
        tr:nth-child(even) td { background: #f8fafc; }
      </style>
    </head>
    <body>
      <!-- FOGLIO 1: MAPPA HIVE CON NOMI SOPRA I CASTELLI -->
      <div class="page-map">
        <div class="map-header">
          <div>
            <div style="font-size:18px; font-weight:900; letter-spacing:1px; color:#38bdf8;">🏰 MAPPA UFFICIALE HIVE — [${allianceCode}]</div>
            <div style="font-size:10px; color:#94a3b8; margin-top:2px;">Generata il ${dateStr} • Totale Castelli Piazzati: ${validPlayers.length}</div>
          </div>
          <div class="legend">
            <span><i class="dot" style="background:#1e293b; border:2px solid #38bdf8;"></i> Squadra Trappola 1</span>
            <span><i class="dot" style="background:#064e3b; border:2px solid #34d399;"></i> Squadra Trappola 2</span>
            <span><i class="dot" style="background:#831843; border:2px solid #f472b6;"></i> Trappole Orso (3x3)</span>
            <span><i class="dot" style="background:#1e3a8a; border:2px solid #60a5fa;"></i> QG Alleanza (3x3)</span>
          </div>
        </div>
        <div class="svg-wrapper">
          <svg viewBox="${viewX} ${viewY} ${viewW} ${viewH}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
            ${structsSvg}
            ${castlesSvg}
          </svg>
        </div>
      </div>

      <!-- FOGLIO 2: ELENCO GIOCATORI E COORDINATE -->
      <div class="page-list">
        <div class="list-header">
          <div>
            <h2 style="margin:0; font-size:18px; text-transform:uppercase;">📋 Elenco Assegnazione Coordinate Hive [${allianceCode}]</h2>
            <p style="margin:3px 0 0 0; font-size:11px; color:#475569;">Riepilogo completo delle coordinate (X, Y) di ciascun castello 2x2.</p>
          </div>
          <div style="font-size:11px; font-weight:bold; color:#475569;">Data: ${dateStr}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width:40px;">#</th>
              <th style="text-align:left;">Giocatore</th>
              <th style="width:110px;">Squadra Orso</th>
              <th style="width:90px;">Fascia Hive</th>
              <th style="width:95px; text-align:right;">Potenza</th>
              <th style="width:75px;">Costanza</th>
              <th style="width:170px;">Coordinate (X | Y)</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>

      <script>
        window.onload = function() {
          setTimeout(function() {
            window.focus();
            window.print();
          }, 350);
        };
      </script>
    </body>
    </html>
  `;

  const printWin = window.open('', '_blank', 'width=1200,height=850');
  if (!printWin) {
    alert("⚠️ Il browser ha bloccato il popup. Consenti i popup per questa pagina per scaricare il PDF.");
    return;
  }
  printWin.document.open();
  printWin.document.write(htmlContent);
  printWin.document.close();
}