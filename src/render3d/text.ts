import { CanvasTexture, SRGBColorSpace, Sprite, SpriteMaterial } from 'three';

/**
 * How big the glyphs are baked, before the sprite is scaled to the height the
 * caller asked for. Larger than anything is drawn at, so text stays crisp on a
 * phone's 2x pixel ratio.
 */
const FONT_PX = 32;

/**
 * The dark edge every glyph is drawn inside, as a fraction of the font size.
 *
 * A name is read over grass, sand, marsh, rock and pale haze, and a coloured
 * glyph with nothing round it is legible over exactly the grounds it happens to
 * contrast with — a grey rat's name over the town road was not. An outline is
 * what every MMO nameplate wears for that reason, and it is baked into the
 * texture rather than drawn as a second sprite, which would be a second upload
 * for every name.
 */
const OUTLINE_FRACTION = 0.22;

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
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.lineJoin = 'round';
  context.lineWidth = FONT_PX * OUTLINE_FRACTION;
  context.strokeStyle = 'rgba(0, 0, 0, 0.85)';
  context.strokeText(text, canvas.width / 2, canvas.height / 2);
  context.fillStyle = color;
  context.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  const sprite = new Sprite(
    // `fog: false` for the same reason `depthTest` is off: everything baked
    // through here is a readout drawn in the world rather than a thing standing
    // in it — a name, a title, a shop sign, a damage number — and a signpost's
    // label hazing out at the edge of a zone would be the depth cue eating the
    // one piece of furniture a phone leaves a zone by.
    new SpriteMaterial({ map: texture, transparent: true, depthTest: false, fog: false }),
  );
  sprite.scale.set((height * canvas.width) / canvas.height, height, 1);
  return sprite;
}
