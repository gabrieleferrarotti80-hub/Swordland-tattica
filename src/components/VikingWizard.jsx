import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { estraiPunteggi, estraiTruppe } from './ocrEngine.js';

export default function VikingWizard({ onComplete }) {
  // --- STATI GLOBALI ---
  const [activeView, setActiveView] = useState('wizard'); // 'wizard' o 'batch-ocr'
  const [currentStep, setCurrentStep] = useState(0);
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [formations, setFormations] = useState([]);
  const [troopsMemory, setTroopsMemory] = useState({});
  const [currentWave, setCurrentWave] = useState(1);
  const [savedWaves, setSavedWaves] = useState([]);
  const [eventName, setEventName] = useState("");
  
  // --- STATI PER LA LISTA EVENTI ESISTENTI ---
  const [existingEvents, setExistingEvents] = useState([]);
  const [selectedExistingEvent, setSelectedExistingEvent] = useState('');
  const [isNewEventMode, setIsNewEventMode] = useState(false);

  // --- STATI ROSTER DA FIREBASE ---
  const [savedRosters, setSavedRosters] = useState([]);
  const [activeRoster, setActiveRoster] = useState([]); 
  const [selectedRosterId, setSelectedRosterId] = useState('');

  // --- STATI TEMPORANEI ---
  const [selectedFormId, setSelectedFormId] = useState('');
  const [currentScores, setCurrentScores] = useState({});
  const [currentTroops, setCurrentTroops] = useState({});
  const [currentHeroes, setCurrentHeroes] = useState({}); // <--- NUOVO STATO EROI
  const [loading, setLoading] = useState(false);
  const [newHost, setNewHost] = useState('');
  const [newReinforcements, setNewReinforcements] = useState('');

  // --- STATI OCR MASSIVO SDOPPIATI ---
  const [scoreFiles, setScoreFiles] = useState({});
  const [troopFiles, setTroopFiles] = useState({});
  const [ocrProgress, setOcrProgress] = useState({ status: 'idle', wave: 0, log: '' });

  // --- CARICAMENTO INIZIALE DATI FIREBASE ---
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const rosterSnapshot = await getDocs(collection(db, "rosters"));
        const listaRosters = rosterSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setSavedRosters(listaRosters);

        if (listaRosters.length > 0) {
          const defaultRoster = listaRosters[0];
          setSelectedRosterId(defaultRoster.id);
          
          let arrayTrovato = defaultRoster.giocatori || defaultRoster.players || defaultRoster.roster;
          if (!arrayTrovato) {
              const chiaveArray = Object.keys(defaultRoster).find(key => Array.isArray(defaultRoster[key]));
              arrayTrovato = chiaveArray ? defaultRoster[chiaveArray] : [];
          }
          setActiveRoster(arrayTrovato);
        }

        const eventsSnapshot = await getDocs(collection(db, "eventi_vichinghi"));
        const listaEventi = eventsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        listaEventi.sort((a, b) => new Date(b.dataEvento || b.id) - new Date(a.dataEvento || a.id));
        setExistingEvents(listaEventi);
      } catch (error) {
        console.error("Errore Firebase:", error);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  const handleRosterSelect = (e) => {
    const rId = e.target.value;
    setSelectedRosterId(rId);
    const rosterTrovato = savedRosters.find(r => r.id === rId);
    if (rosterTrovato) {
      setActiveRoster(rosterTrovato.giocatori || rosterTrovato.players || rosterTrovato.roster || []);
    } else {
      setActiveRoster([]);
    }
  };

  const handleLoadSelectedEvent = async () => {
    if (!activeRoster || activeRoster.length === 0) {
      return alert("⚠️ Attenzione: Devi selezionare un Roster di Riferimento valido dal menu a tendina prima di procedere!");
    }
    const targetEventId = isNewEventMode 
      ? (eventName.trim() ? `${eventDate} - ${eventName.trim()}` : eventDate) 
      : selectedExistingEvent;
    
    if (!targetEventId) return alert("Seleziona evento/data validi.");

    setLoading(true);
    setEventDate(targetEventId);

    try {
      const docRef = doc(db, 'eventi_vichinghi', targetEventId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.rosterRiferimento) {
          setSelectedRosterId(data.rosterRiferimento);
          const rosterTrovato = savedRosters.find(r => r.id === data.rosterRiferimento);
          if (rosterTrovato) {
            setActiveRoster(rosterTrovato.giocatori || rosterTrovato.players || rosterTrovato.roster || []);
          }
        }
        let loadedFormations = data.formations || [];
        const loadedWaves = data.ondate || [];
        
        if (loadedFormations.length === 0 && loadedWaves.length > 0) {
          const formazioniMappa = new Map();
          loadedWaves.forEach(ondata => {
            if (ondata.giocatori && ondata.giocatori.length > 0) {
              const host = ondata.giocatori[0].nome;
              const rinforzi = ondata.giocatori.slice(1).map(g => g.nome);
              if (!formazioniMappa.has(host)) {
                formazioniMappa.set(host, rinforzi);
              } else {
                const rinforziUnici = [...new Set([...formazioniMappa.get(host), ...rinforzi])];
                formazioniMappa.set(host, rinforziUnici);
              }
            }
          });
          loadedFormations = Array.from(formazioniMappa.entries()).map(([host, rinforzi], index) => ({
            id: `form_auto_${index}_${Date.now()}`, hostName: host, reinforcements: rinforzi
          }));
        }

        setFormations(loadedFormations);
        setTroopsMemory(data.lastWaveTroopsMemory || {});
        setSavedWaves(loadedWaves);
        setCurrentStep(loadedFormations.length > 0 ? 2 : 1);
        
     } else {
        await setDoc(docRef, { 
          dataEvento: eventDate, 
          nomeEvento: eventName, 
          rosterRiferimento: selectedRosterId,
          ondate: [], 
          formations: [], 
          lastWaveTroopsMemory: {} 
        });
        setSavedWaves([]); setFormations([]); setTroopsMemory({});
        setCurrentStep(1);
      }
    } catch (error) {
      alert("Errore database.");
    }
    setLoading(false);
  };

  const handleAddReinforcementClick = (nameToAdd) => {
    setNewReinforcements(prev => prev.includes(nameToAdd) ? prev : (prev ? `${prev}, ${nameToAdd}` : nameToAdd));
  };

  const addFormation = async () => {
    if (!newHost) return;
    const reinfs = newReinforcements.split(',').map(r => r.trim()).filter(r => r !== '');
    const newForm = { id: `form_${Date.now()}`, hostName: newHost, reinforcements: reinfs };
    const updatedFormations = [...formations, newForm];
    setFormations(updatedFormations);
    setNewHost(''); setNewReinforcements('');
    await setDoc(doc(db, 'eventi_vichinghi', eventDate), { formations: updatedFormations }, { merge: true });
  };

  const handleScoreChange = (player, value) => setCurrentScores(prev => ({ ...prev, [player]: value }));

  const handleProceedToScores = () => {
    if (!selectedFormId) return alert("Seleziona formazione!");
    const form = formations.find(f => f.id === selectedFormId);
    const players = [form.hostName, ...form.reinforcements];
    const ondataEsistente = savedWaves.find(w => String(w.livello) === String(currentWave));
    const newScores = {};
    players.forEach(p => {
      const datiG = ondataEsistente?.giocatori?.find(g => g.nome === p);
      newScores[p] = (datiG && datiG.punteggio !== undefined) ? datiG.punteggio : (currentScores[p] || ''); 
    });
    setCurrentScores(newScores);
    setCurrentStep(3);
  };

  const handleAvantiPunteggi = () => {
    const form = formations.find(f => f.id === selectedFormId);
    if (!form) return;
    const players = [form.hostName, ...form.reinforcements];
    const ondataEsistente = savedWaves.find(w => String(w.livello) === String(currentWave));
    const memory = troopsMemory[selectedFormId] || {};
    
    const initialTroops = {};
    const initialHeroes = {}; // <--- INIZIALIZZAZIONE EROI

    players.forEach(p => {
      const datiS = ondataEsistente?.giocatori?.find(g => g.nome === p);
      
      // 1. GESTIONE TRUPPE
      if (datiS && datiS.dettaglioTruppe) {
        initialTroops[p] = JSON.parse(JSON.stringify(datiS.dettaglioTruppe));
      } else if (memory[p]) {
        initialTroops[p] = {
          fant: memory[p].fant?.map(t => ({ inviate: t.inviate || '', uccise: '', tier: t.tier || '' })) || [{ inviate: '', uccise: '', tier: '' }],
          cav: memory[p].cav?.map(t => ({ inviate: t.inviate || '', uccise: '', tier: t.tier || '' })) || [{ inviate: '', uccise: '', tier: '' }],
          arc: memory[p].arc?.map(t => ({ inviate: t.inviate || '', uccise: '', tier: t.tier || '' })) || [{ inviate: '', uccise: '', tier: '' }]
        };
      } else {
        const playerDetails = activeRoster.find(r => (r.nome || r.name) === p);
        const defaultTier = playerDetails?.level || playerDetails?.livello || '';
        initialTroops[p] = {
          fant: [{ inviate: '', uccise: '', tier: defaultTier }],
          cav: [{ inviate: '', uccise: '', tier: defaultTier }],
          arc: [{ inviate: '', uccise: '', tier: defaultTier }],
        };
      }

      // 2. GESTIONE EROI
      if (datiS && datiS.eroi) {
        initialHeroes[p] = [...datiS.eroi];
        while (initialHeroes[p].length < 3) initialHeroes[p].push('');
      } else if (memory[p] && memory[p].eroi) {
        initialHeroes[p] = [...memory[p].eroi];
      } else {
        initialHeroes[p] = ['', '', ''];
      }
    });

    setCurrentTroops(initialTroops);
    setCurrentHeroes(initialHeroes); // <--- SALVATAGGIO STATO EROI
    setCurrentStep(4);
  };

  // HANDLER PER EROI
  const handleHeroChange = (player, index, value) => {
    setCurrentHeroes(prev => {
      const newHeroes = [...(prev[player] || ['', '', ''])];
      newHeroes[index] = value;
      return { ...prev, [player]: newHeroes };
    });
  };

  const handleAddTroopRow = (player, category) => {
    setCurrentTroops(prev => ({
      ...prev, [player]: { ...prev[player], [category]: [...prev[player][category], { inviate: '', uccise: '', tier: '' }] }
    }));
  };

  const handleRemoveTroopRow = (player, category, index) => {
    setCurrentTroops(prev => {
      const newArr = [...prev[player][category]]; newArr.splice(index, 1);
      return { ...prev, [player]: { ...prev[player], [category]: newArr.length > 0 ? newArr : [{ inviate: '', uccise: '', tier: '' }] } };
    });
  };

  const handleTroopChange = (player, category, index, field, value) => {
    setCurrentTroops(prev => {
      const newCategoryArray = [...prev[player][category]];
      newCategoryArray[index] = { ...newCategoryArray[index], [field]: value };
      return { ...prev, [player]: { ...prev[player], [category]: newCategoryArray } };
    });
  };

  const handleCopiaMemoria = () => {
    const memory = troopsMemory[selectedFormId];
    if (!memory || Object.keys(memory).length === 0) return alert("Nessuna memoria dell'ondata precedente trovata!");
    
    const newTroops = {};
    const newHeroes = {}; // <--- GESTIONE EROI

    Object.keys(currentTroops).forEach(p => {
      if (memory[p]) {
        newTroops[p] = {
          fant: memory[p].fant.map(t => ({ inviate: t.inviate, uccise: '', tier: t.tier || '' })),
          cav: memory[p].cav.map(t => ({ inviate: t.inviate, uccise: '', tier: t.tier || '' })),
          arc: memory[p].arc.map(t => ({ inviate: t.inviate, uccise: '', tier: t.tier || '' }))
        };
        newHeroes[p] = memory[p].eroi ? [...memory[p].eroi] : ['', '', ''];
      } else { 
        newTroops[p] = currentTroops[p]; 
        newHeroes[p] = currentHeroes[p] || ['', '', ''];
      }
    });
    
    setCurrentTroops(newTroops);
    setCurrentHeroes(newHeroes); // <--- APPLICAZIONE MEMORIA EROI
  };

  const handleSalvaReport = async () => {
    setLoading(true);
    const form = formations.find(f => f.id === selectedFormId);
    const players = [form.hostName, ...form.reinforcements];
    
    const reportGiocatori = players.map(p => {
      const playerDetails = activeRoster.find(r => (r.nome || r.name) === p);
      const pTroops = currentTroops[p];
      const sumField = (arr, field) => arr.reduce((acc, curr) => acc + (Number(curr[field]) || 0), 0);
      return {
        nome: p, 
        livelloTier: playerDetails ? (playerDetails.level || playerDetails.livello || '-') : '-', 
        punteggio: Number(currentScores[p]) || 0,
        truppeInviate: { fant: sumField(pTroops.fant, 'inviate'), cav: sumField(pTroops.cav, 'inviate'), arc: sumField(pTroops.arc, 'inviate') },
        truppeUccise: { fant: sumField(pTroops.fant, 'uccise'), cav: sumField(pTroops.cav, 'uccise'), arc: sumField(pTroops.arc, 'uccise') },
        dettaglioTruppe: { fant: pTroops.fant, cav: pTroops.cav, arc: pTroops.arc },
        eroi: currentHeroes[p] || ['', '', ''] // <--- SALVATAGGIO EROI
      };
    });

    const newMemoryForForm = {};
    players.forEach(p => {
      const pTroops = currentTroops[p];
      newMemoryForForm[p] = {
        fant: pTroops.fant.map(t => ({ inviate: t.inviate, uccise: '', tier: t.tier || '' })),
        cav: pTroops.cav.map(t => ({ inviate: t.inviate, uccise: '', tier: t.tier || '' })),
        arc: pTroops.arc.map(t => ({ inviate: t.inviate, uccise: '', tier: t.tier || '' })),
        eroi: currentHeroes[p] || ['', '', ''] // <--- MEMORIA EROI
      };
    });

    try {
      const docRef = doc(db, 'eventi_vichinghi', eventDate);
      const docSnap = await getDoc(docRef);
      const data = docSnap.exists() ? docSnap.data() : {};
      let ondate = data.ondate || [];
      const waveIndex = ondate.findIndex(o => o.livello === String(currentWave));
      
      if (waveIndex >= 0) {
        const filtrati = ondate[waveIndex].giocatori.filter(g => !players.includes(g.nome));
        ondate[waveIndex].giocatori = [...filtrati, ...reportGiocatori];
      } else {
        ondate.push({ livello: String(currentWave), datiNemico: {vFant:0, vCav:0, vArc:0}, giocatori: reportGiocatori });
      }
      ondate.sort((a, b) => Number(a.livello) - Number(b.livello));
      const updatedMemory = { ...troopsMemory, [selectedFormId]: newMemoryForForm };
      await setDoc(docRef, { ondate: ondate, lastWaveTroopsMemory: updatedMemory }, { merge: true });
      
      setSavedWaves(ondate); 
      setTroopsMemory(updatedMemory); 
      
      if (String(currentWave) === '1') {
         alert("Template Ondata 1 salvato!");
      }
      
      setCurrentScores({}); setCurrentTroops({}); setCurrentHeroes({}); setCurrentStep(2); 
    } catch (error) { alert("Errore salvataggio."); }
    setLoading(false);
  };

  const exportDatiVichinghi = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "eventi_vichinghi"));
      const eventi = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const jsonString = JSON.stringify(eventi, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a"); link.href = url; link.download = "storico_eventi_vichinghi.json";
      document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
    } catch (error) { alert("Errore esportazione."); }
  };

  // --- GESTIONE NUOVO OCR ---
  const handleCaricaPunteggi = (ondata, event) => {
    const file = event.target.files[0];
    if (file) setScoreFiles(prev => ({ ...prev, [ondata]: file }));
  };

  const handleCaricaTruppe = (ondata, event) => {
    const files = Array.from(event.target.files);
    setTroopFiles(prev => ({ ...prev, [ondata]: files }));
  };

  const avviaCreazioneReport = async () => {
    const ondateDaElaborare = [...new Set([...Object.keys(scoreFiles), ...Object.keys(troopFiles)])];
    
    if (ondateDaElaborare.length === 0) {
      return alert("Nessuna immagine caricata nelle caselle!");
    }
    
    let formIdDaUsare = selectedFormId;
    if (!formIdDaUsare && formations.length > 0) {
      formIdDaUsare = formations[0].id;
    }

    if (!formIdDaUsare || formations.length === 0) {
      return alert("Errore: Nessuna formazione trovata in memoria. Assicurati di aver creato almeno una formazione.");
    }

    const form = formations.find(f => f.id === formIdDaUsare);
    const playersTemplate = [form.hostName, ...form.reinforcements];
    const memory = troopsMemory[formIdDaUsare] || {};

    const appendLog = (msg) => setOcrProgress(prev => ({ ...prev, log: prev.log + msg }));

    setOcrProgress({ status: 'running', wave: 0, log: 'Avvio motore OCR modulare...\nPreparazione code in corso...\n' });

    for (const waveNum of ondateDaElaborare) {
      setOcrProgress(prev => ({ 
        status: 'running', 
        wave: waveNum, 
        log: prev.log + `\n=================================\n⏳ INIZIO SCANSIONE ONDATA ${waveNum}\n=================================\n` 
      }));

      const initialTroops = {};
      playersTemplate.forEach(p => {
         initialTroops[p] = {
            fant: memory[p]?.fant?.map(t => ({...t, uccise: ''})) || [{ inviate: '', uccise: '', tier: '' }],
            cav: memory[p]?.cav?.map(t => ({...t, uccise: ''})) || [{ inviate: '', uccise: '', tier: '' }],
            arc: memory[p]?.arc?.map(t => ({...t, uccise: ''})) || [{ inviate: '', uccise: '', tier: '' }]
         };
      });

      const waveScores = await estraiPunteggi(scoreFiles[waveNum], playersTemplate, appendLog);
      const waveTroops = await estraiTruppe(troopFiles[waveNum], playersTemplate, initialTroops, appendLog);

      appendLog(`💾 Salvataggio Ondata ${waveNum} sul database in corso...\n`);
      
      try {
        const reportGiocatori = playersTemplate.map(p => {
          const playerDetails = activeRoster.find(r => (r.nome || r.name) === p);
          const pTroops = waveTroops[p];
          const sumField = (arr, field) => arr.reduce((acc, curr) => acc + (Number(curr[field]) || 0), 0);
          
          return {
            nome: p, 
            livelloTier: playerDetails ? (playerDetails.level || playerDetails.livello || '-') : '-', 
            punteggio: Number(waveScores[p]) || 0,
            truppeInviate: { fant: sumField(pTroops.fant, 'inviate'), cav: sumField(pTroops.cav, 'inviate'), arc: sumField(pTroops.arc, 'inviate') },
            truppeUccise: { fant: sumField(pTroops.fant, 'uccise'), cav: sumField(pTroops.cav, 'uccise'), arc: sumField(pTroops.arc, 'uccise') },
            dettaglioTruppe: { fant: pTroops.fant, cav: pTroops.cav, arc: pTroops.arc },
            eroi: memory[p]?.eroi || ['', '', ''] // <--- INIEZIONE EROI NEL BATCH OCR
          };
        });

        const docRef = doc(db, 'eventi_vichinghi', eventDate);
        const docSnap = await getDoc(docRef);
        let data = docSnap.exists() ? docSnap.data() : {};
        let ondate = data.ondate || [];
        
        const waveIndex = ondate.findIndex(o => o.livello === String(waveNum));
        if (waveIndex >= 0) {
          const filtrati = ondate[waveIndex].giocatori.filter(g => !playersTemplate.includes(g.nome));
          ondate[waveIndex].giocatori = [...filtrati, ...reportGiocatori];
        } else {
          ondate.push({ livello: String(waveNum), datiNemico: {vFant:0, vCav:0, vArc:0}, giocatori: reportGiocatori });
        }
        ondate.sort((a, b) => Number(a.livello) - Number(b.livello));
        
        await setDoc(docRef, { ondate: ondate }, { merge: true });
        setSavedWaves(ondate);
        
        setScoreFiles(prev => { const newState = {...prev}; delete newState[waveNum]; return newState; });
        setTroopFiles(prev => { const newState = {...prev}; delete newState[waveNum]; return newState; });

        appendLog(`✅ Ondata ${waveNum} salvata con successo!\n`);

      } catch (firebaseError) {
        appendLog(`❌ ERRORE DATABASE ONDATA ${waveNum}: Non è stato possibile salvare.\n`);
      }
    }

    setOcrProgress(prev => ({ ...prev, status: 'done', log: prev.log + `\n🎉 TUTTE LE ONDATE IN CODA SONO STATE ELABORATE E SALVATE!` }));
  };

  // --- STILI CSS INLINE ---
  const inputStyle = { padding: '8px', borderRadius: '4px', backgroundColor: '#2a2a40', color: '#fff', border: '1px solid #555', width: '220px', textAlign: 'left' };
  const btnStyle = { padding: '10px 15px', borderRadius: '4px', backgroundColor: '#4CAF50', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold' };
  const chipStyle = { padding: '5px 10px', margin: '3px', borderRadius: '15px', backgroundColor: '#333', color: '#4fc3f7', border: '1px solid #4fc3f7', cursor: 'pointer', fontSize: '12px', display: 'inline-block' };

  // ==========================================
  // RENDER: WIZARD CLASSICO
  // ==========================================
  const renderWizard = () => (
    <div style={{ backgroundColor: '#1e1e2f', padding: '20px', borderRadius: '8px', color: '#fff' }}>
      
      {/* HEADER */}
      <div style={{ borderBottom: '1px solid #333', paddingBottom: '15px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, color: '#4fc3f7' }}>Wizard Inserimento Rapido</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          {currentStep > 0 && <div style={{ color: '#aaa', fontSize: '14px' }}>Evento attivo: <strong style={{color:'#fff'}}>{eventDate}</strong></div>}
          <button onClick={exportDatiVichinghi} style={{ padding: '6px 12px', borderRadius: '4px', backgroundColor: '#9C27B0', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
            ⬇️ Esporta Dati (JSON)
          </button>
        </div>
      </div>

      {loading && <div style={{ color: '#ffd54f', marginBottom: '20px' }}>Sincronizzazione in corso...</div>}

      {/* STEP 0 */}
      {currentStep === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '400px' }}>
          <div>
            <h3>Gestione Evento Vichinghi</h3>
            <p style={{ color: '#aaa', fontSize: '14px' }}>Seleziona un evento salvato in precedenza per riprenderne la compilazione, oppure creane uno nuovo.</p>
          </div>

          {!isNewEventMode ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={{ fontWeight: 'bold' }}>Eventi Salvati:</label>
              <select 
                value={selectedExistingEvent} 
                onChange={(e) => setSelectedExistingEvent(e.target.value)} 
                style={{ ...inputStyle, width: '100%', maxWidth: '350px' }}
              >
                <option value="">-- Scegli evento esistente --</option>
                {existingEvents.map(ev => (
                  <option key={ev.id} value={ev.id}>
                    {ev.dataEvento || 'Data ignota'} {ev.nomeEvento ? `- ${ev.nomeEvento}` : ''} {ev.ondate ? `(${ev.ondate.length} ondate)` : ''}
                  </option>
                ))}
              </select>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button 
                  style={{...btnStyle, backgroundColor: '#2196F3'}} 
                  onClick={handleLoadSelectedEvent}
                  disabled={!selectedExistingEvent}
                >
                  📂 Riprendi Selezionato
                </button>
                <button 
                  style={{...btnStyle, backgroundColor: '#555'}} 
                  onClick={() => setIsNewEventMode(true)}
                >
                  + Crea Nuovo Evento
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={{ fontWeight: 'bold', color: '#ffd54f' }}>Data Nuovo Evento:</label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#1e1e2f', color: '#fff' }} />
                <input type="text" placeholder="Nome salvataggio (es. Eroe Lvl 15)" value={eventName} onChange={(e) => setEventName(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#1e1e2f', color: '#fff', minWidth: '250px' }} />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button style={btnStyle} onClick={handleLoadSelectedEvent}>Conferma & Inizia</button>
                <button style={{...btnStyle, backgroundColor: '#555'}} onClick={() => setIsNewEventMode(false)}>⬅ Indietro</button>
              </div>
            </div>
          )}
          <div style={{ marginTop: '20px', borderTop: '1px solid #333', paddingTop: '15px' }}>
            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Roster di Riferimento:</label>
            <select value={selectedRosterId} onChange={handleRosterSelect} style={inputStyle}>
              <option value="">-- Seleziona un Roster --</option>
              {savedRosters.map(roster => ( <option key={roster.id} value={roster.id}>{roster.id}</option> ))}
            </select>
            {activeRoster.length > 0 && <span style={{ display: 'block', marginTop: '5px', color: '#4CAF50', fontSize: '12px' }}>✓ Caricati {activeRoster.length} giocatori</span>}
          </div>
        </div>
      )}

      {/* STEP 1 */}
      {currentStep === 1 && (
        <div>
          <h3>1. Gestione Formazioni (Evento: {eventDate})</h3>
          
          {activeRoster.length === 0 && (
             <div style={{ padding: '10px', backgroundColor: '#ff5252', color: '#fff', borderRadius: '4px', marginBottom: '15px', fontWeight: 'bold' }}>
                ⚠️ Attenzione: Non è stato caricato nessun Roster. Torna indietro ("Indietro alle opzioni") e assicurati che il Roster di Riferimento sia selezionato correttamente.
             </div>
          )}

          <div style={{ backgroundColor: '#2a2a40', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#ffd54f' }}>Nome Giocatore HOST</label>
              <input list="roster-list" type="text" value={newHost} onChange={e => setNewHost(e.target.value)} style={{...inputStyle, width: '100%', borderColor: '#ffd54f'}} placeholder="Cerca nel roster..." />
              <datalist id="roster-list">
                {activeRoster.map((player, idx) => <option key={idx} value={player.nome || player.name} />)}
              </datalist>
            </div>
            
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Rinforzi (separati da virgola)</label>
              <textarea value={newReinforcements} onChange={e => setNewReinforcements(e.target.value)} style={{...inputStyle, width: '100%', minHeight: '60px'}} />
            </div>
            
            <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#1a1a24', borderRadius: '4px' }}>
              <span style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '5px' }}>Aggiunta rapida:</span>
             {[...activeRoster]
  .sort((a, b) => (a.nome || a.name || '').localeCompare(b.nome || b.name || ''))
  .map((player, idx) => {
                  const nomeGiocatore = player.nome || player.name;
                  return (
                    <button key={idx} onClick={() => handleAddReinforcementClick(nomeGiocatore)} style={chipStyle}>
                      + {nomeGiocatore}
                    </button>
                  );
              })}
            </div>
            
            <button style={{...btnStyle, backgroundColor: '#2196F3', width: '100%'}} onClick={addFormation}>+ Salva Questa Formazione</button>
          </div>
          {formations.length > 0 && ( <button style={btnStyle} onClick={() => setCurrentStep(2)}>Vai all'inserimento dati ➡</button> )}
        </div>
      )}

      {/* STEP 2 */}
      {currentStep === 2 && (
        <div>
          <h3>2. Seleziona Ondata e Formazione</h3>
          <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px' }}>Livello Ondata</label>
              <input type="number" min="1" max="20" value={currentWave} onChange={e => setCurrentWave(e.target.value)} style={{...inputStyle, width: '100px'}} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px' }}>Seleziona Formazione</label>
              <select value={selectedFormId} onChange={e => setSelectedFormId(e.target.value)} style={{ ...inputStyle, width: '250px' }}>
                <option value="">-- Scegli un team --</option>
                {formations.map(f => ( <option key={f.id} value={f.id}>Team {f.hostName}</option> ))}
              </select>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
            <button style={{...btnStyle, backgroundColor: '#555'}} onClick={() => setCurrentStep(1)}>Modifica Formazioni</button>
            <button style={btnStyle} onClick={handleProceedToScores}>Inserisci Punteggi (Fase 1)</button>
          </div>

          <div style={{ marginTop: '20px', backgroundColor: '#2a2438', padding: '15px', borderRadius: '8px', border: '1px solid #9c27b0', maxWidth: '400px' }}>
             <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#bbb' }}>Vuoi saltare l'inserimento manuale e usare l'importazione massiva?</p>
             <button 
               onClick={() => setActiveView('batch-ocr')}
               style={{ backgroundColor: '#9c27b0', color: 'white', padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', width: '100%' }}
             >
               🤖 Apri Importatore Massivo OCR
             </button>
          </div>
        </div>
      )}

      {/* STEP 3 */}
      {currentStep === 3 && (
        <div>
          <h3>3. Inserimento Punteggi (Fase 1) - Ondata {currentWave}</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', textAlign: 'left', maxWidth: '600px' }}>
            <thead><tr style={{ borderBottom: '1px solid #444' }}><th style={{ padding: '10px' }}>Giocatore</th><th style={{ padding: '10px' }}>Punteggio</th></tr></thead>
            <tbody>
              {Object.keys(currentScores).map((player, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #333' }}>
                  <td style={{ padding: '10px', color: idx === 0 ? '#ffd54f' : '#fff' }}>{player} {idx === 0 && "(HOST)"}</td>
                  <td style={{ padding: '10px' }}><input type="number" value={currentScores[player] !== undefined ? currentScores[player] : ''} onChange={e => handleScoreChange(player, e.target.value)} style={{...inputStyle, width: '120px'}} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button style={{...btnStyle, backgroundColor: '#555', marginRight: '10px'}} onClick={() => setCurrentStep(2)}>Indietro</button>
          <button style={btnStyle} onClick={handleAvantiPunteggi}>Avanti: Inserisci Truppe</button>
        </div>
      )}

     {/* STEP 4 */}
      {currentStep === 4 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
             <div>
                <h3 style={{ margin: '0 0 5px 0' }}>4. Inserimento Truppe ed Eroi - Ondata {currentWave}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <p style={{ color: '#aaa', fontSize: '14px', margin: 0 }}>Crea qui il template della prima ondata.</p>
                  <button onClick={handleCopiaMemoria} style={{ padding: '4px 10px', backgroundColor: '#2196F3', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                    🔄 Applica formazione Ondata Precedente
                  </button>
                </div>
             </div>
             <div>
                <button style={{...btnStyle, backgroundColor: '#555', marginRight: '10px'}} onClick={() => setCurrentStep(3)}>Indietro</button>
                <button style={{...btnStyle, backgroundColor: '#4CAF50'}} onClick={handleSalvaReport}>Salva Formazione ➡</button>
             </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {Object.keys(currentTroops).map((player, idx) => (
              <div key={idx} style={{ backgroundColor: '#242435', padding: '15px', borderRadius: '8px', borderLeft: idx === 0 ? '4px solid #ffd54f' : '4px solid #4fc3f7' }}>
                <h4 style={{ marginTop: 0, marginBottom: '10px', color: idx === 0 ? '#ffd54f' : '#fff', fontSize: '18px' }}>
                  {player} {idx === 0 && "(HOST)"} <span style={{ color: '#aaa', fontSize: '14px', marginLeft: '10px' }}>| Punti: {currentScores[player] || 0}</span>
                </h4>
                
                {/* --- SEZIONE EROI --- */}
                <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', alignItems: 'center' }}>
                    <span style={{color: '#aaa', fontSize: '12px', fontWeight: 'bold'}}>🦸 Eroi:</span>
                    {[0, 1, 2].map(heroIdx => (
                        <input 
                            key={heroIdx}
                            type="text" 
                            placeholder={`Eroe ${heroIdx + 1}`} 
                            value={currentHeroes[player]?.[heroIdx] || ''} 
                            onChange={e => handleHeroChange(player, heroIdx, e.target.value)} 
                            style={{ padding: '6px', borderRadius: '4px', backgroundColor: '#1a1a24', color: '#fff', border: '1px solid #444', width: '120px', fontSize: '12px' }} 
                        />
                    ))}
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '15px' }}>
                  {[ { key: 'fant', label: 'Fanteria (Fant)', color: '#4CAF50' }, { key: 'cav', label: 'Cavalleria (Cav)', color: '#2196F3' }, { key: 'arc', label: 'Arcieri (Arc)', color: '#9C27B0' } ].map(cat => (
                    <div key={cat.key} style={{ backgroundColor: '#1a1a24', padding: '10px', borderRadius: '6px', borderTop: `2px solid ${cat.color}` }}>
                      <div style={{ color: cat.color, fontWeight: 'bold', marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                        {cat.label}
                        <button onClick={() => handleAddTroopRow(player, cat.key)} style={{ background: 'none', border: 'none', color: cat.color, cursor: 'pointer', fontWeight: 'bold' }}>+ Riga</button>
                      </div>
                      
                   <div style={{ display: 'flex', gap: '5px', marginBottom: '5px', color: '#888', fontSize: '12px', paddingLeft: '2px' }}>
                      <div style={{ flex: 1 }}>Tier</div>
                      <div style={{ flex: 1 }}>Inviate</div>
                      <div style={{ flex: 1 }}>Uccise</div>
                      <div style={{ width: '24px' }}></div>
                  </div>

                  {(currentTroops[player]?.[cat.key] || []).map((row, rIdx) => (
                    <div key={rIdx} style={{ display: 'flex', gap: '5px', marginBottom: '8px', alignItems: 'center' }}>
                      <select value={row.tier || ''} onChange={e => handleTroopChange(player, cat.key, rIdx, 'tier', e.target.value)} style={{ padding: '8px', borderRadius: '4px', backgroundColor: '#2a2a40', color: '#fff', border: '1px solid #555', width: '100%', borderColor: '#b2ebf2' }}>
                        <option value="">--</option>
                        {['TG6', 'TG5', 'TG4', 'TG3', 'TG2', 'TG1', '30', '29', '28', '27', '26', '25'].map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <input type="number" placeholder="Inv." value={row.inviate} onChange={e => handleTroopChange(player, cat.key, rIdx, 'inviate', e.target.value)} style={{ padding: '8px', borderRadius: '4px', backgroundColor: '#2a2a40', color: '#fff', border: '1px solid #555', width: '100%', borderColor: '#4fc3f7', textAlign: 'right' }} />
                      
                      <input type="number" placeholder="Ucc." value={row.uccise} onChange={e => handleTroopChange(player, cat.key, rIdx, 'uccise', e.target.value)} style={{ padding: '8px', borderRadius: '4px', backgroundColor: '#2a2a40', color: '#fff', border: '1px solid #555', width: '100%', borderColor: '#ff5252', textAlign: 'right', fontWeight: 'bold' }} />
                      
                      <button onClick={() => handleRemoveTroopRow(player, cat.key, rIdx)} style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#333', color: '#ff5252', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                    </div>
                  ))}
                    </div>
                  ))}

                </div>
              </div>
            ))}
          </div>
          
          <div style={{ marginTop: '20px', textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '15px' }}>
            <button style={{...btnStyle, backgroundColor: '#4CAF50', padding: '12px 24px', fontSize: '16px'}} onClick={handleSalvaReport}>Salva su Firebase</button>
            <button style={{...btnStyle, backgroundColor: '#9c27b0', padding: '12px 24px', fontSize: '16px'}} onClick={() => setActiveView('batch-ocr')}>Vai all'Importatore OCR ➡</button>
          </div>
        </div>
      )}
    </div>
  );

  // ==========================================
  // RENDER: IMPORTATORE MASSIVO OCR
  // ==========================================
  const renderBatchOcr = () => (
    <div style={{ padding: '20px', backgroundColor: '#1a1a24', color: '#fff', borderRadius: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #333', paddingBottom: '20px', marginBottom: '30px' }}>
        <h2 style={{ margin: 0, color: '#4fc3f7', fontSize: '28px' }}>🚀 Importatore Massivo OCR</h2>
        <button 
          onClick={() => setActiveView('wizard')}
          style={{ backgroundColor: 'transparent', color: '#aaa', border: '1px solid #aaa', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer' }}
        >
          ⬅ Torna al Wizard
        </button>
      </div>
      
      <p style={{ fontSize: '16px', color: '#ccc', marginBottom: '30px' }}>
        Carica gli screenshot nei rispettivi box. L'intelligenza spaziale gestirà i punteggi, il radar fuzzy gestirà le truppe.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
        {[...Array(20)].map((_, i) => {
          const numeroOndata = i + 1;
          const filePunteggio = scoreFiles[numeroOndata];
          const fileTruppeCaricati = troopFiles[numeroOndata] ? troopFiles[numeroOndata].length : 0;
          
          return (
            <div key={numeroOndata} style={{ backgroundColor: '#2a2a35', padding: '15px', borderRadius: '8px', border: (filePunteggio || fileTruppeCaricati > 0) ? '1px solid #4caf50' : '1px solid #4fc3f7' }}>
              <h3 style={{ marginTop: '0', color: (filePunteggio || fileTruppeCaricati > 0) ? '#4caf50' : '#4fc3f7', borderBottom: '1px solid #444', paddingBottom: '10px' }}>Ondata {numeroOndata}</h3>
              
              {/* BOX PUNTEGGI */}
              <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#1e1e2f', borderRadius: '6px' }}>
                <label style={{display: 'block', fontSize: '13px', color: '#ffd54f', marginBottom: '5px', fontWeight: 'bold'}}>🏆 Foto Punteggi (1 file)</label>
                <input type="file" accept="image/*" onChange={(e) => handleCaricaPunteggi(numeroOndata, e)} style={{ width: '100%', color: '#fff', fontSize: '12px' }} />
                <div style={{ fontSize: '12px', color: filePunteggio ? '#4caf50' : '#aaa', marginTop: '5px' }}>
                  {filePunteggio ? `✅ 1 File caricato` : 'Nessun file'}
                </div>
              </div>

              {/* BOX TRUPPE */}
              <div style={{ padding: '10px', backgroundColor: '#1e1e2f', borderRadius: '6px' }}>
                <label style={{display: 'block', fontSize: '13px', color: '#4fc3f7', marginBottom: '5px', fontWeight: 'bold'}}>⚔️ Foto Truppe (Multipli)</label>
                <input type="file" multiple accept="image/*" onChange={(e) => handleCaricaTruppe(numeroOndata, e)} style={{ width: '100%', color: '#fff', fontSize: '12px' }} />
                <div style={{ fontSize: '12px', color: fileTruppeCaricati > 0 ? '#4caf50' : '#aaa', marginTop: '5px' }}>
                  {fileTruppeCaricati > 0 ? `✅ ${fileTruppeCaricati} file caricati` : 'Nessun file'}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ textAlign: 'center', marginTop: '50px', paddingBottom: '30px' }}>
        {ocrProgress.status === 'idle' || ocrProgress.status === 'done' ? (
          <button onClick={avviaCreazioneReport} style={{ backgroundColor: '#4caf50', color: '#fff', padding: '20px 50px', fontSize: '22px', fontWeight: 'bold', borderRadius: '10px', border: 'none', cursor: 'pointer', boxShadow: '0 4px 15px rgba(76, 175, 80, 0.4)' }}>
            ⚙️ CREA REPORT {ocrProgress.status === 'done' ? '(Avvia Nuova Coda)' : '(Avvia OCR)'}
          </button>
        ) : (
          <div style={{ color: '#ffd54f', fontSize: '20px', fontWeight: 'bold', marginBottom: '20px' }}>
            ⚙️ Elaborazione in corso... Non chiudere la pagina! (Ondata {ocrProgress.wave})
          </div>
        )}

        {ocrProgress.log && (
          <div style={{ marginTop: '30px', textAlign: 'left', maxWidth: '800px', margin: '30px auto 0 auto' }}>
             <h4 style={{ color: '#4fc3f7', margin: '0 0 10px 0' }}>Terminale OCR:</h4>
             <textarea value={ocrProgress.log} readOnly style={{ width: '100%', height: '300px', backgroundColor: '#0a0a0f', color: '#4CAF50', border: '1px solid #444', padding: '15px', fontFamily: 'monospace', fontSize: '13px', borderRadius: '8px' }} />
          </div>
        )}
      </div>
    </div>
  );
  return (
    <>
      {activeView === 'wizard' ? renderWizard() : renderBatchOcr()}
    </>
  );
}