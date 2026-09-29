import { afterEach, describe, expect, it } from 'vitest';
import { ReforgeModal, type ReforgePanelState } from '../../src/hud/ReforgeModal';
import { REFORGES } from '../../src/data/reforges';
import { NO_GEAR } from '../../src/systems/InventorySystem';

/**
 * The fettler's panel.
 *
 * The one thing it does that no other counter does is list what is **worn**, and
 * that is not a nicety: the piece somebody walked here about is almost always
 * the one on their back, and a panel that made them take it off first would be a
 * panel nobody used.
 */

let modal: ReforgeModal | null = null;

afterEach(() => {
  modal?.close();
  modal = null;
});

const STATE: ReforgePanelState = {
  gear: { ...NO_GEAR, helmet: 'steel-helmet', weapon: 'barrow-blade' },
  inventory: { 'brown-helmet': 1, 'reforging-stone': 1, logs: 20 },
  reforges: {},
};

function open(state: Partial<ReforgePanelState> = {}): ReforgeModal {
  modal = new ReforgeModal(
    { ...STATE, ...state },
    { onReforge: () => {}, onDismiss: () => {} },
    () => {},
  );
  document.body.append(modal.root);
  return modal;
}

const pieces = (panel: ReforgeModal): string[] =>
  [...panel.root.querySelectorAll<HTMLElement>('[data-piece]')].map((el) => el.dataset.piece ?? '');

const buttons = (panel: ReforgeModal): string[] =>
  [...panel.root.querySelectorAll<HTMLElement>('[data-reforge]')].map(
    (el) => el.dataset.reforge ?? '',
  );

describe('the fettler panel', () => {
  it('lists what is worn as well as what is in the pack', () => {
    const listed = pieces(open());
    expect(listed).toContain('steel-helmet');
    expect(listed).toContain('barrow-blade');
    expect(listed).toContain('brown-helmet');
  });

  // Gear only. A stone and twenty logs are in the same bag and neither is a
  // thing that can be reforged.
  it('leaves everything that is not gear off it', () => {
    const listed = pieces(open());
    expect(listed).not.toContain('logs');
    expect(listed).not.toContain('reforging-stone');
  });

  /**
   * One row per item id, because a reforge is keyed by item id: two rows for one
   * id would be two buttons doing the same thing to the same piece.
   */
  it('draws one row for a piece that is both worn and spare', () => {
    const listed = pieces(open({ inventory: { 'steel-helmet': 2, 'reforging-stone': 1 } }));
    expect(listed.filter((id) => id === 'steel-helmet')).toHaveLength(1);
  });

  /**
   * A row that cannot be done is drawn anyway and says which half is missing —
   * the same call the gated shop row and the shut zone's cell make. Here it is
   * load-bearing: the missing half is usually a stone, and the stone is a walk
   * back to town.
   */
  it('offers the button only where the whole price is met, and says why not', () => {
    // The helmet has a spare to feed it; the blade has nothing for its slot.
    expect(buttons(open())).toEqual(['steel-helmet']);
    const blade = open().root.querySelector<HTMLElement>('[data-piece="barrow-blade"]');
    expect(blade?.textContent).toContain('second piece');
  });

  it('names the shop when there is no stone in the bag', () => {
    const panel = open({ inventory: { 'brown-helmet': 1 } });
    expect(buttons(panel)).toEqual([]);
    expect(panel.root.textContent).toContain('town');
  });

  // What it could become, before it becomes it: the eligible list is what makes
  // the roll a thing a player can weigh rather than a surprise.
  it('shows what a piece could turn into', () => {
    const row = open().root.querySelector<HTMLElement>('[data-piece="steel-helmet"]');
    expect(row?.textContent).toContain(REFORGES.keen.name);
    expect(row?.textContent).toContain('Attack');
  });

  /**
   * And once it has been worked, the row stops offering and starts reporting.
   * That is the whole of what permanence looks like on a panel — there is no
   * second button, and the name it took is what is left in its place.
   */
  it('reports what a reworked piece became and offers nothing more', () => {
    const panel = open({ reforges: { 'steel-helmet': 'keen' } });
    const row = panel.root.querySelector<HTMLElement>('[data-piece="steel-helmet"]');
    expect(row?.textContent).toContain('Keen Steel Helmet');
    expect(row?.textContent).toContain('already');
    expect(buttons(panel)).not.toContain('steel-helmet');
  });

  it('says so plainly when there is no gear at all', () => {
    const panel = open({ gear: NO_GEAR, inventory: { logs: 3 } });
    expect(pieces(panel)).toEqual([]);
    expect(panel.root.textContent).toContain('no gear');
  });
});
