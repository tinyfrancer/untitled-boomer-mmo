import { describe, expect, it } from 'vitest';
import { consumableFor } from '../../src/data/items';
import { foodTick, startFoodBuff } from '../../src/systems/FoodSystem';

const COOKED_FISH = 'cooked-fish';
const FOOD = consumableFor(COOKED_FISH)!;

describe('startFoodBuff', () => {
  it('builds a buff from a consumable', () => {
    const buff = startFoodBuff(COOKED_FISH);
    expect(buff).not.toBeNull();
    expect(buff?.remainingMs).toBe(FOOD.healDurationMs);
  });

  it('refuses anything that is not food', () => {
    expect(startFoodBuff('rusty-sword')).toBeNull();
    expect(startFoodBuff('raw-fish')).toBeNull();
    expect(startFoodBuff('nonsense')).toBeNull();
  });
});

describe('foodTick', () => {
  it('heals a fraction of a point per frame rather than rounding to zero', () => {
    const buff = startFoodBuff(COOKED_FISH);
    const { healed } = foodTick(buff, 16);
    expect(healed).toBeGreaterThan(0);
    expect(healed).toBeLessThan(1);
  });

  it('heals exactly the food amount over its full duration', () => {
    let buff = startFoodBuff(COOKED_FISH);
    let total = 0;
    // 16ms frames do not divide the duration evenly, which is the point: the
    // final clipped tick has to land the total exactly on healAmount.
    while (buff) {
      const tick = foodTick(buff, 16);
      total += tick.healed;
      buff = tick.buff;
    }
    expect(total).toBeCloseTo(FOOD.healAmount);
  });

  it('expires once the duration is spent', () => {
    const buff = startFoodBuff(COOKED_FISH);
    const tick = foodTick(buff, FOOD.healDurationMs);
    expect(tick.buff).toBeNull();
    expect(tick.healed).toBeCloseTo(FOOD.healAmount);
  });

  it('never overshoots when handed a huge delta', () => {
    const buff = startFoodBuff(COOKED_FISH);
    const tick = foodTick(buff, FOOD.healDurationMs * 10);
    expect(tick.healed).toBeCloseTo(FOOD.healAmount);
    expect(tick.buff).toBeNull();
  });

  it('is a no-op with no buff', () => {
    expect(foodTick(null, 100)).toEqual({ healed: 0, buff: null });
  });

  it('does not mutate the buff it is given', () => {
    const buff = startFoodBuff(COOKED_FISH);
    foodTick(buff, 500);
    expect(buff?.remainingMs).toBe(FOOD.healDurationMs);
  });
});
