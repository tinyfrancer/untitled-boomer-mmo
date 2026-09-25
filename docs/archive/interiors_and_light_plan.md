# Plan: interiors, pathfinding and light

**Status:** done — phases 0 through 7 landed. Written 2026-09-01 against `7e5f66b`.

- **Phase 0 (PR 115) merged** 2026-09-01 at `3d9b86f`. The roof bug is fixed and swept over every
  row in `BUILDINGS`; this plan and `docs/decisions.md` exist.
- **Phase 1 done** 2026-09-01. `DebugView.drawTime()` and the ceiling on it landed first, as
  written; then the sun, the shadow maps and the depth cue. It cost 4.4ms of a 40ms throttled draw
  budget, measured on a full smoke run either side. **One instruction in it was reversed** — the
  shadow camera is framed on the zone rather than on what the player's camera can see, because the
  arithmetic says a viewport-framed frustum is the larger of the two. See `docs/decisions.md` 29-32.
- **Phase 2 done** 2026-09-01. `systems/PathSystem.ts` exists, nothing calls it, and the game
  behaves exactly as it did. It is A\* over the tile grid as written, but **passability is
  `isBlocked` on the body rather than a rasterising pass**, and two things the plan did not name
  turned out to be the whole difficulty — see `docs/decisions.md` 33-36. The one that reaches
  forward: **a doorway has to be at least two tiles wide**. Phase 4 expected to find that out by
  measurement and this is the measurement, arriving early, because a gap exactly the body's width is
  one it fits only in exact arithmetic.
- **Phase 3 done** 2026-09-02. Every click-to-move walk is routed except the pursuit, and a tap
  across a tree stand goes round it. Two things the phase turned out to be about are in
  `docs/decisions.md` 37-39: **the route lives on `Player` and the decision to ask for one lives on
  the caller**, and **a walk toward something solid is routed to beside it and finished by pressing
  into it** — without which the pathfinder would have been wired in and done nothing for gathering,
  since every tree and vein in the game is a goal `findPath` refuses.
- **Phase 4 done** 2026-09-02. Every building in the game is a room you can walk into and out of,
  the roof and the near walls come away while you are in one, and the reachability sweep the plan
  called the prize is in `tests/systems/BuildingSystem.test.ts` — a route from the zone's spawn point
  into every building in the game. `docs/decisions.md` 40-44 carry the five things it decided, and
  two of them were not in the plan at all:
  - **Two taps to go indoors** (43). From outside, the roof is drawn over the floor and the pick box
    is the whole footprint standing as tall as it is drawn, so no ray aimed at a room ever reaches
    one. Without a second meaning for the same tap, the rooms this phase opened would have been
    reachable by keyboard alone, on a game laid out for a phone.
  - **The line-of-sight check the plan filed under "not in this" is in it** (44), because it is a bug
    hollowing _created_ rather than one that was already there. Enemy abilities only: a tree trunk is
    a blocker exactly as a wall is, so gating auto-attacks on it would make every tree in the game
    something to fight around.
- **Phase 5 done** 2026-09-02. Every counter in the game works out of a room, the route sweep the
  plan called the prize is in `tests/systems/BuildingSystem.test.ts`, and a tap on a shopfront is a
  tap on whoever is behind it. `docs/decisions.md` 45-47 carry the three things it decided, and the
  first two reverse or go past what is written below:
  - **A tap on a shopfront answers with the counter** (45), where the table below says "unchanged:
    a tap on a shop still walks you to its doorstep". Under the plan's letter, shopping became three
    taps on the most repeated action in the game — and the question could not be left alone anyway,
    since NPCs outrank buildings in `pickTap` and _part_ of every shopfront already answered with the
    person behind it.
  - **`NPC_INTERACT_RADIUS` came down from 120 to 64** (46), which the plan does not mention and
    which the phase turns out to be about. At two tiles of reach the walk to a counter stops in the
    street: the room is never entered, and moving the counters inside would have been decoration.
    The reach is what decides whether a room is somewhere anybody stands.
  - **Two of the six counters are still served from their doorway** (46), because a two-tile hut has
    no floor to stand on behind a counter and town has no room to deepen the one it holds. Which
    buildings are which is asserted rather than left to drift.
- **Phase 6 done** 2026-09-03. Every building in the game has a floor and a few things standing
  against its walls, and the room the player is in is lit by a light of its own.
  `docs/decisions.md` 48-49 carry the two things it decided, and the first goes further than the
  plan's line below:
  - **Nothing in a room blocks** (48), because 46's arithmetic leaves no floor to spend — the counter
    and the customer already fill a three-tile shop end to end, and a blocking fitting is a cell A\*
    refuses rather than a shelf in a corner. What keeps that from being the lie the walls are drawn
    to avoid is that a fitting is exactly as deep as the wall it stands against, which is measured
    off the smallest room in the game rather than chosen.
  - **The light is one light, moved** (49), in the scene always rather than added at the doorway,
    because three recompiles every program in the world when the light count changes and that frame
    would be the frame somebody walks through a door. The phase costs **about ten of the 40ms
    throttled budget** — three consecutive CI runs read 20.06ms on the phase 4 tree, 20.66ms on
    phase 5 and 30.74ms on this one, and phase 5 moving within the noise is what makes the ten this
    phase's rather than the interiors' generally. It was first recorded here as one to three, off a
    dev container whose baseline turned out to drift 14ms in a day; **`drawTime()` is read off CI**
    (decision 50).
  - **What the plan did not see coming:** the cutaway takes the roof's shadow with the roof, so a
    room stood in is a room in full sun. That is the reason the light is not optional decoration —
    without it an interior is the outdoors with walls round it.
- **Phase 7 done** 2026-09-03. The tile seams are gone, a pond has a bank rather than a hole in the
  world behind it, and the camera is pitched 45° down instead of 58 — which is where a wall stops
  being a line under a lid. `docs/decisions.md` 51-53 carry the three things it decided, and the one
  the plan did not see coming is the third:
  - **A vertex is coloured by what it touches** (51), which needed the tile cut in quarters rather
    than sampled at its corners: with four corner samples and every one an average, a three-tile road
    has no pure road anywhere in it and reads as a smear. And a blocking tile blends with nothing,
    because a shore drawn as a gradient is a gradient somewhere in the middle of which walking stops
    working.
  - **The ground grows the face it steps down** (52), which is not in the plan at all and is the
    thing the lower camera would have made worse: the far rim of every pond was the background
    showing through, and a thin line at 58° is a band at 45.
  - **The pitch was three numbers, not one** (53). `TARGET_TILES_ACROSS` framed the view by its
    _depth_, so tilting the camera also zoomed it 17% closer, and `FOG_FAR` is a ratio to that same
    camera, whose axis a shallower pitch lays down closer to the ground. Neither said on its face
    that it depended on the pitch. Framed by width instead, the tab-bar margin came out **wider**
    than it was at 58°, so the angle cost nothing where the plan expected it to cost the most.
  - **What it costs to draw is nothing CI can see.** The throttled pass read 25.15ms on PR 122's
    CI run against phase 6's 30.74ms — under the baseline rather than over it, which says the
    ground's extra vertices cost less than the difference between two CI runs, not that drawing
    got cheaper. The nine milliseconds phase 6 left are still there. A dev container could not have
    said even that: three runs in one session read 47.25ms unchanged and 49.00 and 45.57 with the
    phase, all over the ceiling (decision 50).

## Starting a phase cold

A session picking this up from nothing should, in order:

1. Read `CLAUDE.md` — it is loaded automatically and describes the whole system as it stands.
2. Read this file's phase section, and every `docs/decisions.md` entry from 25 down, which are what
   this upgrade has decided so far and why the alternatives lost. The ones a later phase most needs
   are 30 (the shadow frustum), 33-36 (what the pathfinder actually does, which is not quite what
   phase 2 was told to build), 39 (how a walk toward something solid ends), 40-43, which are what a
   building now _is_, 45-46, which are what a room with somebody in it is, and 48-49, which are what
   is in one and what lights it. Phase 7 in particular rests on 49's measurement: the throttled draw
   budget is the thing a camera change and a reworked ground mesh both spend, and two runs of the
   same tree differ by a couple of milliseconds — so a reading taken once says nothing.
3. `git log --oneline -15` to see where the last phase actually stopped, which is the only source
   that cannot be out of date.
4. Branch before the first commit. Never commit to `main`, even for a doc fix.
5. Gates before opening a PR: `npm run lint`, `npm run format:check`, `npm run typecheck`,
   `npm run test`, `npm run build`, and `npm run smoke` with `npm run dev` already running in
   another shell. The smoke job blocks merges, so run it locally rather than finding out from CI.
6. Append to `docs/decisions.md` for anything that closed off an alternative, and update this
   file's status line. Both are part of the phase, not paperwork after it.

## What this is

Three things asked for together, which turn out to be one thing:

1. **The graphics are the weakest part of the game now.** The content reached the end of act two;
   the presentation did not move from the placeholders the 3D port shipped with.
2. **Buildings should be enterable, with the counters inside them.** Every one of them.
3. **Roofs are drawn wrong**, obviously so on the buildings that are not square.

They are one thing because the hard part of (2) is the same as the interesting part of (1): a room
you can stand in is a room that has to be _lit_, and cut away, and reached. Doing the light first and
the interiors later would mean lighting a world that is about to gain ten new spaces; doing the
interiors first and the light later would mean building rooms nobody can see into.

## The decision that shapes everything

**Buildings become hollow and the game gains a pathfinder.**

This reverses what `CLAUDE.md` says today, deliberately and with the alternatives on the table:

> Being solid is the load-bearing decision and not a shortcut: click-to-move is a straight line with
> collision sliding and **no pathfinding anywhere**, so a counter behind a doorway is a counter a tap
> walks into a wall trying to reach, from three sides of its own shop.

That paragraph is correct about the constraint and correct about the consequence. What changes is
the constraint. A doorway is precisely the shape a straight-line mover cannot solve, so entering
buildings means either routing around corners or not entering buildings.

The two alternatives were considered and rejected:

- **Interiors as zones**, where a doorway is a zone edge and walking through it loads a small room.
  Costs no new movement machinery at all and reuses the whole `GameContext` handover. Rejected
  because it puts two transitions on every shop trip, on a phone, in a game whose loop is already
  "walk somewhere and do something" — and because ten interiors would be ten rows in `ZONES`, ten
  cells to keep off the world map, and ten entries to keep out of the `visits` tally that quest
  objectives count.
- **Keep them solid and fake it** with a recessed porch and the NPC standing in it. Cheapest by a
  distance and would have looked most of the way there. Rejected because the ask was to go inside.

What the pathfinder buys beyond doorways is worth naming, because it is most of the justification:
click-to-move today walks into a tree stand and presses against it until the player gives up. That
has always been a small papercut and it becomes a large one the moment the world has walls with
gaps in them.

## The order, and why

Visual payoff early **and** late, architecture in the middle. If the pathfinding work drags — and it
is the part most likely to — the game already looks better by then.

### Phase 0 — what is owed (PR 1)

- **The roof fix.** One line, plus a sweep over `BUILDINGS` that fails on the old version.
- **This plan.**
- **`docs/decisions.md`**, backfilled with the calls already made.

Nothing here touches movement or the renderer's structure.

### Phase 1 — light and shadow (PR 2)

The single biggest visual win, and independent of everything below it. Nothing casts a shadow today,
so nothing sits on the ground: a rat, a building and a signpost all hover.

**Where it lives.** All of it is `src/render3d/ZoneView3D.ts`: `lights()` at the bottom of the file
builds the two, and line ~110 attaches them with `this.scene.add(...lights(), ...)`. Lights outlive a
zone, like the camera — a zone change rebuilds actors and ground, not these.

The doc comment on `lights()` is what this phase reverses, and it states its own reason:

> Two lights and no shadows. […] shadow maps are a per-zone GPU resource with a per-frame cost, and
> there is nothing yet standing on the ground to cast one.

The second half stopped being true a while ago — there are buildings, trees, veins, signposts,
creatures and a player. The first half is still true and is what the budget below is for. **Rewrite
that comment rather than deleting it**; the next person needs to know shadows were declined once and
what changed.

**Do the instrument first.** There is no way to measure a frame budget today: `DebugView`
(`src/types/debugView.ts`) exposes `drawnCounts()` and `gpuMemory()` and nothing about _time_. So
the rule below is currently unenforceable, and the first commit of this phase is the thing that
makes it enforceable:

- Add a draw-time reading to `DebugView` — a rolling average of the last N rAF draws, in
  milliseconds. Keep it renderer-agnostic like the rest of that interface; a check written against
  a Three-specific counter would not have survived the last renderer swap and would not survive the
  next.
- Assert a ceiling on it in smoke's `throttled` section, which already runs the page at
  `Emulation.setCPUThrottlingRate` `rate: 8`. That section is the gate.
- Take the reading **before** any lighting change, so the budget is set against what the game costs
  today rather than against a number invented for it.

**Then the work:**

- A sun that gives faces different values, rather than the flat fill there is now.
- Shadow maps. Ground receives and casts nothing — it is the floor. Buildings, props and creatures
  cast. Fishing spots are the exception: they are the one prop drawn transparent already, and a
  transparent thing casting a hard shadow reads as a bug.
- ~~The shadow camera frames **what the camera can see**, following the player, rather than the
  whole zone. A zone is 1600 × 1216 world units; a shadow map stretched over all of it is blocky at
  any resolution a phone can afford.~~ **Wrong, and reversed when it was built** — see
  `docs/decisions.md` 30. The resolution claim was made without doing the sum: at 2048 texels a
  zone-framed map is a little over one world unit each. And a camera pitched 58° down can see both
  edges of a zone at once, so a frustum framed on the viewport is the _larger_ of the two.
- Depth cue — fog or an equivalent — so the far edge of a zone reads as far away.

**The rule for this phase:** every change is measured on the throttled pass before it lands. A
prettier game that drops frames on the device it was built for is a worse game.

**Done looks like:** every drawn thing sits on the ground rather than hovering;
`renderer.info.memory` still returns to where it started across three zone round trips, which smoke
already checks and which a per-zone GPU resource is exactly the way to break; the throttled pass
still passes, with a measured frame time under the ceiling the first commit established.

**Not in this phase:** the camera pitch (phase 7), interior lights (phase 6), the ground mesh and
its tile seams (phase 7). Each is somebody else's PR and each would muddy the measurement.

### Phase 2 — a pathfinder, switched off (PR 3) — **done**

`systems/PathSystem.ts`: engine-free, a pure function of the collision world plus a start and a
goal, answering with a list of waypoints. A* over the tile grid, with ~~the AABB blockers rasterised
onto it and~~ the body **inflated by `PLAYER_HALF_EXTENT` so a route through a gap is a route a body
fits through** — which is what asking `isBlocked` for the whole body at a point already does, so the
rasterising pass was a second picture of the world and never got written (`docs/decisions.md` 33).

Nothing uses it yet. It is unit-tested against hand-built worlds — a wall with a gap, a room with a
door, an unreachable goal, a goal inside a blocker — and the game behaves exactly as it does today.

**Why a grid A\* and not a navmesh:** the grid is 25 × 19. A navmesh solves a problem this world does
not have, and a tile grid is already what `CollisionSystem` thinks in.

**What the phase actually turned out to be about.** Finding a route is the easy half and took the
shape written above. The hard half is that a route is a claim about a body walking, and a list of
waypoints that reads correctly can still describe a walk that stops dead — which is why the tests
here do not check the waypoints, they **drive the route through `stepToward` and `moveWithCollision`
at 60fps and at 5** and assert the body arrives. Three hand-built worlds and one real zone were
refuted that way. Two rules came out of it, both in `docs/decisions.md` 34-36:

- **A waypoint is where the body stands in a cell, not the middle of the cell.** A\* picks the
  cheapest cell rather than the roomiest, so a corridor two tiles wide comes back hugged against one
  of its walls, and the walk arrives within `arriveRadius` of a waypoint rather than on it.
- **A passage with no slack in it is not a route.** Hence the two-tile doorway, and hence `null`
  where a lesser pathfinder hands back a route nothing can walk.

A last thing worth knowing before phase 3: `findPath` answers `null` freely and that is the design.
It means "do what you did before there was a pathfinder", so the wiring in phase 3 is a fallback to
today's straight-line walk rather than a failure to handle.

### Phase 3 — pathfinding wired into the walk (PR 4) — **done**

`ApproachDriver.walkTo` captures a _path_ rather than a point, and walks its legs in order with the
existing `stepToward`. Buildings are still solid; the only visible change is that a tap across a
tree stand now goes round it instead of pressing into it.

This is where regressions hide, and the existing suites are the net: `tests/world/` drives every
walk the game has, and smoke drives the real ones with a real finger.

Two rules carried forward from the movement work, both already written down and both still true:
the last step of a leg clamps to the distance remaining, and the arrival band scales with the
frame's travel. A path does not change either; it just has more ends.

**What it actually turned out to be about.** The legs were the easy half and took the shape written
above. Three things the plan did not name are in `docs/decisions.md` 37-39:

- **The route lives on `Player` and the choice to ask for one lives on the caller.** `moveTo` sets a
  route of one leg, which is what a walk always was, so nothing else in the game had to change; the
  driver is the only thing that calls `findPath`. That is what keeps the pursuit out of it — a plan
  re-made every frame for a moving mob swings between two ways round an obstacle — and what keeps
  `hasMoveTarget()` true for a whole route, which `AbilityCaster` and `resolveApproach` both read.
- **A leg is given up inside the frame that reaches it**, because `stepToward` reports arrival before
  it moves and a leg per frame is a stall at every waypoint — a fifth of a second of it at 5fps,
  exactly where the corner is.
- **A walk toward something solid is routed to beside it and finished by pressing into it.** This is
  the one that would have made the phase a no-op if it had been missed: every tree, vein and building
  is a goal `findPath` refuses outright, so without `standNear` the most repeated action in the game
  would have gone on walking the straight line.

**Found and deliberately not fixed:** below about 10fps a body cannot close the last pixels onto a
blocker — `moveWithCollision` reverts a blocked half-tile substep whole, so it stalls up to 32px out
and a tap on a vein never gathers. True on `main` with no route involved. It is a change to how every
walk in the game resolves and does not belong in a phase about routing.

### Phase 4 — hollow the buildings (PR 5)

- A building's collision stops being one rect and becomes its walls, with a gap where the door is.
- **`DOOR_SPAN` moves from `render3d/buildings.ts` into `data/buildings.ts`.** How wide a doorway
  _is_ is not the renderer's decision — the same argument `body` and `PLAYER_HALF_EXTENT` already
  make. The drawn door and the gap you walk through have to be one number.
- The doorway has to be wider than the player is, with margin — and **phase 2 says how much: two
  tiles**, because a gap exactly the body's width is one it fits only in exact arithmetic and the
  pathfinder now refuses to turn a corner in one. So the span is a minimum in tiles rather than a
  fraction, and the question left for this phase is which buildings that makes too narrow.
- **The roof and the near walls cut away** when the player is inside. `occlusion.ts` fades what the
  camera is behind today; being inside is a different question with a different answer — hidden, not
  faded, because a faded roof over your head still reads as a lid.

Interiors are empty rooms at the end of this phase. That is on purpose: an empty room you can walk
into and out of is the thing to get right before anything stands in one.

### Phase 5 — the counters move inside (PR 6) — **done**

`npcSpawns` move from doorsteps to interiors. Three rules in `tests/systems/BuildingSystem.test.ts`
inverted, and the third one gets _stronger_ rather than weaker:

| today                                                             | after                                                                  |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------- |
| nothing may stand inside a building                               | the counter stands inside, and nothing blocks the way to it            |
| the lane from door to open ground is clear                        | unchanged, plus the interior is reachable                              |
| a building is picked last and answers with the ground at its door | ~~unchanged~~ **it answers with the counter** — `docs/decisions.md` 45 |

The reachability rule is the prize. Today `BuildingSystem.test.ts` checks lane clearance as a
_proxy_ for "can a player get to this counter". With a pathfinder in the codebase it can ask the
real question: route from the zone's spawn point to every counter in the game, and fail if any of
them cannot be reached.

**What it actually turned out to be about** is the reach rather than the geometry. Moving the
`npcSpawns` was a morning's arithmetic; what took the phase is that `NPC_INTERACT_RADIUS` was 120 —
nearly two tiles, tuned for people standing in a field — and a three-tile shop is 160 units of floor
with its doorstep 48 outside that. At 120 the walk to a counter ends _in the street_: the counters
would have gone indoors and nobody would ever have followed them. The radius is a tile now, and the
arithmetic that falls out of it is the rule phase 6 inherits — a room is entered only when its floor
reaches further back than the reach, which a three-tile building does and a two-tile hut does not.
The prize sweep caught the other half: a counter against its back wall is in the wall's own tile row,
and A\* walks tile centres, so `findPath` answered `null` for the whole walk rather than the last few
pixels of it.

### Phase 6 — fit out the rooms, and light them (PR 7) — **done**

Ten interiors, driven from the table rather than hand-placed one at a time: a `BUILDING_LOOKS`
interior half saying what a floor is, what stands in it and what lights it. A forge glow in the
smithy, a fire in the inn, shelves behind a counter.

Interior lighting is the payoff for phase 1 having been done properly: a room lit differently from
the outdoors is the thing that makes going inside feel like going inside.

**What it actually turned out to be about** is that a room has no floor to spare. The fit-out went in
as written — `BUILDING_LOOKS` gained a floor, a furniture colour and a lamp colour, and
`render3d/interiors.ts` reads a list of fittings off the shape with a per-building override beside it
— but every interesting question was 46's arithmetic asked again. The counter and the customer fill a
three-tile shop end to end, so nothing in a room may block, and a fitting is a wall's thickness deep
because a body standing in the middle of a two-tile hut leaves exactly that much to either side. See
`docs/decisions.md` 48.

The light is 49, and the thing neither the plan nor phase 4 saw: the cutaway hides the roof, a hidden
roof casts nothing, and so a room being stood in is a room in full sunlight. The lamp is not
atmosphere on top of a lit room — it is the only thing telling an interior from the grass outside.

### Phase 7 — the ground and the camera (PR 8) — **done**

- **Tile seams.** The grass/dirt boundary is a visible staircase today, because terrain is one
  vertex-coloured mesh at tile resolution.
- **Camera pitch.** It is steep enough that the game reads as 2D — you see roof planes and little
  else. Lowering it shows the world off, and it is constrained by a rule that must not break:
  nothing in the world may be drawn under the tab bar (`tests/render3d/camera.test.ts`, and smoke at
  real phone sizes).

Last because it is the phase most likely to be cut, and because a camera change with interiors in
the world is a different problem from one without.

**What it actually turned out to be about** is that both items were one item wearing two hats, and
the hat was the same one every phase here has worn: a number that means something different once
something else has moved. The seams were the easy half and took the shape written above, with the
tile cut in quarters so a road keeps a middle. The camera was three numbers rather than one —
`TARGET_TILES_ACROSS` framed the view by its depth and so zoomed the camera whenever it was tilted,
and `FOG_FAR` is a ratio to a camera the pitch moves. Both were found by measuring rather than by
reading; framing by width instead handed back more tab-bar margin than the phase started with, which
is the opposite of the risk this was scheduled last for. What is _not_ in the plan is the third
thing, which the lower camera would have made worse rather than better: a pond had no bank, so its
far rim was a band of the background showing through the hole in the world.

## What is deliberately not in this

- **Mobs do not path.** They keep straight-line chase, so a building is a safe haven and anything
  that loses you leashes and heals — the existing contract, unchanged. Pathfinding for mobs is a
  much larger change than it looks (every chase becomes a re-plan) and buys much less.
- **But ranged enemy abilities gain line of sight.** The bandit's thrown knife has a `minRange` and
  no check for a wall between thrower and target; hollow buildings would let it sail through one.
  That is a real bug the moment phase 4 lands, and it is small. It goes in phase 4.
- **No art assets.** Sourcing or generating models is a separate project, and the seam it would
  fight is load-bearing: `buildHumanoid` scales the rig by `body.width / TILE_SIZE`, so the chief is
  half again a bandit's size _by construction_. Everything above is procedural and keeps that.
- **No day/night.** It would make every lighting decision above conditional, for atmosphere the game
  has no mechanic to use.

## What could go wrong

- **Frame rate.** Shadows and ten lit interiors on a throttled phone is the risk this plan is most
  likely to fail on. Mitigated by measuring in phase 1 rather than at the end, and by the throttled
  smoke pass being a gate rather than a report.
- **Movement regressions.** Phase 3 rewrites how every walk in the game ends. Mitigated by phases 2
  and 3 being separate: the pathfinder is proven against hand-built worlds before anything uses it —
  and "proven" turned out to mean driven through the real mover at two frame rates rather than
  read for correctness, which is what caught four routes that were wrong.
- ~~**Doorways too narrow for the body.** Found in phase 4 by measurement, fixed by making the span a
  minimum rather than a fraction.~~ **Answered in phase 2**: two tiles, and the pathfinder refuses
  anything narrower rather than routing into it.
- **Scope.** Eight PRs. Phases 6 and 7 are the ones to cut if it drags; everything through phase 5
  stands on its own.
