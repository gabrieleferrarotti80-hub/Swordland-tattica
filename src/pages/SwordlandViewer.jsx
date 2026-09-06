import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useTranslation } from 'react-i18next';
import { InteractiveMap } from '../components/InteractiveMap';
import { ExportModal } from '../components/ExportModal';
import { calculateDynamicScores } from '../utils/scoreEngine';

export default function SwordlandViewer() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [planData, setPlanData] = useState(null);

  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [teamScores, setTeamScores] = useState({ blue: 0, red: 0 });
  const [buildingStates, setBuildingStates] = useState({});
  const [lootDrops, setLootDrops] = useState([]);
  
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  useEffect(() => {
    const fetchPlan = async () => {
      try {
        let snap = await getDoc(doc(db, 'tactical_plans', planId));
        if (!snap.exists()) snap = await getDoc(doc(db, 'swordland_plans', planId));
        if (!snap.exists()) snap = await getDoc(doc(db, 'projects', planId));
        
        if (snap.exists()) setPlanData(snap.data());
        else setError(t('viewer.not_found', 'Piano strategico non trovato.'));
      } catch (err) {
        setError(t('viewer.error_loading', 'Errore di connessione.'));
      } finally {
        setIsLoading(false);
      }
    };
    if (planId) fetchPlan();
  }, [planId, t]);

  useEffect(() => {
    if (planData) {
      const tacticalData = planData.data || planData;
      const result = calculateDynamicScores(
        currentTime, 
        tacticalData.activeDeployment || [], 
        tacticalData.marches || [], 
        tacticalData.manualCaptures || [], 
        tacticalData.buildings || [], 
        tacticalData.teamBase || 'blue'
      );
      setTeamScores(result.scores);
      setBuildingStates(result.buildingStates || {});
      setLootDrops(result.lootDrops || []);
    }
  }, [currentTime, planData]);

  useEffect(() => {
    let interval;
    if (isPlaying && planData) {
      const msPerTick = 1000 / playbackSpeed;
      interval = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= 60) { setIsPlaying(false); return 60; }
          return prev + 1;
        });
      }, msPerTick);
    }
    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, planData]);

  if (isLoading) return <div className="h-screen flex items-center justify-center bg-slate-950 text-cyan-400 font-black animate-pulse">Caricamento in corso...</div>;
  if (error) return <div className="h-screen flex flex-col items-center justify-center bg-slate-950 text-rose-500 font-black gap-4">{error}<button onClick={() => navigate('/')} className="px-4 py-2 bg-slate-800 text-white rounded-lg">Torna alla Home</button></div>;
  if (!planData) return null;

  const tacticalData = planData.data || planData;
  const deployedPlayers = tacticalData.activeDeployment || [];
  const marchesList = tacticalData.marches || [];
  const rosterList = tacticalData.roster || deployedPlayers;

  return (
    <div translate="no" className="flex h-screen overflow-hidden bg-slate-950 relative font-sans">
      
      {/* 1. SIDEBAR SINISTRA: Info, Giocatori e Pulsante Esporta Ordini */}
      <aside className="w-[300px] bg-slate-900 border-r border-slate-800 flex flex-col z-20 shadow-2xl shrink-0 overflow-hidden select-none">
        <div className="p-4 border-b border-slate-800 shrink-0 bg-slate-950 flex justify-between items-center">
          <div className="min-w-0 pr-2">
            <h2 className="text-lg font-black text-rose-500 uppercase tracking-widest">Swordland</h2>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest truncate">{planData.name || 'Visualizzazione'}</p>
          </div>
          <span className="bg-emerald-950 border border-emerald-500 text-emerald-400 text-[9px] font-black uppercase px-2 py-1 rounded shrink-0">Live</span>
        </div>

        <div className="p-4 bg-slate-900/50 border-b border-slate-800 flex flex-col gap-3 shrink-0">
          <div className="flex justify-between items-center">
            <span className="text-xs font-black text-cyan-400 uppercase tracking-widest">{t('swordland.team_blue', 'Team Blu')}</span>
            <span className="text-2xl font-black text-white drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]">{Math.floor(teamScores.blue)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs font-black text-rose-400 uppercase tracking-widest">{t('swordland.team_red', 'Team Rosso')}</span>
            <span className="text-2xl font-black text-white drop-shadow-[0_0_10px_rgba(244,63,94,0.5)]">{Math.floor(teamScores.red)}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
          <div className="p-3 bg-slate-950 sticky top-0 border-b border-slate-800 z-10">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Schierati ({deployedPlayers.length})</span>
          </div>
          <div className="p-3 flex flex-col gap-2">
            {deployedPlayers.map(p => (
              <div key={p.id} className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${p.squad === 'Assalto' ? 'bg-rose-950 text-rose-400 border border-rose-900' : p.squad === 'Difesa' ? 'bg-blue-950 text-blue-400 border border-blue-900' : p.squad === 'Supporto' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
                    {p.squad ? p.squad.charAt(0) : '-'}
                  </span>
                  <span className="text-xs font-bold text-slate-200">{p.name || p.tag}</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">{p.power}M</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pulsante Esporta Ordini per Spettatori */}
        <div className="p-3 border-t border-slate-800 shrink-0 bg-slate-950">
          <button 
            onClick={() => setIsExportModalOpen(true)} 
            className="w-full bg-indigo-600/90 hover:bg-indigo-500 text-white font-black text-[10px] uppercase tracking-widest py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-md"
          >
            📤 Esporta Ordini
          </button>
        </div>
      </aside>

      {/* 2. AREA CENTRALE: Mappa Tattica */}
      <main className="flex-1 p-4 flex flex-col min-w-0 min-h-0 h-full overflow-hidden">
        <div className="flex-1 relative rounded-3xl overflow-hidden shadow-2xl bg-[#241a16] border border-slate-800/80 pointer-events-none">
          <InteractiveMap 
            teamBase={tacticalData.teamBase || 'blue'} 
            buildings={tacticalData.buildings || []} 
            activeDeployment={deployedPlayers} 
            marches={marchesList} 
            currentTime={currentTime} 
            draftPositions={{}} 
            healingEvents={tacticalData.healingEvents || {}} 
            buildingStates={buildingStates}
            lootDrops={lootDrops}
            isEditorMode={false}
            popupPlayerId={null}
            setPopupPlayerId={() => {}}
            marchAssignments={{}}
            setMarchAssignments={() => {}}
            onUpdatePosition={() => {}}
            getAvailableMarches={() => []}
            handleHeal={() => {}}
            handleCancelHeal={() => {}}
            handleGarrisonAction={() => {}}
          />
        </div>
      </main>

      {/* 3. PANNELLO DESTRA: Barra del tempo e Controlli Play */}
      <aside className="w-[280px] bg-slate-900 border-l border-slate-800 flex flex-col z-20 shadow-2xl shrink-0 p-5 gap-6 justify-center">
        <div className="flex flex-col items-center gap-2 bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
          <span className="text-xs font-black text-cyan-400 uppercase tracking-widest">Tempo di Battaglia</span>
          <div className="text-4xl font-black text-white font-mono tracking-tighter drop-shadow-[0_0_15px_rgba(34,211,238,0.4)]">
            {String(currentTime).padStart(2, '0')}'
          </div>
          <span className="text-[10px] text-slate-400 uppercase">Minuto di Gioco</span>
        </div>

        {/* Pulsante Play / Pausa Principale */}
        <button 
          onClick={() => { if (!isPlaying && currentTime >= 60) setCurrentTime(0); setIsPlaying(!isPlaying); }}
          className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-wider shadow-xl transition-all flex items-center justify-center gap-3 ${isPlaying ? 'bg-amber-600 hover:bg-amber-500 text-slate-950 shadow-amber-900/50' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/50'}`}
        >
          <span>{isPlaying ? '⏸️' : '▶️'}</span>
          <span>{isPlaying ? 'Pausa' : 'Avvia Play'}</span>
        </button>

        {/* Slider temporale */}
        <div className="flex flex-col gap-3 bg-slate-950/40 p-4 rounded-2xl border border-slate-800/80">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Scorri Minuto ({currentTime}/60)</label>
          <input 
            type="range" 
            min="0" 
            max="60" 
            value={currentTime} 
            onChange={(e) => setCurrentTime(parseInt(e.target.value))}
            className="w-full accent-cyan-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] font-mono text-slate-500 font-bold">
            <span>0'</span>
            <span>30'</span>
            <span>60'</span>
          </div>
        </div>

        {/* Selettore Velocità */}
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Velocità di Riproduzione</span>
          <div className="grid grid-cols-3 gap-2">
            {[0.5, 1, 2].map((spd) => (
              <button 
                key={spd}
                onClick={() => setPlaybackSpeed(spd)}
                className={`py-2 rounded-xl text-xs font-black transition-colors border ${playbackSpeed === spd ? 'bg-cyan-600 text-white border-cyan-400 shadow-md' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'}`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* Modale Esportazione Ordini integrato */}
      <ExportModal 
        isOpen={isExportModalOpen} 
        onClose={() => setIsExportModalOpen(false)} 
        marches={marchesList} 
        activeDeployment={deployedPlayers} 
        roster={rosterList} 
      />

    </div>
  );
}