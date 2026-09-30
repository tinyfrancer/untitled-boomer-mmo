import { rendererRequested } from './config/flags';
import { startHost } from './host/host';
import { ZoneView2D } from './render2d/ZoneView2D';

// The 3D view is loaded only when asked for, so the game as it is played
// carries none of Three.js while the fallback still exists (B7 deletes it).
if (rendererRequested(window.location.search) === '3d') {
  void import('./render3d/ZoneView3D').then(({ ZoneView3D }) =>
    startHost((parent) => new ZoneView3D(parent)),
  );
} else {
  startHost((parent) => new ZoneView2D(parent));
}
