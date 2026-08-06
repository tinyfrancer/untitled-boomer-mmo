import { describe, expect, it, vi } from 'vitest';
import { createEventBus } from '../../src/world/eventBus';

describe('createEventBus', () => {
  it('delivers an event to every listener, with its arguments', () => {
    const bus = createEventBus();
    const first = vi.fn();
    const second = vi.fn();
    bus.on('xp-gained', first);
    bus.on('xp-gained', second);

    bus.emit('xp-gained', 2, 30, 100);

    expect(first).toHaveBeenCalledWith(2, 30, 100);
    expect(second).toHaveBeenCalledWith(2, 30, 100);
  });

  it('ignores events nobody is listening for', () => {
    const bus = createEventBus();
    expect(() => bus.emit('level-up', 2)).not.toThrow();
  });

  // A listener is identified by its function alone, so the same function
  // subscribed twice is two subscriptions and takes two `off`s to drop — which
  // is what the subscribe-and-unsubscribe pairs in the world and the HUD are.
  it('drops one subscription per off, when the same function subscribed twice', () => {
    const bus = createEventBus();
    const handle = vi.fn();
    bus.on('target-cleared', handle);
    bus.on('target-cleared', handle);

    bus.off('target-cleared', handle);
    bus.emit('target-cleared');

    expect(handle).toHaveBeenCalledTimes(1);
  });

  it('stops calling a listener that has been removed', () => {
    const bus = createEventBus();
    const listener = vi.fn();
    bus.on('inventory-changed', listener);
    bus.off('inventory-changed', listener);

    bus.emit('inventory-changed', {});

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
    bus.on('gather-ended', () => bus.on('gather-ended', late));

    bus.emit('gather-ended');

    expect(late).not.toHaveBeenCalled();
  });
});
