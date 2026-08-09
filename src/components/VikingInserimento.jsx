import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next'; // 🌍 Import i18n
import { db } from '../firebase';
import { collection, addDoc, updateDoc, getDoc, getDocs, doc } from 'firebase/firestore'; 
import VikingImporter from './VikingImporter'; 
import VikingWizard from './VikingWizard'; 

export default function VikingInserimento({ eventi, fetchEventi, setActiveView, roster }) {
  const { t } = useTranslation(); // 🌍 Hook traduzione
  const [showImporter, setShowImporter] = useState(false); 
  const [showWizard, setShowWizard] = useState(false); 
  const [showJsonImporter, setShowJsonImporter] = useState(false);

  const [jsonInput, setJsonInput] = useState('');
  const [targetEventId, setTargetEventId] = useState('nuovo');
  const [nuovoNomeEvento, setNuovoNomeEvento] = useState('');
  
  const [nomeRosterUsato, setNomeRosterUsato] = useState('locale');
  const [cloudRosterNames, setCloudRosterNames] = useState([]);

  useEffect(() => {
    const fetchCloudRostersList = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "rosters"));
        const names = [];
        querySnapshot.forEach((doc) => { names.push(doc.id); });
        setCloudRosterNames(names);
      } catch (error) {
        console.error("Errore nel recupero dei roster dal cloud:", error);
      }
    };
    fetchCloudRostersList();
  }, []);

  const handleJsonImport = async () => {
    try {
      const parsedData = JSON.parse(jsonInput);
      let activeRoster = Array.isArray(roster) ? roster : [];

      if (nomeRosterUsato && nomeRosterUsato !== 'locale') {
        try {
          const rosterDocSnap = await getDoc(doc(db, "rosters", nomeRosterUsato));
          if (rosterDocSnap.exists() && rosterDocSnap.data().players) {
            activeRoster = rosterDocSnap.data().players;
          }
        } catch (err) {
          console.warn("Impossibile caricare il roster dal cloud, fallback su quello locale.", err);
        }
      }
      
      const rosterMap = activeRoster.reduce((acc, player) => {
        if (player.name && player.level) acc[player.name] = player.level;
        return acc;
      }, {});
      
      if (parsedData.ondate && Array.isArray(parsedData.ondate)) {
        parsedData.ondate.forEach(ondata => {
          if (ondata.giocatori && Array.isArray(ondata.giocatori)) {
            ondata.giocatori.forEach(g => {
              if (rosterMap[g.nome]) g.livelloTier = String(rosterMap[g.nome]);
              else if (!g.livelloTier) g.livelloTier = t('viking_inserimento.unknown'); 
            });
          }
        });
      }
      
      if (targetEventId === 'nuovo') {
        const dataToSave = {
          ...parsedData,
          nomeEvento: nuovoNomeEvento || t('viking_inserimento.default_event_name'),
          rosterRiferimento: nomeRosterUsato === 'locale' ? t('viking_inserimento.default_roster') : nomeRosterUsato,
          dataEvento: parsedData.dataEvento || new Date().toISOString().split('T')[0]
        };
        await addDoc(collection(db, "eventi_vichinghi"), dataToSave);
        alert(t('viking_inserimento.alert_new_success'));
      } else {
        const eventoEsistente = eventi.find(e => e.id === targetEventId);
        if (!eventoEsistente) throw new Error("Evento di destinazione non trovato");

        let ondateAggiornate = [...(eventoEsistente.ondate || [])];
        if (parsedData.ondate && Array.isArray(parsedData.ondate)) {
          ondateAggiornate = [...ondateAggiornate, ...parsedData.ondate];
          ondateAggiornate.sort((a, b) => a.livello - b.livello);
        }
        await updateDoc(doc(db, "eventi_vichinghi", targetEventId), { ondate: ondateAggiornate });
        alert(t('viking_inserimento.alert_add_success'));
      }
      
      setJsonInput('');
      setNuovoNomeEvento('');
      setNomeRosterUsato('locale');
      setShowJsonImporter(false);
      fetchEventi();
      setActiveView('analisi');
    } catch (error) {
      console.error("Errore nell'importazione:", error);
      alert(t('viking_inserimento.alert_json_error'));
    }
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <h1 style={{ marginTop: 0, marginBottom: '20px' }}>{t('viking_inserimento.title')}</h1>
      
      {!showImporter && !showWizard && !showJsonImporter && (
        <div style={{ display: 'flex', gap: '20px', marginTop: '30px' }}>
          <button onClick={() => setShowImporter(true)} style={{ padding: '20px', backgroundColor: '#4CAF50', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '18px', fontWeight: 'bold', flex: 1, boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>
            {t('viking_inserimento.btn_excel')}
          </button>
          <button onClick={() => setShowWizard(true)} style={{ padding: '20px', backgroundColor: '#2196F3', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '18px', fontWeight: 'bold', flex: 1, boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>
            {t('viking_inserimento.btn_wizard')}
          </button>
          <button onClick={() => setShowJsonImporter(true)} style={{ padding: '20px', backgroundColor: '#9C27B0', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '18px', fontWeight: 'bold', flex: 1, boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>
            {t('viking_inserimento.btn_json')}
          </button>
        </div>
      )}

      {showImporter && (
        <div>
          <button onClick={() => setShowImporter(false)} style={{ marginBottom: '20px', padding: '10px 15px', backgroundColor: '#555', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            {t('viking_inserimento.btn_back')}
          </button>
          <VikingImporter onImportSuccess={() => { fetchEventi(); setShowImporter(false); setActiveView('analisi'); }} />
        </div>
      )}

      {showWizard && (
        <div>
          <button onClick={() => setShowWizard(false)} style={{ marginBottom: '20px', padding: '10px 15px', backgroundColor: '#555', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            {t('viking_inserimento.btn_back')}
          </button>
          <VikingWizard onComplete={() => { fetchEventi(); setShowWizard(false); setActiveView('analisi'); }} />
        </div>
      )}

      {showJsonImporter && (
        <div>
          <button onClick={() => setShowJsonImporter(false)} style={{ marginBottom: '20px', padding: '10px 15px', backgroundColor: '#555', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            {t('viking_inserimento.btn_back')}
          </button>
          
          <div style={{ backgroundColor: '#1e1e2f', padding: '20px', borderRadius: '8px' }}>
            <h3 style={{ marginTop: 0, color: '#9C27B0' }}>{t('viking_inserimento.json_title')}</h3>
            
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '20px' }}>
              <div>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>{t('viking_inserimento.data_destination')}</label>
                <select value={targetEventId} onChange={(e) => setTargetEventId(e.target.value)} style={{ padding: '10px 15px', borderRadius: '4px', backgroundColor: '#2a2a40', color: '#fff', border: '1px solid #555', width: '300px' }}>
                  <option value="nuovo">{t('viking_inserimento.new_event')}</option>
                  <optgroup label={t('viking_inserimento.add_existing')}>
                    {eventi.map(ev => <option key={ev.id} value={ev.id}>{ev.dataEvento} {ev.nomeEvento ? `- ${ev.nomeEvento}` : ''}</option>)}
                  </optgroup>
                </select>
              </div>

              {targetEventId === 'nuovo' && (
                <>
                  <div>
                    <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>{t('viking_inserimento.event_name_opt')}</label>
                    <input type="text" value={nuovoNomeEvento} onChange={(e) => setNuovoNomeEvento(e.target.value)} placeholder={t('viking_inserimento.event_name_ph')} style={{ padding: '10px 15px', borderRadius: '4px', backgroundColor: '#2a2a40', color: '#fff', border: '1px solid #555', width: '250px' }} />
                  </div>

                  <div>
                    <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>{t('viking_inserimento.reference_roster')}</label>
                    <select value={nomeRosterUsato} onChange={(e) => setNomeRosterUsato(e.target.value)} style={{ padding: '10px 15px', borderRadius: '4px', backgroundColor: '#2a2a40', color: '#fff', border: '1px solid #555', width: '250px' }}>
                      <option value="locale">{t('viking_inserimento.local_roster')}</option>
                      {cloudRosterNames.map(name => <option key={name} value={name}>☁️ {name}</option>)}
                    </select>
                  </div>
                </>
              )}
            </div>

            <textarea value={jsonInput} onChange={(e) => setJsonInput(e.target.value)} placeholder={t('viking_inserimento.json_ph')} style={{ width: '100%', height: '300px', backgroundColor: '#121212', color: '#00FF00', fontFamily: 'monospace', padding: '15px', borderRadius: '4px', border: '1px solid #444', marginBottom: '20px', boxSizing: 'border-box' }} />
            <button onClick={handleJsonImport} disabled={!jsonInput.trim()} style={{ padding: '12px 24px', backgroundColor: '#4CAF50', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}>
              {targetEventId === 'nuovo' ? t('viking_inserimento.btn_save_new') : t('viking_inserimento.btn_add_existing')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}