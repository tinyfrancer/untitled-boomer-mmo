import { afterEach, describe, expect, it } from 'vitest';
import { StationModal, type StationPanelState } from '../../src/hud/StationModal';
import { RECIPES, STATION_LABELS, STATION_SKILLS, type StationId } from '../../src/data/recipes';
import { SKILLS } from '../../src/data/skills';
import { recipesAt } from '../../src/systems/CraftingSystem';
import { createInitialSkills } from '../../src/systems/SkillSystem';
import type { RecipeId } from '../../src/types/ids';

/**
 * The panel that used to be the forge's.
 *
 * Everything that made it the forge's is a lookup now — the title, the rows, and
 * the skill the level gates are drawn against — and the way that stops being
 * true is subtle: nothing *breaks* when a second station opens a panel headed
 * "Forge" listing rows gated on Smithing, it just quietly lies. So the cases
 * here are run over every station there is rather than over the two that exist
 * today.
 */

const OPEN: StationId[] = ['forge', 'tannery'];

let modal: StationModal | null = null;

afterEach(() => {
  modal?.close();
  modal = null;
});

function open(station: StationId, state: Partial<StationPanelState> = {}): StationModal {
  modal = new StationModal(station, { onMake: () => {}, onDismiss: () => {} }, () => {});
  modal.update({ inventory: {}, skills: createInitialSkills(), ...state });
  document.body.append(modal.root);
  return modal;
}

const rows = (panel: StationModal): string[] =>
  [...panel.root.querySelectorAll<HTMLElement>('[data-recipe]')].map(
    (row) => row.dataset.recipe ?? '',
  );

describe('a station panel', () => {
  it.each(OPEN)('is headed with the station it was opened at: %s', (station) => {
    const panel = open(station);
    expect(panel.root.querySelector('.hud-modal__title')?.textContent).toBe(
      STATION_LABELS[station],
    );
    expect(panel.station).toBe(station);
  });

  it.each(OPEN)('lists everything made at %s and nothing made elsewhere', (station) => {
    expect(rows(open(station)).sort()).toEqual(
      recipesAt(station)
        .map((r) => r.id)
        .sort(),
    );
  });

  /**
   * The one that would go wrong silently. A row's gate is drawn as a skill name
   * and a number, and a panel that asked the wrong skill for the player's level
   * would shut rows that are open and open rows that are shut — while still
   * looking exactly right.
   */
  it.each(OPEN)('draws %s gates against that station’s own skill', (station) => {
    const skill = STATION_SKILLS[station];
    const deepest = recipesAt(station).reduce((a, b) =>
      a.requiredLevel > b.requiredLevel ? a : b,
    );

    // One level short of the deepest row: it is shut, and says so in the
    // station's skill rather than in anybody else's.
    const shut = open(station, {
      skills: { ...createInitialSkills(), [skill]: { level: deepest.requiredLevel - 1, xp: 0 } },
    });
    const locked = shut.root.querySelector<HTMLElement>(`[data-locked="${deepest.id}"]`);
    expect(locked, `${deepest.id} should be shut`).not.toBeNull();
    expect(locked?.textContent).toContain(SKILLS[skill].name);
    expect(locked?.textContent).toContain(String(deepest.requiredLevel));

    // And one level in, it is open.
    shut.close();
    const openPanel = open(station, {
      skills: { ...createInitialSkills(), [skill]: { level: deepest.requiredLevel, xp: 0 } },
    });
    expect(openPanel.root.querySelector(`[data-locked="${deepest.id}"]`)).toBeNull();
  });

  // What a row takes, against what is in the pack: the whole of why a row that
  // looks affordable is refused, said before the tap rather than after it.
  it('counts each input against the bag under the row', () => {
    const cowl: RecipeId = 'fenhide-cowl';
    const panel = open('tannery', { inventory: { 'cured-leather': 1 } });
    const note = panel.root.querySelector<HTMLElement>(`[data-recipe="${cowl}"]`)?.parentElement
      ?.lastElementChild;

    for (const input of RECIPES[cowl].inputs) {
      expect(note?.textContent).toContain(`${input.quantity}`);
    }
    expect(note?.textContent).toContain('1/2');
  });
});
