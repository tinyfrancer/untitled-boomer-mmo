import { describe, expect, it } from 'vitest';
import { MasterySheet } from '../../src/hud/MasterySheet';
import { MASTERY_TIERS } from '../../src/data/mastery';
import type { MasteryXp } from '../../src/systems/MasterySystem';

function drawn(mastery: MasteryXp): HTMLElement {
  const sheet = new MasterySheet();
  sheet.update(mastery);
  return sheet.root;
}

describe('MasterySheet', () => {
  /**
   * The page used to be a list of pools with nothing saying what a pool was or
   * why a rank mattered. What it pays is read off the table, so a retune moves
   * the words with it rather than leaving them wrong.
   */
  it('says what mastery is and what every paying rank gives', () => {
    const intro = drawn({}).querySelector('.hud-sheet__intro')?.textContent ?? '';
    expect(intro).toContain('mastery of its own');
    for (const tier of MASTERY_TIERS.filter((rung) => rung.bonusChance > 0)) {
      expect(intro).toContain(`${tier.name} ${Math.round(tier.bonusChance * 100)}%`);
    }
    expect(intro).not.toContain(MASTERY_TIERS[0]?.name);
  });

  it('names the rank a pool stands on, out of how many there are', () => {
    const rows = [...drawn({ tree: 600 }).querySelectorAll('.hud-skill__line')];
    const tree = rows.map((row) => row.textContent ?? '').find((text) => text.startsWith('Tree'));
    expect(tree).toContain(`Apprentice · rank 2 / ${MASTERY_TIERS.length}`);
  });
});
