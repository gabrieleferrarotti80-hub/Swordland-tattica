import Tesseract from 'tesseract.js';

const trovaIndiceNome = (rigaArray, nomeReale) => {
    let migliorIndice = -1;
    let punteggioMassimo = 0;
    
    const nomePulito = nomeReale.replace(/\[.*?\]/g, '').replace(/[^a-zA-Z]/g, '').toLowerCase();

    rigaArray.forEach((riga, index) => {
        const rigaNormalizzata = riga.replace(/0/g, 'o');
        const rigaSoloLettere = rigaNormalizzata.replace(/\[.*?\]/g, '').replace(/[^a-zA-Z]/g, '').toLowerCase();
        
        if (rigaSoloLettere.length < 2 || nomePulito.length < 2) return;
        
        let matches = 0;
        for (let i = 0; i < nomePulito.length - 1; i++) {
            const bigram = nomePulito.substring(i, i + 2);
            if (rigaSoloLettere.includes(bigram)) {
                matches++;
            }
        }
        
        const similarity = (2.0 * matches) / (nomePulito.length - 1 + rigaSoloLettere.length - 1);
        
        if (similarity > punteggioMassimo) {
            punteggioMassimo = similarity;
            migliorIndice = index;
        }
    });

    return punteggioMassimo >= 0.25 ? migliorIndice : -1;
};

export async function estraiPunteggi(scoreFile, playersTemplate, logCallback) {
    const waveScores = {};
    playersTemplate.forEach(p => waveScores[p] = 0); 

    if (!scoreFile) {
        logCallback("   ⚠️ Nessun file punteggi caricato per questa ondata.\n");
        return waveScores;
    }

    logCallback(`   📸 [MODULO PUNTEGGI] Analisi immagine in corso...\n`);
    
    try {
        const { data } = await Tesseract.recognize(scoreFile, 'eng');
        const righe = data.text.split('\n').map(r => r.trim()).filter(r => r !== '');

        playersTemplate.forEach(player => {
            const lineIdx = trovaIndiceNome(righe, player);

            if (lineIdx === -1) {
                logCallback(`      ❌ [PUNTI] ${player} -> Nome non trovato nell'immagine.\n`);
                waveScores[player] = 0;
                return;
            }

            let punteggioEstratto = 0;
            let trovatoValore = false;
            const limite = Math.min(lineIdx + 3, righe.length - 1);

            for (let j = lineIdx; j <= limite; j++) {
                const rigaNum = righe[j].replace(/[.,'‘]/g, '').replace(/[oO]/g, '0');
                const matchNumeri = rigaNum.match(/\b\d+\b/g);
                
                if (matchNumeri && matchNumeri.length > 0) {
                    const numeriValidi = matchNumeri
                        .map(n => parseInt(n, 10))
                        .filter(n => !isNaN(n) && (n >= 10 || n === 0));

                    if (numeriValidi.length > 0) {
                        punteggioEstratto = numeriValidi[numeriValidi.length - 1];
                        trovatoValore = true;
                        if (numeriValidi.length >= 2) break;
                    }
                }
            }

            waveScores[player] = punteggioEstratto;
            if (trovatoValore) {
                logCallback(`      🎯 [PUNTI] ${player} -> Punteggio estratto: ${punteggioEstratto}\n`);
            } else {
                logCallback(`      ⚠️ [PUNTI] ${player} -> Nessun numero valido associato (impostato a 0).\n`);
            }
        });

    } catch (err) {
        logCallback(`   ❌ Errore critico lettura foto punteggi: ${err.message}\n`);
    }

    return waveScores;
}