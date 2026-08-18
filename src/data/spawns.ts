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
  { dx: 256, dy: 160, enemyId: 'goblin-scavenger', level: 4 },
  { dx: 352, dy: 288, enemyId: 'goblin-scavenger', level: 4 },
  { dx: 224, dy: 352, enemyId: 'goblin-scavenger', level: 4 },
  // The middle knot, north of the road and east of the mill yard.
  /**
   * The north-east knot, which used to be the north-west one.
   *
   * It has moved twice for two different rules and the second undid the first.
   * Clearing the middle of the map for a respawn pushed it north; opening the
   * road to Greyford then made that north edge a strip anybody can arrive on,
   * and two of the three were standing in it. West was no good either — the mill
   * and its pond take that corner, and the far knot is close enough that a third
   * one in between would read as six.
   *
   * A knot moves as a knot or it stops being one, which is the whole reason all
   * three offsets change together rather than the two that broke.
   */
  { dx: 256, dy: -288, enemyId: 'goblin-scavenger', level: 4 },
  { dx: 480, dy: -288, enemyId: 'goblin-scavenger', level: 4 },
  { dx: 416, dy: -96, enemyId: 'goblin-scavenger', level: 4 },
  // The far knot, past the mill, and the only level 5s in the world.
  { dx: -640, dy: 192, enemyId: 'goblin-scavenger', level: 5 },
  { dx: -512, dy: 288, enemyId: 'goblin-scavenger', level: 5 },
  { dx: -608, dy: 384, enemyId: 'goblin-scavenger', level: 5 },
];

/**
 * The stand of old timber the road west finally has a reason to grow.
 *
 * Off in the north-east and south-east corners, clear of all three goblin knots
 * and of the mill: what a woodcutter walks out here for should not be standing
 * inside the fight the zone is otherwise about, since a channel is broken by
 * being hit and a tree inside a knot is a tree nobody finishes.
 */
export const OLD_MILL_ROAD_NODE_SPAWNS: NodeSpawnPoint[] = [
  { dx: 448, dy: -320, nodeId: 'hardwood' },
  { dx: 576, dy: -224, nodeId: 'hardwood' },
  { dx: 352, dy: -416, nodeId: 'hardwood' },
  { dx: 512, dy: 320, nodeId: 'hardwood' },
  { dx: 640, dy: 224, nodeId: 'hardwood' },
];

/**
 * The Deep Cut's eleven, and the thing about this zone that is *not* the fen's
 * idea again: nothing aggressive stands between the way in and the hall.
 *
 * The gallery is the whole south edge, which is where a traveller materialises —
 * anywhere along it, at whatever fraction they crossed the quarry's north edge
 * at. Everything that opens a fight on its own is up in the workings, so walking
 * in is walking in. What is down here instead is a crawler or two, which is the
 * zone introducing itself: passive, armoured and slow, and the first thing a
 * player learns about the Deep Cut is that its residents are a way to spend time
 * rather than a way to die.
 *
 * The levels climb with depth for the same reason the quarry's do — the road in
 * is the south edge, so distance from it is the dial — and the miners hold the
 * far ends of both workings, standing over the rich seams they are cutting.
 */
export const DEEP_CUT_MOB_SPAWNS: MobSpawnPoint[] = [
  // The gallery, where the road up comes in.
  { dx: -448, dy: 448, enemyId: 'cave-crawler', level: 5 },
  { dx: 448, dy: 448, enemyId: 'cave-crawler', level: 5 },
  // The hall.
  { dx: -64, dy: 128, enemyId: 'cave-crawler', level: 5 },
  { dx: 128, dy: 0, enemyId: 'cave-crawler', level: 5 },
  // The near ends of the two workings.
  { dx: -448, dy: 0, enemyId: 'goblin-miner', level: 5 },
  { dx: 448, dy: -64, enemyId: 'goblin-miner', level: 5 },
  { dx: 320, dy: -128, enemyId: 'goblin-miner', level: 6 },
  { dx: -320, dy: -192, enemyId: 'cave-crawler', level: 6 },
  { dx: 256, dy: -320, enemyId: 'cave-crawler', level: 6 },
  // The faces themselves, each with a goblin standing over the rich seam.
  { dx: -448, dy: -320, enemyId: 'goblin-miner', level: 6 },
  { dx: 576, dy: -384, enemyId: 'goblin-miner', level: 6 },
];

/**
 * The seams, and the whole of what the zone is gated by.
 *
 * The coal is in the hall and at the near end of each working, and the rich iron
 * is at the back of both — so the deeper a seam is, the higher the level that
 * opens it, which is the quarry's own arrangement one zone down. Nothing here
 * needs a key: what stops a character at the mouth of a working is the pick in
 * their hands, and `tests/systems/deepCut.test.ts` is what holds that.
 */
export const DEEP_CUT_NODE_SPAWNS: NodeSpawnPoint[] = [
  { dx: -128, dy: 192, nodeId: 'coal-vein' },
  { dx: 128, dy: 64, nodeId: 'coal-vein' },
  { dx: -576, dy: 0, nodeId: 'coal-vein' },
  { dx: 512, dy: -64, nodeId: 'coal-vein' },
  { dx: -576, dy: -320, nodeId: 'rich-iron-vein' },
  { dx: 448, dy: -384, nodeId: 'rich-iron-vein' },
];

// All inside the dirt clearing (see banditCampMap.ts), far enough east that
// arriving from town never lands inside an aggro radius.
export const BANDIT_CAMP_MOB_SPAWNS: MobSpawnPoint[] = [
  { dx: 224, dy: -224, enemyId: 'bandit', level: 1 },
  { dx: 256, dy: 192, enemyId: 'bandit', level: 1 },
  { dx: 384, dy: 0, enemyId: 'bandit', level: 1 },
  { dx: 480, dy: -224, enemyId: 'bandit', level: 2 },
  { dx: 512, dy: 224, enemyId: 'bandit', level: 2 },
  { dx: 512, dy: 0, enemyId: 'bandit', level: 3 },
];

// Inside the hideout: the entrance hall is left clear so arriving is not an
// ambush, and everything stands in the chamber beyond the corridor. Same 1-3
// band as everywhere else — what makes this worth the key is what drops here,
// not what it takes to survive.
// The one exception to the levels above: the chief is level 4, the only thing
// anywhere above the starter band, and he stands at the back of the chamber so
// the men in front of him are fought first.
export const BANDIT_HIDEOUT_MOB_SPAWNS: MobSpawnPoint[] = [
  { dx: 192, dy: -256, enemyId: 'bandit', level: 2 },
  { dx: 288, dy: -64, enemyId: 'bandit', level: 2 },
  { dx: 192, dy: 256, enemyId: 'bandit', level: 3 },
  { dx: 288, dy: 96, enemyId: 'bandit', level: 3 },
  { dx: 448, dy: 0, enemyId: 'bandit-chief', level: 4 },
];

/**
 * The fen's eleven, and the one thing about this zone a later edit could delete
 * without any other test noticing: **the level climbs the further south you
 * go.**
 *
 * The road in is along the north edge, so depth is the difficulty dial — a
 * character who has walked down from the beach meets fives, and the sevens are
 * as far from the way out as the map allows. It is the quarry's idea pointed
 * along a different axis, and it is what makes retreating north mean something.
 *
 * Raiders and lurkers are interleaved rather than zoned, because the two are
 * different questions: the raider is what stops you walking through, the lurker
 * is what stops you standing still. Sorting them into halves would let a player
 * answer one at a time.
 */
export const BLACKWATER_FEN_MOB_SPAWNS: MobSpawnPoint[] = [
  // Moved out to 365 units from the middle of the map, which is past its own
  // aggro radius and its wander disc together. At dy -32 it stood 71 from the
  // centre — and the centre is where a death respawns you and where travelling
  // by map puts you down, so dying in the fen dropped you straight back into
  // melee with a level 5. The rule it broke is one `CLAUDE.md` states about
  // every zone: the spawn point is safe by construction. It was not.
  { dx: -224, dy: -288, enemyId: 'fen-raider', level: 5 },
  { dx: -320, dy: -224, enemyId: 'bog-lurker', level: 5 },
  { dx: 352, dy: -160, enemyId: 'bog-lurker', level: 5 },
  { dx: 448, dy: -64, enemyId: 'fen-raider', level: 5 },
  // Every raider stands north of dy 302 now, and that number is the whole of
  // what the road on to the barrow cost this zone. An arrival lands 1.5 tiles
  // inside the south edge at whatever fraction of it was crossed — so it lands
  // at *every* x, and the only thing that can hold a creature clear of a strip
  // spanning the map is distance up the map. The lurkers stay deep because they
  // are passive: what the rule refuses is materialising already inside a fight.
  { dx: -544, dy: 64, enemyId: 'fen-raider', level: 6 },
  { dx: -96, dy: 96, enemyId: 'bog-lurker', level: 6 },
  { dx: 416, dy: 128, enemyId: 'bog-lurker', level: 6 },
  { dx: -160, dy: 288, enemyId: 'fen-raider', level: 7 },
  { dx: 352, dy: 288, enemyId: 'fen-raider', level: 7 },
  { dx: -192, dy: 416, enemyId: 'bog-lurker', level: 7 },
  { dx: 96, dy: 448, enemyId: 'bog-lurker', level: 7 },
];

/**
 * The barrow's nine, and the hideout's shape read one band up: trash in front,
 * the named thing at the back, and nothing at all standing on the way in.
 *
 * Depth is the dial, the same as the fen above it — the mouth is the north edge,
 * so the sevens hold the antechamber and the transept and the eights are down in
 * the king's chamber with him. The mouth itself is empty, which is the rule the
 * hideout's entrance hall set and the Deep Cut's gallery kept: a traveller
 * materialises anywhere along that edge, and a locked door with an ambush behind
 * it is a trap rather than a zone.
 *
 * Nothing stands in the transept's own arms either. They are the flooded corners
 * of the map (see `sunkenBarrowMap.ts`), and a wight pinned against standing
 * water in a game with no pathfinding is a wight nobody can pull.
 */
export const SUNKEN_BARROW_MOB_SPAWNS: MobSpawnPoint[] = [
  // The antechamber, met on the way down and deliberately not at its middle:
  // the stair comes in there, and the stair is where anyone who wants out goes.
  { dx: -288, dy: -224, enemyId: 'barrow-wight', level: 7 },
  { dx: 288, dy: -224, enemyId: 'barrow-wight', level: 7 },
  // The transept, one either side of the spine.
  { dx: -384, dy: 32, enemyId: 'barrow-wight', level: 7 },
  { dx: 384, dy: 32, enemyId: 'barrow-wight', level: 7 },
  // The king's chamber. Four of them between the way in and him, which is what
  // the room is for — he is fought last or he is fought with company.
  { dx: -256, dy: 256, enemyId: 'barrow-wight', level: 8 },
  { dx: 256, dy: 256, enemyId: 'barrow-wight', level: 8 },
  { dx: -192, dy: 384, enemyId: 'barrow-wight', level: 8 },
  { dx: 192, dy: 384, enemyId: 'barrow-wight', level: 8 },
  { dx: 0, dy: 448, enemyId: 'barrow-king', level: 8 },
];

/**
 * The three deep pools, and the second thing here nothing else holds: **every
 * one of them is inside a raider's aggro radius.**
 *
 * The fen exists to supply the food that makes the levels above the starter
 * band survivable, and the whole design of it is that the food is behind the
 * fight rather than beside it — you cannot stand and fish the best heal in the
 * game without first clearing the man standing over the pool. Spread these out
 * into open marsh and the zone becomes a quiet fishing hole with some raiders
 * elsewhere in it, which is a different and much worse zone.
 *
 * They sit two rows further north than they shipped, and the guard is what moved
 * them rather than the water: opening the road on to the barrow made the south
 * edge an arrival strip, which no raider may stand within its aggro radius of.
 * A pool the raiders had to leave is a pool nobody is standing over.
 *
 * Each sits on its pool's *edge* rather than in the middle of it. A fishing spot
 * stands on blocking water by design, so what has to be true is that there is
 * somewhere to stand within its interact radius — and the middle of a four-tile
 * pool is two tiles from the nearest bank, which is a spot drawn in the water
 * that nobody can ever work.
 */
export const BLACKWATER_FEN_NODE_SPAWNS: NodeSpawnPoint[] = [
  { dx: -576, dy: 192, nodeId: 'deep-fishing-spot' },
  { dx: 0, dy: 192, nodeId: 'deep-fishing-spot' },
  { dx: 256, dy: 192, nodeId: 'deep-fishing-spot' },
];
