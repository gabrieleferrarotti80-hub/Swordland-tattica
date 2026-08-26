import React from 'react';

export default function MarchBuilderGuideModal({ isOpen, onClose, t }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden max-h-[90vh] animate-in zoom-in-95">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800 bg-slate-800/50 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-2xl font-black text-white flex items-center gap-2">
              <span className="text-indigo-400">📖</span> {t('march_builder.guide_title', "Manuale d'Uso")}
            </h2>
            <p className="text-[11px] text-slate-400 uppercase tracking-widest mt-1">{t('march_builder.guide_subtitle', "Guida completa al Simulatore di Marce")}</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:text-white hover:bg-rose-600 transition-colors font-bold text-lg">✕</button>
        </div>

        {/* Body */}
        <div className="p-6 md:p-8 flex-1 overflow-y-auto custom-scrollbar bg-[#090e17] flex flex-col gap-8 text-slate-300 text-sm leading-relaxed">
          
          <div className="bg-indigo-950/30 border border-indigo-900/50 p-5 rounded-2xl" dangerouslySetInnerHTML={{ __html: t('march_builder.guide_intro', "Benvenuto nel <strong>Simulatore di Marce</strong>. Questo strumento è progettato per aiutarti a ottimizzare le tue formazioni, calcolare l'esatta distribuzione delle truppe, applicare le dottrine della tua alleanza e salvare uno storico delle tue battaglie per analizzare cosa funziona meglio.") }} />

          <section className="flex flex-col gap-3">
            <h3 className="text-lg font-black text-cyan-400 uppercase tracking-widest border-b border-slate-800 pb-2 flex items-center gap-2">
              <span>⚙️</span> {t('march_builder.guide_sec1_title', "1. Impostazioni (Profilo Base)")}
            </h3>
            <ul className="list-disc list-outside ml-5 flex flex-col gap-2">
              <li dangerouslySetInnerHTML={{ __html: t('march_builder.guide_sec1_li1') }} />
              <li dangerouslySetInnerHTML={{ __html: t('march_builder.guide_sec1_li2') }} />
              <li dangerouslySetInnerHTML={{ __html: t('march_builder.guide_sec1_li3') }} />
              <li dangerouslySetInnerHTML={{ __html: t('march_builder.guide_sec1_li4') }} />
            </ul>
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-lg font-black text-amber-400 uppercase tracking-widest border-b border-slate-800 pb-2 flex items-center gap-2">
              <span>⚔️</span> {t('march_builder.guide_sec2_title', "2. Formazioni (Costruzione Marce)")}
            </h3>
            <ul className="list-disc list-outside ml-5 flex flex-col gap-2">
              <li dangerouslySetInnerHTML={{ __html: t('march_builder.guide_sec2_li1') }} />
              <li dangerouslySetInnerHTML={{ __html: t('march_builder.guide_sec2_li2') }} />
              <li dangerouslySetInnerHTML={{ __html: t('march_builder.guide_sec2_li3') }} />
            </ul>
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-lg font-black text-rose-400 uppercase tracking-widest border-b border-slate-800 pb-2 flex items-center gap-2">
              <span>📊</span> {t('march_builder.guide_sec3_title', "3. Risultati (Inserimento Dati)")}
            </h3>
            <ul className="list-disc list-outside ml-5 flex flex-col gap-2">
              <li dangerouslySetInnerHTML={{ __html: t('march_builder.guide_sec3_li1') }} />
              <li dangerouslySetInnerHTML={{ __html: t('march_builder.guide_sec3_li2') }} />
            </ul>
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-lg font-black text-fuchsia-400 uppercase tracking-widest border-b border-slate-800 pb-2 flex items-center gap-2">
              <span>📈</span> {t('march_builder.guide_sec4_title', "4. Analisi Storico")}
            </h3>
            <ul className="list-disc list-outside ml-5 flex flex-col gap-2">
              <li dangerouslySetInnerHTML={{ __html: t('march_builder.guide_sec4_li1') }} />
              <li dangerouslySetInnerHTML={{ __html: t('march_builder.guide_sec4_li2') }} />
            </ul>
          </section>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-end shrink-0">
          <button onClick={onClose} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg">
            {t('march_builder.guide_btn_start', "Ho Capito, Iniziamo!")}
          </button>
        </div>

      </div>
    </div>
  );
}