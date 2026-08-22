import React, { useState, useEffect } from 'react';

// Palette di colori arricchita con sfondi trasparenti per le "Drop Zone"
export const TEAM_COLORS = {
  rose: { name: 'Rosso (Attacco)', bg: 'bg-rose-500', text: 'text-rose-400', border: 'border-rose-500', zone: 'bg-rose-950/20 border-rose-900/50' },
  cyan: { name: 'Azzurro (Difesa)', bg: 'bg-cyan-500', text: 'text-cyan-400', border: 'border-cyan-500', zone: 'bg-cyan-950/20 border-cyan-900/50' },
  emerald: { name: 'Verde (Supporto)', bg: 'bg-emerald-500', text: 'text-emerald-400', border: 'border-emerald-500', zone: 'bg-emerald-950/20 border-emerald-900/50' },
  amber: { name: 'Giallo (Incursori)', bg: 'bg-amber-500', text: 'text-amber-400', border: 'border-amber-500', zone: 'bg-amber-950/20 border-amber-900/50' },
  fuchsia: { name: 'Viola (Flessibile)', bg: 'bg-fuchsia-500', text: 'text-fuchsia-400', border: 'border-fuchsia-500', zone: 'bg-fuchsia-950/20 border-fuchsia-900/50' }
};

export default function TeamBuilderModal({ isOpen, onClose, activeRoster, draftData, onSaveDraft }) {
  const [teams, setTeams] = useState(draftData?.teams || []);
  const [playerMeta, setPlayerMeta] = useState(draftData?.playerMeta || {});
  
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamColor, setNewTeamColor] = useState('rose');

  // 💡 STATI PER LA MODALITÀ EDIT
  const [editingTeamId, setEditingTeamId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  useEffect(() => {
    if (draftData) {
      setTeams(draftData.teams || []);
      setPlayerMeta(draftData.playerMeta || {});
    }
  }, [draftData]);

  if (!isOpen) return null;

  // --- GESTIONE SQUADRE ---
  const handleAddTeam = (e) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    const newTeam = { id: `team-${Date.now()}`, name: newTeamName.trim(), color: newTeamColor };
    setTeams([...teams, newTeam]);
    setNewTeamName('');
  };

  const handleRemoveTeam = (teamId) => {
    if (!window.confirm("Sei sicuro di voler eliminare questa squadra? I giocatori torneranno nel roster disponibile.")) return;
    const newMeta = { ...playerMeta };
    Object.keys(newMeta).forEach(pId => {
      if (newMeta[pId].teamId === teamId) delete newMeta[pId].teamId;
    });
    setPlayerMeta(newMeta);
    setTeams(teams.filter(t => t.id !== teamId));
  };

  // 💡 FUNZIONI DI MODIFICA (EDIT)
  const startEditing = (team) => {
    setEditingTeamId(team.id);
    setEditName(team.name);
    setEditColor(team.color);
  };

  const saveEdit = () => {
    if (!editName.trim()) return alert("Il nome non può essere vuoto!");
    setTeams(teams.map(t => 
      t.id === editingTeamId ? { ...t, name: editName.trim(), color: editColor } : t
    ));
    setEditingTeamId(null);
  };

  const cancelEdit = () => {
    setEditingTeamId(null);
  };

  // --- DRAG & DROP LOGIC ---
  const handleAssignPlayer = (playerId, teamId) => {
    setPlayerMeta(prev => {
       const newMeta = { ...prev };
       if (!newMeta[playerId]) newMeta[playerId] = {};
       
       if (teamId === null) {
          delete newMeta[playerId].teamId; 
       } else {
          newMeta[playerId].teamId = teamId;
       }
       return newMeta;
    });
  };

  const handleDragStart = (e, playerId) => {
    e.dataTransfer.setData('playerId', playerId);
  };

  const handleDrop = (e, targetTeamId) => {
    e.preventDefault();
    const playerId = e.dataTransfer.getData('playerId');
    if (playerId) handleAssignPlayer(playerId, targetTeamId);
  };

  const handleDragOver = (e) => {
    e.preventDefault(); 
  };

  // --- CALCOLI DERIVATI ---
  const unassignedPlayers = activeRoster
    .filter(p => !playerMeta[p.id]?.teamId)
    .sort((a, b) => (Number(b.power) || 0) - (Number(a.power) || 0));

  const getTeamPlayers = (teamId) => {
    return activeRoster
      .filter(p => playerMeta[p.id]?.teamId === teamId)
      .sort((a, b) => (Number(b.power) || 0) - (Number(a.power) || 0));
  };

  const getTeamPower = (teamId) => {
    return getTeamPlayers(teamId).reduce((sum, p) => sum + (Number(p.power) || 0), 0);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-cyan-500/30 rounded-3xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden">
        
        {/* HEADER */}
        <div className="p-6 border-b border-slate-800 flex justify-between items-start bg-slate-950/50 shrink-0">
          <div>
            <h2 className="text-2xl font-black text-cyan-400 uppercase tracking-widest flex items-center gap-3">
              <span>🛡️</span> Costruttore Squadre Tattiche
            </h2>
            <p className="text-sm text-slate-400 mt-1">Trascina i giocatori nelle squadre in base alla loro potenza. I colori si rifletteranno sulla mappa.</p>
          </div>
          <div className="flex gap-4 items-center">
            <div className="bg-slate-900 border border-slate-700 px-4 py-2 rounded-lg text-xs font-bold text-slate-300 shadow-inner">
              In attesa: <span className="text-white">{unassignedPlayers.length}</span> | Assegnati: <span className="text-cyan-400">{activeRoster.length - unassignedPlayers.length}</span>
            </div>
            <button 
              onClick={() => onSaveDraft({ teams, playerMeta })}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-6 py-2.5 rounded-xl text-sm transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)]"
            >
              💾 Salva Squadre
            </button>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-rose-400 bg-slate-800 hover:bg-slate-700 rounded-full w-10 h-10 flex items-center justify-center font-bold border border-slate-700">✕</button>
          </div>
        </div>

        {/* CORPO PRINCIPALE */}
        <div className="flex flex-1 overflow-hidden">
          
          {/* COLONNA SINISTRA: ROSTER NON ASSEGNATO */}
          <div 
            className="w-1/3 lg:w-1/4 bg-slate-950/50 border-r border-slate-800 p-4 flex flex-col shadow-inner"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, null)} 
          >
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 pb-2 border-b border-slate-800 flex justify-between items-center">
              <span>Roster Disponibile</span>
              <span className="bg-slate-800 px-2 py-0.5 rounded text-white">{unassignedPlayers.length}</span>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 flex flex-col gap-2">
              {unassignedPlayers.length === 0 ? (
                <div className="text-center text-slate-600 text-xs italic py-10">Tutti i giocatori sono stati assegnati!</div>
              ) : (
                unassignedPlayers.map(player => (
                  <div 
                    key={player.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, player.id)}
                    className="bg-slate-800 border border-slate-700 hover:border-cyan-500 p-2.5 rounded-xl cursor-grab active:cursor-grabbing flex justify-between items-center shadow-sm transition-colors group"
                  >
                    <span className="text-white font-bold text-xs truncate group-hover:text-cyan-300 transition-colors">
                      <span className="text-slate-500">[{player.originalTag || player.tag || '?'}]</span> {player.name}
                    </span>
                    <span className="bg-slate-900 px-2 py-1 rounded text-cyan-400 font-mono text-[10px] font-black shrink-0 border border-slate-800">
                      {player.power}M
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* COLONNA DESTRA: GESTIONE SQUADRE */}
          <div className="w-2/3 lg:w-3/4 p-6 flex flex-col gap-6 bg-slate-900/30 overflow-y-auto custom-scrollbar">
            
            {/* CREAZIONE SQUADRA */}
            <form onSubmit={handleAddTeam} className="flex gap-4 bg-slate-900 border border-slate-700 p-4 rounded-2xl shadow-inner shrink-0 items-center">
              <input 
                type="text" 
                value={newTeamName} 
                onChange={e => setNewTeamName(e.target.value)} 
                placeholder="Nome Squadra (es. Gruppo Incursori Sud)..."
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500 font-bold"
              />
              <div className="flex gap-2 px-4 border-x border-slate-700">
                {Object.entries(TEAM_COLORS).map(([id, theme]) => (
                  <div 
                    key={id} 
                    onClick={() => setNewTeamColor(id)}
                    className={`w-8 h-8 rounded-full cursor-pointer transition-all border-2 ${theme.bg} ${newTeamColor === id ? 'border-white scale-110 shadow-[0_0_10px_currentColor]' : 'border-transparent opacity-40 hover:opacity-100'}`}
                    title={theme.name}
                  ></div>
                ))}
              </div>
              <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white font-black px-6 py-3 rounded-xl transition-colors text-sm whitespace-nowrap shadow-lg">
                + Crea Squadra
              </button>
            </form>

            {/* GRIGLIA SQUADRE */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-10">
              {teams.length === 0 ? (
                <div className="col-span-full text-center py-20 text-slate-500">
                  <span className="text-4xl mb-4 block">🛡️</span>
                  <p>Non hai ancora creato nessuna squadra.</p>
                  <p className="text-xs mt-1">Usa la barra qui sopra per iniziare.</p>
                </div>
              ) : (
                teams.map(team => {
                  const theme = TEAM_COLORS[team.color] || TEAM_COLORS.cyan;
                  const teamPlayers = getTeamPlayers(team.id);
                  const totalPower = getTeamPower(team.id);
                  const isEditing = editingTeamId === team.id;

                  return (
                    <div 
                      key={team.id} 
                      className={`flex flex-col bg-slate-900 border ${isEditing ? 'border-amber-400 ring-1 ring-amber-400' : theme.border} rounded-2xl shadow-lg transition-all overflow-hidden`}
                    >
                      {/* TEAM HEADER */}
                      {isEditing ? (
                        // 💡 VISTA EDIT
                        <div className={`p-3 border-b border-amber-500/50 bg-slate-950/80 flex flex-col gap-3`}>
                          <input 
                            type="text" 
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="bg-slate-900 border border-slate-700 text-white text-xs font-bold rounded px-2 py-1.5 focus:outline-none focus:border-amber-500 w-full"
                          />
                          <div className="flex justify-between items-center">
                            <div className="flex gap-1.5">
                              {Object.entries(TEAM_COLORS).map(([id, tTheme]) => (
                                <div 
                                  key={id} 
                                  onClick={() => setEditColor(id)}
                                  className={`w-5 h-5 rounded-full cursor-pointer transition-all ${tTheme.bg} ${editColor === id ? 'ring-2 ring-white scale-110 shadow-lg' : 'opacity-40 hover:opacity-100'}`}
                                  title={tTheme.name}
                                ></div>
                              ))}
                            </div>
                            <div className="flex gap-1">
                              <button onClick={saveEdit} className="bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-1 rounded text-[10px] font-black uppercase transition-colors">Salva</button>
                              <button onClick={cancelEdit} className="bg-slate-700 hover:bg-slate-600 text-white px-2 py-1 rounded text-[10px] font-black uppercase transition-colors">Annulla</button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        // 💡 VISTA NORMALE
                        <div className={`p-3 border-b ${theme.border} flex justify-between items-center bg-slate-950/30 group/header`}>
                          <div className="flex items-center gap-2 min-w-0 pr-2">
                            <div className={`w-3 h-3 rounded-full shrink-0 ${theme.bg} shadow-[0_0_8px_currentColor]`}></div>
                            <h4 className={`font-black text-sm truncate ${theme.text}`} title={team.name}>{team.name}</h4>
                          </div>
                          <div className="flex items-center gap-1 opacity-20 group-hover/header:opacity-100 transition-opacity">
                            <button onClick={() => startEditing(team)} className="text-slate-400 hover:text-cyan-400 p-1 text-xs" title="Modifica Squadra">✏️</button>
                            <button onClick={() => handleRemoveTeam(team.id)} className="text-slate-500 hover:text-rose-500 font-bold p-1 text-sm leading-none" title="Elimina Squadra">✕</button>
                          </div>
                        </div>
                      )}

                      {/* TEAM STATS */}
                      <div className="flex justify-between px-4 py-2 bg-slate-900/50 border-b border-slate-800/50 text-[10px] font-black uppercase tracking-wider text-slate-400">
                        <span>👥 {teamPlayers.length} Membri</span>
                        <span className={isEditing ? 'text-amber-400' : theme.text}>⚡ {totalPower.toFixed(1)}M Pw</span>
                      </div>

                      {/* DROP ZONE */}
                      <div 
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, team.id)}
                        className={`flex-1 overflow-y-auto custom-scrollbar p-3 min-h-[200px] max-h-[300px] ${theme.zone} transition-colors border-dashed border-t-0 border-x-0 border-b-0 flex flex-col gap-2`}
                      >
                        {teamPlayers.length === 0 ? (
                          <div className="h-full flex items-center justify-center text-slate-500/50 text-xs font-black uppercase tracking-widest text-center px-4">
                            Trascina qui
                          </div>
                        ) : (
                          teamPlayers.map(player => (
                            <div 
                              key={player.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, player.id)}
                              className="bg-slate-950/80 border border-slate-700/50 hover:border-slate-500 p-2 rounded-lg cursor-grab active:cursor-grabbing flex justify-between items-center shadow-sm transition-colors"
                            >
                              <span className="text-white font-bold text-[11px] truncate pr-2">
                                {player.name}
                              </span>
                              <span className={`px-1.5 py-0.5 rounded font-mono text-[9px] font-black shrink-0 bg-slate-900 ${theme.text}`}>
                                {player.power}M
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}