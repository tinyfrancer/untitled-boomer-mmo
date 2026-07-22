# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A small, old-school-flavored MMORPG (EverQuest/RuneScape/WoW-inspired), built as a learning
side project by a professional software engineer with no prior game-dev experience. Currently
v0: single-player only, a starting town with leveled rats to kill, character creation, leveling,
gear, two-way combat with death and respawn, and local save/load. Per-feature briefs live in
`docs/feature_N_*.txt`. Full long-term vision is in `docs/initial_design.txt` (multiplayer, more zones,
skills like fishing, etc.) — most of it is intentionally not built yet, so don't assume features
from that doc exist in code.

## Commands

```bash
npm run dev        # Vite dev server with hot reload (http://localhost:5173)
npm run dev -- --host   # expose on LAN, for testing on a phone
npm run build       # tsc typecheck + production build to dist/
npm run preview     # serve the production build locally
npm run test        # run the full Vitest suite once
npm run typecheck   # tsc --noEmit
npm run lint        # ESLint
npm run format       # Prettier --write
npm run smoke       # browser smoke check (needs `npm run dev` running in another shell)
```

Run a single test file: `npx vitest run tests/systems/CombatSystem.test.ts`
Run tests matching a name: `npx vitest run -t "isCooldownReady"`

There is no CI config in this repo yet — `lint`, `typecheck`, and `test` are the gates to run
manually before considering a change done. Don't commit on a red suite, including failures that
pre-date your change; fixing a broken test _environment_ is in scope, not a distraction.

## Workflow

Work happens on a feature branch and merges through a pull request — never commit directly to
`main`, even for a one-line doc fix. Branch before the first commit, and open the PR with
`gh pr create`. This is deliberate practice on a repo that could get away without it, so "too
small for a PR" isn't a reason to skip it.

Keep commits separable when a change has genuinely independent parts (a test-environment fix, the
feature itself, docs) — PRs here are merged with a merge commit rather than squashed, so that
structure survives in history and stays reviewable later.

Merging to `main` triggers a Vercel production deploy, so a merge publishes.

## Verifying gameplay changes

The unit suite only covers Phaser-free modules, so it can't tell you whether the game actually
runs. `scripts/smoke.mjs` (Playwright + headless Chromium) drives the real dev server and asserts
on live scene state — scenes booting, mobs engaging and leashing, player death resetting the
world. Reach for it whenever a change touches a scene, an entity, or the AI, and add a check
there rather than trying to unit-test Phaser. Screenshots land in gitignored `.smoke/`.

It works because `src/main.ts` puts the `Phaser.Game` instance on `window.game` behind an
`import.meta.env.DEV` guard (Vite strips it from production builds). That handle is also the way
to inspect live state from the devtools console: `game.scene.getScene('Zone').mobs`.

Two environment notes that will otherwise waste your time:

- **`tests/setup.ts` installs an in-memory `Storage`.** Node defines its own `localStorage`
  global that vitest's jsdom environment leaves as an unusable stub, which broke every
  persistence test with `localStorage.clear is not a function`. Don't delete that setup file, and
  don't "fix" `LocalStorageSaveService` to work around it — the source was never the problem.
- **The first `npm run dev` request cold-compiles all of Phaser** (~1.2 MB) and can take far
  longer than a normal page load, so browser waits need generous timeouts on a cold cache.

## Architecture

**Stack**: TypeScript + Phaser 3 (2D game framework), bundled with Vite. No backend — everything
is a static site. Character data lives in the browser's `localStorage`.

**The core seam: Phaser-free vs. Phaser-coupled code.** `systems/`, `data/`, `persistence/`,
and `types/` contain plain TypeScript with no Phaser imports. This is deliberate — it's what
makes them unit-testable with Vitest (no game engine to mock) and is the same boundary that
would let a real backend swap in later without touching game logic. When adding game logic,
default to putting the math/rules in one of these Phaser-free modules and call it from a scene
or entity, rather than inlining logic into a Scene or a Phaser.GameObjects subclass. Tests in
`tests/` mirror this split (`tests/systems/`, `tests/persistence/`) and test only these modules.

**Scene flow** (registered in `src/main.ts`, one `Phaser.Game` instance):
`Boot` → `Preload` (generates placeholder textures at runtime, no image assets; loads any
existing save and routes straight to `Zone`, else to `CharacterCreate`) → `CharacterCreate`
(builds a `CharacterState` and saves it) → `Zone` (the gameplay scene) with `UI` launched
alongside it as a parallel HUD scene.

**Zones**: the world is a set of zones defined in `src/data/zones.ts` (map grid, mob spawns,
node spawns, exits), all played through the single `ZoneScene` — a zone change is
`scene.restart({ zoneId })`, and the `UI` scene stays running across it. Edge-walk transitions
are pure math in `systems/ZoneSystem.ts`. A new area should be a `ZONES` row (plus exits both
ways), not a new scene class.

**Scene-to-scene communication** goes through `this.game.events` (a global Phaser event emitter),
not direct references between scenes — see `src/ui/uiEvents.ts` for the event name constants
(`target-selected`, `xp-gained`, `level-up`, `move-vector`, etc.). `ZoneScene` owns gameplay
state and emits events; `UIScene` only listens and renders. Mutations of `CharacterState`
itself (inventory, gear, xp, skills, location) go through the Phaser-free
`systems/CharacterController.ts` rather than being inlined in the scene. Add new HUD-facing state changes by
adding an event constant and emitting/listening to it, not by reaching into the other scene. An
event carrying more than two or three values should pass one object (see `TargetInfo` in
`uiEvents.ts`) rather than growing a positional argument list.

**Entities** (`src/entities/`): `Player` and `Mob` are `Phaser.Physics.Arcade.Sprite`
subclasses. `Mob` is instantiated directly from an `ENEMIES` definition (no per-enemy
subclasses) and owns HP, death/respawn timers, and a `wander | chase | returning` AI state
machine. Combat math itself (damage rolls, range/cooldown checks) is _not_ on these classes —
it lives in `systems/CombatSystem.ts` and is called from `ZoneScene`, which resolves both
directions: `updateCombat()` for the player's swings and `updateEnemyAttacks()` for everything
hitting back.

**Aggro contract**: `Mob.engage()` starts a chase, `disengage()` drops aggro _and heals the mob
to full_ on its way back to spawn. Both leashing (running past `leashRadius`) and player death
route through `disengage()`, so a fight always restarts from a clean slate — reuse it rather than
resetting mob state by hand. `Mob.update()` takes the player's position, since chasing needs it.

**Persistence** (`src/persistence/`): `SaveService` is an interface; `LocalStorageSaveService` is
the only implementation today. Always import the `saveService` singleton from
`src/persistence/index.ts` rather than constructing `LocalStorageSaveService` directly — that
indirection is the intended swap point for a future networked backend. `CharacterState` has a
`version` field (`CHARACTER_STATE_VERSION`) for future migrations; bump it if you change the
shape in a way that breaks old saves.

**Data-driven definitions** (`src/data/`): class stats (`classes.ts`), items/gear (`items.ts`),
enemy definitions (`enemies.ts`), where and at what level they spawn (`spawns.ts`), loot
(`lootTables.ts`), the XP curve (`xpTable.ts`), zones (`zones.ts`), and the tilemap layouts
(`tiles.ts`, `townMap.ts`) are plain data tables keyed by id. `types/ids.ts` holds the id
unions (`ClassId`, `GearSlotId`, `EnemyId`, `ZoneId`) that key into them. Prefer adding a row to one of these tables over hardcoding values
in a scene/entity — a new enemy type should be an `ENEMIES` row plus a loot table, not a new
`Mob` subclass with numbers baked in.

**Levels scale both sides.** Enemies carry a `level` and derive HP/damage/XP from
`base + perLevel` via `scaleEnemyStats()`; characters grow through `perLevel` on their class and
`computeEffectiveStats(classId, gear, level)`. Keep those in step — making enemies tougher
without giving characters growth (or vice versa) silently breaks the difficulty curve. Enemy
name colors come from `conColor()` in `systems/EnemySystem.ts`: gray/green below the player,
white even, yellow +1, red +2 and up.

Combat tuning is deliberate, not arbitrary: a fresh level 1 character should beat a level 1 rat
comfortably, sweat against a level 2, and lose to a level 3. If you change class stats, weapon
bonuses, or enemy growth, re-check that curve — simulating duels across the level range is much
faster than playing it.

**Textures are generated procedurally at runtime** (`src/scenes/generateTextures.ts`) using
Phaser's `Graphics.generateTexture`, not loaded from image files — there are no art assets yet
(placeholder circles/shapes only, per the "no art skills" constraint in `docs/initial_design.txt`).

## Conventions

- Prettier is the source of truth for formatting (single quotes, semicolons, trailing commas,
  100-char width) — run `npm run format` rather than hand-wrapping lines.
- `noUnusedLocals`/`noUnusedParameters`/`erasableSyntaxOnly` are enabled in `tsconfig.json`; the
  build (`tsc && vite build`) fails on unused code, so don't leave it behind.
- Comments in this codebase are used sparingly and only to explain non-obvious _why_ (see
  existing examples like the version-swap note in `persistence/index.ts` or the tileset note in
  `generateTextures.ts`) — match that style rather than narrating what code does.
