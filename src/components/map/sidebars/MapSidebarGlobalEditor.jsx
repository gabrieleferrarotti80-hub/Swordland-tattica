import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ResourceZonesEditor from './ResourceZonesEditor';

const CoordInput = ({ initialValue, onSave, placeholder, className }) => {
  const inputRef = useRef(null);
  useEffect(() => {
    if (inputRef.current && document.activeElement !== inputRef.current) {
      inputRef.current.value = initialValue !== undefined && initialValue !== null ? initialValue : '';
    }
  }, [initialValue]);
  const handleBlur = () => {
    if (!inputRef.current) return;
    const val = inputRef.current.value;
    const numericVal = val === '' ? '' : (isNaN(Number(val)) ? 0 : Number(val));
    if (numericVal !== initialValue) onSave(numericVal);
  };
  const handleKeyDown = (e) => { if (e.key === 'Enter') e.target.blur(); };
  return (
    <input ref={inputRef} type="number" placeholder={placeholder} defaultValue={initialValue ?? ''} onBlur={handleBlur} onKeyDown={handleKeyDown} className={className} />
  );
};

export default function MapSidebarGlobalEditor({
  setIsGlobalEditorMode,
  globalEditorTool, setGlobalEditorTool,
  fixedBuildings, handleBuildingChange, handleAddBuilding, handleDeleteBuilding,
  handleSaveToCloud, isLoadingCloud,
  globalResourceZones = [],
  setGlobalResourceZones,
  activeZoneId,
  setActiveZoneId
}) {
  const navigate = useNavigate();
  const [searchBuilding, setSearchBuilding] = useState('');

  const filteredBuildings = (fixedBuildings || []).filter(b => 
    (b.name || '').toLowerCase().includes(searchBuilding.toLowerCase()) || 
    (b.type || '').toLowerCase().includes(searchBuilding.toLowerCase())
  );

  const handleTypeChange = (id, newType) => {
    handleBuildingChange(id, 'type', newType);
    
    // Assegnazione automatica delle misure fisiche
    let standardSize = 2;
    if (newType === 'castle') standardSize = 2; // Castello Giocatore
    else if (['headquarters', 'beartrap'].includes(newType)) standardSize = 3; // Strutture Alleanza
    else if (newType === 'marker') standardSize = 1; // Segnalino fisico
    else if (['sanctuary', 'fortress', 'pass'].includes(newType)) standardSize = 5; // Obiettivi Speciali
    
    handleBuildingChange(id, 'size', standardSize);
  };

  const handleApplyToAllSimilar = (referenceBuilding) => {
    const targetName = (referenceBuilding.name || '').trim();
    if (!targetName) return alert("Dai prima un nome a questo edificio.");

    const similarBuildings = (fixedBuildings || []).filter(
      b => (b.name || '').trim() === targetName && b.id !== referenceBuilding.id
    );
    
    if (similarBuildings.length === 0) {
       return alert(`Nessun altro edificio trovato con il nome esatto "${targetName}".`);
    }

    if (window.confirm(`Vuoi sovrascrivere Buff e Premi su altri ${similarBuildings.length} edifici chiamati "${targetName}"?`)) {
       setTimeout(() => {
         similarBuildings.forEach(b => {
            handleBuildingChange(b.id, 'buffs', referenceBuilding.buffs || { type: '', value: '' });
            handleBuildingChange(b.id, 'rewards', referenceBuilding.rewards || { type: '', value: '' });
         });
       }, 50);
    }
  };

  return (
    <aside className="w-[340px] bg-slate-900 border-r border-slate-800 flex flex-col p-5 gap-4 z-20 shadow-2xl shrink-0 overflow-hidden select-none">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
        <h2 className="text-lg font-black tracking-wider text-rose-400">Editor Globale</h2>
        <div className="flex gap-2">
          <button onClick={() => setIsGlobalEditorMode(false)} className="px-3 py-1.5 bg-rose-900/50 hover:bg-rose-800 text-rose-200 text-xs font-bold rounded-lg border border-rose-700 transition-colors">
            Esci
          </button>
          <button onClick={() => navigate('/')} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg border border-slate-700">🏠</button>
        </div>
      </div>

      <div className="shrink-0">
        <button 
          onClick={() => handleSaveToCloud()} 
          disabled={isLoadingCloud}
          className={`w-full py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-lg ${isLoadingCloud ? 'bg-slate-700 text-slate-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/50'}`}
        >
          {isLoadingCloud ? '⏳ Salvataggio...' : '☁️ Salva Modifiche Cloud'}
        </button>
      </div>

      <div className="flex flex-col gap-2 shrink-0">
        <button 
          onClick={() => setGlobalEditorTool('resources')}
          className={`w-full py-2.5 text-[10px] font-black uppercase tracking-wider rounded border transition-colors ${globalEditorTool === 'resources' ? 'bg-rose-600 border-rose-500 text-white shadow-[0_0_10px_rgba(225,29,72,0.4)]' : 'bg-slate-950 border-slate-700 text-slate-400 hover:border-rose-500 hover:text-rose-300'}`}
        >
          📐 Disegna Zone Risorse
        </button>
        <button 
          onClick={() => setGlobalEditorTool('buildings')}
          className={`w-full py-2.5 text-[10px] font-black uppercase tracking-wider rounded border transition-colors ${globalEditorTool === 'buildings' ? 'bg-rose-600 border-rose-500 text-white shadow-[0_0_10px_rgba(225,29,72,0.4)]' : 'bg-slate-950 border-slate-700 text-slate-400 hover:border-rose-500 hover:text-rose-300'}`}
        >
          🏛️ Assegna / Muovi Edifici
        </button>
      </div>

      {globalEditorTool === 'resources' && (
        <ResourceZonesEditor 
          globalResourceZones={globalResourceZones}
          setGlobalResourceZones={setGlobalResourceZones}
          activeZoneId={activeZoneId}
          setActiveZoneId={setActiveZoneId}
        />
      )}

      {globalEditorTool === 'buildings' && (
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 flex flex-col gap-2 mt-2 pt-4 border-t border-slate-800">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Database Edifici</span>
            <button onClick={() => handleAddBuilding({ id: `b-${Date.now()}`, name: "Nuovo Edificio", type: "sanctuary", level: 1, size: 5, x: 600, y: 600, buffs: { type: '', value: '' }, rewards: { type: '', value: '' } })} className="bg-emerald-900/50 hover:bg-emerald-800 text-emerald-300 px-2 py-1 rounded text-[9px] font-bold uppercase transition-colors">+ Aggiungi</button>
          </div>
          <input type="text" placeholder="Cerca edificio..." value={searchBuilding} onChange={(e) => setSearchBuilding(e.target.value)} className="w-full bg-slate-950 border border-slate-700 text-white text-xs px-3 py-2 rounded focus:outline-none focus:border-rose-500 mb-2" />
          
          {filteredBuildings.map(b => {
            const bType = typeof b.type === 'string' && b.type.trim() !== '' ? b.type.toLowerCase() : 'turret';
            const bName = typeof b.name === 'string' ? b.name.toLowerCase() : '';
            
            const isSpecialBuilding = bType === 'sanctuary' || bType === 'fortress' || bName.includes('santuario') || bName.includes('fortezza');
            const isMarker = bType === 'marker';
            
            const bBuffType = b.buffs && typeof b.buffs.type === 'string' ? b.buffs.type : '';
            const bBuffValue = b.buffs && b.buffs.value !== undefined && b.buffs.value !== null ? Number(b.buffs.value) : '';
            
            const bRewardType = b.rewards && typeof b.rewards.type === 'string' ? b.rewards.type : '';
            const bRewardValue = b.rewards && b.rewards.value !== undefined && b.rewards.value !== null ? Number(b.rewards.value) : '';

            return (
              <div key={b.id} draggable onDragStart={(e) => { e.dataTransfer.setData('text/plain', `building:${b.id}`); }} className={`bg-slate-950/80 border ${isMarker ? 'border-emerald-500/50' : 'border-slate-800'} p-2.5 rounded-xl flex flex-col gap-2 hover:border-rose-500/50 cursor-grab active:cursor-grabbing transition-colors`}>
                <div className="flex items-center justify-between gap-2">
                  <input type="text" defaultValue={b.name} onBlur={(e) => handleBuildingChange(b.id, 'name', e.target.value)} className="bg-transparent text-xs font-bold text-slate-200 outline-none flex-1 min-w-0 truncate" />
                  <button onClick={() => handleDeleteBuilding(b.id)} className="text-rose-500 hover:text-rose-400 text-xs font-bold shrink-0">✕</button>
                </div>
                
                <div className="flex gap-2">
                  <select value={bType} onChange={(e) => handleTypeChange(b.id, e.target.value)} className={`bg-slate-900 text-[10px] ${isMarker ? 'text-emerald-400 font-bold' : 'text-slate-400'} border border-slate-700 rounded p-1 flex-1 outline-none`}>
                    <option value="castle">Castello Giocatore (2x2)</option>
                    <option value="headquarters">Quartier Generale (3x3)</option>
                    <option value="beartrap">Trappola per Orsi (3x3)</option>
                    <option value="sanctuary">Santuario (5x5)</option>
                    <option value="fortress">Fortezza (5x5)</option>
                    <option value="pass">Passaggio (5x5)</option>
                    <option value="turret">Torretta (2x2)</option>
                    <option value="harvest alter">Altare Raccolta (2x2)</option>
                    <option value="builders guild">Gilda Costruttori (2x2)</option>
                    <option value="forager grove">Boschetto (2x2)</option>
                    <option value="scholars tower">Torre Studiosi (2x2)</option>
                    <option value="armory">Armeria (2x2)</option>
                    <option value="arsenal">Arsenale (2x2)</option>
                    <option value="drill camp">Campo Addestramento (2x2)</option>
                    <option value="frontier lodge">Loggia Frontiera (2x2)</option>
                    <option value="marker">📌 Segnalino Fisico (1x1)</option>
                  </select>
                  
                  <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded p-1 w-16" title="Livello Edificio (Es. 1, 2, 3)">
                     <span className="text-[9px] text-indigo-400 font-black pl-1">LV</span>
                     <CoordInput initialValue={b.level || 1} onSave={(val) => handleBuildingChange(b.id, 'level', val)} placeholder="1" className="w-full bg-transparent text-center text-[10px] text-indigo-300 font-mono outline-none" />
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <div className={`flex flex-1 items-center gap-1 bg-slate-900 border ${isMarker ? 'border-emerald-500/50' : 'border-slate-700'} rounded p-1`} title="Ingombro Fisico">
                     <span className="text-[9px] text-purple-400 font-black pl-1">Size</span>
                     <CoordInput initialValue={b.size} onSave={(val) => handleBuildingChange(b.id, 'size', val)} placeholder="Auto" className="w-full bg-transparent text-center text-[10px] text-purple-300 font-mono outline-none" />
                  </div>
                  <div className="flex flex-1 items-center gap-1 bg-slate-900 border border-slate-700 rounded p-1">
                     <span className="text-[9px] text-cyan-500 font-black pl-1">X</span>
                     <CoordInput initialValue={b.x} onSave={(val) => handleBuildingChange(b.id, 'x', val)} placeholder="-" className="w-full bg-transparent text-center text-[10px] text-cyan-300 font-mono outline-none" />
                  </div>
                  <div className="flex flex-1 items-center gap-1 bg-slate-900 border border-slate-700 rounded p-1">
                     <span className="text-[9px] text-amber-500 font-black pl-1">Y</span>
                     <CoordInput initialValue={b.y} onSave={(val) => handleBuildingChange(b.id, 'y', val)} placeholder="-" className="w-full bg-transparent text-center text-[10px] text-amber-300 font-mono outline-none" />
                  </div>
                </div>

                {isMarker && (
                  <div className="text-[8px] font-black text-emerald-300 bg-emerald-950/60 border border-emerald-900/50 rounded py-0.5 text-center uppercase tracking-widest mt-1">
                    📐 Ingombro fisico del Segnalino (Default: 1)
                  </div>
                )}

                {!isMarker && (
                  <>
                    {isSpecialBuilding && (
                      <div className="text-[8px] font-black text-rose-300 bg-rose-950/60 border border-rose-900/50 rounded py-0.5 text-center uppercase tracking-widest mt-1">
                        🚀 Obiettivo Speciale (Ignora Percorsi Alleanza)
                      </div>
                    )}

                    <div className="flex flex-col gap-1.5 pt-1 border-t border-slate-800/80 mt-1">
                      <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded px-1.5 py-1">
                        <span className="text-[9px] text-amber-400 font-black shrink-0 w-10">⚡ Buff</span>
                        <select 
                          value={bBuffType} 
                          onChange={(e) => handleBuildingChange(b.id, 'buffs', { type: e.target.value, value: bBuffValue })}
                          className="bg-slate-950 text-[9px] text-slate-300 border border-slate-700 rounded p-1 outline-none flex-1"
                        >
                          <option value="">Nessuno</option>
                          <option value="Velocità di costruzione %">Velocità di costruzione %</option>
                          <option value="Difesa %">Difesa %</option>
                          <option value="Velocità di ricerca %">Velocità di ricerca %</option>
                          <option value="Produzione di risorse %">Produzione di risorse %</option>
                          <option value="Velocità di marcia %">Velocità di marcia %</option>
                          <option value="Velocità raccolta risorse %">Velocità raccolta risorse %</option>
                          <option value="Attacco %">Attacco %</option>
                          <option value="Velocità di addestramento %">Velocità di addestramento %</option>
                        </select>
                        <input 
                          type="number" 
                          placeholder="Val"
                          defaultValue={bBuffValue} 
                          onBlur={(e) => {
                            const num = Number(e.target.value);
                            handleBuildingChange(b.id, 'buffs', { type: bBuffType, value: e.target.value === '' ? '' : (isNaN(num) ? 0 : num) });
                          }}
                          className="w-12 bg-slate-950 border border-slate-700 rounded text-[10px] text-slate-200 p-1 outline-none text-center" 
                        />
                      </div>
                      <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded px-1.5 py-1">
                        <span className="text-[9px] text-emerald-400 font-black shrink-0 w-10">🎁 Premi</span>
                        <select 
                          value={bRewardType} 
                          onChange={(e) => handleBuildingChange(b.id, 'rewards', { type: e.target.value, value: bRewardValue })}
                          className="bg-slate-950 text-[9px] text-slate-300 border border-slate-700 rounded p-1 outline-none flex-1"
                        >
                          <option value="">Nessuno</option>
                          {isSpecialBuilding ? (
                            <>
                              <option value="hero_fragments">Frammenti Eroe</option>
                              <option value="teleports">Teletrasporti</option>
                              <option value="mythic_expedition">Istruzioni Spedizioni Mitiche</option>
                              <option value="skill_books">Libri Abilità</option>
                              <option value="speedups">Acceleratori</option>
                              <option value="equip_xp">XP Miglioramento Equip.</option>
                              <option value="hero_xp">XP Eroe</option>
                            </>
                          ) : (
                            <>
                              <option value="gems">Gemme / Ora</option>
                              <option value="alliance_pts">Punti Alleanza / Ora</option>
                              <option value="resources">Risorse / Ora</option>
                            </>
                          )}
                        </select>
                        <input 
                          type="number" 
                          placeholder="Val"
                          defaultValue={bRewardValue} 
                          onBlur={(e) => {
                            const num = Number(e.target.value);
                            handleBuildingChange(b.id, 'rewards', { type: bRewardType, value: e.target.value === '' ? '' : (isNaN(num) ? 0 : num) });
                          }}
                          className="w-12 bg-slate-950 border border-slate-700 rounded text-[10px] text-slate-200 p-1 outline-none text-center" 
                        />
                      </div>
                    </div>

                    <div className="flex justify-end mt-1">
                      <button 
                        onClick={() => handleApplyToAllSimilar(b)}
                        className="text-[8px] font-black bg-cyan-900/30 hover:bg-cyan-800 text-cyan-300 border border-cyan-700/50 px-2 py-1.5 rounded transition-colors uppercase tracking-widest flex items-center gap-1"
                      >
                        🔄 Copia su tutti i "{b.name}"
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}