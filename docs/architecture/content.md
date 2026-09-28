# Content and progression

What the data tables hold and the rules over them: loot, quests and objectives, bounties, the stored tallies, and mastery.

_Moved out of `CLAUDE.md` on 2026-09-25 (`docs/decisions.md` 57). The paragraphs are the ones that were there, in the order they were there; `CLAUDE.md` keeps the rules and points here for the reasoning. Where this and the code disagree, the code is right — and this file is what should be corrected._

**Data-driven definitions** (`src/data/`): class stats (`classes.ts`), items/gear (`items.ts`),
enemy definitions (`enemies.ts`), where and at what level they spawn (`spawns.ts`), loot
(`lootTables.ts`), quests (`quests.ts`), the XP curve (`xpTable.ts`), zones (`zones.ts`), and the
tilemap layouts (`tiles.ts`, `townMap.ts`) are plain data tables keyed by id. `types/ids.ts` holds
the id unions (`ClassId`, `GearSlotId`, `EnemyId`, `ZoneId`, `QuestId`, `AchievementId`,
`TitleId`) that key into them. Prefer
adding a row to one of these tables over hardcoding values in a scene/entity — a new enemy type
should be an `ENEMIES` row plus a loot table, not a new `Mob` subclass with numbers baked in.

**Only humanoids drop gear and coin.** `EnemyDefinition.family` is `beast | humanoid`, and it is
what decides what a loot table may hold — the rule is enforced over `ENEMIES` and `LOOT_TABLES` by
a test rather than by construction, since the tables are hand-written. It is also the thing that
makes same-level zones worth visiting: rats give quest parts, crabs give food, bandits give
gear and coin. The bandit table carries **both** armor types on purpose: the shop sells tools
only, so that table plus the two class-keyed quest rewards is the whole of anyone's armor supply.
It also carries the hideout key at 3%, which is the rarest thing on any table by a distance and is
meant to be a run of bandits rather than an errand. The chief's table is the other end of the same
idea: the trophy always drops because a fight that long has to be worth something every time, and
it is cloth so it fits every class, while the weapons behind it are the chase — one per class, a
bow among them since act three phase 12, so the run is worth making whoever you rolled.

**Every humanoid that is not a boss carries a handful of arrows** (`arrows()` in
`data/lootTables.ts`; `docs/decisions.md` 64, 75), at even odds and more of them the higher the band,
since so is what a creature there takes to kill. A table entry may name a `quantity` range for this,
and only an entry with one rolls again for how many, so every other table throws the dice it always
did. It is held over `ENEMIES` rather than trusted to the tables — a new humanoid row is exactly the
thing that would forget — and a beast carries none, for the reason it carries no coin. A boss is free
either way (decision 70): what it drops is its own, which `uniqueLoot.test.ts` already holds, and the
two that exist drop a bow rather than arrows.

**The goblin table is the step above that, and the hole it shipped with is closed now.** It pays
roughly double a bandit's coin — which is most of why anyone walks out west, since three armour rows
drop long before the purse stops being a reason to come back — and it carries the **studded** tier,
sitting between the brown leather the camp drops and the plate a forge makes. It is leather
throughout, so it is a warrior's upgrade and a wizard's payday only, and for one zone that meant a
caster walked the road west for coin alone with the bandit table still the whole of how they were
dressed. `docs/archive/zones_act_two.md` had assigned cloth to the fen, so the gap was a deliberate
consequence rather than an oversight, and `tests/systems/oldMillRoad.test.ts` asserted the armour type
so that closing it would be a decision somebody came back and made rather than a thing that drifted.
The fen is that decision: **fenweave** is the cloth line above brown, it drops off fen raiders and
nothing else, and `tests/systems/blackwaterFen.test.ts` holds it as the best cloth any repeatable kill
carries — which is the same guard pointed the other way. The one rule the table cannot bend is
the humanoid one: `EnemySystem.test.ts` requires **every** humanoid to carry both currency and at
least one piece of equipment, so a new person-shaped creature with an empty table fails the build.

**The mill road shipped with no resource nodes, and its hardwood arriving later is what that rule
looks like paid off.** `deadEnds.test.ts` would have failed a hardwood row on the day the zone
landed — the brainstorm asked for one at woodcutting 6, but hardwood exists to be burnt into the
charcoal the steel tier is worked over, and a gathering skill yielding something no recipe consumes
is the strictest of the three dead-end rules. So it waited for the Deep Cut, which is the zone that
gives it a use, and arrived as a `nodeSpawns` list on a `ZONES` row that already existed. Willow was
the same call, and it landed with fletching (act three phase 13): three willows on the millpond's
bank at woodcutting 8, held out of the far knot's reach, whose only use is the shafts the steel arrow
is fletched on (`docs/decisions.md` 76). The made arrows are on no loot table, no shelf and no
reward — the bench is the only way to them, which `tests/systems/fletching.test.ts` holds.

**What the Deep Cut's own table pays is coin, a tool and a weapon, and deliberately no ore at all.**
The zone's whole claim is that everything worth having down there is behind the pick rather than
behind a door, so a goblin miner dropping coal would be the way round the only gate it has — and iron
ore is no better, since the plate tier is traceable to both veins and a rat precisely because nothing
else in the game hands out either rock. The **goblin maul** on it is the first weapon upgrade in the
game that comes off something repeatable; everything above a brown axe until then was one boss behind
a 3% key.

**Quest progress is derived, not tracked** (`systems/QuestSystem.ts`). `CharacterState.quests` holds
a status per quest and one number beside it; how far along an objective is gets counted on read.
A `collect` objective counts the bag, and items reach it from loot, gathering, cooking, buying and
offline camping — counting on read means none of those paths can forget to bump a counter. The
marker over a quest giver's head (`npcMarker`) is derived the same way, which is **why the view
polls it**: what moves that glyph is an item landing in the bag, and nothing publishes that.
`NpcActor.sync()` reads it off `character.state` each frame like `MobActor` reads the con colours,
and the sprite is tagged `userData.kind = 'marker'` rather than `'label'` — smoke asserts one label
per drawn creature in every zone, so a second label over a head would break that everywhere. The
board's marker (`bountyMarker`) is the same three glyphs off the same ranking, because it answers the
same question — is walking over there worth it — and a player reading one glyph should not have to
learn a second alphabet for the person standing forty feet from the first. `strongerMarker` is what
picks between them: nobody both gives quests and posts contracts today, so every call has one answer
and one `null`, which is exactly when the rule is worth writing down rather than left to whichever
was asked first.
`turnInQuest` on `CharacterController` refuses as a whole rather than half-applying — taking the
objective and finding no room for the reward is the one outcome that can't be undone.

**A giver's quests are drawn in the conversation with them, not by any counter**
(`hud/talkQuests.ts`, drawn by `hud/TalkModal.ts`; `docs/decisions.md` 69 and 92). They were a
section of the shop's panel while the shopkeeper was the only giver, then something `OverlayHost`
put at the top of every counter once a second giver stood behind a different one — which is why a
counter opening names who is behind it as well as which counter it is (`COUNTER_OPENED_EVENT`
carries both). Version 2's phase A4 made a tap on a person talk first, and the talk panel is the
one panel every person has, so the work moved there and off the counters: anybody who gives quests
shows them when talked to, and no panel can be the one that forgot to. The world side needed
nothing either time: `QuestDesk` asks whether the person the player is standing at — talking to,
or served by — is the quest's giver. The inspect card's quest count moved the same way, onto
anybody's card who gives one.

**An objective is a tagged union, and what splits the three is what each one _counts_**
(`QuestObjective` in `data/quests.ts`). `collect` counts the bag, which goes down as well as up and
is handed over at the counter; `kill` and `visit` count lifetime tallies that only ever climb and
have already been paid by the time they are reported — so a turn-in takes items from the first and
nothing at all from the other two. That is also the whole reason a quest entry stores a **baseline**:
read straight off `CharacterState.kills`, "kill 12 bandits" is already finished for anyone who has
been playing and hands itself in the moment it is taken. Remembering where the tally stood at the
accept keeps `have` derived (`tally − baseline`) rather than counting a second copy of a number the
game already has, and it means nothing for a `collect` — which is why the same field is left at
zero there, and why a quest taken with the goods already in the pack is complete on the spot.

**A visit counts arrivals rather than remembering places**, and that is what makes it the kill rule
with a different tally behind it instead of a third mechanism. A visited _set_ would need its own
"since when" question and could never be re-satisfied by someone who had already been; a count minus
a baseline says "go there" once, to a veteran and a newcomer alike. The tally is credited in
`ZoneWorld`'s constructor, because **a world built for a zone _is_ an arrival in it** — the walk and
the session resumed both end there, so every route in counts by construction and a third would too. It is deliberately not `recordLocation`, which is called on every save and says where the
character is rather than that they have just got there. The HUD holds all three counters and redraws
the tracker and the sheet off them together, which is why the two tallies ride events of their own
(`kills-changed`, `visits-changed`): neither is in the bag it already has, and either can move a
quest without the quest log changing at all.

**Standing work is a bounty, and a bounty is a quest objective narrowed**
(`data/bounties.ts`, ruled on by `systems/BountySystem.ts`, run by `world/BountySession.ts` at the
quartermaster). `BountyObjective` is `Extract<QuestObjective, { kind: 'kill' | 'collect' }>` rather
than a union of its own, and the narrowing **is** the rule: a `visit` is finished by walking
somewhere, and something repeatable that is finished by walking somewhere is a currency faucet with
no work in it. Reusing the union is what let the counting be written once — `objectiveProgress` came
out of `questProgress` and both call it — so the baseline that stops "kill 15 rats" handing itself in
to a veteran is one rule over two surfaces.

**One contract is held at a time**, which is why `CharacterState.bounty` is a nullable field rather
than a log: five contracts taken together are five finished together by one afternoon of rats, which
is one decision paid five times. That is what makes giving one back a real button rather than a
courtesy — the board posts a level 4 ask, and without it anyone who took one they cannot finish is
stranded. `BountyOfferState` carries `busy` for what the rule costs every other row, since a row that
cannot be taken and does not say why reads as a bug. Nothing about a contract _finished_ is stored:
it is posted again the moment it is paid, which is the whole of what repeatable means here.

**The board says so, and giving one back stands apart from handing it in** (version 2 phase
A3, `docs/decisions.md` 91). The rule is one line at the top of the board rather than a line per
row, and every contract wears a Repeatable tag on the board and in the quest log, which is where a
quest that does not come back stands beside it. Abandon was a small button against the row that
hands the work in; it is a button of its own under the contract in hand now, and the first press
only arms it (`BountyModal.armedFor`). That is the HUD's alone — the world's `abandon` is unchanged
— and it survives the redraw every kill makes, since a count landing between the two presses is not
the player changing their mind.

**The board reaches the upper band** with four more contracts (act three phase 11): a goblin cull
and a fen patrol on the two zones above the starter band that need no key, and a coal order and a
steel order on what the Deep Cut is for. Nothing is posted behind a locked door — standing work
behind a 3% key is a contract most players would take and have to give back — and
`BountySystem.test.ts` holds that the board keeps posting work within two levels of the cap.

**What the board pays is held by three rules, and the third is the one nothing else in the game
needed** (`tests/systems/BountySystem.test.ts`). A kill contract pays less XP than the kills it names
already pay, so it is a bonus on a grind rather than a reason to make a different one. A gather
contract pays more than vendoring the same haul, or nobody would ever walk past the shopkeeper to
hand it in. And it pays **less per item than the shop charges for the same thing** — the shelf sells
logs, so a timber order above the shelf price is coin minted by walking between two people standing
forty feet apart. It is the same vendor spread `SHOP_STOCK` was already built around, pointed the
other way. Its XP goes through `ZoneWorld.publishXpGain` rather than `awardXp`, like a quest reward:
a camp can _finish_ a kill contract unattended, but it cannot walk to town and hand one in.

**The upper band has a chain of its own, given at Greyford** (act three phase 11,
`docs/decisions.md` 68). It is the starter arc's shape a band up — a chain that ends on a named
thing behind a rare key, and one errand off it — split across the two people who stand in the
outpost's yard, so the chain crosses from one counter to the other: the outfitter's goblins on the
mill road and hides off the fen's lurkers, then the fettler's raiders and the barrow king, with coal
out of the Deep Cut as the outfitter's errand. The errand is off the chain rather than a link of it
because coal is behind mining 6, and a link behind a gathering level would hold the fen and the
barrow back from anybody who never picked up a pick. **The link that pays gear is the hide
collect, not the goblin kill before it**, because of a rule that was already held
(`CharacterController.test.ts`): a quest's reward may weigh no more than what it takes in, and a kill
takes in nothing — which at Greyford, with no shop to sell to and no bank to put anything in,
would be a full pack stranding a turn-in a zone's walk from anywhere to make room.
`tests/systems/progression.test.ts` simulates the chain: each kill objective rides one level of its
zone's grind, each reward is a tenth to a third of the level it is met at, the lot together is
under a quarter of the climb to the cap, and the chain alone leaves a character two levels short
of the king.

**A quest may be held back by another** (`QuestDefinition.requires`), the shape
`ShopStockEntry.requires` and `ZoneDefinition.requiresKey` already use: the table reads as a list of
what is _withheld_ rather than of what is open, and finishing is what opens the next link — accepting
the one before is not enough. `QuestOfferState` gains `locked` beside the four it had, and a locked
row is **drawn** at the counter carrying the quest it waits on where its progress would sit. Same
call as a gated shelf row and a shut zone's cell, for the same reason: what is not offered yet is the
reason to come back. The one place `locked` is not treated as an offer is the marker over the giver's
head, which would otherwise send a player across town to a counter with nothing to say.

**Kills are no longer the only counter that is stored** (`systems/AchievementSystem.ts`,
`ZoneVisits` in `systems/QuestSystem.ts`). Everything else derives its progress from state that
already exists — a quest counts the bag — but a corpse leaves nothing behind, so
`CharacterState.kills` holds a real per-creature tally, and a zone walked out of again leaves nothing
either, so `CharacterState.visits` holds a per-zone one. What comes _off_ both still derives: which
achievements are unlocked, which titles are earned and how far along a quest is are computed on read,
and only the player's choice of worn title is stored alongside. Keep that split when adding to it.

Because the count is stored, every path that kills something has to credit it — which is why
`ZoneWorld.resolveKill` exists as the single funnel for the auto-attack and ability paths, and why
offline camping widens `OfflineAfkReport` with the creature it was parked on. Add a new reward for
a kill there, not at a call site. Achievement ids are a template literal over `EnemyId` and
`SlayerTier` and the rows are generated from `ENEMIES`, so a new enemy gets its whole 25/50/100
chain by construction; a test still asserts the grid is complete.

**Every rank pays a title** (Culler, Hunter, Slayer; decision 89), so a player wears the rank they
like rather than only the last one reached. The top rank's `TitleId` is the one it was when only the
top rank paid a title (`rat-slayer`), which is why a save already wearing one loads with no
migration. With nothing worn, a kill that crosses a rank puts on the **best** rank it crossed, not the
first: an offline payout can clear two ranks at once, and the lower one is not what was just earned.

**Mastery is the third stored counter, and it is stored for the reason the other two are**
(`data/mastery.ts`, `systems/MasterySystem.ts`): a chopped tree leaves nothing in the bag to count
it off. `CharacterState.mastery` holds XP per _target_ — one flat `Partial<Record<MasteryTargetId,
number>>` over both halves of `ResourceNodeId | RecipeId` — and everything that comes off it derives
on read: which of the five rungs a pool stands on, what that rung pays, how far the next one is. The
two id sets have to stay **disjoint** for one record to be safe, which is what
`tests/systems/MasterySystem.test.ts` holds rather than the type system: a recipe named for a node
would silently share its pool.

Four things about it were decided against alternatives and are worth not re-litigating:

- **A target is taught by the same XP the action pays its skill**, which is why there is no second
  rate table beside every node and recipe row — and it is what carries the AFK and offline penalties
  across for free, since a camp earning half the skill XP has learned half as much about the tree.
- **The first rung pays nothing**, which is what made this safe to add to a tuned game. Every pool
  starts empty, so the duels, the starter arc in `progression.test.ts` and the vendor spreads all
  run at Novice and are untouched; what mastery changes is what happens after those simulations end.
- **The payout is a chance at a second one off the same action**, not speed. `gatherDurationMs`
  already sells gathering speed by the level and `beginCraft` deliberately refuses to sell making
  speed at all, so speed would be either bought twice or bought against a written rule. The gather's
  two bonus terms are **added into one roll** rather than rolled separately, because rolling twice
  would make a third log possible exactly where both curves pay out.
- **Only a success feeds a pool, and a failure is never doubled.** A botched bar teaches nothing
  about the bar, and a pool that doubled a burnt fish would be a curve that pays worse the further
  along it you are.

The thresholds are in XP rather than in actions, which is what makes a rung cost the same _work_
whatever is being mastered — an iron chestplate is eight trees of work and reaches Expert in an
eighth of the actions. Master sits just under the XP it takes to cap a gathering skill outright, so
a pool is the thing still climbing once the skill behind it has stopped; `MASTERY_TARGETS` is
generated from `RESOURCE_NODES` and `RECIPES` the way `ACHIEVEMENTS` is generated from `ENEMIES`, so
a node or recipe added later gets its pool by construction. The skills book draws each pool beside
the node or recipe it belongs to, on that skill's page (`hud/SkillsSheet.ts`, decision 93), which is
the only comparison a player makes — which tree to chop, never a tree against a bar. It had a page
of its own until the book (decision 89).
