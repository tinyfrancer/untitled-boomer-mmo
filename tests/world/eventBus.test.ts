import { describe, expect, it, vi } from 'vitest';
import { createEventBus } from '../../src/world/eventBus';

describe('createEventBus', () => {
  it('delivers an event to every listener, with its arguments', () => {
    const bus = createEventBus();
    const first = vi.fn();
    const second = vi.fn();
    bus.on('xp-gained', first);
    bus.on('xp-gained', second);

    bus.emit('xp-gained', 12, { source: 'kill' });

    expect(first).toHaveBeenCalledWith(12, { source: 'kill' });
    expect(second).toHaveBeenCalledWith(12, { source: 'kill' });
  });

  it('ignores events nobody is listening for', () => {
    const bus = createEventBus();
    expect(() => bus.emit('level-up', 2)).not.toThrow();
  });

  it('calls a listener with the context it subscribed with', () => {
    const bus = createEventBus();
    const holder = {
      seen: 0,
      handle(this: { seen: number }, value: number): void {
        this.seen = value;
      },
    };
    bus.on('level-up', holder.handle, holder);

    bus.emit('level-up', 3);

    expect(holder.seen).toBe(3);
  });

  // The shape every subscription in a scene uses. Matching on the function
  // alone would unsubscribe one object's handler when another object dropped
  // its own — which is a HUD that silently stops updating.
  it('tells two subscriptions of the same function apart by their context', () => {
    const bus = createEventBus();
    const seen: string[] = [];
    function handle(this: { name: string }): void {
      seen.push(this.name);
    }
    const a = { name: 'a' };
    const b = { name: 'b' };
    bus.on('target-selected', handle, a);
    bus.on('target-selected', handle, b);

    bus.off('target-selected', handle, a);
    bus.emit('target-selected');

    expect(seen).toEqual(['b']);
  });

  it('stops calling a listener that has been removed', () => {
    const bus = createEventBus();
    const listener = vi.fn();
    bus.on('inventory-changed', listener);
    bus.off('inventory-changed', listener);

    bus.emit('inventory-changed');

    expect(listener).not.toHaveBeenCalled();
  });

  it('survives a listener that unsubscribes itself mid-delivery', () => {
    const bus = createEventBus();
    const second = vi.fn();
    const first = vi.fn(() => bus.off('shop-closed', first));
    bus.on('shop-closed', first);
    bus.on('shop-closed', second);

    bus.emit('shop-closed');
    bus.emit('shop-closed');

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
  });

  it('does not deliver an event to a listener added while it is being delivered', () => {
    const bus = createEventBus();
    const late = vi.fn();
    bus.on('gear-changed', () => bus.on('gear-changed', late));

    bus.emit('gear-changed');

    expect(late).not.toHaveBeenCalled();
  });
});
