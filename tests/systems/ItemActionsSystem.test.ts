import { describe, expect, it } from 'vitest';
import { actionsForItem } from '../../src/systems/ItemActionsSystem';
import type { ItemId } from '../../src/types/ids';
import { staleItemId } from '../staleIds';

const away = { nearFire: false, shopOpen: false, classId: 'warrior' } as const;
const byFire = { nearFire: true, shopOpen: false, classId: 'warrior' } as const;
const atShop = { nearFire: false, shopOpen: true, classId: 'warrior' } as const;

function ids(itemId: ItemId, context: Parameters<typeof actionsForItem>[1]): string[] {
  return actionsForItem(itemId, context).map((action) => action.id);
}

describe('actionsForItem', () => {
  it('equipment equips (and sells only at the shop)', () => {
    expect(ids('rusty-sword', away)).toEqual(['equip']);
    expect(ids('rusty-sword', atShop)).toEqual(['equip', 'sell']);
  });

  it('food eats', () => {
    expect(ids('cooked-fish', away)).toEqual(['eat']);
  });

  it('logs light a fire only when not already beside one', () => {
    expect(ids('logs', away)).toContain('light-fire');
    expect(ids('logs', byFire)).not.toContain('light-fire');
  });

  it('raw food cooks only beside a fire', () => {
    expect(ids('raw-fish', byFire)).toEqual(['cook']);
    expect(ids('raw-fish', away)).toEqual([]);
    expect(ids('crab-meat', byFire)).toEqual(['cook']);
  });

  it('anything with a value sells while the shop is open', () => {
    expect(ids('rat-bones', atShop)).toEqual(['sell']);
    expect(ids('rat-bones', away)).toEqual([]);
  });

  it('unknown items offer nothing', () => {
    expect(ids(staleItemId('no-such-item'), atShop)).toEqual([]);
  });

  it('offers no Equip button for armor the class cannot wear', () => {
    expect(ids('brown-chestplate', away)).toEqual(['equip']);
    expect(ids('brown-chestplate', { ...away, classId: 'wizard' })).toEqual([]);
    // The robe is the wizard's half of the same slot.
    expect(ids('brown-robe', { ...away, classId: 'wizard' })).toEqual(['equip']);
  });
});
