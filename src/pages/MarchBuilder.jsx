import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { heroesDB, eventTypes } from '../data/heroes';

const TIERS = ['T11', 'T10', 'T9', 'T8', 'T7', 'T6', 'T5', 'T4', 'T3', 'T2', 'T1'];
const initialTiers = TIERS.reduce((acc, tier) => ({ ...acc, [tier]: 0 }), {});

export default function MarchBuilder({ auth }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  
  const [selectedEvent, setSelectedEvent] = useState(eventTypes[0].id);
  const [isLoading, setIsLoading] = useState(false);

  // --- STATI PRINCIPALI ---
  const [totalTroops, setTotalTroops] = useState({
    infantry: { ...initialTiers },
    cavalry: { ...initialTiers },
    archers: { ...initialTiers }
  });
  const [activeTab, setActiveTab] = useState('infantry');
  const [isArmyOpen, setIsArmyOpen] = useState(true); 

  const [globalCapacity, setGlobalCapacity] = useState({ 0: 0, 1: 0, 2: 0, 3: 0 });

  const [marches, setMarches] = useState([
    { 
      id: Date.now(), 
      hero1: '', hero2: '', hero3: '', 
      troopConfig: { mode: 'percent', manual: { inf: 0, cav: 0, arc: 0 }, percent: { inf: 0, cav: 0, arc: 0 } } 
    }
  ]);

  // 💡 STATO PER LA GUIDA DELLA DEMO
  const [showDemoGuide, setShowDemoGuide] = useState(false);

  // 💡 INIEZIONE DATI DEMO AL CARICAMENTO
  useEffect(() => {
    if (auth?.code === 'DEMO' || auth?.code === 'DEMO2') {
      setShowDemoGuide(true);
      setTotalTroops({
        infantry: { ...initialTiers, T11: 50000, T10: 150000, T9: 100000 },
        cavalry: { ...initialTiers, T11: 40000, T10: 200000, T9: 100000 },
        archers: { ...initialTiers, T11: 80000, T10: 180000, T9: 100000 }
      });
      setGlobalCapacity({ 0: 50000, 1: 90000, 2: 130000, 3: 175000 });
      setMarches([{ 
        id: 'demo_march_1', 
        hero1: 'h_inf_1', // Forrest
        hero2: 'h_cav_1', // Edwin
        hero3: 'h_arc_1', // Olive
        troopConfig: { mode: 'percent', manual: { inf: 0, cav: 0, arc: 0 }, percent: { inf: 50, cav: 30, arc: 20 } } 
      }]);
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

  // --- FUNZIONE DI SALVATAGGIO CLOUD ---
  const handleSaveToCloud = async () => {
    setIsLoading(true);
    try {
      const docId = `${auth.code}_${auth.playerId}`;
      await setDoc(doc(db, "playerMarches", docId), {
        allianceCode: auth.code,
        playerId: auth.playerId,
        playerName: auth.playerName,
        event: selectedEvent,
        globalCapacity,
        totalTroops,
        marches,
        lastUpdated: new Date().toISOString()
      }, { merge: true });
      
      alert("✅ Formazioni salvate con successo su Firebase!");
    } catch (error) {
      console.error("Errore durante il salvataggio:", error);
      alert("❌ Errore durante il salvataggio in Cloud.");
    }
    setIsLoading(false);
  };

  // --- HELPER FUNZIONI ---
  const getSumOfType = (type) => Object.values(totalTroops[type]).reduce((sum, val) => sum + val, 0);
  const countDeployedHeroes = (march) => (march.hero1 ? 1 : 0) + (march.hero2 ? 1 : 0) + (march.hero3 ? 1 : 0);

  const getAvailableBeforeMarch = (currentMarches, targetIndex, field) => {
    const fullType = field === 'inf' ? 'infantry' : field === 'cav' ? 'cavalry' : 'archers';
    let available = getSumOfType(fullType);
    for (let i = 0; i < targetIndex; i++) {
      const m = currentMarches[i];
      const activeH = countDeployedHeroes(m);
      const cap = globalCapacity[activeH] || 0;
      let req = m.troopConfig.mode === 'manual' ? (m.troopConfig.manual[field] || 0) : Math.floor(cap * ((m.troopConfig.percent[field] || 0) / 100));
      available -= Math.min(available, req);
    }
    return Math.max(0, available);
  };

  const getHeroCountLabel = (num) => {
    if(num === 0) return t('march_builder.hero_count_0');
    if(num === 1) return t('march_builder.hero_count_1');
    if(num === 2) return t('march_builder.hero_count_2');
    if(num === 3) return t('march_builder.hero_count_3');
    return `${num} Heroes`;
  };

  // --- AZIONI UI ---
  const handleTroopChange = (type, tier, value) => {
    const numValue = value === '' ? 0 : parseInt(value, 10);
    setTotalTroops(prev => ({ ...prev, [type]: { ...prev[type], [tier]: Math.max(0, numValue) } }));
  };

  const handleUpdateGlobalCapacity = (heroCount, value) => {
    const numVal = value === '' ? 0 : Number(value);
    setGlobalCapacity(prev => ({ ...prev, [heroCount]: Math.max(0, numVal) }));
  };

  const handleUpdateMarchHero = (id, field, value) => setMarches(marches.map(m => m.id === id ? { ...m, [field]: value } : m));

  const handleUpdateTroopConfig = (marchId, section, field, value) => {
    setMarches(prevMarches => {
      const targetIndex = prevMarches.findIndex(m => m.id === marchId);
      if (targetIndex === -1) return prevMarches;
      
      const m = prevMarches[targetIndex];
      if (section === 'mode') {
        return prevMarches.map((march, i) => i === targetIndex ? { ...march, troopConfig: { ...march.troopConfig, mode: value } } : march);
      }

      const numVal = value === '' ? 0 : Number(value);
      let clampedValue = numVal;

      const available = getAvailableBeforeMarch(prevMarches, targetIndex, field);
      const activeH = countDeployedHeroes(m);
      const cap = globalCapacity[activeH] || 0;

      if (section === 'manual') {
        clampedValue = Math.min(numVal, available);
      } else if (section === 'percent') {
        if (cap > 0) {
          const maxPercent = Math.floor((available / cap) * 100);
          clampedValue = Math.min(numVal, maxPercent);
        } else {
          clampedValue = 0;
        }
      }

      return prevMarches.map((march, i) => {
        if (i !== targetIndex) return march;
        return { ...march, troopConfig: { ...march.troopConfig, [section]: { ...march.troopConfig[section], [field]: clampedValue } } };
      });
    });
  };

  const handleApplyPreset = (marchId, infP, cavP, arcP) => {
    setMarches(prevMarches => {
      const targetIndex = prevMarches.findIndex(m => m.id === marchId);
      if (targetIndex === -1) return prevMarches;

      const m = prevMarches[targetIndex];
      const activeH = countDeployedHeroes(m);
      const cap = globalCapacity[activeH] || 0;

      if (cap === 0) { alert(t('march_builder.set_global_capacity_alert')); return prevMarches; }

      const availInf = getAvailableBeforeMarch(prevMarches, targetIndex, 'inf');
      const availCav = getAvailableBeforeMarch(prevMarches, targetIndex, 'cav');
      const availArc = getAvailableBeforeMarch(prevMarches, targetIndex, 'arc');

      const clampedInf = Math.min(infP, Math.floor((availInf / cap) * 100));
      const clampedCav = Math.min(cavP, Math.floor((availCav / cap) * 100));
      const clampedArc = Math.min(arcP, Math.floor((availArc / cap) * 100));

      return prevMarches.map((march, i) => {
        if (i !== targetIndex) return march;
        return { ...march, troopConfig: { ...march.troopConfig, mode: 'percent', percent: { inf: clampedInf, cav: clampedCav, arc: clampedArc } } };
      });
    });
  };

  const handleDeleteMarch = (id) => setMarches(marches.filter(m => m.id !== id));

  // --- L'ALGORITMO TOP-DOWN ---
  let availableCity = JSON.parse(JSON.stringify(totalTroops)); 
  
  const processedMarches = marches.map(march => {
    const activeHeroesCount = countDeployedHeroes(march);
    const currentMaxCapacity = globalCapacity[activeHeroesCount] || 0;

    const safeConfig = march.troopConfig || {};
    const mode = safeConfig.mode || 'manual';
    const manual = safeConfig.manual || { inf: 0, cav: 0, arc: 0 };
    const percent = safeConfig.percent || { inf: 0, cav: 0, arc: 0 };

    let reqInf = 0, reqCav = 0, reqArc = 0;
    let currentTotal = 0;

    if (mode === 'manual') {
      reqInf = manual.inf; reqCav = manual.cav; reqArc = manual.arc;
      currentTotal = reqInf + reqCav + reqArc;
    } else {
      reqInf = Math.floor(currentMaxCapacity * (percent.inf / 100));
      reqCav = Math.floor(currentMaxCapacity * (percent.cav / 100));
      reqArc = Math.floor(currentMaxCapacity * (percent.arc / 100));
      currentTotal = percent.inf + percent.cav + percent.arc; 
    }

    const drawTroops = (type, amount) => {
      let needed = amount;
      let pulled = {};
      for (let t of TIERS) {
        if (needed <= 0) break;
        let avail = availableCity[type][t];
        if (avail > 0) {
          let take = Math.min(avail, needed);
          pulled[t] = take;
          availableCity[type][t] -= take; 
          needed -= take;
        }
      }
      return { pulled, missing: needed, totalPulled: amount - needed };
    };

    return {
      ...march,
      activeHeroesCount, currentMaxCapacity, mode, manual, percent,
      reqInf, reqCav, reqArc, currentTotal,
      realInf: drawTroops('infantry', reqInf),
      realCav: drawTroops('cavalry', reqCav),
      realArc: drawTroops('archers', reqArc)
    };
  });

  // --- CALCOLO GLOBALE TRUPPE ---
  const initInf = getSumOfType('infantry');
  const initCav = getSumOfType('cavalry');
  const initArc = getSumOfType('archers');
  
  const remInf = Object.values(availableCity.infantry).reduce((a,b)=>a+b,0);
  const remCav = Object.values(availableCity.cavalry).reduce((a,b)=>a+b,0);
  const remArc = Object.values(availableCity.archers).reduce((a,b)=>a+b,0);
  
  const usedInf = initInf - remInf;
  const usedCav = initCav - remCav;
  const usedArc = initArc - remArc;

  const handleAddMarch = () => {
    if (marches.length >= 6) return alert(t('march_builder.max_marches_alert'));
    if (remInf + remCav + remArc <= 0 && marches.length > 0) return alert(t('march_builder.no_troops_alert'));
    setMarches([...marches, { id: Date.now(), hero1: '', hero2: '', hero3: '', troopConfig: { mode: 'percent', manual: { inf: 0, cav: 0, arc: 0 }, percent: { inf: 0, cav: 0, arc: 0 } } }]);
  };

  const getHeroColor = (rarity) => {
    switch(rarity) {
      case 'legendary': return 'text-amber-400';
      case 'epic': return 'text-purple-400';
      case 'rare': return 'text-blue-400';
      default: return 'text-slate-300';
    }
  };

  const getAvailableHeroes = (currentMarch, currentSlot) => {
    const otherSlots = ['hero1', 'hero2', 'hero3'].filter(s => s !== currentSlot);
    const usedTypesInThisMarch = otherSlots.map(slot => {
      const hId = currentMarch[slot];
      const hero = heroesDB.find(h => h.id === hId);
      return hero ? hero.type : null;
    }).filter(Boolean);

    const usedHeroIdsInOtherMarches = [];
    marches.forEach(m => {
      if (m.id !== currentMarch.id) {
        if (m.hero1) usedHeroIdsInOtherMarches.push(m.hero1);
        if (m.hero2) usedHeroIdsInOtherMarches.push(m.hero2);
        if (m.hero3) usedHeroIdsInOtherMarches.push(m.hero3);
      }
    });

    return heroesDB.filter(h => {
      if (h.id === currentMarch[currentSlot]) return true;
      if (usedTypesInThisMarch.includes(h.type)) return false;
      if (usedHeroIdsInOtherMarches.includes(h.id)) return false;
      return true;
    });
  };

  const renderResultBox = (data, title, emptyText, type) => {
    if (data.totalPulled === 0 && data.missing === 0) {
      return <div className="bg-slate-900/50 border border-slate-800 p-2 rounded-lg flex items-center justify-center text-[10px] text-slate-600">{emptyText}</div>;
    }
    let bgClass = type === 'inf' ? 'bg-cyan-950/20 border-cyan-900/50' : type === 'cav' ? 'bg-amber-950/20 border-amber-900/50' : 'bg-rose-950/20 border-rose-900/50';
    let titleClass = type === 'inf' ? 'text-cyan-500' : type === 'cav' ? 'text-amber-500' : 'text-rose-500';
    let valClass = type === 'inf' ? 'text-cyan-300' : type === 'cav' ? 'text-amber-300' : 'text-rose-300';

    return (
      <div className={`${bgClass} border p-3 rounded-lg flex flex-col gap-1`}>
        <div className="flex justify-between items-center mb-1">
          <span className={`text-[10px] font-bold ${titleClass} uppercase`}>{title}</span>
          <span className={`text-xs font-black ${valClass}`}>{data.totalPulled.toLocaleString()}</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {Object.entries(data.pulled).map(([t, amt]) => amt > 0 && (
            <span key={t} className="text-[9px] bg-slate-900 px-1.5 py-0.5 rounded text-slate-400 border border-slate-800">{t}: <span className="text-white">{amt.toLocaleString()}</span></span>
          ))}
        </div>
        {data.missing > 0 && <span className="text-[9px] text-rose-500 font-bold mt-1">{t('march_builder.missing_in_city', { count: data.missing.toLocaleString() })}</span>}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8 flex flex-col gap-6 text-slate-200 relative overflow-hidden">
      
      {/* 💡 MODAL GUIDA DEMO */}
      {showDemoGuide && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-slate-700 p-8 rounded-3xl shadow-2xl max-w-2xl w-full">
            <h2 className="text-2xl font-black text-emerald-400 mb-2">{t('march_builder.demo_title', 'Benvenuto nel Costruttore! ⚙️')}</h2>
            <p className="text-sm text-slate-300 mb-6">{t('march_builder.demo_desc', 'Sei in modalità Sandbox. Abbiamo caricato 1 Milione di truppe e configurato una marcia per mostrarti il motore in azione.')}</p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                <span className="text-3xl mb-2 block">🏦</span>
                <h3 className="font-bold text-cyan-400 text-sm">{t('march_builder.demo_step1_title', '1. Il Magazzino Città')}</h3>
                <p className="text-[10px] text-slate-400 mt-1 leading-tight">{t('march_builder.demo_step1_desc', 'A sinistra hai le tue truppe totali. Il sistema calcola in tempo reale quante ne usi e quante ne restano.')}</p>
              </div>
              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                <span className="text-3xl mb-2 block">🧮</span>
                <h3 className="font-bold text-amber-400 text-sm">{t('march_builder.demo_step2_title', '2. Estrazione Top-Down')}</h3>
                <p className="text-[10px] text-slate-400 mt-1 leading-tight">{t('march_builder.demo_step2_desc', 'Usa le percentuali. Il simulatore preleverà le truppe partendo sempre dal Livello (Tier) più alto disponibile!')}</p>
              </div>
              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                <span className="text-3xl mb-2 block">🛡️</span>
                <h3 className="font-bold text-rose-400 text-sm">{t('march_builder.demo_step3_title', '3. Filtro Intelligente')}</h3>
                <p className="text-[10px] text-slate-400 mt-1 leading-tight">{t('march_builder.demo_step3_desc', 'Un eroe non può guidare due marce diverse e non puoi mettere due eroi di Fanteria nella stessa marcia.')}</p>
              </div>
            </div>

            <button onClick={() => setShowDemoGuide(false)} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest rounded-xl transition-all shadow-[0_0_20px_rgba(5,150,105,0.4)]">
              {t('march_builder.demo_start_btn', 'Inizia a Sperimentare')}
            </button>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header className="flex justify-between items-center bg-slate-900/50 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/5 shadow-lg shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-colors">{t('march_builder.hub_btn')}</button>
          <h1 className="text-xl md:text-2xl font-black text-white flex items-center gap-2"><span className="text-cyan-500">⚙️</span> {t('march_builder.builder_title')}</h1>
        </div>
        <div className="text-right hidden sm:block">
          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{t('march_builder.active_profile')}</div>
          <div className="text-sm font-bold text-cyan-400">🛡️ {auth.playerName}</div>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start flex-1 overflow-hidden z-10">
        
        {/* COLONNA SINISTRA: Impostazioni Generali e Magazzino */}
        <div className="xl:col-span-4 flex flex-col gap-6 xl:sticky xl:top-6 max-h-[85vh] overflow-y-auto custom-scrollbar pb-6 pr-2">
          
          <div className="bg-slate-900 border border-slate-700 p-5 rounded-2xl shadow-xl shrink-0">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">{t('march_builder.target_event')}</label>
            <select value={selectedEvent} onChange={(e) => setSelectedEvent(e.target.value)} className="w-full bg-slate-950 border border-indigo-500/50 text-indigo-300 text-sm font-bold px-4 py-3 rounded-xl focus:outline-none focus:border-indigo-400 cursor-pointer">
              {eventTypes.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
            </select>
            {/* 💡 PULSANTE CLOUD COLLEGATO A FIREBASE */}
            <button 
              onClick={handleSaveToCloud} 
              disabled={isLoading}
              className="mt-4 w-full px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-[0_0_15px_rgba(5,150,105,0.4)] disabled:opacity-50"
            >
              {isLoading ? "Salvataggio..." : t('march_builder.save_cloud_btn')}
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-700 p-5 rounded-2xl shadow-xl shrink-0">
            <div className="border-b border-slate-800 pb-2 mb-3">
              <h2 className="text-sm font-black text-indigo-400 uppercase tracking-widest">{t('march_builder.global_capacity_title')}</h2>
              <p className="text-[10px] text-slate-500 leading-tight mt-1">{t('march_builder.global_capacity_desc')}</p>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              {[0, 1, 2, 3].map(num => (
                <div key={`cap-${num}`} className="flex flex-col gap-1 p-2 rounded-xl border bg-slate-950 border-slate-800 focus-within:border-indigo-500/50 transition-colors">
                  <label className="text-[9px] font-bold text-slate-500 text-center">{getHeroCountLabel(num)}</label>
                  <input type="number" min="0" value={globalCapacity[num] === 0 ? '' : globalCapacity[num]} onChange={(e) => handleUpdateGlobalCapacity(num, e.target.value)} className="w-full bg-transparent text-center text-indigo-300 font-mono text-sm font-bold outline-none" placeholder="0" />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-xl flex flex-col flex-shrink">
            <div 
              className="p-5 border-b border-slate-800 bg-slate-900/80 shrink-0 cursor-pointer flex justify-between items-center hover:bg-slate-800/80 transition-colors rounded-t-2xl"
              onClick={() => setIsArmyOpen(!isArmyOpen)}
            >
              <div>
                <h2 className="text-sm font-black text-cyan-400 uppercase tracking-widest">{t('march_builder.your_army_title')}</h2>
                <p className="text-[10px] text-slate-500 mt-1 leading-tight">{t('march_builder.manage_troops_desc')}</p>
              </div>
              <span className="text-xl opacity-70">{isArmyOpen ? '🔽' : '▶️'}</span>
            </div>
            
            {isArmyOpen && (
              <>
                <div className="flex bg-slate-950 p-2 border-b border-slate-800 shrink-0">
                  <button onClick={() => setActiveTab('infantry')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${activeTab === 'infantry' ? 'bg-cyan-900/40 text-cyan-400 border border-cyan-500/50' : 'text-slate-500 hover:text-slate-300'}`}>
                    {t('march_builder.inf_short')} <br/><span className="text-[9px] opacity-70">({initInf.toLocaleString()})</span>
                  </button>
                  <button onClick={() => setActiveTab('cavalry')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${activeTab === 'cavalry' ? 'bg-amber-900/40 text-amber-400 border border-amber-500/50' : 'text-slate-500 hover:text-slate-300'}`}>
                    {t('march_builder.cav_short')} <br/><span className="text-[9px] opacity-70">({initCav.toLocaleString()})</span>
                  </button>
                  <button onClick={() => setActiveTab('archers')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${activeTab === 'archers' ? 'bg-rose-900/40 text-rose-400 border border-rose-500/50' : 'text-slate-500 hover:text-slate-300'}`}>
                    {t('march_builder.arc_short')} <br/><span className="text-[9px] opacity-70">({initArc.toLocaleString()})</span>
                  </button>
                </div>

                <div className="max-h-[300px] overflow-y-auto p-4 custom-scrollbar">
                  <div className="flex flex-col gap-2">
                    {TIERS.map(tier => (
                      <div key={`${activeTab}-${tier}`} className={`flex items-center justify-between bg-slate-950 p-2.5 rounded-lg border transition-colors ${totalTroops[activeTab][tier] > 0 ? (activeTab === 'infantry' ? 'border-cyan-500/30 bg-cyan-950/10' : activeTab === 'cavalry' ? 'border-amber-500/30 bg-amber-950/10' : 'border-rose-500/30 bg-rose-950/10') : 'border-slate-800'}`}>
                        <span className={`text-xs font-black w-12 ${totalTroops[activeTab][tier] > 0 ? 'text-slate-200' : 'text-slate-600'}`}>{tier}</span>
                        <input type="number" min="0" value={totalTroops[activeTab][tier] === 0 ? '' : totalTroops[activeTab][tier]} onChange={e => handleTroopChange(activeTab, tier, e.target.value)} placeholder="0" className={`w-32 bg-transparent text-right font-mono text-sm outline-none font-bold ${activeTab === 'infantry' ? 'text-cyan-300' : activeTab === 'cavalry' ? 'text-amber-300' : 'text-rose-300'}`} />
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="bg-slate-950 p-5 border-t border-slate-800 rounded-b-2xl flex flex-col gap-4">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-1">{t('march_builder.assignment_summary')}</h3>
              
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-cyan-500 uppercase">{t('march_builder.infantry')}</span>
                  <span className="text-xs font-black text-slate-300">{usedInf.toLocaleString()} / {initInf.toLocaleString()} <span className="text-emerald-400 font-normal ml-1">({remInf.toLocaleString()} {t('march_builder.free_troops')})</span></span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden"><div className="bg-cyan-500 h-1.5 rounded-full transition-all" style={{ width: `${initInf > 0 ? (usedInf/initInf)*100 : 0}%` }}></div></div>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-amber-500 uppercase">{t('march_builder.cavalry')}</span>
                  <span className="text-xs font-black text-slate-300">{usedCav.toLocaleString()} / {initCav.toLocaleString()} <span className="text-emerald-400 font-normal ml-1">({remCav.toLocaleString()} {t('march_builder.free_troops')})</span></span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden"><div className="bg-amber-500 h-1.5 rounded-full transition-all" style={{ width: `${initCav > 0 ? (usedCav/initCav)*100 : 0}%` }}></div></div>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-rose-500 uppercase">{t('march_builder.archers')}</span>
                  <span className="text-xs font-black text-slate-300">{usedArc.toLocaleString()} / {initArc.toLocaleString()} <span className="text-emerald-400 font-normal ml-1">({remArc.toLocaleString()} {t('march_builder.free_troops')})</span></span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden"><div className="bg-rose-500 h-1.5 rounded-full transition-all" style={{ width: `${initArc > 0 ? (usedArc/initArc)*100 : 0}%` }}></div></div>
              </div>
            </div>

          </div>
        </div>

        {/* COLONNA DESTRA: Le Marce */}
        <div className="xl:col-span-8 flex flex-col gap-4 overflow-y-auto max-h-[85vh] custom-scrollbar pr-2 pb-10">
          
          {processedMarches.map((pm, index) => (
            <div key={pm.id} className="bg-slate-900 border border-slate-700 rounded-2xl flex flex-col relative shadow-lg animate-in slide-in-from-bottom-4 shrink-0">
              
              <div className="bg-slate-800/50 px-4 py-3 border-b border-slate-700 flex justify-between items-center">
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <span className="bg-indigo-600 text-white w-6 h-6 rounded flex items-center justify-center text-xs">{index + 1}</span>
                  {t('march_builder.march_number')} {index + 1}
                </h3>
                {processedMarches.length > 1 && (
                  <button onClick={() => handleDeleteMarch(pm.id)} className="text-slate-500 hover:text-rose-500 text-xs font-bold transition-colors px-2 py-1 rounded bg-slate-900 border border-slate-700">{t('march_builder.remove_btn')}</button>
                )}
              </div>

              <div className="p-4 md:p-6 flex flex-col gap-6">
                
                <div className="flex flex-col lg:flex-row gap-6">
                  
                  <div className="lg:w-2/3 flex flex-col gap-3">
                    <div className="flex justify-between items-end border-b border-slate-800 pb-1 mb-1">
                      <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('march_builder.commanders_step')}</h4>
                      <span className="text-[10px] font-bold text-slate-600">{t('march_builder.deployed_heroes', { count: pm.activeHeroesCount })}</span>
                    </div>
                    
                    <div className={`flex items-center gap-2 bg-slate-950 p-2 rounded-xl border ${pm.hero1 ? 'border-amber-500/50' : 'border-slate-800'} transition-colors`}>
                      <span className="text-lg w-8 text-center drop-shadow-md">👑</span>
                      <select value={pm.hero1} onChange={(e) => handleUpdateMarchHero(pm.id, 'hero1', e.target.value)} className="flex-1 bg-transparent text-sm font-bold text-slate-200 outline-none cursor-pointer">
                        <option value="">{t('march_builder.select_primary')}</option>
                        {getAvailableHeroes(pm, 'hero1').map(h => <option key={h.id} value={h.id} className={getHeroColor(h.rarity)}>[G{h.gen}] {h.name} ({h.type})</option>)}
                      </select>
                    </div>
                    <div className={`flex items-center gap-2 bg-slate-950 p-2 rounded-xl border ${pm.hero2 ? 'border-cyan-500/50' : 'border-slate-800'} transition-colors`}>
                      <span className="text-lg w-8 text-center drop-shadow-md">⚔️</span>
                      <select value={pm.hero2} onChange={(e) => handleUpdateMarchHero(pm.id, 'hero2', e.target.value)} className="flex-1 bg-transparent text-sm font-bold text-slate-200 outline-none cursor-pointer">
                        <option value="">{t('march_builder.select_secondary')}</option>
                        {getAvailableHeroes(pm, 'hero2').map(h => <option key={h.id} value={h.id} className={getHeroColor(h.rarity)}>[G{h.gen}] {h.name} ({h.type})</option>)}
                      </select>
                    </div>
                    <div className={`flex items-center gap-2 bg-slate-950 p-2 rounded-xl border ${pm.hero3 ? 'border-emerald-500/50' : 'border-slate-800'} transition-colors`}>
                      <span className="text-lg w-8 text-center drop-shadow-md">🛡️</span>
                      <select value={pm.hero3} onChange={(e) => handleUpdateMarchHero(pm.id, 'hero3', e.target.value)} className="flex-1 bg-transparent text-sm font-bold text-slate-200 outline-none cursor-pointer">
                        <option value="">{t('march_builder.select_support')}</option>
                        {getAvailableHeroes(pm, 'hero3').map(h => <option key={h.id} value={h.id} className={getHeroColor(h.rarity)}>[G{h.gen}] {h.name} ({h.type})</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="lg:w-1/3 flex flex-col justify-center">
                    <div className="bg-indigo-900/30 border border-indigo-500/50 p-4 rounded-xl flex flex-col items-center justify-center text-center shadow-inner h-full">
                      <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-1">{t('march_builder.current_capacity')}</span>
                      <span className="text-3xl font-black text-white font-mono">{pm.currentMaxCapacity.toLocaleString()}</span>
                      <span className="text-[10px] text-slate-400 mt-2">{t('march_builder.value_from_global')}</span>
                    </div>
                  </div>

                </div>

                <div className={`flex flex-col gap-3 transition-opacity ${pm.currentMaxCapacity === 0 ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                  
                  <div className="flex flex-col border-b border-slate-800 pb-3 mb-1 gap-2">
                    <div className="flex justify-between items-end">
                      <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('march_builder.troop_request_step')}</h4>
                      <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-700">
                        <button onClick={() => handleUpdateTroopConfig(pm.id, 'mode', 'manual')} className={`px-3 py-1 text-[10px] font-bold rounded uppercase transition-colors ${pm.mode === 'manual' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>{t('march_builder.manual_mode')}</button>
                        <button onClick={() => handleUpdateTroopConfig(pm.id, 'mode', 'percent')} className={`px-3 py-1 text-[10px] font-bold rounded uppercase transition-colors ${pm.mode === 'percent' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>{t('march_builder.percent_mode')}</button>
                      </div>
                    </div>
                    
                    {pm.mode === 'percent' && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        <span className="text-[9px] font-bold text-slate-600 self-center mr-1">{t('march_builder.quick_presets')}</span>
                        <button onClick={() => handleApplyPreset(pm.id, 50, 30, 20)} className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 rounded-lg border border-slate-600 transition-colors">50-30-20</button>
                        <button onClick={() => handleApplyPreset(pm.id, 60, 40, 0)} className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 rounded-lg border border-slate-600 transition-colors">60-40-0</button>
                        <button onClick={() => handleApplyPreset(pm.id, 10, 10, 80)} className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 rounded-lg border border-slate-600 transition-colors">10-10-80</button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="flex flex-col gap-2 bg-cyan-950/10 p-3 rounded-xl border border-cyan-900/30">
                      <label className="text-[10px] font-bold text-cyan-500 uppercase text-center">{t('march_builder.infantry')}</label>
                      <div className="relative">
                        <input type="number" min="0" value={pm.mode === 'manual' ? (pm.manual.inf === 0 ? '' : pm.manual.inf) : (pm.percent.inf === 0 ? '' : pm.percent.inf)} onChange={(e) => handleUpdateTroopConfig(pm.id, pm.mode, 'inf', e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 text-center text-cyan-300 font-mono text-sm outline-none focus:border-cyan-500 pr-6" />
                        {pm.mode === 'percent' && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-cyan-600 text-xs">%</span>}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 bg-amber-950/10 p-3 rounded-xl border border-amber-900/30">
                      <label className="text-[10px] font-bold text-amber-500 uppercase text-center">{t('march_builder.cavalry')}</label>
                      <div className="relative">
                        <input type="number" min="0" value={pm.mode === 'manual' ? (pm.manual.cav === 0 ? '' : pm.manual.cav) : (pm.percent.cav === 0 ? '' : pm.percent.cav)} onChange={(e) => handleUpdateTroopConfig(pm.id, pm.mode, 'cav', e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 text-center text-amber-300 font-mono text-sm outline-none focus:border-amber-500 pr-6" />
                        {pm.mode === 'percent' && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-600 text-xs">%</span>}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 bg-rose-950/10 p-3 rounded-xl border border-rose-900/30">
                      <label className="text-[10px] font-bold text-rose-500 uppercase text-center">{t('march_builder.archers')}</label>
                      <div className="relative">
                        <input type="number" min="0" value={pm.mode === 'manual' ? (pm.manual.arc === 0 ? '' : pm.manual.arc) : (pm.percent.arc === 0 ? '' : pm.percent.arc)} onChange={(e) => handleUpdateTroopConfig(pm.id, pm.mode, 'arc', e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 text-center text-rose-300 font-mono text-sm outline-none focus:border-rose-500 pr-6" />
                        {pm.mode === 'percent' && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-rose-600 text-xs">%</span>}
                      </div>
                    </div>
                  </div>

                  <div className="mt-1 flex justify-end">
                    {pm.mode === 'manual' ? (
                      <span className={`text-xs font-bold px-3 py-1.5 rounded-lg border shadow-lg ${pm.currentTotal > pm.currentMaxCapacity ? 'bg-rose-900/80 text-white border-rose-500' : 'bg-slate-900 text-emerald-400 border-emerald-500/30'}`}>
                        {t('march_builder.total_requested')} {pm.currentTotal.toLocaleString()} / {pm.currentMaxCapacity.toLocaleString()} {pm.currentTotal > pm.currentMaxCapacity && t('march_builder.exceeded')}
                      </span>
                    ) : (
                      <span className={`text-xs font-bold px-3 py-1.5 rounded-lg border shadow-lg ${pm.currentTotal !== 100 ? 'bg-rose-900/80 text-white border-rose-500' : 'bg-emerald-950/80 text-emerald-400 border-emerald-500'}`}>
                        {t('march_builder.percentage')} {pm.currentTotal}% {pm.currentTotal !== 100 && t('march_builder.must_be_100')}
                      </span>
                    )}
                  </div>

                  <div className="mt-2 bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col gap-3">
                    <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest border-b border-slate-800 pb-1">{t('march_builder.real_composition_step')}</h4>
                    <p className="text-[9px] text-slate-500 leading-tight">{t('march_builder.real_composition_desc')}</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-1">
                      {renderResultBox(pm.realInf, t('march_builder.infantry'), t('march_builder.no_infantry'), 'inf')}
                      {renderResultBox(pm.realCav, t('march_builder.cavalry'), t('march_builder.no_cavalry'), 'cav')}
                      {renderResultBox(pm.realArc, t('march_builder.archers'), t('march_builder.no_archers'), 'arc')}
                    </div>
                  </div>

                </div>
              </div>
            </div>
          ))}

          <button onClick={handleAddMarch} className="w-full py-5 border-2 border-dashed border-slate-700 hover:border-cyan-500/50 hover:bg-cyan-900/10 text-slate-400 hover:text-cyan-400 font-black uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2 shrink-0">
            <span className="text-2xl leading-none mb-1">+</span> {t('march_builder.add_march_btn')}
          </button>

        </div>
      </div>
    </div>
  );
}