import { manualLoopRequested } from '../config/flags';
import { bootIntoGame, showCharacterCreate, type GameHost } from '../bootFlow';
import { hudMounted, mountHud, unmountHud } from '../hud/Hud';
import { uiRoot } from '../hud/dom';
import { bindKeyboard } from '../systems/InputState';
import { RESET_CHARACTER_REQUESTED_EVENT } from '../ui/uiEvents';
import { createEventBus } from '../world/eventBus';
import { bindUnloadPersist, gameContext, resetGame, type GameContext } from '../world/GameContext';
import { OrbitGesture } from './orbit';
import { ZoneView3D } from './ZoneView3D';
import type { DebugView, DrawnCounts } from '../types/debugView';
import type { EventBus } from '../world/worldEvents';
import type { ZoneWorld } from '../world/ZoneWorld';

/** What a view that has been taken down is drawing: nothing. */
const EMPTY_COUNTS: DrawnCounts = {
  total: 0,
  ground: 0,
  mobs: 0,
  nodes: 0,
  signposts: 0,
  npcs: 0,
  labels: 0,
  fx: 0,
};

/** `?loop=manual` hands the simulation's clock to `window.view.step()`. */
const MANUAL_LOOP = import.meta.env.DEV && manualLoopRequested(window.location.search);

/**
 * The longest frame the simulation will be told about.
 *
 * A backgrounded tab stops getting animation frames and comes back with an
 * hour on the clock; handing that to `update()` as one step would resolve an
 * entire AFK session in a single frame, through code written for tens of
 * milliseconds. Phaser's TimeStep clamped this for us and a raw loop has to do
 * it itself. 100ms is 10fps — slower than any frame the game is expected to
 * survive, and it *is* expected to survive them (see the arriveRadius note in
 * CLAUDE.md).
 */
const MAX_FRAME_MS = 100;

/**
 * The host: everything that has to happen around a zone without drawing it.
 *
 * It owns the frame loop, the keyboard, the pointer, the HUD mount and the
 * reset, and it hands the session's world to a `ZoneView3D`. Neither the
 * `GameContext` under it nor the HUD over it knows what is drawing — which is
 * what made swapping the renderer possible, and is why host duties belong
 * here rather than leaking into either.
 */
class ThreeHost implements GameHost {
  readonly events = createEventBus();

  private context: GameContext | null = null;
  private view: ZoneView3D | null = null;
  private readonly gesture = new OrbitGesture();
  // Only the first pointer down drives the camera. A second finger arriving is
  // a pinch the browser is not going to get (see `touch-action`), and letting
  // it join in would make the yaw jump between two thumbs.
  private pointerId: number | null = null;
  private frameHandle: number | null = null;
  private lastFrameAt = 0;
  private resizeObserver: ResizeObserver | null = null;
  private unbindKeyboard: (() => void) | null = null;
  private unbindUnloadPersist: (() => void) | null = null;

  startZone(): void {
    const context = gameContext();
    if (!context) {
      throw new Error('startZone() with no session: start one before showing a zone');
    }
    this.context = context;

    this.view = new ZoneView3D(uiRoot());
    this.view.build(context.currentWorld);
    this.publishWorld();
    if (import.meta.env.DEV) {
      this.installDebugView();
    }

    // The HUD outlives every zone and every renderer: an HTML overlay that
    // knows only the event channel it was handed.
    if (!hudMounted()) {
      mountHud({
        parent: uiRoot(),
        events: this.events,
        character: context.character.state,
        notifications: context.takeNotifications(),
      });
    }

    this.view.canvas.addEventListener('pointerdown', this.handlePointerDown);
    this.view.canvas.addEventListener('pointermove', this.handlePointerMove);
    this.view.canvas.addEventListener('pointerup', this.handlePointerUp);
    this.view.canvas.addEventListener('pointercancel', this.handlePointerCancel);
    this.unbindKeyboard = bindKeyboard(context.input, window);
    this.unbindUnloadPersist = bindUnloadPersist(context, window);
    this.events.on(RESET_CHARACTER_REQUESTED_EVENT, this.resetCharacter);
    // An observer rather than a window resize event, for the same reason the
    // HUD uses one: an iOS toolbar retracting changes the box with no resize
    // to hear.
    this.resizeObserver = new ResizeObserver(() => this.view?.resize());
    this.resizeObserver.observe(uiRoot());

    this.lastFrameAt = performance.now();
    this.frameHandle = requestAnimationFrame(this.loop);
  }

  private readonly loop = (now: number): void => {
    this.frameHandle = requestAnimationFrame(this.loop);
    const delta = Math.min(now - this.lastFrameAt, MAX_FRAME_MS);
    this.lastFrameAt = now;
    if (!MANUAL_LOOP) {
      this.tick(delta);
    }
    // Drawing keeps running under the hand crank — the camera still follows,
    // the canvas still redraws — so a smoke check that clicks something sees
    // the same frame a player would.
    this.view?.render();
  };

  /**
   * A press on the world starts a gesture that is not yet either thing.
   *
   * A press on the HUD never gets here — it is an HTML overlay above the
   * canvas, so the browser hands the event to the element instead — which is
   * the whole of a hit test the 2D renderer had to do by hand.
   */
  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (!this.context || !this.view || this.pointerId !== null) return;
    this.pointerId = event.pointerId;
    // Captured, so a drag that runs off the canvas — or off the window — keeps
    // reporting instead of leaving the camera stuck mid-turn with no pointerup
    // ever arriving.
    this.view.canvas.setPointerCapture(event.pointerId);
    this.gesture.start(event.clientX, event.clientY, event.timeStamp);
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId) return;
    const yawDelta = this.gesture.move(event.clientX, event.clientY);
    if (yawDelta === 0 || !this.view || !this.context) return;
    this.view.orbitBy(yawDelta);
    // Turning the camera turns what W means. Set here rather than every frame
    // because this is the only thing that moves it.
    this.context.input.setViewYaw(this.view.cameraYaw());
  };

  /**
   * A release that was a tap: what it landed on is the view's question, what to
   * do about it is the world's. A release that ended a drag has already spent
   * itself on the camera and asks the world for nothing.
   */
  private readonly handlePointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId) return;
    this.releasePointer(event.pointerId);
    const context = this.context;
    const view = this.view;
    if (!this.gesture.end(event.timeStamp) || !context || !view) return;

    const bounds = view.canvas.getBoundingClientRect();
    const tap = view.resolveTap(event.clientX - bounds.left, event.clientY - bounds.top);
    // Null is a ray that never reaches the ground. The orbit is yaw only, so
    // the camera still cannot be aimed at the sky — see `groundUnder`.
    if (tap) context.currentWorld.tap(tap);
  };

  private readonly handlePointerCancel = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId) return;
    this.releasePointer(event.pointerId);
    this.gesture.cancel();
  };

  private releasePointer(pointerId: number): void {
    this.pointerId = null;
    if (this.view?.canvas.hasPointerCapture(pointerId)) {
      this.view.canvas.releasePointerCapture(pointerId);
    }
  }

  private tick(deltaMs: number): void {
    const context = this.context;
    const view = this.view;
    if (!context || !view) return;

    const { events, zoneChanged } = context.update(deltaMs);
    if (zoneChanged) {
      // The frame's WorldEvents came from a world that has already been torn
      // down, so there is nothing left to draw them over.
      view.teardown();
      view.build(context.currentWorld);
      this.publishWorld();
      return;
    }
    view.draw(events);
  }

  /**
   * Ends the session's view. Stops the loop first: a frame that runs after the
   * world is gone is a frame drawing a game nobody is playing.
   */
  private stopZone(): void {
    if (this.frameHandle !== null) {
      cancelAnimationFrame(this.frameHandle);
      this.frameHandle = null;
    }
    this.events.off(RESET_CHARACTER_REQUESTED_EVENT, this.resetCharacter);
    const canvas = this.view?.canvas;
    canvas?.removeEventListener('pointerdown', this.handlePointerDown);
    canvas?.removeEventListener('pointermove', this.handlePointerMove);
    canvas?.removeEventListener('pointerup', this.handlePointerUp);
    canvas?.removeEventListener('pointercancel', this.handlePointerCancel);
    this.gesture.cancel();
    this.pointerId = null;
    this.unbindKeyboard?.();
    this.unbindKeyboard = null;
    this.unbindUnloadPersist?.();
    this.unbindUnloadPersist = null;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.view?.dispose();
    this.view = null;
    this.context = null;
    this.publishWorld();
  }

  private readonly resetCharacter = (): void => {
    resetGame();
    this.stopZone();
    unmountHud();
    showCharacterCreate(this);
  };

  // ---------------------------------------------------------------------------
  // Debug handles
  // ---------------------------------------------------------------------------

  // Re-set on every zone change, since each one is a new world, and cleared on
  // the way out: a stale handle answers questions about a world that stopped.
  private publishWorld(): void {
    if (import.meta.env.DEV) {
      (window as unknown as { world: ZoneWorld | null }).world = this.context?.currentWorld ?? null;
    }
  }

  private installDebugView(): void {
    // The HUD channel, which is neither the simulation nor the drawing and so
    // is on neither of the other two handles. It is how a check reaches a
    // panel whose state has no cheap route through the world — two hundred
    // combat-log lines, or a bag filled to the brim to scroll.
    (window as unknown as { events: EventBus }).events = this.events;
    const view: DebugView = {
      worldToScreen: (x, y) => this.view?.worldToScreen(x, y) ?? { x: 0, y: 0 },
      step: (deltaMs, frames = 1) => {
        for (let frame = 0; frame < frames; frame += 1) {
          this.tick(deltaMs);
        }
      },
      drawnCounts: () => this.view?.drawnCounts() ?? EMPTY_COUNTS,
      playerFigure: () => this.view?.playerFigure() ?? { walking: false, pose: 'none' },
      gpuMemory: () => this.view?.gpuMemory() ?? { geometries: 0, textures: 0 },
    };
    (window as unknown as { view: DebugView }).view = view;
  }
}

/** Boots the game. */
export function start3d(): void {
  bootIntoGame(new ThreeHost());
}
