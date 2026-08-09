import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

export const AllianceSidebar = ({ 
  roster, 
  onUpdatePlayerCoords, 
  setDraggedPlayerId,
  allianceStructures,           // ➔ NUOVO: Array delle strutture (HQ, Trappole)
  onUpdateStructureCoords       // ➔ NUOVO: Funzione per aggiornare le strutture
}) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'positioned', 'unpositioned'

  const filteredRoster = (roster || []).filter(p => {
    const matchesSearch = (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (p.tag || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const hasCoords = typeof p.x === 'number' && typeof p.y === 'number';
    if (activeTab === 'positioned') return matchesSearch && hasCoords;
    if (activeTab === 'unpositioned') return matchesSearch && !hasCoords;
    return matchesSearch;
  });

  return (
    <div className="w-80 bg-slate-900/95 border-r border-slate-700/80 backdrop-blur-md flex flex-col h-full shadow-2xl z-20 select-none">
      
      {/* Intestazione Sidebar */}
      <div className="p-4 border-b border-slate-800">
        <h2 className="text-sm font-black text-cyan-400 uppercase tracking-wider">{t('alliance_sidebar.title')}</h2>
        <p className="text-[11px] text-slate-400 mt-0.5">{t('alliance_sidebar.subtitle')}</p>
        
        {/* Barra di ricerca */}
        <div className="mt-3">
          <input 
            type="text"
            placeholder={t('alliance_sidebar.search_placeholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
          />
        </div>

        {/* Tab di filtro rapido */}
        <div className="flex gap-1 mt-3 bg-slate-950 p-1 rounded-lg border border-slate-800 text-[10px] font-bold">
          <button 
            onClick={() => setActiveTab('all')} 
            className={`flex-1 py-1 rounded transition-colors ${activeTab === 'all' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Totale ({(roster || []).length})
          </button>
          <button 
            onClick={() => setActiveTab('positioned')} 
            className={`flex-1 py-1 rounded transition-colors ${activeTab === 'positioned' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            {t('alliance_sidebar.positioned')}
          </button>
          <button 
            onClick={() => setActiveTab('unpositioned')} 
            className={`flex-1 py-1 rounded transition-colors ${activeTab === 'unpositioned' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            {t('alliance_sidebar.unpositioned')}
          </button>
        </div>
      </div>

      {/* Lista Elementi */}
      <div className="flex-1 overflow-y-auto p-3 space-y-5 scrollbar-thin scrollbar-thumb-slate-700">
        
        {/* SEZIONE 1: STRUTTURE ALLEANZA (Visibile sempre, a meno di filtri di ricerca stretti) */}
        {allianceStructures && allianceStructures.length > 0 && activeTab === 'all' && !searchTerm && (
          <div className="space-y-2">
            <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest px-1">
              {t('alliance_sidebar.structures', 'Strutture Alleanza')}
            </div>
            
            {allianceStructures.map(struct => {
              const hasCoords = typeof struct.x === 'number' && typeof struct.y === 'number';
              const isHQ = struct.type === 'headquarters';
              const icon = isHQ ? '🏰' : '🐻';

              return (
                <div 
                  key={struct.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', `structure:${struct.id}`);
                    if (setDraggedPlayerId) setDraggedPlayerId(`structure:${struct.id}`);
                  }}
                  className="bg-indigo-900/20 border border-indigo-500/40 hover:border-indigo-400 rounded-xl p-2.5 flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing transition-all group shadow-sm"
                >
                  {/* Info Struttura */}
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-xl shrink-0 drop-shadow-md">{icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-slate-200 text-xs truncate group-hover:text-indigo-300 transition-colors">
                        {struct.name}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        [{struct.code}]
                      </div>
                    </div>
                  </div>

                  {/* Input Rapidi Coordinate Struttura */}
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-col items-center">
                      <span className="text-[8px] text-indigo-400 font-bold uppercase">{t('alliance_sidebar.coord_x')}</span>
                      <input 
                        type="number"
                        value={hasCoords ? struct.x : ''}
                        placeholder="-"
                        onChange={(e) => {
                          const val = e.target.value === '' ? '' : Number(e.target.value);
                          const currentY = hasCoords ? struct.y : 0;
                          if (onUpdateStructureCoords) onUpdateStructureCoords(struct.id, val, currentY);
                        }}
                        className="w-12 bg-slate-900 border border-indigo-900/50 focus:border-cyan-400 text-cyan-300 text-center text-xs rounded p-0.5 font-mono outline-none"
                      />
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-[8px] text-indigo-400 font-bold uppercase">{t('alliance_sidebar.coord_y')}</span>
                      <input 
                        type="number"
                        value={hasCoords ? struct.y : ''}
                        placeholder="-"
                        onChange={(e) => {
                          const val = e.target.value === '' ? '' : Number(e.target.value);
                          const currentX = hasCoords ? struct.x : 0;
                          if (onUpdateStructureCoords) onUpdateStructureCoords(struct.id, currentX, val);
                        }}
                        className="w-12 bg-slate-900 border border-indigo-900/50 focus:border-amber-400 text-amber-300 text-center text-xs rounded p-0.5 font-mono outline-none"
                      />
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        )}

        {/* SEZIONE 2: MEMBRI ALLEANZA */}
        <div className="space-y-2">
          <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">
            {t('alliance_sidebar.members', 'Membri Alleanza')}
          </div>
          
          {filteredRoster.length === 0 ? (
            <div className="text-center text-slate-500 text-xs py-8 italic">Nessun membro trovato.</div>
          ) : (
            filteredRoster.map(player => {
              const hasCoords = typeof player.x === 'number' && typeof player.y === 'number';

              return (
                <div 
                  key={player.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', `player:${player.id}`);
                    if (setDraggedPlayerId) setDraggedPlayerId(`player:${player.id}`);
                  }}
                  className="bg-slate-800/60 border border-slate-700/60 hover:border-slate-500 rounded-xl p-2.5 flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing transition-all group shadow-sm"
                >
                  {/* Info Giocatore */}
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-bold text-[10px] px-1.5 py-0.5 rounded shrink-0">
                      {player.tag || '??'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-slate-200 text-xs truncate group-hover:text-cyan-300 transition-colors">
                        {player.name}
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                        <span>{player.role || player.rank || 'R1'}</span>
                        <span>•</span>
                        <span>{player.power || 0}M</span>
                      </div>
                    </div>
                  </div>

                  {/* Input Rapidi Coordinate X e Y */}
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-col items-center">
                      <span className="text-[8px] text-slate-500 font-bold uppercase">{t('alliance_sidebar.coord_x')}</span>
                      <input 
                        type="number"
                        value={hasCoords ? player.x : ''}
                        placeholder="-"
                        onChange={(e) => {
                          const val = e.target.value === '' ? '' : Number(e.target.value);
                          const currentY = hasCoords ? player.y : 0;
                          onUpdatePlayerCoords(player.id, val, currentY);
                        }}
                        className="w-12 bg-slate-950 border border-slate-700 focus:border-cyan-400 text-cyan-300 text-center text-xs rounded p-0.5 font-mono outline-none"
                      />
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-[8px] text-slate-500 font-bold uppercase">{t('alliance_sidebar.coord_y')}</span>
                      <input 
                        type="number"
                        value={hasCoords ? player.y : ''}
                        placeholder="-"
                        onChange={(e) => {
                          const val = e.target.value === '' ? '' : Number(e.target.value);
                          const currentX = hasCoords ? player.x : 0;
                          onUpdatePlayerCoords(player.id, currentX, val);
                        }}
                        className="w-12 bg-slate-950 border border-slate-700 focus:border-amber-400 text-amber-300 text-center text-xs rounded p-0.5 font-mono outline-none"
                      />
                    </div>
                  </div>

                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
};