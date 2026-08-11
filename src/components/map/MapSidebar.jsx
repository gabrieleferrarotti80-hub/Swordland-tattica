import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next'; 

const getPlayerRank = (role) => {
  if (!role) return 'other';
  const r = String(role).toUpperCase().trim();
  if (r === 'R5' || r === '5' || r.includes('LEADER') || r.includes('CAPO')) return 'R5';
  if (r === 'R4' || r === '4' || r.includes('OFFICER') || r.includes('UFFICIALE')) return 'R4';
  return 'other';
};

export default function MapSidebar({
  roster, selectedTool, setSelectedTool,
  filters, toggleFilter, toggleAllFilters, areAllFiltersActive,
  showLabels, setShowLabels,
  marchOrigin, setMarchOrigin, marchDestination, setMarchDestination,
  marchResult, handleManualCoord,
  fixedBuildings, handleBuildingChange, handleAddBuilding, handleDeleteBuilding,
  handleSaveToCloud, isLoadingCloud, selectedBuilding,
  allianceStructures, handleAllianceStructureChange,
  activeView,
  handleSaveSimulation, 
  isSavingSim,          
  openExportModal,
  tacticalMeta,
  setTacticalMeta,
  setSelectedBuilding,
  userRole,
  playerOverrides = {},      
  setPlayerOverrides = () => {},
  hiveGridMeta = { centerX: 500, centerY: 500, radius: 30, showGrid: true, territory: [] },
  setHiveGridMeta = () => {},
  isReadOnly
}) {
  const navigate = useNavigate();
  const { t } = useTranslation(); 
  
  const [searchQuery, setSearchQuery] = useState('');
  const [showHelp, setShowHelp] = useState(false);

  const rawArray = Array.isArray(roster) ? roster : (roster?.players || []);
  const rosterArray = rawArray.filter(p => p !== null && p !== undefined);

  const currentParticipants = tacticalMeta?.participants || [];

  const toggleParticipant = (id) => {
    if (isReadOnly) return;
    let newPart = [...currentParticipants];
    if (newPart.includes(id)) newPart = newPart.filter(x => x !== id);
    else newPart.push(id);
    setTacticalMeta({...tacticalMeta, participants: newPart});
  };

  const toggleAllParticipants = () => {
    if (isReadOnly) return;
    if (currentParticipants.length > 0) {
      setTacticalMeta({...tacticalMeta, participants: []});
    } else {
      setTacticalMeta({...tacticalMeta, participants: rosterArray.map(p => p.id)});
    }
  };

  const filteredRoster = rosterArray.filter(p => {
    const term = searchQuery.toLowerCase();
    return (p.name?.toLowerCase().includes(term) || p.tag?.toLowerCase().includes(term));
  });

  const addTerritoryPoint = () => {
    if (isReadOnly) return;
    setHiveGridMeta({
      ...hiveGridMeta,
      territory: [...(hiveGridMeta.territory || []), { x: '', y: '' }]
    });
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

  // --- SE SIAMO NELLA VISTA ALLIANCE (HIVE MANAGEMENT) ---
  if (activeView === 'alliance') {
    return (
      <aside className="w-[340px] bg-slate-900 border-r border-slate-800 flex flex-col p-5 gap-4 z-20 shadow-2xl shrink-0 overflow-hidden select-none">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-black tracking-wider text-indigo-400">{t('alliance_sidebar.title', 'Gestione Alveare')}</h2>
            <button onClick={() => setShowHelp(!showHelp)} className="w-6 h-6 flex items-center justify-center bg-slate-800 hover:bg-indigo-900 text-indigo-400 rounded-full border border-slate-700 transition-colors text-xs font-bold">?</button>
          </div>
          <button onClick={() => navigate('/')} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg border border-slate-700 transition-colors">🏠</button>
        </div>

        {isReadOnly && (
          <div className="bg-rose-950/40 border border-rose-500/50 rounded-lg p-2 text-[10px] text-rose-300 font-bold text-center uppercase tracking-wider shadow-inner">
            🔒 Modalità Sola Lettura
          </div>
        )}

        {showHelp && (
          <div className="bg-indigo-950/30 border border-indigo-500/50 rounded-xl p-3 text-xs text-indigo-100 shadow-inner leading-relaxed animate-fade-in shrink-0">
            <strong>💡 Guida Alveare:</strong> Trascina i giocatori dalla lista direttamente in mappa. Accendi la <em>Griglia Olografica</em> per centrarla su una trappola e definisci i confini aggiungendo punti al <em>Territorio</em>.
          </div>
        )}

        <div className="relative shrink-0">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs">🔍</span>
          <input 
            type="text" 
            placeholder={t('alliance_sidebar.search_placeholder', 'Cerca...')} 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 text-white text-xs pl-7 pr-3 py-2 rounded focus:outline-none focus:border-indigo-500 transition-colors" 
          />
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 flex flex-col gap-4">
          
          <div className="bg-slate-950 p-3 rounded-xl border border-cyan-900/50 flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest">{t('map.hive_grid', 'Griglia Olografica')}</span>
              <input type="checkbox" className="accent-cyan-500 w-4 h-4 cursor-pointer" checked={hiveGridMeta.showGrid} onChange={e => !isReadOnly && setHiveGridMeta({...hiveGridMeta, showGrid: e.target.checked})} disabled={isReadOnly} />
            </div>
            
            {hiveGridMeta.showGrid && (
              <div className="flex flex-col gap-2 mt-1 animate-fade-in">
                <div className="flex gap-2">
                  <div className="flex flex-col flex-1">
                    <label className="text-[8px] text-slate-500 uppercase font-bold mb-0.5">{t('map.center_x', 'Centro X')}</label>
                    <input disabled={isReadOnly} type="number" value={hiveGridMeta.centerX} onChange={e => setHiveGridMeta({...hiveGridMeta, centerX: Number(e.target.value)})} className="bg-slate-900 border border-slate-700 text-xs text-white px-2 py-1.5 rounded outline-none focus:border-cyan-500 text-center font-mono disabled:opacity-50"/>
                  </div>
                  <div className="flex flex-col flex-1">
                    <label className="text-[8px] text-slate-500 uppercase font-bold mb-0.5">{t('map.center_y', 'Centro Y')}</label>
                    <input disabled={isReadOnly} type="number" value={hiveGridMeta.centerY} onChange={e => setHiveGridMeta({...hiveGridMeta, centerY: Number(e.target.value)})} className="bg-slate-900 border border-slate-700 text-xs text-white px-2 py-1.5 rounded outline-none focus:border-cyan-500 text-center font-mono disabled:opacity-50"/>
                  </div>
                  <div className="flex flex-col flex-1">
                    <label className="text-[8px] text-slate-500 uppercase font-bold mb-0.5">{t('map.radius', 'Raggio')}</label>
                    <input disabled={isReadOnly} type="number" value={hiveGridMeta.radius} onChange={e => setHiveGridMeta({...hiveGridMeta, radius: Number(e.target.value)})} min="10" max="100" className="bg-slate-900 border border-slate-700 text-xs text-white px-2 py-1.5 rounded outline-none focus:border-cyan-500 text-center font-mono disabled:opacity-50"/>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-slate-950 p-3 rounded-xl border border-indigo-900/50 flex flex-col gap-2">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{t('map.territory', 'Confini Territorio')}</span>
            </div>
            
            <div className="flex flex-col gap-2 mt-1 max-h-[150px] overflow-y-auto custom-scrollbar pr-1">
              {(hiveGridMeta.territory || []).map((pt, idx) => (
                <div key={idx} className="flex gap-2 items-center bg-slate-900 p-1.5 rounded border border-slate-800">
                  <span className="text-[9px] font-bold text-slate-500 w-4 text-center">{idx + 1}</span>
                  <input disabled={isReadOnly} type="number" placeholder="X" value={pt.x} onChange={e => updateTerritoryPoint(idx, 'x', e.target.value)} className="w-16 bg-slate-950 border border-slate-700 text-xs text-cyan-300 px-1 py-1 rounded outline-none focus:border-indigo-500 text-center font-mono disabled:opacity-50" />
                  <input disabled={isReadOnly} type="number" placeholder="Y" value={pt.y} onChange={e => updateTerritoryPoint(idx, 'y', e.target.value)} className="w-16 bg-slate-950 border border-slate-700 text-xs text-amber-300 px-1 py-1 rounded outline-none focus:border-indigo-500 text-center font-mono disabled:opacity-50" />
                  {!isReadOnly && <button onClick={() => removeTerritoryPoint(idx)} className="text-slate-600 hover:text-rose-400 font-bold px-1 ml-auto">✕</button>}
                </div>
              ))}
            </div>

            {!isReadOnly && (
              <button onClick={addTerritoryPoint} className="w-full bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 py-2 rounded border border-slate-700 transition-colors uppercase mt-1">
                + Aggiungi Punto
              </button>
            )}
          </div>

          {allianceStructures && allianceStructures.length > 0 && !searchQuery && (
            <div className="flex flex-col gap-2 mt-2">
              <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{t('map.alliance_structures', 'Strutture')}</span>
              {allianceStructures.map(struct => {
                const isHQ = struct.type === 'headquarters';
                const hasCoords = typeof struct.x === 'number' && typeof struct.y === 'number';

                return (
                  <div 
                    key={struct.id}
                    draggable={!isReadOnly} 
                    onDragStart={(e) => { e.dataTransfer.setData('text/plain', `structure:${struct.id}`); }}
                    className={`bg-indigo-900/20 border p-2.5 rounded-xl flex items-center justify-between gap-2 transition-all group shadow-sm ${isReadOnly ? 'border-indigo-500/20 opacity-80' : 'border-indigo-500/40 hover:border-indigo-400 cursor-grab active:cursor-grabbing'}`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-xl shrink-0 drop-shadow-md">{isHQ ? '🏰' : '🐻'}</span>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-slate-200 text-xs truncate group-hover:text-indigo-300 transition-colors">
                          {struct.name}
                        </div>
                        <div className="text-[9px] text-slate-500">[{struct.code}]</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-col items-center">
                        <span className="text-[8px] text-indigo-400 font-bold uppercase">{t('alliance_sidebar.coord_x', 'X')}</span>
                        <input disabled={isReadOnly} type="number" value={hasCoords ? struct.x : ''} placeholder="-" onChange={(e) => handleAllianceStructureChange(struct.id, 'x', e.target.value)} className="w-12 bg-slate-900 border border-indigo-900/50 focus:border-cyan-400 text-cyan-300 text-center text-xs rounded p-0.5 font-mono outline-none disabled:opacity-50" />
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-[8px] text-indigo-400 font-bold uppercase">{t('alliance_sidebar.coord_y', 'Y')}</span>
                        <input disabled={isReadOnly} type="number" value={hasCoords ? struct.y : ''} placeholder="-" onChange={(e) => handleAllianceStructureChange(struct.id, 'y', e.target.value)} className="w-12 bg-slate-900 border border-indigo-900/50 focus:border-amber-400 text-amber-300 text-center text-xs rounded p-0.5 font-mono outline-none disabled:opacity-50" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('map.alliance_roster', 'Roster')}</span>
            {filteredRoster.length === 0 ? (
              <div className="text-center text-xs text-slate-500 italic py-8">{t('map.no_players_found')}</div>
            ) : (
              filteredRoster.map(player => {
                const override = playerOverrides[player.id];
                const currentX = override ? override.x : (player.x ?? '');
                const currentY = override ? override.y : (player.y ?? '');
                const hasCoords = currentX !== '' && currentY !== '';

                return (
                  <div 
                    key={player.id}
                    draggable={!isReadOnly} 
                    onDragStart={(e) => { e.dataTransfer.setData('text/plain', `player:${player.id}`); }}
                    className={`bg-slate-950/80 border p-2.5 rounded-xl flex items-center justify-between gap-2 transition-all group shadow-sm ${isReadOnly ? 'border-slate-800 opacity-80' : 'border-slate-800 hover:border-slate-600 cursor-grab active:cursor-grabbing'}`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="bg-indigo-950 border border-indigo-500/40 text-indigo-300 font-bold text-[10px] px-1.5 py-0.5 rounded shrink-0">
                        {player.tag || '??'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-slate-200 text-xs truncate group-hover:text-indigo-300 transition-colors">
                          {player.name}
                        </div>
                        <div className="text-[9px] text-slate-500">
                          {hasCoords ? `(${currentX}, ${currentY})` : t('alliance_sidebar.unpositioned', 'Senza coordinate')}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-col items-center">
                        <span className="text-[8px] text-slate-500 font-bold uppercase">{t('alliance_sidebar.coord_x', 'X')}</span>
                        <input disabled={isReadOnly} type="number" value={currentX} placeholder="-" onChange={(e) => { const val = e.target.value === '' ? '' : Number(e.target.value); setPlayerOverrides(prev => ({...prev, [player.id]: { x: val, y: currentY === '' ? 0 : currentY }})); }} className="w-12 bg-slate-900 border border-slate-700 focus:border-cyan-400 text-cyan-300 text-center text-xs rounded p-0.5 font-mono outline-none disabled:opacity-50" />
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-[8px] text-slate-500 font-bold uppercase">{t('alliance_sidebar.coord_y', 'Y')}</span>
                        <input disabled={isReadOnly} type="number" value={currentY} placeholder="-" onChange={(e) => { const val = e.target.value === '' ? '' : Number(e.target.value); setPlayerOverrides(prev => ({...prev, [player.id]: { x: currentX === '' ? 0 : currentX, y: val }})); }} className="w-12 bg-slate-900 border border-slate-700 focus:border-amber-400 text-amber-300 text-center text-xs rounded p-0.5 font-mono outline-none disabled:opacity-50" />
                      </div>
                    </div>

                  </div>
                );
              })
            )}
          </div>
        </div>

        {!isReadOnly && (
          <button 
            onClick={handleSaveToCloud} 
            disabled={isLoadingCloud}
            className="w-full bg-indigo-700 hover:bg-indigo-600 text-white text-[10px] font-black uppercase tracking-wider py-3 rounded-lg shadow-lg transition-colors disabled:opacity-50 shrink-0"
          >
            {isLoadingCloud ? t('map.saving') : t('map.save_plan')}
          </button>
        )}
      </aside>
    );
  }

  // --- VISTA TACTICAL ---
  if (activeView === 'tactical') {
    return (
      <aside className="w-[340px] bg-slate-900 border-r border-slate-800 flex flex-col p-5 gap-4 z-20 shadow-2xl shrink-0 overflow-hidden">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-black tracking-wider text-rose-500">{t('map.tactical_room')}</h2>
            <button onClick={() => setShowHelp(!showHelp)} className="w-6 h-6 flex items-center justify-center bg-slate-800 hover:bg-rose-900 text-rose-400 rounded-full border border-slate-700 transition-colors text-xs font-bold">?</button>
          </div>
          <button onClick={() => navigate('/')} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg border border-slate-700 transition-colors">🏠</button>
        </div>

        {isReadOnly && (
          <div className="bg-rose-950/40 border border-rose-500/50 rounded-lg p-2 text-[10px] text-rose-300 font-bold text-center uppercase tracking-wider shadow-inner">
            🔒 Solo Visualizzazione
          </div>
        )}

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 flex flex-col gap-4 mt-2">
          <div className="bg-slate-950 p-4 rounded-xl border border-rose-900/50 flex flex-col gap-3">
            <h3 className="text-xs font-black text-rose-400 uppercase tracking-wider mb-1">{t('map.event_details')}</h3>
            
            {tacticalMeta?.author === 'ADMIN' && (
              <div className="bg-gradient-to-r from-amber-500/20 to-yellow-500/10 border border-amber-500/50 p-2 rounded-lg flex items-center justify-center gap-2 mb-2 shadow-inner">
                <span className="text-lg drop-shadow-md">👑</span>
                <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider">{t('map.master_approved')}</span>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">{t('map.event_name')}</label>
              <input disabled={isReadOnly} type="text" value={tacticalMeta?.eventName || ''} onChange={(e) => setTacticalMeta({...tacticalMeta, eventName: e.target.value})} className="bg-slate-900 border border-slate-700 text-white text-xs px-3 py-2 rounded focus:outline-none focus:border-rose-500 transition-colors disabled:opacity-50" placeholder={t('map.event_name_placeholder')} />
            </div>

            <div className="flex gap-2">
              <div className="flex flex-col gap-1 w-full">
                <label className="text-[10px] font-bold text-slate-500 uppercase">{t('map.date')}</label>
                <input disabled={isReadOnly} type="date" value={tacticalMeta?.date || ''} onChange={(e) => setTacticalMeta({...tacticalMeta, date: e.target.value})} className="bg-slate-900 border border-slate-700 text-white text-xs px-2 py-2 rounded focus:outline-none focus:border-rose-500 transition-colors disabled:opacity-50" />
              </div>
              <div className="flex flex-col gap-1 w-full">
                <label className="text-[10px] font-bold text-slate-500 uppercase">{t('map.start_time')}</label>
                <input disabled={isReadOnly} type="time" value={tacticalMeta?.time || ''} onChange={(e) => setTacticalMeta({...tacticalMeta, time: e.target.value})} className="bg-slate-900 border border-slate-700 text-white text-xs px-2 py-2 rounded focus:outline-none focus:border-rose-500 transition-colors disabled:opacity-50" />
              </div>
            </div>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-indigo-900/50 flex flex-col gap-3 flex-1">
            <div className="flex justify-between items-end mb-1">
              <h3 className="text-xs font-black text-indigo-400 uppercase tracking-wider">{t('map.forces_in_field')}</h3>
              {!isReadOnly && (
                <button onClick={toggleAllParticipants} className="text-[9px] font-bold text-slate-400 hover:text-white transition-colors bg-slate-800 px-2 py-1 rounded">
                  {currentParticipants.length > 0 ? t('map.deselect_all') : t('map.select_all')}
                </button>
              )}
            </div>

            <div className="flex flex-col gap-2 overflow-y-auto max-h-[250px] custom-scrollbar pr-1 mt-1">
              {filteredRoster.map(player => {
                const rank = getPlayerRank(player?.role || player?.rank);
                let rankColor = "text-blue-400";
                if(rank === 'R5') rankColor = "text-yellow-400";
                if(rank === 'R4') rankColor = "text-purple-400";

                const isParticipating = currentParticipants.includes(player.id);
                const canDrag = !isReadOnly && isParticipating;

                return (
                  <div 
                    key={player.id} 
                    draggable={canDrag} 
                    onDragStart={(e) => { if(canDrag) e.dataTransfer.setData('text/plain', player.id); }}
                    className={`border p-2.5 rounded-lg flex justify-between items-center transition-colors group ${isParticipating ? (canDrag ? 'bg-slate-900 border-indigo-900/50 hover:border-indigo-500 cursor-grab' : 'bg-slate-900 border-indigo-900/50') : 'bg-slate-950/50 border-slate-800/50 opacity-50'}`}
                  >
                    <div className="flex items-center gap-3">
                      <input 
                        disabled={isReadOnly}
                        type="checkbox" 
                        className="w-4 h-4 accent-indigo-500 cursor-pointer disabled:opacity-50" 
                        checked={isParticipating} 
                        onChange={() => toggleParticipant(player.id)}
                      />
                      <div className="flex flex-col">
                        <span className={`text-[11px] font-bold ${rankColor}`}>[{player?.tag || 'PLY'}] {player?.name}</span>
                        <span className="text-[9px] text-slate-500">
                          {player?.x != null && player?.y != null ? `${t('map.on_map')} (${player.x}, ${player.y})` : t('map.waiting')}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex gap-2 shrink-0 pt-2">
          {!isReadOnly && (
            <button 
              onClick={handleSaveSimulation} 
              disabled={isSavingSim}
              className="flex-1 bg-emerald-700 hover:bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider py-3 rounded-lg shadow-lg transition-colors disabled:opacity-50"
            >
              {isSavingSim ? t('map.saving') : t('map.save_plan')}
            </button>
          )}
          <button 
            onClick={openExportModal}
            className="flex-1 bg-indigo-700 hover:bg-indigo-600 text-white text-[10px] font-black uppercase tracking-wider py-3 rounded-lg shadow-lg transition-colors"
          >
            {t('map.export')}
          </button>
        </div>
      </aside>
    );
  }

  // --- VISTA GLOBALE (DEFAULT) ---
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
        </div>
        <button onClick={() => navigate('/')} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg border border-slate-700 transition-colors">🏠</button>
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
            <button onClick={toggleAllFilters} className="text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded transition-colors uppercase">
              {areAllFiltersActive ? t('map.deselect_all') : t('map.select_all')}
            </button>
          </div>

          <label className="flex items-center justify-between cursor-pointer group mt-1">
            <span className="text-xs font-bold text-slate-400 group-hover:text-white transition-colors">{t('map.show_all_names')}</span>
            <input type="checkbox" className="accent-cyan-500 w-4 h-4" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} />
          </label>

          {/* 💡 FILTRI EDIFICI - RISOLTO IL BUG PER I NUOVI UTENTI */}
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