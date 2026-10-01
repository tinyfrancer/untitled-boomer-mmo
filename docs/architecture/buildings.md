# Buildings and rooms

Walls, doorways, rooms you can walk into, counters inside them, the cutaway, the room light, and line of sight.

_Moved out of `CLAUDE.md` on 2026-09-25 (`docs/decisions.md` 57). The paragraphs are the ones that were there, in the order they were there; `CLAUDE.md` keeps the rules and points here for the reasoning. Where this and the code disagree, the code is right — and this file is what should be corrected._

**A town has walls in it, and a building is a shell rather than a solid mass**
(`ZoneDefinition.buildingSpawns` into `data/buildings.ts`, drawn by `art/building.ts` and
`render2d/buildings.ts`). It is
written into its zone's text as a block of its letter exactly its footprint, so it stands on tile
lines (decision 113), and blocks as `CollisionSystem` blockers beside the tree trunks rather than as
painted-in `WALL_TILE`, because it is a shell with a door in it and a tile is solid or not. What it
hands over is `buildingWalls`: three whole walls plus the door wall in the
segments either side of its opening, which run the full span of the footprint and so overlap at the
corners — free, since being inside two blockers is the same as being inside one. `buildingRect` is
still what a thumb aims at and what hides the player, so the three questions one rectangle used to
answer are two questions now.

It was solid until a walk could route round a corner, and the argument for that is `docs/decisions.md`
25 and 40-47. Five rules follow, and `tests/systems/BuildingSystem.test.ts` holds them because
nothing else can see any of them:

- **Every building in the game can be walked into**, proved by routing a body from the zone's spawn
  point to the middle of each one. It is the sharpest test of the hollowing because it fails for
  every way of getting it wrong at once: a doorway too narrow for the body, a wall drawn across its
  own gap, a room too small to stand in, a door facing something solid. The lane-clearance rule below
  used to be a proxy for this; with a pathfinder it is the real question.
- **A doorway is `MIN_DOOR_SPAN` — two tiles — or the wall is simply open.** `doorGap` takes the
  lesser of that and the wall's own length, so a two-tile wall has no segments at all. Three
  buildings are in that case (the smithy, the inn and the cottage), and town has no room to grow
  them: a three-tile cottage was tried in every position the south-west corner allows and each one
  put a rat's wander disc or a tree's working ground inside a wall.
- **Every counter can be walked up to**, which is the same sweep asked of the person rather than the
  room and is not the same question: a route into a building ends wherever the middle of it is, where
  a route to a counter has to end on a spot chosen for somebody to stand at. That is what
  `counterPoint` is for — a tile back from the middle of the room, capped at its half-depth. Pushed
  further back it lands in the wall's own tile row, and since A\* walks tile centres that is a spot
  with no cell to reach it through: `findPath` then answers `null` for the whole walk rather than for
  its last few pixels.
- **Nothing else in a zone may stand inside one** — not a mob spawn's whole wander disc, not a node,
  a station, a signpost, or the band a traveller arrives on. A rat inside a wall is drawn inside it
  and never wanders out to prove it, the way a misplaced vein never does. The counters are the
  exception and are the point: a shop is a room with somebody in it.
- **Every counter's door faces the open ground it is approached across**, measured out from the
  doorstep along whichever way the door faces, and the lane is clear of every other building. That
  decides where a shopfront may be built rather than the other way about, and it is why the town is
  one high street with the counters along the north side of it: the camera looks north, so a
  building's south face is the one a player sees and taps, and due south is where a tap comes from. Only the buildings somebody works out of — which way an empty
  house faces costs nobody anything, and the cottage north of the quartermaster's post fronts
  straight onto it.

**A tap on a shopfront is a tap on whoever works behind it** (`BuildingSprite.tapAnswer`, and
`docs/decisions.md` 45). A building is picked below everything but a loot pile — below even the
forge — and it answers as something else rather than with a kind of its own: the person inside, or
the **ground at its door** for the ones nobody works out of. The counter comes first because from
outside there is no pixel a thumb could put on one — the roof is drawn over the room and the pick box
is the whole of the building as it is drawn, so _every_ point on the inside is the building's. A tap
on the figure's own box says `npc` too, so the two agree instead of offering a thumb two answers
depending on where a box happened to fall under a roof.

**Going indoors takes two taps, and the second one has no other way of being asked for.** Where
nobody works, a tap is the doorstep — and the room instead, once the player is within a tile of that
doorstep. Walk to the shop, then go in. It outranks the counter, which is what keeps a room reachable
in the two huts whose counter is served from the threshold. From inside, `pickRect()` answers `null`
so a tap on the floor reaches the ground. Without all of that the rooms would be reachable by
keyboard alone, on a game laid out for a phone.

**Standing in one cuts it away rather than fading it** (`BuildingSprite.sync`, called once a frame
before anything is drawn). The roof and the front come off outright, because a roof faded still
reads as a lid; what is drawn instead is the room's floor with the ground, the tops of its walls,
and only **the back wall standing**, open where a north door is in it (`art/building.ts` bakes the
three pictures once a zone). The fade is not asked of a building the player is inside, since the
back wall left standing is the whole of what the room is read against. The 3D view took away
whichever walls its turning camera had got past the plane of; a camera that never turns always
looks in over the south wall, so the cutaway is one picture rather than a test.

**Nothing else is drawn over the room while the player is in it** (decision 112). A roof stands up
the screen from its footprint, so a building close in front of a room reaches over it: the training
hall stands half a tile south of the smithy, and from inside the smithy its roof, faded, lay across
the floor with "Training Hall" written over it. Any other building whose picture meets the room
(`roomRect`, the floor and the back wall) is drawn with the room clipped out, and a sign that would
be written in it is left off. It is a rule of the view rather than a rule of layout, so a zone laid
out close, as town is and Part C's may be, needs nothing moved for it.

**A door may face away from the camera, and the fettler's store at Greyford does it on purpose**
(decision 120). It stands against the back of the longhouse with its door in its north wall, as the
inn's is, so from the yard it is a roof showing over the longhouse's and no door at all: a wall is
52 art pixels tall, so the longhouse's roof is drawn over the whole of the store's footprint, and
only the store's own roof above it is the store's to pick. A tap there walks round to the doorstep
behind it, and a second goes in. **A secret may lie in a room** (decision 120), written into its
building's block in the zone's text, and is found only by somebody inside that room
(`WorldSecret.room`): a wall is a quarter of a tile and the reach a tile and a quarter, so without
it the back room would be found from the longhouse in front of it. What it is drawn as stands with
the room's furniture, sorted by its foot, and is hidden under the roof like the rest of the room
until somebody is in it.

**A room has a floor and a few things standing against its walls, and none of them block**
(`art/rooms.ts`, decision 109, moved out of the 3D view in B6). What is in a room is
keyed by the building's shape the way its colours are — shelves in a hall, a bench in a workshop, a
bed in a cottage — with a per-`BuildingId` override table beside it for the two rooms whose whole
character is the thing burning in them, the smithy's forge and the inn's fire. It is the renderer's
own, like creature colour: nothing here blocks, is gathered, is tapped or is stood on, so the
simulation has no opinion about any of it.

Not blocking is the room's arithmetic rather than a shortcut. A three-tile shop is 160 units of floor
with the counter a tile back from the middle and the customer `NPC_INTERACT_RADIUS` in front of it —
the two people fill it end to end — so a blocking fitting is a cell A\* refuses and `findPath` then
answers `null` for the whole walk. What keeps that from being a wall drawn where there is none is
`FITTING_DEPTH`, which is the thickness of the wall a fitting stands against and is **measured off
the smallest room in the game**: a body in the middle of a two-tile hut leaves sixteen units to
either side. `tests/art/rooms.test.ts` puts a body on all three spots the game stands
somebody on — the middle of the room, the counter, and where the walk to that counter ends — and
fails on anything deeper.

**The house is the one room whose furniture is tapped** (decision 130, `data/house.ts`). The
Surveyor's House is let to the player by a quest, and stands four stands, a chest and a wall of
plaques against its walls. Where each stands is data rather than the renderer's, since the
simulation walks up to them: `HOUSE_FIXTURES` places each in the house's frame, `FITTING_DEPTH` deep
against its wall, the house's door south and its west wall the bed's (`art/rooms.ts`). None blocks,
as nothing in a room does. **The walk to one is aimed at where a body stands to use it**
(`fixtureAccess`), half a tile off its wall inside the room, not at the fixture: A\* walks tile
centres, and a stand in a back corner is nearer the middle of the cell outside the side wall than of
any cell inside, so a walk aimed at the stand went round the outside of the house and pressed against
its wall. `tests/world/house.test.ts` walks a body from Lampton's start to every fixture and holds
each in reach, and holds their ground clear of the middle of the room, of the way in and of each
other. What is open closes when the player walks out of the house, rather than at a distance, since
everything in it is a few steps from everything else.

**The house grows into a second building, not a second room inside the first** (decision 136). The
Drawing Room stands against the back of the house, written into Lampton's text with it from the
start, its door in its west wall onto the yard since the house is against its south wall. Every
question the game asks of a room, from the cutaway to whose roof is drawn over it, is asked of a
building, so a room behind a partition would have been the one place each of them had a second
answer. **A room shut until a stage is built has its doorway walled up**: `doorPlug` is the gap
filled in at the wall's thickness, a blocker in the collision world until the stage is bought, taken
out of it then (`ZoneWorld.raise`); a walk ending inside it is refused with a line saying what opens
it. From the street its north half is all that shows over the house's roof, which is where a tap on
it lands, as the fettler's store shows over the longhouse. **The plans are a fourth kind of
fixture**, on a table at the south end of the house's west wall, where the stages are bought; the
drawing room's stands are fixtures in its own frame, two with the room and two more as the last
stage, and the yard's beds and bench are placed off the house as the fixtures are and swept by
`house.test.ts`, since the zone's sweeps read only its text. **A body walking out through a two-tile
doorway from beside it lands on its leg** once a wall leaves it within half a pixel of it
(`Player.landOnLeg`): the route runs a body's half-width off the wall's end, and a body sliding
along the wall toward that with its other axis blocked closed a share of the gap each frame and
stalled a hair inside the wall's end for good.

**The view draws each fitting by its wall, and a counter** (decision 109, `docs/architecture/art.md`
under Places): each fitting against its wall from the front, along its length on a side wall, and
only as low as it stands against the south wall the cutaway takes away; and in front of whoever works
in a room, toward the door, a counter they are served across, short of where the walk up to them
ends. None of it blocks and none of it is drawn until the player is inside, as the floor is, and
`tests/art/rooms.test.ts` also holds that nobody standing on the three spots is drawn in the
furniture, which is the same rule asked of the drawing rather than of the ground.

**A room costs a frame nothing until somebody is in it.** The 3D view lit the room being stood in
with one light moved from room to room, since its cutaway took off the roof that shaded it and left
a room in full sun, and the lamp was the whole of what told an interior from the grass outside. The
2D view has no light to move: a room is told from the grass by its floor of planks and the walls
ringing it, lit from the top-left as everything is, and a doorway seen from the street shows the
room with a lantern lit on its back wall (`art/building.ts`). The floor, the back wall and the
furniture are drawn only while the player is inside, so a zone full of rooms draws none of them from
the street.

**A room is also somewhere to be out of sight, which nothing in the world was before.**
`hasLineOfSight` in `CollisionSystem.ts` is the same blockers asked about a segment rather than about
a body, and `CombatDirector` asks it twice per enemy ability: before a wind-up, so a telegraph that
could never land is never shouted, and again when it resolves, so stepping behind a wall during the
shout is a dodge. It is deliberately **not** asked of an auto-attack in either direction — a tree
trunk is a blocker exactly as a wall is, so gating every swing would make every tree in the game
something to fight around, which is a retune of the whole of combat rather than the fix to a bug the
hollowing created. Two more things ask it since creatures learned to walk round things (decision
116): **an aggressive creature notices only a player it can see**, so a building is cover to pass a
camp behind; and **anything closing on another stops only in reach and in sight**, a creature on the
player and the player's pursuit alike, so a wizard at the back of a room walks out and round to what
they tapped behind its wall rather than stopping against it. A swing still asks nothing: no creature's
reach is longer than a wall's quarter tile and two bodies, so there is no swing through a wall for it
to refuse.

**A room too narrow for a creature is somewhere it gives up on you.** A route may not turn a corner
without a quarter tile to spare on each side (decision 35), and a rat, a tile and a quarter long, has
an eighth of a tile each side in a room two tiles wide: the cottages and the inn. A chase that cannot
get there goes nowhere, and a creature whose chase has gone nowhere for two seconds goes home
(decision 116). Everything the player's size follows them into any room they can walk into. The segment test is exact rather than sampled, because the thinnest solid thing in
the world is a wall at a quarter of a tile and a sampling step fine enough for that is a constant
that quietly stops being fine enough the day something thinner is built.

The smithy is also the one door in town that does not face south, and for a reason worth keeping: a
door faces the open ground its station or counter is approached across, and in that corner the only
open ground left is west. A south-facing door there would have put the forge on the training hall's
roof.

It is also the first thing tall enough to hide the player outright, so the view fades it to half while
the player is behind it, as it fades a tree's crown — and it is the only thing whose box for hiding
the player and box for a thumb are one box, the building as it is drawn, since it has no canopy to
walk under and no trunk to be stopped by. A building need not have anyone behind it or anything to tap: `mill` on the
Old Mill Road is pure scenery, which is the thing a zone could not have until it could have buildings
at all. The name over the ridge is counted as a `sign` rather than a `label` for the reason a
quest marker is counted as a `marker`: `drawnCounts` counts one label per drawn _creature_ and
`scripts/smoke.mjs` asserts that total in every zone. That name and the trade hung by the door
(`BUILDING_SIGNS`) are how a player tells the bank from the store, which is why `BUILDING_LOOKS` is
keyed by shape and gives four shopfronts one kit — four in four colours would read as a fairground.
