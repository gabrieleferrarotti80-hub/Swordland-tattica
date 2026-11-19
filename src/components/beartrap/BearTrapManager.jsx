import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../../firebase'; 
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { 
  generateBearTrapWaves, 
  calculateTravelSeconds, 
  assignPlayersToWaveGroups, 
  getRecommendedGroupsCount 
} from './rallyEngine';

const BACKUP_STORAGE_KEY = 'kingshot-hive-coords-backup';

export default function BearTrapManager({ roster, setRoster, onBack, allianceDbData, allianceStructures, allianceCode }) {
  // --- STATI GLOBALI ---
  const [activeTab, setActiveTab] = useState('generator'); 
  const [selectedTrap, setSelectedTrap] = useState(1);
  
  // Coordinate di entrambe le trappole
  const [trap1Coords, setTrap1Coords] = useState({ x: '', y: '' });
  const [trap2Coords, setTrap2Coords] = useState({ x: '', y: '' });
  
  const [troopCap, setTroopCap] = useState(100000);
  const [output, setOutput] = useState('');
  const [hasBackup, setHasBackup] = useState(false);
  const [backupDate, setBackupDate] = useState('');
  const [simPlayerId, setSimPlayerId] = useState('');
  const [hypoX, setHypoX] = useState('');
  const [hypoY, setHypoY] = useState('');

  // 1. Lettura intelligente delle coordinate Trappole (anche da Cloud se mancano)
  useEffect(() => {
    const fetchTraps = async () => {
      let structures = allianceStructures || allianceDbData?.structures || [];

      if (structures.length === 0 && allianceCode) {
        try {
          const snap = await getDoc(doc(db, 'allianceMapData', allianceCode));
          if (snap.exists() && snap.data().allianceStructures) {
            structures = snap.data().allianceStructures;
          }
        } catch (e) {
          console.error("Errore fetch strutture per BearTrap:", e);
        }
      }

      const traps = structures.filter(s => String(s.type).toLowerCase() === 'beartrap');
      const t1 = structures.find(s => s.code === 'TRP1' || (String(s.type).toLowerCase() === 'beartrap' && String(s.name).includes('1'))) || traps[0];
      const t2 = structures.find(s => s.code === 'TRP2' || (String(s.type).toLowerCase() === 'beartrap' && String(s.name).includes('2'))) || traps[1];

      if (t1 && t1.x != null && t1.y != null) {
        setTrap1Coords({ x: t1.x, y: t1.y });
      }
      if (t2 && t2.x != null && t2.y != null) {
        setTrap2Coords({ x: t2.x, y: t2.y });
      }
    };

    fetchTraps();
  }, [allianceDbData, allianceStructures, allianceCode]);

  // Controllo presenza Backup
  useEffect(() => {
    const raw = localStorage.getItem(BACKUP_STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setHasBackup(true);
        setBackupDate(parsed.timestamp || '');
        return;
      } catch (e) {}
    }
    const rosterHasBackup = (roster || []).some(p => p.backupX !== undefined || p.backupY !== undefined);
    setHasBackup(rosterHasBackup);
  }, [roster]);

  const currentTrapCoords = selectedTrap === 1 ? trap1Coords : trap2Coords;
  const trapX = currentTrapCoords.x;
  const trapY = currentTrapCoords.y;

  const setCurrentTrapX = (val) => {
    if (selectedTrap === 1) setTrap1Coords(prev => ({ ...prev, x: val }));
    else setTrap2Coords(prev => ({ ...prev, x: val }));
  };

  const setCurrentTrapY = (val) => {
    if (selectedTrap === 1) setTrap1Coords(prev => ({ ...prev, y: val }));
    else setTrap2Coords(prev => ({ ...prev, y: val }));
  };

  // Filtro e sorting Roster per Punteggio Orso (Potenza * Partecipazione)
  const trapPlayers = useMemo(() => {
    return roster
      .filter(p => (Number(p.assignedTrap) || 1) === selectedTrap)
      .sort((a, b) => {
        const scoreA = (Number(a.power) || 0) * (Number(a.participation) || 2);
        const scoreB = (Number(b.power) || 0) * (Number(b.participation) || 2);
        if (scoreB !== scoreA) return scoreB - scoreA;
        return (a.name || '').localeCompare(b.name || '');
      });
  }, [roster, selectedTrap]);

  const onlinePlayers = trapPlayers.filter(p => p.isParticipating);
  const onlineCount = onlinePlayers.length;
  const isSetupComplete = trapX !== '' && trapY !== '';

  // Calcolo Gruppi A, B, C, D, E in tempo reale con distribuzione a Serpentina
  const waveGroups = useMemo(() => {
    return assignPlayersToWaveGroups(onlinePlayers, Number(trapX) || 500, Number(trapY) || 500);
  }, [onlinePlayers, trapX, trapY]);

  const playerGroupMap = useMemo(() => {
    const map = {};
    waveGroups.forEach(g => {
      g.members.forEach(m => { map[m.id] = g.label; });
    });
    return map;
  }, [waveGroups]);

  const activeGroupsCount = getRecommendedGroupsCount(onlineCount);

  // Azioni Roster
  const togglePresence = (id) => setRoster(prev => prev.map(p => p.id === id ? { ...p, isParticipating: !p.isParticipating } : p));
  const setAllPresence = (status) => setRoster(prev => prev.map(p => (Number(p.assignedTrap) || 1) === selectedTrap ? { ...p, isParticipating: status } : p));
  
  const updateParticipation = async (e, id, val) => {
    e.stopPropagation();
    const updatedRoster = roster.map(p => p.id === id ? { ...p, participation: Number(val) } : p);
    setRoster(updatedRoster);
    if (allianceCode && allianceCode !== 'DEMO') {
      try {
        await setDoc(doc(db, 'rosters', allianceCode), { players: updatedRoster }, { merge: true });
      } catch (err) {
        console.error("Errore salvataggio costanza:", err);
      }
    }
  };

  // --- MOTORE DI POSIZIONAMENTO UNIFICATO COMPATTO (Zero buchi 1x1 + Stendardi) ---
  const handleApplyOptimalCoordinates = async () => {
    if (trap1Coords.x === '' || trap1Coords.y === '') {
      alert("⚠️ Coordinate della Trappola 1 mancanti!");
      return;
    }

    if (!window.confirm("Vuoi ricalcolare le coordinate creando un Posizionamento Unico compatto (senza spazi vuoti), rispettando gli stendardi e mettendo i giocatori senza orso nella fascia esterna?\n\n(Il posizionamento attuale verrà salvato nel Backup)")) {
      return;
    }

    // 1. Salva Backup del posizionamento attuale
    const backupSnapshot = {};
    roster.forEach(p => {
      backupSnapshot[p.id] = { x: p.x ?? '', y: p.y ?? '', assignedTrap: p.assignedTrap || 1 };
    });
    const nowStr = new Date().toLocaleString('it-IT');
    localStorage.setItem(BACKUP_STORAGE_KEY, JSON.stringify({
      timestamp: nowStr,
      coords: backupSnapshot
    }));

    // 2. Recupera tutte le strutture (inclusi gli stendardi dal DB mappa se necessario)
    let structures = allianceStructures || allianceDbData?.structures || [];
    if (structures.length === 0 && allianceCode) {
      try {
        const snap = await getDoc(doc(db, 'allianceMapData', allianceCode));
        if (snap.exists() && snap.data().allianceStructures) {
          structures = snap.data().allianceStructures;
        }
      } catch (e) {
        console.error("Errore lettura strutture per posizionamento:", e);
      }
    }

    const obstacles = [];
    const t1X = Math.round(Number(trap1Coords.x));
    const t1Y = Math.round(Number(trap1Coords.y));
    obstacles.push({ x: t1X, y: t1Y, w: 3, h: 3, type: 'trap' });

    const hasT2 = trap2Coords.x !== '' && trap2Coords.y !== '';
    const t2X = hasT2 ? Math.round(Number(trap2Coords.x)) : t1X + 20;
    const t2Y = hasT2 ? Math.round(Number(trap2Coords.y)) : t1Y;
    obstacles.push({ x: t2X, y: t2Y, w: 3, h: 3, type: 'trap' });

    const hqStruct = structures.find(s => String(s.type).toLowerCase() === 'headquarters' || s.code === 'HQ');
    if (hqStruct && hqStruct.x != null && hqStruct.y != null) {
      obstacles.push({ x: Math.round(Number(hqStruct.x)), y: Math.round(Number(hqStruct.y)), w: 3, h: 3, type: 'hq' });
    }

    // Stendardi 1x1 come ostacoli fissi
    structures
      .filter(s => String(s.type).toLowerCase() === 'banner' || s.code === 'BAN')
      .forEach(b => {
        if (b.x != null && b.y != null) {
          obstacles.push({ x: Math.round(Number(b.x)), y: Math.round(Number(b.y)), w: 1, h: 1, type: 'banner' });
        }
      });

    const canPlace = (x, y, w, h) => {
      for (let obs of obstacles) {
        if (x < obs.x + obs.w && x + w > obs.x && y < obs.y + obs.h && y + h > obs.y) return false;
      }
      return true;
    };

    // 3. Generazione Griglia Candidati Unificata (Allineata a passo 2x2 per non lasciare corridoi da 1 casella)
    const minX = Math.min(t1X, t2X) - 44;
    const maxX = Math.max(t1X, t2X) + 44;
    const minY = Math.min(t1Y, t2Y) - 44;
    const maxY = Math.max(t1Y, t2Y) + 44;

    const t1CenterX = t1X + 1.5, t1CenterY = t1Y + 1.5;
    const t2CenterX = t2X + 1.5, t2CenterY = t2Y + 1.5;

    const parityX = ((t1X % 2) + 2) % 2;
    const parityY = ((t1Y % 2) + 2) % 2;

    const candidatePool = [];
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        const isGridAligned = (((x % 2) + 2) % 2 === parityX) && (((y % 2) + 2) % 2 === parityY);
        const d1 = Math.hypot((x + 1) - t1CenterX, (y + 1) - t1CenterY);
        const d2 = Math.hypot((x + 1) - t2CenterX, (y + 1) - t2CenterY);
        const gridPenalty = isGridAligned ? 0 : 0.35;

        candidatePool.push({
          x,
          y,
          d1: d1 + gridPenalty,
          d2: d2 + gridPenalty,
          dUnified: Math.min(d1, d2) + gridPenalty,
          rawD1: d1,
          rawD2: d2
        });
      }
    }

    const pickBestSlot = (sortKey) => {
      let best = null;
      let bestVal = Infinity;
      for (let i = 0; i < candidatePool.length; i++) {
        const c = candidatePool[i];
        if (c[sortKey] < bestVal && canPlace(c.x, c.y, 2, 2)) {
          best = c;
          bestVal = c[sortKey];
        }
      }
      return best;
    };

    // 4. Divisione Giocatori: Titolari T1, Titolari T2, e Senza Orso (Fascia Esterna Unificata)
    const getBearScore = (p) => (Number(p.power) || 0) * (Number(p.participation) || 2);
    const sortByPriority = (a, b) => (getBearScore(b) - getBearScore(a)) || ((Number(b.power) || 0) - (Number(a.power) || 0));

    const team1 = roster.filter(p => Number(p.assignedTrap) === 1).sort(sortByPriority);
    const team2 = roster.filter(p => Number(p.assignedTrap) === 2).sort(sortByPriority);
    const unassigned = roster.filter(p => Number(p.assignedTrap) !== 1 && Number(p.assignedTrap) !== 2).sort(sortByPriority);

    const newCoordsMap = {};

    // FASE A: Piazzamento SIMULTANEO alternato (T1 <-> T2)
    const maxTeamLen = Math.max(team1.length, team2.length);
    for (let i = 0; i < maxTeamLen; i++) {
      if (i < team1.length) {
        const p1 = team1[i];
        const slot1 = pickBestSlot('d1');
        if (slot1) {
          const ring = slot1.rawD1 <= 3.8 ? 1 : (slot1.rawD1 <= 6.2 ? 2 : 3);
          newCoordsMap[p1.id] = { x: slot1.x, y: slot1.y, ring, trap: 1 };
          obstacles.push({ x: slot1.x, y: slot1.y, w: 2, h: 2 });
        }
      }
      if (i < team2.length) {
        const p2 = team2[i];
        const slot2 = pickBestSlot('d2');
        if (slot2) {
          const ring = slot2.rawD2 <= 3.8 ? 1 : (slot2.rawD2 <= 6.2 ? 2 : 3);
          newCoordsMap[p2.id] = { x: slot2.x, y: slot2.y, ring, trap: 2 };
          obstacles.push({ x: slot2.x, y: slot2.y, w: 2, h: 2 });
        }
      }
    }

    // FASE B: Piazzamento Unificato dei giocatori senza trappola nella fascia esterna
    unassigned.forEach(p => {
      const slot = pickBestSlot('dUnified');
      if (slot) {
        const closerTrap = slot.rawD1 <= slot.rawD2 ? 1 : 2;
        newCoordsMap[p.id] = { x: slot.x, y: slot.y, ring: 3, trap: p.assignedTrap || closerTrap };
        obstacles.push({ x: slot.x, y: slot.y, w: 2, h: 2 });
      }
    });

    // 5. Applica al Roster e salva immediatamente su Firebase Cloud
    const updatedRoster = roster.map(p => {
      const assigned = newCoordsMap[p.id];
      if (!assigned) return p;
      return {
        ...p,
        backupX: p.x ?? '',
        backupY: p.y ?? '',
        backupAssignedTrap: p.assignedTrap || 1,
        x: assigned.x,
        y: assigned.y,
        ring: assigned.ring,
        assignedTrap: assigned.trap
      };
    });

    setRoster(updatedRoster);

    if (allianceCode && allianceCode !== 'DEMO') {
      try {
        await setDoc(doc(db, 'rosters', allianceCode), { players: updatedRoster }, { merge: true });

        const newOverrides = {};
        updatedRoster.forEach(p => {
          if (p.x !== undefined && p.x !== '' && p.y !== undefined && p.y !== '') {
            newOverrides[p.id] = { x: Number(p.x), y: Number(p.y) };
          }
        });
        await setDoc(doc(db, 'allianceMapData', allianceCode), { playerOverrides: newOverrides }, { merge: true });
      } catch (err) {
        console.error("Errore salvataggio coordinate Orso su Cloud:", err);
      }
    }

    setHasBackup(true);
    setBackupDate(nowStr);
    alert("✅ Posizionamento Unico completato e salvato in Cloud! Buchi tra castelli eliminati, stendardi rispettati e giocatori senza orso disposti nella fascia esterna.");
  };

  // --- FUNZIONE DI RIPRISTINO BACKUP ---
  const handleRestoreBackup = async () => {
    if (!window.confirm("Vuoi ripristinare il posizionamento originale dei giocatori dal Backup?")) return;

    const rawBackup = localStorage.getItem(BACKUP_STORAGE_KEY);
    let parsedCoords = {};
    if (rawBackup) {
      try { parsedCoords = JSON.parse(rawBackup).coords || {}; } catch (e) {}
    }

    const restoredRoster = roster.map(p => {
      const saved = parsedCoords[p.id];
      const restoredX = saved !== undefined ? saved.x : (p.backupX !== undefined ? p.backupX : p.x);
      const restoredY = saved !== undefined ? saved.y : (p.backupY !== undefined ? p.backupY : p.y);
      const restoredTrap = saved !== undefined ? saved.assignedTrap : (p.backupAssignedTrap || p.assignedTrap);
      return {
        ...p,
        x: restoredX,
        y: restoredY,
        assignedTrap: restoredTrap
      };
    });

    setRoster(restoredRoster);

    if (allianceCode && allianceCode !== 'DEMO') {
      try {
        await setDoc(doc(db, 'rosters', allianceCode), { players: restoredRoster }, { merge: true });
        const restoredOverrides = {};
        restoredRoster.forEach(p => {
          if (p.x !== undefined && p.x !== '' && p.y !== undefined && p.y !== '') {
            restoredOverrides[p.id] = { x: Number(p.x), y: Number(p.y) };
          }
        });
        await setDoc(doc(db, 'allianceMapData', allianceCode), { playerOverrides: restoredOverrides }, { merge: true });
      } catch (err) {
        console.error("Errore ripristino backup su Cloud:", err);
      }
    }

    alert("⏪ Coordinate precedenti ripristinate e salvate in Cloud!");
  };

  const handleGenerate = () => {
    if (onlineCount === 0) return;
    if (!isSetupComplete) return;
    setOutput(generateBearTrapWaves(onlinePlayers, troopCap, Number(trapX), Number(trapY)));
  };

  // --- LOGICA SIMULATORE ---
  const simPlayer = trapPlayers.find(p => p.id === simPlayerId) || null;
  let currentTravelTime = 0, currentCycleTime = 0, currentMaxRallies = 0;
  let hypoTravelTime = 0, hypoCycleTime = 0, hypoMaxRallies = 0;

  if (simPlayer && isSetupComplete && simPlayer.x !== '' && simPlayer.y !== '') {
    const groupLetter = playerGroupMap[simPlayer.id] || 'A';
    const groupOffsetSec = Math.max(0, ['A', 'B', 'C', 'D', 'E'].indexOf(groupLetter)) * 60;
    const effectiveWindowSec = 1800 - groupOffsetSec;

    currentTravelTime = calculateTravelSeconds(simPlayer.x, simPlayer.y, trapX, trapY);
    currentCycleTime = 240 + (currentTravelTime * 2) + 10;
    currentMaxRallies = Math.min(5, Math.floor((effectiveWindowSec + currentTravelTime + 10) / currentCycleTime));

    if (hypoX && hypoY) {
      hypoTravelTime = calculateTravelSeconds(hypoX, hypoY, trapX, trapY);
      hypoCycleTime = 240 + (hypoTravelTime * 2) + 10;
      hypoMaxRallies = Math.min(5, Math.floor((effectiveWindowSec + hypoTravelTime + 10) / hypoCycleTime));
    }
  }
  const ralliesGained = hypoMaxRallies - currentMaxRallies;

  return (
    <div className="flex flex-col w-full px-2 md:px-8 gap-6 animate-in slide-in-from-right-8 duration-300 pb-10">
      
      {/* TOP BAR / BACK BUTTON */}
      <button onClick={onBack} className="text-slate-400 hover:text-white font-bold text-xs uppercase mb-2 text-left w-fit flex items-center px-6 py-3 border border-slate-700 bg-slate-900 rounded-full transition-colors shadow-md">
        ⬅ Torna al Menu Alleanza
      </button>

      {/* CONTAINER PRINCIPALE */}
      <div className="bg-slate-900 border border-fuchsia-500/30 rounded-3xl shadow-2xl flex flex-col max-w-6xl mx-auto w-full overflow-hidden">
        
        {/* HEADER & SETUP GLOBALE */}
        <div className="bg-slate-950 border-b border-slate-800 p-6 md:p-8 flex flex-col gap-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-fuchsia-600/5 rounded-full blur-[80px] pointer-events-none"></div>

          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 relative z-10">
            <div>
              <h2 className="text-3xl font-black text-white flex items-center gap-3">
                <span className="drop-shadow-[0_0_15px_rgba(217,70,239,0.8)]">🐻</span> Ottimizzatore Trappola dell'Orso
              </h2>
              <p className="text-slate-400 text-sm mt-2 max-w-xl">
                Coordinate Trappole lette automaticamente dalla mappa alleanza. Posiziona gli alleati negli anelli prioritari e genera i turni scaglionati (A-E).
              </p>
            </div>

            <div className="flex flex-col gap-2 bg-slate-900/80 p-4 rounded-2xl border border-slate-700 shadow-inner w-full lg:w-auto">
              <div className="flex items-center justify-between gap-4 mb-1">
                <span className="text-xs font-black text-fuchsia-400 uppercase tracking-widest">Step 1: Coordinate Trappole Esistenti</span>
                <span className="text-[10px] text-slate-400 font-mono">
                  T1:({trap1Coords.x || '?'},{trap1Coords.y || '?'}) • T2:({trap2Coords.x || '?'},{trap2Coords.y || '?'})
                </span>
              </div>
              
              <div className="flex flex-wrap gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-slate-500 font-bold uppercase">Trappola Attiva</label>
                  <select value={selectedTrap} onChange={(e) => { setSelectedTrap(Number(e.target.value)); setOutput(''); }} className="bg-slate-950 border border-slate-700 text-white font-bold rounded-lg px-3 py-2 outline-none cursor-pointer focus:border-fuchsia-500 transition-colors">
                    <option value={1}>Trappola 1</option>
                    <option value={2}>Trappola 2</option>
                  </select>
                </div>
                
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-slate-500 font-bold uppercase">X Trappola {selectedTrap}</label>
                  <input type="number" value={trapX} onChange={(e) => setCurrentTrapX(e.target.value)} placeholder="000" className={`bg-slate-950 border text-cyan-300 font-mono rounded-lg px-3 py-2 outline-none w-20 text-center transition-colors ${trapX === '' ? 'border-rose-500/50' : 'border-slate-700 focus:border-cyan-500'}`}/>
                </div>
                
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-slate-500 font-bold uppercase">Y Trappola {selectedTrap}</label>
                  <input type="number" value={trapY} onChange={(e) => setCurrentTrapY(e.target.value)} placeholder="000" className={`bg-slate-950 border text-amber-300 font-mono rounded-lg px-3 py-2 outline-none w-20 text-center transition-colors ${trapY === '' ? 'border-rose-500/50' : 'border-slate-700 focus:border-amber-500'}`}/>
                </div>
              </div>
            </div>
          </div>

          {/* BARRA POSIZIONAMENTO GIOCATORI & BACKUP */}
          <div className="relative z-10 bg-slate-900/90 border border-amber-500/30 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-col">
              <span className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-2">
                📐 Posizionamento Automatico Anelli Hive (Con Backup)
              </span>
              <span className="text-xs text-slate-400 mt-0.5">
                Assegna le coordinate ideali 2x2 attorno a Trappola 1 e Trappola 2 dando priorità a Potenza × Costanza.
                {hasBackup && backupDate && <span className="text-emerald-400 ml-2 font-semibold">(Backup attivo del {backupDate})</span>}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
              {hasBackup && (
                <button 
                  onClick={handleRestoreBackup}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-rose-950/60 text-amber-300 hover:text-rose-300 border border-amber-500/40 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2"
                >
                  ⏪ Ripristina Backup Coordinate
                </button>
              )}
              <button 
                onClick={handleApplyOptimalCoordinates}
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-[0_0_15px_rgba(245,158,11,0.3)] transition-all flex items-center gap-2"
              >
                🎯 Modifica Coordinate Giocatori
              </button>
            </div>
          </div>
        </div>

        {/* NAVIGATION TABS */}
        <div className="flex bg-slate-950/50 border-b border-slate-800 shrink-0">
          <button onClick={() => setActiveTab('generator')} className={`flex-1 md:flex-none px-6 py-4 font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'generator' ? 'text-fuchsia-400 border-b-2 border-fuchsia-400 bg-slate-900' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900/50'}`}>
            ⚙️ Turni & Gruppi (A-E)
          </button>
          <button onClick={() => setActiveTab('simulator')} className={`flex-1 md:flex-none px-6 py-4 font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'simulator' ? 'text-cyan-400 border-b-2 border-cyan-400 bg-slate-900' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900/50'}`}>
            📍 Verifica dei 5 Raduni
          </button>
        </div>

        {/* TAB 1: GENERATORE RADUNI E GRUPPI */}
        {activeTab === 'generator' && (
          <div className="p-6 md:p-8 grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-300">
            
            {/* COLONNA SINISTRA: APPELLO & COEFFICIENTE PARTECIPAZIONE */}
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-end border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <span className="text-fuchsia-500">Step 2:</span> Appello & Costanza (1x-3x)
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">Imposta la costanza (1x-3x) per la priorità nell'Anello 1 e seleziona i presenti.</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="bg-emerald-900/30 text-emerald-400 text-xs font-bold px-3 py-1 rounded-full border border-emerald-500/30 shadow-inner">
                    {onlineCount} Presenti ➔ {activeGroupsCount} {activeGroupsCount === 1 ? 'Gruppo' : 'Gruppi'}
                  </span>
                  <div className="flex gap-2">
                    <button onClick={() => setAllPresence(true)} className="text-[10px] font-bold bg-slate-800 text-slate-300 px-2 py-1 rounded hover:bg-slate-700 transition-colors">TUTTI ON</button>
                    <button onClick={() => setAllPresence(false)} className="text-[10px] font-bold bg-slate-800 text-slate-300 px-2 py-1 rounded hover:bg-slate-700 transition-colors">TUTTI OFF</button>
                  </div>
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-2 h-[480px] overflow-y-auto custom-scrollbar flex flex-col gap-1.5 shadow-inner relative">
                {trapPlayers.length === 0 ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 text-sm italic">
                    <span>Nessun giocatore assegnato alla Trappola {selectedTrap}.</span>
                  </div>
                ) : (
                  trapPlayers.map(p => {
                    const participation = Number(p.participation) || 2;
                    const bearScore = ((Number(p.power) || 0) * participation).toFixed(0);
                    const assignedGroup = playerGroupMap[p.id];

                    return (
                      <div key={p.id} onClick={() => togglePresence(p.id)} className={`flex justify-between items-center p-3 rounded-lg cursor-pointer transition-all border ${p.isParticipating ? 'bg-slate-800/80 border-emerald-500/50 shadow-md' : 'bg-slate-900/30 border-transparent hover:border-slate-700 opacity-60'}`}>
                        <div className="flex flex-col min-w-0 pr-2">
                          <div className="flex items-center gap-2">
                            {p.isParticipating && assignedGroup && (
                              <span className="bg-fuchsia-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded shadow">
                                Gr.{assignedGroup}
                              </span>
                            )}
                            <span className={`font-black text-sm truncate ${p.isParticipating ? 'text-white' : 'text-slate-400'}`}>{p.name}</span>
                            <span className="text-xs font-mono text-cyan-400 font-bold">{p.power || 0}M</span>
                          </div>
                          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mt-1">
                            Score: <span className="text-amber-400">{bearScore}</span> <span className="mx-1">•</span> Pos: <span className="text-cyan-300">{p.x ?? '?'},{p.y ?? '?'}</span>
                            {p.backupX !== undefined && p.backupX !== '' && (
                              <span className="text-slate-500 ml-1">(Ex: {p.backupX},{p.backupY})</span>
                            )}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <select
                            value={participation}
                            onChange={(e) => updateParticipation(e, p.id, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-slate-900 border border-slate-700 text-amber-300 text-[10px] font-black rounded px-2 py-1.5 outline-none focus:border-amber-500 cursor-pointer"
                          >
                            <option value={1}>1x (Saltuario)</option>
                            <option value={2}>2x (Regolare)</option>
                            <option value={3}>3x (Assiduo)</option>
                          </select>

                          <div className={`w-14 py-1.5 rounded-md text-center text-[10px] font-black uppercase tracking-wider shadow-inner transition-colors ${p.isParticipating ? 'bg-emerald-500 text-slate-950' : 'bg-slate-950 text-slate-600 border border-slate-800'}`}>
                            {p.isParticipating ? 'Online' : 'Offline'}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* COLONNA DESTRA: MOTORE E GRUPPI */}
            <div className="flex flex-col gap-4">
              <div className="border-b border-slate-800 pb-3">
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <span className="text-fuchsia-500">Step 3:</span> Bilanciamento Ondate
                </h3>
                <p className="text-xs text-slate-400 mt-1">I giocatori più forti vengono spalmati nei gruppi A-E per mantenere costante il danno ogni minuto.</p>
              </div>
              
              <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl flex flex-col gap-4 shadow-lg">
                <div className="flex items-center justify-between bg-slate-900 p-3.5 rounded-xl border border-slate-700 shadow-inner">
                  <div className="flex flex-col">
                    <span className="text-white font-black text-xs uppercase">Limite Truppe per Joiner</span>
                    <span className="text-[11px] text-slate-400">Consigliato: 100.000 per massimizzare il numero di partecipanti.</span>
                  </div>
                  <input type="number" step="5000" value={troopCap} onChange={(e) => setTroopCap(Number(e.target.value))} className="bg-slate-950 border border-slate-700 text-fuchsia-300 font-black text-base rounded-lg px-3 py-2 outline-none w-28 text-center focus:border-fuchsia-500 transition-colors shadow-inner"/>
                </div>

                {waveGroups.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                    {waveGroups.map(g => (
                      <div key={g.label} className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 flex flex-col items-center text-center">
                        <span className="text-[10px] font-black uppercase text-fuchsia-400">Gruppo {g.label}</span>
                        <span className="text-xs font-bold text-white mt-0.5">Min {g.startCountdownMin}:00</span>
                        <span className="text-[10px] text-slate-400 mt-1">{g.members.length} ply • {g.totalPower.toFixed(0)}M</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {!isSetupComplete ? (
                <button disabled className="w-full py-4 bg-slate-800 text-rose-400 font-black tracking-widest uppercase rounded-xl border border-rose-900/50 cursor-not-allowed flex items-center justify-center gap-2 text-xs">
                  <span>⚠️</span> Coordinate Trappola {selectedTrap} non presenti
                </button>
              ) : onlineCount === 0 ? (
                <button disabled className="w-full py-4 bg-slate-800 text-amber-400 font-black tracking-widest uppercase rounded-xl border border-amber-900/50 cursor-not-allowed flex items-center justify-center gap-2 text-xs">
                  <span>⚠️</span> Segna almeno 1 giocatore Online nello Step 2
                </button>
              ) : (
                <button onClick={handleGenerate} className="w-full py-4 bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-500 hover:to-indigo-500 text-white font-black tracking-widest uppercase rounded-xl shadow-[0_0_20px_rgba(192,38,211,0.4)] transition-all transform hover:scale-[1.01] active:scale-95 text-xs">
                  🚀 Genera Tabella Turni (5 Rally Garantiti)
                </button>
              )}

              <div className="relative flex-1 min-h-[220px] mt-1">
                <textarea readOnly value={output} placeholder="Premi il pulsante sopra per generare i gruppi A-E e gli orari dei 5 cicli..." className="absolute inset-0 w-full h-full bg-[#050505] border border-slate-800 rounded-xl p-4 text-xs font-mono text-fuchsia-200 focus:outline-none custom-scrollbar resize-none shadow-inner" />
              </div>

              {output && (
                <button onClick={() => { navigator.clipboard.writeText(output); alert("Copiato negli appunti!"); }} className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase rounded-xl transition-colors border border-slate-700 flex items-center justify-center gap-2">
                  <span>📋</span> Copia Istruzioni per Discord / Chat Alleanza
                </button>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: SIMULATORE LOGISTICO */}
        {activeTab === 'simulator' && (
          <div className="p-6 md:p-8 flex flex-col gap-8 animate-in fade-in zoom-in-95 duration-300">
            <div className="bg-cyan-950/20 border border-cyan-900/50 p-4 rounded-xl">
              <h3 className="text-cyan-400 font-black text-sm uppercase mb-1">Verifica della Soglia dei 5 Rally</h3>
              <p className="text-slate-300 text-xs leading-relaxed">
                Verifica se la posizione attuale o ipotetica consente al giocatore di completare tutti e 5 i raduni entro i 30 minuti.
              </p>
            </div>

            <div className="flex flex-col md:flex-row gap-8">
              <div className="flex-1 bg-slate-950 border border-slate-800 p-6 rounded-2xl shadow-lg relative">
                <h3 className="text-white font-black text-sm uppercase tracking-widest border-b border-slate-800 pb-3 mb-5 flex items-center gap-2">
                  <span className="text-cyan-500">A.</span> Scegli Membro
                </h3>
                <select 
                  value={simPlayerId} 
                  onChange={(e) => { setSimPlayerId(e.target.value); setHypoX(''); setHypoY(''); }} 
                  className="w-full bg-slate-900 border border-slate-700 text-white font-bold rounded-xl px-4 py-3 outline-none cursor-pointer focus:border-cyan-500 transition-colors shadow-inner"
                >
                  <option value="">-- Seleziona dal Roster --</option>
                  {trapPlayers.map(p => <option key={p.id} value={p.id}>{p.name} (X:{p.x ?? '?'} Y:{p.y ?? '?'})</option>)}
                </select>
              </div>

              <div className="flex-1 bg-slate-950 border border-cyan-500/30 p-6 rounded-2xl shadow-[0_0_30px_rgba(6,182,212,0.1)] relative overflow-hidden">
                <h3 className="text-white font-black text-sm uppercase tracking-widest border-b border-slate-800 pb-3 mb-5 flex items-center gap-2 relative z-10">
                  <span className="text-cyan-500">B.</span> Proponi Posizione nell'Hive
                </h3>
                
                <div className="flex gap-4 relative z-10">
                  <div className="flex flex-col gap-1 w-full">
                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Nuova X (Ipotetica)</label>
                    <input type="number" value={hypoX} onChange={(e) => setHypoX(e.target.value)} disabled={!simPlayer} placeholder={trapX ? String(Number(trapX) - 2) : "000"} className="bg-slate-900 border border-slate-700 text-cyan-300 font-mono text-lg font-bold rounded-xl px-4 py-3 outline-none focus:border-cyan-500 w-full disabled:opacity-50 transition-colors shadow-inner"/>
                  </div>
                  <div className="flex flex-col gap-1 w-full">
                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Nuova Y (Ipotetica)</label>
                    <input type="number" value={hypoY} onChange={(e) => setHypoY(e.target.value)} disabled={!simPlayer} placeholder={trapY ? String(Number(trapY) + 2) : "000"} className="bg-slate-900 border border-slate-700 text-amber-300 font-mono text-lg font-bold rounded-xl px-4 py-3 outline-none focus:border-amber-500 w-full disabled:opacity-50 transition-colors shadow-inner"/>
                  </div>
                </div>
              </div>
            </div>

            {simPlayer && isSetupComplete && simPlayer.x !== '' && simPlayer.y !== '' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-2">
                <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 flex flex-col text-left shadow-lg">
                  <div className="flex justify-between items-start mb-6">
                    <h4 className="text-slate-400 font-black text-xs uppercase tracking-widest">Situazione Attuale (Gruppo {playerGroupMap[simPlayer.id] || 'A'})</h4>
                    <span className="bg-slate-800 text-slate-400 text-[10px] font-bold px-2 py-1 rounded">Marcia: {currentTravelTime}s</span>
                  </div>
                  <div className="text-center mb-6">
                    <div className={`text-5xl font-black mb-2 ${currentMaxRallies >= 5 ? 'text-emerald-400' : 'text-amber-400'}`}>{currentMaxRallies}/5 <span className="text-xl text-slate-500 font-bold">Raduni</span></div>
                    <p className="text-xs text-slate-400 uppercase tracking-widest">Completabili nel suo turno</p>
                  </div>
                  <div className="w-full bg-slate-950 rounded-xl p-4 border border-slate-800 text-xs text-slate-300 font-mono space-y-2 shadow-inner">
                    <div className="flex justify-between items-center"><span className="text-slate-500">Preparazione Raduno:</span> <span className="text-amber-400 font-bold">240s</span></div>
                    <div className="flex justify-between items-center"><span className="text-slate-500">Viaggio Andata/Ritorno:</span> <span className="text-cyan-400 font-bold">{currentTravelTime * 2}s</span></div>
                    <div className="flex justify-between items-center border-t border-slate-800 mt-2 pt-2 text-sm"><span className="font-bold text-white">Durata Ciclo Singolo:</span> <span className="text-white font-black">{currentCycleTime}s</span></div>
                  </div>
                </div>

                <div className={`rounded-2xl p-6 flex flex-col text-left transition-all duration-500 ${hypoX && hypoY ? 'bg-emerald-950/30 border-2 border-emerald-500 shadow-[0_0_40px_rgba(16,185,129,0.2)]' : 'bg-slate-900/50 border border-slate-800 opacity-50 grayscale'}`}>
                  <div className="flex justify-between items-start mb-6">
                    <h4 className={`font-black text-xs uppercase tracking-widest ${hypoX && hypoY ? 'text-emerald-400' : 'text-slate-500'}`}>Proiezione Nuova Posizione</h4>
                    {hypoX && hypoY && <span className="bg-emerald-900/50 text-emerald-300 text-[10px] font-bold px-2 py-1 rounded border border-emerald-500/30">Nuova Marcia: {hypoTravelTime}s</span>}
                  </div>
                  {hypoX && hypoY ? (
                    <>
                      <div className="text-center mb-6">
                        <div className="text-5xl font-black text-emerald-400 mb-2">{hypoMaxRallies}/5 <span className="text-xl text-emerald-600/50 font-bold">Raduni</span></div>
                        <p className="text-xs text-emerald-300/70 uppercase tracking-widest">Completabili nel suo turno</p>
                      </div>
                      <div className="w-full bg-slate-950/80 rounded-xl p-4 border border-emerald-900/50 text-xs text-slate-300 font-mono space-y-2 shadow-inner">
                        <div className="flex justify-between items-center"><span className="text-emerald-300">Nuovo Viaggio A/R:</span> <span className="text-emerald-400 font-bold">{hypoTravelTime * 2}s</span></div>
                        <div className="flex justify-between items-center border-t border-emerald-900/50 mt-2 pt-2 text-sm"><span className="font-bold text-emerald-100">Nuovo Ciclo Singolo:</span> <span className="text-emerald-400 font-black">{hypoCycleTime}s</span></div>
                      </div>
                      <div className="mt-auto pt-6">
                        {ralliesGained > 0 ? (
                          <div className="px-4 py-3 bg-emerald-500 text-slate-950 font-black text-sm uppercase rounded-xl shadow-lg w-full text-center">
                            🔥 Guadagno: +{ralliesGained} Raduno Guidato!
                          </div>
                        ) : (
                          <div className="px-4 py-3 bg-slate-800 text-slate-300 font-black text-xs uppercase rounded-xl border border-slate-700 w-full text-center">
                            ✅ {hypoMaxRallies === 5 ? 'Tutti e 5 i raduni sono garantiti!' : 'Avvicinati ancora per sbloccare il 5° raduno.'}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                      <p className="text-sm text-slate-500 italic">Inserisci Nuova X e Nuova Y per confrontare i cicli.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}