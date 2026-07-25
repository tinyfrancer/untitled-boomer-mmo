import Phaser from 'phaser';
import { Button } from './Button';
import { THEME, px } from './theme';
import type { Rect } from './layout';

export type TabId = 'character' | 'inventory' | 'quests' | 'log' | 'camp' | 'options';

// Distinct from the selected-tab blue, so "a sheet is open" and "you are
// camping" never read as the same state.
const CAMP_LIT_COLOR = 0xffee58;

export interface TabDefinition {
  id: TabId;
  label: string;
  /** A tab opens a sheet; an action just fires and leaves nothing selected. */
  kind: 'sheet' | 'action';
}

export const TABS: TabDefinition[] = [
  { id: 'character', label: 'Char', kind: 'sheet' },
  { id: 'inventory', label: 'Bag', kind: 'sheet' },
  { id: 'quests', label: 'Quests', kind: 'sheet' },
  { id: 'log', label: 'Log', kind: 'sheet' },
  { id: 'camp', label: 'Camp', kind: 'action' },
  { id: 'options', label: '⚙', kind: 'action' },
];

/**
 * The HUD's only permanent furniture besides the player column and the ability
 * bar. It replaced a row of five square buttons in the top-left column that had
 * grown to 68% of a phone's width, and would have been 78% with a sixth.
 *
 * Bottom-anchored because that is where a thumb rests. The cost is that it
 * covers the bottom strip of the playfield, which ActionBar's comment warns is
 * where a signpost just south of the player gets tapped — walking closer lifts
 * the signpost up the screen, and the map-edge transition still works besides.
 */
export class TabBar {
  private readonly container: Phaser.GameObjects.Container;
  private readonly buttons: Map<TabId, Button> = new Map();

  constructor(scene: Phaser.Scene, rect: Rect, scale: number, onSelect: (tab: TabId) => void) {
    const padding = px(THEME.padding, scale);
    const background = scene.add
      .rectangle(0, 0, rect.width, rect.height, THEME.panelBg, 0.92)
      .setOrigin(0, 0)
      .setStrokeStyle(px(1, scale), THEME.panelStroke)
      // Interactive so a tap on the bar is a HUD hit, never a move order.
      .setInteractive();

    const objects: Phaser.GameObjects.GameObject[] = [background];
    // Share the width evenly; every tab keeps a full touch target.
    const buttonWidth = (rect.width - padding * (TABS.length + 1)) / TABS.length;

    TABS.forEach((tab, index) => {
      const button = new Button(scene, {
        x: padding + index * (buttonWidth + padding),
        y: padding,
        width: buttonWidth,
        height: rect.height - padding * 2,
        scale,
        label: tab.label,
        fontSize: THEME.font.sm,
        onClick: () => onSelect(tab.id),
      });
      this.buttons.set(tab.id, button);
      objects.push(...button.objects);
    });

    this.container = scene.add.container(rect.x, rect.y, objects).setScrollFactor(0).setDepth(900);
  }

  /** Lights the open sheet's tab, or nothing when the playfield is clear. */
  setSelected(tab: TabId | null): void {
    this.buttons.forEach((button, id) => {
      // Camp is lit by whether it is running, not by what sheet is open.
      if (id !== 'camp') {
        button.setHighlighted(id === tab);
      }
    });
  }

  /**
   * Camping is otherwise invisible — a character fighting on their own looks
   * the same as the player fighting — so the tab stays lit while it runs.
   */
  setCamping(camping: boolean): void {
    this.buttons.get('camp')?.setHighlighted(camping, CAMP_LIT_COLOR);
  }

  destroy(): void {
    this.container.destroy(true);
  }
}
