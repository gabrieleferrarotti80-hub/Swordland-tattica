import React from 'react';

export const MarchesPanel = ({
  newMarch,
  setNewMarch,
  activeDeployment,
  getAvailableMarches,
  healingEvents,
  currentTime,
  handleCreateMarch,
  marches,
  getCurrentPosition,
  draftPositions,
  handleDeleteMarch,
  handleRemoveFromMarch,
  handleWithdraw
}) => {
  return (
    <div className="p-4 flex flex-col h-full">
      <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700 mb-4 shadow-inner shrink-0">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-cyan-400 text-xs uppercase tracking-wider font-bold">Nuova Marcia</h3>
          <span className="text-[10px] bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700 text-slate-400">Max 10 Giocatori</span>
        </div>
        <select value={newMarch.leader} onChange={(e) => setNewMarch({ leader: e.target.value, members: [] })} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-2 text-xs text-white mb-3 outline-none focus:border-purple-500">
          <option value="">Seleziona Leader...</option>
          {activeDeployment.map(p => {
            const avail = getAvailableMarches(p.id);
            const healStart = healingEvents[p.id];
            const isHealing = healStart !== undefined && currentTime >= healStart && currentTime < healStart + 12;
            return <option key={p.id} value={p.id} disabled={avail <= 0 || isHealing}>{p.name} ({p.tag}) - {isHealing ? 'IN CURA' : `Disp: ${avail}/${p.marches}`}</option>;
          })}
        </select>
        
        {newMarch.leader && (
          <div className="mb-4">
            <div className="flex justify-between items-end mb-2">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Seleziona Gregari</span>
              <span className={`text-[10px] font-bold ${newMarch.members.length >= 9 ? 'text-red-400' : 'text-cyan-400'}`}>{newMarch.members.length + 1}/10 Posti</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto p-1 scrollbar-thin">
              {activeDeployment.filter(p => p.id !== newMarch.leader).map(p => {
                const isSelected = newMarch.members.includes(p.id);
                const avail = getAvailableMarches(p.id);
                const healStart = healingEvents[p.id];
                const isHealing = healStart !== undefined && currentTime >= healStart && currentTime < healStart + 12;
                const canSelect = avail > 0 && newMarch.members.length < 9 && !isHealing;
                const isDisabled = !isSelected && !canSelect;
                
                return (
                  <button key={p.id} disabled={isDisabled} onClick={() => setNewMarch(prev => ({ ...prev, members: isSelected ? prev.members.filter(id => id !== p.id) : [...prev.members, p.id] }))} title={p.name} className={`px-2 py-1.5 rounded border transition-colors flex justify-between items-center ${isSelected ? 'bg-purple-700 border-purple-500 text-white shadow-[0_0_10px_rgba(168,85,247,0.4)]' : isDisabled ? 'bg-slate-800/50 border-slate-700/50 text-slate-600 cursor-not-allowed' : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-500'}`}>
                    <span className="text-[10px] font-bold truncate max-w-[65px] text-left">{p.tag}</span>
                    <span className={`px-1 py-0.5 rounded text-[8px] font-bold leading-none ${isSelected ? 'bg-purple-900/50 text-purple-200' : isDisabled ? 'bg-slate-900/50 text-slate-600' : 'bg-slate-900/50 text-slate-400'}`}>{isHealing ? 'CURA' : `${isSelected ? avail - 1 : avail}/${p.marches}`}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <button onClick={handleCreateMarch} disabled={!newMarch.leader} className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold py-2 rounded transition-colors shadow-lg">+ Aggiungi Marcia</button>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col gap-2">
        {marches.map(m => {
          const leader = activeDeployment.find(p => p.id === m.leader);
          if (!leader) return null;
          
          const currentPos = getCurrentPosition(m);
          const isMarching = currentPos && currentPos.isMarching && currentTime < currentPos.arrivalTime;
          
          return (
            <div
              key={m.id}
              draggable={!isMarching}
              onDragStart={(e) => { if(!isMarching) e.dataTransfer.setData('text/plain', `march:${m.id}`) }}
              className={`bg-slate-800/70 border p-2.5 rounded-lg flex flex-col hover:bg-slate-700/50 transition-colors relative group ${!isMarching && 'cursor-grab active:cursor-grabbing'} ${draftPositions[m.id] ? 'border-amber-500/50 bg-amber-900/20' : 'border-purple-500/40 shadow-[0_0_10px_rgba(168,85,247,0.1)]'}`}
            >
              <button onClick={() => handleDeleteMarch(m.id)} className="absolute top-1 right-1 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
              
              <div className="flex items-center justify-between mb-1.5 pr-3">
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="text-white font-bold text-[10px] px-1.5 py-0.5 rounded shadow shrink-0 flex items-center gap-1.5 bg-purple-700">
                    🏁 {leader.tag}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRemoveFromMarch(m.id, leader.id); }}
                      className="text-red-300 hover:text-white hover:bg-red-500 rounded-full w-3 h-3 flex items-center justify-center leading-none transition-colors"
                    >✕</button>
                  </span>
                  <span className="font-bold text-sm truncate text-purple-200">Marcia {leader.name}</span>
                </div>
                
                <div className="flex items-center gap-2 shrink-0">
                  {isMarching ? (
                    <span className="text-[9px] bg-blue-900/80 text-blue-300 px-1.5 py-0.5 rounded border border-blue-500/50 font-bold tracking-wide">
                      🚶 Arrivo min {currentPos.arrivalTime}
                    </span>
                  ) : (currentPos && !currentPos.removed) && (
                    <button onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); handleWithdraw(m.id); }} className="text-[9px] bg-red-900/80 hover:bg-red-700 text-white px-1.5 py-0.5 rounded border border-red-500/50 transition-colors" title="Ritira in Base">
                      Ritira
                    </button>
                  )}
                  <span className="text-[10px] font-bold bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700 text-slate-300">
                    {m.members.length + 1}/10
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-1 mt-2">
                {m.members.map(memId => {
                  const member = activeDeployment.find(p => p.id === memId);
                  return member ? (
                    <span key={memId} className="text-[9px] border px-1 py-0.5 rounded flex items-center gap-1 bg-slate-900 border-slate-700 text-slate-400">
                      {member.tag}
                      <button onClick={(e) => { e.stopPropagation(); handleRemoveFromMarch(m.id, memId); }} className="text-slate-500 hover:text-red-400 hover:scale-110 transition-all leading-none">✕</button>
                    </span>
                  ) : null;
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );
};