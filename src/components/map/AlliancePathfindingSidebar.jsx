import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PathfindingTab } from './PathfindingTab';
import { HiveLayoutTab } from './HiveLayoutTab';

export const AlliancePathfindingSidebar = ({ 
  setPathfindingMode,
  allianceStructures,
  fixedBuildings,
  validPlayers,
  roster, 
  setPathfindingData,
  setActiveView,
  userRole,
  allianceCode,
  setRoster
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('layout'); 

  const validStructures = (allianceStructures || []).filter(s => 
      s.x != null && s.y != null && !(Number(s.x) === 0 && Number(s.y) === 0)
  );

  const hq = validStructures.find(s => s.type === 'headquarters') || { type: 'headquarters', name: t('suite.hq', 'Quartier Generale'), x: 500, y: 500, size: 3 };
  const trap1 = validStructures.find(s => s.code === 'TRP1' || (s.type === 'beartrap' && s.name.includes('1'))) || { type: 'beartrap', name: t('suite.trap1', 'Trappola 1'), x: hq.x ? hq.x - 10 : 490, y: hq.y || 500 };
  const trap2 = validStructures.find(s => s.code === 'TRP2' || (s.type === 'beartrap' && s.name.includes('2'))) || { type: 'beartrap', name: t('suite.trap2', 'Trappola 2'), x: hq.x ? hq.x + 10 : 510, y: hq.y || 500 };

  return (
    <div className="w-[340px] bg-slate-900/95 border-r border-indigo-700/80 backdrop-blur-md flex flex-col h-full shadow-2xl z-20 select-none animate-fade-in">
      <div className="p-4 border-b border-indigo-900/50 flex flex-col gap-3 shrink-0 bg-slate-950/50">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-sm font-black text-indigo-400 uppercase tracking-wider flex items-center gap-2">{t('suite.title', '🛠️ Suite Tattica')}</h2>
            <p className="text-[10px] text-slate-400 mt-0.5">{t('suite.subtitle', 'Motori di Ottimizzazione')}</p>
          </div>
          <button onClick={() => { setPathfindingData(null); setPathfindingMode(false); }} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-black uppercase rounded border border-slate-700">{t('suite.close', '◀ Chiudi')}</button>
        </div>

        <div className="flex gap-1 bg-slate-900 p-1 rounded-lg border border-slate-700">
          <button onClick={() => { setActiveTab('path'); setPathfindingData(null); setActiveView('global'); }} className={`flex-1 py-1.5 text-[9px] font-black uppercase rounded ${activeTab === 'path' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>{t('suite.tab_paths', '📍 Percorsi')}</button>
          <button onClick={() => { setActiveTab('layout'); setActiveView('alliance'); }} className={`flex-1 py-1.5 text-[9px] font-black uppercase rounded ${activeTab === 'layout' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>{t('suite.tab_layout', '📐 Layout Hive')}</button>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-4 overflow-y-auto custom-scrollbar flex-1">
        {activeTab === 'path' && (
          <PathfindingTab 
            hq={hq} trap1={trap1} trap2={trap2} 
            validStructures={validStructures} fixedBuildings={fixedBuildings} 
            setPathfindingData={setPathfindingData} 
            userRole={userRole} allianceCode={allianceCode} 
            validPlayers={validPlayers} roster={roster} 
          />
        )}
        {activeTab === 'layout' && (
          <HiveLayoutTab 
            hq={hq} trap1={trap1} trap2={trap2} 
            roster={roster} setRoster={setRoster} validPlayers={validPlayers} 
            setPathfindingData={setPathfindingData} 
            userRole={userRole} allianceCode={allianceCode} 
          />
        )}
      </div>
    </div>
  );
};