# Plan: interiors, pathfinding and light

**Status:** phase 0 in progress. Written 2026-09-01 against `7e5f66b`.

- **Phase 0 (PR 1)** — the roof bug, this plan, and `docs/decisions.md`. In progress.

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

- A sun that gives faces different values, rather than the flat fill there is now.
- Shadow maps, **with a frame budget from the first commit**. `ZoneView3D` declines them today in a
  comment, for a real reason: they are a per-zone GPU resource with a per-frame cost, and this game
  is aimed at a cheap phone in portrait. The throttled smoke pass at `rate: 8` is the gate.
- Depth cue — fog or an equivalent — so the far edge of a zone reads as far away.

**The rule for this phase:** every change is measured on the throttled pass before it lands. A
prettier game that drops frames on the device it was built for is a worse game.

### Phase 2 — a pathfinder, switched off (PR 3)

`systems/PathSystem.ts`: engine-free, a pure function of the collision world plus a start and a
goal, answering with a list of waypoints. A* over the tile grid, with the AABB blockers rasterised
onto it and inflated by `PLAYER_HALF_EXTENT` so a route through a gap is a route a body fits
through.

Nothing uses it yet. It is unit-tested against hand-built worlds — a wall with a gap, a room with a
door, an unreachable goal, a goal inside a blocker — and the game behaves exactly as it does today.

**Why a grid A\* and not a navmesh:** the grid is 25 × 19. A navmesh solves a problem this world does
not have, and a tile grid is already what `CollisionSystem` thinks in.

### Phase 3 — pathfinding wired into the walk (PR 4)

`ApproachDriver.walkTo` captures a _path_ rather than a point, and walks its legs in order with the
existing `stepToward`. Buildings are still solid; the only visible change is that a tap across a
tree stand now goes round it instead of pressing into it.

This is where regressions hide, and the existing suites are the net: `tests/world/` drives every
walk the game has, and smoke drives the real ones with a real finger.

Two rules carried forward from the movement work, both already written down and both still true:
the last step of a leg clamps to the distance remaining, and the arrival band scales with the
frame's travel. A path does not change either; it just has more ends.

### Phase 4 — hollow the buildings (PR 5)

- A building's collision stops being one rect and becomes its walls, with a gap where the door is.
- **`DOOR_SPAN` moves from `render3d/buildings.ts` into `data/buildings.ts`.** How wide a doorway
  _is_ is not the renderer's decision — the same argument `body` and `PLAYER_HALF_EXTENT` already
  make. The drawn door and the gap you walk through have to be one number.
- The doorway has to be wider than the player is, with margin. If a 34% door span on the narrowest
  building is not, the span becomes a minimum in tiles rather than a fraction.
- **The roof and the near walls cut away** when the player is inside. `occlusion.ts` fades what the
  camera is behind today; being inside is a different question with a different answer — hidden, not
  faded, because a faded roof over your head still reads as a lid.

Interiors are empty rooms at the end of this phase. That is on purpose: an empty room you can walk
into and out of is the thing to get right before anything stands in one.

### Phase 5 — the counters move inside (PR 6)

`npcSpawns` move from doorsteps to interiors. Three rules in `tests/systems/BuildingSystem.test.ts`
inverted, and the third one gets _stronger_ rather than weaker:

| today                                                             | after                                                                     |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------- |
| nothing may stand inside a building                               | the counter stands inside, and nothing blocks the way to it               |
| the lane from door to open ground is clear                        | unchanged, plus the interior is reachable                                 |
| a building is picked last and answers with the ground at its door | unchanged — from outside, a tap on a shop still walks you to its doorstep |

The reachability rule is the prize. Today `BuildingSystem.test.ts` checks lane clearance as a
_proxy_ for "can a player get to this counter". With a pathfinder in the codebase it can ask the
real question: route from the zone's spawn point to every counter in the game, and fail if any of
them cannot be reached.

### Phase 6 — fit out the rooms, and light them (PR 7)

Ten interiors, driven from the table rather than hand-placed one at a time: a `BUILDING_LOOKS`
interior half saying what a floor is, what stands in it and what lights it. A forge glow in the
smithy, a fire in the inn, shelves behind a counter.

Interior lighting is the payoff for phase 1 having been done properly: a room lit differently from
the outdoors is the thing that makes going inside feel like going inside.

### Phase 7 — the ground and the camera (PR 8)

- **Tile seams.** The grass/dirt boundary is a visible staircase today, because terrain is one
  vertex-coloured mesh at tile resolution.
- **Camera pitch.** It is steep enough that the game reads as 2D — you see roof planes and little
  else. Lowering it shows the world off, and it is constrained by a rule that must not break:
  nothing in the world may be drawn under the tab bar (`tests/render3d/camera.test.ts`, and smoke at
  real phone sizes).

Last because it is the phase most likely to be cut, and because a camera change with interiors in
the world is a different problem from one without.

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
  and 3 being separate: the pathfinder is proven against hand-built worlds before anything uses it.
- **Doorways too narrow for the body.** Found in phase 4 by measurement, fixed by making the span a
  minimum rather than a fraction.
- **Scope.** Eight PRs. Phases 6 and 7 are the ones to cut if it drags; everything through phase 5
  stands on its own.
