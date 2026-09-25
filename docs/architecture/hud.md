# The HUD

The HTML overlay: the player column, the map, buffs, layout, icons, the tab bar and the menu, and the channel bar.

_Moved out of `CLAUDE.md` on 2026-09-25 (`docs/decisions.md` 57). The paragraphs are the ones that were there, in the order they were there; `CLAUDE.md` keeps the rules and points here for the reasoning. Where this and the code disagree, the code is right — and this file is what should be corrected._

**The HUD is an HTML overlay over the canvas** (`src/hud/`, engine-free). `mountHud()` builds one
`<div class="hud">` inside `#app` and it outlives every zone, like the session does. The only thing
it talks to is the `EventBus` it was handed (`world/eventBus.ts`), which is what makes it
renderer-independent by construction: the same tree sat unchanged over both canvases during the
port, and nothing drawing the world knows it exists.

`Hud.ts` owns the model and the subscriptions; everything else in `hud/` is a piece that draws part
of it. Char / Bag / Quests / Feats / Log are `Sheet` subclasses and one is open at a time — `Hud`
holds a single `openSheet`, not a visible flag per panel — while Camp and the gear icon are actions
that open nothing. The shop, the slot picker, the options menu and the away report are overlays
built on open and removed on close.

**The player column is bars, and a bar's numbers go inside it** (`hud/PlayerColumn.ts`): name and
level on one line, then health, mana and XP stacked, then the buff row. Three bars with three
captions under them is six rows of eye travel for three facts, and the top-left corner is read at a
glance mid-fight or not at all — so `.hud-bar__label` sits over the fill rather than beside it, which
is also why the backing is nearly opaque (over grass, a half-transparent empty end reads as grass).
Max HP is not on the wire — `player-hp-changed` carries the current value alone — so the ceiling is
recomputed from the gear and level the HUD's model already holds, which is why a gear swap and a
level both have to refresh it.

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

**The two top corners share the row rather than stacking**: who you are top-left, what you are
fighting top-right. The column starts at the margin, not a target frame and a margin down the
screen. The frame takes the width _left beside_ the column rather than `THEME.panelWidth.target`
flat — at 375px a full-width one and the 190px column meet in the middle, and the narrower the phone
the deeper they overlap. A desktop sheet opens in the right-hand column, which is the frame's own
corner now, so `sheetRect` starts it below `topRowBottom` rather than below the player column alone;
the column being the taller of the two today is a coincidence between two tuned heights, not a rule.

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
