import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { doc, setDoc } from 'firebase/firestore';

export default function AdminHeroesModal({ isOpen, onClose, heroesCatalog, setHeroesCatalog, t }) {
  const [heroes, setHeroes] = useState([]);
  const [editingHero, setEditingHero] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setHeroes(heroesCatalog ? [...heroesCatalog] : []);
    }
  }, [isOpen, heroesCatalog]);

  if (!isOpen) return null;

  const handleAddNew = () => {
    setEditingHero({ id: `hero_${Date.now()}`, name: '', type: 'Fanteria', rarity: 'legendary', gen: 1, image: '' });
  };

  const handleSaveHero = () => {
    if (!editingHero.name.trim()) return alert(t('admin_heroes.err_name', "Il nome dell'eroe è obbligatorio!"));
    
    const existingIndex = heroes.findIndex(h => h.id === editingHero.id);
    let updatedHeroes = [...heroes];
    
    if (existingIndex >= 0) {
      updatedHeroes[existingIndex] = editingHero;
    } else {
      updatedHeroes.push({ ...editingHero, id: editingHero.id.includes('hero_') ? editingHero.name.toLowerCase().replace(/\s+/g, '_') : editingHero.id });
    }

    updatedHeroes.sort((a, b) => {
      if (b.gen !== a.gen) return b.gen - a.gen;
      return a.name.localeCompare(b.name);
    });

    setHeroes(updatedHeroes);
    setEditingHero(null);
  };

  const handleDeleteHero = (id) => {
    if (window.confirm(t('admin_heroes.confirm_delete', "Sei sicuro di voler eliminare questo eroe dal database globale?"))) {
      setHeroes(heroes.filter(h => h.id !== id));
    }
  };

  const handleSaveToCloud = async () => {
    setIsLoading(true);
    try {
      await setDoc(doc(db, "systemSettings", "heroesCatalog"), { catalog: heroes });
      setHeroesCatalog(heroes);
      alert(t('admin_heroes.succ_save', "✅ Catalogo Eroi aggiornato con successo nel Cloud!"));
      onClose();
    } catch (e) {
      console.error(e);
      alert(t('admin_heroes.err_save', "❌ Errore durante il salvataggio nel Cloud."));
    }
    setIsLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden max-h-[90vh]">
        
        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
          <div>
            <h3 className="text-xl font-black text-white flex items-center gap-2">🛠️ {t('admin_heroes.title', 'Gestione Database Eroi')}</h3>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">{t('admin_heroes.subtitle', 'Modifica il catalogo globale. Le modifiche avranno effetto su tutti gli utenti.')}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:text-white font-bold transition-colors">✕</button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          
          <div className="w-full md:w-1/2 border-r border-slate-800 flex flex-col max-h-[50vh] md:max-h-full">
            <div className="p-3 border-b border-slate-800">
              <button onClick={handleAddNew} className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase rounded-lg transition-colors">
                {t('admin_heroes.add_new', '+ Aggiungi Nuovo Eroe')}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 custom-scrollbar">
              {heroes.map(hero => (
                <div key={hero.id} className="flex justify-between items-center bg-slate-950 border border-slate-800 p-2.5 rounded-xl hover:border-slate-600 transition-colors">
                  <div className="flex items-center gap-3">
                    {hero.image ? (
                      <img src={hero.image} alt={hero.name} className="w-10 h-10 rounded-lg object-cover border border-slate-700" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-lg">{hero.type === 'Fanteria' ? '⚔️' : hero.type === 'Cavalleria' ? '🐎' : '🏹'}</div>
                    )}
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-white">{hero.name}</span>
                      <span className="text-[9px] text-slate-500 uppercase">Gen {hero.gen} • {t(`march_builder.${hero.type.toLowerCase()}`, hero.type)}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setEditingHero(hero)} className="w-7 h-7 rounded bg-indigo-900/50 text-indigo-400 hover:bg-indigo-600 hover:text-white flex items-center justify-center" title={t('admin_heroes.edit', 'Modifica')}>✎</button>
                    <button onClick={() => handleDeleteHero(hero.id)} className="w-7 h-7 rounded bg-rose-900/50 text-rose-400 hover:bg-rose-600 hover:text-white flex items-center justify-center" title={t('admin_heroes.delete', 'Elimina')}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="w-full md:w-1/2 bg-slate-950 p-6 overflow-y-auto custom-scrollbar flex flex-col justify-center">
            {editingHero ? (
              <div className="flex flex-col gap-4 animate-in slide-in-from-right-4">
                <h4 className="text-sm font-black text-cyan-400 uppercase tracking-widest border-b border-slate-800 pb-2">
                  {editingHero.id.includes('hero_') ? t('admin_heroes.new_title', 'Nuovo Eroe') : t('admin_heroes.edit_title', 'Modifica Eroe')}
                </h4>
                
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-slate-500 font-bold uppercase">{t('admin_heroes.name_label', 'Nome Eroe')}</label>
                  <input type="text" value={editingHero.name} onChange={e => setEditingHero({...editingHero, name: e.target.value})} className="bg-slate-900 border border-slate-700 rounded p-2 text-white outline-none focus:border-cyan-500 font-bold" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-500 font-bold uppercase">{t('admin_heroes.type_label', 'Tipo Truppa')}</label>
                    <select value={editingHero.type} onChange={e => setEditingHero({...editingHero, type: e.target.value})} className="bg-slate-900 border border-slate-700 rounded p-2 text-white outline-none focus:border-cyan-500 text-xs font-bold">
                      <option value="Fanteria">{t('march_builder.infantry', 'Fanteria')}</option>
                      <option value="Cavalleria">{t('march_builder.cavalry', 'Cavalleria')}</option>
                      <option value="Arcieri">{t('march_builder.archers', 'Arcieri')}</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-500 font-bold uppercase">{t('admin_heroes.rarity_label', 'Rarità')}</label>
                    <select value={editingHero.rarity} onChange={e => setEditingHero({...editingHero, rarity: e.target.value})} className="bg-slate-900 border border-slate-700 rounded p-2 text-white outline-none focus:border-cyan-500 text-xs font-bold">
                      <option value="legendary">{t('admin_heroes.rarity_leg', 'Legendary (Oro)')}</option>
                      <option value="epic">{t('admin_heroes.rarity_epic', 'Epic (Viola)')}</option>
                      <option value="rare">{t('admin_heroes.rarity_rare', 'Rare (Blu)')}</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-slate-500 font-bold uppercase">{t('admin_heroes.gen_label', 'Generazione')}</label>
                  <input type="number" min="1" value={editingHero.gen} onChange={e => setEditingHero({...editingHero, gen: Number(e.target.value)})} className="bg-slate-900 border border-slate-700 rounded p-2 text-white outline-none focus:border-cyan-500 font-bold" />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-slate-500 font-bold uppercase">{t('admin_heroes.image_label', 'URL Immagine (Opzionale)')}</label>
                  <input type="text" placeholder="https://..." value={editingHero.image || ''} onChange={e => setEditingHero({...editingHero, image: e.target.value})} className="bg-slate-900 border border-slate-700 rounded p-2 text-white outline-none focus:border-cyan-500 text-xs" />
                </div>

                <div className="flex gap-2 mt-4">
                  <button onClick={() => setEditingHero(null)} className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-bold uppercase rounded-lg">{t('admin_heroes.cancel', 'Annulla')}</button>
                  <button onClick={handleSaveHero} className="flex-1 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-black uppercase tracking-wider rounded-lg">{t('admin_heroes.apply_changes', 'Applica Modifiche')}</button>
                </div>
              </div>
            ) : (
              <div className="text-center text-slate-600 text-sm font-bold flex flex-col items-center gap-2">
                <span className="text-4xl">👈</span>
                {t('admin_heroes.select_hint', 'Seleziona un eroe dalla lista o creane uno nuovo.')}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white uppercase">{t('admin_heroes.cancel', 'Annulla')}</button>
          <button onClick={handleSaveToCloud} disabled={isLoading} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-[0_0_15px_rgba(79,70,229,0.4)] disabled:opacity-50">
            {isLoading ? t('admin_heroes.saving', 'Salvataggio...') : t('admin_heroes.publish_cloud', '💾 Pubblica nel Cloud')}
          </button>
        </div>

      </div>
    </div>
  );
}