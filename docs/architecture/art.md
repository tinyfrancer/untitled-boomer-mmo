# Art

The style guide version 2 is drawn to, and how a sprite gets from text to the screen: the tile, the
scale, the palette, the light, the outline, the animation budget, the sprite format, the people,
creatures, moments and places drawn in it, the compile step, recolouring, the world's font, and the
HUD's frames, icons and font file.
How the view draws it all is `docs/architecture/rendering.md`.

_Written in version 2's phase B1 (`docs/decisions.md` 100 and 101); B2 added the edges between
grounds, the world's font, the first people and creature, the building kit and the 2D view that
draws them (decision 102), and the user's first look turned the whole of it from cute to heroic
and weathered (decision 103). B3 drew every ground, the edges and faces between them, the scatter
and the lantern, and made the 2D view the game (decision 106). B4 put a person together from what
they chose and what they have on, drew every weapon and offhand as the item it is, and the
townsfolk (decision 107). B5 drew every creature, the bosses grown and the goblins shrunk from the
same figure, and the moments: hits, crits, a level, what flies, the telegraphs, the loot sack
(decision 108). B6 drew the places: every node and what it leaves, the stations and the fire, the
chips a stroke knocks loose, and what stands in a room, the counter included (decision 109). B7
deleted the 3D view and moved this file's account of the 2D one into `rendering.md` (decision 110).
B8 drew the HUD in the same art: its frames, an icon for every item, ability, buff and tab, and the
world's font compiled into a font file for its headings (decision 111). B9, the Part B review,
capped an art pixel at two CSS pixels, so a big screen sees more of the world (decision 112).
Where this and the code disagree, the code is right — and this file is what should be corrected._

**The art is data, and it depends on nothing** (decision 81). A sprite is text in `src/art/`:
rows of characters, one per pixel, each a key in the sprite's legend, which names a palette step.
The compiler turns that into pixels at boot, so the game still loads no image file. `src/art/`
imports no package at all (`tests/art/sprites.test.ts` holds it, and since B7
`tests/architecture/seam.test.ts` holds the whole of `src/` to it), because it has to outlive the
renderer that first draws it: Part B replaced one renderer with another, and B7 deleted the old one
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
camera held (`TARGET_TILES_ACROSS`): four on a 390-point phone at three device pixels to the point
(9.1 tiles across), two on a 360-point phone at two (11.3), two on a 1280×720 desktop (11.3 tall).
**An art pixel is never drawn wider than two CSS pixels** (`MAX_CSS_PER_ART`, decision 112), the
size the character sheet draws the same figure at, so a big screen sees more of the world rather
than a bigger one: two on a 1280×800 desktop (12.5 tiles tall, where ten tiles drew it at three and
eight tall) and on a 1920×1080 one (17). No phone reaches the cap.
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
- **Step 2 is the material's own colour**, the one a player would name it by. Each gear tier has
  a ramp of its own (held by a test), which its pieces are recoloured into on the figure and in the
  bag alike, so a set is the same set in the pack and in the world. Since B8 the HUD draws only in
  these ramps too (`THEME` reads them through `rampStep`, `tests/ui/theme.test.ts`).

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

**People, beasts, props, icons and scatter are outlined; tiles, effects and frames are not.** A figure
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
| mark    | 32×32                                    | loop 4 (250)                                                                                                       |
| person  | 32×48; 48×64 for a boss                  | idle 2×4 (500), walk 4×4 (150), attack 3×4 (100), cast 3×4 (120), shoot 3×4 (100), hurt 1×4 (150), death 3×1 (150) |
| beast   | 32×32, 48×48, 64×64                      | idle, walk, attack, hurt and death, as a person's                                                                  |
| prop    | 16×16 to 64×64 (the list is in the code) | still 1; spent 1 (a stump, a worked-out vein); loop 4 (150)                                                        |
| effect  | 16×16, 32×32, 64×64                      | play 4 (60)                                                                                                        |
| icon    | 16×16, 32×32                             | still 1                                                                                                            |
| frame   | 8×8, 16×16, 24×24                        | still 1                                                                                                            |

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
paws, a crate, a ring of light, a token with a question on it, a purple checker, a purple border.
Since B8 everything the game draws is drawn for real, the HUD's icons and frames included. Each fills every
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
(`sprites/people.ts`, `CLASS_DRESS` in `art/outfit.ts`, decision 105), since zero to hero has to
start somewhere: bare-headed, in a tunic or a robe of its colour, carrying what it fights with.
**The warrior** in a blue tunic and dark breeches with the rusty sword carried low; **the wizard**
in a plain violet robe tied with a cord, with an apprentice's staff of bare wood that a spell still
flares from, the other palm lit to cast; **the ranger** in a green tunic with a quiver slung across
it and a bow in the left hand drawn to the cheek.

**A person is put together from what they are and what they have on** (`art/outfit.ts`, decision
107): the class's garment in its colour, the look they were made in, a piece on each slot that has
one and a weapon in the hand, composed at the level of the grids and compiled as one sprite. At the
level of the grids rather than stacked as sprites at draw time, so the compiler outlines the figure
once, round its silhouette: armour drawn as a sprite over a sprite is a figure made of outlined
blocks, the disjointed look decision 105 mended. **Each slot is dyed into a ramp of its own**: a
piece is written in the keys it reads best in (the `tier` ramp's `A`-`E`, a blade's metal, a staff's
glow) and rekeyed into its slot's role when it is worn (`dyed`, `figure.ts`), five generated keys a
role for the helm, the legs, the other hand and a weapon's blade, haft, fittings and stone, so a
steel helm sits over studded legs and a tier is still a recolour of one piece. A frame's outermost
ring of pixels is left clear for the outline whatever reaches it: a blade drawn back or a hat risen
on a stride is cut a pixel short of the edge.

**What each item is drawn as is a row** (`art/wardrobe.ts`): the piece a helmet, a chest or the legs
put on, the weapon in the hand, what fills the other one, and the ramp each is drawn in, the tier's
unless the row says otherwise. An item with no row falls back on what the data says it is (a
helmet by its armour type, a weapon by its shape), so a new item is on the figure the day its row
is; `tests/art/outfit.test.ts` holds every item the game has to a row of its own. **The pieces**
(`sprites/armour.ts`) are what B2's lookbook was, and the grand looks a class wore before it started
plain are what it grows into: a leather cap, a nasal helm, a pointed hat, a hood, and the hunter's
cowl with its mantle; a cutthroat's bandana over the nose and mouth, and a crown of gold; a leather
jerkin, studded or plain, over the tunic; **plate over a quilted gambeson, the steel under the
crimson cloak**; a robe, and the fen's trimmed in brass; a vest of hide; breeches, and greaves to
the toes.

**Every weapon is drawn as the item it is** (`sprites/weapons.ts`): a rusty sword, the chief's
cutlass with its knuckle bow, the king's leaf blade; a felling axe, a bearded fighting axe, a
pickaxe and the goblin's maul; an apprentice's staff, a staff with a crystal in its head and the
king's gold-shod staff; a fishing pole with its line and float; a bow, and the king's longbow drawn
out from it. **A swung weapon is drawn once, upright**, and its six carries are made from that one
drawing: turned upside down to be carried low, left still lit (`inverted`); a quarter clockwise to
be brought across, lit along its top (`turned`); leant a pixel a row to be carried point forward or
drawn back from the side, which is how B2's rusty sword was drawn by hand. The kit says how a hand
holds each kind (`figure.ts`): **swung**, **planted** (a staff or a pole, a spell flaring from a
staff's head in its stone's colour) or **drawn** (a bow, in the other hand, the arrow on the string
the figure's own). The other hand carries a shield strapped over the forearm, its face toward the
viewer and over the arm, or a light in the hand, an orb or a lantern, which a spell is cast from;
a quiver is worn on the back. A figure plays the blow its weapon makes, `cast` unless a bow or a
shield leaves it no hand to cast from, and `shoot` only with a bow. **The wizard's weapons are
staves** (decision 107): a wand read as a dagger at the size a figure is drawn, so the three were
renamed to what they are drawn as, and their ids with them once version 1's saves had retired
(decision 113).

**A character is made in a look** (`CharacterState.look`, decision 107): a skin (pale, fair, tan
or deep, each a ramp), a hair colour (brown, black, fair, red or grey, grey drawn a step lighter
than its ramp's middle) and a hairstyle (`sprites/hair.ts`): cropped, which is the head B2 drew and
what every character from before the choice wears, long past the shoulders, tied back into a tail,
shaved to stubble, or bearded. A hairstyle is a whole head drawn three ways round and what falls
below it, laid over the shoulders, rather than hair laid over a bald head, since hair frames a face
rather than sitting on it. A hood shades the face under it; a piece that covers the head is what a
body lying where it fell shows of it (`covers`).

**Who is drawn with what** is one file (`art/cast.ts`): the six who stand in a town, each a getup
of a garment, a look and what they hold, told from one another at a glance the way their colours
were in 3D (a merchant in ochre under an apron, a clerk in teal with a shaved head, an old soldier
in iron plate with a sword, the quartermaster in a cap and studded leather with a shield, the
outfitter in leather over linen, and the fettler sooted under an apron with a hammer); and a
creature, anything not in it falling back on its kind's placeholder, a creature's kind read off its
`shape` (`tests/art/cast.test.ts` holds every creature the game has drawn for real). The player is
not there: they are what they chose and what they have on.
**The signpost** (`sprites/props.ts`) was the one prop drawn ahead of B6, a post with two boards
pointing either way, because a crate standing where a zone says where its exits go said nothing.

## Creatures

**A creature built like a person is a getup on the figure** (`art/cast.ts`, decision 108), dressed
the way the townsfolk are and carrying mostly what it drops, so the thing a player takes off a
body is the thing they saw it holding: the bandit in undyed cloth under a brown jerkin, a red rag
over the face and the knife it throws (`DAGGER`); the fen raider in oilskin under a fenweave hood
with a boat's hook (`GAFF`); the goblins green and bald with their ears swept out (`GOBLIN_EARS`,
laid under the head so only what sticks out shows), the scavenger in rags with an axe it found,
the miner pale in a leather cap with its pick; the wight bone under a grave-shroud and a linen
wrap, lank grey hair, the sword and shield it was buried with gone to verdigris. A getup may name
a **skin** nobody is made in (a goblin's green, the bone of the dead), a **cloak** colour, and
**eyes lit from inside** in a glow ramp (the goblins' yellow, the dead's green). A creature fights
and does nothing else (`fighterSprite`): no spell and no shot, since a creature's throw is its
swing.

**A body is built one of three ways** (`Build` in `art/outfit.ts`): as the figure is drawn, a
goblin, or a boss. **A boss is drawn bigger rather than scaled up** (the budget's 48×64): the
figure's frames are refit (`refitted`, `art/format.ts`), a dozen rows doubled through the chest,
the waist and the shins and six columns through the shoulders, the cheeks and the legs, so he
stands a third again as tall and as broad with the face he was drawn with, and every pixel stays
one pixel. Scaling by four thirds would draw some pixels twice as wide as their neighbours at
random, which is the shimmer the whole-number scale exists to prevent. **A goblin is the same
refit the other way**, four rows and two columns left out, a head shorter than the men it robs
and pinched. A body lying where it fell is refit along its length rather than its height, being
seen from above. The chief is a head taller than his men in a merchant's coat he did not pay for,
the cutthroat's bandana and his cutlass; the king is crowned, in plate gone green under a cloak
gone dark, with the leaf blade he drops.

**The beasts are drawn as parts** the way the rat is (`sprites/crab.ts`, `sprites/lurker.ts`): a
body, legs by stance, and what they bite with. **The crab** is a low broad shell on six legs, a
pincer either side of the front and black eyes on stalks, the pincers raised and shut for a blow;
**the cave crawler is the crab in chalk** (`crab@cave`, a variant swapping `shell` for
`shellCave`), as this guide's own example had it. **The bog lurker** is a toad the size of a dog,
warty and humped, a mouth right across its flat head that drops open on a red maw to bite, and
yellow eyes bulging on top.

## Moments

**A moment is an effect sprite played once and held fading** (`sprites/effects.ts`,
`render2d/effects.ts`, decision 108). Each plays its four frames on the budget's clock, and the
view may hold the last one and fade it, in four steps rather than smoothly, for as long as the
moment wants, as a corpse lies after its fall: the budget fixes the frames, not how long light
lingers. **A blow landing** is a star of light at the chest of whatever it landed on, white
through gold, and in blood when it is the player who took it (`hit@blood`); **a crit** is the same
star twice the size, its rays running out through fire. **A level** is a ring spreading over the
ground from the feet and a column of light standing up through the figure, motes rising off it,
drawn at four fifths so the player shows through and held for most of a second. **A fireball**
flickers as it flies and **a knife** turns end over end (`thrownSprite`, `art/cast.ts`: a knife for
the bandit's throw and a fireball for every spell). **The loot sack** is a prop, sackcloth tied at
the neck with a coin spilled beside it, and blinks its last ten seconds as the 3D one did.

**Two moments are not sprites**, since no fixed frame can be them. **An arrow** is a line of
pixels in the palette's ramps (a steel head, a pale shaft, bone fletching), stepped a pixel at a
time along whichever axis it travels further in so it has no gap and no doubled pixel at any
angle (`arrowPixels`); a sprite turned to the angle would smear, and the budget gives an effect no
facings. **A telegraph** is a rim at the reach an enemy ability lands at and a disc filling out to
meet it over the wind-up, in `red`, laid on the ground under everything standing, the 3D view's
rule drawn flat: the shout over the creature's head says something is coming, and the ring says
where. The rim and a full disc are baked the first time a reach is wound up (`Telegraphs`) and the
fill drawn from the disc at whole pixels with no smoothing, so a disc stays a disc of pixels as it
grows; tracing it a row at a time would be hundreds of calls a frame for the king's.

**A number rises off the top of whatever it came off**, from its health bar up past its name, so
one thrown off a boss clears his head as one off a rat clears the rat's (`heightAt` in the view,
which finds the creature or the player standing at the spot a moment names). It holds full for the
first half of its life and fades in steps, a crit's climbs further and lasts longer, and one born
at a spot where another was a moment ago goes up a line over it: a blow soaked and a blow landed,
the XP and the level, are told at once.

## Places

**Every place a player works is drawn, and what each is drawn as is one table** (`art/places.ts`,
decision 109), as creatures are `cast.ts`: a node by its id, falling back on the drawing of its
`shape`, so a new node is on screen the day its row is; each station and the fire by its id; and
what a stroke of the tool knocks loose by the node's shape (`tests/art/places.test.ts` holds every
node, station and stroke to a real drawing).

**What a zone hides is drawn as the thing it is** (`sprites/secrets.ts`, decision 117), and
`art/places.ts` says for each whether it lies flat in the ground, drawn with the ground under
everything standing, or stands up and is sorted by its foot like a station: the Lamp Stone a pillar
with an empty iron cage, the cellar hatch planks bound in iron with a ring, the warden's niche a
dark arch in dressed stone. Nothing is written over one. The Candles are no drawing of their own but
rock standing in the sea, and the sea-wall's top the stone floor, which met sand for the first time
and so added the one edge `STONE_UNDER_SAND`.

**A tree is a canopy of leaf clumps over a trunk** (`sprites/trees.ts`), at the prop budget's 64
square: a crown two tiles across standing half again as tall as a person, since a tree a person
could see over is a bush. Each clump is a ball lit from the top-left with a crescent of light inside
its upper rim and a seam of shade along its lower one, painted back to front so the lower clumps sit
over the higher, with small leaf marks over it; drawn by a generator and pasted in as the picture it
made, as the lookbook's rings were. It is drawn in the setting's `foliage` and `bark`, so a tree in
the fen is a fen tree. The three woods are told apart at a glance: **the tree** round-crowned on a
trunk a person could put their arms round, **hardwood** broader and darker on a trunk twice as thick
flaring into roots, and **the willow** a crown in the lighter green of the grass with strands hanging
from it nearly to the ground, parted where the trunk comes down. **A felled tree is its stump**,
the trunk's foot with its cut face in pale new wood (`thatch`), so the node does not move when it
runs out and is still the thing to look at to see whether it is back. The crown blocks nothing, and
**the view fades it while the player is behind it**, as a roof is faded.

**A vein is a boulder of the setting's `rock` with the ore in its seams** (`sprites/veins.ts`), cut
into a few planes lit from the top-left, a smaller stone leaning on its left. **The ore is drawn in
a neutral `ore` ramp and recoloured into the ore the vein yields** (`ORE_VARIANTS`, `vein@tin`), the
way gear is drawn in `tier`, and step 2 of each ore's ramp is the ore's colour in the bag, so a lump
of tin is the same grey in the rock as in the pack (held by a test, as the 3D view read the colour
off the item). **Coal is a seam** (`seam@coal`), a black band laid across the stone glinting where it
catches the light, since ore nearly as dark as the rock it is in did not show as a thin vein; **the
rich vein** is a bigger stone with the ore running through all of it. A worked-out vein is the same
rock with pits where the ore came out.

**A fishing spot is a mark**, a kind of its own (decision 109): rings spreading on the water where
something touched it, a new one born as the outer breaks up, looping on the water's own clock (four
frames of 250ms, as a water tile's). Light on water rather than a thing standing, so it is not
outlined, which drew the rings as loops of dark wire; each crest has a line of trough under it on
the side turned from the light, which is what reads it on water of any setting. It is drawn in the
setting's `water`, lies centred on the spot under everything standing, and has no shadow.

**The stations** (`sprites/stations.ts`) are each a silhouette of their own, as the 3D ones were:
**the forge** a block of dressed stone with a bed of coals in its top and its mouth glowing, an anvil
on a stump in front, looping as a few embers brighten and dim and a spark goes up; **the tannery** a
vat of liquor with a hide laced to a frame behind it; **the fletcher's bench** a plank on splayed
trestles with shafts laid on it, heads one way and fletching the other, and a strung bow stood
behind. **The fire the player lights** is a ring of stones, two logs crossed, embers and a flame
over them, looping, and stands on no shadow, since what it throws is light.

**A stroke of the tool knocks something loose** (`sprites/chips.ts`): on each of a gather's two beats
(`ui/gatherBeat.ts`, the frame the tool comes down on), chips of pale new wood off a trunk, flakes of
pale stone off a rock (`chips@stone`), or drops off the water (`splash`, in the shared `spray` ramp,
since a splash is light and the water it comes off is coloured by the setting), on the side of the
node the player stands on and at the height the tool lands.

**What stands in a room is `art/rooms.ts`** (decision 109): the 3D view's fittings table moved out of
`render3d/` in B6 so both views stood the same furniture in the same places, each fitting against a
wall named from the doorway looking in, on ground no deeper than the wall. The view draws each
against its wall by compass: from the front against the north wall
(**shelves** long enough to show either side of whoever stands in front, a **hearth** with its
chimney breast up the wall, a heavy **bench**), along its length against a side wall (the bench seen
lengthways, a **bed** seen from above, a hearth with its mouth facing the room), and against the
south wall, which the cutaway takes away, only as low as it stands (the hearth as the stone it burns
on). **Whoever works in a room stands behind a counter** just in front of them toward the door
(`COUNTER_AHEAD`), a lit top over a panelled front that hides their legs to the knee and ends short of where the
walk up to them stops, which is what makes a person in a room a shopkeeper rather than somebody
standing in one. None of it blocks, and none of it is drawn until the player is inside, as the floor
is. `tests/art/rooms.test.ts` holds the layout's rules and that nobody standing on the three spots
the game puts a body is drawn in the furniture.

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

**The world gets a pixel font drawn as data** (decision 100), and since B8 the HUD sets its
headings, tabs and buttons in it too, while its dense lines keep a readable system font (decision
111). What the world writes (a nameplate, a damage number, a sign) is baked onto the canvas, so a
font drawn as sprites costs no file; the HUD is HTML, so its copy of the font is written as a font
file in memory (below, under The HUD). **A capital is at least nine art pixels tall**, drawn at one art pixel: the smallest
scale a phone is given is one CSS pixel to the art pixel (a 360-point phone at two device pixels to
the point), and the nameplate has held nine pixels of glyph as its floor since act three
(`tests/art/font.test.ts` holds the capitals). Drawing the font at two art pixels to its pixel would clear the
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
north door is in it: the roof and the front come off the way the 3D cutaway took them. The three
shapes are the one kit recoloured (`BUILDING_LOOKS`): slate over plaster for a hall, thatch for a
cottage, shingles over boards for a workshop. What stands in a room is below, under Places.

## The renderer

**Version 2 is drawn with Canvas 2D** (decision 101), and how the view draws what this guide
describes — painter's order, the baked ground, the camera and the tab bar, the words, the moments,
picking, what the view holds and what a frame costs — is `docs/architecture/rendering.md`, which
became the 2D view's when B7 deleted the 3D one (decision 110). What the choice of renderer asks of
the art is all said above: a sprite is drawn at whole art pixels, light is drawn over the scene
rather than computed, and what never moves is baked.

## The HUD

**The HUD is drawn in the same art** (B8, decision 111): its frames and its icons are sprites like
any other, held to the budget, the palette and the outline by `sprites.test.ts`, and compiled by the
same compiler; `hud/hudArt.ts` only writes the results onto a canvas once a page and hands them to
the stylesheet. `rendering.md` has nothing to say about them, since the view never draws them.

**A frame is a sprite kind of its own** (`sprites/frames.ts`, `art/hud.ts`): drawn to be cut in nine
by the page, its corners once and its edges stretched to whatever box it goes round, so every edge
is the same all along its length and the middle one colour (`tests/art/hud.test.ts`). It draws its
own edge, which is what a frame is, so the compiler outlines none. **A panel** is an outline of ink,
an iron band four pixels wide bevelled like a bar standing proud of the panel, a line of the accent
inside it and a brass plate riveted over each corner, the rivet a stone in the accent, round a face
of dark stone. The accent is drawn in `tier` and recoloured per counter (`frame-panel@gold`), the
brass left alone. **A button** is a slab of masonry lit on its top and left, pressed in (the light on
its bottom and right), flat when it cannot be pressed, gone to blood when armed, or ringed in an
accent (the tab that is open, Idle while it runs); **a row** is a lower slab, and **a slot** a pit
of ink with a lip of light along its bottom and right.

**An icon is what the thing is, drawn at 32 pixels** (`art/icons.ts`, `sprites/itemIcons.ts`,
`sprites/abilityIcons.ts`), a tab's mark at 16 (`sprites/markIcons.ts`). Gear is drawn off the
wardrobe (above): a piece in `tier`, a weapon's blade in `metal`, its haft in `wood`, its fittings in
`gold` and its stone in `arcane`, and each item a variant dyed as the figure dyes it, so the helm in
the bag is the helm on the figure. What is not gear is drawn in its plainest self, raw and uncooked,
and cooking, burning, curing and smelting are recolours, into `roast` and `char` where nothing
else would do; a vein's ore and a lump of it in the bag are one ramp (held by `places.test.ts`).
The icons were **painted by a generator and pasted in**, as the trees were: shapes filled as
materials, shaded by the light above (a sphere for what is round), and written into the source as
the grids they made, so the source reads as the pictures and a hand can touch up a pixel.

**The HUD's copy of the world's font is a TrueType file written in memory** (`art/fontFile.ts`):
every inked pixel of `font.ts` a square of the outline, runs of them merged into rectangles, sixteen
glyph pixels to the em, so set at 16px a glyph pixel is a CSS pixel and nothing is smoothed. It is
plain arithmetic over bytes like the compiler (`tests/art/fontFile.test.ts` holds its tables, its
checksums and that each glyph is exactly its pixels), and a page takes it through `FontFace`; smoke
holds that a real browser does. A character the font does not have falls through to the system
font beside it, so a heading with a dash in it still reads.
