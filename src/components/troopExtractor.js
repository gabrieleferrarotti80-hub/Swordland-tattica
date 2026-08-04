import Tesseract from 'tesseract.js';

const trovaIndiceNomeTruppe = (rigaArray, nomeReale) => {
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
            if (rigaSoloLettere.includes(bigram)) matches++;
        }
        
        const similarity = (2.0 * matches) / (nomePulito.length - 1 + rigaSoloLettere.length - 1);
        if (similarity > punteggioMassimo) {
            punteggioMassimo = similarity;
            migliorIndice = index;
        }
    });

    return punteggioMassimo >= 0.25 ? migliorIndice : -1;
};

export async function estraiTruppe(troopFiles, playersTemplate, initialTroops, logCallback) {
    const waveTroops = JSON.parse(JSON.stringify(initialTroops)); 
    
    if (!troopFiles || troopFiles.length === 0) return waveTroops;

    for (let i = 0; i < troopFiles.length; i++) {
        const file = troopFiles[i];
        logCallback(`   📸 [MODULO TRUPPE] Lettura immagine ${i + 1} di ${troopFiles.length}...\n`);
        
        try {
            const { data } = await Tesseract.recognize(file, 'eng');
            let testoPulito = data.text.replace(/[.,'‘]/g, '').replace(/\b[oO]\b/g, '0');
            const righe = testoPulito.split('\n').map(r => r.trim()).filter(r => r !== '');

            playersTemplate.forEach(player => {
                const indiceGiocatore = trovaIndiceNomeTruppe(righe, player);

                if (indiceGiocatore !== -1) {
                    let indiceIntestazione = -1;
                    const limiteRicerca = Math.min(indiceGiocatore + 15, righe.length);
                    
                    for(let k = indiceGiocatore; k < limiteRicerca; k++) {
                        const rigaLower = righe[k].toLowerCase();
                        if(rigaLower.includes('uccision') || rigaLower.includes('perdit') || rigaLower.includes('ferit') || rigaLower.includes('kills')) {
                            indiceIntestazione = k;
                            break;
                        }
                    }

                    if (indiceIntestazione !== -1) {
                        logCallback(`      👤 Tabella truppe trovata per: ${player}\n`);
                        let truppeTrovate = 0;
                        const categorie = ['fant', 'cav', 'arc'];
                        
                        for(let k = indiceIntestazione + 1; k < righe.length && truppeTrovate < 3; k++) {
                            const rigaLower = righe[k].toLowerCase();
                            
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
                                let ucciseEstratte = "0";
                                let arrNumeri = [...matchNumeri];
                                
                                if (arrNumeri.length >= 5 && parseInt(arrNumeri[0], 10) <= 25) {
                                    arrNumeri.shift();
                                }
                                
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
                                
                                const cat = categorie[truppeTrovate];
                                if (waveTroops[player][cat] && waveTroops[player][cat].length > 0) {
                                    waveTroops[player][cat][0].uccise = ucciseEstratte;
                                    logCallback(`         -> ${cat.toUpperCase()} uccise: ${ucciseEstratte}\n`); // 🟢 Log ripristinato!
                                }
                                truppeTrovate++;
                                
                            } else if (rigaLower.includes('attaccante') || rigaLower.includes('difensore') || rigaLower.includes('[rev]')) {
                                break; 
                            }
                        }
                    }
                }
            });
        } cm catch (err) {
            logCallback(`   ❌ Errore critico lettura foto truppe ${i+1}: ${err.message}\n`);
        }
    }
    
    return waveTroops;
}