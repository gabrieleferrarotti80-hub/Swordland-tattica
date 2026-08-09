import { useNavigate } from 'react-router-dom';
import { RosterTable } from '../components/RosterTable';
import { useState, useRef, useEffect } from 'react';
import { db } from '../firebase';
import { doc, setDoc, getDoc, collection, getDocs } from 'firebase/firestore';
import { demoRoster } from '../data/demoRoster';

// --- IMPORT MULTILINGUA ---
import { useTranslation } from 'react-i18next';

export default function Home({ roster, setRoster, userRole, setUserRole, allianceCode, setAllianceCode }) {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation(); // <-- ATTIVAZIONE HOOK
  
  const [isRosterOpen, setIsRosterOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginKingdom, setLoginKingdom] = useState('');
  const [loginTag, setLoginTag] = useState('');
  const [isLoadingLogin, setIsLoadingLogin] = useState(false);
  
  const [hubView, setHubView] = useState('main');

  const [allianceList, setAllianceList] = useState([]);
  const [selectedAdminAlliance, setSelectedAdminAlliance] = useState('');

  const [accessPasswords, setAccessPasswords] = useState({ master: 'MASTER' });
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

  const handleLogin = async () => {
    const tag = loginTag.trim().toUpperCase();
    const kingdom = loginKingdom.trim();
    if (!tag) return;
    setIsLoadingLogin(true);

    if (tag === accessPasswords.master.toUpperCase()) {
      setUserRole('admin');
      setAllianceCode('ADMIN');
      setIsLoginModalOpen(false);
      setLoginTag(''); setLoginKingdom('');
    } else if (tag === 'DEMO') {
      setUserRole('guest');
      setAllianceCode('DEMO');
      setRoster(demoRoster);
      setIsLoginModalOpen(false);
      setLoginTag(''); setLoginKingdom('');
    } else {
      if (!kingdom) { alert("Inserisci il numero del Regno!"); setIsLoadingLogin(false); return; }
      const fullAllianceId = `${kingdom}_${tag}`;
      try {
        const docSnap = await getDoc(doc(db, "rosters", fullAllianceId));
        if (docSnap.exists()) { setRoster(docSnap.data().players || []); } 
        else { setRoster([]); }
        setUserRole('alliance');
        setAllianceCode(fullAllianceId);
        setIsLoginModalOpen(false);
        setLoginTag(''); setLoginKingdom('');
      } catch (error) { alert("Errore di connessione al database."); }
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
      if (userRole === 'guest') { alert("📊 Access: Read-only for Demo mode."); return true; }
      alert("⛔ Access Denied"); return false;
    }
    return true;
  };

  const handleLoadAllianceAsAdmin = async (code) => {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) return;
    setIsLoadingLogin(true);
    try {
      const docSnap = await getDoc(doc(db, "rosters", cleanCode));
      if (docSnap.exists()) { setRoster(docSnap.data().players || []); alert(`✅ Dati [${cleanCode}] caricati!`); } 
      else { setRoster([]); alert(`⚠️ Alleanza [${cleanCode}] non trovata.`); }
      setAllianceCode(cleanCode); 
    } catch (error) { alert("❌ Errore caricamento."); }
    setIsLoadingLogin(false);
  };

  const handleSaveRosterToCloud = async () => {
    if (!allianceCode || allianceCode === 'ADMIN' || userRole === 'guest') return;
    try { 
      await setDoc(doc(db, "rosters", allianceCode), { players: roster }); 
      alert("✅ Roster salvato."); 
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
          }
        }
      } catch (error) { alert("❌ Errore JSON."); }
      event.target.value = '';
    };
    reader.readAsText(file);
  };

  // Funzione per cambiare lingua dinamicamente
  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div className="h-screen bg-slate-950 p-2 md:p-4 flex flex-col gap-2 md:gap-4 overflow-hidden select-none">
      <style>{`.hide-scroll::-webkit-scrollbar { display: none; } .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
      
      {/* HEADER */}
      <header className="flex justify-between items-center bg-slate-900/40 backdrop-blur-xl px-4 md:px-6 py-3 md:py-4 rounded-xl md:rounded-2xl border border-white/5 shadow-[0_8px_30px_rgb(0,0,0,0.3)] shrink-0 z-20">
        <div className="flex items-center gap-2 md:gap-4">
          <h1 className="text-xl md:text-2xl font-black text-white tracking-wider cursor-pointer flex items-center gap-2 drop-shadow-md hover:text-cyan-100 transition-colors" onClick={() => setHubView('main')}>
            <span className="text-cyan-500 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]">❖</span> 
            <span className="hidden sm:inline">HUB</span> <span className="text-cyan-400">KINGSHOT</span>
          </h1>
        </div>
        
        <div className="flex gap-3 items-center">
          {/* SELETTORE MULTILINGUA UI (IT, EN, PL, FR) */}
          <div className="flex bg-slate-800 p-0.5 rounded border border-slate-700 text-xs">
            <button onClick={() => changeLanguage('it')} className={`px-1.5 py-0.5 rounded font-bold transition-colors ${i18n.language === 'it' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}>IT</button>
            <button onClick={() => changeLanguage('en')} className={`px-1.5 py-0.5 rounded font-bold transition-colors ${i18n.language === 'en' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}>EN</button>
            <button onClick={() => changeLanguage('pl')} className={`px-1.5 py-0.5 rounded font-bold transition-colors ${i18n.language === 'pl' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}>PL</button>
            <button onClick={() => changeLanguage('fr')} className={`px-1.5 py-0.5 rounded font-bold transition-colors ${i18n.language === 'fr' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}>FR</button>
          </div>

          {!userRole ? (
             <button onClick={() => setIsLoginModalOpen(true)} className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] md:text-xs font-black uppercase tracking-wider rounded-lg md:rounded-xl border border-cyan-400/50 transition-all shadow-[0_0_15px_rgba(8,145,178,0.4)]">
               {t('home.login_btn')}
             </button>
          ) : (
            <>
              {userRole === 'admin' && (
                <button onClick={() => setIsSettingsOpen(true)} className="px-3 md:px-4 py-1.5 md:py-2 bg-rose-950/30 hover:bg-rose-900/50 text-rose-400 text-[10px] md:text-xs font-bold rounded-lg md:rounded-xl border border-rose-500/20 transition-all flex items-center gap-1.5 md:gap-2 backdrop-blur-sm shadow-[0_0_15px_rgba(225,29,72,0.1)] hover:shadow-[0_0_15px_rgba(225,29,72,0.3)]">
                  <span>⚙️</span> <span className="hidden sm:inline">{t('home.master_panel')}</span>
                </button>
              )}
              <div className="flex items-center gap-3 bg-slate-900/50 px-3 py-1.5 md:px-4 md:py-2 rounded-lg md:rounded-xl border border-white/10 backdrop-blur-sm">
                <span className="text-slate-400 text-[10px] md:text-xs font-bold uppercase hidden sm:inline">
                  {userRole === 'admin' ? t('home.master') : userRole === 'guest' ? t('home.guest') : `${t('home.alliance')} ${allianceCode}`}
                </span>
                <div className="w-[1px] h-4 bg-slate-700 hidden sm:block"></div>
                <button onClick={handleLogout} className="text-rose-400 hover:text-rose-300 text-[10px] md:text-xs font-bold transition-colors">
                  {t('home.logout')}
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 rounded-xl md:rounded-2xl border border-slate-800/80 transition-all duration-300 relative overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.6)] bg-[#090e17] flex flex-col">
        
        {/* BACKGROUND EFFECTS */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: 'linear-gradient(#38bdf8 1px, transparent 1px), linear-gradient(90deg, #38bdf8 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
          <div className="absolute -top-[30%] -left-[10%] w-[70%] h-[70%] bg-cyan-600/15 rounded-full blur-[140px]"></div>
          <div className="absolute top-[10%] -right-[20%] w-[60%] h-[60%] bg-indigo-600/15 rounded-full blur-[140px]"></div>
          <div className="absolute -bottom-[40%] left-[20%] w-[60%] h-[60%] bg-rose-600/10 rounded-full blur-[140px]"></div>
        </div>

        <div className="relative z-10 p-4 md:p-6 h-full w-full flex flex-col overflow-y-auto hide-scroll">
          
          {/* LOGIN MODAL */}
          {isLoginModalOpen && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
              <div className="bg-slate-900/95 border border-white/10 p-8 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col items-center gap-6 w-full max-w-sm animate-in zoom-in-95 duration-200">
                <div className="w-16 h-16 bg-cyan-950 border border-cyan-500/50 rounded-2xl flex items-center justify-center text-3xl shadow-[0_0_20px_rgba(8,145,178,0.3)]">🔐</div>
                <div className="text-center">
                  <h3 className="text-2xl font-black text-white">{t('home.modal_title')}</h3>
                  <p className="text-xs text-slate-400 mt-2">{t('home.modal_subtitle')}</p>
                </div>
                <div className="flex gap-2 w-full">
                  <input type="number" placeholder={t('home.modal_kingdom')} value={loginKingdom} onChange={(e) => setLoginKingdom(e.target.value)} className="w-1/3 bg-slate-950 border border-slate-700 rounded-xl px-3 py-3 text-center text-white font-black focus:outline-none focus:border-cyan-500 shadow-inner hide-scroll" />
                  <input type="text" placeholder={t('home.modal_tag')} value={loginTag} onChange={(e) => setLoginTag(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} className="w-2/3 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-center text-white font-black tracking-widest uppercase focus:outline-none focus:border-cyan-500 shadow-inner" />
                </div>
                <div className="flex flex-col gap-3 w-full">
                  <button onClick={handleLogin} disabled={isLoadingLogin || !loginTag} className="w-full py-3.5 bg-cyan-600 hover:bg-cyan-500 text-white font-black rounded-xl transition-colors text-sm shadow-[0_0_15px_rgba(8,145,178,0.4)] disabled:opacity-50">
                    {isLoadingLogin ? t('home.modal_loading') : t('home.modal_enter')}
                  </button>
                </div>
                <button onClick={() => setIsLoginModalOpen(false)} className="text-slate-500 hover:text-slate-300 text-xs font-bold transition-colors mt-1">{t('home.cancel')}</button>
              </div>
            </div>
          )}

          {isSettingsOpen && userRole === 'admin' ? (
             <div className="flex flex-col w-full max-w-5xl mx-auto bg-slate-900/80 backdrop-blur-xl p-4 md:p-8 rounded-2xl md:rounded-3xl border border-rose-900/40 border-t-rose-500/30 animate-in fade-in zoom-in-95 duration-300 mt-4 md:mt-10">
               <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-700">
                 <button onClick={() => setIsSettingsOpen(false)} className="px-4 py-2 bg-slate-800 text-slate-200 text-xs font-bold rounded-xl border border-white/5 transition-colors">{t('home.back_menu')}</button>
                 <h2 className="text-xl font-bold text-rose-400">⚙️ {t('home.master_panel')}</h2>
               </div>
               <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-700/50 shadow-inner w-1/2">
                 <label className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Master Key</label>
                 <input type="text" value={accessPasswords.master} onChange={(e) => setAccessPasswords(prev => ({ ...prev, master: e.target.value }))} className="bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-sm text-white font-bold focus:outline-none w-full mt-2"/>
               </div>
             </div>
          ) : !isRosterOpen ? (
            
            <div className="flex-1 flex flex-col items-center justify-center py-4">
              {userRole ? (
                <div className="w-full max-w-6xl flex flex-col items-center animate-in fade-in zoom-in-95 duration-500">
                  <div className="flex flex-col items-center gap-3 md:gap-4 mb-8 md:mb-14 text-center">
                    <div className="inline-flex items-center gap-2 md:gap-3 px-4 py-1.5 md:px-6 md:py-2.5 rounded-full bg-slate-900/60 border border-slate-700/80 text-slate-300 text-[10px] md:text-xs font-bold shadow-2xl backdrop-blur-xl">
                      <span className="relative flex h-2 w-2 md:h-3 md:w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 md:h-3 md:w-3 bg-emerald-500 shadow-[0_0_10px_#10b981]"></span>
                      </span>
                      {t('home.system_online')} <span className="text-slate-600 hidden sm:inline">|</span> 
                      <span className="hidden sm:inline">{t('home.profile')}</span> 
                      <span className="text-cyan-400 font-black">{userRole === 'admin' ? 'MASTER' : userRole === 'guest' ? 'GUEST (SANDBOX)' : allianceCode}</span>
                    </div>
                    <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-white tracking-tight drop-shadow-[0_4px_20px_rgba(0,0,0,0.8)] px-2">
                      {hubView === 'main' ? t('home.dashboard_title') : hubView === 'events' ? t('home.tactical_sim_title') : t('home.territory_title')}
                    </h2>
                  </div>

                  {userRole === 'admin' && (
                    <div className="w-full max-w-4xl bg-rose-950/40 border border-rose-500/30 p-5 rounded-2xl mb-8 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg backdrop-blur-md">
                      <div className="text-left">
                         <h3 className="text-rose-400 font-black text-lg flex items-center gap-2">👑 Console Consulente</h3>
                      </div>
                      <div className="flex w-full sm:w-auto gap-2">
                        <select value={selectedAdminAlliance} onChange={(e) => setSelectedAdminAlliance(e.target.value)} className="w-40 bg-slate-900 border border-rose-900/50 rounded-xl px-3 py-2 text-white font-bold outline-none">
                          {allianceList.map(tag => (<option key={tag} value={tag}>{tag}</option>))}
                        </select>
                        <button onClick={() => handleLoadAllianceAsAdmin(selectedAdminAlliance)} className="px-5 py-2 bg-rose-700 hover:bg-rose-600 text-white font-black text-xs uppercase rounded-xl shadow-lg">Carica</button>
                      </div>
                    </div>
                  )}

                  {hubView === 'main' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-8 w-full px-2 md:px-8">
                      <button onClick={() => navigate('/map', { state: { initialView: 'global' }})} className="group relative overflow-hidden flex flex-col items-center justify-center py-8 lg:py-12 bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 border-t-white/10 hover:border-cyan-500/50 rounded-[2rem] transition-all shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                        <span className="text-4xl lg:text-5xl mb-4 group-hover:scale-110 transition-transform">🌍</span>
                        <span className="text-xl lg:text-2xl font-black text-white">{t('home.global_map')}</span>
                        <span className="text-slate-400 mt-2 font-medium">{t('home.global_map_desc')}</span>
                      </button>

                      <button onClick={() => setHubView('events')} className="group relative overflow-hidden flex flex-col items-center justify-center py-8 lg:py-12 bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 border-t-white/10 hover:border-rose-500/50 rounded-[2rem] transition-all shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                        <span className="text-4xl lg:text-5xl mb-4 group-hover:scale-110 transition-transform">⚔️</span>
                        <span className="text-xl lg:text-2xl font-black text-white">{t('home.events_tactic')}</span>
                        <span className="text-slate-400 mt-2 font-medium">{t('home.events_tactic_desc')}</span>
                      </button>

                      <button onClick={() => setHubView('alliance')} className="group relative overflow-hidden flex flex-col items-center justify-center py-8 lg:py-12 bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 border-t-white/10 hover:border-indigo-500/50 rounded-[2rem] transition-all shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                        <span className="text-4xl lg:text-5xl mb-4 group-hover:scale-110 transition-transform">🛡️</span>
                        <span className="text-xl lg:text-2xl font-black text-white">{t('home.alliance_menu')}</span>
                        <span className="text-slate-400 mt-2 font-medium">{t('home.alliance_menu_desc')}</span>
                      </button>

                      <button onClick={() => { if(checkAccess('viking')) navigate('/viking'); }} className="group relative overflow-hidden flex flex-col items-center justify-center py-8 lg:py-12 bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 border-t-white/10 hover:border-amber-500/50 rounded-[2rem] transition-all shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                        <span className="text-4xl lg:text-5xl mb-4 group-hover:scale-110 transition-transform">📊</span>
                        <span className="text-xl lg:text-2xl font-black text-white">{t('home.viking_center')}</span>
                        <span className="text-slate-400 mt-2 font-medium">{t('home.viking_center_desc')}</span>
                      </button>
                    </div>
                  )}

                  {hubView === 'events' && (
                    <div className="flex flex-col w-full px-2 md:px-8 gap-4 lg:gap-8 animate-in slide-in-from-right-8 duration-300">
                      <button onClick={() => setHubView('main')} className="text-slate-400 hover:text-white font-bold text-xs uppercase mb-2 text-left w-fit flex items-center px-6 py-3 border border-slate-700 bg-slate-900 rounded-full">{t('home.back_menu')}</button>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-8 w-full">
                        <button onClick={() => navigate('/map', { state: { initialView: 'tactical' }})} className="group flex flex-col items-center justify-center py-12 bg-slate-900/90 border border-slate-700/50 hover:border-rose-500/50 rounded-[2rem]">
                          <span className="text-5xl mb-4 group-hover:scale-110 transition-transform">🎯</span>
                          <span className="text-2xl font-black text-white">{t('home.tactical_room')}</span>
                          <span className="text-slate-400 mt-2">{t('home.tactical_room_desc')}</span>
                        </button>
                        <button onClick={() => { if(checkAccess('swordland')) navigate('/swordland'); }} className="group flex flex-col items-center justify-center py-12 bg-slate-900/90 border border-slate-700/50 hover:border-orange-500/50 rounded-[2rem]">
                          <span className="text-5xl mb-4 group-hover:scale-110 transition-transform">🏰</span>
                          <span className="text-2xl font-black text-white">{t('home.swordland')}</span>
                          <span className="text-slate-400 mt-2">{t('home.swordland_desc')}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {hubView === 'alliance' && (
                    <div className="flex flex-col w-full px-2 md:px-8 gap-4 lg:gap-8 animate-in slide-in-from-right-8 duration-300">
                      <button onClick={() => setHubView('main')} className="text-slate-400 hover:text-white font-bold text-xs uppercase mb-2 text-left w-fit flex items-center px-6 py-3 border border-slate-700 bg-slate-900 rounded-full">{t('home.back_menu')}</button>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-8 w-full">
                        <button onClick={() => setIsRosterOpen(true)} className="group flex flex-col items-center justify-center py-12 bg-slate-900/90 border border-slate-700/50 hover:border-indigo-500/50 rounded-[2rem]">
                          <span className="text-5xl mb-4 group-hover:scale-110 transition-transform">📋</span>
                          <span className="text-2xl font-black text-white">{t('home.roster_db')}</span>
                          <span className="text-slate-400 mt-2">{t('home.roster_db_desc')} ({roster.length})</span>
                        </button>
                        <button onClick={() => navigate('/map', { state: { initialView: 'alliance' }})} className="group flex flex-col items-center justify-center py-12 bg-slate-900/90 border border-slate-700/50 hover:border-blue-500/50 rounded-[2rem]">
                          <span className="text-5xl mb-4 group-hover:scale-110 transition-transform">📍</span>
                          <span className="text-2xl font-black text-white">{t('home.territory')}</span>
                          <span className="text-slate-400 mt-2">{t('home.territory_desc')}</span>
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              ) : (
                /* OFFLINE PANEL */
                <div className="bg-slate-900/50 backdrop-blur-2xl p-6 md:p-12 rounded-3xl border border-white/5 border-t-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.6)] flex flex-col items-center gap-6 md:gap-8 animate-in w-[95%] max-w-xl text-center">
                  <div className="w-24 h-24 bg-slate-900 border border-cyan-500/30 text-cyan-400 rounded-3xl flex items-center justify-center text-5xl">👋</div>
                  <div className="space-y-4">
                    <h2 className="text-3xl font-black text-white">{t('home.offline_terminal')}</h2>
                    <p className="text-slate-400 text-sm leading-relaxed font-medium">{t('home.offline_desc')}</p>
                  </div>
                  <div className="w-full bg-slate-950/60 border border-slate-800 p-4 rounded-2xl text-left">
                    <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest">{t('home.how_to_login')}</span>
                    <ul className="text-xs text-slate-300 space-y-1 pl-2 mt-2">
                      <li>{t('home.login_tip_1')}</li>
                      <li>{t('home.login_tip_2')}</li>
                    </ul>
                  </div>
                  <button onClick={() => setIsLoginModalOpen(true)} className="px-10 py-5 w-full bg-cyan-600 hover:bg-cyan-500 text-white font-black uppercase rounded-2xl flex items-center justify-center gap-3">
                    <span className="text-2xl">🔐</span> {t('home.login_system_btn')}
                  </button>
                </div>
              )}
            </div>
          ) : (
             <div className="flex flex-col w-full h-full bg-slate-900/80 backdrop-blur-2xl p-6 rounded-3xl border border-white/10 overflow-y-auto">
               <div className="flex justify-between items-center mb-6 sticky top-0 py-4 bg-transparent z-10">
                 <button onClick={() => setIsRosterOpen(false)} className="px-4 py-2 bg-slate-800 text-white font-bold rounded-xl">{t('home.back_menu')}</button>
                 <RosterTable roster={roster} onAddPlayer={handleAddPlayer} onEdit={handleEditPlayer} onDelete={handleDeletePlayer} onDeploy={() => setIsRosterOpen(false)} />
               </div>
             </div>
          )}
        </div>
      </main>
    </div>
  );
}