import { useNavigate } from 'react-router-dom';
import { RosterTable } from '../components/RosterTable';
import { useState, useRef, useEffect } from 'react';
import { db } from '../firebase';
import { doc, setDoc, getDoc, collection, getDocs } from 'firebase/firestore';

// IMPORTA IL ROSTER FITTIZIO
import { demoRoster } from '../data/demoRoster';

export default function Home({ roster, setRoster, userRole, setUserRole, allianceCode, setAllianceCode }) {
  const navigate = useNavigate();
  
  const [isRosterOpen, setIsRosterOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginKingdom, setLoginKingdom] = useState('');
  const [loginTag, setLoginTag] = useState('');
  const [isLoadingLogin, setIsLoadingLogin] = useState(false);
  
  const [hubView, setHubView] = useState('main');

  const [allianceList, setAllianceList] = useState([]);
  const [selectedAdminAlliance, setSelectedAdminAlliance] = useState('');

  const [accessPasswords, setAccessPasswords] = useState({
    master: 'MASTER'
  });
  const [isLoadingPasswords, setIsLoadingPasswords] = useState(false);

  useEffect(() => {
    const fetchPasswords = async () => {
      try {
        const docRef = doc(db, "settings", "accessCodes");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) setAccessPasswords(docSnap.data());
      } catch (error) { console.error("Errore caricamento password:", error); }
    };
    fetchPasswords();
  }, []);

  useEffect(() => {
    if (userRole === 'admin') {
      const fetchAlliances = async () => {
        try {
          const querySnapshot = await getDocs(collection(db, "rosters"));
          const alliances = querySnapshot.docs.map(doc => doc.id).filter(id => id !== 'ADMIN');
          setAllianceList(alliances);
          if (alliances.length > 0) setSelectedAdminAlliance(alliances[0]);
        } catch (error) { console.error("Errore caricamento alleanze:", error); }
      };
      fetchAlliances();
    }
  }, [userRole]);

  // ==========================================
  // LOGICA DI LOGIN (Incluso il Guest "DEMO")
  // ==========================================
  const handleLogin = async () => {
    const tag = loginTag.trim().toUpperCase();
    const kingdom = loginKingdom.trim();
    
    if (!tag) return;
    
    setIsLoadingLogin(true);

    if (tag === accessPasswords.master.toUpperCase()) {
      // ADMIN
      setUserRole('admin');
      setAllianceCode('ADMIN');
      setIsLoginModalOpen(false);
      setLoginTag('');
      setLoginKingdom('');
    } else if (tag === 'DEMO') {
      // OSPITE (Sandbox)
      setUserRole('guest');
      setAllianceCode('DEMO');
      setRoster(demoRoster); // Carica i dati fittizi
      setIsLoginModalOpen(false);
      setLoginTag('');
      setLoginKingdom('');
    } else {
      // ALLEANZA REALE
      if (!kingdom) {
        alert("Inserisci il numero del Regno!");
        setIsLoadingLogin(false);
        return;
      }

      const fullAllianceId = `${kingdom}_${tag}`;

      try {
        const docSnap = await getDoc(doc(db, "rosters", fullAllianceId));
        if (docSnap.exists()) {
          setRoster(docSnap.data().players || []);
        } else {
          setRoster([]); 
        }
        setUserRole('alliance');
        setAllianceCode(fullAllianceId);
        setIsLoginModalOpen(false);
        setLoginTag('');
        setLoginKingdom('');
      } catch (error) {
        alert("Errore di connessione al database.");
      }
    }
    setIsLoadingLogin(false);
  };

  const handleLogout = () => {
    setUserRole(null);
    setAllianceCode('');
    setRoster([]);
    setHubView('main');
  };

  const checkAccess = (moduleName) => {
    if (userRole === 'admin') return true; 
    if (moduleName === 'swordland') return true; 
    
    if (moduleName === 'viking') {
      if (userRole === 'guest') {
         alert("📊 Modalità Ospite: Il Centro Viking è accessibile in sola lettura per farti esplorare le funzionalità.");
         return true; // Fa entrare l'ospite ma lo avvisa
      }
      alert("⛔ Accesso Negato: Il Centro Viking è riservato al Master o agli analisti autorizzati.");
      return false;
    }
    
    return true;
  };

  const handleLoadAllianceAsAdmin = async (code) => {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) return;
    
    setIsLoadingLogin(true);
    try {
      const docSnap = await getDoc(doc(db, "rosters", cleanCode));
      if (docSnap.exists()) {
        setRoster(docSnap.data().players || []);
        alert(`✅ Dati [${cleanCode}] caricati!`);
      } else {
        setRoster([]);
        alert(`⚠️ Alleanza [${cleanCode}] non trovata.`);
      }
      setAllianceCode(cleanCode); 
    } catch (error) { alert("❌ Errore caricamento."); }
    setIsLoadingLogin(false);
  };

  const handleSaveRosterToCloud = async () => {
    if (!allianceCode || allianceCode === 'ADMIN' || userRole === 'guest') return;
    try { 
      await setDoc(doc(db, "rosters", allianceCode), { players: roster }); 
      alert("✅ Roster sincronizzato in Cloud."); 
    } catch (error) { alert("❌ Errore salvataggio."); }
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
          if (window.confirm("Sostituire il roster attuale?")) {
            const rosterWithIds = importedRoster.map((player, index) => ({
              ...player, id: player.id || `player-${Date.now()}-${index}`, power: Number(player.power) || 0, marches: Number(player.marches) || 4, isParticipating: player.isParticipating ?? true
            }));
            setRoster(rosterWithIds);
            alert("✅ Roster importato!");
          }
        }
      } catch (error) { alert("❌ Errore JSON."); }
      event.target.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <div className="h-screen bg-slate-950 p-2 md:p-4 flex flex-col gap-2 md:gap-4 overflow-hidden select-none">
      <style>{`
        .hide-scroll::-webkit-scrollbar { display: none; }
        .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
      
      {/* HEADER */}
      <header className="flex justify-between items-center bg-slate-900/40 backdrop-blur-xl px-4 md:px-6 py-3 md:py-4 rounded-xl md:rounded-2xl border border-white/5 shadow-[0_8px_30px_rgb(0,0,0,0.3)] shrink-0 z-20">
        <div className="flex items-center gap-2 md:gap-4">
          <h1 className="text-xl md:text-2xl font-black text-white tracking-wider cursor-pointer flex items-center gap-2 drop-shadow-md hover:text-cyan-100 transition-colors" onClick={() => setHubView('main')}>
            <span className="text-cyan-500 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]">❖</span> 
            <span className="hidden sm:inline">HUB</span> <span className="text-cyan-400">KINGSHOT</span>
          </h1>
        </div>
        <div className="flex gap-2 md:gap-3">
          {!userRole ? (
             <button onClick={() => setIsLoginModalOpen(true)} className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] md:text-xs font-black uppercase tracking-wider rounded-lg md:rounded-xl border border-cyan-400/50 transition-all shadow-[0_0_15px_rgba(8,145,178,0.4)]">
               Accedi
             </button>
          ) : (
            <>
              {userRole === 'admin' && (
                <button onClick={() => setIsSettingsOpen(true)} className="px-3 md:px-4 py-1.5 md:py-2 bg-rose-950/30 hover:bg-rose-900/50 text-rose-400 text-[10px] md:text-xs font-bold rounded-lg md:rounded-xl border border-rose-500/20 transition-all flex items-center gap-1.5 md:gap-2 backdrop-blur-sm shadow-[0_0_15px_rgba(225,29,72,0.1)] hover:shadow-[0_0_15px_rgba(225,29,72,0.3)]">
                  <span>⚙️</span> <span className="hidden sm:inline">Pannello Master</span>
                </button>
              )}
              <div className="flex items-center gap-3 bg-slate-900/50 px-3 py-1.5 md:px-4 md:py-2 rounded-lg md:rounded-xl border border-white/10 backdrop-blur-sm">
                <span className="text-slate-400 text-[10px] md:text-xs font-bold uppercase hidden sm:inline">
                  {userRole === 'admin' ? '👑 Master' : userRole === 'guest' ? '👀 Ospite' : `🛡️ Alleanza: ${allianceCode}`}
                </span>
                <div className="w-[1px] h-4 bg-slate-700 hidden sm:block"></div>
                <button onClick={handleLogout} className="text-rose-400 hover:text-rose-300 text-[10px] md:text-xs font-bold transition-colors">
                  Logout
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 rounded-xl md:rounded-2xl border border-slate-800/80 transition-all duration-300 relative overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.6)] bg-[#090e17] flex flex-col">
        
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: 'linear-gradient(#38bdf8 1px, transparent 1px), linear-gradient(90deg, #38bdf8 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
          <div className="absolute -top-[30%] -left-[10%] w-[70%] h-[70%] bg-cyan-600/15 rounded-full blur-[140px]"></div>
          <div className="absolute top-[10%] -right-[20%] w-[60%] h-[60%] bg-indigo-600/15 rounded-full blur-[140px]"></div>
          <div className="absolute -bottom-[40%] left-[20%] w-[60%] h-[60%] bg-rose-600/10 rounded-full blur-[140px]"></div>
        </div>

        <div className="relative z-10 p-4 md:p-6 h-full w-full flex flex-col overflow-y-auto hide-scroll">
          
          {/* MODALE DI LOGIN */}
          {isLoginModalOpen && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
              <div className="bg-slate-900/95 border border-white/10 p-8 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col items-center gap-6 w-full max-w-sm animate-in zoom-in-95 duration-200">
                <div className="w-16 h-16 bg-cyan-950 border border-cyan-500/50 rounded-2xl flex items-center justify-center text-3xl shadow-[0_0_20px_rgba(8,145,178,0.3)]">
                  🔐
                </div>
                <div className="text-center">
                  <h3 className="text-2xl font-black text-white">Accesso al Sistema</h3>
                  <p className="text-xs text-slate-400 mt-2">Inserisci Regno e Tag, prova la Demo o usa la Master Key.</p>
                </div>
                
                <div className="flex gap-2 w-full">
                  <input 
                    type="number" 
                    placeholder="Regno" 
                    value={loginKingdom}
                    onChange={(e) => setLoginKingdom(e.target.value)}
                    className="w-1/3 bg-slate-950 border border-slate-700 rounded-xl px-3 py-3 text-center text-white font-black focus:outline-none focus:border-cyan-500 shadow-inner hide-scroll"
                  />
                  <input 
                    type="text" 
                    placeholder="Tag o DEMO" 
                    value={loginTag}
                    onChange={(e) => setLoginTag(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                    className="w-2/3 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-center text-white font-black tracking-widest uppercase focus:outline-none focus:border-cyan-500 shadow-inner"
                  />
                </div>

                <div className="flex flex-col gap-3 w-full">
                  <button onClick={handleLogin} disabled={isLoadingLogin || !loginTag} className="w-full py-3.5 bg-cyan-600 hover:bg-cyan-500 text-white font-black rounded-xl transition-colors text-sm shadow-[0_0_15px_rgba(8,145,178,0.4)] disabled:opacity-50">
                    {isLoadingLogin ? 'Verifica in corso...' : 'Entra / Crea Alleanza'}
                  </button>
                </div>

                <button onClick={() => setIsLoginModalOpen(false)} className="text-slate-500 hover:text-slate-300 text-xs font-bold transition-colors mt-1">
                  Annulla
                </button>
              </div>
            </div>
          )}

          {isSettingsOpen && userRole === 'admin' ? (
            /* PANNELLO MASTER */
            <div className="flex flex-col w-full max-w-5xl mx-auto bg-slate-900/80 backdrop-blur-xl p-4 md:p-8 rounded-2xl md:rounded-3xl border border-rose-900/40 border-t-rose-500/30 animate-in fade-in zoom-in-95 duration-300 shadow-[0_20px_50px_rgba(0,0,0,0.5)] mt-4 md:mt-10">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 md:mb-6 pb-4 border-b border-slate-700/50">
                <div className="flex items-center gap-3">
                  <button onClick={() => setIsSettingsOpen(false)} className="px-3 py-1.5 md:px-4 md:py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg md:rounded-xl border border-white/5 transition-colors shadow-inner">⬅ Indietro</button>
                  <h2 className="text-lg md:text-xl font-bold text-rose-400">⚙️ Pannello Master</h2>
                </div>
                <button onClick={async () => {
                  try {
                    setIsLoadingPasswords(true);
                    await setDoc(doc(db, "settings", "accessCodes"), accessPasswords);
                    alert("✅ Master Key salvata in Cloud!");
                  } catch(e) { alert("Errore salvataggio"); } finally { setIsLoadingPasswords(false); }
                }} disabled={isLoadingPasswords} className="w-full sm:w-auto px-5 py-2 md:py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-lg md:rounded-xl shadow-lg transition-colors">
                  {isLoadingPasswords ? "Salvataggio..." : "☁️ Salva Chiave"}
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-700/50 flex flex-col gap-2 shadow-inner">
                  <h3 className="text-sm font-black text-white mb-2">🔑 Chiave di Amministrazione</h3>
                  <label className="text-[10px] md:text-xs font-bold text-cyan-400 uppercase tracking-wider">Master Key</label>
                  <input type="text" value={accessPasswords.master} onChange={(e) => setAccessPasswords(prev => ({ ...prev, master: e.target.value }))} className="bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-sm text-white font-bold focus:outline-none focus:border-cyan-500 mt-1 shadow-inner"/>
                  <p className="text-xs text-slate-500 mt-2">Questa password ti garantisce l'accesso illimitato a tutti i moduli e ai database delle alleanze.</p>
                </div>
              </div>
            </div>

          ) : !isRosterOpen ? (
            
            /* DASHBOARD CENTRALE */
            <div className="flex-1 flex flex-col items-center justify-center py-4">
              
              {userRole ? (
                <div className="w-full max-w-6xl flex flex-col items-center animate-in fade-in zoom-in-95 duration-500">
                  
                  <div className="flex flex-col items-center gap-3 md:gap-4 mb-8 md:mb-14 text-center">
                    <div className="inline-flex items-center gap-2 md:gap-3 px-4 py-1.5 md:px-6 md:py-2.5 rounded-full bg-slate-900/60 border border-slate-700/80 text-slate-300 text-[10px] md:text-xs font-bold shadow-2xl backdrop-blur-xl">
                      <span className="relative flex h-2 w-2 md:h-3 md:w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 md:h-3 md:w-3 bg-emerald-500 shadow-[0_0_10px_#10b981]"></span>
                      </span>
                      SISTEMA ONLINE <span className="text-slate-600 hidden sm:inline">|</span> 
                      <span className="hidden sm:inline">PROFILO:</span> 
                      <span className="text-cyan-400 font-black">{userRole === 'admin' ? 'MASTER' : userRole === 'guest' ? 'GUEST (SANDBOX)' : allianceCode}</span>
                    </div>
                    <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-white tracking-tight drop-shadow-[0_4px_20px_rgba(0,0,0,0.8)] px-2">
                      {hubView === 'main' ? 'Pannello di Controllo' : hubView === 'events' ? 'Simulazioni Tattiche' : 'Gestione Territoriale'}
                    </h2>
                  </div>

                  {/* CONSOLE CONSULENTE (Visibile solo all'Admin) */}
                  {userRole === 'admin' && (
                    <div className="w-full max-w-4xl bg-rose-950/40 border border-rose-500/30 p-5 rounded-2xl mb-8 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg backdrop-blur-md">
                      <div className="text-left">
                        <h3 className="text-rose-400 font-black text-lg flex items-center gap-2">👑 Console Consulente</h3>
                        <p className="text-slate-400 text-xs mt-1">Seleziona un'alleanza per caricare il suo Roster e i suoi Piani Tattici.</p>
                      </div>
                      <div className="flex w-full sm:w-auto gap-2">
                        <select 
                          value={selectedAdminAlliance} 
                          onChange={(e) => setSelectedAdminAlliance(e.target.value)}
                          className="w-full sm:w-40 bg-slate-900 border border-rose-900/50 rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:border-rose-500 cursor-pointer"
                        >
                          {allianceList.length === 0 ? (
                            <option value="" disabled>Nessuna trovata</option>
                          ) : (
                            allianceList.map(tag => (
                              <option key={tag} value={tag}>{tag}</option>
                            ))
                          )}
                        </select>
                        <button 
                          onClick={() => handleLoadAllianceAsAdmin(selectedAdminAlliance)}
                          disabled={!selectedAdminAlliance}
                          className="px-5 py-2 bg-rose-700 hover:bg-rose-600 disabled:bg-slate-800 disabled:text-slate-500 text-white font-black text-xs uppercase rounded-xl transition-colors shadow-lg whitespace-nowrap"
                        >
                          Carica
                        </button>
                      </div>
                    </div>
                  )}

                  {/* CARTE DEL MENU PRINCIPALE */}
                  {hubView === 'main' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-8 w-full px-2 md:px-8">
                      <button onClick={() => navigate('/map', { state: { initialView: 'global' }})} className="group relative overflow-hidden flex flex-col items-center justify-center py-8 lg:py-12 px-4 lg:px-8 bg-gradient-to-b from-slate-800/50 to-slate-900/90 backdrop-blur-xl border border-slate-700/50 border-t-white/10 hover:border-cyan-500/50 rounded-2xl lg:rounded-[2rem] transition-all duration-500 hover:-translate-y-1 lg:hover:-translate-y-2 shadow-[0_10px_30px_rgba(0,0,0,0.5)] hover:shadow-[0_20px_50px_-10px_rgba(8,145,178,0.5)]">
                        <div className="absolute top-0 left-1/4 w-1/2 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent"></div>
                        <div className="relative mb-4 lg:mb-6">
                          <div className="absolute inset-0 bg-cyan-500/20 blur-xl lg:blur-2xl rounded-full group-hover:bg-cyan-500/40 transition-colors duration-500"></div>
                          <div className="w-16 h-16 lg:w-24 lg:h-24 rounded-2xl lg:rounded-3xl bg-slate-800/80 border border-slate-600/50 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 shadow-inner group-hover:border-cyan-500/50 relative z-10">
                            <span className="text-3xl lg:text-5xl drop-shadow-lg">🌍</span>
                          </div>
                        </div>
                        <span className="text-xl lg:text-2xl font-black text-white tracking-wider relative z-10 text-center">Mappa Globale</span>
                        <span className="text-xs lg:text-base text-slate-400 mt-1 lg:mt-2 relative z-10 font-medium text-center">Esplora territori e database</span>
                      </button>

                      <button onClick={() => setHubView('events')} className="group relative overflow-hidden flex flex-col items-center justify-center py-8 lg:py-12 px-4 lg:px-8 bg-gradient-to-b from-slate-800/50 to-slate-900/90 backdrop-blur-xl border border-slate-700/50 border-t-white/10 hover:border-rose-500/50 rounded-2xl lg:rounded-[2rem] transition-all duration-500 hover:-translate-y-1 lg:hover:-translate-y-2 shadow-[0_10px_30px_rgba(0,0,0,0.5)] hover:shadow-[0_20px_50px_-10px_rgba(225,29,72,0.5)]">
                        <div className="absolute top-0 left-1/4 w-1/2 h-[1px] bg-gradient-to-r from-transparent via-rose-500/50 to-transparent"></div>
                        <div className="relative mb-4 lg:mb-6">
                          <div className="absolute inset-0 bg-rose-500/20 blur-xl lg:blur-2xl rounded-full group-hover:bg-rose-500/40 transition-colors duration-500"></div>
                          <div className="w-16 h-16 lg:w-24 lg:h-24 rounded-2xl lg:rounded-3xl bg-slate-800/80 border border-slate-600/50 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 shadow-inner group-hover:border-rose-500/50 relative z-10">
                            <span className="text-3xl lg:text-5xl drop-shadow-lg">⚔️</span>
                          </div>
                        </div>
                        <span className="text-xl lg:text-2xl font-black text-white tracking-wider relative z-10 text-center">Eventi & Tattica</span>
                        <span className="text-xs lg:text-base text-slate-400 mt-1 lg:mt-2 relative z-10 font-medium text-center">Simulatori di battaglie e ordini</span>
                      </button>

                      <button onClick={() => setHubView('alliance')} className="group relative overflow-hidden flex flex-col items-center justify-center py-8 lg:py-12 px-4 lg:px-8 bg-gradient-to-b from-slate-800/50 to-slate-900/90 backdrop-blur-xl border border-slate-700/50 border-t-white/10 hover:border-indigo-500/50 rounded-2xl lg:rounded-[2rem] transition-all duration-500 hover:-translate-y-1 lg:hover:-translate-y-2 shadow-[0_10px_30px_rgba(0,0,0,0.5)] hover:shadow-[0_20px_50px_-10px_rgba(79,70,229,0.5)]">
                        <div className="absolute top-0 left-1/4 w-1/2 h-[1px] bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent"></div>
                        <div className="relative mb-4 lg:mb-6">
                          <div className="absolute inset-0 bg-indigo-500/20 blur-xl lg:blur-2xl rounded-full group-hover:bg-indigo-500/40 transition-colors duration-500"></div>
                          <div className="w-16 h-16 lg:w-24 lg:h-24 rounded-2xl lg:rounded-3xl bg-slate-800/80 border border-slate-600/50 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 shadow-inner group-hover:border-indigo-500/50 relative z-10">
                            <span className="text-3xl lg:text-5xl drop-shadow-lg">🛡️</span>
                          </div>
                        </div>
                        <span className="text-xl lg:text-2xl font-black text-white tracking-wider relative z-10 text-center">Alleanza</span>
                        <span className="text-xs lg:text-base text-slate-400 mt-1 lg:mt-2 relative z-10 font-medium text-center">Gestione Roster e Territorio</span>
                      </button>

                      <button onClick={() => { if(checkAccess('viking')) navigate('/viking'); }} className="group relative overflow-hidden flex flex-col items-center justify-center py-8 lg:py-12 px-4 lg:px-8 bg-gradient-to-b from-slate-800/50 to-slate-900/90 backdrop-blur-xl border border-slate-700/50 border-t-white/10 hover:border-amber-500/50 rounded-2xl lg:rounded-[2rem] transition-all duration-500 hover:-translate-y-1 lg:hover:-translate-y-2 shadow-[0_10px_30px_rgba(0,0,0,0.5)] hover:shadow-[0_20px_50px_-10px_rgba(245,158,11,0.5)]">
                        <div className="absolute top-0 left-1/4 w-1/2 h-[1px] bg-gradient-to-r from-transparent via-amber-500/50 to-transparent"></div>
                        <div className="relative mb-4 lg:mb-6">
                          <div className="absolute inset-0 bg-amber-500/20 blur-xl lg:blur-2xl rounded-full group-hover:bg-amber-500/40 transition-colors duration-500"></div>
                          <div className="w-16 h-16 lg:w-24 lg:h-24 rounded-2xl lg:rounded-3xl bg-slate-800/80 border border-slate-600/50 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 shadow-inner group-hover:border-amber-500/50 relative z-10">
                            <span className="text-3xl lg:text-5xl drop-shadow-lg">📊</span>
                          </div>
                        </div>
                        <span className="text-xl lg:text-2xl font-black text-white tracking-wider relative z-10 text-center">Centro Viking</span>
                        <span className="text-xs lg:text-base text-slate-400 mt-1 lg:mt-2 relative z-10 font-medium text-center">Analisi, statistiche e backtest</span>
                      </button>
                    </div>
                  )}

                  {hubView === 'events' && (
                    <div className="flex flex-col w-full px-2 md:px-8 gap-4 lg:gap-8 animate-in slide-in-from-right-8 duration-300">
                      <button onClick={() => setHubView('main')} className="text-slate-400 hover:text-white font-bold text-[10px] md:text-xs uppercase tracking-wider mb-2 text-left w-fit flex items-center gap-2 md:gap-3 px-4 md:px-6 py-2 md:py-3 border border-slate-700/80 bg-slate-900/60 backdrop-blur-md rounded-full transition-colors hover:bg-slate-800 hover:border-slate-500">⬅ Torna al Menu</button>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-8 w-full">
                        <button onClick={() => navigate('/map', { state: { initialView: 'tactical' }})} className="group relative overflow-hidden flex flex-col items-center justify-center py-8 lg:py-12 px-4 lg:px-8 bg-gradient-to-b from-slate-800/50 to-slate-900/90 backdrop-blur-xl border border-slate-700/50 border-t-white/10 hover:border-rose-500/50 rounded-2xl lg:rounded-[2rem] transition-all duration-500 hover:-translate-y-1 lg:hover:-translate-y-2 shadow-[0_10px_30px_rgba(0,0,0,0.5)] hover:shadow-[0_20px_50px_-10px_rgba(225,29,72,0.5)]">
                          <div className="absolute top-0 left-1/4 w-1/2 h-[1px] bg-gradient-to-r from-transparent via-rose-500/50 to-transparent"></div>
                          <div className="relative mb-4 lg:mb-6">
                            <div className="absolute inset-0 bg-rose-500/20 blur-xl lg:blur-2xl rounded-full group-hover:bg-rose-500/40 transition-colors duration-500"></div>
                            <div className="w-16 h-16 lg:w-24 lg:h-24 rounded-2xl lg:rounded-3xl bg-slate-800/80 border border-slate-600/50 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 shadow-inner group-hover:border-rose-500/50 relative z-10">
                              <span className="text-3xl lg:text-5xl drop-shadow-lg">🎯</span>
                            </div>
                          </div>
                          <span className="text-xl lg:text-2xl font-black text-white tracking-wider relative z-10 text-center">Sala Tattica</span>
                          <span className="text-xs lg:text-base text-slate-400 mt-1 lg:mt-2 relative z-10 font-medium text-center">Pianificazione su mappa globale</span>
                        </button>
                        <button onClick={() => { if(checkAccess('swordland')) navigate('/swordland'); }} className="group relative overflow-hidden flex flex-col items-center justify-center py-8 lg:py-12 px-4 lg:px-8 bg-gradient-to-b from-slate-800/50 to-slate-900/90 backdrop-blur-xl border border-slate-700/50 border-t-white/10 hover:border-orange-500/50 rounded-2xl lg:rounded-[2rem] transition-all duration-500 hover:-translate-y-1 lg:hover:-translate-y-2 shadow-[0_10px_30px_rgba(0,0,0,0.5)] hover:shadow-[0_20px_50px_-10px_rgba(249,115,22,0.5)]">
                          <div className="absolute top-0 left-1/4 w-1/2 h-[1px] bg-gradient-to-r from-transparent via-orange-500/50 to-transparent"></div>
                          <div className="relative mb-4 lg:mb-6">
                            <div className="absolute inset-0 bg-orange-500/20 blur-xl lg:blur-2xl rounded-full group-hover:bg-orange-500/40 transition-colors duration-500"></div>
                            <div className="w-16 h-16 lg:w-24 lg:h-24 rounded-2xl lg:rounded-3xl bg-slate-800/80 border border-slate-600/50 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 shadow-inner group-hover:border-orange-500/50 relative z-10">
                              <span className="text-3xl lg:text-5xl drop-shadow-lg">🏰</span>
                            </div>
                          </div>
                          <span className="text-xl lg:text-2xl font-black text-white tracking-wider relative z-10 text-center">Swordland</span>
                          <span className="text-xs lg:text-base text-slate-400 mt-1 lg:mt-2 relative z-10 font-medium text-center">Simulatore di marce 60 min.</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {hubView === 'alliance' && (
                    <div className="flex flex-col w-full px-2 md:px-8 gap-4 lg:gap-8 animate-in slide-in-from-right-8 duration-300">
                      <button onClick={() => setHubView('main')} className="text-slate-400 hover:text-white font-bold text-[10px] md:text-xs uppercase tracking-wider mb-2 text-left w-fit flex items-center gap-2 md:gap-3 px-4 md:px-6 py-2 md:py-3 border border-slate-700/80 bg-slate-900/60 backdrop-blur-md rounded-full transition-colors hover:bg-slate-800 hover:border-slate-500">⬅ Torna al Menu</button>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-8 w-full">
                        <button onClick={() => setIsRosterOpen(true)} className="group relative overflow-hidden flex flex-col items-center justify-center py-8 lg:py-12 px-4 lg:px-8 bg-gradient-to-b from-slate-800/50 to-slate-900/90 backdrop-blur-xl border border-slate-700/50 border-t-white/10 hover:border-indigo-500/50 rounded-2xl lg:rounded-[2rem] transition-all duration-500 hover:-translate-y-1 lg:hover:-translate-y-2 shadow-[0_10px_30px_rgba(0,0,0,0.5)] hover:shadow-[0_20px_50px_-10px_rgba(79,70,229,0.5)]">
                          <div className="absolute top-0 left-1/4 w-1/2 h-[1px] bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent"></div>
                          <div className="relative mb-4 lg:mb-6">
                            <div className="absolute inset-0 bg-indigo-500/20 blur-xl lg:blur-2xl rounded-full group-hover:bg-indigo-500/40 transition-colors duration-500"></div>
                            <div className="w-16 h-16 lg:w-24 lg:h-24 rounded-2xl lg:rounded-3xl bg-slate-800/80 border border-slate-600/50 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 shadow-inner group-hover:border-indigo-500/50 relative z-10">
                              <span className="text-3xl lg:text-5xl drop-shadow-lg">📋</span>
                            </div>
                          </div>
                          <span className="text-xl lg:text-2xl font-black text-white tracking-wider relative z-10 text-center">Database Roster</span>
                          <span className="text-xs lg:text-base text-slate-400 mt-1 lg:mt-2 relative z-10 font-medium text-center">Gestisci operatori ({roster.length})</span>
                        </button>
                        <button onClick={() => navigate('/map', { state: { initialView: 'alliance' }})} className="group relative overflow-hidden flex flex-col items-center justify-center py-8 lg:py-12 px-4 lg:px-8 bg-gradient-to-b from-slate-800/50 to-slate-900/90 backdrop-blur-xl border border-slate-700/50 border-t-white/10 hover:border-blue-500/50 rounded-2xl lg:rounded-[2rem] transition-all duration-500 hover:-translate-y-1 lg:hover:-translate-y-2 shadow-[0_10px_30px_rgba(0,0,0,0.5)] hover:shadow-[0_20px_50px_-10px_rgba(59,130,246,0.5)]">
                          <div className="absolute top-0 left-1/4 w-1/2 h-[1px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent"></div>
                          <div className="relative mb-4 lg:mb-6">
                            <div className="absolute inset-0 bg-blue-500/20 blur-xl lg:blur-2xl rounded-full group-hover:bg-blue-500/40 transition-colors duration-500"></div>
                            <div className="w-16 h-16 lg:w-24 lg:h-24 rounded-2xl lg:rounded-3xl bg-slate-800/80 border border-slate-600/50 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 shadow-inner group-hover:border-blue-500/50 relative z-10">
                              <span className="text-3xl lg:text-5xl drop-shadow-lg">📍</span>
                            </div>
                          </div>
                          <span className="text-xl lg:text-2xl font-black text-white tracking-wider relative z-10 text-center">Territorio</span>
                          <span className="text-xs lg:text-base text-slate-400 mt-1 lg:mt-2 relative z-10 font-medium text-center">Vista compatta alveare</span>
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              ) : (
                /* PANNELLO DI BENVENUTO (Non Loggato) */
                <div className="bg-slate-900/50 backdrop-blur-2xl p-6 md:p-12 rounded-3xl md:rounded-[2rem] border border-white/5 border-t-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.6)] flex flex-col items-center gap-6 md:gap-8 animate-in zoom-in-95 duration-500 w-[95%] max-w-xl text-center">
                  <div className="relative">
                    <div className="absolute inset-0 bg-cyan-500/30 blur-xl md:blur-2xl rounded-full"></div>
                    <div className="w-16 h-16 md:w-24 md:h-24 bg-slate-900 border border-cyan-500/30 text-cyan-400 rounded-2xl md:rounded-3xl flex items-center justify-center text-4xl md:text-5xl shadow-inner relative z-10">👋</div>
                  </div>
                  <div className="space-y-3 md:space-y-4">
                    <h2 className="text-2xl md:text-4xl font-black text-white tracking-wide drop-shadow-md">Terminale Offline</h2>
                    <p className="text-slate-400 text-sm md:text-base leading-relaxed max-w-md mx-auto font-medium">
                      Per attivare i moduli tattici ed esplorare la mappa è necessario sincronizzarsi con il database di un'alleanza.
                    </p>
                  </div>
                  
                  <div className="w-full bg-slate-950/60 border border-slate-800 p-4 rounded-2xl text-left flex flex-col gap-2">
                    <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest">💡 Come accedere:</span>
                    <ul className="text-xs text-slate-300 space-y-1 pl-2">
                      <li>• Se fai parte di un'alleanza, inserisci <strong>Regno e Tag</strong>. Se non esiste, verrà creato automaticamente.</li>
                      <li>• Se vuoi solo testare il sistema, usa la parola <strong>DEMO</strong> come Tag per entrare nel recinto di sabbia.</li>
                    </ul>
                  </div>

                  <div className="border-t border-slate-700/50 w-full pt-4 md:pt-6 flex justify-center">
                    <button onClick={() => setIsLoginModalOpen(true)} className="px-6 py-4 md:px-10 md:py-5 w-full max-w-xs bg-gradient-to-b from-cyan-500 to-cyan-700 hover:from-cyan-400 hover:to-cyan-600 text-white font-black text-sm uppercase tracking-wider rounded-xl md:rounded-2xl shadow-[0_10px_30px_rgba(8,145,178,0.4)] transition-all flex items-center justify-center gap-3 border-t border-cyan-300/30 hover:-translate-y-1">
                      <span className="text-xl md:text-2xl drop-shadow-sm">🔐</span> Accedi al Sistema
                    </button>
                  </div>
                </div>
              )}
            </div>

          ) : (
            /* SCHERMATA GESTIONE ROSTER */
            <div className="flex flex-col w-full h-full bg-slate-900/80 backdrop-blur-2xl p-4 md:p-6 rounded-2xl md:rounded-[2rem] border border-white/5 border-t-white/10 overflow-y-auto animate-in slide-in-from-bottom-8 duration-300 shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 md:mb-6 sticky top-0 bg-transparent py-2 md:py-4 z-10 border-b border-slate-700/50">
                <div className="flex flex-wrap items-center gap-3 md:gap-5 w-full sm:w-auto">
                  <button onClick={() => setIsRosterOpen(false)} className="px-4 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-white text-[10px] md:text-xs uppercase tracking-wider font-bold rounded-lg md:rounded-xl border border-white/5 border-t-white/10 transition-colors shadow-lg">
                    ⬅ Indietro
                  </button>
                  <h2 className="text-lg md:text-2xl font-black text-white drop-shadow-md">
                    Roster <span className="text-cyan-400">{allianceCode === 'ADMIN' ? 'MASTER' : userRole === 'guest' ? 'DEMO' : allianceCode}</span>
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2 md:gap-3 items-center w-full sm:w-auto">
                  <input type="file" accept=".json" ref={importRosterRef} onChange={handleImportRosterJson} style={{ display: 'none' }} />
                  <button onClick={() => importRosterRef.current.click()} className="flex-1 sm:flex-none px-3 py-2 md:px-5 md:py-2.5 bg-emerald-600/90 hover:bg-emerald-500 text-white text-[10px] md:text-xs font-black uppercase tracking-wider rounded-lg md:rounded-xl border border-emerald-400/30 border-t-emerald-300/50 shadow-lg transition-colors">📥 Importa</button>
                  
                  {userRole === 'guest' ? (
                     <button onClick={() => alert("☁️ Azione non permessa in modalità Sandbox (Demo).")} className="flex-1 sm:flex-none px-3 py-2 md:px-5 md:py-2.5 bg-slate-800/50 text-slate-500 text-[10px] md:text-xs font-black uppercase tracking-wider rounded-lg md:rounded-xl border border-white/5 cursor-not-allowed">☁️ Salva Disabilitato</button>
                  ) : userRole === 'admin' ? (
                     <button onClick={() => alert("L'admin gestisce i roster dalla tendina Console Consulente. Non sovrascrivere!")} className="flex-1 sm:flex-none px-3 py-2 md:px-5 md:py-2.5 bg-slate-800/50 text-slate-500 text-[10px] md:text-xs font-black uppercase tracking-wider rounded-lg md:rounded-xl border border-white/5 cursor-not-allowed">☁️ Salva Bloccato</button>
                  ) : (
                    <button onClick={handleSaveRosterToCloud} className="flex-1 sm:flex-none px-3 py-2 md:px-5 md:py-2.5 bg-slate-800/80 hover:bg-slate-700 text-cyan-400 hover:text-cyan-300 text-[10px] md:text-xs font-black uppercase tracking-wider rounded-lg md:rounded-xl border border-white/5 border-t-white/10 shadow-lg transition-colors">☁️ Salva in Cloud</button>
                  )}
                </div>
              </div>
              <RosterTable roster={roster} onAddPlayer={handleAddPlayer} onEdit={handleEditPlayer} onDelete={handleDeletePlayer} onDeploy={() => setIsRosterOpen(false)} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}