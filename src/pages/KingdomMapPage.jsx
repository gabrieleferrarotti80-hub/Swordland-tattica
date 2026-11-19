import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { mapBuildings } from '../data/mapBuildings';

const ALLIANCE_COLORS = [
  '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#a855f7', 
  '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#6366f1', '#eab308'
];

const getBuildingStyle = (type, id) => {
  const t = String(type || '').toLowerCase();
  if (t === 'castle' || id === 'castle-1') {
    return { fill: '#78350f', stroke: '#fbbf24', text: '#fef3c7', size: 4.5, icon: '👑' };
  }
  if (t === 'turret') {
    return { fill: '#7c2d12', stroke: '#fb923c', text: '#ffedd5', size: 2.2, icon: '🗼' };
  }
  if (t === 'fortress') {
    return { fill: '#4c1d95', stroke: '#c084fc', text: '#f3e8ff', size: 3.4, icon: '🏯' };
  }
  if (t === 'sanctuary') {
    return { fill: '#1e3a8a', stroke: '#60a5fa', text: '#dbeafe', size: 2.8, icon: '⛪' };
  }
  return { fill: '#1e293b', stroke: '#94a3b8', text: '#e2e8f0', size: 2.0, icon: '🏰' };
};

export default function KingdomMapPage({ auth }) {
  const { kingdomId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const mainRef = useRef(null);

  const isSharedView = searchParams.get('shared') === '1';
  const isStaff = auth?.role === 'admin' || auth?.role === 'consulente';
  const isReadOnlyShare = !isStaff && isSharedView;

  const [isLoading, setIsLoading] = useState(true);
  const [kingdomData, setKingdomData] = useState([]);
  const [kingdomBuildings, setKingdomBuildings] = useState([]);
  const [showBannersHalo, setShowBannersHalo] = useState(true);
  const [showKingdomBuildings, setShowKingdomBuildings] = useState(true);
  const [linkCopied, setLinkCopied] = useState(false);

  // --- STATI SELEZIONE AREA PDF ---
  const [isSelectingPdfArea, setIsSelectingPdfArea] = useState(false);
  const [selectionBox, setSelectionBox] = useState(null);
  const isDrawingSelection = useRef(false);
  
  const [camera, setCamera] = useState({ scale: 1, x: 0, y: 0 });
  const cameraRef = useRef(camera);
  cameraRef.current = camera;

  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const TILE_SF = 550 / 1200;
  const gridTranslateX = 600 - TILE_SF;
  const gridTranslateY = 1150 - TILE_SF;

  const focusOnTargets = useCallback((targets, customScale = null) => {
    if (!targets || targets.length === 0) return;

    let minSvgX = Infinity, maxSvgX = -Infinity, minSvgY = Infinity, maxSvgY = -Infinity;

    targets.forEach(t => {
      const nx = Number(t.x);
      const ny = Number(t.y);
      if (!isNaN(nx) && !isNaN(ny)) {
        const svgX = 600 + (nx - ny) * TILE_SF;
        const svgY = 1150 - (nx + ny) * TILE_SF;
        if (svgX < minSvgX) minSvgX = svgX;
        if (svgX > maxSvgX) maxSvgX = svgX;
        if (svgY < minSvgY) minSvgY = svgY;
        if (svgY > maxSvgY) maxSvgY = svgY;
      }
    });

    if (minSvgX === Infinity) return;

    const centerX = (minSvgX + maxSvgX) / 2;
    const centerY = (minSvgY + maxSvgY) / 2;
    const boxW = Math.max(20, maxSvgX - minSvgX);
    const boxH = Math.max(20, maxSvgY - minSvgY);

    const vW = window.innerWidth;
    const vH = window.innerHeight;

    const idealScale = customScale || Math.min(Math.max(1.5, Math.min(vW / (boxW * 2.2), vH / (boxH * 2.2))), 120);

    setCamera({
      scale: idealScale,
      x: vW / 2 - centerX * idealScale,
      y: vH / 2 - centerY * idealScale
    });
  }, [TILE_SF]);

  useEffect(() => {
    if (!isStaff && !isSharedView) {
      alert("Accesso negato. Solo l'Admin può vedere l'intero regno o usare un link condiviso.");
      navigate('/');
      return;
    }

    const loadKingdom = async () => {
      try {
        // 1. Base edifici del regno da mapBuildings.js + eventuali override salvati per il regno
        const baseBuildings = (mapBuildings || []).map(b => ({
          id: b.id,
          name: b.name,
          type: b.type,
          level: b.level,
          x: b.x,
          y: b.y,
          occupant: b.occupant || ''
        }));

        try {
          const kSnap = await getDoc(doc(db, 'kingdoms', String(kingdomId)));
          if (kSnap.exists()) {
            const kData = kSnap.data();
            const customBld = kData.buildings || kData.fixedBuildings || kData.outposts;
            if (Array.isArray(customBld) && customBld.length > 0) {
              const customMap = new Map(customBld.map(item => [item.id, item]));
              const merged = baseBuildings.map(b => customMap.has(b.id) ? { ...b, ...customMap.get(b.id) } : b);
              customBld.forEach(item => {
                if (!merged.some(m => m.id === item.id)) merged.push(item);
              });
              setKingdomBuildings(merged);
            } else {
              setKingdomBuildings(baseBuildings);
            }
          } else {
            setKingdomBuildings(baseBuildings);
          }
        } catch (bErr) {
          console.warn("Uso edifici base di mapBuildings:", bErr);
          setKingdomBuildings(baseBuildings);
        }

        // 2. Carica alleanze, strutture e castelli del regno
        const q = query(collection(db, 'alliances'), where('kingdom', '==', kingdomId));
        const snap = await getDocs(q);
        const alliancesList = snap.docs.map(d => ({ docId: d.id, ...d.data() }));

        const fullData = [];
        const allPoints = [];
        let colorIndex = 0;

        for (let ally of alliancesList) {
          const targetId = ally.id || ally.docId;

          const mapSnap = await getDoc(doc(db, 'allianceMapData', targetId));
          const mapData = mapSnap.exists() ? mapSnap.data() : {};
          const structures = mapData.allianceStructures || [];
          const overrides = mapData.playerOverrides || {};

          const rosterSnap = await getDoc(doc(db, 'rosters', targetId));
          const rosterData = rosterSnap.exists() ? rosterSnap.data() : {};
          const players = Array.isArray(rosterData) ? rosterData : (rosterData.players || []);

          const activeCastles = players.map(p => {
            const over = overrides[p.id];
            return over && over.x != null && over.y != null ? { ...p, x: over.x, y: over.y } : p;
          }).filter(p => p.x != null && p.y != null && !isNaN(Number(p.x)) && !isNaN(Number(p.y)));

          if (structures.length > 0 || activeCastles.length > 0) {
            fullData.push({
              ...ally,
              uniqueKey: targetId,
              structures,
              castles: activeCastles,
              color: ALLIANCE_COLORS[colorIndex % ALLIANCE_COLORS.length]
            });
            allPoints.push(...structures, ...activeCastles);
            colorIndex++;
          }
        }
        
        setKingdomData(fullData);

        if (allPoints.length > 0) {
          setTimeout(() => focusOnTargets(allPoints), 50);
        } else {
          setCamera({ scale: 0.8, x: (window.innerWidth - 1200 * 0.8) / 2, y: (window.innerHeight - 1200 * 0.8) / 2 });
        }

      } catch (err) {
        console.error(err);
      }
      setIsLoading(false);
    };
    
    loadKingdom();
  }, [kingdomId, isStaff, isSharedView, navigate, focusOnTargets]);

  const handleCopyShareLink = async () => {
    const shareUrl = `${window.location.origin}/kingdom-map/${encodeURIComponent(kingdomId)}?shared=1`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
    } catch (_) {
      window.prompt("Copia questo link condivisibile per i giocatori:", shareUrl);
    }
  };

  // --- GENERAZIONE PDF CON EDIFICI DEL REGNO E ALLEANZE ---
  const generatePdfFromBounds = useCallback((customBounds = null) => {
    if (kingdomData.length === 0 && kingdomBuildings.length === 0) {
      alert("⚠️ Nessun dato da esportare nel regno.");
      return;
    }

    let minSvgX = Infinity, maxSvgX = -Infinity, minSvgY = Infinity, maxSvgY = -Infinity;
    const allItems = [];

    kingdomData.forEach(ally => {
      ally.structures.forEach(s => {
        const nx = Number(s.x), ny = Number(s.y);
        if (!isNaN(nx) && !isNaN(ny)) {
          const sx = 600 + (nx - ny) * TILE_SF;
          const sy = 1150 - (nx + ny) * TILE_SF;
          minSvgX = Math.min(minSvgX, sx); maxSvgX = Math.max(maxSvgX, sx);
          minSvgY = Math.min(minSvgY, sy); maxSvgY = Math.max(maxSvgY, sy);
        }
      });
      ally.castles.forEach(c => {
        const nx = Number(c.x), ny = Number(c.y);
        if (!isNaN(nx) && !isNaN(ny)) {
          const sx = 600 + (nx - ny) * TILE_SF;
          const sy = 1150 - (nx + ny) * TILE_SF;
          if (!customBounds) {
            minSvgX = Math.min(minSvgX, sx); maxSvgX = Math.max(maxSvgX, sx);
            minSvgY = Math.min(minSvgY, sy); maxSvgY = Math.max(maxSvgY, sy);
          }
          allItems.push({ ...c, sx, sy, allyTag: ally.tag, allyColor: ally.color });
        }
      });
    });

    if (!customBounds && showKingdomBuildings) {
      kingdomBuildings.forEach(b => {
        const nx = Number(b.x), ny = Number(b.y);
        if (!isNaN(nx) && !isNaN(ny)) {
          const sx = 600 + (nx - ny) * TILE_SF;
          const sy = 1150 - (nx + ny) * TILE_SF;
          minSvgX = Math.min(minSvgX, sx); maxSvgX = Math.max(maxSvgX, sx);
          minSvgY = Math.min(minSvgY, sy); maxSvgY = Math.max(maxSvgY, sy);
        }
      });
    }

    let vbX, vbY, vbW, vbH;

    if (customBounds) {
      vbX = customBounds.minX;
      vbY = customBounds.minY;
      vbW = Math.max(4, customBounds.maxX - customBounds.minX);
      vbH = Math.max(4, customBounds.maxY - customBounds.minY);
    } else {
      if (minSvgX === Infinity) {
        minSvgX = 50; maxSvgX = 1150; minSvgY = 50; maxSvgY = 1150;
      }
      const rawW = Math.max(12, maxSvgX - minSvgX);
      const rawH = Math.max(12, maxSvgY - minSvgY);
      const padX = Math.max(4, rawW * 0.14);
      const padY = Math.max(4, rawH * 0.14);

      vbX = minSvgX - padX;
      vbY = minSvgY - padY;
      vbW = rawW + padX * 2;
      vbH = rawH + padY * 2;
    }

    const itemsForTable = customBounds
      ? allItems.filter(item =>
          item.sx >= vbX && item.sx <= vbX + vbW &&
          item.sy >= vbY && item.sy <= vbY + vbH
        )
      : allItems;

    const strokeUnit = Math.max(0.02, vbW / 650);
    const fontSizeCastle = Math.max(0.22, vbW / 145);
    const fontSizeStruct = Math.max(0.3, vbW / 110);

    let svgLayers = `
      <rect x="${vbX}" y="${vbY}" width="${vbW}" height="${vbH}" fill="#070c18" />
      <polygon points="600,50 1150,600 600,1150 50,600" fill="#0b1222" stroke="#1e293b" stroke-width="${strokeUnit * 2}" />
    `;

    // Edifici base del Regno (Castello, Torrette, Fortezze, Santuari, ecc.)
    if (showKingdomBuildings) {
      kingdomBuildings.forEach(b => {
        const nx = Number(b.x), ny = Number(b.y);
        if (isNaN(nx) || isNaN(ny)) return;
        const sx = 600 + (nx - ny) * TILE_SF;
        const sy = 1150 - (nx + ny) * TILE_SF;
        const style = getBuildingStyle(b.type, b.id);
        const bSize = style.size * TILE_SF;
        const safeLabel = String(b.name || b.type || '').replace(/[<>&"']/g, '');

        svgLayers += `
          <g transform="translate(${sx}, ${sy})">
            <polygon points="0,${-bSize} ${bSize},0 0,${bSize} ${-bSize},0" fill="${style.fill}" fill-opacity="0.82" stroke="${style.stroke}" stroke-width="${strokeUnit * 1.5}" />
            <text x="0" y="${-fontSizeStruct * 0.15}" fill="${style.text}" font-family="sans-serif" font-size="${fontSizeStruct * 0.85}" font-weight="800" text-anchor="middle" stroke="#020617" stroke-width="${fontSizeStruct * 0.28}" paint-order="stroke">${safeLabel}</text>
            <text x="0" y="${fontSizeStruct * 0.85}" fill="#cbd5e1" font-family="monospace" font-size="${fontSizeStruct * 0.65}" font-weight="700" text-anchor="middle" stroke="#020617" stroke-width="${fontSizeStruct * 0.22}" paint-order="stroke">(${nx}:${ny})</text>
          </g>
        `;
      });
    }

    kingdomData.forEach(ally => {
      const color = ally.color;

      if (showBannersHalo) {
        ally.structures
          .filter(s => String(s.type).toLowerCase() === 'banner' || s.code === 'BAN')
          .forEach(s => {
            const nx = Number(s.x), ny = Number(s.y);
            if (isNaN(nx) || isNaN(ny)) return;
            const sx = 600 + (nx - ny) * TILE_SF;
            const sy = 1150 - (nx + ny) * TILE_SF;
            const r = 7 * TILE_SF;
            svgLayers += `<polygon points="${sx},${sy - r} ${sx + r},${sy} ${sx},${sy + r} ${sx - r},${sy}" fill="${color}" fill-opacity="0.08" stroke="${color}" stroke-width="${strokeUnit * 0.6}" stroke-opacity="0.35" />`;
          });
      }

      ally.structures
        .filter(s => String(s.type).toLowerCase() === 'banner' || s.code === 'BAN')
        .forEach(s => {
          const nx = Number(s.x), ny = Number(s.y);
          if (isNaN(nx) || isNaN(ny)) return;
          const sx = 600 + (nx - ny) * TILE_SF;
          const sy = 1150 - (nx + ny) * TILE_SF;
          const bSize = 0.75 * TILE_SF;
          svgLayers += `<polygon points="${sx},${sy - bSize} ${sx + bSize},${sy} ${sx},${sy + bSize} ${sx - bSize},${sy}" fill="${color}" stroke="#ffffff" stroke-width="${strokeUnit * 0.7}" />`;
        });

      ally.castles.forEach(c => {
        const nx = Number(c.x), ny = Number(c.y);
        const sx = 600 + (nx - ny) * TILE_SF;
        const sy = 1150 - (nx + ny) * TILE_SF;
        const cSize = 1.85 * TILE_SF;
        const safeName = String(c.name || '').replace(/[<>&"']/g, '');
        svgLayers += `
          <g transform="translate(${sx}, ${sy})">
            <polygon points="0,${-cSize} ${cSize},0 0,${cSize} ${-cSize},0" fill="${color}" fill-opacity="0.35" stroke="${color}" stroke-width="${strokeUnit * 1.4}" />
            <text x="0" y="${-fontSizeCastle * 0.25}" fill="#ffffff" font-family="sans-serif" font-size="${fontSizeCastle}" font-weight="800" text-anchor="middle" stroke="#040812" stroke-width="${fontSizeCastle * 0.28}" paint-order="stroke">${safeName}</text>
            <text x="0" y="${fontSizeCastle * 0.9}" fill="#cbd5e1" font-family="monospace" font-size="${fontSizeCastle * 0.72}" font-weight="700" text-anchor="middle" stroke="#040812" stroke-width="${fontSizeCastle * 0.22}" paint-order="stroke">(${nx}:${ny})</text>
          </g>
        `;
      });

      ally.structures
        .filter(s => !(String(s.type).toLowerCase() === 'banner' || s.code === 'BAN'))
        .forEach(s => {
          const nx = Number(s.x), ny = Number(s.y);
          if (isNaN(nx) || isNaN(ny)) return;
          const sx = 600 + (nx - ny) * TILE_SF;
          const sy = 1150 - (nx + ny) * TILE_SF;
          const isHQ = String(s.type).toLowerCase() === 'headquarters' || s.code === 'HQ';
          const size = (isHQ ? 3.1 : 2.8) * TILE_SF;
          const label = `[${ally.tag}] ${isHQ ? 'QG' : (s.code || 'TRP')}`;
          svgLayers += `
            <g transform="translate(${sx}, ${sy})">
              <polygon points="0,${-size} ${size},0 0,${size} ${-size},0" fill="${isHQ ? '#1e3a8a' : '#881337'}" fill-opacity="0.9" stroke="${color}" stroke-width="${strokeUnit * 2}" />
              <text x="0" y="${-fontSizeStruct * 0.15}" fill="#ffffff" font-family="sans-serif" font-size="${fontSizeStruct}" font-weight="900" text-anchor="middle" stroke="#020617" stroke-width="${fontSizeStruct * 0.3}" paint-order="stroke">${label}</text>
              <text x="0" y="${fontSizeStruct * 0.9}" fill="#e2e8f0" font-family="monospace" font-size="${fontSizeStruct * 0.72}" font-weight="700" text-anchor="middle" stroke="#020617" stroke-width="${fontSizeStruct * 0.25}" paint-order="stroke">(${nx}:${ny})</text>
            </g>
          `;
        });
    });

    const vectorSvgHtml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vbX} ${vbY} ${vbW} ${vbH}" style="width:100%; height:100%; display:block; background:#070c18;">${svgLayers}</svg>`;

    const sortedItems = [...itemsForTable].sort((a, b) => (a.allyTag || '').localeCompare(b.allyTag || '') || ((Number(b.power) || 0) - (Number(a.power) || 0)));

    const nowFormatted = new Date().toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' });
    const totalCastles = sortedItems.length;

    const legendHtml = `
      <div class="legend-item">
        <span class="dot" style="background:#f59e0b;"></span>
        <strong>Edifici Regno (${kingdomBuildings.length})</strong>
      </div>
      ${kingdomData.map(a => `
        <div class="legend-item">
          <span class="dot" style="background:${a.color};"></span>
          <strong>[${a.tag}]</strong> ${a.name || ''} (${a.castles.length} 🏰)
        </div>
      `).join('')}
    `;

    const tableRowsHtml = sortedItems.map((p, idx) => `
      <tr>
        <td style="text-align:center; font-weight:700; color:#64748b;">${idx + 1}</td>
        <td>
          <span class="ally-badge" style="border-color:${p.allyColor}; color:#0f172a; background:${p.allyColor}22;">
            <span class="dot-sm" style="background:${p.allyColor};"></span>[${p.allyTag}]
          </span>
        </td>
        <td style="font-weight:800; color:#0f172a;">${p.tag ? `[${p.tag}] ` : ''}${p.name}</td>
        <td style="text-align:center; font-weight:700;">${p.role || 'R1'}</td>
        <td style="text-align:right; font-family:monospace; font-weight:700;">${p.power ? `${p.power} M` : '-'}</td>
        <td style="text-align:center; font-family:monospace; font-weight:800; background:#f8fafc;">
          X: <span style="color:#0284c7;">${p.x}</span> &nbsp;|&nbsp; Y: <span style="color:#d97706;">${p.y}</span>
        </td>
      </tr>
    `).join('');

    const printWin = window.open('', '_blank', 'width=1100,height=900');
    if (!printWin) {
      alert("⚠️ Il browser ha bloccato il popup di stampa. Consenti i popup per esportare il PDF.");
      return;
    }

    printWin.document.write(`
      <!DOCTYPE html>
      <html lang="it">
      <head>
        <meta charset="UTF-8" />
        <title>Mappa_Regno_${kingdomId}${customBounds ? '_Area' : ''}</title>
        <style>
          @page { size: A4 portrait; margin: 12mm; }
          * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 0; color: #0f172a; background: #ffffff; }
          .page-break { page-break-before: always; break-before: page; }
          .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px; }
          .header h1 { margin: 0; font-size: 20px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase; }
          .header .meta { font-size: 11px; color: #475569; font-weight: 600; text-align: right; }
          .legend { display: flex; flex-wrap: wrap; gap: 10px 18px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 12px; margin-bottom: 12px; font-size: 11px; }
          .legend-item { display: flex; align-items: center; gap: 6px; }
          .dot { width: 11px; height: 11px; border-radius: 3px; display: inline-block; }
          .dot-sm { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 4px; }
          .map-box { width: 100%; height: 222mm; border: 2px solid #0f172a; border-radius: 10px; overflow: hidden; background: #070c18; }
          table { width: 100%; border-collapse: collapse; font-size: 10.5px; margin-top: 8px; }
          th { background: #0f172a; color: #ffffff; text-transform: uppercase; font-size: 9.5px; letter-spacing: 0.5px; padding: 7px 8px; border: 1px solid #0f172a; }
          td { padding: 5px 8px; border: 1px solid #cbd5e1; }
          tr:nth-child(even) td { background: #f8fafc; }
          .ally-badge { display: inline-flex; align-items: center; padding: 2px 6px; border-radius: 4px; border: 1px solid; font-weight: 800; font-size: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>MAPPA UFFICIALE REGNO — [${kingdomId}]${customBounds ? ' • AREA SELEZIONATA' : ''}</h1>
            <div style="font-size:11px; color:#475569; margin-top:2px;">Generata il ${nowFormatted} • Castelli nell'area: <strong>${totalCastles}</strong></div>
          </div>
          <div class="meta">HUB KINGSHOT<br/>Vista Strategica Regno</div>
        </div>

        <div class="legend">${legendHtml}</div>

        <div class="map-box">
          ${vectorSvgHtml}
        </div>

        <div class="page-break"></div>

        <div class="header">
          <div>
            <h1>ELENCO ASSEGNAZIONE COORDINATE REGNO [${kingdomId}]</h1>
            <div style="font-size:11px; color:#475569; margin-top:2px;">Riepilogo completo delle coordinate (X, Y) nell'area esportata.</div>
          </div>
          <div class="meta">Data: ${nowFormatted}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width:32px;">#</th>
              <th style="width:90px;">Alleanza</th>
              <th>Giocatore</th>
              <th style="width:55px;">Ruolo</th>
              <th style="width:80px;">Potenza</th>
              <th style="width:135px;">Coordinate (X | Y)</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
        </table>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 250);
          };
        </script>
      </body>
      </html>
    `);
    printWin.document.close();
  }, [kingdomData, kingdomBuildings, showBannersHalo, showKingdomBuildings, TILE_SF, kingdomId]);

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;

    const onWheelNative = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const { scale: curScale, x: curX, y: curY } = cameraRef.current;

      const zoomFactor = e.deltaY < 0 ? 1.22 : 1 / 1.22;
      const newScale = Math.min(Math.max(0.4, curScale * zoomFactor), 250);

      const scaleRatio = newScale / curScale;
      const newX = mouseX - (mouseX - curX) * scaleRatio;
      const newY = mouseY - (mouseY - curY) * scaleRatio;

      setCamera({ scale: newScale, x: newX, y: newY });
    };

    el.addEventListener('wheel', onWheelNative, { passive: false });
    return () => el.removeEventListener('wheel', onWheelNative);
  }, [isLoading]);

  const handleStepZoom = (factor) => {
    const vW = window.innerWidth / 2;
    const vH = window.innerHeight / 2;
    const { scale: curScale, x: curX, y: curY } = camera;
    const newScale = Math.min(Math.max(0.4, curScale * factor), 250);
    const ratio = newScale / curScale;
    setCamera({
      scale: newScale,
      x: vW - (vW - curX) * ratio,
      y: vH - (vH - curY) * ratio
    });
  };

  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    if (!isReadOnlyShare && isSelectingPdfArea && mainRef.current) {
      const rect = mainRef.current.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      isDrawingSelection.current = true;
      setSelectionBox({ startX: sx, startY: sy, currentX: sx, currentY: sy });
      return;
    }
    setIsDragging(true);
    dragStart.current = { x: e.clientX - camera.x, y: e.clientY - camera.y };
  };

  const handleMouseMove = (e) => {
    if (!isReadOnlyShare && isSelectingPdfArea && isDrawingSelection.current && mainRef.current) {
      const rect = mainRef.current.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      setSelectionBox(prev => prev ? { ...prev, currentX: cx, currentY: cy } : null);
      return;
    }
    if (!isDragging) return;
    setCamera(prev => ({
      ...prev,
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    }));
  };

  const handleMouseUp = () => {
    if (!isReadOnlyShare && isSelectingPdfArea && isDrawingSelection.current) {
      isDrawingSelection.current = false;
      if (selectionBox) {
        const left = Math.min(selectionBox.startX, selectionBox.currentX);
        const right = Math.max(selectionBox.startX, selectionBox.currentX);
        const top = Math.min(selectionBox.startY, selectionBox.currentY);
        const bottom = Math.max(selectionBox.startY, selectionBox.currentY);

        if (right - left > 12 && bottom - top > 12) {
          const { scale: curScale, x: curX, y: curY } = cameraRef.current;
          const svgMinX = (left - curX) / curScale;
          const svgMaxX = (right - curX) / curScale;
          const svgMinY = (top - curY) / curScale;
          const svgMaxY = (bottom - curY) / curScale;

          setIsSelectingPdfArea(false);
          setSelectionBox(null);
          generatePdfFromBounds({
            minX: svgMinX,
            maxX: svgMaxX,
            minY: svgMinY,
            maxY: svgMaxY
          });
          return;
        }
      }
      setSelectionBox(null);
      return;
    }
    setIsDragging(false);
  };

  const { scale, x: posX, y: posY } = camera;
  const invScale = 1 / scale;

  const boxRect = selectionBox ? {
    left: Math.min(selectionBox.startX, selectionBox.currentX),
    top: Math.min(selectionBox.startY, selectionBox.currentY),
    width: Math.abs(selectionBox.currentX - selectionBox.startX),
    height: Math.abs(selectionBox.currentY - selectionBox.startY)
  } : null;

  return (
    <div className="h-screen w-screen bg-slate-950 flex flex-col text-slate-100 overflow-hidden select-none relative">
      
      <div className="absolute top-0 left-0 right-0 z-50 p-4 flex justify-between items-start pointer-events-none">
        
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700 p-4 rounded-2xl flex flex-col gap-1 pointer-events-auto shadow-xl">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-white">🌍 Regno <span className="text-cyan-400">{kingdomId}</span></h1>
            {isReadOnlyShare && (
              <span className="text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-500/40 px-2 py-0.5 rounded-full font-black uppercase">
                Visione Condivisa
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">
            Zoom: <span className="text-cyan-400">{scale.toFixed(1)}x</span> | {kingdomData.length} Alleanze • {kingdomBuildings.length} Edifici
          </p>
        </div>

        <div className="flex flex-wrap gap-2 pointer-events-auto mt-2">
          <button
            onClick={() => setShowKingdomBuildings(!showKingdomBuildings)}
            className={`px-4 py-2 border rounded-xl font-bold text-xs shadow-lg transition-colors cursor-pointer ${showKingdomBuildings ? 'bg-amber-600/30 border-amber-500 text-amber-300' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
          >
            {showKingdomBuildings ? '🏰 Nascondi Edifici Regno' : '🏰 Mostra Edifici Regno'}
          </button>
          <button 
            onClick={() => setShowBannersHalo(!showBannersHalo)} 
            className={`px-4 py-2 border rounded-xl font-bold text-xs shadow-lg transition-colors cursor-pointer ${showBannersHalo ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
          >
            {showBannersHalo ? '🛡️ Nascondi Aloni Stendardi' : '🛡️ Mostra Aloni Stendardi'}
          </button>
          <button 
            onClick={() => {
              const allPts = [
                ...kingdomData.flatMap(a => [...a.structures, ...a.castles]),
                ...(showKingdomBuildings ? kingdomBuildings : [])
              ];
              focusOnTargets(allPts);
            }} 
            className="px-4 py-2 bg-cyan-800 hover:bg-cyan-700 text-white border border-cyan-600 rounded-xl font-bold text-xs shadow-lg transition-colors cursor-pointer"
          >
            🎯 Inquadra Tutto
          </button>

          {!isReadOnlyShare && (
            <>
              <button
                onClick={handleCopyShareLink}
                className="px-4 py-2 bg-indigo-700 hover:bg-indigo-600 text-white border border-indigo-400/50 rounded-xl font-bold text-xs shadow-lg transition-colors cursor-pointer"
              >
                {linkCopied ? '✅ Link Copiato!' : '🔗 Link Giocatori'}
              </button>
              <button
                onClick={() => {
                  setSelectionBox(null);
                  setIsSelectingPdfArea(prev => !prev);
                }}
                disabled={isLoading || (kingdomData.length === 0 && kingdomBuildings.length === 0)}
                className={`px-4 py-2 border rounded-xl font-bold text-xs shadow-lg transition-colors cursor-pointer ${
                  isSelectingPdfArea
                    ? 'bg-amber-500 text-slate-950 border-amber-300 animate-pulse'
                    : 'bg-emerald-700 hover:bg-emerald-600 text-white border-emerald-500 disabled:opacity-50'
                }`}
              >
                {isSelectingPdfArea ? '❌ Annulla Selezione Area' : '✂️ Seleziona Area PDF'}
              </button>
              <button
                onClick={() => generatePdfFromBounds(null)}
                disabled={isLoading || (kingdomData.length === 0 && kingdomBuildings.length === 0)}
                className="px-4 py-2 bg-emerald-900/70 hover:bg-emerald-800 disabled:opacity-50 text-emerald-200 border border-emerald-600 rounded-xl font-bold text-xs shadow-lg transition-colors cursor-pointer"
              >
                📄 PDF Completo
              </button>
              <button onClick={() => navigate('/admin')} className="px-4 py-2 bg-rose-900/60 hover:bg-rose-800 text-rose-200 border border-rose-700 rounded-xl font-bold text-xs shadow-lg transition-colors cursor-pointer">
                Chiudi Mappa
              </button>
            </>
          )}
        </div>

        {!isLoading && kingdomData.length > 0 && (
          <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700 p-4 rounded-2xl pointer-events-auto shadow-xl max-h-[80vh] overflow-y-auto custom-scrollbar flex flex-col gap-2 min-w-[180px]">
            <h3 className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1 border-b border-slate-800 pb-2">
              Alleanze (Clicca per Zoom)
            </h3>
            {kingdomData.map(ally => (
              <button 
                key={ally.uniqueKey} 
                onClick={() => focusOnTargets([...ally.structures, ...ally.castles], 45)}
                className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-slate-800 transition-colors text-left group cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-3.5 h-3.5 rounded-full shrink-0 shadow" style={{ backgroundColor: ally.color }}></div>
                  <span className="text-sm font-black text-white group-hover:text-cyan-400">[{ally.tag}]</span>
                </div>
                <span className="text-[10px] bg-slate-950 px-2 py-0.5 rounded text-slate-400 font-bold">
                  {ally.castles.length} 🏰
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {isSelectingPdfArea && !isReadOnlyShare && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-slate-950 px-5 py-2.5 rounded-full font-black text-xs uppercase tracking-wider shadow-2xl pointer-events-none">
          ✂️ Trascina il mouse sulla mappa per selezionare l'area da esportare in PDF
        </div>
      )}

      <div className="absolute bottom-6 right-6 z-50 flex flex-col gap-2 bg-slate-900/90 p-2 rounded-xl border border-slate-800 shadow-2xl backdrop-blur-md">
        <button onClick={() => handleStepZoom(1.6)} className="w-10 h-10 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg flex items-center justify-center text-lg cursor-pointer">+</button>
        <button onClick={() => handleStepZoom(1 / 1.6)} className="w-10 h-10 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg flex items-center justify-center text-lg cursor-pointer">-</button>
        <button onClick={() => setCamera({ scale: 1, x: (window.innerWidth - 1200)/2, y: (window.innerHeight - 1200)/2 })} className="w-10 h-10 bg-slate-800 hover:bg-slate-700 text-cyan-400 font-bold rounded-lg flex items-center justify-center text-xs cursor-pointer">1:1</button>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin text-5xl text-cyan-500">🌍</div>
        </div>
      ) : (
        <main 
          ref={mainRef}
          className={`flex-1 bg-slate-950 relative overflow-hidden ${!isReadOnlyShare && isSelectingPdfArea ? 'cursor-crosshair' : (isDragging ? 'cursor-grabbing' : 'cursor-grab')}`}
          onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
        >
          {boxRect && (
            <div
              className="fixed z-40 border-2 border-amber-400 bg-amber-400/20 pointer-events-none"
              style={{
                left: `${boxRect.left}px`,
                top: `${boxRect.top}px`,
                width: `${boxRect.width}px`,
                height: `${boxRect.height}px`
              }}
            />
          )}

          <div 
            className="absolute top-0 left-0 w-[1200px] h-[1200px] origin-top-left"
            style={{ transform: `translate3d(${posX}px, ${posY}px, 0) scale(${scale})` }}
          >
            <svg id="kingdom-map-svg" viewBox="0 0 1200 1200" className="w-full h-full overflow-visible">
              <defs>
                <pattern id="mapGrid" width="100" height="100" patternUnits="userSpaceOnUse"><path d="M 100 0 L 0 0 0 100" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={invScale}/></pattern>
                <pattern id="subGrid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(34, 211, 238, 0.08)" strokeWidth={0.5 * invScale}/></pattern>
                <pattern id="iso-1x1-grid" width={2 * TILE_SF} height={2 * TILE_SF} patternUnits="userSpaceOnUse" patternTransform={`translate(${gridTranslateX}, ${gridTranslateY})`}>
                  <path d={`M ${TILE_SF} 0 L ${2 * TILE_SF} ${TILE_SF} L ${TILE_SF} ${2 * TILE_SF} L 0 ${TILE_SF} Z`} fill="none" stroke="rgba(255, 255, 255, 0.07)" strokeWidth={invScale} />
                </pattern>
              </defs>
              <rect width="1200" height="1200" fill="url(#subGrid)" />
              <rect width="1200" height="1200" fill="url(#mapGrid)" />
              <polygon points="600,50 1150,600 600,1150 50,600" fill="rgba(15, 23, 42, 0.7)" stroke="rgba(34, 211, 238, 0.3)" strokeWidth={2 * invScale} />
              
              {scale > 6 && <rect width="1200" height="1200" fill="url(#iso-1x1-grid)" pointerEvents="none" />}

              {/* TUTTI GLI EDIFICI DEL REGNO (CASTELLO, TORRETTE, FORTEZZE, SANTUARI, ETC.) */}
              {showKingdomBuildings && kingdomBuildings.map((b, idx) => {
                const nx = Number(b.x); const ny = Number(b.y);
                if (isNaN(nx) || isNaN(ny)) return null;
                const svgX = 600 + (nx - ny) * TILE_SF;
                const svgY = 1150 - (nx + ny) * TILE_SF;
                const style = getBuildingStyle(b.type, b.id);
                const bSize = style.size * TILE_SF;

                return (
                  <g key={b.id || `kb-${idx}`} transform={`translate(${svgX}, ${svgY})`}>
                    <polygon points={`0,${-bSize} ${bSize},0 0,${bSize} ${-bSize},0`} fill={style.fill} fillOpacity="0.8" stroke={style.stroke} strokeWidth={1.6 * invScale} />
                    {scale >= 1.2 && (
                      <g transform={`scale(${invScale})`}>
                        <rect x="-48" y="-22" width="96" height="15" rx="4" fill="#0f172a" fillOpacity="0.9" stroke={style.stroke} strokeWidth="1.2" />
                        <text x="0" y="-11.5" fill={style.text} fontSize="8.5" fontWeight="800" textAnchor="middle">
                          {style.icon} {b.name}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}

              {kingdomData.map(ally => {
                const color = ally.color;
                
                return (
                  <g key={`ally-${ally.uniqueKey}`}>
                    
                    {showBannersHalo && ally.structures.filter(s => String(s.type).toLowerCase() === 'banner' || s.code === 'BAN').map((s, idx) => {
                      const nx = Number(s.x); const ny = Number(s.y);
                      if(isNaN(nx) || isNaN(ny)) return null;
                      const svgX = 600 + (nx - ny) * TILE_SF;
                      const svgY = 1150 - (nx + ny) * TILE_SF;
                      const r = 7 * TILE_SF;
                      return (
                        <polygon 
                          key={`halo-${idx}`} 
                          points={`${svgX},${svgY - r} ${svgX + r},${svgY} ${svgX},${svgY + r} ${svgX - r},${svgY}`} 
                          fill={color} fillOpacity="0.06" stroke={color} strokeWidth={0.8 * invScale} strokeOpacity="0.3" 
                        />
                      );
                    })}

                    {ally.structures.filter(s => String(s.type).toLowerCase() === 'banner' || s.code === 'BAN').map((s, idx) => {
                      const nx = Number(s.x); const ny = Number(s.y);
                      if(isNaN(nx) || isNaN(ny)) return null;
                      const svgX = 600 + (nx - ny) * TILE_SF;
                      const svgY = 1150 - (nx + ny) * TILE_SF;
                      const bSize = 0.6 * TILE_SF;
                      return (
                        <polygon 
                          key={`ban-${idx}`} 
                          points={`${svgX},${svgY - bSize} ${svgX + bSize},${svgY} ${svgX},${svgY + bSize} ${svgX - bSize},${svgY}`} 
                          fill={color} stroke="#ffffff" strokeWidth={0.5 * invScale} 
                        />
                      );
                    })}

                    {ally.castles.map((c, idx) => {
                      const nx = Number(c.x); const ny = Number(c.y);
                      const svgX = 600 + (nx - ny) * TILE_SF;
                      const svgY = 1150 - (nx + ny) * TILE_SF;
                      const cSize = 1.8 * TILE_SF;
                      return (
                        <g key={`c-${idx}`} transform={`translate(${svgX}, ${svgY})`}>
                          <polygon points={`0,${-cSize} ${cSize},0 0,${cSize} ${-cSize},0`} fill={color} fillOpacity="0.85" stroke="#0f172a" strokeWidth={1.2 * invScale} />
                          
                          {scale > 12 && (
                            <g transform={`scale(${invScale})`}>
                              <text x="0" y="-4" fill="#ffffff" fontSize="10" fontWeight="bold" textAnchor="middle" stroke="#050b14" strokeWidth="2.5" paintOrder="stroke">
                                {c.name}
                              </text>
                            </g>
                          )}
                        </g>
                      );
                    })}

                    {ally.structures.filter(s => !(String(s.type).toLowerCase() === 'banner' || s.code === 'BAN')).map((s, idx) => {
                      const nx = Number(s.x); const ny = Number(s.y);
                      if(isNaN(nx) || isNaN(ny)) return null;
                      const svgX = 600 + (nx - ny) * TILE_SF;
                      const svgY = 1150 - (nx + ny) * TILE_SF;
                      const isHQ = String(s.type).toLowerCase() === 'headquarters' || s.code === 'HQ';
                      const size = (isHQ ? 3.2 : 2.5) * TILE_SF;
                      
                      return (
                        <g key={`hq-${idx}`} transform={`translate(${svgX}, ${svgY})`}>
                          <polygon points={`0,${-size} ${size},0 0,${size} ${-size},0`} fill="#0f172a" stroke={color} strokeWidth={2.5 * invScale} />
                          
                          <g transform={`scale(${invScale})`}>
                            <rect x="-32" y="-22" width="64" height="16" rx="4" fill="#0f172a" stroke={color} strokeWidth="1.5" />
                            <text x="0" y="-11" fill="#ffffff" fontSize="9" fontWeight="900" textAnchor="middle">
                              [{ally.tag}] {isHQ ? 'QG' : (s.code || 'TRP')}
                            </text>
                          </g>
                        </g>
                      );
                    })}

                  </g>
                );
              })}
            </svg>
          </div>
        </main>
      )}
    </div>
  );
}