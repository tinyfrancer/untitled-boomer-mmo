# Act three: sound footing, a world worth looking at, and the upper band filled in

**Status:** live. Opened 2026-09-25 against `5c07204`. **Phase 0 landed** (the drift, this plan,
decisions 54-57, and `CLAUDE.md` cut from 150 KB to 17 KB with the reasoning moved to
`docs/architecture/`). **Phases 1 and 2 landed together** — the redraw rule fell out of the counter
table, since `refreshOpen()` is one call once there is one counter slot to redraw. **Next: phase 3.**
Update this line as each phase lands.

This plan came out of a full read of the codebase on 2026-09-25 — every module under `src/`, the
harness, smoke, and a screenshot of every zone at phone size — asked for as "a full analysis now
that we have a better model: shortcomings, design flaws, places to improve so we can keep adding
cleanly without creating spaghetti; update the docs; flesh out the base game with graphical
improvements and more features". Part one is what the read found. Part two is the work, phased
into PRs the way every plan here is, with the argument for each decision beside it.

Four forks were put to the user before any of it was written, and all four are recorded in
`docs/decisions.md` (54-57):

| Question                        | Answer                                                                           |
| ------------------------------- | -------------------------------------------------------------------------------- |
| Art assets, or stay procedural? | **Procedural.** No asset files; every improvement is code.                       |
| Which features?                 | **All four:** fill levels 4-8, loot that is not lost, sound, bows and fletching. |
| Cleanup before features?        | **Cleanup first.**                                                               |
| `CLAUDE.md` at 150 KB?          | **Slim it**, and move the reasoning into topic docs.                             |

---

## Part one: what the read found

### What is sound, and should be left alone

The seams hold. `render3d/` is still the only thing that knows there is an engine; the simulation
runs headless in 36 files of `tests/world/`; the two channels out of the world are still two; the
data tables still decide what the renderer draws rather than the other way about. The suite was
green at 1888 tests and the typecheck clean. None of what follows is a reason to reach for a
framework or to restructure the directories — the architecture is right, and what it has grown is
duplication at three specific joints.

### Where the next feature turns into spaghetti

**1. Six counters are six copies of one thing.** The shop, bank, trainer, board, outfitter and
fettler each have a session class carrying the same five members (`npc`, `open`, `close`,
`closedByUi`, `updateRange`), their own `*_OPENED_EVENT` and `*_CLOSED_EVENT` (twelve constants for
one idea), a getter on `ZoneWorld` (`shopNpc`, `bankNpc`, …), a line in each of `updateNpcRange` and
`closeCounters`, a field plus `open*`/`close*`/`refresh*` in `OverlayHost`, a state getter in the
HUD's constructor, and a pair of listeners on each side of the bus. A seventh counter is about ten
files, and the one thing that stops a line being missed is somebody remembering. `COUNTERS` in
`ZoneWorld` already keys the _walk_ by role; nothing else does.

**2. The HUD redraws by hand-kept lists.** The HUD mirrors the character into its own model, and
every listener that updates the model then names the panels that read it: an inventory change calls
five `refresh*`s, the purse four, a level three. Every new panel is a sweep through those lists, and
a missed one is a panel showing yesterday's bag with nothing failing. The rule the lists are
approximating is one line long — _whatever counter or station is open is a function of the model,
so a model change redraws it_ — and nothing enforces it.

**3. The world's rng stops at the wander.** `ZoneWorldOptions.rng` reaches `populateZone`, `Mob`
and `ReforgeSession`, and nothing else: every swing, crit, dodge, block, loot roll, gather roll,
burn and fizzle calls `Math.random` through a default parameter. The harness says it is
"deterministic by default" and is deterministic about where rats walk. Five test files spy on
`Math.random` to force an outcome instead, which is the seam missing rather than the tests being
wrong.

**4. `CLAUDE.md` is 150 KB** — about 37,000 tokens loaded into every session before a question is
asked. It is excellent and it is mostly essay: the shape of the system is in there, but so is how
each piece came to be ("it used to be…"), which `docs/decisions.md` now exists to carry. The cost
is paid on every session, including the ones that only need the commands.

Smaller, and fixed in phase 0 rather than planned:

- `ZoneWorld`'s `handle*` methods were documented as "kept for the view and smoke". Neither uses
  them; `tests/world/` does, 117 times. The doc now says so. They stay — a test calling
  `handleCookRequested` is clearer than one emitting the request by name.
- The action publisher's seed never matched its own signature, so it never suppressed anything —
  which is the right behaviour, since the HUD outlives the world. The seed is gone.
- Seven comments still counted travel off the world map as a route into a zone, long after it was
  removed. The README described three zones and a tab bar two redesigns old.

### What the upper half of the game is missing

The starter band is full. Above it the directed content stops:

- **All five quests** are the shopkeeper's, and all five are level 1-3.
- **The trainer sells nothing after level 4.** Levels 5 to 8 buy no ability at all.
- **The board's six contracts** top out at the mill road.
- **A full pack destroys loot.** `CombatDirector.grantLoot` logs "too full to carry" and the item is
  gone; its comment claimed the drop was "left on the corpse", and there is no corpse to leave it on.
- **Willow is still outstanding.** `CLAUDE.md` says it "lands with the bow, or it does not land".
- **There is no sound at all.**

### What the screenshots show

Taken at 390×844, standing on each zone's spawn point:

1. **The world ends in a hard line.** The top fifth of every portrait frame is flat navy: the
   camera looks past the map's north edge, the ground mesh stops there, and the fog fades toward a
   colour that reads as a hole rather than a horizon.
2. **Rock is paint.** `WALL_TILE` stands at height 0, so the Deep Cut and the barrow read as a
   floor with dark rectangles on it. What blocks does not look like it blocks.
3. **Underground is lit by the beach's sun.** The barrow and the Deep Cut share the outdoor sky,
   fill and fog; the only thing that says "under the ground" is a grey floor.
4. **Names cannot be read.** A nameplate label is 12 world units tall, which on a phone is about
   seven pixels of unoutlined text over grass.
5. **A fight has no motion in it.** No swing, no lunge, no flinch; only numbers rise.
6. **Water is a blue slab** and grass one green, with nothing standing on either.

---

## Part two: the work

Thirteen phases, cleanup first. Each is one PR unless it says otherwise, and each ends with the
docs describing what landed.

### Phase 0 — the analysis, the drift, and a `CLAUDE.md` that fits in a session

- This document, and decisions 54-57.
- The comment and README drift above (landed as its own commit).
- **`CLAUDE.md` slimmed to the rules and a map.** Everything it says about a subsystem moves,
  verbatim where it is still true, into `docs/architecture/<topic>.md`: simulation, zones and
  buildings, economy and counters, content and progression, crafting, AFK, combat, the HUD,
  rendering, and testing. `CLAUDE.md` keeps the project summary, the commands, the workflow, the
  seams and the invariants a change can break without a test noticing, and says which topic file to
  read for what. Nothing is deleted — a paragraph either stays or moves.

  **Why move rather than trim:** the essays are the most useful thing in the repo for the session
  that needs one of them, and the least useful for every other session. A topic file is read when
  the work touches the topic, which is when its reasoning is worth the tokens.

### Phase 1 — one counter, six roles

- **World:** `world/CounterSession.ts`, a base class holding the five shared members and speaking
  `COUNTER_OPENED_EVENT` / `COUNTER_CLOSED_EVENT` with the `NpcRoleId` as their payload. The six
  sessions extend it and keep only what is theirs. `ZoneWorld` holds them as
  `Record<NpcRoleId, CounterSession>`, so `approachNpc`, `updateNpcRange` and `closeCounters` are
  one loop or one lookup, and the six `*Npc` getters become `counterNpc(role)`.
- **HUD:** `OverlayHost` keys its counter panels by role through one table of factories; open,
  close and refresh become three methods rather than eighteen.
- **Twelve events become two.** Their payload is the role, typed `NpcRoleId`, so a seventh role is
  a compile error in every table until it has a session and a panel — the same bargain
  `NPC_APPEARANCES` and `COUNTERS` already make.

  **Why a base class and not composition:** every session _is_ a counter window with operations on
  it, and nothing about any of the six wants a second shape of window. A helper held as a field
  would make `ZoneWorld` reach through it on every loop for no gain.

### Phase 2 — the HUD redraws what is open

- `OverlayHost.refreshOpen()` redraws the open counter and the open station from the model. Every
  model listener that used to name panels calls it instead. What is left in each listener is the
  model update and whatever that event _alone_ means (a toast, a layout change).
- The HUD test that asserts a bank opened over a changing bag redraws is extended to every counter,
  so the rule is held by a test rather than by the lists.

### Phase 3 — one rng for the rolls

- `WorldContext.rolls: () => number` — separate from the wander rng, so a test that pins where rats
  walk does not also pin every swing, and a test that pins the swings does not move the rats.
- Threaded through `CombatDirector`, `GatherSession`, `AbilityCaster`, `ReforgeSession` and the
  camp's offline branch. The systems already take an rng; they are simply handed one.
- The harness takes `rolls` beside `rng`, and the five files that spy on `Math.random` pass one
  instead.

### Phase 4 — the edge of the world, and the sky over it

- **The ground runs past the map.** `buildGroundGeometry` grows an apron of tiles beyond every edge,
  each one the nearest edge tile carried outward — a road leaving by the west edge keeps going west,
  the beach's ocean keeps going east — drawn one quad a tile and fading into the fog. It is one mesh
  still, so `drawnCounts().ground` stays 1 and the teardown check is unchanged. Nothing in the
  simulation knows it is there: the bounds clamp is where walking stops, as it always was.
- **A sky**, as a gradient on a session-long dome rather than a flat clear colour, and **fog that
  matches the horizon it fades into** instead of a navy that reads as a hole.
- **A zone says what kind of place it is**, as `ZoneDefinition.setting`
  (`'open' | 'marsh' | 'underground'`), and `render3d/atmosphere.ts` says what that looks like —
  sky, fog, sun and fill — the same split `shape` makes for creatures. Underground is dark: no sky,
  a low cold fill, the sun off, and the apron drawn as rock.
- **Torches underground**, placed from the data (`ZoneDefinition.lightSpawns`) as a small pool of
  point lights of fixed count, like `RoomLight` and for its reason: a light count that changed with
  the zone would recompile every program on the frame the zone changed. What the budget pays for
  them is measured on CI before the count is settled.

  **Why a setting and not a colour table on the zone:** what a place _is_ belongs to the game —
  the fen is a marsh whatever draws it — and what a marsh _looks like_ is the renderer's, which is
  exactly the line `TILE_COLORS` and `palette.ts` already draw on either side of.

### Phase 5 — rock stands up

- `tileHeight(WALL_TILE)` is a positive height, and the bank-face code that grows a face wherever
  the ground steps down grows one wherever it steps _up_, wound toward the low side. It was written
  against tile height rather than water by name, which is what makes this a constant rather than a
  new mesh.
- The height is the lowest that reads as solid rather than as paint — a wall south of the player
  hides them from a 45° camera, so it is measured against the occlusion ray rather than chosen.
- Picking already aims at `y = 0`; a raised wall top is only ever tapped to walk into it, and
  `standNear` already answers that.

### Phase 6 — names you can read

- Text is baked with a dark outline and a soft shadow, so it reads over grass, sand and marsh
  alike, and the nameplate's `labelHeight` is sized off what a phone shows rather than off a world
  unit somebody liked. The player's squished plate keeps its ratio to everyone else's.
- The con colours are rechecked for contrast against the outline rather than against the ground.

### Phase 7 — a fight you can see

- **A `swing` WorldEvent**, from the one place a swing happens on each side (`CombatDirector`), so
  the view can play an attack. A moment, not a state: nothing in the world can be asked "is it
  swinging" afterwards, which is the whole test for the view channel.
- The figure and the beasts get an attack pose (an arm swing, a lunge), a hit **flinch** and a
  brief emissive **flash** on the thing hit, a spray of short-lived **sparks** on a crit, and a
  **ring of light** on a level-up. All of it from `fx.ts` and the actors, on the view's clock.

### Phase 8 — water that moves, and ground with something on it

- Water tiles get a gentle vertex bob and a moving sheen from a shared uniform the view advances,
  not a texture.
- **Ground scatter** — tufts on grass, reeds on marsh, pebbles on stone — placed deterministically
  off the tile hash `cornerShade` already uses, as one `InstancedMesh` per kind per zone, so a
  zone's worth of tufts is a handful of draw calls and one dispose each. None of it blocks, is
  picked, or casts.

### Phase 9 — sound

- `src/audio/`, engine-free the way `hud/` is: Web Audio synthesis only (no files, per the
  procedural answer), a small voice per cue — a swing, a hit, a crit, a block, a gather tick, a
  level-up chime, a coin — and a quiet ambient bed per zone setting.
- It listens to the two channels it needs and nothing else: the `WorldEvent[]` the host already
  hands the view, and a handful of HUD events (level-up, coin). The host owns the `AudioContext`,
  starts it on the first gesture (browsers refuse before one), and closes it on reset.
- **Mute** and **volume** in Options, stored per device in `localStorage` beside the save rather
  than in `CharacterState` — a setting about the speaker is not a fact about the character.

### Phase 10 — loot that is not lost

- A kill whose drops do not fit leaves a **loot pile** (`world/LootPile.ts`) where the creature
  fell, holding exactly what could not be carried. It lasts a few minutes of game time, is tapped to
  take what fits, and is drawn as a small sack. Coin is never in one; coin never failed.
- It is a `WorldTap` kind and a line in the context menu, picked above the ground and below
  everything else. A zone change or teardown drops every pile — they are the zone's, like a fire.
- The camp's behaviour does not change: an unattended session still counts what it could not
  carry into `missed`, since nobody is there to come back for it.

### Phase 11 — the upper band gets directed content

- **Abilities by rank.** The bar stays four buttons — six would not fit beside the signpost a thumb
  taps — so levels 5 to 8 sell a second rank of each ability rather than new ones: a rank replaces
  the one below it on the bar and in the trainer's list. That is data (`AbilityDefinition.rankOf`),
  and `knownAbilities` answers the highest rank known per line.
- **Quests above level 3,** given at Greyford by the outfitter and the fettler — which is why the
  quest section moves out of the shop panel and into the counter shell in phase 1's wake: any
  counter whose person gives quests shows them. A short chain through the mill road, the fen, the
  Deep Cut and the barrow, each ending on the named thing in the zone it sends you to.
- **Contracts for the upper band** on the board, held to the same three rules the existing six are.
- `progression.test.ts` extended past the starter arc, so the upper band's pacing is simulated
  rather than eyeballed.

### Phase 12 — willow, fletching and the bow

- **Willow** on the mill road's millpond, a woodcutting node above hardwood.
- **Fletching**, the fourth making skill, at a fletcher's bench in Greyford's yard — beside the
  tannery, for the reason the tannery is there. Its rows are one-of-one where they can be, so it is a
  job a camp can settle to by the rule `findCraftableFrom` already applies.
- **The bow**, a two-handed ranged weapon for the warrior, trained by a new `archery` combat skill.
  Ranged reach without mana is the warrior's trade for giving up the offhand; the duels in
  `EnemySystem.test.ts` are extended so the bow is a different fight rather than a better one.
  `deadEnds.test.ts` holds willow to having a use on the day it lands.

---

## What this plan does not do

- **No art assets.** Every visual change above is geometry, vertex colour, lights and shaders
  written here. If that ceiling is reached, the asset question is a new decision rather than a
  reopening of 54.
- **No mob pathing.** Decision 26 stands; a room is still somewhere to lose a chase.
- **No second renderer, no framework, no state library.** The duplication found is at three joints
  and each is fixed where it is.
