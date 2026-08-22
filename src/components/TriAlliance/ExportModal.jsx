import React, { useState, useEffect } from 'react';
import { toJpeg } from 'html-to-image';
import { BUILDING_TYPES, TEAM_HEX_COLORS, isNodeLocked, generateLogicalMovementsText } from '../../utils/triAllianceConfig'; 
import { useTranslation } from 'react-i18next';

export default function ExportModal({ isOpen, onClose, phasesData, activeRoster, nodes, allianceDraft, homeBaseId, scoreAnalysis }) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('timeline'); 
  const [copiedIndex, setCopiedIndex] = useState(null);
  
  const [mapImages, setMapImages] = useState({ 1: null, 2: null, 3: null });
  const [isCapturing, setIsCapturing] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setIsCapturing(true);
      setTimeout(async () => {
        try {
          const images = {};
          for (const phase of [1, 2, 3]) {
            const el = document.getElementById(`export-map-phase-${phase}`);
            if (el) {
              images[phase] = await toJpeg(el, { quality: 0.85, backgroundColor: '#020617', pixelRatio: 1.5 });
            }
          }
          setMapImages(images);
        } catch(e) {
          console.error("Errore scatto mappe:", e);
        } finally {
          setIsCapturing(false);
        }
      }, 500);
    } else {
      setMapImages({ 1: null, 2: null, 3: null });
      setIsCapturing(true);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(id);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handlePrint = () => window.print();
  
  const timelineTextByPlayer = activeRoster.map(player => {
    let text = `[👤 ${player.name}]\n`;
    [1, 2, 3].forEach(phase => {
      const assignments = phasesData[phase]?.assignments || {};
      let assignedNode = null;
      Object.entries(assignments).forEach(([nodeId, players]) => {
        if (players.includes(player.id)) assignedNode = nodeId;
      });

      if (assignedNode) {
        const nodeObj = nodes.find(n => n.id === assignedNode);
        const bName = nodeObj && BUILDING_TYPES[nodeObj.type] ? BUILDING_TYPES[nodeObj.type].name : assignedNode;
        text += `  ${t('tri_alliance.sidebar.phaseLabel')} ${phase}: ${t('tri_alliance.modals.defend')} [${assignedNode}] ${bName}\n`;
      } else {
        text += `  ${t('tri_alliance.sidebar.phaseLabel')} ${phase}: ${t('tri_alliance.modals.noGarrison')}\n`;
      }
    });
    return text;
  }).join('\n\n');

  const positionsBlocks = [1, 2, 3].map(phase => {
    const assignments = phasesData[phase]?.assignments || {};
    const nodesWithPlayers = Object.entries(assignments).filter(([_, players]) => players.length > 0);
    if (nodesWithPlayers.length === 0) return { phase, text: t('tri_alliance.map.noTroops') };

    let text = '';
    nodesWithPlayers.forEach(([nodeId, players]) => {
      const nodeObj = nodes.find(n => n.id === nodeId);
      const bName = nodeObj && BUILDING_TYPES[nodeObj.type] ? BUILDING_TYPES[nodeObj.type].name : nodeId;
      const playerNames = players.map(pId => activeRoster.find(r => r.id === pId)?.name || pId).join(", ");
      text += `• [${nodeId}] ${bName}: ${playerNames}\n`;
    });
    return { phase, text };
  });

  const movementsBlocks = [1, 2, 3].map(phase => {
    const paths = phasesData[phase]?.paths || [];
    const logicalMovements = generateLogicalMovementsText(paths, nodes);
    if (!logicalMovements) return { phase, text: t('tri_alliance.map.noTroops') };
    return { phase, text: logicalMovements };
  });

  return (
    <>
      <div style={{ position: 'absolute', top: '-10000px', left: '-10000px', pointerEvents: 'none' }}>
        {[1, 2, 3].map(phase => (
          <div key={phase} id={`export-map-phase-${phase}`} className="relative inline-flex bg-[#111] rounded-xl" style={{ width: '1200px' }}>
            <img src="/tri-map.jpg" alt="Map" className="w-full h-auto block rounded-xl" />
            
            <svg className="absolute inset-0 w-full h-full z-15">
              <defs>
                <marker id={`arrowhead-export-${phase}`} markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#0ea5e9" /></marker>
              </defs>
              {(phasesData[phase]?.paths || []).map((path, index) => {
                const startNode = nodes.find(n => n.id === path.start);
                const endNode = nodes.find(n => n.id === path.end);
                if (!startNode || !endNode) return null;
                const hasContinuation = phasesData[phase].paths.some(p => p.start === path.end);
                return (
                  <g key={`export-tp-${index}`}>
                    <line x1={`${startNode.x}%`} y1={`${startNode.y}%`} x2={`${endNode.x}%`} y2={`${endNode.y}%`} stroke="#0ea5e9" strokeWidth="4" strokeDasharray="8,8" markerEnd={hasContinuation ? undefined : `url(#arrowhead-export-${phase})`} />
                  </g>
                );
              })}
            </svg>

            <div className="absolute inset-0">
              {nodes.map(node => {
                if (node.type === 'WAYPOINT') return null;
                const isLocked = isNodeLocked(node.type, phase);
                const isHomeBase = homeBaseId === node.id; 
                const assignedPlayers = phasesData[phase]?.assignments?.[node.id] || [];
                const troopCount = assignedPlayers.length;

                let conicGradient = '';
                if (troopCount > 0) {
                  const teamCounts = {};
                  let unassignedCount = 0;
                  assignedPlayers.forEach(pId => {
                    const tId = allianceDraft?.playerMeta?.[pId]?.teamId;
                    if (tId) {
                      const team = allianceDraft.teams?.find(t => t.id === tId);
                      if (team) { teamCounts[team.color] = (teamCounts[team.color] || 0) + 1; } 
                      else { unassignedCount++; }
                    } else { unassignedCount++; }
                  });
                  let gradientStops = [];
                  let currentPercentage = 0;
                  Object.entries(teamCounts).forEach(([colorKey, count]) => {
                    const percentage = (count / troopCount) * 100;
                    const hex = TEAM_HEX_COLORS[colorKey] || '#ffffff';
                    gradientStops.push(`${hex} ${currentPercentage}% ${currentPercentage + percentage}%`);
                    currentPercentage += percentage;
                  });
                  if (unassignedCount > 0) {
                    const percentage = (unassignedCount / troopCount) * 100;
                    gradientStops.push(`${TEAM_HEX_COLORS.unassigned} ${currentPercentage}% ${currentPercentage + percentage}%`);
                  }
                  conicGradient = `conic-gradient(${gradientStops.join(', ')})`;
                }

                return (
                  <div key={node.id} className="absolute transform -translate-x-1/2 -translate-y-1/2 rounded-full flex items-center justify-center w-8 h-8 bg-slate-800/90 border-2 border-slate-500 text-[10px] font-black text-slate-200 z-30" style={{ left: `${node.x}%`, top: `${node.y}%` }}>
                    {node.id}
                    {isHomeBase && <div className="absolute -top-7 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-amber-600 to-yellow-500 text-slate-900 text-[10px] font-black px-2 py-0.5 rounded-full z-50 border border-amber-300">🏠 BASE</div>}
                    {troopCount > 0 && (
                      <>
                        <div className={`absolute inset-[-6px] rounded-full z-0 opacity-100 ${isLocked ? 'grayscale opacity-50' : ''}`} style={{ background: conicGradient, WebkitMaskImage: 'radial-gradient(transparent 55%, black 56%)', maskImage: 'radial-gradient(transparent 55%, black 56%)' }}></div>
                        <div className="absolute inset-0 z-10 flex items-center justify-center"><span className={`text-[12px] font-black drop-shadow-md ${isLocked ? 'text-slate-400' : 'text-white'}`}>{troopCount}</span></div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200 print:hidden">
        <div className="bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
          
          <div className="flex flex-col p-6 border-b border-slate-800 gap-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-black text-cyan-400 uppercase tracking-widest">{t('tri_alliance.modals.exportTitle')}</h2>
                <p className="text-xs text-slate-400 mt-1">{t('tri_alliance.modals.exportDesc')}</p>
              </div>
              <button onClick={onClose} className="p-2 text-slate-400 hover:text-white transition-colors bg-slate-800 hover:bg-slate-700 rounded-full w-8 h-8 flex items-center justify-center font-bold">✕</button>
            </div>

            <button 
              onClick={handlePrint}
              disabled={isCapturing}
              className={`w-full font-black uppercase tracking-widest py-3 rounded-xl transition-all flex items-center justify-center gap-2 ${!isCapturing ? 'bg-gradient-to-r from-amber-600 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-slate-900 shadow-[0_0_15px_rgba(217,119,6,0.4)]' : 'bg-slate-800 text-slate-500 cursor-wait'}`}
            >
              {!isCapturing ? t('tri_alliance.modals.printBtn') : t('tri_alliance.modals.printingBtn')}
            </button>

            <div className="flex bg-slate-950 p-1.5 rounded-xl border border-slate-800/80 gap-1 overflow-x-auto custom-scrollbar">
              <button onClick={() => setActiveTab('timeline')} className={`shrink-0 px-3 py-2 text-[10px] sm:text-xs font-black uppercase tracking-wider rounded-lg transition-all ${activeTab === 'timeline' ? 'bg-amber-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900'}`}>{t('tri_alliance.modals.tabOrders')}</button>
              <button onClick={() => setActiveTab('positions')} className={`shrink-0 px-3 py-2 text-[10px] sm:text-xs font-black uppercase tracking-wider rounded-lg transition-all ${activeTab === 'positions' ? 'bg-cyan-700 text-white shadow-md' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900'}`}>{t('tri_alliance.modals.tabPositions')}</button>
              <button onClick={() => setActiveTab('movements')} className={`shrink-0 px-3 py-2 text-[10px] sm:text-xs font-black uppercase tracking-wider rounded-lg transition-all ${activeTab === 'movements' ? 'bg-fuchsia-700 text-white shadow-md' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900'}`}>{t('tri_alliance.modals.tabMovements')}</button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-slate-950/30">
            
            {activeTab === 'timeline' && (
              <div className="bg-slate-800/50 border border-amber-900/50 rounded-2xl p-4 flex flex-col sm:flex-row gap-4 items-start shadow-inner">
                <div className="flex-1 whitespace-pre-wrap text-sm font-mono text-amber-100/80 w-full">
                  <div className="text-xs font-black text-amber-400 mb-4 uppercase tracking-widest border-b border-amber-900/50 pb-2">{t('tri_alliance.modals.individualTimeline')}</div>
                  {timelineTextByPlayer}
                </div>
                <button onClick={() => handleCopy('timeline', timelineTextByPlayer)} className={`shrink-0 w-full sm:w-auto px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${copiedIndex === 'timeline' ? 'bg-emerald-500 text-white' : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500 hover:text-white border border-amber-500/30'}`}>
                  {copiedIndex === 'timeline' ? t('tri_alliance.modals.copied') : t('tri_alliance.modals.copyOrders')}
                </button>
              </div>
            )}

            {positionsBlocks.map((block) => activeTab === 'positions' && (
              <div key={`pos-${block.phase}`} className="bg-slate-800/50 border border-cyan-900/50 rounded-2xl p-4 flex flex-col sm:flex-row gap-4 items-start shadow-inner">
                <div className="flex-1 whitespace-pre-wrap text-sm font-mono text-cyan-100/80 w-full">
                  <div className="text-xs font-black text-cyan-400 mb-2">{t('tri_alliance.modals.deploymentPhase')} {block.phase}</div>
                  {block.text}
                </div>
                <button onClick={() => handleCopy(`pos-${block.phase}`, block.text)} className={`shrink-0 w-full sm:w-auto px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${copiedIndex === `pos-${block.phase}` ? 'bg-emerald-500 text-white' : 'bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500 hover:text-white border border-cyan-500/30'}`}>
                  {copiedIndex === `pos-${block.phase}` ? t('tri_alliance.modals.copied') : t('tri_alliance.modals.copyPhase')}
                </button>
              </div>
            ))}

            {movementsBlocks.map((block) => activeTab === 'movements' && (
              <div key={`mov-${block.phase}`} className="bg-slate-800/50 border border-fuchsia-900/50 rounded-2xl p-4 flex flex-col sm:flex-row gap-4 items-start shadow-inner hover:border-fuchsia-500/30 transition-colors">
                <div className="flex-1 whitespace-pre-wrap text-sm font-mono text-fuchsia-100/80 w-full">
                  <div className="text-xs font-black text-fuchsia-400 mb-2">{t('tri_alliance.modals.movementsPhase')} {block.phase}</div>
                  {block.text}
                </div>
                <button onClick={() => handleCopy(`mov-${block.phase}`, block.text)} className={`shrink-0 w-full sm:w-auto px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${copiedIndex === `mov-${block.phase}` ? 'bg-emerald-500 text-white' : 'bg-fuchsia-500/10 text-fuchsia-400 hover:bg-fuchsia-500 hover:text-white border border-fuchsia-500/30'}`}>
                  {copiedIndex === `mov-${block.phase}` ? t('tri_alliance.modals.copied') : t('tri_alliance.modals.copyOrders')}
                </button>
              </div>
            ))}

          </div>
        </div>
      </div>

      <div className="hidden print:block absolute inset-0 bg-white text-black z-[9999] p-8 min-h-screen">
         <div className="flex justify-between items-end border-b-2 border-gray-300 pb-4 mb-6">
           <div>
             <h1 className="text-4xl font-black uppercase text-gray-900">{t('tri_alliance.modals.pdfTitle')}</h1>
             <p className="text-sm font-bold text-gray-500 mt-1">{t('tri_alliance.modals.pdfSubtitle')}</p>
           </div>
           
           <div className="text-right">
             <div className="text-sm font-bold text-gray-400 mb-2">{t('tri_alliance.modals.pdfGeneratedBy')}</div>
             {scoreAnalysis && (
               <div className="text-xs font-bold text-gray-600 bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200">
                 {t('tri_alliance.modals.pdfFinalProj')} <span className="text-amber-600 text-base">{scoreAnalysis.totalExpected.toLocaleString()}</span> / {scoreAnalysis.totalAvailable.toLocaleString()} pt
               </div>
             )}
           </div>
         </div>
         
         {[1, 2, 3].map(phase => {
           const phaseScore = scoreAnalysis?.phases?.find(p => p.phase === phase);
           return (
             <div key={`print-phase-${phase}`} style={{ pageBreakInside: 'avoid', marginBottom: '40px' }}>
               <div className="flex justify-between items-end border-b border-gray-200 pb-2 mb-4">
                 <h2 className="text-2xl font-black text-slate-800">
                   {t('tri_alliance.sidebar.phaseLabel').toUpperCase()} {phase} <span className="text-gray-400 font-bold text-lg">({(phase-1)*20}m - {phase*20}m)</span>
                 </h2>
                 
                 {phaseScore && (
                   <div className="text-sm font-bold text-gray-600">
                     {t('tri_alliance.modals.pdfPhasePoints')} <span className="text-emerald-600">{phaseScore.expected.toLocaleString()}</span> <span className="text-gray-400">/ {phaseScore.available.toLocaleString()}</span>
                   </div>
                 )}
               </div>
               
               {mapImages[phase] && (
                 <div className="text-center">
                   <div className="inline-block p-2 bg-gray-100 rounded-xl border border-gray-300 shadow-sm">
                     <img src={mapImages[phase]} alt={`Mappa Fase ${phase}`} className="max-w-full max-h-[60vh] object-contain rounded-lg" />
                   </div>
                 </div>
               )}
             </div>
           );
         })}
         
         <div style={{ pageBreakBefore: 'always', paddingTop: '20px' }}>
           <h2 className="text-2xl font-black text-slate-800 border-b border-gray-200 pb-2 mb-6 uppercase tracking-widest">
             {t('tri_alliance.modals.tabOrders')}
           </h2>
           <div className="grid grid-cols-2 gap-x-8 gap-y-6 text-xs font-mono whitespace-pre-wrap leading-relaxed text-gray-800">
             {timelineTextByPlayer}
           </div>
         </div>
      </div>
    </>
  );
}