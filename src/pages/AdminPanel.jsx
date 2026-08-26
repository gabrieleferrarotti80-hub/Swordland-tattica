import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

// 📌 Importiamo i tre nuovi sottomoduli
import AdminCRM from '../components/admin/AdminCRM';
import AdminSystem from '../components/admin/AdminSystem';
import AdminDBTools from '../components/admin/AdminDBTools';

export default function AdminPanel({ auth }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  
  const [activeTab, setActiveTab] = useState('crm-users');

  if (auth?.role !== 'consulente' && auth?.role !== 'admin') {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <h2 className="text-3xl font-black text-rose-500 mb-4">{t('admin.access_denied')}</h2>
        <button onClick={() => navigate('/')} className="px-6 py-2 bg-slate-800 rounded-lg font-bold">{t('admin.back_home')}</button>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-950 flex flex-col md:flex-row overflow-hidden text-slate-200 font-sans">
      
      {/* SIDEBAR DI NAVIGAZIONE */}
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

      {/* AREA CONTENUTO CENTRALE */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto bg-[#090e17] relative">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
        
        <div className="max-w-6xl mx-auto relative z-10">
          
          {/* 📌 RENDERIZZAZIONE DEI SOTTOMODULI */}
          {['crm-users', 'crm-alliances', 'crm-tickets'].includes(activeTab) && (
             <AdminCRM activeTab={activeTab} t={t} />
          )}

          {['master-panel', 'deploy-center'].includes(activeTab) && (
             <AdminSystem activeTab={activeTab} t={t} />
          )}

          {activeTab === 'db-tools' && (
             <AdminDBTools t={t} />
          )}

        </div>
      </main>
    </div>
  );
}