import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { heroesDB } from '../../data/heroes';

export default function HeroImportModal({ isOpen, onClose, ownedHeroes, setOwnedHeroes, t, heroesCatalog }) {
  const [step, setStep] = useState('upload'); 
  const [columns, setColumns] = useState([]);
  const [rawRows, setRawRows] = useState([]);
  
  const [mapping, setMapping] = useState({
    hero: '', level: '', stars: '', starFragments: '', helmetLevel: '', helmetPower: '', armorLevel: '', armorPower: '', glovesLevel: '', glovesPower: '', bootsLevel: '', bootsPower: '', exclusive: ''
  });

  if (!isOpen) return null;

  const parseNum = (val) => {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return val;
    const strVal = String(val).trim();
    if (strVal.includes('/')) return parseFloat(strVal.split('/')[0].replace(',', '.')) || 0;
    return parseFloat(strVal.replace(/\s+/g, '').replace(',', '.')) || 0;
  };

  const handleFileProcessed = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const data = XLSX.utils.sheet_to_json(wb.Sheets[wsname]);

        if (!data || data.length === 0) {
          alert(t('hero_import.err_empty', "⚠️ Il file Excel sembra vuoto."));
          return;
        }

        const detectedColumns = Object.keys(data[0]);
        setColumns(detectedColumns);
        setRawRows(data);
        
        const autoMap = { hero: '', level: '', stars: '', starFragments: '', helmetLevel: '', helmetPower: '', armorLevel: '', armorPower: '', glovesLevel: '', glovesPower: '', bootsLevel: '', bootsPower: '', exclusive: '' };

        detectedColumns.forEach(col => {
          const lower = col.toLowerCase();
          if (lower.includes('nome') || lower.includes('hero') || lower.includes('id') || lower.includes('eroe')) autoMap.hero = col;
          else if (lower.includes('livello') || lower.includes('level') || lower.includes('lv')) autoMap.level = col;
          else if (lower.includes('stella') || lower.includes('star')) {
            if (!lower.includes('framm') && !lower.includes('shard') && !lower.includes('tesser')) autoMap.stars = col;
          }
          else if (lower.includes('frammento') || lower.includes('fragment') || lower.includes('shard') || lower.includes('tesser') || lower.includes('pezzo')) autoMap.starFragments = col;
          else if (lower.includes('elmo') || lower.includes('helmet')) {
            if (lower.includes('pot') || lower.includes('power') || lower.includes('forza')) autoMap.helmetPower = col;
            else autoMap.helmetLevel = col;
          }
          else if (lower.includes('armatura') || lower.includes('armor')) {
            if (lower.includes('pot') || lower.includes('power') || lower.includes('forza')) autoMap.armorPower = col;
            else autoMap.armorLevel = col;
          }
          else if (lower.includes('guanto') || lower.includes('glove')) {
            if (lower.includes('pot') || lower.includes('power') || lower.includes('forza')) autoMap.glovesPower = col;
            else autoMap.glovesLevel = col;
          }
          else if (lower.includes('stivale') || lower.includes('boot')) {
            if (lower.includes('pot') || lower.includes('power') || lower.includes('forza')) autoMap.bootsPower = col;
            else autoMap.bootsLevel = col;
          }
          else if (lower.includes('esclusivo') || lower.includes('exclusive')) autoMap.exclusive = col;
        });

        setMapping(autoMap);
        setStep('mapping');
      } catch (err) {
        console.error(err);
        alert(t('hero_import.err_read', "❌ Errore durante la lettura del file Excel."));
      }
    };
    reader.readAsBinaryString(file);
  };

  const executeImport = () => {
    if (!mapping.hero) return alert(t('hero_import.err_mapping', "⚠️ Devi almeno associare la colonna degli Eroi (Nome o ID)."));

    let importedHeroes = { ...(ownedHeroes || {}) };
    let count = 0;

    rawRows.forEach(row => {
      const rowKey = String(row[mapping.hero] || '').trim().toLowerCase();
      if (!rowKey) return;

      const matchedHero = heroesCatalog.find(h => h.id.toLowerCase() === rowKey || h.name.toLowerCase() === rowKey);

      if (matchedHero) {
        const fragVal = mapping.starFragments ? parseNum(row[mapping.starFragments]) || 0 : 0;
        const existingHeroData = importedHeroes[matchedHero.id] || { power: 0, troopCapacity: 0, gear: { helmet: { level: 0, power: 0, isRed: false }, armor: { level: 0, power: 0, isRed: false }, gloves: { level: 0, power: 0, isRed: false }, boots: { level: 0, power: 0, isRed: false } }, exclusive: 0, stats: { conquest: { heroAtk: 0, heroDef: 0, heroHp: 0, escortAtk: 0, escortDef: 0, escortHp: 0 }, expedition: { troopAtk: 0, troopDef: 0, troopLethality: 0, troopHp: 0 } } };

        importedHeroes[matchedHero.id] = {
          ...existingHeroData,
          level: mapping.level ? parseNum(row[mapping.level]) || 1 : existingHeroData.level,
          stars: mapping.stars ? parseNum(row[mapping.stars]) || 0 : existingHeroData.stars,
          starFragments: fragVal, fragments: fragVal, shards: fragVal, fragment: fragVal,
          gear: {
            helmet: { level: mapping.helmetLevel ? parseNum(row[mapping.helmetLevel]) || existingHeroData.gear.helmet.level : existingHeroData.gear.helmet.level, power: mapping.helmetPower ? parseNum(row[mapping.helmetPower]) || existingHeroData.gear.helmet.power : existingHeroData.gear.helmet.power, isRed: existingHeroData.gear.helmet.isRed },
            armor: { level: mapping.armorLevel ? parseNum(row[mapping.armorLevel]) || existingHeroData.gear.armor.level : existingHeroData.gear.armor.level, power: mapping.armorPower ? parseNum(row[mapping.armorPower]) || existingHeroData.gear.armor.power : existingHeroData.gear.armor.power, isRed: existingHeroData.gear.armor.isRed },
            gloves: { level: mapping.glovesLevel ? parseNum(row[mapping.glovesLevel]) || existingHeroData.gear.gloves.level : existingHeroData.gear.gloves.level, power: mapping.glovesPower ? parseNum(row[mapping.glovesPower]) || existingHeroData.gear.gloves.power : existingHeroData.gear.gloves.power, isRed: existingHeroData.gear.gloves.isRed },
            boots: { level: mapping.bootsLevel ? parseNum(row[mapping.bootsLevel]) || existingHeroData.gear.boots.level : existingHeroData.gear.boots.level, power: mapping.bootsPower ? parseNum(row[mapping.bootsPower]) || existingHeroData.gear.boots.power : existingHeroData.gear.boots.power, isRed: existingHeroData.gear.boots.isRed }
          },
          exclusive: mapping.exclusive ? parseNum(row[mapping.exclusive]) || existingHeroData.exclusive : existingHeroData.exclusive
        };
        count++;
      }
    });

    if (count > 0) {
      setOwnedHeroes(importedHeroes);
      alert(t('hero_import.success_import', `✅ Importati con successo ${count} eroi! Clicca su "Salva Modifiche" nel Cloud.`, { count }));
      onClose();
      setStep('upload');
    } else {
      alert(t('hero_import.err_not_found', "⚠️ Nessun eroe trovato con i criteri selezionati. Controlla la colonna del Nome/ID."));
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
       <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-3xl flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
          
          <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
             <div>
               <h3 className="text-lg font-black text-white">{t('hero_import.title', 'Importazione Guidata Excel (Eroi & Gear)')}</h3>
               <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-0.5">{t('hero_import.subtitle', 'Mappa le colonne di livello, frammenti e potenza equipaggiamento')}</p>
             </div>
             <button onClick={() => { onClose(); setStep('upload'); }} className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white hover:bg-rose-600 transition-colors font-bold flex items-center justify-center">✕</button>
          </div>

          <div className="p-6 flex flex-col gap-6 max-h-[70vh] overflow-y-auto custom-scrollbar bg-[#090e17]">
             
             {step === 'upload' && (
                <div className="flex flex-col items-center justify-center py-12 gap-4 border-2 border-dashed border-slate-700 hover:border-emerald-500/50 rounded-2xl bg-slate-950/40 transition-colors">
                   <span className="text-5xl">📊</span>
                   <div className="text-center">
                      <p className="text-white font-bold text-sm">{t('hero_import.select_file', 'Seleziona il tuo file Excel (.xlsx, .csv)')}</p>
                      <p className="text-xs text-slate-500 mt-1">{t('hero_import.analyze_desc', 'Il sistema analizzerà le intestazioni delle colonne del tuo file.')}</p>
                   </div>
                   <label className="cursor-pointer px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg mt-2">
                      {t('hero_import.choose_file_btn', 'Scegli File')}
                      <input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileProcessed} className="hidden" />
                   </label>
                </div>
             )}

             {step === 'mapping' && (
                <div className="flex flex-col gap-4">
                   <div className="bg-emerald-950/30 border border-emerald-900/50 p-4 rounded-xl">
                      <p className="text-xs text-emerald-300" dangerouslySetInnerHTML={{ __html: t('hero_import.found_rows', `Trovate <strong class="text-white">${rawRows.length} righe</strong>. Verifica o correggi le corrispondenze delle colonne:`, { count: rawRows.length }) }} />
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {[
                        { key: 'hero', label: t('hero_import.col_hero', 'Eroe (Nome / ID) *'), required: true },
                        { key: 'level', label: t('hero_import.col_level', 'Livello Eroe') },
                        { key: 'stars', label: t('hero_import.col_stars', 'Stelle') },
                        { key: 'starFragments', label: t('hero_import.col_fragments', 'Frammento di stella (Tessere)') },
                        { key: 'helmetLevel', label: t('hero_import.col_helm_lvl', 'Elmo - Livello') },
                        { key: 'helmetPower', label: t('hero_import.col_helm_pow', 'Elmo - Potenza') },
                        { key: 'armorLevel', label: t('hero_import.col_armor_lvl', 'Armatura - Livello') },
                        { key: 'armorPower', label: t('hero_import.col_armor_pow', 'Armatura - Potenza') },
                        { key: 'glovesLevel', label: t('hero_import.col_glove_lvl', 'Guanti - Livello') },
                        { key: 'glovesPower', label: t('hero_import.col_glove_pow', 'Guanti - Potenza') },
                        { key: 'bootsLevel', label: t('hero_import.col_boot_lvl', 'Stivali - Livello') },
                        { key: 'bootsPower', label: t('hero_import.col_boot_pow', 'Stivali - Potenza') },
                        { key: 'exclusive', label: t('hero_import.col_exclusive', 'Equipaggiamento Esclusivo (Valore)') }
                      ].map(field => (
                         <div key={field.key} className="flex flex-col gap-1 bg-slate-950 p-3 rounded-xl border border-slate-800">
                            <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center justify-between">
                               <span>{field.label}</span>
                               {field.required && <span className="text-rose-500">{t('hero_import.required', 'Obbligatorio')}</span>}
                            </label>
                            <select 
                               value={mapping[field.key]} 
                               onChange={e => setMapping({...mapping, [field.key]: e.target.value})}
                               className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-xs font-bold outline-none focus:border-emerald-500"
                            >
                               <option value="">{t('hero_import.opt_ignore', '-- Ignora / Non presente --')}</option>
                               {columns.map(col => (
                                  <option key={col} value={col}>{col}</option>
                               ))}
                            </select>
                         </div>
                      ))}
                   </div>

                   <div className="flex gap-3 mt-4 pt-4 border-t border-slate-800">
                      <button onClick={() => setStep('upload')} className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold uppercase transition-colors">
                         {t('hero_import.btn_back', 'Indietro')}
                      </button>
                      <button onClick={executeImport} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg">
                         {t('hero_import.btn_confirm', 'Conferma e Importa Eroi & Gear')}
                      </button>
                   </div>
                </div>
             )}

          </div>
       </div>
    </div>
  );
}