import { describe, expect, it, vi } from 'vitest';
import { publishOnChange } from '../../src/world/publishOnChange';

/**
 * The mechanism the four HUD publishers share. What is worth pinning is the two
 * things each of them used to spell for itself: that a value which has not moved
 * says nothing, and that "moved" means whatever the signature says it does.
 */

describe('publishOnChange', () => {
  it('publishes the first value, then only the ones that differ', () => {
    let hp = 40;
    const emit = vi.fn();
    const publish = publishOnChange(() => hp, String, emit);

    publish();
    publish();
    hp = 39;
    publish();
    publish();

    expect(emit.mock.calls).toEqual([[40], [39]]);
  });

  it('says nothing at all about a value the seed already claimed', () => {
    const emit = vi.fn();
    const publish = publishOnChange(() => 40, String, emit, '40');

    publish();

    expect(emit).not.toHaveBeenCalled();
  });

  it('compares the signature rather than the value, so a redraw is a decision', () => {
    // The action bar's case: a cooldown that ticks down inside the same rounded
    // fraction is not a button that has changed.
    let remaining = 0.731;
    const emit = vi.fn();
    const publish = publishOnChange(
      () => ({ remaining }),
      (state) => state.remaining.toFixed(2),
      emit,
    );

    publish();
    remaining = 0.734;
    publish();
    remaining = 0.5;
    publish();

    expect(emit.mock.calls).toEqual([[{ remaining: 0.731 }], [{ remaining: 0.5 }]]);
  });
});
