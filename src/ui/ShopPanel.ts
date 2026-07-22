import Phaser from 'phaser';
import { describeItemName, itemValue } from '../data/items';
import { SHOP_STOCK } from '../data/shop';
import { formatCurrency } from '../systems/CurrencySystem';
import { THEME, fontPx, px } from './theme';

const PANEL_WIDTH = 300;
const TITLE_ROW = 26;
const SECTION_ROW = 20;
const ROW_HEIGHT = 36;

export interface ShopPanelState {
  inventory: Record<string, number>;
  currency: number;
}

/**
 * The trade window: the shop's stock on top, the sellable half of the bag
 * below. Built on open and destroyed on close, like SlotPicker; rows are
 * re-rendered whenever inventory or coin changes.
 */
export class ShopPanel {
  private readonly scene: Phaser.Scene;
  private readonly scale: number;
  private readonly container: Phaser.GameObjects.Container;
  private readonly background: Phaser.GameObjects.Rectangle;
  private readonly currencyText: Phaser.GameObjects.Text;
  private readonly onBuy: (itemId: string) => void;
  private readonly onSell: (itemId: string) => void;
  private rowObjects: Phaser.GameObjects.GameObject[] = [];

  constructor(
    scene: Phaser.Scene,
    scale: number,
    state: ShopPanelState,
    onBuy: (itemId: string) => void,
    onSell: (itemId: string) => void,
    onClose: () => void,
  ) {
    this.scene = scene;
    this.scale = scale;
    this.onBuy = onBuy;
    this.onSell = onSell;

    const width = px(PANEL_WIDTH, scale);
    const pad = px(THEME.padding, scale);

    this.background = scene.add
      .rectangle(0, 0, width, px(200, scale), THEME.panelBg, 0.92)
      .setOrigin(0, 0)
      .setStrokeStyle(px(1, scale), 0xffd54f)
      // Interactive so a click on the panel never falls through to the world.
      .setInteractive();

    const title = scene.add.text(pad, pad, 'General Store', {
      fontSize: fontPx(THEME.font.lg, scale),
      color: THEME.color.text,
      fontStyle: 'bold',
    });

    this.currencyText = scene.add
      .text(width - pad - px(28, scale), pad + px(4, scale), '', {
        fontSize: fontPx(THEME.font.sm, scale),
        color: THEME.color.levelUp,
      })
      .setOrigin(1, 0);

    const closeSize = px(24, scale);
    const closeButton = scene.add
      .rectangle(width - pad - closeSize, pad, closeSize, closeSize, THEME.buttonBg, 1)
      .setOrigin(0, 0)
      .setStrokeStyle(px(1, scale), THEME.panelStroke)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', onClose);
    const closeLabel = scene.add
      .text(width - pad - closeSize / 2, pad + closeSize / 2, 'X', {
        fontSize: fontPx(THEME.font.sm, scale),
        color: THEME.color.text,
      })
      .setOrigin(0.5);

    // Centered horizontally, upper third vertically, clear of the bottom bar.
    const x = scene.scale.width / 2 - width / 2;
    const y = px(60, scale);
    this.container = scene.add
      .container(x, y, [this.background, title, this.currencyText, closeButton, closeLabel])
      .setScrollFactor(0)
      .setDepth(1500);

    this.update(state);
  }

  update(state: ShopPanelState): void {
    this.rowObjects.forEach((object) => object.destroy());
    this.rowObjects = [];

    const scale = this.scale;
    const pad = px(THEME.padding, scale);
    const width = px(PANEL_WIDTH, scale);
    const rowHeight = px(ROW_HEIGHT, scale);

    this.currencyText.setText(formatCurrency(state.currency));

    let cursorY = pad + px(TITLE_ROW, scale);
    cursorY = this.addSectionHeader('For sale', cursorY);
    for (const entry of SHOP_STOCK) {
      cursorY = this.addRow(
        `${describeItemName(entry.itemId)}`,
        `${formatCurrency(entry.price)}`,
        cursorY,
        rowHeight,
        state.currency >= entry.price ? THEME.color.equippable : THEME.color.dim,
        () => this.onBuy(entry.itemId),
      );
    }

    const sellable = Object.entries(state.inventory).filter(
      ([itemId, quantity]) => quantity > 0 && itemValue(itemId) !== null,
    );
    cursorY = this.addSectionHeader('Sell from your bag', cursorY + px(4, scale));
    if (sellable.length === 0) {
      const empty = this.scene.add.text(pad * 2, cursorY, '(nothing worth selling)', {
        fontSize: fontPx(THEME.font.sm, scale),
        color: THEME.color.dim,
      });
      this.container.add(empty);
      this.rowObjects.push(empty);
      cursorY += rowHeight;
    }
    for (const [itemId, quantity] of sellable) {
      cursorY = this.addRow(
        `${describeItemName(itemId)} x${quantity}`,
        `${formatCurrency(itemValue(itemId) ?? 0)}`,
        cursorY,
        rowHeight,
        THEME.color.text,
        () => this.onSell(itemId),
      );
    }

    this.background.height = cursorY + pad;
    (this.background.input?.hitArea as Phaser.Geom.Rectangle | undefined)?.setSize(
      width,
      this.background.height,
    );
  }

  private addSectionHeader(label: string, y: number): number {
    const pad = px(THEME.padding, this.scale);
    const header = this.scene.add.text(pad, y, label, {
      fontSize: fontPx(THEME.font.sm, this.scale),
      color: THEME.color.muted,
      fontStyle: 'bold',
    });
    this.container.add(header);
    this.rowObjects.push(header);
    return y + px(SECTION_ROW, this.scale);
  }

  private addRow(
    label: string,
    price: string,
    y: number,
    rowHeight: number,
    labelColor: string,
    onClick: () => void,
  ): number {
    const pad = px(THEME.padding, this.scale);
    const width = px(PANEL_WIDTH, this.scale);

    const hit = this.scene.add
      .rectangle(pad, y, width - pad * 2, rowHeight - px(2, this.scale), 0xffffff, 0.06)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', onClick);
    const name = this.scene.add.text(pad * 2, y + px(8, this.scale), label, {
      fontSize: fontPx(THEME.font.sm, this.scale),
      color: labelColor,
    });
    const cost = this.scene.add
      .text(width - pad * 2, y + px(8, this.scale), price, {
        fontSize: fontPx(THEME.font.sm, this.scale),
        color: THEME.color.levelUp,
      })
      .setOrigin(1, 0);

    this.container.add([hit, name, cost]);
    this.rowObjects.push(hit, name, cost);
    return y + rowHeight;
  }

  destroy(): void {
    this.container.destroy(true);
  }
}
