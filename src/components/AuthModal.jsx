import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { db } from '../firebase';
import { doc, getDoc, setDoc, collection, getDocs, query, where } from 'firebase/firestore';

export default function AuthModal({ onClose, setAuth, setRoster, setHubView, setIsRosterOpen, accessPasswords }) {
  const { t } = useTranslation();
  
  const [loginMode, setLoginMode] = useState('select'); 
  const [isLoading, setIsLoading] = useState(false);
  
  const [playerName, setPlayerName] = useState('');
  const [kingdom, setKingdom] = useState('');
  const [pin, setPin] = useState('');
  const [allianceTag, setAllianceTag] = useState('');
  const [allianceName, setAllianceName] = useState('');
  const [ticketMessage, setTicketMessage] = useState(''); 

  const [showPassword, setShowPassword] = useState(false);
  const [userTickets, setUserTickets] = useState(null);

  const getMasterAccessLevel = (inputUser, inputPass) => {
    if(!inputPass || !inputUser) return null;
    const upperPass = inputPass.toUpperCase().trim();
    const upperUser = inputUser.toUpperCase().trim();
    if(accessPasswords.master && String(accessPasswords.master).toUpperCase() === upperPass && upperUser === 'ADMIN') return { role: 'admin', castleAccess: true, name: 'Admin Supremo' };
    for(const key in accessPasswords) {
        if(key === 'master') continue;
        if(key.toUpperCase() === upperUser) {
            const val = accessPasswords[key];
            if(typeof val === 'object' && val !== null && String(val.password).toUpperCase() === upperPass) return { role: 'consulente', castleAccess: val.castleAccess, name: key };
            else if (typeof val === 'string' && val.toUpperCase() === upperPass) return { role: 'consulente', castleAccess: false, name: key };
        }
    }
    return null;
  };

  const handleTicketSubmit = async (e) => {
    e.preventDefault();
    if (!playerName || !ticketMessage) return alert(t('auth_modal.req_name_msg'));
    setIsLoading(true);

    try {
      const ticketId = `tkt_${Date.now()}`;
      await setDoc(doc(db, "tickets", ticketId), {
        playerName: playerName.trim(), kingdom: kingdom.trim(), allianceTag: allianceTag.toUpperCase().trim(),
        message: ticketMessage.trim(), status: 'Open', createdAt: new Date().toISOString(), adminReply: ''
      });
      alert(t('auth_modal.ticket_success'));
      setLoginMode('select');
      setTicketMessage('');
    } catch (error) { alert(t('auth_modal.ticket_error')); }
    setIsLoading(false);
  };

  const handleCheckTicketStatus = async (e) => {
    e.preventDefault();
    if (!playerName || !kingdom) return alert("Inserisci Nome in gioco e Regno per cercare la tua pratica.");
    
    setIsLoading(true);
    setUserTickets(null);
    try {
      const q = query(collection(db, "tickets"), where("playerName", "==", playerName.trim()), where("kingdom", "==", kingdom.trim()));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        alert("Non risultano segnalazioni o richieste di recupero con questo nome e regno.");
      } else {
        const foundTickets = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
        setUserTickets(foundTickets);
      }
    } catch (err) {
      console.error(err);
      alert("Errore di connessione al database.");
    }
    setIsLoading(false);
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    if (!playerName || !pin) return alert(t('auth_modal.req_name_pin'));
    setIsLoading(true);
    const cleanName = playerName.trim();
    const cleanKingdom = kingdom.trim() || "0000";
    const cleanTag = allianceTag.toUpperCase().replace(/\s+/g, '');

    try {
      const masterAccess = getMasterAccessLevel(cleanName, pin);
      if (masterAccess) {
          setAuth({ role: masterAccess.role, castleAccess: masterAccess.castleAccess, code: '0000_MASTER', allianceRole: 'officer', playerName: masterAccess.name, playerId: 'admin' });
          onClose(); setIsLoading(false); return;
      }

      if (cleanTag === 'DEMO' || cleanTag === 'DEMO2') {
        const isDemo2 = cleanTag === 'DEMO2';
        setAuth({ role: 'guest', code: cleanTag, allianceRole: 'officer', playerName: isDemo2 ? 'Analista Demo' : 'Tattico Demo', playerId: cleanTag.toLowerCase(), castleAccess: false });
        setRoster([{ id: 'd1', name: 'Ragnar', tag: cleanTag, role: 'R5', power: 120, marches: 2, isParticipating: true }, { id: 'd2', name: 'Lagertha', tag: cleanTag, role: 'R4', power: 105, marches: 2, isParticipating: true }]);
        onClose(); setIsLoading(false); return;
      }

      if (loginMode === 'login') {
         if (!kingdom && cleanName.toUpperCase() !== 'ADMIN') { setIsLoading(false); return alert(t('auth_modal.req_kingdom')); }
         const q = query(collection(db, "users"), where("displayName", "==", cleanName), where("kingdom", "==", cleanKingdom));
         const snap = await getDocs(q);
         if (snap.empty) { setIsLoading(false); return alert(t('auth_modal.player_not_found')); }

         const userDoc = snap.docs[0];
         const userData = userDoc.data();

         if (userData.pin !== pin) { setIsLoading(false); return alert(t('auth_modal.wrong_pin')); }
         if (userData.status === 'Pending') { setIsLoading(false); return alert(t('auth_modal.account_pending')); }
         if (userData.status === 'Banned') { setIsLoading(false); return alert(t('auth_modal.account_banned')); }

         if (userData.allianceId) {
             let rosterSnap = await getDoc(doc(db, "rosters", userData.allianceId));
             if (rosterSnap.exists()) setRoster(rosterSnap.data().players || []);
         }
         const isOfficer = ['R5', 'R4'].includes(String(userData.role).toUpperCase()) || String(userData.role).toUpperCase().includes('LEADER');
         setAuth({ role: userData.allianceId ? 'alliance' : 'single', code: userData.allianceId || 'SINGLE', allianceRole: isOfficer ? 'officer' : 'member', playerId: userDoc.id, playerName: userData.displayName, castleAccess: false });
         onClose();
      }
      else if (loginMode === 'join') {
         if (!kingdom) { setIsLoading(false); return alert(t('auth_modal.req_kingdom')); }
         const q = query(collection(db, "users"), where("displayName", "==", cleanName), where("kingdom", "==", cleanKingdom));
         const snap = await getDocs(q);
         if (!snap.empty) { setIsLoading(false); return alert(t('auth_modal.name_registered')); }
         const newUserId = `u_${Date.now()}`;
         const targetAllianceId = cleanTag ? `${cleanKingdom}_${cleanTag}` : null;
         
         await setDoc(doc(db, "users", newUserId), { displayName: cleanName, kingdom: cleanKingdom, pin: pin, allianceId: targetAllianceId, role: targetAllianceId ? 'Member' : 'Single', status: targetAllianceId ? 'Pending' : 'Approved', createdAt: new Date().toISOString() });

         if (targetAllianceId) { alert(t('auth_modal.request_sent')); onClose(); } 
         else { alert(t('auth_modal.single_created')); setAuth({ role: 'single', code: 'SINGLE', allianceRole: 'member', playerId: newUserId, playerName: cleanName, castleAccess: false }); onClose(); }
      }
      else if (loginMode === 'create') {
         if (!kingdom || !cleanTag || !allianceName) { setIsLoading(false); return alert(t('auth_modal.fill_all_fields')); }
         const newAllianceId = `${cleanKingdom}_${cleanTag}`;
         const allianceSnap = await getDoc(doc(db, "alliances", newAllianceId));
         if (allianceSnap.exists()) { setIsLoading(false); return alert(t('auth_modal.alliance_exists')); }

         const newUserId = `u_${Date.now()}`;
         await setDoc(doc(db, "users", newUserId), { displayName: cleanName, kingdom: cleanKingdom, pin: pin, allianceId: newAllianceId, role: 'R5', status: 'Approved', createdAt: new Date().toISOString() });
         await setDoc(doc(db, "alliances", newAllianceId), { id: newAllianceId, tag: cleanTag, kingdom: cleanKingdom, name: allianceName, founderId: newUserId, currentR5: newUserId, pendingTransferTo: null, premiumFeatures: { castleBattle: false }, createdAt: new Date().toISOString() });
         const founderPlayer = { id: newUserId, name: cleanName, tag: cleanTag, role: 'R5', power: 0, marches: 1, isParticipating: true };
         await setDoc(doc(db, "rosters", newAllianceId), { players: [founderPlayer], createdAt: new Date().toISOString() });

         alert(t('auth_modal.alliance_founded'));
         setAuth({ role: 'alliance', code: newAllianceId, allianceRole: 'officer', playerId: newUserId, playerName: cleanName, castleAccess: false });
         setRoster([founderPlayer]); onClose(); setHubView('alliance'); setIsRosterOpen(true);
      }
    } catch (error) { console.error(error); alert(t('auth_modal.db_error')); }
    setIsLoading(false);
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 p-6 md:p-8 rounded-3xl shadow-2xl flex flex-col gap-6 w-full max-w-sm relative my-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-white">✕</button>
        
        {loginMode === 'select' && (
          <div className="flex flex-col gap-4 animate-in zoom-in-95">
            <div className="text-center mb-2">
              <div className="mx-auto w-14 h-14 bg-cyan-950/50 border border-cyan-500/30 rounded-2xl flex items-center justify-center text-3xl mb-4">🔐</div>
              <h3 className="text-2xl font-black text-white">{t('auth_modal.identification')}</h3>
              <p className="text-xs text-slate-400 mt-1">{t('auth_modal.choose_access')}</p>
            </div>
            
            <button onClick={() => setLoginMode('login')} className="w-full p-4 bg-slate-800 hover:bg-cyan-900/50 border border-slate-700 hover:border-cyan-500/50 rounded-xl text-left transition-all group">
              <div className="text-sm font-black text-white group-hover:text-cyan-400 flex items-center gap-2"><span>🚪</span> {t('auth_modal.have_account')}</div>
              <div className="text-[10px] text-slate-400 mt-1">{t('auth_modal.access_with')}</div>
            </button>

            <button onClick={() => setLoginMode('join')} className="w-full p-4 bg-slate-800 hover:bg-emerald-900/50 border border-slate-700 hover:border-emerald-500/50 rounded-xl text-left transition-all group">
              <div className="text-sm font-black text-white group-hover:text-emerald-400 flex items-center gap-2"><span>⚔️</span> {t('auth_modal.new_recruit')}</div>
              <div className="text-[10px] text-slate-400 mt-1">{t('auth_modal.join_alliance')}</div>
            </button>

            <button onClick={() => setLoginMode('create')} className="w-full p-4 bg-slate-800 hover:bg-amber-900/50 border border-slate-700 hover:border-amber-500/50 rounded-xl text-left transition-all group">
              <div className="text-sm font-black text-white group-hover:text-amber-400 flex items-center gap-2"><span>👑</span> {t('auth_modal.found_alliance')}</div>
              <div className="text-[10px] text-slate-400 mt-1">{t('auth_modal.register_guild')}</div>
            </button>

            <div className="mt-2 text-center border-t border-slate-800 pt-4 flex flex-col gap-2">
              <button onClick={() => setLoginMode('check_status')} className="text-[10px] text-emerald-500 hover:text-emerald-400 font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2 w-full bg-emerald-950/20 py-2 rounded-lg border border-emerald-900/50">
                <span>📬</span> Verifica Stato Richieste / PIN
              </button>
              <button onClick={() => setLoginMode('ticket')} className="text-[10px] text-slate-500 hover:text-rose-400 font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2 w-full py-2">
                <span>⚠️</span> {t('auth_modal.sos_btn')}
              </button>
            </div>
          </div>
        )}

        {loginMode === 'check_status' && (
          <div className="flex flex-col gap-4 animate-in slide-in-from-right-8 duration-200">
             <div className="text-center mb-2">
                <div className="mx-auto w-12 h-12 bg-emerald-950/50 border border-emerald-500/30 rounded-full flex items-center justify-center text-2xl mb-4">📬</div>
                <h3 className="text-xl font-black text-emerald-500">I tuoi Messaggi</h3>
                <p className="text-xs text-slate-400 mt-2">Inserisci Nome e Regno per leggere le risposte del Master al tuo recupero PIN o alle segnalazioni.</p>
             </div>

             <form onSubmit={handleCheckTicketStatus} className="flex gap-2 w-full">
                <input type="text" autoComplete="username" placeholder={t('auth_modal.your_name')} value={playerName} onChange={e => setPlayerName(e.target.value)} className="w-2/3 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-emerald-500" required />
                <input type="number" autoComplete="off" placeholder={t('auth_modal.kingdom')} value={kingdom} onChange={e => setKingdom(e.target.value)} className="w-1/3 bg-slate-950 border border-slate-700 rounded-xl px-2 py-3 text-center text-white font-bold focus:outline-none focus:border-emerald-500 hide-scroll" required />
                <button type="submit" disabled={isLoading} className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl px-4 font-black transition-colors disabled:opacity-50">🔍</button>
             </form>

             {userTickets && userTickets.length > 0 && (
                <div className="flex flex-col gap-3 mt-2 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                   {userTickets.map(tkt => (
                      <div key={tkt.id} className={`p-4 rounded-xl border ${tkt.status === 'Resolved' ? 'bg-emerald-950/20 border-emerald-500/50' : 'bg-slate-950 border-slate-800'}`}>
                         <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] text-slate-500 font-mono">{new Date(tkt.createdAt).toLocaleDateString()}</span>
                            {tkt.status === 'Resolved' 
                               ? <span className="bg-emerald-500 text-slate-900 text-[10px] px-2 py-0.5 rounded font-black uppercase">Risolto</span>
                               : <span className="bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded font-black uppercase">In Attesa</span>
                            }
                         </div>
                         <p className="text-xs text-slate-400 italic border-l-2 border-slate-700 pl-2 mb-3">"{tkt.message}"</p>
                         
                         {tkt.status === 'Resolved' && tkt.adminReply ? (
                            <div className="bg-emerald-900/40 p-3 rounded-lg border border-emerald-700">
                               <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Risposta Consulente:</div>
                               <div className="text-white text-sm font-medium">{tkt.adminReply}</div>
                            </div>
                         ) : tkt.status === 'Resolved' && !tkt.adminReply ? (
                            <div className="text-emerald-500 text-xs font-bold text-center">✅ La richiesta è stata gestita e chiusa dal Master.</div>
                         ) : null}
                      </div>
                   ))}
                </div>
             )}

             <button type="button" onClick={() => { setLoginMode('select'); setUserTickets(null); }} className="text-xs font-bold text-slate-500 hover:text-white mt-4 uppercase text-center w-full">{t('auth_modal.cancel_back')}</button>
          </div>
        )}

        {loginMode === 'forgot' && (
          <form onSubmit={(e) => { setTicketMessage(`RICHIESTA RECUPERO PIN.\nIl giocatore ${playerName} chiede di resettare le credenziali.`); handleTicketSubmit(e); }} className="flex flex-col gap-4 animate-in slide-in-from-right-8 duration-200">
            <div className="text-center mb-2">
              <div className="mx-auto w-12 h-12 bg-amber-950/50 border border-amber-500/30 rounded-full flex items-center justify-center text-2xl mb-4">🔑</div>
              <h3 className="text-xl font-black text-amber-500">{t('auth_modal.recovery_title', 'Recupero Credenziali')}</h3>
              <p className="text-xs text-slate-400 mt-2">{t('auth_modal.recovery_desc', 'Invia la richiesta. I Consulenti ti assegneranno un nuovo PIN che potrai leggere nella sezione "Verifica Stato".')}</p>
            </div>
            <div className="flex gap-2 w-full">
              <input type="text" autoComplete="username" placeholder={t('auth_modal.your_name')} value={playerName} onChange={e => setPlayerName(e.target.value)} className="w-2/3 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-amber-500" required />
              <input type="number" autoComplete="off" placeholder={t('auth_modal.kingdom')} value={kingdom} onChange={e => setKingdom(e.target.value)} className="w-1/3 bg-slate-950 border border-slate-700 rounded-xl px-2 py-3 text-center text-white font-bold focus:outline-none focus:border-amber-500 hide-scroll" required />
            </div>
            <input type="text" autoComplete="off" placeholder={t('auth_modal.involved_tag')} value={allianceTag} onChange={e => setAllianceTag(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-center text-white font-bold uppercase focus:outline-none focus:border-amber-500" />
            <button type="submit" disabled={isLoading} className="w-full py-3.5 mt-2 bg-amber-600 hover:bg-amber-500 text-white font-black uppercase tracking-wider rounded-xl transition-all shadow-[0_0_15px_rgba(245,158,11,0.3)] disabled:opacity-50">
              {isLoading ? t('auth_modal.sending') : t('auth_modal.send_request', 'Invia Richiesta')}
            </button>
            <button type="button" onClick={() => setLoginMode('login')} className="text-xs font-bold text-slate-500 hover:text-white mt-1 uppercase">{t('auth_modal.cancel_back')}</button>
          </form>
        )}

        {loginMode === 'ticket' && (
          <form onSubmit={handleTicketSubmit} className="flex flex-col gap-4 animate-in slide-in-from-right-8 duration-200">
            <div className="text-center mb-2">
              <h3 className="text-xl font-black text-rose-500">{t('auth_modal.sos_center')}</h3>
              <p className="text-xs text-slate-400 mt-1">{t('auth_modal.sos_desc')}</p>
            </div>
            <div className="flex gap-2 w-full">
              <input type="text" autoComplete="username" placeholder={t('auth_modal.your_name')} value={playerName} onChange={e => setPlayerName(e.target.value)} className="w-2/3 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-rose-500" required />
              <input type="number" autoComplete="off" placeholder={t('auth_modal.kingdom')} value={kingdom} onChange={e => setKingdom(e.target.value)} className="w-1/3 bg-slate-950 border border-slate-700 rounded-xl px-2 py-3 text-center text-white font-bold focus:outline-none focus:border-rose-500 hide-scroll" />
            </div>
            <input type="text" autoComplete="off" placeholder={t('auth_modal.involved_tag')} value={allianceTag} onChange={e => setAllianceTag(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-center text-white font-bold uppercase focus:outline-none focus:border-rose-500" />
            <textarea placeholder={t('auth_modal.explain_problem')} value={ticketMessage} onChange={e => setTicketMessage(e.target.value)} rows={4} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-300 focus:outline-none focus:border-rose-500 custom-scrollbar resize-none" required />
            <button type="submit" disabled={isLoading} className="w-full py-3.5 mt-2 bg-rose-600 hover:bg-rose-500 text-white font-black uppercase tracking-wider rounded-xl transition-all shadow-[0_0_15px_rgba(225,29,72,0.3)] disabled:opacity-50">
              {isLoading ? t('auth_modal.sending') : t('auth_modal.send_report')}
            </button>
            <button type="button" onClick={() => setLoginMode('select')} className="text-xs font-bold text-slate-500 hover:text-white mt-1 uppercase">{t('auth_modal.cancel_back')}</button>
          </form>
        )}

        {(loginMode === 'login' || loginMode === 'join' || loginMode === 'create') && (
          <form onSubmit={handleAuthSubmit} className="flex flex-col gap-4 animate-in slide-in-from-right-8 duration-200">
            <div className="text-center mb-2">
              <h3 className="text-xl font-black text-white">
                {loginMode === 'login' ? t('auth_modal.welcome_back') : loginMode === 'join' ? t('auth_modal.registration') : t('auth_modal.found_alliance')}
              </h3>
              <p className="text-xs text-slate-400 mt-1">{t('auth_modal.tactical_credentials')}</p>
            </div>
            <div className="flex gap-2 w-full">
              <input type="text" autoComplete="username" placeholder={t('auth_modal.ingame_name')} value={playerName} onChange={e => setPlayerName(e.target.value)} className="w-2/3 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-cyan-500" required />
              <input type="number" autoComplete="off" placeholder={t('auth_modal.kingdom_ex')} value={kingdom} onChange={e => setKingdom(e.target.value)} className="w-1/3 bg-slate-950 border border-slate-700 rounded-xl px-2 py-3 text-center text-white font-bold focus:outline-none focus:border-cyan-500 hide-scroll" />
            </div>
            
            <div className="flex flex-col gap-1 w-full">
               <div className="relative w-full">
                 <input type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder={t('auth_modal.enter_pin')} value={pin} onChange={e => setPin(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-center text-white font-mono tracking-widest focus:outline-none focus:border-cyan-500 pr-12" required />
                 <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyan-400 transition-colors text-lg">
                   {showPassword ? "👁️‍🗨️" : "👁️"}
                 </button>
               </div>
               {loginMode === 'login' && (
                 <button type="button" onClick={() => setLoginMode('forgot')} className="text-[10px] text-slate-500 hover:text-amber-400 font-bold self-end mt-1 transition-colors">
                   {t('auth_modal.forgot_password', 'Hai dimenticato il PIN?')}
                 </button>
               )}
            </div>

            {(loginMode === 'join' || loginMode === 'create') && (
              <input type="text" autoComplete="off" placeholder={t('auth_modal.alliance_tag')} value={allianceTag} onChange={e => setAllianceTag(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-center text-white font-bold uppercase focus:outline-none focus:border-emerald-500" />
            )}
            {loginMode === 'create' && (
              <input type="text" autoComplete="off" placeholder={t('auth_modal.alliance_name_ext')} value={allianceName} onChange={e => setAllianceName(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-center text-white font-bold focus:outline-none focus:border-amber-500" required />
            )}
            <button type="submit" disabled={isLoading} className={`w-full py-3.5 mt-2 text-white font-black uppercase tracking-wider rounded-xl transition-all shadow-lg disabled:opacity-50 ${loginMode === 'login' ? 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-500/30' : loginMode === 'join' ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/30' : 'bg-amber-600 hover:bg-amber-500 shadow-amber-500/30'}`}>
              {isLoading ? t('auth_modal.processing') : loginMode === 'login' ? t('auth_modal.login') : t('auth_modal.confirm')}
            </button>
            <button type="button" onClick={() => setLoginMode('select')} className="text-xs font-bold text-slate-500 hover:text-white mt-1 uppercase">{t('auth_modal.back')}</button>
          </form>
        )}
      </div>
    </div>
  );
}