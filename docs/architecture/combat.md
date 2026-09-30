# Combat and balance

Abilities and the trainer, cast times, levels on both sides, difficulty, the level cap, crits and avoidance, armour, enemy abilities, bosses, and pacing.

_Moved out of `CLAUDE.md` on 2026-09-25 (`docs/decisions.md` 57). The paragraphs are the ones that were there, in the order they were there; `CLAUDE.md` keeps the rules and points here for the reasoning. Where this and the code disagree, the code is right — and this file is what should be corrected._

**Abilities are learned, not granted** (`AbilityDefinition.training`, ruled on by
`systems/TrainerSystem.ts` and sold by `world/TrainerSession.ts`). A row names a level to have
reached and a price; **absent means the one ability the class opens with**, which is the shape
`ShopStockEntry.requires` and `ZoneDefinition.requiresKey` both use, so the table reads as a list of
what is _held back_ rather than of what is free. Each class has four: the opener, then three bought
at levels 2, 3 and 4 — and a second rank of each, bought at 5, 6, 7 and 8 (below).

`CharacterState.learnedAbilities` stores **only what was paid for** — what a class opens with is a
fact about `ABILITIES`, and `knownAbilities` derives the bar from the table and the save together.
That is the split `unlockedZones` makes for the same reason: the free one cannot go missing because
nothing has to remember it, and an ability that stops being sold stops needing a migration to hand it
back. `AbilityCaster` asks what is _known_ at the press as well as for the bar, since the button was
drawn from a copy of the character and a number key names a slot without proving one exists.

`trainingAccess` answers three things where `stockAccess` answers two, and the extra one is `known`:
a shelf sells the same thing forever, where a lesson bought is neither for sale nor withheld. A gated
row is still drawn and still tapped — the reason to reach a level is the thing waiting at it — and
each row carries what the ability _does_, which the shop's rows do not: a price is a fact to weigh at
a glance, where "attack 40% faster for 8 seconds" is the entire decision.

The gating levels are chosen against the content rather than spread evenly. The chief is the level 4
fight, so the level 4 purchases land after it rather than trivialising it, and the duels in
`tests/systems/EnemySystem.test.ts` still model auto-attacks alone — a bought ability moves what a
player who spent the coin can do, not the baseline the tuning contract is about.

**Levels 5 to 8 sell a second rank rather than a fifth ability** (`AbilityDefinition.rankOf`, act
three phase 11; `docs/decisions.md` 67). The bar is four buttons and a fifth would not fit beside
the signpost a thumb taps, so a rank takes the slot of the one it improves on: `knownAbilities`
answers the highest rank owned in each line, drawn in the slot its first rank holds, and
`trainingOffers` leaves the rank below out of the trainer's list once it has been bought past. A
rank is **its own `AbilityId`** naming the one it replaces, so `learnedAbilities` stores it like any
other lesson and no save needed a migration to start holding one. Three rules ride on it:

- **A rank is taught only to somebody who knows the rank below.** `trainingAccess` gates it on that
  after the level, since the level is the longer wait and the more useful thing to be told; the rank
  above a free opener asks only the level.
- **The cooldown is the line's, not the rank's** (`lineOf`, which `AbilityCaster` keys `lastCastAt`
  by), so a rank bought with the first still cooling is a better button rather than a fresh one,
  and the trainer is not a way to reset a clock.
- **A rank is its first rank better at the one thing it does and changed in nothing else** — a hit a
  quarter again as hard, a heal or a shield that holds more, a haste that goes faster — with the
  cooldown, reach, cast time and governing skill left as they were, since those are what say what a
  button is _for_. `tests/systems/TrainerSystem.test.ts` holds that over every rank, and so the
  ratios the first ranks argue for (Crushing Blow is not a better Power Slash) still hold between
  the second ones.

They are priced near a level's worth of kills each (800 to 1,600), which makes the trainer the
upper band's third coin sink beside the bank's shelves and the reforging stone.

**A cast time is a window in which standing still is the whole cost**
(`AbilityDefinition.castTimeMs`, run by `AbilityCaster`). Mana and the cooldown are spent at the
press and the spell is resolved later, so an interrupted cast costs everything and delivers
nothing — the same bargain the fizzle already makes, and what gives the window its weight. What is
decided at the _end_ is deliberately a different list from what is committed at the start: whether
it fizzles, and whether the target is still in reach, because both are questions about the moment
it lands. Nothing is paid in damage anywhere — the auto-attack keeps swinging through a cast — so
the cost is the window itself.

Two things break one. **Moving** does, and the caster reads that off the player rather than being
told, so every way there is to move (a key, a tap, a walk already under way) breaks a cast without
knowing one exists; starting one while already walking is refused up front instead, since a spell
that could never finish should not take the mana with it. **Being hurt** does, which is not the
same as being hit: a blow the mana shield eats leaves the cast standing, and that is the second
thing the shield is for — without it a caster in melee could never finish a spell, and with it
standing your ground is a decision rather than a mistake. Only the nuke has a cast time; the shield
is instant on purpose, being the thing you press once you are already in trouble.

**Levels scale both sides.** Enemies carry a `level` and derive HP/damage/XP from
`base + perLevel` via `scaleEnemyStats()`; characters grow through `perLevel` on their class and
`computeEffectiveStats(classId, gear, level)`. Keep those in step — making enemies tougher
without giving characters growth (or vice versa) silently breaks the difficulty curve. Enemy
name colors come from `conColor()` in `systems/EnemySystem.ts`: gray/green below the player,
white even, yellow +1, red +2 and up. Every zone sat in the 1-3 band until the mill road; the chief
at the back of the hideout is level 4, and the goblins on the road west are 4-5 and the only thing
above the band that can actually be ground.

**Difficulty is allowed to come from the spawn table rather than the stat block**, and the mill road
is where that is cashed. A goblin is a bandit with a little more of everything — the interesting part
is that they stand in **three knots of three** rather than spread across the zone, so the fight is
about not pulling the second one. That is a property of `OLD_MILL_ROAD_MOB_SPAWNS` and of nothing
else, which means it is exactly the kind of design a later edit can silently delete: spread the nine
of them out and every other test still passes while the zone quietly becomes the bandit camp with
bigger numbers. `tests/systems/oldMillRoad.test.ts` is what holds the knots — three groups of three,
each goblin with two companions inside a pull, and no two knots within aggro reach of each other, so
taking one on is never accidentally taking two.

**`MAX_CHARACTER_LEVEL` is a claim about the content, not about the curve**, and it is 9 because
that is where the content reaches: the richest thing anyone can grind is the level 8 barrow wight, and
the ten it used to be was 30,720 XP over seven levels with nothing built for them. Max level is meant to
be an achievement rather than an asymptote, so **content that reaches higher raises the cap** — and
`tests/systems/progression.test.ts` is what holds the two together, asserting that the cap sits one
level past the highest thing that spawns and that the climb from the end of the starter arc is
another session or two of the best kill there is rather than another game.

It is what a zone _holds_ rather than a zone arriving that moves it, and the five zones since that
rule was written are all worked examples of it. The quarry spawned nothing above level 3 and left
the cap exactly where it was. The mill road spawns level 5 goblins and moved it to 6; the fen spawns
level 7 raiders and moved it to 8; the barrow spawns level 8 wights and moved it to 9. The Deep Cut
is the clearest case of all, because it is a whole zone above the starter band that moved the cap
**not at all** — it tops out at 6 under a fen that already spawns 7, so `progression.test.ts` had
nothing to say about it. Nobody chose any of those numbers: the cap is asserted against the zones' spawns,
so raising the content is what raises the ceiling and the test says the new number before anyone has
to remember it.

**What that test will not let a zone get away with is paying too little for the room it added.** The
climb to the cap is held to a small multiple of the starter arc measured in the best repeatable kill
there is, and the curve is quadratic where a creature's XP is linear in its level — so a zone that
adds two levels while paying a goblin's rate walks straight into the ceiling. The fen's raider is
what that looks like when it is priced deliberately: 14 XP a level against the goblin's 11, which
lands the climb at 146 kills against a limit of 213. The barrow's wight is the same decision made
again rather than inherited — 18 a level, landing the climb at 147 against the same limit — which is
what a zone above the last one has to do every time.

Two things ride the cap and have to move with it, which is exactly what neither did before: the
combat skill ceiling is `combatSkillCap` (`level × 10`, so 80 now), and **what a trained combat
skill is worth is written as the ceiling and divided down by that cap** rather than as a rate
(`MAX_WEAPON_SKILL_DAMAGE_BONUS` and `MAX_AVOIDANCE` in `systems/CombatSystem.ts`). A rate is the
thing that silently stops meaning what it says when the cap moves: `MAX_AVOIDANCE` claimed 25%
against a rate that needed skill 125 to reach it and so had never once been reachable at any cap the
game has had. Derived, the number in the source is the number a capped character actually has. Both
clamp at the ceiling as well as reaching it, so a save made under the old cap cannot swing harder
than the game says anyone can.

Combat tuning is deliberate, not arbitrary: a fresh level 1 character should beat a level 1 rat
comfortably, sweat against a level 2, and lose to a level 3. If you change class stats, weapon
bonuses, or enemy growth, re-check that curve — simulating duels across the level range is much
faster than playing it. Crabs are long fights rather than dangerous ones; the bandit camp is
gated on gear rather than on level, which is the point given it is where gear comes from.

**The chief is the one fight gated on the level rather than the kit** (`bandit-chief` in
`ENEMIES`). A level 3 in what the camp outside drops takes him and a level 2 in the same gear does
not, which is the whole difference between the hideout and everywhere else. He is slow and heavy
rather than fast and sharp — a bandit's damage at not much over half its swing rate, on four times
the HP — so the fight lasts long enough for a cooldown, a meal, or running away, and the duels in
`tests/systems/EnemySystem.test.ts` are what hold that. Those model a warrior trading blows, which
is what every duel here models; a wizard's answer to 80 units of reach and a chase slower than they
walk is not to stand in it, and no arithmetic about swapping hits describes that.

**A swing can miss and a swing can land hard, and both come out of the weapon
skill** (`critChance` and `enemyAvoids` in `systems/CombatSystem.ts`). `rollDefense` used to have
exactly one caller — the player being hit — so nothing in the game had ever avoided anything the
player swung at, and the player had never crit.

Crit chance is **paid out of the weapon skill's existing budget** rather than added beside it: the
flat multiplier is derived from the crit half so the average at cap is unchanged by construction,
and only the _shape_ of it moves. The skill used to buy 0.4% damage a level, which is imperceptible
by design; a crit is a moment where a multiplier is not, which is what makes training felt. Retuning
the chance or the multiplier re-slopes the flat part instead of quietly moving the total.

Avoidance is `EnemyDefinition.avoidChance` and it belongs to the **armoured scuttling things** — the
crab, and the cave crawler that is the crab's idea one band deeper. A long fight rather than a
dangerous one is what a dodge is for, and every other row leaving it at zero is what keeps it from
being a tax on every fight; `CombatSystem.test.ts` holds that as the rule rather than as a list of
names, so a dodging thing has to be a crustacean and has to be passive. It is rolled before the damage
is, so a slipped swing costs the weapon skill its rep too.

Neither needed a new channel: a crit is a `crit` flag on the `hit` event the view already draws,
coloured from `FLOAT_TONE_COLORS` and marked with a bang so it reads on a screen being looked at
rather than watched.

**Agility is the second source of a crit, on top of the skill's** (`agilityCritChance`, act three
phase 12; `docs/decisions.md` 72): half a percent a point on a physical hit, capped at 15% on its own
rather than inside the skill's 20%. Inside it, agility would buy nothing once the skill was trained
out, and it would move the budget the flat bonus is derived from. **Physical is everything but a
spell** — every swing and shot, a staff's included, and every ability not governed by Destruction
(`isSpell`) — so a warrior's or a wizard's one point is half a percent on their swing, which is the
whole of what agility does for anyone not drawing a bow.

**Armour stops a share of a hit, and a shield is a hand rather than a stat**
(`armorValue` on an equipment row, curved by `mitigatedDamage` in `systems/CombatSystem.ts`).
Mitigation is **proportional with diminishing returns** — `armor / (armor + 80)` — rather than flat
subtraction, because at these damage numbers a rat hits for 3 and any flat reduction worth wearing
is immunity inside one tier. Nothing can reach 1, so armour never becomes immunity however much is
stacked, and `MIN_DAMAGE` still floors a blow at 1 underneath it. A full brown set with the shield
sits near 15%. The character sheet says the share beside the total (decision 99), off the same
`damageReduction` the hit is cut by, so a retune of the curve moves the sheet with it.

It is **player-side only**, deliberately: a field on `EnemyDefinition` that every row leaves unset
is the kind of dead data this codebase does not keep. It is applied in `CombatDirector.strike`,
which is the one path everything that lands on the player goes down — so a swing and a Cleave are
mitigated by the same line, and the mana shield soaks what got _through_ the plate rather than what
was swung at it.

**The offhand is the fifth slot**, and `NO_GEAR`'s comment predicted exactly how it would land — "a
fifth slot would have been four separate compile errors away from anyone noticing" — which is what
`exhaustive<GearSlotId>()` and a `Record<GearSlotId, …>` buy. One item per class, because a slot
that is furniture for half the roster is a dead button, and both drop off bandits like the rest of
the set: a slot nothing drops into is a slot nobody fills. A shield **helps** Block rather than
being required by it, since requiring one would strand every point of Block every existing
character has trained in a skill that predates the slot.

Armour moved the one fight tuned to a knife edge. A geared level _2_ took the chief once everyone
got tankier, which is precisely the gate the hideout exists to be — so the chief moved with it. That
direction is the rule: the content follows the arithmetic, and `tests/systems/EnemySystem.test.ts`
is where both are held.

**An enemy ability is telegraphed, avoidable, and spends the swing it replaces**
(`data/enemyAbilities.ts`, chosen by `systems/EnemyAbilitySystem.ts` and run by `CombatDirector`).
One rule covers all of them: it shouts for `windUpMs` — a float over the creature's own head, a line
in the combat log, and a line in the target frame — and lands on whoever is still inside `range`
when the clock runs out. An instant one would be unavoidable by construction, so there are none.

Two things follow that are easy to get wrong. **The wind-up spends the creature's attack cooldown**,
so an ability is a swing spent differently rather than one on top: standing in every Cleave is worse
than being plainly auto-attacked and stepping out of every one is better, which is what makes moving
worth the trouble instead of merely polite. And **a mob winding up plants its feet** (`Mob.update`
returns early on it) — something that kept closing while it shouted would land every one of these on
a player who did walk away, and the telegraph would be a lie.

Abilities are a **humanoid** thing, the same line `family` already draws for what a loot table may
hold: a rat has only its teeth. The chief's Cleave is what the boss fight is actually about, and the
bandit's thrown knife is what it reaches for when it _cannot_ reach you — `minRange` keeps it out of
melee, which is also what keeps the toe-to-toe curve the duels hold exactly where it was.

The tuning contract moved with it: `tests/systems/EnemySystem.test.ts` folds an ability into the
duel both ways, and the chief's line is now that a geared level 3 who stands in every Cleave loses
and the same character who steps out of each one wins.

**A boss is a named mob, and `boss: true` is a rule rather than a label.** An unattended camp never
_picks_ a fight with one — `decideAfkAction` filters it out of what is in reach and `campQuarry`
leaves it off the offline list — because a night parked beside him would mint sixty of the only
loot in the game that comes off one creature. It is still answered once it engages: something
already chasing an AFK character is arriving whether or not the camp chose it. His table is the one
place `cutthroats-bandana`, `cutthroats-blade` and `stolen-staff` exist, and
`tests/systems/uniqueLoot.test.ts` holds that over the data — uniqueness is nothing but every other
table not naming them, which is exactly what stops being true the day someone pads one.

**Pacing is held by a simulation, not by judgement** (`tests/systems/progression.test.ts`). It
walks the arc the two quests push a player down — rat kills for the bones, fish cooked to open the
crab recipe, crab kills and cooks for the feast, bandit kills for an armour set — and asserts it
ends on level 3. Change `xpTable.ts`, a drop chance, a quest objective or the burn rate and this
is the test that moves; retune until it passes rather than eyeballing the curve.

Auto-attack **range comes from the equipped weapon, not the class** (`weaponAttackRange` in
`data/items.ts`): a weapon may name an `attackRange`, anything that doesn't is melee, and empty
hands are shorter still. Abilities carry their own ranges, so a caster's reach is the spell
rather than the class. `Player.applyStats()` has to reassign `attackRange` alongside the other
stats or a weapon swap won't change reach until the view rebuilds.

**The ranger is the third class, and the bow is the one weapon that decides its own stat** (act
three phase 12; `docs/decisions.md` 64, 65, 70-72). Agility is a third stat every class has and
only the ranger grows; `computeEffectiveStats` takes the arrow the next shot nocks, and under a bow
the attack is agility, the bow's bonus and the arrow's `damage`, whoever draws it — so a warrior's
bow is one point of agility and a bad idea by arithmetic rather than by rule. Everything else in the
hand swings with its holder's class stat, as it always did. `isBow` is four rules read off one shape:
two hands, arrows, archery, agility.

**A bow with nothing nocked is a pair of fists.** No arrow in the quiver or the bag, or no quiver
worn, and the attack is the class's own stat at a fist's reach, training fists, with neither the
bow's bonus nor an arrow's on the punch (`weaponSkillFor` answers `unarmed`). The body is told what
it nocks by `WorldContext.publishQuiver`, which every bag change already reaches through
`publishInventory`, so the frame after the last arrow leaves the string the approach closes to a
fist's reach. A shot reads the attack before it draws its arrow — the last one drawn is still a shot
— and spends the arrow whether or not it lands, since it left the string.

**The ranger's four answer the warrior's from range** (`data/abilities.ts`): Aimed Shot (the opener,
and the kit's one cast: a second of standing still is exactly what kiting has to give up), Rapid Fire
(a haste, spending arrows as fast), Field Dressing (Mend's heal without the mana) and Piercing Shot
(the heavy opener), with second ranks at 5-8 on the same rules as everyone's. A `shot` ability needs a
bow with an arrow at the press and spends its arrow when it goes off, so an aim broken by a step never
left the string; the auto-attack keeps shooting through the aim. Like the warrior's, they are paid in
cooldown, since a ranger has no pool.

The duels hold the ranger to the warrior's curve stood still and shooting — beats a level 1 and 2
rat, loses to a 3; the crab and the camp on the same terms — which is the worst version of its fight,
since the bow reaches 200 and everything that chases walks slower than the player. That makes it a
floor rather than the fight a ranger has, and the arrows are what the range is paid for in.
