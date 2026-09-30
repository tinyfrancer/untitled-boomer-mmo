import { el } from './dom';
import { ICON_SHEET_VAR, frameVar, installHudArt } from './hudArt';
import { TRAINING_FADE_MS } from './TrainingBar';
import { FONT_FAMILY, PIXELS_PER_EM } from '../art/fontFile';
import { HUD_FRAMES, accentPanel, type HudFrameName } from '../art/hud';
import { FRAME_ACCENT, THEME, cssColor, cssRgba, rampStep, type BarFill } from '../ui/theme';

const STYLE_ID = 'hud-styles';

const SANS = `system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`;

const INK = cssColor(rampStep('ink', 0));
const INK_2 = cssColor(rampStep('ink', 2));
const INK_3 = cssColor(rampStep('ink', 3));
const STONE = cssColor(rampStep('masonry', 2));
const STONE_DARK = cssColor(rampStep('masonry', 1));

/**
 * A frame from `art/hud.ts` round an element, cut in nine by the page.
 *
 * The border under it is what the element wears where the art is not drawn (a
 * test's page, which has no canvas): the frame's width in the frame's darkest
 * colour, so the box is the same size either way and only the picture differs.
 */
function framed(name: HudFrameName, fallback = INK): string {
  const { slice } = HUD_FRAMES[name];
  return `border: ${slice}px solid ${fallback};
  border-image: var(${frameVar(name)}) ${slice} fill / ${slice}px stretch;`;
}

/** Only the picture, for a state of an element already framed at this width. */
function reframed(name: HudFrameName): string {
  return `border-image-source: var(${frameVar(name)});`;
}

/**
 * The world's font at a whole multiple, which is the only size it is drawn
 * at: one CSS pixel to the glyph's pixel, or two for a title. Solid, so the
 * capitals sit in the middle of the line, and never made bold or slanted by
 * the browser, which would smear the pixels it is made of.
 */
function pixelType(times: 1 | 2): string {
  const size = PIXELS_PER_EM * times;
  return `font-family: '${FONT_FAMILY}', ${SANS};
  font-size: ${size}px;
  line-height: ${size}px;
  font-weight: normal;
  font-style: normal;
  font-synthesis: none;`;
}

/**
 * A bar's fill in its ramp, lit along the top row and shaded along the foot,
 * in hard steps as pixel art shades rather than a gradient.
 */
function barFill({ ramp }: BarFill): string {
  const [dark, lit, top] = [1, 3, 4].map((step) => cssColor(rampStep(ramp, step as 1 | 3 | 4)));
  return `background: linear-gradient(to bottom, ${top} 0 1px, ${lit} 1px calc(100% - 2px), ${dark} calc(100% - 2px));`;
}

/**
 * How far the player column's backing reaches past its lines: short of the
 * margin, so the corner of the screen still shows round it.
 */
const PLAYER_BACKING = 6;

/**
 * A word written over the world rather than on a panel: edged in ink on its
 * four sides, as the world's own words are (`art/font.ts`), with a soft halo
 * under that so a thin glyph keeps its edge over sand and grass alike.
 */
const OVER_THE_WORLD = `text-shadow:
    1px 0 0 ${INK},
    -1px 0 0 ${INK},
    0 1px 0 ${INK},
    0 -1px 0 ${INK},
    0 0 4px ${cssRgba(rampStep('ink', 0), 0.8)};`;

/**
 * The HUD's stylesheet, interpolated from THEME so the palette still lives in
 * one place.
 *
 * Written as a string rather than a `.css` file because the values in it are
 * the same ones the layout arithmetic uses, and a second hand-maintained copy
 * of the palette is exactly what the port is trying to avoid. Every colour in
 * it is a step on the art's ramps (`theme.test.ts` holds it), and every panel,
 * button, row and slot is a frame drawn as pixel data (B8, decision 111).
 */
export function hudCss(): string {
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
  font-family: ${SANS};
  color: ${THEME.color.text};
  /* Every picture the HUD hangs is pixel art drawn one to a CSS pixel, which a
     phone scales two or three times: nearest neighbour, or every edge blurs. */
  image-rendering: pixelated;
  -webkit-user-select: none;
  user-select: none;
  /* A held finger is how a phone asks what something is, so iOS must not answer
     it first with a copy/share callout over the menu we are opening. */
  -webkit-touch-callout: none;
  -webkit-tap-highlight-color: transparent;
}
.hud * {
  box-sizing: border-box;
  scrollbar-color: ${INK_3} ${INK};
}
/* --- Shared chrome ------------------------------------------------------- */

/* Iron round a dark face. The padding is what is left of the old eight once the
   frame has taken its six, so what is inside sits where it always did. */
.hud-panel {
  position: absolute;
  pointer-events: auto;
  background: ${cssColor(THEME.panelBg)};
  ${framed('panel')}
  padding: ${THEME.padding + 1 - THEME.frame.panel}px;
}
/* The world's font, where the HUD names something rather than counting it. */
.hud-pixel {
  ${pixelType(1)}
}
.hud-muted {
  color: ${THEME.color.muted};
}
.hud-empty {
  font-size: ${THEME.font.sm}px;
  color: ${THEME.color.dim};
  padding: 4px 0 4px ${THEME.padding}px;
}

/* A slab of stone standing up out of the panel, pressed in while it is held. */
.hud-button {
  pointer-events: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: ${THEME.touchMin}px;
  padding: 0 ${THEME.padding - THEME.frame.button}px;
  background: ${STONE};
  ${framed('button')}
  color: ${THEME.color.text};
  ${pixelType(1)}
  text-align: center;
  cursor: pointer;
}
.hud-button:active:not(:disabled) {
  ${reframed('button-down')}
  background: ${STONE_DARK};
}
.hud-button:disabled {
  ${reframed('button-off')}
  background: ${STONE_DARK};
  color: ${THEME.color.dim};
  cursor: default;
}
.hud-button.is-selected {
  ${reframed('button-arcane')}
}
.hud-button.is-lit {
  ${reframed('button-gold')}
}

/* A bar with a fill, which the player column and the skill lists are made of.
   The trough is solid because these hang over the world with no panel behind
   them: at half alpha the empty end of a bar over grass read as grass, which is
   the one thing a bar exists to answer. */
.hud-bar {
  position: relative;
  height: ${THEME.xpBar.height}px;
  background: ${INK};
  ${framed('slot')}
  overflow: hidden;
}
.hud-bar__fill {
  position: absolute;
  inset: 0 auto 0 0;
  width: 0;
  ${barFill(THEME.bars.xp)}
}
.hud-bar__fill--mana {
  ${barFill(THEME.bars.mana)}
}
.hud-bar__fill--quiver {
  ${barFill(THEME.bars.quiver)}
}
.hud-bar__fill--training {
  ${barFill(THEME.bars.training)}
}
.hud-bar__fill--hp {
  ${barFill(THEME.bars.hp)}
}
.hud-bar__fill--target {
  ${barFill(THEME.bars.target)}
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
  ${OVER_THE_WORLD}
}

/* --- Text over the world ------------------------------------------------ */

/* Everything written straight onto the world rather than onto a panel, edged
   the way the world's own nameplates are. */
.hud-player__head,
.hud-player__title,
.hud-effect__name,
.hud-effect__time,
.hud-target__name,
.hud-target__winding,
.hud-tracker__line,
.hud-ability__name,
.hud-channel__label,
.hud-toast {
  ${OVER_THE_WORLD}
}

/* --- Player column ------------------------------------------------------- */

.hud-player {
  position: absolute;
  display: flex;
  flex-direction: column;
  /* Its own stack, so the backing below goes behind its lines and no further. */
  isolation: isolate;
}
/* A backing in the world's darkest ink: the column is words and bars laid on
   the world with no panel of its own, and a name the world wrote under it read
   between its lines (decision 112). Drawn round it rather than inside it, so
   it adds nothing to the height the layout counts. */
.hud-player::before {
  content: '';
  position: absolute;
  inset: -${PLAYER_BACKING}px;
  z-index: -1;
  background: ${cssRgba(rampStep('ink', 0), 0.75)};
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
  ${pixelType(1)}
  /* One line, cut rather than wrapped: a long name must not push the level
     onto a row of its own, which is the whole point of sharing this one. */
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.hud-player__level {
  flex: none;
  ${pixelType(1)}
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
/* The skill last trained. A button, since a tap opens its page in the skills
   book, and its padding is the gap the bars above take as a margin, so the gap
   is part of what a thumb can land on. */
.hud-player__training {
  display: block;
  width: 100%;
  padding: 5px 0 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  pointer-events: auto;
  transition: opacity ${TRAINING_FADE_MS}ms linear;
}
.hud-player__training.is-fading {
  opacity: 0;
}
/* The name gives way before the numbers do: the longest name with the largest
   XP only just fits the column, and the level is the part worth reading. */
.hud-training__label {
  gap: 4px;
  padding-right: 5px;
}
.hud-training__name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.hud-training__progress {
  flex: none;
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
  background: ${INK};
  ${framed('slot')}
  overflow: hidden;
}
/* The one thing that tells a mark being done *to* you from one you asked for,
   since nothing else about the square can carry it at this size. */
.hud-effect__icon.is-debuff {
  border-image: none;
  border-color: ${THEME.color.playerDamage};
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
  background: ${cssRgba(rampStep('ink', 0), 0.65)};
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
  ${pixelType(1)}
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
/* The ability's picture on a slab, its name under it and what it costs a
   wizard along its foot: the picture is what a thumb finds mid-fight. */
.hud-ability__key {
  position: relative;
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: ${THEME.touchMin + 8}px;
  padding: 0;
  background: ${STONE};
  ${framed('button')}
  color: ${THEME.color.text};
  font: inherit;
  cursor: pointer;
  overflow: hidden;
}
.hud-ability__key:active:not(:disabled) {
  ${reframed('button-down')}
  background: ${STONE_DARK};
}
.hud-ability__key:disabled {
  ${reframed('button-off')}
  background: ${STONE_DARK};
  color: ${THEME.color.text};
  cursor: default;
}
.hud-ability__key:disabled > .hud-icon {
  opacity: 0.55;
}
/* Drawn from the bottom up as the cooldown runs down, so a glance says how
   long is left without reading a number. */
.hud-ability__sweep {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 0;
  background: ${cssRgba(rampStep('ink', 0), 0.6)};
  pointer-events: none;
}
.hud-ability__slot {
  position: absolute;
  top: 0;
  left: 1px;
  ${pixelType(1)}
  color: ${THEME.color.muted};
}
/* A wizard's price, in the world's font across the slab's foot; an ability that
   costs nothing says nothing there. */
.hud-ability__cost {
  position: absolute;
  left: 0;
  right: 0;
  bottom: -2px;
  ${pixelType(1)}
  color: ${THEME.color.skillUp};
  text-align: center;
  pointer-events: none;
}
.hud-ability__name {
  margin-top: 2px;
  font-size: ${THEME.font.xs}px;
  line-height: 13px;
  color: ${THEME.color.muted};
  text-align: center;
  /* Two lines at most, since the bar reserves two: the longest names ("Crushing
     Blow II") take both. */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
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
  padding: 0 ${THEME.margin}px;
  text-align: center;
  ${pixelType(2)}
  pointer-events: none;
  opacity: 0;
}

/* --- Tip card ------------------------------------------------------------ */

/* The spirit's voice, its frame's accent the blue it speaks in. The bank wears
   the same accent, and the two are never up at once: a tip waits out any
   counter. */
.hud-tip {
  ${reframed(accentPanel(FRAME_ACCENT.tip))}
}
.hud-tip__line {
  margin: 0 0 ${THEME.padding}px;
  font-size: ${THEME.font.sm}px;
  font-style: italic;
  line-height: 1.35;
}
.hud-tip__line::before {
  content: '\\2726\\00a0';
  font-style: normal;
  color: ${THEME.color.skillUp};
}
.hud-tip__actions {
  display: flex;
  gap: ${THEME.padding}px;
}
.hud-tip__actions .hud-button {
  flex: 1 1 0;
}

/* --- Tab bar ------------------------------------------------------------- */

/* A bar of iron along the foot of the screen. Its frame takes six of the eight
   it was padded by, so the tabs stand where they did. */
.hud-tabs {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  gap: ${THEME.padding}px;
  padding: ${THEME.padding - THEME.frame.panel}px;
  pointer-events: auto;
  background: ${cssColor(THEME.panelBg)};
  ${framed('panel')}
}
.hud-tabs__tab {
  /* Even shares of the width, so every seat costs every other seat. Five of
     them clear the 44px touch minimum on a 375px phone with room to spare;
     seven cleared it by four tenths of a pixel. */
  flex: 1 1 0;
  min-width: 0;
  flex-direction: column;
  gap: 1px;
  padding: 0;
}

/* --- Sheets -------------------------------------------------------------- */

/* One sheet is open at a time, so each gets the whole column rather than
   sharing it. 'overflow: hidden' here and 'auto' on the body is the entire
   clipping story. */
/* One sheet is open at a time, so each gets the whole column rather than
   sharing it. 'overflow: hidden' here and 'auto' on the body is the entire
   clipping story. Its frame's six come out of the head's and the body's own
   padding, so what is inside stands where it did. */
.hud-sheet {
  position: absolute;
  display: flex;
  flex-direction: column;
  pointer-events: auto;
  overflow: hidden;
  background: ${cssColor(THEME.panelBg)};
  ${framed('panel')}
}
.hud-sheet__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${THEME.padding}px;
  padding: ${THEME.padding + 1 - THEME.frame.panel}px ${THEME.padding + 1 - THEME.frame.panel}px 4px;
  flex: 0 0 auto;
}
.hud-sheet__title {
  ${pixelType(2)}
  color: ${THEME.color.levelUp};
  min-width: 0;
}
.hud-sheet__body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding: 4px ${THEME.padding + 1 - THEME.frame.panel}px ${THEME.padding + 1 - THEME.frame.panel}px;
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
/* The figure the world draws, in what is worn, on a pit of its own. */
.hud-char__doll {
  flex: 0 0 auto;
  padding: 2px 6px;
  background: ${INK};
  ${framed('slot')}
}
.hud-paperdoll {
  display: block;
  width: ${32 * THEME.paperdollScale}px;
  height: ${48 * THEME.paperdollScale}px;
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
  padding: 3px 5px;
  margin-top: 2px;
  background: ${STONE_DARK};
  ${framed('row', STONE_DARK)}
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
  ${pixelType(1)}
  color: ${THEME.color.levelUp};
  margin: ${THEME.padding}px 0 4px;
}
.hud-section__hint {
  font-family: ${SANS};
  font-size: ${THEME.font.xs}px;
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
/* A skill's row that opens its page in the book: the gear slot's look, and a
   list row's height, since a row of text and a 3px bar is no target at all. */
.hud-skill.is-button {
  display: flex;
  flex-direction: column;
  justify-content: center;
  width: 100%;
  min-height: 34px;
  padding: 3px 5px;
  margin-top: 2px;
  background: ${STONE_DARK};
  ${framed('row', STONE_DARK)}
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  pointer-events: auto;
}

/* --- Idle panel ---------------------------------------------------------- */

/* Start and Stop, across from the title: the one thing the panel is opened to do. */
.hud-idle__button {
  flex: none;
}
.hud-idle__head {
  align-items: center;
}
.hud-idle__line {
  font-size: ${THEME.font.sm}px;
  color: ${THEME.color.muted};
  line-height: 18px;
  padding: 1px 0;
}
.hud-idle__warning {
  color: ${THEME.color.playerDamage};
}
/* A food in the bag and the three buttons that set it: the item takes the rest
   of the row, and the buttons keep the touch minimum a thumb needs. */
.hud-idle-food {
  display: flex;
  align-items: stretch;
  gap: 2px;
  margin-top: 2px;
}
.hud-idle-food__item {
  display: flex;
  align-items: center;
  gap: ${THEME.padding}px;
  flex: 1 1 auto;
  min-width: 0;
  padding: 0 5px;
  background: ${STONE_DARK};
  ${framed('row', STONE_DARK)}
  font-size: ${THEME.font.sm}px;
  pointer-events: auto;
}
.hud-idle-food__item > .hud-icon {
  flex: none;
}
.hud-idle-food__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.hud-idle-food.is-kept .hud-idle-food__name {
  color: ${THEME.color.dim};
}
.hud-idle-food__button {
  flex: none;
  min-width: ${THEME.touchMin}px;
  padding: 0 3px;
}
/* The top food has nowhere earlier to go and the bottom one nowhere later. */
.hud-idle-food__button:disabled {
  color: ${THEME.color.dim};
}

/* --- Skills book --------------------------------------------------------- */

/* Back to the index, in front of the page's title the way a counter's Back
   sits in front of its own. */
.hud-sheet__back {
  flex: none;
  min-height: 28px;
  padding: 0 4px;
}
.hud-sheet__back + .hud-sheet__title {
  margin-right: auto;
}
/* What mastery is, said once over a page's rows. */
.hud-book__rule {
  font-size: ${THEME.font.xs}px;
  color: ${THEME.color.muted};
  padding: 0 0 6px;
}
/* A node or recipe is its row, the lines under it and its mastery, kept together
   the way a lesson is. Asked about, not tapped, so it keeps no pointer. */
.hud-book-entry {
  display: flex;
  flex-direction: column;
  margin-bottom: 6px;
}
.hud-book-entry > .hud-list-row {
  margin-bottom: 0;
  cursor: default;
}
.hud-book-entry > .hud-list-row .hud-list-row__value {
  color: ${THEME.color.muted};
}
.hud-book-entry__mastery {
  padding: 0 ${THEME.padding}px;
}
/* Out of reach: drawn, and greyed, rather than hidden (decision 86). */
.hud-book-entry.is-locked {
  opacity: 0.5;
}

/* --- Bag ----------------------------------------------------------------- */

.hud-coin {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: ${THEME.font.sm}px;
  color: ${THEME.color.levelUp};
  white-space: nowrap;
}
.hud-coin__label {
  color: ${THEME.color.muted};
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
/* A cell of the bag: a slot sunk into the panel, the item's picture in it. */
.hud-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-height: ${THEME.touchMin}px;
  padding: 5px 3px;
  background: ${INK};
  ${framed('slot')}
  color: inherit;
  font: inherit;
  text-align: center;
  cursor: pointer;
}
.hud-item.is-selected {
  outline: 1px solid ${THEME.color.equippable};
}
/* An icon off the HUD's sheet of them (hud/hudArt.ts), sized and placed inline. */
.hud-icon {
  display: block;
  flex: none;
  width: ${THEME.icon.item}px;
  height: ${THEME.icon.item}px;
  background-image: var(${ICON_SHEET_VAR});
  background-repeat: no-repeat;
}
/* Bottom-right of the cell, over the icon — where every bag has put it. */
.hud-item__count {
  position: absolute;
  right: 2px;
  bottom: ${THEME.font.xs + 5}px;
  padding: 0 2px;
  background: ${INK};
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
  padding: 6px ${THEME.padding + 1 - THEME.frame.panel}px ${THEME.padding + 1 - THEME.frame.panel}px;
  border-top: 1px solid ${INK_3};
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
  border: 1px solid ${INK_3};
  /* Terrain is drawn a tile at a time and the browser would otherwise blend
     the seams between them into a haze at this size. */
  shape-rendering: crispEdges;
}
/* The anchor is set per label — it turns inward near an edge, so a destination
   name always runs into the map rather than off it. */
.hud-map__label {
  paint-order: stroke;
  stroke: ${cssRgba(rampStep('ink', 0), 0.85)};
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
  padding: 0 7px;
}

/* --- Minimap ------------------------------------------------------------- */

/* A panel that is a button: the map and the zone's name under it, and a tap
   anywhere on it opens the zone map (decision 115). */
.hud-minimap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  color: ${THEME.color.text};
  font: inherit;
  cursor: pointer;
}
.hud-minimap__map {
  display: block;
  flex: none;
  /* What lies past the zone's edge: the dark the world's ground runs out into. */
  background: ${INK};
  /* Every edge is held to a whole pixel of it, and left to itself the browser
     blends each one into its neighbour at four pixels a tile. */
  shape-rendering: crispEdges;
}
.hud-minimap__name {
  ${pixelType(1)}
  width: 100%;
  text-align: center;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

/* --- Quests, feats, log -------------------------------------------------- */

.hud-quest {
  margin-bottom: ${THEME.padding}px;
}
.hud-quest__name {
  ${pixelType(1)}
  color: ${THEME.color.levelUp};
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
  ${pixelType(1)}
  color: ${THEME.color.levelUp};
  margin-bottom: 2px;
}
.hud-row--tier {
  font-size: ${THEME.font.sm}px;
  color: ${THEME.color.muted};
  padding-left: ${THEME.padding}px;
}
/* A rank's count is never broken ("0 / 25" over "slain"): if a title is ever
   too long for the width, the title wraps on its own side. */
.hud-row--tier > :last-child,
.hud-feat-title .hud-muted {
  white-space: nowrap;
  flex: 0 0 auto;
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
/* Centred over the playfield rather than the screen, so a panel taller than a
   landscape phone stops above the tab bar and scrolls, as the counters do. */
.hud-modal--above-bar {
  padding-bottom: ${THEME.touchMin + THEME.padding * 3}px;
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
  background: ${cssColor(THEME.panelBg)};
  ${framed('panel')}
  padding: ${THEME.padding + 1 - THEME.frame.panel}px;
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
  flex-direction: column;
  gap: 1px;
}
/* Its width is \`counterLayout\`'s, set inline: it depends on whether the two
   sides stand across or one over the other. */
.hud-modal__box--shop {
  ${reframed(accentPanel(FRAME_ACCENT.shop))}
  gap: 4px;
}
/* The shop's shape in the banker's colour, so which counter is open is
   answerable without reading the title. */
.hud-modal__box--bank {
  ${reframed(accentPanel(FRAME_ACCENT.bank))}
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
  padding: 0 3px 3px;
  background: ${INK};
  ${framed('slot')}
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
  ${reframed(accentPanel(FRAME_ACCENT.trainer))}
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
  ${reframed(accentPanel(FRAME_ACCENT.bounty))}
  gap: 4px;
}
/* A contract is its row and the line describing what it wants, kept together the
   way a lesson is. */
.hud-contract {
  display: flex;
  flex-direction: column;
  margin-bottom: 6px;
}
.hud-contract > .hud-list-row {
  margin-bottom: 0;
}
/* How often, said once over the whole board rather than on every row. */
.hud-board__rule {
  font-size: ${THEME.font.xs}px;
  color: ${THEME.color.muted};
  padding: 2px ${THEME.padding}px 0;
}
/* Giving the contract back: under it and a clear gap below the row that hands it
   in, across the panel, and no taller than that row, since it is the one of the
   two a mis-tap costs something. Filled once armed, so the second press is
   plainly a different thing from the first. */
.hud-contract__abandon {
  width: 100%;
  min-height: 34px;
  margin: ${THEME.padding * 1.5}px 0 ${THEME.padding}px;
  ${reframed('button-red')}
}
.hud-contract__abandon.is-armed {
  ${reframed('button-armed')}
  color: ${THEME.color.text};
}
/* A word marking what kind of thing a row is, kept off the words around it. */
.hud-tag {
  display: inline-block;
  margin-left: 6px;
  padding: 0 4px;
  border: 1px solid ${THEME.color.quartermaster};
  border-radius: 2px;
  color: ${THEME.color.quartermaster};
  font-size: ${THEME.font.xs}px;
  font-weight: normal;
  line-height: 14px;
  white-space: nowrap;
}
/* A conversation: nobody's colour, since it is the one panel every person has,
   and the width of the counters that carry a line under each row, which its
   buttons do. */
.hud-modal__box--talk {
  width: 320px;
  gap: 4px;
}
/* What they say, set apart from everything that is a button by being the one
   thing in the HUD in italics — and in their quotation marks. */
.hud-talk__greeting {
  margin: 4px 0 ${THEME.padding}px;
  padding: 0 4px;
  font-size: ${THEME.font.md}px;
  font-style: italic;
  line-height: 1.4;
  color: ${THEME.color.text};
}
/* A counter of theirs: the word for it, and what it is for under it, said once
   here where the choice is made. A thumb's height, and across the panel. */
.hud-talk__service {
  width: 100%;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 3px ${THEME.padding - THEME.frame.button}px;
  margin-bottom: 4px;
  text-align: left;
}
.hud-talk__blurb {
  font-family: ${SANS};
  font-size: ${THEME.font.xs}px;
  line-height: 1.3;
  color: ${THEME.color.muted};
}
/* A station's list, in the ember colour the forge's coals are drawn in — one
   look for both, since what tells a vat from an anvil is the name over it and
   the rows under it rather than a second border colour. Same width as the
   trainer's for the same reason: every row carries a line under it. */
.hud-modal__box--station {
  width: 320px;
  ${reframed(accentPanel(FRAME_ACCENT.station))}
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
  ${pixelType(2)}
  color: ${THEME.color.levelUp};
  min-width: 0;
}
.hud-modal__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 2px ${THEME.padding}px;
  flex: 0 0 auto;
}
/* A counter's purse, and the bank's count of its slots, stand on a line of their
   own under the title: a title in the world's font at two, a Back and an X fill
   the head of a box a phone's width, and the title is the one that must not
   wrap. The break is this empty line's, so the order the head is built in, Back
   first, is the order it is read in. */
.hud-modal__head:has(> .hud-coin)::after {
  content: '';
  order: 1;
  flex-basis: 100%;
  height: 0;
}
.hud-modal__head > .hud-bank__slots {
  order: 2;
}
.hud-modal__head > .hud-coin {
  order: 3;
  margin-left: auto;
}
.hud-modal__head > .hud-bank__slots + .hud-coin {
  margin-left: 0;
}
.hud-modal__body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.hud-modal__close {
  flex: none;
  min-height: 28px;
  width: 28px;
  padding: 0;
  margin-left: auto;
}
/* The way back to the conversation, at the front of every counter's head: the
   close button's size and look, and the title after it takes the slack, so the
   pair reads left to right and the purse and the X keep the right-hand end. */
.hud-modal__back {
  flex: none;
  min-height: 28px;
  padding: 0 4px;
}
.hud-modal__back + .hud-modal__title {
  margin-right: auto;
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
  accent-color: ${THEME.color.levelUp};
  cursor: pointer;
}
.hud-options__volume:disabled {
  opacity: 0.4;
  cursor: default;
}
/* --- The save: Options' section of it, and the panel that loads one ------- */

.hud-options,
.hud-save {
  display: flex;
  flex-direction: column;
  gap: ${THEME.padding}px;
}
.hud-save__heading {
  margin-top: 4px;
  ${pixelType(1)}
  color: ${THEME.color.levelUp};
}
/* Where a code is pasted in or copied out. The HUD turns text selection and
   iOS's copy and paste callout off for every piece of furniture, and this is
   the one box that exists to be copied from and pasted into, so it takes both
   back. 16px or larger, or iOS Safari zooms the page when it takes focus. */
.hud-save__code {
  pointer-events: auto;
  width: 100%;
  min-height: 72px;
  padding: 6px;
  resize: vertical;
  font: 16px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  word-break: break-all;
  color: ${THEME.color.text};
  background: ${INK};
  border: 1px solid ${INK_3};
  -webkit-user-select: text;
  user-select: text;
  -webkit-touch-callout: default;
}
.hud-save__error {
  font-size: ${THEME.font.sm}px;
  line-height: 18px;
  color: ${THEME.color.playerDamage};
}
.hud-save__error:empty {
  display: none;
}
.hud-save__card {
  padding: 5px ${THEME.padding - 1}px;
  background: ${INK};
  ${framed('slot')}
}
.hud-save__name {
  ${pixelType(1)}
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
/* A row of a list: a slab lower than a button, so a list reads as rows. */
.hud-list-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${THEME.padding}px;
  width: 100%;
  min-height: 34px;
  padding: 0 ${THEME.padding - 1}px;
  margin-bottom: 2px;
  background: ${STONE_DARK};
  ${framed('row', STONE_DARK)}
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
  background: ${cssColor(THEME.panelBg)};
  ${framed('panel')}
  padding: 0;
}
.hud-context__title {
  ${pixelType(1)}
  color: ${THEME.color.levelUp};
  padding: 2px ${THEME.padding - 2}px 4px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.hud-context__row {
  display: block;
  width: 100%;
  min-height: ${THEME.touchMin}px;
  padding: 3px ${THEME.padding - 1}px;
  background: ${STONE_DARK};
  ${framed('row', STONE_DARK)}
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
}
/* The item itself, twice the size of a row's, beside its name. */
.hud-inspect__head {
  display: flex;
  align-items: center;
  gap: ${THEME.padding}px;
  min-width: 0;
  margin-right: auto;
}
.hud-inspect__picture {
  flex: none;
  background-color: ${INK};
  ${framed('slot')}
  box-sizing: content-box;
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
  border-top: 1px solid ${INK_3};
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
  background: ${INK};
  color: ${THEME.color.text};
  font-family: ${SANS};
  image-rendering: pixelated;
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
  ${pixelType(2)}
  color: ${THEME.color.levelUp};
  text-align: center;
}
.create__retired {
  max-width: 420px;
  margin: 0;
  font-size: ${THEME.font.sm}px;
  color: ${THEME.color.muted};
  text-align: center;
}
.create__name {
  width: 220px;
  max-width: 100%;
  padding: 7px 9px;
  /* 16px or larger, or iOS Safari zooms the page when it takes focus. */
  font-size: 16px;
  text-align: center;
  color: ${THEME.color.text};
  background: ${INK};
  border: 1px solid ${INK_3};
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
  padding: ${THEME.padding + 1 - THEME.frame.panel}px;
  background: ${cssColor(THEME.panelBg)};
  ${framed('panel')}
  color: ${THEME.color.text};
  font: inherit;
  cursor: pointer;
}
.create__card.is-selected {
  ${reframed(accentPanel('yellow'))}
}
.create__card-name {
  ${pixelType(2)}
  color: ${THEME.color.levelUp};
}
.create__card-text {
  font-size: ${THEME.font.xs}px;
  color: ${THEME.color.muted};
  text-align: center;
}
/* The class as it starts, in the look chosen below, drawn in the world's art at
   a whole scale so every art pixel is one square. */
.create__portrait {
  display: block;
  image-rendering: pixelated;
}
.create__look {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: ${THEME.margin}px;
  max-width: 100%;
}
.create__look-rows {
  display: flex;
  flex-direction: column;
  gap: ${THEME.padding}px;
}
.create__look-row {
  display: flex;
  align-items: flex-start;
  gap: 6px;
}
.create__look-label {
  flex: none;
  width: 40px;
  line-height: 36px;
  font-size: ${THEME.font.sm}px;
  color: ${THEME.color.muted};
}
.create__look-options {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-width: 214px;
}
.create__choice {
  min-width: 36px;
  height: 36px;
  padding: 0 5px;
  background: ${STONE};
  ${framed('button')}
  color: ${THEME.color.text};
  ${pixelType(1)}
  cursor: pointer;
}
.create__choice--swatch {
  width: 36px;
  padding: 0;
  /* The colour itself is the face, which the frame's own fill would cover. */
  border-image: none;
  border: 3px solid ${INK_2};
}
.create__choice.is-selected {
  ${reframed('button-gold')}
}
.create__choice--swatch.is-selected {
  border-color: ${THEME.color.equippable};
  box-shadow: inset 0 0 0 2px ${INK};
}
.create__begin {
  width: 220px;
  max-width: 100%;
}
.create__begin:disabled {
  color: ${THEME.color.dim};
}
/* Under Begin and quieter than it: most who see this screen are starting. */
.create__load {
  width: 220px;
  max-width: 100%;
  font-size: ${THEME.font.sm}px;
}
/* The load panel over the creation screen, which has no .hud around it to take
   its type and colour from, and sits at the screen's own layer. */
.create__modal {
  z-index: 2;
  /* Dimmed behind, unlike a panel over the world: three class cards showing
     through a panel read as part of it. */
  background: ${cssRgba(rampStep('ink', 0), 0.6)};
  color: ${THEME.color.text};
  font-family: ${SANS};
  image-rendering: pixelated;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}
.create__modal * {
  box-sizing: border-box;
}

/* --- Slot picker --------------------------------------------------------- */

.hud-picker {
  position: absolute;
  width: ${THEME.panelWidth.character}px;
  max-height: 60%;
  overflow-y: auto;
  pointer-events: auto;
  background: ${cssColor(THEME.panelBg)};
  ${framed(accentPanel(FRAME_ACCENT.picker))}
  padding: ${THEME.padding + 1 - THEME.frame.panel}px;
}
.hud-picker__title {
  ${pixelType(1)}
  color: ${THEME.color.levelUp};
  margin-bottom: 4px;
}
.hud-picker__row {
  display: block;
  width: 100%;
  min-height: ${THEME.touchMin}px;
  padding: 3px ${THEME.padding - 1}px;
  margin-bottom: 2px;
  background: ${STONE_DARK};
  ${framed('row', STONE_DARK)}
  color: ${THEME.color.equippable};
  font: inherit;
  font-size: ${THEME.font.sm}px;
  text-align: left;
  cursor: pointer;
}
`;
}

/**
 * Idempotent: the HUD can be mounted and unmounted many times per page load.
 * The art the sheet names (the frames, the icons, the font) goes up with it.
 */
export function injectHudStyles(): void {
  installHudArt();
  if (document.getElementById(STYLE_ID)) {
    return;
  }
  const style = el('style');
  style.id = STYLE_ID;
  style.textContent = hudCss();
  document.head.append(style);
}
