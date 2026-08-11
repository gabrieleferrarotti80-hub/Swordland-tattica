import React from 'react';
import { heroesDB } from '../../data/heroes';

export default function HeroCollectionModal({ 
  isOpen, onClose, ownedHeroes, toggleOwnedHero, onSave, getHeroColor, t 
}) {
  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in zoom-in-95 duration-200">
      <div className="bg-slate-900 border border-slate-700 p-6 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] w-full max-w-4xl flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-4 shrink-0">
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2"><span>🎖️</span> {t('march_builder.hero_collection_title')}</h2>
            <p className="text-xs text-slate-400 mt-1">{t('march_builder.hero_collection_desc')}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:bg-rose-900 hover:text-rose-400 transition-colors font-bold">✕</button>
        </div>
        
        <div className="overflow-y-auto custom-scrollbar flex-1 pr-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {heroesDB.map(h => {
            const isOwned = ownedHeroes.includes(h.id);
            return (
              <div 
                key={h.id} 
                onClick={() => toggleOwnedHero(h.id)}
                className={`cursor-pointer p-3 rounded-xl border flex flex-col items-center text-center transition-all ${isOwned ? 'bg-indigo-900/40 border-indigo-500/50 shadow-[0_0_15px_rgba(79,70,229,0.2)]' : 'bg-slate-950/50 border-slate-800 opacity-60 hover:opacity-100 hover:border-slate-600 grayscale hover:grayscale-0'}`}
              >
                <span className="text-2xl mb-1">{h.type === 'Fanteria' ? '⚔️' : h.type === 'Cavalleria' ? '🐎' : '🏹'}</span>
                <span className={`text-xs font-bold ${getHeroColor(h.rarity)}`}>{h.name}</span>
                <span className="text-[10px] text-slate-500 uppercase">Gen {h.gen}</span>
              </div>
            );
          })}
        </div>
        
        <div className="mt-4 pt-4 border-t border-slate-800 flex justify-end items-center gap-3 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white uppercase transition-colors">
            {t('march_builder.hero_collection_close')}
          </button>
          <button onClick={() => { onClose(); onSave(); }} className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-[0_0_15px_rgba(5,150,105,0.4)] flex items-center gap-2">
            <span>💾</span> {t('march_builder.hero_collection_save')}
          </button>
        </div>
      </div>
    </div>
  );
}