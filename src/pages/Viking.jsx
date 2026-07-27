import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import VikingImporter from '../components/VikingImporter'; 
import VikingWizard from '../components/VikingWizard'; 
import VikingConfronto from '../components/VikingConfronto';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

// Gerarchia aggiornata per gestire sia i TG che i livelli numerici puri
const TIER_HIERARCHY = [
  'TG5', 'TG4', 'TG3', 'TG2', 'TG1', 
  '30', '29', '28', '27', '26', '25', '24', '23', '22', '21', '20'
];

// NUOVO ALGORITMO: Pesi Relativi Dedotti dall'analisi empirica (Base TG3 = 1.000)
const PESI_RELATIVI = {
  'TG5': 1.150,  // Stimato
  'TG4': 1.075,  // Stimato
  'TG3': 1.000,  // COSTANTE RILEVATA
  'TG2': 0.967,  // Stimato
  'TG1': 0.934,  // COSTANTE RILEVATA
  '30': 0.717,   // Stimato
  '29': 0.500,   // COSTANTE RILEVATA
  '28': 0.474,   // COSTANTE RILEVATA
  '27': 0.378,   // COSTANTE RILEVATA
};

// Helper per trovare l'indice esatto ignorando "Liv " se presente
const getTierIndex = (tier) => {
  if (!tier) return -1;
  const cleanTier = String(tier).replace(/^Liv\s+/i, '').trim();
  return TIER_HIERARCHY.indexOf(cleanTier);
};

export default function Viking() {
  const [eventi, setEventi] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [datiEvento, setDatiEvento] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [activeView, setActiveView] = useState('analisi');
  const [analisiTab, setAnalisiTab] = useState('singolo');
  
  const [showImporter, setShowImporter] = useState(false); 
  const [showWizard, setShowWizard] = useState(false); 
  
  const navigate = useNavigate();

  const fetchEventi = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "eventi_vichinghi"));
      const listaEventi = [];
      querySnapshot.forEach((doc) => {
        listaEventi.push({ id: doc.id, ...doc.data() });
      });
      
      listaEventi.sort((a, b) => new Date(b.dataEvento) - new Date(a.dataEvento));
      setEventi(listaEventi);
      
      if (listaEventi.length > 0) {
        const currentSelected = selectedEventId ? listaEventi.find(e => e.id === selectedEventId) : null;
        if (currentSelected) {
          setDatiEvento(currentSelected);
        } else {
          setSelectedEventId(listaEventi[0].id);
          setDatiEvento(listaEventi[0]);
        }
      }
    } catch (error) {
      console.error("Errore nel caricamento eventi:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEventi();
  }, []);

  const handleSelectChange = (e) => {
    const eventId = e.target.value;
    setSelectedEventId(eventId);
    const eventoTrovato = eventi.find(ev => ev.id === eventId);
    setDatiEvento(eventoTrovato || null);
  };

  // Funzione: Calcola i pesi limitatamente a una SINGOLA ondata
  const calcolaPesiTierOndata = (ondata) => {
    if (!ondata || !ondata.giocatori || ondata.giocatori.length === 0) return [];

    const rateiPerTier = {};

    const giocatoriValidi = ondata.giocatori.filter((g, index) => index !== 0 && g.truppeInviate?.fant > 0);
    
    giocatoriValidi.forEach(g => {
      const tier = g.livelloTier;
      if (!tier) return;
      
      const rateo = g.truppeUccise.fant / g.truppeInviate.fant;
      if (rateo > 0) {
        if (!rateiPerTier[tier]) rateiPerTier[tier] = [];
        rateiPerTier[tier].push(rateo);
      }
    });

    const tierPresenti = [];
    Object.keys(rateiPerTier).forEach(tier => {
      const medie = rateiPerTier[tier];
      const mediaRateo = medie.reduce((a, b) => a + b, 0) / medie.length;
      tierPresenti.push({ tier, rateo: mediaRateo, isStimato: false });
    });

    tierPresenti.sort((a, b) => {
      const idxA = getTierIndex(a.tier);
      const idxB = getTierIndex(b.tier);
      if (idxA === -1 && idxB === -1) return 0;
      if (idxA === -1) return 1; 
      if (idxB === -1) return -1;
      return idxA - idxB;
    });

    const risultatiFinali = [];
    for (let i = 0; i < tierPresenti.length - 1; i++) {
      const tierAlto = tierPresenti[i];
      const tierBasso = tierPresenti[i + 1];
      
      risultatiFinali.push(tierAlto);

      const idxAlto = getTierIndex(tierAlto.tier);
      const idxBasso = getTierIndex(tierBasso.tier);
      
      if (idxAlto !== -1 && idxBasso !== -1) {
        const distanza = idxBasso - idxAlto;

        if (distanza > 1) {
          const moltiplicatoreTotale = tierAlto.rateo / tierBasso.rateo;
          const saltoPerStep = Math.pow(moltiplicatoreTotale, 1 / distanza);

          for (let j = 1; j < distanza; j++) {
            const tierMancante = TIER_HIERARCHY[idxAlto + j];
            const rateoStimato = tierBasso.rateo * Math.pow(saltoPerStep, distanza - j);
            risultatiFinali.push({
              tier: tierMancante,
              rateo: rateoStimato,
              isStimato: true,
              nota: `Stimato tra ${tierAlto.tier} e ${tierBasso.tier}`
            });
          }
        }
      }
    }
    
    if (tierPresenti.length > 0) {
      risultatiFinali.push(tierPresenti[tierPresenti.length - 1]);
    }

    return risultatiFinali.map((item, index) => {
      if (index === risultatiFinali.length - 1) return { ...item, delta: null };
      const nextItem = risultatiFinali[index + 1];
      const delta = (item.rateo / nextItem.rateo) - 1;
      return { ...item, delta: delta * 100 };
    });
  };

  const preparaDatiGrafico = () => {
    if (!datiEvento || !datiEvento.ondate) return [];
    
    const ondateOrdinate = [...datiEvento.ondate].sort((a, b) => a.livello - b.livello);

    return ondateOrdinate.map(ondata => {
      let sumFant = 0, sumCav = 0, sumArc = 0;
      
      ondata.giocatori.forEach(g => {
        sumFant += g.truppeUccise?.fant || 0;
        sumCav += g.truppeUccise?.cav || 0;
        sumArc += g.truppeUccise?.arc || 0;
      });

      const vTotali = (ondata.datiNemico?.vFant || 0) + (ondata.datiNemico?.vCav || 0) + (ondata.datiNemico?.vArc || 0);
      const totUccise = sumFant + sumCav + sumArc;
      const vSopravvissuti = vTotali > totUccise ? vTotali - totUccise : 0;

      return {
        nome: `Lvl ${ondata.livello}`,
        'Uccisioni Fanteria': sumFant,
        'Uccisioni Cavalleria': sumCav,
        'Uccisioni Arcieri': sumArc,
        'Nemici Sopravvissuti': vSopravvissuti,
        'Andamento Reale': totUccise,        
        'Andamento Teorico': vTotali,        
        vTotali: vTotali,
        totUccise: totUccise
      };
    });
  };

  const chartData = preparaDatiGrafico();

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={{ backgroundColor: '#2a2a40', padding: '15px', border: '1px solid #555', borderRadius: '5px', color: '#fff', minWidth: '220px' }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#FFB300' }}>{label}</h4>
          <p style={{ margin: '5px 0', fontSize: '14px' }}>Bersagli Totali: <strong>{data.vTotali.toLocaleString()}</strong></p>
          <hr style={{ borderColor: '#444' }} />
          <p style={{ margin: '5px 0', color: '#fff', fontWeight: 'bold' }}>Andamento Reale: {data['Andamento Reale'].toLocaleString()}</p>
          <p style={{ margin: '5px 0', color: '#FFEB3B', fontStyle: 'italic' }}>Andamento Teorico: {data['Andamento Teorico'].toLocaleString()}</p>
          <hr style={{ borderColor: '#444' }} />
          <p style={{ margin: '5px 0', color: '#4CAF50' }}>Fanteria: {data['Uccisioni Fanteria'].toLocaleString()}</p>
          <p style={{ margin: '5px 0', color: '#2196F3' }}>Cavalleria: {data['Uccisioni Cavalleria'].toLocaleString()}</p>
          <p style={{ margin: '5px 0', color: '#F44336' }}>Arcieri: {data['Uccisioni Arcieri'].toLocaleString()}</p>
          {data['Nemici Sopravvissuti'] > 0 && (
            <p style={{ margin: '5px 0', color: '#9e9e9e', fontWeight: 'bold' }}>
              Sopravvissuti: {data['Nemici Sopravvissuti'].toLocaleString()}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  if (loading) return <div style={{ color: 'white', padding: '20px' }}>Caricamento storico in corso...</div>;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#121212', color: '#fff' }}>
      
      {/* SIDEBAR LATERALE */}
      <div style={{ width: '260px', backgroundColor: '#1e1e2f', borderRight: '1px solid #333', display: 'flex', flexDirection: 'column', padding: '20px', boxShadow: '2px 0 5px rgba(0,0,0,0.5)' }}>
        <button onClick={() => navigate('/')} style={{ padding: '8px 15px', backgroundColor: '#333', color: '#fff', border: '1px solid #555', cursor: 'pointer', fontWeight: 'bold', borderRadius: '4px', marginBottom: '20px' }}>⬅ Torna alla Home</button>
        <h2 style={{ margin: '0 0 30px 0', color: '#4CAF50', textAlign: 'center' }}>Dashboard<br/>Vichinghi</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <button onClick={() => setActiveView('analisi')} style={{ padding: '12px 20px', borderRadius: '6px', backgroundColor: activeView === 'analisi' ? '#4CAF50' : 'transparent', color: '#fff', border: activeView === 'analisi' ? 'none' : '1px solid #4CAF50', cursor: 'pointer', fontWeight: 'bold', textAlign: 'left' }}>📊 Analisi Eventi</button>
          <button onClick={() => { setActiveView('inserimento'); setShowWizard(false); setShowImporter(false); }} style={{ padding: '12px 20px', borderRadius: '6px', backgroundColor: activeView === 'inserimento' ? '#2196F3' : 'transparent', color: '#fff', border: activeView === 'inserimento' ? 'none' : '1px solid #2196F3', cursor: 'pointer', fontWeight: 'bold', textAlign: 'left' }}>⚙️ Inserimento Dati</button>
        </div>
      </div>

      {/* AREA CONTENUTO PRINCIPALE */}
      <div style={{ flex: 1, padding: '30px', overflowY: 'auto' }}>
        
        {/* VISTA 1: ANALISI */}
        {activeView === 'analisi' && (
          <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
            <h1 style={{ marginTop: 0, marginBottom: '20px' }}>Analisi Dati Vichinghi</h1>
            
            <div style={{ display: 'flex', gap: '15px', marginBottom: '30px', borderBottom: '2px solid #333', paddingBottom: '15px' }}>
              <button onClick={() => setAnalisiTab('singolo')} style={{ padding: '10px 20px', borderRadius: '4px', backgroundColor: analisiTab === 'singolo' ? '#4CAF50' : '#2a2a40', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>Analisi Singolo Evento</button>
              <button onClick={() => setAnalisiTab('confronto')} style={{ padding: '10px 20px', borderRadius: '4px', backgroundColor: analisiTab === 'confronto' ? '#FF9800' : '#2a2a40', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>Confronto Eventi Analizzati</button>
            </div>

            {analisiTab === 'singolo' && (
              <div>
                <div style={{ marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1e1e2f', padding: '20px', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <label style={{ fontWeight: 'bold' }}>Seleziona Evento:</label>
                    {eventi.length > 0 ? (
                      <select value={selectedEventId} onChange={handleSelectChange} style={{ padding: '10px 15px', borderRadius: '4px', backgroundColor: '#2a2a40', color: '#fff', border: '1px solid #555' }}>
                        {eventi.map(ev => <option key={ev.id} value={ev.id}>{ev.dataEvento}</option>)}
                      </select>
                    ) : <span style={{ color: '#ff5252' }}>Nessun evento disponibile.</span>}
                  </div>
                  <button style={{ padding: '10px 20px', borderRadius: '4px', backgroundColor: '#333', color: '#4CAF50', border: '1px solid #4CAF50', cursor: 'pointer', fontWeight: 'bold' }} disabled={!datiEvento}>💾 Salva Risultati</button>
                </div>

                {/* GRAFICO A BARRE IMPILATE */}
                {chartData.length > 0 && (
                  <div style={{ backgroundColor: '#1e1e2f', padding: '20px', borderRadius: '8px', marginBottom: '40px', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>
                    <h3 style={{ marginTop: 0, color: '#FFB300' }}>Capacità di Uccisione vs Volume Orda</h3>
                    <p style={{ fontSize: '14px', color: '#aaa', marginBottom: '20px' }}>
                      L'altezza della barra rappresenta l'intera orda nemica. Le sezioni colorate mostrano quante uccisioni ha assorbito ogni tipologia di truppa. 
                      Quando compare la sezione <strong style={{color: '#9e9e9e'}}>grigia</strong>, significa che la vostra capacità di danno si è esaurita (Kill Cap) e i nemici sono sopravvissuti.
                    </p>
                    <div style={{ width: '100%', height: '450px' }}>
                      <ResponsiveContainer>
                        <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                          <XAxis dataKey="nome" stroke="#888" />
                          <YAxis stroke="#888" />
                          <Tooltip content={<CustomTooltip />} />
                          <Legend wrapperStyle={{ paddingTop: '10px' }} />
                          
                          {/* Barre Impilate */}
                          <Bar dataKey="Uccisioni Fanteria" stackId="a" fill="#4CAF50" />
                          <Bar dataKey="Uccisioni Cavalleria" stackId="a" fill="#2196F3" />
                          <Bar dataKey="Uccisioni Arcieri" stackId="a" fill="#F44336" />
                          <Bar dataKey="Nemici Sopravvissuti" stackId="a" fill="#424242" />
                          
                          {/* Curve di Andamento */}
                          <Line type="monotone" dataKey="Andamento Reale" stroke="#ffffff" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                          <Line type="monotone" dataKey="Andamento Teorico" stroke="#FFEB3B" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* LISTA TABELLE ONDATE */}
                {datiEvento && datiEvento.ondate && datiEvento.ondate.map((ondata, index) => {
                  
                  const pesiTierData = calcolaPesiTierOndata(ondata);

                  let sumFantInviate = 0, sumCavInviate = 0, sumArcInviate = 0;
                  let sumFantUccise = 0, sumCavUccise = 0, sumArcUccise = 0;
                  let sumTotInviate = 0, sumTotUccise = 0;

                  ondata.giocatori.forEach(g => {
                    sumFantInviate += g.truppeInviate?.fant || 0;
                    sumCavInviate += g.truppeInviate?.cav || 0;
                    sumArcInviate += g.truppeInviate?.arc || 0;
                    sumFantUccise += g.truppeUccise?.fant || 0;
                    sumCavUccise += g.truppeUccise?.cav || 0;
                    sumArcUccise += g.truppeUccise?.arc || 0;
                    sumTotInviate += (g.truppeInviate?.fant || 0) + (g.truppeInviate?.cav || 0) + (g.truppeInviate?.arc || 0);
                    sumTotUccise += (g.truppeUccise?.fant || 0) + (g.truppeUccise?.cav || 0) + (g.truppeUccise?.arc || 0);
                  });
                  
                  const avgRatTotale = sumTotInviate > 0 ? (sumTotUccise / sumTotInviate) : 0;

                  const vFant = ondata.datiNemico?.vFant || 0;
                  const vCav = ondata.datiNemico?.vCav || 0;
                  const vArc = ondata.datiNemico?.vArc || 0;
                  const vTotali = vFant + vCav + vArc;

                  const percVFant = vTotali > 0 ? ((vFant / vTotali) * 100).toFixed(1) : 0;
                  const percVCav = vTotali > 0 ? ((vCav / vTotali) * 100).toFixed(1) : 0;
                  const percVArc = vTotali > 0 ? ((vArc / vTotali) * 100).toFixed(1) : 0;
                  
                  const wipeoutPerc = vTotali > 0 ? ((sumTotUccise / vTotali) * 100).toFixed(1) : 0;
                  const isWipeoutIncompleto = wipeoutPerc < 99.9 && vTotali > 0;

                  // ====================================================================
                  // Cerca il giocatore col Tier più alto per normalizzare
                  // ====================================================================
                  let highestTierPlayer = null;
                  let highestTierIndex = 999; 
                  
                  ondata.giocatori.forEach((g, idx) => {
                    if (idx !== 0 && g.truppeInviate?.fant > 0) {
                      const tIndex = getTierIndex(g.livelloTier);
                      if (tIndex !== -1 && tIndex < highestTierIndex) {
                        highestTierIndex = tIndex;
                        highestTierPlayer = g;
                      }
                    }
                  });

                  let maxRateoReale = 0;
                  let maxTierWeight = 0;
                  
                  if (highestTierPlayer && PESI_RELATIVI[highestTierPlayer.livelloTier]) {
                    maxRateoReale = highestTierPlayer.truppeUccise.fant / highestTierPlayer.truppeInviate.fant;
                    maxTierWeight = PESI_RELATIVI[highestTierPlayer.livelloTier];
                  }
                  
                  // ====================================================================
                  // TROVA IL RATEO MINIMO (Per la nuova logica "Base = 1")
                  // ====================================================================
                  let minRateoReale = Infinity;
                  ondata.giocatori.forEach((g, idx) => {
                    if (idx !== 0 && g.truppeInviate?.fant > 0) {
                      const rateo = (g.truppeUccise?.fant || 0) / g.truppeInviate.fant;
                      // Filtriamo i ratei a 0 causati da mancata partecipazione
                      if (rateo > 0 && rateo < minRateoReale) {
                        minRateoReale = rateo;
                      }
                    }
                  });
                  if (minRateoReale === Infinity) minRateoReale = 0;

                  const impattoFant = vTotali > 0 ? ((sumFantUccise / vTotali) * 100).toFixed(1) : 0;
                  const impattoCav = vTotali > 0 ? ((sumCavUccise / vTotali) * 100).toFixed(1) : 0;
                  const impattoArc = vTotali > 0 ? ((sumArcUccise / vTotali) * 100).toFixed(1) : 0;
                  
                  let truppeMancanti = 0;
                  if (isWipeoutIncompleto && avgRatTotale > 0) {
                    const vSopravvissuti = vTotali - sumTotUccise;
                    truppeMancanti = Math.ceil(vSopravvissuti / avgRatTotale);
                  }

                  const getCascadeStatus = () => {
                    if (vTotali === 0 || sumFantUccise >= vTotali) return "NEUTRAL";
                    const rimanentiDopoFant = vTotali - sumFantUccise;
                    if (sumArcUccise === 0) {
                      const deltaCav = Math.abs(sumCavUccise - rimanentiDopoFant);
                      return deltaCav <= 5 ? "VALIDATED" : "FAILED";
                    } else {
                      if (!isWipeoutIncompleto) {
                        const uccisioniRestanti = sumCavUccise + sumArcUccise;
                        const deltaTotale = Math.abs(uccisioniRestanti - rimanentiDopoFant);
                        return deltaTotale <= 5 ? "VALIDATED" : "FAILED";
                      }
                      return "NEUTRAL";
                    }
                  };
                  const validationStatus = getCascadeStatus();

                  return (
                    <div key={index} style={{ marginBottom: '40px', backgroundColor: '#1e1e2f', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>
                      
                      {/* HEADER ONDATA */}
                      <div style={{ backgroundColor: '#2a2a40', padding: '15px 20px', borderBottom: isWipeoutIncompleto ? '2px solid #ff5252' : '2px solid #4CAF50', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <h2 style={{ margin: 0, minWidth: '180px' }}>Livello Ondata: {ondata.livello}</h2>
                            {validationStatus === "VALIDATED" && <span style={{ padding: '3px 8px', fontSize: '11px', fontFamily: 'monospace', fontWeight: 'bold', textTransform: 'uppercase', color: '#4CAF50', backgroundColor: 'rgba(76, 175, 80, 0.1)', border: '1px solid rgba(76, 175, 80, 0.3)', borderRadius: '4px' }}>✓ Cascata Verificata</span>}
                            {validationStatus === "FAILED" && <span style={{ padding: '3px 8px', fontSize: '11px', fontFamily: 'monospace', fontWeight: 'bold', textTransform: 'uppercase', color: '#ff5252', backgroundColor: 'rgba(255, 82, 82, 0.1)', border: '1px solid rgba(255, 82, 82, 0.3)', borderRadius: '4px' }}>❌ Cascata Anomala</span>}
                          </div>
                          <div style={{ display: 'flex', gap: '15px', color: '#aaa', alignItems: 'center', fontSize: '14px', flexWrap: 'wrap', backgroundColor: '#1e1e2f', padding: '8px 15px', borderRadius: '6px', border: '1px solid #444' }}>
                            <span>V-Totali: <strong style={{color:'#FF9800', fontSize:'15px'}}>{vTotali.toLocaleString()}</strong></span>
                            <span>Wipeout: <strong style={{color: isWipeoutIncompleto ? '#ff5252' : '#4CAF50', fontSize:'15px'}}>{wipeoutPerc}%</strong></span>
                            <span style={{color: '#555'}}>|</span>
                            <span>Nemici: </span>
                            <span>Fant <strong style={{color:'#fff'}}>{vFant.toLocaleString()}</strong> <small style={{color:'#FFD54F'}}>({percVFant}%)</small></span>
                            <span>Cav <strong style={{color:'#fff'}}>{vCav.toLocaleString()}</strong> <small style={{color:'#FFD54F'}}>({percVCav}%)</small></span>
                            <span>Arc <strong style={{color:'#fff'}}>{vArc.toLocaleString()}</strong> <small style={{color:'#FFD54F'}}>({percVArc}%)</small></span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <div style={{ display: 'flex', gap: '20px', color: '#aaa', alignItems: 'center', fontSize: '13px', backgroundColor: '#1a1a24', padding: '6px 15px', borderRadius: '4px', border: '1px dashed #555' }}>
                            <span style={{fontWeight: 'bold', color: '#fff'}}>Impatto sul Totale:</span>
                            <span>Fanteria: <strong style={{color:'#4CAF50'}}>{sumFantUccise.toLocaleString()} ({impattoFant}%)</strong></span>
                            <span>Cavalleria: <strong style={{color:'#2196F3'}}>{sumCavUccise.toLocaleString()} ({impattoCav}%)</strong></span>
                            <span>Arcieri: <strong style={{color:'#F44336'}}>{sumArcUccise.toLocaleString()} ({impattoArc}%)</strong></span>
                          </div>
                        </div>
                      </div>

                      {/* AVVISO TRUPPE MANCANTI */}
                      {isWipeoutIncompleto && (
                        <div style={{ backgroundColor: 'rgba(255, 82, 82, 0.1)', padding: '12px 20px', borderBottom: '1px solid #444', color: '#ffcc80', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                          ⚠️ <strong>Saturazione del Danno:</strong> I vichinghi hanno sfondato le linee. In base all'efficienza media, l'alleanza avrebbe dovuto inviare circa <strong style={{color: '#fff', fontSize: '16px'}}>{truppeMancanti.toLocaleString()}</strong> truppe in più per eliminare i bersagli rimasti.
                        </div>
                      )}

                      {/* TABELLA DEI TIER SPECIFICA PER L'ONDATA */}
                      {pesiTierData.length > 0 && (
                        <div style={{ padding: '15px 20px', backgroundColor: '#1a1a24', borderBottom: '2px solid #333' }}>
                          <h4 style={{ margin: '0 0 10px 0', color: '#4CAF50' }}>Vantaggio di Tier in questa Ondata</h4>
                          <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                              <thead>
                                <tr style={{ borderBottom: '1px solid #444', color: '#888' }}>
                                  <th style={{ padding: '6px 10px' }}>Livello</th>
                                  <th style={{ padding: '6px 10px' }}>Rateo Efficienza</th>
                                  <th style={{ padding: '6px 10px' }}>Vantaggio sul Liv. Inferiore</th>
                                  <th style={{ padding: '6px 10px' }}>Nota</th>
                                </tr>
                              </thead>
                              <tbody>
                                {pesiTierData.map((data, i) => (
                                  <tr key={i} style={{ backgroundColor: data.isStimato ? 'rgba(255, 179, 0, 0.05)' : 'transparent', borderBottom: '1px solid #2a2a35' }}>
                                    <td style={{ padding: '6px 10px', fontWeight: 'bold', color: data.isStimato ? '#FFB300' : '#fff' }}>{data.tier}</td>
                                    <td style={{ padding: '6px 10px', color: data.isStimato ? '#FFB300' : '#fff', fontStyle: data.isStimato ? 'italic' : 'normal' }}>{data.rateo.toFixed(3)}</td>
                                    <td style={{ padding: '6px 10px', fontWeight: 'bold', color: data.delta !== null ? (data.delta > 0 ? '#4CAF50' : '#ff5252') : '#888' }}>
                                      {data.delta !== null ? (data.delta > 0 ? `+${data.delta.toFixed(2)}%` : `${data.delta.toFixed(2)}%`) : '-'}
                                    </td>
                                    <td style={{ padding: '6px 10px', color: data.isStimato ? '#FFB300' : '#888' }}>{data.isStimato ? `⚠️ ${data.nota}` : '✓'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* TABELLA GIOCATORI CON DATI COMPLETI */}
                      <div style={{ overflowX: 'auto', padding: '10px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid #444', color: '#888', fontSize: '13px' }}>
                              <th style={{ textAlign: 'left', padding: '10px' }}>Alleato</th>
                              <th style={{ padding: '10px' }}>Tier</th>
                              <th style={{ padding: '10px', color: '#4fc3f7' }}>Fant (I/U)</th>
                              <th style={{ padding: '10px', color: '#ba68c8' }}>Cav (I/U)</th>
                              <th style={{ padding: '10px', color: '#ffb74d' }}>Arc (I/U)</th>
                              <th style={{ padding: '10px', color: '#4CAF50', borderLeft: '1px solid #444' }}>Rat. Reale (Fant)</th>
                              
                              {/* NUOVA COLONNA: Differenziale Multiplo */}
                              <th style={{ padding: '10px', color: '#b2ebf2' }}>Diff. Rateo (Min=1)</th>
                              
                              <th style={{ padding: '10px', color: '#FF9800', borderLeft: '1px solid #444' }}>Rat. Teorico</th>
                              <th style={{ padding: '10px', color: '#FFB300' }}>Ucc. Teoriche (Fant)</th>
                              <th style={{ padding: '10px', color: '#fff' }}>Delta Error</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ondata.giocatori.map((g, i) => {
                              const isHost = i === 0;
                              
                              const fantInviate = g.truppeInviate?.fant || 0;
                              const fantUccise = g.truppeUccise?.fant || 0;
                              const rateoFantReale = fantInviate > 0 ? (fantUccise / fantInviate) : 0;
                              
                              const cavInviate = g.truppeInviate?.cav || 0;
                              const cavUccise = g.truppeUccise?.cav || 0;
                              
                              const arcInviate = g.truppeInviate?.arc || 0;
                              const arcUccise = g.truppeUccise?.arc || 0;
                              
                              let rateoTeorico = 0;
                              let uccisioniTeoriche = 0;
                              let deltaError = 0;
                              let hasWeight = !!PESI_RELATIVI[g.livelloTier];

                              if (!isHost && fantInviate > 0 && hasWeight && maxRateoReale > 0) {
                                const moltiplicatore = PESI_RELATIVI[g.livelloTier] / maxTierWeight;
                                rateoTeorico = maxRateoReale * moltiplicatore;
                                uccisioniTeoriche = Math.round(rateoTeorico * fantInviate);
                                deltaError = fantUccise - uccisioniTeoriche;
                              }

                              return (
                                <tr key={i} style={{ borderBottom: '1px solid #333', backgroundColor: isHost ? 'rgba(255,255,255,0.03)' : 'transparent' }}>
                                  <td style={{ textAlign: 'left', padding: '10px', fontWeight: 'bold' }}>
                                    {g.nome || 'Sconosciuto'} {isHost && <span style={{fontSize: '10px', color: '#888'}}>(Host)</span>}
                                  </td>
                                  <td style={{ padding: '10px', color: '#aaa' }}>{g.livelloTier || '-'}</td>
                                  
                                  {/* Fanteria */}
                                  <td style={{ padding: '10px' }}><span style={{ color: '#aaa' }}>{fantInviate.toLocaleString()}</span> / <span style={{ color: '#ff5252' }}>{fantUccise.toLocaleString()}</span></td>
                                  
                                  {/* Cavalleria */}
                                  <td style={{ padding: '10px' }}><span style={{ color: '#aaa' }}>{cavInviate.toLocaleString()}</span> / <span style={{ color: '#ff5252' }}>{cavUccise.toLocaleString()}</span></td>
                                  
                                  {/* Arcieri */}
                                  <td style={{ padding: '10px' }}><span style={{ color: '#aaa' }}>{arcInviate.toLocaleString()}</span> / <span style={{ color: '#ff5252' }}>{arcUccise.toLocaleString()}</span></td>

                                  {/* Rateo Reale (Fanteria) */}
                                  <td style={{ padding: '10px', borderLeft: '1px solid #444' }}>
                                    <strong style={{ color: rateoFantReale > 0 ? '#4CAF50' : '#555' }}>
                                      {rateoFantReale.toFixed(4)}
                                    </strong>
                                  </td>
                                  
                                  {/* NUOVA COLONNA: Multiplo Rispetto al Minimo */}
                                  <td style={{ padding: '10px', color: '#b2ebf2', fontWeight: 'bold' }}>
                                    {!isHost && rateoFantReale > 0 && minRateoReale > 0 
                                      ? (rateoFantReale / minRateoReale).toFixed(3) + 'x' 
                                      : '-'}
                                  </td>

                                  {/* Dati Test Algoritmo */}
                                  {!isHost && hasWeight && fantInviate > 0 ? (
                                    <>
                                      <td style={{ padding: '10px', color: '#FF9800', borderLeft: '1px solid #444' }}>{rateoTeorico.toFixed(4)}</td>
                                      <td style={{ padding: '10px', color: '#FFB300' }}>{uccisioniTeoriche.toLocaleString()}</td>
                                      <td style={{ padding: '10px', fontWeight: 'bold', color: Math.abs(deltaError) <= 5 ? '#4CAF50' : '#ff5252' }}>
                                        {deltaError > 0 ? '+' : ''}{deltaError.toLocaleString()}
                                      </td>
                                    </>
                                  ) : (
                                    <td colSpan="3" style={{ padding: '10px', color: '#555', fontStyle: 'italic', borderLeft: '1px solid #444' }}>
                                      {isHost ? "Escluso (Host)" : "Dati insuff. o Tier ignoto"}
                                    </td>
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* --- NUOVO BLOCCO CONFRONTO --- */}
            {analisiTab === 'confronto' && (
              <VikingConfronto eventi={eventi} />
            )}

        {/* VISTA 2: INSERIMENTO DATI */}
        {activeView === 'inserimento' && (
          <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
            <h1 style={{ marginTop: 0, marginBottom: '20px' }}>Inserimento Dati Vichinghi</h1>
            
            {!showImporter && !showWizard && (
              <div style={{ display: 'flex', gap: '20px', marginTop: '30px' }}>
                <button 
                  onClick={() => setShowImporter(true)} 
                  style={{ padding: '20px', backgroundColor: '#4CAF50', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '18px', fontWeight: 'bold', flex: 1, boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}
                >
                  📥 Importa Dati da Excel
                </button>
                <button 
                  onClick={() => setShowWizard(true)} 
                  style={{ padding: '20px', backgroundColor: '#2196F3', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '18px', fontWeight: 'bold', flex: 1, boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}
                >
                  🧙‍♂️ Usa Wizard Inserimento Rapido
                </button>
              </div>
            )}

            {showImporter && (
              <div>
                <button 
                  onClick={() => setShowImporter(false)} 
                  style={{ marginBottom: '20px', padding: '10px 15px', backgroundColor: '#555', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  ⬅ Indietro alle opzioni
                </button>
                <VikingImporter onImportSuccess={() => { fetchEventi(); setShowImporter(false); setActiveView('analisi'); }} />
              </div>
            )}

            {showWizard && (
              <div>
                <button 
                  onClick={() => setShowWizard(false)} 
                  style={{ marginBottom: '20px', padding: '10px 15px', backgroundColor: '#555', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  ⬅ Indietro alle opzioni
                </button>
                <VikingWizard onComplete={() => { fetchEventi(); setShowWizard(false); setActiveView('analisi'); }} />
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}