import { describe, expect, it } from 'vitest';
import type { ItemId } from '../../src/types/ids';
import { staleItemId } from '../staleIds';
import { canEquip, equippableFrom, stripIllegalGear } from '../../src/systems/EquipSystem';
import type { Gear } from '../../src/systems/InventorySystem';

const EMPTY_GEAR: Gear = { helmet: null, chest: null, pants: null, weapon: null };

describe('canEquip', () => {
  it('lets a warrior wear leather and a wizard wear cloth', () => {
    expect(canEquip('brown-chestplate', 'warrior').ok).toBe(true);
    expect(canEquip('brown-robe', 'wizard').ok).toBe(true);
  });

  it('refuses leather to a wizard, and says why', () => {
    const check = canEquip('brown-legs', 'wizard');
    expect(check.ok).toBe(false);
    expect(check.ok === false && check.reason).toBe("A Wizard can't wear leather.");
  });

  it('leaves cloth open to everyone, since it carries no strength to abuse', () => {
    expect(canEquip('brown-robe', 'warrior').ok).toBe(true);
  });

  it('never restricts weapons and tools, which name no armor type', () => {
    expect(canEquip('apprentice-wand', 'warrior').ok).toBe(true);
    expect(canEquip('rusty-sword', 'wizard').ok).toBe(true);
    expect(canEquip('felling-axe', 'wizard').ok).toBe(true);
  });

  it('refuses anything that is not equipment at all', () => {
    expect(canEquip('rat-bones', 'warrior').ok).toBe(false);
    expect(canEquip(staleItemId('no-such-item'), 'warrior').ok).toBe(false);
  });
});

describe('equippableFrom', () => {
  it('keeps only what the class may wear, in order', () => {
    const candidates: ItemId[] = ['brown-chestplate', 'brown-robe'];
    expect(equippableFrom(candidates, 'wizard')).toEqual(['brown-robe']);
    expect(equippableFrom(candidates, 'warrior')).toEqual(candidates);
  });
});

describe('stripIllegalGear', () => {
  it('moves gear the class may no longer wear back into the bag', () => {
    const result = stripIllegalGear(
      { ...EMPTY_GEAR, chest: 'brown-chestplate', weapon: 'apprentice-wand' },
      { 'rat-bones': 2 },
      'wizard',
    );
    expect(result.gear.chest).toBeNull();
    expect(result.inventory).toEqual({ 'rat-bones': 2, 'brown-chestplate': 1 });
    // The wand carries no armor type, so it stays equipped.
    expect(result.gear.weapon).toBe('apprentice-wand');
  });

  it('stacks a stripped piece onto one already in the bag', () => {
    const result = stripIllegalGear(
      { ...EMPTY_GEAR, helmet: 'brown-helmet' },
      { 'brown-helmet': 1 },
      'wizard',
    );
    expect(result.inventory['brown-helmet']).toBe(2);
  });

  it('leaves a legal loadout untouched', () => {
    const gear: Gear = { ...EMPTY_GEAR, chest: 'brown-chestplate' };
    const inventory = { logs: 3 };
    const result = stripIllegalGear(gear, inventory, 'warrior');
    expect(result.gear).toEqual(gear);
    expect(result.inventory).toEqual(inventory);
  });
});
