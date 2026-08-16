# Systems plan — the arithmetic, the economy, and the crafting web

Fourteen stacked PRs, in dependency order. One feature each, each shipping green with no dead
buttons and no half-wired surface — the same rule `docs/dungeon_plan.md` was built under.

It comes out of an audit of what v1 actually does rather than what it was asked for. The findings
are not "the game is small": it is deliberately small, and that is fine. They are places where the
systems already in the code **disagree with themselves** — a death that pays the player, a currency
with nothing to buy, a level cap six levels past the content, armour that stops nothing, and four
gathered materials that lead nowhere.

| #   | PR                                                       | Phase             | State             |
| --- | -------------------------------------------------------- | ----------------- | ----------------- |
| 1   | Death has a price                                        | Arithmetic        | merged 2026-08-10 |
| 2   | The level cap meets the content                          | Arithmetic        | merged 2026-08-10 |
| 3   | Armour that stops something, and a hand to hold a shield | Arithmetic        | merged 2026-08-10 |
| 4   | A swing that can miss, and one that can land hard        | Arithmetic        | merged 2026-08-10 |
| 5   | The bank                                                 | Economy           | merged 2026-08-11 |
| 6   | Stock worth coming back for                              | Economy           | merged 2026-08-11 |
| 7   | The trainer                                              | Economy           | merged 2026-08-11 |
| 8   | Mining, and the first thing worth carrying home          | Crafting web      | merged 2026-08-11 |
| 9   | Smithing, and the forge it happens at                    | Crafting web      | merged 2026-08-12 |
| 10  | Nothing gathered is a dead end                           | Crafting web      | merged 2026-08-13 |
| 11  | A camp that can cook and craft                           | Crafting web      | merged 2026-08-13 |
| 12  | Quests that ask for something other than a bag           | Reasons to return | merged 2026-08-16 |
| 13  | Repeatable work                                          | Reasons to return | planned           |
| 14  | Mastery                                                  | Reasons to return | planned           |

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
it: food, fuel and inputs now, and crafting supplies once PR 9 lands.

**The shop must never stock what the world is supposed to drop.** That decision is already made and
written down — armour used to be sold here and was deliberately moved out, so that gearing up is
something every class goes and takes. The rule this PR adds is that the stock is tools, consumables
and inputs, and never the gear tier.

That rule contradicted this section's own shopping list, which named "the starter shield from PR 3":
`brown-shield` carries a tier, an armour type and a 6% slot on the bandit table, so stocking it would
have broken the rule in the same breath as writing it down. **The rule won** — it is stated twice
more (in `CLAUDE.md` and in the bandit loot table's own comment) and it is the load-bearing half. The
shop stocks no equipment but the two gathering tools, and what keeps it that way is a test rather
than a comment: stocked equipment has to be a tool. The offhand stays a bandit drop.

Bulk buying is deliberately **not** here, and the reason is worth keeping when consumables make it
tempting: "sell all" is exact because a stack is finite, and there is no matching number on a shelf
that never runs out. A "buy 5" button would be the arbitrary constant this codebase does not keep.

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

Shipped with one amendment to that last line, and it is the load-bearing detail: the migration grants
only the ability that is now **sold**, because the one each class opens with is not stored at all.
`AbilityDefinition.training` being absent is what makes an ability free, so `knownAbilities` derives
the bar from the table and `learnedAbilities` together and the save holds exactly what coin was spent
on — the `unlockedZones` split again. Granting the opener too would have put a row in every save that
means nothing, and a step that read the live `ABILITIES` table instead of naming the two ids outright
would have handed every ability added later to every old save that never paid for one.

Two things the section did not say and that turned out to matter. The gating levels are chosen
against the content: the chief is the level 4 fight, so the level 4 purchases land after it rather
than trivialising it. And where the trainer _stands_ is a tap rule — the first placement put them
three tiles up the north road out of the spawn point, which is exactly where a player taps to walk
forward, and smoke caught it as three ground-walk checks stopping an interact radius short.

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

Shipped as **two** ores rather than one, and it is the fishing gate wearing different clothes: a tin
vein anyone can work and an iron vein behind mining 5, the way the town pond and the ocean stand.
One ore would have been a skill with nothing to climb toward, and PR 9 needs a soft metal and a hard
one anyway. Tin rather than copper for the plainest possible reason — the currency is already
copper, and "Copper Ore x12" sitting a panel away from a purse counted in copper is a sentence
nobody should have to parse. The pickaxe joins the shelf ungated beside the other two tools, since a
gate on a tool is a gate on the skill.

Three things the section did not say and that turned out to matter.

**"Almost all of this is data" was true of the simulation and false of the renderer.** `buildNode`
picked its prop with `node.definition.solid`, which had been standing in for "is it a tree" for as
long as trees were the only solid node — so the first vein would have been drawn with a trunk and a
canopy. `ResourceNodeDefinition` names a `shape` now, switched on the way `buildCreature` switches
on an enemy's, which is the rule this codebase already had and had never had a second case for.

**The blocker fraction had to become data in the same breath.** It was one constant, `TRUNK_FRACTION
= 0.3`, and a boulder wearing a third of a tile lets the player walk most of the way into it — while
sizing the mesh off that blocker, which is the convention that keeps what stops you and what you see
agreeing, would have drawn the vein as a pebble. `blocks` is a fraction per row now, or `null` for a
fishing spot.

**A fifth zone broke a browser check that had nothing to do with mining**, which is the sort of thing
only the real thing catches. The hideout section taps the chief with the map sheet still open; the
HUD swallows taps that land on it by design, and that tap had been getting through only because the
world map was short enough to leave that corner of the screen uncovered. A third row of zones covered
it. The section shuts the sheet now — a check that depends on how tall an unrelated panel is is not
checking what it says it is.

The cap stayed at 5, and the plan's own "each new zone raises it again" is the line that wanted
amending rather than obeying: what raises the cap is content that reaches _higher_, and the quarry
spawns nothing above level 3. `progression.test.ts` says so directly, and `CLAUDE.md` now says it in
those terms.

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

Shipped with two amendments, both about the forge being a _place_.

**It is opened by tapping it, not by standing near it.** Proximity was the first cut and it is wrong
on a map this size: a panel that appeared whenever the player came within reach put itself in front
of anyone walking past on their way north. A station is picked and walked to exactly like a counter
now, and proximity decides only when the panel _closes_ — which is the rule the channel at it
already lived by.

**It sits below mobs in the pick priority.** That list is a priority rather than a depth sort, so a
kind above mobs wins from anywhere along the ray, including well behind what is being aimed at. A
person is small and stands at the edge of a map; a forge is a tile of furniture near the middle of
town.

The claim that cooking's tests would not change at all was very nearly right: their assertions did
not, but the file moved with the module and the identifiers in it did (`COOKING_RECIPES` → `RECIPES`,
`cookMs` → `durationMs`, `burnt` → `failed` plus a new `consumed`). Two things had to be _worked_ for
rather than falling out: the channel bar's label, which naming recipes after their output would have
changed from "Raw Fish" to "Cooked Fish", and the missing-inputs message, which is keyed on the
station so cooking still says "You have nothing to cook."

A smoke check three sections downstream started failing about one run in three, and the forge was not
the cause — see the commit. A counter is only closed by walking out of range, so a bank panel opened
by an earlier section survived any teleport that landed near the banker and swallowed a later tap.
Worth knowing when the next station lands: **a section that opens a panel owes the run its closing**,
and `standSouthOf` now shuts the counters rather than trusting that.

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

Shipped with a fifth dead end the section did not list, and it is the widest of them: **the tin bar
PR 9 had just taught the forge to make was consumed by no recipe at all**. The audit that produced
this document predates the bar existing, so the finding it names is four items and the finding in
the code was five — and the new one is worse than the four, since a whole vein, a whole ore and a
whole smelt terminated in vendor trash. That is what decided the shape of the sweep: rather than
four unrelated uses, the plate tier grew two secondaries, so the tier every gathering loop was
already feeding becomes the place they all meet.

Bones and logs are one recipe rather than two. Naming both on every armour row would have made a
helmet cost bars, fittings, bones and wood, and a cost line nobody reads is a cost line that stops
being weighed — so they burn down together into bone char and the armour names that. Tin is the
tinning that keeps the iron from rusting, which is also what keeps the **soft** vein worth swinging
at after the hard one opens: mining 5 would otherwise retire the tin vein the day it was reached.

Rat meat landed where the section said and bought one thing it did not predict — it is the only food
in the game that needs no tool, so the first rations now come before the sixty copper pole rather
than after it.

Two things about the surfaces turned out to matter, and both were free.

**The fire's list is the bag and the forge's list is a panel, so a new recipe has to pick a side.**
`recipeFromItem` only answers for a recipe taking one of one thing, which is what the bag's Cook
button is driven off; anything with a list is asked for by name at a station. Rat meat is
single-input and reached the bag by construction, and bone char has a list and reached the forge
panel by construction. A multi-input _cooking_ recipe would have needed a panel over the campfire
and is the reason there is no rat stew.

**The dead-end rule wants three tests rather than one.** "An input or a value" is too weak on its
own — a vendor price is enough for something that drops, but a gathering skill whose yield can only
be sold is exactly the dead end this PR is named after. So what a _node_ yields is held to the
stronger rule, everything else to the weaker one, and a third asks the same question from the far
end: nothing is made that cannot be worn, eaten or built with. The middle one needs the key as a
third answer beside a recipe and a price, which is the `unlockedZones` split showing up once more.

A pre-existing bug surfaced while checking this and is fixed in its own commit, since it is nothing
to do with materials. `pickTap` is a priority and not a depth sort, so an NPC wins over a mob from
anywhere along the ray — and the ray in to a creature comes down low over the ground just short of
it, because the camera stands south of the player. The two rats either side of the town square
spawned with the banker and the shopkeeper **inside their wander disc**, so either of them was
untappable whenever it drifted that way, and smoke's finger tap picked the counter about one run in
three. `zones.ts` had already written this rule down over the forge's placement and moved the
furniture for it; nothing held it over the people. It is a test now, swept over every mob's whole
wander disc in every zone.

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

Shipped as written, with four things the section did not say and that turned out to carry it.

**The order between the two inputs is the whole rule, and it had to be argued rather than picked.** A
station beats a tool: you walked to the forge, where the pickaxe is merely what you are holding. What
makes that safe rather than a trap is that a craft eats out of the bag and the bag runs dry — so
standing at a forge with the last ore in the pack is a smithing camp that becomes a mining camp, and
settling in at a fire on the beach with a pole is a camp that fishes and cooks by turns. A tool-first
order would have made the second of those impossible and the first pointless.

**The camp does not light its own fire**, which was the first cut and is wrong for two reasons that
only showed up written down. A log is not the camp's to spend, and a fire lit wherever the camp
happened to be standing gets relit at every node a gathering camp walks to. Ninety seconds turns out
to be the right length anyway: a stack of fish is well under a minute of cooking, so one fire is a
whole cooking camp, and when it goes out the camp goes back to what it was doing instead of feeding
logs to a fire all night.

**Offline needed a save field, and it is the first thing here that could not be derived.** A zone
says what a camp was fighting and what it was gathering, because both are facts about the map; where
in the zone somebody stood is not, and a forge is one tile of a town. `AfkSession.station` records
the station the camp _settled to work at_ — none for a gathering or fighting camp — so the morning's
payout runs the same precedence the awake loop decided at the toggle. Whether a fire counts is
`STATION_PERSISTS`'s ruling rather than something the toggle decides, which keeps the rule this
section is named after in one testable place.

**A making session is the only one that spends anything**, and that is the bug this would have
shipped with. Every other branch of the offline report only ever adds to the pack, so `resolveParked`
only ever handed `drops` over — which against a forge would have minted forty bars out of ore that
was never taken. `OfflineAfkReport.consumed` runs the other way and is spent before the drops are
given, and the away report grew a "Used:" heading to match, because coming back to a pack forty ore
lighter with no line saying where it went reads as a bug rather than as a night's smithing.

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

Shipped as written, with five things the section did not say and that turned out to decide it.

**The baseline is one rule over two counters, and that is what a visit had to be bent to fit.** The
obvious shape for `visit` is a set of places seen, and it is wrong twice: it needs a second "since
when" question that the baseline already answers for kills, and a zone already visited can never
satisfy it again, so the quest is either instantly done or permanently impossible depending on where
the player has been. Counting **arrivals** instead makes a visit exactly a kill with a different
tally behind it — one derivation, one stored number, and "go there" means the same thing to a veteran
as to a newcomer. `CharacterState.visits` is the second counter in the game that has to be stored,
for the same reason `kills` was the first: `zoneId` says where somebody is, not where they have been.

**A world built for a zone _is_ an arrival in it**, which is what settled where the tally is credited.
`ZoneWorld`'s constructor, not `recordLocation` — that one is called on every autosave and answers a
different question — so the walk, the travel off the map and the session resumed into a zone all
credit exactly one arrival without any of them knowing the others exist.

**A locked quest is drawn, not hidden.** `QuestOfferState` gained `locked`, and the row is still
tapped like any other, carrying the quest it waits on where its progress would sit. That is the third
time this codebase has made the same call — the gated shelf row and the shut zone cell are the other
two — and the argument transfers whole: what is not offered yet _is_ the reason to come back. The one
place it is not treated as an offer is the marker over the giver's head, which would otherwise send
somebody across town to a counter with nothing to say.

**The chain had to be laid over the quests that were already a sequence**, or `requires` would have
been a field only new content used. The feast now needs the bones handed in, which is the order the
progression test already walked and the order the reward gear tiers in. From there the line runs
bones → feast → the bandit contract → the chief, with the quarry errand off to one side as the only
quest in the game that asks for nothing but the walk.

**Gear had to become an optional reward, and a kill objective had to ride an existing grind.** Every
quest paying a piece of armour would have out-dropped the bandit camp that armour is supposed to come
from, so three of the five pay coin and XP alone. And the bandit contract asks for **twelve** where a
full set costs seventeen kills: a kill objective that asked for more than the grind already makes
would be a second grind wearing a quest's clothes. `tests/systems/progression.test.ts` holds both the
arc it lands in — still level 3, now with four quests in it rather than two — and that twelve-under-
seventeen relationship, and the chief's quest is deliberately outside the arc, being the capstone the
last two levels are for.

One thing the content does that the mechanism does not: the hideout is now **findable**. Its key is a
3% drop off bandits, so before this the door at the back of the camp was discovered by accident or
not at all — a quest that names Hollis and says where his men keep the key is the only thing in the
game pointing at it.

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
