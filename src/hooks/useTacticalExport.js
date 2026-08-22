import { useMemo } from 'react';

// 💡 Pulisce i nomi da Emoji e Caratteri Non Supportati
export const cleanText = (str) => {
  if (!str) return '';
  return str.replace(/[^\x00-\xFF]/g, "").trim(); 
};

export const formatDecimalToTime = (decimalMinutes) => {
  if (decimalMinutes < 0) decimalMinutes = 0;
  const m = Math.floor(decimalMinutes);
  let s = Math.round((decimalMinutes - m) * 60);
  let finalM = m;
  if (s === 60) { finalM += 1; s = 0; }
  return { m: finalM, s };
};

export const formatDecimalToStr = (decimalMinutes) => {
  const { m, s } = formatDecimalToTime(decimalMinutes);
  return `${m.toString().padStart(2, '0')}' ${s.toString().padStart(2, '0')}"`;
};

export function useTacticalExport({ 
  playerOverrides, roster, targetBuilding, exportableOrders, 
  activeDeployment, buildings, tacticalMeta, allianceStructures 
}) {
  
  const rawArray = Array.isArray(roster) ? roster : (roster?.players || []);

  const positionedPlayers = useMemo(() => {
    if (!playerOverrides || Object.keys(playerOverrides).length === 0) return [];
    const list = [];
    Object.entries(playerOverrides).forEach(([playerId, coords]) => {
      const player = rawArray.find(p => String(p.id) === String(playerId));
      if (!player) return;
      if (coords && coords.x !== '' && coords.y !== '' && coords.x != null && coords.y != null) {
        list.push({ id: playerId, name: player.name || 'Senza Nome', tag: player.originalTag || player.tag || '?', x: Number(coords.x), y: Number(coords.y) });
      }
    });
    return list;
  }, [playerOverrides, rawArray]);

  const positionChunks = useMemo(() => {
    const result = [];
    for (let i = 0; i < positionedPlayers.length; i += 10) {
      result.push(positionedPlayers.slice(i, i + 10));
    }
    return result;
  }, [positionedPlayers]);

  const orderStrategies = useMemo(() => {
    if (!exportableOrders || exportableOrders.length === 0) return [];
    const strategies = {};
    const hiveHQ = allianceStructures?.find(s => s.type === 'headquarters');
    const HIVE_X = hiveHQ ? Number(hiveHQ.x) : 0;
    const HIVE_Y = hiveHQ ? Number(hiveHQ.y) : 0;

    exportableOrders.forEach(order => {
      const leaderIdStr = String(order.leaderId);
      let leaderPlayer = activeDeployment.find(p => String(p.id) === leaderIdStr) || rawArray.find(r => String(r.id) === leaderIdStr);
      const leaderName = leaderPlayer ? (leaderPlayer.name || leaderPlayer.tag || `[ID:${leaderIdStr}]`) : `[ID:${leaderIdStr}]`;

      const memberNames = [];
      if (order.members && order.members.length > 0) {
        order.members.forEach(memberData => {
          const mIdStr = String(typeof memberData === 'object' ? memberData.id : memberData);
          let mPlayer = activeDeployment.find(p => String(p.id) === mIdStr) || rawArray.find(r => String(r.id) === mIdStr);
          const mName = mPlayer ? (mPlayer.name || mPlayer.tag || `[ID:${mIdStr}]`) : `[ID:${mIdStr}]`;
          memberNames.push(mName);
        });
      }

      const mType = String(order.marchType || 'attacco').toLowerCase();
      const isRally = mType === 'rally' || memberNames.length > 0;
      
      const targetB = buildings?.find(b => String(b.id) === String(order.targetId));
      const targetNameStr = targetB ? targetB.name : (targetBuilding?.name || 'Obiettivo');

      const dispatchTimeVal = Number(order.startMinute || 0); 
      let travelTimeMins = 0;
      if (leaderPlayer && targetB) {
        const override = playerOverrides[leaderPlayer.id];
        const oX = override?.x ?? leaderPlayer.x ?? HIVE_X;
        const oY = override?.y ?? leaderPlayer.y ?? HIVE_Y;
        const tX = targetB.x;
        const tY = targetB.y;
        
        if (oX !== undefined && oY !== undefined && tX !== undefined && tY !== undefined) {
          const dx = tX - oX;
          const dy = tY - oY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          travelTimeMins = (dist * 4) / 60;
        }
      }

      const delay = isRally ? 5 : 0;
      const arrivalDecimal = dispatchTimeVal + delay + travelTimeMins;
      const startParsed = formatDecimalToTime(dispatchTimeVal);
      const arrivalParsed = formatDecimalToTime(arrivalDecimal);

      if (!strategies[leaderName]) strategies[leaderName] = { name: leaderName, actions: [] };
      strategies[leaderName].actions.push({ sortValue: dispatchTimeVal, startParsed, arrivalParsed, targetName: targetNameStr, marchType: isRally ? 'rally_leader' : mType, members: memberNames });
    });

    return Object.values(strategies).map(strategy => {
      let text = `📜 *ORDINI TATTICI: ${strategy.name.toUpperCase()}*\n\n`;
      strategy.actions.sort((a, b) => a.sortValue - b.sortValue);
      strategy.actions.forEach(a => {
        let actionText = "";
        let timeLabel = "Partenza";
        if (a.marchType === 'rally_leader') {
          actionText = `🔥 **LANCIA RALLY (5 min)**\n👥 In attesa di: ${a.members.join(', ')}\n🎯 Obiettivo: **${a.targetName}**`;
          timeLabel = "Chiamata";
        } else if (a.marchType === 'rally_join') {
          actionText = `🏃 **UNISCITI AL RALLY**\n🎯 Obiettivo: **${a.targetName}**`;
        } else {
          const iconType = a.marchType === 'difesa' ? '🛡️ DIFESA' : a.marchType === 'supporto' ? '🤝 SUPPORTO' : '⚔️ ATTACCO SINGOLO';
          actionText = `${iconType}\n🎯 Obiettivo: **${a.targetName}**`;
        }
        text += `⏱️ **${timeLabel}: ${a.startParsed.m.toString().padStart(2, '0')}' ${a.startParsed.s.toString().padStart(2, '0')}"**\n${actionText}\n⏳ Impatto alle ${a.arrivalParsed.m.toString().padStart(2, '0')}' ${a.arrivalParsed.s.toString().padStart(2, '0')}"\n\n`;
      });
      return { name: strategy.name, text };
    });
  }, [exportableOrders, activeDeployment, rawArray, buildings, targetBuilding, playerOverrides, allianceStructures]);

  const flightMessages = useMemo(() => {
    const playerMeta = tacticalMeta?.draftData?.playerMeta || {};
    const uniqueRoster = Array.from(new Map(rawArray.map(p => [p.id, p])).values());

    const flights = {};
    uniqueRoster.forEach(p => {
      const meta = playerMeta[p.id];
      if (!meta || !meta.tempTag) return;
      const original = (p.originalTag || p.tag || '').trim();
      const destination = meta.tempTag.trim();
      if (destination && destination !== original) {
        if (!flights[destination]) flights[destination] = [];
        flights[destination].push(p);
      }
    });

    return Object.entries(flights).map(([dest, players]) => {
      players.sort((a, b) => (b.power || 0) - (a.power || 0));
      let msg = `✈️ **TRASFERIMENTI VERSO [${dest}]**\n\n`;
      players.forEach(p => { msg += `• [${p.originalTag || p.tag || '?'}] ${p.name}\n`; });
      return { destination: dest, text: msg, count: players.length, players: players };
    });
  }, [tacticalMeta, rawArray]);

  const timelineSummaryObj = useMemo(() => {
    if (!exportableOrders || exportableOrders.length === 0) return [];
    
    const groups = {};
    const hiveHQ = allianceStructures?.find(s => s.type === 'headquarters');
    const HIVE_X = hiveHQ ? Number(hiveHQ.x) : 0;
    const HIVE_Y = hiveHQ ? Number(hiveHQ.y) : 0;

    exportableOrders.forEach(order => {
      const leaderIdStr = String(order.leaderId);
      let leaderPlayer = activeDeployment.find(p => String(p.id) === leaderIdStr) || rawArray.find(r => String(r.id) === leaderIdStr);
      const leaderName = leaderPlayer ? (leaderPlayer.name || leaderPlayer.tag || `[ID:${leaderIdStr}]`) : `Sconosciuto`;
      const targetB = buildings?.find(b => String(b.id) === String(order.targetId));
      const targetNameStr = targetB ? targetB.name : (targetBuilding?.name || 'Obiettivo');

      const isRally = order.marchType === 'rally';
      const dispatchTimeVal = Number(order.startMinute || 0);
      const key = dispatchTimeVal.toFixed(4);

      let travelTimeMins = 0;
      if (leaderPlayer && targetB) {
        const override = playerOverrides[leaderPlayer.id];
        const oX = override?.x ?? leaderPlayer.x ?? HIVE_X;
        const oY = override?.y ?? leaderPlayer.y ?? HIVE_Y;
        const tX = targetB.x;
        const tY = targetB.y;
        if (oX !== undefined && oY !== undefined && tX !== undefined && tY !== undefined) {
          const isCastle = targetB.type === 'castle' || targetB.code === 'CAS';
          const radius = isCastle ? 6 : 2;
          const dx = Math.max(0, Math.abs(tX - oX) - radius);
          const dy = Math.max(0, Math.abs(tY - oY) - radius);
          const dist = Math.sqrt(dx * dx + dy * dy);
          travelTimeMins = (dist * 4) / 60;
        }
      }

      const arrivalDecimal = dispatchTimeVal + (isRally ? 5 : 0) + travelTimeMins;
      if (!groups[key]) groups[key] = { timeDecimal: dispatchTimeVal, formattedTime: formatDecimalToStr(dispatchTimeVal), actions: [] };

      let actionIcon = '⚔️';
      let partenzaLabel = 'Partenza';
      if (isRally) { actionIcon = '🔥'; partenzaLabel = 'Chiamata'; }
      else if (order.marchType === 'difesa') { actionIcon = '🛡️'; }
      else if (order.marchType === 'supporto') { actionIcon = '🤝'; }

      const membersTxt = (order.members && order.members.length > 0) ? ` (+${order.members.length} truppe)` : '';
      groups[key].actions.push(`${actionIcon} ${leaderName} su ${targetNameStr}${membersTxt} ➔ ${partenzaLabel}: ${formatDecimalToStr(dispatchTimeVal)} | Impatto: ${formatDecimalToStr(arrivalDecimal)}`);
    });

    return Object.values(groups).sort((a, b) => a.timeDecimal - b.timeDecimal);
  }, [exportableOrders, activeDeployment, rawArray, buildings, targetBuilding, playerOverrides, allianceStructures]);

  const timelineSummaryText = useMemo(() => {
    if (timelineSummaryObj.length === 0) return null;
    let text = `📅 **TIMELINE EVENTO**\n\n`;
    timelineSummaryObj.forEach(g => {
      text += `[ Minuto ${g.formattedTime} ]\n`;
      g.actions.forEach(act => text += `  - ${act}\n`);
      text += `\n`;
    });
    return text;
  }, [timelineSummaryObj]);

  return { rawArray, positionedPlayers, positionChunks, orderStrategies, flightMessages, timelineSummaryObj, timelineSummaryText };
}