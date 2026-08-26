import React from 'react';
import { eventTypes } from '../../data/heroes';

const isStatFlat = (statId) => ['march_capacity', 'rally_capacity'].includes(statId);

export default function MarchBuffsSettings({ 
  t, playerBuffs, handleBuffChange, buffsCatalog, isAdmin, onOpenAdminModal
}) {
  const allBuffs = Object.values(buffsCatalog || {});
  
  const masterBuffs = allBuffs.filter(b => b.sourceCategory === 'master');
  const animalBuffs = allBuffs.filter(b => b.sourceCategory === 'animal');
  const globalBuffs = allBuffs.filter(b => !b.sourceCategory || b.sourceCategory === 'global');

  const renderBuffCard = (buff) => {
    const isMaster = buff.sourceCategory === 'master';
    const isFixed = buff.isFixedForEvent && !isMaster;
    
    let maxLvl = buff.maxLevel || 0;
    if (!maxLvl && buff.values) {
       maxLvl = Array.isArray(buff.values) ? buff.values.length : (Object.values(buff.values)[0]?.length || 0);
    }
    const currentVal = isFixed ? maxLvl : (playerBuffs[buff.id] || 0);
    const targets = buff.statTargets || (buff.statTarget ? [buff.statTarget] : ['atk']);
    const events = buff.targetEvents || (buff.targetEvent ? [buff.targetEvent] : ['all']);

    return (
      <div key={buff.id} className={`bg-slate-950 border p-4 rounded-xl flex flex-col justify-between gap-3 ${isFixed ? 'border-cyan-500/40 bg-cyan-950/20' : 'border-slate-800 focus-within:border-amber-500/50 transition-colors'}`}>
        <div className="flex flex-col gap-1.5">
           <div className="flex items-center justify-between">
              <span className="text-[10px] text-amber-400 font-black uppercase tracking-wider">{buff.name}</span>
              {isFixed && <span className="text-[9px] bg-cyan-950 text-cyan-400 border border-cyan-500/40 px-2 py-0.5 rounded uppercase font-black">🔒 {t('march_buffs.badge_fixed', 'Fisso')}</span>}
           </div>
           
           <div className="flex flex-wrap gap-1 mt-1">
             {events.includes('all') ? (
               <span className="text-[9px] text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700">🌐 {t('march_buffs.all_events', 'Tutti gli eventi')}</span>
             ) : (
               events.map(evId => {
                  const evObj = eventTypes.find(e => e.id === evId);
                  return <span key={evId} className="text-[9px] text-cyan-300 bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-900/50">📍 {evObj ? evObj.name : evId}</span>;
               })
             )}
           </div>

           <p className="text-[10px] text-slate-400 leading-relaxed line-clamp-2" title={buff.description}>{buff.description}</p>
        </div>

        <div className="flex items-center justify-between border-t border-slate-900 pt-3 mt-1">
          <span className="text-[10px] text-slate-500 font-bold uppercase">{isFixed ? t('march_buffs.lbl_activation', 'Attivazione') : t('march_buffs.lbl_level', `Livello (0 - ${maxLvl})`, { max: maxLvl })}</span>
          
          {isFixed ? (
            <span className="text-xs font-black text-cyan-400 uppercase tracking-wider">{t('march_buffs.max_lvl', `Max Lv. ${maxLvl}`, { max: maxLvl })}</span>
          ) : (
            <select 
              value={currentVal} 
              onChange={(e) => handleBuffChange(buff.id, Number(e.target.value))} 
              className="bg-slate-900 border border-slate-700 text-amber-300 text-[11px] font-bold px-2 py-1.5 rounded-lg outline-none focus:border-amber-500 cursor-pointer max-w-[200px]"
            >
              {Array.from({ length: maxLvl + 1 }, (_, i) => {
                if (i === 0) return <option key={i} value={0}>{t('march_buffs.disabled', 'Disattivo (0)')}</option>;
                
                let bonusStrings = [];
                targets.forEach(st => {
                   const isOldFormat = Array.isArray(buff.values);
                   const val = isOldFormat ? buff.values[i-1] : (buff.values[st] ? buff.values[st][i-1] : 0);
                   const isDebuff = st.includes('enemy_') || st.includes('_red');
                   const sign = isDebuff ? '-' : '+';
                   
                   if (val > 0) bonusStrings.push(`${sign}${val}${isStatFlat(st) ? '' : '%'}`);
                });
                const comboString = bonusStrings.length > 0 ? ` (${bonusStrings.join(', ')})` : '';

                return <option key={i} value={i}>{t('march_buffs.lv_format', `Lv. ${i}${comboString}`, { num: i, combo: comboString })}</option>;
              })}
            </select>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl shadow-xl flex flex-col gap-6">
      <div className="border-b border-slate-800 pb-3 flex justify-between items-center">
        <div>
          <h2 className="text-sm font-black text-amber-400 uppercase tracking-widest flex items-center gap-2">
            <span>⚡</span> {t('march_buffs.title', 'Inventario Buff')}
          </h2>
          <p className="text-[10px] text-slate-500 leading-tight mt-1">{t('march_buffs.desc', 'Configura i livelli dei buff che hai sbloccato nel gioco.')}</p>
        </div>
       {isAdmin && (
          <button onClick={onOpenAdminModal} className="px-3 py-1.5 bg-slate-900 hover:bg-amber-900 text-amber-400 font-bold text-[10px] uppercase rounded-lg border border-amber-500/30 transition-colors">
            ✏️ {t('march_buffs.admin_btn', 'Gestisci Database Buff')}
          </button>
        )}
      </div>

      <div className="flex flex-col gap-6">
        {masterBuffs.length > 0 && (
          <div className="flex flex-col gap-3">
             <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest border-b border-indigo-900/50 pb-1">{t('march_buffs.masters', '🧙‍♂️ Buff dai Maestri')}</h3>
             <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
               {masterBuffs.map(renderBuffCard)}
             </div>
          </div>
        )}

        {animalBuffs.length > 0 && (
          <div className="flex flex-col gap-3">
             <h3 className="text-xs font-black text-emerald-400 uppercase tracking-widest border-b border-emerald-900/50 pb-1">{t('march_buffs.animals', '🐾 Buff dagli Animali')}</h3>
             <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
               {animalBuffs.map(renderBuffCard)}
             </div>
          </div>
        )}

        {globalBuffs.length > 0 && (
          <div className="flex flex-col gap-3">
             <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-1">{t('march_buffs.global', '🌐 Buff Generali e Ricerche')}</h3>
             <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
               {globalBuffs.map(renderBuffCard)}
             </div>
          </div>
        )}

        {allBuffs.length === 0 && (
          <p className="text-xs text-slate-500 italic">{t('march_buffs.no_buffs', 'Nessun buff presente nel database.')}</p>
        )}
      </div>
    </div>
  );
}