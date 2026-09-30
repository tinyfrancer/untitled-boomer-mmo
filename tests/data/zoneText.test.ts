import { describe, expect, it } from 'vitest';
import { TILE_SIZE } from '../../src/config/constants';
import { BUILDINGS, counterPoint } from '../../src/data/buildings';
import { GRASS_TILE, PATH_TILE, SAND_TILE, WATER_TILE } from '../../src/data/tiles';
import { GROUNDS, layoutZone, type ZoneLegend } from '../../src/data/zoneText';
import { ZONES } from '../../src/data/zones';

const middle = (cell: number): number => (cell + 0.5) * TILE_SIZE;

const START: ZoneLegend = { '@': { start: true, on: 'grass' } };

describe('the ground', () => {
  it('is a tile a character and a row a line, as big as the text is', () => {
    const { map } = layoutZone(
      'shore',
      `
      ..=@
      ::~~
      `,
      START,
    );
    expect(map).toEqual([
      [GRASS_TILE, GRASS_TILE, PATH_TILE, GRASS_TILE],
      [SAND_TILE, SAND_TILE, WATER_TILE, WATER_TILE],
    ]);
  });

  it('writes every ground in a character no legend may take', () => {
    const keys = Object.values(GROUNDS).map(({ key }) => key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) {
      expect(() =>
        layoutZone('taken', '@.', { ...START, [key]: { node: 'tree', on: 'grass' } }),
      ).toThrow(`taken: the legend's '${key}' is a ground's character`);
    }
  });

  it('refuses rows of different widths', () => {
    expect(() => layoutZone('ragged', '@..\n..', START)).toThrow('ragged: row 1 is 2 wide, not 3');
  });

  it('refuses a character that is neither a ground nor in the legend', () => {
    expect(() => layoutZone('stray', '@.x', START)).toThrow("stray: 'x' at 2,0");
  });
});

describe('a marker', () => {
  it('stands in the middle of its tile, on the ground the legend puts under it', () => {
    const layout = layoutZone('field', '....\n.@r.\n..t.', {
      ...START,
      r: { mob: 'rat', level: 2, on: 'road' },
      t: { node: 'tree', on: 'grass' },
    });
    expect(layout.start).toEqual({ x: middle(1), y: middle(1) });
    expect(layout.mobSpawns).toEqual([{ x: middle(2), y: middle(1), enemyId: 'rat', level: 2 }]);
    expect(layout.nodeSpawns).toEqual([{ x: middle(2), y: middle(2), nodeId: 'tree' }]);
    expect(layout.map[1]?.[2]).toBe(PATH_TILE);
  });

  it('is read in the order the text is, a line at a time', () => {
    const { mobSpawns } = layoutZone('rats', 'a.b\n@a.', {
      ...START,
      a: { mob: 'rat', level: 1, on: 'grass' },
      b: { mob: 'rat', level: 3, on: 'grass' },
    });
    expect(mobSpawns.map(({ level }) => level)).toEqual([1, 3, 1]);
  });

  it('needs exactly one start', () => {
    expect(() => layoutZone('nowhere', '..', START)).toThrow('nowhere: has 0 starts');
    expect(() => layoutZone('twice', '@@', START)).toThrow('twice: has 2 starts');
  });

  it('refuses a legend entry the map never uses', () => {
    expect(() =>
      layoutZone('unused', '@.', { ...START, t: { node: 'tree', on: 'grass' } }),
    ).toThrow("unused: the legend's 't' is on no tile");
  });
});

describe('a building', () => {
  const cottage = BUILDINGS.cottage;
  const legend: ZoneLegend = { ...START, C: { building: 'cottage', on: 'grass' } };

  it('is a block of its marker exactly its footprint, standing at the middle of it', () => {
    expect(cottage.body).toEqual({ width: TILE_SIZE * 2, height: TILE_SIZE * 2 });
    const { buildingSpawns } = layoutZone('lane', '.CC.\n.CC@', legend);
    expect(buildingSpawns).toEqual([{ x: TILE_SIZE * 2, y: TILE_SIZE, buildingId: 'cottage' }]);
  });

  it('puts whoever works there behind its counter', () => {
    const { buildingSpawns, npcSpawns } = layoutZone('shop', 'SSS.\nSSS.\nSSS@', {
      ...START,
      S: { building: 'general-store', worker: 'shopkeeper', on: 'grass' },
    });
    const store = { ...buildingSpawns[0]!, definition: BUILDINGS['general-store'] };
    expect(npcSpawns).toEqual([{ ...counterPoint(store), npcId: 'shopkeeper' }]);
  });

  it('refuses a block short of its footprint', () => {
    expect(() => layoutZone('short', '.CC.\n.C.@', legend)).toThrow(
      'short: cottage at 1,0 is not a 2×2 block',
    );
  });

  it('refuses a block that runs on past it, which is two buildings touching', () => {
    expect(() => layoutZone('long', 'CCC.\nCC.@', legend)).toThrow(
      'long: cottage at 0,0 runs on past its 2×2',
    );
    expect(() => layoutZone('deep', 'CC.\nCC.\nC.@', legend)).toThrow(
      'deep: cottage at 0,0 runs on past its 2×2',
    );
  });

  it('can stand beside another of its kind drawn in a second letter', () => {
    const { buildingSpawns } = layoutZone('row', 'CCDD\nCCDD\n...@', {
      ...legend,
      D: { building: 'cottage', on: 'grass' },
    });
    expect(buildingSpawns.map(({ x }) => x)).toEqual([TILE_SIZE, TILE_SIZE * 3]);
  });
});

describe('every zone', () => {
  it('stands its markers on tile middles and its buildings on tile lines', () => {
    for (const zone of Object.values(ZONES)) {
      const points = [zone.start, ...zone.mobSpawns, ...zone.nodeSpawns, ...zone.stationSpawns];
      for (const { x, y } of points) {
        expect((x / TILE_SIZE) % 1, `${zone.id}: ${x},${y}`).toBe(0.5);
        expect((y / TILE_SIZE) % 1, `${zone.id}: ${x},${y}`).toBe(0.5);
      }
      for (const spawn of zone.buildingSpawns) {
        const { body } = BUILDINGS[spawn.buildingId];
        expect(((spawn.x - body.width / 2) / TILE_SIZE) % 1, zone.id).toBe(0);
        expect(((spawn.y - body.height / 2) / TILE_SIZE) % 1, zone.id).toBe(0);
      }
    }
  });
});
