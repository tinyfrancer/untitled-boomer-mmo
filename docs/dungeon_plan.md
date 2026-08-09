# Dungeon and casting — running status

Five stacked PRs off the brief in `docs/feature_12_dungeon.txt`. One feature each, in dependency
order: travel goes first because the dungeon needs somewhere to be reached from, and the boss needs
the dungeon to stand in.

Each PR stands alone — it ships green, with no dead buttons and no half-wired surface.

| #   | PR                                              | State             |
| --- | ----------------------------------------------- | ----------------- |
| 1   | Zones as a graph, and travel from the world map | merged 2026-08-09 |
| 2   | Locked zones, the key, and the Bandit Hideout   | merged 2026-08-09 |
| 3   | The boss and its unique loot                    | not started       |
| 4   | Cast times, and what interrupts them            | not started       |
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
