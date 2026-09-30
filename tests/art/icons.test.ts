import { describe, expect, it } from 'vitest';
import { compileSprite } from '../../src/art/compile';
import {
  ABILITY_ICONS,
  ICON_SPRITES,
  MARKS,
  abilityIconKey,
  effectIconKey,
  itemIconKey,
  itemIconRow,
  markIconKey,
} from '../../src/art/icons';
import { PLACEHOLDERS } from '../../src/art/index';
import { parseColourRef, type SharedRampId } from '../../src/art/palette';
import { offhandAs, wieldedAs, wornAs } from '../../src/art/wardrobe';
import { ITEMS } from '../../src/data/items';
import { ABILITIES } from '../../src/data/abilities';
import { EFFECT_IDS } from '../../src/data/effects';
import { ALL_TABS } from '../../src/ui/tabs';
import type { AbilityId, ItemId } from '../../src/types/ids';

const ABILITY_IDS = Object.keys(ABILITIES) as AbilityId[];

/**
 * What the HUD draws every item, ability, buff and tab as (`art/icons.ts`,
 * decision 111). The sprites themselves are held to the budget and the palette
 * by `sprites.test.ts`; this holds what each thing is drawn *as*.
 */

const ALL_ITEMS = Object.keys(ITEMS) as ItemId[];

/** Every frame the HUD's sheet of icons holds, by key. */
const FRAMES = new Set(ICON_SPRITES.flatMap((def) => compileSprite(def, 'open')).map((f) => f.key));

/** The ramps an item's icon is drawn in, once it is dyed for the item. */
function iconRamps(itemId: ItemId): SharedRampId[] {
  const row = itemIconRow(itemId);
  if (!row) throw new Error(`${itemId} has no icon of its own`);
  return Object.values(row.art.legend).map((ref) => {
    const ramp = parseColourRef(ref)?.ramp as SharedRampId;
    return (row.recolour?.[ramp] as SharedRampId | undefined) ?? ramp;
  });
}

describe('item icons', () => {
  // The bag draws whatever is in it, and anything in the game can end up
  // there. An item whose icon is its shape's fallback is one nobody drew.
  it('draws every item for real, as a frame on the sheet', () => {
    for (const itemId of ALL_ITEMS) {
      expect(itemIconRow(itemId), itemId).not.toBeNull();
      expect(FRAMES.has(itemIconKey(itemId)), itemIconKey(itemId)).toBe(true);
      expect(itemIconKey(itemId)).not.toContain(PLACEHOLDERS.icon.id);
    }
  });

  /**
   * The helm in the bag is the helm on the figure, in the same steel: gear is
   * drawn off the wardrobe's answer and dyed in the ramp it is worn in.
   */
  it('draws gear in the ramps it is worn in', () => {
    for (const itemId of ALL_ITEMS) {
      const worn = wornAs(itemId);
      if (worn) expect(iconRamps(itemId), itemId).toContain(worn.ramp);
      const wield = wieldedAs(itemId);
      for (const ramp of [wield?.blade, wield?.haft, wield?.fitting, wield?.gem]) {
        if (ramp) expect(iconRamps(itemId), itemId).toContain(ramp);
      }
      const carried = offhandAs(itemId);
      if (carried) expect(iconRamps(itemId), itemId).toContain(carried.ramp);
      if (carried?.glow) expect(iconRamps(itemId), itemId).toContain(carried.glow);
    }
  });

  // Two pieces of one tier differ by what they are, and one piece in two tiers
  // by its colour: either way no two items share a picture.
  it('gives no two items the same picture', () => {
    const keys = ALL_ITEMS.map(itemIconKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  // A raw fish, a cooked one and a burnt one are one outline in three ramps,
  // so the ramps are the only thing telling them apart and cannot collide.
  it('tells every cooking step apart by colour alone', () => {
    for (const steps of [
      ['raw-fish', 'cooked-fish', 'burnt-fish'],
      ['rat-meat', 'cooked-rat', 'burnt-rat'],
      ['crab-meat', 'cooked-crab', 'burnt-crab'],
      ['raw-eel', 'cooked-eel', 'burnt-eel'],
    ] as ItemId[][]) {
      const arts = steps.map((itemId) => itemIconRow(itemId)?.art.id);
      expect(new Set(arts).size, steps.join()).toBe(1);
      const ramps = steps.map((itemId) => [...new Set(iconRamps(itemId))].sort().join());
      expect(new Set(ramps).size, steps.join()).toBe(3);
    }
  });
});

describe('ability, buff and tab icons', () => {
  it('draws every ability, a second rank as its first', () => {
    for (const abilityId of ABILITY_IDS) {
      expect(FRAMES.has(abilityIconKey(abilityId)), abilityId).toBe(true);
      const first = abilityId.replace(/-2$/, '') as AbilityId;
      expect(ABILITY_ICONS[abilityId], abilityId).toBe(ABILITY_ICONS[first]);
    }
    const firsts = ABILITY_IDS.filter((id) => !id.endsWith('-2'));
    expect(new Set(firsts.map((id) => ABILITY_ICONS[id])).size).toBe(firsts.length);
  });

  it('draws every buff, each as something on the sheet', () => {
    for (const effectId of EFFECT_IDS) {
      expect(FRAMES.has(effectIconKey(effectId)), effectId).toBe(true);
    }
  });

  it('gives every tab a mark, and no two tabs the same one', () => {
    const marks = ALL_TABS.map((tab) => tab.icon);
    for (const mark of marks) expect(FRAMES.has(markIconKey(mark)), mark).toBe(true);
    expect(new Set(marks).size).toBe(marks.length);
    expect(Object.keys(MARKS)).toContain('coin');
  });
});
