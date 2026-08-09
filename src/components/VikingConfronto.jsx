import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Bar, LineChart, Line, AreaChart, Area, 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend 
} from 'recharts';
import { useTranslation } from 'react-i18next'; // 🌍 Import i18n
import { PESI_RELATIVI, getTierIndex } from '../utils/vikingCalculations';

const calcolaMediana = (arr) => {
  if (!arr || arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const TIER_COLORS = ['#ff5252', '#FF9800', '#4CAF50', '#2196F3', '#9C27B0', '#FFD54F', '#00BCD4'];
const DASH_ARRAYS = ["", "5 5", "3 3", "10 5"];

export default function VikingConfronto({ eventi }) {
  const { t } = useTranslation(); // 🌍 Hook traduzione
  const [eventiSelezionati, setEventiSelezionati] = useState([]);
  const [escludiHost, setEscludiHost] = useState(true);

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

  const eventiProcessati = useMemo(() => {
    if (!eventi || eventiSelezionati.length === 0) return [];
    const eventiFiltrati = eventi.filter(e => eventiSelezionati.includes(e.id));
    
    return eventiFiltrati.map(evento => {
      const nomeEv = evento.nomeEvento ? `${evento.dataEvento || ''} - ${evento.nomeEvento}` : (evento.dataEvento || evento.id.substring(0, 5));
      const rawScaling = {};
      const rawIngaggio = {};
      
      evento.ondate?.forEach(ondata => {
        const lvl = ondata.livello;
        if (!rawScaling[lvl]) rawScaling[lvl] = {};
        
        if (!rawIngaggio[lvl]) {
          rawIngaggio[lvl] = { 
            uccF: 0, uccC: 0, uccA: 0, 
            invF: 0, invC: 0, invA: 0 
          };
        }
        
        ondata.giocatori.forEach((g, idx) => {
          const isHost = (idx === 0);

          if (escludiHost && isHost) return;

          rawIngaggio[lvl].uccF += (g.truppeUccise?.fant || 0);
          rawIngaggio[lvl].uccC += (g.truppeUccise?.cav || 0);
          rawIngaggio[lvl].uccA += (g.truppeUccise?.arc || 0);

          rawIngaggio[lvl].invF += (g.truppeInviate?.fant || 0);
          rawIngaggio[lvl].invC += (g.truppeInviate?.cav || 0);
          rawIngaggio[lvl].invA += (g.truppeInviate?.arc || 0);

          if (!isHost) {
            const tierDellaFanteria = g.truppeInviate?.tierFant || g.livelloTier; 
            const cleanTier = String(tierDellaFanteria).replace(/^Liv\s+/i, '').trim(); 
            const invF = g.truppeInviate?.fant || 0; 
            const uccF = g.truppeUccise?.fant || 0; 
            
            if (invF > 1000 && cleanTier) { 
              if (!rawScaling[lvl][cleanTier]) rawScaling[lvl][cleanTier] = []; 
              rawScaling[lvl][cleanTier].push(uccF / invF); 
            }
          }
        });
      });

      const scalingChartData = [];
      const trackTiers = new Set();
      
      Object.keys(rawScaling).sort((a,b) => Number(a) - Number(b)).forEach(lvl => {
        const row = { wave: `Lvl ${lvl}` };
        Object.keys(rawScaling[lvl]).forEach(tier => {
           row[tier] = Number(calcolaMediana(rawScaling[lvl][tier]).toFixed(4));
           trackTiers.add(tier);
        });
        scalingChartData.push(row);
      });

      const lineeProps = Array.from(trackTiers).sort((a,b) => getTierIndex(a) - getTierIndex(b)).map(tier => ({
        dataKey: tier,
        name: tier,
        color: TIER_COLORS[getTierIndex(tier) % TIER_COLORS.length] || '#fff'
      }));

      const ingaggioChartData = Object.keys(rawIngaggio).sort((a,b) => Number(a) - Number(b)).map(lvl => {
        const d = rawIngaggio[lvl];
        const totUccise = d.uccF + d.uccC + d.uccA;
        return {
          wave: `Lvl ${lvl}`,
          Fanteria: totUccise === 0 ? 0 : Number(((d.uccF / totUccise) * 100).toFixed(1)),
          Cavalleria: totUccise === 0 ? 0 : Number(((d.uccC / totUccise) * 100).toFixed(1)),
          Arcieri: totUccise === 0 ? 0 : Number(((d.uccA / totUccise) * 100).toFixed(1)),
          raw: d 
        };
      });

      return { id: evento.id, nome: nomeEv, scalingChartData, lineeProps, ingaggioChartData };
    });
  }, [eventi, eventiSelezionati, escludiHost]);

  const datiGlobaliOverlay = useMemo(() => {
    if (eventiProcessati.length === 0) return { chartData: [], lineeProps: [] };
    
    const mergedData = {};
    const lineeProps = [];

    let maxLvl = 1; 
    eventiProcessati.forEach(ev => {
       ev.scalingChartData.forEach(row => {
          const l = parseInt(row.wave.replace('Lvl ', ''));
          if (l > maxLvl) maxLvl = l;
       });
    });

    for (let i = 1; i <= maxLvl; i++) {
       mergedData[`Lvl ${i}`] = { wave: `Lvl ${i}` };
    }
    
    eventiProcessati.forEach((ev, evIdx) => {
       const dashStyle = DASH_ARRAYS[evIdx % DASH_ARRAYS.length];
       const shortName = ev.nome.includes('-') ? ev.nome.split('-').pop().trim() : ev.nome.substring(0, 5);
       
       ev.scalingChartData.forEach(row => {
          const lvl = row.wave;
          
          ev.lineeProps.forEach(linea => {
             if (row[linea.dataKey] !== undefined) {
                const key = `${linea.dataKey} (${shortName})`;
                mergedData[lvl][key] = row[linea.dataKey];
                
                if (!lineeProps.find(l => l.dataKey === key)) {
                   lineeProps.push({
                      dataKey: key,
                      name: key,
                      color: linea.color,
                      dash: dashStyle
                   });
                }
             }
          });
       });
    });
    
    const chartData = Object.values(mergedData).sort((a,b) => Number(a.wave.replace('Lvl ','')) - Number(b.wave.replace('Lvl ','')));
    return { chartData, lineeProps };
  }, [eventiProcessati]);

  const datiTabellaRatei = useMemo(() => {
    if (!eventi || eventiSelezionati.length === 0) return [];
    const eventiFiltrati = eventi.filter(e => eventiSelezionati.includes(e.id));

    return eventiFiltrati.map(evento => {
      const nomeEv = evento.nomeEvento ? `${evento.dataEvento || ''} - ${evento.nomeEvento}` : (evento.dataEvento || evento.id.substring(0, 5));
      
      const righe = {};
      const ondateDisponibili = new Set();

      evento.ondate?.forEach(ondata => {
        const lvl = ondata.livello;
        ondateDisponibili.add(lvl);

        ondata.giocatori.forEach((g, idx) => {
          if (escludiHost && idx === 0) return;

          const nome = g.nome || `Giocatore ${idx}`;
          const tier = String(g.livelloTier || g.truppeInviate?.tierFant || '').replace(/^Liv\s+/i, '').trim() || 'N/A';
          const baseKey = `${nome}_${tier}`;

          const registraRateo = (tipo, inviate, uccise) => {
            if (inviate > 0) {
              const key = `${baseKey}_${tipo}`;
              if (!righe[key]) {
                righe[key] = { giocatore: nome, tier, tipo, ratei: {} };
              }
              righe[key].ratei[lvl] = Number((uccise / inviate).toFixed(4));
            }
          };

          registraRateo('Fanteria', g.truppeInviate?.fant || 0, g.truppeUccise?.fant || 0);
          registraRateo('Cavalleria', g.truppeInviate?.cav || 0, g.truppeUccise?.cav || 0);
          registraRateo('Arcieri', g.truppeInviate?.arc || 0, g.truppeUccise?.arc || 0);
        });
      });

      return {
        id: evento.id,
        nome: nomeEv,
        ondate: Array.from(ondateDisponibili).sort((a, b) => Number(a) - Number(b)),
        dati: Object.values(righe).sort((a, b) => 
          a.giocatore.localeCompare(b.giocatore) || 
          b.tier.localeCompare(a.tier) ||
          a.tipo.localeCompare(b.tipo)
        )
      };
    });
  }, [eventi, eventiSelezionati, escludiHost]);
  
  const datiTabellaIncrementi = useMemo(() => {
    if (!eventiProcessati || eventiProcessati.length === 0) return { righe: [], colonne: [] };

    const colonne = eventiProcessati.map(ev => ({ id: ev.id, nome: ev.nome }));
    
    let maxLvl = 1;
    eventiProcessati.forEach(ev => {
       ev.ingaggioChartData.forEach(row => {
          const l = parseInt(row.wave.replace('Lvl ', ''));
          if (l > maxLvl) maxLvl = l;
       });
    });

    const rateiEventi = {};
    eventiProcessati.forEach(ev => {
      rateiEventi[ev.id] = {};
      ev.ingaggioChartData.forEach(row => {
        const l = parseInt(row.wave.replace('Lvl ', ''));
        const invF = row.raw.invF;
        const uccF = row.raw.uccF;
        rateiEventi[ev.id][l] = invF > 0 ? (uccF / invF) : 0;
      });
    });

    const righe = [];
    for (let i = 1; i < maxLvl; i++) {
      const lvlAttuale = i;
      const lvlSuccessivo = i + 1;
      const riga = { 
        etichetta: `Lvl ${lvlAttuale} ➡️ Lvl ${lvlSuccessivo}`,
        lvl: lvlSuccessivo 
      };
      
      eventiProcessati.forEach(ev => {
        const r1 = rateiEventi[ev.id][lvlAttuale];
        const r2 = rateiEventi[ev.id][lvlSuccessivo];
        
        if (r1 && r2 && r1 > 0) {
          const moltiplicatore = r2 / r1;
          riga[ev.id] = Number(moltiplicatore.toFixed(4));
        } else {
          riga[ev.id] = null;
        }
      });
      
      righe.push(riga);
    }

    return { colonne, righe };
  }, [eventiProcessati]);

  const esportaDatiJSON = () => {
    if (!eventiProcessati || eventiProcessati.length === 0) {
      alert(t('viking_confronto.select_export_alert'));
      return;
    }

    const payload = {
      timestamp_esportazione: new Date().toISOString(),
      parametri: {
        host_escluso: escludiHost
      },
      dati_eventi: eventiProcessati
    };

    const dataStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.href = url;
    link.download = `Viking_Export_IA_${new Date().getTime()}.json`;
    document.body.appendChild(link);
    link.click();
    
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const CustomTooltipIngaggio = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const rawData = payload[0].payload.raw;
      
      return (
        <div style={{ backgroundColor: '#1e1e2f', padding: '12px', border: '1px solid #444', borderRadius: '6px', color: '#fff', fontSize: '13px' }}>
          <p style={{ margin: '0 0 10px 0', fontWeight: 'bold', borderBottom: '1px solid #444', paddingBottom: '6px', color: '#4fc3f7' }}>
            {label}
          </p>
          
          <div style={{ marginBottom: '10px' }}>
            <strong style={{ color: '#aaa' }}>{t('viking_confronto.defense_volume')}</strong>
            <div style={{ marginTop: '3px' }}>🛡️ {t('viking_confronto.infantry')}: {rawData.invF.toLocaleString()}</div>
            <div>🐎 {t('viking_confronto.cavalry')}: {rawData.invC.toLocaleString()}</div>
            <div>🏹 {t('viking_confronto.archers')}: {rawData.invA.toLocaleString()}</div>
            <div style={{ marginTop: '3px', fontWeight: 'bold', color: '#ddd' }}>
              {t('viking_confronto.total_in_base')} {(rawData.invF + rawData.invC + rawData.invA).toLocaleString()}
            </div>
          </div>

          <div>
            <strong style={{ color: '#aaa' }}>{t('viking_confronto.damage_split')}</strong>
            <div style={{ marginTop: '3px', color: '#4fc3f7' }}>
              {t('viking_confronto.infantry')}: {payload.find(p => p.dataKey === 'Fanteria')?.value}% ({rawData.uccF.toLocaleString()})
            </div>
            <div style={{ color: '#ba68c8' }}>
              {t('viking_confronto.cavalry')}: {payload.find(p => p.dataKey === 'Cavalleria')?.value}% ({rawData.uccC.toLocaleString()})
            </div>
            <div style={{ color: '#ffb74d' }}>
              {t('viking_confronto.archers')}: {payload.find(p => p.dataKey === 'Arcieri')?.value}% ({rawData.uccA.toLocaleString()})
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ backgroundColor: '#1e1e2f', padding: '30px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>
      <h2 style={{ marginTop: 0, color: '#4fc3f7', borderBottom: '1px solid #333', paddingBottom: '15px' }}>
        {t('viking_confronto.dashboard_title')}
      </h2>
      
      <div style={{ backgroundColor: '#2a2a40', padding: '20px', borderRadius: '6px', marginBottom: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
          <h4 style={{ margin: 0, color: '#fff' }}>{t('viking_confronto.events_to_analyze')}</h4>
          <div>
           <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button onClick={selezionaTutti} style={{ padding: '5px 10px', backgroundColor: '#333', color: '#4CAF50', border: '1px solid #4CAF50', borderRadius: '4px', cursor: 'pointer' }}>{t('viking_confronto.all')}</button>
            <button onClick={deselezionaTutti} style={{ padding: '5px 10px', backgroundColor: '#333', color: '#ff5252', border: '1px solid #ff5252', borderRadius: '4px', cursor: 'pointer' }}>{t('viking_confronto.none')}</button>
            <div style={{ width: '1px', height: '24px', backgroundColor: '#555', margin: '0 5px' }}></div>
            <button onClick={esportaDatiJSON} style={{ padding: '5px 15px', backgroundColor: '#4fc3f7', color: '#1a1a24', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
              {t('viking_confronto.export_ia')}
            </button>
          </div>
        </div>
        </div>

        <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#1a1a24', padding: '12px 15px', borderRadius: '6px', border: '1px solid #444' }}>
          <input
            type="checkbox"
            id="toggleHost"
            checked={escludiHost}
            onChange={(e) => setEscludiHost(e.target.checked)}
            style={{ cursor: 'pointer', width: '18px', height: '18px', accentColor: '#4fc3f7' }}
          />
          <label htmlFor="toggleHost" style={{ cursor: 'pointer', fontWeight: 'bold', color: '#e0e0e0', fontSize: '14px' }}>
            {t('viking_confronto.isolate_reinforcements')}
          </label>
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
              {evento.nomeEvento ? `${evento.dataEvento || ''} - ${evento.nomeEvento}` : (evento.dataEvento || evento.id)}
            </label>
          ))}
        </div>
      </div>

      {eventiProcessati.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '60px' }}>

          <div>
            <h3 style={{ color: '#FF9800', borderBottom: '1px solid #555', paddingBottom: '10px', marginBottom: '30px' }}>
              {t('viking_confronto.section_1_title')}
            </h3>
            <p style={{ color: '#aaa', fontSize: '14px', marginBottom: '20px' }}>
              {t('viking_confronto.section_1_desc')}
            </p>
            
            {eventiProcessati.map((ev) => (
              <div key={ev.id} style={{ backgroundColor: '#2a2a40', padding: '20px', borderRadius: '8px', marginBottom: '40px', border: '1px solid #444' }}>
                <h4 style={{ color: '#fff', fontSize: '18px', marginTop: 0, marginBottom: '20px', borderBottom: '1px dashed #555', paddingBottom: '10px' }}>
                  {t('viking_confronto.event')} {ev.nome}
                </h4>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                  <div>
                    <h5 style={{ color: '#4fc3f7', marginTop: 0, textAlign: 'center' }}>{t('viking_confronto.scaling_engine')}</h5>
                    <div style={{ height: '300px' }}>
                      <ResponsiveContainer>
                        <LineChart data={ev.scalingChartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                          <XAxis dataKey="wave" stroke="#aaa" fontSize={12} />
                          <YAxis stroke="#aaa" fontSize={12} label={{ value: t('viking_confronto.ratio_y_label'), angle: -90, position: 'insideLeft', fill: '#aaa', fontSize: 10 }} />
                          <Tooltip contentStyle={{ backgroundColor: '#1a1a24', border: '1px solid #555', borderRadius: '5px' }} />
                          <Legend wrapperStyle={{ fontSize: '12px' }} />
                          {ev.lineeProps.map((linea) => (
                            <Line 
                              key={linea.dataKey} 
                              type="monotone" 
                              dataKey={linea.dataKey} 
                              name={linea.name} 
                              stroke={linea.color} 
                              strokeWidth={2} 
                              dot={{ r: 3 }}
                              connectNulls={true}
                            />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div>
                    <h5 style={{ color: '#ba68c8', marginTop: 0, textAlign: 'center' }}>{t('viking_confronto.engagement_rules')}</h5>
                    <div style={{ height: '300px' }}>
                      <ResponsiveContainer>
                        <AreaChart data={ev.ingaggioChartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                          <XAxis dataKey="wave" stroke="#aaa" fontSize={12} />
                          <YAxis stroke="#aaa" fontSize={12} unit="%" />
                          <Tooltip content={<CustomTooltipIngaggio />} />
                          <Legend wrapperStyle={{ fontSize: '12px' }} />
                          <Area type="monotone" dataKey="Fanteria" stackId="1" stroke="#4fc3f7" fill="#4fc3f7" isAnimationActive={false} />
                          <Area type="monotone" dataKey="Cavalleria" stackId="1" stroke="#ba68c8" fill="#ba68c8" isAnimationActive={false} />
                          <Area type="monotone" dataKey="Arcieri" stackId="1" stroke="#ffb74d" fill="#ffb74d" isAnimationActive={false} />
                          <ReferenceLine x="Lvl 18" stroke="#ff5252" strokeWidth={2} strokeDasharray="4 4" label={{ position: 'top', value: 'Bug 18', fill: '#ff5252', fontSize: 10 }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div>
            <h3 style={{ color: '#4CAF50', borderBottom: '1px solid #555', paddingBottom: '10px' }}>
              {t('viking_confronto.section_2_title')}
            </h3>
            <p style={{ color: '#aaa', fontSize: '14px', marginBottom: '20px' }}>
              {t('viking_confronto.section_2_desc')}
            </p>
            
            <div style={{ width: '100%', height: '500px', backgroundColor: '#2a2a40', padding: '20px', borderRadius: '8px', border: '1px solid #444' }}>
              <ResponsiveContainer>
                <LineChart data={datiGlobaliOverlay.chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="wave" stroke="#aaa" />
                  <YAxis stroke="#aaa" label={{ value: t('viking_confronto.efficiency_ratio_y_label'), angle: -90, position: 'insideLeft', fill: '#aaa' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1a1a24', border: '1px solid #555', borderRadius: '5px' }} />
                  <Legend wrapperStyle={{ paddingTop: '10px' }} />
                  {datiGlobaliOverlay.lineeProps.map((linea) => (
                    <Line 
                      key={linea.dataKey} 
                      type="monotone" 
                      dataKey={linea.dataKey} 
                      name={linea.name} 
                      stroke={linea.color} 
                      strokeWidth={2} 
                      strokeDasharray={linea.dash}
                      dot={{ r: 3 }} 
                      activeDot={{ r: 6 }} 
                      connectNulls={true}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div>
            <h3 style={{ color: '#00BCD4', borderBottom: '1px solid #555', paddingBottom: '10px' }}>
              {t('viking_confronto.section_3_title')}
            </h3>
            <p style={{ color: '#aaa', fontSize: '14px', marginBottom: '20px' }}>
              {t('viking_confronto.section_3_desc')}
            </p>

            {datiTabellaRatei.map(ev => (
              <div key={`tab-${ev.id}`} style={{ backgroundColor: '#2a2a40', padding: '15px', borderRadius: '8px', marginBottom: '30px', border: '1px solid #444', overflowX: 'auto' }}>
                <h4 style={{ color: '#fff', marginTop: 0, marginBottom: '15px' }}>📊 {ev.nome}</h4>
                <table style={{ width: '100%', borderCollapse: 'collapse', color: '#ddd', fontSize: '13px', textAlign: 'center' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#1a1a24', borderBottom: '2px solid #555' }}>
                      <th style={{ padding: '10px', textAlign: 'left', minWidth: '150px' }}>{t('viking_confronto.player')}</th>
                      <th style={{ padding: '10px' }}>{t('viking_confronto.tier')}</th>
                      <th style={{ padding: '10px' }}>{t('viking_confronto.class')}</th>
                      {ev.ondate.map(lvl => (
                        <th key={`th-${lvl}`} style={{ padding: '10px', color: '#4fc3f7' }}>Lvl {lvl}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ev.dati.map((riga, idx) => {
                      let classColor = '#fff';
                      if (riga.tipo === 'Fanteria') classColor = '#4fc3f7';
                      if (riga.tipo === 'Cavalleria') classColor = '#ba68c8';
                      if (riga.tipo === 'Arcieri') classColor = '#ffb74d';

                      return (
                        <tr key={`${riga.giocatore}-${riga.tipo}-${idx}`} style={{ borderBottom: '1px solid #333', backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.1)' }}>
                          <td style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 'bold' }}>{riga.giocatore}</td>
                          <td style={{ padding: '8px 10px', color: '#FF9800' }}>{riga.tier}</td>
                          <td style={{ padding: '8px 10px', color: classColor }}>{riga.tipo}</td>
                          {ev.ondate.map(lvl => {
                            const rateo = riga.ratei[lvl];
                            const isZero = rateo === 0;
                            return (
                              <td key={`td-${lvl}`} style={{ padding: '8px 10px', color: isZero ? '#ff5252' : '#ddd', fontWeight: isZero ? 'bold' : 'normal' }}>
                                {rateo !== undefined ? rateo : '-'}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>

          <div>
            <h3 style={{ color: '#FFD54F', borderBottom: '1px solid #555', paddingBottom: '10px' }}>
              {t('viking_confronto.section_4_title')}
            </h3>
            <p style={{ color: '#aaa', fontSize: '14px', marginBottom: '20px' }}>
              {t('viking_confronto.section_4_desc')}
            </p>

            <div style={{ backgroundColor: '#2a2a40', padding: '15px', borderRadius: '8px', marginBottom: '30px', border: '1px solid #444', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', color: '#ddd', fontSize: '13px', textAlign: 'center' }}>
                <thead>
                  <tr style={{ backgroundColor: '#1a1a24', borderBottom: '2px solid #555' }}>
                    <th style={{ padding: '10px', textAlign: 'left', minWidth: '150px' }}>{t('viking_confronto.progression')}</th>
                    {datiTabellaIncrementi.colonne.map(col => (
                      <th key={col.id} style={{ padding: '10px', color: '#FFD54F' }}>{col.nome}</th>
                    ))}
                    <th style={{ padding: '10px', color: '#fff', borderLeft: '1px dashed #555' }}>{t('viking_confronto.variance')}</th>
                  </tr>
                </thead>
                <tbody>
                  {datiTabellaIncrementi.righe.map((riga, idx) => {
                    const valori = datiTabellaIncrementi.colonne.map(c => riga[c.id]).filter(v => v !== null && v > 0);
                    let varianzaStr = "-";
                    let isCostante = false;
                    
                    if (valori.length > 1) {
                      const max = Math.max(...valori);
                      const min = Math.min(...valori);
                      const delta = max - min;
                      
                      isCostante = delta < 0.05; 
                      varianzaStr = delta === 0 ? t('viking_confronto.perfect') : delta.toFixed(4);
                    }

                    return (
                      <tr key={`inc-${riga.lvl}`} style={{ borderBottom: '1px solid #333', backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.1)' }}>
                        <td style={{ padding: '10px', textAlign: 'left', fontWeight: 'bold', color: '#fff' }}>
                          {riga.etichetta}
                        </td>
                        {datiTabellaIncrementi.colonne.map(col => {
                          const val = riga[col.id];
                          return (
                            <td key={`${riga.lvl}-${col.id}`} style={{ padding: '10px' }}>
                              {val ? `${val}x (+${((val - 1) * 100).toFixed(1)}%)` : '-'}
                            </td>
                          );
                        })}
                        <td style={{ 
                          padding: '10px', 
                          borderLeft: '1px dashed #555', 
                          color: isCostante ? '#4CAF50' : '#ff5252', 
                          fontWeight: 'bold',
                          backgroundColor: isCostante ? 'rgba(76, 175, 80, 0.05)' : 'rgba(255, 82, 82, 0.05)'
                        }}>
                          {varianzaStr}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      ) : (
        <div style={{ padding: '20px', textAlign: 'center', color: '#888', fontStyle: 'italic', backgroundColor: '#1a1a24', borderRadius: '4px' }}>
          {t('viking_confronto.select_event_hint')}
        </div>
      )}
    </div>
  );
}