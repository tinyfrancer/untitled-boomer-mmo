import { mountCharacterCreate, unmountCharacterCreate } from './hud/CharacterCreate';
import { uiRoot } from './hud/dom';
import { createNewCharacter, saveService, type CharacterState } from './persistence';
import { startGame } from './world/GameContext';
import type { EventBus } from './world/worldEvents';

/**
 * Whatever is going to draw the world, as little of it as the boot flow needs.
 *
 * One renderer answers it today. The interface is what let two of them answer
 * it during the port without either appearing here, and it is what a second
 * one would need again — so it stays beside `main.ts` rather than inside the
 * renderer.
 */
export interface GameHost {
  /** The HUD channel: what the world emits on and the HUD listens to. */
  events: EventBus;
  /** Starts drawing the session that has just been started. */
  startZone(): void;
}

/**
 * What happens between "the host is ready" and "the player is in a zone".
 *
 * An if-statement plus a form, and deliberately no more than that: nothing
 * before the world needs a renderer at all, which is what lets the creation
 * screen be shown before one exists.
 */
function beginSession(host: GameHost, character: CharacterState): void {
  startGame({ character, events: host.events });
  host.startZone();
}

/**
 * Starts the game with a character brought back from a save file or code, which
 * becomes the save — the other way a session starts with no save to resume.
 */
export function beginLoadedCharacter(host: GameHost, character: CharacterState): void {
  saveService.save(character);
  beginSession(host, character);
}

/** Shows the creation screen and starts the game with whatever it produces. */
export function showCharacterCreate(host: GameHost): void {
  mountCharacterCreate({
    parent: uiRoot(),
    onBegin: (name, classId, look) => {
      const character = createNewCharacter(name, classId, look);
      saveService.save(character);
      unmountCharacterCreate();
      beginSession(host, character);
    },
    onLoad: (character) => {
      unmountCharacterCreate();
      beginLoadedCharacter(host, character);
    },
  });
}

/** The boot decision: resume a save, or ask who the player wants to be. */
export function bootIntoGame(host: GameHost): void {
  const saved = saveService.load();
  if (saved) {
    beginSession(host, saved);
    return;
  }
  showCharacterCreate(host);
}
