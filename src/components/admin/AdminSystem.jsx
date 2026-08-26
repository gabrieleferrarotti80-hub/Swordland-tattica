import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { doc, getDoc, setDoc, updateDoc, deleteField } from 'firebase/firestore';

export default function AdminSystem({ activeTab, t }) {
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
  }, []);

  const handleSaveMasterKey = async () => {
    try { 
      await setDoc(doc(db, "settings", "accessCodes"), { master: accessPasswords.master }, { merge: true }); 
      alert(t('admin.master_key_saved')); 
    } catch (e) { alert(t('admin.error')); }
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

  return (
    <>
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
    </>
  );
}