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
`docs/zones_act_two.md` warned it would be.

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
`docs/interiors_and_light_plan.md`.

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

**2026-09-01 · Claude · reverses a line in `docs/interiors_and_light_plan.md` phase 1**

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

**What it costs:** phase 4 of `docs/interiors_and_light_plan.md` asked to find out whether a doorway
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
