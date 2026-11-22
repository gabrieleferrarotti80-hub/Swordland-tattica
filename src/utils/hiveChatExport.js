const MAX_CHAT_CHARS = 500;
const MAX_CHAT_LINES = 10;

function isValidCoord(val) {
  return val !== '' && val !== null && val !== undefined && !Number.isNaN(Number(val));
}

function getRankWeight(player) {
  const rank = String(player.tag || player.role || '').toUpperCase();
  if (rank.includes('R5')) return 5;
  if (rank.includes('R4')) return 4;
  if (rank.includes('R3')) return 3;
  if (rank.includes('R2')) return 2;
  if (rank.includes('R1')) return 1;
  return 0;
}

function getCenterCoords(structures, players) {
  const anchor =
    (structures || []).find(s => s.id === 'alliance-bear-1' && isValidCoord(s.x) && isValidCoord(s.y)) ||
    (structures || []).find(s => s.type === 'beartrap' && isValidCoord(s.x) && isValidCoord(s.y)) ||
    (structures || []).find(s => s.type === 'headquarters' && isValidCoord(s.x) && isValidCoord(s.y));

  if (anchor) return { x: Number(anchor.x), y: Number(anchor.y) };

  if (players.length > 0) {
    const xs = players.map(p => p.numX).sort((a, b) => a - b);
    const ys = players.map(p => p.numY).sort((a, b) => a - b);
    const mid = Math.floor(xs.length / 2);
    return { x: xs[mid], y: ys[mid] };
  }

  return { x: 500, y: 500 };
}

export function generateHiveCoordBlocks({
  players = [],
  structures = [],
  allianceCode = 'HIVE',
  options = {}
}) {
  const safeCode = allianceCode || 'HIVE';

  const {
    sortBy = 'alpha',
    playersPerLine = 1,
    mode = 'chat',
    includeRank = false,
    includeStructures = true,
    includeMapLink = false,
    mapShareUrl = ''
  } = options;

  const validPlayers = [];
  let missingCount = 0;

  (players || []).forEach(p => {
    if (isValidCoord(p.x) && isValidCoord(p.y)) {
      validPlayers.push({
        ...p,
        numX: Math.round(Number(p.x)),
        numY: Math.round(Number(p.y)),
        displayName: (p.name || 'Senza nome').trim(),
        rankLabel: String(p.tag || p.role || '').trim()
      });
    } else {
      missingCount += 1;
    }
  });

  const center = getCenterCoords(structures, validPlayers);

  validPlayers.sort((a, b) => {
    if (sortBy === 'distance') {
      const distA = Math.hypot(a.numX - center.x, a.numY - center.y);
      const distB = Math.hypot(b.numX - center.x, b.numY - center.y);
      if (Math.abs(distA - distB) > 0.01) return distA - distB;
      return a.displayName.localeCompare(b.displayName, 'it', { sensitivity: 'base' });
    }
    if (sortBy === 'rank') {
      const diff = getRankWeight(b) - getRankWeight(a);
      if (diff !== 0) return diff;
      return a.displayName.localeCompare(b.displayName, 'it', { sensitivity: 'base' });
    }
    return a.displayName.localeCompare(b.displayName, 'it', { sensitivity: 'base' });
  });

  const bodyLines = [];

  if (includeStructures) {
    const coreStructs = (structures || []).filter(
      s => (s.type === 'headquarters' || s.type === 'beartrap') && isValidCoord(s.x) && isValidCoord(s.y)
    );
    if (coreStructs.length > 0) {
      const structTokens = coreStructs.map(s => {
        const icon = s.type === 'headquarters' ? '🏰' : '🐻';
        const label = s.code || (s.type === 'headquarters' ? 'HQ' : 'TRP');
        const sx = Math.round(Number(s.x));
        const sy = Math.round(Number(s.y));
        return icon + label + ' [X:' + sx + ' Y:' + sy + ']';
      });
      bodyLines.push(structTokens.join(' | '));
    }
  }

  const formattedPlayers = validPlayers.map(p => {
    const prefix = includeRank && p.rankLabel ? '[' + p.rankLabel + '] ' : '';
    if (playersPerLine === 2) {
      return prefix + p.displayName + ' (' + p.numX + ',' + p.numY + ')';
    }
    return prefix + p.displayName + ' [X:' + p.numX + ' Y:' + p.numY + ']';
  });

  if (playersPerLine === 2) {
    for (let i = 0; i < formattedPlayers.length; i += 2) {
      const left = formattedPlayers[i];
      const right = formattedPlayers[i + 1];
      bodyLines.push(right ? left + ' • ' + right : left);
    }
  } else {
    bodyLines.push(...formattedPlayers);
  }

  if (includeMapLink && mapShareUrl) {
    bodyLines.push('🗺️ Mappa: ' + mapShareUrl);
  }

  if (bodyLines.length === 0) {
    return {
      blocks: [],
      totalPlayers: 0,
      missingCount
    };
  }

  if (mode === 'full') {
    const header = '📍 [' + safeCode + '] Posizioni Alveare (' + validPlayers.length + ')';
    const text = [header, ...bodyLines].join('\n');
    return {
      blocks: [
        {
          index: 1,
          total: 1,
          text,
          charCount: text.length,
          lineCount: bodyLines.length + 1
        }
      ],
      totalPlayers: validPlayers.length,
      missingCount
    };
  }

  const rawChunks = [];
  const worstCaseHeader = '📍 [' + safeCode + '] Posizioni (99/99)';
  const reservedHeaderChars = worstCaseHeader.length + 1;

  let currentLines = [];
  let currentChars = reservedHeaderChars;

  bodyLines.forEach(line => {
    const additionChars = (currentLines.length > 0 ? 1 : 0) + line.length;
    const wouldExceedChars = currentChars + additionChars > MAX_CHAT_CHARS;
    const wouldExceedLines = currentLines.length + 1 > (MAX_CHAT_LINES - 1);

    if (currentLines.length > 0 && (wouldExceedChars || wouldExceedLines)) {
      rawChunks.push(currentLines);
      currentLines = [line];
      currentChars = reservedHeaderChars + line.length;
    } else {
      currentLines.push(line);
      currentChars += additionChars;
    }
  });

  if (currentLines.length > 0) {
    rawChunks.push(currentLines);
  }

  const totalBlocks = rawChunks.length;
  const blocks = rawChunks.map((lines, idx) => {
    const header = '📍 [' + safeCode + '] Posizioni (' + (idx + 1) + '/' + totalBlocks + ')';
    const text = [header, ...lines].join('\n');
    return {
      index: idx + 1,
      total: totalBlocks,
      text,
      charCount: text.length,
      lineCount: lines.length + 1
    };
  });

  return {
    blocks,
    totalPlayers: validPlayers.length,
    missingCount
  };
}