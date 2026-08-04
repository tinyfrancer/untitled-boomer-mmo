import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants';
import { PreloadScene } from './PreloadScene';
import { ZoneScene } from './ZoneScene';
import type { GameHost } from '../bootFlow';

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

/**
 * The 2D renderer, as the boot flow sees it: an event channel and a way to
 * start drawing. Phaser's global emitter is the channel, and `Zone` is the one
 * scene that draws anything.
 */
export function phaserHost(game: Phaser.Game): GameHost {
  return {
    events: game.events,
    startZone: () => game.scene.start('Zone'),
  };
}

/** Boots the game with Phaser drawing it, behind `?renderer=2d` until PR 20 deletes it. */
export function start2d(): void {
  const game = new Phaser.Game(config);

  // Dev-only handle on the running game, for the generated textures and the
  // frame loop. Everything about the simulation is on window.world and
  // everything about the HUD is in the DOM. Stripped from production builds.
  if (import.meta.env.DEV) {
    (window as unknown as { game: Phaser.Game }).game = game;
  }
}
