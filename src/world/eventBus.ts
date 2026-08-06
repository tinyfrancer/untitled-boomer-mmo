import type { UiEventMap, UiEventName } from '../ui/uiEvents';
import type { EventBus } from './worldEvents';

type Handler = (...args: never[]) => void;
type Listener = { fn: Handler; context?: unknown };

/**
 * The HUD channel, with no engine underneath it.
 *
 * The world emits, the HUD subscribes, both unsubscribe: exactly the subset
 * `EventBus` names and nothing more. It was written against the semantics of
 * the game engine's global emitter, which is where the two rules that would
 * otherwise bite come from — a listener is identified by its function *and*
 * its context (`on(EVENT, this.method, this)` is the shape every subscription
 * in the HUD uses), and a handler that subscribes or unsubscribes while an
 * event is being delivered does not disturb that delivery.
 */
export function createEventBus(): EventBus {
  const listeners = new Map<string, Listener[]>();

  return {
    emit(event: string, ...args: unknown[]) {
      // A copy, so a handler that unsubscribes itself — or emits — cannot
      // reshape the list being walked.
      const current = listeners.get(event)?.slice();
      current?.forEach(({ fn, context }) => {
        (fn as (...values: unknown[]) => void).apply(context, args);
      });
      return current !== undefined && current.length > 0;
    },

    on<K extends UiEventName>(event: K, fn: (...args: UiEventMap[K]) => void, context?: unknown) {
      const existing = listeners.get(event);
      if (existing) {
        existing.push({ fn: fn as Handler, context });
      } else {
        listeners.set(event, [{ fn: fn as Handler, context }]);
      }
      return this;
    },

    off<K extends UiEventName>(event: K, fn: (...args: UiEventMap[K]) => void, context?: unknown) {
      const existing = listeners.get(event);
      if (!existing) return this;
      const index = existing.findIndex(
        (listener) => listener.fn === (fn as Handler) && listener.context === context,
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
