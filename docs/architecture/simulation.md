# The simulation

How the world is stepped and what it owes the view: `ZoneWorld` and its collaborators, the session, the boot flow and the host, the two channels out, death and respawn, movement, collision and pathing, aggro, persistence, and the frame-rate rules.

_Moved out of `CLAUDE.md` on 2026-09-25 (`docs/decisions.md` 57). The paragraphs are the ones that were there, in the order they were there; `CLAUDE.md` keeps the rules and points here for the reasoning. Where this and the code disagree, the code is right — and this file is what should be corrected._

**The simulation is `src/world/`; `src/render2d/` only draws it.** `ZoneWorld` owns the player, the
mobs and the nodes, and steps everything that moves them from `update(deltaMs)`. `world/Player.ts`,
`world/Mob.ts`, `world/ResourceNode.ts`, `world/Campfire.ts` and `world/LootPile.ts` are the
simulated things; the view keeps no scene of them and draws each frame from the world as it stands
(`render2d/ZoneView2D.ts`). New gameplay goes in the world, not the view. Two consequences worth
knowing before you add to it:

- **Nothing in `world/` may own an engine timer or tween.** Mob wandering, the death fade and the
  respawn were three `scene.time` calls; they are accumulators counted down against the frame delta
  now, which is what lets a whole zone run in vitest with nothing rendering it. A view may still
  animate — the 2D view reads `mob.deadForMs` and plays the fall against it — but the clock that
  decides anything has to be the world's.
- **Collision bodies are data** (`EnemyDefinition.body`, `ResourceNodeDefinition.body`), not
  measurements off anything drawn, for the same reason `PLAYER_HALF_EXTENT` is: how big a rat looks
  is the renderer's decision and how big a rat _is_ is not. The art is drawn to agree with the data
  rather than the other way round: a boss is the figure grown and a goblin the figure shrunk
  (`art/cast.ts`), which `tests/art/cast.test.ts` holds. **How much of a node's body
  blocks is data too** (`ResourceNodeDefinition.blocks`, a fraction of the footprint or `null` for
  something you walk straight through), and that had to stop being one constant the day a second
  solid node existed: a tree is a canopy you walk under on a trunk you cannot, where a vein is rock
  all the way up, and the art draws a tree's trunk and a vein's stone over what `blockerRect()`
  stops, so what stops you stays what you can see stopping you.

**The rules themselves are `ZoneWorld`'s collaborators, one per subsystem**: `CombatDirector`
(both directions of a fight and what a corpse is worth), `GatherSession` (the channel, the fire,
the pan, the food), `AbilityCaster` (whether a button may be pressed, and the spell part-way
through), `LootPiles` (what a full pack left on the ground, its minute, and taking from it), `AfkCamp`, `TalkSession` and the counter sessions beside it (`ShopSession`, `BankSession`, `TrainerSession`, `BountySession` and the rest, `economy.md`), `QuestDesk`,
`ContextMenuSession` (what a press held is about, and what was chosen from it), `TipDesk` (the
spirit's tips: which is waiting, saying it, and hearing the answer), `Spirit` (Wick, following the
player and saying what it has when tapped, D4), `SecretFinder` (a secret walked up to, once,
measured along the stretch walked each frame so a slow phone finds one it walked past, decision
117, and one in a room only from inside it, decision 120), and `ApproachDriver`
(all three click-to-move walks). Each owns its own state,
is constructed by `ZoneWorld` and reaches the rest of the zone through two things and no others: the
`WorldContext` they all share — the clock, the character, the player, both channels out of the
simulation, and the handful of publishers more than one of them needs — and a small `Deps` interface
declared in its own file, of named hooks plus, where a collaborator needs one, a value that is fixed
for the life of the zone (the driver's `collisionWorld` is the one). A new rule belongs in the collaborator that owns the state it reads; a new
collaborator gets a `Deps` of its own rather than a reference to the world. What is left in
`ZoneWorld` is what none of them can own: the entities, the order the tick runs in, what is
selected (`world/targeting.ts`, which is the read-only view of it three of them get), the
publishers that speak only on change (`publishOnChange`), and the three things that stop
everything at once — a zone change, a death, a teardown. Its `handle*` methods are a thin
delegating surface kept for `tests/world/`, which drives a counter or a cast by calling one rather
than by emitting the request the HUD would; neither the view nor `scripts/smoke.mjs` uses them.

**The boot flow is an if-statement, not a scene graph.** `src/bootFlow.ts` resumes the save, or
mounts the plain-HTML creation screen (`hud/CharacterCreate.ts`) and starts the session with what
it produces: a name, a class and a look (`CharacterState.look`, save version 27, decision 107). Nothing before the world needs a renderer at all, which is why the creation screen can
be shown before one exists.

**A host is what a renderer owes the boot flow**: an `events` channel plus `startZone()`, and
beyond that everything that has to happen around a zone without drawing it — the frame loop, the
keyboard binding, the pointer, mounting the HUD, the reset that ends a session, and the load that
replaces one with a character read from a save file. `Host` in `host/host.ts` is the only one,
and it takes the view it is built with through the `ZoneView` interface (`host/zoneView.ts`): the
pixel-art one, `render2d/ZoneView2D.ts`, which `main.ts` hands it. It lived in `render3d/` while
the game was drawn in 3D, and stood apart from both views while there were two (B2 to B7). The
split is what let the renderer be replaced under the game twice, so new host duties belong there
rather than leaking into the world, the HUD or the view.

**`GameContext` is the session — everything that outlives a zone** (`world/GameContext.ts`,
engine-free). It owns the `CharacterController`, the `InputState`, whichever `ZoneWorld` is running,
and the autosave accumulator, and it is the **only** thing that builds or tears down a world:
`update(delta)` steps the current one and answers `{ events, zoneChanged }`, having already loaded
the next zone when a `zone-exit` or a fatal `death` asked it to. `startGame` / `gameContext()` /
`endGame` are how the host reaches it, and `CharacterState` never travels through a global.
Two things follow that are easy to get wrong:

- **A zone change is a view rebuild.** The view lets go of everything it made for the last zone
  (the baked ground, the buildings, the shadows, the words, the lantern) and makes them again
  against the new world; every canvas is made and let go through one pool
  (`render2d/canvases.ts`), and whatever makes one lets it go. `npm run smoke` compares
  `drawnCounts()` and `canvases()` across three round trips, because a leak here is invisible to
  every state assertion and to the screen — it is memory the page never gets back.
- **Anything the HUD must hear but is not yet mounted for goes in the notification queue**, not an
  event: `takeNotifications()` is drained once, by the host on the boot that mounts the HUD and
  handed straight to it. The offline AFK payout is resolved on the load that finds a parked
  session, which is necessarily before the HUD exists.

**There are two channels out of the simulation, and they are not interchangeable.**

The **HUD channel** is the session's `EventBus` — `world/eventBus.ts` under the host, a bare stub
in a test; see `src/ui/uiEvents.ts` for the event name constants (`target-selected`, `xp-gained`,
`level-up`, `equip-item-requested`, etc.). The host passes it into `ZoneWorld`, which is why the
world can emit to the HUD without importing an engine; the world also subscribes to the HUD's
requests itself and drops them in `destroy()`. The DOM HUD only listens and renders. Every one of
these carries state the HUD re-renders from, so the latest one always describes the present. **No
position reaches the HUD once a frame**: the player's (`player-tile-changed`) and the creatures'
near them, for the minimap (`creatures-changed`, decision 115), are published on a whole-tile
crossing and carry where each one is at that moment, and the creatures only within the minimap's
reach of the player (`MINIMAP_REACH`), so one wandering the far end of a zone says nothing.

The **view channel** is the `WorldEvent[]` `world.update()` returns each frame: `hit`, `swing`,
`defend`, `heal`, `float`, `death`, `spawn`, `bolt-cast`, `gather-tick`, `level-up`, `wind-up`,
`loot-left`, `zone-exit`. These are moments, not
state — a bolt left the caster's hand, a number floated off a corpse — and a view that misses one
cannot recover it from anywhere. They deliberately name a `tone` rather than a colour: the view
decides what "reward" looks like. Anything the renderer needs to know about but cannot read off the
state belongs here. `render2d/effects.ts` draws them as short-lived moments from the tick that
returns them, taking the tone's colour from `FLOAT_TONE_COLORS` in `ui/theme.ts` — which lives
beside the palette the HUD uses rather than in the renderer, since the number over a hit and the log's
line about it are one colour, a step on the art's ramps like every colour the HUD names.

Mutations of `CharacterState` itself (inventory, gear, xp, skills, location) go through the
engine-free `systems/CharacterController.ts` rather than being inlined anywhere. Add new HUD-facing
state changes by adding an event constant and emitting/listening to it, not by reaching across
modules. An event carrying more than two or three values should pass one object (see
`TargetInfo` in `uiEvents.ts`) rather than growing a positional argument list.

**`ZoneWorld` does not load zones, and that is on purpose.** Walking onto an exit emits
`{kind: 'zone-exit', to, edge, fraction}` and stops the world; the `GameContext` acts on it,
because tearing this world down is its job too. It is the only handover there is: travelling from the
world map was a second one under its own event, and both it and that event are gone. HP rides across,
so crossing a line is never a free heal. The next world lands the player across the mouth of its
own exit on that edge, at that fraction (`sideOn`, decision 119): only an exit's mouth leaves, the
edge either side of it being the world's end, and the fraction runs over where a body's centre can
cross a mouth, half a body in from either side, so two mouths need not be the same width and an
arrival never stands in the wall beside one. A frame
that changed zone hands its events back with `zoneChanged: true`; they belong to a world that no
longer exists, so a view rebuilds instead of drawing them.

**A death is the one stop that changes no worlds.** It used to be the third way a world handed the
player on — a corpse away from home was carried to town at full health for nothing, which made
walking into a bandit both a faster way home than walking and a free heal on arrival. A respawn now
happens where it happened, at the zone's spawn point, and `{kind: 'death', on: 'player'}` asks the
host for nothing — and, since nothing changes worlds, leaves the zone's loot piles where they lie
for the player to walk back to (`docs/decisions.md` 63). What dying costs is the walk back plus the
fee in `systems/DeathSystem.ts` — the first thing in the game currency is spent on, and deliberately coin rather than XP, since on a
quadratic curve a penalty big enough to be felt is big enough to erase an evening. A purse too thin
pays what it has: a respawn is never blocked on affordability. Arriving at full is still the point
of dying, which is why the spawn point has to be safe — it is the zone's start, the `@` in its
text, where a respawn puts someone with no particular spot. It was the middle of the map until zones
were written as text (decision 113), and a start is still best somewhere a traveller would stand.

**That safety is held by a sweep now rather than by this paragraph**
(`tests/systems/spawnSafety.test.ts`), because for a long time the paragraph was simply wrong. Three
zones shipped with the spawn point or an arrival strip inside an aggro radius, each found by hand and one
at a time after the fact: Blackwater Fen put a level 5 raider 71 units from its own centre against a
radius of 210, the Old Mill Road had a goblin at 187 against 200, and the bandit camp's east edge —
the way back out of the hideout — passed 128 from a level 3 bandit.

The sweep holds **two rules of different strength, and the difference is the whole of it.** The
start is clear of an aggressive creature's _whole wander disc_, because a respawn is not a choice:
dying already costs the walk and the fee, and what stops that being a spiral is a moment to gather
yourself. Measuring at the spawn offset would guarantee nothing, since a creature is only ever _at_
its spawn on the frame the zone was built — the same argument `tests/render2d/picking.test.ts` makes
about tapping one. An arrival strip is held to the weaker rule of not landing anyone _already_ inside an
aggro radius, because walking through a door is a choice and something wandering over to meet you on
the far side is the zone working. What that refuses is a trap: no frame in which to walk back out.
A strip is the line across its exit's mouth an arrival-inset in, measured to as a segment, so a
vault entered at a mouth five tiles across (decision 119) asks only those five tiles to be clear.

Expect a new zone to cost a spawn or two moved. A 300-unit disc around the start is not a small
claim on a 25x19 grid, and the mill road's knots had to move as whole knots to keep being knots.
Writing the zones as text moved every spawn onto the middle of a cell, and that half tile cost two
fen raiders and a knot another move each.

**The same file holds a creature's way home** (decision 116), since a creature that cannot get home
never wanders again and only a wandering creature notices anyone. Its home is somewhere its body
stands, and it is walked home, at 60fps and at 5, from every cell a chase could have led it to —
inside its leash ring, joined to home without leaving it — where the way home is not a straight
line. The first run found four homes no walk could end at, all from writing the zones as text: a
goblin in the trunk of the hardwood beside it, the barrow king (a tile and a half tall) with his feet
in the rock at the foot of his chamber, and a fen raider and a lurker each living in a gap a tile wide
between two pools, which a search will not stand a body in. The tree moved, the king got an alcove,
the lurker moved down a row and the raider's pool gave up a tile. **A diagonal is a gap too**
(decision 121): the rebuilt fen wedged a raider, a whole tile wide, between a pool's corner and a
scrap of water at the causeway's head, a tile apart on a diagonal, a passage with no slack in it
though nothing across it in a straight line is a tile wide. The one kind of cell it skips is a slot
with no room to turn round in (decision 35), which a press can push a creature into and no route
takes it out of; the net below is for that.

**There is no physics engine.** `world/Player` and `world/Mob` own `{x, y, vx, vy}` and integrate
themselves each frame against `systems/CollisionSystem.ts`, which is the only thing that decides
what may move where. The arcade physics this replaced was carrying four colliders — player and mobs
against blocking tiles and against tree trunks — and nothing else: player↔mob, mob↔mob and
player↔NPC never collided, and every combat and interaction check is distance-based. `Mob` is
instantiated directly from an `ENEMIES` definition
(no per-enemy subclasses) and owns HP, death/respawn timers, and a `wander | chase | returning` AI
state machine. Combat math itself (damage rolls, range/cooldown checks) is _not_ on these classes —
it lives in `systems/CombatSystem.ts` and is called from `ZoneWorld`, which resolves both
directions: `updateCombat()` for the player's swings and `updateEnemyAttacks()` for everything
hitting back.

**A tap routes round what is in the way, and so does a chase** (`systems/PathSystem.ts`). `findPath`
is A\* over the same tile grid `CollisionSystem` thinks in, answering with the points to walk to in
order, or `null` — which means "do what you did before there was a pathfinder", so a caller's first
handling of it is a fallback to the straight line rather than a failure case. It routes **a body of
any shape**, half extents rather than one number, since a rat is a tile and a quarter long and six
tenths of one wide; the player is the square case.

What makes a cell passable is **`isBlocked` on the body being routed**, rather than a second grid
built by rasterising the blockers: testing the whole body at a point _is_ the configuration-space
inflation, and a rasteriser would have been a second picture of the world free to drift from the one
every walk integrates against. Four things about it were decided against alternatives and are worth
not undoing:

- **A waypoint is where the body stands in a cell, not the middle of the cell.** A\* answers with
  whichever cell is cheapest and never whichever is roomiest, so a route down a corridor two tiles
  wide comes back hugging one of its walls — and the walk lands within `arriveRadius` of a waypoint
  rather than on it, which beside a wall is a corner in that wall. Passability and where-to-stand are
  one answer (`footing`) precisely so the two cannot disagree.
- **A cell something reaches into is stood in off its middle** (decision 113). Every building is on
  tile lines since zones are written as text, so a room two tiles deep has room for the body at the
  middle of neither cell, each holding a wall's thickness of its edge, and a door two tiles wide is
  centred on the line between them. Such a cell stands the body at the nearest spot a quarter tile
  off its middle (`foothold`), and it is **crowded**: a step between two uncrowded cells is clear by
  construction, since a body at a cell's middle is the whole cell, but a step touching a crowded
  one may cross the very wall that crowds it, so it is walked with a shortcut's clearance and may
  turn one corner to square up to a door. The start cell is crowded too when something is in it,
  which is what stops a route out of a room stepping through its back wall.
- **A passage with no slack in it is not a route.** A gap exactly the body's width is one it fits
  through only in exact arithmetic, so `findPath` refuses to turn a corner in one — which is where
  the rule that **a doorway has to be at least two tiles wide** comes from. Walking the _length_ of
  such a gap is still fine, and is what the straight line to the goal answers.
- **The route is proved by being walked, not by being read.** `tests/systems/PathSystem.test.ts`
  drives every route it builds through `stepToward` and `moveWithCollision` at 60fps and at 5, over
  hand-built worlds and over every zone as `populateZone` builds it. Four routes that read perfectly
  were refuted that way, which is the whole reason the two rules above exist.

**A search is paid for once a zone, not once a tap** (decision 116). Where a body of one size stands
in each cell is remembered for the life of the collision world it was worked out in, since what is
solid never changes inside a zone, and the cells a search has still to look at are a binary heap
rather than a scanned list. Taps asked a search once each; creatures ask as often as their quarry
moves a tile, on maps that are about to be three times the size. On a 50×38 stand-in for a rebuilt
zone the mean search went from 5.7ms to 1.9ms, the worst being the first, which fills the footings.

**Walking one is `Player`'s and asking for one is the caller's**, which is the split that let this be
wired in without touching anything else. `Player` holds a list of legs and `moveTo` sets a route of
one — which is what a walk always was — so `hasMoveTarget()` stays true across a whole route, and the
two things that read it (`AbilityCaster` refusing a cast, `resolveApproach` asking whether the walk is
over) went on meaning what they meant. A leg is **given up inside the frame that reaches it** rather
than one per frame: `stepToward` reports arrival before it moves, so a leg a frame is a stall at every
waypoint — a fifth of a second of one at 5fps, exactly where the corner was that put the waypoint
there.

**A chase is a route kept, not a route re-made** (`world/Chase.ts`, decision 116). Something that
moves cannot be routed once at a tap, and decision 37 kept the pursuit straight because a plan re-made
every frame for a moving quarry swings between two ways round an obstacle as it drifts. A `Chase`
answers that: **straight at the quarry whenever the body has a clear line**, which is most of every
chase and costs a line check; otherwise **round what is in the way, on a route kept until the quarry
is a tile off its end** and never re-made twice in half a second; the last leg is the quarry where it
is now. A creature chasing the player, a creature walking home and the player's pursuit are the same
object, one each, so a tap on a creature behind a building walks round it. Both kinds of chaser
**stop in reach and in sight**: a staff reaches 200, and a wizard at the back of a room would
otherwise stop against the wall with the creature the other side of it. No creature's reach is longer
than a wall and two bodies, so for one of them it is the rule for the day a reach is.

A chase also counts **how long it has been going nowhere**, off what the body did rather than what
the search said: on a route or a clear line, a step that went under a quarter of the way it was set;
with no route, a step that got no nearer, since a chase with no route presses straight as every walk
did before there was a pathfinder, and that press may slide along a shore for ever or may walk the
length of a passage a search refuses. A creature's chase gives up on the player at `GIVE_UP_MS`
(two seconds) of it, and its walk home is put home at the same.

**A walk toward something solid is routed to beside it and finished by pressing into it**
(`standNear`). Almost everything worth tapping is solid — every tree, every vein, every building — and
a route may not end inside a wall, so routing to the thing itself would have left the pathfinder wired
in and doing nothing for the most repeated action in the game. `standNear` backs the goal along the
line the walk comes in on until the body fits, which is where the straight line would have stopped
anyway, so what it changes is only whether there was a way to get there. `walkTo` then appends the
**original** point as a last leg and `walk` does not, and that split is load-bearing rather than tidy:
a body's width short of a vein, less the arrival band a slow frame widens to 38px, is outside a
gather's reach with nothing left to close it — the walk finishes and the gather is abandoned. Pressing
up against the trunk is what satisfies the radius `resolveApproach` asks about every frame. A `walk`
on open ground has nothing asking anything of the arrival, so the nearest place the body can stand is
the whole answer, which is why a tap in the middle of the pond now ends at the shore.

One thing this found and did not fix: **below about 10fps a body cannot close the last pixels onto a
blocker at all.** `moveWithCollision` cuts a frame into half-tile substeps and reverts a blocked one
whole, so it stalls up to 32px out — far enough that a tap on a vein never gathers. That predates the
route and happens with none involved.

**Aggro contract**: `Mob.engage()` starts a chase, `disengage()` drops aggro _and heals the mob
to full_ on its way back to spawn. Enemies with `aggressive: true` and an `aggroRadius` engage
on their own when a wandering mob **sees** the player inside that radius (bandits) and has a way to
them (decision 116): a wall between them hides the player, so cover is a way past a camp, and a
creature with no way to the player never starts a chase it could only give up. Asked cheapest first
— the radius, then the line of sight, then a search at most every half second — so the search is
only made for a player already close and in plain sight. Passive enemies only ever retaliate.
Leashing (running past `leashRadius`, still a ring round home as the crow flies, so one led round a
building gives up at the ring a player can learn by looking), **giving up** (a chase that has gone
nowhere for `GIVE_UP_MS`: across water, into a room too narrow for it) and player death all
route through `disengage()`, so a fight always restarts from a clean slate — reuse it rather than
resetting mob state by hand. Giving up is what makes standing somewhere a creature can never reach
an escape rather than a turret: a ranger shooting it from there heals it every two seconds.
The walk home is a chase too, routed round whatever it was led round, and **a walk home that goes
nowhere for as long ends with the creature put there**, since one stuck on the way stays out of its
zone's fights for good. Nothing draws that as a moment; the sweep above is what keeps it rare. `Mob.update()` takes the player's position, since chasing needs it,
plus the frame delta and the collision world, since it moves itself. All three AI states steer
through `stepToward`, so the arrival band is `arriveRadius` — never a fixed one. The 2px and 4px
thresholds they used to carry were the same slow-frame bug `arriveRadius` exists to fix, one level
down: below 30fps a mob stepped straight over a 4px band and orbited its own spawn point.

**Persistence** (`src/persistence/`): `SaveService` is an interface; `LocalStorageSaveService` is
the only implementation today. Always import the `saveService` singleton from
`src/persistence/index.ts` rather than constructing `LocalStorageSaveService` directly — that
indirection is the intended swap point for a future networked backend. `CharacterState` carries a
`version` field: when you change the shape, bump `CHARACTER_STATE_VERSION` and add a step to
`persistence/migrations.ts` so existing saves upgrade on load instead of being wiped — a save
with no chain of steps to the current version is dropped.

**Version 2's saves count from 100** (`FIRST_VERSION_2_STATE`, decisions 82 and 113), with no step
from anything below it: version 2 rebuilds the world at a new size, and a version 1 character's
position, quests and keys stop describing anywhere. A version 1 save is dropped the first time it is
read, and `LocalStorageSaveService` keeps who was in it for exactly one ask (`takeRetired`), which
the boot flow makes when it shows the creation screen: "Brom, level 8 warrior, retired with version

1. Version 2 is a fresh start." Once, because the save it came from is already gone. A version 1
   file or code is refused by `readSave` in the same words (`persistence/retired.ts`), and the version
   1 chain of steps is in the history before C1.

**A save travels as a file or a code** (decision 97, `persistence/saveFile.ts`): one envelope,
`{ game, character }`, written as indented JSON for a file and as base64 of the same JSON for a
code, since a code goes through notes and messages that curl a straight quote and wrap a long line.
Taking one away is an ask and an answer on the HUD channel: `GameContext` hears
`SAVE_EXPORT_REQUESTED_EVENT`, persists (so what leaves is where the player stands, and the browser
holds the same), and answers `SAVE_EXPORTED_EVENT` on the same call stack, because the HUD does
what a page does with it — a download, the clipboard — and a browser grants both only inside the
tap. The session answers rather than the host because a save is the whole character and outlives
every zone. The minimap's switch (decision 115) is the session's for the same reason: nothing in a
zone reads it, so `GameContext` hears `MINIMAP_SET_REQUESTED_EVENT`, sets it on the character,
persists and answers `MINIMAP_STATE_CHANGED_EVENT`. Those two are the session's subscriptions,
cleared in `destroy()` with the world's.

Bringing one back is `readSave`: either form, the envelope's `game` (so "not a save" and "a damaged
save" are two different things to be told), the version (newer is refused, older runs **the same
migration chain** a stored save does), then **a check of every field** against `FIELDS`, a record
over `CharacterState`'s keys so a new field is a compile error there. Ids are checked where the game
looks one up and would break on one it cannot find — class, zone, ability, quest, contract, title,
reforge — and **item ids and the tallies' keys are not**, since the game already reads past a
retired item (`tests/staleIds.ts`) and an honest save can hold one. A parked night is never carried
in: the same file can be loaded again and again. The HUD reads the save, because its preview needs
the character before anything is decided; the host is handed one already checked
(`SAVE_IMPORT_REQUESTED_EVENT`) and does a reset that ends somewhere else — `endGame()` **before**
the new character is saved, so the one leaving has no frame and no unload left to write itself back
over it, then `beginLoadedCharacter` in `bootFlow.ts`, which the creation screen calls too.

`CharacterState.position` is **honoured on load**: a save resumes at the spot it names, and only
when `zoneId` matches the zone being entered. `null` means "no particular spot" — a new character,
or one who owes a respawn — and the zone puts them at its start instead. Walking through an exit records the arrival point in the zone being _entered_, not the
spot being left, so the pair is never self-contradictory; keep it that way if you add another way
to change zones. Only smoke can check any of this, and it does.

**Frame rate is not an assumption you may make.** A loaded CI runner or a cheap phone steps the
game at single-digit fps, where one frame carries the player ~46px. Anything comparing a distance
against a fixed threshold has to scale that threshold with the frame's travel — see
`arriveRadius` in `systems/MovementSystem.ts`, which exists because a fixed 8px arrival band left
the player orbiting a tap destination forever below 30fps. `stepToward` also **clamps its last step
to the distance remaining**, so a walk lands on its destination instead of stepping over it and
turning round; that is exact only because everything integrating it does so over the same delta it
was handed. The rule was the opposite one while a physics engine owned the integration on its own
timestep, and it inverted when the integrator came in-house — which is why both halves of the fix
are frame-rate arithmetic and both are unit-tested at 5fps.

The other half of a slow frame is tunnelling: 46px of travel can step clean over a wall.
`moveWithCollision` cuts the frame into substeps of at most half a tile (capped at 8), which at
normal frame rates is exactly one substep and costs nothing. It resolves **one axis at a time,
reverting only the blocked one** — that is what makes walking diagonally into the pond slide along
the shore, which arcade used to give away for free and which players notice losing. Two rules there are
load-bearing and tested: a body already inside a blocker may always move (otherwise a teleport
onto a tree freezes it there for good), and the world-bounds clamp uses the named
`PLAYER_HALF_EXTENT`, which **must stay below `EXIT_MARGIN`** — the clamp stops the player exactly
that far from the edge, so a half-extent that grew past the margin would silently stop zone
transitions firing with nothing to show for it.

**A tip is offered by the world, read off derived state, and heard once per character** (decision
98). `systems/TipSystem.ts` holds the twelve tips in the order they are offered — staying alive,
then what is in the bag, then what the player is doing, then how to ask about anything, and growing
last — each a rule over the character that answers its line or nothing. A line is written from the
tables the way the item card and the skills book are (the fee, the trainer's lesson and price, the
station and its zone, idle's share and ceiling), so a retune cannot leave a tip saying the old
number. `world/TipDesk.ts` asks once a second which tip is waiting, and since D4 keeps it there
until Wick is tapped, saying it on `tip-offered` and nothing else until it is heard; one that stops
applying before it is asked for stops waiting, and a second tap says the same one again. It keeps
quiet for the first eight seconds of a world and
forty seconds after a tip, which is what makes a character from before tips hear them one at a time
rather than as a queue. What was heard, and whether tips are off, is `CharacterState.tips` (save
version 26), set through the controller. What is on offer and the clock are the zone's, and start
again in the next one; the HUD outlives the world, so an answer is taken for any tip, not only the
one this world offered. A death leaves nothing in the save to derive a tip from, so `ZoneWorld`
tells the desk what getting up cost, and the desk holds it until that tip is heard.

**Wick is a collaborator like the rest, and a light rather than a body** (D4, `world/Spirit.ts`).
It follows the player to a spot off their left shoulder on a lag, closing a share of the gap worked
out from the frame's length (`1 - e^(-Δ/220ms)`), so a cheap phone's 160ms frame leaves it where
ten fast frames do; past four tiles it is there at once, which is a zone walk, a respawn or a
teleport. **It never routes and never blocks**: it goes straight at where it should be through any
wall, has no body in `collisionWorld`, and is no `Chase`, since there is nothing it could be stopped
by. It floats `SPIRIT_HEIGHT` over the ground it stands on, which is what it is sorted and picked
by. **What it says when tapped is, in order, a beat of its story waiting here, the tip waiting at the
desk, or a line of its own about the zone**, taken in turn from `SPIRIT_ASIDES`. A beat waits for a
tap like a tip, except Wick's waking, said unasked once a world has opened (it is how a player
learns the light can be tapped). Which beat is waiting is derived (`dueBeat` in
`systems/SpiritSystem.ts`) from the beats heard, the kills and the zone the character is in: the
waking first, wherever they are, then each beat in `data/spiritBeats.ts` in its own zone, on arrival
or once its boss is down. Only what was heard is stored (`CharacterState.beats`), for the tips'
reason. **It glows while it has something to say**, `calling` being a beat or a tip waiting, and
stays `lit` a moment after it speaks; the moment it starts to glow, and a secret found, push
`{ kind: 'spirit-calls' }`, since the chime is a sound and a sound cannot poll. **Quiet is
`tips.off`**, and silences the tips alone: the story still comes. A tap on Wick is the one tap that
does not take the controls back: it ends no camp, walk, gather or target, and a counter open stays
open while the card waits for it to close.
