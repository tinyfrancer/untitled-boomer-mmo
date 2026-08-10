# Systems plan — the arithmetic, the economy, and the crafting web

Fourteen stacked PRs, in dependency order. One feature each, each shipping green with no dead
buttons and no half-wired surface — the same rule `docs/dungeon_plan.md` was built under.

It comes out of an audit of what v1 actually does rather than what it was asked for. The findings
are not "the game is small": it is deliberately small, and that is fine. They are places where the
systems already in the code **disagree with themselves** — a death that pays the player, a currency
with nothing to buy, a level cap six levels past the content, armour that stops nothing, and four
gathered materials that lead nowhere.

| #   | PR                                                       | Phase             | State   |
| --- | -------------------------------------------------------- | ----------------- | ------- |
| 1   | Death has a price                                        | Arithmetic        | planned |
| 2   | The level cap meets the content                          | Arithmetic        | planned |
| 3   | Armour that stops something, and a hand to hold a shield | Arithmetic        | planned |
| 4   | A swing that can miss, and one that can land hard        | Arithmetic        | planned |
| 5   | The bank                                                 | Economy           | planned |
| 6   | Stock worth coming back for                              | Economy           | planned |
| 7   | The trainer                                              | Economy           | planned |
| 8   | Mining, and the first thing worth carrying home          | Crafting web      | planned |
| 9   | Smithing, and the forge it happens at                    | Crafting web      | planned |
| 10  | Nothing gathered is a dead end                           | Crafting web      | planned |
| 11  | A camp that can cook and craft                           | Crafting web      | planned |
| 12  | Quests that ask for something other than a bag           | Reasons to return | planned |
| 13  | Repeatable work                                          | Reasons to return | planned |
| 14  | Mastery                                                  | Reasons to return | planned |

## The decision behind the order: the arithmetic before the content

Every instinct says to start with the crafting web, because that is where the missing game is. The
order here puts it eighth, and the reason is that **new content inherits the holes it is added
into**, and amplifies them:

- A gear tier added before armour mitigates is a tier of `+HP`. The interesting axis does not exist
  yet, so the new items cannot use it, and retrofitting it later re-tunes every item twice.
- A bounty board added before coin sinks mints currency into an economy whose entire demand is
  120 copper. More coin chasing nothing is not an economy, it is a bigger number.
- A production skill added before the level cap is honest trains toward a ceiling
  (`combatSkillCap` is `level × 10`) gated behind levels that have nothing to earn them.

So phase one changes almost no content and adds almost no surface. It is four PRs of making the
numbers already in the game mean what they claim to mean. Phase two gives coin somewhere to go, so
that phase three has something to sell and phase four has something safe to pay out.

**One production vertical, not three.** RuneScape has eight gathering-to-crafting chains and Melvor
has twenty, and the temptation is to lay in mining, smithing, fletching, herblore and alchemy as
five thin tables. One vertical — ore to bar to gear — done fully is worth more than five half-wired
ones, and the architecture makes the second vertical cheap once the first exists: a recipe is a
table row, and a station is `Campfire` with different data.

**Stations, not menus.** This is the fork where a game like this drifts from an MMO into an idle
game with a world attached. The campfire is already the right model — a thing placed in the world,
a channel with a duration, and range being what cancels it — and every crafting surface here is
built as its twin rather than as a panel opened from the bag. It keeps "go somewhere and do
something" as the shape of the game, and it reuses the channel bar, which already draws a gather, a
cook and a cast.

**Each PR that touches `CharacterState` owes a migration step.** Six of these do. The pattern to
copy is v6 → v7 in `persistence/migrations.ts`, which spread `createInitialSkills()` under the
stored skills so existing progress survived and new keys arrived at their defaults.

---

# Phase one — the arithmetic

## 1 — Death has a price

`ZoneWorld.handlePlayerDeath` sends a player who dies away from town back to town at full HP, and
charges nothing: no XP, no coin, no durability, no corpse. So from the bandit hideout, walking into
a bandit is a free teleport home **and** a full heal, strictly faster and cheaper than walking. The
bug is not the missing punishment — it is that dying is currently a positive-utility action, which
is a thing no player should ever be able to say.

Ships: **respawn at the current zone's own spawn point** rather than in town, plus a recovery fee in
copper that scales with character level. Dying in town is unchanged, because it already respawns at
the town spawn point.

The in-zone respawn is the part that closes the exploit — what death costs is the walk back, which
is EverQuest's corpse run with no corpse to lose. It is safe by construction: zone spawn points are
already clear of aggro on purpose (`spawns.ts` places the bandit camp's mobs "far enough east that
arriving from town never lands inside an aggro radius", and the hideout's entrance hall is
deliberately left empty), and the world map is still a way out, since travel is refused only while
something is engaged and a fresh respawn has nothing on it.

The fee rather than XP loss is a deliberate call. At `80n²` over the level curve, an XP penalty big
enough to be felt is big enough to erase an evening, and the offline cap already keeps progress
slow. Coin is the resource the game has too much of, so coin is what death should take. A player who
cannot pay pays what they have — `spendCurrency` already returns false when short, and the respawn
must never be blocked on it.

Touches `ZoneWorld.handlePlayerDeath` and a new engine-free `systems/DeathSystem.ts` for the fee, so
the arithmetic is unit-testable at level 1, at the cap, and with an empty purse. Note that this
**deletes** a branch rather than adding one: with every respawn in-zone, the `respawnZone: 'town'`
path and the zone load it triggers in `GameContext` stop having a caller, and the field should go
with them rather than being left as a switch nothing sets.

Held by a world test that dying in the bandit camp leaves you standing in the bandit camp.

## 2 — The level cap meets the content

`MAX_CHARACTER_LEVEL` is 10. Summing `80n²` from 2 to 10 is **30,720 XP**, and the richest
repeatable thing in the game is a level 3 bandit at 31 XP — about 990 of them, in a world whose
every zone is levels 1-3 with a single level 4 boss at the back of it. Levels 4 through 10 have
nothing built for them, and because `combatSkillCap` is `level × 10`, the combat skills are gated
behind levels that have nothing to earn them either.

Ships: `MAX_CHARACTER_LEVEL` to **5**, and `tests/systems/progression.test.ts` extended to assert
the arc ends where the content does rather than merely reaching level 3.

Max level should be an achievement, not an asymptote. Five is where the content actually reaches —
the chief is level 4, and a geared level 3 already beats him. This is one constant and a retune, and
it is the most reversible thing in this document: each new zone raises it again.

Three second-order effects have to be handled in the same PR, because leaving any of them is worse
than not doing it:

- **`combatSkillCap(5)` is 50, not 100.** At `DAMAGE_PER_WEAPON_SKILL` of 0.004 the top-end weapon
  skill bonus halves from +40% to +20%. Re-slope the coefficient against the new ceiling.
- **`MAX_AVOIDANCE` is already unreachable, and this makes it worse.** At `AVOIDANCE_PER_SKILL` of
  0.002 the 25% ceiling needs skill 125, which the level 10 cap never permitted either — the real
  ceiling today is 20%, and at cap 5 it becomes 10%. The constant has been describing something
  impossible since it was written. Either the rate rises or the cap comes down to the truth.
- **`OFFLINE_MAX_LEVELS_GAINED` is one level per session**, which was a tenth of the game and
  becomes a fifth of it. The cap is what makes offline safe, so it moves with the curve.

## 3 — Armour that stops something, and a hand to hold a shield

Armour grants `+HP`, `+STR` and `+INT` and mitigates nothing — there is no damage reduction anywhere
in the codebase. Three things follow that are all wrong at once: cloth versus leather versus plate
is a class restriction rather than a defensive difference, `ARMOR_TYPE_CLASSES` has defined `plate`
since armour types landed with **no plate item in the game**, and `CombatSystem` trains a Block skill
while stating outright that "there are no shields yet".

Ships: an `armorValue` on equipment feeding a mitigation step, an `offhand` gear slot, and the first
things to put in it.

Mitigation is **proportional with diminishing returns** — `armor / (armor + K)` — rather than flat
subtraction. At these damage numbers a rat hits for 3, so any flat reduction worth wearing is
immunity within one tier. K is tuned so a full brown set sits near 15% and the plate tier that
arrives in PR 9 near 30%. `MIN_DAMAGE` already floors a hit at 1, so mitigation can never zero one.

Player-side only, deliberately. Enemies get no armour value until something needs one — a field on
`EnemyDefinition` that every row leaves unset is the kind of dead data this codebase does not keep.

The offhand ships with something for **both** classes — a shield in leather and plate for the
warrior, and an orb or tome carrying `+INT` for the wizard — because a slot that is furniture for
half the roster is a dead button by the rule above.

Block gets a bonus from a shield rather than requiring one. Requiring it would strand every point of
Block every existing character has already trained, and the skill has been trainable since before
the slot existed.

Touches `types/ids.ts`, `InventorySystem.NO_GEAR` (whose comment already anticipates this — "a fifth
slot would have been four separate compile errors away from anyone noticing"), `StatsSystem`,
`CombatSystem`, `EquipSystem.stripIllegalGear`, `hud/paperdoll.ts`, `render3d/figure.ts`, the slot
picker, and a migration. The duels in `tests/systems/EnemySystem.test.ts` are the tuning contract and
they move here — that is the point of the PR, not a side effect of it.

## 4 — A swing that can miss, and one that can land hard

`rollDefense` has exactly one caller — `CombatDirector.strike`, which is the player being hit. The
player's own swing (`CombatDirector`, line 150) rolls `resolveAttack` and nothing else. So **mobs
never avoid anything and the player never crits**: damage is `attackPower × ±25% × (1 + 0.004 ×
skill)`, every swing, forever.

Ships: a crit roll on the player's swings and abilities, and an avoidance roll on the mob's side.

Crit chance comes **out of the weapon skill rather than out of a new stat**. The skill currently buys
0.4% damage a level, which is imperceptible by construction — a level's worth of training is a
rounding error on a damage number. Moving part of that budget into crit chance changes nothing about
the average and everything about whether training is felt, because a crit is a moment and a
multiplier is not.

Mob avoidance lands on the crab, which needs no new justification: a scuttling, armoured thing that
is already designed as a long fight rather than a dangerous one is exactly what a dodge chance is
for. Every other row leaves it at zero, so the field has a user the day it exists.

No new channel is needed. A crit is a `tone` on the float event the view already draws, coloured
from `FLOAT_TONE_COLORS`, plus a combat log line. `resolveAttack` already takes an injected `rng`, so
all of this is unit-testable without a world.

---

# Phase two — money means something

## 5 — The bank

There is no storage of any kind. The weight limit's only answer is a vendor, so a gathering run ends
with the materials leaving the game — which is merely restrictive today and becomes actively wrong
in PR 9, where the whole point is hoarding inputs until there are enough to smith with.

Ships: a banker NPC in town, `CharacterState.bank` as an `Inventory`, deposit and withdraw, and
**paid slot expansion as the second coin sink**.

Weightless but slot-limited, which is RuneScape's answer and the one that makes expansion a thing
worth selling. It reuses `ShopSession` wholesale in shape: a session opened at a radius and closed by
walking away, a HUD overlay handed a copy of the contents, and bare item ids coming back — so a panel
in an HTML overlay never outlives the zone it was opened in.

The bank makes `EncumbranceSystem` matter more rather than less. The pack stays small and awkward;
the bank is where the depth goes.

## 6 — Stock worth coming back for

`SHOP_STOCK` is two tools at 60 copper each. Total demand in the game is 120 copper, against bandits
carrying 8-25 at 90%, a chief carrying 60-120 at 100%, and 360 from the two quests. The comment in
`shop.ts` says "the vendor spread is what makes earning coin matter", and with nothing behind the
spread it does not.

Ships: a gate on `ShopStockEntry` — a level or a finished quest — and a stock list that grows behind
it: food, the starter shield from PR 3, and crafting supplies once PR 9 lands.

**The shop must never stock what the world is supposed to drop.** That decision is already made and
written down — armour used to be sold here and was deliberately moved out, so that gearing up is
something every class goes and takes. The rule this PR adds is that the stock is tools, consumables
and inputs, and never the gear tier.

## 7 — The trainer

Levelling grants stats and no choices. `CLASS_ABILITIES` hands a character both of their abilities at
level 1, so the action bar is complete before the first rat dies and nothing about a level is ever
chosen.

Ships: abilities **learned rather than granted** — a trainer NPC in town, a cost in coin and a
required level per ability, and `CharacterState.learnedAbilities`.

This is the third sink, and it is the one that buys the most: it puts a decision inside levelling,
gives the action bar somewhere to grow, and gives coin a demand that scales with progress instead of
capping at a fixed shopping list.

It ships **two more abilities per class** in the same PR, taking each to four. Charging for two
abilities a character already had is not a system, it is a paywall on the status quo; there has to
be something to choose between and something to save for.

Existing characters keep what they have — the migration grants both current abilities as already
learned.

---

# Phase three — the crafting web

## 8 — Mining, and the first thing worth carrying home

Ships: a `mining` gathering skill, ore veins as `RESOURCE_NODES` rows, ore items, a pickaxe, and a
quarry zone to swing it in.

Almost all of this is data. A vein is a tree with different numbers — `charges` and `respawnDelayMs`
already exist and the tree already uses both — and a new zone is a `ZONES` row plus exits, which
`worldMap()` will lay out on the world map with nothing else written down, since it derives the
whole layout by walking the exits.

The payoff worth naming: **the AFK system absorbs the new skill for free**. `afkGatherSkill` reads
`toolSkill(gear.weapon)`, so a pickaxe in the weapon slot makes a mining camp — awake and offline —
with no new AFK code, no stored mode and no second button. That is the "read it off the tool" rule
paying for itself.

## 9 — Smithing, and the forge it happens at

Ships: a generalised `CraftingRecipe`, a smithing skill, a forge station, and ore → bars → a plate
gear tier.

**Generalise `COOKING_RECIPES` rather than adding a parallel table beside it.** A cooking recipe is
already `input → output + failure output + level + xp + duration`; a crafting recipe is the same
thing with an inputs _list_ and an optional failure output. Cooking becomes the one-input case that
sets a burnt result, smithing the multi-input case that sets none, because a failed smith should not
destroy a bar. Cooking's behaviour is identical afterwards — this is a widening, and if the cooking
tests change at all it has gone wrong.

The forge is `Campfire`'s twin: placed in the world, in range or not, and cancelling the channel when
you walk off it. `GatherSession` already runs precisely this loop for the pan, down to re-arming
itself on whatever is left in the bag so that twenty bars are one decision rather than twenty.

The new tier fills `ARMOR_TYPE_CLASSES.plate`, which has been sitting in the data with no items since
armour types landed, and `TIER_COLORS` says in its own comment that "new tiers (iron, steel) should
be a row here plus item rows". The data was built for this.

## 10 — Nothing gathered is a dead end

Today: `logs` feed the campfire and nothing else; `rat-meat` is 3 copper of vendor trash and is
conspicuously **not cookable**, in a game with a cooking skill; `rat-bones` are ten for one quest and
then trash; `burnt-fish` is worth 1.

Ships: the sweep that wires the existing materials into the web PR 9 built. Rat meat becomes a
recipe, because it is meat and cooking exists. Bones feed something. Logs stay fuel and _also_ become
an input — handles and shafts for the smith, or charcoal for the forge. Burnt food stays worthless,
which is correct: it is the cost of a failed cook and it is supposed to sting.

A data sweep is its own PR because it is far easier to review as one, and because it is the change
that actually pays off the finding rather than merely enabling it.

It also ships the rule as a test: **every material is an input to something or carries a `value`**,
enforced over `ITEMS` and the recipe tables the way `uniqueLoot.test.ts` and the family-versus-loot-
table rule are already enforced over hand-written data.

## 11 — A camp that can cook and craft

`afkGatherSkill` reads the weapon slot, and **cooking has no tool** — so the skill with the deepest
active loop is the one skill that can never be camped, and smithing would inherit the same problem
the day it ships.

Ships: a camp derived from what is **in reach** as well as what is in hand. Standing at a fire
holding raw fish is a cooking camp; standing at a forge holding bars is a smithing camp.

This is the one place the "read it off the tool" rule has to bend, and the plan should say why rather
than let it look like drift: **a station is a tool you cannot carry**. Nothing is stored and nothing
is chosen twice — the derivation stays a derivation, it just reads two inputs instead of one.

One consequence has to be honoured rather than papered over: **offline crafting works at permanent
stations only, never at a campfire**. `FIRE_BURN_MS` is 90 seconds, so a fire does not survive the
tab being closed, and an offline session that pretended otherwise would be paying out for eight hours
at a fire that went out in the first two minutes. A forge standing in a zone is a fact about the
zone; a campfire is not.

---

# Phase four — reasons to come back

## 12 — Quests that ask for something other than a bag

`QuestObjective` is `{ itemId, quantity }`, so every quest that will ever exist is "hold N of a
thing". There are no kill objectives, in a game that stores a per-creature kill count; no
prerequisites; and no chains.

Ships: `QuestObjective` as a tagged union — `collect` as it stands today, `kill` reading
`CharacterState.kills`, and `visit` reading zone entry — plus `requires: QuestId[]` for chains.

One real tension to resolve rather than dodge. Kills are a **lifetime** tally, so a kill objective
read naively is already complete for anyone who has been playing: accept "kill 20 rats" after 60 rat
kills and it hands itself in. The fix keeps the principle intact — store the **baseline** at accept
time, not the progress, so `have` is still derived (`kills[id] − baseline`) and there is still no
counter that any of the five paths that award a kill could forget to bump.

## 13 — Repeatable work

A bounty board in town: repeatable kill and gather contracts, paid in coin and XP.

It is thirteenth for one reason. **Every bounty mints currency**, and a repeatable currency faucet is
only safe once there are drains to meet it — the death fee, bank slots, shop stock and the trainer,
which is PRs 1, 5, 6 and 7. Built before them it inflates an economy that already has more coin than
demand; built after them it is the thing that makes those sinks worth having.

The quest-reward XP path already exists and is the right one: a bounty pays through
`ZoneWorld.publishXpGain` rather than `awardXp`, so it never takes the camping penalty. Handing in a
contract is something the player did.

## 14 — Mastery

Per-node and per-recipe mastery — the Melvor axis, where the thousandth tree pays differently from
the first.

Last, deliberately. It needs the crafting web to exist before there is anything worth mastering, and
it is the only system in this document that is pure retention rather than content: it makes the
existing loop pay a curve instead of a flat rate, which is worth a great deal once the loop is good
and worth nothing before then.

The derivation rule points at storing a per-target XP total and computing the tier and its bonuses on
read, the way `AchievementSystem` already treats the one counter it stores.

---

## Deliberately not in this plan

- **Multiplayer.** `docs/initial_design.txt` has always wanted it, and nothing here is shaped to
  block it — the `SaveService` seam is still the intended swap point — but it is a backend project,
  not a systems one.
- **More classes.** Two classes with four abilities each and a real gear tier to chase is a deeper
  game than four classes with two. Revisit after PR 7.
- **A second production vertical.** Fletching and alchemy are each a table row plus a station once
  PR 9 lands. That is the reason to do PR 9 properly and the reason not to do them alongside it.
- **Durability and repair.** A third coin sink, and the one that annoys players most per copper it
  removes. The three in phase two should be measured before a fourth is added.
