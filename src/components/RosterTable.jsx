import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import RosterExcelModal from './roster/RosterExcelModal';

const levelOptions = [
  ...Array.from({ length: 30 }, (_, i) => String(i + 1)),
  ...Array.from({ length: 11 }, (_, i) => `TG${i + 1}`)
];

const roleOptions = ['R1', 'R2', 'R3', 'R4', 'R5'];

const getDefaultMarches = (power) => {
  const p = Number(power);
  if (p < 90) return 4;
  if (p <= 180) return 5;
  return 6;
};

const getRoleWeight = (role) => {
  const match = String(role || 'R1').match(/R(\d)/i);
  return match ? parseInt(match[1], 10) : 0;
};

const EditableInput = ({ initialValue, onSave, type = "text", className, maxLength, placeholder }) => {
  const [value, setValue] = useState(initialValue ?? '');

  useEffect(() => {
    setValue(initialValue ?? '');
  }, [initialValue]);

  const handleBlur = () => { if (value !== (initialValue ?? '')) onSave(value); };
  const handleKeyDown = (e) => { if (e.key === 'Enter') e.target.blur(); };

  return (
    <input type={type} value={value} onChange={(e) => setValue(e.target.value)} onBlur={handleBlur} onKeyDown={handleKeyDown} className={className} maxLength={maxLength} placeholder={placeholder} />
  );
};

export function RosterTable({ roster, onEdit, onDelete, onAddPlayer, onClearRoster, userRole, onBulkUpdate, isSwordlandMode = false }) {
  const { t } = useTranslation(); 
  
  const [newPlayer, setNewPlayer] = useState({
    tag: '', name: '', role: 'R1', level: '1', power: 0, marches: 4, x: '', y: '', assignedTrap: 1, participation: 2
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('default');
  const [isExcelOpen, setIsExcelOpen] = useState(false);

  const canKick = ['r5', 'admin', 'master'].includes(String(userRole).toLowerCase());

  useEffect(() => {
    setNewPlayer(prev => ({ ...prev, tag: `G${roster.length + 1}` }));
  }, [roster.length]);

  const handleRoleChange = (playerId, newRole) => {
    if (newRole === 'R5') {
      const existingR5 = roster.find(p => p.role === 'R5' && p.id !== playerId);
      if (existingR5) {
        alert("⚠️ Ci può essere un solo R5 per alleanza. Declassa prima l'R5 attuale.");
        return;
      }
    }
    onEdit(playerId, 'role', newRole);
  };

  const handleAutoTagAll = () => {
    if (window.confirm("Vuoi assegnare automaticamente i codici G1, G2, G3... a tutti i giocatori in ordine?")) {
      const updated = roster.map((p, idx) => ({
        ...p,
        tag: `G${idx + 1}`
      }));
      if (onBulkUpdate) onBulkUpdate(updated);
    }
  };

 const handleClearRoster = () => {
    if (window.confirm(t('roster_table.clear_roster_confirm', "⚠️ ATTENZIONE: Sei sicuro di voler ELIMINARE TUTTO IL ROSTER?"))) {
      if (onClearRoster) {
        onClearRoster();
      } else if (onBulkUpdate) {
        // 🚀 Soluzione definitiva: sovrascrive il Roster con un array vuoto in un solo colpo!
        onBulkUpdate([]); 
      } else if (onDelete) {
        // Fallback di emergenza
        roster.forEach(p => onDelete(p.id || p.uniqueKey || p.playerId));
      }
    }
  };

  const toggleSort = () => {
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  };

  const processedRoster = [...roster]
    .filter(player => {
      const term = searchTerm.toLowerCase();
      return (player.name || '').toLowerCase().includes(term) || (player.tag || '').toLowerCase().includes(term);
    })
    .sort((a, b) => {
      if (sortOrder === 'asc') return (a.name || '').localeCompare(b.name || '');
      if (sortOrder === 'desc') return (b.name || '').localeCompare(a.name || '');
      if (sortOrder === 'role') {
         const diff = getRoleWeight(b.role) - getRoleWeight(a.role); 
         if (diff !== 0) return diff;
         return (a.name || '').localeCompare(b.name || ''); 
      }
      if (sortOrder === 'bearScore') {
         const scoreA = (Number(a.power) || 0) * (Number(a.participation) || 2);
         const scoreB = (Number(b.power) || 0) * (Number(b.participation) || 2);
         if (scoreB !== scoreA) return scoreB - scoreA;
         return (Number(b.power) || 0) - (Number(a.power) || 0);
      }
      return 0; 
    });

  return (
    <div className="flex flex-col gap-4 relative">
      <div className="sticky top-0 z-50 bg-slate-950 pb-2 flex flex-col gap-3 shadow-md">
        
        {!isSwordlandMode && (
          <div className="flex justify-between items-center pt-2">
            <h3 className="text-lg font-semibold text-slate-200">{t('roster_table.title')}</h3>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 p-3 rounded-lg border border-slate-700 shadow-xl">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder={t('roster_table.search_placeholder')} className="bg-slate-800 border border-slate-600 text-slate-200 px-3 py-1.5 rounded focus:outline-none focus:border-cyan-500 text-sm w-full max-w-sm" />
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 hidden sm:flex">
              <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="bg-slate-800 border border-slate-600 text-slate-200 px-3 py-1.5 rounded focus:outline-none focus:border-cyan-500 text-sm cursor-pointer">
                <option value="default">{t('roster_table.sort_default')}</option>
                <option value="asc">{t('roster_table.sort_asc')}</option>
                <option value="desc">{t('roster_table.sort_desc')}</option>
                <option value="role">{t('roster_table.sort_role', '↕ Ordine: Ruolo (R5 ➝ R1)')}</option>
                <option value="bearScore">🐻 Ordine: Priorità Hive (Potenza × Costanza)</option>
              </select>
            </div>

            {!isSwordlandMode && (
              <>
                <button type="button" onClick={handleAutoTagAll} className="px-3 py-1.5 bg-cyan-700 hover:bg-cyan-600 text-white font-bold text-[10px] md:text-xs uppercase rounded-lg shadow transition-all flex items-center gap-1.5" title="Numerazione automatica G1, G2...">
                  <span>🏷️</span> <span className="hidden sm:inline">Auto-Tag G1..N</span>
                </button>

                {roster.length > 0 && (
                  <button type="button" onClick={handleClearRoster} disabled={!canKick} className={`px-3 py-1.5 font-bold text-[10px] md:text-xs uppercase rounded-lg transition-all flex items-center gap-1.5 border ${canKick ? 'bg-rose-700 hover:bg-rose-600 text-white shadow-[0_0_10px_rgba(225,29,72,0.4)] border-rose-500/50' : 'bg-slate-800 text-slate-600 border-slate-700 cursor-not-allowed'}`} title={canKick ? t('roster_table.clear_roster_tooltip', "Svuota Roster") : "Solo l'R5 può svuotare il roster"}>
                    <span className="text-sm">🗑️</span> <span className="hidden sm:inline">{t('roster_table.clear_roster_btn', 'Svuota Roster')}</span>
                  </button>
                )}

                <button type="button" onClick={() => setIsExcelOpen(true)} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] md:text-xs uppercase rounded-lg shadow-[0_0_10px_rgba(16,185,129,0.4)] transition-all flex items-center gap-1.5">
                  <span className="text-sm">📊</span> <span className="hidden sm:inline">{t('roster_table.excel_import_btn')}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-y-auto max-h-[60vh] relative z-10 shadow-inner custom-scrollbar">
        <table className="w-full text-left border-collapse table-fixed">
          <thead className="sticky top-0 z-20 bg-slate-900 shadow-md">
            <tr className="border-b border-slate-700">
              {isSwordlandMode && (
                <th className="px-1 py-3 text-emerald-400 font-bold text-[10px] uppercase w-10 text-center" title="Partecipazione">IN</th>
              )}
              
              <th className="px-1 py-3 text-slate-400 font-semibold text-[10px] uppercase w-12 text-center">{t('roster_table.tag')}</th>
              
              <th className="px-2 py-3 text-cyan-400 font-bold text-[10px] uppercase w-auto cursor-pointer hover:text-cyan-300 transition-colors select-none" onClick={() => toggleSort()}>
                <div className="flex items-center gap-1">{t('roster_table.name')}<span className="text-slate-500 text-[14px]">{sortOrder === 'asc' ? '▲' : sortOrder === 'desc' ? '▼' : '↕'}</span></div>
              </th>
              
              <th className="px-1 py-3 text-amber-400 font-bold text-[10px] uppercase w-14 text-center cursor-pointer hover:text-amber-300 transition-colors select-none" onClick={() => setSortOrder(sortOrder === 'role' ? 'default' : 'role')}>
                <div className="flex items-center justify-center gap-1">{t('roster_table.role')}{sortOrder === 'role' && <span className="text-slate-500 text-[14px]">▼</span>}</div>
              </th>
              
              <th className="px-1 py-3 text-slate-400 font-semibold text-[10px] uppercase w-16 text-center">{t('roster_table.level')}</th>
              <th className="px-1 py-3 text-slate-400 font-semibold text-[10px] uppercase w-16 text-center">{t('roster_table.power')}</th>
              
              {!isSwordlandMode && (
                <>
                  <th className="px-1 py-3 text-cyan-400 font-bold text-[10px] uppercase w-14 text-center border-l border-slate-700/50">{t('roster_table.coord_x')}</th>
                  <th className="px-1 py-3 text-amber-400 font-bold text-[10px] uppercase w-14 text-center">{t('roster_table.coord_y')}</th>
                </>
              )}
              
              <th className="px-1 py-3 text-slate-400 font-semibold text-[10px] uppercase w-12 text-center border-l border-slate-700/50">{t('roster_table.marches')}</th>
              
              {!isSwordlandMode && (
                <>
                  <th className="px-1 py-3 text-fuchsia-400 font-bold text-[10px] uppercase w-12 text-center border-l border-slate-700/50" title="Assegna a Bear Trap 1 o 2">TRAP</th>
                  <th 
                    className="px-1 py-3 text-amber-300 font-bold text-[10px] uppercase w-14 text-center border-l border-slate-700/50 cursor-pointer hover:text-amber-200 select-none" 
                    title="Costanza/Partecipazione (1x Saltuario, 2x Regolare, 3x Assiduo) - Clicca per ordinare per Priorità Hive"
                    onClick={() => setSortOrder(sortOrder === 'bearScore' ? 'default' : 'bearScore')}
                  >
                    COST.{sortOrder === 'bearScore' ? '▼' : ''}
                  </th>
                </>
              )}
              
              {!isSwordlandMode && (
                <th className="px-1 py-3 text-slate-400 font-semibold text-xs w-8 text-center"></th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50 text-sm">
            
            {/* RIGA DI INSERIMENTO MANUALE */}
            {!isSwordlandMode && (
              <tr className="bg-indigo-950/40 border-b border-indigo-500/50 shadow-[inset_0_0_15px_rgba(99,102,241,0.15)]">
                <td className="px-1 py-2">
                  <input type="text" value={newPlayer.tag} onChange={e => setNewPlayer({...newPlayer, tag: e.target.value.toUpperCase()})} maxLength="4" className="bg-slate-900/80 border border-slate-600 text-cyan-400 w-full outline-none focus:border-cyan-500 font-bold text-center rounded px-1 py-1.5 text-xs placeholder:text-slate-600" placeholder="TAG" />
                </td>

                <td className="px-2 py-2">
                  <input type="text" value={newPlayer.name} onChange={e => setNewPlayer({...newPlayer, name: e.target.value})} onKeyDown={(e) => { if (e.key === 'Enter' && newPlayer.name.trim()) { onAddPlayer(newPlayer); setNewPlayer({...newPlayer, name: '', power: 0, tag: `G${roster.length + 2}`, participation: 2}); } }} className="bg-slate-900/80 border border-slate-600 text-white w-full outline-none focus:border-indigo-500 px-2 py-1.5 text-xs font-bold rounded placeholder:text-slate-500" placeholder="Nome Giocatore..." />
                </td>

                <td className="px-1 py-2">
                  <select value={newPlayer.role} onChange={e => setNewPlayer({...newPlayer, role: e.target.value})} className="bg-slate-900/80 border border-slate-600 text-amber-400 w-full outline-none focus:border-amber-500 px-0 py-1.5 text-center text-xs font-bold rounded cursor-pointer">
                    {roleOptions.map(opt => <option key={`new-${opt}`} value={opt} className="bg-slate-900 text-slate-200">{opt}</option>)}
                  </select>
                </td>

                <td className="px-1 py-2">
                  <select value={newPlayer.level} onChange={e => setNewPlayer({...newPlayer, level: e.target.value})} className="bg-slate-900/80 border border-slate-600 text-slate-200 w-full outline-none focus:border-cyan-500 px-0 py-1.5 text-center text-xs rounded cursor-pointer">
                    {levelOptions.map(opt => <option key={`new-lvl-${opt}`} value={opt} className="bg-slate-900">{opt}</option>)}
                  </select>
                </td>

                <td className="px-1 py-2">
                  <input type="number" value={newPlayer.power || ''} onChange={e => setNewPlayer({...newPlayer, power: Number(e.target.value), marches: getDefaultMarches(e.target.value)})} placeholder="0" className="bg-slate-900/80 border border-slate-600 text-emerald-300 w-full outline-none focus:border-emerald-500 px-1 py-1.5 text-center text-xs font-mono font-bold rounded placeholder:text-slate-600" />
                </td>

                <td className="px-1 py-2 border-l border-slate-700/50 bg-cyan-950/30">
                  <input type="number" value={newPlayer.x} onChange={e => setNewPlayer({...newPlayer, x: e.target.value})} placeholder="X" className="bg-slate-900/80 border border-cyan-900/50 text-cyan-300 font-mono w-full outline-none focus:border-cyan-400 text-center px-1 py-1.5 text-xs rounded placeholder:text-slate-700" />
                </td>
                <td className="px-1 py-2 bg-amber-950/20">
                  <input type="number" value={newPlayer.y} onChange={e => setNewPlayer({...newPlayer, y: e.target.value})} placeholder="Y" className="bg-slate-900/80 border border-amber-900/50 text-amber-300 font-mono w-full outline-none focus:border-amber-400 text-center px-1 py-1.5 text-xs rounded placeholder:text-slate-700" />
                </td>

                <td className="px-1 py-2 border-l border-slate-700/50">
                  <input type="number" value={newPlayer.marches} onChange={e => setNewPlayer({...newPlayer, marches: Number(e.target.value)})} className="bg-slate-900/80 border border-slate-600 text-cyan-300 w-full outline-none focus:border-cyan-500 text-center px-1 py-1.5 text-xs font-bold rounded" />
                </td>

                <td className="px-1 py-2 border-l border-slate-700/50 bg-fuchsia-950/20">
                  <select value={newPlayer.assignedTrap} onChange={e => setNewPlayer({...newPlayer, assignedTrap: Number(e.target.value)})} className="bg-slate-900/80 border border-fuchsia-900/50 text-fuchsia-400 w-full outline-none focus:border-fuchsia-500 px-0 py-1.5 text-center text-xs font-black rounded cursor-pointer">
                    <option value={1} className="bg-slate-900">T1</option>
                    <option value={2} className="bg-slate-900">T2</option>
                  </select>
                </td>

                <td className="px-1 py-2 border-l border-slate-700/50 bg-amber-950/20">
                  <select value={newPlayer.participation || 2} onChange={e => setNewPlayer({...newPlayer, participation: Number(e.target.value)})} className="bg-slate-900/80 border border-amber-900/50 text-amber-300 w-full outline-none focus:border-amber-500 px-0 py-1.5 text-center text-xs font-black rounded cursor-pointer" title="Costanza partecipazione (1x, 2x, 3x)">
                    <option value={1} className="bg-slate-900">1x</option>
                    <option value={2} className="bg-slate-900">2x</option>
                    <option value={3} className="bg-slate-900">3x</option>
                  </select>
                </td>

                <td className="px-1 py-2 text-center border-l border-slate-700/50">
                  <button onClick={() => { if (newPlayer.name.trim()) { onAddPlayer(newPlayer); setNewPlayer({...newPlayer, name: '', power: 0, tag: `G${roster.length + 2}`, participation: 2}); } }} disabled={!newPlayer.name.trim()} className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-black py-1.5 rounded-lg transition-colors w-full text-xs shadow-md border border-indigo-500/50 disabled:border-transparent">
                    + ADD
                  </button>
                </td>
              </tr>
            )}

            {/* LISTA GIOCATORI ESISTENTI */}
            {processedRoster.length === 0 ? (
              <tr><td colSpan="12" className="p-6 text-center text-slate-500 italic">{roster.length === 0 ? t('roster_table.empty_db') : t('roster_table.no_match')}</td></tr>
            ) : (
              processedRoster.map((player, index) => {
                const uniqueId = player.id || player.uniqueKey || player.playerId || `temp-${index}-${player.name}`;
                return (
                  <tr key={uniqueId} className={`transition-colors ${isSwordlandMode && player.isParticipating ? 'bg-emerald-950/20 hover:bg-emerald-900/40' : 'hover:bg-slate-700/30'}`}>
                    
                    {isSwordlandMode && (
                      <td className="px-1 py-2 text-center border-r border-slate-700/50">
                        <input type="checkbox" checked={!!player.isParticipating} onChange={(e) => onEdit(player.id, 'isParticipating', e.target.checked)} className="w-4 h-4 cursor-pointer accent-emerald-500 rounded" />
                      </td>
                    )}

                    <td className="px-1 py-2">
                      {isSwordlandMode ? (
                        <div className="text-cyan-400 font-bold text-center text-xs">{player.tag}</div>
                      ) : (
                        <EditableInput initialValue={player.tag} onSave={(val) => onEdit(player.id, 'tag', val.toUpperCase())} maxLength="4" className="bg-slate-800 text-cyan-400 w-full outline-none focus:border-b focus:border-cyan-500 font-bold text-center rounded px-1 py-1 text-xs" />
                      )}
                    </td>

                    <td className="px-2 py-2">
                      {isSwordlandMode ? (
                        <div className="text-slate-200 text-xs font-bold px-1 py-1">{player.name}</div>
                      ) : (
                        <EditableInput initialValue={player.name} onSave={(val) => onEdit(player.id, 'name', val)} className="bg-transparent text-slate-200 w-full outline-none focus:border-b focus:border-cyan-500 px-1 py-1 text-xs font-bold" />
                      )}
                    </td>

                    <td className="px-1 py-2">
                      {isSwordlandMode ? (
                        <div className="text-slate-200 text-center text-xs font-bold px-0 py-1">{player.role || 'R1'}</div>
                      ) : (
                        <select value={player.role || 'R1'} onChange={(e) => handleRoleChange(player.id, e.target.value)} className="bg-slate-900 border border-transparent hover:border-slate-600 rounded text-slate-200 w-full outline-none focus:border-amber-500 px-0 py-1 cursor-pointer text-center text-xs font-bold">
                          {roleOptions.map(opt => <option key={`edit-role-${uniqueId}-${opt}`} value={opt}>{opt}</option>)}
                        </select>
                      )}
                    </td>

                    <td className="px-1 py-2">
                      {isSwordlandMode ? (
                        <div className="text-slate-200 text-center text-xs px-0 py-1">{player.level || '1'}</div>
                      ) : (
                        <select value={player.level || '1'} onChange={(e) => onEdit(player.id, 'level', e.target.value)} className="bg-slate-900 border border-transparent hover:border-slate-600 rounded text-slate-200 w-full outline-none focus:border-cyan-500 px-0 py-1 cursor-pointer text-center text-xs">
                          {levelOptions.map(opt => <option key={`edit-${uniqueId}-${opt}`} value={opt}>{opt}</option>)}
                        </select>
                      )}
                    </td>

                    <td className="px-1 py-2">
                      {isSwordlandMode ? (
                        <div className="text-slate-300 text-center text-xs px-1 py-1">{player.power || 0}</div>
                      ) : (
                        <EditableInput type="number" initialValue={player.power || 0} onSave={(val) => { onEdit(player.id, 'power', val); onEdit(player.id, 'marches', getDefaultMarches(val)); }} className="bg-transparent text-slate-300 w-full outline-none focus:border-b focus:border-cyan-500 px-1 py-1 text-center text-xs" />
                      )}
                    </td>
                    
                    {!isSwordlandMode && (
                      <>
                        <td className="px-1 py-2 border-l border-slate-700/50 bg-cyan-950/20">
                          <EditableInput type="number" initialValue={player.x ?? ''} placeholder="-" onSave={(val) => onEdit(player.id, 'x', val === '' ? '' : Number(val))} className="bg-slate-900 text-cyan-300 font-mono w-full outline-none focus:border-b focus:border-cyan-400 text-center px-1 py-1 text-xs rounded" />
                        </td>
                        <td className="px-1 py-2 bg-amber-950/10">
                          <EditableInput type="number" initialValue={player.y ?? ''} placeholder="-" onSave={(val) => onEdit(player.id, 'y', val === '' ? '' : Number(val))} className="bg-slate-900 text-amber-300 font-mono w-full outline-none focus:border-b focus:border-amber-400 text-center px-1 py-1 text-xs rounded" />
                        </td>
                      </>
                    )}
                    
                    <td className="px-1 py-2 border-l border-slate-700/50">
                      {isSwordlandMode ? (
                        <div className="text-slate-300 text-center text-xs px-1 py-1">{player.marches || 4}</div>
                      ) : (
                        <EditableInput type="number" initialValue={player.marches || 4} onSave={(val) => onEdit(player.id, 'marches', val)} className="bg-transparent text-slate-300 w-full outline-none focus:border-b focus:border-cyan-500 text-center px-1 py-1 text-xs" />
                      )}
                    </td>

                    {!isSwordlandMode && (
                      <>
                        <td className="px-1 py-2 border-l border-slate-700/50 bg-fuchsia-950/10">
                          <select value={player.assignedTrap || 1} onChange={(e) => onEdit(player.id, 'assignedTrap', Number(e.target.value))} className="bg-slate-900 border border-transparent hover:border-fuchsia-900/50 rounded text-fuchsia-400 w-full outline-none focus:border-fuchsia-500 px-0 py-1 cursor-pointer text-center text-xs font-black">
                            <option value={1}>T1</option>
                            <option value={2}>T2</option>
                          </select>
                        </td>

                        <td className="px-1 py-2 border-l border-slate-700/50 bg-amber-950/10">
                          <select 
                            value={player.participation || 2} 
                            onChange={(e) => onEdit(player.id, 'participation', Number(e.target.value))} 
                            title={`Score Orso: ${((Number(player.power) || 0) * (Number(player.participation) || 2)).toFixed(0)} pt`}
                            className={`bg-slate-900 border border-transparent hover:border-amber-900/50 rounded w-full outline-none focus:border-amber-500 px-0 py-1 cursor-pointer text-center text-xs font-black ${Number(player.participation) === 3 ? 'text-emerald-400' : Number(player.participation) === 1 ? 'text-slate-400' : 'text-amber-300'}`}
                          >
                            <option value={1}>1x</option>
                            <option value={2}>2x</option>
                            <option value={3}>3x</option>
                          </select>
                        </td>
                      </>
                    )}
                    
                    {!isSwordlandMode && (
                      <td className="px-1 py-2 text-center border-l border-slate-700/50">
                        {canKick ? (
                          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={(e) => { e.stopPropagation(); if (window.confirm("Vuoi espellere " + player.name + " dall'Alleanza?")) { if (onDelete) onDelete(player.id || player.uniqueKey || player.playerId); } }} className="text-slate-500 hover:text-rose-500 font-black px-2 py-1 transition-colors text-lg" title="Espelli dall'Alleanza">✕</button>
                        ) : (
                          <button type="button" className="text-slate-700 cursor-not-allowed font-black px-2 py-1 text-lg" title="Solo l'R5 può espellere">✕</button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

  {!isSwordlandMode && (
        <RosterExcelModal 
          isOpen={isExcelOpen} 
          onClose={() => setIsExcelOpen(false)} 
          onImport={(importedPlayers) => {
            let hasR5inImport = false;
            let currentR5Exists = roster.some(p => p.role === 'R5');
            const updatedRoster = [...roster];

            const parseTrap = (val) => {
              if (!val) return undefined;
              const str = String(val).trim().toLowerCase();
              if (str.includes('2')) return 2;
              if (str.includes('1')) return 1;
              return undefined;
            };

            const parseParticipation = (val) => {
              if (!val) return undefined;
              const num = parseInt(String(val).replace(/\D/g, ''), 10);
              if (num >= 1 && num <= 3) return num;
              return undefined;
            };

            importedPlayers.forEach((importedPlayer, index) => {
              const rawImportName = String(importedPlayer.name || '');
              const targetName = rawImportName.trim().toLowerCase().replace(/\s+/g, ' ');
              
              const existingIndex = updatedRoster.findIndex(p => {
                 const pName = String(p.name || '').trim().toLowerCase().replace(/\s+/g, ' ');
                 return pName === targetName;
              });

              const excelTrap = parseTrap(importedPlayer.assignedTrap || importedPlayer.trap || importedPlayer.orso || importedPlayer.trappola);
              const excelPart = parseParticipation(importedPlayer.participation || importedPlayer.costanza || importedPlayer.cost);
              
              // Estrazione sicura di X e Y
              const hasX = importedPlayer.x !== undefined && importedPlayer.x !== '' && !isNaN(Number(importedPlayer.x));
              const hasY = importedPlayer.y !== undefined && importedPlayer.y !== '' && !isNaN(Number(importedPlayer.y));

              if (existingIndex !== -1) {
                // GIOCATORE ESISTENTE: Aggiorna i dati incluse X e Y
                const existing = updatedRoster[existingIndex];
                
                let newRole = importedPlayer.role !== undefined && importedPlayer.role !== '' ? importedPlayer.role : existing.role;
                if (newRole === 'R5') {
                   if (currentR5Exists || hasR5inImport) newRole = 'R4'; 
                   else hasR5inImport = true;
                }

                updatedRoster[existingIndex] = {
                  ...existing,
                  role: newRole,
                  level: importedPlayer.level !== undefined && importedPlayer.level !== '' ? importedPlayer.level : existing.level,
                  power: (importedPlayer.power !== undefined && importedPlayer.power !== '') ? Number(importedPlayer.power) : existing.power,
                  marches: (importedPlayer.marches !== undefined && importedPlayer.marches !== '') ? Number(importedPlayer.marches) : existing.marches,
                  x: hasX ? Number(importedPlayer.x) : (existing.x ?? ''),
                  y: hasY ? Number(importedPlayer.y) : (existing.y ?? ''),
                  assignedTrap: excelTrap !== undefined ? excelTrap : (existing.assignedTrap || 1),
                  participation: excelPart !== undefined ? excelPart : (existing.participation || 2)
                };
              } else {
                // NUOVO GIOCATORE: Salva subito X e Y importate
                let newRole = importedPlayer.role || 'R1';
                if (newRole === 'R5') {
                   if (currentR5Exists || hasR5inImport) newRole = 'R4'; 
                   else hasR5inImport = true;
                }

                updatedRoster.push({
                  id: `excel-${Date.now()}-${Math.floor(Math.random() * 10000)}-${index}`,
                  tag: `G${updatedRoster.length + 1}`,
                  name: rawImportName, 
                  role: newRole,
                  level: importedPlayer.level || '1', 
                  power: importedPlayer.power !== undefined && importedPlayer.power !== '' ? Number(importedPlayer.power) : 0, 
                  marches: importedPlayer.marches !== undefined && importedPlayer.marches !== '' ? Number(importedPlayer.marches) : 4,
                  x: hasX ? Number(importedPlayer.x) : '',
                  y: hasY ? Number(importedPlayer.y) : '',
                  assignedTrap: excelTrap !== undefined ? excelTrap : 1,
                  participation: excelPart !== undefined ? excelPart : 2
                });
              }
            });

            if (onBulkUpdate) {
              onBulkUpdate(updatedRoster);
            }
            setIsExcelOpen(false);
          }} 
          t={t} 
        />
      )}
    </div>
  );
}