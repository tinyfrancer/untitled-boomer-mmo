export type TabId = 'character' | 'inventory' | 'quests' | 'feats' | 'log' | 'camp' | 'options';

export interface TabDefinition {
  id: TabId;
  label: string;
  /** A tab opens a sheet; an action just fires and leaves nothing selected. */
  kind: 'sheet' | 'action';
  /** The key that opens it, shown nowhere but bound by the HUD. */
  key?: string;
}

/**
 * The HUD's only permanent furniture besides the player column and the ability
 * bar. Bottom-anchored because that is where a thumb rests.
 *
 * Labels are short because the bar splits its width evenly: at seven tabs a
 * 375px phone gives each one 44px, which is exactly THEME.touchMin and leaves
 * no room for a word like "Achievements". "Quests" is the longest that fits,
 * and an eighth tab does not fit at all.
 */
export const TABS: TabDefinition[] = [
  { id: 'character', label: 'Char', kind: 'sheet', key: 'c' },
  { id: 'inventory', label: 'Bag', kind: 'sheet', key: 'i' },
  { id: 'quests', label: 'Quests', kind: 'sheet', key: 'q' },
  { id: 'feats', label: 'Feats', kind: 'sheet', key: 'v' },
  { id: 'log', label: 'Log', kind: 'sheet', key: 'l' },
  { id: 'camp', label: 'Camp', kind: 'action', key: 'z' },
  { id: 'options', label: '⚙', kind: 'action' },
];
