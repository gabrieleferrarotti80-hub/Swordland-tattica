import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { db } from '../../firebase'; 
import { doc, setDoc, getDoc } from 'firebase/firestore';

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

  const handleGenerateLayout = () => {
    const allPlayers = roster && roster.length > 0 ? roster : (validPlayers || []);
    const explicitTeam1 = allPlayers.filter(p => Number(p.assignedTrap) === 1);
    const explicitTeam2 = allPlayers.filter(p => Number(p.assignedTrap) === 2);
    const unassignedPlayers = allPlayers.filter(p => Number(p.assignedTrap) !== 1 && Number(p.assignedTrap) !== 2);

    const team1 = [...explicitTeam1];
    const team2 = [...explicitTeam2];

    unassignedPlayers.forEach(p => { 
        if (team1.length <= team2.length) team1.push(p); 
        else team2.push(p); 
    });

    const generatedPlacements = [];
    const obstacles = [];

    const canPlace = (x, y, w, h) => {
        for (let obs of obstacles) {
            if (x < obs.x + obs.w && x + w > obs.x && y < obs.y + obs.h && y + h > obs.y) return false;
        }
        return true;
    };

    const tX = Math.round(Number(trap1.x));
    const tY = Math.round(Number(trap1.y));
    generatedPlacements.push({ ...trap1, isPlayer: false, type: 'beartrap', newX: tX, newY: tY, size: 3 });
    obstacles.push({ x: tX, y: tY, w: 3, h: 3 });

    const bStartX = tX - 2.5;
    const bStartY = tY - 2.5;
    const bannerCandidates = [];

    for(let i = -15; i <= 15; i++) {
        for(let j = -15; j <= 15; j++) {
            const bx = bStartX + i * 7;
            const by = bStartY + j * 7;
            bannerCandidates.push({ x: bx, y: by, w: 1, h: 1 });
            obstacles.push({ x: bx, y: by, w: 1, h: 1 }); 
        }
    }

    const t2X = tX + 21; 
    const t2Y = tY;
    generatedPlacements.push({ ...trap2, isPlayer: false, type: 'beartrap', newX: t2X, newY: t2Y, size: 3 });
    obstacles.push({ x: t2X, y: t2Y, w: 3, h: 3 });

    let hqPlaced = false; let hqRadius = 0; let finalHqX = tX; let finalHqY = tY;
    const hqTargetX = Math.round((tX + t2X) / 2) - 1; const hqTargetY = tY + 10; 

    while(!hqPlaced && hqRadius < 100) {
        let candidates = [];
        for(let x = hqTargetX - hqRadius; x <= hqTargetX + hqRadius; x++) {
            for(let y = hqTargetY - hqRadius; y <= hqTargetY + hqRadius; y++) {
                if(canPlace(x, y, 3, 3)) candidates.push({ x, y, d: Math.hypot((x + 1.5) - (hqTargetX + 1.5), (y + 1.5) - (hqTargetY + 1.5)) });
            }
        }
        candidates.sort((a,b) => a.d - b.d);
        if(candidates.length > 0) { finalHqX = candidates[0].x; finalHqY = candidates[0].y; hqPlaced = true; }
        hqRadius++;
    }
    generatedPlacements.push({ ...hq, isPlayer: false, type: 'headquarters', newX: finalHqX, newY: finalHqY, size: 3 });
    obstacles.push({ x: finalHqX, y: finalHqY, w: 3, h: 3 });

    const placeTeam = (targetX, targetY, team) => {
        let placedCount = 0; let radius = 0;
        const cX = Math.round(targetX); const cY = Math.round(targetY);
        while(placedCount < team.length && radius < 60) {
            let candidates = [];
            for(let x = cX - radius; x <= cX + radius; x++) {
                for(let y = cY - radius; y <= cY + radius; y++) {
                    if(canPlace(x, y, 2, 2)) candidates.push({ x, y, d: Math.hypot((x + 1) - (targetX + 1.5), (y + 1) - (targetY + 1.5)) });
                }
            }
            candidates.sort((a,b) => a.d - b.d);
            for(let c of candidates) {
                if(placedCount >= team.length) break;
                if(canPlace(c.x, c.y, 2, 2)) {
                    generatedPlacements.push({ ...team[placedCount], isPlayer: true, newX: c.x, newY: c.y, size: 2 });
                    obstacles.push({ x: c.x, y: c.y, w: 2, h: 2 });
                    placedCount++;
                }
            }
            radius++; 
        }
    };

    placeTeam(tX, tY, team1); placeTeam(t2X, t2Y, team2);

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

  const handleOverwriteRoster = () => {
    if (!confirmOverwrite) {
      setConfirmOverwrite(true);
      setTimeout(() => setConfirmOverwrite(false), 4000);
      return;
    }
    if (setRoster && currentPlacements) {
      const playerUpdates = currentPlacements.filter(p => p.isPlayer);
      setRoster(prevRoster => prevRoster.map(player => {
        const update = playerUpdates.find(up => up.id === player.id);
        if (update) return { ...player, x: update.newX, y: update.newY };
        return player;
      }));
      alert(t('suite.roster_updated', '✅ Coordinate del Roster aggiornate con successo!'));
      setConfirmOverwrite(false);
    }
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

  const getRenderMessages = () => {
    let placements = []; setPathfindingData(prev => { placements = prev?.placements || []; return prev; });
    if (placements.length === 0) return [];

    const chunkArray = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));
    const msgs = [];

    chunkArray(placements.filter(p => !p.isPlayer && p.type !== 'banner'), 10).forEach((chunk, i) => {
        let text = `${t('suite.alliance_structures', '🏗️ STRUTTURE ALLEANZA')}\n`; chunk.forEach(p => text += `▪ ${p.name}: X:${p.newX} Y:${p.newY}\n`);
        msgs.push({ id: `struct-${i}`, title: t('suite.structures_num', 'Strutture {{num}}', { num: i+1 }), text, category: 'strutture' });
    });
    chunkArray(placements.filter(p => p.isPlayer), 10).forEach((chunk, i) => {
        let text = `${t('suite.hive_castles', '🏰 CASTELLI HIVE ({{num}})', { num: i+1 })}\n`; chunk.forEach(p => text += `▪ ${p.name}: X:${p.newX} Y:${p.newY}\n`);
        msgs.push({ id: `player-${i}`, title: t('suite.castles_num', 'Castelli {{num}}', { num: i+1 }), text, category: 'castelli' });
    });
    chunkArray(placements.filter(p => p.type === 'banner'), 10).forEach((chunk, i) => {
        let text = `${t('suite.hive_banners_title', '🚩 STENDARDI HIVE ({{num}})', { num: i+1 })}\n`; chunk.forEach(p => text += `▪ ${p.name}: X:${p.newX} Y:${p.newY}\n`);
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
        <ul className="text-[10px] text-slate-300 space-y-1.5 ml-2 list-disc">
          <li><span className="font-bold text-slate-100">{t('suite.balance', 'Bilanciamento:')}</span> {t('suite.balance_desc', 'I membri senza trappola assegnata verranno equamente divisi in automatico.')}</li>
          <li><span className="font-bold text-slate-100">{t('suite.workflow', 'Workflow:')}</span> {t('suite.workflow_desc', 'Genera la mappa e usa il menu a comparsa per condividere le coordinate.')}</li>
        </ul>
      </div>
      
      <button onClick={handleGenerateLayout} className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-[0_0_15px_rgba(245,158,11,0.4)]">{t('suite.gen_final_hive', '▶ Genera Alveare Definitivo')}</button>

      {layoutResults && (
        <div className="mt-2 flex flex-col gap-4 animate-fade-in border-t border-slate-800/80 pt-3">
          <div className="flex gap-2">
            <div className="flex-1 bg-slate-950 border border-slate-800 p-2 rounded-lg text-center"><span className="block text-[8px] text-slate-500 uppercase font-bold">{t('suite.stuck_castles', 'Castelli Incastrati')}</span><span className="block text-base font-mono font-black text-blue-400">{layoutResults.players}</span></div>
            <div className="flex-1 bg-slate-950 border border-slate-800 p-2 rounded-lg text-center"><span className="block text-[8px] text-slate-500 uppercase font-bold">{t('suite.final_banners', 'Stendardi Finali')}</span><span className="block text-base font-mono font-black text-purple-400">{layoutResults.banners}</span></div>
          </div>
          
          <button onClick={() => setShowShareUI(!showShareUI)} className={`w-full py-2.5 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all border ${showShareUI ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'}`}>{showShareUI ? t('suite.hide_share', 'Nascondi Condivisione') : t('suite.share_layout', '📤 Condividi Layout')}</button>
          
          {(userRole === 'admin' || userRole === 'alliance') && currentPlacements && (
            <div className="mt-1 bg-red-950/20 border border-red-900/50 p-3 rounded-xl flex flex-col gap-2 shadow-inner">
                <span className="text-[9px] text-red-400 font-bold uppercase tracking-widest text-center block">{t('suite.advanced_options', 'Opzioni Avanzate')}</span>
                <button onClick={handleOverwriteRoster} className={`w-full py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${confirmOverwrite ? 'bg-red-600 hover:bg-red-500 text-white shadow-[0_0_15px_rgba(220,38,38,0.5)] scale-[0.98]' : 'bg-red-900/40 hover:bg-red-800/60 border border-red-800/80 text-red-300'}`}>{confirmOverwrite ? t('suite.confirm_overwrite', '⚠️ CONFERMA SOVRASCRITTURA') : t('suite.apply_roster', '🔄 Applica al Roster')}</button>
                {confirmOverwrite && <p className="text-[8px] text-red-300/80 leading-tight text-center">{t('suite.overwrite_desc', 'Tutte le coordinate attuali del Roster verranno sovrascritte con queste.')}</p>}
            </div>
          )}

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