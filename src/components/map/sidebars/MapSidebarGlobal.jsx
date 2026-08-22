import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function MapSidebarGlobal({
  selectedTool, setSelectedTool,
  filters, toggleFilter, toggleAllFilters, areAllFiltersActive,
  showLabels, setShowLabels,
  marchOrigin, setMarchOrigin, marchDestination, setMarchDestination,
  marchResult, handleManualCoord,
  userRole, onOpenHelp
}) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleSettingsClick = () => {
    const code = window.prompt(t('map.secret_code_prompt'));
    if (code === "ADMIN") setSelectedTool('settings');
    else if (code !== null) alert(t('map.wrong_code'));
  };

  return (
    <aside className="w-[340px] bg-slate-900 border-r border-slate-800 flex flex-col p-6 gap-6 z-20 shadow-2xl shrink-0 overflow-y-auto custom-scrollbar">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-black tracking-wider text-cyan-400">{t('map.map_tools')}</h2>
          <button onClick={onOpenHelp} className="w-6 h-6 flex items-center justify-center bg-slate-800 hover:bg-cyan-900 text-cyan-400 rounded-full border border-slate-700 text-xs font-bold" title="Guida">?</button>
        </div>
        <button onClick={() => navigate('/')} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg border border-slate-700">🏠</button>
      </div>
      
      <div className="flex flex-col gap-3 shrink-0">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Seleziona Azione</span>
        <button onClick={() => setSelectedTool('buildings')} className={`p-3 rounded-xl font-bold text-left transition-all flex items-center gap-3 ${selectedTool === 'buildings' ? 'bg-cyan-600 text-white' : 'bg-slate-800/50 text-slate-300'}`}>🏰 {t('map.building_filters')}</button>
        <button onClick={() => setSelectedTool('distance')} className={`p-3 rounded-xl font-bold text-left transition-all flex items-center gap-3 ${selectedTool === 'distance' ? 'bg-amber-600 text-white' : 'bg-slate-800/50 text-slate-300'}`}>📏 {t('map.march_time')}</button>
        {userRole === 'admin' && (
          <button onClick={handleSettingsClick} className={`p-3 rounded-xl font-bold text-left transition-all flex items-center gap-3 ${selectedTool === 'settings' ? 'bg-rose-600 text-white' : 'bg-slate-800/50 text-slate-300'}`}>⚙️ {t('map.fixed_db')}</button>
        )}
      </div>

      {selectedTool === 'buildings' && (
        <div className="mt-1 bg-slate-950 p-4 rounded-xl border border-slate-800/80 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <span className="text-xs font-black text-cyan-400 uppercase tracking-wider">{t('map.building_filters')}</span>
            <button onClick={toggleAllFilters} className="text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded transition-colors uppercase">{areAllFiltersActive ? t('map.deselect_all') : t('map.select_all')}</button>
          </div>
          <label className="flex items-center justify-between cursor-pointer group mt-1">
            <span className="text-xs font-bold text-slate-400 group-hover:text-white transition-colors">{t('map.show_all_names')}</span>
            <input type="checkbox" className="accent-cyan-500 w-4 h-4" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} />
          </label>
          <div className="flex flex-col gap-2 mt-2">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1 mb-1">{t('map.power_centers')}</span>
            <label className="flex items-center justify-between"><span className="text-xs text-slate-300">Castello</span><input type="checkbox" className="accent-cyan-500" checked={filters.castle !== false} onChange={() => toggleFilter('castle')} /></label>
            <label className="flex items-center justify-between"><span className="text-xs text-slate-300">Santuari</span><input type="checkbox" className="accent-cyan-500" checked={filters.santuari !== false} onChange={() => toggleFilter('santuari')} /></label>
            <label className="flex items-center justify-between"><span className="text-xs text-slate-300">Fortezze</span><input type="checkbox" className="accent-cyan-500" checked={filters.fortezze !== false} onChange={() => toggleFilter('fortezze')} /></label>
            
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2 mb-1">{t('map.civilians_research')}</span>
            <label className="flex items-center justify-between"><span className="text-xs text-slate-300">Gilda Costruttori</span><input type="checkbox" className="accent-cyan-500" checked={filters.builders !== false} onChange={() => toggleFilter('builders')} /></label>
            <label className="flex items-center justify-between"><span className="text-xs text-slate-300">Bosco Raccoglitori</span><input type="checkbox" className="accent-cyan-500" checked={filters.forager !== false} onChange={() => toggleFilter('forager')} /></label>
            <label className="flex items-center justify-between"><span className="text-xs text-slate-300">Altare Raccolta</span><input type="checkbox" className="accent-cyan-500" checked={filters.harvest !== false} onChange={() => toggleFilter('harvest')} /></label>
            <label className="flex items-center justify-between"><span className="text-xs text-slate-300">Torre Studiosi</span><input type="checkbox" className="accent-cyan-500" checked={filters.scholar !== false} onChange={() => toggleFilter('scholar')} /></label>

            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2 mb-1">{t('map.military_structures')}</span>
            <label className="flex items-center justify-between"><span className="text-xs text-slate-300">Armeria</span><input type="checkbox" className="accent-cyan-500" checked={filters.armory !== false} onChange={() => toggleFilter('armory')} /></label>
            <label className="flex items-center justify-between"><span className="text-xs text-slate-300">Arsenale</span><input type="checkbox" className="accent-cyan-500" checked={filters.arsenal !== false} onChange={() => toggleFilter('arsenal')} /></label>
            <label className="flex items-center justify-between"><span className="text-xs text-slate-300">Accampamento</span><input type="checkbox" className="accent-cyan-500" checked={filters.drill !== false} onChange={() => toggleFilter('drill')} /></label>
            <label className="flex items-center justify-between"><span className="text-xs text-slate-300">Loggia di Frontiera</span><input type="checkbox" className="accent-cyan-500" checked={filters.frontier !== false} onChange={() => toggleFilter('frontier')} /></label>

            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2 mb-1">{t('map.other_buildings')}</span>
            <label className="flex items-center justify-between"><span className="text-xs text-slate-300">Altri Edifici</span><input type="checkbox" className="accent-cyan-500" checked={filters.others !== false} onChange={() => toggleFilter('others')} /></label>

            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2 mb-1">{t('map.alliance_structures')}</span>
            <label className="flex items-center justify-between"><span className="text-xs text-slate-300">QG Alleanza</span><input type="checkbox" className="accent-indigo-500" checked={filters.allianceHQ !== false} onChange={() => toggleFilter('allianceHQ')} /></label>

            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2 mb-1">{t('map.alliance_roster')}</span>
            <label className="flex items-center justify-between"><span className="text-xs text-yellow-400 font-bold">Giocatori R5</span><input type="checkbox" className="accent-yellow-500" checked={filters.alliesR5 !== false} onChange={() => toggleFilter('alliesR5')} /></label>
            <label className="flex items-center justify-between"><span className="text-xs text-purple-400 font-bold">Giocatori R4</span><input type="checkbox" className="accent-purple-500" checked={filters.alliesR4 !== false} onChange={() => toggleFilter('alliesR4')} /></label>
            <label className="flex items-center justify-between"><span className="text-xs text-blue-400 font-bold">Altri Giocatori</span><input type="checkbox" className="accent-blue-500" checked={filters.alliesOthers !== false} onChange={() => toggleFilter('alliesOthers')} /></label>
          </div>
        </div>
      )}

      {selectedTool === 'distance' && (
        <div className="mt-1 bg-slate-950 p-4 rounded-xl border border-amber-900/50 flex flex-col gap-4">
          <h3 className="text-xs font-black text-amber-400 uppercase tracking-wider">{t('map.march_calculator')}</h3>
          <p className="text-[10px] text-slate-400 leading-relaxed" dangerouslySetInnerHTML={{ __html: t('map.march_calc_desc') }}></p>
          
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('map.starting_point')}</span>
            <div className="flex gap-2">
              <input type="number" placeholder="X" value={marchOrigin?.x ?? ''} onChange={(e) => handleManualCoord('origin', 'x', e.target.value)} className="w-16 bg-slate-900 border border-slate-700 text-xs text-white px-2 py-1.5 rounded outline-none focus:border-amber-500 text-center font-mono" />
              <input type="number" placeholder="Y" value={marchOrigin?.y ?? ''} onChange={(e) => handleManualCoord('origin', 'y', e.target.value)} className="w-16 bg-slate-900 border border-slate-700 text-xs text-white px-2 py-1.5 rounded outline-none focus:border-amber-500 text-center font-mono" />
              <div className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-400 truncate flex items-center">
                {marchOrigin?.name || t('map.waiting_coords')}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('map.destination_point')}</span>
            <div className="flex gap-2">
              <input type="number" placeholder="X" value={marchDestination?.x ?? ''} onChange={(e) => handleManualCoord('destination', 'x', e.target.value)} className="w-16 bg-slate-900 border border-slate-700 text-xs text-white px-2 py-1.5 rounded outline-none focus:border-amber-500 text-center font-mono" />
              <input type="number" placeholder="Y" value={marchDestination?.y ?? ''} onChange={(e) => handleManualCoord('destination', 'y', e.target.value)} className="w-16 bg-slate-900 border border-slate-700 text-xs text-white px-2 py-1.5 rounded outline-none focus:border-amber-500 text-center font-mono" />
              <div className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-400 truncate flex items-center">
                {marchDestination?.name || t('map.waiting_coords')}
              </div>
            </div>
          </div>

          {marchResult && (
            <div className="mt-2 bg-amber-950/30 border border-amber-500/30 p-3 rounded-lg flex flex-col items-center justify-center gap-1 shadow-inner">
              <span className="text-[10px] font-bold text-amber-500 uppercase">{t('map.estimated_time')}</span>
              <span className="text-2xl font-black text-amber-400 font-mono tracking-wider">{marchResult.formattedTime}</span>
              <span className="text-[10px] text-slate-400 mt-1">{t('map.distance')}: {marchResult.distance}</span>
            </div>
          )}

          <button onClick={() => { setMarchOrigin(null); setMarchDestination(null); }} className="mt-2 text-[10px] font-bold text-slate-500 hover:text-rose-400 transition-colors uppercase tracking-widest flex items-center justify-center gap-1">
            {t('map.reset_selection')}
          </button>
        </div>
      )}
    </aside>
  );
}