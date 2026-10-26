import { HEIGHT, PLATFORMS, WIDTH, type Effect, type Engine } from "./engine";
import {
  drawFighter,
  drawFighterOverlay,
  drawFighterUnderlay,
} from "./fighterArt";
import type { StageDefinition } from "./data";

const TAU = Math.PI * 2;

function polygon(
  ctx: CanvasRenderingContext2D,
  points: number[],
  fill: string,
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

function glow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  opacity = 0.2,
) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, "transparent");
  ctx.save();
  ctx.globalAlpha *= opacity;
  ctx.fillStyle = gradient;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  ctx.restore();
}

function drawPlatforms(
  ctx: CanvasRenderingContext2D,
  time: number,
  stage?: StageDefinition,
) {
  // Every arena lights its own decking with its accent colour.
  const accent = stage?.accent ?? "#f5824b";
  const icy = (stage?.friction ?? 1) < 1;
  const deckLight = icy ? "#6f7f92" : "#515865";
  const deckMid = icy ? "#5b6c80" : "#4b566b";
  const trim = icy ? "#9fc4d8" : "#b57650";
  const under = icy ? "#6d93ab" : "#e17844";
  const underSoft = icy ? "#5b7f96" : "#ad704e";
  for (const p of PLATFORMS) {
    if (p.main) {
      const rock = ctx.createLinearGradient(0, p.y, 0, p.y + 145);
      rock.addColorStop(0, "#26303c");
      rock.addColorStop(1, "#0a101b");
      ctx.fillStyle = rock;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y + 8);
      ctx.lineTo(p.x + p.w, p.y + 8);
      ctx.lineTo(p.x + p.w - 30, p.y + 50);
      ctx.lineTo(p.x + p.w - 120, p.y + 67);
      ctx.lineTo(p.x + p.w - 160, p.y + 110);
      ctx.lineTo(p.x + p.w - 240, p.y + 84);
      ctx.lineTo(p.x + p.w - 310, p.y + 141);
      ctx.lineTo(p.x + p.w - 440, p.y + 117);
      ctx.lineTo(p.x + 240, p.y + 135);
      ctx.lineTo(p.x + 150, p.y + 83);
      ctx.lineTo(p.x + 70, p.y + 76);
      ctx.closePath();
      ctx.fill();
      polygon(
        ctx,
        [
          p.x + 10,
          p.y + 23,
          p.x + 170,
          p.y + 26,
          p.x + 130,
          p.y + 68,
          p.x + 75,
          p.y + 55,
        ],
        "#303642",
      );
      polygon(
        ctx,
        [
          p.x + p.w - 12,
          p.y + 23,
          p.x + p.w - 190,
          p.y + 27,
          p.x + p.w - 140,
          p.y + 83,
          p.x + p.w - 74,
          p.y + 53,
        ],
        "#1a2332",
      );
      line(ctx, p.x + 170, p.y + 28, p.x + 210, p.y + 90, "#41424a", 2);
      line(ctx, p.x + 650, p.y + 28, p.x + 610, p.y + 110, "#3e3b40", 2);
      glow(ctx, 640, p.y + 21, 400, accent, 0.08);
    } else {
      polygon(
        ctx,
        [
          p.x,
          p.y + 5,
          p.x + p.w,
          p.y + 5,
          p.x + p.w - 16,
          p.y + 24,
          p.x + p.w / 2 + 20,
          p.y + 39,
          p.x + 28,
          p.y + 27,
        ],
        "#1b2738",
        "#39475c",
      );
      glow(ctx, p.x + p.w / 2, p.y + 20, 75, accent, 0.12);
    }
    const top = ctx.createLinearGradient(0, p.y - 6, 0, p.y + p.h);
    top.addColorStop(0, p.main ? deckLight : deckMid);
    top.addColorStop(0.3, "#283448");
    top.addColorStop(1, "#171e2c");
    ctx.fillStyle = top;
    ctx.fillRect(p.x, p.y - 4, p.w, p.h);
    line(ctx, p.x + 3, p.y - 4, p.x + p.w - 3, p.y - 4, "#8593a4", 2);
    line(ctx, p.x + 3, p.y + 2, p.x + p.w - 3, p.y + 2, trim, 1);
    ctx.save();
    ctx.shadowColor = accent;
    ctx.shadowBlur = 12;
    line(
      ctx,
      p.x + 4,
      p.y + p.h - 1,
      p.x + p.w - 4,
      p.y + p.h - 1,
      p.main ? under : underSoft,
      2,
    );
    ctx.restore();
    for (let i = 1; i < p.w / 68; i++) {
      line(
        ctx,
        p.x + i * 68,
        p.y + 4,
        p.x + i * 68 - 3,
        p.y + p.h - 3,
        "#121a26",
        2,
      );
      if (p.main && i % 2 === 0) {
        ctx.fillStyle = `rgba(255,145,76,${0.25 + Math.sin(time * 1.5 + i) * 0.12})`;
        ctx.fillRect(p.x + i * 68 + 22, p.y + 10, 16, 3);
      }
    }
  }
}

function drawEffect(ctx: CanvasRenderingContext2D, e: Effect) {
  const progress = e.time / e.duration;
  const alpha = Math.min(1, (1 - progress) * 2);
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = e.color;
  ctx.fillStyle = e.color;
  if (e.kind === "beam") {
    ctx.scale(e.dir, 1);
    glow(ctx, e.radius / 2, 0, e.radius / 2, e.color, 0.1);
    ctx.shadowColor = e.color;
    ctx.shadowBlur = 25;
    ctx.fillRect(0, -13 * (1 - progress), e.radius, 26 * (1 - progress));
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, -3, e.radius, 6 * (1 - progress));
  } else if (e.kind === "vortex") {
    ctx.rotate(e.time * 7);
    const r = e.radius * (0.35 + Math.sin(progress * Math.PI) * 0.5);
    glow(ctx, 0, 0, r + 30, e.color, 0.3);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.45, 0, TAU);
    ctx.fillStyle = "#0b0618";
    ctx.fill();
    for (let i = 0; i < 6; i++) {
      ctx.rotate(TAU / 6);
      ctx.beginPath();
      ctx.ellipse(r * 0.25, 0, r * 0.65, r * 0.2, 0.4, 0, Math.PI * 1.5);
      ctx.lineWidth = 2 + Math.sin(e.time * 10 + i) * 1.5;
      ctx.stroke();
    }
  } else if (e.kind === "rift" || e.kind === "flame") {
    ctx.scale(e.dir, 1);
    const width = e.radius * Math.sin(progress * Math.PI);
    ctx.shadowColor = e.color;
    ctx.shadowBlur = 20;
    polygon(
      ctx,
      [-35, -27, width, -8, width + 45, 0, width, 7, -35, 25, 8, 0],
      e.color,
    );
    line(ctx, 0, 0, width + 30, 0, "#fff5e7", 3);
  } else if (e.kind === "ice") {
    const radius = e.radius * Math.min(1, progress * 3);
    for (let i = 0; i < 12; i++) {
      ctx.save();
      ctx.rotate((i * TAU) / 12);
      ctx.translate(radius * 0.6, 0);
      polygon(
        ctx,
        [0, -8, 42 * Math.sin(progress * Math.PI), 0, 0, 8, -12, 0],
        "#b9eeff",
        "#ffffff",
      );
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, TAU);
    ctx.lineWidth = 2;
    ctx.stroke();
  } else if (e.kind === "impact") {
    // A brief directional flash at the point of contact.
    const pop = Math.pow(progress, 0.45);
    ctx.scale(e.dir, 1);
    ctx.rotate(-0.4);
    ctx.globalAlpha = (1 - progress) * 0.9;
    ctx.beginPath();
    ctx.ellipse(
      e.radius * pop * 0.3,
      0,
      e.radius * pop,
      e.radius * pop * 0.42,
      0,
      0,
      TAU,
    );
    ctx.fillStyle = e.color;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(
      e.radius * pop * 0.3,
      0,
      e.radius * pop * 0.5,
      e.radius * pop * 0.2,
      0,
      0,
      TAU,
    );
    ctx.fillStyle = "#fff6e6";
    ctx.fill();
  } else if (e.kind === "whirl") {
    ctx.rotate(progress * TAU * 2);
    for (let i = 0; i < 3; i++) {
      ctx.rotate(TAU / 3);
      ctx.beginPath();
      ctx.arc(0, 0, e.radius * 0.7, 0, 1.8);
      ctx.lineWidth = 9 * (1 - progress);
      ctx.stroke();
    }
  } else {
    const radius = e.radius * Math.pow(progress, 0.6);
    ctx.beginPath();
    if (e.kind === "jump" || e.kind === "quake")
      ctx.ellipse(0, 0, radius, radius * 0.23, 0, 0, TAU);
    else ctx.arc(0, 0, Math.max(1, radius), 0, TAU);
    ctx.lineWidth = (e.kind === "ko" ? 12 : 5) * (1 - progress) + 1;
    ctx.shadowColor = e.color;
    ctx.shadowBlur = 15;
    ctx.stroke();
    if (e.kind !== "jump")
      glow(ctx, 0, 0, Math.max(1, radius), e.color, (1 - progress) * 0.23);
  }
  ctx.restore();
}

/**
 * The arena background, vignette, and platforms never change during a match,
 * so they are painted once into an offscreen canvas and blitted each frame.
 * This removes three full-screen fills and ~60 path operations per frame.
 */
let stageCache: HTMLCanvasElement | null = null;
let stageKey = "";

function getStage(ctx: CanvasRenderingContext2D, game: Engine) {
  const ready = game.background.complete && game.background.naturalWidth > 0;
  const scale = Math.min(2, Math.max(1, ctx.getTransform().a));
  const stage = game.stage;
  // Stages with a sliding platform cannot be baked, so only the art is cached.
  const animates = stage.platforms.some((p) => p.move);
  const key = `${stage.id}|${ready}|${scale.toFixed(2)}|${animates}`;
  if (stageCache && stageKey === key) return stageCache;

  const canvas = stageCache ?? document.createElement("canvas");
  canvas.width = Math.round(WIDTH * scale);
  canvas.height = Math.round(HEIGHT * scale);
  const c = canvas.getContext("2d")!;
  c.setTransform(scale, 0, 0, scale, 0, 0);
  c.fillStyle = stage.sky[0];
  c.fillRect(0, 0, WIDTH, HEIGHT);
  if (ready) {
    const fit = Math.max(
      WIDTH / game.background.naturalWidth,
      HEIGHT / game.background.naturalHeight,
    );
    const w = game.background.naturalWidth * fit;
    const h = game.background.naturalHeight * fit;
    c.drawImage(game.background, (WIDTH - w) / 2, (HEIGHT - h) / 2, w, h);
  } else {
    // Placeholder wash so a stage still reads before its art has decoded.
    const wash = c.createLinearGradient(0, 0, 0, HEIGHT);
    wash.addColorStop(0, stage.sky[0]);
    wash.addColorStop(1, stage.sky[1]);
    c.fillStyle = wash;
    c.fillRect(0, 0, WIDTH, HEIGHT);
    glow(c, WIDTH * 0.5, HEIGHT * 0.62, 520, stage.accent, 0.18);
  }
  // Each stage tints the arena with its own accent so swaps feel distinct.
  c.globalAlpha = 0.16;
  c.fillStyle = stage.accent;
  c.fillRect(0, 0, WIDTH, HEIGHT);
  c.globalAlpha = 1;
  const shade = c.createLinearGradient(0, 0, 0, HEIGHT);
  shade.addColorStop(0, "#080e1bd9");
  shade.addColorStop(0.25, "#0b13251a");
  shade.addColorStop(0.7, "#080d1830");
  shade.addColorStop(1, "#070c1be6");
  c.fillStyle = shade;
  c.fillRect(0, 0, WIDTH, HEIGHT);
  if (!animates) drawPlatforms(c, 0, stage);

  stageCache = canvas;
  stageKey = key;
  return canvas;
}

/** Wind streaks and the molten floor are drawn live, on top of the cache. */
function drawHazards(ctx: CanvasRenderingContext2D, game: Engine) {
  const stage = game.stage;
  if (stage.hazard === "wind") {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const strength = Math.abs(game.gust) / 110;
    if (strength > 0.02) {
      for (let i = 0; i < 26; i++) {
        const speed = 1 + (i % 5) * 0.5;
        const x =
          ((((i * 211 + game.time * 420 * speed * Math.sign(game.gust || 1)) %
            (WIDTH + 400)) +
            WIDTH +
            400) %
            (WIDTH + 400)) -
          200;
        const y = 70 + ((i * 97) % 560);
        const len = 40 + (i % 7) * 26;
        ctx.globalAlpha = 0.05 + strength * 0.16 * ((i % 3) * 0.25 + 0.4);
        ctx.strokeStyle = "#dceeff";
        ctx.lineWidth = i % 4 === 0 ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + len * Math.sign(game.gust || 1), y + 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  } else if (stage.hazard === "lava") {
    const melt = HEIGHT - 96;
    const pulse = 0.55 + Math.sin(game.time * 1.7) * 0.12;
    const grad = ctx.createLinearGradient(0, melt - 40, 0, HEIGHT);
    grad.addColorStop(0, "rgba(255,120,40,0)");
    grad.addColorStop(0.45, `rgba(255,122,38,${0.3 * pulse})`);
    grad.addColorStop(1, `rgba(255,196,90,${0.62 * pulse})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, melt - 40, WIDTH, HEIGHT - melt + 40);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 16; i++) {
      const x =
        (((i * 173 + Math.sin(game.time * 0.6 + i) * 40) % WIDTH) + WIDTH) %
        WIDTH;
      const y = melt + 18 + ((i * 37) % 60);
      ctx.globalAlpha = 0.18 + Math.sin(game.time * 2 + i) * 0.1;
      ctx.fillStyle = "#ffd08a";
      ctx.beginPath();
      ctx.ellipse(x, y, 26 + (i % 4) * 9, 4, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
  if (stage.friction < 1) {
    // A cold sheen across the deck sells the low-traction ice.
    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.globalCompositeOperation = "lighter";
    for (const p of PLATFORMS) {
      const sheen = ctx.createLinearGradient(p.x, p.y, p.x + p.w, p.y);
      sheen.addColorStop(0, "rgba(180,235,255,0)");
      sheen.addColorStop(0.5, "#cdf2ff");
      sheen.addColorStop(1, "rgba(180,235,255,0)");
      ctx.fillStyle = sheen;
      ctx.fillRect(p.x, p.y - 3, p.w, 7);
    }
    ctx.restore();
  }
}

export function renderGame(ctx: CanvasRenderingContext2D, game: Engine) {
  ctx.save();
  ctx.fillStyle = "#0d1625";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const shakeX =
    game.settings.shake && game.shake > 0.1 && game.phase !== "paused"
      ? (Math.random() - 0.5) * game.shake
      : 0;
  const shakeY =
    game.settings.shake && game.shake > 0.1 && game.phase !== "paused"
      ? (Math.random() - 0.5) * game.shake
      : 0;
  // Whole-pixel offsets keep the stage blit a fast copy (no bilinear resample).
  const offX = Math.round(shakeX + game.camX);
  const offY = Math.round(shakeY + game.camY);
  if (offX !== 0 || offY !== 0) ctx.translate(offX, offY);
  ctx.drawImage(getStage(ctx, game), 0, 0, WIDTH, HEIGHT);
  // Sliding platforms cannot be baked into the cache, so they draw live.
  if (game.stage.platforms.some((p) => p.move))
    drawPlatforms(ctx, game.time, game.stage);

  // Ambient motes take the stage's accent so each arena feels inhabited.
  const moteA = game.stage.hazard === "lava" ? "#ffcf87" : "#d99563";
  const moteB = game.stage.friction < 1 ? "#e2f6ff" : "#b4c9ed";
  const fall = game.stage.hazard === "lava" ? -26 : 8;
  for (let i = 0; i < 32; i++) {
    const x =
      (((i * 179.7 + Math.sin(game.time * 0.3 + i) * 18) % WIDTH) + WIDTH) %
      WIDTH;
    const y =
      (((i * 83.3 - game.time * (fall + (i % 9))) % HEIGHT) + HEIGHT) % HEIGHT;
    ctx.globalAlpha = 0.2 + Math.sin(game.time + i) * 0.15;
    ctx.fillStyle = i % 3 ? moteA : moteB;
    ctx.fillRect(x, y, i % 3 ? 2 : 1, i % 3 ? 3 : 1);
  }
  ctx.globalAlpha = 1;
  drawHazards(ctx, game);
  for (const e of game.effects)
    if (e.kind === "vortex" || e.kind === "quake" || e.kind === "jump")
      drawEffect(ctx, e);
  // Blend between the last two physics states so movement is smooth at any
  // display refresh rate. Positions are restored straight afterwards, so the
  // simulation never sees the interpolated values.
  const alpha = game.renderAlpha;
  const blend = alpha > 0.001 && alpha < 0.999;
  const saved: [(typeof game.fighters)[number], number, number][] = [];
  if (blend) {
    for (const f of game.fighters) {
      saved.push([f, f.x, f.y]);
      f.x = f.px + (f.x - f.px) * alpha;
      f.y = f.py + (f.y - f.py) * alpha;
    }
  }
  const three = game.ensure3D();
  if (three) {
    three.attachToStage(game.canvas.parentElement);
    for (const f of game.fighters) drawFighterUnderlay(ctx, f, game.time);
    three.renderToCanvas(game, offX, offY);
    for (const f of game.fighters) drawFighterOverlay(ctx, f, game);
  } else {
    for (const f of game.fighters) drawFighter(ctx, f, game);
  }
  for (const [f, x, y] of saved) {
    f.x = x;
    f.y = y;
  }
  for (const e of game.effects)
    if (e.kind !== "vortex" && e.kind !== "quake" && e.kind !== "jump")
      drawEffect(ctx, e);

  for (const p of game.projectiles) {
    if (p.delay > 0) continue;
    ctx.save();
    ctx.strokeStyle = p.color;
    ctx.lineCap = "round";
    for (let i = p.trail.length - 1; i > 0; i--) {
      ctx.globalAlpha = (1 - i / p.trail.length) * 0.6;
      line(
        ctx,
        p.trail[i].x,
        p.trail[i].y,
        p.trail[i - 1].x,
        p.trail[i - 1].y,
        p.color,
        p.radius * (1 - i / p.trail.length),
      );
    }
    ctx.globalAlpha = 1;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 16;
    if (p.kind === "bow" || p.kind === "arrow") {
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.atan2(p.vy, p.vx));
      line(ctx, -22, 0, 12, 0, p.color, 3);
      polygon(ctx, [8, -5, 20, 0, 8, 5], "#dffaff");
    } else if (p.kind === "wave") {
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 13, p.radius, -0.2 * Math.sign(p.vx), 0, TAU);
      ctx.fillStyle = p.color;
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, TAU);
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(p.x - 1, p.y - 1, p.radius * 0.45, 0, TAU);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
    }
    ctx.restore();
  }

  for (const p of game.particles) {
    ctx.globalAlpha = Math.min(1, (p.life / p.maxLife) * 1.5);
    if (p.kind === "spark")
      line(
        ctx,
        p.x,
        p.y,
        p.x - p.vx * 0.025,
        p.y - p.vy * 0.025,
        p.color,
        p.size * 0.65,
      );
    else {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1.2 - (p.life / p.maxLife) * 0.2), 0, TAU);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  for (const t of game.texts) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, t.life * 3);
    ctx.textAlign = "center";
    ctx.font = `800 ${t.size}px "Barlow Condensed", sans-serif`;
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#0b111e";
    ctx.strokeText(t.text, t.x, t.y);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
    ctx.restore();
  }
  if (game.flash > 0) {
    ctx.fillStyle = `rgba(255,226,198,${game.flash * 0.7})`;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }
  ctx.restore();
}
