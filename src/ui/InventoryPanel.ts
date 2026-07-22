import Phaser from 'phaser';
import { consumableFor, describeItemBonuses, describeItemName, isEquippable } from '../data/items';
import { formatCurrency } from '../systems/CurrencySystem';
import type { ItemAction, ItemActionId } from '../systems/ItemActionsSystem';
import { THEME, fontPx, px } from './theme';

const TITLE_ROW = 22;
const ACTION_ROW = 36;
const ACTION_BUTTON_HEIGHT = 30;

export function inventoryPanelWidth(scale: number): number {
  return px(THEME.panelWidth.inventory, scale);
}

/**
 * The bag. Tapping a row selects the item and unfolds a row of action buttons
 * under it — Equip, Eat, Light Fire, Cook, Sell — supplied by the scene from
 * ItemActionsSystem, so what the item can do lives in one place and the panel
 * only draws it.
 */
export class InventoryPanel {
  private readonly scene: Phaser.Scene;
  private readonly scale: number;
  private readonly container: Phaser.GameObjects.Container;
  private readonly background: Phaser.GameObjects.Rectangle;
  private currencyText!: Phaser.GameObjects.Text;
  private rowObjects: Phaser.GameObjects.GameObject[] = [];
  private readonly actionsFor: (itemId: string) => ItemAction[];
  private readonly onAction: (actionId: ItemActionId, itemId: string) => void;
  private inventory: Record<string, number> = {};
  private selectedItemId: string | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    scale: number,
    actionsFor: (itemId: string) => ItemAction[],
    onAction: (actionId: ItemActionId, itemId: string) => void,
  ) {
    this.scene = scene;
    this.scale = scale;
    this.actionsFor = actionsFor;
    this.onAction = onAction;

    const width = inventoryPanelWidth(scale);
    const pad = px(THEME.padding, scale);

    this.background = scene.add
      .rectangle(0, 0, width, pad * 2 + px(TITLE_ROW, scale), THEME.panelBg, THEME.panelAlpha)
      .setOrigin(0, 0)
      .setStrokeStyle(px(1, scale), THEME.panelStroke)
      // Interactive so a click on the panel is seen as a HUD hit and never
      // falls through to the world as a move order.
      .setInteractive();
    const title = scene.add.text(pad, pad, 'Inventory (I)', {
      fontSize: fontPx(THEME.font.md, scale),
      color: THEME.color.text,
      fontStyle: 'bold',
    });

    // Coin lives here rather than as an inventory row: currency is not an item.
    this.currencyText = scene.add
      .text(width - pad, pad + px(2, scale), formatCurrency(0), {
        fontSize: fontPx(THEME.font.sm, scale),
        color: THEME.color.levelUp,
      })
      .setOrigin(1, 0);

    this.container = scene.add
      .container(x, y, [this.background, title, this.currencyText])
      .setScrollFactor(0)
      .setVisible(false);
  }

  setCurrency(totalCopper: number): void {
    this.currencyText.setText(formatCurrency(totalCopper));
  }

  update(inventory: Record<string, number>): void {
    this.inventory = inventory;
    if (this.selectedItemId && (inventory[this.selectedItemId] ?? 0) <= 0) {
      this.selectedItemId = null;
    }
    this.render();
  }

  /** Re-render with the same inventory — for when the action context changes. */
  refreshActions(): void {
    this.render();
  }

  private render(): void {
    this.rowObjects.forEach((object) => object.destroy());
    this.rowObjects = [];

    const scale = this.scale;
    const pad = px(THEME.padding, scale);
    const width = inventoryPanelWidth(scale);
    const rowHeight = px(THEME.touchMin, scale);
    let cursorY = pad + px(TITLE_ROW, scale);

    const entries = Object.entries(this.inventory).filter(([, quantity]) => quantity > 0);
    entries.forEach(([itemId, quantity]) => {
      const rowY = cursorY;
      const selected = itemId === this.selectedItemId;

      const hit = this.scene.add
        .rectangle(pad, rowY, width - pad * 2, rowHeight, 0xffffff, selected ? 0.14 : 0.05)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => {
        this.selectedItemId = selected ? null : itemId;
        this.render();
      });
      this.container.add(hit);
      this.rowObjects.push(hit);

      const name = this.scene.add.text(
        pad * 2,
        rowY + px(6, scale),
        `${describeItemName(itemId)} x${quantity}`,
        {
          fontSize: fontPx(THEME.font.sm, scale),
          color: isEquippable(itemId)
            ? THEME.color.equippable
            : consumableFor(itemId)
              ? THEME.color.skillUp
              : THEME.color.muted,
        },
      );
      const bonuses = this.scene.add.text(
        pad * 2,
        rowY + px(22, scale),
        describeItemBonuses(itemId),
        { fontSize: fontPx(THEME.font.xs, scale), color: THEME.color.muted },
      );
      this.container.add([name, bonuses]);
      this.rowObjects.push(name, bonuses);
      cursorY += rowHeight;

      if (selected) {
        cursorY = this.renderActionRow(itemId, cursorY);
      }
    });

    this.background.height = cursorY + pad;
    // The hit area was sized at setInteractive() time; keep it in step with the
    // background as rows come and go.
    (this.background.input?.hitArea as Phaser.Geom.Rectangle | undefined)?.setSize(
      this.background.width,
      this.background.height,
    );
  }

  private renderActionRow(itemId: string, y: number): number {
    const scale = this.scale;
    const pad = px(THEME.padding, scale);
    const actions = this.actionsFor(itemId);

    if (actions.length === 0) {
      const note = this.scene.add.text(pad * 2, y + px(6, scale), '(nothing to do with this)', {
        fontSize: fontPx(THEME.font.xs, scale),
        color: THEME.color.dim,
      });
      this.container.add(note);
      this.rowObjects.push(note);
      return y + px(ACTION_ROW, scale);
    }

    let buttonX = pad * 2;
    const buttonHeight = px(ACTION_BUTTON_HEIGHT, scale);
    actions.forEach((action) => {
      const label = this.scene.add.text(0, 0, action.label, {
        fontSize: fontPx(THEME.font.sm, scale),
        color: THEME.color.text,
      });
      const buttonWidth = label.width + pad * 2;
      const button = this.scene.add
        .rectangle(buttonX, y + px(2, scale), buttonWidth, buttonHeight, THEME.buttonBg, 1)
        .setOrigin(0, 0)
        .setStrokeStyle(px(1, scale), THEME.panelStroke)
        .setInteractive({ useHandCursor: true });
      button.on('pointerdown', () => this.onAction(action.id, itemId));
      label.setPosition(buttonX + pad, y + px(2, scale) + (buttonHeight - label.height) / 2);

      this.container.add([button, label]);
      this.container.bringToTop(label);
      this.rowObjects.push(button, label);
      buttonX += buttonWidth + px(6, scale);
    });

    return y + px(ACTION_ROW, scale);
  }

  isVisible(): boolean {
    return this.container.visible;
  }

  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }

  toggle(): void {
    this.container.setVisible(!this.container.visible);
  }

  destroy(): void {
    this.container.destroy(true);
  }
}
