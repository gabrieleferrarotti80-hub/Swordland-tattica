import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, getDocs } from 'firebase/firestore';
import MarchBuffsSettings from './MarchBuffsSettings';
import HeroImportModal from './HeroImportModal'; 

const TIERS = ['T11', 'T10', 'T9', 'T8', 'T7', 'T6', 'T5', 'T4', 'T3', 'T2', 'T1'];

export default function MarchSettingsView({
  t, setIsHeroModalOpen, globalCapacity, setGlobalCapacity,
  isArmyOpen, setIsArmyOpen, activeTab, setActiveTab,
  totalTroops, setTotalTroops, initInf, initCav, initArc,
  handleSaveToCloud, handleLoadTargetData, isLoading,
  selectedEvent, playerBuffs, handleBuffChange,
  buffsCatalog, isAdmin, onOpenAdminModal,
  onOpenAdminHeroesModal,
  ownedHeroes, setOwnedHeroes, heroesCatalog
}) {
  const [rawPlayers, setRawPlayers] = useState([]);
  const [availableRealms, setAvailableRealms] = useState([]);
  const [selectedRealm, setSelectedRealm] = useState('');
  const [availableAlliances, setAvailableAlliances] = useState([]);
  const [selectedAlliance, setSelectedAlliance] = useState('');
  const [availablePlayers, setAvailablePlayers] = useState([]);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [isFetchingDB, setIsFetchingDB] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const handleFetchDatabase = async () => {
    setIsFetchingDB(true);
    try {
      const playersMap = new Map();
      const rostersSnap = await getDocs(collection(db, "rosters"));
      rostersSnap.forEach((doc) => {
        const data = doc.data();
        const docRealm = String(data.realm || 'Sconosciuto').trim();
        const docAlliance = String(data.allianceCode || 'Sconosciuta').trim().toUpperCase();

        if (data.members && Array.isArray(data.members)) {
          data.members.forEach(m => {
            const id = String(m.id || '').trim();
            if (id && id !== 'undefined') {
              const memRealm = String(m.realm || docRealm).trim();
              const memAlliance = String(m.allianceCode || docAlliance).trim().toUpperCase();
              const globalKey = `${memRealm}_${memAlliance}_${id}`;
              playersMap.set(globalKey, { id: id, name: String(m.name || 'Senza Nome').trim(), alliance: memAlliance, regno: memRealm, uniqueKey: globalKey });
            }
          });
        }
      });

      const marchesSnap = await getDocs(collection(db, "playerMarches"));
      marchesSnap.forEach((doc) => {
        const data = doc.data();
        const id = String(data.playerId || data.id || '').trim();
        const realm = String(data.realm || 'Sconosciuto').trim();
        const alliance = String(data.allianceCode || 'Sconosciuta').trim().toUpperCase();
        
        if (id && id !== 'undefined') {
          const globalKey = `${realm}_${alliance}_${id}`;
          if (!playersMap.has(globalKey)) {
            playersMap.set(globalKey, { id: id, name: String(data.playerName || data.name || 'Senza Nome').trim(), alliance: alliance, regno: realm, uniqueKey: globalKey });
          }
        }
      });

      const players = Array.from(playersMap.values());
      setRawPlayers(players);
      const realms = [...new Set(players.map(p => p.regno).filter(r => r && r !== ''))].sort();
      setAvailableRealms(realms);
      
      setSelectedRealm(''); setSelectedAlliance(''); setSelectedTarget(null);

    } catch (e) {
      console.error(e);
      alert(t('march_settings.err_db', 'Errore di connessione al database.'));
    }
    setIsFetchingDB(false);
  };

  useEffect(() => {
    if (selectedRealm) {
      const alliancesInRealm = rawPlayers.filter(p => p.regno === selectedRealm).map(p => p.alliance);
      const uniqueAlliances = [...new Set(alliancesInRealm)].sort();
      setAvailableAlliances(uniqueAlliances);
      setSelectedAlliance(''); setAvailablePlayers([]); setSelectedTarget(null);
    }
  }, [selectedRealm, rawPlayers]);

  useEffect(() => {
    if (selectedAlliance && selectedRealm) {
      const playersInAlliance = rawPlayers.filter(p => p.regno === selectedRealm && p.alliance === selectedAlliance).sort((a, b) => a.name.localeCompare(b.name));
      setAvailablePlayers(playersInAlliance);
      setSelectedTarget(null);
    }
  }, [selectedAlliance, selectedRealm, rawPlayers]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-300">
      
      <div className="flex flex-col gap-6">
        
        <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl shadow-xl flex flex-col gap-4">
          <h2 className="text-sm font-black text-cyan-400 uppercase tracking-widest border-b border-slate-800 pb-2">
            🎖️ {t('march_builder.settings_heroes_title', 'Collezione & Eroi')}
          </h2>
          <p className="text-xs text-slate-400">{t('march_builder.settings_heroes_desc', 'Gestisci gli eroi sbloccati, i livelli, le stelle, l\'equipaggiamento e le statistiche generali.')}</p>
          
          <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
            <button onClick={() => setIsHeroModalOpen(true)} className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 text-xs font-bold uppercase tracking-wider rounded-xl transition-colors flex items-center justify-center gap-2 shadow-inner">
              <span>🎖️</span> {t('march_builder.open_hero_collection', 'Apri Collezione Eroi')}
            </button>
            <button onClick={() => setIsImportModalOpen(true)} className="px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2">
              <span>📊</span> {t('roster_table.excel_import_btn', 'Importa Excel')}
            </button>
            {isAdmin && (
              <button onClick={onOpenAdminHeroesModal} className="w-full sm:w-auto px-4 py-3 bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-[0_0_15px_rgba(192,38,211,0.3)] flex items-center justify-center gap-2">
                <span>🛠️</span> {t('march_builder.admin_heroes_btn', 'Gestisci Eroi (DB)')}
              </button>
            )}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl shadow-xl flex flex-col gap-4">
          <div className="border-b border-slate-800 pb-2">
            <h2 className="text-sm font-black text-indigo-400 uppercase tracking-widest">{t('march_builder.global_capacity_title')}</h2>
            <p className="text-[10px] text-slate-500 leading-tight mt-1">{t('march_builder.global_capacity_desc')}</p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {[0, 1, 2, 3].map(num => (
              <div key={`cap-${num}`} className="flex flex-col gap-1 p-2 rounded-xl border bg-slate-950 border-slate-800 focus-within:border-indigo-500/50 transition-colors">
                <label className="text-[9px] font-bold text-slate-500 text-center">{num === 0 ? t('march_builder.hero_count_0') : num === 1 ? t('march_builder.hero_count_1') : num === 2 ? t('march_builder.hero_count_2') : t('march_builder.hero_count_3')}</label>
                <input type="number" min="0" value={globalCapacity[num] === 0 ? '' : globalCapacity[num]} onChange={(e) => setGlobalCapacity(p => ({...p, [num]: Math.max(0, e.target.value === '' ? 0 : Number(e.target.value))}))} className="w-full bg-transparent text-center text-indigo-300 font-mono text-sm font-bold outline-none" placeholder="0" />
              </div>
            ))}
          </div>
        </div>

        <MarchBuffsSettings 
          t={t} selectedEvent={selectedEvent} playerBuffs={playerBuffs} 
          handleBuffChange={handleBuffChange} buffsCatalog={buffsCatalog}
          isAdmin={isAdmin} onOpenAdminModal={onOpenAdminModal}
        />

        <div className="bg-emerald-950/20 border border-emerald-900/50 p-6 rounded-2xl shadow-xl flex flex-col gap-4 relative overflow-hidden overflow-visible">
          <div>
             <h2 className="text-sm font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2"><span>☁️</span> {t('march_builder.sync_title')}</h2>
             <p className="text-[10px] text-slate-400 mt-1">{t('march_builder.sync_desc')}</p>
          </div>
          
          {isAdmin && (
            <div className="bg-emerald-950/50 border border-emerald-900/50 rounded-xl p-4 flex flex-col gap-4 shadow-inner">
               <div className="flex justify-between items-center border-b border-emerald-900/50 pb-2">
                  <span className="text-[10px] text-emerald-400 font-black uppercase tracking-wider">{t('march_settings.consultant_mode', '🎯 Modalità Consulente')}</span>
                  {selectedTarget && !selectedTarget.isManual && <span className="text-[9px] text-emerald-950 bg-emerald-400 px-2 py-0.5 rounded font-black uppercase">{t('march_settings.target_ready', 'Target Pronto ✓')}</span>}
                  {selectedTarget?.isManual && <span className="text-[9px] text-amber-950 bg-amber-400 px-2 py-0.5 rounded font-black uppercase">{t('march_settings.new_target', 'Nuovo Target ⚠️')}</span>}
               </div>
               
               {!rawPlayers.length ? (
                 <button 
                   onClick={handleFetchDatabase} disabled={isFetchingDB}
                   className="w-full py-3 bg-slate-800 hover:bg-emerald-900 text-emerald-400 border border-emerald-800/50 text-xs font-black uppercase rounded-lg transition-colors shadow flex justify-center items-center gap-2"
                 >
                   {isFetchingDB ? t('march_settings.scanning_db', '⏳ Scansione Database...') : t('march_settings.load_db_players', '🔍 Carica Database Giocatori')}
                 </button>
               ) : (
                 <div className="flex flex-col gap-2">
                   <div className="flex justify-between items-center bg-slate-900/50 p-2.5 rounded-lg border border-slate-800">
                      <div className="flex gap-3 text-[10px] text-slate-400 font-bold">
                        <span>{t('march_settings.players_count', 'Giocatori:')} <span className="text-emerald-400">{rawPlayers.length}</span></span>
                        <span>{t('march_settings.realms_count', 'Regni:')} <span className="text-cyan-400">{availableRealms.length}</span></span>
                      </div>
                      <button onClick={handleFetchDatabase} className="text-[9px] text-emerald-500 hover:text-emerald-400 underline uppercase tracking-wider">{t('march_settings.reload', 'Ricarica')}</button>
                   </div>
                 </div>
               )}

               {rawPlayers.length > 0 && (
                 <div className="flex flex-col gap-3 animate-in fade-in">
                    <div className="flex flex-col gap-1">
                       <label className="text-[9px] text-slate-400 font-bold uppercase">{t('march_settings.step1_realm', '1. Seleziona Regno')}</label>
                       <select 
                         value={selectedRealm} onChange={e => setSelectedRealm(e.target.value)}
                         className="w-full bg-slate-900 border border-emerald-900/50 rounded-lg p-2.5 text-emerald-300 text-xs font-bold outline-none cursor-pointer"
                       >
                         <option value="">{t('march_settings.choose_realm', '-- Scegli un Regno --')}</option>
                         {availableRealms.map(r => <option key={`realm-${r}`} value={r}>{r}</option>)}
                       </select>
                    </div>

                    {selectedRealm && (
                      <div className="flex flex-col gap-1 animate-in slide-in-from-top-2">
                         <label className="text-[9px] text-slate-400 font-bold uppercase">{t('march_settings.step2_alliance', `2. Seleziona Alleanza in ${selectedRealm}`, { realm: selectedRealm })}</label>
                         <select 
                           value={selectedAlliance} onChange={e => setSelectedAlliance(e.target.value)}
                           className="w-full bg-slate-900 border border-emerald-900/50 rounded-lg p-2.5 text-emerald-300 text-xs font-bold outline-none cursor-pointer"
                         >
                           <option value="">{t('march_settings.choose_alliance', '-- Scegli un\'Alleanza --')}</option>
                           {availableAlliances.map(a => <option key={`all-${a}`} value={a}>{a}</option>)}
                         </select>
                      </div>
                    )}

                    {selectedAlliance && (
                      <div className="flex flex-col gap-1 animate-in slide-in-from-top-2">
                         <label className="text-[9px] text-slate-400 font-bold uppercase">{t('march_settings.step3_player', '3. Seleziona Giocatore')}</label>
                         <select 
                           value={selectedTarget?.isManual ? 'manual' : (selectedTarget?.uniqueKey || '')}
                           onChange={e => {
                             if (e.target.value === 'manual') setSelectedTarget({ id: '', name: 'Nuovo Giocatore', alliance: selectedAlliance, regno: selectedRealm, isManual: true });
                             else setSelectedTarget(availablePlayers.find(p => p.uniqueKey === e.target.value) || null);
                           }}
                           className="w-full bg-emerald-950 border border-emerald-500/50 rounded-lg p-2.5 text-emerald-300 text-xs font-bold outline-none cursor-pointer shadow-[0_0_10px_rgba(16,185,129,0.1)] focus:border-emerald-400"
                         >
                           <option value="">{t('march_settings.choose_player', '-- Scegli il Giocatore --')}</option>
                           {availablePlayers.map(p => <option key={p.uniqueKey} value={p.uniqueKey}>{p.name} (ID: {p.id})</option>)}
                           <option value="manual" className="text-amber-400 font-bold">{t('march_settings.create_manual_id', '➕ Crea Nuovo ID Manualmente')}</option>
                         </select>

                         {selectedTarget?.isManual && (
                            <div className="flex flex-col gap-1 mt-2 animate-in fade-in">
                               <input 
                                 type="text" placeholder={t('march_settings.manual_id_ph', "Digita l'ID esatto del giocatore...")}
                                 onChange={e => setSelectedTarget({...selectedTarget, id: e.target.value.trim(), name: e.target.value.trim()})}
                                 className="w-full bg-slate-900 border border-amber-500/50 rounded-lg p-2 text-white text-xs font-bold outline-none"
                               />
                            </div>
                         )}
                      </div>
                    )}
                 </div>
               )}
               <p className="text-[9px] text-slate-500 mt-2 border-t border-emerald-900/30 pt-2">{t('march_settings.consultant_warning', 'Se non selezioni alcun giocatore, l\'operazione avverrà sul tuo account personale.')}</p>
            </div>
          )}

          {selectedTarget ? (
             <div className="flex gap-3 mt-1">
               <button onClick={() => handleLoadTargetData && handleLoadTargetData(selectedTarget)} disabled={isLoading} className="flex-1 px-2 py-4 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-black uppercase tracking-widest rounded-xl transition-all shadow-[0_0_15px_rgba(79,70,229,0.4)] disabled:opacity-50 flex items-center justify-center gap-1.5">
                 {isLoading ? '...' : t('march_settings.load_data', '⬇️ Carica Dati')}
               </button>
               <button onClick={() => handleSaveToCloud(selectedTarget)} disabled={isLoading} className="flex-1 px-2 py-4 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black uppercase tracking-widest rounded-xl transition-all shadow-[0_0_15px_rgba(5,150,105,0.4)] disabled:opacity-50 flex items-center justify-center gap-1.5">
                 {isLoading ? '...' : t('march_settings.save_changes', '💾 Salva Modifiche')}
               </button>
             </div>
          ) : (
             <button onClick={() => handleSaveToCloud(null)} disabled={isLoading} className="w-full px-4 py-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-[0_0_20px_rgba(5,150,105,0.4)] disabled:opacity-50 flex items-center justify-center gap-2 mt-1">
               {isLoading ? t('march_builder.sync_saving') : `💾 ${t('march_builder.sync_save_btn')}`}
             </button>
          )}

        </div>
      </div>

      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-xl flex flex-col">
        <div className="p-5 border-b border-slate-800 bg-slate-900/80 cursor-pointer flex justify-between items-center" onClick={() => setIsArmyOpen(!isArmyOpen)}>
          <div>
            <h2 className="text-sm font-black text-cyan-400 uppercase tracking-widest">{t('march_builder.your_army_title')}</h2>
            <p className="text-[10px] text-slate-500 mt-1">{t('march_builder.manage_troops_desc')}</p>
          </div>
          <span className="text-xl opacity-70">{isArmyOpen ? '🔽' : '▶️'}</span>
        </div>
        
        {isArmyOpen && (
          <>
            <div className="flex bg-slate-950 p-2 border-b border-slate-800">
              <button onClick={() => setActiveTab('infantry')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${activeTab === 'infantry' ? 'bg-cyan-900/40 text-cyan-400 border border-cyan-500/50' : 'text-slate-500 hover:text-slate-300'}`}>{t('march_builder.inf_short')} <span className="text-[9px] opacity-70">({initInf.toLocaleString()})</span></button>
              <button onClick={() => setActiveTab('cavalry')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${activeTab === 'cavalry' ? 'bg-amber-900/40 text-amber-400 border border-amber-500/50' : 'text-slate-500 hover:text-slate-300'}`}>{t('march_builder.cav_short')} <span className="text-[9px] opacity-70">({initCav.toLocaleString()})</span></button>
              <button onClick={() => setActiveTab('archers')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${activeTab === 'archers' ? 'bg-rose-900/40 text-rose-400 border border-rose-500/50' : 'text-slate-500 hover:text-slate-300'}`}>{t('march_builder.arc_short')} <span className="text-[9px] opacity-70">({initArc.toLocaleString()})</span></button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[600px] custom-scrollbar">
              <div className="flex flex-col gap-2">
                {TIERS.map(tier => (
                  <div key={`${activeTab}-${tier}`} className="flex items-center justify-between bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-xs font-black text-slate-200 w-12">{tier}</span>
                    <input type="number" min="0" value={totalTroops[activeTab][tier] === 0 ? '' : totalTroops[activeTab][tier]} onChange={e => setTotalTroops(prev => ({...prev, [activeTab]: {...prev[activeTab], [tier]: Math.max(0, e.target.value==='' ? 0 : parseInt(e.target.value, 10))}}))} placeholder="0" className="w-32 bg-transparent text-right font-mono text-sm outline-none font-bold text-cyan-300" />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <HeroImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} ownedHeroes={ownedHeroes} setOwnedHeroes={setOwnedHeroes} t={t} heroesCatalog={heroesCatalog} />

    </div>
  );
}