import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { doc, collection, getDocs, updateDoc, deleteDoc } from 'firebase/firestore';

export default function AdminCRM({ activeTab, t }) {
  const [isLoading, setIsLoading] = useState(false);
  const [globalUsers, setGlobalUsers] = useState([]);
  const [globalAlliances, setGlobalAlliances] = useState([]);
  const [globalTickets, setGlobalTickets] = useState([]); 
  const [searchUser, setSearchUser] = useState('');

  useEffect(() => {
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
  }, [activeTab]);

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

  // 📌 LOGICA TICKET AGGIORNATA CON MESSAGGIO DI RISPOSTA
  const handleResolveTicket = async (ticketId, currentStatus) => {
    if (currentStatus === 'Open') {
      const adminReply = window.prompt("Vuoi lasciare un messaggio al giocatore? (es. 'Il tuo nuovo PIN è 1234')\n\nLascia vuoto se non vuoi scrivere nulla.");
      if (adminReply === null) return; // Annullato dall'admin
      
      try {
        await updateDoc(doc(db, "tickets", ticketId), { status: 'Resolved', adminReply: adminReply.trim() });
        setGlobalTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: 'Resolved', adminReply: adminReply.trim() } : t));
      } catch(e) { alert(t('admin.error_ticket_update')); }
    } else {
      try {
        await updateDoc(doc(db, "tickets", ticketId), { status: 'Open', adminReply: '' });
        setGlobalTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: 'Open', adminReply: '' } : t));
      } catch(e) { alert(t('admin.error_ticket_update')); }
    }
  };

  const handleDeleteTicket = async (ticketId) => {
    if(!window.confirm(t('admin.confirm_delete_ticket'))) return;
    try {
      await deleteDoc(doc(db, "tickets", ticketId));
      setGlobalTickets(prev => prev.filter(t => t.id !== ticketId));
    } catch(e) { alert(t('admin.error_delete')); }
  };

  const filteredUsers = globalUsers.filter(u => u.displayName?.toLowerCase().includes(searchUser.toLowerCase()) || u.allianceId?.toLowerCase().includes(searchUser.toLowerCase()));

  return (
    <>
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
                    
                    {/* 📌 VISUALIZZAZIONE RISPOSTA ADMIN SE PRESENTE */}
                    {tkt.adminReply && (
                       <div className="bg-emerald-950/30 border border-emerald-900/50 p-3 rounded-lg mt-1 flex items-start gap-2">
                          <span className="text-emerald-500 mt-0.5">💬</span>
                          <div>
                            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest block mb-0.5">Risposta Consulente</span>
                            <span className="text-emerald-100 text-sm">{tkt.adminReply}</span>
                          </div>
                       </div>
                    )}
                  </div>

                  <div className="flex sm:flex-col gap-2 w-full sm:w-auto shrink-0 mt-4 sm:mt-0">
                    <button onClick={() => handleResolveTicket(tkt.id, tkt.status)} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all border ${tkt.status === 'Open' ? 'bg-emerald-900/30 text-emerald-400 border-emerald-500/30 hover:bg-emerald-600 hover:text-white' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-white'}`}>
                      {tkt.status === 'Open' ? 'Rispondi & Risolvi' : t('admin.reopen_ticket')}
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
    </>
  );
}