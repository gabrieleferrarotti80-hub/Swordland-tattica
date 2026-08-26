import React from 'react';
import { useTranslation } from 'react-i18next'; // 🌍 Import i18n

export default function SystemAnnouncement({ announcement, onDismiss }) {
  const { t } = useTranslation();

  if (!announcement) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-slate-900 border border-indigo-500/50 p-6 md:p-8 rounded-3xl shadow-[0_0_40px_rgba(79,70,229,0.3)] max-w-lg w-full relative">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
          <h3 className="text-xl font-black text-white flex items-center gap-2">
            <span>📢</span> {t('home.system_update_title', 'Aggiornamento Sistema')}
          </h3>
          <span className="bg-indigo-600 text-white text-[10px] font-black px-2 py-1 rounded">{announcement.version}</span>
        </div>
        <div className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed max-h-[40vh] overflow-y-auto custom-scrollbar pr-2 mb-6">
          {announcement.text}
        </div>
        <button onClick={onDismiss} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest rounded-xl transition-all shadow-[0_0_15px_rgba(79,70,229,0.4)]">
          {t('home.system_update_close', 'Ricevuto, Chiudi')}
        </button>
      </div>
    </div>
  );
}