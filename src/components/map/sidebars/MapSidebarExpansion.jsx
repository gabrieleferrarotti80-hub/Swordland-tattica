import React from 'react';
import { useTranslation } from 'react-i18next';

export default function MapSidebarExpansion({
  allianceStructures, setAllianceStructures, setActiveView, handleSaveToCloud, isLoadingCloud
}) {
  const { t } = useTranslation();

  const banners = allianceStructures?.filter(s => s.type === 'banner') || [];
  const hqs = allianceStructures?.filter(s => s.type === 'headquarters') || [];

  return (
    <aside className="w-[340px] bg-slate-900 border-r border-slate-800 flex flex-col p-5 gap-4 z-20 shadow-2xl shrink-0 overflow-hidden select-none">
      
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
        <h2 className="text-lg font-black tracking-wider text-blue-400">{t('sidebar.expansion_planner', 'Pianificatore Espansione')}</h2>
        <button onClick={() => setActiveView('global')} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold uppercase rounded-lg border border-slate-700 transition-colors">
          ✕ {t('sidebar.close', 'Chiudi')}
        </button>
      </div>

      <div className="bg-blue-950/30 border border-blue-500/50 rounded-xl p-3 text-xs text-blue-100 shadow-inner leading-relaxed">
        <strong>💡 {t('sidebar.global_strategy', 'Strategia Globale:')}</strong> {t('sidebar.expansion_desc', 'Aggiungi centri e stendardi. Le aree 6x6 diventeranno verdi quando il posizionamento creerà un collegamento territoriale valido con la struttura adiacente.')}
      </div>

      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col gap-3 shrink-0">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('sidebar.active_banners', 'Stendardi Attivi')}</span>
          <span className="text-sm font-black text-blue-400">{banners.length} / 250</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('sidebar.alliance_centers', 'Centri Alleanza')}</span>
          <span className="text-sm font-black text-amber-400">{hqs.length} / 2</span>
        </div>
      </div>

      <div className="flex flex-col gap-3 mt-2">
        <button 
          onClick={() => setAllianceStructures([...(allianceStructures || []), { id: `banner-${Date.now()}`, type: 'banner', code: 'BAN', name: 'Nuovo Stendardo', x: 600, y: 600 }])}
          className="w-full py-2.5 bg-blue-900/20 hover:bg-blue-800/40 border border-blue-500/50 text-blue-400 text-xs font-black uppercase tracking-widest rounded-lg transition-colors"
        >
          {t('sidebar.add_banner', '+ Aggiungi Stendardo')}
        </button>
        <button 
          onClick={() => setAllianceStructures([...(allianceStructures || []), { id: `hq-${Date.now()}`, type: 'headquarters', code: 'HQ', name: 'Centro Alleanza', x: 600, y: 600 }])}
          className="w-full py-2.5 bg-amber-900/20 hover:bg-amber-800/40 border border-amber-500/50 text-amber-400 text-xs font-black uppercase tracking-widest rounded-lg transition-colors"
        >
          {t('sidebar.add_center', '+ Aggiungi Centro Alleanza')}
        </button>
      </div>
      
      <div className="mt-auto pt-4 border-t border-slate-800">
         <button 
           onClick={() => handleSaveToCloud('alliance')}
           disabled={isLoadingCloud}
           className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.4)] disabled:opacity-50"
         >
           {isLoadingCloud ? '⏳ Salvataggio...' : '💾 Pubblica Progetto'}
         </button>
      </div>
    </aside>
  );
}