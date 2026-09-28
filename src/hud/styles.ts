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
  /* Kills double-tap-to-zoom for every piece of furniture below, since a touch
     point takes the intersection of this and its ancestors: tapping a tab or an
     ability button twice quickly is ordinary play, not a request to zoom. It
     still permits panning and pinching, so sheet bodies scroll and the page can
     be scaled back. */
  touch-action: manipulation;
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  color: ${THEME.color.text};
  -webkit-user-select: none;
  user-select: none;
  /* A held finger is how a phone asks what something is, so iOS must not answer
     it first with a copy/share callout over the menu we are opening. */
  -webkit-touch-callout: none;
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
.hud-empty {
  font-size: ${THEME.font.sm}px;
  color: ${THEME.color.dim};
  padding: 4px 0 4px ${THEME.padding}px;
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
  border: 2px solid ${THEME.color.equippable};
}

/* A bar with a fill, which the player column and the skill lists are made of.
   The backing is nearly opaque because these hang over the world with no panel
   behind them: at half alpha the empty end of a bar over grass read as grass,
   which is the one thing a bar exists to answer. */
.hud-bar {
  position: relative;
  height: ${THEME.xpBar.height}px;
  background: rgba(0, 0, 0, 0.78);
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
.hud-bar__fill--quiver {
  background: ${cssColor(THEME.quiverFill)};
}
.hud-bar__fill--hp {
  background: ${cssColor(THEME.hpFill)};
}
.hud-bar__fill--target {
  background: ${THEME.color.targetHp};
}
/* The numbers ride inside the bar rather than under it, so the shadow is what
   keeps them legible over both the fill and the empty half of it. */
.hud-bar__label {
  position: absolute;
  inset: 0 0 0 5px;
  display: flex;
  align-items: center;
  font-size: ${THEME.font.xs}px;
  line-height: 1;
  white-space: nowrap;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.95);
}

/* --- Text over the world ------------------------------------------------ */

/* Everything written straight onto the world rather than onto a panel. The
   world behind it used to end in a dark clear colour at the top of the screen;
   now it runs on into pale haze, and a grey caption over a pale sky is a caption
   nobody reads. The shadow is what the bar labels already wore, doubled with a
   soft halo so a thin glyph keeps an edge over grass, sand and sky alike. */
.hud-player__head,
.hud-player__title,
.hud-effect__name,
.hud-effect__time,
.hud-target__name,
.hud-target__winding,
.hud-tracker__line,
.hud-ability__cost,
.hud-channel__label {
  text-shadow:
    0 0 2px rgba(0, 0, 0, 0.95),
    0 1px 2px rgba(0, 0, 0, 0.95),
    0 0 5px rgba(0, 0, 0, 0.8);
}

/* --- Player column ------------------------------------------------------- */

.hud-player {
  position: absolute;
  display: flex;
  flex-direction: column;
}
/* Name left, level right, one line. The level is pinned to the far end rather
   than following the name, so it is in the same place whoever is playing. */
.hud-player__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: ${THEME.padding}px;
  line-height: 18px;
}
.hud-player__name {
  font-size: ${THEME.font.md}px;
  font-weight: bold;
  /* One line, cut rather than wrapped: a long name must not push the level
     onto a row of its own, which is the whole point of sharing this one. */
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.hud-player__level {
  flex: none;
  font-size: ${THEME.font.sm}px;
  color: ${THEME.color.text};
}
/* On its own line rather than appended to the name: the two together overrun
   the column, and the title is not the part to shrink. */
.hud-player__title {
  font-size: ${THEME.font.sm}px;
  color: ${THEME.color.levelUp};
  line-height: ${THEME.font.sm + 3}px;
}
.hud-player__hp {
  margin-top: 6px;
}
.hud-player__mana,
.hud-player__quiver,
.hud-player__xp {
  margin-top: 5px;
}

/* --- Buffs and debuffs --------------------------------------------------- */

.hud-effects {
  display: flex;
  gap: 6px;
  margin-top: 6px;
}
.hud-effect {
  width: ${THEME.effectIcon.size + 12}px;
  text-align: center;
}
.hud-effect__icon {
  position: relative;
  width: ${THEME.effectIcon.size}px;
  height: ${THEME.effectIcon.size}px;
  margin: 0 auto;
  border: 1px solid currentColor;
  background: rgba(0, 0, 0, 0.55);
  overflow: hidden;
}
/* The one thing that tells a mark being done *to* you from one you asked for,
   since nothing else about the square can carry it at 30px. */
.hud-effect__icon.is-debuff {
  border-color: ${THEME.color.playerDamage};
}
.hud-effect__glyph {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-size: ${THEME.font.lg}px;
  line-height: 1;
}
/* Grows from the bottom as the buff is spent, so a square that is nearly full
   is one about to drop off. The mirror of the ability sweep, which fills while
   a cooldown *has* time left on it. */
.hud-effect__sweep {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 0;
  background: rgba(0, 0, 0, 0.65);
}
.hud-effect__name,
.hud-effect__time {
  font-size: ${THEME.font.xs}px;
  line-height: ${THEME.effectIcon.caption}px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.hud-effect__name {
  color: ${THEME.color.muted};
}
.hud-effect__time {
  color: ${THEME.color.dim};
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
  line-height: 18px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.hud-target__winding {
  font-size: ${THEME.font.xs}px;
  line-height: 14px;
  margin-top: 3px;
  color: ${THEME.color.playerDamage};
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
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

/* --- Channel bar and toasts ---------------------------------------------- */

.hud-channel {
  position: absolute;
  left: 50%;
  width: 120px;
  margin-left: -60px;
  pointer-events: none;
}
.hud-channel__label {
  font-size: ${THEME.font.xs}px;
  text-align: center;
  margin-bottom: 4px;
}
.hud-channel__bar {
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
  /* Even shares of the width, so every seat costs every other seat. Five of
     them clear the 44px touch minimum on a 375px phone with room to spare;
     seven cleared it by four tenths of a pixel. */
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
/* What a page is for, said once at its top: small, and out of the way of the rows. */
.hud-sheet__intro {
  font-size: ${THEME.font.xs}px;
  color: ${THEME.color.muted};
  padding-bottom: ${THEME.padding}px;
}
.hud-sheet__intro p {
  margin: 0 0 4px;
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
  font-size: ${THEME.font.sm}px;
  font-weight: bold;
  color: ${THEME.color.muted};
  margin: ${THEME.padding}px 0 4px;
}
.hud-section__hint {
  font-weight: normal;
  color: ${THEME.color.dim};
  margin-left: 6px;
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
.hud-coin__label {
  color: ${THEME.color.muted};
  margin-right: 0.35em;
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
/* auto-fill rather than a column count computed anywhere: the sheet is handed
   its width by ui/layout.ts and how many ${THEME.bagCell.min}px cells fit inside it
   is the one thing the browser answers exactly for free. */
.hud-bag {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(${THEME.bagCell.min}px, 1fr));
  gap: 6px;
}
.hud-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-height: ${THEME.touchMin}px;
  padding: 6px 4px;
  border: 0;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.05);
  color: inherit;
  font: inherit;
  text-align: center;
  cursor: pointer;
}
.hud-item.is-selected {
  background: rgba(255, 255, 255, 0.14);
  outline: 1px solid ${THEME.color.equippable};
}
.hud-icon {
  display: block;
  width: ${THEME.bagCell.icon}px;
  height: ${THEME.bagCell.icon}px;
}
/* Bottom-right of the cell, over the icon — where every bag has put it. */
.hud-item__count {
  position: absolute;
  right: 3px;
  bottom: ${THEME.font.xs + 6}px;
  padding: 0 3px;
  border-radius: 3px;
  background: rgba(0, 0, 0, 0.75);
  font-size: ${THEME.font.xs}px;
  color: ${THEME.color.text};
}
.hud-item__name {
  font-size: ${THEME.font.xs}px;
  line-height: ${THEME.font.xs + 2}px;
  color: ${THEME.color.muted};
  /* One line, cut rather than wrapped: a two-line name would make its cell
     taller than every other cell in the row. */
  max-width: 100%;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
/* Pinned under the scrolling grid rather than inside it — see InventorySheet.
   It may shrink and scroll itself, which the grid's floor below is what forces:
   a long list of uses on a landscape phone would otherwise squeeze the grid to
   nothing, and the item being read about with it. */
.hud-item-detail {
  flex: 0 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 6px ${THEME.padding}px ${THEME.padding}px;
  border-top: 1px solid ${cssRgba(THEME.panelStroke, 0.6)};
}
.hud-bag-body {
  min-height: ${THEME.bagCell.icon + 2 * THEME.font.xs + 16}px;
}
.hud-item-detail__name {
  font-size: ${THEME.font.sm}px;
  color: ${THEME.color.text};
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
  padding: 4px 0 2px 6px;
}
/* What an item is for, a sentence a line, in the bag's strip and on its card
   alike. Muted so the name and the buttons stay what the eye lands on first. */
.hud-item-uses {
  padding-top: 2px;
}
.hud-item-uses__line {
  font-size: ${THEME.font.xs}px;
  line-height: ${THEME.font.xs + 5}px;
  color: ${THEME.color.muted};
}
.hud-item-actions .hud-button {
  min-height: 30px;
  font-size: ${THEME.font.sm}px;
  border-color: ${cssColor(THEME.panelStroke)};
  background: ${cssColor(THEME.buttonBg)};
}

/* --- Map ----------------------------------------------------------------- */

/* The sheet's body scrolls; the map inside it must not, so it takes whatever
   width it is given and keeps the zone's own proportions. */
.hud-map {
  display: flex;
  justify-content: center;
}
.hud-map__svg {
  width: 100%;
  height: auto;
  max-height: 100%;
  border: 1px solid ${cssColor(THEME.panelStroke)};
  /* Terrain is drawn a tile at a time and the browser would otherwise blend
     the seams between them into a haze at this size. */
  shape-rendering: crispEdges;
}
/* The anchor is set per label — it turns inward near an edge, so a destination
   name always runs into the map rather than off it. */
.hud-map__label {
  paint-order: stroke;
  stroke: rgba(0, 0, 0, 0.85);
  stroke-width: 0.5;
  stroke-linejoin: round;
}
/* The one thing on the map that moves, and the only thing drawn over the rest. */
.hud-map__player {
  shape-rendering: auto;
}
/* The zoomed-out view is cells and roads rather than tiles, so the seam-hiding
   that terrain wants would only make its text crawl. */
.hud-map__svg--world {
  shape-rendering: auto;
}
/* A whole cell is the tap target, since this is pressed with a thumb. */
.hud-map__zone {
  cursor: pointer;
  pointer-events: auto;
}
.hud-map__zone[data-here='true'] {
  cursor: default;
}
/* The zoom toggle sits in the sheet's head beside its title, which is the one
   place a sheet has room for a control. */
.hud-map__zoom {
  min-height: 28px;
  padding: 0 10px;
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
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 0 ${THEME.padding}px ${THEME.padding}px;
  flex: 0 0 auto;
}
.hud-titles__worn {
  font-size: ${THEME.font.sm}px;
  color: ${THEME.color.levelUp};
}
.hud-titles .hud-button {
  flex: 0 0 auto;
  font-size: ${THEME.font.xs}px;
}
.hud-feat-title {
  color: ${THEME.color.levelUp};
}
.hud-feat-title.is-selected {
  box-shadow: inset 3px 0 0 ${THEME.color.levelUp};
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
/* A counter hangs from the top and stops short of the tab bar, by the menu's
   offset: a long list used to run down over the bar and take the taps meant for
   it, the Bag tab among them. What does not fit scrolls. */
.hud-modal--top {
  align-items: flex-start;
  padding-top: 60px;
  padding-bottom: ${THEME.touchMin + THEME.padding * 3}px;
}
.hud-modal--top > .hud-modal__box {
  max-height: 100%;
}
/* The menu opens against the bar that opened it. The offset is the tab bar's
   own height — touchMin plus its padding either side — so the box rests on top
   of the bar rather than over it. */
.hud-modal--bottom {
  align-items: flex-end;
  padding-bottom: ${THEME.touchMin + THEME.padding * 3}px;
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
/* Two columns rather than the bar's five-way split, which is what buys these
   labels room to be whole words. An even fraction each keeps both columns the
   same width however long the longest label gets. */
.hud-menu__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${THEME.padding}px;
}
.hud-menu__item {
  min-height: ${THEME.touchMin}px;
}
/* Its width is \`counterLayout\`'s, set inline: it depends on whether the two
   sides stand across or one over the other. */
.hud-modal__box--shop {
  border-color: ${THEME.color.levelUp};
  gap: 4px;
}
/* The shop's shape in the banker's colour, so which counter is open is
   answerable without reading the title. */
.hud-modal__box--bank {
  border-color: ${THEME.color.skillUp};
  gap: 4px;
}
/* A counter that deals both ways, as two framed panes that scroll on their own:
   the keeper's and yours. One over the other, each starting at the height of
   its list and giving it up in proportion when the two do not fit — so a short
   bag under a long shelf keeps its rows — and never below a couple of rows. */
.hud-sides {
  display: flex;
  flex-direction: column;
  gap: ${THEME.padding}px;
  flex: 1 1 auto;
  min-height: 0;
}
.hud-side {
  flex: 1 1 auto;
  min-height: 96px;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0 4px 4px;
  border: 1px solid ${cssColor(THEME.panelStroke)};
  background: rgba(0, 0, 0, 0.18);
}
/* Across, each side takes half and the whole height, which is what a landscape
   phone has least of. */
.hud-sides.is-side-by-side {
  flex-direction: row;
}
.hud-sides.is-side-by-side > .hud-side {
  flex: 1 1 0;
  min-width: 0;
  min-height: 0;
}
/* And the third counter in a third colour, for the same reason. Wider than the
   other two: every row here carries a line of prose under it, and the two that
   do not are lists of names and numbers. */
.hud-modal__box--trainer {
  width: 320px;
  border-color: ${THEME.color.trainer};
  gap: 4px;
}
/* A lesson is its row and the sentence describing it, kept together so the
   sentence cannot end up beside the wrong price. The row keeps its own margin,
   the way a stack row does, so one list has one rhythm down it. */
.hud-lesson {
  display: flex;
  flex-direction: column;
  margin-bottom: 6px;
}
.hud-lesson > .hud-list-row {
  margin-bottom: 0;
}
.hud-list-row__note {
  padding: 2px ${THEME.padding}px 0;
  font-size: ${THEME.font.xs}px;
  color: ${THEME.color.muted};
}
/* The board, in the quartermaster's green. Same width as the trainer's and the
   forge's, and for the same reason: every row carries a line under it saying
   what it asks for. */
.hud-modal__box--bounty {
  width: 320px;
  border-color: ${THEME.color.quartermaster};
  gap: 4px;
}
/* A contract is its row and the line describing what it wants, kept together the
   way a lesson is — including when the row has grown a Drop button beside it,
   which is why this wraps the stack rather than the row. */
.hud-contract {
  display: flex;
  flex-direction: column;
  margin-bottom: 6px;
}
.hud-contract > .hud-list-row,
.hud-contract > .hud-stack {
  margin-bottom: 0;
}
/* A station's list, in the ember colour the forge's coals are drawn in — one
   look for both, since what tells a vat from an anvil is the name over it and
   the rows under it rather than a second border colour. Same width as the
   trainer's for the same reason: every row carries a line under it. */
.hud-modal__box--station {
  width: 320px;
  border-color: ${THEME.color.forge};
  gap: 4px;
}
/* Beside the purse in the head, and the one number that says why a deposit was
   refused — so it is the only thing in there that changes colour. */
.hud-bank__slots {
  font-size: ${THEME.font.sm}px;
  color: ${THEME.color.muted};
  margin-left: auto;
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
/* A slider is a thumb target like any button, so it stands as tall as one: a
   range input's own height is a few pixels of track. */
.hud-options__volume {
  pointer-events: auto;
  width: 100%;
  min-height: ${THEME.touchMin}px;
  margin: 0;
  accent-color: ${cssColor(THEME.xpFill)};
  cursor: pointer;
}
.hud-options__volume:disabled {
  opacity: 0.4;
  cursor: default;
}
/* Indented under the "Could not carry" heading, and dimmer than what was
   actually brought back — a list of what you do not have. */
.hud-modal__missed {
  color: ${THEME.color.dim};
  padding-left: ${THEME.padding}px;
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
/* A row with a thumbnail down the left: the icon keeps its size, the pair of
   text lines takes the rest, and the value stays pinned right where it was. */
.has-icon > .hud-icon {
  flex: none;
  width: ${THEME.font.xl}px;
  height: ${THEME.font.xl}px;
}
.hud-row__text {
  flex: 1 1 auto;
  min-width: 0;
}
.hud-list-row.has-icon .hud-row__text {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${THEME.padding}px;
}
.hud-picker__row.has-icon {
  display: flex;
  align-items: center;
  gap: ${THEME.padding}px;
}
.hud-list-row__value {
  color: ${THEME.color.levelUp};
  white-space: nowrap;
}
.hud-list-row__sub {
  font-size: ${THEME.font.xs}px;
  color: ${THEME.color.muted};
}

/* A sell row and the button that empties the stack, side by side. The row keeps
   the margin it had on its own, so a bag of stacks and a bag of singles are the
   same list with the same gaps down it. */
.hud-stack {
  display: flex;
  align-items: stretch;
  gap: 2px;
  margin-bottom: 2px;
}
.hud-stack > .hud-list-row {
  margin-bottom: 0;
}
/* Sized to the row rather than to \`touchMin\`: it stands beside a 34px target
   and is the one of the pair a mis-tap costs something, so it is deliberately
   not the bigger of the two. Shared by the shop's "Sell all" and the bank's
   two, which is the point of the pair being one helper. */
.hud-stack__all {
  flex: none;
  min-height: 0;
  min-width: 44px;
  font-size: ${THEME.font.sm}px;
}

/* --- Context menu and inspect card --------------------------------------- */

/* Sized to its longest line rather than to a column width: the lines are two
   words each, and a menu as wide as a sheet would cover the thing it is about.
   The cap is what stops "Travel to Bandit Camp" setting that width. */
.hud-context {
  position: absolute;
  min-width: 132px;
  max-width: 200px;
  pointer-events: auto;
  background: ${cssRgba(THEME.panelBg, 0.95)};
  border: 1px solid ${cssColor(THEME.panelStroke)};
  padding: 4px;
}
.hud-context__title {
  font-size: ${THEME.font.sm}px;
  font-weight: bold;
  padding: 2px ${THEME.padding}px 4px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.hud-context__row {
  display: block;
  width: 100%;
  min-height: ${THEME.touchMin}px;
  padding: 4px ${THEME.padding}px;
  border: 0;
  background: rgba(255, 255, 255, 0.06);
  color: ${THEME.color.text};
  font: inherit;
  font-size: ${THEME.font.sm}px;
  text-align: left;
  cursor: pointer;
}
.hud-context__row + .hud-context__row {
  margin-top: 2px;
}

/* Opaque, where every other box lets the world show through: this is the one
   panel opened over other panels — an item asked about from the shop's shelf —
   and a shelf row read through its lines is two panels at once. */
.hud-modal__box--inspect {
  width: 300px;
  gap: 4px;
  background: ${cssColor(THEME.panelBg)};
}
.hud-inspect__subtitle {
  font-size: ${THEME.font.xs}px;
  color: ${THEME.color.dim};
  flex: 0 0 auto;
}
.hud-inspect__line {
  font-size: ${THEME.font.sm}px;
  line-height: 22px;
}
.hud-inspect__label {
  color: ${THEME.color.muted};
}
/* Right-aligned against the label, so a column of numbers reads as a column. */
.hud-inspect__value {
  text-align: right;
}
/* A drop row is read, not pressed — unlike every other row this shape. */
.hud-inspect__drop {
  cursor: default;
}
/* Set apart from the numbers above: those are what it is, these what it is for. */
.hud-inspect__uses {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid ${cssRgba(THEME.panelStroke, 0.6)};
}
.hud-inspect__uses .hud-item-uses__line {
  font-size: ${THEME.font.sm}px;
  line-height: ${THEME.font.sm + 6}px;
  color: ${THEME.color.text};
}
.hud-inspect__note {
  margin-top: 6px;
  font-size: ${THEME.font.xs}px;
  line-height: 16px;
  color: ${THEME.color.dim};
}

/* --- Character creation -------------------------------------------------- */

.create {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  /* Centred by the auto margins below rather than by justify-content, which
     centres a column taller than the screen by clipping its top out of reach
     of the scroll: three class cards overflow a short phone. */
  justify-content: flex-start;
  gap: ${THEME.margin}px;
  padding: ${THEME.margin}px;
  overflow-y: auto;
  background: #1a1a2e;
  color: ${THEME.color.text};
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  /* Its own copy of the .hud rule: this screen is mounted before any canvas
     exists and sits outside the HUD overlay, and a page zoomed by double-tapping
     one of its big cards outlives it. */
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}
.create * {
  box-sizing: border-box;
}
.create > :first-child {
  margin-top: auto;
}
.create > :last-child {
  margin-bottom: auto;
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
  border: 2px solid ${cssColor(THEME.panelStroke)};
  background: #2a2a4a;
  color: ${THEME.color.text};
  font: inherit;
  cursor: pointer;
}
.create__card.is-selected {
  border-color: ${THEME.color.equippable};
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
  border: 1px solid ${THEME.color.equippable};
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
