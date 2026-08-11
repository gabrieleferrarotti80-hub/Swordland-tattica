import React from 'react';
import { useTranslation } from 'react-i18next';

export default function MarchCard({
  march: pm, index, totalMarchesCount, onDelete, onUpdateHero, 
  onUpdateTroopConfig, onApplyPreset, getAvailableHeroes, getHeroColor
}) {
  const { t } = useTranslation();

  const renderResultBox = (data, title, emptyText, type) => {
    if (data.totalPulled === 0 && data.missing === 0) {
      return <div className="bg-slate-900/50 border border-slate-800 p-2 rounded-lg flex items-center justify-center text-[10px] text-slate-600">{emptyText}</div>;
    }
    let bgClass = type === 'inf' ? 'bg-cyan-950/20 border-cyan-900/50' : type === 'cav' ? 'bg-amber-950/20 border-amber-900/50' : 'bg-rose-950/20 border-rose-900/50';
    let titleClass = type === 'inf' ? 'text-cyan-500' : type === 'cav' ? 'text-amber-500' : 'text-rose-500';
    let valClass = type === 'inf' ? 'text-cyan-300' : type === 'cav' ? 'text-amber-300' : 'text-rose-300';

    return (
      <div className={`${bgClass} border p-3 rounded-lg flex flex-col gap-1`}>
        <div className="flex justify-between items-center mb-1">
          <span className={`text-[10px] font-bold ${titleClass} uppercase`}>{title}</span>
          <span className={`text-xs font-black ${valClass}`}>{data.totalPulled.toLocaleString()}</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {Object.entries(data.pulled).map(([t, amt]) => amt > 0 && (
            <span key={t} className="text-[9px] bg-slate-900 px-1.5 py-0.5 rounded text-slate-400 border border-slate-800">{t}: <span className="text-white">{amt.toLocaleString()}</span></span>
          ))}
        </div>
        {data.missing > 0 && <span className="text-[9px] text-rose-500 font-bold mt-1">{t('march_builder.missing_in_city', { count: data.missing.toLocaleString() })}</span>}
      </div>
    );
  };

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl flex flex-col relative shadow-lg animate-in slide-in-from-bottom-4 shrink-0">
      
      <div className="bg-slate-800/50 px-4 py-3 border-b border-slate-700 flex justify-between items-center">
        <h3 className="text-sm font-black text-white flex items-center gap-2">
          <span className="bg-indigo-600 text-white w-6 h-6 rounded flex items-center justify-center text-xs">{index + 1}</span>
          {t('march_builder.march_number')} {index + 1}
        </h3>
        {totalMarchesCount > 1 && (
          <button onClick={() => onDelete(pm.id)} className="text-slate-500 hover:text-rose-500 text-xs font-bold transition-colors px-2 py-1 rounded bg-slate-900 border border-slate-700">{t('march_builder.remove_btn')}</button>
        )}
      </div>

      <div className="p-4 md:p-6 flex flex-col gap-6">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="lg:w-2/3 flex flex-col gap-3">
            <div className="flex justify-between items-end border-b border-slate-800 pb-1 mb-1">
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('march_builder.commanders_step')}</h4>
              <span className="text-[10px] font-bold text-slate-600">{t('march_builder.deployed_heroes', { count: pm.activeHeroesCount })}</span>
            </div>
            
            <div className={`flex items-center gap-2 bg-slate-950 p-2 rounded-xl border ${pm.hero1 ? 'border-amber-500/50' : 'border-slate-800'} transition-colors`}>
              <span className="text-lg w-8 text-center drop-shadow-md">👑</span>
              <select value={pm.hero1} onChange={(e) => onUpdateHero(pm.id, 'hero1', e.target.value)} className="flex-1 bg-transparent text-sm font-bold text-slate-200 outline-none cursor-pointer">
                <option value="">{t('march_builder.select_primary')}</option>
                {getAvailableHeroes('hero1').map(h => <option key={h.id} value={h.id} className={getHeroColor(h.rarity)}>[G{h.gen}] {h.name} ({h.type})</option>)}
              </select>
            </div>
            <div className={`flex items-center gap-2 bg-slate-950 p-2 rounded-xl border ${pm.hero2 ? 'border-cyan-500/50' : 'border-slate-800'} transition-colors`}>
              <span className="text-lg w-8 text-center drop-shadow-md">⚔️</span>
              <select value={pm.hero2} onChange={(e) => onUpdateHero(pm.id, 'hero2', e.target.value)} className="flex-1 bg-transparent text-sm font-bold text-slate-200 outline-none cursor-pointer">
                <option value="">{t('march_builder.select_secondary')}</option>
                {getAvailableHeroes('hero2').map(h => <option key={h.id} value={h.id} className={getHeroColor(h.rarity)}>[G{h.gen}] {h.name} ({h.type})</option>)}
              </select>
            </div>
            <div className={`flex items-center gap-2 bg-slate-950 p-2 rounded-xl border ${pm.hero3 ? 'border-emerald-500/50' : 'border-slate-800'} transition-colors`}>
              <span className="text-lg w-8 text-center drop-shadow-md">🛡️</span>
              <select value={pm.hero3} onChange={(e) => onUpdateHero(pm.id, 'hero3', e.target.value)} className="flex-1 bg-transparent text-sm font-bold text-slate-200 outline-none cursor-pointer">
                <option value="">{t('march_builder.select_support')}</option>
                {getAvailableHeroes('hero3').map(h => <option key={h.id} value={h.id} className={getHeroColor(h.rarity)}>[G{h.gen}] {h.name} ({h.type})</option>)}
              </select>
            </div>
          </div>

          <div className="lg:w-1/3 flex flex-col justify-center">
            <div className="bg-indigo-900/30 border border-indigo-500/50 p-4 rounded-xl flex flex-col items-center justify-center text-center shadow-inner h-full">
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-1">{t('march_builder.current_capacity')}</span>
              <span className="text-3xl font-black text-white font-mono">{pm.currentMaxCapacity.toLocaleString()}</span>
              <span className="text-[10px] text-slate-400 mt-2">{t('march_builder.value_from_global')}</span>
            </div>
          </div>
        </div>

        <div className={`flex flex-col gap-3 transition-opacity ${pm.currentMaxCapacity === 0 ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
          <div className="flex flex-col border-b border-slate-800 pb-3 mb-1 gap-2">
            <div className="flex justify-between items-end">
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('march_builder.troop_request_step')}</h4>
              <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-700">
                <button onClick={() => onUpdateTroopConfig(pm.id, 'mode', 'manual')} className={`px-3 py-1 text-[10px] font-bold rounded uppercase transition-colors ${pm.mode === 'manual' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>{t('march_builder.manual_mode')}</button>
                <button onClick={() => onUpdateTroopConfig(pm.id, 'mode', 'percent')} className={`px-3 py-1 text-[10px] font-bold rounded uppercase transition-colors ${pm.mode === 'percent' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>{t('march_builder.percent_mode')}</button>
              </div>
            </div>
            
            {pm.mode === 'percent' && (
              <div className="flex flex-wrap gap-2 pt-1">
                <span className="text-[9px] font-bold text-slate-600 self-center mr-1">{t('march_builder.quick_presets')}</span>
                <button onClick={() => onApplyPreset(pm.id, 50, 30, 20)} className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 rounded-lg border border-slate-600 transition-colors">50-30-20</button>
                <button onClick={() => onApplyPreset(pm.id, 60, 40, 0)} className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 rounded-lg border border-slate-600 transition-colors">60-40-0</button>
                <button onClick={() => onApplyPreset(pm.id, 10, 10, 80)} className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 rounded-lg border border-slate-600 transition-colors">10-10-80</button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-2 bg-cyan-950/10 p-3 rounded-xl border border-cyan-900/30">
              <label className="text-[10px] font-bold text-cyan-500 uppercase text-center">{t('march_builder.infantry')}</label>
              <div className="relative">
                <input type="number" min="0" value={pm.mode === 'manual' ? (pm.manual.inf === 0 ? '' : pm.manual.inf) : (pm.percent.inf === 0 ? '' : pm.percent.inf)} onChange={(e) => onUpdateTroopConfig(pm.id, pm.mode, 'inf', e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 text-center text-cyan-300 font-mono text-sm outline-none focus:border-cyan-500 pr-6" />
                {pm.mode === 'percent' && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-cyan-600 text-xs">%</span>}
              </div>
            </div>
            <div className="flex flex-col gap-2 bg-amber-950/10 p-3 rounded-xl border border-amber-900/30">
              <label className="text-[10px] font-bold text-amber-500 uppercase text-center">{t('march_builder.cavalry')}</label>
              <div className="relative">
                <input type="number" min="0" value={pm.mode === 'manual' ? (pm.manual.cav === 0 ? '' : pm.manual.cav) : (pm.percent.cav === 0 ? '' : pm.percent.cav)} onChange={(e) => onUpdateTroopConfig(pm.id, pm.mode, 'cav', e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 text-center text-amber-300 font-mono text-sm outline-none focus:border-amber-500 pr-6" />
                {pm.mode === 'percent' && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-600 text-xs">%</span>}
              </div>
            </div>
            <div className="flex flex-col gap-2 bg-rose-950/10 p-3 rounded-xl border border-rose-900/30">
              <label className="text-[10px] font-bold text-rose-500 uppercase text-center">{t('march_builder.archers')}</label>
              <div className="relative">
                <input type="number" min="0" value={pm.mode === 'manual' ? (pm.manual.arc === 0 ? '' : pm.manual.arc) : (pm.percent.arc === 0 ? '' : pm.percent.arc)} onChange={(e) => onUpdateTroopConfig(pm.id, pm.mode, 'arc', e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 text-center text-rose-300 font-mono text-sm outline-none focus:border-rose-500 pr-6" />
                {pm.mode === 'percent' && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-rose-600 text-xs">%</span>}
              </div>
            </div>
          </div>

          <div className="mt-1 flex justify-end">
            {pm.mode === 'manual' ? (
              <span className={`text-xs font-bold px-3 py-1.5 rounded-lg border shadow-lg ${pm.currentTotal > pm.currentMaxCapacity ? 'bg-rose-900/80 text-white border-rose-500' : 'bg-slate-900 text-emerald-400 border-emerald-500/30'}`}>
                {t('march_builder.total_requested')} {pm.currentTotal.toLocaleString()} / {pm.currentMaxCapacity.toLocaleString()} {pm.currentTotal > pm.currentMaxCapacity && t('march_builder.exceeded')}
              </span>
            ) : (
              <span className={`text-xs font-bold px-3 py-1.5 rounded-lg border shadow-lg ${pm.currentTotal !== 100 ? 'bg-rose-900/80 text-white border-rose-500' : 'bg-emerald-950/80 text-emerald-400 border-emerald-500'}`}>
                {t('march_builder.percentage')} {pm.currentTotal}% {pm.currentTotal !== 100 && t('march_builder.must_be_100')}
              </span>
            )}
          </div>

          <div className="mt-2 bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col gap-3">
            <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest border-b border-slate-800 pb-1">{t('march_builder.real_composition_step')}</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-1">
              {renderResultBox(pm.realInf, t('march_builder.infantry'), t('march_builder.no_infantry'), 'inf')}
              {renderResultBox(pm.realCav, t('march_builder.cavalry'), t('march_builder.no_cavalry'), 'cav')}
              {renderResultBox(pm.realArc, t('march_builder.archers'), t('march_builder.no_archers'), 'arc')}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}