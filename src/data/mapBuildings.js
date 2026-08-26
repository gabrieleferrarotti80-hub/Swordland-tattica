import i18next from 'i18next';

export const mapBuildings = [
  // --- Castello del regno ---
  { id: "castle-1", get name() { return i18next.t('buildings_db.castle', 'Castello del regno'); }, type: "Castle", level: null, x: 597, y: 597, occupant: "" },
  { id: "turret-north", get name() { return i18next.t('buildings_db.turret_north', 'Torretta Nord'); }, type: "turret", x: 605, y: 605, occupant: "" },
  { id: "turret-south", get name() { return i18next.t('buildings_db.turret_south', 'Torretta Sud'); }, type: "turret", x: 589, y: 589, occupant: "" },
  { id: "turret-east", get name() { return i18next.t('buildings_db.turret_east', 'Torretta Est'); }, type: "turret", x: 605, y: 589, occupant: "" },
  { id: "turret-west", get name() { return i18next.t('buildings_db.turret_west', 'Torretta Ovest'); }, type: "turret", x: 589, y: 605, occupant: "" },

  // --- Fortezze ---
  { id: "fort-1", get name() { return `${i18next.t('buildings_db.fortress', 'Fortezza')} 1`; }, type: "Fortress", level: null, x: 597, y: 800, occupant: "" },
  { id: "fort-2", get name() { return `${i18next.t('buildings_db.fortress', 'Fortezza')} 2`; }, type: "Fortress", level: null, x: 400, y: 597, occupant: "" },
  { id: "fort-3", get name() { return `${i18next.t('buildings_db.fortress', 'Fortezza')} 3`; }, type: "Fortress", level: null, x: 597, y: 400, occupant: "" },
  { id: "fort-4", get name() { return `${i18next.t('buildings_db.fortress', 'Fortezza')} 4`; }, type: "Fortress", level: null, x: 800, y: 597, occupant: "" },

  // --- Santuari ---
  { id: "sanc-1", get name() { return `${i18next.t('buildings_db.sanctuary', 'Santuario')} 1`; }, type: "Sanctuary", level: null, x: 237, y: 828, occupant: "" },
  { id: "sanc-2", get name() { return `${i18next.t('buildings_db.sanctuary', 'Santuario')} 2`; }, type: "Sanctuary", level: null, x: 237, y: 606, occupant: "" },
  { id: "sanc-3", get name() { return `${i18next.t('buildings_db.sanctuary', 'Santuario')} 3`; }, type: "Sanctuary", level: null, x: 237, y: 348, occupant: "" },
  { id: "sanc-4", get name() { return `${i18next.t('buildings_db.sanctuary', 'Santuario')} 4`; }, type: "Sanctuary", level: null, x: 366, y: 237, occupant: "" },
  { id: "sanc-5", get name() { return `${i18next.t('buildings_db.sanctuary', 'Santuario')} 5`; }, type: "Sanctuary", level: null, x: 588, y: 237, occupant: "" },
  { id: "sanc-6", get name() { return `${i18next.t('buildings_db.sanctuary', 'Santuario')} 6`; }, type: "Sanctuary", level: null, x: 846, y: 237, occupant: "" },
  { id: "sanc-7", get name() { return `${i18next.t('buildings_db.sanctuary', 'Santuario')} 7`; }, type: "Sanctuary", level: null, x: 957, y: 348, occupant: "" },
  { id: "sanc-8", get name() { return `${i18next.t('buildings_db.sanctuary', 'Santuario')} 8`; }, type: "Sanctuary", level: null, x: 957, y: 606, occupant: "" },
  { id: "sanc-9", get name() { return `${i18next.t('buildings_db.sanctuary', 'Santuario')} 9`; }, type: "Sanctuary", level: null, x: 957, y: 828, occupant: "" },
  { id: "sanc-10", get name() { return `${i18next.t('buildings_db.sanctuary', 'Santuario')} 10`; }, type: "Sanctuary", level: null, x: 846, y: 957, occupant: "" },
  { id: "sanc-11", get name() { return `${i18next.t('buildings_db.sanctuary', 'Santuario')} 11`; }, type: "Sanctuary", level: null, x: 606, y: 957, occupant: "" },
  { id: "sanc-12", get name() { return `${i18next.t('buildings_db.sanctuary', 'Santuario')} 12`; }, type: "Sanctuary", level: null, x: 366, y: 957, occupant: "" },

  // --- Builder's Guild ---
  { id: "bg-1", get name() { return i18next.t('buildings_db.builders_guild', "Builder's Guild"); }, type: "Builders Guild", level: 1, x: 1068, y: 138, occupant: "" },
  { id: "bg-2", get name() { return i18next.t('buildings_db.builders_guild', "Builder's Guild"); }, type: "Builders Guild", level: 1, x: 537, y: 138, occupant: "" },
  { id: "bg-3", get name() { return i18next.t('buildings_db.builders_guild', "Builder's Guild"); }, type: "Builders Guild", level: 1, x: 138, y: 138, occupant: "" },
  { id: "bg-4", get name() { return i18next.t('buildings_db.builders_guild', "Builder's Guild"); }, type: "Builders Guild", level: 1, x: 138, y: 666, occupant: "" },
  { id: "bg-5", get name() { return i18next.t('buildings_db.builders_guild', "Builder's Guild"); }, type: "Builders Guild", level: 1, x: 138, y: 1038, occupant: "" },
  { id: "bg-6", get name() { return i18next.t('buildings_db.builders_guild', "Builder's Guild"); }, type: "Builders Guild", level: 1, x: 666, y: 1068, occupant: "" },
  { id: "bg-7", get name() { return i18next.t('buildings_db.builders_guild', "Builder's Guild"); }, type: "Builders Guild", level: 1, x: 1068, y: 567, occupant: "" },
  { id: "bg-8", get name() { return i18next.t('buildings_db.builders_guild', "Builder's Guild"); }, type: "Builders Guild", level: 1, x: 1068, y: 1068, occupant: "" },
  { id: "bg-9", get name() { return i18next.t('buildings_db.builders_guild', "Builder's Guild"); }, type: "Builders Guild", level: 3, x: 486, y: 327, occupant: "" },
  { id: "bg-10", get name() { return i18next.t('buildings_db.builders_guild', "Builder's Guild"); }, type: "Builders Guild", level: 3, x: 768, y: 867, occupant: "" },
  { id: "bg-11", get name() { return i18next.t('buildings_db.builders_guild', "Builder's Guild"); }, type: "Builders Guild", level: 3, x: 867, y: 567, occupant: "" },
  { id: "bg-12", get name() { return i18next.t('buildings_db.builders_guild', "Builder's Guild"); }, type: "Builders Guild", level: 3, x: 327, y: 666, occupant: "" },

  // --- Armory ---
  { id: "arm-1", get name() { return i18next.t('buildings_db.armory', "Armory"); }, type: "Armory", level: 2, x: 666, y: 138, occupant: "" },
  { id: "arm-2", get name() { return i18next.t('buildings_db.armory', "Armory"); }, type: "Armory", level: 2, x: 438, y: 267, occupant: "" },
  { id: "arm-3", get name() { return i18next.t('buildings_db.armory', "Armory"); }, type: "Armory", level: 2, x: 138, y: 537, occupant: "" },
  { id: "arm-4", get name() { return i18next.t('buildings_db.armory', "Armory"); }, type: "Armory", level: 2, x: 237, y: 768, occupant: "" },
  { id: "arm-5", get name() { return i18next.t('buildings_db.armory', "Armory"); }, type: "Armory", level: 2, x: 537, y: 1038, occupant: "" },
  { id: "arm-6", get name() { return i18next.t('buildings_db.armory', "Armory"); }, type: "Armory", level: 2, x: 738, y: 957, occupant: "" },
  { id: "arm-7", get name() { return i18next.t('buildings_db.armory', "Armory"); }, type: "Armory", level: 2, x: 1068, y: 666, occupant: "" },
  { id: "arm-8", get name() { return i18next.t('buildings_db.armory', "Armory"); }, type: "Armory", level: 2, x: 957, y: 438, occupant: "" },
  { id: "arm-9", get name() { return i18next.t('buildings_db.armory', "Armory"); }, type: "Armory", level: 4, x: 816, y: 717, occupant: "" },
  { id: "arm-10", get name() { return i18next.t('buildings_db.armory', "Armory"); }, type: "Armory", level: 4, x: 387, y: 717, occupant: "" },
  { id: "arm-11", get name() { return i18next.t('buildings_db.armory', "Armory"); }, type: "Armory", level: 4, x: 588, y: 327, occupant: "" },

  // --- Scholar's Tower ---
  { id: "sch-1", get name() { return i18next.t('buildings_db.scholars_tower', "Scholar's Tower"); }, type: "Scholars Tower", level: 1, x: 957, y: 237, occupant: "" },
  { id: "sch-2", get name() { return i18next.t('buildings_db.scholars_tower', "Scholar's Tower"); }, type: "Scholars Tower", level: 1, x: 666, y: 267, occupant: "" },
  { id: "sch-3", get name() { return i18next.t('buildings_db.scholars_tower', "Scholar's Tower"); }, type: "Scholars Tower", level: 1, x: 237, y: 237, occupant: "" },
  { id: "sch-4", get name() { return i18next.t('buildings_db.scholars_tower', "Scholar's Tower"); }, type: "Scholars Tower", level: 1, x: 267, y: 537, occupant: "" },
  { id: "sch-5", get name() { return i18next.t('buildings_db.scholars_tower', "Scholar's Tower"); }, type: "Scholars Tower", level: 1, x: 237, y: 957, occupant: "" },
  { id: "sch-6", get name() { return i18next.t('buildings_db.scholars_tower', "Scholar's Tower"); }, type: "Scholars Tower", level: 1, x: 537, y: 936, occupant: "" },
  { id: "sch-7", get name() { return i18next.t('buildings_db.scholars_tower', "Scholar's Tower"); }, type: "Scholars Tower", level: 1, x: 936, y: 537, occupant: "" },
  { id: "sch-8", get name() { return i18next.t('buildings_db.scholars_tower', "Scholar's Tower"); }, type: "Scholars Tower", level: 1, x: 957, y: 957, occupant: "" },
  { id: "sch-9", get name() { return i18next.t('buildings_db.scholars_tower', "Scholar's Tower"); }, type: "Scholars Tower", level: 3, x: 867, y: 327, occupant: "" },
  { id: "sch-10", get name() { return i18next.t('buildings_db.scholars_tower', "Scholar's Tower"); }, type: "Scholars Tower", level: 3, x: 327, y: 327, occupant: "" },
  { id: "sch-11", get name() { return i18next.t('buildings_db.scholars_tower', "Scholar's Tower"); }, type: "Scholars Tower", level: 3, x: 327, y: 867, occupant: "" },
  { id: "sch-12", get name() { return i18next.t('buildings_db.scholars_tower', "Scholar's Tower"); }, type: "Scholars Tower", level: 3, x: 867, y: 867, occupant: "" },

  // --- Arsenal ---
  { id: "ars-1", get name() { return i18next.t('buildings_db.arsenal', "Arsenal"); }, type: "Arsenal", level: 2, x: 867, y: 138, occupant: "" },
  { id: "ars-2", get name() { return i18next.t('buildings_db.arsenal', "Arsenal"); }, type: "Arsenal", level: 2, x: 366, y: 138, occupant: "" },
  { id: "ars-3", get name() { return i18next.t('buildings_db.arsenal', "Arsenal"); }, type: "Arsenal", level: 2, x: 138, y: 438, occupant: "" },
  { id: "ars-4", get name() { return i18next.t('buildings_db.arsenal', "Arsenal"); }, type: "Arsenal", level: 2, x: 138, y: 867, occupant: "" },
  { id: "ars-5", get name() { return i18next.t('buildings_db.arsenal', "Arsenal"); }, type: "Arsenal", level: 2, x: 438, y: 1068, occupant: "" },
  { id: "ars-6", get name() { return i18next.t('buildings_db.arsenal', "Arsenal"); }, type: "Arsenal", level: 2, x: 1068, y: 327, occupant: "" },
  { id: "ars-7", get name() { return i18next.t('buildings_db.arsenal', "Arsenal"); }, type: "Arsenal", level: 2, x: 1068, y: 867, occupant: "" },
  { id: "ars-8", get name() { return i18next.t('buildings_db.arsenal', "Arsenal"); }, type: "Arsenal", level: 2, x: 867, y: 1068, occupant: "" },
  { id: "ars-9", get name() { return i18next.t('buildings_db.arsenal', "Arsenal"); }, type: "Arsenal", level: 4, x: 816, y: 486, occupant: "" },
  { id: "ars-10", get name() { return i18next.t('buildings_db.arsenal', "Arsenal"); }, type: "Arsenal", level: 4, x: 387, y: 486, occupant: "" },
  { id: "ars-11", get name() { return i18next.t('buildings_db.arsenal', "Arsenal"); }, type: "Arsenal", level: 4, x: 588, y: 867, occupant: "" },

  // --- Forager Grove ---
  { id: "for-1", get name() { return i18next.t('buildings_db.forager_grove', "Forager Grove"); }, type: "Forager Grove", level: 1, x: 957, y: 138, occupant: "" },
  { id: "for-2", get name() { return i18next.t('buildings_db.forager_grove', "Forager Grove"); }, type: "Forager Grove", level: 1, x: 537, y: 87, occupant: "" },
  { id: "for-3", get name() { return i18next.t('buildings_db.forager_grove', "Forager Grove"); }, type: "Forager Grove", level: 1, x: 138, y: 237, occupant: "" },
  { id: "for-4", get name() { return i18next.t('buildings_db.forager_grove', "Forager Grove"); }, type: "Forager Grove", level: 1, x: 87, y: 666, occupant: "" },
  { id: "for-5", get name() { return i18next.t('buildings_db.forager_grove', "Forager Grove"); }, type: "Forager Grove", level: 1, x: 267, y: 1068, occupant: "" },
  { id: "for-6", get name() { return i18next.t('buildings_db.forager_grove', "Forager Grove"); }, type: "Forager Grove", level: 1, x: 636, y: 1137, occupant: "" },
  { id: "for-7", get name() { return i18next.t('buildings_db.forager_grove', "Forager Grove"); }, type: "Forager Grove", level: 1, x: 1137, y: 567, occupant: "" },
  { id: "for-8", get name() { return i18next.t('buildings_db.forager_grove', "Forager Grove"); }, type: "Forager Grove", level: 1, x: 1068, y: 936, occupant: "" },

  // --- Harvest Alter (Altar) ---
  { id: "har-1", get name() { return i18next.t('buildings_db.harvest_altar', "Harvest Altar"); }, type: "Harvest Alter", level: 1, x: 1068, y: 237, occupant: "" },
  { id: "har-2", get name() { return i18next.t('buildings_db.harvest_altar', "Harvest Altar"); }, type: "Harvest Alter", level: 1, x: 768, y: 138, occupant: "" },
  { id: "har-3", get name() { return i18next.t('buildings_db.harvest_altar', "Harvest Altar"); }, type: "Harvest Alter", level: 1, x: 237, y: 138, occupant: "" },
  { id: "har-4", get name() { return i18next.t('buildings_db.harvest_altar', "Harvest Altar"); }, type: "Harvest Alter", level: 1, x: 138, y: 327, occupant: "" },
  { id: "har-5", get name() { return i18next.t('buildings_db.harvest_altar', "Harvest Altar"); }, type: "Harvest Alter", level: 1, x: 138, y: 957, occupant: "" },
  { id: "har-6", get name() { return i18next.t('buildings_db.harvest_altar', "Harvest Altar"); }, type: "Harvest Alter", level: 1, x: 327, y: 1038, occupant: "" },
  { id: "har-7", get name() { return i18next.t('buildings_db.harvest_altar', "Harvest Altar"); }, type: "Harvest Alter", level: 1, x: 1068, y: 747, occupant: "" },
  { id: "har-8", get name() { return i18next.t('buildings_db.harvest_altar', "Harvest Altar"); }, type: "Harvest Alter", level: 1, x: 957, y: 1068, occupant: "" },

  // --- Drill Camp ---
  { id: "dri-1", get name() { return i18next.t('buildings_db.drill_camp', "Drill Camp"); }, type: "Drill Camp", level: 2, x: 237, y: 486, occupant: "" },
  { id: "dri-2", get name() { return i18next.t('buildings_db.drill_camp', "Drill Camp"); }, type: "Drill Camp", level: 2, x: 138, y: 747, occupant: "" },
  { id: "dri-3", get name() { return i18next.t('buildings_db.drill_camp', "Drill Camp"); }, type: "Drill Camp", level: 2, x: 486, y: 957, occupant: "" },
  { id: "dri-4", get name() { return i18next.t('buildings_db.drill_camp', "Drill Camp"); }, type: "Drill Camp", level: 2, x: 768, y: 1038, occupant: "" },
  { id: "dri-5", get name() { return i18next.t('buildings_db.drill_camp', "Drill Camp"); }, type: "Drill Camp", level: 2, x: 957, y: 747, occupant: "" },
  { id: "dri-6", get name() { return i18next.t('buildings_db.drill_camp', "Drill Camp"); }, type: "Drill Camp", level: 2, x: 1068, y: 486, occupant: "" },
  { id: "dri-7", get name() { return i18next.t('buildings_db.drill_camp', "Drill Camp"); }, type: "Drill Camp", level: 2, x: 486, y: 138, occupant: "" },
  { id: "dri-8", get name() { return i18next.t('buildings_db.drill_camp', "Drill Camp"); }, type: "Drill Camp", level: 2, x: 768, y: 237, occupant: "" },

  // --- Frontier Lodge ---
  { id: "fro-1", get name() { return i18next.t('buildings_db.frontier_lodge', "Frontier Lodge"); }, type: "Frontier Lodge", level: 3, x: 768, y: 327, occupant: "" },
  { id: "fro-2", get name() { return i18next.t('buildings_db.frontier_lodge', "Frontier Lodge"); }, type: "Frontier Lodge", level: 3, x: 327, y: 567, occupant: "" },
  { id: "fro-3", get name() { return i18next.t('buildings_db.frontier_lodge', "Frontier Lodge"); }, type: "Frontier Lodge", level: 3, x: 486, y: 867, occupant: "" },
  { id: "fro-4", get name() { return i18next.t('buildings_db.frontier_lodge', "Frontier Lodge"); }, type: "Frontier Lodge", level: 3, x: 867, y: 666, occupant: "" }
];