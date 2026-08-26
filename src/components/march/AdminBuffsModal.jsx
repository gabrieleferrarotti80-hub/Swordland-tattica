import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { eventTypes } from '../../data/heroes';

const DEFAULT_MASTERS = ['Maestro d’Armi', 'Maestro della Strategia', 'Maestro di Gilda'];
const DEFAULT_ANIMALS = ['Orso Polare', 'Lupo Alpha', 'Leopardo delle Nevi'];

const isStatFlat = (statId) => ['march_capacity', 'rally_capacity'].includes(statId);
const getStatSuffix = (statId) => isStatFlat(statId) ? '' : '%';

export default function AdminBuffsModal({ isOpen, onClose, t, buffsCatalog, setBuffsCatalog }) {
  const [activeTab, setActiveTab] = useState('catalog');
  
  const [newBuff, setNewBuff] = useState({
    name: '', description: '', isFixedForEvent: false, statTargets: ['atk'],
    targetEvents: ['all'], sourceCategory: 'global', sourceDetail: '', 
    values: { atk: [1, 1.5, 2] } 
  });

  const [mastersList, setMastersList] = useState(DEFAULT_MASTERS);
  const [animalsList, setAnimalsList] = useState(DEFAULT_ANIMALS);
  const [newSourceInput, setNewSourceInput] = useState('');
  const [editingBuffId, setEditingBuffId] = useState(null);
  const [autoConfig, setAutoConfig] = useState({});

  useEffect(() => {
    if (isOpen) {
      const fetchGlobalSources = async () => {
        try {
          const docSnap = await getDoc(doc(db, "systemSettings", "masterBuffs"));
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.masters) setMastersList(data.masters);
            if (data.animals) setAnimalsList(data.animals);
          }
        } catch (e) { console.error(e); }
      };
      fetchGlobalSources();
      if (Object.keys(buffsCatalog || {}).length === 0) setActiveTab('form');
    }
  }, [isOpen, buffsCatalog]);

  if (!isOpen) return null;

  const handleSaveToSystem = async (updatedCatalog, updatedMasters = mastersList, updatedAnimals = animalsList) => {
    try {
      await setDoc(doc(db, "systemSettings", "masterBuffs"), { 
        catalog: updatedCatalog, masters: updatedMasters, animals: updatedAnimals
      }, { merge: true });
      setBuffsCatalog(updatedCatalog);
      setMastersList(updatedMasters);
      setAnimalsList(updatedAnimals);
    } catch (e) { alert(t('admin_buffs.err_save', '❌ Errore durante il salvataggio.')); }
  };

  const handleAddCustomSource = (type) => {
    if (!newSourceInput.trim()) return alert(t('admin_buffs.err_name_valid', 'Inserisci un nome valido.'));
    const name = newSourceInput.trim();
    if (type === 'master') {
      if (mastersList.includes(name)) return alert(t('admin_buffs.err_exists', 'Esiste già.'));
      const updated = [...mastersList, name];
      setMastersList(updated);
      setNewBuff(prev => ({ ...prev, sourceDetail: name }));
      handleSaveToSystem(buffsCatalog, updated, animalsList);
    } else {
      if (animalsList.includes(name)) return alert(t('admin_buffs.err_exists', 'Esiste già.'));
      const updated = [...animalsList, name];
      setAnimalsList(updated);
      setNewBuff(prev => ({ ...prev, sourceDetail: name }));
      handleSaveToSystem(buffsCatalog, mastersList, updated);
    }
    setNewSourceInput('');
  };

  const handleAutoFill = (statId) => {
    const config = autoConfig[statId] || { base: 0, step: 0 };
    const base = Number(config.base) || 0;
    const step = Number(config.step) || 0;
    setNewBuff(prev => {
      const currentArr = prev.values[statId] || [];
      const updatedArr = currentArr.map((_, idx) => Number((base + idx * step).toFixed(2)));
      return { ...prev, values: { ...prev.values, [statId]: updatedArr } };
    });
  };

  const handleAddLevel = () => {
    setNewBuff(prev => {
      const newValues = { ...prev.values };
      Object.keys(newValues).forEach(statId => {
        const lastVal = newValues[statId].length > 0 ? newValues[statId][newValues[statId].length - 1] : 0;
        const config = autoConfig[statId] || { step: 0 };
        const step = Number(config.step) || 0; 
        newValues[statId] = [...newValues[statId], Number((lastVal + step).toFixed(2))];
      });
      return { ...prev, values: newValues };
    });
  };

  const handleRemoveLevel = (index) => {
    setNewBuff(prev => {
      const newValues = { ...prev.values };
      const currentLength = Object.values(newValues)[0]?.length || 0;
      if (currentLength <= 1) {
        alert(t('admin_buffs.err_min_level', 'Il buff deve avere almeno un livello.'));
        return prev;
      }
      Object.keys(newValues).forEach(statId => {
        newValues[statId] = newValues[statId].filter((_, i) => i !== index);
      });
      return { ...prev, values: newValues };
    });
  };

  const handleLevelValueChange = (statId, index, val) => {
    setNewBuff(prev => {
      const newValues = { ...prev.values };
      const arr = [...(newValues[statId] || [])];
      arr[index] = Number(val) || 0;
      newValues[statId] = arr;
      return { ...prev, values: newValues };
    });
  };

  const handleStatTargetToggle = (statId) => {
    setNewBuff(prev => {
      const exists = prev.statTargets.includes(statId);
      const updatedTargets = exists ? prev.statTargets.filter(s => s !== statId) : [...prev.statTargets, statId];
      if (updatedTargets.length === 0) updatedTargets.push('atk');

      const newValues = { ...prev.values };
      const currentLength = Object.values(newValues)[0]?.length || 1; 

      if (!exists) newValues[statId] = Array(currentLength).fill(0);
      else if (updatedTargets.length > 0) delete newValues[statId];

      return { ...prev, statTargets: updatedTargets, values: newValues };
    });
  };

  const handleEventTargetToggle = (eventId) => {
    setNewBuff(prev => {
      let updatedEvents;
      if (eventId === 'all') updatedEvents = ['all'];
      else {
        const withoutAll = prev.targetEvents.filter(e => e !== 'all');
        const exists = withoutAll.includes(eventId);
        updatedEvents = exists ? withoutAll.filter(e => e !== eventId) : [...withoutAll, eventId];
        if (updatedEvents.length === 0) updatedEvents = ['all'];
      }
      return { ...prev, targetEvents: updatedEvents };
    });
  };

  const handleStartEdit = (id, buff) => {
    setEditingBuffId(id);
    const events = buff.targetEvents || (buff.targetEvent ? [buff.targetEvent] : ['all']);
    const targets = buff.statTargets || (buff.statTarget ? [buff.statTarget] : ['atk']);
    
    let migratedValues = {};
    if (Array.isArray(buff.values)) {
      targets.forEach(t => { migratedValues[t] = [...buff.values]; });
    } else {
      migratedValues = buff.values ? JSON.parse(JSON.stringify(buff.values)) : { atk: [1, 1.5, 2] };
    }

    setNewBuff({
      name: buff.name || '', description: buff.description || '', isFixedForEvent: !!buff.isFixedForEvent,
      statTargets: targets, targetEvents: events, sourceCategory: buff.sourceCategory || 'global', 
      sourceDetail: buff.sourceDetail || '', values: migratedValues
    });
    setActiveTab('form'); 
  };

  const handleCancelEdit = () => {
    setEditingBuffId(null);
    setNewBuff({ name: '', description: '', isFixedForEvent: false, statTargets: ['atk'], targetEvents: ['all'], sourceCategory: 'global', sourceDetail: '', values: { atk: [1, 1.5, 2] } });
    setActiveTab('catalog');
  };

  const handleSaveBuff = async () => {
    if (!newBuff.name.trim()) return alert(t('admin_buffs.err_name_req', 'Inserisci il nome del buff.'));
    const buffId = editingBuffId || ('master_buff_' + Date.now());
    const currentMaxLevel = Object.values(newBuff.values)[0]?.length || 1;

    const updatedCatalog = { ...buffsCatalog, [buffId]: { ...newBuff, id: buffId, maxLevel: currentMaxLevel } };
    await handleSaveToSystem(updatedCatalog);
    alert(t('admin_buffs.succ_saved', '✅ Buff salvato con successo!'));
    handleCancelEdit();
  };

  const handleDeleteBuff = (buffId) => {
    if (!window.confirm(t('admin_buffs.confirm_delete', 'Sei sicuro di voler eliminare questo buff?'))) return;
    const updatedCatalog = { ...buffsCatalog };
    delete updatedCatalog[buffId];
    handleSaveToSystem(updatedCatalog);
    if (editingBuffId === buffId) handleCancelEdit();
  };

  const statLabels = {
    atk: t('admin_buffs.stat_atk', '⚔️ Attacco'), def: t('admin_buffs.stat_def', '🛡️ Difesa'), hp: t('admin_buffs.stat_hp', '💖 Salute'),
    march_capacity: t('admin_buffs.stat_march_cap', '🎒 Cap. Marcia'), rally_capacity: t('admin_buffs.stat_rally_cap', '🏹 Cap. Rally'), lethality: t('admin_buffs.stat_lethality', '☠️ Letalità'),
    enemy_hp_red: t('admin_buffs.stat_enemy_hp', '🩸 Riduz. Salute Nemica'), march_speed: t('admin_buffs.stat_march_speed', '⚡ Velocità Marcia'), enemy_lethality_red: t('admin_buffs.stat_enemy_leth', '📉 Riduz. Letalità Nemica')
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl w-full max-w-5xl flex flex-col overflow-hidden max-h-[95vh]">
        
        <div className="bg-slate-900 border-b border-slate-800 shrink-0">
          <div className="p-5 flex justify-between items-center">
             <h3 className="text-xl font-black text-amber-400 flex items-center gap-2">👑 {t('admin_buffs.title', 'Database Globale Buff')}</h3>
             <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:bg-rose-900 hover:text-rose-400 transition-colors font-bold">✕</button>
          </div>
          <div className="flex px-5 gap-4">
             <button onClick={() => setActiveTab('catalog')} className={`pb-3 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === 'catalog' ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
                📚 {t('admin_buffs.tab_catalog', 'Catalogo Salvati')}
             </button>
             <button onClick={() => { if(!editingBuffId) setActiveTab('form'); }} className={`pb-3 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === 'form' ? (editingBuffId ? 'border-indigo-500 text-indigo-400' : 'border-emerald-500 text-emerald-400') : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
                {editingBuffId ? `✏️ ${t('admin_buffs.tab_edit', 'Modifica Buff')}` : `➕ ${t('admin_buffs.tab_new', 'Crea Nuovo')}`}
             </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 bg-slate-950">
           {activeTab === 'catalog' && (
             <div className="flex flex-col gap-3 animate-in slide-in-from-left-4 duration-300">
                {Object.keys(buffsCatalog || {}).length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
                     <span className="text-4xl">📭</span>
                     <p className="text-sm text-slate-400 font-bold">{t('admin_buffs.empty_catalog', 'Nessun buff configurato.')}</p>
                     <button onClick={() => setActiveTab('form')} className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-black rounded-lg">{t('admin_buffs.create_now', 'Creane uno adesso')}</button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {Object.entries(buffsCatalog).map(([id, buff]) => {
                       const targets = buff.statTargets || ['atk'];
                       return (
                         <div key={id} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col gap-3 hover:border-amber-500/30 transition-colors shadow-lg">
                            <div className="flex justify-between items-start gap-2">
                               <div className="flex-1">
                                  <h4 className="text-sm font-black text-white">{buff.name}</h4>
                                  <p className="text-[10px] text-slate-400 line-clamp-2 mt-0.5">{buff.description || t('admin_buffs.no_desc', 'Nessuna descrizione')}</p>
                               </div>
                               <div className="flex gap-2 shrink-0">
                                  <button onClick={() => handleStartEdit(id, buff)} className="text-[10px] font-black text-indigo-400 px-3 py-1.5 bg-indigo-950/40 border border-indigo-900/50 rounded-lg hover:bg-indigo-900 transition-colors">{t('admin_buffs.btn_edit', 'Modifica')}</button>
                                  <button onClick={() => handleDeleteBuff(id)} className="text-[10px] font-black text-rose-400 px-3 py-1.5 bg-rose-950/30 border border-rose-900/50 rounded-lg hover:bg-rose-900 transition-colors">{t('admin_buffs.btn_delete', 'Elimina')}</button>
                               </div>
                            </div>
                            
                            <div className="flex flex-wrap gap-1.5 mt-1">
                               <span className="text-[9px] text-amber-300 bg-amber-950/40 border border-amber-900/50 px-2 py-0.5 rounded font-bold">
                                 {buff.sourceCategory === 'master' ? `🧙‍♂️ ${buff.sourceDetail}` : buff.sourceCategory === 'animal' ? `🐾 ${buff.sourceDetail}` : `🌐 ${t('admin_buffs.source_global', 'Globale')}`}
                               </span>
                               {buff.isFixedForEvent && <span className="text-[9px] text-cyan-400 bg-cyan-950/40 border border-cyan-900/50 px-2 py-0.5 rounded font-bold">🔒 {t('admin_buffs.badge_fixed', 'Fisso')}</span>}
                            </div>

                            <div className="flex flex-col gap-1.5 mt-2 border-t border-slate-800 pt-3">
                               {targets.map(st => (
                                 <div key={st} className="flex gap-2 items-start">
                                    <span className="text-[10px] text-indigo-300 font-bold uppercase w-16 shrink-0">{statLabels[st]}:</span>
                                    <div className="flex flex-wrap gap-1">
                                       {(Array.isArray(buff.values) ? buff.values : (buff.values[st] || [])).map((v, i) => (
                                          <span key={i} className="text-[9px] text-slate-300 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-700">
                                             Lv.{i+1}: <span className="text-amber-400 font-mono">{v}{getStatSuffix(st)}</span>
                                          </span>
                                       ))}
                                    </div>
                                 </div>
                               ))}
                            </div>
                         </div>
                       );
                    })}
                  </div>
                )}
             </div>
           )}

           {activeTab === 'form' && (
             <div className="flex flex-col gap-5 animate-in slide-in-from-right-4 duration-300 pb-10">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                   <div className={`p-5 rounded-2xl border ${editingBuffId ? 'bg-indigo-950/10 border-indigo-900/50' : 'bg-slate-900 border-slate-800'}`}>
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">{t('admin_buffs.sec1_title', '1. Identità e Origine')}</h4>
                      <div className="flex flex-col gap-4">
                         <input type="text" placeholder={t('admin_buffs.name_ph', 'Nome del Buff (es. Furia del Maestro)')} value={newBuff.name} onChange={e => setNewBuff({...newBuff, name: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-sm outline-none focus:border-amber-500 font-bold" />
                         <textarea placeholder={t('admin_buffs.desc_ph', 'Descrizione o note...')} value={newBuff.description} onChange={e => setNewBuff({...newBuff, description: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-slate-300 text-xs outline-none focus:border-amber-500 resize-none h-16" />
                         
                         <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800 flex flex-col gap-3 mt-1">
                            <label className="text-[10px] text-amber-500 font-bold uppercase">{t('admin_buffs.source_cat', "Categoria d'Origine")}</label>
                            <div className="grid grid-cols-3 gap-2">
                               <button type="button" onClick={() => setNewBuff({...newBuff, sourceCategory: 'global', sourceDetail: ''})} className={`py-2 text-xs font-black rounded-xl border transition-all ${newBuff.sourceCategory === 'global' ? 'bg-amber-600 border-amber-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'}`}>🌐 {t('admin_buffs.source_global', 'Globale')}</button>
                               <button type="button" onClick={() => setNewBuff({...newBuff, sourceCategory: 'master', sourceDetail: mastersList[0] || ''})} className={`py-2 text-xs font-black rounded-xl border transition-all ${newBuff.sourceCategory === 'master' ? 'bg-amber-600 border-amber-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'}`}>🧙‍♂️ {t('admin_buffs.source_master_btn', 'Maestro')}</button>
                               <button type="button" onClick={() => setNewBuff({...newBuff, sourceCategory: 'animal', sourceDetail: animalsList[0] || ''})} className={`py-2 text-xs font-black rounded-xl border transition-all ${newBuff.sourceCategory === 'animal' ? 'bg-amber-600 border-amber-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'}`}>🐾 {t('admin_buffs.source_animal_btn', 'Animale')}</button>
                            </div>

                            {newBuff.sourceCategory === 'master' && (
                              <div className="flex flex-col gap-2 animate-in fade-in">
                                 <select value={newBuff.sourceDetail} onChange={e => setNewBuff({...newBuff, sourceDetail: e.target.value})} className="bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-amber-300 font-bold text-xs outline-none">
                                    {mastersList.map(m => <option key={m} value={m}>{m}</option>)}
                                 </select>
                                 <div className="flex gap-2">
                                    <input type="text" placeholder={t('admin_buffs.new_master_ph', 'Nuovo Maestro...')} value={newSourceInput} onChange={e => setNewSourceInput(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-xs outline-none flex-1" />
                                    <button type="button" onClick={() => handleAddCustomSource('master')} className="px-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-[10px] uppercase rounded-lg">{t('admin_buffs.btn_save_source', '+ Salva')}</button>
                                 </div>
                              </div>
                            )}

                            {newBuff.sourceCategory === 'animal' && (
                              <div className="flex flex-col gap-2 animate-in fade-in">
                                 <select value={newBuff.sourceDetail} onChange={e => setNewBuff({...newBuff, sourceDetail: e.target.value})} className="bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-amber-300 font-bold text-xs outline-none">
                                    {animalsList.map(a => <option key={a} value={a}>{a}</option>)}
                                 </select>
                                 <div className="flex gap-2">
                                    <input type="text" placeholder={t('admin_buffs.new_animal_ph', 'Nuovo Animale...')} value={newSourceInput} onChange={e => setNewSourceInput(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-xs outline-none flex-1" />
                                    <button type="button" onClick={() => handleAddCustomSource('animal')} className="px-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-[10px] uppercase rounded-lg">{t('admin_buffs.btn_save_source', '+ Salva')}</button>
                                 </div>
                              </div>
                            )}
                         </div>
                      </div>
                   </div>

                   <div className={`p-5 rounded-2xl border ${editingBuffId ? 'bg-indigo-950/10 border-indigo-900/50' : 'bg-slate-900 border-slate-800'}`}>
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">{t('admin_buffs.sec2_title', '2. Eventi & Parametri')}</h4>
                      
                      <div className="flex flex-col gap-4">
                         <div className="flex flex-col gap-2">
                            <label className="text-[10px] text-amber-500 font-bold uppercase">{t('admin_buffs.active_events', 'Eventi Attivi')}</label>
                            <div className="flex flex-wrap gap-2">
                               <label className={`px-2 py-1.5 rounded-lg border cursor-pointer transition-all text-[11px] font-bold flex items-center gap-2 ${newBuff.targetEvents.includes('all') ? 'bg-amber-900/40 border-amber-500 text-amber-300' : 'bg-slate-950 border-slate-700 text-slate-400 hover:border-slate-500'}`}>
                                  <input type="checkbox" checked={newBuff.targetEvents.includes('all')} onChange={() => handleEventTargetToggle('all')} className="hidden" /> 🌐 {t('admin_buffs.all_events', 'Globale')}
                               </label>
                               {eventTypes.map(ev => (
                                 <label key={ev.id} className={`px-2 py-1.5 rounded-lg border cursor-pointer transition-all text-[11px] font-bold flex items-center gap-2 ${newBuff.targetEvents.includes(ev.id) ? 'bg-cyan-900/40 border-cyan-500 text-cyan-300' : 'bg-slate-950 border-slate-700 text-slate-400 hover:border-slate-500'}`}>
                                    <input type="checkbox" checked={newBuff.targetEvents.includes(ev.id)} onChange={() => handleEventTargetToggle(ev.id)} className="hidden" /> {ev.name}
                                 </label>
                               ))}
                            </div>
                         </div>

                         <div className="flex flex-col gap-2">
                            <label className="text-[10px] text-amber-500 font-bold uppercase">{t('admin_buffs.influenced_params', 'Parametri Influenzati (Più selezioni = Più Tabelle)')}</label>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                               {Object.entries(statLabels).map(([id, label]) => (
                                  <label key={id} className={`px-2 py-1.5 rounded-lg border cursor-pointer transition-all text-[10px] font-bold flex items-center gap-1.5 ${newBuff.statTargets.includes(id) ? 'bg-indigo-900/40 border-indigo-500 text-indigo-300 shadow' : 'bg-slate-950 border-slate-700 text-slate-400 hover:border-slate-500'}`}>
                                     <input type="checkbox" checked={newBuff.statTargets.includes(id)} onChange={() => handleStatTargetToggle(id)} className="hidden" /> 
                                     {newBuff.statTargets.includes(id) && <span>✓</span>} {label}
                                  </label>
                               ))}
                            </div>
                         </div>
                      </div>
                   </div>
                </div>

                <div className={`p-5 rounded-2xl border ${editingBuffId ? 'bg-indigo-950/10 border-indigo-900/50' : 'bg-slate-900 border-slate-800'}`}>
                   <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">{t('admin_buffs.sec3_title', '3. Configurazione Livelli per Parametro')}</h4>
                      <label className="flex items-center gap-2 cursor-pointer bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-700 shadow">
                         <input type="checkbox" checked={newBuff.isFixedForEvent} onChange={e => setNewBuff({...newBuff, isFixedForEvent: e.target.checked})} className="accent-cyan-500 w-3.5 h-3.5" />
                         <span className="text-[10px] text-cyan-400 font-bold uppercase">🔒 {t('admin_buffs.fixed_activation', "Attivazione Fissa/Automatica per l'evento")}</span>
                      </label>
                   </div>
                   
                   <div className="flex flex-col gap-6">
                      {newBuff.statTargets.map((statId) => {
                         const valuesArr = newBuff.values[statId] || [];
                         const isFlat = isStatFlat(statId);

                         return (
                           <div key={statId} className="bg-slate-950 border border-slate-700 rounded-2xl p-4 shadow-inner flex flex-col gap-4 animate-in fade-in">
                              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-slate-800 pb-3">
                                 <span className="text-sm font-black text-indigo-400 flex items-center gap-2">
                                    {statLabels[statId]} <span className="text-[9px] bg-indigo-900/50 text-indigo-300 px-2 py-0.5 rounded border border-indigo-800 uppercase">{isFlat ? t('admin_buffs.val_flat', 'Valore Fisso') : t('admin_buffs.val_perc', 'Percentuale %')}</span>
                                 </span>
                                 
                                 <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                                    <div className="flex items-center gap-1.5 bg-slate-900 px-2 py-1.5 rounded-lg border border-slate-700">
                                       <span className="text-[9px] text-slate-400 font-bold uppercase">⚡ {t('admin_buffs.autofill', 'Auto-Compila:')}</span>
                                       <input type="number" step={isFlat ? '1' : '0.1'} value={autoConfig[statId]?.base || ''} onChange={e => setAutoConfig(p => ({...p, [statId]: {...p[statId], base: e.target.value}}))} className="w-14 bg-slate-950 text-white text-center font-mono text-xs p-1 rounded outline-none border border-slate-600 focus:border-amber-500" placeholder={t('admin_buffs.base_ph', 'Base')} />
                                       <span className="text-slate-500 font-bold">+</span>
                                       <input type="number" step={isFlat ? '1' : '0.1'} value={autoConfig[statId]?.step || ''} onChange={e => setAutoConfig(p => ({...p, [statId]: {...p[statId], step: e.target.value}}))} className="w-14 bg-slate-950 text-white text-center font-mono text-xs p-1 rounded outline-none border border-slate-600 focus:border-amber-500" placeholder={t('admin_buffs.step_ph', 'Step')} />
                                       <button type="button" onClick={() => handleAutoFill(statId)} className="px-3 py-1 bg-slate-800 hover:bg-amber-600 hover:text-white text-slate-300 text-[10px] font-black uppercase rounded transition-colors shadow">{t('admin_buffs.btn_apply', 'Applica')}</button>
                                    </div>
                                    <button onClick={handleAddLevel} type="button" className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-black uppercase rounded-lg shadow whitespace-nowrap">
                                      {t('admin_buffs.btn_add_level', '➕ Aggiungi Livello')}
                                    </button>
                                 </div>
                              </div>

                              <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-2">
                                 {valuesArr.map((val, idx) => (
                                   <div key={idx} className="flex flex-col bg-slate-900 rounded-xl border border-slate-700 overflow-hidden focus-within:border-amber-500 focus-within:shadow-[0_0_10px_rgba(245,158,11,0.2)] transition-all group">
                                      <div className="flex justify-between items-center bg-slate-950 px-2 py-1 border-b border-slate-800">
                                         <span className="text-[9px] text-slate-400 font-bold uppercase">{t('admin_buffs.level_label', `Lv. ${idx + 1}`, { num: idx + 1 })}</span>
                                         {valuesArr.length > 1 && (
                                           <button onClick={() => handleRemoveLevel(idx)} className="text-[10px] text-slate-600 hover:text-rose-500 font-black px-1">✕</button>
                                         )}
                                      </div>
                                      <div className="flex items-center justify-center p-2 gap-0.5">
                                         <input type="number" step={isFlat ? '1' : '0.01'} value={val} onChange={e => handleLevelValueChange(statId, idx, e.target.value)} className="w-full bg-transparent text-amber-400 text-center font-mono text-sm font-black outline-none" />
                                         {!isFlat && <span className="text-[10px] text-amber-600 font-bold">%</span>}
                                      </div>
                                   </div>
                                 ))}
                              </div>

                           </div>
                         );
                      })}
                   </div>
                </div>
             </div>
           )}
        </div>

        <div className="bg-slate-900 border-t border-slate-800 p-4 shrink-0 flex items-center justify-between gap-4">
           {activeTab === 'form' ? (
             <>
               {editingBuffId ? (
                 <button onClick={handleCancelEdit} className="px-6 py-3 text-slate-400 hover:text-white text-xs font-bold uppercase transition-colors">{t('admin_buffs.btn_cancel', 'Annulla Modifica')}</button>
               ) : <div />}
               <button onClick={handleSaveBuff} className={`px-8 py-3 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg ${editingBuffId ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-900/50' : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/50'}`}>
                 {editingBuffId ? t('admin_buffs.btn_update', '💾 Aggiorna Buff') : t('admin_buffs.btn_save_db', '+ Salva nel Database')}
               </button>
             </>
           ) : (
             <div className="w-full flex justify-end">
               <button onClick={onClose} className="px-8 py-3 bg-slate-800 hover:bg-slate-700 text-white font-black text-xs uppercase rounded-xl transition-colors">{t('admin_buffs.btn_close', 'Chiudi Gestione')}</button>
             </div>
           )}
        </div>
      </div>
    </div>
  );
}