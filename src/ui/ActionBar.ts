import Phaser from 'phaser';
import { abilitiesFor } from '../systems/AbilitySystem';
import { THEME, fontPx, px } from './theme';
import type { Rect } from './layout';
import type { AbilityState } from './uiEvents';
import type { AbilityId, ClassId } from '../types/ids';

interface AbilityButton {
  background: Phaser.GameObjects.Rectangle;
  // Drawn from the bottom up as the cooldown runs down, so a glance at the bar
  // says how long is left without reading a number.
  sweep: Phaser.GameObjects.Rectangle;
  size: number;
  y: number;
}

/**
 * The ability buttons, pinned to the bottom left where a thumb reaches them.
 * Deliberately not bottom centre: the camera keeps the player centred, so the
 * bottom middle of the screen is where the ground and the signposts just south
 * of them are tapped — a bar there swallows the mobile way out of a zone.
 * Keyboard players get 1 and 2 for the same two slots.
 *
 * Where it sits comes from ui/layout.ts rather than from the screen height, so
 * the stack above the tab bar is one piece of arithmetic under test.
 */
export class ActionBar {
  private readonly container: Phaser.GameObjects.Container;
  private readonly buttons: Map<AbilityId, AbilityButton> = new Map();
  // What anything stacked above the bar hangs off.
  readonly top: number;

  constructor(
    scene: Phaser.Scene,
    scale: number,
    classId: ClassId,
    rect: Rect,
    onUse: (abilityId: AbilityId) => void,
  ) {
    const abilities = abilitiesFor(classId);
    const size = px(THEME.touchMin + 8, scale);
    const gap = px(THEME.padding, scale);
    const left = rect.x;
    const top = rect.y;

    const children: Phaser.GameObjects.GameObject[] = [];

    abilities.forEach((ability, index) => {
      const x = left + index * (size + gap);

      const background = scene.add
        .rectangle(x, top, size, size, THEME.buttonBg, THEME.buttonAlpha)
        .setOrigin(0, 0)
        .setStrokeStyle(px(1, scale), THEME.panelStroke)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => onUse(ability.id));

      // Sits above the background but below the text; height is set per update.
      const sweep = scene.add.rectangle(x, top + size, size, 0, 0x000000, 0.6).setOrigin(0, 1);

      const name = scene.add
        .text(x + size / 2, top + size / 2, ability.name.replace(' ', '\n'), {
          fontSize: fontPx(THEME.font.xs, scale),
          color: THEME.color.text,
          align: 'center',
        })
        .setOrigin(0.5);

      // Slot number doubles as the keyboard hint.
      const slot = scene.add.text(x + px(4, scale), top + px(2, scale), `${index + 1}`, {
        fontSize: fontPx(THEME.font.xs, scale),
        color: THEME.color.dim,
      });

      const cost = scene.add
        .text(
          x + size / 2,
          top + size + px(3, scale),
          ability.manaCost > 0 ? `${ability.manaCost} mana` : 'no cost',
          { fontSize: fontPx(THEME.font.xs, scale), color: THEME.color.dim },
        )
        .setOrigin(0.5, 0);

      this.buttons.set(ability.id, { background, sweep, size, y: top });
      children.push(background, sweep, name, slot, cost);
    });

    this.top = top;
    this.container = scene.add.container(0, 0, children).setScrollFactor(0).setDepth(500);
  }

  update(states: AbilityState[]): void {
    states.forEach((state) => {
      const button = this.buttons.get(state.abilityId);
      if (!button) return;
      button.sweep.height = button.size * state.cooldownRemaining;
      // Dim the whole button when it can't be pressed, whatever the reason.
      button.background.setFillStyle(THEME.buttonBg, state.usable ? THEME.buttonAlpha : 0.4);
      button.background.setStrokeStyle(1, state.usable ? THEME.panelStroke : 0x333333);
    });
  }

  destroy(): void {
    this.container.destroy(true);
  }
}
