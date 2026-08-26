import React from 'react';
import { eventTypes } from '../../data/heroes';

const TIERS = ['T11', 'T10', 'T9', 'T8', 'T7', 'T6', 'T5', 'T4', 'T3', 'T2', 'T1'];

export default function MarchBuilderSidebar({
  t, selectedEvent, setSelectedEvent, setIsHeroModalOpen,
  globalCapacity, setGlobalCapacity, isArmyOpen, setIsArmyOpen,
  activeTab, setActiveTab, totalTroops, setTotalTroops,
  initInf, initCav, initArc, usedInf, usedCav, usedArc, remInf, remCav, remArc,
  handleSaveToCloud, isLoading
}) {
  return (
    <div className="xl:col-span-4 flex flex-col gap-6 xl:sticky xl:top-6 max-h-[85vh] overflow-y-auto custom-scrollbar pb-6 pr-2">
      
      {/* Target Event & Hero Collection */}
      <div className="bg-slate-900 border border-slate-700 p-5 rounded-2xl shadow-xl shrink-0 flex flex-col gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{t('march_builder.target_event')}</label>
          <select value={selectedEvent} onChange={(e) => setSelectedEvent(e.target.value)} className="w-full bg-slate-950 border border-indigo-500/50 text-indigo-300 text-sm font-bold px-4 py-3 rounded-xl focus:outline-none focus:border-indigo-400 cursor-pointer">
            {eventTypes.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
          </select>
        </div>
        <button onClick={() => setIsHeroModalOpen(true)} className="w-full px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 text-xs font-bold uppercase tracking-wider rounded-xl transition-colors flex items-center justify-center gap-2 shadow-inner">
          <span>🎖️</span> {t('march_builder.open_hero_collection', 'Apri Collezione Eroi')}
        </button>
      </div>

      {/* Global Capacity */}
      <div className="bg-slate-900 border border-slate-700 p-5 rounded-2xl shadow-xl shrink-0">
        <div className="border-b border-slate-800 pb-2 mb-3">
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

      {/* Your Army */}
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-xl flex flex-col flex-shrink">
        <div className="p-5 border-b border-slate-800 bg-slate-900/80 shrink-0 cursor-pointer flex justify-between items-center hover:bg-slate-800/80 transition-colors rounded-t-2xl" onClick={() => setIsArmyOpen(!isArmyOpen)}>
          <div>
            <h2 className="text-sm font-black text-cyan-400 uppercase tracking-widest">{t('march_builder.your_army_title')}</h2>
            <p className="text-[10px] text-slate-500 mt-1 leading-tight">{t('march_builder.manage_troops_desc')}</p>
          </div>
          <span className="text-xl opacity-70">{isArmyOpen ? '🔽' : '▶️'}</span>
        </div>
        
        {isArmyOpen && (
          <>
            <div className="flex bg-slate-950 p-2 border-b border-slate-800 shrink-0">
              <button onClick={() => setActiveTab('infantry')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${activeTab === 'infantry' ? 'bg-cyan-900/40 text-cyan-400 border border-cyan-500/50' : 'text-slate-500 hover:text-slate-300'}`}>{t('march_builder.inf_short')} <br/><span className="text-[9px] opacity-70">({initInf.toLocaleString()})</span></button>
              <button onClick={() => setActiveTab('cavalry')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${activeTab === 'cavalry' ? 'bg-amber-900/40 text-amber-400 border border-amber-500/50' : 'text-slate-500 hover:text-slate-300'}`}>{t('march_builder.cav_short')} <br/><span className="text-[9px] opacity-70">({initCav.toLocaleString()})</span></button>
              <button onClick={() => setActiveTab('archers')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${activeTab === 'archers' ? 'bg-rose-900/40 text-rose-400 border border-rose-500/50' : 'text-slate-500 hover:text-slate-300'}`}>{t('march_builder.arc_short')} <br/><span className="text-[9px] opacity-70">({initArc.toLocaleString()})</span></button>
            </div>
            <div className="max-h-[300px] overflow-y-auto p-4 custom-scrollbar">
              <div className="flex flex-col gap-2">
                {TIERS.map(tier => (
                  <div key={`${activeTab}-${tier}`} className={`flex items-center justify-between bg-slate-950 p-2.5 rounded-lg border transition-colors ${totalTroops[activeTab][tier] > 0 ? (activeTab === 'infantry' ? 'border-cyan-500/30 bg-cyan-950/10' : activeTab === 'cavalry' ? 'border-amber-500/30 bg-amber-950/10' : 'border-rose-500/30 bg-rose-950/10') : 'border-slate-800'}`}>
                    <span className={`text-xs font-black w-12 ${totalTroops[activeTab][tier] > 0 ? 'text-slate-200' : 'text-slate-600'}`}>{tier}</span>
                    <input type="number" min="0" value={totalTroops[activeTab][tier] === 0 ? '' : totalTroops[activeTab][tier]} onChange={e => setTotalTroops(prev => ({...prev, [activeTab]: {...prev[activeTab], [tier]: Math.max(0, e.target.value==='' ? 0 : parseInt(e.target.value, 10))}}))} placeholder="0" className={`w-32 bg-transparent text-right font-mono text-sm outline-none font-bold ${activeTab === 'infantry' ? 'text-cyan-300' : activeTab === 'cavalry' ? 'text-amber-300' : 'text-rose-300'}`} />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="bg-slate-950 p-5 border-t border-slate-800 rounded-b-2xl flex flex-col gap-4">
          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-1">{t('march_builder.assignment_summary')}</h3>
          <div className="flex flex-col gap-1">
            <div className="flex justify-between items-center"><span className="text-[10px] font-bold text-cyan-500 uppercase">{t('march_builder.infantry')}</span><span className="text-xs font-black text-slate-300">{usedInf.toLocaleString()} / {initInf.toLocaleString()} <span className="text-emerald-400 font-normal ml-1">({remInf.toLocaleString()} libere)</span></span></div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden"><div className="bg-cyan-500 h-1.5 rounded-full transition-all" style={{ width: `${initInf > 0 ? (usedInf/initInf)*100 : 0}%` }}></div></div>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex justify-between items-center"><span className="text-[10px] font-bold text-amber-500 uppercase">{t('march_builder.cavalry')}</span><span className="text-xs font-black text-slate-300">{usedCav.toLocaleString()} / {initCav.toLocaleString()} <span className="text-emerald-400 font-normal ml-1">({remCav.toLocaleString()} libere)</span></span></div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden"><div className="bg-amber-500 h-1.5 rounded-full transition-all" style={{ width: `${initCav > 0 ? (usedCav/initCav)*100 : 0}%` }}></div></div>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex justify-between items-center"><span className="text-[10px] font-bold text-rose-500 uppercase">{t('march_builder.archers')}</span><span className="text-xs font-black text-slate-300">{usedArc.toLocaleString()} / {initArc.toLocaleString()} <span className="text-emerald-400 font-normal ml-1">({remArc.toLocaleString()} libere)</span></span></div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden"><div className="bg-rose-500 h-1.5 rounded-full transition-all" style={{ width: `${initArc > 0 ? (usedArc/initArc)*100 : 0}%` }}></div></div>
          </div>
        </div>
      </div>

      {/* Cloud Sync */}
      <div className="bg-emerald-950/20 border border-emerald-900/50 p-5 rounded-2xl shadow-xl shrink-0 flex flex-col gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-[30px] pointer-events-none"></div>
        <div className="relative z-10">
          <h2 className="text-sm font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2"><span>☁️</span> {t('march_builder.sync_title')}</h2>
          <p className="text-[10px] text-slate-400 mt-1 leading-tight">{t('march_builder.sync_desc')}</p>
        </div>
        <button onClick={handleSaveToCloud} disabled={isLoading} className="relative z-10 w-full px-4 py-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-[0_0_20px_rgba(5,150,105,0.4)] disabled:opacity-50 flex items-center justify-center gap-2">
          {isLoading ? t('march_builder.sync_saving') : `💾 ${t('march_builder.sync_save_btn')}`}
        </button>
      </div>

    </div>
  );
}