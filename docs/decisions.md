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
