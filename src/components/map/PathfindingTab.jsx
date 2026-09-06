import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ManualPathfindingSidebar } from './ManualPathfindingSidebar';
import { db } from '../../firebase'; 
import { doc, setDoc, getDoc } from 'firebase/firestore';

export const PathfindingTab = ({
  hq, trap1, trap2, validStructures, fixedBuildings,
  setPathfindingData, userRole, allianceCode,
  validPlayers, roster
}) => {
  const { t } = useTranslation();
  const [pathSubMode, setPathSubMode] = useState('auto'); 
  const [selectedManualTargets, setSelectedManualTargets] = useState([]);
  const [livePreviewStats, setLivePreviewStats] = useState(null);
  const [pathResults, setPathResults] = useState(null);
  const [showPathShareUI, setShowPathShareUI] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const [isSavingPath, setIsSavingPath] = useState(false);
  const [isLoadingPath, setIsLoadingPath] = useState(false);
  const [currentActiveTargets, setCurrentActiveTargets] = useState([]);

  const calculateMSTFromNodes = (targetNodes, isPreview = false) => {
    setCurrentActiveTargets(targetNodes); 

    const hqNode = { ...hq, uniqueKey: 'hq-root', isPlayer: false, centerX: Number(hq.x) + (hq.size || 3) / 2, centerY: Number(hq.y) + (hq.size || 3) / 2 };
    const trapNodes = [trap1, trap2].filter(t => t && t.x != null && t.y != null && !(Number(t.x) === 0 && Number(t.y) === 0))
        .map(t => ({ ...t, uniqueKey: t.id || `trap-${t.x}-${t.y}`, isPlayer: false, centerX: Number(t.x) + 1.5, centerY: Number(t.y) + 1.5 }));

    const nodes = [hqNode, ...trapNodes, ...targetNodes.map(t => ({
        ...t, uniqueKey: t.id || `target-${t.x}-${t.y}`, centerX: Number(t.x) + (t.size || 2) / 2, centerY: Number(t.y) + (t.size || 2) / 2
    }))];

    if (nodes.length < 2) {
        setPathfindingData(null); setPathResults(null); setLivePreviewStats(null);
        return;
    }

    const allObstacles = [];
    (fixedBuildings || []).forEach(b => {
        if (b.x != null && b.y != null && !(Number(b.x) === 0 && Number(b.y) === 0)) allObstacles.push({ x: Number(b.x), y: Number(b.y), w: b.size || 2, h: b.size || 2 });
    });
    (validStructures || []).forEach(s => {
        allObstacles.push({ x: Number(s.x), y: Number(s.y), w: s.size || (s.type === 'headquarters' ? 3 : 3), h: s.size || 3 });
    });

    const isOccupied = (x, y) => allObstacles.some(obs => x < obs.x + obs.w && x + 1 > obs.x && y < obs.y + obs.h && y + 1 > obs.y);

    const findFreeSpot = (startX, startY) => {
        if (!isOccupied(startX, startY)) return { x: startX, y: startY };
        let radius = 1;
        while (radius < 10) { 
            for (let dx = -radius; dx <= radius; dx++) {
                for (let dy = -radius; dy <= radius; dy++) {
                    if (Math.abs(dx) === radius || Math.abs(dy) === radius) {
                        if (!isOccupied(startX + dx, startY + dy)) return { x: startX + dx, y: startY + dy };
                    }
                }
            }
            radius++;
        }
        return { x: startX, y: startY }; 
    };

    const edges = [];
    for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
            edges.push({ u: i, v: j, dist: Math.hypot(nodes[i].centerX - nodes[j].centerX, nodes[i].centerY - nodes[j].centerY) });
        }
    }
    edges.sort((a, b) => a.dist - b.dist);
    
    const parent = Array(nodes.length).fill(0).map((_, i) => i);
    const find = (i) => parent[i] === i ? i : (parent[i] = find(parent[i]));
    const union = (i, j) => {
        const rootI = find(i); const rootJ = find(j);
        if (rootI !== rootJ) { parent[rootI] = rootJ; return true; } return false;
    };

    const markers = [];
    const capturedSet = new Set();
    let totalDistanceTiles = 0;

    edges.forEach(edge => {
        if (union(edge.u, edge.v)) {
            markers.push({ x: nodes[edge.u].centerX, y: nodes[edge.u].centerY, px: nodes[edge.v].centerX, py: nodes[edge.v].centerY });
            capturedSet.add(nodes[edge.u].uniqueKey); capturedSet.add(nodes[edge.v].uniqueKey);
            totalDistanceTiles += edge.dist;
        }
    });

    const captured = nodes.filter(n => capturedSet.has(n.uniqueKey));
    const estimatedBanners = Math.ceil(totalDistanceTiles / 7);
    const generatedPathBanners = [];

    markers.forEach((m, idx) => {
        const dist = Math.hypot(m.px - m.x, m.py - m.y);
        for (let s = 1; s <= Math.floor(dist / 7); s++) {
            const ratio = (s * 7) / dist;
            const freeSpot = findFreeSpot(Math.round(m.x + (m.px - m.x) * ratio), Math.round(m.y + (m.py - m.y) * ratio));
            generatedPathBanners.push({ name: t('suite.network_banner', 'Stendardo Rete {{idx}}-{{s}}', { idx: idx + 1, s }), newX: freeSpot.x, newY: freeSpot.y });
        }
    });

    const existingBanners = (validStructures || []).filter(s => s.type === 'banner' || s.code === 'BAN').length;
    let hiveBanners = 0;
    
    if (existingBanners > 0) {
        hiveBanners = existingBanners;
    } else {
        const playerCount = (roster && roster.length > 0) ? roster.length : ((validPlayers && validPlayers.length) || 0);
        hiveBanners = Math.max(2, Math.ceil(playerCount / 6) + 2); 
    }

    const pathBannersCount = generatedPathBanners.length > 0 ? generatedPathBanners.length : estimatedBanners;
    const totalBanners = pathBannersCount + hiveBanners;

    setLivePreviewStats({ nodes: nodes.length - 1, banners: totalBanners, pathBanners: pathBannersCount, hiveBanners: hiveBanners });
    setPathfindingData({ mode: 'path', targets: nodes, markers, captured, pathBanners: generatedPathBanners });

    if (!isPreview) {
        setPathResults({ nodes: nodes.length - 1, banners: totalBanners, pathBanners: pathBannersCount, hiveBanners: hiveBanners, distance: Math.round(totalDistanceTiles), bannerList: generatedPathBanners });
        setShowPathShareUI(true);
    } else {
        setPathResults(null); setShowPathShareUI(false);
    }
  };

  const handleSavePathToCloud = async () => {
    if (userRole !== 'admin' && userRole !== 'alliance') return;
    if (!allianceCode) return alert(t('suite.missing_alliance_code', 'Codice alleanza mancante!'));
    setIsSavingPath(true);
    try {
      await setDoc(doc(db, 'allianceMapData', allianceCode), { savedTacticalPath: { mode: pathSubMode, targets: currentActiveTargets } }, { merge: true });
    } catch (error) { console.error(error); alert(t('suite.error_saving_path', 'Errore durante il salvataggio della rotta.')); }
    setIsSavingPath(false);
  };

  const handleLoadPathFromCloud = async () => {
    if (userRole !== 'admin' && userRole !== 'alliance') return;
    if (!allianceCode) return;
    setIsLoadingPath(true);
    try {
      const snap = await getDoc(doc(db, 'allianceMapData', allianceCode));
      if (snap.exists() && snap.data().savedTacticalPath) {
        const { mode, targets } = snap.data().savedTacticalPath;
        setPathSubMode(mode || 'auto');
        if (mode === 'manual') setSelectedManualTargets(targets || []);
        setTimeout(() => { calculateMSTFromNodes(targets || [], false); setShowPathShareUI(true); }, 50);
      } else { alert(t('suite.no_saved_path', 'Nessuna rotta salvata trovata per questa alleanza.')); }
    } catch(e) { console.error(e); alert(t('suite.error_loading', 'Errore durante il caricamento.')); }
    setIsLoadingPath(false);
  };

  useEffect(() => {
    if (pathSubMode === 'manual') {
        if (selectedManualTargets.length > 0) calculateMSTFromNodes(selectedManualTargets, true); 
        else { setPathfindingData(null); setPathResults(null); setLivePreviewStats(null); setShowPathShareUI(false); }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedManualTargets, pathSubMode]);

  const handleCalculateManualPath = () => { calculateMSTFromNodes(selectedManualTargets, false); setShowPathShareUI(true); };

  const handleGeneratePath = () => {
    const hqNode = { x: hq.x, y: hq.y, size: hq.size || 3 };
    const excludeKeywords = ['santuario', 'fortezza', 'sanctuary', 'fortress', 'shrine', 'fort', 'origine', 'origin', 'castello', 'castle', 'sunfire', 'fuoco solare', 'capitale', 'capitol', 'trono', 'throne', 'centro', 'center', 'castello del regno', 'torrett', 'turret'];
    const availableBuildings = (fixedBuildings || []).filter(b => {
        const testString = `${b.type || ''} ${b.name || ''} ${b.code || ''}`.toLowerCase().trim();
        if (excludeKeywords.some(ex => testString.includes(ex)) || b.isPlayer) return false; 
        if (b.x == null || b.y == null || isNaN(Number(b.x)) || isNaN(Number(b.y)) || (Number(b.x) === 0 && Number(b.y) === 0)) return false;
        return true;
    });

    const targetGroups = {};
    availableBuildings.forEach(b => {
        const key = `${(b.type || b.name || 'sconosciuto').toLowerCase()}-${b.level || 1}`;
        const distToHq = Math.hypot(Number(b.x) + (b.size || 2) / 2 - (Number(hqNode.x) + 1.5), Number(b.y) + (b.size || 2) / 2 - (Number(hqNode.y) + 1.5));
        if (!targetGroups[key] || distToHq < targetGroups[key].distToHq) targetGroups[key] = { ...b, distToHq };
    });
    calculateMSTFromNodes(Object.values(targetGroups), false);
    setShowPathShareUI(true);
  };

  const handleCopyMessage = (text, id) => {
    navigator.clipboard.writeText(text).then(() => { setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); });
  };

  const pathMessages = [];
  if (pathResults?.bannerList?.length > 0) {
    const chunkArray = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));
    chunkArray(pathResults.bannerList, 10).forEach((chunk, i) => {
        let text = `${t('suite.route_banners_title', '🚩 STENDARDI ROTTA TERRITORIO ({{num}})', { num: i + 1 })}\n`;
        chunk.forEach((b, idx) => text += `▪ ${t('suite.banner_prefix', 'Stendardo')} ${i*10 + idx + 1}: X:${b.newX} Y:${b.newY}\n`);
        pathMessages.push({ id: `path-banner-${i}`, title: t('suite.route_banners_title_short', 'Stendardi Rotta {{num}}', { num: i + 1 }), text });
    });
  }

  return (
    <div className="flex flex-col gap-4 animate-fade-in h-full">
      <div className="flex gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 shrink-0">
        <button onClick={() => { setPathSubMode('auto'); setPathfindingData(null); setPathResults(null); setLivePreviewStats(null); setShowPathShareUI(false); }} className={`flex-1 py-1.5 text-[9px] font-black uppercase rounded transition-all ${pathSubMode === 'auto' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:bg-slate-900'}`}>{t('suite.auto_mode', '⚡ Automatico')}</button>
        <button onClick={() => { setPathSubMode('manual'); setPathfindingData(null); setPathResults(null); setShowPathShareUI(false); }} className={`flex-1 py-1.5 text-[9px] font-black uppercase rounded transition-all ${pathSubMode === 'manual' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:bg-slate-900'}`}>{t('suite.manual_mode', '🛠️ Manuale')}</button>
      </div>

      {(!userRole || userRole === 'admin' || userRole === 'alliance') && (
        <div className="flex gap-2 bg-indigo-950/20 p-2 rounded-xl border border-indigo-900/50 shrink-0">
          <button onClick={handleLoadPathFromCloud} disabled={isLoadingPath} className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 disabled:text-slate-600 text-indigo-300 text-[9px] font-black uppercase tracking-widest rounded-lg border border-slate-700 transition-all flex items-center justify-center gap-1">{isLoadingPath ? t('suite.loading', '⏳...') : t('suite.load_cloud', '📂 Carica Cloud')}</button>
          <button onClick={handleSavePathToCloud} disabled={isSavingPath || !pathResults} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:border-slate-700 text-white text-[9px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-1 border border-indigo-500">{isSavingPath ? t('suite.loading', '⏳...') : t('suite.save_cloud', '💾 Salva Cloud')}</button>
        </div>
      )}

      {pathSubMode === 'auto' ? (
        <div className="flex flex-col gap-4 animate-fade-in">
          <div className="bg-emerald-950/20 border border-emerald-900/50 p-4 rounded-xl text-left">
            <h3 className="text-sm font-black text-emerald-400 uppercase tracking-widest mb-2 flex items-center gap-2"><span className="text-xl">🕸️</span> {t('suite.auto_expansion', 'Espansione Automatica')}</h3>
            <ul className="text-[10px] text-slate-300 space-y-1.5 ml-2 list-disc"><li>{t('suite.auto_desc', 'Seleziona in automatico il più vicino per ogni tipologia e livello di edificio.')}</li></ul>
          </div>
          {!showPathShareUI && <button onClick={handleGeneratePath} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.4)]">{t('suite.calc_auto_route', '▶ Calcola Rotta Automatica')}</button>}
        </div>
      ) : (
        <ManualPathfindingSidebar fixedBuildings={fixedBuildings} selectedManualTargets={selectedManualTargets} setSelectedManualTargets={setSelectedManualTargets} livePreviewStats={livePreviewStats} showPathShareUI={showPathShareUI} onToggleShareUI={setShowPathShareUI} onBack={() => { setPathSubMode('auto'); setPathfindingData(null); setPathResults(null); setLivePreviewStats(null); setShowPathShareUI(false); }} onCalculateManualPath={handleCalculateManualPath} />
      )}

      {showPathShareUI && pathResults && (
        <div className="mt-1 flex flex-col gap-3 animate-fade-in border-t border-slate-800/80 pt-3">
          {pathSubMode === 'auto' && (
              <div className="flex gap-2 mb-1">
                  <div className="flex-1 bg-slate-950 border border-slate-800 p-2 rounded-lg text-center flex flex-col justify-center">
                      <span className="block text-[8px] text-slate-500 uppercase font-bold">{t('suite.buildings', 'Edifici')}</span>
                      <span className="block text-base font-mono font-black text-cyan-400">{pathResults.nodes}</span>
                  </div>
                  <div className="flex-1 bg-slate-950 border border-slate-800 p-2 rounded-lg text-center flex flex-col justify-center">
                      <span className="block text-[8px] text-slate-500 uppercase font-bold">{t('suite.tot_banners', 'Tot. Stendardi')}</span>
                      <span className="block text-base font-mono font-black text-emerald-400 leading-none">{pathResults.banners}</span>
                      <span className="block text-[6.5px] text-slate-400 mt-1 uppercase">{t('suite.banner_breakdown', '({{hive}} Hive + {{path}} Rotta)', { hive: pathResults.hiveBanners, path: pathResults.pathBanners })}</span>
                  </div>
              </div>
          )}
          <button onClick={() => setShowPathShareUI(false)} className="w-full py-2 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 font-black uppercase tracking-widest rounded-xl transition-all border border-slate-700">{t('suite.edit_route', 'Modifica Rotta')}</button>
          <div className="space-y-3">
              {pathMessages.map((msg) => (
                  <div key={msg.id} className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
                      <div className="bg-slate-900/50 p-2 px-3 flex justify-between items-center border-b border-slate-800">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-300">{msg.title}</span>
                          <button onClick={() => handleCopyMessage(msg.text, msg.id)} className={`px-3 py-1 rounded text-[9px] font-black uppercase tracking-widest transition-colors ${copiedId === msg.id ? 'bg-emerald-600 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}>{copiedId === msg.id ? t('suite.copied', '✓ COPIATO') : t('suite.copy_chat', 'COPIA CHAT')}</button>
                      </div>
                      <div className="p-3"><pre className="text-[10px] font-mono text-slate-400 whitespace-pre-wrap leading-relaxed m-0">{msg.text}</pre></div>
                  </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};