import { describe, expect, it } from 'vitest';
import { staleItemId } from '../staleIds';
import {
  addItemToInventory,
  equipItem,
  itemsForSlot,
  removeItemFromInventory,
  unequipItem,
  type Gear,
} from '../../src/systems/InventorySystem';

const EMPTY_GEAR: Gear = { helmet: null, chest: null, pants: null, weapon: null, offhand: null };

describe('addItemToInventory', () => {
  it('adds a new item at the given quantity', () => {
    const result = addItemToInventory({}, 'rat-bones', 3);
    expect(result).toEqual({ 'rat-bones': 3 });
  });

  it('increments an existing stack without mutating the input object', () => {
    const inventory = { 'rat-bones': 2 };
    const result = addItemToInventory(inventory, 'rat-bones', 1);
    expect(result).toEqual({ 'rat-bones': 3 });
    expect(inventory).toEqual({ 'rat-bones': 2 });
  });
});

describe('removeItemFromInventory', () => {
  it('decrements a stack', () => {
    const result = removeItemFromInventory({ 'rat-bones': 3 }, 'rat-bones', 1);
    expect(result).toEqual({ 'rat-bones': 2 });
  });

  it('deletes the key once the stack reaches zero', () => {
    const result = removeItemFromInventory({ 'rat-bones': 1 }, 'rat-bones', 1);
    expect(result).toEqual({});
  });

  it('clamps at zero rather than going negative', () => {
    const result = removeItemFromInventory({ 'rat-bones': 1 }, 'rat-bones', 5);
    expect(result).toEqual({});
  });
});

describe('equipItem', () => {
  it('moves an equippable item from inventory into its gear slot', () => {
    const result = equipItem(EMPTY_GEAR, { 'brown-chestplate': 1 }, 'brown-chestplate');
    expect(result.gear.chest).toBe('brown-chestplate');
    expect(result.inventory).toEqual({});
  });

  it('returns the previously equipped item to inventory when swapping', () => {
    const gear: Gear = { ...EMPTY_GEAR, weapon: 'rusty-sword' };
    const result = equipItem(gear, { 'apprentice-staff': 1 }, 'apprentice-staff');
    expect(result.gear.weapon).toBe('apprentice-staff');
    expect(result.inventory).toEqual({ 'rusty-sword': 1 });
  });

  it('is a no-op when the item is a material, not equipment', () => {
    const inventory = { 'rat-bones': 1 };
    const result = equipItem(EMPTY_GEAR, inventory, 'rat-bones');
    expect(result.gear).toEqual(EMPTY_GEAR);
    expect(result.inventory).toEqual(inventory);
  });

  it('is a no-op when the item is not in inventory', () => {
    const result = equipItem(EMPTY_GEAR, {}, 'brown-chestplate');
    expect(result.gear).toEqual(EMPTY_GEAR);
    expect(result.inventory).toEqual({});
  });
});

describe('unequipItem', () => {
  it('moves the equipped item back into inventory and clears the slot', () => {
    const gear: Gear = { ...EMPTY_GEAR, chest: 'brown-chestplate' };
    const result = unequipItem(gear, {}, 'chest');
    expect(result.gear.chest).toBeNull();
    expect(result.inventory).toEqual({ 'brown-chestplate': 1 });
  });

  it('is a no-op when the slot is already empty', () => {
    const result = unequipItem(EMPTY_GEAR, {}, 'chest');
    expect(result.gear).toEqual(EMPTY_GEAR);
    expect(result.inventory).toEqual({});
  });
});

describe('itemsForSlot', () => {
  const inventory = {
    'brown-helmet': 1,
    'brown-chestplate': 2,
    'brown-axe': 1,
    'rusty-sword': 1,
    'rat-bones': 5,
  };

  it('returns only equipment matching the slot', () => {
    expect(itemsForSlot(inventory, 'weapon').sort()).toEqual(['brown-axe', 'rusty-sword']);
    expect(itemsForSlot(inventory, 'helmet')).toEqual(['brown-helmet']);
  });

  it('excludes materials and empty stacks', () => {
    expect(itemsForSlot(inventory, 'chest')).toEqual(['brown-chestplate']);
    expect(itemsForSlot({ 'brown-helmet': 0 }, 'helmet')).toEqual([]);
    expect(itemsForSlot({ 'rat-meat': 3 }, 'chest')).toEqual([]);
  });

  it('returns an empty list for a slot with nothing to put in it', () => {
    expect(itemsForSlot(inventory, 'pants')).toEqual([]);
    expect(itemsForSlot({}, 'weapon')).toEqual([]);
  });

  it('ignores unknown item ids', () => {
    expect(itemsForSlot({ [staleItemId('not-an-item')]: 1 }, 'weapon')).toEqual([]);
  });
});
