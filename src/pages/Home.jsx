import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { db } from '../firebase';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { RosterTable } from '../components/RosterTable';

export default function Home({ auth, setAuth, roster, setRoster }) {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const [isRosterOpen, setIsRosterOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [hubView, setHubView] = useState('main');

  const [step, setStep] = useState(0); 
  const [isLoading, setIsLoading] = useState(false);

  const [kingdom, setKingdom] = useState('');
  const [tag, setTag] = useState('');
  const [players, setPlayers] = useState([]);
  const [passwordsDb, setPasswordsDb] = useState({});
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [password, setPassword] = useState('');
  const [founderName, setFounderName] = useState('');

  const [isRecoveringPass, setIsRecoveringPass] = useState(false);
  const [recoveryOfficerId, setRecoveryOfficerId] = useState('');
  const [recoveryOfficerPass, setRecoveryOfficerPass] = useState('');

  const [allianceList, setAllianceList] = useState([]);
  const [selectedAdminAlliance, setSelectedAdminAlliance] = useState('');
  const [accessPasswords, setAccessPasswords] = useState({ master: 'MASTER' });

  const [sysAnnouncement, setSysAnnouncement] = useState(null);

  const isLogged = auth?.role != null && auth?.code !== '';

  const changeLanguage = (lng) => i18n.changeLanguage(lng);

  const handleOpenModal = () => {
    setIsLoginModalOpen(true);
    setStep(0);
    setKingdom(''); setTag(''); setPassword(''); setFounderName('');
    setSelectedPlayerId(''); setPlayers([]); setPasswordsDb({});
    setIsRecoveringPass(false);
  };

  const handleCloseModal = () => setIsLoginModalOpen(false);

  const handleLogout = () => {
    setAuth({ role: null, code: '', allianceRole: null, playerId: null, playerName: '' });
    setRoster([]);
    setHubView('main');
  };

  const checkAccess = (moduleName) => {
    if (auth.role === 'admin' || auth.role === 'consulente') return true; 
    if (moduleName === 'swordland') return true; 
    if (moduleName === 'viking') {
      if (auth.code === 'DEMO') { 
        alert("⛔ Accesso negato: Il Centro Vichinghi non è accessibile nella Demo Tattica. Esci e accedi usando il Tag 'DEMO2'."); 
        return false; 
      }
      if (auth.code === 'DEMO2') { 
        alert("📊 Centro Viking: Accesso consentito in modalità Sola Lettura."); 
        return true; 
      }
      return true; 
    }
    return true;
  };

  // --- LOGICA LOGIN ULTRA-RESILIENTE E CONTROLLO MASTER ---
  const handleCheckAlliance = async (e) => {
    e.preventDefault();
    const cleanTag = tag.toUpperCase().replace(/\s+/g, '');
    const upperPass = password.toUpperCase().trim();

    // INTERCETTA DEMO E DEMO2
    if (cleanTag === 'DEMO' || cleanTag === 'DEMO2') {
      const isDemo2 = cleanTag === 'DEMO2';
      setAuth({ 
        role: 'guest', 
        code: cleanTag, 
        allianceRole: 'officer', 
        playerName: isDemo2 ? 'Analista Demo' : 'Tattico Demo', 
        playerId: cleanTag.toLowerCase() 
      });
      setRoster([
        { id: 'd1', name: 'Ragnar', tag: cleanTag, role: 'R5', power: 120, marches: 2, isParticipating: true },
        { id: 'd2', name: 'Lagertha', tag: cleanTag, role: 'R4', power: 105, marches: 2, isParticipating: true },
        { id: 'd3', name: 'Bjorn', tag: cleanTag, role: 'R3', power: 90, marches: 2, isParticipating: true }
      ]);
      handleCloseModal(); 
      return;
    }

    // CONTROLLO MASTER KEY (Nello STEP 0)
    const masterDbPass = accessPasswords?.master ? String(accessPasswords.master).toUpperCase() : 'MASTER';
    const isMasterInput = (upperPass !== '' && upperPass === masterDbPass) || upperPass === 'MASTER' || upperPass === 'ADMIN' || cleanTag === 'MASTER' || cleanTag === 'ADMIN';

    if (isMasterInput) {
      if (!cleanTag || cleanTag === 'MASTER' || cleanTag === 'ADMIN') {
        setAuth({ role: 'consulente', code: '0000_MASTER', allianceRole: 'officer', playerName: 'Consulente', playerId: 'admin' });
        handleCloseModal();
        return;
      } else {
        const allianceId = kingdom ? `${kingdom}_${cleanTag}` : cleanTag;
        setIsLoading(true);
        try {
          let rosterSnap = await getDoc(doc(db, "rosters", allianceId));
          if (!rosterSnap.exists()) rosterSnap = await getDoc(doc(db, "allianceRoster", allianceId));
          if (rosterSnap.exists()) setRoster(rosterSnap.data().players || []);
        } catch(e) {}
        setAuth({ role: 'consulente', code: allianceId, allianceRole: 'officer', playerName: 'Consulente', playerId: 'admin' });
        handleCloseModal();
        setIsLoading(false);
        return;
      }
    }

    if (!cleanTag) return alert("Devi inserire la Sigla dell'Alleanza.");

    setIsLoading(true);
    try {
      const allianceId = kingdom ? `${kingdom}_${cleanTag}` : cleanTag;
      
      let rosterSnap = await getDoc(doc(db, "rosters", allianceId));
      if (!rosterSnap.exists()) {
        rosterSnap = await getDoc(doc(db, "allianceRoster", allianceId));
      }

      const securitySnap = await getDoc(doc(db, "allianceSecurity", allianceId));

      if (rosterSnap.exists()) {
        const rosterData = rosterSnap.data();
        const secData = securitySnap.exists() ? securitySnap.data().passwords || {} : {};
        
        const fetchedPlayers = (rosterData.players || []).map((p, idx) => ({ ...p, id: p.id || `legacy_${idx}` }));
        
        setPlayers(fetchedPlayers);
        setPasswordsDb(secData);
        setStep(1); 
      } else {
        setStep(2); 
      }
    } catch (error) {
      alert("Errore di connessione al database.");
    }
    setIsLoading(false);
  };

  const handleUserLogin = async (e) => {
    e.preventDefault();
    if (!selectedPlayerId || !password) return alert(t('home.error_empty_login'));

    const upperPass = password.toUpperCase().trim();
    const cleanTag = tag.toUpperCase().trim();
    const allianceId = kingdom ? `${kingdom}_${cleanTag}` : cleanTag;

    // CONTROLLO MASTER KEY (Nello STEP 1)
    const masterDbPass = accessPasswords?.master ? String(accessPasswords.master).toUpperCase() : 'MASTER';
    const isMasterInput = (upperPass !== '' && upperPass === masterDbPass) || upperPass === 'MASTER' || upperPass === 'ADMIN';

    if (isMasterInput) {
      setAuth({ role: 'consulente', code: allianceId, allianceRole: 'officer', playerName: 'Consulente', playerId: 'admin' });
      setRoster(players); 
      handleCloseModal();
      return;
    }

    setIsLoading(true);
    try {
      const isFirstTime = !passwordsDb[selectedPlayerId];

      if (isFirstTime) {
        const updatedPasswords = { ...passwordsDb, [selectedPlayerId]: password };
        await setDoc(doc(db, "allianceSecurity", allianceId), { passwords: updatedPasswords }, { merge: true });
      } else if (passwordsDb[selectedPlayerId] !== password) {
        setIsLoading(false);
        return alert(t('home.wrong_password'));
      }

      const p = players.find(x => x.id === selectedPlayerId);
      const roleStr = String(p?.role || '').toUpperCase();
      const isOfficer = roleStr === 'R5' || roleStr === 'R4' || roleStr.includes('LEADER') || roleStr.includes('OFFICER');
      
      setAuth({ role: 'alliance', code: allianceId, allianceRole: isOfficer ? 'officer' : 'member', playerId: p.id, playerName: p.name });
      setRoster(players); 
      handleCloseModal(); 

    } catch (error) {
      alert(t('home.error_login'));
    }
    setIsLoading(false);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!recoveryOfficerId || !recoveryOfficerPass) return alert(t('home.error_empty'));

    const officer = players.find(p => p.id === recoveryOfficerId);
    const roleStr = String(officer?.role || '').toUpperCase();
    const isOfficer = roleStr === 'R5' || roleStr === 'R4' || roleStr.includes('LEADER') || roleStr.includes('OFFICER');

    if (!isOfficer || passwordsDb[recoveryOfficerId] !== recoveryOfficerPass) {
      return alert(t('home.reset_error_auth'));
    }

    setIsLoading(true);
    try {
      const cleanTag = tag.toUpperCase().trim();
      const allianceId = kingdom ? `${kingdom}_${cleanTag}` : cleanTag;
      const updatedPasswords = { ...passwordsDb };
      delete updatedPasswords[selectedPlayerId]; 

      await setDoc(doc(db, "allianceSecurity", allianceId), { passwords: updatedPasswords }, { merge: true });

      setPasswordsDb(updatedPasswords);
      setIsRecoveringPass(false);
      setRecoveryOfficerId('');
      setRecoveryOfficerPass('');
      alert(t('home.reset_success'));
    } catch (error) {
      alert(t('home.error_network'));
    }
    setIsLoading(false);
  };

  const handleCreateAlliance = async (e) => {
    e.preventDefault();
    
    if (!kingdom || String(kingdom).trim() === '') {
      return alert("⚠️ REGNO MANCANTE: Torna indietro al passo precedente e inserisci il Regno per fondare una nuova Alleanza.");
    }
    
    if (!founderName || !password) return alert(t('home.error_empty_create'));

    setIsLoading(true);
    try {
      const cleanTag = tag.toUpperCase().trim();
      const allianceId = `${kingdom}_${cleanTag}`;
      const founderId = `p_${Date.now()}`;
      const founderPlayer = { id: founderId, name: founderName, role: 'R5', power: 0, marches: 1, isParticipating: true };
      
      await setDoc(doc(db, "rosters", allianceId), { players: [founderPlayer], createdAt: new Date().toISOString() });
      await setDoc(doc(db, "allianceSecurity", allianceId), { passwords: { [founderId]: password } });

      alert(t('home.alliance_created'));
      
      setAuth({ role: 'alliance', code: allianceId, allianceRole: 'officer', playerId: founderId, playerName: founderName });
      setRoster([founderPlayer]); 
      
      handleCloseModal(); 
      setHubView('alliance'); 
      setIsRosterOpen(true);  

    } catch (error) {
      alert(t('home.error_create'));
    }
    setIsLoading(false);
  };

  useEffect(() => {
    const fetchPasswords = async () => {
      try {
        const docRef = doc(db, "settings", "accessCodes");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setAccessPasswords(docSnap.data());
        }
      } catch (error) {}
    };
    fetchPasswords();
  }, []);

  useEffect(() => {
    if (auth.role === 'consulente' || auth.role === 'admin') {
      const fetchAlliances = async () => {
        try {
          const snap1 = await getDocs(collection(db, "rosters"));
          const snap2 = await getDocs(collection(db, "allianceRoster"));
          const set = new Set();
          snap1.docs.forEach(d => set.add(d.id));
          snap2.docs.forEach(d => set.add(d.id));
          set.delete('ADMIN');
          
          const alliances = Array.from(set);
          setAllianceList(alliances);
          if (alliances.length > 0) setSelectedAdminAlliance(alliances[0]);
        } catch (error) {}
      };
      fetchAlliances();
    }
  }, [auth.role]);

  // LOGICA RICEZIONE PATCH NOTES
  useEffect(() => {
    const fetchAnnouncement = async () => {
      try {
        const snap = await getDoc(doc(db, "system", "announcement"));
        if (snap.exists()) {
          const data = snap.data();
          if (data.active) {
            const dismissed = localStorage.getItem('dismissed_patch');
            if (dismissed !== data.version) {
              setSysAnnouncement(data);
            }
          }
        }
      } catch(e) {}
    };
    fetchAnnouncement();
  }, []);

  const dismissAnnouncement = () => {
    if(sysAnnouncement) {
      localStorage.setItem('dismissed_patch', sysAnnouncement.version);
      setSysAnnouncement(null);
    }
  };

  const handleLoadAllianceAsAdmin = async (code) => {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) return;
    setIsLoading(true);
    try {
      let docSnap = await getDoc(doc(db, "rosters", cleanCode));
      if (!docSnap.exists()) {
        docSnap = await getDoc(doc(db, "allianceRoster", cleanCode));
      }
      
      if (docSnap.exists()) { 
        setRoster(docSnap.data().players || []); 
        alert(`✅ Dati [${cleanCode}] caricati!`); 
      } else { 
        setRoster([]); 
        alert(`⚠️ Alleanza [${cleanCode}] non trovata.`); 
      }
      setAuth({ ...auth, code: cleanCode, allianceRole: 'officer' }); 
    } catch (error) { alert("❌ Errore caricamento."); }
    setIsLoading(false);
  };

  const handleSaveMasterKey = async () => {
    try {
      await setDoc(doc(db, "settings", "accessCodes"), { master: accessPasswords.master }, { merge: true });
      alert("✅ Master Key salvata con successo!");
    } catch (error) {
      alert("❌ Errore durante il salvataggio.");
    }
  };

  const handleAddPlayer = (playerData) => setRoster(prev => [...prev, { id: `player-${Date.now()}`, ...playerData }]);
  const handleEditPlayer = (id, field, value) => setRoster(prev => prev.map(player => player.id === id ? { ...player, [field]: value } : player));
  const handleDeletePlayer = (id) => setRoster(prev => prev.filter(player => player.id !== id));

  return (
    <div className="h-screen bg-slate-950 p-2 md:p-4 flex flex-col gap-2 md:gap-4 overflow-hidden select-none">
      <style>{`.hide-scroll::-webkit-scrollbar { display: none; } .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
      
      <header className="flex justify-between items-center bg-slate-900/40 backdrop-blur-xl px-4 md:px-6 py-3 md:py-4 rounded-xl md:rounded-2xl border border-white/5 shadow-[0_8px_30px_rgb(0,0,0,0.3)] shrink-0 z-20">
        <div className="flex items-center gap-2 md:gap-4">
          <h1 className="text-xl md:text-2xl font-black text-white tracking-wider cursor-pointer flex items-center gap-2 drop-shadow-md hover:text-cyan-100 transition-colors" onClick={() => setHubView('main')}>
            <span className="text-cyan-500 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]">❖</span> 
            <span className="hidden sm:inline">HUB</span> <span className="text-cyan-400">KINGSHOT</span>
          </h1>
        </div>
        
        <div className="flex gap-3 items-center">
          <div className="flex bg-slate-800 p-0.5 rounded border border-slate-700 text-xs">
            {['it', 'en', 'pl', 'fr'].map(lng => (
              <button key={lng} onClick={() => changeLanguage(lng)} className={`px-1.5 py-0.5 rounded font-bold transition-colors uppercase ${i18n.language === lng ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}>{lng}</button>
            ))}
          </div>

          {!isLogged ? (
             <button onClick={handleOpenModal} className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] md:text-xs font-black uppercase tracking-wider rounded-lg md:rounded-xl border border-cyan-400/50 transition-all shadow-[0_0_15px_rgba(8,145,178,0.4)]">
               {t('home.login_btn')}
             </button>
          ) : (
            <>
              {(auth.role === 'admin' || auth.role === 'consulente') && (
                <button onClick={() => setIsSettingsOpen(true)} className="px-3 md:px-4 py-1.5 md:py-2 bg-rose-950/30 hover:bg-rose-900/50 text-rose-400 text-[10px] md:text-xs font-bold rounded-lg md:rounded-xl border border-rose-500/20 transition-all flex items-center gap-1.5 md:gap-2 backdrop-blur-sm shadow-[0_0_15px_rgba(225,29,72,0.1)] hover:shadow-[0_0_15px_rgba(225,29,72,0.3)]">
                  <span>⚙️</span> <span className="hidden sm:inline">{t('home.master_panel')}</span>
                </button>
              )}
              <div className="flex items-center gap-3 bg-slate-900/50 px-3 py-1.5 md:px-4 md:py-2 rounded-lg md:rounded-xl border border-white/10 backdrop-blur-sm">
                <span className="text-slate-400 text-[10px] md:text-xs font-bold uppercase hidden sm:inline">
                  {auth.role === 'consulente' || auth.role === 'admin' ? `👑 ${auth.playerName}` : `🛡️ [${auth.code.split('_')?.[1] || auth.code}] ${auth.playerName}`}
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

      <main className="flex-1 rounded-xl md:rounded-2xl border border-slate-800/80 transition-all duration-300 relative overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.6)] bg-[#090e17] flex flex-col">
        
        {/* POP-UP PATCH NOTES */}
        {sysAnnouncement && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <div className="bg-slate-900 border border-indigo-500/50 p-6 md:p-8 rounded-3xl shadow-[0_0_40px_rgba(79,70,229,0.3)] max-w-lg w-full relative">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                <h3 className="text-xl font-black text-white flex items-center gap-2"><span>📢</span> Aggiornamento Sistema</h3>
                <span className="bg-indigo-600 text-white text-[10px] font-black px-2 py-1 rounded">{sysAnnouncement.version}</span>
              </div>
              <div className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed max-h-[40vh] overflow-y-auto custom-scrollbar pr-2 mb-6">
                {sysAnnouncement.text}
              </div>
              <button onClick={dismissAnnouncement} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest rounded-xl transition-all shadow-[0_0_15px_rgba(79,70,229,0.4)]">
                Ricevuto, Chiudi
              </button>
            </div>
          </div>
        )}

        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: 'linear-gradient(#38bdf8 1px, transparent 1px), linear-gradient(90deg, #38bdf8 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
          <div className="absolute -top-[30%] -left-[10%] w-[70%] h-[70%] bg-cyan-600/15 rounded-full blur-[140px]"></div>
          <div className="absolute top-[10%] -right-[20%] w-[60%] h-[60%] bg-indigo-600/15 rounded-full blur-[140px]"></div>
          <div className="absolute -bottom-[40%] left-[20%] w-[60%] h-[60%] bg-rose-600/10 rounded-full blur-[140px]"></div>
        </div>

        <div className="relative z-10 p-4 md:p-6 h-full w-full flex flex-col overflow-y-auto hide-scroll">
          
          {isLoginModalOpen && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
              <div className="bg-slate-900/95 border border-white/10 p-8 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col gap-6 w-full max-w-sm animate-in zoom-in-95 duration-200 relative">
                <button onClick={handleCloseModal} className="absolute top-4 right-4 text-slate-500 hover:text-rose-400">✕</button>
                <div className="mx-auto w-16 h-16 bg-cyan-950 border border-cyan-500/50 rounded-2xl flex items-center justify-center text-3xl shadow-[0_0_20px_rgba(8,145,178,0.3)]">🔐</div>
                
                {step === 0 && (
                  <form onSubmit={handleCheckAlliance} className="flex flex-col gap-4">
                    <div className="text-center">
                      <h3 className="text-2xl font-black text-white">{t('home.modal_title')}</h3>
                      <p className="text-xs text-slate-400 mt-2">{t('home.modal_subtitle')}</p>
                    </div>
                    <div className="flex gap-2 w-full">
                      <input type="number" placeholder={t('home.modal_kingdom')} value={kingdom} onChange={e => setKingdom(e.target.value)} className="w-1/3 bg-slate-950 border border-slate-700 rounded-xl px-3 py-3 text-center text-white font-black focus:outline-none focus:border-cyan-500 shadow-inner hide-scroll" />
                      <input type="text" placeholder={t('home.modal_tag')} value={tag} onChange={e => setTag(e.target.value)} className="w-2/3 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-center text-white font-black tracking-widest uppercase focus:outline-none focus:border-cyan-500 shadow-inner" />
                    </div>
                    <input type="password" placeholder="Master Key (Lascia vuoto per giocatori)" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-center text-white focus:outline-none focus:border-cyan-500 shadow-inner" />
                    <button type="submit" disabled={isLoading} className="w-full py-3.5 bg-cyan-600 hover:bg-cyan-500 text-white font-black rounded-xl transition-colors text-sm shadow-[0_0_15px_rgba(8,145,178,0.4)] disabled:opacity-50 mt-2">
                      {isLoading ? t('home.modal_loading') : t('home.btn_next')}
                    </button>
                  </form>
                )}

                {step === 1 && !isRecoveringPass && (
                  <form onSubmit={handleUserLogin} className="flex flex-col gap-4">
                    <div className="text-center">
                      <h3 className="text-xl font-black text-white">{t('home.auth_title')}</h3>
                      <p className="text-xs text-slate-400 mt-1">[{tag.toUpperCase()}] {kingdom}</p>
                    </div>
                    <select value={selectedPlayerId} onChange={e => setSelectedPlayerId(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-500 cursor-pointer">
                      <option value="">{t('home.who_are_you')}</option>
                      {players.map(p => (<option key={p.id} value={p.id}>[{p.role}] {p.name}</option>))}
                    </select>
                    {selectedPlayerId && (
                      <div className="flex flex-col gap-2">
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={passwordsDb[selectedPlayerId] ? t('home.enter_password') : t('home.create_password')} autoComplete="current-password" className="w-full bg-slate-950 border border-cyan-500/50 rounded-xl px-4 py-3 text-center text-white focus:outline-none focus:border-cyan-500 shadow-inner tracking-[0.3em] font-mono" />
                        
                        {passwordsDb[selectedPlayerId] && (
                          <button type="button" onClick={() => setIsRecoveringPass(true)} className="text-xs text-rose-400 hover:text-rose-300 font-bold self-end mr-1 transition-colors">
                            {t('home.forgot_password')}
                          </button>
                        )}
                      </div>
                    )}
                    <button type="submit" disabled={isLoading || !selectedPlayerId} className="w-full py-3.5 bg-cyan-600 hover:bg-cyan-500 text-white font-black rounded-xl transition-colors text-sm shadow-[0_0_15px_rgba(8,145,178,0.4)] disabled:opacity-50 mt-2">
                      {isLoading ? t('home.modal_loading') : t('home.modal_enter')}
                    </button>
                    <button type="button" onClick={() => setStep(0)} className="text-xs font-bold text-slate-500 hover:text-white mt-1 uppercase">{t('home.back')}</button>
                  </form>
                )}

                {step === 1 && isRecoveringPass && (
                  <form onSubmit={handleResetPassword} className="flex flex-col gap-4 animate-fade-in">
                    <div className="text-center">
                      <h3 className="text-xl font-black text-rose-400">{t('home.recovery_title')}</h3>
                      <p className="text-[10px] text-slate-400 mt-2 leading-relaxed px-2">{t('home.recovery_desc')}</p>
                    </div>
                    
                    <select value={recoveryOfficerId} onChange={e => setRecoveryOfficerId(e.target.value)} className="w-full bg-slate-950 border border-rose-500/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-rose-400 cursor-pointer text-sm">
                      <option value="">{t('home.select_officer')}</option>
                      {players.filter(p => p.role === 'R5' || p.role === 'R4' || String(p.role).toUpperCase().includes('OFFICER')).map(p => (
                        <option key={p.id} value={p.id}>[{p.role}] {p.name}</option>
                      ))}
                    </select>
                    
                    {recoveryOfficerId && (
                      <input type="password" value={recoveryOfficerPass} onChange={e => setRecoveryOfficerPass(e.target.value)} placeholder={t('home.officer_password')} autoComplete="current-password" className="w-full bg-slate-950 border border-rose-500/50 rounded-xl px-4 py-3 text-center text-white focus:outline-none focus:border-rose-400 shadow-inner tracking-[0.3em] font-mono text-sm" />
                    )}

                    <button type="submit" disabled={isLoading || !recoveryOfficerId || !recoveryOfficerPass} className="w-full py-3.5 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-xl transition-colors text-sm shadow-[0_0_15px_rgba(225,29,72,0.4)] disabled:opacity-50 mt-2">
                      {isLoading ? t('home.modal_loading') : t('home.btn_reset_pass')}
                    </button>
                    <button type="button" onClick={() => setIsRecoveringPass(false)} className="text-xs font-bold text-slate-500 hover:text-white mt-1 uppercase">{t('home.cancel')}</button>
                  </form>
                )}

                {step === 2 && (
                  <form onSubmit={handleCreateAlliance} className="flex flex-col gap-4">
                    <div className="text-center">
                      <h3 className="text-xl font-black text-amber-400">{t('home.create_title')}</h3>
                      <p className="text-[10px] text-slate-400 mt-2">Nuova Alleanza [{tag.toUpperCase()}] {kingdom}</p>
                    </div>
                    <input type="text" placeholder={t('home.founder_name')} value={founderName} onChange={e => setFounderName(e.target.value)} className="w-full bg-slate-950 border border-amber-500/50 rounded-xl px-4 py-3 text-center text-white font-black focus:outline-none focus:border-amber-400 shadow-inner" required />
                    <input type="password" placeholder={t('home.founder_pass')} value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" className="w-full bg-slate-950 border border-amber-500/50 rounded-xl px-4 py-3 text-center text-white font-black focus:outline-none focus:border-amber-400 shadow-inner tracking-[0.3em] font-mono" required />
                    <button type="submit" disabled={isLoading} className="w-full py-3.5 bg-amber-600 hover:bg-amber-500 text-white font-black rounded-xl transition-colors text-sm shadow-[0_0_15px_rgba(217,119,6,0.4)] disabled:opacity-50 mt-2">
                      {isLoading ? t('home.modal_loading') : t('home.register_btn')}
                    </button>
                    <button type="button" onClick={() => setStep(0)} className="text-xs font-bold text-slate-500 hover:text-white mt-1 uppercase">{t('home.back')}</button>
                  </form>
                )}

              </div>
            </div>
          )}

          {isSettingsOpen && (auth.role === 'admin' || auth.role === 'consulente') ? (
             <div className="flex flex-col w-full max-w-5xl mx-auto bg-slate-900/80 backdrop-blur-xl p-4 md:p-8 rounded-2xl md:rounded-3xl border border-rose-900/40 border-t-rose-500/30 animate-in fade-in zoom-in-95 duration-300 mt-4 md:mt-10">
               <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-700">
                 <button onClick={() => setIsSettingsOpen(false)} className="px-4 py-2 bg-slate-800 text-slate-200 text-xs font-bold rounded-xl border border-white/5 transition-colors">{t('home.back_menu')}</button>
                 <h2 className="text-xl font-bold text-rose-400">⚙️ {t('home.master_panel')}</h2>
               </div>
               
               <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-700/50 shadow-inner w-1/2 flex flex-col gap-3">
                 <label className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Master Key (Password di sistema)</label>
                 <input type="text" value={accessPasswords.master} onChange={(e) => setAccessPasswords(prev => ({ ...prev, master: e.target.value }))} className="bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-sm text-white font-bold focus:outline-none w-full"/>
                 <button onClick={handleSaveMasterKey} className="px-4 py-3 bg-cyan-700 hover:bg-cyan-600 text-white font-bold text-xs uppercase rounded-xl transition-all shadow-[0_0_10px_rgba(8,145,178,0.4)]">
                   Salva nuova Key
                 </button>
               </div>
             </div>
          ) : !isRosterOpen ? (
            
            <div className="flex-1 flex flex-col items-center justify-center py-4">
              {isLogged ? (
                <div className="w-full max-w-6xl flex flex-col items-center animate-in fade-in zoom-in-95 duration-500">
                  <div className="flex flex-col items-center gap-3 md:gap-4 mb-8 md:mb-14 text-center">
                    <div className="inline-flex items-center gap-2 md:gap-3 px-4 py-1.5 md:px-6 md:py-2.5 rounded-full bg-slate-900/60 border border-slate-700/80 text-slate-300 text-[10px] md:text-xs font-bold shadow-2xl backdrop-blur-xl">
                      <span className="relative flex h-2 w-2 md:h-3 md:w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 md:h-3 md:w-3 bg-emerald-500 shadow-[0_0_10px_#10b981]"></span>
                      </span>
                      {t('home.system_online')} <span className="text-slate-600 hidden sm:inline">|</span> 
                      <span className="hidden sm:inline">{t('home.profile')}</span> 
                      <span className="text-cyan-400 font-black">{auth.role === 'admin' || auth.role === 'consulente' ? 'MASTER' : auth.role === 'guest' ? 'GUEST (SANDBOX)' : auth.code}</span>
                    </div>
                    <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-white tracking-tight drop-shadow-[0_4px_20px_rgba(0,0,0,0.8)] px-2">
                      {hubView === 'main' ? t('home.dashboard_title') : hubView === 'events' ? t('home.tactical_sim_title') : t('home.territory_title')}
                    </h2>
                  </div>

                  {(auth.role === 'admin' || auth.role === 'consulente') && (
                    <div className="w-full max-w-4xl bg-rose-950/40 border border-rose-500/30 p-5 rounded-2xl mb-8 flex flex-col gap-4 shadow-lg backdrop-blur-md">
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="text-left w-full">
                           <h3 className="text-rose-400 font-black text-lg flex items-center gap-2">👑 Console Consulente</h3>
                           <p className="text-slate-400 text-xs mt-1">Scegli un'alleanza dal DB e caricala nel sistema per visionarla.</p>
                        </div>
                        <div className="flex w-full sm:w-auto gap-2 shrink-0">
                          <select value={selectedAdminAlliance} onChange={(e) => setSelectedAdminAlliance(e.target.value)} className="w-40 bg-slate-900 border border-rose-900/50 rounded-xl px-3 py-2 text-white font-bold outline-none cursor-pointer">
                            {allianceList.map(tag => (<option key={tag} value={tag}>{tag}</option>))}
                          </select>
                          <button onClick={() => handleLoadAllianceAsAdmin(selectedAdminAlliance)} className="px-5 py-2 bg-rose-700 hover:bg-rose-600 text-white font-black text-xs uppercase rounded-xl shadow-lg transition-all">Carica Dati</button>
                        </div>
                      </div>

                      <div className="border-t border-rose-900/50 pt-4 flex justify-end">
                        <button onClick={() => navigate('/admin')} className="px-6 py-2 bg-slate-900 hover:bg-indigo-900 text-indigo-400 font-black text-xs uppercase tracking-widest rounded-xl border border-indigo-500/30 transition-all flex items-center gap-2 shadow-lg">
                          <span>🛠️</span> Apri God Room (Pannello DB)
                        </button>
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
                      
                      <div className={`grid grid-cols-1 ${auth.allianceRole === 'officer' || auth.role === 'admin' || auth.role === 'consulente' ? 'lg:grid-cols-3' : 'max-w-sm mx-auto'} gap-4 lg:gap-8 w-full`}>
                        
                        {(auth.allianceRole === 'officer' || auth.role === 'admin' || auth.role === 'consulente') && (
                          <>
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
                          </>
                        )}

                        <button onClick={() => navigate('/march-builder')} className="group flex flex-col items-center justify-center py-12 bg-slate-900/90 border border-slate-700/50 hover:border-emerald-500/50 rounded-[2rem] shadow-[0_10px_30px_rgba(0,0,0,0.3)]">
                          <span className="text-5xl mb-4 group-hover:scale-110 transition-transform">⚙️</span>
                          <span className="text-2xl font-black text-white">Mie Marce</span>
                          <span className="text-slate-400 mt-2">Configura Eroi e Truppe</span>
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              ) : (
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
                      <li>• Modalità Demo: Usa Tag DEMO (Tattica) o DEMO2 (Sola Lettura) per testare liberamente.</li>
                    </ul>
                  </div>
                  <button onClick={handleOpenModal} className="px-10 py-5 w-full bg-cyan-600 hover:bg-cyan-500 text-white font-black uppercase rounded-2xl flex items-center justify-center gap-3">
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
                 onAddPlayer={handleAddPlayer} 
                 onEdit={handleEditPlayer} 
                 onDelete={handleDeletePlayer} 
                 onDeploy={() => setIsRosterOpen(false)} 
               />

               <div className="mt-4 flex justify-end">
                  <button onClick={async () => {
                    try { 
                      await setDoc(doc(db, "rosters", auth.code), { players: roster }, {merge: true}); 
                      alert("✅ Roster salvato in Cloud."); 
                    } catch (error) { alert("❌ Errore salvataggio."); }
                  }} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg shadow-lg">
                    Salva Modifiche al Roster
                  </button>
               </div>
             </div>
          )}
        </div>
      </main>
    </div>
  );
}