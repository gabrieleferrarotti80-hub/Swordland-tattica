import { useNavigate } from 'react-router-dom';
import { RosterTable } from '../components/RosterTable';
import { useState, useRef, useEffect } from 'react';
import { db } from '../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

export default function Home({ roster, setRoster }) {
  const useNavigateInstance = useNavigate();
  const navigate = (path) => useNavigateInstance(path);
  const [isLoadingRoster, setIsLoadingRoster] = useState(false);
  const [isRosterOpen, setIsRosterOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // --- PASSWORD DINAMICHE ---
  const [accessPasswords, setAccessPasswords] = useState({
    master: 'MASTER',
    swordland: 'SWORD',
    viking: 'VIKING'
  });
  const [isLoadingPasswords, setIsLoadingPasswords] = useState(false);

  // --- STATO ACCESSI ---
  const [accessLevels, setAccessLevels] = useState({
    full: sessionStorage.getItem('access_full') === 'true',
    swordland: sessionStorage.getItem('access_swordland') === 'true',
    viking: sessionStorage.getItem('access_viking') === 'true'
  });

  useEffect(() => {
    const fetchPasswords = async () => {
      try {
        const docRef = doc(db, "settings", "accessCodes");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setAccessPasswords(docSnap.data());
        }
      } catch (error) {
        console.error("Errore caricamento password da Firebase:", error);
      }
    };
    fetchPasswords();
  }, []);

  const grantAccess = (type) => {
    const newLevels = { ...accessLevels };
    if (type === 'full') {
      newLevels.full = true;
      newLevels.swordland = true;
      newLevels.viking = true;
      sessionStorage.setItem('access_full', 'true');
      sessionStorage.setItem('access_swordland', 'true');
      sessionStorage.setItem('access_viking', 'true');
    } else if (type === 'swordland') {
      newLevels.swordland = true;
      sessionStorage.setItem('access_swordland', 'true');
    } else if (type === 'viking') {
      newLevels.viking = true;
      sessionStorage.setItem('access_viking', 'true');
    }
    setAccessLevels(newLevels);
  };

  const checkAccess = (moduleName) => {
    if (accessLevels.full) return true;
    if (moduleName === 'swordland' && accessLevels.swordland) return true;
    if (moduleName === 'viking' && accessLevels.viking) return true;
    if (moduleName === 'full' && accessLevels.full) return true;

    const code = window.prompt("Inserisci il codice di accesso:");
    if (code === null) return false;

    const upperCode = code.trim().toUpperCase();

    if (upperCode === accessPasswords.master.toUpperCase()) {
      grantAccess('full');
      alert("👑 Accesso Concesso: COMPLETO (Master)");
      return true;
    } else if (moduleName === 'swordland' && upperCode === accessPasswords.swordland.toUpperCase()) {
      grantAccess('swordland');
      alert("⚔️ Accesso Concesso: SWORDLAND");
      return true;
    } else if (moduleName === 'viking' && upperCode === accessPasswords.viking.toUpperCase()) {
      grantAccess('viking');
      alert("🛡️ Accesso Concesso: VIKING");
      return true;
    } else {
      alert("❌ Codice errato o non autorizzato per questa sezione!");
      return false;
    }
  };

  const handleSavePasswordsToCloud = async () => {
    try {
      setIsLoadingPasswords(true);
      await setDoc(doc(db, "settings", "accessCodes"), accessPasswords);
      alert("✅ Nuovi codici di accesso salvati con successo su Firebase!");
    } catch (error) {
      console.error("Errore salvataggio password:", error);
      alert("❌ Errore durante il salvataggio dei codici.");
    } finally {
      setIsLoadingPasswords(false);
    }
  };

  const handleRosterClick = () => {
    if (checkAccess('full')) setIsRosterOpen(true);
  };

  const handleMapClick = () => {
    if (checkAccess('full')) navigate('/map');
  };

  const handleSwordlandClick = () => {
    if (checkAccess('swordland')) navigate('/swordland');
  };

  const handleVikingClick = () => {
    if (checkAccess('viking')) navigate('/viking');
  };

  const handleSettingsOpenClick = () => {
    if (checkAccess('full')) {
      setIsSettingsOpen(true);
    }
  };

  const importRosterRef = useRef(null);

  const handleAddPlayer = (playerData) => setRoster(prev => [...prev, { id: `player-${Date.now()}`, ...playerData }]);
  const handleEditPlayer = (id, field, value) => setRoster(prev => prev.map(player => player.id === id ? { ...player, [field]: value } : player));
  const handleDeletePlayer = (id) => setRoster(prev => prev.filter(player => player.id !== id));

  const handleImportRosterJson = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedRoster = JSON.parse(e.target.result);
        if (Array.isArray(importedRoster)) {
          if (window.confirm("Vuoi sostituire/aggiornare il roster attuale con i dati di questo file JSON?")) {
            const rosterWithIds = importedRoster.map((player, index) => ({
              ...player,
              id: player.id || `player-${Date.now()}-${index}`,
              power: Number(player.power) || 0,
              marches: Number(player.marches) || 4,
              isParticipating: player.isParticipating ?? true
            }));
            setRoster(rosterWithIds);
            alert("✅ Roster importato con successo!");
          }
        } else {
          alert("❌ Errore: Il file JSON non è valido.");
        }
      } catch (error) {
        alert("❌ Errore durante la lettura del file.");
      }
      event.target.value = '';
    };
    reader.readAsText(file);
  };

  const handleSaveRosterToCloud = async () => {
    const code = window.prompt("Inserisci il Codice Alleanza per SALVARE il Roster:");
    if (code) {
      try { 
        await setDoc(doc(db, "rosters", code.toUpperCase()), { players: roster }); 
        alert("Roster salvato in Cloud."); 
      } catch (error) { 
        alert("Errore durante il salvataggio."); 
      }
    }
  };

  const handleLoadRosterFromCloud = async () => {
    const code = window.prompt("Inserisci il Codice Alleanza per CARICARE il Roster:");
    if (code) {
      try { 
        setIsLoadingRoster(true); 
        const docSnap = await getDoc(doc(db, "rosters", code.toUpperCase())); 
        if (docSnap.exists()) setRoster(docSnap.data().players || []); 
        else alert("Nessun Roster trovato."); 
      } catch (error) { 
        alert("Errore durante il caricamento."); 
      } finally { 
        setIsLoadingRoster(false); 
      }
    }
  };

  return (
    <div className="h-screen bg-slate-950 p-4 flex flex-col gap-4 overflow-hidden select-none">
      
      {/* HEADER COMPATTO E FISSO NELLA SCHERMATA */}
      <header className="flex justify-between items-center bg-slate-900/60 px-6 py-4 rounded-2xl border border-slate-800 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-black text-white tracking-wider">HUB <span className="text-cyan-400">KINGSHOT</span></h1>
          {accessLevels.full && (
            <button 
              onClick={handleSettingsOpenClick}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-rose-400 text-xs font-bold rounded-lg border border-rose-900/50 transition-colors flex items-center gap-1.5 shadow"
              title="Pannello Gestione Accessi"
            >
              <span>⚙️</span> Gestione Password
            </button>
          )}
        </div>

        <div className="flex gap-3 items-center flex-wrap">
          <button 
            onClick={handleRosterClick} 
            className="px-4 py-2.5 bg-cyan-700 hover:bg-cyan-600 text-white font-bold text-sm rounded-xl shadow-lg transition-all flex items-center gap-2 border border-cyan-500"
          >
            <span>👥</span> Gestione Roster Alleanza
          </button>

          <button 
            onClick={handleMapClick} 
            className="px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white font-bold text-sm rounded-xl shadow-lg transition-all flex items-center gap-2"
          >
            🗺️ Mappa
          </button>

          <button 
            onClick={handleSwordlandClick} 
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm rounded-xl shadow-lg transition-all"
          >
            ⚔️ Simulatore Swordland
          </button>
          
          <button 
            onClick={handleVikingClick} 
            className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm rounded-xl shadow-lg transition-all"
          >
            🛡️ Analizzatore Viking
          </button>
        </div>
      </header>

      {/* MAIN CONTENT CHE OCCUPA ESATTAMENTE LO SPAZIO RIMASTO SENZA SCROLL */}
      <main 
        className="flex-1 rounded-2xl border border-slate-800 transition-all duration-300 relative overflow-hidden shadow-2xl bg-slate-900 flex flex-col"
        style={{ 
          backgroundImage: "url('/dashboard.png')", 
          backgroundSize: '100% 100%', 
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        {/* Overlay scuro leggero per contrasto */}
        <div className="absolute inset-0 bg-slate-950/20 pointer-events-none"></div>

        <div className="relative z-10 p-6 h-full w-full flex flex-col justify-end">
          {isSettingsOpen ? (
            
            /* PANNELLO IMPOSTAZIONI ACCESSI */
            <div className="flex flex-col h-full bg-slate-900/95 backdrop-blur-md p-6 rounded-2xl border border-rose-900/40 animate-in fade-in duration-300 overflow-y-auto">
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setIsSettingsOpen(false)} 
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg border border-slate-600 transition-colors"
                  >
                    ⬅ Torna Indietro
                  </button>
                  <h2 className="text-xl font-bold text-rose-400">⚙️ Pannello Gestione Codici di Accesso</h2>
                </div>
                <button 
                  onClick={handleSavePasswordsToCloud}
                  disabled={isLoadingPasswords}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs rounded-lg shadow transition-colors disabled:opacity-50"
                >
                  {isLoadingPasswords ? "Salvataggio..." : "☁️ Salva Nuovi Codici in Cloud"}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl">
                <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 flex flex-col gap-2">
                  <label className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Codice Master (Completo)</label>
                  <p className="text-[11px] text-slate-400">Dà accesso a Roster, Mappa e tutti i simulatori.</p>
                  <input 
                    type="text" 
                    value={accessPasswords.master}
                    onChange={(e) => setAccessPasswords(prev => ({ ...prev, master: e.target.value }))}
                    className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white font-bold focus:outline-none focus:border-cyan-500 mt-2"
                  />
                </div>

                <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 flex flex-col gap-2">
                  <label className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Codice Swordland</label>
                  <p className="text-[11px] text-slate-400">Dà accesso esclusivo al simulatore Swordland.</p>
                  <input 
                    type="text" 
                    value={accessPasswords.swordland}
                    onChange={(e) => setAccessPasswords(prev => ({ ...prev, swordland: e.target.value }))}
                    className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white font-bold focus:outline-none focus:border-indigo-500 mt-2"
                  />
                </div>

                <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 flex flex-col gap-2">
                  <label className="text-xs font-bold text-amber-400 uppercase tracking-wider">Codice Viking</label>
                  <p className="text-[11px] text-slate-400">Dà accesso esclusivo all'analizzatore Viking.</p>
                  <input 
                    type="text" 
                    value={accessPasswords.viking}
                    onChange={(e) => setAccessPasswords(prev => ({ ...prev, viking: e.target.value }))}
                    className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white font-bold focus:outline-none focus:border-amber-500 mt-2"
                  />
                </div>
              </div>
            </div>

          ) : !isRosterOpen ? (
            
            /* SCHERMATA HOME IN BASSO A SINISTRA */
            <div className="flex flex-col items-start justify-end h-full gap-2 text-left pb-6">
              <h2 className="text-3xl font-extrabold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">Benvenuto nella Dashboard dell'Alleanza</h2>
              <p className="text-slate-100 max-w-lg text-base drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                Da qui potrai accedere a tutti gli strumenti strategici. Gestisci il roster o esplora i simulatori strategici dall'header in alto.
              </p>
            </div>

          ) : (

            /* SCHERMATA GESTIONE ROSTER */
            <div className="flex flex-col h-full bg-slate-950/90 backdrop-blur-sm p-6 rounded-2xl overflow-y-auto animate-in fade-in duration-300">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setIsRosterOpen(false)} 
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white text-sm font-bold rounded-lg border border-slate-600 flex items-center transition-colors shadow-lg"
                  >
                    ⬅ Torna alla Dashboard
                  </button>
                  <h2 className="text-xl font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">Database Giocatori</h2>
                </div>
                
                {/* PULSANTI GESTIONE CLOUD E JSON */}
                <div className="flex gap-2 items-center flex-wrap">
                  <input 
                    type="file" 
                    accept=".json" 
                    ref={importRosterRef} 
                    onChange={handleImportRosterJson} 
                    style={{ display: 'none' }} 
                  />
                  <button 
                    onClick={() => importRosterRef.current.click()} 
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-bold rounded-lg border border-emerald-500 transition-colors shadow-lg"
                  >
                    📥 Importa JSON
                  </button>

                  <button onClick={handleLoadRosterFromCloud} className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-cyan-400 text-sm font-bold rounded-lg border border-slate-600 transition-colors shadow-lg">⬇️ Carica da Cloud</button>
                  <button onClick={handleSaveRosterToCloud} className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-amber-400 text-sm font-bold rounded-lg border border-slate-600 transition-colors shadow-lg">☁️ Salva in Cloud</button>
                </div>
              </div>
              
              {isLoadingRoster ? (
                <div className="text-center text-white py-10 animate-pulse font-bold text-lg drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">Caricamento database in corso...</div>
              ) : (
                <RosterTable 
                  roster={roster} 
                  onAddPlayer={handleAddPlayer} 
                  onEdit={handleEditPlayer} 
                  onDelete={handleDeletePlayer} 
                  onDeploy={() => navigate('/swordland')}
                />
              )}
            </div>

          )}
        </div>
      </main>
    </div>
  );
}