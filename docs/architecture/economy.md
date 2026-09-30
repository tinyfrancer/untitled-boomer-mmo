# Counters, coin and the pack

Greyford's barter and the fettler, the shop's shelf, selling, the bank, NPC roles and where counters stand, and what happens when the pack is full.

_Moved out of `CLAUDE.md` on 2026-09-25 (`docs/decisions.md` 57). The paragraphs are the ones that were there, in the order they were there; `CLAUDE.md` keeps the rules and points here for the reasoning. Where this and the code disagree, the code is right — and this file is what should be corrected._

**Town trades in coin and Greyford trades in stuff**, which is the whole of why the outpost is not
town in a different colour — the thing `docs/archive/zones_act_two.md` warned it would be. All four
counters at home deal in currency: the shop sells, the bank stores, the trainer charges, the board
pays. The
`outfitter` role (`data/outfitter.ts`, ruled on by `systems/OutfitterSystem.ts`, run by
`world/OutfitterSession.ts`) takes ore, coal and hardwood and hands back the steel tools, and there
is no price in copper anywhere on it. Every offer wants something from each of the three zones around
the outpost, so a tool is a circuit of the loop rather than a thing bought on the way past — and it
is worth more than the materials it swallows, which is the shop's vendor spread pointed at a barter.

**Reforging is where the endgame's coin goes, and it is paid at one end of the loop and spent at the
other** (`data/reforges.ts`, ruled on by `systems/ReforgeSystem.ts`, run by `world/ReforgeSession.ts`
at the fettler). Copper had two sinks — the death fee and the bank's shelves — and the vault _caps_,
so past the last slot bought a purse had nowhere left to go while a barrow king was paying three
hundred. The **reforging stone** is what it goes on now: sold in town, spent at Greyford. That split
is the whole trick — the outpost's claim is that nothing out there wants money, so the shop takes the
copper and the counter takes the stone, and what it costs the player is the walk every offer on the
outfitter's board already asks for.

Five things about it were decided against alternatives:

- **A reforge moves power and never adds it.** Every duel in `EnemySystem.test.ts` is measured
  against gear as the table wrote it, and a reforge that could raise a piece's total would put every
  one of those fights out of date without failing any of them. `STAT_WEIGHTS` is what makes that
  checkable rather than promised: each row is weighed in both directions, and every piece in the game
  is put through every reforge it can take and has to come out weighing what it went in weighing.
- **It is keyed by item id, not by an instance**, because there are no instances — an inventory is a
  count per id, and there is no such thing as _this particular_ chestplate. So a reforge is a fact
  about your steel chestplates, which reads as a compromise and behaves as the right answer: it
  survives being unequipped, banked and withdrawn with nothing tracking it, where one keyed by gear
  slot would jump onto whatever was equipped next.
- **One roll, and permanent.** Livable only because of the first rule: there is no outcome that
  leaves a piece worse than it was, only a direction somebody would not have picked. Permanence with
  an upgrade on the table is the version where a bad roll on a 20% drop costs an evening.
- **The fuel is a second piece for the same slot**, which is one sentence rather than a table of what
  may be melted into what — and it does both of the jobs this exists for at once: the crown that
  drops every time and was pure vendor fodder, and the brown set nobody has worn since the camp.
  Which one gets burnt is the counter's choice rather than the player's, and it is the cheapest that
  fits: a panel asking which of four helmets to melt is a second decision on top of the one that
  matters.
- **The fettler is a person, not a station**, for the reason the bounty board is one. `StationId`
  means "where a recipe is made" and `recipesAt`, `STATION_SKILLS`, `STATION_PERSISTS` and
  `afkCampJob` all read it as one; a reforge is not a recipe, has no skill behind it and is nothing an
  unattended camp could settle to, so wearing a station's clothes it would have been dead data in four
  crafting tables. A role was a row and four compile errors.

The **tannery** in the yard is the other half of that claim, and the more load-bearing half. Town had
the one forge and every made thing in the game came off it, which quietly made "production" and
"smithing" the same word; the vat is the second vertical, and it is out here rather than in town for
the reason the counter is — what it works is what the zones around it produce. See the fenhide tier
below for what it makes and why. The **fletcher's bench** beside it is the third vertical and the
same argument again (act three phase 13): the timber off the road south and the heads off the town
forge become arrows here, which is `docs/architecture/making.md`'s to explain.

**What is on the shelf is earned, and a locked row is still drawn** (`StockRequirement` in
`data/shop.ts`, ruled on by `systems/ShopSystem.ts`). A stock row may name a character level or a
finished quest, and until it is met the row is drawn dimmed with what it needs where its price would
sit ("Needs Level 5", "Needs A Feast of Crab", decision 99, since a quest's name alone read as a note
rather than a need) — the same call the world map makes for a shut zone, and for the same reason: what is
not on the shelf yet **is** the reason to come back, so hiding it tells the player nothing. It is
tapped like any other row and the world refuses with the full sentence, since a phone has no tooltip
to hover. `stockAccess` answers two things where `zoneAccess` answers three, and the missing one is
the point — a door with the key in the pack is about to cost something, where a gated shelf is simply
not yet.

The gate is settled in `ShopSession.buy` rather than trusted from the panel, for the reason the sale
count is clamped there: the overlay was drawn from a copy of the character. Two rules ride on the
table and are held by `tests/systems/ShopSystem.test.ts` rather than by comments, since it is
hand-written — **every price sits above the item's own value**, so nothing here can be bought and
sold straight back at a profit, and **stocked equipment has to be a tool**, which is what keeps the
gear tier the world's job alone. The shop sells time back: everything on it can also be earned by
playing, and the spread is what keeps playing the cheaper road. The merchant's inspect card names no
stock at all — it is a pure function of an npc id and so cannot read the player, and half the shelf
depends on one.

**Selling a stack is one request with a count on it**, not a second rule about vendoring:
`sell-item-requested` carries a quantity, `ShopSession.sell` clamps it to what the pack actually
holds, and "sell all" is that number rather than a separate path. The clamp is what makes the panel
safe to draw from a copy of the bag — a stale count can only ever sell fewer. **The two are separate
targets**, though: the shop row and the bag's Sell button still part with one, and emptying a stack
is a button of its own beside them (`sell-all` in `ItemActionsSystem`, `stackRow` in `hud/dom.ts`).
A stack of quest turn-ins is exactly the thing a mis-tap must not be able to sell, so the
bulk button is deliberately the smaller of the pair rather than the row itself growing a second
meaning — and it is offered only on a stack, since on one of something it is the Sell button beside
it wearing a longer name. The bank's two directions are the same widget: a move across that counter
is reversible where a sale is not, so the safety argument is weaker there — but the two panels are
read the same way, and a player should never have to remember which of them a row empties.

**A counter that deals both ways has two sides** (`hud/counterSides.ts`, version 2 phase A3;
`docs/decisions.md` 91). The shop drew its stock and the bag as one list under two headings, so
every row asked whether a tap on it bought or sold, and on a phone the bag was below the whole
shelf. Now the keeper's side and yours are framed panes that scroll on their own, headed with what a
tap does there, and the bank does the same with the vault on the banker's side and the price of a
shelf under it. Which way they stand is `counterLayout`'s (`hud.md`). The shopkeeper's work is not
on either side: it is offered in the conversation a tap on them opens, below.

**The bank is weightless and limited by _kinds_, not by weight** (`systems/BankSystem.ts`, run by
`world/BankSession.ts`, stored as `CharacterState.bank` and `bankSlots`). One slot per item id,
however deep the stack on it — a stack of one and a stack of two hundred cost the same shelf — so
putting a gathering run's haul away is a decision made once and the _first_ of something is what is
paid for. A second weight limit behind the counter would only have made the pack's decision twice;
what the vault costs instead is `bankSlotPrice`, a rising price that is the **second coin sink**
after the death fee, and the reason the pack stays small and awkward while the depth goes on the
shelves. It _caps_ at `MAX_BANK_SLOTS`, which is what left the endgame with a purse and nowhere to
spend it until the reforging stone went on the shelf above it — see reforging, below.

The counter is the shop's twin down to the shape: opened at `NPC_INTERACT_RADIUS`, shut by walking
past `NPC_CLOSE_RADIUS`, a HUD overlay handed a _copy_ of the contents on `bank-changed`, and bare
item ids and counts coming back — so a panel in an HTML overlay never holds the vault, and a count
the panel sends is clamped by the thing that actually holds the goods. Every move goes through
`CharacterController`, which refuses as a whole: a deposit with no shelf for it leaves the pack
exactly as it was. It is also the one counter that **persists on every move** rather than leaving it
to the autosave — a haul put away and lost to a closed tab is worse than one never put away.

**What standing at an NPC gets you is a role, not a guess** (`NpcRoleId` in `data/npcs.ts`). Before
the banker there was one NPC and five places assumed it: the tap, the context menu's line, the
plate over their head, the figure it hangs off, and the inspect card all opened, said or drew the
shopkeeper. A second person standing in the same town would have sold felling axes from behind the
bank's desk, and no state assertion would have caught it. All five read the role now, and the
trainer collected on it: a third counter cost a row in `NPCS` plus a case in each of them. The
quartermaster is the fourth and cost the same, which is also **why the bounty board is a person**:
the plan asked for a board, and a board would have been a second kind of tappable furniture with its
own pick priority, prop, map marker, inspect card and tap kind. The one furniture type that exists
could not be borrowed — `StationId` means "where a recipe is made", and `STATION_PERSISTS`,
`recipesForStation`, `stationsInReach` and `afkCampJob` all read it as one — so a board wearing it
would have been dead data in four crafting tables. A role was a row and four cases. The **fettler** at Greyford is the sixth and cost the same
four, which is the seam still paying: a reforge is not a recipe, so a station would have been dead
data in four crafting tables.
`ZoneWorld.approachNpc` keeps that honest with two tables keyed by counter — `COUNTER_WALKS`, what
the walk toward each is called, and `Counters`, the session behind each — rather than a pair of
matching conditionals: which counter to open and what the walk toward it is called are the same
fact, and the two drifting apart is how a walk ends at the wrong desk. `TOWNSFOLK` in `art/cast.ts` is keyed by `NpcId` for
the same reason `NO_GEAR` is keyed by `GearSlotId`: a new person is a compile error until they have a
look, and `zoneMap` puts them on the map off `npcSpawns` with nothing else written down.

**A counter is one thing with seven kinds** (`world/CounterSession.ts`, act three phase 1): the six
roles, and talking to somebody. Every session extends it and adds only what can be done while it is
open; the base owns who is behind it, opening, closing, a close from the panel's X, and walking out
of `NPC_CLOSE_RADIUS`. Both of its events — `COUNTER_OPENED_EVENT` and `COUNTER_CLOSED_EVENT` —
carry the `CounterId`, where there used to be a pair per counter: twelve constants for one idea, and
a seventh counter was about ten files. On the HUD side `OverlayHost` holds one table of panel
factories keyed by the same id, and `refreshOpen()` redraws whichever is up. Three rules ride on
it:

- **One counter is open at a time.** `approachNpc` shuts the rest before opening one, which is what
  lets the HUD hold a single counter panel and lets `QuestDesk` ask "who is the player talking to"
  and get one answer.
- **A quest is taken from the person who gives it.** `QuestDesk` is gated on the NPC the player is
  standing at being the quest's `giverNpcId`, not on the shop being open — the two were the same
  question only while the shopkeeper was the only giver. The HUD half is the same rule:
  `COUNTER_OPENED_EVENT` names the person as well as the counter, and the talk panel draws their
  quests (`content.md`), so the outfitter and the fettler show theirs with no panel told.
- **Whatever panel is up is a function of the HUD's model**, so any model change redraws it.
  `tests/hud/Hud.test.ts` asks that of every role, since a hand-kept list of refreshes is exactly what
  a new panel gets left out of. A seventh role is now a row in `NPCS` with a greeting, a session, a
  panel factory, a walk name and a line in `ROLE_SERVICES` — each of which is a compile error until
  it exists.

**A tap on a person talks first** (`world/TalkSession.ts`, `hud/TalkModal.ts`; version 2 phase A4,
`docs/decisions.md` 92). The tap used to open the counter behind them, which left a person nothing to
be but a till. Now it walks up and opens a conversation: their name, their one-line greeting
(`NpcDefinition.greeting`), a button for the counter they work with a line under it saying what it
is for (`ROLE_SERVICES`), and the work they have going. That is the shell Part D's dialog fills.
Talking is a counter rather than a new kind of thing, and that is the whole of why it was cheap: a
`CounterId` of `'talk'` beside the six roles, a session with nothing added to the base, the same
events and the same panel slot — so walking off, one at a time, a zone change, a death and a camp all
shut it with no line written for it. It is not a role, because nobody's job is to talk; a person
works one counter and has the conversation besides (`worksCounter`).

Moving between the two is a request that names only the counter (`COUNTER_REQUESTED_EVENT`): the
talk panel's button asks for the role's, and a **Back** at the front of every role counter's head
asks for `'talk'`. The world answers it for whoever is being served, since the player is already
standing there, and refuses a counter that person does not work. The Back is put there by
`OverlayHost` rather than drawn by each modal — each hands the host its `head` — for the argument
that kept quests off the panels while they were drawn on top of every one. For the person visited
every trip, the held finger is the short way: a right click or a long press on anybody offers Talk
and their counter, and the counter there is a tap that names it (`WorldTap`'s `counter`) — the same
walk, ending at the counter rather than at the conversation.

**Every counter stands inside the building it works out of**, at the back of the room and facing the
door (`counterPoint`). They stood on the doorsteps until the rooms could be walked into. What moved
with them is **how close you have to stand to be served**: `NPC_INTERACT_RADIUS` is a tile now rather
than nearly two, because a reach of two tiles hands the purse over through the shopfront — the walk
stops in the street and nobody ever goes inside, which would leave the rooms as decoration. It is
what decides whether a room is somewhere you stand, and the arithmetic is unforgiving: a room is
entered only when its floor reaches further back than that reach, so a **three-tile building is a
shop you walk into and a two-tile hut is one served from its own doorway**. Four of the six are the
first kind. `docs/decisions.md` 46 is why the other two are not deepened instead, and
`BuildingSystem.test.ts` asserts which is which so a room cannot change side by accident.

What makes any of them **findable** from the street is a rule that was already there for another
reason: a nameplate is a readout, so it is drawn with `depthTest` off and floats over whatever is in
front of it. A counter's name and quest marker therefore hang over the roof of the shop they work in,
which is how a player knows the shopkeeper is in the General Store rather than wondering where
everybody went.

**Where a counter stands is a tap rule twice over.** Every pair of NPCs in a zone sits more than
`NPC_INTERACT_RADIUS` apart, so which one a tap opens is never a question about pixels — walls make
that harder to get wrong rather than easier, since the radius reaches straight through one — and none
of them stands on the crossroads. A person on the road a few tiles ahead of the spawn point is
standing exactly where a player taps to walk forward: the trainer was first placed three tiles up the
north road and turned "go north" into "open a counter", which smoke caught as three ground-walk
checks stopping an interact radius short of where they aimed. It is the same class of mistake as
drawing a signpost under the tab bar, and `tests/world/trainer.test.ts` holds the spacing half of it.

**A counter also needs an apron no creature can wander into**, which is the third half of that rule
and the one nothing held. `pickTap` is a priority rather than a depth sort, so an NPC beats a mob
from anywhere along the ray — and the ray in to a creature comes down low over the ground just short
of it, since the camera stands south of the player. A person standing there is crossed first, so a
rat at a counter's shoulder cannot be tapped at all. The order itself is right and is not what
should give (a rat in front of the shopkeeper must not stop you shopping), so what gives is the
spacing: the two town rats spawned with the banker and the shopkeeper _inside_ their wander disc,
and were untappable whenever they drifted that way. `zones.ts` had already written this down over
the forge's placement and moved the furniture for it, having learned it the same way — as a finger
tap in smoke that selected nothing, one run in three. `tests/render2d/picking.test.ts` holds it now
over every zone, swept across each mob's whole wander disc rather than checked at the spawn point,
because a creature is only ever _at_ its spawn on the frame the zone was built. The counters moving
indoors is the same rule paid by somebody else: no mob's disc may reach inside a building either, so
a person behind a wall is a person a rat cannot stand in front of. The sweep still runs, because what
holds them apart is two rules in two files agreeing rather than one of them. Nodes are left out
of that rule on purpose: they are terrain, scattered by the hundred, and a tree between you and a
rat is in the way visibly, where a counter swallowing the tap looks like nothing at all.

**Acquiring an item can fail.** The pack has a weight limit (`systems/EncumbranceSystem.ts`,
capacity from strength), so gathering, loot and buying all go through
`CharacterController.tryAddItem`, which adds nothing and returns false when the pack is full.
Use it rather than `addItem` for anything the world hands the player, and handle the refusal. The
one exception is what comes off a station, which spent its inputs first and so is never refused:
`addMadeItem` hands it over without asking the pack (`docs/decisions.md` 79).
**What a refusal means depends on who is watching**: an attended player is stopped — they are right
there and can make room, and nothing is destroyed while they do — where an unattended one keeps
going and loses the haul, since the swing happened and stopping the camp dead would cost them a
night's XP rather than one load of logs. `GatherSession` asks `isCamping()` to tell the two apart.
Currency is weightless and never fails.

**A kill's refusals are the same line drawn at the same place** (`docs/decisions.md` 62-63). A
drop cannot be "stopped" the way a gather can — the creature is already dead — so for an attended
player `CombatDirector.grantLoot` leaves whatever the pack refused in a **loot pile**
(`world/LootPile.ts`) where the creature fell, and a camp loses it as it always did, with a log line
per drop; `CombatDirector` asks the same `isCamping()` once per corpse. A pile holds exactly what was
refused — never coin — and lies for `LOOT_PILE_LIFETIME_MS`, a minute of game time, which is time to
make room or to walk back from the respawn point and not time to go to town and sell first. Each
kill's refusals are a pile of their own, even on top of another, so there is no rule about how near
is near. A pile is the zone's, like a fire: `LootPiles` holds them, nothing saves them, and a zone
change or a teardown drops every one; a death does not, since the respawn is in the same zone. A
tap on one walks over and takes what fits, a stack at a time, so a heavy thing that does not fit
does not stop a light one after it; what is left keeps the pile's original minute.

**Two acquisitions take what fits: a withdrawal and a pile** (`CharacterController.withdraw` and
`addWhatFits`, using `carryableCount` in `EncumbranceSystem`). Every other path hands over a fixed
amount that is _destroyed_ by a refusal — a gather yields two logs or swings for nothing — which is
what makes all-or-nothing the right answer there. The rest of a withdrawal simply stays on the shelf
and is still the player's, and the rest of a pile stays on the ground, so refusing thirty logs
outright because twelve fit would be inventing a loss. Both say what stayed behind, since asking for
thirty and getting twelve otherwise reads as a bug.

**An arrow goes into the quiver before the bag sees it** (`CharacterController.tryAddItem`,
`addWhatFits` and `addMadeItem`, act three phases 12 and 13; `docs/decisions.md` 70, 73 and 79). An
arrow fletched at the bench is an arrow like one off a body: into a dry quiver, or beside a quiver of
another kind into the bag, where the next refill reaches for it first if it is the better one. The quiver is
`CharacterState.quiver` — one kind of arrow and how many — beside the gear rather than in it, since a
slot holds one item and a quiver holds a stack, and apart from the bag, since quivered arrows weigh
nothing and cannot be sold or banked. So both acquisition paths ask where a stack would go before
asking whether it fits: a dry quiver is topped up from the bag first, then takes its own kind up to
what it holds (or any kind, empty), and only the rest is weighed. A full pack never refuses an arrow
the quiver has room for, which is why a pile will seldom hold the arrows being shot. `canCarryItem`
asks the same question without doing it, so the shop's check before the coin leaves the purse agrees
with the add after it.

**The arrows go where the quiver goes.** Taking one off puts its arrows in the bag, or refuses the
whole change on a pack that cannot hold them; swapping quivers carries them over and spills what the
smaller one cannot hold; one put on dry fills from the bag, best arrow first by the arrow's own
damage. A bow takes both hands, so drawing one puts a shield or an orb in the bag and taking up either
puts the bow there — the one thing a bow allows beside it is a quiver. All of it is `wear`, the one
place gear and quiver change together, which is what refuses as a whole rather than half-applying.

**Arrows are sold by the bundle** (`ShopStockEntry.quantity`): twenty-five for 30c, ungated for the
reason the tools are, since a gate on arrows would be a gate on the class. The price is priced for a
whole bundle and the vendor spread is held per arrow. What it is set against is the starter arc —
`progression.test.ts` holds the arrows the arc shoots, priced at level 1, to well under half the coin
it pays — so a ranger's range is paid for without being taxed out of the arc.

An arrow weighs a tenth of a point, which no binary float holds exactly, so `EncumbranceSystem`
compares weights to within `WEIGHT_EPSILON` — three tenths of spare room divided by a tenth is
2.9999999999999996, and a pack with room for exactly three more would otherwise refuse the third.
