# Act Two: five zones past the starter band

A brainstorm, not a spec. **Zone 1 is built** (see below); the other four are not.

## Where the game currently stops

Everything that spawns is level 1-3 except Hollis the Cutthroat, who is 4. `MAX_CHARACTER_LEVEL` is
5 because of him and nothing else — `tests/systems/progression.test.ts` asserts the cap sits exactly
one level past the highest thing in `spawns.ts`, so **the cap is a consequence of the content and
moves on its own** the moment something tougher spawns. Five zones is the first thing this game has
ever had that could not be described as "the starter area".

What the five below are for, in one line each:

| #   | Zone              | Cell   | Band | Why you go                                                |
| --- | ----------------- | ------ | ---- | --------------------------------------------------------- |
| 1   | Old Mill Road ✅  | -1, 0  | 4-5  | The first fight above the starter band, and the coin      |
| 2   | The Deep Cut      | 0, -2  | 5-6  | Coal, and with it the whole steel tier                    |
| 3   | Blackwater Fen    | 0, 2   | 5-7  | The food that makes levels 6-7 survivable                 |
| 4   | Greyford Outpost  | -2, 0  | —    | A second set of counters, out where the work is           |
| 5   | The Sunken Barrow | -2, -1 | 7-8  | The capstone: locked, and the only place two uniques drop |

The cells are what `worldMap()` derives from the exits, walking breadth-first from town and stepping
one square in the direction each edge points. Town is `0,0`; beach is `0,1`, quarry `0,-1`, camp
`1,0`, hideout `2,0`. The five above collide with none of those and none of each other, which is the
one thing about a new zone the layout code cannot fix for you.

Built in that order, the cap climbs 5 → 6 → 7 → 7 → 9. It is never a number anyone edits: add the
row, and `progression.test.ts` says what the cap now has to be.

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

## 2. The Deep Cut — north of the quarry, level 5-6

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

## 3. Blackwater Fen — south of the beach, level 5-7

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

## 4. Greyford Outpost — west of the Old Mill Road, no spawns

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

## 5. The Sunken Barrow — north of Greyford, level 7-8, locked

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
3. **The offline cap.** Half a level per session is a share of the curve, and the curve is about to
   get much steeper at the top. The existing note in `AfkSystem` says to move it with the curve; this
   is when.
4. **Armour tuning.** `mitigatedDamage` is `armor / (armor + 80)`, so an 80 in the denominator tuned
   against brown and iron will not hold a third tier without being re-checked. The duels in
   `EnemySystem.test.ts` are where that gets settled, and they only model auto-attacks — which stays
   right, and stays the reason a bought ability moves what a spender can do rather than the baseline.
5. **Two new creature colours and no new creature shapes**, if goblins and wights are humanoids and
   crawlers are crustaceans. That is the `shape` seam paying for itself.

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

1 → 2 → 3 → 4 → 5, and the argument for it is that each one is playable alone. Zone 1 needs nothing
but itself. Zone 2 gives the gear that makes zone 3 comfortable and zone 3 gives the food that makes
zone 2's depths survivable, so either order works between those two, but both want to exist before
the walk to Greyford is long enough to be worth shortening. The barrow is last because a capstone
with no run-up is a boss nobody is geared for.

Do the two tuning decisions — the gather cap and the XP curve — **before** zone 2 rather than after
zone 5. Both are one constant and a re-run of `progression.test.ts` early, and a retune of four
zones' worth of drop rates late.
