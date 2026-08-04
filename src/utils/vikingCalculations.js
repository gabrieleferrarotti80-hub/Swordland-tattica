// ==========================================
// COSTANTI E CONFIGURAZIONI TIER
// ==========================================

export const TIER_ORDER = [
  'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11',
  'TG1', 'TG2', 'TG3', 'TG4', 'TG5', 'TG6'
];

// Sostituisci il vecchio PESI_RELATIVI con questo (ho scalato i TG a base 100 per precisione)
export const PESI_RELATIVI = {
  'T1': 1, 'T2': 1.5, 'T3': 2, 'T4': 2.5, 'T5': 3,
  'T6': 4, 'T7': 5, 'T8': 6.5, 'T9': 8, 'T10': 10, 'T11': 12,
  // Nuova curva reale estratta dai server:
  'TG1': 100, 
  'TG2': 125, // Stimato sulla nuova curva
  'TG3': 154, // Esatto (1.537x)
  'TG4': 163, // Esatto (1.630x)
  'TG5': 174, // Esatto (1.741x)
  'TG6': 195  // Stimato sulla nuova curva
};

export const getTierIndex = (tier) => TIER_ORDER.indexOf(tier);

export const getTierColor = (tier) => {
  if (!tier) return '#fff';
  if (tier.startsWith('TG')) return '#FFD700';
  const num = parseInt(tier.replace('T', ''));
  if (num >= 9) return '#ff5252';
  if (num >= 6) return '#4CAF50';
  return '#2196F3';
};

// ==========================================
// MOTORE TEORICO E STATISTICO (Truppa per Truppa)
// ==========================================

export const calcolaStatisticheOndata = (ondata) => {
  if (!ondata || !ondata.giocatori) return ondata;

  // Il moltiplicatore fisso di fazione
  const BONUS_FAZIONE = {
    fant: 1.0000, 
    cav: 1.0218, // +2.2% fisso calcolato dal server
    arc: 1.0000  // Per ora neutro
  };

  // 1. SCANSIONE LINEA DEL FRONTE: Identifichiamo quali tipi di truppa partecipano alla battaglia
  const truppeAttive = { fant: false, cav: false, arc: false };
  
  ondata.giocatori.forEach((g, index) => {
    if (index === 0) return; // Escludiamo l'Host
    
    ['fant', 'cav', 'arc'].forEach(tipo => {
      if (g.dettaglioTruppe && Array.isArray(g.dettaglioTruppe[tipo])) {
        g.dettaglioTruppe[tipo].forEach(t => {
          if (Number(t.uccise) > 0) {
            truppeAttive[tipo] = true; // Appena trova 1 kill, la categoria è attiva per tutta l'ondata
          }
        });
      }
    });
  });

  let pesoTotaleAlleati = 0;
  let uccisioniTotaliAlleati = 0;

  // 2. Calcoliamo il Peso Totale ESCLUDENDO le truppe lasciate in panchina
  ondata.giocatori.forEach((g, index) => {
    if (index === 0) return; 

    ['fant', 'cav', 'arc'].forEach(tipo => {
      // Se la tipologia di truppa non ha combattuto, saltiamo il calcolo del suo peso
      if (!truppeAttive[tipo]) return;

      if (g.dettaglioTruppe && Array.isArray(g.dettaglioTruppe[tipo])) {
        g.dettaglioTruppe[tipo].forEach(t => {
          const inviate = Number(t.inviate) || 0;
          const uccise = Number(t.uccise) || 0;
          
          const pesoBase = PESI_RELATIVI[t.tier];
          if (inviate > 0 && pesoBase) {
            const pesoReale = pesoBase * BONUS_FAZIONE[tipo];
            pesoTotaleAlleati += (inviate * pesoReale);
            uccisioniTotaliAlleati += uccise; // Raccogliamo tutte le uccisioni reali
          }
        });
      }
    });
  });

  // 3. Distribuiamo le uccisioni teoriche truppa per truppa
  ondata.giocatori.forEach((g, index) => {
    g.isHost = (index === 0);
    g.teorico = {
      datiSufficienti: !g.isHost && pesoTotaleAlleati > 0,
      uccisioniTotali: 0,
      uccisioni: { fant: 0, cav: 0, arc: 0 },
      rateo: { fant: 0, cav: 0, arc: 0 },
      rateoGlobale: 0
    };

    if (!g.teorico.datiSufficienti) return;

    ['fant', 'cav', 'arc'].forEach(tipo => {
      // Non assegniamo quote teoriche alle truppe che non hanno combattuto
      if (!truppeAttive[tipo]) return;

      if (g.dettaglioTruppe && Array.isArray(g.dettaglioTruppe[tipo])) {
        g.dettaglioTruppe[tipo].forEach(t => {
          const inviate = Number(t.inviate) || 0;
          const pesoBase = PESI_RELATIVI[t.tier];

          if (inviate > 0 && pesoBase) {
            const pesoReale = pesoBase * BONUS_FAZIONE[tipo];
            const quotaTruppa = (inviate * pesoReale) / pesoTotaleAlleati;
            const uccisioniTeoricheTruppa = quotaTruppa * uccisioniTotaliAlleati;

            g.teorico.uccisioni[tipo] += uccisioniTeoricheTruppa;
            g.teorico.uccisioniTotali += uccisioniTeoricheTruppa;
            
            const totaleInviateTipo = (g.truppeInviate && g.truppeInviate[tipo]) || inviate;
            g.teorico.rateo[tipo] = g.teorico.uccisioni[tipo] / totaleInviateTipo;
          }
        });
      }
    });

    // Manteniamo il Rateo Globale basato sul totale effettivo delle truppe inviate 
    // (così rispecchia fedelmente la prestazione globale del giocatore)
    const truppeInviateTotali = (g.truppeInviate?.fant || 0) + (g.truppeInviate?.cav || 0) + (g.truppeInviate?.arc || 0);
    if (truppeInviateTotali > 0) {
      g.teorico.rateoGlobale = g.teorico.uccisioniTotali / truppeInviateTotali;
    }
  });

  return ondata;
};

// ==========================================
// ALTRE FUNZIONI DI BASE (Grafici, Analisi Vecchia)
// ==========================================

export const preparaDatiGrafico = (datiEvento) => {
  if (!datiEvento || !datiEvento.ondate) return [];
  
  return datiEvento.ondate.map(ondata => {
    // Ricalcoliamo i totali ciclando i giocatori reali dell'ondata
    let sumFant = 0, sumCav = 0, sumArc = 0;
    
    if (ondata.giocatori) {
      ondata.giocatori.forEach(g => {
        sumFant += (Number(g.truppeUccise?.fant) || 0);
        sumCav += (Number(g.truppeUccise?.cav) || 0);
        sumArc += (Number(g.truppeUccise?.arc) || 0);
      });
    }
    
    const totalKills = sumFant + sumCav + sumArc;
    const vTotali = Number(ondata.nemiciTotali) || 0;
    const sopravvissuti = Math.max(0, vTotali - totalKills);

    return {
      nome: `Lvl ${ondata.livello || 'N/A'}`,
      "Uccisioni Fanteria": sumFant,
      "Uccisioni Cavalleria": sumCav,
      "Uccisioni Arcieri": sumArc,
      "Nemici Sopravvissuti": sopravvissuti,
      "Andamento Reale": totalKills,
      "Andamento Teorico": totalKills, 
      vTotali: vTotali
    };
  });
};

export const analizzaOndata = (ondata) => {
  let vTotali = ondata.nemiciTotali || 0;
  let vFant = ondata.dettagliNemici?.fant || 0;
  let vCav = ondata.dettagliNemici?.cav || 0;
  let vArc = ondata.dettagliNemici?.arc || 0;

  let sumFantUccise = ondata.dettagliUccisioni?.fant || 0;
  let sumCavUccise = ondata.dettagliUccisioni?.cav || 0;
  let sumArcUccise = ondata.dettagliUccisioni?.arc || 0;
  let killTotali = sumFantUccise + sumCavUccise + sumArcUccise;

  let isWipeoutIncompleto = vTotali > 0 && killTotali < vTotali;

  return {
    vTotali, vFant, vCav, vArc,
    percVFant: vTotali ? Math.round((vFant/vTotali)*100) : 0,
    percVCav: vTotali ? Math.round((vCav/vTotali)*100) : 0,
    percVArc: vTotali ? Math.round((vArc/vTotali)*100) : 0,
    sumFantUccise, sumCavUccise, sumArcUccise, killTotali,
    impattoFant: killTotali ? Math.round((sumFantUccise/killTotali)*100) : 0,
    impattoCav: killTotali ? Math.round((sumCavUccise/killTotali)*100) : 0,
    impattoArc: killTotali ? Math.round((sumArcUccise/killTotali)*100) : 0,
    isWipeoutIncompleto,
    wipeoutPerc: vTotali ? Math.round((killTotali/vTotali)*100) : 100,
    validationStatus: isWipeoutIncompleto ? "FAILED" : "VALIDATED"
  };
};

export const calcolaPesiTierOndata = (ondata) => {
  // Funzione temporanea placeholder - nel tuo codice era per la tabella dei vantaggi.
  // Se ne hai una versione tua custom, mantieni la tua originale per non rompere la UI.
  return []; 
};

// ==========================================
// MOTORE DI REVERSE ENGINEERING
// ==========================================

export const eseguiReverseEngineering = (datiEvento) => {
  if (!datiEvento || !datiEvento.ondate) return [];
  const rapporti = {};
  
  datiEvento.ondate.forEach(ondata => {
    // 1. Raccogliamo i ratei SEPARATI PER TIPO
    const rateiPerTier = { fant: {}, cav: {}, arc: {} };
    
    ondata.giocatori.forEach((g, index) => {
      if (index === 0) return; // Escludiamo l'Host
      
      ['fant', 'cav', 'arc'].forEach(tipo => {
        if (g.dettaglioTruppe && Array.isArray(g.dettaglioTruppe[tipo])) {
          g.dettaglioTruppe[tipo].forEach(t => {
            const inviate = Number(t.inviate) || 0;
            const uccise = Number(t.uccise) || 0;
            const tier = t.tier;
            
            if (inviate > 0 && uccise > 0 && tier) {
              if (!rateiPerTier[tipo][tier]) rateiPerTier[tipo][tier] = [];
              rateiPerTier[tipo][tier].push(uccise / inviate);
            }
          });
        }
      });
    });

    // 2. Calcolo Mediane separate per categoria
    const medianeOndata = { fant: {}, cav: {}, arc: {} };
    ['fant', 'cav', 'arc'].forEach(tipo => {
      Object.keys(rateiPerTier[tipo]).forEach(t => {
        const sorted = rateiPerTier[tipo][t].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        medianeOndata[tipo][t] = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
      });
    });

    // 3. Creazione Rapporti
    
    // A. SCALARE DI TIER (Stesso tipo di truppa, Tier diversi)
    ['fant', 'cav', 'arc'].forEach(tipo => {
      const tiersPresenti = Object.keys(medianeOndata[tipo]).sort((a, b) => getTierIndex(b) - getTierIndex(a));
      
      for (let i = 0; i < tiersPresenti.length; i++) {
        for (let j = i + 1; j < tiersPresenti.length; j++) {
          const tierAlto = tiersPresenti[i];
          const tierBasso = tiersPresenti[j];
          const medAlto = medianeOndata[tipo][tierAlto];
          const medBasso = medianeOndata[tipo][tierBasso];

          if (medBasso > 0 && medAlto > 0) {
            const chiaveRapporto = `tier_${tipo}_${tierAlto}_su_${tierBasso}`;
            if (!rapporti[chiaveRapporto]) rapporti[chiaveRapporto] = [];
            rapporti[chiaveRapporto].push(medAlto / medBasso);
          }
        }
      }
    });

    // B. BONUS FAZIONE (Stesso Tier, Truppe diverse - Es. Cavalleria vs Fanteria)
    // Estraiamo tutti i Tier giocati in questa ondata
    const tiersGlobali = [...new Set([
      ...Object.keys(medianeOndata.fant), 
      ...Object.keys(medianeOndata.cav), 
      ...Object.keys(medianeOndata.arc)
    ])];

    tiersGlobali.forEach(tier => {
      const f = medianeOndata.fant[tier];
      const c = medianeOndata.cav[tier];
      // Possiamo aggiungere anche gli Arcieri (a) se iniziano a fare uccisioni

      if (f > 0 && c > 0) {
        const chiaveFazione = `fazione_cav_vs_fant_${tier}`;
        if (!rapporti[chiaveFazione]) rapporti[chiaveFazione] = [];
        rapporti[chiaveFazione].push(c / f); // Rapporto Cavalleria su Fanteria
      }
    });
  });

  // 4. Consolidamento Finale
  const risultatiIngegneria = [];
  Object.keys(rapporti).forEach(chiave => {
    const sortedRatios = rapporti[chiave].sort((a, b) => a - b);
    const mid = Math.floor(sortedRatios.length / 2);
    const medianaRapporto = sortedRatios.length % 2 !== 0 ? sortedRatios[mid] : (sortedRatios[mid - 1] + sortedRatios[mid]) / 2;
    const min = sortedRatios[0];
    const max = sortedRatios[sortedRatios.length - 1];
    const affidabile = sortedRatios.length >= 3 && (max - min) < 0.05;

    if (chiave.startsWith('fazione_')) {
      const parti = chiave.split('_');
      const tier = parti[4];
      risultatiIngegneria.push({
        tipoConfronto: 'Fazione',
        confronto: `⚔️ CAV vs FANT (${tier})`,
        tierAlto: tier,
        tierBasso: tier,
        moltiplicatoreEsatto: medianaRapporto,
        campioni: sortedRatios.length,
        min: min.toFixed(4),
        max: max.toFixed(4),
        affidabile
      });
    } else {
      const parti = chiave.split('_');
      const tipo = parti[1];
      const tierAlto = parti[2];
      const tierBasso = parti[4];
      
      const icone = { fant: '🛡️ FANT:', cav: '🐎 CAV:', arc: '🏹 ARC:' };
      
      risultatiIngegneria.push({
        tipoConfronto: 'Tier',
        confronto: `${icone[tipo]} ${tierAlto} vs ${tierBasso}`,
        tierAlto,
        tierBasso,
        moltiplicatoreEsatto: medianaRapporto,
        campioni: sortedRatios.length,
        min: min.toFixed(4),
        max: max.toFixed(4),
        affidabile
      });
    }
  });

  // Ordiniamo prima per tipo (Bonus Fazione in alto), poi per Tier
  return risultatiIngegneria.sort((a, b) => {
    if (a.tipoConfronto !== b.tipoConfronto) return a.tipoConfronto === 'Fazione' ? -1 : 1;
    return getTierIndex(b.tierAlto) - getTierIndex(a.tierAlto);
  });
};