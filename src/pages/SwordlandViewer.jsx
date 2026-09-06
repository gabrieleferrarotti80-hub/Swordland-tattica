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

  // Stati per il caricamento
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [planData, setPlanData] = useState(null);

  // Stato per la navigazione interna (Dashboard vs Mappa vs Giocatori)
  const [activeView, setActiveView] = useState('home'); // 'home', 'map', 'players'

  // Stati del motore tattico
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [teamScores, setTeamScores] = useState({ blue: 0, red: 0 });
  const [buildingStates, setBuildingStates] = useState({});
  const [lootDrops, setLootDrops] = useState([]);
  
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Recupero Dati
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

  // Calcolo Punteggi
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

  // Motore del Tempo
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

  if (isLoading) return <div className="h-[100dvh] flex items-center justify-center bg-slate-950 text-cyan-400 font-black animate-pulse">Caricamento in corso...</div>;
  if (error) return <div className="h-[100dvh] flex flex-col items-center justify-center bg-slate-950 text-rose-500 font-black gap-4">{error}<button onClick={() => navigate('/')} className="px-4 py-2 bg-slate-800 text-white rounded-lg">Torna alla Home</button></div>;
  if (!planData) return null;

  const tacticalData = planData.data || planData;
  const deployedPlayers = tacticalData.activeDeployment || [];
  const marchesList = tacticalData.marches || [];
  const rosterList = tacticalData.roster || deployedPlayers;

  // ==========================================
  // VISTA 1: HOME (DASHBOARD)
  // ==========================================
  const renderHome = () => (
    <div className="flex flex-col h-[100dvh] bg-slate-950 overflow-y-auto custom-scrollbar p-6 items-center justify-center animate-in fade-in zoom-in-95 duration-300">
      <div className="w-full max-w-md flex flex-col gap-8">
        
        {/* Header e Punteggi */}
        <div className="text-center flex flex-col gap-2">
          <span className="text-rose-500 font-black uppercase tracking-widest text-sm">Swordland Viewer</span>
          <h1 className="text-2xl font-black text-white leading-tight">{planData.name}</h1>
          
          <div className="flex justify-center items-center gap-6 mt-4 bg-slate-900/80 p-4 rounded-3xl border border-slate-800 shadow-xl">
            <div className="flex flex-col items-center">
              <span className="text-[10px] text-cyan-400 font-black uppercase tracking-widest mb-1">Team Blu</span>
              <span className="text-3xl font-black text-white drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]">{Math.floor(teamScores.blue)}</span>
            </div>
            <div className="text-slate-600 font-black text-xl">VS</div>
            <div className="flex flex-col items-center">
              <span className="text-[10px] text-rose-400 font-black uppercase tracking-widest mb-1">Team Rosso</span>
              <span className="text-3xl font-black text-white drop-shadow-[0_0_10px_rgba(244,63,94,0.5)]">{Math.floor(teamScores.red)}</span>
            </div>
          </div>
        </div>

        {/* Menu a Bottoni */}
        <div className="flex flex-col gap-4">
          <button 
            onClick={() => setActiveView('map')}
            className="w-full bg-slate-900 hover:bg-cyan-950/40 border border-cyan-900/50 hover:border-cyan-500 text-left p-5 rounded-2xl transition-all shadow-lg flex items-center justify-between group"
          >
            <div className="flex flex-col">
              <span className="text-cyan-400 font-black uppercase tracking-widest text-sm mb-1">🗺️ Mappa Tattica</span>
              <span className="text-slate-400 text-xs">Esplora posizioni e spostamenti.</span>
            </div>
            <span className="text-cyan-500 opacity-50 group-hover:opacity-100 transition-opacity text-xl">➔</span>
          </button>

          <button 
            onClick={() => setActiveView('players')}
            className="w-full bg-slate-900 hover:bg-emerald-950/40 border border-emerald-900/50 hover:border-emerald-500 text-left p-5 rounded-2xl transition-all shadow-lg flex items-center justify-between group"
          >
            <div className="flex flex-col">
              <span className="text-emerald-400 font-black uppercase tracking-widest text-sm mb-1">👥 Giocatori ({deployedPlayers.length})</span>
              <span className="text-slate-400 text-xs">Vedi chi partecipa e le squadre.</span>
            </div>
            <span className="text-emerald-500 opacity-50 group-hover:opacity-100 transition-opacity text-xl">➔</span>
          </button>

          <button 
            onClick={() => setIsExportModalOpen(true)}
            className="w-full bg-slate-900 hover:bg-indigo-950/40 border border-indigo-900/50 hover:border-indigo-500 text-left p-5 rounded-2xl transition-all shadow-lg flex items-center justify-between group"
          >
            <div className="flex flex-col">
              <span className="text-indigo-400 font-black uppercase tracking-widest text-sm mb-1">📋 Ordini di Battaglia</span>
              <span className="text-slate-400 text-xs">Consulta la lista dei compiti assegnati.</span>
            </div>
            <span className="text-indigo-500 opacity-50 group-hover:opacity-100 transition-opacity text-xl">➔</span>
          </button>
        </div>

      </div>
    </div>
  );

  // ==========================================
  // VISTA 2: LISTA GIOCATORI
  // ==========================================
  const renderPlayers = () => (
    <div className="flex flex-col h-[100dvh] bg-slate-950 overflow-hidden animate-in slide-in-from-right duration-300">
      
      {/* Top Bar */}
      <div className="p-4 border-b border-slate-800 bg-slate-900 flex items-center gap-4 shrink-0">
        <button 
          onClick={() => setActiveView('home')}
          className="w-10 h-10 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-colors shadow-sm"
        >
          ⬅️
        </button>
        <div>
          <h2 className="text-emerald-400 font-black uppercase tracking-widest text-sm">Giocatori Schierati</h2>
          <p className="text-slate-400 text-[10px] uppercase">{deployedPlayers.length} Partecipanti Attivi</p>
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-2">
        {deployedPlayers.map(p => (
          <div key={p.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black uppercase border ${p.squad === 'Assalto' ? 'bg-rose-950/50 text-rose-400 border-rose-900/50' : p.squad === 'Difesa' ? 'bg-blue-950/50 text-blue-400 border-blue-900/50' : p.squad === 'Supporto' ? 'bg-emerald-950/50 text-emerald-400 border-emerald-900/50' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                {p.squad ? p.squad.substring(0, 2) : '-'}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-slate-200">{p.name || p.tag}</span>
                <span className="text-[10px] text-slate-500 uppercase tracking-widest">{p.squad || 'Nessuna Squadra'}</span>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-slate-400 bg-slate-950 px-2 py-1 rounded-md border border-slate-800">{p.power}M</span>
          </div>
        ))}
      </div>
    </div>
  );

  // ==========================================
  // VISTA 3: MAPPA TATTICA FULL SCREEN
  // ==========================================
  const renderMap = () => (
    <div className="flex flex-col h-[100dvh] bg-[#241a16] relative overflow-hidden animate-in zoom-in-95 duration-300">
      
      {/* Container della Mappa */}
      <div className="absolute inset-0 z-0 pointer-events-auto">
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

      {/* OVERLAY TOP: Bottone Indietro e Punteggi */}
      <div className="absolute top-0 inset-x-0 z-20 p-3 lg:p-6 pointer-events-none flex justify-between items-start gap-4">
        
        {/* Bottone Menu */}
        <button 
          onClick={() => setActiveView('home')}
          className="pointer-events-auto shrink-0 w-12 h-12 flex items-center justify-center bg-slate-950/90 hover:bg-cyan-900/80 text-white rounded-2xl border border-slate-700/50 shadow-xl backdrop-blur-md transition-colors"
        >
          <span className="text-xl">🏠</span>
        </button>

        {/* Punteggi Fluttuanti */}
        <div className="pointer-events-auto bg-slate-950/85 backdrop-blur-md border border-slate-700/50 rounded-2xl px-4 py-2 shadow-xl flex items-center gap-4">
          <div className="flex flex-col items-center">
              <span className="text-[9px] text-cyan-400 font-black uppercase">Blu</span>
              <span className="text-lg lg:text-xl font-black text-white leading-none drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]">{Math.floor(teamScores.blue)}</span>
          </div>
          <div className="w-px h-6 bg-slate-600"></div>
          <div className="flex flex-col items-center">
              <span className="text-[9px] text-rose-400 font-black uppercase">Rosso</span>
              <span className="text-lg lg:text-xl font-black text-white leading-none drop-shadow-[0_0_8px_rgba(244,63,94,0.5)]">{Math.floor(teamScores.red)}</span>
          </div>
        </div>
      </div>

      {/* OVERLAY BOTTOM: Timeline e Play */}
      <div className="absolute bottom-0 inset-x-0 z-20 p-3 lg:p-6 pointer-events-none flex justify-center">
        <div className="pointer-events-auto w-full max-w-xl bg-slate-950/90 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-4 shadow-2xl flex items-center gap-4">
          
          <button
            onClick={() => { if (!isPlaying && currentTime >= 60) setCurrentTime(0); setIsPlaying(!isPlaying); }}
            className={`w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center text-2xl shadow-lg transition-all ${isPlaying ? 'bg-amber-500 text-slate-900 shadow-amber-900/50' : 'bg-emerald-500 text-white shadow-emerald-900/50'}`}
          >
            {isPlaying ? '⏸️' : '▶️'}
          </button>
          
          <div className="flex-1 flex flex-col gap-2">
              <div className="flex justify-between items-end mb-1">
                <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest">Minuto Gioco</span>
                <span className="text-2xl font-black text-white font-mono leading-none drop-shadow-[0_0_10px_rgba(34,211,238,0.4)]">{String(currentTime).padStart(2, '0')}'</span>
              </div>
              <input
                type="range" min="0" max="60"
                value={currentTime}
                onChange={(e) => setCurrentTime(parseInt(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer"
              />
          </div>
        </div>
      </div>

    </div>
  );

  // ==========================================
  // RENDER PRINCIPALE (ROUTER INTERNO)
  // ==========================================
  return (
    <div translate="no" className="w-full h-[100dvh] bg-slate-950 font-sans text-white overflow-hidden">
      {activeView === 'home' && renderHome()}
      {activeView === 'players' && renderPlayers()}
      {activeView === 'map' && renderMap()}

      {/* Modale Esportazione Ordini - Sempre disponibile e fluttuante */}
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