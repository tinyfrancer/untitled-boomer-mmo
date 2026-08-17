import { Sheet } from './Sheet';
import { el, emptyLine, fillPercent, row, sectionHeader } from './dom';
import { SKILLS, SKILL_ORDER } from '../data/skills';
import { MASTERY_TIERS } from '../data/mastery';
import {
  masteryProgress,
  masteryTargetsFor,
  masteryXp,
  type MasteryXp,
} from '../systems/MasterySystem';
import { THEME } from '../ui/theme';

/**
 * Every mastery pool, grouped under the skill that fills it.
 *
 * Grouped by skill rather than listed flat because a pool is only ever compared
 * against its siblings — which tree to chop, which bar to smelt — and never
 * against a pool in another skill. The grouping is `masteryTargetsFor`, so a
 * node or recipe added to either table appears here with nothing written down.
 *
 * A skill with no targets is dropped rather than drawn empty: the combat skills
 * keep no pools, and a header over nothing reads as something missing.
 */
export class MasterySheet extends Sheet {
  constructor() {
    super('Mastery', THEME.panelWidth.character);
  }

  update(mastery: MasteryXp): void {
    this.body.replaceChildren();
    let drew = false;

    for (const skillId of SKILL_ORDER) {
      const targets = masteryTargetsFor(skillId);
      if (targets.length === 0) continue;
      drew = true;
      this.body.append(sectionHeader(SKILLS[skillId].name));

      for (const target of targets) {
        const progress = masteryProgress(mastery, target.id);
        const block = el('div', 'hud-skill');
        // The rung out of five, which is what makes a pool readable next to a
        // sibling at a glance — the raw XP totals differ by an order of
        // magnitude between a tree and a chestplate and compare to nothing.
        const line = row({
          className: 'hud-skill__line',
          label: target.name,
          value: progress.maxed
            ? `${progress.tier.name} (${masteryXp(mastery, target.id)} XP)`
            : `${progress.tier.name} · ${progress.tier.rank}/${MASTERY_TIERS.length}`,
        });
        const bar = el('div', 'hud-bar hud-skill__bar');
        const fill = el('div', 'hud-bar__fill');
        // A maxed pool goes on filling and has nothing left to fill toward, so
        // it reads as full — the same call the capped skill bar makes.
        fill.style.width = fillPercent(progress.maxed ? 1 : progress.ratio);
        bar.append(fill);
        block.append(line.root, bar);
        this.body.append(block);
      }
    }

    if (!drew) {
      this.body.append(emptyLine('Work or make something to start a pool.'));
    }
  }
}
