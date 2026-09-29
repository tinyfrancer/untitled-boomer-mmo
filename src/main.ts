import { startHost } from './host/host';
import { ZoneView3D } from './render3d/ZoneView3D';

startHost((parent) => new ZoneView3D(parent));
