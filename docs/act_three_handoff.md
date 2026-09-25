# Act three handoff: phases 10-13

**Written 2026-09-25**, at the merge of PR #123, which carried phases 0-9 of
[`act_three_plan.md`](act_three_plan.md), and **updated the same day with the user's answers** to
the questions it left open (decisions 62-65). This is for a fresh session picking up the rest. The
plan is still the spec; this file is what the plan does not say: where things stand, how to start,
where each remaining phase touches the code, and what is still to be asked. Where the two disagree,
the answers below are newer. Delete this file, or move it to `docs/archive/` with the plan, when the
last phase lands.

## Where things stand

- **`main` has phases 0-9**: the cleanup (a 17 KB `CLAUDE.md` with the reasoning moved into
  `docs/architecture/`, one counter shell for six roles, one set of dice per zone), the graphics
  (the world carried past its edge, each zone's air, rock standing up, readable names, a fight with
  motion in it, wind-ups drawn on the ground, moving water and ground scatter), and sound. Plus one
  bug fix found on the way: Escape closing a panel no longer drops the target.
- **Suite**: 1995 unit tests, 164 smoke checks, all green on CI.
- **Draw budget**: the throttled pass read **26.49ms** on CI with phase 9 in, against a 40ms
  ceiling. That reading is the one to compare against; a dev container reads about 10ms high and
  cannot measure a phase's cost at all (decision 50). What is left adds little to draw — a sack
  prop, a bow, a third figure — so the budget is not what constrains it.
- **Nothing is open**: no PRs, no issues. `cleanup/09-zoneworld-split` is a stale branch from
  before a history rewrite, left alone on purpose because it may be the only copy of that history.
- **Not in the plan and still unfixed**: below about 10fps a body stalls up to 32px short of a
  tree or vein and never gathers (`docs/architecture/simulation.md`). TypeScript 7 is
  still blocked on typescript-eslint (`docs/upgrade_plan.md`).

## What the user has settled

Asked at the end of the phase 9 session; each is a decision in `docs/decisions.md`.

| Question                                                  | Answer                                                                     | Decision |
| --------------------------------------------------------- | -------------------------------------------------------------------------- | -------- |
| A camp running with the tab open: pile, or not?           | **No pile.** It keeps counting what it could not carry.                    | 62       |
| How long does a pile last? Does a second kill add to one? | **One minute** of game time. **Each kill leaves its own pile.**            | 63       |
| Does a pile survive the player's death?                   | **Yes.**                                                                   | 63       |
| (Raised by the user)                                      | **A third class, the ranger**, whose weapon is the bow.                    | 65       |
| Can a warrior use a bow?                                  | **Yes, but it should not be a good idea.**                                 | 65       |
| What does a ranger's damage scale with?                   | **Agility**, a new third stat.                                             | 65       |
| Does agility do anything else?                            | **Physical crit chance**, and for now nothing more. Open to more later.    | 65       |
| Does the bow need ammunition?                             | **Arrows**, made by **fletching and smithing** together.                   | 64       |
| Is an arrow spent per shot? And with none left?           | **Spent.** With none left, the archer **fights with their fists**.         | 64       |
| Where are arrows carried?                                 | **In a quiver in the offhand**, which the two-handed bow leaves free.      | 64       |
| Is the quiver an item?                                    | **Yes, with its own stats**, replaced by better ones while levelling.      | 64       |
| Do bows and arrows differ?                                | **Both have their own stats, and both change a shot's damage.**            | 64       |
| Where does a level 1 ranger get arrows?                   | **A shop.** And **humanoid creatures drop them**.                          | 64       |
| What does an arrow weigh?                                 | **Well under 1**, so a good many can be carried.                           | 64       |
| How many does one making step make?                       | **Several**: one log makes several shafts, and one iron bar several heads. | 64       |

The ranger and the arrows reshape phase 12, which is why this now runs to phase 13: see
[below](#phases-12-and-13--the-ranger-then-fletching-and-willow).

## Starting cold

1. `CLAUDE.md` loads by itself. Then read the plan's phases 10-12 and its "What this plan does not
   do", then the `docs/architecture/` file for every subsystem the phase touches (the table in
   `CLAUDE.md` says which), then `docs/decisions.md` 54-65.
2. `git log --oneline -15` — the only record that cannot be out of date.
3. Branch before the first commit. **One PR per phase from here**: PR #123 carried ten phases and
   grew past 100 files, which is more than anyone can review.
4. Gates before opening a PR: `npm run lint`, `format:check`, `typecheck`, `test`, `build`, and
   `npm run smoke` with `npm run dev` running. Smoke blocks merges. If the throttled budget fails on
   your container, run smoke on the unchanged tree in the same session before believing it.
5. Each phase: update the plan's status line, append to `docs/decisions.md` for anything that
   closed off an alternative, and correct the architecture file for what moved. Part of the phase,
   not paperwork after it.

## Phase 10 — loot that is not lost

**Where it starts.** `CombatDirector.grantLoot` (`src/world/CombatDirector.ts`) is the one place a
drop is refused: `tryAddItem` fails, a line is logged, and the item is gone. That branch is where a
pile gets filled. Coin is never refused and never goes in one.

**Shape it after the campfire.** `world/Campfire.ts` is the existing thing that belongs to a zone
rather than to the character, times out on the world's clock, and is dropped by a zone change —
exactly what a pile is. No engine timers: the lifetime is an accumulator against the frame delta.

**What is settled** (decisions 62-63):

- **Only an attended player gets a pile.** A camp — awake or offline — leaves none. Offline, a
  refusal is counted into the away report's `missed`, as now. Awake, nothing changes either: the
  camp has no running tally, only the log line `grantLoot` writes per refused drop and the one
  "Your pack is full" warning `AfkCamp` latches. "Keep counting" was an answer about piles, not a
  request for an awake tally, so don't build one. The line to draw is `isCamping()`, the same one
  `GatherSession` draws for what a full pack means.
- **A pile lasts one minute of game time**, then is gone. Every map is 25×19 tiles, so the far
  corner is about 1,000 units from anywhere and about three seconds at a walk: a minute is time to
  drop something and pick the pile up, or to walk back from a respawn, and not time to go to town
  and sell first. Game time stops while the tab is hidden, so the minute does too.
- **Each kill's refusals are a pile of their own**, even beside another. No merging, so no rule
  about how near is near.
- **A pile outlives a death.** A respawn does not change zone — `ZoneWorld.handlePlayerDeath`
  stands the player up at the zone's centre — so this is just `handlePlayerDeath` leaving piles
  alone while it clears the target, the counters and the context menu. A zone change and a
  teardown still drop every pile.

**The pieces**, each a place the codebase already has a pattern for:

- `WorldTap` (in `ZoneWorld.ts`) gains a `pile` kind, and `pickTap` (`render3d/picking.ts`) tries it
  **above the ground and below everything else** — the list is a priority, and anything above mobs
  would eat taps aimed at creatures behind it (`docs/architecture/rendering.md`, picking).
- Taking from it is `tryAddItem` item by item, **taking what fits and leaving the rest** — the same
  call `CharacterController.withdraw` makes with `carryableCount`, because the rest is still the
  player's. What is left keeps the pile's original minute; taking from it does not restart the
  clock.
- A line in the context menu (`ContextMenuSession`, `InspectSystem`) saying what is in it.
- An actor drawing a small sack, disposed through `disposeTree`; smoke's GPU-memory round trip has
  to stay flat, and `drawnCounts` may need a kind for it.
- If it should make a sound when it drops, the world pushes a `WorldEvent` for it (decision 61).

**Tests**: `tests/world/` with the harness — fill the pack, kill something, a pile holds exactly
what was refused; a tap takes what fits and leaves the rest; it is gone after a minute and there
before it; two kills make two piles; a death leaves it on the ground; a zone change drops it; a
camp's kill with a full pack leaves none. `tests/render3d/picking.test.ts` for its priority. A smoke
check that one is drawn and taken down.

## Phase 11 — the upper band gets directed content

**A prerequisite the plan assumed was done.** The plan says the quest section moves out of the shop
panel and into the counter shell "in phase 1's wake". It did not move: quests are still drawn only
in `ShopModal`, wired from `OverlayHost`'s merchant panel. `QuestDesk` already checks that a quest is
taken from its own giver (`giverNpcId`), so the world side is ready; the HUD side is the first
piece of work — any counter whose person gives quests shows them.

**Abilities by rank.** `AbilityDefinition` and its `training` terms are in `data/abilities.ts`,
`knownAbilities` in `systems/AbilitySystem.ts`. The bar stays four buttons, so a rank replaces the
rank below it on the bar and in the trainer's list. If a rank is a new `AbilityId` naming the one it
replaces (`rankOf`), `learnedAbilities` stores it like any other purchase and **no save migration is
needed**. Check that before assuming otherwise.

**Quests above level 3**, given at Greyford by the outfitter and the fettler: a short chain
through the mill road, the fen, the Deep Cut and the barrow, each ending on the named thing in the
zone it sends you to. `data/quests.ts`; objectives are a tagged union of `collect`, `kill` and
`visit` (`docs/architecture/content.md`).

**Contracts for the upper band** in `data/bounties.ts`, held to the three rules in
`tests/systems/BountySystem.test.ts`: under what the kills already pay, over what vendoring the haul
pays, under what the shop charges for the same thing.

**Pacing**: extend `tests/systems/progression.test.ts` past the starter arc, so the upper band is
simulated rather than eyeballed. The duels in `EnemySystem.test.ts` model auto-attacks only, so a
new rank moves what a player who paid can do, not the tuning baseline.

**The ranger lands after this**, so this phase writes ranks and gear rewards for two classes. Keep
them as rows keyed by `ClassId` (`CLASS_ABILITIES`, a quest's `gear: Record<ClassId, ItemId>`) and
the ranger's phase gets a compile error at every one it has to answer, which is the point of keying
them that way.

## Phases 12 and 13 — the ranger, then fletching and willow

**What changed.** The plan's phase 12 gave a bow to the warrior, trained by an `archery` skill,
with no ammunition. The user has since chosen **a third class, the ranger**, whose weapon is the
bow and whose stat is **agility** (decision 65 — which reverses the part of decision 55 that
rejected a third class this round), and **arrows** that are spent, quivered, bought first and made
later (decision 64). Rewrite the plan's phase 12 to match before building it.

**Recommended split — confirm it with the user first.** Arrows come from a shop, so a level 1
ranger does not need the making chain, and the chain can stay the upper-band work the plan
described, at the bench the plan put in Greyford's yard.

- **Phase 12 — the ranger.** The class and agility, a starter bow, the `archery` combat skill, the
  quiver, arrows on a shop's shelf and in a few loot tables, fists when the quiver is empty, the
  two-handed rule, the camp spending arrows, the duels and the save migration.
- **Phase 13 — fletching and willow.** The plan's phase 12 much as written: the fletcher's bench,
  recipes that make several of a thing, shafts from logs, heads from iron bars at the forge, the
  two made into arrows, and willow on the mill road's millpond. `deadEnds.test.ts` holds willow to
  having a use on the day it lands.

### What is settled, and what each answer means in the code

**The ranger is a new `ClassId`**, which is mostly compile errors: `CLASSES`, `CLASS_ABILITIES`
(four on the bar, the attack first), and every quest's `gear` reward (`Record<ClassId, ItemId>`).
**Except `CharacterCreate.ts`**, whose `CLASS_IDS` is a plain `ClassId[]` — a third class would
simply not be offered at creation. Make it `exhaustive<ClassId>()` while you are there. A new class
needs no save migration of its own, since every existing save names one of the two that exist; the
ternary in `migrations.ts` that picks by class is history and stays as it is. Leather is
warrior-only in `ARMOR_TYPE_CLASSES`, so a ranger in leather is one entry there.

**Agility is a third stat**, and a stat reaches a long way. `PrimaryStat` is
`'strength' | 'intellect'`; `ClassStats`, `LevelGrowth`, `EffectiveStats`, `sumGearBonuses` and
`computeEffectiveStats` (`systems/StatsSystem.ts`), gear's `strengthBonus`/`intellectBonus`, the
reforge table and `reforgedBonuses`, the inspect lines and the character sheet all name the two that
exist. Every class gets an agility figure; the warrior's and wizard's should be small and grow by
nothing a level.

**What agility does**: it is the ranger's damage stat, and besides that it **adds physical crit
chance — and for now nothing else** (decision 65 leaves more open for later, so a future use is an
addition). Crit today is `critChance(weaponSkillLevel)` in `systems/CombatSystem.ts`, capped at
`MAX_CRIT_CHANCE` (20%), and **the same `resolveAttack` serves swings and spells** —
`resolveAbilityDamage` routes a fireball through it with the governing skill standing in for weapon
skill. "Physical" therefore needs saying somewhere it is not said today: agility's share applies to a
weapon's swing or shot and a physical ability, and not to a spell. Whether a wand's auto-attack is
physical is the edge case to decide, though a wizard's agility is small enough that it barely
matters. Whether agility's crit sits under the 20% cap or on top of it is tuning.

**A warrior may draw a bow, and it should be a bad idea** — which has to come out of the numbers,
because nothing here forbids anything by warning. Today `attackPower` is the _class's_ primary stat
plus gear, whatever is in the hand, so a warrior with a bow would shoot with the full strength of a
sword and the reach of a wand: the best weapon in the game for the class it is meant to suit worst.
**Recommended: a bow shot scales with agility whoever draws it**, so a warrior's bow is only as good
as the little agility a warrior has. That makes the weapon, not the class, decide the stat a hit
scales with, which is new. A wizard could draw one too — weapons are open to every class — and the
same rule answers them.

**Bows and arrows each have stats, and both change a shot's damage.** A bow is equipment and
already has somewhere to say so: `attackPowerBonus` and `attackRange` are fields on every weapon
row. **An arrow is not equipment and has nowhere yet**: `ItemDefinition` is a union of `equipment`,
`material` and `consumable`, and an arrow's stats are read off the arrow that is nocked, not off
anything worn. That points at a fourth kind — `ammunition`, say — carrying the arrow's own damage
figure, and a new kind is a compile error at every switch over `kind`, which is how the bag, the
inspect lines and the sell price get told about it. A shot is then the agility-scaled attack power,
the bow's bonus and the arrow's, through the same `resolveAttack`. Stats beyond damage (a bow's
draw speed — attack speed is per class today — or an arrow's own crit) are room to design in, not
asked for.

**The two-handed rule is needed either way**, since a warrior can hold a bow and owns a shield.
Equipping a bow has to empty or refuse a shield or orb, and equipping one of those over a bow has to
be refused or unequip it. The quiver is the one thing a bow allows in the offhand. It is a rule in
`CharacterController`, which refuses as a whole rather than half-applying. The comment on
`brown-shield` in `data/items.ts` argues the offhand is "one per class"; a ranger's is the quiver,
so that holds, but the comment needs saying so.

**The quiver is an item with stats of its own, replaced as the character levels** — an offhand row
(`offhandShape: 'quiver'`, a new `OffhandShapeId`) with a tier and colour like any other gear. Its
ordinary bonuses need nothing new, since `sumGearBonuses` already counts whatever is worn in the
offhand. What is new is that **it holds something**: how many arrows it takes is its natural stat,
and the arrows in it are a stack — which arrow, and how many — that `Gear`
(`Record<GearSlotId, ItemId | null>`) has nowhere to keep. That is a `CharacterState` field and so a
migration, the same bump that adds `archery`. Taking a quiver off puts its arrows back in the bag
through `tryAddItem`, and a full pack refuses the whole swap rather than dropping arrows. Where
better quivers come from — the shop, drops, or the tannery, since a quiver is leather — is ordinary
tier tuning.

**An arrow is spent on every shot.** The player's swing is in `CombatDirector` (where it pushes
`swing` with `by: null`); it takes one from the quiver through `CharacterController` and publishes
the change. **With the quiver empty the ranger fights with their fists**: `weaponSkillFor`
(`systems/CombatSystem.ts`) answers `'unarmed'` rather than `'archery'`, the reach is a fist's, and
neither the bow's bonus nor an arrow's should ride along on a punch. `weaponSkillFor` today answers
`'one-handed'` for anything equippable, so the bow is the first weapon it has to tell apart.

**The camp spends arrows too.** An awake ranger camp that runs dry is fighting with its fists, which
a camp's pull may not survive. The offline payout (`systems/OfflineAfkSystem.ts`) credits kills by
count, so it has to spend arrows per kill and price the kills after the quiver empties as fist kills
— or stop there. Without that, the offline camp is a bow that never runs out.

**The first arrows come from a shop** (`data/shop.ts`, a `ShopStockEntry` on a shelf), **and every
humanoid creature drops them** — a row in each of their loot tables. `EnemyDefinition.shape` already
says which: the bandit, the goblin scavenger, the goblin miner, the barrow wight and the fen raider,
and the two bosses (see below). "Every humanoid drops arrows" is a rule a new enemy row could quietly
break, so hold it with a test over `ENEMIES` rather than trusting the tables. A bounty paying arrows
would be held to the rule that it pays under what the shop charges. A new character starts with 75
copper and the weapon their class names; a ranger with an empty quiver is a fists class until they
reach a shop, so **give the class a starting quiver with arrows in it**, the way every class starts
holding its weapon.

**An arrow weighs well under 1**, and nothing in the game does yet (`DEFAULT_ITEM_WEIGHT` is 1). Check
that the bag's weight readout, `carryableCount` (which floors spare over weight) and a float sum of
the pack all behave with a fraction. Worn gear is not weighed at all — `inventoryWeight` counts the
bag — so arrows in the quiver weigh nothing and only the spares in the bag count. With the quiver's
size as a stat, that makes a bigger quiver worth having for its own sake, which is probably the
right shape.

**Balance**: the duels in `EnemySystem.test.ts` hold every class to the same curve — a fresh level
1 beats a level 1 rat comfortably, sweats a 2, loses to a 3 — so the ranger gets a row there, with a
starter bow and starter arrows, and `progression.test.ts` holds its arc. Ranged auto-attacks are not
new (the wand reaches 200-220 through `weaponAttackRange`), and mobs do not path (decision 26), so
the wizard already kites for free; the bow's reach is priced against the wand's. The plan's line
still applies: a different fight, not a better one.

**Saves**: `CHARACTER_STATE_VERSION` is 22. Every past skill addition bumped it and spread
`createInitialSkills()` _under_ the saved skills, so existing progress survives and only the new
ones start fresh (`persistence/migrations.ts` shows three). Phase 12 adds `archery` (a
`CombatSkillId`) and the quiver's contents; phase 13 adds `fletching` (a `GatherSkillId`, like
smithing) — one bump each.

### Phase 13's making chain

- **A recipe that makes several** is new: `CraftingRecipe` has an `outputItemId` and no quantity.
  An output quantity touches `CraftingSystem`, the offline camp's crafting payout and the station's
  list, which should say how many a job makes.
- **Shafts from a log, heads from an iron bar** at the town forge, arrows from the two together at
  the fletcher's bench. **The camp can only settle to a one-of-one recipe** (`findCraftableFrom`: one
  input, quantity 1), so shafts and heads can be camp jobs and putting arrows together cannot. That
  is probably fine — it is hands-on — but it is a property to choose, not discover.
- **Arrows by tier**: since an arrow's stats change the damage, iron heads and steel heads make two
  arrows worth telling apart, and the shop's and the drops' arrows are the bottom rung under them.
- **The bench** follows the tannery, which arrived third and widened nothing: a `StationId` with its
  `STATION_LABELS`, `STATION_ACTION_LABELS` and `STATION_SKILLS` entries, `recipesAt`, a place in
  Greyford's `stationSpawns`, and `RECIPES` rows (`docs/architecture/making.md`).
- **What willow is for** — better shafts, a better bow, or both — is the tier to design.

### Still to put to the user

1. **The two bosses are humanoid.** The bandit chief and the barrow king are both
   `shape: 'humanoid'`, and `uniqueLoot.test.ts` fails any item a boss drops that can be had anywhere
   else — so shop arrows on a boss's table break the build. Either bosses are left out of "every
   humanoid", or that test learns that ammunition is not a trophy. **Recommended: leave bosses out**;
   their table is what makes them worth the walk.
2. **Does the quiver refill itself from the bag?** If it does, an empty quiver only happens when the
   bag is out too, and fists are rare. If loading is something the player does, the quiver's size is
   a real limit in a long fight, and running dry mid-pull is a thing that happens. The quiver's size
   as a stat matters much more under the second.
3. **A reading to confirm**: "agility will just do physical crit chance" is recorded as agility being
   the ranger's damage stat _and_, besides that, physical crit — because it answered "does agility do
   anything besides power a bow?". If it meant crit _instead_ of damage, the ranger's damage has to
   come from somewhere else, and the warrior-with-a-bow problem above comes back.

## Things learned this session that are already written down

In case a fresh session meets them before it reads the file that explains them:

- A dev container cannot measure the draw budget; CI can (decision 50).
- Escape is shared by the HUD and the world, and the HUD cancels a key it takes
  (`docs/architecture/hud.md`).
- A sound cannot poll state; a moment worth hearing is a `WorldEvent` (decision 61).
- `localStorage` holds the sound setting beside the save, so "is anything stored" no longer means
  "is there a save" — smoke checks the save's own key.
- A new zone or exit costs a spawn or a building moved somewhere else, and the sweeps say where.
