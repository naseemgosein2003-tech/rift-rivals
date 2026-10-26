import type { Engine, Fighter } from "./engine";
import type { Weapon } from "./data";
import type { MoveDef } from "./moves";
import { attackPoseValue, sampleAttackMotion } from "./attackAnimation";
import { dodgeProgress, rollEase } from "./dodge";

const TAU = Math.PI * 2;

function polygon(
  ctx: CanvasRenderingContext2D,
  points: number[],
  fill: string | CanvasGradient,
  stroke?: string,
  lineWidth = 1,
) {
  ctx.beginPath();
  ctx.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2)
    ctx.lineTo(points[i], points[i + 1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

function line(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  width = 2,
) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

// Gradients are expensive to rebuild, so they are cached per context.
let cacheOwner: CanvasRenderingContext2D | null = null;
const radialCache = new Map<string, CanvasGradient>();
const torsoCache = new Map<string, CanvasGradient>();

function resetCaches(ctx: CanvasRenderingContext2D) {
  if (cacheOwner === ctx) return;
  cacheOwner = ctx;
  radialCache.clear();
  torsoCache.clear();
}

function glow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  opacity = 0.2,
) {
  const key = `${color}|${Math.round(radius)}`;
  let gradient = radialCache.get(key);
  if (!gradient) {
    gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, "transparent");
    radialCache.set(key, gradient);
  }
  ctx.save();
  ctx.globalAlpha *= opacity;
  ctx.translate(x, y);
  ctx.fillStyle = gradient;
  ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
  ctx.restore();
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeIn = (t: number) => t * t;

/** Two-bone inverse kinematics, used for every arm and leg. */
function joint(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  l1: number,
  l2: number,
  bend: number,
) {
  const dx = bx - ax;
  const dy = by - ay;
  const d = Math.max(0.01, Math.min(Math.hypot(dx, dy), l1 + l2 - 0.5));
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const mx = ax + (dx / d) * a;
  const my = ay + (dy / d) * a;
  return { x: mx + h * (dy / d) * bend, y: my - h * (dx / d) * bend };
}

/** Tapered limb segment with a soft highlight along its top edge. */
function bone(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  w1: number,
  w2: number,
  fill: string,
  shade: string,
) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const half = Math.PI / 2;
  // One capsule path keeps limb rendering to two draw calls.
  ctx.beginPath();
  ctx.arc(x1, y1, w1, angle + half, angle - half);
  ctx.arc(x2, y2, w2, angle - half, angle + half);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  const nx = Math.cos(angle + half);
  const ny = Math.sin(angle + half);
  ctx.beginPath();
  ctx.moveTo(x1 + nx * w1 * 0.42, y1 + ny * w1 * 0.42);
  ctx.lineTo(x2 + nx * w2 * 0.42, y2 + ny * w2 * 0.42);
  ctx.strokeStyle = shade;
  ctx.lineWidth = Math.max(1, w2 * 0.55);
  ctx.stroke();
}

interface Palette {
  skin: string;
  skinShade: string;
  suit: string;
  suitLight: string;
  armor: string;
  armorLight: string;
  cloth: string;
  accent: string;
}

const PALETTES: Record<string, Palette> = {
  ronin: {
    skin: "#2b3747",
    skinShade: "#1a2431",
    suit: "#1e2835",
    suitLight: "#334155",
    armor: "#cdcec2",
    armorLight: "#e9eae0",
    cloth: "#ff763e",
    accent: "#ff763e",
  },
  vex: {
    skin: "#caa088",
    skinShade: "#9d7460",
    suit: "#2a2340",
    suitLight: "#453a63",
    armor: "#7b5fae",
    armorLight: "#a98fd8",
    cloth: "#5a3f8c",
    accent: "#b78aff",
  },
  brakk: {
    skin: "#bd7a5c",
    skinShade: "#8e5540",
    suit: "#3a2b28",
    suitLight: "#56403a",
    armor: "#8d8f98",
    armorLight: "#b9bcc4",
    cloth: "#8c4a35",
    accent: "#f56c56",
  },
  lyra: {
    skin: "#e0cab6",
    skinShade: "#b29c89",
    suit: "#1d3a46",
    suitLight: "#2f5a68",
    armor: "#4d8793",
    armorLight: "#7fc0cb",
    cloth: "#2b5a66",
    accent: "#75dce3",
  },
  azir: {
    skin: "#b98a62",
    skinShade: "#8a6344",
    suit: "#3a3122",
    suitLight: "#574a33",
    armor: "#b59a68",
    armorLight: "#dcc08a",
    cloth: "#8c7442",
    accent: "#e7c37b",
  },
  jax: {
    skin: "#86604f",
    skinShade: "#5f4337",
    suit: "#2c3140",
    suitLight: "#454d60",
    armor: "#616b7a",
    armorLight: "#8e99a8",
    cloth: "#5c6330",
    accent: "#e3e980",
  },
  nyx: {
    skin: "#a594bb",
    skinShade: "#7c6c93",
    suit: "#2c2648",
    suitLight: "#443a69",
    armor: "#4a3c6b",
    armorLight: "#6f5d99",
    cloth: "#372c58",
    accent: "#b691e8",
  },
  fenrir: {
    skin: "#d8e1e7",
    skinShade: "#a8b6c0",
    suit: "#33414f",
    suitLight: "#4e6173",
    armor: "#8fa3b4",
    armorLight: "#bdcedb",
    cloth: "#3e5566",
    accent: "#a1d7f2",
  },
  kai: {
    skin: "#caa085",
    skinShade: "#9b7560",
    suit: "#36231f",
    suitLight: "#543630",
    armor: "#a33d29",
    armorLight: "#d4624a",
    cloth: "#8c2f1e",
    accent: "#ff985a",
  },
  zero: {
    skin: "#2c3b3c",
    skinShade: "#1b2727",
    suit: "#1f2e2d",
    suitLight: "#324745",
    armor: "#5c7570",
    armorLight: "#86a39c",
    cloth: "#24403c",
    accent: "#abe891",
  },
  ryuu: {
    skin: "#d8af8c",
    skinShade: "#a37b58",
    suit: "#162338",
    suitLight: "#253b5a",
    armor: "#38bdf8",
    armorLight: "#bae6fd",
    cloth: "#0284c7",
    accent: "#38bdf8",
  },
  kage: {
    skin: "#231f33",
    skinShade: "#151221",
    suit: "#1e1a2e",
    suitLight: "#352c4f",
    armor: "#6b21a8",
    armorLight: "#e9d5ff",
    cloth: "#7e22ce",
    accent: "#c084fc",
  },
  baron: {
    skin: "#a87c5e",
    skinShade: "#7c553a",
    suit: "#2b251e",
    suitLight: "#463d30",
    armor: "#a16207",
    armorLight: "#fef08a",
    cloth: "#713f12",
    accent: "#eab308",
  },
  kira: {
    skin: "#f0d5c2",
    skinShade: "#c7a48d",
    suit: "#331622",
    suitLight: "#542436",
    armor: "#be123c",
    armorLight: "#fecdd3",
    cloth: "#9f1239",
    accent: "#f43f5e",
  },
  drakon: {
    skin: "#2b140c",
    skinShade: "#170a06",
    suit: "#33160e",
    suitLight: "#522517",
    armor: "#9a3412",
    armorLight: "#fdba74",
    cloth: "#7c2d12",
    accent: "#ea580c",
  },
  volt: {
    skin: "#d6ad92",
    skinShade: "#a27b61",
    suit: "#102333",
    suitLight: "#1d3d57",
    armor: "#0e7490",
    armorLight: "#67e8f9",
    cloth: "#0891b2",
    accent: "#22d3ee",
  },
  mako: {
    skin: "#23545c",
    skinShade: "#14353b",
    suit: "#112c33",
    suitLight: "#1e4b56",
    armor: "#0f766e",
    armorLight: "#5eead4",
    cloth: "#0d9488",
    accent: "#14b8a6",
  },
  orion: {
    skin: "#1f2436",
    skinShade: "#111524",
    suit: "#1d2238",
    suitLight: "#313a5e",
    armor: "#d97706",
    armorLight: "#fde68a",
    cloth: "#b45309",
    accent: "#fbbf24",
  },
  ember: {
    skin: "#e5cbb8",
    skinShade: "#b59a86",
    suit: "#152b1e",
    suitLight: "#254934",
    armor: "#15803d",
    armorLight: "#86efac",
    cloth: "#166534",
    accent: "#4ade80",
  },
  thor: {
    skin: "#d9a98b",
    skinShade: "#a87b5e",
    suit: "#1d2240",
    suitLight: "#303a68",
    armor: "#6366f1",
    armorLight: "#c7d2fe",
    cloth: "#4338ca",
    accent: "#818cf8",
  },
  mirage: {
    skin: "#b88464",
    skinShade: "#8a5f44",
    suit: "#331420",
    suitLight: "#542235",
    armor: "#be123c",
    armorLight: "#fda4af",
    cloth: "#9f1239",
    accent: "#fb7185",
  },
  sidra: {
    skin: "#9c6b4e",
    skinShade: "#6f4933",
    suit: "#2b1d19",
    suitLight: "#4a322a",
    armor: "#c2410c",
    armorLight: "#fdba74",
    cloth: "#9a3412",
    accent: "#f97316",
  },
  petra: {
    skin: "#d19c87",
    skinShade: "#a16f5c",
    suit: "#2f1126",
    suitLight: "#521e43",
    armor: "#be185d",
    armorLight: "#f9a8d4",
    cloth: "#9d174d",
    accent: "#ec4899",
  },
  shin: {
    skin: "#d7b18e",
    skinShade: "#a88362",
    suit: "#132a24",
    suitLight: "#21493f",
    armor: "#059669",
    armorLight: "#6ee7b7",
    cloth: "#047857",
    accent: "#10b981",
  },
  warden: {
    skin: "#261c16",
    skinShade: "#140e0b",
    suit: "#261b12",
    suitLight: "#422f1f",
    armor: "#b45309",
    armorLight: "#fcd34d",
    cloth: "#92400e",
    accent: "#f59e0b",
  },
};

/** Per-fighter proportions so no two silhouettes read the same. */
interface Build {
  /** Overall height scale. */
  tall: number;
  /** Horizontal bulk. */
  wide: number;
  /** Shoulder spread. */
  shoulder: number;
  /** Head size. */
  head: number;
}

const BUILDS: Record<string, Build> = {
  ronin: { tall: 1.02, wide: 1, shoulder: 1, head: 1 },
  vex: { tall: 0.96, wide: 0.92, shoulder: 0.92, head: 1.02 },
  brakk: { tall: 1.06, wide: 1.2, shoulder: 1.22, head: 0.96 },
  lyra: { tall: 1.01, wide: 0.89, shoulder: 0.9, head: 0.98 },
  azir: { tall: 0.99, wide: 0.94, shoulder: 0.96, head: 1 },
  jax: { tall: 1.03, wide: 1.02, shoulder: 1.05, head: 0.98 },
  nyx: { tall: 1, wide: 0.9, shoulder: 0.93, head: 1.02 },
  fenrir: { tall: 1.08, wide: 1.16, shoulder: 1.2, head: 1.05 },
  kai: { tall: 0.97, wide: 0.97, shoulder: 1.02, head: 0.99 },
  zero: { tall: 1.04, wide: 1.04, shoulder: 1.08, head: 0.97 },
  ryuu: { tall: 0.98, wide: 0.94, shoulder: 0.95, head: 1.0 },
  kage: { tall: 1.01, wide: 0.92, shoulder: 0.94, head: 0.98 },
  baron: { tall: 1.07, wide: 1.25, shoulder: 1.24, head: 0.95 },
  kira: { tall: 1.02, wide: 0.95, shoulder: 0.96, head: 1.0 },
  drakon: { tall: 1.1, wide: 1.28, shoulder: 1.26, head: 1.02 },
  volt: { tall: 0.97, wide: 0.92, shoulder: 0.94, head: 1.01 },
  mako: { tall: 1.05, wide: 1.12, shoulder: 1.15, head: 1.02 },
  orion: { tall: 1.04, wide: 1.02, shoulder: 1.06, head: 0.98 },
  ember: { tall: 0.98, wide: 0.9, shoulder: 0.91, head: 1.01 },
  thor: { tall: 1.07, wide: 1.2, shoulder: 1.22, head: 0.97 },
  mirage: { tall: 1.01, wide: 0.92, shoulder: 0.94, head: 1.0 },
  sidra: { tall: 1.02, wide: 1.03, shoulder: 1.05, head: 1.0 },
  petra: { tall: 0.99, wide: 1.01, shoulder: 1.04, head: 1.0 },
  shin: { tall: 1.03, wide: 1.06, shoulder: 1.08, head: 0.98 },
  warden: { tall: 1.09, wide: 1.24, shoulder: 1.25, head: 0.96 },
};

/**
 * Compact silhouette of the weapon a fighter is not currently holding,
 * strapped across the back. It makes the swap mechanic readable at a glance.
 */
function drawSheathed(
  ctx: CanvasRenderingContext2D,
  weapon: Weapon,
  p: Palette,
  accent: string,
) {
  ctx.save();
  ctx.translate(-17, -56);
  ctx.rotate(-0.78);
  ctx.scale(1.12, 1.12);
  const steel = "#8a97a6";
  const dark = "#1d2735";
  if (weapon === "Sword" || weapon === "Katars") {
    polygon(ctx, [-4, 16, 4, 16, 3, -26, 0, -32, -3, -26], dark, steel, 1.2);
    line(ctx, 0, 12, 0, -24, accent, 1.4);
    polygon(ctx, [-6, 14, 6, 14, 6, 18, -6, 18], p.armor);
  } else if (weapon === "Scythe" || weapon === "Spear") {
    line(ctx, 0, 22, 0, -30, "#5d4b38", 3.4);
    polygon(ctx, [-4, -28, 4, -28, 2, -38, -2, -38], steel);
    if (weapon === "Scythe") {
      ctx.beginPath();
      ctx.moveTo(0, -30);
      ctx.quadraticCurveTo(16, -40, 18, -24);
      ctx.strokeStyle = steel;
      ctx.lineWidth = 2.6;
      ctx.stroke();
    }
  } else if (weapon === "Axe" || weapon === "Hammer") {
    line(ctx, 0, 20, 0, -24, "#5d4b38", 3.4);
    polygon(
      ctx,
      [-9, -30, 9, -30, 11, -24, 9, -16, -9, -16, -11, -24],
      steel,
      dark,
      1.2,
    );
    line(ctx, -6, -23, 6, -23, accent, 1.4);
  } else if (weapon === "Bow") {
    ctx.beginPath();
    ctx.moveTo(0, -30);
    ctx.quadraticCurveTo(15, 0, 0, 24);
    ctx.strokeStyle = "#6f5a42";
    ctx.lineWidth = 3;
    ctx.stroke();
    line(ctx, 0, -30, 0, 24, "#d9e6ee", 0.8);
  } else if (weapon === "Blasters") {
    polygon(
      ctx,
      [-6, 2, -6, -11, 10, -12, 13, -7, 11, -2, -2, -1, -2, 7],
      steel,
      dark,
      1.2,
    );
    ctx.fillStyle = accent;
    ctx.fillRect(0, -9, 7, 2.4);
  } else if (weapon === "Gauntlets") {
    polygon(
      ctx,
      [-8, 8, -10, -6, -2, -13, 9, -10, 11, 2, 5, 9],
      p.armor,
      dark,
      1.4,
    );
    line(ctx, -5, -2, 6, -4, accent, 1.6);
  } else if (weapon === "Orb") {
    ctx.beginPath();
    ctx.arc(0, -4, 7, 0, TAU);
    ctx.fillStyle = dark;
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.4;
    ctx.stroke();
  } else if (weapon === "Nunchucks") {
    polygon(ctx, [-6, 6, -2, 6, -1, -22, -5, -22], "#5d4b38", steel, 1);
    polygon(ctx, [2, 8, 6, 8, 5, -20, 1, -20], "#5d4b38", steel, 1);
    line(ctx, -3, -22, 3, -20, steel, 1.4);
  } else if (weapon === "Chain Blade") {
    line(ctx, 0, 16, 0, -20, "#5d4b38", 3);
    polygon(ctx, [-3, -20, 12, -26, 10, -16, -3, -14], steel);
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(Math.sin(i) * 5, -6 + i * 5, 2.5, 0, TAU);
      ctx.strokeStyle = steel;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  } else if (weapon === "Cannon") {
    polygon(ctx, [-8, 20, 8, 20, 10, -28, -10, -28], "#3a4454", "#1a222e", 1.5);
    polygon(ctx, [-11, -28, 11, -28, 9, -34, -9, -34], "#ca8a04");
    line(ctx, -7, -4, 7, -4, "#ca8a04", 2);
    line(ctx, -6, 8, 6, 8, "#ca8a04", 2);
  }
  ctx.restore();
}

/** Four-fingered hand with a thumb, oriented along the forearm. */
function drawHand(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  skin: string,
  shade: string,
  gripping: boolean,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.ellipse(0, 0, 5.4, 4.4, 0, 0, TAU);
  ctx.fillStyle = skin;
  ctx.fill();
  if (gripping) {
    for (let i = 0; i < 3; i++)
      line(ctx, -1 + i * 2.2, -3.6, -1 + i * 2.2, 3.2, shade, 1.5);
    line(ctx, -3.4, -2.6, -1.2, -4.4, shade, 1.8);
  }
  ctx.restore();
}

/** Rest angle of each weapon and how its art is oriented in the hand. */
const GRIP: Record<Weapon, { idle: number; offset: number; reach: number }> = {
  Sword: { idle: 0.55, offset: Math.PI / 2, reach: 38 },
  Scythe: { idle: 0.7, offset: Math.PI / 2, reach: 40 },
  Blasters: { idle: 0.15, offset: 0, reach: 34 },
  Gauntlets: { idle: 0.8, offset: Math.PI / 2, reach: 30 },
  Axe: { idle: 0.75, offset: Math.PI / 2, reach: 38 },
  Hammer: { idle: 0.8, offset: Math.PI / 2, reach: 38 },
  Bow: { idle: 0.1, offset: 0, reach: 34 },
  Spear: { idle: 0.45, offset: Math.PI / 2, reach: 36 },
  Katars: { idle: 0.6, offset: Math.PI / 2, reach: 30 },
  Orb: { idle: 0.2, offset: 0, reach: 32 },
  Nunchucks: { idle: 0.75, offset: Math.PI / 2, reach: 32 },
  "Chain Blade": { idle: 0.65, offset: Math.PI / 2, reach: 42 },
  Cannon: { idle: 0.25, offset: 0, reach: 44 },
};

function drawWeapon(
  ctx: CanvasRenderingContext2D,
  weapon: Weapon,
  color: string,
  time: number,
  charged: boolean,
) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (charged) glow(ctx, 0, -30, 46, color, 0.3);
  if (weapon === "Sword") {
    line(ctx, 0, 6, 0, 19, "#241c17", 7);
    for (let i = 0; i < 4; i++)
      line(ctx, -3, 8 + i * 3, 3, 9.5 + i * 3, "#4b3b2c", 1.4);
    ctx.beginPath();
    ctx.arc(0, 20, 3.4, 0, TAU);
    ctx.fillStyle = "#c9ab77";
    ctx.fill();
    polygon(ctx, [-11, 3, 11, 3, 13, -1, -13, -1], "#d7bb86", "#8a7045", 1.2);
    polygon(ctx, [-4.5, -2, 4.5, -2, 3.4, -54, 0, -70, -3.4, -54], "#eef3f5");
    polygon(ctx, [0, -2, 3.4, -54, 0, -70], "#aebfcb");
    line(ctx, 0, -6, 0, -56, "#ffffff", 1.2);
    line(ctx, 2.2, -8, 1.6, -52, color, 1.6);
    ctx.save();
    ctx.globalAlpha *= 0.8;
    line(ctx, -2.4, -10, -1.8, -50, "#8fa6b6", 1);
    ctx.restore();
  } else if (weapon === "Scythe") {
    line(ctx, 0, 24, 0, -70, "#6e5a44", 5.5);
    line(ctx, 1.6, 22, 1.6, -68, "#241d16", 1.6);
    for (let i = 0; i < 3; i++)
      line(ctx, -3, -4 + i * 10, 3, -2 + i * 10, "#403227", 1.3);
    polygon(ctx, [-5, -60, 5, -60, 4, -72, -4, -72], "#9aa6b1");
    ctx.beginPath();
    ctx.moveTo(-4, -66);
    ctx.bezierCurveTo(26, -88, 60, -66, 54, -32);
    ctx.bezierCurveTo(44, -56, 28, -62, -4, -60);
    ctx.closePath();
    ctx.fillStyle = "#ced9e2";
    ctx.fill();
    ctx.strokeStyle = "#6f7f8d";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-3, -65);
    ctx.bezierCurveTo(24, -84, 54, -64, 50, -36);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.save();
    ctx.globalAlpha *= 0.7;
    ctx.beginPath();
    ctx.moveTo(0, -63);
    ctx.bezierCurveTo(22, -76, 44, -62, 44, -42);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  } else if (weapon === "Blasters") {
    polygon(
      ctx,
      [-8, 5, -9, -13, 30, -15, 38, -8, 36, 0, 8, 1, 7, 17, -3, 18],
      "#aab0bf",
      "#141b28",
      1.8,
    );
    polygon(ctx, [-8, -13, 30, -15, 32, -9, -8, -7], "#cfd6e2");
    ctx.fillStyle = "#222b3c";
    ctx.fillRect(1, -12, 25, 8);
    ctx.fillStyle = color;
    ctx.fillRect(6, -10.5, 17, 3.2);
    ctx.fillStyle = "#0f1521";
    ctx.fillRect(30, -11, 9, 7);
    ctx.beginPath();
    ctx.arc(39, -7.5, 3.2, 0, TAU);
    ctx.fillStyle = color;
    ctx.fill();
    glow(ctx, 39, -7.5, 14, color, 0.5);
    line(ctx, -4, 6, 4, 14, "#2b3244", 3);
  } else if (weapon === "Gauntlets") {
    polygon(
      ctx,
      [-12, 13, -18, -8, -10, -22, 15, -25, 23, -9, 19, 10],
      "#4e5c70",
      "#111b29",
      2,
    );
    polygon(ctx, [-13, -8, -8, -19, 13, -21, 19, -9, 12, -3], "#6d7f96");
    polygon(ctx, [-9, -17, 11, -19, 14, -12, -8, -11], color);
    for (let i = 0; i < 3; i++) {
      polygon(
        ctx,
        [-6 + i * 8, -18, -1 + i * 8, -19, 0 + i * 8, -8, -5 + i * 8, -7],
        "#2a3444",
      );
      line(ctx, -5 + i * 8, -17, -3 + i * 8, -9, "#1b2330", 1.6);
    }
    line(ctx, -7, 4, 13, 1, "#d4dee8", 3);
    ctx.beginPath();
    ctx.arc(2, -6, 3.6, 0, TAU);
    ctx.fillStyle = color;
    ctx.fill();
    glow(ctx, 2, -6, 16, color, 0.45);
  } else if (weapon === "Axe") {
    line(ctx, 0, 23, 0, -58, "#6f543c", 5.5);
    for (let i = 0; i < 4; i++)
      line(ctx, -3, 4 + i * 6, 3, 6 + i * 6, "#3b2c1f", 1.3);
    polygon(
      ctx,
      [-3, -62, 18, -68, 40, -58, 36, -28, 17, -27, 9, -44, -3, -46],
      "#c3ccd4",
      "#71808d",
      1.4,
    );
    polygon(ctx, [18, -66, 38, -57, 35, -31, 19, -29], "#e4ebef");
    polygon(ctx, [-3, -58, -15, -58, -24, -45, -11, -39, -3, -43], "#7b8ea1");
    line(ctx, 20, -62, 34, -54, color, 2);
    ctx.beginPath();
    ctx.arc(0, -54, 4.4, 0, TAU);
    ctx.fillStyle = color;
    ctx.fill();
  } else if (weapon === "Hammer") {
    line(ctx, 0, 22, 0, -50, "#7b6450", 7);
    for (let i = 0; i < 4; i++)
      line(ctx, -4, 2 + i * 6, 4, 4 + i * 6, "#3f3225", 1.4);
    polygon(
      ctx,
      [-26, -66, 26, -66, 32, -56, 26, -33, -26, -33, -32, -46],
      "#64758a",
      "#222d40",
      2.4,
    );
    polygon(ctx, [-26, -66, 26, -66, 28, -58, -28, -58], "#8b9cb0");
    ctx.fillStyle = "#aab8c6";
    ctx.fillRect(-25, -62, 9, 25);
    ctx.fillRect(16, -62, 9, 25);
    ctx.fillStyle = color;
    ctx.fillRect(-7, -57, 14, 17);
    glow(ctx, 0, -49, 26, color, 0.35);
    line(ctx, -24, -36, 24, -36, "#1a2231", 2);
  } else if (weapon === "Bow") {
    ctx.beginPath();
    ctx.moveTo(0, -46);
    ctx.quadraticCurveTo(42, -4, 0, 37);
    ctx.strokeStyle = "#6f5a42";
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.2;
    ctx.stroke();
    polygon(ctx, [-3, -50, 4, -46, 2, -40, -4, -44], "#cfd9e0");
    polygon(ctx, [-3, 41, 4, 37, 2, 31, -4, 35], "#cfd9e0");
    line(ctx, 0, -46, -5, -4, "#e9f6fb", 1.2);
    line(ctx, -5, -4, 0, 37, "#e9f6fb", 1.2);
    line(ctx, -16, -4, 38, -4, "#d6c39c", 2.2);
    polygon(ctx, [36, -9, 48, -4, 36, 1], "#e7f4f6");
    polygon(ctx, [-16, -8, -10, -4, -16, 0], color);
  } else if (weapon === "Spear") {
    line(ctx, 0, 38, 0, -72, "#6d583f", 4.4);
    line(ctx, 1.4, 36, 1.4, -70, "#241c13", 1.2);
    for (let i = 0; i < 3; i++)
      line(ctx, -3, 8 + i * 11, 3, 10 + i * 11, "#3c2f20", 1.2);
    polygon(ctx, [-6, -62, 6, -62, 5, -70, -5, -70], "#9fadba");
    polygon(
      ctx,
      [-9.5, -66, 0, -94, 9.5, -66, 0, -72],
      "#e3eef4",
      "#8296a6",
      1.2,
    );
    polygon(ctx, [0, -94, 9.5, -66, 0, -72], "#b3c4d1");
    line(ctx, 0, -70, 0, -90, color, 1.6);
    line(ctx, -6, -58, 9, -58, color, 3.6);
  } else if (weapon === "Katars") {
    polygon(
      ctx,
      [-11, 10, -10, -10, -5, -19, 10, -13, 15, 6],
      "#5c6c82",
      "#141e2d",
      1.8,
    );
    line(ctx, -8, -2, 12, -4, "#8d9dae", 3);
    polygon(
      ctx,
      [-10, -9, -14, -46, -4, -34, -1, -11],
      "#e9eef1",
      "#8496a6",
      1,
    );
    polygon(ctx, [4, -11, 8, -48, 15, -36, 13, -8], "#e9eef1", "#8496a6", 1);
    line(ctx, -11, -14, -7, -34, color, 1.4);
    line(ctx, 8, -16, 11, -34, color, 1.4);
  } else if (weapon === "Orb") {
    const bob = Math.sin(time * 4) * 4;
    glow(ctx, 6, -18 + bob, 36, color, 0.55);
    glow(ctx, 6, -18 + bob, 18, color, 0.75);
    ctx.beginPath();
    ctx.arc(6, -18 + bob, 11.5, 0, TAU);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(6, -18 + bob, 11.5, 0, TAU);
    ctx.strokeStyle = "#ffffff80";
    ctx.lineWidth = 1;
    ctx.stroke();
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.ellipse(6, -18 + bob, 19 - i * 4, 7, time * (2 + i) + i, 0, TAU);
      ctx.strokeStyle = i ? "#ffffff55" : "#d7ecff";
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(3, -21 + bob, 4, 0, TAU);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
  } else if (weapon === "Nunchucks") {
    polygon(ctx, [-3, -22, 3, -22, 4, 14, -4, 14], "#4a3c2e", "#8c7255", 1.2);
    line(ctx, -2, -18, 2, -18, color, 2);
    line(ctx, -2, 10, 2, 10, color, 2);
    const spin = time * 18;
    const cx1 = Math.cos(spin) * 14;
    const cy1 = -24 + Math.sin(spin) * 6;
    const cx2 = Math.cos(spin) * 28;
    const cy2 = -24 + Math.sin(spin) * 12;
    line(ctx, 0, -22, cx1, cy1, "#b5c4d1", 2);
    line(ctx, cx1, cy1, cx2, cy2, "#b5c4d1", 2);
    const batonAngle = spin + 0.8;
    ctx.save();
    ctx.translate(cx2, cy2);
    ctx.rotate(batonAngle);
    polygon(ctx, [-3, 0, 3, 0, 3, 32, -3, 32], "#4a3c2e", "#8c7255", 1.2);
    line(ctx, -2, 4, 2, 4, color, 1.8);
    glow(ctx, 0, 16, 24, color, 0.4);
    ctx.restore();
  } else if (weapon === "Chain Blade") {
    line(ctx, 0, 18, 0, -24, "#4b3c2d", 4.4);
    line(ctx, 1.2, 16, 1.2, -22, "#1d1712", 1.2);
    polygon(
      ctx,
      [-3, -22, 28, -32, 24, -14, -2, -16],
      "#dde6ed",
      "#7b8f9f",
      1.2,
    );
    polygon(ctx, [6, -26, 24, -30, 20, -18, 4, -18], color);
    ctx.beginPath();
    ctx.moveTo(0, 18);
    const wave = Math.sin(time * 12) * 18;
    ctx.quadraticCurveTo(14 + wave, 32, -8 + wave * 0.5, 46);
    ctx.strokeStyle = "#8e9ea8";
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-8 + wave * 0.5, 46, 5.5, 0, TAU);
    ctx.fillStyle = "#5c6d7a";
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.4;
    ctx.stroke();
  } else if (weapon === "Cannon") {
    polygon(ctx, [-12, -44, 12, -44, 14, 26, -14, 26], "#334155", "#0f172a", 2);
    polygon(
      ctx,
      [-15, -44, 15, -44, 13, -52, -13, -52],
      "#1e293b",
      "#0f172a",
      2,
    );
    ctx.beginPath();
    ctx.ellipse(0, -50, 11, 4.5, 0, 0, TAU);
    ctx.fillStyle = color;
    ctx.fill();
    glow(ctx, 0, -50, 32, color, 0.6);
    line(ctx, -13, -20, 13, -20, "#eab308", 3.4);
    line(ctx, -13, 0, 13, 0, "#eab308", 3.4);
    line(ctx, -14, 16, 14, 16, "#eab308", 3.4);
    polygon(ctx, [14, -8, 22, -6, 22, 12, 14, 10], "#64748b", "#1e293b", 1.4);
    if (Math.random() < 0.4) {
      ctx.beginPath();
      ctx.arc((Math.random() - 0.5) * 8, -56 - Math.random() * 8, 3, 0, TAU);
      ctx.fillStyle = "#ffffff99";
      ctx.fill();
    }
  }
}

function drawHead(
  ctx: CanvasRenderingContext2D,
  f: Fighter,
  p: Palette,
  time: number,
) {
  const id = f.def.id;
  const c = f.def.color;
  const blink = Math.sin(time * 1.7 + f.player * 2) > 0.985 ? 0.25 : 1;
  // Neck and jaw sit under every head variant.
  bone(ctx, 0, -66, 1, -76, 5.5, 6, p.skinShade, p.skin);
  ctx.beginPath();
  ctx.ellipse(1, -80, 13.5, 16.5, -0.06, 0, TAU);
  ctx.fillStyle = p.skin;
  ctx.fill();
  ctx.strokeStyle = "#101a26";
  ctx.lineWidth = 1.6;
  ctx.stroke();
  // Matching rim light on the face keeps the head and torso consistent.
  ctx.save();
  ctx.globalAlpha *= 0.5;
  ctx.beginPath();
  ctx.ellipse(1, -80, 13.5, 16.5, -0.06, -1.15, 0.75);
  ctx.strokeStyle = p.armorLight;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.globalAlpha *= 0.45;
  ctx.beginPath();
  ctx.ellipse(-5, -82, 7, 13, -0.1, 0, TAU);
  ctx.fillStyle = p.skinShade;
  ctx.fill();
  ctx.restore();

  if (id === "ronin") {
    polygon(ctx, [-14, -79, 16, -80, 12, -64, -7, -64], "#162434");
    line(ctx, -7, -73, 10, -71, "#4e5f72", 1.2);
    line(ctx, -6, -69, 9, -67, "#3b4a5c", 1);
    polygon(
      ctx,
      [-34, -85, -3, -111, 36, -85, 9, -80],
      "#23262a",
      "#a88760",
      1.5,
    );
    for (let i = -2; i <= 2; i++)
      line(ctx, -3, -108, i * 13, -85, "#5d5140", 1);
    line(ctx, -33, -84, 36, -84, "#d3b383", 2);
    polygon(ctx, [-3, -111, 3, -113, 2, -105], "#8c7452");
  } else if (id === "vex") {
    polygon(
      ctx,
      [
        -15, -72, -20, -90, -12, -106, 9, -104, 24, -94, 5, -92, -4, -79, -6,
        -64,
      ],
      "#4f3a84",
    );
    polygon(ctx, [-13, -92, -6, -102, 16, -98, -3, -87], "#9871cb");
    line(ctx, -14, -84, 16, -86, "#1b2130", 5);
    line(ctx, -3, -82, 15, -83, c, 3.4);
    glow(ctx, 8, -83, 18, c, 0.5);
  } else if (id === "brakk") {
    polygon(
      ctx,
      [-15, -87, -18, -98, -9, -104, 1, -99, 12, -105, 19, -92, 14, -85],
      "#9e4831",
    );
    polygon(
      ctx,
      [-12, -74, -2, -70, 12, -76, 14, -59, 1, -47, -13, -64],
      "#a94f33",
    );
    polygon(
      ctx,
      [-9, -70, 2, -67, 10, -72, 9, -58, 0, -51, -8, -62],
      "#8c3f28",
    );
    line(ctx, -4, -68, 1, -56, "#d17a46", 1.6);
    polygon(ctx, [-16, -88, 17, -90, 16, -84, -15, -83], "#6c7786");
  } else if (id === "lyra") {
    polygon(
      ctx,
      [
        -21, -60, -20, -92, -2, -107, 19, -93, 22, -58, 13, -68, 12, -88, 1,
        -97, -12, -86, -11, -62,
      ],
      "#2f5663",
      c,
      1,
    );
    polygon(
      ctx,
      [-12, -90, -1, -98, 11, -90, 10, -80, 1, -89, -6, -70, -14, -62],
      "#dceef1",
    );
    polygon(ctx, [-20, -92, -2, -107, 19, -93, 16, -99, -1, -110, -18, -98], c);
  } else if (id === "azir") {
    polygon(
      ctx,
      [
        -21, -60, -22, -88, -7, -107, 15, -97, 23, -64, 13, -64, 11, -89, -5,
        -96, -12, -78, -11, -60,
      ],
      "#b59a68",
      "#dec792",
      1.4,
    );
    polygon(
      ctx,
      [-12, -77, 16, -79, 12, -62, -1, -57, -11, -66],
      "#8a7641",
      c,
      1,
    );
    line(ctx, -7, -74, 10, -69, c, 1.2);
    polygon(ctx, [-5, -70, 6, -68, 4, -62, -4, -64], "#6a5a31");
  } else if (id === "jax") {
    polygon(
      ctx,
      [
        -14, -86, -16, -97, -7, -101, -2, -97, 7, -103, 15, -95, 14, -87, 4,
        -92,
      ],
      "#cbd8e1",
    );
    line(ctx, -14, -83, 15, -85, "#242c38", 4.5);
    line(ctx, -4, -82, 13, -84, c, 2.4);
    line(ctx, -9, -68, 9, -66, "#302e32", 3);
    polygon(ctx, [10, -78, 18, -80, 17, -70, 10, -70], "#39414f");
  } else if (id === "nyx") {
    polygon(
      ctx,
      [
        -19, -57, -21, -92, -10, -106, 10, -103, 21, -91, 22, -51, 12, -64, 12,
        -88, 0, -97, -11, -84, -10, -55,
      ],
      "#2d2749",
    );
    ctx.beginPath();
    ctx.moveTo(-13, -94);
    ctx.quadraticCurveTo(-33, -106, -21, -121);
    ctx.quadraticCurveTo(-20, -103, -5, -102);
    ctx.fillStyle = "#3a3450";
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(11, -98);
    ctx.quadraticCurveTo(30, -110, 20, -122);
    ctx.quadraticCurveTo(22, -106, 5, -104);
    ctx.fill();
    polygon(ctx, [-3, -93, 1, -99, 5, -93, 1, -88], c);
    glow(ctx, 1, -93, 20, c, 0.4);
  } else if (id === "fenrir") {
    polygon(
      ctx,
      [
        -16, -88, -19, -111, -3, -98, 10, -100, 21, -110, 18, -82, 24, -72, 8,
        -61, -11, -66, -21, -76,
      ],
      "#dde6ea",
      "#657b8c",
      1.8,
    );
    polygon(ctx, [-13, -98, -14, -105, -5, -97], "#596f81");
    polygon(ctx, [11, -98, 17, -105, 15, -94], "#596f81");
    polygon(ctx, [2, -80, 25, -77, 20, -66, 1, -67, -8, -75], "#f2f6f6");
    polygon(ctx, [20, -77, 28, -76, 23, -70, 18, -71], "#232f41");
    line(ctx, 6, -71, 18, -70, "#b9c6ce", 1.2);
  } else if (id === "kai") {
    polygon(
      ctx,
      [
        -16, -85, -25, -96, -13, -95, -16, -110, -3, -102, 3, -117, 11, -103,
        25, -108, 18, -96, 27, -91, 12, -87, 5, -97, -6, -90,
      ],
      "#a33d29",
      "#ed733c",
      1,
    );
    line(ctx, -13, -85, 14, -86, "#1d2634", 4);
    line(ctx, -4, -83, 12, -85, c, 2.2);
    polygon(ctx, [-14, -85, -31, -79, -36, -67, -19, -77], c);
  } else if (id === "zero") {
    polygon(
      ctx,
      [-16, -73, -18, -92, -7, -104, 10, -103, 21, -88, 15, -65, 1, -60],
      "#27393a",
      "#617779",
      1.8,
    );
    polygon(ctx, [-13, -89, -4, -83, 17, -88, 13, -77, -2, -75], c);
    glow(ctx, 4, -82, 22, c, 0.45);
    polygon(ctx, [-2, -98, 6, -102, 6, -84, 0, -79], "#86998f");
    line(ctx, -6, -71, 10, -70, "#4b6464", 1.8);
    for (let i = 0; i < 3; i++)
      line(ctx, -14 + i * 3, -96, -12 + i * 3, -90, "#3f5553", 1.2);
  } else if (id === "ryuu") {
    polygon(
      ctx,
      [
        -14, -86, -20, -98, -10, -96, -12, -112, 0, -104, 8, -118, 14, -104, 24,
        -108, 16, -96, 24, -88, 12, -86,
      ],
      "#1e293b",
      "#0f172a",
      1.4,
    );
    line(ctx, -13, -83, 13, -83, c, 4);
    line(ctx, -13, -83, -28, -75 + Math.sin(time * 8) * 5, c, 3);
    glow(ctx, 5, -81, 16, c, 0.6);
  } else if (id === "kage") {
    polygon(
      ctx,
      [-15, -60, -18, -92, -6, -106, 12, -98, 18, -65, 10, -60],
      "#171424",
      "#090610",
      1.8,
    );
    polygon(ctx, [-11, -76, 11, -76, 8, -60, -8, -60], "#262039");
    line(ctx, -5, -81, 8, -80, c, 3);
    glow(ctx, 3, -81, 18, c, 0.7);
  } else if (id === "baron") {
    polygon(
      ctx,
      [-16, -82, -15, -102, 2, -108, 16, -98, 17, -80],
      "#475569",
      "#1e293b",
      2,
    );
    ctx.beginPath();
    ctx.arc(-3, -82, 5.5, 0, TAU);
    ctx.arc(7, -82, 5.5, 0, TAU);
    ctx.fillStyle = "#ca8a04";
    ctx.fill();
    ctx.strokeStyle = "#78350f";
    ctx.lineWidth = 1.6;
    ctx.stroke();
    polygon(
      ctx,
      [-12, -74, 12, -74, 10, -52, 0, -44, -10, -52],
      "#64748b",
      "#334155",
      1.4,
    );
  } else if (id === "kira") {
    polygon(
      ctx,
      [-14, -88, -18, -104, 0, -112, 16, -104, 18, -82, 14, -62, -12, -62],
      "#fde047",
      "#ca8a04",
      1.2,
    );
    polygon(
      ctx,
      [-12, -88, -24, -102, -14, -96, 0, -98, 14, -96, 24, -102, 12, -88],
      "#e2e8f0",
      "#94a3b8",
      1.4,
    );
    polygon(ctx, [-2, -89, 2, -89, 0, -84], c);
    glow(ctx, 0, -86, 12, c, 0.6);
  } else if (id === "drakon") {
    polygon(
      ctx,
      [
        -16, -72, -18, -94, -6, -106, 12, -102, 22, -86, 24, -70, 10, -60, -12,
        -62,
      ],
      "#1c0d08",
      "#431407",
      2,
    );
    ctx.beginPath();
    ctx.moveTo(-10, -96);
    ctx.quadraticCurveTo(-26, -112, -18, -124);
    ctx.quadraticCurveTo(-14, -108, -3, -102);
    ctx.fillStyle = c;
    ctx.fill();
    glow(ctx, -18, -120, 20, c, 0.5);
    ctx.beginPath();
    ctx.moveTo(6, -98);
    ctx.quadraticCurveTo(24, -114, 16, -126);
    ctx.quadraticCurveTo(12, -110, 2, -104);
    ctx.fillStyle = c;
    ctx.fill();
    glow(ctx, 16, -122, 20, c, 0.5);
    line(ctx, -3, -80, 12, -79, "#fef08a", 3);
  } else if (id === "volt") {
    polygon(
      ctx,
      [-15, -84, -22, -104, -8, -98, 2, -118, 12, -100, 24, -108, 15, -85],
      "#e0f2fe",
      c,
      1.2,
    );
    line(ctx, -13, -82, 15, -83, c, 4);
  } else if (id === "mako") {
    polygon(
      ctx,
      [-14, -86, -4, -122, 10, -96, 22, -78, 12, -64, -12, -66],
      "#134e4a",
      "#5eead4",
      1.5,
    );
  } else if (id === "orion") {
    polygon(
      ctx,
      [-15, -72, -16, -96, 0, -116, 16, -96, 16, -70, 2, -62],
      "#fde68a",
      "#b45309",
      1.8,
    );
    polygon(ctx, [-4, -88, 12, -84, 4, -76], "#1e293b");
  } else if (id === "ember") {
    polygon(
      ctx,
      [-18, -62, -19, -96, 0, -108, 17, -94, 15, -66],
      "#166534",
      "#86efac",
      1.4,
    );
  } else if (id === "thor") {
    polygon(
      ctx,
      [-15, -86, -26, -108, -12, -98, 0, -104, 12, -98, 26, -108, 15, -86],
      "#e2e8f0",
      "#818cf8",
      1.5,
    );
    polygon(ctx, [-11, -72, 11, -72, 9, -52, 0, -46, -9, -52], "#facc15");
  } else if (id === "mirage") {
    polygon(
      ctx,
      [-18, -60, -19, -95, 0, -106, 18, -94, 18, -60],
      "#881337",
      "#fda4af",
      1.4,
    );
  } else if (id === "sidra") {
    polygon(
      ctx,
      [-28, -90, 0, -106, 28, -90, 16, -84, -16, -84],
      "#431407",
      "#fb923c",
      1.6,
    );
  } else if (id === "petra") {
    polygon(
      ctx,
      [-15, -85, -22, -106, -6, -98, 4, -116, 14, -98, 22, -104, 14, -85],
      "#f9a8d4",
      "#be185d",
      1.3,
    );
  } else if (id === "shin") {
    polygon(
      ctx,
      [-26, -88, 0, -105, 26, -88, 12, -84, -12, -84],
      "#065f46",
      "#6ee7b7",
      1.4,
    );
  } else if (id === "warden") {
    polygon(
      ctx,
      [-16, -66, -17, -98, 0, -106, 17, -98, 16, -66],
      "#292524",
      "#f59e0b",
      1.8,
    );
    line(ctx, -10, -82, 13, -82, c, 3.5);
  }
  if (
    ![
      "zero",
      "vex",
      "jax",
      "kai",
      "nyx",
      "kage",
      "baron",
      "orion",
      "warden",
    ].includes(id)
  ) {
    glow(ctx, 6, -81, 16, c, 0.4);
    ctx.save();
    ctx.scale(1, blink);
    line(ctx, -2, -81 / blink, 3, -80 / blink, c, 2.6);
    line(ctx, 8, -81 / blink, 12, -82 / blink, c, 2.6);
    ctx.restore();
  }
}

interface Pose {
  hipX: number;
  hipY: number;
  lean: number;
  handX: number;
  handY: number;
  offHandX: number;
  offHandY: number;
  footAX: number;
  footAY: number;
  footBX: number;
  footBY: number;
  weaponAngle: number;
  crouch: number;
}

/** Builds the full-body pose for the current state and attack frame. */
function buildPose(f: Fighter, time: number, move: MoveDef | null): Pose {
  const weapon = f.def.weapons[f.weapon];
  const grip = GRIP[weapon];
  const walking = Math.abs(f.vx) > 30 && f.grounded;
  const stride = Math.min(1.15, Math.abs(f.vx) / 330);
  const cycle = time * (8 + 7 * stride);
  const run = walking && f.dodgeTime <= 0 ? Math.sin(cycle) * stride : 0;
  const idleBreath = Math.sin(time * 2.4) * 1.3;
  const shoulderX = 9;
  const shoulderY = -62;

  let angle = grip.idle + Math.sin(time * 2.1) * 0.05;
  let reach = grip.reach;
  let crouch = 0;
  let lean = f.grounded ? 0.02 : 0.08;

  const attack = f.attack;
  const activeMotion = attack?.move ? sampleAttackMotion(attack) : null;
  if (attack && move && activeMotion) {
    const anim = move.anim;
    const motion = activeMotion;
    const pose = (rest: number, wind: number, hit: number) =>
      attackPoseValue(rest, wind, hit, motion);
    const side = attack.stance[1] === "S";
    const down = attack.stance[1] === "D";
    const heavy = attack.kind === "heavy";
    const power = heavy ? 1.3 : 1;
    // Exaggerated silhouettes, with anticipation, a fast active swing and a
    // settling pose. Matches the articulated 3D animation's combat timeline.
    angle = pose(grip.idle, anim.a0, anim.a1);
    reach = pose(grip.reach, anim.r0, anim.r1);
    lean = pose(lean, -0.20 * power, (down ? 0.26 : 0.22) * power);
    lean += motion.impact * 0.065 * power - motion.settle * 0.025;
    crouch = pose(0, heavy ? 11 : 7, down ? 15 : side ? 7 : 3) - motion.whip * 2;
    if (anim.arc === "shoot") {
      // A little punchy kickback on the muzzle, without moving the hitbox.
      reach -= motion.impact * (heavy ? 11 : 7);
      lean -= motion.impact * 0.09;
    }
    if (anim.arc === "spin") {
      lean += Math.sin(motion.strike * TAU) * (1 - motion.recovery) * 0.16;
    }
  } else if (attack && attack.kind === "recovery") {
    const p = clamp01(attack.time / attack.duration);
    const rise = Math.sin(Math.min(1, p * 1.5) * Math.PI / 2);
    angle = lerp(grip.idle, -2.5, rise * (1 - easeOut(clamp01((p - 0.7) / 0.3))));
    reach = lerp(grip.reach, grip.reach + 22, rise);
    lean = -0.12 * rise;
  } else if (attack && attack.kind === "special") {
    angle = -0.5 + Math.sin(attack.time * 18) * 0.35;
    reach = 54;
    lean = -0.1;
  }

  let footAX: number;
  let footAY: number;
  let footBX: number;
  let footBY: number;
  if (!f.grounded) {
    // Airborne legs tuck and trail, with a deeper tuck on down attacks.
    const diving = f.attack?.stance[1] === "D";
    const rise = Math.max(-1, Math.min(1, -f.vy / 500));
    footAX = diving ? -4 : -11 - rise * 5;
    footAY = diving ? -4 : -16 - rise * 6;
    footBX = diving ? 13 : 15 + rise * 4;
    footBY = diving ? -22 : -13 + rise * 5;
  } else if (walking) {
    footAX = run * 15;
    footAY = -Math.max(0, Math.sin(cycle)) * 11;
    footBX = -run * 15;
    footBY = -Math.max(0, Math.sin(cycle + Math.PI)) * 11;
  } else {
    footAX = -9;
    footAY = 0;
    footBX = 11;
    footBY = 0;
  }

  // Transfer weight between the feet in ground attacks. The 2D fallback
  // still communicates sweeps and launchers when WebGL is unavailable.
  if (activeMotion && attack && f.grounded) {
    const m = activeMotion;
    const push = m.strike * m.windup * (1 - m.recovery);
    const brace = m.windup * (1 - m.strike) * (1 - m.recovery);
    footAX -= brace * 7;
    footBX += push * (attack.stance[1] === "S" ? 15 : 6);
    footAY -= push * (attack.stance[1] === "D" ? 4 : 0);
    footAX -= m.whip * (attack.stance[1] === "S" ? 4 : 2);
    footBX += m.follow * 3;
  }

  // The fallback fighter tucks into a dodge instead of rotating as a rigid
  // paper cutout. The same 0.30s dodge timeline drives the WebGL skeleton.
  if (f.dodgeTime > 0) {
    const progress = dodgeProgress(f.dodgeTime);
    const tuck = Math.sin(progress * Math.PI);
    crouch += 10 * tuck;
    lean += (f.dodgeVectorX || f.facing) * 0.2 * tuck;
    angle = grip.idle - 1.1 * tuck;
    reach *= 1 - tuck * 0.24;
    footAX = -7 - tuck * 2;
    footBX = 8 + tuck * 2;
    footAY = -tuck * 16;
    footBY = -tuck * 12;
  }

  const hipY =
    (f.grounded ? (walking ? Math.abs(run) * 2.5 : idleBreath * 0.5) : -2) +
    crouch;

  const handX = shoulderX + Math.cos(angle) * reach + lean * 13;
  const handY = shoulderY + Math.sin(angle) * reach + (move?.anim.lift ?? 0);

  return {
    hipX: f.grounded ? lean * 10 : 2,
    hipY: -34 + hipY,
    lean,
    handX,
    handY,
    offHandX: -14 - (activeMotion ? 11 * activeMotion.windup - 8 * activeMotion.follow : 0) + Math.sin(time * 2.3) * 1.5,
    offHandY: -40 - (activeMotion ? 13 * activeMotion.strike - 5 * activeMotion.settle : 0) + idleBreath,
    footAX,
    footAY,
    footBX,
    footBY,
    weaponAngle: angle + grip.offset,
    crouch,
  };
}

function drawSwoosh(
  ctx: CanvasRenderingContext2D,
  f: Fighter,
  move: MoveDef,
  color: string,
) {
  const attack = f.attack!;
  const motion = sampleAttackMotion(attack);
  if (motion.trail <= 0) return;
  const anim = move.anim;
  const k = motion.strike;
  const radius = lerp(anim.r0, anim.r1, k) + (move.heavyHit ? 32 : 24);
  ctx.save();
  ctx.translate(9, -62);
  // A tapering ribbon follows just behind the actual weapon rather than
  // filling the entire hitbox on frame one.
  ctx.globalAlpha *= 0.75 * motion.trail;
  ctx.beginPath();
  if (anim.arc === "thrust" || anim.arc === "shoot") {
    ctx.rotate(anim.a1);
    const reach = lerp(anim.r0, anim.r1, k);
    ctx.moveTo(reach * 0.2, -4 - motion.impact * 6);
    ctx.lineTo(reach + 27, 0);
    ctx.lineTo(reach * 0.2, 4 + motion.impact * 6);
    ctx.closePath();
  } else {
    const range = anim.a1 - anim.a0;
    const tip = anim.a0 + range * k;
    const start = anim.a0 + range * Math.max(0, k - 0.3);
    const low = Math.min(start, tip);
    const high = Math.max(start, tip);
    ctx.arc(0, 0, radius, low, high);
    ctx.arc(0, 0, radius * 0.66, high, low, true);
    ctx.closePath();
  }
  ctx.fillStyle = color;
  ctx.fill();
  ctx.globalAlpha *= 0.65;
  ctx.fillStyle = "#fff6e8";
  ctx.fill();
  ctx.restore();
}

/**
 * Per-fighter kit: belts, quivers, bandages, cables, fur and tails. This is the
 * layer that makes ten characters read as ten different people at a glance.
 */
function drawGear(
  ctx: CanvasRenderingContext2D,
  f: Fighter,
  p: Palette,
  pose: Pose,
  time: number,
  c: string,
) {
  const id = f.def.id;
  const hip = { x: pose.hipX, y: pose.hipY };
  const chest = { x: pose.hipX + pose.lean * 16, y: pose.hipY - 26 };
  const breathe = Math.sin(time * 2.4) * 0.8;

  if (id === "ronin") {
    // Sashimono cord across the chest and rope belt at the hip.
    line(
      ctx,
      chest.x - 12,
      chest.y - 12,
      chest.x + 11,
      chest.y + 9,
      "#6a5a44",
      2.4,
    );
    line(ctx, hip.x - 12, hip.y + 9, hip.x + 13, hip.y + 7, "#8a7350", 2.6);
    polygon(
      ctx,
      [
        hip.x + 6,
        hip.y + 8,
        hip.x + 14,
        hip.y + 10,
        hip.x + 11,
        hip.y + 20,
        hip.x + 5,
        hip.y + 17,
      ],
      "#3b3226",
      "#7d6a4c",
      1,
    );
    // Tabi wraps on the shins.
    for (const side of [-1, 1])
      for (let i = 0; i < 3; i++)
        line(
          ctx,
          side * 5 - 4,
          hip.y + 16 + i * 6,
          side * 5 + 6,
          hip.y + 15 + i * 6,
          "#cfc3ab",
          1.5,
        );
  } else if (id === "vex") {
    // Twin thigh holsters, pouches and a glowing visor cable.
    for (const side of [-1, 1]) {
      polygon(
        ctx,
        [
          side * 8 - 4,
          hip.y + 12,
          side * 8 + 6,
          hip.y + 12,
          side * 8 + 7,
          hip.y + 24,
          side * 8 - 3,
          hip.y + 24,
        ],
        "#2b2440",
        c,
        1,
      );
      ctx.fillStyle = c;
      ctx.fillRect(side * 8 - 2, hip.y + 16, 6, 1.6);
    }
    line(ctx, chest.x - 10, chest.y - 14, chest.x - 13, chest.y - 30, c, 1.4);
    glow(ctx, chest.x - 13, chest.y - 31, 9, c, 0.5);
    polygon(
      ctx,
      [
        hip.x - 13,
        hip.y + 2,
        hip.x - 5,
        hip.y + 2,
        hip.x - 5,
        hip.y + 11,
        hip.x - 13,
        hip.y + 11,
      ],
      "#3a2f56",
      "#1a1430",
      1,
    );
  } else if (id === "brakk") {
    // Chain skirt, heavy belt pouches and a fur mantle.
    for (let i = 0; i < 9; i++) {
      const x = hip.x - 14 + i * 3.5;
      line(
        ctx,
        x,
        hip.y + 12,
        x + (i % 2 ? 1 : -1),
        hip.y + 26 + (i % 3),
        "#5c6672",
        2.2,
      );
    }
    line(ctx, hip.x - 15, hip.y + 12, hip.x + 16, hip.y + 11, "#4a3a2c", 3);
    polygon(
      ctx,
      [
        hip.x + 5,
        hip.y + 11,
        hip.x + 16,
        hip.y + 11,
        hip.x + 15,
        hip.y + 22,
        hip.x + 6,
        hip.y + 21,
      ],
      "#6b4a35",
      "#3c2a1e",
      1,
    );
    ctx.beginPath();
    ctx.moveTo(chest.x - 14, chest.y - 12);
    for (let i = 0; i < 7; i++)
      ctx.lineTo(
        chest.x - 14 + i * 4.5,
        chest.y - 16 - Math.abs(3 - i) * 1.4 + breathe,
      );
    ctx.lineTo(chest.x + 15, chest.y - 10);
    ctx.lineTo(chest.x - 14, chest.y - 6);
    ctx.closePath();
    ctx.fillStyle = "#6d5340";
    ctx.fill();
    for (let i = 0; i < 6; i++)
      line(
        ctx,
        chest.x - 12 + i * 5,
        chest.y - 13,
        chest.x - 11 + i * 5,
        chest.y - 18 - (i % 2),
        "#8a6b50",
        1.1,
      );
  } else if (id === "lyra") {
    // Quiver on the back, feathered bracer, thigh straps.
    ctx.save();
    ctx.translate(chest.x - 13, chest.y - 8);
    ctx.rotate(-0.28);
    polygon(ctx, [-5, -16, 5, -16, 6, 12, -6, 12], "#33565f", "#7fd6dc", 1.2);
    for (let i = 0; i < 4; i++) {
      line(
        ctx,
        -3 + i * 2.4,
        -16,
        -5 + i * 2.6,
        -28 - (i % 2) * 3,
        "#cfe6ea",
        1.4,
      );
      polygon(
        ctx,
        [
          -6 + i * 2.6,
          -28 - (i % 2) * 3,
          -3 + i * 2.6,
          -34 - (i % 2) * 3,
          -1 + i * 2.6,
          -28 - (i % 2) * 3,
        ],
        c,
      );
    }
    ctx.restore();
    for (const side of [-1, 1]) {
      line(
        ctx,
        side * 8 - 5,
        hip.y + 14,
        side * 8 + 6,
        hip.y + 13,
        "#2b4a54",
        2.6,
      );
      line(
        ctx,
        side * 8 - 5,
        hip.y + 19,
        side * 8 + 6,
        hip.y + 18,
        "#2b4a54",
        2,
      );
    }
  } else if (id === "azir") {
    // Bandolier of blades, wrapped forearms, tasselled hip sash.
    line(
      ctx,
      chest.x - 13,
      chest.y - 11,
      chest.x + 12,
      chest.y + 11,
      "#7a6742",
      3.4,
    );
    for (let i = 0; i < 4; i++) {
      const t = i / 3;
      const bx = chest.x - 11 + t * 21;
      const by = chest.y - 9 + t * 18;
      polygon(
        ctx,
        [bx - 2, by - 2, bx + 2, by - 2, bx + 2, by + 5, bx - 2, by + 5],
        "#d8c79a",
        "#7a6742",
        0.8,
      );
    }
    const sway = Math.sin(time * 4.5) * 3;
    polygon(
      ctx,
      [
        hip.x + 9,
        hip.y + 8,
        hip.x + 17,
        hip.y + 8,
        hip.x + 15 + sway,
        hip.y + 26,
        hip.x + 8 + sway,
        hip.y + 24,
      ],
      "#8d7546",
      c,
      1,
    );
    line(
      ctx,
      hip.x + 10 + sway,
      hip.y + 25,
      hip.x + 9 + sway,
      hip.y + 33,
      "#e7c37b",
      1.4,
    );
    line(
      ctx,
      hip.x + 14 + sway,
      hip.y + 25,
      hip.x + 15 + sway,
      hip.y + 32,
      "#e7c37b",
      1.4,
    );
  } else if (id === "jax") {
    // Cartridge belt, knee holster and coat tails.
    line(ctx, hip.x - 14, hip.y + 8, hip.x + 15, hip.y + 7, "#4a4234", 3.2);
    for (let i = 0; i < 8; i++) {
      const x = hip.x - 12 + i * 3.6;
      polygon(
        ctx,
        [x, hip.y + 6, x + 2, hip.y + 6, x + 2, hip.y + 12, x, hip.y + 12],
        "#d8d68a",
        "#6b6a3a",
        0.7,
      );
    }
    polygon(
      ctx,
      [
        hip.x + 6,
        hip.y + 14,
        hip.x + 15,
        hip.y + 14,
        hip.x + 14,
        hip.y + 24,
        hip.x + 7,
        hip.y + 23,
      ],
      "#39414f",
      "#20262f",
      1,
    );
    const sway = Math.sin(time * 3.4) * 4;
    polygon(
      ctx,
      [
        hip.x - 13,
        hip.y + 10,
        hip.x + 14,
        hip.y + 10,
        hip.x + 11 + sway,
        hip.y + 40,
        hip.x - 10 + sway,
        hip.y + 38,
      ],
      "#33393f",
      "#4a5158",
      1.1,
    );
  } else if (id === "nyx") {
    // Orbiting runes, a chest crystal and tattered sleeves.
    ctx.save();
    polygon(
      ctx,
      [
        chest.x - 1,
        chest.y - 10,
        chest.x + 6,
        chest.y - 3,
        chest.x - 1,
        chest.y + 6,
        chest.x - 8,
        chest.y - 3,
      ],
      c,
      "#ffffff88",
      1,
    );
    glow(ctx, chest.x - 1, chest.y - 2, 22, c, 0.45);
    ctx.restore();
    for (let i = 0; i < 3; i++) {
      const a = time * 1.5 + (i * TAU) / 3;
      const rx = chest.x + Math.cos(a) * 30;
      const ry = chest.y - 4 + Math.sin(a) * 11;
      ctx.save();
      ctx.translate(rx, ry);
      ctx.rotate(a);
      polygon(ctx, [-3, 0, 0, -5, 3, 0, 0, 5], c, "#ffffff", 0.8);
      ctx.globalAlpha *= 0.55;
      glow(ctx, 0, 0, 12, c, 0.7);
      ctx.restore();
    }
    for (const side of [-1, 1]) {
      const tip = Math.sin(time * 3 + side) * 3;
      polygon(
        ctx,
        [
          side * 9 - 6,
          hip.y + 14,
          side * 9 + 6,
          hip.y + 14,
          side * 9 + 5 + tip,
          hip.y + 34,
          side * 9 - 7 + tip,
          hip.y + 30,
        ],
        "#221c3c",
        c,
        0.9,
      );
    }
  } else if (id === "fenrir") {
    // Fur ruff, wrist claws and a tail that follows the movement.
    ctx.beginPath();
    ctx.moveTo(chest.x - 15, chest.y - 12);
    for (let i = 0; i < 9; i++)
      ctx.lineTo(
        chest.x - 15 + i * 3.6,
        chest.y - 18 - Math.abs(4 - i) * 1.6 + Math.sin(time * 5 + i) * 0.9,
      );
    ctx.lineTo(chest.x + 17, chest.y - 9);
    ctx.lineTo(chest.x - 15, chest.y - 4);
    ctx.closePath();
    ctx.fillStyle = "#e7eef1";
    ctx.fill();
    for (let i = 0; i < 8; i++)
      line(
        ctx,
        chest.x - 13 + i * 4,
        chest.y - 12,
        chest.x - 12 + i * 4,
        chest.y - 19,
        "#b9c9d2",
        1,
      );
    for (const side of [-1, 1])
      for (let i = 0; i < 3; i++)
        line(
          ctx,
          side * 22 + (side > 0 ? 0 : -6),
          hip.y + 20 + i * 2,
          side * 22 + side * (7 + i),
          hip.y + 25 + i * 2,
          "#eaf2f5",
          1.5,
        );
    const tailSway = Math.sin(time * 3.6) * 7 - f.vx * 0.03;
    ctx.beginPath();
    ctx.moveTo(hip.x - 10, hip.y + 8);
    ctx.quadraticCurveTo(
      hip.x - 30,
      hip.y + 6 + tailSway * 0.4,
      hip.x - 40,
      hip.y + 22 + tailSway,
    );
    ctx.quadraticCurveTo(
      hip.x - 32,
      hip.y + 26 + tailSway,
      hip.x - 24,
      hip.y + 16 + tailSway * 0.5,
    );
    ctx.quadraticCurveTo(hip.x - 16, hip.y + 14, hip.x - 8, hip.y + 14);
    ctx.closePath();
    ctx.fillStyle = "#cbd8de";
    ctx.fill();
    ctx.strokeStyle = "#7d929e";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    line(
      ctx,
      hip.x - 34,
      hip.y + 20 + tailSway,
      hip.x - 40,
      hip.y + 22 + tailSway,
      "#f2f7f9",
      2.4,
    );
  } else if (id === "kai") {
    // Hand wraps, an open vest, ankle bindings and ember tattoos.
    for (const side of [-1, 1])
      for (let i = 0; i < 4; i++)
        line(
          ctx,
          side * 8 - 5,
          hip.y + 22 + i * 4,
          side * 8 + 5,
          hip.y + 21 + i * 4,
          "#d9c9b4",
          1.7,
        );
    polygon(
      ctx,
      [
        chest.x - 12,
        chest.y - 13,
        chest.x - 4,
        chest.y - 15,
        chest.x - 5,
        chest.y + 12,
        chest.x - 13,
        chest.y + 10,
      ],
      "#241d24",
      "#3a2f38",
      1,
    );
    polygon(
      ctx,
      [
        chest.x + 12,
        chest.y - 13,
        chest.x + 5,
        chest.y - 15,
        chest.x + 6,
        chest.y + 12,
        chest.x + 13,
        chest.y + 10,
      ],
      "#241d24",
      "#3a2f38",
      1,
    );
    ctx.save();
    ctx.globalAlpha *= 0.65;
    // Ember tattoos lick upward and drift with the fighter's own heat.
    for (let i = 0; i < 3; i++) {
      const flicker = Math.sin(time * 5.5 + i * 1.7) * 2.2;
      ctx.beginPath();
      ctx.moveTo(chest.x + 2 + i * 4, chest.y + 8 + i);
      ctx.quadraticCurveTo(
        chest.x + 6 + i * 4 + flicker,
        chest.y + 2 + i * 2,
        chest.x + 3 + i * 4,
        chest.y - 5 - i * 3 + flicker * 0.5,
      );
      ctx.strokeStyle = c;
      ctx.lineWidth = 1.3;
      ctx.stroke();
    }
    ctx.restore();
  } else if (id === "zero") {
    // Cable bundles, back vents and a pulsing chest core.
    for (let i = 0; i < 4; i++) {
      const sway = Math.sin(time * 2.6 + i) * 2.4;
      ctx.beginPath();
      ctx.moveTo(chest.x - 9 + i * 2, chest.y - 8);
      ctx.quadraticCurveTo(
        chest.x - 16 + i * 2 + sway,
        chest.y + 6,
        chest.x - 12 + i * 3 + sway,
        chest.y + 18,
      );
      ctx.strokeStyle = i % 2 ? "#2f4241" : "#445c58";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    polygon(
      ctx,
      [
        chest.x + 6,
        chest.y - 14,
        chest.x + 15,
        chest.y - 12,
        chest.x + 14,
        chest.y - 2,
        chest.x + 5,
        chest.y - 4,
      ],
      "#4c625e",
      "#22302e",
      1,
    );
    for (let i = 0; i < 3; i++)
      line(
        ctx,
        chest.x + 7,
        chest.y - 12 + i * 3.4,
        chest.x + 13,
        chest.y - 11 + i * 3.4,
        c,
        1.3,
      );
    const pulse = 0.6 + Math.sin(time * 4.2) * 0.4;
    ctx.save();
    ctx.globalAlpha *= pulse;
    glow(ctx, chest.x + 1, chest.y - 4, 16, c, 0.8);
    ctx.restore();
    ctx.beginPath();
    ctx.arc(chest.x + 1, chest.y - 4, 4.4, 0, TAU);
    ctx.fillStyle = c;
    ctx.fill();
    ctx.strokeStyle = "#dff5d4";
    ctx.lineWidth = 1;
    ctx.stroke();
    for (const side of [-1, 1])
      polygon(
        ctx,
        [
          side * 8 - 5,
          hip.y + 13,
          side * 8 + 6,
          hip.y + 13,
          side * 8 + 5,
          hip.y + 21,
          side * 8 - 5,
          hip.y + 21,
        ],
        "#37474a",
        "#5d736f",
        1,
      );
  }

  // Knee guards read clearly on every silhouette. Knees are solved the same
  // way the legs solve them so the plates track the animation exactly.
  for (const knee of [
    joint(hip.x - 7, hip.y, pose.footBX - 4, pose.footBY, 20, 20, 1),
    joint(hip.x + 7, hip.y, pose.footAX + 4, pose.footAY, 20, 20, -1),
  ]) {
    polygon(
      ctx,
      [
        knee.x - 5,
        knee.y - 5,
        knee.x + 5,
        knee.y - 4,
        knee.x + 4,
        knee.y + 4,
        knee.x - 4,
        knee.y + 3,
      ],
      p.armor,
      "#0d1521",
      1,
    );
    line(ctx, knee.x - 3, knee.y, knee.x + 3, knee.y, c, 1.1);
  }
}

export function drawFighter(
  ctx: CanvasRenderingContext2D,
  f: Fighter,
  game: Engine,
) {
  if (f.respawn > 0 || f.stocks <= 0) return;
  resetCaches(ctx);
  const time = game.time;
  const c = f.def.color;
  const p = PALETTES[f.def.id] ?? PALETTES.ronin;
  const weapon = f.def.weapons[f.weapon];
  const move = f.attack?.move ?? null;
  const pose = buildPose(f, time, move);
  const bulk = 1;
  const build = BUILDS[f.def.id] ?? BUILDS.ronin;
  const charged = f.charge >= 75;

  if (f.grounded) {
    ctx.beginPath();
    ctx.ellipse(f.x, f.y + 1, 30, 6, 0, 0, TAU);
    ctx.fillStyle = "#050a1390";
    ctx.fill();
    if (charged) {
      ctx.beginPath();
      ctx.ellipse(f.x, f.y, 35 + Math.sin(time * 5) * 3, 8, 0, 0, TAU);
      ctx.strokeStyle = c;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.7;
      ctx.stroke();
      ctx.globalAlpha = 1;
      glow(ctx, f.x, f.y - 30, 80, c, 0.15);
    }
  }
  if (f.dodgeTime > 0) {
    const ghostDirection = f.dodgeVectorX || f.facing;
    for (let i = 1; i < 5; i++) {
      ctx.save();
      ctx.globalAlpha = 0.13 * (1 - i / 5);
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.ellipse(
        f.x - ghostDirection * i * 15,
        f.y - 45 - f.dodgeVectorY * i * 10,
        22,
        43,
        -ghostDirection * 0.5,
        0,
        TAU,
      );
      ctx.fill();
      ctx.restore();
    }
  }

  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.scale(
    f.facing * bulk * build.wide * (1 + f.landSquash * 0.12),
    build.tall * (1 - f.landSquash * 0.12),
  );
  if (f.invulnerable > 0 && Math.sin(time * 35) > 0) ctx.globalAlpha = 0.55;
  if (f.dodgeTime > 0) {
    const p = dodgeProgress(f.dodgeTime);
    const dir = f.dodgeVectorX || f.facing;
    ctx.rotate((f.dodgeVectorY ? -f.dodgeVectorY : dir) * TAU * rollEase(p));
  } else {
    ctx.rotate(f.stun > 0 ? -0.16 : f.vx * f.facing * 0.0001);
  }
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const hip = { x: pose.hipX, y: pose.hipY };
  const chest = { x: pose.hipX + pose.lean * 16, y: pose.hipY - 26 };
  const shoulderFront = {
    x: chest.x + 9 * build.shoulder,
    y: chest.y - 3,
  };
  const shoulderBack = {
    x: chest.x - 13 * build.shoulder,
    y: chest.y - 1,
  };

  // The weapon that is not in hand rides on the fighter's back.
  drawSheathed(ctx, f.def.weapons[1 - f.weapon], p, c);

  // Cape and scarf trail behind the body.
  if (["ronin", "azir", "kai"].includes(f.def.id)) {
    const wave = Math.sin(time * 9) * 7;
    const drag = Math.abs(f.vx) * 0.03;
    polygon(
      ctx,
      [
        -8,
        -66,
        -28,
        -63,
        -50 - drag,
        -74 + wave,
        -44 - drag,
        -58 + wave,
        -24,
        -52,
        -7,
        -58,
      ],
      p.cloth,
    );
    line(ctx, -10, -61, -42 - drag, -64 + wave, "#ffffff33", 1);
  }
  if (["lyra", "nyx", "fenrir", "zero"].includes(f.def.id)) {
    const sway = Math.sin(time * 4) * 5 + f.vx * -0.02;
    polygon(
      ctx,
      [-17, -66, -24, -26, -34 + sway, -6, 6, -16, 13, -59],
      p.suit,
      p.accent,
      1,
    );
    polygon(ctx, [-17, -66, -22, -34, -12, -30, -6, -60], p.suitLight);
  }

  // Back leg, then back arm, so the torso overlaps them naturally.
  const backHip = { x: hip.x - 7, y: hip.y };
  const backFoot = { x: pose.footAX - 4, y: pose.footAY };
  const backKnee = joint(
    backHip.x,
    backHip.y,
    backFoot.x,
    backFoot.y,
    20,
    20,
    1,
  );
  bone(
    ctx,
    backHip.x,
    backHip.y,
    backKnee.x,
    backKnee.y,
    7.5,
    6,
    p.suit,
    p.suitLight,
  );
  bone(
    ctx,
    backKnee.x,
    backKnee.y,
    backFoot.x,
    backFoot.y,
    5.5,
    4.5,
    p.suit,
    p.suitLight,
  );
  polygon(
    ctx,
    [
      backFoot.x - 6,
      backFoot.y - 5,
      backFoot.x + 8,
      backFoot.y - 5,
      backFoot.x + 9,
      backFoot.y,
      backFoot.x - 7,
      backFoot.y,
    ],
    "#141c28",
  );

  const backHand = { x: pose.offHandX, y: pose.offHandY };
  const backElbow = joint(
    shoulderBack.x,
    shoulderBack.y,
    backHand.x,
    backHand.y,
    17,
    16,
    -1,
  );
  bone(
    ctx,
    shoulderBack.x,
    shoulderBack.y,
    backElbow.x,
    backElbow.y,
    6.5,
    5,
    p.suit,
    p.suitLight,
  );
  bone(
    ctx,
    backElbow.x,
    backElbow.y,
    backHand.x,
    backHand.y,
    4.8,
    4.2,
    p.skinShade,
    p.skin,
  );
  drawHand(
    ctx,
    backHand.x,
    backHand.y,
    Math.atan2(backHand.y - backElbow.y, backHand.x - backElbow.x),
    p.skinShade,
    p.suit,
    !!f.attack,
  );

  // Torso: suit base, chest armour, belt, and accent trim.
  ctx.save();
  ctx.translate(chest.x, chest.y);
  ctx.rotate(pose.lean * 0.8);
  let torso = torsoCache.get(f.def.id);
  if (!torso) {
    torso = ctx.createLinearGradient(-18, -20, 20, 20);
    torso.addColorStop(0, p.suitLight);
    torso.addColorStop(0.55, p.suit);
    torso.addColorStop(1, "#0f1724");
    torsoCache.set(f.def.id, torso);
  }
  polygon(
    ctx,
    [-16, -14, -6, -21, 13, -18, 20, 6, 14, 22, -12, 23, -20, 4],
    torso,
    "#0d1521",
    1.8,
  );
  polygon(ctx, [-14, -14, -5, -18, -4, 8, -15, 5, -19, -4], p.armor);
  polygon(ctx, [-4, -18, 12, -15, 16, 7, 1, 9], p.armorLight);
  polygon(ctx, [-4, -18, 4, -17, 5, 8, 1, 9], p.armor);
  // Belt and hip plate.
  polygon(ctx, [-13, 9, 16, 8, 14, 18, -12, 19], "#141d2a");
  line(ctx, -11, 13, 14, 12, c, 2.6);
  ctx.beginPath();
  ctx.arc(2, 13, 3.4, 0, TAU);
  ctx.fillStyle = c;
  ctx.fill();
  // Chest emblem.
  polygon(ctx, [1, -12, 8, -9, 6, -2, -1, -4], c);
  ctx.save();
  ctx.globalAlpha *= 0.5;
  polygon(ctx, [-16, -14, -6, -21, -2, -17, -13, -9], "#ffffff");
  ctx.restore();
  if (f.def.id === "fenrir")
    polygon(
      ctx,
      [
        -20, -6, -22, -20, -15, -16, -10, -27, -4, -16, 6, -21, 17, -13, 22,
        -19, 26, -5, 17, -1, -12, -3,
      ],
      "#b3c4cd",
    );
  if (f.def.id === "brakk")
    for (let i = 0; i < 3; i++)
      line(ctx, -14 + i * 9, -16 + i * 2, -10 + i * 9, 6, "#d4603f88", 1.6);
  // Rim light down the leading edge lifts the fighter off the background.
  ctx.save();
  ctx.globalAlpha *= 0.75;
  ctx.beginPath();
  ctx.moveTo(12, -18.5);
  ctx.lineTo(19.5, 6);
  ctx.lineTo(13.5, 21.5);
  ctx.strokeStyle = p.armorLight;
  ctx.lineWidth = 1.7;
  ctx.stroke();
  ctx.restore();
  ctx.restore();

  // Belts, quivers, fur, cables and tails — the per-fighter kit.
  drawGear(ctx, f, p, pose, time, c);

  // Front shoulder pauldron.
  ctx.save();
  ctx.translate(shoulderFront.x, shoulderFront.y);
  ctx.rotate(pose.lean);
  polygon(ctx, [-9, -8, 6, -11, 13, -1, 10, 8, -8, 7], p.armor, "#0e1724", 1.6);
  polygon(ctx, [-8, -7, 5, -10, 10, -3, -6, 0], p.armorLight);
  line(ctx, -6, 2, 9, 1, c, 1.8);
  ctx.restore();

  ctx.save();
  ctx.translate(chest.x * 0.35, chest.y + 62);
  ctx.scale(build.head, build.head);
  ctx.translate(-chest.x * 0.35, -(chest.y + 62));
  drawHead(ctx, f, p, time);
  ctx.restore();

  // Front leg sits above the torso silhouette.
  const frontHip = { x: hip.x + 6, y: hip.y };
  const frontFoot = { x: pose.footBX + 3, y: pose.footBY };
  const frontKnee = joint(
    frontHip.x,
    frontHip.y,
    frontFoot.x,
    frontFoot.y,
    20,
    20,
    1,
  );
  bone(
    ctx,
    frontHip.x,
    frontHip.y,
    frontKnee.x,
    frontKnee.y,
    8.5,
    6.5,
    p.suitLight,
    p.armorLight,
  );
  bone(
    ctx,
    frontKnee.x,
    frontKnee.y,
    frontFoot.x,
    frontFoot.y,
    6,
    5,
    p.suitLight,
    p.armorLight,
  );
  polygon(
    ctx,
    [
      frontKnee.x - 6,
      frontKnee.y - 6,
      frontKnee.x + 6,
      frontKnee.y - 5,
      frontKnee.x + 5,
      frontKnee.y + 4,
      frontKnee.x - 5,
      frontKnee.y + 3,
    ],
    p.armor,
  );
  polygon(
    ctx,
    [
      frontFoot.x - 7,
      frontFoot.y - 6,
      frontFoot.x + 9,
      frontFoot.y - 6,
      frontFoot.x + 11,
      frontFoot.y,
      frontFoot.x - 8,
      frontFoot.y,
    ],
    "#1b2433",
    "#0c1220",
    1.2,
  );
  line(
    ctx,
    frontFoot.x - 5,
    frontFoot.y - 4,
    frontFoot.x + 8,
    frontFoot.y - 4,
    c,
    1.4,
  );

  if (f.attack && move) drawSwoosh(ctx, f, move, c);

  // Weapon arm last so the weapon reads clearly on top.
  const hand = { x: pose.handX, y: pose.handY };
  const elbow = joint(
    shoulderFront.x,
    shoulderFront.y,
    hand.x,
    hand.y,
    19,
    19,
    1,
  );
  bone(
    ctx,
    shoulderFront.x,
    shoulderFront.y,
    elbow.x,
    elbow.y,
    7,
    5.5,
    p.suitLight,
    p.armorLight,
  );
  bone(ctx, elbow.x, elbow.y, hand.x, hand.y, 5.4, 4.6, p.skin, p.skinShade);
  polygon(
    ctx,
    [
      elbow.x - 5,
      elbow.y - 5,
      elbow.x + 5,
      elbow.y - 4,
      elbow.x + 4,
      elbow.y + 4,
      elbow.x - 4,
      elbow.y + 3,
    ],
    p.armor,
  );
  drawHand(ctx, hand.x, hand.y, pose.weaponAngle, p.skin, p.skinShade, true);

  ctx.save();
  ctx.translate(hand.x, hand.y);
  ctx.rotate(pose.weaponAngle);
  drawWeapon(ctx, weapon, c, time, charged);
  ctx.restore();

  if (f.flash > 0) glow(ctx, 0, -55, 48, "#fff3de", f.flash * 4);
  ctx.restore();

  // Player tag.
  ctx.save();
  ctx.textAlign = "center";
  ctx.font = '600 11px "Space Grotesk", sans-serif';
  ctx.fillStyle = "#0d1420d9";
  ctx.beginPath();
  ctx.roundRect(f.x - 21, f.y - 139, 42, 20, 3);
  ctx.fill();
  ctx.fillStyle = f.player === 0 ? "#ff8852" : "#a7b6fa";
  ctx.fillText(
    f.player === 0 ? "P1" : game.settings.mode === "cpu" ? "CPU" : "P2",
    f.x,
    f.y - 125,
  );
  polygon(
    ctx,
    [f.x - 4, f.y - 116, f.x + 4, f.y - 116, f.x, f.y - 111],
    ctx.fillStyle,
  );
  if (f.slow > 0) {
    ctx.fillStyle = "#9ddfff";
    ctx.fillText("SLOWED", f.x, f.y - 148);
  }
  ctx.restore();
}

/** Detailed signature flourish drawn over the 3D body, unique to each move. */
function drawSignatureFx(
  ctx: CanvasRenderingContext2D,
  f: Fighter,
  game: Engine,
) {
  const attack = f.attack;
  if (!attack || attack.kind !== "special") return;
  const p = Math.min(1, attack.time / Math.max(0.05, attack.duration));
  const pulse = Math.sin(Math.min(1, p * 1.2) * Math.PI);
  const c = f.def.color;
  const type = f.def.special.type;
  ctx.save();
  ctx.translate(f.x, f.y - 52);
  ctx.scale(f.facing, 1);
  ctx.globalAlpha = 0.28 + pulse * 0.62;

  const ribbon = (length: number, width: number, angle = 0) => {
    ctx.save();
    ctx.rotate(angle);
    polygon(
      ctx,
      [
        -18,
        -width,
        length,
        -width * 0.25,
        length + 28,
        0,
        length,
        width * 0.25,
        -18,
        width,
        8,
        0,
      ],
      c,
    );
    ctx.restore();
  };
  const ring = (radius: number, y = 0) => {
    ctx.save();
    ctx.translate(0, y);
    ctx.beginPath();
    ctx.ellipse(0, 0, radius, radius * 0.35, 0, 0, TAU);
    ctx.strokeStyle = c;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  };

  if (["rift", "dragon", "tempest"].includes(type)) {
    ribbon(105 + pulse * 55, 15, type === "dragon" ? -0.18 : -0.05);
    ribbon(72 + pulse * 38, 8, 0.38);
  } else if (["overdrive", "broadside", "kraken"].includes(type)) {
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(58 + i * 22, (i - 1) * 8, 7 + pulse * 8 - i * 2, 0, TAU);
      ctx.strokeStyle = i === 1 ? "#ffffff" : c;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
    ribbon(92, 10, 0);
  } else if (["quake", "eruption", "mjolnir", "hellchain"].includes(type)) {
    ring(58 + pulse * 62, 48);
    ring(34 + pulse * 40, 48);
    for (let i = -2; i <= 2; i++)
      line(ctx, i * 18, 48, i * 30, 18 - Math.abs(i) * 5, c, 2.5);
  } else if (["rain", "starfall", "phoenix_arrow"].includes(type)) {
    for (let i = 0; i < 6; i++) {
      const x = -55 + i * 22;
      line(ctx, x, -112 + (i % 3) * 12, x + 12, -48, i % 2 ? "#ffffff" : c, 2);
    }
    polygon(
      ctx,
      [72, -18, 78, -6, 90, 0, 78, 6, 72, 18, 66, 6, 54, 0, 66, -6],
      "#ffffff",
    );
  } else if (
    ["sandstorm", "crimson_vortex", "singularity", "whirlwind"].includes(type)
  ) {
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.rotate(game.time * (5 + i) + i * 2.1);
      ctx.beginPath();
      ctx.arc(0, 0, 34 + i * 13 + pulse * 8, -0.4, 1.7);
      ctx.strokeStyle = i === 1 ? "#ffffff" : c;
      ctx.lineWidth = 3 - i * 0.5;
      ctx.stroke();
      ctx.restore();
    }
  } else if (["deadeye", "darkheart", "starfall"].includes(type)) {
    const grad = ctx.createLinearGradient(30, 0, 190, 0);
    grad.addColorStop(0, c);
    grad.addColorStop(1, "transparent");
    ctx.fillStyle = grad;
    ctx.fillRect(28, -5 - pulse * 3, 165, 10 + pulse * 6);
    line(ctx, 28, 0, 198, 0, "#ffffff", 2);
  } else if (["frost", "jade_cyclone"].includes(type)) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + game.time * 1.6;
      const x = Math.cos(a) * (42 + pulse * 18);
      const y = Math.sin(a) * (25 + pulse * 10);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      polygon(ctx, [0, -7, 5, 0, 0, 7, -5, 0], i % 2 ? "#ffffff" : c);
      ctx.restore();
    }
  } else if (["nova", "sol_lotus"].includes(type)) {
    for (let i = 0; i < 8; i++) {
      ctx.save();
      ctx.rotate((i / 8) * TAU + p * 0.8);
      ctx.beginPath();
      ctx.ellipse(34 + pulse * 24, 0, 17, 6, 0, 0, TAU);
      ctx.fillStyle = i % 2 ? "#ffffff" : c;
      ctx.fill();
      ctx.restore();
    }
  } else if (type === "chain_strike") {
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      ctx.arc(22 + i * 17, Math.sin(i * 1.4 + game.time * 8) * 5, 5, 0, TAU);
      ctx.strokeStyle = i % 2 ? "#ffffff" : c;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    polygon(ctx, [138, -8, 158, 0, 138, 8], "#ffffff");
  } else if (type === "tidal_jaws") {
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(42 + i * 28, 8, 22 - i * 4, Math.PI * 1.08, Math.PI * 1.72);
      ctx.strokeStyle = i === 1 ? "#ffffff" : c;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(42 + i * 28, -10, 22 - i * 4, Math.PI * 0.3, Math.PI * 0.9);
      ctx.stroke();
    }
  } else {
    ribbon(90 + pulse * 35, 12, -0.12);
  }
  ctx.restore();
}

/** Ground shadow & charged ring rendered beneath 3D characters. */
export function drawFighterUnderlay(
  ctx: CanvasRenderingContext2D,
  f: Fighter,
  time: number,
) {
  if (f.respawn > 0 || f.stocks <= 0) return;
  resetCaches(ctx);
  const c = f.def.color;
  if (f.signatureDodge > 0) {
    ctx.save();
    ctx.globalAlpha = 0.35 + Math.min(0.45, f.signatureDodge);
    ctx.strokeStyle = "#bfe9ff";
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 5]);
    ctx.beginPath();
    ctx.ellipse(f.x, f.y - 45, 30, 46, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
    glow(ctx, f.x, f.y - 45, 62, "#bfe9ff", 0.16);
  }
  if (f.channeling) {
    glow(ctx, f.x, f.y - 45, 68, c, 0.21 + Math.sin(time * 11) * 0.07);
    ctx.save();
    ctx.globalAlpha = 0.5 + Math.sin(time * 10) * 0.2;
    ctx.strokeStyle = c;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(f.x, f.y - 45, 27, 42, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
  if (f.grounded) {
    ctx.beginPath();
    ctx.ellipse(f.x, f.y + 1, 32, 6.5, 0, 0, TAU);
    ctx.fillStyle = "#050a13a8";
    ctx.fill();
    if (f.charge >= 75) {
      ctx.beginPath();
      ctx.ellipse(f.x, f.y, 37 + Math.sin(time * 5) * 3, 8.5, 0, 0, TAU);
      ctx.strokeStyle = c;
      ctx.lineWidth = 1.8;
      ctx.globalAlpha = 0.78;
      ctx.stroke();
      ctx.globalAlpha = 1;
      glow(ctx, f.x, f.y - 30, 84, c, 0.18);
    }
  }
}

/** Slash ribbon, hit-flash & P1/P2/CPU overhead badge rendered above 3D characters. */
export function drawFighterOverlay(
  ctx: CanvasRenderingContext2D,
  f: Fighter,
  game: Engine,
) {
  if (f.respawn > 0 || f.stocks <= 0) return;
  resetCaches(ctx);
  const c = f.def.color;
  const move = f.attack?.move ?? null;
  if (f.attack && move) {
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.scale(f.facing, 1);
    drawSwoosh(ctx, f, move, c);
    ctx.restore();
  }
  drawSignatureFx(ctx, f, game);
  if (f.flash > 0) glow(ctx, f.x, f.y - 55, 52, "#fff3de", f.flash * 4);
  if (f.stun > 0.05) {
    for (let i = 0; i < 3; i++) {
      const a = game.time * 6 + (i * TAU) / 3;
      const sx = f.x + Math.cos(a) * 17;
      const sy = f.y - 122 + Math.sin(a) * 4;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(a);
      polygon(
        ctx,
        [0, -5, 2, -2, 5, 0, 2, 2, 0, 5, -2, 2, -5, 0, -2, -2],
        "#ffe58a",
      );
      ctx.restore();
    }
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = '700 10px "Space Grotesk", sans-serif';
    ctx.fillStyle = "#ffe58a";
    ctx.fillText("STUNNED", f.x, f.y - 136);
    ctx.restore();
  }

  ctx.save();
  ctx.textAlign = "center";
  ctx.font = '600 11px "Space Grotesk", sans-serif';
  ctx.fillStyle = "#0d1420d9";
  ctx.beginPath();
  ctx.roundRect(f.x - 21, f.y - 143, 42, 20, 3);
  ctx.fill();
  ctx.fillStyle = f.player === 0 ? "#ff8852" : "#a7b6fa";
  ctx.fillText(
    f.player === 0 ? "P1" : game.settings.mode === "cpu" ? "CPU" : "P2",
    f.x,
    f.y - 129,
  );
  polygon(
    ctx,
    [f.x - 4, f.y - 120, f.x + 4, f.y - 120, f.x, f.y - 115],
    ctx.fillStyle,
  );
  if (f.slow > 0) {
    ctx.fillStyle = "#9ddfff";
    ctx.fillText("SLOWED", f.x, f.y - 152);
  }
  ctx.restore();
}
