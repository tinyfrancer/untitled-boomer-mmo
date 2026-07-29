# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A small, old-school-flavored MMORPG (EverQuest/RuneScape/WoW-inspired), built as a learning
side project by a professional software engineer with no prior game-dev experience. Currently
v1: single-player only; three zones (town with leveled rats and a shop, a beach with crabs and
ocean fishing, a bandit camp with aggressive humanoids); character creation, leveling, gear,
two-way combat with death and respawn; gathering/cooking skills; currency and vendoring;
a weight-limited pack; two collection quests from the shopkeeper; slayer achievements and the
titles they grant; an AFK camping mode that also pays out offline; click/tap-to-move with a
mobile-first HUD; and local save/load with versioned migrations. All three zones are level 1-3 starter content — what separates them is
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

**Stack**: TypeScript + Phaser 4 (2D game framework), bundled with Vite. No backend — everything
is a static site. Character data lives in the browser's `localStorage`.

**The core seam: Phaser-free vs. Phaser-coupled code.** `systems/`, `data/`, `persistence/`,
`types/` and `config/` contain plain TypeScript with no Phaser imports. This is deliberate — it's
what makes them unit-testable with Vitest (no game engine to mock) and is the same boundary that
would let a real backend swap in later without touching game logic. When adding game logic,
default to putting the math/rules in one of these Phaser-free modules and call it from a scene
or entity, rather than inlining logic into a Scene or a Phaser.GameObjects subclass. Tests in
`tests/` mirror this split (`tests/systems/`, `tests/persistence/`) and test only these modules.
The rule is enforced, not just documented: `tests/architecture/phaserFreeSeam.test.ts` reads every
file under those five directories and fails on an `import` of `phaser`.

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
Quests / Feats / Log open one sheet at a time — the model holds a single `openSheet`, not a visible
flag per panel — while Camp and the gear icon are actions that open nothing. Layout arithmetic lives
in the Phaser-free `ui/layout.ts` and is unit-tested at real viewport sizes; put new HUD geometry
there rather than inline in the scene. The breakpoint keys on **height as well as width**, because a
landscape phone (844x390) is wide by any measure and has less vertical room than a portrait one.
`ui/Button.ts` and `ui/Panel.ts` are the shared chrome — use them rather than hand-rolling a
rectangle, a label and a hit area again.

**The tab bar is full.** It splits its width evenly across seven tabs, which on a 375px phone is
44.4px each against a `THEME.touchMin` of 44 — four tenths of a pixel of headroom, and under the
minimum below ~372px. An eighth tab does not fit; fold new surfaces into an existing sheet, or
change how the bar lays out. Labels have to stay short for the same reason ("Quests" is the longest
that fits). `npm run smoke` measures the rendered hit areas at 375px rather than trusting the
arithmetic, so this fails the build rather than shipping an untappable button.

**Nothing in the world may be drawn under the tab bar.** The bar is opaque and swallows every tap
that lands on it, so `ZoneScene.applyCameraZoom` shrinks the world camera's viewport to stop at
`worldViewportHeight()`. This is not decoration: the south signpost in town rendered four pixels
inside the bar on a portrait phone and could not be tapped at all. If you add bottom furniture,
reserve its height there rather than hoping nothing important lands in the last sixty pixels.

**Clip a scrolling sheet with `ui/clipToMask.ts`, never `createGeometryMask()` directly.** Phaser 4
made geometry masks Canvas-only, and the API did not go away with them: under WebGL — which is what
`Phaser.AUTO` picks — `setMask(g.createGeometryMask())` still typechecks, still runs, and silently
clips nothing, so the bag's overflowing rows draw down over the world. `clipToMask` picks per
renderer, using the Mask filter on WebGL and the geometry mask on the Canvas path `Phaser.AUTO` can
still fall back to. Two traps if you touch it: `filters` is `null` until `enableFilters()` is
called, so `filters?.internal.addMask(...)` no-ops silently and reproduces the original bug; and
`autoUpdate` has to be set or the clip freezes at whatever rect the first frame drew.
`npm run smoke` asserts a clip is installed for the live renderer, because this failure is
invisible to every other kind of test — a full green suite is what it looked like the first time.

**Scene-to-scene communication** goes through `this.game.events` (a global Phaser event emitter),
not direct references between scenes — see `src/ui/uiEvents.ts` for the event name constants
(`target-selected`, `xp-gained`, `level-up`, `equip-item-requested`, etc.). `ZoneScene` owns gameplay
state and emits events; `UIScene` only listens and renders. Mutations of `CharacterState`
itself (inventory, gear, xp, skills, location) go through the Phaser-free
`systems/CharacterController.ts` rather than being inlined in the scene. Add new HUD-facing state changes by
adding an event constant and emitting/listening to it, not by reaching into the other scene. An
event carrying more than two or three values should pass one object (see `TargetInfo` in
`uiEvents.ts`) rather than growing a positional argument list.

**Entities** (`src/entities/`): `Mob` and `ResourceNode` are still `Phaser.Physics.Arcade.Sprite`
subclasses; **`Player` is not** — it is a plain `Phaser.GameObjects.Sprite` that owns `{x, y, vx,
vy}` and integrates itself each frame against the Phaser-free `systems/CollisionSystem.ts`.
Transform ownership and integration ownership are the same thing (arcade writes body position
every physics step, and `moves = false` disables separation too), so entities come off arcade one
at a time rather than in halves. `Mob` is instantiated directly from an `ENEMIES` definition (no per-enemy
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

`CharacterState.position` is **honoured on load**: a save resumes at the spot it names, and only
when `zoneId` matches the zone being entered. `null` means "no particular spot" — a new character,
or one who owes a respawn — and the zone puts them at its default spawn (the middle of the map)
instead. Walking through an exit records the arrival point in the zone being _entered_, not the
spot being left, so the pair is never self-contradictory; keep it that way if you add another way
to change zones. Only smoke can check any of this, and it does.

**Data-driven definitions** (`src/data/`): class stats (`classes.ts`), items/gear (`items.ts`),
enemy definitions (`enemies.ts`), where and at what level they spawn (`spawns.ts`), loot
(`lootTables.ts`), quests (`quests.ts`), the XP curve (`xpTable.ts`), zones (`zones.ts`), and the
tilemap layouts (`tiles.ts`, `townMap.ts`) are plain data tables keyed by id. `types/ids.ts` holds
the id unions (`ClassId`, `GearSlotId`, `EnemyId`, `ZoneId`, `QuestId`, `AchievementId`,
`TitleId`) that key into them. Prefer
adding a row to one of these tables over hardcoding values in a scene/entity — a new enemy type
should be an `ENEMIES` row plus a loot table, not a new `Mob` subclass with numbers baked in.

**Only humanoids drop gear and coin.** `EnemyDefinition.family` is `beast | humanoid`, and it is
what decides what a loot table may hold — the rule is enforced over `ENEMIES` and `LOOT_TABLES` by
a test rather than by construction, since the tables are hand-written. It is also the thing that
makes three same-level zones worth visiting: rats give quest parts, crabs give food, bandits give
gear and coin. The bandit table carries **both** armor types on purpose: the shop sells tools
only, so that table plus the two class-keyed quest rewards is the whole of anyone's armor supply.

**Quest progress is derived, not tracked** (`systems/QuestSystem.ts`). `CharacterState.quests` holds
only `active | done` per quest; how far along a "bring me N of X" objective is gets counted off the
inventory on read. Items reach the bag from loot, gathering, cooking, buying and offline camping,
and counting on read means none of those paths can forget to bump a counter. `turnInQuest` on
`CharacterController` refuses as a whole rather than half-applying — taking the objective and
finding no room for the reward is the one outcome that can't be undone.

**Kills are the one counter that is stored** (`systems/AchievementSystem.ts`). Everything else
derives its progress from state that already exists — a quest counts the bag — but a corpse leaves
nothing behind, so `CharacterState.kills` holds a real per-creature tally. What comes _off_ it
still derives: which achievements are unlocked and which titles are earned are computed on read,
and only the player's choice of worn title is stored alongside. Keep that split when adding to it.

Because the count is stored, every path that kills something has to credit it — which is why
`ZoneScene.resolveKill` exists as the single funnel for the auto-attack and ability paths, and why
offline camping widens `OfflineAfkReport` with the creature it was parked on. Add a new reward for
a kill there, not at a call site. Achievement ids are a template literal over `EnemyId` and
`SlayerTier` and the rows are generated from `ENEMIES`, so a new enemy gets its whole 25/50/100
chain by construction; a test still asserts the grid is complete.

**Acquiring an item can fail.** The pack has a weight limit (`systems/EncumbranceSystem.ts`,
capacity from strength), so gathering, loot and buying all go through
`CharacterController.tryAddItem`, which adds nothing and returns false when the pack is full.
Use it rather than `addItem` for anything the world hands the player, and handle the refusal —
a full pack is what ends an unattended gathering session. Currency is weightless and never fails.

**Frame rate is not an assumption you may make.** A loaded CI runner or a cheap phone steps the
game at single-digit fps, where one frame carries the player ~46px. Anything comparing a distance
against a fixed threshold has to scale that threshold with the frame's travel — see
`arriveRadius` in `systems/MovementSystem.ts`, which exists because a fixed 8px arrival band left
the player orbiting a tap destination forever below 30fps. The comment on `stepToward` saying a
velocity above normal speed can never be returned is now true only for mobs: it existed because
Phaser integrates velocity over the physics world's own timestep rather than the scene `delta`,
and the player no longer goes through Phaser at all. The constraint inverts once you own the
integrator — clamping the last step to the distance remaining becomes the correct thing — but
that change and the integrator change must not ship together, or a smoke failure has two
suspects and no bisect.

The other half of a slow frame is tunnelling: 46px of travel can step clean over a wall.
`moveWithCollision` cuts the frame into substeps of at most half a tile (capped at 8), which at
normal frame rates is exactly one substep and costs nothing. It resolves **one axis at a time,
reverting only the blocked one** — that is what makes walking diagonally into the pond slide along
the shore, which arcade gave away for free and which players notice losing. Two rules there are
load-bearing and tested: a body already inside a blocker may always move (otherwise a teleport
onto a tree freezes it there for good), and the world-bounds clamp uses the named
`PLAYER_HALF_EXTENT`, which **must stay below `EXIT_MARGIN`** — the clamp stops the player exactly
that far from the edge, so a half-extent that grew past the margin would silently stop zone
transitions firing with nothing to show for it.

**AFK play must stay behind active play** (`systems/AfkSystem.ts`, `systems/OfflineAfkSystem.ts`).
Two mechanisms hold that, and both matter: the AFK loop never uses an ability, so the action bar
is an advantage only a real player gets, and `awardXp` halves what it earns. Offline progress
accrues only from a session parked with the toggle, and is capped at **one level per session** —
a per-kill rate alone is not safe, since eight hours in the richest zone out-earned the entire
level 1-10 curve several times over. Keep that cap if you add a zone or change the XP curve.
The camp penalty is for XP a character earns unattended, so a quest reward goes through
`ZoneScene.publishXpGain` rather than `awardXp` — handing a quest in is something the player did.
Kills are the exception to the penalty: an offline session credits its full count to the slayer
chains, since a kill either happened or it didn't. It grinds a single spawn, which is what makes
one `enemyId` on the report enough to credit them all.

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
