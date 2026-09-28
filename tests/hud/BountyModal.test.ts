import { afterEach, describe, expect, it } from 'vitest';
import { BountyModal, type BountyPanelState } from '../../src/hud/BountyModal';
import { BOUNTY_ORDER } from '../../src/data/bounties';

/**
 * The quartermaster's board.
 *
 * Two things about it are the HUD's alone, since the world neither knows nor
 * cares: that it says contracts come back, and that giving one back is a
 * button away from handing it in and has to be pressed twice.
 */

let modal: BountyModal | null = null;
let abandoned = 0;
let handedIn: string[] = [];

afterEach(() => {
  modal?.close();
  modal = null;
  abandoned = 0;
  handedIn = [];
});

const FREE: BountyPanelState = {
  level: 1,
  bounty: null,
  currency: 0,
  inventory: {},
  kills: {},
  visits: {},
};
const HELD: BountyPanelState = { ...FREE, bounty: { bountyId: 'rat-cull', baseline: 0 } };

function open(state: BountyPanelState): BountyModal {
  modal = new BountyModal(
    {
      onAccept: () => {},
      onTurnIn: (bountyId) => handedIn.push(bountyId),
      onAbandon: () => {
        abandoned += 1;
      },
      onDismiss: () => {},
    },
    () => {},
  );
  modal.update(state);
  document.body.append(modal.root);
  return modal;
}

const abandonButton = (panel: BountyModal): HTMLButtonElement | null =>
  panel.root.querySelector<HTMLButtonElement>('[data-abandon-bounty]');

describe('the contract board', () => {
  // How often is said once for the whole board, and every contract is marked
  // as coming back — the mark is what sets one apart from a quest beside it.
  it('says once how often a contract comes back, and marks every one repeatable', () => {
    const panel = open(FREE);
    expect(panel.root.querySelectorAll('.hud-board__rule')).toHaveLength(1);
    expect(panel.root.querySelector('.hud-board__rule')?.textContent).toContain(
      'as often as you like',
    );

    const contracts = [...panel.root.querySelectorAll('.hud-contract')];
    expect(contracts).toHaveLength(BOUNTY_ORDER.length);
    for (const contract of contracts) {
      expect(contract.querySelector('.hud-tag')?.textContent).toBe('Repeatable');
    }
  });

  it('offers no way to give back what is not held', () => {
    expect(abandonButton(open(FREE))).toBeNull();
  });

  /**
   * Apart from the row that hands the work in, rather than beside it: the
   * button is not inside the contract's own block, and the row is not a
   * sibling of it the way a stack row's All button is.
   */
  it('puts Abandon under the contract in hand, not beside the row that hands it in', () => {
    const panel = open({ ...HELD, kills: { rat: 15 } });
    const button = abandonButton(panel);
    const row = panel.root.querySelector('.hud-list-row[data-bounty="rat-cull"]');

    expect(button?.dataset.abandonBounty).toBe('rat-cull');
    expect(row?.parentElement?.contains(button ?? null)).toBe(false);
    expect(button?.previousElementSibling?.matches('.hud-contract')).toBe(true);
    expect(panel.root.querySelector('.hud-stack')).toBeNull();
  });

  it('asks twice: the first press arms it and gives nothing back', () => {
    const panel = open(HELD);
    abandonButton(panel)?.click();
    expect(abandoned).toBe(0);
    expect(abandonButton(panel)?.textContent).toBe('Tap again to abandon');
    expect(abandonButton(panel)?.classList.contains('is-armed')).toBe(true);

    abandonButton(panel)?.click();
    expect(abandoned).toBe(1);
  });

  // The list is redrawn on every change to the model, and a kill landing
  // between the two presses is not the player changing their mind.
  it('stays armed through a redraw of the same contract', () => {
    const panel = open(HELD);
    abandonButton(panel)?.click();
    panel.update({ ...HELD, kills: { rat: 3 } });
    expect(abandonButton(panel)?.textContent).toBe('Tap again to abandon');

    abandonButton(panel)?.click();
    expect(abandoned).toBe(1);
  });

  // A different contract in hand is a different question, asked from the top.
  it('disarms when the contract in hand is no longer the one it was armed for', () => {
    const panel = open(HELD);
    abandonButton(panel)?.click();
    panel.update(FREE);
    panel.update({ ...FREE, bounty: { bountyId: 'timber-order', baseline: 0 } });

    expect(abandonButton(panel)?.textContent).toBe('Abandon contract');
    abandonButton(panel)?.click();
    expect(abandoned).toBe(0);
  });

  // The row itself is still what hands the work in, and one press does it.
  it('hands a finished contract in from its row with a single press', () => {
    const panel = open({ ...HELD, kills: { rat: 15 } });
    panel.root.querySelector<HTMLButtonElement>('.hud-list-row[data-bounty="rat-cull"]')?.click();
    expect(handedIn).toEqual(['rat-cull']);
    expect(abandoned).toBe(0);
  });
});
