# Idle and offline progress

Why unattended play stays behind active play, what idle does, what a parked session pays, and how
the idle panel says so before it starts.

**The player calls it Idle; the code mostly calls it camping** (decision 85). `AfkCamp`,
`afkCampJob`, `AfkSession` and the rest kept the names they were written with, and "a camp" below
means idle running. What was written after the rename says idle: `IdlePlanSystem`, `IdleFoodSystem`,
`CharacterState.idleFood`, the idle panel. Every string a player reads says Idle.

_Moved out of `CLAUDE.md` on 2026-09-25 (`docs/decisions.md` 57). The paragraphs are the ones that were there, in the order they were there; `CLAUDE.md` keeps the rules and points here for the reasoning. Where this and the code disagree, the code is right — and this file is what should be corrected._

**AFK play must stay behind active play** (`systems/AfkSystem.ts`, `systems/OfflineAfkSystem.ts`).
Two mechanisms hold that, and both matter: the AFK loop never uses an ability, so the action bar
is an advantage only a real player gets, and `awardXp` halves what it earns. Offline progress
accrues only from a session parked with the toggle, and is capped at **half a level per session** —
a per-kill rate alone is not safe, since eight hours in the richest zone out-earned the whole
level curve several times over. It is a share of a level rather than a level because a level is a
share of the game and the cap moved under it: on a quadratic curve the last level is the biggest
share of all, a quarter of the old ten-level total and very nearly half of the five-level one, so
halving the ceiling left a session worth what it had always been worth. Move it with the curve
again if you add a zone or raise the cap.
The camp penalty is for XP a character earns unattended, so a quest reward goes through
`ZoneWorld.publishXpGain` rather than `awardXp` — handing a quest in is something the player did.
Kills are the exception to the penalty: an offline session credits its full count to the slayer
chains, since a kill either happened or it didn't. It grinds a single spawn, which is what makes
one `enemyId` on the report enough to credit them all.

**What a camp does is read off the tool and the station, not out of a mode** (`afkCampJob`). A
gathering tool _is_ the weapon slot, so a fishing pole, a felling axe or a pickaxe makes the Camp tab
a gathering camp and a
sword, a wand or an empty hand makes it the fighting one — the same question `canGather` already
asks, which is why this needed nothing stored and no second button. Mining is what
collected on that: a whole third skill, awake and offline, cost the AFK code not one line. It
re-derives
every frame, so a gear swap changes what the camp is doing. A gathering camp works the nearest
ready node of that skill inside the anchor radius and moves to the next when one is chopped out
(`chooseAfkNode`, whose `wait` and `none` are deliberately different answers: waiting is what a
camp does between respawns, `none` means the tool has no work in this zone and the caller falls
back to fighting). Anything already chasing is answered first whichever camp it is — being hit
breaks the channel, so a woodcutter that ignored it would re-arm a gather it could never finish
until it died.

**The station underfoot is the second half of that derivation, and it is where the rule bends.**
Cooking has no tool at all, so the skill with the deepest active loop was the one skill nobody could
camp, and smithing inherited the same hole the day the forge landed. What makes the bend principled
rather than drift is that **a station is a tool you cannot carry**: nothing is stored and nothing is
chosen twice, the derivation simply reads two inputs instead of one. Standing at a fire holding raw
fish is a cooking camp; at a forge holding ore, a smithing one; at the vat holding hides, a tanning
one; at the bench holding logs, or shafts and heads, a fletching one — the last two cost the AFK
code nothing at all, which is the derivation paying off the same way mining did. **Any row a camp
can supply is a job**, a list of inputs as readily as one of one thing: the camp asks `canCraft` of
every row at a station in reach and takes the best-paying (`bestCraftInReach`), and the offline
payout asks `hasInputs`. The act three plan assumed otherwise and it was never so (`docs/decisions.md`
78). **A station beats a
tool** — you walked to the forge where the pickaxe is merely what you are holding — and the two
cannot deadlock, because a craft eats out of the bag and the bag runs dry, at which point the
gatherer that filled it takes over again. The camp never lights a fire: a log is not the camp's to
spend, and 90 seconds of `FIRE_BURN_MS` is already long enough to cook out a pack of fish and short
enough that it goes back to what it was doing rather than feeding a fire all night. A making camp is
also the one job a full pack is _no_ warning about, since it spends what it carries to make what it
makes.

**A full pack never stops an unattended session; it only stops it keeping anything.** The camp keeps
fighting or working and keeps earning, and — awake or offline — **it leaves no loot pile**, since a
pile is something to come back for and nobody is there to (`docs/decisions.md` 62). Offline,
everything it cannot pocket is counted into `OfflineAfkReport.missed` and itemised on the away
report — "60 kills, 75 XP / Could not carry: Rat Bones x33, Rat Meat x26" rather than a bare "your
pack filled up", which tells a player nothing about what a night cost them. Settling in with a pack that is already full is allowed and warned
about at the toggle, since the XP is worth having on its own but nobody means to do it; that warning
is latched (`packFull`) so it is said once rather than every frame for as long as the camp runs.

**Gathering is the one thing the camp is _not_ penalised for while the tab is open**, and that is
deliberate rather than an oversight: an attended player gathers by tapping a node and watching it
auto-repeat, which is the same standing still, so there is no advantage being simulated away to
charge for — and a camp that paid half would be strictly worse than the tap it replaces. Offline is
where the penalty lives, and it is the same stack a fight gets plus a cap of **one skill level per
session**, which is what makes it safe for `resolveOfflineGather` to model neither a tree's four
charges, nor its fifteen-second regrow, nor the walk to the next one. A node's `requiredLevel` is
honoured offline too — parking overnight is not a way past a gate.

**Offline crafting works at permanent stations only** (`STATION_PERSISTS`, `resolveOfflineCraft`).
A forge is a fact about the zone and is still standing in the morning; a campfire is a fact about the
player and went out ninety seconds after the tab closed, so a session paid for one would be paying
for eight hours at a fire nobody was tending. That is the one thing a parked session cannot re-derive
— a zone says what a camp was fighting or gathering, but a forge is one tile of a town — so
`AfkSession.station` records the station the camp _settled to work at_ and nothing else, which is the
awake loop's own precedence decided once at the toggle. The offline branch takes the same order the
awake camp runs: the station first, then the tool, then the fight. It counts `crafts` in things
made rather than jobs, since a job at the bench is fifteen shafts. It is also the only branch that
**spends** anything, so `OfflineAfkReport.consumed` runs the opposite way from `drops` and
`resolveParked` has to take it back off the character — a payout that only did the second half would
mint bars out of ore that was never used.

**A bow spends arrows, awake or not** (act three phase 12; `docs/decisions.md` 74). The awake camp
needs nothing of its own: it swings through `CombatDirector` like anyone, so it spends an arrow a
shot and fights with its fists the frame they run out, which a camp's pull may not survive. Offline
there is no fight to model — a kill a minute whatever is in hand — so `resolveOfflineAfk` charges
each kill the shots it takes at the attack the first nocked arrow gives, counts arrows off each body
as arrows for the next, and **stops the night** when there are not enough for a kill rather than
paying punches as though they were shots. `arrowsSpent` runs the way `consumed` does, and
`resolveParked` takes them off the quiver and then the bag after the drops are in; a bow parked with
nothing to shoot earns nothing, and the away report says so in the warning colour.

**The idle panel says what idle will do before it starts** (decision 96, `hud/IdleSheet.ts` drawing
`systems/IdlePlanSystem.ts`). The Idle tab opens it rather than starting anything; its own button
starts idle and puts the panel away, and while idle runs the lit tab opens the same panel with Stop.
It says the job, what that pays against doing it by hand, the food in the order it will be eaten,
the arrows a bow will spend, and what a closed game pays and at most. **None of it is written per
job**: the awake half is read off `afkCampJob` and the zone's node table (a tool with nothing to
work here is `chooseAfkNode`'s `none`, and fights), and the closed half off **`offlineJob`, the
function `resolveOfflineAfk` itself branches on**, with the ceilings and rates read off the same
constants the payout multiplies by. That is what stops the panel promising a night the payout will
not pay, and why `IdlePlanSystem.test.ts` sweeps every zone for the creature the panel names being
the one the payout credits. It says outright where the two halves differ, which the old toggle never
did: a campfire goes out, so a closed game pays for the gear instead; a tool with no work in the
zone fights with the game open and earns nothing with it closed; a bow with nothing to shoot punches
awake and earns nothing away. The panel is derived in the HUD from what its model already held — the
zone is the one thing it had to be seeded with, from the save, since the world says which zone only
on its first frame — so it needed no publisher of its own.

**What idle eats is the player's to set** (decision 96, `systems/IdleFoodSystem.ts`): an order, and
food marked Keep that idle never eats. It is the one idle setting stored (`CharacterState.idleFood`),
because a choice leaves nothing behind to derive it from, and it starts empty, which is the old rule
exactly: weakest first, everything fair game. A move swaps a food with its neighbour **in the bag**,
which is all the panel lists, and the first move writes down every food in the game, so a food not
in the bag keeps its place for when it is again and a food the game adds later goes last, where it
is kept longest. With nothing it may eat, idle rests instead, and the panel says so. A closed game
eats nothing either way — it has no fight to be hurt in — and the panel says that too.

**The away report speaks the panel's words.** It names the creature a night fought, says "the most
that counts" when the eight hours ran out, and says "Stopped at the most a night pays" with the
ceiling the panel named — half a level, or one level of the skill — when that is what ended it.
`OfflineAfkReport.capped` is how it knows: set when the ceiling rather than the time, the bag or the
arrows ended the night.
