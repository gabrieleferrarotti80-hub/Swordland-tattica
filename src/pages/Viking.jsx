import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore'; 
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next'; // 🌍 Import i18n

// Importiamo i sottomoduli
import VikingAnalisiSingolo from '../components/VikingAnalisiSingolo';
import VikingConfronto from '../components/VikingConfronto';
import VikingInserimento from '../components/VikingInserimento';
// AGGIUNTO: Importazione del nuovo simulatore
import VikingSimulator from '../components/VikingSimulator';

export default function Viking({ roster }) {
  const { t } = useTranslation(); // 🌍 Hook di traduzione
  const [eventi, setEventi] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [datiEvento, setDatiEvento] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [activeView, setActiveView] = useState('analisi');
  const [analisiTab, setAnalisiTab] = useState('singolo');
  
  const navigate = useNavigate();

 const fetchEventi = async (isSilent = false) => {
    if (!isSilent) {
      setLoading(true); 
    }
    try {
      console.log(`🔄 [Viking] Richiesta fetchEventi da Firebase ${isSilent ? "(In Background)..." : "..."}`);
      const querySnapshot = await getDocs(collection(db, "eventi_vichinghi"));
      const listaEventi = [];
      querySnapshot.forEach((doc) => {
        listaEventi.push({ id: doc.id, ...doc.data() });
      });
      
      listaEventi.sort((a, b) => {
        const valA = String(a.dataEvento || a.id);
        const valB = String(b.dataEvento || b.id);
        return valB.localeCompare(valA); 
      });
      
      setEventi(listaEventi);
      
      if (listaEventi.length > 0) {
        setSelectedEventId((currentId) => {
          const currentSelected = currentId ? listaEventi.find(e => e.id === currentId) : null;
          
          if (currentSelected) {
            setDatiEvento(currentSelected); 
            return currentId; 
          } else {
            setDatiEvento(listaEventi[0]);
            return listaEventi[0].id; 
          }
        });
      } else {
        setSelectedEventId('');
        setDatiEvento(null);
      }
    } catch (error) {
      console.error("❌ [Viking] Errore nel caricamento eventi:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEventi();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectChange = (e) => {
    const eventId = e.target.value;
    setSelectedEventId(eventId);
    const eventoTrovato = eventi.find(ev => ev.id === eventId);
    setDatiEvento(eventoTrovato || null);
  };

  if (loading) return <div style={{ color: 'white', padding: '20px' }}>{t('viking.loading_history')}</div>;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#121212', color: '#fff' }}>
      
      {/* SIDEBAR LATERALE */}
      <div style={{ width: '260px', backgroundColor: '#1e1e2f', borderRight: '1px solid #333', display: 'flex', flexDirection: 'column', padding: '20px', boxShadow: '2px 0 5px rgba(0,0,0,0.5)' }}>
        <button onClick={() => navigate('/')} style={{ padding: '8px 15px', backgroundColor: '#333', color: '#fff', border: '1px solid #555', cursor: 'pointer', fontWeight: 'bold', borderRadius: '4px', marginBottom: '20px' }}>{t('viking.back_home')}</button>
        <h2 style={{ margin: '0 0 30px 0', color: '#4CAF50', textAlign: 'center' }}>{t('viking.dashboard_title')}<br/>{t('viking.dashboard_subtitle')}</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          
          <button onClick={() => setActiveView('analisi')} style={{ padding: '12px 20px', borderRadius: '6px', backgroundColor: activeView === 'analisi' ? '#4CAF50' : 'transparent', color: '#fff', border: activeView === 'analisi' ? 'none' : '1px solid #4CAF50', cursor: 'pointer', fontWeight: 'bold', textAlign: 'left' }}>{t('viking.btn_analysis')}</button>
          
          <button onClick={() => setActiveView('simulatore')} style={{ padding: '12px 20px', borderRadius: '6px', backgroundColor: activeView === 'simulatore' ? '#9C27B0' : 'transparent', color: '#fff', border: activeView === 'simulatore' ? 'none' : '1px solid #9C27B0', cursor: 'pointer', fontWeight: 'bold', textAlign: 'left' }}>{t('viking.btn_simulator')}</button>

          <button onClick={() => setActiveView('inserimento')} style={{ padding: '12px 20px', borderRadius: '6px', backgroundColor: activeView === 'inserimento' ? '#2196F3' : 'transparent', color: '#fff', border: activeView === 'inserimento' ? 'none' : '1px solid #2196F3', cursor: 'pointer', fontWeight: 'bold', textAlign: 'left' }}>{t('viking.btn_insert')}</button>
        </div>
      </div>

      {/* AREA CONTENUTO PRINCIPALE */}
      <div style={{ flex: 1, padding: '30px', overflowY: 'auto' }}>
        
       {activeView === 'analisi' && (
          <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
            <h1 style={{ marginTop: 0, marginBottom: '20px' }}>{t('viking.analysis_title')}</h1>
            
            <div style={{ display: 'flex', gap: '15px', marginBottom: '30px', borderBottom: '2px solid #333', paddingBottom: '15px' }}>
              <button onClick={() => setAnalisiTab('singolo')} style={{ padding: '10px 20px', borderRadius: '4px', backgroundColor: analisiTab === 'singolo' ? '#4CAF50' : '#2a2a40', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>{t('viking.tab_single')}</button>
              <button onClick={() => setAnalisiTab('confronto')} style={{ padding: '10px 20px', borderRadius: '4px', backgroundColor: analisiTab === 'confronto' ? '#FF9800' : '#2a2a40', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>{t('viking.tab_compare')}</button>
            </div>

           {analisiTab === 'singolo' && (
              <VikingAnalisiSingolo 
                eventi={eventi} 
                datiEvento={datiEvento} 
                selectedEventId={selectedEventId} 
                handleSelectChange={handleSelectChange} 
                fetchEventi={fetchEventi}
              />
            )}

            {analisiTab === 'confronto' && (
              <VikingConfronto eventi={eventi} />
            )}

          </div>
        )}

        {activeView === 'simulatore' && (
          <VikingSimulator 
            eventi={eventi} 
            datiEvento={datiEvento} 
          />
        )}

        {activeView === 'inserimento' && (
          <VikingInserimento 
            eventi={eventi} 
            fetchEventi={fetchEventi} 
            setActiveView={setActiveView} 
            roster={roster} 
          />
        )}
      </div>
    </div>
  );
}