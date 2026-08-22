import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, setDoc, collection, getDocs, updateDoc, deleteField, deleteDoc } from 'firebase/firestore';

export default function AdminPanel({ auth }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('crm-users');
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState([]);

  // --- STATI CRM ---
  const [globalUsers, setGlobalUsers] = useState([]);
  const [globalAlliances, setGlobalAlliances] = useState([]);
  const [globalTickets, setGlobalTickets] = useState([]); // 💡 STATO TICKET
  const [searchUser, setSearchUser] = useState('');

  // --- STATI Deploy / Master ---
  const [vercelWebhook, setVercelWebhook] = useState('');
  const [releaseVersion, setReleaseVersion] = useState('');
  const [releaseNotes, setReleaseNotes] = useState('');
  const [isAnnounceActive, setIsAnnounceActive] = useState(false);
  const [accessPasswords, setAccessPasswords] = useState({ master: 'MASTER' });
  const [tempUser, setTempUser] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [tempCastleAccess, setTempCastleAccess] = useState(false);
  const [tempPasswordsList, setTempPasswordsList] = useState([]);

  useEffect(() => {
    if (auth?.role !== 'consulente' && auth?.role !== 'admin') return;

    const fetchConfigData = async () => {
      try {
        const hookSnap = await getDoc(doc(db, "settings", "deploy"));
        if (hookSnap.exists()) setVercelWebhook(hookSnap.data().webhook || '');

        const annSnap = await getDoc(doc(db, "system", "announcement"));
        if (annSnap.exists()) {
          setReleaseVersion(annSnap.data().version || '');
          setReleaseNotes(annSnap.data().text || '');
          setIsAnnounceActive(annSnap.data().active || false);
        }

        const codesSnap = await getDoc(doc(db, "settings", "accessCodes"));
        if (codesSnap.exists()) {
          const data = codesSnap.data();
          setAccessPasswords({ master: data.master || 'MASTER' });
          const temps = [];
          Object.keys(data).forEach(key => {
              if(key !== 'master') {
                  const val = data[key];
                  if (typeof val === 'object' && val !== null) temps.push({ user: key, password: val.password, castleAccess: val.castleAccess });
                  else temps.push({ user: key, password: val, castleAccess: false });
              }
          });
          setTempPasswordsList(temps);
        }
      } catch (error) { console.error(error); }
    };
    fetchConfigData();
  }, [auth]);

  // Caricamento Dati CRM e Ticket
  useEffect(() => {
    if (auth?.role !== 'consulente' && auth?.role !== 'admin') return;

    const fetchCRM = async () => {
      setIsLoading(true);
      try {
        if (activeTab === 'crm-users') {
          const uSnap = await getDocs(collection(db, "users"));
          setGlobalUsers(uSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        } else if (activeTab === 'crm-alliances') {
          const aSnap = await getDocs(collection(db, "alliances"));
          setGlobalAlliances(aSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        } else if (activeTab === 'crm-tickets') {
          const tSnap = await getDocs(collection(db, "tickets"));
          // Li ordiniamo per data dal più recente al più vecchio
          setGlobalTickets(tSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => b.createdAt.localeCompare(a.createdAt)));
        }
      } catch(e) { console.error(e); }
      setIsLoading(false);
    };
    fetchCRM();
  }, [activeTab, auth]);

  if (auth?.role !== 'consulente' && auth?.role !== 'admin') {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <h2 className="text-3xl font-black text-rose-500 mb-4">⛔ ACCESSO NEGATO</h2>
        <button onClick={() => navigate('/')} className="px-6 py-2 bg-slate-800 rounded-lg font-bold">Torna alla Home</button>
      </div>
    );
  }

  // ==========================================
  // FUNZIONI CRM UTENTI & ALLEANZE
  // ==========================================
  const handleBanUser = async (userId, currentStatus) => {
    const newStatus = currentStatus === 'Banned' ? 'Approved' : 'Banned';
    if(!window.confirm(currentStatus === 'Banned' ? "Vuoi riammettere questo utente?" : "Vuoi BANNARE questo utente?")) return;
    try {
      await updateDoc(doc(db, "users", userId), { status: newStatus });
      setGlobalUsers(prev => prev.map(u => u.id === userId ? { ...u, status: newStatus } : u));
    } catch(e) { alert("Errore"); }
  };

  const handleChangePin = async (userId, userName) => {
    const newPin = window.prompt(`Nuovo PIN per ${userName}:`);
    if(!newPin || newPin.trim() === '') return;
    try {
      await updateDoc(doc(db, "users", userId), { pin: newPin.trim() });
      setGlobalUsers(prev => prev.map(u => u.id === userId ? { ...u, pin: newPin.trim() } : u));
    } catch(e) { alert("Errore"); }
  };

  const handleDeleteUser = async (userId) => {
    if(!window.confirm("Eliminare DEFINITIVAMENTE questo utente?")) return;
    try {
      await deleteDoc(doc(db, "users", userId));
      setGlobalUsers(prev => prev.filter(u => u.id !== userId));
    } catch(e) { alert("Errore"); }
  };

  const handleTogglePremium = async (allianceId, currentFeatures) => {
    const newCastleAccess = !(currentFeatures?.castleBattle);
    try {
      await updateDoc(doc(db, "alliances", allianceId), { "premiumFeatures.castleBattle": newCastleAccess });
      setGlobalAlliances(prev => prev.map(a => a.id === allianceId ? { ...a, premiumFeatures: { ...a.premiumFeatures, castleBattle: newCastleAccess } } : a));
    } catch(e) { alert("Errore"); }
  };

  const handleDeleteAlliance = async (allianceId) => {
    if(!window.confirm(`Stai per DISINTEGRARE l'alleanza [${allianceId}]. Procedere?`)) return;
    try {
      await deleteDoc(doc(db, "alliances", allianceId));
      await deleteDoc(doc(db, "rosters", allianceId));
      setGlobalAlliances(prev => prev.filter(a => a.id !== allianceId));
    } catch(e) { alert("Errore"); }
  };

  // ==========================================
  // 💡 NUOVE FUNZIONI TICKET SOS
  // ==========================================
  const handleResolveTicket = async (ticketId, currentStatus) => {
    const newStatus = currentStatus === 'Open' ? 'Resolved' : 'Open';
    try {
      await updateDoc(doc(db, "tickets", ticketId), { status: newStatus });
      setGlobalTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: newStatus } : t));
    } catch(e) { alert("Errore nell'aggiornamento del ticket."); }
  };

  const handleDeleteTicket = async (ticketId) => {
    if(!window.confirm("Cancellare questo Ticket?")) return;
    try {
      await deleteDoc(doc(db, "tickets", ticketId));
      setGlobalTickets(prev => prev.filter(t => t.id !== ticketId));
    } catch(e) { alert("Errore durante l'eliminazione."); }
  };

  // ==========================================
  // MASTER PANEL
  // ==========================================
  const handleSaveMasterKey = async () => {
    try { await setDoc(doc(db, "settings", "accessCodes"), { master: accessPasswords.master }, { merge: true }); alert("✅ Master Key salvata."); } 
    catch (e) { alert("❌ Errore"); }
  };

  const handleCreateTempPassword = async () => {
      if(!tempUser || !tempPassword) return;
      try {
        await setDoc(doc(db, "settings", "accessCodes"), { [tempUser]: { password: tempPassword, castleAccess: tempCastleAccess } }, { merge: true });
        setTempPasswordsList(prev => [...prev, { user: tempUser, password: tempPassword, castleAccess: tempCastleAccess }]);
        setTempUser(''); setTempPassword(''); setTempCastleAccess(false);
      } catch (e) { alert("❌ Errore"); }
  };

  const handleDeleteTempPassword = async (user) => {
      if(!window.confirm(`Eliminare accesso per ${user}?`)) return;
      try {
          await updateDoc(doc(db, "settings", "accessCodes"), { [user]: deleteField() });
          setTempPasswordsList(prev => prev.filter(item => item.user !== user));
      } catch (e) {}
  };

  const filteredUsers = globalUsers.filter(u => u.displayName?.toLowerCase().includes(searchUser.toLowerCase()) || u.allianceId?.toLowerCase().includes(searchUser.toLowerCase()));

  return (
    <div className="h-screen bg-slate-950 flex flex-col md:flex-row overflow-hidden text-slate-200 font-sans">
      
      <aside className="w-full md:w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-xl font-black text-rose-500 flex items-center gap-2"><span>👑</span> GOD ROOM</h1>
          <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest">Pannello Supremo</p>
        </div>
        
        <div className="flex-1 p-4 flex flex-col gap-2 overflow-y-auto custom-scrollbar">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 ml-2">CRM Globale</div>
          <button onClick={() => setActiveTab('crm-users')} className={`px-4 py-3 rounded-xl text-sm font-bold text-left transition-colors flex items-center gap-3 ${activeTab === 'crm-users' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-slate-400 hover:bg-slate-800'}`}>
            <span>👥</span> Anagrafe Utenti
          </button>
          <button onClick={() => setActiveTab('crm-alliances')} className={`px-4 py-3 rounded-xl text-sm font-bold text-left transition-colors flex items-center gap-3 ${activeTab === 'crm-alliances' ? 'bg-amber-600/20 text-amber-400 border border-amber-500/30' : 'text-slate-400 hover:bg-slate-800'}`}>
            <span>🛡️</span> Licenze Alleanze
          </button>
          
          {/* 💡 NUOVO TASTO TICKET */}
          <button onClick={() => setActiveTab('crm-tickets')} className={`px-4 py-3 rounded-xl text-sm font-bold text-left transition-colors flex items-center gap-3 ${activeTab === 'crm-tickets' ? 'bg-rose-600/20 text-rose-400 border border-rose-500/30' : 'text-slate-400 hover:bg-slate-800'}`}>
            <span>🎫</span> Segnalazioni & Ticket
          </button>

          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 ml-2 mt-4">Sistema</div>
          <button onClick={() => setActiveTab('master-panel')} className={`px-4 py-3 rounded-xl text-sm font-bold text-left transition-colors flex items-center gap-3 ${activeTab === 'master-panel' ? 'bg-fuchsia-600/20 text-fuchsia-400 border border-fuchsia-500/30' : 'text-slate-400 hover:bg-slate-800'}`}>
            <span>🔑</span> Master Keys
          </button>
          <button onClick={() => setActiveTab('deploy-center')} className={`px-4 py-3 rounded-xl text-sm font-bold text-left transition-colors flex items-center gap-3 ${activeTab === 'deploy-center' ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' : 'text-slate-400 hover:bg-slate-800'}`}>
            <span>🚀</span> Patch & Deploy
          </button>
        </div>

        <div className="p-4 border-t border-slate-800">
          <button onClick={() => navigate('/')} className="w-full px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-colors">⬅ Torna all'HUB</button>
        </div>
      </aside>

      <main className="flex-1 p-4 md:p-8 overflow-y-auto bg-[#090e17] relative">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
        
        <div className="max-w-6xl mx-auto relative z-10">
          
          {/* TAB 1: CRM UTENTI GLOBALE (Intatto) */}
          {activeTab === 'crm-users' && (
             <div className="flex flex-col gap-6 animate-in fade-in">
             <div>
               <h2 className="text-2xl font-black text-white">Anagrafe Utenti Globale</h2>
               <p className="text-slate-400 text-sm mt-1">Gestisci tutti i profili registrati nel sistema. Cambia PIN o banna chi non rispetta le regole.</p>
             </div>

             <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-xl overflow-hidden flex flex-col">
               <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex flex-col md:flex-row justify-between gap-4 items-center">
                  <div className="relative w-full md:w-1/2">
                     <span className="absolute left-3 top-2.5 text-slate-500">🔍</span>
                     <input type="text" placeholder="Cerca giocatore o alleanza..." value={searchUser} onChange={e => setSearchUser(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
                  </div>
                  <div className="text-xs font-bold text-slate-400 bg-slate-950 px-4 py-2 rounded-lg border border-slate-800">
                     Totale Utenti: <span className="text-blue-400">{filteredUsers.length}</span>
                  </div>
               </div>

               <div className="overflow-x-auto">
                 <table className="w-full text-left text-sm whitespace-nowrap">
                   <thead className="bg-slate-950/80 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-800">
                     <tr>
                       <th className="p-4">Utente / Regno</th>
                       <th className="p-4">Gilda & Ruolo</th>
                       <th className="p-4">Status</th>
                       <th className="p-4 text-center">Codice PIN</th>
                       <th className="p-4 text-right">Azioni Admin</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-800 text-slate-300">
                     {isLoading ? (<tr><td colSpan="5" className="p-8 text-center text-slate-500">Caricamento in corso...</td></tr>) : filteredUsers.map(u => (
                       <tr key={u.id} className="hover:bg-slate-800/50 transition-colors">
                         <td className="p-4">
                           <div className="font-black text-white">{u.displayName}</div>
                           <div className="text-xs text-slate-500 mt-0.5">Regno: <span className="text-cyan-400">{u.kingdom}</span></div>
                         </td>
                         <td className="p-4">
                           <div className="font-bold text-amber-400">{u.allianceId ? `[${u.allianceId.split('_')[1]}]` : 'Solo'}</div>
                           <div className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded uppercase mt-1 w-fit">{u.role}</div>
                         </td>
                         <td className="p-4">
                           {u.status === 'Approved' ? <span className="text-emerald-400 font-bold text-xs bg-emerald-400/10 px-2 py-1 rounded">Approvato</span> :
                            u.status === 'Pending' ? <span className="text-amber-400 font-bold text-xs bg-amber-400/10 px-2 py-1 rounded">In Attesa</span> :
                            <span className="text-rose-500 font-bold text-xs bg-rose-500/10 px-2 py-1 rounded">Bannato</span>}
                         </td>
                         <td className="p-4 text-center">
                           <button onClick={() => handleChangePin(u.id, u.displayName)} className="text-xs font-mono bg-slate-950 border border-slate-700 hover:border-blue-500 px-3 py-1 rounded-md text-slate-400 hover:text-white transition-colors" title="Clicca per modificare">
                             {u.pin} ✏️
                           </button>
                         </td>
                         <td className="p-4 text-right flex justify-end gap-2">
                           <button onClick={() => handleBanUser(u.id, u.status)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${u.status === 'Banned' ? 'bg-emerald-900/30 text-emerald-500 hover:bg-emerald-600 hover:text-white border border-emerald-500/30' : 'bg-rose-900/30 text-rose-500 hover:bg-rose-600 hover:text-white border border-rose-500/30'}`}>
                             {u.status === 'Banned' ? 'Sblocca' : 'Banna'}
                           </button>
                           <button onClick={() => handleDeleteUser(u.id)} className="px-2 py-1.5 bg-slate-950 hover:bg-rose-900 text-slate-500 hover:text-rose-400 rounded-lg border border-slate-800 transition-colors" title="Elimina Account">🗑️</button>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
             </div>
           </div>
          )}

          {/* TAB 2: CRM ALLEANZE & PREMIUM (Intatto) */}
          {activeTab === 'crm-alliances' && (
             <div className="flex flex-col gap-6 animate-in fade-in">
             <div>
               <h2 className="text-2xl font-black text-white">Licenze Alleanze & Gestione Troll</h2>
               <p className="text-slate-400 text-sm mt-1">Concedi l'accesso ai moduli Premium (es. Battaglia Castello) o distruggi le gilde false create per occupare il TAG.</p>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
               {isLoading ? ( <div className="text-slate-500 py-10 col-span-full">Caricamento...</div> ) : globalAlliances.length === 0 ? ( <div className="text-slate-500 py-10 col-span-full">Nessuna alleanza registrata.</div> ) : 
                globalAlliances.map(al => (
                 <div key={al.id} className="bg-slate-900 border border-slate-700 p-5 rounded-2xl flex flex-col gap-4 shadow-lg hover:border-amber-500/50 transition-colors">
                   <div className="flex justify-between items-start border-b border-slate-800 pb-3">
                     <div>
                       <div className="text-2xl font-black text-white">[{al.tag}]</div>
                       <div className="text-xs text-slate-400 mt-1">Regno {al.kingdom} • {al.name}</div>
                     </div>
                     <button onClick={() => handleDeleteAlliance(al.id)} className="text-slate-600 hover:text-rose-500 text-sm p-2 bg-slate-950 rounded-lg border border-slate-800 transition-colors" title="Disintegra Alleanza">🗑️</button>
                   </div>

                   <div className="flex flex-col gap-2">
                      <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Moduli Premium Accessibili</div>
                      <label className="flex items-center justify-between bg-slate-950 p-3 rounded-lg border border-slate-800 cursor-pointer hover:border-fuchsia-500/50 transition-colors">
                         <span className="text-xs font-bold text-slate-300 flex items-center gap-2"><span>👑</span> Battaglia Castello</span>
                         <input type="checkbox" checked={al.premiumFeatures?.castleBattle || false} onChange={() => handleTogglePremium(al.id, al.premiumFeatures)} className="w-5 h-5 accent-fuchsia-600 cursor-pointer" />
                      </label>
                   </div>
                 </div>
                ))}
             </div>
           </div>
          )}

          {/* ========================================== */}
          {/* 💡 NUOVO TAB: SEGNALAZIONI & TICKET */}
          {/* ========================================== */}
          {activeTab === 'crm-tickets' && (
            <div className="flex flex-col gap-6 animate-in fade-in">
              <div>
                <h2 className="text-2xl font-black text-rose-500">Centro SOS & Segnalazioni</h2>
                <p className="text-slate-400 text-sm mt-1">Leggi i messaggi dei giocatori che non riescono ad accedere o segnalano il furto del proprio Tag Alleanza.</p>
              </div>

              {isLoading ? ( <div className="text-slate-500 py-10">Caricamento ticket in corso...</div> ) : globalTickets.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center flex flex-col items-center gap-4">
                  <span className="text-5xl">☕</span>
                  <div className="text-slate-500 italic">Nessun ticket in coda. Ottimo lavoro.</div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {globalTickets.map(tkt => (
                    <div key={tkt.id} className={`bg-slate-900 border p-5 rounded-2xl flex flex-col sm:flex-row gap-4 justify-between items-start transition-colors ${tkt.status === 'Open' ? 'border-rose-500/50 shadow-[0_0_15px_rgba(225,29,72,0.1)]' : 'border-slate-800 opacity-70 hover:opacity-100'}`}>
                      
                      <div className="flex flex-col gap-3 w-full">
                        <div className="flex items-center gap-3">
                          {tkt.status === 'Open' ? (
                            <span className="bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded font-black uppercase tracking-wider animate-pulse">Nuovo</span>
                          ) : (
                            <span className="bg-slate-800 text-slate-500 text-[10px] px-2 py-0.5 rounded font-black uppercase tracking-wider">Risolto</span>
                          )}
                          <div className="text-slate-500 text-xs font-mono">{new Date(tkt.createdAt).toLocaleString()}</div>
                        </div>

                        <div>
                          <div className="text-white font-black text-lg">{tkt.playerName} <span className="text-slate-500 font-normal text-sm">dal Regno</span> <span className="text-cyan-400">{tkt.kingdom || 'N/A'}</span></div>
                          {tkt.allianceTag && <div className="text-amber-400 font-bold text-xs uppercase tracking-widest mt-1">Alleanza Coinvolta: [{tkt.allianceTag}]</div>}
                        </div>

                        <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-slate-300 text-sm whitespace-pre-wrap leading-relaxed mt-2">
                          "{tkt.message}"
                        </div>
                      </div>

                      <div className="flex sm:flex-col gap-2 w-full sm:w-auto shrink-0 mt-4 sm:mt-0">
                        <button onClick={() => handleResolveTicket(tkt.id, tkt.status)} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all border ${tkt.status === 'Open' ? 'bg-emerald-900/30 text-emerald-400 border-emerald-500/30 hover:bg-emerald-600 hover:text-white' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-white'}`}>
                          {tkt.status === 'Open' ? '✔ Segna come Risolto' : 'Riapri Ticket'}
                        </button>
                        <button onClick={() => handleDeleteTicket(tkt.id)} className="flex-1 sm:flex-none px-4 py-2 bg-slate-950 hover:bg-rose-900 text-slate-500 hover:text-rose-400 rounded-lg border border-slate-800 transition-colors">
                          Cestina
                        </button>
                      </div>

                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB MASTER PANEL (Intatto) */}
          {activeTab === 'master-panel' && (
             <div className="flex flex-col gap-6 animate-in fade-in">
             <div>
               <h2 className="text-2xl font-black text-white">Sicurezza & Accessi (Master Panel)</h2>
               <p className="text-slate-400 text-sm mt-1">Gestisci la Master Key globale e crea accessi temporanei con permessi specifici.</p>
             </div>
             {/* ... Ometto i div interni del Master Panel per brevità, sono invariati ... */}
           </div>
          )}

        </div>
      </main>
    </div>
  );
}