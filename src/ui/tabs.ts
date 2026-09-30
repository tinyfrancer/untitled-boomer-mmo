import type { MarkId } from '../art/icons';

export type TabId =
  | 'character'
  | 'inventory'
  | 'quests'
  | 'idle'
  | 'menu'
  | 'feats'
  | 'log'
  | 'map'
  | 'skills'
  | 'options';

export interface TabDefinition {
  id: TabId;
  label: string;
  /** The picture over its word (`art/icons.ts`), a mark of what the surface holds. */
  icon: MarkId;
  /** A tab opens a sheet; an action just fires and leaves nothing selected. */
  kind: 'sheet' | 'action';
  /** The key that opens it, shown nowhere but bound by the HUD. */
  key?: string;
}

/**
 * What sits on the bottom bar. Bottom-anchored because that is where a thumb
 * rests, and five wide rather than seven narrow.
 *
 * The bar splits its width evenly, so every seat costs every other seat: seven
 * of them gave each one 44.4px on a 375px phone against a `THEME.touchMin` of
 * 44, which is four tenths of a pixel of headroom and no room for an eighth.
 * Five gives each one 66.2px. That is what `menu` buys — the surfaces a player
 * opens occasionally moved behind one seat, so the bar holds the ones they open
 * constantly and a new surface never has to argue with the arithmetic again.
 *
 * Idle is out here rather than in the menu because it is the one tab that shows
 * state: it stays lit while idle runs, and a lit button nobody can see is not
 * an indicator. It opens the idle panel, which says what idle will do before
 * the panel's own button starts it (decision 96).
 */
export const TABS: TabDefinition[] = [
  { id: 'character', label: 'Char', icon: 'bust', kind: 'sheet', key: 'c' },
  { id: 'inventory', label: 'Bag', icon: 'sack', kind: 'sheet', key: 'i' },
  { id: 'quests', label: 'Quests', icon: 'scroll', kind: 'sheet', key: 'q' },
  { id: 'idle', label: 'Idle', icon: 'hourglass', kind: 'sheet', key: 'z' },
  { id: 'menu', label: 'Menu', icon: 'chest', kind: 'action' },
];

/**
 * What the menu holds. These get a grid rather than a row, so a label may be a
 * whole word — the bar's "labels have to stay short" rule stops at its edge.
 */
export const MENU_TABS: TabDefinition[] = [
  { id: 'map', label: 'Map', icon: 'map', kind: 'sheet', key: 'm' },
  { id: 'feats', label: 'Feats', icon: 'trophy', kind: 'sheet', key: 'v' },
  { id: 'skills', label: 'Skills', icon: 'book', kind: 'sheet', key: 'k' },
  { id: 'log', label: 'Combat Log', icon: 'swords', kind: 'sheet', key: 'l' },
  { id: 'options', label: 'Options', icon: 'cog', kind: 'action' },
];

/**
 * Every surface, wherever it is reached from. The keyboard binds against this
 * rather than against `TABS`: a shortcut should open what it names, not walk
 * the player through a menu built for thumbs.
 */
export const ALL_TABS: TabDefinition[] = [...TABS, ...MENU_TABS];

/** Whether a surface lives behind the menu, which is what lights that tab. */
export function isMenuTab(tab: TabId): boolean {
  return MENU_TABS.some((definition) => definition.id === tab);
}
