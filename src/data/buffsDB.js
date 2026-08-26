export const buffsDB = [
  // BUFF GLOBALI (Validi per ogni evento)
  {
    id: 'global_atk_1',
    name: 'Potenziamento Attacco Generale',
    category: 'global',
    targetEvent: 'all',
    maxLevel: 5,
    description: 'Aumenta l\'attacco di tutte le truppe in marcia.'
  },
  {
    id: 'global_def_1',
    name: 'Potenziamento Difesa Generale',
    category: 'global',
    targetEvent: 'all',
    maxLevel: 5,
    description: 'Aumenta la difesa di tutte le truppe in marcia.'
  },
  {
    id: 'global_cap_1',
    name: 'Espansione Capacità Marcia',
    category: 'global',
    targetEvent: 'all',
    maxLevel: 10,
    description: 'Aumenta la capacità massima di soldati inviabili.'
  },

  // BUFF SPECIFICI PER EVENTO (Es. Trappola dell'Orso)
  {
    id: 'bear_frenzy',
    name: 'Frenesia dell\'Orso (Attacco Rally)',
    category: 'event',
    targetEvent: 'bear_trap', // Collegato all'evento Orso
    maxLevel: 5,
    description: 'Bonus attacco specifico per i partecipanti ai rally contro la Trappola.'
  },
  {
    id: 'bear_hp',
    name: 'Resistenza al Freddo Estremo',
    category: 'event',
    targetEvent: 'bear_trap',
    maxLevel: 3,
    description: 'Aumenta la salute delle truppe durante l\'evento Orso.'
  },

  // BUFF SPECIFICI PER PVP / ARENA / CASTELLO
  {
    id: 'pvp_lethality',
    name: 'Letalità Avanzata (PvP)',
    category: 'combat',
    targetEvent: 'castle_siege', // Collegato ad Assedio Castello / PvP
    maxLevel: 5,
    description: 'Aumenta la percentuale di eliminazione nemica negli scontri tra giocatori.'
  }
];