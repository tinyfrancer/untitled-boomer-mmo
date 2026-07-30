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
.hud-solid {
  pointer-events: auto;
}

/* --- Shared chrome ------------------------------------------------------- */

.hud-panel {
  position: absolute;
  pointer-events: auto;
  background: ${cssRgba(THEME.panelBg, THEME.panelAlpha)};
  border: 1px solid ${cssColor(THEME.panelStroke)};
  padding: ${THEME.padding}px;
}
.hud-panel--sheet {
  background: ${cssRgba(THEME.panelBg, THEME.sheetAlpha)};
}
.hud-title {
  font-size: ${THEME.font.md}px;
  font-weight: bold;
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
.hud-player--hidden {
  display: none;
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
.hud-hidden {
  display: none;
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

/* --- Modals -------------------------------------------------------------- */

.hud-modal {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
}
.hud-modal__box {
  width: 280px;
  max-width: calc(100% - ${THEME.margin * 2}px);
  background: ${cssRgba(THEME.panelBg, 0.95)};
  border: 1px solid ${cssColor(THEME.panelStroke)};
  padding: ${THEME.padding}px;
  display: flex;
  flex-direction: column;
  gap: ${THEME.padding}px;
}
.hud-modal__title {
  font-size: ${THEME.font.lg}px;
  font-weight: bold;
}
.hud-modal__danger {
  color: ${THEME.color.playerDamage};
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
