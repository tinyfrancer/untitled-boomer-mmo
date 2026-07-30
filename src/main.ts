import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from './config/constants';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { CharacterCreateScene } from './scenes/CharacterCreateScene';
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
  dom: {
    createContainer: true,
  },
  scene: [BootScene, PreloadScene, CharacterCreateScene, ZoneScene],
};

const game = new Phaser.Game(config);

// Dev-only handle on the running game, so the devtools console and the
// scripted smoke check can inspect live scene state. Stripped from production
// builds by the import.meta.env.DEV guard.
if (import.meta.env.DEV) {
  (window as unknown as { game: Phaser.Game }).game = game;
}
