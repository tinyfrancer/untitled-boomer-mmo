# Decisions

Every call worth remembering, in the order it was made. Append at the bottom; never edit an entry
except to mark it superseded, because the value here is the record of what was thought at the time.

**What belongs here:** a decision that closed off an alternative somebody could reasonably have
picked. If there was no other option, it is not a decision — it is just how it works, and that
belongs in the code beside it or in `CLAUDE.md`.

**What each entry says:** what was chosen, who chose it, what was rejected, and why. The rejected
half is the part that stops the same argument being had twice.

**Where the rest of the reasoning lives.** This file is not the only place, and is not meant to be.
Code comments carry the _why_ of a particular line, `CLAUDE.md` carries the shape of the whole
system, and the plan docs carry the shape of one piece of work. This carries the forks — the moments
where the project could have gone two ways.

Entries 1-24 were written on 2026-09-01, backfilled from `CLAUDE.md`, the plan docs and the code, so
the record does not start empty. Their dates are the commit that landed them where that is
recoverable and approximate where it is not.

---

## 1. The renderer is a seam, not a foundation

**2026-07-28 · Claude, with the user · superseded nothing**

Everything but `render3d/` is plain TypeScript with no engine import. `systems/`, `data/`,
`persistence/`, `types/`, `config/`, `world/`, `hud/` and `ui/` would run under any renderer or
none.

**Rejected:** letting the engine's scene graph own game state, which is the default way to build a
game in Phaser or Three and is faster to start.

**Why:** it makes the rules unit-testable with no engine to mock. It was later cashed in full — the
whole renderer was replaced under the game without rewriting the game.

## 2. Phaser 4 in 2D, to start

**2026-07-01 (approx) · the user**

**Rejected:** starting in 3D.

**Why:** no game-development experience, and 2D is the shorter path to something playable. Recorded
because it was reversed a month later, which is the point of recording it.

## 3. Port to Three.js in 3D

**2026-07-28 · the user · supersedes 2**

Twenty PRs over eight days, planned in `docs/archive/3d_port_plan.md`.

**Rejected:** staying in 2D and improving it.

**Why:** the seam (1) made it possible without rewriting the game, and the 2D camera had a bug class
the 3D one does not — it clamped to world bounds, which pinned the town's south signpost under the
tab bar at every distance on a landscape phone.

## 4. There is no physics engine

**2026-07-29 · Claude**

`world/Player` and `world/Mob` own `{x, y, vx, vy}` and integrate themselves against
`systems/CollisionSystem.ts`.

**Rejected:** keeping arcade physics.

**Why:** it was carrying four colliders and nothing else — player and mobs against blocking tiles
and tree trunks. Player↔mob, mob↔mob and player↔NPC never collided, and every combat check is
distance-based. It was a dependency doing almost nothing, and it owned its own timestep, which is
what made frame-rate bugs hard to reason about.

## 5. Frame rate is not an assumption anyone may make

**2026-07-30 · Claude**

Anything comparing a distance against a fixed threshold scales that threshold with the frame's
travel — `arriveRadius` in `systems/MovementSystem.ts`.

**Rejected:** fixed pixel thresholds, which is what shipped first.

**Why:** a loaded CI runner or a cheap phone steps the game at single-digit fps, where one frame
carries the player ~46px. A fixed 8px arrival band left the player orbiting a tap destination
forever below 30fps.

## 6. The HUD is an HTML overlay

**2026-08-01 · Claude**

`src/hud/` builds one `<div class="hud">` over the canvas and talks to the world through an
`EventBus` alone.

**Rejected:** drawing the HUD in the engine, which is what the Phaser version did across 18 files.

**Why:** three rules come free from CSS that the engine version implemented by hand — pointer-events
for tap routing, `overflow` for clipping and scrolling, and the browser's own drag-versus-tap
suppression. The tree then sat unchanged over both canvases during the port, which is the proof.

## 7. Two channels out of the simulation, and they are not interchangeable

**2026-08-02 · Claude**

The HUD channel (`EventBus`) carries _state_ the HUD re-renders from. The view channel
(`WorldEvent[]` returned from `update()`) carries _moments_ — a bolt left a hand, a number floated
off a corpse.

**Rejected:** one channel for both.

**Why:** the latest state event always describes the present, so a listener that misses one is fine.
A view event is a moment and a view that misses one cannot recover it from anywhere. Merging them
would mean every consumer handling both semantics.

## 8. Walking is the only way into a zone

**2026-08-28 · the user · supersedes an earlier fast-travel feature**

Tapping a cell on the world map used to travel there. It was removed and nothing replaced it.

**Rejected:** keeping fast travel; adding a priced travel option at the same time.

**Why:** a world you can step across for nothing is a world with no distance in it — a forward base
saves nothing, a full pack is never a decision, and the walk home is never a cost. If travel returns
it should have a price on it rather than be a free line on a panel.

## 9. Difficulty may come from the spawn table, not only the stat block

**2026-08-20 · Claude**

The Old Mill Road's goblins stand in three knots of three rather than spread across the zone.

**Rejected:** making them harder by raising their numbers.

**Why:** the interesting fight is about not pulling the second one. It is also the kind of design a
later edit deletes silently — spread the nine out and every other test still passes while the zone
becomes the bandit camp with bigger numbers — so `oldMillRoad.test.ts` holds the knots.

## 10. The level cap is derived from the content

**2026-08-22 · Claude**

`MAX_CHARACTER_LEVEL` is asserted in `progression.test.ts` to sit one level past the highest thing
that spawns.

**Rejected:** picking a round number and building toward it.

**Why:** max level should be an achievement rather than an asymptote. Ten was 30,720 XP over seven
levels with nothing built for them. Derived, raising the content is what raises the ceiling, and the
test says the new number before anybody has to remember it.

## 11. A key belongs to the zone the door is in

**2026-08-18 · Claude**

The hideout key drops on the bandits outside its own door; the barrow key on the fen raiders whose
marsh it sits at the bottom of.

**Rejected:** putting a key in the zone before the one it opens.

**Why:** the grind and the lock are one place rather than two.

## 12. Only humanoids drop gear and coin

**2026-08-10 · Claude**

`EnemyDefinition.family` decides what a loot table may hold, enforced by a sweep rather than by
construction.

**Rejected:** letting any creature drop anything.

**Why:** it is what makes same-level zones worth visiting — rats give quest parts, crabs give food,
bandits give gear and coin. Enforced by test because the tables are hand-written.

## 13. A creature's shape is data, and its colour is the renderer's

**2026-08-05 · Claude**

`EnemyDefinition.shape` is `quadruped | crustacean | humanoid`, switched on in
`render3d/creatures.ts`. Colour lives in `render3d/palette.ts` and nothing outside it asks what
colour a rat is.

**Rejected:** a builder per enemy id.

**Why:** a new `ENEMIES` row is drawn with no view code written for it. Six creature colours have
been added since and no shapes, which is the seam holding.

## 14. Nothing the game hands out may lead nowhere

**2026-08-12 · Claude**

Three rules in `tests/systems/deadEnds.test.ts`: everything a gathering skill yields is a recipe
input; every other material has a use, a price or a door; nothing may be made that cannot be worn,
eaten or built with.

**Rejected:** a vendor price counting as a use for everything.

**Why:** a vendor price is enough for something that drops and nowhere near enough for something a
skill produces. A skill whose yield can only be sold is a skill that leads nowhere.

## 15. AFK play stays behind active play

**2026-08-08 · Claude**

The camp never uses an ability, `awardXp` halves what it earns, and an offline session caps at half
a level.

**Rejected:** a per-kill rate with no cap.

**Why:** eight hours in the richest zone out-earned the whole level curve several times over. It is
a share of a level rather than a fixed number because a level is a share of the game and the cap
moves with the curve.

## 16. What a camp does is derived, not stored

**2026-08-08 · Claude**

`afkCampJob` reads the tool in the weapon slot and the station underfoot. Nothing is stored and no
second button exists.

**Rejected:** a camp mode the player selects.

**Why:** it re-derives every frame, so a gear swap changes what the camp is doing. Mining arrived
later as a whole third skill, awake and offline, and cost the AFK code not one line.

## 17. A counter is a person, not furniture

**2026-08-24 · Claude**

The bounty board is a `quartermaster`; the reforger is a `fettler`. Both are `NpcRoleId` rows.

**Rejected:** a `StationId`, which is the other tappable thing in the world.

**Why:** `StationId` means "where a recipe is made", and `recipesAt`, `STATION_SKILLS`,
`STATION_PERSISTS` and `afkCampJob` all read it as one. A board or a counter wearing that id would
be dead data in four crafting tables. A role is a row and four compile errors.

## 18. Town trades in coin, Greyford trades in materials

**2026-08-30 · Claude, with the user**

All four counters at home deal in currency. The outfitter's offers are priced entirely in things a
gathering skill produces, with no copper anywhere on the table.

**Rejected:** making Greyford a second shop further away.

**Why:** without something of its own it is town in a different colour, which is exactly what
`docs/archive/zones_act_two.md` warned it would be.

## 19. The reforging stone is bought in town and spent at Greyford

**2026-09-01 · the user (location) and Claude (mechanism)**

The endgame coin sink is a shop row; the work is done at the outpost.

**Rejected:** charging coin at Greyford, which is where the user wanted the feature.

**Why:** it would have broken 18 the week after it was made. Splitting it keeps the outpost's claim
intact and the price the player pays is the walk, which every offer on the outfitter's board already
asks for.

## 20. A reforge moves power and never adds it

**2026-09-01 · the user**

`STAT_WEIGHTS` weighs every row in both directions and every piece is swept through every reforge it
can take.

**Rejected:** a small overall gain, which is more satisfying.

**Why:** every duel in `EnemySystem.test.ts` is measured against gear as the table wrote it. A
reforge that could raise a piece's total would put every one of those fights out of date _without
failing any of them_.

## 21. A reforge is keyed by item id, not by an instance

**2026-09-01 · Claude**

`CharacterState.reforges` is `Partial<Record<ItemId, ReforgeId>>`.

**Rejected:** keying by gear slot; adding item instances to the inventory.

**Why:** there are no instances — an inventory is a count per id, and there is no such thing as
_this particular_ chestplate. Keyed by slot, a reforge would jump onto whatever was equipped next.
Keyed by id it survives being unequipped, banked and withdrawn with nothing tracking it. Adding
instances would have rewritten the inventory, the bank and every panel that draws either.

## 22. One reforge roll, permanent

**2026-09-01 · the user**

**Rejected:** a re-rollable roll; no roll at all.

**Why:** livable only because of 20 — there is no outcome that leaves a piece worse than it was,
only a direction somebody would not have picked. The two answers hold each other up; permanence plus
an upgrade would be the version where a bad roll on a 20% drop costs an evening.

## 23. Gameplay is tested headless; smoke covers what only a browser can

**2026-08-03 · Claude**

`tests/world/` drives whole zones through combat, gathering, trading and camping in vitest.
`scripts/smoke.mjs` covers booting, cross-zone flows, real input events, HUD geometry at real
viewport sizes, GPU teardown and the save round trip.

**Rejected:** driving gameplay through the browser, which is what the pre-port smoke did.

**Why:** headless is faster, deterministic and does not need a renderer. What is left in smoke is
the half that genuinely cannot be faked — a real finger, a real clock, real GPU memory.

## 24. The simulation runs on a hand crank under test

**2026-08-04 · Claude**

`?loop=manual` stops the rAF loop stepping the game; `window.view.step(deltaMs, frames)` does it
instead, while the frame loop still draws and reads the mouse.

**Rejected:** waiting on wall-clock time in browser tests.

**Why:** every wait becomes a number of _game_ milliseconds, so a loaded CI runner makes the suite
slower rather than flakier. It is also how a frame-rate-dependent bug is reproduced on demand:
`view.step(140, 50)` is fifty frames at ~7fps, deterministically.

---

## 25. Buildings become hollow, and the game gains a pathfinder

**2026-09-01 · the user · supersedes the solid-buildings rule in `CLAUDE.md`**

Buildings gain interior space with a gap in the collision where the door is, and click-to-move
learns to route through it with A* over the tile grid. All ten buildings get an interior, and every
counter moves inside.

**Rejected:**

- **Interiors as zones**, where a doorway is a zone edge. Costs no new movement machinery and reuses
  the whole `GameContext` handover. Rejected because it puts two transitions on every shop trip, on
  a phone, in a game whose loop is already "walk somewhere and do something" — and because ten
  interiors would be ten `ZONES` rows to keep off the world map and out of the `visits` tally.
- **Keeping them solid and faking it** with a recessed porch and the NPC standing under the eaves.
  Cheapest by a distance. Rejected because the ask was to go inside.

**Why:** the expensive option pays for the other two answers. With real routing there are no
transitions, so "every counter inside" costs nothing per trip and "every building" stops meaning ten
hand-authored zones. It also fixes a papercut that predates the question: today a tap across a tree
stand walks into it and presses until the player gives up.

**What it costs:** the rule in `CLAUDE.md` that a building is solid, the three rules in
`BuildingSystem.test.ts` that follow from it, and a rewrite of how every walk in the game ends. See
`docs/archive/interiors_and_light_plan.md`.

## 26. Mobs do not path, but ranged abilities gain line of sight

**2026-09-01 · Claude**

Mob chase stays a straight line. `data/enemyAbilities.ts` entries with a range gain a wall check.

**Rejected:** pathfinding for mobs too.

**Why:** a building becomes a safe haven and anything that loses you leashes and heals, which is the
existing contract unchanged. Pathfinding for mobs means re-planning every chase, every frame, for
every mob in a zone — much larger than it looks and it buys much less. But the bandit's thrown knife
has a `minRange` and no wall check, so hollow buildings would let it sail through one: that is a
real bug the moment interiors land, and it is small.

## 27. Light and shadow come before the interiors, not after

**2026-09-01 · Claude**

Phase 1 of the plan is the sun, shadow maps and a depth cue. Interiors are phases 4-6.

**Rejected:** doing all the architecture first and the graphics last.

**Why:** shadows are the biggest single visual win and are independent of everything below them —
nothing casts one today, so nothing sits on the ground. Doing them first means the game looks better
even if the pathfinding work drags, and it means the frame budget is established before ten lit
interiors are asking to be drawn.

## 28. The frame budget gets an instrument before it gets a rule

**2026-09-01 · Claude**

`DebugView` gains a draw-time reading, and smoke's throttled section asserts a ceiling on it, as the
_first_ commit of phase 1 — before any lighting change.

**Rejected:** stating the budget in the plan and checking it by eye; measuring with a Three-specific
counter rather than through `DebugView`.

**Why:** the plan's central rule for phase 1 is "every change is measured on the throttled pass
before it lands", and there was nothing in the codebase that could measure it — `drawnCounts()` and
`gpuMemory()` answer _what_ is drawn and what it costs in memory, and nothing answered what it costs
in time. A rule with no instrument is a comment. Taking the reading before the first lighting change
also means the ceiling is set against what the game costs today rather than against a number
invented to fit whatever shipped.

`DebugView` rather than a renderer counter for the reason that interface is small and
renderer-agnostic in the first place: a check written against `cameras.main` did not survive the
last renderer swap, and this project has now done one.

## 29. The sun comes from behind the camera, and only the ground receives

**2026-09-01 · Claude**

A hemisphere fill and a directional light from the **south-west**, with shadow maps on. The ground
receives them and casts nothing; buildings, creatures and props cast.

**Rejected:** keeping the old light's north-west direction and adding shadows under it; making
everything a receiver as well as a caster.

**Why:** the camera's resting place is due south of the player, so a sun from the north put every
face anyone ever looked at in shade — which is why the flat fill had to be cranked to 1.5 and why
nothing in the world had any shape. From the south-west the lit faces are the visible ones and the
shadows fall away up the screen, where a 58° pitch shows them off. It does not follow the camera:
turning the view round to look into the sun and seeing the shaded sides of things is most of what
makes turning it worth doing.

Receivers were held to the ground because that is where a shadow is actually read — a wall darkened
by the shed next door is a subtlety on placeholder geometry, where a creature standing in its own
shadow is a per-fragment lookup on every material in the game. It is also the surface that cannot
cast: one flat plane covering the whole zone, tested against a depth map it wrote itself, is the
shortest road there is to acne over the entire floor.

**What it costs:** 4.4ms of the 40ms throttled draw budget, measured on a full smoke run before and
after.

## 30. The shadow camera is framed on the zone, not on what the camera can see

**2026-09-01 · Claude · reverses a line in `docs/archive/interiors_and_light_plan.md` phase 1**

The shadow frustum is cut to the zone's own bounds plus a margin, once per zone, and does not move
with the player.

**Rejected:** the plan's own instruction — "the shadow camera frames what the camera can see,
following the player, rather than the whole zone", on the grounds that "a zone is 1600 × 1216 world
units; a shadow map stretched over all of it is blocky at any resolution a phone can afford".

**Why:** the arithmetic says the opposite. A camera pitched 58° down sees ground from about 150
units in front of itself out to nearly 2000, so from the middle of town both edges of the zone are
on screen at once and a frustum framed on the viewport is **larger** than one framed on the map —
about 2400 units against 2300. The plan's claim about resolution was made without doing the sum: at
2048 texels the zone-framed map is a little over one world unit each, which is twenty texels across
a tree trunk. Framing the zone also has no shimmer in it, where a map that follows the player has
edges that crawl as they walk unless it is snapped to its own texel grid — a second mechanism the
zone-framed version needs none of.

**What it costs:** a zone much larger than today's would lose resolution where a following camera
would not. Every zone in the game is 25 × 19, and a bigger one would be a `frameZone` that took a
radius rather than a rewrite.

## 31. The depth cue is measured in camera distances, and starts nearer than the player

**2026-09-01 · Claude**

Linear fog to the background colour, with near and far as multiples of `cameraDistance(aspect)`
rather than fixed world distances — and a near multiple of 0.9, which is closer to the camera than
the player is.

**Rejected:** fog written in world units, which is what haze physically is; a near multiple safely
past the player.

**Why:** written in world units it would be the same fog in both orientations, which sounds right
and is wrong — a landscape camera frames its tiles across the smaller axis and sits less than half
as far back, so one range grazes the horizon on a portrait phone and swallows half the zone on a
landscape one. This is a cue about depth on screen rather than weather in the air, and the screen is
what it should be measured against.

Starting nearer than the player is the part that looks like a mistake and is the only thing that
makes the cue visible at all. There are barely 1.6 camera distances between the player's feet and
the furthest ground anyone ever looks at, so a range wide enough to clear the player leaves nothing
over: a near of 1.05 and a far of 1.5 measured 7% of haze between the bottom of the screen and the
top, which is nothing. Three's fog ramps on a `smoothstep`, whose near end is flat, so a near of 0.9
puts the player about three percent into the haze — invisible — and buys back the whole range.

**What it costs:** the player is fogged, by an amount nobody can see. `tests/render3d/camera.test.ts`
is what keeps it that way rather than a comment.

## 32. A readout drawn in the world is not scenery

**2026-09-01 · Claude**

Nameplates, worn titles, quest markers, shop signs, damage numbers, the bolt and the selection ring
all set `fog: false`.

**Rejected:** fogging everything the scene holds, which is what a depth cue does by default.

**Why:** these already opt out of the depth test for the same reason — a health bar hidden behind
the tree you are fighting beside is a bug, not occlusion — and hazing them fails the same way one
step further out. A signpost's label is how a phone leaves a zone, and it is furthest away exactly
when it matters most; a mob's health bar dimming with distance is a creature you cannot tell is
nearly dead from across a clearing. The post fades and the word over it does not, which is also the
thing that makes the far end of a zone read as far away without becoming unnavigable.

## 33. The pathfinder asks `isBlocked` rather than keeping its own picture of the world

**2026-09-01 · Claude**

`systems/PathSystem.ts` is A\* over the tile grid `CollisionSystem` already thinks in, and what makes
a cell passable is `isBlocked` on the body being routed, asked at a spot inside that cell.

**Rejected:** the plan's own instruction — "with the AABB blockers rasterised onto it and inflated by
`PLAYER_HALF_EXTENT`" — as a separate pass building a second grid; and a navmesh.

**Why:** the inflation a grid pathfinder normally writes out by hand is exactly what testing the
whole body at a point already does, so the rasteriser would have been a second description of what
is solid, free to drift from the one every walk in the game integrates against. A tree trunk that
moved in `CollisionSystem` and not in the pathfinder is a route into a tree with nothing failing.
The navmesh is a different scale of answer: the grid is 25 x 19, the search costs 1-2ms exhausted on
a real zone, and a mesh solves a problem this world does not have.

## 34. Where a body stands in a cell is part of whether it may go through it

**2026-09-01 · Claude**

`footing()` answers both at once: the point inside a cell the body stands at, and `null` when a route
may not pass. Waypoints are that point rather than the cell's centre.

**Rejected:** waypoints at cell centres, which is what a grid A\* hands back and what the plan
assumed.

**Why:** A\* answers with whichever cell is cheapest, never whichever is roomiest, so a route down a
corridor two tiles wide comes back hugging one of its walls — and a waypoint flush against a wall is
where a walk stops. The walk lands within `arriveRadius` of a waypoint rather than on it, so it
starts the next leg a hair off the line; a hair off the line beside a wall it is running along is a
corner in that wall, which refuses the one axis it was travelling on and leaves it correcting back at
a fraction of a pixel a frame. It neither stops nor arrives. Three of the hand-built worlds and one
real zone failed exactly that way before the footings existed, and every one of them was a route that
read correctly.

**What it costs:** a footing is sixteen probes, worked out on demand and remembered, so a search that
never reaches a corner of the map never pays for it — and the straight line most taps are answered by
asks for none at all.

## 35. A passage the body cannot turn round in is not a route

**2026-09-01 · Claude**

A cell needs slack — room on an axis, either side of the body, summed — on **both** axes to be
passable at all. A gap exactly the body's width has none on one of them and is refused.

**Rejected:** handing back the route anyway and letting the walk fail in it; testing a body padded by
the clearance instead of measuring slack.

**Why:** a body a tile wide fits a gap a tile wide only in exact arithmetic, and the walk does not do
exact arithmetic. Handing back a route nothing can walk is worse than handing back nothing, because
`null` is already meaningful: it is the caller's cue to do what it did before there was a pathfinder,
which is walk straight and press into whatever is in the way. A padded body was tried first and is
the wrong shape of test — it fails a cell beside a wall corner, which is perfectly walkable, and it
quantises to the cell grid, so any padding at all takes a two-tile corridor from passable to
impassable while a three-tile one survives.

Walking the length of such a passage is still fine and still happens: the straight line to the goal
is measured for the true body, so a corridor one tile wide can be walked end to end. What is refused
is arriving somewhere inside one and turning.

**What it costs:** phase 4 of `docs/archive/interiors_and_light_plan.md` asked to find out whether a doorway
is wide enough by measurement, and this is the measurement, arriving two phases early: **a doorway
has to be at least two tiles wide**, and `DOOR_SPAN` becoming a minimum in tiles is now a
requirement rather than a contingency.

## 36. The straightening is greedy forward, and only a shortcut has to earn its room

**2026-09-01 · Claude**

`pullStraight` reaches as far ahead as the line stays clear, measured for the body plus `CLEARANCE`.
The leg left over — the grid's own step, out of an anchor — is taken on the grid's authority and
measured for nothing.

**Rejected:** asking for the furthest reachable point from each anchor, which is the shorter answer;
measuring every leg with clearance; measuring every leg with the true body.

**Why:** the exhaustive version costs the square of the path's length in line checks where the greedy
one costs one per waypoint dropped, and a tap has to answer inside a frame. The split between the two
kinds of leg is the load-bearing part: a shortcut is this function's own idea and a leg that grazes a
wall is a worse idea than the corner it replaced, where the forced leg is the route itself and
refusing it leaves nothing. Holding the forced leg to the true body was tried and is too strict by a
hair — it rejects a leg that _touches_ a tree trunk's edge without crossing it, which is most of the
paths round a tree stand, and the case it was guarding against is the one entry 35 already refuses.

## 37. The route belongs to the player, and the decision to ask for one belongs to the caller

**2026-09-02 · Claude**

`Player` walks a list of legs; `moveTo` sets a route of one, which is what every walk in the game
already was. `ApproachDriver` is the only thing that calls `findPath`, so a walk on open ground and a
walk up to a counter are routed while a pursuit is not.

**Rejected:** planning inside `Player.moveTo`, so that every caller pathed for free; keeping the
route in `ApproachDriver` and stepping the player toward one leg at a time from there.

**Why:** the two rejected options are the same mistake from opposite ends. Planning in `moveTo` makes
every caller pay, and the caller that would have paid worst is the pursuit — `ApproachDriver.pursue`
re-aims at a moving mob every frame, so a plan there is a plan re-made sixty times a second, and a
route re-made every frame swings between two ways round an obstacle as its quarry drifts. Keeping the
whole route in the driver leaves `Player.update` unable to answer `hasMoveTarget()` for anything but
the current leg, which is the flag `AbilityCaster` refuses a cast on and `resolveApproach` reads as
"still walking" — both would have gone true and false again at every waypoint.

What is left is a split along the seam that was already there: how a walk is _walked_ is the player's,
because that is where `stepToward` and `moveWithCollision` already live, and whether a walk needs a
route is the caller's, because only the caller knows whether its destination will still be there when
the walk arrives.

**What it costs:** mobs still do not path and neither does the player chasing one. Walking round a
building after something that ran behind it is the case, and it is the same straight-line press it
has always been.

## 38. A leg is given up inside the frame that reaches it

**2026-09-02 · Claude**

`stepAlongRoute` loops: it drops each leg it has arrived at and steers for the next one in the same
`update`, rather than one leg per frame.

**Rejected:** a leg per frame, which is what the pathfinder's own test walker does.

**Why:** `stepToward` reports arrival _before_ it moves, so a frame that reaches a waypoint is a frame
the player stands still. At 60fps that is invisible; at 5fps it is a fifth of a second of nothing, at
every waypoint — and a route only has waypoints in it because there was a corner there to be got
round, so the stutter lands exactly where the walk is already hardest to read. The test walker gets
away with it because it is not counting frames.

## 39. A walk toward something solid is routed to beside it and finished by pressing into it

**2026-09-02 · Claude**

`standNear` backs a blocked goal along the line the walk comes in on until the body fits, and that is
what the route is asked for. `ApproachDriver.walkTo` then appends the _original_ point as a last leg;
`walk` does not.

**Rejected:** routing to the goal and letting `findPath` refuse it, so every walk to a tree or a vein
fell back to the straight line; ending the routed walk at `standNear`'s point for both kinds of walk.

**Why:** `findPath` may not end a route inside a wall and that rule is right, but almost everything
worth tapping is solid — every tree, every vein, every building — so refusing outright would have
left the pathfinder wired in and doing nothing for the most repeated action in the game. Backing down
the line lands where the straight walk would have stopped against the thing anyway, so it changes
where the player ends up not at all and changes only whether there was a way to get there.

Ending _at_ that point is the part that had to be taken back. A body's width short of a vein, minus
the arrival band a slow frame widens to 38px, is outside a gather's reach with nothing left to close
the gap — the walk finished and the gather was abandoned. Pressing up against the trunk is how this
walk has always ended and is what satisfies the radius `resolveApproach` asks about every frame, so
the route gets there and the straight line finishes. The split falls where the driver's own split
already is: something is waiting at the end of a `walkTo` and the radius decides when it is near
enough, where a `walk` on open ground is answerable in full by the nearest place the body can stand —
which is why a tap in the middle of the pond now walks to the shore instead of grinding into it.

**What it found and did not fix:** below about 10fps a body cannot close the last pixels onto a
blocker at all. `moveWithCollision` cuts a frame into half-tile substeps and reverts a blocked one
whole, so at 5fps it stalls up to 32px out — far enough that a tap on a vein never gathers. That is
true on `main`, with no route involved, and fixing it is a change to how every walk in the game
resolves; it is written down here rather than fixed in a phase about routing.

## 40. A building blocks with its walls, and its footprint stops being a blocker

**2026-09-02 · Claude**

`buildingWalls` answers with up to five rectangles — three whole walls plus the door wall in the
segments either side of its opening — and `zoneEntities` gives those to `CollisionSystem` in place of
the one `buildingRect` it used to. The footprint is still what a thumb aims at and what hides the
player, so the three questions a building used to answer with one rectangle now answer with two.

**Rejected:** painting the walls in as `WALL_TILE`, which is how the hideout and the barrow are
solid.

**Why:** a zone's contents are offsets from the middle of the map and the tile grid is written out in
absolute rows, so a building painted into tiles would have to be placed twice — once in `zones.ts`
and once in the map file — and moving one would silently move only half of it. That is the same
argument that put buildings in `buildingSpawns` in the first place, and hollowing does not change it.

**What it costs:** the walls run the full span of the footprint, so they overlap at the corners. That
is free — a blocker is a rectangle a body may not be in, and being in two of them is being in one —
and the alternative was four rectangles that have to agree about who owns each corner.

## 41. A doorway is two tiles wide, or the wall is simply open

**2026-09-02 · Claude**

`doorGap` is `Math.min(MIN_DOOR_SPAN, along)`, so a wall no wider than two tiles has no segments at
all and the front is open. Three buildings are in that case: the smithy, the inn and the cottage.

**Rejected:** growing those three to three tiles so every building could have a doored front.

**Why:** two tiles is measured rather than chosen (decision 35) — a body is exactly one tile wide and
`footing` refuses to put a waypoint in a gap with no slack in it. Town has no room to grow them: a
three-tile cottage was tried in every position the south-west corner allows and each one put a rat's
wander disc or a tree's working ground inside a wall. And for one of the three it is not a compromise
at all — the `workshop` shape's own comment already called the smithy "a roof over an open front
rather than a storey".

## 42. Being inside cuts the building away rather than fading it

**2026-09-02 · Claude**

`BuildingActor.sync` hides the roof outright and hides whichever walls the camera has got past the
plane of, and switches the occlusion fade **off** while it does.

**Rejected:** reusing the fade, which is what `occlusion.ts` already does for a camera behind a
building.

**Why:** a roof faded to a quarter still reads as a lid over your head. And the far walls are the
whole of what a room is read against, so fading them along with the near ones leaves an interior with
no shape at all — the fade and the cutaway are answers to the same question and giving both is worse
than giving either.

The test for a wall is that the camera is past its own plane rather than merely on its side, which is
stronger than it needs to be and deliberately so: a camera due south of a building is a hair to one
side or the other of its centre line, and the weaker test would flicker the east and west walls on
the sign of a rounding error.

## 43. Two taps to go indoors

**2026-09-02 · Claude**

A tap on a building resolves to its doorstep, as it always has — and to the middle of the room when
the player is already standing within a tile of that doorstep (`BuildingActor.tapPoint`). From
inside, the building answers `pickBox()` with `null`, so a tap on the floor reaches the ground.

**Rejected:** leaving the doorstep as the only answer; resolving a tap to wherever the ray meets the
ground inside the room.

**Why:** from outside there is no pixel a thumb can put on a floor. The roof is drawn over the room
and the pick box is the whole footprint standing as tall as it is drawn, so every ray aimed at the
inside meets the building — which means that with one meaning per tap, the rooms this phase opened
would have been reachable by keyboard alone, on a game laid out for a phone. Reading the ground under
the ray was the alternative and it answers the wrong question: what the ray meets first is a roof, and
a tap that fell through one would mean "walk to the grass behind the shop" the moment it missed.

The `null` from inside is the same rule seen from the other side. Left pickable, a tap meant to cross
a room would resolve to the doorstep and walk the player back out through the door they came in by.

## 44. A blow that crosses a gap needs a line of sight; a swing does not

**2026-09-02 · Claude**

`hasLineOfSight` in `CollisionSystem` is asked before an enemy ability is wound up and again when it
lands. Auto-attacks, in either direction, are not asked.

**Rejected:** gating every attack on it; gating only the `thrown` ability.

**Why:** the bandit's knife through a shop wall is a bug this phase created — it was impossible to
stand behind a wall until a building had an inside — so closing it here is closing what hollowing
opened. Extending it to auto-attacks is not the same size of change at all: a tree trunk is a
`blockers` entry exactly as a wall is, so every tree in the game would become something to fight
around, and that is a retune of the whole of combat rather than a fix. Restricting it to the thrown
one would have left a Cleave landing through a quarter-tile of masonry, which is the same wrongness
with a shorter reach — and the check is one predicate either way.

Asked at both ends on purpose: refused at the start so a telegraph that could never land is never
shouted, and again at the finish so stepping behind a wall during the wind-up is a dodge. That second
one is the mechanic the wind-up already had, measured a different way.

The segment test is exact rather than sampled. The thinnest solid thing in the world is a wall at a
quarter of a tile, so a sampled line needs a step finer than that — and that step is a constant that
quietly stops being fine enough the day something thinner is built.

## 45. A tap on a shopfront is a tap on whoever works behind it

**2026-09-02 · Claude**

`BuildingActor.tapAnswer` answers a tap on a building somebody works out of with `{kind: 'npc'}` —
the person inside — where a building nobody works out of still answers with its doorstep, and with
its room from that doorstep (43). Which building is which is geometric: `occupant` is whoever of the
zone's people is standing in the room.

**Rejected:** leaving a shopfront answering with its doorstep, which is what phase 5 of
`docs/archive/interiors_and_light_plan.md` said to do — "unchanged: from outside, a tap on a shop still walks
you to its doorstep". Also rejected: a `building` kind in `WorldTap`.

**Why:** the counters went behind walls in this phase, and from outside there is no pixel a thumb can
put on one — the roof is drawn over the room and the pick box is the whole footprint standing as tall
as it is drawn. Under the plan's letter, shopping became three taps on the most repeated action in
the game: the doorstep, then the room, then the person now finally visible. It is one tap here, and
the walk it asks for is the one the pathfinder was built two phases ago to answer.

The stronger reason is that the question could not be left alone. `pickTap` ranks NPCs above
buildings, so a ray that happens to cross the counter's own box already answered `npc` while the ray
beside it answered `doorstep` — _part_ of every shopfront meant one thing and part meant the other,
invisibly, decided by where a figure's box happened to fall under a roof nobody can see through. This
makes the two agree rather than leaving a thumb two answers.

The doorstep exception from 43 survives and wins over the counter, which is what keeps a room
reachable: in a hut too shallow to walk into, the walk to the counter ends at the threshold, and the
second tap from there is still "go in".

## 46. A counter's room has to be three tiles deep, and the reach came down to make four of them one

**2026-09-02 · Claude**

`NPC_INTERACT_RADIUS` is 64 rather than 120. `counterPoint` puts the counter a tile back from the
middle of its room, capped at the room's own half-depth. Between them, the walk to a counter ends
inside any room deeper than twice the radius — four of the six — and at the threshold of the other
two.

**Rejected:** leaving the radius at 120; standing the counter against its back wall; deepening the
two-tile huts so that every counter is one you walk into.

**Why:** 120 was tuned for people standing in a field, where being generous cost nothing. A
three-tile shop is 160 units of floor and its doorstep sits 48 outside that, so a reach of 120 is one
that serves the player _in the street_ — the walk stops before the threshold and nobody ever goes
inside. That is the whole phase undone: rooms with counters in them that no player ever sees, and a
phase 6 fitting out furniture nobody would ever stand next to. The reach is what decides whether a
room is somewhere you stand, so it is the thing that had to move.

Against the back wall was the first placement and it is wrong for a reason worth keeping: A\* walks
tile centres, so a counter in the wall's own tile row is a counter with no cell to be reached
through — `footing` refuses the cell, and `findPath` then answers `null` for the entire walk rather
than for the last few pixels of it. `tests/systems/PathSystem.test.ts` caught it as "town: 992,368:
expected null not to be null" the first time it was run. A tile back from the middle keeps the
counter in a cell a body can stand in, and leaves exactly the gap the customer occupies.

Deepening the huts is the fix that would have made the rule uniform, and town has no room for it: the
quartermaster's post is pinned between the road it fronts and a cottage whose own doorstep is in the
way, and moving that cottage runs it into either a rat's wander disc or the strip the north road's
travellers arrive on. So two counters are served from their doorway, and
`tests/systems/BuildingSystem.test.ts` asserts _which_ — a room that changes side has to be moved
deliberately rather than drifting.

## 47. A door faces open ground; a counter no longer needs a clear lane of its own

**2026-09-02 · Claude**

The lane sweep in `tests/systems/BuildingSystem.test.ts` measures out from a building's **doorstep**,
along whichever way its door faces, and only for the buildings somebody works out of. What it used to
measure was the lane due south of each _counter_. Beside it, a new sweep routes a body from the
zone's spawn point to every counter in the game.

**Rejected:** keeping the lane measured from the counter; applying the door rule to every building.

**Why:** measured from the counter it is now a question about the shop's own south wall, which is
always in the way — the person is behind it. What the rule was ever about is the approach, and the
approach ends at a door. Generalising it to the door also generalises it off the south axis, which is
what the smithy needed and never had.

Every building was tried and fails honestly: the cottage north of the quartermaster's post fronts
straight onto it. Which way an empty house faces costs nobody anything, so the rule belongs to the
buildings that are walked up to on purpose.

The route sweep is the prize phase 2 was built for, and it is not the same assertion as "every
building can be walked into" one paragraph above it. That one ends wherever the middle of a room is;
this one has to end on a spot chosen for somebody to stand at, which is the placement 46 got wrong
the first time.

## 48. Nothing in a room blocks, because the room is the route

**2026-09-03 · Claude**

`render3d/interiors.ts` draws a floor and a few pieces of furniture in every building in the game,
and none of it is a `CollisionSystem` blocker. It lives in the renderer rather than in `data/`, keyed
by `BuildingShapeId` in `BUILDING_LOOKS` with a per-`BuildingId` override table beside it — the same
shape `CREATURE_OVERRIDES` already has.

**Rejected:** furniture that blocks, added to `buildingWalls` beside the walls; a counter drawn
across the front of the person behind it.

**Why:** the arithmetic in 46 leaves a room with almost no floor to spend. A three-tile shop is 160
units of it; the counter stands a tile back from the middle and the customer ends
`NPC_INTERACT_RADIUS` in front of that, so the two people already fill the room end to end. A
blocking fitting would be a cell A\* refuses, and 46 is the record of what that costs — `findPath`
answers `null` for the entire walk rather than for the last few pixels of it, so a shelf in the wrong
tile is a shop nobody can reach rather than a shop with a shelf in it. The counter desk is the same
sum: the gap between the two people is 64 units and a body is 64 wide, so a desk between them is a
desk somebody is standing in.

What keeps "you can walk through the furniture" from being the lie the walls are drawn to avoid is
`FITTING_DEPTH`, which is the thickness of the wall a fitting stands against and is **measured
rather than chosen**. A two-tile hut's floor is 96 units across, so a body standing in the middle of
one — where the second of the two taps to go indoors puts them — leaves sixteen units to either
wall. Anything deeper is furniture a player is standing inside the moment they walk in, and
`tests/render3d/interiors.test.ts` fails on it: it puts a body on all three of the spots the game
stands somebody on and asserts each is clear.

Keeping it out of `data/` follows from the same fact. Nothing here blocks, is gathered, is tapped or
is stood on, so the simulation has no opinion about any of it — a shelf is scenery in the sense a
rat's brown is, and a `BUILDINGS` column for it would be data the world reads and never uses.

## 49. One light indoors, moved to whichever room the player is in

**2026-09-03 · Claude**

`RoomLight` is a single `PointLight` that lives in the scene for the life of the session with its
intensity at zero, and is moved into a room and lit — in that room's own `lamp` colour — for as long
as the player is standing in one.

**Rejected:** a light per building; adding and removing the light at the doorway; leaving the rooms
lit by the sun alone.

**Why:** ten point lights would sit in every shader in the scene for the nine rooms nobody is in, and
eight of the ten would be lighting the inside of a box with a roof on it that no camera can see into.
The sun alone was the free option and it is the one the cutaway rules out: taking the lid off a room
leaves it standing in full sunlight, because a hidden roof casts no shadow either — so without a
light of its own an interior is the outdoors with walls round it, which is precisely what this phase
exists to stop.

Adding it at the doorway is the version that costs nothing while outdoors, and it is rejected on
principle rather than on measurement. Three keys a material's program on how many lights the scene
holds, so a light arriving recompiles every program in the world on the frame it arrives — which
here is the frame somebody walks through a door.

What the phase costs is **about ten of the forty milliseconds**, leaving about nine, and the honest
version of that took two attempts to arrive at. It was first written down here as "one to three of
forty" off dev-container runs reading 25.5ms before the phase against 27.0 and 29.2 after. Those
runs were not wrong so much as unrepeatable: the same container later read 33-39ms on the _unchanged_
phase 5 tree and 42-51ms on this one, so its baseline drifts by more than the effect being measured
and, sitting at 33-39 against a 40ms ceiling, it has no headroom left to see a difference in at all.

CI is the machine the ceiling was calibrated on and it is quiet: three consecutive runs of the
throttled pass read 20.06ms on the phase 4 tree, 20.66ms on phase 5, and 30.74ms on this one. Phase 5
moving within the noise is what makes the ten attributable to _this_ phase rather than to interiors
arriving generally, and the dev container's own delta was the same ten on a slower floor — two
machines agreeing on the size while disagreeing on the offset.

The rule that falls out of it, and the reason this paragraph is worth its length: **read `drawTime()`
off CI, not off a dev container.** A number measured where the baseline moves 14ms in a day is a
number about the container.

Whatever of the ten belongs to the light rather than the furniture is still not separated, and on
this evidence cannot be from outside: it is paid everywhere and always, since every lambert material
in the world evaluates one more light per fragment whether this one is burning or not.

## 50. `drawTime()` is read off CI, not off a dev container

**2026-09-03 · Claude**

The throttled draw figure that decides whether a phase fits its budget is taken from the `browser
smoke` job on CI. A dev container's number is for iterating on, not for recording.

**Rejected:** trusting the container the work is done in, which is what phase 6 first did.

**Why:** the container reads the _same tree_ differently across a day. Phase 5's code measured 25.4ms
in the morning and 33.5-38.9ms that evening; phase 6's measured 41.7-50.5ms against a 40ms ceiling it
was already failing on the unchanged baseline. A floor that moves 14ms cannot measure a 10ms effect,
and once it sits at 33-39 of 40 there is no headroom left to see anything in at all. CI over the same
period read 20.06, 20.66 and 30.74ms on the three trees — quiet enough that phase 6's ten
milliseconds is visible and attributable, which on the container it was not.

**What it cost to learn:** phase 6 shipped its own cost into `CLAUDE.md`, this file and the plan as
"one to three of forty" when it is ten, and left the plan telling phase 7 it had 11-13ms to spend
when it has nine. All four were corrected in the same PR that found it.

**The failure mode to watch for:** a red budget check on a loaded container is ambiguous — it says
either "this phase is too expensive" or "this machine is slow", and the two are told apart by
measuring the _unchanged_ baseline on the same machine in the same session. That is the step worth
not skipping, and it is cheap: one full smoke run on the tree you branched from.

## 51. A ground vertex is coloured by what it touches, and a blocking tile touches nothing

**2026-09-03 · Claude**

`buildGroundGeometry` draws each tile as four quads rather than one, and colours every vertex with
the mean of the tiles that reach it — one under a tile's middle, two either side of an edge, four at
a corner. Two tiles are in that mean only if they agree about being crossable, so grass, path, sand,
marsh and stone all fade into one another and water and wall do not.

**Rejected:** leaving the tile flat and hard-edged; blending at the corners alone, with no sample in
the middle; blending everything including the shore; a texture, or a second material with a mask.

**Why:** at tile resolution a flat quad draws every boundary as a staircase of 64-unit squares,
which is the item phase 7 was written to fix. Corner sampling alone is the obvious fix and it is
wrong in a way that only shows up on the screen: with four samples per tile and every one of them an
average of its neighbours, a three-tile road has no pure road anywhere in it and reads as a brown
smear. The middle sample is the whole point of cutting the tile up, and two steps is enough to have
one — nine quads a tile would buy a narrower transition for four times the vertices, against a draw
budget with nine milliseconds left in it.

The shore is the interesting half. Everything walkable blending into everything else walkable is
right because a road is a place the grass has been worn off rather than a thing with an edge. Water
is not: the line is where a body is stopped, `CollisionSystem` puts it exactly on the tile boundary,
and a gradient is a gradient somewhere in the middle of which walking stops working. `blends` is
therefore a rule about `BLOCKING_TILES` rather than a blanket average, and it costs nothing to state
because both sides of a boundary compute the same filtered set and so agree on the seam by
construction.

The per-tile brightness wobble had to move with it. Held flat across a tile it would have put back
exactly the grid of hard squares this exists to take out, drawn in brightness rather than in hue, so
`tileShade` became `cornerShade` with `shadeAt` interpolating between corners.

## 52. Where the ground steps down, it grows the face it steps down

**2026-09-03 · Claude**

A water tile sits `WATER_DEPTH` below the land and the two were never joined, so the far rim of every
pond in the game was a band of the background showing through the hole. Each tile now grows a
vertical quad on any side whose neighbour stands higher, wound to be seen from the low side and
coloured as the ground it is cut into, darkened.

**Rejected:** flattening the water into the land, which is the version with no seam at all; a solid
box under each pond; leaving it, on the grounds that at 58° it was a thin line.

**Why:** the depth is what makes a pond read as a hole rather than as blue ground, and phase 7's
whole business is that the camera comes down — at 45° that thin line is a band. Written against tile
_height_ rather than against water by name it costs nothing to generalise, so the day something else
steps down it is drawn already.

Single-sided and wound toward the low tile, deliberately: the face is only ever seen from inside the
dip, because the ground above covers it from the other direction. Wound the wrong way it is the void
it was added to fill, which is why the winding is asserted rather than eyeballed.

## 53. The camera is pitched 45°, and the framing stopped being a function of the pitch

**2026-09-03 · Claude**

`CAMERA_PITCH` came down from 58° to 45°. `TARGET_TILES_ACROSS` stopped being multiplied by
`sin(pitch)` and became ten tiles of _width_ rather than twelve of depth, and `FOG_FAR` went from 1.8
to 2.1.

**Rejected:** 50°, which is the conservative version and barely reads as a change; 40°, which puts
the south signpost under the tab bar and shows a fifth of the screen as void; lowering the pitch on
its own and letting the framing and the fog follow it silently.

**Why the angle:** what a 58° camera draws is roof planes and the tops of heads. That was the right
call while the world was rats and trees and is the wrong one after phase 6, which built ten rooms
nobody could see the inside of. A world unit standing up is worth `cos(pitch)` on screen and one
lying flat is worth `sin(pitch)`, so 45° is exactly where a wall stops being a line under a lid — and
the pitch has a floor at half the field of view, where the horizon comes into frame and a tap has
nothing to land on. The tab bar is the other bound. Between them the angle is a band, and
`tests/render3d/camera.test.ts` now holds both ends of it rather than only the bottom.

**Why the other two moved,** which is the part worth not re-learning: neither said on its face that
it depended on the pitch, and both did.

- `cameraDistance` framed twelve tiles of _depth_, through an obliquity factor that is only there
  because ground seen at an angle covers more of itself. A screen is a fixed box, so a framing can
  hold the width still across a change of pitch or the depth, and not both — and holding the depth is
  the version where tilting the camera also zooms it. Tilting to 45° pulled the camera 17% closer and
  took a tile and a half off either side of the screen, which nobody asked for and which is invisible
  in the number that caused it. Framed by width, ten tiles is what the old framing happened to draw
  and the pitch has nothing left to spend here — the tab-bar margin came out _wider_ than it was at
  58°, so the pitch cost nothing in the end.
- `FOG_FAR` is a multiple of that camera's distance, and three's fog measures depth along the
  camera's own axis. A shallower camera lays that axis down closer to the ground, so the same tile of
  grass is further along it at the same distance from the same camera: left at 1.8, the grass six
  tiles ahead went from 15% hazed to 22% and the far side of a zone from 25% to 38%.

Both are the lesson `MAX_AVOIDANCE` taught in combat — a ratio quietly stops meaning what it says
when the thing it is a ratio _to_ moves — so the depth cue is now measured in **tiles ahead of the
player** in the tests, which is where it is read, rather than in the multiples it is written in.

**What it cost to draw: nothing CI can see.** The throttled pass read **25.15ms** on PR 122's CI run,
against the 30.74ms phase 6's run read on the tree this branched from — under the baseline rather
than over it. That is not a claim that the phase made drawing cheaper: two single readings three
weeks apart on whichever runner GitHub handed out are not that precise an instrument, and nothing
here should have got faster. What it does say is that the ground's extra vertices — 950 triangles
to about 3,800 plus a bank per pond edge, against a pixel count that has not changed — cost less
than the difference between two CI runs, and the nine milliseconds phase 6 left are still there.
The dev container could not have said even that: three runs in one session read 47.25ms on the
unchanged tree and 49.00 and 45.57 on this one, all over the ceiling, which is decision 50 working
exactly as written.

## 54. The graphics stay procedural

**2026-09-25 · the user, asked by Claude**

Act three improves how the game looks, and every improvement is code: geometry, vertex colour,
lights, and shaders written here. The renderer still loads no image, model or sound file.

**Rejected:** free CC0 asset packs (glTF models, textures, recorded audio), which are the fastest
route to a bigger visual jump; and doing the code-only work now with the asset question left open.

**Why:** the zero-asset pipeline is what keeps the GPU budget and the teardown check predictable —
`renderer.info.memory` counts what the game builds, and nothing the game builds is a file somebody
else sized. It is also the original "no art skills" constraint in `docs/initial_design.txt`, now
chosen rather than inherited. If the ceiling is reached, that is a new decision, not a reopening of
this one.

## 55. Act three's features are all four that were offered

**2026-09-25 · the user, asked by Claude**

Fill levels 4-8 with directed content, stop a full pack destroying loot, add sound, and land willow
with fletching and a bow. All four are phases of `docs/act_three_plan.md`.

**Rejected:** a third class, and multiplayer groundwork, neither of which was chosen this round.

## 56. Cleanup before features

**2026-09-25 · the user, asked by Claude**

The three duplicated joints the read found — six counters written six times, the HUD's hand-kept
redraw lists, and an rng that stops at the wander — are fixed before any feature is built on them.

**Rejected:** refactoring only what a feature touches, as it touches it; and leaving the
architecture alone.

**Why:** every feature in the plan lands on one of those joints. Upper-band quests need a counter
other than the shop to offer quests; loot piles and bows add panels and rolls. Built first, each
joint is fixed once; built alongside, it would be half-fixed three times.

## 57. `CLAUDE.md` holds the rules and a map; the reasoning moves to topic docs

**2026-09-25 · the user, asked by Claude**

`CLAUDE.md` was 150 KB — about 37,000 tokens loaded into every session. It is cut to the project
summary, the commands, the workflow, the seams and the invariants, and says where to read more.
Everything it said about a subsystem moves, verbatim where it is still true, into
`docs/architecture/<topic>.md`.

**Rejected:** trimming only the history in place; leaving it as it was.

**Why:** the essays are the most useful thing in the repo for the session whose work touches their
topic and a cost on every other session. Moving rather than trimming loses nothing — a paragraph
either stays or moves — and a topic file is read at exactly the moment its reasoning is worth the
tokens.

## 58. The world's edge is the map carried outward into a haze, not a skybox

**2026-09-25 · Claude**

The ground mesh grows `APRON_TILES` of the nearest edge tile past every side of the map, dimmed over
its first three tiles, and the fog's colour and the clear colour are one per-setting haze.

**Rejected:** a sky dome or gradient, which the camera cannot see — at a 45° pitch with a 50° field
of view the horizon is never in frame, so every pixel is ground and a sky would be drawn only where
the ground had run out; a neutral "out of bounds" tile around every map, which reads as a border
drawn round a board; and leaving the apron undimmed, which makes the bounds clamp an invisible wall.

**Why:** what the top fifth of a portrait frame showed was the clear colour where the mesh stopped.
Carrying the edge outward keeps a road that leaves by an exit visibly leaving, and making the haze the
clear colour means there is no line anywhere for the eye to find.

## 59. Underground is dark, and the one point light is the player's lantern there

**2026-09-25 · Claude**

`ZoneDefinition.setting` names what kind of place a zone is; `render3d/atmosphere.ts` says what each
looks like. Underground dims the fill and the sun and lights the player's surroundings with the same
point light a room is lit with.

**Rejected:** torches as point lights placed from the data, which the plan proposed. Every light in
the scene is evaluated by every lambert fragment whether it is burning or not, the throttled budget
is measured on a phone eight times slowed, and a light count that changed with the zone would
recompile every program on the frame the zone changed.

**Why:** the room lamp and the lantern can never be wanted at once, since nothing is built
underground, so one light is both and the scene's light count never moves. A lantern is also the
better picture: a cave reads as a cave when the rock around the player is lit and the passage ahead
falls off into the dark.

## 60. Sound settings are kept per device, not on the character

**2026-09-25 · Claude**

Mute and volume live in `localStorage` under a key of their own (`audio/settings.ts`), beside the
save rather than in `CharacterState`, and the host is the one thing that writes them.

**Rejected:** a `sound` field on `CharacterState`, which would have come with a migration step and a
save to carry it.

**Why:** it is a fact about the speaker, not about the character. A character played on a phone on
a train and on a laptop at home wants two answers, and a reset that wipes the character should not
unmute the phone — smoke checks exactly that, muting before a reset and finding it muted after. It
is also the version that needs no migration and cannot break a save: a setting that fails to load
falls back to the default, where a malformed field on the save is a save with no chain to the
current version.

## 61. A moment worth hearing is a `WorldEvent`, even when the view draws it from state

**2026-09-25 · Claude**

`CombatDirector` pushes `{ kind: 'wind-up', by }` on the frame a creature starts winding up an
ability. The view ignores it — the telegraph ring is drawn from `mob.windUp` every frame — and the
sound board hears it as the warning.

**Rejected:** the board reading `mob.windUp` off the world's mobs each frame, the way the view does.

**Why:** a view can poll state because it redraws every frame anyway; a sound cannot, because what
it has to know is the moment something _began_, and a poll only finds that out by keeping a copy of
last frame's state to compare against — a second picture of the world, kept by the one consumer that
has no other reason to hold a reference to it. The board hears the two channels and nothing else,
which is what keeps it as swappable as the renderer. So the rule for the next sound: if the moment
is not already on the view channel, the world pushes it there.

## 62. A camp leaves no loot pile; only an attended player gets one

**2026-09-25 · the user, asked by Claude**

A kill whose drops do not fit leaves a pile (phase 10) only when nobody is camping. A camp keeps
doing what it does now: offline, a refusal is counted into the away report's `missed`; awake, it is
the log line per refused drop and the one full-pack warning.

**Rejected:** a pile under an awake camp as well, which the plan left unsaid.

**Why:** a pile is something to come back for, and a camp is the case where nobody is there to. Piles
under an unattended camp would accumulate for as long as it ran.

## 63. A loot pile lasts one minute, each kill leaves its own, and it outlives a death

**2026-09-25 · the user, asked by Claude**

A pile is gone one minute of game time after it drops. A second kill's refusals make a second pile
rather than joining one nearby. A death does not clear piles — the respawn is in the same zone — so
only a zone change or a teardown drops one early.

**Rejected:** "a few minutes", the plan's figure; merging refusals into a pile already on the
ground nearby; clearing piles on a death.

**What it means:** every map is 25×19 tiles, so a minute is time to make room and pick a pile up, or
to walk back to it from the respawn point, and not time to go to town and sell first.

## 64. The bow shoots arrows: spent, quivered, bought first and made later

**2026-09-25 · the user, asked by Claude**

The bow needs ammunition, and every question about it was put to the user:

- **An arrow is spent on every shot.** With none left, the archer fights with their fists.
- **Arrows ride in a quiver in the offhand**, which the bow leaves free by taking both hands. **The
  quiver is an item with stats of its own**, replaced by a better one as the character levels, the
  way armour is.
- **The first arrows are bought**, from a shop, and **humanoid creatures drop them**.
- **Bows and arrows each carry their own stats, and both change a shot's damage** — which arrow is
  nocked matters, not only which bow.
- **They are made by fletching and smithing** together: fletching for the wood, smithing for the
  metal. **One log makes several shafts, and one iron bar several heads.**
- **An arrow weighs well under 1**, so a character can carry a good many.

**Rejected:** a bow with no ammunition, which is what the plan described by not mentioning any; a
bow that refuses to fire when the quiver is empty; arrows carried in the bag and spent from the
stack; arrows equipped straight into the offhand as a stack, with the quiver only a picture; arrows
that differ in nothing but name; a fletching bench in town so a level 1 archer could make their
own; and a recipe's one output per input, which is all the game has had.

## 65. A third class, the ranger, whose weapon is the bow and whose stat is agility

**2026-09-25 · the user**

A ranger joins the warrior and the wizard. The bow is its weapon, and its damage scales with a new
third stat, **agility**. Beyond that, **agility adds physical crit chance, and for now nothing
else** — left open for later iterations, so a future use of it is an addition rather than a
reversal. A warrior can still draw a bow, but it is not meant to be a good idea. This reverses the
part of decision 55 that rejected a third class for act three; 55 stands as written, since this
file is appended rather than edited.

**Rejected:** the plan's bow for the warrior, as the only use of a bow; a bow only the ranger may
hold; scaling the ranger off strength or intellect, the two stats that exist; dodge, or anything
else, as a second use of agility for now; and "hunter" as its name.

## 66. A loot pile says it is going by blinking, and nothing counts its minute down

**2026-09-25 · Claude**

A sack blinks through the last ten seconds of its pile's minute, timed off the pile's own clock. Its
context-menu card says a pile lasts a minute from the kill, and nothing anywhere shows how much of
that minute is left.

**Rejected:** a countdown on the card, which is settled when the menu opens (every card is, so one
left up never describes something that has since changed) and would be wrong a second later; a
timer over the sack, which is a nameplate per pile — a texture baked and disposed for every kill a
full pack makes, and text on the ground where nothing else has any; and saying nothing until the
sack vanishes, which leaves a player walking back to it no way to know whether to run.

**Why:** a thing on the ground blinking before it goes is the oldest convention the genre has, reads
from across the map at a glance, and costs a `visible` flag. Reading it off the world's clock rather
than the view's means the blink always ends where the world takes the pile away: the sack is never
seen to come back on after it is gone.

## 67. A higher rank is its own ability, in the slot of the one below it

**2026-09-26 · Claude**

Levels 5 to 8 sell a second rank of each class's four abilities. A rank is a new `AbilityId` that
names the one it improves on (`rankOf`); it is drawn in that ability's slot on the bar, replaces it
in the trainer's list, runs its cooldown clock, and is taught only to somebody who knows the rank
below. It is the rank below made better at the one thing it does, with the cooldown, reach, cast
time and governing skill unchanged.

**Rejected:** new abilities at 5 to 8, which the four-button bar has no room for; a rank number
stored beside each learned ability, which is a save migration where a new id is none; selling a
second rank to somebody who skipped the first, which is a lesson skipped rather than an upgrade and
a way round the first's price; a cooldown per rank, which makes the trainer a way to reset one;
and ranks that change what a button is for (a heal that became instant, a nuke with a shorter
cooldown), which would be a different ability wearing the old one's slot.

## 68. The upper band's chain crosses Greyford's yard, and pays its gear on a collect

**2026-09-26 · Claude**

Five quests above level 3, given at Greyford: the outfitter's goblins, lurker hides and (as the
errand off the chain) Deep Cut coal, then the fettler's raiders and the barrow king. The fettler's
first link waits on the outfitter's work. The gear reward — each class's least-dropped chest in its
own tier — is on the hide collect.

**Rejected:** gear on the goblin kill that opens the chain, which is where the starter arc's shape
put it — but a quest reward may weigh no more than what the quest takes in, a kill takes in nothing,
and Greyford has no shop or bank, so a full pack would strand the turn-in a zone's walk from
anywhere to make room. Coal as a link of the chain, which would hold the fen and the barrow back
from anybody without mining 6. A level gate on quests, which is a new field for what the objective
already gates. And every quest from one of the two, which would leave the other with nothing to
say.

## 69. A giver's quests are drawn by the counter shell, and the opening names the person

**2026-09-26 · Claude**

`COUNTER_OPENED_EVENT` carries the `NpcId` behind the counter beside the role, and `OverlayHost`
draws that person's quests at the top of whichever counter panel it opens. No panel draws quests.

**Rejected:** the shop's panel keeping its quest section and the outfitter's and fettler's panels
each growing one, which is the hand-kept list phase 2 removed from the HUD's redraws — the next
giver's panel is the one that forgets; and finding the person from the role through `NPCS`, which
holds only while no two people share a role.

## 70. Bosses may drop arrows, the quiver fills itself best-first, agility does both, and phase 12 splits

**2026-09-26 · the user, asked by Claude**

The questions the ranger still had open after decisions 64 and 65:

- **A boss is not left out of "every humanoid drops arrows."** A boss may drop arrows, and when it
  does they are its own — a ranger boss with a fine bow might drop fine arrows beside it — so boss
  drops stay unique and `uniqueLoot.test.ts` holds unchanged. A boss does not have to drop any.
- **The quiver refills itself from the bag, best arrow first.** When it runs dry it fills with the
  highest-ranked arrow the bag holds, by the arrow's own damage, whatever type it held before. An
  arrow picked up of the type already in the quiver goes into the quiver rather than the bag.
- **Agility is both** the ranger's damage stat and a source of physical crit chance, as decision 65
  was read; not crit instead of damage.
- **Phase 12 splits in two**: 12 is the ranger, and 13 is fletching and willow.

**Rejected:** leaving bosses out of the arrow rule, which Claude recommended — it would have ruled
out a boss whose trophy is a bow and the arrows for it; a quiver the player has to load by hand; a
refill that takes only the type the quiver last held, falling back to fists with other arrows in the
bag; agility as crit alone; and the ranger and the making chain as one phase.

## 71. A bow decides its own stat, and a bow with nothing nocked is a pair of fists

**2026-09-26 · Claude**

A shot's attack is agility, the bow's bonus and the arrow's, whoever draws it
(`computeEffectiveStats`, which now takes the arrow the next shot nocks). Every other weapon still
swings with its holder's class stat. With no arrow to nock — none in the quiver or the bag, or no
quiver worn at all — the bow is fists: the class's own stat, a fist's reach, archery untrained and
fists trained, and neither the bow's bonus nor an arrow's on the punch. The character sheet says
which stat ATK is built on from the weapon rather than the class.

**Rejected:** attack always built on the class's stat, which made a warrior's bow the best weapon in
the game for the class it suits worst — full strength at a wand's reach; a warrior forbidden a bow,
which decision 65 ruled out; a bow that shoots nothing and refuses to swing, which decision 64 ruled
out; and arrows drawn straight from the bag when no quiver is worn, which is the "arrows carried in
the bag and spent from the stack" that 64 rejected.

**Why:** "it should not be a good idea" had to come out of the numbers, because nothing in the game
forbids anything by warning. Making the weapon choose the stat is new, but only a bow does it, so no
existing class moves: a warrior drawing a bow shoots with one point of agility, which
`EnemySystem.test.ts` holds as losing to the rat his sword beats.

## 72. Agility's crit sits on top of the weapon skill's, and everything but a spell is physical

**2026-09-26 · Claude**

Agility adds half a percent of crit a point to a physical hit, capped at 15% on its own and added to
the weapon skill's 20% rather than inside it (`agilityCritChance`). Physical is every swing and every
shot — a wand's included — and every ability that is not governed by Destruction; a spell leaves
agility out (`isSpell`).

**Rejected:** agility's share under the skill's 20% ceiling, which would make it worth nothing at the
top of the game for the class whose stat it is, and would move the skill's budget — derived so the
average at cap is unchanged — out from under it; and a wand's auto-attack counted as magic, which is
an exception written for a class whose agility is one point.

**Why:** decision 70 said agility is both the ranger's damage and a source of crit, and the one open
question was where the ceiling sits. A warrior's or a wizard's single point is half a percent, which
is the whole of what agility does for anyone not drawing a bow — so "physical" needed a definition,
not a list of exceptions.

## 73. A bow takes both hands, the quiver is half the weapon, and the arrows move with it

**2026-09-26 · Claude**

Drawing a bow puts a shield or an orb in the bag, and taking up a shield or an orb puts the bow there;
a quiver is the one thing a bow allows beside it. A quiver has no armour type, so anybody may wear one,
the way anybody may hold the bow. Taking a quiver off puts its arrows in the bag, and a pack that
cannot hold them refuses the whole change; swapping quivers carries the arrows over and spills what
the smaller one cannot hold into the bag. A quiver is refilled from the bag, best arrow first, on the
shot that finds it dry and again on the shot that empties it, and when it is put on dry — so it is only
ever empty when there is nothing to fill it with — and an arrow picked up goes into it first: its own
kind up to the room left, or any kind into an empty one.

**Rejected:** refusing the equip in either direction, which is a panel saying no to something the
player plainly asked for; leather as the quiver's type, which would forbid a wizard the quiver while
allowing the bow; a refill only on the shot that finds the quiver dry, which leaves the bar in the
corner saying "empty" with arrows in the bag; and a quiver that takes only the kind it last held,
which with nothing in it holds no kind at all.

**Why:** decisions 64 and 70 settled what the quiver is and that it refills best-first. What was left
was every door arrows come and go through, and each one is a rule in `CharacterController` so none of
them can be half-applied.

## 74. An offline camp at a bow stops fighting when its arrows run out

**2026-09-26 · Claude**

`resolveOfflineAfk` charges each kill the shots it takes at the attack the first nocked arrow gives —
no crits, no training, the pessimistic way — counts arrows picked up off each body as arrows for the
next, and stops the night the first time there are not enough for a kill. The report says how many
were shot and whether they ran out; the caller spends them off the quiver and then the bag, after the
drops are in. A bow parked with nothing to shoot earns nothing, and the away report still says why.

**Rejected:** pricing the kills after the arrows run out as fist kills, which is what the handoff
offered first. Offline pays a kill a minute whatever is in hand, so a fist kill would be paid exactly
as a bow kill that spends nothing — the bow that never runs out, by another name.

**Why:** the awake camp needs nothing new: it swings through `CombatDirector` like anyone, so it
spends arrows and turns to its fists on the same frame a player would. Offline has no fight to model,
so stopping is the one answer that keeps a night's pay tied to what was carried into it.

## 75. Arrows are a fourth item kind, sold by the bundle, and carried by the handful

**2026-09-26 · Claude**

`ammunition` joins `equipment`, `material` and `consumable`, carrying the arrow's own damage. One kind
exists this phase, crude arrows at a tenth of a point each; the shop sells twenty-five for 30c with no
gate (`ShopStockEntry.quantity`), and every humanoid that is not a boss drops a handful at even odds
(`LootTableEntry.quantity`, rising with the band). The chief and the king each drop a bow as their
third weapon, one a class, and no arrows. The ranger reforges into agility off armour (`nimble`, the
ranger's `arcane`).

**Rejected:** arrows as a material with a damage field, which would have put a number on a row that
every other material has no use for and reached nothing the compiler could find; a shop that sells
them one at a time; a price set by eye — `progression.test.ts` holds the starter arc's arrows, priced
at level 1, to well under half the coin the arc pays; and arrows on a boss's table, which decision 70
allows but nothing here needed.

**Why:** a kind is a compile error at every switch over `kind`, which is how the bag, the inspect card
and the sell price were told there is a fourth. The price had to be argued against something, and the
arc is the only stretch of the game whose coin and kills are both simulated.

## 76. Willow is the steel arrow's shaft, and each made arrow doubles the one below it

**2026-09-26 · Claude**

Willow grows on the millpond's bank at woodcutting 8 and is cut into willow shafts at fletching 6,
and those are the only shafts a steel head is fitted to. An arrow is shafts and heads, fifteen of
each: iron arrows are a log's shafts and an iron bar's heads, steel arrows a willow's shafts and a
steel bar's heads. A crude arrow adds 1 to a shot, an iron one 2 and a steel one 4, which is still no
more than the chief's bow adds.

**Rejected:** a willow bow, fletched at the bench — it would be the first made weapon in the game,
wants a bowstring the game has no material for, and where a made bow sits against the chief's and
the king's is a decision of its own rather than a use for a tree; a willow bow _and_ willow shafts,
for the same reason; willow as a second log for any shaft, which makes it a faster tree rather than
a material; and a step of one per tier (1, 2, 3), which left a steel arrow at a steel bar per fifteen
worth a few percent of a level 8 ranger's shot.

**Why:** the handoff left "what willow is for" as the tier to design. Fletching is the ammunition
skill (decision 64), and a steel arrow fitted on willow is where three zones meet — the millpond,
the quarry's iron and the Deep Cut's coal — which is the argument every made tier here has been
built on. Doubling is what makes the dearest arrow in the game worth its bar; capping it at the
chief's bow is what keeps the bow the weapon and the arrow what it spends.

## 77. The arrow line makes fifteen a job, and its halves have no price

**2026-09-26 · Claude**

`CraftingRecipe.outputQuantity` is how many one job makes, one when absent. The six arrow-line rows
make fifteen: shafts from a log or a willow, heads from an iron or a steel bar at the forge, and
arrows from fifteen of each. A mastery pool that pays doubles the batch rather than adding one. The
shafts and heads cannot be sold; the made arrows sell a little over the log and the bar behind them.

**Rejected:** one a job, which makes a full quiver fifty jobs at the bench; ten, which with a steel
bar per batch made steel arrows too dear to shoot; a copper a shaft or a head, which turns a
three-copper log into fifteen and the forge into a mint; and a mastery roll that paid a sixteenth
shaft, a reward nobody could see.

**Why:** decision 64 said several from one log and one bar, and fifteen is what makes the
arithmetic of a quiver work. The halves have no price for the reason the key has none: whatever
number went on them would be a trade better than anything the game pays for honest work.

## 78. A camp may put arrows together, because a camp settles to any row it can supply

**2026-09-26 · Claude**

A camp at the bench works whichever row it can supply that pays best (`bestCraftInReach`), arrows
from shafts and heads included. Nothing restricts a camp to a row taking one of one thing.

**Rejected:** holding arrow assembly back from the camp as hands-on work, which the handoff offered
as the property to choose.

**Why:** the handoff and the plan both said a camp could only settle to a one-of-one recipe
(`findCraftableFrom`), and the plan shaped the bench around it. That was never true: the awake camp
asks `canCraft` of every row at a station in reach and the offline payout asks `hasInputs`, so a
steel helmet was already campable. `findCraftableFrom` is the fire's alone, where the bag is the
menu. The comments and a tannery test that repeated the claim are corrected. Choosing to forbid it
now would be a rule for the bench alone, against every other station's behaviour.

## 79. What comes off a station goes through the quiver, and is never refused

**2026-09-26 · Claude**

A finished craft is handed over by `CharacterController.addMadeItem`: an arrow goes into the quiver
first, as far as the quiver has room for, and the rest into the bag, without asking the pack.

**Rejected:** `tryAddItem`, which would refuse a job's output on a full pack after its inputs were
spent; and `addItem` straight into the bag, which is what every craft did and which skips the rule
that an arrived arrow is quivered first (decision 73).

**Why:** a bench spends before it hands back, so it has always been the one acquisition a full pack
cannot refuse (the offline payout says so too). Arrows made it the first one that also has somewhere
to go before the bag.

## 80. Version 2 is a solo game; the multiplayer vision is dropped

**2026-09-27 · the user**

The game is a solo zero-to-hero from here: power up, beat bigger things, collect. More fun and less
grindy than it has been, and still a time sink. `docs/initial_design.txt`'s multiplayer is no longer
the direction, and nothing is built as groundwork for it.

**Rejected:** keeping multiplayer as the long-term vision, which `CLAUDE.md` told every session not
to assume and every system was still shaped around not ruling out.

## 81. The game goes 2D, top-down 3/4, in pixel art Claude draws as data

**2026-09-27 · the user, asked by Claude**

The renderer changes from Three.js 3D to 2D, viewed top-down at 3/4 (Link to the Past, Stardew,
classic RuneScape). Its detail comes from pixel art that Claude authors as data in code: pixel grids
with palette keys, compiled to texture atlases at boot. This reverses `docs/archive/3d_port_plan.md`
and the half of decision 54 that kept art out of the game. It keeps the other half: the game still
loads no image or model files, so what the GPU holds is still only what the game builds.

**Rejected:** 2D sprites from free asset packs, which Claude recommended as the biggest jump in
detail for the least art skill; 3D models from packs; AI images generated in an image tool, by the
user or anyone else; staying procedural; isometric and side-on views.

**The risk, named when it was chosen:** hand-placed pixels suit tiles, items and icons better than
characters and animation. The plan's phase B2 is a checkpoint, with one zone and one character
judged before anything else is converted, so that if it does not hold up the art source is
re-decided there.

## 82. Old saves retire when the rebuilt world lands

**2026-09-27 · the user, asked by Claude**

Version 2 is a fresh start. When the plan's phase C1 rebuilds the world at a new size,
`CHARACTER_STATE_VERSION` jumps with no migration from before, and every older save is dropped.
Before C1 and after it, migrations work as usual.

**Rejected:** migrating every character into the rebuilt world, which Claude recommended; a fresh
start that leaves the new character a keepsake from the old.

## 83. Production shows version 2 as it is built

**2026-09-27 · the user, asked by Claude**

Each phase goes live as it merges, half-converted or not. The one exception is the art checkpoint
(B2), reachable by a URL flag for the one phase it takes to judge it, so the live game is never
drawn by a renderer that can only draw one zone.

**Rejected:** building the 2D renderer behind a switch until it covered everything, which Claude
recommended; a long-lived release branch with preview deploys.

## 84. The cap goes to 20, with a specialisation at 10

**2026-09-27 · the user, asked by Claude**

Version 2 raises the level cap from 8 to 20. At level 10 each class chooses one of two paths, each
with its own abilities and ranks; the bar stays four buttons. How many zones and bands 9-20 takes is
sized after the rebuilt zones have shown how long one takes to make.

**Rejected:** a cap of 15; sizing the cap after the overhaul; more ranks of the same abilities; a
bar that grows to six.

## 85. Camp becomes Idle, and idle and active each feed the other

**2026-09-27 · the user, asked by Claude**

What the game called camping is **Idle** to the player. Time idle or away banks a **rested** bonus
that speeds up active XP, and potions brewed in active play **boost idle gains**, so each mode has a
reason the other does not.

**Rejected:** Autopilot, Rest or Settle, and keeping "camp" with an explanation; boosts in one
direction only (potions for idle, or rested for active).

## 86. A bigger world to explore, and a skills book that hides nothing

**2026-09-27 · the user, asked by Claude**

Zones grow to about three times the area (roughly 45×32 tiles, from 25×19), with a minimap.
Creatures path around walls and obstacles, reversing decision 26. The skills book shows every recipe, locked ones greyed with
their level, inputs, result and stats.

**Rejected:** zones six times the area, and sizes that vary by zone; showing only the next few
recipes, or only the ones learned.

## 87. The realm has people, a history and a tone

**2026-09-27 · the user, asked by Claude**

- **Dialog moves faction reputation.** Choices and deeds raise or lower standing with factions, and
  standing opens stock, quests, dialog and titles.
- **"Whispers of the Realm" is one journal** of rumours (leads to secrets, caches, rare creatures,
  side quests) and lore (what following them teaches).
- **The helper is a spirit that floats beside the player and is a character**, with a name and a
  story, not only a source of tips.
- **The tone is all of it, blended the way RuneScape blends it.** In the user's words: magical
  creatures "should feel magical when we encounter" them, and "elves, dwarves etc." should "still be
  present in the world"; the humour is "cheeky … but not too much and not constant"; and there
  "should [be] some real stakes/grounded stuff".

**Rejected:** dialog as flavour and leads only, which Claude recommended, and dialog with a few
branching outcomes; a rumour log alone, a lore codex alone, or dialog with no collection; a helper
that lives only in the HUD, or one that floats beside you without a story; any one tone on its own.

## 88. A house that grows, a collection log, and a save you can take with you

**2026-09-27 · the user, asked by Claude**

The player gets a house in town to walk into, display trophies from quests, achievements and
bosses, and grow by buying upgrades. A collection log and bestiary count what has been slain, seen,
found and earned, and feed what the house displays. The save can be exported to a file and imported
back.

**Rejected:** a house that is only a place, with no upgrades; a trophy page in a menu rather than a
place.

## 89. Numbers carry a unit, every slayer rank is a title, and mastery joins the skills book

**2026-09-28 · the user, asked by Claude**

Three forks settled at the start of version 2's phase A1:

- **Every number says what it counts, in a word or two**: `Lv 3 · 40 / 96 XP`, `Weight 12 / 88`,
  `Coins 1s 20c`, stats named in full rather than abbreviated. The user's brief was "not handholdy,
  but not obscure".
- **Every rank of a slayer chain is a title to wear** (Rat Culler at 25, Rat Hunter at 50, Rat Slayer
  at 100), not only the last. The user's words: "when title is unlocked we should be able to set any
  tier not just highest".
- **Mastery folds into the skills book** that phase A5 builds, beside the recipe or node each pool
  belongs to, and its own page goes. A1 explains it on the page it has now; A5 moves the explanation.

**Rejected:** labels spelled out in full ("40 of 96 XP to level 4"), which are clearest on a first
read and wordier on every read after; keeping the terse labels with a tap-to-explain, which a player
has to know to tap; titles at the top rank only, with a clearer picker; mastery keeping a page of
its own, or both a page and a place in the book.

## 90. An item says what it is for on a tap, and any row that shows one opens its card

**2026-09-28 · the user, asked by Claude**

Three forks settled at the start of version 2's phase A2:

- **The bag's strip lists every use on the tap that selects an item**, the lines the card prints,
  derived from every table that names the item. Rat meat away from a fire had said "(nothing to do
  with this)", which read as junk; the strip is what a player sees without knowing any gesture.
- **Every row that stands for an item opens its card** on a right click or a held finger: the
  shop, the bank, a station's recipes, the slot picker, the outfitter, the fettler, a worn gear
  slot, a creature's drops and a loot pile's heap. What a Reforging Stone is for is worth knowing
  before it is bought.
- **Food's line says "Camping eats this"** while the tab is still called Camp, and phase A7's
  rename of every "camp" string carries it to Idle.

Claude's, alongside them: a quest handed in drops off the card, since it wants nothing any more,
where a contract stays because it is posted again; and the card says what an item is for and what
it is made from but not what drops it or where it grows, which is the collection log's (phase F3).

**Rejected:** one line on the tap with an About button for the rest, which keeps the grid its room
and puts the full answer a tap further off; uses on the long-press card only, which a player has
to know to ask for (the argument decision 89 made about numbers); the card from the bag alone,
leaving the shop and the counters to add it when they are rebuilt; "Idle" on the card before the
tab says it.

## 91. A counter that deals both ways shows two sides, and a contract says it comes back

**2026-09-28 · the user, asked by Claude**

Four forks settled at the start of version 2's phase A3:

- **The shop's stock and your bag are two sides, side by side where they fit and one over the
  other where they do not.** Each is framed and scrolls on its own, so a portrait phone sees the
  bag without scrolling past the whole shelf, and a landscape phone, short of height, gets two
  full-height lists across it. The bank is the shop's twin and does the same with the vault.
- **Repeatable is said as the rule already stands**: every contract is posted again the moment it
  is paid, as often as you like, one at a time. The board says so once at its top and every
  contract wears a Repeatable tag, on the board and in the quest log, where a quest that does not
  come back stands beside it.
- **Abandon is its own button under the contract in hand**, across the panel and a clear gap
  below the row that hands the work in, rather than squeezed beside it.
- **It asks twice by a second tap** ("Tap again to abandon"), the pattern Reset Character already
  used, and stays armed through a redraw of the same contract.

Claude's, alongside them: the board is titled **Contracts**, the one place it was still called
"Bounties"; a bag stack's price says "each"; and every counter stops above the tab bar and scrolls,
where a long list had run down over the bar and taken its taps.

**Rejected:** Buy and Sell tabs, one side at a time, which keep rows full width and hide the bag
while the stock is read; two narrow columns even on a portrait phone; a count of how many times a
contract has been paid, which would be a fourth stored tally for a number nothing yet reads; a
daily reset per contract, a balance change with a timestamp to store and migrate; giving a
contract back from the quest log rather than the board; a confirmation box rather than a second
tap.

## 92. A tap on a person talks first, and the conversation holds their quests

**2026-09-28 · the user, asked by Claude**

Four forks settled at the start of version 2's phase A4:

- **A tap on a person walks up and opens a talk panel**, hanging where the counters hang: their
  name, their greeting, a button for the counter they work with a line saying what it is for, and
  the work they have going. The button puts their counter up in its place, and every counter's
  head gains a **Back** to the conversation. Part D's dialog goes in this panel.
- **A person's quests are in the conversation and on none of their counters.** This reverses the
  half of decision 69 that had `OverlayHost` draw them at the top of every counter panel; the
  other half, that the opening names the person, is what the talk panel is drawn from.
- **Every visit talks first.** A right click or a held finger on a person offers **Talk** and their
  counter, and the counter there goes straight to it — the same walk a tap makes, ending at a
  different panel. RuneScape's Talk-to on a click and Bank on a right click.
- **A greeting is one line, naming no place and no person**, since the lore bible (C2) has named
  nobody yet and D1 rewrites every line in its voice.

Claude's, alongside them: talking is a seventh counter rather than a new kind of thing — a
`CounterId` of `'talk'` beside the six roles, a `TalkSession` behind it, the same pair of events and
the same panel slot — so walking off, one open at a time, a zone change, a death and a camp all shut
it with no line written for it, and the quest desk's "who is the player standing at" answers for it.
The menu line for the board says **Contracts**, the last place it still said Bounties. The merchant's
button stays **Shop** and the outfitter's **Trade**, the distinction the counters already drew
between coin and barter. And the release after a held finger is swallowed on the window rather than
on the row, because a card opened by the press can be what is under the finger when it lifts; a
shop row that no longer sat under the card's box opened it and closed it again.

**Rejected:** a menu at the tap (Talk, Shop, Quests) before walking, which is the held finger's job;
the counter with a greeting over it, which leaves no panel for Part D to fill; quests behind a
Quests button of their own, a tap further off; quests in both places, drawn twice; skipping the
conversation for someone with one thing to do, or after the first visit of a session, which makes
the same tap mean two things; each person named now for C2 to adopt; a few greetings rotated per
visit.

## 93. The skills book opens on an index, is reached from the character sheet too, and says where

**2026-09-28 · the user, asked by Claude**

Four forks settled at the start of version 2's phase A5:

- **Skills takes Mastery's seat in the menu, and a skill's row on the character sheet opens the
  book at that skill's page.** The character sheet keeps its skill rows as the summary it was, and
  each is a button now. The mastery page goes, as decision 89 said it would.
- **The book opens on an index, and a tap turns to a page** whose head has a Back to the index. The
  menu and its key open the index; the character sheet opens a page.
- **The six combat skills get pages** with no list under them: how each is trained, and what it
  buys at the character's level and at the most there is — damage and a critical chance for a
  weapon skill, the chance to turn a hit aside for Block and Parry, and a spell's fizzle as well
  for Destruction.
- **The book says where**: a node row names the zones that spawn it ("Found in: Blackwater Fen"),
  and a making skill's page names its station and the zone it stands in ("Worked at the Forge
  (Town)"), the way an item's card already names a station.

Claude's, alongside them: everything on a page is derived (`systems/SkillBookSystem.ts`), what a
level buys from the functions the rolls call, which are exported for it rather than copied; a
locked row draws no mastery, since a level is never lost and nothing out of reach can have started
a pool; what mastery is and what its ranks pay is said once over a page's rows, where the rows it
explains are; a row is titled with the job's name, as the station's list and the mastery toast
title it ("Raw Fish", with "Raw Fish → Cooked Fish" under it); and a row's stats are the short line
every other item row prints, with the full card a held finger away, as on every other row.

**Rejected:** the book in the menu with the skill rows taken off the character sheet; the book
inside the character sheet with no menu seat; a strip of skill chips across the top of one page at
a time, thirteen of them scrolling sideways on a phone; every skill on one long scroll; pages for
gathering and making only; leaving where a node grows to exploration and the collection log (F3).

## 94. The training bar hangs in the player column, follows what the player does, and fades

**2026-09-28 · the user, asked by Claude**

Four forks settled at the start of version 2's phase A6:

- **The skill last trained is one more bar in the player column**, under the XP bar, with its
  numbers inside it: `Woodcutting Lv 3 · 40 / 96 XP`. It is in the same place on every screen,
  which answered the plan's question about a landscape phone: there it costs the column one bar's
  height, as mana and arrows do.
- **It follows what the player does**: a gather, a make, and the weapon or spell skill a swing or a
  cast trains. Block and Parry, which train when something is swung at the player, never take it,
  since a fight would flip it between them and the weapon every few seconds.
- **It fades half a minute after the last XP into its skill**, and comes back whole on the next. A
  save keeps nothing up.
- **A tap on it opens the skills book at that skill's page**, as that skill's row on the character
  sheet does.

Claude's, alongside them: the fade runs on a timer of the HUD's own, as a held finger's does, rather
than on game time the world would have to publish, so smoke does not wait for it and the checks that
compare the column's height across a stretch of play measure it with the bar taken off; the bar is
not saved, so a reload starts without it until the next gain; its fill is a teal of its own, since
it touches the XP bar's blue; where the longest name meets the largest XP the name gives way to an
ellipsis before the level and XP do; the button is the bar and the gap above it, so a thumb has more
than the bar's own height to land on; and on a landscape phone, where the tallest column (a wizard
wearing a quiver, titled, buffed and training) reaches the quest tracker's two lines, the tracker
steps right of the column. That collision was already 3px deep on a 375px-tall screen before the bar
added its height.

**Rejected:** the bar bottom right, opposite the ability buttons, which a portrait phone with four
abilities leaves about 130px for; the bar under the player, beneath the gather bar; every skill,
Block and Parry included; gathering and making only; a bar that stays until another skill takes it,
which Claude recommended; a bar that only shows and does nothing on a tap.

## 95. CI runs on pull requests, on one Node version, smoke when ready, and only main deploys

**2026-09-29 · the user, asked by Claude**

The repo is private, so GitHub Actions minutes are metered: 2,000 Linux minutes a month on the free
plan. September had used about 600 by the 29th, 430 of them in the five days since version 2
began, a pace of about 2,500 a month. A pull request's run cost about 13 minutes (two gate jobs of
about 3 and the browser smoke of about 7, each rounded up to the minute) and every merge about 6
more. Vercel's Hobby plan allows 100 deployments a day, and it had built a preview of every push to
every branch. Four forks:

- **Only `main` deploys** (`vercel.json`, `git.deploymentEnabled`). A branch builds no preview;
  production already shows the work as it lands (decision 83).
- **CI does not run on the merge**, which tested again the head the pull request had just passed.
  It runs on pull requests, and by hand from the Actions tab.
- **The gates run on Node 25 alone.** The cloud sessions run every gate on Node 22 before they
  push, so both versions are still seen on every change.
- **A draft skips the browser smoke**, and marking it ready for review runs it. A draft cannot be
  merged, so the check that blocks merges still runs on whatever is merged.

Claude's, alongside them: every job has a timeout (10 minutes for the gates, 20 for smoke), since
GitHub's default of six hours let one hung smoke run spend a sixth of the month; the gates stay a
matrix of one, so the check keeps the name a required status check knows it by; and `CLAUDE.md`
asks for a phase to be pushed once it is green locally rather than commit by commit, and for a CI
fix to be batched rather than guessed at a push at a time. A pull request opened ready now costs
about 10 minutes, and each push to a draft about 3.

**Rejected:** previews on request from `preview/…` branches; previews on every push, as before;
keeping the run on merge; both Node versions, or 22 alone; smoke on every push to a pull request,
which Claude recommended; smoke only when a label asks for it. Also not done: skipping CI for a
change that touches only docs, since a required check that never reports holds its pull request
open for good.

## 96. The idle panel says what idle will do, starts and stops it, and holds the food the player orders

**2026-09-29 · the user, asked by Claude**

Two forks settled at the start of version 2's phase A7, the first of them the question Part A had
left open:

- **The player sets what idle eats**: an order, moved a place at a time, and a **Keep** mark on any
  food idle must leave alone. It is stored on the character (`CharacterState.idleFood`, version 25)
  and starts empty, which is the rule idle always ate by: weakest first, everything fair game. Keep
  is what an order alone cannot say, "never", short of banking the food.
- **The Idle tab opens a panel, and the panel's button starts and stops idle.** Before idle starts
  it says what idle will do; while it runs, the lit tab opens the same panel saying what it is
  doing, with Stop. Moving, or tapping anything in the world, still stops it at once.

Claude's, alongside them:

- **The panel is a sheet on the bar**, so the tab changed from an action to a sheet; its key opens it
  like any sheet's, and nothing on the keyboard starts idle any more. Start puts the panel away, since
  the character it set going is what the player wants to see, and the lit tab says idle is on; Stop
  leaves it open. The HUD asks for idle on or off by name (`afk-set-requested`) rather than for a
  toggle, so a panel drawn a moment stale cannot flip the wrong way.
- **What the panel says is derived** (`systems/IdlePlanSystem.ts`) in the HUD from what its model
  already held, with the zone seeded from the save. It reads the job off `afkCampJob`, and what a
  closed game pays for off **`offlineJob`, which the payout now runs on too**, so the panel cannot
  promise a night the morning will not honour. It says honestly where the two differ: a tool with no
  work in the zone fights while the game is open and earns nothing with it closed, and a campfire
  goes out.
- **A move swaps a food with its neighbour in the bag**, and the first move places every food in the
  game, so a food not in the bag keeps its place for when it is again; a food the game adds later
  goes last, where it is kept longest.
- **The away report speaks the panel's words**: it names the creature a night fought, says "the most
  that counts" at eight hours, and says "Stopped at the most a night pays: half a level" (or one level
  of the skill) when the ceiling ended it, off a new `capped` on the report.
- Every player-facing "camp" is Idle: the tab, its toasts, the log's "You settle in to fight", the
  away report, and the item card's food line, which now says where the order is set ("Idle eats this
  when hurt, in the order set on the Idle tab"). The code keeps its AFK and camp names where they
  were; what is new says idle.

**Rejected:** weakest first, said plainly, with nothing to set, which Claude recommended and phase E3
would have revisited with potions; an order with no Keep; Keep with no order; the panel only the
first time, with the tab starting and stopping idle after that, which makes the same tap mean two
things; the panel to start and a tap on the lit tab to stop, which leaves nowhere to read what idle is
doing while it runs.

## 97. The save leaves as a file or a code, comes back in Options or at creation, and shows who it replaces

**2026-09-29 · the user, asked by Claude**

Four forks settled at the start of version 2's phase A8:

- **Export and import are in Options, and the creation screen offers import too.** Options is where
  Reset Character already was, the other thing about the character as a whole; a new phone or
  browser opens on the creation screen, and a player moving devices should not have to make a
  character only to replace it.
- **Loading shows a preview and asks twice**: the character in the save beside the one playing now
  (name, class, level, zone, and when the save was made), then Replace, which arms on the first tap
  the way Reset Character does. On the creation screen nobody is playing, so one tap loads.
- **A save travels as a file and as a code.** The file is a download; the code is the idle-game
  convention, text to paste through a message or a note, which moves a save from a phone to a
  desktop without a file changing hands.
- **The save is readable, editable JSON.** Loading checks that it is well formed, every field of the
  right kind and every id one the game can look up, so a bad file cannot break the game; a
  hand-edited level or purse loads. It is a solo game, and a checksum stops nobody who reads the
  source.

Claude's, alongside them:

- **The code is base64 of the file's JSON**, not the JSON itself: notes and messages curl straight
  quotes and wrap long lines, and base64 has neither to lose. The paste box reads a file's JSON as
  well, and a wrapped code.
- **The file names the game, the character, their level and the day**, and is indented, since a
  file is the form somebody might open. Both forms carry `{ game, character }`, so a stray JSON file
  is "not a save from this game" rather than "damaged".
- **A refusal says which field is wrong** ("classId should be a class (warrior, wizard, ranger)"), for
  whoever edited it. **Item ids and the keys of the kill, visit and mastery tallies are not checked**,
  because the game already reads past a retired item and an honest save can hold one; refusing
  them would turn away real saves. Ids the game looks up and would break on (class, zone, ability,
  quest, contract, title, reforge) are.
- **A parked night is never carried in**: the same file can be loaded any number of times, and each
  would pay that night again.
- **The session writes the save and the HUD does what a page does with it.** `GameContext` answers the
  ask on the same call stack, having persisted first so the file and the browser agree, because a
  browser grants the clipboard and a download only inside the tap that asked. The host loads a new
  character by ending the session before saving the new one, so the one leaving cannot write itself
  back over it.
- **A code is shown as well as copied**, since the clipboard is refused over plain http, which is how
  a phone reaches the dev server; and Options now scrolls, and stops above the tab bar, since a
  landscape phone is shorter than its list.

**Rejected:** import in Options only; a second tap with no preview; a file alone, as decision 88
first put it; a checksum that refuses an edited save; a code of raw JSON; a code compressed before
encoding, which is asynchronous in a browser for a save of a few kilobytes; checking item ids, which
would refuse saves the game plays happily; carrying a parked night in.

## 98. A tip is a card that waits for a tap, heard once per character, in the spirit's voice

**2026-09-29 · the user, asked by Claude**

The forks settled at the start of version 2's phase A9, the tips:

- **A tip is a card**, under the top corners, with the spirit's line and two buttons, **Got it** and
  **No more tips**. It stays until tapped, so a tip that lands in a fight is not lost; it waits while
  a panel or a counter is open, and only one shows at a time.
- **What has been heard, and whether tips are off, is kept on the character**: it rides the save
  (and an exported save) and a new character hears the tips again. The spirit is a character in the
  story (decision 87), and what it has told you is part of that.
- **Beyond the plan's four** (raw food held, a full pack, the first contract, going idle), the tips
  cover **survival** (low health with food in the bag; the first death and what it cost),
  **gestures** (holding a finger, or a right click, on anything shows more), **growth** (the first
  level and the trainer, the first title and Feats, the first mastery rank and what it pays) and
  **making** (a first material and the station it goes to; a first tool and tapping a node).
- **A character from before A9 hears each tip as it comes**, one at a time with a gap between, rather
  than being marked as having heard them all.

**Rejected:** a long toast that fades on its own, and a card that fades if ignored, since either can
be missed mid-fight and a tip is heard once; keeping what was heard on the device, alone or with the
off switch; the plan's four tips alone; marking every tip heard for a save made before A9.

## 99. Part A's review mends five leftovers in place, tunes the grind after the rebuild, and keeps Part B next

**2026-09-29 · the user, asked by Claude**

Phase A10 walked what A1-A9 landed against the pillars and the user's first list, at a portrait
phone and a desktop through smoke's screenshots. Every item on the list had landed, and the two that
had not were never Part A's: the quarry's grey rectangle is art (B6), and potions are E2. What the
walk found instead was Part A's own promise kept in most places and not all of them. Three forks:

- **The leftovers are mended in A10, not left to B8 or H1**, all four the review named:
  - A creature's level says it is one ("Rat (Lv 1)") on its nameplate and the right-click menu, as the
    target frame already did, and **a locked row says what it needs** ("Needs A Feast of Crab",
    "Needs Level 2", "Needs Smithing 9") on the shelf, the talk panel, the board, the trainer and a
    station, as the skills book already did.
  - **Stats are named in full wherever an item is described** ("+3 Armour, +1 Health, +1 Strength"),
    which decision 89 promised and the character sheet's own stat block kept while the gear rows
    under it said ARM, HP and STR. **Armour gets a line on the character sheet**, with the share of a
    hit it stops: it was the largest number on most armour and added up to nothing a panel showed.
  - **A panel is called what its tab calls it**: Bag opens Bag, not Inventory (I), and Feats opens
    Feats, not Achievements. Reset Character arms as "Tap again to reset", naming the act as Abandon
    and Replace already did.
  - **A rank on the Feats sheet is one line**, its title on the left and "0 / 25 slain" whole on the
    right, where long names had split both into two ragged columns.
- **The grind is tuned in Part C, after the ten zones are rebuilt**, as a phase between the last
  rebuild and Part C's review. Pillar 3 promised curves tuned down before systems are added up, and no
  phase tuned one. Zones about three times the area put more walking between kills, so a curve tuned
  before them is tuned for distances about to change; the phase measures the arcs in minutes of play
  rather than in kills.
- **Part B comes next, as planned.** Its checkpoint (B2) is the plan's largest risk (decision 81), and
  it is worth learning early whether art drawn as data holds up.

Claude's, alongside them: the plan's rule that a phase past about 30 files is split and the split
recorded had been broken twice without a word (A4 at 40 files, A7 at 45), so it now asks for the
reason to be written into the phase's entry when a phase goes past it rather than for a split every
time; each of those fitted its session. And a boss keeps its three slayer ranks at 25, 50 and 100
kills, which the review noticed and left alone as content rather than clarity.

**Rejected:** leaving the leftovers to the HUD's restyle (B8) or the last pass (H1), which would
leave the live game unclear for the whole of Parts B and C; a grind pass now, before Part B, to be
tuned again after the rebuild; a grind pass with G1 across the whole climb to 20, and no pass at all;
the lore bible (C2) before Part B, which the art does not wait on; Part E before Part B, which puts
the checkpoint behind three more phases.

## 100. Tiles are 32 pixels, the world gets a pixel font, every creature faces four ways, and the palette is warm

**2026-09-29 · the user, asked by Claude**

The four forks settled at the start of version 2's phase B1, the style guide:

- **A tile is 32 pixels square.** Claude recommended 16, the size Link to the Past and Stardew use,
  because there are a quarter as many pixels to author per frame, and characters and animation were
  the risk decision 81 named. The user chose the detail: a face, armour trim and the ore in a vein
  can be told apart at 32, and the animation budget is what keeps the frame count from growing.
- **The HUD keeps a readable system font, and the world gets a pixel font drawn as data.** The HUD is
  HTML, dense with the numbers Part A labelled, and a pixel font there would have to be a font
  file. What the world writes (a nameplate, a damage number, a sign) is already baked onto a canvas,
  so a font drawn as data costs no file.
- **Every creature faces four ways**: up, down, left and right. Claude recommended two, side-on and
  mirrored, for the beasts, which would have halved their frames. The user chose the convincing one.
- **The palette is warm and bright**, saturated greens and warm light in the way of Stardew and Link
  to the Past, with the marsh and underground darker for their setting. It is the one that suits
  pillar 4 and a cheeky tone, and it reads at a glance on a small screen.

Claude's, alongside them, in writing the style guide (`docs/architecture/art.md`):

- **A colour is a step on a ramp of five, darkest first and hue-shifted**, and a sprite names a step,
  never a hex. **Only the ground changes with the setting**: terrain ramps are coloured per setting,
  and a person, a beast, an effect or an icon may use only the shared ones. The gear tiers' ramps
  are built round their `TIER_COLORS`, so the paperdoll and the world draw the same set.
- **The light is from the top-left, and nothing casts a shadow**: a contact shadow under anything
  standing, and underground a lantern round the player, as the 3D view had.
- **The compiler draws the outline**, one pixel, selective (step 0 of the ramp it touches) and
  four-sided, round people, beasts, props and icons, and not round tiles or effects.
- **The animation budget is exact, not a ceiling**: a walk is four frames for every walker, and the
  timing is the budget's. **Either side may be the other mirrored**, which is still four facings on
  screen, and a death is drawn once, being a body falling seen from above.
- **A capital in the world's font is at least nine art pixels tall, drawn at one art pixel**: that
  holds the nameplate's nine-pixel floor at the smallest scale a phone gets without putting two
  sizes of pixel on one screen.
- **Anything not yet drawn is its kind's placeholder**, and each placeholder fills every animation
  its budget allows, so the budget is held against real frames from the start.

**Rejected:** 16-pixel tiles; a pixel font everywhere, and a system font everywhere; two mirrored
directions for beasts; a muted, earthy palette in the way of classic RuneScape, and a strict retro
palette of about 32 colours shared by everything. Of Claude's: colours as free hexes checked against
a list; one palette per setting for everything, actors included; a light from the south-west, as the
3D sun was; a black outline, and an outline drawn by hand; a budget that caps frames rather than
fixing them; a world font drawn at two art pixels to its pixel.

## 101. The 2D renderer is Canvas 2D, drawing at art resolution into a canvas the page scales up

**2026-09-29 · Claude, by the spike the plan's phase B1 called for**

The same scene was drawn three ways and measured the way smoke measures the draw budget: a zone at
C1's size (45×32 tiles of 32 pixels), the terrain baked once and the water animated over it, 60 and
then 150 walking, fighting figures with a contact shadow and a nameplate each, ten effects, and the
underground's lantern, on a 390×844 portrait phone at one and at three device pixels to the point,
with the CPU throttled eight times. Each backend was handed the same list of rectangles a frame,
so only the drawing differed. Mean milliseconds in the call that draws, at 60 figures:

| At 8× throttle                    | Canvas 2D | PixiJS 8 | Three.js ortho |
| --------------------------------- | --------- | -------- | -------------- |
| Open, three device px (scale 4)   | 0.79      | 1.58     | 3.15           |
| Underground, three device px      | 0.74      | 2.19     | 3.72           |
| Open, one device px (scale 1)     | 0.94      | 2.38     | 3.25           |
| Underground, one device px        | 1.03      | 2.63     | 4.38           |
| Open, 150 figures, three px       | 1.51      | 2.22     | 3.52           |
| Open, three px, frame forced done | 4.81      | 14.62    | 12.78          |
| JavaScript it adds, gzipped       | 0.3 kB    | ~100 kB  | 127 kB         |

The last timed row forces each frame to finish with a one-pixel read, which counts the rasterising a
headless browser does in software. Canvas 2D was the cheapest by every measure, and the only one
whose frames kept a 60-a-second pace under the throttle; the 3D renderer's full smoke run reads 21 to
25ms against the 40ms ceiling. Headless Chromium has no GPU, so neither number is a phone; the
ordering held both ways, and on a phone both Canvas 2D and WebGL are drawn by the GPU.

- **Canvas 2D.** The game draws rectangles from a sheet, a few hundred a frame, in painter's order.
  Canvas 2D does exactly that with no dependency, and B7 then deletes Three.js outright rather than
  keeping 127 kB of a 3D engine to draw squares. What Three.js gave that 2D has to answer for itself:
  smoke's GPU memory check becomes a count of the canvases the view holds, a tint (a hit's flash) is
  a frame the compiler makes, and light is a stamp drawn over the scene, which is how the spike drew
  the lantern for a tenth of a millisecond. Picking was always the game's own boxes in a priority.
- **Drawn at art resolution, scaled by the page in whole device pixels** (`image-rendering:
pixelated`). A portrait phone at scale 4 is a 293×633 canvas, a fifteenth of the pixels a
  full-resolution one fills, which is most of why every backend was cheap; the whole number keeps
  every art pixel square. It means sprites move a whole art pixel at a time.

**Rejected:** Three.js with an orthographic camera, which kept renderer.info, disposal and the
existing host, and was the slowest of the three and the largest; PixiJS, a real 2D batcher, faster
than Three.js here and slower than Canvas 2D, for about 100 kB and a scene graph with its own
lifecycle to keep in step with the world's; drawing at device resolution, which scales pixel art by
fractions and fills fifteen times the pixels.

## 102. The checkpoint slice: edges are a rule, buildings are a kit, and the host stands apart from both renderers

**2026-09-29 · Claude, building the plan's phase B2**

B2 draws town in 2D behind `?renderer=2d` for the user to judge (decision 81's checkpoint). The
plan named what to draw; how to draw it had forks, all Claude's:

- **An edge between two grounds is a rule over the two tiles, not a set of pictures.** The upper
  ground reaches into the lower one's cell by a depth that wanders along the edge as a function of
  where it is in the whole map, so the tile on either side of a join asks the same question and a
  shore across four tiles is one line; a few rows either side of where it stops are inked from a
  table (`art/sprites/edges.ts`): the bank's earth face on a north shore, foam on a south one, a
  grass lip over a road. An edge is drawn inside the lower cell and never lays blocking ground
  over walkable ground (held by a test), so a player is stopped at the bank rather than in the
  water. It draws every pond and road the maps have from the tiles B1 drew, and B3's other pairs
  are a row each.
- **A building is put together from parts over its own footprint** (`art/building.ts`): a roof
  laid in courses, a front wall with the door where `doorGap` puts the collision's, windows where
  there is room, and from inside a plank floor ringed by the walls' tops with only the back wall
  standing. The three shapes are the one kit recoloured (slate halls, thatched cottages, shingled
  workshops), so every building in the game is drawn, not the one the plan asked for.
- **The camera follows the player to the map's edge, the player in the middle of the band above
  the tab bar**, rather than clamping to the map, which is what hid the south signpost under the
  bar the last time the game was 2D; the ground runs on past the map and fades into the haze, as
  the 3D apron does. The scale is the whole number decision 101 described.
- **The host moved out of `render3d/` into `src/host/`, behind a `ZoneView` interface** both views
  answer, rather than a second host beside the first. `main.ts` picks the view by the flag; the
  frame loop, the pointer, the HUD mount and the sound are written once.
- **`?renderer=2d` works in production**, which is what decision 83 said the checkpoint was for:
  judged on a phone, for the one phase it takes.
- **The shopkeeper is the warrior's figure dressed differently**: an amber tunic, grey hair, an
  apron and no sword. The warrior's sword is a part of its own, drawn over the body facing right
  and behind it facing left, so the left is the right's body flipped with the sword still in the
  right hand, as the style guide asks of anything held in one hand.
- **The world's font draws capitals nine pixels tall with small letters and tails**, outlined on
  four sides like a sprite, in the darkest step of `ink` whatever colour the word is.
- **A corpse lies for 300ms after its fall before it is gone.** The budget fixes the fall at three
  frames of 150ms, longer than the world's 400ms `DEATH_FADE_MS`, and the fall and its lying there
  are the view's to time; the world still respawns on its own clock.
- **The leak check counts canvases**, reported where `gpuMemory()` reported textures, since the
  2D view holds no geometry. B7 renames it.

What B2 leaves as placeholders, on purpose: every creature but the rat, every person but the
warrior and the shopkeeper, nodes, stations, signposts, loot piles, the campfire and effects, and
the underground's lantern; B3 to B6 are those.

**Rejected:** transition tiles drawn as twenty quarter-tile pictures per pair of grounds, as RPG
tile sets are; one building drawn whole at its own size; a camera clamped to the map; a second
host class beside the first; the flag honoured in development only; left-facing figures mirrored
with the sword moving to the other hand; a font of capitals only; the corpse gone at 400ms whatever
the fall's budget.

## 103. Version 2 is drawn heroic and weathered, not cute: epic adventure over a farm

**2026-09-29 · the user, judging B2's slice; Claude's under it**

The user's first look at the checkpoint (B2): the direction is right, but it is "a little too
cutesy" and "kind of farmvilley", where the game wants "the feeling of epic adventure". Draw from
World of Warcraft, The Lord of the Rings and fantasy like them. That keeps decision 81's art source
(pixel art drawn as data) and turns decision 100's "warm and bright" palette a long way down.

What Claude made of it, blending WoW's heroic chunkiness with the Lord of the Rings' weathered,
earthy ground:

- **The palette is deep and earthy, with the warmth kept for the light.** Forest greens and worn
  grey-brown earth in place of candy greens and orange dirt, a dark lake in place of a bright one;
  the marsh and underground are derived from the open ground so the three stay in order. Cloth is
  dyed rather than bright (a steel blue, a worn crimson, ochre), timber is dark oak, plaster is
  weathered, and a stone `masonry` ramp arrives for plinths and chimneys.
- **People stand to heroic proportions**: a head over a body three times its height, broad in the
  shoulder, about 39 pixels of the 48, where they were two and a bit heads to a 30-pixel toddler.
  The warrior wears a quilted gambeson in the class's blue, leather spaulders, bracers and tall
  boots, a stubbled jaw and a crimson cloak; the shopkeeper is a grey-bearded merchant in ochre.
- **The rat is a sewer rat, not a mouse**: lean and hunched, scruffy along the spine, small dark
  ears, red eyes and fangs.
- **Buildings are timber-framed on stone**: dark oak posts, a rail and braces over weathered
  plaster, a plinth of dressed stone, leaded windows lit from inside, slate split unevenly with moss
  on it, and a stone chimney. Walls stand taller, a head over the taller people.
- **The ground is textured and varied**: grass in clumps with blades, a road of grit, stones and
  ruts, and each tile dealt one of several variants by where it is, so a field is not one tile
  stamped over and over.
- **The scene has weight**: the map's edge fades into a dark murk rather than a pale sky, and a
  soft vignette darkens the screen's corners, drawn under the words so no name goes dark.

**Rejected:** re-deciding the art source, which the user did not ask for; a grimdark palette of
greys and browns, which loses what WoW's colour does for reading a scene at a glance; realistic
proportions of seven or eight heads, which leave a face two pixels wide at 32 to the tile.

## 104. A figure holds things in its hands, every class is drawn, armour is a lookbook, and a town says what it is

**2026-09-29 · the user, judging B2's revised slice; Claude's under it**

The user's second look at the checkpoint: the style is better, but **the weapons are held
incorrectly**. They asked to **try some different armours**, for **a wizard and a ranger mock-up**,
and, with the town still looking "silly" and to be made more like a town later, for **a way to make
it slightly more descript and easier to read**. So the style holds (decision 103 stands), and the
same phase takes one more pass.

What Claude made of it:

- **The arms are parts of their own, in poses, and each pose says where its hand is.** A sword was
  a part laid near a fist that never moved: from the side its blade hung out of the belt, and a
  wind-up raised the sword while the hand stayed at the hip. Now a thing held names the pixel its
  grip is and is laid at the hand, so it comes out of the fist in every frame by construction, and
  a test holds every hand in sight on a fist. The warrior carries the blade low and out, draws it
  back over the shoulder and brings it across.
- **The wizard and the ranger are drawn and played**, on the same figure, so choosing either class
  under `?renderer=2d` shows them rather than a mannequin. The wizard is hooded, in violet, with a
  **staff** taller than they are that flares as a spell leaves it. The game's wizard weapons are a
  wand and a scepter, and B4 draws each weapon by what is equipped, but at 40 pixels a wand reads as a
  dagger, where a robe, a hood and a staff read as a wizard across a field. The ranger is hooded in a
  forest green colder and darker than grass, so a hunter in a field is still a figure, over leather,
  with a quiver on the back and the bow in the left hand. A player's spell plays the wizard's
  `cast` and a shot the ranger's `shoot`; a figure that has not drawn one swings.
- **Armour is a lookbook, not yet worn.** Plate, studded leather and a robe under a pointed hat are
  each drawn once in the neutral `tier` ramp and recoloured into every tier of their kind (iron and
  steel, brown and studded and fenhide, brown and fenweave), for the user to judge before B4 wires a
  figure to what it has on by slot. They are held by the sprite tests and kept out of the atlas the
  game compiles.
- **The town says what each place is.** A doorway is two tiles of a three-tile front and was drawn
  as solid ink, which read as a hole in every shopfront; it is the room seen into now, a back wall of
  boards with a lantern and the floor coming forward into the light. A building somebody works in
  hangs its trade by the door (a sack, a coin, swords, a shield, an anvil, a tankard, a sheaf,
  scales). The front slope of a roof falls away from the ridge to the eave rather than lying a step
  dark all over, which read as paving. And **the signpost is drawn**, ahead of B6, because a crate
  where the exits are named said nothing.

**Rejected:** mirroring the left facing and moving the sword to the other hand, which decision 102
already turned down and which the arms-with-hands kit makes unnecessary; sheathing the sword out of
a fight, which needs an armed idle and walk the budget does not have; a wand for the wizard's
mock-up; wiring armour to what the player wears now, which is B4's layered figure (a whole-figure
sprite per class, armour kind and tier cannot mix a steel helm with studded legs); a door drawn
narrower than the collision's gap, which would put wall where a player walks through; and a
redesign of the town's layout, which the user put off.

## 105. A new character starts plain, the grand looks are armour worn later, and a figure is one silhouette

**2026-09-29 · the user, judging B2's third pass; Claude's under it**

The user's third look: the armour looks good, but **a new character's default outfit should not
look as cool** as the three classes had been drawn, and **those looks can be armour for later**.
The figures **seemed a little disjointed**, so take another pass at the adventurers to clean them
up. Asked whether the wizard should wear a hat or a hood: **both, as options**. B3 waits on this
(the user: answer the first point, then see).

What Claude made of it:

- **A class starts plain**: bare-headed, in a tunic or a robe of its colour, carrying what it
  fights with, which is what a character sheet with an empty helmet, chest and pants slot already
  said. The warrior's blue tunic and dark breeches, the wizard's plain violet robe tied with a cord
  and an apprentice's staff of bare wood, the ranger's green tunic with the quiver slung across it.
  Zero to hero (pillar 2) needs a zero to climb from, and a starting look that is already the best
  in the game has nowhere to go.
- **What they wore becomes the lookbook's later looks**: the gambeson, spaulders and cloak; the
  violet robe trimmed in brass under a hood, and under a pointed hat, with the crystal staff; the
  hood and mantle over a leather jerkin. Plate is worn over the gambeson and under the cloak;
  studded leather over a starting tunic, as the first armour a warrior buys. The robe comes in its
  tiers under a hat and under a hood, the hood and the cloth hat being headgear the game has.
- **The figure is one silhouette.** It read as a stack of blocks for three reasons, each mended: the
  torso was a straight box, and is a tunic narrowing to a belted waist with its skirt over the
  thighs; each arm stood off the body across a clear pixel the compiler outlined into a line, and
  now hangs against it, parted by its own inner edge a step darker; and light breeches cut a band
  between the coat and the boots, where dark ones now run into them. The armour was refitted to the
  new silhouette rather than laid over the old one.

**Rejected:** keeping the grand looks as the start and adding plainer ones nobody would wear;
choosing between the hat and the hood, which the user asked to keep both of; drawing each class
with its own face or hair, which nobody asked for and which B4's layered figure can offer as a
choice; and a thicker outline round the arms, which is the disjointed look itself.

## 106. Every ground is drawn, rock stands up inside its own cell, scatter is baked and outlined, and 2D is the game

**2026-09-30 · the user, starting B3; Claude's under it**

The plan had B3 waiting on the fourth pass of the checkpoint's figures (decision 105) holding up,
and the art source re-decided if it did not. The user answered by asking for B3, which closes
decision 81's checkpoint with the art source standing. B3 is every zone drawable, the lantern, water
and scatter, and 2D the default with 3D kept behind a flag. How to draw it had forks, all Claude's:

- **Every pair of grounds that meets in a zone has an edge**, nine new rows beside B2's two, and a
  test sweeps every zone for a pair without one. Sand under grass, the sea under a beach (foam, no
  face, since a beach slopes into the water), a quarry's floor under its turf, the mill pond under
  its yard, the fen under its sand and its pools under their mud, water under a cut stone kerb, and
  rock over a floor and over water.
- **Rock stands up inside its own cell.** A true 3/4 view would draw a rock's top a face's height
  north of its footprint, over the floor behind it; that lays blocking ground over walkable, which
  decision 102 ruled out, and hides where a player may walk. So the floor reaches into the rock's
  cell as every upper ground does, and the rock shows **a face** on its south side there, sixteen
  rows drawn from a tile of fractured rock rather than inked flat, its crest lit on the north and
  the floor at its foot a crevice of shadow. A face is a field of an edge style, so a kerb or a
  cliff later is a row.
- **The stone floor is irregular flagstones**, not a bond: the bond read as a brick wall laid flat.
  Its joints are a step up from black so the slabs do not shout, and sand, stone, rock and marsh get
  variants the way grass and road did, each holding its plain tile's two-pixel border (now a test).
- **Scatter is a sprite kind of its own, baked into the ground and outlined.** Tufts, flowers,
  reeds, pebbles and shells, placed by a hash of where they are, never in a cell another ground
  reaches into and never on a building's footprint. Baked, since it is ground and a frame then pays
  nothing for it. Outlined, which the style guide keeps for things rather than ground, because
  drawn in the same ramp as textured ground a tuft with no edge was not there at all.
- **The lantern is darkness stamped over the scene in dithered steps, with a warm glow added in
  the clear**, drawn over everything standing and under the words. It is never black (two thirds
  dark), so a creature at the edge of the screen is still a shape and its name reads, and the glow
  is what brings the underground palette's colour back where the player is.
- **2D is the default and 3D is `?renderer=3d`**, loaded only when asked for, until B7 deletes
  it. Every smoke section now runs in 2D; the checks that asked a drag to turn the camera ask it to
  turn nothing, and the ones only the turned camera can answer moved to a `renderer-3d` section. A
  word baked for the world is let go on the first frame that does not draw it, so the canvas count
  comes back when a fight is over, as the leak check needs.

**Rejected:** a rock's top overhanging the floor north of it; a face inked in flat rows, which read
as a stripe; scatter as more tile variants, which repeat with the tile; scatter standing and sorted
with the figures, which costs every frame for what a player walks over; scatter without an outline;
a smooth lantern gradient, which is not pixel art, and a lantern gone to black; keeping 3D the
default until B5 and B6 draw what is still a placeholder, which decision 83 already decided against;
deleting the 3D view now, which is B7's; and keeping smoke on the 3D view while the game is 2D.

## 107. A person is put together from what they chose and what they wear, a slot dyed apiece; the wands become staves

**2026-09-30 · the user on the wands and the look; Claude's under it**

B4 wires the figure kit (decision 104) to what the player has on. Two forks were the user's, asked
when the phase started:

- **The wizard's three weapons are staves, and are renamed to say so**: the Apprentice Staff, the
  Stolen Staff and the Barrow Staff, the weapon shape `staff` everywhere it is drawn (the bag's
  icon, the paperdoll, the 3D rig). B2 had drawn a staff because a wand at 40 pixels reads as a
  dagger, and B4 draws every weapon as the item it is, so the picture and the name had to agree.
  The item ids keep saying wand and scepter, since a save names them. **Rejected:** keeping the
  names and drawing staves, which Claude offered as the lesser change and which has the world and
  the bag naming different things; drawing them as wands.
- **A character is made in a look: a skin, a hair colour and a hairstyle**, each a choice on the
  creation screen and a field on the save (`CharacterState.look`, version 27). Four skins, five hair
  colours and five hairstyles (cropped, long, tied back, shaved, bearded); a character from before is
  migrated to fair, brown and cropped, which is how every character was drawn. **Rejected:** no look
  choice in B4, which Claude recommended as scope creep and which decision 105 had noted the layered
  figure could offer; colours alone, without hairstyles.

How to build it had forks, all Claude's:

- **A person is composed at the level of the grids and compiled as one sprite**, not stacked as
  layer sprites at draw time. Stacked layers are each outlined by the compiler, and a figure of
  outlined blocks is the disjointed look decision 105 mended; they would also need a draw call a
  layer a figure a frame. The price is a compile when the gear changes, which is rare: the 2D view
  compares what the player has on each frame and compiles their figure again (a small sheet of its
  own, its old canvas let go) only when it differs.
- **Each slot is dyed into a ramp of its own.** A piece is written in the `tier` ramp's A-E, or a
  weapon in metal, wood, brass and glow, and rekeyed into generated keys for its slot's role (helm,
  legs, other hand, blade, haft, fitting, gem), so a steel helm sits over studded legs and a tier is
  still a recolour of one drawing. Decision 104 had rejected a whole-figure sprite per class, kind
  and tier for exactly the mixing this allows.
- **What an item looks like is a row** (`art/wardrobe.ts`), the ramp the tier's unless it says
  otherwise, with a fallback by armour type and weapon shape so a new item is on the figure the day
  its row lands; a test holds every item the game has to a row of its own.
- **A swung weapon is drawn once, upright, and its six carries are made from it** by turning it over,
  turning it a quarter, and leaning it a pixel a row, which keeps the light on its top-left and is
  how B2's hand-drawn sword was shaped anyway. A longbow is the bow with its limbs drawn out.
  **Rejected:** drawing six carries of each of eighteen weapons; generating weapons procedurally
  from a rig, which is not art written as data.
- **The lookbook's grand looks are what the gear grows into**: plate over a quilted gambeson, the
  steel under the crimson cloak; the fen's robe trimmed in brass under its hood, the cloth hat
  pointed; the hide cowl the hunter's hood and mantle. The cutthroat's bandana is a mask over the
  nose and mouth, which read as a cutthroat's where a wrap over the head read as red hair.
- **A hairstyle is a whole head, not hair over a bald one**: hair frames a face, and a bald head
  under hair laid over it drew a skull too small for the hair. What falls past the head (long locks,
  a tail, a beard's point) is laid over the shoulders.
- **The townsfolk are drawn in B4**, as people, each a garment, a look and what they hold, told apart
  at a glance as their 3D colours told them; the humanoid creatures stay placeholders for B5.
- **A frame's edge ring is left clear by the kit**, a blade drawn back or a hat risen on a stride cut
  a pixel short, rather than every weapon shortened to fit the widest swing.
- **A bow or a shield leaves no hand to cast from**, so a figure holding one has no `cast` and a
  spell plays its swing; an orb or a lantern is held up in the casting hand.
- **The creation screen draws each class in the world's own art**, in the look chosen, with a
  smaller picture beside the choices so a phone that has scrolled the cards away still shows the
  look as it is picked. The class cards' stick-figure previews went with it.

## 108. A boss is the figure grown and a goblin the figure shrunk, creatures carry what they drop, and a moment is a sprite held fading

**2026-09-30 · Claude, building the plan's phase B5**

B5 draws every creature and the moments a fight is made of. Part B's open questions were all
answered in B1, so the forks were Claude's:

- **A boss is drawn bigger by refitting the figure, not by scaling it or drawing him again.** The
  budget has kept 48×64 for a boss since B1, "drawn bigger rather than scaled up". Every frame of
  his figure has a dozen rows doubled where the drawing is flat (the chest, the waist, the shins)
  and six columns (the shoulders, the cheeks, the legs), so the chief and the king stand a third
  again as tall and as broad as their men with the faces they were drawn with (`refitted`,
  `Build`). **Rejected:** a nearest-neighbour scale by four thirds, which draws some pixels twice
  as wide as their neighbours at random; a boss kit drawn by hand at 48×64, which is every pose of
  the figure drawn again for two creatures; bosses at a person's size, a chief standing in a room
  of his own men as one of them.
- **A goblin is the same refit the other way**, rows and columns left out, green, bald, its ears
  swept out and its eyes catching the light. **Rejected:** goblins at a man's size, which is how
  the 3D rig had to draw them and why it scaled them; a goblin kit of its own.
- **A humanoid creature carries what it drops**, so what a player takes off a body is what they
  saw it holding: the chief's bandana and cutlass, the king's crown and leaf blade, the raider's
  fenweave, the wight's grave shield. A getup gains a skin nobody is made in, a cloak colour and
  eyes lit from inside, and two weapons nobody can carry: the bandit's knife and the raider's
  gaff. A creature fights and does nothing else, with no spell or shot drawn, since its throw is
  its swing. **Rejected:** every creature on a getup with the player's full set, frames nothing
  plays; the 3D colours alone.
- **The cave crawler is the crab recoloured** (`crab@cave`), the style guide's own example of a
  variant, where the 3D view drew it a size bigger. **Rejected:** a crawler drawn of its own.
- **A moment is an effect sprite played on the budget's clock and then held fading by the view**,
  in four steps, as a corpse lies after its fall: a level's light plays its four frames and
  lingers for most of a second. **Rejected:** raising the effect budget's frames or timing for the
  level-up, which would multiply across every effect for the one that wants to linger.
- **An arrow is a line of pixels, and a telegraph a baked disc drawn at whole pixels.** Neither
  has a fixed frame: an arrow flies at any angle and a telegraph has any reach. The arrow steps a
  pixel along its longer axis in the palette's ramps; the telegraph's rim and disc are baked once
  a reach and the fill drawn from the disc at the size the wind-up has reached, under everything
  standing as the 3D rings lay on the ground. **Rejected:** an arrow sprite turned to its angle,
  which smears, or drawn in eight directions, which the budget gives no effect; a telegraph traced
  a row at a time each frame, hundreds of calls for the king's; a telegraph drawn over the
  figures and the lantern, which covers whoever is standing in it.
- **A number rises off the top of what it came off, and stacks over one born with it.** The
  view finds what stands at the spot a moment names and starts the number over its health bar, so
  it clears a boss's head and sits on a rat's; one born at a spot another was a moment ago goes up
  a line. **Rejected:** the fixed lift the checkpoint used, inside a boss and far over a rat; the
  soak drawn at a fixed offset, which a stack makes unnecessary.
- **Every enemy ability telegraphs, the bandit's thrown knife included**, as in 3D: it lands on
  whoever is still inside its reach, so the ring is the truth, even when a room of bandits fills
  with them. **Rejected:** drawing only the abilities that are not thrown.

Left for B6, with the nodes they come off: the chips a gather knocks loose, and the campfire.

## 109. A place is drawn from one table, a vein in the ore it yields, a fishing spot as a mark, and a room's furniture from one layout both views read

**2026-09-30 · Claude, building the plan's phase B6**

B6 draws the places: every node and what it leaves, the stations and the fire, what a stroke of a
tool knocks loose, and what stands in a room. Part B's open questions were all answered in B1, so
the forks were Claude's:

- **What each place is drawn as is one table** (`art/places.ts`), a node by its id and falling back
  on the drawing of its shape, as `cast.ts` falls back for a creature. **Rejected:** the 3D view's
  rule, one body a shape, which draws the tree, the hardwood and the willow as one tree; a table
  that must name every node, which a new row would fail to compile against rather than being drawn
  as its shape the day it lands.
- **A tree is drawn at the prop budget's 64 square**, a crown two tiles across half again as tall
  as a person, from leaf clumps a generator lit and painted and that were pasted in as the picture
  they made. **Rejected:** a tree at a person's 32×48, which a person can see over; generating trees
  at boot, which makes the art something nobody can read; hand-placing four thousand pixels a tree.
- **A crown the player is behind is faded, as a roof is, and a node is picked by its body**, a tree
  up its trunk and the lower half of its crown, as the 3D view picked it. **Rejected:** a crown that
  hides the player outright; a pick box the height of the crown, which takes the tap meant for a
  creature standing behind it.
- **A vein is drawn once in a neutral `ore` ramp and recoloured into the ore it yields**
  (`ORE_VARIANTS`), step 2 of each ore's ramp being the ore's colour in the bag, the way gear is
  drawn in `tier`; **coal is a seam**, a black band glinting across the stone. **Rejected:** a
  drawing per ore; coal in the thin seams tin and iron show in, where ore nearly as dark as the rock
  did not show at all; ore colours picked by eye, which would make a lump two colours in two places.
- **A fishing spot is a mark, a new kind**: rings on the water, not outlined, looping on the water's
  own 250ms clock, drawn under everything standing and centred on the spot. **Rejected:** a prop,
  whose outline drew the rings as loops of dark wire; a water tile with rings in it, since spots
  stand half a tile off the grid and a tile laid there would seam against the water either side; an
  effect played again and again, which is not what an effect is.
- **A stroke knocks something loose on each of a gather's two beats**, chips, flakes of stone or a
  splash, on the side the player stands, the moment the tool comes down. **Rejected:** a burst when
  a gather pays out, seconds apart and after the strokes that earned it; nothing, which left a
  gather a bar filling beside a tree.
- **What stands in a room moved from the 3D view to `art/rooms.ts`**, which both views draw from.
  **Rejected:** a second layout for 2D, two answers to where a shelf stands; leaving it in
  `render3d/`, which B7 deletes with it.
- **The 2D view draws a fitting by the wall it stands against**: from the front against the north
  wall, along its length against a side wall, and only as low as it stands against the south wall,
  which the cutaway takes away. **Rejected:** one drawing for every wall, a bench running across a
  side wall and a fire's mouth facing into it; the whole fireplace against the south wall, standing
  across the room in front of whoever is in it.
- **Whoever works in a room stands behind a counter**, drawn only in 2D, just in front of them
  toward the door and short of where the walk up to them ends, blocking nothing. **Rejected:** no
  counter, a person standing in a room; a counter that blocks, which the walk up to a shopkeeper
  would have to route round, in rooms with no cell to spare for it.

Found and left for the Part B review: town's training hall stands close enough south of the smithy
that its roof, faded, is drawn over the smithy's room while the player stands in it, a layout the 3D
camera never showed and the rebuilt zones of Part C will move anyway.

## 110. 3D is deleted whole, the camera never turns, the game imports no package, and the draw budget comes down to 16ms

**2026-09-30 · Claude, building the plan's phase B7**

B7 retires the 3D view: Three.js and `render3d/` deleted, smoke's draw budget and memory checks
rewritten for 2D, and `rendering.md` rewritten. Part B's open questions were all answered in B1, so
the forks were Claude's:

- **Everything 3D goes at once**: `src/render3d/`, its seventeen test files, `three` and
  `@types/three`, the `?renderer=3d` flag (a URL still naming it draws the one view there is), and
  smoke's `renderer-3d` section. So do the shared tables only the 3D view read: the townsfolk's and
  outlaws' colours and masks (`NPC_APPEARANCES`), the stride offsets, the appearance key, and the
  test pairing the paperdoll with the 3D figure. **Rejected:** keeping `?renderer=3d` a while longer
  as a fallback, which the plan's "no second renderer kept alive" rules out; keeping the 3D tests
  that held shared rules, which were **ported to the 2D picking test** instead (the priority order
  asked of every kind, a pile taken where it lies and a lapsed one answering nothing, a pile under a
  creature giving way to it, a second tap from the doorstep walking in, a rat on a shopfront's
  doorstep still attacked), each checked against a planted swap of the priority.
- **The camera never turns, and the orbit goes with it**: `orbitBy`, `cameraYaw`, the yaw a drag was
  worth and `InputState.setViewYaw`, so W walks north. The gesture (`host/gesture.ts`, from
  `orbit.ts`) still tells a drag from a tap, since a flick or a thumb sliding off a button must not
  walk the character, and a drag asks for nothing. **Rejected:** keeping the yaw plumbing for a
  camera that might turn again, when the art is lit from the top-left and drawn four ways round and
  a turned view would light every sprite from somewhere the sun is not; giving a drag something to
  do (panning, walking while held), which is a feature rather than a retirement.
- **The seam is that the game imports no package**, not that it imports no named engine: nothing in
  `src/` imports a package, `package.json` has no `dependencies`, and `render2d/` is imported by
  `main.ts` alone (`tests/architecture/seam.test.ts`, from `phaserFreeSeam.test.ts`). Imports are
  read by TypeScript's own scanner. **Rejected:** guarding Three.js by name as Phaser was, a list of
  engines to keep in step; the old test's regex, which matched prose such as "made from '…" in a
  string once it was asked about every package rather than one.
- **The view reports a canvas count** (`canvases()`), which is what it holds, in place of
  `gpuMemory()` and its `{ geometries, textures }`, and every memory check in smoke reads it.
  **Rejected:** keeping the 3D shape with its geometries always 0.
- **The draw budget is 16ms**, down from 40. The 2D view reads 2-3ms on CI on a full throttled run
  and 5-8ms in a loaded dev container, against the 25ms the 3D view read. 16 is where the draw alone
  stops fitting a 60fps frame: five times CI, twice or three times a container, and room for Part
  C's bigger, fuller zones. Planted to test it, every word baked again each frame read 46ms in the
  container, seven times the game and so over 16 on CI and under 40; nothing else in smoke noticed
  it. **Rejected:** keeping 40, which that regression passes; 8-10ms, three times CI but close
  enough to a loaded container's reading that it fails on whose machine ran it, which is a ceiling
  that gets raised rather than believed.
- **The paperdoll keeps its stick-figure rig until B8** draws the sheet to match the world.
  **Rejected:** redrawing it from the outfit now, which is B8's, with the rest of the HUD's look.
- **`rendering.md` is the 2D view's**, keeping what was about the game rather than the engine (the
  tab bar, the priority, the gestures, the menu, the pile), and takes `art.md`'s account of the view,
  so the style guide is what is drawn and `rendering.md` how.

Smoke's checks that a drag turned nothing went with the camera that could turn, and its landscape
check, which had held the 3D canvas's drawing buffer to device pixels and passed on the 2D one only
because the run's pixel ratio is 1, now holds the buffer in art pixels at a whole scale.

## 111. The HUD is drawn in the world's art: iron and brass frames, the world's font on its headings, every item, ability, buff and tab a pixel icon, and the world's figure on the sheet

**2026-09-30 · the user on the panels, the type, the icons and the phase's size; Claude's under it**

B8 is the HUD's look: Part A said what things are, and this makes them look like one game with the
world Part B drew. Four forks were the user's, asked when the phase started:

- **Panels are dark iron and brass**: a near-opaque face of dark stone inside a bevelled iron band,
  a brass plate riveted over each corner, and buttons that are slabs of stone standing out of the
  panel and pressing in. **Rejected:** parchment and leather, the boldest, and the brightest thing
  over a dark world, with every colour of text inverted to dark on light; dark oak and iron, which
  ties the HUD to the town and reads rustic rather than heroic.
- **The world's pixel font sets the HUD's headings, tabs and buttons**, compiled into a font file
  at boot from the glyphs the world already draws (`art/fontFile.ts`), while the dense lines (the
  numbers Part A labelled, the descriptions) keep the system sans. Decision 100 kept the whole HUD
  on a system font because a pixel font there "would have to be a font file"; a file written in
  memory from the data is no file loaded. **Rejected:** a book serif for headings, the platform's
  Palatino or Georgia, cheapest and nothing like the world; the system sans everywhere, leaving the
  frames and icons to carry the look.
- **Items, abilities, buffs, the tab bar and the purse all get icons**, and every word that stood
  there before stands beside its picture (pillar 1).
- **One phase and one PR**, well past the plan's thirty-file prompt, since the look is one thing to
  judge: frames round vector icons, or pixel icons in grey boxes, is neither the old HUD nor the new
  one. **Rejected:** B8 for the frames, the type and the sheet, and B8b for the icons.

How to build it had forks, all Claude's:

- **Every colour the HUD names is a step on the art's ramps.** `THEME` reads its colours off
  `rampStep`, and `theme.test.ts` holds the theme and every colour written into the stylesheet to
  the palette, so the gold of a stat is a coin's gold and the green in the corner the green over a
  head. The bars shade their fill in their ramp, a lit top row and a shaded foot, and the XP bar
  goes violet, the way the genre has drawn it, which frees blue for mana. **Rejected:** a HUD
  palette of its own beside the art's, the second copy the stylesheet was written to avoid.
- **A frame is a sprite kind of its own, cut in nine by the page** (`border-image`): corners drawn
  once and edges stretched, so an edge is the same all along its length, which `tests/art/hud.test.ts`
  holds. A counter's colour is its accent, the line inside the iron and the stone in each rivet,
  recoloured from `tier` as gear is, so the shop's gold and the trainer's violet still say which
  counter is up. **Rejected:** borders and shadows in CSS imitating a bevel, which are neither pixel
  art nor data; a picture a panel size.
- **The HUD's pixel is one CSS pixel**: a 32-pixel icon is 32 CSS pixels and a panel's iron eight,
  and a title is the font at two. On a phone that is the world's own pixel (a 390-point phone draws
  the world at one to one and a third CSS pixels to the art pixel), and on a desktop, where the HUD
  was already drawn phone-sized, it is finer than the world's. **Rejected:** two CSS pixels to the
  art pixel, which doubles every frame and makes an icon 64; the world's scale over the device's,
  which puts a variable into every number `ui/layout.ts` is tested at.
- **The pictures reach the page as images written once a page** (`hud/hudArt.ts`): each frame and
  one sheet of every icon onto a canvas, handed to a stylesheet of their own as data, and an icon an
  element showing its square of the sheet. A test's jsdom has no canvas, so its HUD comes up in the
  stylesheet's plain borders, every box the same size. **Rejected:** a canvas an icon, forty of them
  rebuilt on every change to the bag; a picture as SVG a rectangle a pixel.
- **Gear is drawn as what it is on the figure** (`art/icons.ts`): an item's icon is read off the
  wardrobe's answer and dyed in its ramps, so the helm in the bag is the helm on the figure in the
  same steel, and everything else is a row, falling back on its data's shape. `tests/art/icons.test.ts`
  holds every item to a picture of its own. With the stick figure and the vector icons gone,
  nothing read an item's `color`, `TIER_COLORS`, the bag's `ICON_COLOR` or a class's colour any
  more, and they went. **Rejected:** a row an item, the tier drawn again in each.
- **The icons are painted by a generator and pasted in**, as B6's trees were: shapes filled as
  materials and shaded by the style guide's light, a sphere for what is round, then written into
  the source as the grids they made. Seventy-three pictures of up to 32 square, which by hand is the
  better part of a phase on its own. A cooked or burnt thing is its raw self recoloured, into two
  new shared ramps, `roast` and `char`.
- **The paperdoll is the world's figure**: the character sheet draws `portrait` of the player's own
  getup at two CSS pixels to the art pixel, compiled again only when what is worn changes, as the
  world compiles its own. The stick-figure rig (`systems/AppearanceSystem.ts`) is deleted with it.
- **An ability is its picture on the slab and its name under it**, two lines at most, with a
  wizard's price across the foot of the slab in the world's font; "no cost" said nothing and went.
  **A buff is drawn as what gave it**: the shield as its spell, haste as Battle Fury, a full stomach
  as a roast. A tab is a sixteen-pixel mark over its word, the purse a coin between its label and
  its sum, and an item's card opens on the item drawn at twice a row's size.
- **The zone map is drawn in the ground's own colours, in the zone's light**: a tile is step 2 of
  its terrain ramp in the zone's setting, where it had been a table of bright colours of its own
  (`TILE_COLORS`), which went. **Rejected:** leaving the map as it was, the one panel left in
  another game's colours.

## 112. Part B's review mends five things in place: nothing over the room you stand in, a crowd's names stacked, a big screen seeing more, the map's names one size, the player column backed; Part C comes next as planned

**2026-09-30 · the user, asked by Claude**

Phase B9 walked what B1-B8 landed against the pillars and the user's first list, at a portrait
phone and a 1280×800 desktop: every zone from its spawn and a grid of points across it, and every
panel and counter through smoke's own screenshots. Part B's promise held. Every zone, creature,
place and panel is drawn and nothing is left a placeholder, the suite and smoke were green on
`main`, and the throttled draw read 6.5ms against 16. What the walk found were five places where the
art made something harder to read rather than easier, and the user chose to mend all five in the
review rather than leave them to Part C's rebuild or H1:

- **Nothing is drawn over the room the player is standing in.** B6 found it and left it here: from
  inside the smithy, the training hall's roof, faded, lay over the room with "Training Hall" written
  across it, a layout the 3D camera never showed. A building whose picture reaches over the room is
  drawn with the room cut out of it, and a sign that would be written there is not
  (`BuildingSprite.roomRect`, the clip in `drawStanding`). **Rejected:** moving the smithy or the
  hall, which town has no room for (the smithy moved once already for the west road) and C5 lays out
  again anyway, leaving the next layout to find the same thing; fading the roof further, which still
  lays a roof over a floor.
- **A crowd's names stack.** Creatures standing together wrote their names over each other: "Goblin
  Scavenger (LvGoblin Scavenger (Lv 4)" on the mill road, a pile of names round the chief. Every
  plate is laid out before any is written, and one that would be written over a plate already stood
  is lifted straight up clear of it, bars and all, never sideways, so a name is still over what it
  names (`render2d/plates.ts`). The order is what decides what never moves: the player, the target
  (whose health bar is the one read mid-fight), the signs and signposts, the townsfolk, then the
  creatures front first. A plate outside a crowd stands where it always did. **Rejected:** names only
  on the target, people, bosses and whatever is near, which is quieter but leaves a creature across
  the screen unnamed against pillar 1; leaving it to Part C's larger zones, where a pack still stands
  together.
- **A big screen sees more of the world.** The camera framed ten tiles across the screen's smaller
  side, so a 1280×800 desktop drew 13 by 8 tiles at three CSS pixels to the art pixel, and names 27
  pixels tall beside HUD words of 12. An art pixel is now never drawn wider than two CSS pixels
  (`MAX_CSS_PER_ART` in `render2d/camera.ts`), the size the character sheet draws the same figure
  at and the HUD sets its titles at: a desktop frames 12.5 tiles tall at 1280×800 and 17 at
  1920×1080, and no phone reaches the cap, so no phone changed. **Rejected:** keeping the desktop's
  framing and drawing only its words smaller, which leaves a desktop eight tiles tall; leaving it, a
  desktop as a big phone.
- **The zone map's building names are one size.** A name was set to its footprint's width, stretched
  or squeezed to it, so "Bank" came out three times the size of "Quartermaster's Post" on the same
  map. Every name is set at one size and broken onto two lines at the space that leaves the longer
  line shortest, and a line is squeezed only when it still would not fit, never stretched. An exit's
  name at the bottom edge is written over its marker, where under it hung off the map and over the
  sheet's frame (the beach's Blackwater Fen). **Rejected:** measuring each name in the browser to
  set its size, which jsdom cannot do and which still gives every name its own size.
- **The player column stands on a backing.** Its words and bars are laid straight on the world, and
  a name the world wrote under it read between their lines: a rat's between "Adventurer" and the
  health bar. A backing in the world's darkest ink at three-quarters strength is drawn round the
  column, outside the box `ui/layout.ts` counts, so nothing below it moved. **Rejected:** framing it
  in iron like the target frame, eight pixels a side the layout would have to find in a corner a
  landscape phone has none of.

What comes next is **Part C, as planned**, C1 first: big maps and the version 2 save era.
**Rejected:** the lore bible (C2) before C1, when C1 is a format and a save era and names nothing;
the minimap and pathing (C3, C4) first, which would work on today's maps and then be measured again
against the rebuilt ones.

Claude's, alongside them: Part C's rebuild phases now say that every creature, node, station and
building a rebuild adds is drawn in the phase that adds it, since Part B left nothing a placeholder
and a test holds every creature, item and vein to a drawing of its own. The walk's script, which
drops a character into each zone through the save and photographs it at both sizes, was scaffolding
for the review and is not kept; smoke's screenshots are the record, as they were for A10.

## 113. A zone is written as text, every placement on it included; version 2's saves count from 100 and a retired character is named once; the wizard's ids become staffs

**2026-09-30 · the user, asked by Claude, building the plan's phase C1**

C1 is the format the rebuilt zones will be written in, and the save era decision 82 promised. The
user settled three forks at the start of the phase:

- **Everything in a zone is written in its text** (`data/zoneText.ts`, a file a zone under
  `data/`). One character a tile: the ground in characters every zone shares (`.` grass, `=` road,
  `~` water, `:` sand, `_` stone, `#` rock, `,` marsh), and the start, creatures, nodes, stations
  and buildings in markers of the zone's own, each a legend row naming what it is and the ground
  under it. A marker stands in the middle of its tile; a building is a block of its letter exactly
  its footprint, and a block that is the wrong size or runs on past it refuses to load; whoever
  works in a building is named on its row and stands at its `counterPoint`, never written down a
  second time. A legend row the map never uses refuses to load too. The offsets from the map's
  middle went, with `spawns.ts` and the fixed 25×19, so a zone's size is its text's. **Rejected:**
  the ground in text and the placements as offsets beside it, which Claude offered and which leaves
  two ways to say where a thing is; the ground alone in text for now.
- **Every placement moved up to half a tile onto the middle of a cell**, and the sweeps flagged
  five: the forge stood across the smithy's open front, the north-east cottage over the
  quartermaster's counter, the mill road's north-east knot half in reach of its east arrival strip
  and half out of reach of itself, and two fen raiders onto the south strip and then within reach of
  the start. Each moved a cell. The spawn lists come out in the order the map is read, so the tests
  that took the first person or creature in a list name the one they want.
- **A route stands off the middle of a cell something reaches into.** With every building on tile
  lines, a room two tiles deep has room for the body but at the middle of neither cell, and its
  door is centred on the line between them; the pathfinder had no cell to route through and the
  smithy could not be walked into from round a corner. A cell whose middle is blocked now stands the
  body at the nearest spot a quarter tile off it, and a step touching such a cell is checked, with a
  shortcut's clearance, and may turn one corner to square up to a door (`PathSystem.ts`).
  **Rejected:** drawing even-sized buildings half a tile off the grid, which the text cannot say;
  pathing on a half-tile grid, four times the cells for every route on maps about to triple.
- **Version 2's saves count from 100** (`FIRST_VERSION_2_STATE`), so a save says which game wrote it
  at a glance, and the version 1 chain of migrations is gone. A version 1 save is dropped the first
  time it is read, and the creation screen names who was in it, the once: "Brom, level 8 warrior,
  retired with version 1. Version 2 is a fresh start." A version 1 file or code brought back through
  Load a Save is refused in the same words. **Rejected:** dropping it silently; keeping the line
  until a new character is made.
- **The wizard's weapons are staffs in their ids as well**: `apprentice-staff`, `stolen-staff` and
  `barrow-staff`, the ids decision 107 kept for the saves that named them. **Rejected:** keeping
  the old ids, which no save needs any more.
- **The camera needed nothing new.** It already framed whatever size the world is, clamped to its
  edges; the per-zone size is the text's.

## 114. The realm is the Veymarch, a drowned kingdom's frontier whose lanterns are going out; the spirit is the lampwright who drowned it; the elves and dwarves come back; the fen raiders have a cause

**2026-09-30 · the user, asked by Claude, building the plan's phase C2**

C2 writes the lore bible (`docs/lore/`) before any zone is rebuilt, so the rebuilds take their
names, secrets and rumours from one place. The user settled four forks at the start of the phase,
each on Claude's recommendation, and the bible is built on them:

- **The history is an old kingdom stirring**, built on what the game already said: Orlath's barrow
  sunk under the fen, "older work than any I know" buried in it, raiders carrying its key. The
  kingdom is **Veymar**, which held back the sea and kept its dead kings asleep with lanterns that
  had a soul kindled into them, and drowned when its last king, Merrath, had every light drawn into
  one to keep himself for ever. The fenfolk have kept the barrows' lanterns lit with their own dead
  since; the Company's settling is putting them out, and every soul that goes out is drawn to
  Merrath's light under the sea, which is the stakes the climb to 20 rises through. **Rejected:**
  magic seeping back into the world, the stakes being who wields it; a frontier pushing into the
  wild with no single great evil.
- **The spirit is a soul of the old age**, woken with it and remembering in pieces, a piece at each
  new zone and boss, as D4 promises. It is **Wick**, who was **Lorn**, the lampwright who lit
  Merrath's light, kindled unwilling by the survivors and sealed in the hill the New Cut's blasting
  cracked; it fastened on the player because a soul held near a living one is not drawn to the
  light. **Rejected:** a wisp of the land, the last of its kind; the ghost of the last hero to try
  the climb; a helper hiding what it is until the end, which Wick is without knowing it.
- **Elves and dwarves withdrew, and are coming back.** The elves left Veymar's courts over the
  kindling, the dwarves shut their doors when the Drowning took their deepest halls, and the lanterns
  going out brings both back. Before level 9 each is met once, as an event: an elf at the millpond,
  a dwarf at a door in the Deep Cut; their homelands are Part G's. **Rejected:** peoples near but
  apart, ordinary at their borders; peoples mostly gone.
- **The outlaws are mixed.** Hollis's Red Rags are criminals with no grievance but greed. The fen
  raiders are the fenfolk's young, who strike the Company's salt pans because the pans cut them off
  from the barrows they keep. **Rejected:** every outlaw band grey, each with a leader to deal with;
  outlaws only ever enemies.

**The lore is Claude's from here.** The user read the draft and handed it over: the game is mainly
for them, and a story they have not read is one they get to find out in play. Later phases write
and extend `docs/lore/` without asking the user about story, and a PR or a summary says which parts
it touched rather than retelling what they now say. The game's mechanics stay the user's to settle,
faction standing among them. **Rejected:** the user reviewing each lore change, which the plan had
for C2.

Claude's, alongside them:

- **An index and seven files** (history, peoples, factions, places, spirit, tone, naming) rather
  than one document, so a later phase reads the part it needs. **The bible is canon for anything not
  yet built**, and a phase that needs a fact it lacks adds it there in the same change, as
  `docs/architecture/` is corrected.
- **A name reaches the game in the phase that rebuilds where it is**: Town becomes Lampton in its
  rebuild, the beach Candle Strand, the quarry the New Cut, and C2 changes no data. Part C shows the
  world half renamed while it is rebuilt, which decision 83 already accepts. **Rejected:** renaming
  every zone now, which names Candle Strand before any Candle stands off it.
- **What the game already said is kept and explained** rather than contradicted: the fettler's "none
  of it was theirs" is his mistake, since fenweave is the fenfolk's own cloth; the raiders carry the
  barrow's key because they keep it; Orlath's grave goods are dwarven work; a cave crawler is a sea
  crab come up through the dwarves' drowned halls; and the smithy is empty because its smith went
  east to a wedding and never came back.
- **The ending is written as intended**, so rumours and Wick's memories have something to point at:
  Wick goes into Merrath's light and lets go, and every soul of Veymar goes on with it. Part G may
  change how it is reached, not what it is about.
- **Part D's open questions narrow**: which factions there are and what the spirit wants are
  answered here; whether raising one faction lowers another is still D3's.

## 115. The minimap stands in the top-right corner with the target frame beside or under it, opens the zone map on a tap, and can be switched off on the character

**2026-09-30 · the user, asked by Claude, building the plan's phase C3**

C3 is the minimap decision 86 promised: you, nearby creatures, exits and points of interest, in a
corner that keeps clear of everything `ui/layout.ts` already reserves. The user settled three forks
at the start of the phase, the first two on Claude's recommendation:

- **The top-right corner**, where RuneScape and World of Warcraft keep it. The target frame stands
  beside it where the top row has room for both (a landscape phone, anything wider) and under it on a
  phone held upright, where the player column and the minimap all but meet. **Rejected:** the
  bottom-right, over the tab bar beside the ability buttons, the one corner nothing used, with the
  quest tracker stopping short of it and a desktop's sheet stopping above it; it put the minimap under
  the thumb and moved nothing at the top.
- **A tap opens the zone map**, at this zone and turned from the world view if that was showing, and
  a second tap shuts it as its tab would, since at four pixels a tile there is no room for a name and
  the sheet is where the names are. **Rejected:** walking to the tapped spot, RuneScape's way, which
  a thumb would miss by a tile or two at that size; a minimap that answers nothing.
- **A switch in Options, kept on the character** like the tips switch (`CharacterState.showMinimap`,
  save version 101, the first step of version 2's migration chain, which switches it on for everybody
  made before it). **Rejected:** always on, which Claude recommended as one setting fewer.

Claude's, alongside them:

- **A window round the player, not the whole zone**: 27 tiles a side at four CSS pixels a tile, the
  player in the middle, the window held to a whole pixel so every edge lands on one. The rebuilt zones
  are 45 by 32, which in a corner a thumb wide is two pixels a tile. **Rejected:** the whole zone
  scaled to fit, which on today's zones would have worked and on C5's would not.
- **Creatures reach the HUD the way the player's tile does** (`creatures-changed`): every living
  creature within `MINIMAP_REACH` tiles of the player's tile, whole, published when one crosses a
  tile, dies, gets up, or comes into reach or leaves it, from the tick and unseeded. It carries a
  level rather than a colour, and the HUD colours each dot as its name is coloured over its head,
  against the level it holds. **Rejected:** positions once a frame, the channel the HUD has been kept
  off since the map sheet was written; every creature in the zone, which on a rebuilt zone is a
  stream of crossings nobody can see; drawing the minimap in the view's canvas, which would have been
  smooth and free of any event but is HUD furniture the world's picking would have to step round, at
  the world's scale rather than the HUD's, inside the draw budget.
- **The zone map's drawing, windowed**: an SVG built from `zoneMap()` through helpers the sheet now
  shares (`hud/mapArt.ts`), so the two cannot disagree about where a tree is, and jsdom can read it.
  What stands on it is shaped for its size: nodes flat, people a size up, a creature ringed in ink so
  a green rat is not the green tree beside it, a boss bigger, the player a cross. **An exit is an
  arrow** pointing off the edge it leaves by, drawn on the rim in the road's direction while it is out
  of the window; it was a gold square until the first look found a level 2 rat's yellow the same
  thing to the eye. The zone's name is under it in the world's font.
- **The zone sheet keeps no creatures.** It is the plan of the place, opened to find the forge; the
  minimap is the map looked at mid-fight.
- **The switch is the session's to set** (`GameContext`), as taking the save away is, since nothing
  in a zone reads it.

## 116. Creatures walk round things, notice only who they can see and reach, give up on a chase going nowhere, and leash at the ring round home; the player's pursuit walks round too

**2026-09-30 · the user, asked by Claude, building the plan's phase C4 · reverses 26 and the pursuit half of 37**

C4 is decision 86's smarter creatures: they path round walls and obstacles, with leashing reworked
for it. The user settled four forks at the start of the phase, each on Claude's recommendation:

- **A creature that cannot reach the player gives up and goes home**, healing as a leash does, after
  its chase has gone nowhere for two seconds (`GIVE_UP_MS`). Standing somewhere it can never get to is
  an escape rather than a turret: a ranger shooting it from there heals it every two seconds.
  **Rejected:** waiting at the nearest spot it can stand and throwing what it can, RuneScape's
  safespot, a known trick and a cheap kill; pressing straight at the player, what every creature did.
- **The leash stays a ring round home, as the crow flies**, and the walk home is routed. One led round
  a building gives up at the same ring as one led across open ground, which is the one a player can
  learn by looking. **Rejected:** the walk home measured along its route, so a creature led round a
  building gives up sooner; giving up after about eight seconds without landing or taking a blow, the
  ring kept as an outer limit.
- **An aggressive creature notices only a player it can see.** A wall between them hides the player,
  so cover is a way past a camp, and one that sees them through a doorway comes round. **Rejected:**
  the radius alone, through walls, now walking round to reach them.
- **The player's pursuit walks round too**, on the same chase the creatures run. **Rejected:** keeping
  it straight as decision 37 left it.

Claude's, alongside them:

- **A chase is a route kept rather than re-made** (`world/Chase.ts`): straight at the quarry while
  the body has a clear line, and otherwise round what is in the way on a route kept until the quarry
  is a tile off its end, never re-planned twice in half a second, its last leg the quarry where it is
  now. That is the answer to 37's objection, that a plan re-made every frame for something moving
  swings between two ways round an obstacle as it drifts, which a test holds. **Rejected:** a plan
  every frame; a plan on a timer alone, which re-plans a quarry standing still; flow fields over the
  zone, one per quarry, which answer many chasers at once where this game has one or two.
- **Going nowhere is measured off what the body did**, not off what the search said: on a route or a
  clear line, a step that went under a quarter of the way it was set; with no route, a step that got
  no nearer, since a chase with no route presses straight and that press may walk the length of a
  passage a search refuses. **Rejected:** "no route" alone, which gave up on a creature pressing
  straight down a corridor to the player, and missed a route the body could not walk.
- **Noticing asks for a way as well as for sight**, cheapest first: the radius, the line, then a
  search at most every half second. A creature with no way to the player never starts a chase it
  could only give up, which would otherwise have been a creature walking to the shore and home again
  for as long as the player stood across the water.
- **Both chasers stop in reach and in sight.** A staff reaches 200, so a wizard at the back of a room
  would have stopped against the wall with the creature the other side. **A swing still asks nothing**
  and decision 44 stands: no creature's reach is longer than a wall and two bodies, so a gate on a
  creature's swing refused nothing in the game and made a body standing inside a trunk untouchable.
  It was written and taken back.
- **A walk home that goes nowhere as long ends with the creature put there.** One stuck on the way
  never wanders again, and only a wandering creature notices anyone. A slot exactly a body's width is
  somewhere a press can push one and no route takes it out of (decision 35), which is the case.
- **The pathfinder routes any body** (half extents rather than one number, since a rat is a tile and
  a quarter long), **remembers its footings for the life of a zone** per body size, and **searches with
  a heap**: on a 50×38 stand-in for a rebuilt zone the mean search fell from 5.7ms to 1.9ms. Rejected:
  routing a creature as the square its body fits in, which gave a rat the room of something twice as
  broad.
- **The spawn-safety sweep holds each creature's way home**: its home somewhere its body stands, and
  a walk home from every cell a chase inside its ring could lead it to, at 60fps and at 5. It found
  four homes no walk could end at, all from C1's half-tile snap: a goblin in the trunk of a hardwood
  (the tree moved), the barrow king's feet in the rock (an alcove behind him), and a fen raider and a
  lurker in slots a tile wide between pools (the lurker moved, the pool gave up a tile).

**What it costs:** a rat cannot follow the player into a room two tiles wide (the cottages and the
inn), since a route may not turn without a quarter tile to spare each side and a rat has an eighth;
it gives up there. Loosening the clearance for it would have re-opened routes decisions 34 and 35
closed for the player. Every creature the player's size follows them into any room they can walk
into.

## 117. Secrets are found by walking up to them and pay a line and a cache; travel waits for C10; the strand has no tide; Lampton and Candle Strand rebuilt at 45×32

**2026-09-30 · the user, asked by Claude, building the plan's phase C5**

C5 is the first of the rebuilds: Lampton (town) and Candle Strand (the beach) at decision 86's
45×32, each with its secrets. The user settled four forks at the start, each on Claude's
recommendation:

- **A secret is found by walking up to it.** It is a small thing drawn in the world, on neither map
  and with no name over it, often down a way that is not obvious; coming within a tile and a
  quarter finds it (`SECRET_REACH`), and so does a tap on the ground by it, which is a walk there.
  Once per character, kept on the character (`CharacterState.secrets`, save version 102), since
  finding one leaves nothing else behind. Measured along the stretch the body walked each frame, so
  a phone stepping forty pixels a frame finds one it walked past, and not across a jump.
  **Rejected:** a Search action, which has to be taught; a tool, which with no rumours before D2
  is guesswork; hidden until a rumour, which leaves every secret dark until D2.
- **A find pays a line and a cache.** Wick says what it is, once, on the card the tips are said on,
  ahead of any tip waiting and whether or not tips are on, since it is the reward and not advice;
  the cache is coin and now and then something worth having at the zone's level, and what the pack
  cannot take is left in a pile where it was found. The zone map says "Secrets 1 / 2" under the
  map for a zone that hides any, and nothing for one that hides none. **Rejected:** a line alone;
  a cache alone.
- **No travel yet.** The rebuilt zones make every walk longer, and C10, which tunes the grind in
  minutes of play, decides whether travel comes back and at what price. **Rejected:** a paid
  carter between the hubs; a recall home on a long cooldown; never.
- **The strand has no tide.** The map never changes under anyone's feet, so pathing, spawns and
  every sweep ask about one map, and what a tide would have uncovered is reached another way that
  is always there. **Rejected:** a tide on a clock, which changes walkable ground under the
  pathfinder and needs rules and tests of its own.

Claude's, building it:

- **Three secrets, two in Lampton and one on the strand**, from `docs/lore/places.md`, each a row in
  `data/secrets.ts`, a marker in its zone's text (`{ secret }`) and a drawing in
  `art/sprites/secrets.ts`, one of which stands up out of the ground and blocks like a trunk. A
  secret is drawn whether found or not, since it is a thing in the world. A test holds each placed
  once, in its own zone.
- **The zones take their names**: Lampton and Candle Strand, on signposts, the minimap and every
  line that names a place, as `docs/lore/README.md` has it. **The townsfolk keep their trades as
  names** until D1 lets them introduce themselves. **Rejected:** their own names over their heads
  now, which tell a new player nothing about where to buy a pickaxe.
- **Lampton** keeps its counters on the high street, a new player starts at the inn's door rather
  than the crossroads, and it gains lanes, cottages, a larger grove and pond, and rats by the inn
  and in the grove. **Candle Strand** keeps the spit and strand the fen road needs, and gains a
  causeway of stone out into the sea, which needed one new edge, stone under sand.
- **Tests that assumed the old town** now stage what they need, or read what they want by name:
  the pair of buildings B6's cutaway was found on is built in its own test, the south signpost is
  measured from the arrival strip where the camera is pinned hardest, and smoke taps it from a few
  tiles up the road. Smoke gained a `secrets` section.

## 118. The rebuilds go the starter band first, add more of what a zone has rather than something new, and leave its people to Part D; ruins get a ground of their own; the New Cut and Redrag Camp rebuilt at 45×32

**2026-09-30 · the user, asked by Claude, building the plan's phase C6**

C6 is the second of the rebuilds. The user settled three forks at the start, each on Claude's
recommendation, and all three hold for the rebuilds after it:

- **The New Cut and Redrag Camp are rebuilt next**, the rest of the starter band's open ground, so a
  new character's first hours are all at the new size. The rest pair as the two vaults (the
  Cutthroat's Cellar and the Sunken Barrow, which are the same shape on purpose), then Old Mill Road
  and Greyford, then Blackwater Fen and the Deep Cut. **Rejected:** the New Cut with the Deep Cut,
  the two joined by the shaft so their shared edge is settled once; Redrag Camp with the Cellar, the
  waystation and the vault under it rebuilt as one place.
- **A rebuild adds more of what its zone has**: veins, creatures of the kinds it had, room, side
  paths and secrets, and no new kind of thing to do, so what each zone yields stays fixed until C10
  tunes the grind against it and the progression tests measure the layout alone. **Rejected:** a
  new activity per zone, the bandits' fire to cook at or trees on the Cut's rim, which changes what
  a zone is for and what idle can do there.
- **The people the lore names for a zone come in Part D**, with dialog to make them worth a tap, as
  C5 left Bess Mallow. **Rejected:** placing them in each rebuild with a greeting and nothing else.

Claude's, building it:

- **Ruins are a ground of their own**, masonry (`MASONRY_TILE`, `%`): blocking as rock is, standing
  its face up inside its own cell as rock does, and drawn as dressed stone in courses in the `rock`
  ramp, so a wall is the hill's dark in any light and the zone map draws it as rock. Redrag Camp's
  waystation is the first; the Cellar, the barrow, Greyford's bridge and the mill road's shrine are
  what it is for next. **Rejected:** building the ruin from rock, which reads as an outcrop; a
  roofless building on the building kit, whose walls are a quarter of a tile and whose room is one
  box with one door, where a ruin is broken in several places.
- **The road meets the waystation's paving** along one new edge, the dirt over the slabs, since a
  road that stopped a tile short of the gate on grass read as no road into it.
- **The New Cut keeps the quarry's shape**: the shelf along the north edge for the Deep Cut's
  arrivals, the face under it with the shaft through its middle, the west ledge to Greyford, turf
  along the south. A ridge across the pit makes two benches, the gated ore and the biggest rats on
  the upper. A vein stands against rock or two tiles off it, never a body's width off.
- **Redrag Camp is the waystation's ruin on the road**, entered at its gate, broken in the north,
  east and south walls, with the wardens' hall at the back holding the lamp niche and the level 3
  men. Every bandit stands in columns 12-37, where the sweeps put the bound: out of aggro across from
  both arrival strips, and out of a wander disc and an aggro radius from the start on the road. The
  way down to the vault stays the east edge, off the back of the yard.
- **Two secrets**, one a zone, from `docs/lore/places.md`: the broken cell behind the Cut's face,
  through a breach a spoil heap stands in front of, with Wick's line from the lore and a little coin;
  and the lamp niche in the hall's back wall, past every Red Rag in the yard, with a purse in it.
  Both are drawn set into the wall behind the floor tile they are found from.
- **The zones take their names**, the New Cut and Redrag Camp; the hideout keeps its name until the
  phase that rebuilds it. Smoke's zone checks count secrets among what is drawn.

**Left open, for the vaults' phase:** an underground zone joined by an edge keeps that edge open end
to end, since an arrival lands at the fraction of the edge it was crossed at (the hideout's whole
west side, the Deep Cut's whole south). At 45×32 that is a strip thirty-two tiles long down one side
of a vault. Whether an exit into a vault becomes a door somewhere in it, or an arrival at a mouth
narrower than its edge, is that phase's question.

## 119. A vault is entered at a mouth narrower than its edge; the Cutthroat's Cellar and the Sunken Barrow rebuilt at 45×32

**2026-10-01 · the user, asked by Claude, building the plan's phase C7**

C7 is the third of the rebuilds, the two vaults. The user settled the one fork decision 118 left it,
on Claude's recommendation:

- **An exit is open along its mouth**, a stretch of its edge named on its row (`ZoneExit.mouth`, the
  first and last tile open), and only that stretch leaves. Each vault's side is a mouth five tiles
  across, and where the zone outside has been rebuilt its side narrows too: Redrag Camp's east edge
  is now the walled lane out of the gap in the waystation's east wall, and the fen's south edge stays
  whole until C9 rebuilds it. An arrival lands across the mouth of the exit back at the fraction of
  the other it was crossed at. Walking off an edge is still how a zone is left, so the signposts, the
  minimap's arrows and the edge-walk on a keyboard work as they did, and C9 can narrow the Deep Cut's
  side the same way. **Rejected:** a door somewhere in the vault, a new kind of exit at a point, which
  frees the layout entirely but touches the signposts, the edge-walk, both maps, the minimap and the
  sweeps and needs a door drawn — the change Lampton's undercroft and Karn Tholl's door will want, left
  for them; keeping the side open end to end, a hall thirty-two tiles long down one wall of each vault.

Claude's, building it:

- **A crossing is measured over where a body's centre can cross**, the mouth held half a body in from
  either side, for a mouth and a whole edge alike, so a body crossing hard against one side of a wide
  mouth arrives hard against the same side of a narrow one, and never in the wall beside it. A whole
  edge's arrivals moved by at most half a body for it, and the sweeps now ask the ends of a mouth, 0
  and 1, where they asked a little inside them. **Rejected:** a fraction across the mouth's full width,
  which lands an arrival at 0 with half its body in the rock; clamping such an arrival afterwards,
  which makes a crossing and the arrival it carries disagree.
- **The sweeps ask the mouth**: an arrival anywhere across it lands on ground, every tile of it on the
  edge is ground, it is three tiles across or more, every exit has its way back on the opposite edge,
  and an arrival strip is measured to as the segment across its mouth rather than as a line down the
  whole edge.
- **A vault is rock with every room lined in masonry**: both are built tombs dug into the ground, so
  the hill is packed up behind dressed stone, which needed two edges, masonry under rock and masonry
  under water. **Rejected:** masonry throughout, which reads as a plain of capstones; rock alone, the
  look version 1 had, which reads as a cave.
- **The Cutthroat's Cellar** takes its name, and its key is the Cellar Key: the stair down from the
  lane, the guardroom left clear, the spine east to the warden's tomb with Hollis in front of the
  bier, and the bunk room and the storeroom off the spine, nine creatures where there were five.
  **The Sunken Barrow** keeps its shape, read north to south: the stair, the antechamber, the gallery,
  the crypts at its ends and the king's chamber off its middle, eleven where there were nine and every
  seven shallower than every eight. Both keep the start, where a death in them puts somebody, at the
  foot of the way in and out of every creature's reach.
- **Two secrets**, one a vault: the Company strongbox at the end of a low passage back under the
  Cellar's guardroom, which carries Wick's beat for the Cellar from `docs/lore/spirit.md`; and the
  frieze of the sea-lights along the barrow's gallery, from `places.md`. Both are drawn, the frieze at
  the prop budget's 64 by 32.
- **Smoke walks into the Cellar and out again by each side's mouth**, and holds everything in it
  drawn, the strongbox included. No section walks to the barrow, as none did before; its frieze is
  compiled at boot in every run and held by the art tests.

## 120. One stream runs from Greyford's ford into the mill road's millpond, and the edge between them opens at a mouth; a secret may lie in a room and is found from inside it; Old Mill Road and Greyford rebuilt at 45×32

**2026-10-01 · the user, asked by Claude, building the plan's phase C8**

C8 is the fourth of the rebuilds, the upper band's road west and its hub. The user settled two forks
at the start, each on Claude's recommendation:

- **The stream Greyford fords is the stream the mill dams.** It comes down off the Greyhills past the
  outpost, under the fallen bridge, and runs off Greyford's south edge into the Old Mill Road's
  millpond, so the edge between the two zones has water across its west end on both sides. Each side
  of it is a mouth, the same stretch east of the stream (`[6, 44]`), the first mouths outdoors
  (decision 119), and an arrival lands where it was crossed. The ground west of the stream on either
  side of that edge does not leave, as Redrag Camp's east edge already does not outside its lane.
  **Rejected:** a stream inside Greyford, coming off its north edge and leaving by its west, which
  touches no shared edge but leaves the millpond fed by nothing and the ford's water and the mill's
  two different waters.
- **All four of the lore's secrets go in**, two a zone, and two of them lie in a room. **A secret may
  lie in a room**: written into its building's block where it lies, the block still read as the
  whole footprint since every tile's middle is inside the walls, and **found from inside that room
  and nowhere else**, since a wall is a quarter of a tile and the reach would otherwise find it from
  the room in front or the lane behind. **Rejected:** the two outdoors only, the shrine and the
  keystone, leaving the ledger and the fettler's back room, and with it Wick's beat for Greyford, to
  Part D.

Claude's, building it:

- **Greyford** is the Company's post at the ford: the road from the New Cut along the east edge's
  middle rows and the length of the yard to the ford, the road south to the mill road leaving it
  halfway, the trading post and the fettler's longhouse fronting it from the north as Lampton's
  counters do, the tannery and the fletcher's bench at the yard's west end by the water, and
  cottages for the outpost's people. **The ford is the fallen bridge**: its abutments either side,
  two piers still standing in the stream, and the crossing its stones, dressed stone and masonry
  built only from edges the game already had. Over it the old road goes a little way west and is
  grown over, towards the Stillwood. Nothing spawns here still.
- **The fettler's store** is a new building, three tiles by two, against the back of the longhouse
  with **its door round the back**, facing away from the camera as the inn's does, so it is never
  seen from the yard. A tap on its roof, where it shows over the longhouse's, walks round to the
  doorstep, and a second goes in. Crates stand either side of its floor and the back room's chest and
  lantern in the middle. **Rejected:** the back room as the far end of the longhouse, which is one
  room the fettler stands in the middle of.
- **Old Mill Road** keeps the road from Lampton on the high street's rows, running as far as the mill
  yard and stopping, with the road north to Greyford the way on, so no road runs off an edge with no
  exit. The millpond is in the north-west, filled by the stream, the mill on its bank with its back
  to the water, and willows round it. **Five knots of three** where there were three, the level 4
  three met first either side of the road and the level 5 two at the far end by the pond and south of
  the mill; the hardwood gathered into **the timber stand** in the south-east, with a few trees in the
  corners. Every knot is out of reach of the north mouth's arrivals as well as the east edge's, and
  the start is on the road near Lampton.
- **The four secrets**, each drawn: the shrine under the millpond, a slab cut with a leaf, seen
  through the water from the bank between two willows, **a mark** rather than a prop since it is the
  water's surface with the stone showing through, unoutlined and moving on the water's clock; the
  first charter's ledger, open on a writing desk against the mill's west wall, a cold candle on its
  corner; the bridge's keystone lying carved face up in the ford by the pier it fell from, a lamp
  burning cut into it; and the fettler's back room, a chest of grave goods with a ring on its lid
  beside a cracked lantern with nothing in it, which carries Wick's beat for Greyford. The back room
  leaves a reforging stone with its coin, the fettler's own stock.
- **A sweep found the strand's causeway one tile wide**, exactly a body, which the pathfinder never
  routes along: the warden's niche could be walked to only in a straight line from the spit's end,
  and a tap on it from up the strand went nowhere. The causeway is two tiles wide now, and a new sweep
  holds that **every secret can be walked up to** from where its zone puts a player, into its room
  for one that lies in a room.
- **The lore moved with it**: the shrine was the stream's head in `history.md`, which one stream
  through the ford cannot be, so it is where the stream pooled below the hills. Smoke gained a
  `back-room` section: a tap on the store's roof walks round to its door, a second goes in, and the
  back room is found.

## 121. The fen's south edge and both sides of the New Cut's shaft open at a mouth; two of the lore's three secrets in each zone; no scenery yet; Blackwater Fen and the Deep Cut rebuilt at 45×32

**2026-10-01 · the user, asked by Claude, building the plan's phase C9**

C9 is the last of the rebuilds, the upper band's marsh and its mine. The user settled four forks at
the start, each on Claude's recommendation:

- **The fen's south edge opens at a mouth, at the barrow's door**: the same five tiles as the
  barrow's own (`[20, 24]`, decision 119), at the end of a causeway, with the black water either side
  of it and the rest of that edge water that does not leave. A raider is kept off the door's five
  tiles rather than off a strip forty-five long. **Rejected:** keeping the edge whole, every raider an
  aggro radius off the whole bottom of the marsh, and arrivals from the barrow across the full width.
- **Both sides of the New Cut's shaft narrow to it**: the Deep Cut is entered at a mouth at the
  shaft's foot, and the New Cut's north edge opens only at the shaft's head (`[19, 25]`, the shaft's
  seven tiles), its shelf given back to the face, so a body coming up the shaft arrives in the shaft.
  This touched the New Cut, rebuilt in C6, as C7 touched Redrag Camp. **Rejected:** narrowing the
  Deep Cut's side only, which lands a body coming up anywhere along a shelf forty-five tiles long;
  neither, which keeps a gallery the full width of the Deep Cut's south side.
- **Two of the lore's three secrets in each zone**: the drowned village and the lantern still burning
  in the fen, the sealed door and the maker's mark in the Deep Cut, the door carrying Wick's beat for
  the zone. The way towards the holm and the crawlers' flooded passage wait for Part G, where the
  places they lead to are built. **Rejected:** all six, two of them pointing at places nobody can go
  yet; three in the fen and two in the Deep Cut.
- **No scenery yet**: the lore's lanterns on posts across the fen are the one lantern that is a
  secret, and the fen's look comes from its ground, its pools, the salt pans and the drowned roofs.
  **Rejected:** a new kind of marker, a prop that stands, is drawn and does nothing, which later zones
  could reuse but which is a new concept in the zone text, left until a zone needs it more.

Claude's, building it:

- **Blackwater Fen** reads north to south, depth the dial as it was. The strand along the north is
  the beach road's arrival end to end; the Company's salt pans are cut into its east end, two rows of
  four, with a drain run straight down out of the marsh to feed them and a crossing of stone over it,
  since the lore says the drains are what lowered the water over the barrow. The mere in the west has
  the drowned village under it, two chimneys of dressed stone standing out of it; four deep pools
  each with a raider over it hold six fishing spots where there were four; the lantern stands on a
  holm in the south-west reached by a neck of reed two tiles wide. Twenty-one creatures where there
  were eleven, every five north of every six and every six of every seven, and the start on the
  strand.
- **The barrow's door is masonry and its threshold the stone floor**, the door's kerb across the
  bottom edge either side, which needed the two edges the marsh had never met: `MASONRY_UNDER_MARSH`,
  the wall's face over the reeds at its foot, and `STONE_UNDER_MARSH`, the mud washed over the
  threshold's slabs.
- **The Deep Cut** is the outer workings of Karn Tholl, read south to north: the shaft, the goblins'
  rough gallery with water standing in its east end where the crawlers come up, two workings north
  off it with coal at their near ends and rich iron at their backs, and between them **the dwarves'
  road, cut square and lined in masonry**, into the hall where the goblins stopped digging, the door
  in its north wall. A passage off the hall ends a wall short of the east working, and the mark is cut
  there: the goblins dug to within a wall of it and never through. Sixteen creatures where there were
  ten and eleven seams where there were six, nothing aggressive in the shaft or the gallery.
- **The four secrets**, each drawn: the drowned village **a mark**, as the shrine under the millpond
  is, roofs a step paler than the water seen from the mere's south shore; the lantern still burning
  a post of bog oak with a lantern hung from its arm over the barrow's mound, the keeper's bowl and
  a fold of fenweave at its foot, and **the first standing secret that loops**, its blue-white flame
  guttering on the prop budget's clock, as a station's fire does; the sealed door the prop budget's 64
  square, iron leaves in a frame of dressed stone, barred and sealed in gold with a peak struck in
  the seal, the same peak cut in the lintel; and the maker's mark a face of the wall dressed smooth,
  the peak cut in it, a name, and a reckoning in strokes of five under it. **The peak is Karn Tholl's
  mark**, the one on every grave good out of a barrow, written into the lore with it.
- **A diagonal squeeze is a gap a body's width too.** The fen's raiders are a whole tile wide, and
  the way-home sweep found one wedged on its way home between a pool's corner and a scrap of water at
  the causeway's head, a tile apart on a diagonal: a passage with no slack in it, though nothing
  across it in a straight line is a tile wide. The scraps went, and the pools' outlines were laid
  clear of each other's corners.
- **Every zone now hides a secret**, so the two tests that took the Deep Cut as a zone that hides
  none empty one for their length instead, since a zone Part G adds may hide none. Smoke walks down
  the shaft into the Deep Cut and back, holding the arrival across the mouth and everything drawn
  there, and into the fen for the lantern, which nothing but a browser draws looping.

## 122. A level takes its number plus four minutes of play, measured by playing it; food is the answer to the wait; no travel until G1

**2026-10-01 · the user, asked by Claude, building the plan's phase C10**

C10 is pillar 3's promise, "tune curves down before adding systems up", and the first time anything
measured the game in time rather than in kills. Claude measured it first, with a bot that plays each
zone at the level and in the kit meant for it (`tests/world/pace.ts`, below). In the right zones the
warrior climbed from 1 to 9 in about seventy minutes of play, the ranger in about an hour and a half
and the wizard in about two hours. **Half to three-quarters of that time was standing still for
regen**, which waits five seconds after a fight and then returns 2% a second. The curve was lumpy too:
the mill road gave a level in four minutes and the Deep Cut the same level in fourteen to
twenty-nine. The longest walk was thirty-one seconds, and each gathering skill capped in twenty to
twenty-five minutes, about 85% of it spent channelling. The user settled three forks, two on
Claude's recommendation:

- **A level takes about five minutes at the start and twelve at the cap's door, every class held to
  it**, measured on the bot: level n to n + 1 takes n + 4 minutes, sixty-eight from 1 to 9. A person
  takes longer than the bot, and the quests pay on top of the grind it measures. **Rejected:** about
  ten a level throughout; five early and twenty at the top; three early and eight at the top.
- **No travel; G1 decides again**, once zones past these ten exist. The longest walk is Greyford to
  the barrow's door, and Lampton to anywhere takes twenty seconds or less, so travel would save
  seconds and a price on it would be a coin sink with no reason behind it. **Rejected:** a free
  recall to Lampton on a long cooldown; a paid carter between the hubs.
- **Regen stays as it is, and food is the answer to the wait**, the user's call against Claude's
  recommendation: food heals more and faster, more of it drops, and the shelf's rations cost less, so
  eating between fights is the way to skip the wait and cooking stays central, at the cost of a tap
  in the bag between pulls. **Rejected:** faster regen out of combat, which Claude recommended;
  leaving the downtime alone and tuning XP and respawns only, which makes the climb faster on paper
  and still spends most of it standing still.

Claude's, building it:

- **The pace is measured by playing it.** `tests/world/pace.ts` plays a zone from a level to the
  next on the real map with the real pathing and seeded dice: the nearest thing at most a level
  above, abilities as they come up, out of a telegraph where there is the time to leave, and between
  fights a meal, a field fire for whatever dropped raw, or a rest when there is nothing to eat. A bow
  or a staff is fought from its reach on the keys, which keep the target where a tap on the ground
  drops it, and **inside the creature's leash**, since one drawn out of its ring walks home healed. A
  long cast is started only with the room to finish it or behind a shield. `tests/world/pace.test.ts`
  plays every class at every level twice and holds the mean between 0.6 and 1.5 of n + 4, the
  starter arc and the whole climb in minutes, the climb past the arc between two and eight arcs long,
  resting under a fifth of a level once there is food to carry, the rations under a third of the
  coin a level picks up, and no level kept by dying more often than killing. It takes about fifteen
  seconds. `progression.test.ts` gave up its two kill counts that stood in for time and keeps what
  the arcs are made of. **Rejected:** expected-value seconds per kill, which cannot see a walk, a
  knot or a leash.
- **The curve is 100n² − 200** to reach level n (200, 700, 1,400 … 7,900; 26,800 to level 9 where
  it was 22,720). Fitted to what each zone pays a minute, it puts every level within about a quarter
  of n + 4 once the mill road pays less.
- **The mill road's goblins pay a quarter less** (36 at level 4 and 44 at 5, from 49 and 60), since
  a knot of three dies with no walk between them; still more than a level 3 bandit. **Rejected:** a
  bump in the curve, which would show a smaller bar at a higher level.
- **Food**: cooked rat heals 20, fish 30, crab 40 and eel 70, each over six seconds (from 10, 15, 25
  and 45 over ten), about half of what a body at the band's level holds. Bandits and goblin
  scavengers carry cooked fish four times in ten (from 15% and 12%), goblin miners cooked rat half
  the time (12%), fen raiders raw eel four times in ten (18%), and a bog lurker gives up the eel it
  was eating three times in ten, so the fen feeds itself; the barrow and the crawlers feed nobody, and
  a player carries in. The shelf sells raw fish at 6, cooked fish at 12 and cooked crab at 18 (from
  12, 24 and 36). Food still heals only out of a fight.
- **The wizard and the ranger grow six health a level, as the warrior does** (from three and four).
  Measured, both died in two or three blows from a level 8 raider or wight, the wizard most fights in
  the barrow, which the duels never saw because they model a ranged class standing still. The
  classes still start apart, and armour still separates them. **Mana Shield II soaks 70** (from 45),
  so the wizard's survival in the upper band is its own kit's rather than only a thicker body.
- **Found and left:** the barrow kills every class often in the bot's hands (the warrior about
  nineteen times a level, the wizard about thirty-four in fifty-five kills), its wights coming in
  groups through rooms a kite cannot open up; the Deep Cut takes the ranged classes longer than the
  mill road at the same level; and a level 1 character with nothing to eat or light rests most of the
  five minutes the first level takes. The review (C11) and Part G are where these are looked at.

## 123. The rest of version 2 is built several phases at a time, by the rules in `docs/v2_parallel_plan.md`

**2026-10-01 · the user, asked by Claude**

From C11 on, the remaining phases of `docs/v2_plan.md` are built by several agents at once, one
cloud session a phase on a branch named for it, where every phase so far was built one at a time in
one session. `docs/v2_parallel_plan.md` says which phases may run beside which (five at most in a
wave, since the user's time to answer and to play is the bottleneck rather than the agents'), the
files they all touch, and the rules on top of the plan's that make several branches safe to merge
one after another: a save version and a decision number are taken at the merge rather than at the
branch, since both count by one and the migration chain may have no gap; the Record commit is
written after that rebase; a contested file is owned by one phase at a time (Lampton's text is F1's,
the dialog schema D1's until it merges); a review amends its own part and proposes the rest; and the
pace is never moved sideways by a bonus or a consumable. It holds a brief per phase a session starts
cold from. C11 runs first and alone, as the plan's rule that a review precedes the next part asks,
and wave 1's questions are put to the user the same day so its five phases start the moment C11
merges.

**Rejected:** one phase at a time, as the plan had been worked, which puts Parts D, E and F in a
line though none waits on another; numbering decisions and save versions ahead of time in merge
order, which fixes an order nobody knows yet and breaks the chain if a phase slips; starting wave 1
before C11 merges, which risks a review amending a part with a session on it; more than five agents
a wave, which the user's time does not support.

## 124. The Part C review: the barrow's wights come one at a time, a new character starts with food, and the Deep Cut stays the warrior's zone

**2026-10-01 · the user, asked by Claude, building the plan's phase C11**

C11 walked C1-C10 against the pillars and the user's first list at a 390×844 phone and a 1280×800
desktop, every zone from its start and four points across it, and through smoke's screenshots. Part
C's promise held. C10 had left three things the bot found to this review, and the user settled each
on Claude's recommendation:

- **The barrow's wights are spread so they come one at a time.** The bot died in the barrow once for
  every two or three wights it killed. Logged per death, most of those deaths were the king drawn
  into a fight with one of the two wights stood in front of him, a ranged class backing into his
  notice, and the rest were each crypt's pair coming together. Two now stand to a crypt in its
  opposite corners and four down the gallery, each out of the next one's notice, two in the
  antechamber, and the king's chamber is his alone; the sevens still stand above every eight. Deaths
  in a level at 8 fell from 18.5 to 6 for the warrior, 24.5 to 10.5 for the ranger and 34 to 27.5
  for the wizard, whose remaining deaths are to single wights. **Rejected:** rooms opened up so a
  kite has somewhere to go, which re-lays the barrow for the ranged classes alone; leaving it a
  wall for a level 8 to feel.
- **A new character starts with sixteen cooked rats in the bag**, put in by the creation screen
  (`createStartingCharacter`); a level 1 with nothing to eat rested for 66-83% of its first level.
  **Rejected:** logs in the starting bag, which teaches cooking and leaves the first fights a wait
  until the rats drop meat; the first quest paying food, which comes after the fights it would help;
  leaving the start as it was.
- **The Deep Cut stays the warrior's zone.** It takes the ranged classes 9-11 minutes at level 5
  where the mill road takes 7-9, inside the band every level is held to, and a zone that suits one
  class better is a reason to choose where to fight. **Rejected:** tuning it for the ranged classes.

The user found nothing else to name from play, so the walk decided the rest.

Claude's, alongside them:

- **A level 1 rat pays 2 XP** where it paid 5, and the rat cull pays 25 XP where it paid 40. With
  food in the bag the first level is fighting rather than standing still, and the ranger, which a rat
  barely touches, took it in two and a half minutes against the five decision 122 asks; the rat's
  pay is what moves only the first level, and the cull must still pay less than its kills
  (`BountySystem.test.ts`). Sixteen rats rather than fewer is what brought the warrior's resting down
  from most of the level to a third of it.
- **The pace bot carries thirty crabs into the barrow**, not twenty. It had been dying its way back
  to full health there, and with the wights singly it ate its twenty and rested a third of the
  level; thirty costs about a sixth of the coin the level earns.
- **`createNewCharacter` still starts empty.** The bag's food is the creation screen's, so every test
  that builds a character from it still starts from an empty pack.
- **Two names on one line keep a word's space between them** (`PLATE_GAP` in `render2d/plates.ts`).
  The walk found Lampton writing "Cottage Rat (Lv 1)" on a desktop, a sign and a rat's plate end to
  end a space apart; a plate that would stand closer than a space beside one already stood is lifted
  as an overlapping one is.
- **What a zone costs**, the number Part G is sized from, is written into the plan's C11 entry from
  the commit record: about half an hour a zone rebuilt, and two to three times that for a zone of new
  content, so an hour and a half to two hours, plus a phase for each gear and making tier. Parts D-F
  are kept as planned, since wave 1 is already on them.
- **Found and left:** the wizard at 8 still dies about once in two kills to single wights, and the bot
  dies often outside the barrow too, in the mill road's knots and the camp most, which the pace test
  allows (fewer deaths than kills); G1 and G2, which set the wizard's climb past 8, are where it is
  looked at again.

**Rejected:** a smoke section of its own for the walk; its script, which drops a character into each
zone through the save, was scaffolding for the review, as A10's and B9's were.

## 125. Each wave merges through its own branch, numbers are reserved at launch, a wave's questions are answered before it launches, and the orchestrator merges phases without the user

**2026-10-01 · the user, asked by Claude, after wave 1 opened five PRs that each needed a rebase**

Wave 1 showed what decision 123's rule 3 costs: five phases finished within an hour of each other,
each took decision 124 and save version 103, and each needed its session woken to rebase and
renumber before the user could merge the next, with the user asked to merge five times. The user
wants a wave launched and merged without their input and one review at its end, and settled four
forks, each on Claude's recommendation but the last:

- **A branch per wave.** `claude/v2-wave-N` is cut from `main` when a wave starts; each phase
  branches from it and its PR targets it (CI runs on a pull request whatever its base, and nothing
  but `main` deploys); the orchestrator merges each phase into it as it goes green; and one PR, the
  wave to `main`, goes up at the end for the user's review, so a wave deploys once. **Rejected:**
  phases merging straight to `main` with the orchestrator merging at its check-ins, which deploys
  every phase and leaves nothing for one review.
- **Numbers are reserved at launch.** The orchestrator assigns each phase its decision number, and a
  save version where its brief says it changes the save, in launch order, written into its launch
  prompt, and merges phases into the wave branch in that order, so nothing ever renumbers. A phase
  that stalls is dealt with then: a message to its session, or its number given to the next.
  **Rejected:** numbers taken at the merge by the orchestrator in the merge commit, robust to any
  order but running the full gates on every merge.
- **One question round before a wave launches.** The orchestrator compiles the wave's briefs'
  questions, the user answers once, the answers are written under each brief before the wave branch
  is cut, and a session builds without asking; a fork a brief did not foresee is settled on the
  recommended option and recorded in the decision for the user to overturn at the wave review.
  **Rejected:** sessions asking in their own session and waiting, which means checking on each.
- **Wave 1 moves onto a wave branch.** Its five green PRs are retargeted to `claude/v2-wave-1` and
  merged there by the orchestrator with their numbers reserved (D1 126, E1 127, D4 128, E2 129,
  F1 130, and save versions 103 to 107 in the same order), and one PR goes to `main`.
  **Rejected:** finishing wave 1 to `main` by waking each session to rebase, which Claude
  recommended, five deploys and the churn the branch exists to avoid; the user merging the five by
  hand.
- **Check-ins every 30 minutes**, from 60.

G1, launched before this under the old rule, keeps its PR against `main` with decision 131 reserved
and no save version, merged after wave 1's PR so the decisions stay in order. Wave 2's numbers are
reserved in its launch order: D2 132 (save version 108), D3 133 (109), D1b 134, E3 135, F2 136 and
F3 137 (110). The orchestrator is the session that proposed decision 123, woken every half hour.

## 126. A person is their name with their trade beside it, talks in topics written as data, and remembers what they were asked for good

**2026-10-01 · the user, asked by Claude, building the plan's phase D1**

D1 fills the talk panel A4 built (decision 92) with conversations. The user settled four forks at
the start of wave 1, each on Claude's recommendation:

- **The name alone over the head, the trade beside it on the card, the map and the talk panel.**
  The six townsfolk take their lore names (`docs/lore/places.md`), and `NpcDefinition.trade` keeps
  what they do somewhere a player looks, as pillar 1 asks; a line that names a person for an item
  or a tip names them with it ("Silas Quill the fettler"). **Rejected:** "Tilda Pell, Shopkeeper" in
  one line everywhere, the plate included.
- **A person remembers for ever**: the answers heard are stored on the character
  (`CharacterState.asked`, save version 103), and a topic is grey while the answer it would give
  has been heard, until a quest or a level gives it a new one. **Rejected:** remembering per visit.
- **The five people the lore places and the game lacks are D1b's**, run in wave 2, since a person
  with no counter is a new kind of row and the crow a new shape. **Rejected:** all five in D1.
- **An answer does nothing yet**, and the schema carries `requires` and `effects` from the start
  for D2 and D3 to fill. **Rejected:** a flag or an item handed over by an answer in D1.

Claude's, alongside them:

- **A topic has answers, and the last whose conditions hold is said**, so newer news is written
  later and a topic grows rather than being replaced; a greeting is chosen the same way, which is
  how the quartermaster's tone at level 7 is not his tone at level 1 (`tone.md`'s rule 6). What is
  remembered is the answer, not the topic, which is what lets a topic come back. **Rejected:** a
  tree of nested replies, which a save cannot name a place in without a path.
- **A topic leads on by `follows`**, another of the same person's asked first, and may wait on a
  level, a class, a quest's state or a topic asked of somebody else. `requires` is a union so a
  standing (D3) or a rumour heard (D2) is a member and a case in `DialogSystem.holds`; `effects` is
  `never` until D2 or D3 adds a member, and `TalkSession.apply` stops compiling when one does.
- **What is on offer is derived** by `DialogSystem` for the world and the panel alike, and the world
  checks every request against it, so a topic drawn from a stale model is refused. What is being
  said this visit is the session's and forgotten at the end of it: the next visit opens at the
  greeting. The events carry ids, not words.
- **Topics are drawn between what is said and the counter button**, the quests under both.

## 127. Idle banks rested by time, open or closed, to half a level; XP earned by hand pays double while it lasts, and idle's own never spends it

**2026-10-01 · the user, asked by Claude, building the plan's phase E1**

Decision 85 gave idle and active play each a reason the other lacks, and E1 is idle's gift to active
play. The user settled seven forks: four asked by the brief, three met building it, each of those
three on Claude's recommendation.

- **Banked by idle with the game open and by a parked night**, both. **Rejected:** idle with the game
  open only, which leaves a night away worth nothing to the player who comes back.
- **Capped at half a level's worth**, the share a parked night's XP is held to (decision 15), so the
  two move with the curve together. **Rejected:** a fixed number; a whole level.
- **Character XP alone.** **Rejected:** skill XP as well.
- **A paler segment ahead of the XP bar's fill.** **Rejected:** a tint on the bar while it spends.
- **It doubles XP earned by hand while it lasts**, the bank paying the bonus. **Rejected:** half
  again, which spreads the same total thinner; triple, a short burst.
- **It fills in a night**, the eight hours a parked night counts, at the same rate open or closed.
  **Rejected:** full in two hours, which wastes most of a night; full in a day.
- **Contracts count as quests**: a kill made by hand, a quest and a contract handed in all spend it.
  **Rejected:** kills and quests only.

Claude's, building it:

- **It banks by time, not by what idle earned**, so a night at the forge or a bow out of arrows
  banks the same as a night of kills. Rested is the time away; what idle earned is its own reward.
- **Idle's own XP never spends it**, awake or parked: a camp paid in rested as well would be idle
  paying itself back. Rested rides `awardPlayedXp`, and idle's XP goes through `awardXp`, which
  leaves the bank alone. The parked payout has an `awardIdleXp` of its own, since it runs on a boot
  where idle is off and would otherwise be taken for a kill made by hand.
- **The parked session counts what idle banked before the tab closed** (`AfkSession.restedMs`), since
  a closed game is paid from when idle started; without it an evening watched and then left running
  overnight banks twice. **Rejected:** banking only when idle stops, on the wall clock, which leaves
  the bar still while idle runs and breaks the rule that the world's clocks are frame accumulators.
- **The segment reaches as far as the bank carries the bar**, twice the bank while it doubles, so
  its far end stays put while it is spent; the bar's line names the bank in place of the percentage.
- **The skills book says nothing of it**, since it is character XP and the book is skills; the idle
  panel says what idle banks, off the same constants.
- **The pace bot plays unrested** and the bands did not move (rule 8 of the parallel plan).
- Save version 103, a step from 102 that banks nothing and treats a night parked before it as
  unbanked.

## 128. Wick is drawn in the world and says what it has when tapped, on the card; quiet is the tips alone; underground its light is the only one; its waking is the one line said unasked

**2026-10-01 · the user, asked by Claude, building the plan's phase D4**

D4 draws the spirit (decision 87) and hands it A9's tips. The user settled six forks, four at the
start of the wave and two met in the building, each on Claude's recommendation:

- **Wick speaks on the card as it is**, under its name and edged in its light, and **the spirit in
  the world glows and chimes when it has something to say**. **Rejected:** a bubble drawn in the
  world by the renderer beside the spirit and laid out with the name plates, which moves with it
  but is a second place the game talks in, and one a fight draws over.
- **What Wick has to say waits for a tap on it**: a tip, or a beat of its story, glows until asked.
  Two things come unasked: its waking, which is how a player learns the light can be tapped, and a
  secret's line, which is the reward for the walk. **Rejected:** the card coming up on its own as
  A9's did, with Wick glowing beside it, which leaves the light nothing to be tapped for; and a card
  that waits a minute and then comes anyway, which is a toast with a delay.
- **Go quiet silences the tips alone**: the story still comes, since it is the spirit being a
  character rather than advice. It is `tips.off` as it was, renamed on the card and in Options.
  **Rejected:** quiet silencing the beats too.
- **Wick is the light underground**: the lantern's pool is centred on the spirit and glows its
  blue-white. **Rejected:** a lantern carried beside a spirit, two lights where decision 59 keeps
  one.
- **A tap on Wick waits while a counter is open**: it is said, and the card holds until the counter
  closes, as it holds for any overlay. **Rejected:** Wick untappable at a counter.
- **The spirit is a sprite kind of its own** in the budget: 16×16, not outlined, one loop of four
  frames at 200ms, its calling a second, brighter sprite rather than a second animation, so the
  kind keeps one clock. **Rejected:** reusing the mark kind, which is light lying on the ground.

Claude's, building it:

- **Nine beats before Part G**, from `docs/lore/spirit.md`'s table: its waking first, wherever the
  character is, then one a zone on arriving, and Orlath's once he is down. **Where a memory is a
  thing, the secret it is says it**, and the zone's beat only leads up to it, so the five secrets
  that already carried the stone, the cell, the coin, the ring and the door keep them. Which beat is
  waiting is derived from the beats heard, the kills and the zone; only what was heard is stored
  (`CharacterState.beats`, save version 103). **Rejected:** a beat on a secret found, which leaves a
  player who never finds it without the rest of the story; beats held strictly in order, which a
  missed one would stop for good.
- **With nothing waiting, a tap gets a line of its own** about where it is, two a zone, taken in
  turn and remembering nothing.
- **It follows on a lag and never routes**: straight at a spot off the left shoulder through any
  wall, a share of the gap a frame worked out from the frame's length, there at once past four
  tiles. **Rejected:** a `Chase`, which it has no reason for, since nothing can stop a light.
- **It is picked after the creatures and before the stations**, by a box round the light where it
  floats, since at the shoulder is where a creature fighting the player stands. **Rejected:** above
  the creatures, which would eat the tap on the rat.
- **A tap on Wick takes nothing back**: it ends no camp, walk, gather or target, unlike every other
  tap on the world.

## 129. Potions: foraging and brewing at a still, four potions one kind each, their clocks kept on the character and honoured away

**2026-10-01 · the user, asked by Claude, building the plan's phase E2**

E2 is decision 85's other half, potions brewed in active play that boost idle gains. The user settled
the brief's four questions with wave 1's answers, and four more at the start of the phase, each on
Claude's recommendation:

- **Herbs come from a fourth gathering skill with nodes and a tool of its own**, foraging and the
  sickle, sold at the shop like the other three; **potions are brewed at a new station, a still**,
  drawn in this phase and placed at Greyford; **one potion a kind**: gathering speed, a fight, idle
  XP, and luck on a roll; **herbs grow in the fen and on the mill road's bank, a low one on the
  strand, and none in Lampton**. **Rejected:** herbs off existing nodes and drops; brewing at a
  campfire, which would make the fire two skills' station; herbs everywhere.
- **A potion works through a closed game for the time it has left.** Its clock is saved on the
  character, and a night away pays Keeper's Watch and Quick Hands for those minutes, under the same
  ceilings. **Rejected:** an open-game potion whose clock pauses when the game closes; one whose
  clock runs on in real time and is wasted.
- **Keeper's Watch lifts idle from half of active XP to three-quarters**, the away ceiling unchanged,
  so idle stays behind active (decision 15). **Rejected:** idle matching active while it lasts; three
  quarters and a higher ceiling.
- **The fight potion takes the edge off hits**: armour, about one piece of the band's gear.
  **Rejected:** more attack power; a heal over time that works in a fight, the one thing food cannot.
- **The luck potion betters both rolls**: the second one off a gather or a job, and each drop.
  **Rejected:** drops only; the second-one roll only.

Claude's, building it:

- **The ladder is one herb a band**: samphire at foraging 1 on Candle Strand, meadowsweet at 4 on the
  mill road's banks, bog myrtle at 6 and bogbean at 8 in the fen; brewing makes one potion a herb at
  1, 3, 5 and 7, and **the upper two each take a herb from the rung below**, so the strand and the
  mill road are not retired the day the fen opens. A failed brew keeps the herbs. A patch is walked
  through and cut out in three. The still stands in Greyford's yard below the ford, reachable from
  the starter band without a fight above it.
- **A potion is a fifth kind of item**, drunk at full health or in a fight, since it heals nothing.
  **Quick Hands** takes a fifth off a gather for ten minutes; **Dulled Pain** adds five armour for
  three, which the duels hold to winning none of the contract's losses; **Keeper's Watch** lasts
  thirty; **Fortune** adds a tenth to the second-one chance and makes each drop a quarter likelier,
  capped at certain, for ten. A second of a kind starts the clock again rather than stacking. Each
  sells for a little over its herbs.
- **The clocks live on `CharacterState.potions`** and run on game time; a parked session spends them
  by the time it was away. The fight and luck potions do nothing offline, where a night is a rate.
  The idle panel says which potions are running and whether each counts away. Save version 103.
- **Named from the lore** (decision 114): the fenfolk's brewing, written into `peoples.md`, and the
  herbs and the still into `places.md`.
- **Found and left:** the steel tools' `gatherSpeedBonus` is never passed when a gather begins, so it
  does nothing in play; queued as its own task rather than widening this phase.

## 130. The house is the Surveyor's House, let by a quest for timber; trophies stand on stands and come back on a tap; the chest is eight kinds; the plaques hang themselves

**2026-10-01 · the user, asked by Claude, building the plan's phase F1**

F1 puts the house in Lampton (decision 88). The brief's four forks were settled with wave 1's
answers: **the house is granted by a quest from the quartermaster after the starter arc**, the
Company's plot; **a stand hands its trophy back on a tap**, so displaying is not spending; **the
chest is a fixed small store** and the bank is still the vault, F2 free to grow it; **no station**
until F2's workbench. **Rejected:** a house standing empty with the player's name on it from the
start, or bought for coin; displaying as spending; a second bank with slots to buy; stations now.

Four more the user settled when they were met, each on Claude's recommendation:

- **The quest asks for twenty logs** (A Roof in Lampton, after The Cutthroat), the roof wanting
  mending before anybody lives under it, and pays the house and 50 XP. **Rejected:** a deed fee, the
  first quest to cost coin and a new kind of objective; twelve goblins for the Company; the house for
  the asking.
- **The two capstone quests each hand over a keepsake**, a new item kind with no price, good for
  nothing but a stand. **Rejected:** no keepsakes until Part G; a keepsake from the plot quest too.
- **Four stands and a chest of eight kinds.** **Rejected:** six and twelve; three and six.
- **The plaques hang themselves**: one a creature at the highest slayer rank earned, derived from the
  kills. **Rejected:** hooks the player chooses plaques for, which would be one more stored choice.

Claude's, building it:

- **Whose the house is is derived**: it is the player's while the quest whose reward names the house
  is done. Only what stands on the stands and what is in the chest is stored (`CharacterState.house`,
  save version 103). **Rejected:** a flag set on turn-in, a second record of the same fact.
- **The fixtures are data** (`data/house.ts`), not the renderer's furniture, because they are the
  first things in a room anybody taps: the world walks up to them and the view draws them where the
  world says. They are a new tappable kind, picked from inside the room only and ranked above the
  building, and a `HouseSession` collaborator owns what is open. **Rejected:** the chest as a counter
  with nobody behind it, which would give the counter table a row with no person; fixtures written
  into Lampton's text, which would place the house twice.
- **The walk to a fixture is aimed at where a body stands to use it**, half a tile off its wall
  inside the room, after the first walk aimed at a corner stand went round the outside of the house:
  A\* walks tile centres, and the nearest centre to that stand was outside the side wall.
- **The house stands at the east end of the counters' row**, its door on the high street, and the
  cottage behind it moved up a row. **Rejected:** south of the street, first in the general store's
  lane and then by the pond, where it pushed the wizard's first level past the pace test's bound.
- **The trophies are every boss drop and every keepsake**, read off the tables, and a trophy's card
  says where it goes, before the house is the player's as well. The lore gained the Surveyor's House,
  and where the two keepsakes come from.

## 132. Whispers: a rumour for every secret and boss and none for what is not built; lore at a secret, off a boss or in an answer; the journal stored in the order it came

**2026-10-01 · the user, asked by Claude, building the plan's phase D2**

D2 is decision 87's one journal of rumours and lore. The brief's three forks were settled before
wave 2 launched:

- **Rumours only for what exists** (the user's, on Claude's recommendation): one for each of the
  fifteen secrets and one for each of the two bosses. The rest of `docs/lore/places.md`'s rumours
  are held there, marked, until Part G or D1b builds what they lead to. **Rejected:** a rumour that
  cannot yet be followed, as a promise, which the dead-end rule (decision 14) refuses.

Two the user declined to settle, so taken on Claude's recommendation for the wave review to
overturn:

- **A fragment is found at a secret, off a boss or in a line of dialog**, all three: fifteen at the
  secrets, Hollis's and Orlath's off them the first time each falls, and two in answers.
  **Rejected:** any one of the three alone.
- **The journal keeps its own counts and pays nothing else**; the collection log (F3) reads them.
  **Rejected:** XP or coin for lore, which would put a second reward on a secret that already pays
  its cache, and move the pace.

Claude's, met building it and settled on its recommendation:

- **Heard and found are stored, in the order they came** (`CharacterState.whispers`, save version
  108), rather than derived on read from the answers heard, the secrets and the kills, each of which
  could say whether. The journal draws newest first and none of those keep an order between them, and
  a stored rumour stays told when an answer is rewritten. What it means is still derived: a rumour
  is **followed** when its secret is found or its creature killed, and the counts are the tables'.
  **Rejected:** deriving the whole journal and taking no save version.
- **An older character's journal is filled from their past** by the step from 107: what they had
  asked, found and killed, in the tables' order. **Rejected:** an empty journal for somebody who has
  already found ten secrets.
- **A rumour is told as an `effects` member on an answer** (D1's slot), and a fragment learned in
  conversation the same way; the rumour's row names its teller, and a test holds that only that
  person's answers carry it, as one holds every lead to a secret or a spawned creature. A rumour may
  ride more than one of its teller's answers, so a topic whose later answer is the one heard still
  tells it. **Rejected:** a rumour heard by talking to anybody at all, with no line to say it.
- **The six townsfolk tell all seventeen**, since the lore's other tellers (the fisher, Pocket, Tirrow
  and Maren) are D1b's people: six were already in their lines, and eleven topics were written for
  the rest, each in the teller's voice. **Rejected:** waiting for D1b.
- **A rumour never names where it leads**, followed or not; the journal says who told it and whether
  it was followed, and the line says as much as its teller did. **Rejected:** the secret's name once
  followed, and the zone beside every rumour, which is the walk done for the player.
- **A boss's fragment is found by any kill credited**, a camp's as well as a hand's, since
  `CombatDirector.creditKill` is where a kill is counted.
- **The journal is Whispers behind Menu**, a candle its mark and J its key, and something noted is
  said once on the toast and once in the log. The pace bot reads none of it, and nothing moved.
