# Rendering

The Three.js side: the camera and the tab bar, how creatures and nodes pick their look, terrain, light and shadow, the draw budget, nameplates, effects, picking, gestures and occlusion.

_Moved out of `CLAUDE.md` on 2026-09-25 (`docs/decisions.md` 57). The paragraphs are the ones that were there, in the order they were there; `CLAUDE.md` keeps the rules and points here for the reasoning. Where this and the code disagree, the code is right — and this file is what should be corrected._

**Nothing in the world may be drawn under the tab bar.** The bar is opaque and above the canvas, so
it swallows every tap that lands on it: the south signpost in town once rendered four pixels inside
it on a portrait phone and could not be tapped at all. The canvas is full-bleed and a perspective
camera cannot shrink without changing what it shows, so the requirement is held by how the camera is
_framed_ (`render3d/camera.ts`: pitch, distance, and a look point aimed short of the player, because
ground nearer the camera spreads over more pixels than ground further away). `worldViewportHeight()`
in `ui/layout.ts` is where the reserved band is decided. It is measured at real phone sizes, in
`tests/render3d/camera.test.ts` and repeatedly in `npm run smoke`. If you add bottom furniture,
reserve its height in `layout.ts` rather than hoping nothing important lands in the last sixty
pixels.

**The pitch is a band rather than a number somebody liked, and it is 45°.** The bar is the floor
under it — ground behind the player is where the perspective squeezes hardest, and a shallower
camera squeezes it harder — and under that is half the field of view, where the horizon comes into
frame and a tap aimed past the ground has nothing to land on. The ceiling over it is what a steep
camera costs: a world unit standing up is worth `cos(pitch)` on screen and one lying flat is worth
`sin(pitch)`, so at the 58° this used to be, a wall was worth 0.62 of its own footprint and every
building read as a roof plane. `camera.test.ts` holds all three. **Two other numbers move when the
pitch does** and neither says so on its face: `TARGET_TILES_ACROSS` used to frame the view by its
_depth_, so tilting the camera also zoomed it, and `FOG_FAR` is a ratio to a camera whose axis a
shallower pitch lays down closer to the ground. Framing by width instead is what makes the pitch a
decision about the angle alone; the fog is re-derived when it moves, and the tests measure the cue in
tiles ahead of the player rather than in the multiples it is written in.

**In landscape the rule is about approaching, not about standing still.** The camera frames its
tile budget across the viewport's _smaller_ axis, so a landscape phone spends it on depth: the south
signpost is eight tiles behind a player on the town spawn point and is simply out of frame there.
That resolves itself — the camera follows all the way to the map edge rather than clamping to the
world bounds, so walking toward the signpost lifts it up the screen and it clears the bar about four
tiles out, which is what smoke measures. The 2D camera did clamp, which pinned the signpost below
the viewport at _every_ distance and made the south exit of town unreachable on a landscape phone;
that was left unfixed on purpose and went away with the renderer it was in.

**The renderer is on the far side of that too**: an `EnemyDefinition` names a
`shape` (`quadruped | crustacean | humanoid`) and `render3d/creatures.ts` switches on _that_, so a
new row picks a body it is drawn with rather than waiting for a builder written for its id. Colour
stays the renderer's, keyed by the same shape in `render3d/palette.ts` — with the exceptions the
table always said would come. `CREATURE_OVERRIDES` there keys a look to an `EnemyId`, for a humanoid
who is not the same man as the first: a named mob standing in a room full of its own men is precisely
the case where sharing a shape's colour is wrong, and so is a goblin, and so is a fen raider, and so
is the same goblin underground.
`BEAST_OVERRIDES` beside it is the same escape hatch for fur and shell, added when the bog lurker
became the second quadruped and the first one that is not brown — which is exactly the change the
shape table's own comment said to make when it arrived, and the cave crawler is that argument again
for the second crustacean: the crab's boiled orange is a thing that lives in the sun. The default
stays the rule and both are read
through one accessor each (`humanoidLook`, `beastLook`), so a new `ENEMIES` row is still drawn with
no view code written for it unless it asks to be. **How big a person is drawn comes
off the body too**: `buildHumanoid` scales the rig by `body.width / TILE_SIZE`, so the chief takes
up half again the room a bandit does and looks it, in the same direction everything else here runs
— what it _is_ decides what it looks like, never the other way round.

**A `ResourceNodeDefinition` names a `shape` for the same reason** (`tree | ripple | vein`, switched
on in `render3d/props.ts`). It used to be picked out by `solid`, which was a two-way question
standing in for "is it a tree" — and the day a solid node that was not a tree arrived, an ore vein
would have been drawn with a trunk and a canopy. The one thing a vein's prop does _not_ decide for
itself is what colour the metal in it is: that is read off the ore the row yields
(`itemIcon(yieldItemId).color`), because a lump of tin that is grey in the bag and rust-red in the
ground is two answers to one question. Same argument as `TILE_COLORS`, one prop down.

**There are no art assets, and the renderer loads no image at all** (placeholder shapes only, per
the "no art skills" constraint in `docs/initial_design.txt`). Terrain is one vertex-coloured mesh
(`render3d/ground.ts`, see below) and every entity is untextured primitives (`render3d/figure.ts`,
`creatures.ts`, `props.ts`). The only textures uploaded are text baked onto a canvas by
`render3d/text.ts` — a nameplate's name and a floating damage number — which is also the reason
`disposeTree` names `material.map` explicitly, and the reason the unit suite stubs a 2D context
(jsdom has none). The tile vocabulary is small and grows by a constant plus a colour — `MARSH_TILE`
is the fen's brackish ground and cost exactly that, since `BLOCKING_TILES` is a list and a walkable
tile needs no change to collision at all. Tile colours live in `TILE_COLORS` in `data/tiles.ts` rather
than in the renderer,
for the same reason the stick-figure rig behind the paperdoll does: the ground the simulation calls
water is a decision the whole game makes. Creature colour is not — `render3d/palette.ts` is the
renderer's own, and nothing outside it asks what colour a rat is.

**A ground vertex is coloured by what it touches, and a blocking tile touches nothing**
(`buildGroundGeometry`). A tile is four quads rather than one, and each vertex takes the mean of the
tiles that reach it — the one under a tile's middle, the two either side of an edge, the four that
meet at a corner — so a road fades into the grass over the outer half of each of them instead of
ending in the staircase a grid of flat squares draws. The middle sample is why the tile is cut up at
all: with four corner samples and every one an average, a three-tile road has no pure road anywhere
in it and reads as a smear. **What may not blend is a boundary a body is stopped at.** `blends` puts
two tiles in the same mean only if they agree about being crossable, because a shore drawn as a
gradient is a gradient somewhere in the middle of which walking stops working, and where the ground
may be crossed is the one thing about terrain a player has to read at a glance. The brightness wobble
had to move with it — `cornerShade` is per grid corner and `shadeAt` interpolates between them, since
a shade held flat across a tile would put the grid of hard squares straight back in, drawn in
brightness rather than in hue.

**Where the ground steps down, it grows the face it steps down.** A water tile sits `WATER_DEPTH`
below the land and nothing joined the two, so the far rim of every pond was a band of the background
showing through the hole in the world. Each tile now grows a vertical quad on any side whose
neighbour stands higher, in the colour of the ground it is cut into, darkened — a bank rather than a
palette entry of its own. It is written against tile _height_ rather than against water by name, so
the next thing that steps down is drawn already, and it is single-sided and wound toward the low
tile: the face is only ever seen from inside the dip, and wound the other way it is the void it was
added to fill.

**Rock stands up, and it cost one constant** (`WALL_HEIGHT`, act three phase 5). A wall was paint at
height zero, which made the Deep Cut and the barrow a floor with dark rectangles on it; the face code
above was written against tile _height_ rather than against water by name, so raising `WALL_TILE`
grew every rock face in the game with no new mesh. The height is the least that reads as solid: at a
45° camera a wall hides as much ground behind it as it is tall, so it stays well under a figure and
what it hides is a pair of boots. The rock colour was lightened in the same change, because at height
zero only its darkness said "solid" and stood up it read as a hole.

**The ground runs on past the map, into a haze that is also the clear colour** (`APRON_TILES` in
`ground.ts`, act three phase 4). A portrait camera at 45° sees about twenty-nine tiles north of the
player at the top of the frame, far past the map's edge, and for as long as the mesh stopped there
the top fifth of every portrait frame was the clear colour — a navy hole. The apron is the map's own
edge carried outward, one quad a tile, so a road leaving by an exit keeps going and the beach's ocean
keeps going east; it dims over its first three tiles so the bounds clamp does not read as an
invisible wall. The fog's colour and the scene's background are **one colour on purpose**: the far
ground fades into it and whatever the ground does not cover is it, so the world has no edge at all.
Nothing in the simulation knows the apron exists, and it is still one mesh, so the teardown check
counts it as it always did.

**A zone says what kind of place it is, and the renderer says what that looks like**
(`ZoneDefinition.setting` into `render3d/atmosphere.ts`). `open`, `marsh` or `underground` is a fact
about the world — the fen is a marsh whatever draws it — and the haze, the fill's two colours, the
fill and sun strengths and the lantern are the renderer's answer, the same split `shape` makes for a
creature. Required rather than defaulted, so a new zone says what it is instead of inheriting the
beach's weather. **Underground is lit by what the player carries**: the one point light in the scene
is the room lamp indoors and a warm lantern over the player's head underground, which is safe because
the two can never be wanted at once — nothing is built underground — and which keeps the light count,
and so every compiled program, the same in every zone. `Sunlight.breathe` dims and recolours the same
two lights rather than adding any, for the same reason.

**There is a sun now, and everything standing in it sits on the ground** (`render3d/lights.ts`).
Two flat lights and no shadows was the right call while there was nothing to cast one; by the end
of act two there were buildings, trees, veins, signposts, creatures and a player, and every one of
them hovered. A `HemisphereLight` fill is what gives a face pointing up a different value from one
pointing sideways with no sun on it, which a flat ambient could never do; the sun itself comes from
the **south-west**, because the camera's resting place is due south and a light from the north put
every face anyone ever looked at in shade. It does not follow the camera — turning the view round to
look into the sun is most of what makes turning it worth doing.

Four things about it were decided against alternatives:

- **The shadow camera is cut to the zone, not to what the camera can see**, which reverses what
  `docs/archive/interiors_and_light_plan.md` asked for and is what the arithmetic says. The camera
  sees ground from a few hundred units in front of itself out past 2500 — from the middle of town
  both edges of the zone are on screen at once — so a frustum framed on the viewport is _larger_
  than one framed on the map. Framed on the zone it is also fixed in the world for the life of that
  zone, so a shadow's edge does not crawl as the player walks, and it is the frame a **pitch change
  leaves alone**: the camera coming down to 45° moved the viewport's frustum and this one not at all.
- **Only the ground receives.** It is the surface a shadow is actually read on, and it is the one
  that must not also cast: a single flat plane covering the whole zone, tested against a depth map
  it wrote itself, is the shortest road to acne over the entire floor.
- **A builder decides what casts, not an actor.** `castsShadow` is called on the group each builder
  returns, which keeps a nameplate, a shop sign, a damage number and a selection ring out of the map
  by construction — those hang on the actor _around_ the body — and keeps the player's shadow across
  a gear change, which rebuilds the figure and never touches the actor. The exceptions are the two
  transparent things: a fishing spot's ripples, and a campfire's flames, whose logs cast where the
  fire does not. `tests/render3d/lights.test.ts` sweeps `ENEMIES`, `RESOURCE_NODES` and `BUILDINGS`
  for it, so a row added later answers for itself.
- **The depth cue is measured in camera distances, and starts nearer than the player**
  (`fogRange` in `camera.ts`). That is where it stops being weather and becomes a cue: real haze
  would not care which way the phone is held, but a landscape camera sits less than half as far back
  as a portrait one, so a fog in world units grazes the horizon on one and swallows half the zone on
  the other. There are barely 1.6 camera distances between the player's feet and the furthest ground
  anyone looks at, so starting past them leaves nothing to fade with — three's fog ramps on a
  smoothstep, whose near end is flat, so starting at 0.9 puts the player three percent in and buys
  the whole range back. A **readout** opts out of it entirely (`fog: false` on the nameplates, the
  signs, the floats, the bolt and the selection ring), for the reason those already opt out of the
  depth test: the post fades and the word over it does not.

**What it costs is measured rather than assumed.** `DebugView.drawTime()` is a rolling mean of what
the last thirty drawn frames cost, kept by the host so it times the call _into_ whatever is drawing;
smoke's throttled section asserts `SLOW_DRAW_BUDGET_MS` on it under an eight-times slower CPU. The
sun, the shadow map and the depth cue together took a full run from 20.7ms to 25.2ms against a 40ms
ceiling. Read it off a **full** run — the section carries state forward from every one before it, so
`--section=throttled` alone is a lighter game and a different number. Raising the ceiling is a
decision about the game, not about the run that hit it.

**A nameplate stacks up to five things and only the health bar may not move** (`render3d/nameplate.ts`):
the quest marker, the name, the worn title, the bar at the group's origin, and the player's mana
under it. Putting a title on pushes the _name_ up rather than sliding the bar down, because the bar
is the one thing there read at a glance mid-fight; the mana bar hangs _below_ the origin for the same
reason, since anything inserted above it would move everything else. Only the player has one, and it
disappears outright for a class with no pool — an empty bar reads as a caster who is out, not as a
warrior. The name is the only line counted as a `label` by `drawnCounts` — `marker` and
`title` have their own kinds precisely so smoke's one-label-per-drawn-creature assertion stays true
by construction. All three are polled off `character.state` once a frame rather than pushed by an
event, since what moves them (an item in the bag, a title worn) publishes nothing.

**A name is sized in phone pixels, and every baked word wears an outline** (act three phase 6). A
world unit is worth whatever the camera makes it, and a portrait camera stands far enough back to fit
ten tiles across that it draws about 0.6 pixels to the unit at the player: the twelve units a name
used to be came out five pixels of glyph, unreadable. `DEFAULT_LABEL_HEIGHT` is 22 now and
`tests/render3d/nameplate.test.ts` holds it in pixels on a 390x844 phone rather than in units. The
outline is baked into the same texture in `text.ts` — a coloured glyph with nothing round it reads
only over the grounds it happens to contrast with — and it is the same black under every tone, so
what a line says and what colour it says it in are still the fill's alone.

**Every line on a plate is a fraction of the one it hangs off**, so `labelHeight` is the single
number that squishes a whole plate and the gaps close with it — a plate that shrank its bar and kept
a mob's spacing around it would not have got any smaller. The player's is squished and floats higher
than everyone else's (`PLAYER_PLATE` / `PLAYER_PLATE_CLEARANCE` in `actors.ts`): theirs is the only
one stacking a pool under the bar and a title over the name, and it is drawn on the figure the camera
keeps centred, where a low camera angle pushes anything at head height into the head.

**`render3d/actors.ts` is one actor per simulated thing**, catching up to it in `sync()` once a
frame — and an actor that forgets `dispose()` leaks GPU memory, so every one of them ends in
`disposeTree` (`render3d/dispose.ts`, which frees geometry, material _and_ any texture hanging off
it). An actor is three layers on purpose: an outer group holding the world position, a facing group
holding the yaw from `facingYaw`, and the nameplate — which is billboarded by having its own
rotation overwritten from the camera each frame, and so cannot live under something being turned to
face where the creature is walking.

**A fight has motion in it, played off moments** (act three phase 7). `swing` is said from the one
place each side swings (`CombatDirector`, and `AbilityCaster` for a blow), whether or not it lands,
naming who swung and what at; a `hit` names the creature it landed on. The view hands both to the
actor they belong to — `render3d/reactions.ts` brings a weapon over its grip or darts a beast forward,
and flashes the emissive term of whatever was struck, white for a creature and red for the player —
and `fx.ts` sprays sparks off a crit, chips off each of a gather's two beats, and a ring of light off
`level-up`. None of it is state the world keeps: a mob is never "mid-swing" to anything but the view.
A damage ability says whether it is `thrown` in its effect, the word enemy abilities already used;
this asked `range > 0` before, which every damage ability has, so a Power Slash threw a magic bolt.

**What is a moment and what is a state are drawn on different clocks** (`render3d/fx.ts`,
`selection.ts`). A damage number and a bolt come off the `WorldEvent` channel, are handed to
`FxLayer` by the host's tick, and age against the _view's_ clock — the same one the walk cycles and
the campfire's flicker run on — because how long a number takes to fade is a decision about what is
comfortable to read. A corpse's fall and fade are the opposite: `MobActor` reads them off
`mob.deadForMs`, since the world has to respawn on time with nothing drawing it at all. Both the fx
layer and the selection ring outlive a zone, like the camera and the lights, so a teardown `clear()`s
them instead of taking them out of the scene. Effects play from a 0-1 progress rather than a delta,
which is what makes a dropped frame invisible; `drawnCounts().fx` is how many are in flight, and it
is the one thing in `DrawnCounts` a browser is genuinely needed for (jsdom cannot bake the text).

**A tap is picked against boxes, not against the meshes** (`render3d/picking.ts`). Each actor
answers `pickBox()` with the box a ray has to cross — its collision footprint, standing as tall as
it is drawn, and never smaller than `MIN_PICK_SPAN`. Raycasting the real geometry looks more honest
and is wrong twice over: a ray aimed at a figure's feet — which is what `view.worldToScreen(x, y)`
answers, and roughly where a player aims — passes between its legs and out the other side, and a
crab is 18 screen pixels wide on a phone. `pickTap` then tries node → signpost → NPC → mob →
station → building → ground, which is a **priority, not a depth sort**: a rat in
front of the shopkeeper does not stop you shopping. Only within one kind does the nearest win. The
ground is the mathematical `y = 0` plane rather than the terrain mesh, because the mesh stops at
the map edge and the simulation does not.

**The last two are below the creatures for the same reason, and the building is the extreme case of
it.** A kind ranked above mobs wins from _anywhere along the ray_, including well behind what is
being aimed at — a forge is a tile of furniture near the middle of town and a shopfront is three
tiles of it, so either one above the mobs silently eats every tap on the rat beyond it. The building
is also the only kind that answers as something else: it resolves to `{kind: 'ground'}` at whatever
`tapPoint` says — its doorstep, or the room once you are standing on that doorstep — which needs no
new `WorldTap` kind, no case in `ZoneWorld.tap` and no line in the context menu. Left to fall through
instead, the ray would carry on over the roof and land on the grass _behind_ the building — which
used to walk the player into the back wall and, now that a walk routes, walks them all the way round
the block instead. The second is the worse of the two: a tap on a shopfront that ends up behind the
shop is a minute of walking rather than a wall to back away from. And from _inside_, a building is
not picked at all (`pickBox()` answers `null`), because there the same box is a lid over the floor.

**A tap and a drag are the same three events, and `render3d/orbit.ts` is what tells them apart.**
A drag turns the camera's yaw around the player; a tap asks the world for something. The rule is a
**latch**, not a comparison: a gesture becomes a drag once its _cumulative_ travel passes
`TAP_SLOP_PX` and can never go back, because a drag out and back finishes where it started and
releasing there must not walk the player somewhere. Time is the other half — a thumb resting on the
screen past `TAP_MAX_MS` is not a request to walk. Only the horizontal component turns anything:
pitch is not the player's to change, since it is what keeps the world clear of the tab bar _and_
what guarantees every pixel on screen is ground rather than sky. The host owns the events, the
pointer capture and `touch-action: none`; `ZoneView3D` owns the angle, and it outlives a zone.

**A press held is the third thing those events can mean, and it is a question rather than a
request.** Right-clicking — or, on a phone, resting a finger — asks what something is: the host
resolves the same pick a tap uses and calls `world.inspect(tap)`, which answers with a menu and
**changes nothing** (a player reading a drop table mid-chop has not decided to stop chopping).
`LONG_PRESS_MS` is `TAP_MAX_MS`, deliberately: a press held that long had already stopped being a
tap and did nothing at all, so the phone's right click costs no gesture that meant something else.
Reaching it **latches** (`holdAsLongPress`) — at exactly 500ms the press is a menu and never also a
walk, which is not something a comparison against the clock can promise. The numbers live in
`ui/gestures.ts` rather than in the renderer because `hud/longPress.ts` reads them too: a bag cell
and a rat have to answer to the same press, and an element in an overlay has no drag to
disambiguate against and no pointer to capture, so all that is left of the rule there is a timer.

The menu itself is the ask/answer split the shop makes, and the reason is the same one twice over.
`world/ContextMenuSession.ts` holds **the only reference to the rat**; the HUD is handed a
description and sends back a bare `ContextActionId`, so a panel in an HTML overlay never outlives
the zone it was about, and a line chosen after the mob died, after the zone changed, or naming
something other than what was pressed resolves to nothing. Choosing an action runs it through
`ZoneWorld.tap` — a menu is a slower way of saying the same thing, not a second set of rules about
attacking and gathering. Everything a menu _shows_ comes from `systems/InspectSystem.ts`, which is
a pure function of the data tables and is settled at the moment the menu opens: a drop rate on
screen is the number `rollLootTable` rolls against, and a card left up is describing rats rather
than a stale rat. Anything that ticks stays off it on purpose — a creature's current HP belongs to
the target frame, which is redrawn as it changes.

Two things follow from the camera being movable at all:

- **W means up the screen, not north.** `InputState.setViewYaw()` rotates the keyboard's vector into
  simulation space, and the host sets it whenever a drag moves the camera. Without it the two mean
  the same thing only while the camera is looking north, which is disorienting in a way no state
  assertion calls a bug.
- **Whatever the camera ends up behind gets faded** (`render3d/occlusion.ts`), because you cannot
  tap what you cannot see and tapping is the whole game. One ray from the camera to the player's
  feet — the lowest point on them, so it fades a fraction early — against a box per prop. The box is
  the **drawn** canopy, not the collision trunk it stops you with and not the thumb-sized volume it
  is picked by: three different questions about the same tree. A **building** answers two of the
  three with its footprint — what hides you and what a thumb aims at — where what stops you is its
  walls, and it is the thing the fade exists for most, being the only object big enough to leave
  nothing on screen to tap. Its sign is deliberately left solid: a shopfront the camera is behind
  still has to say which shop it is. Fishing spots are excluded on purpose, being the one prop drawn
  transparent already. And a building the player is _inside_ opts out of the fade entirely — see the
  cutaway above, which is the same question with the opposite answer.
