import { describe, expect, it } from 'vitest';
import { FeatsSheet } from '../../src/hud/FeatsSheet';
import type { KillCounts } from '../../src/systems/AchievementSystem';
import type { TitleId } from '../../src/types/ids';

function sheet(kills: KillCounts, worn: TitleId | null = null) {
  const asked: (TitleId | null)[] = [];
  const feats = new FeatsSheet((titleId) => asked.push(titleId));
  feats.update(kills, worn);
  const wearable = () =>
    [...feats.root.querySelectorAll<HTMLElement>('.hud-feat-title')].map(
      (row) => row.dataset.title,
    );
  return { root: feats.root, asked, wearable };
}

describe('FeatsSheet', () => {
  /**
   * Every rank is a title, so every rank reached is a row that wears it — and a
   * rank not yet reached is not offered, since the world would refuse it.
   */
  it('offers every earned rank to wear, and nothing unearned', () => {
    expect(sheet({ rat: 60 }).wearable()).toEqual(['rat-culler', 'rat-hunter']);
    expect(sheet({}).wearable()).toEqual([]);
  });

  it('asks to wear a rank when its row is tapped', () => {
    const { root, asked } = sheet({ rat: 60 });
    root.querySelector<HTMLElement>('[data-title="rat-culler"]')?.click();
    expect(asked).toEqual(['rat-culler']);
  });

  it('takes the worn rank off when its own row is tapped', () => {
    const { root, asked } = sheet({ rat: 60 }, 'rat-hunter');
    const worn = root.querySelector<HTMLElement>('[data-title="rat-hunter"]');
    expect(worn?.classList.contains('is-selected')).toBe(true);
    expect(worn?.textContent).toContain('Worn');
    worn?.click();
    expect(asked).toEqual([null]);
  });

  it('pins what is worn, with a way to take it off', () => {
    const { root, asked } = sheet({ rat: 60 }, 'rat-hunter');
    const pinned = root.querySelector<HTMLElement>('.hud-titles');
    expect(pinned?.textContent).toContain('Title: Rat Hunter');
    pinned?.querySelector<HTMLElement>('[data-title="none"]')?.click();
    expect(asked).toEqual([null]);
  });

  // Before the first rank, the pinned line is the only place a new player
  // learns that the ranks below are titles at all.
  it('says what a title is before any is earned', () => {
    const pinned = sheet({ rat: 3 }).root.querySelector('.hud-titles');
    expect(pinned?.textContent).toContain('the first at 25 slain');
  });

  it('counts an unreached rank in kills, with its unit', () => {
    const { root } = sheet({ rat: 3 });
    const tiers = [...root.querySelectorAll('.hud-row--tier')].map((row) => row.textContent);
    expect(tiers).toContain('Rat Culler3 / 25 slain');
  });
});
