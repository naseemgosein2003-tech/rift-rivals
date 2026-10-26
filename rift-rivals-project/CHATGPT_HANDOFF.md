# Rift Rivals — ChatGPT / Codex Handoff

Continue this existing project. Do **not** rebuild it from scratch. First inspect the repository and preserve the current architecture, gameplay balance, tests, assets, and visual style unless a requested change requires otherwise.

## Project summary

**Rift Rivals** is a browser-based 1v1 platform fighter inspired by Brawlhalla.

- React 19 + TypeScript + Vite + Tailwind CSS v4
- Canvas 2D stages/effects with Three.js 3D fighters and weapons
- 2D character fallback if WebGL is unavailable
- Fixed 60 Hz combat simulation
- Local storage for settings and leaderboard scores
- No backend or account system

## Current feature set

- 25 playable fighters, each with a unique two-weapon combination
- 13 weapons and 78 directional moves (light/heavy variants included)
- Weapon swapping during fights
- Three jumps plus one separate air-recovery move per airtime
- Ground and air dodge sharing a two-second cooldown
- Five CPU difficulty tiers plus local two-player mode
- Five arenas, pre-match map voting, tied-vote resolution, and Random Map
- Match customization: 1, 2, 3, 5, or 7 stocks; optional 2, 3, 5, 8, or 10-minute timer
- Character stats and archetypes affecting damage, speed, health, defense, recovery, and reach
- Weapon-weight and missing-health knockback scaling
- Five-stage pre-match flow: fighter select → arena vote → countdown → match
- Signature moves charged by dealing damage or holding the charge input
- Manual signature charging roots the fighter, prevents attacks/dodges, and applies 35% extra incoming damage
- Every signature has unique animation, signature stun, and a 0.50-second dodge window
- Direction-aware combat animations for ordinary attacks in both the 3D rig and 2D fallback: startup anticipation, hit-window swings, recoil and recovery, footwork, and momentum, all cosmetic and using the existing move timing
- Ordinary ranged weapons expire at their weapon range; signature projectiles have separate finite reach
- Pause, instant rematch, results, settings, and local top-10 leaderboard

## Important files

- `src/App.tsx` — lobby, roster, settings, pre-match arena vote, help, leaderboard
- `src/components/GameView.tsx` — game screen, HUD, keyboard/touch input, pause/results
- `src/components/UI.tsx` — shared UI, portraits, weapon icons, dialogs
- `src/game/engine.ts` — physics, combat, stocks, timer, signatures, projectiles, AI
- `src/game/data.ts` — fighters, weapons, stages, settings, stats, AI profiles
- `src/game/moves.ts` — directional move definitions and heavy variants
- `src/game/attackAnimation.ts` — shared render-only attack animation phases and pose blending
- `src/game/threeRenderer.ts` — Three.js 3D fighters, weapons, animation, lighting
- `src/game/renderer.ts` — stage rendering, particles, effects, 3D compositing
- `src/game/fighterArt.ts` — fallback 2D fighters and signature effects
- `src/game/audio.ts` — synthesized sound effects
- `src/index.css` — full UI styling and responsive layouts
- `public/images/` — roster and stage artwork
- `tests/game.spec.mjs` — Playwright end-to-end and mechanics tests
- `tests/attack-animation.spec.mjs` — render-animation timing tests across all 156 light/heavy weapon-and-stance combinations
- `README.md` — player-facing controls and project documentation

## Commands

Install dependencies:

```sh
npm install
```

Run locally:

```sh
npm run dev
```

Type-check:

```sh
npx tsc --noEmit
```

Production build:

```sh
npm run build
```

Run browser tests with the dev server running at `http://localhost:5173`:

```sh
npx playwright install --with-deps chromium
npx playwright test tests/game.spec.mjs --workers=1
```

Baseline before animation update: TypeScript, production build, and 23 Playwright tests passed (as reported by the original handoff).

Animation update verification: TypeScript syntax/transpilation checks pass for the changed modules, and a Node smoke check of all 156 attack timing variants passes. The new Playwright test has not run. Full `tsc`, Vite build, and Playwright E2E verification could not run in the update environment because npm dependencies could not be fetched or installed. Re-run the commands after `npm install` on a network-connected machine.

## Working rules for the next assistant

1. Inspect the relevant files before editing.
2. Make focused changes and preserve existing public behavior unless requested.
3. When changing balance or controls, update the in-game help and README where appropriate.
4. Add or update Playwright coverage for gameplay-rule changes.
5. Run `npx tsc --noEmit`, `npm run build`, and relevant Playwright tests before declaring completion.
6. Do not delete generated artwork or rewrite the game engine unnecessarily.
7. Keep desktop and mobile layouts free of horizontal overflow.
8. Preserve the dark navy/charcoal visual theme with restrained orange accents.

## Suggested continuation prompt

> Continue developing the existing Rift Rivals project in this repository. Read `CHATGPT_HANDOFF.md` and `README.md` first, inspect the relevant source files, and do not rebuild the project from scratch. Preserve the current architecture and visual style. Implement the change I describe next, update tests and documentation where needed, then run TypeScript, the production build, and relevant Playwright tests before summarizing the result.
