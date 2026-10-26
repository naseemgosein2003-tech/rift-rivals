import type { Attack } from "./engine";

/**
 * Pure, render-only attack timing. A pose never decides when a hit connects:
 * startup/active/recovery are read from the combat move that already owns them.
 * Both the WebGL rig and the 2D fallback sample the exact same choreography.
 */
export interface AttackMotion {
  /** Ease into the anticipation pose during the move's real startup. */
  windup: number;
  /** Fast weapon travel during the real active frames; stays at 1 afterwards. */
  strike: number;
  /** Smoothly blend the completed swing back to the ready stance. */
  recovery: number;
  /** Short burst of body rotation/recoil at the beginning of the hit window. */
  impact: number;
  /** 0..1 opacity of the motion trail, including a very short fade-out. */
  trail: number;
  /** Whip-through at contact; nonzero only while the weapon is accelerating. */
  whip: number;
  /** Shoulder / spine counter-motion that peaks AFTER the swing connects. */
  follow: number;
  /** Small release bounce as the fighter regains a neutral guard. */
  settle: number;
  /** Whether the actual move is in its attack-active frames. */
  active: boolean;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (t: number) => t * t * (3 - 2 * t);
const snap = (t: number) => 1 - Math.pow(1 - t, 3);

export function sampleAttackMotion(attack: Attack): AttackMotion {
  const move = attack.move;
  // Recovery and specials have their own choreography, not this move timeline.
  if (!move) {
    return { windup: 0, strike: 0, recovery: 0, impact: 0, trail: 0, whip: 0, follow: 0, settle: 0, active: false };
  }
  const start = Math.max(0, move.startup);
  const activeLength = Math.max(0.001, move.active);
  const end = start + activeLength;
  const t = Math.max(0, attack.time);
  const windup = smooth(clamp01(t / Math.max(0.001, start)));
  const strikeT = clamp01((t - start) / activeLength);
  const strike = snap(strikeT);
  const recovery = smooth(
    clamp01((t - end) / Math.max(0.001, attack.duration - end)),
  );
  const impact = Math.sin(strikeT * Math.PI) * (1 - recovery);
  const whip = Math.sin(Math.PI * Math.min(1, strikeT)) * (1 - recovery);
  const follow = snap(strikeT) * (1 - recovery) * (0.7 + 0.3 * strikeT);
  const settle = Math.sin(recovery * Math.PI) * (t >= end ? 1 : 0);
  const trailFade = Math.max(0, 1 - (t - end) / 0.075);
  const trail = t < start || t >= attack.duration
    ? 0
    : Math.min(1, trailFade) *
      (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, strikeT * 0.85 + 0.1)));
  return {
    windup,
    strike,
    recovery,
    impact,
    trail,
    whip,
    follow,
    settle,
    active: t >= start && t <= end,
  };
}

/** Interpolate a rest pose through anticipation, impact, and recovery. */
export function attackPoseValue(
  rest: number,
  anticipation: number,
  followThrough: number,
  motion: AttackMotion,
): number {
  // Slightly overshoot the impact pose, then release it. This adds visible
  // acceleration without delaying gameplay's original active hit frames.
  const snapThrough = motion.strike + motion.whip * 0.085;
  const held = anticipation + (followThrough - anticipation) * snapThrough;
  return rest + (held - rest) * motion.windup * (1 - motion.recovery);
}
