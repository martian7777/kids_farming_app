// =============================================================
//  state.js — Centralized reactive game state
//  A tiny pub/sub store with localStorage persistence.
// =============================================================

const STORAGE_KEY = 'cozyfarm.save.v1';

// ---- Crop definitions -------------------------------------------------
// growTime: seconds per stage (3 stages: sprout -> growing -> ripe)
// needsWater: how many waterings to reach full health bonus
export const CROPS = {
  wheat: {
    id: 'wheat', name: 'Wheat', emoji: '🌾', color: 0xe9c46a,
    seedCost: 5, reward: 12, xp: 8, growTime: 6, unlockLevel: 1,
    fact: 'Wheat becomes flour for bread!',
  },
  carrot: {
    id: 'carrot', name: 'Carrot', emoji: '🥕', color: 0xf4833b,
    seedCost: 8, reward: 20, xp: 12, growTime: 8, unlockLevel: 1,
    fact: 'Carrots grow DOWN into the soil.',
  },
  strawberry: {
    id: 'strawberry', name: 'Strawberry', emoji: '🍓', color: 0xff5d8f,
    seedCost: 14, reward: 35, xp: 18, growTime: 11, unlockLevel: 2,
    fact: 'Strawberries wear their seeds on the outside!',
  },
  pumpkin: {
    id: 'pumpkin', name: 'Pumpkin', emoji: '🎃', color: 0xff8c2b,
    seedCost: 22, reward: 60, xp: 28, growTime: 16, unlockLevel: 3,
    fact: 'A pumpkin is actually a fruit, not a veggie!',
  },
  golden: {
    id: 'golden', name: 'Golden Crop', emoji: '🌟', color: 0xffd34e,
    seedCost: 50, reward: 160, xp: 70, growTime: 24, unlockLevel: 5,
    fact: 'The rare Golden Crop only grows for master farmers!',
  },
};

// ---- Vehicle definitions ---------------------------------------------
export const VEHICLES = {
  foot: {
    id: 'foot', name: 'On Foot', emoji: '👟', speed: 4.2, waterTank: 100,
    cost: 0, owned: true, job: 'Walk anywhere and do every job by hand.',
    teaches: 'Your own two feet are the first farm tool!',
  },
  quad: {
    id: 'quad', name: 'Quad Bike', emoji: '🛵', speed: 6.5, waterTank: 120,
    cost: 80, owned: false, job: 'Zooms around the farm fast to save time.',
    teaches: 'Quad bikes have 4 fat tyres for bumpy fields.',
  },
  tractor: {
    id: 'tractor', name: 'Tractor', emoji: '🚜', speed: 5.2, waterTank: 200,
    cost: 180, owned: false, job: 'Tills soil and plants seeds as it drives!',
    teaches: 'Tractors pull heavy tools called attachments.',
    autoPlant: true,
  },
  truck: {
    id: 'truck', name: 'Utility Truck', emoji: '🛻', speed: 5.8, waterTank: 320,
    cost: 320, owned: false, job: 'Carries lots of water and auto-harvests ripe crops.',
    teaches: 'Trucks haul harvests and supplies to market.',
    autoHarvest: true,
  },
};

// ---- Upgrades / attachments ------------------------------------------
export const UPGRADES = {
  bigtank: { id: 'bigtank', name: 'Big Water Tank', emoji: '🛢️', cost: 60, desc: 'Carry 50% more water.', owned: false },
  sprinkler: { id: 'sprinkler', name: 'Sprinkler Kit', emoji: '🚿', cost: 90, desc: 'Watering covers nearby tiles too.', owned: false },
  fastseed: { id: 'fastseed', name: 'Magic Seeds', emoji: '✨', cost: 120, desc: 'Crops grow 25% faster.', owned: false },
};

function defaultState() {
  return {
    coins: 30,
    xp: 0,
    level: 1,
    day: 1,
    timeOfDay: 0.28,        // 0..1 (0=dawn, .5=noon-ish, 1=midnight)
    water: 100,
    muted: false,
    activeVehicle: 'foot',
    activeSeed: 'wheat',
    vehicles: { foot: true, quad: false, tractor: false, truck: false },
    upgrades: { bigtank: false, sprinkler: false, fastseed: false },
    lessons: {},            // lessonId -> { completed:true, medal:'gold'|'silver' }
    stats: { planted: 0, harvested: 0, watered: 0, lessonsDone: 0 },
  };
}

export const xpForLevel = (lvl) => 100 + (lvl - 1) * 80;

class Store {
  constructor() {
    this.state = this._load();
    this.listeners = new Set();
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...defaultState(), ...JSON.parse(raw) };
    } catch (_) { /* ignore corrupt saves */ }
    return defaultState();
  }

  save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state)); } catch (_) {}
  }

  reset() {
    this.state = defaultState();
    this.emit();
    this.save();
  }

  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { for (const fn of this.listeners) fn(this.state); }

  // Mutate then notify + persist
  set(patch) {
    Object.assign(this.state, patch);
    this.emit();
    this.save();
  }

  // ---- Economy helpers ----
  addCoins(n) { this.set({ coins: Math.max(0, Math.round(this.state.coins + n)) }); }
  spend(n) {
    if (this.state.coins < n) return false;
    this.addCoins(-n);
    return true;
  }

  // Returns { leveledUp, newLevel } so UI can celebrate.
  addXp(n) {
    let { xp, level } = this.state;
    xp += n;
    let leveledUp = false;
    while (xp >= xpForLevel(level)) {
      xp -= xpForLevel(level);
      level += 1;
      leveledUp = true;
    }
    this.set({ xp, level });
    return { leveledUp, newLevel: level };
  }

  useWater(n) {
    const w = Math.max(0, this.state.water - n);
    this.set({ water: w });
    return w;
  }
  refillWater() {
    const cap = this.vehicleWaterCap();
    this.set({ water: cap });
  }

  vehicleWaterCap() {
    let cap = VEHICLES[this.state.activeVehicle].waterTank;
    if (this.state.upgrades.bigtank) cap = Math.round(cap * 1.5);
    return cap;
  }

  growthMultiplier() {
    return this.state.upgrades.fastseed ? 0.75 : 1;
  }

  isCropUnlocked(id) { return this.state.level >= CROPS[id].unlockLevel; }
}

export const store = new Store();
