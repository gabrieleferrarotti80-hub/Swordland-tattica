import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { db } from '../firebase';
import { doc, getDoc, setDoc, collection, getDocs, query, where } from 'firebase/firestore';

export default function AuthModal({ onClose, setAuth, setRoster, setHubView, setIsRosterOpen, accessPasswords }) {
  const { t } = useTranslation();
  
  const [loginMode, setLoginMode] = useState('select'); // select, login, join, create, ticket
  const [isLoading, setIsLoading] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [kingdom, setKingdom] = useState('');
  const [pin, setPin] = useState('');
  const [allianceTag, setAllianceTag] = useState('');
  const [allianceName, setAllianceName] = useState('');
  const [ticketMessage, setTicketMessage] = useState(''); // 💡 Nuovo stato per il ticket

  const getMasterAccessLevel = (inputUser, inputPass) => {
    if(!inputPass || !inputUser) return null;
    const upperPass = inputPass.toUpperCase().trim();
    const upperUser = inputUser.toUpperCase().trim();
    
    if(accessPasswords.master && String(accessPasswords.master).toUpperCase() === upperPass && upperUser === 'ADMIN') {
      return { role: 'admin', castleAccess: true, name: 'Admin Supremo' };
    }
    
    for(const key in accessPasswords) {
        if(key === 'master') continue;
        if(key.toUpperCase() === upperUser) {
            const val = accessPasswords[key];
            if(typeof val === 'object' && val !== null && String(val.password).toUpperCase() === upperPass) {
                return { role: 'consulente', castleAccess: val.castleAccess, name: key };
            } else if (typeof val === 'string' && val.toUpperCase() === upperPass) {
                return { role: 'consulente', castleAccess: false, name: key };
            }
        }
    }
    return null;
  };

  // 💡 NUOVA FUNZIONE: INVIO TICKET
  const handleTicketSubmit = async (e) => {
    e.preventDefault();
    if (!playerName || !ticketMessage) return alert("Nome in gioco e Messaggio sono obbligatori.");
    setIsLoading(true);

    try {
      const ticketId = `tkt_${Date.now()}`;
      await setDoc(doc(db, "tickets", ticketId), {
        playerName: playerName.trim(),
        kingdom: kingdom.trim(),
        allianceTag: allianceTag.toUpperCase().trim(),
        message: ticketMessage.trim(),
        status: 'Open', // Può essere 'Open' o 'Resolved'
        createdAt: new Date().toISOString()
      });

      alert("✅ Segnalazione inviata con successo! L'Amministratore verificherà la situazione e interverrà sul database.");
      setLoginMode('select');
      setTicketMessage('');
    } catch (error) {
      alert("❌ Errore durante l'invio della segnalazione.");
    }
    setIsLoading(false);
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    if (!playerName || !pin) return alert("Nome Giocatore e PIN sono obbligatori.");
    
    setIsLoading(true);
    const cleanName = playerName.trim();
    const cleanKingdom = kingdom.trim() || "0000";
    const cleanTag = allianceTag.toUpperCase().replace(/\s+/g, '');

    try {
      // 1. BACKDOOR ADMIN/CONSULENTE
      const masterAccess = getMasterAccessLevel(cleanName, pin);
      if (masterAccess) {
          setAuth({ role: masterAccess.role, castleAccess: masterAccess.castleAccess, code: '0000_MASTER', allianceRole: 'officer', playerName: masterAccess.name, playerId: 'admin' });
          onClose();
          setIsLoading(false);
          return;
      }

      // DEMO ACCOUNT
      if (cleanTag === 'DEMO' || cleanTag === 'DEMO2') {
        const isDemo2 = cleanTag === 'DEMO2';
        setAuth({ role: 'guest', code: cleanTag, allianceRole: 'officer', playerName: isDemo2 ? 'Analista Demo' : 'Tattico Demo', playerId: cleanTag.toLowerCase(), castleAccess: false });
        setRoster([
          { id: 'd1', name: 'Ragnar', tag: cleanTag, role: 'R5', power: 120, marches: 2, isParticipating: true },
          { id: 'd2', name: 'Lagertha', tag: cleanTag, role: 'R4', power: 105, marches: 2, isParticipating: true }
        ]);
        onClose(); 
        setIsLoading(false);
        return;
      }

      // 2. MODALITA' ACCEDI
      if (loginMode === 'login') {
         if (!kingdom && cleanName.toUpperCase() !== 'ADMIN') { setIsLoading(false); return alert("Inserisci il Regno."); }
         
         const q = query(collection(db, "users"), where("displayName", "==", cleanName), where("kingdom", "==", cleanKingdom));
         const snap = await getDocs(q);
         if (snap.empty) { setIsLoading(false); return alert("Giocatore non trovato. Controlla i dati o registrati."); }

         const userDoc = snap.docs[0];
         const userData = userDoc.data();

         if (userData.pin !== pin) { setIsLoading(false); return alert("PIN errato. Riprova."); }
         if (userData.status === 'Pending') { setIsLoading(false); return alert("⏳ Il tuo account è in attesa di approvazione da un Leader."); }
         if (userData.status === 'Banned') { setIsLoading(false); return alert("⛔ Account disabilitato dall'Amministratore."); }

         if (userData.allianceId) {
             let rosterSnap = await getDoc(doc(db, "rosters", userData.allianceId));
             if (rosterSnap.exists()) setRoster(rosterSnap.data().players || []);
         }

         const isOfficer = ['R5', 'R4'].includes(String(userData.role).toUpperCase()) || String(userData.role).toUpperCase().includes('LEADER');
         setAuth({ role: userData.allianceId ? 'alliance' : 'single', code: userData.allianceId || 'SINGLE', allianceRole: isOfficer ? 'officer' : 'member', playerId: userDoc.id, playerName: userData.displayName, castleAccess: false });
         onClose();
      }

      // 3. MODALITA' UNISCITI
      else if (loginMode === 'join') {
         if (!kingdom) { setIsLoading(false); return alert("Inserisci il Regno."); }
         const q = query(collection(db, "users"), where("displayName", "==", cleanName), where("kingdom", "==", cleanKingdom));
         const snap = await getDocs(q);
         if (!snap.empty) { setIsLoading(false); return alert("Nome già registrato. Fai 'Accedi'."); }

         const newUserId = `u_${Date.now()}`;
         const targetAllianceId = cleanTag ? `${cleanKingdom}_${cleanTag}` : null;
         
         await setDoc(doc(db, "users", newUserId), { displayName: cleanName, kingdom: cleanKingdom, pin: pin, allianceId: targetAllianceId, role: targetAllianceId ? 'Member' : 'Single', status: targetAllianceId ? 'Pending' : 'Approved', createdAt: new Date().toISOString() });

         if (targetAllianceId) {
            alert("✅ Richiesta inviata ai Leader dell'alleanza. Attendi l'approvazione.");
            onClose();
         } else {
            alert("✅ Account Singolo creato!");
            setAuth({ role: 'single', code: 'SINGLE', allianceRole: 'member', playerId: newUserId, playerName: cleanName, castleAccess: false });
            onClose();
         }
      }

      // 4. MODALITA' FONDA ALLEANZA
      else if (loginMode === 'create') {
         if (!kingdom || !cleanTag || !allianceName) { setIsLoading(false); return alert("Compila tutti i campi."); }
         const newAllianceId = `${cleanKingdom}_${cleanTag}`;

         const allianceSnap = await getDoc(doc(db, "alliances", newAllianceId));
         if (allianceSnap.exists()) { setIsLoading(false); return alert(`Alleanza già esistente!`); }

         const newUserId = `u_${Date.now()}`;
         await setDoc(doc(db, "users", newUserId), { displayName: cleanName, kingdom: cleanKingdom, pin: pin, allianceId: newAllianceId, role: 'R5', status: 'Approved', createdAt: new Date().toISOString() });
         await setDoc(doc(db, "alliances", newAllianceId), { id: newAllianceId, tag: cleanTag, kingdom: cleanKingdom, name: allianceName, founderId: newUserId, currentR5: newUserId, pendingTransferTo: null, premiumFeatures: { castleBattle: false }, createdAt: new Date().toISOString() });

         const founderPlayer = { id: newUserId, name: cleanName, tag: cleanTag, role: 'R5', power: 0, marches: 1, isParticipating: true };
         await setDoc(doc(db, "rosters", newAllianceId), { players: [founderPlayer], createdAt: new Date().toISOString() });

         alert(`👑 Alleanza fondata!`);
         setAuth({ role: 'alliance', code: newAllianceId, allianceRole: 'officer', playerId: newUserId, playerName: cleanName, castleAccess: false });
         setRoster([founderPlayer]);
         onClose();
         setHubView('alliance');
         setIsRosterOpen(true);
      }
    } catch (error) {
      console.error(error);
      alert("Errore di connessione al database.");
    }
    setIsLoading(false);
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 p-8 rounded-3xl shadow-2xl flex flex-col gap-6 w-full max-w-sm relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-white">✕</button>
        
        {loginMode === 'select' && (
          <div className="flex flex-col gap-4 animate-in zoom-in-95">
            <div className="text-center mb-2">
              <div className="mx-auto w-14 h-14 bg-cyan-950/50 border border-cyan-500/30 rounded-2xl flex items-center justify-center text-3xl mb-4">🔐</div>
              <h3 className="text-2xl font-black text-white">Identificazione</h3>
              <p className="text-xs text-slate-400 mt-1">Scegli come accedere al sistema</p>
            </div>
            
            <button onClick={() => setLoginMode('login')} className="w-full p-4 bg-slate-800 hover:bg-cyan-900/50 border border-slate-700 hover:border-cyan-500/50 rounded-xl text-left transition-all group">
              <div className="text-sm font-black text-white group-hover:text-cyan-400 flex items-center gap-2"><span>🚪</span> Ho già un account</div>
              <div className="text-[10px] text-slate-400 mt-1">Accedi con Nome in Gioco e PIN.</div>
            </button>

            <button onClick={() => setLoginMode('join')} className="w-full p-4 bg-slate-800 hover:bg-emerald-900/50 border border-slate-700 hover:border-emerald-500/50 rounded-xl text-left transition-all group">
              <div className="text-sm font-black text-white group-hover:text-emerald-400 flex items-center gap-2"><span>⚔️</span> Nuova Recluta / Singolo</div>
              <div className="text-[10px] text-slate-400 mt-1">Unisciti a un'Alleanza o gioca in singolo.</div>
            </button>

            <button onClick={() => setLoginMode('create')} className="w-full p-4 bg-slate-800 hover:bg-amber-900/50 border border-slate-700 hover:border-amber-500/50 rounded-xl text-left transition-all group">
              <div className="text-sm font-black text-white group-hover:text-amber-400 flex items-center gap-2"><span>👑</span> Fonda Alleanza</div>
              <div className="text-[10px] text-slate-400 mt-1">Registra la tua gilda. Diventerai l'R5.</div>
            </button>

            {/* 💡 PULSANTE TICKET */}
            <div className="mt-2 text-center border-t border-slate-800 pt-4">
              <button onClick={() => setLoginMode('ticket')} className="text-[10px] text-slate-500 hover:text-rose-400 font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2 w-full">
                <span>⚠️</span> Problemi di Accesso o Furto TAG? Clicca qui
              </button>
            </div>
          </div>
        )}

        {/* 💡 MODALITA' TICKET (FORM) */}
        {loginMode === 'ticket' && (
          <form onSubmit={handleTicketSubmit} className="flex flex-col gap-4 animate-in slide-in-from-right-8 duration-200">
            <div className="text-center mb-2">
              <h3 className="text-xl font-black text-rose-500">Centro SOS</h3>
              <p className="text-xs text-slate-400 mt-1">Invia una richiesta direttamente all'Amministratore.</p>
            </div>

            <div className="flex gap-2 w-full">
              <input type="text" placeholder="Tuo Nome in Gioco" value={playerName} onChange={e => setPlayerName(e.target.value)} className="w-2/3 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-rose-500" required />
              <input type="number" placeholder="Regno" value={kingdom} onChange={e => setKingdom(e.target.value)} className="w-1/3 bg-slate-950 border border-slate-700 rounded-xl px-2 py-3 text-center text-white font-bold focus:outline-none focus:border-rose-500 hide-scroll" />
            </div>

            <input type="text" placeholder="Tag Alleanza Coinvolta (Se applicabile)" value={allianceTag} onChange={e => setAllianceTag(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-center text-white font-bold uppercase focus:outline-none focus:border-rose-500" />

            <textarea placeholder="Spiega il problema (Es. 'L'utente Pippo ha fondato l'alleanza col mio TAG, sono il vero R5...')" value={ticketMessage} onChange={e => setTicketMessage(e.target.value)} rows={4} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-300 focus:outline-none focus:border-rose-500 custom-scrollbar resize-none" required />

            <button type="submit" disabled={isLoading} className="w-full py-3.5 mt-2 bg-rose-600 hover:bg-rose-500 text-white font-black uppercase tracking-wider rounded-xl transition-all shadow-[0_0_15px_rgba(225,29,72,0.3)] disabled:opacity-50">
              {isLoading ? 'Invio in corso...' : 'Invia Segnalazione'}
            </button>
            
            <button type="button" onClick={() => setLoginMode('select')} className="text-xs font-bold text-slate-500 hover:text-white mt-1 uppercase">Annulla e Torna Indietro</button>
          </form>
        )}

        {/* ALTRE MODALITA' (Login/Join/Create) */}
        {(loginMode === 'login' || loginMode === 'join' || loginMode === 'create') && (
          <form onSubmit={handleAuthSubmit} className="flex flex-col gap-4 animate-in slide-in-from-right-8 duration-200">
            <div className="text-center mb-2">
              <h3 className="text-xl font-black text-white">
                {loginMode === 'login' ? 'Bentornato' : loginMode === 'join' ? 'Registrazione' : 'Fonda Alleanza'}
              </h3>
              <p className="text-xs text-slate-400 mt-1">Inserisci le tue Credenziali Tattiche</p>
            </div>

            <div className="flex gap-2 w-full">
              <input type="text" placeholder="Nome in Gioco" value={playerName} onChange={e => setPlayerName(e.target.value)} className="w-2/3 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-cyan-500" required />
              <input type="number" placeholder="Regno (es. 1024)" value={kingdom} onChange={e => setKingdom(e.target.value)} className="w-1/3 bg-slate-950 border border-slate-700 rounded-xl px-2 py-3 text-center text-white font-bold focus:outline-none focus:border-cyan-500 hide-scroll" />
            </div>

            <input type="password" placeholder="Inserisci il tuo PIN" value={pin} onChange={e => setPin(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-center text-white font-mono tracking-widest focus:outline-none focus:border-cyan-500" required />

            {(loginMode === 'join' || loginMode === 'create') && (
              <input type="text" placeholder="Tag Alleanza (Es. DTD)" value={allianceTag} onChange={e => setAllianceTag(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-center text-white font-bold uppercase focus:outline-none focus:border-emerald-500" />
            )}

            {loginMode === 'create' && (
              <input type="text" placeholder="Nome Esteso Alleanza" value={allianceName} onChange={e => setAllianceName(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-center text-white font-bold focus:outline-none focus:border-amber-500" required />
            )}

            <button type="submit" disabled={isLoading} className={`w-full py-3.5 mt-2 text-white font-black uppercase tracking-wider rounded-xl transition-all shadow-lg disabled:opacity-50 ${loginMode === 'login' ? 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-500/30' : loginMode === 'join' ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/30' : 'bg-amber-600 hover:bg-amber-500 shadow-amber-500/30'}`}>
              {isLoading ? 'Elaborazione...' : loginMode === 'login' ? 'Accedi' : 'Conferma'}
            </button>
            
            <button type="button" onClick={() => setLoginMode('select')} className="text-xs font-bold text-slate-500 hover:text-white mt-1 uppercase">Indietro</button>
          </form>
        )}
      </div>
    </div>
  );
}