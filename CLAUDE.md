# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A small, old-school-flavored MMORPG (EverQuest/RuneScape/WoW-inspired), built as a learning
side project by a professional software engineer with no prior game-dev experience. Currently
v0: single-player only, a starting town with rats to kill, character creation, leveling, gear,
and local save/load. Full long-term vision is in `docs/design.txt` (multiplayer, more zones,
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
```

Run a single test file: `npx vitest run tests/systems/CombatSystem.test.ts`
Run tests matching a name: `npx vitest run -t "isCooldownReady"`

There is no CI config in this repo — `lint`, `typecheck`, and `test` are the gates to run
manually before considering a change done.

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
existing save and routes straight to `Town`, else to `CharacterCreate`) → `CharacterCreate`
(builds a `CharacterState` and saves it) → `Town` (the gameplay scene) with `UI` launched
alongside it as a parallel HUD scene.

**Scene-to-scene communication** goes through `this.game.events` (a global Phaser event emitter),
not direct references between scenes — see `src/ui/uiEvents.ts` for the event name constants
(`target-selected`, `xp-gained`, `level-up`, `move-vector`, etc.). `TownScene` owns gameplay
state and emits events; `UIScene` only listens and renders. Add new HUD-facing state changes by
adding an event constant and emitting/listening to it, not by reaching into the other scene.

**Entities** (`src/entities/`): `Player` and `Rat` (extends the shared `Mob` base) are
`Phaser.Physics.Arcade.Sprite` subclasses. `Mob` handles wander AI, HP, death/respawn timers.
Combat math itself (damage rolls, range/cooldown checks) is _not_ on these classes — it lives in
`systems/CombatSystem.ts` and is called from `TownScene.updateCombat()`.

**Persistence** (`src/persistence/`): `SaveService` is an interface; `LocalStorageSaveService` is
the only implementation today. Always import the `saveService` singleton from
`src/persistence/index.ts` rather than constructing `LocalStorageSaveService` directly — that
indirection is the intended swap point for a future networked backend. `CharacterState` has a
`version` field (`CHARACTER_STATE_VERSION`) for future migrations; bump it if you change the
shape in a way that breaks old saves.

**Data-driven definitions** (`src/data/`): class stats (`classes.ts`), items/gear
(`items.ts`), the XP curve (`xpTable.ts`), and the town tilemap layout (`townMap.ts`) are plain
data tables keyed by id. `types/ids.ts` holds the id unions (`ClassId`, `GearSlotId`) that key
into them. Prefer adding a row to one of these tables over hardcoding values in a scene/entity.

**Textures are generated procedurally at runtime** (`src/scenes/generateTextures.ts`) using
Phaser's `Graphics.generateTexture`, not loaded from image files — there are no art assets yet
(placeholder circles/shapes only, per the "no art skills" constraint in `docs/design.txt`).

## Conventions

- Prettier is the source of truth for formatting (single quotes, semicolons, trailing commas,
  100-char width) — run `npm run format` rather than hand-wrapping lines.
- `noUnusedLocals`/`noUnusedParameters`/`erasableSyntaxOnly` are enabled in `tsconfig.json`; the
  build (`tsc && vite build`) fails on unused code, so don't leave it behind.
- Comments in this codebase are used sparingly and only to explain non-obvious _why_ (see
  existing examples like the version-swap note in `persistence/index.ts` or the tileset note in
  `generateTextures.ts`) — match that style rather than narrating what code does.
