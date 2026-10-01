# The HUD

The HTML overlay: its look, the player column, the map, buffs, layout, icons, the tab bar and the menu, and the channel bar.

_Moved out of `CLAUDE.md` on 2026-09-25 (`docs/decisions.md` 57). The paragraphs are the ones that were there, in the order they were there; `CLAUDE.md` keeps the rules and points here for the reasoning. Where this and the code disagree, the code is right — and this file is what should be corrected._

**The HUD is an HTML overlay over the canvas** (`src/hud/`, engine-free). `mountHud()` builds one
`<div class="hud">` inside `#app` and it outlives every zone, like the session does. The only thing
it talks to is the `EventBus` it was handed (`world/eventBus.ts`), which is what makes it
renderer-independent by construction: the same tree sat unchanged over both canvases during the
port, and nothing drawing the world knows it exists.

`Hud.ts` owns the model and the subscriptions; everything else in `hud/` is a piece that draws part
of it. Char / Bag / Quests / Idle / Feats / Skills / Whispers / Map / Log are `Sheet` subclasses and one is open at a time — `Hud`
holds a single `openSheet`, not a visible flag per panel — while Menu and Options are actions
that open no sheet. The shop, the slot picker, the options menu and the away report are overlays
built on open and removed on close. A tap on a person puts up the **talk panel** (`hud/TalkModal.ts`)
in the slot every counter uses: their name with their trade beside it, what they are saying (their
greeting, or their answer under the question that drew it), the topics they will talk about as a
button each, grey once heard until they have something new to say (`economy.md`), a button for the
counter they work, and their quests (`hud/talkQuests.ts`), which no counter draws any more. The
topics are derived from the HUD's model by `DialogSystem` (level, class, quest log, and what has
been asked, which is seeded from the save and kept current on `ASKED_CHANGED_EVENT`), and what is
being said comes from the world on `CONVERSATION_CHANGED_EVENT`, ids rather than words. Every role counter's panel is its own
list with a **Back** to the conversation put at the front of its head by `OverlayHost` rather than
by the panel, which is why each modal hands the host its `head` (`economy.md`). The options menu
also holds the one setting
that is not the character's — mute and volume, which the HUD is handed at mount and sends back
whole on `SOUND_SETTINGS_CHANGED_EVENT` (`audio.md`) — beside the two that are, the tips and the
minimap, each a switch that asks and is answered by whoever keeps it.

**The options menu holds the save too** (decision 97): Download Save, Copy Save Code and Load a
Save, over Reset Character, in a body that scrolls with Close outside it, and it stops above the tab
bar (`hud-modal--above-bar`) since a landscape phone is shorter than the list. A code is shown in a
box as well as copied, because the clipboard is refused over plain http (a phone on the dev server's
LAN address) and the text on screen is always there to copy by hand. **Load a Save**
(`hud/LoadSaveModal.ts`) takes a file through a hidden picker or a code pasted into a box, which
takes a file's JSON too; the box turns text selection and iOS's paste callout back on, which `.hud`
turns off for all its furniture, and is 16px so iOS does not zoom to it. The preview puts the
character in the save beside the one playing now, and Replace asks twice. The creation screen
offers the same panel (a new device has nobody to replace, so one tap loads), hung beside the
screen rather than in it, since the screen scrolls on a short phone, and dimmed behind.

**The HUD is drawn in the world's art** (B8, decision 111), so Part A's words and Part B's world
look like one game. Three things carry it, each made at boot out of data like every sprite, and
none of them a file loaded:

- **Frames.** Every panel is dark stone inside a bevelled iron band with a brass plate riveted over
  each corner, every button a slab of stone that presses in, a list's row a lower slab and a
  bag's cell a pit sunk into the panel (`art/sprites/frames.ts`). A frame is a sprite kind of its
  own, and the page cuts it in nine (`border-image`), so its corners are drawn once and its edges
  stretched, which only works because every edge is the same all along its length
  (`tests/art/hud.test.ts`). A counter still says which it is by colour: its accent, the line
  inside the iron and the stone in each rivet, is recoloured per counter (`FRAME_ACCENT` in
  `ui/theme.ts`), the way its border did before.
- **Type.** Headings, tabs, buttons and names are set in the world's own font, written as a
  TrueType file in memory from `art/font.ts`'s glyphs (`art/fontFile.ts`) and handed to the page as
  a `FontFace`; the dense lines, the numbers Part A labelled and the sentences, keep the system
  sans, which is also what the page draws in until the font has loaded, or if it never does. The
  font is only ever set at a whole multiple (16px, a glyph pixel to a CSS pixel, or 32px for a
  title) and never made bold or slanted, which would smear the pixels it is made of.
- **Colour.** Every colour the HUD names is a step on the art's ramps (`THEME` reads them through
  `rampStep`), and `tests/ui/theme.test.ts` holds the theme and every colour the stylesheet writes
  to the palette, so a new rule with a hex in it fails. A bar's fill is shaded in its ramp as pixel
  art is, a lit top row and a shaded foot.

**The HUD's pixel is one CSS pixel.** An icon of 32 is 32 CSS pixels, a panel's iron is eight, and
only a title (the font at two) and the character sheet's figure (at two) are bigger. On a phone that
is the world's own pixel, near enough; on a desktop, where the HUD was already drawn phone-sized, it
is half the world's, which is drawn at two CSS pixels to the art pixel and never more (decision
112), the size of the sheet's figure and the titles. `.hud` scales every picture nearest-neighbour,
since a phone draws each CSS pixel two or three times over.

**The pictures reach the page once a page** (`hud/hudArt.ts`, installed with the stylesheet): each
frame and one sheet of every icon are written onto a canvas and handed to a stylesheet of their own
as custom properties (`--hud-frame-panel`, `--hud-icons`), and an icon is an element showing its
square of the sheet (`iconEl`), keyed by its frame (`data-icon`). jsdom has no canvas to write on, so
a test's HUD comes up in the stylesheet's plain borders and the system font, every box the size the
frame would have made it; smoke is what sees the art reach a page (its `hud-art` section).

**The creation screen draws in the world's art** (decision 107). Each class's card is a picture of
it as it starts, compiled from the same outfit the world draws (`art/outfit.ts`'s `portrait`) onto
a canvas at three CSS pixels to the art pixel, and under the cards a row each for skin, hair colour
and hairstyle: swatches for the two colours, named buttons for the style, each labelled with what it
is, the chosen one marked. A smaller picture of the chosen class (the warrior until one is) sits
beside the rows, since on a phone the cards have scrolled away by the time a look is being picked.
jsdom has no canvas to fill, so there the cards come without their pictures.

**An overlay that takes a key says so.** Escape closes whatever is open and is also the world's
"drop the target", and the two used to hear it independently, so closing a panel mid-fight dropped
the target too. `bindHudKeys` listens in the capture phase and cancels a key an overlay took, and
the world's `bindKeyboard` ignores a cancelled key — which holds whichever of the two was bound
first.

**The player column is bars, and a bar's numbers go inside it** (`hud/PlayerColumn.ts`): name and
level on one line, then health, mana and XP stacked, then the buff row. Three bars with three
captions under them is six rows of eye travel for three facts, and the top-left corner is read at a
glance mid-fight or not at all — so `.hud-bar__label` sits over the fill rather than beside it, which
is also why the trough is solid (over grass, a half-transparent empty end reads as grass).
Max HP is not on the wire — `player-hp-changed` carries the current value alone — so the ceiling is
recomputed from the gear and level the HUD's model already holds, which is why a gear swap and a
level both have to refresh it.

**The rested bank is a paler segment ahead of the XP fill** (decision 127, `afk.md`): the fill's violet
at its lightest step, a third strength, drawn under the fill from the bar's start to as far as the
bank carries the bar (`restedReach`), which is twice the bank while it doubles, so its far end stays
put as it is spent and only the fill moves up to meet it. It stops at the bar's end, and what is
left carries into the next level. While any is banked the line inside the bar names it ("96 / 200
XP, 25 rested") in place of the percentage, which the bar already shows. The bank arrives on the XP
gain (`CombatXpGain.rested`, since spending it is an XP gain) and, while idle fills it, on
`rested-changed`, said when its whole number moves rather than every frame.

**The column stands on a backing of the world's darkest ink** (decision 112), at three-quarters
strength, because it is the one piece of top furniture with no panel: its words and bars are laid
straight on the world, and a name the world wrote under them (a rat's, a shopfront's) read between
their lines. The backing is a `::before` drawn six pixels round the column and behind it, so it
adds nothing to the height `ui/layout.ts` counts for the column and nothing below it moved.

**Arrows are a bar too, where a wizard's mana goes** (act three phase 12). Anybody wearing a quiver
gets one — count against capacity, and "Out of arrows" when dry, since an empty quiver is the one
thing about it worth seeing — and `ui/layout.ts` reserves it as `hasQuiver` the way it reserves mana.
It is fed by `quiver-changed`, which the world sends with every bag change and every shot, and seeded
from the save like the bag. The character sheet's Attack is computed with the arrow the next shot
nocks, names the stat it was built on from the weapon rather than the class, and the offhand row names
the arrows beside the quiver. Under it the sheet adds up **Armour** and says the share of a hit it
stops, read off `damageReduction`, the curve `CombatDirector` cuts a hit by (decision 99): it was
the largest number on most armour and went into a total no panel showed.

**The skill being trained is a bar too, under XP** (decision 94, `hud/TrainingBar.ts`), reserved by
`ui/layout.ts` as `hasTraining`. It is put up by a skill's XP when the player earned it by doing
something — a gather, a make, a swing, a cast — and never by Block or Parry (`isDefenseSkill` in
`systems/CombatSystem.ts`), which train on what is swung at the player and would flip the bar
between themselves and the weapon every few seconds of a fight. It fades half a minute after the
last XP into its skill, on a **timer of the HUD's own**, as a held finger's is: the HUD has no game
time, and a bar in the corner is not worth publishing one for. That is why it is the one piece of
the column that tells `Hud` it has gone (`onTrainingHidden`, which re-runs the layout) rather than
being told, why `Hud.test.ts` holds the fade against a fake clock, and why smoke never waits for it
and measures the column's height with the bar taken back off (`columnHeightBesideTraining`) wherever
it compares the column across a stretch of play. A character level redraws it, since a combat skill
at its ceiling reads `(max)` until the level raises that. It is a button, opening the skills book at
its skill's page, and its top padding is the gap the bars above take as a margin, so a thumb has the
gap as well as the bar. Where the longest name meets the largest XP, the name gives way to an
ellipsis before the level and XP do.

**The map zooms out, and the zoomed-out view is a map you read** (`worldMap()` in
`systems/MapSystem.ts`). Its whole layout is **derived from the exits already in `ZONES`** — walked
breadth-first from town, placing each zone one step from its neighbour in the direction the edge
that reaches it points — so a coordinate cannot drift out of step with where walking actually takes
you, and a zone added to the table with its exits wired appears on the map with nothing else written
down. A zone's level band is derived the same way, off its own `mobSpawns`. **Nothing on it is a way
of going anywhere.** Tapping a cell used to ask the world to travel there, and that went with fast
travel; the only press it still answers is on the cell being stood in, which zooms back in to it —
a request about the panel rather than about the world. A cell that still looked pressable and did
nothing would be the dead button this HUD does not keep, so the handler is gone rather than
disabled.

A locked zone is drawn shut on that view and that is the whole of what the map does about it: the
door is met at the edge, where walking into it earns the toast naming the key. The map used to be a
third way through one — it spent the key, the same as pushing it open in person — which left `Travel`
and the walk as two routes to keep in step. The cell is drawn from `zoneAccess`'s three answers, so holding the
key looks different from not holding it; the sheet reads the bag through a **getter** rather than
being handed it once, because the key can be looted with that very panel open. Which doors have been
opened is the one thing about this the HUD cannot derive, so it rides its own event
(`unlocked-zones-changed`), unseeded like the map's other two.

**The map is drawn from the zone's id and nothing else** (`systems/MapSystem.ts`, drawn by
`hud/MapSheet.ts` as inline SVG in tile units). Terrain, the exits and what is worth walking to all
come back out of the tables the world was built from — the same points `populateZone` stands things
at — so the map cannot disagree with where things actually stand, and
the HUD needs telling nothing but which zone is running. Only the player's dot is on the wire.
That is two events rather than one (`zone-entered`, `player-tile-changed`) precisely so a walk moves
the dot without rebuilding the terrain under it; the tile event is keyed to whole tiles so a position
never reaches the HUD on the per-frame channel, and both are published **from the tick with no seed**
— the host mounts the HUD after building the world, so a constructor-time emit would fire into a bus
with no subscriber and leave the map blank until the first zone walk. Terrain is banded into runs of
identical tiles (`terrainBands`), which takes a 475-tile zone down to 65 rectangles, each in **its
ground's own colour in the zone's light** (`tileColour` in `art/sprites/terrain.ts`, step 2 of the
tile's terrain ramp in the zone's setting, decision 111), so the map of a cave is as dark as the
cave and a pond is the pond's blue; a world-map cell is its zone's grass, or its rock when shut. **No
creatures on the sheet**: it is the plan of the place, opened to find the forge, and the creatures
near the player are the minimap's (below), which is the map looked at mid-fight. No tap-to-travel
either.

**A building's name is drawn over the markers, and its ground under them.** The keepers of the
counters stand inside the buildings they work from (the interiors plan moved them in), so a name
drawn before the dots had an NPC's dot through it. Names go after every marker and before only the
player's dot; the label outline (`.hud-map__label`) keeps a name readable over whatever it crosses.
**Every building's name is the same size** (decision 112): set once, broken onto two lines at the
space that leaves the longer line shortest when it is longer than its footprint holds
(`nameLines`), and squeezed to the footprint only where a line still would not fit, never
stretched. A name used to be set to its footprint's width, which made "Bank" three times the size
of "Quartermaster's Post" on the same map. An exit's name hangs under its marker, and **over it at
the bottom edge**, where under it hung off the map and over the sheet's frame.
`Hud.test.ts` holds the order.

**The minimap is the zone map windowed round the player** (decision 115, `hud/Minimap.ts`):
twenty-seven tiles a side (`MINIMAP_TILES` in `systems/MapSystem.ts`) at four CSS pixels a tile
(`THEME.minimap.tile`), in an iron panel with the zone's name under it in the world's font.
Everything on it but the creatures and the player is `zoneMap()`'s, drawn through the helpers the
sheet draws with (`hud/mapArt.ts`), so the two cannot disagree about where a tree is or what green
it is. The ground, the buildings, the nodes and the people are built once a zone, and a tile
crossing moves the SVG's `viewBox` over them with the player in the middle, held to a whole pixel of
the minimap (`minimapOrigin`) so every edge lands on one; `crispEdges` does the rest. The window is
the zone round the player rather than the whole of it, since a rebuilt zone of 45 by 32 in a corner a
thumb wide is two pixels a tile. What stands on it is shaped for four pixels a tile rather than
shrunk off the sheet: a node lies flat at two pixels and a person at three; **a creature is three
pixels in the colour of its name** (`conColor`, worked out against the level the HUD holds, so a
level-up recolours them without the world saying anything) **inside a ring of ink**, which is what
tells a green rat from the green tree it stands by, and a boss is five; **an exit is an arrow**
pointing off the edge it leaves by, the one question about an exit there is room to answer, and
while it is out of the window it is drawn on the rim in the road's direction (`onMinimapRim`); the
player is a cross, a shape nothing else takes. A gold square was an exit's first drawing, and a
level 2 rat's yellow ring beside it was the same thing to the eye. It writes no names: the whole
panel is a button, and a tap opens the zone map at this zone, where the names are, and shuts it as
its tab would.

**Creatures reach the HUD on the player's terms** (`creatures-changed`). The sheet had none because
a creature's position was the per-frame channel the HUD is kept off; the minimap's arrive the way
the player's tile does, from the tick, keyed to whole tiles: every living creature within
`MINIMAP_REACH` tiles of the player's tile, whole, when one of them crosses a tile, dies, gets up or
comes into reach or leaves it. So a rat at the far end of a rebuilt zone says nothing to anybody, and
a dot is a tile's walk behind at worst, which at this size is a pixel or four. The payload carries a
level rather than a colour, and it is unseeded like the map's two, so a new world with nothing near
says so and the last zone's rats do not stay on.

**The minimap has the top-right corner, and the target frame stands beside it or under it**
(`hudLayout`). Beside it where the top row has room for both, which is a landscape phone and
anything wider; under it on a phone held upright, where the column and the minimap all but meet. The
frame moving between screens is a lesser thing than the minimap jumping down the screen each time
something is picked, which is what the frame's corner with the minimap under it would have done.
**The switch in Options** takes it down (`CharacterState.showMinimap`, save version 101, kept on the
character like the tips switch and set by the session, since nothing in a zone reads it), and the
corner is the frame's again. `tests/ui/layout.test.ts` holds it clear of the column, the frame, the
tracker, the ability bar and the tip card at five screens with the column at its tallest, and smoke
measures it at three.

**The two top corners share the row rather than stacking**: who you are top-left, the minimap and
what you are fighting top-right. The column starts at the margin, not a target frame and a margin
down the screen. The frame takes the width _left beside_ the column rather than
`THEME.panelWidth.target` flat — at 375px a full-width one and the 190px column meet in the middle,
and the narrower the phone the deeper they overlap. A desktop sheet opens in the right-hand column,
which is the minimap's and the frame's corner now, so `sheetRect` starts it below `topRowBottom`,
which counts all three, rather than below the player column alone; which of them is the tallest is a
coincidence between tuned heights, not a rule.

**The quest tracker steps right of the column where the two would meet.** It sits over the ability
bar at the full width, and on a portrait phone or a desktop the column never comes near it. A
landscape phone is 390px tall for both, and the tallest column there (a wizard wearing a quiver,
titled, buffed and training) hangs below the top of two tracked lines, so `hudLayout` starts the
tracker a padding right of the column whenever the column's bottom would reach it.
`tests/ui/layout.test.ts` holds the two apart at every viewport it names.

**What buffs are up is derived, not tracked** (`systems/EffectSystem.ts`). `world/Player` keeps its
mana shield, its haste and its meal private and `activeEffects()` builds the list off them each time
it is asked, so an expired buff cannot survive in a second copy nobody cleared; `data/effects.ts`
says what each one is and `effectIconKey` in `art/icons.ts` what it is drawn as: what gave it, the
shield its spell, haste Battle Fury and a full stomach a roast. `ZoneWorld` publishes the whole list on `player-effects-changed`
whenever any icon's sweep would visibly move, and deliberately **without a seed** — a zone walk
builds a new player carrying none of the old one's buffs, and a HUD that outlives the world has to be
told that. A `debuff` kind exists in the table with nothing using it yet, so the first one is a row
there rather than a second row of icons somewhere else.

Three rules the old Phaser HUD arranged by hand come free from CSS, and are worth not undoing:

- The overlay is `pointer-events: none` and each piece of furniture opts back in, so a tap on the
  HUD never reaches the world and a tap on the world never has to be hit-tested against the HUD.
- `overflow: hidden` on a sheet and `auto` on its body is the whole of clipping and scrolling — no
  mask, no hit-area bookkeeping for rows scrolled out of view.
- A touch drag on a list scrolls it and the browser suppresses the click that would follow, which
  is the drag-versus-tap threshold those panels each had their own copy of.

**A counter's two sides stand across or one over the other by width alone** (`counterLayout` in
`ui/layout.ts`, applied by `CounterSides`). That is not the `narrow` breakpoint, and must not
become it: a landscape phone is narrow to `hudLayout` and is exactly the screen that wants the two
lists side by side, since one over the other would leave each a couple of rows of its 390px. The
host is handed the width on every `applyLayout` (`OverlayHost.layout`), so turning a phone with the
shop up moves it, and a counter opened later starts from the width already known. Every counter
hangs from the top and **stops above the tab bar** by the menu's offset, scrolling rather than
running over the bar — the board's ten contracts had covered it and taken the taps meant for it.

**Layout arithmetic still lives in the engine-free `ui/layout.ts`**, applied as inline styles rather
than left to CSS: it is unit-tested at viewport sizes nobody sits down and tries by hand, and
`worldViewportHeight()` is derived from the same numbers. Put new HUD geometry there. The breakpoint
keys on **height as well as width**, because a landscape phone (844x390) is wide by any measure and
has less vertical room than a portrait one. Styling is one stylesheet, `hud/styles.ts`, interpolated
from `THEME` — which reads its colours off the art's ramps and stores fills as `0x` numbers for the
view and `#` strings for text, so the DOM side goes through `cssColor`/`cssRgba` rather than keeping
a second copy of the palette. A frame's width comes out of the padding its element had, so the
content inside stands where it did and the layout's heights hold. `hud-hidden`
is `display: none !important` on purpose: it is a utility and has to beat whatever display the
element sets for itself.

**`ui/` is the vocabulary, `hud/` is the DOM that renders it.** `ui/layout.ts` (geometry),
`ui/theme.ts` (palette and scale), `ui/tabs.ts` (the tab table), `ui/gestures.ts` (when a press is
a tap, a drag or a question) and `ui/uiEvents.ts` (the event names and payloads) are shared,
tested, engine-free definitions; everything that builds an element lives in `hud/`.

**An item's icon is what it is on the figure** (`art/icons.ts`, decision 111). Gear is read off the
wardrobe's answer (`art/wardrobe.ts`): the piece a helmet puts on, the weapon in the hand, and the
ramps each is dyed, so the helm in the bag is the helm on the figure in the same steel and a new
item of gear is drawn the day its wardrobe row is. Everything else is a row, a drawing and what it
is dyed (a cooked fish is the raw one in `roast`, a burnt one in `char`), falling back on the
drawing of its data's `icon.shape`; `tests/art/icons.test.ts` holds every item to a picture of its
own. The bag, the equip picker, the counters and the idle panel all hang it through
`itemIconEl` and the one `row({icon})` helper in `hud/dom.ts`, and an item's card opens on the item
at twice a row's size. An ability's button is its picture, the name under it and a wizard's price
across its foot; a second rank is the first's picture. A tab and a menu entry wear a sixteen-pixel
mark over their word (`TabDefinition.icon`), and the purse a coin.

**The character sheet draws the world's figure** (decision 111): `portrait` of the player's own
getup (`art/outfit.ts`), their class, their look and what they have on, on a canvas at two CSS pixels
to the art pixel, compiled again only when what is worn changes. It still never reaches into the
view: the art is the renderer-free half, and the sheet compiles the figure the way the view does.
The stick-figure rig it was drawn with until B8 is gone, with the vector icons, and so is every
colour an item or a class carried for them.

**The bar holds five; everything else folds behind Menu.** It splits its width evenly (`ui/tabs.ts`),
so every seat costs every other seat: seven tabs gave each one 44.4px on a 375px phone against a
`THEME.touchMin` of 44 — four tenths of a pixel of headroom, and under the minimum below ~372px.
Five give each one 66.2px. `TABS` is what sits on the bar (Char, Bag, Quests, Idle, Menu) and
`MENU_TABS` is what the Menu overlay opens; `ALL_TABS` is both, and the keyboard binds against that
so a shortcut opens what it names instead of walking through a menu built for thumbs.

**A new surface goes in `MENU_TABS`, not on the bar.** The bar is for what a player opens constantly;
Idle is out there only because it is the one tab that shows state, staying lit while idle runs
whether or not its panel is the sheet open, so the tab can wear both the selected and the lit mark.
Menu labels may be whole words — the "labels have to stay short" rule stops at the bar's edge.
A sheet reached through the menu lights the _Menu_ tab (`isMenuTab` in `ui/tabs.ts`), because that is
the only seat it has and a dark bar over an open panel answers nothing.
`tests/ui/tabs.test.ts` holds the arithmetic for both the bar and the menu grid, and `npm run smoke`
measures the rendered `getBoundingClientRect()` of each at 375px, so this fails the build rather
than shipping an untappable button.

**A gather, a cook and a cast share one bar** (`hud/ChannelBar.ts`, on the `channel-*` events). They
are the same shape — something you are in the middle of, with a duration and something that can
break it — and no two of them can be running at once, since starting any one gives up whatever was
already going and a hit breaks all three. One widget rather than three stacked in the same place.

**Every number says what it counts, in a word or two** (decision 89). "Not hand-holding, not
obscure": a skill row reads `Lv 3 · 40 / 96 XP`, the bag `Weight 12 / 88`, a station's input
`Iron Ore ×2 (3 in bag)` — the recipe's amount first and what you hold after, since `3/2` said
neither — and a counter `3 / 10`, where its own label already names the thing counted. The player's
money is one element everywhere it shows (`hud/purse.ts`, labelled **Coins**): it sits in a header
beside prices, and a bare figure in the corner of a shop reads as well as the price of something as
the coin in hand. A page that explains a system does it once, in place, from the data it explains:
the skills book builds its mastery line from `MASTERY_TIERS`, so a retune moves the words with it.

The Part A review (decision 99) carried that to the places A1 had not reached. **A stat is named in
full wherever an item is described** ("+3 Armour, +1 Health, +1 Strength"), off one table,
`BONUS_NAMES` in `data/items.ts`, which the item line, the reforge text and the character sheet all
read, so a new place that names a stat reads it too rather than abbreviating again. **A creature's
level says it is one** ("Rat (Lv 1)", `enemyDisplayName`) on its nameplate, the right-click menu and
the target frame. **A locked row says what it needs** ("Needs A Feast of Crab", "Needs Level 2",
"Needs Smithing 9"): the words sit in the `requirement` the shelf, the syllabus, the board and the
quest desk hand back, and a station's row and the skills book write the same shape. And **a panel is
called what its tab calls it** — a label may shorten a title (Char, Character) but never rename it,
which `Hud.test.ts` holds for every sheet but the map, whose title is its zone.

**The skills book hides nothing and writes nothing per row** (decision 93, `hud/SkillsSheet.ts`
drawing `systems/SkillBookSystem.ts`). It opens on an index of every skill, and a tap turns to that
skill's page: its level, how it trains, what a level buys at this character's level and at the most
there is, and — for a gathering or making skill — every node or recipe in level order, the ones out
of reach greyed and saying the level they wait on, each with what goes in and comes out, the
result's numbers, its XP, where it is, and its mastery. Mastery lives there, beside the row each
pool fills, and has no page of its own (decision 89); a locked row draws no pool, since a level is
never lost and so nothing out of reach can have started one. **What a level buys is read off the
functions the rolls call** (`gatherSpeedBonus`, `failureChance`, `critChance`, `blockChance`,
`fizzleReduction` and the rest), never a second copy of a rate, which is why those are exported
from their systems; a rate inlined in a roll would leave the book saying the old number. The one
hand-written sentence a skill has is what earns a combat skill its XP (`COMBAT_SKILL_TRAINING`),
which follows `weaponSkillFor` rather than any table. It is one sheet with two views rather than a
sheet a skill, because a page is reached from two places — the index, and that skill's row on the
character sheet, which is a button now — and Back always goes to the index. The menu and its key
open the index; the character sheet opens the page. It draws only while it is showing, since a
combat skill gains XP on every hit and a hidden page redrawn each time is work nobody sees, and a
redraw of the page being read keeps its place rather than jumping back to the top on every swing.

**Every earned slayer rank is a title, and its row is the button that wears it** (`FeatsSheet`).
Three ranks a creature would have been up to thirty-three buttons pinned above the list; what is
pinned instead is the one line saying what is worn and a Take off. Tapping the worn rank's row takes
it off, so the row is a toggle like the button above it. **A rank is one line**, its title left and
its count right (decision 99): the sheet has a width of its own (`THEME.panelWidth.feats`) that the
longest rank, a boss's Slayer at 0 / 100 slain, fits, and a count never wraps, so a title too long
for some narrower screen wraps on its own side. Only real text measures that, so smoke does, at a
roomy screen and a 375px phone; a new creature with a longer name is what would move the width.

**Whispers is the journal behind Menu** (`hud/WhispersSheet.ts`, decision 132, the candle mark, key
J): the rumours heard, each in its teller's words with their name and trade and whether it has
been followed, then the lore found, each under its title, both newest first under a count of how
many there are. A rumour **never names where it leads**, even once followed; the line says as much
as its teller did. The HUD holds the journal and the secrets found (seeded from the save, then the
world's two unseeded publishers) beside the kills it already had, and reads the rest off
`WhispersSystem`, so followed is drawn the moment a secret is found or a boss falls. Something just
noted is said once on the toast, from its own event, since the journal's state alone cannot tell a
new entry from a sheet rebuilt for another character.

**An item says what it is for, and every row that shows one can be asked** (decision 90). The
uses are derived, never written per item (`systems/ItemUseSystem.ts`): every recipe that takes it
(one line with the station's verb for a recipe of one input, one "Used in" line per station for
the rest), the quests and contracts that collect it, what the outfitter and the fettler take it
for, the door a key opens, what idle does with food, what it is made from, and what it sells
for. A built station or a counter is named with the zone it stands in, read off the zone that
spawns it. Both the bag's strip and the card print the same lines, which is why a use is a
sentence rather than a label and a value — the strip has no column for a label — and the card
alone keeps the numbers (weight, bonuses) as label-and-value lines above them. The only thing
either reads off the player is the quest log: a quest handed in wants nothing any more, so its
line goes, where a contract's stays. The strip sits outside the grid's scrolling body and may
shrink and scroll itself, while `.hud-bag-body` holds the grid to a row; a long list on a landscape
phone would otherwise squeeze the grid, and the item being read about with it, to nothing.

**A row asks for an item's card by raising an event, not through a handler** (`hud/itemCard.ts`).
Eight panels draw item rows and the card opens in one place, and every panel and overlay mounts
under the HUD's root, so `bindItemCard` dispatches a bubbling `hud-item-card` DOM event and the
root opens the card for it. A panel says only which item a row is about, or hands a getter for the
one row that changes what it shows without being rebuilt (a gear slot). It is bound after the
row's own click, which is safe: `bindLongPress` swallows the release with a capture listener on the
**window**, which runs before anything under the finger whichever was bound first — so a finger
held on a shop row opens the card and does not buy. It is the window rather than the row because
the release lands wherever the finger is, and by then the card may be what is there: a shop row
outside the card's box opened it and closed it again on its scrim, which went unnoticed only while
the quests over the stock kept the row smoke holds under the box. One click is swallowed, and the
next press disarms it in case the release made none. A drop or a heap on the card itself opens its
item's card in place of the list, since there is one card at a time; smoke holds by real touch
that the release after that press does not reach the new card's scrim. The card is the one modal
opened over other panels, so its box is opaque where the rest let the world through.

**The idle panel is a sheet whose button asks the world** (decision 96, `hud/IdleSheet.ts`). The
Idle tab opens it like any sheet, its key included, and nothing on the bar or the keyboard starts
idle directly: the panel's Start does, sending `afk-set-requested` with the answer it showed rather
than a toggle, and then closes the panel so the character it set going is in view. What it draws is
`idlePlan` (`afk.md`), computed in `Hud` off the model and redrawn on everything the plan reads —
the bag, the gear, the quiver, the skills, a level, a reforge, the stations in reach, the zone,
idle going on or off, and the food choice — though, like the skills book, it only draws while it is
showing. Each food row is the item (a held finger opens its card) and three buttons of the touch
minimum, ▲, ▼ and Keep, which ask the world and redraw from the choice it answers with
(`idle-food-changed`); the top row's ▲ and the bottom row's ▼ are disabled rather than hidden, so
the buttons stay in columns. Smoke measures them at a portrait phone's width, where a row is
tightest.

**A secret found is said on the same card** (decision 117): its name in the world's type, Wick's
line, and what was left there, ahead of any tip waiting to be heard and whether or not tips are on,
since it is the reward rather than advice, with Got it alone to put it away. The zone map says how
many of the zone's secrets are found under the map, "Secrets 1 / 2", read off `secretsFound` in
`systems/MapSystem.ts` and the `secrets-changed` list; where one lies is on no map.

**What Wick says is a card that waits for a tap** (decisions 98 and D4's, `hud/TipCard.ts`), under
its name, in its light. A tap on Wick in the world says what it has (`simulation.md`): a tip on
`tip-offered`, carrying the line already written, which the card holds until **Got it**
(`tip-heard`) or **Go quiet** (`tips-set-requested`, off); a beat of its story or a line of its own
on `spirit-said`, with Got it alone, which answers a beat with `spirit-beat-heard` and a line of its
own with nothing, since nothing about it is kept. Options has the switch to bring the tips back,
**Wick's Tips: On** or **Quiet**, opened on what the save says. It **waits out anything covering
the playfield**: any overlay, a counter included, so a tap on Wick at a counter is said when the
counter closes, and a sheet on a phone, where the sheet is the screen. A roomy
screen's sheet stands in its own column below the top row, clear of the card, and holding for it
would hold every tip for as long as the character sheet was left open. Overlays come and go as
children of the root, each closing itself, so `Hud` hears them through a `MutationObserver` on the
root rather than a hook in every one; `OverlayHost.isAnyOpen()` says whether one is up. It sits
at the top (`tipCardRect` in `ui/layout.ts`): between the two corners wherever that gap is wide
enough to read in, which is a landscape phone and anything roomier, the gap stopping at whichever of
the minimap and the target frame stands further left, and under the whole top row on a portrait
phone, where the corners all but meet. In the DOM it goes under the toast, which may
print across it on a short screen and is the more urgent of the two, and under every sheet and
overlay. Smoke switches tips off and hears Wick's waking for every character it makes, except in
its own `tips` and `spirit` sections, since a card nobody answers would sit over whatever the next
section taps.
