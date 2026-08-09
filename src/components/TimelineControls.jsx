import React from 'react';
import { useTranslation } from 'react-i18next'; // 🌍 Import i18n

const ChevronUp = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
);
const ChevronDown = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
);

export const TimelineControls = ({
  currentTime,
  hasDrafts,
  handleTimeChange,
  isPlaying,
  togglePlay,
  playbackSpeed,
  setPlaybackSpeed,
  handleConfirmMinute,
  handleCancelMinute
}) => {
  const { t } = useTranslation(); // 🌍 Hook di traduzione

  return (
    <div className="flex flex-col items-center py-4 px-3 h-full justify-between gap-2">
      
      {/* 1. INDICATORE MINUTO */}
      <div className="text-center shrink-0">
        <div className="text-3xl xl:text-4xl font-black text-cyan-400 font-mono tracking-tighter drop-shadow-[0_0_12px_rgba(34,211,238,0.4)] leading-none">
          {currentTime.toString().padStart(2, '0')}'
        </div>
        <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mt-1">{t('swordland.timeline.minute')}</div>
      </div>

      {/* 2. SLIDER VERTICALE */}
      <div className="flex-1 w-full flex flex-col items-center justify-center relative min-h-[100px] py-1">
        <button 
          onClick={() => handleTimeChange(currentTime + 1)} 
          disabled={hasDrafts || currentTime === 60} 
          className={`mb-1 p-1 rounded-full transition-all ${hasDrafts ? 'text-slate-700' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}`}
        >
          <ChevronUp />
        </button>

        <input 
          type="range" 
          min="0" 
          max="60" 
          step="1" 
          orient="vertical"
          value={currentTime} 
          onChange={(e) => handleTimeChange(Number(e.target.value))} 
          disabled={hasDrafts} 
          className={`h-full w-1.5 bg-slate-800 rounded-full outline-none transition-all ${
            hasDrafts ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
          }`} 
          style={{ 
            WebkitAppearance: 'slider-vertical',
            appearance: 'slider-vertical',
            accentColor: '#06b6d4'
          }} 
        />

        <button 
          onClick={() => handleTimeChange(currentTime - 1)} 
          disabled={hasDrafts || currentTime === 0} 
          className={`mt-1 p-1 rounded-full transition-all ${hasDrafts ? 'text-slate-700' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}`}
        >
          <ChevronDown />
        </button>
      </div>

      {/* 3. PULSANTIERA AZIONI */}
      <div className="flex flex-col items-center gap-2 w-full shrink-0">
        {hasDrafts ? (
          <div className="flex flex-col gap-2 w-full animate-in slide-in-from-bottom-2 fade-in duration-200">
            <button 
              onClick={handleConfirmMinute}
              className="w-full bg-emerald-500/20 hover:bg-emerald-500 border border-emerald-500/50 text-emerald-400 hover:text-white font-bold py-2 rounded-xl text-[10px] transition-all uppercase tracking-wider"
            >
              {t('swordland.timeline.save')}
            </button>
            <button 
              onClick={handleCancelMinute}
              className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 font-bold py-2 rounded-xl text-[10px] transition-all uppercase tracking-wider"
            >
              {t('swordland.timeline.cancel')}
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 w-full animate-in fade-in duration-200">
            <button 
              onClick={togglePlay} 
              className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95 ${
                isPlaying 
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-900 shadow-[0_0_15px_rgba(245,158,11,0.5)]' 
                  : 'bg-cyan-500 hover:bg-cyan-400 text-slate-900 shadow-[0_0_15px_rgba(6,182,212,0.5)]'
              }`}
            >
              {isPlaying ? (
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M6 4h4v16H6zm8 0h4v16h-4z"/></svg>
              ) : (
                <svg className="w-5 h-5 fill-current ml-1" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              )}
            </button>

            <select 
              value={playbackSpeed} 
              onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
              disabled={isPlaying}
              className="bg-slate-900/80 border border-slate-700/80 text-[10px] text-cyan-400 font-bold rounded-xl px-1 py-1.5 outline-none w-full text-center disabled:opacity-50 cursor-pointer hover:bg-slate-800 transition-colors"
            >
              <option value={1}>{t('swordland.timeline.speed_1x')}</option>
              <option value={5}>{t('swordland.timeline.speed_5x')}</option>
              <option value={15}>{t('swordland.timeline.speed_15x')}</option>
            </select>
          </div>
        )}
      </div>
    </div>
  );
};