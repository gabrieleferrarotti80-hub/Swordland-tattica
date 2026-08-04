import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export default function MapPage({ roster }) {
  const navigate = useNavigate();
  const [selectedTool, setSelectedTool] = useState('buildings');
  const [isLoadingCloud, setIsLoadingCloud] = useState(false);
  
  // --- STATI PER EDIFICI FISSI ---
  const [fixedBuildings, setFixedBuildings] = useState([
    { id: 1, code: 'HQ', name: 'Castello', x: 600, y: 600, minX: 550, maxX: 650, minY: 550, maxY: 650, occupiedBy: '' },
    { id: 2, code: 'T1', name: 'Fortezza Est', x: 1000, y: 600, minX: 960, maxX: 1040, minY: 560, maxY: 640, occupiedBy: '' }
  ]);

  // --- CARICAMENTO DA FIREBASE ---
  useEffect(() => {
    const fetchBuildingsFromCloud = async () => {
      try {
        setIsLoadingCloud(true);
        const docRef = doc(db, "mapSettings", "fixedBuildings");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().buildings) {
          const loadedBuildings = docSnap.data().buildings.map(b => ({
            id: b.id,
            code: b.code || `B${b.id}`,
            name: b.name,
            x: b.x ?? 600,
            y: b.y ?? 600,
            minX: b.minX ?? (b.x - 40),
            maxX: b.maxX ?? (b.x + 40),
            minY: b.minY ?? (b.y - 40),
            maxY: b.maxY ?? (b.y + 40),
            occupiedBy: b.occupiedBy || ''
          }));
          setFixedBuildings(loadedBuildings);
        }
      } catch (error) {
        console.error("Errore durante il caricamento da Firebase:", error);
      } finally {
        setIsLoadingCloud(false);
      }
    };

    fetchBuildingsFromCloud();
  }, []);

  // --- SALVATAGGIO SU FIREBASE ---
  const handleSaveToCloud = async () => {
    try {
      setIsLoadingCloud(true);
      await setDoc(doc(db, "mapSettings", "fixedBuildings"), {
        buildings: fixedBuildings
      });
      alert("✅ Edifici e occupanti salvati con successo su Firebase!");
    } catch (error) {
      console.error("Errore durante il salvataggio su Firebase:", error);
      alert("❌ Errore durante il salvataggio su Firebase.");
    } finally {
      setIsLoadingCloud(false);
    }
  };

  // --- STATI PER ZOOM E PAN ---
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // --- PROTEZIONE TASTO IMPOSTAZIONI ---
  const handleSettingsClick = () => {
    const code = window.prompt("Inserisci il codice segreto per accedere alle Impostazioni:");
    if (code === "ADMIN") {
      setSelectedTool('settings');
    } else if (code !== null) {
      alert("❌ Codice errato!");
    }
  };

  // Gestione modifiche campi edificio
  const handleBuildingChange = (id, field, value) => {
    setFixedBuildings(prev => prev.map(b => {
      if (b.id === id) {
        const numericFields = ['x', 'y', 'minX', 'maxX', 'minY', 'maxY'];
        return {
          ...b,
          [field]: numericFields.includes(field) ? (Number(value) || 0) : value
        };
      }
      return b;
    }));
  };

  const handleAddBuilding = () => {
    const newBuilding = {
      id: Date.now(),
      code: `B${fixedBuildings.length + 1}`,
      name: 'Nuovo Edificio',
      x: 600,
      y: 600,
      minX: 560,
      maxX: 640,
      minY: 560,
      maxY: 640,
      occupiedBy: ''
    };
    setFixedBuildings(prev => [...prev, newBuilding]);
  };

  const handleDeleteBuilding = (id) => {
    if (window.confirm("Sei sicuro di voler eliminare questo edificio fisso?")) {
      setFixedBuildings(prev => prev.filter(b => b.id !== id));
    }
  };

  // Gestione Zoom con la rotellina del mouse
  const handleWheel = (e) => {
    e.preventDefault();
    const zoomFactor = 1.15;
    let newScale = e.deltaY < 0 ? scale * zoomFactor : scale / zoomFactor;
    newScale = Math.max(1, Math.min(newScale, 50));
    setScale(newScale);
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleResetView = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  return (
    <div className="min-h-screen bg-slate-950 flex text-slate-100 overflow-hidden select-none">
      
      {/* SIDEBAR DEDICATA ALLA MAPPA */}
      <aside className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col p-6 gap-6 z-20 shadow-2xl shrink-0 overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <h2 className="text-lg font-black tracking-wider text-cyan-400">STRUMENTI MAPPA</h2>
          <button 
            onClick={() => navigate('/')} 
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg border border-slate-700 transition-colors"
          >
            🏠 Home
          </button>
        </div>

        {/* Strumenti di gestione */}
        <div className="flex flex-col gap-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Seleziona Azione</span>
          
          <button 
            onClick={() => setSelectedTool('buildings')} 
            className={`p-3.5 rounded-xl font-bold text-left transition-all flex items-center gap-3 ${selectedTool === 'buildings' ? 'bg-cyan-600 text-white shadow-[0_0_15px_rgba(8,145,178,0.4)]' : 'bg-slate-800/50 text-slate-300 hover:bg-slate-800'}`}
          >
            <span className="text-xl">🏰</span> Gestione Edifici
          </button>

          <button 
            onClick={() => setSelectedTool('allies')} 
            className={`p-3.5 rounded-xl font-bold text-left transition-all flex items-center gap-3 ${selectedTool === 'allies' ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)]' : 'bg-slate-800/50 text-slate-300 hover:bg-slate-800'}`}
          >
            <span className="text-xl">👥</span> Posizione Alleati ({roster.length})
          </button>

          <button 
            onClick={() => setSelectedTool('distance')} 
            className={`p-3.5 rounded-xl font-bold text-left transition-all flex items-center gap-3 ${selectedTool === 'distance' ? 'bg-amber-600 text-white shadow-[0_0_15px_rgba(217,119,6,0.4)]' : 'bg-slate-800/50 text-slate-300 hover:bg-slate-800'}`}
          >
            <span className="text-xl">📏</span> Calcolo Distanze Marce
          </button>

          <button 
            onClick={handleSettingsClick} 
            className={`p-3.5 rounded-xl font-bold text-left transition-all flex items-center gap-3 ${selectedTool === 'settings' ? 'bg-rose-600 text-white shadow-[0_0_15px_rgba(225,29,72,0.4)]' : 'bg-slate-800/50 text-slate-300 hover:bg-slate-800'}`}
          >
            <span className="text-xl">⚙️</span> Impostazioni Edifici Fissi
          </button>
        </div>

        {/* Pannello contestuale / Impostazioni */}
        {selectedTool !== 'settings' ? (
          <div className="mt-2 bg-slate-950 p-4 rounded-xl border border-slate-800/80 flex flex-col gap-3">
            <h3 className="text-sm font-bold text-cyan-400">
              {selectedTool === 'buildings' && "Configurazione Edifici"}
              {selectedTool === 'allies' && "Lista Alleati Roster"}
              {selectedTool === 'distance' && "Stima Tempi di Viaggio"}
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              {selectedTool === 'buildings' && "Visualizza gli edifici fissi identificati dai loro codici unici sulla mappa a rombo."}
              {selectedTool === 'allies' && "Visualizza la posizione dei membri del roster attivo sulla mappa."}
              {selectedTool === 'distance' && "Seleziona i punti sulla mappa per calcolare i tempi di marcia."}
            </p>
          </div>
        ) : (
          /* PANNELLO DI CONFIGURAZIONE */
          <div className="mt-2 bg-slate-950 p-4 rounded-xl border border-rose-900/50 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-rose-400">Codici & Occupanti Edifici</h3>
              <div className="flex gap-1">
                <button 
                  onClick={handleAddBuilding}
                  className="px-2 py-1 bg-rose-700 hover:bg-rose-600 text-white text-xs font-bold rounded shadow transition-colors"
                  title="Aggiungi edificio"
                >
                  +
                </button>
                <button 
                  onClick={handleSaveToCloud}
                  disabled={isLoadingCloud}
                  className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded shadow transition-colors disabled:opacity-50"
                  title="Salva modifiche su Firebase"
                >
                  {isLoadingCloud ? "Salvataggio..." : "☁️ Salva"}
                </button>
              </div>
            </div>
            
            <div className="flex flex-col gap-3 max-h-[450px] overflow-y-auto pr-1">
              {fixedBuildings.map((building) => {
                const minX = building.minX ?? 0;
                const maxX = building.maxX ?? 0;
                const minY = building.minY ?? 0;
                const maxY = building.maxY ?? 0;

                const checkCenterX = Math.round((minX + maxX) / 2);
                const checkCenterY = Math.round((minY + maxY) / 2);

                return (
                  <div key={building.id} className="bg-slate-900 p-3 rounded-lg border border-slate-800 flex flex-col gap-2.5 relative group">
                    
                    {/* Riga Codice Univoco, Nome e Tasto Elimina */}
                    <div className="flex items-center gap-2">
                      <input 
                        type="text" 
                        value={building.code} 
                        onChange={(e) => handleBuildingChange(building.id, 'code', e.target.value)}
                        className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs font-bold text-cyan-400 w-16 text-center focus:outline-none focus:border-cyan-500"
                        placeholder="Cod."
                        title="Codice Univoco Edificio"
                      />
                      <input 
                        type="text" 
                        value={building.name} 
                        onChange={(e) => handleBuildingChange(building.id, 'name', e.target.value)}
                        className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs font-bold text-white w-full focus:outline-none focus:border-rose-500"
                        placeholder="Nome Edificio"
                      />
                      <button 
                        onClick={() => handleDeleteBuilding(building.id)}
                        className="text-slate-500 hover:text-rose-400 text-xs px-1.5 py-1 transition-colors"
                        title="Elimina edificio"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Campo di Testo Libero per Occupante */}
                    <div className="bg-slate-950/60 p-2 rounded border border-indigo-900/50 flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-indigo-400">Occupante (Alleato o Avversario)</label>
                      <input 
                        type="text"
                        value={building.occupiedBy}
                        onChange={(e) => handleBuildingChange(building.id, 'occupiedBy', e.target.value)}
                        className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500"
                        placeholder="Es. Nome Alleanza / Giocatore"
                      />
                    </div>

                    {/* Coordinata Centrale Manuale */}
                    <div className="bg-slate-950/60 p-2 rounded border border-cyan-900/50 flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-cyan-400">Centro Manuale (Target Distanze)</span>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col">
                          <label className="text-[9px] text-slate-400">Centro X</label>
                          <input 
                            type="number" 
                            value={building.x} 
                            onChange={(e) => handleBuildingChange(building.id, 'x', e.target.value)}
                            className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500"
                          />
                        </div>
                        <div className="flex flex-col">
                          <label className="text-[9px] text-slate-400">Centro Y</label>
                          <input 
                            type="number" 
                            value={building.y} 
                            onChange={(e) => handleBuildingChange(building.id, 'y', e.target.value)}
                            className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 4 Coordinate Perimetrali */}
                    <div className="bg-slate-950/60 p-2 rounded border border-amber-900/50 flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-amber-400">Confini Esterni (Ingombro Rombo)</span>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col">
                          <label className="text-[9px] text-slate-400">Min X (Sinistra)</label>
                          <input 
                            type="number" 
                            value={building.minX} 
                            onChange={(e) => handleBuildingChange(building.id, 'minX', e.target.value)}
                            className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <div className="flex flex-col">
                          <label className="text-[9px] text-slate-400">Max X (Destra)</label>
                          <input 
                            type="number" 
                            value={building.maxX} 
                            onChange={(e) => handleBuildingChange(building.id, 'maxX', e.target.value)}
                            className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <div className="flex flex-col">
                          <label className="text-[9px] text-slate-400">Min Y (Basso)</label>
                          <input 
                            type="number" 
                            value={building.minY} 
                            onChange={(e) => handleBuildingChange(building.id, 'minY', e.target.value)}
                            className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <div className="flex flex-col">
                          <label className="text-[9px] text-slate-400">Max Y (Alto)</label>
                          <input 
                            type="number" 
                            value={building.maxY} 
                            onChange={(e) => handleBuildingChange(building.id, 'maxY', e.target.value)}
                            className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>

                      {/* Box di Verifica del Centro */}
                      <div className="mt-1 pt-1 border-t border-slate-800 text-[10px] text-slate-400">
                        Centro geometrico stimato dai confini: <strong className="text-slate-200">({checkCenterX} : {checkCenterY})</strong>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Box info coordinate e livello zoom */}
        <div className="mt-auto bg-slate-950/60 p-4 rounded-xl border border-slate-800 text-xs text-slate-400 flex flex-col gap-1">
          <span className="font-bold text-slate-300">Riferimento Cartografico:</span>
          <span>Griglia: 1200 x 1200 px</span>
          <span className="text-cyan-400 font-semibold">Livello Zoom: {scale.toFixed(1)}x</span>
        </div>
      </aside>

      {/* AREA CENTRALE CON MAPPA ZOOMABILE E SCORREVOLE */}
      <main 
        className="flex-1 bg-slate-950 relative flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        
        {/* Controlli rapidi Zoom fluttuanti */}
        <div className="absolute bottom-6 right-6 z-30 flex flex-col gap-2 bg-slate-900/90 p-2 rounded-xl border border-slate-800 shadow-2xl backdrop-blur-md">
          <button 
            onClick={() => setScale(prev => Math.min(prev * 1.5, 50))} 
            className="w-10 h-10 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg flex items-center justify-center text-lg transition-colors"
            title="Zoom Avanti"
          >
            +
          </button>
          <button 
            onClick={() => setScale(prev => Math.max(prev / 1.5, 1))} 
            className="w-10 h-10 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg flex items-center justify-center text-lg transition-colors"
            title="Zoom Indietro"
          >
            -
          </button>
          <button 
            onClick={handleResetView} 
            className="w-10 h-10 bg-slate-800 hover:bg-slate-700 text-cyan-400 font-bold rounded-lg flex items-center justify-center text-xs transition-colors"
            title="Reimposta Vista"
          >
            1:1
          </button>
        </div>

        {/* Canvas / Container della Mappa */}
        <div 
          className="relative w-[800px] h-[800px] flex items-center justify-center transition-transform duration-75 ease-out"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: 'center center'
          }}
        >
          <div className="relative w-full h-full bg-slate-900/30 rounded-3xl border border-slate-800/80 shadow-2xl flex items-center justify-center overflow-hidden backdrop-blur-sm">
            
            {/* SVG MAPPA A ROMBO 1200x1200 */}
            <svg viewBox="0 0 1200 1200" className="w-full h-full drop-shadow-[0_0_25px_rgba(0,0,0,0.9)]">
              <defs>
                <pattern id="mapGrid" width="100" height="100" patternUnits="userSpaceOnUse">
                  <path d="M 100 0 L 0 0 0 100" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
                </pattern>
                <pattern id="subGrid" width="10" height="10" patternUnits="userSpaceOnUse">
                  <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(34, 211, 238, 0.08)" strokeWidth="0.5"/>
                </pattern>
              </defs>
              
              <rect width="1200" height="1200" fill="url(#subGrid)" />
              <rect width="1200" height="1200" fill="url(#mapGrid)" />

              {/* Rombo principale (0:0 in basso) */}
              <polygon 
                points="600,50 1150,600 600,1150 50,600" 
                fill="rgba(15, 23, 42, 0.85)" 
                stroke="rgba(34, 211, 238, 0.6)" 
                strokeWidth="3" 
              />

              {/* Assi centrali */}
              <line x1="50" y1="600" x2="1150" y2="600" stroke="rgba(255,255,255,0.1)" strokeDasharray="6,6" />
              <line x1="600" y1="50" x2="600" y2="1150" stroke="rgba(255,255,255,0.1)" strokeDasharray="6,6" />

              {/* Punto di origine (0:0) in basso */}
              <circle cx="600" cy="1150" r="8" fill="#22d3ee" className="animate-pulse" />
              <text x="620" y="1155" fill="#22d3ee" fontSize="18" fontWeight="bold">Origine (0:0)</text>

              {/* RENDER DINAMICO EDIFICI COME ROMBO (SENZA SEGNALINO CENTRALE) */}
              {fixedBuildings.map((building) => {
                const minX = building.minX ?? 0;
                const maxX = building.maxX ?? 0;
                const minY = building.minY ?? 0;
                const maxY = building.maxY ?? 0;

                const w = Math.abs(maxX - minX);
                const h = Math.abs(maxY - minY);
                
                const centerSvgX = building.x;
                const centerSvgY = 1200 - building.y;

                const rectX = centerSvgX - w / 2;
                const rectY = centerSvgY - h / 2;

                const topX = centerSvgX;
                const topY = rectY;
                const rightX = rectX + w;
                const rightY = centerSvgY;
                const bottomX = centerSvgX;
                const bottomY = rectY + h;
                const leftX = rectX;
                const leftY = centerSvgY;

                const rhombusPoints = `${topX},${topY} ${rightX},${rightY} ${bottomX},${bottomY} ${leftX},${leftY}`;

                return (
                  <g key={building.id} className="cursor-pointer">
                    <polygon 
                      points={rhombusPoints}
                      fill="rgba(244, 63, 94, 0.2)" 
                      stroke="#f43f5e" 
                      strokeWidth="3" 
                    />
                    
                    {/* Etichetta con Codice, Nome e Occupante */}
                    <text x={rectX + w + 10} y={centerSvgY - 2} fill="#ffffff" fontSize="15" fontWeight="bold" className="drop-shadow-md">
                      [{building.code}] {building.name}
                    </text>
                    <text x={rectX + w + 10} y={centerSvgY + 16} fill="#38bdf8" fontSize="12" fontWeight="semibold" className="drop-shadow-md">
                      {building.occupiedBy ? `Occupato: ${building.occupiedBy}` : "Libero"}
                    </text>
                  </g>
                );
              })}
            </svg>

          </div>
        </div>

      </main>

    </div>
  );
}