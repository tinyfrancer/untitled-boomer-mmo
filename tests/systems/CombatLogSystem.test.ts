import { describe, expect, it } from 'vitest';
import { nth } from '../nth';
import {
  COMBAT_LOG_LIMIT,
  appendLogEntry,
  logAbsorbed,
  logCoin,
  logDamageDealt,
  logDamageTaken,
  logDefense,
  logKill,
  logLoot,
  logSpellFailed,
  logXpGain,
  recentEntries,
} from '../../src/systems/CombatLogSystem';

const line = (text: string) => ({ text, color: '#ffffff' });

describe('appendLogEntry', () => {
  it('adds to the end, so the newest line is last', () => {
    const log = appendLogEntry(appendLogEntry([], line('first')), line('second'));
    expect(log.map((e) => e.text)).toEqual(['first', 'second']);
  });

  it('does not mutate the log it appends to', () => {
    const log = [line('first')];
    appendLogEntry(log, line('second'));
    expect(log).toHaveLength(1);
  });

  it('drops the oldest lines once full', () => {
    const log = Array.from({ length: 5 }, (_, i) => line(`${i}`)).reduce(
      (acc, entry) => appendLogEntry(acc, entry, 3),
      [] as ReturnType<typeof line>[],
    );
    expect(log.map((e) => e.text)).toEqual(['2', '3', '4']);
  });

  it('keeps a sane default limit', () => {
    const log = Array.from({ length: COMBAT_LOG_LIMIT + 10 }, (_, i) => line(`${i}`)).reduce(
      (acc, entry) => appendLogEntry(acc, entry),
      [] as ReturnType<typeof line>[],
    );
    expect(log).toHaveLength(COMBAT_LOG_LIMIT);
    expect(nth(log, log.length - 1).text).toBe(`${COMBAT_LOG_LIMIT + 9}`);
  });
});

describe('recentEntries', () => {
  const log = ['a', 'b', 'c'].map(line);

  it('takes the newest n, oldest first', () => {
    expect(recentEntries(log, 2).map((e) => e.text)).toEqual(['b', 'c']);
  });

  it('returns everything when asked for more than it holds', () => {
    expect(recentEntries(log, 10)).toEqual(log);
    expect(recentEntries([], 5)).toEqual([]);
  });
});

describe('formatters', () => {
  it('name who did what to whom', () => {
    expect(logDamageDealt('Rat', 7).text).toBe('You hit Rat for 7.');
    expect(logDamageTaken('Rat', 3).text).toBe('Rat hits you for 3.');
    expect(logDefense('Parry', 'Bandit').text).toBe("You parry Bandit's attack.");
    expect(logKill('Rat').text).toBe('You have slain Rat!');
    expect(logAbsorbed(5).text).toBe('Your shield absorbs 5.');
    expect(logSpellFailed('Fireball').text).toBe('Your Fireball fizzles.');
    expect(logXpGain(12).text).toBe('You gain 12 experience.');
  });

  it('pluralises loot only when there is more than one', () => {
    expect(logLoot('Rat Bones', 1).text).toBe('You receive Rat Bones.');
    expect(logLoot('Rat Bones', 3).text).toBe('You receive Rat Bones (3).');
  });

  it('renders coin through the shared currency formatter', () => {
    expect(logCoin(112).text).toContain('1s');
  });

  it('colors damage taken differently from damage dealt', () => {
    expect(logDamageTaken('Rat', 3).color).not.toBe(logDamageDealt('Rat', 3).color);
  });
});
