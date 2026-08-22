import React, { useState } from 'react';
import { useTacticalExport } from '../../hooks/useTacticalExport';
import { generateNativePrint } from '../../utils/tacticalPrinter';

export default function TacticalExportModal(props) {
  const { isOpen, onClose, targetBuilding } = props;
  const [activeTab, setActiveTab] = useState('positions'); 
  const [copiedIndex, setCopiedIndex] = useState(null);

  // Il nostro nuovo e fiammante Hook raccoglie ed elabora tutti i dati in automatico!
  const tacticalData = useTacticalExport(props);
  const {
    positionChunks,
    orderStrategies,
    flightMessages,
    timelineSummaryText
  } = tacticalData;

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(id);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handlePrint = () => {
    // Richiama l'utility di stampa nativa passandogli i dati elaborati + le configurazioni
    generateNativePrint({
      ...tacticalData,
      targetBuilding: props.targetBuilding,
      allianceStructures: props.allianceStructures,
      buildings: props.buildings,
      tacticalMeta: props.tacticalMeta
    });
  };

  if (!isOpen) return null;
  const defaultTargetName = targetBuilding ? targetBuilding.name : 'Punto Tattico';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        
        {/* HEADER MODALE */}
        <div className="flex flex-col p-6 border-b border-slate-800 gap-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-black text-cyan-400 uppercase tracking-widest">Esportazione Dati</h2>
              <p className="text-xs text-slate-400 mt-1">Copia i comandi in chat o genera il Dossier per i Leader</p>
            </div>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-white transition-colors bg-slate-800 hover:bg-slate-700 rounded-full w-8 h-8 flex items-center justify-center font-bold">✕</button>
          </div>

          <button 
            onClick={handlePrint}
            className="w-full bg-gradient-to-r from-amber-600 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-slate-900 font-black uppercase tracking-widest py-3 rounded-xl shadow-[0_0_15px_rgba(217,119,6,0.4)] transition-all flex items-center justify-center gap-2"
          >
            🖨️ Stampa Dossier / Salva PDF Nativo
          </button>

          <div className="flex bg-slate-950 p-1.5 rounded-xl border border-slate-800/80 gap-1 overflow-x-auto custom-scrollbar">
            <button onClick={() => setActiveTab('positions')} className={`shrink-0 px-3 py-2 text-[10px] sm:text-xs font-black uppercase tracking-wider rounded-lg transition-all ${activeTab === 'positions' ? 'bg-cyan-700 text-white shadow-md' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900'}`}>📍 Posizioni</button>
            <button onClick={() => setActiveTab('orders')} className={`shrink-0 px-3 py-2 text-[10px] sm:text-xs font-black uppercase tracking-wider rounded-lg transition-all ${activeTab === 'orders' ? 'bg-rose-700 text-white shadow-md' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900'}`}>⚔️ Ordini</button>
            <button onClick={() => setActiveTab('flights')} className={`shrink-0 px-3 py-2 text-[10px] sm:text-xs font-black uppercase tracking-wider rounded-lg transition-all ${activeTab === 'flights' ? 'bg-fuchsia-700 text-white shadow-md' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900'}`}>✈️ Voli</button>
            <button onClick={() => setActiveTab('timeline')} className={`shrink-0 px-3 py-2 text-[10px] sm:text-xs font-black uppercase tracking-wider rounded-lg transition-all ${activeTab === 'timeline' ? 'bg-amber-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900'}`}>📅 Timeline</button>
          </div>
        </div>

        {/* CONTENUTO TAB */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-slate-950/30">
          
          {/* TAB 1: POSIZIONI */}
          {activeTab === 'positions' && (
            <>
              {positionChunks.length === 0 ? (
                <div className="text-center text-slate-500 py-10">Nessun giocatore posizionato sulla mappa.</div>
              ) : (
                positionChunks.map((chunk, index) => {
                  const blockHeader = `📍 ASSEGNATORE POSIZIONI (Gruppo ${index + 1}/${positionChunks.length})\nObiettivo: ${defaultTargetName}\n\n`;
                  const blockBody = chunk.map(p => `• [${p.tag}] ${p.name} ➔ X: ${p.x} | Y: ${p.y}`).join('\n');
                  const fullText = blockHeader + blockBody;

                  return (
                    <div key={`pos-${index}`} className="bg-slate-800/50 border border-cyan-900/50 rounded-2xl p-4 flex gap-4 items-start shadow-inner">
                      <div className="flex-1 whitespace-pre-wrap text-sm font-mono text-cyan-100/80">
                        <div className="text-xs font-black text-cyan-400 mb-2">Blocco Cumulativo #{index + 1} ({chunk.length} utenti)</div>
                        {blockBody}
                      </div>
                      <button onClick={() => handleCopy(`pos-${index}`, fullText)} className={`shrink-0 px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${copiedIndex === `pos-${index}` ? 'bg-emerald-500 text-white' : 'bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500 hover:text-white border border-cyan-500/30'}`}>
                        {copiedIndex === `pos-${index}` ? '✓ Copiato' : 'Copia Blocco'}
                      </button>
                    </div>
                  );
                })
              )}
            </>
          )}

          {/* TAB 2: ORDINI */}
          {activeTab === 'orders' && (
            <>
              {orderStrategies.length === 0 ? (
                <div className="text-center text-slate-500 py-10">Nessun ordine tattico registrato. Registra le marce nel pannello di destra.</div>
              ) : (
                orderStrategies.map((strategy, index) => (
                  <div key={`ord-${index}`} className="bg-slate-800/50 border border-rose-900/50 rounded-2xl p-4 flex gap-4 items-start shadow-inner">
                    <div className="flex-1 whitespace-pre-wrap text-sm font-mono text-rose-100/80">
                      <div className="text-xs font-black text-rose-400 mb-2">Destinatario: {strategy.name}</div>
                      {strategy.text}
                    </div>
                    <button onClick={() => handleCopy(`ord-${index}`, strategy.text)} className={`shrink-0 px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${copiedIndex === `ord-${index}` ? 'bg-emerald-500 text-white' : 'bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white border border-rose-500/30'}`}>
                      {copiedIndex === `ord-${index}` ? '✓ Copiato' : 'Copia Ordini'}
                    </button>
                  </div>
                ))
              )}
            </>
          )}

          {/* TAB 3: TRASFERIMENTI / VOLI */}
          {activeTab === 'flights' && (
            <>
              {flightMessages.length === 0 ? (
                <div className="text-center text-slate-500 py-10 italic">Tutti i giocatori sono assegnati alla loro Alleanza Originale. Nessun volo richiesto nel Costruttore.</div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {flightMessages.map((msg, index) => (
                    <div key={`flight-${index}`} className="bg-slate-800/50 border border-fuchsia-900/50 rounded-2xl p-4 flex gap-4 items-start shadow-inner hover:border-fuchsia-500/30 transition-colors">
                      <div className="flex-1 whitespace-pre-wrap text-sm font-mono text-fuchsia-100/80">
                        <div className="text-xs font-black text-white mb-2">Voli verso [{msg.destination}] ({msg.count} giocatori)</div>
                        {msg.text}
                      </div>
                      <button onClick={() => handleCopy(`flight-${index}`, msg.text)} className={`shrink-0 px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${copiedIndex === `flight-${index}` ? 'bg-emerald-500 text-white' : 'bg-fuchsia-500/10 text-fuchsia-400 hover:bg-fuchsia-500 hover:text-white border border-fuchsia-500/30'}`}>
                        {copiedIndex === `flight-${index}` ? '✓ Copiato' : 'Copia Lista'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* TAB 4: TIMELINE GENERALE */}
          {activeTab === 'timeline' && (
            <>
              {!timelineSummaryText ? (
                <div className="text-center text-slate-500 py-10 italic">La Timeline è vuota. Inizia a programmare gli ordini dalla mappa per riempirla.</div>
              ) : (
                <div className="bg-slate-800/50 border border-amber-900/50 rounded-2xl p-4 flex gap-4 items-start shadow-inner">
                  <div className="flex-1 whitespace-pre-wrap text-sm font-mono text-amber-100/80">
                    {timelineSummaryText}
                  </div>
                  <button onClick={() => handleCopy('timeline-all', timelineSummaryText)} className={`shrink-0 px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${copiedIndex === 'timeline-all' ? 'bg-emerald-500 text-white' : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500 hover:text-white border border-amber-500/30'}`}>
                    {copiedIndex === 'timeline-all' ? '✓ Copiato' : 'Copia Timeline'}
                  </button>
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  );
}