import React from 'react';
import { useTranslation } from 'react-i18next';

export const InstructionsModal = ({ onClose }) => {
  const { t } = useTranslation();

  return (
    <div className="absolute inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border-2 border-cyan-700/50 rounded-2xl shadow-[0_0_40px_rgba(34,211,238,0.2)] w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex justify-between items-center bg-slate-950 p-5 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <span className="text-3xl drop-shadow-md">🗺️</span>
            <h2 className="text-xl font-black text-cyan-400 uppercase tracking-widest">{t('swordland_manual.title')}</h2>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-rose-400 transition-colors w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-800 font-black text-xl"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar text-slate-300 text-sm leading-relaxed">
          
          {/* Sezione 1 */}
          <section className="bg-slate-800/50 p-5 rounded-xl border border-slate-700">
            <h3 className="text-cyan-300 font-bold text-lg mb-3 flex items-center gap-2" dangerouslySetInnerHTML={{ __html: t('swordland_manual.sec1_title') }}></h3>
            <p className="mb-2" dangerouslySetInnerHTML={{ __html: t('swordland_manual.sec1_desc') }}></p>
            <ul className="list-disc pl-5 space-y-1 text-slate-400">
              <li dangerouslySetInnerHTML={{ __html: t('swordland_manual.sec1_li1') }}></li>
              <li dangerouslySetInnerHTML={{ __html: t('swordland_manual.sec1_li2') }}></li>
            </ul>
          </section>

          {/* Sezione 2 */}
          <section className="bg-slate-800/50 p-5 rounded-xl border border-slate-700">
            <h3 className="text-cyan-300 font-bold text-lg mb-3 flex items-center gap-2" dangerouslySetInnerHTML={{ __html: t('swordland_manual.sec2_title') }}></h3>
            <p className="mb-2" dangerouslySetInnerHTML={{ __html: t('swordland_manual.sec2_desc') }}></p>
            <ul className="list-disc pl-5 space-y-2 text-slate-400">
              <li dangerouslySetInnerHTML={{ __html: t('swordland_manual.sec2_li1') }}></li>
              <li dangerouslySetInnerHTML={{ __html: t('swordland_manual.sec2_li2') }}></li>
              <li dangerouslySetInnerHTML={{ __html: t('swordland_manual.sec2_li3') }}></li>
              <li dangerouslySetInnerHTML={{ __html: t('swordland_manual.sec2_li4') }}></li>
            </ul>
            <div className="mt-3 bg-amber-900/30 border border-amber-700/50 p-3 rounded-lg text-amber-200 text-xs" dangerouslySetInnerHTML={{ __html: t('swordland_manual.sec2_warning') }}></div>
          </section>

          {/* Sezione 3 */}
          <section className="bg-slate-800/50 p-5 rounded-xl border border-slate-700">
            <h3 className="text-cyan-300 font-bold text-lg mb-3 flex items-center gap-2" dangerouslySetInnerHTML={{ __html: t('swordland_manual.sec3_title') }}></h3>
            <ul className="list-disc pl-5 space-y-2 text-slate-400">
              <li dangerouslySetInnerHTML={{ __html: t('swordland_manual.sec3_li1') }}></li>
              <li dangerouslySetInnerHTML={{ __html: t('swordland_manual.sec3_li2') }}></li>
              <li dangerouslySetInnerHTML={{ __html: t('swordland_manual.sec3_li3') }}></li>
              <li dangerouslySetInnerHTML={{ __html: t('swordland_manual.sec3_li4') }}></li>
            </ul>
          </section>

          {/* Sezione 4 */}
          <section className="bg-slate-800/50 p-5 rounded-xl border border-slate-700">
            <h3 className="text-cyan-300 font-bold text-lg mb-3 flex items-center gap-2" dangerouslySetInnerHTML={{ __html: t('swordland_manual.sec4_title') }}></h3>
            <ul className="list-disc pl-5 space-y-2 text-slate-400">
              <li dangerouslySetInnerHTML={{ __html: t('swordland_manual.sec4_li1') }}></li>
              <li dangerouslySetInnerHTML={{ __html: t('swordland_manual.sec4_li2') }}></li>
            </ul>
          </section>

        </div>

        {/* Footer */}
        <div className="bg-slate-950 p-4 border-t border-slate-700 text-center">
          <button 
            onClick={onClose}
            className="bg-cyan-600 hover:bg-cyan-500 text-white font-black uppercase tracking-widest py-3 px-12 rounded-xl transition-all shadow-[0_0_15px_rgba(34,211,238,0.3)]"
          >
            {t('swordland_manual.btn_start')}
          </button>
        </div>

      </div>
    </div>
  );
};