import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next'; // 🌍 Import i18n

const COMPOSIZIONE_ORDE_VICHINGHE = {
  1: { tot: 23245 }, 2: { tot: 42307 }, 3: { tot: 65087 }, 4: { tot: 98484 },
  5: { tot: 146838 }, 6: { tot: 199295 }, 7: { tot: 283369 }, 8: { tot: 367985 },
  9: { tot: 456010 }, 11: { tot: 734346 }, 12: { tot: 941081 }, 13: { tot: 1257072 },
  14: { tot: 1746174 }, 15: { tot: 3019365 }, 16: { tot: 4808158 }, 17: { tot: 6971684 },
  18: { tot: 9678776 }, 19: { tot: 13451864 }
};

export default function VikingSimulator({ eventi }) {
  const { t } = useTranslation(); // 🌍 Hook traduzione
  
  const [selectedEventId, setSelectedEventId] = useState('');
  const [selectedWaveIndex, setSelectedWaveIndex] = useState(0);

  const [pesiTier, setPesiTier] = useState({ 'TG5': 1.0, 'TG4': 0.8, 'TG3': 0.6, 'TG2': 0.4, 'TG1': 0.2 });
  const [pesiClasse, setPesiClasse] = useState({ 'fant': 1.0, 'cav': 1.0, 'arc': 1.0 });

  const [risultatiOndata, setRisultatiOndata] = useState(null);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    if (eventi && eventi.length > 0 && !selectedEventId) {
      setSelectedEventId(eventi[0].id);
    }
  }, [eventi, selectedEventId]);

  const eventoCorrente = useMemo(() => {
    return eventi?.find(e => e.id === selectedEventId) || null;
  }, [eventi, selectedEventId]);

  const calcolaSimulazione = useCallback((ondata, pTier, pClasse) => {
    const livelloOndata = Number(ondata.livello);
    
    let maxNemiciDisponibili = COMPOSIZIONE_ORDE_VICHINGHE[livelloOndata]?.tot;
    if (!maxNemiciDisponibili) {
       const prev = COMPOSIZIONE_ORDE_VICHINGHE[livelloOndata - 1]?.tot || 23245;
       const next = COMPOSIZIONE_ORDE_VICHINGHE[livelloOndata + 1]?.tot || prev * 1.5;
       maxNemiciDisponibili = Math.round((prev + next) / 2);
    }

    let kRealeTotale = 0;
    
    const giocatoriStats = ondata.giocatori.map(g => {
      const kReale = (g.truppeUccise?.fant || 0) + (g.truppeUccise?.cav || 0) + (g.truppeUccise?.arc || 0);
      kRealeTotale += kReale;

      return {
        nome: g.nome,
        tierProfilo: g.livelloTier,
        dettaglioTruppe: g.dettaglioTruppe,
        k_reale: kReale,
        k_previsto_raw: 0
      };
    });

    let nemiciRimanenti = maxNemiciDisponibili;
    let faseEsaurimento = t('viking_simulator.none_survivors');

    const fasiAttacco = [
      { id: 'fant', label: t('viking_simulator.infantry'), peso: pClasse['fant'] },
      { id: 'cav', label: t('viking_simulator.cavalry'), peso: pClasse['cav'] },
      { id: 'arc', label: t('viking_simulator.archers'), peso: pClasse['arc'] }
    ];

    fasiAttacco.forEach(fase => {
      if (nemiciRimanenti <= 0) return;

      let potenzialeFaseTotale = 0;
      
      giocatoriStats.forEach(g => {
        let potenzialeGiocatoreFase = 0;
        const plotoni = g.dettaglioTruppe?.[fase.id] || [];

        plotoni.forEach(plotone => {
          const numTruppe = Number(plotone.inviate) || 0;
          if (numTruppe > 0) {
            const tierTruppa = plotone.tier || g.tierProfilo; 
            const pesoTierReale = pTier[tierTruppa] || 0.1; 
            potenzialeGiocatoreFase += numTruppe * pesoTierReale * Math.max(0.01, fase.peso);
          }
        });

        g[`potenziale_${fase.id}`] = potenzialeGiocatoreFase;
        potenzialeFaseTotale += potenzialeGiocatoreFase;
      });

      if (potenzialeFaseTotale > 0) {
        if (potenzialeFaseTotale <= nemiciRimanenti) {
          giocatoriStats.forEach(g => { g.k_previsto_raw += g[`potenziale_${fase.id}`]; });
          nemiciRimanenti -= potenzialeFaseTotale;
        } else {
          giocatoriStats.forEach(g => {
            const quota = g[`potenziale_${fase.id}`] / potenzialeFaseTotale;
            g.k_previsto_raw += (quota * nemiciRimanenti);
          });
          nemiciRimanenti = 0;
          if (faseEsaurimento === t('viking_simulator.none_survivors')) {
            faseEsaurimento = fase.label;
          }
        }
      }
    });

    const dettagliGiocatori = giocatoriStats.map(g => {
      const kPrevistoFinal = Math.round(g.k_previsto_raw);
      return {
        ...g,
        k_previsto: kPrevistoFinal,
        delta: Math.abs(kPrevistoFinal - g.k_reale)
      };
    });

    dettagliGiocatori.sort((a, b) => b.delta - a.delta);
    const kPrevistoTotale = dettagliGiocatori.reduce((acc, p) => acc + p.k_previsto, 0);
    const deltaTotale = Math.abs(kPrevistoTotale - kRealeTotale) + dettagliGiocatori.reduce((acc, p) => acc + p.delta, 0);

    return {
      livello: livelloOndata,
      max_nemici: maxNemiciDisponibili,
      fase_esaurimento: faseEsaurimento,
      k_tot_previsto: kPrevistoTotale,
      k_tot_reale: kRealeTotale,
      delta_totale: Math.abs(kPrevistoTotale - kRealeTotale),
      delta_obiettivo: deltaTotale,
      giocatori: dettagliGiocatori
    };
  }, [t]);

  useEffect(() => {
    if (!eventoCorrente || !eventoCorrente.ondate || !eventoCorrente.ondate[selectedWaveIndex]) {
      setRisultatiOndata(null);
      return;
    }
    const ondata = eventoCorrente.ondate[selectedWaveIndex];
    const risultati = calcolaSimulazione(ondata, pesiTier, pesiClasse);
    setRisultatiOndata(risultati);
  }, [eventoCorrente, selectedWaveIndex, pesiTier, pesiClasse, calcolaSimulazione]);


  const proiezioneTermometro = useMemo(() => {
    if (!eventoCorrente || !eventoCorrente.ondate || !eventoCorrente.ondate[selectedWaveIndex]) return null;
    
    const ondataBase = eventoCorrente.ondate[selectedWaveIndex];
    let potFantBase = 0, potCavBase = 0, potArcBase = 0;

    ondataBase.giocatori.forEach(g => {
      ['fant', 'cav', 'arc'].forEach(classe => {
        const plotoni = g.dettaglioTruppe?.[classe] || [];
        let potenzialeGiocatore = 0;
        plotoni.forEach(plotone => {
          const numTruppe = Number(plotone.inviate) || 0;
          if (numTruppe > 0) {
            const tierTruppa = plotone.tier || g.tierProfilo;
            const pesoTierReale = pesiTier[tierTruppa] || 0.1;
            potenzialeGiocatore += numTruppe * pesoTierReale * Math.max(0.01, pesiClasse[classe]);
          }
        });
        if (classe === 'fant') potFantBase += potenzialeGiocatore;
        if (classe === 'cav') potCavBase += potenzialeGiocatore;
        if (classe === 'arc') potArcBase += potenzialeGiocatore;
      });
    });

    const proiezioni = Object.entries(COMPOSIZIONE_ORDE_VICHINGHE).map(([livelloStr, dati]) => {
      const livello = Number(livelloStr);
      const cap = dati.tot;
      
      const ondataReale = eventoCorrente.ondate.find(o => Number(o.livello) === livello);
      
      let kRealiFant = '-', kRealiCav = '-', kRealiArc = '-';
      let potFant = potFantBase, potCav = potCavBase, potArc = potArcBase;
      let datiRealiDisponibili = false;

      if (ondataReale) {
        datiRealiDisponibili = true;
        let realiF = 0, realiC = 0, realiA = 0;
        potFant = 0; potCav = 0; potArc = 0; 

        ondataReale.giocatori.forEach(g => {
          realiF += (g.truppeUccise?.fant || 0);
          realiC += (g.truppeUccise?.cav || 0);
          realiA += (g.truppeUccise?.arc || 0);

          ['fant', 'cav', 'arc'].forEach(classe => {
            const plotoni = g.dettaglioTruppe?.[classe] || [];
            let potenzialeGiocatore = 0;
            plotoni.forEach(plotone => {
              const numTruppe = Number(plotone.inviate) || 0;
              if (numTruppe > 0) {
                const tierTruppa = plotone.tier || g.tierProfilo;
                const pesoTierReale = pesiTier[tierTruppa] || 0.1;
                potenzialeGiocatore += numTruppe * pesoTierReale * Math.max(0.01, pesiClasse[classe]);
              }
            });
            if (classe === 'fant') potFant += potenzialeGiocatore;
            if (classe === 'cav') potCav += potenzialeGiocatore;
            if (classe === 'arc') potArc += potenzialeGiocatore;
          });
        });
        kRealiFant = realiF;
        kRealiCav = realiC;
        kRealiArc = realiA;
      }

      let statoFanteria = 'Attiva';
      let statoCavalleria = 'Inattiva';
      let statoArcieri = 'Inattivi';
      let backgroundColor = '#2a2a40';

      if (cap <= potFant) {
        statoFanteria = 'Attiva (Esaurisce)';
        backgroundColor = '#1e2f1e';
      } else if (cap <= potFant + potCav) {
        statoFanteria = 'Max Kills';
        statoCavalleria = 'Attiva (Esaurisce)';
        backgroundColor = '#2f2f1e'; 
      } else {
        statoFanteria = 'Max Kills';
        statoCavalleria = 'Max Kills';
        statoArcieri = 'Attivi';
        backgroundColor = '#2f1e1e';
      }

      return {
        livello, cap,
        statoFanteria, statoCavalleria, statoArcieri,
        kRealiFant, kRealiCav, kRealiArc,
        datiRealiDisponibili, backgroundColor
      };
    });

    return { proiezioni };
  }, [eventoCorrente, selectedWaveIndex, pesiTier, pesiClasse]);

  const autoCalibra = () => {
    if (!eventoCorrente || !eventoCorrente.ondate || !eventoCorrente.ondate[selectedWaveIndex]) return;
    const ondata = eventoCorrente.ondate[selectedWaveIndex];

    let bestTier = { ...pesiTier };
    let bestClasse = { ...pesiClasse };
    let bestDelta = calcolaSimulazione(ondata, bestTier, bestClasse).delta_obiettivo;

    const limit = (val) => Math.max(0.01, Math.min(10.0, val));

    for (let i = 0; i < 1000; i++) {
      let tempTier = { ...bestTier };
      let tempClasse = { ...bestClasse };

      if (Math.random() > 0.5) {
        const keys = Object.keys(tempTier);
        const randomKey = keys[Math.floor(Math.random() * keys.length)];
        tempTier[randomKey] = limit(tempTier[randomKey] + (Math.random() * 0.4 - 0.2));
      } else {
        const keys = Object.keys(tempClasse);
        const randomKey = keys[Math.floor(Math.random() * keys.length)];
        tempClasse[randomKey] = limit(tempClasse[randomKey] + (Math.random() * 0.4 - 0.2));
      }

      const risultato = calcolaSimulazione(ondata, tempTier, tempClasse);

      if (risultato.delta_obiettivo < bestDelta) {
        bestDelta = risultato.delta_obiettivo;
        bestTier = tempTier;
        bestClasse = tempClasse;
      }
    }

    Object.keys(bestTier).forEach(k => bestTier[k] = Number(bestTier[k].toFixed(2)));
    Object.keys(bestClasse).forEach(k => bestClasse[k] = Number(bestClasse[k].toFixed(2)));

    setPesiTier(bestTier);
    setPesiClasse(bestClasse);
  };

  const handleEventChange = (e) => {
    setSelectedEventId(e.target.value);
    setSelectedWaveIndex(0);
  };

  const handleWaveChange = (e) => {
    setSelectedWaveIndex(Number(e.target.value));
  };

  const selectStyle = {
    padding: '10px 15px', backgroundColor: '#2a2a40', color: '#fff',
    border: '1px solid #4CAF50', borderRadius: '6px', fontSize: '15px',
    outline: 'none', cursor: 'pointer', minWidth: '280px'
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#121212', minHeight: '100vh', color: '#fff' }}>
      
      <div style={{ backgroundColor: '#1e1e2f', padding: '20px', borderRadius: '8px', borderLeft: '4px solid #00BCD4', marginBottom: '20px', position: 'relative' }}>
        <div 
          onMouseEnter={() => setShowTooltip(true)} 
          onMouseLeave={() => setShowTooltip(false)}
          style={{ display: 'inline-flex', alignItems: 'center', cursor: 'help' }}
        >
          <h2 style={{ color: '#B2EBF2', margin: 0 }}>{t('viking_simulator.tooltip_title')}</h2>
          <span style={{ marginLeft: '10px', backgroundColor: '#00BCD4', color: '#000', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 'bold' }}>?</span>
        </div>
        <p style={{ color: '#aaa', fontSize: '14px', marginTop: '10px', marginBottom: 0 }}>
          {t('viking_simulator.tooltip_desc')}
        </p>

        {showTooltip && (
          <div style={{
            position: 'absolute', top: '70px', left: '20px', zIndex: 100, backgroundColor: '#2a2a40',
            border: '1px solid #00BCD4', borderRadius: '8px', padding: '20px', width: '500px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.8)', color: '#fff', fontSize: '14px', lineHeight: '1.5'
          }}>
            <h4 style={{ color: '#00BCD4', margin: '0 0 10px 0' }}>{t('viking_simulator.how_it_works')}</h4>
            <p>{t('viking_simulator.how_desc')}</p>
            <ol style={{ paddingLeft: '20px', margin: '10px 0' }}>
              <li style={{ marginBottom: '8px' }}><strong>{t('viking_simulator.rule_1')}</strong> {t('viking_simulator.rule_1_desc')}</li>
              <li style={{ marginBottom: '8px' }}><strong>{t('viking_simulator.rule_2')}</strong> {t('viking_simulator.rule_2_desc')}</li>
              <li><strong>{t('viking_simulator.rule_3')}</strong> {t('viking_simulator.rule_3_desc')}</li>
            </ol>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '20px', marginBottom: '25px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label style={{ color: '#aaa', fontSize: '12px', fontWeight: 'bold' }}>{t('viking_simulator.select_event')}</label>
          <select value={selectedEventId} onChange={handleEventChange} style={selectStyle}>
            {eventi?.map(ev => (
              <option key={ev.id} value={ev.id}>{ev.nomeEvento ? `${ev.dataEvento || ''} - ${ev.nomeEvento}` : ev.id}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label style={{ color: '#aaa', fontSize: '12px', fontWeight: 'bold' }}>{t('viking_simulator.select_wave')}</label>
          <select value={selectedWaveIndex} onChange={handleWaveChange} style={{...selectStyle, borderColor: '#FF9800', minWidth: '180px'}} disabled={!eventoCorrente}>
            {eventoCorrente?.ondate?.map((ondata, idx) => (
              <option key={idx} value={idx}>{t('viking_simulator.wave_lvl', { lvl: ondata.livello })}</option>
            ))}
          </select>
        </div>
        
        <button 
          onClick={autoCalibra}
          style={{
            padding: '10px 20px', backgroundColor: '#E91E63', color: '#fff', border: 'none',
            borderRadius: '6px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer',
            height: '42px', boxShadow: '0 2px 8px rgba(233, 30, 99, 0.4)'
          }}
        >
          {t('viking_simulator.btn_autocalibrate')}
        </button>
      </div>

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '25px' }}>
        <div style={{ flex: 1, backgroundColor: '#1e1e2f', padding: '15px 20px', borderRadius: '8px', border: '1px solid #444' }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#FFB300' }}>{t('viking_simulator.calib_tier')}</h4>
          <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
            {['TG5', 'TG4', 'TG3', 'TG2', 'TG1'].map(tier => (
              <div key={tier} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#2a2a40', padding: '8px', borderRadius: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#b2ebf2' }}>{tier}: {pesiTier[tier] ?? 0.1}</span>
                <input type="range" min="0.05" max="10.0" step="0.05" value={pesiTier[tier] ?? 0.1} onChange={(e) => setPesiTier({...pesiTier, [tier]: Number(e.target.value)}) } style={{ width: '80px', cursor: 'pointer', marginTop: '5px' }} />
              </div>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, backgroundColor: '#1e1e2f', padding: '15px 20px', borderRadius: '8px', border: '1px solid #444' }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#4CAF50' }}>{t('viking_simulator.calib_class')}</h4>
          <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
            {[{id: 'fant', l: t('viking_simulator.infantry')}, {id: 'cav', l: t('viking_simulator.cavalry')}, {id: 'arc', l: t('viking_simulator.archers')}].map(cls => (
              <div key={cls.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#2a2a40', padding: '8px', borderRadius: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#b2ebf2' }}>{cls.l}: {pesiClasse[cls.id]}</span>
                <input type="range" min="0.05" max="10.0" step="0.05" value={pesiClasse[cls.id]} onChange={(e) => setPesiClasse({...pesiClasse, [cls.id]: Number(e.target.value)}) } style={{ width: '80px', cursor: 'pointer', marginTop: '5px' }} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {risultatiOndata && (
        <div style={{ backgroundColor: '#1e1e2f', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333', paddingBottom: '15px', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ color: '#4CAF50', margin: 0, marginBottom: '5px' }}>{t('viking_simulator.wave_lvl', { lvl: risultatiOndata.livello })}</h3>
              <div style={{ fontSize: '13px', color: '#aaa', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span>{t('viking_simulator.enemy_cap')} <strong>{risultatiOndata.max_nemici.toLocaleString()}</strong></span>
                <span style={{ color: risultatiOndata.fase_esaurimento !== t('viking_simulator.none_survivors') ? '#ff5252' : '#4CAF50' }}>
                  {t('viking_simulator.pool_exhaustion')} <strong>{risultatiOndata.fase_esaurimento}</strong>
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '20px', fontSize: '14px', flexWrap: 'wrap' }}>
              <span style={{ color: '#FFB300' }}>{t('viking_simulator.simulated')} <strong>{risultatiOndata.k_tot_previsto.toLocaleString()}</strong></span>
              <span style={{ color: '#4CAF50' }}>{t('viking_simulator.real')} <strong>{risultatiOndata.k_tot_reale.toLocaleString()}</strong></span>
              <span style={{ color: risultatiOndata.delta_totale < 50 ? '#4CAF50' : '#ff5252' }}>
                {t('viking_simulator.alliance_delta')} <strong>{risultatiOndata.delta_totale.toLocaleString()}</strong>
              </span>
            </div>
          </div>
          
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#2a2a40', color: '#fff', textAlign: 'left', fontSize: '14px' }}>
                <th style={{ padding: '12px' }}>{t('viking_simulator.player_tier')}</th>
                <th style={{ padding: '12px', color: '#FFB300', textAlign: 'right' }}>{t('viking_simulator.predicted_kills')}</th>
                <th style={{ padding: '12px', color: '#4CAF50', textAlign: 'right' }}>{t('viking_simulator.real_kills')}</th>
                <th style={{ padding: '12px', textAlign: 'center' }}>{t('viking_simulator.delta_error')}</th>
              </tr>
            </thead>
            <tbody>
              {risultatiOndata.giocatori.map((g, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #333', fontSize: '14px' }}>
                  <td style={{ padding: '12px' }}>
                    <strong>{g.nome}</strong> <span style={{ color: '#888', fontSize: '12px' }}>({g.tierProfilo || '-'})</span>
                  </td>
                  <td style={{ padding: '12px', color: '#FFB300', textAlign: 'right' }}>{g.k_previsto.toLocaleString()}</td>
                  <td style={{ padding: '12px', color: '#4CAF50', textAlign: 'right' }}>{g.k_reale.toLocaleString()}</td>
                  <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', color: g.delta < 50 ? '#4CAF50' : '#FF9800' }}>
                    {g.delta < 50 ? '✓' : `± ${g.delta.toLocaleString()}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {proiezioneTermometro && (
        <div style={{ backgroundColor: '#1e1e2f', padding: '20px', borderRadius: '8px', border: '1px solid #00BCD4' }}>
          <h3 style={{ color: '#00BCD4', margin: '0 0 5px 0' }}>{t('viking_simulator.thermometer_title')}</h3>
          <p style={{ color: '#aaa', fontSize: '13px', margin: '0 0 15px 0' }}>
            {t('viking_simulator.thermometer_desc')}
          </p>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
            <thead>
              <tr style={{ backgroundColor: '#121212', color: '#ccc', textAlign: 'center', fontSize: '12px' }}>
                <th rowSpan="2" style={{ padding: '10px', borderBottom: '1px solid #333' }}>{t('viking_simulator.lvl')}</th>
                <th rowSpan="2" style={{ padding: '10px', borderBottom: '1px solid #333' }}>{t('viking_simulator.enemy_cap')}</th>
                <th colSpan="3" style={{ padding: '5px', borderBottom: '1px solid #555', borderLeft: '1px solid #333', color: '#b2ebf2' }}>{t('viking_simulator.simulator_prediction')}</th>
                <th colSpan="3" style={{ padding: '5px', borderBottom: '1px solid #555', borderLeft: '1px solid #333', color: '#4CAF50' }}>{t('viking_simulator.alliance_real_data')}</th>
              </tr>
              <tr style={{ backgroundColor: '#121212', color: '#ccc', textAlign: 'center', fontSize: '11px' }}>
                <th style={{ padding: '8px', borderBottom: '1px solid #333', borderLeft: '1px solid #333' }}>{t('viking_simulator.infantry')}</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #333', color: '#FF9800' }}>{t('viking_simulator.cavalry')}</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #333', color: '#E91E63' }}>{t('viking_simulator.archers')}</th>
                
                <th style={{ padding: '8px', borderBottom: '1px solid #333', borderLeft: '1px solid #333' }}>{t('viking_simulator.k_infantry')}</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #333', color: '#FF9800' }}>{t('viking_simulator.k_cavalry')}</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #333', color: '#E91E63' }}>{t('viking_simulator.k_archers')}</th>
              </tr>
            </thead>
            <tbody>
              {proiezioneTermometro.proiezioni.map((p, i) => (
                <tr key={i} style={{ backgroundColor: p.backgroundColor, borderBottom: '1px solid #333', fontSize: '13px', textAlign: 'center' }}>
                  <td style={{ padding: '10px', fontWeight: 'bold' }}>{p.livello}</td>
                  <td style={{ padding: '10px' }}>{p.cap.toLocaleString()}</td>
                  
                  <td style={{ padding: '10px', borderLeft: '1px solid #333', color: p.statoFanteria.includes('Esaurisce') ? '#fff' : '#aaa' }}>{p.statoFanteria}</td>
                  <td style={{ padding: '10px', color: p.statoCavalleria.includes('Attiva') ? '#FF9800' : '#666', fontWeight: p.statoCavalleria.includes('Attiva') ? 'bold' : 'normal' }}>{p.statoCavalleria}</td>
                  <td style={{ padding: '10px', color: p.statoArcieri.includes('Attivi') ? '#E91E63' : '#666', fontWeight: p.statoArcieri.includes('Attivi') ? 'bold' : 'normal' }}>{p.statoArcieri}</td>
                  
                  <td style={{ padding: '10px', borderLeft: '1px solid #333', color: p.kRealiFant !== '-' ? '#fff' : '#444' }}>
                    {p.kRealiFant !== '-' ? p.kRealiFant.toLocaleString() : '-'}
                  </td>
                  <td style={{ padding: '10px', color: (p.kRealiCav !== '-' && p.kRealiCav > 0) ? '#FF9800' : '#444', fontWeight: (p.kRealiCav > 0) ? 'bold' : 'normal' }}>
                    {p.kRealiCav !== '-' ? p.kRealiCav.toLocaleString() : '-'}
                  </td>
                  <td style={{ padding: '10px', color: (p.kRealiArc !== '-' && p.kRealiArc > 0) ? '#E91E63' : '#444', fontWeight: (p.kRealiArc > 0) ? 'bold' : 'normal' }}>
                    {p.kRealiArc !== '-' ? p.kRealiArc.toLocaleString() : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}