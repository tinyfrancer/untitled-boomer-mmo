import Phaser from 'phaser';
import { consumableFor, describeItemBonuses, describeItemName, isEquippable } from '../data/items';
import { formatCurrency } from '../systems/CurrencySystem';
import type { ItemAction, ItemActionId } from '../systems/ItemActionsSystem';
import { THEME, fontPx, px } from './theme';

const TITLE_ROW = 22;
const ACTION_ROW = 36;
const ACTION_BUTTON_HEIGHT = 30;
// A press that travels further than this is a scroll drag, not a tap — row
// selection and action buttons fire on release and check against it.
const DRAG_THRESHOLD = 8;
const SCROLLBAR_WIDTH = 3;

export function inventoryPanelWidth(scale: number): number {
  return px(THEME.panelWidth.inventory, scale);
}

/**
 * The bag. Tapping a row selects the item and unfolds a row of action buttons
 * under it — Equip, Eat, Light Fire, Cook, Sell — supplied by the scene from
 * ItemActionsSystem, so what the item can do lives in one place and the panel
 * only draws it.
 *
 * The row list lives in a masked viewport capped at maxHeight and scrolls:
 * mouse wheel over the panel on desktop, drag on touch. Taps commit on
 * release so a scroll drag that starts on a row doesn't select it.
 */
export class InventoryPanel {
  private readonly scene: Phaser.Scene;
  private readonly scale: number;
  private readonly panelX: number;
  private readonly panelY: number;
  private readonly maxHeight: number;
  private readonly container: Phaser.GameObjects.Container;
  private readonly background: Phaser.GameObjects.Rectangle;
  private readonly rowsViewport: Phaser.GameObjects.Container;
  private readonly maskGraphics: Phaser.GameObjects.Graphics;
  private readonly scrollTrack: Phaser.GameObjects.Rectangle;
  private readonly scrollThumb: Phaser.GameObjects.Rectangle;
  private currencyText!: Phaser.GameObjects.Text;
  private rowObjects: Phaser.GameObjects.GameObject[] = [];
  private readonly actionsFor: (itemId: string) => ItemAction[];
  private readonly onAction: (actionId: ItemActionId, itemId: string) => void;
  private inventory: Record<string, number> = {};
  private selectedItemId: string | null = null;
  private scrollY = 0;
  private contentHeight = 0;
  private viewportHeight = 0;
  private dragPointerId: number | null = null;
  private dragStartY = 0;
  private dragStartScroll = 0;
  private dragDistance = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    scale: number,
    maxHeight: number,
    actionsFor: (itemId: string) => ItemAction[],
    onAction: (actionId: ItemActionId, itemId: string) => void,
  ) {
    this.scene = scene;
    this.scale = scale;
    this.panelX = x;
    this.panelY = y;
    this.maxHeight = maxHeight;
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

    this.rowsViewport = scene.add.container(0, this.rowsTop());

    this.scrollTrack = scene.add
      .rectangle(
        width - px(SCROLLBAR_WIDTH + 3, scale),
        0,
        px(SCROLLBAR_WIDTH, scale),
        0,
        0xffffff,
        0.12,
      )
      .setOrigin(0, 0)
      .setVisible(false);
    this.scrollThumb = scene.add
      .rectangle(
        width - px(SCROLLBAR_WIDTH + 3, scale),
        0,
        px(SCROLLBAR_WIDTH, scale),
        0,
        0xffffff,
        0.45,
      )
      .setOrigin(0, 0)
      .setVisible(false);

    this.container = scene.add
      .container(x, y, [
        this.background,
        title,
        this.currencyText,
        this.rowsViewport,
        this.scrollTrack,
        this.scrollThumb,
      ])
      .setScrollFactor(0)
      .setVisible(false);

    // The viewport mask lives in screen space; the UI camera never scrolls,
    // so the panel's fixed position doubles as its screen rect. Not on the
    // display list — destroy() owns it.
    this.maskGraphics = scene.make.graphics({}, false);
    this.rowsViewport.setMask(this.maskGraphics.createGeometryMask());

    this.scene.input.on(Phaser.Input.Events.POINTER_WHEEL, this.handleWheel, this);
    this.scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.handleDragStart, this);
    this.scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.handleDragMove, this);
    this.scene.input.on(Phaser.Input.Events.POINTER_UP, this.handleDragEnd, this);
  }

  private rowsTop(): number {
    return px(THEME.padding + TITLE_ROW, this.scale);
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
    let cursorY = 0;

    const entries = Object.entries(this.inventory).filter(([, quantity]) => quantity > 0);
    entries.forEach(([itemId, quantity]) => {
      const rowY = cursorY;
      const selected = itemId === this.selectedItemId;

      const hit = this.scene.add
        .rectangle(pad, rowY, width - pad * 2, rowHeight, 0xffffff, selected ? 0.14 : 0.05)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => {
        if (this.dragDistance >= DRAG_THRESHOLD) return;
        this.selectedItemId = selected ? null : itemId;
        this.render();
      });
      this.rowsViewport.add(hit);
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
      this.rowsViewport.add([name, bonuses]);
      this.rowObjects.push(name, bonuses);
      cursorY += rowHeight;

      if (selected) {
        cursorY = this.renderActionRow(itemId, cursorY);
      }
    });

    this.contentHeight = cursorY;
    const maxViewport = Math.max(rowHeight, this.maxHeight - this.rowsTop() - pad);
    this.viewportHeight = Math.min(this.contentHeight, maxViewport);

    // setSize, not a bare .height write: only setSize refreshes the shape's
    // drawn geometry, so the fill and outline actually grow with the rows.
    this.background.setSize(width, this.rowsTop() + this.viewportHeight + pad);
    // The hit area was sized at setInteractive() time; keep it in step with the
    // background as rows come and go.
    (this.background.input?.hitArea as Phaser.Geom.Rectangle | undefined)?.setSize(
      width,
      this.background.height,
    );

    this.applyScroll();
  }

  private maxScroll(): number {
    return Math.max(0, this.contentHeight - this.viewportHeight);
  }

  private scrollBy(delta: number): void {
    this.scrollY = Phaser.Math.Clamp(this.scrollY + delta, 0, this.maxScroll());
    this.applyScroll();
  }

  private applyScroll(): void {
    this.scrollY = Phaser.Math.Clamp(this.scrollY, 0, this.maxScroll());
    this.rowsViewport.y = this.rowsTop() - this.scrollY;

    this.maskGraphics.clear();
    this.maskGraphics.fillStyle(0xffffff);
    this.maskGraphics.fillRect(
      this.panelX,
      this.panelY + this.rowsTop(),
      inventoryPanelWidth(this.scale),
      this.viewportHeight,
    );

    // Rows scrolled out of the viewport are masked invisible, but their input
    // would still catch taps through whatever sits below the panel — keep
    // input on exactly the rows that intersect the visible window.
    const windowTop = this.scrollY;
    const windowBottom = this.scrollY + this.viewportHeight;
    for (const object of this.rowObjects) {
      const zoneObject = object as Phaser.GameObjects.Rectangle;
      if (!zoneObject.input) continue;
      const top = zoneObject.y;
      const bottom = zoneObject.y + zoneObject.height;
      zoneObject.input.enabled = bottom > windowTop && top < windowBottom;
    }

    const scrollable = this.maxScroll() > 0;
    this.scrollTrack.setVisible(scrollable && this.container.visible);
    this.scrollThumb.setVisible(scrollable && this.container.visible);
    if (scrollable) {
      const trackTop = this.rowsTop();
      this.scrollTrack.setPosition(this.scrollTrack.x, trackTop);
      this.scrollTrack.setSize(this.scrollTrack.width, this.viewportHeight);
      const thumbHeight = Math.max(
        px(16, this.scale),
        (this.viewportHeight / this.contentHeight) * this.viewportHeight,
      );
      const thumbTravel = this.viewportHeight - thumbHeight;
      const thumbY = trackTop + (this.scrollY / this.maxScroll()) * thumbTravel;
      this.scrollThumb.setPosition(this.scrollThumb.x, thumbY);
      this.scrollThumb.setSize(this.scrollThumb.width, thumbHeight);
    }
  }

  private pointerInViewport(pointer: Phaser.Input.Pointer): boolean {
    return (
      this.container.visible &&
      pointer.x >= this.panelX &&
      pointer.x <= this.panelX + inventoryPanelWidth(this.scale) &&
      pointer.y >= this.panelY + this.rowsTop() &&
      pointer.y <= this.panelY + this.rowsTop() + this.viewportHeight
    );
  }

  private handleWheel = (
    pointer: Phaser.Input.Pointer,
    _over: unknown,
    _dx: number,
    dy: number,
  ): void => {
    if (this.pointerInViewport(pointer)) {
      this.scrollBy(dy * 0.5);
    }
  };

  private handleDragStart = (pointer: Phaser.Input.Pointer): void => {
    this.dragDistance = 0;
    if (!this.pointerInViewport(pointer)) return;
    this.dragPointerId = pointer.id;
    this.dragStartY = pointer.y;
    this.dragStartScroll = this.scrollY;
  };

  private handleDragMove = (pointer: Phaser.Input.Pointer): void => {
    if (pointer.id !== this.dragPointerId || !pointer.isDown) return;
    this.dragDistance = Math.abs(pointer.y - this.dragStartY);
    if (this.dragDistance >= DRAG_THRESHOLD && this.maxScroll() > 0) {
      this.scrollY = Phaser.Math.Clamp(
        this.dragStartScroll - (pointer.y - this.dragStartY),
        0,
        this.maxScroll(),
      );
      this.applyScroll();
    }
  };

  private handleDragEnd = (pointer: Phaser.Input.Pointer): void => {
    if (pointer.id === this.dragPointerId) {
      this.dragPointerId = null;
    }
  };

  private renderActionRow(itemId: string, y: number): number {
    const scale = this.scale;
    const pad = px(THEME.padding, scale);
    const actions = this.actionsFor(itemId);

    if (actions.length === 0) {
      const note = this.scene.add.text(pad * 2, y + px(6, scale), '(nothing to do with this)', {
        fontSize: fontPx(THEME.font.xs, scale),
        color: THEME.color.dim,
      });
      this.rowsViewport.add(note);
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
      button.on('pointerup', () => {
        if (this.dragDistance >= DRAG_THRESHOLD) return;
        this.onAction(action.id, itemId);
      });
      label.setPosition(buttonX + pad, y + px(2, scale) + (buttonHeight - label.height) / 2);

      this.rowsViewport.add([button, label]);
      this.rowsViewport.bringToTop(label);
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
    this.applyScroll();
  }

  toggle(): void {
    this.setVisible(!this.container.visible);
  }

  destroy(): void {
    this.scene.input.off(Phaser.Input.Events.POINTER_WHEEL, this.handleWheel, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.handleDragStart, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.handleDragMove, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.handleDragEnd, this);
    this.maskGraphics.destroy();
    this.container.destroy(true);
  }
}
