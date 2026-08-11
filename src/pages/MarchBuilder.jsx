import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { db } from '../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { heroesDB, eventTypes } from '../data/heroes';

import HeroCollectionModal from '../components/march/HeroCollectionModal';
import AllianceDoctrine from '../components/march/AllianceDoctrine';
import MarchCard from '../components/march/MarchCard';

const TIERS = ['T11', 'T10', 'T9', 'T8', 'T7', 'T6', 'T5', 'T4', 'T3', 'T2', 'T1'];
const initialTiers = TIERS.reduce((acc, tier) => ({ ...acc, [tier]: 0 }), {});

const defaultRecState = {
  leader: { hero1: '', hero2: '', hero3: '', inf: 0, cav: 0, arc: 0 },
  joiner: { heroA: '', heroB: '', heroC: '', heroD: '', heroE: '', heroF: '', maxTroops: 0, inf: 0, cav: 0, arc: 0 }
};

export default function MarchBuilder({ auth }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  
  const [selectedEvent, setSelectedEvent] = useState(eventTypes[0].id);
  const [isLoading, setIsLoading] = useState(false);
  const [showDemoGuide, setShowDemoGuide] = useState(false);

  const [totalTroops, setTotalTroops] = useState({ infantry: { ...initialTiers }, cavalry: { ...initialTiers }, archers: { ...initialTiers }});
  const [activeTab, setActiveTab] = useState('infantry');
  const [isArmyOpen, setIsArmyOpen] = useState(true); 
  const [globalCapacity, setGlobalCapacity] = useState({ 0: 0, 1: 0, 2: 0, 3: 0 });
  const [marches, setMarches] = useState([{ id: Date.now(), hero1: '', hero2: '', hero3: '', troopConfig: { mode: 'percent', manual: { inf: 0, cav: 0, arc: 0 }, percent: { inf: 0, cav: 0, arc: 0 } } }]);

  const [ownedHeroes, setOwnedHeroes] = useState([]);
  const [isHeroModalOpen, setIsHeroModalOpen] = useState(false);
  const [allianceRecommendations, setAllianceRecommendations] = useState({});
  const [isEditingRec, setIsEditingRec] = useState(false);
  const [recForm, setRecForm] = useState(defaultRecState);

  const [isOfficer, setIsOfficer] = useState(auth?.role === 'admin' || auth?.role === 'consulente');
  const [playerRealRole, setPlayerRealRole] = useState(auth?.role === 'admin' || auth?.role === 'consulente' ? 'MASTER' : '');
  const [playerMaxMarches, setPlayerMaxMarches] = useState(1);

  useEffect(() => {
    if (auth?.code === 'DEMO' || auth?.code === 'DEMO2') {
      setShowDemoGuide(true);
      setIsOfficer(true);
      setPlayerRealRole('DEMO-R5');
      setPlayerMaxMarches(5);
      setTotalTroops({
        infantry: { ...initialTiers, T11: 50000, T10: 150000, T9: 100000 },
        cavalry: { ...initialTiers, T11: 40000, T10: 200000, T9: 100000 },
        archers: { ...initialTiers, T11: 80000, T10: 180000, T9: 100000 }
      });
      setGlobalCapacity({ 0: 50000, 1: 90000, 2: 130000, 3: 175000 });
      setMarches([{ id: 'demo_1', hero1: 'h_inf_1', hero2: 'h_cav_1', hero3: 'h_arc_1', troopConfig: { mode: 'percent', manual: { inf: 0, cav: 0, arc: 0 }, percent: { inf: 50, cav: 30, arc: 20 } } }]);
    
    } else if (auth?.code && auth?.playerId) {
      const fetchData = async () => {
        try {
          const userSnap = await getDoc(doc(db, "playerMarches", `${auth.code}_${auth.playerId}`));
          if (userSnap.exists()) {
            const data = userSnap.data();
            if (data.ownedHeroes) setOwnedHeroes(data.ownedHeroes);
            if (data.totalTroops) setTotalTroops(data.totalTroops);
            if (data.globalCapacity) setGlobalCapacity(data.globalCapacity);
            if (data.marches && data.marches.length > 0) setMarches(data.marches);
            if (data.event) setSelectedEvent(data.event);
          }
          
          const settSnap = await getDoc(doc(db, "allianceSettings", auth.code));
          if (settSnap.exists() && settSnap.data().recommendations) setAllianceRecommendations(settSnap.data().recommendations);

          if (auth.role !== 'admin' && auth.role !== 'consulente') {
            let rSnap = await getDoc(doc(db, "rosters", auth.code));
            if (!rSnap.exists()) rSnap = await getDoc(doc(db, "allianceRoster", auth.code));
            
            if (rSnap.exists()) {
              const myPlayerObj = rSnap.data().players?.find(p => p.id === auth.playerId);
              const myRole = String(myPlayerObj?.role || '').toUpperCase();
              setPlayerRealRole(myRole); 
              
              if (myPlayerObj?.marches) setPlayerMaxMarches(Number(myPlayerObj.marches));

              if (myRole === 'R5' || myRole === 'R4' || myRole.includes('OFFICER') || myRole.includes('LEADER')) {
                setIsOfficer(true);
              }
            }
          } else {
             setPlayerMaxMarches(6);
          }
        } catch (e) { }
      };
      fetchData();
    }
  }, [auth]);

  if (!auth?.playerId || !auth?.code) {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <h2 className="text-2xl font-bold text-rose-500 mb-4">{t('march_builder.access_denied')}</h2>
        <button onClick={() => navigate('/')} className="px-6 py-2 bg-slate-800 rounded-lg">{t('march_builder.back_to_home')}</button>
      </div>
    );
  }

  const handleSaveToCloud = async () => {
    setIsLoading(true);
    try {
      await setDoc(doc(db, "playerMarches", `${auth.code}_${auth.playerId}`), {
        allianceCode: auth.code, playerId: auth.playerId, playerName: auth.playerName, event: selectedEvent,
        globalCapacity, totalTroops, marches, ownedHeroes, lastUpdated: new Date().toISOString()
      }, { merge: true });
      alert(t('march_builder.alert_save_success'));
    } catch (e) { alert(t('march_builder.alert_save_error')); }
    setIsLoading(false);
  };

  const handleSaveRecommendation = async () => {
    try {
      const updatedRecs = { ...allianceRecommendations, [selectedEvent]: recForm };
      await setDoc(doc(db, "allianceSettings", auth.code), { recommendations: updatedRecs }, { merge: true });
      setAllianceRecommendations(updatedRecs);
      setIsEditingRec(false);
      alert(t('march_builder.alert_doctrine_success'));
    } catch (e) { alert(t('march_builder.alert_doctrine_error')); }
  };

  const handleEditRecommendationClick = () => {
    const current = allianceRecommendations[selectedEvent];
    let formState = defaultRecState;
    if (current) formState = (current.leader || current.joiner) ? { leader: current.leader || defaultRecState.leader, joiner: current.joiner || defaultRecState.joiner } : { leader: current, joiner: current };
    setRecForm(formState);
    setIsEditingRec(true);
  };

  const getSumOfType = (type) => Object.values(totalTroops[type]).reduce((sum, val) => sum + val, 0);

  const handleApplyRecommendation = (marchId, type, customRatio = null) => {
    const rec = allianceRecommendations[selectedEvent]?.[type];
    if (!rec) return;

    if (marchId === 'all' && type === 'joiner') {
      let availInf = getSumOfType('infantry');
      let availCav = getSumOfType('cavalry');
      let availArc = getSumOfType('archers');
      
      let showedRatioWarning = false;

      setMarches(prev => {
        let newMarches = [...prev];
        
        while (newMarches.length < playerMaxMarches) {
          newMarches.push({
            id: Date.now() + Math.random(),
            hero1: '', hero2: '', hero3: '', 
            troopConfig: { mode: 'percent', manual: { inf: 0, cav: 0, arc: 0 }, percent: { inf: 0, cav: 0, arc: 0 } }
          });
        }

        const allowed = [rec.heroA, rec.heroB, rec.heroC, rec.heroD, rec.heroE, rec.heroF].filter(Boolean);
        const ratioToUse = customRatio || { inf: rec.inf, cav: rec.cav, arc: rec.arc };
        
        let assignedHeroes = []; 

        const updatedMarches = newMarches.map((m, index) => {
          let chosenHero = '';
          for (let h of allowed) {
            if (!assignedHeroes.includes(h) && (ownedHeroes.length === 0 || ownedHeroes.includes(h))) {
              chosenHero = h; break;
            }
          }
          if (chosenHero) assignedHeroes.push(chosenHero);

          const activeHeroesCount = chosenHero ? 1 : 0;
          const playerCap = globalCapacity[activeHeroesCount] || 0;
          const r4Limit = rec.maxTroops > 0 ? rec.maxTroops : Infinity;
          const targetTotal = Math.min(r4Limit, playerCap);

          const idealInf = Math.floor(targetTotal * ((ratioToUse.inf || 0) / 100));
          const idealCav = Math.floor(targetTotal * ((ratioToUse.cav || 0) / 100));
          const idealArc = Math.floor(targetTotal * ((ratioToUse.arc || 0) / 100));

          let actualInf = Math.min(idealInf, availInf);
          let actualCav = Math.min(idealCav, availCav);
          let actualArc = Math.min(idealArc, availArc);

          availInf -= actualInf;
          availCav -= actualCav;
          availArc -= actualArc;

          let missing = targetTotal - (actualInf + actualCav + actualArc);

          if (missing > 0 && !showedRatioWarning) {
            showedRatioWarning = true;
            setTimeout(() => alert(t('march_builder.alert_missing_troops_all')), 400);
          }

          if (missing > 0 && availInf > 0) { const extra = Math.min(missing, availInf); actualInf += extra; availInf -= extra; missing -= extra; }
          if (missing > 0 && availCav > 0) { const extra = Math.min(missing, availCav); actualCav += extra; availCav -= extra; missing -= extra; }
          if (missing > 0 && availArc > 0) { const extra = Math.min(missing, availArc); actualArc += extra; availArc -= extra; missing -= extra; }

          return {
            ...m,
            hero1: chosenHero, hero2: '', hero3: '',
            troopConfig: {
              ...m.troopConfig, mode: 'manual', 
              manual: { inf: actualInf, cav: actualCav, arc: actualArc }
            }
          };
        });

        return updatedMarches;
      });
      return;
    }

    if (type === 'leader') {
      setMarches(prev => prev.map(m => m.id !== marchId ? m : { 
        ...m, 
        hero1: rec.hero1 || '', hero2: rec.hero2 || '', hero3: rec.hero3 || '', 
        troopConfig: { ...m.troopConfig, mode: 'percent', percent: { inf: rec.inf || 0, cav: rec.cav || 0, arc: rec.arc || 0 } } 
      }));
    } else if (type === 'joiner') {
      setMarches(prev => {
        const usedIds = prev.filter(m => m.id !== marchId).flatMap(m => [m.hero1, m.hero2, m.hero3]).filter(Boolean);
        const allowed = [rec.heroA, rec.heroB, rec.heroC, rec.heroD, rec.heroE, rec.heroF].filter(Boolean);
        
        let chosenHero = '';
        for (let h of allowed) {
          if (!usedIds.includes(h) && (ownedHeroes.length === 0 || ownedHeroes.includes(h))) {
            chosenHero = h; break;
          }
        }
        if (!chosenHero && allowed.length > 0) chosenHero = allowed[0];

        const ratioToUse = customRatio || { inf: rec.inf, cav: rec.cav, arc: rec.arc };
        
        return prev.map((m, i) => {
          if (m.id !== marchId) return m;

          const activeHeroesCount = chosenHero ? 1 : 0;
          const playerCap = globalCapacity[activeHeroesCount] || 0;
          const r4Limit = rec.maxTroops > 0 ? rec.maxTroops : Infinity;
          const targetTotal = Math.min(r4Limit, playerCap);

          const idealInf = Math.floor(targetTotal * ((ratioToUse.inf || 0) / 100));
          const idealCav = Math.floor(targetTotal * ((ratioToUse.cav || 0) / 100));
          const idealArc = Math.floor(targetTotal * ((ratioToUse.arc || 0) / 100));

          let availInf = getAvailableBeforeMarch(prev, i, 'inf');
          let availCav = getAvailableBeforeMarch(prev, i, 'cav');
          let availArc = getAvailableBeforeMarch(prev, i, 'arc');

          let actualInf = Math.min(idealInf, availInf);
          let actualCav = Math.min(idealCav, availCav);
          let actualArc = Math.min(idealArc, availArc);

          availInf -= actualInf;
          availCav -= actualCav;
          availArc -= actualArc;

          let missing = targetTotal - (actualInf + actualCav + actualArc);

          if (missing > 0 && availInf > 0) { const extra = Math.min(missing, availInf); actualInf += extra; availInf -= extra; missing -= extra; }
          if (missing > 0 && availCav > 0) { const extra = Math.min(missing, availCav); actualCav += extra; availCav -= extra; missing -= extra; }
          if (missing > 0 && availArc > 0) { const extra = Math.min(missing, availArc); actualArc += extra; availArc -= extra; missing -= extra; }

          if (targetTotal > (actualInf + actualCav + actualArc)) {
             setTimeout(() => alert(t('march_builder.alert_missing_troops_single')), 300);
          }

          return {
            ...m,
            hero1: chosenHero, hero2: '', hero3: '',
            troopConfig: {
              ...m.troopConfig, mode: 'manual', 
              manual: { inf: actualInf, cav: actualCav, arc: actualArc }
            }
          };
        });
      });
    }
  };

  const updateRecForm = (type, field, value) => setRecForm(prev => ({ ...prev, [type]: { ...prev[type], [field]: value } }));
  const toggleOwnedHero = (heroId) => setOwnedHeroes(prev => prev.includes(heroId) ? prev.filter(id => id !== heroId) : [...prev, heroId]);

  const countDeployedHeroes = (march) => (march.hero1 ? 1 : 0) + (march.hero2 ? 1 : 0) + (march.hero3 ? 1 : 0);
  const getHeroColor = (rarity) => ({ 'legendary': 'text-amber-400', 'epic': 'text-purple-400', 'rare': 'text-blue-400' }[rarity] || 'text-slate-300');

  const getAvailableBeforeMarch = (currentMarches, targetIndex, field) => {
    const fullType = field === 'inf' ? 'infantry' : field === 'cav' ? 'cavalry' : 'archers';
    let available = getSumOfType(fullType);
    for (let i = 0; i < targetIndex; i++) {
      const m = currentMarches[i];
      const cap = globalCapacity[countDeployedHeroes(m)] || 0;
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
      const cap = globalCapacity[countDeployedHeroes(prev[idx])] || 0;

      if (section === 'manual') clamped = Math.min(numVal, available);
      else if (section === 'percent') clamped = cap > 0 ? Math.min(numVal, Math.floor((available / cap) * 100)) : 0;

      return prev.map((m, i) => i === idx ? { ...m, troopConfig: { ...m.troopConfig, [section]: { ...m.troopConfig[section], [field]: clamped } } } : m);
    });
  };

  const handleApplyPreset = (marchId, infP, cavP, arcP) => {
    setMarches(prev => {
      const idx = prev.findIndex(m => m.id === marchId);
      if (idx === -1) return prev;
      const cap = globalCapacity[countDeployedHeroes(prev[idx])] || 0;
      if (cap === 0) { alert(t('march_builder.set_global_capacity_alert')); return prev; }
      
      const availInf = getAvailableBeforeMarch(prev, idx, 'inf');
      const availCav = getAvailableBeforeMarch(prev, idx, 'cav');
      const availArc = getAvailableBeforeMarch(prev, idx, 'arc');

      return prev.map((m, i) => i === idx ? { ...m, troopConfig: { ...m.troopConfig, mode: 'percent', percent: { inf: Math.min(infP, Math.floor((availInf / cap) * 100)), cav: Math.min(cavP, Math.floor((availCav / cap) * 100)), arc: Math.min(arcP, Math.floor((availArc / cap) * 100)) } } } : m);
    });
  };

  const handleDeleteMarch = (id) => setMarches(prev => prev.filter(m => m.id !== id));

  const getAvailableHeroes = (currentMarch, currentSlot) => {
    const usedTypes = ['hero1', 'hero2', 'hero3'].filter(s => s !== currentSlot).map(s => heroesDB.find(h => h.id === currentMarch[s])?.type).filter(Boolean);
    const usedIds = marches.filter(m => m.id !== currentMarch.id).flatMap(m => [m.hero1, m.hero2, m.hero3]).filter(Boolean);
    return heroesDB.filter(h => h.id === currentMarch[currentSlot] || (!usedTypes.includes(h.type) && !usedIds.includes(h.id) && (ownedHeroes.length === 0 || ownedHeroes.includes(h.id))));
  };

  let availableCity = JSON.parse(JSON.stringify(totalTroops)); 
  const processedMarches = marches.map(march => {
    const activeHeroesCount = countDeployedHeroes(march);
    const currentMaxCapacity = globalCapacity[activeHeroesCount] || 0;
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

    return { ...march, activeHeroesCount, currentMaxCapacity, mode, manual, percent, currentTotal: mode === 'manual' ? reqInf + reqCav + reqArc : percent.inf + percent.cav + percent.arc, realInf: drawTroops('infantry', reqInf), realCav: drawTroops('cavalry', reqCav), realArc: drawTroops('archers', reqArc) };
  });

  const initInf = getSumOfType('infantry'), initCav = getSumOfType('cavalry'), initArc = getSumOfType('archers');
  const remInf = Object.values(availableCity.infantry).reduce((a,b)=>a+b,0), remCav = Object.values(availableCity.cavalry).reduce((a,b)=>a+b,0), remArc = Object.values(availableCity.archers).reduce((a,b)=>a+b,0);
  const usedInf = initInf - remInf, usedCav = initCav - remCav, usedArc = initArc - remArc;

  const handleAddMarch = () => {
    if (marches.length >= 6) return alert(t('march_builder.max_marches_alert'));
    if (remInf + remCav + remArc <= 0 && marches.length > 0) return alert(t('march_builder.no_troops_alert'));
    setMarches([...marches, { id: Date.now(), hero1: '', hero2: '', hero3: '', troopConfig: { mode: 'percent', manual: { inf: 0, cav: 0, arc: 0 }, percent: { inf: 0, cav: 0, arc: 0 } } }]);
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8 flex flex-col gap-6 text-slate-200 relative overflow-hidden">
      
      <HeroCollectionModal t={t} isOpen={isHeroModalOpen} onClose={() => setIsHeroModalOpen(false)} ownedHeroes={ownedHeroes} toggleOwnedHero={toggleOwnedHero} onSave={handleSaveToCloud} getHeroColor={getHeroColor} />

      {showDemoGuide && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-slate-700 p-8 rounded-3xl shadow-2xl max-w-2xl w-full">
            <h2 className="text-2xl font-black text-emerald-400 mb-2">{t('march_builder.demo_title', 'Benvenuto nel Costruttore! ⚙️')}</h2>
            <p className="text-sm text-slate-300 mb-6">{t('march_builder.demo_desc', 'Sei in modalità Sandbox. Abbiamo caricato 1 Milione di truppe e configurato una marcia per mostrarti il motore in azione.')}</p>
            <button onClick={() => setShowDemoGuide(false)} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest rounded-xl transition-all shadow-[0_0_20px_rgba(5,150,105,0.4)]">
              {t('march_builder.demo_start_btn', 'Inizia a Sperimentare')}
            </button>
          </div>
        </div>
      )}

      <header className="flex justify-between items-center bg-slate-900/50 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/5 shadow-lg shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-colors">{t('march_builder.hub_btn')}</button>
          <h1 className="text-xl md:text-2xl font-black text-white flex items-center gap-2"><span className="text-cyan-500">⚙️</span> {t('march_builder.builder_title')}</h1>
        </div>
        <div className="text-right hidden sm:block">
          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{t('march_builder.active_profile')}</div>
          <div className="text-sm font-bold text-cyan-400">🛡️ {playerRealRole ? `[${playerRealRole}]` : ''} {auth.playerName}</div>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start flex-1 overflow-hidden z-10">
        
        {/* COLONNA SINISTRA */}
        <div className="xl:col-span-4 flex flex-col gap-6 xl:sticky xl:top-6 max-h-[85vh] overflow-y-auto custom-scrollbar pb-6 pr-2">
          
          <div className="bg-slate-900 border border-slate-700 p-5 rounded-2xl shadow-xl shrink-0 flex flex-col gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{t('march_builder.target_event')}</label>
              <select value={selectedEvent} onChange={(e) => setSelectedEvent(e.target.value)} className="w-full bg-slate-950 border border-indigo-500/50 text-indigo-300 text-sm font-bold px-4 py-3 rounded-xl focus:outline-none focus:border-indigo-400 cursor-pointer">
                {eventTypes.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
              </select>
            </div>
            <button onClick={() => setIsHeroModalOpen(true)} className="w-full px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 text-xs font-bold uppercase tracking-wider rounded-xl transition-colors flex items-center justify-center gap-2 shadow-inner"><span>🎖️</span> Apri Collezione Eroi</button>
          </div>

          <div className="bg-slate-900 border border-slate-700 p-5 rounded-2xl shadow-xl shrink-0">
            <div className="border-b border-slate-800 pb-2 mb-3">
              <h2 className="text-sm font-black text-indigo-400 uppercase tracking-widest">{t('march_builder.global_capacity_title')}</h2>
              <p className="text-[10px] text-slate-500 leading-tight mt-1">{t('march_builder.global_capacity_desc')}</p>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              {[0, 1, 2, 3].map(num => (
                <div key={`cap-${num}`} className="flex flex-col gap-1 p-2 rounded-xl border bg-slate-950 border-slate-800 focus-within:border-indigo-500/50 transition-colors">
                  <label className="text-[9px] font-bold text-slate-500 text-center">{num === 0 ? t('march_builder.hero_count_0') : num === 1 ? t('march_builder.hero_count_1') : num === 2 ? t('march_builder.hero_count_2') : t('march_builder.hero_count_3')}</label>
                  <input type="number" min="0" value={globalCapacity[num] === 0 ? '' : globalCapacity[num]} onChange={(e) => setGlobalCapacity(p => ({...p, [num]: Math.max(0, e.target.value === '' ? 0 : Number(e.target.value))}))} className="w-full bg-transparent text-center text-indigo-300 font-mono text-sm font-bold outline-none" placeholder="0" />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-xl flex flex-col flex-shrink">
            <div className="p-5 border-b border-slate-800 bg-slate-900/80 shrink-0 cursor-pointer flex justify-between items-center hover:bg-slate-800/80 transition-colors rounded-t-2xl" onClick={() => setIsArmyOpen(!isArmyOpen)}>
              <div>
                <h2 className="text-sm font-black text-cyan-400 uppercase tracking-widest">{t('march_builder.your_army_title')}</h2>
                <p className="text-[10px] text-slate-500 mt-1 leading-tight">{t('march_builder.manage_troops_desc')}</p>
              </div>
              <span className="text-xl opacity-70">{isArmyOpen ? '🔽' : '▶️'}</span>
            </div>
            
            {isArmyOpen && (
              <>
                <div className="flex bg-slate-950 p-2 border-b border-slate-800 shrink-0">
                  <button onClick={() => setActiveTab('infantry')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${activeTab === 'infantry' ? 'bg-cyan-900/40 text-cyan-400 border border-cyan-500/50' : 'text-slate-500 hover:text-slate-300'}`}>{t('march_builder.inf_short')} <br/><span className="text-[9px] opacity-70">({initInf.toLocaleString()})</span></button>
                  <button onClick={() => setActiveTab('cavalry')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${activeTab === 'cavalry' ? 'bg-amber-900/40 text-amber-400 border border-amber-500/50' : 'text-slate-500 hover:text-slate-300'}`}>{t('march_builder.cav_short')} <br/><span className="text-[9px] opacity-70">({initCav.toLocaleString()})</span></button>
                  <button onClick={() => setActiveTab('archers')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${activeTab === 'archers' ? 'bg-rose-900/40 text-rose-400 border border-rose-500/50' : 'text-slate-500 hover:text-slate-300'}`}>{t('march_builder.arc_short')} <br/><span className="text-[9px] opacity-70">({initArc.toLocaleString()})</span></button>
                </div>
                <div className="max-h-[300px] overflow-y-auto p-4 custom-scrollbar">
                  <div className="flex flex-col gap-2">
                    {TIERS.map(tier => (
                      <div key={`${activeTab}-${tier}`} className={`flex items-center justify-between bg-slate-950 p-2.5 rounded-lg border transition-colors ${totalTroops[activeTab][tier] > 0 ? (activeTab === 'infantry' ? 'border-cyan-500/30 bg-cyan-950/10' : activeTab === 'cavalry' ? 'border-amber-500/30 bg-amber-950/10' : 'border-rose-500/30 bg-rose-950/10') : 'border-slate-800'}`}>
                        <span className={`text-xs font-black w-12 ${totalTroops[activeTab][tier] > 0 ? 'text-slate-200' : 'text-slate-600'}`}>{tier}</span>
                        <input type="number" min="0" value={totalTroops[activeTab][tier] === 0 ? '' : totalTroops[activeTab][tier]} onChange={e => setTotalTroops(prev => ({...prev, [activeTab]: {...prev[activeTab], [tier]: Math.max(0, e.target.value==='' ? 0 : parseInt(e.target.value, 10))}}))} placeholder="0" className={`w-32 bg-transparent text-right font-mono text-sm outline-none font-bold ${activeTab === 'infantry' ? 'text-cyan-300' : activeTab === 'cavalry' ? 'text-amber-300' : 'text-rose-300'}`} />
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="bg-slate-950 p-5 border-t border-slate-800 rounded-b-2xl flex flex-col gap-4">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-1">{t('march_builder.assignment_summary')}</h3>
              
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center"><span className="text-[10px] font-bold text-cyan-500 uppercase">{t('march_builder.infantry')}</span><span className="text-xs font-black text-slate-300">{usedInf.toLocaleString()} / {initInf.toLocaleString()} <span className="text-emerald-400 font-normal ml-1">({remInf.toLocaleString()} libere)</span></span></div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden"><div className="bg-cyan-500 h-1.5 rounded-full transition-all" style={{ width: `${initInf > 0 ? (usedInf/initInf)*100 : 0}%` }}></div></div>
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center"><span className="text-[10px] font-bold text-amber-500 uppercase">{t('march_builder.cavalry')}</span><span className="text-xs font-black text-slate-300">{usedCav.toLocaleString()} / {initCav.toLocaleString()} <span className="text-emerald-400 font-normal ml-1">({remCav.toLocaleString()} libere)</span></span></div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden"><div className="bg-amber-500 h-1.5 rounded-full transition-all" style={{ width: `${initCav > 0 ? (usedCav/initCav)*100 : 0}%` }}></div></div>
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center"><span className="text-[10px] font-bold text-rose-500 uppercase">{t('march_builder.archers')}</span><span className="text-xs font-black text-slate-300">{usedArc.toLocaleString()} / {initArc.toLocaleString()} <span className="text-emerald-400 font-normal ml-1">({remArc.toLocaleString()} libere)</span></span></div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden"><div className="bg-rose-500 h-1.5 rounded-full transition-all" style={{ width: `${initArc > 0 ? (usedArc/initArc)*100 : 0}%` }}></div></div>
              </div>
            </div>
          </div>

          {/* BOX SALVATAGGIO CLOUD */}
          <div className="bg-emerald-950/20 border border-emerald-900/50 p-5 rounded-2xl shadow-xl shrink-0 flex flex-col gap-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-[30px] pointer-events-none"></div>
            <div className="relative z-10">
              <h2 className="text-sm font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2"><span>☁️</span> {t('march_builder.sync_title')}</h2>
              <p className="text-[10px] text-slate-400 mt-1 leading-tight">{t('march_builder.sync_desc')}</p>
            </div>
            <button onClick={handleSaveToCloud} disabled={isLoading} className="relative z-10 w-full px-4 py-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-[0_0_20px_rgba(5,150,105,0.4)] disabled:opacity-50 flex items-center justify-center gap-2">
              {isLoading ? t('march_builder.sync_saving') : `💾 ${t('march_builder.sync_save_btn')}`}
            </button>
          </div>

        </div>

        {/* COLONNA DESTRA */}
        <div className="xl:col-span-8 flex flex-col gap-4 overflow-y-auto max-h-[85vh] custom-scrollbar pr-2 pb-10">
          
          <AllianceDoctrine 
            t={t} isOfficer={isOfficer} selectedEvent={selectedEvent} recommendations={allianceRecommendations}
            isEditingRec={isEditingRec} recForm={recForm} onEditClick={handleEditRecommendationClick}
            onCancelEdit={() => setIsEditingRec(false)} onSave={handleSaveRecommendation}
            onUpdateForm={updateRecForm} onApply={handleApplyRecommendation} marches={marches}
            playerMaxMarches={playerMaxMarches}
          />

          {processedMarches.map((pm, index) => (
            <MarchCard 
              key={pm.id} march={pm} index={index} totalMarchesCount={processedMarches.length}
              onDelete={handleDeleteMarch} onUpdateHero={(id, field, val) => setMarches(prev => prev.map(m => m.id === id ? { ...m, [field]: val } : m))}
              onUpdateTroopConfig={handleUpdateTroopConfig} onApplyPreset={handleApplyPreset}
              getAvailableHeroes={(slot) => getAvailableHeroes(pm, slot)} getHeroColor={getHeroColor}
            />
          ))}

          <button onClick={handleAddMarch} className="w-full py-5 border-2 border-dashed border-slate-700 hover:border-cyan-500/50 hover:bg-cyan-900/10 text-slate-400 hover:text-cyan-400 font-black uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2 shrink-0">
            <span className="text-2xl leading-none mb-1">+</span> {t('march_builder.add_march_btn')}
          </button>

        </div>
      </div>
    </div>
  );
}