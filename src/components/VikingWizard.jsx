import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';

export default function VikingWizard({ onComplete }) {
  // --- STATI GLOBALI ---
  const [currentStep, setCurrentStep] = useState(0);
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [formations, setFormations] = useState([]);
  const [troopsMemory, setTroopsMemory] = useState({});
  const [currentWave, setCurrentWave] = useState(1);
  const [savedWaves, setSavedWaves] = useState([]);
  
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
  const [loading, setLoading] = useState(false);

  // Caricamento iniziale: Roster ed Eventi già salvati su Firebase
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // 1. Carica i Roster
        const rosterSnapshot = await getDocs(collection(db, "rosters"));
        const listaRosters = rosterSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setSavedRosters(listaRosters);

        // 2. Carica la lista degli Eventi Vichinghi esistenti
        const eventsSnapshot = await getDocs(collection(db, "eventi_vichinghi"));
        const listaEventi = eventsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Ordina dal più recente al più vecchio
        listaEventi.sort((a, b) => new Date(b.dataEvento || b.id) - new Date(a.dataEvento || a.id));
        setExistingEvents(listaEventi);

      } catch (error) {
        console.error("Errore nel caricamento dati da Firebase:", error);
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

  // --- STEP 0: CARICAMENTO EVENTO SCELTO DALLA TENDINA O NUOVO ---
  const handleLoadSelectedEvent = async () => {
    const targetDate = isNewEventMode ? eventDate : selectedExistingEvent;
    
    if (!targetDate) {
      alert("Seleziona un evento esistente o inserisci una data valida.");
      return;
    }

    setLoading(true);
    setEventDate(targetDate);

    try {
      const docRef = doc(db, 'eventi_vichinghi', targetDate);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        console.log("🔥 EVENTO TROVATO:", targetDate, data);
        
        setFormations(data.formations || []);
        setTroopsMemory(data.lastWaveTroopsMemory || {});
        setSavedWaves(data.ondate || []);
        
        // Se l'evento ha già delle formazioni salvate, salta direttamente all'inserimento (Step 2)
        // Altrimenti manda alla creazione formazioni (Step 1)
        setCurrentStep(data.formations && data.formations.length > 0 ? 2 : 1);
      } else {
        console.warn("⚠️ Evento non esistente, lo creo ex-novo:", targetDate);
        await setDoc(docRef, { dataEvento: targetDate, ondate: [], formations: [], lastWaveTroopsMemory: {} });
        setSavedWaves([]);
        setCurrentStep(1);
      }
    } catch (error) {
      console.error("Errore di connessione a Firebase:", error);
      alert("Errore durante l'accesso al database.");
    }
    setLoading(false);
  };

  // --- STEP 1: GESTIONE FORMAZIONI ---
  const [newHost, setNewHost] = useState('');
  const [newReinforcements, setNewReinforcements] = useState('');

  const handleAddReinforcementClick = (nameToAdd) => {
    setNewReinforcements(prev => {
      if (prev.includes(nameToAdd)) return prev;
      return prev ? `${prev}, ${nameToAdd}` : nameToAdd;
    });
  };

  const addFormation = async () => {
    if (!newHost) return;
    const reinfs = newReinforcements.split(',').map(r => r.trim()).filter(r => r !== '');
    const newForm = { id: `form_${Date.now()}`, hostName: newHost, reinforcements: reinfs };
    const updatedFormations = [...formations, newForm];
    setFormations(updatedFormations);
    setNewHost('');
    setNewReinforcements('');
    await setDoc(doc(db, 'eventi_vichinghi', eventDate), { formations: updatedFormations }, { merge: true });
  };

  // --- TRANSIZIONI FASI E PUNTEGGI ---
  const handleScoreChange = (player, value) => {
    setCurrentScores(prev => ({
      ...prev,
      [player]: value
    }));
  };

  const handleProceedToScores = () => {
    if (!selectedFormId) return alert("Seleziona una formazione!");
    const form = formations.find(f => f.id === selectedFormId);
    const players = [form.hostName, ...form.reinforcements];
    
    const ondataEsistente = savedWaves.find(w => w.livello === String(currentWave));

    const newScores = {};
    players.forEach(p => {
      const datiGiocatore = ondataEsistente?.giocatori?.find(g => g.nome === p);
      
      if (datiGiocatore && datiGiocatore.punteggio !== undefined) {
         newScores[p] = datiGiocatore.punteggio; 
      } else {
         newScores[p] = currentScores[p] !== undefined ? currentScores[p] : ''; 
      }
    });

    setCurrentScores(newScores);
    setCurrentStep(3);
  };

  const handleAvantiPunteggi = () => {
    const memory = troopsMemory[selectedFormId] || {};
    const form = formations.find(f => f.id === selectedFormId);
    const players = [form.hostName, ...form.reinforcements];
    
    const initialTroops = {};
    players.forEach(p => {
      initialTroops[p] = {
        fant: memory[p]?.fant || [{ inviate: '', uccise: '' }],
        cav: memory[p]?.cav || [{ inviate: '', uccise: '' }],
        arc: memory[p]?.arc || [{ inviate: '', uccise: '' }],
      };
    });

    setCurrentTroops(initialTroops);
    setCurrentStep(4);
  };

  // --- LOGICA RIGHE DINAMICHE TRUPPE ---
  const handleAddTroopRow = (player, category) => {
    setCurrentTroops(prev => ({
      ...prev,
      [player]: {
        ...prev[player],
        [category]: [...prev[player][category], { inviate: '', uccise: '' }]
      }
    }));
  };

  const handleRemoveTroopRow = (player, category, index) => {
    setCurrentTroops(prev => {
      const newArr = [...prev[player][category]];
      newArr.splice(index, 1);
      return {
        ...prev,
        [player]: {
          ...prev[player],
          [category]: newArr.length > 0 ? newArr : [{ inviate: '', uccise: '' }] 
        }
      };
    });
  };

  const handleTroopChange = (player, category, index, field, value) => {
    setCurrentTroops(prev => {
      const newArr = [...prev[player][category]];
      newArr[index] = { ...newArr[index], [field]: value };
      return {
        ...prev,
        [player]: {
          ...prev[player],
          [category]: newArr
        }
      };
    });
  };

  // --- SALVATAGGIO REPORT FINALE ---
  const handleSalvaReport = async () => {
    setLoading(true);
    const form = formations.find(f => f.id === selectedFormId);
    const players = [form.hostName, ...form.reinforcements];

    const reportGiocatori = players.map(p => {
      const playerDetails = activeRoster.find(rosterPlayer => rosterPlayer.name === p);
      const pTroops = currentTroops[p];
      const sumField = (arr, field) => arr.reduce((acc, curr) => acc + (Number(curr[field]) || 0), 0);

      return {
        nome: p,
        livelloTier: playerDetails ? playerDetails.level : '-',
        punteggio: Number(currentScores[p]) || 0,
        truppeInviate: {
          fant: sumField(pTroops.fant, 'inviate'),
          cav: sumField(pTroops.cav, 'inviate'),
          arc: sumField(pTroops.arc, 'inviate'),
        },
        truppeUccise: {
          fant: sumField(pTroops.fant, 'uccise'),
          cav: sumField(pTroops.cav, 'uccise'),
          arc: sumField(pTroops.arc, 'uccise'),
        }
      };
    });

    const newMemoryForForm = {};
    players.forEach(p => {
      const pTroops = currentTroops[p];
      newMemoryForForm[p] = {
        fant: pTroops.fant.map(t => ({ inviate: t.inviate, uccise: '' })),
        cav: pTroops.cav.map(t => ({ inviate: t.inviate, uccise: '' })),
        arc: pTroops.arc.map(t => ({ inviate: t.inviate, uccise: '' }))
      };
    });

    try {
      const docRef = doc(db, 'eventi_vichinghi', eventDate);
      const docSnap = await getDoc(docRef);
      const data = docSnap.data();
      
      let ondate = data.ondate || [];
      const waveIndex = ondate.findIndex(o => o.livello === String(currentWave));
      
      if (waveIndex >= 0) {
        ondate[waveIndex].giocatori = [...ondate[waveIndex].giocatori, ...reportGiocatori];
      } else {
        ondate.push({ livello: String(currentWave), datiNemico: {vFant:0, vCav:0, vArc:0}, giocatori: reportGiocatori });
      }

      const updatedMemory = { ...troopsMemory, [selectedFormId]: newMemoryForForm };
      await setDoc(docRef, { ondate: ondate, lastWaveTroopsMemory: updatedMemory }, { merge: true });

      setSavedWaves(ondate);
      setTroopsMemory(updatedMemory);
      setCurrentScores({});
      setCurrentTroops({});
      setCurrentStep(2); 

    } catch (error) {
      console.error("Errore salvataggio report:", error);
      alert("Si è verificato un errore durante il salvataggio.");
    }
    setLoading(false);
  };

  // --- STILI ---
  const inputStyle = { padding: '8px', borderRadius: '4px', backgroundColor: '#2a2a40', color: '#fff', border: '1px solid #555', width: '220px', textAlign: 'left' };
  const btnStyle = { padding: '10px 15px', borderRadius: '4px', backgroundColor: '#4CAF50', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold' };
  const chipStyle = { padding: '5px 10px', margin: '3px', borderRadius: '15px', backgroundColor: '#333', color: '#4fc3f7', border: '1px solid #4fc3f7', cursor: 'pointer', fontSize: '12px', display: 'inline-block' };
  // --- ESPORTAZIONE DATI IN JSON ---
  const exportDatiVichinghi = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "eventi_vichinghi"));
      const eventi = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const jsonString = JSON.stringify(eventi, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = url;
      link.download = "storico_eventi_vichinghi.json";
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log("Esportazione JSON completata!");
    } catch (error) {
      console.error("Errore durante l'esportazione:", error);
      alert("Errore durante l'esportazione dei dati.");
    }
  };

 return (
    <div style={{ backgroundColor: '#1e1e2f', padding: '20px', borderRadius: '8px', color: '#fff' }}>
      
      <div style={{ borderBottom: '1px solid #333', paddingBottom: '15px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, color: '#4fc3f7' }}>Wizard Inserimento Rapido</h2>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          {currentStep > 0 && <div style={{ color: '#aaa', fontSize: '14px' }}>Evento attivo: <strong style={{color:'#fff'}}>{eventDate}</strong></div>}
          
          {/* Pulsante di esportazione inserito qui! */}
          <button 
            onClick={exportDatiVichinghi} 
            style={{ padding: '6px 12px', borderRadius: '4px', backgroundColor: '#9C27B0', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
          >
            ⬇️ Esporta Dati (JSON)
          </button>
        </div>
      </div>

      {loading && <div style={{ color: '#ffd54f', marginBottom: '20px' }}>Sincronizzazione in corso...</div>}

      {/* STEP 0: SCELTA EVENTO DA MENU A TENDINA O NUOVO */}
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
                style={inputStyle}
              >
                <option value="">-- Scegli evento esistente --</option>
                {existingEvents.map(ev => (
                  <option key={ev.id} value={ev.id}>
                    Evento del {ev.dataEvento || ev.id} {ev.ondate ? `(${ev.ondate.length} ondate inserite)` : ''}
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
              <input 
                type="date" 
                value={eventDate} 
                onChange={(e) => setEventDate(e.target.value)} 
                style={inputStyle} 
              />

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button style={btnStyle} onClick={handleLoadSelectedEvent}>Conferma & Inizia</button>
                <button style={{...btnStyle, backgroundColor: '#555'}} onClick={() => setIsNewEventMode(false)}>⬅ Indietro</button>
              </div>
            </div>
          )}

          {/* Selezione Roster di supporto */}
          <div style={{ marginTop: '20px', borderTop: '1px solid #333', paddingTop: '15px' }}>
            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Roster di Riferimento:</label>
            <select value={selectedRosterId} onChange={handleRosterSelect} style={inputStyle}>
              <option value="">-- Seleziona un Roster --</option>
              {savedRosters.map(roster => (
                <option key={roster.id} value={roster.id}>{roster.id} {roster.nomeRoster ? `(${roster.nomeRoster})` : ''}</option>
              ))}
            </select>
            {activeRoster.length > 0 && <span style={{ display: 'block', marginTop: '5px', color: '#4CAF50', fontSize: '12px' }}>✓ Caricati {activeRoster.length} giocatori dal roster</span>}
          </div>
        </div>
      )}

      {/* STEP 1: GESTIONE FORMAZIONI */}
      {currentStep === 1 && (
        <div>
          <h3>1. Gestione Formazioni (Evento: {eventDate})</h3>
          <div style={{ backgroundColor: '#2a2a40', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#ffd54f' }}>Nome Giocatore HOST</label>
              <input list="roster-list" type="text" value={newHost} onChange={e => setNewHost(e.target.value)} style={{...inputStyle, width: '100%', textAlign: 'left', borderColor: '#ffd54f'}} placeholder="Cerca nel roster..." />
              <datalist id="roster-list">{activeRoster.map((player, idx) => <option key={idx} value={player.name} />)}</datalist>
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Rinforzi (separati da virgola)</label>
              <textarea value={newReinforcements} onChange={e => setNewReinforcements(e.target.value)} style={{...inputStyle, width: '100%', textAlign: 'left', minHeight: '60px'}} />
            </div>
            <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#1a1a24', borderRadius: '4px' }}>
              <span style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '5px' }}>Aggiunta rapida (clicca per inserire nei Rinforzi):</span>
              {activeRoster.filter(p => p.isParticipating).map((player, idx) => (
                <button key={idx} onClick={() => handleAddReinforcementClick(player.name)} style={chipStyle}>+ {player.name}</button>
              ))}
            </div>
            <button style={{...btnStyle, backgroundColor: '#2196F3', width: '100%'}} onClick={addFormation}>+ Salva Questa Formazione</button>
          </div>
          {formations.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <button style={btnStyle} onClick={() => setCurrentStep(2)}>Vai all'inserimento dati ➡</button>
            </div>
          )}
        </div>
      )}

      {/* STEP 2: SELEZIONE FORMAZIONE E ONDATA */}
      {currentStep === 2 && (
        <div>
          <h3>2. Seleziona Ondata e Formazione</h3>
          <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px' }}>Livello Ondata</label>
              <input type="number" min="1" max="20" value={currentWave} onChange={e => setCurrentWave(e.target.value)} style={{...inputStyle, width: '100px', textAlign: 'right'}} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px' }}>Seleziona Formazione</label>
              <select value={selectedFormId} onChange={e => setSelectedFormId(e.target.value)} style={{ ...inputStyle, width: '250px' }}>
                <option value="">-- Scegli un team --</option>
                {formations.map(f => (
                  <option key={f.id} value={f.id}>Team {f.hostName}</option>
                ))}
              </select>
            </div>
          </div>
          <button style={{...btnStyle, backgroundColor: '#555', marginRight: '10px'}} onClick={() => setCurrentStep(1)}>Modifica Formazioni</button>
          <button style={btnStyle} onClick={handleProceedToScores}>Inserisci Punteggi (Fase 1)</button>
        </div>
      )}

      {/* STEP 3: PUNTEGGI */}
      {currentStep === 3 && (
        <div>
          <h3>3. Inserimento Punteggi (Fase 1) - Ondata {currentWave}</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', textAlign: 'left', maxWidth: '600px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #444' }}>
                <th style={{ padding: '10px' }}>Giocatore</th>
                <th style={{ padding: '10px' }}>Punteggio</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(currentScores).map((player, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #333' }}>
                  <td style={{ padding: '10px', fontWeight: idx === 0 ? 'bold' : 'normal', color: idx === 0 ? '#ffd54f' : '#fff' }}>
                    {player} {idx === 0 && "(HOST)"}
                  </td>
                  <td style={{ padding: '10px' }}>
                    <input type="number" value={currentScores[player] !== undefined ? currentScores[player] : ''} onChange={e => handleScoreChange(player, e.target.value)} style={{...inputStyle, width: '120px', textAlign: 'right'}} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button style={{...btnStyle, backgroundColor: '#555', marginRight: '10px'}} onClick={() => setCurrentStep(2)}>Indietro</button>
          <button style={btnStyle} onClick={handleAvantiPunteggi}>Avanti: Inserisci Truppe</button>
        </div>
      )}

      {/* STEP 4: TRUPPE (Schede Dinamiche) */}
      {currentStep === 4 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
             <div>
                <h3 style={{ margin: '0 0 5px 0' }}>4. Inserimento Truppe - Ondata {currentWave}</h3>
                <p style={{ color: '#aaa', fontSize: '14px', margin: 0 }}>Le truppe inviate sono precompilate dalla memoria dell'ondata precedente. Modificale in caso di feriti.</p>
             </div>
             <div>
                <button style={{...btnStyle, backgroundColor: '#555', marginRight: '10px'}} onClick={() => setCurrentStep(3)}>Indietro</button>
                <button style={{...btnStyle, backgroundColor: '#ff9800'}} onClick={handleSalvaReport}>Salva Report ➡</button>
             </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {Object.keys(currentTroops).map((player, idx) => (
              <div key={idx} style={{ backgroundColor: '#242435', padding: '15px', borderRadius: '8px', borderLeft: idx === 0 ? '4px solid #ffd54f' : '4px solid #4fc3f7' }}>
                <h4 style={{ marginTop: 0, marginBottom: '15px', color: idx === 0 ? '#ffd54f' : '#fff', fontSize: '18px' }}>
                  {player} {idx === 0 && "(HOST)"} <span style={{ color: '#aaa', fontSize: '14px', marginLeft: '10px' }}>| Punti: {currentScores[player] || 0}</span>
                </h4>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '15px' }}>
                  
                  {[
                    { key: 'fant', label: 'Fanteria (Fant)', color: '#4CAF50' },
                    { key: 'cav', label: 'Cavalleria (Cav)', color: '#2196F3' },
                    { key: 'arc', label: 'Arcieri (Arc)', color: '#9C27B0' }
                  ].map(cat => (
                    <div key={cat.key} style={{ backgroundColor: '#1a1a24', padding: '10px', borderRadius: '6px', borderTop: `2px solid ${cat.color}` }}>
                      <div style={{ color: cat.color, fontWeight: 'bold', marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                        {cat.label}
                        <button onClick={() => handleAddTroopRow(player, cat.key)} style={{ background: 'none', border: 'none', color: cat.color, cursor: 'pointer', fontWeight: 'bold' }}>+ Riga</button>
                      </div>
                      
                     <div style={{ display: 'flex', gap: '5px', marginBottom: '5px', color: '#888', fontSize: '12px', paddingLeft: '2px' }}>
                        <div style={{ flex: 1 }}>Inviate</div>
                        <div style={{ flex: 1 }}>Uccise</div>
                        <div style={{ width: '24px' }}></div>
                      </div>

                      {(currentTroops[player]?.[cat.key] || []).map((row, rIdx) => (
                        <div key={rIdx} style={{ display: 'flex', gap: '5px', marginBottom: '8px', alignItems: 'center' }}>
                          <input 
                            type="number" 
                            placeholder="Inv." 
                            value={row.inviate} 
                            onChange={e => handleTroopChange(player, cat.key, rIdx, 'inviate', e.target.value)} 
                            style={{ padding: '8px', borderRadius: '4px', backgroundColor: '#2a2a40', color: '#fff', border: '1px solid #555', width: '100%', borderColor: '#4fc3f7', textAlign: 'right' }} 
                          />
                          <input 
                            type="number" 
                            placeholder="Ucc." 
                            value={row.uccise} 
                            onChange={e => handleTroopChange(player, cat.key, rIdx, 'uccise', e.target.value)} 
                            style={{ padding: '8px', borderRadius: '4px', backgroundColor: '#2a2a40', color: '#fff', border: '1px solid #555', width: '100%', borderColor: '#ff5252', textAlign: 'right' }} 
                          />
                          <button 
                            onClick={() => handleRemoveTroopRow(player, cat.key, rIdx)}
                            style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#333', color: '#ff5252', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            title="Rimuovi Riga"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  ))}

                </div>
              </div>
            ))}
          </div>
          
          <div style={{ marginTop: '20px', textAlign: 'right' }}>
            <button style={{...btnStyle, backgroundColor: '#ff9800', padding: '12px 24px', fontSize: '16px'}} onClick={handleSalvaReport}>Salva Report e Torna a Selezione ➡</button>
          </div>
        </div>
      )}
    </div>
  );
}