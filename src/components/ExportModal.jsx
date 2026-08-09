import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next'; // 🌍 Import i18n

export const ExportModal = ({ isOpen, onClose, marches, activeDeployment, roster = [] }) => {
  const { t } = useTranslation(); // 🌍 Hook di traduzione
  const [copiedLeader, setCopiedLeader] = useState(null);

  const playerStrategies = useMemo(() => {
    if (!marches || marches.length === 0) return {};

    const strategies = {};
    const movementsList = [];
    const processedActions = new Set();

    marches.forEach(march => {
      const marchLeaderId = march.playerId || march.leader || march.leaderId;
      
      let leaderPlayer = activeDeployment.find(p => String(p.id) === String(marchLeaderId));
      if (!leaderPlayer) {
        leaderPlayer = roster.find(r => String(r.id) === String(marchLeaderId));
      }
      const leaderName = leaderPlayer ? (leaderPlayer.name || leaderPlayer.tag || `${t('export_modal.player_prefix')}${marchLeaderId}`) : `${t('export_modal.commander_prefix')}${marchLeaderId}`;

      const memberNames = [];
      const memberObjects = [];
      if (march.members && march.members.length > 0) {
        march.members.forEach(memberId => {
          let mPlayer = activeDeployment.find(p => String(p.id) === String(memberId));
          if (!mPlayer) mPlayer = roster.find(r => String(r.id) === String(memberId));
          
          const mName = mPlayer ? (mPlayer.name || mPlayer.tag || `${t('export_modal.player_prefix')}${memberId}`) : `${t('export_modal.player_prefix')}${memberId}`;
          memberNames.push(mName);
          memberObjects.push({ id: memberId, name: mName });
        });
      }

      const isRally = march.marchType === 'rally' || memberNames.length > 0;

      if (march.positions) {
        Object.entries(march.positions).forEach(([minStr, pos]) => {
          if (pos.isMarching && pos.startTime !== undefined && pos.targetName) {
            
            const actualStartTime = Math.round(Number(pos.startTime));
            let displayMinute = isRally ? actualStartTime - 4 : actualStartTime;
            displayMinute = Math.max(0, displayMinute);

            const actionKey = `${leaderName}_${pos.targetName}_${isRally ? 'rally' : pos.marchType}_${displayMinute}`;

            if (!processedActions.has(actionKey)) {
              processedActions.add(actionKey); 

              movementsList.push({
                playerName: leaderName,
                startMinute: displayMinute,
                arrivalMinute: Math.round(Number(pos.arrivalTime)),
                targetName: pos.targetName,
                marchType: isRally ? 'rally_leader' : (pos.marchType || 'attacco'),
                members: memberNames
              });

              if (isRally) {
                memberObjects.forEach(mObj => {
                  movementsList.push({
                    playerName: mObj.name,
                    startMinute: displayMinute,
                    arrivalMinute: Math.round(Number(pos.arrivalTime)),
                    targetName: pos.targetName,
                    marchType: 'rally_join',
                    leaderName: leaderName
                  });
                });
              }
            }
          }
        });
      }
    });

    movementsList.sort((a, b) => a.startMinute - b.startMinute);

    movementsList.forEach(m => {
      if (!strategies[m.playerName]) {
        strategies[m.playerName] = {
          name: m.playerName,
          text: `${t('export_modal.tactical_orders_title')} ${m.playerName.toUpperCase()}*\n\n`
        };
      }

      let actionText = "";
      if (m.marchType === 'rally_leader') {
        actionText = `${t('export_modal.launch_rally')}\n${t('export_modal.waiting_for')} ${m.members.join(', ')}\n${t('export_modal.target')} **${m.targetName}**`;
      } else if (m.marchType === 'rally_join') {
        actionText = `${t('export_modal.join_rally')}\n${t('export_modal.leader')} **${m.leaderName}**\n${t('export_modal.target')} **${m.targetName}**`;
      } else {
        const iconType = m.marchType === 'difesa' ? t('export_modal.defense') : m.marchType === 'supporto' ? t('export_modal.support') : t('export_modal.attack');
        actionText = `${t('export_modal.type')} ${iconType}\n${t('export_modal.target')} **${m.targetName}**`;
      }

      strategies[m.playerName].text += `${t('export_modal.minute')} ${m.startMinute.toString().padStart(2, '0')}'**\n`;
      strategies[m.playerName].text += `${actionText}\n`;
      strategies[m.playerName].text += `${t('export_modal.eta_min')} ${m.arrivalMinute.toString().padStart(2, '0')}'\n\n`;
    });

    return strategies;
  }, [marches, activeDeployment, roster, t]);

  const handleCopy = (playerName, text) => {
    navigator.clipboard.writeText(text);
    setCopiedLeader(playerName);
    setTimeout(() => setCopiedLeader(null), 2000);
  };

  if (!isOpen) return null;

  const leaders = Object.values(playerStrategies);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        
        <div className="flex justify-between items-center p-6 border-b border-slate-800">
          <div>
            <h2 className="text-xl font-black text-cyan-400 uppercase tracking-widest">{t('export_modal.share_strategy')}</h2>
            <p className="text-xs text-slate-400 mt-1">{t('export_modal.share_desc')}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white transition-colors bg-slate-800 hover:bg-slate-700 rounded-full">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
          {leaders.length === 0 ? (
            <div className="text-center text-slate-500 py-10">
              {t('export_modal.no_marches')}
            </div>
          ) : (
            leaders.map(item => (
              <div key={item.name} className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4 flex gap-4 items-start">
                <div className="flex-1 whitespace-pre-wrap text-sm font-mono text-slate-300">
                  {item.text}
                </div>
                <button
                  onClick={() => handleCopy(item.name, item.text)}
                  className={`shrink-0 px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${
                    copiedLeader === item.name 
                      ? 'bg-emerald-500 text-white' 
                      : 'bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500 hover:text-white border border-cyan-500/30'
                  }`}
                >
                  {copiedLeader === item.name ? (
                    <>{t('export_modal.copied')}</>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                      {t('export_modal.copy')}
                    </>
                  )}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};