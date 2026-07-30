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

**Gameplay rules belong in `tests/world/`, not in smoke.** The simulation is headless, so a whole
zone can be driven through combat, leashing, aggro, gathering, trading, cooking, camping and
casting in vitest — `tests/world/harness.ts` is what every test there is built on, and it hands
back the world, the character, the keyboard and a `tick`/`until` pair measured in game
milliseconds. That is the first place to add cover for anything the game _does_.

`scripts/smoke.mjs` (Playwright + headless Chromium) covers the other half and deliberately
nothing else: scenes booting and the flows that cross between them, real mouse and key events
reaching the game, the view building and _unbuilding_ itself, the HUD's geometry at real viewport
sizes, and the save round trip through an actual page reload. Reach for it whenever a change
touches a scene, a sprite or the HUD. Screenshots land in gitignored `.smoke/`.

It reaches the game through two dev-only handles, neither of which mentions Phaser:

- **`window.world`** — the live `ZoneWorld`, set by `ZoneScene` and re-set on every zone change
  since each builds a new world: `world.mobs`, `world.player.hp`, `world.teleport(x, y)`.
- **`window.view`** — the handful of questions only whatever is drawing can answer:
  `worldToScreen(x, y)`, `drawnCounts()`, `playerFigure()` and `step()`. The interface is
  `src/types/debugView.ts`, and the Three.js view will implement the same one — which is what keeps
  most of smoke portable across the renderer swap.

`window.game` (the `Phaser.Game` instance, from `src/main.ts`) is still there for the generated
textures and the character-create screen, which PR 12 of the port rewrites. The HUD needs no handle
at all — smoke queries and clicks its real elements, which is what a user does. All three handles sit
behind an `import.meta.env.DEV` guard, so Vite strips them from production builds. They are also how
you inspect live state from the devtools console.

**`?loop=manual` puts the simulation on a hand crank.** Under that flag `ZoneScene.update` stops
stepping the game and `window.view.step(deltaMs, frames)` does it instead; the frame loop still
draws and still reads the mouse. Smoke always runs this way, which is why every wait in it is a
number of _game_ milliseconds and a loaded CI runner makes it slower rather than flakier.

Two environment notes that will otherwise waste your time:

- **`tests/setup.ts` installs an in-memory `Storage`.** Node defines its own `localStorage`
  global that vitest's jsdom environment leaves as an unusable stub, which broke every
  persistence test with `localStorage.clear is not a function`. Don't delete that setup file, and
  don't "fix" `LocalStorageSaveService` to work around it — the source was never the problem.
- **The first `npm run dev` request cold-compiles all of Phaser** (~1.2 MB) and can take far
  longer than a normal page load, so browser waits need generous timeouts on a cold cache.

**Reproducing a frame-rate-dependent bug.** A cheap phone steps the game at single-digit fps and
bugs hide there (see "Frame rate is not an assumption you may make" below). Ask for the frame you
want rather than throttling a machine into producing it: `view.step(140, 50)` is fifty frames at
~7fps, deterministically, and in vitest the harness's `tick(steps, deltaMs)` does the same thing.

That covers bugs in our own maths, which is all of them so far. If you ever need a genuinely slow
_machine_ — a bug in Phaser's own timing, or in the browser's — the old recipe still stands: copy
`scripts/smoke.mjs` into `scripts/` under another name (it has to stay in that directory so
`playwright` resolves), throttle the CPU after the page is created, and run it with `node`. Delete
the copy when you're done.

```js
const client = await page.context().newCDPSession(page);
await client.send('Emulation.setCPUThrottlingRate', { rate: 8 });
```

## Architecture

**Stack**: TypeScript + Phaser 4 (2D game framework), bundled with Vite. No backend — everything
is a static site. Character data lives in the browser's `localStorage`.

**The core seam: Phaser-free vs. Phaser-coupled code.** `systems/`, `data/`, `persistence/`,
`types/`, `config/`, `world/` and `hud/` contain plain TypeScript with no Phaser imports. This is
deliberate — it's what makes them unit-testable with Vitest (no game engine to mock) and is the
same boundary that would let a real backend swap in later without touching game logic. When adding
game logic, default to putting the math/rules in one of these Phaser-free modules and call it from a
scene, rather than inlining logic into a Scene or a Phaser.GameObjects subclass. Tests in `tests/`
mirror this split (`tests/systems/`, `tests/world/`, `tests/persistence/`) and test only these
modules. The rule is enforced, not just documented:
`tests/architecture/phaserFreeSeam.test.ts` reads every file under those seven directories and fails
on an `import` of `phaser`.

**The simulation is `src/world/`; `src/entities/` only draws it.** `ZoneWorld` owns the player, the
mobs, the nodes and every rule that moves them — combat both ways, gathering, the shop, abilities,
the AFK camp, what a corpse is worth — and steps it all from `update(deltaMs)`. `world/Player.ts`,
`world/Mob.ts`, `world/ResourceNode.ts` and `world/Campfire.ts` are the simulated things; the
`*Sprite` classes in `entities/` hold a reference to one and catch up to it in `sync()` once a
frame. New gameplay goes in the world, not the scene. Two consequences worth knowing before you
add to it:

- **Nothing in `world/` may own a Phaser timer or tween.** Mob wandering, the death fade and the
  respawn were three `scene.time` calls; they are accumulators counted down against the frame delta
  now, which is what lets a whole zone run in vitest with nothing rendering it. A view may still
  tween — `MobSprite` reads `mob.deadForMs` and fades against it — but the clock that decides
  anything has to be the world's.
- **Collision bodies are data** (`EnemyDefinition.body`, `ResourceNodeDefinition.body`), not
  measurements off a sprite, for the same reason `PLAYER_HALF_EXTENT` is: the placeholder textures
  go away with the 2D renderer and the boxes do not. `npm run smoke` asserts the two still agree,
  because nothing in the unit suite can see a generated texture.

**Scene flow** (registered in `src/main.ts`, one `Phaser.Game` instance):
`Boot` → `Preload` (generates placeholder textures at runtime, no image assets; loads any
existing save, starts a `GameContext` with it and routes straight to `Zone`, else to
`CharacterCreate`) → `CharacterCreate` (builds a `CharacterState`, saves it and starts the
`GameContext`) → `Zone` (the gameplay scene), which mounts the DOM HUD alongside itself. Each of
those runs once per page load: nothing restarts a scene any more, and `Zone` is the only scene left
that draws anything but the creation screen.

**`GameContext` is the session — everything that outlives a zone** (`world/GameContext.ts`,
Phaser-free). It owns the `CharacterController`, the `InputState`, whichever `ZoneWorld` is running,
and the autosave accumulator, and it is the **only** thing that builds or tears down a world:
`update(delta)` steps the current one and answers `{ events, zoneChanged }`, having already loaded
the next zone when a `zone-exit` or a fatal `death` asked it to. `startGame` / `gameContext()` /
`endGame` are how the host reaches it; there is no Phaser registry involved, and `CharacterState`
does not travel through one. Two things follow that are easy to get wrong:

- **A zone change is a view rebuild, not a scene restart.** `ZoneScene` tears its own sprites,
  labels, tilemap and tweens down and builds them again against the new world. Scene restart used
  to do that for free, which is why a shopkeeper's name label could be scene-owned and forgotten
  about; now whatever creates a display object destroys it (see the `destroy()` overrides in
  `entities/`). `npm run smoke` counts ground layers, signposts and name labels after a round trip,
  because a leak here is invisible to every state assertion — 10 round trips took the display list
  from 44 objects to 764 while every unit test stayed green. This is rehearsal for Three.js, where
  the same omission is a GPU memory leak instead of a stray label.
- **Anything the HUD must hear but is not yet mounted for goes in the notification queue**, not an
  event: `takeNotifications()` is drained once, by `ZoneScene` on the boot that mounts the HUD and
  handed straight to it. The offline AFK payout is resolved on the load that finds a parked
  session, which is necessarily before the HUD exists.

**Zones**: the world is a set of zones defined in `src/data/zones.ts` (map grid, mob spawns,
node spawns, exits), each built into one `ZoneWorld` by the `GameContext` and drawn by the single
`ZoneScene`; the DOM HUD keeps running across a change untouched. Each exit spawns a
tappable `ZoneSignpost` (the mobile path — the invisible edge-walk band is untappably thin on
a phone); walking into the map edge still transitions too, for keyboards. Both are pure math
in `systems/ZoneSystem.ts`. A new area should be a `ZONES` row (plus exits both ways), not a
new scene class.

**The HUD is an HTML overlay over the canvas** (`src/hud/`, Phaser-free, no Phaser scene involved).
`mountHud()` from `ZoneScene.create` builds one `<div class="hud">` inside `#app` and it outlives
every zone, like the session does. The only thing it talks to is `game.events`, which is what makes
it renderer-independent by construction: the same tree sits over the Three.js canvas unchanged, and
nothing drawing the world knows it exists.

`Hud.ts` owns the model and the subscriptions; everything else in `hud/` is a piece that draws part
of it. Char / Bag / Quests / Feats / Log are `Sheet` subclasses and one is open at a time — `Hud`
holds a single `openSheet`, not a visible flag per panel — while Camp and the gear icon are actions
that open nothing. The shop, the slot picker, the options menu and the away report are overlays
built on open and removed on close.

Three rules the Phaser HUD arranged by hand come free from CSS, and are worth not undoing:

- The overlay is `pointer-events: none` and each piece of furniture opts back in, so a tap on the
  HUD never reaches the world and a tap on the world never has to be hit-tested against the HUD.
- `overflow: hidden` on a sheet and `auto` on its body is the whole of clipping and scrolling — no
  mask, no hit-area bookkeeping for rows scrolled out of view.
- A touch drag on a list scrolls it and the browser suppresses the click that would follow, which
  is the drag-versus-tap threshold the Phaser panels each had their own copy of.

**Layout arithmetic still lives in the Phaser-free `ui/layout.ts`**, applied as inline styles rather
than left to CSS: it is unit-tested at viewport sizes nobody sits down and tries by hand, and
`worldViewportHeight()` is derived from the same numbers. Put new HUD geometry there. The breakpoint
keys on **height as well as width**, because a landscape phone (844x390) is wide by any measure and
has less vertical room than a portrait one. Styling is one stylesheet, `hud/styles.ts`, interpolated
from `THEME` — which stores fills as `0x` numbers for Phaser and `#` strings for text, so the DOM
side goes through `cssColor`/`cssRgba` rather than keeping a second copy of the palette. `hud-hidden`
is `display: none !important` on purpose: it is a utility and has to beat whatever display the
element sets for itself.

**The paperdoll is SVG built from the same rig the sprite texture is baked from**
(`systems/AppearanceSystem.stickFigure`, drawn by `hud/paperdoll.ts` and by
`scenes/generateTextures.ts`). The HUD does not reach into the renderer for a canvas — that is what
lets the sheet keep showing what you are wearing once the world is meshes.

**The tab bar is full.** It splits its width evenly across seven tabs (`ui/tabs.ts`), which on a
375px phone is 44.4px each against a `THEME.touchMin` of 44 — four tenths of a pixel of headroom,
and under the minimum below ~372px. An eighth tab does not fit; fold new surfaces into an existing
sheet, or change how the bar lays out. Labels have to stay short for the same reason ("Quests" is
the longest that fits). `tests/ui/tabs.test.ts` holds the arithmetic and `npm run smoke` measures
the rendered `getBoundingClientRect()` at 375px, so this fails the build rather than shipping an
untappable button.

**Nothing in the world may be drawn under the tab bar.** The bar is opaque and above the canvas, so
it swallows every tap that lands on it — a DOM overlay does that by construction, which is why the
3D view will need no equivalent of `ZoneScene.applyCameraZoom` shrinking the world camera's viewport
to `worldViewportHeight()`. Until then that hack is what keeps the 2D world out from under the bar:
the south signpost in town rendered four pixels inside it on a portrait phone and could not be
tapped at all. If you add bottom furniture, reserve its height in `layout.ts` rather than hoping
nothing important lands in the last sixty pixels.

**There are two channels out of the simulation, and they are not interchangeable.**

The **HUD channel** is `this.game.events` (a global Phaser event emitter, and the last thing the HUD
needs Phaser for) — see `src/ui/uiEvents.ts` for the event name constants (`target-selected`,
`xp-gained`, `level-up`, `equip-item-requested`, etc.). `ZoneScene` passes it into `ZoneWorld` as
an `EventBus`, which is why the world can emit to the HUD without importing Phaser; the world also
subscribes to the HUD's requests itself and drops them in `destroy()`. The DOM HUD only listens and
renders. Every one of these carries state the HUD re-renders from, so the latest one always
describes the present.

The **view channel** is the `WorldEvent[]` `world.update()` returns each frame: `hit`, `defend`,
`heal`, `float`, `death`, `spawn`, `bolt-cast`, `gather-tick`, `zone-exit`. These are moments, not
state — a bolt left the caster's hand, a number floated off a corpse — and a view that misses one
cannot recover it from anywhere. They deliberately name a `tone` rather than a colour: the view
decides what "reward" looks like. Anything the 3D renderer will need to know about but cannot read
off the state belongs here.

Mutations of `CharacterState` itself (inventory, gear, xp, skills, location) go through the
Phaser-free `systems/CharacterController.ts` rather than being inlined anywhere. Add new HUD-facing
state changes by adding an event constant and emitting/listening to it, not by reaching into
another scene. An event carrying more than two or three values should pass one object (see
`TargetInfo` in `uiEvents.ts`) rather than growing a positional argument list.

**`ZoneWorld` does not load zones, and that is on purpose.** Walking onto an exit emits
`{kind: 'zone-exit', to, edge, fraction}` and stops the world; the `GameContext` acts on it,
because tearing this world down is its job too. Player death away from town comes back the same
way, as `{kind: 'death', on: 'player', respawnZone: 'town'}`. HP rides across an exit walk and is
deliberately dropped on a respawn — arriving at full is the point of dying. A frame that changed
zone hands its events back with `zoneChanged: true`; they belong to a world that no longer exists,
so a view rebuilds instead of drawing them.

**There is no physics engine.** `world/Player` and `world/Mob` own `{x, y, vx, vy}` and integrate
themselves each frame against the Phaser-free `systems/CollisionSystem.ts`, which is the only thing
that decides what may move where. Arcade was carrying four colliders — player and mobs against
blocking tiles and against tree trunks — and nothing else: player↔mob, mob↔mob and player↔NPC never
collided, and every combat and interaction check is distance-based. Don't reach for
`scene.physics`; it is not configured. `Mob` is instantiated directly from an `ENEMIES` definition
(no per-enemy subclasses) and owns HP, death/respawn timers, and a `wander | chase | returning` AI
state machine. Combat math itself (damage rolls, range/cooldown checks) is _not_ on these classes —
it lives in `systems/CombatSystem.ts` and is called from `ZoneWorld`, which resolves both
directions: `updateCombat()` for the player's swings and `updateEnemyAttacks()` for everything
hitting back.

**Aggro contract**: `Mob.engage()` starts a chase, `disengage()` drops aggro _and heals the mob
to full_ on its way back to spawn. Enemies with `aggressive: true` and an `aggroRadius` engage
on their own when a wandering mob sees the player inside that radius (bandits); passive enemies
only ever retaliate. Both leashing (running past `leashRadius`) and player death
route through `disengage()`, so a fight always restarts from a clean slate — reuse it rather than
resetting mob state by hand. `Mob.update()` takes the player's position, since chasing needs it,
plus the frame delta and the collision world, since it moves itself. All three AI states steer
through `stepToward`, so the arrival band is `arriveRadius` — never a fixed one. The 2px and 4px
thresholds they used to carry were the same slow-frame bug `arriveRadius` exists to fix, one level
down: below 30fps a mob stepped straight over a 4px band and orbited its own spawn point.

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
`ZoneWorld.resolveKill` exists as the single funnel for the auto-attack and ability paths, and why
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
the shore, which arcade used to give away for free and which players notice losing. Two rules there are
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
`ZoneWorld.publishXpGain` rather than `awardXp` — handing a quest in is something the player did.
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
