import React from 'react';
import { heroesDB, eventTypes } from '../../data/heroes';

export default function MarchResultsView({ 
  t, indexedBuilds = [], selectedSnapshotId, setSelectedSnapshotId,
  snapshotResults = {}, handleResultUpdate, handleTotalScoreUpdate, 
  handleSaveToCloud, handleArchiveResults, isLoading 
}) {
  const selectedSnapshot = indexedBuilds.find(b => b.id === selectedSnapshotId) || null;
  const marchesToDisplay = selectedSnapshot ? selectedSnapshot.marches : [];

  return (
    <div className="flex-1 flex flex-col gap-6 overflow-y-auto custom-scrollbar animate-in fade-in duration-300 pb-10">
       
       <div className="bg-fuchsia-950/20 border border-fuchsia-900/50 p-6 rounded-2xl shadow-xl flex flex-col gap-5">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                 <h2 className="text-xl font-black text-fuchsia-400 flex items-center gap-2">
                    <span>📊</span> {t('march_results.title', 'Inserimento Risultati')}
                 </h2>
                 <p className="text-sm text-slate-400 mt-1">
                    {t('march_results.desc', 'Seleziona una formazione indicizzata e inserisci i danni ottenuti per l\'analisi.')}
                 </p>
              </div>
              <div className="flex flex-col sm:flex-row w-full md:w-auto gap-3 shrink-0">
                 <button onClick={handleSaveToCloud} disabled={isLoading || !selectedSnapshot} className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-black uppercase tracking-widest rounded-xl transition-all disabled:opacity-50 shadow-md">
                   {isLoading ? '⏳...' : `💾 ${t('march_results.btn_save_draft', 'Salva Bozza')}`}
                 </button>
                 <button onClick={handleArchiveResults} disabled={isLoading || !selectedSnapshot} className="px-6 py-3 bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-[0_0_20px_rgba(192,38,211,0.4)] disabled:opacity-50 flex items-center justify-center gap-2">
                   {isLoading ? '⏳...' : `📥 ${t('march_results.btn_archive', 'Archivia Definitivo')}`}
                 </button>
              </div>
          </div>

          <div className="flex flex-col xl:flex-row gap-5 pt-5 border-t border-fuchsia-900/30">
              <div className="flex-1 flex flex-col gap-2">
                  <label className="text-[10px] text-fuchsia-400 font-bold uppercase tracking-widest">{t('march_results.snapshot_label', 'Formazione Indicizzata (Snapshot)')}</label>
                  <select 
                      value={selectedSnapshotId || ''} 
                      onChange={(e) => setSelectedSnapshotId(e.target.value)}
                      className="bg-slate-950 border border-fuchsia-900/50 rounded-xl px-4 py-3.5 text-white font-bold outline-none focus:border-fuchsia-400 transition-colors cursor-pointer w-full shadow-inner"
                  >
                      <option value="">{t('march_results.select_snapshot', '-- Seleziona una formazione dallo storico --')}</option>
                      {indexedBuilds.map(b => (
                          <option key={b.id} value={b.id}>
                              {b.name} - {new Date(b.createdAt).toLocaleDateString()} ({eventTypes.find(e => e.id === b.event)?.name || b.event})
                          </option>
                      ))}
                  </select>
              </div>

              {selectedSnapshot && (
                  <div className="flex-1 flex flex-col gap-2 animate-in slide-in-from-right-4">
                      <label className="text-[10px] text-amber-400 font-bold uppercase tracking-widest flex items-center gap-1">
                          <span>🏆</span> {t('march_results.total_score_label', 'Punteggio Totale Evento')}
                      </label>
                      <input 
                          type="number"
                          min="0"
                          value={snapshotResults.totalScore || ''}
                          onChange={(e) => handleTotalScoreUpdate(Number(e.target.value))}
                          placeholder={t('march_results.score_ph', 'Es. 450000000')}
                          className="bg-slate-950 border border-amber-900/50 rounded-xl px-4 py-3 text-amber-400 text-xl font-mono font-black outline-none focus:border-amber-400 transition-colors w-full shadow-inner"
                      />
                  </div>
              )}
          </div>
       </div>

       {!selectedSnapshot ? (
           <div className="flex flex-col items-center justify-center py-20 gap-4 bg-slate-900/50 border border-slate-800 rounded-2xl">
               <span className="text-6xl grayscale opacity-50">📂</span>
               <p className="text-slate-400 font-bold">{t('march_results.no_snapshot', 'Nessuna formazione selezionata.')}</p>
               <p className="text-xs text-slate-500">{t('march_results.no_snapshot_desc', 'Scegli un preset indicizzato dal menu in alto per inserirne i risultati.')}</p>
           </div>
       ) : (
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in zoom-in-95 duration-200">
              {marchesToDisplay.map((pm, index) => {
                 const mResult = snapshotResults.marches?.[pm.id] || { points: 0, note: '' };
                 
                 return (
                   <div key={`res-${pm.id}`} className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-xl flex flex-col transition-all hover:border-fuchsia-900/50">
                      <div className="bg-slate-800/50 border-b border-slate-800 p-4 flex items-center justify-between">
                         <div className="flex flex-col">
                            <h3 className="text-sm font-black text-slate-200 uppercase tracking-widest">
                               {t('march_results.march_number', 'Marcia')} {index + 1}
                            </h3>
                            <span className="text-[10px] text-fuchsia-400 font-bold uppercase mt-0.5">
                               {pm.marchType === 'rally_leader' ? t('march_results.lbl_leader', '👑 Leader Rally') : pm.marchType === 'rally_joiner' ? t('march_results.lbl_joiner', '🛡️ Gregario') : t('march_results.lbl_solo', '👤 Singola')}
                            </span>
                         </div>
                         <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
                            {[pm.hero1, pm.hero2, pm.hero3].map((heroId, i) => {
                               if (!heroId) return <div key={i} className="w-8 h-8 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-[10px] text-slate-600">?</div>;
                               const hObj = heroesDB.find(h => h.id === heroId);
                               return hObj ? <img key={i} src={hObj.image} alt={hObj.name} className="w-8 h-8 rounded-lg object-cover shadow-sm border border-slate-700" title={hObj.name} /> : null;
                            })}
                         </div>
                      </div>

                      <div className="p-5 flex flex-col gap-5">
                         <div className="flex flex-col gap-2">
                            <label className="text-xs text-fuchsia-400 font-black uppercase tracking-widest flex items-center gap-2">
                               <span>🎯</span> {t('march_results.single_march_dmg', 'Danno Singola Marcia (Opzionale)')}
                            </label>
                            <div className="relative flex items-center">
                               <input 
                                 type="number" 
                                 min="0" 
                                 value={mResult.points === 0 ? '' : mResult.points} 
                                 onChange={(e) => handleResultUpdate(pm.id, 'points', Number(e.target.value))} 
                                 placeholder={t('march_results.dmg_ph', 'Es. 12500000')} 
                                 className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-2xl text-white font-mono font-black focus:border-fuchsia-500 outline-none shadow-inner transition-colors" 
                               />
                            </div>
                         </div>

                         <div className="flex flex-col gap-2">
                            <label className="text-[10px] text-slate-500 font-bold uppercase">{t('march_results.notes_label', 'Note Tattiche (Opzionale)')}</label>
                            <input 
                              type="text" 
                              value={mResult.note || ''} 
                              onChange={(e) => handleResultUpdate(pm.id, 'note', e.target.value)} 
                              placeholder={t('march_results.note_ph', 'Es. Marcia rallentata, buff alleanza non attivi, rally annullato...')} 
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-300 focus:border-cyan-500 outline-none placeholder-slate-600" 
                            />
                         </div>
                      </div>
                   </div>
                 );
              })}
           </div>
       )}
    </div>
  );
}