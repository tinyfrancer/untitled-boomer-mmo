import { TABS, type TabId } from '../ui/tabs';

export interface HudKeyHandlers {
  /**
   * Whether an overlay took the key. Escape falls through when nothing is open,
   * which is what keeps it from swallowing anything else bound to it.
   */
  onEscape: () => boolean;
  onTab: (tab: TabId) => void;
  /** The action bar's slots, by index, in the order it draws them. */
  onAbilitySlot: (slot: number) => void;
}

/**
 * The keyboard half of the HUD. Bound to the window because a key is aimed at
 * nothing in particular, and handed back as its own unbind so whatever bound it
 * is what drops it.
 */
export function bindHudKeys(handlers: HudKeyHandlers): () => void {
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.repeat) {
      return;
    }
    // Never steal a letter from a text field — the name box on the creation
    // screen is one keystroke away from this listener.
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return;
    }

    if (event.key === 'Escape' && handlers.onEscape()) {
      return;
    }

    const key = event.key.toLowerCase();
    const tab = TABS.find((definition) => definition.key === key);
    if (tab) {
      handlers.onTab(tab.id);
      return;
    }
    const slot = ['1', '2'].indexOf(event.key);
    if (slot >= 0) {
      handlers.onAbilitySlot(slot);
    }
  };

  window.addEventListener('keydown', onKeyDown);
  return () => window.removeEventListener('keydown', onKeyDown);
}
