# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A small, old-school-flavored MMORPG (EverQuest/RuneScape/WoW-inspired), built as a learning
side project by a professional software engineer with no prior game-dev experience. Currently
v1: single-player only; ten zones (town with leveled rats, a shop, a bank and a trainer, a beach
with crabs and ocean fishing, a quarry cut into the hills north of town with tin and iron to mine,
a bandit camp with aggressive humanoids, the bandit hideout behind a locked
door, the Old Mill Road west of town where the goblins are, Blackwater Fen south of the beach
where the eels and the cloth are, the Deep Cut under the quarry where the coal is, the Sunken
Barrow under the bottom of the fen where the dead are, and Greyford Outpost between the road west and
the quarry, where a counter trades in materials rather than coin, a tannery works what the fen
drops, and a fettler reworks gear into what you would rather it was);
character creation, leveling, gear,
two-way combat with death and respawn; three gathering skills and three making ones; currency, vendoring and a bank
to keep a haul in; a weight-limited pack; a five-quest chain from the shopkeeper that collects,
kills and sends you somewhere, plus repeatable contracts off the quartermaster's board that pay for
work you were doing anyway; slayer achievements and the
titles they grant; an AFK camping mode that also pays out offline; click/tap-to-move with a
mobile-first HUD; and local save/load with versioned migrations. Five of the nine zones are level
1-3 starter content — what separates those is what they drop, not how hard they are, and the hideout
is gated by a rare key rather than by a level. Five things sit above that band. The named mob at the
back of the hideout is level 4, carries loot that comes off a single creature, and is the fight the
starter content is the run-up to. The **Old Mill Road** is the band itself: the
first zone that is harder rather than merely different, level 4-5, reached by walking west out of
town with no key and no gate, because the starter band ended by walking and the one above it should
begin the same way. **Blackwater Fen** is the rung above it, level 5-7 and reached the same way, by
walking south off the beach: it is where the food that makes those levels survivable comes from, and
where a caster finally gets armour of their own. **The Deep Cut** is the third, level 5-6 and reached
by walking north out of the quarry, and it is the one of the three that is about a skill rather than
a fight: the coal and the rich iron down there are what the steel tier is made of, and what holds
anybody back from them is the pick in their hands rather than anything standing in the way. The
**Sunken Barrow** is the capstone and the top of the game, level 7-8: it is the hideout's shape one
band up — a rare key off the zone in front of it, a map cut out of solid rock, a passage, and a named
thing at the back — reached by walking off the bottom of the fen, where the raiders that carry the key
already are. What it pays is the off hand nothing has filled since the starter band, and the second
hoard in the game that comes off one creature.
**Work in progress is planned in a doc before it is built**, phased into PRs with the argument for
each decision in it. There is **no live plan** right now — the last one,
`docs/archive/interiors_and_light_plan.md` (interiors, pathfinding and light), finished on
2026-09-03 and went to `docs/archive/` with the rest. A plan carries the shape of one piece of work
where this file carries the shape of the system; when there is a live one, check its status line
before starting anything, since it says which phase landed and which is next. Anything big enough to
phase gets a new plan doc rather than being started against this file alone.

**Decisions that closed off a real alternative go in `docs/decisions.md`**, appended and never
edited. That file is not a duplicate of this one: this describes the shape of the system as it
stands, where that records the _forks_ — what was chosen, by whom, what was rejected and why — so
the same argument is not had twice. A decision with no alternative is not a decision and belongs
beside the code instead.

Per-feature briefs live in `docs/feature_N_*.txt`. They are the original prompts, kept as a
historical record of what each feature was asked for — not current spec, and superseded by the
code wherever the two disagree (`feature_6_v1.txt` asks for crabs at level 4-6; `spawns.ts` puts
them at 1-3, and `spawns.ts` is right). Full long-term vision is in
`docs/initial_design.txt` (multiplayer, more zones, more skills) — most of it is intentionally
not built yet, so don't assume features from that doc exist in code.

## Commands

```bash
npm run dev        # Vite dev server with hot reload (http://localhost:5173)
npm run dev -- --host   # expose on LAN, for testing on a phone
npm run build       # production build to dist/ — no typecheck, run `typecheck` for that
npm run preview     # serve the production build locally
npm run test        # run the full Vitest suite once
npm run coverage    # the same suite with the coverage report attached
npm run typecheck   # tsc --noEmit over both projects: src/tests, and scripts/
npm run lint        # ESLint
npm run format       # Prettier --write
npm run format:check # Prettier --check, which is what CI runs
npm run smoke       # browser smoke check (needs `npm run dev` running in another shell)
```

Run a single test file: `npx vitest run tests/systems/CombatSystem.test.ts`
Run tests matching a name: `npx vitest run -t "isCooldownReady"`
Run part of smoke: `node scripts/smoke.mjs --section=bag,sheets` (an unknown name lists them all).

CI runs on every PR (`.github/workflows/ci.yml`): `gates (node 22)` and `gates (node 25)` run
lint/format/typecheck/coverage/build on both Node versions, and `browser smoke` runs the real
Playwright check. **The smoke job blocks merges**, so run `npm run smoke` locally before opening a
PR rather than finding out from CI. Don't commit on a red suite, including failures that pre-date
your change; fixing a broken test _environment_ is in scope, not a distraction.

**Coverage is reported and never gated** — no thresholds, on purpose. It uses istanbul rather than
the faster v8 provider because v8 can only report a file some test imported and emits every other
one as 0/0 statements, which the reporters round up to 100%: a directory with no tests at all
scores perfect, which is exactly the thing worth finding.

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
nothing else: the game booting and the flows that cross between zones, real mouse, touch and key
events reaching the game, the view building and _unbuilding_ itself, the HUD's geometry at real
viewport sizes, and the save round trip through an actual page reload. Reach for it whenever a
change touches the renderer, an actor or the HUD. Screenshots land in gitignored `.smoke/`.

It runs on a **portrait phone in a touch-capable context**, which is what the game is laid out
for; two sections leave that viewport on purpose and say why (a landscape resize, and a desktop
block for the HUD rules that differ on a roomy screen). Five things in it exist nowhere else:

- **The GPU teardown.** Three zone round trips have to leave `renderer.info.memory` where they
  found it. That number counts what has actually been _uploaded_, which is why both snapshots are
  taken after sweeping the camera over the whole zone: compared from wherever the player happened
  to be standing, it would move with a rat wandering into frame.
- **A finger, not a mouse.** The drag/tap disambiguation and `touch-action: none` are phone rules
  and a mouse can break neither — it never pans the page and is never a thumb resting on the
  screen. Touch sequences go through CDP `Input.dispatchTouchEvent`; Playwright's touchscreen can
  tap but not drag.
- **A press held in wall clock.** `LONG_PRESS_MS` is measured on the same clock `TAP_MAX_MS` is,
  so nothing on the hand crank produces one and no fake pointer stream contains one — the
  `context-menu` section holds a real finger still for 700ms and then checks that letting go walks
  nowhere. It is also where the two events one right click arrives as (`pointerdown` with a
  non-primary button, then `contextmenu`) are held to being one gesture.
- **A landscape resize**, which is the one shape `tests/render3d/camera.test.ts` does not measure.
  A landscape camera frames ten tiles of _depth_ rather than of width, so the south signpost is
  out of frame from the spawn point; what holds is that walking toward it brings it into reach.
- **A CPU-throttled pass at `rate: 8`, cranked at 140ms a frame** — see "Reproducing a
  frame-rate-dependent bug" below for why that is two questions rather than one.

It reaches the game through three dev-only handles, one per channel:

- **`window.world`** — the live `ZoneWorld`, re-set on every zone change since each builds a new
  world: `world.mobs`, `world.player.hp`, `world.teleport(x, y)`.
- **`window.view`** — the handful of questions only whatever is drawing can answer:
  `worldToScreen(x, y)`, `drawnCounts()`, `playerFigure()`, `gpuMemory()`, `drawTime()` and
  `step()`. The interface is `src/types/debugView.ts`, and it is deliberately a small
  renderer-agnostic one — that is what let the renderer be replaced under smoke rather than
  alongside it. There are three questions about a frame and they are different questions:
  `drawnCounts()` is what is in it, `gpuMemory()` is what the card is holding, and `drawTime()` is
  what it costs in milliseconds — the last of which is a **budget** rather than an observation, and
  is the one thing on this handle smoke asserts a ceiling on.
- **`window.events`** — the HUD channel, which is neither of the other two. It is how a check
  reaches a panel whose state has no cheap route through the world: two hundred combat-log lines,
  or a bag filled to the brim to scroll.

Nothing else is exposed. The HUD needs no handle — smoke queries and clicks its real elements,
which is what a user does. All three sit behind an `import.meta.env.DEV` guard, so Vite strips
them from production builds. They are also how you inspect live state from the devtools console.

Nothing in `src/` declares those three on `window` — `start3d.ts` casts to install them —
so `scripts/globals.d.ts` does, which is what lets `tsconfig.scripts.json` typecheck the smoke
script against the real `ZoneWorld` and `DebugView` rather than against `any`. A check that reads a
field the world stopped having is a compile error now instead of an assertion that fails for the
wrong reason. It is a `.mjs`, so its types are JSDoc; keep new helpers annotated or `npm run
typecheck` fails on the implicit `any`.

**Smoke is a list of named sections and `--section=` runs some of them.** They share one page and
carry state forward, so filtering is for iterating on a section you are changing rather than a way
to shard the run — `boot` always runs, and a full run is still the verdict.

**`?loop=manual` puts the simulation on a hand crank.** Under that flag the rAF loop in
`render3d/start3d.ts` stops stepping the game and `window.view.step(deltaMs, frames)` does it
instead; the frame loop still draws and still reads the mouse. Smoke always runs this way, which is
why every wait in it is a number of _game_ milliseconds and a loaded CI runner makes it slower
rather than flakier.

Two environment notes that will otherwise waste your time:

- **`tests/setup.ts` installs an in-memory `Storage`.** Node defines its own `localStorage`
  global that vitest's jsdom environment leaves as an unusable stub, which broke every
  persistence test with `localStorage.clear is not a function`. Don't delete that setup file, and
  don't "fix" `LocalStorageSaveService` to work around it — the source was never the problem.
- **The first `npm run dev` request cold-compiles the whole engine** — ~520 kB of Three.js — and
  can take far longer than a normal page load, so browser waits need generous timeouts on a cold
  cache.

**Reproducing a frame-rate-dependent bug.** A cheap phone steps the game at single-digit fps and
bugs hide there (see "Frame rate is not an assumption you may make" below). Ask for the frame you
want rather than throttling a machine into producing it: `view.step(140, 50)` is fifty frames at
~7fps, deterministically, and in vitest the harness's `tick(steps, deltaMs)` does the same thing.

That covers bugs in our own maths, which is all of them so far — and it is only half of what a
cheap phone is. The other half is a machine that cannot draw a frame in time, and **smoke's last
section throttles itself for it**: `Emulation.setCPUThrottlingRate` at `rate: 8` while the crank is
turned at 140ms. Keep the two straight, because they fail differently. The delta is the
simulation's question and is arithmetic — `arriveRadius`, the substep cap, the exit margin — so it
is unit-testable and mostly unit-tested. The throttle is the renderer's, and is not testable
anywhere else: whether a real press and release still read as a tap when the only clock between
them is a slow device's (`TAP_MAX_MS` is wall clock, and wall clock is exactly what a slow device
inflates), and whether the camera a ray is cast through has been moved this frame.

Reach for the recipe directly only for something smoke does not cover:

```js
const client = await page.context().newCDPSession(page);
await client.send('Emulation.setCPUThrottlingRate', { rate: 8 });
```

## Architecture

**Stack**: TypeScript bundled with Vite, rendered in 3D with Three.js (`src/render3d/`). It was
Phaser 4 in 2D until PR 20 of `docs/archive/3d_port_plan.md` deleted that renderer; the port is done and
`main` has one engine. No backend — everything is a static site. Character data lives in the
browser's `localStorage`.

**The core seam: `render3d/` knows there is an engine and nothing else does.** `systems/`, `data/`,
`persistence/`, `types/`, `config/`, `world/`, `hud/` and `ui/` are plain TypeScript that would run
under any renderer or none, and `src/bootFlow.ts` (resume the save, or ask who the player wants to
be) takes a `GameHost` rather than anything the engine defines. This is deliberate — it is what
makes them unit-testable with Vitest (no game engine to mock), it is the same boundary that would
let a real backend swap in later without touching game logic, and it is the boundary a whole
renderer was in fact swapped across. When adding game logic, default to putting the math/rules in
one of those modules and calling it from the view, rather than inlining logic into an actor. Tests
in `tests/` mirror the split (`tests/systems/`, `tests/world/`, `tests/persistence/`).
`tests/architecture/phaserFreeSeam.test.ts` is what is left of the guard that held it during the
port: it now reads every file under `src/` and fails on an `import` of `phaser`, and fails again if
the dependency reappears in `package.json`.

**The simulation is `src/world/`; `src/render3d/` only draws it.** `ZoneWorld` owns the player, the
mobs and the nodes, and steps everything that moves them from `update(deltaMs)`. `world/Player.ts`,
`world/Mob.ts`, `world/ResourceNode.ts` and `world/Campfire.ts` are the simulated things; the
actor classes in `render3d/actors.ts` hold a reference to one and catch up to it in `sync()` once a
frame. New gameplay goes in the world, not the view. Two consequences worth knowing before you
add to it:

- **Nothing in `world/` may own an engine timer or tween.** Mob wandering, the death fade and the
  respawn were three `scene.time` calls; they are accumulators counted down against the frame delta
  now, which is what lets a whole zone run in vitest with nothing rendering it. A view may still
  animate — `MobActor` reads `mob.deadForMs` and topples against it — but the clock that decides
  anything has to be the world's.
- **Collision bodies are data** (`EnemyDefinition.body`, `ResourceNodeDefinition.body`), not
  measurements off anything drawn, for the same reason `PLAYER_HALF_EXTENT` is: how big a rat looks
  is the renderer's decision and how big a rat _is_ is not. `render3d/creatures.ts` sizes the mesh
  _from_ the data, which is the direction that keeps the two agreeing. **How much of a node's body
  blocks is data too** (`ResourceNodeDefinition.blocks`, a fraction of the footprint or `null` for
  something you walk straight through), and that had to stop being one constant the day a second
  solid node existed: a tree is a canopy you walk under on a trunk you cannot, where a vein is rock
  all the way up. `props.ts` draws both off `blockerRect()`, so what stops you stays what you can
  see stopping you.

**The rules themselves are `ZoneWorld`'s collaborators, one per subsystem**: `CombatDirector`
(both directions of a fight and what a corpse is worth), `GatherSession` (the channel, the fire,
the pan, the food), `AbilityCaster` (whether a button may be pressed, and the spell part-way
through), `AfkCamp`, `ShopSession`, `BankSession`, `TrainerSession`, `BountySession`, `QuestDesk`,
`ContextMenuSession` (what a press held is about, and what was chosen from it), and `ApproachDriver`
(all three click-to-move walks, and the only thing that asks for a route). Each owns its own state,
is constructed by `ZoneWorld` and reaches the rest of the zone through two things and no others: the
`WorldContext` they all share — the clock, the character, the player, both channels out of the
simulation, and the handful of publishers more than one of them needs — and a small `Deps` interface
declared in its own file, of named hooks plus, where a collaborator needs one, a value that is fixed
for the life of the zone (the driver's `collisionWorld` is the one). A new rule belongs in the collaborator that owns the state it reads; a new
collaborator gets a `Deps` of its own rather than a reference to the world. What is left in
`ZoneWorld` is what none of them can own: the entities, the order the tick runs in, what is
selected (`world/targeting.ts`, which is the read-only view of it three of them get), the
publishers that speak only on change (`publishOnChange`), and the three things that stop
everything at once — a zone change, a death, a teardown. Its `handle*` methods are a thin
delegating surface kept for the view and `scripts/smoke.mjs`.

**The boot flow is an if-statement, not a scene graph.** `src/bootFlow.ts` resumes the save, or
mounts the plain-HTML creation screen (`hud/CharacterCreate.ts`) and starts the session with what
it produces. Nothing before the world needs a renderer at all, which is why the creation screen can
be shown before one exists.

**A host is what a renderer owes the boot flow**: an `events` channel plus `startZone()`, and
beyond that everything that has to happen around a zone without drawing it — the frame loop, the
keyboard binding, the pointer, mounting the HUD, and the reset that ends a session. `ThreeHost` in
`render3d/start3d.ts` is the only one now, but the split is what let the renderer be replaced under
the game, so new host duties belong there rather than leaking into the world or the HUD.

**`GameContext` is the session — everything that outlives a zone** (`world/GameContext.ts`,
engine-free). It owns the `CharacterController`, the `InputState`, whichever `ZoneWorld` is running,
and the autosave accumulator, and it is the **only** thing that builds or tears down a world:
`update(delta)` steps the current one and answers `{ events, zoneChanged }`, having already loaded
the next zone when a `zone-exit` or a fatal `death` asked it to. `startGame` / `gameContext()` /
`endGame` are how the host reaches it, and `CharacterState` never travels through a global.
Two things follow that are easy to get wrong:

- **A zone change is a view rebuild.** `ZoneView3D` tears its own actors, nameplates and ground
  mesh down and builds them again against the new world; whatever creates something destroys it
  (`disposeTree` in `render3d/dispose.ts`, which frees geometry, material _and_ any texture hanging
  off it). `npm run smoke` compares `drawnCounts()` and `renderer.info.memory` across three round
  trips, because a leak here is invisible to every state assertion and to the screen — it is memory
  the card never gets back.
- **Anything the HUD must hear but is not yet mounted for goes in the notification queue**, not an
  event: `takeNotifications()` is drained once, by the host on the boot that mounts the HUD and
  handed straight to it. The offline AFK payout is resolved on the load that finds a parked
  session, which is necessarily before the HUD exists.

**Zones**: the world is a set of zones defined in `src/data/zones.ts` (map grid, mob spawns,
node spawns, exits), each built into one `ZoneWorld` by the `GameContext` and drawn by the single
`ZoneView3D`; the DOM HUD keeps running across a change untouched. Each exit spawns a
tappable signpost (the mobile path — the invisible edge-walk band is untappably thin on
a phone); walking into the map edge still transitions too, for keyboards. Both are pure math
in `systems/ZoneSystem.ts`. A new area should be a `ZONES` row (plus exits both ways), not new
view code — and that row is what says what is spawned in it, what is built on it, and what stations
stand there. **Walking is the only way into a zone.** There was a second — tapping a cell on the
world map travelled there — and it was removed, because a world you can step across for nothing is a
world with no distance in it: a forward base saves nothing, a full pack is never a decision, and the
walk home is never a cost. What replaced it is nothing. If travel comes back it should be a thing
with a price on it rather than a free line on a panel.

The quarry is what that claim looks like when it is cashed: a map file, a spawn list, a row and one
exit each way, and it appeared on the world map, in the zone map and in the offline camp with
nothing else written down. Two things a `ZONES` row still cannot promise on its own, both held
by `tests/systems/ZoneSystem.test.ts`: that an arrival _anywhere_ along an exit edge lands on
walkable ground, and that every spawn offset is somewhere something can actually reach — a vein one
row too far north is a vein inside the rock face, and unlike a misplaced rat it never wanders out to
prove it.

**A zone may be locked, and the key is spent rather than carried** (`ZoneDefinition.requiresKey`,
ruled on by `systems/ZoneAccessSystem.ts`). `zoneAccess` answers three things and not two — `open`,
`locked`, and `unlockable`, which is "shut, and the key is in the pack" — because a door about to
open costs something and the caller has to know that before it walks through. All three routes into
a zone ask `ZoneWorld.openWayInto`, which is the **only** place a key is ever spent, so "consumed
once, open for good" is one rule rather than three; leaning on a shut edge is latched
(`blockedAtEdge`) so the refusal is one toast rather than one a frame. What the key opened is stored
on `CharacterState.unlockedZones` and is the one thing here that could not be derived — the key is
gone afterwards, so an empty pack means either "never found one" or "already been", and the world
map draws those two cells very differently. Two zones are locked — the bandit hideout and the Sunken
Barrow, which are the bottom and the top of the game and are deliberately the same shape — and both
maps (`data/banditHideoutMap.ts`, `data/sunkenBarrowMap.ts`) are the inverse of every other one,
solid `WALL_TILE` with rooms painted back out of it, which is why `tests/systems/ZoneSystem.test.ts`
checks that an arrival _anywhere_ along an exit edge lands on walkable ground rather than only where
the signpost stands. **A key belongs to the zone the door is in**: the hideout's drops on the bandits
outside its own door and the barrow's on the fen raiders whose marsh it is at the bottom of, so the
grind and the lock are one place rather than two. And the sentence a refusal is written in puts an
article in front of the zone's name, so `zoneAccess` strips the one half the table already carries —
"the The Sunken Barrow" is what that costs when nobody does.

**The world is a loop now rather than a star, and that is Greyford's doing.** Every road until it ran
through town: out to a thing and back the same way, past the shopkeeper's door twice a trip. Greyford
sits at `-1,-1`, joined south to the Old Mill Road and east to the quarry, so town, the road west, the
outpost and the quarry make a circuit — the first two spokes in the game tied to each other. What it
cost was the two edges it joins: the millpond came two rows south off the mill road's north edge, and
the quarry's face left a ledge along its west one. **Expect a zone that ties two others together to
charge both of them**, which is the same bill a spoke charges once.

**Town trades in coin and Greyford trades in stuff**, which is the whole of why the outpost is not
town in a different colour — the thing `docs/archive/zones_act_two.md` warned it would be. All four
counters at home deal in currency: the shop sells, the bank stores, the trainer charges, the board
pays. The
`outfitter` role (`data/outfitter.ts`, ruled on by `systems/OutfitterSystem.ts`, run by
`world/OutfitterSession.ts`) takes ore, coal and hardwood and hands back the steel tools, and there
is no price in copper anywhere on it. Every offer wants something from each of the three zones around
the outpost, so a tool is a circuit of the loop rather than a thing bought on the way past — and it
is worth more than the materials it swallows, which is the shop's vendor spread pointed at a barter.

**Reforging is where the endgame's coin goes, and it is paid at one end of the loop and spent at the
other** (`data/reforges.ts`, ruled on by `systems/ReforgeSystem.ts`, run by `world/ReforgeSession.ts`
at the fettler). Copper had two sinks — the death fee and the bank's shelves — and the vault _caps_,
so past the last slot bought a purse had nowhere left to go while a barrow king was paying three
hundred. The **reforging stone** is what it goes on now: sold in town, spent at Greyford. That split
is the whole trick — the outpost's claim is that nothing out there wants money, so the shop takes the
copper and the counter takes the stone, and what it costs the player is the walk every offer on the
outfitter's board already asks for.

Five things about it were decided against alternatives:

- **A reforge moves power and never adds it.** Every duel in `EnemySystem.test.ts` is measured
  against gear as the table wrote it, and a reforge that could raise a piece's total would put every
  one of those fights out of date without failing any of them. `STAT_WEIGHTS` is what makes that
  checkable rather than promised: each row is weighed in both directions, and every piece in the game
  is put through every reforge it can take and has to come out weighing what it went in weighing.
- **It is keyed by item id, not by an instance**, because there are no instances — an inventory is a
  count per id, and there is no such thing as _this particular_ chestplate. So a reforge is a fact
  about your steel chestplates, which reads as a compromise and behaves as the right answer: it
  survives being unequipped, banked and withdrawn with nothing tracking it, where one keyed by gear
  slot would jump onto whatever was equipped next.
- **One roll, and permanent.** Livable only because of the first rule: there is no outcome that
  leaves a piece worse than it was, only a direction somebody would not have picked. Permanence with
  an upgrade on the table is the version where a bad roll on a 20% drop costs an evening.
- **The fuel is a second piece for the same slot**, which is one sentence rather than a table of what
  may be melted into what — and it does both of the jobs this exists for at once: the crown that
  drops every time and was pure vendor fodder, and the brown set nobody has worn since the camp.
  Which one gets burnt is the counter's choice rather than the player's, and it is the cheapest that
  fits: a panel asking which of four helmets to melt is a second decision on top of the one that
  matters.
- **The fettler is a person, not a station**, for the reason the bounty board is one. `StationId`
  means "where a recipe is made" and `recipesAt`, `STATION_SKILLS`, `STATION_PERSISTS` and
  `afkCampJob` all read it as one; a reforge is not a recipe, has no skill behind it and is nothing an
  unattended camp could settle to, so wearing a station's clothes it would have been dead data in four
  crafting tables. A role was a row and four compile errors.

The **tannery** in the yard is the other half of that claim, and the more load-bearing half. Town had
the one forge and every made thing in the game came off it, which quietly made "production" and
"smithing" the same word; the vat is the second vertical, and it is out here rather than in town for
the reason the counter is — what it works is what the zones around it produce. See the fenhide tier
below for what it makes and why.

**A tool does something now, which it never used to.** `gatherSpeedBonus` on an equipment row is the
first thing a tool has ever done beyond permitting the swing: before the steel three there was one of
each and nothing to choose between, so a second tier would have been a reskin with nothing behind it.
It is speed rather than yield, which is the opposite call `MASTERY_TIERS` makes — a pool pays a second
log because the _level_ already sells speed, where a tool is a discrete thing you go and get rather
than a curve laid over the same action. `gatherDurationMs` floors the two terms together at
`MIN_GATHER_FRACTION`, because a capped skill holding a steel tool would otherwise gather instantly,
which is the channel disappearing rather than a reward.

**A town has walls in it, and a building is a shell rather than a solid mass**
(`ZoneDefinition.buildingSpawns` into `data/buildings.ts`, drawn by `render3d/buildings.ts`). It is
placed by a centre offset like every other spawn and blocks as `CollisionSystem` blockers beside
the tree trunks rather than as painted-in `WALL_TILE`, because a zone's contents are offsets from the
middle of the map and the tile grid is written out in absolute rows — one of those two has to be the
map's own. What it hands over is `buildingWalls`: three whole walls plus the door wall in the
segments either side of its opening, which run the full span of the footprint and so overlap at the
corners — free, since being inside two blockers is the same as being inside one. `buildingRect` is
still what a thumb aims at and what hides the player, so the three questions one rectangle used to
answer are two questions now.

It was solid until a walk could route round a corner, and the argument for that is `docs/decisions.md`
25 and 40-47. Five rules follow, and `tests/systems/BuildingSystem.test.ts` holds them because
nothing else can see any of them:

- **Every building in the game can be walked into**, proved by routing a body from the zone's spawn
  point to the middle of each one. It is the sharpest test of the hollowing because it fails for
  every way of getting it wrong at once: a doorway too narrow for the body, a wall drawn across its
  own gap, a room too small to stand in, a door facing something solid. The lane-clearance rule below
  used to be a proxy for this; with a pathfinder it is the real question.
- **A doorway is `MIN_DOOR_SPAN` — two tiles — or the wall is simply open.** `doorGap` takes the
  lesser of that and the wall's own length, so a two-tile wall has no segments at all. Three
  buildings are in that case (the smithy, the inn and the cottage), and town has no room to grow
  them: a three-tile cottage was tried in every position the south-west corner allows and each one
  put a rat's wander disc or a tree's working ground inside a wall.
- **Every counter can be walked up to**, which is the same sweep asked of the person rather than the
  room and is not the same question: a route into a building ends wherever the middle of it is, where
  a route to a counter has to end on a spot chosen for somebody to stand at. That is what
  `counterPoint` is for — a tile back from the middle of the room, capped at its half-depth. Pushed
  further back it lands in the wall's own tile row, and since A\* walks tile centres that is a spot
  with no cell to reach it through: `findPath` then answers `null` for the whole walk rather than for
  its last few pixels.
- **Nothing else in a zone may stand inside one** — not a mob spawn's whole wander disc, not a node,
  a station, a signpost, or the band a traveller arrives on. A rat inside a wall is drawn inside it
  and never wanders out to prove it, the way a misplaced vein never does. The counters are the
  exception and are the point: a shop is a room with somebody in it.
- **Every counter's door faces the open ground it is approached across**, measured out from the
  doorstep along whichever way the door faces, and the lane is clear of every other building. That
  decides where a shopfront may be built rather than the other way about, and it is why the town is
  one high street with the counters along the north side of it: the camera stands to the south, so
  due south is where a tap comes from. Only the buildings somebody works out of — which way an empty
  house faces costs nobody anything, and the cottage north of the quartermaster's post fronts
  straight onto it.

**A tap on a shopfront is a tap on whoever works behind it** (`BuildingActor.tapAnswer`, and
`docs/decisions.md` 45). A building is picked last of all — below even the forge — and it answers as
something else rather than with a kind of its own: the person inside, or the **ground at its door**
for the ones nobody works out of. The counter comes first because from outside there is no pixel a
thumb could put on one — the roof is drawn over the room and the pick box is the whole footprint
standing as tall as it is drawn, so _every_ ray aimed at the inside meets the building. The same ray
crossing the figure's own box says `npc` too, so the two agree instead of offering a thumb two
answers depending on where a box happened to fall under a roof.

**Going indoors takes two taps, and the second one has no other way of being asked for.** Where
nobody works, a tap is the doorstep — and the room instead, once the player is within a tile of that
doorstep. Walk to the shop, then go in. It outranks the counter, which is what keeps a room reachable
in the two huts whose counter is served from the threshold. From inside, `pickBox()` answers `null`
so a tap on the floor reaches the ground. Without all of that the rooms would be reachable by
keyboard alone, on a game laid out for a phone.

**Standing in one cuts it away rather than fading it** (`BuildingActor.sync`, called once a frame
from `ZoneView3D` before the occlusion pass). The roof goes outright, because a roof faded to a
quarter still reads as a lid; so does any wall the camera has got _past the plane of_, which is a
stronger test than "on that side" and stronger on purpose — a camera due south of a building is a
hair to one side or the other of its centre line, and the weaker test would flicker the two side
walls on the sign of a rounding error. The fade is switched off while it does, since the far walls
left standing are the whole of what the room is read against.

**A room has a floor and a few things standing against its walls, and none of them block**
(`render3d/interiors.ts`, drawn off the interior half of `BUILDING_LOOKS`). What is in a room is
keyed by the building's shape the way its colours are — shelves in a hall, a bench in a workshop, a
bed in a cottage — with a per-`BuildingId` override table beside it for the two rooms whose whole
character is the thing burning in them, the smithy's forge and the inn's fire. It is the renderer's
own, like creature colour: nothing here blocks, is gathered, is tapped or is stood on, so the
simulation has no opinion about any of it.

Not blocking is the room's arithmetic rather than a shortcut. A three-tile shop is 160 units of floor
with the counter a tile back from the middle and the customer `NPC_INTERACT_RADIUS` in front of it —
the two people fill it end to end — so a blocking fitting is a cell A\* refuses and `findPath` then
answers `null` for the whole walk. What keeps that from being a wall drawn where there is none is
`FITTING_DEPTH`, which is the thickness of the wall a fitting stands against and is **measured off
the smallest room in the game**: a body in the middle of a two-tile hut leaves sixteen units to
either side. `tests/render3d/interiors.test.ts` puts a body on all three spots the game stands
somebody on — the middle of the room, the counter, and where the walk to that counter ends — and
fails on anything deeper.

**A lit room is one light, moved to whichever room the player is standing in** (`RoomLight` in
`render3d/lights.ts`, in that room's own `lamp` colour). One rather than one per building, since
nine of the ten would be lighting the inside of a box no camera can see into — and it sits in the
scene with its intensity at zero rather than being added at the doorway, because three recompiles
every program in the world when the light count changes and that would be the frame somebody walks
through a door. It is not decoration on top of a lit room: the cutaway hides the roof and a hidden
roof casts no shadow, so a room being stood in is a room in full sun, and the lamp is the whole of
what tells an interior from the grass outside. The rooms and the light together cost **about ten of
the forty milliseconds** of the throttled draw budget, which leaves about nine: three consecutive CI
runs read 20.06ms on the pre-interiors tree, 20.66ms once the counters moved indoors, and 30.74ms
with the rooms furnished and lit. The ground and the camera after them read 25.15ms — under that, not
over it, so whatever the ground's extra vertices cost is inside the noise between two CI runs, and
the nine are still there for whatever is next. **Read that number off CI rather than off a dev
container** — a loaded one reads the same trees 10ms high and has no headroom left to see the
difference in, which is how the cost was first written down here as one to three.

**A room is also somewhere to be out of sight, which nothing in the world was before.**
`hasLineOfSight` in `CollisionSystem.ts` is the same blockers asked about a segment rather than about
a body, and `CombatDirector` asks it twice per enemy ability: before a wind-up, so a telegraph that
could never land is never shouted, and again when it resolves, so stepping behind a wall during the
shout is a dodge. It is deliberately **not** asked of an auto-attack in either direction — a tree
trunk is a blocker exactly as a wall is, so gating every swing would make every tree in the game
something to fight around, which is a retune of the whole of combat rather than the fix to a bug the
hollowing created. The segment test is exact rather than sampled, because the thinnest solid thing in
the world is a wall at a quarter of a tile and a sampling step fine enough for that is a constant
that quietly stops being fine enough the day something thinner is built.

**An exit reserves a strip of its own edge, and that is a claim on the town's layout made from
another zone.** A traveller materialises anywhere along the arriving edge — at whatever fraction of it
they crossed the other zone's edge at — so opening a road makes a lane of the receiving zone
unbuildable along its whole length, not just where the signpost stands. The mill road is what taught
this: town had a smithy built across its west edge from back when nothing was over there, and adding
the road west put arrivals inside it. The smithy and its forge moved up into the north-west block, a
cottage moved across town to make room, and one rat moved a notch east — none of which is visible in
the `ZONES` row that caused it, which is the whole reason the sweep exists. Expect a new exit to cost
a layout change at the far end, and reach for `BuildingSystem.test.ts` to find out what.

**The fen charged the same bill against terrain rather than against buildings, which is the harder
half of it.** The beach was an ocean spanning its whole south edge — the map said so, and its comment
said that was why the zone had no south exit. Opening the road to Blackwater Fen meant every arrival
along that edge had to land on walkable ground, and `ARRIVAL_INSET` is a tile and a half, so it was
the _second row up_ that had to be clear rather than the edge itself. The ocean now stops two rows
short and runs off the east edge instead, leaving a sand spit down the west side and a strand along
the south. Nothing about the east edge being water matters, because an edge no exit leads to is one
nobody arrives on and `ZoneSystem.test.ts` does not ask about it. The rule to carry forward: **an
exit needs its whole shared edge walkable on both sides, one arrival-inset in**, so a zone whose
border is water or rock is a zone that has to be re-cut before it can have a neighbour there.

The quarry paid the same bill in rock the moment the Deep Cut opened, which is what makes it a rule
rather than a story about the beach: the face ran across the whole north edge and its comment said
that was why the zone had no north exit — the same sentence the beach's map had, about a different
material. It now sits at rows 2-4 with a shelf along the top of it and a break through the middle
where the shaft was driven, and every existing spawn stayed put. **Expect the sentence explaining why
a zone has no exit somewhere to be the thing that has to go when it gets one.**

The smithy is also the one door in town that does not face south, and for a reason worth keeping: a
door faces the open ground its station or counter is approached across, and in that corner the only
open ground left is west. A south-facing door there would have put the forge on the training hall's
roof.

It is also the first thing tall enough to hide the player outright, so it is an `Occluder` beside the
trees — and the only one whose three boxes are one box, since it has no canopy to walk under and no
trunk to be stopped by. A building need not have anyone behind it or anything to tap: `mill` on the
Old Mill Road is pure scenery, which is the thing a zone could not have until it could have buildings
at all. The name over the door is tagged `sign` rather than `label` for the reason a
quest marker is tagged `marker`: `drawnCounts` counts one label per drawn _creature_ and
`scripts/smoke.mjs` asserts that total in every zone. With no art assets, that sign is the whole of
how a player tells the bank from the store, which is why `BUILDING_LOOKS` is keyed by shape and gives
four shopfronts one colour — four in four colours would read as a fairground.

**The HUD is an HTML overlay over the canvas** (`src/hud/`, engine-free). `mountHud()` builds one
`<div class="hud">` inside `#app` and it outlives every zone, like the session does. The only thing
it talks to is the `EventBus` it was handed (`world/eventBus.ts`), which is what makes it
renderer-independent by construction: the same tree sat unchanged over both canvases during the
port, and nothing drawing the world knows it exists.

`Hud.ts` owns the model and the subscriptions; everything else in `hud/` is a piece that draws part
of it. Char / Bag / Quests / Feats / Log are `Sheet` subclasses and one is open at a time — `Hud`
holds a single `openSheet`, not a visible flag per panel — while Camp and the gear icon are actions
that open nothing. The shop, the slot picker, the options menu and the away report are overlays
built on open and removed on close.

**The player column is bars, and a bar's numbers go inside it** (`hud/PlayerColumn.ts`): name and
level on one line, then health, mana and XP stacked, then the buff row. Three bars with three
captions under them is six rows of eye travel for three facts, and the top-left corner is read at a
glance mid-fight or not at all — so `.hud-bar__label` sits over the fill rather than beside it, which
is also why the backing is nearly opaque (over grass, a half-transparent empty end reads as grass).
Max HP is not on the wire — `player-hp-changed` carries the current value alone — so the ceiling is
recomputed from the gear and level the HUD's model already holds, which is why a gear swap and a
level both have to refresh it.

**The map zooms out, and the zoomed-out view is a map you read** (`worldMap()` in
`systems/MapSystem.ts`). Its whole layout is **derived from the exits already in `ZONES`** — walked
breadth-first from town, placing each zone one step from its neighbour in the direction the edge
that reaches it points — so a coordinate cannot drift out of step with where walking actually takes
you, and a zone added to the table with its exits wired appears on the map with nothing else written
down. A zone's level band is derived the same way, off its own `mobSpawns`. **Nothing on it is a way
of going anywhere.** Tapping a cell used to ask the world to travel there, and that went with fast
travel; the only press it still answers is on the cell being stood in, which zooms back in to it —
a request about the panel rather than about the world. A cell that still looked pressable and did
nothing would be the dead button this HUD does not keep, so the handler is gone rather than
disabled.

A locked zone is drawn shut on that view and that is the whole of what the map does about it: the
door is met at the edge, where walking into it earns the toast naming the key. The map used to be a
third way through one — it spent the key, the same as pushing it open in person — which left `Travel`
and the walk as two routes to keep in step. The cell is drawn from `zoneAccess`'s three answers, so holding the
key looks different from not holding it; the sheet reads the bag through a **getter** rather than
being handed it once, because the key can be looted with that very panel open. Which doors have been
opened is the one thing about this the HUD cannot derive, so it rides its own event
(`unlocked-zones-changed`), unseeded like the map's other two.

**The map is drawn from the zone's id and nothing else** (`systems/MapSystem.ts`, drawn by
`hud/MapSheet.ts` as inline SVG in tile units). Terrain, the exits and what is worth walking to all
come back out of the tables the world was built from — read with the same centre-plus-offset
arithmetic `populateZone` uses — so the map cannot disagree with where things actually stand, and
the HUD needs telling nothing but which zone is running. Only the player's dot is on the wire.
That is two events rather than one (`zone-entered`, `player-tile-changed`) precisely so a walk moves
the dot without rebuilding the terrain under it; the tile event is keyed to whole tiles so a position
never reaches the HUD on the per-frame channel, and both are published **from the tick with no seed**
— the host mounts the HUD after building the world, so a constructor-time emit would fire into a bus
with no subscriber and leave the map blank until the first zone walk. Terrain is banded into runs of
identical tiles (`terrainBands`), which takes a 475-tile zone down to 65 rectangles. **No mobs**:
they wander, so drawing them means a moving position per frame, and a map of where the rats were a
second ago is worse than a map with no rats on it. No tap-to-travel either.

**The two top corners share the row rather than stacking**: who you are top-left, what you are
fighting top-right. The column starts at the margin, not a target frame and a margin down the
screen. The frame takes the width _left beside_ the column rather than `THEME.panelWidth.target`
flat — at 375px a full-width one and the 190px column meet in the middle, and the narrower the phone
the deeper they overlap. A desktop sheet opens in the right-hand column, which is the frame's own
corner now, so `sheetRect` starts it below `topRowBottom` rather than below the player column alone;
the column being the taller of the two today is a coincidence between two tuned heights, not a rule.

**What buffs are up is derived, not tracked** (`systems/EffectSystem.ts`). `world/Player` keeps its
mana shield, its haste and its meal private and `activeEffects()` builds the list off them each time
it is asked, so an expired buff cannot survive in a second copy nobody cleared; `data/effects.ts`
says what each one is and `EFFECT_STYLE` in `ui/theme.ts` says what it looks like, the same split
`QUEST_MARKER_STYLE` makes. `ZoneWorld` publishes the whole list on `player-effects-changed`
whenever any icon's sweep would visibly move, and deliberately **without a seed** — a zone walk
builds a new player carrying none of the old one's buffs, and a HUD that outlives the world has to be
told that. A `debuff` kind exists in the table with nothing using it yet, so the first one is a row
there rather than a second row of icons somewhere else.

Three rules the old Phaser HUD arranged by hand come free from CSS, and are worth not undoing:

- The overlay is `pointer-events: none` and each piece of furniture opts back in, so a tap on the
  HUD never reaches the world and a tap on the world never has to be hit-tested against the HUD.
- `overflow: hidden` on a sheet and `auto` on its body is the whole of clipping and scrolling — no
  mask, no hit-area bookkeeping for rows scrolled out of view.
- A touch drag on a list scrolls it and the browser suppresses the click that would follow, which
  is the drag-versus-tap threshold those panels each had their own copy of.

**Layout arithmetic still lives in the engine-free `ui/layout.ts`**, applied as inline styles rather
than left to CSS: it is unit-tested at viewport sizes nobody sits down and tries by hand, and
`worldViewportHeight()` is derived from the same numbers. Put new HUD geometry there. The breakpoint
keys on **height as well as width**, because a landscape phone (844x390) is wide by any measure and
has less vertical room than a portrait one. Styling is one stylesheet, `hud/styles.ts`, interpolated
from `THEME` — which stores fills as `0x` numbers for the renderer's materials and `#` strings for
text, so the DOM side goes through `cssColor`/`cssRgba` rather than keeping a second copy of the
palette. `hud-hidden`
is `display: none !important` on purpose: it is a utility and has to beat whatever display the
element sets for itself.

**`ui/` is the vocabulary, `hud/` is the DOM that renders it.** `ui/layout.ts` (geometry),
`ui/theme.ts` (palette and scale), `ui/tabs.ts` (the tab table), `ui/gestures.ts` (when a press is
a tap, a drag or a question) and `ui/uiEvents.ts` (the event names and payloads) are shared,
tested, engine-free definitions; everything that builds an element lives in `hud/`.

**An item's icon is derived from what the item already is** (`ui/itemIcons.ts`, drawn by
`hud/itemIcon.ts`). Equipment needs no icon data: a weapon names its `weaponShape`, armour fills a
`slot`, and both name the `color` the paperdoll paints them — so a new equipment row gets a thumbnail
by construction. Only materials and consumables carry an `icon`, and the shapes are deliberately
coarser than the item list, since at thumbnail size a raw fish and a cooked one are one outline in
two colours. The bag, the equip picker and the shop all draw it through the one `row({icon})` helper
in `hud/dom.ts` rather than formatting an item three ways.

**What is on the shelf is earned, and a locked row is still drawn** (`StockRequirement` in
`data/shop.ts`, ruled on by `systems/ShopSystem.ts`). A stock row may name a character level or a
finished quest, and until it is met the row is drawn dimmed with what it is waiting on where its
price would sit — the same call the world map makes for a shut zone, and for the same reason: what is
not on the shelf yet **is** the reason to come back, so hiding it tells the player nothing. It is
tapped like any other row and the world refuses with the full sentence, since a phone has no tooltip
to hover. `stockAccess` answers two things where `zoneAccess` answers three, and the missing one is
the point — a door with the key in the pack is about to cost something, where a gated shelf is simply
not yet.

The gate is settled in `ShopSession.buy` rather than trusted from the panel, for the reason the sale
count is clamped there: the overlay was drawn from a copy of the character. Two rules ride on the
table and are held by `tests/systems/ShopSystem.test.ts` rather than by comments, since it is
hand-written — **every price sits above the item's own value**, so nothing here can be bought and
sold straight back at a profit, and **stocked equipment has to be a tool**, which is what keeps the
gear tier the world's job alone. The shop sells time back: everything on it can also be earned by
playing, and the spread is what keeps playing the cheaper road. The merchant's inspect card names no
stock at all — it is a pure function of an npc id and so cannot read the player, and half the shelf
depends on one.

**Selling a stack is one request with a count on it**, not a second rule about vendoring:
`sell-item-requested` carries a quantity, `ShopSession.sell` clamps it to what the pack actually
holds, and "sell all" is that number rather than a separate path. The clamp is what makes the panel
safe to draw from a copy of the bag — a stale count can only ever sell fewer. **The two are separate
targets**, though: the shop row and the bag's Sell button still part with one, and emptying a stack
is a button of its own beside them (`sell-all` in `ItemActionsSystem`, `stackRow` in `hud/dom.ts`).
A stack of quest turn-ins is exactly the thing a mis-tap must not be able to sell, so the
bulk button is deliberately the smaller of the pair rather than the row itself growing a second
meaning — and it is offered only on a stack, since on one of something it is the Sell button beside
it wearing a longer name. The bank's two directions are the same widget: a move across that counter
is reversible where a sale is not, so the safety argument is weaker there — but the two panels are
read the same way, and a player should never have to remember which of them a row empties.

**The bank is weightless and limited by _kinds_, not by weight** (`systems/BankSystem.ts`, run by
`world/BankSession.ts`, stored as `CharacterState.bank` and `bankSlots`). One slot per item id,
however deep the stack on it — a stack of one and a stack of two hundred cost the same shelf — so
putting a gathering run's haul away is a decision made once and the _first_ of something is what is
paid for. A second weight limit behind the counter would only have made the pack's decision twice;
what the vault costs instead is `bankSlotPrice`, a rising price that is the **second coin sink**
after the death fee, and the reason the pack stays small and awkward while the depth goes on the
shelves. It _caps_ at `MAX_BANK_SLOTS`, which is what left the endgame with a purse and nowhere to
spend it until the reforging stone went on the shelf above it — see reforging, below.

The counter is the shop's twin down to the shape: opened at `NPC_INTERACT_RADIUS`, shut by walking
past `NPC_CLOSE_RADIUS`, a HUD overlay handed a _copy_ of the contents on `bank-changed`, and bare
item ids and counts coming back — so a panel in an HTML overlay never holds the vault, and a count
the panel sends is clamped by the thing that actually holds the goods. Every move goes through
`CharacterController`, which refuses as a whole: a deposit with no shelf for it leaves the pack
exactly as it was. It is also the one counter that **persists on every move** rather than leaving it
to the autosave — a haul put away and lost to a closed tab is worse than one never put away.

**What standing at an NPC gets you is a role, not a guess** (`NpcRoleId` in `data/npcs.ts`). Before
the banker there was one NPC and five places assumed it: the tap, the context menu's line, the
plate over their head, the figure it hangs off, and the inspect card all opened, said or drew the
shopkeeper. A second person standing in the same town would have sold felling axes from behind the
bank's desk, and no state assertion would have caught it. All five read the role now, and the
trainer collected on it: a third counter cost a row in `NPCS` plus a case in each of them. The
quartermaster is the fourth and cost the same, which is also **why the bounty board is a person**:
the plan asked for a board, and a board would have been a second kind of tappable furniture with its
own pick priority, prop, map marker, inspect card and tap kind. The one furniture type that exists
could not be borrowed — `StationId` means "where a recipe is made", and `STATION_PERSISTS`,
`recipesForStation`, `stationsInReach` and `afkCampJob` all read it as one — so a board wearing it
would have been dead data in four crafting tables. A role was a row and four cases. The **fettler** at Greyford is the sixth and cost the same
four, which is the seam still paying: a reforge is not a recipe, so a station would have been dead
data in four crafting tables.
`ZoneWorld.approachNpc` keeps that honest with one `COUNTERS` table keyed by role rather than a pair
of matching conditionals — which counter to open and what the walk toward it is called are the same
fact, and the two drifting apart is how a walk ends at the wrong desk. `NPC_APPEARANCES` is keyed by
`NpcId` for the same reason `NO_GEAR` is keyed by `GearSlotId`: a new person is a compile error until
they have a look, and `zoneMap` puts them on the map off `npcSpawns` with nothing else written down.

**Every counter stands inside the building it works out of**, at the back of the room and facing the
door (`counterPoint`). They stood on the doorsteps until the rooms could be walked into. What moved
with them is **how close you have to stand to be served**: `NPC_INTERACT_RADIUS` is a tile now rather
than nearly two, because a reach of two tiles hands the purse over through the shopfront — the walk
stops in the street and nobody ever goes inside, which would leave the rooms as decoration. It is
what decides whether a room is somewhere you stand, and the arithmetic is unforgiving: a room is
entered only when its floor reaches further back than that reach, so a **three-tile building is a
shop you walk into and a two-tile hut is one served from its own doorway**. Four of the six are the
first kind. `docs/decisions.md` 46 is why the other two are not deepened instead, and
`BuildingSystem.test.ts` asserts which is which so a room cannot change side by accident.

What makes any of them **findable** from the street is a rule that was already there for another
reason: a nameplate is a readout, so it is drawn with `depthTest` off and floats over whatever is in
front of it. A counter's name and quest marker therefore hang over the roof of the shop they work in,
which is how a player knows the shopkeeper is in the General Store rather than wondering where
everybody went.

**Where a counter stands is a tap rule twice over.** Every pair of NPCs in a zone sits more than
`NPC_INTERACT_RADIUS` apart, so which one a tap opens is never a question about pixels — walls make
that harder to get wrong rather than easier, since the radius reaches straight through one — and none
of them stands on the crossroads. A person on the road a few tiles ahead of the spawn point is
standing exactly where a player taps to walk forward: the trainer was first placed three tiles up the
north road and turned "go north" into "open a counter", which smoke caught as three ground-walk
checks stopping an interact radius short of where they aimed. It is the same class of mistake as
drawing a signpost under the tab bar, and `tests/world/trainer.test.ts` holds the spacing half of it.

**A counter also needs an apron no creature can wander into**, which is the third half of that rule
and the one nothing held. `pickTap` is a priority rather than a depth sort, so an NPC beats a mob
from anywhere along the ray — and the ray in to a creature comes down low over the ground just short
of it, since the camera stands south of the player. A person standing there is crossed first, so a
rat at a counter's shoulder cannot be tapped at all. The order itself is right and is not what
should give (a rat in front of the shopkeeper must not stop you shopping), so what gives is the
spacing: the two town rats spawned with the banker and the shopkeeper _inside_ their wander disc,
and were untappable whenever they drifted that way. `zones.ts` had already written this down over
the forge's placement and moved the furniture for it, having learned it the same way — as a finger
tap in smoke that selected nothing, one run in three. `tests/render3d/picking.test.ts` holds it now
over every zone, swept across each mob's whole wander disc rather than checked at the spawn point,
because a creature is only ever _at_ its spawn on the frame the zone was built. The counters moving
indoors is the same rule paid by somebody else: no mob's disc may reach inside a building either, so
a person behind a wall is a person a rat cannot stand in front of. The sweep still runs, because what
holds them apart is two rules in two files agreeing rather than one of them. Nodes are left out
of that rule on purpose: they are terrain, scattered by the hundred, and a tree between you and a
rat is in the way visibly, where a counter swallowing the tap looks like nothing at all.

**Abilities are learned, not granted** (`AbilityDefinition.training`, ruled on by
`systems/TrainerSystem.ts` and sold by `world/TrainerSession.ts`). A row names a level to have
reached and a price; **absent means the one ability the class opens with**, which is the shape
`ShopStockEntry.requires` and `ZoneDefinition.requiresKey` both use, so the table reads as a list of
what is _held back_ rather than of what is free. Each class has four: the opener, then three bought
at levels 2, 3 and 4.

`CharacterState.learnedAbilities` stores **only what was paid for** — what a class opens with is a
fact about `ABILITIES`, and `knownAbilities` derives the bar from the table and the save together.
That is the split `unlockedZones` makes for the same reason: the free one cannot go missing because
nothing has to remember it, and an ability that stops being sold stops needing a migration to hand it
back. `AbilityCaster` asks what is _known_ at the press as well as for the bar, since the button was
drawn from a copy of the character and a number key names a slot without proving one exists.

`trainingAccess` answers three things where `stockAccess` answers two, and the extra one is `known`:
a shelf sells the same thing forever, where a lesson bought is neither for sale nor withheld. A gated
row is still drawn and still tapped — the reason to reach a level is the thing waiting at it — and
each row carries what the ability _does_, which the shop's rows do not: a price is a fact to weigh at
a glance, where "attack 40% faster for 8 seconds" is the entire decision.

The gating levels are chosen against the content rather than spread evenly. The chief is the level 4
fight, so the level 4 purchases land after it rather than trivialising it, and the duels in
`tests/systems/EnemySystem.test.ts` still model auto-attacks alone — a bought ability moves what a
player who spent the coin can do, not the baseline the tuning contract is about.

**The paperdoll is SVG built from the same rig the figure in the world is built from**
(`systems/AppearanceSystem.stickFigure`, drawn by `hud/paperdoll.ts` and by `render3d/figure.ts`).
The HUD does not reach into the renderer for a canvas, which is what let the sheet keep showing
what you are wearing when the world became meshes. Both read that rig, so a shoulder is in the same
place in either; `NPC_APPEARANCES` beside it is the same argument for the figures nobody is wearing
gear for — the three who stand in town, and the two bandits.

**The bar holds five; everything else folds behind Menu.** It splits its width evenly (`ui/tabs.ts`),
so every seat costs every other seat: seven tabs gave each one 44.4px on a 375px phone against a
`THEME.touchMin` of 44 — four tenths of a pixel of headroom, and under the minimum below ~372px.
Five give each one 66.2px. `TABS` is what sits on the bar (Char, Bag, Quests, Camp, Menu) and
`MENU_TABS` is what the Menu overlay opens; `ALL_TABS` is both, and the keyboard binds against that
so a shortcut opens what it names instead of walking through a menu built for thumbs.

**A new surface goes in `MENU_TABS`, not on the bar.** The bar is for what a player opens constantly;
Camp is out there only because it is the one tab that shows state, staying lit while a camp runs.
Menu labels may be whole words — the "labels have to stay short" rule stops at the bar's edge.
A sheet reached through the menu lights the _Menu_ tab (`isMenuTab` in `ui/tabs.ts`), because that is
the only seat it has and a dark bar over an open panel answers nothing.
`tests/ui/tabs.test.ts` holds the arithmetic for both the bar and the menu grid, and `npm run smoke`
measures the rendered `getBoundingClientRect()` of each at 375px, so this fails the build rather
than shipping an untappable button.

**Nothing in the world may be drawn under the tab bar.** The bar is opaque and above the canvas, so
it swallows every tap that lands on it: the south signpost in town once rendered four pixels inside
it on a portrait phone and could not be tapped at all. The canvas is full-bleed and a perspective
camera cannot shrink without changing what it shows, so the requirement is held by how the camera is
_framed_ (`render3d/camera.ts`: pitch, distance, and a look point aimed short of the player, because
ground nearer the camera spreads over more pixels than ground further away). `worldViewportHeight()`
in `ui/layout.ts` is where the reserved band is decided. It is measured at real phone sizes, in
`tests/render3d/camera.test.ts` and repeatedly in `npm run smoke`. If you add bottom furniture,
reserve its height in `layout.ts` rather than hoping nothing important lands in the last sixty
pixels.

**The pitch is a band rather than a number somebody liked, and it is 45°.** The bar is the floor
under it — ground behind the player is where the perspective squeezes hardest, and a shallower
camera squeezes it harder — and under that is half the field of view, where the horizon comes into
frame and a tap aimed past the ground has nothing to land on. The ceiling over it is what a steep
camera costs: a world unit standing up is worth `cos(pitch)` on screen and one lying flat is worth
`sin(pitch)`, so at the 58° this used to be, a wall was worth 0.62 of its own footprint and every
building read as a roof plane. `camera.test.ts` holds all three. **Two other numbers move when the
pitch does** and neither says so on its face: `TARGET_TILES_ACROSS` used to frame the view by its
_depth_, so tilting the camera also zoomed it, and `FOG_FAR` is a ratio to a camera whose axis a
shallower pitch lays down closer to the ground. Framing by width instead is what makes the pitch a
decision about the angle alone; the fog is re-derived when it moves, and the tests measure the cue in
tiles ahead of the player rather than in the multiples it is written in.

**In landscape the rule is about approaching, not about standing still.** The camera frames its
tile budget across the viewport's _smaller_ axis, so a landscape phone spends it on depth: the south
signpost is eight tiles behind a player on the town spawn point and is simply out of frame there.
That resolves itself — the camera follows all the way to the map edge rather than clamping to the
world bounds, so walking toward the signpost lifts it up the screen and it clears the bar about four
tiles out, which is what smoke measures. The 2D camera did clamp, which pinned the signpost below
the viewport at _every_ distance and made the south exit of town unreachable on a landscape phone;
that was left unfixed on purpose and went away with the renderer it was in.

**There are two channels out of the simulation, and they are not interchangeable.**

The **HUD channel** is the session's `EventBus` — `world/eventBus.ts` under the host, a bare stub
in a test; see `src/ui/uiEvents.ts` for the event name constants (`target-selected`, `xp-gained`,
`level-up`, `equip-item-requested`, etc.). The host passes it into `ZoneWorld`, which is why the
world can emit to the HUD without importing an engine; the world also subscribes to the HUD's
requests itself and drops them in `destroy()`. The DOM HUD only listens and renders. Every one of
these carries state the HUD re-renders from, so the latest one always describes the present.

The **view channel** is the `WorldEvent[]` `world.update()` returns each frame: `hit`, `defend`,
`heal`, `float`, `death`, `spawn`, `bolt-cast`, `gather-tick`, `zone-exit`. These are moments, not
state — a bolt left the caster's hand, a number floated off a corpse — and a view that misses one
cannot recover it from anywhere. They deliberately name a `tone` rather than a colour: the view
decides what "reward" looks like. Anything the renderer needs to know about but cannot read off the
state belongs here. `render3d/fx.ts` draws them as short-lived objects from the tick that returns
them, taking the tone's colour from `FLOAT_TONE_COLORS` in `ui/theme.ts` — which lives beside the
palette the HUD uses rather than in the renderer, for the same reason `TILE_COLORS` does.

Mutations of `CharacterState` itself (inventory, gear, xp, skills, location) go through the
engine-free `systems/CharacterController.ts` rather than being inlined anywhere. Add new HUD-facing
state changes by adding an event constant and emitting/listening to it, not by reaching across
modules. An event carrying more than two or three values should pass one object (see
`TargetInfo` in `uiEvents.ts`) rather than growing a positional argument list.

**`ZoneWorld` does not load zones, and that is on purpose.** Walking onto an exit emits
`{kind: 'zone-exit', to, edge, fraction}` and stops the world; the `GameContext` acts on it,
because tearing this world down is its job too. It is the only handover there is: travelling from the
world map was a second one under its own event, and both it and that event are gone. HP rides across,
so crossing a line is never a free heal. A frame
that changed zone hands its events back with `zoneChanged: true`; they belong to a world that no
longer exists, so a view rebuilds instead of drawing them.

**A death is the one stop that changes no worlds.** It used to be the third way a world handed the
player on — a corpse away from home was carried to town at full health for nothing, which made
walking into a bandit both a faster way home than walking and a free heal on arrival. A respawn now
happens where it happened, at the zone's spawn point, and `{kind: 'death', on: 'player'}` asks the
host for nothing. What dying costs is the walk back plus the fee in `systems/DeathSystem.ts` — the
first thing in the game currency is spent on, and deliberately coin rather than XP, since on a
quadratic curve a penalty big enough to be felt is big enough to erase an evening. A purse too thin
pays what it has: a respawn is never blocked on affordability. Arriving at full is still the point
of dying, which is why the spawn point has to be safe — it is the middle of the map, where
a respawn puts someone with no particular spot.

**That safety is held by a sweep now rather than by this paragraph**
(`tests/systems/spawnSafety.test.ts`), because for a long time the paragraph was simply wrong. Three
zones shipped with the centre or an arrival strip inside an aggro radius, each found by hand and one
at a time after the fact: Blackwater Fen put a level 5 raider 71 units from its own centre against a
radius of 210, the Old Mill Road had a goblin at 187 against 200, and the bandit camp's east edge —
the way back out of the hideout — passed 128 from a level 3 bandit.

The sweep holds **two rules of different strength, and the difference is the whole of it.** The
centre is clear of an aggressive creature's _whole wander disc_, because a respawn is not a choice:
dying already costs the walk and the fee, and what stops that being a spiral is a moment to gather
yourself. Measuring at the spawn offset would guarantee nothing, since a creature is only ever _at_
its spawn on the frame the zone was built — the same argument `render3d/picking.test.ts` makes about
tapping one. An arrival strip is held to the weaker rule of not landing anyone _already_ inside an
aggro radius, because walking through a door is a choice and something wandering over to meet you on
the far side is the zone working. What that refuses is a trap: no frame in which to walk back out.

Expect a new zone to cost a spawn or two moved. A 300-unit disc around the middle of the map is not
a small claim on a 25x19 grid, and the mill road's knots had to move as whole knots to keep being
knots.

**There is no physics engine.** `world/Player` and `world/Mob` own `{x, y, vx, vy}` and integrate
themselves each frame against `systems/CollisionSystem.ts`, which is the only thing that decides
what may move where. The arcade physics this replaced was carrying four colliders — player and mobs
against blocking tiles and against tree trunks — and nothing else: player↔mob, mob↔mob and
player↔NPC never collided, and every combat and interaction check is distance-based. `Mob` is
instantiated directly from an `ENEMIES` definition
(no per-enemy subclasses) and owns HP, death/respawn timers, and a `wander | chase | returning` AI
state machine. Combat math itself (damage rolls, range/cooldown checks) is _not_ on these classes —
it lives in `systems/CombatSystem.ts` and is called from `ZoneWorld`, which resolves both
directions: `updateCombat()` for the player's swings and `updateEnemyAttacks()` for everything
hitting back.

**A tap routes round what is in the way, and `ApproachDriver` is the only thing that asks**
(`systems/PathSystem.ts`). `findPath` is A\* over the same tile grid `CollisionSystem` thinks in,
answering with the points to walk to in order, or `null` — which means "do what you did before there
was a pathfinder", so the driver's whole handling of it is a fallback to the straight line rather
than a failure case.

What makes a cell passable is **`isBlocked` on the body being routed**, rather than a second grid
built by rasterising the blockers: testing the whole body at a point _is_ the configuration-space
inflation, and a rasteriser would have been a second picture of the world free to drift from the one
every walk integrates against. Three things about it were decided against alternatives and are worth
not undoing:

- **A waypoint is where the body stands in a cell, not the middle of the cell.** A\* answers with
  whichever cell is cheapest and never whichever is roomiest, so a route down a corridor two tiles
  wide comes back hugging one of its walls — and the walk lands within `arriveRadius` of a waypoint
  rather than on it, which beside a wall is a corner in that wall. Passability and where-to-stand are
  one answer (`footing`) precisely so the two cannot disagree.
- **A passage with no slack in it is not a route.** A gap exactly the body's width is one it fits
  through only in exact arithmetic, so `findPath` refuses to turn a corner in one — which is where
  the rule that **a doorway has to be at least two tiles wide** comes from. Walking the _length_ of
  such a gap is still fine, and is what the straight line to the goal answers.
- **The route is proved by being walked, not by being read.** `tests/systems/PathSystem.test.ts`
  drives every route it builds through `stepToward` and `moveWithCollision` at 60fps and at 5, over
  hand-built worlds and over every zone as `populateZone` builds it. Four routes that read perfectly
  were refuted that way, which is the whole reason the two rules above exist.

**Walking one is `Player`'s and asking for one is the caller's**, which is the split that let this be
wired in without touching anything else. `Player` holds a list of legs and `moveTo` sets a route of
one — which is what a walk always was — so `hasMoveTarget()` stays true across a whole route, and the
two things that read it (`AbilityCaster` refusing a cast, `resolveApproach` asking whether the walk is
over) went on meaning what they meant. A leg is **given up inside the frame that reaches it** rather
than one per frame: `stepToward` reports arrival before it moves, so a leg a frame is a stall at every
waypoint — a fifth of a second of one at 5fps, exactly where the corner was that put the waypoint
there. `ApproachDriver` is the only caller, so the plain walk and the walk up to a counter are routed
and **a pursuit is not**: a plan re-made every frame for a moving mob swings between two ways round an
obstacle as its quarry drifts, which is the same call `docs/archive/interiors_and_light_plan.md` makes about
mobs not pathing.

**A walk toward something solid is routed to beside it and finished by pressing into it**
(`standNear`). Almost everything worth tapping is solid — every tree, every vein, every building — and
a route may not end inside a wall, so routing to the thing itself would have left the pathfinder wired
in and doing nothing for the most repeated action in the game. `standNear` backs the goal along the
line the walk comes in on until the body fits, which is where the straight line would have stopped
anyway, so what it changes is only whether there was a way to get there. `walkTo` then appends the
**original** point as a last leg and `walk` does not, and that split is load-bearing rather than tidy:
a body's width short of a vein, less the arrival band a slow frame widens to 38px, is outside a
gather's reach with nothing left to close it — the walk finishes and the gather is abandoned. Pressing
up against the trunk is what satisfies the radius `resolveApproach` asks about every frame. A `walk`
on open ground has nothing asking anything of the arrival, so the nearest place the body can stand is
the whole answer, which is why a tap in the middle of the pond now ends at the shore.

One thing this found and did not fix: **below about 10fps a body cannot close the last pixels onto a
blocker at all.** `moveWithCollision` cuts a frame into half-tile substeps and reverts a blocked one
whole, so it stalls up to 32px out — far enough that a tap on a vein never gathers. That predates the
route and happens with none involved.

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
**The renderer is on the far side of that too**: an `EnemyDefinition` names a
`shape` (`quadruped | crustacean | humanoid`) and `render3d/creatures.ts` switches on _that_, so a
new row picks a body it is drawn with rather than waiting for a builder written for its id. Colour
stays the renderer's, keyed by the same shape in `render3d/palette.ts` — with the exceptions the
table always said would come. `CREATURE_OVERRIDES` there keys a look to an `EnemyId`, for a humanoid
who is not the same man as the first: a named mob standing in a room full of its own men is precisely
the case where sharing a shape's colour is wrong, and so is a goblin, and so is a fen raider, and so
is the same goblin underground.
`BEAST_OVERRIDES` beside it is the same escape hatch for fur and shell, added when the bog lurker
became the second quadruped and the first one that is not brown — which is exactly the change the
shape table's own comment said to make when it arrived, and the cave crawler is that argument again
for the second crustacean: the crab's boiled orange is a thing that lives in the sun. The default
stays the rule and both are read
through one accessor each (`humanoidLook`, `beastLook`), so a new `ENEMIES` row is still drawn with
no view code written for it unless it asks to be. **How big a person is drawn comes
off the body too**: `buildHumanoid` scales the rig by `body.width / TILE_SIZE`, so the chief takes
up half again the room a bandit does and looks it, in the same direction everything else here runs
— what it _is_ decides what it looks like, never the other way round.

**A `ResourceNodeDefinition` names a `shape` for the same reason** (`tree | ripple | vein`, switched
on in `render3d/props.ts`). It used to be picked out by `solid`, which was a two-way question
standing in for "is it a tree" — and the day a solid node that was not a tree arrived, an ore vein
would have been drawn with a trunk and a canopy. The one thing a vein's prop does _not_ decide for
itself is what colour the metal in it is: that is read off the ore the row yields
(`itemIcon(yieldItemId).color`), because a lump of tin that is grey in the bag and rust-red in the
ground is two answers to one question. Same argument as `TILE_COLORS`, one prop down.

**Only humanoids drop gear and coin.** `EnemyDefinition.family` is `beast | humanoid`, and it is
what decides what a loot table may hold — the rule is enforced over `ENEMIES` and `LOOT_TABLES` by
a test rather than by construction, since the tables are hand-written. It is also the thing that
makes same-level zones worth visiting: rats give quest parts, crabs give food, bandits give
gear and coin. The bandit table carries **both** armor types on purpose: the shop sells tools
only, so that table plus the two class-keyed quest rewards is the whole of anyone's armor supply.
It also carries the hideout key at 3%, which is the rarest thing on any table by a distance and is
meant to be a run of bandits rather than an errand. The chief's table is the other end of the same
idea: the trophy always drops because a fight that long has to be worth something every time, and
it is cloth so it fits either class, while the two weapons behind it are the chase — one per class,
so the run is worth making whoever you rolled.

**The goblin table is the step above that, and the hole it shipped with is closed now.** It pays
roughly double a bandit's coin — which is most of why anyone walks out west, since three armour rows
drop long before the purse stops being a reason to come back — and it carries the **studded** tier,
sitting between the brown leather the camp drops and the plate a forge makes. It is leather
throughout, so it is a warrior's upgrade and a wizard's payday only, and for one zone that meant a
caster walked the road west for coin alone with the bandit table still the whole of how they were
dressed. `docs/archive/zones_act_two.md` had assigned cloth to the fen, so the gap was a deliberate
consequence rather than an oversight, and `tests/systems/oldMillRoad.test.ts` asserted the armour type
so that closing it would be a decision somebody came back and made rather than a thing that drifted.
The fen is that decision: **fenweave** is the cloth line above brown, it drops off fen raiders and
nothing else, and `tests/systems/blackwaterFen.test.ts` holds it as the best cloth any repeatable kill
carries — which is the same guard pointed the other way. The one rule the table cannot bend is
the humanoid one: `EnemySystem.test.ts` requires **every** humanoid to carry both currency and at
least one piece of equipment, so a new person-shaped creature with an empty table fails the build.

**The mill road shipped with no resource nodes, and its hardwood arriving later is what that rule
looks like paid off.** `deadEnds.test.ts` would have failed a hardwood row on the day the zone
landed — the brainstorm asked for one at woodcutting 6, but hardwood exists to be burnt into the
charcoal the steel tier is worked over, and a gathering skill yielding something no recipe consumes
is the strictest of the three dead-end rules. So it waited for the Deep Cut, which is the zone that
gives it a use, and arrived as a `nodeSpawns` list on a `ZONES` row that already existed. Willow is
the same call still outstanding: it lands with the bow, or it does not land.

**What the Deep Cut's own table pays is coin, a tool and a weapon, and deliberately no ore at all.**
The zone's whole claim is that everything worth having down there is behind the pick rather than
behind a door, so a goblin miner dropping coal would be the way round the only gate it has — and iron
ore is no better, since the plate tier is traceable to both veins and a rat precisely because nothing
else in the game hands out either rock. The **goblin maul** on it is the first weapon upgrade in the
game that comes off something repeatable; everything above a brown axe until then was one boss behind
a 3% key.

**Quest progress is derived, not tracked** (`systems/QuestSystem.ts`). `CharacterState.quests` holds
a status per quest and one number beside it; how far along an objective is gets counted on read.
A `collect` objective counts the bag, and items reach it from loot, gathering, cooking, buying and
offline camping — counting on read means none of those paths can forget to bump a counter. The
marker over a quest giver's head (`npcMarker`) is derived the same way, which is **why the view
polls it**: what moves that glyph is an item landing in the bag, and nothing publishes that.
`NpcActor.sync()` reads it off `character.state` each frame like `MobActor` reads the con colours,
and the sprite is tagged `userData.kind = 'marker'` rather than `'label'` — smoke asserts one label
per drawn creature in every zone, so a second label over a head would break that everywhere. The
board's marker (`bountyMarker`) is the same three glyphs off the same ranking, because it answers the
same question — is walking over there worth it — and a player reading one glyph should not have to
learn a second alphabet for the person standing forty feet from the first. `strongerMarker` is what
picks between them: nobody both gives quests and posts contracts today, so every call has one answer
and one `null`, which is exactly when the rule is worth writing down rather than left to whichever
was asked first.
`turnInQuest` on `CharacterController` refuses as a whole rather than half-applying — taking the
objective and finding no room for the reward is the one outcome that can't be undone.

**An objective is a tagged union, and what splits the three is what each one _counts_**
(`QuestObjective` in `data/quests.ts`). `collect` counts the bag, which goes down as well as up and
is handed over at the counter; `kill` and `visit` count lifetime tallies that only ever climb and
have already been paid by the time they are reported — so a turn-in takes items from the first and
nothing at all from the other two. That is also the whole reason a quest entry stores a **baseline**:
read straight off `CharacterState.kills`, "kill 12 bandits" is already finished for anyone who has
been playing and hands itself in the moment it is taken. Remembering where the tally stood at the
accept keeps `have` derived (`tally − baseline`) rather than counting a second copy of a number the
game already has, and it means nothing for a `collect` — which is why the same field is left at
zero there, and why a quest taken with the goods already in the pack is complete on the spot.

**A visit counts arrivals rather than remembering places**, and that is what makes it the kill rule
with a different tally behind it instead of a third mechanism. A visited _set_ would need its own
"since when" question and could never be re-satisfied by someone who had already been; a count minus
a baseline says "go there" once, to a veteran and a newcomer alike. The tally is credited in
`ZoneWorld`'s constructor, because **a world built for a zone _is_ an arrival in it** — the walk and
the session resumed both end there, so every route in counts by construction and a third would too. It is deliberately not `recordLocation`, which is called on every save and says where the
character is rather than that they have just got there. The HUD holds all three counters and redraws
the tracker and the sheet off them together, which is why the two tallies ride events of their own
(`kills-changed`, `visits-changed`): neither is in the bag it already has, and either can move a
quest without the quest log changing at all.

**Standing work is a bounty, and a bounty is a quest objective narrowed**
(`data/bounties.ts`, ruled on by `systems/BountySystem.ts`, run by `world/BountySession.ts` at the
quartermaster). `BountyObjective` is `Extract<QuestObjective, { kind: 'kill' | 'collect' }>` rather
than a union of its own, and the narrowing **is** the rule: a `visit` is finished by walking
somewhere, and something repeatable that is finished by walking somewhere is a currency faucet with
no work in it. Reusing the union is what let the counting be written once — `objectiveProgress` came
out of `questProgress` and both call it — so the baseline that stops "kill 15 rats" handing itself in
to a veteran is one rule over two surfaces.

**One contract is held at a time**, which is why `CharacterState.bounty` is a nullable field rather
than a log: five contracts taken together are five finished together by one afternoon of rats, which
is one decision paid five times. That is what makes giving one back a real button rather than a
courtesy — the board posts a level 4 ask, and without it anyone who took one they cannot finish is
stranded. `BountyOfferState` carries `busy` for what the rule costs every other row, since a row that
cannot be taken and does not say why reads as a bug. Nothing about a contract _finished_ is stored:
it is posted again the moment it is paid, which is the whole of what repeatable means here.

**What the board pays is held by three rules, and the third is the one nothing else in the game
needed** (`tests/systems/BountySystem.test.ts`). A kill contract pays less XP than the kills it names
already pay, so it is a bonus on a grind rather than a reason to make a different one. A gather
contract pays more than vendoring the same haul, or nobody would ever walk past the shopkeeper to
hand it in. And it pays **less per item than the shop charges for the same thing** — the shelf sells
logs, so a timber order above the shelf price is coin minted by walking between two people standing
forty feet apart. It is the same vendor spread `SHOP_STOCK` was already built around, pointed the
other way. Its XP goes through `ZoneWorld.publishXpGain` rather than `awardXp`, like a quest reward:
a camp can _finish_ a kill contract unattended, but it cannot walk to town and hand one in.

**A quest may be held back by another** (`QuestDefinition.requires`), the shape
`ShopStockEntry.requires` and `ZoneDefinition.requiresKey` already use: the table reads as a list of
what is _withheld_ rather than of what is open, and finishing is what opens the next link — accepting
the one before is not enough. `QuestOfferState` gains `locked` beside the four it had, and a locked
row is **drawn** at the counter carrying the quest it waits on where its progress would sit. Same
call as a gated shelf row and a shut zone's cell, for the same reason: what is not offered yet is the
reason to come back. The one place `locked` is not treated as an offer is the marker over the giver's
head, which would otherwise send a player across town to a counter with nothing to say.

**Kills are no longer the only counter that is stored** (`systems/AchievementSystem.ts`,
`ZoneVisits` in `systems/QuestSystem.ts`). Everything else derives its progress from state that
already exists — a quest counts the bag — but a corpse leaves nothing behind, so
`CharacterState.kills` holds a real per-creature tally, and a zone walked out of again leaves nothing
either, so `CharacterState.visits` holds a per-zone one. What comes _off_ both still derives: which
achievements are unlocked, which titles are earned and how far along a quest is are computed on read,
and only the player's choice of worn title is stored alongside. Keep that split when adding to it.

Because the count is stored, every path that kills something has to credit it — which is why
`ZoneWorld.resolveKill` exists as the single funnel for the auto-attack and ability paths, and why
offline camping widens `OfflineAfkReport` with the creature it was parked on. Add a new reward for
a kill there, not at a call site. Achievement ids are a template literal over `EnemyId` and
`SlayerTier` and the rows are generated from `ENEMIES`, so a new enemy gets its whole 25/50/100
chain by construction; a test still asserts the grid is complete.

**Mastery is the third stored counter, and it is stored for the reason the other two are**
(`data/mastery.ts`, `systems/MasterySystem.ts`): a chopped tree leaves nothing in the bag to count
it off. `CharacterState.mastery` holds XP per _target_ — one flat `Partial<Record<MasteryTargetId,
number>>` over both halves of `ResourceNodeId | RecipeId` — and everything that comes off it derives
on read: which of the five rungs a pool stands on, what that rung pays, how far the next one is. The
two id sets have to stay **disjoint** for one record to be safe, which is what
`tests/systems/MasterySystem.test.ts` holds rather than the type system: a recipe named for a node
would silently share its pool.

Four things about it were decided against alternatives and are worth not re-litigating:

- **A target is taught by the same XP the action pays its skill**, which is why there is no second
  rate table beside every node and recipe row — and it is what carries the AFK and offline penalties
  across for free, since a camp earning half the skill XP has learned half as much about the tree.
- **The first rung pays nothing**, which is what made this safe to add to a tuned game. Every pool
  starts empty, so the duels, the starter arc in `progression.test.ts` and the vendor spreads all
  run at Novice and are untouched; what mastery changes is what happens after those simulations end.
- **The payout is a chance at a second one off the same action**, not speed. `gatherDurationMs`
  already sells gathering speed by the level and `beginCraft` deliberately refuses to sell making
  speed at all, so speed would be either bought twice or bought against a written rule. The gather's
  two bonus terms are **added into one roll** rather than rolled separately, because rolling twice
  would make a third log possible exactly where both curves pay out.
- **Only a success feeds a pool, and a failure is never doubled.** A botched bar teaches nothing
  about the bar, and a pool that doubled a burnt fish would be a curve that pays worse the further
  along it you are.

The thresholds are in XP rather than in actions, which is what makes a rung cost the same _work_
whatever is being mastered — an iron chestplate is eight trees of work and reaches Expert in an
eighth of the actions. Master sits just under the XP it takes to cap a gathering skill outright, so
a pool is the thing still climbing once the skill behind it has stopped; `MASTERY_TARGETS` is
generated from `RESOURCE_NODES` and `RECIPES` the way `ACHIEVEMENTS` is generated from `ENEMIES`, so
a node or recipe added later gets its pool by construction. `hud/MasterySheet.ts` draws them grouped
by skill, which is the only comparison a player makes — which tree to chop, never a tree against a
bar.

**Acquiring an item can fail.** The pack has a weight limit (`systems/EncumbranceSystem.ts`,
capacity from strength), so gathering, loot and buying all go through
`CharacterController.tryAddItem`, which adds nothing and returns false when the pack is full.
Use it rather than `addItem` for anything the world hands the player, and handle the refusal.
**What a refusal means depends on who is watching**: an attended player is stopped — they are right
there and can make room, and nothing is destroyed while they do — where an unattended one keeps
going and loses the haul, since the swing happened and stopping the camp dead would cost them a
night's XP rather than one load of logs. `GatherSession` asks `isCamping()` to tell the two apart.
Currency is weightless and never fails.

**A withdrawal is the one acquisition that takes what fits** (`CharacterController.withdraw`, using
`carryableCount` in `EncumbranceSystem`). Every other path hands over a fixed amount that is
_destroyed_ by a refusal — a gather yields two logs or swings for nothing — which is what makes
all-or-nothing the right answer there. The rest of a withdrawal simply stays on the shelf and is
still the player's, so refusing thirty logs outright because twelve fit would be inventing a loss.
It says what stayed behind, since asking for thirty and getting twelve otherwise reads as a bug.

**Frame rate is not an assumption you may make.** A loaded CI runner or a cheap phone steps the
game at single-digit fps, where one frame carries the player ~46px. Anything comparing a distance
against a fixed threshold has to scale that threshold with the frame's travel — see
`arriveRadius` in `systems/MovementSystem.ts`, which exists because a fixed 8px arrival band left
the player orbiting a tap destination forever below 30fps. `stepToward` also **clamps its last step
to the distance remaining**, so a walk lands on its destination instead of stepping over it and
turning round; that is exact only because everything integrating it does so over the same delta it
was handed. The rule was the opposite one while a physics engine owned the integration on its own
timestep, and it inverted when the integrator came in-house — which is why both halves of the fix
are frame-rate arithmetic and both are unit-tested at 5fps.

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

**A cast time is a window in which standing still is the whole cost**
(`AbilityDefinition.castTimeMs`, run by `AbilityCaster`). Mana and the cooldown are spent at the
press and the spell is resolved later, so an interrupted cast costs everything and delivers
nothing — the same bargain the fizzle already makes, and what gives the window its weight. What is
decided at the _end_ is deliberately a different list from what is committed at the start: whether
it fizzles, and whether the target is still in reach, because both are questions about the moment
it lands. Nothing is paid in damage anywhere — the auto-attack keeps swinging through a cast — so
the cost is the window itself.

Two things break one. **Moving** does, and the caster reads that off the player rather than being
told, so every way there is to move (a key, a tap, a walk already under way) breaks a cast without
knowing one exists; starting one while already walking is refused up front instead, since a spell
that could never finish should not take the mana with it. **Being hurt** does, which is not the
same as being hit: a blow the mana shield eats leaves the cast standing, and that is the second
thing the shield is for — without it a caster in melee could never finish a spell, and with it
standing your ground is a decision rather than a mistake. Only the nuke has a cast time; the shield
is instant on purpose, being the thing you press once you are already in trouble.

**A gather, a cook and a cast share one bar** (`hud/ChannelBar.ts`, on the `channel-*` events). They
are the same shape — something you are in the middle of, with a duration and something that can
break it — and no two of them can be running at once, since starting any one gives up whatever was
already going and a hit breaks all three. One widget rather than three stacked in the same place.

**A recipe is one shape for all three making skills** (`CraftingRecipe` in `data/recipes.ts`, run by
`systems/CraftingSystem.ts`). A cooking recipe was already input → output + failure output + level +
xp + duration, so smithing widened it in place rather than putting a second table beside it: the
inputs are a **list**, the failure output is **optional**, and each row names the station it is made
at. Leatherworking arrived third and widened nothing at all, which is what a shape being right looks
like — a `SKILLS` row, a `StationId`, four `RECIPES` rows and no new mechanism anywhere. **What a failure costs is decided by `failureItemId` alone** — naming one spends the inputs and
hands that back, which is what makes levelling cooking worth anything, and leaving it unset spends
nothing at all, which is right for a bar that took a pack-filling trip of ore to carry home.

`RecipeId` is named for what a recipe _makes_. It was keyed by its input while cooking was the only
kind and every recipe took one of one thing; a list of inputs has no single item to key on.
`recipeFromItem` keeps the bag's Cook button working by finding the recipe whose **sole** input is
the tapped item, and anything with a list is asked for by name at its station — a bag cell cannot say
which of three things four bars were meant to become. That is also what decides where a _new_ recipe
can go: the fire's whole list is the bag, so a fire recipe has to take one of one thing, and anything
with a list needs a panel — which the forge and the tannery have and the campfire does not.

**A station's panel is keyed by the station, not written for one** (`hud/StationModal.ts`). It was
`ForgeModal` while there was one built station in the game, and what that hid is that the title, the
rows and — the dangerous one — **the skill a row's level gate is drawn against** were four separate
places each holding the same answer. A second station is where that stops being one answer: a panel
headed "Forge" listing tanning rows gated on Smithing does not throw, it just quietly lies about what
a row takes. All of it is a lookup now (`STATION_LABELS`, `STATION_SKILLS`, `recipesAt`), and the
claim behind the last one — that every recipe standing at a station shares that station's skill — is
held by `tests/systems/CraftingSystem.test.ts` rather than by the type system, which cannot say it.

**Nothing the game hands out may lead nowhere** (`tests/systems/deadEnds.test.ts`, held over the
tables the way `uniqueLoot.test.ts` is). Three rules rather than one, because a vendor price is
enough for something that _drops_ and nowhere near enough for something a skill produces:
everything a `RESOURCE_NODES` row yields has to be an input to a recipe, every other material needs
a use or a price or a door it opens, and nothing may be _made_ that cannot be worn, eaten or built
with. Burnt food is the exception the first two are shaped around — worth less than either half of
the trade it ruined, and deliberately not rescuable by any recipe, since a burnt fish that could be
turned back into something would stop being a reason to level cooking.

**The plate tier is where the loops meet, and its secondaries are what make that true.** A piece
takes iron bars, a tin bar and bone char, so a finished helmet has both quarry veins, a tree and a
rat behind it. Each of the three is a dead end that was: bone char is rat bones and a log burnt down
together (one intermediate rather than two more names on an armour row nobody would read), and the
tin is what the iron is tinned with — which is also the only thing keeping the **soft** vein worth
swinging at, since mining 5 opens the hard one and would otherwise retire the first.

**The steel tier is the same argument one rung up, and it reaches across three zones.** A piece takes
steel bars, charcoal and a crawler shell, so behind every one of them is the quarry's iron, the Deep
Cut's coal, the hardwood on the road west and the thing living in the way of the seam — which is what
keeps the quarry worth walking to after the Deep Cut opens, since a steel bar is two iron bars as well
as the coal that marries them. The two fuels do different jobs on purpose: coal is what a furnace
melts iron into steel with, and charcoal is what the finished piece is drawn over, hot and clean where
coal is hot and filthy. It is also the first tier with **four** pieces — both offhands in the world
drop off bandits in the starter band, so the slot filled once and then never again, and a top tier
that stopped at three would have left the best set in the game wearing a starter shield.
`tests/systems/deepCut.test.ts` traces every piece back to the zones behind it rather than asserting
the recipe rows, so padding one with a fourth bar and dropping a secondary shows up as the web coming
apart.

**The fenhide tier is that argument pointed at the other half of the roster, and it is the second
production vertical.** Both making skills made a warrior's things or nobody's — the forge turns out
plate, which a wizard may not wear at all, and the fire turns out dinner — so a caster could level
every skill in the game and own nothing they had built. The fen closed the _dropped_ half of that gap
with fenweave; **leatherworking** at Greyford's tannery closes the made half. A hide is cured into
`cured-leather` and three cloth-class pieces are stitched from it, and the two secondaries are again
what make it a place the world meets rather than a second thing to do with a hide: the tin is the
buckles and the bone char is what the leather is dressed with, so a finished piece reaches the fen,
the quarry, a town rat and a tree — four sources, the widest web on anything in the game.

Four things about it were decided against alternatives:

- **Both secondaries come off the forge**, which is why it is at Greyford. The outpost's claim is that
  it trades in what other places produce, and a second vertical owing the first one nothing would be
  two games played beside each other.
- **`cloth` rather than a fourth armour type.** A cured hide is not a robe, but `ArmorTypeId` decides
  _who may wear a thing_ rather than what it is woven from — a lantern and an orb are both cloth —
  and a fourth type holding three rows would be a class restriction wearing a costume.
- **It stops less than the iron plate a smith of the same standing makes, and takes a deeper level.**
  A warrior may wear cloth and always could, so nothing stops one walking this road; what keeps it
  from being their shortcut is that it ends up behind where their own skill already had them.
- **The tanning row takes one of one thing**, which is load-bearing rather than tidy: that shape is
  what `findCraftableFrom` looks for, so it is what makes tanning a job an unattended camp can settle
  to. A two-input tanning row would have left the tannery a station nobody could ever camp — and
  `STATION_PERSISTS` saying something about it that nothing read.

`tests/systems/greyfordTannery.test.ts` traces it the way `deepCut.test.ts` traces steel, and
`tests/world/tannery.test.ts` drives the vat as a place.

**A station is a place, and a built one is `Campfire`'s opposite half**: fixed, always there, and part
of the zone (`ZoneDefinition.stationSpawns`), where a fire is placed by the player and burns out.
There are two of them — the forge in town and the tannery in Greyford's yard — and which prop is
drawn is keyed off the id in `actors.ts`, the same bargain `creatures.ts` makes about a `shape`: the
world says what stands there and the renderer says what that looks like. Two rules about a station
were got wrong first and are worth not re-learning:

- **It is opened by tapping it, not by standing near it.** Proximity puts a panel in front of anyone
  walking past, which on a map this size is most of the reasons to be near one. A station is picked
  and walked to exactly like a counter; proximity decides only when the panel _closes_, which is the
  rule the channel at it already lived by.
- **It sits below mobs in the pick priority.** That list is a priority rather than a depth sort, so a
  kind above mobs wins from anywhere along the ray — including well behind what is being aimed at. A
  person is small and stands at a map's edge; a forge is a tile of furniture near the middle of town.

**Cooking is a channel too, and it works down the stack** (`beginCook`/`advanceCook` in
`systems/CookingSystem.ts`, run by `GatherSession` beside the gather it is built as the twin of). A
fish takes the recipe's `cookMs` over the fire, which is what makes a burn worth avoiding rather
than merely worth noticing — before it, the roll happened at the press and the standing still cost
nothing. What cancels it is losing the fire: walking off one, or letting it burn out under you,
which is the same shape as a gather's range check and is why shuffling around the flames is free.
It re-arms itself on whatever is left in the bag the way the gather channel does, because a stack of
twenty fish is one decision and not twenty. The duration is flat rather than shaved down by the
cooking level the way `gatherDurationMs` is: that level already buys the burn chance down, and
selling it speed as well would make the last levels worth about double the first.

**AFK play must stay behind active play** (`systems/AfkSystem.ts`, `systems/OfflineAfkSystem.ts`).
Two mechanisms hold that, and both matter: the AFK loop never uses an ability, so the action bar
is an advantage only a real player gets, and `awardXp` halves what it earns. Offline progress
accrues only from a session parked with the toggle, and is capped at **half a level per session** —
a per-kill rate alone is not safe, since eight hours in the richest zone out-earned the whole
level curve several times over. It is a share of a level rather than a level because a level is a
share of the game and the cap moved under it: on a quadratic curve the last level is the biggest
share of all, a quarter of the old ten-level total and very nearly half of the five-level one, so
halving the ceiling left a session worth what it had always been worth. Move it with the curve
again if you add a zone or raise the cap.
The camp penalty is for XP a character earns unattended, so a quest reward goes through
`ZoneWorld.publishXpGain` rather than `awardXp` — handing a quest in is something the player did.
Kills are the exception to the penalty: an offline session credits its full count to the slayer
chains, since a kill either happened or it didn't. It grinds a single spawn, which is what makes
one `enemyId` on the report enough to credit them all.

**What a camp does is read off the tool and the station, not out of a mode** (`afkCampJob`). A
gathering tool _is_ the weapon slot, so a fishing pole, a felling axe or a pickaxe makes the Camp tab
a gathering camp and a
sword, a wand or an empty hand makes it the fighting one — the same question `canGather` already
asks, which is why this needed nothing stored and no second button. Mining is what
collected on that: a whole third skill, awake and offline, cost the AFK code not one line. It
re-derives
every frame, so a gear swap changes what the camp is doing. A gathering camp works the nearest
ready node of that skill inside the anchor radius and moves to the next when one is chopped out
(`chooseAfkNode`, whose `wait` and `none` are deliberately different answers: waiting is what a
camp does between respawns, `none` means the tool has no work in this zone and the caller falls
back to fighting). Anything already chasing is answered first whichever camp it is — being hit
breaks the channel, so a woodcutter that ignored it would re-arm a gather it could never finish
until it died.

**The station underfoot is the second half of that derivation, and it is where the rule bends.**
Cooking has no tool at all, so the skill with the deepest active loop was the one skill nobody could
camp, and smithing inherited the same hole the day the forge landed. What makes the bend principled
rather than drift is that **a station is a tool you cannot carry**: nothing is stored and nothing is
chosen twice, the derivation simply reads two inputs instead of one. Standing at a fire holding raw
fish is a cooking camp; at a forge holding ore, a smithing one; at the vat holding hides, a tanning
one — the third of those cost the AFK code nothing at all, which is the derivation paying off the
same way mining did. **A station beats a
tool** — you walked to the forge where the pickaxe is merely what you are holding — and the two
cannot deadlock, because a craft eats out of the bag and the bag runs dry, at which point the
gatherer that filled it takes over again. The camp never lights a fire: a log is not the camp's to
spend, and 90 seconds of `FIRE_BURN_MS` is already long enough to cook out a pack of fish and short
enough that it goes back to what it was doing rather than feeding a fire all night. A making camp is
also the one job a full pack is _no_ warning about, since it spends what it carries to make what it
makes.

**A full pack never stops an unattended session; it only stops it keeping anything.** The camp keeps
fighting or working and keeps earning, and everything it cannot pocket is counted into
`OfflineAfkReport.missed` and itemised on the away report — "60 kills, 75 XP / Could not carry: Rat
Bones x33, Rat Meat x26" rather than a bare "your pack filled up", which tells a player nothing
about what a night cost them. Settling in with a pack that is already full is allowed and warned
about at the toggle, since the XP is worth having on its own but nobody means to do it; that warning
is latched (`packFull`) so it is said once rather than every frame for as long as the camp runs.

**Gathering is the one thing the camp is _not_ penalised for while the tab is open**, and that is
deliberate rather than an oversight: an attended player gathers by tapping a node and watching it
auto-repeat, which is the same standing still, so there is no advantage being simulated away to
charge for — and a camp that paid half would be strictly worse than the tap it replaces. Offline is
where the penalty lives, and it is the same stack a fight gets plus a cap of **one skill level per
session**, which is what makes it safe for `resolveOfflineGather` to model neither a tree's four
charges, nor its fifteen-second regrow, nor the walk to the next one. A node's `requiredLevel` is
honoured offline too — parking overnight is not a way past a gate.

**Offline crafting works at permanent stations only** (`STATION_PERSISTS`, `resolveOfflineCraft`).
A forge is a fact about the zone and is still standing in the morning; a campfire is a fact about the
player and went out ninety seconds after the tab closed, so a session paid for one would be paying
for eight hours at a fire nobody was tending. That is the one thing a parked session cannot re-derive
— a zone says what a camp was fighting or gathering, but a forge is one tile of a town — so
`AfkSession.station` records the station the camp _settled to work at_ and nothing else, which is the
awake loop's own precedence decided once at the toggle. The offline branch takes the same order the
awake camp runs: the station first, then the tool, then the fight. It is also the only branch that
**spends** anything, so `OfflineAfkReport.consumed` runs the opposite way from `drops` and
`resolveParked` has to take it back off the character — a payout that only did the second half would
mint bars out of ore that was never used.

**Levels scale both sides.** Enemies carry a `level` and derive HP/damage/XP from
`base + perLevel` via `scaleEnemyStats()`; characters grow through `perLevel` on their class and
`computeEffectiveStats(classId, gear, level)`. Keep those in step — making enemies tougher
without giving characters growth (or vice versa) silently breaks the difficulty curve. Enemy
name colors come from `conColor()` in `systems/EnemySystem.ts`: gray/green below the player,
white even, yellow +1, red +2 and up. Every zone sat in the 1-3 band until the mill road; the chief
at the back of the hideout is level 4, and the goblins on the road west are 4-5 and the only thing
above the band that can actually be ground.

**Difficulty is allowed to come from the spawn table rather than the stat block**, and the mill road
is where that is cashed. A goblin is a bandit with a little more of everything — the interesting part
is that they stand in **three knots of three** rather than spread across the zone, so the fight is
about not pulling the second one. That is a property of `OLD_MILL_ROAD_MOB_SPAWNS` and of nothing
else, which means it is exactly the kind of design a later edit can silently delete: spread the nine
of them out and every other test still passes while the zone quietly becomes the bandit camp with
bigger numbers. `tests/systems/oldMillRoad.test.ts` is what holds the knots — three groups of three,
each goblin with two companions inside a pull, and no two knots within aggro reach of each other, so
taking one on is never accidentally taking two.

**`MAX_CHARACTER_LEVEL` is a claim about the content, not about the curve**, and it is 9 because
that is where the content reaches: the richest thing anyone can grind is the level 8 barrow wight, and
the ten it used to be was 30,720 XP over seven levels with nothing built for them. Max level is meant to
be an achievement rather than an asymptote, so **content that reaches higher raises the cap** — and
`tests/systems/progression.test.ts` is what holds the two together, asserting that the cap sits one
level past the highest thing that spawns and that the climb from the end of the starter arc is
another session or two of the best kill there is rather than another game.

It is what a zone _holds_ rather than a zone arriving that moves it, and the five zones since that
rule was written are all worked examples of it. The quarry spawned nothing above level 3 and left
the cap exactly where it was. The mill road spawns level 5 goblins and moved it to 6; the fen spawns
level 7 raiders and moved it to 8; the barrow spawns level 8 wights and moved it to 9. The Deep Cut
is the clearest case of all, because it is a whole zone above the starter band that moved the cap
**not at all** — it tops out at 6 under a fen that already spawns 7, so `progression.test.ts` had
nothing to say about it. Nobody chose any of those numbers: the cap is asserted against `spawns.ts`,
so raising the content is what raises the ceiling and the test says the new number before anyone has
to remember it.

**What that test will not let a zone get away with is paying too little for the room it added.** The
climb to the cap is held to a small multiple of the starter arc measured in the best repeatable kill
there is, and the curve is quadratic where a creature's XP is linear in its level — so a zone that
adds two levels while paying a goblin's rate walks straight into the ceiling. The fen's raider is
what that looks like when it is priced deliberately: 14 XP a level against the goblin's 11, which
lands the climb at 146 kills against a limit of 213. The barrow's wight is the same decision made
again rather than inherited — 18 a level, landing the climb at 147 against the same limit — which is
what a zone above the last one has to do every time.

Two things ride the cap and have to move with it, which is exactly what neither did before: the
combat skill ceiling is `combatSkillCap` (`level × 10`, so 80 now), and **what a trained combat
skill is worth is written as the ceiling and divided down by that cap** rather than as a rate
(`MAX_WEAPON_SKILL_DAMAGE_BONUS` and `MAX_AVOIDANCE` in `systems/CombatSystem.ts`). A rate is the
thing that silently stops meaning what it says when the cap moves: `MAX_AVOIDANCE` claimed 25%
against a rate that needed skill 125 to reach it and so had never once been reachable at any cap the
game has had. Derived, the number in the source is the number a capped character actually has. Both
clamp at the ceiling as well as reaching it, so a save made under the old cap cannot swing harder
than the game says anyone can.

Combat tuning is deliberate, not arbitrary: a fresh level 1 character should beat a level 1 rat
comfortably, sweat against a level 2, and lose to a level 3. If you change class stats, weapon
bonuses, or enemy growth, re-check that curve — simulating duels across the level range is much
faster than playing it. Crabs are long fights rather than dangerous ones; the bandit camp is
gated on gear rather than on level, which is the point given it is where gear comes from.

**The chief is the one fight gated on the level rather than the kit** (`bandit-chief` in
`ENEMIES`). A level 3 in what the camp outside drops takes him and a level 2 in the same gear does
not, which is the whole difference between the hideout and everywhere else. He is slow and heavy
rather than fast and sharp — a bandit's damage at not much over half its swing rate, on four times
the HP — so the fight lasts long enough for a cooldown, a meal, or running away, and the duels in
`tests/systems/EnemySystem.test.ts` are what hold that. Those model a warrior trading blows, which
is what every duel here models; a wizard's answer to 80 units of reach and a chase slower than they
walk is not to stand in it, and no arithmetic about swapping hits describes that.

**A swing can miss and a swing can land hard, and both come out of the weapon
skill** (`critChance` and `enemyAvoids` in `systems/CombatSystem.ts`). `rollDefense` used to have
exactly one caller — the player being hit — so nothing in the game had ever avoided anything the
player swung at, and the player had never crit.

Crit chance is **paid out of the weapon skill's existing budget** rather than added beside it: the
flat multiplier is derived from the crit half so the average at cap is unchanged by construction,
and only the _shape_ of it moves. The skill used to buy 0.4% damage a level, which is imperceptible
by design; a crit is a moment where a multiplier is not, which is what makes training felt. Retuning
the chance or the multiplier re-slopes the flat part instead of quietly moving the total.

Avoidance is `EnemyDefinition.avoidChance` and it belongs to the **armoured scuttling things** — the
crab, and the cave crawler that is the crab's idea one band deeper. A long fight rather than a
dangerous one is what a dodge is for, and every other row leaving it at zero is what keeps it from
being a tax on every fight; `CombatSystem.test.ts` holds that as the rule rather than as a list of
names, so a dodging thing has to be a crustacean and has to be passive. It is rolled before the damage
is, so a slipped swing costs the weapon skill its rep too.

Neither needed a new channel: a crit is a `crit` flag on the `hit` event the view already draws,
coloured from `FLOAT_TONE_COLORS` and marked with a bang so it reads on a screen being looked at
rather than watched.

**Armour stops a share of a hit, and a shield is a hand rather than a stat**
(`armorValue` on an equipment row, curved by `mitigatedDamage` in `systems/CombatSystem.ts`).
Mitigation is **proportional with diminishing returns** — `armor / (armor + 80)` — rather than flat
subtraction, because at these damage numbers a rat hits for 3 and any flat reduction worth wearing
is immunity inside one tier. Nothing can reach 1, so armour never becomes immunity however much is
stacked, and `MIN_DAMAGE` still floors a blow at 1 underneath it. A full brown set with the shield
sits near 15%.

It is **player-side only**, deliberately: a field on `EnemyDefinition` that every row leaves unset
is the kind of dead data this codebase does not keep. It is applied in `CombatDirector.strike`,
which is the one path everything that lands on the player goes down — so a swing and a Cleave are
mitigated by the same line, and the mana shield soaks what got _through_ the plate rather than what
was swung at it.

**The offhand is the fifth slot**, and `NO_GEAR`'s comment predicted exactly how it would land — "a
fifth slot would have been four separate compile errors away from anyone noticing" — which is what
`exhaustive<GearSlotId>()` and a `Record<GearSlotId, …>` buy. One item per class, because a slot
that is furniture for half the roster is a dead button, and both drop off bandits like the rest of
the set: a slot nothing drops into is a slot nobody fills. A shield **helps** Block rather than
being required by it, since requiring one would strand every point of Block every existing
character has trained in a skill that predates the slot.

Armour moved the one fight tuned to a knife edge. A geared level _2_ took the chief once everyone
got tankier, which is precisely the gate the hideout exists to be — so the chief moved with it. That
direction is the rule: the content follows the arithmetic, and `tests/systems/EnemySystem.test.ts`
is where both are held.

**An enemy ability is telegraphed, avoidable, and spends the swing it replaces**
(`data/enemyAbilities.ts`, chosen by `systems/EnemyAbilitySystem.ts` and run by `CombatDirector`).
One rule covers all of them: it shouts for `windUpMs` — a float over the creature's own head, a line
in the combat log, and a line in the target frame — and lands on whoever is still inside `range`
when the clock runs out. An instant one would be unavoidable by construction, so there are none.

Two things follow that are easy to get wrong. **The wind-up spends the creature's attack cooldown**,
so an ability is a swing spent differently rather than one on top: standing in every Cleave is worse
than being plainly auto-attacked and stepping out of every one is better, which is what makes moving
worth the trouble instead of merely polite. And **a mob winding up plants its feet** (`Mob.update`
returns early on it) — something that kept closing while it shouted would land every one of these on
a player who did walk away, and the telegraph would be a lie.

Abilities are a **humanoid** thing, the same line `family` already draws for what a loot table may
hold: a rat has only its teeth. The chief's Cleave is what the boss fight is actually about, and the
bandit's thrown knife is what it reaches for when it _cannot_ reach you — `minRange` keeps it out of
melee, which is also what keeps the toe-to-toe curve the duels hold exactly where it was.

The tuning contract moved with it: `tests/systems/EnemySystem.test.ts` folds an ability into the
duel both ways, and the chief's line is now that a geared level 3 who stands in every Cleave loses
and the same character who steps out of each one wins.

**A boss is a named mob, and `boss: true` is a rule rather than a label.** An unattended camp never
_picks_ a fight with one — `decideAfkAction` filters it out of what is in reach and `campQuarry`
leaves it off the offline list — because a night parked beside him would mint sixty of the only
loot in the game that comes off one creature. It is still answered once it engages: something
already chasing an AFK character is arriving whether or not the camp chose it. His table is the one
place `cutthroats-bandana`, `cutthroats-blade` and `stolen-wand` exist, and
`tests/systems/uniqueLoot.test.ts` holds that over the data — uniqueness is nothing but every other
table not naming them, which is exactly what stops being true the day someone pads one.

**Pacing is held by a simulation, not by judgement** (`tests/systems/progression.test.ts`). It
walks the arc the two quests push a player down — rat kills for the bones, fish cooked to open the
crab recipe, crab kills and cooks for the feast, bandit kills for an armour set — and asserts it
ends on level 3. Change `xpTable.ts`, a drop chance, a quest objective or the burn rate and this
is the test that moves; retune until it passes rather than eyeballing the curve.

Auto-attack **range comes from the equipped weapon, not the class** (`weaponAttackRange` in
`data/items.ts`): a weapon may name an `attackRange`, anything that doesn't is melee, and empty
hands are shorter still. Abilities carry their own ranges, so a caster's reach is the spell
rather than the class. `Player.applyStats()` has to reassign `attackRange` alongside the other
stats or a weapon swap won't change reach until the view rebuilds.

**There are no art assets, and the renderer loads no image at all** (placeholder shapes only, per
the "no art skills" constraint in `docs/initial_design.txt`). Terrain is one vertex-coloured mesh
(`render3d/ground.ts`, see below) and every entity is untextured primitives (`render3d/figure.ts`,
`creatures.ts`, `props.ts`). The only textures uploaded are text baked onto a canvas by
`render3d/text.ts` — a nameplate's name and a floating damage number — which is also the reason
`disposeTree` names `material.map` explicitly, and the reason the unit suite stubs a 2D context
(jsdom has none). The tile vocabulary is small and grows by a constant plus a colour — `MARSH_TILE`
is the fen's brackish ground and cost exactly that, since `BLOCKING_TILES` is a list and a walkable
tile needs no change to collision at all. Tile colours live in `TILE_COLORS` in `data/tiles.ts` rather
than in the renderer,
for the same reason the stick-figure rig behind the paperdoll does: the ground the simulation calls
water is a decision the whole game makes. Creature colour is not — `render3d/palette.ts` is the
renderer's own, and nothing outside it asks what colour a rat is.

**A ground vertex is coloured by what it touches, and a blocking tile touches nothing**
(`buildGroundGeometry`). A tile is four quads rather than one, and each vertex takes the mean of the
tiles that reach it — the one under a tile's middle, the two either side of an edge, the four that
meet at a corner — so a road fades into the grass over the outer half of each of them instead of
ending in the staircase a grid of flat squares draws. The middle sample is why the tile is cut up at
all: with four corner samples and every one an average, a three-tile road has no pure road anywhere
in it and reads as a smear. **What may not blend is a boundary a body is stopped at.** `blends` puts
two tiles in the same mean only if they agree about being crossable, because a shore drawn as a
gradient is a gradient somewhere in the middle of which walking stops working, and where the ground
may be crossed is the one thing about terrain a player has to read at a glance. The brightness wobble
had to move with it — `cornerShade` is per grid corner and `shadeAt` interpolates between them, since
a shade held flat across a tile would put the grid of hard squares straight back in, drawn in
brightness rather than in hue.

**Where the ground steps down, it grows the face it steps down.** A water tile sits `WATER_DEPTH`
below the land and nothing joined the two, so the far rim of every pond was a band of the background
showing through the hole in the world. Each tile now grows a vertical quad on any side whose
neighbour stands higher, in the colour of the ground it is cut into, darkened — a bank rather than a
palette entry of its own. It is written against tile _height_ rather than against water by name, so
the next thing that steps down is drawn already, and it is single-sided and wound toward the low
tile: the face is only ever seen from inside the dip, and wound the other way it is the void it was
added to fill.

**There is a sun now, and everything standing in it sits on the ground** (`render3d/lights.ts`).
Two flat lights and no shadows was the right call while there was nothing to cast one; by the end
of act two there were buildings, trees, veins, signposts, creatures and a player, and every one of
them hovered. A `HemisphereLight` fill is what gives a face pointing up a different value from one
pointing sideways with no sun on it, which a flat ambient could never do; the sun itself comes from
the **south-west**, because the camera's resting place is due south and a light from the north put
every face anyone ever looked at in shade. It does not follow the camera — turning the view round to
look into the sun is most of what makes turning it worth doing.

Four things about it were decided against alternatives:

- **The shadow camera is cut to the zone, not to what the camera can see**, which reverses what
  `docs/archive/interiors_and_light_plan.md` asked for and is what the arithmetic says. The camera
  sees ground from a few hundred units in front of itself out past 2500 — from the middle of town
  both edges of the zone are on screen at once — so a frustum framed on the viewport is _larger_
  than one framed on the map. Framed on the zone it is also fixed in the world for the life of that
  zone, so a shadow's edge does not crawl as the player walks, and it is the frame a **pitch change
  leaves alone**: the camera coming down to 45° moved the viewport's frustum and this one not at all.
- **Only the ground receives.** It is the surface a shadow is actually read on, and it is the one
  that must not also cast: a single flat plane covering the whole zone, tested against a depth map
  it wrote itself, is the shortest road to acne over the entire floor.
- **A builder decides what casts, not an actor.** `castsShadow` is called on the group each builder
  returns, which keeps a nameplate, a shop sign, a damage number and a selection ring out of the map
  by construction — those hang on the actor _around_ the body — and keeps the player's shadow across
  a gear change, which rebuilds the figure and never touches the actor. The exceptions are the two
  transparent things: a fishing spot's ripples, and a campfire's flames, whose logs cast where the
  fire does not. `tests/render3d/lights.test.ts` sweeps `ENEMIES`, `RESOURCE_NODES` and `BUILDINGS`
  for it, so a row added later answers for itself.
- **The depth cue is measured in camera distances, and starts nearer than the player**
  (`fogRange` in `camera.ts`). That is where it stops being weather and becomes a cue: real haze
  would not care which way the phone is held, but a landscape camera sits less than half as far back
  as a portrait one, so a fog in world units grazes the horizon on one and swallows half the zone on
  the other. There are barely 1.6 camera distances between the player's feet and the furthest ground
  anyone looks at, so starting past them leaves nothing to fade with — three's fog ramps on a
  smoothstep, whose near end is flat, so starting at 0.9 puts the player three percent in and buys
  the whole range back. A **readout** opts out of it entirely (`fog: false` on the nameplates, the
  signs, the floats, the bolt and the selection ring), for the reason those already opt out of the
  depth test: the post fades and the word over it does not.

**What it costs is measured rather than assumed.** `DebugView.drawTime()` is a rolling mean of what
the last thirty drawn frames cost, kept by the host so it times the call _into_ whatever is drawing;
smoke's throttled section asserts `SLOW_DRAW_BUDGET_MS` on it under an eight-times slower CPU. The
sun, the shadow map and the depth cue together took a full run from 20.7ms to 25.2ms against a 40ms
ceiling. Read it off a **full** run — the section carries state forward from every one before it, so
`--section=throttled` alone is a lighter game and a different number. Raising the ceiling is a
decision about the game, not about the run that hit it.

**A nameplate stacks up to five things and only the health bar may not move** (`render3d/nameplate.ts`):
the quest marker, the name, the worn title, the bar at the group's origin, and the player's mana
under it. Putting a title on pushes the _name_ up rather than sliding the bar down, because the bar
is the one thing there read at a glance mid-fight; the mana bar hangs _below_ the origin for the same
reason, since anything inserted above it would move everything else. Only the player has one, and it
disappears outright for a class with no pool — an empty bar reads as a caster who is out, not as a
warrior. The name is the only line counted as a `label` by `drawnCounts` — `marker` and
`title` have their own kinds precisely so smoke's one-label-per-drawn-creature assertion stays true
by construction. All three are polled off `character.state` once a frame rather than pushed by an
event, since what moves them (an item in the bag, a title worn) publishes nothing.

**Every line on a plate is a fraction of the one it hangs off**, so `labelHeight` is the single
number that squishes a whole plate and the gaps close with it — a plate that shrank its bar and kept
a mob's spacing around it would not have got any smaller. The player's is squished and floats higher
than everyone else's (`PLAYER_PLATE` / `PLAYER_PLATE_CLEARANCE` in `actors.ts`): theirs is the only
one stacking a pool under the bar and a title over the name, and it is drawn on the figure the camera
keeps centred, where a low camera angle pushes anything at head height into the head.

**`render3d/actors.ts` is one actor per simulated thing**, catching up to it in `sync()` once a
frame — and an actor that forgets `dispose()` leaks GPU memory, so every one of them ends in
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
station → building → ground, which is a **priority, not a depth sort**: a rat in
front of the shopkeeper does not stop you shopping. Only within one kind does the nearest win. The
ground is the mathematical `y = 0` plane rather than the terrain mesh, because the mesh stops at
the map edge and the simulation does not.

**The last two are below the creatures for the same reason, and the building is the extreme case of
it.** A kind ranked above mobs wins from _anywhere along the ray_, including well behind what is
being aimed at — a forge is a tile of furniture near the middle of town and a shopfront is three
tiles of it, so either one above the mobs silently eats every tap on the rat beyond it. The building
is also the only kind that answers as something else: it resolves to `{kind: 'ground'}` at whatever
`tapPoint` says — its doorstep, or the room once you are standing on that doorstep — which needs no
new `WorldTap` kind, no case in `ZoneWorld.tap` and no line in the context menu. Left to fall through
instead, the ray would carry on over the roof and land on the grass _behind_ the building — which
used to walk the player into the back wall and, now that a walk routes, walks them all the way round
the block instead. The second is the worse of the two: a tap on a shopfront that ends up behind the
shop is a minute of walking rather than a wall to back away from. And from _inside_, a building is
not picked at all (`pickBox()` answers `null`), because there the same box is a lid over the floor.

**A tap and a drag are the same three events, and `render3d/orbit.ts` is what tells them apart.**
A drag turns the camera's yaw around the player; a tap asks the world for something. The rule is a
**latch**, not a comparison: a gesture becomes a drag once its _cumulative_ travel passes
`TAP_SLOP_PX` and can never go back, because a drag out and back finishes where it started and
releasing there must not walk the player somewhere. Time is the other half — a thumb resting on the
screen past `TAP_MAX_MS` is not a request to walk. Only the horizontal component turns anything:
pitch is not the player's to change, since it is what keeps the world clear of the tab bar _and_
what guarantees every pixel on screen is ground rather than sky. The host owns the events, the
pointer capture and `touch-action: none`; `ZoneView3D` owns the angle, and it outlives a zone.

**A press held is the third thing those events can mean, and it is a question rather than a
request.** Right-clicking — or, on a phone, resting a finger — asks what something is: the host
resolves the same pick a tap uses and calls `world.inspect(tap)`, which answers with a menu and
**changes nothing** (a player reading a drop table mid-chop has not decided to stop chopping).
`LONG_PRESS_MS` is `TAP_MAX_MS`, deliberately: a press held that long had already stopped being a
tap and did nothing at all, so the phone's right click costs no gesture that meant something else.
Reaching it **latches** (`holdAsLongPress`) — at exactly 500ms the press is a menu and never also a
walk, which is not something a comparison against the clock can promise. The numbers live in
`ui/gestures.ts` rather than in the renderer because `hud/longPress.ts` reads them too: a bag cell
and a rat have to answer to the same press, and an element in an overlay has no drag to
disambiguate against and no pointer to capture, so all that is left of the rule there is a timer.

The menu itself is the ask/answer split the shop makes, and the reason is the same one twice over.
`world/ContextMenuSession.ts` holds **the only reference to the rat**; the HUD is handed a
description and sends back a bare `ContextActionId`, so a panel in an HTML overlay never outlives
the zone it was about, and a line chosen after the mob died, after the zone changed, or naming
something other than what was pressed resolves to nothing. Choosing an action runs it through
`ZoneWorld.tap` — a menu is a slower way of saying the same thing, not a second set of rules about
attacking and gathering. Everything a menu _shows_ comes from `systems/InspectSystem.ts`, which is
a pure function of the data tables and is settled at the moment the menu opens: a drop rate on
screen is the number `rollLootTable` rolls against, and a card left up is describing rats rather
than a stale rat. Anything that ticks stays off it on purpose — a creature's current HP belongs to
the target frame, which is redrawn as it changes.

Two things follow from the camera being movable at all:

- **W means up the screen, not north.** `InputState.setViewYaw()` rotates the keyboard's vector into
  simulation space, and the host sets it whenever a drag moves the camera. Without it the two mean
  the same thing only while the camera is looking north, which is disorienting in a way no state
  assertion calls a bug.
- **Whatever the camera ends up behind gets faded** (`render3d/occlusion.ts`), because you cannot
  tap what you cannot see and tapping is the whole game. One ray from the camera to the player's
  feet — the lowest point on them, so it fades a fraction early — against a box per prop. The box is
  the **drawn** canopy, not the collision trunk it stops you with and not the thumb-sized volume it
  is picked by: three different questions about the same tree. A **building** answers two of the
  three with its footprint — what hides you and what a thumb aims at — where what stops you is its
  walls, and it is the thing the fade exists for most, being the only object big enough to leave
  nothing on screen to tap. Its sign is deliberately left solid: a shopfront the camera is behind
  still has to say which shop it is. Fishing spots are excluded on purpose, being the one prop drawn
  transparent already. And a building the player is _inside_ opts out of the fade entirely — see the
  cutaway above, which is the same question with the opposite answer.

## Conventions

- Prettier is the source of truth for formatting (single quotes, semicolons, trailing commas,
  100-char width) — run `npm run format` rather than hand-wrapping lines.
- `noUnusedLocals`/`noUnusedParameters`/`erasableSyntaxOnly` are enabled in `tsconfig.json`;
  `npm run typecheck` fails on unused code, so don't leave it behind. `npm run build` will not —
  it is `vite build` alone, and the typecheck is its own CI step rather than a side effect of it.
- Comments in this codebase are used sparingly and only to explain non-obvious _why_ (see
  existing examples like the version-swap note in `persistence/index.ts` or the one on
  `ARRIVE_STEP_FRACTION` in `systems/MovementSystem.ts`, which explains a constant no reader
  could derive) — match that style rather than narrating what code does.
