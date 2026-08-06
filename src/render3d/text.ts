import { CanvasTexture, SRGBColorSpace, Sprite, SpriteMaterial } from 'three';

/**
 * How big the glyphs are baked, before the sprite is scaled to the height the
 * caller asked for. Larger than anything is drawn at, so text stays crisp on a
 * phone's 2x pixel ratio.
 */
const FONT_PX = 32;

/**
 * A line of text, baked onto a canvas and hung on a sprite.
 *
 * There is no DOM option here: an HTML label would need the HUD to project
 * every creature's position to the screen once a frame, which is exactly the
 * coupling the HUD is kept free of (see the floating-text note in
 * `docs/archive/3d_port_plan.md`). A sprite faces the camera by construction,
 * which is also why a damage number needs no billboarding of its own.
 *
 * Returns null where there is no 2D canvas to draw on, which is jsdom — the
 * unit suite builds nameplates and floats and would otherwise die on the text.
 * What one says is `scripts/smoke.mjs`'s to check, in a browser that has one.
 */
export function buildText(text: string, color: string, height: number): Sprite | null {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return null;

  const font = `bold ${FONT_PX}px sans-serif`;
  context.font = font;
  canvas.width = Math.ceil(context.measureText(text).width) + FONT_PX;
  canvas.height = Math.ceil(FONT_PX * 1.4);
  // Resizing the canvas resets everything set on the context above it.
  context.font = font;
  context.fillStyle = color;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  const sprite = new Sprite(
    new SpriteMaterial({ map: texture, transparent: true, depthTest: false }),
  );
  sprite.scale.set((height * canvas.width) / canvas.height, height, 1);
  return sprite;
}
