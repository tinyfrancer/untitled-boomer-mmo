import { el } from './dom';
import { THEME, cssColor, cssRgba } from '../ui/theme';

const STYLE_ID = 'hud-styles';

/**
 * The HUD's stylesheet, interpolated from THEME so the palette still lives in
 * one place.
 *
 * Written as a string rather than a `.css` file because the values in it are
 * the same ones the layout arithmetic uses, and a second hand-maintained copy
 * of the palette is exactly what the port is trying to avoid. Everything a
 * panel does with a rounded rectangle, a border and a bit of text is CSS now:
 * no masks, no hit areas, no per-object depth.
 */
function hudCss(): string {
  return `
.hud {
  position: absolute;
  inset: 0;
  overflow: hidden;
  /* The overlay itself must never eat a tap meant for the world; every piece
     of furniture that should swallow one opts back in. */
  pointer-events: none;
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  color: ${THEME.color.text};
  -webkit-user-select: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}
.hud * {
  box-sizing: border-box;
}
/* --- Shared chrome ------------------------------------------------------- */

.hud-panel {
  position: absolute;
  pointer-events: auto;
  background: ${cssRgba(THEME.panelBg, THEME.panelAlpha)};
  border: 1px solid ${cssColor(THEME.panelStroke)};
  padding: ${THEME.padding}px;
}
.hud-muted {
  color: ${THEME.color.muted};
}
.hud-dim {
  color: ${THEME.color.dim};
}

.hud-button {
  pointer-events: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: ${THEME.touchMin}px;
  padding: 0 ${THEME.padding}px;
  border: 1px solid #888888;
  background: ${cssRgba(THEME.buttonBg, THEME.buttonAlpha)};
  color: ${THEME.color.text};
  font: inherit;
  font-size: ${THEME.font.md}px;
  text-align: center;
  cursor: pointer;
}
.hud-button:disabled {
  background: ${cssRgba(THEME.buttonBg, 0.4)};
  border-color: #333333;
  cursor: default;
}
.hud-button.is-selected {
  border: 2px solid ${cssColor(THEME.xpFill)};
}
.hud-button.is-lit {
  border: 2px solid ${cssColor(0xffee58)};
}

/* A bar with a fill, which the player column and the skill lists are made of. */
.hud-bar {
  position: relative;
  height: ${THEME.xpBar.height}px;
  background: rgba(0, 0, 0, 0.5);
  overflow: hidden;
}
.hud-bar__fill {
  position: absolute;
  inset: 0 auto 0 0;
  width: 0;
  background: ${cssColor(THEME.xpFill)};
}
.hud-bar__fill--mana {
  background: ${cssColor(THEME.manaFill)};
}
.hud-bar__label {
  position: absolute;
  inset: 0 0 0 4px;
  display: flex;
  align-items: center;
  font-size: ${THEME.font.xs}px;
}

/* --- Player column ------------------------------------------------------- */

.hud-player {
  position: absolute;
  display: flex;
  flex-direction: column;
}
.hud-player__name {
  font-size: ${THEME.font.md}px;
  font-weight: bold;
}
/* On its own line rather than appended to the name: the two together overrun
   the column, and the title is not the part to shrink. */
.hud-player__title {
  font-size: ${THEME.font.sm}px;
  color: ${THEME.color.levelUp};
  line-height: ${THEME.font.sm + 3}px;
}
.hud-player__level {
  font-size: ${THEME.font.md}px;
  margin-top: 2px;
}
.hud-player__xp {
  margin-top: 6px;
}
.hud-player__xp-text {
  font-size: ${THEME.font.xs}px;
  color: ${THEME.color.muted};
  margin-top: 3px;
}
.hud-player__mana {
  margin-top: 5px;
}

/* --- Target frame -------------------------------------------------------- */

.hud-target {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.hud-target__name {
  font-size: ${THEME.font.md}px;
  font-weight: bold;
}
.hud-target__hp {
  font-size: ${THEME.font.sm}px;
  color: ${THEME.color.targetHp};
}

/* --- Quest tracker ------------------------------------------------------- */

/* Deliberately not a panel: no background and it swallows no taps, so the two
   lines it costs are the only screen it takes. */
.hud-tracker {
  position: absolute;
  pointer-events: none;
}
.hud-tracker__line {
  font-size: ${THEME.font.sm}px;
  line-height: 18px;
  color: ${THEME.color.muted};
}
.hud-tracker__line.is-met {
  color: ${THEME.color.levelUp};
}

/* --- Action bar ---------------------------------------------------------- */

.hud-actions {
  position: absolute;
  display: flex;
  gap: ${THEME.padding}px;
}
.hud-ability {
  position: relative;
  width: ${THEME.touchMin + 8}px;
}
.hud-ability__key {
  position: relative;
  pointer-events: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: ${THEME.touchMin + 8}px;
  padding: 0;
  border: 1px solid ${cssColor(THEME.panelStroke)};
  background: ${cssRgba(THEME.buttonBg, THEME.buttonAlpha)};
  color: ${THEME.color.text};
  font: inherit;
  font-size: ${THEME.font.xs}px;
  line-height: 1.2;
  white-space: pre-line;
  cursor: pointer;
  overflow: hidden;
}
.hud-ability__key:disabled {
  background: ${cssRgba(THEME.buttonBg, 0.4)};
  border-color: #333333;
  color: ${THEME.color.text};
  cursor: default;
}
/* Drawn from the bottom up as the cooldown runs down, so a glance says how
   long is left without reading a number. */
.hud-ability__sweep {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 0;
  background: rgba(0, 0, 0, 0.6);
  pointer-events: none;
}
.hud-ability__slot {
  position: absolute;
  top: 2px;
  left: 4px;
  font-size: ${THEME.font.xs}px;
  color: ${THEME.color.dim};
}
.hud-ability__cost {
  margin-top: 3px;
  font-size: ${THEME.font.xs}px;
  color: ${THEME.color.dim};
  text-align: center;
}

/* --- Gather bar and toasts ----------------------------------------------- */

.hud-gather {
  position: absolute;
  left: 50%;
  width: 120px;
  margin-left: -60px;
  pointer-events: none;
}
.hud-gather__label {
  font-size: ${THEME.font.xs}px;
  text-align: center;
  margin-bottom: 4px;
}
.hud-gather__bar {
  height: 10px;
  background: rgba(0, 0, 0, 0.6);
  border: 1px solid ${cssColor(THEME.panelStroke)};
}
/* A utility, so it has to beat whatever display the element sets for itself —
   .hud-sheet is declared later in this file and is otherwise flex. */
.hud-hidden {
  display: none !important;
}

.hud-toast {
  position: absolute;
  left: 0;
  right: 0;
  text-align: center;
  font-size: ${THEME.font.xl}px;
  font-weight: bold;
  pointer-events: none;
  opacity: 0;
}

/* --- Tab bar ------------------------------------------------------------- */

.hud-tabs {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  gap: ${THEME.padding}px;
  padding: ${THEME.padding}px;
  pointer-events: auto;
  background: ${cssRgba(THEME.panelBg, 0.92)};
  border-top: 1px solid ${cssColor(THEME.panelStroke)};
}
.hud-tabs__tab {
  /* Even shares of the width, which is what makes seven tabs exactly clear the
     44px touch minimum on a 375px phone and an eighth impossible. */
  flex: 1 1 0;
  min-width: 0;
  font-size: ${THEME.font.sm}px;
  padding: 0;
}

/* --- Sheets -------------------------------------------------------------- */

/* One sheet is open at a time, so each gets the whole column rather than
   sharing it. 'overflow: hidden' here and 'auto' on the body is the entire
   clipping story. */
.hud-sheet {
  position: absolute;
  display: flex;
  flex-direction: column;
  pointer-events: auto;
  overflow: hidden;
  background: ${cssRgba(THEME.panelBg, THEME.sheetAlpha)};
  border: 1px solid ${cssColor(THEME.panelStroke)};
}
.hud-sheet__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: ${THEME.padding}px;
  padding: ${THEME.padding}px ${THEME.padding}px 4px;
  flex: 0 0 auto;
}
.hud-sheet__title {
  font-size: ${THEME.font.md}px;
  font-weight: bold;
}
.hud-sheet__body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding: 4px ${THEME.padding}px ${THEME.padding}px;
}

/* --- Character sheet ----------------------------------------------------- */

.hud-char__top {
  display: flex;
  gap: ${THEME.padding}px;
  align-items: flex-start;
}
.hud-paperdoll {
  width: ${THEME.paperdollSize}px;
  height: ${THEME.paperdollSize}px;
  flex: 0 0 auto;
}
.hud-char__stats {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: ${THEME.font.sm}px;
  color: ${THEME.color.muted};
}
.hud-slot {
  display: block;
  width: 100%;
  min-height: ${THEME.touchMin}px;
  padding: 4px 6px;
  margin-top: 2px;
  border: 0;
  background: rgba(255, 255, 255, 0.05);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  pointer-events: auto;
}
.hud-slot__head {
  display: flex;
  justify-content: space-between;
  gap: ${THEME.padding}px;
  font-size: ${THEME.font.xs}px;
  color: ${THEME.color.dim};
}
.hud-slot__bonuses {
  color: ${THEME.color.muted};
}
.hud-slot__item {
  font-size: ${THEME.font.sm}px;
  color: ${THEME.color.dim};
}
.hud-slot__item.is-filled {
  color: ${THEME.color.equippable};
}
.hud-section {
  margin-top: ${THEME.padding}px;
  font-size: ${THEME.font.sm}px;
  font-weight: bold;
}
.hud-skill {
  margin-top: 4px;
}
.hud-skill__line {
  display: flex;
  justify-content: space-between;
  gap: ${THEME.padding}px;
  font-size: ${THEME.font.xs}px;
  color: ${THEME.color.muted};
}
.hud-skill__bar {
  height: 3px;
  margin-top: 2px;
}

/* --- Bag ----------------------------------------------------------------- */

.hud-coin {
  font-size: ${THEME.font.sm}px;
  color: ${THEME.color.levelUp};
}
.hud-weight {
  font-size: ${THEME.font.xs}px;
  color: ${THEME.color.muted};
  padding: 0 ${THEME.padding}px 4px;
  flex: 0 0 auto;
}
.hud-weight.is-heavy {
  color: ${THEME.color.equippable};
}
.hud-weight.is-full {
  color: ${THEME.color.playerDamage};
}
.hud-item {
  display: block;
  width: 100%;
  min-height: ${THEME.touchMin}px;
  padding: 6px;
  border: 0;
  background: rgba(255, 255, 255, 0.05);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.hud-item.is-selected {
  background: rgba(255, 255, 255, 0.14);
}
.hud-item__name {
  font-size: ${THEME.font.sm}px;
  color: ${THEME.color.muted};
}
.hud-item__name.is-equippable {
  color: ${THEME.color.equippable};
}
.hud-item__name.is-consumable {
  color: ${THEME.color.skillUp};
}
.hud-item__bonuses {
  font-size: ${THEME.font.xs}px;
  color: ${THEME.color.muted};
}
.hud-item-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 4px 0 6px 6px;
}
.hud-item-actions__none {
  font-size: ${THEME.font.xs}px;
  color: ${THEME.color.dim};
  padding: 6px 0 6px 6px;
}
.hud-item-actions .hud-button {
  min-height: 30px;
  font-size: ${THEME.font.sm}px;
  border-color: ${cssColor(THEME.panelStroke)};
  background: ${cssColor(THEME.buttonBg)};
}

/* --- Quests, feats, log -------------------------------------------------- */

.hud-quest {
  margin-bottom: ${THEME.padding}px;
}
.hud-quest__name {
  font-size: ${THEME.font.md}px;
}
.hud-quest__name.is-done {
  color: ${THEME.color.dim};
}
.hud-quest__line {
  font-size: ${THEME.font.sm}px;
  color: ${THEME.color.muted};
  padding-left: ${THEME.padding}px;
}
.hud-quest__line.is-ready {
  color: ${THEME.color.levelUp};
}
.hud-quest__line.is-done {
  color: ${THEME.color.dim};
}
.hud-quest__reward {
  font-size: ${THEME.font.xs}px;
  color: ${THEME.color.dim};
  padding-left: ${THEME.padding}px;
}

.hud-titles {
  display: flex;
  gap: 6px;
  padding: 0 ${THEME.padding}px ${THEME.padding}px;
  flex: 0 0 auto;
}
.hud-titles .hud-button {
  flex: 1 1 0;
  min-width: 0;
  font-size: ${THEME.font.xs}px;
}
.hud-feat-group {
  margin-bottom: ${THEME.padding}px;
}
.hud-row {
  display: flex;
  justify-content: space-between;
  gap: ${THEME.padding}px;
}
.hud-row--group {
  font-size: ${THEME.font.md}px;
}
.hud-row--tier {
  font-size: ${THEME.font.sm}px;
  color: ${THEME.color.muted};
  padding-left: ${THEME.padding}px;
}
.hud-row--tier.is-earned {
  color: ${THEME.color.levelUp};
}

.hud-log__line {
  font-size: ${THEME.font.xs}px;
  line-height: 15px;
}

/* --- Modals -------------------------------------------------------------- */

.hud-modal {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
}
/* Modals are not full-screen scrims: a tap outside one still has to reach the
   world, or opening the shop would stop the player walking away from it. */
.hud-modal--pass-through {
  pointer-events: none;
}
.hud-modal--pass-through > * {
  pointer-events: auto;
}
.hud-modal--top {
  align-items: flex-start;
  padding-top: 60px;
}
.hud-modal__box {
  width: 280px;
  max-width: calc(100% - ${THEME.margin * 2}px);
  max-height: calc(100% - ${THEME.margin * 2}px);
  background: ${cssRgba(THEME.panelBg, 0.95)};
  border: 1px solid ${cssColor(THEME.panelStroke)};
  padding: ${THEME.padding}px;
  display: flex;
  flex-direction: column;
  gap: ${THEME.padding}px;
  overflow: hidden;
}
.hud-modal__box--shop {
  width: 300px;
  border-color: ${cssColor(0xffd54f)};
  gap: 4px;
}
.hud-modal__title {
  font-size: ${THEME.font.lg}px;
  font-weight: bold;
}
.hud-modal__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${THEME.padding}px;
  flex: 0 0 auto;
}
.hud-modal__body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.hud-modal__close {
  min-height: 24px;
  width: 24px;
  padding: 0;
  font-size: ${THEME.font.sm}px;
  border-color: ${cssColor(THEME.panelStroke)};
  background: ${cssColor(THEME.buttonBg)};
}
.hud-modal__danger {
  color: ${THEME.color.playerDamage};
}
.hud-modal__line {
  font-size: ${THEME.font.sm}px;
  color: ${THEME.color.muted};
  line-height: 20px;
}

/* A list row that reads as a list item rather than a key: no border, and the
   value right-aligned for a price or a count. */
.hud-list-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${THEME.padding}px;
  width: 100%;
  min-height: 34px;
  padding: 0 ${THEME.padding}px;
  margin-bottom: 2px;
  border: 0;
  background: rgba(255, 255, 255, 0.06);
  color: ${THEME.color.text};
  font: inherit;
  font-size: ${THEME.font.sm}px;
  text-align: left;
  cursor: pointer;
  pointer-events: auto;
}
.hud-list-row__value {
  color: ${THEME.color.levelUp};
  white-space: nowrap;
}
.hud-list-row__sub {
  font-size: ${THEME.font.xs}px;
  color: ${THEME.color.muted};
}
.hud-list-header {
  font-size: ${THEME.font.sm}px;
  font-weight: bold;
  color: ${THEME.color.muted};
  margin: ${THEME.padding}px 0 4px;
}
.hud-list-empty {
  font-size: ${THEME.font.sm}px;
  color: ${THEME.color.dim};
  padding: 4px 0;
}

/* --- Character creation -------------------------------------------------- */

.create {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${THEME.margin}px;
  padding: ${THEME.margin}px;
  overflow-y: auto;
  background: #1a1a2e;
  color: ${THEME.color.text};
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  -webkit-tap-highlight-color: transparent;
}
.create * {
  box-sizing: border-box;
}
.create__title {
  margin: 0;
  font-size: ${THEME.font.xl}px;
  font-weight: normal;
}
.create__name {
  width: 220px;
  max-width: 100%;
  padding: 8px 10px;
  /* 16px or larger, or iOS Safari zooms the page when it takes focus. */
  font-size: 16px;
  text-align: center;
}
.create__cards {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: ${THEME.margin * 2}px;
}
.create__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${THEME.padding}px;
  width: 200px;
  padding: ${THEME.padding}px;
  border: 2px solid ${cssColor(0x555577)};
  background: #2a2a4a;
  color: ${THEME.color.text};
  font: inherit;
  cursor: pointer;
}
.create__card.is-selected {
  border-color: ${cssColor(0xffee58)};
}
.create__card-name {
  font-size: ${THEME.font.lg}px;
  font-weight: bold;
}
.create__card-text {
  font-size: ${THEME.font.xs}px;
  color: ${THEME.color.muted};
  text-align: center;
}
.create__begin {
  width: 220px;
  max-width: 100%;
  font-size: ${THEME.font.lg}px;
}
.create__begin:disabled {
  color: ${THEME.color.dim};
}

/* --- Slot picker --------------------------------------------------------- */

.hud-picker {
  position: absolute;
  width: ${THEME.panelWidth.character}px;
  max-height: 60%;
  overflow-y: auto;
  pointer-events: auto;
  background: ${cssRgba(THEME.panelBg, 0.92)};
  border: 1px solid ${cssColor(0xffee58)};
  padding: ${THEME.padding}px;
}
.hud-picker__title {
  font-size: ${THEME.font.md}px;
  font-weight: bold;
  margin-bottom: 4px;
}
.hud-picker__row {
  display: block;
  width: 100%;
  min-height: ${THEME.touchMin}px;
  padding: 4px ${THEME.padding}px;
  border: 0;
  background: rgba(255, 255, 255, 0.06);
  color: ${THEME.color.equippable};
  font: inherit;
  font-size: ${THEME.font.sm}px;
  text-align: left;
  cursor: pointer;
}
`;
}

/** Idempotent: the HUD can be mounted and unmounted many times per page load. */
export function injectHudStyles(): void {
  if (document.getElementById(STYLE_ID)) {
    return;
  }
  const style = el('style');
  style.id = STYLE_ID;
  style.textContent = hudCss();
  document.head.append(style);
}
