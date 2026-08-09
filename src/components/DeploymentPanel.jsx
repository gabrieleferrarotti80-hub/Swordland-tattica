import React from 'react';
import { useTranslation } from 'react-i18next'; // 🌍 Import i18n

export const DeploymentPanel = ({
  activeDeployment,
  getAvailableMarches,
  healingEvents,
  currentTime,
  getCurrentPosition,
  draftPositions,
  handleWithdraw,
  handleHeal,
  handleCancelHeal
}) => {
  const { t } = useTranslation(); // 🌍 Hook di traduzione

  return (
    <div className="p-4">
      <div className="flex flex-col gap-2">
        {activeDeployment.map(p => {
          const avail = getAvailableMarches(p.id);
          const healStart = healingEvents[p.id];
          const isHealing = healStart !== undefined && currentTime >= healStart && currentTime < healStart + 12;
          const healRemaining = isHealing ? (healStart + 12) - currentTime : 0;
          
          const currentPos = getCurrentPosition(p);
          const isMarching = currentPos && currentPos.isMarching && currentTime < currentPos.arrivalTime;

          return (
            <div
              key={p.id}
              draggable={!isHealing && !isMarching}
              onDragStart={(e) => {
                if(!isHealing && !isMarching) e.dataTransfer.setData('text/plain', `player:${p.id}`);
              }}
              className={`bg-slate-800/70 border p-2.5 rounded-lg flex flex-col hover:bg-slate-700/50 transition-colors ${(!isHealing && !isMarching) && 'cursor-grab active:cursor-grabbing'} ${isHealing ? 'opacity-60 grayscale border-emerald-500/50' : draftPositions[p.id] ? 'border-amber-500/50 bg-amber-900/20' : 'border-slate-700'}`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="bg-cyan-700 text-white font-bold text-[10px] px-1.5 py-0.5 rounded">{p.tag || '??'}</span>
                  <span className="font-bold text-amber-100 text-sm">{p.name}</span>
                </div>
                <div className="flex gap-2 items-center">
                  
                  {isHealing ? (
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] bg-emerald-900/80 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/50 font-bold tracking-wide">
                        {/* Rimosso prefisso swordland. */}
                        {t('deployment.healing_status', { time: healRemaining })}
                      </span>
                      <button onMouseDown={e => e.stopPropagation()} onClick={(e) => handleCancelHeal(e, p.id)} className="text-[9px] bg-slate-700 hover:bg-red-700 text-white px-1.5 py-0.5 rounded border border-slate-600 transition-colors">✕</button>
                    </div>
                  ) : isMarching ? (
                    <span className="text-[9px] bg-blue-900/80 text-blue-300 px-1.5 py-0.5 rounded border border-blue-500/50 font-bold tracking-wide">
                      {/* Rimosso prefisso swordland. */}
                      {t('deployment.arriving_min', { time: currentPos.arrivalTime })}
                    </span>
                  ) : (
                    <>
                      {(currentPos && !currentPos.removed) && (
                        <button onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); handleWithdraw(p.id); }} className="text-[9px] bg-red-900/80 hover:bg-red-700 text-white px-1.5 py-0.5 rounded border border-red-500/50 transition-colors" title={t('deployment.withdraw_tooltip')}>
                          {t('deployment.withdraw')}
                        </button>
                      )}
                      <button onMouseDown={(e) => e.stopPropagation()} onClick={(e) => handleHeal(e, p.id)} className="text-[9px] bg-emerald-900/80 hover:bg-emerald-700 text-emerald-100 px-1.5 py-0.5 rounded border border-emerald-500/50 transition-colors" title={t('deployment.heal_tooltip')}>
                        {/* Rimosso prefisso swordland. */}
                        {t('deployment.heal')}
                      </button>
                    </>
                  )}
                  {/* Rimosso prefisso swordland. */}
                  <span className="bg-slate-700 text-slate-300 text-[10px] px-1.5 py-0.5 rounded border border-slate-600 shrink-0">{t('deployment.level')} {p.level}</span>
                </div>
              </div>

              <div className="flex justify-between text-[10px] text-slate-400 px-1">
                <span>{t('deployment.power')} <strong className="text-slate-300">{p.power}M</strong></span>
                <span>{t('deployment.marches')} <strong className={`${avail <= 0 ? 'text-red-400' : 'text-slate-300'}`}>{avail}/{p.marches}</strong> {t('deployment.available')}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};