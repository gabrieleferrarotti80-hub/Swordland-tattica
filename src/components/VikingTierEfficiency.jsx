import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next'; // 🌍 Import i18n
import { PESI_RELATIVI, getTierColor } from '../utils/vikingCalculations';

export const VikingTierEfficiency = ({ datiEvento }) => {
  const { t } = useTranslation(); // 🌍 Hook traduzione

  const statisticheDivise = useMemo(() => {
    if (!datiEvento || !datiEvento.ondate) return null;

    const aggregatoMax = {};
    const playerWaves = {};

    datiEvento.ondate.forEach(ondata => {
      ondata.giocatori.forEach(g => {
        if (g.isHost) return; 
        
        if (Number(g.punteggio) > 0) {
           if (!playerWaves[g.nome] || ondata.livello > playerWaves[g.nome]) {
               playerWaves[g.nome] = Number(ondata.livello);
           }
        }
        
        ['fant', 'cav', 'arc'].forEach(categoria => {
          const truppe = g.dettaglioTruppe?.[categoria] || [];
          truppe.forEach(truppa => {
            const tier = truppa.tier;
            const inviate = Number(truppa.inviate) || 0;
            const uccise = Number(truppa.uccise) || 0;

            if (tier && inviate > 0) {
              const key = `${g.nome}_${categoria}_${tier}`;
              
              if (!aggregatoMax[key]) {
                aggregatoMax[key] = { 
                  giocatore: g.nome,
                  categoria, 
                  tier, 
                  inviateSincrone: 0, 
                  maxUccise: -1 
                };
              }
              
              if (uccise > aggregatoMax[key].maxUccise) {
                aggregatoMax[key].maxUccise = uccise;
                aggregatoMax[key].inviateSincrone = inviate;
              }
            }
          });
        });
      });
    });

    const aggregato = { fant: {}, cav: {}, arc: {} };

    Object.values(aggregatoMax).forEach(datiGiocatore => {
      const cat = datiGiocatore.categoria;
      const t = datiGiocatore.tier;
      const inviate = datiGiocatore.inviateSincrone;
      const uccise = datiGiocatore.maxUccise > 0 ? datiGiocatore.maxUccise : 0;
      const ondateSopravvissute = playerWaves[datiGiocatore.giocatore] || 0;

      if (!aggregato[cat][t]) {
        aggregato[cat][t] = { inviate: 0, uccise: 0, rateiValidi: [], ondate: [] };
      }
      
      aggregato[cat][t].inviate += inviate;
      aggregato[cat][t].uccise += uccise;
      
      if (inviate >= 5000) {
        aggregato[cat][t].rateiValidi.push(uccise / inviate);
        aggregato[cat][t].ondate.push(ondateSopravvissute);
      }
    });

    const elaboraCategoria = (datiCategoria) => {
      const arrayTier = Object.keys(datiCategoria).map(tier => {
        const dati = datiCategoria[tier];
        
        let rateoReale = 0;
        let ondateMedie = 0;
        
        if (dati.rateiValidi.length > 0) {
          const sommaRatei = dati.rateiValidi.reduce((acc, val) => acc + val, 0);
          const sommaOndate = dati.ondate.reduce((acc, val) => acc + val, 0);
          rateoReale = sommaRatei / dati.rateiValidi.length;
          ondateMedie = sommaOndate / dati.ondate.length;
        } else {
          rateoReale = dati.inviate > 0 ? dati.uccise / dati.inviate : 0;
        }

        return { 
          tier, 
          inviate: dati.inviate, 
          uccise: dati.uccise, 
          rateoReale,
          ondateMedie: Math.round(ondateMedie)
        };
      }).sort((a, b) => {
        const numA = parseInt(a.tier.replace(/\D/g, '')) || 0;
        const numB = parseInt(b.tier.replace(/\D/g, '')) || 0;
        return numA - numB;
      });

      if (arrayTier.length > 0) {
        const tierBase = arrayTier[0];
        const pesoBaseTeorico = PESI_RELATIVI[tierBase.tier] || 1;

        arrayTier.forEach((dati, index) => {
          const pesoTeorico = PESI_RELATIVI[dati.tier] || 1;
          
          dati.efficienzaReale = tierBase.rateoReale > 0 ? ((dati.rateoReale / tierBase.rateoReale) - 1) * 100 : 0;
          dati.efficienzaTeorica = ((pesoTeorico / pesoBaseTeorico) - 1) * 100;

          if (index > 0) {
            const tierPrecedente = arrayTier[index - 1];
            const pesoPrevTeorico = PESI_RELATIVI[tierPrecedente.tier] || 1;

            dati.saltoReale = tierPrecedente.rateoReale > 0 ? ((dati.rateoReale / tierPrecedente.rateoReale) - 1) * 100 : 0;
            dati.saltoTeorico = ((pesoTeorico / pesoPrevTeorico) - 1) * 100;
          } else {
            dati.saltoReale = 0;
            dati.saltoTeorico = 0;
          }
        });
      }
      return arrayTier;
    };

    return {
      fant: elaboraCategoria(aggregato.fant),
      cav: elaboraCategoria(aggregato.cav),
      arc: elaboraCategoria(aggregato.arc)
    };
  }, [datiEvento]);

  if (!statisticheDivise) return null;

  const categorie = [
    { id: 'fant', nome: t('viking_efficiency.infantry'), colore: '#4CAF50' },
    { id: 'cav', nome: t('viking_efficiency.cavalry'), colore: '#2196F3' },
    { id: 'arc', nome: t('viking_efficiency.archers'), colore: '#F44336' }
  ];

  let totaleInviate = 0;
  categorie.forEach(c => {
    statisticheDivise[c.id].forEach(t => totaleInviate += t.inviate);
  });

  return (
    <div style={{ backgroundColor: '#1e1e2f', padding: '20px', borderRadius: '8px', border: '1px solid #9C27B0', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h3 style={{ margin: 0, color: '#9C27B0', display: 'flex', alignItems: 'center', gap: '10px' }}>
          {t('viking_efficiency.title')}
        </h3>
        <span style={{ fontSize: '12px', color: '#aaa', backgroundColor: '#2a2a40', padding: '4px 8px', borderRadius: '4px' }}>
          {t('viking_efficiency.based_on', { count: totaleInviate.toLocaleString() })}
        </span>
      </div>
      
      <p style={{ color: '#aaa', fontSize: '14px', marginBottom: '20px' }}>
        {t('viking_efficiency.description_pt1')}
        <strong>{t('viking_efficiency.description_pt2')}</strong>
        {t('viking_efficiency.description_pt3')}
        <strong style={{color:'#fff'}}>{t('viking_efficiency.description_pt4')}</strong>
        {t('viking_efficiency.description_pt5')}
      </p>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '14px', whiteSpace: 'nowrap' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #555', backgroundColor: '#2a2a40' }}>
              <th style={{ padding: '10px', textAlign: 'left', color: '#fff' }}>{t('viking_efficiency.col_tier')}</th>
              <th style={{ padding: '10px', color: '#888' }}>{t('viking_efficiency.col_deployed')}</th>
              <th style={{ padding: '10px', color: '#ff5252' }}>{t('viking_efficiency.col_kills')}</th>
              <th style={{ padding: '10px', color: '#38bdf8' }}>{t('viking_efficiency.col_waves')}</th>
              <th style={{ padding: '10px', color: '#FFD54F' }}>{t('viking_efficiency.col_ratio')}</th>
              <th style={{ padding: '10px', borderLeft: '2px solid #555', color: '#4CAF50' }}>{t('viking_efficiency.col_jump_real')}</th>
              <th style={{ padding: '10px', color: '#aaa' }}>{t('viking_efficiency.col_jump_theo')}</th>
            </tr>
          </thead>
          <tbody>
            {categorie.map(cat => {
              const datiCategoria = statisticheDivise[cat.id];
              if (!datiCategoria || datiCategoria.length === 0) return null;

              return (
                <React.Fragment key={cat.id}>
                  <tr style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderBottom: `2px solid ${cat.colore}` }}>
                    <td colSpan="7" style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 'bold', color: cat.colore, textTransform: 'uppercase', letterSpacing: '1px', fontSize: '12px' }}>
                      {cat.nome}
                    </td>
                  </tr>

                  {datiCategoria.map((dati, idx) => {
                    const baseColor = getTierColor(dati.tier);
                    const deltaEfficienza = dati.saltoReale - dati.saltoTeorico;

                    return (
                      <tr key={`${cat.id}-${dati.tier}`} style={{ borderBottom: '1px solid #333' }}>
                        <td style={{ padding: '10px', textAlign: 'left', fontWeight: 'bold', color: baseColor }}>
                          {dati.tier}
                        </td>
                        <td style={{ padding: '10px', color: '#aaa' }}>{dati.inviate.toLocaleString()}</td>
                        <td style={{ padding: '10px', color: '#ff5252', fontWeight: 'bold' }}>{dati.uccise.toLocaleString()}</td>
                        
                        <td style={{ padding: '10px', color: '#38bdf8', fontWeight: 'bold' }}>
                           {dati.ondateMedie > 0 ? t('viking_efficiency.waves_approx', { count: dati.ondateMedie }) : '-'}
                        </td>

                        <td style={{ padding: '10px', color: '#FFD54F', fontWeight: 'bold' }}>
                          {dati.rateoReale.toFixed(4)}
                        </td>
                        
                        <td style={{ padding: '10px', borderLeft: '2px solid #555', fontWeight: 'bold', color: idx === 0 ? '#555' : (dati.saltoReale >= 0 ? '#4CAF50' : '#ff5252') }}>
                          {idx === 0 ? t('viking_efficiency.base_tier') : `${dati.saltoReale > 0 ? '+' : ''}${dati.saltoReale.toFixed(1)}%`}
                          {idx !== 0 && Math.abs(deltaEfficienza) > 2 && (
                             <span style={{ display: 'block', fontSize: '11px', color: deltaEfficienza > 0 ? '#4CAF50' : '#ff5252' }}>
                               ({deltaEfficienza > 0 ? '+' : ''}{deltaEfficienza.toFixed(1)}% {t('viking_efficiency.vs_theory')})
                             </span>
                          )}
                        </td>
                        
                        <td style={{ padding: '10px', color: idx === 0 ? '#555' : '#aaa' }}>
                          {idx === 0 ? '-' : `+${dati.saltoTeorico.toFixed(1)}%`}
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};