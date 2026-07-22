import { describe, expect, it } from 'vitest';
import { formatCurrency, splitCurrency } from '../../src/systems/CurrencySystem';

describe('splitCurrency', () => {
  it('splits total copper into denominations at 100 each', () => {
    expect(splitCurrency(12345)).toEqual({ gold: 1, silver: 23, copper: 45 });
  });

  it('handles amounts below a silver', () => {
    expect(splitCurrency(99)).toEqual({ gold: 0, silver: 0, copper: 99 });
  });

  it('clamps negatives and fractions to whole non-negative copper', () => {
    expect(splitCurrency(-5)).toEqual({ gold: 0, silver: 0, copper: 0 });
    expect(splitCurrency(101.9)).toEqual({ gold: 0, silver: 1, copper: 1 });
  });
});

describe('formatCurrency', () => {
  it('shows all three denominations when gold is present', () => {
    expect(formatCurrency(10240)).toBe('1g 2s 40c');
  });

  it('omits leading zero denominations', () => {
    expect(formatCurrency(240)).toBe('2s 40c');
    expect(formatCurrency(40)).toBe('40c');
  });

  it('keeps interior zeros so amounts stay unambiguous', () => {
    expect(formatCurrency(10005)).toBe('1g 0s 5c');
  });

  it('reads 0c when broke', () => {
    expect(formatCurrency(0)).toBe('0c');
  });
});
