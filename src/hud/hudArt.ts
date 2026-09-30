import { packAtlas, type Atlas } from '../art/compile';
import { FONT_FAMILY, fontFile } from '../art/fontFile';
import { HUD_FRAMES, framePicture, iconFrames, type HudFrameName } from '../art/hud';
import { itemIconKey } from '../art/icons';
import type { ItemId } from '../types/ids';
import { el } from './dom';

/**
 * Where the HUD's art meets the page (B8, decision 111): each frame and the
 * sheet of icons written onto a canvas once and handed to the stylesheet as an
 * image, and the world's font handed to the page as a font. Once a page, like
 * the stylesheet, since the HUD is mounted and unmounted many times in one.
 *
 * The pictures are compiled in `art/` as the world's sprites are, so nothing
 * here decides what anything looks like; it only moves pixels into the
 * places a page can draw them from.
 */

const ART_STYLE_ID = 'hud-art';

/**
 * Whether this page can draw. jsdom has canvases with nothing behind them and
 * says so loudly when one is asked for a context, so a test's HUD comes up in
 * the stylesheet's plain borders and the system font, which is also what a
 * browser that could not build the art would show.
 */
export function canDraw(): boolean {
  return !navigator.userAgent.includes('jsdom');
}

/** The custom property a frame's picture is handed to the stylesheet by. */
export function frameVar(name: HudFrameName): string {
  return `--hud-frame-${name}`;
}

/** The custom property the sheet of icons is. */
export const ICON_SHEET_VAR = '--hud-icons';

let sheet: Atlas | null = null;

/**
 * The icons packed onto one sheet, and where each landed. Packed whether or
 * not the page can draw, since where an icon is on the sheet is arithmetic an
 * element's style is written from either way.
 */
export function iconSheet(): Atlas {
  sheet ??= packAtlas(iconFrames(), 512);
  return sheet;
}

function pictureUrl(width: number, height: number, pixels: Uint8ClampedArray): string {
  const canvas = el('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return 'none';
  const image = context.createImageData(width, height);
  image.data.set(pixels);
  context.putImageData(image, 0, 0);
  return `url(${canvas.toDataURL('image/png')})`;
}

/** Idempotent, like the stylesheet it feeds. */
export function installHudArt(): void {
  if (document.getElementById(ART_STYLE_ID) || !canDraw()) return;
  const frames = (Object.keys(HUD_FRAMES) as HudFrameName[]).map((name) => {
    const picture = framePicture(name);
    return `${frameVar(name)}: ${pictureUrl(picture.width, picture.height, picture.pixels)};`;
  });
  const icons = iconSheet();
  const style = el('style');
  style.id = ART_STYLE_ID;
  style.textContent = `:root {\n${[
    ...frames,
    `${ICON_SHEET_VAR}: ${pictureUrl(icons.width, icons.height, icons.pixels)};`,
  ].join('\n')}\n}`;
  document.head.append(style);
  loadFont();
}

/**
 * The world's font, written as a font file in memory and handed to the page.
 * Until it has loaded, and on a page that would not take it, the stylesheet's
 * next font down draws the words, so nothing waits on it.
 */
function loadFont(): void {
  if (typeof FontFace === 'undefined') return;
  const face = new FontFace(FONT_FAMILY, fontFile());
  document.fonts.add(face);
  void face.load().catch(() => undefined);
}

/**
 * An icon as an element: a box the size of the icon at `scale` CSS pixels to
 * the art pixel, showing its place on the sheet. The key is the icon's frame
 * (`art/icons.ts` names each), which is also what the tests read it by.
 */
export function iconEl(key: string, scale = 1, className = 'hud-icon'): HTMLElement {
  const icons = iconSheet();
  const rect = icons.frames.get(key);
  const node = el('span', className);
  node.dataset.icon = key;
  node.setAttribute('aria-hidden', 'true');
  if (!rect) return node;
  node.style.width = `${rect.width * scale}px`;
  node.style.height = `${rect.height * scale}px`;
  node.style.backgroundSize = `${icons.width * scale}px ${icons.height * scale}px`;
  node.style.backgroundPosition = `${-rect.x * scale}px ${-rect.y * scale}px`;
  return node;
}

/** An item's icon, which every row, cell and card that shows an item hangs. */
export function itemIconEl(itemId: ItemId, scale = 1): HTMLElement {
  return iconEl(itemIconKey(itemId), scale);
}

/**
 * A figure compiled by the art (`art/outfit.ts`'s `portrait`) put on a canvas
 * at a whole number of CSS pixels to the art pixel. A page that cannot draw
 * keeps the canvas at its size and empty.
 */
export function drawPortrait(
  canvas: HTMLCanvasElement,
  picture: { width: number; height: number; pixels: Uint8ClampedArray },
  scale: number,
): void {
  canvas.width = picture.width;
  canvas.height = picture.height;
  canvas.style.width = `${picture.width * scale}px`;
  canvas.style.height = `${picture.height * scale}px`;
  const context = canDraw() ? canvas.getContext('2d') : null;
  if (!context) return;
  const image = context.createImageData(picture.width, picture.height);
  image.data.set(picture.pixels);
  context.putImageData(image, 0, 0);
}
