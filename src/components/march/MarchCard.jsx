import React, { useState } from 'react';
import { heroesDB } from '../../data/heroes';

const isStatFlat = (statId) => ['march_capacity', 'rally_capacity'].includes(statId);

export default function MarchCard({ 
  t, // 📌 Assicurati che "t" venga passato dal padre MarchCreationView!
  march, index, totalMarchesCount, onDelete, onUpdateHero, 
  onUpdateTroopConfig, getAvailableHeroes, getHeroColor,
  selectedEvent, buffsCatalog = {}, playerBuffs = {}, activeAnimals = [],
  onApplyPreset
}) {
  const [activeSlot, setActiveSlot] = useState(null); 

  const statLabels = {
    atk: t('march_card.stat_atk', 'Attacco'), def: t('march_card.stat_def', 'Difesa'), hp: t('march_card.stat_hp', 'Salute'),
    march_capacity: t('march_card.stat_march_cap', 'Cap. Marcia'), rally_capacity: t('march_card.stat_rally_cap', 'Cap. Rally'), lethality: t('march_card.stat_lethality', 'Letalità'),
    enemy_hp_red: t('march_card.stat_enemy_hp_red', 'Salute Nem.'), march_speed: t('march_card.stat_march_speed', 'Velocità'), enemy_lethality_red: t('march_card.stat_enemy_lethality_red', 'Letalità Nem.')
  };

  const getHeroDetails = (heroId) => {
    if (!heroId) return null;
    return heroesDB.find(h => h.id === heroId) || { name: t('march_card.unknown_hero', 'Sconosciuto'), type: 'Fanteria' };
  };

  const h1 = getHeroDetails(march.hero1);
  const h2 = getHeroDetails(march.hero2);
  const h3 = getHeroDetails(march.hero3);

  const currentType = march.marchType || 'solo';
  const typeIcons = { 'infantry': '⚔️', 'cavalry': '🐎', 'archers': '🏹', 'Fanteria': '⚔️', 'Cavalleria': '🐎', 'Arcieri': '🏹' };

  const troopMode = march.troopConfig?.mode || 'percent';
  const isPercent = troopMode === 'percent';
  const tInf = march.troopConfig?.[troopMode]?.inf || 0;
  const tCav = march.troopConfig?.[troopMode]?.cav || 0;
  const tArc = march.troopConfig?.[troopMode]?.arc || 0;

  const realInf = march.realInf?.totalPulled || 0;
  const realCav = march.realCav?.totalPulled || 0;
  const realArc = march.realArc?.totalPulled || 0;
  const totalDeployed = realInf + realCav + realArc;
  
  const { baseCapacity = 0, bonusMarchCap = 0, bonusRallyCap = 0, currentMaxCapacity = 0, autoMaxCapacity = 0 } = march;

  const handleQuickPreset = (inf, cav, arc) => {
    if (onApplyPreset) {
      onApplyPreset(march.id, inf, cav, arc);
    } else {
      onUpdateTroopConfig(march.id, 'percent', 'inf', inf);
      onUpdateTroopConfig(march.id, 'percent', 'cav', cav);
      onUpdateTroopConfig(march.id, 'percent', 'arc', arc);
    }
  };

  const getBuffString = (b) => {
    let lvl = playerBuffs[b.id] || 0;
    
    let evs = [];
    if (b.applicableEvents) evs = evs.concat(Array.isArray(b.applicableEvents) ? b.applicableEvents : [b.applicableEvents]);
    if (b.events) evs = evs.concat(Array.isArray(b.events) ? b.events : [b.events]);
    if (b.event) evs = evs.concat(Array.isArray(b.event) ? b.event : [b.event]);
    if (b.targetEvent) evs = evs.concat(Array.isArray(b.targetEvent) ? b.targetEvent : [b.targetEvent]);
    const buffEvents = [...new Set(evs)].filter(Boolean);
    
    const isGeneral = b.isGeneral || buffEvents.length === 0;
    const isMaster = b.sourceCategory === 'master' || b.type === 'master';
    const isAutomatic = b.isFixedForEvent || isMaster || isGeneral;

    if (isAutomatic && lvl === 0) {
       lvl = Array.isArray(b.values) ? b.values.length : (b.values && Object.values(b.values)[0]?.length) || 1;
    }
    if (lvl === 0) return null;

    const targets = b.statTargets || (b.statTarget ? [b.statTarget] : ['atk']);
    let bonusStrings = [];
    targets.forEach(st => {
       const isOldFormat = Array.isArray(b.values);
       const val = isOldFormat ? b.values[lvl-1] : (b.values && b.values[st] ? b.values[st][lvl-1] : 0);
       
       const isDebuff = st.includes('enemy_') || st.includes('_red');
       const sign = isDebuff ? '-' : '+';

       if (val > 0) bonusStrings.push(`${sign}${val}${isStatFlat(st) ? '' : '%'} ${statLabels[st] || st}`);
    });
    return bonusStrings.length > 0 ? bonusStrings.join(', ') : null;
  };

  const activePassiveBuffs = Object.values(buffsCatalog).filter(b => {
    if (b.sourceCategory === 'animal' || b.type === 'animal') return false;
    
    let evs = [];
    if (b.applicableEvents) evs = evs.concat(Array.isArray(b.applicableEvents) ? b.applicableEvents : [b.applicableEvents]);
    if (b.applicableEvent) evs = evs.concat(Array.isArray(b.applicableEvent) ? b.applicableEvent : [b.applicableEvent]);
    if (b.events) evs = evs.concat(Array.isArray(b.events) ? b.events : [b.events]);
    if (b.event) evs = evs.concat(Array.isArray(b.event) ? b.event : [b.event]);
    if (b.targetEvent) evs = evs.concat(Array.isArray(b.targetEvent) ? b.targetEvent : [b.targetEvent]);
    
    const buffEvents = [...new Set(evs)].filter(Boolean).map(e => String(e).toLowerCase().replace(/[^a-z0-9]/g, ''));
    const normalizedSelected = String(selectedEvent).toLowerCase().replace(/[^a-z0-9]/g, '');
    
    const isGeneral = b.isGeneral || buffEvents.length === 0 || buffEvents.includes('all');
    const isForThisEvent = buffEvents.includes(normalizedSelected);
    
    if (!isGeneral && !isForThisEvent) return false;
    
    const isMaster = b.sourceCategory === 'master' || b.type === 'master';
    const isAutomatic = b.isFixedForEvent || isMaster;

    return (playerBuffs[b.id] > 0) || isAutomatic;
  });

  const activeAnimalBuffs = Object.values(buffsCatalog).filter(b => activeAnimals.includes(b.id));
  const allInfluences = [...activePassiveBuffs, ...activeAnimalBuffs];

  const renderHeroSlot = (slotKey, heroObj, slotLabel) => {
    const isOccupied = !!heroObj;
    return (
      <div onClick={() => setActiveSlot(slotKey)} className={`relative flex flex-col items-center justify-center h-32 rounded-2xl cursor-pointer transition-all duration-200 group ${isOccupied ? 'bg-slate-800 border-2 border-indigo-500/50 hover:border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.1)]' : 'bg-slate-900/50 border-2 border-dashed border-slate-700 hover:border-cyan-500/50 hover:bg-cyan-900/20'}`}>
        <div className="absolute top-0 left-0 right-0 bg-slate-950/60 text-[9px] font-black text-slate-400 text-center uppercase tracking-widest py-1 rounded-t-xl border-b border-slate-800/50">{slotLabel}</div>
        {isOccupied ? (
          <>
            {heroObj.image ? (
               <img src={heroObj.image} alt={heroObj.name} className="w-16 h-16 rounded-2xl object-cover mb-1 mt-4 shadow-[0_4px_10px_rgba(0,0,0,0.6)] pointer-events-none group-hover:scale-105 transition-transform" />
            ) : (
               <div className="text-3xl mb-1 mt-4 drop-shadow-lg group-hover:scale-110 transition-transform">{typeIcons[heroObj.type] || '❓'}</div>
            )}
            <div className="text-[11px] font-black text-white text-center leading-tight px-2 drop-shadow-md mt-1">{heroObj.name}</div>
            <button onClick={(e) => { e.stopPropagation(); onUpdateHero(march.id, slotKey, ''); }} className="absolute -top-2 -right-2 w-7 h-7 bg-rose-600 hover:bg-rose-500 text-white rounded-full flex items-center justify-center text-xs font-black shadow-lg border-2 border-slate-900 transition-colors opacity-0 group-hover:opacity-100" title={t('march_card.remove_hero', 'Rimuovi Eroe')}>✕</button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1 mt-4">
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 text-xl font-bold group-hover:text-cyan-400 group-hover:bg-cyan-900/50 transition-colors">+</div>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider group-hover:text-cyan-300">{t('march_card.assign', 'Assegna')}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-3xl p-5 md:p-6 shadow-xl relative overflow-hidden flex flex-col gap-6">
      
      <div className="flex flex-col gap-4 border-b border-slate-800 pb-4">
        <div className="flex justify-between items-center">
          <h3 className="text-sm md:text-base font-black text-cyan-400 uppercase tracking-widest flex items-center gap-2">
            <span className="bg-cyan-950 text-cyan-300 px-2 py-0.5 rounded-lg border border-cyan-800/50">#{index + 1}</span> {t('march_card.formation', 'Formazione')}
          </h3>
          {totalMarchesCount > 1 && (
            <button onClick={() => onDelete(march.id)} className="text-xs font-bold text-rose-500 hover:text-white bg-rose-950/30 hover:bg-rose-600 px-3 py-1.5 rounded-lg border border-rose-900/50 transition-colors">{t('march_card.delete_march', 'Elimina Marcia')}</button>
          )}
        </div>

        <div className="flex bg-slate-950/50 border border-slate-800 rounded-xl p-1">
          <button onClick={() => onUpdateHero(march.id, 'marchType', 'solo')} className={`flex-1 py-2 text-[10px] sm:text-xs font-black uppercase tracking-wider rounded-lg transition-all ${currentType === 'solo' ? 'bg-slate-700 text-white shadow-md' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}>{t('march_card.type_solo', '👤 Singola')}</button>
          <button onClick={() => onUpdateHero(march.id, 'marchType', 'rally_leader')} className={`flex-1 py-2 text-[10px] sm:text-xs font-black uppercase tracking-wider rounded-lg transition-all ${currentType === 'rally_leader' ? 'bg-amber-700 text-white shadow-md' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}>{t('march_card.type_rally_leader', '👑 Leader Rally')}</button>
          <button onClick={() => onUpdateHero(march.id, 'marchType', 'rally_joiner')} className={`flex-1 py-2 text-[10px] sm:text-xs font-black uppercase tracking-wider rounded-lg transition-all ${currentType === 'rally_joiner' ? 'bg-blue-700 text-white shadow-md' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}>{t('march_card.type_rally_joiner', '🛡️ Gregario')}</button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 md:gap-4">
        {renderHeroSlot('hero1', h1, t('march_card.slot_leader', 'Leader (Eroe 1)'))}
        {renderHeroSlot('hero2', h2, t('march_card.slot_support2', 'Supporto (Eroe 2)'))}
        {renderHeroSlot('hero3', h3, t('march_card.slot_support3', 'Supporto (Eroe 3)'))}
      </div>

      <div className="bg-slate-950/50 border border-indigo-900/30 rounded-xl p-3 flex flex-col gap-2">
         <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1">{t('march_card.active_buffs', '🌟 Buff Attivi in questa Marcia')}</span>
         {allInfluences.length === 0 ? (
           <span className="text-xs text-slate-500 italic">{t('march_card.no_buffs', 'Nessun buff globale o animale attivo per questo evento.')}</span>
         ) : (
           <div className="flex flex-wrap gap-2">
              {allInfluences.map(b => {
                 const statsStr = getBuffString(b);
                 if(!statsStr) return null;
                 return (
                   <div key={b.id} className="bg-slate-900 border border-slate-700 px-2.5 py-1 rounded-md flex items-center gap-1.5 shadow-sm">
                      <span className="text-xs">{b.sourceCategory === 'animal' ? '🐾' : '🏛️'}</span>
                      <span className="text-[10px] font-bold text-slate-300">{b.sourceDetail || b.name}:</span>
                      <span className="text-[10px] font-black text-emerald-400">{statsStr}</span>
                   </div>
                 );
              })}
           </div>
         )}
      </div>

      <div className="bg-slate-950 rounded-2xl border border-slate-800 p-4 flex flex-col gap-4">
        <div className="flex justify-between items-start md:items-center border-b border-slate-800/50 pb-3 flex-col md:flex-row gap-3">
          
          <div className="flex flex-col">
            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{t('march_card.troop_assignment', 'Assegnazione Truppe')}</span>
            
            <div className="flex items-center gap-1.5 mt-1">
               <span className="text-[10px] text-slate-500">{t('march_card.sent', 'Inviato:')}</span>
               <span className={`text-[10px] font-black ${totalDeployed < currentMaxCapacity ? 'text-amber-400' : 'text-emerald-400'}`}>
                 {totalDeployed.toLocaleString()}
               </span>
               <span className="text-[10px] text-slate-500">/</span>
               
               <div className="relative group flex items-center">
                 <input 
                   type="number" 
                   min="0"
                   value={march.customCapacity || ''} 
                   onChange={(e) => onUpdateHero(march.id, 'customCapacity', e.target.value === '' ? 0 : Number(e.target.value))}
                   placeholder={autoMaxCapacity.toString()}
                   className={`w-20 bg-slate-950 border ${march.customCapacity > 0 ? 'border-amber-500 text-amber-300' : 'border-slate-700 text-slate-200'} hover:border-indigo-500 focus:border-indigo-400 text-[10px] font-bold px-2 py-1 rounded outline-none transition-colors text-center placeholder-slate-600`}
                   title={t('march_card.tooltip_edit_cap', "Modifica manualmente il limite di questa marcia")}
                 />
                 {march.customCapacity > 0 && (
                    <button 
                      onClick={() => onUpdateHero(march.id, 'customCapacity', 0)}
                      className="absolute -right-5 text-[10px] text-rose-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      title={t('march_card.tooltip_reset_cap', "Reimposta limite originale")}
                    >✕</button>
                 )}
               </div>
            </div>

            {march.customCapacity > 0 ? (
               <span className="text-[9px] text-amber-500 font-bold mt-1">
                 {t('march_card.warning_reduced_cap', `⚠️ Limite ridotto (Max originale: ${autoMaxCapacity.toLocaleString()})`, { max: autoMaxCapacity.toLocaleString() })}
               </span>
            ) : (
               bonusMarchCap > 0 && (
                 <span className="text-[9px] text-emerald-500 font-bold mt-1">
                   {t('march_card.base_cap', `(Base: ${baseCapacity.toLocaleString()} + Buff: ${bonusMarchCap.toLocaleString()})`, { base: baseCapacity.toLocaleString(), buff: bonusMarchCap.toLocaleString() })}
                 </span>
               )
            )}
            
            {currentType === 'rally_leader' && bonusRallyCap > 0 && (
               <span className="text-[9px] text-indigo-400 font-bold mt-0.5">
                 {t('march_card.bonus_rally_cap', `👑 Bonus Cap. Rally: +${bonusRallyCap.toLocaleString()}`, { bonus: bonusRallyCap.toLocaleString() })}
               </span>
            )}
          </div>

          <div className="flex flex-col items-end gap-2 w-full md:w-auto shrink-0">
            <div className="flex bg-slate-900 border border-slate-700 rounded-lg overflow-hidden w-full md:w-auto">
              <button onClick={() => onUpdateTroopConfig(march.id, 'mode', null, 'percent')} className={`flex-1 md:flex-none px-3 py-1.5 text-[10px] font-bold uppercase transition-colors ${isPercent ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>{t('march_card.mode_percent', 'Percentuale %')}</button>
              <button onClick={() => onUpdateTroopConfig(march.id, 'mode', null, 'manual')} className={`flex-1 md:flex-none px-3 py-1.5 text-[10px] font-bold uppercase transition-colors ${!isPercent ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>{t('march_card.mode_manual', 'Manuale #')}</button>
            </div>
            
            {isPercent && (
              <div className="flex items-center gap-1.5 w-full md:w-auto justify-end">
                 <span className="text-[9px] text-slate-500 font-bold uppercase mr-1">{t('march_card.preset', 'Preset:')}</span>
                 <button onClick={() => handleQuickPreset(50, 20, 30)} className="px-2 py-1 bg-indigo-950/40 hover:bg-indigo-600 text-indigo-300 hover:text-white text-[9px] font-black rounded border border-indigo-900/50 transition-colors shadow-sm">50-20-30</button>
                 <button onClick={() => handleQuickPreset(60, 40, 0)} className="px-2 py-1 bg-indigo-950/40 hover:bg-indigo-600 text-indigo-300 hover:text-white text-[9px] font-black rounded border border-indigo-900/50 transition-colors shadow-sm">60-40-0</button>
                 <button onClick={() => handleQuickPreset(10, 10, 80)} className="px-2 py-1 bg-indigo-950/40 hover:bg-indigo-600 text-indigo-300 hover:text-white text-[9px] font-black rounded border border-indigo-900/50 transition-colors shadow-sm">10-10-80</button>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
           <div className="flex flex-col bg-slate-900 rounded-xl border border-slate-800 p-3 focus-within:border-cyan-500 transition-colors relative">
              <span className="text-[10px] font-bold text-cyan-500 uppercase flex items-center gap-1 mb-1"><span className="text-sm">⚔️</span> {t('march_card.target_inf', 'Target Fanteria')}</span>
              <div className="flex items-center">
                 <input type="number" min="0" value={tInf === 0 ? '' : tInf} onChange={e => onUpdateTroopConfig(march.id, troopMode, 'inf', Number(e.target.value))} className="w-full bg-transparent text-white font-mono text-lg font-black outline-none placeholder-slate-700" placeholder="0" />
                 {isPercent && <span className="text-slate-500 font-bold">%</span>}
              </div>
              <div className="mt-2 pt-2 border-t border-slate-800/50 flex justify-between items-center">
                 <span className="text-[9px] text-slate-500 font-bold uppercase">{t('march_card.real_troops', 'Truppe Reali:')}</span>
                 <span className="text-xs font-black text-cyan-300">{realInf.toLocaleString()}</span>
              </div>
           </div>
           
           <div className="flex flex-col bg-slate-900 rounded-xl border border-slate-800 p-3 focus-within:border-amber-500 transition-colors relative">
              <span className="text-[10px] font-bold text-amber-500 uppercase flex items-center gap-1 mb-1"><span className="text-sm">🐎</span> {t('march_card.target_cav', 'Target Cavalleria')}</span>
              <div className="flex items-center">
                 <input type="number" min="0" value={tCav === 0 ? '' : tCav} onChange={e => onUpdateTroopConfig(march.id, troopMode, 'cav', Number(e.target.value))} className="w-full bg-transparent text-white font-mono text-lg font-black outline-none placeholder-slate-700" placeholder="0" />
                 {isPercent && <span className="text-slate-500 font-bold">%</span>}
              </div>
              <div className="mt-2 pt-2 border-t border-slate-800/50 flex justify-between items-center">
                 <span className="text-[9px] text-slate-500 font-bold uppercase">{t('march_card.real_troops', 'Truppe Reali:')}</span>
                 <span className="text-xs font-black text-amber-300">{realCav.toLocaleString()}</span>
              </div>
           </div>

           <div className="flex flex-col bg-slate-900 rounded-xl border border-slate-800 p-3 focus-within:border-rose-500 transition-colors relative">
              <span className="text-[10px] font-bold text-rose-500 uppercase flex items-center gap-1 mb-1"><span className="text-sm">🏹</span> {t('march_card.target_arc', 'Target Arcieri')}</span>
              <div className="flex items-center">
                 <input type="number" min="0" value={tArc === 0 ? '' : tArc} onChange={e => onUpdateTroopConfig(march.id, troopMode, 'arc', Number(e.target.value))} className="w-full bg-transparent text-white font-mono text-lg font-black outline-none placeholder-slate-700" placeholder="0" />
                 {isPercent && <span className="text-slate-500 font-bold">%</span>}
              </div>
              <div className="mt-2 pt-2 border-t border-slate-800/50 flex justify-between items-center">
                 <span className="text-[9px] text-slate-500 font-bold uppercase">{t('march_card.real_troops', 'Truppe Reali:')}</span>
                 <span className="text-xs font-black text-rose-300">{realArc.toLocaleString()}</span>
              </div>
           </div>
        </div>
      </div>

      {activeSlot && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
           <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-3xl flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                 <div>
                   <h3 className="text-lg font-black text-white">{t('march_card.select_hero_title', 'Seleziona Eroe')}</h3>
                   <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-0.5">{t('march_card.select_hero_desc', `Scegli chi schierare nello slot ${activeSlot === 'hero1' ? 'Leader' : 'Supporto'}`, { slot: activeSlot === 'hero1' ? 'Leader' : 'Supporto' })}</p>
                 </div>
                 <button onClick={() => setActiveSlot(null)} className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white hover:bg-rose-600 transition-colors font-bold flex items-center justify-center">✕</button>
              </div>

              <div className="p-5 overflow-y-auto max-h-[60vh] custom-scrollbar bg-[#090e17]">
                 {getAvailableHeroes(march, activeSlot).length === 0 ? (
                    <div className="text-center py-10 flex flex-col items-center justify-center gap-3">
                       <span className="text-4xl">📭</span>
                       <p className="text-slate-400 font-bold text-sm">{t('march_card.no_hero_avail', 'Nessun eroe disponibile per questo slot.')}</p>
                       <p className="text-[10px] text-slate-500 mt-1">{t('march_card.no_hero_reason', "Un tipo di truppa (Fanteria, Cavalleria, Arcieri) è già presente in questa marcia o l'eroe è usato altrove.")}</p>
                    </div>
                 ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                       {getAvailableHeroes(march, activeSlot).map(hero => {
                          const staticData = getHeroDetails(hero.id);
                          return (
                            <div key={hero.id} onClick={() => { onUpdateHero(march.id, activeSlot, hero.id); setActiveSlot(null); }} className="bg-slate-800 border border-slate-700 hover:border-indigo-500 rounded-2xl p-3 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-slate-800/80 transition-all hover:-translate-y-1 shadow-lg group">
                               {staticData.image ? (
                                  <img src={staticData.image} alt={hero.name} className="w-14 h-14 rounded-2xl object-cover shadow-[0_4px_10px_rgba(0,0,0,0.5)] group-hover:scale-110 transition-transform" />
                               ) : (
                                  <div className="text-4xl drop-shadow-md group-hover:scale-110 transition-transform">{typeIcons[staticData.type] || '❓'}</div>
                               )}
                               <div className="text-center w-full">
                                  <div className="text-xs font-black text-white truncate w-full" title={hero.name}>{hero.name}</div>
                                  <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                                    {staticData.type === 'infantry' ? t('march_builder.infantry', 'Fanteria') : staticData.type === 'cavalry' ? t('march_builder.cavalry', 'Cavalleria') : staticData.type === 'archers' ? t('march_builder.archers', 'Arcieri') : staticData.type}
                                  </div>
                               </div>
                            </div>
                          );
                       })}
                    </div>
                 )}
              </div>
           </div>
        </div>
      )}
    </div>
  );
}