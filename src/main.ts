import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from './config/constants';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { CharacterCreateScene } from './scenes/CharacterCreateScene';
import { TownScene } from './scenes/TownScene';
import { UIScene } from './scenes/UIScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#1a1a2e',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  dom: {
    createContainer: true,
  },
  scene: [BootScene, PreloadScene, CharacterCreateScene, TownScene, UIScene],
};

const game = new Phaser.Game(config);

// Dev-only handle on the running game, so the devtools console and the
// scripted smoke check can inspect live scene state. Stripped from production
// builds by the import.meta.env.DEV guard.
if (import.meta.env.DEV) {
  (window as unknown as { game: Phaser.Game }).game = game;
}
