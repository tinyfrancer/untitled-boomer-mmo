import { consumableFor } from '../data/items';
import type { ItemId } from '../types/ids';

export interface FoodBuff {
  itemId: ItemId;
  healPerMs: number;
  remainingMs: number;
}

export interface FoodTick {
  healed: number;
  buff: FoodBuff | null;
}

export function startFoodBuff(itemId: ItemId): FoodBuff | null {
  const food = consumableFor(itemId);
  if (!food || food.healDurationMs <= 0) {
    return null;
  }
  return {
    itemId,
    healPerMs: food.healAmount / food.healDurationMs,
    remainingMs: food.healDurationMs,
  };
}

/**
 * HP healed over `deltaMs`, and the buff to carry into the next frame (null once
 * it's spent).
 *
 * Fractional on purpose, exactly like RegenSystem.regenTick: 15 HP over 10s is
 * far less than a point per frame, so the caller accumulates and only rounds for
 * display. Rounding here would floor every tick to zero.
 */
export function foodTick(buff: FoodBuff | null, deltaMs: number): FoodTick {
  if (!buff || deltaMs <= 0) {
    return { healed: 0, buff };
  }

  // The last tick is clipped to whatever the buff has left, so the total healed
  // over its lifetime is exactly the food's healAmount however the frames land.
  const elapsed = Math.min(deltaMs, buff.remainingMs);
  const healed = buff.healPerMs * elapsed;
  const remainingMs = buff.remainingMs - elapsed;

  return {
    healed,
    buff: remainingMs > 0 ? { ...buff, remainingMs } : null,
  };
}
