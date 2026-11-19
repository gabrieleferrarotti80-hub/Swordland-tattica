import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebase';
import { collection, query, where, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';

export default function KingdomManager() {
  const navigate = useNavigate();
  const [kingdomInput, setKingdomInput] = useState('');
  const [activeKingdom, setActiveKingdom] = useState(null);
  const [alliances, setAlliances] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const [newTag, setNewTag] = useState('');
  const [newName, setNewName] = useState('');

  const fetchKingdomData = async (e) => {
    if (e) e.preventDefault();
    if (!kingdomInput.trim()) return alert("Inserisci un numero di regno.");
    
    setIsLoading(true);
    const cleanKingdom = kingdomInput.trim();
    
    try {
      const q = query(collection(db, 'alliances'), where('kingdom', '==', cleanKingdom));
      const snap = await getDocs(q);
      
      const loadedAlliances = snap.docs.map(d => d.data());
      setAlliances(loadedAlliances);
      setActiveKingdom(cleanKingdom);
    } catch (error) {
      console.error(error);
      alert("Errore durante il caricamento.");
    }
    setIsLoading(false);
  };

 const handleCreateAlliance = async (e) => {
    e.preventDefault();
    if (!newTag || !newName) return alert("Compila TAG e Nome dell'alleanza.");
    
    // Manteniamo esattamente minuscole/maiuscole come digitate dall'admin
    const exactTag = newTag.trim().replace(/\s+/g, '');
    const newAllianceId = `${activeKingdom}_${exactTag}`;
    
    setIsLoading(true);
    try {
      const allianceSnap = await getDoc(doc(db, "alliances", newAllianceId));
      if (allianceSnap.exists()) {
        setIsLoading(false);
        return alert(`L'alleanza [${exactTag}] esiste già nel regno ${activeKingdom}.`);
      }

      // 1. Creazione documento Alleanza
      await setDoc(doc(db, "alliances", newAllianceId), {
        id: newAllianceId,
        tag: exactTag,
        kingdom: activeKingdom,
        name: newName.trim(),
        founderId: 'admin',
        currentR5: 'admin',
        pendingTransferTo: null,
        premiumFeatures: { castleBattle: true },
        createdAt: new Date().toISOString()
      });

      // 2. Creazione Roster iniziale
      await setDoc(doc(db, "rosters", newAllianceId), {
        players: [{
          id: 'admin_placeholder',
          name: 'Master',
          tag: exactTag,
          role: 'R5',
          power: 0,
          marches: 1,
          isParticipating: false
        }],
        createdAt: new Date().toISOString()
      });

      // 3. 📌 INIZIALIZZAZIONE MAPPA GLOBALE (Collezione allianceMapData)
      // Questo garantisce che l'alleanza abbia subito le strutture base e appaia sulla mappa del regno!
      await setDoc(doc(db, "allianceMapData", newAllianceId), {
        allianceStructures: [
          { id: 'alliance-hq', code: 'HQ', name: 'Quartier Generale', type: 'headquarters', x: 500, y: 500 },
          { id: 'alliance-bear-1', code: 'TRP1', name: 'Trappola per Orsi 1', type: 'beartrap', x: 520, y: 500 },
          { id: 'alliance-bear-2', code: 'TRP2', name: 'Trappola per Orsi 2', type: 'beartrap', x: 480, y: 500 }
        ],
        playerOverrides: {},
        updatedAt: new Date().toISOString()
      });

      alert(`✅ Alleanza [${exactTag}] creata con successo nel Regno ${activeKingdom} (Mappa inclusa)!`);
      setNewTag('');
      setNewName('');
      
      fetchKingdomData();
    } catch (error) {
      console.error(error);
      alert("Errore durante la creazione dell'alleanza.");
    }
    setIsLoading(false);
  };
  return (
    <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl shadow-xl flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <span className="text-3xl">🌍</span>
        <div>
          <h2 className="text-xl font-black text-cyan-400 uppercase tracking-widest">Gestione Regno</h2>
          <p className="text-xs text-slate-400">Esplora i server e gestisci le alleanze registrate.</p>
        </div>
      </div>

      <form onSubmit={fetchKingdomData} className="flex gap-2">
        <input 
          type="number" 
          placeholder="Es. 1115" 
          value={kingdomInput} 
          onChange={(e) => setKingdomInput(e.target.value)}
          className="flex-1 bg-slate-950 border border-slate-700 text-white font-black px-4 py-3 rounded-xl focus:border-cyan-500 outline-none"
        />
        <button type="submit" disabled={isLoading} className="bg-cyan-700 hover:bg-cyan-600 text-white px-6 py-3 rounded-xl font-black uppercase transition-colors">
          {isLoading ? '⏳' : 'Carica'}
        </button>
      </form>

      {activeKingdom && (
        <div className="flex flex-col gap-6 animate-in fade-in duration-300 border-t border-slate-800 pt-6">
          <div className="flex justify-between items-end">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">Alleanze Regno <span className="text-cyan-400 font-black">{activeKingdom}</span></h3>
            <span className="text-xs bg-slate-800 text-slate-300 px-3 py-1 rounded-full font-bold">{alliances.length} Trovate</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-60 overflow-y-auto custom-scrollbar pr-2">
            {alliances.map(ally => (
              <div key={ally.id} className="bg-slate-950 border border-slate-700 p-3 rounded-xl flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-cyan-950 text-cyan-400 font-black text-[10px] flex items-center justify-center rounded-lg border border-cyan-500/30">{ally.tag}</div>
                  <div>
                    <div className="text-sm font-bold text-white">{ally.name}</div>
                    <div className="text-[9px] text-slate-500 uppercase">{ally.id}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-indigo-950/30 border border-indigo-900/50 p-4 rounded-xl">
            <h4 className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-3">➕ Fonda nuova Alleanza nel Regno {activeKingdom}</h4>
            <form onSubmit={handleCreateAlliance} className="flex gap-2 flex-wrap sm:flex-nowrap">
              <input type="text" placeholder="TAG" value={newTag} onChange={(e) => setNewTag(e.target.value)} maxLength={4} className="w-24 bg-slate-900 border border-indigo-900/50 text-white font-bold text-center px-2 py-2 rounded-lg outline-none" />
              <input type="text" placeholder="Nome Alleanza" value={newName} onChange={(e) => setNewName(e.target.value)} className="flex-1 min-w-[200px] bg-slate-900 border border-indigo-900/50 text-white px-3 py-2 rounded-lg outline-none" />
              <button type="submit" disabled={isLoading} className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg font-black uppercase text-xs">Crea</button>
            </form>
          </div>

          <div className="mt-2 border-t border-slate-800 pt-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">🗺️ Mappa Interattiva</h3>
              </div>
              <button onClick={() => navigate(`/kingdom-map/${activeKingdom}`)} className="bg-cyan-700 hover:bg-cyan-600 text-white px-6 py-2.5 rounded-xl font-black uppercase tracking-widest flex items-center gap-2">
                <span>🌍</span> Apri Mappa Globale
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}