# Zones

What a zone is, how zones join, locks and keys, the loop Greyford makes, and what an exit costs the zones at either end of it.

_Moved out of `CLAUDE.md` on 2026-09-25 (`docs/decisions.md` 57). The paragraphs are the ones that were there, in the order they were there; `CLAUDE.md` keeps the rules and points here for the reasoning. Where this and the code disagree, the code is right — and this file is what should be corrected._

## The world, in brief

A small, old-school-flavored MMORPG (EverQuest/RuneScape/WoW-inspired), built as a learning
side project by a professional software engineer with no prior game-dev experience. Currently
v1: single-player only; ten zones (Lampton, the town, with leveled rats, a shop, a bank and a
trainer, Candle Strand, a beach with crabs and ocean fishing, the two of them rebuilt at version 2's
45×32 in C5, the New Cut, a quarry cut into the hills north of town with tin and iron to mine,
Redrag Camp, the bandits' camp in a ruined waystation on the east road, those two rebuilt in C6,
the Cutthroat's Cellar, the vault under the waystation behind a locked door, the Old Mill Road west
of town where the goblins are, Blackwater Fen south of the beach where the eels and the cloth are,
the Deep Cut under the quarry where the coal is, the Sunken Barrow under the bottom of the fen
where the dead are, the two vaults rebuilt in C7, and Greyford Outpost between the road west and
the quarry, where a counter trades in materials rather than coin, a tannery works what the fen
drops, a fletcher's bench turns timber and bars into arrows, and a fettler reworks gear into what you
would rather it was);
character creation, leveling, gear,
two-way combat with death and respawn; three gathering skills and four making ones; currency, vendoring and a bank
to keep a haul in; a weight-limited pack; a five-quest chain from the shopkeeper that collects,
kills and sends you somewhere, a second one a band up across Greyford's two counters that ends on
the barrow king, plus repeatable contracts off the quartermaster's board that pay for work you were
doing anyway; slayer achievements and the
titles they grant; an AFK camping mode that also pays out offline; click/tap-to-move with a
mobile-first HUD; and local save/load with versioned migrations. Five of the ten zones are level
1-3 starter content — what separates those is what they drop, not how hard they are, and the Cellar
is gated by a rare key rather than by a level. Five things sit above that band. The named mob at the
back of the Cellar is level 4, carries loot that comes off a single creature, and is the fight the
starter content is the run-up to. The **Old Mill Road** is the band itself: the
first zone that is harder rather than merely different, level 4-5, reached by walking west out of
town with no key and no gate, because the starter band ended by walking and the one above it should
begin the same way; its hardwood and the willows on its millpond are the two woods the steel tier and
the steel arrow are made of. **Blackwater Fen** is the rung above it, level 5-7 and reached the same way, by
walking south off the beach: it is where the food that makes those levels survivable comes from, and
where a caster finally gets armour of their own. **The Deep Cut** is the third, level 5-6 and reached
by walking north out of the quarry, and it is the one of the three that is about a skill rather than
a fight: the coal and the rich iron down there are what the steel tier is made of, and what holds
anybody back from them is the pick in their hands rather than anything standing in the way. The
**Sunken Barrow** is the capstone and the top of the game, level 7-8: it is the Cellar's shape one
band up — a rare key off the zone in front of it, a map cut out of solid rock, a passage, and a named
thing at the back — reached by walking off the bottom of the fen, where the raiders that carry the key
already are. What it pays is the off hand nothing has filled since the starter band, and the second
hoard in the game that comes off one creature.

## How zones work

**Zones**: the world is a set of zones defined in `src/data/zones.ts` (a name, a setting, exits,
and a lock for two of them) and written in their own `data/*Map.ts` (the ground and everything on
it), each built into one `ZoneWorld` by the `GameContext` and drawn by the single
`ZoneView2D`; the DOM HUD keeps running across a change untouched. Each exit spawns a
tappable signpost (the mobile path — the invisible edge-walk band is untappably thin on
a phone); walking into the map edge still transitions too, for keyboards. Both are pure math
in `systems/ZoneSystem.ts`. A new area should be a `ZONES` row (plus exits both ways), not new
view code — and that row is what says what is spawned in it, what is built on it, and what stations
stand there. **Walking is the only way into a zone.** There was a second — tapping a cell on the
world map travelled there — and it was removed, because a world you can step across for nothing is a
world with no distance in it: a forward base saves nothing, a full pack is never a decision, and the
walk home is never a cost. What replaced it is nothing. If travel comes back it should be a thing
with a price on it rather than a free line on a panel.

**A zone is written as text** (`data/zoneText.ts`, decision 113), because at version 2's size a
zone painted in rectangles of code, its contents a list of offsets from the middle of the map,
cannot be read, let alone laid out. One character is one tile. The grounds are characters every zone
shares — `.` grass, `=` road, `~` water, `:` sand, `_` stone, `#` rock, `,` marsh, `%` masonry —
and everything
standing on them is a marker of the zone's own: `@` the start, where a new character and a death
put somebody, and a letter for each kind of creature at its level, node, station and building, each
a legend row saying what it is and the ground under it. A marker stands in the middle of its tile. A
building is a block of its letter exactly its footprint, so it stands on tile lines, and two of a
kind side by side take two letters, since a block running on past a footprint is refused rather
than guessed at. Whoever works in a building is named on its row and stands at its `counterPoint`,
so a shopfront moved is its keeper moved. The text refuses to load if a row is the wrong width, a
character is in neither table, there is not exactly one start, a block is the wrong size, or a
legend row is on no tile: a zone that does not read is found at the first import, not in play. The
lists `layoutZone` hands back come out in the order the text is read, which is why a test that
wants a particular person or creature names it rather than taking the first.

**A zone may hide secrets** (`data/secrets.ts`, decision 117): a small thing drawn where it lies,
on neither map and never named over, found by walking up to it (`world/SecretFinder.ts`). A secret
is a marker in its zone's text like anything else placed, and its row says which zone it is in,
which a test holds against where the text put it. Finding one is kept on the character, pays a line
of Wick's on the tips' card and a cache, and the zone map counts the zone's own under it. Lampton
hides two, and Candle Strand, the New Cut, Redrag Camp, the Cellar and the barrow one each; a
rebuild adds its zone's from `docs/lore/places.md`, each drawn in the phase that adds it.

**The rebuilt zones are 45×32** (decision 86), and a rebuild keeps what the old zone was for while
giving it room: side paths, a few places to do things, a secret or two. **Lampton** keeps its four
counters fronting the high street, starts a new player at the inn's door rather than on the
crossroads, and stands the Lamp Stone in the crossroads where everybody passes it. **Candle
Strand** keeps the spit and the southern strand the fen road needs, and the sea stops two rows short
of the south edge for the arrival strip, the bill the fen road charged it first. What an old test
assumed about the old town's geometry was moved into the test itself, or read by name.

**The New Cut** (decision 118) keeps the quarry's shape at the new size: a shelf along the north
edge for the Deep Cut's arrivals, the face under it with the shaft cut through its middle, the ledge
down the west edge the Greyford road runs along, and the turf along the south where Lampton's road
comes up. A ridge of rock across the pit makes two benches, tin and the smallest rats on the lower,
iron and the biggest under the face, and a spoil heap stands in front of the breach into the broken
cell. **Redrag Camp** is a Veymari waystation's ruin on the east road, walls of dressed stone (the
masonry ground) round a paved yard, entered at its gate and broken in three more places, with the
hall at the back holding the lamp niche and the biggest men; the road comes in on the rows Lampton's
high street leaves by. It is the first camp of aggressive men with walls in it, and a creature
notices only a player it can see (decision 116), so a player outside a wall is unseen by the men
inside it. Every bandit stands in columns 12-37, the sweep's answer for an aggro radius across from
either arrival strip and a wander disc round the start. **Nothing a rebuild adds is a new kind of
thing to do** (decision 118): more veins and more creatures of the kinds the zone had, and room, so
what each zone yields stays what C10 tunes against.

**The two vaults are entered at a mouth** (decision 119). An exit's row may name a `mouth`, the
first and last tile of its edge that are open, and only that stretch leaves; an arrival lands across
the mouth of the exit back at the fraction of the other it was crossed at, both measured over where a
body's centre can cross, half a body in from either side, so a crossing hard against one side of a
wide mouth lands hard against the same side of a narrow one and never in its wall. A row with no
mouth is open end to end, as every outdoor edge still is. Before this, an underground zone joined by
an edge had to keep that whole side open, which at 45×32 is a hall thirty-two tiles long down one
wall of a vault. **The Cutthroat's Cellar** is entered at five rows of its west edge, the stair
down from a walled lane out of the gap in Redrag Camp's east wall, which is the camp's mouth: the
guardroom left clear, the spine east to the warden's tomb with Hollis in front of the bier, the bunk
room and the storeroom off it, and a low passage from the storeroom's far corner back under the
guardroom to the strongbox. **The Sunken Barrow** is entered at five tiles of its north edge, the
fen's south edge staying whole until C9 rebuilds it: the stair, the antechamber, the gallery with the
frieze along its north wall, the crypts at either end of it and the king's chamber off its middle,
read north to south with every seven shallower than every eight. Both are rock with every room lined
in masonry, so the hill is packed up behind dressed stone, and both keep the start, which is where a
death in a vault puts somebody, at the foot of the way in and clear of every creature's reach.

The quarry is what that claim looks like when it is cashed: a map file, a row and one
exit each way, and it appeared on the world map, in the zone map and in the offline camp with
nothing else written down. Two things a `ZONES` row still cannot promise on its own, both held
by `tests/systems/ZoneSystem.test.ts`: that an arrival _anywhere_ along an exit edge lands on
walkable ground, and that every spawn is somewhere something can actually reach — a vein one
row too far north is a vein inside the rock face, and unlike a misplaced rat it never wanders out to
prove it.

**A zone may be locked, and the key is spent rather than carried** (`ZoneDefinition.requiresKey`,
ruled on by `systems/ZoneAccessSystem.ts`). `zoneAccess` answers three things and not two — `open`,
`locked`, and `unlockable`, which is "shut, and the key is in the pack" — because a door about to
open costs something and the caller has to know that before it walks through. Both routes into a
zone — the edge walk and the signpost — ask `ZoneWorld.openWayInto`, which is the **only** place a
key is ever spent, so "consumed once, open for good" is one rule rather than two; leaning on a shut edge is latched
(`blockedAtEdge`) so the refusal is one toast rather than one a frame. What the key opened is stored
on `CharacterState.unlockedZones` and is the one thing here that could not be derived — the key is
gone afterwards, so an empty pack means either "never found one" or "already been", and the world
map draws those two cells very differently. Two zones are locked — the Cutthroat's Cellar and the
Sunken Barrow, which are the bottom and the top of the game and are deliberately the same shape — and
both maps (`data/banditHideoutMap.ts`, `data/sunkenBarrowMap.ts`) are the inverse of every other one,
solid rock with rooms cut back out of it, which is why `tests/systems/ZoneSystem.test.ts` checks that
an arrival _anywhere_ across a mouth lands on walkable ground rather than only where the signpost
stands. **A key belongs to the zone the door is in**: the Cellar's drops on the bandits
outside its own door and the barrow's on the fen raiders whose marsh it is at the bottom of, so the
grind and the lock are one place rather than two. And the sentence a refusal is written in puts an
article in front of the zone's name, so `zoneAccess` strips the one half the table already carries —
"the The Sunken Barrow" is what that costs when nobody does.

**The world is a loop now rather than a star, and that is Greyford's doing.** Every road until it ran
through town: out to a thing and back the same way, past the shopkeeper's door twice a trip. Greyford
sits at `-1,-1`, joined south to the Old Mill Road and east to the quarry, so town, the road west, the
outpost and the quarry make a circuit — the first two spokes in the game tied to each other. What it
cost was the two edges it joins: the millpond came two rows south off the mill road's north edge, and
the quarry's face left a ledge along its west one. **Expect a zone that ties two others together to
charge both of them**, which is the same bill a spoke charges once.

**An exit reserves a strip of its own edge, and that is a claim on the town's layout made from
another zone.** A traveller materialises anywhere across the arriving mouth — at whatever fraction of
it they crossed the other zone's mouth at — so opening a road makes a lane of the receiving zone
unbuildable along the whole of its mouth, which is its whole edge unless the row names a narrower
one, not just where the signpost stands. The mill road is what taught
this: town had a smithy built across its west edge from back when nothing was over there, and adding
the road west put arrivals inside it. The smithy and its forge moved up into the north-west block, a
cottage moved across town to make room, and one rat moved a notch east — none of which is visible in
the `ZONES` row that caused it, which is the whole reason the sweep exists. Expect a new exit to cost
a layout change at the far end, and reach for `BuildingSystem.test.ts` to find out what.

**The fen charged the same bill against terrain rather than against buildings, which is the harder
half of it.** The beach was an ocean spanning its whole south edge — the map said so, and its comment
said that was why the zone had no south exit. Opening the road to Blackwater Fen meant every arrival
along that edge had to land on walkable ground, and `ARRIVAL_INSET` is a tile and a half, so it was
the _second row up_ that had to be clear rather than the edge itself. The ocean now stops two rows
short and runs off the east edge instead, leaving a sand spit down the west side and a strand along
the south. Nothing about the east edge being water matters, because an edge no exit leads to is one
nobody arrives on and `ZoneSystem.test.ts` does not ask about it. The rule to carry forward: **an
exit needs its mouth walkable on both sides, one arrival-inset in**, so a zone whose border is water
or rock is a zone that has to be re-cut before it can have a neighbour there — or, since decision
119, opened at a mouth only as wide as the way through it.

The quarry paid the same bill in rock the moment the Deep Cut opened, which is what makes it a rule
rather than a story about the beach: the face ran across the whole north edge and its comment said
that was why the zone had no north exit — the same sentence the beach's map had, about a different
material. It then sat at rows 2-4 with a shelf along the top of it and a break through the middle
where the shaft was driven, and every existing spawn stayed put; the rebuilt Cut kept that shape. **Expect the sentence explaining why
a zone has no exit somewhere to be the thing that has to go when it gets one.**
