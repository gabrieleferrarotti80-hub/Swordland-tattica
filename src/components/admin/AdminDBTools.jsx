import React, { useState } from 'react';
import { db } from '../../firebase';
import { collection, getDocs, doc, updateDoc, deleteField } from 'firebase/firestore';

export default function AdminDBTools({ t }) {
  // Stati Normalizzazione
  const [isNormalizing, setIsNormalizing] = useState(false);
  const [normLogs, setNormLogs] = useState([]);

  // Stati Scanner R5
  const [anomalies, setAnomalies] = useState([]);
  const [isScanningAnomalies, setIsScanningAnomalies] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);

  // --- 🛠️ NORMALIZZAZIONE DATABASE ---
  const handleNormalizeDatabase = async () => {
    if(!window.confirm("⚠️ ATTENZIONE: Questo sovrascriverà campi in Rosters, Marches, Users e Alliances. Vuoi procedere?")) return;
    setIsNormalizing(true);
    setNormLogs(["🚀 Avvio Normalizzazione Database Estesa..."]);
    const addLog = (msg) => setNormLogs(prev => [...prev, msg]);

    try {
      // 1. NORMALIZZAZIONE ROSTERS
      addLog("Scansione collezione 'rosters'...");
      const rostersSnap = await getDocs(collection(db, "rosters"));
      for (const docSnap of rostersSnap.docs) {
        const data = docSnap.data();
        const docId = docSnap.id;

        let parsedRealm = '';
        let parsedAlliance = '';
        if (docId.includes('_')) {
           const parts = docId.split('_');
           parsedRealm = parts[0];
           parsedAlliance = parts.slice(1).join('_');
        } else {
           parsedAlliance = docId;
        }

        let finalRealm = String(data.realm || data.regno || data.server || parsedRealm || 'Sconosciuto').trim();
        let finalAlliance = String(data.allianceCode || data.code || data.alliance || parsedAlliance || 'Sconosciuta').trim().toUpperCase();

        if (finalAlliance.includes('_')) {
            const parts = finalAlliance.split('_');
            if (!isNaN(parts[0])) {
                finalRealm = parts[0];
                finalAlliance = parts.slice(1).join('_');
            }
        }

        let normalizedMembers = [];
      const extractMember = (m) => {
           if(!m || typeof m !== 'object') return;
           const id = String(m.id || m.playerId || m.uid || '').trim();
           const name = String(m.name || m.playerName || m.nickname || '').trim();
           
           if(id && id !== 'undefined') {
              let memAlliance = String(m.allianceCode || m.alliance || finalAlliance).trim().toUpperCase();
              let memRealm = String(m.realm || m.regno || m.server || finalRealm).trim();
              
              if (memAlliance.includes('_')) {
                  const parts = memAlliance.split('_');
                  if (!isNaN(parts[0])) { memRealm = parts[0]; memAlliance = parts.slice(1).join('_'); }
              }
              
              // 📌 FIX: Usiamo "...m" per mantenere INTATTI potere, livello, coordinate, ecc.
              // Inoltre controlliamo varie casistiche per il ruolo (role, Role, rank)
              normalizedMembers.push({ 
                  ...m, 
                  id, 
                  name, 
                  allianceCode: memAlliance, 
                  realm: memRealm, 
                  role: m.role || m.Role || m.rank || 'R1' 
              });
           }
        };

        if (Array.isArray(data.members)) data.members.forEach(extractMember);
        else if (Array.isArray(data.players)) data.players.forEach(extractMember);

        const uniqueMembers = Array.from(new Map(normalizedMembers.map(item => [item.id, item])).values());

        await updateDoc(doc(db, "rosters", docId), {
           realm: finalRealm, allianceCode: finalAlliance, players: uniqueMembers, members: deleteField() 
        });
      }
      addLog(`✅ Collezione 'rosters' normalizzata.`);

      // 2. NORMALIZZAZIONE PLAYER MARCHES
      addLog("Scansione collezione 'playerMarches'...");
      const marchesSnap = await getDocs(collection(db, "playerMarches"));
      for (const docSnap of marchesSnap.docs) {
        const data = docSnap.data();
        const docId = docSnap.id;

        let parsedRealm = 'Sconosciuto';
        let parsedAlliance = 'Sconosciuta';
        if (docId.includes('_')) {
            const parts = docId.split('_');
            if (parts.length >= 3 && !isNaN(parts[0])) { 
                parsedRealm = parts[0]; parsedAlliance = parts[1];
            } else if (parts.length >= 2) { 
                parsedAlliance = parts[0];
            }
        }

        let finalRealm = String(data.realm || data.regno || data.server || parsedRealm).trim();
        let finalAlliance = String(data.allianceCode || data.alliance || parsedAlliance).trim().toUpperCase();
        const finalId = String(data.playerId || data.id || docId.split('_').pop()).trim();
        const finalName = String(data.playerName || data.name || 'Sconosciuto').trim();

        if (finalAlliance.includes('_')) {
            const parts = finalAlliance.split('_');
            if (!isNaN(parts[0])) { finalRealm = parts[0]; finalAlliance = parts.slice(1).join('_'); }
        }

        await updateDoc(doc(db, "playerMarches", docId), { realm: finalRealm, allianceCode: finalAlliance, playerId: finalId, playerName: finalName });
      }
      addLog(`✅ Collezione 'playerMarches' normalizzata.`);

      // 3. NORMALIZZAZIONE PROFILI UTENTE (Il fix per il tuo errore)
      addLog("Scansione collezione 'users' (Profili)...");
      const usersSnap = await getDocs(collection(db, "users"));
      for (const docSnap of usersSnap.docs) {
        const data = docSnap.data();
        const docId = docSnap.id;
        
        let uRealm = String(data.realm || data.kingdom || '').trim();
        const uAllianceFull = String(data.allianceId || data.allianceCode || '').trim().toUpperCase();

        // Estrai il regno forzatamente dal codice alleanza (es: 1024_DTD -> 1024)
        if (uAllianceFull && uAllianceFull.includes('_')) {
          const parts = uAllianceFull.split('_');
          if (!isNaN(parts[0])) {
             uRealm = parts[0];
          }
        }

        // Se abbiamo trovato un regno, lo salviamo in modo esplicito per risolvere i bug
        if (uRealm) {
          await updateDoc(doc(db, "users", docId), { realm: uRealm });
        }
      }
      addLog(`✅ Collezione 'users' normalizzata.`);

      // 4. NORMALIZZAZIONE ALLEANZE
      addLog("Scansione collezione 'alliances'...");
      const alliancesSnap = await getDocs(collection(db, "alliances"));
      for (const docSnap of alliancesSnap.docs) {
        const data = docSnap.data();
        const docId = docSnap.id; // Solitamente è "1024_DTD"
        
        let aRealm = String(data.realm || data.kingdom || '').trim();

        if (docId.includes('_')) {
          const parts = docId.split('_');
          if (!isNaN(parts[0])) {
             aRealm = parts[0];
          }
        }

        if (aRealm) {
          await updateDoc(doc(db, "alliances", docId), { 
             kingdom: aRealm,
             realm: aRealm 
          });
        }
      }
      addLog(`✅ Collezione 'alliances' normalizzata.`);

      addLog("🎉 NORMALIZZAZIONE ESTESA COMPLETATA!");
    } catch (e) { addLog(`❌ ERRORE CRITICO: ${e.message}`); }
    setIsNormalizing(false);
  };

  // --- 📌 SCANNER ANOMALIE R5 ---
  const scanR5Database = async () => {
    setIsScanningAnomalies(true);
    setHasScanned(false);
    try {
      const snap = await getDocs(collection(db, "rosters"));
      const found = [];
      
      snap.forEach(d => {
        const data = d.data();
        const rosterList = (data.players && data.players.length > 0) ? data.players : (data.members || []);
        
        if (rosterList && Array.isArray(rosterList)) {
          const r5s = rosterList.filter(m => String(m.role).trim().toUpperCase() === 'R5');
          if (r5s.length > 1) {
            found.push({ id: d.id, alliance: data.allianceCode || d.id, realm: data.realm || '?', r5Count: r5s.length, clones: r5s, members: rosterList });
          }
        }
      });
      setAnomalies(found);
      setHasScanned(true);
    } catch (e) { alert("Errore di connessione al DB durante la scansione R5."); }
    setIsScanningAnomalies(false);
  };

  const fixR5Anomaly = async (anomaly) => {
    setIsFixing(true);
    try {
      let r5Kept = false;
      let originalR5Id = null;

      const fixedMembers = anomaly.members.map(m => {
        if (String(m.role).trim().toUpperCase() === 'R5') {
          if (!r5Kept) { r5Kept = true; originalR5Id = m.id; return { ...m, role: 'R5' }; }
          return { ...m, role: 'R4' }; 
        }
        return m;
      });
      
      await updateDoc(doc(db, "rosters", anomaly.id), { players: fixedMembers, members: deleteField() });

      const usersSnap = await getDocs(collection(db, "users"));
      const updates = [];
      usersSnap.forEach(uDoc => {
         const uData = uDoc.data();
         const uAlliance = String(uData.allianceCode || uData.allianceId || '').split('_').pop().toUpperCase();
         const tAlliance = String(anomaly.alliance).split('_').pop().toUpperCase();
         if (uAlliance === tAlliance && String(uData.role).toUpperCase() === 'R5' && uDoc.id !== originalR5Id) {
             updates.push(updateDoc(doc(db, "users", uDoc.id), { role: 'R4' }));
         }
      });
      await Promise.all(updates); 
      
      setAnomalies(prev => prev.filter(a => a.id !== anomaly.id));
      alert(`✅ L'Alleanza [${anomaly.alliance}] è stata purificata.`);
    } catch (e) { alert("❌ Errore durante la riparazione su Firebase."); }
    setIsFixing(false);
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in">
      <div>
        <h2 className="text-2xl font-black text-cyan-400">Strumenti Database</h2>
        <p className="text-slate-400 text-sm mt-1">Normalizza e correggi le incongruenze nei dati di Rosters, Marches, Users e Alliances.</p>
      </div>

      <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl shadow-xl flex flex-col gap-6">
        
        {/* SCANNER R5 */}
        <div className="bg-slate-950 border border-slate-800 p-5 rounded-xl shadow-inner flex flex-col gap-4">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-lg font-black text-rose-500 flex items-center gap-2"><span>🧬</span> Diagnostica Anomalie R5</h2>
              <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest">Cerca alleanze corrotte che possiedono cloni illegali del ruolo R5.</p>
            </div>
            <button onClick={scanR5Database} disabled={isScanningAnomalies || isFixing} className="px-6 py-2.5 bg-rose-700 hover:bg-rose-600 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-[0_0_15px_rgba(225,29,72,0.4)] disabled:opacity-50 flex items-center gap-2">
              {isScanningAnomalies ? '⏳ Scansione...' : '🔍 Avvia Scansione'}
            </button>
          </div>

          <div className="flex flex-col gap-3 min-h-[100px]">
             {isScanningAnomalies && <div className="text-center py-6 text-slate-500 font-bold animate-pulse">Lettura di tutte le alleanze in corso...</div>}
             {!isScanningAnomalies && hasScanned && anomalies.length === 0 && <div className="text-center py-6 text-emerald-500 font-bold bg-emerald-950/20 rounded-xl border border-emerald-900/50">✅ Database pulito. Nessuna anomalia R5 rilevata nel server.</div>}
             {!isScanningAnomalies && anomalies.length > 0 && anomalies.map(anomaly => (
               <div key={anomaly.id} className="bg-slate-900 border border-rose-900/50 p-4 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="flex flex-col">
                     <span className="text-sm font-black text-white">Alleanza: <span className="text-cyan-400">[{anomaly.alliance}]</span> (Regno {anomaly.realm})</span>
                     <span className="text-xs font-bold text-rose-400 mt-1">⚠️ Rilevati {anomaly.r5Count} giocatori con grado R5!</span>
                     <div className="flex gap-2 mt-2 flex-wrap">
                        {anomaly.clones.map((c, idx) => (
                           <span key={idx} className={`text-[10px] px-2 py-0.5 rounded border ${idx === 0 ? 'bg-emerald-900/50 text-emerald-300 border-emerald-700' : 'bg-rose-900/50 text-rose-300 border-rose-700'}`}>
                              {idx === 0 ? '👑 Salvo: ' : '❌ Da declassare: '} {c.name}
                           </span>
                        ))}
                     </div>
                  </div>
                  <button onClick={() => fixR5Anomaly(anomaly)} disabled={isFixing} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase rounded-lg shadow-md transition-colors shrink-0">
                    {isFixing ? 'Riparazione...' : '🛠️ Ripara (Tieni 1° R5)'}
                  </button>
               </div>
             ))}
          </div>
        </div>

        {/* NORMALIZZAZIONE */}
        <div className="bg-rose-950/20 border border-rose-900/50 rounded-xl p-4 flex flex-col gap-3 mt-4">
           <h3 className="text-rose-500 font-black flex items-center gap-2">⚠️ Avvertenza Importante Normalizzazione</h3>
           <p className="text-xs text-slate-400 leading-relaxed">
             Questa operazione sovrascriverà tutti i documenti nelle collezioni <strong>rosters</strong>, <strong>playerMarches</strong>, <strong>users</strong> e <strong>alliances</strong> per assicurarsi che i campi <code className="bg-slate-950 text-amber-400 px-1 rounded">realm/kingdom</code> e <code className="bg-slate-950 text-amber-400 px-1 rounded">allianceCode</code> siano sempre estratti, presenti e formattati in modo rigoroso e standardizzato.
           </p>
           <button onClick={handleNormalizeDatabase} disabled={isNormalizing} className="mt-2 py-3 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-black uppercase tracking-widest rounded-lg transition-colors shadow-lg disabled:opacity-50">
             {isNormalizing ? '⏳ Normalizzazione in corso...' : '🛠️ Avvia Normalizzazione Estesa'}
           </button>
        </div>

        {/* LOGS */}
        <div className="bg-[#050505] border border-slate-800 rounded-xl p-4 h-96 overflow-y-auto font-mono text-[10px] custom-scrollbar">
           {normLogs.length === 0 ? (
             <div className="text-slate-600 italic">In attesa di istruzioni...</div>
           ) : (
             <div className="flex flex-col gap-1">
                {normLogs.map((log, i) => (
                   <div key={i} className={`${log.includes('ERRORE') ? 'text-rose-500' : log.includes('✅') ? 'text-emerald-400' : log.includes('🎉') ? 'text-fuchsia-400 font-bold text-xs' : 'text-slate-400'}`}>
                     {`> ${log}`}
                   </div>
                ))}
             </div>
           )}
        </div>

      </div>
    </div>
  );
}