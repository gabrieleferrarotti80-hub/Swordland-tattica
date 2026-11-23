// src/utils/hivePdfExport.js

export function exportHiveToPdf({ players = [], structures = [], allianceCode = 'ALLEANZA' }) {
  const safeAllianceCode = String(allianceCode || 'ALLEANZA').replace(/[<>&"']/g, '');

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
    .map(s => {
      const typeLower = String(s.type || '').toLowerCase();
      const isBanner = typeLower === 'banner' || s.code === 'BAN';
      const isResource = typeLower === 'resource' || s.code === 'RES';
      const isTrap = typeLower === 'beartrap' || String(s.code || '').startsWith('TRP');
      const isHQ = typeLower === 'headquarters' || s.code === 'HQ';
      const defaultSize = isBanner ? 1 : isResource ? 2 : 3;
      return {
        ...s,
        isBanner,
        isResource,
        isTrap,
        isHQ,
        coordX: Number(s.newX !== undefined ? s.newX : s.x),
        coordY: Number(s.newY !== undefined ? s.newY : s.y),
        size: Number(s.size) || defaultSize
      };
    })
    .filter(s => !isNaN(s.coordX) && !isNaN(s.coordY) && !(s.coordX === 0 && s.coordY === 0));

  if (validPlayers.length === 0 && validStructs.length === 0) {
    alert("⚠️ Nessuna coordinata valida trovata per generare il PDF.");
    return;
  }

  const STEP = 18;
  const toIso = (x, y) => ({
    isoX: (x - y) * STEP,
    isoY: -(x + y) * STEP
  });

  const computeBounds = (items, paddingTiles) => {
    let minIsoX = Infinity;
    let maxIsoX = -Infinity;
    let minIsoY = Infinity;
    let maxIsoY = -Infinity;

    items.forEach(item => {
      const size = item.size || 2;
      const corners = [
        toIso(item.coordX, item.coordY),
        toIso(item.coordX + size, item.coordY),
        toIso(item.coordX, item.coordY + size),
        toIso(item.coordX + size, item.coordY + size)
      ];
      corners.forEach(c => {
        if (c.isoX < minIsoX) minIsoX = c.isoX;
        if (c.isoX > maxIsoX) maxIsoX = c.isoX;
        if (c.isoY < minIsoY) minIsoY = c.isoY;
        if (c.isoY > maxIsoY) maxIsoY = c.isoY;
      });
    });

    if (!isFinite(minIsoX)) {
      return { x: -200, y: -200, w: 400, h: 400 };
    }

    const pad = STEP * paddingTiles;
    const rawW = (maxIsoX - minIsoX) + pad * 2;
    const rawH = (maxIsoY - minIsoY) + pad * 2;
    const w = Math.max(260, rawW);
    const h = Math.max(180, rawH);
    const cx = (minIsoX + maxIsoX) / 2;
    const cy = (minIsoY + maxIsoY) / 2;

    return {
      x: cx - w / 2,
      y: cy - h / 2,
      w,
      h
    };
  };

  // 1. Inquadratura completa (tutti gli elementi)
  const allItems = [
    ...validPlayers.map(p => ({ coordX: p.coordX, coordY: p.coordY, size: 2 })),
    ...validStructs.map(s => ({ coordX: s.coordX, coordY: s.coordY, size: s.size }))
  ];
  const fullBounds = computeBounds(allItems, 3.5);

  // 2. Auto-centratura intelligente sull'alveare principale (scarta outlier e catene stendardi lontane)
  const coreStructs = validStructs.filter(s => s.isHQ || s.isTrap);
  let anchorX = 500;
  let anchorY = 500;

  if (coreStructs.length > 0) {
    anchorX = coreStructs.reduce((sum, s) => sum + s.coordX + s.size / 2, 0) / coreStructs.length;
    anchorY = coreStructs.reduce((sum, s) => sum + s.coordY + s.size / 2, 0) / coreStructs.length;
  } else if (validPlayers.length > 0) {
    const xs = validPlayers.map(p => p.coordX).sort((a, b) => a - b);
    const ys = validPlayers.map(p => p.coordY).sort((a, b) => a - b);
    const mid = Math.floor(xs.length / 2);
    anchorX = xs[mid];
    anchorY = ys[mid];
  }

  let smartPlayers = validPlayers;
  if (validPlayers.length > 0) {
    const withDist = validPlayers.map(p => ({
      ...p,
      dist: Math.hypot((p.coordX + 1) - anchorX, (p.coordY + 1) - anchorY)
    }));
    const sortedDists = withDist.map(p => p.dist).sort((a, b) => a - b);
    const medianDist = sortedDists[Math.floor(sortedDists.length / 2)] || 20;
    const maxRadius = Math.max(28, medianDist * 1.85);
    const filtered = withDist.filter(p => p.dist <= maxRadius);
    if (filtered.length > 0) {
      smartPlayers = filtered;
    }
  }

  const coreFocusItems = [
    ...coreStructs.map(s => ({ coordX: s.coordX, coordY: s.coordY, size: s.size })),
    ...smartPlayers.map(p => ({ coordX: p.coordX, coordY: p.coordY, size: 2 }))
  ];

  // Include risorse/stendardi solo se vicini al perimetro del nucleo alveare
  let minCoreX = Infinity;
  let maxCoreX = -Infinity;
  let minCoreY = Infinity;
  let maxCoreY = -Infinity;

  coreFocusItems.forEach(item => {
    if (item.coordX < minCoreX) minCoreX = item.coordX;
    if (item.coordX + item.size > maxCoreX) maxCoreX = item.coordX + item.size;
    if (item.coordY < minCoreY) minCoreY = item.coordY;
    if (item.coordY + item.size > maxCoreY) maxCoreY = item.coordY + item.size;
  });

  const nearbyObstacles = isFinite(minCoreX)
    ? validStructs.filter(
        s =>
          (s.isResource || s.isBanner) &&
          s.coordX >= minCoreX - 3 &&
          s.coordX <= maxCoreX + 3 &&
          s.coordY >= minCoreY - 3 &&
          s.coordY <= maxCoreY + 3
      )
    : [];

  const smartItems = [
    ...coreFocusItems,
    ...nearbyObstacles.map(s => ({ coordX: s.coordX, coordY: s.coordY, size: s.size }))
  ];

  const smartBounds = smartItems.length > 0 ? computeBounds(smartItems, 2.2) : fullBounds;

  const createDiamondPolygon = (x, y, size) => {
    const p1 = toIso(x, y);
    const p2 = toIso(x + size, y);
    const p3 = toIso(x + size, y + size);
    const p4 = toIso(x, y + size);
    return p1.isoX + ',' + p1.isoY + ' ' + p2.isoX + ',' + p2.isoY + ' ' + p3.isoX + ',' + p3.isoY + ' ' + p4.isoX + ',' + p4.isoY;
  };

  // Layer separati per toggle istantanei nell'anteprima
  const bannersSvg = validStructs
    .filter(s => s.isBanner)
    .map(s => {
      const center = toIso(s.coordX + 0.5, s.coordY + 0.5);
      return `
        <g>
          <polygon points="${createDiamondPolygon(s.coordX, s.coordY, 1)}" fill="#581c87" fill-opacity="0.85" stroke="#c084fc" stroke-width="2" />
          <text x="${center.isoX}" y="${center.isoY + 3}" text-anchor="middle" fill="#e9d5ff" font-size="7" font-family="Arial, sans-serif">🚩</text>
        </g>
      `;
    })
    .join('');

  const resourcesSvg = validStructs
    .filter(s => s.isResource)
    .map(s => {
      const center = toIso(s.coordX + 1, s.coordY + 1);
      return `
        <g>
          <polygon points="${createDiamondPolygon(s.coordX, s.coordY, 2)}" fill="#78350f" fill-opacity="0.85" stroke="#f59e0b" stroke-width="1.8" stroke-dasharray="3,2" />
          <text x="${center.isoX}" y="${center.isoY + 2}" text-anchor="middle" fill="#fde68a" font-size="9" font-family="Arial, sans-serif">⛏️</text>
          <text x="${center.isoX}" y="${center.isoY + 13}" text-anchor="middle" fill="#fcd34d" font-size="6.5" font-weight="bold" font-family="monospace">${s.coordX}:${s.coordY}</text>
        </g>
      `;
    })
    .join('');

  const coreStructsSvg = validStructs
    .filter(s => !s.isBanner && !s.isResource)
    .map(s => {
      const fill = s.isTrap ? '#831843' : '#1e3a8a';
      const stroke = s.isTrap ? '#f472b6' : '#60a5fa';
      const center = toIso(s.coordX + s.size / 2, s.coordY + s.size / 2);
      const rawLabel = s.name || s.code || 'STRUTTURA';
      const label = String(rawLabel).replace(/[<>&"']/g, '');
      return `
        <g>
          <polygon points="${createDiamondPolygon(s.coordX, s.coordY, s.size)}" fill="${fill}" fill-opacity="0.88" stroke="${stroke}" stroke-width="2" />
          <rect x="${center.isoX - 48}" y="${center.isoY - 12}" width="96" height="24" rx="4" fill="#0f172a" stroke="${stroke}" stroke-width="1" />
          <text x="${center.isoX}" y="${center.isoY + 3}" text-anchor="middle" fill="#ffffff" font-size="9" font-weight="900" font-family="Arial, sans-serif">${label}</text>
          <text x="${center.isoX}" y="${center.isoY + 18}" text-anchor="middle" fill="${stroke}" font-size="7.5" font-weight="bold" font-family="monospace">(${s.coordX}:${s.coordY})</text>
        </g>
      `;
    })
    .join('');

  const castlesSvg = validPlayers
    .map(p => {
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
          <rect x="${center.isoX - 34}" y="${center.isoY - 17}" width="68" height="14" rx="3" fill="${badgeBg}" fill-opacity="0.92" stroke="${stroke}" stroke-width="0.8" />
          <text x="${center.isoX}" y="${center.isoY - 7.5}" text-anchor="middle" fill="#ffffff" font-size="7.5" font-weight="bold" font-family="Arial, sans-serif">${safeName.slice(0, 13)}</text>
          <text x="${center.isoX}" y="${center.isoY + 16}" text-anchor="middle" fill="#cbd5e1" font-size="6.5" font-weight="bold" font-family="monospace">${p.coordX}:${p.coordY}</text>
        </g>
      `;
    })
    .join('');

  const sortedForTable = [...validPlayers].sort((a, b) => {
    if (a.trap !== b.trap) return a.trap - b.trap;
    const scoreA = a.pwr * a.part;
    const scoreB = b.pwr * b.part;
    if (scoreB !== scoreA) return scoreB - scoreA;
    return String(a.name || '').localeCompare(String(b.name || ''));
  });

  const dateStr = new Date().toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const rowsHtml = sortedForTable
    .map((p, idx) => {
      const safeName = String(p.name || 'Player').replace(/[<>&"']/g, '');
      const safeTag = p.tag ? String(p.tag).replace(/[<>&"']/g, '') : '';
      return `
        <tr>
          <td style="text-align:center; font-weight:bold; color:#64748b;">${idx + 1}</td>
          <td style="font-weight:bold; color:#0f172a;">${safeTag ? `<span style="color:#0284c7; font-size:10px;">[${safeTag}]</span> ` : ''}${safeName}</td>
          <td style="text-align:center; font-weight:bold; color:${p.trap === 2 ? '#059669' : '#0284c7'};">Trappola ${p.trap}</td>
          <td style="text-align:center;">${p.ring ? `Anello ${p.ring}` : '-'}</td>
          <td style="text-align:right; font-family:monospace; font-weight:bold;">${p.pwr} M</td>
          <td style="text-align:center;">${p.part}x</td>
          <td style="text-align:center; font-family:monospace; font-weight:900; font-size:13px; color:#0f172a; background:#f1f5f9;">X: ${p.coordX} &nbsp;|&nbsp; Y: ${p.coordY}</td>
        </tr>
      `;
    })
    .join('');

  const smartJson = JSON.stringify(smartBounds);
  const fullJson = JSON.stringify(fullBounds);
  const initialVbStr = smartBounds.x + ' ' + smartBounds.y + ' ' + smartBounds.w + ' ' + smartBounds.h;

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="it">
    <head>
      <meta charset="UTF-8" />
      <title>Mappa_Hive_${safeAllianceCode}</title>
      <style>
        @page { size: A4 landscape; margin: 10mm; }
        * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        body {
          margin: 0;
          padding: 0;
          font-family: Arial, Helvetica, sans-serif;
          background: #0f172a;
          color: #0f172a;
        }

        /* Barra di controllo anteprima (nascosta nel PDF) */
        .toolbar {
          position: sticky;
          top: 0;
          z-index: 100;
          background: #020617;
          border-bottom: 1px solid #1e293b;
          color: #e2e8f0;
          padding: 10px 16px;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.45);
          user-select: none;
        }
        .toolbar-group {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 6px;
        }
        .btn {
          background: #1e293b;
          color: #e2e8f0;
          border: 1px solid #334155;
          border-radius: 8px;
          padding: 6px 10px;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .btn:hover { background: #334155; }
        .btn.active {
          background: #0284c7;
          border-color: #38bdf8;
          color: #ffffff;
          box-shadow: 0 0 10px rgba(56, 189, 248, 0.35);
        }
        .btn-print {
          background: #059669;
          border-color: #34d399;
          color: #ffffff;
          padding: 8px 16px;
          font-size: 12px;
        }
        .btn-print:hover { background: #10b981; }
        .toggle-label {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          font-weight: 700;
          color: #cbd5e1;
          background: #0f172a;
          border: 1px solid #334155;
          padding: 5px 9px;
          border-radius: 8px;
          cursor: pointer;
        }
        .hint-bar {
          background: #1e293b;
          color: #93c5fd;
          text-align: center;
          font-size: 11px;
          font-weight: 700;
          padding: 6px 12px;
          border-bottom: 1px solid #334155;
          user-select: none;
        }

        .preview-shell {
          max-width: 1120px;
          margin: 18px auto 32px auto;
          padding: 0 14px;
        }

        .page-map {
          width: 100%;
          aspect-ratio: 277 / 185;
          display: flex;
          flex-direction: column;
          background: #090e17;
          color: #f8fafc;
          border-radius: 12px;
          padding: 12px 16px;
          border: 2px solid #334155;
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
        }
        .map-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid #1e293b;
          padding-bottom: 8px;
          margin-bottom: 8px;
          gap: 8px;
        }
        .legend { display: flex; flex-wrap: wrap; gap: 12px; font-size: 11px; font-weight: bold; }
        .legend span { display: inline-flex; align-items: center; gap: 5px; }
        .dot { width: 12px; height: 12px; border-radius: 3px; display: inline-block; }
        .svg-wrapper {
          flex: 1;
          width: 100%;
          height: 100%;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px dashed rgba(56, 189, 248, 0.35);
          border-radius: 8px;
          background: #060a12;
          position: relative;
        }
        #hive-pdf-svg {
          width: 100%;
          height: 100%;
          display: block;
          user-select: none;
        }
        #hive-pdf-svg.mode-crop { cursor: crosshair; }
        #hive-pdf-svg.mode-pan { cursor: grab; }
        #hive-pdf-svg.mode-pan.dragging { cursor: grabbing; }

        .page-list {
          margin-top: 24px;
          background: #ffffff;
          border-radius: 12px;
          padding: 18px 20px;
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.4);
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

        @media print {
          body { background: #ffffff !important; }
          .no-print { display: none !important; }
          .preview-shell {
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .page-map {
            height: 185mm !important;
            aspect-ratio: auto !important;
            border: 2px solid #1e293b !important;
            box-shadow: none !important;
          }
          .svg-wrapper {
            border: none !important;
          }
          .page-list {
            page-break-before: always;
            margin-top: 0 !important;
            padding: 6px 4px !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }
          #crop-rect { display: none !important; }
        }
      </style>
    </head>
    <body>
      <div class="toolbar no-print">
        <div class="toolbar-group">
          <button id="btn-mode-crop" class="btn active" title="Disegna una finestra sulla mappa per ritagliarla">✂️ Ritaglia Finestra</button>
          <button id="btn-mode-pan" class="btn" title="Trascina la mappa per centrarla">✋ Sposta</button>
          <button id="btn-zoom-in" class="btn" title="Avvicina zoom">➕ Zoom</button>
          <button id="btn-zoom-out" class="btn" title="Allontana zoom">➖ Zoom</button>
          <button id="btn-fit-smart" class="btn" title="Centra automaticamente sul nucleo dell'alveare">🎯 Auto-Centra Alveare</button>
          <button id="btn-fit-all" class="btn" title="Mostra tutti gli elementi della mappa">🗺️ Mostra Tutto</button>
        </div>
        <div class="toolbar-group">
          <label class="toggle-label">
            <input type="checkbox" id="chk-banners" checked />
            <span>🚩 Stendardi</span>
          </label>
          <label class="toggle-label">
            <input type="checkbox" id="chk-resources" checked />
            <span>⛏️ Risorse</span>
          </label>
          <button id="btn-print" class="btn btn-print">🖨️ Salva / Stampa PDF</button>
        </div>
      </div>

      <div id="hint-bar" class="hint-bar no-print">
        ✂️ Modalità Finestra attiva: trascina un rettangolo sulla mappa per inquadrare l'area esatta da salvare • Usa la rotellina per lo zoom
      </div>

      <div class="preview-shell">
        <!-- FOGLIO 1: MAPPA HIVE INQUADRATA -->
        <div class="page-map">
          <div class="map-header">
            <div>
              <div style="font-size:18px; font-weight:900; letter-spacing:1px; color:#38bdf8;">🏰 MAPPA UFFICIALE HIVE — [${safeAllianceCode}]</div>
              <div style="font-size:10px; color:#94a3b8; margin-top:2px;">Generata il ${dateStr} • Totale Castelli Piazzati: ${validPlayers.length}</div>
            </div>
            <div class="legend">
              <span><i class="dot" style="background:#1e293b; border:2px solid #38bdf8;"></i> Squadra Trappola 1</span>
              <span><i class="dot" style="background:#064e3b; border:2px solid #34d399;"></i> Squadra Trappola 2</span>
              <span><i class="dot" style="background:#831843; border:2px solid #f472b6;"></i> Trappole Orso (3x3)</span>
              <span><i class="dot" style="background:#1e3a8a; border:2px solid #60a5fa;"></i> QG Alleanza (3x3)</span>
              <span><i class="dot" style="background:#78350f; border:2px solid #f59e0b;"></i> Risorsa Bloccata (2x2)</span>
            </div>
          </div>
          <div class="svg-wrapper">
            <svg id="hive-pdf-svg" class="mode-crop" viewBox="${initialVbStr}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
              <g id="layer-banners">${bannersSvg}</g>
              <g id="layer-resources">${resourcesSvg}</g>
              <g id="layer-core">${coreStructsSvg}</g>
              <g id="layer-castles">${castlesSvg}</g>
              <rect id="crop-rect" x="0" y="0" width="0" height="0" fill="rgba(56, 189, 248, 0.16)" stroke="#38bdf8" stroke-width="2" stroke-dasharray="6,4" style="display:none; pointer-events:none;" />
            </svg>
          </div>
        </div>

        <!-- FOGLIO 2: ELENCO GIOCATORI E COORDINATE -->
        <div class="page-list">
          <div class="list-header">
            <div>
              <h2 style="margin:0; font-size:18px; text-transform:uppercase;">📋 Elenco Assegnazione Coordinate Hive [${safeAllianceCode}]</h2>
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
      </div>

      <script>
        (function() {
          const smartBounds = ${smartJson};
          const fullBounds = ${fullJson};
          const svg = document.getElementById('hive-pdf-svg');
          const cropRect = document.getElementById('crop-rect');
          const hintBar = document.getElementById('hint-bar');
          const btnCrop = document.getElementById('btn-mode-crop');
          const btnPan = document.getElementById('btn-mode-pan');
          const btnZoomIn = document.getElementById('btn-zoom-in');
          const btnZoomOut = document.getElementById('btn-zoom-out');
          const btnFitSmart = document.getElementById('btn-fit-smart');
          const btnFitAll = document.getElementById('btn-fit-all');
          const btnPrint = document.getElementById('btn-print');
          const chkBanners = document.getElementById('chk-banners');
          const chkResources = document.getElementById('chk-resources');
          const layerBanners = document.getElementById('layer-banners');
          const layerResources = document.getElementById('layer-resources');

          let vb = { x: smartBounds.x, y: smartBounds.y, w: smartBounds.w, h: smartBounds.h };
          let mode = 'crop';
          let isDown = false;
          let startPt = null;
          let startVb = null;
          let startCtm = null;
          let activeCrop = null;

          const maxW = Math.max(fullBounds.w * 3, 1800);
          const minW = 120;

          function applyViewBox() {
            svg.setAttribute('viewBox', vb.x + ' ' + vb.y + ' ' + vb.w + ' ' + vb.h);
          }

          function clientToSvg(clientX, clientY, customCtm) {
            const pt = svg.createSVGPoint();
            pt.x = clientX;
            pt.y = clientY;
            const matrix = customCtm || svg.getScreenCTM();
            if (!matrix) return { x: 0, y: 0 };
            const res = pt.matrixTransform(matrix.inverse());
            return { x: res.x, y: res.y };
          }

          function setMode(nextMode) {
            mode = nextMode;
            btnCrop.classList.toggle('active', mode === 'crop');
            btnPan.classList.toggle('active', mode === 'pan');
            svg.classList.toggle('mode-crop', mode === 'crop');
            svg.classList.toggle('mode-pan', mode === 'pan');
            hintBar.textContent = mode === 'crop'
              ? '✂️ Modalità Finestra attiva: trascina un rettangolo sulla mappa per inquadrare la zona da salvare • Rotellina per lo zoom'
              : '✋ Modalità Sposta attiva: trascina la mappa per centrarla nel foglio A4 • Rotellina per lo zoom';
          }

          function zoomAt(factor, centerPt) {
            const nextW = Math.max(minW, Math.min(maxW, vb.w * factor));
            const ratio = nextW / vb.w;
            const nextH = vb.h * ratio;
            const cx = centerPt ? centerPt.x : (vb.x + vb.w / 2);
            const cy = centerPt ? centerPt.y : (vb.y + vb.h / 2);
            vb = {
              x: cx - (cx - vb.x) * ratio,
              y: cy - (cy - vb.y) * ratio,
              w: nextW,
              h: nextH
            };
            applyViewBox();
          }

          btnCrop.addEventListener('click', function() { setMode('crop'); });
          btnPan.addEventListener('click', function() { setMode('pan'); });
          btnZoomIn.addEventListener('click', function() { zoomAt(0.8); });
          btnZoomOut.addEventListener('click', function() { zoomAt(1.25); });
          btnFitSmart.addEventListener('click', function() {
            vb = { x: smartBounds.x, y: smartBounds.y, w: smartBounds.w, h: smartBounds.h };
            applyViewBox();
          });
          btnFitAll.addEventListener('click', function() {
            vb = { x: fullBounds.x, y: fullBounds.y, w: fullBounds.w, h: fullBounds.h };
            applyViewBox();
          });
          btnPrint.addEventListener('click', function() {
            window.focus();
            window.print();
          });

          chkBanners.addEventListener('change', function() {
            layerBanners.style.display = chkBanners.checked ? '' : 'none';
          });
          chkResources.addEventListener('change', function() {
            layerResources.style.display = chkResources.checked ? '' : 'none';
          });

          svg.addEventListener('wheel', function(e) {
            e.preventDefault();
            const pt = clientToSvg(e.clientX, e.clientY);
            zoomAt(e.deltaY < 0 ? 0.88 : 1.14, pt);
          }, { passive: false });

          svg.addEventListener('mousedown', function(e) {
            if (e.button !== 0) return;
            e.preventDefault();
            isDown = true;
            startCtm = svg.getScreenCTM();
            startPt = clientToSvg(e.clientX, e.clientY, startCtm);
            startVb = { x: vb.x, y: vb.y, w: vb.w, h: vb.h };
            activeCrop = null;

            if (mode === 'crop') {
              const strokeW = Math.max(1.5, vb.w / 320);
              cropRect.setAttribute('x', startPt.x);
              cropRect.setAttribute('y', startPt.y);
              cropRect.setAttribute('width', 0);
              cropRect.setAttribute('height', 0);
              cropRect.setAttribute('stroke-width', strokeW);
              cropRect.setAttribute('stroke-dasharray', (strokeW * 3) + ',' + (strokeW * 2));
              cropRect.style.display = 'block';
            } else {
              svg.classList.add('dragging');
            }
          });

          window.addEventListener('mousemove', function(e) {
            if (!isDown || !startCtm || !startPt) return;
            const curPt = clientToSvg(e.clientX, e.clientY, startCtm);

            if (mode === 'crop') {
              const rx = Math.min(startPt.x, curPt.x);
              const ry = Math.min(startPt.y, curPt.y);
              const rw = Math.abs(curPt.x - startPt.x);
              const rh = Math.abs(curPt.y - startPt.y);
              activeCrop = { x: rx, y: ry, w: rw, h: rh };
              cropRect.setAttribute('x', rx);
              cropRect.setAttribute('y', ry);
              cropRect.setAttribute('width', rw);
              cropRect.setAttribute('height', rh);
            } else {
              const dx = curPt.x - startPt.x;
              const dy = curPt.y - startPt.y;
              vb = {
                x: startVb.x - dx,
                y: startVb.y - dy,
                w: startVb.w,
                h: startVb.h
              };
              applyViewBox();
            }
          });

          window.addEventListener('mouseup', function() {
            if (!isDown) return;
            isDown = false;
            svg.classList.remove('dragging');

            if (mode === 'crop') {
              cropRect.style.display = 'none';
              if (activeCrop && activeCrop.w > 20 && activeCrop.h > 20) {
                vb = {
                  x: activeCrop.x,
                  y: activeCrop.y,
                  w: Math.max(minW, activeCrop.w),
                  h: Math.max(90, activeCrop.h)
                };
                applyViewBox();
              }
            }
          });
        })();
      <\/script>
    </body>
    </html>
  `;

  const printWin = window.open('', '_blank', 'width=1240,height=880');
  if (!printWin) {
    alert("⚠️ Il browser ha bloccato il popup. Consenti i popup per questa pagina per scaricare il PDF.");
    return;
  }
  printWin.document.open();
  printWin.document.write(htmlContent);
  printWin.document.close();
}