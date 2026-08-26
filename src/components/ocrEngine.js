import Tesseract from 'tesseract.js';
import i18next from 'i18next'; // 🌍 Import i18n per file di sola logica

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
                
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    
                    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
                    
                    data[i] = luma;    
                    data[i + 1] = luma; 
                    data[i + 2] = luma; 
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

const trovaIndiceNome = (righe, player) => {
    const playerClean = player.replace(/\[.*?\]/g, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

    for (let i = 0; i < righe.length; i++) {
        const rigaPulita = righe[i].replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

        if (rigaPulita.includes(playerClean)) return i;

        if (playerClean.length >= 4) {
            const troncoPrincipale = playerClean.substring(0, 4);
            if (rigaPulita.includes(troncoPrincipale)) return i;
        }
        
        if (playerClean.length >= 6) {
            const troncoFinale = playerClean.substring(playerClean.length - 4);
            if (rigaPulita.includes(troncoFinale)) {
                return Math.max(0, i - 1); 
            }
        }
    }
    
    return -1; 
};

export async function estraiPunteggi(scoreFile, playersTemplate, logCallback) {
    const waveScores = {};
    playersTemplate.forEach(p => waveScores[p] = 0); 

    if (!scoreFile) {
        logCallback(i18next.t('viking_wizard.ocr_log_no_scores', "   ⚠️ Nessun file punteggi caricato per questa ondata.\n"));
        return waveScores;
    }

    logCallback(i18next.t('viking_wizard.ocr_log_reading_scores', "   📸 [MOTORE BLINDATO] Pre-processing e lettura immagine PUNTEGGI in corso...\n"));
    
    try {
        const immaginePulita = await preProcessaImmagine(scoreFile);
        
        const { data } = await Tesseract.recognize(immaginePulita, 'eng');
        const righe = data.text.split('\n').map(r => r.trim()).filter(r => r !== '');

        playersTemplate.forEach(player => {
            const lineIdx = trovaIndiceNome(righe, player);

            if (lineIdx === -1) {
                logCallback(i18next.t('viking_wizard.ocr_log_score_not_found', "      ❌ [PUNTI] {{player}} -> Nome non trovato nell'immagine.\n", { player }));
                waveScores[player] = 0;
                return;
            }

            let punteggioEstratto = 0;
            let trovatoValore = false;

            const limite = Math.min(lineIdx + 3, righe.length - 1);

            for (let j = lineIdx; j <= limite; j++) {
                
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
                logCallback(i18next.t('viking_wizard.ocr_log_score_extracted', "      🎯 [PUNTI] {{player}} -> Punteggio estratto: {{score}}\n", { player, score: punteggioEstratto }));
            } else {
                logCallback(i18next.t('viking_wizard.ocr_log_score_no_valid_number', "      ⚠️ [PUNTI] {{player}} -> Nessun numero valido trovato (impostato a 0).\n", { player }));
            }
        });

    } catch (err) {
        logCallback(i18next.t('viking_wizard.ocr_log_score_critical_error', "   ❌ Errore critico lettura foto punteggi: {{msg}}\n", { msg: err.message }));
    }

    return waveScores;
}

export async function estraiTruppe(troopFiles, playersTemplate, initialTroops, logCallback) {
    const waveTroops = JSON.parse(JSON.stringify(initialTroops)); 
    
    if (!troopFiles || troopFiles.length === 0) return waveTroops;

    for (let i = 0; i < troopFiles.length; i++) {
        const file = troopFiles[i];
        logCallback(i18next.t('viking_wizard.ocr_log_reading_troops', "   📸 Pre-processing e lettura immagine TRUPPE {{current}} di {{total}}...\n", { current: i + 1, total: troopFiles.length }));
        
        try {
            const immaginePulita = await preProcessaImmagine(file);
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
                        
                        if(rigaLower.includes('[rev]') || rigaLower.includes('liv.') || rigaLower.includes('lv.')) {
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

                        if(rigaLower.includes('uccision') || rigaLower.includes('perdit') || rigaLower.includes('ferit') || rigaLower.includes('kills')) {
                            indiceIntestazione = k;
                            break;
                        }
                    }

                   if (indiceIntestazione !== -1) {
                        logCallback(i18next.t('viking_wizard.ocr_log_table_found', "      👤 Tabella truppe trovata per: {{player}}\n", { player }));
                        
                        const truppeAttese = [];
                        ['fant', 'cav', 'arc'].forEach(cat => {
                            if (waveTroops[player] && waveTroops[player][cat]) {
                                waveTroops[player][cat].forEach((row, idx) => {
                                    const numInviate = parseInt(row.inviate, 10);
                                    if (!isNaN(numInviate) && numInviate > 0) {
                                        truppeAttese.push({ cat, idx });
                                    } else {
                                        waveTroops[player][cat][idx].uccise = "0";
                                    }
                                });
                            }
                        });

                        let truppeTrovate = 0;
                        
                        for(let k = indiceIntestazione + 1; k < righe.length && truppeTrovate < truppeAttese.length; k++) {
                            const rigaLower = righe[k].toLowerCase();
                            
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
                                
                                if (arrNumeri.length >= 5 && parseInt(arrNumeri[0], 10) <= 25) {
                                    arrNumeri.shift();
                                }
                                
                                let ucciseEstratte = "0";
                                
                                if (arrNumeri.length > 0) {
                                    let mergedKills = arrNumeri[0];
                                    let idx = 1;
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

                                const killsNum = parseInt(ucciseEstratte, 10);
                                if (killsNum > 0 && killsNum < 1000) {
                                    continue; 
                                }
                                
                                const target = truppeAttese[truppeTrovate];
                                waveTroops[player][target.cat][target.idx].uccise = ucciseEstratte;
                                logCallback(i18next.t('viking_wizard.ocr_log_troops_extracted', "         -> {{cat}} (Riga {{row}}) uccise: {{kills}}\n", { cat: target.cat.toUpperCase(), row: target.idx + 1, kills: ucciseEstratte }));
                                
                                truppeTrovate++;
                            }
                        }
                    }
                }
            });
        } catch (err) {
            logCallback(i18next.t('viking_wizard.ocr_log_troops_critical_error', "   ❌ Errore critico lettura foto truppe {{index}}: {{msg}}\n", { index: i + 1, msg: err.message }));
        }
    }
    
    return waveTroops;
}