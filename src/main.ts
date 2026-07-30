import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from './config/constants';
import { PreloadScene } from './scenes/PreloadScene';
import { ZoneScene } from './scenes/ZoneScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#1a1a2e',
  scale: {
    // The canvas is always the viewport's size, so UI code works in real CSS
    // pixels; the world camera compensates with zoom (see worldZoom in
    // ui/theme.ts). FIT letterboxed a fixed canvas, which shrank the HUD into
    // illegibility on phones.
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  // No `dom` container: the only DOM Phaser was hosting was the name box on the
  // creation screen, and that screen is plain HTML now.
  scene: [PreloadScene, ZoneScene],
};

const game = new Phaser.Game(config);

// Dev-only handle on the running game, for the generated textures and the frame
// loop. Everything about the simulation is on window.world and everything about
// the HUD is in the DOM. Stripped from production builds by the guard.
if (import.meta.env.DEV) {
  (window as unknown as { game: Phaser.Game }).game = game;
}
