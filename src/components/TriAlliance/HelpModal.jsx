import React from 'react';
import { useTranslation } from 'react-i18next';

export default function HelpModal({ isOpen, onClose }) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200 print:hidden">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        
        {/* HEADER */}
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950 shrink-0">
          <div>
            <h2 className="text-xl font-black text-amber-400 uppercase tracking-widest flex items-center gap-2">
              {t('tri_alliance.modals.helpTitle')}
            </h2>
            <p className="text-xs text-slate-400 mt-1">{t('tri_alliance.modals.helpSubtitle')}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-full w-8 h-8 flex items-center justify-center font-bold transition-colors">✕</button>
        </div>

        {/* CONTENUTO SCORREVOLE */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-slate-900/50 space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* SEZIONE 1 */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 shadow-sm">
              <h3 className="text-sm font-black text-emerald-400 mb-2">{t('tri_alliance.modals.helpSec1Title')}</h3>
              <p className="text-xs text-slate-300 mb-2" dangerouslySetInnerHTML={{ __html: t('tri_alliance.modals.helpSec1Desc') }}></p>
              <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside">
                <li dangerouslySetInnerHTML={{ __html: t('tri_alliance.modals.helpSec1Li1') }}></li>
                <li dangerouslySetInnerHTML={{ __html: t('tri_alliance.modals.helpSec1Li2') }}></li>
                <li dangerouslySetInnerHTML={{ __html: t('tri_alliance.modals.helpSec1Li3') }}></li>
              </ul>
            </div>

            {/* SEZIONE 2 */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 shadow-sm">
              <h3 className="text-sm font-black text-cyan-400 mb-2">{t('tri_alliance.modals.helpSec2Title')}</h3>
              <p className="text-xs text-slate-300 mb-2" dangerouslySetInnerHTML={{ __html: t('tri_alliance.modals.helpSec2Desc') }}></p>
              <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside">
                <li dangerouslySetInnerHTML={{ __html: t('tri_alliance.modals.helpSec2Li1') }}></li>
                <li dangerouslySetInnerHTML={{ __html: t('tri_alliance.modals.helpSec2Li2') }}></li>
              </ul>
            </div>

            {/* SEZIONE 3 */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 shadow-sm">
              <h3 className="text-sm font-black text-fuchsia-400 mb-2">{t('tri_alliance.modals.helpSec3Title')}</h3>
              <p className="text-xs text-slate-300 mb-2">{t('tri_alliance.modals.helpSec3Desc')}</p>
              <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside">
                <li dangerouslySetInnerHTML={{ __html: t('tri_alliance.modals.helpSec3Li1') }}></li>
                <li dangerouslySetInnerHTML={{ __html: t('tri_alliance.modals.helpSec3Li2') }}></li>
                <li dangerouslySetInnerHTML={{ __html: t('tri_alliance.modals.helpSec3Li3') }}></li>
              </ul>
            </div>

            {/* SEZIONE 4 */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 shadow-sm">
              <h3 className="text-sm font-black text-indigo-400 mb-2">{t('tri_alliance.modals.helpSec4Title')}</h3>
              <p className="text-xs text-slate-300 mb-2">{t('tri_alliance.modals.helpSec4Desc')}</p>
              <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside">
                <li dangerouslySetInnerHTML={{ __html: t('tri_alliance.modals.helpSec4Li1') }}></li>
                <li dangerouslySetInnerHTML={{ __html: t('tri_alliance.modals.helpSec4Li2') }}></li>
                <li dangerouslySetInnerHTML={{ __html: t('tri_alliance.modals.helpSec4Li3') }}></li>
              </ul>
            </div>

            {/* SEZIONE 5 */}
            <div className="bg-slate-800/50 border border-amber-900/30 rounded-2xl p-4 shadow-sm md:col-span-2">
              <h3 className="text-sm font-black text-amber-500 mb-2">{t('tri_alliance.modals.helpSec5Title')}</h3>
              <p className="text-xs text-slate-300 mb-2">{t('tri_alliance.modals.helpSec5Desc')}</p>
              <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside">
                <li dangerouslySetInnerHTML={{ __html: t('tri_alliance.modals.helpSec5Li1') }}></li>
                <li dangerouslySetInnerHTML={{ __html: t('tri_alliance.modals.helpSec5Li2') }}></li>
              </ul>
            </div>

            {/* SEZIONE 6 */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 shadow-sm md:col-span-2">
              <h3 className="text-sm font-black text-rose-400 mb-2">{t('tri_alliance.modals.helpSec6Title')}</h3>
              <p className="text-xs text-slate-300 mb-2">{t('tri_alliance.modals.helpSec6Desc')}</p>
              <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside">
                <li dangerouslySetInnerHTML={{ __html: t('tri_alliance.modals.helpSec6Li1') }}></li>
                <li dangerouslySetInnerHTML={{ __html: t('tri_alliance.modals.helpSec6Li2') }}></li>
              </ul>
            </div>

          </div>
        </div>

        {/* FOOTER */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 text-center shrink-0">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
            {t('tri_alliance.modals.helpFooter')}
          </p>
        </div>

      </div>
    </div>
  );
}