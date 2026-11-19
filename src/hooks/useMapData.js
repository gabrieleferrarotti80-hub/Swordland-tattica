import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';

export function useMapData({
  roster, allianceCode, userRole, allianceRole, eventMode, targetKingdom,
  isReadOnly, isSharedLink, t, INITIAL_BUILDINGS, DEFAULT_STRUCTURES, DEMO_STRUCTURES, DEMO_OVERRIDES, DEMO_ROSTER
}) {
  const [megaRoster, setMegaRoster] = useState([]);
  const [sharedRoster, setSharedRoster] = useState([]);
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

  const [globalResourceZones, setGlobalResourceZones] = useState([]);

  // Ref per garantire che il salvataggio legga sempre lo stato più recente (anche dopo blur/setTimeout)
  const latestStateRef = useRef({
    allianceStructures,
    hiveGridMeta,
    playerOverrides,
    fixedBuildings,
    globalResourceZones
  });

  useEffect(() => {
    latestStateRef.current = {
      allianceStructures,
      hiveGridMeta,
      playerOverrides,
      fixedBuildings,
      globalResourceZones
    };
  }, [allianceStructures, hiveGridMeta, playerOverrides, fixedBuildings, globalResourceZones]);

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

  useEffect(() => {
    if (eventMode === 'castle_battle' && targetKingdom) {
      const fetchMegaRoster = async () => {
        setIsLoadingCloud(true);
        try {
          let combinedPlayers = [];

          const snap1 = await getDocs(collection(db, "rosters"));
          snap1.docs.forEach(docSnap => {
            const docId = docSnap.id;
            if (docId.startsWith(`${targetKingdom}_`)) {
              const tag = docId.split('_')[1];
              const players = docSnap.data().players || [];
              players.forEach((p, index) => combinedPlayers.push({ ...p, id: `${tag}-${p.id}-idx${index}`, originalTag: tag, name: p.name }));
            }
          });

          const snap2 = await getDocs(collection(db, "allianceRoster"));
          snap2.docs.forEach(docSnap => {
            const docId = docSnap.id;
            if (docId.startsWith(`${targetKingdom}_`) && !snap1.docs.find(d => d.id === docId)) {
              const tag = docId.split('_')[1];
              const players = docSnap.data().players || [];
              players.forEach((p, index) => combinedPlayers.push({ ...p, id: `${tag}-${p.id}-idx${index}`, originalTag: tag, name: p.name }));
            }
          });

          const uniquePlayers = Array.from(new Map(combinedPlayers.map(p => [p.id, p])).values());
          setMegaRoster(uniquePlayers);
        } catch (error) {
          console.error("❌ [MEGA-ROSTER] Errore critico:", error);
        } finally {
          setIsLoadingCloud(false);
        }
      };
      fetchMegaRoster();
    }
  }, [eventMode, targetKingdom, isReadOnly]);

  // Caricamento automatico del roster da Cloud quando si apre un link condiviso senza dati locali
 useEffect(() => {
    const hasLocalRoster = Array.isArray(roster) ? roster.length > 0 : (roster?.players?.length > 0);
    if (eventMode === 'castle_battle' || (!isSharedLink && hasLocalRoster) || !allianceCode || allianceCode === 'DEMO') return;

    const fetchSharedRoster = async () => {
      try {
        let snap = await getDoc(doc(db, "rosters", allianceCode));
        if (!snap.exists()) {
          snap = await getDoc(doc(db, "allianceRoster", allianceCode));
        }
        if (snap.exists() && Array.isArray(snap.data().players)) {
          setSharedRoster(snap.data().players);
        }
      } catch (error) {
        console.error("Errore caricamento roster condiviso:", error);
      }
    };
    fetchSharedRoster();
  }, [allianceCode, roster, eventMode, isSharedLink]);

  useEffect(() => {
    const fetchMapData = async () => {
      setIsLoadingCloud(true);
      try {
        let baseBuildings = [];
        const baseSnap = await getDoc(doc(db, "mapSettings", "fixedBuildings"));

        if (baseSnap.exists() && baseSnap.data().buildings && baseSnap.data().buildings.length > 0) {
          baseBuildings = baseSnap.data().buildings;
          if (baseSnap.data().resourceZones) setGlobalResourceZones(baseSnap.data().resourceZones);
        } else {
          baseBuildings = [...INITIAL_BUILDINGS];
        }

        if (allianceCode && allianceCode !== 'DEMO') {
          const allianceSnap = await getDoc(doc(db, "allianceMapData", allianceCode));
          if (allianceSnap.exists()) {
            const data = allianceSnap.data();

            if (data.allianceStructures?.length > 0) {
              setAllianceStructures(prev => {
                return data.allianceStructures.map(cloudStruct => {
                  const localMatch = prev.find(p => p.id === cloudStruct.id);
                  return localMatch && localMatch.x !== DEFAULT_STRUCTURES.find(d => d.id === localMatch.id)?.x
                    ? localMatch : cloudStruct;
                });
              });
            }

            if (data.hivePositions && eventMode !== 'castle_battle') {
              setPlayerOverrides(prev => ({ ...prev, ...data.hivePositions }));
            }
            if (data.hiveGridMeta) setHiveGridMeta(data.hiveGridMeta);
          }
        }
        setFixedBuildings(baseBuildings);
      } catch (error) {
        console.error("Errore MapData:", error);
      } finally {
        setIsLoadingCloud(false);
      }
    };
    fetchMapData();
  }, [userRole, allianceCode, INITIAL_BUILDINGS, DEFAULT_STRUCTURES, eventMode]);

  useEffect(() => {
    if (allianceMeta.kingdom && allianceMeta.tag) {
      const fetchHQs = async () => {
        try {
          const docRef = doc(db, "enemyHQs", `${allianceMeta.kingdom}_${allianceMeta.tag}`);
          const snap = await getDoc(docRef);
          if (snap.exists()) setEnemyHQs(snap.data().hqs || []);
          else setEnemyHQs([]);
        } catch (error) {
          console.error("Errore HQs:", error);
        }
      };
      fetchHQs();
    }
  }, [allianceMeta.kingdom, allianceMeta.tag]);

  useEffect(() => {
    const fetchSimulation = async () => {
      let simDocId = `${allianceCode}_tacticalPlan`;
      if (eventMode === 'castle_battle' && targetKingdom) simDocId = `castle_${targetKingdom}_tacticalPlan`;
      else if (!allianceCode || allianceCode === 'DEMO') return;

      try {
        const docSnap = await getDoc(doc(db, "simulations", simDocId));
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.overrides) setPlayerOverrides(prev => ({ ...prev, ...data.overrides }));
          if (data.marches) setLoadedMarches(data.marches);
          if (data.tacticalMeta) setTacticalMeta({ ...data.tacticalMeta, author: data.author });
        }
      } catch (error) {
        console.error("Errore Sim:", error);
      }
    };
    fetchSimulation();
  }, [allianceCode, eventMode, targetKingdom]);

  // STABILIZZAZIONE DELLE FUNZIONI CON USECALLBACK
  const handleSaveMapToCloud = useCallback(async (activeView) => {
    if (isReadOnly || eventMode === 'castle_battle') return;
    setIsLoadingCloud(true);
    try {
      const latest = latestStateRef.current;

      if (activeView === 'alliance' && allianceCode) {
        await setDoc(doc(db, "allianceMapData", allianceCode), {
          allianceStructures: latest.allianceStructures,
          hiveGridMeta: latest.hiveGridMeta,
          hivePositions: latest.playerOverrides || {}
        }, { merge: true });
        alert("✅ Alveare salvato in Cloud!");
      } else if (userRole === 'admin' || userRole === 'consulente') {
        await setDoc(doc(db, "mapSettings", "fixedBuildings"), {
          buildings: latest.fixedBuildings,
          resourceZones: latest.globalResourceZones
        }, { merge: true });
        alert("✅ Mappa globale salvata in Cloud!");
      }
    } catch (error) {
      console.error("Errore salvataggio Cloud:", error);
      alert("❌ Errore durante il salvataggio in Cloud.");
    } finally {
      setIsLoadingCloud(false);
    }
  }, [isReadOnly, eventMode, allianceCode, userRole]);

  const handleSaveSimulation = useCallback(async (marches) => {
    if (isReadOnly) return;
    let simDocId = `${allianceCode}_tacticalPlan`;
    if (eventMode === 'castle_battle' && targetKingdom) simDocId = `castle_${targetKingdom}_tacticalPlan`;
    else if (!allianceCode) return;

    setIsSavingSim(true);
    try {
      const payload = JSON.parse(JSON.stringify({
        overrides: playerOverrides || {},
        marches: marches || null,
        tacticalMeta: tacticalMeta || {},
        author: (userRole || 'UNKNOWN').toUpperCase(),
        timestamp: new Date().toISOString()
      }));
      await setDoc(doc(db, "simulations", simDocId), payload, { merge: true });
    } catch (error) {
      console.error("Errore salvataggio simulazione:", error);
    } finally {
      setIsSavingSim(false);
    }
  }, [isReadOnly, allianceCode, eventMode, targetKingdom, playerOverrides, tacticalMeta, userRole]);

  const handleBuildingChange = useCallback((id, field, value) => {
    if (isReadOnly) return;
    const val = (field === 'x' || field === 'y') ? (value === '' ? '' : Number(value)) : value;
    setFixedBuildings(prev => prev.map(b => b.id === id ? { ...b, [field]: val } : b));
  }, [isReadOnly]);

  const handleAddBuilding = useCallback(() => {
    if (isReadOnly) return;
    setFixedBuildings(prev => [{ id: `custom-${Date.now()}`, code: 'NEW', name: 'Nuovo', type: 'others', x: 500, y: 500, occupiedBy: '' }, ...prev]);
  }, [isReadOnly]);

  const handleDeleteBuilding = useCallback((id) => {
    if (isReadOnly) return;
    setFixedBuildings(prev => prev.filter(b => b.id !== id));
  }, [isReadOnly]);

  const handleAllianceStructureChange = useCallback((id, field, value) => {
    if (isReadOnly) return;
    setAllianceStructures(prev => prev.map(s => s.id === id ? { ...s, [field]: value === '' ? '' : Number(value) } : s));
  }, [isReadOnly]);

  const handleAddHQ = useCallback(async (newHQ) => {
    if (isReadOnly) return;
    const updated = [...enemyHQs, { id: `enemy-${Date.now()}`, ...newHQ, type: 'enemyHQ' }];
    setEnemyHQs(updated);
    if (allianceMeta.kingdom && allianceMeta.tag) await setDoc(doc(db, "enemyHQs", `${allianceMeta.kingdom}_${allianceMeta.tag}`), { hqs: updated });
  }, [isReadOnly, enemyHQs, allianceMeta]);

  const handleRemoveHQ = useCallback(async (id) => {
    if (isReadOnly) return;
    const updated = enemyHQs.filter(hq => hq.id !== id);
    setEnemyHQs(updated);
    if (allianceMeta.kingdom && allianceMeta.tag) await setDoc(doc(db, "enemyHQs", `${allianceMeta.kingdom}_${allianceMeta.tag}`), { hqs: updated });
  }, [isReadOnly, enemyHQs, allianceMeta]);

 const hasLocalRoster = Array.isArray(roster) ? roster.length > 0 : (roster?.players?.length > 0);
  const effectiveRoster = eventMode === 'castle_battle'
    ? megaRoster
    : isSharedLink
      ? sharedRoster
      : (allianceCode === 'DEMO' && !hasLocalRoster
          ? DEMO_ROSTER
          : (hasLocalRoster ? roster : sharedRoster));

  return useMemo(() => ({
    effectiveRoster, isLoadingCloud, isSavingSim, globalResourceZones, setGlobalResourceZones,
    fixedBuildings, setFixedBuildings, handleBuildingChange, handleAddBuilding, handleDeleteBuilding,
    allianceStructures, setAllianceStructures, handleAllianceStructureChange, enemyHQs, setEnemyHQs,
    handleAddHQ, handleRemoveHQ, playerOverrides, setPlayerOverrides, tacticalMeta, setTacticalMeta,
    hiveGridMeta, setHiveGridMeta, allianceMeta, setAllianceMeta, loadedMarches,
    handleSaveMapToCloud, handleSaveSimulation
  }), [
    effectiveRoster, isLoadingCloud, isSavingSim, globalResourceZones, fixedBuildings,
    allianceStructures, enemyHQs, playerOverrides, tacticalMeta, hiveGridMeta, allianceMeta,
    loadedMarches, handleBuildingChange, handleAddBuilding, handleDeleteBuilding,
    handleAllianceStructureChange, handleAddHQ, handleRemoveHQ, handleSaveMapToCloud, handleSaveSimulation
  ]);
}