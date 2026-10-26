/** Defensive dodge balance, shared by simulation and renderers. */
export const DODGE_COOLDOWN = 2;
export const DODGE_DURATION = 0.3;
export const DODGE_IFRAMES = 0.18;
export const DODGE_SPEED = 540;

/** Normalized 0..1 timeline for the current dodge; visuals never grant i-frames. */
export function dodgeProgress(remaining: number): number {
  return Math.max(0, Math.min(1, 1 - remaining / DODGE_DURATION));
}

/** A committed, fast roll with a softer finish; no changes to physics. */
export function rollEase(progress: number): number {
  const t = Math.max(0, Math.min(1, progress));
  return 1 - Math.pow(1 - t, 2.6);
}
