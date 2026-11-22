import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { generateHiveCoordBlocks } from '../../utils/hiveChatExport';

export default function HiveChatExportModal({
  isOpen,
  onClose,
  players,
  structures,
  allianceCode
}) {
  const [mode, setMode] = useState('chat');
  const [sortBy, setSortBy] = useState('alpha');
  const [playersPerLine, setPlayersPerLine] = useState(1);
  const [includeRank, setIncludeRank] = useState(false);
  const [includeStructures, setIncludeStructures] = useState(true);
  const [includeMapLink, setIncludeMapLink] = useState(false);

  const [copiedIndices, setCopiedIndices] = useState([]);
  const [lastCopiedIndex, setLastCopiedIndex] = useState(null);

  const mapShareUrl = useMemo(() => {
    if (!allianceCode || typeof window === 'undefined') return '';
    return `${window.location.origin}/map?shared=1&alliance=${encodeURIComponent(allianceCode)}&view=alliance`;
  }, [allianceCode]);

  const result = useMemo(() => {
    if (!isOpen) return { blocks: [], totalPlayers: 0, missingCount: 0 };
    return generateHiveCoordBlocks({
      players,
      structures,
      allianceCode,
      options: {
        mode,
        sortBy,
        playersPerLine,
        includeRank,
        includeStructures,
        includeMapLink,
        mapShareUrl
      }
    });
  }, [isOpen, players, structures, allianceCode, mode, sortBy, playersPerLine, includeRank, includeStructures, includeMapLink, mapShareUrl]);

  // Azzera le spunte "Copiato" se cambiano le impostazioni o i blocchi
  useEffect(() => {
    setCopiedIndices([]);
    setLastCopiedIndex(null);
  }, [mode, sortBy, playersPerLine, includeRank, includeStructures, includeMapLink, isOpen]);

  if (!isOpen) return null;

  const handleCopyBlock = async (block) => {
    try {
      await navigator.clipboard.writeText(block.text);
    } catch (_) {
      window.prompt(`Copia il Blocco ${block.index}/${block.total}:`, block.text);
    }
    setCopiedIndices(prev => (prev.includes(block.index) ? prev : [...prev, block.index]));
    setLastCopiedIndex(block.index);
    setTimeout(() => {
      setLastCopiedIndex(curr => (curr === block.index ? null : curr));
    }, 2000);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[200] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 select-none"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-indigo-500/40 rounded-2xl shadow-2xl max-w-2xl w-full p-5 flex flex-col gap-4 max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Intestazione */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
          <div>
            <h3 className="text-base font-black text-amber-300 tracking-wide">
              💬 Coordinate Giocatori per Chat Kingshot
            </h3>
            <p className="text-[11px] text-slate-400">
              {result.totalPlayers} giocatori posizionati • {result.blocks.length} {result.blocks.length === 1 ? 'blocco pronto' : 'blocchi pronti'} da copiare
              {result.missingCount > 0 && ` (${result.missingCount} senza coordinate esclusi)`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold flex items-center justify-center transition-colors"
          >
            ×
          </button>
        </div>

        {/* Controlli compatti */}
        <div className="flex flex-col gap-3 bg-slate-950/70 border border-slate-800 rounded-xl p-3 shrink-0">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase text-slate-400">Formato invio</span>
              <div className="flex gap-1">
                <button
                  onClick={() => setMode('chat')}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${
                    mode === 'chat'
                      ? 'bg-indigo-600/30 border-indigo-400 text-white'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  Blocchi Chat
                </button>
                <button
                  onClick={() => setMode('full')}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${
                    mode === 'full'
                      ? 'bg-indigo-600/30 border-indigo-400 text-white'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  Lista Unica
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase text-slate-400">Ordina per</span>
              <div className="flex gap-1">
                {[
                  { id: 'alpha', label: 'A–Z' },
                  { id: 'distance', label: 'Distanza' },
                  { id: 'rank', label: 'Grado' }
                ].map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setSortBy(opt.id)}
                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${
                      sortBy === opt.id
                        ? 'bg-indigo-600/30 border-indigo-400 text-white'
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase text-slate-400">Densità riga</span>
              <div className="flex gap-1">
                <button
                  onClick={() => setPlayersPerLine(1)}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${
                    playersPerLine === 1
                      ? 'bg-indigo-600/30 border-indigo-400 text-white'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  1 / riga
                </button>
                <button
                  onClick={() => setPlayersPerLine(2)}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${
                    playersPerLine === 2
                      ? 'bg-indigo-600/30 border-indigo-400 text-white'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  2 / riga
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 text-xs text-slate-300 border-t border-slate-800/80">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={includeStructures} onChange={(e) => setIncludeStructures(e.target.checked)} className="accent-indigo-500" />
              <span>Coordinate HQ & Trappole</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={includeRank} onChange={(e) => setIncludeRank(e.target.checked)} className="accent-indigo-500" />
              <span>Mostra grado [R4/R5]</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={includeMapLink} onChange={(e) => setIncludeMapLink(e.target.checked)} className="accent-indigo-500" />
              <span>Aggiungi link mappa in fondo</span>
            </label>
          </div>
        </div>

        {/* Elenco blocchi pronti da copiare */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 flex flex-col gap-3">
          {result.blocks.length === 0 ? (
            <div className="text-center text-xs text-slate-500 italic py-10">
              Nessun giocatore con coordinate X/Y salvate nell'alveare.
            </div>
          ) : (
            result.blocks.map(block => {
              const isCopied = copiedIndices.includes(block.index);
              const isJustCopied = lastCopiedIndex === block.index;

              return (
                <div
                  key={block.index}
                  className={`rounded-xl border p-3 flex flex-col gap-2 transition-colors ${
                    isCopied
                      ? 'bg-emerald-950/20 border-emerald-500/40'
                      : 'bg-slate-950 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-black uppercase tracking-wider ${isCopied ? 'text-emerald-400' : 'text-indigo-300'}`}>
                        {mode === 'full' ? 'Lista Completa' : `Blocco ${block.index} di ${block.total}`}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {block.charCount}{mode === 'chat' ? '/512' : ''} car. • {block.lineCount}{mode === 'chat' ? '/10' : ''} righe
                      </span>
                    </div>

                    <button
                      onClick={() => handleCopyBlock(block)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                        isJustCopied
                          ? 'bg-emerald-500 text-slate-950 shadow-[0_0_10px_rgba(16,185,129,0.5)]'
                          : isCopied
                            ? 'bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/50 text-emerald-300'
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                      }`}
                    >
                      {isJustCopied ? '✅ Copiato!' : isCopied ? '✓ Copiato (Ricopia)' : `📋 Copia Blocco ${block.index}`}
                    </button>
                  </div>

                  <pre className="bg-[#f7f4e5] border border-[#d8cfb4] text-[#3a3428] rounded-lg p-3 text-xs leading-relaxed font-sans whitespace-pre-wrap select-all">
                    {block.text}
                  </pre>
                </div>
              );
            })
          )}
        </div>

        {/* Footer di riepilogo avanzamento */}
        {mode === 'chat' && result.blocks.length > 1 && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[11px] text-slate-400 shrink-0">
            <span>
              Inviati: <strong className="text-emerald-400">{copiedIndices.length}/{result.blocks.length}</strong> blocchi
            </span>
            {copiedIndices.length > 0 && (
              <button
                onClick={() => { setCopiedIndices([]); setLastCopiedIndex(null); }}
                className="text-slate-400 hover:text-slate-200 underline text-[11px]"
              >
                Azzera spunte
              </button>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}