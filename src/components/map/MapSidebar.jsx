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
  setHiveGridMeta = () => {}
}) {
  const navigate = useNavigate();
  const { t } = useTranslation(); 
  
  const [searchQuery, setSearchQuery] = useState('');
  
  // 💡 STATO PER IL PANNELLO HELP DINAMICO
  const [showHelp, setShowHelp] = useState(false);

  const rawArray = Array.isArray(roster) ? roster : (roster?.players || []);
  const rosterArray = rawArray.filter(p => p !== null && p !== undefined);

  const currentParticipants = tacticalMeta?.participants || [];

  const toggleParticipant = (id) => {
    let newPart = [...currentParticipants];
    if (newPart.includes(id)) newPart = newPart.filter(x => x !== id);
    else newPart.push(id);
    setTacticalMeta({...tacticalMeta, participants: newPart});
  };

  const toggleAllParticipants = () => {
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
    setHiveGridMeta({
      ...hiveGridMeta,
      territory: [...(hiveGridMeta.territory || []), { x: '', y: '' }]
    });
  };

  const updateTerritoryPoint = (index, field, value) => {
    const newTerritory = [...(hiveGridMeta.territory || [])];
    newTerritory[index][field] = value === '' ? '' : Number(value);
    setHiveGridMeta({ ...hiveGridMeta, territory: newTerritory });
  };

  const removeTerritoryPoint = (index) => {
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

        {showHelp && (
          <div className="bg-indigo-950/30 border border-indigo-500/50 rounded-xl p-3 text-xs text-indigo-100 shadow-inner leading-relaxed animate-fade-in shrink-0">
            <strong>💡 Guida Alveare:</strong> Trascina i giocatori dalla lista direttamente in mappa. Accendi la <em>Griglia Olografica</em> per centrarla su una trappola e definisci i confini aggiungendo punti al <em>Territorio</em>. Ricordati di salvare le modifiche in fondo!
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
              <input type="checkbox" className="accent-cyan-500 w-4 h-4 cursor-pointer" checked={hiveGridMeta.showGrid} onChange={e => setHiveGridMeta({...hiveGridMeta, showGrid: e.target.checked})} />
            </div>
            
            {hiveGridMeta.showGrid && (
              <div className="flex flex-col gap-2 mt-1 animate-fade-in">
                <div className="flex gap-2">
                  <div className="flex flex-col flex-1">
                    <label className="text-[8px] text-slate-500 uppercase font-bold mb-0.5">{t('map.center_x', 'Centro X')}</label>
                    <input type="number" value={hiveGridMeta.centerX} onChange={e => setHiveGridMeta({...hiveGridMeta, centerX: Number(e.target.value)})} className="bg-slate-900 border border-slate-700 text-xs text-white px-2 py-1.5 rounded outline-none focus:border-cyan-500 text-center font-mono transition-colors"/>
                  </div>
                  <div className="flex flex-col flex-1">
                    <label className="text-[8px] text-slate-500 uppercase font-bold mb-0.5">{t('map.center_y', 'Centro Y')}</label>
                    <input type="number" value={hiveGridMeta.centerY} onChange={e => setHiveGridMeta({...hiveGridMeta, centerY: Number(e.target.value)})} className="bg-slate-900 border border-slate-700 text-xs text-white px-2 py-1.5 rounded outline-none focus:border-cyan-500 text-center font-mono transition-colors"/>
                  </div>
                  <div className="flex flex-col flex-1">
                    <label className="text-[8px] text-slate-500 uppercase font-bold mb-0.5" title="Dimensione raggio (10-100)">{t('map.radius', 'Raggio')}</label>
                    <input type="number" value={hiveGridMeta.radius} onChange={e => setHiveGridMeta({...hiveGridMeta, radius: Number(e.target.value)})} min="10" max="100" className="bg-slate-900 border border-slate-700 text-xs text-white px-2 py-1.5 rounded outline-none focus:border-cyan-500 text-center font-mono transition-colors"/>
                  </div>
                </div>
                
                <div className="flex gap-1 mt-1">
                  <button onClick={() => {
                    const hq = allianceStructures?.find(s => s.type === 'headquarters');
                    if (hq) setHiveGridMeta({...hiveGridMeta, centerX: hq.x, centerY: hq.y});
                  }} className="flex-1 bg-slate-800 hover:bg-indigo-900/50 hover:border-indigo-500/50 text-[9px] font-bold text-slate-300 py-1.5 rounded border border-slate-700 transition-colors uppercase tracking-wider">
                    🏰 Centra su QG
                  </button>
                  <button onClick={() => {
                    const trap = allianceStructures?.find(s => s.type === 'beartrap');
                    if (trap) setHiveGridMeta({...hiveGridMeta, centerX: trap.x, centerY: trap.y});
                  }} className="flex-1 bg-slate-800 hover:bg-rose-900/50 hover:border-rose-500/50 text-[9px] font-bold text-slate-300 py-1.5 rounded border border-slate-700 transition-colors uppercase tracking-wider">
                    🐻 Centra su TRP
                  </button>
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
                  <input type="number" placeholder="X" value={pt.x} onChange={e => updateTerritoryPoint(idx, 'x', e.target.value)} className="w-16 bg-slate-950 border border-slate-700 text-xs text-cyan-300 px-1 py-1 rounded outline-none focus:border-indigo-500 text-center font-mono" />
                  <input type="number" placeholder="Y" value={pt.y} onChange={e => updateTerritoryPoint(idx, 'y', e.target.value)} className="w-16 bg-slate-950 border border-slate-700 text-xs text-amber-300 px-1 py-1 rounded outline-none focus:border-indigo-500 text-center font-mono" />
                  <button onClick={() => removeTerritoryPoint(idx)} className="text-slate-600 hover:text-rose-400 font-bold px-1 ml-auto">✕</button>
                </div>
              ))}
            </div>

            <button onClick={addTerritoryPoint} className="w-full bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 py-2 rounded border border-slate-700 transition-colors uppercase mt-1">
              + Aggiungi Punto
            </button>
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
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', `structure:${struct.id}`);
                    }}
                    className="bg-indigo-900/20 border border-indigo-500/40 hover:border-indigo-400 p-2.5 rounded-xl flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing transition-all group shadow-sm"
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
                        <input 
                          type="number"
                          value={hasCoords ? struct.x : ''}
                          placeholder="-"
                          onChange={(e) => {
                            const val = e.target.value === '' ? '' : Number(e.target.value);
                            handleAllianceStructureChange(struct.id, 'x', val);
                          }}
                          className="w-12 bg-slate-900 border border-indigo-900/50 focus:border-cyan-400 text-cyan-300 text-center text-xs rounded p-0.5 font-mono outline-none"
                        />
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-[8px] text-indigo-400 font-bold uppercase">{t('alliance_sidebar.coord_y', 'Y')}</span>
                        <input 
                          type="number"
                          value={hasCoords ? struct.y : ''}
                          placeholder="-"
                          onChange={(e) => {
                            const val = e.target.value === '' ? '' : Number(e.target.value);
                            handleAllianceStructureChange(struct.id, 'y', val);
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
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', `player:${player.id}`);
                    }}
                    className="bg-slate-950/80 border border-slate-800 hover:border-slate-600 p-2.5 rounded-xl flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing transition-all group shadow-sm"
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
                        <input 
                          type="number"
                          value={currentX}
                          placeholder="-"
                          onChange={(e) => {
                            const val = e.target.value === '' ? '' : Number(e.target.value);
                            setPlayerOverrides(prev => ({
                              ...prev,
                              [player.id]: { x: val, y: currentY === '' ? 0 : currentY }
                            }));
                          }}
                          className="w-12 bg-slate-900 border border-slate-700 focus:border-cyan-400 text-cyan-300 text-center text-xs rounded p-0.5 font-mono outline-none"
                        />
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-[8px] text-slate-500 font-bold uppercase">{t('alliance_sidebar.coord_y', 'Y')}</span>
                        <input 
                          type="number"
                          value={currentY}
                          placeholder="-"
                          onChange={(e) => {
                            const val = e.target.value === '' ? '' : Number(e.target.value);
                            setPlayerOverrides(prev => ({
                              ...prev,
                              [player.id]: { x: currentX === '' ? 0 : currentX, y: val }
                            }));
                          }}
                          className="w-12 bg-slate-900 border border-slate-700 focus:border-amber-400 text-amber-300 text-center text-xs rounded p-0.5 font-mono outline-none"
                        />
                      </div>
                    </div>

                  </div>
                );
              })
            )}
          </div>
        </div>

        <button 
          onClick={handleSaveToCloud} 
          disabled={isLoadingCloud}
          className="w-full bg-indigo-700 hover:bg-indigo-600 text-white text-[10px] font-black uppercase tracking-wider py-3 rounded-lg shadow-lg transition-colors disabled:opacity-50 shrink-0"
        >
          {isLoadingCloud ? t('map.saving') : t('map.save_plan')}
        </button>
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

        {showHelp && (
          <div className="bg-rose-950/30 border border-rose-500/50 rounded-xl p-3 text-xs text-rose-100 shadow-inner leading-relaxed animate-fade-in shrink-0">
            <strong>💡 Guida Tattica:</strong> Aggiungi le Forze in Campo selezionandole dalla lista. Clicca su un edificio nemico in mappa per aprire il pannello laterale e ordinare Rally o Attacchi. Usa lo <em>slider temporale</em> in basso per vedere le marce scorrere in tempo reale!
          </div>
        )}

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 flex flex-col gap-4">
          
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
              <input type="text" value={tacticalMeta?.eventName || ''} onChange={(e) => setTacticalMeta({...tacticalMeta, eventName: e.target.value})} className="bg-slate-900 border border-slate-700 text-white text-xs px-3 py-2 rounded focus:outline-none focus:border-rose-500 transition-colors" placeholder={t('map.event_name_placeholder')} />
            </div>

            <div className="flex gap-2">
              <div className="flex flex-col gap-1 w-full">
                <label className="text-[10px] font-bold text-slate-500 uppercase">{t('map.date')}</label>
                <input type="date" value={tacticalMeta?.date || ''} onChange={(e) => setTacticalMeta({...tacticalMeta, date: e.target.value})} className="bg-slate-900 border border-slate-700 text-white text-xs px-2 py-2 rounded focus:outline-none focus:border-rose-500 transition-colors" />
              </div>
              <div className="flex flex-col gap-1 w-full">
                <label className="text-[10px] font-bold text-slate-500 uppercase">{t('map.start_time')}</label>
                <input type="time" value={tacticalMeta?.time || ''} onChange={(e) => setTacticalMeta({...tacticalMeta, time: e.target.value})} className="bg-slate-900 border border-slate-700 text-white text-xs px-2 py-2 rounded focus:outline-none focus:border-rose-500 transition-colors" />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">{t('map.target_building')}</label>
              <select 
                value={tacticalMeta?.targetBuilding || ''} 
                onChange={(e) => {
                  const val = e.target.value;
                  setTacticalMeta({...tacticalMeta, targetBuilding: val});
                  if (val && setSelectedBuilding) {
                    const foundBuilding = fixedBuildings.find(x => x.name === val);
                    if (foundBuilding) setSelectedBuilding(foundBuilding);
                  } else if (!val && setSelectedBuilding) {
                    setSelectedBuilding(null);
                  }
                }} 
                className="bg-slate-900 border border-slate-700 text-white text-xs px-2 py-2 rounded focus:outline-none focus:border-rose-500 transition-colors cursor-pointer"
              >
                <option value="">{t('map.no_target')}</option>
                {fixedBuildings?.map(b => (<option key={b.id} value={b.name}>[{b.code}] {b.name}</option>))}
              </select>
            </div>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-indigo-900/50 flex flex-col gap-3 flex-1">
            <div className="flex justify-between items-end mb-1">
              <h3 className="text-xs font-black text-indigo-400 uppercase tracking-wider">{t('map.forces_in_field')}</h3>
              <button onClick={toggleAllParticipants} className="text-[9px] font-bold text-slate-400 hover:text-white transition-colors bg-slate-800 px-2 py-1 rounded">
                {currentParticipants.length > 0 ? t('map.deselect_all') : t('map.select_all')}
              </button>
            </div>
            
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs">🔍</span>
              <input 
                type="text" 
                placeholder={t('map.search_placeholder')} 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-white text-xs pl-7 pr-3 py-2 rounded focus:outline-none focus:border-indigo-500 transition-colors" 
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-rose-400 text-xs font-bold">✕</button>
              )}
            </div>

            <div className="flex flex-col gap-2 overflow-y-auto max-h-[250px] custom-scrollbar pr-1 mt-1">
              {filteredRoster.length === 0 ? (
                <div className="text-center text-[10px] text-slate-500 italic py-4">{t('map.no_players_found')}</div>
              ) : (
                filteredRoster.map(player => {
                  const rank = getPlayerRank(player?.role || player?.rank);
                  let rankColor = "text-blue-400";
                  if(rank === 'R5') rankColor = "text-yellow-400";
                  if(rank === 'R4') rankColor = "text-purple-400";

                  const isParticipating = currentParticipants.includes(player.id);

                  return (
                    <div 
                      key={player?.id || Math.random()} 
                      draggable={isParticipating} 
                      onDragStart={(e) => { if(player?.id && isParticipating) e.dataTransfer.setData('text/plain', player.id); }}
                      className={`border p-2.5 rounded-lg flex justify-between items-center transition-colors group ${isParticipating ? 'bg-slate-900 border-indigo-900/50 hover:border-indigo-500 cursor-grab active:cursor-grabbing' : 'bg-slate-950/50 border-slate-800/50 opacity-50'}`}
                    >
                      <div className="flex items-center gap-3">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 accent-indigo-500 cursor-pointer" 
                          checked={isParticipating} 
                          onChange={() => toggleParticipant(player.id)}
                        />
                        <div className="flex flex-col">
                          <span className={`text-[11px] font-bold ${rankColor}`}>[{player?.tag || 'PLY'}] {player?.name || 'Sconosciuto'}</span>
                          <span className="text-[9px] text-slate-500">
                            {player?.x != null && player?.y != null ? `${t('map.on_map')} (${player.x}, ${player.y})` : t('map.waiting')}
                          </span>
                        </div>
                      </div>
                      {isParticipating && <span className="text-lg opacity-30 group-hover:opacity-100 transition-opacity">👆</span>}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2 shrink-0 pt-2">
          <button 
            onClick={handleSaveSimulation} 
            disabled={isSavingSim}
            className="flex-1 bg-emerald-700 hover:bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider py-3 rounded-lg shadow-lg transition-colors disabled:opacity-50"
          >
            {isSavingSim ? t('map.saving') : t('map.save_plan')}
          </button>
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

  // --- VISTA GLOBALE / MAIN TOOLS ---
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
          <button onClick={() => setShowHelp(!showHelp)} className="w-6 h-6 flex items-center justify-center bg-slate-800 hover:bg-cyan-900 text-cyan-400 rounded-full border border-slate-700 transition-colors text-xs font-bold">?</button>
        </div>
        <button onClick={() => navigate('/')} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg border border-slate-700 transition-colors">🏠</button>
      </div>

      {showHelp && (
        <div className="bg-cyan-950/30 border border-cyan-500/50 rounded-xl p-3 text-xs text-cyan-100 shadow-inner leading-relaxed animate-fade-in shrink-0">
          <strong>💡 Guida Mappa Globale:</strong> Usa i filtri per evidenziare i Centri di Potere. Seleziona lo strumento Righello per calcolare istantaneamente i Tempi di Marcia tra due coordinate qualsiasi. Modifica il Database Edifici usando l'ingranaggio in basso (solo per Admin).
        </div>
      )}

      <div className="flex flex-col gap-3 shrink-0">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Seleziona Azione</span>
        
        <button onClick={() => setSelectedTool('buildings')} className={`p-3 rounded-xl font-bold text-left transition-all flex items-center gap-3 ${selectedTool === 'buildings' ? 'bg-cyan-600 text-white shadow-[0_0_15px_rgba(8,145,178,0.4)]' : 'bg-slate-800/50 text-slate-300 hover:bg-slate-800'}`}>
          <span className="text-xl">🏰</span> {t('map.building_filters')}
        </button>
        
        <button onClick={() => setSelectedTool('allies')} className={`p-3 rounded-xl font-bold text-left transition-all flex items-center gap-3 ${selectedTool === 'allies' ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)]' : 'bg-slate-800/50 text-slate-300 hover:bg-slate-800'}`}>
          <span className="text-xl">👥</span> {t('map.roster_info')} ({rosterArray.length})
        </button>
        
        <button onClick={() => setSelectedTool('distance')} className={`p-3 rounded-xl font-bold text-left transition-all flex items-center gap-3 ${selectedTool === 'distance' ? 'bg-amber-600 text-white shadow-[0_0_15px_rgba(217,119,6,0.4)]' : 'bg-slate-800/50 text-slate-300 hover:bg-slate-800'}`}>
          <span className="text-xl">📏</span> {t('map.march_time')}
        </button>
        
       {userRole === 'admin' && (
          <button onClick={handleSettingsClick} className={`p-3 rounded-xl font-bold text-left transition-all flex items-center gap-3 ${selectedTool === 'settings' ? 'bg-rose-600 text-white shadow-[0_0_15px_rgba(225,29,72,0.4)]' : 'bg-slate-800/50 text-slate-300 hover:bg-slate-800'}`}>
            <span className="text-xl">⚙️</span> {t('map.fixed_db')}
          </button>
        )}
      </div>

      {selectedTool === 'buildings' && (
        <div className="mt-1 bg-slate-950 p-4 rounded-xl border border-slate-800/80 flex flex-col gap-3">
          <label className="flex items-center justify-between cursor-pointer group pb-3 mb-2 border-b border-slate-800/80">
            <span className="text-[13px] text-white font-black group-hover:text-cyan-300 transition-colors">{t('map.show_hide_all')}</span>
            <input type="checkbox" className="w-5 h-5 accent-cyan-500 cursor-pointer" checked={areAllFiltersActive} onChange={toggleAllFilters} />
          </label>
          
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1 mb-1">{t('map.alliance_roster')}</span>
          <label className="flex items-center justify-between cursor-pointer group py-1">
            <span className="text-xs text-yellow-400 font-bold group-hover:text-yellow-300 transition-colors">👑 R5 (Leader)</span>
            <input type="checkbox" className="w-4 h-4 accent-yellow-400 cursor-pointer" checked={filters.alliesR5} onChange={() => toggleFilter('alliesR5')} />
          </label>
          <label className="flex items-center justify-between cursor-pointer group py-1">
            <span className="text-xs text-purple-400 font-bold group-hover:text-purple-300 transition-colors">⭐ R4 (Ufficiali)</span>
            <input type="checkbox" className="w-4 h-4 accent-purple-400 cursor-pointer" checked={filters.alliesR4} onChange={() => toggleFilter('alliesR4')} />
          </label>
          <label className="flex items-center justify-between cursor-pointer group py-1">
            <span className="text-xs text-blue-400 font-bold group-hover:text-blue-300 transition-colors">👥 R1-R3 (Membri)</span>
            <input type="checkbox" className="w-4 h-4 accent-blue-500 cursor-pointer" checked={filters.alliesOthers} onChange={() => toggleFilter('alliesOthers')} />
          </label>

          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-3 mb-1 border-t border-slate-800/80 pt-3">{t('map.alliance_structures')}</span>
          <label className="flex items-center justify-between cursor-pointer group py-1">
            <span className="text-xs text-indigo-400 font-bold group-hover:text-indigo-300 transition-colors">🏰 Quartier Generale</span>
            <input type="checkbox" className="w-4 h-4 accent-indigo-500 cursor-pointer" checked={filters.allianceHQ} onChange={() => toggleFilter('allianceHQ')} />
          </label>
          <label className="flex items-center justify-between cursor-pointer group py-1">
            <span className="text-xs text-red-400 font-bold group-hover:text-red-300 transition-colors">🐻 Trappole per Orsi</span>
            <input type="checkbox" className="w-4 h-4 accent-red-500 cursor-pointer" checked={filters.allianceTraps} onChange={() => toggleFilter('allianceTraps')} />
          </label>
          
          <div className="flex flex-col gap-2 p-2 mt-1 bg-slate-900/50 rounded-lg border border-slate-800">
            {allianceStructures?.map(struct => (
              <div key={struct.id} className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-medium text-slate-300 truncate w-10" title={struct.name}>{struct.code}</span>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-slate-500">X:</span>
                  <input type="number" value={struct.x} onChange={(e) => handleAllianceStructureChange(struct.id, 'x', e.target.value)} className="w-12 bg-slate-800 border border-slate-700 rounded px-1 py-0.5 text-[10px] text-white text-center focus:outline-none"/>
                  <span className="text-[10px] text-slate-500 ml-1">Y:</span>
                  <input type="number" value={struct.y} onChange={(e) => handleAllianceStructureChange(struct.id, 'y', e.target.value)} className="w-12 bg-slate-800 border border-slate-700 rounded px-1 py-0.5 text-[10px] text-white text-center focus:outline-none"/>
                </div>
              </div>
            ))}
          </div>

          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2 mb-1 border-t border-slate-800/80 pt-3">{t('map.power_centers')}</span>
          <label className="flex items-center justify-between cursor-pointer group py-1"><span className="text-xs text-yellow-400 font-bold">🏰 Castello del Regno</span><input type="checkbox" className="w-4 h-4 accent-yellow-400 cursor-pointer" checked={filters.castle} onChange={() => toggleFilter('castle')} /></label>
          <label className="flex items-center justify-between cursor-pointer group py-1"><span className="text-xs text-purple-400 font-bold">🏛️ Santuari</span><input type="checkbox" className="w-4 h-4 accent-purple-400 cursor-pointer" checked={filters.santuari} onChange={() => toggleFilter('santuari')} /></label>
          <label className="flex items-center justify-between cursor-pointer group py-1"><span className="text-xs text-purple-400 font-bold">🛡️ Fortezze</span><input type="checkbox" className="w-4 h-4 accent-purple-400 cursor-pointer" checked={filters.fortezze} onChange={() => toggleFilter('fortezze')} /></label>
          
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-3 mb-1 border-t border-slate-800/80 pt-3">{t('map.civilians_research')}</span>
          <label className="flex items-center justify-between cursor-pointer group py-1"><span className="text-xs text-orange-400 font-bold">🛠️ Builder's Guild</span><input type="checkbox" className="w-4 h-4 accent-orange-400 cursor-pointer" checked={filters.builders} onChange={() => toggleFilter('builders')} /></label>
          <label className="flex items-center justify-between cursor-pointer group py-1"><span className="text-xs text-emerald-400 font-bold">🌲 Forager Grove</span><input type="checkbox" className="w-4 h-4 accent-emerald-400 cursor-pointer" checked={filters.forager} onChange={() => toggleFilter('forager')} /></label>
          <label className="flex items-center justify-between cursor-pointer group py-1"><span className="text-xs text-lime-400 font-bold">🌾 Harvest Alter</span><input type="checkbox" className="w-4 h-4 accent-lime-400 cursor-pointer" checked={filters.harvest} onChange={() => toggleFilter('harvest')} /></label>
          <label className="flex items-center justify-between cursor-pointer group py-1"><span className="text-xs text-indigo-400 font-bold">📚 Scholar's Tower</span><input type="checkbox" className="w-4 h-4 accent-indigo-400 cursor-pointer" checked={filters.scholar} onChange={() => toggleFilter('scholar')} /></label>
          
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-3 mb-1 border-t border-slate-800/80 pt-3">{t('map.military_structures')}</span>
          <label className="flex items-center justify-between cursor-pointer group py-1"><span className="text-xs text-rose-400 font-bold">⚔️ Armory</span><input type="checkbox" className="w-4 h-4 accent-rose-400 cursor-pointer" checked={filters.armory} onChange={() => toggleFilter('armory')} /></label>
          <label className="flex items-center justify-between cursor-pointer group py-1"><span className="text-xs text-red-500 font-bold">💣 Arsenal</span><input type="checkbox" className="w-4 h-4 accent-red-500 cursor-pointer" checked={filters.arsenal} onChange={() => toggleFilter('arsenal')} /></label>
          <label className="flex items-center justify-between cursor-pointer group py-1"><span className="text-xs text-teal-400 font-bold">⛺ Drill Camp</span><input type="checkbox" className="w-4 h-4 accent-teal-400 cursor-pointer" checked={filters.drill} onChange={() => toggleFilter('drill')} /></label>
          <label className="flex items-center justify-between cursor-pointer group py-1"><span className="text-xs text-sky-400 font-bold">🏕️ Frontier Lodge</span><input type="checkbox" className="w-4 h-4 accent-sky-400 cursor-pointer" checked={filters.frontier} onChange={() => toggleFilter('frontier')} /></label>
          
          <label className="flex items-center justify-between cursor-pointer group py-1 mt-2 border-t border-slate-800/80 pt-3"><span className="text-xs text-slate-400 font-bold">{t('map.other_buildings')}</span><input type="checkbox" className="w-4 h-4 accent-slate-400 cursor-pointer" checked={filters.others} onChange={() => toggleFilter('others')} /></label>
          
          <div className="border-t border-slate-700 mt-2 pt-3 bg-slate-900 -mx-4 px-4 pb-1 rounded-b-xl">
            <label className="flex items-center justify-between cursor-pointer group">
              <span className="text-xs text-white font-black">{t('map.show_all_names')}</span>
              <input type="checkbox" className="w-4 h-4 accent-white cursor-pointer" checked={showLabels} onChange={() => setShowLabels(!showLabels)} />
            </label>
          </div>
        </div>
      )}

      {selectedTool === 'allies' && (
        <div className="mt-1 bg-slate-950 p-4 rounded-xl border border-indigo-900/50 flex flex-col gap-4">
          <h3 className="text-xs font-black text-indigo-400 uppercase tracking-wider">{t('map.roster_distribution')}</h3>
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[11px] font-bold">
              <span className="text-yellow-400">👑 R5: {rosterArray.filter(p => getPlayerRank(p?.role || p?.rank) === 'R5').length}</span>
              <span className="text-purple-400">⭐ R4: {rosterArray.filter(p => getPlayerRank(p?.role || p?.rank) === 'R4').length}</span>
              <span className="text-blue-400">👥 {t('map.others')}: {rosterArray.filter(p => getPlayerRank(p?.role || p?.rank) === 'other').length}</span>
            </div>
          </div>
        </div>
      )}

      {selectedTool === 'distance' && (
        <div className="mt-1 bg-slate-950 p-4 rounded-xl border border-amber-900/50 flex flex-col gap-4">
          <h3 className="text-xs font-black text-amber-400 uppercase tracking-wider">{t('map.march_calculator')}</h3>
          <p className="text-[11px] text-slate-400 leading-relaxed" dangerouslySetInnerHTML={{ __html: t('map.march_calc_desc') }} />

          <div className="flex flex-col gap-3">
            <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 flex flex-col gap-2 relative">
              <span className="text-[10px] text-cyan-400 font-bold block">{t('map.starting_point')}</span>
              <div className="flex gap-2">
                <div className="flex bg-slate-950 border border-slate-700 rounded px-2 py-1.5 items-center w-full">
                  <span className="text-slate-500 text-[10px] font-bold mr-1">X:</span>
                  <input type="number" className="bg-transparent w-full outline-none text-xs text-white font-mono" placeholder="---" value={marchOrigin?.x ?? ''} onChange={(e) => handleManualCoord('origin', 'x', e.target.value)} />
                </div>
                <div className="flex bg-slate-950 border border-slate-700 rounded px-2 py-1.5 items-center w-full">
                  <span className="text-slate-500 text-[10px] font-bold mr-1">Y:</span>
                  <input type="number" className="bg-transparent w-full outline-none text-xs text-white font-mono" placeholder="---" value={marchOrigin?.y ?? ''} onChange={(e) => handleManualCoord('origin', 'y', e.target.value)} />
                </div>
              </div>
              <span className="text-[10px] font-bold text-slate-400 truncate">
                {marchOrigin ? marchOrigin.name : t('map.waiting_coords')}
              </span>
            </div>

            <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 flex flex-col gap-2 relative">
              <span className="text-[10px] text-amber-400 font-bold block">{t('map.destination_point')}</span>
              <div className="flex gap-2">
                <div className="flex bg-slate-950 border border-slate-700 rounded px-2 py-1.5 items-center w-full">
                  <span className="text-slate-500 text-[10px] font-bold mr-1">X:</span>
                  <input type="number" className="bg-transparent w-full outline-none text-xs text-white font-mono" placeholder="---" value={marchDestination?.x ?? ''} onChange={(e) => handleManualCoord('destination', 'x', e.target.value)} />
                </div>
                <div className="flex bg-slate-950 border border-slate-700 rounded px-2 py-1.5 items-center w-full">
                  <span className="text-slate-500 text-[10px] font-bold mr-1">Y:</span>
                  <input type="number" className="bg-transparent w-full outline-none text-xs text-white font-mono" placeholder="---" value={marchDestination?.y ?? ''} onChange={(e) => handleManualCoord('destination', 'y', e.target.value)} />
                </div>
              </div>
              <span className="text-[10px] font-bold text-slate-400 truncate">
                {marchDestination ? marchDestination.name : t('map.waiting_coords')}
              </span>
            </div>
          </div>

          {marchResult && (
            <div className="bg-amber-950/40 border border-amber-500/50 rounded-xl p-3 flex flex-col items-center text-center gap-1">
              <span className="text-[10px] text-amber-300 font-bold uppercase">{t('map.estimated_time')}</span>
              <span className="text-2xl font-black text-amber-400">{marchResult.formattedTime}</span>
              <span className="text-[10px] text-slate-400">{t('map.distance')}: {marchResult.distance}</span>
            </div>
          )}

          <button onClick={() => { setMarchOrigin(null); setMarchDestination(null); }} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg border border-slate-700 transition-colors">
            {t('map.reset_selection')}
          </button>
        </div>
      )}

      {selectedTool === 'settings' && (
        <div className="mt-2 bg-slate-950 p-4 rounded-xl border border-rose-900/50 flex flex-col gap-4">
           <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-rose-400">{t('map.building_db')}</h3>
            <div className="flex gap-1">
              <button onClick={handleAddBuilding} className="px-2 py-1 bg-rose-700 hover:bg-rose-600 text-white text-xs font-bold rounded shadow">+</button>
              <button onClick={handleSaveToCloud} disabled={isLoadingCloud} className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded shadow disabled:opacity-50">{isLoadingCloud ? t('map.saving') : "☁️ Salva"}</button>
            </div>
          </div>
          <div className="flex flex-col gap-3 max-h-[450px] overflow-y-auto pr-1 custom-scrollbar">
            {fixedBuildings.map((building) => (
              <div key={building.id} className={`bg-slate-900 p-3 rounded-lg border flex flex-col gap-2.5 relative group ${selectedBuilding?.id === building.id ? 'border-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.3)]' : 'border-slate-800'}`}>
                <div className="flex items-center gap-2">
                  <input type="text" value={building.code} onChange={(e) => handleBuildingChange(building.id, 'code', e.target.value)} className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs font-bold text-cyan-400 w-16 text-center focus:outline-none" />
                  <input type="text" value={building.name} onChange={(e) => handleBuildingChange(building.id, 'name', e.target.value)} className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs font-bold text-white w-full focus:outline-none" />
                  <button onClick={() => handleDeleteBuilding(building.id)} className="text-slate-500 hover:text-rose-400 text-xs px-1.5 py-1">✕</button>
                </div>
                <div className="bg-slate-950/60 p-2 rounded border border-indigo-900/50 flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-indigo-400">Occupante</label>
                  <input type="text" value={building.occupiedBy} onChange={(e) => handleBuildingChange(building.id, 'occupiedBy', e.target.value)} className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none" placeholder="Nome Alleanza / Giocatore" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}