# Act three handoff: phases 10-13

**Written 2026-09-25**, at the merge of PR #123, which carried phases 0-9 of
[`act_three_plan.md`](act_three_plan.md), and **updated the same day with the user's answers** to
the questions it left open (decisions 62-65 and 70). This is for a fresh session picking up the rest. The
plan is still the spec; this file is what the plan does not say: where things stand, how to start,
where each remaining phase touches the code, and what is still to be asked. Where the two disagree,
the answers below are newer. Delete this file, or move it to `docs/archive/` with the plan, when the
last phase lands.

## Where things stand

- **Phases 10, 11 and 12 have landed since this was written** — see
  [phase 10](#phase-10--loot-that-is-not-lost-landed),
  [phase 11](#phase-11--the-upper-band-gets-directed-content-landed) and
  [phase 12](#phase-12--the-ranger-landed). **Next is phase 13**, fletching and willow, and nothing
  is waiting on the user. The rest of this list is as it stood at the merge of PR #123.
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
| Are bosses left out of "every humanoid drops arrows"?     | **No.** A boss may drop arrows — its own, like a ranger boss's.            | 70       |
| Does the quiver refill itself from the bag?               | **Yes.** And arrows picked up of the quivered type go into the quiver.     | 70       |
| Agility: damage, crit, or both?                           | **Both.** The ranger's damage stat, and physical crit on top.              | 70       |
| Split phase 12?                                           | **Yes**: 12 is the ranger, 13 is fletching and willow.                     | 70       |
| A refill when the bag holds other arrows?                 | **Fill from the bag**, the highest-ranked (most damaging) arrow first.     | 70       |

The ranger and the arrows reshape phase 12, which is why this now runs to phase 13: see
[below](#phases-12-and-13--the-ranger-then-fletching-and-willow).

## Starting cold

1. `CLAUDE.md` loads by itself. Then read the plan's phases 10-12 and its "What this plan does not
   do", then the `docs/architecture/` file for every subsystem the phase touches (the table in
   `CLAUDE.md` says which), then `docs/decisions.md` 54-70.
2. `git log --oneline -15` — the only record that cannot be out of date.
3. Branch before the first commit. **One PR per phase from here**: PR #123 carried ten phases and
   grew past 100 files, which is more than anyone can review.
4. Gates before opening a PR: `npm run lint`, `format:check`, `typecheck`, `test`, `build`, and
   `npm run smoke` with `npm run dev` running. Smoke blocks merges. If the throttled budget fails on
   your container, run smoke on the unchanged tree in the same session before believing it.
5. Each phase: update the plan's status line, append to `docs/decisions.md` for anything that
   closed off an alternative, and correct the architecture file for what moved. Part of the phase,
   not paperwork after it.

## Phase 10 — loot that is not lost (landed)

**Landed** on its own PR, much as this section described it: `world/LootPile.ts` and
`world/LootPiles.ts`, `CombatDirector.grantLoot` leaving a pile unless `isCamping()`, a `pile` tap
kind picked above the ground and below everything else, a Take line and a card listing the contents,
a sack that blinks through its last ten seconds (decision 66), and a `loot-left` event the ear hears
as a thump. The plan's phase 10 has what it turned out to be about; `docs/architecture/economy.md`
has the rules and `rendering.md` the sack. Tests are `tests/world/lootPiles.test.ts`, the picking
and actor tests, and smoke's `loot-piles` section.

## Phase 11 — the upper band gets directed content (landed)

**Landed** on its own PR, a commit a piece: quests drawn by the counter shell
(`hud/counterQuests.ts`, with the `NpcId` now on `COUNTER_OPENED_EVENT`), second ranks at levels 5-8
(`rankOf`, `lineOf`), five quests at Greyford, four contracts, and the pacing simulation carried past
the starter arc. The plan's phase 11 has what it turned out to be about
and decisions 67-69 the forks. For phase 12, two things from it are already keyed by `ClassId` and
will be compile errors for the ranger: `CLASS_ABILITIES` (now eight a class, four first ranks then
four second) and the `lurker-hides` quest's `gear`. The ranger's second ranks go at 5-8 like the
others', and `TrainerSystem.test.ts` holds every rank to its first rank's cooldown, reach and cast
time. What follows is the section as it was written before the phase, kept for the reasoning.

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

## Phase 12 — the ranger (landed)

**Landed** on its own PR, after a bug fix in a commit of its own (`appearanceKey` left the offhand
out, so a shield or quiver put on mid-zone kept the old hand until the view rebuilt): the rules and
the simulation, then what the HUD, the view and the ear make of them. The plan's phase 12 has what it
turned out to be about and decisions 71-75 the forks. What phase 13 inherits:

- **One arrow exists**, `crude-arrows`, the fourth item kind (`ammunition`): sold by the bundle in
  town, dropped by every humanoid, and the ranger starts with fifty. Iron and steel arrows are phase
  13's to add, and an arrow's own damage stat already feeds the shot and the quiver's best-first
  refill, so a better arrow is a row.
- **Four bows** (`shortbow`, `hunting-bow`, `poachers-bow`, `barrow-longbow`, the last two off the
  chief and the king) and **three quivers** (`worn-quiver`, `studded-quiver`, `grave-quiver`).
  "What willow is for" is still open; a willow bow would sit among these.
- **Saves are at version 23** (`archery` and `CharacterState.quiver`). `fletching` is the next
  bump.
- **A recipe still makes exactly one thing.** Several shafts from a log and several heads from a
  bar is phase 13's first piece.

What follows is the section as it was written before the phase, kept for the reasoning and for
phase 13's part of it.

## Phases 12 and 13 — the ranger, then fletching and willow

**What changed.** The plan's phase 12 gave a bow to the warrior, trained by an `archery` skill,
with no ammunition. The user has since chosen **a third class, the ranger**, whose weapon is the
bow and whose stat is **agility** (decision 65 — which reverses the part of decision 55 that
rejected a third class this round), and **arrows** that are spent, quivered, bought first and made
later (decision 64). The plan's phases 12 and 13 have been rewritten to match.

**The split, confirmed by the user** (decision 70). Arrows come from a shop, so a level 1 ranger
does not need the making chain, and the chain can stay the upper-band work the plan described, at
the bench the plan put in Greyford's yard.

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
addition; decision 70 confirms it is both, not crit instead of damage). Crit today is `critChance(weaponSkillLevel)` in `systems/CombatSystem.ts`, capped at
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

**The quiver refills itself from the bag, and an arrow of the quivered type goes into the quiver
when it is picked up** (decision 70). The second belongs in `tryAddItem`, so every way in — a
kill's drop, a loot pile, a purchase, a withdrawal through `addWhatFits` — gets it without being
told: the quiver takes what fits of its own type and the rest goes to the bag. Because a quiver's
arrows weigh nothing, a full pack never refuses an arrow the quiver has room for, so a loot pile
will seldom hold the arrows being shot. The first is the shot's business: when the quiver has run
dry, it **fills with the best arrow the bag holds**, highest-ranked first by the arrow's own damage
stat, whatever type it held before — so a refill never quietly downgrades a ranger carrying better.
Only with no arrow of any kind left does anything fall back to fists.

**An arrow is spent on every shot.** The player's swing is in `CombatDirector` (where it pushes
`swing` with `by: null`); it takes one from the quiver through `CharacterController` and publishes
the change. **With the quiver empty and no arrow of any kind in the bag, the ranger fights with
their fists**: `weaponSkillFor`
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
and the two bosses, the bandit chief and the barrow king. **Bosses are not left out** (decision 70):
a boss may drop arrows, and when it does they are its own — a ranger boss's fine arrows beside its
fine bow — so `uniqueLoot.test.ts`, which fails any boss drop that can be had anywhere else, holds
without a change. A boss does not have to drop them. "Every humanoid drops arrows" is a rule a new
enemy row could quietly break, so hold it with a test over `ENEMIES` rather than trusting the
tables: every humanoid that is not a boss drops the ordinary kind, and a boss is free either way. A bounty paying arrows
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

Nothing. Every question the ranger raised has been answered (decisions 64, 65 and 70), including
the split. A phase 12 session asks only what the build turns up.

## Things learned this session that are already written down

In case a fresh session meets them before it reads the file that explains them:

- A dev container cannot measure the draw budget; CI can (decision 50).
- Escape is shared by the HUD and the world, and the HUD cancels a key it takes
  (`docs/architecture/hud.md`).
- A sound cannot poll state; a moment worth hearing is a `WorldEvent` (decision 61).
- `localStorage` holds the sound setting beside the save, so "is anything stored" no longer means
  "is there a save" — smoke checks the save's own key.
- A new zone or exit costs a spawn or a building moved somewhere else, and the sweeps say where.
