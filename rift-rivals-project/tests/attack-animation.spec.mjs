import { test, expect } from "@playwright/test";

const origin = "http://localhost:5173";

/** The animations sample real move timing without modifying combat rules. */
test("all weapon attacks animate through startup, active hit, and recovery", async ({ page }) => {
  await page.goto(origin);
  const result = await page.evaluate(async () => {
    const { sampleAttackMotion, attackPoseValue } = await import("/src/game/attackAnimation.ts");
    const { getMove, STANCES } = await import("/src/game/moves.ts");
    const { WEAPONS } = await import("/src/game/data.ts");
    let variants = 0;
    for (const weapon of Object.keys(WEAPONS)) {
      for (const stance of STANCES) {
        for (const heavy of [false, true]) {
          const move = getMove(weapon, stance, heavy);
          const at = (time) => sampleAttackMotion({ kind: heavy ? "heavy" : "light", time, duration: move.duration, move });
          const beginning = at(0);
          const before = at(move.startup * 0.5);
          const impact = at(move.startup + move.active * 0.5);
          const finish = at(move.duration);
          if (beginning.active || beginning.trail !== 0 || beginning.strike !== 0) return { error: `premature strike for ${weapon}/${stance}` };
          if (!(before.windup > 0 && before.windup < 1) || before.active) return { error: `missing windup ${weapon}/${stance}` };
          if (!impact.active || !(impact.strike > 0 && impact.trail > 0)) return { error: `missing active swing ${weapon}/${stance}` };
          if (finish.recovery !== 1 || finish.trail !== 0) return { error: `incomplete recovery ${weapon}/${stance}` };
          if (attackPoseValue(0, -1, 1, beginning) !== 0 || Math.abs(attackPoseValue(0, -1, 1, finish)) > 1e-8) {
            return { error: `pose didn't return to rest ${weapon}/${stance}` };
          }
          variants++;
        }
      }
    }
    return { variants };
  });
  expect(result).toEqual({ variants: 156 });
});
