import Tesseract from 'tesseract.js';

// ==========================================
// 🎨 HELPER: PRE-PROCESSING IMMAGINE (SOLO SCALA DI GRIGI)
// ==========================================
const preProcessaImmagine = (file) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const reader = new FileReader();
        
        reader.onload = (e) => {
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                
                ctx.drawImage(img, 0, 0);
                
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                
                // Applica SOLO la scala di grigi (mantenendo le sfumature per non sgranare il testo)
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    
                    // Calcola la luminanza (luminosità reale percepita dall'occhio umano)
                    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
                    
                    // Invece di forzare bianco/nero, assegniamo la sfumatura di grigio a tutti e 3 i canali
                    data[i] = luma;     // Rosso diventa grigio
                    data[i + 1] = luma; // Verde diventa grigio
                    data[i + 2] = luma; // Blu diventa grigio
                    // data[i+3] (Alpha/Trasparenza) rimane intatto
                }
                
                ctx.putImageData(imageData, 0, 0);
                resolve(canvas.toDataURL('image/jpeg'));
            };
            img.onerror = () => reject(new Error("Errore nel caricamento dell'immagine nel canvas."));
            img.src = e.target.result;
        };
        
        reader.onerror = () => reject(new Error("Errore nella lettura del file immagine."));
        reader.readAsDataURL(file);
    });
};

// ==========================================
// 🔍 MOTORE DI RICERCA NOMI (AGGIORNATO CON RICERCA CODA)
// ==========================================
const trovaIndiceNome = (righe, player) => {
    const playerClean = player.replace(/\[.*?\]/g, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

    for (let i = 0; i < righe.length; i++) {
        const rigaPulita = righe[i].replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

        // 1. Match Esatto
        if (rigaPulita.includes(playerClean)) return i;

        // 2. Match Tronco Principale (prime 4 lettere)
        if (playerClean.length >= 4) {
            const troncoPrincipale = playerClean.substring(0, 4);
            if (rigaPulita.includes(troncoPrincipale)) return i;
        }
        
        // 3. NUOVO: Match Coda (ultime 4 lettere per nomi lunghi)
        // Se Tesseract ha distrutto l'inizio ma ha letto bene la fine a capo (es. "cely")
        if (playerClean.length >= 6) {
            const troncoFinale = playerClean.substring(playerClean.length - 4);
            if (rigaPulita.includes(troncoFinale)) {
                // Se la coda è qui, i numeri sono quasi certamente sulla riga precedente.
                // Restituiamo i - 1 (senza andare sotto lo zero)
                return Math.max(0, i - 1); 
            }
        }
    }
    
    return -1; 
};

// ==========================================
// 🏆 MOTORE DEDICATO: ESTRAZIONE PUNTEGGI BLINDATA + FILTRO
// ==========================================
export async function estraiPunteggi(scoreFile, playersTemplate, logCallback) {
    const waveScores = {};
    playersTemplate.forEach(p => waveScores[p] = 0); 

    if (!scoreFile) {
        logCallback("   ⚠️ Nessun file punteggi caricato per questa ondata.\n");
        return waveScores;
    }

    logCallback(`   📸 [MOTORE BLINDATO] Pre-processing e lettura immagine PUNTEGGI in corso...\n`);
    
    try {
        // 1. Passaggio in "lavanderia" (Rimuove lo sfondo evidenziato)
        const immaginePulita = await preProcessaImmagine(scoreFile);
        
        // 2. Tesseract legge l'immagine ad alto contrasto
        const { data } = await Tesseract.recognize(immaginePulita, 'eng');
        const righe = data.text.split('\n').map(r => r.trim()).filter(r => r !== '');

        console.log("=== RAW TESSERACT PUNTEGGI (FILTRATA) ===");
        console.log(righe);

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
                
                // 🛑 MURO DI CONTENIMENTO COMBINATO
                if (j > lineIdx) {
                    const rigaLow = righe[j].toLowerCase();
                    const rigaSoloLettere = rigaLow.replace(/[^a-z]/g, '');

                    if (rigaLow.includes('[rev]') || rigaLow.includes('liv.') || rigaLow.includes('lv.')) {
                        break; 
                    }

                    let invasioneDiCampo = false;
                    for (const altroPlayer of playersTemplate) {
                        if (altroPlayer !== player) { 
                            const nomePulito = altroPlayer.replace(/\[.*?\]/g, '').replace(/[^a-zA-Z]/g, '').toLowerCase();
                            if (nomePulito.length > 3 && rigaSoloLettere.includes(nomePulito)) {
                                invasioneDiCampo = true;
                                break;
                            }
                        }
                    }
                    
                    if (invasioneDiCampo) break;
                }

              // MANGIAMO LO SPAZIO: \s*\) intercetta ")", " )", "  )" e li fonde nel numero finale "1"
                const rigaNum = righe[j].replace(/\s*\)/g, '1').replace(/[.,'‘]/g, '').replace(/[oO]/g, '0');
                const matchNumeri = rigaNum.match(/\b\d+\b/g);
                
                if (matchNumeri && matchNumeri.length > 0) {
                    const numeriValidi = matchNumeri
                        .map(n => parseInt(n, 10))
                        .filter(n => !isNaN(n) && (n >= 10 || n === 0));

                    if (numeriValidi.length > 0) {
                        punteggioEstratto = numeriValidi[numeriValidi.length - 1];
                        trovatoValore = true;
                        break; 
                    }
                }
            }

            waveScores[player] = punteggioEstratto;
            if (trovatoValore) {
                logCallback(`      🎯 [PUNTI] ${player} -> Punteggio estratto: ${punteggioEstratto}\n`);
            } else {
                logCallback(`      ⚠️ [PUNTI] ${player} -> Nessun numero valido trovato (impostato a 0).\n`);
            }
        });

    } catch (err) {
        logCallback(`   ❌ Errore critico lettura foto punteggi: ${err.message}\n`);
    }

    return waveScores;
}

// ==========================================
// ⚔️ MOTORE 2: ESTRAZIONE TRUPPE + FILTRO
// ==========================================
export async function estraiTruppe(troopFiles, playersTemplate, initialTroops, logCallback) {
    const waveTroops = JSON.parse(JSON.stringify(initialTroops)); 
    
    if (!troopFiles || troopFiles.length === 0) return waveTroops;

    for (let i = 0; i < troopFiles.length; i++) {
        const file = troopFiles[i];
        logCallback(`   📸 Pre-processing e lettura immagine TRUPPE ${i + 1} di ${troopFiles.length}...\n`);
        
        try {
            // 1. Passaggio in "lavanderia" anche per le truppe
            const immaginePulita = await preProcessaImmagine(file);
            
            // 2. Lettura Tesseract
            const { data } = await Tesseract.recognize(immaginePulita, 'eng');
            
            let testoPulito = data.text
                .replace(/[.,'‘]/g, '') 
                .replace(/\b[oO]\b/g, '0');
                
            const righe = testoPulito.split('\n').map(r => r.trim()).filter(r => r !== '');

          playersTemplate.forEach(player => {
                const indiceGiocatore = trovaIndiceNome(righe, player);

                if (indiceGiocatore !== -1) {
                    let indiceIntestazione = -1;
                    const limiteRicerca = Math.min(indiceGiocatore + 10, righe.length);
                    
                    for(let k = indiceGiocatore + 1; k < limiteRicerca; k++) {
                        const rigaLower = righe[k].toLowerCase();
                        const rigaSoloLettere = rigaLower.replace(/[^a-z]/g, '');
                        
                        // 1. Muro Statico
                        if(rigaLower.includes('[rev]') || rigaLower.includes('liv.') || rigaLower.includes('lv.')) {
                            break; 
                        }

                        // 2. MURO DINAMICO (Previene il furto dati su tendine chiuse come nello Scan 4)
                        let invasioneDiCampo = false;
                        for (const altroPlayer of playersTemplate) {
                            if (altroPlayer !== player) { 
                                const nomePulito = altroPlayer.replace(/\[.*?\]/g, '').replace(/[^a-zA-Z]/g, '').toLowerCase();
                                if (nomePulito.length > 3 && rigaSoloLettere.includes(nomePulito)) {
                                    invasioneDiCampo = true;
                                    break;
                                }
                            }
                        }
                        if (invasioneDiCampo) break; // Se invadiamo un altro giocatore PRIMA di trovare "uccisioni", la tendina era chiusa!

                        // Trova l'inizio della tabella truppe
                        if(rigaLower.includes('uccision') || rigaLower.includes('perdit') || rigaLower.includes('ferit') || rigaLower.includes('kills')) {
                            indiceIntestazione = k;
                            break;
                        }
                    }

                   if (indiceIntestazione !== -1) {
                        logCallback(`      👤 Tabella truppe trovata per: ${player}\n`);
                        
                        // 🛡️ 1. SCUDO WIZARD: Mappiamo solo le truppe con valore "inviate" > 0
                        const truppeAttese = [];
                        ['fant', 'cav', 'arc'].forEach(cat => {
                            if (waveTroops[player] && waveTroops[player][cat]) {
                                waveTroops[player][cat].forEach((row, idx) => {
                                    const numInviate = parseInt(row.inviate, 10);
                                    if (!isNaN(numInviate) && numInviate > 0) {
                                        // Truppe inviate: l'OCR cercherà questa riga
                                        truppeAttese.push({ cat, idx });
                                    } else {
                                        // Nessuna truppa inviata: forza a 0, l'OCR non deve nemmeno cercare
                                        waveTroops[player][cat][idx].uccise = "0";
                                    }
                                });
                            }
                        });

                        let truppeTrovate = 0;
                        
                        for(let k = indiceIntestazione + 1; k < righe.length && truppeTrovate < truppeAttese.length; k++) {
                            const rigaLower = righe[k].toLowerCase();
                            
                            // Muro inferiore
                            if (rigaLower.includes('attaccante') || rigaLower.includes('difensore') || rigaLower.includes('[rev]')) {
                                break; 
                            }
                            
                            let rigaRestaurata = righe[k]
                                .replace(/mM/g, '111')          
                                .replace(/soe/gi, '506')        
                                .replace(/©/g, '0')             
                                .replace(/[sS][oO0]/g, '50')    
                                .replace(/([0-9])[oO]/g, '$10')
                                .replace(/[oO]([0-9])/g, '0$1')
                                .replace(/([0-9])[lIi|]/g, '$11')
                                .replace(/[lIi|]([0-9])/g, '1$1')
                                .replace(/\b[lIi|]{1,3}\b/g, match => '1'.repeat(match.length));

                            const matchNumeri = rigaRestaurata.match(/\b\d+\b/g); 
                            
                            if (matchNumeri && matchNumeri.length >= 4) {
                                let arrNumeri = [...matchNumeri];
                                
                                // Salta il livello Tier se letto per sbaglio
                                if (arrNumeri.length >= 5 && parseInt(arrNumeri[0], 10) <= 25) {
                                    arrNumeri.shift();
                                }
                                
                                let ucciseEstratte = "0";
                                
                                if (arrNumeri.length > 0) {
                                    let mergedKills = arrNumeri[0];
                                    let idx = 1;
                                    // Ricostruisce numeri separati da spazio
                                    while (idx < arrNumeri.length) {
                                        if (arrNumeri[idx].length === 3) {
                                            mergedKills += arrNumeri[idx];
                                            idx++;
                                        } else {
                                            break;
                                        }
                                    }
                                    ucciseEstratte = mergedKills;
                                }

                                // 🛡️ 2. REGOLA DELLE MIGLIAIA
                                const killsNum = parseInt(ucciseEstratte, 10);
                                // Un attacco reale fa danni a migliaia o fallisce totalmente (0).
                                // Numeri piccoli sono allucinazioni di Tesseract.
                                if (killsNum > 0 && killsNum < 1000) {
                                    continue; // Ignora questa riga e passa alla successiva
                                }
                                
                                const target = truppeAttese[truppeTrovate];
                                waveTroops[player][target.cat][target.idx].uccise = ucciseEstratte;
                                logCallback(`         -> ${target.cat.toUpperCase()} (Riga ${target.idx + 1}) uccise: ${ucciseEstratte}\n`);
                                
                                truppeTrovate++;
                            }
                        }
                    }
                }
            });
        } catch (err) {
            logCallback(`   ❌ Errore critico lettura foto truppe ${i+1}: ${err.message}\n`);
        }
    }
    
    return waveTroops;
}