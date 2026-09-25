# Gathering and making

Tools, recipes and stations, the tiers where the loops meet, cooking as a channel, and the rule that nothing leads nowhere.

_Moved out of `CLAUDE.md` on 2026-09-25 (`docs/decisions.md` 57). The paragraphs are the ones that were there, in the order they were there; `CLAUDE.md` keeps the rules and points here for the reasoning. Where this and the code disagree, the code is right — and this file is what should be corrected._

**A tool does something now, which it never used to.** `gatherSpeedBonus` on an equipment row is the
first thing a tool has ever done beyond permitting the swing: before the steel three there was one of
each and nothing to choose between, so a second tier would have been a reskin with nothing behind it.
It is speed rather than yield, which is the opposite call `MASTERY_TIERS` makes — a pool pays a second
log because the _level_ already sells speed, where a tool is a discrete thing you go and get rather
than a curve laid over the same action. `gatherDurationMs` floors the two terms together at
`MIN_GATHER_FRACTION`, because a capped skill holding a steel tool would otherwise gather instantly,
which is the channel disappearing rather than a reward.

**A recipe is one shape for all three making skills** (`CraftingRecipe` in `data/recipes.ts`, run by
`systems/CraftingSystem.ts`). A cooking recipe was already input → output + failure output + level +
xp + duration, so smithing widened it in place rather than putting a second table beside it: the
inputs are a **list**, the failure output is **optional**, and each row names the station it is made
at. Leatherworking arrived third and widened nothing at all, which is what a shape being right looks
like — a `SKILLS` row, a `StationId`, four `RECIPES` rows and no new mechanism anywhere. **What a failure costs is decided by `failureItemId` alone** — naming one spends the inputs and
hands that back, which is what makes levelling cooking worth anything, and leaving it unset spends
nothing at all, which is right for a bar that took a pack-filling trip of ore to carry home.

`RecipeId` is named for what a recipe _makes_. It was keyed by its input while cooking was the only
kind and every recipe took one of one thing; a list of inputs has no single item to key on.
`recipeFromItem` keeps the bag's Cook button working by finding the recipe whose **sole** input is
the tapped item, and anything with a list is asked for by name at its station — a bag cell cannot say
which of three things four bars were meant to become. That is also what decides where a _new_ recipe
can go: the fire's whole list is the bag, so a fire recipe has to take one of one thing, and anything
with a list needs a panel — which the forge and the tannery have and the campfire does not.

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
- **The tanning row takes one of one thing**, which is load-bearing rather than tidy: that shape is
  what `findCraftableFrom` looks for, so it is what makes tanning a job an unattended camp can settle
  to. A two-input tanning row would have left the tannery a station nobody could ever camp — and
  `STATION_PERSISTS` saying something about it that nothing read.

`tests/systems/greyfordTannery.test.ts` traces it the way `deepCut.test.ts` traces steel, and
`tests/world/tannery.test.ts` drives the vat as a place.

**A station is a place, and a built one is `Campfire`'s opposite half**: fixed, always there, and part
of the zone (`ZoneDefinition.stationSpawns`), where a fire is placed by the player and burns out.
There are two of them — the forge in town and the tannery in Greyford's yard — and which prop is
drawn is keyed off the id in `actors.ts`, the same bargain `creatures.ts` makes about a `shape`: the
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
