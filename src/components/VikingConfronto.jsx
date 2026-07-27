import React, { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';

const TIER_HIERARCHY = [
  'TG5', 'TG4', 'TG3', 'TG2', 'TG1', 
  '30', '29', '28', '27', '26', '25'
];

// Le costanti pure dedotte dall'analisi del differenziale (Base 30 = 1.000)
const PESI_FISSI = {
  'TG5': 1.650,
  'TG4': 1.540,
  'TG3': 1.445,
  'TG2': 1.330,
  'TG1': 1.236,
  '30': 1.000,
  '29': 0.700, // Valori stimati per i livelli inferiori per completezza
  '28': 0.650,
  '27': 0.500
};

const getTierIndex = (tier) => {
  if (!tier) return -1;
  const cleanTier = String(tier).replace(/^Liv\s+/i, '').trim();
  return TIER_HIERARCHY.indexOf(cleanTier);
};

const calcolaMediana = (arr) => {
  if (!arr || arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

export default function VikingConfronto({ eventi }) {
  const [eventiSelezionati, setEventiSelezionati] = useState([]);

  useEffect(() => {
    if (eventi && eventi.length > 0) {
      setEventiSelezionati(eventi.map(e => e.id));
    }
  }, [eventi]);

  const toggleEvento = (id) => {
    setEventiSelezionati(prev => 
      prev.includes(id) ? prev.filter(eventId => eventId !== id) : [...prev, id]
    );
  };

  const selezionaTutti = () => setEventiSelezionati(eventi.map(e => e.id));
  const deselezionaTutti = () => setEventiSelezionati([]);

  const statisticheErrore = useMemo(() => {
    if (!eventi || eventi.length === 0 || eventiSelezionati.length === 0) return [];

    const eventiFiltrati = eventi.filter(e => eventiSelezionati.includes(e.id));
    const erroriPerTier = {};

    Object.keys(PESI_FISSI).forEach(tier => {
      erroriPerTier[tier] = { campioni: [], sortIndex: getTierIndex(tier) };
    });

    eventiFiltrati.forEach(evento => {
      if (!evento.ondate) return;

      evento.ondate.forEach(ondata => {
        // 1. Troviamo il giocatore col Tier più alto (ancora per il calcolo)
        let highestTierPlayer = null;
        let highestTierIndex = 999; 

        ondata.giocatori.forEach((g, idx) => {
          if (idx !== 0 && g.truppeInviate?.fant > 0) {
            const cleanTier = String(g.livelloTier).replace(/^Liv\s+/i, '').trim();
            const tIndex = getTierIndex(cleanTier);
            if (tIndex !== -1 && tIndex < highestTierIndex && PESI_FISSI[cleanTier]) {
              highestTierIndex = tIndex;
              highestTierPlayer = { ...g, cleanTier };
            }
          }
        });

        if (!highestTierPlayer) return; // Salta l'ondata se non ci sono tier noti

        const maxRateoReale = highestTierPlayer.truppeUccise.fant / highestTierPlayer.truppeInviate.fant;
        const maxTierWeight = PESI_FISSI[highestTierPlayer.cleanTier];

        if (maxRateoReale <= 0) return; // Evita divisioni per zero se l'host/top non ha fatto danni

        // 2. Calcoliamo l'errore per tutti gli altri giocatori
        ondata.giocatori.forEach((g, idx) => {
          if (idx === 0) return; // Salta l'host

          const inviate = g.truppeInviate?.fant || 0;
          const uccise = g.truppeUccise?.fant || 0;
          const cleanTier = String(g.livelloTier).replace(/^Liv\s+/i, '').trim();

          if (inviate > 0 && PESI_FISSI[cleanTier]) {
            // Calcolo del teorico usando le nostre costanti
            const moltiplicatore = PESI_FISSI[cleanTier] / maxTierWeight;
            const rateoTeorico = maxRateoReale * moltiplicatore;
            const uccisioniTeoriche = Math.round(rateoTeorico * inviate);

            // Se il teorico è 0, ignoriamo (campione non valido)
            if (uccisioniTeoriche > 0) {
              const deltaErrorPercentuale = ((uccise - uccisioniTeoriche) / uccisioniTeoriche) * 100;
              erroriPerTier[cleanTier].campioni.push(deltaErrorPercentuale);
            }
          }
        });
      });
    });

    // 3. Prepariamo i dati per il grafico e la tabella
    const risultati = Object.keys(erroriPerTier)
      .filter(tier => erroriPerTier[tier].campioni.length > 0)
      .map(tier => {
        const dati = erroriPerTier[tier];
        const medianaErrore = calcolaMediana(dati.campioni);
        
        // Calcolo della deviazione standard dell'errore (quanto sono ampie le fluttuazioni)
        const varianza = dati.campioni.length > 1 
          ? dati.campioni.reduce((a, b) => a + Math.pow(b - medianaErrore, 2), 0) / dati.campioni.length 
          : 0;
        const devSt = Math.sqrt(varianza);

        return {
          tier,
          medianaErrore,
          campioni: dati.campioni.length,
          deviazione: devSt,
          tierIndex: dati.sortIndex 
        };
      });

    // Ordiniamo dal Tier più basso al più alto
    risultati.sort((a, b) => b.tierIndex - a.tierIndex);

    return risultati;
  }, [eventi, eventiSelezionati]);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={{ backgroundColor: '#2a2a40', padding: '15px', border: '1px solid #555', borderRadius: '5px', color: '#fff' }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#4fc3f7' }}>Tier: {data.tier}</h4>
          <p style={{ margin: '5px 0' }}>Errore Mediano: <strong>{data.medianaErrore > 0 ? '+' : ''}{data.medianaErrore.toFixed(2)}%</strong></p>
          <p style={{ margin: '5px 0', fontSize: '13px', color: '#aaa' }}>Campioni (Ondate analizzate): {data.campioni}</p>
          <p style={{ margin: '5px 0', fontSize: '13px', color: '#aaa' }}>Fluttuazione (Dev. St.): ±{data.deviazione.toFixed(2)}%</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ backgroundColor: '#1e1e2f', padding: '30px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>
      <h2 style={{ marginTop: 0, color: '#4fc3f7', borderBottom: '1px solid #333', paddingBottom: '15px' }}>
        Stress Test Costanti: Margine di Errore Globale
      </h2>
      <p style={{ color: '#aaa', fontSize: '14px', marginBottom: '20px' }}>
        Questo pannello applica i moltiplicatori di Tier hardcoded (es. TG4 = 1.54x) su tutti gli eventi selezionati. 
        Se i pesi sono corretti, l'Errore Mediano dovrebbe essere vicino allo <strong>0.00%</strong> per ogni Tier.
      </p>

      <div style={{ backgroundColor: '#2a2a40', padding: '20px', borderRadius: '6px', marginBottom: '30px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h4 style={{ margin: 0, color: '#fff' }}>Eventi Inclusi nel Test</h4>
          <div>
            <button onClick={selezionaTutti} style={{ marginRight: '10px', padding: '5px 10px', backgroundColor: '#333', color: '#4CAF50', border: '1px solid #4CAF50', borderRadius: '4px', cursor: 'pointer' }}>Seleziona Tutti</button>
            <button onClick={deselezionaTutti} style={{ padding: '5px 10px', backgroundColor: '#333', color: '#ff5252', border: '1px solid #ff5252', borderRadius: '4px', cursor: 'pointer' }}>Deseleziona Tutti</button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
          {eventi && eventi.map(evento => (
            <label key={evento.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#aaa', cursor: 'pointer', backgroundColor: '#1a1a24', padding: '10px', borderRadius: '4px', border: '1px solid #444' }}>
              <input 
                type="checkbox" 
                checked={eventiSelezionati.includes(evento.id)} 
                onChange={() => toggleEvento(evento.id)} 
                style={{ width: '16px', height: '16px', accentColor: '#4fc3f7' }}
              />
              {evento.dataEvento || evento.id}
            </label>
          ))}
        </div>
      </div>

      {statisticheErrore.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
          
          {/* TABELLA DI VALIDAZIONE */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #444', color: '#888' }}>
                  <th style={{ padding: '12px' }}>Tier</th>
                  <th style={{ padding: '12px' }}>Peso Impostato</th>
                  <th style={{ padding: '12px', color: '#b2ebf2' }}>Errore Mediano</th>
                  <th style={{ padding: '12px' }}>Campioni</th>
                  <th style={{ padding: '12px' }}>Status Algoritmo</th>
                </tr>
              </thead>
              <tbody>
                {statisticheErrore.map((stat, i) => {
                  const margineAccettabile = Math.abs(stat.medianaErrore) <= 2.5; 
                  const pesoUtilizzato = PESI_FISSI[stat.tier] ? PESI_FISSI[stat.tier].toFixed(3) : '-';

                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #2a2a35', backgroundColor: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                      <td style={{ padding: '12px', fontWeight: 'bold', color: '#fff' }}>{stat.tier}</td>
                      <td style={{ padding: '12px', color: '#FF9800' }}>{pesoUtilizzato}x</td>
                      <td style={{ padding: '12px', fontWeight: 'bold', color: margineAccettabile ? '#4CAF50' : '#ff5252', fontSize: '16px' }}>
                        {stat.medianaErrore > 0 ? '+' : ''}{stat.medianaErrore.toFixed(2)}%
                      </td>
                      <td style={{ padding: '12px', color: '#aaa' }}>{stat.campioni}</td>
                      <td style={{ padding: '12px' }}>
                        {margineAccettabile ? (
                          <span style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: 'rgba(76, 175, 80, 0.1)', color: '#4CAF50', fontSize: '12px', fontWeight: 'bold' }}>✓ FORMULA ESATTA</span> 
                        ) : (
                          <span style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: 'rgba(255, 82, 82, 0.1)', color: '#ff5252', fontSize: '12px', fontWeight: 'bold' }}>❌ DA TARARE</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* GRAFICO A BARRE DEGLI ERRORI */}
          <div style={{ width: '100%', height: '350px', backgroundColor: '#2a2a40', padding: '20px', borderRadius: '8px' }}>
            <h4 style={{ marginTop: 0, textAlign: 'center', color: '#888' }}>Scostamento dalla Perfezione (Linea dello 0)</h4>
            <ResponsiveContainer>
              <BarChart data={statisticheErrore} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                <XAxis dataKey="tier" stroke="#aaa" />
                <YAxis stroke="#aaa" unit="%" />
                <Tooltip content={<CustomTooltip />} />
                {/* La linea dello zero rappresenta la formula perfetta */}
                <ReferenceLine y={0} stroke="#fff" strokeWidth={2} />
                <Bar dataKey="medianaErrore" radius={[4, 4, 0, 0]}>
                  {statisticheErrore.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={Math.abs(entry.medianaErrore) <= 2.5 ? '#4CAF50' : '#ff5252'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div style={{ padding: '20px', textAlign: 'center', color: '#888', fontStyle: 'italic', backgroundColor: '#1a1a24', borderRadius: '4px' }}>
          Seleziona almeno un evento per avviare lo stress test sulle costanti.
        </div>
      )}
    </div>
  );
}