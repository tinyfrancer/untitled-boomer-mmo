import { beforeAll, describe, expect, it } from 'vitest';
import { MAX_CHARACTER_LEVEL } from '../../src/config/constants';
import { SHOP_STOCK } from '../../src/data/shop';
import type { Gear } from '../../src/systems/InventorySystem';
import type { ClassId, ItemId, ZoneId } from '../../src/types/ids';
import { playToNextLevel, type PaceResult } from './pace';

/**
 * How long the climb takes, in minutes of play (decision 122): about five
 * minutes from level 1 to 2, a minute more each level after, and twelve from 8
 * to the cap — every class, in the zone and the kit meant for the level.
 *
 * Measured by playing it (`pace.ts`), because what a level costs in kills says
 * nothing about how long a kill takes, and the rebuilt zones moved exactly
 * that. Each class plays each level twice on different dice and is held on the
 * mean, inside a band wide enough for a bot's luck and narrow enough that a
 * level twice as long as asked fails.
 */

const minutesFor = (level: number): number => level + 4;

/** What a class wears for a level: the starting kit, then what the zones before it drop. */
type Kit = Record<ClassId, Partial<Gear>>;

const STARTING: Kit = { warrior: {}, wizard: {}, ranger: {} };
const CAMP: Kit = {
  warrior: {
    helmet: 'brown-helmet',
    chest: 'brown-chestplate',
    pants: 'brown-legs',
    weapon: 'brown-axe',
    offhand: 'brown-shield',
  },
  wizard: {
    helmet: 'brown-cloth-hat',
    chest: 'brown-robe',
    pants: 'brown-cloth-pants',
    offhand: 'apprentice-orb',
  },
  ranger: {
    helmet: 'brown-helmet',
    chest: 'brown-chestplate',
    pants: 'brown-legs',
    weapon: 'hunting-bow',
  },
};
const ROAD: Kit = {
  warrior: {
    helmet: 'studded-helmet',
    chest: 'studded-jerkin',
    pants: 'studded-legs',
    weapon: 'cutthroats-blade',
    offhand: 'brown-shield',
  },
  wizard: { ...CAMP.wizard, weapon: 'stolen-staff' },
  ranger: {
    helmet: 'studded-helmet',
    chest: 'studded-jerkin',
    pants: 'studded-legs',
    weapon: 'poachers-bow',
    offhand: 'studded-quiver',
  },
};
const FEN: Kit = {
  warrior: {
    helmet: 'iron-helmet',
    chest: 'iron-chestplate',
    pants: 'iron-legs',
    weapon: 'cutthroats-blade',
    offhand: 'brown-shield',
  },
  wizard: {
    helmet: 'fenweave-hood',
    chest: 'fenweave-robe',
    pants: 'fenweave-leggings',
    weapon: 'stolen-staff',
    offhand: 'apprentice-orb',
  },
  ranger: {
    helmet: 'fenhide-cowl',
    chest: 'fenhide-vest',
    pants: 'fenhide-leggings',
    weapon: 'poachers-bow',
    offhand: 'studded-quiver',
  },
};
const BARROW: Kit = {
  ...FEN,
  warrior: {
    helmet: 'steel-helmet',
    chest: 'steel-chestplate',
    pants: 'steel-legs',
    weapon: 'cutthroats-blade',
    offhand: 'steel-shield',
  },
};

interface Band {
  level: number;
  zoneId: ZoneId;
  kit: Kit;
  /** Carried in: the shelf's ration once there is coin for one. */
  food: Partial<Record<ItemId, number>>;
  /** Logs for a fire, once there is coin for those. */
  logs: number;
}

/**
 * The way up. A new character has nothing to eat and nothing to light; by the
 * strand the first quest has paid for logs, and from the camp on the shelf's
 * ration is carried in, the crab once the fen hits too hard for a fish, and
 * more of it into the barrow, which feeds nobody and whose wights come one at a
 * time (C11), so a level there is eaten through rather than died through.
 */
const BANDS: Band[] = [
  { level: 1, zoneId: 'town', kit: STARTING, food: {}, logs: 0 },
  { level: 2, zoneId: 'beach', kit: STARTING, food: {}, logs: 10 },
  { level: 3, zoneId: 'bandit-camp', kit: CAMP, food: { 'cooked-fish': 20 }, logs: 10 },
  { level: 4, zoneId: 'old-mill-road', kit: CAMP, food: { 'cooked-fish': 20 }, logs: 10 },
  { level: 5, zoneId: 'old-mill-road', kit: ROAD, food: { 'cooked-fish': 20 }, logs: 10 },
  { level: 6, zoneId: 'blackwater-fen', kit: FEN, food: { 'cooked-crab': 20 }, logs: 10 },
  { level: 7, zoneId: 'blackwater-fen', kit: BARROW, food: { 'cooked-crab': 20 }, logs: 10 },
  { level: 8, zoneId: 'sunken-barrow', kit: BARROW, food: { 'cooked-crab': 30 }, logs: 10 },
];

const CLASSES: ClassId[] = ['warrior', 'wizard', 'ranger'];
const SEEDS = [1, 7];

/** Every class's two runs at every level, played once for the whole file. */
const runs = new Map<string, PaceResult[]>();
const key = (classId: ClassId, level: number): string => `${classId}@${level}`;
const resultsFor = (classId: ClassId, level: number): PaceResult[] =>
  runs.get(key(classId, level)) ?? [];
const mean = (values: number[]): number =>
  values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
const minutes = (classId: ClassId, level: number): number =>
  mean(resultsFor(classId, level).map((run) => run.ms)) / 60000;

beforeAll(() => {
  for (const band of BANDS) {
    for (const classId of CLASSES) {
      runs.set(
        key(classId, band.level),
        SEEDS.map((seed) =>
          playToNextLevel({
            zoneId: band.zoneId,
            classId,
            level: band.level,
            gear: band.kit[classId],
            food: band.food,
            logs: band.logs,
            seed,
          }),
        ),
      );
    }
  }
}, 600000);

/** What the levels from `first` up to but not including `last` took a class. */
const took = (classId: ClassId, first: number, last: number): number =>
  BANDS.filter((band) => band.level >= first && band.level < last).reduce(
    (sum, band) => sum + minutes(classId, band.level),
    0,
  );
const asked = (first: number, last: number): number =>
  BANDS.filter((band) => band.level >= first && band.level < last).reduce(
    (sum, band) => sum + minutesFor(band.level),
    0,
  );

describe('a level, in minutes of play', () => {
  it('is measured at every level from 1 to the cap', () => {
    expect(BANDS.map((band) => band.level)).toEqual(
      Array.from({ length: MAX_CHARACTER_LEVEL - 1 }, (_, index) => index + 1),
    );
  });

  it.each(BANDS.map((band) => [band.level, band.zoneId] as const))(
    'takes about the minutes asked of level %i, in %s, for every class',
    (level) => {
      for (const classId of CLASSES) {
        expect(
          resultsFor(classId, level).every((run) => run.levelled),
          `${classId} levels`,
        ).toBe(true);
        const ratio = minutes(classId, level) / minutesFor(level);
        expect(ratio, `${classId} at ${level}`).toBeGreaterThan(0.6);
        expect(ratio, `${classId} at ${level}`).toBeLessThan(1.5);
      }
    },
  );
});

/**
 * The arcs `progression.test.ts` builds out of kills and XP, held here in the
 * time they take. That file says the starter arc's quests and gear land a
 * character on level 3, and that the chain above it rides a climb the fighting
 * makes; this says how long each is.
 */
describe('the arcs, in minutes of play', () => {
  const ARC_END = 3;

  // The quests pay XP on top of this, so the arc as played is no longer than
  // the grind to its level, which is what is measured.
  it('makes the starter arc about ten minutes of fighting, for every class', () => {
    for (const classId of CLASSES) {
      const ratio = took(classId, 1, ARC_END) / asked(1, ARC_END);
      expect(ratio, classId).toBeGreaterThan(0.75);
      expect(ratio, classId).toBeLessThan(1.4);
    }
  });

  /**
   * Max level is an achievement rather than an asymptote: the climb past the
   * arc is more than the arc, so the cap is earned rather than fallen into, and
   * a small multiple of it, so it is the rest of an evening rather than another
   * game. At the old cap of ten it was thirteen times the arc, for six levels
   * with nothing in them.
   */
  it('makes the climb past it a few arcs long rather than another game', () => {
    for (const classId of CLASSES) {
      const ratio = took(classId, ARC_END, MAX_CHARACTER_LEVEL) / took(classId, 1, ARC_END);
      expect(ratio, classId).toBeGreaterThan(2);
      expect(ratio, classId).toBeLessThan(8);
    }
  });

  // The user's "about an hour" (decision 122): 5 + 6 + … + 12 is 68 minutes.
  it('is about an hour from level 1 to the cap, for every class', () => {
    for (const classId of CLASSES) {
      const ratio = took(classId, 1, MAX_CHARACTER_LEVEL) / asked(1, MAX_CHARACTER_LEVEL);
      expect(ratio, classId).toBeGreaterThan(0.75);
      expect(ratio, classId).toBeLessThan(1.3);
    }
  });
});

describe('the time between fights', () => {
  /**
   * Food is the answer to the wait (decision 122), so once there is a meal to
   * carry, standing still for regen is the exception rather than most of the
   * session, which is what it was.
   */
  it('spends little of a level resting once there is food to carry', () => {
    for (const band of BANDS.filter((candidate) => candidate.logs > 0)) {
      for (const classId of CLASSES) {
        const results = resultsFor(classId, band.level);
        const resting = mean(results.map((run) => run.restingMs / run.ms));
        expect(resting, `${classId} at ${band.level}`).toBeLessThan(0.2);
      }
    }
  });

  /**
   * And the food is cheap enough to eat: what a level eats out of what it
   * carried in, bought at the shelf, costs well under the coin the level picks
   * up. The starter levels drop no coin and carry no ration, so they are left
   * to the quests that pay for their logs.
   */
  it('pays for its rations out of a small share of what the level earns', () => {
    const shelf = (itemId: ItemId): number =>
      SHOP_STOCK.find((entry) => entry.itemId === itemId)?.price ?? 0;
    for (const band of BANDS.filter((candidate) => Object.keys(candidate.food).length > 0)) {
      for (const classId of CLASSES) {
        for (const run of resultsFor(classId, band.level)) {
          const spent = Object.entries(band.food).reduce(
            (sum, [itemId, carried]) =>
              sum +
              Math.min(carried ?? 0, run.eaten[itemId as ItemId] ?? 0) * shelf(itemId as ItemId),
            0,
          );
          expect(spent / run.copper, `${classId} at ${band.level}`).toBeLessThan(0.35);
        }
      }
    }
  });

  // Dying puts a player back on their feet at full health, so a pace a class
  // only keeps by dying is a pace it does not have.
  it('is not kept by dying', () => {
    for (const band of BANDS) {
      for (const classId of CLASSES) {
        for (const run of resultsFor(classId, band.level)) {
          expect(run.deaths, `${classId} at ${band.level}`).toBeLessThan(run.kills);
        }
      }
    }
  });
});
