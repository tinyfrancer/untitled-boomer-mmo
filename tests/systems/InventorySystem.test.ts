import { describe, expect, it } from 'vitest';
import {
  addItemToInventory,
  equipItem,
  removeItemFromInventory,
  unequipItem,
} from '../../src/systems/InventorySystem';

const EMPTY_GEAR = { helmet: null, chest: null, pants: null, weapon: null };

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
    const result = equipItem(EMPTY_GEAR, { 'brown-armor': 1 }, 'brown-armor');
    expect(result.gear.chest).toBe('brown-armor');
    expect(result.inventory).toEqual({});
  });

  it('returns the previously equipped item to inventory when swapping', () => {
    const gear = { ...EMPTY_GEAR, weapon: 'rusty-sword' };
    const result = equipItem(gear, { 'apprentice-wand': 1 }, 'apprentice-wand');
    expect(result.gear.weapon).toBe('apprentice-wand');
    expect(result.inventory).toEqual({ 'rusty-sword': 1 });
  });

  it('is a no-op when the item is a material, not equipment', () => {
    const inventory = { 'rat-bones': 1 };
    const result = equipItem(EMPTY_GEAR, inventory, 'rat-bones');
    expect(result.gear).toEqual(EMPTY_GEAR);
    expect(result.inventory).toEqual(inventory);
  });

  it('is a no-op when the item is not in inventory', () => {
    const result = equipItem(EMPTY_GEAR, {}, 'brown-armor');
    expect(result.gear).toEqual(EMPTY_GEAR);
    expect(result.inventory).toEqual({});
  });
});

describe('unequipItem', () => {
  it('moves the equipped item back into inventory and clears the slot', () => {
    const gear = { ...EMPTY_GEAR, chest: 'brown-armor' };
    const result = unequipItem(gear, {}, 'chest');
    expect(result.gear.chest).toBeNull();
    expect(result.inventory).toEqual({ 'brown-armor': 1 });
  });

  it('is a no-op when the slot is already empty', () => {
    const result = unequipItem(EMPTY_GEAR, {}, 'chest');
    expect(result.gear).toEqual(EMPTY_GEAR);
    expect(result.inventory).toEqual({});
  });
});
