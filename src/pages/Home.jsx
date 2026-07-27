import { useNavigate } from 'react-router-dom';
import { RosterTable } from '../components/RosterTable';
import { useState } from 'react';
import { db } from '../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

export default function Home({ roster, setRoster }) {
  const navigate = useNavigate();
  const [isLoadingRoster, setIsLoadingRoster] = useState(false);
  const [isRosterOpen, setIsRosterOpen] = useState(false); // Nuovo stato per nascondere/mostrare il roster

  // --- LOGICA ROSTER ---
  const handleAddPlayer = (playerData) => setRoster(prev => [...prev, { id: `player-${Date.now()}`, ...playerData }]);
  const handleEditPlayer = (id, field, value) => setRoster(prev => prev.map(player => player.id === id ? { ...player, [field]: value } : player));
  const handleDeletePlayer = (id) => setRoster(prev => prev.filter(player => player.id !== id));

  const handleSaveRosterToCloud = async () => {
    const code = window.prompt("Inserisci il Codice Alleanza per SALVARE il Roster:");
    if (code) {
      try { 
        await setDoc(doc(db, "rosters", code.toUpperCase()), { players: roster }); 
        alert("Roster salvato in Cloud."); 
      } catch (error) { 
        alert("Errore durante il salvataggio."); 
      }
    }
  };

  const handleLoadRosterFromCloud = async () => {
    const code = window.prompt("Inserisci il Codice Alleanza per CARICARE il Roster:");
    if (code) {
      try { 
        setIsLoadingRoster(true); 
        const docSnap = await getDoc(doc(db, "rosters", code.toUpperCase())); 
        if (docSnap.exists()) setRoster(docSnap.data().players || []); 
        else alert("Nessun Roster trovato."); 
      } catch (error) { 
        alert("Errore durante il caricamento."); 
      } finally { 
        setIsLoadingRoster(false); 
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-8 flex flex-col gap-8">
      
      {/* HEADER SEMPRE VISIBILE */}
      <header className="flex justify-between items-center bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
        <h1 className="text-3xl font-black text-white tracking-wider">HUB <span className="text-cyan-400">KINGSHOT</span></h1>
        <div className="flex gap-4">
          <button onClick={() => navigate('/swordland')} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg transition-all">
            ⚔️ Simulatore Swordland
          </button>
          <button onClick={() => navigate('/viking')} className="px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl shadow-lg transition-all">
            🛡️ Analizzatore Viking
          </button>
        </div>
      </header>

      {/* MAIN CONTENT DINAMICO */}
      <main className="flex-1 bg-slate-900/50 p-6 rounded-2xl border border-slate-800 transition-all duration-300">
        
        {!isRosterOpen ? (
          
          /* SCHERMATA HOME "PULITA" */
          <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-6">
            <h2 className="text-2xl font-bold text-slate-300">Benvenuto nella Dashboard dell'Alleanza</h2>
            <p className="text-slate-400 text-center max-w-lg mb-4">
              Da qui potrai accedere a tutti gli strumenti strategici. Inizia configurando i giocatori o vai direttamente ai simulatori usando i tasti in alto.
            </p>
            
            <button 
              onClick={() => setIsRosterOpen(true)} 
              className="px-8 py-4 bg-cyan-700 hover:bg-cyan-600 text-white font-bold rounded-xl shadow-[0_0_15px_rgba(34,211,238,0.3)] transition-all text-lg flex items-center gap-3 border border-cyan-500"
            >
              <span className="text-2xl">👥</span> Gestione Roster Alleanza
            </button>
          </div>

        ) : (

          /* SCHERMATA GESTIONE ROSTER (Visibile solo al click) */
          <div className="flex flex-col h-full animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setIsRosterOpen(false)} 
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-sm font-bold rounded-lg border border-slate-600 flex items-center transition-colors"
                >
                  ⬅ Torna alla Dashboard
                </button>
                <h2 className="text-xl font-bold text-slate-300">Database Giocatori</h2>
              </div>
              
              <div className="flex gap-2">
                <button onClick={handleLoadRosterFromCloud} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-400 text-sm font-bold rounded-lg border border-slate-600 transition-colors">⬇️ Carica da Cloud</button>
                <button onClick={handleSaveRosterToCloud} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 text-sm font-bold rounded-lg border border-slate-600 transition-colors">☁️ Salva in Cloud</button>
              </div>
            </div>
            
            {isLoadingRoster ? (
              <div className="text-center text-slate-400 py-10 animate-pulse font-bold text-lg">Caricamento database in corso...</div>
            ) : (
              <RosterTable 
                roster={roster} 
                onAddPlayer={handleAddPlayer} 
                onEdit={handleEditPlayer} 
                onDelete={handleDeletePlayer} 
                onDeploy={() => navigate('/swordland')}
              />
            )}
          </div>

        )}

      </main>
    </div>
  );
}