import { rendererRequested } from './config/flags';
import { startHost } from './host/host';
import { ZoneView2D } from './render2d/ZoneView2D';
import { ZoneView3D } from './render3d/ZoneView3D';

startHost(
  rendererRequested(window.location.search) === '2d'
    ? (parent) => new ZoneView2D(parent)
    : (parent) => new ZoneView3D(parent),
);
