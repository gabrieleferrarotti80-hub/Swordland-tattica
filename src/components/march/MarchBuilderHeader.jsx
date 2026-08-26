import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function MarchBuilderHeader({ 
  t, 
  activeSection, 
  setActiveSection, 
  playerRealRole, 
  playerName 
}) {
  const navigate = useNavigate();

  return (
    <header className="flex flex-col md:flex-row justify-between items-center bg-slate-900/50 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/5 shadow-lg shrink-0 gap-4">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/')} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-colors">
          {t('march_builder.hub_btn')}
        </button>
        <div className="h-6 w-px bg-slate-700 hidden md:block"></div>
        
        {/* LE 4 SEZIONI PRINCIPALI */}
        <div className="flex flex-wrap bg-slate-950 rounded-lg p-1 border border-slate-800 gap-1">
           <button onClick={() => setActiveSection('settings')} className={`px-4 py-2 rounded-md text-xs font-black uppercase tracking-widest transition-all ${activeSection === 'settings' ? 'bg-cyan-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
             ⚙️ {t('march_builder.tab_settings', 'Impostazioni')}
           </button>
           
           <button onClick={() => setActiveSection('builder')} className={`px-4 py-2 rounded-md text-xs font-black uppercase tracking-widest transition-all ${activeSection === 'builder' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
             ⚔️ {t('march_builder.tab_builder', 'Marce & Preset')}
           </button>
           
           <button onClick={() => setActiveSection('results')} className={`px-4 py-2 rounded-md text-xs font-black uppercase tracking-widest transition-all ${activeSection === 'results' ? 'bg-fuchsia-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
             📊 {t('march_builder.tab_results', 'Risultati')}
           </button>

           {/* 📌 NUOVO BOTTONE ANALISI */}
           <button onClick={() => setActiveSection('analysis')} className={`px-4 py-2 rounded-md text-xs font-black uppercase tracking-widest transition-all ${activeSection === 'analysis' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
             ⚖️ {t('march_builder.tab_analysis', 'Analisi')}
           </button>
        </div>
      </div>
      
      <div className="text-right flex flex-col md:items-end">
        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{t('march_builder.active_profile')}</div>
        <div className="text-sm font-bold text-cyan-400">🛡️ {playerRealRole ? `[${playerRealRole}]` : ''} {playerName}</div>
      </div>
    </header>
  );
}