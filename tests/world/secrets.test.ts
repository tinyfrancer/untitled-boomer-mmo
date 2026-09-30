import { beforeEach, describe, expect, it } from 'vitest';
import { TILE_SIZE } from '../../src/config/constants';
import { SECRET_REACH, SECRETS } from '../../src/data/secrets';
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
