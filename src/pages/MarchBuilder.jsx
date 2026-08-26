import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { db } from '../firebase';
import { doc, setDoc, getDoc, collection, query, where, getDocs, arrayUnion } from 'firebase/firestore';
import { heroesDB, eventTypes } from '../data/heroes';

import HeroCollectionModal from '../components/march/HeroCollectionModal';
import MarchBuilderHeader from '../components/march/MarchBuilderHeader';
import MarchSettingsView from '../components/march/MarchSettingsView';
import MarchCreationView from '../components/march/MarchCreationView';
import MarchResultsView from '../components/march/MarchResultsView';
import MarchAnalysisView from '../components/march/MarchAnalysisView';
import AdminBuffsModal from '../components/march/AdminBuffsModal';
import AdminHeroesModal from '../components/march/AdminHeroesModal';
import MarchBuilderGuideModal from '../components/march/MarchBuilderGuideModal';

const TIERS = ['T11', 'T10', 'T9', 'T8', 'T7', 'T6', 'T5', 'T4', 'T3', 'T2', 'T1'];
const initialTiers = TIERS.reduce((acc, tier) => ({ ...acc, [tier]: 0 }), {});

const defaultRecState = { leader: { hero1: '', hero2: '', hero3: '', inf: 0, cav: 0, arc: 0 }, joiner: { heroA: '', heroB: '', heroC: '', heroD: '', heroE: '', heroF: '', maxTroops: 0, inf: 0, cav: 0, arc: 0 } };

export default function MarchBuilder({ auth }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  
  const [activeSection, setActiveSection] = useState('settings');
  const [selectedEvent, setSelectedEvent] = useState(eventTypes[0].id);
  const [isLoading, setIsLoading] = useState(false);
  const [showDemoGuide, setShowDemoGuide] = useState(false);

  const [totalTroops, setTotalTroops] = useState({ infantry: { ...initialTiers }, cavalry: { ...initialTiers }, archers: { ...initialTiers }});
  const [activeTab, setActiveTab] = useState('infantry');
  const [isArmyOpen, setIsArmyOpen] = useState(true); 
  const [globalCapacity, setGlobalCapacity] = useState({ 0: 0, 1: 0, 2: 0, 3: 0 });
  
  const [marches, setMarches] = useState([{ id: Date.now(), marchType: 'solo', customCapacity: 0, hero1: '', hero2: '', hero3: '', troopConfig: { mode: 'percent', manual: { inf: 0, cav: 0, arc: 0 }, percent: { inf: 0, cav: 0, arc: 0 } } }]);
  const [savedPresets, setSavedPresets] = useState({}); 
  const [playerBuffs, setPlayerBuffs] = useState({}); 
  const [buffsCatalog, setBuffsCatalog] = useState({}); 
  const [isAdminBuffsOpen, setIsAdminBuffsOpen] = useState(false);

  const [ownedHeroes, setOwnedHeroes] = useState({});
  const [isHeroModalOpen, setIsHeroModalOpen] = useState(false);
  
  const [allianceRecommendations, setAllianceRecommendations] = useState({});
  const [isEditingRec, setIsEditingRec] = useState(false);
  const [recForm, setRecForm] = useState(defaultRecState);

  const [isOfficer, setIsOfficer] = useState(auth?.role === 'admin' || auth?.role === 'consulente');
  const [playerRealRole, setPlayerRealRole] = useState(auth?.role === 'admin' || auth?.role === 'consulente' ? 'MASTER' : '');
  const [playerMaxMarches, setPlayerMaxMarches] = useState(7);
  const [activeAnimals, setActiveAnimals] = useState([]);

  const [indexedBuilds, setIndexedBuilds] = useState([]);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState("");
  const [snapshotResults, setSnapshotResults] = useState({ totalScore: 0, marches: {} });
  const [battleReports, setBattleReports] = useState([]);

  // 📌 STATI PER GLI EROI DINAMICI
  const [heroesCatalog, setHeroesCatalog] = useState([]);
  const [isAdminHeroesOpen, setIsAdminHeroesOpen] = useState(false);
const [isGuideOpen, setIsGuideOpen] = useState(false);

  useEffect(() => {
    if (auth?.code === 'DEMO' || auth?.code === 'DEMO2') {
      setShowDemoGuide(true);
      setIsOfficer(true);
      setPlayerRealRole('DEMO-R5');
      setTotalTroops({
        infantry: { ...initialTiers, T11: 50000, T10: 150000, T9: 100000 },
        cavalry: { ...initialTiers, T11: 40000, T10: 200000, T9: 100000 },
        archers: { ...initialTiers, T11: 80000, T10: 180000, T9: 100000 }
      });
      setGlobalCapacity({ 0: 50000, 1: 90000, 2: 130000, 3: 175000 });
      setMarches([{ id: 'demo_1', marchType: 'solo', customCapacity: 0, hero1: 'h_inf_1', hero2: 'h_cav_1', hero3: 'h_arc_1', troopConfig: { mode: 'percent', manual: { inf: 0, cav: 0, arc: 0 }, percent: { inf: 50, cav: 30, arc: 20 } } }]);
      setHeroesCatalog(heroesDB); 
    
    } else if (auth?.code && auth?.playerId) {
      const fetchData = async () => {
        try {
          const userSnap = await getDoc(doc(db, "playerMarches", `${auth.realm || 'Sconosciuto'}_${auth.code}_${auth.playerId}`));
          if (userSnap.exists()) {
            const data = userSnap.data();
            if (data.ownedHeroes) {
              if (Array.isArray(data.ownedHeroes)) {
                const migrated = {};
                data.ownedHeroes.forEach(id => { migrated[id] = { level: 1, stars: 0, power: 0, troopCapacity: 0, gear: { helmet: { level:0, power:0, isRed:false }, armor: { level:0, power:0, isRed:false }, gloves: { level:0, power:0, isRed:false }, boots: { level:0, power:0, isRed:false } }, exclusive: 0 }; });
                setOwnedHeroes(migrated);
              } else setOwnedHeroes(data.ownedHeroes);
            }
            if (data.totalTroops) setTotalTroops(data.totalTroops);
            if (data.globalCapacity) setGlobalCapacity(data.globalCapacity);
            if (data.marches && data.marches.length > 0) setMarches(data.marches);
            if (data.savedPresets) setSavedPresets(data.savedPresets);
            if (data.playerBuffs) setPlayerBuffs(data.playerBuffs);
            if (data.event) setSelectedEvent(data.event);
            if (data.activeAnimals) setActiveAnimals(data.activeAnimals);
            if (data.indexedBuilds) setIndexedBuilds(data.indexedBuilds);
            if (data.snapshotResultsDraft) setSnapshotResults(data.snapshotResultsDraft);
            if (data.selectedSnapshotIdDraft) setSelectedSnapshotId(data.selectedSnapshotIdDraft);
          }

          const reportsQuery = query(collection(db, "battleReports"), where("playerId", "==", auth.playerId));
          const reportsSnap = await getDocs(reportsQuery);
          const fetchedReports = [];
          reportsSnap.forEach(d => fetchedReports.push(d.data()));
          fetchedReports.sort((a, b) => new Date(b.date) - new Date(a.date));
          setBattleReports(fetchedReports);

          const settSnap = await getDoc(doc(db, "allianceSettings", auth.code));
          if (settSnap.exists() && settSnap.data().recommendations) setAllianceRecommendations(settSnap.data().recommendations);
          const masterBuffsSnap = await getDoc(doc(db, "systemSettings", "masterBuffs"));
          if (masterBuffsSnap.exists() && masterBuffsSnap.data().catalog) setBuffsCatalog(masterBuffsSnap.data().catalog);

          const heroesSnap = await getDoc(doc(db, "systemSettings", "heroesCatalog"));
          if (heroesSnap.exists() && heroesSnap.data().catalog) {
            setHeroesCatalog(heroesSnap.data().catalog);
          } else {
            console.log("Migrazione iniziale catalogo eroi in corso...");
            await setDoc(doc(db, "systemSettings", "heroesCatalog"), { catalog: heroesDB });
            setHeroesCatalog(heroesDB);
          }
        } catch (e) { console.error("Errore nel caricamento:", e); }
      };
      fetchData();
    }
  }, [auth]);

  const handleLoadTargetData = async (target) => {
    if (!target || !target.id) return;
    setIsLoading(true);
    try {
      const q = query(collection(db, "playerMarches"), where("playerId", "==", target.id), where("allianceCode", "==", target.alliance));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const data = querySnapshot.docs[0].data();
        if (data.globalCapacity) setGlobalCapacity(data.globalCapacity);
        if (data.totalTroops) setTotalTroops(data.totalTroops);
        if (data.marches) setMarches(data.marches);
        if (data.ownedHeroes) setOwnedHeroes(data.ownedHeroes);
        if (data.playerBuffs) setPlayerBuffs(data.playerBuffs);
        if (data.savedPresets) setSavedPresets(data.savedPresets);
        if (data.activeAnimals) setActiveAnimals(data.activeAnimals);
        if (data.indexedBuilds) setIndexedBuilds(data.indexedBuilds);
        if (data.snapshotResultsDraft) setSnapshotResults(data.snapshotResultsDraft);
        if (data.selectedSnapshotIdDraft) setSelectedSnapshotId(data.selectedSnapshotIdDraft);
        
        const repQ = query(collection(db, "battleReports"), where("playerId", "==", target.id));
        const repSnap = await getDocs(repQ);
        const fetchedRep = [];
        repSnap.forEach(d => fetchedRep.push(d.data()));
        fetchedRep.sort((a, b) => new Date(b.date) - new Date(a.date));
        setBattleReports(fetchedRep);

        alert(`✅ Dati di ${target.name} caricati con successo!`);
      } else alert(`⚠️ Nessun salvataggio trovato per ${target.name}.`);
    } catch (e) { alert('❌ Errore durante il caricamento dei dati.'); }
    setIsLoading(false);
  };

  const handleSaveProfile = async (customTarget = null) => {
    setIsLoading(true);
    const finalPlayerId = customTarget ? customTarget.id : auth.playerId;
    const finalPlayerName = customTarget ? customTarget.name : auth.playerName;
    const finalAlliance = customTarget ? customTarget.alliance : auth.code;
    const finalRealm = customTarget ? customTarget.regno : (auth.realm || 'Sconosciuto');

    try {
      await setDoc(doc(db, "playerMarches", `${finalRealm}_${finalAlliance}_${finalPlayerId}`), {
        allianceCode: finalAlliance, realm: finalRealm, playerId: finalPlayerId, playerName: finalPlayerName, 
        totalTroops, ownedHeroes, playerBuffs, globalCapacity, lastUpdated: new Date().toISOString(),
        snapshotResultsDraft: snapshotResults,
        selectedSnapshotIdDraft: selectedSnapshotId
      }, { merge: true });
      alert(customTarget ? `✅ Profilo base aggiornato per ${finalPlayerName}!` : `✅ Profilo e bozze salvati con successo!`);
    } catch (e) { alert('❌ Errore durante il salvataggio del profilo.'); }
    setIsLoading(false);
  };

  const handleIndexBuild = async (customTarget = null) => {
    const buildName = window.prompt("Dai un nome a questa configurazione tattica (es. 'Trappola Orso V1'):", "Nuova Configurazione");
    if (!buildName || buildName.trim() === '') return;
    setIsLoading(true);
    const finalPlayerId = customTarget ? customTarget.id : auth.playerId;
    const finalPlayerName = customTarget ? customTarget.name : auth.playerName;
    const finalAlliance = customTarget ? customTarget.alliance : auth.code;
    const finalRealm = customTarget ? customTarget.regno : (auth.realm || 'Sconosciuto');

    const newIndexedBuild = { 
      id: `build_${Date.now()}`, 
      name: buildName.trim(), 
      event: selectedEvent, 
      activeAnimals, 
      globalCapacity, 
      marches, 
      playerBuffs: { ...playerBuffs }, 
      createdAt: new Date().toISOString() 
    };

    try {
      await setDoc(doc(db, "playerMarches", `${finalRealm}_${finalAlliance}_${finalPlayerId}`), {
        allianceCode: finalAlliance, realm: finalRealm, playerId: finalPlayerId, playerName: finalPlayerName, 
        lastUpdated: new Date().toISOString(), indexedBuilds: arrayUnion(newIndexedBuild)
      }, { merge: true });
      
      setIndexedBuilds(prev => [...prev, newIndexedBuild]); 
      
      alert(customTarget ? `✅ Formazione indicizzata per ${finalPlayerName}!` : `✅ Formazione indicizzata nel tuo database! Vai in Risultati per analizzarla.`);
    } catch (e) { alert('❌ Errore durante l\'indicizzazione.'); }
    setIsLoading(false);
  };

  const handleResultUpdate = (marchId, field, value) => {
    setSnapshotResults(prev => ({
      ...prev,
      marches: { ...prev.marches, [marchId]: { ...(prev.marches[marchId] || {}), [field]: value } }
    }));
  };

  const handleTotalScoreUpdate = (value) => {
    setSnapshotResults(prev => ({ ...prev, totalScore: value }));
  };

  const handleArchiveResults = async () => {
    if (!selectedSnapshotId) return alert('Seleziona una formazione indicizzata dal menu!');
    const selectedSnapshot = indexedBuilds.find(b => b.id === selectedSnapshotId);
    if (!selectedSnapshot) return;

    setIsLoading(true);
    const reportId = `report_${Date.now()}`;
    const newReport = {
      id: reportId,
      playerId: auth.playerId,
      playerName: auth.playerName,
      allianceCode: auth.code,
      realm: auth.realm || 'Sconosciuto',
      snapshotId: selectedSnapshot.id,
      buildName: selectedSnapshot.name,
      date: new Date().toISOString(),
      event: selectedSnapshot.event,
      totalScore: snapshotResults.totalScore || 0,
      marchesResults: snapshotResults.marches || {},
      snapshotData: selectedSnapshot,
      playerBuffsAtReport: selectedSnapshot.playerBuffs || { ...playerBuffs }
    };

    try {
      await setDoc(doc(db, "battleReports", reportId), newReport);
      
      setBattleReports(prev => [newReport, ...prev].sort((a, b) => new Date(b.date) - new Date(a.date)));
      
      alert(t('march_builder.alert_archive_success', '✅ Dati archiviati nello storico dei Report con successo!'));
      setSnapshotResults({ totalScore: 0, marches: {} });
      setSelectedSnapshotId("");
      
      setActiveSection('analysis');
      
    } catch (e) { alert(t('march_builder.alert_archive_error', '❌ Errore durante l\'archiviazione.')); }
    setIsLoading(false);
  };

  const handleSavePreset = async (name) => {
    const cleanName = name?.trim();
    if (!cleanName) {
      alert(t('march_builder.alert_preset_name', 'Inserisci un nome valido per il preset!'));
      return false; 
    }
    
    if (savedPresets[cleanName]) {
      const wantToOverwrite = window.confirm(`⚠️ Esiste già una formazione salvata con il nome "${cleanName}".\n\nVuoi sovrascriverla aggiornandola con le modifiche attuali?`);
      if (!wantToOverwrite) return false; 
    }

    const updatedPresets = { ...savedPresets, [cleanName]: { marches, event: selectedEvent, activeAnimals, createdAt: new Date().toISOString() } };
    setSavedPresets(updatedPresets);

    try {
      await setDoc(doc(db, "playerMarches", `${auth.realm || 'Sconosciuto'}_${auth.code}_${auth.playerId}`), {
        savedPresets: updatedPresets,
        marches: marches, 
        event: selectedEvent
      }, { merge: true });
      
      alert(t('march_builder.alert_preset_saved', '☁️ ✅ Formazione salvata nel Cloud con successo!'));
      return true; 
    } catch (e) {
      console.error(e);
      alert('❌ Errore di connessione: impossibile salvare su Firebase.');
      return false;
    }
  };

  const handleLoadPreset = (name) => {
    const preset = savedPresets[name];
    if (preset) {
      setMarches(preset.marches);
      if (preset.event) setSelectedEvent(preset.event);
      if (preset.activeAnimals) setActiveAnimals(preset.activeAnimals);
    }
  };

  const handleDeletePreset = async (name) => {
    const wantToDelete = window.confirm(`Vuoi davvero eliminare definitivamente la formazione "${name}" dal Cloud?`);
    if (!wantToDelete) return;

    const updated = { ...savedPresets };
    delete updated[name];
    setSavedPresets(updated);

    try {
      await setDoc(doc(db, "playerMarches", `${auth.realm || 'Sconosciuto'}_${auth.code}_${auth.playerId}`), {
        savedPresets: updated
      }, { merge: true });
    } catch (e) {
      console.error(e);
      alert('❌ Errore durante l\'eliminazione dal Cloud.');
    }
  };

  const handleBuffChange = (buffId, level) => setPlayerBuffs(prev => ({ ...prev, [buffId]: level }));

  let bonusMarchCap = 0;
  let bonusRallyCap = 0;

  if (buffsCatalog && Object.keys(buffsCatalog).length > 0) {
    const activePassiveBuffs = Object.values(buffsCatalog).filter(b => {
      if (b.sourceCategory === 'animal' || b.type === 'animal') return false;
      
      let evs = [];
      if (b.applicableEvents) evs = evs.concat(Array.isArray(b.applicableEvents) ? b.applicableEvents : [b.applicableEvents]);
      if (b.applicableEvent) evs = evs.concat(Array.isArray(b.applicableEvent) ? b.applicableEvent : [b.applicableEvent]);
      if (b.events) evs = evs.concat(Array.isArray(b.events) ? b.events : [b.events]);
      if (b.event) evs = evs.concat(Array.isArray(b.event) ? b.event : [b.event]);
      if (b.targetEvent) evs = evs.concat(Array.isArray(b.targetEvent) ? b.targetEvent : [b.targetEvent]);
      
      const buffEvents = [...new Set(evs)].filter(Boolean).map(e => String(e).toLowerCase().replace(/[^a-z0-9]/g, ''));
      const normalizedSelected = String(selectedEvent).toLowerCase().replace(/[^a-z0-9]/g, '');
      
      const isGeneral = b.isGeneral || buffEvents.length === 0 || buffEvents.includes('all');
      const isForThisEvent = buffEvents.includes(normalizedSelected);
      
      if (!isGeneral && !isForThisEvent) return false;
      
      return (playerBuffs[b.id] > 0) || b.isFixedForEvent;
    });

    const activeAnimalBuffs = Object.values(buffsCatalog).filter(b => activeAnimals.includes(b.id));
    const allInfluences = [...activePassiveBuffs, ...activeAnimalBuffs];

    allInfluences.forEach(b => {
      let lvl = playerBuffs[b.id] || 0;
      const isFixed = b.isFixedForEvent;

      if (isFixed && lvl === 0) {
         if (Array.isArray(b.values)) lvl = b.values.length;
         else if (b.values && Object.values(b.values)[0]) lvl = Array.isArray(Object.values(b.values)[0]) ? Object.values(b.values)[0].length : 1;
         else lvl = 1;
      }
      
      if (lvl === 0) return;

      const targets = b.statTargets || (b.statTarget ? [b.statTarget] : ['atk']);
      targets.forEach(st => {
         if (st === 'march_capacity' || st === 'rally_capacity') {
            const isOldFormat = Array.isArray(b.values);
            const val = isOldFormat ? b.values[lvl-1] : (b.values && b.values[st] ? b.values[st][lvl-1] : 0);
            if (st === 'march_capacity') bonusMarchCap += Number(val) || 0;
            if (st === 'rally_capacity') bonusRallyCap += Number(val) || 0;
         }
      });
    });
  }

  const getSumOfType = (type) => Object.values(totalTroops[type]).reduce((sum, val) => sum + val, 0);
  const countDeployedHeroes = (march) => (march.hero1 ? 1 : 0) + (march.hero2 ? 1 : 0) + (march.hero3 ? 1 : 0);
  const getHeroColor = (rarity) => ({ 'legendary': 'text-amber-400', 'epic': 'text-purple-400', 'rare': 'text-blue-400' }[rarity] || 'text-slate-300');

  const getAvailableBeforeMarch = (currentMarches, targetIndex, field) => {
    const fullType = field === 'inf' ? 'infantry' : field === 'cav' ? 'cavalry' : 'archers';
    let available = getSumOfType(fullType);
    for (let i = 0; i < targetIndex; i++) {
      const m = currentMarches[i];
      const baseCap = globalCapacity[countDeployedHeroes(m)] || 0;
      const autoCap = baseCap > 0 ? baseCap + bonusMarchCap : 0; 
      const cap = (m.customCapacity && m.customCapacity > 0) ? m.customCapacity : autoCap;
      let req = m.troopConfig.mode === 'manual' ? (m.troopConfig.manual[field] || 0) : Math.floor(cap * ((m.troopConfig.percent[field] || 0) / 100));
      available -= Math.min(available, req);
    }
    return Math.max(0, available);
  };

  const handleUpdateTroopConfig = (marchId, section, field, value) => {
    setMarches(prev => {
      const idx = prev.findIndex(m => m.id === marchId);
      if (idx === -1) return prev;
      if (section === 'mode') return prev.map((m, i) => i === idx ? { ...m, troopConfig: { ...m.troopConfig, mode: value } } : m);
      
      const numVal = value === '' ? 0 : Number(value);
      let clamped = numVal;
      const available = getAvailableBeforeMarch(prev, idx, field);
      
      const baseCap = globalCapacity[countDeployedHeroes(prev[idx])] || 0;
      const autoCap = baseCap > 0 ? baseCap + bonusMarchCap : 0; 
      const cap = (prev[idx].customCapacity && prev[idx].customCapacity > 0) ? prev[idx].customCapacity : autoCap;

      if (section === 'manual') clamped = Math.min(numVal, available);
      else if (section === 'percent') clamped = cap > 0 ? Math.min(numVal, Math.floor((available / cap) * 100)) : 0;

      return prev.map((m, i) => i === idx ? { ...m, troopConfig: { ...m.troopConfig, [section]: { ...m.troopConfig[section], [field]: clamped } } } : m);
    });
  };

  const handleApplyPreset = (marchId, infP, cavP, arcP) => {
    setMarches(prev => {
      const idx = prev.findIndex(m => m.id === marchId);
      if (idx === -1) return prev;
      
      const baseCap = globalCapacity[countDeployedHeroes(prev[idx])] || 0;
      const autoCap = baseCap > 0 ? baseCap + bonusMarchCap : 0; 
      const cap = (prev[idx].customCapacity && prev[idx].customCapacity > 0) ? prev[idx].customCapacity : autoCap;
      if (cap === 0) { alert(t('march_builder.set_global_capacity_alert')); return prev; }
      
      const availInf = getAvailableBeforeMarch(prev, idx, 'inf');
      const availCav = getAvailableBeforeMarch(prev, idx, 'cav');
      const availArc = getAvailableBeforeMarch(prev, idx, 'arc');

      return prev.map((m, i) => i === idx ? { ...m, troopConfig: { ...m.troopConfig, mode: 'percent', percent: { inf: Math.min(infP, Math.floor((availInf / cap) * 100)), cav: Math.min(cavP, Math.floor((availCav / cap) * 100)), arc: Math.min(arcP, Math.floor((availArc / cap) * 100)) } } } : m);
    });
  };

  const handleDeleteMarch = (id) => setMarches(prev => prev.filter(m => m.id !== id));

  const getAvailableHeroes = (currentMarch, currentSlot) => {
    const usedTypes = ['hero1', 'hero2', 'hero3'].filter(s => s !== currentSlot).map(s => heroesCatalog.find(h => h.id === currentMarch[s])?.type).filter(Boolean);
    const usedIds = marches.filter(m => m.id !== currentMarch.id).flatMap(m => [m.hero1, m.hero2, m.hero3]).filter(Boolean);
    const hasHeroes = Object.keys(ownedHeroes).length > 0;
    return heroesCatalog.filter(h => h.id === currentMarch[currentSlot] || (!usedTypes.includes(h.type) && !usedIds.includes(h.id) && (!hasHeroes || !!ownedHeroes[h.id])));
  };

  let availableCity = JSON.parse(JSON.stringify(totalTroops)); 
  const processedMarches = marches.map(march => {
    const activeHeroesCount = countDeployedHeroes(march);
    const baseCapacity = globalCapacity[activeHeroesCount] || 0;
    const autoMaxCapacity = baseCapacity > 0 ? baseCapacity + bonusMarchCap : 0;
    const currentMaxCapacity = (march.customCapacity && march.customCapacity > 0) ? march.customCapacity : autoMaxCapacity;
    const { mode = 'manual', manual = { inf: 0, cav: 0, arc: 0 }, percent = { inf: 0, cav: 0, arc: 0 } } = march.troopConfig || {};

    let reqInf = mode === 'manual' ? manual.inf : Math.floor(currentMaxCapacity * (percent.inf / 100));
    let reqCav = mode === 'manual' ? manual.cav : Math.floor(currentMaxCapacity * (percent.cav / 100));
    let reqArc = mode === 'manual' ? manual.arc : Math.floor(currentMaxCapacity * (percent.arc / 100));
    
    const drawTroops = (type, amount) => {
      let needed = amount, pulled = {};
      for (let t of TIERS) {
        if (needed <= 0) break;
        if (availableCity[type][t] > 0) {
          let take = Math.min(availableCity[type][t], needed);
          pulled[t] = take; availableCity[type][t] -= take; needed -= take;
        }
      }
      return { pulled, missing: needed, totalPulled: amount - needed };
    };

    return { 
      ...march, 
      activeHeroesCount, baseCapacity, bonusMarchCap, bonusRallyCap, autoMaxCapacity, currentMaxCapacity, mode, manual, percent, 
      currentTotal: mode === 'manual' ? reqInf + reqCav + reqArc : percent.inf + percent.cav + percent.arc, 
      realInf: drawTroops('infantry', reqInf), realCav: drawTroops('cavalry', reqCav), realArc: drawTroops('archers', reqArc) 
    };
  });

  const initInf = getSumOfType('infantry'), initCav = getSumOfType('cavalry'), initArc = getSumOfType('archers');

  if (!auth?.playerId || !auth?.code) {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <h2 className="text-2xl font-bold text-rose-500 mb-4">{t('march_builder.access_denied')}</h2>
        <button onClick={() => navigate('/')} className="px-6 py-2 bg-slate-800 rounded-lg">{t('march_builder.back_to_home')}</button>
      </div>
    );
  }

  const handleEditRecommendationClick = () => {
    setRecForm({
      leader: allianceRecommendations[selectedEvent]?.leader || { hero1: '', hero2: '', hero3: '', inf: 0, cav: 0, arc: 0 },
      joiner: allianceRecommendations[selectedEvent]?.joiner || { heroA: '', heroB: '', heroC: '', heroD: '', heroE: '', heroF: '', maxTroops: 0, inf: 0, cav: 0, arc: 0 }
    });
    setIsEditingRec(true);
  };

  const updateRecForm = (type, field, value) => {
    setRecForm(prev => ({ ...prev, [type]: { ...prev[type], [field]: value } }));
  };

  const handleSaveRecommendation = async () => {
    setIsLoading(true);
    try {
      const updatedRecs = { ...allianceRecommendations, [selectedEvent]: recForm };
      await setDoc(doc(db, "allianceSettings", auth.code), { recommendations: updatedRecs }, { merge: true });
      setAllianceRecommendations(updatedRecs);
      setIsEditingRec(false);
      alert(t('march_builder.doctrine_saved_alert', '✅ Dottrina salvata con successo!'));
    } catch (e) {
      alert(t('march_builder.doctrine_error_alert', '❌ Errore durante il salvataggio della dottrina.'));
    }
    setIsLoading(false);
  };

  const handleApplyRecommendation = (marchId, type, customRatio = null) => {
    const rec = allianceRecommendations[selectedEvent]?.[type];
    if (!rec) return;

    setMarches(prev => prev.map(m => {
      if (marchId !== 'all' && m.id !== marchId) return m;
      if (marchId === 'all' && type === 'joiner' && m.marchType === 'rally_leader') {
         return m;
      }

      let updatedMarch = { ...m };
      
      if (type === 'leader') {
        updatedMarch.marchType = 'rally_leader';
        if (rec.hero1) updatedMarch.hero1 = rec.hero1;
        if (rec.hero2) updatedMarch.hero2 = rec.hero2;
        if (rec.hero3) updatedMarch.hero3 = rec.hero3;
        updatedMarch.troopConfig = { 
           mode: 'percent', 
           percent: { inf: rec.inf || 0, cav: rec.cav || 0, arc: rec.arc || 0 }, 
           manual: m.troopConfig.manual 
        };
      } else if (type === 'joiner') {
        updatedMarch.marchType = 'rally_joiner';
        if (rec.maxTroops > 0) updatedMarch.customCapacity = rec.maxTroops;
        else updatedMarch.customCapacity = 0; 
        
        if (customRatio) {
          updatedMarch.troopConfig = { 
             mode: 'percent', 
             percent: { inf: customRatio.inf || 0, cav: customRatio.cav || 0, arc: customRatio.arc || 0 }, 
             manual: m.troopConfig.manual 
          };
        }
      }
      return updatedMarch;
    }));
    
    alert(`✅ Dottrina applicata ${marchId === 'all' ? 'alle marce disponibili' : 'alla singola marcia'}!`);
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8 flex flex-col gap-6 text-slate-200 relative overflow-hidden">
      
     {/* 📌 TASTO HOME + TASTO GUIDA "?" (Stile Sobrio ed Elegante) */}
      <div className="flex z-10 relative gap-3">
        <button 
          onClick={() => navigate('/')} 
          className="flex items-center gap-2 px-4 py-2 bg-slate-900/80 border border-slate-700 hover:bg-slate-800 hover:border-slate-500 text-slate-300 hover:text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-lg backdrop-blur-sm"
        >
          <span>⬅️</span> {t('march_builder.back_to_home', 'Torna alla Home')}
        </button>
        
       <button 
          onClick={() => setIsGuideOpen(true)} 
          className="flex items-center justify-center w-9 h-9 bg-slate-900/80 border border-slate-700 hover:bg-slate-800 hover:border-slate-500 text-slate-400 hover:text-white rounded-xl text-sm font-bold transition-all shadow-lg backdrop-blur-sm"
          title={t('march_builder.guide_tooltip', "Manuale d'Uso")}
        >
          ?
        </button>
      </div>

      <MarchBuilderGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} t={t} />

      <HeroCollectionModal t={t} isOpen={isHeroModalOpen} onClose={() => setIsHeroModalOpen(false)} ownedHeroes={ownedHeroes} setOwnedHeroes={setOwnedHeroes} onSave={handleSaveProfile} getHeroColor={getHeroColor} heroesCatalog={heroesCatalog} />
      <AdminBuffsModal isOpen={isAdminBuffsOpen} onClose={() => setIsAdminBuffsOpen(false)} t={t} buffsCatalog={buffsCatalog} setBuffsCatalog={setBuffsCatalog} />
      
      <AdminHeroesModal isOpen={isAdminHeroesOpen} onClose={() => setIsAdminHeroesOpen(false)} heroesCatalog={heroesCatalog} setHeroesCatalog={setHeroesCatalog} t={t} />

      <MarchBuilderHeader t={t} activeSection={activeSection} setActiveSection={setActiveSection} playerRealRole={playerRealRole} playerName={auth.playerName} />

      {activeSection === 'settings' && (
         <MarchSettingsView 
            t={t} setIsHeroModalOpen={setIsHeroModalOpen} globalCapacity={globalCapacity} setGlobalCapacity={setGlobalCapacity}
            isArmyOpen={isArmyOpen} setIsArmyOpen={setIsArmyOpen} activeTab={activeTab} setActiveTab={setActiveTab}
            totalTroops={totalTroops} setTotalTroops={setTotalTroops} initInf={initInf} initCav={initCav} initArc={initArc}
            handleSaveToCloud={handleSaveProfile} isLoading={isLoading}
            selectedEvent={selectedEvent} playerBuffs={playerBuffs} handleBuffChange={handleBuffChange}
            buffsCatalog={buffsCatalog} 
            isAdmin={['admin', 'master', 'consulente'].includes(String(auth?.role || '').toLowerCase())} 
            onOpenAdminModal={() => setIsAdminBuffsOpen(true)} handleLoadTargetData={handleLoadTargetData}
            onOpenAdminHeroesModal={() => setIsAdminHeroesOpen(true)}
            ownedHeroes={ownedHeroes} setOwnedHeroes={setOwnedHeroes}
            heroesCatalog={heroesCatalog}
         />
      )}

      {activeSection === 'builder' && (
         <MarchCreationView 
            t={t} isOfficer={isOfficer} selectedEvent={selectedEvent} setSelectedEvent={setSelectedEvent}
            allianceRecommendations={allianceRecommendations} isEditingRec={isEditingRec}
            recForm={recForm} handleEditRecommendationClick={handleEditRecommendationClick}
            setIsEditingRec={setIsEditingRec} handleSaveRecommendation={handleSaveRecommendation}
            updateRecForm={updateRecForm} handleApplyRecommendation={handleApplyRecommendation}
            marches={marches} playerMaxMarches={playerMaxMarches} processedMarches={processedMarches}
            handleDeleteMarch={handleDeleteMarch} setMarches={setMarches}
            handleUpdateTroopConfig={handleUpdateTroopConfig} handleApplyPreset={handleApplyPreset}
            getAvailableHeroes={getAvailableHeroes} getHeroColor={getHeroColor}
            savedPresets={savedPresets} handleSavePreset={handleSavePreset}
            handleLoadPreset={handleLoadPreset} handleDeletePreset={handleDeletePreset}
            buffsCatalog={buffsCatalog} playerBuffs={playerBuffs}
            activeAnimals={activeAnimals} setActiveAnimals={setActiveAnimals}
            handleIndexBuild={handleIndexBuild}
          />
      )}

      {activeSection === 'results' && (
         <MarchResultsView 
            t={t} 
            indexedBuilds={indexedBuilds}
            selectedSnapshotId={selectedSnapshotId}
            setSelectedSnapshotId={setSelectedSnapshotId}
            snapshotResults={snapshotResults}
            handleResultUpdate={handleResultUpdate} 
            handleTotalScoreUpdate={handleTotalScoreUpdate}
            handleSaveToCloud={handleSaveProfile} 
            handleArchiveResults={handleArchiveResults} 
            isLoading={isLoading} 
         />
      )}

      {activeSection === 'analysis' && (
         <MarchAnalysisView 
            t={t} 
            reports={battleReports}
         />
      )}

    </div>
  );
}