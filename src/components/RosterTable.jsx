import { useState, useEffect } from 'react';

// Generiamo automaticamente le opzioni del livello (1-30 e TG1-TG11)
const levelOptions = [
  ...Array.from({ length: 30 }, (_, i) => String(i + 1)),
  ...Array.from({ length: 11 }, (_, i) => `TG${i + 1}`)
];

const roleOptions = ['R1', 'R2', 'R3', 'R4', 'R5'];

// Logica di calcolo automatico marce in base al potere
const getDefaultMarches = (power) => {
  const p = Number(power);
  if (p < 90) return 4;
  if (p <= 180) return 5;
  return 6;
};

export function RosterTable({ roster, onEdit, onDelete, onAddPlayer }) {
  // Stato per il form di aggiunta aggiornato con ruolo, default marce e partecipazione a false (no)
  const [newPlayer, setNewPlayer] = useState({
    tag: '',
    name: '',
    role: 'R1',
    level: '1', 
    power: 0,
    marches: 4,
    isParticipating: false // Impostato su "No" di default
  });

  // Genera automaticamente la sigla progressiva 
  useEffect(() => {
    setNewPlayer(prev => ({
      ...prev,
      tag: `G${roster.length + 1}`
    }));
  }, [roster.length]);

  const handleSubmit = (e) => {
    e.preventDefault(); 
    
    if (!newPlayer.name || newPlayer.name.trim() === '') {
      alert("Devi inserire il Nome del Giocatore!");
      return; 
    }

    // Passa i dati ad App.jsx
    onAddPlayer({
      tag: newPlayer.tag || `G${roster.length + 1}`, 
      name: newPlayer.name,
      role: newPlayer.role,
      level: newPlayer.level,
      power: Number(newPlayer.power) || 0,
      marches: Number(newPlayer.marches) || getDefaultMarches(newPlayer.power),
      isParticipating: newPlayer.isParticipating
    });

    // Resetta il form
    setNewPlayer({
      tag: `G${roster.length + 2}`, 
      name: '',
      role: 'R1',
      level: '1',
      power: 0,
      marches: 4,
      isParticipating: false // Impostato su "No" di default anche al reset
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-semibold text-slate-200">Gestione Roster</h3>
      </div>

      {/* FORM AGGIUNTA NUOVO GIOCATORE */}
      <form onSubmit={handleSubmit} className="bg-slate-800 p-4 rounded-lg border border-slate-700 flex flex-wrap gap-4 items-end shadow-inner">
        <div className="flex flex-col gap-1 w-16">
          <label className="text-[10px] text-slate-400 uppercase font-bold">Sigla</label>
          <input 
            type="text" 
            maxLength="4"
            value={newPlayer.tag}
            onChange={e => setNewPlayer({...newPlayer, tag: e.target.value.toUpperCase()})}
            className="bg-slate-900 border border-slate-600 text-slate-200 px-2 py-2 rounded focus:outline-none focus:border-cyan-500 font-bold text-center text-sm"
          />
        </div>
        <div className="flex flex-col gap-1 flex-1 min-w-[120px]">
          <label className="text-[10px] text-slate-400 uppercase font-bold">Nome Giocatore *</label>
          <input 
            type="text" 
            value={newPlayer.name}
            onChange={e => setNewPlayer({...newPlayer, name: e.target.value})}
            className="bg-slate-900 border border-slate-600 text-slate-200 px-3 py-2 rounded focus:outline-none focus:border-cyan-500 text-sm"
            placeholder="es. Re_Artù"
          />
        </div>
        <div className="flex flex-col gap-1 w-16">
          <label className="text-[10px] text-slate-400 uppercase font-bold">Ruolo</label>
          <select 
            value={newPlayer.role}
            onChange={e => setNewPlayer({...newPlayer, role: e.target.value})}
            className="bg-slate-900 border border-slate-600 text-slate-200 px-2 py-2 rounded focus:outline-none focus:border-cyan-500 cursor-pointer text-sm"
          >
            {roleOptions.map(opt => (
              <option key={`new-role-${opt}`} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1 w-20">
          <label className="text-[10px] text-slate-400 uppercase font-bold">Livello</label>
          <select 
            value={newPlayer.level}
            onChange={e => setNewPlayer({...newPlayer, level: e.target.value})}
            className="bg-slate-900 border border-slate-600 text-slate-200 px-2 py-2 rounded focus:outline-none focus:border-cyan-500 cursor-pointer text-sm"
          >
            {levelOptions.map(opt => (
              <option key={`new-${opt}`} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1 w-24">
          <label className="text-[10px] text-slate-400 uppercase font-bold">Potere (M)</label>
          <input 
            type="number" 
            min="0"
            value={newPlayer.power}
            onChange={e => {
              const newPower = e.target.value;
              setNewPlayer({
                ...newPlayer, 
                power: newPower,
                marches: getDefaultMarches(newPower) // Calcolo automatico
              });
            }}
            className="bg-slate-900 border border-slate-600 text-slate-200 px-2 py-2 rounded focus:outline-none focus:border-cyan-500 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1 w-16">
          <label className="text-[10px] text-slate-400 uppercase font-bold">Marce</label>
          <input 
            type="number" 
            min="1"
            value={newPlayer.marches}
            onChange={e => setNewPlayer({...newPlayer, marches: e.target.value})}
            className="bg-slate-900 border border-slate-600 text-slate-200 px-2 py-2 rounded focus:outline-none focus:border-cyan-500 text-sm text-center"
          />
        </div>
        <button 
          type="submit"
          className="bg-cyan-700 hover:bg-cyan-600 text-white px-4 py-2 rounded font-semibold transition-colors h-[38px] text-sm"
        >
          + Aggiungi
        </button>
      </form>

      {/* TABELLA ROSTER ESISTENTE */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        <table className="w-full text-left border-collapse table-fixed">
          <thead>
            <tr className="bg-slate-900/50 border-b border-slate-700">
              <th className="px-2 py-3 text-slate-400 font-semibold text-xs w-14 text-center">Sigla</th>
              <th className="px-2 py-3 text-slate-400 font-semibold text-xs w-auto">Nome</th>
              <th className="px-2 py-3 text-slate-400 font-semibold text-xs w-16 text-center">Ruolo</th>
              <th className="px-2 py-3 text-slate-400 font-semibold text-xs w-20">Livello</th>
              <th className="px-2 py-3 text-slate-400 font-semibold text-xs w-20">Potere</th>
              <th className="px-2 py-3 text-slate-400 font-semibold text-xs w-16 text-center">Marce</th>
              <th className="px-2 py-3 text-slate-400 font-semibold text-xs w-20 text-center">In Uso</th>
              <th className="px-1 py-3 text-slate-400 font-semibold text-xs w-10 text-center"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50 text-sm">
            {roster.length === 0 ? (
              <tr>
                <td colSpan="8" className="p-6 text-center text-slate-500 italic">
                  Nessun giocatore nel database. Aggiungine uno usando il modulo qui sopra.
                </td>
              </tr>
            ) : (
              roster.map((player) => (
                <tr key={player.id} className="hover:bg-slate-700/20 transition-colors">
                  <td className="px-2 py-2">
                    <input 
                      type="text" 
                      value={player.tag || ''}
                      onChange={(e) => onEdit(player.id, 'tag', e.target.value.toUpperCase())}
                      maxLength="4"
                      className="bg-slate-800 text-cyan-400 w-full outline-none focus:border-b focus:border-cyan-500 font-bold text-center rounded px-1 py-1"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input 
                      type="text" 
                      value={player.name}
                      onChange={(e) => onEdit(player.id, 'name', e.target.value)}
                      className="bg-transparent text-slate-200 w-full outline-none focus:border-b focus:border-cyan-500 px-1 py-1"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <select 
                      value={player.role || 'R1'}
                      onChange={(e) => onEdit(player.id, 'role', e.target.value)}
                      className="bg-slate-900 border border-transparent hover:border-slate-600 rounded text-slate-200 w-full outline-none focus:border-cyan-500 px-1 py-1 cursor-pointer text-center"
                    >
                      {roleOptions.map(opt => (
                        <option key={`edit-role-${player.id}-${opt}`} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <select 
                      value={player.level}
                      onChange={(e) => onEdit(player.id, 'level', e.target.value)}
                      className="bg-slate-900 border border-transparent hover:border-slate-600 rounded text-slate-200 w-full outline-none focus:border-cyan-500 px-1 py-1 cursor-pointer"
                    >
                      {levelOptions.map(opt => (
                        <option key={`edit-${player.id}-${opt}`} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <input 
                      type="number" 
                      value={player.power}
                      onChange={(e) => {
                        const newPower = e.target.value;
                        onEdit(player.id, 'power', newPower);
                        // Ricalcola marce in automatico anche nell'edit
                        onEdit(player.id, 'marches', getDefaultMarches(newPower));
                      }}
                      className="bg-transparent text-slate-300 w-full outline-none focus:border-b focus:border-cyan-500 px-1 py-1"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input 
                      type="number" 
                      value={player.marches}
                      onChange={(e) => onEdit(player.id, 'marches', e.target.value)}
                      className="bg-transparent text-slate-300 w-full outline-none focus:border-b focus:border-cyan-500 text-center px-1 py-1"
                    />
                  </td>
                  <td className="px-2 py-2 flex justify-center">
                    {/* MENU TENDINA SOSTITUITO CON IL PULSANTE */}
                    <button
                      onClick={() => onEdit(player.id, 'isParticipating', !player.isParticipating)}
                      className={`px-3 py-1 rounded font-bold w-12 text-center text-white transition-colors ${
                        player.isParticipating ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500'
                      }`}
                    >
                      {player.isParticipating ? 'Sì' : 'No'}
                    </button>
                  </td>
                  <td className="px-1 py-2 text-center">
                    <button 
                      onClick={() => onDelete(player.id)}
                      className="text-slate-500 hover:text-red-400 font-bold px-2 py-1 transition-colors"
                      title="Rimuovi giocatore"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}