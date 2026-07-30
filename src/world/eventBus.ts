import type { EventBus } from './worldEvents';

type Listener = { fn: (...args: never[]) => void; context?: unknown };

/**
 * The HUD channel, with no engine underneath it.
 *
 * Phaser's global `game.events` is what satisfies `EventBus` while Phaser is
 * still drawing; the Three.js host has no emitter to borrow, so it brings this
 * one. The subset is exactly what `EventBus` names — the world emits, the HUD
 * subscribes, both unsubscribe — and it matches Phaser's semantics in the two
 * places that would otherwise bite: a listener is identified by its function
 * *and* its context (`on(EVENT, this.method, this)` is the shape every
 * subscription in the scenes uses), and a handler that subscribes or
 * unsubscribes while an event is being delivered does not disturb that
 * delivery.
 */
export function createEventBus(): EventBus {
  const listeners = new Map<string, Listener[]>();

  return {
    emit(event, ...args) {
      // A copy, so a handler that unsubscribes itself — or emits — cannot
      // reshape the list being walked.
      const current = listeners.get(event)?.slice();
      current?.forEach(({ fn, context }) => {
        (fn as (...values: unknown[]) => void).apply(context, args);
      });
      return current !== undefined && current.length > 0;
    },

    on(event, fn, context) {
      const existing = listeners.get(event);
      if (existing) {
        existing.push({ fn, context });
      } else {
        listeners.set(event, [{ fn, context }]);
      }
      return this;
    },

    off(event, fn, context) {
      const existing = listeners.get(event);
      if (!existing) return this;
      const index = existing.findIndex(
        (listener) => listener.fn === fn && listener.context === context,
      );
      if (index >= 0) {
        existing.splice(index, 1);
      }
      if (existing.length === 0) {
        listeners.delete(event);
      }
      return this;
    },
  };
}
