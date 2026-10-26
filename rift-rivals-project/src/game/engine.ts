import { audio } from "./audio";
import {
  AI_PROFILES,
  FIGHTERS,
  SPAM_TAX,
  WEAPON_KNOCKBACK_MULT,
  WEAPONS,
  deriveStats,
  getStage,
  type DerivedStats,
  type FighterDefinition,
  type Settings,
  type StageDefinition,
  type StagePlatform,
  type Weapon,
} from "./data";
import { renderGame } from "./renderer";
import { DODGE_COOLDOWN, DODGE_DURATION, DODGE_IFRAMES, DODGE_SPEED } from "./dodge";
import { getMove, stanceFor, type MoveDef, type Stance } from "./moves";
import {
  getSharedThreeRenderer,
  type ThreeFighterRenderer,
} from "./threeRenderer";

export const WIDTH = 1280;
export const HEIGHT = 720;
export const MAX_JUMPS = 3;
export { DODGE_COOLDOWN, DODGE_DURATION, DODGE_IFRAMES, DODGE_SPEED } from "./dodge";


/** A live platform, including its drift so grounded fighters ride along. */
export interface Platform extends StagePlatform {
  main: boolean;
  baseX: number;
  baseY: number;
  dx: number;
  dy: number;
}

function buildPlatforms(stage: StageDefinition): Platform[] {
  return stage.platforms.map((p) => ({
    ...p,
    main: !!p.main,
    baseX: p.x,
    baseY: p.y,
    dx: 0,
    dy: 0,
  }));
}

/**
 * Live-bound so the renderer always draws whichever stage is loaded.
 * Reassigned by every Engine as it is constructed.
 */
export let PLATFORMS: Platform[] = buildPlatforms(getStage("fracture"));

export function loadStagePlatforms(stage: StageDefinition) {
  PLATFORMS = buildPlatforms(stage);
  return PLATFORMS;
}

/**
 * Accessor for the live platform list. Module bindings are live for `import`,
 * but anything that destructures the export captures a stale snapshot, so
 * callers outside this module should use this instead.
 */
export function getPlatforms(): Platform[] {
  return PLATFORMS;
}

export type Action =
  | "left"
  | "right"
  | "down"
  | "jump"
  | "light"
  | "heavy"
  | "special"
  | "charge"
  | "dodge"
  | "recovery"
  | "swap";
export type Phase = "countdown" | "running" | "paused" | "over";
export interface Attack {
  kind: "light" | "heavy" | "special" | "recovery";
  time: number;
  duration: number;
  hit: boolean;
  weapon: Weapon;
  chain: number;
  stance: Stance;
  move: MoveDef | null;
  /** Remaining active windows, so multi-hit jabs can connect more than once. */
  windows: number[];
  fired: boolean;
}

export interface Fighter {
  def: FighterDefinition;
  player: number;
  /** Stat block resolved from the character's 1-10 ratings. */
  derived: DerivedStats;
  /** Damage this fighter can absorb before a stock is lost. */
  maxHealth: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: number;
  grounded: boolean;
  jumps: number;
  recoveryUsed: boolean;
  /** A player jump can be shortened by releasing the jump button. */
  cuttable: boolean;
  coyote: number;
  damage: number;
  stocks: number;
  charge: number;
  channeling: boolean;
  /** Remaining invulnerable window granted while a signature is being cast. */
  signatureDodge: number;
  weapon: number;
  /** Anti-spam memory: the last stance thrown and how often it repeated. */
  lastStance: Stance | null;
  stanceStreak: number;
  stanceMemory: number;
  /** Horizontal carry from a moving platform the fighter stands on. */
  ride: number;
  /** Position at the start of the last physics step, for interpolation. */
  px: number;
  py: number;
  attack: Attack | null;
  attackCD: number;
  dodgeCD: number;
  dodgeTime: number;
  /** The direction of the most recent dodge for animation afterimages. */
  dodgeVectorX: number;
  dodgeVectorY: number;
  invulnerable: number;
  stun: number;
  slow: number;
  respawn: number;
  combo: number;
  comboTimer: number;
  maxCombo: number;
  score: number;
  kos: number;
  attackChain: number;
  chainTimer: number;
  attackStance: Stance | null;
  /** Recovery applied when an aerial attack is cut short by the ground. */
  landingLag: number;
  bufferedAction: "light" | "heavy" | "special" | null;
  bufferTime: number;
  flash: number;
  specialTime: number;
  passTime: number;
  landSquash: number;
  aiClock: number;
  aiSwap: number;
  aiActions: Set<Action>;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  kind: "spark" | "dust" | "glow";
}
export interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  /** Ordinary shots expire once their weapon's reach is exhausted. */
  traveled: number;
  maxRange: number;
  radius: number;
  owner: number;
  damage: number;
  color: string;
  special: boolean;
  kind: string;
  delay: number;
  spike: boolean;
  trail: { x: number; y: number }[];
}
export interface Effect {
  x: number;
  y: number;
  radius: number;
  time: number;
  duration: number;
  color: string;
  kind: string;
  dir: number;
  owner: number;
  hit: boolean;
}
export interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  size: number;
}
export interface FighterHUD {
  id: string;
  damage: number;
  maxHealth: number;
  stocks: number;
  charge: number;
  channeling: boolean;
  signatureDodge: number;
  weapon: Weapon;
  /** The stance currently being thrown, shown so players learn the moves. */
  move: string;
  dodgeCD: number;
  jumpsRemaining: number;
  recoveryReady: boolean;
  score: number;
  combo: number;
  respawn: number;
}
export interface Snapshot {
  phase: Phase;
  fighters: FighterHUD[];
  elapsed: number;
  timeRemaining: number;
  countdown: number;
  announcement: string;
  stage: string;
  hazard: string;
}
export interface MatchResult {
  winner: number;
  reason: "knockout" | "timeout";
  scores: [number, number];
  combos: [number, number];
  kos: [number, number];
  duration: number;
}

/** Knockback shape applied by downward-angled projectiles. */
const SPIKE_KNOCKBACK = {
  ...getMove("Sword", "aD", false),
  damage: 0,
} as MoveDef;

/** Signature hits use a longer, clearly readable stun than regular attacks. */
export const SIGNATURE_STUN: Record<string, number> = {
  rift: 0.62,
  overdrive: 0.5,
  quake: 0.72,
  rain: 0.52,
  sandstorm: 0.6,
  deadeye: 0.66,
  singularity: 0.74,
  frost: 0.68,
  dragon: 0.62,
  nova: 0.7,
  whirlwind: 0.58,
  chain_strike: 0.72,
  broadside: 0.64,
  sol_lotus: 0.66,
  eruption: 0.74,
  tempest: 0.56,
  tidal_jaws: 0.68,
  starfall: 0.64,
  phoenix_arrow: 0.54,
  mjolnir: 0.74,
  crimson_vortex: 0.66,
  kraken: 0.68,
  darkheart: 0.66,
  jade_cyclone: 0.62,
  hellchain: 0.72,
};

export function signatureStun(type: string): number {
  return SIGNATURE_STUN[type] ?? 0.6;
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
const approach = (value: number, target: number, amount: number) =>
  value < target
    ? Math.min(target, value + amount)
    : Math.max(target, value - amount);

function makeFighter(
  def: FighterDefinition,
  player: number,
  spawnY: number,
  stocks: number,
): Fighter {
  const derived = deriveStats(def.stats);
  return {
    def,
    player,
    derived,
    maxHealth: derived.maxHealth,
    x: player === 0 ? 440 : 840,
    y: spawnY,
    vx: 0,
    vy: 0,
    facing: player === 0 ? 1 : -1,
    grounded: true,
    jumps: 0,
    recoveryUsed: false,
    cuttable: false,
    coyote: 0.1,
    damage: 0,
    stocks,
    charge: 0,
    channeling: false,
    signatureDodge: 0,
    weapon: 0,
    lastStance: null,
    stanceStreak: 0,
    stanceMemory: 0,
    ride: 0,
    px: player === 0 ? 440 : 840,
    py: spawnY,
    attack: null,
    attackCD: 0,
    dodgeCD: 0,
    dodgeTime: 0,
    dodgeVectorX: 0,
    dodgeVectorY: 0,
    invulnerable: 0,
    stun: 0,
    slow: 0,
    respawn: 0,
    combo: 0,
    comboTimer: 0,
    maxCombo: 0,
    score: 0,
    kos: 0,
    attackChain: 0,
    chainTimer: 0,
    attackStance: null,
    landingLag: 0,
    bufferedAction: null,
    bufferTime: 0,
    flash: 0,
    specialTime: 0,
    passTime: 0,
    landSquash: 0,
    aiClock: 0,
    aiSwap: 5,
    aiActions: new Set(),
  };
}

export class Engine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  settings: Settings;
  fighters: [Fighter, Fighter];
  phase: Phase = "countdown";
  previousPhase: Phase = "countdown";
  time = 0;
  elapsed = 0;
  countdown = 3.0;
  announcement = "";
  announcementTime = 0;
  particles: Particle[] = [];
  projectiles: Projectile[] = [];
  effects: Effect[] = [];
  texts: FloatingText[] = [];
  shake = 0;
  hitstop = 0;
  flash = 0;
  /** Eased camera drift toward the action, kept small so platforms stay aligned. */
  camX = 0;
  camY = 0;
  /**
   * Fraction of a physics step left in the accumulator. The renderer blends
   * each fighter between its previous and current position by this amount so
   * motion stays smooth on 90/120/144Hz displays instead of juddering.
   */
  renderAlpha = 0;
  /** The arena currently loaded, including its hazard and traction. */
  stage: StageDefinition;
  /** Timer driving wind gusts and the lava scorch. */
  hazardClock = 0;
  /** Current gust direction, eased so it never snaps. */
  gust = 0;
  /** Height of the main platform, used for respawns. */
  spawnY = 545;
  background = new Image();
  held = [new Set<Action>(), new Set<Action>()];
  taps = [new Set<Action>(), new Set<Action>()];
  private raf = 0;
  private disposed = false;
  private lastTime = 0;
  private accumulator = 0;
  private hudClock = 0;
  private lastCount = 4;
  private resizeObserver: ResizeObserver;
  private onSnapshot: (snapshot: Snapshot) => void;
  private onFinish: (result: MatchResult) => void;
  threeRenderer: ThreeFighterRenderer | null = null;
  has3D = false;

  constructor(
    canvas: HTMLCanvasElement,
    fighterId: string,
    settings: Settings,
    onSnapshot: (snapshot: Snapshot) => void,
    onFinish: (result: MatchResult) => void,
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false })!;
    this.settings = settings;
    this.onSnapshot = onSnapshot;
    this.onFinish = onFinish;
    const first = FIGHTERS.find((f) => f.id === fighterId) ?? FIGHTERS[0];
    const second =
      FIGHTERS.find((f) => f.id === settings.opponent) ?? FIGHTERS[1];
    this.stage = getStage(settings.stage);
    const platforms = loadStagePlatforms(this.stage);
    this.spawnY = platforms.find((p) => p.main)?.y ?? 545;
    const spawnY = this.spawnY;
    this.fighters = [
      makeFighter(first, 0, spawnY, settings.stocks || 3),
      makeFighter(second, 1, spawnY, settings.stocks || 3),
    ];
    // A melee opening on the easier tiers makes the first exchange immediate.
    if (
      settings.mode === "cpu" &&
      (settings.difficulty === "rookie" || settings.difficulty === "novice") &&
      WEAPONS[second.weapons[0]].ranged
    ) {
      this.fighters[1].weapon = 1;
      this.fighters[1].aiSwap = 11;
    }
    this.resizeCanvas();
    this.resizeObserver = new ResizeObserver(() => this.resizeCanvas());
    this.resizeObserver.observe(canvas);
    this.background.src = this.stage.art;
    this.emit();
    this.raf = requestAnimationFrame(this.frame);
  }

  ensure3D(): ThreeFighterRenderer | null {
    if (!this.threeRenderer) {
      this.threeRenderer = getSharedThreeRenderer();
      this.has3D = !!this.threeRenderer;
      if (this.threeRenderer) {
        this.threeRenderer.syncResolution(
          this.canvas.width,
          this.canvas.height,
        );
      }
    }
    return this.threeRenderer;
  }

  private resizeCanvas() {
    if (this.disposed) return;
    const bounds = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    // Match the visible surface instead of oversampling a small mobile canvas.
    const scale = Math.min(
      1.5,
      Math.max(
        0.5,
        Math.max(
          (bounds.width || WIDTH) / WIDTH,
          (bounds.height || HEIGHT) / HEIGHT,
        ) * dpr,
      ),
    );
    const width = Math.round(WIDTH * scale);
    const height = Math.round(HEIGHT * scale);
    if (this.canvas.width === width && this.canvas.height === height) return;
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx.setTransform(width / WIDTH, 0, 0, height / HEIGHT, 0, 0);
    this.threeRenderer?.syncResolution(width, height);
  }

  private frame = (now: number) => {
    if (this.disposed) return;
    if (!this.lastTime) this.lastTime = now;
    const delta = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;
    // Fixed-step simulation keeps jump arcs and combo timing identical at any refresh rate.
    if (this.phase !== "paused") {
      this.accumulator += delta;
      while (this.accumulator >= 1 / 60) {
        this.update(1 / 60);
        this.accumulator -= 1 / 60;
      }
      this.renderAlpha = Math.min(1, this.accumulator * 60);
    }
    // Gently drift the camera toward the fighters' midpoint and height.
    const [ca, cb] = this.fighters;
    const targetX = clamp(((ca.x + cb.x) / 2 - WIDTH / 2) * 0.06, -22, 22);
    const targetY = clamp((Math.min(ca.y, cb.y) - 430) * 0.05, -16, 14);
    const camEase = 1 - Math.exp(-3.4 * delta);
    this.camX += (targetX - this.camX) * camEase;
    this.camY += (targetY - this.camY) * camEase;
    renderGame(this.ctx, this);
    this.hudClock += delta;
    if (this.hudClock >= 0.065) {
      this.emit();
      this.hudClock = 0;
    }
    this.raf = requestAnimationFrame(this.frame);
  };

  private emit() {
    this.onSnapshot({
      phase: this.phase,
      elapsed: this.elapsed,
      timeRemaining: this.settings.timeLimit
        ? Math.max(0, this.settings.timeLimit - this.elapsed)
        : 0,
      countdown: this.countdown,
      announcement: this.announcementTime > 0 ? this.announcement : "",
      stage: this.stage.name,
      hazard: this.stage.hazardText,
      fighters: this.fighters.map((f) => ({
        id: f.def.id,
        damage: Math.round(f.damage),
        maxHealth: f.maxHealth,
        stocks: f.stocks,
        charge: Math.floor(f.charge),
        channeling: f.channeling,
        signatureDodge: f.signatureDodge,
        weapon: f.def.weapons[f.weapon],
        move: f.attack?.move?.name ?? "",
        dodgeCD: f.dodgeCD,
        jumpsRemaining: Math.max(0, MAX_JUMPS - f.jumps),
        recoveryReady: !f.recoveryUsed,
        score: f.score,
        combo: f.comboTimer > 0 ? f.combo : 0,
        respawn: f.respawn,
      })),
    });
  }

  input(player: number, action: Action, down: boolean) {
    if (down) {
      if (!this.held[player].has(action)) this.taps[player].add(action);
      this.held[player].add(action);
    } else this.held[player].delete(action);
  }

  clearInput() {
    this.held.forEach((s) => s.clear());
    this.taps.forEach((s) => s.clear());
  }

  pause() {
    if (this.phase === "paused" || this.phase === "over") return;
    this.previousPhase = this.phase;
    this.phase = "paused";
    this.clearInput();
    this.emit();
  }

  resume() {
    if (this.phase !== "paused") return;
    this.phase = this.previousPhase;
    this.accumulator = 0;
    this.lastTime = performance.now();
    this.emit();
  }

  destroy() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.clearInput();
  }

  burst(
    x: number,
    y: number,
    color: string,
    count = 18,
    force = 250,
    kind: Particle["kind"] = "spark",
  ) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (0.25 + Math.random() * 0.75) * force;
      const life = 0.22 + Math.random() * 0.42;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life,
        maxLife: life,
        size: kind === "dust" ? 3 + Math.random() * 6 : 1.5 + Math.random() * 3,
        color,
        kind,
      });
    }
    if (this.particles.length > 280)
      this.particles.splice(0, this.particles.length - 280);
  }

  private update(dt: number) {
    // Remember where everyone was so the renderer can interpolate.
    for (const f of this.fighters) {
      f.px = f.x;
      f.py = f.y;
    }
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 28);
    this.flash = Math.max(0, this.flash - dt * 4);
    this.announcementTime = Math.max(0, this.announcementTime - dt);
    this.updateVisuals(dt);
    if (this.phase === "over") return;
    if (this.phase === "countdown") {
      this.countdown -= dt;
      const count = Math.ceil(this.countdown);
      if (count !== this.lastCount && count > 0) audio.countdown();
      this.lastCount = count;
      if (this.countdown <= 0) {
        this.phase = "running";
        this.announce("FIGHT", 0.7);
        audio.fight();
      }
      this.taps.forEach((s) => s.clear());
      return;
    }
    this.elapsed += dt;
    if (this.hitstop > 0) {
      this.hitstop -= dt;
      if (this.settings.timeLimit && this.elapsed >= this.settings.timeLimit)
        this.finishOnTime();
      return;
    }
    if (this.settings.mode === "cpu") this.updateAI(dt);
    this.updateStage(dt);
    for (const f of this.fighters) {
      if (this.phase !== "running") break;
      this.updateFighter(f, dt);
    }
    if (this.phase === "running") this.updateProjectiles(dt);
    if (
      this.phase === "running" &&
      this.settings.timeLimit &&
      this.elapsed >= this.settings.timeLimit
    )
      this.finishOnTime();
    this.taps.forEach((s) => s.clear());
  }

  private updateVisuals(dt: number) {
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (p.kind === "dust" ? -40 : 430) * dt;
      p.vx *= 0.98;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const t of this.texts) {
      t.life -= dt;
      t.y -= 48 * dt;
    }
    this.texts = this.texts.filter((t) => t.life > 0);
    for (const e of this.effects) {
      e.time += dt;
      if (e.kind === "vortex" && this.phase === "running") {
        const other = this.fighters[1 - e.owner];
        const distance = Math.hypot(other.x - e.x, other.y - 45 - e.y);
        if (distance < e.radius && other.respawn <= 0 && other.invulnerable <= 0) {
          if (e.time < 0.72) {
            other.vx += (e.x - other.x) * dt * 13;
            other.vy += (e.y + 45 - other.y) * dt * 8;
          } else if (!e.hit) {
            e.hit = true;
            this.hit(
              this.fighters[e.owner],
              other,
              38,
              true,
              true,
              null,
              signatureStun(this.fighters[e.owner].def.special.type),
            );
            this.burst(e.x, e.y, e.color, 38, 400);
          }
        }
      }
    }
    this.effects = this.effects.filter((e) => e.time < e.duration);
  }

  /**
   * Advances the arena itself: sliding platforms, wind gusts, and the melt.
   * Hazards nudge rather than punish outright, so they change spacing without
   * stealing stocks on their own.
   */
  private updateStage(dt: number) {
    this.hazardClock += dt;

    for (const p of PLATFORMS) {
      if (!p.move) continue;
      const previousX = p.x;
      const previousY = p.y;
      const offset =
        Math.sin(this.hazardClock * p.move.speed * Math.PI) * p.move.range;
      if (p.move.axis === "x") p.x = p.baseX + offset;
      else p.y = p.baseY + offset;
      p.dx = p.x - previousX;
      p.dy = p.y - previousY;
      // Carry anyone standing on this platform along with it.
      for (const f of this.fighters) {
        if (
          !f.grounded ||
          f.respawn > 0 ||
          Math.abs(f.y - previousY) > 2 ||
          f.x < p.x - 14 ||
          f.x > p.x + p.w + 14
        )
          continue;
        f.x += p.dx;
        f.y += p.dy;
        f.ride = p.dx / dt;
      }
    }

    if (this.stage.hazard === "wind") {
      // Gusts swell and fade on a slow cycle so they read on screen.
      const cycle =
        Math.sin(this.hazardClock * 0.42) * Math.sin(this.hazardClock * 0.17);
      const target = cycle > 0.35 ? Math.sign(cycle) * 110 : 0;
      this.gust = approach(this.gust, target, 190 * dt);
      if (Math.abs(this.gust) > 60 && Math.random() < 0.35)
        this.burst(
          Math.random() * WIDTH,
          120 + Math.random() * 380,
          "#cfe6f5",
          1,
          40,
          "dust",
        );
      for (const f of this.fighters) {
        if (f.respawn > 0) continue;
        // Applied as displacement rather than velocity: the movement step
        // scrubs vx back toward the player's intended speed, which would
        // otherwise cancel the gust entirely.
        const shove = this.gust * dt * (f.grounded ? 0.16 : 0.6);
        f.x += shove;
        f.vx += shove * 3;
        f.ride = shove / dt;
      }
    } else if (this.stage.hazard === "lava") {
      const melt = HEIGHT - 96;
      for (const f of this.fighters) {
        if (f.respawn > 0 || f.y < melt) continue;
        const depth = Math.min(1, (f.y - melt) / 120);
        f.damage += (26 + depth * 44) * dt * f.derived.damageTaken;
        if (Math.random() < 0.5)
          this.burst(f.x, f.y - 10, "#ff8a3c", 2, 150, "glow");
        if (f.damage >= f.maxHealth) this.loseStock(f);
      }
      if (Math.random() < 0.25)
        this.burst(
          260 + Math.random() * 760,
          HEIGHT - 60,
          "#ff9a4c",
          1,
          210,
          "glow",
        );
    }
  }

  private updateFighter(f: Fighter, dt: number) {
    const held =
      f.player === 1 && this.settings.mode === "cpu"
        ? f.aiActions
        : this.held[f.player];
    const taps = this.taps[f.player];
    f.attackCD = Math.max(0, f.attackCD - dt);
    f.dodgeCD = Math.max(0, f.dodgeCD - dt);
    f.dodgeTime = Math.max(0, f.dodgeTime - dt);
    f.signatureDodge = Math.max(0, f.signatureDodge - dt);
    f.invulnerable = Math.max(0, f.invulnerable - dt);
    f.stun = Math.max(0, f.stun - dt);
    f.slow = Math.max(0, f.slow - dt);
    f.flash = Math.max(0, f.flash - dt);
    f.specialTime = Math.max(0, f.specialTime - dt);
    f.chainTimer = Math.max(0, f.chainTimer - dt);
    f.landingLag = Math.max(0, f.landingLag - dt);
    // The spam tax fades once a fighter stops repeating the same move.
    f.stanceMemory = Math.max(0, f.stanceMemory - dt);
    if (f.stanceMemory === 0) {
      f.stanceStreak = 0;
      f.lastStance = null;
    }
    f.bufferTime = Math.max(0, f.bufferTime - dt);
    f.comboTimer = Math.max(0, f.comboTimer - dt);
    f.passTime = Math.max(0, f.passTime - dt);
    f.landSquash = Math.max(0, f.landSquash - dt * 6);
    if (f.comboTimer === 0) f.combo = 0;
    if (f.chainTimer === 0) {
      f.attackChain = 0;
      f.attackStance = null;
    }
    if (f.respawn > 0) {
      f.respawn -= dt;
      if (f.respawn <= 0) {
        f.x = f.player === 0 ? 445 : 835;
        f.y = this.spawnY - 315;
        f.vx = 0;
        f.vy = 0;
        f.damage = 0;
        f.invulnerable = 1.6;
        f.jumps = 0;
        f.recoveryUsed = false;
        f.cuttable = false;
        f.channeling = false;
        f.signatureDodge = 0;
        f.dodgeTime = 0;
        f.stun = 0;
        this.burst(f.x, f.y - 40, f.def.color, 26, 140, "glow");
      }
      return;
    }
    if (f.stocks <= 0) return;

    // Brief input buffering preserves fast taps made during an attack's recovery.
    for (const action of ["light", "heavy", "special"] as const) {
      if (taps.has(action) && (action !== "special" || f.charge >= 75)) {
        f.bufferedAction = action;
        f.bufferTime = 0.22;
      }
    }
    const buffered = f.bufferTime > 0 ? f.bufferedAction : null;

    const direction = (held.has("right") ? 1 : 0) - (held.has("left") ? 1 : 0);
    // Channeling fills the signature meter without landing hits, but roots the
    // fighter in place and makes incoming damage more punishing.
    f.channeling =
      held.has("charge") &&
      f.charge < 75 &&
      f.grounded &&
      f.stun <= 0 &&
      f.dodgeTime <= 0 &&
      f.specialTime <= 0 &&
      !f.attack;
    if (f.channeling) {
      const previous = f.charge;
      f.charge = Math.min(75, f.charge + dt * 20);
      f.vx = approach(f.vx, 0, 3200 * dt);
      if (Math.random() < 0.18)
        this.burst(f.x, f.y - 48, f.def.color, 1, 42, "glow");
      if (previous < 75 && f.charge >= 75) {
        audio.charge();
        this.texts.push({
          x: f.x,
          y: f.y - 140,
          text: "SPECIAL READY",
          color: f.def.color,
          life: 1.2,
          size: 16,
        });
      }
    }
    // Escape a combo with a committed dodge. You cannot cancel a live attack,
    // its endlag, a special cast, or landing recovery just to gain free i-frames.
    // Stunned defenders may still spend their two-second cooldown to break out.
    if (
      !f.channeling && taps.has("dodge") && f.dodgeCD <= 0 &&
      f.dodgeTime <= 0 && !f.attack && (f.stun > 0 || f.attackCD <= 0) &&
      f.specialTime <= 0 && f.landingLag <= 0
    ) {
      f.dodgeCD = DODGE_COOLDOWN;
      f.dodgeTime = DODGE_DURATION;
      // Only the first 0.18s is safe; the final 0.12s is punishable recovery.
      f.invulnerable = Math.max(f.invulnerable, DODGE_IFRAMES);
      const air = !f.grounded;
      // Air dodge selection: left/right takes priority, then down / jump(up).
      // Neutral air dodge holds position without refreshing a jump or recovery.
      const vertical = air && !direction && (held.has("down") || held.has("jump"));
      f.dodgeVectorX = vertical ? 0 : (direction || (!air ? f.facing : 0));
      f.dodgeVectorY = vertical ? (held.has("down") ? 1 : -1) : 0;
      if (f.dodgeVectorX) {
        f.vx = f.dodgeVectorX * DODGE_SPEED;
        if (air) f.vy *= 0.1;
        else f.vy = 0;
      } else if (f.dodgeVectorY) {
        f.vx *= 0.12;
        f.vy = f.dodgeVectorY * DODGE_SPEED;
      } else {
        f.vx *= 0.1;
        f.vy *= 0.1;
      }
      f.stun = 0;
      f.cuttable = false;
      f.bufferedAction = null;
      f.bufferTime = 0;
      this.burst(f.x, f.y - 35, "#bcd8f0", 12, 110, "dust");
      audio.dodge();
    }
    if (f.dodgeTime > 0) {
      if (Math.random() < 0.65)
        this.burst(f.x, f.y - 35, f.def.color, 1, 20, "glow");
    } else if (
      !f.channeling &&
      f.stun <= 0 &&
      f.specialTime < 0.2 &&
      f.landingLag <= 0
    ) {
      // Turning is locked while an attack is out so swings stay committed.
      if (direction && !f.attack)
        f.facing =
          f.player === 1 && this.settings.mode === "cpu"
            ? this.fighters[0].x >= f.x
              ? 1
              : -1
            : direction;
      // Each move states how much air control the player keeps mid-swing.
      const control = f.attack?.move ? f.attack.move.drift : 1;
      // The speed stat scales run speed; heavy fighters stay heavy.
      const target =
        direction *
        f.def.speed *
        f.derived.moveScale *
        (f.slow > 0 ? 0.58 : 1) *
        control;
      // Icy stages bleed off acceleration so dashes overshoot.
      const grip = f.grounded ? this.stage.friction : 1;
      // Airborne with no direction held keeps momentum instead of snapping to
      // a stop, so jumps, knockback and stage hazards all carry properly.
      const stopping = direction === 0;
      const turning =
        direction !== 0 &&
        Math.abs(f.vx) > 40 &&
        Math.sign(f.vx) === -direction;
      const accel =
        (f.grounded ? 2500 * grip : stopping ? 520 : 1600) *
        (turning ? 1.7 : 1) *
        (f.attack ? control : 1);
      f.vx = approach(f.vx, target, accel * dt);
      // A light exponential drag bleeds leftover air momentum smoothly.
      if (!f.grounded && stopping) f.vx *= Math.exp(-1.15 * dt);
      if (f.grounded && grip < 1 && direction === 0) f.vx *= 1 - 1.1 * dt;
      if (
        taps.has("jump") &&
        (f.grounded || f.coyote > 0 || f.jumps < MAX_JUMPS)
      ) {
        f.vy =
          f.jumps === 0 || f.coyote > 0 ? -720 : f.jumps === 1 ? -640 : -605;
        f.jumps = f.grounded || f.coyote > 0 ? 1 : f.jumps + 1;
        f.grounded = false;
        f.coyote = 0;
        f.cuttable = true;
        this.burst(f.x, f.y, f.def.color, 10, 110, "dust");
        audio.jump();
        this.effects.push({
          x: f.x,
          y: f.y,
          radius: 30,
          time: 0,
          duration: 0.3,
          color: f.def.color,
          kind: "jump",
          dir: 1,
          owner: f.player,
          hit: false,
        });
      }
      if (taps.has("recovery") && !f.grounded && !f.recoveryUsed) {
        f.recoveryUsed = true;
        f.attack = {
          kind: "recovery",
          time: 0,
          duration: 0.42,
          hit: false,
          weapon: f.def.weapons[f.weapon],
          chain: 0,
          stance: "aN",
          move: null,
          windows: [],
          fired: true,
        };
        f.attackCD = Math.max(f.attackCD, 0.42);
        f.specialTime = 0.22;
        f.cuttable = false;
        f.vy = -720;
        f.vx = direction ? direction * 330 : f.vx * 0.65;
        this.burst(f.x, f.y - 55, f.def.color, 20, 210, "glow");
        this.effects.push({
          x: f.x,
          y: f.y - 60,
          radius: 90,
          time: 0,
          duration: 0.36,
          color: f.def.color,
          kind: "jump",
          dir: f.facing,
          owner: f.player,
          hit: false,
        });
        audio.recovery();
      }
      if (taps.has("down") && f.grounded && f.y < 500) {
        f.passTime = 0.24;
        f.y += 8;
        f.grounded = false;
      }
      if (taps.has("swap") && f.attackCD < 0.18) {
        f.weapon = 1 - f.weapon;
        f.attackChain = 0;
        f.attackCD = 0.1;
        f.stanceStreak = 0;
        f.lastStance = null;
        const newWep = f.def.weapons[f.weapon];
        this.texts.push({
          x: f.x,
          y: f.y - 125,
          text: `SWAP: ${newWep.toUpperCase()}!`,
          color: f.def.color,
          life: 0.85,
          size: 15,
        });
        this.burst(f.x + f.facing * 25, f.y - 55, f.def.color, 14, 110, "glow");
        this.effects.push({
          x: f.x,
          y: f.y - 45,
          radius: 44,
          time: 0,
          duration: 0.28,
          color: f.def.color,
          kind: "jump",
          dir: f.facing,
          owner: f.player,
          hit: false,
        });
        audio.swap();
      }
      // Attack direction comes from the stick/keys held at the moment of input.
      const stance = stanceFor(f.grounded, held.has("down"), direction !== 0);
      if (buffered === "special" && f.charge >= 75 && f.attackCD <= 0)
        this.special(f);
      else if ((held.has("heavy") || buffered === "heavy") && f.attackCD <= 0)
        this.attack(f, "heavy", stance);
      else if ((held.has("light") || buffered === "light") && f.attackCD <= 0)
        this.attack(f, "light", stance);
    } else if (f.stun > 0) {
      // Knockback decays smoothly; holding a direction nudges the arc (DI).
      f.vx *= Math.exp(-1.9 * dt);
      if (direction) f.vx += direction * 300 * dt;
      if (held.has("down")) f.vy += 420 * dt;
      else if (held.has("jump")) f.vy -= 260 * dt;
    }

    const human = this.settings.mode === "local" || f.player === 0;
    // Variable jump height: releasing jump early shortens a player jump.
    if (
      human &&
      f.cuttable &&
      !f.grounded &&
      !held.has("jump") &&
      f.vy < -240 &&
      f.stun <= 0 &&
      f.dodgeTime <= 0
    ) {
      f.vy = approach(f.vy, -240, 2600 * dt);
    }

    const previousY = f.y;
    if (f.dodgeTime <= 0) {
      let gravity = 1680;
      if (!f.grounded && f.stun <= 0) {
        // Apex hang gives a brief float at the top of a jump.
        if (Math.abs(f.vy) < 150) gravity *= 0.62;
        // Holding down fast-falls for quicker landings and down-air pressure.
        if (held.has("down") && f.vy > -60) gravity *= 1.65;
      }
      f.vy += gravity * dt;
    }
    const terminal =
      !f.grounded && held.has("down") && f.stun <= 0 ? 1400 : 1100;
    f.vy = Math.min(f.vy, terminal);
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    const wasGrounded = f.grounded;
    f.grounded = false;
    if (f.vy >= 0) {
      for (const p of PLATFORMS) {
        if (!p.main && f.passTime > 0) continue;
        if (
          f.x + 15 > p.x &&
          f.x - 15 < p.x + p.w &&
          previousY <= p.y + 4 &&
          f.y >= p.y
        ) {
          f.y = p.y;
          f.vy = 0;
          f.grounded = true;
          f.jumps = 0;
          f.recoveryUsed = false;
          f.cuttable = false;
          f.coyote = 0.1;
          if (!wasGrounded) {
            f.landSquash = 0.85;
            this.burst(f.x, f.y, "#a1b1c6", 7, 90, "dust");
            // An aerial cut short by the floor pays its landing lag.
            const aerial = f.attack?.move;
            if (aerial && f.attack!.kind !== "special") {
              f.landingLag = aerial.landingLag;
              f.attackCD = Math.max(f.attackCD, aerial.landingLag);
              f.attack = null;
              if (aerial.spike) {
                // Dive attacks crater the stage even when they miss.
                this.burst(f.x, f.y, f.def.color, 20, 300, "dust");
                this.effects.push({
                  x: f.x,
                  y: f.y,
                  radius: 120,
                  time: 0,
                  duration: 0.4,
                  color: f.def.color,
                  kind: "quake",
                  dir: f.facing,
                  owner: f.player,
                  hit: false,
                });
                this.shake = Math.max(this.shake, 6);
                audio.spikeLand();
              }
            }
          }
          break;
        }
      }
    }
    if (!f.grounded) {
      f.coyote = Math.max(0, f.coyote - dt);
      if (f.coyote === 0 && f.jumps === 0) f.jumps = 1;
    }

    if (f.attack) {
      f.attack.time += dt;
      const a = f.attack;
      const other = this.fighters[1 - f.player];
      const isDash =
        a.kind === "special" && ["rift", "dragon"].includes(f.def.special.type);
      if (a.kind === "recovery" && !a.hit && a.time >= 0.07 && a.time < 0.25) {
        if (this.overlaps(f, other, 20, -117, 65, 68)) {
          a.hit = this.hit(f, other, 8, false, false);
          if (a.hit) other.vy = -Math.max(370, Math.abs(other.vy));
        }
      } else if (isDash && !a.hit) {
        if (a.time >= 0.06 && this.overlaps(f, other, 20, -52, 150, 60)) {
          a.hit = this.hit(
            f,
            other,
            f.def.special.type === "dragon" ? 36 : 34,
            true,
            true,
            null,
            signatureStun(f.def.special.type),
          );
        }
      } else if (a.move) {
        const move = a.move;
        if (move.projectile && !a.fired && a.time >= move.startup) {
          a.fired = true;
          this.fireProjectile(f, a, move);
        }
        if (move.hw > 0 && a.windows.length) {
          const window = move.active / move.multi;
          const next = a.windows[0];
          if (a.time >= next) {
            const expired = a.time > next + window;
            const landed =
              !expired &&
              this.overlaps(f, other, move.hx, move.hy, move.hw, move.hh);
            if (landed || expired) a.windows.shift();
            if (landed) {
              a.hit = true;
              this.hit(
                f,
                other,
                move.damage * (a.chain === 3 && a.kind === "light" ? 1.35 : 1),
                move.heavyHit || move.spike || move.launch || a.chain === 3,
                false,
                move,
              );
            }
          }
        }
      }
      if (a.time >= a.duration) f.attack = null;
    }
    // Each stage sets its own blast zone, so ring-out pressure varies.
    const margin = this.stage.blastMargin;
    if (
      f.y > HEIGHT + margin ||
      f.x < -margin ||
      f.x > WIDTH + margin ||
      f.y < -margin - 130
    )
      this.loseStock(f);
  }

  /** Axis-aligned test between a move's hitbox and the opponent's body. */
  private overlaps(
    f: Fighter,
    other: Fighter,
    hx: number,
    hy: number,
    hw: number,
    hh: number,
  ) {
    if (other.respawn > 0 || other.stocks <= 0) return false;
    // The reach stat stretches a fighter's hitboxes outward.
    const scale = f.derived.reachScale;
    const boxX = f.x + hx * f.facing * scale;
    const boxY = f.y + hy;
    return (
      Math.abs(boxX - other.x) < hw * scale + 22 &&
      Math.abs(boxY - (other.y - 48)) < hh * scale + 46
    );
  }

  private fireProjectile(f: Fighter, a: Attack, move: MoveDef) {
    const spec = move.projectile!;
    const damage =
      move.damage * (a.chain === 3 && a.kind === "light" ? 1.35 : 1);
    for (let i = 0; i < spec.count; i++) {
      const offset =
        spec.count > 1 ? (i - (spec.count - 1) / 2) * spec.spread : 0;
      this.projectile(
        f,
        f.x + f.facing * 34,
        f.y - 48 + (spec.vy > 400 ? 14 : 0),
        f.facing * spec.speed + (spec.vy > 400 ? offset * f.facing : 0),
        spec.vy + (spec.vy > 400 ? 0 : offset),
        damage,
        false,
        spec.kind,
        spec.radius,
        0,
        move.spike,
      );
    }
    audio.shot();
  }

  private attack(f: Fighter, kind: "light" | "heavy", stance: Stance) {
    f.bufferTime = 0;
    const weaponName = f.def.weapons[f.weapon];
    const weapon = WEAPONS[weaponName];
    const move = getMove(weaponName, stance, kind === "heavy");
    // Chains only continue while repeating the same stance with light attacks.
    f.attackChain =
      kind === "light" && f.attackStance === stance
        ? (f.attackChain % 3) + 1
        : kind === "light"
          ? 1
          : 3;
    f.attackStance = stance;
    f.chainTimer = 0.9;
    const windows: number[] = [];
    for (let i = 0; i < move.multi; i++)
      windows.push(move.startup + (move.active / move.multi) * i);
    f.attack = {
      kind,
      time: 0,
      duration: move.duration,
      hit: false,
      weapon: weaponName,
      chain: f.attackChain,
      stance,
      move,
      windows,
      fired: false,
    };
    // Repeating one stance is taxed so pressure has to be earned. Mixing in a
    // different direction, or letting the memory lapse, clears the tax.
    if (f.lastStance === stance && f.stanceMemory > 0) f.stanceStreak++;
    else f.stanceStreak = 0;
    f.lastStance = stance;
    f.stanceMemory = SPAM_TAX.memory;
    const tax =
      f.stanceStreak <= 0
        ? SPAM_TAX.first
        : f.stanceStreak === 1
          ? SPAM_TAX.second
          : SPAM_TAX.third;
    f.attackCD =
      (move.duration * (kind === "heavy" ? 0.82 : 0.72) +
        (weapon.ranged ? 0.06 : 0) +
        // A floor on every attack, so no move can be machine-gunned.
        0.055) *
      tax *
      f.derived.cooldownScale;
    if (move.selfVx) f.vx += f.facing * move.selfVx;
    if (move.selfVy) {
      f.vy = move.selfVy > 0 ? move.selfVy : Math.min(f.vy, move.selfVy);
      if (move.selfVy > 0) f.grounded = false;
    }
    if (!move.projectile) {
      f.vx += f.facing * (kind === "heavy" ? 60 : 30);
      audio.swing(move.sfx, kind === "heavy");
    }
    if (kind === "light" && f.attackChain > 1) audio.chain(f.attackChain - 1);
    // A readable tell for the chain finisher.
    if (f.attackChain === 3 && kind === "light")
      this.burst(f.x + f.facing * 30, f.y - 55, f.def.color, 8, 110, "glow");
  }

  private projectile(
    f: Fighter,
    x: number,
    y: number,
    vx: number,
    vy: number,
    damage: number,
    special: boolean,
    kind: string,
    radius: number,
    delay = 0,
    spike = false,
    maxRange = special
      ? 1000
      : Math.min(WEAPONS[f.def.weapons[f.weapon]].range, 620),
  ) {
    this.projectiles.push({
      x,
      y,
      vx,
      vy,
      damage,
      special,
      kind,
      radius,
      delay,
      spike,
      life: 2.2,
      traveled: 0,
      maxRange,
      owner: f.player,
      color: f.def.color,
      trail: [],
    });
  }

  private special(f: Fighter) {
    f.charge = 0;
    // Every signature opens with a half-second protected cast window.
    f.signatureDodge = 0.5;
    f.invulnerable = Math.max(f.invulnerable, 0.5);
    f.attackCD = 0.9;
    f.specialTime = 0.6;
    f.bufferTime = 0;
    f.cuttable = false;
    f.attack = {
      kind: "special",
      time: 0,
      duration: 0.55,
      hit: false,
      weapon: f.def.weapons[f.weapon],
      chain: 3,
      stance: f.grounded ? "gS" : "aS",
      move: null,
      windows: [],
      fired: true,
    };
    const other = this.fighters[1 - f.player];
    const color = f.def.color;
    const type = f.def.special.type;
    this.announce(f.def.special.name.toUpperCase(), 1.2);
    this.burst(f.x, f.y - 45, color, 30, 300);
    this.shake = 7;
    audio.special();
    const effect = (
      kind: string,
      radius: number,
      duration = 0.65,
      x = f.x,
      y = f.y - 45,
    ) => {
      this.effects.push({
        x,
        y,
        radius,
        time: 0,
        duration,
        color,
        kind,
        dir: f.facing,
        owner: f.player,
        hit: false,
      });
    };
    const area = (radius: number, damage: number) => {
      if (Math.hypot(other.x - f.x, other.y - f.y) < radius)
        return this.hit(
          f,
          other,
          damage,
          true,
          true,
          null,
          signatureStun(type),
        );
      return false;
    };
    if (type === "rift" || type === "dragon") {
      f.specialTime = 0.42;
      f.vx = f.facing * (type === "rift" ? 880 : 800);
      f.vy = -45;
      f.invulnerable = Math.max(f.invulnerable, 0.5);
      effect(type === "rift" ? "rift" : "flame", 250, 0.6);
    } else if (type === "overdrive") {
      for (let i = 0; i < 7; i++)
        this.projectile(
          f,
          f.x + f.facing * 38,
          f.y - 48,
          f.facing * 1050,
          ((i % 3) - 1) * 34,
          8,
          true,
          "plasma",
          10,
          i * 0.065,
        );
      effect("nova", 90, 0.4);
    } else if (type === "quake") {
      area(130, 18);
      for (const dir of [-1, 1])
        this.projectile(
          f,
          f.x + dir * 45,
          f.y - 25,
          dir * 690,
          0,
          26,
          true,
          "wave",
          34,
        );
      effect("quake", 350, 0.75, f.x, f.y);
      this.shake = 14;
    } else if (type === "rain") {
      for (let i = 0; i < 10; i++)
        this.projectile(
          f,
          other.x - 160 + i * 36,
          other.y - 390 - (i % 3) * 30,
          0,
          860,
          7,
          true,
          "arrow",
          10,
          i * 0.045,
        );
      effect("nova", 80, 0.45, other.x, other.y - 340);
    } else if (type === "sandstorm") {
      effect("nova", 100, 0.4);
      f.x = clamp(other.x - other.facing * 60, 230, 1050);
      f.y = other.y;
      f.facing = other.x >= f.x ? 1 : -1;
      f.invulnerable = Math.max(f.invulnerable, 0.5);
      area(170, 34);
      effect("whirl", 160, 0.65);
    } else if (type === "deadeye") {
      effect("beam", 1150, 0.55);
      if ((other.x - f.x) * f.facing > -20 && Math.abs(other.y - f.y) < 80)
        this.hit(f, other, 36, true, true, null, signatureStun(type));
    } else if (type === "singularity") {
      effect("vortex", 250, 1.2, f.x + f.facing * 145, f.y - 45);
    } else if (type === "frost") {
      if (area(265, 34)) other.slow = 2.5;
      effect("ice", 270, 0.85);
    } else if (type === "nova") {
      area(280, 38);
      effect("nova", 280, 0.75);
      f.vy = -180;
      this.shake = 12;
    } else if (type === "whirlwind") {
      effect("whirl", 220, 0.7);
      area(200, 34);
      f.vx = f.facing * 520;
      f.vy = -140;
      this.shake = 12;
    } else if (type === "chain_strike") {
      effect("beam", 1050, 0.45);
      effect("whirl", 150, 0.55);
      f.vx = -f.facing * 120;
      if ((other.x - f.x) * f.facing > -20 && Math.abs(other.y - f.y) < 85) {
        this.hit(f, other, 36, true, true, null, signatureStun(type));
        other.vx = -f.facing * 420;
        other.vy = -120;
      }
    } else if (type === "broadside") {
      for (let i = 0; i < 4; i++) {
        this.projectile(
          f,
          f.x + f.facing * 42,
          f.y - 45,
          f.facing * 920,
          (i - 1.5) * 40,
          12,
          true,
          "wave",
          22,
          i * 0.075,
        );
      }
      f.vx = -f.facing * 180;
      effect("nova", 150, 0.5);
      this.shake = 16;
    } else if (type === "sol_lotus") {
      f.vx = f.facing * 240;
      f.vy = -240;
      area(250, 35);
      effect("nova", 260, 0.75);
      effect("whirl", 180, 0.65);
      this.shake = 12;
    } else if (type === "eruption") {
      area(220, 38);
      for (const dir of [-1, 0, 1]) {
        this.projectile(
          f,
          f.x + dir * 55,
          f.y - 24,
          dir * 520,
          -320,
          22,
          true,
          "wave",
          26,
        );
      }
      effect("quake", 340, 0.85, f.x, f.y);
      effect("flame", 190, 0.65);
      this.shake = 17;
    } else if (type === "tempest") {
      f.vx = f.facing * 740;
      f.vy = -110;
      f.invulnerable = Math.max(f.invulnerable, 0.5);
      area(190, 28);
      for (const i of [0, 1]) {
        this.projectile(
          f,
          f.x + f.facing * 36,
          f.y - 48,
          f.facing * 980,
          (i === 0 ? -1 : 1) * 40,
          9,
          true,
          "plasma",
          11,
          i * 0.08,
        );
      }
      effect("rift", 220, 0.55);
      effect("nova", 130, 0.45);
    } else if (type === "tidal_jaws") {
      f.vx = f.facing * 660;
      f.vy = -80;
      area(210, 35);
      this.projectile(
        f,
        f.x + f.facing * 42,
        f.y - 32,
        f.facing * 760,
        0,
        24,
        true,
        "wave",
        30,
      );
      effect("whirl", 210, 0.65);
      this.shake = 13;
    } else if (type === "starfall") {
      f.vx = -f.facing * 90;
      effect("beam", 1020, 0.5);
      effect("nova", 160, 0.55);
      this.projectile(
        f,
        f.x + f.facing * 40,
        f.y - 48,
        f.facing * 1120,
        0,
        24,
        true,
        "arrow",
        13,
      );
      if ((other.x - f.x) * f.facing > -20 && Math.abs(other.y - f.y) < 85)
        this.hit(f, other, 36, true, true, null, signatureStun(type));
    } else if (type === "phoenix_arrow") {
      f.vx = -f.facing * 160;
      f.vy = -150;
      for (let i = 0; i < 3; i++) {
        this.projectile(
          f,
          f.x + f.facing * 38,
          f.y - 48,
          f.facing * 1080,
          (i - 1) * 36,
          13,
          true,
          "arrow",
          12,
          i * 0.055,
        );
      }
      effect("flame", 210, 0.55);
    } else if (type === "mjolnir") {
      f.vx = f.facing * 140;
      f.vy = -120;
      area(250, 37);
      this.projectile(
        f,
        f.x + f.facing * 44,
        f.y - 26,
        f.facing * 720,
        0,
        24,
        true,
        "wave",
        30,
      );
      effect("quake", 320, 0.8, f.x, f.y);
      effect("ice", 220, 0.7);
      this.shake = 15;
    } else if (type === "crimson_vortex") {
      f.vx = f.facing * 360;
      area(215, 35);
      effect("vortex", 220, 1.05, f.x + f.facing * 115, f.y - 45);
      effect("whirl", 185, 0.65);
    } else if (type === "kraken") {
      f.vx = -f.facing * 220;
      area(195, 30);
      this.projectile(
        f,
        f.x + f.facing * 46,
        f.y - 46,
        f.facing * 940,
        -30,
        24,
        true,
        "plasma",
        16,
      );
      this.projectile(
        f,
        f.x + f.facing * 42,
        f.y - 24,
        f.facing * 640,
        0,
        18,
        true,
        "wave",
        26,
        0.09,
      );
      effect("quake", 260, 0.65, f.x, f.y);
      this.shake = 16;
    } else if (type === "darkheart") {
      f.vx = f.facing * 190;
      effect("beam", 1080, 0.55);
      effect("flame", 180, 0.55);
      this.projectile(
        f,
        f.x + f.facing * 40,
        f.y - 48,
        f.facing * 1020,
        0,
        22,
        true,
        "plasma",
        14,
      );
      if ((other.x - f.x) * f.facing > -20 && Math.abs(other.y - f.y) < 85)
        this.hit(f, other, 38, true, true, null, signatureStun(type));
    } else if (type === "jade_cyclone") {
      f.vx = f.facing * 90;
      if (area(260, 34)) other.slow = 2.0;
      effect("whirl", 240, 0.75);
      effect("ice", 200, 0.65);
      this.shake = 12;
    } else if (type === "hellchain") {
      f.vx = -f.facing * 60;
      area(240, 36);
      for (const dir of [-1, 1]) {
        this.projectile(
          f,
          f.x + dir * 48,
          f.y - 34,
          dir * 740,
          0,
          20,
          true,
          "wave",
          26,
        );
      }
      effect("flame", 230, 0.65);
      effect("quake", 290, 0.7, f.x, f.y);
      this.shake = 15;
    }
  }

  private updateProjectiles(dt: number) {
    for (const p of this.projectiles) {
      if (p.delay > 0) {
        p.delay -= dt;
        continue;
      }
      p.life -= dt;
      const step = Math.hypot(p.vx, p.vy) * dt;
      if (p.traveled + step >= p.maxRange) {
        p.life = 0;
        continue;
      }
      p.traveled += step;
      p.trail.unshift({ x: p.x, y: p.y });
      if (p.trail.length > 7) p.trail.pop();
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const other = this.fighters[1 - p.owner];
      if (
        Math.abs(p.x - other.x) < 24 + p.radius &&
        Math.abs(p.y - (other.y - 46)) < 43 + p.radius
      ) {
        if (
          this.hit(
            this.fighters[p.owner],
            other,
            p.damage,
            p.special || p.radius >= 12,
            p.special,
            p.spike ? SPIKE_KNOCKBACK : null,
            p.special
              ? signatureStun(this.fighters[p.owner].def.special.type)
              : 0,
          )
        )
          p.life = 0;
      }
      if (p.x < -100 || p.x > WIDTH + 100 || p.y > HEIGHT + 100) p.life = 0;
      if (this.phase === "over") break;
    }
    this.projectiles = this.projectiles.filter((p) => p.life > 0);
  }

  private hit(
    attacker: Fighter,
    victim: Fighter,
    rawDamage: number,
    heavy: boolean,
    special: boolean,
    move: MoveDef | null = null,
    signatureStunSec = 0,
  ) {
    if (
      this.phase !== "running" ||
      victim.invulnerable > 0 ||
      victim.respawn > 0 ||
      victim.stocks <= 0
    )
      return false;
    // Strength scales what you deal; defense scales what you absorb.
    const wasChanneling = victim.channeling;
    victim.channeling = false;
    const scaled =
      rawDamage *
      attacker.derived.damageScale *
      victim.derived.damageTaken *
      (wasChanneling ? 1.35 : 1);
    const damage = Math.max(1, Math.round(scaled));
    const dealt = Math.min(victim.maxHealth - victim.damage, damage);
    victim.damage += damage;
    victim.flash = 0.12;
    victim.stun = Math.max(
      victim.stun,
      Math.max((heavy ? 0.26 : 0.14) * (move?.stun ?? 1), signatureStunSec),
    );
    victim.attack = null;
    victim.dodgeTime = 0; // a hit during vulnerable dodge recovery interrupts the roll
    victim.landingLag = 0;
    victim.cuttable = false;
    const direction = victim.x >= attacker.x ? 1 : -1;

    // 1. Weapon weight multiplier: Heavy (Cannon, Hammer, Axe) blasts rivals across the screen;
    //    Light (Orb, Gauntlets, Katars, Nunchaku) enables fast combo strings until high damage.
    const attackerWeapon = attacker.def.weapons[attacker.weapon];
    const weaponMult = WEAPON_KNOCKBACK_MULT[attackerWeapon] ?? 1.0;

    // 2. Missing-health scaling: high health keeps rivals in combo range, while
    //    low remaining health ramps launch distance sharply (Brawlhalla style).
    const damageRatio = Math.min(1.25, victim.damage / victim.maxHealth);
    const healthKnockbackFactor =
      0.82 + damageRatio * 0.55 + Math.pow(damageRatio, 2.4) * 1.15;

    // Bulk and the defense stat both soak up launch distance.
    const resist = victim.def.weight * (1 / victim.derived.knockbackTaken);
    const power = (0.86 + attacker.derived.damageScale * 0.14) * weaponMult;
    const baseHorizontal = heavy ? 360 : 155;
    const baseVertical = heavy ? 225 : 92;
    const force =
      ((baseHorizontal + victim.damage * (heavy ? 0.65 : 0.35)) *
        power *
        healthKnockbackFactor) /
      resist;
    const lift =
      (baseVertical + victim.damage * (heavy ? 0.35 : 0.16)) *
      power *
      healthKnockbackFactor;
    // Each directional move throws the opponent along its own angle.
    const kb = move?.kb ?? 1;
    if (move?.pull) {
      victim.vx = -direction * force * 0.55;
      victim.vy = -lift * 0.3;
    } else {
      victim.vx = direction * force * kb * (move?.kbx ?? 1);
      victim.vy = move ? lift * move.kby * kb * (move.spike ? 1 : 1) : -lift;
    }
    if (move?.spike) {
      victim.vy = Math.abs(lift) * 0.85 + 180;
      victim.vx *= 0.6;
    }
    if (move?.launch) victim.vy = -Math.abs(victim.vy) - 90;
    victim.grounded = false;
    attacker.combo++;
    attacker.comboTimer = 1.3;
    attacker.maxCombo = Math.max(attacker.maxCombo, attacker.combo);
    attacker.score += dealt * 10 + Math.max(0, attacker.combo - 1) * 25;
    if (!special) {
      const oldCharge = attacker.charge;
      attacker.charge = Math.min(75, attacker.charge + dealt);
      if (oldCharge < 75 && attacker.charge >= 75) {
        audio.charge();
        this.texts.push({
          x: attacker.x,
          y: attacker.y - 140,
          text: "SPECIAL READY",
          color: attacker.def.color,
          life: 1.2,
          size: 16,
        });
      }
    }
    // Impact weight scales with the move so a jab never feels like a hammer.
    const weight = move?.shake ?? 1;
    this.shake = Math.max(this.shake, (heavy ? 9 : 4) * weight);
    this.hitstop = (heavy ? 0.055 : 0.02) * (move?.hitstop ?? 1);
    this.burst(
      victim.x,
      victim.y - 45,
      attacker.def.color,
      Math.round((heavy ? 27 : 15) * weight),
      (heavy ? 380 : 250) * weight,
    );
    this.burst(victim.x, victim.y - 45, "#fff5df", 8, 240);
    this.effects.push({
      x: victim.x,
      y: victim.y - 45,
      radius: (heavy ? 60 : 38) * weight,
      time: 0,
      duration: 0.22,
      color: attacker.def.color,
      kind: "impact",
      dir: direction,
      owner: attacker.player,
      hit: true,
    });
    this.texts.push({
      x: victim.x + (Math.random() - 0.5) * 30,
      y: victim.y - 105,
      text: `${damage}`,
      color: heavy ? attacker.def.color : "#ffffff",
      life: 0.75,
      size: Math.round((heavy ? 32 : 25) * Math.min(1.25, weight)),
    });
    if (signatureStunSec > 0) {
      this.texts.push({
        x: victim.x,
        y: victim.y - 132,
        text: "STUNNED",
        color: "#bfe9ff",
        life: 0.65,
        size: 17,
      });
    }
    audio.hit(heavy, move?.sfx ?? "slash");
    // The health stat sets how much punishment a fighter can take.
    if (victim.damage >= victim.maxHealth) this.loseStock(victim);
    return true;
  }

  private loseStock(f: Fighter) {
    if (f.respawn > 0 || f.stocks <= 0 || this.phase !== "running") return;
    const other = this.fighters[1 - f.player];
    f.stocks--;
    other.score += 500;
    other.kos++;
    const x = clamp(f.x, 70, WIDTH - 70);
    const y = clamp(f.y - 40, 120, HEIGHT - 50);
    this.burst(x, y, f.def.color, 65, 550);
    this.effects.push({
      x,
      y,
      radius: 200,
      time: 0,
      duration: 0.8,
      color: f.def.color,
      kind: "ko",
      dir: 1,
      owner: f.player,
      hit: false,
    });
    this.shake = 18;
    this.flash = 0.22;
    audio.knockout();
    f.attack = null;
    f.vx = 0;
    f.vy = 0;
    f.respawn = 1.5;
    f.combo = 0;
    f.comboTimer = 0;
    this.announce(f.stocks === 1 ? "FINAL STOCK" : "KNOCKOUT", 1.25);
    if (f.stocks <= 0) this.finish(other.player);
  }

  private announce(text: string, duration: number) {
    this.announcement = text;
    this.announcementTime = duration;
  }

  /** At the bell: stocks, then remaining-health ratio, then match score. */
  private finishOnTime() {
    const [a, b] = this.fighters;
    let winner = 0;
    if (b.stocks > a.stocks) winner = 1;
    else if (b.stocks === a.stocks) {
      const aHealth = a.stocks <= 0 ? 0 : 1 - a.damage / a.maxHealth;
      const bHealth = b.stocks <= 0 ? 0 : 1 - b.damage / b.maxHealth;
      if (bHealth > aHealth) winner = 1;
      else if (bHealth === aHealth && b.score > a.score) winner = 1;
    }
    this.finish(winner, "timeout");
  }

  private finish(winner: number, reason: MatchResult["reason"] = "knockout") {
    if (this.phase === "over") return;
    this.phase = "over";
    this.fighters[winner].score += 1000;
    this.clearInput();
    audio.finish(winner === 0);
    this.emit();
    this.onFinish({
      winner,
      reason,
      scores: [this.fighters[0].score, this.fighters[1].score],
      combos: [this.fighters[0].maxCombo, this.fighters[1].maxCombo],
      kos: [this.fighters[0].kos, this.fighters[1].kos],
      duration: this.elapsed,
    });
  }

  private updateAI(dt: number) {
    const f = this.fighters[1];
    const target = this.fighters[0];
    if (f.respawn > 0) return;
    const ai = AI_PROFILES[this.settings.difficulty] ?? AI_PROFILES.rookie;
    f.aiClock -= dt;
    f.aiSwap -= dt;
    if (f.aiClock > 0) return;
    f.aiClock = ai.reaction + Math.random() * ai.reaction * 0.3;
    f.aiActions.clear();

    const dx = target.x - f.x;
    const dy = target.y - f.y;
    const adx = Math.abs(dx);
    const toTarget = dx > 0 ? "right" : "left";
    const awayTarget = dx > 0 ? "left" : "right";
    f.facing = dx > 0 ? 1 : -1;
    const weaponName = f.def.weapons[f.weapon];
    const weapon = WEAPONS[weaponName];
    const stageL = PLATFORMS[0].x;
    const stageR = PLATFORMS[0].x + PLATFORMS[0].w;

    // Recovering from a launch always takes priority over fighting.
    const offStage = f.x < stageL + 20 || f.x > stageR - 20 || f.y > 600;
    if (offStage) {
      f.aiActions.add(f.x < 640 ? "right" : "left");
      if (f.vy > -40 && f.jumps < MAX_JUMPS) this.taps[1].add("jump");
      else if (!f.grounded && !f.recoveryUsed && f.vy > -40)
        this.taps[1].add("recovery");
      return;
    }

    // Lower tiers pause now and then, which gives the player room to breathe.
    if (Math.random() < ai.idle) return;

    // Chase a launched rival past the ledge for the kill.
    const rivalOffStage =
      target.x < stageL + 30 || target.x > stageR - 30 || target.y < 330;
    if (rivalOffStage && Math.random() < ai.edgeGuard && target.respawn <= 0) {
      f.aiActions.add(toTarget);
      if (dy < -40 && f.jumps < MAX_JUMPS) this.taps[1].add("jump");
      if (adx < 190 && Math.abs(dy) < 150 && Math.random() < ai.aggression) {
        if (dy > 40) f.aiActions.add("down");
        else f.aiActions.add(toTarget);
        f.aiActions.add("light");
      }
      return;
    }

    // Spacing: ranged fighters hold a gap, melee fighters close it.
    const desired = weapon.ranged ? 250 : weapon.range * 0.62;
    if (adx > desired) f.aiActions.add(toTarget);
    else if (weapon.ranged && adx < 130 && Math.random() < ai.precision)
      f.aiActions.add(awayTarget);

    // Vertical positioning.
    if (dy < -80 && f.jumps < MAX_JUMPS && adx < 340) this.taps[1].add("jump");
    if (dy > 90 && f.grounded && f.y < 500) this.taps[1].add("down");

    const reach = weapon.ranged ? 430 : weapon.range + 55;
    const inRange = adx < reach && Math.abs(dy) < (f.grounded ? 95 : 165);
    const pressing = f.combo > 0 && f.comboTimer > 0;
    const wantsAttack =
      inRange &&
      target.respawn <= 0 &&
      Math.random() <
        (pressing ? Math.max(ai.aggression, ai.followUp) : ai.aggression);

    if (wantsAttack) {
      // Skilled tiers pick the stance that actually fits the situation.
      if (Math.random() < ai.precision) {
        if (!f.grounded && dy > 40) f.aiActions.add("down");
        else if (f.grounded && dy > 25 && adx < 90) f.aiActions.add("down");
        else if (adx > (weapon.ranged ? 170 : 72)) f.aiActions.add(toTarget);
      } else if (Math.random() < 0.3) {
        f.aiActions.add(toTarget);
      }
      // Heavies are saved for bigger openings at higher tiers.
      const heavyChance = target.stun > 0 ? 0.45 * ai.precision + 0.15 : 0.2;
      f.aiActions.add(Math.random() < heavyChance ? "heavy" : "light");
    }

    if (
      f.charge >= 75 &&
      adx < 340 &&
      Math.abs(dy) < 110 &&
      Math.random() < ai.special
    )
      this.taps[1].add("special");

    // Dodge reacts to a committed attack that is still in its startup.
    const incoming =
      target.attack &&
      target.attack.time < 0.16 &&
      adx < 175 &&
      f.dodgeCD === 0;
    if (incoming && Math.random() < ai.dodge) this.taps[1].add("dodge");

    if (f.aiSwap <= 0 && f.attackCD <= 0) {
      this.taps[1].add("swap");
      f.aiSwap = 5 + Math.random() * 5;
    }
  }
}

export const KEY_BINDINGS: Record<string, [number, Action]> = {
  KeyA: [0, "left"],
  KeyD: [0, "right"],
  KeyS: [0, "down"],
  KeyW: [0, "jump"],
  Space: [0, "jump"],
  KeyJ: [0, "light"],
  KeyK: [0, "heavy"],
  KeyL: [0, "special"],
  KeyU: [0, "charge"],
  KeyI: [0, "recovery"],
  ShiftLeft: [0, "dodge"],
  KeyQ: [0, "swap"],
  ArrowLeft: [1, "left"],
  ArrowRight: [1, "right"],
  ArrowDown: [1, "down"],
  ArrowUp: [1, "jump"],
  Digit1: [1, "light"],
  Digit2: [1, "heavy"],
  Digit3: [1, "special"],
  Digit5: [1, "charge"],
  Digit4: [1, "recovery"],
  Digit0: [1, "swap"],
  ShiftRight: [1, "dodge"],
  Numpad1: [1, "light"],
  Numpad2: [1, "heavy"],
  Numpad3: [1, "special"],
  Numpad5: [1, "charge"],
  Numpad4: [1, "recovery"],
  Numpad0: [1, "swap"],
};
