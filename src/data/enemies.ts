import { TILE_SIZE } from '../config/constants';
import type {
  CreatureShapeId,
  EnemyAbilityId,
  EnemyFamilyId,
  EnemyId,
  LootTableId,
} from '../types/ids';

/**
 * The collision box, in world pixels. Named here rather than measured off
 * anything drawn, for the same reason PLAYER_HALF_EXTENT is: how big a rat
 * looks is the renderer's decision and how big a rat *is* is not. The art is
 * drawn to agree with it rather than the other way round: a boss is the figure
 * grown and a goblin the figure shrunk (`art/cast.ts`), and
 * `tests/art/cast.test.ts` holds the heights.
 */
export interface BodySize {
  width: number;
  height: number;
}

export interface WanderConfig {
  radius: number;
  minPauseMs: number;
  maxPauseMs: number;
  speed: number;
}

export interface EnemyLevelStats {
  maxHp: number;
  attackPower: number;
  xpReward: number;
}

export interface EnemyDefinition {
  id: EnemyId;
  name: string;
  // Decides what the loot table is allowed to hold: only humanoids drop gear
  // and coin. Enforced by a test over LOOT_TABLES rather than by construction,
  // since the tables are hand-written data.
  family: EnemyFamilyId;
  // Which body the renderer draws it with. Separate from `family`, which is
  // what it *is*: both say 'humanoid' for the bandit, and the rat and the crab
  // are one family and two shapes.
  shape: CreatureShapeId;
  body: BodySize;
  // Whether the enemy opens combat on its own; rats only ever retaliate.
  aggressive: boolean;
  /**
   * The chance it slips a swing entirely. Only the crab has one: a scuttling,
   * armoured thing already designed as a long fight rather than a dangerous one
   * is exactly what a dodge is for, and every other row leaving it at zero is
   * what keeps this from being a tax on every fight in the game.
   */
  avoidChance?: number;
  /**
   * A named mob: one of a kind, on a long respawn, and never what an unattended
   * camp picks a fight with.
   *
   * That last part is the load-bearing half. A boss is where the unique loot
   * is, and a night of offline kills would mint sixty of whatever it carries —
   * so `AfkSystem` leaves one alone unless it has already engaged, which is the
   * one case an AFK character has no choice about.
   */
  boss?: boolean;
  // How close a wandering aggressive enemy lets the player get before
  // attacking. Only read when aggressive is true.
  aggroRadius?: number;
  base: EnemyLevelStats;
  perLevel: EnemyLevelStats;
  attackRange: number;
  attackCooldownMs: number;
  respawnDelayMs: number;
  // How far from its spawn point it will chase before giving up and resetting.
  leashRadius: number;
  chaseSpeed: number;
  lootTableId?: LootTableId;
  /**
   * What it does instead of swinging, in priority order (`data/enemyAbilities.ts`).
   *
   * A humanoid thing, and deliberately: an ability is something learned, where a
   * rat has only its teeth. That is the same line `family` already draws for
   * what a loot table may hold, and a test holds it over the table.
   */
  abilities?: EnemyAbilityId[];
  wander: WanderConfig;
}

export const ENEMIES: Record<EnemyId, EnemyDefinition> = {
  rat: {
    id: 'rat',
    name: 'Rat',
    family: 'beast',
    shape: 'quadruped',
    // Wider than a tile: the tail trails behind the body. Wide enough to
    // straddle a one-tile blocking column, which is why CollisionSystem scans
    // a cell range rather than testing four corners.
    body: { width: TILE_SIZE * 1.25, height: TILE_SIZE * 0.6 },
    aggressive: false,
    // Tuned so a fresh level 1 melee character beats a level 1 rat comfortably,
    // sweats against a level 2, and loses to a level 3 without gear or kiting.
    base: { maxHp: 20, attackPower: 3, xpReward: 5 },
    perLevel: { maxHp: 20, attackPower: 3, xpReward: 8 },
    attackRange: 64,
    attackCooldownMs: 1600,
    respawnDelayMs: 6000,
    leashRadius: 320,
    // Slower than any class's move speed, so running away is always an option.
    chaseSpeed: 150,
    lootTableId: 'rat',
    wander: {
      radius: 96,
      minPauseMs: 1500,
      maxPauseMs: 3500,
      speed: 80,
    },
  },
  crab: {
    id: 'crab',
    name: 'Crab',
    family: 'beast',
    shape: 'crustacean',
    body: { width: TILE_SIZE * 0.85, height: TILE_SIZE * 0.55 },
    aggressive: false,
    avoidChance: 0.15,
    // Tanky and slow-swinging, which is what makes the beach the zone you fight
    // while gathering: far more HP than a rat of the same level but half the
    // swing rate, so a fight is long rather than dangerous.
    base: { maxHp: 30, attackPower: 3, xpReward: 9 },
    perLevel: { maxHp: 22, attackPower: 2, xpReward: 7 },
    attackRange: 64,
    attackCooldownMs: 2000,
    respawnDelayMs: 8000,
    leashRadius: 320,
    // Scuttles: slower than the rat, so escaping is never in doubt.
    chaseSpeed: 130,
    lootTableId: 'crab',
    wander: {
      radius: 80,
      minPauseMs: 2000,
      maxPauseMs: 4500,
      speed: 60,
    },
  },
  bandit: {
    id: 'bandit',
    name: 'Bandit',
    family: 'humanoid',
    shape: 'humanoid',
    body: { width: TILE_SIZE, height: TILE_SIZE },
    // The first enemy that opens combat itself: walk too close and it swings.
    aggressive: true,
    aggroRadius: 180,
    // The dangerous end of a level 1-3 world, and the reason the camp is worth
    // the walk: it hits harder than anything else at its level and aggros on
    // sight, which is what the gear and coin on its table pay for.
    base: { maxHp: 26, attackPower: 5, xpReward: 13 },
    perLevel: { maxHp: 18, attackPower: 3, xpReward: 9 },
    attackRange: 72,
    attackCooldownMs: 1400,
    respawnDelayMs: 10000,
    leashRadius: 360,
    // Slower than any class's move speed, so fleeing an ambush always works.
    chaseSpeed: 170,
    lootTableId: 'bandit',
    // Thrown only when it cannot reach you, so kiting one is still right and no
    // longer free — and so the toe-to-toe curve is exactly where it was.
    abilities: ['throw-knife'],
    wander: {
      radius: 112,
      minPauseMs: 1200,
      maxPauseMs: 3000,
      speed: 90,
    },
  },
  /**
   * The first thing in the game above the starter band, and the first fight that
   * is about the *spawn table* rather than about the stat block.
   *
   * One goblin is a bandit with a little more of everything. Three are a
   * different question, and three is how they stand — see
   * `OLD_MILL_ROAD_MOB_SPAWNS`, which puts them in loose knots rather than
   * spread evenly across the road. The whole difficulty of the zone is not
   * pulling the second one, which is a thing a player learns by doing rather
   * than by reading a number, and it costs the arithmetic nothing.
   *
   * No ability, deliberately. The bandit already throws a knife when it cannot
   * reach you and the chief already cleaves; what this zone is teaching is
   * positioning against a group, and a telegraph on top of that would be two
   * lessons in the same fight.
   */
  'goblin-scavenger': {
    id: 'goblin-scavenger',
    name: 'Goblin Scavenger',
    family: 'humanoid',
    shape: 'humanoid',
    // Smaller than the men it robs, and drawn so: a goblin is the figure
    // shrunk (`art/cast.ts`).
    body: { width: TILE_SIZE * 0.85, height: TILE_SIZE * 0.85 },
    aggressive: true,
    // A shade wider than a bandit's 180, which is what makes a knot of three a
    // question about where you stand rather than about who you hit first.
    aggroRadius: 200,
    // Paid under what its level would say, since a knot of three dies with no
    // walk between them: what a level costs here is held in minutes of play
    // with every other zone's (decision 122).
    base: { maxHp: 24, attackPower: 4, xpReward: 12 },
    perLevel: { maxHp: 16, attackPower: 3, xpReward: 8 },
    attackRange: 68,
    attackCooldownMs: 1500,
    respawnDelayMs: 11000,
    leashRadius: 340,
    // Below every class's 320, like everything else that chases: running out of
    // a bad pull has to stay the answer, and it is the answer this zone wants.
    chaseSpeed: 175,
    lootTableId: 'goblin-scavenger',
    // Tighter than a bandit's 112, so a knot stays a knot: three discs that
    // overlapped would wander into one another and read as a single blob.
    wander: {
      radius: 96,
      minPauseMs: 1200,
      maxPauseMs: 3000,
      speed: 90,
    },
  },
  'bandit-chief': {
    id: 'bandit-chief',
    name: 'Hollis the Cutthroat',
    family: 'humanoid',
    shape: 'humanoid',
    // Half again the size of the men he leads, and drawn so: a boss is the
    // figure grown (`art/cast.ts`), so being bigger is a fact about the
    // creature that the picture agrees with.
    body: { width: TILE_SIZE * 1.4, height: TILE_SIZE * 1.4 },
    aggressive: true,
    // Wider than a bandit's, and the room he stands in is wider still: walking
    // into the chamber is not walking into him.
    aggroRadius: 220,
    boss: true,
    /**
     * The one fight in the game a level 3 character can only just win, and the
     * only thing above the 1-3 band anywhere.
     *
     * Slow and heavy rather than fast and sharp: he swings at not much over
     * half a bandit's rate and takes half a minute to chew through, which is
     * what leaves room for a cooldown, a meal, or running away. The curve is
     * written so he is already the hardest thing in the game at level 1 — he
     * only ever spawns at 4, but a boss placed anywhere else should still read
     * as one.
     *
     * Moved up when armour arrived. Mitigation makes everyone tankier, and this
     * is the one fight in the game tuned to a knife edge — at the old line a
     * geared level *2* took him, which is precisely the gate the hideout exists
     * to be. The content moves with the arithmetic rather than the other way
     * round.
     */
    base: { maxHp: 80, attackPower: 8, xpReward: 55 },
    perLevel: { maxHp: 20, attackPower: 2, xpReward: 20 },
    attackRange: 80,
    attackCooldownMs: 2200,
    // Long enough that killing him is an occasion rather than a rotation, and
    // short enough to try again after a wipe without leaving the zone.
    respawnDelayMs: 45000,
    leashRadius: 420,
    chaseSpeed: 190,
    lootTableId: 'bandit-chief',
    // The thing the fight is actually about. Standing in every Cleave loses a
    // fight a level 3 wins by stepping back from each one.
    abilities: ['cleave'],
    // Barely moves. He is what the room is for, and a boss that wandered into
    // the corridor would be pulled one bandit at a time from the doorway.
    wander: {
      radius: 64,
      minPauseMs: 2500,
      maxPauseMs: 5000,
      speed: 70,
    },
  },

  /**
   * The fen's beast, and the slowest thing in the game.
   *
   * Amphibian and heavy: more HP than a crab of the same level and a swing that
   * lands hard, on legs that cannot keep up with anyone walking away. That is
   * the whole of it — the danger is standing still, and standing still is what
   * fishing the deep pools means. It is what turns a gather down here into a
   * decision rather than a chore.
   *
   * Passive, deliberately. The raiders are what makes this zone dangerous to
   * walk through; a lurker is what makes it dangerous to *stop* in, and a beast
   * that opened on sight would collapse the two into one lesson.
   */
  'bog-lurker': {
    id: 'bog-lurker',
    name: 'Bog Lurker',
    family: 'beast',
    shape: 'quadruped',
    body: { width: TILE_SIZE * 0.9, height: TILE_SIZE * 0.7 },
    aggressive: false,
    base: { maxHp: 44, attackPower: 6, xpReward: 14 },
    perLevel: { maxHp: 24, attackPower: 3, xpReward: 9 },
    attackRange: 68,
    attackCooldownMs: 2200,
    respawnDelayMs: 12000,
    leashRadius: 300,
    // The slowest chase in the game, under even the crab's: walking away from
    // one is never in doubt, which is what lets it hit as hard as it does.
    chaseSpeed: 110,
    lootTableId: 'bog-lurker',
    wander: {
      radius: 88,
      minPauseMs: 2400,
      maxPauseMs: 5000,
      speed: 55,
    },
  },
  /**
   * The men who work the fen, and where cloth comes from.
   *
   * A goblin's build with a little more of everything and a wider reach on the
   * aggro, because out here the ground itself slows a retreat. They stand alone
   * rather than in knots: the mill road already taught pulling one at a time,
   * and what this zone teaches is that the thing worth having is behind them.
   */
  /**
   * What lives in the dark under the quarry, and the crab's idea taken one band
   * up: a long fight rather than a dangerous one.
   *
   * More HP than anything its level and a swing slower than a bog lurker's, plus
   * the only `avoidChance` in the game outside the crab — an armoured thing that
   * scuttles is exactly what a dodge is for, and it is what makes clearing a
   * working a decision about time rather than about survival.
   *
   * Passive, so the zone can be walked through by anyone. What actually stops a
   * character down here is that the seams are behind mining levels, not that the
   * things in the way will kill them — which is the whole gate the Deep Cut has.
   */
  'cave-crawler': {
    id: 'cave-crawler',
    name: 'Cave Crawler',
    family: 'beast',
    shape: 'crustacean',
    // Bigger than the crab it shares a body with, and drawn from this: a shape
    // is sized off what the creature *is* rather than the other way round.
    body: { width: TILE_SIZE, height: TILE_SIZE * 0.7 },
    aggressive: false,
    avoidChance: 0.2,
    base: { maxHp: 46, attackPower: 4, xpReward: 13 },
    perLevel: { maxHp: 26, attackPower: 2, xpReward: 8 },
    attackRange: 64,
    attackCooldownMs: 2300,
    respawnDelayMs: 9000,
    leashRadius: 300,
    chaseSpeed: 125,
    lootTableId: 'cave-crawler',
    wander: {
      radius: 72,
      minPauseMs: 2200,
      maxPauseMs: 4800,
      speed: 55,
    },
  },
  /**
   * The goblins that followed the seam down, and a scavenger with a real job.
   *
   * Harder than the one on the road west and softer than the man in the fen,
   * which is where this zone sits between the two. They stand alone rather than
   * in knots — the mill road already taught pulling one at a time, and what is
   * being taught here is that the ground itself is the gate.
   *
   * A tighter aggro than either goblin or raider, because a working is a room
   * rather than a road: a radius that reads as generous in open marsh is a
   * radius nobody can walk past underground.
   */
  'goblin-miner': {
    id: 'goblin-miner',
    name: 'Goblin Miner',
    family: 'humanoid',
    shape: 'humanoid',
    body: { width: TILE_SIZE * 0.85, height: TILE_SIZE * 0.85 },
    aggressive: true,
    aggroRadius: 190,
    base: { maxHp: 26, attackPower: 5, xpReward: 17 },
    perLevel: { maxHp: 16, attackPower: 3, xpReward: 12 },
    attackRange: 68,
    attackCooldownMs: 1500,
    respawnDelayMs: 11000,
    leashRadius: 340,
    chaseSpeed: 178,
    lootTableId: 'goblin-miner',
    wander: {
      radius: 88,
      minPauseMs: 1400,
      maxPauseMs: 3200,
      speed: 85,
    },
  },
  /**
   * What was buried in the barrow, still holding what it was buried with.
   *
   * `humanoid` on both counts, and the second one took deciding: a wight is dead,
   * and `family` is what decides whether a table may hold coin and gear. It can,
   * because a barrow is full of grave goods — the dead here were laid out with
   * their arms and their silver, which is the whole reason anybody digs one open.
   * A beast would have made this the one zone above the starter band that pays in
   * parts.
   *
   * Harder than the raider it steps up from in the way the raider was harder than
   * the goblin, and one thing besides: it is the first common creature in the
   * game carrying a telegraphed ability. The Grave Chill reaches half again as
   * far as the chief's Cleave, which is what makes two of them a question about
   * the room rather than about the arithmetic.
   */
  'barrow-wight': {
    id: 'barrow-wight',
    name: 'Barrow Wight',
    family: 'humanoid',
    shape: 'humanoid',
    body: { width: TILE_SIZE, height: TILE_SIZE },
    aggressive: true,
    // A shade under the raider's 210, and it buys the zone its whole layout:
    // every room in the barrow is sized so the stair and the respawn at its
    // foot sit outside one of these.
    aggroRadius: 200,
    /**
     * Priced against the ceiling it raises, which is the rule the fen wrote down
     * and this is the second zone to pay. The curve is quadratic and a creature's
     * reward is linear in its level, so a zone that adds a level at the previous
     * zone's rate walks straight into the limit `progression.test.ts` holds. At
     * the raider's 14 a level the climb to cap 9 would be well over it; at 18 it
     * is another session or two, which is what the cap is supposed to be.
     */
    base: { maxHp: 50, attackPower: 5, xpReward: 20 },
    perLevel: { maxHp: 18, attackPower: 4, xpReward: 18 },
    attackRange: 68,
    attackCooldownMs: 1500,
    respawnDelayMs: 13000,
    leashRadius: 340,
    chaseSpeed: 185,
    lootTableId: 'barrow-wight',
    abilities: ['grave-chill'],
    wander: {
      radius: 88,
      minPauseMs: 1600,
      maxPauseMs: 3600,
      speed: 80,
    },
  },
  /**
   * The thing at the back of the barrow, and the second named mob in the game.
   *
   * Built to the chief's shape one band up rather than to a new one, because that
   * shape worked: enormous HP on a slow swing, so the fight is long enough to
   * hold a cooldown, a meal or a retreat in, and a telegraph that decides it. What
   * is different is the reach of the telegraph. The chief's Cleave is a step back;
   * the Wail crosses most of his chamber, so the answer to it is to leave and come
   * back — which is a thing a player has to be *willing* to do, having walked
   * through four wights to get here.
   *
   * Slower to swing than the chief and far heavier, and worth more XP than
   * anything else in the world by a distance. Nothing about that matters to the
   * pacing, because a boss behind a 3% key is not something anybody grinds:
   * `progression.test.ts` measures the climb in the richest *repeatable* kill and
   * leaves him out for exactly that reason.
   */
  'barrow-king': {
    id: 'barrow-king',
    name: 'Orlath the Barrow King',
    family: 'humanoid',
    shape: 'humanoid',
    // Half again a wight, and drawn grown from it, as the chief is.
    body: { width: TILE_SIZE * 1.5, height: TILE_SIZE * 1.5 },
    aggressive: true,
    // Wider than the chief's, and the chamber he stands in is wider still:
    // walking into the room is not walking into him.
    aggroRadius: 240,
    boss: true,
    base: { maxHp: 130, attackPower: 11, xpReward: 90 },
    perLevel: { maxHp: 30, attackPower: 3, xpReward: 30 },
    attackRange: 88,
    // Slower than the chief's 2200, which is what makes room for a Wail that
    // reaches this far without the fight becoming unsurvivable between them.
    attackCooldownMs: 2400,
    // Long enough that killing him is an occasion, and short enough to try again
    // after a wipe without walking back out through the fen for a second key.
    respawnDelayMs: 60000,
    leashRadius: 440,
    chaseSpeed: 195,
    lootTableId: 'barrow-king',
    abilities: ['barrow-wail'],
    // Barely moves, like the chief. He is what the chamber is for, and a boss
    // that wandered up the spine would be pulled a wight at a time from it.
    wander: {
      radius: 64,
      minPauseMs: 2500,
      maxPauseMs: 5000,
      speed: 70,
    },
  },
  'fen-raider': {
    id: 'fen-raider',
    name: 'Fen Raider',
    family: 'humanoid',
    shape: 'humanoid',
    body: { width: TILE_SIZE, height: TILE_SIZE },
    aggressive: true,
    aggroRadius: 210,
    base: { maxHp: 30, attackPower: 5, xpReward: 18 },
    perLevel: { maxHp: 19, attackPower: 4, xpReward: 14 },
    attackRange: 68,
    attackCooldownMs: 1500,
    respawnDelayMs: 12000,
    leashRadius: 340,
    chaseSpeed: 180,
    lootTableId: 'fen-raider',
    wander: {
      radius: 104,
      minPauseMs: 1200,
      maxPauseMs: 3000,
      speed: 90,
    },
  },
};
