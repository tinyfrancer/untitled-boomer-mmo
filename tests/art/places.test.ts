import { describe, expect, it } from 'vitest';
import { variantId } from '../../src/art/compile';
import type { SpriteDef } from '../../src/art/format';
import { PLACEHOLDERS, SPRITES } from '../../src/art/index';
import { SHARED_RAMPS, parseColourRef, type SharedRampId } from '../../src/art/palette';
import { nodeSprite, stationSprite, strokeSprite } from '../../src/art/places';
import { STATION_IDS } from '../../src/data/recipes';
import { RESOURCE_NODES } from '../../src/data/resourceNodes';
import { itemIcon } from '../../src/ui/itemIcons';
import type { ResourceNodeId } from '../../src/types/ids';

/**
 * What each place a player works is drawn as (`art/places.ts`): every node,
 * every station and the fire drawn for real, a node that runs out drawn as
 * what it leaves, and every vein in the colour of the ore it yields.
 */

// A variant is a sprite of its own (`vein@tin`), the same kind as what it recolours.
const DEFS = new Map(
  SPRITES.flatMap((def) =>
    [def.id, ...Object.keys(def.variants ?? {}).map((name) => variantId(def.id, name))].map(
      (id) => [id, def] as const,
    ),
  ),
);

function defOf(id: string): SpriteDef {
  const def = DEFS.get(id);
  if (!def) throw new Error(`no sprite called ${id}`);
  return def;
}

const NODES = Object.entries(RESOURCE_NODES) as [
  ResourceNodeId,
  (typeof RESOURCE_NODES)[ResourceNodeId],
][];

describe('what each place is drawn as', () => {
  it('draws every node for real', () => {
    for (const [id, node] of NODES) {
      const sprite = nodeSprite(id, node.shape);
      expect(sprite, id).not.toBe(PLACEHOLDERS.prop.id);
      // What stands is a prop; what lies on the water is a mark.
      expect(defOf(sprite).kind, id).toBe(node.shape === 'ripple' ? 'mark' : 'prop');
    }
  });

  /**
   * A node that runs out is drawn as what it leaves, a stump or a worked-out
   * rock, rather than vanishing: that is the thing a player looks at to see
   * whether it is back. One that never runs out need draw nothing of the kind.
   */
  it('draws what a node that runs out leaves behind', () => {
    for (const [id, node] of NODES) {
      if (node.charges === null) continue;
      const def = defOf(nodeSprite(id, node.shape));
      expect(def.animations.still, id).toBeDefined();
      expect(def.animations.spent, id).toBeDefined();
    }
  });

  it('tells the three woods apart', () => {
    const woods = NODES.filter(([, node]) => node.shape === 'tree').map(([id, node]) =>
      nodeSprite(id, node.shape),
    );
    expect(new Set(woods).size).toBe(woods.length);
  });

  /**
   * Which metal is in the rock is a fact the whole game shares: step 2 of the
   * ramp a vein's ore is drawn in is the colour the ore it yields is drawn in
   * the pack.
   */
  it("draws every vein's ore in the colour of what it yields", () => {
    for (const [id, node] of NODES) {
      if (node.shape !== 'vein') continue;
      const sprite = nodeSprite(id, node.shape);
      const [base, variant] = sprite.split('@');
      expect(variant, `${id} is drawn in no ore`).toBeDefined();
      const def = defOf(base ?? '');
      const ore = def.variants?.[variant ?? '']?.ore as SharedRampId | undefined;
      expect(ore, id).toBeDefined();
      expect(SHARED_RAMPS[ore as SharedRampId][2], id).toBe(itemIcon(node.yieldItemId).color);
      // And the ore is drawn at all: the sprite names the ramp it recolours.
      expect(
        Object.values(def.legend).some((ref) => parseColourRef(ref)?.ramp === 'ore'),
        id,
      ).toBe(true);
    }
  });

  it('draws every station, and the fire a player lights, for real', () => {
    for (const station of STATION_IDS) {
      const def = defOf(stationSprite(station));
      expect(def.id, station).not.toBe(PLACEHOLDERS.prop.id);
      expect(def.kind, station).toBe('prop');
    }
    // A fire burns, so it moves on its own.
    expect(defOf(stationSprite('fire')).animations.loop).toBeDefined();
  });

  it('knocks something loose off every shape of node on a stroke', () => {
    for (const [id, node] of NODES) {
      expect(defOf(strokeSprite(node.shape)).kind, id).toBe('effect');
    }
  });
});
