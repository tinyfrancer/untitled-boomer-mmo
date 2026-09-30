import { rendererRequested } from './config/flags';
import { startHost } from './host/host';
import { ZoneView3D } from './render3d/ZoneView3D';

// The 2D view and the art it compiles are loaded only when asked for, so a 3D
// session carries none of it while both renderers exist.
if (rendererRequested(window.location.search) === '2d') {
  void import('./render2d/ZoneView2D').then(({ ZoneView2D }) =>
    startHost((parent) => new ZoneView2D(parent)),
  );
} else {
  startHost((parent) => new ZoneView3D(parent));
}
