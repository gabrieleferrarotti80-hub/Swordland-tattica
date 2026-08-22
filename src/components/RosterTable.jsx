import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next'; // 🌍 Import i18n
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

const EditableInput = ({ initialValue, onSave, type = "text", className, maxLength, placeholder }) => {
  const [value, setValue] = useState(initialValue ?? '');

  useEffect(() => {
    setValue(initialValue ?? '');
  }, [initialValue]);

  const handleBlur = () => {
    if (value !== (initialValue ?? '')) {
      onSave(value);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.target.blur();
    }
  };

  return (
    <input
      type={type}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={className}
      maxLength={maxLength}
      placeholder={placeholder}
    />
  );
};

// 💡 AGGIUNTO: Riceviamo userRole e onClearRoster dalle prop
export function RosterTable({ roster, onEdit, onDelete, onAddPlayer, onClearRoster, userRole }) {
  const { t } = useTranslation(); 
  
  const [newPlayer, setNewPlayer] = useState({
    tag: '',
    name: '',
    role: 'R1',
    level: '1', 
    power: 0,
    marches: 4,
    x: '',
    y: '',
    isParticipating: false
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('default');
  const [showAddForm, setShowAddForm] = useState(false); 
  const [isExcelOpen, setIsExcelOpen] = useState(false);

  useEffect(() => {
    setNewPlayer(prev => ({
      ...prev,
      tag: `G${roster.length + 1}`
    }));
  }, [roster.length]);

  const handleSubmit = (e) => {
    e.preventDefault(); 
    
    if (!newPlayer.name || newPlayer.name.trim() === '') {
      alert(t('roster_table.alert_name_required'));
      return; 
    }

    onAddPlayer({
      id: `man-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      tag: newPlayer.tag || `G${roster.length + 1}`, 
      name: newPlayer.name,
      role: newPlayer.role,
      level: newPlayer.level,
      power: Number(newPlayer.power) || 0,
      marches: Number(newPlayer.marches) || getDefaultMarches(newPlayer.power),
      x: newPlayer.x === '' ? '' : Number(newPlayer.x),
      y: newPlayer.y === '' ? '' : Number(newPlayer.y),
      isParticipating: newPlayer.isParticipating
    });

    setNewPlayer({
      tag: `G${roster.length + 2}`, 
      name: '',
      role: 'R1',
      level: '1',
      power: 0,
      marches: 4,
      x: '',
      y: '',
      isParticipating: false
    });
  };

  const toggleSort = () => {
    if (sortOrder === 'default') setSortOrder('asc');
    else if (sortOrder === 'asc') setSortOrder('desc');
    else setSortOrder('default');
  };

  // 💡 FUNZIONE PER SVUOTARE IL ROSTER
  const handleClearRoster = () => {
    if (window.confirm("⚠️ ATTENZIONE: Sei sicuro di voler ELIMINARE TUTTO IL ROSTER?\n\nQuesta operazione cancellerà tutti i giocatori dalla lista attuale. Dovrai poi salvare in Cloud per rendere la modifica definitiva sul database.")) {
      if (onClearRoster) {
        onClearRoster();
      } else {
        // Fallback di sicurezza: se non gli passi onClearRoster, elimina uno per uno
        roster.forEach(p => onDelete(p.id));
      }
    }
  };

  const processedRoster = [...roster]
    .filter(player => {
      const term = searchTerm.toLowerCase();
      const nameMatch = (player.name || '').toLowerCase().includes(term);
      const tagMatch = (player.tag || '').toLowerCase().includes(term);
      return nameMatch || tagMatch;
    })
    .sort((a, b) => {
      if (sortOrder === 'asc') return (a.name || '').localeCompare(b.name || '');
      if (sortOrder === 'desc') return (b.name || '').localeCompare(a.name || '');
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
            <input 
              type="text" 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              placeholder={t('roster_table.search_placeholder')} 
              className="bg-slate-800 border border-slate-600 text-slate-200 px-3 py-1.5 rounded focus:outline-none focus:border-cyan-500 text-sm w-full max-w-sm"
            />
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 hidden sm:flex">
              <select 
                value={sortOrder} 
                onChange={(e) => setSortOrder(e.target.value)} 
                className="bg-slate-800 border border-slate-600 text-slate-200 px-3 py-1.5 rounded focus:outline-none focus:border-cyan-500 text-sm cursor-pointer"
              >
                <option value="default">{t('roster_table.sort_default')}</option>
                <option value="asc">{t('roster_table.sort_asc')}</option>
                <option value="desc">{t('roster_table.sort_desc')}</option>
              </select>
            </div>

           {/* 💡 BOTTONE ELIMINA TUTTO */}
            {roster.length > 0 && (
              <button 
                onClick={handleClearRoster}
                className="px-3 py-1.5 bg-rose-700 hover:bg-rose-600 text-white font-bold text-[10px] md:text-xs uppercase rounded-lg shadow-[0_0_10px_rgba(225,29,72,0.4)] transition-all flex items-center gap-1.5 border border-rose-500/50"
                title="Svuota l'intero Roster"
              >
                <span className="text-sm">🗑️</span> <span className="hidden sm:inline">Svuota Roster</span>
              </button>
            )}

            <button 
              onClick={() => setIsExcelOpen(true)} 
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] md:text-xs uppercase rounded-lg shadow-[0_0_10px_rgba(16,185,129,0.4)] transition-all flex items-center gap-1.5"
              title="Importa da Excel"
            >
              <span className="text-sm">📊</span> <span className="hidden sm:inline">{t('roster_table.excel_import_btn')}</span>
            </button>
          </div>
        </div>

        {showAddForm && (
          <form onSubmit={handleSubmit} className="bg-slate-800 p-4 rounded-lg border border-cyan-700/50 flex flex-wrap gap-3 items-end shadow-inner animate-in slide-in-from-top-4 fade-in duration-300">
            <div className="flex flex-col gap-1 w-14">
              <label className="text-[10px] text-slate-400 uppercase font-bold">{t('roster_table.tag')}</label>
              <input type="text" maxLength="4" value={newPlayer.tag} onChange={e => setNewPlayer({...newPlayer, tag: e.target.value.toUpperCase()})} className="bg-slate-900 border border-slate-600 text-slate-200 px-2 py-2 rounded focus:outline-none focus:border-cyan-500 font-bold text-center text-sm" />
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-[100px]">
              <label className="text-[10px] text-slate-400 uppercase font-bold">{t('roster_table.name')} *</label>
              <input type="text" value={newPlayer.name} onChange={e => setNewPlayer({...newPlayer, name: e.target.value})} className="bg-slate-900 border border-slate-600 text-slate-200 px-2 py-2 rounded focus:outline-none focus:border-cyan-500 text-sm" placeholder={t('roster_table.name_placeholder')} />
            </div>
            <div className="flex flex-col gap-1 w-16">
              <label className="text-[10px] text-slate-400 uppercase font-bold">{t('roster_table.role')}</label>
              <select value={newPlayer.role} onChange={e => setNewPlayer({...newPlayer, role: e.target.value})} className="bg-slate-900 border border-slate-600 text-slate-200 px-1 py-2 rounded focus:outline-none focus:border-cyan-500 cursor-pointer text-sm">
                {roleOptions.map(opt => <option key={`new-role-${opt}`} value={opt}>{opt}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1 w-16">
              <label className="text-[10px] text-slate-400 uppercase font-bold">{t('roster_table.level')}</label>
              <select value={newPlayer.level} onChange={e => setNewPlayer({...newPlayer, level: e.target.value})} className="bg-slate-900 border border-slate-600 text-slate-200 px-1 py-2 rounded focus:outline-none focus:border-cyan-500 cursor-pointer text-sm">
                {levelOptions.map(opt => <option key={`new-${opt}`} value={opt}>{opt}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1 w-16">
              <label className="text-[10px] text-slate-400 uppercase font-bold">{t('roster_table.power')}</label>
              <input type="number" min="0" value={newPlayer.power} onChange={e => setNewPlayer({...newPlayer, power: e.target.value, marches: getDefaultMarches(e.target.value)})} className="bg-slate-900 border border-slate-600 text-slate-200 px-2 py-2 rounded focus:outline-none focus:border-cyan-500 text-sm text-center" />
            </div>
            <div className="flex flex-col gap-1 w-14">
              <label className="text-[10px] text-slate-400 uppercase font-bold">{t('roster_table.marches')}</label>
              <input type="number" min="1" value={newPlayer.marches} onChange={e => setNewPlayer({...newPlayer, marches: e.target.value})} className="bg-slate-900 border border-slate-600 text-slate-200 px-2 py-2 rounded focus:outline-none focus:border-cyan-500 text-sm text-center" />
            </div>
            
            <div className="flex flex-col gap-1 w-16 border-l border-slate-600 pl-3 ml-1">
              <label className="text-[10px] text-cyan-400 uppercase font-bold">{t('roster_table.map_x')}</label>
              <input type="number" value={newPlayer.x} onChange={e => setNewPlayer({...newPlayer, x: e.target.value})} placeholder="---" className="bg-slate-950 border border-cyan-800 text-cyan-200 px-2 py-2 rounded focus:outline-none focus:border-cyan-400 text-sm text-center" />
            </div>
            <div className="flex flex-col gap-1 w-14">
              <label className="text-[10px] text-amber-400 uppercase font-bold">{t('roster_table.map_y')}</label>
              <input type="number" value={newPlayer.y} onChange={e => setNewPlayer({...newPlayer, y: e.target.value})} placeholder="---" className="bg-slate-950 border border-amber-800 text-amber-200 px-2 py-2 rounded focus:outline-none focus:border-amber-400 text-sm text-center" />
            </div>

            <button type="submit" className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded font-bold transition-colors h-[38px] text-sm ml-auto shadow-lg">
              {t('roster_table.save')}
            </button>
          </form>
        )}
      </div>

      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-y-auto max-h-[60vh] relative z-10 shadow-inner custom-scrollbar">
        <table className="w-full text-left border-collapse table-fixed">
          <thead className="sticky top-0 z-20 bg-slate-900 shadow-md">
            <tr className="border-b border-slate-700">
              <th className="px-1 py-3 text-slate-400 font-semibold text-[10px] uppercase w-12 text-center">{t('roster_table.tag')}</th>
              <th 
                className="px-2 py-3 text-cyan-400 font-bold text-[10px] uppercase w-auto cursor-pointer hover:text-cyan-300 transition-colors select-none flex items-center gap-1"
                onClick={toggleSort}
                title="Clicca per cambiare ordine"
              >
                {t('roster_table.name')}
                <span className="text-slate-500 text-[14px]">
                  {sortOrder === 'asc' ? '▲' : sortOrder === 'desc' ? '▼' : '↕'}
                </span>
              </th>
              <th className="px-1 py-3 text-slate-400 font-semibold text-[10px] uppercase w-16 text-center">{t('roster_table.role')}</th>
              <th className="px-1 py-3 text-slate-400 font-semibold text-[10px] uppercase w-16 text-center">{t('roster_table.level')}</th>
              <th className="px-1 py-3 text-slate-400 font-semibold text-[10px] uppercase w-24 text-center">{t('roster_table.power')}</th>
              <th className="px-1 py-3 text-cyan-400 font-bold text-[10px] uppercase w-16 text-center border-l border-slate-700/50">{t('roster_table.coord_x')}</th>
              <th className="px-1 py-3 text-amber-400 font-bold text-[10px] uppercase w-16 text-center">{t('roster_table.coord_y')}</th>
              <th className="px-1 py-3 text-slate-400 font-semibold text-[10px] uppercase w-12 text-center border-l border-slate-700/50">{t('roster_table.marches')}</th>
              <th className="px-1 py-3 text-slate-400 font-semibold text-[10px] uppercase w-12 text-center">{t('roster_table.in_use')}</th>
              <th className="px-1 py-3 text-slate-400 font-semibold text-xs w-8 text-center"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50 text-sm">
            {processedRoster.length === 0 ? (
              <tr>
                <td colSpan="10" className="p-6 text-center text-slate-500 italic">
                  {roster.length === 0 
                    ? t('roster_table.empty_db') 
                    : t('roster_table.no_match')}
                </td>
              </tr>
            ) : (
              processedRoster.map((player, index) => {
                const uniqueId = player.id || player.tag || `temp-${index}`;
                
                return (
                  <tr key={uniqueId} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-1 py-2">
                      <EditableInput 
                        initialValue={player.tag} 
                        onSave={(val) => onEdit(player.id, 'tag', val.toUpperCase())} 
                        maxLength="4" 
                        className="bg-slate-800 text-cyan-400 w-full outline-none focus:border-b focus:border-cyan-500 font-bold text-center rounded px-1 py-1 text-xs" 
                      />
                    </td>
                    <td className="px-2 py-2">
                      <EditableInput 
                        initialValue={player.name} 
                        onSave={(val) => onEdit(player.id, 'name', val)} 
                        className="bg-transparent text-slate-200 w-full outline-none focus:border-b focus:border-cyan-500 px-1 py-1 text-xs font-bold" 
                      />
                    </td>
                    <td className="px-1 py-2">
                      <select value={player.role || 'R1'} onChange={(e) => onEdit(player.id, 'role', e.target.value)} className="bg-slate-900 border border-transparent hover:border-slate-600 rounded text-slate-200 w-full outline-none focus:border-cyan-500 px-0 py-1 cursor-pointer text-center text-xs">
                        {roleOptions.map(opt => <option key={`edit-role-${uniqueId}-${opt}`} value={opt}>{opt}</option>)}
                      </select>
                    </td>
                    <td className="px-1 py-2">
                      <select value={player.level || '1'} onChange={(e) => onEdit(player.id, 'level', e.target.value)} className="bg-slate-900 border border-transparent hover:border-slate-600 rounded text-slate-200 w-full outline-none focus:border-cyan-500 px-0 py-1 cursor-pointer text-center text-xs">
                        {levelOptions.map(opt => <option key={`edit-${uniqueId}-${opt}`} value={opt}>{opt}</option>)}
                      </select>
                    </td>
                    <td className="px-1 py-2">
                      <EditableInput 
                        type="number"
                        initialValue={player.power || 0} 
                        onSave={(val) => { 
                          onEdit(player.id, 'power', val); 
                          onEdit(player.id, 'marches', getDefaultMarches(val)); 
                        }} 
                        className="bg-transparent text-slate-300 w-full outline-none focus:border-b focus:border-cyan-500 px-1 py-1 text-center text-xs" 
                      />
                    </td>
                    
                    <td className="px-1 py-2 border-l border-slate-700/50 bg-cyan-950/20">
                      <EditableInput 
                        type="number"
                        initialValue={player.x ?? ''} 
                        placeholder="-" 
                        onSave={(val) => onEdit(player.id, 'x', val === '' ? '' : Number(val))} 
                        className="bg-slate-900 text-cyan-300 font-mono w-full outline-none focus:border-b focus:border-cyan-400 text-center px-1 py-1 text-xs rounded" 
                      />
                    </td>
                    <td className="px-1 py-2 bg-amber-950/10">
                      <EditableInput 
                        type="number"
                        initialValue={player.y ?? ''} 
                        placeholder="-" 
                        onSave={(val) => onEdit(player.id, 'y', val === '' ? '' : Number(val))} 
                        className="bg-slate-900 text-amber-300 font-mono w-full outline-none focus:border-b focus:border-amber-400 text-center px-1 py-1 text-xs rounded" 
                      />
                    </td>

                    <td className="px-1 py-2 border-l border-slate-700/50">
                      <EditableInput 
                        type="number"
                        initialValue={player.marches || 4} 
                        onSave={(val) => onEdit(player.id, 'marches', val)} 
                        className="bg-transparent text-slate-300 w-full outline-none focus:border-b focus:border-cyan-500 text-center px-1 py-1 text-xs" 
                      />
                    </td>
                    <td className="px-1 py-2 flex justify-center">
                      <button onClick={() => onEdit(player.id, 'isParticipating', !player.isParticipating)} className={`px-2 py-1 rounded font-bold w-full text-center text-white transition-colors text-[10px] ${player.isParticipating ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500'}`}>
                        {player.isParticipating ? t('roster_table.yes') : t('roster_table.no')}
                      </button>
                    </td>
                    <td className="px-1 py-2 text-center">
                      <button onClick={() => onDelete(player.id)} className="text-slate-500 hover:text-red-400 font-bold px-1 py-1 transition-colors" title={t('roster_table.remove_player')}>✕</button>
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
          importedPlayers.forEach((player, index) => {
            onAddPlayer({
              id: `excel-${Date.now()}-${Math.floor(Math.random() * 10000)}-${index}`,
              tag: '',
              name: player.name,
              role: player.role,
              level: player.level || '1',
              power: player.power,
              marches: player.marches,
              x: '',
              y: '',
              isParticipating: false
            });
          });
          setIsExcelOpen(false);
        }} 
        t={t} 
      />
    </div>
  );
}