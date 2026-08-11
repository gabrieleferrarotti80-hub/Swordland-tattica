import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';

export default function AdminPanel({ auth }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('roster-copy');
  
  // --- Stati Copia-Roster ---
  const [sourceCode, setSourceCode] = useState('');
  const [destCode, setDestCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [allianceList, setAllianceList] = useState([]);

  // --- Stati Deploy Center ---
  const [vercelWebhook, setVercelWebhook] = useState('');
  const [releaseVersion, setReleaseVersion] = useState('');
  const [releaseNotes, setReleaseNotes] = useState('');
  const [isAnnounceActive, setIsAnnounceActive] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);

  // Caricamento Dati Iniziali
  useEffect(() => {
    const fetchAdminData = async () => {
      try {
        // Carica Alleanze
        const snap1 = await getDocs(collection(db, "rosters"));
        const snap2 = await getDocs(collection(db, "allianceRoster"));
        const set = new Set();
        snap1.docs.forEach(d => set.add(d.id));
        snap2.docs.forEach(d => set.add(d.id));
        set.delete('ADMIN');
        setAllianceList(Array.from(set).sort());

        // Carica Settings Webhook
        const hookSnap = await getDoc(doc(db, "settings", "deploy"));
        if (hookSnap.exists()) setVercelWebhook(hookSnap.data().webhook || '');

        // Carica Annuncio Attivo
        const annSnap = await getDoc(doc(db, "system", "announcement"));
        if (annSnap.exists()) {
          const data = annSnap.data();
          setReleaseVersion(data.version || '');
          setReleaseNotes(data.text || '');
          setIsAnnounceActive(data.active || false);
        }
      } catch (error) {
        console.error("Errore caricamento dati admin:", error);
      }
    };

    if (auth?.role === 'consulente' || auth?.role === 'admin') {
      fetchAdminData();
    }
  }, [auth]);

  if (auth?.role !== 'consulente' && auth?.role !== 'admin') {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <h2 className="text-3xl font-black text-rose-500 mb-4">⛔ ACCESSO NEGATO</h2>
        <p className="text-slate-400 mb-6">Area riservata agli Amministratori di Sistema.</p>
        <button onClick={() => navigate('/')} className="px-6 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg font-bold">Torna alla Home</button>
      </div>
    );
  }

  const addLog = (msg, type = 'info') => setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), msg, type }]);

  const handleCopyRoster = async () => {
    const src = sourceCode.toUpperCase().trim();
    const dst = destCode.toUpperCase().trim();

    if (!src || !dst) return alert("Inserisci entrambi i codici (Es. 1007_DTD)");
    if (src === dst) return alert("Sorgente e Destinazione non possono coincidere.");

    const confirmAction = window.confirm(`⚠️ ATTENZIONE ⚠️\nStai per sovrascrivere il Roster E LE PASSWORD dell'alleanza [${dst}] con i dati di [${src}].\n\nVuoi procedere?`);
    if (!confirmAction) return;

    setIsLoading(true);
    setLogs([]);
    addLog(`Avvio procedura di clonazione: ${src} ➡️ ${dst}`);

    try {
      let sourceSnap = await getDoc(doc(db, "rosters", src));
      if (!sourceSnap.exists()) {
        addLog(`Non trovato in 'rosters', cerco in 'allianceRoster'...`, 'warning');
        sourceSnap = await getDoc(doc(db, "allianceRoster", src));
      }

      if (!sourceSnap.exists()) {
        addLog(`❌ ERRORE: Roster sorgente [${src}] non trovato.`, 'error');
        setIsLoading(false);
        return;
      }

      const rosterData = sourceSnap.data();
      addLog(`Roster sorgente trovato. Giocatori estratti: ${rosterData.players?.length || 0}`, 'success');

      let securitySnap = await getDoc(doc(db, "allianceSecurity", src));
      let securityData = {};
      if (securitySnap.exists()) {
        securityData = securitySnap.data();
        addLog(`Cassaforte password trovata e sbloccata per [${src}].`, 'success');
      } else {
        addLog(`⚠️ Nessuna password trovata per [${src}]. I giocatori dovranno crearne di nuove.`, 'warning');
      }

      addLog(`Scrittura in corso su [${dst}] (Lista Giocatori)...`);
      await setDoc(doc(db, "rosters", dst), { players: rosterData.players || [], updatedByAdmin: new Date().toISOString(), copiedFrom: src }, { merge: true });

      if (Object.keys(securityData).length > 0) {
        addLog(`Scrittura in corso su [${dst}] (Chiavi di Sicurezza)...`);
        await setDoc(doc(db, "allianceSecurity", dst), securityData, { merge: true });
      }

      addLog(`✅ CLONAZIONE COMPLETATA AL 100%!`, 'success');
      setSourceCode(''); setDestCode('');
      if (!allianceList.includes(dst)) setAllianceList(prev => [...prev, dst].sort());

    } catch (error) {
      addLog(`❌ ERRORE CRITICO: ${error.message}`, 'error');
    }
    setIsLoading(false);
  };

  // --- FUNZIONI DEPLOY CENTER ---
  const handleSaveWebhook = async () => {
    try {
      await setDoc(doc(db, "settings", "deploy"), { webhook: vercelWebhook }, { merge: true });
      alert("✅ Webhook di Vercel salvato con successo.");
    } catch (error) { alert("❌ Errore salvataggio Webhook."); }
  };

  const handleTriggerDeploy = async () => {
    if (!vercelWebhook) return alert("Inserisci e salva prima il Webhook di Vercel.");
    const confirm = window.confirm("🚀 Stai per lanciare la compilazione su Vercel. Il sito si aggiornerà tra circa 1-2 minuti. Procedo?");
    if (!confirm) return;

    setIsDeploying(true);
    try {
      // Vercel webhook è un POST
      await fetch(vercelWebhook, { method: 'POST', mode: 'no-cors' });
      alert("✅ Segnale di Deploy inviato! Vercel sta compilando la nuova versione.");
    } catch (error) {
      alert("⚠️ Segnale inviato, ma controlla la dashboard di Vercel per sicurezza.");
    }
    setIsDeploying(false);
  };

  const handlePublishAnnouncement = async (status) => {
    if (status && (!releaseVersion || !releaseNotes)) return alert("Inserisci Versione e Testo prima di pubblicare.");
    
    try {
      await setDoc(doc(db, "system", "announcement"), {
        version: releaseVersion,
        text: releaseNotes,
        active: status,
        date: new Date().toISOString()
      });
      setIsAnnounceActive(status);
      alert(status ? "✅ Annuncio PUBBLICATO ai giocatori!" : "🔇 Annuncio RITIRATO.");
    } catch (error) {
      alert("❌ Errore durante la modifica dell'annuncio.");
    }
  };

  return (
    <div className="h-screen bg-slate-950 flex flex-col md:flex-row overflow-hidden text-slate-200">
      
      <aside className="w-full md:w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-xl font-black text-rose-500 flex items-center gap-2"><span>👑</span> GOD ROOM</h1>
          <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest">Pannello Strumenti DB</p>
        </div>
        
        <div className="flex-1 p-4 flex flex-col gap-2">
          <button onClick={() => setActiveTab('roster-copy')} className={`px-4 py-3 rounded-xl text-sm font-bold text-left transition-colors flex items-center gap-3 ${activeTab === 'roster-copy' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' : 'text-slate-400 hover:bg-slate-800'}`}>
            <span>🔄</span> Clonazione Roster
          </button>
          <button onClick={() => setActiveTab('deploy-center')} className={`px-4 py-3 rounded-xl text-sm font-bold text-left transition-colors flex items-center gap-3 ${activeTab === 'deploy-center' ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' : 'text-slate-400 hover:bg-slate-800'}`}>
            <span>🚀</span> Centro Deploy
          </button>
          <button disabled className="px-4 py-3 rounded-xl text-sm font-bold text-left text-slate-600 flex items-center gap-3 opacity-50">
            <span>🧹</span> Pulizia Database (WIP)
          </button>
        </div>

        <div className="p-4 border-t border-slate-800">
          <button onClick={() => navigate('/')} className="w-full px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-colors">⬅ Torna all'HUB</button>
        </div>
      </aside>

      <main className="flex-1 p-6 md:p-10 overflow-y-auto bg-[#090e17] relative">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
        
        <div className="max-w-3xl mx-auto relative z-10">
          
          {activeTab === 'roster-copy' && (
            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4">
              <div>
                <h2 className="text-2xl font-black text-white">Clonazione Integrale tra Alleanze</h2>
                <p className="text-slate-400 text-sm mt-1">Copia l'intera lista giocatori <strong className="text-rose-400">e le loro password di sicurezza</strong> da un'alleanza esistente a un'altra.</p>
              </div>

              <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl shadow-xl flex flex-col gap-6">
                <div className="flex flex-col md:flex-row items-center gap-4">
                  <div className="w-full flex flex-col gap-2">
                    <label className="text-xs font-bold text-cyan-400 uppercase tracking-widest">Da SORGENTE</label>
                    <select value={sourceCode} onChange={e => setSourceCode(e.target.value)} className="bg-slate-950 border border-slate-600 rounded-lg px-4 py-3 text-white font-mono uppercase cursor-pointer outline-none focus:border-cyan-500">
                      <option value="">-- Seleziona --</option>
                      {allianceList.map(tag => <option key={`src-${tag}`} value={tag}>{tag}</option>)}
                    </select>
                  </div>
                  <span className="text-2xl text-slate-600 rotate-90 md:rotate-0 mt-4 md:mt-0">➡️</span>
                  <div className="w-full flex flex-col gap-2">
                    <label className="text-xs font-bold text-amber-400 uppercase tracking-widest">A DESTINAZIONE</label>
                    <input type="text" list="alliance-suggestions" value={destCode} onChange={e => setDestCode(e.target.value)} placeholder="Scegli o digita..." className="bg-slate-950 border border-slate-600 rounded-lg px-4 py-3 text-white font-mono uppercase outline-none focus:border-amber-500" />
                    <datalist id="alliance-suggestions">{allianceList.map(tag => <option key={`dst-${tag}`} value={tag} />)}</datalist>
                  </div>
                </div>

                <button onClick={handleCopyRoster} disabled={isLoading} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(79,70,229,0.4)] disabled:opacity-50">
                  {isLoading ? 'Elaborazione in corso...' : '⚡ Esegui Clonazione Integrale'}
                </button>
              </div>

              <div className="bg-black border border-slate-800 p-4 rounded-xl font-mono text-xs flex flex-col gap-2 shadow-inner h-64 overflow-y-auto custom-scrollbar">
                <div className="text-slate-500 mb-2 border-b border-slate-800 pb-2">/root/system/logs_migrazione.sh</div>
                {logs.length === 0 ? <span className="text-slate-600 italic">In attesa di istruzioni...</span> : logs.map((log, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="text-slate-500 shrink-0">[{log.time}]</span>
                    <span className={`${log.type === 'error' ? 'text-rose-500' : log.type === 'success' ? 'text-emerald-400' : log.type === 'warning' ? 'text-amber-400' : 'text-slate-300'}`}>{log.msg}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 💡 NUOVO TAB: CENTRO DEPLOY E COMUNICAZIONI */}
          {activeTab === 'deploy-center' && (
            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4">
              
              <div>
                <h2 className="text-2xl font-black text-white">Centro Deploy & Comunicazioni</h2>
                <p className="text-slate-400 text-sm mt-1">Sincronizza le modifiche del codice con Vercel e avvisa i giocatori delle novità.</p>
              </div>

              <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl shadow-xl flex flex-col gap-4">
                <h3 className="text-sm font-black text-emerald-400 uppercase tracking-widest border-b border-slate-800 pb-2 flex items-center gap-2"><span>1️⃣</span> Motore di Compilazione Vercel</h3>
                
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] text-slate-400 uppercase font-bold">Vercel Deploy Hook URL</label>
                  <div className="flex gap-2">
                    <input type="password" value={vercelWebhook} onChange={(e) => setVercelWebhook(e.target.value)} placeholder="https://api.vercel.com/v1/integrations/deploy/..." className="flex-1 bg-slate-950 border border-slate-600 rounded-lg px-4 py-2 text-white text-xs font-mono outline-none focus:border-emerald-500" />
                    <button onClick={handleSaveWebhook} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 font-bold text-white text-xs rounded-lg transition-colors border border-slate-600">Salva Hook</button>
                  </div>
                </div>

                <button onClick={handleTriggerDeploy} disabled={isDeploying} className="w-full mt-2 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(5,150,105,0.4)] disabled:opacity-50">
                  {isDeploying ? 'Invio segnale...' : '🚀 Lancia Build su Vercel'}
                </button>
              </div>

              <div className={`border p-6 rounded-2xl shadow-xl flex flex-col gap-4 transition-all duration-500 ${isAnnounceActive ? 'bg-indigo-900/20 border-indigo-500/50' : 'bg-slate-900 border-slate-700'}`}>
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <h3 className={`text-sm font-black uppercase tracking-widest flex items-center gap-2 ${isAnnounceActive ? 'text-indigo-400' : 'text-slate-300'}`}><span>2️⃣</span> Patch Notes & Avvisi</h3>
                  {isAnnounceActive ? (
                    <span className="bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded text-[10px] font-black uppercase border border-indigo-500/50 animate-pulse">Live in App</span>
                  ) : (
                    <span className="bg-slate-800 text-slate-500 px-2 py-1 rounded text-[10px] font-black uppercase">Spento</span>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] text-slate-400 uppercase font-bold">Versione Aggiornamento (es. v1.2.0)</label>
                  <input type="text" value={releaseVersion} onChange={e => setReleaseVersion(e.target.value)} placeholder="v1.0.0" className="w-1/3 bg-slate-950 border border-slate-600 rounded-lg px-4 py-2 text-white text-xs font-mono outline-none focus:border-indigo-500" />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] text-slate-400 uppercase font-bold">Testo dell'Avviso ai giocatori</label>
                  <textarea value={releaseNotes} onChange={e => setReleaseNotes(e.target.value)} placeholder="- Risolto bug mappe...\n- Aggiunta funzione X..." rows="5" className="w-full bg-slate-950 border border-slate-600 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 custom-scrollbar"></textarea>
                </div>

                <div className="flex gap-2 mt-2">
                  {!isAnnounceActive ? (
                    <button onClick={() => handlePublishAnnouncement(true)} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(79,70,229,0.4)]">
                      📢 Pubblica Avviso ai Giocatori
                    </button>
                  ) : (
                    <>
                      <button onClick={() => handlePublishAnnouncement(true)} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-bold rounded-xl text-xs uppercase transition-all">
                        Aggiorna Testo Live
                      </button>
                      <button onClick={() => handlePublishAnnouncement(false)} className="flex-1 py-3 bg-rose-900/50 hover:bg-rose-900 border border-rose-500/50 text-rose-400 font-bold rounded-xl text-xs uppercase transition-all">
                        Nascondi Avviso (Spegni)
                      </button>
                    </>
                  )}
                </div>
              </div>

            </div>
          )}

        </div>
      </main>
    </div>
  );
}