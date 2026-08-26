import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { db } from '../firebase';
// 📌 Aggiunti query e where per contare i ticket
import { doc, getDoc, setDoc, collection, getDocs, updateDoc, query, where } from 'firebase/firestore';

// Componenti Modulari
import { RosterTable } from '../components/RosterTable';
import SystemAnnouncement from '../components/SystemAnnouncement';
import AuthModal from '../components/AuthModal';
import GovernancePanel from '../components/GovernancePanel';

export default function Home({ auth, setAuth, roster, setRoster }) {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const [isRosterOpen, setIsRosterOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [hubView, setHubView] = useState('main'); 
  
  // Dati Globali
  const [allianceList, setAllianceList] = useState([]);
  const [selectedAdminAlliance, setSelectedAdminAlliance] = useState('');
  const [accessPasswords, setAccessPasswords] = useState({});
  const [sysAnnouncement, setSysAnnouncement] = useState(null);
  const [allianceDbData, setAllianceDbData] = useState(null);
  
  // 📌 Stato per le notifiche dei Ticket Admin
  const [openTicketsCount, setOpenTicketsCount] = useState(0);

  const isLogged = auth?.role != null && auth?.code !== '';
  const changeLanguage = (lng) => i18n.changeLanguage(lng);

  const handleLogout = () => {
    setAuth({ role: null, code: '', allianceRole: null, playerId: null, playerName: '', castleAccess: false });
    setRoster([]);
    setHubView('main');
  };

  const checkAccess = (moduleName) => {
    if (auth.role === 'admin' || auth.role === 'consulente') return true; 
    if (moduleName === 'swordland') return true; 
    if (moduleName === 'viking') {
      if (auth.code === 'DEMO') { alert("⛔ Accesso negato: Il Centro Vichinghi non è accessibile nella Demo Tattica."); return false; }
      return true; 
    }
    return true;
  };

  // --- FETCH INIZIALI ---
  useEffect(() => {
    const fetchGlobalData = async () => {
      try {
        const docRef = doc(db, "settings", "accessCodes");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) setAccessPasswords(docSnap.data());

        const annSnap = await getDoc(doc(db, "system", "announcement"));
        if (annSnap.exists() && annSnap.data().active && localStorage.getItem('dismissed_patch') !== annSnap.data().version) {
          setSysAnnouncement(annSnap.data());
        }
      } catch (error) {}
    };
    fetchGlobalData();
  }, []);

  useEffect(() => {
    if (auth.role === 'consulente' || auth.role === 'admin') {
      const fetchAdminData = async () => {
        try {
          // 1. Carica lista Alleanze
          const snap = await getDocs(collection(db, "alliances"));
          const alliances = snap.docs.map(d => d.id).sort();
          setAllianceList(alliances);
          if (alliances.length > 0) setSelectedAdminAlliance(alliances[0]);

          // 2. 📌 Carica il conteggio dei Ticket aperti
          const q = query(collection(db, "tickets"), where("status", "==", "Open"));
          const ticketSnap = await getDocs(q);
          setOpenTicketsCount(ticketSnap.size);
        } catch (error) { console.error("Errore fetch dati Admin:", error); }
      };
      fetchAdminData();
    }
  }, [auth.role]);

  useEffect(() => {
    if (isLogged && auth.code && auth.code !== 'SINGLE' && auth.code !== '0000_MASTER') {
      const fetchAlliance = async () => {
        const alSnap = await getDoc(doc(db, "alliances", auth.code));
        if (alSnap.exists()) setAllianceDbData(alSnap.data());
      }
      fetchAlliance();
    }
  }, [isLogged, auth.code]);

  const handleLoadAllianceAsAdmin = async (code) => {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) return;
    try {
      let docSnap = await getDoc(doc(db, "rosters", cleanCode));
      if (!docSnap.exists()) docSnap = await getDoc(doc(db, "allianceRoster", cleanCode)); 
      if (docSnap.exists()) { 
        setRoster(docSnap.data().players || docSnap.data().members || []); 
        alert(`✅ Dati [${cleanCode}] caricati!`); 
      } else { 
        setRoster([]); alert(`⚠️ Alleanza [${cleanCode}] non trovata.`); 
      }
      setAuth({ ...auth, code: cleanCode, allianceRole: 'officer' }); 
    } catch (error) { alert("❌ Errore caricamento."); }
  };

  const handleAcceptNomination = async () => {
    try {
      const oldR5_id = allianceDbData.currentR5;
      const newR5_id = auth.playerId;

      if(oldR5_id) await updateDoc(doc(db, "users", oldR5_id), { role: 'R4' });
      await updateDoc(doc(db, "users", newR5_id), { role: 'R5' });
      await updateDoc(doc(db, "alliances", auth.code), { currentR5: newR5_id, pendingTransferTo: null });

      const newRoster = roster.map(p => {
          if(p.id === oldR5_id) return { ...p, role: 'R4' };
          if(p.id === newR5_id) return { ...p, role: 'R5' };
          return p;
      });
      setRoster(newRoster);
      await updateDoc(doc(db, "rosters", auth.code), { players: newRoster });
      setAllianceDbData(prev => ({ ...prev, currentR5: newR5_id, pendingTransferTo: null }));
      alert(t('governance.nomination_accepted', "Congratulazioni, sei il nuovo Leader!"));
    } catch(e) { alert(t('home.error_generic', 'Errore.')); }
  };

  const handleDeclineNomination = async () => {
    try {
      await updateDoc(doc(db, "alliances", auth.code), { pendingTransferTo: null });
      setAllianceDbData(prev => ({ ...prev, pendingTransferTo: null }));
    } catch(e) { alert(t('home.error_generic', 'Errore.')); }
  };

  const handleKickPlayer = async (targetId) => {
    try {
      const newRoster = roster.filter(pl => pl.id !== targetId);
      setRoster(newRoster);
      await updateDoc(doc(db, "rosters", auth.code), { players: newRoster });

      if (!targetId.startsWith('excel-') && !targetId.startsWith('man-')) {
         await updateDoc(doc(db, "users", targetId), {
           allianceCode: '', allianceId: '', role: 'singolo'
         });
      }
      alert("✅ Giocatore espulso dall'alleanza con successo!");
    } catch (e) {
      console.error(e);
      alert("⚠️ Il giocatore è stato rimosso dalla lista, ma potrebbe esserci stato un errore nell'aggiornare il suo profilo personale.");
    }
  };

  return (
    <div className="h-screen bg-slate-950 p-2 md:p-4 flex flex-col gap-2 md:gap-4 overflow-hidden select-none relative">
      <style>{`.hide-scroll::-webkit-scrollbar { display: none; } .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
      
      <SystemAnnouncement announcement={sysAnnouncement} onDismiss={() => { localStorage.setItem('dismissed_patch', sysAnnouncement.version); setSysAnnouncement(null); }} />
      {isLoginModalOpen && <AuthModal onClose={() => setIsLoginModalOpen(false)} setAuth={setAuth} setRoster={setRoster} setHubView={setHubView} setIsRosterOpen={setIsRosterOpen} accessPasswords={accessPasswords} />}
      
      {isLogged && allianceDbData?.pendingTransferTo === auth.playerId && (
         <div className="absolute top-0 left-0 w-full z-50 animate-in slide-in-from-top duration-500">
           <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-slate-900 p-4 shadow-[0_10px_30px_rgba(217,119,6,0.6)] flex flex-col sm:flex-row items-center justify-between gap-4 border-b-2 border-yellow-300">
             <div className="flex items-center gap-4"><span className="text-4xl drop-shadow-md">👑</span>
               <div>
                  <h3 className="font-black text-lg md:text-xl tracking-tight">{t('governance.nomination_title', 'SEI STATO NOMINATO RE!')}</h3>
                  <p className="text-sm font-bold opacity-90">{t('governance.nomination_desc', 'L\'attuale leader ti ha ceduto il comando. Accetti?')}</p>
               </div>
             </div>
             <div className="flex gap-2 w-full sm:w-auto">
               <button onClick={handleAcceptNomination} className="flex-1 sm:flex-none px-6 py-2 bg-slate-900 hover:bg-black text-amber-400 font-black uppercase rounded-lg shadow-lg border border-amber-400/30 transition-all">{t('governance.accept', 'ACCETTO')}</button>
               <button onClick={handleDeclineNomination} className="flex-1 sm:flex-none px-6 py-2 bg-amber-700/50 hover:bg-amber-800 text-white font-black uppercase rounded-lg transition-all">{t('governance.decline', 'RIFIUTO')}</button>
             </div>
           </div>
         </div>
      )}

      {/* HEADER */}
      <header className="flex justify-between items-center bg-slate-900/40 backdrop-blur-xl px-4 md:px-6 py-3 md:py-4 rounded-xl md:rounded-2xl border border-white/5 shadow-[0_8px_30px_rgb(0,0,0,0.3)] shrink-0 z-20 mt-2">
        <div className="flex items-center gap-2 md:gap-4">
          <h1 className="text-xl md:text-2xl font-black text-white tracking-wider cursor-pointer flex items-center gap-2 drop-shadow-md hover:text-cyan-100 transition-colors" onClick={() => setHubView('main')}>
            <span className="text-cyan-500 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]">❖</span> 
            <span className="hidden sm:inline">HUB</span> <span className="text-cyan-400">KINGSHOT</span>
          </h1>
        </div>
        <div className="flex gap-3 items-center">
          <div className="flex bg-slate-800 p-0.5 rounded border border-slate-700 text-xs" translate="no">
            {['it', 'en', 'pl', 'fr'].map(lng => (
              <button key={lng} onClick={() => changeLanguage(lng)} className={`px-1.5 py-0.5 rounded font-bold transition-colors uppercase ${i18n.language === lng ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}>{lng}</button>
            ))}
          </div>
          {!isLogged ? (
             <button onClick={() => setIsLoginModalOpen(true)} className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] md:text-xs font-black uppercase tracking-wider rounded-lg md:rounded-xl border border-cyan-400/50 transition-all shadow-[0_0_15px_rgba(8,145,178,0.4)]">{t('home.login_btn')}</button>
          ) : (
             <div className="flex items-center gap-3 bg-slate-900/50 px-3 py-1.5 md:px-4 md:py-2 rounded-lg md:rounded-xl border border-white/10 backdrop-blur-sm">
                <span className="text-slate-400 text-[10px] md:text-xs font-bold uppercase hidden sm:inline">
                  {auth.role === 'consulente' || auth.role === 'admin' ? `👑 ${auth.playerName}` : `🛡️ [${auth.code.split('_')?.[1] || auth.code}] ${auth.playerName}`}
                </span>
                <div className="w-[1px] h-4 bg-slate-700 hidden sm:block"></div>
                <button onClick={handleLogout} className="text-rose-400 hover:text-rose-300 text-[10px] md:text-xs font-bold transition-colors">{t('home.logout')}</button>
             </div>
          )}
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-1 rounded-xl md:rounded-2xl border border-slate-800/80 transition-all duration-300 relative overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.6)] bg-[#090e17] flex flex-col">
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: 'linear-gradient(#38bdf8 1px, transparent 1px), linear-gradient(90deg, #38bdf8 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
          <div className="absolute -top-[30%] -left-[10%] w-[70%] h-[70%] bg-cyan-600/15 rounded-full blur-[140px]"></div>
          <div className="absolute top-[10%] -right-[20%] w-[60%] h-[60%] bg-indigo-600/15 rounded-full blur-[140px]"></div>
          <div className="absolute -bottom-[40%] left-[20%] w-[60%] h-[60%] bg-rose-600/10 rounded-full blur-[140px]"></div>
        </div>

        <div className="relative z-10 p-4 md:p-6 h-full w-full flex flex-col overflow-y-auto hide-scroll">
          {!isRosterOpen ? (
            <div className="flex-1 flex flex-col items-center justify-center py-4">
              {isLogged ? (
                <div className="w-full max-w-6xl flex flex-col items-center animate-in fade-in zoom-in-95 duration-500">
                  <div className="flex flex-col items-center gap-3 md:gap-4 mb-8 md:mb-14 text-center">
                    <div className="inline-flex items-center gap-2 md:gap-3 px-4 py-1.5 md:px-6 md:py-2.5 rounded-full bg-slate-900/60 border border-slate-700/80 text-slate-300 text-[10px] md:text-xs font-bold shadow-2xl backdrop-blur-xl">
                      <span className="relative flex h-2 w-2 md:h-3 md:w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 md:h-3 md:w-3 bg-emerald-500 shadow-[0_0_10px_#10b981]"></span></span>
                      {t('home.system_online')} <span className="text-slate-600 hidden sm:inline">|</span> 
                      <span className="hidden sm:inline">{t('home.profile')}</span> <span className="text-cyan-400 font-black">{auth.role === 'admin' || auth.role === 'consulente' ? 'MASTER' : auth.role === 'guest' ? 'GUEST (SANDBOX)' : auth.code}</span>
                    </div>
                    <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-white tracking-tight drop-shadow-[0_4px_20px_rgba(0,0,0,0.8)] px-2">
                      {hubView === 'main' ? t('home.dashboard_title') : hubView === 'events' ? t('home.tactical_sim_title') : hubView === 'governance' ? t('governance.title', 'Governo Alleanza') : t('home.territory_title')}
                    </h2>
                  </div>

                  {/* CONSOLE ADMIN */}
                  {(auth.role === 'admin' || auth.role === 'consulente') && (
                    <div className="w-full max-w-4xl bg-rose-950/40 border border-rose-500/30 p-5 rounded-2xl mb-8 flex flex-col gap-4 shadow-lg backdrop-blur-md">
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="text-left w-full">
                           <h3 className="text-rose-400 font-black text-lg flex items-center gap-2">{t('home.consultant_console')}</h3>
                           <p className="text-slate-400 text-xs mt-1">{t('home.consultant_desc')}</p>
                        </div>
                        <div className="flex w-full sm:w-auto gap-2 shrink-0">
                          <select value={selectedAdminAlliance} onChange={(e) => setSelectedAdminAlliance(e.target.value)} className="w-40 bg-slate-900 border border-rose-900/50 rounded-xl px-3 py-2 text-white font-bold outline-none cursor-pointer">
                            {allianceList.map(tag => (<option key={tag} value={tag}>{tag}</option>))}
                          </select>
                          <button onClick={() => handleLoadAllianceAsAdmin(selectedAdminAlliance)} className="px-5 py-2 bg-rose-700 hover:bg-rose-600 text-white font-black text-xs uppercase rounded-xl shadow-lg transition-all">{t('home.load_data')}</button>
                        </div>
                      </div>

                      {/* 📌 ALERT TICKET APERTI */}
                      {openTicketsCount > 0 && (
                         <div className="bg-rose-900/80 border border-rose-500 p-4 rounded-xl flex items-center justify-between shadow-[0_0_15px_rgba(225,29,72,0.6)] animate-in fade-in zoom-in duration-300">
                            <div className="flex items-center gap-3">
                               <span className="text-3xl animate-bounce">🚨</span>
                               <div>
                                  <div className="text-white font-black text-sm">{t('home.alert_tickets_title', 'ATTENZIONE MASTER!')}</div>
                                  <div className="text-rose-200 text-xs mt-0.5">{t('home.alert_tickets_desc', 'Ci sono {{count}} segnalazioni o richieste PIN in sospeso.', { count: openTicketsCount })}</div>
                               </div>
                            </div>
                            <button onClick={() => navigate('/admin')} className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-black text-[10px] uppercase rounded-lg transition-colors hidden sm:block shadow-lg border border-rose-500/50">
                               Apri God Room
                            </button>
                         </div>
                      )}

                      <div className="border-t border-rose-900/50 pt-4 flex justify-end relative">
                        <button onClick={() => navigate('/admin')} className="relative px-6 py-2 bg-slate-900 hover:bg-indigo-900 text-indigo-400 font-black text-xs uppercase tracking-widest rounded-xl border border-indigo-500/30 transition-all flex items-center gap-2 shadow-lg">
                           <span>🛠️</span> {t('home.god_room')}
                           
                           {/* 📌 BADGE DI NOTIFICA SUL BOTTONE */}
                           {openTicketsCount > 0 && (
                              <span className="absolute -top-2 -right-2 bg-rose-600 text-white text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-full shadow-[0_0_10px_rgba(225,29,72,1)] animate-pulse border border-white/20">
                                 {openTicketsCount}
                              </span>
                           )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* VISTE DEL MENU */}
                  {hubView === 'main' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-8 w-full px-2 md:px-8">
                      {auth.role !== 'single' && (
                        <button onClick={() => navigate('/map', { state: { initialView: 'global' }})} className="group relative overflow-hidden flex flex-col items-center justify-center py-8 lg:py-12 bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 border-t-white/10 hover:border-cyan-500/50 rounded-[2rem] transition-all shadow-[0_10px_30px_rgba(0,0,0,0.5)]"><span className="text-4xl lg:text-5xl mb-4 group-hover:scale-110 transition-transform">🌍</span><span className="text-xl lg:text-2xl font-black text-white">{t('home.global_map')}</span></button>
                      )}
                      <button onClick={() => setHubView('events')} className="group relative overflow-hidden flex flex-col items-center justify-center py-8 lg:py-12 bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 border-t-white/10 hover:border-rose-500/50 rounded-[2rem] transition-all shadow-[0_10px_30px_rgba(0,0,0,0.5)]"><span className="text-4xl lg:text-5xl mb-4 group-hover:scale-110 transition-transform">⚔️</span><span className="text-xl lg:text-2xl font-black text-white">{t('home.events_tactic')}</span></button>
                      {auth.role !== 'single' && (
                        <button onClick={() => setHubView('alliance')} className="group relative overflow-hidden flex flex-col items-center justify-center py-8 lg:py-12 bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 border-t-white/10 hover:border-indigo-500/50 rounded-[2rem] transition-all shadow-[0_10px_30px_rgba(0,0,0,0.5)]"><span className="text-4xl lg:text-5xl mb-4 group-hover:scale-110 transition-transform">🛡️</span><span className="text-xl lg:text-2xl font-black text-white">{t('home.alliance_menu')}</span></button>
                      )}
                      <button onClick={() => { if(checkAccess('viking')) navigate('/viking'); }} className="group relative overflow-hidden flex flex-col items-center justify-center py-8 lg:py-12 bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 border-t-white/10 hover:border-amber-500/50 rounded-[2rem] transition-all shadow-[0_10px_30px_rgba(0,0,0,0.5)]"><span className="text-4xl lg:text-5xl mb-4 group-hover:scale-110 transition-transform">📊</span><span className="text-xl lg:text-2xl font-black text-white">{t('home.viking_center')}</span></button>
                    </div>
                  )}

                  {hubView === 'events' && (
                    <div className="flex flex-col w-full px-2 md:px-8 gap-4 lg:gap-8 animate-in slide-in-from-right-8 duration-300">
                      <button onClick={() => setHubView('main')} className="text-slate-400 hover:text-white font-bold text-xs uppercase mb-2 text-left w-fit flex items-center px-6 py-3 border border-slate-700 bg-slate-900 rounded-full">{t('home.back_menu')}</button>
                      
                      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 ${(auth.role === 'admin' || auth.role === 'consulente' || auth.castleAccess || allianceDbData?.premiumFeatures?.castleBattle) ? 'xl:grid-cols-4' : ''} gap-4 lg:gap-8 w-full`}>
                        
                        <button onClick={() => navigate('/map', { state: { initialView: 'tactical' }})} className="group flex flex-col items-center justify-center py-12 bg-slate-900/90 border border-slate-700/50 hover:border-rose-500/50 rounded-[2rem]">
                          <span className="text-5xl mb-4 group-hover:scale-110 transition-transform">🎯</span>
                          <span className="text-2xl font-black text-white">{t('home.tactical_room')}</span>
                        </button>
                        
                        <button onClick={() => { if(checkAccess('swordland')) navigate('/swordland'); }} className="group flex flex-col items-center justify-center py-12 bg-slate-900/90 border border-slate-700/50 hover:border-orange-500/50 rounded-[2rem]">
                          <span className="text-5xl mb-4 group-hover:scale-110 transition-transform">🏰</span>
                          <span className="text-2xl font-black text-white">{t('home.swordland')}</span>
                        </button>

                        <button onClick={() => { navigate('/tri-alliance'); }} className="group flex flex-col items-center justify-center py-12 bg-slate-900/90 border border-slate-700/50 hover:border-cyan-500/50 rounded-[2rem] shadow-[0_10px_30px_rgba(0,0,0,0.3)]">
                          <span className="text-5xl mb-4 group-hover:scale-110 transition-transform">⚔️</span>
                          <span className="text-2xl font-black text-white">Tri-Alliance</span>
                          <span className="text-slate-400 mt-2">{t('home.tri_alliance_desc')}</span>
                        </button>

                        {(auth.role === 'admin' || auth.role === 'consulente' || auth.castleAccess || allianceDbData?.premiumFeatures?.castleBattle) && (
                          <button onClick={() => {
                              let kingdom = '';
                              
                              if (auth.role === 'admin' || auth.role === 'consulente') {
                                kingdom = selectedAdminAlliance ? selectedAdminAlliance.split('_')[0] : '';
                                if (!kingdom || kingdom === '0000' || kingdom === 'MASTER' || isNaN(kingdom)) { 
                                  alert("⚠️ Seleziona prima un'alleanza dal menu a tendina in alto (Console Consulente)."); 
                                  return; 
                                }
                              } else {
                                kingdom = auth.realm || (auth.code && auth.code.includes('_') ? auth.code.split('_')[0] : '') || allianceDbData?.kingdom || allianceDbData?.realm;
                                
                                if (!kingdom || isNaN(kingdom)) {
                                  alert("⚠️ Errore: Non riesco a dedurre il tuo Regno (Formato mancante: REGNO_TAG). Chiedi all'Admin di usare lo Strumento 'Normalizzazione DB' dal Pannello Master."); 
                                  return;
                                }
                              }

                              navigate('/map', { state: { initialView: 'tactical', eventMode: 'castle_battle', targetKingdom: kingdom } });
                            }} 
                            className="group flex flex-col items-center justify-center py-12 bg-slate-900/90 border border-slate-700/50 hover:border-fuchsia-500/50 rounded-[2rem] shadow-[0_10px_30px_rgba(0,0,0,0.5)] animate-in fade-in zoom-in duration-300"
                          >
                              <span className="text-5xl mb-4 group-hover:scale-110 transition-transform drop-shadow-[0_0_15px_rgba(217,70,239,0.5)]">👑</span>
                              <span className="text-2xl font-black text-white">{t('home.castle_battle')}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {hubView === 'alliance' && (
                    <div className="flex flex-col w-full px-2 md:px-8 gap-4 lg:gap-8 animate-in slide-in-from-right-8 duration-300">
                      <button onClick={() => setHubView('main')} className="text-slate-400 hover:text-white font-bold text-xs uppercase mb-2 text-left w-fit flex items-center px-6 py-3 border border-slate-700 bg-slate-900 rounded-full">{t('home.back_menu')}</button>
                      <div className={`grid grid-cols-1 ${auth.allianceRole === 'officer' || auth.allianceRole === 'R5' || auth.role === 'admin' || auth.role === 'consulente' ? 'lg:grid-cols-2 xl:grid-cols-4' : 'max-w-sm mx-auto'} gap-4 lg:gap-8 w-full`}>
                        {(auth.allianceRole === 'officer' || auth.allianceRole === 'R5' || auth.role === 'admin' || auth.role === 'consulente') && (
                          <>
                            <button onClick={() => setHubView('governance')} className="group flex flex-col items-center justify-center py-12 bg-slate-900/90 border border-slate-700/50 hover:border-amber-500/50 rounded-[2rem] shadow-[0_10px_30px_rgba(0,0,0,0.3)]"><span className="text-5xl mb-4 group-hover:scale-110 transition-transform">🏛️</span><span className="text-2xl font-black text-white">{t('governance.title', 'Governo Alleanza')}</span></button>
                            <button onClick={() => setIsRosterOpen(true)} className="group flex flex-col items-center justify-center py-12 bg-slate-900/90 border border-slate-700/50 hover:border-indigo-500/50 rounded-[2rem] shadow-[0_10px_30px_rgba(0,0,0,0.3)]"><span className="text-5xl mb-4 group-hover:scale-110 transition-transform">📋</span><span className="text-2xl font-black text-white">{t('home.roster_db')}</span></button>
                            <button onClick={() => navigate('/map', { state: { initialView: 'alliance' }})} className="group flex flex-col items-center justify-center py-12 bg-slate-900/90 border border-slate-700/50 hover:border-blue-500/50 rounded-[2rem] shadow-[0_10px_30px_rgba(0,0,0,0.3)]"><span className="text-5xl mb-4 group-hover:scale-110 transition-transform">📍</span><span className="text-2xl font-black text-white">{t('home.territory')}</span></button>
                          </>
                        )}
                        <button onClick={() => navigate('/march-builder')} className="group flex flex-col items-center justify-center py-12 bg-slate-900/90 border border-slate-700/50 hover:border-emerald-500/50 rounded-[2rem] shadow-[0_10px_30px_rgba(0,0,0,0.3)]"><span className="text-5xl mb-4 group-hover:scale-110 transition-transform">⚙️</span><span className="text-2xl font-black text-white">{t('home.my_marches_title')}</span></button>
                      </div>
                    </div>
                  )}

                  {hubView === 'governance' && (
                     <GovernancePanel auth={auth} roster={roster} setRoster={setRoster} onBack={() => setHubView('alliance')} allianceDbData={allianceDbData} setAllianceDbData={setAllianceDbData} />
                  )}

                </div>
              ) : (
                <div className="bg-slate-900/50 backdrop-blur-2xl p-6 md:p-12 rounded-3xl border border-white/5 border-t-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.6)] flex flex-col items-center gap-6 md:gap-8 animate-in w-[95%] max-w-xl text-center">
                  <div className="w-24 h-24 bg-slate-900 border border-cyan-500/30 text-cyan-400 rounded-3xl flex items-center justify-center text-5xl">👋</div>
                  <div className="space-y-4">
                    <h2 className="text-3xl font-black text-white">{t('home.offline_terminal')}</h2>
                    <p className="text-slate-400 text-sm leading-relaxed font-medium">{t('home.offline_desc')}</p>
                  </div>
                  <button onClick={() => setIsLoginModalOpen(true)} className="px-10 py-5 w-full bg-cyan-600 hover:bg-cyan-500 text-white font-black uppercase rounded-2xl flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(8,145,178,0.4)]">
                    <span className="text-2xl">🔐</span> {t('home.login_system_btn')}
                  </button>
                </div>
              )}
            </div>
          ) : (
             <div className="flex flex-col w-full h-full bg-slate-900/80 backdrop-blur-2xl p-6 rounded-3xl border border-white/10 overflow-y-auto">
               <div className="flex justify-between items-center mb-6 sticky top-0 py-4 bg-transparent z-10">
                 <button onClick={() => setIsRosterOpen(false)} className="px-4 py-2 bg-slate-800 text-white font-bold rounded-xl">{t('home.back_menu')}</button>
               </div>
               
               <RosterTable 
                 roster={roster} 
                 userRole={auth.role === 'admin' || auth.role === 'consulente' ? 'admin' : (auth.allianceRole === 'R5' ? 'R5' : 'R4')}
                 onAddPlayer={(p) => setRoster(prev => [...prev, { id: `player-${Date.now()}`, ...p }])} 
                 onEdit={(id, field, value) => setRoster(prev => prev.map(pl => pl.id === id ? { ...pl, [field]: value } : pl))} 
                 onDelete={handleKickPlayer} 
                 onDeploy={() => setIsRosterOpen(false)} 
               />
               
               <div className="mt-4 flex justify-end">
                  <button onClick={async () => {
                    try { await setDoc(doc(db, "rosters", auth.code), { players: roster }, {merge: true}); alert("✅ Roster salvato in Cloud."); } catch (error) { alert("❌ Errore salvataggio."); }
                  }} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg shadow-lg">Salva Modifiche al Roster</button>
               </div>
             </div>
          )}
        </div>
      </main>
    </div>
  );
}