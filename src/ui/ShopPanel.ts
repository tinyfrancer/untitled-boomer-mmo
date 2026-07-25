import Phaser from 'phaser';
import { describeItemName, itemValue } from '../data/items';
import { SHOP_STOCK } from '../data/shop';
import { formatCurrency } from '../systems/CurrencySystem';
import { questsForNpc, type QuestLog, type QuestOffer } from '../systems/QuestSystem';
import { Button } from './Button';
import { Panel } from './Panel';
import { THEME, fontPx, px } from './theme';
import type { QuestId } from '../types/ids';

const PANEL_WIDTH = 300;
const TITLE_ROW = 26;
const SECTION_ROW = 20;
const ROW_HEIGHT = 36;

export interface ShopPanelState {
  inventory: Record<string, number>;
  currency: number;
  quests: QuestLog;
}

export interface ShopPanelHandlers {
  onBuy: (itemId: string) => void;
  onSell: (itemId: string) => void;
  onAcceptQuest: (questId: QuestId) => void;
  onTurnInQuest: (questId: QuestId) => void;
  onClose: () => void;
}

/**
 * Everything the shopkeeper does: their quests on top, then their stock, then
 * the sellable half of the bag. One NPC with one interaction radius, so quests
 * are a section here rather than a second panel behind a second conversation.
 *
 * Built on open and destroyed on close, like SlotPicker; rows are re-rendered
 * whenever inventory, coin or the quest log changes.
 */
export class ShopPanel {
  private readonly scene: Phaser.Scene;
  private readonly scale: number;
  private readonly panel: Panel;
  private readonly currencyText: Phaser.GameObjects.Text;
  private readonly handlers: ShopPanelHandlers;
  private rows: Phaser.GameObjects.GameObject[] = [];

  constructor(
    scene: Phaser.Scene,
    scale: number,
    state: ShopPanelState,
    handlers: ShopPanelHandlers,
  ) {
    this.scene = scene;
    this.scale = scale;
    this.handlers = handlers;

    const width = px(PANEL_WIDTH, scale);
    const pad = px(THEME.padding, scale);

    this.panel = new Panel(scene, {
      // Centred horizontally, upper third vertically, clear of the bottom bar.
      x: scene.scale.width / 2 - width / 2,
      y: px(60, scale),
      width,
      height: px(200, scale),
      scale,
      title: 'General Store',
      titleSize: THEME.font.lg,
      alpha: 0.92,
      depth: 1500,
      onClose: handlers.onClose,
    });
    this.panel.background.setStrokeStyle(px(1, scale), 0xffd54f);

    this.currencyText = scene.add
      .text(width - pad - px(28, scale), pad + px(4, scale), '', {
        fontSize: fontPx(THEME.font.sm, scale),
        color: THEME.color.levelUp,
      })
      .setOrigin(1, 0);

    const closeSize = px(24, scale);
    const close = new Button(scene, {
      x: width - pad - closeSize,
      y: pad,
      width: closeSize,
      height: closeSize,
      scale,
      label: 'X',
      fontSize: THEME.font.sm,
      fillAlpha: 1,
      strokeColor: THEME.panelStroke,
      onClick: handlers.onClose,
    });

    this.panel.add(this.currencyText, ...close.objects);
    this.update(state);
  }

  update(state: ShopPanelState): void {
    this.rows.forEach((object) => object.destroy());
    this.rows = [];

    const scale = this.scale;
    const pad = px(THEME.padding, scale);
    const width = px(PANEL_WIDTH, scale);
    const rowHeight = px(ROW_HEIGHT, scale);

    this.currencyText.setText(formatCurrency(state.currency));

    let cursorY = pad + px(TITLE_ROW, scale);

    const offers = questsForNpc('shopkeeper', state.quests, state.inventory).filter(
      (offer) => offer.state !== 'done',
    );
    if (offers.length > 0) {
      cursorY = this.addSectionHeader('Work going', cursorY);
      for (const offer of offers) {
        cursorY = this.addQuestRow(offer, cursorY, rowHeight);
      }
      cursorY += px(4, scale);
    }

    cursorY = this.addSectionHeader('For sale', cursorY);
    for (const entry of SHOP_STOCK) {
      cursorY = this.addRow(
        describeItemName(entry.itemId),
        formatCurrency(entry.price),
        cursorY,
        rowHeight,
        state.currency >= entry.price ? THEME.color.equippable : THEME.color.dim,
        () => this.handlers.onBuy(entry.itemId),
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
      this.panel.add(empty);
      this.rows.push(empty);
      cursorY += rowHeight;
    }
    for (const [itemId, quantity] of sellable) {
      cursorY = this.addRow(
        `${describeItemName(itemId)} x${quantity}`,
        formatCurrency(itemValue(itemId) ?? 0),
        cursorY,
        rowHeight,
        THEME.color.text,
        () => this.handlers.onSell(itemId),
      );
    }

    this.panel.resize(width, cursorY + pad);
  }

  // A quest row says what it wants and how far along it is, so the player never
  // has to open a second panel to decide whether it is worth walking back here.
  private addQuestRow(offer: QuestOffer, y: number, rowHeight: number): number {
    const { definition, state, progress } = offer;
    const ready = state === 'ready';
    const value =
      state === 'available' ? 'Accept' : ready ? 'Hand in' : `${progress.have}/${progress.need}`;

    return this.addRow(
      definition.name,
      value,
      y,
      rowHeight,
      state === 'available' || ready ? THEME.color.levelUp : THEME.color.muted,
      () => {
        if (state === 'available') {
          this.handlers.onAcceptQuest(definition.id);
        } else if (ready) {
          this.handlers.onTurnInQuest(definition.id);
        }
      },
      ready || state === 'available' ? THEME.color.levelUp : THEME.color.dim,
    );
  }

  private addSectionHeader(label: string, y: number): number {
    const header = this.scene.add.text(px(THEME.padding, this.scale), y, label, {
      fontSize: fontPx(THEME.font.sm, this.scale),
      color: THEME.color.muted,
      fontStyle: 'bold',
    });
    this.panel.add(header);
    this.rows.push(header);
    return y + px(SECTION_ROW, this.scale);
  }

  private addRow(
    label: string,
    value: string,
    y: number,
    rowHeight: number,
    labelColor: string,
    onClick: () => void,
    valueColor: string = THEME.color.levelUp,
  ): number {
    const pad = px(THEME.padding, this.scale);
    const row = new Button(this.scene, {
      x: pad,
      y,
      width: px(PANEL_WIDTH, this.scale) - pad * 2,
      height: rowHeight - px(2, this.scale),
      scale: this.scale,
      label,
      value,
      align: 'left',
      color: labelColor,
      valueColor,
      fontSize: THEME.font.sm,
      fill: 0xffffff,
      fillAlpha: 0.06,
      strokeColor: null,
      onClick,
    });
    this.panel.add(...row.objects);
    this.rows.push(...row.objects);
    return y + rowHeight;
  }

  destroy(): void {
    this.panel.destroy();
  }
}
