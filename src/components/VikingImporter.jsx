import { useState } from 'react';
import { useTranslation } from 'react-i18next'; // 🌍 Import i18n
import { VIKING_WAVES } from '../utils/vikingConfig'; 
import { db } from '../firebase'; 
import { doc, setDoc } from 'firebase/firestore'; 

export default function VikingImporter({ onImportSuccess }) { 
  const { t } = useTranslation(); // 🌍 Hook traduzione
  const [rawData, setRawData] = useState(''); 
  const [parsedBattles, setParsedBattles] = useState([]); 
  const [dataEvento, setDataEvento] = useState(''); 

  const handleImport = () => {
    const lines = rawData.split('\n'); 
    let currentBattle = null; 
    const battles = []; 

    lines.forEach(line => { 
      if (!line.trim()) return; 

      const cells = line.split('\t').map(cell => cell.trim().replace(/,/g, '')); 
      if (cells.length < 3) return; 

      const firstCellStr = String(cells[0]).trim();
      const firstCellNum = parseInt(firstCellStr, 10); 
      
      const isWaveRow = !isNaN(firstCellNum) 
                        && firstCellNum >= 1 
                        && firstCellNum <= 20 
                        && firstCellStr === firstCellNum.toString();

      if (isWaveRow && cells.length > 8) { 
        currentBattle = { 
          livello: firstCellNum, 
          datiNemico: VIKING_WAVES[firstCellNum] || { vFant: 0, vCav: 0, vArc: 0 }, 
          giocatori: [] 
        };
        battles.push(currentBattle); 
      } 
      
      else if (
        currentBattle && 
        firstCellStr !== '' && 
        firstCellStr.toLowerCase() !== 'alleato' && 
        firstCellStr.toLowerCase() !== 'livello' && 
        firstCellStr !== '0' && 
        !isWaveRow
      ) { 
        
        const giocatore = { 
          nome: firstCellStr, 
          livelloTier: cells[1] ? String(cells[1]).trim().toUpperCase() : '-', 
          truppeInviate: { 
            fant: parseInt(cells[2], 10) || 0, 
            cav: parseInt(cells[3], 10) || 0, 
            arc: parseInt(cells[4], 10) || 0, 
          },
          truppeUccise: { 
            fant: parseInt(cells[5], 10) || 0, 
            cav: parseInt(cells[6], 10) || 0, 
            arc: parseInt(cells[7], 10) || 0, 
          },
          punteggio: parseInt(String(cells[10]).replace(/\./g, ''), 10) || 0 
        };
        
        if (giocatore.truppeInviate.fant > 0 || giocatore.truppeInviate.cav > 0 || giocatore.truppeInviate.arc > 0) { 
           currentBattle.giocatori.push(giocatore); 
        }
      }
    });

    const ondateValide = battles.filter(ondata => ondata.giocatori.length > 0);

    setParsedBattles(ondateValide); 
    alert(t('viking_importer.alert_found', { count: ondateValide.length })); 
  };

  const handleSaveToFirestore = async () => {
    if (!dataEvento) {
      alert(t('viking_importer.alert_date_req'));
      return;
    }
    
    const conferma = window.confirm(t('viking_importer.confirm_overwrite', { date: dataEvento }));
    if (!conferma) return;

    const payload = {
      dataEvento: dataEvento,
      totaleScontri: parsedBattles.length,
      ondate: parsedBattles,
      ultimoAggiornamento: new Date().toISOString()
    };

    try {
      const docRef = doc(db, "eventi_vichinghi", dataEvento);
      await setDoc(docRef, payload);
      
      alert(t('viking_importer.alert_success'));
      
      setParsedBattles([]); 
      setRawData('');
      setDataEvento('');
      
      if (onImportSuccess) {
        onImportSuccess();
      }
    } catch (error) {
      console.error("Errore nel salvataggio:", error);
      alert(t('viking_importer.alert_error'));
    }
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#1e1e2f', color: '#fff', borderRadius: '8px', maxWidth: '800px', margin: '20px auto' }}>
      <h2>{t('viking_importer.title')}</h2>
      <p>{t('viking_importer.subtitle')}</p>
      
      <textarea 
        style={{ width: '100%', height: '150px', backgroundColor: '#2a2a40', color: '#fff', border: '1px solid #444', padding: '10px', marginBottom: '10px' }}
        value={rawData}
        onChange={(e) => setRawData(e.target.value)}
        placeholder={t('viking_importer.placeholder')}
      />
      
      <button 
        onClick={handleImport}
        style={{ padding: '10px 20px', backgroundColor: '#4CAF50', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold', borderRadius: '4px' }}
      >
        {t('viking_importer.btn_analyze')}
      </button>

      {parsedBattles.length > 0 && (
        <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#2a2a40', borderRadius: '4px', border: '1px solid #444' }}>
          <h3 style={{ color: '#4CAF50', marginBottom: '15px' }}>{t('viking_importer.ready_title')}</h3>
          <p dangerouslySetInnerHTML={{ __html: t('viking_importer.found_battles', { count: parsedBattles.length }) }} />
          
          <div style={{ margin: '20px 0' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: '#aaa' }}>{t('viking_importer.event_date')}</label>
            <input 
              type="date" 
              value={dataEvento}
              onChange={(e) => setDataEvento(e.target.value)}
              style={{ padding: '8px', borderRadius: '4px', backgroundColor: '#1e1e2f', color: '#fff', border: '1px solid #555' }}
            />
          </div>
          
          <button 
            onClick={handleSaveToFirestore}
            style={{ padding: '10px 20px', backgroundColor: '#2196F3', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold', borderRadius: '4px' }}
          >
            {t('viking_importer.btn_save')}
          </button>
        </div>
      )}
    </div>
  );
}