import Phaser from 'phaser';

/**
 * Clip `target` to whatever `maskGraphics` fills, on either renderer.
 *
 * Phaser 4 split this by renderer and the split is invisible at compile time:
 * geometry masks became Canvas-only, so `createGeometryMask()` under WebGL
 * still typechecks, still runs, and silently stops clipping — a scrolling list
 * spills out of its panel and draws over the world. WebGL wants the Mask
 * filter instead, which only exists after `enableFilters()`.
 */
export function clipToMask(
  target: Phaser.GameObjects.Container,
  maskGraphics: Phaser.GameObjects.Graphics,
): void {
  target.enableFilters();

  const mask = target.filters?.internal.addMask(maskGraphics);
  if (mask) {
    // Redraws of maskGraphics have to reach the filter, or the clip freezes at
    // whatever rect the first frame happened to draw.
    mask.autoUpdate = true;
    return;
  }

  // No filters means no GL context — enableFilters() returns early there, and
  // Canvas is exactly where the geometry mask still works.
  target.setMask(maskGraphics.createGeometryMask());
}
