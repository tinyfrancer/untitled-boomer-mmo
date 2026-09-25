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

| Question                                                  | Answer                                                          | Decision |
| --------------------------------------------------------- | --------------------------------------------------------------- | -------- |
| A camp running with the tab open: pile, or not?           | **No pile.** It keeps counting what it could not carry.         | 62       |
| How long does a pile last? Does a second kill add to one? | **One minute** of game time. **Each kill leaves its own pile.** | 63       |
| Does a pile survive the player's death?                   | **Yes.**                                                        | 63       |
| Does the bow need ammunition?                             | **Arrows**, made by **fletching and smithing** together.        | 64       |
| (Raised by the user)                                      | **A hunter/ranger class** whose weapon is the bow.              | 65       |

The last two reshape phase 12, which is why this now runs to phase 13: see
[below](#phases-12-and-13--the-ranger-arrows-fletching-and-willow).

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

## Phases 12 and 13 — the ranger, arrows, fletching and willow

**What changed.** The plan's phase 12 gave a bow to the warrior, trained by an `archery` skill,
with no ammunition. The user has since chosen **a third class whose weapon is the bow** (decision
65 — which reverses the part of decision 55 that rejected a third class this round) and **arrows,
made by fletching and smithing** (decision 64). Rewrite the plan's phase 12 to match before
building it.

**Recommended split — confirm it with the user first.** A class that begins at level 1 needs its
weapon and its ammunition at level 1, so the bottom of the whole chain has to land with the class.
Willow is the upper band's tier of that chain, and is the part the plan already described.

- **Phase 12 — the ranger.** The class, a starter bow, the `archery` combat skill, arrows at the
  lowest tier, and fletching's first rung: shafts from `logs` (woodcutting 1), heads from `tin-bar`
  at the town forge (smithing 1), the two made into arrows. The duels and the save migration.
- **Phase 13 — willow.** The willow node on the mill road's millpond above hardwood, a willow bow and
  shafts, and iron and steel heads at the forge's existing tiers. `deadEnds.test.ts` holds willow to
  having a use on the day it lands, which fletching already existing makes easy.

**Still to put to the user** — none of these is answered, and each is a real fork:

1. **Hunter or ranger?** The user wrote both. This doc says ranger for want of a name.
2. **Is the bow the ranger's alone?** The plan gave it to the warrior. Weapons are open to every
   class today; only armour is restricted, through `ARMOR_TYPE_CLASSES`. A bow that only one class
   can hold is a new rule, and the shape it would take is a table by `weaponShape` beside that one.
3. **What does a ranger's damage scale with?** `PrimaryStat` is `'strength' | 'intellect'`. A new
   third stat reaches `ClassStats`, `LevelGrowth`, gear bonuses, reforges, stats, inspect and
   every piece of gear that names one — much the biggest option. Strength also buys carrying
   capacity (`EncumbranceSystem`: 70 plus 3 a point), which matters to a class that carries arrows.
4. **Where does a level 1 ranger get arrows?** Either a starting stack and a fletching bench in
   _town_ beside the forge, where logs and tin are already level 1 — which moves the bench the plan
   put in Greyford's yard; or the town shop sells a plain arrow and the bench stays in Greyford as
   planned, with fletching an upper-band skill. The recommended split assumes the first.
5. **What happens without arrows?** Ammunition implies one is spent per shot, which this doc
   assumes; confirm it. Then a bow with none either refuses to fire, with a line saying why, or
   falls back to the fists (`unarmed`, which already exists as a skill).
6. **Where are arrows carried?** In the bag, spent from the stack, is the smallest change: no new
   slot, nothing stacked inside an equipment slot, no migration for it. A quiver in the offhand is
   the alternative — the bow is two-handed, so the slot is free — but a slot holds one item id
   today, not a count.

**What the code already does, and what is new:**

- **A new `ClassId` is mostly compile errors**: `CLASSES`, `CLASS_ABILITIES` (four on the bar, the
  attack first), and every quest's `gear` reward. **Except `CharacterCreate.ts`**, whose `CLASS_IDS`
  is a plain `ClassId[]` — a third class would simply not be offered at creation. Make it
  `exhaustive<ClassId>()` while you are there. A new class needs **no save migration**, since every
  existing save names one of the two that exist; the ternary in `migrations.ts` that picks by class
  is history and stays as it is.
- **Armour**: leather is warrior-only in `ARMOR_TYPE_CLASSES`. A ranger in leather is one entry.
- **The offhand is "one per class"**, a shield and an orb, and the comment on `brown-shield` in
  `data/items.ts` argues it. A two-handed class has none, so that comment needs correcting.
- **Nothing is two-handed yet.** Equipping a bow has to empty or refuse the offhand, and an offhand
  equipped over a bow has to be refused or unequip it — a rule in `CharacterController`, which
  refuses as a whole rather than half-applying. If the bow is the ranger's alone and the ranger has
  no offhand at all, this shrinks to "a ranger's offhand is always empty", but a warrior holding a
  bow would still need it.
- **Ranged auto-attacks are not new**: the wand reaches 200-220 through `attackRange` and
  `weaponAttackRange`. Mobs do not path (decision 26), so the wizard already kites for free, and the
  bow's reach is priced against the wand's. **What is new is the spend**: the player's swing in
  `CombatDirector` (where it pushes `swing` with `by: null`) takes an arrow through
  `CharacterController`, and the inventory publishes on every shot.
- **The camp spends arrows too.** An awake ranger camp runs out and has to stop fighting. The
  offline payout (`systems/OfflineAfkSystem.ts`) credits kills by count, so it has to bound them by
  the arrows carried and spend them — otherwise the offline camp is a bow with infinite ammunition.
- **A recipe makes exactly one item** (`CraftingRecipe.outputItemId`, no quantity). One tin bar for
  one arrowhead makes arrows cost more than any kill pays back. A bar that makes a handful needs an
  output quantity, new to `CraftingSystem`, the offline camp's crafting payout, and the station's
  list.
- **Nothing weighs under 1** (`DEFAULT_ITEM_WEIGHT`), and fifty arrows at 1 each would be most of a
  wizard's pack. Arrows need a fractional weight, the game's first: check that the bag's weight
  readout, `carryableCount` (which floors spare over weight) and a float sum of the pack all behave
  with one.
- **The camp can only settle to a one-of-one recipe** (`findCraftableFrom`: one input, quantity 1).
  Shafts from a log and heads from a bar can be camp jobs; shaft plus head into arrows has two
  inputs and cannot. That is probably fine — putting arrows together is hands-on — but it is a
  property to choose, not discover.
- **Two new skills mean a save migration.** Saves are at `CHARACTER_STATE_VERSION` 22; every past
  skill addition bumped it and spread `createInitialSkills()` _under_ the saved skills, so existing
  progress survives and only the new ones start fresh (`persistence/migrations.ts` shows three).
  `fletching` is a making skill (`GatherSkillId`, like smithing), `archery` a combat one
  (`CombatSkillId`).
- **Fletching's station** follows the tannery, which arrived third and widened nothing: a
  `StationId` with its `STATION_LABELS`, `STATION_ACTION_LABELS` and `STATION_SKILLS` entries,
  `recipesAt`, a bench in a zone's `stationSpawns`, and `RECIPES` rows
  (`docs/architecture/making.md`).
- **Balance**: the duels in `EnemySystem.test.ts` hold every class to the same curve — a fresh level
  1 beats a level 1 rat comfortably, sweats a 2, loses to a 3 — so the ranger gets a row there, and
  `progression.test.ts` holds its arc. The plan's line still applies: the bow is a different fight,
  not a better one.

## Things learned this session that are already written down

In case a fresh session meets them before it reads the file that explains them:

- A dev container cannot measure the draw budget; CI can (decision 50).
- Escape is shared by the HUD and the world, and the HUD cancels a key it takes
  (`docs/architecture/hud.md`).
- A sound cannot poll state; a moment worth hearing is a `WorldEvent` (decision 61).
- `localStorage` holds the sound setting beside the save, so "is anything stored" no longer means
  "is there a save" — smoke checks the save's own key.
- A new zone or exit costs a spawn or a building moved somewhere else, and the sweeps say where.
