import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { db } from '../../firebase'; 
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { exportHiveToPdf } from '../../utils/hivePdfExport';

const BACKUP_STORAGE_KEY = 'kingshot-hive-coords-backup';

export const HiveLayoutTab = ({ 
  hq, trap1, trap2, validPlayers, roster, setRoster, setPathfindingData, 
  userRole, allianceCode 
}) => {
  const { t } = useTranslation();
  const [layoutResults, setLayoutResults] = useState(null);
  const [showShareUI, setShowShareUI] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [showBannersInShare, setShowBannersInShare] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPlacements, setCurrentPlacements] = useState(null);
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const [hasBackup, setHasBackup] = useState(false);

  // Controlla se esiste un backup salvato nel browser o nei metadati del roster
  useEffect(() => {
    const savedBackup = localStorage.getItem(BACKUP_STORAGE_KEY);
    const rosterHasBackup = (roster || []).some(p => p.backupX !== undefined || p.backupY !== undefined);
    setHasBackup(Boolean(savedBackup) || rosterHasBackup);
  }, [roster]);

  const getBearScore = (player) => {
    const power = Number(player.power) || 0;
    const participation = Number(player.participation) || 2; 
    return power * participation;
  };

 const handleGenerateLayout = () => {
    const allPlayers = roster && roster.length > 0 ? roster : (validPlayers || []);
    
    const sortByRingPriority = (a, b) => {
      const scoreDiff = getBearScore(b) - getBearScore(a);
      if (scoreDiff !== 0) return scoreDiff;
      return (Number(b.power) || 0) - (Number(a.power) || 0);
    };

    const team1 = allPlayers.filter(p => Number(p.assignedTrap) === 1).sort(sortByRingPriority);
    const team2 = allPlayers.filter(p => Number(p.assignedTrap) === 2).sort(sortByRingPriority);
    const unassignedPlayers = allPlayers
      .filter(p => Number(p.assignedTrap) !== 1 && Number(p.assignedTrap) !== 2)
      .sort(sortByRingPriority);

    const generatedPlacements = [];
    const obstacles = [];

    const canPlace = (x, y, w, h) => {
      for (let obs of obstacles) {
        if (x < obs.x + obs.w && x + w > obs.x && y < obs.y + obs.h && y + h > obs.y) return false;
      }
      return true;
    };

    // 1. COORDINATE ESISTENTI DI TRAPPOLA 1 E TRAPPOLA 2
    const t1X = Math.round(Number(trap1?.x || 490));
    const t1Y = Math.round(Number(trap1?.y || 500));
    generatedPlacements.push({ ...trap1, isPlayer: false, type: 'beartrap', newX: t1X, newY: t1Y, size: 3 });
    obstacles.push({ x: t1X, y: t1Y, w: 3, h: 3 });

    const hasValidTrap2 = trap2 && trap2.x != null && trap2.y != null && !(Number(trap2.x) === 0 && Number(trap2.y) === 0);
    // Usiamo distanza pari (+20) come fallback così le due trappole condividono la stessa griglia 2x2
    const t2X = hasValidTrap2 ? Math.round(Number(trap2.x)) : t1X + 20;
    const t2Y = hasValidTrap2 ? Math.round(Number(trap2.y)) : t1Y;
    generatedPlacements.push({ ...trap2, isPlayer: false, type: 'beartrap', newX: t2X, newY: t2Y, size: 3 });
    obstacles.push({ x: t2X, y: t2Y, w: 3, h: 3 });

    // 2. QG ESISTENTE
    const hasValidHq = hq && hq.x != null && hq.y != null && !(Number(hq.x) === 0 && Number(hq.y) === 0);
    let finalHqX = hasValidHq ? Math.round(Number(hq.x)) : Math.round((t1X + t2X) / 2) - 1;
    let finalHqY = hasValidHq ? Math.round(Number(hq.y)) : Math.round((t1Y + t2Y) / 2) + 10;

    if (!canPlace(finalHqX, finalHqY, 3, 3)) {
      let hqPlaced = false; let hqRadius = 1;
      while (!hqPlaced && hqRadius < 100) {
        for (let x = finalHqX - hqRadius; x <= finalHqX + hqRadius; x++) {
          for (let y = finalHqY - hqRadius; y <= finalHqY + hqRadius; y++) {
            if (canPlace(x, y, 3, 3)) { finalHqX = x; finalHqY = y; hqPlaced = true; break; }
          }
          if (hqPlaced) break;
        }
        hqRadius++;
      }
    }
    generatedPlacements.push({ ...hq, isPlayer: false, type: 'headquarters', newX: finalHqX, newY: finalHqY, size: 3 });
    obstacles.push({ x: finalHqX, y: finalHqY, w: 3, h: 3 });

    // 3. STENDARDI (Coord. intere allineate alla griglia per evitare collisioni frazionarie .5 che bucano 4 caselle!)
    const bStartX = t1X - 3;
    const bStartY = t1Y - 3;
    const bannerCandidates = [];

    for (let i = -15; i <= 15; i++) {
      for (let j = -15; j <= 15; j++) {
        const bx = bStartX + i * 7;
        const by = bStartY + j * 7;
        if (canPlace(bx, by, 1, 1)) {
          bannerCandidates.push({ x: bx, y: by, w: 1, h: 1 });
          obstacles.push({ x: bx, y: by, w: 1, h: 1 });
        }
      }
    }

    // 4. GRIGLIA UNIFICATA A MATTONI 2x2 (Elimina i buchi da 1 casella)
    const minX = Math.min(t1X, t2X) - 44;
    const maxX = Math.max(t1X, t2X) + 44;
    const minY = Math.min(t1Y, t2Y) - 44;
    const maxY = Math.max(t1Y, t2Y) + 44;

    const t1CenterX = t1X + 1.5, t1CenterY = t1Y + 1.5;
    const t2CenterX = t2X + 1.5, t2CenterY = t2Y + 1.5;
    const parityX = ((t1X % 2) + 2) % 2;
    const parityY = ((t1Y % 2) + 2) % 2;

    const candidatePool = [];
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        const isGridAligned = (((x % 2) + 2) % 2 === parityX) && (((y % 2) + 2) % 2 === parityY);
        const d1 = Math.hypot((x + 1) - t1CenterX, (y + 1) - t1CenterY);
        const d2 = Math.hypot((x + 1) - t2CenterX, (y + 1) - t2CenterY);
        const gridPenalty = isGridAligned ? 0 : 0.35;

        candidatePool.push({
          x, y,
          d1: d1 + gridPenalty,
          d2: d2 + gridPenalty,
          dUnified: Math.min(d1, d2) + gridPenalty,
          rawD1: d1,
          rawD2: d2
        });
      }
    }

    const pickBestSlot = (sortKey) => {
      let best = null;
      let bestVal = Infinity;
      for (let i = 0; i < candidatePool.length; i++) {
        const c = candidatePool[i];
        if (c[sortKey] < bestVal && canPlace(c.x, c.y, 2, 2)) {
          best = c;
          bestVal = c[sortKey];
        }
      }
      return best;
    };

    // FASE A: Piazzamento simultaneo alternato T1 e T2
    const maxTeamLen = Math.max(team1.length, team2.length);
    for (let i = 0; i < maxTeamLen; i++) {
      if (i < team1.length) {
        const p1 = team1[i];
        const s1 = pickBestSlot('d1');
        if (s1) {
          const ring = s1.rawD1 <= 3.8 ? 1 : (s1.rawD1 <= 6.2 ? 2 : 3);
          generatedPlacements.push({ ...p1, assignedTrap: 1, isPlayer: true, newX: s1.x, newY: s1.y, size: 2, ring, bearScore: getBearScore(p1) });
          obstacles.push({ x: s1.x, y: s1.y, w: 2, h: 2 });
        }
      }
      if (i < team2.length) {
        const p2 = team2[i];
        const s2 = pickBestSlot('d2');
        if (s2) {
          const ring = s2.rawD2 <= 3.8 ? 1 : (s2.rawD2 <= 6.2 ? 2 : 3);
          generatedPlacements.push({ ...p2, assignedTrap: 2, isPlayer: true, newX: s2.x, newY: s2.y, size: 2, ring, bearScore: getBearScore(p2) });
          obstacles.push({ x: s2.x, y: s2.y, w: 2, h: 2 });
        }
      }
    }

    // FASE B: Piazzamento Unificato dei non assegnati nella fascia esterna
    unassignedPlayers.forEach(p => {
      const s = pickBestSlot('dUnified');
      if (s) {
        const closerTrap = s.rawD1 <= s.rawD2 ? 1 : 2;
        generatedPlacements.push({ ...p, assignedTrap: closerTrap, isPlayer: true, newX: s.x, newY: s.y, size: 2, ring: 3, bearScore: getBearScore(p) });
        obstacles.push({ x: s.x, y: s.y, w: 2, h: 2 });
      }
    });

    // 5. FILTRO STENDARDI NECESSARI
    let finalBannersCount = 0;
    bannerCandidates.forEach(banner => {
      const areaX = banner.x - 3; const areaY = banner.y - 3;
      let isNeeded = false;
      for (let struct of generatedPlacements) {
        if (struct.newX < areaX + 7 && struct.newX + struct.size > areaX && struct.newY < areaY + 7 && struct.newY + struct.size > areaY) {
          isNeeded = true; break;
        }
      }
      if (isNeeded) {
        finalBannersCount++;
        generatedPlacements.push({ id: `auto-banner-${finalBannersCount}`, type: 'banner', code: 'BAN', name: t('suite.banner_name', 'Stendardo {{count}}', { count: finalBannersCount }), isPlayer: false, newX: banner.x, newY: banner.y, size: 1 });
      }
    });

    setLayoutResults({ players: allPlayers.length, banners: finalBannersCount });
    setCurrentPlacements(generatedPlacements); 
    setShowShareUI(true); 
    setConfirmOverwrite(false);
    
    setPathfindingData({ mode: 'layout', placements: generatedPlacements, splitScreen: true, visualOffsets: { structX: -1, structY: -1, bannerX: -0.5, bannerY: -0.5 } });
  };

  // SALVA IL BACKUP E APPLICA LE NUOVE COORDINATE AL ROSTER
  const handleOverwriteRoster = () => {
    if (!confirmOverwrite) {
      setConfirmOverwrite(true);
      setTimeout(() => setConfirmOverwrite(false), 4000);
      return;
    }
    if (setRoster && currentPlacements) {
      // 1. Crea snapshot di backup delle coordinate attuali
      const backupSnapshot = {};
      (roster || []).forEach(p => {
        backupSnapshot[p.id] = { x: p.x ?? '', y: p.y ?? '', assignedTrap: p.assignedTrap || 1 };
      });
      localStorage.setItem(BACKUP_STORAGE_KEY, JSON.stringify({
        timestamp: new Date().toLocaleString('it-IT'),
        coords: backupSnapshot
      }));

      // 2. Applica le nuove coordinate salvando anche backupX/backupY sul singolo player
      const playerUpdates = currentPlacements.filter(p => p.isPlayer);
      setRoster(prevRoster => prevRoster.map(player => {
        const update = playerUpdates.find(up => up.id === player.id);
        if (update) {
          return { 
            ...player, 
            backupX: player.x ?? '',
            backupY: player.y ?? '',
            backupAssignedTrap: player.assignedTrap || 1,
            x: update.newX, 
            y: update.newY, 
            assignedTrap: update.assignedTrap || player.assignedTrap 
          };
        }
        return player;
      }));

      setHasBackup(true);
      alert(t('suite.roster_updated', '✅ Coordinate applicate al Roster! Il posizionamento precedente è stato salvato nel Backup.'));
      setConfirmOverwrite(false);
    }
  };

  // RIPRISTINA IL BACKUP DELLE COORDINATE PRECEDENTI
  const handleRestoreBackup = () => {
    if (!window.confirm("Vuoi ripristinare le coordinate precedenti dei giocatori salvate nel backup?")) return;

    const rawBackup = localStorage.getItem(BACKUP_STORAGE_KEY);
    let parsedCoords = {};
    if (rawBackup) {
      try { parsedCoords = JSON.parse(rawBackup).coords || {}; } catch (e) {}
    }

    setRoster(prevRoster => prevRoster.map(player => {
      const saved = parsedCoords[player.id];
      const restoredX = saved !== undefined ? saved.x : (player.backupX !== undefined ? player.backupX : player.x);
      const restoredY = saved !== undefined ? saved.y : (player.backupY !== undefined ? player.backupY : player.y);
      const restoredTrap = saved !== undefined ? saved.assignedTrap : (player.backupAssignedTrap || player.assignedTrap);

      return {
        ...player,
        x: restoredX,
        y: restoredY,
        assignedTrap: restoredTrap
      };
    }));

    alert("⏪ Posizionamento precedente ripristinato con successo!");
  };

  const handleSaveLayoutToCloud = async () => {
    if (userRole !== 'admin' && userRole !== 'alliance') return;
    if (!allianceCode) return alert(t('suite.missing_alliance_code', 'Codice alleanza mancante!'));
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'allianceMapData', allianceCode), { savedHiveLayout: { stats: layoutResults, placements: currentPlacements } }, { merge: true });
    } catch (error) { console.error(error); alert(t('suite.error_saving_layout', 'Errore durante il salvataggio del layout.')); }
    setIsSaving(false);
  };

  const handleLoadLayoutFromCloud = async () => {
    if (userRole !== 'admin' && userRole !== 'alliance') return;
    if (!allianceCode) return;
    setIsLoading(true);
    try {
      const snap = await getDoc(doc(db, 'allianceMapData', allianceCode));
      if (snap.exists() && snap.data().savedHiveLayout) {
        const { stats, placements } = snap.data().savedHiveLayout;
        setLayoutResults(stats || null); setCurrentPlacements(placements || []);
        setPathfindingData({ mode: 'layout', placements: placements || [], splitScreen: true, visualOffsets: { structX: -1, structY: -1, bannerX: -0.5, bannerY: -0.5 } });
        setShowShareUI(true);
      } else { alert(t('suite.no_saved_layout', 'Nessun layout salvato trovato per questa alleanza.')); }
    } catch(e) { console.error(e); alert(t('suite.error_loading', 'Errore durante il caricamento.')); }
    setIsLoading(false);
  };

  const handleCopyMessage = (text, id) => {
    navigator.clipboard.writeText(text).then(() => { setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); });
  };

  const handleDownloadPdf = () => {
    // Se è stato appena generato un layout ottimizzato esporta quello, altrimenti esporta le posizioni attuali del Roster
    if (currentPlacements && currentPlacements.length > 0) {
      const placedPlayers = currentPlacements.filter(p => p.isPlayer);
      const placedStructs = currentPlacements.filter(p => !p.isPlayer);
      exportHiveToPdf({
        players: placedPlayers,
        structures: placedStructs,
        allianceCode: allianceCode || 'HIVE'
      });
    } else {
      const allPlayers = roster && roster.length > 0 ? roster : (validPlayers || []);
      exportHiveToPdf({
        players: allPlayers,
        structures: [hq, trap1, trap2].filter(Boolean),
        allianceCode: allianceCode || 'HIVE'
      });
    }
  };

  const getRenderMessages = () => {
    let placements = currentPlacements || [];
    if (placements.length === 0) return [];

    const chunkArray = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));
    const msgs = [];

    chunkArray(placements.filter(p => !p.isPlayer && p.type !== 'banner'), 10).forEach((chunk, i) => {
        let text = `${t('suite.alliance_structures', '🏗️ STRUTTURE ALLEANZA')}\n`; 
        chunk.forEach(p => text += `▪ ${p.name}: X:${p.newX} Y:${p.newY}\n`);
        msgs.push({ id: `struct-${i}`, title: t('suite.structures_num', 'Strutture {{num}}', { num: i+1 }), text, category: 'strutture' });
    });
    chunkArray(placements.filter(p => p.isPlayer), 10).forEach((chunk, i) => {
        let text = `${t('suite.hive_castles', '🏰 CASTELLI HIVE ({{num}})', { num: i+1 })}\n`; 
        chunk.forEach(p => text += `▪ [Anello ${p.ring || '?'}] ${p.name} (${p.power || 0}M • Cost.${p.participation || 2}x): X:${p.newX} Y:${p.newY}\n`);
        msgs.push({ id: `player-${i}`, title: t('suite.castles_num', 'Castelli {{num}}', { num: i+1 }), text, category: 'castelli' });
    });
    chunkArray(placements.filter(p => p.type === 'banner'), 10).forEach((chunk, i) => {
        let text = `${t('suite.hive_banners_title', '🚩 STENDARDI HIVE ({{num}})', { num: i+1 })}\n`; 
        chunk.forEach(p => text += `▪ ${p.name}: X:${p.newX} Y:${p.newY}\n`);
        msgs.push({ id: `banner-${i}`, title: t('suite.banners_num', 'Stendardi {{num}}', { num: i+1 }), text, category: 'stendardi' });
    });
    return msgs;
  };

  const finalMessages = layoutResults ? getRenderMessages() : [];

  return (
    <div className="flex flex-col gap-4 animate-fade-in h-full">
      {(!userRole || userRole === 'admin' || userRole === 'alliance') && (
        <div className="flex gap-2 bg-indigo-950/20 p-2 rounded-xl border border-indigo-900/50 shrink-0">
          <button onClick={handleLoadLayoutFromCloud} disabled={isLoading} className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 disabled:text-slate-600 text-indigo-300 text-[9px] font-black uppercase tracking-widest rounded-lg border border-slate-700 transition-all flex items-center justify-center gap-1">{isLoading ? t('suite.loading', '⏳...') : t('suite.load_cloud', '📂 Carica Cloud')}</button>
          <button onClick={handleSaveLayoutToCloud} disabled={isSaving || !currentPlacements} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:border-slate-700 text-white text-[9px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-1 border border-indigo-500">{isSaving ? t('suite.loading', '⏳...') : t('suite.save_cloud', '💾 Salva Cloud')}</button>
        </div>
      )}

      <div className="bg-amber-950/20 border border-amber-900/50 p-4 rounded-xl text-left">
        <h3 className="text-sm font-black text-amber-400 uppercase tracking-widest mb-2 flex items-center gap-2"><span className="text-xl">🧬</span> {t('suite.hive_generator', 'Generatore Alveare')}</h3>
        <div className="text-[10px] text-slate-300 space-y-1">
          <p>📍 <b>Trappola 1 Esistente:</b> X:{trap1?.x ?? '?'} Y:{trap1?.y ?? '?'}</p>
          <p>📍 <b>Trappola 2 Esistente:</b> X:{trap2?.x ?? '?'} Y:{trap2?.y ?? '?'}</p>
          <p className="text-amber-300/90 pt-1">I giocatori vengono disposti ad anelli attorno alle coordinate esistenti delle due trappole.</p>
        </div>
      </div>
      
      <button onClick={handleGenerateLayout} className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-[0_0_15px_rgba(245,158,11,0.4)]">{t('suite.gen_final_hive', '▶ Calcola Anelli Ottimali')}</button>
<button onClick={handleGenerateLayout} className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-[0_0_15px_rgba(245,158,11,0.4)]">
        {t('suite.gen_final_hive', '▶ Calcola Anelli Ottimali')}
      </button>

      {/* PULSANTE ESPORTAZIONE PDF (Mappa con Nomi + Foglio 2 Coordinate) */}
      <button 
        onClick={handleDownloadPdf} 
        className="w-full py-2.5 bg-cyan-700 hover:bg-cyan-600 text-white border border-cyan-400/40 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
      >
        📄 Salva PDF (Mappa con Nomi + Elenco Coordinate)
      </button>
      {/* PULSANTE DI RIPRISTINO BACKUP SEMPRE ACCESSIBILE SE ESISTE UN BACKUP */}
      {hasBackup && (!userRole || userRole === 'admin' || userRole === 'alliance') && (
        <button 
          onClick={handleRestoreBackup} 
          className="w-full py-2.5 bg-slate-800 hover:bg-amber-900/50 text-amber-300 border border-amber-500/40 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 shadow"
        >
          ⏪ Ripristina Backup Posizionamento
        </button>
      )}

      {layoutResults && (
        <div className="mt-2 flex flex-col gap-4 animate-fade-in border-t border-slate-800/80 pt-3">
          <div className="flex gap-2">
            <div className="flex-1 bg-slate-950 border border-slate-800 p-2 rounded-lg text-center"><span className="block text-[8px] text-slate-500 uppercase font-bold">{t('suite.stuck_castles', 'Castelli Piazzati')}</span><span className="block text-base font-mono font-black text-blue-400">{layoutResults.players}</span></div>
            <div className="flex-1 bg-slate-950 border border-slate-800 p-2 rounded-lg text-center"><span className="block text-[8px] text-slate-500 uppercase font-bold">{t('suite.final_banners', 'Stendardi Finali')}</span><span className="block text-base font-mono font-black text-purple-400">{layoutResults.banners}</span></div>
          </div>
          
          {(!userRole || userRole === 'admin' || userRole === 'alliance') && currentPlacements && (
            <div className="bg-emerald-950/20 border border-emerald-700/50 p-3 rounded-xl flex flex-col gap-2 shadow-inner">
                <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-widest text-center block">Salva Posizioni nel Roster (Con Backup Automatico)</span>
                <button onClick={handleOverwriteRoster} className={`w-full py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${confirmOverwrite ? 'bg-emerald-500 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.5)] scale-[0.98]' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}>
                  {confirmOverwrite ? '⚠️ CLICCA DI NUOVO PER CONFERMARE' : '📌 Applica Coordinate Ottimali ai Giocatori'}
                </button>
            </div>
          )}

          <button onClick={() => setShowShareUI(!showShareUI)} className={`w-full py-2.5 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all border ${showShareUI ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'}`}>{showShareUI ? t('suite.hide_share', 'Nascondi Condivisione') : t('suite.share_layout', '📤 Condividi Layout')}</button>

          {showShareUI && (
            <div className="flex flex-col gap-3 animate-fade-in mt-1">
              <div className="bg-indigo-950/30 border border-indigo-900/50 p-3 rounded-xl text-left flex justify-between items-center">
                  <span className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">{t('suite.show_banner_coords', 'Mostra coordinate stendardi')}</span>
                  <button onClick={() => setShowBannersInShare(!showBannersInShare)} className={`w-10 h-5 rounded-full relative transition-colors ${showBannersInShare ? 'bg-indigo-600' : 'bg-slate-700'}`}><span className={`absolute top-1 left-1 w-3 h-3 rounded-full bg-white transition-transform ${showBannersInShare ? 'translate-x-5' : ''}`}></span></button>
              </div>
              <div className="space-y-3">
                  {finalMessages.filter(msg => msg.category !== 'stendardi' || showBannersInShare).map((msg) => (
                      <div key={msg.id} className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
                          <div className="bg-slate-900/50 p-2 px-3 flex justify-between items-center border-b border-slate-800">
                              <span className="text-[10px] font-black uppercase tracking-wider text-slate-300">{msg.title}</span>
                              <button onClick={() => handleCopyMessage(msg.text, msg.id)} className={`px-3 py-1 rounded text-[9px] font-black uppercase tracking-widest transition-colors ${copiedId === msg.id ? 'bg-emerald-600 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}>{copiedId === msg.id ? t('suite.copied', '✓ COPIATO') : t('suite.copy_chat', 'COPIA CHAT')}</button>
                          </div>
                          <div className="p-3"><pre className="text-[10px] font-mono text-slate-400 whitespace-pre-wrap leading-relaxed m-0">{msg.text}</pre></div>
                      </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};