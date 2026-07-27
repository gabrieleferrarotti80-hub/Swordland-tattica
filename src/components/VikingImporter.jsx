import { useState } from 'react';
import { VIKING_WAVES } from '../utils/vikingConfig'; 
import { db } from '../firebase'; 
import { doc, setDoc } from 'firebase/firestore'; 

export default function VikingImporter({ onImportSuccess }) { 
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
      
      // Aggiunto "livello" alle parole chiave da ignorare per evitare falsi giocatori
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
          // L'indice 10 è confermato. Rimuoviamo eventuali punti delle migliaia
          punteggio: parseInt(String(cells[10]).replace(/\./g, ''), 10) || 0 
        };
        
        if (giocatore.truppeInviate.fant > 0 || giocatore.truppeInviate.cav > 0 || giocatore.truppeInviate.arc > 0) { 
           currentBattle.giocatori.push(giocatore); 
        }
      }
    });

    const ondateValide = battles.filter(ondata => ondata.giocatori.length > 0);

    setParsedBattles(ondateValide); 
    alert(`Trovati ${ondateValide.length} scontri validi pronti per il salvataggio.`); 
  };

  const handleSaveToFirestore = async () => {
    if (!dataEvento) {
      alert("Seleziona una data per l'evento!");
      return;
    }
    
    const conferma = window.confirm(`Stai per salvare i dati per la data ${dataEvento}. Se esiste già un evento per questa data, verrà sovrascritto. Vuoi procedere?`);
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
      
      alert("Evento salvato con successo!");
      
      setParsedBattles([]); 
      setRawData('');
      setDataEvento('');
      
      if (onImportSuccess) {
        onImportSuccess();
      }
    } catch (error) {
      console.error("Errore nel salvataggio:", error);
      alert("Si è verificato un errore durante il salvataggio.");
    }
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#1e1e2f', color: '#fff', borderRadius: '8px', maxWidth: '800px', margin: '20px auto' }}>
      <h2>Importatore Storico Vichinghi</h2>
      <p>Copia i blocchi da Excel (comprese le intestazioni) e incollali qui sotto:</p>
      
      <textarea 
        style={{ width: '100%', height: '150px', backgroundColor: '#2a2a40', color: '#fff', border: '1px solid #444', padding: '10px', marginBottom: '10px' }}
        value={rawData}
        onChange={(e) => setRawData(e.target.value)}
        placeholder="Incolla qui le righe da Excel..."
      />
      
      <button 
        onClick={handleImport}
        style={{ padding: '10px 20px', backgroundColor: '#4CAF50', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold', borderRadius: '4px' }}
      >
        Analizza Dati Excel
      </button>

      {parsedBattles.length > 0 && (
        <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#2a2a40', borderRadius: '4px', border: '1px solid #444' }}>
          <h3 style={{ color: '#4CAF50', marginBottom: '15px' }}>Dati Pronti per il Salvataggio</h3>
          <p>Trovati <strong>{parsedBattles.length}</strong> scontri validi.</p>
          
          <div style={{ margin: '20px 0' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: '#aaa' }}>Data dell'evento Vichinghi:</label>
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
            Salva Storico su Firestore
          </button>
        </div>
      )}
    </div>
  );
}