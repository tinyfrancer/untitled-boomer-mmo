export const COPPER_PER_SILVER = 100;
export const COPPER_PER_GOLD = 100 * COPPER_PER_SILVER;

export interface CurrencyParts {
  gold: number;
  silver: number;
  copper: number;
}

export function splitCurrency(totalCopper: number): CurrencyParts {
  const total = Math.max(0, Math.floor(totalCopper));
  return {
    gold: Math.floor(total / COPPER_PER_GOLD),
    silver: Math.floor((total % COPPER_PER_GOLD) / COPPER_PER_SILVER),
    copper: total % COPPER_PER_SILVER,
  };
}

// "1g 12s 40c", omitting leading zero denominations; plain "0c" when broke.
export function formatCurrency(totalCopper: number): string {
  const { gold, silver, copper } = splitCurrency(totalCopper);
  const parts: string[] = [];
  if (gold > 0) parts.push(`${gold}g`);
  if (silver > 0 || gold > 0) parts.push(`${silver}s`);
  parts.push(`${copper}c`);
  return parts.join(' ');
}
