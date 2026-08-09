import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Home from './pages/Home';
import Swordland from './pages/Swordland';
import Viking from './pages/Viking';
import MapPage from './pages/MapPage';

function App() {
  // Lo stato del roster vive qui ed è l'unica cosa condivisa globalmente
  const [roster, setRoster] = useState(() => {
    const saved = localStorage.getItem('swordland-roster');
    return saved ? JSON.parse(saved) : [];
  });

  // --- NUOVI STATI PER IL LOGIN MULTI-TENANT ---
  const [userRole, setUserRole] = useState(null); // 'admin' | 'alliance' | null
  const [allianceCode, setAllianceCode] = useState(''); // Es: 'DTD', 'MASTER'

  // Salvataggio automatico in locale ad ogni modifica
  useEffect(() => { 
    localStorage.setItem('swordland-roster', JSON.stringify(roster)); 
  }, [roster]);

  return (
    <Router>
      <Routes>
        <Route 
          path="/" 
          element={
            <Home 
              roster={roster} 
              setRoster={setRoster}
              userRole={userRole}
              setUserRole={setUserRole}
              allianceCode={allianceCode}
              setAllianceCode={setAllianceCode}
            />
          } 
        />
        <Route path="/swordland" element={<Swordland roster={roster} setRoster={setRoster} />} />
        <Route path="/viking" element={<Viking roster={roster} />} />
        <Route 
          path="/map" 
          element={
            <MapPage 
              roster={roster}
              userRole={userRole}
              allianceCode={allianceCode}
            />
          } 
        />
      </Routes>
    </Router>
  );
}

export default App;