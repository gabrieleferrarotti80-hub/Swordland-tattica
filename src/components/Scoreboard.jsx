import React from 'react';
import { useTranslation } from 'react-i18next';

export const Scoreboard = ({ teamScores }) => {
  const { t } = useTranslation();
  
  return (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20 flex gap-6 bg-slate-900/90 py-2 px-6 rounded-2xl border border-slate-700 shadow-xl backdrop-blur-md">
      <div className="text-center">
        <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest">{t('scoreboard.blue_alliance')}</div>
        <div className="text-2xl font-black text-white">{Math.floor(teamScores.blue)}</div>
      </div>
      <div className="w-px bg-slate-700 my-2"></div>
      <div className="text-center">
        <div className="text-[10px] text-red-400 font-bold uppercase tracking-widest">{t('scoreboard.red_alliance')}</div>
        <div className="text-2xl font-black text-white">{Math.floor(teamScores.red)}</div>
      </div>
    </div>
  );
};