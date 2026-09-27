# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

It holds the rules and a map. The reasoning behind each subsystem — why it is shaped the way it is,
and what was learned getting it there — lives in `docs/architecture/`, one file per topic (see
[Where the reasoning lives](#where-the-reasoning-lives)). Read the topic file before changing the
topic; it is where the traps are written down.

## Project

A small, old-school-flavored MMORPG (EverQuest/RuneScape/WoW-inspired), built as a learning side
project by a professional software engineer with no prior game-dev experience. v1 is single-player:
ten zones from a level 1-3 starter band (town, beach, quarry, bandit camp, the locked bandit
hideout) up through the Old Mill Road, Blackwater Fen, the Deep Cut and Greyford Outpost to the
locked Sunken Barrow at level 7-8; three classes, the third a ranger whose bow spends an arrow a
shot; three gathering skills and four making ones, the fourth fletching the ranger's arrows; gear,
armour and reforging; two-way combat with telegraphed enemy abilities; a shop, a bank, a trainer, a
quest chain and a contract board, and a barter counter at Greyford; slayer achievements, titles and
per-target mastery; an AFK camp that pays out offline; click/tap-to-move with a mobile-first HUD;
and local save/load with versioned migrations. `docs/architecture/zones.md` has the full roster and
what each zone is for.

**Work in progress is planned in a doc before it is built**, phased into PRs with the argument for
each decision in it. The **live plan** is `docs/v2_plan.md`: **version 2**, a solo zero-to-hero
redrawn in 2D pixel art, with bigger zones, people and lore, a house, and a cap of 20 (decisions
80-88). **Check its status line before starting anything** — it says which phase landed and which is
next — and its "Starting cold" section. Its parts each end in a review phase that amends the plan,
so read it as it stands, not as it was. Finished plans go to `docs/archive/`. Anything big enough to
phase gets a new plan doc rather than being started against this file alone.

**Decisions that closed off a real alternative go in `docs/decisions.md`**, appended and never
edited. That file is not a duplicate of this one: this describes the shape of the system as it
stands, where that records the _forks_ — what was chosen, by whom, what was rejected and why — so
the same argument is not had twice. A decision with no alternative is not a decision and belongs
beside the code instead.

Per-feature briefs live in `docs/feature_N_*.txt`. They are the original prompts, kept as a
historical record of what each feature was asked for — not current spec, and superseded by the
code wherever the two disagree (`feature_6_v1.txt` asks for crabs at level 4-6; `spawns.ts` puts
them at 1-3, and `spawns.ts` is right). The original long-term vision is in
`docs/initial_design.txt` (multiplayer, more zones, more skills) — most of it is intentionally not
built, and **its multiplayer is no longer the direction**: the game is solo (decision 80). Don't
assume features from that doc exist in code.

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

## Verifying a change

**Gameplay rules belong in `tests/world/`, not in smoke.** The simulation is headless, so a whole
zone can be driven through combat, aggro, gathering, trading, cooking, camping and casting in
vitest. `tests/world/harness.ts` hands back the world, the character, the keyboard and a
`tick`/`until` pair measured in game milliseconds.

**`scripts/smoke.mjs` covers what only a browser can**: the game booting, real mouse, touch and key
events, the view building and _unbuilding_ itself (GPU memory flat across zone round trips), the
HUD's geometry at real viewport sizes, the save round trip through a reload, and a CPU-throttled
draw budget. Reach for it whenever a change touches the renderer, an actor or the HUD. It runs on a
portrait phone in a touch-capable context, under **`?loop=manual`**, which puts the simulation on a
hand crank (`window.view.step(deltaMs, frames)`), so every wait is in game milliseconds.

It reaches the game through three dev-only handles, stripped from production by an
`import.meta.env.DEV` guard and typed for the smoke script in `scripts/globals.d.ts`:
**`window.world`** (the live `ZoneWorld`), **`window.view`** (the small renderer-agnostic
`DebugView` in `src/types/debugView.ts`) and **`window.events`** (the HUD channel). Nothing else is
exposed; the HUD needs no handle because smoke clicks its real elements.

Two environment notes that will otherwise waste your time:

- **`tests/setup.ts` installs an in-memory `Storage`.** Don't delete it, and don't "fix"
  `LocalStorageSaveService` to work around the stub Node's own `localStorage` leaves in jsdom.
- **The first `npm run dev` request cold-compiles ~520 kB of Three.js**, so browser waits need
  generous timeouts on a cold cache.

**A frame-rate bug is reproduced by asking for the frame, not by throttling a machine**:
`view.step(140, 50)` in a browser, `tick(steps, deltaMs)` in the harness. The draw budget is the
other half and is only measurable under smoke's throttled section — and only honestly on CI (a
loaded dev container reads 10ms high). `docs/architecture/testing.md` has the full account of both.

## Architecture

**Stack**: TypeScript bundled with Vite, rendered in 3D with Three.js (`src/render3d/`). It was
Phaser 4 in 2D until `docs/archive/3d_port_plan.md` replaced it. No backend — everything is a
static site. Character data lives in the browser's `localStorage`.

**The core seam: `render3d/` knows there is an engine and nothing else does.** `systems/`, `data/`,
`persistence/`, `types/`, `config/`, `world/`, `hud/` and `ui/` are plain TypeScript that would run
under any renderer or none, and `src/bootFlow.ts` takes a `GameHost` rather than anything the engine
defines. It is what makes them unit-testable with no engine to mock, and the boundary a whole
renderer was swapped across. Put new rules in those modules and call them from the view, never
inline in an actor. `tests/architecture/phaserFreeSeam.test.ts` guards the old engine staying out.

**The simulation is `src/world/`; `src/render3d/` only draws it.** `ZoneWorld` owns the player, the
mobs and the nodes and steps them from `update(deltaMs)`; the actor classes in `render3d/actors.ts`
catch up to them in `sync()` once a frame. New gameplay goes in the world, not the view. Nothing in
`world/` may own an engine timer or tween — every clock is an accumulator against the frame delta —
and collision bodies are data (`EnemyDefinition.body`), never measured off anything drawn.

**The rules are `ZoneWorld`'s collaborators, one per subsystem** (`CombatDirector`,
`GatherSession`, `AbilityCaster`, `AfkCamp`, the counter sessions, `QuestDesk`, `LootPiles`,
`ContextMenuSession`, `ApproachDriver`). Each owns its state and reaches the zone through the shared
`WorldContext` and a small `Deps` interface of its own — never a reference to the world. A new rule
belongs in the collaborator that owns the state it reads. What stays in `ZoneWorld` is the entities,
the tick order, what is selected, the publishers that speak only on change, and the three things
that stop everything at once: a zone change, a death, a teardown.

**`GameContext` is the session** — everything that outlives a zone — and the only thing that builds
or tears down a world. **A zone change is a view rebuild**: whatever creates a mesh destroys it
(`disposeTree` frees geometry, material and texture), and smoke holds GPU memory flat across round
trips because a leak is invisible everywhere else. Anything the HUD must hear before it is mounted
goes in the notification queue, not an event.

**There are two channels out of the simulation, and they are not interchangeable.** The **HUD
channel** is the `EventBus` (`src/ui/uiEvents.ts`): state the HUD re-renders from, where the latest
one always describes the present. The **view channel** is the `WorldEvent[]` that `update()`
returns: moments (a hit, a bolt, a float) a view cannot recover from state, naming a `tone` rather
than a colour. Add HUD-facing state by adding an event, not by reaching across modules; payloads of
more than two or three values are one object.

**Zones are rows, not code.** A new area is a `ZONES` row in `src/data/zones.ts` plus exits both
ways, and its map, mobs, nodes, NPCs, buildings and stations come from that row. Walking is the only
way into a zone. **An exit needs its whole shared edge walkable on both sides, one arrival-inset
in**, and every spawn, building and wander disc is held by sweeps (`ZoneSystem.test.ts`,
`BuildingSystem.test.ts`, `spawnSafety.test.ts`, `render3d/picking.test.ts`) — expect a new zone or
exit to cost a spawn or a building moved somewhere else.

**Data-driven definitions** (`src/data/`, keyed by the id unions in `src/types/ids.ts`): classes,
items, enemies, spawns, loot, quests, bounties, recipes, zones, maps. Prefer a row over code — a new
enemy is an `ENEMIES` row plus a loot table, and the renderer picks its body from `shape` and its
colour from `render3d/palette.ts` without a line written for its id. `Record<Id, …>` and
`exhaustive<Id>()` are how a new id becomes a compile error everywhere it has to be answered.

**State that can be derived is derived.** Quest progress counts the bag or a tally on read; buffs,
quest markers, achievements, titles and mastery rungs are computed when asked. Only three tallies
are stored — kills, zone visits and mastery XP — because a corpse, an arrival and a chopped tree
leave nothing behind to count. Keep that split.

**`CharacterState` changes go through `systems/CharacterController.ts`**, which refuses as a whole
rather than half-applying. Anything the world hands the player goes through `tryAddItem`, which can
fail on a full pack — handle the refusal — and which puts an arrow in the quiver before the bag sees
it, so `addItem` straight into the bag skips a rule as well as a check. What comes off a station is
the one thing never refused, since its inputs were spent first, and it goes through `addMadeItem`,
which still quivers an arrow first. A kill's refusals become a loot pile where it fell, unless
the player is camping (`docs/architecture/economy.md`).

**Persistence**: import the `saveService` singleton from `src/persistence/index.ts`, never construct
`LocalStorageSaveService`. When `CharacterState` changes shape, bump `CHARACTER_STATE_VERSION` and
add a step to `persistence/migrations.ts`; a save with no chain to the current version is dropped.

**Frame rate is not an assumption you may make.** A cheap phone steps the game at single-digit fps.
Any distance compared against a fixed threshold scales with the frame's travel (`arriveRadius`),
`moveWithCollision` substeps so 46px of travel cannot tunnel a wall, and `PLAYER_HALF_EXTENT` must
stay below `EXIT_MARGIN` or zone exits silently stop firing.

**The HUD is an HTML overlay** (`src/hud/`, engine-free) that talks only to the `EventBus`. The
overlay is `pointer-events: none` with furniture opting back in, so no tap is ever hit-tested
against it. Geometry is computed in `ui/layout.ts` (unit-tested at real sizes), styling is one
stylesheet interpolated from `ui/theme.ts`. **The bar holds five tabs; a new surface goes behind
Menu** (`MENU_TABS`), and **nothing in the world may be drawn under the tab bar** — the camera's
framing holds that, measured in `tests/render3d/camera.test.ts` and in smoke.

**The renderer loads no files.** Every mesh is primitives, terrain is one vertex-coloured mesh, and
the only textures are text baked onto a canvas (`docs/decisions.md` 54 keeps it that way). A tap is
picked against boxes in a fixed **priority** (node, signpost, NPC, mob, station, building, loot
pile, ground), not a depth sort. What a frame costs is a budget smoke asserts under an eight-times-throttled CPU;
raising it is a decision about the game, not about the run that hit it.

**Sound loads no files either** (`src/audio/`, engine-free and owned by the host). Every cue is
synthesised from a recipe in `cues.ts`, and the board hears the same `WorldEvent[]` the view is
handed plus two HUD events (coin, achievement) — it never reads the world. So **a moment the view
draws from state still needs a `WorldEvent` if it makes a sound**, since a sound cannot poll. Mute
and volume are kept per device, not in `CharacterState`.

**Balance is held by simulations, not judgement.** The duels in `EnemySystem.test.ts` hold the
combat curve (a fresh level 1 beats a level 1 rat comfortably, sweats a 2, loses to a 3 — the ranger
stood still and shooting included, and a warrior's bow losing), the
progression test holds the starter arc to level 3, the upper band's chain to riding the climb rather
than making it, the cap to one level past the richest spawn, and the arc's arrows to well under half
its coin, `deadEnds.test.ts` holds that
nothing handed out leads nowhere, `uniqueLoot.test.ts` holds boss drops unique, and unattended play
stays behind active play (half XP, no abilities, an offline cap).
Change a stat, a table or a curve and retune until those pass rather than eyeballing it.

## Where the reasoning lives

| Topic                                                              | File                              |
| ------------------------------------------------------------------ | --------------------------------- |
| The tick, collaborators, session, channels, death, pathing, saves  | `docs/architecture/simulation.md` |
| The zone roster, exits, locks, the Greyford loop                   | `docs/architecture/zones.md`      |
| Walls, doorways, rooms, counters indoors, the cutaway, room light  | `docs/architecture/buildings.md`  |
| Shop shelf, selling, bank, NPC roles, reforging, the full pack     | `docs/architecture/economy.md`    |
| Tools, recipes, stations, tiers, cooking, dead ends                | `docs/architecture/making.md`     |
| Loot rules, quests, bounties, stored tallies, mastery              | `docs/architecture/content.md`    |
| Abilities, levels, difficulty, the cap, crits, armour, bosses      | `docs/architecture/combat.md`     |
| The AFK camp and offline progress                                  | `docs/architecture/afk.md`        |
| The HUD's pieces, the map, layout, tabs                            | `docs/architecture/hud.md`        |
| Camera, terrain, light, draw budget, nameplates, picking, gestures | `docs/architecture/rendering.md`  |
| Sound: what it hears, cues, ambience, unlocking, mute and volume   | `docs/architecture/audio.md`      |
| Tests vs smoke, the dev handles, the hand crank, frame-rate bugs   | `docs/architecture/testing.md`    |

When a change moves one of those subsystems, the topic file is what gets corrected — and when it
adds a rule a later change could break without a test noticing, that rule goes here too.

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
