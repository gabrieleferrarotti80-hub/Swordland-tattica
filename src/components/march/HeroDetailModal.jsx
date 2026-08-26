import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export default function HeroDetailModal({ 
  hero, 
  heroData, 
  onClose, 
  onSave, 
  getHeroColor 
}) {
  const { t } = useTranslation();

  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    level: 1,
    stars: 0,
    starFragments: 0,
    power: 0,
    troopCapacity: 0,
    gear: {
      helmet: { level: 0, power: 0, isRed: false },
      armor: { level: 0, power: 0, isRed: false },
      gloves: { level: 0, power: 0, isRed: false },
      boots: { level: 0, power: 0, isRed: false }
    },
    exclusive: 0,
    stats: {
      conquest: { heroAtk: 0, heroDef: 0, heroHp: 0, escortAtk: 0, escortDef: 0, escortHp: 0 },
      expedition: { troopAtk: 0, troopDef: 0, troopLethality: 0, troopHp: 0 }
    }
  });

  useEffect(() => {
    if (heroData) {
      const migratedGear = { ...heroData.gear };
      ['helmet', 'armor', 'gloves', 'boots'].forEach(piece => {
        if (typeof migratedGear[piece] === 'number') {
          migratedGear[piece] = { level: migratedGear[piece], power: 0, isRed: false };
        } else if (!migratedGear[piece]) {
          migratedGear[piece] = { level: 0, power: 0, isRed: false };
        } else {
          migratedGear[piece].isRed = migratedGear[piece].isRed || false;
        }
      });

      setFormData({
        ...heroData,
        starFragments: heroData.starFragments || 0,
        gear: migratedGear,
        stats: heroData.stats || {
          conquest: { heroAtk: 0, heroDef: 0, heroHp: 0, escortAtk: 0, escortDef: 0, escortHp: 0 },
          expedition: { troopAtk: 0, troopDef: 0, troopLethality: 0, troopHp: 0 }
        }
      });
    }
  }, [heroData]);

  if (!hero) return null;

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: Number(value) }));
  };

  const handleGearChange = (gearType, field, value) => {
    setFormData(prev => ({
      ...prev,
      gear: { 
        ...prev.gear, 
        [gearType]: {
           ...prev.gear[gearType],
           [field]: field === 'isRed' ? value : Number(value)
        } 
      }
    }));
  };

  const handleStatChange = (group, field, value) => {
    setFormData(prev => ({
      ...prev,
      stats: {
        ...prev.stats,
        [group]: {
          ...prev.stats[group],
          [field]: Number(value)
        }
      }
    }));
  };

  const handleSaveClick = () => {
    onSave(hero.id, formData);
  };

  const getTranslatedType = (type) => {
    if (type === 'Fanteria') return t('march_builder.infantry', 'Fanteria');
    if (type === 'Cavalleria') return t('march_builder.cavalry', 'Cavalleria');
    return t('march_builder.archers', 'Arcieri');
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.7)] w-full max-w-2xl flex flex-col overflow-hidden">
        
        {/* HEADER */}
        <div className="flex justify-between items-center p-4 border-b border-slate-800 bg-slate-800/50">
          <div className="flex items-center gap-3">
            <span className="text-4xl drop-shadow-md">
              {hero.type === 'Fanteria' ? '⚔️' : hero.type === 'Cavalleria' ? '🐎' : '🏹'}
            </span>
            <div className="flex flex-col items-start gap-1">
              <div className="flex items-center gap-2">
                <h2 className={`text-xl font-black ${getHeroColor(hero.rarity)}`}>{hero.name}</h2>
                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border shadow-sm ${
                  hero.type === 'Fanteria' ? 'bg-cyan-900/50 text-cyan-400 border-cyan-500/50' : 
                  hero.type === 'Cavalleria' ? 'bg-amber-900/50 text-amber-400 border-amber-500/50' : 
                  'bg-rose-900/50 text-rose-400 border-rose-500/50'
                }`}>
                  {getTranslatedType(hero.type)}
                </span>
              </div>
              <span className="text-[11px] text-slate-400 uppercase tracking-wider font-bold">
                Gen {hero.gen} • {hero.rarity}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:bg-rose-900 hover:text-rose-400 transition-colors font-bold shrink-0">✕</button>
        </div>

        {/* BODY */}
        <div className="p-5 flex flex-col gap-6 overflow-y-auto custom-scrollbar max-h-[75vh]">
          
          {/* STATS GENERALI & STELLE */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col gap-4">
             <h3 className="text-xs font-black text-cyan-400 uppercase tracking-widest border-b border-slate-800 pb-2">{t('hero_detail.base_stats', 'Statistiche Base & Risveglio')}</h3>
             
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                <div className="flex flex-col">
                  <label className="text-[10px] text-slate-500 font-bold mb-1 uppercase">{t('hero_detail.level', 'Livello')}</label>
                  <input type="number" min="1" max="150" value={formData.level} onChange={e => handleChange('level', e.target.value)} className="bg-slate-900 border border-slate-700 rounded p-2 text-white focus:border-cyan-500 outline-none" />
                </div>
                
                <div className="flex flex-col">
                  <label className="text-[10px] text-slate-500 font-bold mb-1 uppercase">{t('hero_detail.power', 'Potere')}</label>
                  <input type="number" value={formData.power} onChange={e => handleChange('power', e.target.value)} className="bg-slate-900 border border-slate-700 rounded p-2 text-white focus:border-cyan-500 outline-none" />
                </div>
                
                <div className="flex flex-col col-span-2 md:col-span-2 min-w-0">
                  <label className="text-[10px] text-slate-500 font-bold mb-1 uppercase truncate">{t('hero_detail.troop_capacity', 'Capacità Truppe')}</label>
                  <div className="flex gap-2 w-full">
                    <input type="number" value={formData.troopCapacity} onChange={e => handleChange('troopCapacity', e.target.value)} className="w-full min-w-0 bg-slate-900 border border-slate-700 rounded p-2 text-white focus:border-cyan-500 outline-none" />
                    <button onClick={() => setIsStatsModalOpen(true)} className="shrink-0 px-3 md:px-4 bg-indigo-900/50 hover:bg-indigo-600 text-indigo-300 hover:text-white rounded border border-indigo-700/50 transition-all flex items-center justify-center gap-2 shadow-sm font-bold text-xs" title={t('hero_detail.general_stats_title', "Statistiche generali dell'Eroe")}>
                      📋 <span className="hidden md:inline uppercase tracking-wider">{t('hero_detail.general_stats_btn', 'Stats')}</span>
                    </button>
                  </div>
                </div>
             </div>

             <div className="grid grid-cols-2 gap-4 border-t border-slate-800/50 pt-3">
                <div className="flex flex-col">
                  <label className="text-[10px] text-amber-500 font-bold mb-1 uppercase flex items-center gap-1">⭐ {t('hero_detail.stars', 'Stelle Complete')}</label>
                  <select value={formData.stars} onChange={e => handleChange('stars', e.target.value)} className="bg-slate-900 border border-slate-700 rounded p-2 text-white focus:border-amber-500 outline-none">
                    {[0,1,2,3,4,5].map(s => <option key={`star-${s}`} value={s}>{s} {s === 1 ? 'Stella' : 'Stelle'}</option>)}
                  </select>
                </div>
                <div className="flex flex-col">
                  <label className="text-[10px] text-amber-500 font-bold mb-1 uppercase flex items-center gap-1">🧩 {t('hero_detail.star_fragments', 'Frammenti (0-5)')}</label>
                  <select value={formData.starFragments} onChange={e => handleChange('starFragments', e.target.value)} className="bg-slate-900 border border-slate-700 rounded p-2 text-white focus:border-amber-500 outline-none">
                    {[0,1,2,3,4,5].map(f => <option key={`frag-${f}`} value={f}>{f} / 6</option>)}
                  </select>
                </div>
             </div>
          </div>

          {/* EQUIPAGGIAMENTO AVANZATO */}
          <div className="bg-slate-950 p-4 rounded-xl border border-amber-900/30 flex flex-col gap-3">
             <h3 className="text-xs font-black text-amber-400 uppercase tracking-widest border-b border-slate-800 pb-2 flex items-center gap-2"><span>🛡️</span> {t('hero_detail.gear', 'Equipaggiamento')}</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                {[
                  { id: 'helmet', label: t('hero_detail.gear_helmet', 'Elmo'), icon: '🪖' },
                  { id: 'armor', label: t('hero_detail.gear_armor', 'Armatura'), icon: '👕' },
                  { id: 'gloves', label: t('hero_detail.gear_gloves', 'Guanti'), icon: '🧤' },
                  { id: 'boots', label: t('hero_detail.gear_boots', 'Stivali'), icon: '🥾' }
                ].map(item => {
                  const isRed = formData.gear[item.id].isRed;
                  
                  return (
                    <div key={item.id} className={`flex flex-col p-3 rounded-xl border transition-all duration-300 ${isRed ? 'bg-rose-950/20 border-rose-600/50 shadow-[0_0_15px_rgba(225,29,72,0.15)]' : 'bg-slate-900 border-slate-800'}`}>
                      
                      <div className="flex justify-between items-center mb-3">
                        <label className={`text-[10px] font-bold uppercase flex items-center gap-1 ${isRed ? 'text-rose-400' : 'text-slate-400'}`}>
                          <span>{item.icon}</span> {item.label}
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer group">
                          <span className={`text-[9px] uppercase font-black tracking-wider transition-colors ${isRed ? 'text-rose-500' : 'text-slate-600 group-hover:text-slate-400'}`}>{t('hero_detail.is_red_gear', 'Rosso')}</span>
                          <input type="checkbox" checked={isRed} onChange={e => handleGearChange(item.id, 'isRed', e.target.checked)} className="accent-rose-500 w-3.5 h-3.5 cursor-pointer" />
                        </label>
                      </div>

                      <div className="flex gap-2">
                        <div className="flex-1 flex flex-col">
                            <span className="text-[9px] text-slate-500 uppercase mb-1">Livello</span>
                            <div className="flex items-center gap-1">
                              <span className={`text-xs px-1.5 py-1.5 rounded font-bold ${isRed ? 'bg-rose-900/40 text-rose-400' : 'bg-slate-800 text-slate-500'}`}>Lv.</span>
                              <input type="number" min="0" max="10" value={formData.gear[item.id].level} onChange={e => handleGearChange(item.id, 'level', e.target.value)} className={`w-full border rounded p-1.5 text-white outline-none font-bold ${isRed ? 'bg-rose-950/50 border-rose-900/50 focus:border-rose-500 text-rose-100' : 'bg-slate-950 border-slate-700 focus:border-amber-500'}`} />
                            </div>
                        </div>
                        <div className="flex-1 flex flex-col">
                            <span className="text-[9px] text-emerald-500 uppercase mb-1">Potenza</span>
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-emerald-500 bg-emerald-900/30 font-bold px-1.5 py-1.5 rounded">+</span>
                              <input type="number" min="0" max="100" value={formData.gear[item.id].power} onChange={e => handleGearChange(item.id, 'power', e.target.value)} className={`w-full border rounded p-1.5 text-emerald-400 font-black outline-none ${isRed ? 'bg-rose-950/50 border-rose-900/50 focus:border-emerald-500' : 'bg-slate-950 border-slate-700 focus:border-emerald-500'}`} />
                            </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
             </div>
          </div>

          {/* ARMA ESCLUSIVA */}
          <div className="bg-slate-950 p-4 rounded-xl border border-fuchsia-900/30 flex flex-col gap-3">
             <h3 className="text-xs font-black text-fuchsia-400 uppercase tracking-widest border-b border-slate-800 pb-2 flex items-center gap-2"><span>✨</span> {t('hero_detail.exclusive_weapon', 'Arma Esclusiva')}</h3>
             <div className="flex flex-col mt-2">
                  <label className="text-[10px] text-slate-500 font-bold mb-1 uppercase">{t('hero_detail.exclusive_level', 'Livello Esclusiva (es. +4)')}</label>
                  <div className="flex items-center gap-2">
                     <span className="text-sm font-bold text-fuchsia-500">+</span>
                     <input type="number" min="0" value={formData.exclusive} onChange={e => handleChange('exclusive', e.target.value)} className="w-24 bg-slate-900 border border-slate-700 rounded p-2 text-white focus:border-fuchsia-500 outline-none font-bold" />
                  </div>
             </div>
          </div>

        </div>

        {/* FOOTER */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white uppercase transition-colors">
            {t('common.cancel', 'Annulla')}
          </button>
          <button onClick={handleSaveClick} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg">
            {t('common.save', 'Salva Configurazione')}
          </button>
        </div>
      </div>

      {/* MODALE SOVRAPPOSTO: STATISTICHE GENERALI DELL'EROE */}
      {isStatsModalOpen && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
            
            <div className="p-4 border-b border-slate-800 bg-slate-800/50 flex justify-between items-center">
               <h3 className="text-lg font-black text-white flex items-center gap-2">📋 {t('hero_detail.general_stats_title', "Statistiche generali dell'Eroe")}</h3>
               <button onClick={() => setIsStatsModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:bg-rose-900 hover:text-rose-400 transition-colors font-bold">✕</button>
            </div>
            
            <div className="p-5 flex flex-col gap-6 overflow-y-auto max-h-[60vh] custom-scrollbar">
               
               <div>
                  <h4 className="text-xs font-black text-amber-500 uppercase tracking-widest mb-3 border-b border-slate-800 pb-2">{t('hero_detail.conquest', 'Conquista')}</h4>
                  <div className="grid grid-cols-2 gap-4">
                     {[
                       { id: 'heroAtk', label: t('hero_detail.hero_atk', "Attacco dell'eroe") },
                       { id: 'heroDef', label: t('hero_detail.hero_def', "Difesa dell'eroe") },
                       { id: 'heroHp', label: t('hero_detail.hero_hp', "Salute dell'eroe") },
                       { id: 'escortAtk', label: t('hero_detail.escort_atk', "Attacco della Scorta") },
                       { id: 'escortDef', label: t('hero_detail.escort_def', "Difesa della Scorta") },
                       { id: 'escortHp', label: t('hero_detail.escort_hp', "Salute della Scorta") }
                     ].map(stat => (
                       <div key={stat.id} className="flex flex-col">
                          <label className="text-[10px] text-slate-400 font-bold mb-1 truncate">{stat.label}</label>
                          <input type="number" min="0" value={formData.stats.conquest[stat.id]} onChange={e => handleStatChange('conquest', stat.id, e.target.value)} className="bg-slate-950 border border-slate-700 rounded p-1.5 text-white font-mono outline-none focus:border-amber-500" />
                       </div>
                     ))}
                  </div>
               </div>

               <div>
                  <h4 className="text-xs font-black text-cyan-500 uppercase tracking-widest mb-3 border-b border-slate-800 pb-2">{t('hero_detail.expedition', 'Spedizione')}</h4>
                  <div className="grid grid-cols-2 gap-4">
                     {[
                       { id: 'troopAtk', label: t('hero_detail.troop_atk', `Attacco ${getTranslatedType(hero.type).toLowerCase()}`) },
                       { id: 'troopDef', label: t('hero_detail.troop_def', `Difesa ${getTranslatedType(hero.type).toLowerCase()}`) },
                       { id: 'troopLethality', label: t('hero_detail.troop_lethality', `Letalità ${getTranslatedType(hero.type).toLowerCase()}`) },
                       { id: 'troopHp', label: t('hero_detail.troop_hp', `Salute ${getTranslatedType(hero.type).toLowerCase()}`) }
                     ].map(stat => (
                       <div key={stat.id} className="flex flex-col">
                          <label className="text-[10px] text-slate-400 font-bold mb-1 truncate">{stat.label}</label>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-cyan-500 font-bold">+</span>
                            <input type="number" step="0.01" min="0" value={formData.stats.expedition[stat.id]} onChange={e => handleStatChange('expedition', stat.id, e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-cyan-400 font-mono outline-none focus:border-cyan-500 text-right" />
                            <span className="text-xs text-slate-500 font-bold">%</span>
                          </div>
                       </div>
                     ))}
                  </div>
               </div>

            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-end">
               <button onClick={() => setIsStatsModalOpen(false)} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase rounded-xl transition-all shadow-lg">
                 {t('common.confirm', 'Conferma')}
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}