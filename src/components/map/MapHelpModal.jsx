import React from 'react';
import { useTranslation } from 'react-i18next';

export default function MapHelpModal({ isOpen, onClose, activeView, eventMode }) {
  const { t, i18n } = useTranslation();

  if (!isOpen) return null;

  // Scegliamo la chiave corretta del JSON in base alla visuale
  let helpKey = 'help_global';
  if (activeView === 'alliance') {
    helpKey = 'help_alliance';
  } else if (activeView === 'tactical') {
    helpKey = eventMode === 'castle_battle' ? 'help_castle' : 'help_tactical';
  }

  // Generiamo i colori per i capitoli in modo dinamico
  const colors = [
    'text-emerald-400', 
    'text-amber-400', 
    'text-fuchsia-400', 
    'text-indigo-400', 
    'text-rose-400', 
    'text-cyan-400'
  ];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200 print:hidden">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        
        {/* HEADER */}
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950 shrink-0">
          <div>
            <h2 className="text-xl font-black text-cyan-400 uppercase tracking-widest flex items-center gap-2">
              {t(`map.${helpKey}.title`)}
            </h2>
            <p className="text-xs text-slate-400 mt-1">{t(`map.${helpKey}.subtitle`)}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-full w-8 h-8 flex items-center justify-center font-bold transition-colors">✕</button>
        </div>

        {/* CONTENUTO SCORREVOLE */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-slate-900/50 space-y-4">
          <div className="grid grid-cols-1 gap-4">
            
            {/* CICLO DINAMICO: Controlla da 1 a 6 se esiste il paragrafo nel JSON */}
            {[1, 2, 3, 4, 5, 6].map((num, index) => {
              const titleKey = `map.${helpKey}.sec${num}Title`;
              const descKey = `map.${helpKey}.sec${num}Desc`;
              
              // Se la traduzione restituisce la chiave stessa, significa che non esiste nel JSON (ci fermiamo)
              if (!i18n.exists(titleKey)) return null;

              return (
                <div key={num} className="bg-slate-800/50 border border-slate-700 rounded-2xl p-5 shadow-sm">
                  <h3 className={`text-sm font-black mb-2 ${colors[index % colors.length]}`} dangerouslySetInnerHTML={{ __html: t(titleKey) }}></h3>
                  <p className="text-xs text-slate-300 leading-relaxed" dangerouslySetInnerHTML={{ __html: t(descKey) }}></p>
                </div>
              );
            })}

          </div>
        </div>

        {/* FOOTER */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 text-center shrink-0">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
            Sviluppato per vincere. Buona fortuna Comandante! ⚔️
          </p>
        </div>

      </div>
    </div>
  );
}