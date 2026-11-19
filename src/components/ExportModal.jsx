import React, { useState } from 'react';

export function ExportModal({ isOpen, onClose, marches, activeDeployment, roster }) {
  const [activeTab, setActiveTab] = useState('orders'); // 'orders' | 'teams'

  if (!isOpen) return null;

  // 1. Generatore Testo: ORDINI TATTICI
  const generateOrdersText = () => {
    if (!marches || marches.length === 0) return "Nessun ordine tattico generato al momento.\n\nUsa il Quick Planner per generare una timeline o assegna le marce manualmente cliccando sui giocatori.";
    
    const sortedMarches = [...marches].sort((a, b) => a.startTime - b.startTime);
    let text = "📜 ORDINI TATTICI SWORDLAND 📜\n\n";
    
    const groupedByTime = {};
    sortedMarches.forEach(m => {
      if (!groupedByTime[m.startTime]) groupedByTime[m.startTime] = [];
      groupedByTime[m.startTime].push(m);
    });

    Object.keys(groupedByTime).sort((a,b) => Number(a) - Number(b)).forEach(time => {
      text += `⏳ MINUTO ${time}\n`;
      groupedByTime[time].forEach(m => {
         const leaderName = activeDeployment.find(p => p.id === m.leader)?.name || 'Sconosciuto';
         
         // 🚀 FORMATTAZIONE SQUADRA E PLOTONE
         let subject = leaderName;
         if (m.squadName) {
             let squadLabel = `[${m.squadName}]`;
             if (m.platoon && m.platoon !== 'all' && m.platoon !== 'all_cap') {
                 squadLabel = `[${m.squadName} - Pl. ${m.platoon.replace('_cap', '')}]`;
             }
             
             if (m.members && m.members.length > 1) {
                 subject = `${squadLabel} Leader: ${leaderName}`;
             } else {
                 subject = `${squadLabel} ${leaderName}`;
             }
         } else {
             if (m.members && m.members.length > 1) {
                 subject = `${leaderName} (+ ${m.members.length - 1})`;
             }
         }

         // 🚀 FORMATTAZIONE AZIONE E AUTO-LOOT
         let action = '';
         if (m.marchType === 'rally') action = '⚔️ RALLY su';
         else if (m.marchType === 'raccolta') action = m.isAutoGather ? '🤖 AUTO-LOOT su' : '⛏️ RACCOLTA su';
         else if (m.marchType === 'ritirata') action = '🔙 RITIRATA in';
         else action = '🏃‍♂️ MUOVE su';

         const target = m.targetName || (m.positions && m.positions[m.arrivalTime]?.targetName) || 'Base';
         
         let deployMode = '';
         if (m.marchType !== 'raccolta') {
             deployMode = m.deployMode && m.deployMode.startsWith('teleport') ? '(⚡ TP)' : '(🏃 Marcia)';
         }

         text += `   - ${subject}: ${action} ${target.toUpperCase()} (Arrivo: Min ${m.arrivalTime}) ${deployMode}\n`;
      });
      text += '\n';
    });

    return text;
  };

  // 2. Generatore Testo: COMPOSIZIONE SQUADRE
  const generateTeamsText = () => {
    if (!activeDeployment || activeDeployment.length === 0) return "Nessun giocatore schierato sulla mappa.\n\nVai nel Team Builder per assegnare i giocatori alle squadre e applicare lo schieramento.";

    let text = "🛡️ COMPOSIZIONE SQUADRE 🛡️\n\n";
    
    const squads = {};
    let totalPower = 0;

    activeDeployment.forEach(p => {
      const sq = p.squad && p.squad.trim() !== '' ? p.squad : 'Non Assegnati';
      if (!squads[sq]) squads[sq] = [];
      squads[sq].push(p);
      totalPower += Number(p.power || 0);
    });

    text += `👥 Giocatori Totali: ${activeDeployment.length}\n`;
    text += `⚡ Potenza Totale Alleanza: ${totalPower.toFixed(1)} M\n\n`;
    text += `-----------------------------------\n\n`;

    const sortedSquadNames = Object.keys(squads).sort((a, b) => {
       if (a === 'Non Assegnati') return 1;
       if (b === 'Non Assegnati') return -1;
       return a.localeCompare(b);
    });

    sortedSquadNames.forEach(sq => {
      const squadPlayers = squads[sq].sort((a, b) => Number(b.power || 0) - Number(a.power || 0));
      const squadPower = squadPlayers.reduce((sum, p) => sum + Number(p.power || 0), 0);
      
      text += `=== SQUADRA: ${sq.toUpperCase()} (${squadPower.toFixed(1)} M) ===\n`;
      squadPlayers.forEach((p, index) => {
         const tag = p.tag ? `[${p.tag}] ` : '';
         const role = p.role ? `(${p.role})` : '';
         const isCap = (index === 0 && sq !== 'Non Assegnati') ? '👑 ' : '👤 ';
         text += `${isCap}${tag}${p.name} ${role} - ${p.power} M\n`;
      });
      text += '\n';
    });

    return text;
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      alert("✅ Testo copiato con successo negli appunti!");
    }).catch(err => {
      console.error("Errore durante la copia: ", err);
      alert("❌ Errore durante la copia negli appunti.");
    });
  };

  const displayedText = activeTab === 'orders' ? generateOrdersText() : generateTeamsText();

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-emerald-500/50 rounded-2xl shadow-[0_0_50px_rgba(16,185,129,0.15)] w-full max-w-4xl flex flex-col overflow-hidden">
        
        <div className="flex justify-between items-center p-5 border-b border-slate-800 bg-slate-950 shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
              📤 Esporta Dati
            </h2>
            <div className="flex bg-slate-800 p-1 rounded-xl shadow-inner border border-slate-700/50">
              <button 
                onClick={() => setActiveTab('orders')} 
                className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${activeTab === 'orders' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
              >
                📜 Ordini
              </button>
              <button 
                onClick={() => setActiveTab('teams')} 
                className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${activeTab === 'teams' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
              >
                🛡️ Squadre
              </button>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:bg-rose-900 hover:text-rose-400 transition-colors font-bold shadow-sm">✕</button>
        </div>
        
        <div className="p-6 flex flex-col gap-4 relative bg-slate-900/50">
          <div className="relative">
            <textarea 
              readOnly 
              value={displayedText} 
              className={`w-full h-[60vh] bg-slate-950 border rounded-xl p-5 text-sm font-mono focus:outline-none custom-scrollbar resize-none leading-relaxed transition-colors ${activeTab === 'orders' ? 'border-emerald-900/50 text-emerald-100 focus:border-emerald-500' : 'border-indigo-900/50 text-indigo-100 focus:border-indigo-500'}`}
            />
            <button 
              onClick={() => copyToClipboard(displayedText)}
              className={`absolute top-4 right-4 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white shadow-lg transition-all flex items-center gap-2 ${activeTab === 'orders' ? 'bg-emerald-600 hover:bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'bg-indigo-600 hover:bg-indigo-500 shadow-[0_0_15px_rgba(79,70,229,0.4)]'}`}
            >
              📋 Copia Testo
            </button>
          </div>
        </div>
        
      </div>
    </div>
  );
}