import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { doc, deleteDoc } from 'firebase/firestore'; 
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { 
  PESI_RELATIVI, 
  preparaDatiGrafico, 
  calcolaPesiTierOndata, 
  analizzaOndata, 
  getTierColor, 
  eseguiReverseEngineering,
  calcolaStatisticheOndata
} from '../utils/vikingCalculations';
import VikingWaveEditor from './VikingWaveEditor'; 
import { VikingTierEfficiency } from './VikingTierEfficiency';
import { VikingEngagementRules } from './VikingEngagementRules';

// MATRICE FISSA DEI NEMICI (estratta dalla tabella ufficiale del gioco)
const COMPOSIZIONE_ORDE_VICHINGHE = {
  1: { fant: 6973, cav: 8136, arc: 8136, tot: 23245 },
  2: { fant: 12630, cav: 14955, arc: 14722, tot: 42307 },
  3: { fant: 19525, cav: 22781, arc: 22781, tot: 65087 },
  4: { fant: 29522, cav: 34481, arc: 34481, tot: 98484 },
  5: { fant: 44090, cav: 51374, arc: 51371, tot: 146838 },
  6: { fant: 59819, cav: 69738, arc: 69738, tot: 199295 },
  7: { fant: 85003, cav: 85003, arc: 85003, tot: 283369 },
  8: { fant: 110419, cav: 128783, arc: 128783, tot: 367985 },
  9: { fant: 136764, cav: 159623, arc: 159623, tot: 456010 },
  11: { fant: 220296, cav: 257025, arc: 257025, tot: 734346 },
  12: { fant: 282285, cav: 329398, arc: 329398, tot: 941081 },
  13: { fant: 377130, cav: 439971, arc: 439971, tot: 1257072 },
  14: { fant: 524976, cav: 610599, arc: 610599, tot: 1746174 },
  15: { fant: 905825, cav: 1056770, arc: 1056770, tot: 3019365 },
  16: { fant: 1442424, cav: 1682867, arc: 1682867, tot: 4808158 },
  17: { fant: 2091536, cav: 2440074, arc: 2440074, tot: 6971684 },
  18: { fant: 2903602, cav: 3387587, arc: 3387587, tot: 9678776 },
  19: { fant: 4035614, cav: 4708125, arc: 4708125, tot: 13451864 }
};

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
        {data['Nemici Sopravvissuti'] > 0 && <p style={{ margin: '5px 0', color: '#9e9e9e', fontWeight: 'bold' }}>Sopravvissuti: {data['Nemici Sopravvissuti'].toLocaleString()}</p>}
      </div>
    );
  }
  return null;
};

const calcolaMedianaRatei = (arr) => {
  if (!arr || arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const getPrimaryTier = (dettaglio) => {
  if (!dettaglio || !Array.isArray(dettaglio)) return null;
  const valid = dettaglio.filter(t => Number(t.inviate) > 0);
  if (valid.length === 0) return null;
  valid.sort((a, b) => Number(b.inviate) - Number(a.inviate));
  return valid[0].tier; 
};

const getHighlightStyle = (valore, mediana, conteggio, baseColor) => {
  if (!valore || !mediana || conteggio < 2) return { color: baseColor }; 
  const diff = Math.abs(valore - mediana) / mediana;
  
  if (diff <= 0.02) { 
    return { color: '#4CAF50', fontWeight: 'bold', backgroundColor: 'rgba(76, 175, 80, 0.15)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(76, 175, 80, 0.3)' };
  }
  if (diff >= 0.10) { 
    return { color: '#ff5252', fontWeight: 'bold', backgroundColor: 'rgba(255, 82, 82, 0.15)', padding: '2px 6px', borderRadius: '4px', border: '1px dashed #ff5252' };
  }
  return { color: baseColor };
};

const verificaCoerenzaRatei = (giocatori, livelloOndata) => {
  const erroriTrovati = [];
  const TOLLERANZA_MAX = 0.001; 
  const MIN_TRUPPE = 1000;
  
  const mappaRatei = {};

  giocatori.forEach(giocatore => {
    // Esaminiamo le truppe passate nel dettaglioTruppe
    ['fant', 'cav', 'arc'].forEach(tipo => {
      const dettaglio = giocatore.dettaglioTruppe?.[tipo] || [];
      
      dettaglio.forEach(t => {
        const inviate = Number(t.inviate) || 0;
        const uccisioni = Number(t.uccise) || 0;
        const tier = t.tier;
        const isHost = giocatore.isHost || false;

        // Escludi gli arcieri dell'Host (Regola Backline/Soccorso)
        if (isHost && tipo === 'arc') return;

        if (inviate >= MIN_TRUPPE && tier) {
          const rateo = uccisioni / inviate;
          const chiave = `${tipo.toUpperCase()}_${tier}`;

          if (!mappaRatei[chiave]) {
            mappaRatei[chiave] = [];
          }
          
          mappaRatei[chiave].push({ 
            nome: giocatore.nome || 'Sconosciuto', 
            rateo: rateo
          });
        }
      });
    });
  });

  // Confronto i ratei trovati
  for (const [chiave, listaDati] of Object.entries(mappaRatei)) {
    if (listaDati.length > 1) {
      const base = listaDati[0];

      for (let i = 1; i < listaDati.length; i++) {
        const corrente = listaDati[i];
        const scarto = Math.abs(corrente.rateo - base.rateo);

        if (scarto > TOLLERANZA_MAX) {
          // Formattazione identica al tuo array nuoviErrori
          erroriTrovati.push({
            ondata: livelloOndata,
            giocatore: corrente.nome,
            tipo: 'Discrepanza Rateo OCR',
            msg: `Incongruenza in ${chiave}. Rateo ${corrente.rateo.toFixed(4)} contro il ${base.rateo.toFixed(4)} di ${base.nome} (Scarto: ${scarto.toFixed(4)}).`
          });
        }
      }
    }
  }

  return erroriTrovati;
};

export default function VikingAnalisiSingolo({ eventi, datiEvento, selectedEventId, handleSelectChange, fetchEventi }) {
  const [mostraJsonAnalisi, setMostraJsonAnalisi] = useState(false);
  const [editingWaveIndex, setEditingWaveIndexState] = useState(() => {
    const salvato = sessionStorage.getItem('vikingEditingWave');
    return salvato !== null ? parseInt(salvato, 10) : null;
  });

  const setEditingWaveIndex = (index) => {
    if (index === null) {
      sessionStorage.removeItem('vikingEditingWave');
    } else {
      sessionStorage.setItem('vikingEditingWave', index);
    }
    setEditingWaveIndexState(index);
  };
  
  const [rapportoErrori, setRapportoErrori] = useState(null); 
  
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [panelPos, setPanelPos] = useState({ 
    x: typeof window !== 'undefined' ? window.innerWidth - 490 : 50, 
    y: typeof window !== 'undefined' ? window.innerHeight - 500 : 50 
  });
  
  // ---> ECCO LA FUNZIONE INSERITA CORRETTAMENTE NEL SUO SCOPE <---
  const handleRimuoviErrore = (indexDaRimuovere) => {
    setRapportoErrori(prevErrori => 
      prevErrori.filter((_, index) => index !== indexDaRimuovere)
    );
  };
  // -----------------------------------------------------------------

  const pdfRef = useRef();

  const handleExportPDF = async () => {
    const element = pdfRef.current;
    if (!element) return;
    try {
      const canvas = await html2canvas(element, { backgroundColor: '#121212', scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('l', 'mm', 'a4'); 
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      const nomeFile = datiEvento?.nomeEvento ? `Analisi_${datiEvento.nomeEvento}` : 'Analisi_Vichinghi';
      pdf.save(`${nomeFile}.pdf`);
    } catch (error) {
      alert("❌ Errore durante la creazione del PDF.");
    }
  };

  const handleDeleteEvent = async () => {
    if (!selectedEventId) return;
    if (window.confirm("Sei sicuro di voler eliminare definitivamente questo evento e tutte le sue ondate?")) {
      try {
        await deleteDoc(doc(db, "eventi_vichinghi", selectedEventId));
        alert("🗑️ Evento eliminato con successo!");
        fetchEventi();
      } catch (error) {
        alert("❌ Errore durante l'eliminazione dell'evento.");
      }
    }
  };

  const handleSaveEditor = () => {
    console.log("💾 [VikingAnalisiSingolo] Ricevuto segnale di salvataggio terminato dall'Editor!");
    if (fetchEventi) {
      console.log("🔄 [VikingAnalisiSingolo] Avvio fetchEventi(true) per ricaricare i dati in background...");
      fetchEventi(true); 
    } else {
      console.warn("⚠️ [VikingAnalisiSingolo] fetchEventi non è definito!");
    }
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - panelPos.x,
      y: e.clientY - panelPos.y
    });
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging) {
        setPanelPos({ x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y });
      }
    };
    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  const eseguiScansioneErrori = () => {
    if (!datiEvento || !datiEvento.ondate) return;
    
    const nuoviErrori = [];
    const truppePrecedenti = {}; 

    datiEvento.ondate.forEach((ondataOriginale) => {
      const liv = ondataOriginale.livello;
      
      const ondataCalcolata = calcolaStatisticheOndata(ondataOriginale);
      const stats = analizzaOndata(ondataCalcolata);
      
      let uccisioniRealiTotali = 0;
      ondataOriginale.giocatori.forEach(g => {
        uccisioniRealiTotali += (g.truppeUccise?.fant || 0) + (g.truppeUccise?.cav || 0) + (g.truppeUccise?.arc || 0);
      });

      const handleRimuoviErrore = (indexDaRimuovere) => {
    setRapportoErrori(prevErrori => 
      prevErrori.filter((_, index) => index !== indexDaRimuovere)
    );
  };

      const ordaFissa = COMPOSIZIONE_ORDE_VICHINGHE[liv];
      if (ordaFissa && uccisioniRealiTotali > ordaFissa.tot) {
        const surplus = uccisioniRealiTotali - ordaFissa.tot;
        nuoviErrori.push({
          ondata: liv,
          giocatore: 'Report Globale',
          tipo: 'Overkill Anomalo',
          msg: `Anomalia Kill: Registrate ${uccisioniRealiTotali.toLocaleString()} uccisioni contro ${ordaFissa.tot.toLocaleString()} vichinghi disponibili. (Surplus: +${surplus.toLocaleString()})`
        });
      }
      if (!ordaFissa && (!stats.vTotali || stats.vTotali <= 0) && uccisioniRealiTotali === 0) {
        nuoviErrori.push({ ondata: liv, giocatore: 'Orda Nemica', tipo: 'Dati Mancanti', msg: 'Nemici totali a zero e nessuna uccisione registrata (Dati Livello non in memoria).' });
      }

      ondataOriginale.giocatori.forEach((g, pIndex) => {
        const pName = g.nome || `Giocatore ${pIndex + 1}`;
        const isHost = pIndex === 0;
        
        let totInviateFant = 0;
        let totInviateCav = 0;
        let totInviateArc = 0;
        let totUccise = 0;
        
        ['fant', 'cav', 'arc'].forEach(cat => {
          const truppe = g.dettaglioTruppe?.[cat] || [];
          truppe.forEach(t => {
            const inv = Number(t.inviate) || 0;
            const ucc = Number(t.uccise) || 0;
            
            if (cat === 'fant') totInviateFant += inv;
            if (cat === 'cav') totInviateCav += inv;
            if (cat === 'arc') totInviateArc += inv;
            
            totUccise += ucc;
            
            if (ucc > 0 && inv === 0) {
              nuoviErrori.push({ ondata: liv, giocatore: pName, tipo: 'Dati Illogici', msg: `Registrate ${ucc} uccisioni in ${cat}, ma risultano 0 truppe inviate.` });
            }
            if (ucc > 0 && (!t.tier || t.tier.trim() === '')) {
              nuoviErrori.push({ ondata: liv, giocatore: pName, tipo: 'Dati Incompleti', msg: `Manca il Tier assegnato alle truppe in ${cat} che hanno registrato uccisioni.` });
            }
          });
        });

        if (truppePrecedenti[pName]) {
          const prev = truppePrecedenti[pName];
          
          if (totInviateFant > prev.fant && prev.fant > 0) {
            nuoviErrori.push({ ondata: liv, giocatore: pName, tipo: 'Truppe In Aumento (Glitch OCR)', msg: `La Fanteria schierata è salita da ${prev.fant.toLocaleString()} a ${totInviateFant.toLocaleString()}. I numeri in battaglia possono solo scendere o restare invariati.` });
          }
          if (totInviateCav > prev.cav && prev.cav > 0) {
            nuoviErrori.push({ ondata: liv, giocatore: pName, tipo: 'Truppe In Aumento (Glitch OCR)', msg: `La Cavalleria schierata è salita da ${prev.cav.toLocaleString()} a ${totInviateCav.toLocaleString()}. I numeri in battaglia possono solo scendere o restare invariati.` });
          }
          if (totInviateArc > prev.arc && prev.arc > 0) {
            nuoviErrori.push({ ondata: liv, giocatore: pName, tipo: 'Truppe In Aumento (Glitch OCR)', msg: `Gli Arcieri schierati sono saliti da ${prev.arc.toLocaleString()} a ${totInviateArc.toLocaleString()}. I numeri in battaglia possono solo scendere o restare invariati.` });
          }
        }

        truppePrecedenti[pName] = {
          fant: totInviateFant > 0 ? totInviateFant : (truppePrecedenti[pName]?.fant || 0),
          cav: totInviateCav > 0 ? totInviateCav : (truppePrecedenti[pName]?.cav || 0),
          arc: totInviateArc > 0 ? totInviateArc : (truppePrecedenti[pName]?.arc || 0)
        };

        const punteggio = Number(g.punteggio) || 0;

        if (totUccise > 0 && punteggio === 0) {
          nuoviErrori.push({ ondata: liv, giocatore: pName, tipo: 'Punteggio', msg: `Il punteggio è 0, ma risultano ${totUccise} truppe nemiche uccise.` });
        }
        
        if (punteggio > 0 && totUccise === 0 && !isHost) {
          nuoviErrori.push({ ondata: liv, giocatore: pName, tipo: 'Punteggio', msg: `Punteggio rilevato (${punteggio}), ma zero uccisioni registrate.` });
        }
      });

      const rateiOndata = [];
      ondataOriginale.giocatori.forEach(g => {
        if (g.isHost) return; 
        const p = Number(g.punteggio) || 0;
        const u = (Number(g.truppeUccise?.fant) || 0) + (Number(g.truppeUccise?.cav) || 0) + (Number(g.truppeUccise?.arc) || 0);
        
        if (p > 0 && u > 0) {
          rateiOndata.push(u / p);
        }
      });

      if (rateiOndata.length > 0) {
        rateiOndata.sort((a, b) => a - b);
        const mid = Math.floor(rateiOndata.length / 2);
        const rateoMediano = rateiOndata.length % 2 !== 0 ? rateiOndata[mid] : (rateiOndata[mid - 1] + rateiOndata[mid]) / 2;

        ondataOriginale.giocatori.forEach((g, pIndex) => {
          if (g.isHost) return;
          const pName = g.nome || `Giocatore ${pIndex + 1}`;
          const punteggio = Number(g.punteggio) || 0;
          const totUccise = (Number(g.truppeUccise?.fant) || 0) + (Number(g.truppeUccise?.cav) || 0) + (Number(g.truppeUccise?.arc) || 0);

          if (punteggio > 0) {
            const uccisioniAttese = Math.round(punteggio * rateoMediano);
            const scarto = Math.abs(totUccise - uccisioniAttese);
            
            if (scarto > (uccisioniAttese * 0.03)) {
              
              let suggerimento = '';
              if (Math.abs(totUccise - (punteggio * 10) * rateoMediano) < (totUccise * 0.03)) {
                  suggerimento = `(💡 Sembra mancare uno zero finale al Punteggio, letto ${punteggio} invece di ${punteggio * 10})`;
              } else if (totUccise < uccisioniAttese) {
                  suggerimento = `(💡 Probabile riga di uccisioni mancante / saltata dallo scanner)`;
              }

              nuoviErrori.push({ 
                ondata: liv, 
                giocatore: pName, 
                tipo: 'Rateo Matematico Errato', 
                msg: `Con ${punteggio.toLocaleString()} punti dovrebbe avere ~${uccisioniAttese.toLocaleString()} uccisioni (Rateo Ondata: ${rateoMediano.toFixed(2)}), ma ne ha registrate ${totUccise.toLocaleString()}. ${suggerimento}` 
              });
            }
          }
        });
      } // <-- Fine del blocco if (rateiOndata.length > 0)

      // ---> INIZIO INSERIMENTO NUOVO CONTROLLO OCR <---
      const erroriRateoOCR = verificaCoerenzaRatei(ondataOriginale.giocatori, liv);
      if (erroriRateoOCR.length > 0) {
        nuoviErrori.push(...erroriRateoOCR);
      }
      // ---> FINE INSERIMENTO NUOVO CONTROLLO OCR <---

    }); // <-- Chiusura di datiEvento.ondate.forEach

    setRapportoErrori(nuoviErrori);
  };

  useEffect(() => {
    if (rapportoErrori !== null && datiEvento) {
      eseguiScansioneErrori();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datiEvento]);


  const chartData = preparaDatiGrafico(datiEvento);

  return (
    <div>
      <div style={{ marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1e1e2f', padding: '20px', borderRadius: '8px', flexWrap: 'wrap', gap: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
          <label style={{ fontWeight: 'bold' }}>Seleziona Evento:</label>
          {eventi.length > 0 ? (
            <select value={selectedEventId} onChange={handleSelectChange} style={{ padding: '10px 15px', borderRadius: '4px', backgroundColor: '#2a2a40', color: '#fff', border: '1px solid #555' }}>
              {eventi.map(ev => <option key={ev.id} value={ev.id}>{ev.nomeEvento ? `${ev.dataEvento || ''} - ${ev.nomeEvento}` : ev.id}</option>)}
            </select>
          ) : <span style={{ color: '#ff5252' }}>Nessun evento disponibile.</span>}

          {datiEvento?.rosterRiferimento && (
            <span style={{ fontSize: '13px', color: '#38bdf8', backgroundColor: 'rgba(56, 189, 248, 0.1)', padding: '6px 12px', borderRadius: '4px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
              👥 Roster: <strong>{datiEvento.rosterRiferimento}</strong>
            </span>
          )}
        </div>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={eseguiScansioneErrori} style={{ padding: '10px 20px', borderRadius: '4px', backgroundColor: '#FF9800', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold' }} disabled={!datiEvento}>
            🔍 Diagnostica Errori OCR
          </button>

          <button onClick={handleExportPDF} style={{ padding: '10px 20px', borderRadius: '4px', backgroundColor: '#2196F3', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold' }} disabled={!datiEvento}>
            📄 Esporta PDF
          </button>
          
          <button onClick={() => setMostraJsonAnalisi(!mostraJsonAnalisi)} style={{ padding: '10px 20px', borderRadius: '4px', backgroundColor: '#9C27B0', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold' }} disabled={!datiEvento}>
            {mostraJsonAnalisi ? 'Nascondi JSON' : 'Visualizza JSON'}
          </button>
          
          <button onClick={handleDeleteEvent} style={{ padding: '10px 20px', borderRadius: '4px', backgroundColor: '#d32f2f', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold' }} disabled={!datiEvento}>
            🗑️ Elimina Evento
          </button>
        </div>
      </div>

      {rapportoErrori !== null && (
        <div style={{ 
          position: 'fixed', 
          left: `${panelPos.x}px`,
          top: `${panelPos.y}px`,
          width: '450px', 
          maxHeight: '70vh', 
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'rgba(30, 30, 47, 0.95)', 
          borderRadius: '12px', 
          border: rapportoErrori.length > 0 ? '2px solid #ff5252' : '2px solid #4CAF50',
          boxShadow: isDragging ? '0 15px 40px rgba(0,0,0,0.8)' : '0 10px 30px rgba(0,0,0,0.7)',
          zIndex: 9999,
          backdropFilter: 'blur(5px)',
          transition: isDragging ? 'none' : 'box-shadow 0.2s',
          userSelect: isDragging ? 'none' : 'auto' 
        }}>
          
          <div 
            onMouseDown={handleMouseDown}
            style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              padding: '15px 20px',
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              cursor: isDragging ? 'grabbing' : 'grab',
              borderTopLeftRadius: '10px',
              borderTopRightRadius: '10px'
            }}
          >
            <h3 style={{ margin: 0, color: rapportoErrori.length > 0 ? '#ff5252' : '#4CAF50', fontSize: '16px', pointerEvents: 'none' }}>
              {rapportoErrori.length > 0 ? `⚠️ ${rapportoErrori.length} Anomalie Rilevate` : '✅ Dati perfetti e coerenti!'}
            </h3>
            <button 
              onMouseDown={(e) => e.stopPropagation()} 
              onClick={() => setRapportoErrori(null)} 
              style={{ padding: '6px 12px', backgroundColor: '#333', color: '#fff', border: '1px solid #555', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              ✕ Chiudi
            </button>
          </div>
          
          {rapportoErrori.length > 0 && (
            <div style={{ overflowY: 'auto', flexGrow: 1, padding: '15px 20px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #555', color: '#888' }}>
                    <th style={{ padding: '8px 4px' }}>Ondata</th>
                    <th style={{ padding: '8px 4px' }}>Giocatore</th>
                    <th style={{ padding: '8px 4px' }}>Problema</th>
                    {/* ---> NUOVA COLONNA AZIONI <--- */}
                    <th style={{ padding: '8px 4px', textAlign: 'center' }}>Ignora</th>
                  </tr>
                </thead>
                <tbody>
                  {rapportoErrori.map((err, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #333' }}>
                      <td style={{ padding: '8px 4px', fontWeight: 'bold', color: '#fff', verticalAlign: 'top' }}>
                        Lvl. {err.ondata}
                      </td>
                      <td style={{ padding: '8px 4px', color: '#4fc3f7', verticalAlign: 'top' }}>
                        {err.giocatore}
                      </td>
                      <td style={{ padding: '8px 4px', color: '#aaa', wordBreak: 'break-word', verticalAlign: 'top' }}>
                        <span style={{ color: '#FFD54F', fontWeight: 'bold', display: 'block', marginBottom: '2px', fontSize: '11px', textTransform: 'uppercase' }}>
                          {err.tipo}
                        </span>
                        {err.msg}
                      </td>
                      {/* ---> NUOVO PULSANTE ELIMINA <--- */}
                      <td style={{ padding: '8px 4px', verticalAlign: 'top', textAlign: 'center' }}>
                        <button 
                          onClick={() => handleRimuoviErrore(i)}
                          style={{ 
                            background: 'transparent', 
                            border: 'none', 
                            color: '#ff5252', 
                            cursor: 'pointer', 
                            fontSize: '16px',
                            padding: '4px',
                            borderRadius: '4px'
                          }}
                          title="Ignora questo errore"
                          onMouseOver={(e) => e.target.style.backgroundColor = 'rgba(255, 82, 82, 0.2)'}
                          onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div ref={pdfRef} style={{ padding: '10px', backgroundColor: '#121212' }}>
        
        {mostraJsonAnalisi && datiEvento && (
          <div style={{ backgroundColor: '#121212', padding: '20px', borderRadius: '8px', marginBottom: '30px', border: '1px solid #444' }}>
            <h3 style={{ color: '#9C27B0', marginTop: 0 }}>JSON Evento (Sola Lettura)</h3>
            <textarea readOnly value={JSON.stringify(datiEvento, null, 2)} style={{ width: '100%', height: '400px', backgroundColor: '#000', color: '#00FF00', fontFamily: 'monospace', padding: '15px', border: 'none', borderRadius: '4px', boxSizing: 'border-box' }} />
          </div>
        )}

        {chartData.length > 0 && (
          <div style={{ backgroundColor: '#1e1e2f', padding: '20px', borderRadius: '8px', marginBottom: '40px', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>
            <h3 style={{ marginTop: 0, color: '#FFB300' }}>Capacità di Uccisione vs Volume Orda</h3>
            <div style={{ width: '100%', height: '450px' }}>
              <ResponsiveContainer>
                <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="nome" stroke="#888" />
                  <YAxis stroke="#888" />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ paddingTop: '10px' }} />
                  <Bar dataKey="Uccisioni Fanteria" stackId="a" fill="#4CAF50" />
                  <Bar dataKey="Uccisioni Cavalleria" stackId="a" fill="#2196F3" />
                  <Bar dataKey="Uccisioni Arcieri" stackId="a" fill="#F44336" />
                  <Bar dataKey="Nemici Sopravvissuti" stackId="a" fill="#424242" />
                  <Line type="monotone" dataKey="Andamento Reale" stroke="#ffffff" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="Andamento Teorico" stroke="#FFEB3B" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {datiEvento && (
          <div style={{ backgroundColor: '#1e1e2f', padding: '20px', borderRadius: '8px', marginBottom: '40px', border: '1px solid #FF9800', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>
            <h3 style={{ marginTop: 0, color: '#FF9800', display: 'flex', alignItems: 'center', gap: '10px' }}>
              🔬 Ingegneria Inversa: Pesi Interni del Gioco
            </h3>
            <p style={{ color: '#aaa', fontSize: '14px', marginBottom: '15px' }}>
              Questa tabella calcola i moltiplicatori reali usati dal codice sorgente del gioco analizzando e incrociando i ratei reali di tutte le truppe in ogni singola ondata.
            </p>
            
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #555', color: '#fff', backgroundColor: '#2a2a40' }}>
                    <th style={{ padding: '10px' }}>Confronto Tier</th>
                    <th style={{ padding: '10px', color: '#4CAF50' }}>Vantaggio Reale Gioco</th>
                    <th style={{ padding: '10px', color: '#FFEB3B' }}>Il tuo Pesi_Relativi attuale</th>
                    <th style={{ padding: '10px' }}>Campioni Analizzati</th>
                    <th style={{ padding: '10px' }}>Stato Affidabilità</th>
                  </tr>
                </thead>
                <tbody>
                  {eseguiReverseEngineering(datiEvento).map((risultato, idx) => {
                    const tuoPesoAlto = PESI_RELATIVI[risultato.tierAlto];
                    const tuoPesoBasso = PESI_RELATIVI[risultato.tierBasso];
                    const tuoVantaggio = (tuoPesoAlto && tuoPesoBasso) ? (tuoPesoAlto / tuoPesoBasso) : null;
                    const scarto = tuoVantaggio ? Math.abs(risultato.moltiplicatoreEsatto - tuoVantaggio) : 0;
                    
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid #333' }}>
                       <td style={{ padding: '10px', fontWeight: 'bold' }}>
  {risultato.tipoConfronto === 'Fazione' ? (
    <span style={{ color: '#b2ebf2' }}>{risultato.confronto}</span>
  ) : (
    <>
      <span style={{ color: '#aaa', marginRight: '8px', fontSize: '12px' }}>
        {risultato.confronto.split(' ')[0]} 
      </span>
      <span style={{ color: getTierColor(risultato.tierAlto) }}>{risultato.tierAlto}</span>
      <span style={{ color: '#888', margin: '0 5px' }}>vs</span>
      <span style={{ color: getTierColor(risultato.tierBasso) }}>{risultato.tierBasso}</span>
    </>
  )}
</td>
                        <td style={{ padding: '10px', fontWeight: 'bold', color: '#4CAF50' }}>
                          {risultato.moltiplicatoreEsatto.toFixed(4)}x 
                          <span style={{ fontSize: '11px', color: '#888', marginLeft: '10px' }}>
                            ( +{((risultato.moltiplicatoreEsatto - 1) * 100).toFixed(1)}% )
                          </span>
                        </td>
                        <td style={{ padding: '10px', color: '#FFEB3B' }}>
                          {tuoVantaggio ? (
                            <>
                              {tuoVantaggio.toFixed(4)}x
                              {scarto > 0.005 && (
                                <span style={{ fontSize: '11px', color: '#ff5252', marginLeft: '10px' }}>
                                  (Diff: {scarto.toFixed(4)})
                                </span>
                              )}
                            </>
                          ) : 'Dato Mancante'}
                        </td>
                        <td style={{ padding: '10px', color: '#aaa' }}>
                          {risultato.campioni} ondate (Min {risultato.min} - Max {risultato.max})
                        </td>
                        <td style={{ padding: '10px' }}>
                          {risultato.affidabile ? 
                            <span style={{ color: '#4CAF50', backgroundColor: 'rgba(76,175,80,0.1)', padding: '4px 8px', borderRadius: '4px' }}>✓ Certificato</span> : 
                            <span style={{ color: '#ff5252', backgroundColor: 'rgba(255,82,82,0.1)', padding: '4px 8px', borderRadius: '4px' }}>⚠️ Pochi dati / Instabile</span>
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      {datiEvento && (
          <div style={{ marginTop: '20px', marginBottom: '30px' }}>
            <VikingTierEfficiency datiEvento={datiEvento} />
          </div>
        )}

        {datiEvento && (
          <div style={{ marginTop: '20px', marginBottom: '40px' }}>
            <VikingEngagementRules datiEvento={datiEvento} />
          </div>
        )}

        {datiEvento && datiEvento.ondate && datiEvento.ondate.map((ondataOriginale, index) => {
          
          if (editingWaveIndex === index) {
            return (
              <VikingWaveEditor 
                key={index}
                eventoId={selectedEventId}
                eventData={datiEvento}
                waveIndex={index}
                onSave={handleSaveEditor}
                onClose={() => setEditingWaveIndex(null)}
              />
            );
          }

          const ondata = calcolaStatisticheOndata(ondataOriginale);
          const pesiTierData = calcolaPesiTierOndata(ondata);
          const stats = analizzaOndata(ondata);

          const ordaFissa = COMPOSIZIONE_ORDE_VICHINGHE[ondata.livello];
          
          let displayVFant = 0, displayVCav = 0, displayVArc = 0, displayVTotali = 0;
          let wipeoutReale = stats.wipeoutPerc;

          if (ordaFissa) {
            displayVFant = ordaFissa.fant;
            displayVCav = ordaFissa.cav;
            displayVArc = ordaFissa.arc;
            displayVTotali = ordaFissa.tot;
            
            let uccisioniTotali = 0;
            ondata.giocatori.forEach(g => {
              uccisioniTotali += (g.truppeUccise?.fant || 0) + (g.truppeUccise?.cav || 0) + (g.truppeUccise?.arc || 0);
            });
            wipeoutReale = Math.min(100, Math.round((uccisioniTotali / displayVTotali) * 100));
          } else {
            let recFant = 0, recCav = 0, recArc = 0;
            ondata.giocatori.forEach(g => {
              recFant += g.truppeUccise?.fant || 0;
              recCav += g.truppeUccise?.cav || 0;
              recArc += g.truppeUccise?.arc || 0;
            });
            displayVFant = stats.vFant > 0 ? stats.vFant : recFant;
            displayVCav = stats.vCav > 0 ? stats.vCav : recCav;
            displayVArc = stats.vArc > 0 ? stats.vArc : recArc;
            displayVTotali = stats.vTotali > 0 ? stats.vTotali : (recFant + recCav + recArc);
          }

          const displayPercFant = displayVTotali > 0 ? Math.round((displayVFant / displayVTotali) * 100) : 0;
          const displayPercCav = displayVTotali > 0 ? Math.round((displayVCav / displayVTotali) * 100) : 0;
          const displayPercArc = displayVTotali > 0 ? Math.round((displayVArc / displayVTotali) * 100) : 0;

          const gruppiTierTruppa = { fant: {}, cav: {}, arc: {} };

          ondata.giocatori.forEach(g => {
            const fInv = g.truppeInviate?.fant || 0, fUcc = g.truppeUccise?.fant || 0;
            const cInv = g.truppeInviate?.cav || 0, cUcc = g.truppeUccise?.cav || 0;
            const aInv = g.truppeInviate?.arc || 0, aUcc = g.truppeUccise?.arc || 0;

            if (fInv > 0) {
              const tFant = getPrimaryTier(g.dettaglioTruppe?.fant);
              if (tFant) {
                if (!gruppiTierTruppa.fant[tFant]) gruppiTierTruppa.fant[tFant] = [];
                gruppiTierTruppa.fant[tFant].push(fUcc / fInv);
              }
            }
            if (cInv > 0) {
              const tCav = getPrimaryTier(g.dettaglioTruppe?.cav);
              if (tCav) {
                if (!gruppiTierTruppa.cav[tCav]) gruppiTierTruppa.cav[tCav] = [];
                gruppiTierTruppa.cav[tCav].push(cUcc / cInv);
              }
            }
            if (aInv > 0) {
              const tArc = getPrimaryTier(g.dettaglioTruppe?.arc);
              if (tArc) {
                if (!gruppiTierTruppa.arc[tArc]) gruppiTierTruppa.arc[tArc] = [];
                gruppiTierTruppa.arc[tArc].push(aUcc / aInv);
              }
            }
          });

          const medianeTierTruppa = { fant: {}, cav: {}, arc: {} };
          ['fant', 'cav', 'arc'].forEach(tipo => {
            Object.keys(gruppiTierTruppa[tipo]).forEach(t => {
              const arr = gruppiTierTruppa[tipo][t];
              medianeTierTruppa[tipo][t] = { valore: calcolaMedianaRatei(arr), conteggio: arr.length };
            });
          });

          return (
            <div key={index} style={{ marginBottom: '40px', backgroundColor: '#1e1e2f', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>
              
              <div style={{ backgroundColor: '#2a2a40', padding: '15px 20px', borderBottom: wipeoutReale < 100 ? '2px solid #ff5252' : '2px solid #4CAF50', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <h2 style={{ margin: 0, minWidth: '180px' }}>Livello Ondata: {ondata.livello}</h2>
                    {stats.validationStatus === "VALIDATED" && <span style={{ padding: '3px 8px', fontSize: '11px', fontFamily: 'monospace', fontWeight: 'bold', textTransform: 'uppercase', color: '#4CAF50', backgroundColor: 'rgba(76, 175, 80, 0.1)', border: '1px solid rgba(76, 175, 80, 0.3)', borderRadius: '4px' }}>✓ Cascata Verificata</span>}
                    {stats.validationStatus === "FAILED" && <span style={{ padding: '3px 8px', fontSize: '11px', fontFamily: 'monospace', fontWeight: 'bold', textTransform: 'uppercase', color: '#ff5252', backgroundColor: 'rgba(255, 82, 82, 0.1)', border: '1px solid rgba(255, 82, 82, 0.3)', borderRadius: '4px' }}>❌ Cascata Anomala</span>}
                    
                    <button 
                      onClick={() => setEditingWaveIndex(index)}
                      style={{ padding: '4px 10px', backgroundColor: '#FF9800', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                    >
                      ✏️ Modifica
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '15px', color: '#aaa', alignItems: 'center', fontSize: '14px', flexWrap: 'wrap', backgroundColor: '#1e1e2f', padding: '8px 15px', borderRadius: '6px', border: '1px solid #444' }}>
                    <span>V-Totali: <strong style={{color:'#FF9800', fontSize:'15px'}}>{displayVTotali.toLocaleString()}</strong> {!ordaFissa && <span style={{fontSize: '10px', color: '#ff5252'}}>(Stima)</span>}</span>
                    <span>Wipeout: <strong style={{color: wipeoutReale < 100 ? '#ff5252' : '#4CAF50', fontSize:'15px'}}>{wipeoutReale}%</strong></span>
                    <span style={{color: '#555'}}>|</span>
                    <span>Nemici: </span>
                    <span>Fant <strong style={{color:'#fff'}}>{displayVFant.toLocaleString()}</strong> <small style={{color:'#FFD54F'}}>({displayPercFant}%)</small></span>
                    <span>Cav <strong style={{color:'#fff'}}>{displayVCav.toLocaleString()}</strong> <small style={{color:'#FFD54F'}}>({displayPercCav}%)</small></span>
                    <span>Arc <strong style={{color:'#fff'}}>{displayVArc.toLocaleString()}</strong> <small style={{color:'#FFD54F'}}>({displayPercArc}%)</small></span>
                  </div>
                </div>
              </div>

              <div style={{ overflowX: 'auto', padding: '10px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', whiteSpace: 'nowrap', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #444', color: '#888', backgroundColor: 'rgba(0,0,0,0.2)' }}>
                      <th rowSpan="2" style={{ textAlign: 'left', padding: '10px' }}>Alleato</th>
                      <th rowSpan="2" style={{ padding: '10px', color: '#fff' }}>Tier (G)</th>
                      <th rowSpan="2" style={{ padding: '10px', color: '#b2ebf2', textAlign: 'center' }}>Inviati Tot.</th>
<th rowSpan="2" style={{ padding: '10px', color: '#ff5252', textAlign: 'center' }}>Uccisi Tot.</th>
                      <th rowSpan="2" style={{ padding: '10px', color: '#FFD54F' }}>Punti</th>
                      <th rowSpan="2" style={{ padding: '10px', color: '#4fc3f7' }}>Fant (I/U)</th>
                      <th rowSpan="2" style={{ padding: '10px', color: '#ba68c8' }}>Cav (I/U)</th>
                      <th rowSpan="2" style={{ padding: '10px', color: '#ffb74d' }}>Arc (I/U)</th>
                      
                      <th colSpan="4" style={{ padding: '8px', color: '#4CAF50', borderLeft: '2px solid #555', borderBottom: '1px solid #555', textAlign: 'center' }}>Rateo Reale</th>
                      <th colSpan="4" style={{ padding: '8px', color: '#FF9800', borderLeft: '2px solid #555', borderBottom: '1px solid #555', textAlign: 'center' }}>Rateo Teorico (Ponderato)</th>
                      <th colSpan="4" style={{ padding: '8px', color: '#FFB300', borderLeft: '2px solid #555', borderBottom: '1px solid #555', textAlign: 'center' }}>Uccisioni Teoriche</th>
                      <th colSpan="4" style={{ padding: '8px', color: '#fff', borderLeft: '2px solid #555', borderBottom: '1px solid #555', textAlign: 'center' }}>Delta Error</th>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #444', color: '#888', backgroundColor: 'rgba(0,0,0,0.1)', fontSize: '11px', textTransform: 'uppercase' }}>
                      <th style={{ padding: '6px', color: '#4CAF50', borderLeft: '2px solid #555' }}>Globale</th>
                      <th style={{ padding: '6px', color: '#4fc3f7' }}>Fant</th>
                      <th style={{ padding: '6px', color: '#ba68c8' }}>Cav</th>
                      <th style={{ padding: '6px', color: '#ffb74d' }}>Arc</th>
                      
                      <th style={{ padding: '6px', color: '#FF9800', borderLeft: '2px solid #555' }}>Globale</th>
                      <th style={{ padding: '6px', color: '#4fc3f7' }}>Fant</th>
                      <th style={{ padding: '6px', color: '#ba68c8' }}>Cav</th>
                      <th style={{ padding: '6px', color: '#ffb74d' }}>Arc</th>

                      <th style={{ padding: '6px', color: '#FFB300', borderLeft: '2px solid #555' }}>Globale</th>
                      <th style={{ padding: '6px', color: '#4fc3f7' }}>Fant</th>
                      <th style={{ padding: '6px', color: '#ba68c8' }}>Cav</th>
                      <th style={{ padding: '6px', color: '#ffb74d' }}>Arc</th>

                      <th style={{ padding: '6px', color: '#fff', borderLeft: '2px solid #555' }}>Globale</th>
                      <th style={{ padding: '6px', color: '#4fc3f7' }}>Fant</th>
                      <th style={{ padding: '6px', color: '#ba68c8' }}>Cav</th>
                      <th style={{ padding: '6px', color: '#ffb74d' }}>Arc</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ondata.giocatori.map((g, i) => {
                      const isHost = i === 0;
                      
                      const fantInviate = g.truppeInviate?.fant || 0;
                      const fantUccise = g.truppeUccise?.fant || 0;
                      const cavInviate = g.truppeInviate?.cav || 0;
                      const cavUccise = g.truppeUccise?.cav || 0;
                      const arcInviate = g.truppeInviate?.arc || 0;
                      const arcUccise = g.truppeUccise?.arc || 0;
                      
                      const totInviate = fantInviate + cavInviate + arcInviate;
                      const totUccise = fantUccise + cavUccise + arcUccise;
                      
                      const rateoReale = totInviate > 0 ? (totUccise / totInviate) : 0;
                      const rateoFantReale = fantInviate > 0 ? (fantUccise / fantInviate) : 0;
                      const rateoCavReale = cavInviate > 0 ? (cavUccise / cavInviate) : 0;
                      const rateoArcReale = arcInviate > 0 ? (arcUccise / arcInviate) : 0;

                      const tFant = getPrimaryTier(g.dettaglioTruppe?.fant);
                      const tCav = getPrimaryTier(g.dettaglioTruppe?.cav);
                      const tArc = getPrimaryTier(g.dettaglioTruppe?.arc);

                      const tTot = g.teorico?.uccisioniTotali || 0;
                      const teoFant = g.teorico?.uccisioni?.fant || 0;
                      const teoCav = g.teorico?.uccisioni?.cav || 0;
                      const teoArc = g.teorico?.uccisioni?.arc || 0;

                      const deltaError = totUccise - tTot;
                      const deltaFant = fantUccise - teoFant;
                      const deltaCav = cavUccise - teoCav;
                      const deltaArc = arcUccise - teoArc;

                      const renderBadge = (dettaglio, sum) => {
                        if (!sum || !dettaglio) return null;
                        const tiers = [...new Set(dettaglio.filter(t => Number(t.inviate) > 0).map(t => t.tier).filter(t => t))];
                        if(tiers.length === 0) return null;
                        return (
                          <span style={{ marginRight: '6px' }}>
                            {tiers.map((t, idx) => (
                              <span key={idx} style={{ fontSize: '10px', backgroundColor: 'rgba(255,255,255,0.05)', border: `1px solid ${getTierColor(t)}`, color: getTierColor(t), padding: '2px 4px', borderRadius: '3px', marginRight: '3px', fontWeight: 'bold' }}>
                                {t}
                              </span>
                            ))}
                          </span>
                        );
                      };

                      return (
                        <tr key={i} style={{ borderBottom: '1px solid #333', backgroundColor: isHost ? 'rgba(255,255,255,0.03)' : 'transparent' }}>
                          <td style={{ textAlign: 'left', padding: '10px', fontWeight: 'bold' }}>
                            {g.nome || 'Sconosciuto'} {isHost && <span style={{fontSize: '10px', color: '#888'}}>(Host)</span>}
                            {g.eroi && g.eroi.some(e => e.trim() !== '') && (
                              <div style={{ fontSize: '10px', color: '#aaa', marginTop: '4px' }}>
                                🦸 {g.eroi.filter(e => e.trim() !== '').join(' - ')}
                              </div>
                            )}
                          </td>
                          
                          <td style={{ padding: '10px', color: getTierColor(g.livelloTier), fontWeight: 'bold', textAlign: 'center' }}>
                            {g.livelloTier || '-'}
                          </td>

                          {/* NUOVE CELLE INSERITE QUI */}
<td style={{ padding: '10px', color: '#b2ebf2', fontWeight: 'bold', textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.03)' }}>
  {totInviate > 0 ? totInviate.toLocaleString('it-IT') : '-'}
</td>
<td style={{ padding: '10px', color: '#ff5252', fontWeight: 'bold', textAlign: 'center', backgroundColor: 'rgba(255,82,82,0.05)' }}>
  {totUccise > 0 ? totUccise.toLocaleString('it-IT') : '-'}
</td>

                          <td style={{ padding: '10px', color: '#FFD54F', fontWeight: 'bold' }}>{g.punteggio ? g.punteggio.toLocaleString() : '-'}</td>
                          
                          <td style={{ padding: '10px' }}>
                            {renderBadge(g.dettaglioTruppe?.fant, fantInviate)}
                            <span style={{ color: '#aaa' }}>{fantInviate.toLocaleString()}</span> / <span style={{ color: '#ff5252' }}>{fantUccise.toLocaleString()}</span>
                          </td>
                          <td style={{ padding: '10px' }}>
                            {renderBadge(g.dettaglioTruppe?.cav, cavInviate)}
                            <span style={{ color: '#aaa' }}>{cavInviate.toLocaleString()}</span> / <span style={{ color: '#ff5252' }}>{cavUccise.toLocaleString()}</span>
                          </td>
                          <td style={{ padding: '10px' }}>
                            {renderBadge(g.dettaglioTruppe?.arc, arcInviate)}
                            <span style={{ color: '#aaa' }}>{arcInviate.toLocaleString()}</span> / <span style={{ color: '#ff5252' }}>{arcUccise.toLocaleString()}</span>
                          </td>

                          <td style={{ padding: '10px', borderLeft: '2px solid #555' }}>
                            <span style={{ color: rateoReale > 0 ? '#4CAF50' : '#555' }}>{rateoReale > 0 ? rateoReale.toFixed(4) : '-'}</span>
                          </td>
                          <td style={{ padding: '10px' }}>
                            <span style={getHighlightStyle(rateoFantReale, tFant ? medianeTierTruppa.fant[tFant]?.valore : null, tFant ? medianeTierTruppa.fant[tFant]?.conteggio : 0, '#4fc3f7')}>
                              {fantInviate > 0 ? rateoFantReale.toFixed(4) : '-'}
                            </span>
                          </td>
                          <td style={{ padding: '10px' }}>
                            <span style={getHighlightStyle(rateoCavReale, tCav ? medianeTierTruppa.cav[tCav]?.valore : null, tCav ? medianeTierTruppa.cav[tCav]?.conteggio : 0, '#ba68c8')}>
                              {cavInviate > 0 ? rateoCavReale.toFixed(4) : '-'}
                            </span>
                          </td>
                          <td style={{ padding: '10px' }}>
                            <span style={getHighlightStyle(rateoArcReale, tArc ? medianeTierTruppa.arc[tArc]?.valore : null, tArc ? medianeTierTruppa.arc[tArc]?.conteggio : 0, '#ffb74d')}>
                              {arcInviate > 0 ? rateoArcReale.toFixed(4) : '-'}
                            </span>
                          </td>

                          {!isHost && g.teorico?.datiSufficienti ? (
                            <>
                              <td style={{ padding: '10px', borderLeft: '2px solid #555', color: '#FF9800', fontWeight: 'bold' }}>{g.teorico.rateoGlobale.toFixed(4)}</td>
                              <td style={{ padding: '10px', color: '#4fc3f7' }}>{fantInviate > 0 ? g.teorico.rateo.fant.toFixed(4) : '-'}</td>
                              <td style={{ padding: '10px', color: '#ba68c8' }}>{cavInviate > 0 ? g.teorico.rateo.cav.toFixed(4) : '-'}</td>
                              <td style={{ padding: '10px', color: '#ffb74d' }}>{arcInviate > 0 ? g.teorico.rateo.arc.toFixed(4) : '-'}</td>

                              <td style={{ padding: '10px', borderLeft: '2px solid #555', color: '#FFB300', fontWeight: 'bold' }}>{Math.round(tTot).toLocaleString()}</td>
                              <td style={{ padding: '10px', color: '#4fc3f7' }}>{fantInviate > 0 ? Math.round(teoFant).toLocaleString() : '-'}</td>
                              <td style={{ padding: '10px', color: '#ba68c8' }}>{cavInviate > 0 ? Math.round(teoCav).toLocaleString() : '-'}</td>
                              <td style={{ padding: '10px', color: '#ffb74d' }}>{arcInviate > 0 ? Math.round(teoArc).toLocaleString() : '-'}</td>

                              <td style={{ padding: '10px', borderLeft: '2px solid #555', fontWeight: 'bold', color: Math.abs(deltaError) <= 5 ? '#4CAF50' : '#ff5252' }}>
                                {deltaError > 0 ? '+' : ''}{Math.round(deltaError).toLocaleString()}
                              </td>
                              <td style={{ padding: '10px', fontWeight: 'bold', color: Math.abs(deltaFant) <= 5 ? '#4fc3f7' : '#ff5252' }}>
                                {fantInviate > 0 ? (deltaFant > 0 ? '+' + Math.round(deltaFant).toLocaleString() : Math.round(deltaFant).toLocaleString()) : '-'}
                              </td>
                              <td style={{ padding: '10px', fontWeight: 'bold', color: Math.abs(deltaCav) <= 5 ? '#ba68c8' : '#ff5252' }}>
                                {cavInviate > 0 ? (deltaCav > 0 ? '+' + Math.round(deltaCav).toLocaleString() : Math.round(deltaCav).toLocaleString()) : '-'}
                              </td>
                              <td style={{ padding: '10px', fontWeight: 'bold', color: Math.abs(deltaArc) <= 5 ? '#ffb74d' : '#ff5252' }}>
                                {arcInviate > 0 ? (deltaArc > 0 ? '+' + Math.round(deltaArc).toLocaleString() : Math.round(deltaArc).toLocaleString()) : '-'}
                              </td>
                            </>
                          ) : (
                            <td colSpan="12" style={{ padding: '10px', color: '#555', fontStyle: 'italic', borderLeft: '2px solid #555', textAlign: 'center' }}>
                              {isHost ? "Escluso (Host)" : "Dati insufficienti (Manca configurazione Pesi per i Tier inviati)"}
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
    </div>
  );
}