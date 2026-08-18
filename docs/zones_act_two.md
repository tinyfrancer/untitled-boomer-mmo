# Act Two: five zones past the starter band

A brainstorm, not a spec. **Zones 1, 2, 3 and 5 are built** (see below); zone 4 is not.

## Where the game currently stops

Everything that spawns is level 1-3 except Hollis the Cutthroat, who is 4. `MAX_CHARACTER_LEVEL` is
5 because of him and nothing else — `tests/systems/progression.test.ts` asserts the cap sits exactly
one level past the highest thing in `spawns.ts`, so **the cap is a consequence of the content and
moves on its own** the moment something tougher spawns. Five zones is the first thing this game has
ever had that could not be described as "the starter area".

What the five below are for, in one line each:

| #   | Zone                 | Cell  | Band | Why you go                                                |
| --- | -------------------- | ----- | ---- | --------------------------------------------------------- |
| 1   | Old Mill Road ✅     | -1, 0 | 4-5  | The first fight above the starter band, and the coin      |
| 2   | The Deep Cut ✅      | 0, -2 | 5-6  | Coal, and with it the whole steel tier                    |
| 3   | Blackwater Fen ✅    | 0, 2  | 5-7  | The food that makes levels 6-7 survivable                 |
| 4   | Greyford Outpost ✅  | -1,-1 | —    | A second set of counters, out where the work is           |
| 5   | The Sunken Barrow ✅ | 0, 3  | 7-8  | The capstone: locked, and the only place two uniques drop |

Zone 5 shipped at **0,3** rather than the -2,-1 above, because -2,-1 is only reachable through a
Greyford that does not exist — see its own section for why the fen turned out to be the better door
anyway.

The cells are what `worldMap()` derives from the exits, walking breadth-first from town and stepping
one square in the direction each edge points. Town is `0,0`; beach is `0,1`, quarry `0,-1`, camp
`1,0`, hideout `2,0`. The five above collide with none of those and none of each other, which is the
one thing about a new zone the layout code cannot fix for you.

Built in that order, the cap climbs 5 → 6 → 7 → 7 → 9. (In practice zones 1, 3, 2 and 5 were built
in that order, and the cap went 5 → 6 → 8 → 8 → 9: the fen spawns to level 7 where this table
guessed 5-7 would top out lower, zone 2 moved it not at all by sitting under a ceiling the fen had
already raised past it, and zone 5 landed on the 9 this table predicted from a different direction.)
It is never a number anyone edits: add the row, and `progression.test.ts` says what the cap now has
to be.

---

## 1. Old Mill Road — west of town, level 4-5 — **BUILT**

What actually shipped, against what is written below: goblin scavengers in three knots of three at
levels 4-5, coin at roughly double the bandit rate, the studded leather tier, the mill as scenery,
and one `CREATURE_OVERRIDES` entry. The cap moved 5 → 6 on its own, as predicted.

Two departures worth recording. **The hardwood node was left out** — it exists to feed the charcoal
the steel tier needs, and steel is zone 2, so a hardwood row today fails `deadEnds.test.ts` for
yielding something no recipe consumes. It lands with the Deep Cut. And **the studded tier is leather
only**, so a wizard gets coin and nothing wearable out here; that follows this doc assigning cloth to
the fen, and is the strongest argument for building zone 3 before zone 2.

One cost this doc did not predict at all: **opening the road west forced a town re-layout.** An exit
reserves a strip of the receiving zone's edge for arrivals along its whole length, and town's smithy
was built across the west one. The smithy and forge moved to the north-west block, a cottage moved
across town, and a rat moved a notch east. Expect the same at Greyford — zone 1's own west edge is
now the strip that zone 4's road will claim.

**The bridge.** The road west, gone to seed since the bandits made the east road the interesting
one. It exists to be the first place where a level 3 character in a full brown set is not
comfortable, and to be reachable by walking out of town with no key, no quest and no gate — the
starter band ends by walking, the way it began.

- **Goblin scavengers** (`humanoid` family and shape, aggressive, `aggroRadius` a shade wider than a
  bandit's). Not tougher than a bandit one-for-one — the difference is that they spawn in loose
  threes, so the fight is about not pulling two. That is a spawn table doing the work rather than a
  stat block, which is worth having once before the numbers start climbing.
- **Drops**: coin at roughly double the bandit rate, and the **leather tier** — a wearable step up
  for anyone who has not smithed. Humanoids only, per the `family` rule.
- **Nodes**: hardwood, at woodcutting 6. Feeds the charcoal the steel tier needs.
- **Furniture**: the mill itself, as scenery. A `workshop`-shaped building with nobody behind it, now
  that a zone can have one.

**Cost**: a map file, a spawn list, one `ENEMIES` row, one `LOOT_TABLES` row, one `RESOURCE_NODES`
row, a handful of `ITEMS`, and a `ZONES` row with exits both ways. The goblin wants its own entry in
`CREATURE_OVERRIDES` so it is not drawn as a bandit; that is one line in `render3d/palette.ts` and is
the only view code in the whole zone.

## 2. The Deep Cut — north of the quarry, level 5-6 — **BUILT**

**The smithing spine, and the zone the other four hang off.** The quarry's shaft, followed down.

- **Coal veins** (mining 6) and **rich iron** (mining 8). Both are `vein`-shaped nodes, and the prop
  already takes its metal colour from the ore the row yields, so neither costs a line of renderer.
- **Steel**: `iron-bar + coal → steel-bar`, and a steel helmet / chest / legs / shield above the iron
  set. `TIER_COLORS` in `data/tiers.ts` already has a comment predicting this row.
- **Enemies**: cave crawlers (reuse the `crustacean` shape with an `avoidChance` like the crab's —
  long fights in the dark rather than dangerous ones) and goblin miners, so the zone pays coin as
  well as ore.
- **Gated by the pick, not by a door.** `requiredLevel` on the nodes already does this, and it is the
  same shape the ocean fishing spot and the iron vein use: the walk in is free and the reason to be
  here is not.

**Cost**: entirely tables — two node rows, two enemy rows, five or six item rows, five recipes. The
one thing to watch is `tests/systems/deadEnds.test.ts`, which will fail the moment coal exists
without something to burn it in.

**This is the zone that needs a decision first**: `MAX_GATHER_SKILL_LEVEL` is 10, and a mining-8 vein
leaves two levels of headroom for everything after it. Act two probably wants that cap at 20 — which
also moves what Master mastery means, since the thresholds are tuned to sit just under capping a
skill outright.

**Settled while building zone 3: leave it at 10 for now.** Act two's deepest gate is mining 8 and
the fen's own fishing 8, both of which fit with two levels spare — so the cap is not blocking
anything yet. Raising it to 20 costs 68,856 XP to cap a skill against today's 9,216, which is 7.5×
the grind and about 6,900 gathers, and it strands the mastery thresholds, which are deliberately
tuned to sit just under a capped skill. Do it when content actually asks for level 11, on the same
rule `MAX_CHARACTER_LEVEL` already follows: the content moves the cap, nobody edits it because a
later zone might want the room.

**Held after building it, and the margin is now measured rather than guessed.** The zone shipped with
mining 8 on the rich seam as predicted and smithing 9 on the steel chestplate, which is the deepest
gate anything in the game has. One level of headroom on both, which is the same room the ocean's
fishing gate leaves — so 10 still is not blocking anything, and the first thing that asks for 11
should be what moves it.

**What it actually cost.** Almost exactly what the section above says: a map, eleven spawns, two
`ENEMIES` rows, two loot tables, three nodes, six recipes, ten items, a tier colour and a `ZONES` row.
The whole of the view is two lines — one `CREATURE_OVERRIDES` entry for the miner and one
`BEAST_OVERRIDES` for the crawler — and the slayer chains, both maps, travel, camping, the offline
payout and the mastery pools all appeared with nothing written down, so the "what gets built for
free" list held a second time.

Four things this section did not predict:

1. **The quarry had to be re-cut**, exactly the way the fen re-cut the beach and for exactly the same
   reason one material over: the rock face ran across the whole north edge and the map's own comment
   said that was why the zone had no north exit — the same sentence the beach's map had about water.
   The rule that has now been paid twice is worth stating as a rule: **the sentence explaining why a
   zone has no exit somewhere is the thing that has to go when it gets one.** Every existing spawn
   survived, because the two iron veins already stood where the break through the face went.
2. **Hardwood came back to zone 1.** This doc's zone-1 postmortem said the timber stand would land
   with the zone that gave it a use, and it did — `nodeSpawns` on a `ZONES` row that already existed,
   plus a charcoal recipe. That is the `deadEnds.test.ts` deferral paying off rather than being
   worked around, which is the outcome the rule was written for.
3. **The crawler's dodge made `avoidChance` a rule instead of an exception.** It was the crab's
   alone and a test said so by name; a second armoured scuttling thing meant deciding whether the
   rule was "one creature" or "this kind of creature". It is the second, and the test now says
   crustacean-and-passive rather than a list of names — so the half that was load-bearing, that
   nothing which chases anyone has one, is what is actually held.
4. **The miners drop no ore at all**, which took deciding rather than filling in. Coal on that table
   would be the way round the only gate the zone has, and iron ore is no better: `deadEnds.test.ts`
   can trace the plate tier to both veins and a rat precisely because nothing else in the game hands
   out either rock, and it failed the moment a goblin did. What they carry instead is a pick and a
   maul — which is how the game's first repeatable weapon upgrade above a brown axe ended up here
   rather than in a zone that set out to add one.

**Built twice, in parallel, and merged on evidence.** The same session running on two devices built
this zone independently. The comparison is worth recording because it was settled by measurement
rather than by taste: the second implementation laid the mine out as open floor with scattered
pillars, chosen specifically to stop mobs pinning against geometry, there being no pathfinding
anywhere in this game. Simulating a chase out of every spawn to every point inside its own leash
radius said the opposite — **the carved rooms pin on 13% of reachable spots and the open floor on
17%.** Scattered pillars put an obstacle beside every spawn where a few large rooms leave clear
lines. The rooms stayed, and so did everything else that version had settled: the wide quarry cut
that left both iron veins standing, seam timings a step beyond the quarry's own, and the test file
that traces every seam and kill behind a steel piece.

Four claims came across from the other one, each a way this zone could keep passing while ceasing to
be what it is: that nothing living here drops what the seams yield (a level gate is only a gate while
there is no way round it), that a steel bar spends two quarry irons, that this zone raises no
ceiling, and that the capstone recipe sits at the top of the skill that makes it. The last closed a
real gap rather than restating one — the steel chestplate was at smithing 9 against a cap of 10, so
capping the deepest crafting skill in the game bought nothing at all.

The one thing this section asked for that came out differently is the **shield**. It is listed above
as a fourth armour row and it is really the point of the tier: both offhands in the world drop off
bandits in the starter band, so the slot filled once and never again, and a top tier stopping at three
pieces would have left the best set in the game wearing starter leather.

**And one thing it turned up somewhere else, left unfixed on purpose.** Writing the Deep Cut's test
that the gallery is arrived in rather than fought for meant checking a claim `CLAUDE.md` makes about
every zone — "the spawn point is safe by construction … no zone's centre sits inside an aggro radius"
— and it is not true of three already-built zones. Blackwater Fen has a raider 71 units from its
centre against an aggro radius of 210, so travelling there by map or respawning after a death lands
in melee with a level 5; the Old Mill Road has a goblin at 186 against 200; and the bandit camp's
_east_ arrival strip, which is how anyone walks back out of the hideout, passes 128 from a level 3
bandit whose radius is 180. All three predate this zone and each is a spawn offset, but the third one
is a layout question rather than a nudge, and retuning three shipped zones is not what building this
one was for. The Deep Cut holds the rule for itself in `deepCut.test.ts`; making it a sweep over every
zone is the follow-up, and it wants those three moved first.

## 3. Blackwater Fen — south of the beach, level 5-7 — **BUILT**

**The food.** The reason levels 6 and 7 are survivable at all: every fight from here up is longer
than a cooked crab can carry you.

- **Deep-water fishing** (fishing 8) yielding eel, and `cooked-eel` as the best heal in the game.
  Cooking is already a channel with a burn roll, so the whole loop exists — this is a recipe row and
  a fishing-spot row.
- **Bog lurkers** (reuse `quadruped` — something amphibian and slow) and **fen raiders**
  (`humanoid`), who carry the cloth tier. Cloth is the gap in the current world: the shop sells tools
  only and smithing makes plate, so a wizard's whole supply is two quest rewards and the chief's
  bandana. Dropping it here fixes that without inventing a tailoring skill.
- **Willow**, a second `tree`-shaped node, if a bow ever happens. Leave it out until it has a use —
  `deadEnds.test.ts` is what will say so.

**Cost**: tables, plus one colour for the lurker.

**What it actually cost**, against the line above. Built out of order — zone 2 was next by the
build order, and the cloth gap was the stronger argument, exactly as this doc's own zone-1
postmortem predicted it would be.

Right: it is almost all tables. Eleven spawns, two `ENEMIES` rows, two loot tables, one node, one
recipe, seven items, a tier, a map and a `ZONES` row. The eel and the cloth both landed as written,
the cap moved 6 → 8 on its own through `progression.test.ts`, and the slayer chains, both maps,
travel, camping and the mastery pools all appeared with nothing written down — the "what gets built
for free" list held completely.

Wrong in four places, three of them cheap:

1. **It cost the beach its ocean.** This doc placed the fen at 0,2 without noticing that the beach's
   south edge is solid water and its map comment says so in as many words. An exit needs its whole
   shared edge walkable one arrival-inset in — a tile and a half, so the _second row up_ — which
   meant re-cutting the beach: the ocean now stops two rows short and runs off the east edge, leaving
   a spit down the west side and a strand along the south. The zone-1 postmortem said to expect a
   layout change at the far end and it was right; what it did not say is that terrain can charge it
   as easily as a building can, and terrain has no `BuildingSystem.test.ts` to tell you in advance.
2. **Two colours, not one.** The lurker needed one as predicted, but it needed a mechanism too:
   `CREATURE_OVERRIDES` was humanoid-only, so a `BEAST_OVERRIDES` and a `beastLook` accessor came
   with it — the change `palette.ts`'s own comment said to make when a second non-brown quadruped
   arrived. The raider needed a colour as well, or it is drawn as a bandit.
3. **A tile.** `MARSH_TILE`, because a fen drawn as grass with ponds in it reads as a park. One
   constant and one colour, since `BLOCKING_TILES` is a list and a walkable tile touches nothing.
4. **The raider had to be priced deliberately.** The XP curve is quadratic and a creature's reward is
   linear in its level, so a zone that adds two levels at the previous zone's rate walks into the
   ceiling `progression.test.ts` holds. At the goblin's 11 XP a level the climb to cap 8 would have
   been 174 kills against a limit of 213; at 14 it is 146. Zone 5 will have to make the same decision
   again rather than inherit this one — see the tuning note below, which is now measured rather than
   predicted.

Two things this doc asked for were deliberately left out. **Willow** stays out, on the same
`deadEnds.test.ts` argument the hardwood was left out under — it has no use until a bow exists. And
the fen's design idea turned out to be one this doc did not name: the deep pools are all inside a
raider's aggro radius, so the food that makes the levels survivable is _behind_ the fight rather than
beside it. That plus the level climbing with depth is what `tests/systems/blackwaterFen.test.ts`
holds, since both are properties of a spawn list and nothing else would notice them going.

## 4. Greyford Outpost — between the road west and the quarry, no spawns — **BUILT**

**A second town, and the zone that the buildings just landed for.** Half a day's walk from home, out
where the work is.

- A **merchant** with the next tool tier on the shelf (steel pickaxe, axe, pole), gated with
  `StockRequirement` the way the shop's cooked food already is.
- A **banker**. The vault is `CharacterState.bank` and is one vault, so this is the same shelves
  reached from the other end of the map — which is the whole point: it turns a full pack in the Deep
  Cut from "walk home" into "walk ten tiles".
- A **quartermaster** with contracts pointed at zones 1-3. One contract at a time is a global rule,
  so a second board changes no arithmetic.
- **Buildings**: a gatehouse, a longhouse, a second forge under a smithy roof. This is the first
  place the town layout rules get exercised by something that is not the town — every counter's door
  facing the ground it is approached across, and nothing solid in the lane between.

**Cost**: no new enemies, no new items. A map, a `ZONES` row, four `NPCS` rows with appearances, a
`buildingSpawns` list and a second `stationSpawns` forge. `NPC_APPEARANCES` is keyed by `NpcId`, so
each new person is a compile error until somebody says what they look like — which is the intended
seam and not an obstacle.

**The open question here is roles.** All four counters would reuse existing `NpcRoleId`s, which means
Greyford is mechanically the town again in a different colour. If it is to be worth walking to it
probably wants one thing town does not have — the obvious candidate being a role that trades in
something other than coin.

**Answered, and it is the whole zone.** Town trades in coin — the shop sells, the bank stores, the
trainer charges, the board pays — so Greyford trades in stuff. The `outfitter` is a fifth
`NpcRoleId` that takes ore, coal and hardwood and hands back the steel tools, with no price in copper
anywhere on the counter. Everything else this section asked for (a banker, a quartermaster, a second
forge) was dropped: each would have been the town's own counter at a distance, which is exactly the
failure the paragraph above predicted.

**Two things came out differently from the plan.**

The **cell** moved from `-2,0` to `-1,-1`. West of the mill road is a fourth spoke off a world that
was already a star, and the note about feeling boxed in by the layout was the right instinct: every
road ran through town, so every trip out was the same trip back. At `-1,-1` the outpost joins the
mill road to the quarry and closes the first **loop** in the game. It also puts the materials town
between the timber and the ore, which is where it belongs.

The **tools had to be given a reason to exist**. `gatherDurationMs` reads the skill level and nothing
else, so a tool was a key: it permitted the swing and did nothing. A steel tier of them would have
been a reskin, which is the dead-end rule in everything but name — so `gatherSpeedBonus` is a new
field and 15% off a swing is what a trade buys. That is the one genuinely new mechanic in this zone,
and it is the answer to the question this section could not have known to ask.

The bill fell on **both** edges the loop joins, which a spoke never does: the millpond came two rows
south off the mill road's north edge, and the quarry's face left a ledge along its west. A goblin
knot moved twice in one PR for it — north to clear the map's middle in the sweep before this, then
east again when that north edge became a road anybody arrives along.

## 5. The Sunken Barrow — south of Blackwater Fen, level 7-8, locked — **BUILT**

**The capstone, and deliberately the same shape as the hideout** because that shape worked: a rare
key off the zone before it, a map cut out of solid rock rather than painted onto grass, a corridor,
and a named thing at the back of it.

- **Key** at ~3% off fen raiders, matching the hideout key's rate. The key is spent on entry and
  `unlockedZones` remembers, so it is one grind rather than one per visit.
- **Barrow-wights**: `humanoid` shape with a bone-pale `CREATURE_OVERRIDES` entry — a named-mob
  colour override is exactly the case that table was added for. Give them one telegraphed ability
  from `data/enemyAbilities.ts`; the wind-up spends the swing it replaces, so it stays a fight about
  moving rather than about numbers.
- **The boss**, level 8, with the second unique loot table in the game. `uniqueLoot.test.ts` holds
  uniqueness by every _other_ table not naming a thing, so the only cost of a second set of uniques
  is not padding anyone else's table with them.
- It is what sets the cap at 9.

**Cost**: a map (the hideout's inverted-`WALL_TILE` trick, which
`tests/systems/ZoneSystem.test.ts` already sweeps for arrivals anywhere along an edge), spawns, two
enemy rows, one key item, three unique items, and one `requiresKey`.

**Built fourth, out of the plan's order and off a different zone entirely.** The doc put the mouth
north of Greyford at -2,-1, which is reachable only through a Greyford nobody has built — so the
choice was to build two zones or to find another door. The fen turned out to be the better one on
this doc's own argument rather than in spite of it: **the key drops on fen raiders**, and the whole
reason the hideout's shape works is that its key drops on the men standing outside its own door. At
-2,-1 the grind would have been in the far south-east and the lock in the far north-west. South off
the fen puts them in the same place, points the fen's own north-to-south difficulty dial straight at
the door, and makes the run-up 5-7 into 7-8 instead of a level 4-5 road into a level 8 boss. The cell
is 0,3, which collides with nothing.

**What it actually cost**, against the paragraph above. The cost line was right about the shape and
wrong about the size in four places, three of which are the same lesson this doc has now learned
three times.

1. **It cost the fen its deep pools**, which is the beach's bill charged a third time and the second
   time terrain rather than a building paid it. An arrival strip spans the **whole** shared edge, so
   opening the road south meant no aggressive creature could sit within its aggro radius of _any_
   point along the fen's bottom row — and the fen's design is that a raider stands over every deep
   pool, with the pools as far from the way in as the map allows. Distance in x cannot help against a
   strip that reaches every x, so the only fix was distance up the map: both deep pools moved two
   rows north, the raiders guarding them came with them, and the bottom of the marsh is now the empty
   causeway the barrow's mouth is reached across. The fen's own tests still hold — the levels climb
   south, every pool has its raider — which is what made the move safe to make at all.
2. **Two new enemy abilities, not one.** The section above asks for "one telegraphed ability from
   `data/enemyAbilities.ts`", and reusing the chief's Cleave for the capstone boss would have made
   the last fight in the game a restatement of the fifth. So the wights got `grave-chill` (150,
   half again a Cleave's reach — the answer is a walk rather than a step) and the king got
   `barrow-wail` (240, the longest tell in the game — the answer is to leave the room). Both are one
   row of data. What is genuinely new is that the chill hangs off something that **respawns**: every
   telegraph before this belonged to a boss or to a bandit's thrown knife, so the cadence had only
   ever been driven on a fight a player has once.
3. **No armour tier, and that took deciding rather than filling in.** The wights are `humanoid`
   family, so `EnemySystem.test.ts` requires coin and equipment on their table — and the obvious
   fill was a fourth set. It would have had to beat either the fen's cloth or the forge's plate, both
   of which are claims other zones' tests hold on purpose, so a barrow set would have undone one of
   them rather than added anything. What the barrow pays instead is the **off hand**: both offhands
   in the world drop off bandits in the starter band, the only thing above them is smithed and plate,
   and a caster has therefore carried a level 1 orb for the entire climb. The `grave-shield` and the
   `grave-lantern` are the bandits' pair one band up, both under the steel shield so the forge keeps
   the slot's ceiling.
4. **A second boss broke two tests, and generalising them was most of the work that was not data.**
   `uniqueLoot.test.ts` asserted the chief's three beat everything in their slot, which a better hoard
   makes false — it is a **ladder** now: every unique beats everything in its slot that is not one,
   the deeper boss beats the shallower one slot for slot, and the deeper hoard is behind the zone with
   the higher band. `EnemySystem.test.ts` asserted the chief was the only boss anywhere; it now holds
   the rule that was behind that — every boss is one of a kind, carries a table of its own, and stands
   in exactly one zone that is locked.

**And one thing it turned up somewhere else, fixed rather than left.** `spawnSafety.test.ts` — the
sweep the Deep Cut's postmortem asked for — probed five sampled fractions of each arrival edge, and a
spawn that sat between two of them passed a check it should have failed. It is continuous now (the
nearest point on a strip to anything is always the one directly across from it, which is exact and
cheaper than sampling), and it immediately found a shipped bug: Blackwater Fen had a level 5 raider
192 from its **north** strip against an aggro radius of 210, passing only because the nearest sampled
arrival was 214 away. Walking down from the beach could land you in melee. That raider moved with the
rest of them.

Two smaller things. The cap moved 8 → 9 through `progression.test.ts` with nobody editing it, and the
wight was priced against the ceiling it was raising exactly as the fen's postmortem said the next zone
would have to be — 18 XP a level against the raider's 14, which lands the climb at 147 kills against a
limit of 213. And a screenshot caught `ZoneAccessSystem` saying "You unlock the **The** Sunken Barrow
with the Barrow Key": both of its sentences put an article in front of a name half the table already
carries one on. That is fixed and held over every locked zone, since what brings it back is a third
zone named the way the Deep Cut is.

---

## What the five of them cost together, honestly

Almost all of it is data. The things that are **not**, in rough order of size:

1. **`MAX_GATHER_SKILL_LEVEL`.** Ten is the ceiling on every gathering skill and act two spends it
   twice over. Raising it moves the mastery thresholds with it, since Master is tuned to sit just
   under a capped skill.
2. **The XP curve.** `xpToReachLevel` is `80·level²`, so level 9 costs 6,480 against level 5's 2,000
   — the last four levels are more XP than the whole game currently contains. Either the new zones
   pay much better, or `XP_PER_LEVEL` comes down. `progression.test.ts` will not let this be
   guessed at: it asserts the climb from the end of the starter arc is another session or two of the
   best kill in the world, and it will fail loudly at 9 with today's numbers.

   **Measured, now that the fen is in.** The answer is the first branch, and it is a per-zone
   decision rather than a global retune: a new zone raises its own `perLevel.xpReward` and the
   constant never moves. The margin at each rung, against a limit of 3× the starter arc's 71 kills:
   cap 6 was 87 kills, cap 8 with the raider priced at 14/level is 146, and cap 9 at a goblin's
   11/level would have been 223 — over. Lowering `XP_PER_LEVEL` instead would re-tune the whole
   existing game, including the arc assertions that hold "lands on level 3", to fix something a
   table row fixes when it lands. So: **price the new creature against the ceiling it raises.**

3. **The offline cap.** Half a level per session is a share of the curve, and the curve is about to
   get much steeper at the top. The existing note in `AfkSystem` says to move it with the curve; this
   is when.

   **Measured, now that the barrow has taken the cap to 9, and the answer is: leave it alone.** The
   ceiling is `xpToReachLevel(level + 1) × 0.5`, which is a fraction of the player's _next_ level
   rather than a fixed number — so it moves with the curve on its own, and the thing worth checking
   was which direction. A session is worth 1,000 of the 4,320 the game contained at cap 5 (23%),
   2,560 of 16,240 at cap 8 (16%), and 3,240 of 22,720 at cap 9 (14%). The total grows faster than
   any one level does, so every cap raise has quietly made a night parked worth a smaller share of
   the game, which is the direction this was ever worried about. The note in `AfkSystem` stays, but
   what it is watching for is a cap raise that does _not_ come with content — and those do not
   happen here, because `progression.test.ts` derives the cap from what spawns.

4. **Armour tuning.** `mitigatedDamage` is `armor / (armor + 80)`, so an 80 in the denominator tuned
   against brown and iron will not hold a third tier without being re-checked. The duels in
   `EnemySystem.test.ts` are where that gets settled, and they only model auto-attacks — which stays
   right, and stays the reason a bought ability moves what a spender can do rather than the baseline.

   **Measured, now that steel is in.** A full steel set with its shield is 37 armour, which the curve
   turns into 31.6% against the brown set's 14.9% and iron-plus-a-brown-shield's 24.5% — a real step
   that is nowhere near immunity, which is what the shape of the curve was chosen for. The 80 holds.
   What the fourth tier would want watching is the _fifth_: the curve is flattest where the numbers
   are biggest, so a barrow set much above this one buys less than it looks like it does.

5. **Two new creature colours and no new creature shapes**, if goblins and wights are humanoids and
   crawlers are crustaceans. That is the `shape` seam paying for itself. Six colours now and still no
   shapes, which is the seam holding all the way to the end: the lurker, the raider, the miner, the
   crawler, the wight and the king are each a row in `palette.ts` and nothing else. The two dead ones
   are the only entries in that table told apart from their neighbours by **value** rather than by
   hue — bone has to read against grass, dirt, marsh and rock alike.

## What gets built for free

Worth saying, because it is most of a zone:

- **Slayer chains.** `ACHIEVEMENTS` is generated over `EnemyId × SlayerTier`, so every new creature
  arrives with its 25/50/100 and the title behind it.
- **Mastery pools.** `MASTERY_TARGETS` is generated from `RESOURCE_NODES` and `RECIPES`, so coal and
  steel get pools by construction.
- **Both maps.** The zone map is derived from the zone's id and the world map from the exits, so a
  wired-up `ZONES` row appears on both with nothing written down.
- **Travel, camping and the offline payout.** All three read the same tables. The quarry proved this:
  a fifth zone cost a map, a spawn list, a row and two exits, and turned up in every one of them.
- **Bounties**, once a `BOUNTIES` row names the new kills and gathers. The three payout rules hold it
  — under what the kills already pay, over what vendoring the haul pays, and under what the shop
  charges for the same thing.

## The order to build them in

In practice: 1 → 3 → 2 → 5, and all three departures were right. Zone 3 jumped the queue because the
cloth gap was the stronger argument, zone 2 landing third meant the steel tier could be priced
against a cap the fen had already moved rather than against one it would have moved itself, and zone
5 skipped zone 4 because the capstone's run-up turned out to be zones 1-3 rather than a second town:
Greyford is a convenience, and a convenience is not what a boss is gated on. What that departure cost
is a walk — the bank and the shelf are still in town, so a haul out of the barrow is the whole way
home. Zone 4 is now the thing that fixes a problem the game actually has rather than the thing the
plan says comes next, which is a better position for it to be in.

The plan as written was 1 → 2 → 3 → 4 → 5, and the argument for it is that each one is playable
alone. Zone 1 needs nothing
but itself. Zone 2 gives the gear that makes zone 3 comfortable and zone 3 gives the food that makes
zone 2's depths survivable, so either order works between those two, but both want to exist before
the walk to Greyford is long enough to be worth shortening. The barrow is last because a capstone
with no run-up is a boss nobody is geared for.

Do the two tuning decisions — the gather cap and the XP curve — **before** zone 2 rather than after
zone 5. Both are one constant and a re-run of `progression.test.ts` early, and a retune of four
zones' worth of drop rates late.
