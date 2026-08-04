import React, { useMemo } from 'react';

// MATRICE FISSA DEI NEMICI 
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

export const VikingEngagementRules = ({ datiEvento }) => {
  const analisiIngaggio = useMemo(() => {
    if (!datiEvento || !datiEvento.ondate) return [];

    return datiEvento.ondate.map(ondata => {
      const liv = ondata.livello;
      const orda = COMPOSIZIONE_ORDE_VICHINGHE[liv];
      
      let killFantAlleata = 0;
      let killCavAlleata = 0;
      let killArcAlleati = 0;

      ondata.giocatori.forEach(g => {
        killFantAlleata += g.truppeUccise?.fant || 0;
        killCavAlleata += g.truppeUccise?.cav || 0;
        killArcAlleati += g.truppeUccise?.arc || 0;
      });

      const killTotali = killFantAlleata + killCavAlleata + killArcAlleati;

      // Fallback pulito: se mancano i dati dell'orda, i bersagli sono uguali alle uccisioni (niente '1' forzati)
      const bersagliMischia = orda ? (orda.fant + orda.cav) : killFantAlleata; 
      const bersagliDistanza = orda ? (orda.arc) : killCavAlleata;
      const totaleNemici = orda ? orda.tot : killTotali;

      // --- LOGICA DI SPILLOVER BIDIREZIONALE ---
      // 1. Calcoliamo i danni in eccesso rispetto al bersaglio primario
      const eccessoFant = Math.max(0, killFantAlleata - bersagliMischia);
      const eccessoCav = Math.max(0, killCavAlleata - bersagliDistanza);

      // 2. Calcoliamo quanto del bersaglio è stato abbattuto contando anche il "soccorso" dell'altra truppa
      const mischiaAbbattuta = Math.min(bersagliMischia, killFantAlleata + eccessoCav);
      const distanzaAbbattuta = Math.min(bersagliDistanza, killCavAlleata + eccessoFant);

      // 3. Calcoliamo le percentuali reali di tenuta
      const tenutaMischia = bersagliMischia > 0 ? (mischiaAbbattuta / bersagliMischia) * 100 : 100;
      const tenutaDistanza = bersagliDistanza > 0 ? (distanzaAbbattuta / bersagliDistanza) * 100 : 100;

      const overflowTotale = (bersagliMischia - mischiaAbbattuta) + (bersagliDistanza - distanzaAbbattuta);
      const sopravvissuti = Math.max(0, totaleNemici - killTotali);

      return {
        livello: liv,
        ordaFissa: !!orda,
        bersagliMischia,
        killFantAlleata,
        eccessoCav,
        tenutaMischia,
        bersagliDistanza,
        killCavAlleata,
        eccessoFant,
        tenutaDistanza,
        overflowTotale,
        killArcAlleati,
        sopravvissuti
      };
    }).sort((a, b) => a.livello - b.livello);
  }, [datiEvento]);

  if (!analisiIngaggio || analisiIngaggio.length === 0) return null;

  return (
    <div style={{ backgroundColor: '#1e1e2f', padding: '20px', borderRadius: '8px', border: '1px solid #38bdf8', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>
      <div style={{ marginBottom: '15px' }}>
        <h3 style={{ margin: 0, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '10px' }}>
          ⚔️ Analisi Regole d'Ingaggio e Saturazione Fronte
        </h3>
        <p style={{ color: '#aaa', fontSize: '13px', marginTop: '5px' }}>
          Tracciamento del <strong>Target Lock con Spillover</strong>: La Fanteria ha priorità sulla Mischia, la Cavalleria sulle Retrovie. Se una delle due spazza via il proprio target, i danni in eccesso si riversano in supporto all'altra. Gli Arcieri alleati ingaggiano <strong>solo</strong> l'Overflow netto.
        </p>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '13px', whiteSpace: 'nowrap' }}>
          <thead>
            <tr style={{ backgroundColor: '#2a2a40' }}>
              <th rowSpan="2" style={{ padding: '10px', textAlign: 'center', color: '#fff', borderRight: '2px solid #555' }}>Lvl</th>
              
              <th colSpan="3" style={{ padding: '8px', textAlign: 'center', color: '#4CAF50', borderRight: '2px solid #555', borderBottom: '1px solid #555' }}>
                🛡️ Fronte Mischia (Priorità: Fanteria)
              </th>
              
              <th colSpan="3" style={{ padding: '8px', textAlign: 'center', color: '#2196F3', borderRight: '2px solid #555', borderBottom: '1px solid #555' }}>
                🐎 Fronte Distanza (Priorità: Cavalleria)
              </th>
              
              <th colSpan="3" style={{ padding: '8px', textAlign: 'center', color: '#F44336', borderBottom: '1px solid #555' }}>
                🏹 Retrovie e Saturazione Finale
              </th>
            </tr>
            <tr style={{ backgroundColor: 'rgba(0,0,0,0.2)', color: '#888', fontSize: '11px', textTransform: 'uppercase' }}>
              <th style={{ padding: '6px' }}>Target (Fant+Cav)</th>
              <th style={{ padding: '6px', color: '#4CAF50' }}>Kill Fant. Alleata</th>
              <th style={{ padding: '6px', borderRight: '2px solid #555' }}>Tenuta %</th>

              <th style={{ padding: '6px' }}>Target (Arcieri)</th>
              <th style={{ padding: '6px', color: '#2196F3' }}>Kill Cav. Alleata</th>
              <th style={{ padding: '6px', borderRight: '2px solid #555' }}>Tenuta %</th>

              <th style={{ padding: '6px', color: '#FF9800' }}>Overflow (Bucano)</th>
              <th style={{ padding: '6px', color: '#F44336' }}>Kill Arc. Alleati</th>
              <th style={{ padding: '6px', color: '#fff' }}>Sopravvissuti</th>
            </tr>
          </thead>
          <tbody>
            {analisiIngaggio.map((dati) => {
              const isBrokenMischia = dati.tenutaMischia < 100;
              const isBrokenDistanza = dati.tenutaDistanza < 100;
              const hasOverflow = dati.overflowTotale > 0;

              return (
                <tr key={dati.livello} style={{ borderBottom: '1px solid #333', backgroundColor: hasOverflow ? 'rgba(255, 82, 82, 0.05)' : 'transparent' }}>
                  <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold', color: '#fff', borderRight: '2px solid #555' }}>
                    {dati.livello} {!dati.ordaFissa && '*'}
                  </td>

                  {/* MISCHIA */}
                  <td style={{ padding: '10px', color: '#aaa' }}>{dati.bersagliMischia.toLocaleString()}</td>
                  <td style={{ padding: '10px', color: '#4CAF50', fontWeight: 'bold' }}>
                    {dati.killFantAlleata.toLocaleString()}
                    {dati.eccessoCav > 0 && <span style={{display: 'block', fontSize: '10px', color: '#2196F3', fontWeight: 'normal'}}>+{dati.eccessoCav.toLocaleString()} (Soccorso Cav)</span>}
                  </td>
                  <td style={{ padding: '10px', borderRight: '2px solid #555', fontWeight: 'bold', color: isBrokenMischia ? '#ff5252' : '#4CAF50' }}>
                    {dati.tenutaMischia.toFixed(1)}%
                  </td>

                  {/* DISTANZA */}
                  <td style={{ padding: '10px', color: '#aaa' }}>{dati.bersagliDistanza.toLocaleString()}</td>
                  <td style={{ padding: '10px', color: '#2196F3', fontWeight: 'bold' }}>
                    {dati.killCavAlleata.toLocaleString()}
                    {dati.eccessoFant > 0 && <span style={{display: 'block', fontSize: '10px', color: '#4CAF50', fontWeight: 'normal'}}>+{dati.eccessoFant.toLocaleString()} (Soccorso Fant)</span>}
                  </td>
                  <td style={{ padding: '10px', borderRight: '2px solid #555', fontWeight: 'bold', color: isBrokenDistanza ? '#ff5252' : '#4CAF50' }}>
                    {dati.tenutaDistanza.toFixed(1)}%
                  </td>

                  {/* OVERFLOW & ARCIERI */}
                  <td style={{ padding: '10px', color: hasOverflow ? '#FF9800' : '#555', fontWeight: hasOverflow ? 'bold' : 'normal' }}>
                    {dati.overflowTotale.toLocaleString()}
                  </td>
                  <td style={{ padding: '10px', color: dati.killArcAlleati > 0 ? '#F44336' : '#555', fontWeight: dati.killArcAlleati > 0 ? 'bold' : 'normal' }}>
                    {dati.killArcAlleati.toLocaleString()}
                  </td>
                  <td style={{ padding: '10px', color: dati.sopravvissuti > 0 ? '#fff' : '#555', fontWeight: dati.sopravvissuti > 0 ? 'bold' : 'normal' }}>
                    {dati.sopravvissuti.toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};