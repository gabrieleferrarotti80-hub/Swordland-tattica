import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Home from './pages/Home';
import Swordland from './pages/Swordland';
import Viking from './pages/Viking';

function App() {
  // Lo stato del roster vive qui ed è l'unica cosa condivisa globalmente
  const [roster, setRoster] = useState(() => {
    const saved = localStorage.getItem('swordland-roster');
    return saved ? JSON.parse(saved) : [];
  });

  // Salvataggio automatico in locale ad ogni modifica
  useEffect(() => { 
    localStorage.setItem('swordland-roster', JSON.stringify(roster)); 
  }, [roster]);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home roster={roster} setRoster={setRoster} />} />
        <Route path="/swordland" element={<Swordland roster={roster} setRoster={setRoster} />} />
        <Route path="/viking" element={<Viking roster={roster} />} />
      </Routes>
    </Router>
  );
}

export default App;