import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next'; // 🌍 Import i18n
import { db } from '../../firebase'; 
import { collection, addDoc, deleteDoc, doc, query, where, serverTimestamp, updateDoc, onSnapshot, getDoc } from 'firebase/firestore';

export default function EventManagerModal({ 
  isOpen, onClose, currentData, onLoadData, onCreateNewPlan, allianceCode, 
  currentPlanId, currentPlanName, onPlanSaved,
  dbCollection = 'tactical_plans',
  legacyCollection = 'simulations',
  legacyIds = [] 
}) {
  const { t } = useTranslation(); // 🌍 Hook in azione
  const [savedPlans, setSavedPlans] = useState([]);
  const [newPlanName, setNewPlanName] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen || !allianceCode) return;

    setIsFetching(true);
    const plansRef = collection(db, dbCollection);
    const q = query(plansRef, where('allianceCode', '==', allianceCode));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const loadedPlans = [];
      snapshot.forEach(document => {
        loadedPlans.push({ id: document.id, ...document.data() });
      });

      try {
        for (const legacyId of legacyIds) {
          const legacyRef = doc(db, legacyCollection, legacyId);
          const legacySnap = await getDoc(legacyRef);
          
          if (legacySnap.exists()) {
            const legacyData = legacySnap.data();
            loadedPlans.push({
              id: legacySnap.id,
              name: t('event_manager.legacy_autosave', "💾 Autosalvataggio Precedente (Legacy)"),
              data: legacyData.version ? legacyData : { 
                tacticalMeta: legacyData.tacticalMeta || {},
                playerOverrides: legacyData.overrides || legacyData.playerOverrides || {},
                marches: legacyData.marches || []
              },
              createdAt: { seconds: new Date(legacyData.tacticalMeta?.timestamp || legacyData.updatedAt || Date.now()).getTime() / 1000 },
              isLegacy: true
            });
            break; 
          }
        }
      } catch (error) {}
      
      loadedPlans.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setSavedPlans(loadedPlans);
      setIsFetching(false);
    }, (error) => {
      setIsFetching(false);
    });

    return () => unsubscribe();
  }, [isOpen, allianceCode, dbCollection, legacyCollection, legacyIds, t]);

  useEffect(() => {
    if (isOpen) {
      if (currentPlanId && currentPlanName) {
        setNewPlanName(currentPlanName);
      } else {
        const now = new Date();
        const formattedDate = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        setNewPlanName(t('event_manager.default_plan_name', 'Piano {{code}} - {{date}}', { code: allianceCode || 'Regno', date: formattedDate }));
      }
    }
  }, [isOpen, allianceCode, currentPlanId, currentPlanName, t]);

  const saveToFirebase = async (e, isOverwrite = false) => {
    e.preventDefault();
    if (!newPlanName.trim() || !allianceCode) return;
    
    setIsSaving(true);
    try {
      const currentPlan = savedPlans.find(p => p.id === currentPlanId);

      if (isOverwrite && currentPlanId) {
        if (currentPlan?.isLegacy) {
          const docRef = await addDoc(collection(db, dbCollection), {
            name: newPlanName.trim(),
            allianceCode: allianceCode,
            data: currentData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          await deleteDoc(doc(db, legacyCollection, currentPlanId)); 
          onPlanSaved(docRef.id, newPlanName.trim());
        } else {
          const planRef = doc(db, dbCollection, currentPlanId);
          await updateDoc(planRef, {
            name: newPlanName.trim(),
            data: currentData,
            updatedAt: serverTimestamp()
          });
          onPlanSaved(currentPlanId, newPlanName.trim());
        }
      } else {
        const docRef = await addDoc(collection(db, dbCollection), {
          name: newPlanName.trim(),
          allianceCode: allianceCode,
          data: currentData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        onPlanSaved(docRef.id, newPlanName.trim());
      }
      alert(t('event_manager.save_success'));
    } catch (error) {
      alert(t('event_manager.save_error'));
    } finally {
      setIsSaving(false);
    }
  };

  const deletePlanFromFirebase = async (id) => {
    if (window.confirm(t('event_manager.confirm_delete'))) {
      try {
        const planToDelete = savedPlans.find(p => p.id === id);
        if (planToDelete?.isLegacy) {
          await deleteDoc(doc(db, legacyCollection, id));
        } else {
          await deleteDoc(doc(db, dbCollection, id));
        }
        if (id === currentPlanId) {
          onPlanSaved(null, '');
          setNewPlanName(t('event_manager.new_plan_name', 'Nuovo Piano {{code}}', { code: allianceCode }));
        }
      } catch (error) {
        alert(t('event_manager.delete_error'));
      }
    }
  };

  const loadPlan = (plan) => {
    onLoadData(plan.data, plan.id, plan.name);
  };

  const exportToFile = () => {
    const name = newPlanName || currentData.tacticalMeta?.eventName || 'Piano_Tattico';
    const fileName = `Kingshot_${name.replace(/[^a-zA-Z0-9-]/g, '_')}.json`;
    const json = JSON.stringify(currentData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const importFromFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (parsed.tacticalMeta || parsed.playerOverrides || parsed.activeDeployment) {
          onLoadData(parsed, null, file.name.replace('.json', '')); 
        } else {
          alert(t('event_manager.invalid_file'));
        }
      } catch (err) {
        alert(t('event_manager.read_error'));
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const formatDate = (timestamp) => {
    if (!timestamp || !timestamp.seconds) return t('event_manager.unknown_date');
    const d = new Date(timestamp.seconds * 1000);
    return `${d.toLocaleDateString()} - ${d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 animate-in fade-in zoom-in-95 duration-200">
      <div className="bg-slate-900 border border-slate-700 p-6 rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col relative overflow-hidden">
        
        <div className="flex justify-between items-start mb-6 border-b border-slate-800 pb-4 shrink-0">
          <div>
            <h2 className="text-2xl font-black text-white flex items-center gap-3">
              <span>☁️</span> {t('event_manager.title')}
            </h2>
            <p className="text-sm text-slate-400 mt-1">{t('event_manager.subtitle', 'Gestisci le simulazioni della tua Alleanza [{{code}}].', { code: allianceCode })}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:bg-rose-900 hover:text-rose-400 transition-colors font-bold border border-slate-700">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col md:flex-row gap-6 pb-2">
          
          <div className="flex-1 bg-slate-950/50 border border-slate-800 rounded-2xl flex flex-col shadow-inner overflow-hidden">
            <div className="bg-slate-900 p-4 border-b border-slate-800 flex justify-between items-center shrink-0">
              <h3 className="text-sm font-black text-cyan-400 uppercase tracking-widest flex items-center gap-2">
                {t('event_manager.cloud_archive')}
              </h3>
              <span className="text-xs text-slate-500 font-bold">{t('event_manager.plans_count', '{{count}} Piani', { count: savedPlans.length })}</span>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-3 min-h-[300px]">
              {isFetching && savedPlans.length === 0 ? (
                <div className="text-center text-cyan-400 font-bold py-10 animate-pulse">{t('event_manager.syncing')}</div>
              ) : savedPlans.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 py-10 animate-in fade-in duration-500">
                  <span className="text-4xl mb-3 opacity-50">🗄️</span>
                  <p className="text-sm font-bold">{t('event_manager.no_plans')}</p>
                  <p className="text-xs italic mt-1">{t('event_manager.no_plans_desc')}</p>
                </div>
              ) : (
                savedPlans.map(plan => (
                  <div key={plan.id} className={`bg-slate-900 border p-3 rounded-xl flex items-center justify-between hover:border-cyan-500/50 transition-colors group ${plan.id === currentPlanId ? 'border-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.2)]' : 'border-slate-800'}`}>
                    <div className="flex flex-col min-w-0 pr-4">
                      <span className={`font-bold text-sm truncate ${plan.id === currentPlanId ? 'text-cyan-400' : plan.isLegacy ? 'text-amber-400' : 'text-slate-200'}`}>
                        {plan.name} {plan.id === currentPlanId && <span className="ml-2 text-[10px] bg-cyan-900/50 text-cyan-300 px-2 py-0.5 rounded-full uppercase">{t('event_manager.in_use')}</span>}
                      </span>
                      <span className="text-slate-500 text-[10px] font-mono mt-1">{formatDate(plan.updatedAt || plan.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button 
                        onClick={() => loadPlan(plan)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition-colors ${plan.id === currentPlanId ? 'bg-slate-800 text-slate-500 cursor-default' : 'bg-cyan-600/20 hover:bg-cyan-500 text-cyan-400 hover:text-white border border-cyan-600/50'}`}
                        disabled={plan.id === currentPlanId}
                      >
                        {plan.id === currentPlanId ? t('event_manager.active') : t('event_manager.load_btn')}
                      </button>
                      <button 
                        onClick={() => deletePlanFromFirebase(plan.id)}
                        className="bg-slate-800 hover:bg-rose-900 text-slate-500 hover:text-rose-400 border border-slate-700 hover:border-rose-900 w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-colors opacity-50 group-hover:opacity-100"
                        title={t('event_manager.delete_btn')}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="w-full md:w-[350px] flex flex-col gap-6 shrink-0">
            
            <div className="bg-emerald-950/20 border border-emerald-900/50 rounded-2xl flex flex-col shadow-inner overflow-hidden">
              <div className="bg-slate-900/80 p-4 border-b border-emerald-900/30">
                <h3 className="text-sm font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                  {t('event_manager.save_work')}
                </h3>
              </div>
              <div className="p-4 flex flex-col gap-3">
                <label className="text-[10px] font-bold text-slate-400 uppercase">{t('event_manager.current_plan_name')}</label>
                <input 
                  type="text" 
                  value={newPlanName} 
                  onChange={e => setNewPlanName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white text-sm px-3 py-2.5 rounded-xl outline-none focus:border-emerald-500 font-bold"
                  placeholder={t('event_manager.placeholder_name')}
                />
                
                <div className="flex flex-col gap-2 mt-2">
                  {currentPlanId ? (
                    <>
                      <button onClick={(e) => saveToFirebase(e, true)} disabled={!newPlanName.trim() || isSaving} className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:bg-slate-700 text-white font-black py-2.5 rounded-xl transition-colors shadow-lg text-xs flex justify-center gap-2">
                        {isSaving ? t('event_manager.saving_short') : t('event_manager.update_plan')}
                      </button>
                      <button onClick={(e) => saveToFirebase(e, false)} disabled={!newPlanName.trim() || isSaving} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:bg-slate-700 text-white font-black py-2.5 rounded-xl transition-colors shadow-lg text-xs flex justify-center gap-2">
                        {isSaving ? t('event_manager.saving_short') : t('event_manager.save_copy')}
                      </button>
                    </>
                  ) : (
                    <button onClick={(e) => saveToFirebase(e, false)} disabled={!newPlanName.trim() || isSaving} className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:bg-slate-700 text-white font-black py-3 rounded-xl transition-colors shadow-lg text-xs flex justify-center gap-2">
                      {isSaving ? t('event_manager.saving') : t('event_manager.save_new_cloud')}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-amber-950/20 border border-amber-900/50 p-4 rounded-2xl flex flex-col gap-3 shadow-inner text-center items-center">
               <h3 className="text-xs font-black text-amber-500 uppercase tracking-widest">{t('event_manager.start_from_scratch')}</h3>
               <p className="text-[10px] text-slate-400">{t('event_manager.scratch_desc')}</p>
               <button 
                onClick={onCreateNewPlan}
                className="w-full bg-amber-600 hover:bg-amber-500 text-slate-900 px-4 py-2.5 rounded-xl text-xs font-black shadow-lg transition-colors border border-amber-400/50 mt-1"
               >
                 {t('event_manager.clear_board')}
               </button>
            </div>

            <div className="bg-slate-900/50 border border-slate-700/50 p-4 rounded-2xl flex flex-col gap-3 shadow-inner">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">{t('event_manager.local_backup')}</h3>
              <div className="flex gap-2">
                <button onClick={exportToFile} className="flex-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 font-bold py-2 rounded-lg transition-colors text-[10px] uppercase flex justify-center items-center gap-1">{t('event_manager.export')}</button>
                <button onClick={() => fileInputRef.current?.click()} className="flex-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 font-bold py-2 rounded-lg transition-colors text-[10px] uppercase flex justify-center items-center gap-1">{t('event_manager.import')}</button>
                <input type="file" accept=".json" ref={fileInputRef} onChange={importFromFile} className="hidden" />
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}