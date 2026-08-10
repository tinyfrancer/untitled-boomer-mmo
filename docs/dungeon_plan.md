# Dungeon and casting — running status

Five stacked PRs off the brief in `docs/feature_12_dungeon.txt`. One feature each, in dependency
order: travel goes first because the dungeon needs somewhere to be reached from, and the boss needs
the dungeon to stand in.

Each PR stands alone — it ships green, with no dead buttons and no half-wired surface.

| #   | PR                                              | State             |
| --- | ----------------------------------------------- | ----------------- |
| 1   | Zones as a graph, and travel from the world map | merged 2026-08-09 |
| 2   | Locked zones, the key, and the Bandit Hideout   | merged 2026-08-09 |
| 3   | The boss and its unique loot                    | merged 2026-08-10 |
| 4   | Cast times, and what interrupts them            | in review         |
| 5   | Enemy abilities                                 | not started       |

## The decision behind all of it: zones, not one continuous world

Asked and answered before any of this was written. One large map with instanced dungeons was the
alternative, and it is a renderer project rather than a content one:

- The ground is a **single vertex-coloured mesh** built from the whole tile grid (`render3d/ground.ts`).
  Three zones merged is ~1,425 tiles against today's 475, uploaded at once, with no chunking or
  streaming to add it to.
- **Every mob ticks every frame.** `ZoneWorld.update` walks `mobs` with no distance culling.
- **The teardown seam is load-bearing and tested.** "A zone change is a view rebuild" is checked in
  smoke against `renderer.info.memory` across three round trips. One map deletes that seam and
  replaces it with chunk streaming: the same leak risk with no natural place to test it.
- **AFK is defined per zone.** `AfkSession` stores a `zoneId` and `campQuarry`/`campNode` read that
  zone's spawn tables; on one map that becomes a spatial query.

And the decisive one: **a dungeon is an instance either way**, so the Bandit Hideout does not need
the change. What one big map actually buys — travel that feels connected rather than like walking
into an invisible wall — is bought here by PR 1 instead, for none of the risk.

Zones are a data table, so this is not a door that closes: merging them later rewrites the ground
mesh and the camera, not the game rules.

## 1 — Zones as a graph, and travel from the world map

The map sheet zooms out. `worldMap()` derives the whole layout from the exits already in `ZONES` —
BFS from town, placing each neighbour by the edge that reaches it — so there is no hand-placed
coordinate to drift out of step with where the exits actually go, and a zone added to the table
appears on the map with nothing else written down. A zone's level band is derived the same way, off
its own `mobSpawns`.

Travel is what the zoomed-out view is for: tap a zone to go there. Not in combat, which is the one
rule that keeps it from being an escape hatch out of a fight the player is losing.

## 3 — The boss and its unique loot

Hollis the Cutthroat, level 4, at the back of the hideout chamber: the only thing anywhere above
the 1-3 band, and the first fight gated on the level rather than on the kit. A level 3 in what the
camp outside drops takes him; a level 2 in the same gear does not.

He is slow and heavy rather than fast and sharp — a bandit's damage at not much over half its swing
rate, on four times the HP — so the fight runs long enough for a cooldown, a meal, or a retreat.
Drawn from the same data: the figure is scaled by `body.width / TILE_SIZE`, and he is the first
creature to take a look of his own rather than his shape's.

Three items exist on his table and nowhere else. The bandana always drops and is cloth, so the
trophy is the same trophy whoever took it; the blade and the stolen wand are the chase, one per
class. Uniqueness is not a flag — it is every other table not naming them, which is what
`tests/systems/uniqueLoot.test.ts` is for.

`boss: true` is a rule rather than a label: an unattended camp never picks a fight with one, awake
or offline, because a night parked beside him would mint sixty of the only loot in the game worth
making a trip for. It is still answered once it engages.

## 4 — Cast times, and what interrupts them

`castTimeMs` on an ability, run by `AbilityCaster` off the tick. Fireball takes 1400ms; Mana Shield
stays instant, being the thing you press once you are already in trouble, and both physical
abilities are instant because they are swings.

Everything is committed at the press — mana, cooldown — and resolved at the end, so an interrupted
cast costs the lot and delivers nothing. That is the same bargain the fizzle already made, and it
is what gives the window weight. The fizzle roll and the range check both move to the end, because
both are questions about the moment the spell lands.

Moving breaks a cast, read off the player rather than pushed in, so every way there is to move
breaks one without knowing a cast exists. Being _hurt_ breaks one — a hit the mana shield eats does
not, which is the second thing the shield is for.

The gather bar became the channel bar in the commit before, since a gather and a cast are the same
shape and can never both be running.
