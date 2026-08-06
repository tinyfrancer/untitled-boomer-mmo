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
