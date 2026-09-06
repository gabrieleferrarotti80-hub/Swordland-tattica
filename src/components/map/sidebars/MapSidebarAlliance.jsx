import React, { useState, useEffect, useRef, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

// SCUDO SUGLI INPUT
const CoordInput = memo(({ initialValue, onSave, placeholder, disabled, className }) => {
  const inputRef = useRef(null);
  useEffect(() => {
    if (inputRef.current && document.activeElement !== inputRef.current) {
      inputRef.current.value = initialValue !== undefined && initialValue !== null ? initialValue : '';
    }
  }, [initialValue]);
  const handleBlur = () => {
    if (!inputRef.current) return;
    const val = inputRef.current.value;
    const numericVal = val === '' ? '' : Number(val);
    if (numericVal !== initialValue) onSave(numericVal);
  };
  const handleKeyDown = (e) => { if (e.key === 'Enter') e.target.blur(); };
  return (
    <input ref={inputRef} type="number" disabled={disabled} placeholder={placeholder} defaultValue={initialValue ?? ''} onBlur={handleBlur} onKeyDown={handleKeyDown} className={className} />
  );
});

function MapSidebarAlliance({
  roster, setRoster, isReadOnly,
  hiveGridMeta, setHiveGridMeta,
  allianceStructures, setAllianceStructures, handleAllianceStructureChange,
  playerOverrides, setPlayerOverrides,
  onOpenHelp, handleSaveToCloud, isLoadingCloud,
  isMapUnlocked, setIsMapUnlocked,
  setActiveView, setPathfindingMode
}) {
  const navigate = useNavigate();
  const { t } = useTranslation(); 
  
  const [searchQuery, setSearchQuery] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [isRosterOpen, setIsRosterOpen] = useState(false);

  const rawArray = Array.isArray(roster) ? roster : (roster?.players || []);
  const rosterArray = rawArray.filter(p => p !== null && p !== undefined);

  const filteredRoster = rosterArray.filter(p => {
    const term = searchQuery.toLowerCase();
    return (p.name?.toLowerCase().includes(term) || p.tag?.toLowerCase().includes(term) || p.originalTag?.toLowerCase().includes(term));
  });

  const addTerritoryPoint = () => {
    if (isReadOnly) return;
    setHiveGridMeta({...hiveGridMeta, territory: [...(hiveGridMeta.territory || []), { x: '', y: '' }]});
  };

  const updateTerritoryPoint = (index, field, value) => {
    if (isReadOnly) return;
    const newTerritory = [...(hiveGridMeta.territory || [])];
    newTerritory[index][field] = value === '' ? '' : Number(value);
    setHiveGridMeta({ ...hiveGridMeta, territory: newTerritory });
  };

  const removeTerritoryPoint = (index) => {
    if (isReadOnly) return;
    const newTerritory = [...(hiveGridMeta.territory || [])];
    newTerritory.splice(index, 1);
    setHiveGridMeta({ ...hiveGridMeta, territory: newTerritory });
  };

  const updatePlayerCoords = (playerId, field, val, currentX, currentY) => {
    const numVal = val === '' ? '' : Number(val);
    if (setPlayerOverrides) setPlayerOverrides(prev => ({ ...prev, [playerId]: { x: field === 'x' ? numVal : (currentX || 0), y: field === 'y' ? numVal : (currentY || 0) } }));
    if (setRoster) setRoster(prev => prev.map(p => p.id === playerId ? { ...p, [field]: numVal } : p));
  };

  const handleStructureCoordSave = (struct, field, val) => {
    if (isReadOnly) return;
    const numVal = val === '' ? '' : Number(val);
    if (handleAllianceStructureChange) handleAllianceStructureChange(struct.id, field, numVal);
  };

  return (
    <aside className="w-[340px] bg-slate-900 border-r border-slate-800 flex flex-col p-5 gap-4 z-20 shadow-2xl shrink-0 overflow-hidden select-none">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-black tracking-wider text-indigo-400">{t('sidebar.hive_management', 'Gestione Alveare')}</h2>
          <button onClick={() => setShowHelp(!showHelp)} className="w-6 h-6 flex items-center justify-center bg-slate-800 hover:bg-indigo-900 text-indigo-400 rounded-full border border-slate-700 transition-colors text-xs font-bold" title={t('map_sidebar.guide_tooltip', 'Guida')}>?</button>
        </div>
        <button onClick={() => navigate('/')} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg border border-slate-700 transition-colors">🏠</button>
      </div>

      {isReadOnly && (
        <div className="bg-rose-950/40 border border-rose-500/50 rounded-lg p-2 text-[10px] text-rose-300 font-bold text-center uppercase tracking-wider shadow-inner">
          {t('map_sidebar.readonly_mode', '🔒 Modalità Sola Lettura')}
        </div>
      )}

      {showHelp && (
        <div className="bg-indigo-950/30 border border-indigo-500/50 rounded-xl p-3 text-xs text-indigo-100 shadow-inner leading-relaxed animate-fade-in shrink-0">
          <strong>{t('map_sidebar.hive_guide_title', '💡 Guida Alveare:')}</strong> Clicca su "Disegna" per tracciare il territorio principale. Usa il pulsante "+ Stendardo" per creare segnalini con raggio 6x6. Scegli il colore dell'alleanza con lo slider globale.
        </div>
      )}

      <div className="flex flex-col gap-2 shrink-0">
        <button 
          onClick={() => setActiveView('expansion')}
          className="w-full py-2 bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/50 text-blue-300 font-black text-[10px] uppercase tracking-widest rounded transition-all shadow-[0_0_10px_rgba(59,130,246,0.2)] flex justify-center items-center gap-2"
        >
          🗺️ {t('sidebar.global_expansion_planner', 'Pianificatore Espansione Globale')}
        </button>
        
        <button 
          onClick={() => setPathfindingMode && setPathfindingMode(true)}
          className="w-full py-2 bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-500/50 text-emerald-300 font-black text-[10px] uppercase tracking-widest rounded transition-all shadow-[0_0_10px_rgba(16,185,129,0.2)] flex justify-center items-center gap-2"
        >
          📡 {t('sidebar.tactical_suite_routes', 'Suite Tattica & Percorsi')}
        </button>
      </div>

      <div className="relative shrink-0">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs">🔍</span>
        <input type="text" placeholder={t('sidebar.search_member', 'Cerca membro...')} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-slate-950 border border-slate-700 text-white text-xs pl-7 pr-3 py-2 rounded focus:outline-none focus:border-indigo-500 transition-colors" />
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 flex flex-col gap-4">
        
        <div className={`p-3 rounded-xl border flex flex-col gap-2 transition-colors ${hiveGridMeta?.isDrawing ? 'bg-emerald-950/40 border-emerald-500' : 'bg-slate-950 border-emerald-900/50'}`}>
          <div className="flex justify-between items-center">
            <span className={`text-[10px] font-black uppercase tracking-widest ${hiveGridMeta?.isDrawing ? 'text-emerald-300' : 'text-emerald-400'}`}>{t('sidebar.main_territory', 'Territorio Principale')}</span>
            <div className="flex gap-1">
              {!isReadOnly && (
                <button onClick={() => setHiveGridMeta({...hiveGridMeta, isDrawing: !hiveGridMeta?.isDrawing})} className={`px-2 py-1 rounded text-[9px] font-bold uppercase transition-colors flex items-center gap-1 ${hiveGridMeta?.isDrawing ? 'bg-rose-600 text-white shadow-[0_0_10px_rgba(225,29,72,0.6)]' : 'bg-emerald-900/50 hover:bg-emerald-800 text-emerald-300'}`}>
                  {hiveGridMeta?.isDrawing ? '⏹️ ' + t('sidebar.close', 'Chiudi') : '✏️ ' + t('sidebar.draw', 'Disegna')}
                </button>
              )}
              {!isReadOnly && (
                <button onClick={addTerritoryPoint} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded text-[9px] font-bold uppercase transition-colors" title="Aggiungi punto manuale">+</button>
              )}
            </div>
          </div>
          
          {hiveGridMeta?.territory?.length > 0 ? (
            <div className="flex flex-col gap-2 mt-1 animate-fade-in">
              {hiveGridMeta.territory.map((point, index) => (
                <div key={index} className="flex items-center gap-2 bg-slate-900 p-1.5 rounded-lg border border-slate-800">
                  <span className="text-[9px] text-slate-500 font-bold w-4">{index + 1}.</span>
                  <div className="flex-1 flex gap-1">
                    <div className="flex-1 flex flex-col min-w-0">
                      <CoordInput disabled={isReadOnly || hiveGridMeta?.isDrawing} initialValue={point.x} onSave={val => updateTerritoryPoint(index, 'x', val)} placeholder="X" className="w-full bg-slate-950 border border-slate-700 text-xs text-emerald-300 px-1 py-1 rounded outline-none focus:border-emerald-500 text-center font-mono disabled:opacity-50" />
                    </div>
                    <div className="flex-1 flex flex-col min-w-0">
                      <CoordInput disabled={isReadOnly || hiveGridMeta?.isDrawing} initialValue={point.y} onSave={val => updateTerritoryPoint(index, 'y', val)} placeholder="Y" className="w-full bg-slate-950 border border-slate-700 text-xs text-emerald-300 px-1 py-1 rounded outline-none focus:border-emerald-500 text-center font-mono disabled:opacity-50" />
                    </div>
                  </div>
                  {!isReadOnly && (
                    <button onClick={() => removeTerritoryPoint(index)} className="w-6 h-6 flex items-center justify-center bg-rose-950/50 text-rose-400 hover:bg-rose-900 rounded border border-rose-900/50 transition-colors">×</button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[9px] text-slate-500 italic text-center py-2">
              {t('sidebar.auto_bounds_desc', 'Confini auto-generati. Clicca Disegna per crearli.')}
            </div>
          )}
        </div>

        <div className="px-4 py-2 border-b border-slate-800/80 shrink-0">
          <button
            onClick={() => setIsMapUnlocked(!isMapUnlocked)}
            className={`w-full py-2 px-4 rounded-xl font-black tracking-wider text-xs uppercase transition-all shadow-lg border flex items-center justify-center gap-2 ${
              isMapUnlocked ? 'bg-rose-500/10 text-rose-400 border-rose-500/50 hover:bg-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/50 hover:bg-emerald-500/20'
            }`}
          >
            {isMapUnlocked ? "🔴 " + t('sidebar.map_unlocked', 'Mappa Sbloccata') : "🟢 " + t('sidebar.map_locked', 'Mappa Bloccata')}
          </button>
        </div>

        <div className="flex flex-col gap-2 mt-2">
          <div className="flex flex-col p-3 bg-slate-950 border border-indigo-900/50 rounded-xl gap-2">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{t('sidebar.alliance_structures', 'Strutture Alleanza')}</span>
              <div className="flex gap-1">
                <button onClick={() => setHiveGridMeta({...hiveGridMeta, showBanners: hiveGridMeta?.showBanners === false ? true : false})} className={`px-2 py-1 rounded text-[9px] font-bold uppercase transition-colors flex items-center gap-1 ${hiveGridMeta?.showBanners !== false ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                  {hiveGridMeta?.showBanners !== false ? '👁️ ' + t('sidebar.areas_6x6', 'Aree 6x6') : '🙈 ' + t('sidebar.areas_6x6', 'Aree 6x6')}
                </button>
                {!isReadOnly && setAllianceStructures && (
                  <button onClick={() => {
                      const newBanner = { id: `banner-${Date.now()}`, code: 'BAN', name: 'Stendardo', type: 'banner', x: 600, y: 600 };
                      setAllianceStructures([...(allianceStructures || []), newBanner]);
                    }} className="bg-purple-900/50 hover:bg-purple-800 text-purple-300 px-2 py-1 rounded text-[9px] font-bold uppercase transition-colors">
                    + {t('sidebar.banner', 'Stendardo')}
                  </button>
                )}
              </div>
            </div>
            
            {!isReadOnly && (
              <div className="flex items-center gap-3 pt-2 border-t border-slate-800 mt-2">
                <span className="text-[8px] font-bold uppercase text-purple-400 whitespace-nowrap">{t('sidebar.tint', 'Tinta')}</span>
                <input 
                  type="range" min="0" max="360" 
                  value={hiveGridMeta?.bannerHue || 0} 
                  onChange={(e) => setHiveGridMeta({...hiveGridMeta, bannerHue: Number(e.target.value)})} 
                  className="flex-1 h-2 rounded-full cursor-pointer outline-none shadow-inner"
                  style={{ background: 'linear-gradient(to right, #fb7185, #fbbf24, #4ade80, #2dd4bf, #60a5fa, #c084fc, #fb7185)', accentColor: '#f8fafc' }}
                />
                <div className="w-5 h-5 rounded-full border-2 border-slate-700 shadow-md shrink-0" style={{ backgroundColor: '#fb7185', filter: `hue-rotate(${hiveGridMeta?.bannerHue || 0}deg) saturate(1.2)` }} title="Anteprima Colore"></div>
              </div>
            )}
          </div>
          
          {allianceStructures && allianceStructures.length > 0 && (
            allianceStructures.map(struct => {
              const isHQ = struct.type === 'headquarters';
              const isBanner = struct.type === 'banner';
              const icon = isHQ ? '🏰' : (isBanner ? '🚩' : '🐻');
              const borderColor = isBanner ? 'border-purple-500' : 'border-indigo-500';
              const bgColor = isBanner ? 'bg-purple-900/10' : 'bg-indigo-900/20';

              return (
                <div key={struct.id} draggable={!isReadOnly} onDragStart={(e) => { e.dataTransfer.setData('text/plain', `structure:${struct.id}`); }} className={`${bgColor} border p-2.5 rounded-xl flex items-center justify-between gap-2 transition-all group shadow-sm ${isReadOnly ? `${borderColor}/20 opacity-80` : `${borderColor}/40 hover:${borderColor} cursor-grab active:cursor-grabbing`}`}>
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-xl shrink-0 drop-shadow-md">{icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-slate-200 text-xs truncate group-hover:text-indigo-300 transition-colors">{struct.name}</div>
                      <div className="text-[9px] text-slate-500">[{struct.code}]</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-col items-center">
                      <span className={`text-[8px] font-bold uppercase ${isBanner ? 'text-purple-400' : 'text-indigo-400'}`}>{t('alliance_sidebar.coord_x', 'X')}</span>
                      <CoordInput disabled={isReadOnly} initialValue={struct.x} placeholder="-" onSave={(val) => handleStructureCoordSave(struct, 'x', val)} className={`w-12 bg-slate-900 border ${isBanner ? 'border-purple-900/50 focus:border-purple-400 text-purple-300' : 'border-indigo-900/50 focus:border-cyan-400 text-cyan-300'} text-center text-xs rounded p-0.5 font-mono outline-none disabled:opacity-50`} />
                    </div>
                    <div className="flex flex-col items-center">
                      <span className={`text-[8px] font-bold uppercase ${isBanner ? 'text-purple-400' : 'text-indigo-400'}`}>{t('alliance_sidebar.coord_y', 'Y')}</span>
                      <CoordInput disabled={isReadOnly} initialValue={struct.y} placeholder="-" onSave={(val) => handleStructureCoordSave(struct, 'y', val)} className={`w-12 bg-slate-900 border ${isBanner ? 'border-purple-900/50 focus:border-purple-400 text-purple-300' : 'border-indigo-900/50 focus:border-amber-400 text-amber-300'} text-center text-xs rounded p-0.5 font-mono outline-none disabled:opacity-50`} />
                    </div>
                    {isBanner && !isReadOnly && setAllianceStructures && (
                      <button onClick={() => setAllianceStructures(prev => prev.filter(s => s.id !== struct.id))} className="w-5 h-5 flex items-center justify-center bg-rose-950/50 text-rose-400 hover:bg-rose-900 rounded border border-rose-900/50 transition-colors ml-1" title="Rimuovi Stendardo">×</button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex flex-col mt-2">
          <div 
            className={`flex justify-between items-center cursor-pointer p-2 rounded-lg transition-colors border ${isRosterOpen ? 'bg-slate-800 border-slate-700' : 'bg-slate-900 hover:bg-slate-800 border-slate-800'}`}
            onClick={() => setIsRosterOpen(!isRosterOpen)}
          >
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('map.alliance_roster', 'Roster Giocatori')}</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-500 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">{filteredRoster.length} Membri</span>
              <span className="text-slate-500 text-xs transition-transform duration-200" style={{ transform: isRosterOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
            </div>
          </div>
          
          {isRosterOpen && (
            <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-slate-800 animate-fade-in">
              {filteredRoster.length === 0 ? (
                <div className="text-center text-xs text-slate-500 italic py-4">{t('map.no_players_found', 'Nessun giocatore trovato')}</div>
              ) : (
                filteredRoster.map(player => {
                  const override = playerOverrides[player.id];
                  const currentX = override ? override.x : (player.x ?? '');
                  const currentY = override ? override.y : (player.y ?? '');
                  const hasCoords = currentX !== '' && currentY !== '';

                  return (
                    <div key={player.id} draggable={!isReadOnly} onDragStart={(e) => { e.dataTransfer.setData('text/plain', `player:${player.id}`); }} className={`bg-slate-950/80 border p-2 rounded-xl flex items-center justify-between gap-2 transition-all group shadow-sm ${isReadOnly ? 'border-slate-800 opacity-80' : 'border-slate-800 hover:border-slate-600 cursor-grab active:cursor-grabbing'}`}>
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="bg-indigo-950 border border-indigo-500/40 text-indigo-300 font-bold text-[10px] px-1.5 py-0.5 rounded shrink-0">{player.tag || player.role || 'R1'}</span>
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-slate-200 text-xs truncate group-hover:text-indigo-300 transition-colors">{player.name}</div>
                          <div className="text-[9px] text-slate-500">{hasCoords ? `(${currentX}, ${currentY})` : t('alliance_sidebar.unpositioned', 'Senza coordinate')}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-col items-center">
                          <span className="text-[8px] text-slate-500 font-bold uppercase">{t('alliance_sidebar.coord_x', 'X')}</span>
                          <CoordInput disabled={isReadOnly} initialValue={currentX} placeholder="-" onSave={(val) => updatePlayerCoords(player.id, 'x', val, currentX, currentY)} className="w-10 bg-slate-900 border border-slate-700 focus:border-cyan-400 text-cyan-300 text-center text-[10px] rounded p-0.5 font-mono outline-none disabled:opacity-50" />
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-[8px] text-slate-500 font-bold uppercase">{t('alliance_sidebar.coord_y', 'Y')}</span>
                          <CoordInput disabled={isReadOnly} initialValue={currentY} placeholder="-" onSave={(val) => updatePlayerCoords(player.id, 'y', val, currentX, currentY)} className="w-10 bg-slate-900 border border-slate-700 focus:border-amber-400 text-amber-300 text-center text-[10px] rounded p-0.5 font-mono outline-none disabled:opacity-50" />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

     {!isReadOnly && (
        <div className="pt-4 border-t border-slate-800 shrink-0 mt-auto">
          <button 
            onClick={() => {
              if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
              setTimeout(() => handleSaveToCloud('alliance'), 150);
            }} 
            disabled={isLoadingCloud}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-[0_0_15px_rgba(79,70,229,0.4)] flex justify-center items-center gap-2 disabled:opacity-50"
          >
            {isLoadingCloud ? '⏳ Salvataggio...' : '☁️ Salva in Cloud'}
          </button>
        </div>
      )}
    </aside>
  );
}

// LO SCUDO DI TITANIO PER LA SIDEBAR
export default memo(MapSidebarAlliance, (prev, next) => {
  return prev.roster === next.roster &&
         prev.allianceStructures === next.allianceStructures &&
         prev.hiveGridMeta === next.hiveGridMeta &&
         prev.playerOverrides === next.playerOverrides &&
         prev.isMapUnlocked === next.isMapUnlocked &&
         prev.isLoadingCloud === next.isLoadingCloud &&
         prev.isReadOnly === next.isReadOnly;
});