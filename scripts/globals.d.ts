/**
 * The three dev-only handles the smoke check reaches the game through.
 *
 * `render3d/start3d.ts` installs them behind an `import.meta.env.DEV` guard and
 * casts `window` to do it, so nothing in `src/` declares them. Declaring them
 * here is what lets `tsconfig.scripts.json` check the smoke script against the
 * real shapes rather than against `any`: a check that reads a field the world
 * stopped having becomes a compile error instead of an `undefined` that quietly
 * fails the assertion it was written to prove.
 */
import type { DebugView } from '../src/types/debugView';
import type { EventBus } from '../src/world/worldEvents';
import type { ZoneWorld } from '../src/world/ZoneWorld';

declare global {
  interface Window {
    /** The live world, re-set on every zone change. Null once a view is torn down. */
    world: ZoneWorld;
    /** Whatever is drawing, asked the few questions only it can answer. */
    view: DebugView;
    /** The HUD channel — the bus between the simulation and the overlay. */
    events: EventBus;
  }
}
