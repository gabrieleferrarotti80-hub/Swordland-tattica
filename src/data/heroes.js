import i18next from 'i18next';

export const heroesDB = [
  // ⚔️ FANTERIA (Fante)
  { id: 'h_inf_1', name: 'Forrest', type: 'infantry', rarity: 'legendary', gen: 1, icon: '/heroes/Forrest.png', image: '/heroes/Forrest.png' },
  { id: 'h_inf_2', name: 'Seth', type: 'infantry', rarity: 'legendary', gen: 1, icon: '/heroes/Seth.png', image: '/heroes/Seth.png' },
  { id: 'h_inf_3', name: 'Howard', type: 'infantry', rarity: 'legendary', gen: 1, icon: '/heroes/Howard.png', image: '/heroes/Howard.png' },
  { id: 'h_inf_4', name: 'Amadeus', type: 'infantry', rarity: 'legendary', gen: 1, icon: '/heroes/Amadeus.png', image: '/heroes/Amadeus.png' },
  { id: 'h_inf_5', name: 'Helga', type: 'infantry', rarity: 'legendary', gen: 1, icon: '/heroes/Helga.png', image: '/heroes/Helga.png' },
  { id: 'h_inf_6', name: 'Zoe', type: 'infantry', rarity: 'legendary', gen: 2, icon: '/heroes/Zoe.png', image: '/heroes/Zoe.png' },
  { id: 'h_inf_7', name: 'Eric', type: 'infantry', rarity: 'legendary', gen: 3, icon: '/heroes/Eric.png', image: '/heroes/Eric.png' },
  { id: 'h_inf_8', name: 'Alcar', type: 'infantry', rarity: 'legendary', gen: 4, icon: '/heroes/Alcar.png', image: '/heroes/Alcar.png' },
  { id: 'h_inf_9', name: 'Long Fei', type: 'infantry', rarity: 'legendary', gen: 5, icon: '/heroes/Long Fei.png', image: '/heroes/Long Fei.png' },
  { id: 'h_inf_10', name: 'Triton', type: 'infantry', rarity: 'legendary', gen: 6, icon: '/heroes/Triton.png', image: '/heroes/Triton.png' },
  
  // 🐎 CAVALLERIA (Cavaliere)
  { id: 'h_cav_1', name: 'Edwin', type: 'cavalry', rarity: 'legendary', gen: 1, icon: '/heroes/Edwin.png', image: '/heroes/Edwin.png' },
  { id: 'h_cav_2', name: 'Fahd', type: 'cavalry', rarity: 'legendary', gen: 1, icon: '/heroes/Fahd.png', image: '/heroes/Fahd.png' },
  { id: 'h_cav_3', name: 'Chenko', type: 'cavalry', rarity: 'legendary', gen: 1, icon: '/heroes/Chenko.png', image: '/heroes/Chenko.png' },
  { id: 'h_cav_4', name: 'Gordon', type: 'cavalry', rarity: 'legendary', gen: 1, icon: '/heroes/Gordon.png', image: '/heroes/Gordon.png' },
  { id: 'h_cav_5', name: 'Jabel', type: 'cavalry', rarity: 'legendary', gen: 1, icon: '/heroes/Jabel.png', image: '/heroes/Jabel.png' },
  { id: 'h_cav_6', name: 'Hilde', type: 'cavalry', rarity: 'legendary', gen: 2, icon: '/heroes/Hilde.png', image: '/heroes/Hilde.png' },
  { id: 'h_cav_7', name: 'Petra', type: 'cavalry', rarity: 'legendary', gen: 3, icon: '/heroes/Petra.png', image: '/heroes/Petra.png' },
  { id: 'h_cav_8', name: 'Margot', type: 'cavalry', rarity: 'legendary', gen: 4, icon: '/heroes/Margot.png', image: '/heroes/Margot.png' },
  { id: 'h_cav_9', name: 'Thrud', type: 'cavalry', rarity: 'legendary', gen: 5, icon: '/heroes/Thrud.png', image: '/heroes/Thrud.png' },
  { id: 'h_cav_10', name: 'Sophia', type: 'cavalry', rarity: 'legendary', gen: 6, icon: '/heroes/Sophia.png', image: '/heroes/Sophia.png' },
  
  // 🏹 ARCIERI (Arcere)
  { id: 'h_arc_1', name: 'Olive', type: 'archers', rarity: 'legendary', gen: 1, icon: '/heroes/Olive.png', image: '/heroes/Olive.png' },
  { id: 'h_arc_2', name: 'Amane', type: 'archers', rarity: 'legendary', gen: 1, icon: '/heroes/Amane.png', image: '/heroes/Amane.png' },
  { id: 'h_arc_3', name: 'Yeonwoo', type: 'archers', rarity: 'legendary', gen: 1, icon: '/heroes/Yeonwoo.png', image: '/heroes/Yeonwoo.png' },
  { id: 'h_arc_4', name: 'Diana', type: 'archers', rarity: 'legendary', gen: 1, icon: '/heroes/Diana.png', image: '/heroes/Diana.png' },
  { id: 'h_arc_5', name: 'Quinn', type: 'archers', rarity: 'legendary', gen: 1, icon: '/heroes/Quinn.png', image: '/heroes/Quinn.png' },
  { id: 'h_arc_6', name: 'Saul', type: 'archers', rarity: 'legendary', gen: 1, icon: '/heroes/Saul.png', image: '/heroes/Saul.png' },
  { id: 'h_arc_7', name: 'Marlin', type: 'archers', rarity: 'legendary', gen: 2, icon: '/heroes/Marlin.png', image: '/heroes/Marlin.png' },
  { id: 'h_arc_8', name: 'Jaeger', type: 'archers', rarity: 'legendary', gen: 3, icon: '/heroes/Jaeger.png', image: '/heroes/Jaeger.png' },
  { id: 'h_arc_9', name: 'Rosa', type: 'archers', rarity: 'legendary', gen: 4, icon: '/heroes/Rosa.png', image: '/heroes/Rosa.png' },
  { id: 'h_arc_10', name: 'Vivian', type: 'archers', rarity: 'legendary', gen: 5, icon: '/heroes/Vivian.png', image: '/heroes/Vivian.png' },
  { id: 'h_arc_11', name: 'Yang', type: 'archers', rarity: 'legendary', gen: 6, icon: '/heroes/Yang.png', image: '/heroes/Yang.png' }
];

// Eventi configurabili per le formazioni
export const eventTypes = [
  { id: 'custom', get name() { return i18next.t('events.custom', 'Formazione Libera (Generica)'); } },
  { id: 'bear_trap', get name() { return i18next.t('events.bear_trap', "Trappola dell'Orso"); } },
  { id: 'arena', get name() { return i18next.t('events.arena', 'Arena (PvP)'); } },
  { id: 'castle_siege', get name() { return i18next.t('events.castle_siege', 'Assedio al Castello'); } },
  { id: 'farming', get name() { return i18next.t('events.farming', 'Raccolta Risorse'); } },
  { id: 'swordland', name: 'Swordland' },
  { id: 'tri_alliance', name: 'Tri Alliance' }
];