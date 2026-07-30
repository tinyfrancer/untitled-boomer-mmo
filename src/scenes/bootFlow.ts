import type Phaser from 'phaser';
import { mountCharacterCreate, unmountCharacterCreate } from '../hud/CharacterCreate';
import { uiRoot } from '../hud/dom';
import { createNewCharacter, saveService, type CharacterState } from '../persistence';
import { startGame } from '../world/GameContext';

/**
 * What happens between "the textures exist" and "the player is in a zone".
 *
 * It used to be two scenes and a `scene.start`, which is a lot of machinery for
 * an if-statement plus a form. `Zone` is the only scene that draws anything now,
 * and this is the only thing that starts it.
 */
export function beginSession(game: Phaser.Game, character: CharacterState): void {
  startGame({ character, events: game.events });
  game.scene.start('Zone');
}

/** Shows the creation screen and starts the game with whatever it produces. */
export function showCharacterCreate(game: Phaser.Game): void {
  mountCharacterCreate({
    parent: uiRoot(),
    onBegin: (name, classId) => {
      const character = createNewCharacter(name, classId);
      saveService.save(character);
      unmountCharacterCreate();
      beginSession(game, character);
    },
  });
}

/** The boot decision: resume a save, or ask who the player wants to be. */
export function bootIntoGame(game: Phaser.Game): void {
  const saved = saveService.load();
  if (saved) {
    beginSession(game, saved);
    return;
  }
  showCharacterCreate(game);
}
