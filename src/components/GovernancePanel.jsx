import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { db } from '../firebase';
import { doc, getDocs, collection, query, where, updateDoc } from 'firebase/firestore';

export default function GovernancePanel({ auth, roster, setRoster, onBack, allianceDbData, setAllianceDbData }) {
  const { t } = useTranslation();
  const [pendingUsers, setPendingUsers] = useState([]);
  const [approvedUsers, setApprovedUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const qP = query(collection(db, "users"), where("allianceId", "==", auth.code), where("status", "==", "Pending"));
        const snapP = await getDocs(qP);
        setPendingUsers(snapP.docs.map(d => ({ id: d.id, ...d.data() })));

        const qA = query(collection(db, "users"), where("allianceId", "==", auth.code), where("status", "==", "Approved"));
        const snapA = await getDocs(qA);
        setApprovedUsers(snapA.docs.map(d => ({ id: d.id, ...d.data() })).filter(u => u.id !== auth.playerId));
      } catch (e) {
        console.error(e);
      }
      setIsLoading(false);
    };
    if (auth.code && auth.code !== 'SINGLE') fetchData();
  }, [auth]);

  const handleApproveUser = async (user) => {
    try {
      await updateDoc(doc(db, "users", user.id), { status: 'Approved' });
      const tag = auth.code.split('_')[1] || '';
      const newPlayer = { id: user.id, name: user.displayName, tag: tag, role: 'Member', power: 0, marches: 1, isParticipating: true };
      
      const updatedRoster = [...roster, newPlayer];
      setRoster(updatedRoster);
      await updateDoc(doc(db, "rosters", auth.code), { players: updatedRoster });
      
      setPendingUsers(prev => prev.filter(u => u.id !== user.id));
      setApprovedUsers(prev => [...prev, { ...user, status: 'Approved' }]);
      alert(t('governance.approved_success'));
    } catch (e) { alert(t('governance.error_generic')); }
  };

  const handleRejectUser = async (userId) => {
    try {
       await updateDoc(doc(db, "users", userId), { allianceId: null, status: 'Approved', role: 'Single' });
       setPendingUsers(prev => prev.filter(u => u.id !== userId));
       alert(t('governance.rejected_success'));
    } catch(e) { alert(t('governance.error_generic')); }
  };

  const handleInitiateTransfer = async (targetUser) => {
    const confirmMsg = t('governance.transfer_warning', { name: targetUser.displayName });
    if(!window.confirm(confirmMsg)) return;
    try {
      await updateDoc(doc(db, "alliances", auth.code), { pendingTransferTo: targetUser.id });
      setAllianceDbData(prev => ({ ...prev, pendingTransferTo: targetUser.id }));
      alert(t('governance.transfer_sent'));
    } catch(e) { alert(t('governance.error_generic')); }
  };

  const handleCancelTransfer = async () => {
    try {
      await updateDoc(doc(db, "alliances", auth.code), { pendingTransferTo: null });
      setAllianceDbData(prev => ({ ...prev, pendingTransferTo: null }));
    } catch(e) { alert(t('governance.error_generic')); }
  };

  return (
    <div className="flex flex-col w-full px-2 md:px-8 gap-6 animate-in slide-in-from-right-8 duration-300 pb-10">
       <button onClick={onBack} className="text-slate-400 hover:text-white font-bold text-xs uppercase mb-2 text-left w-fit flex items-center px-6 py-3 border border-slate-700 bg-slate-900 rounded-full">{t('home.back_menu')}</button>
       
       <div className="bg-slate-900 border border-amber-500/30 p-6 rounded-3xl shadow-xl flex flex-col gap-4 max-w-4xl mx-auto w-full">
          <div className="border-b border-slate-800 pb-4 mb-2">
             <h3 className="text-2xl font-black text-amber-400 flex items-center gap-2"><span>🛡️</span> {t('governance.pending_users')}</h3>
             <p className="text-slate-400 text-sm mt-1">{t('governance.pending_subtitle')}</p>
          </div>
          
          {isLoading ? ( <div className="text-slate-500 text-center py-10 animate-pulse">{t('governance.loading')}</div> ) : 
           pendingUsers.length === 0 ? ( <div className="text-slate-600 text-center py-8 italic bg-slate-950 rounded-2xl border border-slate-800">{t('governance.no_pending')}</div> ) : (
             <div className="flex flex-col gap-3">
                {pendingUsers.map(u => (
                   <div key={u.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-950 border border-slate-800 p-4 rounded-xl gap-4 hover:border-slate-600 transition-colors">
                      <div>
                         <div className="text-white font-black text-lg">{u.displayName}</div>
                         <div className="text-xs text-slate-500 font-mono tracking-widest mt-1">{t('governance.id_label', { id: u.id })}</div>
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto">
                         <button onClick={() => handleApproveUser(u)} className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase rounded-lg transition-all shadow-[0_0_10px_rgba(5,150,105,0.3)]">{t('governance.approve')}</button>
                         <button onClick={() => handleRejectUser(u.id)} className="px-6 py-2.5 bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white text-xs font-black uppercase rounded-lg transition-all border border-slate-700">{t('governance.reject')}</button>
                      </div>
                   </div>
                ))}
             </div>
          )}
       </div>

       <div className="bg-slate-900 border border-indigo-500/30 p-6 rounded-3xl shadow-xl flex flex-col gap-4 max-w-4xl mx-auto w-full mt-4">
          <div className="border-b border-slate-800 pb-4 mb-2 flex justify-between items-end">
             <div>
               <h3 className="text-2xl font-black text-indigo-400 flex items-center gap-2"><span>📋</span> {t('governance.members_title')}</h3>
               <p className="text-slate-400 text-sm mt-1">{t('governance.members_subtitle')}</p>
             </div>
             {allianceDbData?.pendingTransferTo && (auth.playerId === allianceDbData?.currentR5 || auth.role === 'admin') && (
                <button onClick={handleCancelTransfer} className="px-4 py-2 bg-rose-900/50 hover:bg-rose-600 text-rose-400 hover:text-white text-xs font-bold rounded-lg border border-rose-500/50 transition-colors">
                   {t('governance.cancel_transfer')}
                </button>
             )}
          </div>
          
          {isLoading ? ( <div className="text-slate-500 text-center py-10 animate-pulse">{t('governance.loading')}</div> ) : 
           approvedUsers.length === 0 ? ( <div className="text-slate-600 text-center py-8 italic bg-slate-950 rounded-2xl border border-slate-800">{t('governance.no_other_members')}</div> ) : (
             <div className="flex flex-col gap-3">
                {approvedUsers.map(u => {
                   const isPendingTarget = allianceDbData?.pendingTransferTo === u.id;
                   return (
                     <div key={u.id} className={`flex flex-col sm:flex-row justify-between items-start sm:items-center border p-4 rounded-xl gap-4 transition-colors ${isPendingTarget ? 'bg-amber-900/20 border-amber-500/50' : 'bg-slate-950 border-slate-800 hover:border-slate-600'}`}>
                        <div>
                           <div className="flex items-center gap-2">
                              <span className="text-white font-black text-lg">{u.displayName}</span>
                              <span className="bg-slate-800 text-slate-300 text-[10px] px-2 py-0.5 rounded font-bold uppercase border border-slate-700">{u.role}</span>
                              {isPendingTarget && <span className="bg-amber-500 text-slate-900 text-[10px] px-2 py-0.5 rounded font-black uppercase animate-pulse">{t('governance.appointed_r5')}</span>}
                           </div>
                           <div className="text-xs text-slate-500 font-mono tracking-widest mt-1">{t('governance.id_label', { id: u.id })}</div>
                        </div>
                        
                        {(auth.playerId === allianceDbData?.currentR5 || auth.role === 'admin') && !allianceDbData?.pendingTransferTo && (
                           <button onClick={() => handleInitiateTransfer(u)} className="px-4 py-2 bg-slate-800 hover:bg-amber-600 text-slate-300 hover:text-white text-xs font-black uppercase tracking-wider rounded-lg transition-all border border-slate-700 hover:border-amber-500">
                              {t('governance.transfer_r5')}
                           </button>
                        )}
                     </div>
                   )
                })}
             </div>
          )}
       </div>
    </div>
  );
}