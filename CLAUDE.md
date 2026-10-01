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
per-target mastery; idle play (the code's AFK camp) that pays out offline; click/tap-to-move with a mobile-first HUD;
and local save/load with versioned migrations. `docs/architecture/zones.md` has the full roster and
what each zone is for.

**Work in progress is planned in a doc before it is built**, phased into PRs with the argument for
each decision in it. The **live plan** is `docs/v2_plan.md`: **version 2**, a solo zero-to-hero
redrawn in 2D pixel art, with bigger zones, people and lore, a house, and a cap of 20 (decisions
80-88). **Check its status line before starting anything** — it says which phase landed and which is
next — and its "Starting cold" section. Its parts each end in a review phase that amends the plan,
so read it as it stands, not as it was. **From C11 its phases are built several at a time**, each
by its own session from the brief and the rules in `docs/v2_parallel_plan.md` (decision 123): read
your phase's brief there before anything else, and take the decision number and the save version at
the merge, not at the branch. Finished plans go to `docs/archive/`. Anything big enough to
phase gets a new plan doc rather than being started against this file alone.

**The world's lore is `docs/lore/`** (decision 114): the realm, its history, peoples, factions and
places, the spirit's story, the tone with examples, and how things are named. A new name, person,
rumour or line of dialog is taken from it and written in its voice, a fact it lacks is added to it
in the same change, and a name reaches the game in the phase that rebuilds where it is. **The lore
is Claude's**: the user plays to find the story out, so story is never asked of them and never
retold to them — a PR or a summary names the parts it touched, not what they now say. Mechanics
stay the user's to settle.

**Decisions that closed off a real alternative go in `docs/decisions.md`**, appended and never
edited. That file is not a duplicate of this one: this describes the shape of the system as it
stands, where that records the _forks_ — what was chosen, by whom, what was rejected and why — so
the same argument is not had twice. A decision with no alternative is not a decision and belongs
beside the code instead.

Per-feature briefs live in `docs/feature_N_*.txt`. They are the original prompts, kept as a
historical record of what each feature was asked for — not current spec, and superseded by the
code wherever the two disagree (`feature_6_v1.txt` asks for crabs at level 4-6; `beachMap.ts` puts
them at 1-3, and `beachMap.ts` is right). The original long-term vision is in
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

CI runs on pull requests, not on the merge (`.github/workflows/ci.yml`): `gates (node 25)` runs
lint/format/typecheck/coverage/build, and `browser smoke` runs the real Playwright check on a PR
that is ready for review, never on a draft. Node 22, the LTS floor, is covered by running the gates
locally in the cloud sessions, which run on it. **The smoke job blocks merges**, so run
`npm run smoke` locally before opening a PR rather than finding out from CI. Don't commit on a red suite, including failures that pre-date
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

Merging to `main` triggers a Vercel production deploy, so a merge publishes. Nothing else deploys:
`vercel.json` turns off the preview a branch push used to build.

**CI runs and deploys are spent where they decide something** (decision 95). The repo has been
public since decision 95, so Actions minutes no longer run out, but a PR's run still takes about 10
minutes (the gates about 3, smoke about 7), a hung job is stopped by its `timeout-minutes` rather
than GitHub's six hours, and Vercel's Hobby plan allows 100 deployments a day.
So run every gate locally, smoke included, before a phase's first push; push a phase when it is
green rather than commit by commit; open its PR when it is done, or as a draft while it is still
moving, since a draft runs the gates alone and marking it ready is what runs smoke; and batch a CI
fix rather than pushing one guess at a time.

## Verifying a change

**Gameplay rules belong in `tests/world/`, not in smoke.** The simulation is headless, so a whole
zone can be driven through combat, aggro, gathering, trading, cooking, camping and casting in
vitest. `tests/world/harness.ts` hands back the world, the character, the keyboard and a
`tick`/`until` pair measured in game milliseconds.

**`scripts/smoke.mjs` covers what only a browser can**: the game booting, real mouse, touch and key
events, the view building and _unbuilding_ itself (canvases flat across zone round trips), the
HUD's geometry at real viewport sizes, the save round trip through a reload, and a CPU-throttled
draw budget. Reach for it whenever a change touches the renderer, the art or the HUD. It runs on a
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
- **The first `npm run dev` request cold-compiles the whole game**, so browser waits need generous
  timeouts on a cold cache.

**A frame-rate bug is reproduced by asking for the frame, not by throttling a machine**:
`view.step(140, 50)` in a browser, `tick(steps, deltaMs)` in the harness. The draw budget is the
other half and is only measurable under smoke's throttled section — and only honestly on CI (a
loaded dev container reads 10ms high). `docs/architecture/testing.md` has the full account of both.

## Architecture

**Stack**: TypeScript bundled with Vite, rendered in 2D with Canvas 2D (`src/render2d/`): pixel art
drawn at art resolution and scaled up by whole device pixels (decision 101,
`docs/architecture/art.md`), about ten tiles across a phone and never more than two CSS pixels to
the art pixel, so a big screen sees more of the world rather than a bigger one (decision 112). It was Phaser 4 in 2D, then Three.js in 3D after
`docs/archive/3d_port_plan.md`, and version 2 took it back to 2D: B3 made the 2D view the game
(decision 106) and B7 deleted the 3D view and Three.js with it (decision 110). **The game has no
runtime dependency**: `package.json` has no `dependencies`, and nothing in `src/` imports a package.
No backend — everything is a static site. Character data lives in the browser's `localStorage`.

**The core seam: `render2d/` draws the world and nothing but `main.ts` imports it.** `systems/`,
`data/`, `persistence/`, `types/`, `config/`, `world/`, `hud/`, `ui/`, `host/`, `audio/` and `art/`
are plain TypeScript that would run under any renderer or none, and `src/bootFlow.ts` takes a
`GameHost` rather than anything a view defines. The host (`host/host.ts`) takes the view `main.ts`
builds through the `ZoneView` interface (`host/zoneView.ts`), so a host duty is never written inside
the view. It is what makes the rest unit-testable with nothing to mock, and the boundary the renderer
was swapped across twice. Put new rules in those modules and call them from the view, never inline
in a drawing. `tests/architecture/seam.test.ts` holds all three: no package imported anywhere in
`src/`, no runtime dependency, and `render2d/` imported by `main.ts` alone.

**The simulation is `src/world/`; a view only draws it.** `ZoneWorld` owns the player, the mobs and
the nodes and steps them from `update(deltaMs)`; the view draws each frame from it as it stands and
keeps no scene. New gameplay goes in the world, not the view. Nothing in
`world/` may own an engine timer or tween — every clock is an accumulator against the frame delta —
and collision bodies are data (`EnemyDefinition.body`), never measured off anything drawn.

**The rules are `ZoneWorld`'s collaborators, one per subsystem** (`CombatDirector`,
`GatherSession`, `AbilityCaster`, `AfkCamp`, the counter sessions, `QuestDesk`, `LootPiles`,
`ContextMenuSession`, `TipDesk`, `SecretFinder`, `ApproachDriver`). Each owns its state and reaches the zone through the shared
`WorldContext` and a small `Deps` interface of its own — never a reference to the world. A new rule
belongs in the collaborator that owns the state it reads. What stays in `ZoneWorld` is the entities,
the tick order, what is selected, the publishers that speak only on change, and the three things
that stop everything at once: a zone change, a death, a teardown.

**Anything closing on something that moves is a `Chase`** (`world/Chase.ts`, decision 116): a
creature on the player, a creature walking home, and the player's pursuit. It goes straight while the
body has a clear line and otherwise keeps one route until the quarry drifts a tile off its end, never
a plan a frame, which swings between two ways round an obstacle. Both chasers stop **in reach and in
sight**, an aggressive creature notices only a player it can see and has a way to, and a creature
whose chase goes nowhere for `GIVE_UP_MS` gives up through `disengage()`; the leash is still a ring
round home as the crow flies. `docs/architecture/simulation.md` has why.

**`GameContext` is the session** — everything that outlives a zone — and the only thing that builds
or tears down a world. **A zone change is a view rebuild**: every canvas the view makes is made and
let go through one pool (`render2d/canvases.ts`), whatever makes one lets it go, and smoke holds the
count (`view.canvases()`) flat across round trips because a leak is invisible everywhere else. Anything the HUD must hear before it is mounted
goes in the notification queue, not an event.

**There are two channels out of the simulation, and they are not interchangeable.** The **HUD
channel** is the `EventBus` (`src/ui/uiEvents.ts`): state the HUD re-renders from, where the latest
one always describes the present. The **view channel** is the `WorldEvent[]` that `update()`
returns: moments (a hit, a bolt, a float) a view cannot recover from state, naming a `tone` rather
than a colour. Add HUD-facing state by adding an event, not by reaching across modules; payloads of
more than two or three values are one object. **No position travels on the HUD channel once a
frame**: the player's tile and the creatures near them (the minimap's, decision 115) are published
on a whole-tile crossing, the creatures only within `MINIMAP_REACH` of the player.

**Zones are rows, not code, and each is written as text.** A new area is a `ZONES` row in
`src/data/zones.ts` plus exits both ways, and its ground and everything standing on it are a block of
text in its own `src/data/*Map.ts`, read by `layoutZone` (`data/zoneText.ts`, decision 113): a
character a tile, the grounds' characters shared by every zone, and a legend of the zone's own for
the start, creatures, nodes, stations, buildings and secrets (`data/secrets.ts`, decision 117: a
row there and a drawing in `art/places.ts`, found by walking up to it and on no map). A marker stands in the middle of its tile, a
building is a block of its letter exactly its footprint, whoever works in one is named on its row
rather than placed, and a zone's size is its text's. **A secret may lie in a room**, written into its
building's block, and is found only from inside that room (decision 120). Walking is the only way
into a zone. **An exit is open along its mouth**, the whole shared edge unless its row names a
narrower `mouth` (decision 119, a vault's way in, an edge with a stream across it, decision 120, or
a shaft or a barrow's door, decision 121),
and an arrival lands across the mouth of the exit back at the fraction it crossed the other at. **A
mouth needs to be walkable on both sides, one arrival-inset in**, and every spawn, building and
wander disc is held by sweeps (`ZoneSystem.test.ts`, `BuildingSystem.test.ts`,
`spawnSafety.test.ts`, `render2d/picking.test.ts`), and every secret by one that walks up to it
(`tests/world/secrets.test.ts`) — expect a new zone or exit to cost a spawn or a building moved
somewhere else. **So is every creature's way home**
(`spawnSafety.test.ts`): a home its body stands in, with room to turn round, walked back to from
anywhere a chase inside its ring can lead it; nobody lives in a gap exactly a body's width, straight
across or corner to corner (decision 121).

**Data-driven definitions** (`src/data/`, keyed by the id unions in `src/types/ids.ts`): classes,
items, enemies, loot, quests, bounties, recipes, zones and the text they are written in. Prefer a row over code — a new
enemy is an `ENEMIES` row plus a loot table, and it is drawn as its `shape`'s placeholder without a
line written for its id. `Record<Id, …>` and
`exhaustive<Id>()` are how a new id becomes a compile error everywhere it has to be answered.
A new creature is also a row in `art/cast.ts` saying what it is drawn as, which a
test holds every creature to (until then it is its shape's placeholder), and a new node or station
a row in `art/places.ts` (until then a node is its shape's drawing, and a vein drawn in no ore,
which a test holds every vein against: its ore is drawn in the colour of what it yields). A new item
of gear has its HUD icon the day its `art/wardrobe.ts` row lands, and anything else is a row in
`art/icons.ts`, which a test holds every item to.

**State that can be derived is derived.** Quest progress counts the bag or a tally on read; buffs,
quest markers, achievements, titles and mastery rungs are computed when asked. Only three tallies
are stored — kills, zone visits and mastery XP — because a corpse, an arrival and a chopped tree
leave nothing behind to count. Keep that split. **What an item is for is derived too**
(`systems/ItemUseSystem.ts`) from every table that takes items; a new kind of table that takes
them — a counter, a stand, a trade — is taught to it in the same change, or every card it touches
goes quiet about it. **So is what a skill's level buys** (`systems/SkillBookSystem.ts`, the skills
book): it reads the functions the rolls call, so a new rate goes behind an exported function the
book can read rather than inline in a roll, or the book goes on saying the old number. **So is what
idle will do** (`systems/IdlePlanSystem.ts`, the idle panel): it reads `afkCampJob` and
`offlineJob`, the function the payout branches on, so a new rule in the camp or the payout goes
behind those, or the panel goes on promising the old night. **So is when a tip applies, and
what it says** (`systems/TipSystem.ts`): each tip is a rule over the character, and its line reads
the fee, the price or the ceiling it names off the table or constant that holds it. What has been
heard is stored (`CharacterState.tips`), since hearing leaves nothing else behind, and so is every
secret found (`CharacterState.secrets`, decision 117), which leaves nothing either.

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
Version 2's saves count from 100 with no step from before (decision 113): a version 1 save is
dropped the first time it is read, and who was in it is named once on the creation screen. A save also leaves and comes back as a file or a code (`persistence/saveFile.ts`), read through the
same chain and then a check of every field, so a new field is a row in its `FIELDS` as well.

**Frame rate is not an assumption you may make.** A cheap phone steps the game at single-digit fps.
Any distance compared against a fixed threshold scales with the frame's travel (`arriveRadius`),
`moveWithCollision` substeps so 46px of travel cannot tunnel a wall, and `PLAYER_HALF_EXTENT` must
stay below `EXIT_MARGIN` or zone exits silently stop firing.

**The HUD is an HTML overlay** (`src/hud/`, engine-free) that talks only to the `EventBus`. The
overlay is `pointer-events: none` with furniture opting back in, so no tap is ever hit-tested
against it. Geometry is computed in `ui/layout.ts` (unit-tested at real sizes), styling is one
stylesheet interpolated from `ui/theme.ts`. **The bar holds five tabs; a new surface goes behind
Menu** (`MENU_TABS`), and **nothing in the world may be drawn under the tab bar** — the camera's
framing holds that, measured in `tests/render2d/camera.test.ts` and in smoke. **The top-right
corner is the minimap's** (decision 115), the target frame beside it or, on a phone held upright,
under it; new top furniture is placed against both in `hudLayout`, which `tests/ui/layout.test.ts`
holds apart at five screens. **Every number says what it counts** (decisions 89 and 99): a stat is
named in full off `BONUS_NAMES` in `data/items.ts` rather than abbreviated where it is drawn, a
locked row says what it Needs, and a panel is titled with its tab's own word. Nothing but the panel titles is held by a test, so a new surface keeps it.
**The HUD is drawn in the world's art** (decision 111, `docs/architecture/hud.md`): **every colour
it names is a step on the art's ramps**, read through `rampStep` rather than typed as a hex, which
`tests/ui/theme.test.ts` holds over the whole stylesheet; a panel, button, row or slot wears a
frame from `art/hud.ts`, cut in nine by the page, so **a frame's edges are the same all along**
(`tests/art/hud.test.ts`), and its width comes out of the element's old padding so the layout's
heights hold; headings, tabs and buttons are set in the world's font, compiled to a font file at
boot and **only ever set at a whole multiple, never bold**, the dense lines staying sans; and
every item, ability, buff and tab has an icon, a word beside it wherever there was one.

**The renderer loads no files and draws in painter's order** (`docs/decisions.md` 54 and 101).
Every picture is a sprite compiled from data at boot, the ground is baked onto one canvas once a
zone, and a frame draws the ground, the shadows, everything standing sorted by where its feet are,
the moments, the lantern and then the words — nothing else decides what is in front. **Nothing is
drawn over the room the player is standing in**: another building is cut out of it and its sign
not written there. **The words are laid out before any is written** (`render2d/plates.ts`): a plate
that would be written over another is lifted straight up clear of it, and the player's and then the
target's never move (decision 112). A tap is picked against boxes in a fixed **priority** (node,
signpost, NPC, mob, station, building, loot pile, ground), not a depth sort. What a frame costs is a
budget smoke asserts under an eight-times-throttled CPU (`SLOW_DRAW_BUDGET_MS`, 16ms since decision
110); raising it is a decision about the game, not about the run that hit it.
`docs/architecture/rendering.md` has the view.

**Version 2's art is data** (`src/art/`, decisions 81 and 100): a sprite is rows of characters
naming palette steps, compiled at boot into an atlas, and `src/art/` imports no package so it
outlives whichever renderer draws it. **Every colour is a step on a ramp** in `art/palette.ts`, a
new colour being a new ramp of five, darkest first; a person, beast, effect or icon uses only the
shared ramps, since only the ground changes with the setting. **How much animation a kind has is
fixed in `art/budget.ts`**, and `tests/art/sprites.test.ts` holds every sprite in `SPRITES` to it
exactly, to the palette and to its size: raising a frame count is a decision about the game, since
it multiplies across every sprite of the kind. Nobody draws an outline; the compiler does.
**Where two grounds meet is a rule, not a picture** (`art/ground.ts`): every pair that meets in a
zone is a row in `sprites/edges.ts` (a test sweeps the maps, so a new pair is a new row), and no edge
may lay blocking ground over walkable ground, which is why rock shows its face inside its own cell.
**Scatter is baked into the ground** (`art/scatter.ts`), never where an edge is drawn. **A building is a
kit laid over its footprint** (`art/building.ts`), its door where `doorGap` puts the collision's,
and **what stands in its room is `art/rooms.ts`** (decision 109): nothing in it blocks, so
`tests/art/rooms.test.ts` is all that keeps the furniture and the
counter out of where the game stands a body. **Who is drawn with what** is
`art/cast.ts`, anything not in it being its kind's placeholder, and **what each place is drawn as**
is `art/places.ts`.
**A creature built like a person is a getup on the figure in a build** (decision 108): a boss is
grown to the budget's 48×64 and a goblin shrunk by `refitted`, whole rows and columns doubled or
left out where the drawing is flat, never scaled by a fraction. **A moment is an effect sprite
played once on the budget's clock and held fading by the view** (`render2d/effects.ts`); only an
arrow and a telegraph are drawn as lines, since no fixed frame has their angle or their reach.
**A person is one figure dressed and armed** (`art/sprites/figure.ts`, decision 104): its arms are
parts in poses, each naming the pixel its hand closes on, and anything held is laid with its grip
there, so a new pose names a hand that is a fist (`tests/art/figure.test.ts` holds it). **The player
is put together from their class, their look and what they wear** (`art/outfit.ts`, decision 107),
composed as grids and compiled as one sprite, each slot dyed into a ramp of its own, and compiled
again by the view when that changes. **What an item looks like worn is a row in `art/wardrobe.ts`**,
and `tests/art/outfit.test.ts` holds every item to one, so a new piece of gear is a row there too.

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
its coin, **the pace test holds each level to its number plus four minutes of play, every class**
(`tests/world/pace.test.ts`, measured by a bot playing it in `tests/world/pace.ts`, decision 122, with
food rather than regen the answer to the wait between fights), `deadEnds.test.ts` holds that
nothing handed out leads nowhere, `uniqueLoot.test.ts` holds boss drops unique, and unattended play
stays behind active play (half XP, no abilities, an offline cap). **Rested rides the player's XP,
never idle's** (`systems/RestedSystem.ts`, decision 127): a kill made by hand, a quest or a contract
spends it through `awardPlayedXp`, and idle's halved XP goes through `awardXp`, which leaves it
alone, or idle pays itself back; the pace bot plays unrested.
Change a stat, a table or a curve and retune until those pass rather than eyeballing it.

## Where the reasoning lives

| Topic                                                                             | File                              |
| --------------------------------------------------------------------------------- | --------------------------------- |
| The tick, collaborators, session, channels, death, pathing, saves                 | `docs/architecture/simulation.md` |
| The zone roster, exits, locks, the Greyford loop                                  | `docs/architecture/zones.md`      |
| Walls, doorways, rooms, counters indoors, the cutaway                             | `docs/architecture/buildings.md`  |
| Shop shelf, selling, bank, NPC roles, reforging, the full pack                    | `docs/architecture/economy.md`    |
| Tools, recipes, stations, tiers, cooking, food and the wait, dead ends            | `docs/architecture/making.md`     |
| Loot rules, quests, bounties, stored tallies, mastery                             | `docs/architecture/content.md`    |
| Abilities, levels, difficulty, the cap, crits, armour, bosses                     | `docs/architecture/combat.md`     |
| Idle (the AFK camp), its panel and food order, offline progress                   | `docs/architecture/afk.md`        |
| The HUD's look and pieces, the map, layout, tabs                                  | `docs/architecture/hud.md`        |
| The 2D view: camera, painter's order, words, picking, draw budget                 | `docs/architecture/rendering.md`  |
| Pixel art: palette, light, outline, budget, sprites, places, edges, the HUD's art | `docs/architecture/art.md`        |
| Sound: what it hears, cues, ambience, unlocking, mute and volume                  | `docs/architecture/audio.md`      |
| Tests vs smoke, the pacer, the dev handles, the hand crank, frame-rate bugs       | `docs/architecture/testing.md`    |

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
