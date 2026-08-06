import type { UiEventMap, UiEventName } from '../ui/uiEvents';
import type { EventBus } from './worldEvents';

type Handler = (...args: never[]) => void;

/**
 * The HUD channel, with no engine underneath it.
 *
 * The world emits, the HUD subscribes, both unsubscribe: exactly the subset
 * `EventBus` names and nothing more. One rule here is not obvious and is
 * tested — a handler that subscribes or unsubscribes while an event is being
 * delivered does not disturb that delivery.
 */
/**
 * Everything one long-lived listener took out of the bus, and the one call that
 * gives it all back.
 *
 * Both are plain functions rather than methods, so `const { listen } = ...` at
 * the top of a subscribe block is safe.
 */
export interface Subscriptions {
  readonly listen: <K extends UiEventName>(
    event: K,
    handler: (...args: UiEventMap[K]) => void,
  ) => void;
  readonly clear: () => void;
}

/**
 * The bookkeeping behind unsubscribing, for the two things that outlive a lot
 * of events and have to drop every one of them: the world, torn down on a zone
 * change, and the HUD, torn down with the session.
 *
 * Both kept a list of `[event, handler]` pairs and looped it calling `off`,
 * which is a weaker thing to hold than the `off` call itself — nothing relates
 * the two halves of the pair, and the list could not be typed while the bus was
 * not. A closure over both is one value that cannot be half-used.
 */
export function createSubscriptions(events: EventBus): Subscriptions {
  const undo: Array<() => void> = [];
  return {
    listen(event, handler) {
      events.on(event, handler);
      undo.push(() => events.off(event, handler));
    },
    clear() {
      undo.forEach((off) => off());
      undo.length = 0;
    },
  };
}

export function createEventBus(): EventBus {
  const listeners = new Map<string, Handler[]>();

  return {
    emit(event: string, ...args: unknown[]) {
      // A copy, so a handler that unsubscribes itself — or emits — cannot
      // reshape the list being walked.
      const current = listeners.get(event)?.slice();
      current?.forEach((fn) => {
        (fn as (...values: unknown[]) => void)(...args);
      });
      return current !== undefined && current.length > 0;
    },

    on<K extends UiEventName>(event: K, fn: (...args: UiEventMap[K]) => void) {
      const existing = listeners.get(event);
      if (existing) {
        existing.push(fn as Handler);
      } else {
        listeners.set(event, [fn as Handler]);
      }
      return this;
    },

    off<K extends UiEventName>(event: K, fn: (...args: UiEventMap[K]) => void) {
      const existing = listeners.get(event);
      if (!existing) return this;
      const index = existing.indexOf(fn as Handler);
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
