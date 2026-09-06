import React from 'react';
import { useTranslation } from 'react-i18next';

export const ManualPathfindingSidebar = ({
  fixedBuildings,
  selectedManualTargets,
  setSelectedManualTargets,
  livePreviewStats,
  showPathShareUI,
  onToggleShareUI,
  onBack
}) => {
  const { t } = useTranslation();
  
  const excludeKeywords = [
    'santuario', 'fortezza', 'sanctuary', 'fortress', 
    'shrine', 'fort', 'origine', 'origin', 
    'castello', 'castle', 'sunfire', 'fuoco solare',
    'capitale', 'capitol', 'trono', 'throne', 'centro', 'center',
    'castello del regno', 'torrett', 'turret'
  ];

  const availableBuildings = (fixedBuildings || []).filter(b => {
    const testString = `${b.type || ''} ${b.name || ''} ${b.code || ''}`.toLowerCase().trim();
    if (excludeKeywords.some(ex => testString.includes(ex))) return false;
    if (b.isPlayer) return false;
    if (b.x == null || b.y == null || isNaN(Number(b.x)) || isNaN(Number(b.y))) return false;
    if (Number(b.x) === 0 && Number(b.y) === 0) return false;
    return true;
  });

  const occupiedCategories = new Set(
    selectedManualTargets.map(b => `${(b.type || b.name || '').toLowerCase()}-${b.level || 1}`)
  );

  const handleToggleSelect = (building) => {
    const catKey = `${(building.type || building.name || '').toLowerCase()}-${building.level || 1}`;
    const isAlreadySelected = selectedManualTargets.some(b => b.id === building.id);

    if (isAlreadySelected) {
      setSelectedManualTargets(prev => prev.filter(b => b.id !== building.id));
    } else {
      if (occupiedCategories.has(catKey)) {
        alert(t('suite.category_occupied_alert', "Hai già selezionato un edificio di questa tipologia e livello. Per regola puoi occuparne solo uno per tipo!"));
        return;
      }
      setSelectedManualTargets(prev => [...prev, building]);
    }
    if (showPathShareUI) onToggleShareUI(false);
  };

  const isOverLimit = livePreviewStats && livePreviewStats.banners > 258;

  return (
    <div className="flex flex-col gap-3 animate-fade-in h-full">
      <div className="bg-emerald-950/20 border border-emerald-900/50 p-3 rounded-xl text-left shrink-0">
        <h3 className="text-sm font-black text-emerald-400 uppercase tracking-widest mb-1 flex items-center gap-2">
          <span className="text-xl">🎯</span> {t('suite.tactical_selector', 'Selettore Tattico')}
        </h3>
        <p className="text-[9px] text-slate-300 leading-tight">
          {t('suite.selector_desc', "Il contatore calcolerà l'ingombro dell'alveare e gli ostacoli della rotta in tempo reale.")}
        </p>
      </div>

      <div className="flex gap-2 shrink-0">
        <div className={`flex-1 border p-2 rounded-xl flex flex-col justify-center items-center transition-colors ${isOverLimit ? 'bg-red-950/40 border-red-800' : 'bg-slate-950 border-slate-800'}`}>
          <span className={`text-[8px] uppercase font-bold tracking-widest ${isOverLimit ? 'text-red-400' : 'text-slate-500'}`}>{t('suite.tot_banners', 'Tot. Stendardi')}</span>
          <span className={`text-2xl leading-none font-mono font-black ${isOverLimit ? 'text-red-500' : 'text-emerald-400'}`}>
            {livePreviewStats ? livePreviewStats.banners : 0}
          </span>
          {livePreviewStats && (
            <span className="text-[6.5px] text-slate-400 mt-1 uppercase text-center leading-tight">
              {t('suite.banner_breakdown', '({{hive}} Hive + {{path}} Rotta)', { hive: livePreviewStats.hiveBanners, path: livePreviewStats.pathBanners })}
            </span>
          )}
          {isOverLimit && <span className="text-[7px] text-red-400 font-black mt-1 uppercase text-center leading-tight">{t('suite.limit_exceeded', '⚠️ Limite Max (258) Superato')}</span>}
        </div>
        
        <div className="flex-1 flex flex-col gap-2">
          {showPathShareUI ? (
             <button onClick={() => onToggleShareUI(false)} className="flex-1 bg-amber-600 hover:bg-amber-500 text-white text-[9px] font-black uppercase rounded-lg shadow-[0_0_10px_rgba(245,158,11,0.2)] transition-all">
               {t('suite.edit_route', 'Modifica Rotta')}
             </button>
          ) : (
             <button onClick={() => onToggleShareUI(true)} disabled={!livePreviewStats || livePreviewStats.pathBanners === 0 || isOverLimit} className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-[9px] font-black uppercase rounded-lg shadow-[0_0_10px_rgba(16,185,129,0.2)] transition-all">
               {t('suite.generate_data', 'Genera Dati')}
             </button>
          )}
          <button onClick={onBack} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[9px] font-black uppercase rounded-lg border border-slate-700 transition-all">
            {t('suite.back', 'Indietro')}
          </button>
        </div>
      </div>

      <hr className="border-slate-800/80 my-1" />

      {!showPathShareUI && (
        <div className="flex flex-col gap-2 max-h-[350px] overflow-y-auto custom-scrollbar pr-1 animate-fade-in">
          {availableBuildings.map(building => {
            const catKey = `${(building.type || building.name || '').toLowerCase()}-${building.level || 1}`;
            const isSelected = selectedManualTargets.some(b => b.id === building.id);
            const isCategoryOccupied = occupiedCategories.has(catKey) && !isSelected;
            if (isCategoryOccupied) return null;

            return (
              <div key={building.id || `${building.x}-${building.y}`} onClick={() => handleToggleSelect(building)} className={`p-3 rounded-xl border cursor-pointer transition-all flex justify-between items-center ${isSelected ? 'bg-emerald-950/60 border-emerald-500 text-emerald-200 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'}`}>
                <div>
                  <span className="block text-xs font-black uppercase">{building.name || building.type}</span>
                  <span className="block text-[9px] font-mono text-slate-400">{t('suite.building_info', 'Livello: {{level}} | X: {{x}}, Y: {{y}}', { level: building.level || 1, x: building.x, y: building.y })}</span>
                </div>
                <span className={`text-xs font-bold px-2 py-1 rounded ${isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                  {isSelected ? '✓' : '+'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};