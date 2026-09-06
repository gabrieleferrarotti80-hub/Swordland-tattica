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

export function RosterTable({ roster, onEdit, onDelete, onAddPlayer, onClearRoster, userRole, onBulkUpdate }) {
  const { t } = useTranslation(); 
  
  const [newPlayer, setNewPlayer] = useState({
    tag: '', name: '', role: 'R1', level: '1', power: 0, marches: 4, x: '', y: '', assignedTrap: 1
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
      if (onClearRoster) onClearRoster();
      else roster.forEach(p => { if (onDelete) onDelete(p.id || p.uniqueKey || p.playerId); });
    }
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
      return 0; 
    });

  return (
    <div className="flex flex-col gap-4 relative">
      <div className="sticky top-0 z-50 bg-slate-950 pb-2 flex flex-col gap-3 shadow-md">
        <div className="flex justify-between items-center pt-2">
          <h3 className="text-lg font-semibold text-slate-200">{t('roster_table.title')}</h3>
        </div>

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
              </select>
            </div>

            <button 
  type="button" 
  onClick={handleAutoTagAll} 
  className="px-3 py-1.5 bg-cyan-700 hover:bg-cyan-600 text-white font-bold text-[10px] md:text-xs uppercase rounded-lg shadow transition-all flex items-center gap-1.5"
  title="Numerazione automatica G1, G2..."
>
  <span>🏷️</span> <span className="hidden sm:inline">Auto-Tag G1..N</span>
</button>

            {roster.length > 0 && (
              <button 
                type="button" onClick={handleClearRoster} disabled={!canKick}
                className={`px-3 py-1.5 font-bold text-[10px] md:text-xs uppercase rounded-lg transition-all flex items-center gap-1.5 border ${canKick ? 'bg-rose-700 hover:bg-rose-600 text-white shadow-[0_0_10px_rgba(225,29,72,0.4)] border-rose-500/50' : 'bg-slate-800 text-slate-600 border-slate-700 cursor-not-allowed'}`}
                title={canKick ? t('roster_table.clear_roster_tooltip', "Svuota Roster") : "Solo l'R5 può svuotare il roster"}
              >
                <span className="text-sm">🗑️</span> <span className="hidden sm:inline">{t('roster_table.clear_roster_btn', 'Svuota Roster')}</span>
              </button>
            )}

            <button type="button" onClick={() => setIsExcelOpen(true)} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] md:text-xs uppercase rounded-lg shadow-[0_0_10px_rgba(16,185,129,0.4)] transition-all flex items-center gap-1.5">
              <span className="text-sm"></span> <span className="hidden sm:inline">{t('roster_table.excel_import_btn')}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-y-auto max-h-[60vh] relative z-10 shadow-inner custom-scrollbar">
        <table className="w-full text-left border-collapse table-fixed">
          <thead className="sticky top-0 z-20 bg-slate-900 shadow-md">
            <tr className="border-b border-slate-700">
              <th className="px-1 py-3 text-emerald-400 font-bold text-[10px] uppercase w-10 text-center" title="Partecipazione">IN</th>
              
              <th className="px-1 py-3 text-slate-400 font-semibold text-[10px] uppercase w-12 text-center">{t('roster_table.tag')}</th>
              
              <th className="px-2 py-3 text-cyan-400 font-bold text-[10px] uppercase w-auto cursor-pointer hover:text-cyan-300 transition-colors select-none" onClick={() => toggleSort()}>
                <div className="flex items-center gap-1">{t('roster_table.name')}<span className="text-slate-500 text-[14px]">{sortOrder === 'asc' ? '▲' : sortOrder === 'desc' ? '▼' : '↕'}</span></div>
              </th>
              
              <th className="px-1 py-3 text-amber-400 font-bold text-[10px] uppercase w-16 text-center cursor-pointer hover:text-amber-300 transition-colors select-none" onClick={() => setSortOrder(sortOrder === 'role' ? 'default' : 'role')}>
                <div className="flex items-center justify-center gap-1">{t('roster_table.role')}{sortOrder === 'role' && <span className="text-slate-500 text-[14px]">▼</span>}</div>
              </th>
              
              <th className="px-1 py-3 text-slate-400 font-semibold text-[10px] uppercase w-12 text-center">{t('roster_table.level')}</th>
              <th className="px-1 py-3 text-slate-400 font-semibold text-[10px] uppercase w-16 text-center">{t('roster_table.power')}</th>
              <th className="px-1 py-3 text-cyan-400 font-bold text-[10px] uppercase w-16 text-center border-l border-slate-700/50">{t('roster_table.coord_x')}</th>
              <th className="px-1 py-3 text-amber-400 font-bold text-[10px] uppercase w-16 text-center">{t('roster_table.coord_y')}</th>
              <th className="px-1 py-3 text-slate-400 font-semibold text-[10px] uppercase w-12 text-center border-l border-slate-700/50">{t('roster_table.marches')}</th>
              
              <th className="px-1 py-3 text-fuchsia-400 font-bold text-[10px] uppercase w-12 text-center border-l border-slate-700/50" title="Assegna a Bear Trap 1 o 2">TRAP</th>
              
              <th className="px-1 py-3 text-slate-400 font-semibold text-xs w-8 text-center"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50 text-sm">
            {processedRoster.length === 0 ? (
              <tr><td colSpan="11" className="p-6 text-center text-slate-500 italic">{roster.length === 0 ? t('roster_table.empty_db') : t('roster_table.no_match')}</td></tr>
            ) : (
              processedRoster.map((player, index) => {
                const uniqueId = player.id || player.uniqueKey || player.playerId || `temp-${index}-${player.name}`;
                return (
                  <tr key={uniqueId} className={`transition-colors ${player.isParticipating ? 'bg-emerald-950/20 hover:bg-emerald-900/40' : 'hover:bg-slate-700/30'}`}>
                    
                    <td className="px-1 py-2 text-center border-r border-slate-700/50">
                      <input 
                        type="checkbox" 
                        checked={!!player.isParticipating} 
                        onChange={(e) => onEdit(player.id, 'isParticipating', e.target.checked)} 
                        className="w-4 h-4 cursor-pointer accent-emerald-500 rounded" 
                      />
                    </td>

                    <td className="px-1 py-2">
                      <EditableInput initialValue={player.tag} onSave={(val) => onEdit(player.id, 'tag', val.toUpperCase())} maxLength="4" className="bg-slate-800 text-cyan-400 w-full outline-none focus:border-b focus:border-cyan-500 font-bold text-center rounded px-1 py-1 text-xs" />
                    </td>
                    <td className="px-2 py-2">
                      <EditableInput initialValue={player.name} onSave={(val) => onEdit(player.id, 'name', val)} className="bg-transparent text-slate-200 w-full outline-none focus:border-b focus:border-cyan-500 px-1 py-1 text-xs font-bold" />
                    </td>
                    <td className="px-1 py-2">
                      <select value={player.role || 'R1'} onChange={(e) => handleRoleChange(player.id, e.target.value)} className="bg-slate-900 border border-transparent hover:border-slate-600 rounded text-slate-200 w-full outline-none focus:border-amber-500 px-0 py-1 cursor-pointer text-center text-xs font-bold">
                        {roleOptions.map(opt => <option key={`edit-role-${uniqueId}-${opt}`} value={opt}>{opt}</option>)}
                      </select>
                    </td>
                    <td className="px-1 py-2">
                      <select value={player.level || '1'} onChange={(e) => onEdit(player.id, 'level', e.target.value)} className="bg-slate-900 border border-transparent hover:border-slate-600 rounded text-slate-200 w-full outline-none focus:border-cyan-500 px-0 py-1 cursor-pointer text-center text-xs">
                        {levelOptions.map(opt => <option key={`edit-${uniqueId}-${opt}`} value={opt}>{opt}</option>)}
                      </select>
                    </td>
                    <td className="px-1 py-2">
                      <EditableInput type="number" initialValue={player.power || 0} onSave={(val) => { onEdit(player.id, 'power', val); onEdit(player.id, 'marches', getDefaultMarches(val)); }} className="bg-transparent text-slate-300 w-full outline-none focus:border-b focus:border-cyan-500 px-1 py-1 text-center text-xs" />
                    </td>
                    <td className="px-1 py-2 border-l border-slate-700/50 bg-cyan-950/20">
                      <EditableInput type="number" initialValue={player.x ?? ''} placeholder="-" onSave={(val) => onEdit(player.id, 'x', val === '' ? '' : Number(val))} className="bg-slate-900 text-cyan-300 font-mono w-full outline-none focus:border-b focus:border-cyan-400 text-center px-1 py-1 text-xs rounded" />
                    </td>
                    <td className="px-1 py-2 bg-amber-950/10">
                      <EditableInput type="number" initialValue={player.y ?? ''} placeholder="-" onSave={(val) => onEdit(player.id, 'y', val === '' ? '' : Number(val))} className="bg-slate-900 text-amber-300 font-mono w-full outline-none focus:border-b focus:border-amber-400 text-center px-1 py-1 text-xs rounded" />
                    </td>
                    <td className="px-1 py-2 border-l border-slate-700/50">
                      <EditableInput type="number" initialValue={player.marches || 4} onSave={(val) => onEdit(player.id, 'marches', val)} className="bg-transparent text-slate-300 w-full outline-none focus:border-b focus:border-cyan-500 text-center px-1 py-1 text-xs" />
                    </td>

                    <td className="px-1 py-2 border-l border-slate-700/50 bg-fuchsia-950/10">
                      <select 
                        value={player.assignedTrap || 1} 
                        onChange={(e) => onEdit(player.id, 'assignedTrap', Number(e.target.value))} 
                        className="bg-slate-900 border border-transparent hover:border-fuchsia-900/50 rounded text-fuchsia-400 w-full outline-none focus:border-fuchsia-500 px-0 py-1 cursor-pointer text-center text-xs font-black"
                      >
                        <option value={1}>T1</option>
                        <option value={2}>T2</option>
                      </select>
                    </td>
                    
                    <td className="px-1 py-2 text-center border-l border-slate-700/50">
                      {canKick ? (
                        <button type="button" onMouseDown={(e) => e.preventDefault()} 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm("Vuoi espellere " + player.name + " dall'Alleanza?")) {
                              if (onDelete) onDelete(player.id || player.uniqueKey || player.playerId);
                            }
                          }} 
                          className="text-slate-500 hover:text-rose-500 font-black px-2 py-1 transition-colors text-lg" title="Espelli dall'Alleanza">
                          ✕
                        </button>
                      ) : (
                        <button type="button" className="text-slate-700 cursor-not-allowed font-black px-2 py-1 text-lg" title="Solo l'R5 può espellere">
                          ✕
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <RosterExcelModal 
        isOpen={isExcelOpen} 
        onClose={() => setIsExcelOpen(false)} 
        onImport={(importedPlayers) => {
          console.log("=========================================");
          console.log("📥 INIZIO IMPORTAZIONE EXCEL (SMART MERGE)");
          console.log(`👤 Giocatori estratti dall'Excel: ${importedPlayers.length}`);
          
          let hasR5inImport = false;
          let currentR5Exists = roster.some(p => p.role === 'R5');
          const updatedRoster = [...roster];

          importedPlayers.forEach((importedPlayer, index) => {
            let assignedRole = importedPlayer.role || 'R1';
            if (assignedRole === 'R5') {
               if (currentR5Exists || hasR5inImport) assignedRole = 'R4'; 
               else hasR5inImport = true;
            }

            const rawImportName = String(importedPlayer.name || '');
            const targetName = rawImportName.trim().toLowerCase().replace(/\s+/g, ' ');
            
            const existingIndex = updatedRoster.findIndex(p => {
               const pName = String(p.name || '').trim().toLowerCase().replace(/\s+/g, ' ');
               return pName === targetName;
            });

            if (existingIndex !== -1) {
              const oldPower = updatedRoster[existingIndex].power;
              const newPower = importedPlayer.power;
              
              console.log(`✅ MATCH TROVATO: [${rawImportName}]`);
              console.log(`   - Potenza Vecchia: ${oldPower} -> Nuova Potenza: ${newPower}`);
              console.log(`   - Livello Vecchio: ${updatedRoster[existingIndex].level} -> Nuovo: ${importedPlayer.level}`);
              
              updatedRoster[existingIndex] = {
                ...updatedRoster[existingIndex],
                role: assignedRole,
                level: importedPlayer.level || updatedRoster[existingIndex].level,
                power: (importedPlayer.power !== undefined && importedPlayer.power !== null) ? Number(importedPlayer.power) : oldPower,
                marches: (importedPlayer.marches !== undefined && importedPlayer.marches !== null) ? Number(importedPlayer.marches) : updatedRoster[existingIndex].marches
              };
           } else {
              console.log(`➕ NESSUN MATCH: Aggiungo [${rawImportName}] come nuovo giocatore.`);
              updatedRoster.push({
                id: `excel-${Date.now()}-${Math.floor(Math.random() * 10000)}-${index}`,
                tag: `G${updatedRoster.length + 1}`, // 👈 Assegnazione automatica sequenziale (G1, G2, G3...)
                name: rawImportName, 
                role: assignedRole,
                level: importedPlayer.level || '1', 
                power: Number(importedPlayer.power) || 0, 
                marches: Number(importedPlayer.marches) || 4,
                x: '', y: '', 
                assignedTrap: 1
              });
            }
          });

          console.log("💾 Salvataggio nel Roster Globale...", updatedRoster);
          console.log("=========================================");
          
          if (onBulkUpdate) {
             onBulkUpdate(updatedRoster);
          }
          setIsExcelOpen(false);
        }} 
        t={t} 
      />
    </div>
  );
}