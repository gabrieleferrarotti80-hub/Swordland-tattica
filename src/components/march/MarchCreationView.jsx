import React, { useState } from 'react';
import { eventTypes } from '../../data/heroes';
import AllianceDoctrine from './AllianceDoctrine';
import MarchCard from './MarchCard';

const statLabels = {
  atk: 'Attacco', def: 'Difesa', hp: 'Salute',
  march_capacity: 'Cap. Marcia', rally_capacity: 'Cap. Rally', lethality: 'Letalità',
  enemy_hp_red: 'Salute Nem.', march_speed: 'Velocità', enemy_lethality_red: 'Letalità Nem.'
};
const isStatFlat = (statId) => ['march_capacity', 'rally_capacity'].includes(statId);

export default function MarchCreationView({
  t, isOfficer, selectedEvent, setSelectedEvent,
  allianceRecommendations, isEditingRec, recForm,
  handleEditRecommendationClick, setIsEditingRec, handleSaveRecommendation,
  updateRecForm, handleApplyRecommendation,
  marches, playerMaxMarches, processedMarches,
  handleDeleteMarch, setMarches, handleUpdateTroopConfig, handleApplyPreset,
  getAvailableHeroes, getHeroColor, savedPresets, handleSavePreset,
  handleLoadPreset, handleDeletePreset, buffsCatalog, playerBuffs,
  activeAnimals, setActiveAnimals, handleIndexBuild
}) {
  const [showDoctrine, setShowDoctrine] = useState(false);
  const [presetName, setPresetName] = useState('');

  const handleAddMarch = () => {
    if (marches.length >= playerMaxMarches) return alert(t('march_creation.alert_max_marches', 'Limite massimo di marce raggiunto!'));
    setMarches(prev => [...prev, {
      id: Date.now(), marchType: 'solo', customCapacity: 0,
      hero1: '', hero2: '', hero3: '',
      troopConfig: { mode: 'percent', manual: { inf: 0, cav: 0, arc: 0 }, percent: { inf: 0, cav: 0, arc: 0 } }
    }]);
  };

  const availableAnimals = Object.values(buffsCatalog || {}).filter(b => b.sourceCategory === 'animal');

  const handleAnimalToggle = (animalId) => {
    setActiveAnimals(prev => 
      prev.includes(animalId) ? prev.filter(id => id !== animalId) : [...prev, animalId]
    );
  };

  const getAnimalBonusString = (b) => {
    if (!b.values) return '';
    const targets = b.statTargets || (b.statTarget ? [b.statTarget] : ['atk']);
    
    let lvlIndex = Array.isArray(b.values) ? b.values.length - 1 : ((b.values && Object.values(b.values)[0]?.length) ? Object.values(b.values)[0].length - 1 : 0);
    if (lvlIndex < 0) lvlIndex = 0;
    
    let bonusStrings = [];
    targets.forEach(st => {
       const isOldFormat = Array.isArray(b.values);
       const val = isOldFormat ? b.values[lvlIndex] : (b.values && b.values[st] ? b.values[st][lvlIndex] : 0);
       const isDebuff = st.includes('enemy_') || st.includes('_red');
       const sign = isDebuff ? '-' : '+';
       
       if (val > 0) bonusStrings.push(`${sign}${val}${isStatFlat(st) ? '' : '%'} ${statLabels[st] || st}`);
    });
    return bonusStrings.length > 0 ? `(${bonusStrings.join(', ')})` : '';
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
       
       <div className="bg-slate-900 border border-slate-700 p-4 rounded-2xl flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 shadow-lg">
          <div className="flex flex-col w-full xl:w-auto">
             <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">{t('march_creation.select_event', 'Evento Tattico')}</label>
             <select 
               value={selectedEvent} 
               onChange={e => setSelectedEvent(e.target.value)} 
               className="bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-bold outline-none focus:border-cyan-500 transition-colors w-full xl:w-64"
             >
                {eventTypes.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
             </select>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
             {(isOfficer || allianceRecommendations[selectedEvent]) && (
                 <button 
                   onClick={() => setShowDoctrine(!showDoctrine)}
                   className={`w-full sm:w-auto px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all border ${showDoctrine ? 'bg-indigo-600 text-white border-indigo-500 shadow-[0_0_15px_rgba(79,70,229,0.4)]' : 'bg-slate-800 text-indigo-400 border-indigo-900/50 hover:bg-indigo-900/50'}`}
                 >
                   {showDoctrine ? t('march_creation.hide_doctrine', 'Nascondi Dottrina') : t('march_creation.show_doctrine', '📜 Dottrina Alleanza')}
                 </button>
             )}

             <div className="flex items-center gap-2 w-full sm:w-auto bg-slate-950 p-1.5 rounded-xl border border-slate-800">
               <input 
                 type="text" 
                 placeholder={t('march_creation.preset_name_ph', 'Nome Preset...')} 
                 value={presetName}
                 onChange={(e) => setPresetName(e.target.value)}
                 className="bg-transparent border-none text-white text-xs px-2 py-1 outline-none w-full sm:w-32 placeholder-slate-600"
               />
               <button 
                 onClick={async () => { 
                   const success = await handleSavePreset(presetName); 
                   if(success) setPresetName(''); 
                 }} 
                 className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-black uppercase shadow-md transition-colors"
               >
                 {t('march_creation.btn_save_preset', 'Salva')}
               </button>
             </div>

             <button 
               onClick={() => handleIndexBuild()}
               className="w-full sm:w-auto px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(225,29,72,0.4)] border border-rose-500"
             >
               {t('march_creation.btn_index', '📸 Indicizza Formazione')}
             </button>
          </div>
       </div>

       {showDoctrine && (
         <AllianceDoctrine 
            isOfficer={isOfficer} selectedEvent={selectedEvent} recommendations={allianceRecommendations}
            isEditingRec={isEditingRec} recForm={recForm} onEditClick={handleEditRecommendationClick}
            onCancelEdit={() => setIsEditingRec(false)} onSave={handleSaveRecommendation}
            onUpdateForm={updateRecForm} onApply={handleApplyRecommendation}
            marches={marches} playerMaxMarches={playerMaxMarches} t={t}
         />
       )}

       {availableAnimals.length > 0 && (
          <div className="bg-slate-900 border border-slate-700 p-4 rounded-2xl flex flex-col gap-3">
             <h3 className="text-xs font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2"><span>🐾</span> {t('march_creation.active_animals', 'Behemoth & Animali (Attivi in questa formazione)')}</h3>
             <div className="flex flex-wrap gap-2">
                {availableAnimals.map(animal => {
                   const isActive = activeAnimals.includes(animal.id);
                   return (
                     <button 
                        key={animal.id} onClick={() => handleAnimalToggle(animal.id)}
                        className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase transition-all flex items-center gap-1.5 ${isActive ? 'bg-emerald-900/40 text-emerald-300 border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'bg-slate-950 text-slate-500 border-slate-800 hover:border-emerald-500/30 hover:text-emerald-400'}`}
                     >
                        <span className={isActive ? 'opacity-100' : 'opacity-50 grayscale'}>🐾</span> 
                        <span className="flex items-center gap-1.5">
                           <span>{animal.name}</span>
                           {getAnimalBonusString(animal) && (
                              <span className={`text-[9px] ${isActive ? 'text-emerald-400/80' : 'text-slate-600'}`}>{getAnimalBonusString(animal)}</span>
                           )}
                        </span>
                     </button>
                   );
                })}
             </div>
          </div>
       )}

       {Object.keys(savedPresets || {}).length > 0 && (
         <div className="flex gap-2 flex-wrap items-center bg-slate-900/50 p-3 rounded-xl border border-slate-800">
           <span className="text-[10px] font-bold text-slate-500 uppercase">{t('march_creation.load_preset', 'Carica Preset:')}</span>
           {Object.keys(savedPresets).map(pName => (
             <div key={pName} className="flex items-center bg-slate-800 rounded-lg overflow-hidden border border-slate-700">
               <button 
                 onClick={() => { handleLoadPreset(pName); setPresetName(pName); }} 
                 className="px-3 py-1.5 text-[10px] font-bold text-cyan-400 hover:bg-slate-700 transition-colors"
               >
                 {pName}
               </button>
               <button onClick={() => handleDeletePreset(pName)} className="px-2 py-1.5 bg-rose-950/40 hover:bg-rose-600 text-rose-500 hover:text-white text-[10px] transition-colors border-l border-slate-700">✕</button>
             </div>
           ))}
         </div>
       )}

       <div className="flex flex-col gap-6">
          {processedMarches.map((march, index) => (
            <MarchCard 
              key={march.id} t={t}
              march={march} index={index} totalMarchesCount={marches.length} onDelete={handleDeleteMarch}
              onUpdateHero={(marchId, field, value) => { setMarches(prev => prev.map(m => m.id === marchId ? { ...m, [field]: value } : m)); }}
              onUpdateTroopConfig={handleUpdateTroopConfig} onApplyPreset={handleApplyPreset}
              getAvailableHeroes={getAvailableHeroes} getHeroColor={getHeroColor}
              selectedEvent={selectedEvent} buffsCatalog={buffsCatalog} playerBuffs={playerBuffs} activeAnimals={activeAnimals}
            />
          ))}
       </div>

       {marches.length < playerMaxMarches && (
         <button 
           onClick={handleAddMarch}
           className="w-full py-4 border-2 border-dashed border-slate-700 hover:border-cyan-500/50 rounded-3xl text-slate-500 hover:text-cyan-400 font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2 bg-slate-900/30 hover:bg-cyan-950/20"
         >
           <span className="text-xl">+</span> {t('march_builder.add_march', 'Aggiungi nuova marcia')}
         </button>
       )}
    </div>
  );
}