# Gathering and making

Tools, recipes and stations, the tiers where the loops meet, cooking as a channel, food as the answer to the wait between fights, and the rule that nothing leads nowhere.

_Moved out of `CLAUDE.md` on 2026-09-25 (`docs/decisions.md` 57). The paragraphs are the ones that were there, in the order they were there; `CLAUDE.md` keeps the rules and points here for the reasoning. Where this and the code disagree, the code is right — and this file is what should be corrected._

**A tool does something now, which it never used to.** `gatherSpeedBonus` on an equipment row is the
first thing a tool has ever done beyond permitting the swing: before the steel three there was one of
each and nothing to choose between, so a second tier would have been a reskin with nothing behind it.
It is speed rather than yield, which is the opposite call `MASTERY_TIERS` makes — a pool pays a second
log because the _level_ already sells speed, where a tool is a discrete thing you go and get rather
than a curve laid over the same action. `gatherDurationMs` floors the two terms together at
`MIN_GATHER_FRACTION`, because a capped skill holding a steel tool would otherwise gather instantly,
which is the channel disappearing rather than a reward. **The skills went to 20 with Part G** (decision
131, moved once by G3, decision 139), and the curve was stretched over the new cap rather than left
where it was: at 5% a level the skill alone would have met the floor at 14 and every tool above steel
would have bought nothing, and 3% a level would have paid a second one more often than not, so a level
buys 2.5% and a 1.5% chance of a second, and a capped skill buys what a capped skill bought. The
making curve stayed as it was, because the pace bot cooks on it: a making level past 9 buys the
recipes it opens and nothing else, which from 11 are the tiers'.

**A recipe is one shape for all four making skills** (`CraftingRecipe` in `data/recipes.ts`, run by
`systems/CraftingSystem.ts`). A cooking recipe was already input → output + failure output + level +
xp + duration, so smithing widened it in place rather than putting a second table beside it: the
inputs are a **list**, the failure output is **optional**, and each row names the station it is made
at. Leatherworking arrived third and widened nothing at all, which is what a shape being right looks
like — a `SKILLS` row, a `StationId`, four `RECIPES` rows and no new mechanism anywhere. Fletching
arrived fourth and widened it by one optional field, **`outputQuantity`**, since a log is fifteen
shafts rather than one (`batchSize` reads it, one when absent). A mastery pool that pays doubles the
whole batch, the offline payout counts things made rather than jobs, and the station's panel says
"makes 15" under a row that makes more than one. **What a failure costs is decided by `failureItemId` alone** — naming one spends the inputs and
hands that back, which is what makes levelling cooking worth anything, and leaving it unset spends
nothing at all, which is right for a bar that took a pack-filling trip of ore to carry home.

`RecipeId` is named for what a recipe _makes_. It was keyed by its input while cooking was the only
kind and every recipe took one of one thing; a list of inputs has no single item to key on.
`recipeFromItem` keeps the bag's Cook button working by finding the recipe whose **sole** input is
the tapped item, and anything with a list is asked for by name at its station — a bag cell cannot say
which of three things four bars were meant to become. That is also what decides where a _new_ recipe
can go: the fire's whole list is the bag, so a fire recipe has to take one of one thing, and anything
with a list needs a panel — which every built station has and the campfire does not.

**A station's panel is keyed by the station, not written for one** (`hud/StationModal.ts`). It was
`ForgeModal` while there was one built station in the game, and what that hid is that the title, the
rows and — the dangerous one — **the skill a row's level gate is drawn against** were four separate
places each holding the same answer. A second station is where that stops being one answer: a panel
headed "Forge" listing tanning rows gated on Smithing does not throw, it just quietly lies about what
a row takes. All of it is a lookup now (`STATION_LABELS`, `STATION_SKILLS`, `recipesAt`), and the
claim behind the last one — that every recipe standing at a station shares that station's skill — is
held by `tests/systems/CraftingSystem.test.ts` rather than by the type system, which cannot say it.

**Nothing the game hands out may lead nowhere** (`tests/systems/deadEnds.test.ts`, held over the
tables the way `uniqueLoot.test.ts` is). Three rules rather than one, because a vendor price is
enough for something that _drops_ and nowhere near enough for something a skill produces:
everything a `RESOURCE_NODES` row yields has to be an input to a recipe, every other material needs
a use or a price or a door it opens, and nothing may be _made_ that cannot be worn, eaten or built
with. Burnt food is the exception the first two are shaped around — worth less than either half of
the trade it ruined, and deliberately not rescuable by any recipe, since a burnt fish that could be
turned back into something would stop being a reason to level cooking.

**And the card says where** (`systems/ItemUseSystem.ts`, decision 90). An item's card reads the
same rows the sweep does — recipes, quests, contracts, the outfitter, the reforge stone, keys — and
`tests/systems/ItemUseSystem.test.ts` holds that no card says "Nothing uses it" except a ruined
job's. The two fail differently: the sweep catches an item with nowhere to go, the card's catches
a new kind of sink the derivation was never taught, which would pass the sweep and leave its
item's card calling it junk.

**The plate tier is where the loops meet, and its secondaries are what make that true.** A piece
takes iron bars, a tin bar and bone char, so a finished helmet has both quarry veins, a tree and a
rat behind it. Each of the three is a dead end that was: bone char is rat bones and a log burnt down
together (one intermediate rather than two more names on an armour row nobody would read), and the
tin is what the iron is tinned with — which is also the only thing keeping the **soft** vein worth
swinging at, since mining 5 opens the hard one and would otherwise retire the first.

**The steel tier is the same argument one rung up, and it reaches across three zones.** A piece takes
steel bars, charcoal and a crawler shell, so behind every one of them is the quarry's iron, the Deep
Cut's coal, the hardwood on the road west and the thing living in the way of the seam — which is what
keeps the quarry worth walking to after the Deep Cut opens, since a steel bar is two iron bars as well
as the coal that marries them. The two fuels do different jobs on purpose: coal is what a furnace
melts iron into steel with, and charcoal is what the finished piece is drawn over, hot and clean where
coal is hot and filthy. It is also the first tier with **four** pieces — both offhands in the world
drop off bandits in the starter band, so the slot filled once and then never again, and a top tier
that stopped at three would have left the best set in the game wearing a starter shield.
`tests/systems/deepCut.test.ts` traces every piece back to the zones behind it rather than asserting
the recipe rows, so padding one with a fourth bar and dropping a secondary shows up as the web coming
apart.

**The fenhide tier is that argument pointed at the other half of the roster, and it is the second
production vertical.** Both making skills made a warrior's things or nobody's — the forge turns out
plate, which a wizard may not wear at all, and the fire turns out dinner — so a caster could level
every skill in the game and own nothing they had built. The fen closed the _dropped_ half of that gap
with fenweave; **leatherworking** at Greyford's tannery closes the made half. A hide is cured into
`cured-leather` and three cloth-class pieces are stitched from it, and the two secondaries are again
what make it a place the world meets rather than a second thing to do with a hide: the tin is the
buckles and the bone char is what the leather is dressed with, so a finished piece reaches the fen,
the quarry, a town rat and a tree — four sources, the widest web on anything in the game.

Four things about it were decided against alternatives:

- **Both secondaries come off the forge**, which is why it is at Greyford. The outpost's claim is that
  it trades in what other places produce, and a second vertical owing the first one nothing would be
  two games played beside each other.
- **`cloth` rather than a fourth armour type.** A cured hide is not a robe, but `ArmorTypeId` decides
  _who may wear a thing_ rather than what it is woven from — a lantern and an orb are both cloth —
  and a fourth type holding three rows would be a class restriction wearing a costume.
- **It stops less than the iron plate a smith of the same standing makes, and takes a deeper level.**
  A warrior may wear cloth and always could, so nothing stops one walking this road; what keeps it
  from being their shortcut is that it ends up behind where their own skill already had them.
- **The tanning row takes one of one thing**, because a hide is the whole of a cure. This bullet used
  to say the shape was load-bearing — that `findCraftableFrom` was what let a camp settle to a row —
  and it never was: a camp works any row at a station it can supply (`bestCraftInReach`, and
  `hasInputs` offline), lists included, and `findCraftableFrom` is the fire's alone, where the bag is
  the menu (`docs/decisions.md` 78).

`tests/systems/greyfordTannery.test.ts` traces it the way `deepCut.test.ts` traces steel, and
`tests/world/tannery.test.ts` drives the vat as a place.

**The arrow line is fletching and smithing together, and the ranger's production vertical** (act
three phase 13; `docs/decisions.md` 76-79). Fletching is the wood and smithing the metal (decision
64): shafts are cut at the fletcher's bench, from a log at fletching 1 or from willow at 6; heads are
cut at the forge, from an iron bar at smithing 5 or a steel bar at 8; and the bench puts fifteen of
each together into iron arrows (fletching 2) or steel ones (fletching 8). A crude arrow adds 1 to a
shot, an iron one 2, a steel one 4 — doubling rung to rung, and capped at the chief's bow so the bow
stays the weapon. The tiers are where the loops meet again: an iron arrow is a tree and the quarry's
iron, and a steel one is the millpond's willow, the quarry's iron and the Deep Cut's coal, which
`tests/systems/fletching.test.ts` traces rather than reads back. Four things about it were decided
against alternatives:

- **Willow is the steel arrow's shaft and nothing else.** A willow bow would have been the first
  made weapon in the game, wanting a string it has no material for; where a made bow sits against
  the chief's and the king's is a decision of its own, not a use for a tree.
- **Every row on the line makes fifteen**, which is what makes a quiver's arithmetic work — one
  log and one bar are fifteen arrows. **The halves have no price**: fifteen shafts off a
  three-copper log at even a copper each would be the best trade in the game. The made arrows sell a
  little over the log and bar behind them, so the bench never makes anyone poorer or rich.
- **A camp may put arrows together.** It settles to any row it can supply, which the plan got wrong
  in thinking it could only settle to one of one thing (decision 78).
- **What comes off the bench goes through the quiver** (`CharacterController.addMadeItem`): into a
  dry one first, the rest into the bag, and never refused, since the inputs were spent before it was
  handed over (decision 79).

**Band 9-12's tier is the steel and fenhide argument one band up** (G3, decision 139; the plan's
"The shape" names a tier a band). Coldiron is smelted at the forge from one of Karn Tholl's ores and
one of the Deep Cut's coals, and every coldiron piece is riveted in a steel bar and drawn over
charcoal, so a finished piece reaches the hold, the Deep Cut, the quarry and the road west and
neither of the mines under the hold is retired the day it opens, which is the tin vein's argument
again. Mirehide is the mire lurker's hide cured at Greyford's tannery and stitched with a coldiron
bar for the buckles and charcoal for the blacking, both off the forge, so the vat still hangs off it.
Bog oak is cut into shafts at the bench and a coldiron bar into heads at the forge, and the pike is
cooked at a fire. All of it sits at skill 11-13, where steel's capstone at 10 hands the ladder on. Four
things about it were decided against alternatives:

- **What a piece is worth is the step the duels need, not a step a tier** (the user's). A warrior at
  11 in the four coldiron pieces and the king's blade beats an 11 standing in its chill, beats a 12 by
  stepping out of each one, and loses to a 12 standing in every one; the same warrior in steel sweats
  the 11 and loses the 12 however they move; and a 13 in coldiron still loses to a 14, which is the
  next tier's job. `tests/systems/coldiron.test.ts` holds it against the wight and the raider scaled
  to the band until the band's own creatures land.
- **The leather's capstone shares the plate's top level rather than passing it.** Fenhide took a
  deeper level than iron because there was a level to take; a band's three recipe levels leave no
  fourth, so mirehide stops short of coldiron in armour, carries intellect, and tops out at 13 beside
  it. **Rejected:** the plate stopping at 12, which leaves a smith's 13 opening nothing.
- **The arrow is two over steel, not double it.** The line went 1, 2, 4 and was capped at the chief's
  bow so the bow stays the weapon; three more doublings would put an arrow past every bow in the
  game, so each tier's arrow is set under the best bow there is when it lands, the king's longbow
  until the band's own.
- **The tools are the band's hub's to barter, not the outfitter's** (the user's): Greyford keeps the
  steel loop, and Karn Tholl's gate hall (G7) takes the band's materials for them, so a tier pulls
  the player across its own band. Until then they are rows nothing hands over.

Nothing yields the raw four until the band's zones land; the recipes are what keep them from leading
nowhere, and the sweeps above hold the whole tier that way, so a zone phase adds a node or a drop
and changes no row here.

**Foraging and brewing are the potion line, and the first production vertical that makes no gear**
(version 2 phase E2, decision 129). Foraging is a fourth gathering skill, with a tool of its
own (the sickle, sold beside the other three for the same reason they are ungated) and a ladder of
its own, one herb a band: samphire on the strand at 1, meadowsweet on the mill road's banks at 4, bog
myrtle and bogbean in the fen at 6 and 8, and none in Lampton. A herb patch is walked through like a
fishing spot and cut out in three like a tree. Brewing is a fifth making skill, at a still in
Greyford's yard, one potion a herb at 1, 3, 5 and 7. Four things about it were decided against
alternatives:

- **A still rather than the fire.** A station maps to one skill (`STATION_SKILLS`), so brewing at
  the campfire would have made the fire two skills' station; and the fire's whole menu is the bag,
  where a potion of two herbs needs a panel. Greyford rather than the fen, because the outpost's
  claim is that it trades in what other places produce, and because a level 1 forager with a pack of
  samphire can reach it without walking through a level 7 raider.
- **The upper two potions each take a herb from the rung below** — the tin vein's argument again:
  the strand and the mill road would be retired the day the fen opened if nothing above them wanted
  any. `tests/systems/brewing.test.ts` holds it.
- **A failed brew keeps the herbs** (no `failureItemId`), as a bar does: the herbs were the walk.
- **A potion is a fifth kind of item** (`kind: 'potion'`), not food with a field: it heals nothing,
  so idle's food order must never reach for one, and a new kind is a compile error at every switch
  over `kind`. It sells for a little over its herbs, so the still never makes anyone poor or rich.

**What a potion does is `data/potions.ts`, and its clock is the character's** (`PotionSystem`). One
kind each, and each answers a different half of the game: **Quick Hands** takes a fifth off a gather
on top of the skill's speed and under the same floor; **Dulled Pain** adds five armour, one piece of
the band's gear, held by the duels in `EnemySystem.test.ts` (drunk, it wins none of the contract's
losses) and kept out of the pace bot; **Keeper's Watch** lifts what idle keeps of a kill from a half to
three-quarters, still behind active play (decision 15); and **Fortune** adds a tenth to the chance
of a second one off a gather or a job and makes each drop a quarter likelier, capped at certain. A
second of a kind starts the clock again rather than stacking. The clocks live on `CharacterState`
rather than on the body, where food's does, because they last minutes and work on through a closed
game for the time they have left (`docs/architecture/afk.md`), so they outlive a zone, a reload and
a night away. The skills book's mastery chance is the pool's alone; `secondOneChanceFor` is the roll,
the pool and Fortune together.

**A station is a place, and a built one is `Campfire`'s opposite half**: fixed, always there, and part
of the zone (`ZoneDefinition.stationSpawns`), where a fire is placed by the player and burns out.
There are four of them — the forge in town, and the tannery, the fletcher's bench and the still in
Greyford's yard — and which prop is drawn is keyed off the id in `actors.ts`, the same bargain `creatures.ts` makes about a `shape`: the
world says what stands there and the renderer says what that looks like. Two rules about a station
were got wrong first and are worth not re-learning:

- **It is opened by tapping it, not by standing near it.** Proximity puts a panel in front of anyone
  walking past, which on a map this size is most of the reasons to be near one. A station is picked
  and walked to exactly like a counter; proximity decides only when the panel _closes_, which is the
  rule the channel at it already lived by.
- **It sits below mobs in the pick priority.** That list is a priority rather than a depth sort, so a
  kind above mobs wins from anywhere along the ray — including well behind what is being aimed at. A
  person is small and stands at a map's edge; a forge is a tile of furniture near the middle of town.

**Cooking is a channel too, and it works down the stack** (`beginCook`/`advanceCook` in
`systems/CookingSystem.ts`, run by `GatherSession` beside the gather it is built as the twin of). A
fish takes the recipe's `cookMs` over the fire, which is what makes a burn worth avoiding rather
than merely worth noticing — before it, the roll happened at the press and the standing still cost
nothing. What cancels it is losing the fire: walking off one, or letting it burn out under you,
which is the same shape as a gather's range check and is why shuffling around the flames is free.
It re-arms itself on whatever is left in the bag the way the gather channel does, because a stack of
twenty fish is one decision and not twenty. The duration is flat rather than shaved down by the
cooking level the way `gatherDurationMs` is: that level already buys the burn chance down, and
selling it speed as well would make the last levels worth about double the first.

**Food is the answer to the wait between fights** (version 2 phase C10, decision 122). Regen waits
five seconds out of a fight and then returns 2% a second, and before C10 that wait was half to
three-quarters of a session. The user kept it and made food the way past it: **a meal heals about
half of what a body at its band holds, over six seconds** — cooked rat 20, fish 30, crab 40, eel 70 —
where the same foods healed 10 to 45 over ten and barely beat standing still. It is still out of a
fight only, since `markInCombat` drops it, so a meal is eaten between pulls rather than in one.
**A new character starts with sixteen cooked rats** (`STARTING_FOOD`, the Part C review, decision
124), put in the bag by `createStartingCharacter` on the creation screen, where an empty bag spent
most of the first level standing still; `createNewCharacter` still starts empty, for every fixture.
**Every band feeds itself or says where its food comes from**: rats and crabs drop meat raw for a
fire, every humanoid carries a ration (bandits and goblin scavengers cooked fish, goblin miners cooked
rat, raiders raw eel), the fen's lurkers give up the eel they were eating, and the barrow and the
crawlers feed nobody, so a player carries the shelf's ration in, and more of it into the barrow. One log lights a fire anywhere, so
what drops raw is cooked where it dropped. `tests/world/pace.test.ts` holds it: once there is food to
carry, a level spends under a fifth of its time resting, and its rations cost under a third of the
coin it picks up.
