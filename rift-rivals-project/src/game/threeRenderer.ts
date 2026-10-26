import * as THREE from "three";
import type { Engine, Fighter } from "./engine";
import type { Weapon } from "./data";
import type { MoveDef } from "./moves";
import { attackPoseValue, sampleAttackMotion } from "./attackAnimation";
import { dodgeProgress, rollEase } from "./dodge";

const WIDTH = 1280;
const HEIGHT = 720;

let surfaceTexture: THREE.CanvasTexture | null = null;

function getSurfaceTexture() {
  if (surfaceTexture) return surfaceTexture;
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  const image = ctx.createImageData(64, 64);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const noise = ((x * 47 + y * 97 + x * y * 13) % 31) - 15;
      const grain = 150 + noise + (y % 4 === 0 ? 9 : 0);
      const pixel = (y * 64 + x) * 4;
      image.data[pixel] = grain;
      image.data[pixel + 1] = grain;
      image.data[pixel + 2] = grain;
      image.data[pixel + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  surfaceTexture = new THREE.CanvasTexture(canvas);
  surfaceTexture.wrapS = THREE.RepeatWrapping;
  surfaceTexture.wrapT = THREE.RepeatWrapping;
  surfaceTexture.repeat.set(2, 2);
  return surfaceTexture;
}

interface Palette3D {
  skin: number;
  suit: number;
  armor: number;
  trim: number;
  cloth: number;
  glow: number;
  metalness: number;
  roughness: number;
}

const PALETTES_3D: Record<string, Palette3D> = {
  ronin: {
    skin: 0x263242,
    suit: 0x1b2432,
    armor: 0xdadbd0,
    trim: 0xc8a46e,
    cloth: 0xff763e,
    glow: 0xff763e,
    metalness: 0.55,
    roughness: 0.36,
  },
  vex: {
    skin: 0xd4a68e,
    suit: 0x241d3a,
    armor: 0x7c5db8,
    trim: 0xd8b4fe,
    cloth: 0x581c87,
    glow: 0xb78aff,
    metalness: 0.65,
    roughness: 0.3,
  },
  brakk: {
    skin: 0xc27e5e,
    suit: 0x352623,
    armor: 0x8d95a2,
    trim: 0xd97745,
    cloth: 0x8c3b2b,
    glow: 0xf56c56,
    metalness: 0.78,
    roughness: 0.32,
  },
  lyra: {
    skin: 0xe6d0bc,
    suit: 0x183440,
    armor: 0x5293a0,
    trim: 0xbae6fd,
    cloth: 0x215763,
    glow: 0x75dce3,
    metalness: 0.5,
    roughness: 0.35,
  },
  azir: {
    skin: 0xbd8d63,
    suit: 0x362d1e,
    armor: 0xc9a86a,
    trim: 0xfef08a,
    cloth: 0x8f7338,
    glow: 0xe7c37b,
    metalness: 0.82,
    roughness: 0.25,
  },
  jax: {
    skin: 0x8a6250,
    suit: 0x262c3a,
    armor: 0x677385,
    trim: 0xe3e980,
    cloth: 0x4b5328,
    glow: 0xe3e980,
    metalness: 0.68,
    roughness: 0.32,
  },
  nyx: {
    skin: 0xa996c2,
    suit: 0x261f42,
    armor: 0x52407a,
    trim: 0xd8b4fe,
    cloth: 0x342459,
    glow: 0xb691e8,
    metalness: 0.58,
    roughness: 0.34,
  },
  fenrir: {
    skin: 0xdce6ec,
    suit: 0x2f3e4d,
    armor: 0x9ab0c2,
    trim: 0xe0f2fe,
    cloth: 0x365166,
    glow: 0xa1d7f2,
    metalness: 0.72,
    roughness: 0.28,
  },
  kai: {
    skin: 0xd0a488,
    suit: 0x331f1b,
    armor: 0xb33f28,
    trim: 0xfdba74,
    cloth: 0x992b18,
    glow: 0xff985a,
    metalness: 0.45,
    roughness: 0.4,
  },
  zero: {
    skin: 0x253636,
    suit: 0x1b2b2a,
    armor: 0x627d77,
    trim: 0xbbf7d0,
    cloth: 0x1f3d39,
    glow: 0xabe891,
    metalness: 0.85,
    roughness: 0.22,
  },
  ryuu: {
    skin: 0xd9b08c,
    suit: 0x152238,
    armor: 0x2b8cbe,
    trim: 0xbae6fd,
    cloth: 0x0284c7,
    glow: 0x38bdf8,
    metalness: 0.5,
    roughness: 0.36,
  },
  kage: {
    skin: 0x221d33,
    suit: 0x191528,
    armor: 0x6b21a8,
    trim: 0xe9d5ff,
    cloth: 0x7e22ce,
    glow: 0xc084fc,
    metalness: 0.6,
    roughness: 0.34,
  },
  baron: {
    skin: 0xab7e5e,
    suit: 0x2a231c,
    armor: 0x92600e,
    trim: 0xfde047,
    cloth: 0x713f12,
    glow: 0xeab308,
    metalness: 0.82,
    roughness: 0.28,
  },
  kira: {
    skin: 0xf0d5c2,
    suit: 0x331622,
    armor: 0xe2e8f0,
    trim: 0xfde047,
    cloth: 0xbe123c,
    glow: 0xf43f5e,
    metalness: 0.8,
    roughness: 0.24,
  },
  drakon: {
    skin: 0x2c130b,
    suit: 0x2e140c,
    armor: 0x572011,
    trim: 0xfb923c,
    cloth: 0x7c2d12,
    glow: 0xea580c,
    metalness: 0.72,
    roughness: 0.32,
  },
  volt: {
    skin: 0xd8af94,
    suit: 0x0f2233,
    armor: 0x0e7490,
    trim: 0xa5f3fc,
    cloth: 0x0284c7,
    glow: 0x22d3ee,
    metalness: 0.68,
    roughness: 0.28,
  },
  mako: {
    skin: 0x1f565e,
    suit: 0x0f2c33,
    armor: 0x0f766e,
    trim: 0x99f6e4,
    cloth: 0x0d9488,
    glow: 0x14b8a6,
    metalness: 0.62,
    roughness: 0.3,
  },
  orion: {
    skin: 0x1c2236,
    suit: 0x1b2038,
    armor: 0xd97706,
    trim: 0xfef3c7,
    cloth: 0x92400e,
    glow: 0xfbbf24,
    metalness: 0.9,
    roughness: 0.18,
  },
  ember: {
    skin: 0xe5cbb8,
    suit: 0x142b1d,
    armor: 0x15803d,
    trim: 0xbbf7d0,
    cloth: 0x166534,
    glow: 0x4ade80,
    metalness: 0.42,
    roughness: 0.42,
  },
  thor: {
    skin: 0xdaa98b,
    suit: 0x1b2040,
    armor: 0x64748b,
    trim: 0xc7d2fe,
    cloth: 0x4338ca,
    glow: 0x818cf8,
    metalness: 0.82,
    roughness: 0.26,
  },
  mirage: {
    skin: 0xba8564,
    suit: 0x331420,
    armor: 0xbe123c,
    trim: 0xfecdd3,
    cloth: 0x9f1239,
    glow: 0xfb7185,
    metalness: 0.55,
    roughness: 0.35,
  },
  sidra: {
    skin: 0x9e6c4e,
    suit: 0x2b1c17,
    armor: 0xc2410c,
    trim: 0xfde047,
    cloth: 0x9a3412,
    glow: 0xf97316,
    metalness: 0.65,
    roughness: 0.34,
  },
  petra: {
    skin: 0xd19c87,
    suit: 0x2f1126,
    armor: 0x9d174d,
    trim: 0xfbcfe8,
    cloth: 0x831843,
    glow: 0xec4899,
    metalness: 0.55,
    roughness: 0.34,
  },
  shin: {
    skin: 0xd7b18e,
    suit: 0x122923,
    armor: 0x059669,
    trim: 0xa7f3d0,
    cloth: 0x047857,
    glow: 0x10b981,
    metalness: 0.52,
    roughness: 0.36,
  },
  warden: {
    skin: 0x261c16,
    suit: 0x241a12,
    armor: 0x44403c,
    trim: 0xfbbf24,
    cloth: 0x92400e,
    glow: 0xf59e0b,
    metalness: 0.85,
    roughness: 0.28,
  },
};

interface Proportions3D {
  tall: number;
  wide: number;
  chest: number;
  head: number;
}

const PROPORTIONS_3D: Record<string, Proportions3D> = {
  ronin: { tall: 1.02, wide: 1.0, chest: 1.0, head: 1.0 },
  vex: { tall: 0.96, wide: 0.9, chest: 0.92, head: 1.04 },
  brakk: { tall: 1.08, wide: 1.24, chest: 1.26, head: 0.96 },
  lyra: { tall: 1.01, wide: 0.88, chest: 0.9, head: 1.0 },
  azir: { tall: 0.99, wide: 0.94, chest: 0.96, head: 1.0 },
  jax: { tall: 1.03, wide: 1.02, chest: 1.05, head: 0.98 },
  nyx: { tall: 1.0, wide: 0.9, chest: 0.93, head: 1.03 },
  fenrir: { tall: 1.08, wide: 1.18, chest: 1.22, head: 1.06 },
  kai: { tall: 0.98, wide: 0.98, chest: 1.02, head: 1.0 },
  zero: { tall: 1.04, wide: 1.06, chest: 1.1, head: 0.97 },
  ryuu: { tall: 0.98, wide: 0.94, chest: 0.96, head: 1.0 },
  kage: { tall: 1.01, wide: 0.92, chest: 0.94, head: 0.99 },
  baron: { tall: 1.08, wide: 1.26, chest: 1.28, head: 0.96 },
  kira: { tall: 1.02, wide: 0.95, chest: 0.97, head: 1.0 },
  drakon: { tall: 1.11, wide: 1.28, chest: 1.3, head: 1.03 },
  volt: { tall: 0.97, wide: 0.92, chest: 0.94, head: 1.02 },
  mako: { tall: 1.05, wide: 1.12, chest: 1.16, head: 1.03 },
  orion: { tall: 1.05, wide: 1.04, chest: 1.08, head: 0.99 },
  ember: { tall: 0.98, wide: 0.9, chest: 0.91, head: 1.02 },
  thor: { tall: 1.08, wide: 1.2, chest: 1.24, head: 0.98 },
  mirage: { tall: 1.01, wide: 0.92, chest: 0.94, head: 1.0 },
  sidra: { tall: 1.02, wide: 1.03, chest: 1.06, head: 1.0 },
  petra: { tall: 0.99, wide: 1.02, chest: 1.05, head: 1.0 },
  shin: { tall: 1.03, wide: 1.06, chest: 1.08, head: 0.99 },
  warden: { tall: 1.1, wide: 1.24, chest: 1.28, head: 0.97 },
};

const DUAL_WEAPONS = new Set<Weapon>([
  "Gauntlets",
  "Katars",
  "Blasters",
  "Nunchucks",
]);

function buildStudioEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(50, 16, 12),
    new THREE.MeshBasicMaterial({
      color: 0x1b2b48,
      side: THREE.BackSide,
    }),
  );
  envScene.add(dome);
  const skyPanel = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshBasicMaterial({ color: 0xfff0dd, side: THREE.DoubleSide }),
  );
  skyPanel.position.set(14, 34, 22);
  skyPanel.lookAt(0, 0, 0);
  envScene.add(skyPanel);

  const rimPanel = new THREE.Mesh(
    new THREE.PlaneGeometry(55, 40),
    new THREE.MeshBasicMaterial({ color: 0x67e8f9, side: THREE.DoubleSide }),
  );
  rimPanel.position.set(-22, 16, -28);
  rimPanel.lookAt(0, 0, 0);
  envScene.add(rimPanel);

  const warmPanel = new THREE.Mesh(
    new THREE.PlaneGeometry(45, 25),
    new THREE.MeshBasicMaterial({ color: 0xf97316, side: THREE.DoubleSide }),
  );
  warmPanel.position.set(18, -26, 12);
  warmPanel.lookAt(0, 0, 0);
  envScene.add(warmPanel);

  const rt = pmrem.fromScene(envScene, 0.04);
  pmrem.dispose();
  return rt.texture;
}

/**
 * Shared real-time WebGL 3D Character & Weapon Renderer.
 *
 * Uses a single offscreen WebGL context across matches so WebGL contexts
 * are never exhausted, with a narrow-FOV PerspectiveCamera locked 1:1 at z = 0
 * to the 1280x720 arena space for genuine 3D foreshortening and depth.
 */
export class ThreeFighterRenderer {
  readonly canvas: HTMLCanvasElement;
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly rigs: [FighterRig3D, FighterRig3D];
  private camDist: number;
  private prevScissor = { x: 0, y: 0, w: WIDTH, h: HEIGHT };
  private disposed = false;

  constructor(width = WIDTH, height = HEIGHT) {
    this.canvas = document.createElement("canvas");
    this.canvas.className = "game-canvas-3d";
    this.canvas.setAttribute("aria-hidden", "true");
    this.canvas.width = width;
    this.canvas.height = height;

    // Probe hardware vs software WebGL so real GPUs get crisp full-res MSAA
    // while software rasterizers stay locked at smooth 60fps.
    const probeGl = document.createElement("canvas").getContext("webgl");
    const dbg = probeGl?.getExtension("WEBGL_debug_renderer_info");
    const rendererInfo = dbg
      ? String(probeGl?.getParameter(dbg.UNMASKED_RENDERER_WEBGL) ?? "")
      : "";
    const softwareGL = /swiftshader|llvmpipe|software/i.test(rendererInfo);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: !softwareGL,
      powerPreference: "high-performance",
      premultipliedAlpha: true,
    });
    const initW = softwareGL ? 448 : width;
    const initH = softwareGL ? 252 : height;
    this.renderer.setSize(initW, initH, false);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.renderer.autoClear = false;
    (this as unknown as { softwareGL: boolean }).softwareGL = softwareGL;

    this.scene = new THREE.Scene();
    if (!softwareGL) {
      this.scene.environment = buildStudioEnvironment(this.renderer);
      this.scene.environmentIntensity = 0.7;
    }

    const fov = 22;
    this.camDist = HEIGHT / 2 / Math.tan(THREE.MathUtils.degToRad(fov / 2));
    this.camera = new THREE.PerspectiveCamera(
      fov,
      WIDTH / HEIGHT,
      100,
      this.camDist + 900,
    );
    this.camera.position.set(WIDTH / 2, -HEIGHT / 2, this.camDist);
    this.camera.lookAt(WIDTH / 2, -HEIGHT / 2, 0);

    // Studio key + back rim + sky/ground hemisphere rig
    const hemi = new THREE.HemisphereLight(0xbdd6ff, 0x3b2319, 1.85);
    this.scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfff4e4, 3.0);
    keyLight.position.set(WIDTH / 2 + 240, -HEIGHT / 2 + 380, 520);
    this.scene.add(keyLight);

    // The rim light is a per-fragment PBR cost; skip it on software rasterizers.
    if (!softwareGL) {
      const rimLight = new THREE.DirectionalLight(0x67e8f9, 2.7);
      rimLight.position.set(WIDTH / 2 - 260, -HEIGHT / 2 + 240, -380);
      this.scene.add(rimLight);
    }

    this.rigs = [new FighterRig3D(this.scene), new FighterRig3D(this.scene)];
  }

  attachToStage(container: HTMLElement | null) {
    if (!container) return;
    if (this.canvas.parentElement !== container) {
      const refNode =
        container.querySelector(".game-canvas")?.nextSibling ?? null;
      container.insertBefore(this.canvas, refNode);
    }
  }

  syncResolution(pixelWidth: number, pixelHeight: number) {
    if (this.disposed) return;
    const sw = (this as unknown as { softwareGL?: boolean }).softwareGL;
    const maxW = sw ? 448 : 1600;
    const maxH = sw ? 252 : 900;
    const w = Math.max(sw ? 320 : 512, Math.min(maxW, Math.round(pixelWidth)));
    const h = Math.max(sw ? 180 : 288, Math.min(maxH, Math.round(pixelHeight)));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.renderer.setSize(w, h, false);
      this.prevScissor = { x: 0, y: 0, w, h };
    }
  }

  renderToCanvas(game: Engine, shakeX = 0, shakeY = 0) {
    if (this.disposed) return;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const sx = cw / WIDTH;
    const sy = ch / HEIGHT;

    // Clear only last frame's dirty fighter bounding rectangle on GPU
    this.renderer.setViewport(0, 0, cw, ch);
    this.renderer.setScissorTest(true);
    this.renderer.setScissor(
      this.prevScissor.x,
      this.prevScissor.y,
      this.prevScissor.w,
      this.prevScissor.h,
    );
    this.renderer.clear(true, true, false);

    this.camera.position.set(
      WIDTH / 2 - shakeX,
      -HEIGHT / 2 + shakeY,
      this.camDist,
    );
    this.camera.updateMatrixWorld();

    let minX = WIDTH;
    let maxX = 0;
    let minY = HEIGHT;
    let maxY = 0;
    let anyVisible = false;
    const time = game.time;

    for (let i = 0; i < 2; i++) {
      const f = game.fighters[i];
      const rig = this.rigs[i];
      if (!f || f.respawn > 0 || f.stocks <= 0) {
        rig.group.visible = false;
        continue;
      }
      rig.update(f, f.x, f.y, time);
      if (!rig.group.visible) continue;
      anyVisible = true;
      minX = Math.min(minX, f.x - 140);
      maxX = Math.max(maxX, f.x + 140);
      minY = Math.min(minY, f.y - 205);
      maxY = Math.max(maxY, f.y + 65);
    }

    if (!anyVisible) {
      this.prevScissor = { x: 0, y: 0, w: 1, h: 1 };
      this.renderer.setScissorTest(false);
      return;
    }

    const pxLeft = Math.max(0, Math.floor((minX + shakeX) * sx));
    const pxRight = Math.min(cw, Math.ceil((maxX + shakeX) * sx));
    const pxTop = Math.max(0, Math.floor((minY + shakeY) * sy));
    const pxBottom = Math.min(ch, Math.ceil((maxY + shakeY) * sy));
    const boxW = Math.max(1, pxRight - pxLeft);
    const boxH = Math.max(1, pxBottom - pxTop);
    const glY = Math.max(0, ch - pxBottom);

    this.prevScissor = { x: pxLeft, y: glY, w: boxW, h: boxH };
    this.renderer.setScissor(pxLeft, glY, boxW, boxH);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setScissorTest(false);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const rig of this.rigs) rig.dispose();
    this.renderer.dispose();
  }
}

/**
 * Fully articulated 3D Fighter Rig with 2-bone arms, 2-bone legs,
 * sculpted torso armor, custom 25-character headgear & kits, dynamic 3D cloth,
 * sheathed secondary weapon on back, and multi-part 3D active weapon(s).
 */
export class FighterRig3D {
  readonly group = new THREE.Group();
  private scene: THREE.Scene;
  private builtFighterId = "";
  private builtWeapon: Weapon | "" = "";
  private builtSheathed: Weapon | "" = "";
  private lastTime = -1;
  private yawSmooth = 0;
  private gaitPhase = 0;
  private poseReady = false;
  private bones: THREE.Object3D[] = [];
  private prevRot = new Float32Array(30);
  private prevCore = new Float32Array(9);

  // Skeletal hierarchy (+Y is UP, +Z is character FRONT, -X is character RIGHT)
  private pelvis = new THREE.Group();
  private spine = new THREE.Group();
  private neck = new THREE.Group();
  private headGear = new THREE.Group();
  private bodyKit = new THREE.Group();

  private rightShoulder = new THREE.Group();
  private rightElbow = new THREE.Group();
  private rightWrist = new THREE.Group();

  private leftShoulder = new THREE.Group();
  private leftElbow = new THREE.Group();
  private leftWrist = new THREE.Group();

  private rightHip = new THREE.Group();
  private rightKnee = new THREE.Group();

  private leftHip = new THREE.Group();
  private leftKnee = new THREE.Group();

  private capeMesh!: THREE.Mesh;
  private capeBaseZ!: Float32Array;
  private backMount = new THREE.Group();
  private mainWeaponSlot = new THREE.Group();
  private offWeaponSlot = new THREE.Group();
  private auraLight!: THREE.PointLight;

  // Swappable material slots
  private skinMat!: THREE.MeshStandardMaterial;
  private suitMat!: THREE.MeshStandardMaterial;
  private armorMat!: THREE.MeshStandardMaterial;
  private trimMat!: THREE.MeshStandardMaterial;
  private clothMat!: THREE.MeshStandardMaterial;
  private glowMat!: THREE.MeshBasicMaterial;
  private eyeMat!: THREE.MeshStandardMaterial;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.scene.add(this.group);
    this.initMaterials();
    this.assembleBody();
    this.bones = [
      this.rightHip,
      this.leftHip,
      this.rightKnee,
      this.leftKnee,
      this.rightShoulder,
      this.leftShoulder,
      this.rightElbow,
      this.leftElbow,
      this.rightWrist,
      this.leftWrist,
    ];
  }

  private initMaterials() {
    const grain = getSurfaceTexture();
    this.skinMat = new THREE.MeshStandardMaterial({
      color: 0xd4a68e,
      roughness: 0.83,
      metalness: 0,
      bumpMap: grain,
      bumpScale: 0.11,
    });
    this.suitMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.79,
      metalness: 0.08,
      bumpMap: grain,
      bumpScale: 0.28,
    });
    this.armorMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.43,
      metalness: 0.62,
      bumpMap: grain,
      bumpScale: 0.09,
    });
    this.trimMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      roughness: 0.4,
      metalness: 0.72,
    });
    this.clothMat = new THREE.MeshStandardMaterial({
      color: 0xff763e,
      roughness: 0.9,
      metalness: 0,
      bumpMap: grain,
      bumpScale: 0.22,
      side: THREE.DoubleSide,
    });
    this.glowMat = new THREE.MeshBasicMaterial({ color: 0xff763e });
    this.eyeMat = new THREE.MeshStandardMaterial({
      color: 0xc7cfdb,
      roughness: 0.25,
      metalness: 0.04,
      emissive: 0xff763e,
      emissiveIntensity: 0.24,
    });
  }

  private assembleBody() {
    // Pelvis sits at y = 44 above boots at y = 0
    this.pelvis.position.set(0, 44, 0);
    this.group.add(this.pelvis);

    // Sculpted pelvis core + armored belt + buckle + side hip tassets
    const hips = new THREE.Mesh(
      new THREE.CylinderGeometry(9.5, 8.2, 11, 12),
      this.suitMat,
    );
    this.pelvis.add(hips);

    const belt = new THREE.Mesh(
      new THREE.CylinderGeometry(10.6, 10.2, 4.6, 14),
      this.trimMat,
    );
    belt.position.y = 3.2;
    this.pelvis.add(belt);

    const buckle = new THREE.Mesh(
      new THREE.OctahedronGeometry(3.2, 0),
      this.glowMat,
    );
    buckle.position.set(0, 3.2, 10.4);
    buckle.scale.set(1.2, 0.9, 0.5);
    this.pelvis.add(buckle);

    for (const side of [-1, 1]) {
      const tasset = new THREE.Mesh(
        new THREE.BoxGeometry(4.2, 12, 11),
        this.armorMat,
      );
      tasset.position.set(side * 10.2, -3.5, 0.5);
      tasset.rotation.z = side * -0.22;
      this.pelvis.add(tasset);
    }

    // Spine & Upper Torso
    this.spine.position.set(0, 6, 0);
    this.pelvis.add(this.spine);

    const torso = new THREE.Mesh(
      new THREE.CylinderGeometry(13.2, 9.6, 24, 14),
      this.suitMat,
    );
    torso.position.y = 12;
    torso.scale.set(1.08, 1, 0.78);
    this.spine.add(torso);

    // Sculpted beveled breastplate + dorsal plate + gorget collar + chest core
    const chestPlate = new THREE.Mesh(
      new THREE.DodecahedronGeometry(11.5, 1),
      this.armorMat,
    );
    chestPlate.position.set(0, 15.5, 3.2);
    chestPlate.scale.set(1.16, 0.86, 0.68);
    this.spine.add(chestPlate);

    const abPlate = new THREE.Mesh(
      new THREE.CylinderGeometry(9.8, 8.6, 9, 10),
      this.armorMat,
    );
    abPlate.position.set(0, 6.5, 1.4);
    abPlate.scale.set(1.02, 1, 0.72);
    this.spine.add(abPlate);

    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(8.2, 2.3, 8, 16),
      this.trimMat,
    );
    collar.position.set(0, 23.5, 0.5);
    collar.rotation.x = Math.PI / 2 + 0.15;
    this.spine.add(collar);

    const chestGem = new THREE.Mesh(
      new THREE.OctahedronGeometry(3.4, 0),
      this.glowMat,
    );
    chestGem.position.set(0, 16, 10.6);
    chestGem.scale.set(0.95, 1.25, 0.5);
    this.spine.add(chestGem);

    // Recessed seams and shoulder straps give the broad chest a layered finish.
    for (const side of [-1, 1]) {
      const strap = new THREE.Mesh(
        new THREE.BoxGeometry(2.3, 17, 2),
        this.suitMat,
      );
      strap.position.set(side * 7.4, 17, 10.6);
      strap.rotation.z = side * -0.24;
      this.spine.add(strap);
    }

    this.spine.add(this.bodyKit);

    // Dynamic 3D flowing cape / scarf
    const capeGeo = new THREE.PlaneGeometry(24, 50, 5, 8);
    capeGeo.translate(0, -25, 0);
    this.capeBaseZ = new Float32Array(capeGeo.attributes.position.count);
    for (let i = 0; i < this.capeBaseZ.length; i++) {
      const x = capeGeo.attributes.position.getX(i);
      this.capeBaseZ[i] = -Math.cos((x / 12) * 1.1) * 2.2;
    }
    this.capeMesh = new THREE.Mesh(capeGeo, this.clothMat);
    this.capeMesh.position.set(0, 23, -8.5);
    this.spine.add(this.capeMesh);

    // Back weapon mount (shows secondary weapon strapped diagonally across back!)
    this.backMount.position.set(2, 15, -11.5);
    this.backMount.rotation.set(0, Math.PI, 0.68);
    this.spine.add(this.backMount);

    // Neck & Sculpted 3D Head
    this.neck.position.set(0, 26, 0.5);
    this.spine.add(this.neck);

    const neckCyl = new THREE.Mesh(
      new THREE.CylinderGeometry(4.5, 5.2, 7, 10),
      this.skinMat,
    );
    neckCyl.position.y = 3;
    this.neck.add(neckCyl);

    const cranium = new THREE.Mesh(
      new THREE.SphereGeometry(11.4, 18, 16),
      this.skinMat,
    );
    cranium.position.set(0, 12.5, 0.4);
    cranium.scale.set(0.95, 1.06, 0.98);
    this.neck.add(cranium);

    const jaw = new THREE.Mesh(
      new THREE.SphereGeometry(7.9, 14, 10),
      this.skinMat,
    );
    jaw.position.set(0, 6.8, 2.0);
    jaw.scale.set(0.96, 0.68, 0.88);
    this.neck.add(jaw);

    // A softer eye and a modeled brow/nose give faces depth without losing readability.
    const bridge = new THREE.Mesh(
      new THREE.SphereGeometry(2.6, 8, 7),
      this.skinMat,
    );
    bridge.position.set(0, 8.8, 11.7);
    bridge.scale.set(0.72, 1.45, 0.72);
    this.neck.add(bridge);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(2.2, 9, 6),
        this.eyeMat,
      );
      eye.position.set(side * 4.1, 12.6, 10.3);
      eye.scale.set(1.05, 0.55, 0.45);
      this.neck.add(eye);

      const brow = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.9, 3.2, 3, 5),
        this.suitMat,
      );
      brow.position.set(side * 4.2, 14.8, 10.7);
      brow.rotation.z = side * 0.22 + Math.PI / 2;
      this.neck.add(brow);

      const ear = new THREE.Mesh(
        new THREE.SphereGeometry(2.6, 8, 6),
        this.skinMat,
      );
      ear.position.set(side * 10.8, 11, 0.4);
      ear.scale.set(0.6, 1.15, 0.68);
      this.neck.add(ear);
    }

    this.headGear.position.set(0, 12.5, 0.4);
    this.neck.add(this.headGear);

    // Right & Left 2-bone Arms (-X = character right / weapon hand, +X = character left / off hand)
    this.buildArm(this.rightShoulder, this.rightElbow, this.rightWrist, -1);
    this.buildArm(this.leftShoulder, this.leftElbow, this.leftWrist, 1);
    this.rightWrist.add(this.mainWeaponSlot);
    this.leftWrist.add(this.offWeaponSlot);

    // Right & Left 2-bone Legs (-X = right leg, +X = left leg)
    this.buildLeg(this.rightHip, this.rightKnee, -1);
    this.buildLeg(this.leftHip, this.leftKnee, 1);

    this.auraLight = new THREE.PointLight(0xff763e, 0, 1);
  }

  private buildArm(
    shoulder: THREE.Group,
    elbow: THREE.Group,
    wrist: THREE.Group,
    side: -1 | 1,
  ) {
    shoulder.position.set(side * 15.5, 21.5, 0);
    this.spine.add(shoulder);

    // Layered 3D Pauldron
    const pauldron = new THREE.Mesh(
      new THREE.SphereGeometry(7.6, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.62),
      this.armorMat,
    );
    pauldron.position.set(side * 1.6, 1.5, 0);
    pauldron.rotation.z = side * -0.42;
    pauldron.scale.set(1.15, 0.95, 1.08);
    shoulder.add(pauldron);

    const pauldronRim = new THREE.Mesh(
      new THREE.TorusGeometry(6.8, 1.15, 6, 14),
      this.trimMat,
    );
    pauldronRim.position.set(side * 1.4, -1.2, 0);
    pauldronRim.rotation.x = Math.PI / 2;
    pauldronRim.rotation.y = side * -0.35;
    shoulder.add(pauldronRim);

    const upperArm = new THREE.Mesh(
      new THREE.CapsuleGeometry(4.2, 10, 6, 10),
      this.suitMat,
    );
    upperArm.position.y = -8;
    shoulder.add(upperArm);

    elbow.position.set(0, -15.5, 0);
    shoulder.add(elbow);

    const elbowCop = new THREE.Mesh(
      new THREE.DodecahedronGeometry(4.3, 0),
      this.armorMat,
    );
    elbowCop.position.set(0, 0, -1.2);
    elbow.add(elbowCop);

    const forearm = new THREE.Mesh(
      new THREE.CapsuleGeometry(3.8, 9.5, 6, 10),
      this.skinMat,
    );
    forearm.position.y = -7.5;
    elbow.add(forearm);

    // Armored vambrace / bracer cuff
    const bracer = new THREE.Mesh(
      new THREE.CylinderGeometry(4.6, 4.1, 8.5, 10),
      this.armorMat,
    );
    bracer.position.y = -8.5;
    elbow.add(bracer);

    wrist.position.set(0, -15, 0);
    elbow.add(wrist);

    const fist = new THREE.Mesh(
      new THREE.DodecahedronGeometry(4.4, 1),
      this.skinMat,
    );
    fist.position.set(0, -2, 0.6);
    fist.scale.set(0.95, 1.05, 1.12);
    wrist.add(fist);
  }

  private buildLeg(hip: THREE.Group, knee: THREE.Group, side: -1 | 1) {
    hip.position.set(side * 6.8, -2, 0);
    this.pelvis.add(hip);

    const thigh = new THREE.Mesh(
      new THREE.CapsuleGeometry(5.5, 12, 6, 10),
      this.suitMat,
    );
    thigh.position.y = -9.5;
    hip.add(thigh);

    const thighPlate = new THREE.Mesh(
      new THREE.BoxGeometry(6.8, 12, 5.2),
      this.armorMat,
    );
    thighPlate.position.set(side * 1.4, -9, 3.2);
    thighPlate.rotation.y = side * 0.2;
    hip.add(thighPlate);

    knee.position.set(0, -19.5, 0);
    hip.add(knee);

    const kneePad = new THREE.Mesh(
      new THREE.OctahedronGeometry(5.0, 0),
      this.trimMat,
    );
    kneePad.position.set(0, 0.5, 3.8);
    kneePad.scale.set(1.0, 1.15, 0.7);
    knee.add(kneePad);

    const shin = new THREE.Mesh(
      new THREE.CapsuleGeometry(4.6, 12, 6, 10),
      this.armorMat,
    );
    shin.position.y = -10;
    knee.add(shin);

    // Sculpted 3D Armored Boot (sole at local y = -22.5 => world y = 0 when upright!)
    const bootAnkle = new THREE.Mesh(
      new THREE.CylinderGeometry(5.1, 5.6, 6, 10),
      this.suitMat,
    );
    bootAnkle.position.set(0, -17.5, 0.5);
    knee.add(bootAnkle);

    const bootVamp = new THREE.Mesh(
      new THREE.BoxGeometry(8.4, 5.5, 15.5),
      this.armorMat,
    );
    bootVamp.position.set(0, -19.8, 3.4);
    knee.add(bootVamp);

    const bootSole = new THREE.Mesh(
      new THREE.BoxGeometry(9.0, 2.2, 16.5),
      this.trimMat,
    );
    bootSole.position.set(0, -21.8, 3.5);
    knee.add(bootSole);
  }

  private applyIdentity(fighter: Fighter) {
    const id = fighter.def.id;
    const p = PALETTES_3D[id] ?? PALETTES_3D.ronin;
    this.skinMat.color.setHex(p.skin);
    this.suitMat.color.setHex(p.suit);
    this.armorMat.color.setHex(p.armor);
    this.armorMat.metalness = Math.min(0.74, p.metalness);
    this.armorMat.roughness = Math.max(0.37, p.roughness);
    this.trimMat.color.setHex(p.trim);
    this.clothMat.color.setHex(p.cloth);
    this.glowMat.color.setHex(p.glow);
    this.eyeMat.emissive.setHex(p.glow);
    this.eyeMat.emissiveIntensity = [
      "ronin",
      "nyx",
      "zero",
      "kage",
      "drakon",
      "orion",
      "warden",
    ].includes(id)
      ? 0.32
      : 0.08;
    this.eyeMat.color.setHex(
      ["zero", "drakon", "orion", "warden"].includes(id) ? p.glow : 0xcbd5e1,
    );
    this.auraLight.color.setHex(p.glow);

    this.headGear.clear();
    this.bodyKit.clear();

    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x181f2c,
      roughness: 0.72,
      metalness: 0.28,
      bumpMap: getSurfaceTexture(),
      bumpScale: 0.17,
    });
    const hairMat = new THREE.MeshStandardMaterial({
      color: p.cloth,
      roughness: 0.86,
      metalness: 0,
      bumpMap: getSurfaceTexture(),
      bumpScale: 0.12,
    });

    // Custom 3D Headgear & Torso Kits across ALL 25 Characters
    switch (id) {
      case "ronin": {
        const mask = new THREE.Mesh(
          new THREE.CylinderGeometry(9.5, 7.8, 9, 10),
          darkMat,
        );
        mask.position.set(0, -4, 1.5);
        const kasa = new THREE.Mesh(
          new THREE.ConeGeometry(25, 9.5, 20),
          darkMat,
        );
        kasa.position.set(0, 9.5, 0);
        const rim = new THREE.Mesh(
          new THREE.TorusGeometry(24.5, 0.9, 6, 24),
          this.trimMat,
        );
        rim.position.set(0, 5, 0);
        rim.rotation.x = Math.PI / 2;
        this.headGear.add(mask, kasa, rim);
        break;
      }
      case "vex": {
        const visor = new THREE.Mesh(
          new THREE.BoxGeometry(18, 4.2, 9),
          this.glowMat,
        );
        visor.position.set(0, 0.5, 7.5);
        const crest = new THREE.Mesh(new THREE.ConeGeometry(7, 17, 7), hairMat);
        crest.position.set(3, 11, -1);
        crest.rotation.z = -0.35;
        this.headGear.add(visor, crest);
        break;
      }
      case "brakk": {
        const helm = new THREE.Mesh(
          new THREE.SphereGeometry(
            12.2,
            14,
            10,
            0,
            Math.PI * 2,
            0,
            Math.PI * 0.55,
          ),
          this.armorMat,
        );
        const beard = new THREE.Mesh(
          new THREE.ConeGeometry(9.5, 18, 8),
          hairMat,
        );
        beard.position.set(0, -11, 5.5);
        beard.rotation.x = Math.PI;
        this.headGear.add(helm, beard);
        for (const s of [-1, 1]) {
          const horn = new THREE.Mesh(
            new THREE.ConeGeometry(3.2, 16, 8),
            this.trimMat,
          );
          horn.position.set(s * 12, 9, 1);
          horn.rotation.z = s * -0.55;
          this.headGear.add(horn);
        }
        break;
      }
      case "lyra":
      case "ember":
      case "mirage": {
        const hood = new THREE.Mesh(
          new THREE.ConeGeometry(15, 22, 12),
          this.clothMat,
        );
        hood.position.set(0, 5, -1.5);
        hood.rotation.x = -0.22;
        const diadem = new THREE.Mesh(
          new THREE.TorusGeometry(10.8, 1.2, 6, 16, Math.PI),
          this.trimMat,
        );
        diadem.position.set(0, 4, 2);
        this.headGear.add(hood, diadem);
        break;
      }
      case "azir": {
        const nemes = new THREE.Mesh(
          new THREE.BoxGeometry(26, 20, 18),
          this.armorMat,
        );
        nemes.position.set(0, 1, -2);
        const faceplate = new THREE.Mesh(
          new THREE.CylinderGeometry(8.5, 6.2, 10, 8),
          this.trimMat,
        );
        faceplate.position.set(0, -3.5, 2.5);
        this.headGear.add(nemes, faceplate);
        break;
      }
      case "jax": {
        const hair = new THREE.Mesh(
          new THREE.CylinderGeometry(11, 11.5, 9, 12),
          new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.5 }),
        );
        hair.position.set(0, 8, -0.5);
        const shades = new THREE.Mesh(
          new THREE.BoxGeometry(17, 3.6, 7),
          darkMat,
        );
        shades.position.set(0, 0.5, 8);
        this.headGear.add(hair, shades);
        break;
      }
      case "nyx":
      case "drakon": {
        for (const s of [-1, 1]) {
          const horn = new THREE.Mesh(
            new THREE.ConeGeometry(3.8, 22, 8),
            id === "drakon" ? this.glowMat : darkMat,
          );
          horn.position.set(s * 9.5, 14, -2);
          horn.rotation.set(-0.25, 0, s * -0.42);
          this.headGear.add(horn);
        }
        const crown = new THREE.Mesh(
          new THREE.OctahedronGeometry(4, 0),
          this.glowMat,
        );
        crown.position.set(0, 11, 9.5);
        this.headGear.add(crown);
        break;
      }
      case "fenrir": {
        const snout = new THREE.Mesh(
          new THREE.ConeGeometry(6.8, 13, 8),
          this.skinMat,
        );
        snout.position.set(0, -2, 12);
        snout.rotation.x = Math.PI / 2;
        this.headGear.add(snout);
        for (const s of [-1, 1]) {
          const ear = new THREE.Mesh(
            new THREE.ConeGeometry(4.4, 13, 5),
            this.skinMat,
          );
          ear.position.set(s * 8.5, 13, -1);
          this.headGear.add(ear);
        }
        const mane = new THREE.Mesh(
          new THREE.TorusGeometry(12, 4.5, 8, 14),
          this.skinMat,
        );
        mane.position.set(0, 22, 0);
        mane.rotation.x = Math.PI / 2;
        this.bodyKit.add(mane);
        break;
      }
      case "kai":
      case "ryuu":
      case "volt":
      case "petra": {
        for (let i = 0; i < 6; i++) {
          const spike = new THREE.Mesh(
            new THREE.ConeGeometry(4.2, 15, 6),
            hairMat,
          );
          const a = (i / 6) * Math.PI * 2;
          spike.position.set(Math.cos(a) * 6, 11, Math.sin(a) * 5 - 1);
          spike.rotation.set(Math.sin(a) * 0.5 - 0.15, 0, -Math.cos(a) * 0.5);
          this.headGear.add(spike);
        }
        const band = new THREE.Mesh(
          new THREE.CylinderGeometry(11.6, 11.6, 3.4, 16),
          this.trimMat,
        );
        band.position.y = 3.5;
        this.headGear.add(band);
        break;
      }
      case "zero":
      case "orion":
      case "warden": {
        const bucket = new THREE.Mesh(
          new THREE.CylinderGeometry(11.8, 12.4, 21, 12),
          this.armorMat,
        );
        bucket.position.y = 1;
        const visorBar = new THREE.Mesh(
          new THREE.BoxGeometry(17, 3.8, 6),
          this.glowMat,
        );
        visorBar.position.set(0, 1, 9.5);
        const crestFin = new THREE.Mesh(
          new THREE.ConeGeometry(4, 19, 6),
          this.trimMat,
        );
        crestFin.position.set(0, 15, 0);
        this.headGear.add(bucket, visorBar, crestFin);
        break;
      }
      case "kage": {
        const cowl = new THREE.Mesh(
          new THREE.SphereGeometry(12.2, 14, 12),
          darkMat,
        );
        const scarfRing = new THREE.Mesh(
          new THREE.TorusGeometry(9.5, 3.2, 8, 14),
          this.clothMat,
        );
        scarfRing.position.set(0, -6.5, 1);
        scarfRing.rotation.x = Math.PI / 2;
        this.headGear.add(cowl, scarfRing);
        break;
      }
      case "baron": {
        const dome = new THREE.Mesh(
          new THREE.SphereGeometry(
            12.4,
            14,
            10,
            0,
            Math.PI * 2,
            0,
            Math.PI * 0.6,
          ),
          darkMat,
        );
        dome.position.y = 1;
        this.headGear.add(dome);
        for (const s of [-1, 1]) {
          const lens = new THREE.Mesh(
            new THREE.CylinderGeometry(4.2, 4.2, 4, 12),
            this.trimMat,
          );
          lens.rotation.x = Math.PI / 2;
          lens.position.set(s * 4.6, 1.5, 10.5);
          this.headGear.add(lens);
        }
        break;
      }
      case "kira":
      case "thor": {
        const helmCap = new THREE.Mesh(
          new THREE.SphereGeometry(
            12,
            14,
            10,
            0,
            Math.PI * 2,
            0,
            Math.PI * 0.55,
          ),
          this.armorMat,
        );
        this.headGear.add(helmCap);
        for (const s of [-1, 1]) {
          const wing = new THREE.Mesh(
            new THREE.ConeGeometry(4.5, 19, 5),
            this.trimMat,
          );
          wing.position.set(s * 12.5, 9, -1);
          wing.rotation.set(-0.35, 0, s * -0.48);
          this.headGear.add(wing);
        }
        break;
      }
      case "mako": {
        const dorsalHead = new THREE.Mesh(
          new THREE.ConeGeometry(4.5, 22, 5),
          this.armorMat,
        );
        dorsalHead.position.set(0, 14, -3);
        dorsalHead.rotation.x = -0.45;
        const dorsalBack = new THREE.Mesh(
          new THREE.ConeGeometry(5, 20, 5),
          this.trimMat,
        );
        dorsalBack.position.set(0, 16, -12);
        dorsalBack.rotation.x = -1.1;
        this.headGear.add(dorsalHead);
        this.bodyKit.add(dorsalBack);
        break;
      }
      case "sidra": {
        const tricorn = new THREE.Mesh(
          new THREE.CylinderGeometry(21, 14, 7.5, 3),
          darkMat,
        );
        tricorn.position.set(0, 9, 0);
        const plume = new THREE.Mesh(
          new THREE.SphereGeometry(6, 8, 8),
          this.glowMat,
        );
        plume.position.set(-8, 14, -4);
        plume.scale.set(0.7, 1.6, 1.2);
        this.headGear.add(tricorn, plume);
        break;
      }
      case "shin": {
        const monkHat = new THREE.Mesh(
          new THREE.ConeGeometry(22, 8.5, 18),
          this.armorMat,
        );
        monkHat.position.set(0, 9.5, 0);
        const beads = new THREE.Mesh(
          new THREE.TorusGeometry(11.5, 2.2, 8, 12),
          this.glowMat,
        );
        beads.position.set(0, 21, 2);
        beads.rotation.x = 1.25;
        this.headGear.add(monkHat);
        this.bodyKit.add(beads);
        break;
      }
    }

    // Portrait-matching details layered over the base headgear: distinctive
    // hair, masks, crowns, beards, fins, veils, and chest emblems from the
    // character-select portraits.
    const std = (color: number, rough = 0.78, metal = 0.22) =>
      new THREE.MeshStandardMaterial({
        color,
        roughness: rough,
        metalness: metal,
        bumpMap: getSurfaceTexture(),
        bumpScale: 0.12,
      });
    const head = (
      mesh: THREE.Mesh,
      x = 0,
      y = 0,
      z = 0,
      rx = 0,
      ry = 0,
      rz = 0,
    ) => {
      mesh.position.set(x, y, z);
      mesh.rotation.set(rx, ry, rz);
      this.headGear.add(mesh);
      return mesh;
    };
    const body = (
      mesh: THREE.Mesh,
      x = 0,
      y = 0,
      z = 0,
      rx = 0,
      ry = 0,
      rz = 0,
    ) => {
      mesh.position.set(x, y, z);
      mesh.rotation.set(rx, ry, rz);
      this.bodyKit.add(mesh);
      return mesh;
    };
    const box = (w: number, h: number, d: number, mat: THREE.Material) =>
      new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    const cone = (r: number, h: number, mat: THREE.Material, seg = 7) =>
      new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat);
    const ball = (r: number, mat: THREE.Material) =>
      new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat);

    switch (id) {
      case "ronin": {
        head(
          new THREE.Mesh(
            new THREE.TorusGeometry(9.2, 2.4, 7, 14),
            this.clothMat,
          ),
          0,
          -7,
          3,
          Math.PI / 2,
        );
        body(box(4.5, 18, 1.6, this.clothMat), -8, 12, -8, 0.25, 0, 0.35);
        body(box(4, 14, 1.5, this.clothMat), -13, 9, -8, -0.15, 0, 0.55);
        break;
      }
      case "vex": {
        const cap = ball(11.8, std(0x6d28d9, 0.85, 0));
        cap.scale.set(0.98, 0.72, 0.98);
        head(cap, 0, 7.5, -1.2);
        head(box(15, 7, 3, std(0x4c1d95, 0.85, 0)), -6, 1, -6, 0, 0.25, 0.2);
        break;
      }
      case "brakk": {
        for (let i = 0; i < 3; i++)
          head(
            cone(4.5 - i, 13 - i * 2, std(0x991b1b, 0.9, 0)),
            (i - 1) * 4.5,
            -13,
            7 - i,
            Math.PI,
          );
        const crack = box(1.4, 13, 0.8, this.glowMat);
        body(crack, -3, 13, 11.2, 0, 0, 0.35);
        body(box(8, 1.3, 0.8, this.glowMat), 2, 9, 11.2, 0, 0, -0.5);
        break;
      }
      case "lyra": {
        const hair = ball(11.6, std(0xe0f2fe, 0.82, 0));
        hair.scale.set(0.94, 1.05, 0.88);
        head(hair, 0, 3, -5.5);
        body(box(7, 20, 2, std(0xe0f2fe, 0.82, 0)), 0, 8, -10);
        break;
      }
      case "azir": {
        body(
          box(5, 17, 1.6, std(0xd6c08a, 0.9, 0)),
          -12,
          10,
          -4,
          0.15,
          0,
          0.18,
        );
        body(
          box(5, 17, 1.6, std(0xd6c08a, 0.9, 0)),
          12,
          10,
          -4,
          -0.12,
          0,
          -0.18,
        );
        head(
          new THREE.Mesh(new THREE.OctahedronGeometry(3.2, 0), this.glowMat),
          0,
          -2,
          11.2,
        );
        break;
      }
      case "jax": {
        head(
          new THREE.Mesh(
            new THREE.TorusGeometry(8.8, 1.8, 7, 14),
            this.glowMat,
          ),
          0,
          -7.5,
          2,
          Math.PI / 2,
        );
        head(cone(6.5, 10, std(0x3f2d24, 0.9, 0)), 0, -10, 6.5, Math.PI);
        break;
      }
      case "nyx": {
        body(box(7, 22, 1.8, std(0x2e1065, 0.9, 0)), 0, 7, -10.5, 0.12);
        head(
          new THREE.Mesh(new THREE.OctahedronGeometry(3.4, 0), this.glowMat),
          0,
          5,
          10.8,
        );
        break;
      }
      case "fenrir": {
        for (let i = 0; i < 5; i++)
          head(
            cone(1.5, 4.5, std(0xffffff, 0.65, 0.1), 5),
            -4 + i * 2,
            -5.5,
            12.2,
            Math.PI,
          );
        body(cone(5, 18, this.skinMat, 7), -3, 9, -13, -0.75, 0, 0.45);
        break;
      }
      case "kai": {
        for (let i = 0; i < 5; i++)
          head(
            cone(3.8, 16 - Math.abs(i - 2) * 2, std(0xdc2626, 0.85, 0), 6),
            (i - 2) * 4.2,
            13,
            -2,
            -0.2,
            0,
            (2 - i) * 0.16,
          );
        break;
      }
      case "zero": {
        head(cone(2.2, 10, this.trimMat, 6), 0, 16, -3, -0.25);
        body(
          new THREE.Mesh(new THREE.OctahedronGeometry(3.6, 0), this.glowMat),
          0,
          13,
          11.4,
        );
        break;
      }
      case "ryuu": {
        body(
          box(3.6, 15, 1.4, std(0x0284c7, 0.85, 0)),
          -8,
          13,
          -8,
          0.3,
          0,
          0.42,
        );
        body(
          box(3.2, 12, 1.3, std(0x0284c7, 0.85, 0)),
          -12,
          11,
          -8,
          -0.2,
          0,
          0.6,
        );
        head(
          new THREE.Mesh(new THREE.OctahedronGeometry(2.8, 0), this.trimMat),
          0,
          4.5,
          11,
        );
        break;
      }
      case "kage": {
        head(
          new THREE.Mesh(new THREE.CylinderGeometry(8.8, 7.2, 7, 10), darkMat),
          0,
          -5,
          4.5,
        );
        body(
          box(4.2, 16, 1.5, std(0x7e22ce, 0.88, 0)),
          -9,
          11,
          -8,
          0.25,
          0,
          0.4,
        );
        break;
      }
      case "baron": {
        head(cone(8, 13, std(0x6b4423, 0.92, 0)), 0, -11, 5.5, Math.PI);
        body(ball(5.2, this.armorMat), -15.5, 20, 2);
        body(ball(5.2, this.armorMat), 15.5, 20, 2);
        break;
      }
      case "kira": {
        for (const s of [-1, 1]) {
          const lock = box(4.2, 17, 2, std(0xfde68a, 0.82, 0));
          head(lock, s * 11.5, -2, -2, 0.12, 0, s * 0.08);
          const wing = cone(3.8, 15, this.trimMat, 5);
          body(wing, s * 10, 15, -10, -0.5, 0, s * -0.5);
        }
        break;
      }
      case "drakon": {
        for (let i = 0; i < 3; i++)
          body(
            cone(3.2, 11 - i * 2, this.glowMat, 6),
            0,
            18 - i * 7,
            -11,
            -0.55,
          );
        body(cone(4.5, 20, this.armorMat, 7), -4, 2, -13, -1.05, 0, 0.35);
        break;
      }
      case "volt": {
        for (let i = 0; i < 4; i++) {
          const bolt = box(
            3.2,
            15 - Math.abs(i - 1.5) * 2,
            1.7,
            std(0x22d3ee, 0.55, 0.15),
          );
          head(bolt, (i - 1.5) * 5, 12, -1, -0.18, 0, (1.5 - i) * 0.2);
        }
        head(box(16, 3.2, 3, this.glowMat), 0, 0.5, 10.6);
        break;
      }
      case "mako": {
        for (let i = 0; i < 5; i++)
          head(
            cone(1.25, 3.6, std(0xffffff, 0.55, 0.05), 5),
            -4 + i * 2,
            -6.5,
            12.4,
            Math.PI,
          );
        head(cone(5, 10, this.trimMat, 6), 0, 8, -10, -0.65);
        break;
      }
      case "orion": {
        head(
          new THREE.Mesh(
            new THREE.TorusGeometry(10.6, 1.5, 7, 16),
            this.trimMat,
          ),
          0,
          5,
          1,
          Math.PI / 2.25,
        );
        head(
          new THREE.Mesh(new THREE.OctahedronGeometry(3.4, 0), this.glowMat),
          0,
          6,
          11,
        );
        body(
          box(5, 18, 1.6, std(0xfef3c7, 0.82, 0)),
          11,
          10,
          -8,
          0.15,
          0,
          -0.3,
        );
        break;
      }
      case "ember": {
        for (const s of [-1, 1]) {
          const ear = cone(3.2, 11, this.skinMat, 6);
          head(ear, s * 12, 4, 0, 0, 0, s * -1.15);
        }
        head(
          new THREE.Mesh(new THREE.OctahedronGeometry(2.8, 0), this.glowMat),
          0,
          3,
          10.8,
        );
        break;
      }
      case "thor": {
        head(cone(7.5, 12, std(0xfacc15, 0.9, 0)), 0, -10.5, 5.5, Math.PI);
        body(box(17, 20, 1.5, std(0x991b1b, 0.9, 0)), 0, 8, -10.5, 0.12);
        break;
      }
      case "mirage": {
        const veil = box(14, 10, 0.9, std(0xe11d48, 0.65, 0));
        veil.material.transparent = true;
        veil.material.opacity = 0.62;
        head(veil, 0, -5.5, 10.2);
        head(
          new THREE.Mesh(new THREE.OctahedronGeometry(2.7, 0), this.glowMat),
          0,
          4,
          11,
        );
        break;
      }
      case "sidra": {
        body(ball(5, this.trimMat), -15.5, 20, 2);
        body(ball(5, this.trimMat), 15.5, 20, 2);
        body(box(5, 17, 1.5, std(0xf97316, 0.88, 0)), -9, 8, -9, 0.18, 0, 0.25);
        body(
          box(5, 17, 1.5, std(0xf97316, 0.88, 0)),
          9,
          8,
          -9,
          -0.15,
          0,
          -0.25,
        );
        break;
      }
      case "petra": {
        for (let i = 0; i < 5; i++)
          head(
            cone(3.6, 14 - Math.abs(i - 2) * 1.8, std(0xec4899, 0.86, 0), 6),
            (i - 2) * 4.4,
            12.5,
            -1.5,
            -0.16,
            0,
            (2 - i) * 0.17,
          );
        body(
          new THREE.Mesh(new THREE.OctahedronGeometry(3.5, 0), this.glowMat),
          0,
          13,
          11.3,
        );
        break;
      }
      case "shin": {
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          body(
            ball(2.1, this.glowMat),
            Math.cos(a) * 8.5,
            21 + Math.sin(a) * 2.4,
            5 + Math.cos(a) * 2,
          );
        }
        break;
      }
      case "warden": {
        for (const s of [-1, 1])
          head(cone(3.2, 13, darkMat, 6), s * 10.5, 12, -1, -0.25, 0, s * -0.4);
        const chain = new THREE.Mesh(
          new THREE.TorusGeometry(10.5, 1.5, 6, 14),
          this.trimMat,
        );
        body(chain, 0, 15, 10.6, 0.35);
        break;
      }
    }
  }

  private buildWeapon3D(weapon: Weapon, glowHex: number): THREE.Group {
    const g = new THREE.Group();
    const steel = new THREE.MeshStandardMaterial({
      color: 0xdbeafe,
      metalness: 0.9,
      roughness: 0.16,
    });
    const darkSteel = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.72,
      roughness: 0.34,
    });
    const brass = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.88,
      roughness: 0.22,
    });
    const wood = new THREE.MeshStandardMaterial({
      color: 0x5c3d28,
      roughness: 0.68,
      metalness: 0.1,
    });
    const glow = new THREE.MeshBasicMaterial({ color: glowHex });

    // Every weapon extends along -Y from grip at (0, 0, 0) so arm pitch maps cleanly to world direction!
    switch (weapon) {
      case "Sword": {
        const grip = new THREE.Mesh(
          new THREE.CylinderGeometry(1.9, 1.9, 14, 8),
          wood,
        );
        grip.position.y = 4;
        const pommel = new THREE.Mesh(
          new THREE.OctahedronGeometry(3.2, 0),
          brass,
        );
        pommel.position.y = 12;
        const guard = new THREE.Mesh(
          new THREE.BoxGeometry(16, 3.2, 4.5),
          brass,
        );
        guard.position.y = -3;
        const blade = new THREE.Mesh(
          new THREE.BoxGeometry(5.6, 50, 1.8),
          steel,
        );
        blade.position.y = -29;
        const tip = new THREE.Mesh(new THREE.ConeGeometry(3.4, 12, 4), steel);
        tip.position.y = -60;
        tip.rotation.x = Math.PI;
        tip.rotation.y = Math.PI / 4;
        const fuller = new THREE.Mesh(
          new THREE.BoxGeometry(1.6, 44, 2.2),
          glow,
        );
        fuller.position.y = -28;
        g.add(grip, pommel, guard, blade, tip, fuller);
        break;
      }
      case "Scythe": {
        const shaft = new THREE.Mesh(
          new THREE.CylinderGeometry(2.2, 2.0, 68, 8),
          darkSteel,
        );
        shaft.position.y = -22;
        const collar = new THREE.Mesh(
          new THREE.CylinderGeometry(4, 3.2, 8, 8),
          brass,
        );
        collar.position.y = -55;
        const crescent = new THREE.Mesh(
          new THREE.TorusGeometry(23, 2.8, 6, 16, Math.PI * 0.72),
          steel,
        );
        crescent.position.set(0, -40, 18);
        crescent.rotation.y = Math.PI / 2;
        crescent.rotation.z = 0.55;
        const edge = new THREE.Mesh(
          new THREE.TorusGeometry(24.6, 1.0, 4, 16, Math.PI * 0.7),
          glow,
        );
        edge.position.copy(crescent.position);
        edge.rotation.copy(crescent.rotation);
        g.add(shaft, collar, crescent, edge);
        break;
      }
      case "Blasters": {
        const grip = new THREE.Mesh(
          new THREE.BoxGeometry(4.2, 13, 6.5),
          darkSteel,
        );
        grip.position.set(0, 1, -2);
        const body = new THREE.Mesh(new THREE.BoxGeometry(5.8, 30, 8.5), steel);
        body.position.set(0, -14, 2);
        const barrel = new THREE.Mesh(
          new THREE.CylinderGeometry(2.6, 2.8, 32, 10),
          darkSteel,
        );
        barrel.position.set(0, -16, 4.5);
        const rail = new THREE.Mesh(new THREE.BoxGeometry(2.2, 22, 2.5), glow);
        rail.position.set(0, -14, 6.8);
        const muzzle = new THREE.Mesh(
          new THREE.SphereGeometry(3.2, 8, 8),
          glow,
        );
        muzzle.position.set(0, -32, 4.5);
        g.add(grip, body, barrel, rail, muzzle);
        break;
      }
      case "Gauntlets": {
        const cuff = new THREE.Mesh(
          new THREE.CylinderGeometry(6.8, 6.0, 14, 10),
          darkSteel,
        );
        cuff.position.y = 2;
        const fist = new THREE.Mesh(
          new THREE.DodecahedronGeometry(9.2, 1),
          steel,
        );
        fist.position.set(0, -7, 1.5);
        fist.scale.set(0.95, 1.15, 1.1);
        const core = new THREE.Mesh(new THREE.OctahedronGeometry(4.2, 0), glow);
        core.position.set(0, -6, 9.2);
        g.add(cuff, fist, core);
        break;
      }
      case "Axe": {
        const haft = new THREE.Mesh(
          new THREE.CylinderGeometry(2.4, 2.2, 58, 8),
          wood,
        );
        haft.position.y = -18;
        const socket = new THREE.Mesh(
          new THREE.BoxGeometry(7, 14, 8),
          darkSteel,
        );
        socket.position.y = -40;
        const cheek = new THREE.Mesh(
          new THREE.CylinderGeometry(16, 16, 3.2, 12, 1, false, -0.7, 1.4),
          steel,
        );
        cheek.position.set(0, -40, 4);
        cheek.rotation.z = Math.PI / 2;
        const edgeGlow = new THREE.Mesh(
          new THREE.TorusGeometry(16, 1.1, 4, 12, 1.3),
          glow,
        );
        edgeGlow.position.set(0, -40, 4);
        edgeGlow.rotation.y = Math.PI / 2;
        edgeGlow.rotation.x = -0.65;
        const spike = new THREE.Mesh(new THREE.ConeGeometry(3.5, 11, 6), brass);
        spike.position.set(0, -40, -9);
        spike.rotation.x = -Math.PI / 2;
        g.add(haft, socket, cheek, edgeGlow, spike);
        break;
      }
      case "Hammer": {
        const haft = new THREE.Mesh(
          new THREE.CylinderGeometry(2.6, 2.4, 56, 8),
          wood,
        );
        haft.position.y = -16;
        const block = new THREE.Mesh(
          new THREE.BoxGeometry(16, 17, 28),
          darkSteel,
        );
        block.position.y = -42;
        for (const z of [-14.2, 14.2]) {
          const face = new THREE.Mesh(
            new THREE.CylinderGeometry(9.5, 9.5, 3, 8),
            steel,
          );
          face.position.set(0, -42, z);
          face.rotation.x = Math.PI / 2;
          g.add(face);
        }
        const furnace = new THREE.Mesh(new THREE.BoxGeometry(17, 6, 8), glow);
        furnace.position.y = -42;
        g.add(haft, block, furnace);
        break;
      }
      case "Bow": {
        const arc = new THREE.Mesh(
          new THREE.TorusGeometry(26, 2.2, 6, 18, Math.PI * 0.86),
          wood,
        );
        arc.position.set(0, -12, -4);
        arc.rotation.y = Math.PI / 2;
        arc.rotation.z = 0.22;
        const string = new THREE.Mesh(
          new THREE.CylinderGeometry(0.55, 0.55, 50, 4),
          glow,
        );
        string.position.set(0, -12, -4);
        string.rotation.x = Math.PI / 2;
        const arrow = new THREE.Mesh(
          new THREE.CylinderGeometry(0.9, 0.9, 44, 6),
          glow,
        );
        arrow.position.y = -20;
        const head = new THREE.Mesh(new THREE.ConeGeometry(3.4, 9, 5), steel);
        head.position.y = -44;
        head.rotation.x = Math.PI;
        g.add(arc, string, arrow, head);
        break;
      }
      case "Spear": {
        const shaft = new THREE.Mesh(
          new THREE.CylinderGeometry(2.1, 2.0, 74, 8),
          wood,
        );
        shaft.position.y = -24;
        const collar = new THREE.Mesh(
          new THREE.TorusGeometry(3.8, 1.4, 6, 12),
          brass,
        );
        collar.position.y = -60;
        collar.rotation.x = Math.PI / 2;
        const tip = new THREE.Mesh(new THREE.ConeGeometry(5.2, 22, 4), steel);
        tip.position.y = -72;
        tip.rotation.x = Math.PI;
        tip.scale.set(0.5, 1, 1.15);
        const core = new THREE.Mesh(new THREE.ConeGeometry(2.4, 16, 4), glow);
        core.position.y = -70;
        core.rotation.x = Math.PI;
        g.add(shaft, collar, tip, core);
        break;
      }
      case "Katars": {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(9, 4, 8), darkSteel);
        bar.position.y = -2;
        for (const z of [-3.2, 3.2]) {
          const prong = new THREE.Mesh(
            new THREE.ConeGeometry(2.6, 30, 4),
            steel,
          );
          prong.position.set(0, -19, z);
          prong.rotation.x = Math.PI;
          g.add(prong);
        }
        const gem = new THREE.Mesh(new THREE.OctahedronGeometry(2.8, 0), glow);
        gem.position.y = -5;
        g.add(bar, gem);
        break;
      }
      case "Orb": {
        const sphere = new THREE.Mesh(
          new THREE.IcosahedronGeometry(10.5, 2),
          glow,
        );
        sphere.position.y = -22;
        const ringA = new THREE.Mesh(
          new THREE.TorusGeometry(15.5, 1.2, 6, 20),
          steel,
        );
        ringA.position.y = -22;
        ringA.rotation.set(0.6, 0.4, 0);
        const ringB = new THREE.Mesh(
          new THREE.TorusGeometry(13.5, 1.0, 6, 20),
          brass,
        );
        ringB.position.y = -22;
        ringB.rotation.set(-0.7, 0.9, 0.3);
        g.add(sphere, ringA, ringB);
        break;
      }
      case "Nunchucks": {
        const b1 = new THREE.Mesh(
          new THREE.CylinderGeometry(2.6, 2.4, 24, 8),
          wood,
        );
        b1.position.y = -10;
        const cap1 = new THREE.Mesh(
          new THREE.CylinderGeometry(2.9, 2.9, 4, 8),
          brass,
        );
        cap1.position.y = -21;
        for (let i = 0; i < 4; i++) {
          const link = new THREE.Mesh(
            new THREE.TorusGeometry(2.4, 0.8, 5, 8),
            steel,
          );
          link.position.set(i * 2.5, -24 - i * 1.8, i * 1.5);
          link.rotation.y = (i % 2) * 1.5;
          g.add(link);
        }
        const b2 = new THREE.Mesh(
          new THREE.CylinderGeometry(2.6, 2.4, 24, 8),
          wood,
        );
        b2.position.set(14, -38, 6);
        b2.rotation.z = 0.65;
        const tipGlow = new THREE.Mesh(
          new THREE.CylinderGeometry(3.0, 3.0, 4.5, 8),
          glow,
        );
        tipGlow.position.set(20, -47, 6);
        tipGlow.rotation.z = 0.65;
        g.add(b1, cap1, b2, tipGlow);
        break;
      }
      case "Chain Blade": {
        const handle = new THREE.Mesh(
          new THREE.CylinderGeometry(2.2, 2.0, 26, 8),
          darkSteel,
        );
        handle.position.y = -10;
        const blade = new THREE.Mesh(
          new THREE.TorusGeometry(15, 2.4, 6, 14, Math.PI * 0.68),
          steel,
        );
        blade.position.set(0, -18, 12);
        blade.rotation.y = Math.PI / 2;
        blade.rotation.z = 0.5;
        const bladeGlow = new THREE.Mesh(
          new THREE.TorusGeometry(16.2, 0.9, 4, 14, Math.PI * 0.65),
          glow,
        );
        bladeGlow.position.copy(blade.position);
        bladeGlow.rotation.copy(blade.rotation);
        for (let i = 0; i < 6; i++) {
          const link = new THREE.Mesh(
            new THREE.TorusGeometry(2.5, 0.85, 5, 8),
            steel,
          );
          link.position.set(-i * 2.2, 6 + i * 4.5, -i * 2.6);
          g.add(link);
        }
        const weight = new THREE.Mesh(
          new THREE.DodecahedronGeometry(5.8, 0),
          brass,
        );
        weight.position.set(-14, 34, -16);
        g.add(handle, blade, bladeGlow, weight);
        break;
      }
      case "Cannon": {
        const barrel = new THREE.Mesh(
          new THREE.CylinderGeometry(11.5, 8.5, 52, 14),
          darkSteel,
        );
        barrel.position.set(0, -24, 2);
        const lip = new THREE.Mesh(
          new THREE.TorusGeometry(11.5, 2.4, 8, 16),
          brass,
        );
        lip.position.set(0, -49, 2);
        lip.rotation.x = Math.PI / 2;
        const band1 = new THREE.Mesh(
          new THREE.TorusGeometry(10.4, 1.6, 6, 16),
          brass,
        );
        band1.position.set(0, -28, 2);
        band1.rotation.x = Math.PI / 2;
        const band2 = new THREE.Mesh(
          new THREE.TorusGeometry(9.4, 1.5, 6, 16),
          brass,
        );
        band2.position.set(0, -10, 2);
        band2.rotation.x = Math.PI / 2;
        const bore = new THREE.Mesh(
          new THREE.SphereGeometry(8.2, 12, 10),
          glow,
        );
        bore.position.set(0, -48, 2);
        g.add(barrel, lip, band1, band2, bore);
        break;
      }
    }
    return g;
  }

  update(f: Fighter, x: number, y: number, time: number) {
    const id = f.def.id;
    const weapon = f.def.weapons[f.weapon];
    const reserve = f.def.weapons[1 - f.weapon];
    const glowHex = (PALETTES_3D[id] ?? PALETTES_3D.ronin).glow;

    // Frame delta for exponential pose smoothing (frozen while paused).
    const dt =
      this.lastTime < 0
        ? 1 / 60
        : Math.min(0.05, Math.max(0, time - this.lastTime));
    this.lastTime = time;

    if (this.builtFighterId !== id) {
      this.applyIdentity(f);
      this.builtFighterId = id;
      this.builtWeapon = "";
      this.builtSheathed = "";
      this.poseReady = false;
      this.gaitPhase = 0;
    }

    // Snapshot rotations into preallocated buffers (no per-frame allocation).
    const bones = this.bones;
    const prevRot = this.prevRot;
    for (let i = 0; i < 10; i++) {
      const r = bones[i].rotation;
      prevRot[i * 3] = r.x;
      prevRot[i * 3 + 1] = r.y;
      prevRot[i * 3 + 2] = r.z;
    }
    const pc = this.prevCore;
    pc[0] = this.pelvis.rotation.x;
    pc[1] = this.pelvis.rotation.y;
    pc[2] = this.pelvis.rotation.z;
    pc[3] = this.spine.rotation.x;
    pc[4] = this.spine.rotation.y;
    pc[5] = this.spine.rotation.z;
    pc[6] = this.neck.rotation.x;
    pc[7] = this.neck.rotation.y;
    pc[8] = this.neck.rotation.z;
    if (this.builtWeapon !== weapon) {
      this.mainWeaponSlot.clear();
      this.offWeaponSlot.clear();
      this.mainWeaponSlot.add(this.buildWeapon3D(weapon, glowHex));
      if (DUAL_WEAPONS.has(weapon)) {
        this.offWeaponSlot.add(this.buildWeapon3D(weapon, glowHex));
      }
      this.builtWeapon = weapon;
    }
    if (this.builtSheathed !== reserve) {
      this.backMount.clear();
      const sheathed = this.buildWeapon3D(reserve, glowHex);
      sheathed.scale.setScalar(0.8);
      this.backMount.add(sheathed);
      this.builtSheathed = reserve;
    }

    // Place feet on exact arena plane (x, -y, 0)
    const prop = PROPORTIONS_3D[id] ?? PROPORTIONS_3D.ronin;
    const attackMotion = f.attack?.move ? sampleAttackMotion(f.attack) : null;
    const anticipation = attackMotion
      ? attackMotion.windup * (1 - attackMotion.strike) * (1 - attackMotion.recovery)
      : 0;
    const compression = Math.min(0.1, anticipation * 0.035 + (attackMotion?.impact ?? 0) * 0.026);
    const squash = f.landSquash * 0.13 + compression;
    this.group.position.set(x, -y, 0);
    this.group.scale.set(
      prop.wide * (1 + squash * 0.7),
      prop.tall * (1 - squash),
      prop.wide * (1 + squash * 0.7),
    );
    this.spine.scale.set(prop.chest / prop.wide, 1, 1);
    this.neck.scale.setScalar(prop.head);

    const walking = Math.abs(f.vx) > 30 && f.grounded && f.dodgeTime <= 0;
    const stride = Math.min(1.3, Math.abs(f.vx) / 330);
    // Integrate speed-dependent gait rather than phase = time * speed (which
    // jumps in phase whenever the fighter accelerates or slows down).
    if (walking) this.gaitPhase += dt * (8 + 7 * stride);
    const run = walking ? Math.sin(this.gaitPhase) * Math.min(1.15, stride) : 0;
    const breath = Math.sin(time * 2.6 + f.player * 1.7);

    // Base 3-quarter 3D hero angle, turned smoothly along the shortest arc so
    // fighters pivot to face their rival instead of snapping 180 degrees.
    const baseYaw = f.facing * 1.02;
    if (!this.poseReady) this.yawSmooth = baseYaw;
    let yawDiff = baseYaw - this.yawSmooth;
    yawDiff = Math.atan2(Math.sin(yawDiff), Math.cos(yawDiff));
    this.yawSmooth += yawDiff * (1 - Math.exp(-14 * dt));
    let yaw = this.yawSmooth;
    let pitch = 0;
    let roll = 0;
    let hipBob = 0;
    this.pelvis.position.x = 0;

    if (walking) {
      hipBob = Math.abs(run) * 3.2;
      pitch = 0.14 * Math.min(1.2, stride);
      this.rightHip.rotation.set(-run * 0.72, 0, 0);
      this.rightKnee.rotation.set(Math.max(0, run) * 0.85 + 0.12, 0, 0);
      this.leftHip.rotation.set(run * 0.72, 0, 0);
      this.leftKnee.rotation.set(Math.max(0, -run) * 0.85 + 0.12, 0, 0);
    } else if (!f.grounded) {
      const diving = f.attack?.stance[1] === "D";
      const rising = Math.max(-1, Math.min(1, -f.vy / 500));
      this.rightHip.rotation.set(
        diving ? -0.95 : -0.55 - rising * 0.25,
        0,
        -0.08,
      );
      this.rightKnee.rotation.set(diving ? 1.45 : 1.05, 0, 0);
      this.leftHip.rotation.set(diving ? -0.45 : 0.28 - rising * 0.2, 0, 0.08);
      this.leftKnee.rotation.set(diving ? 1.15 : 0.65, 0, 0);
      pitch = diving ? 0.28 : -rising * 0.12;
    } else {
      hipBob = breath * 1.1;
      this.rightHip.rotation.set(-0.14, 0, -0.09);
      this.rightKnee.rotation.set(0.26, 0, 0);
      this.leftHip.rotation.set(0.16, 0, 0.09);
      this.leftKnee.rotation.set(0.18, 0, 0);
    }

    // Arm & Spine combat choreography driven by MoveDef
    const attack = f.attack;
    const move: MoveDef | null = attack?.move ?? null;
    let spineTwist = walking ? run * 0.22 : breath * 0.04;
    let spinePitch = 0.05 + (walking ? 0.08 * stride : 0);
    let chestRoll = walking ? -run * 0.045 : breath * 0.015;
    let crouch = 0;

    if (attack) {
      const t = attack.time;
      const dur = Math.max(0.05, attack.duration);
      const p = Math.min(1, t / dur);
      const arcType = move?.anim.arc ?? "swing";

      if (attack.kind === "special") {
        // One bespoke 3D choreography per signature. Poses are keyed by the
        // fighter's special type and phased over the 0.55s cast.
        const type = f.def.special.type;
        const L = THREE.MathUtils.lerp;
        const ss = (a: number, b: number, x: number) => {
          const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
          return k * k * (3 - 2 * k);
        };
        const strike = ss(0.16, 0.42, p) * (1 - ss(0.78, 1, p));
        const hold = ss(0.1, 0.34, p);
        const rS = (x: number, y: number, z: number) =>
          this.rightShoulder.rotation.set(x, y, z);
        const rE = (x: number) => this.rightElbow.rotation.set(x, 0, 0);
        const lS = (x: number, y: number, z: number) =>
          this.leftShoulder.rotation.set(x, y, z);
        const lE = (x: number) => this.leftElbow.rotation.set(x, 0, 0);

        switch (type) {
          case "rift":
            rS(L(-2.7, -0.25, strike), 0, -0.72);
            rE(-0.12);
            lS(-0.5, 0, 0.62);
            lE(-0.7);
            spineTwist = 0.82 * strike;
            pitch += 0.27 * strike;
            crouch = 4;
            break;
          case "dragon":
            rS(-1.7 + Math.sin(p * 22) * 0.28, 0, -0.5);
            rE(-0.35);
            lS(-1.55 - Math.sin(p * 22) * 0.28, 0, 0.5);
            lE(-0.35);
            yaw += strike * 0.45;
            pitch += 0.32 * strike;
            spineTwist = 0.45;
            break;
          case "overdrive":
            rS(-1.52 + Math.sin(p * 48) * 0.055, 0, -0.12);
            rE(-0.08);
            lS(-1.05, 0, 0.34);
            lE(-0.95);
            spineTwist = 0.28;
            pitch += 0.12;
            break;
          case "quake":
          case "eruption":
          case "mjolnir":
          case "hellchain": {
            const slam = ss(0.34, 0.58, p);
            rS(L(-3.0, 0.62, slam), 0, -0.28);
            rE(L(-0.3, -0.05, slam));
            lS(L(-2.85, 0.45, slam), 0, 0.28);
            lE(L(-0.35, -0.08, slam));
            crouch = slam * (type === "eruption" ? 12 : 9);
            pitch += slam * 0.36;
            spineTwist = type === "hellchain" ? 0.55 : 0.12;
            if (type === "hellchain") yaw += strike * 0.75;
            break;
          }
          case "rain":
          case "starfall":
          case "phoenix_arrow":
            rS(type === "starfall" ? L(-3.05, -0.9, strike) : -2.65, 0, -0.35);
            rE(-0.22);
            lS(-2.15, 0, 0.42);
            lE(type === "phoenix_arrow" ? -1.25 : -0.65);
            pitch -= 0.16 * hold;
            spineTwist = type === "starfall" ? 0.48 * strike : 0.18;
            break;
          case "sandstorm":
          case "crimson_vortex":
            yaw += p * Math.PI * (type === "sandstorm" ? 4 : 3);
            rS(-1.58, 0, -0.95);
            rE(-0.12);
            lS(-1.58, 0, 0.95);
            lE(-0.12);
            crouch = 6;
            spineTwist = 0.2;
            break;
          case "deadeye":
          case "darkheart":
            rS(-1.56, 0, -0.08);
            rE(-0.06);
            lS(-1.48, 0, type === "darkheart" ? 0.08 : 0.22);
            lE(-0.18);
            spineTwist = type === "darkheart" ? -0.2 : 0.08;
            pitch += 0.06;
            break;
          case "singularity":
            rS(-2.85, 0, -0.95);
            rE(-0.18);
            lS(-2.85, 0, 0.95);
            lE(-0.18);
            yaw += p * Math.PI;
            hipBob += strike * 6;
            pitch -= 0.08;
            break;
          case "frost":
          case "jade_cyclone":
            if (type === "jade_cyclone") yaw += p * Math.PI * 2;
            rS(-1.35, 0, -1.05);
            rE(-0.25);
            lS(-1.35, 0, 1.05);
            lE(-0.25);
            crouch = type === "frost" ? 8 : 3;
            pitch += 0.14;
            break;
          case "nova":
          case "sol_lotus":
            rS(-2.95 + strike * 0.35, 0, -0.78);
            rE(-0.16);
            lS(-2.95 + strike * 0.35, 0, 0.78);
            lE(-0.16);
            hipBob += strike * (type === "sol_lotus" ? 10 : 8);
            yaw += strike * (type === "sol_lotus" ? 0.6 : 0.15);
            break;
          case "whirlwind":
            yaw += p * Math.PI * 5;
            rS(-1.6, 0, -1.0);
            rE(-0.1);
            lS(-1.6, 0, 1.0);
            lE(-0.1);
            break;
          case "chain_strike":
            rS(-1.52, 0, -0.18);
            rE(-0.04);
            lS(-0.25, 0, 0.72);
            lE(-0.45);
            spineTwist = 0.86 * strike;
            pitch += 0.2 * strike;
            break;
          case "broadside":
          case "kraken":
            rS(-1.28 + Math.sin(p * 30) * 0.09, 0, -0.2);
            rE(-0.14);
            lS(-0.95, 0, 0.35);
            lE(-1.0);
            crouch = type === "kraken" ? 6 : 7;
            pitch += type === "kraken" ? -0.1 : 0.14;
            spineTwist = 0.34;
            break;
          case "tempest":
            rS(L(-2.35, -0.35, strike) + Math.sin(time * 65) * 0.025, 0, -0.62);
            rE(-0.16);
            lS(-0.72, 0, 0.5);
            lE(-0.62);
            spineTwist = 0.68 * strike;
            pitch += 0.24 * strike;
            break;
          case "tidal_jaws":
            rS(L(-2.65, -0.4, strike), 0, -0.55);
            rE(-0.2);
            lS(L(-0.35, -2.45, strike), 0, 0.55);
            lE(-0.2);
            pitch += 0.3 * strike;
            crouch = 5;
            break;
          default:
            rS(L(-2.6, -0.45, strike), 0, -0.3);
            rE(-0.18);
            lS(-0.75, 0, 0.35);
            lE(-0.85);
            spineTwist = 0.55 * strike;
            break;
        }
        this.rightWrist.rotation.set(-0.22, 0, 0);
        this.leftWrist.rotation.set(-0.18, 0, 0);
      } else if (move) {
        // Regular attacks are animated in the same startup / hit / recovery
        // windows as the engine. The whole body anticipates, accelerates into
        // the strike, and follows through; never alter physical hitboxes here.
        const m = attackMotion!;
        const pose = (rest: number, wind: number, hit: number) =>
          attackPoseValue(rest, wind, hit, m);
        const heavy = attack.kind === "heavy";
        const power = (heavy ? 1.3 : 1) * (attack.chain === 3 ? 1.1 : 1);
        const side = attack.stance[1] === "S";
        const down = attack.stance[1] === "D";
        const aerial = attack.stance[0] === "a";
        const wind = m.windup * (1 - m.strike) * (1 - m.recovery);
        const hit = m.strike * m.windup * (1 - m.recovery);

        // Counter-rotation of hips, spine and shoulders adds readable weight.
        spineTwist = pose(spineTwist, -0.52 * power, 0.76 * power) + m.follow * 0.08 * power;
        spinePitch = pose(spinePitch, -0.19 * power, (down ? 0.32 : side ? 0.16 : -0.16) * power);
        chestRoll += pose(0, -0.1, 0.18) * f.facing * power;
        yaw += pose(0, -0.14, 0.24) * f.facing;
        pitch += pose(0, -0.18, down ? 0.34 : side ? 0.2 : -0.1) * power;
        hipBob += m.impact * (heavy ? 4.5 : 2.2) - m.settle * 2;
        crouch += pose(0, heavy ? 9 : 5, down ? 13 : side ? 5 : 3) - m.whip * 2;
        const advance = pose(0, -3, side ? 9 : down ? 3 : 5) * power;
        this.pelvis.position.x = (advance + m.whip * (side ? 3.5 : 1.2)) * f.facing;

        if (arcType === "spin") {
          // Spin only through the hit window, not through the windup/recovery.
          yaw += m.strike * (1 - m.recovery) * Math.PI * 2 * f.facing;
          this.rightShoulder.rotation.set(pose(-0.68, -1.05, -1.65), 0, -0.67);
          this.leftShoulder.rotation.set(pose(-0.62, -0.95, -1.55), 0, 0.67);
          this.rightElbow.rotation.set(pose(-0.92, -0.65, -0.1), 0, 0);
          this.leftElbow.rotation.set(pose(-1.05, -0.6, -0.15), 0, 0);
          this.rightWrist.rotation.set(-0.18, 0, 0);
          this.leftWrist.rotation.set(-0.18, 0, 0);
        } else if (arcType === "thrust" || arcType === "shoot") {
          // Draw the weapon back, drive forward, then recoil. A bow or blaster
          // is held steady with a second hand while dual weapons alternate.
          const shot = arcType === "shoot";
          const aim = -Math.PI / 2 + move.anim.a1 * 0.55;
          const recoil = m.impact * (shot ? 0.28 : 0.08) * power;
          this.rightShoulder.rotation.set(
            pose(-0.68, -2.1, aim) + recoil, 0,
            pose(-0.24, -0.36, -0.08),
          );
          this.rightElbow.rotation.set(pose(-0.92, -1.35, -0.14) - recoil, 0, 0);
          this.rightWrist.rotation.set(pose(-0.48, -0.2, 0.07) + recoil, 0, 0);
          const alternating = DUAL_WEAPONS.has(weapon) && attack.chain % 2 === 0;
          this.leftShoulder.rotation.set(
            pose(-0.62, -1.0, alternating ? aim : -1.12), 0,
            pose(0.28, 0.48, shot ? 0.24 : 0.54),
          );
          this.leftElbow.rotation.set(pose(-1.05, -0.92, shot ? -0.55 : -0.75), 0, 0);
          this.leftWrist.rotation.set(-0.2, 0, 0);
        } else {
          // Rising launchers arc upward, side cleaves travel across the chest,
          // and low attacks swing down through the opponent's legs. Use each
          // move's actual authored angle so all 78 moves retain their identity.
          const a0 = -Math.PI / 2 + move.anim.a0 * 0.67;
          const a1 = -Math.PI / 2 + move.anim.a1 * 0.67;
          this.rightShoulder.rotation.set(
            pose(-0.68, a0, a1),
            pose(0, -0.12, side ? 0.16 : 0),
            pose(-0.24, -0.4, side ? 0.24 : -0.12),
          );
          this.rightElbow.rotation.set(
            pose(-0.92, -0.85, heavy ? -0.02 : -0.22), 0, 0,
          );
          this.rightWrist.rotation.set(
            pose(-0.48, -0.35, 0.22) + m.impact * 0.14, 0, 0,
          );
          this.leftShoulder.rotation.set(
            pose(-0.62, -1.0, down ? -1.12 : side ? -0.45 : -0.85), 0,
            pose(0.28, 0.5, 0.16),
          );
          this.leftElbow.rotation.set(pose(-1.05, -0.95, -0.62), 0, 0);
          this.leftWrist.rotation.set(-0.24, 0, 0);
        }
        // Feet brace into side attacks, compress for low sweeps, and tuck on
        // aerials; all are visual-only rotations of the existing skeleton.
        if (!aerial && f.grounded) {
          this.rightHip.rotation.x += wind * 0.24 - hit * 0.3;
          this.leftHip.rotation.x += wind * -0.24 + hit * 0.3;
          this.rightKnee.rotation.x += hit * (down ? 0.64 : 0.18) + m.whip * 0.12;
          this.leftKnee.rotation.x += wind * 0.24 + m.follow * (side ? 0.18 : 0.04);
          // Push from the planted rear leg so the strike reads as a whole-body
          // transfer rather than hands moving on a motionless mannequin.
          this.rightHip.rotation.z -= wind * 0.11;
          this.leftHip.rotation.z += hit * 0.13;
        } else if (aerial) {
          this.rightHip.rotation.x += hit * (down ? 0.75 : -0.35);
          this.leftHip.rotation.x -= hit * (down ? 0.3 : 0.4);
          this.rightKnee.rotation.x += hit * 0.3;
        }
      } else if (attack.kind === "recovery") {
        // The separate aerial recovery is a rising corkscrew/uppercut, not a
        // regular strike and not a meter-consuming signature.
        const p = Math.min(1, attack.time / attack.duration);
        const rise = Math.sin(Math.min(1, p * 1.5) * Math.PI / 2);
        const settle = 1 - Math.max(0, (p - 0.68) / 0.32);
        const flourish = rise * settle;
        yaw += p * Math.PI * 1.5 * f.facing;
        pitch -= flourish * 0.28;
        hipBob += flourish * 7;
        spineTwist = flourish * 0.42;
        this.rightShoulder.rotation.set(-2.9 * flourish - 0.68 * (1 - flourish), 0, -0.48);
        this.rightElbow.rotation.set(-0.18, 0, 0);
        this.rightWrist.rotation.set(-0.14, 0, 0);
        this.leftShoulder.rotation.set(-2.15 * flourish - 0.62 * (1 - flourish), 0, 0.5);
        this.leftElbow.rotation.set(-0.36, 0, 0);
        this.leftWrist.rotation.set(-0.22, 0, 0);
        this.rightHip.rotation.x = -0.75 - flourish * 0.5;
        this.leftHip.rotation.x = 0.28 + flourish * 0.24;
      }

      if (attack.kind === "special" && attack.stance[1] === "D" && f.grounded) crouch = 8;
    } else {
      // Heroic ready stance (weapon held clearly up-and-forward, off-hand on guard)
      const idleSway = breath * 0.05;
      const runPump = walking ? run * 0.45 : 0;
      this.rightShoulder.rotation.set(
        -0.68 + idleSway + runPump * 0.5,
        0,
        -0.24,
      );
      this.rightElbow.rotation.set(-0.92 - idleSway, 0, 0);
      this.rightWrist.rotation.set(-0.48, 0, 0);

      this.leftShoulder.rotation.set(-0.62 - runPump * 0.65, 0, 0.28);
      this.leftElbow.rotation.set(-1.05, 0, 0);
      this.leftWrist.rotation.set(-0.35, 0, 0);
    }

    // Committed dodge tumble: tuck limbs, roll towards the input direction,
    // then unfold into a guard. Its visual safety cue ends with actual i-frames.
    if (f.dodgeTime > 0) {
      const progress = dodgeProgress(f.dodgeTime);
      const turn = rollEase(progress);
      const tuck = Math.sin(progress * Math.PI);
      const horizontal = Math.abs(f.dodgeVectorX) > 0;
      const direction = f.dodgeVectorX || f.facing;
      if (horizontal) {
        roll += Math.PI * 2 * turn * direction;
        pitch += 0.22 * tuck;
      } else if (f.dodgeVectorY) {
        pitch += Math.PI * 2 * turn * -f.dodgeVectorY;
      } else {
        pitch += 0.65 * tuck;
      }
      crouch += (horizontal ? 18 : 10) * tuck;
      this.rightHip.rotation.x = -1.25 * tuck;
      this.leftHip.rotation.x = -1.1 * tuck;
      this.rightKnee.rotation.x = 1.7 * tuck;
      this.leftKnee.rotation.x = 1.6 * tuck;
      this.rightShoulder.rotation.x = -1.35 * tuck - 0.68 * (1 - tuck);
      this.leftShoulder.rotation.x = -1.4 * tuck - 0.62 * (1 - tuck);
      this.rightElbow.rotation.x = -0.5 - tuck * 0.55;
      this.leftElbow.rotation.x = -0.55 - tuck * 0.5;
      spineTwist = direction * tuck * 0.18;
    } else if (f.stun > 0) {
      pitch -= 0.34;
      roll = -0.18 * f.facing;
    }

    // Spin floating Orb rings continuously in 3D!
    if (weapon === "Orb" && this.mainWeaponSlot.children[0]) {
      const orbGroup = this.mainWeaponSlot.children[0];
      if (orbGroup.children[1]) orbGroup.children[1].rotation.y = time * 3.4;
      if (orbGroup.children[2]) orbGroup.children[2].rotation.x = time * 2.7;
    }

    this.pelvis.position.set(this.pelvis.position.x, 44 + hipBob - crouch, 0);
    this.pelvis.rotation.set(pitch, yaw, roll);
    this.spine.rotation.set(spinePitch, spineTwist, chestRoll);
    this.neck.rotation.set(
      -pitch * 0.45 - spinePitch * 0.27,
      -spineTwist * 0.53 - f.facing * 0.18,
      -chestRoll * 0.5,
    );

    // Exponential pose blending: limbs ease between locomotion / air / attack
    // states. Attacks use a faster rate so strikes stay crisp, while idle and
    // run transitions glide. The first frame snaps into place.
    const limbRate = attackMotion?.active ? 65 : attack ? 32 : f.dodgeTime > 0 ? 35 : 19;
    const k = this.poseReady ? 1 - Math.exp(-limbRate * dt) : 1;
    const kb = this.poseReady ? 1 - Math.exp(-16 * dt) : 1;
    for (let i = 0; i < 10; i++) {
      const r = bones[i].rotation;
      const j = i * 3;
      r.x = prevRot[j] + (r.x - prevRot[j]) * k;
      r.y = prevRot[j + 1] + (r.y - prevRot[j + 1]) * k;
      r.z = prevRot[j + 2] + (r.z - prevRot[j + 2]) * k;
    }
    this.pelvis.rotation.x = pc[0] + (pitch - pc[0]) * kb;
    // Complete dodge rotations without dragging a 2π angle backwards when
    // the pose ends. Non-dodge rolls blend via the shortest angular path.
    this.pelvis.rotation.z = f.dodgeTime > 0
      ? roll
      : pc[2] + Math.atan2(Math.sin(roll - pc[2]), Math.cos(roll - pc[2])) * kb;
    this.spine.rotation.x = pc[3] + (spinePitch - pc[3]) * kb;
    this.spine.rotation.y = pc[4] + (spineTwist - pc[4]) * kb;
    this.spine.rotation.z = pc[5] + (chestRoll - pc[5]) * kb;
    this.neck.rotation.x = pc[6] + (-pitch * 0.45 - spinePitch * 0.27 - pc[6]) * kb;
    this.neck.rotation.y = pc[7] + (-spineTwist * 0.53 - f.facing * 0.18 - pc[7]) * kb;
    this.neck.rotation.z = pc[8] + (-chestRoll * 0.5 - pc[8]) * kb;
    this.poseReady = true;

    // Animate 3D cloth cape wave
    const pos = this.capeMesh.geometry.attributes.position;
    const speedDrag = Math.min(1.6, Math.abs(f.vx) / 260);
    for (let i = 0; i < pos.count; i++) {
      const py = pos.getY(i);
      const t = Math.min(1, -py / 50);
      const flutter =
        Math.sin(time * 7.5 - py * 0.11) * (3.5 + speedDrag * 5) * t;
      pos.setZ(i, this.capeBaseZ[i] - (4 + speedDrag * 16) * t * t + flutter);
    }
    pos.needsUpdate = true;

    // Invulnerability blink & Special Ready emissive armor glow
    const blinkHide = f.invulnerable > 0 && Math.sin(time * 35) > 0.55;
    this.group.visible = !blinkHide;
    const pulse =
      f.signatureDodge > 0
        ? 0.58 + Math.sin(time * 16) * 0.2
        : f.channeling
          ? 0.34 + Math.sin(time * 12) * 0.18
          : f.charge >= 75
            ? 0.35 + Math.sin(time * 6) * 0.16
            : 0.06;
    this.trimMat.emissive.setHex(f.signatureDodge > 0 ? 0xbfe9ff : glowHex);
    this.trimMat.emissiveIntensity = pulse;
  }

  dispose() {
    this.scene.remove(this.group);
  }
}

let sharedRenderer: ThreeFighterRenderer | null = null;
let sharedRendererFailed = false;

export function getSharedThreeRenderer(): ThreeFighterRenderer | null {
  if (sharedRenderer) return sharedRenderer;
  if (sharedRendererFailed) return null;
  try {
    sharedRenderer = new ThreeFighterRenderer(WIDTH, HEIGHT);
    return sharedRenderer;
  } catch (err) {
    sharedRendererFailed = true;
    console.warn(
      "WebGL 3D character renderer unavailable, using 2D fallback:",
      err,
    );
    return null;
  }
}
