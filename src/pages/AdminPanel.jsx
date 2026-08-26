import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { db } from '../firebase';
import { doc, getDoc, setDoc, collection, getDocs, updateDoc, deleteField, deleteDoc } from 'firebase/firestore';

export default function AdminPanel({ auth }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  
  const [activeTab, setActiveTab] = useState('crm-users');
  const [isLoading, setIsLoading] = useState(false);

  const [globalUsers, setGlobalUsers] = useState([]);
  const [globalAlliances, setGlobalAlliances] = useState([]);
  const [globalTickets, setGlobalTickets] = useState([]); 
  const [searchUser, setSearchUser] = useState('');

  const [vercelWebhook, setVercelWebhook] = useState('');
  const [releaseVersion, setReleaseVersion] = useState('');
  const [releaseNotes, setReleaseNotes] = useState('');
  const [isAnnounceActive, setIsAnnounceActive] = useState(false);
  const [accessPasswords, setAccessPasswords] = useState({ master: 'MASTER' });
  const [tempUser, setTempUser] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [tempCastleAccess, setTempCastleAccess] = useState(false);
  const [tempPasswordsList, setTempPasswordsList] = useState([]);

  // Stati per la Normalizzazione Database
  const [isNormalizing, setIsNormalizing] = useState(false);
  const [normLogs, setNormLogs] = useState([]);

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
        <h2 className="text-3xl font-black text-rose-500 mb-4">{t('admin.access_denied')}</h2>
        <button onClick={() => navigate('/')} className="px-6 py-2 bg-slate-800 rounded-lg font-bold">{t('admin.back_home')}</button>
      </div>
    );
  }

  // AZIONI CRM
  const handleBanUser = async (userId, currentStatus) => {
    const newStatus = currentStatus === 'Banned' ? 'Approved' : 'Banned';
    if(!window.confirm(currentStatus === 'Banned' ? t('admin.confirm_unban') : t('admin.confirm_ban'))) return;
    try {
      await updateDoc(doc(db, "users", userId), { status: newStatus });
      setGlobalUsers(prev => prev.map(u => u.id === userId ? { ...u, status: newStatus } : u));
    } catch(e) { alert(t('admin.error')); }
  };

  const handleChangePin = async (userId, userName) => {
    const newPin = window.prompt(t('admin.prompt_new_pin', { name: userName }));
    if(!newPin || newPin.trim() === '') return;
    try {
      await updateDoc(doc(db, "users", userId), { pin: newPin.trim() });
      setGlobalUsers(prev => prev.map(u => u.id === userId ? { ...u, pin: newPin.trim() } : u));
    } catch(e) { alert(t('admin.error')); }
  };

  const handleDeleteUser = async (userId) => {
    if(!window.confirm(t('admin.confirm_delete_user'))) return;
    try {
      await deleteDoc(doc(db, "users", userId));
      setGlobalUsers(prev => prev.filter(u => u.id !== userId));
    } catch(e) { alert(t('admin.error')); }
  };

  const handleTogglePremium = async (allianceId, currentFeatures) => {
    const newCastleAccess = !(currentFeatures?.castleBattle);
    try {
      await updateDoc(doc(db, "alliances", allianceId), { "premiumFeatures.castleBattle": newCastleAccess });
      setGlobalAlliances(prev => prev.map(a => a.id === allianceId ? { ...a, premiumFeatures: { ...a.premiumFeatures, castleBattle: newCastleAccess } } : a));
    } catch(e) { alert(t('admin.error')); }
  };

  const handleDeleteAlliance = async (allianceId) => {
    if(!window.confirm(t('admin.confirm_destroy_alliance', { id: allianceId }))) return;
    try {
      await deleteDoc(doc(db, "alliances", allianceId));
      await deleteDoc(doc(db, "rosters", allianceId));
      setGlobalAlliances(prev => prev.filter(a => a.id !== allianceId));
    } catch(e) { alert(t('admin.error')); }
  };

  const handleResolveTicket = async (ticketId, currentStatus) => {
    const newStatus = currentStatus === 'Open' ? 'Resolved' : 'Open';
    try {
      await updateDoc(doc(db, "tickets", ticketId), { status: newStatus });
      setGlobalTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: newStatus } : t));
    } catch(e) { alert(t('admin.error_ticket_update')); }
  };

  const handleDeleteTicket = async (ticketId) => {
    if(!window.confirm(t('admin.confirm_delete_ticket'))) return;
    try {
      await deleteDoc(doc(db, "tickets", ticketId));
      setGlobalTickets(prev => prev.filter(t => t.id !== ticketId));
    } catch(e) { alert(t('admin.error_delete')); }
  };

  const handleSaveMasterKey = async () => {
    try { await setDoc(doc(db, "settings", "accessCodes"), { master: accessPasswords.master }, { merge: true }); alert(t('admin.master_key_saved')); } 
    catch (e) { alert(t('admin.error')); }
  };

  const handleCreateTempPassword = async () => {
      if(!tempUser || !tempPassword) return;
      try {
        await setDoc(doc(db, "settings", "accessCodes"), { [tempUser]: { password: tempPassword, castleAccess: tempCastleAccess } }, { merge: true });
        setTempPasswordsList(prev => [...prev, { user: tempUser, password: tempPassword, castleAccess: tempCastleAccess }]);
        setTempUser(''); setTempPassword(''); setTempCastleAccess(false);
      } catch (e) { alert(t('admin.error')); }
  };

  const handleDeleteTempPassword = async (user) => {
      if(!window.confirm(t('admin.confirm_delete_access', { user: user }))) return;
      try {
          await updateDoc(doc(db, "settings", "accessCodes"), { [user]: deleteField() });
          setTempPasswordsList(prev => prev.filter(item => item.user !== user));
      } catch (e) {}
  };

  const handleSaveSystemSettings = async () => {
    try {
      await setDoc(doc(db, "settings", "deploy"), { webhook: vercelWebhook }, { merge: true });
      await setDoc(doc(db, "system", "announcement"), { version: releaseVersion, text: releaseNotes, active: isAnnounceActive }, { merge: true });
      alert(t('admin.system_saved'));
    } catch(e) { alert(t('admin.error')); }
  };

  // 🛠️ AZIONE SPECIALE: NORMALIZZAZIONE DATABASE A TAPPETO (FORZATA)
  const handleNormalizeDatabase = async () => {
    if(!window.confirm("⚠️ ATTENZIONE: Questo sovrascriverà campi in Rosters e Marches per standardizzare Regni, Alleanze e ID. Vuoi procedere?")) return;
    
    setIsNormalizing(true);
    setNormLogs(["🚀 Avvio Normalizzazione Database Aggressiva..."]);
    const addLog = (msg) => setNormLogs(prev => [...prev, msg]);

    try {
      // =====================================
      // 1. NORMALIZZAZIONE ROSTERS
      // =====================================
      addLog("Scansione collezione 'rosters'...");
      const rostersSnap = await getDocs(collection(db, "rosters"));
      
      for (const docSnap of rostersSnap.docs) {
        const data = docSnap.data();
        const docId = docSnap.id;

        let parsedRealm = '';
        let parsedAlliance = '';
        if (docId.includes('_')) {
           const parts = docId.split('_');
           parsedRealm = parts[0];
           parsedAlliance = parts.slice(1).join('_');
        } else {
           parsedAlliance = docId;
        }

        let finalRealm = String(data.realm || data.regno || data.server || parsedRealm || 'Sconosciuto').trim();
        let finalAlliance = String(data.allianceCode || data.code || data.alliance || parsedAlliance || 'Sconosciuta').trim().toUpperCase();

        // 🚨 PULIZIA FORZATA: Se l'alleanza contiene ancora un underscore (es. "1007_REV" al posto di "REV")
        if (finalAlliance.includes('_')) {
            const parts = finalAlliance.split('_');
            if (!isNaN(parts[0])) { // Se la prima parte è un numero (es. 1007)
                finalRealm = parts[0];
                finalAlliance = parts.slice(1).join('_'); // Il resto è il tag
            }
        }

        let normalizedMembers = [];
        const extractMember = (m) => {
           if(!m || typeof m !== 'object') return;
           const id = String(m.id || m.playerId || m.uid || '').trim();
           const name = String(m.name || m.playerName || m.nickname || '').trim();
           if(id && id !== 'undefined') {
              
              // Applica la pulizia forzata anche alle variabili interne dei membri!
              let memAlliance = String(m.allianceCode || m.alliance || finalAlliance).trim().toUpperCase();
              let memRealm = String(m.realm || m.regno || m.server || finalRealm).trim();
              
              if (memAlliance.includes('_')) {
                  const parts = memAlliance.split('_');
                  if (!isNaN(parts[0])) {
                      memRealm = parts[0];
                      memAlliance = parts.slice(1).join('_');
                  }
              }

              normalizedMembers.push({ id, name, allianceCode: memAlliance, realm: memRealm });
           }
        };

        if (Array.isArray(data.members)) data.members.forEach(extractMember);
        else if (Array.isArray(data.players)) data.players.forEach(extractMember);
        else if (data.members && typeof data.members === 'object') Object.values(data.members).forEach(extractMember);
        else if (data.players && typeof data.players === 'object') Object.values(data.players).forEach(extractMember);

        // Rimuove eventuali ID duplicati all'interno dello stesso roster
        const uniqueMembers = Array.from(new Map(normalizedMembers.map(item => [item.id, item])).values());

        // Sovrascrittura e Pulizia
        await updateDoc(doc(db, "rosters", docId), {
           realm: finalRealm,
           allianceCode: finalAlliance,
           members: uniqueMembers 
        });
        
        addLog(`✅ Roster [${docId}] normalizzato: ${uniqueMembers.length} membri (Regno: ${finalRealm}, Tag: ${finalAlliance}).`);
      }

      // =====================================
      // 2. NORMALIZZAZIONE PLAYER MARCHES
      // =====================================
      addLog("Scansione collezione 'playerMarches'...");
      const marchesSnap = await getDocs(collection(db, "playerMarches"));
      
      for (const docSnap of marchesSnap.docs) {
        const data = docSnap.data();
        const docId = docSnap.id;

        let parsedRealm = 'Sconosciuto';
        let parsedAlliance = 'Sconosciuta';
        if (docId.includes('_')) {
            const parts = docId.split('_');
            if (parts.length >= 3 && !isNaN(parts[0])) { 
                parsedRealm = parts[0];
                parsedAlliance = parts[1];
            } else if (parts.length >= 2) { 
                parsedAlliance = parts[0];
            }
        }

        let finalRealm = String(data.realm || data.regno || data.server || parsedRealm).trim();
        let finalAlliance = String(data.allianceCode || data.alliance || parsedAlliance).trim().toUpperCase();
        const finalId = String(data.playerId || data.id || docId.split('_').pop()).trim();
        const finalName = String(data.playerName || data.name || 'Sconosciuto').trim();

        // 🚨 PULIZIA FORZATA
        if (finalAlliance.includes('_')) {
            const parts = finalAlliance.split('_');
            if (!isNaN(parts[0])) {
                finalRealm = parts[0];
                finalAlliance = parts.slice(1).join('_');
            }
        }

        await updateDoc(doc(db, "playerMarches", docId), {
           realm: finalRealm,
           allianceCode: finalAlliance,
           playerId: finalId,
           playerName: finalName
        });
        addLog(`✅ Build [${docId}] normalizzata: (Regno: ${finalRealm}, Tag: ${finalAlliance}).`);
      }

      addLog("🎉 NORMALIZZAZIONE COMPLETATA CON SUCCESSO!");

    } catch (e) {
      console.error(e);
      addLog(`❌ ERRORE CRITICO: ${e.message}`);
    }
    setIsNormalizing(false);
  };

  const filteredUsers = globalUsers.filter(u => u.displayName?.toLowerCase().includes(searchUser.toLowerCase()) || u.allianceId?.toLowerCase().includes(searchUser.toLowerCase()));

  return (
    <div className="h-screen bg-slate-950 flex flex-col md:flex-row overflow-hidden text-slate-200 font-sans">
      
      <aside className="w-full md:w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-xl font-black text-rose-500 flex items-center gap-2">{t('admin.god_room')}</h1>
          <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest">{t('admin.supreme_panel')}</p>
        </div>
        
        <div className="flex-1 p-4 flex flex-col gap-2 overflow-y-auto custom-scrollbar">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 ml-2">{t('admin.global_crm')}</div>
          <button onClick={() => setActiveTab('crm-users')} className={`px-4 py-3 rounded-xl text-sm font-bold text-left transition-colors flex items-center gap-3 ${activeTab === 'crm-users' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-slate-400 hover:bg-slate-800'}`}>
            {t('admin.user_registry')}
          </button>
          <button onClick={() => setActiveTab('crm-alliances')} className={`px-4 py-3 rounded-xl text-sm font-bold text-left transition-colors flex items-center gap-3 ${activeTab === 'crm-alliances' ? 'bg-amber-600/20 text-amber-400 border border-amber-500/30' : 'text-slate-400 hover:bg-slate-800'}`}>
            {t('admin.alliance_licenses')}
          </button>
          <button onClick={() => setActiveTab('crm-tickets')} className={`px-4 py-3 rounded-xl text-sm font-bold text-left transition-colors flex items-center gap-3 ${activeTab === 'crm-tickets' ? 'bg-rose-600/20 text-rose-400 border border-rose-500/30' : 'text-slate-400 hover:bg-slate-800'}`}>
            {t('admin.tickets_reports')}
          </button>

          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 ml-2 mt-4">{t('admin.system')}</div>
          <button onClick={() => setActiveTab('master-panel')} className={`px-4 py-3 rounded-xl text-sm font-bold text-left transition-colors flex items-center gap-3 ${activeTab === 'master-panel' ? 'bg-fuchsia-600/20 text-fuchsia-400 border border-fuchsia-500/30' : 'text-slate-400 hover:bg-slate-800'}`}>
            {t('admin.master_keys')}
          </button>
          <button onClick={() => setActiveTab('deploy-center')} className={`px-4 py-3 rounded-xl text-sm font-bold text-left transition-colors flex items-center gap-3 ${activeTab === 'deploy-center' ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' : 'text-slate-400 hover:bg-slate-800'}`}>
            {t('admin.patch_deploy')}
          </button>
          
          <button onClick={() => setActiveTab('db-tools')} className={`px-4 py-3 rounded-xl text-sm font-bold text-left transition-colors flex items-center gap-3 ${activeTab === 'db-tools' ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30' : 'text-slate-400 hover:bg-slate-800'}`}>
            🛠️ Strumenti DB
          </button>
        </div>

        <div className="p-4 border-t border-slate-800">
          <button onClick={() => navigate('/')} className="w-full px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-colors">{t('admin.back_to_hub')}</button>
        </div>
      </aside>

      <main className="flex-1 p-4 md:p-8 overflow-y-auto bg-[#090e17] relative">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
        
        <div className="max-w-6xl mx-auto relative z-10">
          
          {activeTab === 'crm-users' && (
             <div className="flex flex-col gap-6 animate-in fade-in">
             <div>
               <h2 className="text-2xl font-black text-white">{t('admin.crm_users_title')}</h2>
               <p className="text-slate-400 text-sm mt-1">{t('admin.crm_users_desc')}</p>
             </div>

             <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-xl overflow-hidden flex flex-col">
               <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex flex-col md:flex-row justify-between gap-4 items-center">
                  <div className="relative w-full md:w-1/2">
                     <span className="absolute left-3 top-2.5 text-slate-500">🔍</span>
                     <input type="text" placeholder={t('admin.search_placeholder')} value={searchUser} onChange={e => setSearchUser(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
                  </div>
                  <div className="text-xs font-bold text-slate-400 bg-slate-950 px-4 py-2 rounded-lg border border-slate-800">
                     {t('admin.total_users')} <span className="text-blue-400">{filteredUsers.length}</span>
                  </div>
               </div>

               <div className="overflow-x-auto">
                 <table className="w-full text-left text-sm whitespace-nowrap">
                   <thead className="bg-slate-950/80 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-800">
                     <tr>
                       <th className="p-4">{t('admin.user_kingdom')}</th>
                       <th className="p-4">{t('admin.guild_role')}</th>
                       <th className="p-4">{t('admin.status')}</th>
                       <th className="p-4 text-center">{t('admin.pin_code')}</th>
                       <th className="p-4 text-right">{t('admin.admin_actions')}</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-800 text-slate-300">
                     {isLoading ? (<tr><td colSpan="5" className="p-8 text-center text-slate-500">{t('admin.loading')}</td></tr>) : filteredUsers.map(u => (
                       <tr key={u.id} className="hover:bg-slate-800/50 transition-colors">
                         <td className="p-4">
                           <div className="font-black text-white">{u.displayName}</div>
                           <div className="text-xs text-slate-500 mt-0.5">{t('admin.kingdom_label')} <span className="text-cyan-400">{u.kingdom}</span></div>
                         </td>
                         <td className="p-4">
                           <div className="font-bold text-amber-400">{u.allianceId ? `[${u.allianceId.split('_')[1]}]` : t('admin.solo')}</div>
                           <div className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded uppercase mt-1 w-fit">{u.role}</div>
                         </td>
                         <td className="p-4">
                           {u.status === 'Approved' ? <span className="text-emerald-400 font-bold text-xs bg-emerald-400/10 px-2 py-1 rounded">{t('admin.approved')}</span> :
                            u.status === 'Pending' ? <span className="text-amber-400 font-bold text-xs bg-amber-400/10 px-2 py-1 rounded">{t('admin.pending')}</span> :
                            <span className="text-rose-500 font-bold text-xs bg-rose-500/10 px-2 py-1 rounded">{t('admin.banned')}</span>}
                         </td>
                         <td className="p-4 text-center">
                           <button onClick={() => handleChangePin(u.id, u.displayName)} className="text-xs font-mono bg-slate-950 border border-slate-700 hover:border-blue-500 px-3 py-1 rounded-md text-slate-400 hover:text-white transition-colors" title={t('admin.click_to_edit')}>
                             {u.pin} ✏️
                           </button>
                         </td>
                         <td className="p-4 text-right flex justify-end gap-2">
                           <button onClick={() => handleBanUser(u.id, u.status)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${u.status === 'Banned' ? 'bg-emerald-900/30 text-emerald-500 hover:bg-emerald-600 hover:text-white border border-emerald-500/30' : 'bg-rose-900/30 text-rose-500 hover:bg-rose-600 hover:text-white border border-rose-500/30'}`}>
                             {u.status === 'Banned' ? t('admin.unban') : t('admin.ban')}
                           </button>
                           <button onClick={() => handleDeleteUser(u.id)} className="px-2 py-1.5 bg-slate-950 hover:bg-rose-900 text-slate-500 hover:text-rose-400 rounded-lg border border-slate-800 transition-colors" title={t('admin.delete_account')}>🗑️</button>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
             </div>
           </div>
          )}

          {activeTab === 'crm-alliances' && (
             <div className="flex flex-col gap-6 animate-in fade-in">
             <div>
               <h2 className="text-2xl font-black text-white">{t('admin.crm_alliances_title')}</h2>
               <p className="text-slate-400 text-sm mt-1">{t('admin.crm_alliances_desc')}</p>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
               {isLoading ? ( <div className="text-slate-500 py-10 col-span-full">{t('admin.loading')}</div> ) : globalAlliances.length === 0 ? ( <div className="text-slate-500 py-10 col-span-full">{t('admin.no_alliances')}</div> ) : 
                globalAlliances.map(al => (
                 <div key={al.id} className="bg-slate-900 border border-slate-700 p-5 rounded-2xl flex flex-col gap-4 shadow-lg hover:border-amber-500/50 transition-colors">
                   <div className="flex justify-between items-start border-b border-slate-800 pb-3">
                     <div>
                       <div className="text-2xl font-black text-white">[{al.tag}]</div>
                       <div className="text-xs text-slate-400 mt-1">{t('admin.kingdom_label')} {al.kingdom} • {al.name}</div>
                     </div>
                     <button onClick={() => handleDeleteAlliance(al.id)} className="text-slate-600 hover:text-rose-500 text-sm p-2 bg-slate-950 rounded-lg border border-slate-800 transition-colors" title={t('admin.destroy_alliance')}>🗑️</button>
                   </div>

                   <div className="flex flex-col gap-2">
                      <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">{t('admin.premium_modules')}</div>
                      <label className="flex items-center justify-between bg-slate-950 p-3 rounded-lg border border-slate-800 cursor-pointer hover:border-fuchsia-500/50 transition-colors">
                         <span className="text-xs font-bold text-slate-300 flex items-center gap-2"><span>👑</span> {t('admin.castle_battle')}</span>
                         <input type="checkbox" checked={al.premiumFeatures?.castleBattle || false} onChange={() => handleTogglePremium(al.id, al.premiumFeatures)} className="w-5 h-5 accent-fuchsia-600 cursor-pointer" />
                      </label>
                   </div>
                 </div>
                ))}
             </div>
           </div>
          )}

          {activeTab === 'crm-tickets' && (
            <div className="flex flex-col gap-6 animate-in fade-in">
              <div>
                <h2 className="text-2xl font-black text-rose-500">{t('admin.crm_tickets_title')}</h2>
                <p className="text-slate-400 text-sm mt-1">{t('admin.crm_tickets_desc')}</p>
              </div>

              {isLoading ? ( <div className="text-slate-500 py-10">{t('admin.loading_tickets')}</div> ) : globalTickets.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center flex flex-col items-center gap-4">
                  <span className="text-5xl">☕</span>
                  <div className="text-slate-500 italic">{t('admin.no_tickets')}</div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {globalTickets.map(tkt => (
                    <div key={tkt.id} className={`bg-slate-900 border p-5 rounded-2xl flex flex-col sm:flex-row gap-4 justify-between items-start transition-colors ${tkt.status === 'Open' ? 'border-rose-500/50 shadow-[0_0_15px_rgba(225,29,72,0.1)]' : 'border-slate-800 opacity-70 hover:opacity-100'}`}>
                      
                      <div className="flex flex-col gap-3 w-full">
                        <div className="flex items-center gap-3">
                          {tkt.status === 'Open' ? (
                            <span className="bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded font-black uppercase tracking-wider animate-pulse">{t('admin.ticket_new')}</span>
                          ) : (
                            <span className="bg-slate-800 text-slate-500 text-[10px] px-2 py-0.5 rounded font-black uppercase tracking-wider">{t('admin.ticket_resolved')}</span>
                          )}
                          <div className="text-slate-500 text-xs font-mono">{new Date(tkt.createdAt).toLocaleString()}</div>
                        </div>

                        <div>
                          <div className="text-white font-black text-lg">{tkt.playerName} <span className="text-slate-500 font-normal text-sm">{t('admin.from_kingdom')}</span> <span className="text-cyan-400">{tkt.kingdom || 'N/A'}</span></div>
                          {tkt.allianceTag && <div className="text-amber-400 font-bold text-xs uppercase tracking-widest mt-1">{t('admin.involved_alliance')} [{tkt.allianceTag}]</div>}
                        </div>

                        <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-slate-300 text-sm whitespace-pre-wrap leading-relaxed mt-2">
                          "{tkt.message}"
                        </div>
                      </div>

                      <div className="flex sm:flex-col gap-2 w-full sm:w-auto shrink-0 mt-4 sm:mt-0">
                        <button onClick={() => handleResolveTicket(tkt.id, tkt.status)} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all border ${tkt.status === 'Open' ? 'bg-emerald-900/30 text-emerald-400 border-emerald-500/30 hover:bg-emerald-600 hover:text-white' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-white'}`}>
                          {tkt.status === 'Open' ? t('admin.mark_resolved') : t('admin.reopen_ticket')}
                        </button>
                        <button onClick={() => handleDeleteTicket(tkt.id)} className="flex-1 sm:flex-none px-4 py-2 bg-slate-950 hover:bg-rose-900 text-slate-500 hover:text-rose-400 rounded-lg border border-slate-800 transition-colors">
                          {t('admin.trash')}
                        </button>
                      </div>

                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'master-panel' && (
            <div className="flex flex-col gap-6 animate-in fade-in">
              <div>
                <h2 className="text-2xl font-black text-white">{t('admin.master_panel_title')}</h2>
                <p className="text-slate-400 text-sm mt-1">{t('admin.master_panel_desc')}</p>
              </div>

              <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl shadow-xl flex flex-col gap-4">
                <h3 className="text-rose-500 font-black text-lg">{t('admin.global_master_key')}</h3>
                <div className="flex gap-4 items-center">
                  <input type="text" value={accessPasswords.master} onChange={e => setAccessPasswords({...accessPasswords, master: e.target.value})} className="bg-slate-950 border border-slate-700 text-white px-4 py-2 rounded-lg w-full max-w-md focus:border-rose-500 outline-none" />
                  <button onClick={handleSaveMasterKey} className="bg-rose-600 hover:bg-rose-500 text-white px-6 py-2 rounded-lg font-bold transition-colors">{t('admin.save_key')}</button>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl shadow-xl flex flex-col gap-6">
                <h3 className="text-cyan-400 font-black text-lg">{t('admin.temp_access_title')}</h3>
                
                <div className="flex flex-col md:flex-row gap-4 items-end bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <div className="w-full">
                    <label className="text-xs text-slate-500 font-bold uppercase mb-1 block">{t('admin.username')}</label>
                    <input type="text" value={tempUser} onChange={e => setTempUser(e.target.value)} className="w-full bg-slate-900 border border-slate-700 text-white px-3 py-2 rounded-lg outline-none focus:border-cyan-500" placeholder={t('admin.guest_placeholder', 'Es. GUEST_1')} />
                  </div>
                  <div className="w-full">
                    <label className="text-xs text-slate-500 font-bold uppercase mb-1 block">{t('admin.password')}</label>
                    <input type="text" value={tempPassword} onChange={e => setTempPassword(e.target.value)} className="w-full bg-slate-900 border border-slate-700 text-white px-3 py-2 rounded-lg outline-none focus:border-cyan-500" placeholder={t('admin.secret_password', 'Password segreta')} />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer bg-slate-900 px-4 py-2 rounded-lg border border-slate-700 hover:border-fuchsia-500 transition-colors w-full md:w-auto shrink-0 h-[42px]">
                    <input type="checkbox" checked={tempCastleAccess} onChange={e => setTempCastleAccess(e.target.checked)} className="accent-fuchsia-600 w-4 h-4" />
                    <span className="text-xs font-bold text-slate-300 whitespace-nowrap">👑 {t('admin.castle_access')}</span>
                  </label>
                  <button onClick={handleCreateTempPassword} className="bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-2 rounded-lg font-bold transition-colors h-[42px] shrink-0">{t('admin.add_access')}</button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {tempPasswordsList.map(item => (
                    <div key={item.user} className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex justify-between items-center">
                      <div>
                        <div className="font-black text-cyan-400">{item.user}</div>
                        <div className="text-xs text-slate-500 font-mono mt-1">PWD: <span className="text-white">{item.password}</span></div>
                        {item.castleAccess && <div className="text-[10px] bg-fuchsia-900/30 text-fuchsia-400 px-2 py-0.5 rounded font-bold uppercase mt-2 inline-block">👑 {t('admin.castle_unlocked')}</div>}
                      </div>
                      <button onClick={() => handleDeleteTempPassword(item.user)} className="text-slate-600 hover:text-rose-500 text-xl p-2 transition-colors">🗑️</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'deploy-center' && (
            <div className="flex flex-col gap-6 animate-in fade-in">
              <div>
                <h2 className="text-2xl font-black text-white">{t('admin.deploy_title')}</h2>
                <p className="text-slate-400 text-sm mt-1">{t('admin.deploy_desc')}</p>
              </div>

              <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl shadow-xl flex flex-col gap-4">
                <h3 className="text-emerald-400 font-black text-lg">{t('admin.announcement_title')}</h3>
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input type="checkbox" checked={isAnnounceActive} onChange={e => setIsAnnounceActive(e.target.checked)} className="accent-emerald-600 w-5 h-5" />
                  <span className="text-sm font-bold text-slate-300">{t('admin.announce_active')}</span>
                </label>
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-slate-500 font-bold uppercase">{t('admin.patch_version')}</label>
                  <input type="text" value={releaseVersion} onChange={e => setReleaseVersion(e.target.value)} className="bg-slate-950 border border-slate-800 text-white px-4 py-2 rounded-lg outline-none focus:border-emerald-500" />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-slate-500 font-bold uppercase">{t('admin.patch_notes')}</label>
                  <textarea value={releaseNotes} onChange={e => setReleaseNotes(e.target.value)} className="bg-slate-950 border border-slate-800 text-white px-4 py-2 rounded-lg outline-none focus:border-emerald-500 h-32 custom-scrollbar" placeholder={t('admin.patch_notes_placeholder', 'Novità della patch...')}></textarea>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl shadow-xl flex flex-col gap-4">
                <h3 className="text-indigo-400 font-black text-lg">{t('admin.webhook_title')}</h3>
                <input type="text" value={vercelWebhook} onChange={e => setVercelWebhook(e.target.value)} className="bg-slate-950 border border-slate-800 text-white px-4 py-2 rounded-lg outline-none focus:border-indigo-500" placeholder="https://api.vercel.com/v1/integrations/deploy/..." />
              </div>

              <div className="flex justify-end">
                 <button onClick={handleSaveSystemSettings} className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-3 rounded-xl font-black shadow-lg transition-colors">{t('admin.save_system')}</button>
              </div>
            </div>
          )}

          {/* 📌 TAB: NORMALIZZAZIONE DATABASE */}
          {activeTab === 'db-tools' && (
             <div className="flex flex-col gap-6 animate-in fade-in">
             <div>
               <h2 className="text-2xl font-black text-cyan-400">Strumenti Database</h2>
               <p className="text-slate-400 text-sm mt-1">Normalizza e correggi le incongruenze nei dati di Rosters e PlayerMarches.</p>
             </div>

             <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl shadow-xl flex flex-col gap-6">
                
                <div className="bg-rose-950/20 border border-rose-900/50 rounded-xl p-4 flex flex-col gap-3">
                   <h3 className="text-rose-500 font-black flex items-center gap-2">⚠️ Avvertenza Importante</h3>
                   <p className="text-xs text-slate-400 leading-relaxed">
                     Questa operazione sovrascriverà tutti i documenti nelle collezioni <strong>rosters</strong> e <strong>playerMarches</strong> per assicurarsi che i campi <code className="bg-slate-950 text-amber-400 px-1 rounded">realm</code>, <code className="bg-slate-950 text-amber-400 px-1 rounded">allianceCode</code> e l'array <code className="bg-slate-950 text-amber-400 px-1 rounded">members</code> siano formattati in modo rigoroso e standardizzato.<br/>
                     Questa operazione risolverà definitivamente i problemi di ricerca giocatori per i Consulenti.
                   </p>
                   <button 
                     onClick={handleNormalizeDatabase}
                     disabled={isNormalizing}
                     className="mt-2 py-3 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-black uppercase tracking-widest rounded-lg transition-colors shadow-lg disabled:opacity-50"
                   >
                     {isNormalizing ? '⏳ Normalizzazione in corso...' : '🛠️ Avvia Normalizzazione Database'}
                   </button>
                </div>

                {/* Console dei Log */}
                <div className="bg-[#050505] border border-slate-800 rounded-xl p-4 h-96 overflow-y-auto font-mono text-[10px] custom-scrollbar">
                   {normLogs.length === 0 ? (
                     <div className="text-slate-600 italic">In attesa di istruzioni...</div>
                   ) : (
                     <div className="flex flex-col gap-1">
                        {normLogs.map((log, i) => (
                           <div key={i} className={`${log.includes('ERRORE') ? 'text-rose-500' : log.includes('✅') ? 'text-emerald-400' : log.includes('🎉') ? 'text-fuchsia-400 font-bold text-xs' : 'text-slate-400'}`}>
                             {`> ${log}`}
                           </div>
                        ))}
                     </div>
                   )}
                </div>

             </div>
           </div>
          )}

        </div>
      </main>
    </div>
  );
}