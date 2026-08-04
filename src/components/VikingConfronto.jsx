import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Bar, LineChart, Line, AreaChart, Area, 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend 
} from 'recharts';
import { PESI_RELATIVI, getTierIndex } from '../utils/vikingCalculations';

// Utility per calcolare la mediana all'interno di un singolo evento/livello
const calcolaMediana = (arr) => {
  if (!arr || arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const TIER_COLORS = ['#ff5252', '#FF9800', '#4CAF50', '#2196F3', '#9C27B0', '#FFD54F', '#00BCD4'];
const DASH_ARRAYS = ["", "5 5", "3 3", "10 5"]; // Pattern per linee sovrapposte globali

export default function VikingConfronto({ eventi }) {
  const [eventiSelezionati, setEventiSelezionati] = useState([]);
  
  // Stato per l'interruttore che esclude i dati dell'Host
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

  // ==========================================
  // 1. ELABORAZIONE DATI: UN GRAFICO PER OGNI EVENTO
  // ==========================================
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
        
        // Inizializzazione espansa per includere sia Inviate (inv) che Uccise (ucc)
        if (!rawIngaggio[lvl]) {
          rawIngaggio[lvl] = { 
            uccF: 0, uccC: 0, uccA: 0, 
            invF: 0, invC: 0, invA: 0 
          };
        }
        
        ondata.giocatori.forEach((g, idx) => {
          const isHost = (idx === 0);

          // Se l'interruttore è attivo, saltiamo il calcolo per l'Host (indice 0)
          if (escludiHost && isHost) return;

          // Dati Ingaggio (Overflow) - Raccolta dati grezzi assoluti
          rawIngaggio[lvl].uccF += (g.truppeUccise?.fant || 0);
          rawIngaggio[lvl].uccC += (g.truppeUccise?.cav || 0);
          rawIngaggio[lvl].uccA += (g.truppeUccise?.arc || 0);

          rawIngaggio[lvl].invF += (g.truppeInviate?.fant || 0);
          rawIngaggio[lvl].invC += (g.truppeInviate?.cav || 0);
          rawIngaggio[lvl].invA += (g.truppeInviate?.arc || 0);

          // Dati Scaling (Ratei Tier Fanteria)
         // Dati Scaling (Ratei Tier Fanteria)
if (!isHost) {
  // Sostituisci 'tierFant' con il nome reale della chiave nel tuo JSON che identifica il tier della fanteria
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

      // Formattazione per i grafici di Scaling
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

      // Formattazione per i grafici di Ingaggio con payload grezzo per il tooltip avanzato
      const ingaggioChartData = Object.keys(rawIngaggio).sort((a,b) => Number(a) - Number(b)).map(lvl => {
        const d = rawIngaggio[lvl];
        const totUccise = d.uccF + d.uccC + d.uccA;
        return {
          wave: `Lvl ${lvl}`,
          Fanteria: totUccise === 0 ? 0 : Number(((d.uccF / totUccise) * 100).toFixed(1)),
          Cavalleria: totUccise === 0 ? 0 : Number(((d.uccC / totUccise) * 100).toFixed(1)),
          Arcieri: totUccise === 0 ? 0 : Number(((d.uccA / totUccise) * 100).toFixed(1)),
          raw: d // Payload con i volumi assoluti
        };
      });

      return { id: evento.id, nome: nomeEv, scalingChartData, lineeProps, ingaggioChartData };
    });
  }, [eventi, eventiSelezionati, escludiHost]);

  // ==========================================
  // 2. ELABORAZIONE DATI: TREND GLOBALE (NO MEDIA)
  // ==========================================
  const datiGlobaliOverlay = useMemo(() => {
    if (eventiProcessati.length === 0) return { chartData: [], lineeProps: [] };
    
    const mergedData = {};
    const lineeProps = [];

    // Troviamo il livello massimo raggiunto per costruire un asse X continuo
    let maxLvl = 1; 
    eventiProcessati.forEach(ev => {
       ev.scalingChartData.forEach(row => {
          const l = parseInt(row.wave.replace('Lvl ', ''));
          if (l > maxLvl) maxLvl = l;
       });
    });

    // Pre-popoliamo l'asse X per evitare buchi visivi
    for (let i = 1; i <= maxLvl; i++) {
       mergedData[`Lvl ${i}`] = { wave: `Lvl ${i}` };
    }
    
    // Popoliamo con i dati reali
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

  // ==========================================
  // 3. ELABORAZIONE DATI: TABELLA RATEI DETTAGLIATA
  // ==========================================
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
          // Rispettiamo l'interruttore per escludere l'Host se richiesto
          if (escludiHost && idx === 0) return;

          const nome = g.nome || `Giocatore ${idx}`;
          const tier = String(g.livelloTier || g.truppeInviate?.tierFant || '').replace(/^Liv\s+/i, '').trim() || 'N/A';
          const baseKey = `${nome}_${tier}`;

          // Helper per registrare i ratei individuali
          const registraRateo = (tipo, inviate, uccise) => {
            if (inviate > 0) {
              const key = `${baseKey}_${tipo}`;
              if (!righe[key]) {
                righe[key] = { giocatore: nome, tier, tipo, ratei: {} };
              }
              // Calcolo: Uccise / Inviate
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
        // Ordiniamo le ondate numericamente per l'intestazione della tabella
        ondate: Array.from(ondateDisponibili).sort((a, b) => Number(a) - Number(b)),
        // Convertiamo l'oggetto in array e ordiniamo per Giocatore -> Tier -> Tipo
        dati: Object.values(righe).sort((a, b) => 
          a.giocatore.localeCompare(b.giocatore) || 
          b.tier.localeCompare(a.tier) ||
          a.tipo.localeCompare(b.tipo)
        )
      };
    });
  }, [eventi, eventiSelezionati, escludiHost]);
  
// ==========================================
  // 4. ELABORAZIONE DATI: TABELLA INCREMENTI (MOLTIPLICATORI)
  // ==========================================
  const datiTabellaIncrementi = useMemo(() => {
    if (!eventiProcessati || eventiProcessati.length === 0) return { righe: [], colonne: [] };

    // Prepariamo le colonne dinamiche in base agli eventi selezionati
    const colonne = eventiProcessati.map(ev => ({ id: ev.id, nome: ev.nome }));
    
    // Troviamo il livello massimo per iterare le ondate
    let maxLvl = 1;
    eventiProcessati.forEach(ev => {
       ev.ingaggioChartData.forEach(row => {
          const l = parseInt(row.wave.replace('Lvl ', ''));
          if (l > maxLvl) maxLvl = l;
       });
    });

    // Estraiamo il rateo "Puro" della Fanteria dell'intero gruppo per ogni ondata.
    // Usiamo il totale Uccise/Inviate della Fanteria perché, attaccando per prima, 
    // è la statistica più stabile per estrarre la costante di gioco.
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

    // Costruiamo le righe di comparazione salto per salto
    const righe = [];
    for (let i = 1; i < maxLvl; i++) {
      const lvlAttuale = i;
      const lvlSuccessivo = i + 1;
      const riga = { 
        etichetta: `Lvl ${lvlAttuale} ➡️ Lvl ${lvlSuccessivo}`,
        lvl: lvlSuccessivo // Indice univoco
      };
      
      eventiProcessati.forEach(ev => {
        const r1 = rateiEventi[ev.id][lvlAttuale];
        const r2 = rateiEventi[ev.id][lvlSuccessivo];
        
        // Calcoliamo il moltiplicatore solo se abbiamo dati per entrambe le ondate
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

  // ==========================================
  // ESPORTAZIONE DATI PER ANALISI IA
  // ==========================================
  const esportaDatiJSON = () => {
    if (!eventiProcessati || eventiProcessati.length === 0) {
      alert("Seleziona almeno un evento per esportare i dati.");
      return;
    }

    // Creiamo un payload strutturato per l'IA
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
    
    // Pulizia
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ==========================================
  // CUSTOM TOOLTIPS
  // ==========================================
  const CustomTooltipIngaggio = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const rawData = payload[0].payload.raw;
      
      return (
        <div style={{ backgroundColor: '#1e1e2f', padding: '12px', border: '1px solid #444', borderRadius: '6px', color: '#fff', fontSize: '13px' }}>
          <p style={{ margin: '0 0 10px 0', fontWeight: 'bold', borderBottom: '1px solid #444', paddingBottom: '6px', color: '#4fc3f7' }}>
            {label}
          </p>
          
          <div style={{ marginBottom: '10px' }}>
            <strong style={{ color: '#aaa' }}>Volume in Difesa (Truppe Inviate):</strong>
            <div style={{ marginTop: '3px' }}>🛡️ Fanteria: {rawData.invF.toLocaleString()}</div>
            <div>🐎 Cavalleria: {rawData.invC.toLocaleString()}</div>
            <div>🏹 Arcieri: {rawData.invA.toLocaleString()}</div>
            <div style={{ marginTop: '3px', fontWeight: 'bold', color: '#ddd' }}>
              Totale in Base: {(rawData.invF + rawData.invC + rawData.invA).toLocaleString()}
            </div>
          </div>

          <div>
            <strong style={{ color: '#aaa' }}>Ripartizione Danni (Truppe Uccise):</strong>
            <div style={{ marginTop: '3px', color: '#4fc3f7' }}>
              Fanteria: {payload.find(p => p.dataKey === 'Fanteria')?.value}% ({rawData.uccF.toLocaleString()})
            </div>
            <div style={{ color: '#ba68c8' }}>
              Cavalleria: {payload.find(p => p.dataKey === 'Cavalleria')?.value}% ({rawData.uccC.toLocaleString()})
            </div>
            <div style={{ color: '#ffb74d' }}>
              Arcieri: {payload.find(p => p.dataKey === 'Arcieri')?.value}% ({rawData.uccA.toLocaleString()})
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
        🔬 Dashboard Storica: Analisi Ondate
      </h2>
      
      {/* PANNELLO DI SELEZIONE EVENTI */}
      <div style={{ backgroundColor: '#2a2a40', padding: '20px', borderRadius: '6px', marginBottom: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
          <h4 style={{ margin: 0, color: '#fff' }}>Eventi da Analizzare</h4>
          <div>
           <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
  <button onClick={selezionaTutti} style={{ padding: '5px 10px', backgroundColor: '#333', color: '#4CAF50', border: '1px solid #4CAF50', borderRadius: '4px', cursor: 'pointer' }}>Tutti</button>
  <button onClick={deselezionaTutti} style={{ padding: '5px 10px', backgroundColor: '#333', color: '#ff5252', border: '1px solid #ff5252', borderRadius: '4px', cursor: 'pointer' }}>Nessuno</button>
  <div style={{ width: '1px', height: '24px', backgroundColor: '#555', margin: '0 5px' }}></div> {/* Divisore visivo */}
  <button onClick={esportaDatiJSON} style={{ padding: '5px 15px', backgroundColor: '#4fc3f7', color: '#1a1a24', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
    ⬇️ Esporta Dati per IA
  </button>
</div>
</div>
        </div>

        {/* TOGGLE HOST */}
        <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#1a1a24', padding: '12px 15px', borderRadius: '6px', border: '1px solid #444' }}>
          <input
            type="checkbox"
            id="toggleHost"
            checked={escludiHost}
            onChange={(e) => setEscludiHost(e.target.checked)}
            style={{ cursor: 'pointer', width: '18px', height: '18px', accentColor: '#4fc3f7' }}
          />
          <label htmlFor="toggleHost" style={{ cursor: 'pointer', fontWeight: 'bold', color: '#e0e0e0', fontSize: '14px' }}>
            Isola Rinforzi Puri (Escludi i dati del giocatore Host all'indice 0 per pulire i ratei dalle statistiche della base)
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

          {/* SEZIONE 1: GRAFICI INDIVIDUALI PER OGNI EVENTO */}
          <div>
            <h3 style={{ color: '#FF9800', borderBottom: '1px solid #555', paddingBottom: '10px', marginBottom: '30px' }}>
              1. Analisi Dettagliata per Singolo Evento
            </h3>
            <p style={{ color: '#aaa', fontSize: '14px', marginBottom: '20px' }}>
              Grafici isolati. Mostrano il comportamento specifico del motore di gioco per ciascun salvataggio selezionato.
            </p>
            
            {eventiProcessati.map((ev) => (
              <div key={ev.id} style={{ backgroundColor: '#2a2a40', padding: '20px', borderRadius: '8px', marginBottom: '40px', border: '1px solid #444' }}>
                <h4 style={{ color: '#fff', fontSize: '18px', marginTop: 0, marginBottom: '20px', borderBottom: '1px dashed #555', paddingBottom: '10px' }}>
                  📅 Evento: {ev.nome}
                </h4>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                  {/* Sinistra: Scaling dell'evento */}
                  <div>
                    <h5 style={{ color: '#4fc3f7', marginTop: 0, textAlign: 'center' }}>Motore di Scaling (Ratei Fanteria)</h5>
                    <div style={{ height: '300px' }}>
                      <ResponsiveContainer>
                        <LineChart data={ev.scalingChartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                          <XAxis dataKey="wave" stroke="#aaa" fontSize={12} />
                          <YAxis stroke="#aaa" fontSize={12} label={{ value: 'Rateo (Uccise/Inviate)', angle: -90, position: 'insideLeft', fill: '#aaa', fontSize: 10 }} />
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

                  {/* Destra: Regole di ingaggio dell'evento con tooltip avanzato */}
                  <div>
                    <h5 style={{ color: '#ba68c8', marginTop: 0, textAlign: 'center' }}>Regole di Ingaggio & Volumi</h5>
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

         {/* SEZIONE 2: TREND GLOBALE SOVRAPPOSTO (TUTTI INSIEME, NO MEDIA) */}
          <div>
            <h3 style={{ color: '#4CAF50', borderBottom: '1px solid #555', paddingBottom: '10px' }}>
              2. Trend Globale (Confronto Diretto, Nessuna Media)
            </h3>
            <p style={{ color: '#aaa', fontSize: '14px', marginBottom: '20px' }}>
              Questo grafico plotta le curve di Scaling di <strong>tutti</strong> gli eventi selezionati nello stesso spazio visivo. Linee continue e asse X completo senza buchi.
            </p>
            
            <div style={{ width: '100%', height: '500px', backgroundColor: '#2a2a40', padding: '20px', borderRadius: '8px', border: '1px solid #444' }}>
              <ResponsiveContainer>
                <LineChart data={datiGlobaliOverlay.chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="wave" stroke="#aaa" />
                  <YAxis stroke="#aaa" label={{ value: 'Rateo di Efficienza (Fanteria)', angle: -90, position: 'insideLeft', fill: '#aaa' }} />
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

          {/* SEZIONE 3: TABELLA RATEI MULTICOLONNA */}
          <div>
            <h3 style={{ color: '#00BCD4', borderBottom: '1px solid #555', paddingBottom: '10px' }}>
              3. Tabella Ratei di Uccisione (Analisi Fina)
            </h3>
            <p style={{ color: '#aaa', fontSize: '14px', marginBottom: '20px' }}>
              Mostra il rateo di uccisione puro (Uccise / Inviate) per ogni giocatore, separato per classe. 
              Ideale per studiare come la resistenza nemica abbatte l'efficienza ad ogni livello.
            </p>

            {datiTabellaRatei.map(ev => (
              <div key={`tab-${ev.id}`} style={{ backgroundColor: '#2a2a40', padding: '15px', borderRadius: '8px', marginBottom: '30px', border: '1px solid #444', overflowX: 'auto' }}>
                <h4 style={{ color: '#fff', marginTop: 0, marginBottom: '15px' }}>📊 {ev.nome}</h4>
                <table style={{ width: '100%', borderCollapse: 'collapse', color: '#ddd', fontSize: '13px', textAlign: 'center' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#1a1a24', borderBottom: '2px solid #555' }}>
                      <th style={{ padding: '10px', textAlign: 'left', minWidth: '150px' }}>Giocatore</th>
                      <th style={{ padding: '10px' }}>Tier</th>
                      <th style={{ padding: '10px' }}>Classe</th>
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
              {/* ... [Qui finisce la SEZIONE 3] ... */}
              </div>
            ))}
          </div>

          {/* SEZIONE 4: TABELLA INCREMENTI (MOLTIPLICATORI) */}
          <div>
            <h3 style={{ color: '#FFD54F', borderBottom: '1px solid #555', paddingBottom: '10px' }}>
              4. Verifica Costanti di Scaling (Moltiplicatore Ondate)
            </h3>
            <p style={{ color: '#aaa', fontSize: '14px', marginBottom: '20px' }}>
              Confronta il salto percentuale del rateo di uccisione da un'ondata all'altra tra eventi diversi. 
              Se la "Varianza" è prossima allo 0, il motore di gioco utilizza una progressione matematica universale.
            </p>

            <div style={{ backgroundColor: '#2a2a40', padding: '15px', borderRadius: '8px', marginBottom: '30px', border: '1px solid #444', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', color: '#ddd', fontSize: '13px', textAlign: 'center' }}>
                <thead>
                  <tr style={{ backgroundColor: '#1a1a24', borderBottom: '2px solid #555' }}>
                    <th style={{ padding: '10px', textAlign: 'left', minWidth: '150px' }}>Progressione</th>
                    {datiTabellaIncrementi.colonne.map(col => (
                      <th key={col.id} style={{ padding: '10px', color: '#FFD54F' }}>{col.nome}</th>
                    ))}
                    <th style={{ padding: '10px', color: '#fff', borderLeft: '1px dashed #555' }}>Varianza (Δ)</th>
                  </tr>
                </thead>
                <tbody>
                  {datiTabellaIncrementi.righe.map((riga, idx) => {
                    // Raccogliamo i valori della riga per calcolare la varianza (scarto tra max e min)
                    const valori = datiTabellaIncrementi.colonne.map(c => riga[c.id]).filter(v => v !== null && v > 0);
                    let varianzaStr = "-";
                    let isCostante = false;
                    
                    if (valori.length > 1) {
                      const max = Math.max(...valori);
                      const min = Math.min(...valori);
                      const delta = max - min;
                      
                      // Consideriamo "Costante" una varianza inferiore a 0.05 (tolleranza rounding del gioco)
                      isCostante = delta < 0.05; 
                      varianzaStr = delta === 0 ? 'Perfetta (0.000)' : delta.toFixed(4);
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
          Seleziona almeno un evento per avviare la visualizzazione dei grafici.
        </div>
      )}
    </div>
  );
}