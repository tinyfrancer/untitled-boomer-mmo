# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A small, old-school-flavored MMORPG (EverQuest/RuneScape/WoW-inspired), built as a learning
side project by a professional software engineer with no prior game-dev experience. Currently
v1: single-player only; four zones (town with leveled rats and a shop, a beach with crabs and
ocean fishing, a bandit camp with aggressive humanoids, and the bandit hideout behind a locked
door); character creation, leveling, gear,
two-way combat with death and respawn; gathering/cooking skills; currency and vendoring;
a weight-limited pack; two collection quests from the shopkeeper; slayer achievements and the
titles they grant; an AFK camping mode that also pays out offline; click/tap-to-move with a
mobile-first HUD; and local save/load with versioned migrations. Every zone is level 1-3 starter
content — what separates them is what they drop, not how hard they are, and the hideout is gated by
a rare key rather than by a level. The one exception is the named mob at the back of it, who is
level 4, carries the only loot in the game that comes off a single creature, and is the fight
everything else is the run-up to.
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
  A landscape camera frames twelve tiles of _depth_ rather than of width, so the south signpost is
  out of frame from the spawn point; what holds is that walking toward it brings it into reach.
- **A CPU-throttled pass at `rate: 8`, cranked at 140ms a frame** — see "Reproducing a
  frame-rate-dependent bug" below for why that is two questions rather than one.

It reaches the game through three dev-only handles, one per channel:

- **`window.world`** — the live `ZoneWorld`, re-set on every zone change since each builds a new
  world: `world.mobs`, `world.player.hp`, `world.teleport(x, y)`.
- **`window.view`** — the handful of questions only whatever is drawing can answer:
  `worldToScreen(x, y)`, `drawnCounts()`, `playerFigure()`, `gpuMemory()` and `step()`. The
  interface is `src/types/debugView.ts`, and it is deliberately a small renderer-agnostic one —
  that is what let the renderer be replaced under smoke rather than alongside it.
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
  _from_ the data, which is the direction that keeps the two agreeing.

**The rules themselves are `ZoneWorld`'s collaborators, one per subsystem**: `CombatDirector`
(both directions of a fight and what a corpse is worth), `GatherSession` (the channel, the fire,
the pan, the food), `AbilityCaster` (whether a button may be pressed, and the spell part-way
through), `AfkCamp`, `ShopSession`, `QuestDesk`, `ContextMenuSession`
(what a press held is about, and what was chosen from it), and `ApproachDriver`
(the two click-to-move walks). Each owns its own state, is constructed by `ZoneWorld` and reaches
the rest of the zone through two things and no others: the `WorldContext` they all share — the
clock, the character, the player, both channels out of the simulation, and the handful of
publishers more than one of them needs — and a small `Deps` interface of named hooks declared in
its own file. A new rule belongs in the collaborator that owns the state it reads; a new
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
view code. Travel from the world map is the third route in and goes through the same tables;
`ZoneWorld` refuses it mid-fight, which is the one thing it can do that a walk cannot.

**A zone may be locked, and the key is spent rather than carried** (`ZoneDefinition.requiresKey`,
ruled on by `systems/ZoneAccessSystem.ts`). `zoneAccess` answers three things and not two — `open`,
`locked`, and `unlockable`, which is "shut, and the key is in the pack" — because a door about to
open costs something and the caller has to know that before it walks through. All three routes into
a zone ask `ZoneWorld.openWayInto`, which is the **only** place a key is ever spent, so "consumed
once, open for good" is one rule rather than three; leaning on a shut edge is latched
(`blockedAtEdge`) so the refusal is one toast rather than one a frame. What the key opened is stored
on `CharacterState.unlockedZones` and is the one thing here that could not be derived — the key is
gone afterwards, so an empty pack means either "never found one" or "already been", and the world
map draws those two cells very differently. The bandit hideout is the only locked zone today; its
map (`data/banditHideoutMap.ts`) is the inverse of every other one, solid `WALL_TILE` with rooms
painted back out of it, which is why `tests/systems/ZoneSystem.test.ts` checks that an arrival
_anywhere_ along an exit edge lands on walkable ground rather than only where the signpost stands.

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

**The map zooms out, and the zoomed-out view is how you travel** (`worldMap()` in
`systems/MapSystem.ts`). Its whole layout is **derived from the exits already in `ZONES`** — walked
breadth-first from town, placing each zone one step from its neighbour in the direction the edge
that reaches it points — so a coordinate cannot drift out of step with where walking actually takes
you, and a zone added to the table with its exits wired appears on the map with nothing else written
down. A zone's level band is derived the same way, off its own `mobSpawns`. Tapping a cell asks to
travel; the world decides, and refuses while **anything is engaged on the player** — deliberately
not `player.isInCombat()`, which is a regen lockout a freshly built world starts inside, so using it
would leave someone unable to leave a zone for seconds after arriving in it. Travel records no
position in the zone it is sending them to, which is what puts them on its spawn point rather than
wherever they last stood there.

A locked zone is drawn shut on that view and is **still tapped like any other cell** — whether a
door opens is the world's answer, and the toast it refuses with is what a phone reads the reason off,
there being no tooltip to hover. The cell is drawn from `zoneAccess`'s three answers, so holding the
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

**Selling a stack is one request with a count on it**, not a second rule about vendoring:
`sell-item-requested` carries a quantity, `ShopSession.sell` clamps it to what the pack actually
holds, and "sell all" is that number rather than a separate path. The clamp is what makes the panel
safe to draw from a copy of the bag — a stale count can only ever sell fewer. **The two are separate
targets**, though: the shop row and the bag's Sell button still part with one, and emptying a stack
is a button of its own beside them (`sell-all` in `ItemActionsSystem`, `.hud-sell__all` in the shop
panel). A stack of quest turn-ins is exactly the thing a mis-tap must not be able to sell, so the
bulk button is deliberately the smaller of the pair rather than the row itself growing a second
meaning — and it is offered only on a stack, since on one of something it is the Sell button beside
it wearing a longer name.

**The paperdoll is SVG built from the same rig the figure in the world is built from**
(`systems/AppearanceSystem.stickFigure`, drawn by `hud/paperdoll.ts` and by `render3d/figure.ts`).
The HUD does not reach into the renderer for a canvas, which is what let the sheet keep showing
what you are wearing when the world became meshes. Both read that rig, so a shoulder is in the same
place in either; `NPC_APPEARANCES` beside it is the same argument for the two figures nobody is
wearing gear for, the shopkeeper and the bandit.

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
because tearing this world down is its job too. Travelling from the world map is the same handover
under a different event. HP rides across both, so crossing a line is never a free heal. A frame
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
of dying, which is why the spawn point is safe by construction — it is the middle of the map, where
travelling from the world map already puts someone, and no zone's centre sits inside an aggro
radius.

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
stays the renderer's, keyed by the same shape in `render3d/palette.ts` — with one exception the
table always said would come: `CREATURE_OVERRIDES` there keys a look to an `EnemyId`, for a second
humanoid who is not the same man as the first. A named mob standing in a room full of its own men
is precisely the case where sharing a shape's colour is wrong. **How big a person is drawn comes
off the body too**: `buildHumanoid` scales the rig by `body.width / TILE_SIZE`, so the chief takes
up half again the room a bandit does and looks it, in the same direction everything else here runs
— what it _is_ decides what it looks like, never the other way round.

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

**Quest progress is derived, not tracked** (`systems/QuestSystem.ts`). `CharacterState.quests` holds
only `active | done` per quest; how far along a "bring me N of X" objective is gets counted off the
inventory on read. Items reach the bag from loot, gathering, cooking, buying and offline camping,
and counting on read means none of those paths can forget to bump a counter. The marker over a quest
giver's head (`npcMarker`) is derived the same way, which is **why the view polls it**: what moves
that glyph is an item landing in the bag, and nothing publishes that. `NpcActor.sync()` reads it off
`character.state` each frame like `MobActor` reads the con colours, and the sprite is tagged
`userData.kind = 'marker'` rather than `'label'` — smoke asserts one label per drawn creature in
every zone, so a second label over a head would break that everywhere. `turnInQuest` on
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
Use it rather than `addItem` for anything the world hands the player, and handle the refusal.
**What a refusal means depends on who is watching**: an attended player is stopped — they are right
there and can make room, and nothing is destroyed while they do — where an unattended one keeps
going and loses the haul, since the swing happened and stopping the camp dead would cost them a
night's XP rather than one load of logs. `GatherSession` asks `isCamping()` to tell the two apart.
Currency is weightless and never fails.

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

**What a camp does is read off the tool, not out of a mode** (`afkGatherSkill`). A gathering tool
_is_ the weapon slot, so a fishing pole or a felling axe makes the Camp tab a gathering camp and a
sword, a wand or an empty hand makes it the fighting one — the same question `canGather` already
asks, which is why this needed nothing stored, no migration and no second button. It re-derives
every frame, so a gear swap changes what the camp is doing. A gathering camp works the nearest
ready node of that skill inside the anchor radius and moves to the next when one is chopped out
(`chooseAfkNode`, whose `wait` and `none` are deliberately different answers: waiting is what a
camp does between respawns, `none` means the tool has no work in this zone and the caller falls
back to fighting). Anything already chasing is answered first whichever camp it is — being hit
breaks the channel, so a woodcutter that ignored it would re-arm a gather it could never finish
until it died.

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

**Levels scale both sides.** Enemies carry a `level` and derive HP/damage/XP from
`base + perLevel` via `scaleEnemyStats()`; characters grow through `perLevel` on their class and
`computeEffectiveStats(classId, gear, level)`. Keep those in step — making enemies tougher
without giving characters growth (or vice versa) silently breaks the difficulty curve. Enemy
name colors come from `conColor()` in `systems/EnemySystem.ts`: gray/green below the player,
white even, yellow +1, red +2 and up. Every zone sits in the 1-3 band except the chief at the back
of the hideout, who is level 4 and is what makes the top of that scale reachable at all.

**`MAX_CHARACTER_LEVEL` is a claim about the content, not about the curve**, and it is 5 because
that is where the content reaches: the hardest thing in the world is the level 4 chief, and the ten
it used to be was 30,720 XP over seven levels with nothing built for them. Max level is meant to be
an achievement rather than an asymptote, so **a zone added raises the cap** — and
`tests/systems/progression.test.ts` is what holds the two together, asserting that the cap sits one
level past the highest thing that spawns and that the climb from the end of the starter arc is
another session or two of the best kill there is rather than another game.

Two things ride the cap and have to move with it, which is exactly what neither did before: the
combat skill ceiling is `combatSkillCap` (`level × 10`, so 50 now), and **what a trained combat
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
(`render3d/ground.ts`) and every entity is untextured primitives (`render3d/figure.ts`,
`creatures.ts`, `props.ts`). The only textures uploaded are text baked onto a canvas by
`render3d/text.ts` — a nameplate's name and a floating damage number — which is also the reason
`disposeTree` names `material.map` explicitly, and the reason the unit suite stubs a 2D context
(jsdom has none). Tile colours live in `TILE_COLORS` in `data/tiles.ts` rather than in the renderer,
for the same reason the stick-figure rig behind the paperdoll does: the ground the simulation calls
water is a decision the whole game makes. Creature colour is not — `render3d/palette.ts` is the
renderer's own, and nothing outside it asks what colour a rat is.

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
ground, which is a **priority, not a depth sort**: a rat in
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
  is picked by: three different questions about the same tree. Fishing spots are excluded on
  purpose, being the one prop drawn transparent already.

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
