# Rendering

The view: the canvas and its scale, the camera and the tab bar, painter's order, the ground, what
stands and what hides the player, the words over heads, the moments, picking, gestures and the
menu, what the view holds, and what a frame costs.

_Moved out of `CLAUDE.md` on 2026-09-25 (`docs/decisions.md` 57), when the game was drawn in 3D.
Rewritten in version 2's B7 (decision 110), when the 3D view was deleted: the paragraphs about the
game rather than the engine (the tab bar, the priority a tap is picked in, the gestures, the menu,
the loot pile) are kept, said of the flat view, and everything about meshes, light and a turning
camera went with Three.js. `docs/architecture/art.md` is what the view draws; this is how it draws
it. Where this and the code disagree, the code is right — and this file is what should be
corrected._

## One view

**The world is drawn by `src/render2d/`, and nothing but `main.ts` knows it is there.**
`ZoneView2D` answers the `ZoneView` interface (`host/zoneView.ts`) the host is built with, and
the host owns the frame loop, the pointer, the keyboard, the HUD and the sound around it. The
interface was drawn in B2 so that two views could answer it while version 2 moved from Three.js to
Canvas 2D, and it stays with one because it keeps the host free of anything the view is drawn with.
`tests/architecture/seam.test.ts` holds the seam three ways: nothing in `src/` imports a package,
`package.json` has no runtime dependency, and `render2d/` is imported by `main.ts` alone. The
browser is the engine: the art is data (`src/art/`), the sound is recipes (`src/audio/`), and the
view draws with the canvas every browser has.

**Version 2 is drawn with Canvas 2D** (decision 101), chosen by the spike B1 was asked to run
against Three.js with an orthographic camera and PixiJS. The three drew the same scene, a zone at
C1's size with 60 and then 150 figures, their shadows and nameplates, ten effects and the lantern,
under the eight-times CPU throttle smoke's budget is asserted at, and Canvas 2D was the cheapest by
every measure: under a millisecond a frame against two for PixiJS and three to four for Three.js,
still the cheapest by two and a half times with each frame forced to finish, and the only one whose
frames kept pace. It adds no dependency, where the others add 100 kB or more. Headless Chromium has
no GPU, so those numbers are software drawing both ways, not a phone; they are the numbers the
budget is asserted on, and on a phone Chrome and Safari draw a canvas on the GPU.

**The canvas is drawn at art resolution and scaled up by whole device pixels** (`render2d/camera.ts`,
`docs/architecture/art.md` for why whole). `pixelScale` picks the whole number of device pixels to
the art pixel that frames closest to ten tiles across the screen's smaller side, **and never more
than two CSS pixels to the art pixel** (`MAX_CSS_PER_ART`, decision 112); the canvas is as many art
pixels as the screen holds, rounded up, and its CSS size is that times the scale, a hair larger
than the screen where the art pixels do not divide it, the overhang cut off by the page rather than
the pixels stretched. `image-rendering: pixelated` and `imageSmoothingEnabled = false` (reset
whenever the canvas is resized, since resizing resets the context) keep every art pixel a square.
Smoke's `boot` checks the scale is whole in a real browser, `landscape` checks it again turned on
its side, and `sheets` checks the cap on a desktop.

**A big screen sees more of the world, not a bigger one.** Ten tiles across a desktop's height drew a
1280×800 window at three CSS pixels to the art pixel, eight tiles tall, with names 27 pixels high
beside a HUD whose words are 12. Two is the size the character sheet draws the same figure at and
the HUD sets its titles at, so at the cap the world and the HUD are drawn to one measure: a desktop
frames 12.5 tiles tall at 1280×800 and 17 at 1920×1080. No phone reaches it (a 390-point phone
draws at one and a third), so the phone's framing, which the tab bar's rule below is measured
against, did not move.

**`touch-action` is `pinch-zoom`, not `none`.** A one-finger drag and a double tap are the game's,
so the stream of pointer events that tells a drag from a tap is never claimed halfway through by a
pan the browser decided to take. A two-finger pinch is left to the browser, because the canvas is
full-bleed under a `pointer-events: none` overlay: whatever it refuses, the page has no other
surface to be unzoomed through.

## The camera and the tab bar

**Nothing in the world may be drawn under the tab bar.** The bar is opaque and above the canvas, so
it swallows every tap that lands on it: the south signpost in town once rendered four pixels inside
it on a portrait phone and could not be tapped at all. The canvas is full-bleed, so the rule is held
by where the camera stands the player: **in the middle of the band above the bar**, not the middle
of the screen, so the world's middle is the middle of what can be tapped and anything on the map
comes up out of the bar by walking toward it. `worldViewportHeight()` in `ui/layout.ts` is where
the reserved band is decided; `tests/render2d/camera.test.ts` measures the south signpost against
it at real phone sizes, and smoke measures it again. If you add bottom furniture, reserve its
height in `layout.ts` rather than hoping nothing important lands in the last sixty pixels.

**The camera follows the player all the way to the map's edge rather than stopping at it**, and the
ground runs on past the map to meet it. A camera clamped to the map is what pinned the south
signpost under the bar at _every_ distance the first time the game was 2D, which made the south exit
of town unreachable on a landscape phone. **In landscape the rule is about approaching, not about
standing still**: the ten tiles are framed across the smaller side, which is the height, so less
of the map south of the player is in frame than on a portrait phone, and what holds is that walking
toward the south signpost lifts it clear of the bar, which smoke's `landscape` section measures three
tiles out.

**The camera never turns and never zooms** (decision 110). North is up the screen, so W walks north;
the art is lit from the top-left and drawn four ways round, and a camera turned off north would show
every sprite lit from somewhere the sun is not. The 3D camera turned under a drag, which is why W was
rotated into the camera's frame (`InputState.setViewYaw`, gone with it) and why the pitch was a band
kept clear of the horizon; none of that has anything to do in a view that looks straight down the
map's rows.

**Every position is a whole art pixel.** The camera is rounded from the player's own rounded
position, so the player is drawn at the same screen pixel every frame rather than jittering a pixel
either way as the world scrolls past, and a sprite moves an art pixel at a time, which is what every
pixel-art game does.

## Painter's order

**What is in front is decided by the order things are drawn in, and by nothing else.** A frame
draws, in order: the haze; the baked ground, with whatever moves on it (water) drawn over its
window; the floor of any room the player is in; what lies flat and moves (a fishing spot's rings);
the contact shadows and the ring under the target; the telegraphs; **everything standing, sorted by
where its feet are** — the player, the creatures, the townsfolk, the nodes, the signposts, the
stations, the fire, the loot sacks, the buildings, and a room's furniture while the player is in
it; then the moments; the lantern underground; a vignette darkening the corners; and last the
words, so a name at the edge of the screen reads as well as one in the middle. A building sorts on
its front from outside and on its back wall from inside, since anyone in the room stands in front
of the wall left standing.

**The view keeps no scene.** Every frame is drawn from the world as it stands; what the view keeps
is only what it has to remember between frames — each creature's `Motion`, when each wind-up was
first seen, the moments in flight — and what it has baked. The player's figure is compiled again
when what they have on changes, which the view reads off the world each frame and compares
(`[classId, look, gear]`) rather than being told; the old sheet's canvas is let go as the new one
is made, and one compile serves every setting, since a person is drawn only in shared ramps.

## The ground

**The ground is baked, not drawn a tile at a time** (`render2d/terrain.ts`, decision 101). A zone's
tiles, the edges between them and its scatter are drawn once onto a canvas of their own when the
zone is built, scatter kept off every building's footprint, and a frame draws the window the camera
sees in one call. Only what moves is drawn over it each frame: the cells of water, and the edges
with water in them, on the tile budget's four-frame loop, their frames kept on a sheet of their
own.

**The ground runs on past the map, into a haze.** Eight tiles of it (`APRON_TILES`), the map's own
edge carried outward, fading over four into a dark murk a setting (`HAZE`), so a road leaving by an
exit keeps going and the beach's sea keeps going east, and the edge of the map reads as land running
out into shadow rather than a wall the player walks into (decision 103). Nothing in the simulation
knows the apron exists, and it is inside the one baked canvas, so the teardown check counts it as it
always did.

**A zone says what kind of place it is, and the art says what that looks like** (`ZoneDefinition.setting`).
`open`, `marsh` or `underground` is a fact about the world — the fen is a marsh whatever draws it —
and the ground's ramps in that setting's light (`art/palette.ts`) and the lantern underground are
the view's answer, the same split `shape` makes for a creature. Required rather than defaulted, so a
new zone says what it is instead of inheriting the beach's light. **Underground is lit by what the
player carries** (`render2d/lantern.ts`): darkness stamped over the scene with a clear pool round
the player, in dithered steps and never black, and a warm glow added in the pool, drawn over
everything standing and under the words (`docs/architecture/art.md` has how it looks).

## What stands

**Everything standing sits on a contact shadow**: a flat ellipse under it in the setting's
`shadow` colour at a third strength, cut once a width a zone, so a sack, which comes and goes
mid-zone, stands on a person's rather than on one of its own. A boss's is as much wider as he is. A
fishing spot lies on the water and stands on nothing, and the fire stands on no shadow, since what it
throws is light.

**What anything is drawn as is read off the data, and a new row is on screen the day it lands.** A
creature is drawn as `art/cast.ts` says, falling back on the placeholder of its `shape`
(`quadruped | crustacean | humanoid`); a node as `art/places.ts` says, falling back on the drawing of
its `shape` (`tree | ripple | vein`); a station and the fire by their ids. A shape rather than a
check on `solid` or on the id, because the day a solid node that was not a tree arrived, an ore vein
would have been drawn with a canopy, and a switch over ids would make every new row a change to the
view. **What colour the metal in a vein is** is the one thing a vein's drawing does not decide for
itself: step 2 of its ore's ramp is the colour the ore it yields is drawn in the bag
(`ORE_VARIANTS`, held by a test), because a lump of tin grey in the bag and rust-red in the ground is
two answers to one question.

**An animation plays on the budget's clock** (`render2d/animation.ts`): a figure faces the way it
mostly moves, walks while moving and breathes while not, and a blow, a cast, a shot or a flinch told
by a `WorldEvent` plays through once over it. Each creature's clock starts somewhere of its own, off
where it spawned, so a knot of bandits does not breathe in step. **A corpse falls on the world's
clock** (`mob.deadForMs`), since the world has to respawn it on time with nothing drawing it at all,
and then lies fading for 300ms of the view's; a corpse is never a target.

**Whatever hides the player is faded** to half strength while they are behind it — a roof, and a
tree's crown — because you cannot tap what you cannot see and tapping is the whole game. Behind is
north of its foot and far enough inside what is drawn that it covers them. A crown is measured as the
middle seven-tenths of its frame across and its whole height, not the collision trunk it stops you
with or the body it is picked by: three questions about the same tree. A building answers two of the three with the picture of it, what
hides you and what a thumb aims at, where what stops you is its walls. **A building the player is
inside is cut away instead** (`docs/architecture/buildings.md`): its roof and front come off and
only the back wall stands, which is the same question with the opposite answer.

**Nothing is drawn over the room the player is standing in** (decision 112). A building close in
front of it reaches over it, since a roof stands up the screen from its footprint: from inside the
smithy, the training hall's roof, faded, lay across the floor with its name written over it. So
while the player is in a room (`roomRect`: its floor and the back wall over it), any other building
whose picture reaches over the room is drawn with the room clipped out of it, and a sign that would
be written there is not. Only buildings: a crown in front of a room still fades as it does
anywhere, being the one thing the player may be standing behind.

## Words

**A plate over a head is stacked up from its bars** (`Plate` in `ZoneView2D`): the mana bar at the
bottom, then health, then the name, then a worn title or a quest marker over that. The bars are at
the bottom so nothing put on above them moves them, since a health bar is the one thing on a plate
read mid-fight; the mana bar is the player's alone and is left off outright for a class with no
pool, since an empty bar reads as a caster who is out rather than a warrior. A creature's name is
coloured by its level against the player's (`conColor`), and a creature's level is in its name
(`Rat (Lv 1)`, decision 99). What moves a plate (an item in the bag moving a quest marker, a title
put on) publishes nothing, so each is read off `character.state` every frame.

**A crowd's plates stack rather than overlap** (`render2d/plates.ts`, decision 112). Every plate
and sign is laid out before any is written, and then stood in an order: one that would be written
over a plate already stood is lifted straight up until it lands clear of everything placed, bars
and all, and never sideways, so a name is still over what it names. The order decides what never
moves: the player, whose name is the one always looked for; the target, whose health bar is the one
read mid-fight; the signs over doors and the signposts, which stand still; the townsfolk; then the
creatures, front first. A plate
that touches nothing stands where it would alone, so only a crowd looks any different: goblins
standing side by side wrote "Goblin Scavenger (LvGoblin Scavenger (Lv 4)" before it, and now stand
under a short column of names. The layout is a pure function of boxes, unit-tested apart from any
canvas, and the widths are the font's own (`textWidth`), which is what the baked word will be.

**`drawnCounts()` counts one label per name over a creature, a person, a signpost and the player**,
and nothing else, so smoke can hold the total to what the zone spawned; the name over a building's
ridge is a `sign`, a quest marker a `marker` and a worn title a `title`, each counted apart for that
reason.

**Every word is written in the world's font and baked once while it is drawn** (`render2d/text.ts`,
`art/font.ts`). A word is outlined in the darkest ink whatever colour it is written in, which is what
lets a name read over grass, water and a roof alike, and the view colours the ink, since what colour
a name is is the game's to say. A word no frame drew is let go at the end of that frame: a damage
number is a new word every blow, and a zone fought in for an hour would otherwise keep every number
it ever showed. It is also what brings the canvas count back once a fight is over, which is how
smoke sees a leak. **A capital is nine art pixels tall** (`tests/art/font.test.ts`), drawn at one art
pixel, which a phone is given at a CSS pixel or more: the floor a name has held since act three
(`docs/architecture/art.md` has the arithmetic).

## Moments

**What is a moment and what is a state are drawn on different clocks.** A number, a burst and a
flight come off the `WorldEvent` channel, are handed to the view by the host's tick
(`render2d/effects.ts`), and age against the _view's_ clock — the one the walk cycles and the fire
run on — because how long a number takes to fade is a decision about what is comfortable to read. A
corpse's fall is the opposite (above). `drawnCounts().fx` is how many moments are in flight.

**A moment's clock starts on the first frame that draws it**, not on the last frame before it was
born. Moments arrive from the tick between two renders, and on a phone taking 150ms a frame that gap
is longer than an arrow's whole 140ms flight, so an arrow dated to the frame before was retired
without ever being drawn. CI's smoke runner found it first, in the 3D view, where the ranger's
arrow-in-flight check read nothing; the 2D view's effects are timed the same way from the start.

**A fight has motion in it, played off moments.** `swing` is said from the one place each side
swings (`CombatDirector`, and `AbilityCaster` for a blow), whether or not it lands, naming who swung
and what at; the view turns that figure toward it and plays its blow, and a `hit` flinches whatever
it landed on and bursts a star at its chest, in blood on the player and twice the size for a crit.
A `shot` flies an arrow drawn as a line of pixels; a `bolt-cast` a fireball or the bandit's knife;
each beat of a gather knocks chips, stone or a splash off the node on the side the player stands;
a `level-up` stands a column of light up through the player. None of it is state the world keeps:
a mob is never "mid-swing" to anything but the view. **A number rises off the top of what it came
off**, found by what stands at the spot the moment names, so one thrown off a boss clears his head
as one off a rat clears the rat's.

**A wind-up is drawn at the reach it lands at**: a rim at the ability's `range` round the creature
and a disc filling out to it as the wind-up runs down, on the ground under everything standing. The
shout says something is coming; the ring says where the line is to be on the far side of, which is
the whole of what the player can do about it. It reads `mob.windUp`, which is state, and fills on
the view's clock from when it first saw that wind-up; the rim and disc are baked once a reach
(`Telegraphs`), since a disc traced a row at a time would be hundreds of calls a frame for the
king's.

## Picking

**A tap is picked against boxes, not against the pixels drawn** (`render2d/picking.ts`). A box is a
rectangle on the ground's plane standing up the screen from where a thing's feet are
(`standingRect`): its body's width or a tile for a figure, as tall as its sprite is drawn, reaching a
quarter-tile below the feet since a thumb aims at a figure's feet as often as its middle and
`view.worldToScreen(x, y)` answers the feet, and never smaller than `MIN_PICK_SPAN` either way,
since a crab is a thumb's width at best. **A node is picked by its body**: a tree up its trunk and
the lower half of its crown, so a creature behind the crown is still the creature, and a fishing
spot as the patch of water round it (`lyingRect`). A corpse and a lapsed pile answer no box at all.

**The kinds are asked in a priority, not a depth sort**: node → signpost → NPC → mob → station →
fixture → building → loot pile → ground. A rat in front of the shopkeeper does not stop you shopping. Only
within one kind does what is drawn in front win, the one whose feet are further down the screen.
Every point is ground at worst: a flat view has no sky to miss into.

**The last two are below the creatures for the same reason, and the building is the extreme case of
it.** A kind ranked above mobs wins wherever its box is — a forge is a tile of furniture near the
middle of town and a shopfront is three tiles of it, so either one above the mobs silently eats
every tap on the rat drawn over it. The building is also the only kind that answers as something
else: whoever works in it, or `{kind: 'ground'}` at its door — or the room once you are standing on
that doorstep — which needs no new `WorldTap` kind, no case in `ZoneWorld.tap` and no line in the
context menu (`docs/architecture/buildings.md`). And from _inside_, a building is not picked at all
(`pickRect()` answers `null`), because there the same box is a lid over the floor.

**A loot pile is below all of them, and only above the ground**, for the forge's reason in its
plainest form: a pile lies wherever something died, which is wherever the next creature is standing,
so a sack ranked any higher would eat the tap on the rat standing over it. It is also the one drawn
thing besides the fire that comes and goes mid-zone, and the only one there can be several of: the
view draws a sack for each pile in `world.lootPiles` while it lasts, so `drawnCounts().piles`
follows the world's list and smoke holds the canvas count flat across one being dropped and taken
up. It **blinks through the last ten seconds of its minute**, read off the pile's own clock rather
than the view's, which is how it says it is going without a timer drawn over it (`docs/decisions.md`
66).

**A fixture is what stands in the house** (decision 130): a stand, the chest or the wall, picked
only while the player is in the house's room, since from outside the roof is over all of it and the
building answers. It sits above the building for that reason and below the station, which it never
meets. A stand's box stands as tall as a trophy on it, the chest's as it is drawn, and the wall's is
the face the plaques hang on, with the chest in front of its foot winning where the two meet. The
view draws the stands and the chest with the room's furniture, a trophy's own icon on its stand off
a sheet of the items' icons compiled the first time a zone with the house is built and kept for the
session, and the plaques on the back wall sorted with it.

`tests/render2d/picking.test.ts` holds the priority, the boxes, the building's answers and the pile,
and sweeps every creature in every zone across its whole wander disc, tapped from where a player
stands to fight it with every counter, station and shopfront in the scene, since a creature is only
ever _at_ its spawn on the frame the zone was built.

## Gestures and the menu

**A tap and a drag are the same three events, and `host/gesture.ts` is what tells them apart.** A
tap asks the world for something; a drag asks for nothing. It turned the 3D camera, and since the
camera no longer turns it is kept for what it still prevents: a flick meant to scroll, or a thumb
sliding off a button, must not also walk the character. The rule is a **latch**, not a comparison:
a gesture becomes a drag once its _cumulative_ travel passes `TAP_SLOP_PX` and can never go back,
because a drag out and back finishes where it started and releasing there must not walk the player
somewhere. Time is the other half — a thumb resting on the screen past `TAP_MAX_MS` is not a request
to walk. The host owns the events, the pointer capture (so a drag that runs off the canvas still
ends in a release here) and the canvas's `touch-action`.

**A press held is the third thing those events can mean, and it is a question rather than a
request.** Right-clicking — or, on a phone, resting a finger — asks what something is: the host
resolves the same pick a tap uses and calls `world.inspect(tap)`, which answers with a menu and
**changes nothing** (a player reading a drop table mid-chop has not decided to stop chopping).
`LONG_PRESS_MS` is `TAP_MAX_MS`, deliberately: a press held that long had already stopped being a
tap and did nothing at all, so the phone's right click costs no gesture that meant something else.
Reaching it **latches** (`holdAsLongPress`) — at exactly 500ms the press is a menu and never also a
walk, which is not something a comparison against the clock can promise. The numbers live in
`ui/gestures.ts` rather than in the host because `hud/longPress.ts` reads them too: a bag cell and a
rat have to answer to the same press, and an element in an overlay has no drag to disambiguate
against and no pointer to capture, so all that is left of the rule there is a timer.

The menu itself is the ask/answer split the shop makes, and the reason is the same one twice over.
`world/ContextMenuSession.ts` holds **the only reference to the rat**; the HUD is handed a
description and sends back a bare `ContextActionId`, so a panel in an HTML overlay never outlives
the zone it was about, and a line chosen after the mob died, after the zone changed, or naming
something other than what was pressed resolves to nothing. Choosing an action runs it through
`ZoneWorld.tap` — a menu is a slower way of saying the same thing, not a second set of rules about
attacking and gathering. Everything a menu _shows_ comes from `systems/InspectSystem.ts`, which is
a pure function of the data tables and is settled at the moment the menu opens: a drop rate on
screen is the number `rollLootTable` rolls against, and a card left up is describing rats rather
than a stale rat. A loot pile is the one card handed state rather than an id, since there is no
table to read a pile off; it is still settled at the open, and a pile only ever gets smaller, so a
card left up can promise too much but never too little — Take is answered against what is there.
Anything that ticks stays off it on purpose — a creature's current HP belongs to the target frame,
which is redrawn as it changes.

## What the view holds, and what a frame costs

**Every canvas the view makes is made and let go through one pool** (`render2d/canvases.ts`), and
`view.canvases()` is the count. What it holds is canvases: a sprite sheet a setting, kept for the
session since the beach and town draw from the same one; the player's figure; and for the zone, the
baked ground, each building's three pictures, the shadows it has cut, the telegraph rings, the
lantern, and every word on screen. A zone change is a view rebuild: `teardown()` lets go of
everything made for the zone, and `build()` makes it again for the next. A canvas nobody let go is
invisible to every state assertion and to the screen, so smoke's `teardown` holds the count flat
across three zone round trips, having swept the camera over the zone first since some canvases are
made only when a frame first asks for them; the loot sack, a helmet put on, a landed arrow and a
round trip out of Greyford are held to it too.

**What a frame costs is measured rather than assumed.** `DebugView.drawTime()` is a rolling mean of
what the last thirty drawn frames cost, kept by the host so it times the call _into_ the view
(`host/frameTimer.ts`); smoke's `throttled` section asserts `SLOW_DRAW_BUDGET_MS` on it under an
eight-times slower CPU. **It is 16ms** (decision 110): the 2D view reads 2-3ms on CI on a full run
and 5-8ms in a loaded dev container, against the 25ms the 3D view read under a 40ms ceiling, and 16
is where the draw alone stops fitting a 60fps frame. A regression planted to test it, every word on
screen baked again each frame, read 46ms in the container — about seven times the game, which on
CI's baseline is over the new ceiling and would have been under the old one — and no other check in
smoke noticed it, since the canvas count stayed flat. Read it off a **full** run — the section
carries state forward from every one before it, so `--section=throttled` alone is a lighter game
and a different number — and off CI rather than a dev container before believing a failure
(decision 50). Raising the ceiling is a decision about the game, not about the run that hit it.
