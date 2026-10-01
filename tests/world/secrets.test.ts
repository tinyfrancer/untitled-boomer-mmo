import { beforeEach, describe, expect, it } from 'vitest';
import { PLAYER_HALF_EXTENT, TILE_SIZE } from '../../src/config/constants';
import { isInside } from '../../src/data/buildings';
import { SECRET_REACH, SECRETS } from '../../src/data/secrets';
import { ZONES } from '../../src/data/zones';
import { isBlocked } from '../../src/systems/CollisionSystem';
import { findPath } from '../../src/systems/PathSystem';
import { zoneWorldSize } from '../../src/systems/ZoneSystem';
import { populateZone } from '../../src/world/zoneEntities';
import { SECRET_FOUND_EVENT, SECRETS_CHANGED_EVENT } from '../../src/ui/uiEvents';
import type { SecretId } from '../../src/types/ids';
import type { ZoneWorld } from '../../src/world/ZoneWorld';
import { harness } from './harness';

/**
 * A secret is found by walking up to it (decision 117), once per character:
 * Wick says what it is, and what was left there is the player's.
 */

beforeEach(() => {
  localStorage.clear();
});

function secretIn(world: ZoneWorld, secretId: SecretId): { x: number; y: number } {
  const secret = world.secrets.find((each) => each.secretId === secretId);
  if (!secret) throw new Error(`${world.zone.id} hides no ${secretId}`);
  return secret;
}

describe('finding a secret', () => {
  it('is walking up to it: the line, the coin, and the find kept on the character', () => {
    const kit = harness();
    const stone = secretIn(kit.world, 'lamp-stone');
    const before = kit.character.state.currency;

    kit.world.teleport(stone.x, stone.y + TILE_SIZE);
    kit.tick(1);

    expect(kit.character.state.secrets).toEqual(['lamp-stone']);
    expect(kit.character.state.currency).toBe(before + SECRETS['lamp-stone'].cache.copper);
    expect(kit.emissions(SECRET_FOUND_EVENT)).toEqual([['lamp-stone']]);
  });

  it("is not standing a road's width off", () => {
    const kit = harness();
    const stone = secretIn(kit.world, 'lamp-stone');

    kit.world.teleport(stone.x, stone.y + SECRET_REACH + TILE_SIZE / 2);
    kit.tick(1);

    expect(kit.character.state.secrets).toEqual([]);
  });

  it('happens once: walking back up to it pays nothing more', () => {
    const kit = harness();
    const stone = secretIn(kit.world, 'lamp-stone');
    kit.world.teleport(stone.x, stone.y + TILE_SIZE);
    kit.tick(1);
    const paid = kit.character.state.currency;

    kit.world.teleport(stone.x + TILE_SIZE * 6, stone.y + TILE_SIZE * 3);
    kit.tick(1);
    kit.world.teleport(stone.x, stone.y + TILE_SIZE);
    kit.tick(1);

    expect(kit.character.state.currency).toBe(paid);
    expect(kit.emissions(SECRET_FOUND_EVENT)).toHaveLength(1);
  });

  /**
   * The rule every fixed distance keeps: a cheap phone steps forty-odd pixels a
   * frame, and a find is measured along the stretch walked, not where it ended.
   */
  it('finds one walked past in a single long stride', () => {
    const kit = harness();
    const hatch = secretIn(kit.world, 'cellar-hatch');
    kit.world.teleport(hatch.x - TILE_SIZE * 0.9, hatch.y + TILE_SIZE * 1.1);
    kit.tick(1);
    expect(kit.character.state.secrets).toEqual([]);

    // Neither end is in reach, and the line between them is.
    kit.world.teleport(hatch.x + TILE_SIZE * 0.9, hatch.y + TILE_SIZE * 1.1);
    kit.tick(1);

    expect(kit.character.state.secrets).toContain('cellar-hatch');
  });

  it('does not find what a jump across the zone passes over', () => {
    const kit = harness();
    const stone = secretIn(kit.world, 'lamp-stone');
    kit.world.teleport(stone.x - TILE_SIZE * 8, stone.y);
    kit.tick(1);

    kit.world.teleport(stone.x + TILE_SIZE * 8, stone.y);
    kit.tick(1);

    expect(kit.character.state.secrets).toEqual([]);
  });

  it('is a tap on the ground by it, which walks there', () => {
    const kit = harness();
    const hatch = secretIn(kit.world, 'cellar-hatch');

    kit.world.tap({ kind: 'ground', point: { x: hatch.x, y: hatch.y } });
    kit.until(() => kit.character.state.secrets.includes('cellar-hatch'), 'the walk to find it');
  });

  it('leaves what the pack cannot take where it was found', () => {
    const kit = harness();
    const hatch = secretIn(kit.world, 'cellar-hatch');
    const room = kit.character.carryCapacity() - kit.character.carriedWeight();
    kit.character.addItem('crab-meat', room);

    kit.world.teleport(hatch.x, hatch.y + TILE_SIZE);
    kit.tick(1);

    expect(kit.character.itemCount('pickaxe')).toBe(0);
    expect(kit.world.lootPiles).toHaveLength(1);
    expect(kit.world.lootPiles[0]).toMatchObject({ x: hatch.x, y: hatch.y });
  });

  it('tells the HUD every secret found, on the first frame and on each find', () => {
    const kit = harness();
    kit.tick(1);
    expect(kit.emissions(SECRETS_CHANGED_EVENT)).toEqual([[[]]]);

    const stone = secretIn(kit.world, 'lamp-stone');
    kit.world.teleport(stone.x, stone.y + TILE_SIZE);
    kit.tick(1);

    expect(kit.emissions(SECRETS_CHANGED_EVENT)).toEqual([[[]], [['lamp-stone']]]);
  });

  it('stands the Lamp Stone up out of the road, where nobody walks through it', () => {
    const { world } = harness();
    const stone = secretIn(world, 'lamp-stone');
    const blocked = world.collisionWorld.blockers.some(
      (rect) =>
        rect.left <= stone.x &&
        stone.x <= rect.right &&
        rect.top <= stone.y &&
        stone.y <= rect.bottom,
    );
    expect(blocked).toBe(true);
  });
});

/**
 * A secret may lie in a room (decision 120), and is found from inside it and
 * nowhere else: a wall is a quarter of a tile, so the reach would otherwise
 * find the fettler's back room from the longhouse in front of it.
 */
describe('a secret in a room', () => {
  it('is found from inside the room', () => {
    const kit = harness({ zoneId: 'greyford' });
    const store = secretIn(kit.world, 'back-room');

    kit.world.teleport(store.x, store.y - TILE_SIZE / 3);
    kit.tick(1);

    expect(kit.character.state.secrets).toEqual(['back-room']);
    expect(kit.character.itemCount('reforging-stone')).toBe(1);
  });

  it('is not found through its wall, from the room in front of it', () => {
    const kit = harness({ zoneId: 'greyford' });
    const secret = kit.world.secrets.find((each) => each.secretId === 'back-room');
    if (!secret?.room) throw new Error('the back room lies in no room');
    const longhouse = kit.world.buildings.find((each) => each.definition.id === 'longhouse');
    if (!longhouse) throw new Error('greyford has no longhouse');

    // In the longhouse, as near the back room as a body there can stand, which
    // is within the reach of it.
    const near = { x: secret.x, y: secret.y + SECRET_REACH };
    expect(isInside(longhouse, near)).toBe(true);
    expect(isInside(secret.room, near)).toBe(false);
    kit.world.teleport(near.x, near.y);
    kit.tick(1);

    expect(kit.character.state.secrets).toEqual([]);
  });
});

/**
 * The sweep a placement cannot otherwise fail: every secret can be walked up
 * to, from where the zone puts a player, and into its room for one that lies in
 * a room. One a body can never come within reach of is a secret nobody finds.
 */
describe('every secret', () => {
  for (const zone of Object.values(ZONES)) {
    if (zone.secretSpawns.length === 0) continue;

    it(`can be walked up to in ${zone.id}`, () => {
      const entities = populateZone(zone, zoneWorldSize(zone), () => 0.5);
      const step = TILE_SIZE / 4;

      for (const secret of entities.secrets) {
        const stands: { x: number; y: number }[] = [];
        for (let dy = -SECRET_REACH; dy <= SECRET_REACH; dy += step) {
          for (let dx = -SECRET_REACH; dx <= SECRET_REACH; dx += step) {
            if (Math.hypot(dx, dy) > SECRET_REACH) continue;
            const at = { x: secret.x + dx, y: secret.y + dy };
            if (secret.room && !isInside(secret.room, at)) continue;
            const body = { ...at, halfWidth: PLAYER_HALF_EXTENT, halfHeight: PLAYER_HALF_EXTENT };
            if (!isBlocked(entities.collisionWorld, body)) stands.push(at);
          }
        }
        const reached = stands.some(
          (at) =>
            findPath(entities.collisionWorld, entities.spawnPoint, at, PLAYER_HALF_EXTENT) !== null,
        );
        expect(reached, `${zone.id}: nobody can walk up to the ${secret.secretId}`).toBe(true);
      }
    });
  }
});
