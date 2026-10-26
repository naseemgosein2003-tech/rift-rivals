export type Weapon =
  | "Sword"
  | "Scythe"
  | "Blasters"
  | "Gauntlets"
  | "Axe"
  | "Hammer"
  | "Bow"
  | "Spear"
  | "Katars"
  | "Orb"
  | "Nunchucks"
  | "Chain Blade"
  | "Cannon";

export type WeaponWeightClass = "heavy" | "medium" | "light";

export const WEAPON_WEIGHT_CLASS: Record<Weapon, WeaponWeightClass> = {
  Cannon: "heavy",
  Hammer: "heavy",
  Axe: "heavy",
  Scythe: "medium",
  Spear: "medium",
  "Chain Blade": "medium",
  Sword: "medium",
  Bow: "medium",
  Blasters: "light",
  Gauntlets: "light",
  Katars: "light",
  Nunchucks: "light",
  Orb: "light",
};

/**
 * Base knockback multiplier per weapon type. Heavy weapons (Cannon, Hammer, Axe)
 * hit with crushing launch force, medium weapons balance combos and kill potential,
 * and light weapons enable rapid strings that only kill when health drops low.
 */
export const WEAPON_KNOCKBACK_MULT: Record<Weapon, number> = {
  Cannon: 1.36,
  Hammer: 1.3,
  Axe: 1.25,
  Scythe: 1.05,
  Spear: 1.03,
  "Chain Blade": 1.01,
  Sword: 0.98,
  Bow: 0.95,
  Orb: 0.86,
  Blasters: 0.84,
  Gauntlets: 0.79,
  Nunchucks: 0.77,
  Katars: 0.74,
};

export type Special =
  | "rift"
  | "overdrive"
  | "quake"
  | "rain"
  | "sandstorm"
  | "deadeye"
  | "singularity"
  | "frost"
  | "dragon"
  | "nova"
  | "whirlwind"
  | "chain_strike"
  | "broadside"
  | "sol_lotus"
  | "eruption"
  | "tempest"
  | "tidal_jaws"
  | "starfall"
  | "phoenix_arrow"
  | "mjolnir"
  | "crimson_vortex"
  | "kraken"
  | "darkheart"
  | "jade_cyclone"
  | "hellchain";

export type Archetype =
  "glass-cannon" | "speedster" | "brute" | "bulwark" | "zoner";

export interface ArchetypeInfo {
  id: Archetype;
  name: string;
  blurb: string;
  playstyle: string;
  accent: string;
}

export const ARCHETYPES: Record<Archetype, ArchetypeInfo> = {
  "glass-cannon": {
    id: "glass-cannon",
    name: "Glass Cannon",
    blurb: "Enormous damage, almost no staying power.",
    playstyle: "End fights before they start. One mistake is a lost stock.",
    accent: "#f0654f",
  },
  speedster: {
    id: "speedster",
    name: "Speedster",
    blurb: "Fastest movement and the quickest recovery in the rift.",
    playstyle:
      "Circle, poke, and punish. Never stand still long enough to be hit.",
    accent: "#f2c14e",
  },
  brute: {
    id: "brute",
    name: "Heavy Strength",
    blurb: "Slow, but every clean hit decides the exchange.",
    playstyle: "Read your rival once, then launch them off the stage.",
    accent: "#e07a3f",
  },
  bulwark: {
    id: "bulwark",
    name: "Heavy Defense",
    blurb: "Deep health pool and knockback that barely moves them.",
    playstyle: "Absorb the pressure and win the long game.",
    accent: "#5f9ea8",
  },
  zoner: {
    id: "zoner",
    name: "Zoner",
    blurb: "Longest reach in the game, weak up close.",
    playstyle: "Own the spacing. Make your rival come to you.",
    accent: "#7f9fd4",
  },
};

/**
 * Every stat runs 1-10 with 5 as the neutral baseline, so a stat of 5 behaves
 * exactly like the old fixed values and 10 is a 20-25% swing either way.
 */
export interface FighterStats {
  /** Damage dealt. */
  strength: number;
  /** Ground and air movement speed. */
  speed: number;
  /** Size of the health pool before a stock is lost. */
  health: number;
  /** Damage and knockback absorbed. */
  defense: number;
  /** How quickly attacks recover. */
  recovery: number;
  /** Hitbox reach. */
  reach: number;
}

export const STAT_LABELS: Record<keyof FighterStats, string> = {
  strength: "Strength",
  speed: "Speed",
  health: "Health",
  defense: "Defense",
  recovery: "Recovery",
  reach: "Reach",
};

export const STAT_KEYS = Object.keys(STAT_LABELS) as (keyof FighterStats)[];

export interface DerivedStats {
  /** Total damage a fighter can absorb before losing a stock. */
  maxHealth: number;
  /** Multiplier applied to outgoing damage. */
  damageScale: number;
  /** Multiplier applied to incoming damage. */
  damageTaken: number;
  /** Multiplier applied to movement speed. */
  moveScale: number;
  /** Multiplier applied to knockback received. Lower is tankier. */
  knockbackTaken: number;
  /** Multiplier applied to attack recovery. Lower is faster. */
  cooldownScale: number;
  /** Multiplier applied to hitbox reach. */
  reachScale: number;
}

export function deriveStats(stats: FighterStats): DerivedStats {
  return {
    maxHealth: Math.round(250 * (0.72 + stats.health * 0.056)),
    damageScale: 0.75 + stats.strength * 0.05,
    damageTaken: 1.18 - stats.defense * 0.036,
    moveScale: 0.82 + stats.speed * 0.036,
    knockbackTaken: 1.2 - stats.defense * 0.04,
    cooldownScale: 1.22 - stats.recovery * 0.044,
    reachScale: 0.9 + stats.reach * 0.02,
  };
}

export interface FighterDefinition {
  id: string;
  name: string;
  title: string;
  color: string;
  weapons: [Weapon, Weapon];
  speed: number;
  weight: number;
  archetype: Archetype;
  stats: FighterStats;
  special: { name: string; description: string; type: Special };
}

export const FIGHTERS: FighterDefinition[] = [
  {
    id: "ronin",
    name: "Ronin",
    title: "The Exiled Blade",
    color: "#ff763e",
    weapons: ["Sword", "Scythe"],
    speed: 340,
    weight: 1,
    archetype: "glass-cannon",
    stats: {
      strength: 9,
      speed: 7,
      health: 3,
      defense: 3,
      recovery: 6,
      reach: 7,
    },
    special: {
      name: "Rift Reaper",
      description:
        "Cut through the rift with a devastating, unstoppable blade dash.",
      type: "rift",
    },
  },
  {
    id: "vex",
    name: "Vex",
    title: "The Neon Outlaw",
    color: "#b78aff",
    weapons: ["Blasters", "Gauntlets"],
    speed: 370,
    weight: 0.9,
    archetype: "speedster",
    stats: {
      strength: 5,
      speed: 9,
      health: 4,
      defense: 4,
      recovery: 9,
      reach: 5,
    },
    special: {
      name: "Overdrive",
      description: "Unleash a rapid-fire barrage of supercharged plasma shots.",
      type: "overdrive",
    },
  },
  {
    id: "brakk",
    name: "Brakk",
    title: "The Mountain Breaker",
    color: "#f56c56",
    weapons: ["Axe", "Hammer"],
    speed: 290,
    weight: 1.3,
    archetype: "brute",
    stats: {
      strength: 10,
      speed: 2,
      health: 8,
      defense: 8,
      recovery: 2,
      reach: 7,
    },
    special: {
      name: "Cataclysm",
      description:
        "Shatter the ground and send two powerful shockwaves across the arena.",
      type: "quake",
    },
  },
  {
    id: "lyra",
    name: "Lyra",
    title: "The Astral Huntress",
    color: "#75dce3",
    weapons: ["Bow", "Spear"],
    speed: 355,
    weight: 0.9,
    archetype: "zoner",
    stats: {
      strength: 6,
      speed: 6,
      health: 5,
      defense: 4,
      recovery: 6,
      reach: 10,
    },
    special: {
      name: "Astral Rain",
      description:
        "Call down a constellation of piercing arrows above your rival.",
      type: "rain",
    },
  },
  {
    id: "azir",
    name: "Azir",
    title: "The Desert Phantom",
    color: "#e7c37b",
    weapons: ["Katars", "Sword"],
    speed: 385,
    weight: 0.9,
    archetype: "speedster",
    stats: {
      strength: 6,
      speed: 10,
      health: 3,
      defense: 3,
      recovery: 8,
      reach: 5,
    },
    special: {
      name: "Sandstorm",
      description:
        "Blink behind your opponent and strike in a golden whirlwind.",
      type: "sandstorm",
    },
  },
  {
    id: "jax",
    name: "Jax",
    title: "The Last Gunslinger",
    color: "#e3e980",
    weapons: ["Blasters", "Spear"],
    speed: 340,
    weight: 1,
    archetype: "zoner",
    stats: {
      strength: 7,
      speed: 5,
      health: 5,
      defense: 5,
      recovery: 5,
      reach: 9,
    },
    special: {
      name: "Deadeye",
      description:
        "Line up a piercing rail shot that reaches across the entire arena.",
      type: "deadeye",
    },
  },
  {
    id: "nyx",
    name: "Nyx",
    title: "The Void Weaver",
    color: "#b691e8",
    weapons: ["Scythe", "Orb"],
    speed: 325,
    weight: 0.95,
    archetype: "glass-cannon",
    stats: {
      strength: 10,
      speed: 5,
      health: 2,
      defense: 3,
      recovery: 5,
      reach: 8,
    },
    special: {
      name: "Singularity",
      description:
        "Create a dark vortex that pulls your rival into its explosive core.",
      type: "singularity",
    },
  },
  {
    id: "fenrir",
    name: "Fenrir",
    title: "The Winter Fang",
    color: "#a1d7f2",
    weapons: ["Hammer", "Gauntlets"],
    speed: 315,
    weight: 1.2,
    archetype: "bulwark",
    stats: {
      strength: 7,
      speed: 4,
      health: 9,
      defense: 10,
      recovery: 3,
      reach: 5,
    },
    special: {
      name: "Frostbite",
      description:
        "Detonate a ring of ice that launches and slows your opponent.",
      type: "frost",
    },
  },
  {
    id: "kai",
    name: "Kai",
    title: "The Ember Fist",
    color: "#ff985a",
    weapons: ["Gauntlets", "Katars"],
    speed: 380,
    weight: 0.9,
    archetype: "brute",
    stats: {
      strength: 9,
      speed: 6,
      health: 6,
      defense: 5,
      recovery: 5,
      reach: 4,
    },
    special: {
      name: "Dragon Rush",
      description:
        "Become a living flame and charge forward with a crushing dragon strike.",
      type: "dragon",
    },
  },
  {
    id: "zero",
    name: "Zero",
    title: "The Broken Protocol",
    color: "#abe891",
    weapons: ["Sword", "Orb"],
    speed: 330,
    weight: 1.1,
    archetype: "bulwark",
    stats: {
      strength: 5,
      speed: 5,
      health: 10,
      defense: 9,
      recovery: 5,
      reach: 6,
    },
    special: {
      name: "Protocol Zero",
      description:
        "Overload your core and release a massive radial energy blast.",
      type: "nova",
    },
  },
  {
    id: "ryuu",
    name: "Ryuu",
    title: "The Dragon Disciple",
    color: "#38bdf8",
    weapons: ["Nunchucks", "Katars"],
    speed: 385,
    weight: 0.9,
    archetype: "speedster",
    stats: {
      strength: 7,
      speed: 9,
      health: 4,
      defense: 4,
      recovery: 9,
      reach: 5,
    },
    special: {
      name: "Dragon Hurricane",
      description:
        "Spin twin nunchucks engulfed in azure dragon fire, trapping and launching rivals.",
      type: "whirlwind",
    },
  },
  {
    id: "kage",
    name: "Kage",
    title: "The Shadow Shinobi",
    color: "#c084fc",
    weapons: ["Chain Blade", "Scythe"],
    speed: 375,
    weight: 0.9,
    archetype: "glass-cannon",
    stats: {
      strength: 9,
      speed: 8,
      health: 3,
      defense: 3,
      recovery: 7,
      reach: 8,
    },
    special: {
      name: "Abyssal Snare",
      description:
        "Hurl a barbed chain across the arena to hook your rival and execute with a cross-slash.",
      type: "chain_strike",
    },
  },
  {
    id: "baron",
    name: "Baron",
    title: "The Iron Dreadnought",
    color: "#eab308",
    weapons: ["Cannon", "Hammer"],
    speed: 285,
    weight: 1.35,
    archetype: "brute",
    stats: {
      strength: 10,
      speed: 3,
      health: 8,
      defense: 8,
      recovery: 3,
      reach: 7,
    },
    special: {
      name: "Dreadnought Mortar",
      description:
        "Slam the cannon into the deck, unleashing a cluster barrage across the arena.",
      type: "broadside",
    },
  },
  {
    id: "kira",
    name: "Kira",
    title: "The Gilded Valkyrie",
    color: "#f43f5e",
    weapons: ["Chain Blade", "Sword"],
    speed: 345,
    weight: 1.0,
    archetype: "zoner",
    stats: {
      strength: 8,
      speed: 6,
      health: 5,
      defense: 5,
      recovery: 6,
      reach: 9,
    },
    special: {
      name: "Solar Lotus",
      description:
        "Ascend and lash outward in radiant flashes, blooming into a blinding solar nova.",
      type: "sol_lotus",
    },
  },
  {
    id: "drakon",
    name: "Drakon",
    title: "The Magma Titan",
    color: "#ea580c",
    weapons: ["Cannon", "Axe"],
    speed: 295,
    weight: 1.4,
    archetype: "bulwark",
    stats: {
      strength: 8,
      speed: 3,
      health: 10,
      defense: 9,
      recovery: 3,
      reach: 7,
    },
    special: {
      name: "Magma Cataclysm",
      description:
        "Embed the cannon into the floor, detonating a volcanic geyser that erupts through the platform.",
      type: "eruption",
    },
  },
  {
    id: "volt",
    name: "Volt",
    title: "The Storm Striker",
    color: "#22d3ee",
    weapons: ["Nunchucks", "Blasters"],
    speed: 388,
    weight: 0.89,
    archetype: "speedster",
    stats: {
      strength: 6,
      speed: 10,
      health: 4,
      defense: 3,
      recovery: 9,
      reach: 5,
    },
    special: {
      name: "Tempest Volley",
      description:
        "Surge forward in a crackle of arc lightning, firing twin electro-shock bolts.",
      type: "tempest",
    },
  },
  {
    id: "mako",
    name: "Mako",
    title: "The Abyssal Shark",
    color: "#14b8a6",
    weapons: ["Katars", "Axe"],
    speed: 365,
    weight: 1.08,
    archetype: "brute",
    stats: {
      strength: 9,
      speed: 7,
      health: 6,
      defense: 6,
      recovery: 5,
      reach: 5,
    },
    special: {
      name: "Tidal Jaws",
      description:
        "Breach through the stage in a crushing hydro-wave that snaps shut on rivals.",
      type: "tidal_jaws",
    },
  },
  {
    id: "orion",
    name: "Orion",
    title: "The Celestial Lancer",
    color: "#fbbf24",
    weapons: ["Spear", "Orb"],
    speed: 345,
    weight: 1.04,
    archetype: "zoner",
    stats: {
      strength: 7,
      speed: 6,
      health: 6,
      defense: 6,
      recovery: 6,
      reach: 9,
    },
    special: {
      name: "Starfall Lance",
      description:
        "Summon a pillar of golden starlight ahead and hurl a cosmic lance through it.",
      type: "starfall",
    },
  },
  {
    id: "ember",
    name: "Ember",
    title: "The Wildwood Ranger",
    color: "#4ade80",
    weapons: ["Bow", "Katars"],
    speed: 378,
    weight: 0.87,
    archetype: "glass-cannon",
    stats: {
      strength: 9,
      speed: 8,
      health: 3,
      defense: 3,
      recovery: 8,
      reach: 8,
    },
    special: {
      name: "Phoenix Arrow",
      description:
        "Loose a blazing sylvan spirit arrow that splits the air at blinding speed.",
      type: "phoenix_arrow",
    },
  },
  {
    id: "thor",
    name: "Thor",
    title: "The Thunder God",
    color: "#818cf8",
    weapons: ["Hammer", "Orb"],
    speed: 318,
    weight: 1.24,
    archetype: "brute",
    stats: {
      strength: 9,
      speed: 4,
      health: 8,
      defense: 8,
      recovery: 4,
      reach: 6,
    },
    special: {
      name: "Mjolnir Drop",
      description:
        "Call thunder from the heavens, detonating a twin storm-hammer shockwave.",
      type: "mjolnir",
    },
  },
  {
    id: "mirage",
    name: "Mirage",
    title: "The Dune Weaver",
    color: "#fb7185",
    weapons: ["Scythe", "Spear"],
    speed: 362,
    weight: 0.91,
    archetype: "glass-cannon",
    stats: {
      strength: 9,
      speed: 7,
      health: 3,
      defense: 4,
      recovery: 6,
      reach: 9,
    },
    special: {
      name: "Crimson Vortex",
      description:
        "Step through a mirage and unleash a spinning crimson scythe cyclone.",
      type: "crimson_vortex",
    },
  },
  {
    id: "sidra",
    name: "Sidra",
    title: "The Corsair Queen",
    color: "#f97316",
    weapons: ["Cannon", "Sword"],
    speed: 332,
    weight: 1.14,
    archetype: "brute",
    stats: {
      strength: 8,
      speed: 5,
      health: 7,
      defense: 7,
      recovery: 5,
      reach: 7,
    },
    special: {
      name: "Kraken Broadside",
      description:
        "Fire an oversized corsair cannonball that explodes with crushing force.",
      type: "kraken",
    },
  },
  {
    id: "petra",
    name: "Petra",
    title: "The Darkheart Brawler",
    color: "#ec4899",
    weapons: ["Gauntlets", "Orb"],
    speed: 372,
    weight: 0.92,
    archetype: "glass-cannon",
    stats: {
      strength: 10,
      speed: 7,
      health: 3,
      defense: 3,
      recovery: 7,
      reach: 5,
    },
    special: {
      name: "Darkheart Beam",
      description:
        "Unleash a concentrated beam of volatile Darkheart energy across the stage.",
      type: "darkheart",
    },
  },
  {
    id: "shin",
    name: "Shin",
    title: "The Jade Monk",
    color: "#10b981",
    weapons: ["Nunchucks", "Spear"],
    speed: 348,
    weight: 1.12,
    archetype: "bulwark",
    stats: {
      strength: 6,
      speed: 6,
      health: 9,
      defense: 9,
      recovery: 6,
      reach: 7,
    },
    special: {
      name: "Jade Cyclone",
      description:
        "Revolve staff and nunchucks into a radiant jade barrier that repels all foes.",
      type: "jade_cyclone",
    },
  },
  {
    id: "warden",
    name: "Warden",
    title: "The Hellchain Jailer",
    color: "#f59e0b",
    weapons: ["Chain Blade", "Gauntlets"],
    speed: 312,
    weight: 1.28,
    archetype: "bulwark",
    stats: {
      strength: 7,
      speed: 4,
      health: 10,
      defense: 9,
      recovery: 4,
      reach: 7,
    },
    special: {
      name: "Infernal Lockdown",
      description:
        "Whip blazing iron chains across both sides of the arena, snaring nearby rivals.",
      type: "hellchain",
    },
  },
];

export interface StagePlatform {
  x: number;
  y: number;
  w: number;
  h: number;
  main?: boolean;
  /** Oscillating platform; fighters ride it while grounded. */
  move?: { axis: "x" | "y"; range: number; speed: number };
}

export type Hazard = "none" | "wind" | "lava";

export interface StageDefinition {
  id: string;
  name: string;
  tagline: string;
  art: string;
  accent: string;
  /** Sky gradient used behind the artwork so every stage reads differently. */
  sky: [string, string];
  hazard: Hazard;
  hazardText: string;
  /** Extra space beyond the screen before a fighter is ringed out. */
  blastMargin: number;
  /** Ground traction. Below 1 the stage is slippery. */
  friction: number;
  platforms: StagePlatform[];
}

export const STAGES: StageDefinition[] = [
  {
    id: "fracture",
    name: "The Fracture",
    tagline: "Balanced ruins. Two ledges, fair sightlines.",
    art: "/images/arena.jpg",
    accent: "#f5824b",
    sky: ["#0b1424", "#141d2e"],
    hazard: "none",
    hazardText: "No hazards. Pure fundamentals.",
    blastMargin: 120,
    friction: 1,
    platforms: [
      { x: 225, y: 545, w: 830, h: 28, main: true },
      { x: 355, y: 395, w: 175, h: 14 },
      { x: 750, y: 395, w: 175, h: 14 },
    ],
  },
  {
    id: "skyforge",
    name: "Skyforge",
    tagline: "One broad deck over the void. Ring-outs decide everything.",
    art: "/images/stage-skyforge.jpg",
    accent: "#6fb2d8",
    sky: ["#0a1a26", "#16283a"],
    hazard: "wind",
    hazardText: "Gusts shove both fighters toward the edge.",
    blastMargin: 90,
    friction: 1,
    platforms: [
      { x: 170, y: 520, w: 940, h: 34, main: true },
      { x: 565, y: 358, w: 150, h: 14 },
    ],
  },
  {
    id: "ember",
    name: "Ember Depths",
    tagline: "A rising tower above molten rock. Do not get pushed down.",
    art: "/images/stage-ember.jpg",
    accent: "#ff8a3c",
    sky: ["#1a0e0c", "#2a1512"],
    hazard: "lava",
    hazardText: "The melt below scorches anyone who falls too far.",
    blastMargin: 70,
    friction: 1,
    platforms: [
      { x: 250, y: 560, w: 780, h: 26, main: true },
      { x: 540, y: 410, w: 200, h: 14 },
      { x: 300, y: 288, w: 132, h: 14 },
      { x: 848, y: 288, w: 132, h: 14 },
    ],
  },
  {
    id: "sprawl",
    name: "Neon Sprawl",
    tagline: "Tight rooftops and a drifting platform. Close quarters only.",
    art: "/images/stage-sprawl.jpg",
    accent: "#c58ad8",
    sky: ["#120f1e", "#1d1830"],
    hazard: "none",
    hazardText: "A single platform slides back and forth.",
    blastMargin: 110,
    friction: 1,
    platforms: [
      { x: 340, y: 575, w: 600, h: 24, main: true },
      { x: 236, y: 462, w: 226, h: 14 },
      { x: 818, y: 462, w: 226, h: 14 },
      {
        x: 520,
        y: 344,
        w: 240,
        h: 14,
        move: { axis: "x", range: 105, speed: 0.55 },
      },
    ],
  },
  {
    id: "spire",
    name: "Frozen Spire",
    tagline: "Sheer ice. Momentum carries further than you want it to.",
    art: "/images/stage-spire.jpg",
    accent: "#8fd6ea",
    sky: ["#0c1622", "#152634"],
    hazard: "none",
    hazardText: "Low traction. Every dash overshoots.",
    blastMargin: 100,
    friction: 0.62,
    platforms: [
      { x: 280, y: 550, w: 720, h: 26, main: true },
      { x: 178, y: 418, w: 172, h: 14 },
      { x: 930, y: 418, w: 172, h: 14 },
    ],
  },
];

export const DEFAULT_STAGE = STAGES[0].id;

export function getStage(id: string): StageDefinition {
  return STAGES.find((s) => s.id === id) ?? STAGES[0];
}

export interface WeaponDefinition {
  damage: number;
  heavyDamage: number;
  range: number;
  cooldown: number;
  ranged?: boolean;
}

export const WEAPONS: Record<Weapon, WeaponDefinition> = {
  Sword: { damage: 10, heavyDamage: 18, range: 110, cooldown: 0.29 },
  Scythe: { damage: 11, heavyDamage: 20, range: 135, cooldown: 0.35 },
  Blasters: {
    damage: 7,
    heavyDamage: 14,
    range: 520,
    cooldown: 0.28,
    ranged: true,
  },
  Gauntlets: { damage: 8, heavyDamage: 15, range: 82, cooldown: 0.24 },
  Axe: { damage: 13, heavyDamage: 24, range: 115, cooldown: 0.41 },
  Hammer: { damage: 14, heavyDamage: 26, range: 108, cooldown: 0.45 },
  Bow: {
    damage: 9,
    heavyDamage: 17,
    range: 600,
    cooldown: 0.34,
    ranged: true,
  },
  Spear: { damage: 10, heavyDamage: 19, range: 150, cooldown: 0.33 },
  Katars: { damage: 7, heavyDamage: 14, range: 85, cooldown: 0.23 },
  Orb: {
    damage: 9,
    heavyDamage: 17,
    range: 460,
    cooldown: 0.35,
    ranged: true,
  },
  Nunchucks: { damage: 8, heavyDamage: 15, range: 94, cooldown: 0.23 },
  "Chain Blade": { damage: 10, heavyDamage: 19, range: 170, cooldown: 0.34 },
  Cannon: { damage: 14, heavyDamage: 25, range: 130, cooldown: 0.44 },
};

export type Difficulty = "novice" | "rookie" | "rival" | "veteran" | "legend";

export const DIFFICULTIES: Difficulty[] = [
  "novice",
  "rookie",
  "rival",
  "veteran",
  "legend",
];

/** Tuning for the CPU opponent. Every tier is a genuinely different fight. */
export interface AIProfile {
  label: string;
  blurb: string;
  /** Seconds between decisions. Lower reacts faster. */
  reaction: number;
  /** Chance to commit to an attack when in range. */
  aggression: number;
  /** Chance to dodge a telegraphed attack. */
  dodge: number;
  /** Chance to pick the best directional attack instead of a neutral one. */
  precision: number;
  /** Chance to fire the signature move when it is charged and in range. */
  special: number;
  /** Chance to chase a launched rival off the stage. */
  edgeGuard: number;
  /** Chance to keep pressing after a landed hit. */
  followUp: number;
  /** Movement speed scale, so lower tiers feel less relentless. */
  speed: number;
  /** How often the CPU simply waits, which creates openings. */
  idle: number;
}

export const AI_PROFILES: Record<Difficulty, AIProfile> = {
  novice: {
    label: "Novice",
    blurb: "Learning the ropes. Perfect for your first match.",
    reaction: 0.42,
    aggression: 0.3,
    dodge: 0,
    precision: 0.05,
    special: 0.25,
    edgeGuard: 0,
    followUp: 0.1,
    speed: 0.72,
    idle: 0.34,
  },
  rookie: {
    label: "Rookie",
    blurb: "Find your rhythm. Land your first real combo.",
    reaction: 0.27,
    aggression: 0.5,
    dodge: 0.05,
    precision: 0.25,
    special: 0.5,
    edgeGuard: 0.1,
    followUp: 0.25,
    speed: 0.86,
    idle: 0.18,
  },
  rival: {
    label: "Rival",
    blurb: "A worthy opponent. Stay on your toes.",
    reaction: 0.17,
    aggression: 0.74,
    dodge: 0.32,
    precision: 0.55,
    special: 0.75,
    edgeGuard: 0.35,
    followUp: 0.5,
    speed: 0.96,
    idle: 0.08,
  },
  veteran: {
    label: "Veteran",
    blurb: "Reads your habits and punishes every mistake.",
    reaction: 0.12,
    aggression: 0.87,
    dodge: 0.52,
    precision: 0.78,
    special: 0.9,
    edgeGuard: 0.6,
    followUp: 0.7,
    speed: 1,
    idle: 0.03,
  },
  legend: {
    label: "Legend",
    blurb: "No hesitation. No easy victories.",
    reaction: 0.08,
    aggression: 0.96,
    dodge: 0.72,
    precision: 0.93,
    special: 1,
    edgeGuard: 0.85,
    followUp: 0.85,
    speed: 1,
    idle: 0,
  },
};

export interface Settings {
  mode: "cpu" | "local";
  difficulty: Difficulty;
  opponent: string;
  stage: string;
  stocks: number;
  /** Match length in seconds; zero means no time limit. */
  timeLimit: number;
  sound: boolean;
  shake: boolean;
}

export const STOCK_OPTIONS = [1, 2, 3, 5, 7] as const;
export const TIME_OPTIONS = [0, 120, 180, 300, 480, 600] as const;

export const DEFAULT_SETTINGS: Settings = {
  mode: "cpu",
  difficulty: "rookie",
  opponent: "vex",
  stage: DEFAULT_STAGE,
  stocks: 3,
  timeLimit: 0,
  sound: true,
  shake: true,
};

/**
 * Repeating the same stance is taxed so pressure has to be earned. Repeating
 * it a third time in a row costs more again; any other move clears the tax.
 */
export const SPAM_TAX = {
  first: 1,
  second: 1.28,
  third: 1.62,
  /** Frames of the memory window before the tax decays away. */
  memory: 0.85,
};

export interface HighScore {
  id: string;
  fighter: string;
  score: number;
  combo: number;
  won: boolean;
  date: string;
  mode: "cpu" | "local";
  player?: number;
}

export function readStorage<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* The game still works when storage is unavailable. */
  }
}

export function loadScores(): HighScore[] {
  const value = readStorage<unknown>("rift-rivals-scores", []);
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item): item is HighScore =>
        !!item &&
        typeof item === "object" &&
        typeof item.score === "number" &&
        typeof item.fighter === "string" &&
        typeof item.date === "string",
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

export function loadSettings(): Settings {
  const value = readStorage<Partial<Settings>>("rift-rivals-settings", {});
  if (!value || typeof value !== "object") return DEFAULT_SETTINGS;
  return {
    mode: value.mode === "local" ? "local" : "cpu",
    difficulty: DIFFICULTIES.includes(value.difficulty as Difficulty)
      ? value.difficulty!
      : "rookie",
    opponent: FIGHTERS.some((f) => f.id === value.opponent)
      ? value.opponent!
      : "vex",
    stage: STAGES.some((s) => s.id === value.stage)
      ? value.stage!
      : DEFAULT_STAGE,
    stocks: STOCK_OPTIONS.includes(
      value.stocks as (typeof STOCK_OPTIONS)[number],
    )
      ? value.stocks!
      : DEFAULT_SETTINGS.stocks,
    timeLimit: TIME_OPTIONS.includes(
      value.timeLimit as (typeof TIME_OPTIONS)[number],
    )
      ? value.timeLimit!
      : DEFAULT_SETTINGS.timeLimit,
    sound: typeof value.sound === "boolean" ? value.sound : true,
    shake:
      typeof value.shake === "boolean"
        ? value.shake
        : !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  };
}
