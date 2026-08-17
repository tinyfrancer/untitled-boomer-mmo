import type { EnemyId, ResourceNodeId } from '../types/ids';

export interface MobSpawnPoint {
  dx: number;
  dy: number;
  enemyId: EnemyId;
  level: number;
}

export interface NodeSpawnPoint {
  dx: number;
  dy: number;
  nodeId: ResourceNodeId;
}

// Offsets from the world center. Each point's level is fixed rather than rolled
// so a camp keeps the same difficulty across respawns, and the distribution
// (more level 1 than 2, more 2 than 3) is a property of the table itself.
// Levels climb with distance from town center, so wandering out is the risk.
export const TOWN_MOB_SPAWNS: MobSpawnPoint[] = [
  /**
   * Out along the roads and into the corners, which is what the buildings left.
   *
   * Two rules put them where they are, and the second one arrived with the
   * shopfronts. A rat's whole 96-unit wander disc has to stay off the counters —
   * they stood at ±192 once, which put the banker and the shopkeeper *inside*
   * it, and a creature at a counter's shoulder cannot be tapped at all: the
   * camera is south of the player, so the ray in to a rat passes low over the
   * ground just short of it, and a person standing there is crossed first. NPCs
   * outrank mobs in `pickTap` deliberately (a rat in front of the shopkeeper
   * must not stop you shopping), so what has to give is the spacing.
   *
   * The disc has to stay out of the **buildings** too, and that one is about
   * seeing rather than tapping: a rat behind the general store is a rat drawn
   * inside a wall, and nothing fades a building the player is not standing
   * behind. `tests/render3d/picking.test.ts` sweeps the first and
   * `tests/systems/BuildingSystem.test.ts` the second.
   */
  { dx: 0, dy: 224, enemyId: 'rat', level: 1 },
  { dx: -160, dy: 384, enemyId: 'rat', level: 1 },
  { dx: -736, dy: 128, enemyId: 'rat', level: 1 },
  // A notch east of where it stood, which is what the smithy cost it when the
  // road west opened and the forge moved up into this corner.
  { dx: -192, dy: -448, enemyId: 'rat', level: 1 },
  { dx: 256, dy: -448, enemyId: 'rat', level: 1 },
  { dx: -608, dy: 480, enemyId: 'rat', level: 2 },
  { dx: 640, dy: -320, enemyId: 'rat', level: 2 },
  { dx: 448, dy: 448, enemyId: 'rat', level: 2 },
  { dx: -704, dy: -448, enemyId: 'rat', level: 3 },
];

// Same offsets-from-center convention as the mob spawns. Trees cluster into a
// grove in the south-west; the fishing spots sit on the water itself, in the
// pond's northern row (see POND in townMap.ts). The player can't walk onto
// water, so they are fished from the shore — which is what the node's
// interactRadius, wider than a tile, is sized for.
export const TOWN_NODE_SPAWNS: NodeSpawnPoint[] = [
  // Pushed a row south of where they stood, which is what the cottage on the
  // south side of the street cost them: a tree inside a wall is drawn inside it
  // and chopped through it.
  { dx: -608, dy: 352, nodeId: 'tree' },
  { dx: -480, dy: 320, nodeId: 'tree' },
  { dx: -352, dy: 384, nodeId: 'tree' },
  { dx: -544, dy: 384, nodeId: 'tree' },
  { dx: 384, dy: 192, nodeId: 'fishing-spot' },
  { dx: 544, dy: 192, nodeId: 'fishing-spot' },
];

// Crabs live on the sand band (see beachMap.ts), away from the grass strip
// where the road from town arrives. Same weighting-by-level idea as the rats:
// every zone is level 1-3, so which one to visit is a question of what you
// need — parts, food, ore, or gear — rather than what you can survive.
export const BEACH_MOB_SPAWNS: MobSpawnPoint[] = [
  { dx: -384, dy: 32, enemyId: 'crab', level: 1 },
  { dx: 64, dy: 128, enemyId: 'crab', level: 1 },
  { dx: 384, dy: 0, enemyId: 'crab', level: 1 },
  { dx: -192, dy: 256, enemyId: 'crab', level: 2 },
  { dx: 256, dy: 288, enemyId: 'crab', level: 2 },
  { dx: 576, dy: 224, enemyId: 'crab', level: 3 },
];

// On the ocean's northern row, fished from the shore like the town pond.
export const BEACH_NODE_SPAWNS: NodeSpawnPoint[] = [
  { dx: -256, dy: 384, nodeId: 'ocean-fishing-spot' },
  { dx: 64, dy: 384, nodeId: 'ocean-fishing-spot' },
  { dx: 384, dy: 384, nodeId: 'ocean-fishing-spot' },
];

// The rats that got in among the spoil heaps. Same 1-3 band as everywhere else
// and the same weighting, and they climb with depth rather than with distance
// from the middle: the road in is along the south edge, so the further north the
// cut goes the less anyone should want to be standing there with a pickaxe out.
//
// Nothing new lives here, on purpose. What makes the quarry worth the walk is
// the only two veins in the world, not a creature — the same argument that has
// the beach's crabs paying in food rather than in coin.
export const QUARRY_MOB_SPAWNS: MobSpawnPoint[] = [
  { dx: -96, dy: 224, enemyId: 'rat', level: 1 },
  { dx: -320, dy: 96, enemyId: 'rat', level: 1 },
  { dx: 352, dy: 128, enemyId: 'rat', level: 1 },
  { dx: -448, dy: -96, enemyId: 'rat', level: 2 },
  { dx: 480, dy: -32, enemyId: 'rat', level: 2 },
  { dx: 128, dy: -320, enemyId: 'rat', level: 3 },
];

// Tin across the open floor and iron hard against the face at the back, which
// is the same shape the pond and the ocean make: the gated one is further from
// where you come in, so the level that opens it is earned on the walk to it.
export const QUARRY_NODE_SPAWNS: NodeSpawnPoint[] = [
  { dx: -416, dy: -160, nodeId: 'tin-vein' },
  { dx: -160, dy: -288, nodeId: 'tin-vein' },
  { dx: 192, dy: -224, nodeId: 'tin-vein' },
  { dx: 448, dy: -128, nodeId: 'tin-vein' },
  { dx: -64, dy: -384, nodeId: 'iron-vein' },
  { dx: 320, dy: -384, nodeId: 'iron-vein' },
];

/**
 * Three knots of three, and the knots are the whole design of the zone.
 *
 * Everywhere else in the game a spawn list is a spread: rats and crabs and
 * bandits stand far enough apart that a fight is a fight. These stand close
 * enough that a careless pull is two goblins and a bad one is three, which is
 * the first time the *table* rather than the stat block is what makes something
 * hard. `ENEMIES` says a goblin is a bandit with a little more of everything;
 * this says there are three of them.
 *
 * They climb westward rather than outward from the middle, because the road
 * from town arrives on the east edge — so the first knot is met at level 4 with
 * a way back one screen behind, and the level 5 knot is the far end of the walk.
 * The east half is left deliberately empty for the same reason the bandit camp's
 * is: arriving must never land inside an aggro radius, and a goblin's is wider
 * than anything else in the game.
 */
export const OLD_MILL_ROAD_MOB_SPAWNS: MobSpawnPoint[] = [
  // The near knot, south of the road, met on the way in.
  { dx: 192, dy: 96, enemyId: 'goblin-scavenger', level: 4 },
  { dx: 288, dy: 224, enemyId: 'goblin-scavenger', level: 4 },
  { dx: 160, dy: 288, enemyId: 'goblin-scavenger', level: 4 },
  // The middle knot, north of the road and east of the mill yard.
  { dx: -128, dy: -288, enemyId: 'goblin-scavenger', level: 4 },
  { dx: 0, dy: -352, enemyId: 'goblin-scavenger', level: 4 },
  { dx: -96, dy: -160, enemyId: 'goblin-scavenger', level: 4 },
  // The far knot, past the mill, and the only level 5s in the world.
  { dx: -640, dy: 192, enemyId: 'goblin-scavenger', level: 5 },
  { dx: -512, dy: 288, enemyId: 'goblin-scavenger', level: 5 },
  { dx: -608, dy: 384, enemyId: 'goblin-scavenger', level: 5 },
];

// All inside the dirt clearing (see banditCampMap.ts), far enough east that
// arriving from town never lands inside an aggro radius.
export const BANDIT_CAMP_MOB_SPAWNS: MobSpawnPoint[] = [
  { dx: 160, dy: -160, enemyId: 'bandit', level: 1 },
  { dx: 192, dy: 160, enemyId: 'bandit', level: 1 },
  { dx: 384, dy: 0, enemyId: 'bandit', level: 1 },
  { dx: 480, dy: -224, enemyId: 'bandit', level: 2 },
  { dx: 512, dy: 224, enemyId: 'bandit', level: 2 },
  { dx: 576, dy: 0, enemyId: 'bandit', level: 3 },
];

// Inside the hideout: the entrance hall is left clear so arriving is not an
// ambush, and everything stands in the chamber beyond the corridor. Same 1-3
// band as everywhere else — what makes this worth the key is what drops here,
// not what it takes to survive.
// The one exception to the levels above: the chief is level 4, the only thing
// anywhere above the starter band, and he stands at the back of the chamber so
// the men in front of him are fought first.
export const BANDIT_HIDEOUT_MOB_SPAWNS: MobSpawnPoint[] = [
  { dx: 160, dy: -224, enemyId: 'bandit', level: 2 },
  { dx: 288, dy: -64, enemyId: 'bandit', level: 2 },
  { dx: 160, dy: 224, enemyId: 'bandit', level: 3 },
  { dx: 288, dy: 96, enemyId: 'bandit', level: 3 },
  { dx: 448, dy: 0, enemyId: 'bandit-chief', level: 4 },
];
