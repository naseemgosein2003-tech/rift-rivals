# Rift Rivals

A complete 1v1 browser platform fighter, built with React, TypeScript, Vite, Tailwind CSS v4, fixed-step combat, and lit Three.js 3D fighters over painted stages. Falls back to 2D character art if WebGL is unavailable. No backend or account is required.

## Run

```sh
npm install
npm run dev
```

## Play

Select one of 25 fighters and their unique dual-weapon loadout. Before each fight, choose both fighters, vote on one of five arenas (or vote Random), and customize match rules. Solo Showdown pairs you with a CPU opponent across five difficulty tiers; Match Settings also offers a local two-player duel on one screen.

- Choose 1, 2, 3, 5, or 7 stocks per fighter. Filling their damage meter or crossing a blast boundary costs a stock. Health pools vary by character, from 194 to 320.
- Match time is optional: no limit, 2, 3, 5, 8, or 10 minutes. At time, the fighter with more stocks wins. Ties compare remaining health percentage, then score. The clock stops while paused.
- Every weapon has six attacks: neutral, side, and down, each with a grounded and an airborne version. Hold a direction while attacking to choose. Light and heavy both follow the direction, giving 78 distinct moves across 13 weapons.
- Grounded down attacks sweep low and lift light opponents. Airborne down attacks spike straight down and crater the stage on landing.
- Chain three light attacks in one stance for a stronger finisher, mix in heavy attacks, or swap weapons mid-fight.
- Repeating the same stance is taxed with a rising cooldown, so pressure has to be earned by mixing directions. Every attack also has a small recovery floor.
- Dealing 75 regular damage fills the signature meter. Specials consume the meter and cannot recharge it themselves.
- Alternatively, hold U (Player 2: 5, or Charge on touch) while grounded to channel 20 signature charge per second. Channeling stops movement, attacks, and dodging; opponents deal 35% extra damage if they catch you. Release to defend yourself. Your earned charge is retained if interrupted.
- Regular attacks have direction-aware full-body choreography: animated wind-ups, quick impact swings, momentum and footwork, weapon recoil, and smooth recovery, synchronized to each move's existing startup and active frames in both the 3D renderer and 2D fallback. These visual effects do not alter hitboxes or damage.
- Every signature has a bespoke 3D animation and 2D flourish, applies a longer signature stun on hit (shown by STUNNED stars), and opens with a 0.50s dodge window that lets the caster pass through incoming attacks.
- Ordinary ranged shots expire at the weapon's reach (Blasters 520, Bow 600, Orb 460 world units), rather than flying forever. Specials have their own finite longer reach.
- You have three jumps total (one ground jump and two air jumps), plus one separate upward recovery attack per airtime. Landing restores both jumps and recovery.
- Balanced defensive dodge: ground rolls, side/vertical/neutral air dodges, and hitstun escapes share a **2-second cooldown**. The first **0.18 seconds** are invulnerable; the final **0.12 seconds** are vulnerable, punishable recovery. Dodging cannot cancel an active attack, attack cooldown, signature cast, or landing lag. In the air, hold left/right for a directional dodge or jump/down (without left/right) for vertical movement. Neutral air dodges stall briefly. Dodges do not restore jumps or aerial recovery.
- 3D and fallback 2D animations use the same contact-timed wind-up, whip, follow-through and settle phases. 3D fighters now have speed-matched gait, shoulder/hip counter-rotation, head lag, impact squash, foot bracing, and a tucked dodge roll. These are **visual-only** pose updates; existing hitboxes and weapon balance are unchanged.
- Coyote time, buffered attacks, and preserved air momentum keep movement responsive.
- Movement is tuned for flow: variable jump height (release jump to cut it short), a brief apex hang, hold-down fast-fall, turn-around acceleration, and smooth knockback decay with directional influence (hold a direction while launched to steer).
- A gently eased camera drifts toward the action, and 3D fighters blend between poses and pivot to face their rival instead of snapping, so exchanges read smoothly at any refresh rate.

### Character stats

Each fighter is rated 1-10 on six stats, with 5 as the neutral baseline: Strength (damage dealt), Speed (movement), Health (damage pool), Defense (damage and knockback absorbed), Recovery (attack cooldowns), and Reach (hitbox size).

Twenty-five fighters span five archetypes:

| Archetype      | Examples       | Shape                                      |
| -------------- | -------------- | ------------------------------------------ |
| Glass Cannon   | Ronin, Nyx     | Huge damage, shallow health                |
| Speedster      | Vex, Azir      | Fastest movement and recovery              |
| Heavy Strength | Brakk, Baron   | Slow, but each clean hit decides exchanges |
| Heavy Defense  | Fenrir, Warden | Deep health, barely moved by knockback     |
| Zoner          | Lyra, Orion    | Longest reach, weakest up close            |

### Arenas

| Arena        | Layout                           | Hazard                                     |
| ------------ | -------------------------------- | ------------------------------------------ |
| The Fracture | Main deck, two side ledges       | None. Pure fundamentals.                   |
| Skyforge     | One broad deck, tight blast zone | Wind gusts carry fighters toward the edge  |
| Ember Depths | Stacked tower over magma         | The melt scorches anyone who falls too far |
| Neon Sprawl  | Rooftops plus a sliding platform | One platform drifts back and forth         |
| Frozen Spire | Ice shelves                      | Low traction, so every dash overshoots     |

### Scoring and persistence

- Damage earns 10 points per point dealt, successive combo hits add bonuses, knockouts earn 500, and winning earns 1,000.
- The top ten scores and all settings persist on the current device. Local duels record both players.

### CPU difficulty

Five tiers — Novice, Rookie, Rival, Veteran, Legend — each tune reaction time, aggression, dodge rate, directional precision, special usage, edge-guarding, follow-up pressure, movement speed, and idle time. Higher tiers also recover from launches and chase ring-out opportunities.

## Controls

| Action                                | Player 1     | Player 2            |
| ------------------------------------- | ------------ | ------------------- |
| Move                                  | A / D        | Left / Right        |
| Jump / triple jump                    | W or Space   | Up                  |
| Air recovery (once before landing)    | I            | 4 or Numpad 4       |
| Hold to channel signature             | U            | 5 or Numpad 5       |
| Drop through platform                 | Hold S       | Hold Down           |
| Neutral attack                        | J            | 1 or Numpad 1       |
| Side attack                           | Hold A/D + J | Hold Left/Right + 1 |
| Down attack                           | Hold S + J   | Hold Down + 1       |
| Heavy versions of the above           | K            | 2 or Numpad 2       |
| Special                               | L            | 3 or Numpad 3       |
| Ground / air dodge                    | Left Shift   | Right Shift         |
| Swap weapon                           | Q            | 0 or Numpad 0       |
| Pause / resume                        | Escape or P  | Escape or P         |
| Restart while paused or after a match | R            | R                   |

Hold left/right or down while pressing light/heavy in the air to use air-side or air-down attacks; no direction uses air-neutral. Recovery is separate from the charged signature move and does not use its meter. Ground and air dodge share a two-second cooldown; only the first 0.18 seconds of the 0.30-second motion are invulnerable. Hold a direction while dodging in the air, or use neutral dodge to briefly stall. Touch controls include Charge and Recover buttons and a full directional pad, plus a second control set for local duels. Landscape offers the widest view. Fullscreen, sound effects, and screen shake are optional.

## Verify

```sh
npx tsc --noEmit
npm run build
npx playwright install --with-deps chromium
# With the development server running on port 5173:
npx playwright test --workers=1
```

The browser tests cover keyboard and touch input, matches, configurable stock/time rules and timeout tiebreaks, restart, pause, score persistence, 25 fighters and 13 weapons, directional attacks, stat-driven damage and knockback, five arenas and CPU tiers, responsive layouts, fullscreen, and rendering cadence on desktop and mobile. `tests/attack-animation.spec.mjs` additionally checks startup, active swing, and recovery curves for all 156 light/heavy attack variants.

## Structure

- `src/App.tsx`: lobby, roster, stat readouts, settings, arena picker, help, and local leaderboard.
- `src/components/GameView.tsx`: canvas integration, HUD, touch controls, pause, and results.
- `src/game/engine.ts`: fixed 60 Hz physics with render interpolation, combat, projectiles, stage hazards, stocks, match clock, and CPU decisions.
- `src/game/attackAnimation.ts`: shared, render-only timing and pose blending for ordinary attack wind-up, hit, and recovery across 3D and 2D.
- `src/game/moves.ts`: all 78 directional moves with hitboxes, knockback, hitstun, and animation data, plus heavy derivation.
- `src/game/threeRenderer.ts`: articulated 3D fighters with textured skin, cloth, and armor, procedural surface detail, lighting, and a WebGL fallback.
- `src/game/fighterArt.ts`: fallback character rendering.
- `src/game/renderer.ts`: arena rendering, hazards, particles, and hit effects.
- `src/game/data.ts`: 25 fighters with stats and archetypes, five stages, five CPU profiles, weapon balance, match rules, and storage helpers.
- `src/game/audio.ts`: lightweight synthesized Web Audio effects, voiced per weapon type.
- `public/images/`: generated character and arena artwork.
- `public/fonts/`: locally hosted open-source fonts and their licenses.

Fonts: Barlow Condensed, Inter, and Space Grotesk, distributed under the SIL Open Font License. Sound effects are synthesized at runtime; no audio assets or external connections are needed.
