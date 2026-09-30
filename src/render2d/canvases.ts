/**
 * Every canvas the 2D view holds, counted.
 *
 * What the view holds is canvases: the sprite sheets, the baked ground, each
 * building, each word. A zone change that does not let go of the last zone's
 * is the leak smoke has to find, and nothing else can see it, so every canvas
 * is made and let go through here and `DebugView.canvases()` reports the count.
 */
export class CanvasPool {
  private readonly held = new Set<HTMLCanvasElement>();

  /** A canvas of this size, with its 2D context, drawing whole pixels only. */
  make(
    width: number,
    height: number,
  ): {
    canvas: HTMLCanvasElement;
    context: CanvasRenderingContext2D;
  } {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil(width));
    canvas.height = Math.max(1, Math.ceil(height));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('this browser has no 2D canvas');
    context.imageSmoothingEnabled = false;
    this.held.add(canvas);
    return { canvas, context };
  }

  /** A canvas holding exactly these pixels. */
  fromPixels(width: number, height: number, pixels: Uint8ClampedArray): HTMLCanvasElement {
    const { canvas, context } = this.make(width, height);
    const image = context.createImageData(width, height);
    image.data.set(pixels);
    context.putImageData(image, 0, 0);
    return canvas;
  }

  /**
   * Lets a canvas go. Shrunk to nothing first, which is what makes a browser
   * give its memory back now rather than whenever the element is collected.
   */
  release(canvas: HTMLCanvasElement | null | undefined): void {
    if (!canvas || !this.held.delete(canvas)) return;
    canvas.width = 0;
    canvas.height = 0;
  }

  count(): number {
    return this.held.size;
  }
}
