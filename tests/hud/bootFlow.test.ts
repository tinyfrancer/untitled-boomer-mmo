import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { bootIntoGame, showCharacterCreate, type GameHost } from '../../src/bootFlow';
import { unmountCharacterCreate } from '../../src/hud/CharacterCreate';
import { createNewCharacter, saveService } from '../../src/persistence';
import { writeSaveExport } from '../../src/persistence/saveFile';
import { endGame, gameContext } from '../../src/world/GameContext';
import { recordingBus, type Emitted } from '../world/harness';

/**
 * The boot decision, which is an if-statement and a form: resume the save, or
 * ask who the player wants to be.
 *
 * Nothing here needs a renderer — that is the seam `GameHost` exists to draw,
 * and this is the proof of it: the whole flow runs against two methods, and the
 * creation screen is shown before anything could be drawing.
 */

let emitted: Emitted[];
let startZone: Mock<() => void>;
let host: GameHost;

function createScreen(): HTMLElement | null {
  return document.querySelector('.create');
}

function chooseClass(classId: string): void {
  document.querySelector<HTMLButtonElement>(`.create__card[data-class="${classId}"]`)?.click();
}

function typeName(name: string): void {
  const input = document.querySelector<HTMLInputElement>('.create__name');
  if (!input) throw new Error('the creation screen has no name box');
  input.value = name;
}

function begin(): HTMLButtonElement {
  const button = document.querySelector<HTMLButtonElement>('.create__begin');
  if (!button) throw new Error('the creation screen has no begin button');
  return button;
}

beforeEach(() => {
  localStorage.clear();
  emitted = [];
  startZone = vi.fn<() => void>();
  host = { events: recordingBus(emitted), startZone };
});

afterEach(() => {
  endGame();
  // The creation screen is a module singleton, like the session and the HUD:
  // left mounted, the next test's boot finds one already up and does nothing.
  unmountCharacterCreate();
  document.body.replaceChildren();
});

describe('bootIntoGame', () => {
  it('resumes a save without asking anything', () => {
    saveService.save({ ...createNewCharacter('Returning', 'wizard'), level: 4 });

    bootIntoGame(host);

    expect(createScreen()).toBeNull();
    expect(startZone).toHaveBeenCalledOnce();
    expect(gameContext()?.character.state).toMatchObject({ name: 'Returning', level: 4 });
  });

  it('resumes into the zone the save names rather than into town', () => {
    saveService.save({ ...createNewCharacter('Beachgoer', 'warrior'), zoneId: 'beach' });

    bootIntoGame(host);

    expect(gameContext()?.currentWorld.zone.id).toBe('beach');
  });

  it('hands the session the channel the host brought, so the HUD hears the world', () => {
    saveService.save(createNewCharacter('Returning', 'warrior'));

    bootIntoGame(host);

    // The world publishes the player's state as it comes up. Nothing else could
    // put it on this bus: the host's is the only one that was passed anywhere.
    expect(emitted.map((event) => event.event)).toContain('player-hp-changed');
  });

  it('asks who the player wants to be when there is no save', () => {
    bootIntoGame(host);

    expect(createScreen()).not.toBeNull();
    // Nothing exists yet: no session, and nothing has been asked to draw one.
    expect(gameContext()).toBeNull();
    expect(startZone).not.toHaveBeenCalled();
  });

  it('starts the session the creation screen produces, and takes the screen down', () => {
    bootIntoGame(host);
    typeName('Newcomer');
    chooseClass('wizard');
    begin().click();

    expect(createScreen()).toBeNull();
    expect(startZone).toHaveBeenCalledOnce();
    expect(gameContext()?.character.state).toMatchObject({ name: 'Newcomer', classId: 'wizard' });
  });

  it('saves the new character before the first frame runs', () => {
    bootIntoGame(host);
    typeName('Newcomer');
    chooseClass('warrior');
    begin().click();

    // A tab closed on the spawn point still has a character to come back to.
    expect(saveService.load()).toMatchObject({ name: 'Newcomer', classId: 'warrior' });
  });

  it('loads a save instead, which becomes the save, with no character made first', () => {
    bootIntoGame(host);
    document.querySelector<HTMLButtonElement>('.create [data-action="open-load-save"]')?.click();
    const box = document.querySelector<HTMLTextAreaElement>('[data-action="save-code-input"]');
    if (!box) throw new Error('the load panel has no code box');
    box.value = writeSaveExport('code', {
      ...createNewCharacter('Traveller', 'ranger'),
      level: 5,
    }).text;
    box.dispatchEvent(new Event('input'));
    document.querySelector<HTMLButtonElement>('[data-action="load-save-code"]')?.click();
    document.querySelector<HTMLButtonElement>('[data-action="confirm-load-save"]')?.click();

    expect(createScreen()).toBeNull();
    expect(document.querySelector('.hud-modal')).toBeNull();
    expect(startZone).toHaveBeenCalledOnce();
    expect(gameContext()?.character.state).toMatchObject({ name: 'Traveller', level: 5 });
    expect(saveService.load()).toMatchObject({ name: 'Traveller', level: 5 });
  });

  it('starts nothing until a class is chosen', () => {
    bootIntoGame(host);
    typeName('Newcomer');
    begin().click();

    expect(begin().disabled).toBe(true);
    expect(createScreen()).not.toBeNull();
    expect(gameContext()).toBeNull();
  });
});

describe('showCharacterCreate', () => {
  it('ignores whatever is saved — it is the reset path as well as the first boot', () => {
    saveService.save(createNewCharacter('Returning', 'warrior'));

    showCharacterCreate(host);

    expect(createScreen()).not.toBeNull();
    expect(gameContext()).toBeNull();
  });
});
