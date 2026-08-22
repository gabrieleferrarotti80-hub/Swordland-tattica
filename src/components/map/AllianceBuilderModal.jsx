import React, { useState, useMemo, useEffect } from 'react';

export default function AllianceBuilderModal({ isOpen, onClose, roster, draftData, onSaveDraft }) {
  const [activeTab, setActiveTab] = useState('phase1');

  // Filtri per la Fase 1
  const [filterTag, setFilterTag] = useState('');
  const [sortBy, setSortBy] = useState('power');

  // Dati Costruttore
  const [macroGroups, setMacroGroups] = useState(draftData?.macroGroups?.length > 0 ? draftData.macroGroups : ['Castello Centrale', 'Torretta Nord', 'Torretta Sud', 'Torretta Est', 'Torretta Ovest', 'Santuari']);
  const [teams, setTeams] = useState(draftData?.teams || []); 
  const [playerMeta, setPlayerMeta] = useState(draftData?.playerMeta || {}); 

  const [newMacro, setNewMacro] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  
  // Bulk selection per la Fase 1
  const [bulkSelection, setBulkSelection] = useState(new Set());
  const [bulkMacro, setBulkMacro] = useState('');
  const [bulkRole, setBulkRole] = useState('');

  // Fase 2
  const [viewingMacro, setViewingMacro] = useState('Castello Centrale');
  const [minPower, setMinPower] = useState(0);
  const [selectedTeamsForBalance, setSelectedTeamsForBalance] = useState(new Set());

  // 💡 Fase 3: Stati per i Messaggi di Volo
  const [showFlightMessages, setShowFlightMessages] = useState(false);
  const [copiedFlight, setCopiedFlight] = useState(null);

  // Azzera le selezioni quando cambi tab
  useEffect(() => {
    setBulkSelection(new Set());
    setBulkMacro('');
    setBulkRole('');
    setShowFlightMessages(false);
  }, [activeTab]);

  useEffect(() => {
    if (draftData) {
      if (draftData.macroGroups?.length > 0) setMacroGroups(draftData.macroGroups);
      if (draftData.teams) setTeams(draftData.teams);
      if (draftData.playerMeta) setPlayerMeta(draftData.playerMeta);
    }
  }, [draftData]);

  useEffect(() => {
    setSelectedTeamsForBalance(new Set());
  }, [viewingMacro]);

  const uniqueRoster = useMemo(() => {
    if (!roster) return [];
    return Array.from(new Map(roster.map(p => [p.id, p])).values());
  }, [roster]);

  const uniqueTags = useMemo(() => {
    const tags = new Set(
      uniqueRoster.map(p => {
        const t = p.originalTag || p.tag;
        return typeof t === 'string' ? t.trim() : null;
      }).filter(Boolean)
    );
    const arr = Array.from(tags).sort();
    if (uniqueRoster.some(p => !(p.originalTag || p.tag))) arr.push('Senza Alleanza');
    return arr;
  }, [uniqueRoster]);

  const sortFn = (a, b) => {
    if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
    if (sortBy === 'tag') {
      const tagA = playerMeta[a.id]?.tempTag || a.originalTag || a.tag || '';
      const tagB = playerMeta[b.id]?.tempTag || b.originalTag || b.tag || '';
      if (tagA === tagB) return (b.power || 0) - (a.power || 0);
      return tagA.localeCompare(tagB);
    }
    return (b.power || 0) - (a.power || 0); 
  };

  const filteredForList = useMemo(() => {
    let filtered = uniqueRoster;
    if (filterTag) {
      if (filterTag === 'Senza Alleanza') filtered = filtered.filter(p => !(p.originalTag || p.tag));
      else filtered = filtered.filter(p => (p.originalTag || p.tag) === filterTag);
    }
    return [...filtered].sort(sortFn);
  }, [uniqueRoster, filterTag, sortBy, playerMeta]);

  // ======= FASE 1: LOGICA =======
  const toggleBulk = (id) => {
    const newSet = new Set(bulkSelection);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setBulkSelection(newSet);
  };

  const handleSelectAll = () => {
    const newSet = new Set(bulkSelection);
    filteredForList.forEach(p => newSet.add(p.id));
    setBulkSelection(newSet);
  };

  const handleDeselectAll = () => {
    const newSet = new Set(bulkSelection);
    filteredForList.forEach(p => newSet.delete(p.id));
    setBulkSelection(newSet);
  };

  const updatePlayerMeta = (id, field, value) => {
    setPlayerMeta(prev => ({
      ...prev,
      [id]: { ...(prev[id] || {}), [field]: value }
    }));
  };

  const applyBulkSettings = () => {
    if (!bulkMacro && !bulkRole) return;
    const newMeta = { ...playerMeta };
    bulkSelection.forEach(id => {
      if (!newMeta[id]) newMeta[id] = {};
      if (bulkMacro) newMeta[id].macro = bulkMacro;
      if (bulkRole) newMeta[id].role = bulkRole;
    });
    setPlayerMeta(newMeta);
    setBulkSelection(new Set()); 
    setBulkMacro('');
    setBulkRole('');
  };

  // ======= FASE 2: LOGICA =======
  const availableDraftPlayers = useMemo(() => {
    return uniqueRoster
      .filter(p => {
        const meta = playerMeta[p.id];
        return meta && meta.macro === viewingMacro && !meta.teamId && (p.power || 0) >= minPower;
      })
      .sort(sortFn);
  }, [uniqueRoster, playerMeta, viewingMacro, minPower, sortBy]);

  const activeTeams = teams.filter(t => t.macro === viewingMacro);

  const getTeamPlayers = (teamId) => {
    return uniqueRoster.filter(p => playerMeta[p.id]?.teamId === teamId).sort(sortFn);
  };

  const getTeamPower = (teamId) => {
    return getTeamPlayers(teamId).reduce((sum, p) => sum + (Number(p.power) || 0), 0);
  };

  const handleAddTeam = (e) => {
    e.preventDefault();
    let tName = newTeamName.trim();
    if (!tName) {
      let baseName = viewingMacro;
      let counter = 1;
      tName = baseName;
      while (teams.some(t => t.name === tName && t.macro === viewingMacro)) {
        counter++;
        tName = `${baseName} ${counter}`;
      }
    }
    setTeams([...teams, { id: `team-${Date.now()}`, name: tName, macro: viewingMacro }]);
    setNewTeamName('');
  };

  const handleRemoveTeam = (teamId) => {
    const newMeta = { ...playerMeta };
    Object.keys(newMeta).forEach(pId => {
      if (newMeta[pId].teamId === teamId) newMeta[pId].teamId = null;
    });
    setPlayerMeta(newMeta);
    setTeams(teams.filter(t => t.id !== teamId));
    
    const newSelection = new Set(selectedTeamsForBalance);
    newSelection.delete(teamId);
    setSelectedTeamsForBalance(newSelection);
  };

  const toggleTeamBalanceSelection = (teamId) => {
    const newSet = new Set(selectedTeamsForBalance);
    if (newSet.has(teamId)) newSet.delete(teamId);
    else newSet.add(teamId);
    setSelectedTeamsForBalance(newSet);
  };

  const handleBalanceTeams = () => {
    if (selectedTeamsForBalance.size < 2) return;

    const teamIds = Array.from(selectedTeamsForBalance);
    const newMeta = { ...playerMeta };

    const playersInSelectedTeams = uniqueRoster.filter(p => teamIds.includes(newMeta[p.id]?.teamId));
    const fixedRoles = ["Rally Leader", "Capitano Difesa", "Guarnigione (Garrison)", "R5 / Leader"];
    
    const fixedPlayers = playersInSelectedTeams.filter(p => fixedRoles.includes(newMeta[p.id]?.role));
    const flexiblePlayers = playersInSelectedTeams.filter(p => !fixedRoles.includes(newMeta[p.id]?.role));

    flexiblePlayers.sort((a, b) => (b.power || 0) - (a.power || 0));

    const teamTotals = {};
    teamIds.forEach(id => teamTotals[id] = 0);
    
    fixedPlayers.forEach(p => {
      teamTotals[newMeta[p.id].teamId] += (p.power || 0);
    });

    flexiblePlayers.forEach(p => {
      let lowestTeamId = teamIds[0];
      let minPower = teamTotals[lowestTeamId];
      
      for (let i = 1; i < teamIds.length; i++) {
        if (teamTotals[teamIds[i]] < minPower) {
          lowestTeamId = teamIds[i];
          minPower = teamTotals[teamIds[i]];
        }
      }
      
      newMeta[p.id].teamId = lowestTeamId;
      teamTotals[lowestTeamId] += (p.power || 0);
    });

    setPlayerMeta(newMeta);
    setSelectedTeamsForBalance(new Set()); 
  };

  const handleDragStart = (e, playerId) => e.dataTransfer.setData('playerId', playerId);
  const handleDrop = (e, targetTeamId) => {
    e.preventDefault();
    const playerId = e.dataTransfer.getData('playerId');
    if (playerId) updatePlayerMeta(playerId, 'teamId', targetTeamId); 
  };
  const handleDragOver = (e) => e.preventDefault();

  // ======= FASE 3: LOGICA =======
  
  const getTeamTag = (teamId) => {
    const teamPlayers = uniqueRoster.filter(p => playerMeta[p.id]?.teamId === teamId);
    if (teamPlayers.length === 0) return '';
    for (let p of teamPlayers) {
      if (playerMeta[p.id]?.tempTag) return playerMeta[p.id].tempTag;
    }
    return '';
  };

  const getTeamOriginalTags = (teamId) => {
    const teamPlayers = uniqueRoster.filter(p => playerMeta[p.id]?.teamId === teamId);
    const tags = new Set(teamPlayers.map(p => p.originalTag || p.tag || '?'));
    return Array.from(tags).join(', ');
  };

  const handleTeamTagChange = (teamId, tag) => {
    const newMeta = { ...playerMeta };
    const teamPlayers = uniqueRoster.filter(p => newMeta[p.id]?.teamId === teamId);
    
    teamPlayers.forEach(p => {
      if (!newMeta[p.id]) newMeta[p.id] = {};
      newMeta[p.id].tempTag = tag.trim() ? tag.toUpperCase() : null;
    });
    
    setPlayerMeta(newMeta);
  };

  // 💡 Generatore di Messaggi per chi deve volare
  const flightMessages = useMemo(() => {
    const flights = {};
    uniqueRoster.forEach(p => {
      const meta = playerMeta[p.id];
      if (!meta || !meta.tempTag) return;
      
      const original = (p.originalTag || p.tag || '').trim();
      const destination = meta.tempTag.trim();
      
      // Controlla se il giocatore deve EFFETTIVAMENTE cambiare alleanza
      if (destination && destination !== original) {
        if (!flights[destination]) flights[destination] = [];
        flights[destination].push(p);
      }
    });

    return Object.entries(flights).map(([dest, players]) => {
      // Ordina i giocatori per potenza
      players.sort((a, b) => (b.power || 0) - (a.power || 0));

      let msg = `✈️ **TRASFERIMENTI VERSO [${dest}]**\n`;
      msg += `I seguenti giocatori devono spostarsi nell'alleanza [${dest}] prima dell'evento:\n\n`;
      players.forEach(p => {
        const orig = p.originalTag || p.tag || '?';
        msg += `• [${orig}] ${p.name}\n`;
      });
      return { destination: dest, text: msg, count: players.length };
    });
  }, [uniqueRoster, playerMeta]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 animate-in fade-in zoom-in-95 duration-200">
      <div className="bg-slate-900 border border-cyan-500/50 p-6 rounded-3xl shadow-2xl w-full max-w-[95vw] h-[95vh] flex flex-col relative overflow-hidden">
        
        <div className="flex flex-col gap-4 mb-4 border-b border-slate-800 pb-4 shrink-0">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-3xl font-black text-cyan-400 flex items-center gap-3 drop-shadow-md">
                <span>🛠️</span> Quartier Generale Assegnazioni
              </h2>
              <p className="text-sm text-slate-400 mt-1">Unisci le forze delle alleanze e smista i giocatori in modo chirurgico.</p>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 flex gap-4 text-xs font-bold shadow-inner">
                <span className="text-slate-400">Totale Server: <span className="text-white">{uniqueRoster.length}</span></span>
                <span className="text-slate-400">Assegnati a Macro: <span className="text-cyan-400">{Object.values(playerMeta).filter(m => m.macro).length}</span></span>
              </div>
              
              <button 
                onClick={() => onSaveDraft({ macroGroups, teams, playerMeta })}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-4 py-2 rounded-xl text-sm transition-colors shadow-[0_0_15px_rgba(16,185,129,0.3)] flex items-center gap-2"
              >
                💾 Salva Lavoro
              </button>

              <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:bg-rose-900 hover:text-rose-400 transition-colors font-bold text-xl border border-slate-700">✕</button>
            </div>
          </div>

          <div className="flex gap-2">
            <button 
              onClick={() => setActiveTab('phase1')}
              className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${activeTab === 'phase1' ? 'bg-cyan-600 text-white shadow-lg scale-[1.02]' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
            >
              1. Macrogruppi & Ruoli
            </button>
            <button 
              onClick={() => setActiveTab('phase2')}
              className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${activeTab === 'phase2' ? 'bg-indigo-600 text-white shadow-lg scale-[1.02]' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
            >
              2. Squadre d'Assalto
            </button>
            <button 
              onClick={() => setActiveTab('phase3')}
              className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${activeTab === 'phase3' ? 'bg-fuchsia-600 text-white shadow-lg scale-[1.02]' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
            >
              3. Riassegnazione Alleanze (Voli)
            </button>
          </div>
        </div>

        {/* ========================================== */}
        {/* FASE 1 E FASE 3 CONDIVIDONO LA BARRA FILTRI */}
        {/* ========================================== */}
        {(activeTab === 'phase1') && (
          <div className="flex justify-between items-center bg-slate-950/50 p-3 rounded-xl border border-slate-800 shrink-0 shadow-inner mb-4">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Filtra per (Tag Orig):</span>
                <select value={filterTag} onChange={e => setFilterTag(e.target.value)} className="bg-slate-900 border border-slate-700 text-white text-xs px-3 py-1.5 rounded outline-none focus:border-cyan-500 font-bold">
                  <option value="">Tutte le Alleanze</option>
                  {uniqueTags.map(tag => <option key={tag} value={tag}>[{tag}]</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ordina per:</span>
                <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="bg-slate-900 border border-slate-700 text-cyan-400 text-xs px-3 py-1.5 rounded outline-none focus:border-cyan-500 font-bold">
                  <option value="power">💪 Potenza</option>
                  <option value="name">🔤 Nome</option>
                  <option value="tag">🛡️ Alleanza</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleSelectAll} className="bg-slate-800 hover:bg-slate-700 text-cyan-400 px-4 py-1.5 rounded text-xs font-bold transition-colors">Seleziona Lista</button>
              <button onClick={handleDeselectAll} className="bg-slate-800 hover:bg-slate-700 text-rose-400 px-4 py-1.5 rounded text-xs font-bold transition-colors">Deseleziona Lista</button>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* FASE 1: MACRO E RUOLI */}
        {/* ========================================== */}
        {activeTab === 'phase1' && (
          <div className="flex flex-col flex-1 overflow-hidden animate-in fade-in duration-300 gap-4">
            <div className={`flex items-center justify-between p-4 rounded-xl border transition-all duration-300 shrink-0 ${bulkSelection.size > 0 ? 'bg-cyan-900/30 border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.3)]' : 'bg-slate-900 border-slate-800 opacity-50 pointer-events-none'}`}>
              <span className="text-sm font-black text-white w-48">{bulkSelection.size} Giocatori Selezionati</span>
              <div className="flex items-center gap-4 flex-1">
                <select value={bulkMacro} onChange={e => setBulkMacro(e.target.value)} className="flex-1 bg-slate-950 border border-slate-700 text-cyan-300 text-sm px-3 py-2 rounded outline-none focus:border-cyan-500 font-bold">
                  <option value="">-- Imposta Destinazione --</option>
                  {macroGroups.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <select value={bulkRole} onChange={e => setBulkRole(e.target.value)} className="flex-1 bg-slate-950 border border-slate-700 text-amber-400 text-sm px-3 py-2 rounded outline-none focus:border-amber-500 font-bold">
                  <option value="">-- Imposta Ruolo --</option>
                  <option value="Rally Leader">Rally Leader</option>
                  <option value="Capitano Difesa">Capitano Difesa</option>
                  <option value="Guarnigione (Garrison)">Guarnigione (Garrison)</option>
                  <option value="Filler / Membro">Filler / Membro</option>
                </select>
                <button onClick={applyBulkSettings} className="bg-cyan-600 hover:bg-cyan-500 text-white font-black px-6 py-2 rounded-lg transition-colors whitespace-nowrap">
                  Assegna in Blocco ⚡
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 content-start">
              {filteredForList.map(player => {
                const isSelected = bulkSelection.has(player.id);
                const meta = playerMeta[player.id] || {};
                const displayTag = meta.tempTag || player.originalTag || player.tag || '?';

                return (
                  <div 
                    key={player.id} 
                    className={`p-3 rounded-xl border flex flex-col gap-2 transition-colors cursor-pointer shadow-sm ${isSelected ? 'bg-cyan-950/30 border-cyan-500/50' : 'bg-slate-900 border-slate-700/50 hover:border-slate-500'}`}
                    onClick={() => toggleBulk(player.id)}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <input type="checkbox" checked={isSelected} readOnly className="accent-cyan-500 w-4 h-4 cursor-pointer" />
                        <span className="text-white font-bold text-sm truncate" title={player.name}>
                          <span className={meta.tempTag ? "text-fuchsia-400" : "text-slate-400"}>[{displayTag}]</span> {player.name}
                        </span>
                      </div>
                      <span className="bg-slate-950 px-1.5 py-0.5 rounded text-cyan-400 font-mono text-xs font-black shrink-0">{player.power}M</span>
                    </div>
                    <div className="flex gap-2 pt-2 border-t border-slate-800/80" onClick={e => e.stopPropagation()}>
                      <select 
                        value={meta.macro || ''}
                        onChange={(e) => updatePlayerMeta(player.id, 'macro', e.target.value)}
                        className={`w-1/2 bg-slate-950 border text-[10px] px-1 py-1.5 rounded outline-none font-bold ${meta.macro ? 'border-cyan-700 text-cyan-300' : 'border-slate-700 text-slate-500 focus:border-cyan-500'}`}
                      >
                        <option value="">-- Destinazione --</option>
                        {macroGroups.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <select 
                        value={meta.role || ''}
                        onChange={(e) => updatePlayerMeta(player.id, 'role', e.target.value)}
                        className={`w-1/2 bg-slate-950 border text-[10px] px-1 py-1.5 rounded outline-none font-bold ${meta.role ? 'border-amber-700 text-amber-400' : 'border-slate-700 text-slate-500 focus:border-amber-500'}`}
                      >
                        <option value="">-- Ruolo --</option>
                        <option value="Rally Leader">Rally Leader</option>
                        <option value="Capitano Difesa">Capitano Difesa</option>
                        <option value="Guarnigione (Garrison)">Guarnigione (Garrison)</option>
                        <option value="Filler / Membro">Filler / Membro</option>
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* FASE 2: COSTRUISCI SQUADRE D'ASSALTO */}
        {/* ========================================== */}
        {activeTab === 'phase2' && (
          <div className="flex flex-1 gap-6 overflow-hidden animate-in fade-in duration-300">
            <div 
              className="w-1/3 bg-slate-950/50 border border-slate-800 rounded-2xl p-4 flex flex-col shadow-inner"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, null)} 
            >
              <div className="flex flex-col gap-3 mb-4 border-b border-slate-800 pb-4 shrink-0">
                <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Stai organizzando:</span>
                <select 
                  value={viewingMacro} 
                  onChange={e => setViewingMacro(e.target.value)}
                  className="w-full bg-indigo-950/50 border border-indigo-500/50 text-indigo-300 text-lg font-black px-3 py-2 rounded-xl outline-none focus:border-indigo-400 drop-shadow-md"
                >
                  {macroGroups.map(m => <option key={m} value={m}>🎯 {m}</option>)}
                </select>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-xs font-bold text-slate-400">Truppe a disposizione: {availableDraftPlayers.length}</span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                {availableDraftPlayers.map(player => {
                  const meta = playerMeta[player.id] || {};
                  const displayTag = meta.tempTag || player.originalTag || player.tag || '?';
                  return (
                    <div 
                      key={player.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, player.id)}
                      className="bg-slate-800 border border-slate-700 hover:border-cyan-500 p-2 rounded-lg cursor-grab active:cursor-grabbing flex justify-between items-center shadow-sm transition-colors mb-2"
                    >
                      <div className="flex flex-col min-w-0 pr-2">
                        <span className="text-white font-bold text-xs truncate">
                          <span className={meta.tempTag ? "text-fuchsia-400" : "text-slate-400"}>[{displayTag}]</span> {player.name}
                        </span>
                        <select 
                          value={meta.role || ''}
                          onChange={(e) => updatePlayerMeta(player.id, 'role', e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-0.5 max-w-[150px] bg-slate-900 border border-slate-700 text-amber-400 font-bold tracking-wider text-[9px] px-1 py-0.5 rounded outline-none cursor-pointer"
                        >
                          <option value="">{player.role || 'Membro'}</option>
                          <option value="Rally Leader">Rally Leader</option>
                          <option value="Capitano Difesa">Capitano Difesa</option>
                          <option value="Guarnigione (Garrison)">Guarnigione (Garrison)</option>
                          <option value="Filler / Membro">Filler / Membro</option>
                        </select>
                      </div>
                      <div className="bg-slate-900 px-2 py-1 rounded text-cyan-400 font-mono text-xs font-black shrink-0">
                        {player.power}M
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="w-2/3 flex flex-col gap-4">
              <div className="flex items-center gap-2 shrink-0">
                <form onSubmit={handleAddTeam} className="flex flex-1 gap-2">
                  <input 
                    type="text" 
                    value={newTeamName} 
                    onChange={e => setNewTeamName(e.target.value)}
                    placeholder={`Premi Invio per chiamarla "${viewingMacro}"...`}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-indigo-500 font-bold"
                  />
                  <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-black text-sm transition-colors shadow-lg whitespace-nowrap">
                    + Aggiungi
                  </button>
                </form>

                {selectedTeamsForBalance.size > 1 && (
                  <button 
                    onClick={handleBalanceTeams}
                    className="bg-amber-600 hover:bg-amber-500 text-white px-6 py-3 rounded-xl font-black text-sm transition-all shadow-[0_0_15px_rgba(217,119,6,0.5)] whitespace-nowrap flex items-center gap-2 animate-in slide-in-from-right-4"
                  >
                    ⚖️ Bilancia ({selectedTeamsForBalance.size})
                  </button>
                )}
              </div>

              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto custom-scrollbar pr-2 pb-2">
                {activeTeams.map(team => {
                  const teamPlayersList = getTeamPlayers(team.id);
                  const power = getTeamPower(team.id);
                  const isSelectedForBalance = selectedTeamsForBalance.has(team.id);

                  return (
                    <div 
                      key={team.id}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, team.id)}
                      className={`bg-slate-900 border rounded-2xl p-4 flex flex-col shadow-lg transition-colors group ${isSelectedForBalance ? 'border-amber-500/80 bg-amber-950/10' : 'border-slate-700/50 hover:border-indigo-900'}`}
                    >
                      <div className="flex justify-between items-center mb-3 border-b border-slate-800 pb-2">
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          <input 
                            type="checkbox" 
                            checked={isSelectedForBalance} 
                            onChange={() => toggleTeamBalanceSelection(team.id)}
                            className="accent-amber-500 w-4 h-4 cursor-pointer shrink-0" 
                          />
                          <h4 className={`font-black text-base truncate ${isSelectedForBalance ? 'text-amber-400' : 'text-white'}`}>
                            ⚔️ {team.name}
                          </h4>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="bg-slate-950 border border-slate-700 text-slate-300 px-2 py-1 rounded text-xs font-black shadow-inner flex items-center gap-1">
                            👥 {teamPlayersList.length}
                          </span>
                          <span className={`bg-indigo-950 border px-2 py-1 rounded text-xs font-black shadow-inner ${isSelectedForBalance ? 'border-amber-500/30 text-amber-400' : 'border-indigo-500/30 text-indigo-400'}`}>
                            {power.toFixed(1)}M
                          </span>
                          <button onClick={() => handleRemoveTeam(team.id)} className="text-slate-600 hover:text-rose-500 font-bold opacity-0 group-hover:opacity-100 transition-opacity" title="Elimina Squadra">✕</button>
                        </div>
                      </div>

                      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 min-h-[250px] bg-slate-950/40 rounded-xl p-3 border border-slate-800/50 border-dashed shadow-inner">
                        {teamPlayersList.length === 0 ? (
                          <div className="h-full flex items-center justify-center text-slate-600 text-xs uppercase font-black tracking-widest text-center px-4">
                            Trascina qui i giocatori
                          </div>
                        ) : (
                          teamPlayersList.map(player => {
                            const meta = playerMeta[player.id] || {};
                            const displayTag = meta.tempTag || player.originalTag || player.tag || '?';
                            return (
                              <div 
                                key={player.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, player.id)}
                                className="bg-slate-800 border border-slate-700 hover:border-cyan-500 p-2 rounded-lg cursor-grab active:cursor-grabbing flex justify-between items-center shadow-sm transition-colors mb-2"
                              >
                                <div className="flex flex-col min-w-0 pr-2">
                                  <span className="text-white font-bold text-xs truncate">
                                    <span className={meta.tempTag ? "text-fuchsia-400" : "text-slate-400"}>[{displayTag}]</span> {player.name}
                                  </span>
                                  <select 
                                    value={meta.role || ''}
                                    onChange={(e) => updatePlayerMeta(player.id, 'role', e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="mt-0.5 max-w-[150px] bg-slate-900 border border-slate-700 text-amber-400 font-bold tracking-wider text-[9px] px-1 py-0.5 rounded outline-none cursor-pointer"
                                  >
                                    <option value="">{player.role || 'Membro'}</option>
                                    <option value="Rally Leader">Rally Leader</option>
                                    <option value="Capitano Difesa">Capitano Difesa</option>
                                    <option value="Guarnigione (Garrison)">Guarnigione (Garrison)</option>
                                    <option value="Filler / Membro">Filler / Membro</option>
                                  </select>
                                </div>
                                <div className="bg-slate-900 px-2 py-1 rounded text-cyan-400 font-mono text-xs font-black shrink-0">
                                  {player.power}M
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

{/* ========================================== */}
        {/* FASE 3: RIASSEGNAZIONE ALLEANZE (VOLI) PER SQUADRE */}
        {/* ========================================== */}
        {activeTab === 'phase3' && (
          <div className="flex flex-col flex-1 overflow-hidden animate-in fade-in duration-300 gap-4">
            
            <div className="bg-fuchsia-950/30 border border-fuchsia-500/50 p-4 rounded-xl shrink-0 shadow-inner flex items-center justify-between">
              <div>
                <h3 className="text-fuchsia-400 font-black text-lg flex items-center gap-2">✈️ Gestione Voli per Squadra</h3>
                <p className="text-xs text-fuchsia-200/70 mt-1">
                  Assegna il tag alleanza evento. Per generare e copiare i messaggi da inviare in chat, chiudi questo pannello e usa il tasto <b>Esporta</b> nella mappa principale.
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 flex flex-col gap-6 pb-6">
              {macroGroups.map(macro => {
                const macroTeams = teams.filter(t => t.macro === macro);
                if (macroTeams.length === 0) return null;

                return (
                  <div key={macro} className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">{macro}</h4>
                      <div className="h-px bg-slate-800 flex-1"></div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                      {macroTeams.map(team => {
                        const teamPlayers = getTeamPlayers(team.id);
                        const leader = teamPlayers.find(p => playerMeta[p.id]?.role === 'Rally Leader') || teamPlayers.find(p => playerMeta[p.id]?.role === 'Capitano Difesa') || teamPlayers[0];
                        const originalTags = getTeamOriginalTags(team.id);

                        return (
                          <div key={team.id} className="bg-slate-900 border border-slate-700/50 rounded-2xl p-4 flex flex-col shadow-lg hover:border-fuchsia-500/50 transition-colors">
                            <div className="flex justify-between items-center mb-3 border-b border-slate-800 pb-2">
                              <h5 className="font-black text-white text-sm truncate pr-2" title={team.name}>⚔️ {team.name}</h5>
                              <span className="bg-slate-950 px-2 py-1 rounded text-xs font-black shadow-inner text-slate-400 shrink-0">
                                👥 {teamPlayers.length}
                              </span>
                            </div>

                            <div className="flex flex-col gap-1 mb-4">
                              <div className="flex justify-between items-center text-[10px]">
                                <span className="text-slate-500 uppercase font-bold">Leader:</span>
                                <span className="font-bold text-cyan-300 truncate max-w-[120px]">{leader ? leader.name : 'Nessuno'}</span>
                              </div>
                              <div className="flex justify-between items-center text-[10px]">
                                <span className="text-slate-500 uppercase font-bold">Origine:</span>
                                <span className="font-bold text-slate-400 truncate max-w-[120px]" title={originalTags}>[{originalTags}]</span>
                              </div>
                            </div>

                            <div className="mt-auto bg-fuchsia-950/20 p-2 rounded-xl border border-fuchsia-900/30 flex flex-col gap-1.5">
                              <span className="text-[9px] text-fuchsia-400 uppercase font-black tracking-wider text-center">Tag Alleanza Evento</span>
                              <div className="flex items-center gap-1">
                                <span className="text-slate-600 font-black text-lg leading-none">[</span>
                                <select
                                  value={getTeamTag(team.id)}
                                  onChange={(e) => handleTeamTagChange(team.id, e.target.value)}
                                  className="w-full bg-slate-950 border border-slate-700 text-fuchsia-300 text-xs px-2 py-1.5 rounded outline-none focus:border-fuchsia-500 font-bold uppercase text-center cursor-pointer"
                                >
                                  <option value="" className="text-slate-500 italic">-- RESET VOLO --</option>
                                  {uniqueTags.filter(t => t !== 'Senza Alleanza').map(tag => (
                                    <option key={tag} value={tag} className="text-fuchsia-300 font-bold">{tag}</option>
                                  ))}
                                </select>
                                <span className="text-slate-600 font-black text-lg leading-none">]</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              
              {teams.length === 0 && (
                <div className="flex flex-col items-center justify-center text-center py-20 text-slate-500">
                  <span className="text-4xl mb-4">🏗️</span>
                  <p>Non hai ancora creato nessuna squadra.</p>
                  <p className="text-xs mt-1">Vai allo Step 2 per comporre le tue squadre prima di assegnare i voli!</p>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}