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
touches a scene, a sprite or the HUD. Screenshots land in gitignored `.smoke/`. Its last section
boots the 3D renderer on its own page: what only a browser can show there is the GPU teardown —
three zone round trips have to leave `renderer.info.memory` where they found it. That number counts
what has actually been _uploaded_, which is why both snapshots are taken after sweeping the camera
over the whole zone: compared from wherever the player happened to be standing, it would move with
a rat wandering into frame.

It reaches the game through two dev-only handles, neither of which mentions Phaser:

- **`window.world`** — the live `ZoneWorld`, set by whichever host is running and re-set on every
  zone change since each builds a new world: `world.mobs`, `world.player.hp`, `world.teleport(x, y)`.
- **`window.view`** — the handful of questions only whatever is drawing can answer:
  `worldToScreen(x, y)`, `drawnCounts()`, `playerFigure()`, `step()` and — for a renderer with a GPU
  to leak — `gpuMemory()`. The interface is `src/types/debugView.ts` and **both** renderers implement
  it, which is what keeps most of smoke portable across the swap.

`window.game` (the `Phaser.Game` instance, from `src/scenes/phaserGame.ts`) is still there for the
generated textures, and exists **only in 2D** — a `?renderer=3d` page never imports Phaser at all,
which smoke asserts. The HUD needs no handle at all — smoke queries and clicks its real elements,
which is what a user does. All three handles sit behind an `import.meta.env.DEV` guard, so Vite
strips them from production builds. They are also how you inspect live state from the devtools
console.

**`?renderer=3d` boots the Three.js client instead of Phaser** (`src/config/flags.ts`, parsed in
`main.ts`, which dynamically imports one half or the other so only the chosen engine is downloaded).
The default is 2D until phase 4 of the port. Unlike the debug handles it is **readable in
production**: merging publishes to Vercel, and the point of the flag is opening a preview URL on a
real phone.

**`?loop=manual` puts the simulation on a hand crank.** Under that flag the host — `ZoneScene.update`
in 2D, the rAF loop in `render3d/start3d.ts` — stops stepping the game and
`window.view.step(deltaMs, frames)` does it instead; the frame loop still draws and still reads the
mouse. Smoke always runs this way, which is why every wait in it is a number of _game_ milliseconds
and a loaded CI runner makes it slower rather than flakier.

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

**Stack**: TypeScript bundled with Vite, with two renderers over one simulation: Phaser 4 (2D,
the default) and Three.js (`src/render3d/`, behind `?renderer=3d`, being built out by
`docs/3d_port_plan.md`). No backend — everything is a static site. Character data lives in the
browser's `localStorage`.

**The core seam: Phaser-free vs. Phaser-coupled code.** `systems/`, `data/`, `persistence/`,
`types/`, `config/`, `world/`, `hud/` and `ui/` contain plain TypeScript with no Phaser imports.
Only `scenes/` and `entities/` know the engine exists at all — `main.ts` picks a renderer without
importing either, and `src/bootFlow.ts` (resume the save, or ask who the player wants to be) takes a
`GameHost` rather than a `Phaser.Game`, which is what lets one boot flow serve both. This is
deliberate — it's what makes them unit-testable with Vitest (no game engine to mock) and is the
same boundary that would let a real backend swap in later without touching game logic. When adding
game logic, default to putting the math/rules in one of these Phaser-free modules and call it from a
scene, rather than inlining logic into a Scene or a Phaser.GameObjects subclass. Tests in `tests/`
mirror this split (`tests/systems/`, `tests/world/`, `tests/persistence/`) and test only these
modules. The rule is enforced, not just documented:
`tests/architecture/phaserFreeSeam.test.ts` reads every file under those eight directories and fails
on an `import` of `phaser`. `render3d/` is guarded by the same test for the other half of the rule:
it is not engine-_free_, but the two renderers must not reach into each other, or deleting Phaser at
the end of the port stops being a deletion.

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

**There are two scenes left, and one of them draws nothing.** `Preload` generates the placeholder
textures — the one thing before the world that genuinely needs a live Phaser scene, since they are
baked with `Graphics` — and then hands over to `src/bootFlow.ts`, which is an if-statement: resume
the save, or mount the plain-HTML creation screen (`hud/CharacterCreate.ts`) and start the session
with what it produces. `Zone` is the gameplay scene and mounts the DOM HUD alongside itself. Neither
restarts; a reset stops `Zone` and shows the creation screen again.

**A host is what a renderer owes the boot flow**, and there are two: `phaserHost()` in
`scenes/phaserGame.ts` and the `ThreeHost` in `render3d/start3d.ts`. A host is an `events` channel
plus `startZone()`, and beyond that it does what `ZoneScene` does other than draw — the frame loop,
the keyboard binding, the pointer, mounting the HUD, and the reset that ends a session. New host
duties belong in both or in neither.

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
`mountHud()` from whichever host booted builds one `<div class="hud">` inside `#app` and it outlives
every zone, like the session does. The only thing it talks to is the `EventBus` it was handed, which
is what makes it renderer-independent by construction: that bus is Phaser's `game.events` in 2D and
`createEventBus()` in 3D, the same tree sits over either canvas unchanged, and nothing drawing the
world knows it exists.

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

**`ui/` is the vocabulary, `hud/` is the DOM that renders it.** `ui/layout.ts` (geometry),
`ui/theme.ts` (palette and scale), `ui/tabs.ts` (the tab table) and `ui/uiEvents.ts` (the event
names and payloads) are shared, tested, engine-free definitions; everything that builds an element
lives in `hud/`.

**The paperdoll is SVG built from the same rig the sprite texture is baked from**
(`systems/AppearanceSystem.stickFigure`, drawn by `hud/paperdoll.ts`, by
`scenes/generateTextures.ts` and by `render3d/figure.ts`). The HUD does not reach into the renderer
for a canvas — that is what lets the sheet keep showing what you are wearing once the world is
meshes. Three things now read that rig, so a shoulder is in the same place in all of them;
`NPC_APPEARANCES` beside it is the same argument for the two figures nobody is wearing gear for, the
shopkeeper and the bandit.

**The tab bar is full.** It splits its width evenly across seven tabs (`ui/tabs.ts`), which on a
375px phone is 44.4px each against a `THEME.touchMin` of 44 — four tenths of a pixel of headroom,
and under the minimum below ~372px. An eighth tab does not fit; fold new surfaces into an existing
sheet, or change how the bar lays out. Labels have to stay short for the same reason ("Quests" is
the longest that fits). `tests/ui/tabs.test.ts` holds the arithmetic and `npm run smoke` measures
the rendered `getBoundingClientRect()` at 375px, so this fails the build rather than shipping an
untappable button.

**Nothing in the world may be drawn under the tab bar.** The bar is opaque and above the canvas, so
it swallows every tap that lands on it: the south signpost in town rendered four pixels inside it on
a portrait phone and could not be tapped at all. Each renderer holds that differently and neither is
optional. In 2D, `ZoneScene.applyCameraZoom` shrinks the world camera's viewport to
`worldViewportHeight()`. In 3D the canvas is full-bleed — a perspective camera cannot shrink without
changing what it shows — so the same requirement is held by how the camera is _framed_
(`render3d/camera.ts`: pitch, distance, and a look point aimed short of the player, because ground
nearer the camera spreads over more pixels than ground further away). Both are measured at real
phone sizes, in `tests/render3d/camera.test.ts` and twice in `npm run smoke`. If you add bottom
furniture, reserve its height in `layout.ts` rather than hoping nothing important lands in the last
sixty pixels.

**There are two channels out of the simulation, and they are not interchangeable.**

The **HUD channel** is the session's `EventBus` — Phaser's global `game.events` under the 2D host,
`world/eventBus.ts` under the 3D one, and a bare stub in a test; see `src/ui/uiEvents.ts` for the
event name constants (`target-selected`, `xp-gained`, `level-up`, `equip-item-requested`, etc.). The
host passes it into `ZoneWorld`, which is why the world can emit to the HUD without importing an
engine; the world also
subscribes to the HUD's requests itself and drops them in `destroy()`. The DOM HUD only listens and
renders. Every one of these carries state the HUD re-renders from, so the latest one always
describes the present.

The **view channel** is the `WorldEvent[]` `world.update()` returns each frame: `hit`, `defend`,
`heal`, `float`, `death`, `spawn`, `bolt-cast`, `gather-tick`, `zone-exit`. These are moments, not
state — a bolt left the caster's hand, a number floated off a corpse — and a view that misses one
cannot recover it from anywhere. They deliberately name a `tone` rather than a colour: the view
decides what "reward" looks like. Anything the 3D renderer needs to know about but cannot read
off the state belongs here. Both views draw them from the tick that returns them —
`ZoneScene.render` as tweens, `render3d/fx.ts` as short-lived objects — and both take the tone's
colour from `FLOAT_TONE_COLORS` in `ui/theme.ts`, which is shared for the same reason `TILE_COLORS`
is: two renderers disagreeing about which shade means "you are the one being hit" are two renderers
drawing different games.

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
The 3D view loads no image either: terrain is one vertex-coloured mesh (`render3d/ground.ts`) and
every entity is untextured primitives (`render3d/figure.ts`, `creatures.ts`, `props.ts`). The one
textures it does upload are text baked onto a canvas by `render3d/text.ts` — a nameplate's name and
a floating damage number — which is also the reason `disposeTree` names `material.map` explicitly,
and the reason the unit suite stubs a 2D context (jsdom has none). Both renderers take their tile colours from
`TILE_COLORS` in `data/tiles.ts` — the same argument as the stick-figure rig behind the paperdoll,
since two renderers that disagree about the colour of grass are two renderers drawing different
games. Creature colours are deliberately _not_ shared: `render3d/palette.ts` mirrors the hexes
`generateTextures.ts` bakes, because nobody sees both renderers at once and that file is deleted in
PR 20.

**`render3d/actors.ts` is the 3D `entities/`.** One actor per simulated thing, catching up to it in
`sync()` exactly as a `*Sprite` does — and where a 2D view that forgets its teardown leaks a stray
label, an actor that forgets `dispose()` leaks GPU memory, so every one of them ends in
`disposeTree` (`render3d/dispose.ts`, which frees geometry, material _and_ any texture hanging off
it). An actor is three layers on purpose: an outer group holding the world position, a facing group
holding the yaw from `facingYaw`, and the nameplate — which is billboarded by having its own
rotation overwritten from the camera each frame, and so cannot live under something being turned to
face where the creature is walking.

**What is a moment and what is a state are drawn on different clocks** (`render3d/fx.ts`,
`selection.ts`). A damage number and a bolt come off the `WorldEvent` channel, are handed to
`FxLayer` by the host's tick, and age against the _view's_ clock — the same one the walk cycles and
the campfire's flicker run on — because how long a number takes to fade is a decision about what is
comfortable to read. A corpse's fall and fade are the opposite: `MobActor` reads them off
`mob.deadForMs`, since the world has to respawn on time with nothing drawing it at all. Both the fx
layer and the selection ring outlive a zone, like the camera and the lights, so a teardown `clear()`s
them instead of taking them out of the scene. Effects play from a 0-1 progress rather than a delta,
which is what makes a dropped frame invisible; `drawnCounts().fx` is how many are in flight, and it
is the one thing in `DrawnCounts` a browser is genuinely needed for (jsdom cannot bake the text).

**A tap is picked against boxes, not against the meshes** (`render3d/picking.ts`). Each actor
answers `pickBox()` with the box a ray has to cross — its collision footprint, standing as tall as
it is drawn, and never smaller than `MIN_PICK_SPAN`. Raycasting the real geometry looks more honest
and is wrong twice over: a ray aimed at a figure's feet — which is what `view.worldToScreen(x, y)`
answers, and roughly where a player aims — passes between its legs and out the other side, and a
crab is 18 screen pixels wide on a phone. `pickTap` then tries node → signpost → NPC → mob →
ground, which is `ZoneScene.resolveTap`'s order and is a **priority, not a depth sort**: a rat in
front of the shopkeeper does not stop you shopping. Only within one kind does the nearest win. The
ground is the mathematical `y = 0` plane rather than the terrain mesh, because the mesh stops at
the map edge and the simulation does not.

**A tap and a drag are the same three events, and `render3d/orbit.ts` is what tells them apart.**
A drag turns the camera's yaw around the player; a tap asks the world for something. The rule is a
**latch**, not a comparison: a gesture becomes a drag once its _cumulative_ travel passes
`TAP_SLOP_PX` and can never go back, because a drag out and back finishes where it started and
releasing there must not walk the player somewhere. Time is the other half — a thumb resting on the
screen past `TAP_MAX_MS` is not a request to walk. Only the horizontal component turns anything:
pitch is not the player's to change, since it is what keeps the world clear of the tab bar _and_
what guarantees every pixel on screen is ground rather than sky. The host owns the events, the
pointer capture and `touch-action: none`; `ZoneView3D` owns the angle, and it outlives a zone.

Two things follow from the camera being movable at all:

- **W means up the screen, not north.** `InputState.setViewYaw()` rotates the keyboard's vector into
  simulation space, and the 3D host sets it whenever a drag moves the camera. The 2D renderer never
  calls it, so its mapping is unchanged.
- **Whatever the camera ends up behind gets faded** (`render3d/occlusion.ts`), because you cannot
  tap what you cannot see and tapping is the whole game. One ray from the camera to the player's
  feet — the lowest point on them, so it fades a fraction early — against a box per prop. The box is
  the **drawn** canopy, not the collision trunk it stops you with and not the thumb-sized volume it
  is picked by: three different questions about the same tree. Fishing spots are excluded on
  purpose, being the one prop drawn transparent already.

## Conventions

- Prettier is the source of truth for formatting (single quotes, semicolons, trailing commas,
  100-char width) — run `npm run format` rather than hand-wrapping lines.
- `noUnusedLocals`/`noUnusedParameters`/`erasableSyntaxOnly` are enabled in `tsconfig.json`; the
  build (`tsc && vite build`) fails on unused code, so don't leave it behind.
- Comments in this codebase are used sparingly and only to explain non-obvious _why_ (see
  existing examples like the version-swap note in `persistence/index.ts` or the tileset note in
  `generateTextures.ts`) — match that style rather than narrating what code does.
