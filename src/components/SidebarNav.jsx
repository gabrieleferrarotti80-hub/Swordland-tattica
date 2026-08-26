import React from 'react';
import { useTranslation } from 'react-i18next'; // 🌍 Import i18n

export const SidebarNav = ({
  activePanel, 
  setActivePanel, 
  teamBase, 
  setTeamBase,
  handleExportProject, 
  handleImportProject, 
  handleSaveToFirebase, 
  handleLoadFromFirebase, 
  fileInputRef,
  handleNewProject
}) => {
  const { t } = useTranslation(); // 🌍 Hook di traduzione

  return (
    <nav className="w-16 bg-slate-900 border-r border-slate-800 flex flex-col items-center py-4 gap-4 z-50 shrink-0">
      
      {/* Bottoni dei Pannelli (Edifici, Roster, Schieramenti) */}
      <button onClick={() => setActivePanel('buildings')} className={`p-3 rounded-xl transition-all ${activePanel === 'buildings' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-cyan-400 hover:bg-slate-800'}`} title={t('sidebar.buildings', 'Edifici')}>🏰</button>
      <button onClick={() => setActivePanel('roster')} className={`p-3 rounded-xl transition-all ${activePanel === 'roster' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-cyan-400 hover:bg-slate-800'}`} title={t('sidebar.players', 'Giocatori')}>👥</button>
      <button onClick={() => setActivePanel('deployment')} className={`p-3 rounded-xl transition-all ${activePanel === 'deployment' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-cyan-400 hover:bg-slate-800'}`} title={t('sidebar.deployment', 'Schieramento Singoli')}>⚔️</button>

      {/* TASTO IMPOSTAZIONI / EDITOR HITBOX */}
      <button 
        onClick={() => setActivePanel('settings')} 
        className={`p-3 rounded-xl transition-all ${activePanel === 'settings' ? 'bg-amber-600 text-white' : 'text-slate-500 hover:text-amber-400 hover:bg-slate-800'}`} 
        title={t('sidebar.settings', 'Impostazioni & Editor Mappa')}
      >
        ⚙️
      </button>

      <div className="flex-1"></div>

      {/* TASTO NUOVO PROGETTO */}
      <button 
        onClick={handleNewProject} 
        className="p-3 rounded-xl transition-all text-slate-400 hover:text-emerald-400 hover:bg-slate-800 group relative" 
        title={t('sidebar.new_project', 'Nuovo Progetto')}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* Selettore del Team Base (Blue/Red) */}
      <button onClick={() => setTeamBase(prev => prev === 'blue' ? 'red' : 'blue')} className={`p-3 rounded-xl transition-all font-bold ${teamBase === 'blue' ? 'text-blue-400 hover:bg-blue-900/30' : 'text-red-400 hover:bg-red-900/30'}`} title={t('sidebar.change_faction', 'Cambia Fazione')}>
        {teamBase === 'blue' ? 'B' : 'R'}
      </button>

      {/* Pulsanti Save/Load/Import... */}
      <button onClick={handleSaveToFirebase} className="p-3 rounded-xl transition-all text-slate-400 hover:text-amber-400 hover:bg-slate-800" title={t('sidebar.save_firebase', 'Salva su Firebase')}>☁️</button>
      <button onClick={handleLoadFromFirebase} className="p-3 rounded-xl transition-all text-slate-400 hover:text-amber-400 hover:bg-slate-800" title={t('sidebar.load_firebase', 'Carica da Firebase')}>⬇️</button>
      <button onClick={handleExportProject} className="p-3 rounded-xl transition-all text-slate-400 hover:text-cyan-400 hover:bg-slate-800" title={t('sidebar.export_json', 'Esporta JSON')}>💾</button>
      <button onClick={() => fileInputRef.current?.click()} className="p-3 rounded-xl transition-all text-slate-400 hover:text-cyan-400 hover:bg-slate-800" title={t('sidebar.import_json', 'Importa JSON')}>📂</button>
      
      <input type="file" ref={fileInputRef} onChange={handleImportProject} accept=".json" className="hidden" />
    </nav>
  );
};