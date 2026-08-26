import React, { useState } from 'react';
import HeroDetailModal from './HeroDetailModal';

export default function HeroCollectionModal({ 
  isOpen, onClose, ownedHeroes = {}, setOwnedHeroes, onSave, getHeroColor, t,
  heroesCatalog = [] 
}) {
  const [selectedHeroForDetail, setSelectedHeroForDetail] = useState(null);

  if (!isOpen) return null;

  const handleHeroClick = (heroId) => {
    if (!ownedHeroes[heroId]) {
      setOwnedHeroes(prev => ({
        ...prev,
        [heroId]: {
          level: 1, stars: 0, power: 0, troopCapacity: 0,
          gear: { helmet: { level: 0, power: 0, isRed: false }, armor: { level: 0, power: 0, isRed: false }, gloves: { level: 0, power: 0, isRed: false }, boots: { level: 0, power: 0, isRed: false } },
          exclusive: 0,
          stats: { conquest: { heroAtk: 0, heroDef: 0, heroHp: 0, escortAtk: 0, escortDef: 0, escortHp: 0 }, expedition: { troopAtk: 0, troopDef: 0, troopLethality: 0, troopHp: 0 } }
        }
      }));
    }
    const heroConfig = heroesCatalog.find(h => h.id === heroId);
    setSelectedHeroForDetail(heroConfig);
  };

  const handleSaveHeroDetail = (heroId, newHeroData) => {
    setOwnedHeroes(prev => ({ ...prev, [heroId]: newHeroData }));
    setSelectedHeroForDetail(null); 
  };

  const handleRemoveHero = (e, heroId) => {
    e.stopPropagation(); 
    const confirmText = t ? t('hero_collection.confirm_remove', 'Rimuovere questo eroe dalla tua collezione?') : 'Rimuovere questo eroe?';
    if(window.confirm(confirmText)) {
        setOwnedHeroes(prev => {
            const newState = { ...prev };
            delete newState[heroId];
            return newState;
        });
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
        <div className="bg-slate-900 border border-slate-700 p-6 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] w-full max-w-4xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
          
          <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-4 shrink-0">
            <div>
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                 <span>🎖️</span> {t ? t('march_builder.hero_collection_title', 'Collezione Eroi') : 'Collezione Eroi'}
              </h2>
              <p className="text-xs text-slate-400 mt-1">{t('hero_collection.desc', 'Clicca su un eroe per aprirne subito le specifiche e configurarlo.')}</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:bg-rose-900 hover:text-rose-400 transition-colors font-bold">✕</button>
          </div>
          
          <div className="overflow-y-auto custom-scrollbar flex-1 pr-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 lg:gap-4">
            {heroesCatalog.map(h => {
              const isOwned = !!(ownedHeroes && ownedHeroes[h.id]); 
              const heroData = (ownedHeroes && ownedHeroes[h.id]) ? ownedHeroes[h.id] : {};
              const safeColor = typeof getHeroColor === 'function' ? getHeroColor(h.rarity) : '';
              const safeStars = Math.max(0, Number(heroData.stars) || 0);

              return (
                <div 
                  key={h.id} 
                  onClick={() => handleHeroClick(h.id)}
                  className={`relative cursor-pointer p-4 rounded-xl border flex flex-col items-center text-center transition-all duration-200 group ${isOwned ? 'bg-indigo-900/40 border-indigo-500/50 shadow-[0_0_15px_rgba(79,70,229,0.15)] hover:bg-indigo-800/60 hover:-translate-y-1' : 'bg-slate-950/50 border-slate-800 opacity-60 hover:opacity-100 hover:border-slate-600 grayscale hover:grayscale-0'}`}
                >
                  {isOwned && (
                     <button onClick={(e) => handleRemoveHero(e, h.id)} className="absolute top-1 right-1 w-6 h-6 z-10 bg-rose-900/80 text-rose-300 rounded-bl-lg rounded-tr-lg text-xs font-bold flex items-center justify-center hover:bg-rose-600 hover:text-white transition-colors opacity-0 group-hover:opacity-100 shadow-md">✕</button>
                  )}
                  
                  {h.image ? (
                     <img src={h.image} alt={h.name} className="w-16 h-16 md:w-20 md:h-20 rounded-2xl object-cover mb-3 shadow-[0_8px_16px_rgba(0,0,0,0.6)] pointer-events-none group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                     <span className="text-4xl mb-2">{h.type === 'Fanteria' ? '⚔️' : h.type === 'Cavalleria' ? '🐎' : '🏹'}</span>
                  )}
                  
                  <span className={`text-[11px] md:text-xs font-black uppercase mb-1 ${safeColor}`}>{h.name || t('hero_collection.lbl_name', 'Nome')}</span>
                  
                  {isOwned ? (
                    <div className="flex flex-col w-full border-t border-slate-700/50 mt-1 pt-1.5">
                       <span className="text-[10px] md:text-[11px] text-cyan-400 font-bold">
                          {t('hero_collection.lbl_lv', 'Lv.')} {heroData.level || 1} <span className="text-amber-400">{'⭐'.repeat(safeStars)}</span>
                       </span>
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-500 uppercase mt-auto">{t('hero_collection.lbl_gen', 'Gen')} {h.gen || '?'}</span>
                  )}
                </div>
              );
            })}
          </div>
          
          <div className="mt-4 pt-4 border-t border-slate-800 flex justify-end items-center gap-3 shrink-0">
            <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white uppercase transition-colors">{t('hero_collection.btn_close', 'Chiudi')}</button>
            <button onClick={() => { onClose(); if (typeof onSave === 'function') onSave(); }} className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-[0_0_15px_rgba(5,150,105,0.4)] flex items-center gap-2">
              <span>💾</span> {t('hero_collection.btn_save', 'Salva Profilo Base')}
            </button>
          </div>
        </div>
      </div>

      {selectedHeroForDetail && (
        <HeroDetailModal
           hero={selectedHeroForDetail}
           heroData={ownedHeroes[selectedHeroForDetail.id] || {}}
           onClose={() => setSelectedHeroForDetail(null)}
           onSave={handleSaveHeroDetail}
           getHeroColor={getHeroColor}
        />
      )}
    </>
  );
}