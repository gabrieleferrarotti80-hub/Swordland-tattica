import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Home from './pages/Home';
import Swordland from './pages/Swordland';
import Viking from './pages/Viking';
import MapPage from './pages/MapPage';
import MarchBuilder from './pages/MarchBuilder'; // Aggiungi l'import in alto
import AdminPanel from './pages/AdminPanel';

function App() {
  // Lo stato del roster vive qui ed è l'unica cosa condivisa globalmente
  const [roster, setRoster] = useState(() => {
    const saved = localStorage.getItem('swordland-roster');
    return saved ? JSON.parse(saved) : [];
  });

  // 💡 UNICO STATO DI AUTENTICAZIONE (Gestisce Permessi, Alleanza e Giocatore)
  const [auth, setAuth] = useState(() => {
    const saved = localStorage.getItem('kingshot-auth');
    return saved ? JSON.parse(saved) : { role: null, code: '', allianceRole: null, playerId: null, playerName: '' };
  });

  // Salvataggio automatico in locale ad ogni modifica
  useEffect(() => { 
    localStorage.setItem('swordland-roster', JSON.stringify(roster)); 
  }, [roster]);

  useEffect(() => { 
    localStorage.setItem('kingshot-auth', JSON.stringify(auth)); 
  }, [auth]);

  return (
    <Router>
      <Routes>
        <Route 
          path="/" 
          element={
            <Home 
              roster={roster} 
              setRoster={setRoster}
              auth={auth}
              setAuth={setAuth}
            />
          } 
           />
          <Route path="/admin" element={<AdminPanel auth={auth} />} 
        />
        <Route 
          path="/swordland" 
          element={
            <Swordland 
              roster={roster} 
              setRoster={setRoster} 
              allianceCode={auth.code} 
              allianceRole={auth.allianceRole} 
            />
          } 
        />
        <Route path="/viking" element={<Viking roster={roster} />} />
        <Route 
          path="/map" 
          element={
            <MapPage 
              roster={roster}
              userRole={auth.role}
              allianceCode={auth.code}
              allianceRole={auth.allianceRole}
            />
          } 
        />
        <Route 
  path="/march-builder" 
  element={<MarchBuilder auth={auth} />} 
/>
      </Routes>
    </Router>
  );
}

export default App;