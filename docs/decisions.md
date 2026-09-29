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
