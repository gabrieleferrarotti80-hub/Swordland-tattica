import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';

export function useMapData({
  roster, allianceCode, userRole, allianceRole, eventMode, targetKingdom,
  isReadOnly, t, INITIAL_BUILDINGS, DEFAULT_STRUCTURES, DEMO_STRUCTURES, DEMO_OVERRIDES, DEMO_ROSTER
}) {
  const [megaRoster, setMegaRoster] = useState([]);
  const [isLoadingCloud, setIsLoadingCloud] = useState(false);
  const [isSavingSim, setIsSavingSim] = useState(false);

  const [fixedBuildings, setFixedBuildings] = useState(INITIAL_BUILDINGS);
  const [allianceStructures, setAllianceStructures] = useState(DEFAULT_STRUCTURES);
  const [enemyHQs, setEnemyHQs] = useState([]);
  const [allianceMeta, setAllianceMeta] = useState({ kingdom: '', tag: '' });

  const [playerOverrides, setPlayerOverrides] = useState({});
  const [tacticalMeta, setTacticalMeta] = useState({ eventName: '', date: '', time: '', targetBuilding: '', notes: '' });
  const [hiveGridMeta, setHiveGridMeta] = useState({ centerX: 500, centerY: 500, radius: 30, showGrid: true, territory: [] });
  const [loadedMarches, setLoadedMarches] = useState(null);

  useEffect(() => {
    if (allianceCode === 'DEMO') {
      setAllianceStructures(DEMO_STRUCTURES);
      setPlayerOverrides(DEMO_OVERRIDES);
      setHiveGridMeta(prev => ({ ...prev, centerX: 800, centerY: 800, radius: 25 }));
      setTacticalMeta(prev => ({ ...prev, participants: ['d1', 'd2', 'd3'] }));
    } else {
      setAllianceStructures(DEFAULT_STRUCTURES);
    }
  }, [allianceCode, DEMO_STRUCTURES, DEMO_OVERRIDES, DEFAULT_STRUCTURES]);

  // 1. MOTORE MEGA ROSTER (Battaglia Castello)
  useEffect(() => {
    if (eventMode === 'castle_battle' && targetKingdom) {
      const fetchMegaRoster = async () => {
        setIsLoadingCloud(true);
        try {
          let combinedPlayers = [];
          
          const snap1 = await getDocs(collection(db, "rosters"));
          snap1.docs.forEach(doc => {
            const docId = doc.id;
            if (docId.startsWith(`${targetKingdom}_`)) {
              const tag = docId.split('_')[1];
              const players = doc.data().players || [];
              
              players.forEach((p, index) => combinedPlayers.push({ 
                ...p, 
                id: `${tag}-${p.id}-idx${index}`, 
                originalTag: tag, 
                name: p.name // 💡 FIX: Ora passiamo solo il nome pulito senza aggiungere il tag!
              }));
            }
          });

          const snap2 = await getDocs(collection(db, "allianceRoster"));
          snap2.docs.forEach(doc => {
            const docId = doc.id;
            if (docId.startsWith(`${targetKingdom}_`) && !snap1.docs.find(d => d.id === docId)) {
              const tag = docId.split('_')[1];
              const players = doc.data().players || [];
              
              players.forEach((p, index) => combinedPlayers.push({ 
                ...p, 
                id: `${tag}-${p.id}-idx${index}`, 
                originalTag: tag, 
                name: p.name // 💡 FIX: Come sopra
              }));
            }
          });

          const uniquePlayers = Array.from(new Map(combinedPlayers.map(p => [p.id, p])).values());
          setMegaRoster(uniquePlayers);

          if (!isReadOnly) {
            alert(`⚔️ Modalità Simulatore Castello Avviata!\n\nTutti i ${uniquePlayers.length} giocatori del Regno ${targetKingdom} sono ora sul tavolo tattico.`);
          }
        } catch (error) {
          console.error("❌ [MEGA-ROSTER] Errore critico durante il caricamento:", error);
        } finally {
          setIsLoadingCloud(false);
        }
      };
      fetchMegaRoster();
    }
  }, [eventMode, targetKingdom, isReadOnly, db]);

  // 2. MOTORE DATI MAPPA
  useEffect(() => {
    const fetchMapData = async () => {
      setIsLoadingCloud(true);
      try {
        let baseBuildings = [...INITIAL_BUILDINGS];
        const baseSnap = await getDoc(doc(db, "mapSettings", "fixedBuildings"));
        if (baseSnap.exists() && baseSnap.data().buildings) {
          const cloudData = baseSnap.data().buildings;
          baseBuildings = baseBuildings.map(baseB => {
            const cb = cloudData.find(c => c.id === baseB.id);
            return cb ? { ...baseB, ...cb } : baseB;
          });
          const customB = cloudData.filter(cb => !INITIAL_BUILDINGS.some(b => b.id === cb.id));
          baseBuildings = [...baseBuildings, ...customB];
        }

        if (userRole === 'alliance' || userRole === 'admin' || userRole === 'consulente') {
          if (allianceCode && allianceCode !== 'DEMO') {
            const allianceSnap = await getDoc(doc(db, "allianceMapData", allianceCode));
            if (allianceSnap.exists()) {
              const data = allianceSnap.data();
              if (data.buildings) baseBuildings = baseBuildings.map(baseB => { const ab = data.buildings.find(a => a.id === baseB.id); return ab ? { ...baseB, ...ab } : baseB; });
              if (data.allianceStructures?.length > 0) setAllianceStructures(data.allianceStructures);
              if (data.hivePositions && eventMode !== 'castle_battle') setPlayerOverrides(prev => ({...prev, ...data.hivePositions}));
              if (data.hiveGridMeta) setHiveGridMeta(data.hiveGridMeta);
            }
          }
        }
        setFixedBuildings(baseBuildings);
      } catch (error) { console.error("Errore MapData:", error); } 
      finally { setIsLoadingCloud(false); }
    };
    fetchMapData();
  }, [userRole, allianceCode, INITIAL_BUILDINGS, eventMode]);

  // 3. ENEMY HQs
  useEffect(() => {
    if (allianceMeta.kingdom && allianceMeta.tag) {
      const fetchHQs = async () => {
        try {
          const docRef = doc(db, "enemyHQs", `${allianceMeta.kingdom}_${allianceMeta.tag}`);
          const snap = await getDoc(docRef);
          if (snap.exists()) setEnemyHQs(snap.data().hqs || []);
          else setEnemyHQs([]); 
        } catch (error) { console.error("Errore HQs:", error); }
      };
      fetchHQs();
    }
  }, [allianceMeta.kingdom, allianceMeta.tag]);

  // 4. SIMULATION
  useEffect(() => {
    const fetchSimulation = async () => {
      let simDocId = `${allianceCode}_tacticalPlan`;
      if (eventMode === 'castle_battle' && targetKingdom) {
        simDocId = `castle_${targetKingdom}_tacticalPlan`;
      } else if (!allianceCode || allianceCode === 'DEMO') {
        return;
      }

      try {
        const docSnap = await getDoc(doc(db, "simulations", simDocId));
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.overrides) setPlayerOverrides(prev => ({...prev, ...data.overrides}));
          if (data.marches) setLoadedMarches(data.marches);
          if (data.tacticalMeta) setTacticalMeta({ ...data.tacticalMeta, author: data.author }); 
        }
      } catch (error) { console.error("Errore Sim:", error); }
    };
    fetchSimulation();
  }, [allianceCode, eventMode, targetKingdom]);

  // HANDLERS Database
  const handleSaveMapToCloud = async (activeView) => {
    if (isReadOnly || eventMode === 'castle_battle') return alert("Salvataggio Mappa disabilitato durante l'evento Battaglia Castello.");
    if (userRole === 'guest' || (allianceCode === 'DEMO' && !['admin','consulente'].includes(userRole) && allianceRole !== 'officer')) return alert(t('map.sandbox_action_denied'));
    setIsLoadingCloud(true);
    try {
      if (activeView === 'alliance' && allianceCode) {
        await setDoc(doc(db, "allianceMapData", allianceCode), { buildings: fixedBuildings, allianceStructures, hivePositions: playerOverrides, hiveGridMeta }, { merge: true });
        alert(t('map.alliance_map_saved', { code: allianceCode }));
      } else if (userRole === 'admin' || userRole === 'consulente') {
        await setDoc(doc(db, "mapSettings", "fixedBuildings"), { buildings: fixedBuildings }, { merge: true });
        alert(t('map.global_map_updated'));
      }
    } catch (error) { alert(t('map.map_save_error')); }
    setIsLoadingCloud(false);
  }; 

 const handleSaveSimulation = async (marches) => {
    if (isReadOnly) return alert(t('map.read_only_alert'));
    if (userRole === 'guest' || (allianceCode === 'DEMO' && !['admin','consulente'].includes(userRole) && allianceRole !== 'officer')) return alert(t('map.sandbox_action_denied'));
    
    let simDocId = `${allianceCode}_tacticalPlan`;
    let successMsg = t('map.tactical_plan_saved', { code: allianceCode });

    if (eventMode === 'castle_battle' && targetKingdom) {
      simDocId = `castle_${targetKingdom}_tacticalPlan`;
      successMsg = `Simulazione Battaglia Castello (Regno ${targetKingdom}) salvata con successo!`;
    } else if (!allianceCode) {
      return alert(t('map.no_alliance_selected'));
    }
    
    setIsSavingSim(true);
    try {
      // 💡 TRUCCO FIREBASE: Converte l'oggetto in JSON e lo ricrea. 
      // Questo distrugge istantaneamente qualsiasi variabile "undefined" che manderebbe in crash il database!
      const payload = JSON.parse(JSON.stringify({ 
        overrides: playerOverrides || {}, 
        marches: marches || null, 
        tacticalMeta: tacticalMeta || {}, 
        author: (userRole || 'UNKNOWN').toUpperCase(), // 💡 Fix se per caso userRole non era stato caricato
        timestamp: new Date().toISOString()
      }));

      await setDoc(doc(db, "simulations", simDocId), payload, { merge: true });
      alert(successMsg);
    } catch (error) { 
      // 💡 ORA l'errore verrà stampato a caratteri cubitali!
      console.error("🚨 ERRORE CRITICO CLOUD:", error);
      alert(`Salvataggio fallito. Dettaglio:\n\n${error.message}`); 
    }
    setIsSavingSim(false);
  };

  const handleBuildingChange = (id, field, value) => {
    if (isReadOnly) return;
    const val = (field === 'x' || field === 'y') ? (value === '' ? '' : Number(value)) : value;
    setFixedBuildings(prev => prev.map(b => b.id === id ? { ...b, [field]: val } : b));
  };
  const handleAddBuilding = () => {
    if (isReadOnly) return;
    setFixedBuildings(prev => [{ id: `custom-${Date.now()}`, code: 'NEW', name: 'Nuovo Edificio', type: 'others', x: 500, y: 500, occupiedBy: '' }, ...prev]);
  };
  const handleDeleteBuilding = (id) => {
    if (isReadOnly) return;
    setFixedBuildings(prev => prev.filter(b => b.id !== id));
  };
  const handleAllianceStructureChange = (id, field, value) => {
    if (isReadOnly) return;
    setAllianceStructures(prev => prev.map(s => s.id === id ? { ...s, [field]: value === '' ? '' : Number(value) } : s));
  };
  const handleAddHQ = async (newHQ) => {
    if (isReadOnly) return alert(t('map.read_only_alert'));
    const updated = [...enemyHQs, { id: `enemy-${Date.now()}`, ...newHQ, type: 'enemyHQ' }];
    setEnemyHQs(updated);
    if (allianceMeta.kingdom && allianceMeta.tag) await setDoc(doc(db, "enemyHQs", `${allianceMeta.kingdom}_${allianceMeta.tag}`), { hqs: updated });
  };
  const handleRemoveHQ = async (id) => {
    if (isReadOnly) return alert(t('map.read_only_alert'));
    const updated = enemyHQs.filter(hq => hq.id !== id);
    setEnemyHQs(updated);
    if (allianceMeta.kingdom && allianceMeta.tag) await setDoc(doc(db, "enemyHQs", `${allianceMeta.kingdom}_${allianceMeta.tag}`), { hqs: updated });
  };

  const effectiveRoster = eventMode === 'castle_battle' 
    ? megaRoster 
    : (allianceCode === 'DEMO' && (!roster || roster.length === 0) ? DEMO_ROSTER : roster);

  return {
    effectiveRoster, isLoadingCloud, isSavingSim,
    fixedBuildings, setFixedBuildings, handleBuildingChange, handleAddBuilding, handleDeleteBuilding,
    allianceStructures, setAllianceStructures, handleAllianceStructureChange,
    enemyHQs, setEnemyHQs, handleAddHQ, handleRemoveHQ,
    playerOverrides, setPlayerOverrides,
    tacticalMeta, setTacticalMeta,
    hiveGridMeta, setHiveGridMeta,
    allianceMeta, setAllianceMeta,
    loadedMarches, handleSaveMapToCloud, handleSaveSimulation
  };
}