import React, { useState } from 'react';
import { heroesDB, eventTypes } from '../../data/heroes';

export default function MarchAnalysisView({ t, reports }) {
  const [reportAId, setReportAId] = useState('');
  const [reportBId, setReportBId] = useState('');

  const reportA = reports.find(r => r.id === reportAId);
  const reportB = reports.find(r => r.id === reportBId);

  const getHeroImg = (heroId) => heroesDB.find(h => h.id === heroId)?.image;
  const getHeroName = (heroId) => heroesDB.find(h => h.id === heroId)?.name || t('march_analysis.lbl_nobody', 'Nessuno');
  
  const calculateDelta = (a, b) => {
    if (!a || !b || a === 0) return 0;
    return (((b - a) / a) * 100).toFixed(2);
  };

  const generateDifferencesList = (a, b) => {
     if (!a || !b) return [];
     const diffs = [];

     const marchesA = a.marchesSnapshot || a.snapshotData?.marches || [];
     const marchesB = b.marchesSnapshot || b.snapshotData?.marches || [];

     if (marchesA.length !== marchesB.length) {
         diffs.push({ 
            type: 'warning', icon: '⚠️', 
            text: t('march_analysis.diff_march_count', `Numero di marce schierate diverso: Il Report A ne usava ${marchesA.length}, il Report B ne usa ${marchesB.length}.`, { countA: marchesA.length, countB: marchesB.length }) 
         });
     }

     const maxMarches = Math.min(marchesA.length, marchesB.length); 
     const typeLabels = { solo: t('march_analysis.lbl_solo', 'Singola'), rally_leader: t('march_analysis.lbl_rally_leader', 'Leader Rally'), rally_joiner: t('march_analysis.lbl_rally_joiner', 'Gregario') };
     const slotLabels = { hero1: t('march_analysis.lbl_leader', 'Leader'), hero2: t('march_analysis.lbl_supp1', 'Supporto 1'), hero3: t('march_analysis.lbl_supp2', 'Supporto 2') };

     for (let i = 0; i < maxMarches; i++) {
         const mA = marchesA[i];
         const mB = marchesB[i];

         if (mA.marchType !== mB.marchType) {
             diffs.push({ 
                type: 'info', icon: '🔄', 
                text: t('march_analysis.diff_march_type', `Marcia ${i + 1}: L'impostazione è passata da "${typeLabels[mA.marchType] || mA.marchType}" a "${typeLabels[mB.marchType] || mB.marchType}".`, { num: i + 1, typeA: typeLabels[mA.marchType] || mA.marchType, typeB: typeLabels[mB.marchType] || mB.marchType }) 
             });
         }

         ['hero1', 'hero2', 'hero3'].forEach(slot => {
             if (mA[slot] !== mB[slot]) {
                 const hA = getHeroName(mA[slot]);
                 const hB = getHeroName(mB[slot]);
                 diffs.push({ 
                    type: 'hero', icon: '👤', 
                    text: t('march_analysis.diff_hero', `Marcia ${i + 1} (${slotLabels[slot]}): ${hA !== t('march_analysis.lbl_nobody', 'Nessuno') ? hA : t('march_analysis.lbl_nobody', 'Nessuno')} è stato sostituito con ${hB !== t('march_analysis.lbl_nobody', 'Nessuno') ? hB : t('march_analysis.lbl_nobody', 'Nessuno')}.`, { num: i + 1, slot: slotLabels[slot], heroA: hA !== t('march_analysis.lbl_nobody', 'Nessuno') ? hA : t('march_analysis.lbl_nobody', 'Nessuno'), heroB: hB !== t('march_analysis.lbl_nobody', 'Nessuno') ? hB : t('march_analysis.lbl_nobody', 'Nessuno') }) 
                 });
             }
         });

         const pA = mA.troopConfig?.percent || { inf: 0, cav: 0, arc: 0 };
         const pB = mB.troopConfig?.percent || { inf: 0, cav: 0, arc: 0 };
         
         if (pA.inf !== pB.inf || pA.cav !== pB.cav || pA.arc !== pB.arc) {
             diffs.push({ 
                type: 'troops', icon: '⚔️', 
                text: t('march_analysis.diff_troops', `Marcia ${i + 1} (Truppe): Passate dal [${pA.inf}%-${pA.cav}%-${pA.arc}%] al [${pB.inf}%-${pB.cav}%-${pB.arc}%].`, { num: i + 1, infA: pA.inf, cavA: pA.cav, arcA: pA.arc, infB: pB.inf, cavB: pB.cav, arcB: pB.arc }) 
             });
         }
     }

     const animalsA = a.snapshotData?.activeAnimals || [];
     const animalsB = b.snapshotData?.activeAnimals || [];
     if (JSON.stringify(animalsA.sort()) !== JSON.stringify(animalsB.sort())) {
         diffs.push({ type: 'animals', icon: '🐾', text: t('march_analysis.diff_animals', `È cambiato il set di Behemoth / Animali attivi tra i due report.`) });
     }

     const buffsA = a.playerBuffsAtReport || {};
     const buffsB = b.playerBuffsAtReport || {};
     const allBuffKeys = new Set([...Object.keys(buffsA), ...Object.keys(buffsB)]);
     
     let buffChangesCount = 0;
     allBuffKeys.forEach(bKey => {
         const valA = buffsA[bKey] || 0;
         const valB = buffsB[bKey] || 0;
         if (valA !== valB) buffChangesCount++;
     });

     if (buffChangesCount > 0) {
         diffs.push({ type: 'buffs', icon: '⚡', text: t('march_analysis.diff_buffs', `Rilevate variazioni nei livelli di ${buffChangesCount} buff/ricerche attive tra i due eventi.`, { count: buffChangesCount }) });
     }

     return diffs;
  };

  const differences = generateDifferencesList(reportA, reportB);

  return (
    <div className="flex-1 flex flex-col gap-6 overflow-y-auto custom-scrollbar animate-in fade-in duration-300 pb-10">
      
      <div className="bg-indigo-950/20 border border-indigo-900/50 p-6 rounded-2xl shadow-xl flex flex-col gap-5">
         <div>
            <h2 className="text-xl font-black text-indigo-400 flex items-center gap-2">
               <span>⚖️</span> {t('march_analysis.title', 'A/B Testing & Confronto')}
            </h2>
            <p className="text-sm text-slate-400 mt-1">
               {t('march_analysis.desc', 'Seleziona due report dallo storico per confrontarne i punteggi e le differenze tattiche.')}
            </p>
         </div>

         <div className="flex flex-col md:flex-row gap-4 pt-4 border-t border-indigo-900/30">
            <div className="flex-1 flex flex-col gap-2">
               <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{t('march_analysis.report_a', 'Report A (Base)')}</label>
               <select value={reportAId} onChange={(e) => setReportAId(e.target.value)} className="bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white font-bold outline-none focus:border-indigo-400 transition-colors cursor-pointer">
                  <option value="">{t('march_analysis.select_a', '-- Seleziona il primo Report --')}</option>
                  {reports.map(r => (
                     <option key={`A-${r.id}`} value={r.id}>
                        {new Date(r.date).toLocaleDateString()} - {r.buildName} ({eventTypes.find(e => e.id === r.event)?.name || r.event})
                     </option>
                  ))}
               </select>
            </div>
            
            <div className="flex items-center justify-center shrink-0 pt-6">
               <span className="text-2xl font-black text-slate-600">VS</span>
            </div>

            <div className="flex-1 flex flex-col gap-2">
               <label className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">{t('march_analysis.report_b', 'Report B (Confronto)')}</label>
               <select value={reportBId} onChange={(e) => setReportBId(e.target.value)} className="bg-slate-950 border border-indigo-900/50 rounded-xl px-4 py-3 text-indigo-100 font-bold outline-none focus:border-indigo-400 transition-colors cursor-pointer">
                  <option value="">{t('march_analysis.select_b', '-- Seleziona il secondo Report --')}</option>
                  {reports.map(r => (
                     <option key={`B-${r.id}`} value={r.id}>
                        {new Date(r.date).toLocaleDateString()} - {r.buildName} ({eventTypes.find(e => e.id === r.event)?.name || r.event})
                     </option>
                  ))}
               </select>
            </div>
         </div>
      </div>

      {reportA && reportB ? (
         <div className="flex flex-col gap-6 animate-in zoom-in-95 duration-300">
            
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-xl flex flex-col items-center justify-center relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-700 via-indigo-500 to-slate-700"></div>
               <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-4">{t('march_analysis.total_score', 'Punteggio Totale Evento')}</span>
               
               <div className="flex w-full items-center justify-between gap-4">
                  <div className="flex-1 text-center flex flex-col items-center">
                     <span className="text-sm text-slate-500 font-bold truncate max-w-[150px]">{reportA.buildName}</span>
                     <span className="text-2xl md:text-3xl font-black text-white font-mono mt-1">{(reportA.totalScore || 0).toLocaleString()}</span>
                  </div>
                  
                  <div className="shrink-0 flex flex-col items-center justify-center bg-slate-950 border border-slate-800 p-4 rounded-full w-24 h-24 shadow-inner">
                     <span className="text-[10px] text-slate-500 uppercase font-bold mb-1">{t('march_analysis.gap', 'Scarto')}</span>
                     {(() => {
                        const delta = calculateDelta(reportA.totalScore, reportB.totalScore);
                        const isPositive = delta > 0;
                        const isZero = delta == 0;
                        return (
                           <span className={`text-lg font-black ${isZero ? 'text-slate-400' : isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {isPositive ? '+' : ''}{delta}%
                           </span>
                        );
                     })()}
                  </div>

                  <div className="flex-1 text-center flex flex-col items-center">
                     <span className="text-sm text-indigo-400 font-bold truncate max-w-[150px]">{reportB.buildName}</span>
                     <span className="text-2xl md:text-3xl font-black text-indigo-100 font-mono mt-1">{(reportB.totalScore || 0).toLocaleString()}</span>
                  </div>
               </div>
            </div>

            <div className="bg-slate-900 border border-indigo-900/50 rounded-2xl p-5 shadow-xl flex flex-col gap-3">
               <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2 border-b border-slate-800 pb-2">
                  <span>💡</span> {t('march_analysis.tactical_diffs', 'Resoconto Variazioni Tattiche & Buff')}
               </h3>
               
               {differences.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">
                     {t('march_analysis.no_diffs', 'Le due formazioni e i relativi buff analizzati presentano la stessa identica configurazione. La differenza di punteggio è dovuta a fattori aleatori di battaglia.')}
                  </p>
               ) : (
                  <ul className="flex flex-col gap-2.5">
                     {differences.map((diff, index) => (
                        <li key={index} className="flex items-start gap-2 text-xs text-slate-300 bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/80">
                           <span className="shrink-0 text-sm leading-none">{diff.icon}</span>
                           <span className="leading-tight">
                              <span dangerouslySetInnerHTML={{ 
                                 __html: diff.text
                                    .replace(/Marcia \d+/g, (m) => `<strong class="text-cyan-400">${m}</strong>`)
                                    .replace(/March \d+/g, (m) => `<strong class="text-cyan-400">${m}</strong>`)
                                    .replace(/\[([^\]]+)\]/g, (m, p1) => `<strong class="text-amber-400">${p1}</strong>`)
                              }} />
                           </span>
                        </li>
                     ))}
                  </ul>
               )}
            </div>

            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mt-2 flex items-center gap-2">
               <span>👁️</span> {t('march_analysis.visual_overview', 'Panoramica Visiva Marce')}
            </h3>
            
            <div className="grid grid-cols-1 gap-4">
               {Array.from({ length: Math.max(reportA.marchesSnapshot?.length || 0, reportB.marchesSnapshot?.length || 0) }).map((_, i) => {
                  const mA = reportA.marchesSnapshot?.[i];
                  const mB = reportB.marchesSnapshot?.[i];
                  const resA = reportA.marchesResults?.[mA?.id] || {};
                  const resB = reportB.marchesResults?.[mB?.id] || {};

                  return (
                     <div key={i} className="bg-slate-900 border border-slate-700 rounded-xl p-4 flex flex-col lg:flex-row gap-4 lg:gap-0 lg:divide-x divide-slate-800">
                        <div className="flex-1 flex flex-col gap-3 lg:pr-4">
                           <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                              <span className="text-xs font-black text-slate-400">{t('march_analysis.march_a', `Marcia ${i+1} (A)`, { num: i+1 })}</span>
                              {resA.points > 0 && <span className="text-[10px] text-emerald-500 font-mono font-bold bg-emerald-950/30 px-2 py-0.5 rounded">{t('march_analysis.dmg', `Danno: ${Number(resA.points).toLocaleString()}`, { val: Number(resA.points).toLocaleString() })}</span>}
                           </div>
                           {mA ? (
                              <div className="flex flex-col gap-2">
                                 <div className="flex gap-2">
                                    {[mA.hero1, mA.hero2, mA.hero3].map((h, idx) => h ? <img key={idx} src={getHeroImg(h)} className="w-10 h-10 rounded-lg object-cover border border-slate-700" alt="hero"/> : <div key={idx} className="w-10 h-10 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center text-xs text-slate-600">?</div>)}
                                 </div>
                                 <div className="flex gap-1 mt-1">
                                    <span className="text-[10px] bg-cyan-950 text-cyan-400 px-1.5 py-0.5 rounded border border-cyan-900">{t('march_builder.inf_short', 'Fant')}: {mA.troopConfig?.percent?.inf || 0}%</span>
                                    <span className="text-[10px] bg-amber-950 text-amber-400 px-1.5 py-0.5 rounded border border-amber-900">{t('march_builder.cav_short', 'Cav')}: {mA.troopConfig?.percent?.cav || 0}%</span>
                                    <span className="text-[10px] bg-rose-950 text-rose-400 px-1.5 py-0.5 rounded border border-rose-900">{t('march_builder.arc_short', 'Arc')}: {mA.troopConfig?.percent?.arc || 0}%</span>
                                 </div>
                              </div>
                           ) : <span className="text-[10px] text-slate-600 italic">{t('march_analysis.no_march', 'Nessuna marcia schierata.')}</span>}
                        </div>

                        <div className="flex-1 flex flex-col gap-3 lg:pl-4">
                           <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                              <span className="text-xs font-black text-indigo-400">{t('march_analysis.march_b', `Marcia ${i+1} (B)`, { num: i+1 })}</span>
                              {resB.points > 0 && <span className="text-[10px] text-emerald-500 font-mono font-bold bg-emerald-950/30 px-2 py-0.5 rounded">{t('march_analysis.dmg', `Danno: ${Number(resB.points).toLocaleString()}`, { val: Number(resB.points).toLocaleString() })}</span>}
                           </div>
                           {mB ? (
                              <div className="flex flex-col gap-2">
                                 <div className="flex gap-2">
                                    {[mB.hero1, mB.hero2, mB.hero3].map((h, idx) => h ? <img key={idx} src={getHeroImg(h)} className="w-10 h-10 rounded-lg object-cover border border-indigo-900/50" alt="hero"/> : <div key={idx} className="w-10 h-10 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center text-xs text-slate-600">?</div>)}
                                 </div>
                                 <div className="flex gap-1 mt-1">
                                    <span className="text-[10px] bg-cyan-950 text-cyan-400 px-1.5 py-0.5 rounded border border-cyan-900">{t('march_builder.inf_short', 'Fant')}: {mB.troopConfig?.percent?.inf || 0}%</span>
                                    <span className="text-[10px] bg-amber-950 text-amber-400 px-1.5 py-0.5 rounded border border-amber-900">{t('march_builder.cav_short', 'Cav')}: {mB.troopConfig?.percent?.cav || 0}%</span>
                                    <span className="text-[10px] bg-rose-950 text-rose-400 px-1.5 py-0.5 rounded border border-rose-900">{t('march_builder.arc_short', 'Arc')}: {mB.troopConfig?.percent?.arc || 0}%</span>
                                 </div>
                              </div>
                           ) : <span className="text-[10px] text-slate-600 italic">{t('march_analysis.no_march', 'Nessuna marcia schierata.')}</span>}
                        </div>
                     </div>
                  );
               })}
            </div>

         </div>
      ) : (
         <div className="flex flex-col items-center justify-center py-20 gap-4 bg-slate-900/50 border border-slate-800 rounded-2xl">
            <span className="text-6xl grayscale opacity-50">⚖️</span>
            <p className="text-slate-400 font-bold">{t('march_analysis.select_prompt', 'Seleziona due report per iniziare il confronto.')}</p>
         </div>
      )}
    </div>
  );
}