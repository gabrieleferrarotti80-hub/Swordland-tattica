import React, { useState } from 'react';
import { heroesDB } from '../../data/heroes';

export default function AllianceDoctrine({
  isOfficer, selectedEvent, recommendations, isEditingRec,
  recForm, onEditClick, onCancelEdit, onSave, onUpdateForm,
  onApply, marches, playerMaxMarches, t
}) {
  const [joinerRatio, setJoinerRatio] = useState({ inf: 10, cav: 10, arc: 80 });

  if (!isOfficer && !recommendations[selectedEvent]) return null;

  const renderRecViewRow = (typeKey, title, icon) => {
    const rec = recommendations[selectedEvent]?.[typeKey];
    const targetRec = rec || (typeKey === 'leader' && !recommendations[selectedEvent]?.joiner ? recommendations[selectedEvent] : null);
    
    if (!targetRec) return null;

    if (typeKey === 'leader') {
      return (
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-900 p-3 rounded-xl border border-slate-700 w-full shadow-inner">
          <div className="flex flex-col gap-2 w-full md:w-auto flex-1">
            <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-widest flex items-center gap-2"><span>{icon}</span> {title}</h4>
            
            <div className="flex gap-2">
              {[1, 2, 3].map(num => {
                const hId = targetRec[`hero${num}`];
                const hero = heroesDB.find(h => h.id === hId);
                return hero ? (
                  <div key={num} className="bg-slate-950 px-2 py-1 rounded border border-slate-800 text-[10px] font-bold text-slate-200">
                    {hero.name} <span className="text-[8px] text-slate-500 ml-1">({hero.type})</span>
                  </div>
                ) : null;
              })}
            </div>

            <div className="flex gap-2">
              <span className="bg-cyan-950/40 text-cyan-400 border border-cyan-900 px-2 py-0.5 rounded text-[9px] font-black">{t('march_builder.infantry')}: {targetRec.inf || 0}%</span>
              <span className="bg-amber-950/40 text-amber-400 border border-amber-900 px-2 py-0.5 rounded text-[9px] font-black">{t('march_builder.cavalry')}: {targetRec.cav || 0}%</span>
              <span className="bg-rose-950/40 text-rose-400 border border-rose-900 px-2 py-0.5 rounded text-[9px] font-black">{t('march_builder.archers')}: {targetRec.arc || 0}%</span>
            </div>
          </div>

          <div className="shrink-0 flex flex-col gap-1.5 w-full md:w-auto items-center md:items-end border-t md:border-t-0 md:border-l border-slate-700 pt-2 md:pt-0 md:pl-4">
            <span className="text-[9px] text-slate-500 uppercase font-bold text-center">{t('march_builder.doctrine_overwrite_single')}</span>
            <div className="flex gap-1.5 flex-wrap justify-center">
              {marches.map((m, idx) => (
                <button key={m.id} onClick={() => onApply(m.id, typeKey)} className="w-7 h-7 flex items-center justify-center bg-indigo-900/50 hover:bg-indigo-600 text-indigo-200 hover:text-white font-black text-[10px] rounded border border-indigo-500/30 transition-all" title={`M${idx + 1}`}>M{idx + 1}</button>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (typeKey === 'joiner') {
      const heroesList = [targetRec.heroA, targetRec.heroB, targetRec.heroC, targetRec.heroD, targetRec.heroE, targetRec.heroF].filter(Boolean);
      return (
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-900 p-4 rounded-xl border border-slate-700 w-full shadow-inner relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-[40px] pointer-events-none"></div>
          
          <div className="flex flex-col gap-3 w-full md:w-auto flex-1 relative z-10">
            <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2"><span>{icon}</span> {title}</h4>
            
            <div className="flex gap-2 flex-wrap items-center">
              <span className="text-[10px] text-slate-400">{t('march_builder.doctrine_allowed_captains')}</span>
              {heroesList.map(hId => {
                const hero = heroesDB.find(h => h.id === hId);
                return hero ? <div key={hId} className="bg-slate-950 px-2 py-1 rounded border border-slate-800 text-[10px] font-bold text-slate-200 shadow-sm">{hero.name}</div> : null;
              })}
              {heroesList.length === 0 && <span className="text-[10px] text-slate-500 italic">{t('march_builder.doctrine_any')}</span>}
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{t('march_builder.doctrine_auto_calc_settings')}</span>
              <div className="flex gap-2 flex-wrap items-center bg-slate-950/50 p-2 rounded-lg border border-slate-800">
                <span className="bg-emerald-950 text-emerald-400 border border-emerald-900 px-3 py-1 rounded text-[10px] font-black mr-2">
                  {t('march_builder.doctrine_max_badge')} {targetRec.maxTroops > 0 ? targetRec.maxTroops.toLocaleString() : t('march_builder.doctrine_unlimited')}
                </span>
                
                <span className="text-[10px] text-slate-500 mr-1">{t('march_builder.doctrine_choose_ratio')}</span>
                <button onClick={() => setJoinerRatio({ inf: 50, cav: 30, arc: 20 })} className={`px-2 py-1 text-[9px] font-bold rounded border transition-colors ${joinerRatio.inf === 50 ? 'bg-slate-700 text-white border-slate-500' : 'bg-slate-900 text-slate-500 border-slate-800'}`}>50-30-20</button>
                <button onClick={() => setJoinerRatio({ inf: 60, cav: 40, arc: 0 })} className={`px-2 py-1 text-[9px] font-bold rounded border transition-colors ${joinerRatio.inf === 60 ? 'bg-slate-700 text-white border-slate-500' : 'bg-slate-900 text-slate-500 border-slate-800'}`}>60-40-0</button>
                <button onClick={() => setJoinerRatio({ inf: 10, cav: 10, arc: 80 })} className={`px-2 py-1 text-[9px] font-bold rounded border transition-colors ${joinerRatio.inf === 10 ? 'bg-slate-700 text-white border-slate-500' : 'bg-slate-900 text-slate-500 border-slate-800'}`}>10-10-80</button>
              </div>
            </div>
          </div>
          
          <div className="shrink-0 flex flex-col gap-2 w-full md:w-auto items-center md:items-end border-t md:border-t-0 md:border-l border-slate-700 pt-3 md:pt-0 md:pl-4 relative z-10">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">{t('march_builder.doctrine_quick_action')}</span>
            
            <button 
              onClick={() => onApply('all', typeKey, joinerRatio)} 
              className="w-full px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-[0_0_15px_rgba(5,150,105,0.4)] transition-all flex items-center justify-center gap-2 hover:scale-105"
            >
              <span>⚡</span> {t('march_builder.doctrine_calibrate_all')} {playerMaxMarches}
            </button>
            <p className="text-[9px] text-emerald-500/70 leading-tight text-center mt-1">{t('march_builder.doctrine_calibrate_desc')}</p>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="bg-indigo-950/40 border border-indigo-500/50 p-4 md:p-6 rounded-2xl flex flex-col gap-4 shadow-[0_0_20px_rgba(79,70,229,0.15)] shrink-0 animate-in fade-in">
      <div className="flex justify-between items-center border-b border-indigo-900/50 pb-2">
        <div>
          <h3 className="text-lg font-black text-indigo-400 flex items-center gap-2"><span>📜</span> {t('march_builder.doctrine_title')}</h3>
          <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">{t('march_builder.doctrine_subtitle')}</p>
        </div>
        
        {isOfficer && !isEditingRec && (
          <button onClick={onEditClick} className="px-3 py-1.5 bg-slate-900 hover:bg-indigo-900 text-indigo-400 font-bold text-[10px] uppercase rounded-lg border border-indigo-500/30 transition-colors">
            ✏️ {t('march_builder.doctrine_edit_btn')}
          </button>
        )}
      </div>

      {isEditingRec ? (
        <div className="flex flex-col gap-4">
          
          <div className="flex flex-col gap-3 bg-slate-900 p-4 rounded-xl border border-indigo-500/30">
            <h4 className="text-xs font-bold text-indigo-300 uppercase flex items-center gap-2"><span>👑</span> {t('march_builder.doctrine_leader_title')}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <select value={recForm.leader.hero1} onChange={e => onUpdateForm('leader', 'hero1', e.target.value)} className="bg-slate-950 text-xs p-2 border border-slate-700 rounded text-slate-300 outline-none"><option value="">{t('march_builder.doctrine_captain_option')} 1...</option>{heroesDB.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select>
              <select value={recForm.leader.hero2} onChange={e => onUpdateForm('leader', 'hero2', e.target.value)} className="bg-slate-950 text-xs p-2 border border-slate-700 rounded text-slate-300 outline-none"><option value="">{t('march_builder.doctrine_captain_option')} 2...</option>{heroesDB.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select>
              <select value={recForm.leader.hero3} onChange={e => onUpdateForm('leader', 'hero3', e.target.value)} className="bg-slate-950 text-xs p-2 border border-slate-700 rounded text-slate-300 outline-none"><option value="">{t('march_builder.doctrine_captain_option')} 3...</option>{heroesDB.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input type="number" placeholder={`% ${t('march_builder.infantry')}`} value={recForm.leader.inf || ''} onChange={e => onUpdateForm('leader', 'inf', Number(e.target.value))} className="bg-slate-950 text-xs p-2 text-center border border-slate-700 rounded text-cyan-300 outline-none focus:border-cyan-500" />
              <input type="number" placeholder={`% ${t('march_builder.cavalry')}`} value={recForm.leader.cav || ''} onChange={e => onUpdateForm('leader', 'cav', Number(e.target.value))} className="bg-slate-950 text-xs p-2 text-center border border-slate-700 rounded text-amber-300 outline-none focus:border-amber-500" />
              <input type="number" placeholder={`% ${t('march_builder.archers')}`} value={recForm.leader.arc || ''} onChange={e => onUpdateForm('leader', 'arc', Number(e.target.value))} className="bg-slate-950 text-xs p-2 text-center border border-slate-700 rounded text-rose-300 outline-none focus:border-rose-500" />
            </div>
          </div>

          <div className="flex flex-col gap-3 bg-slate-900 p-4 rounded-xl border border-indigo-500/30">
            <h4 className="text-xs font-bold text-indigo-300 uppercase flex items-center gap-2"><span>🤝</span> {t('march_builder.doctrine_joiner_title')}</h4>
            <p className="text-[10px] text-slate-400 leading-tight">{t('march_builder.doctrine_joiner_desc')}</p>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2">
              <select value={recForm.joiner.heroA} onChange={e => onUpdateForm('joiner', 'heroA', e.target.value)} className="bg-slate-950 text-xs p-2 border border-slate-700 rounded text-slate-300 outline-none"><option value="">{t('march_builder.doctrine_captain_option')} 1...</option>{heroesDB.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select>
              <select value={recForm.joiner.heroB} onChange={e => onUpdateForm('joiner', 'heroB', e.target.value)} className="bg-slate-950 text-xs p-2 border border-slate-700 rounded text-slate-300 outline-none"><option value="">{t('march_builder.doctrine_captain_option')} 2...</option>{heroesDB.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select>
              <select value={recForm.joiner.heroC} onChange={e => onUpdateForm('joiner', 'heroC', e.target.value)} className="bg-slate-950 text-xs p-2 border border-slate-700 rounded text-slate-300 outline-none"><option value="">{t('march_builder.doctrine_captain_option')} 3...</option>{heroesDB.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select>
              <select value={recForm.joiner.heroD} onChange={e => onUpdateForm('joiner', 'heroD', e.target.value)} className="bg-slate-950 text-xs p-2 border border-slate-700 rounded text-slate-300 outline-none"><option value="">{t('march_builder.doctrine_captain_option')} 4...</option>{heroesDB.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select>
              <select value={recForm.joiner.heroE} onChange={e => onUpdateForm('joiner', 'heroE', e.target.value)} className="bg-slate-950 text-xs p-2 border border-slate-700 rounded text-slate-300 outline-none"><option value="">{t('march_builder.doctrine_captain_option')} 5...</option>{heroesDB.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select>
              <select value={recForm.joiner.heroF} onChange={e => onUpdateForm('joiner', 'heroF', e.target.value)} className="bg-slate-950 text-xs p-2 border border-slate-700 rounded text-slate-300 outline-none"><option value="">{t('march_builder.doctrine_captain_option')} 6...</option>{heroesDB.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
              <div className="flex flex-col gap-1 bg-emerald-950/20 p-3 rounded-lg border border-emerald-900/30">
                <label className="text-[10px] text-emerald-400 font-black uppercase tracking-wider">{t('march_builder.doctrine_max_troops_label')}</label>
                <input type="number" placeholder={t('march_builder.doctrine_max_troops_placeholder')} value={recForm.joiner.maxTroops || ''} onChange={e => onUpdateForm('joiner', 'maxTroops', Number(e.target.value))} className="w-full bg-slate-950 text-sm p-3 border border-emerald-900/50 rounded-lg text-emerald-300 font-bold outline-none focus:border-emerald-500" />
              </div>
              <div className="flex flex-col justify-center text-[10px] text-slate-400 p-2">
                <p>{t('march_builder.doctrine_leave_percent_zero')}</p>
              </div>
            </div>
          </div>

          <div className="flex gap-2 justify-end mt-2">
            <button onClick={onCancelEdit} className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white uppercase transition-colors">{t('march_builder.doctrine_cancel_btn')}</button>
            <button onClick={onSave} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black tracking-widest rounded-lg uppercase shadow-lg transition-transform hover:scale-105">{t('march_builder.doctrine_save_btn')}</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {renderRecViewRow('leader', t('march_builder.doctrine_leader_title'), '👑')}
          {renderRecViewRow('joiner', t('march_builder.doctrine_joiner_title'), '🤝')}
          {(!recommendations[selectedEvent]?.leader && !recommendations[selectedEvent]?.joiner && !recommendations[selectedEvent]?.hero1) && (
             <div className="text-xs text-slate-500 italic p-2 bg-slate-900/50 rounded-xl border border-slate-800">{t('march_builder.doctrine_empty')}</div>
          )}
        </div>
      )}
    </div>
  );
}