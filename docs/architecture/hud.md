# The HUD

The HTML overlay: the player column, the map, buffs, layout, icons, the tab bar and the menu, and the channel bar.

_Moved out of `CLAUDE.md` on 2026-09-25 (`docs/decisions.md` 57). The paragraphs are the ones that were there, in the order they were there; `CLAUDE.md` keeps the rules and points here for the reasoning. Where this and the code disagree, the code is right — and this file is what should be corrected._

**The HUD is an HTML overlay over the canvas** (`src/hud/`, engine-free). `mountHud()` builds one
`<div class="hud">` inside `#app` and it outlives every zone, like the session does. The only thing
it talks to is the `EventBus` it was handed (`world/eventBus.ts`), which is what makes it
renderer-independent by construction: the same tree sat unchanged over both canvases during the
port, and nothing drawing the world knows it exists.

`Hud.ts` owns the model and the subscriptions; everything else in `hud/` is a piece that draws part
of it. Char / Bag / Quests / Feats / Skills / Map / Log are `Sheet` subclasses and one is open at a time — `Hud`
holds a single `openSheet`, not a visible flag per panel — while Camp and the gear icon are actions
that open nothing. The shop, the slot picker, the options menu and the away report are overlays
built on open and removed on close. A tap on a person puts up the **talk panel** (`hud/TalkModal.ts`)
in the slot every counter uses: their greeting, a button for the counter they work, and their
quests (`hud/talkQuests.ts`), which no counter draws any more. Every role counter's panel is its own
list with a **Back** to the conversation put at the front of its head by `OverlayHost` rather than
by the panel, which is why each modal hands the host its `head` (`economy.md`). The options menu
also holds the one setting
that is not the character's — mute and volume, which the HUD is handed at mount and sends back
whole on `SOUND_SETTINGS_CHANGED_EVENT` (`audio.md`).

**An overlay that takes a key says so.** Escape closes whatever is open and is also the world's
"drop the target", and the two used to hear it independently, so closing a panel mid-fight dropped
the target too. `bindHudKeys` listens in the capture phase and cancels a key an overlay took, and
the world's `bindKeyboard` ignores a cancelled key — which holds whichever of the two was bound
first.

**The player column is bars, and a bar's numbers go inside it** (`hud/PlayerColumn.ts`): name and
level on one line, then health, mana and XP stacked, then the buff row. Three bars with three
captions under them is six rows of eye travel for three facts, and the top-left corner is read at a
glance mid-fight or not at all — so `.hud-bar__label` sits over the fill rather than beside it, which
is also why the backing is nearly opaque (over grass, a half-transparent empty end reads as grass).
Max HP is not on the wire — `player-hp-changed` carries the current value alone — so the ceiling is
recomputed from the gear and level the HUD's model already holds, which is why a gear swap and a
level both have to refresh it.

**Arrows are a bar too, where a wizard's mana goes** (act three phase 12). Anybody wearing a quiver
gets one — count against capacity, and "Out of arrows" when dry, since an empty quiver is the one
thing about it worth seeing — and `ui/layout.ts` reserves it as `hasQuiver` the way it reserves mana.
It is fed by `quiver-changed`, which the world sends with every bag change and every shot, and seeded
from the save like the bag. The character sheet's ATK is computed with the arrow the next shot nocks,
names the stat it was built on from the weapon rather than the class, and the offhand row names the
arrows beside the quiver.

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
come back out of the tables the world was built from — read with the same centre-plus-offset
arithmetic `populateZone` uses — so the map cannot disagree with where things actually stand, and
the HUD needs telling nothing but which zone is running. Only the player's dot is on the wire.
That is two events rather than one (`zone-entered`, `player-tile-changed`) precisely so a walk moves
the dot without rebuilding the terrain under it; the tile event is keyed to whole tiles so a position
never reaches the HUD on the per-frame channel, and both are published **from the tick with no seed**
— the host mounts the HUD after building the world, so a constructor-time emit would fire into a bus
with no subscriber and leave the map blank until the first zone walk. Terrain is banded into runs of
identical tiles (`terrainBands`), which takes a 475-tile zone down to 65 rectangles. **No mobs**:
they wander, so drawing them means a moving position per frame, and a map of where the rats were a
second ago is worse than a map with no rats on it. No tap-to-travel either.

**A building's name is drawn over the markers, and its ground under them.** The keepers of the
counters stand inside the buildings they work from (the interiors plan moved them in), so a name
drawn before the dots had an NPC's dot through it. Names go after every marker and before only the
player's dot; the label outline (`.hud-map__label`) keeps a name readable over whatever it crosses.
`Hud.test.ts` holds the order.

**The two top corners share the row rather than stacking**: who you are top-left, what you are
fighting top-right. The column starts at the margin, not a target frame and a margin down the
screen. The frame takes the width _left beside_ the column rather than `THEME.panelWidth.target`
flat — at 375px a full-width one and the 190px column meet in the middle, and the narrower the phone
the deeper they overlap. A desktop sheet opens in the right-hand column, which is the frame's own
corner now, so `sheetRect` starts it below `topRowBottom` rather than below the player column alone;
the column being the taller of the two today is a coincidence between two tuned heights, not a rule.

**The quest tracker steps right of the column where the two would meet.** It sits over the ability
bar at the full width, and on a portrait phone or a desktop the column never comes near it. A
landscape phone is 390px tall for both, and the tallest column there (a wizard wearing a quiver,
titled, buffed and training) hangs below the top of two tracked lines, so `hudLayout` starts the
tracker a padding right of the column whenever the column's bottom would reach it.
`tests/ui/layout.test.ts` holds the two apart at every viewport it names.

**What buffs are up is derived, not tracked** (`systems/EffectSystem.ts`). `world/Player` keeps its
mana shield, its haste and its meal private and `activeEffects()` builds the list off them each time
it is asked, so an expired buff cannot survive in a second copy nobody cleared; `data/effects.ts`
says what each one is and `EFFECT_STYLE` in `ui/theme.ts` says what it looks like, the same split
`QUEST_MARKER_STYLE` makes. `ZoneWorld` publishes the whole list on `player-effects-changed`
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
from `THEME` — which stores fills as `0x` numbers for the renderer's materials and `#` strings for
text, so the DOM side goes through `cssColor`/`cssRgba` rather than keeping a second copy of the
palette. `hud-hidden`
is `display: none !important` on purpose: it is a utility and has to beat whatever display the
element sets for itself.

**`ui/` is the vocabulary, `hud/` is the DOM that renders it.** `ui/layout.ts` (geometry),
`ui/theme.ts` (palette and scale), `ui/tabs.ts` (the tab table), `ui/gestures.ts` (when a press is
a tap, a drag or a question) and `ui/uiEvents.ts` (the event names and payloads) are shared,
tested, engine-free definitions; everything that builds an element lives in `hud/`.

**An item's icon is derived from what the item already is** (`ui/itemIcons.ts`, drawn by
`hud/itemIcon.ts`). Equipment needs no icon data: a weapon names its `weaponShape`, armour fills a
`slot`, and both name the `color` the paperdoll paints them — so a new equipment row gets a thumbnail
by construction. Only materials and consumables carry an `icon`, and the shapes are deliberately
coarser than the item list, since at thumbnail size a raw fish and a cooked one are one outline in
two colours. The bag, the equip picker and the shop all draw it through the one `row({icon})` helper
in `hud/dom.ts` rather than formatting an item three ways.

**The paperdoll is SVG built from the same rig the figure in the world is built from**
(`systems/AppearanceSystem.stickFigure`, drawn by `hud/paperdoll.ts` and by `render3d/figure.ts`).
The HUD does not reach into the renderer for a canvas, which is what let the sheet keep showing
what you are wearing when the world became meshes. Both read that rig, so a shoulder is in the same
place in either; `NPC_APPEARANCES` beside it is the same argument for the figures nobody is wearing
gear for — the three who stand in town, and the two bandits.

**The bar holds five; everything else folds behind Menu.** It splits its width evenly (`ui/tabs.ts`),
so every seat costs every other seat: seven tabs gave each one 44.4px on a 375px phone against a
`THEME.touchMin` of 44 — four tenths of a pixel of headroom, and under the minimum below ~372px.
Five give each one 66.2px. `TABS` is what sits on the bar (Char, Bag, Quests, Camp, Menu) and
`MENU_TABS` is what the Menu overlay opens; `ALL_TABS` is both, and the keyboard binds against that
so a shortcut opens what it names instead of walking through a menu built for thumbs.

**A new surface goes in `MENU_TABS`, not on the bar.** The bar is for what a player opens constantly;
Camp is out there only because it is the one tab that shows state, staying lit while a camp runs.
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
it off, so the row is a toggle like the button above it.

**An item says what it is for, and every row that shows one can be asked** (decision 90). The
uses are derived, never written per item (`systems/ItemUseSystem.ts`): every recipe that takes it
(one line with the station's verb for a recipe of one input, one "Used in" line per station for
the rest), the quests and contracts that collect it, what the outfitter and the fettler take it
for, the door a key opens, what a camp does with food, what it is made from, and what it sells
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
