import { startHost } from './host/host';
import { ZoneView2D } from './render2d/ZoneView2D';

startHost((parent) => new ZoneView2D(parent));
