# Art

The style guide version 2 is drawn to, and how a sprite gets from text to the screen: the tile, the
scale, the palette, the light, the outline, the animation budget, the sprite format, the compile
step, recolouring, the world's font, and which renderer draws it.

_Written in version 2's phase B1 (`docs/decisions.md` 100 and 101); B2 added the edges between
grounds, the world's font, the first people and creature, the building kit and the 2D view that
draws them (decision 102), and the user's first look turned the whole of it from cute to heroic
and weathered (decision 103). B3 drew every ground, the edges and faces between them, the scatter
and the lantern, and made the 2D view the game (decision 106). Where this and the code disagree, the
code is right — and this file is what should be corrected. `rendering.md` is still the 3D renderer's,
the fallback behind `?renderer=3d`, until B7 retires it._

**The art is data, and it depends on nothing** (decision 81). A sprite is text in `src/art/`:
rows of characters, one per pixel, each a key in the sprite's legend, which names a palette step.
The compiler turns that into pixels at boot, so the game still loads no image file. `src/art/`
imports no package at all (`tests/art/sprites.test.ts` holds it), because it has to outlive the
renderer that first draws it: Part B replaces one renderer with another, and B7 deletes the old one
underneath whatever was written against it.

## The tile and the scale

**A tile is 32 art pixels square** (decision 100). The simulation's tile is still `TILE_SIZE`, 64
world units, so an art pixel is two world units, and nothing in `world/` or `systems/` changes for
it. A person is a tile wide and half again as tall (32×48), which is the proportion of a figure in
Link to the Past or Stardew; a beast is a tile square, or 48 or 64 pixels for a big one.

**The view is drawn at art resolution and scaled up by whole device pixels.** The canvas the
renderer draws into is as many art pixels as the screen holds, and the page scales it to the screen
with `image-rendering: pixelated`. The scale is the whole number of device pixels to the art pixel
that frames closest to ten tiles across the screen's smaller side, which is the framing the 3D
camera holds (`TARGET_TILES_ACROSS`): four on a 390-point phone at three device pixels to the point
(9.1 tiles across), two on a 360-point phone at two (11.3), two on a 1280×720 desktop (11.3 tall).
A whole number is what keeps every art pixel the same square on screen; a fraction would draw some
pixels a device pixel wider than their neighbours, and a pixel-art game shimmers when it scrolls.
It follows that **nothing is drawn between art pixels**: a sprite moves a whole art pixel at a time,
which at these scales is a device-pixel step of two to four, and is what every pixel-art game does.
The canvas being small is also most of why drawing it is cheap (decision 101): a portrait phone at
scale 4 is 293×633 art pixels, a fifteenth of the device pixels a full-resolution canvas would fill.

## The palette

**Every colour is a step on a ramp** (`src/art/palette.ts`). A ramp is five colours of one
material, darkest first, and a sprite's legend names a step (`grass.2`, `skin.3`) rather than a
hex, so nothing drawn can reach for a colour the palette does not have. The steps are
**hue-shifted**, not one colour darkened: shade leans cool and violet, light leans warm and yellow,
which is most of what makes a small sprite read as lit rather than flat. Two steps have jobs:

- **Step 0 is the outline.** The compiler outlines each edge in step 0 of the ramp it touches, so
  step 0 has to be the darkest, and `palette.test.ts` holds every ramp to running dark to light.
- **Step 2 is the material's own colour**, the one a player would name it by. The tier ramps are
  built round the tier's `TIER_COLORS` entry at step 2, which the paperdoll draws in, so a set of
  gear is the same set on the character sheet and in the world (held by a test).

**The palette is heroic and weathered** (decision 103, which turned decision 100's "warm and
bright" a long way down once the user saw it and called it farmvilley): deep forest greens, worn
grey-brown earth, dark water, cloth dyed rather than bright, dark oak and weathered plaster, with
the warmth kept for the light and for what should catch the eye (a lit window, a cloak, a flame).
World of Warcraft's colour and the Lord of the Rings' ground, in the user's words the feeling of
epic adventure; it still reads at a glance on a small screen, which a grimdark grey would not.

**There is one palette per setting, and it colours only the ground.** Ramps come in two sets:

- **Shared ramps** look the same everywhere: skin, hair, cloth, leather, wood, the metals and the
  gear tiers, fire and magic, each creature's fur or shell, and what buildings are made of. A person,
  a beast, an effect or an icon may use only these (held by a test), because a rat is the same brown
  in the fen as on the beach.
- **Terrain ramps** (`grass`, `path`, `sand`, `water`, `stone`, `rock`, `marsh`, `foliage`,
  `bark`) are coloured by each setting: `open` the lightest, `marsh` greener and heavier,
  `underground` dark and cool so the lantern has something to do. Every setting colours every one,
  so any tile can be laid in any zone and still be drawn in that zone's light, and a test holds the
  order: no terrain ramp is lighter in the marsh than in the open, or underground than in the marsh.
  A prop may use them too, which is how a tree in the fen is a fen tree.

A new colour is a new ramp, not a new step: five colours, darkest first, in the set its material
belongs to.

## The light

**The light comes from the top-left**, the pixel-art convention, and it is the only light there is.
A surface facing up or left takes steps 3 and 4, one facing down or right takes step 1, a crevice
step 0, and the rest step 2. Every sprite is shaded the same way, so a scene reads as lit by one sun. The 3D sun
came from the south-west because its camera looked north across the map; this camera never turns,
and the top-left is where the pixel art of the games named above puts it.

**Nothing casts a shadow; everything standing sits on one.** The renderer lays a flat ellipse under
anything that stands, in the setting's `shadow` colour at partial opacity, which is what stops a
sprite hovering. A cast shadow would have to be drawn for every frame of every facing, and would
tell the player nothing a contact shadow does not. **Underground is lit by the lantern**
(`render2d/lantern.ts`, decision 106): the renderer darkens everything but a pool of light round the
player, as the 3D view did with a point light, and the underground palette is dark so the pool is
where the colour is. It is two stamps centred on the player's chest, drawn over everything standing
and under the words: darkness, clear for three tiles and falling off to six and a half **in dithered
steps** rather than a smooth gradient, as pixel art shades, wider than it is deep since the ground is
seen at a slant, and **never black** (two thirds dark), so a creature at the edge of the screen is
still a shape; and a faint warm glow added in the clear, which is what brings the colour back.

## The outline

**People, beasts, props, icons and scatter are outlined; tiles and effects are not.** A figure
against busy ground on a phone needs an edge to be a figure at all; ground has no edge to draw, and
light has none either. Scatter is ground, and outlined anyway (decision 106): drawn in the same ramp
as ground already textured in it, a tuft with no edge was not there at all. **Nobody draws the outline: the compiler does.** Each empty pixel beside the silhouette, on
its four sides, takes step 0 of the ramp it touches, and where it touches two, the darker. That is a
_selective_ outline: a figure is edged in dark skin, dark cloth and dark steel rather than in one
black line, which is the difference between pixel art and a colouring book. Four sides and not
eight rounds every outside corner by a pixel, which keeps a small sprite from reading as a box. An
outlined sprite leaves a clear pixel round its edge for the outline to go in (held by a test).

## The animation budget

**How much animation each kind has is fixed in advance, in `src/art/budget.ts`, and every sprite is
held to it exactly.** Animation is where drawing by hand creeps: one more frame in a walk looks
better, and then every figure owes it four ways and every armour layer owes it again. So a walk is
four frames, not three and not five, and the timing lives in the budget too, which is what lets the
renderer play any creature's walk on one clock without asking the creature.

| Kind    | Sizes                                    | Animations: frames × facings, ms a frame                                                                           |
| ------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| tile    | 32×32                                    | still 1; loop 4 (250)                                                                                              |
| scatter | 8×8, 16×16                               | still 1                                                                                                            |
| person  | 32×48; 48×64 for a boss                  | idle 2×4 (500), walk 4×4 (150), attack 3×4 (100), cast 3×4 (120), shoot 3×4 (100), hurt 1×4 (150), death 3×1 (150) |
| beast   | 32×32, 48×48, 64×64                      | idle, walk, attack, hurt and death, as a person's                                                                  |
| prop    | 16×16 to 64×64 (the list is in the code) | still 1; spent 1 (a stump, a worked-out vein); loop 4 (150)                                                        |
| effect  | 16×16, 32×32, 64×64                      | play 4 (60)                                                                                                        |
| icon    | 16×16, 32×32                             | still 1                                                                                                            |

Two idle frames are a breath, which separates a figure standing from a figure paused. Four walk
frames are a stride: foot, pass, other foot, pass. Three to a blow are wind-up, strike and recover,
and the strike is the frame a `swing` moment lands on. **Every person and creature faces four
ways** (decision 100), and **a death is drawn once**, being a body falling seen from above.
A sprite need not have every animation its kind allows, only the ones its kind requires (idle, for
a person or a beast), and the renderer falls back to those.

**Either side may mirror the other**, the left drawn as the right flipped. That is how most figures
are drawn and it saves a quarter of their frames; a figure holding something in one hand draws both
sides, since a flip moves the sword to the other hand. The figure kit draws the left as the right
with its arms traded before the flip, so what the right hand holds stays in it. A person with everything is 16 frames a
facing: 51 drawn with the left mirrored, 67 on screen. **Raising a count is a decision about the
game**, since it multiplies across every sprite of the kind and every layer B4 puts on a figure.

## The sprite format

```ts
const CRAB: SpriteDef = {
  id: 'crab',
  kind: 'beast',
  width: 32,
  height: 32,
  legend: { a: 'shell.1', b: 'shell.2', c: 'shell.3', e: 'ink.0' },
  animations: {
    idle: { down: [DOWN_0, DOWN_1], up: [UP_0, UP_1], right: [SIDE_0, SIDE_1], left: 'mirror' },
    death: [FALL_0, FALL_1, FALL_2],
  },
  variants: { cave: { shell: 'shellCave' } },
};
```

A frame is a `grid` of text, one character a pixel, `.` for clear; the indentation every row shares
and the blank lines round a block are dropped, so a sprite reads in the source as the picture it
is. An animation drawn four ways is a `{ down, up, left, right }` of frame lists; one drawn once is a
list. Frames can be made from others (`src/art/format.ts`): `flipped`, `shifted` (a bob, a lunge),
`rekeyed` (a hurt frame flushed red), and `composed`, which lays parts over each other, so a stride
is the same head and body over different legs and a part drawn once is drawn in every frame that
shows it. The placeholders (`src/art/sprites/placeholders.ts`) are built that way.

**A standing sprite is anchored at the middle of its bottom edge.** The renderer puts that point on
the thing's position in the world; the feet stand on the third row from the bottom, the row under
them is the outline, and the last row is the clear pixel the outline rule asks for.

**Anything not yet drawn is drawn as its kind's placeholder**: a mannequin, a grey lump on four
paws, a crate, a ring of light, a token with a question on it, a purple checker. Each fills every
animation its kind's budget allows, so the renderer never asks whether a pose exists, and so the
budget is held against real frames from the day it was written. The terrain tiles
(`sprites/terrain.ts`) were the first real sprites, each written in one terrain ramp's digits and
repeating with no seam; B2 redrew grass and road with texture and gave each several **variants**
(`TILE_VARIANTS`), a cell dealt one by where it is so a field is not one tile stamped over and
over. What differs between variants is kept off a tile's edges, so any sits beside any other (a
test holds every variant to its plain tile's two-pixel border). B3 gave sand, stone, rock and marsh
theirs too, and redrew **stone as irregular flagstones** with their joints a step up from black,
since a bond laid in a grid read as a brick wall lying flat; **rock** is the top of a mass of
boulders, and its face is a tile of its own (below). B2 drew the first figures, to **heroic proportions**: a head over a body three times its height, about
39 pixels of the frame's 48 (decision 103). **The rat** (`sprites/rat.ts`) is the first creature, a
lean sewer rat with red eyes rather than a mouse.

**Every person is one figure, dressed and armed** (`sprites/figure.ts`, decision 104): a head, a
body without arms, legs by stance, and **two arms that are parts of their own, in poses**. **The
body is one silhouette every garment is drawn on** (decision 105): a tunic that narrows to a
belted waist and whose skirt comes down over the thighs, the legs going into it; an arm hangs
against it and is parted from it by its own inner edge a step darker, not by an outline, since a
clear pixel between arm and body is outlined into a line that draws the figure as sticks. A pose
knows where its hand closes, and a thing held (a sword, a staff, a bow, an arrow) knows which of its
pixels the hand closes on, so the two are laid together there: a sword comes out of the fist in
every frame, a wind-up lifts the arm that holds it, and a blow carries the blade across with the
forearm. `tests/art/figure.test.ts` holds every hand in sight on a fist pixel, so a new pose names a
hand that is one. Facing away, what is held out ahead is beyond the body and drawn under it; facing
sideways, the far arm is the near one's pose a shoulder back and a step darker, drawn behind the
body. A figure's grids name **roles, not ramps** (the garment, the cloak, leather, metal, wood, a
glow, gear), and a sprite's `Materials` says which ramp each role is, so one arm is a blue, violet
or linen sleeve; the legend is read off the keys the frames use. **A class starts plain**
(`sprites/people.ts`, decision 105), since zero to hero has to start somewhere: bare-headed, in a
tunic or a robe of its colour, carrying what it fights with. **The warrior** in a blue tunic and
dark breeches with the rusty sword carried low; **the wizard** in a plain violet robe tied with a
cord, with an apprentice's staff of bare wood that a spell still flares from, the other palm lit
to cast; **the ranger** in a green tunic with a quiver slung across it and a bow in the left hand
drawn to the cheek; and **the shopkeeper** in ochre under a leather apron. A figure plays `cast`
and `shoot` where it has drawn them, and swings where it has not.

**What is worn later is the `LOOKBOOK`** (`sprites/armour.ts`), drawn for the user to judge before
B4 wires a figure to what it has on: held by the sprite tests with everything else, and not in
`SPRITES`, so the atlas the game compiles at boot does not carry figures nothing wears yet. Two
kinds. **Later looks** are what the classes wore before they started plain: the warrior's quilted
gambeson, leather spaulders and crimson cloak; the wizard's violet robe trimmed in brass, **under a
hood or a pointed hat** (both are headgear the game has: a hood and a cloth hat), with a staff
whose crystal flares; the ranger's hood and mantle over a leather jerkin. **Armour by tier is drawn
once, in the neutral `tier` ramp, and a tier is a recolour of it**: plate (a breastplate with a lit
ridge, faulds, round pauldrons, a nasal helm, and the arms and legs to gauntlets and sabatons) over
the gambeson and under the cloak, studded leather (a jerkin, a strap skirt, guards and a cap) over a
starting tunic, the hunter's leathers, and a cloth robe under a hat or a hood, each the figure's own
dress with pieces laid over it and fitted to its silhouette.

**Who is drawn with what** is one file (`art/cast.ts`): a table a class, a person and a creature,
anything not in it falling back on its kind's placeholder, a creature's kind read off its `shape`.
**The signpost** (`sprites/props.ts`) is the one prop drawn ahead of B6, a post with two boards
pointing either way, because a crate standing where a zone says where its exits go said nothing.

## Edges between grounds

**An edge is a rule over two tiles, not a picture of each way they can meet** (`art/ground.ts`,
decision 102). A pair of grounds with an edge is a row in `sprites/edges.ts`, lower first: road
under grass, water under grass. **The upper ground reaches into the lower one's cell** by a depth
that wanders along the edge, and the depth is a function of where the pixel is in the whole map
and which boundary line it is on, not of where it is in its tile: the cell on either side of a join
asks the same question, so a shore across four tiles is one line with no step at the joins (held
by a test). Where two sides reach in, the corner between them is rounded; where only a diagonal
does, it is the end of two edges running on in the cells either side, and draws as the block where
they overlap. A style says how far it reaches, how far and how slowly it wanders, how grainy its
edge is and how round its corners, and then **inks the rows either side of where it stops**, by
which side the other ground is on: a north shore shows its bank's face, three rows of earth in
shade over dark water, where a south shore turns it away and shows a lit lip and a line of foam.
Everything not inked is the tile's own pixel, so a composed cell carries on the pattern of both
tiles either side of it, and water's four frames move under a still bank.

**The edge is drawn inside the lower cell, and never lays blocking ground over walkable ground**
(held by a test): where the ground may be crossed is the one thing about terrain a player has to
read at a glance, and a bank drawn a few pixels into the water's cell stops the player at the bank
rather than in the water. **Every pair of grounds that meets in a zone has a row** (a test sweeps
the maps), so no two grounds meet at a hard line.

**Rock stands up inside its own cell** (decision 106). A true 3/4 view would draw a rock's top a
face's height north of its footprint, over the floor behind it, which is blocking ground over
walkable. So rock is the lower ground of every pair it is in, the floor reaching into its cell as
any upper ground does, and a style may give the lower ground **a face** on one side: the rows
nearest the edge drawn from the bottom rows of a tile of the face (`WALL_FACE`, fractured rock lit
down its left edges and split by ledges), its foot at the edge, rather than inked flat. Rock shows
sixteen rows of it on the south, the side the viewer sees, under half a figure so it hides no more
than the boots of whoever stands behind it; its crest is lit on the north, its west side lit and its
east dark, and the floor at its foot is a crevice of shadow. Rock standing in water is the same
face with its foot in the water. The face is where rock stops a player, since it is inside the
cell that does.

## Scatter

**What is strewn over the ground is a kind of its own, baked into it** (`sprites/scatter.ts`,
`art/scatter.ts`, decision 106): clumps of long grass and wildflowers on grass, reeds in the marsh,
pebbles on stone and shells on sand, the 3D view's scatter drawn. A table says what lies on which
ground, how many a cell may hold and how likely each is, and a hash of where a cell is picks, so a
zone is strewn the same every time it is built. Nothing is laid in a cell another ground reaches
into, where it would lie across the edge, or on a building's footprint, and each piece lies wholly
inside its cell (all held by `tests/art/scatter.test.ts`). It is drawn in terrain ramps where it
grows out of the ground, so a tuft in the fen is a fen tuft, and the flowers come in three colours
as variants. It is baked into the ground canvas with the tiles, since it is ground: a figure walks
over it, and a frame pays nothing for it.

## Compiling, and recolouring

**`src/art/compile.ts` turns sprites into pixels**, as pure arithmetic over byte arrays, so it runs
under vitest with no canvas. It expands each animation's frames (a mirrored side flipped from the
side it mirrors), draws each frame as RGBA in the setting it is for, draws the outline, and packs
the frames onto one atlas in shelves, tallest first, with a pixel of clear gutter between them. A
frame is named `sprite/animation/facing/index`, or `sprite/animation/index` for one drawn once.
Terrain ramps differ by setting, so an atlas is compiled per setting; everything else is the same in
each. Every sprite compiles onto one sheet a phone's GPU is promised it can hold, 4096 on a side
(held by a test), whichever renderer ends up holding it.

**A variant is the sprite with whole ramps swapped**, step for step, and compiles as a sprite of
its own (`crab@cave`). It is how the cave crawler can be the crab in chalk and cave water, and how
gear gets its tiers: a piece of gear is drawn in the neutral `tier` ramp, and `TIER_VARIANTS` gives
it a variant for every gear tier, built off `TIER_RAMPS`, so a new tier is a variant of every piece
of gear the moment its ramp exists.

## Text in the world

**The HUD keeps a readable system font, and the world gets a pixel font drawn as data** (decision
100). The HUD is HTML and dense with the numbers Part A labelled; what the world writes (a
nameplate, a damage number, a sign) is baked onto the canvas anyway, so a font drawn as sprites
costs no file. **A capital is at least nine art pixels tall**, drawn at one art pixel: the smallest
scale a phone is given is one CSS pixel to the art pixel (a 360-point phone at two device pixels to
the point), and the nameplate has held nine pixels of glyph as its floor since act three
(`tests/render3d/nameplate.test.ts`). Drawing the font at two art pixels to its pixel would clear the
floor with smaller glyphs, and would put two sizes of pixel on one screen, which is the one thing
the whole-number scale exists to prevent. **The font is `art/font.ts`**: capitals nine pixels tall,
small letters six with three more for a tail, the punctuation names and numbers need, and a
question mark for anything nobody drew (a test holds that every name the data writes has its
glyphs). It is written as sheets, glyphs side by side a space apart, so the source reads as the
letters. A line is outlined on four sides like a sprite, in the darkest step of `ink` whatever
colour it is written in, which is what lets a name read over grass, water and a roof alike; the
renderer colours the ink, since what colour a name is (a creature's level against the player's)
is the game's to say.

## Buildings

**A building is put together from parts over its own footprint, not drawn whole**
(`art/building.ts`, `sprites/buildings.ts`, decision 102). Whole would be a sprite per building at
a size the budget does not list, redrawn the day a row changes; parts are drawn once and the rule
lays them over any footprint the table has. From outside it is a roof laid in courses of slate,
each split its own way, mossed where the rain sits, lit on the slope facing up the screen and on the
one facing the viewer **falling away from the ridge to the eave** (its highlights a step down, and
its last third a step more), which is what reads a roof as pitched rather than paved, with a stone
chimney standing out of the far slope; over
a front wall a head taller than a person, timber-framed in dark oak (posts, a rail, a brace in each
lower panel) over weathered plaster on a plinth of dressed stone, leaded windows lit from inside set
in the frame's panels, and **the way in exactly where `doorGap` leaves the collision's**, since the
door a player sees and the one they can walk through have to be one span. A doorway is two tiles
of a three-tile front, or the whole of a two-tile one, so it is drawn **as the room seen into**: a
back wall of dark boards with a lantern lit on it, and the floor coming forward into the light at
the threshold; a hole of ink that size read as a hole (decision 104). **A building somebody works in
hangs its trade by the door** (`BUILDING_SIGNS`, every building answering): a sack for a store, a
coin for the bank, crossed swords, a shield, an anvil, a tankard, a sheaf and scales, on a board
hung from a bracket just inside the doorway over the dark of the room, or in the middle of a wall
with no door in it. From inside it is a plank floor
ringed by the walls' tops, drawn with the ground, and **only the back wall standing**, open where a
north door is in it: the roof and the front come off the way the 3D cutaway takes them. The three
shapes are the one kit recoloured (`BUILDING_LOOKS`): slate over plaster for a hall, thatch for a
cottage, shingles over boards for a workshop. What stands in a room is B6's.

## The renderer

**Version 2 is drawn with Canvas 2D** (decision 101), chosen by the spike B1 was asked to run
against Three.js with an orthographic camera and PixiJS. The three drew the same scene, a zone at
C1's size with 60 and then 150 figures, their shadows and nameplates, ten effects and the lantern,
under the eight-times CPU throttle smoke's budget is asserted at, and Canvas 2D was the cheapest by
every measure: under a millisecond a frame against two for PixiJS and three to four for Three.js,
still the cheapest by two and a half times with each frame forced to finish, and the only one whose
frames kept pace. It adds no dependency, where the others add 100 kB or more.

What that asks of the 2D view, which the 3D one got from its engine:

- **Draw in painter's order.** The ground, then shadows, then everything standing sorted by where
  its feet are, then effects, then the words. Nothing else decides what is in front.
- **The terrain is baked, not drawn a tile at a time.** A zone's ground is drawn once onto a canvas
  of its own when the zone is built, and a frame draws the window the camera sees in one call; only
  what moves (water, a fire) is drawn over it each frame.
- **Light is drawn over the scene, not computed.** The lantern is a stamp of darkness with a clear
  disc in it, drawn centred on the player; a flash is a frame the compiler made, not a tint.
- **The memory check counts canvases.** The 3D view's leak check read what the GPU held; the 2D
  view holds canvases (the atlas, the baked ground), and a zone change that does not let go of the
  last zone's is the leak smoke has to find. B7 rewrites the check.

Headless Chromium has no GPU, so the spike's numbers are software drawing both ways, not a phone.
They are the numbers the budget is asserted on, and the ordering did not change with what was
counted; on a phone, Chrome and Safari draw a canvas on the GPU.

**The view as built** (`src/render2d/`, B2) is `ZoneView2D`, **the game's view since B3** (decision
106), with the 3D view loaded only for `?renderer=3d` until B7 deletes it; both are handed to the
same host (`host/host.ts`, behind the `ZoneView` interface both answer):

- **The camera** (`camera.ts`) picks the scale, sizes the canvas to the screen in art pixels
  rounded up, and stands the player in **the middle of the band above the tab bar**, following them
  to the map's edge rather than stopping at it: the tab bar eats every tap on it, and a camera
  clamped to the map is what hid the south signpost under it the last time the game was 2D.
  Every position is a whole art pixel, the camera's rounded from the player's own, so the player is
  drawn at the same screen pixel every frame. The ground runs on past the map for eight tiles and
  fades over four into a dark murk (`terrain.ts`), the 3D apron's trick in the 2D view's mood, and
  a soft vignette darkens the screen's corners, drawn over the world and under the words.
- **What is drawn comes from the world each frame**; the view keeps no scene. The sprite sheet is
  compiled once a setting and kept for the session, the ground and the buildings once a zone, and
  every word once while it is drawn (`text.ts`): a word no frame drew is let go at the end of that
  frame, so a fight's numbers do not pile up and the canvas count comes back when it is over.
  **Every canvas is made through one pool**
  (`canvases.ts`) and counted, which is what `gpuMemory()` reports and smoke holds flat across
  zone round trips.
- **An animation plays on the budget's clock** (`animation.ts`): a figure faces the way it mostly
  moves, walks when moving and breathes when not, and a blow or a flinch told by a `WorldEvent`
  plays through once over it. A corpse falls on the world's `deadForMs` and lies for 300ms after
  its fall before it is gone.
- **A tap is picked against flat boxes in the 3D view's priority** (`picking.ts`): a rectangle
  standing up the screen from where a thing's feet are, no smaller than a thumb and reaching a
  little below the feet, and within one kind the one drawn in front wins. A building answers as
  the 3D one does, whoever works there or the ground at its door, and nothing from inside. The
  sweep that holds every creature tappable from where a player fights it runs over the flat boxes
  too (`tests/render2d/picking.test.ts`).
- **What smoke asks of it** is the whole run, every section of which draws in 2D: the canvas at a
  whole scale (`boot`), every thing drawn and canvases flat over three round trips (`teardown`),
  picking, the shopfront, a drag that turns nothing, and the draw budget under the eight-times
  throttle. The `renderer-3d` section holds the fallback: that it boots, draws town, and that its
  camera still turns under a drag with W walking up the turned screen.
