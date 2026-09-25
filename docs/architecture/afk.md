# Camping and offline progress

Why unattended play stays behind active play, what a camp does, and what a parked session pays.

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
one — the third of those cost the AFK code nothing at all, which is the derivation paying off the
same way mining did. **A station beats a
tool** — you walked to the forge where the pickaxe is merely what you are holding — and the two
cannot deadlock, because a craft eats out of the bag and the bag runs dry, at which point the
gatherer that filled it takes over again. The camp never lights a fire: a log is not the camp's to
spend, and 90 seconds of `FIRE_BURN_MS` is already long enough to cook out a pack of fish and short
enough that it goes back to what it was doing rather than feeding a fire all night. A making camp is
also the one job a full pack is _no_ warning about, since it spends what it carries to make what it
makes.

**A full pack never stops an unattended session; it only stops it keeping anything.** The camp keeps
fighting or working and keeps earning, and everything it cannot pocket is counted into
`OfflineAfkReport.missed` and itemised on the away report — "60 kills, 75 XP / Could not carry: Rat
Bones x33, Rat Meat x26" rather than a bare "your pack filled up", which tells a player nothing
about what a night cost them. Settling in with a pack that is already full is allowed and warned
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
awake camp runs: the station first, then the tool, then the fight. It is also the only branch that
**spends** anything, so `OfflineAfkReport.consumed` runs the opposite way from `drops` and
`resolveParked` has to take it back off the character — a payout that only did the second half would
mint bars out of ore that was never used.
