# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A small, old-school-flavored MMORPG (EverQuest/RuneScape/WoW-inspired), built as a learning
side project by a professional software engineer with no prior game-dev experience. Currently
v1: single-player only; three zones (town with leveled rats and a shop, a beach with crabs and
ocean fishing, a bandit camp with aggressive humanoids); character creation, leveling, gear,
two-way combat with death and respawn; gathering/cooking skills; currency and vendoring;
a weight-limited pack; two collection quests from the shopkeeper; an AFK camping mode that
also pays out offline; click/tap-to-move with a mobile-first HUD; and local save/load with
versioned migrations. All three zones are level 1-3 starter content — what separates them is
what they drop, not how hard they are.
Per-feature briefs live in `docs/feature_N_*.txt`. Full long-term vision is in
`docs/initial_design.txt` (multiplayer, more zones, more skills) — most of it is intentionally
not built yet, so don't assume features from that doc exist in code.

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

CI runs on every PR (`.github/workflows/ci.yml`): `gates (node 22)` and `gates (node 25)` run
lint/typecheck/test on both Node versions, and `browser smoke` runs the real Playwright check.
**The smoke job blocks merges**, so run `npm run smoke` locally before opening a PR rather than
finding out from CI. Don't commit on a red suite, including failures that pre-date your change;
fixing a broken test _environment_ is in scope, not a distraction.

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

**Reproducing a smoke failure that only happens on CI.** The runner steps the game far slower
than a dev machine — 7fps has been seen — and frame-rate-dependent bugs hide there. Don't guess
across CI cycles: copy `scripts/smoke.mjs` into `scripts/` under another name (it has to stay in
that directory so `playwright` resolves), add CPU throttling after the page is created, and run
it with `node`.

```js
const client = await page.context().newCDPSession(page);
await client.send('Emulation.setCPUThrottlingRate', { rate: 8 });
```

A rate of 8 lands around 20fps and reproduced the last such bug every run. Iterating that way
takes seconds instead of three minutes a guess. Delete the copy when you're done.

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
`scene.restart({ zoneId })`, and the `UI` scene stays running across it. Each exit spawns a
tappable `ZoneSignpost` (the mobile path — the invisible edge-walk band is untappably thin on
a phone); walking into the map edge still transitions too, for keyboards. Both are pure math
in `systems/ZoneSystem.ts`. A new area should be a `ZONES` row (plus exits both ways), not a
new scene class.

**The HUD is a bottom tab bar plus sheets** (`scenes/UIScene.ts`, `ui/TabBar.ts`). Char / Bag /
Quests / Log open one sheet at a time — the model holds a single `openSheet`, not a visible flag per
panel — while Camp and the gear icon are actions that open nothing. Layout arithmetic lives in the
Phaser-free `ui/layout.ts` and is unit-tested at real viewport sizes; put new HUD geometry there
rather than inline in the scene. The breakpoint keys on **height as well as width**, because a
landscape phone (844x390) is wide by any measure and has less vertical room than a portrait one.
`ui/Button.ts` and `ui/Panel.ts` are the shared chrome — use them rather than hand-rolling a
rectangle, a label and a hit area again.

**Nothing in the world may be drawn under the tab bar.** The bar is opaque and swallows every tap
that lands on it, so `ZoneScene.applyCameraZoom` shrinks the world camera's viewport to stop at
`worldViewportHeight()`. This is not decoration: the south signpost in town rendered four pixels
inside the bar on a portrait phone and could not be tapped at all. If you add bottom furniture,
reserve its height there rather than hoping nothing important lands in the last sixty pixels.

**Scene-to-scene communication** goes through `this.game.events` (a global Phaser event emitter),
not direct references between scenes — see `src/ui/uiEvents.ts` for the event name constants
(`target-selected`, `xp-gained`, `level-up`, `equip-item-requested`, etc.). `ZoneScene` owns gameplay
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
to full_ on its way back to spawn. Enemies with `aggressive: true` and an `aggroRadius` engage
on their own when a wandering mob sees the player inside that radius (bandits); passive enemies
only ever retaliate. Both leashing (running past `leashRadius`) and player death
route through `disengage()`, so a fight always restarts from a clean slate — reuse it rather than
resetting mob state by hand. `Mob.update()` takes the player's position, since chasing needs it.

**Persistence** (`src/persistence/`): `SaveService` is an interface; `LocalStorageSaveService` is
the only implementation today. Always import the `saveService` singleton from
`src/persistence/index.ts` rather than constructing `LocalStorageSaveService` directly — that
indirection is the intended swap point for a future networked backend. `CharacterState` carries a
`version` field: when you change the shape, bump `CHARACTER_STATE_VERSION` and add a step to
`persistence/migrations.ts` so existing saves upgrade on load instead of being wiped — a save
with no chain of steps to the current version is dropped.

**Data-driven definitions** (`src/data/`): class stats (`classes.ts`), items/gear (`items.ts`),
enemy definitions (`enemies.ts`), where and at what level they spawn (`spawns.ts`), loot
(`lootTables.ts`), quests (`quests.ts`), the XP curve (`xpTable.ts`), zones (`zones.ts`), and the
tilemap layouts (`tiles.ts`, `townMap.ts`) are plain data tables keyed by id. `types/ids.ts` holds
the id unions (`ClassId`, `GearSlotId`, `EnemyId`, `ZoneId`, `QuestId`) that key into them. Prefer
adding a row to one of these tables over hardcoding values in a scene/entity — a new enemy type
should be an `ENEMIES` row plus a loot table, not a new `Mob` subclass with numbers baked in.

**Only humanoids drop gear and coin.** `EnemyDefinition.family` is `beast | humanoid`, and it is
what decides what a loot table may hold — the rule is enforced over `ENEMIES` and `LOOT_TABLES` by
a test rather than by construction, since the tables are hand-written. It is also the thing that
makes three same-level zones worth visiting: rats give quest parts, crabs give food, bandits give
gear and coin. The bandit table carries **both** armor types on purpose; cloth is otherwise
shop-only, which left a wizard unable to wear anything the world dropped.

**Quest progress is derived, not tracked** (`systems/QuestSystem.ts`). `CharacterState.quests` holds
only `active | done` per quest; how far along a "bring me N of X" objective is gets counted off the
inventory on read. Items reach the bag from loot, gathering, cooking, buying and offline camping,
and counting on read means none of those paths can forget to bump a counter. `turnInQuest` on
`CharacterController` refuses as a whole rather than half-applying — taking the objective and
finding no room for the reward is the one outcome that can't be undone.

**Acquiring an item can fail.** The pack has a weight limit (`systems/EncumbranceSystem.ts`,
capacity from strength), so gathering, loot and buying all go through
`CharacterController.tryAddItem`, which adds nothing and returns false when the pack is full.
Use it rather than `addItem` for anything the world hands the player, and handle the refusal —
a full pack is what ends an unattended gathering session. Currency is weightless and never fails.

**Frame rate is not an assumption you may make.** A loaded CI runner or a cheap phone steps the
game at single-digit fps, where one frame carries the player ~46px. Anything comparing a distance
against a fixed threshold has to scale that threshold with the frame's travel — see
`arriveRadius` in `systems/MovementSystem.ts`, which exists because a fixed 8px arrival band left
the player orbiting a tap destination forever below 30fps. Note also that returning a velocity
above normal speed to "land exactly" does not work: Phaser integrates velocity over the physics
world's own timestep, not over the `delta` handed to the scene, and the mismatch shows up as an
overshoot.

**AFK play must stay behind active play** (`systems/AfkSystem.ts`, `systems/OfflineAfkSystem.ts`).
Two mechanisms hold that, and both matter: the AFK loop never uses an ability, so the action bar
is an advantage only a real player gets, and `awardXp` halves what it earns. Offline progress
accrues only from a session parked with the toggle, and is capped at **one level per session** —
a per-kill rate alone is not safe, since eight hours in the richest zone out-earned the entire
level 1-10 curve several times over. Keep that cap if you add a zone or change the XP curve.
The camp penalty is for XP a character earns unattended, so a quest reward goes through
`ZoneScene.publishXpGain` rather than `awardXp` — handing a quest in is something the player did.

**Levels scale both sides.** Enemies carry a `level` and derive HP/damage/XP from
`base + perLevel` via `scaleEnemyStats()`; characters grow through `perLevel` on their class and
`computeEffectiveStats(classId, gear, level)`. Keep those in step — making enemies tougher
without giving characters growth (or vice versa) silently breaks the difficulty curve. Enemy
name colors come from `conColor()` in `systems/EnemySystem.ts`: gray/green below the player,
white even, yellow +1, red +2 and up. With every zone in the 1-3 band that spans only three
shades today — expected, not a bug, and it comes back the moment a higher zone is added.

Combat tuning is deliberate, not arbitrary: a fresh level 1 character should beat a level 1 rat
comfortably, sweat against a level 2, and lose to a level 3. If you change class stats, weapon
bonuses, or enemy growth, re-check that curve — simulating duels across the level range is much
faster than playing it. Crabs are long fights rather than dangerous ones; the bandit camp is
gated on gear rather than on level, which is the point given it is where gear comes from.

**Pacing is held by a simulation, not by judgement** (`tests/systems/progression.test.ts`). It
walks the arc the two quests push a player down — rat kills for the bones, fish cooked to open the
crab recipe, crab kills and cooks for the feast, bandit kills for an armour set — and asserts it
ends on level 3. Change `xpTable.ts`, a drop chance, a quest objective or the burn rate and this
is the test that moves; retune until it passes rather than eyeballing the curve.

Auto-attack **range comes from the equipped weapon, not the class** (`weaponAttackRange` in
`data/items.ts`): a weapon may name an `attackRange`, anything that doesn't is melee, and empty
hands are shorter still. Abilities carry their own ranges, so a caster's reach is the spell
rather than the class. `Player.applyStats()` has to reassign `attackRange` alongside the other
stats or a weapon swap won't change reach until the scene rebuilds.

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
