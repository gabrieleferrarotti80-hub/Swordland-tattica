import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next'; // 🌍 Import i18n
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';

export default function VikingWaveEditor({ eventoId, eventData, waveIndex, onSave, onClose }) {
  const { t } = useTranslation(); // 🌍 Hook traduzione
  const [wave, setWave] = useState(JSON.parse(JSON.stringify(eventData.ondate[waveIndex])));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (eventData && eventData.ondate && eventData.ondate[waveIndex]) {
      setWave(JSON.parse(JSON.stringify(eventData.ondate[waveIndex])));
    }
  }, [eventData, waveIndex]);

  const handleEnemyChange = (field, subfield, value) => {
    setWave(prev => {
      const newWave = { ...prev };
      if (subfield) {
        newWave[field] = { ...newWave[field], [subfield]: Number(value) || 0 };
      } else {
        newWave[field] = Number(value) || 0;
      }
      return newWave;
    });
  };

  const handlePlayerChange = (pIndex, field, value) => {
    setWave(prev => {
      const newWave = { ...prev };
      newWave.giocatori[pIndex][field] = value;
      return newWave;
    });
  };

  const handleHeroChange = (pIndex, hIndex, value) => {
    setWave(prev => {
      const newWave = { ...prev };
      if (!newWave.giocatori[pIndex].eroi) newWave.giocatori[pIndex].eroi = ['', '', ''];
      newWave.giocatori[pIndex].eroi[hIndex] = value;
      return newWave;
    });
  };

  const handleTroopChange = (pIndex, category, tIndex, field, value) => {
    setWave(prev => {
      const newWave = { ...prev };
      newWave.giocatori[pIndex].dettaglioTruppe[category][tIndex][field] = value;
      return newWave;
    });
  };

  const handleAddTroopRow = (pIndex, category) => {
    setWave(prev => {
      const newWave = { ...prev };
      if (!newWave.giocatori[pIndex].dettaglioTruppe) newWave.giocatori[pIndex].dettaglioTruppe = { fant: [], cav: [], arc: [] };
      if (!newWave.giocatori[pIndex].dettaglioTruppe[category]) newWave.giocatori[pIndex].dettaglioTruppe[category] = [];
      newWave.giocatori[pIndex].dettaglioTruppe[category].push({ inviate: '', uccise: '', tier: '' });
      return newWave;
    });
  };

  const handleRemoveTroopRow = (pIndex, category, tIndex) => {
    setWave(prev => {
      const newWave = { ...prev };
      newWave.giocatori[pIndex].dettaglioTruppe[category].splice(tIndex, 1);
      return newWave;
    });
  };

  const handleSaveWave = async () => {
    try {
      console.log("🔥 [VikingWaveEditor] Inizio procedura di salvataggio mirato...");
      setIsSaving(true);
      
      const sumField = (arr, field) => (arr || []).reduce((acc, curr) => acc + (curr ? (Number(curr[field]) || 0) : 0), 0);
      
      const giocatoriAggiornati = wave.giocatori.map(p => {
        const pTroops = p.dettaglioTruppe || { fant: [], cav: [], arc: [] };
        return {
          ...p,
          punteggio: Number(p.punteggio) || 0,
          truppeInviate: { fant: sumField(pTroops.fant, 'inviate'), cav: sumField(pTroops.cav, 'inviate'), arc: sumField(pTroops.arc, 'inviate') },
          truppeUccise: { fant: sumField(pTroops.fant, 'uccise'), cav: sumField(pTroops.cav, 'uccise'), arc: sumField(pTroops.arc, 'uccise') }
        };
      });

      const ondataDaSalvare = { ...wave, giocatori: giocatoriAggiornati };
      const ondataOriginale = eventData.ondate[waveIndex]; 

      const giocatoriModificati = new Set();
      
      ondataDaSalvare.giocatori.forEach((pMod, pIndex) => {
        const pOrig = ondataOriginale.giocatori[pIndex]; 
        
        if (!pOrig) {
          giocatoriModificati.add(pIndex);
          return;
        }

        let isCambiato = false;

        if (pMod.nome !== pOrig.nome) isCambiato = true;
        if (JSON.stringify(pMod.eroi) !== JSON.stringify(pOrig.eroi)) isCambiato = true;

        ['fant', 'cav', 'arc'].forEach(cat => {
          const truppeMod = pMod.dettaglioTruppe?.[cat] || [];
          const truppeOrig = pOrig.dettaglioTruppe?.[cat] || [];

          if (truppeMod.length !== truppeOrig.length) {
            isCambiato = true;
          } else {
            for (let i = 0; i < truppeMod.length; i++) {
              if (
                Number(truppeMod[i].inviate) !== Number(truppeOrig[i].inviate) || 
                truppeMod[i].tier !== truppeOrig[i].tier ||
                Number(truppeMod[i].uccise) !== Number(truppeOrig[i].uccise) 
              ) {
                isCambiato = true;
              }
            }
          }
        });

        if (isCambiato) {
          giocatoriModificati.add(pIndex);
        }
      });

      const newOndate = JSON.parse(JSON.stringify(eventData.ondate));
      newOndate[waveIndex] = ondataDaSalvare;

      if (giocatoriModificati.size > 0) {
        for (let i = waveIndex + 1; i < newOndate.length; i++) {
          const ondataSucc = newOndate[i];
          
          ondataSucc.giocatori = ondataSucc.giocatori.map((pSucc, pIndex) => {
            if (!giocatoriModificati.has(pIndex)) {
              return pSucc; 
            }

            const pEditato = ondataDaSalvare.giocatori[pIndex];
            if (!pEditato) return pSucc;

            const nuovoDettaglio = { fant: [], cav: [], arc: [] };
            
            ['fant', 'cav', 'arc'].forEach(cat => {
              const truppeEditate = pEditato.dettaglioTruppe?.[cat] || [];
              const truppeOriginaliSucc = pSucc.dettaglioTruppe?.[cat] || [];
              
              nuovoDettaglio[cat] = truppeEditate.map((tEdit, tIdx) => {
                let matchTier = truppeOriginaliSucc.find(tOrig => tOrig.tier === tEdit.tier);
                let tSuccBase = matchTier || truppeOriginaliSucc[tIdx] || { inviate: 0, uccise: '' };
                
                let inviateEdit = Number(tEdit.inviate) || 0;
                let inviateSucc = Number(tSuccBase.inviate) || 0;

                let inviateCorrette;

                if (pIndex === 0) {
                  inviateCorrette = inviateEdit;
                } else {
                  inviateCorrette = (inviateSucc > inviateEdit || inviateSucc === 0) ? inviateEdit : inviateSucc;
                }

                return {
                  inviate: inviateCorrette,
                  tier: tEdit.tier,       
                  uccise: tSuccBase.uccise 
                };
              });
            });

            return {
              ...pSucc,
              nome: pEditato.nome,
              dettaglioTruppe: nuovoDettaglio,
              truppeInviate: { fant: sumField(nuovoDettaglio.fant, 'inviate'), cav: sumField(nuovoDettaglio.cav, 'inviate'), arc: sumField(nuovoDettaglio.arc, 'inviate') },
              truppeUccise: { fant: sumField(nuovoDettaglio.fant, 'uccise'), cav: sumField(nuovoDettaglio.cav, 'uccise'), arc: sumField(nuovoDettaglio.arc, 'uccise') },
              eroi: pEditato.eroi ? [...pEditato.eroi] : pSucc.eroi 
            };
          });
        }
      }

      await setDoc(doc(db, 'eventi_vichinghi', eventoId), { ondate: newOndate }, { merge: true });
      
      alert(t('viking_editor.alert_save_success'));

      if (onSave) onSave(); 
      if (onClose) onClose(); 

    } catch (error) {
      console.error("❌ [VikingWaveEditor] Errore di salvataggio:", error);
      alert(`${t('viking_editor.alert_save_error')} ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const inputStyle = { padding: '6px', borderRadius: '4px', backgroundColor: '#1a1a24', color: '#fff', border: '1px solid #555', fontSize: '13px' };

  return (
    <div style={{ backgroundColor: '#2a2a40', padding: '20px', borderRadius: '8px', border: '2px solid #FF9800', marginBottom: '40px', boxShadow: '0 0 15px rgba(255, 152, 0, 0.3)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #444', paddingBottom: '15px', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, color: '#FF9800' }}>{t('viking_editor.title', { lvl: wave.livello })}</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onClose} style={{ padding: '8px 15px', backgroundColor: '#555', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>{t('viking_editor.cancel')}</button>
          <button onClick={handleSaveWave} disabled={isSaving} style={{ padding: '8px 15px', backgroundColor: '#4CAF50', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            {isSaving ? t('viking_editor.saving') : t('viking_editor.save_changes')}
          </button>
        </div>
      </div>

      <div style={{ backgroundColor: '#1e1e2f', padding: '15px', borderRadius: '6px', marginBottom: '20px' }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#b2ebf2' }}>{t('viking_editor.enemy_data')}</h4>
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#aaa', marginBottom: '3px' }}>{t('viking_editor.total_enemies')}</label>
            <input type="number" value={wave.nemiciTotali || ''} onChange={e => handleEnemyChange('nemiciTotali', null, e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#aaa', marginBottom: '3px' }}>{t('viking_editor.infantry')}</label>
            <input type="number" value={wave.dettagliNemici?.fant || ''} onChange={e => handleEnemyChange('dettagliNemici', 'fant', e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#aaa', marginBottom: '3px' }}>{t('viking_editor.cavalry')}</label>
            <input type="number" value={wave.dettagliNemici?.cav || ''} onChange={e => handleEnemyChange('dettagliNemici', 'cav', e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#aaa', marginBottom: '3px' }}>{t('viking_editor.archers')}</label>
            <input type="number" value={wave.dettagliNemici?.arc || ''} onChange={e => handleEnemyChange('dettagliNemici', 'arc', e.target.value)} style={inputStyle} />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {wave.giocatori.map((p, pIndex) => (
          <div key={pIndex} style={{ backgroundColor: '#1e1e2f', padding: '15px', borderRadius: '6px', borderLeft: pIndex === 0 ? '4px solid #ffd54f' : '4px solid #4fc3f7' }}>
            
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap' }}>
              <input type="text" value={p.nome || ''} onChange={e => handlePlayerChange(pIndex, 'nome', e.target.value)} style={{...inputStyle, fontWeight: 'bold', fontSize: '15px', width: '150px'}} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ fontSize: '12px', color: '#888' }}>{t('viking_editor.global_tier')}</span>
                <input type="text" value={p.livelloTier || ''} onChange={e => handlePlayerChange(pIndex, 'livelloTier', e.target.value)} style={{...inputStyle, width: '60px'}} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ fontSize: '12px', color: '#888' }}>{t('viking_editor.ocr_points')}</span>
                <input type="number" value={p.punteggio || 0} onChange={e => handlePlayerChange(pIndex, 'punteggio', e.target.value)} style={{...inputStyle, width: '100px', borderColor: '#ffd54f'}} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', alignItems: 'center' }}>
                <span style={{color: '#aaa', fontSize: '12px', fontWeight: 'bold'}}>{t('viking_editor.heroes')}</span>
                {[0, 1, 2].map(hIndex => (
                    <input 
                        key={hIndex} type="text" placeholder={t('viking_editor.hero_ph', { num: hIndex + 1 })} 
                        value={p.eroi?.[hIndex] || ''} 
                        onChange={e => handleHeroChange(pIndex, hIndex, e.target.value)} 
                        style={{ ...inputStyle, width: '120px' }} 
                    />
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '15px' }}>
              {[ { key: 'fant', label: t('viking_editor.infantry'), color: '#4CAF50' }, { key: 'cav', label: t('viking_editor.cavalry'), color: '#2196F3' }, { key: 'arc', label: t('viking_editor.archers'), color: '#9C27B0' } ].map(cat => (
                <div key={cat.key} style={{ backgroundColor: '#1a1a24', padding: '10px', borderRadius: '6px', borderTop: `2px solid ${cat.color}` }}>
                  <div style={{ color: cat.color, fontWeight: 'bold', marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                    {cat.label}
                    <button onClick={() => handleAddTroopRow(pIndex, cat.key)} style={{ background: 'none', border: 'none', color: cat.color, cursor: 'pointer', fontWeight: 'bold' }}>{t('viking_editor.btn_add_row')}</button>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '5px', marginBottom: '5px', color: '#888', fontSize: '11px', paddingLeft: '2px' }}>
                      <div style={{ flex: 1 }}>{t('viking_editor.tier')}</div>
                      <div style={{ flex: 1 }}>{t('viking_editor.sent')}</div>
                      <div style={{ flex: 1 }}>{t('viking_editor.killed')}</div>
                      <div style={{ width: '20px' }}></div>
                  </div>

                  {(p.dettaglioTruppe?.[cat.key] || []).map((row, tIndex) => (
                    <div key={tIndex} style={{ display: 'flex', gap: '5px', marginBottom: '8px', alignItems: 'center' }}>
                      <select value={row.tier || ''} onChange={e => handleTroopChange(pIndex, cat.key, tIndex, 'tier', e.target.value)} style={{ ...inputStyle, width: '100%' }}>
                        <option value="">--</option>
                        {['TG6', 'TG5', 'TG4', 'TG3', 'TG2', 'TG1', '30', '29', '28', '27', '26', '25'].map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <input type="number" value={row.inviate} onChange={e => handleTroopChange(pIndex, cat.key, tIndex, 'inviate', e.target.value)} style={{ ...inputStyle, width: '100%', borderColor: '#4fc3f7' }} />
                      <input type="number" value={row.uccise} onChange={e => handleTroopChange(pIndex, cat.key, tIndex, 'uccise', e.target.value)} style={{ ...inputStyle, width: '100%', borderColor: '#ff5252' }} />
                      <button onClick={() => handleRemoveTroopRow(pIndex, cat.key, tIndex)} style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#333', color: '#ff5252', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            
          </div>
        ))}
      </div>
    </div>
  );
}