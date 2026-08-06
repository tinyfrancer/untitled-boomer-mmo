import { ZONES, type ZoneEdge } from '../data/zones';
import { CharacterController } from '../systems/CharacterController';
import { InputState } from '../systems/InputState';
import { saveService, type CharacterState } from '../persistence';
import type { OfflineAfkReport } from '../systems/OfflineAfkSystem';
import type { AchievementUnlock } from '../ui/uiEvents';
import type { ZoneId } from '../types/ids';
import { ZoneWorld } from './ZoneWorld';
import type { EventBus, WorldEvent } from './worldEvents';

// Often enough that a closed tab costs a fight rather than a session, rarely
// enough that it is nowhere near the write budget of localStorage.
const AUTOSAVE_INTERVAL_MS = 30000;

/** Where the next world starts the player, once the current one is done with them. */
export interface ZoneLoadRequest {
  zoneId: ZoneId;
  /** Which edge they walked in through, when they walked. */
  entry?: { edge: ZoneEdge; fraction: number };
  /** HP carried across a zone walk; absent on death, where full is the point. */
  hp?: number;
}

/**
 * Something that happened before the HUD existed to be told about it. The only
 * one today is an offline camp's payout: it is resolved on the load that finds
 * the parked session, which is necessarily before the HUD has mounted, so it
 * waits in a queue the HUD drains instead of being emitted into an empty room.
 */
export interface OfflineAfkNotification {
  kind: 'offline-afk';
  report: OfflineAfkReport;
}
export interface AchievementsNotification {
  kind: 'achievements';
  unlocks: AchievementUnlock[];
}
export type PendingNotification = OfflineAfkNotification | AchievementsNotification;

export interface GameContextOptions {
  character: CharacterState;
  events: EventBus;
  /** Deterministic mob wander, for tests. */
  rng?: () => number;
}

/**
 * The session: everything that outlives a zone. It owns the character, the
 * keyboard state and whichever ZoneWorld is currently running, and it is the
 * only thing that builds or tears down a world.
 *
 * Building and tearing down through one named seam is the point: the renderer
 * leaks GPU memory for every geometry, material and texture nobody calls
 * `.dispose()` on, and a zone walk is exactly the loop that finds such a leak.
 */
export class GameContext {
  readonly character: CharacterController;
  readonly input = new InputState();

  private readonly events: EventBus;
  private readonly rng?: () => number;
  private notifications: PendingNotification[] = [];
  private world: ZoneWorld;
  private sinceSaveMs = 0;
  private destroyed = false;

  constructor(options: GameContextOptions) {
    this.events = options.events;
    this.rng = options.rng;
    this.character = new CharacterController(options.character);
    this.world = this.buildWorld({ zoneId: options.character.zoneId ?? 'town' });
    this.collectParkedAfk();
  }

  /** The world running right now. A zone change replaces it with another. */
  get currentWorld(): ZoneWorld {
    return this.world;
  }

  /**
   * Steps the session a frame. `zoneChanged` means the world the events came
   * from has already been destroyed and a new one is running: a view has to
   * rebuild against `currentWorld` rather than draw them.
   */
  update(deltaMs: number): { events: WorldEvent[]; zoneChanged: boolean } {
    // A reset ends the session from inside a tick — the F9 that asks for one is
    // drained by the world this is stepping — so the rest of that frame has to
    // find a session that is already over, and not save the character it just
    // wiped.
    if (this.destroyed) return { events: [], zoneChanged: false };
    const events = this.world.update(deltaMs);
    this.autosave(deltaMs);

    const request = events.reduce<ZoneLoadRequest | null>(
      (found, event) => found ?? this.zoneLoadFor(event),
      null,
    );
    if (!request) {
      return { events, zoneChanged: false };
    }
    this.loadZone(request);
    return { events, zoneChanged: true };
  }

  /** Destroys the running world and builds the next one. */
  loadZone(request: ZoneLoadRequest): ZoneWorld {
    this.world.destroy();
    this.world = this.buildWorld(request);
    return this.world;
  }

  /** Everything that happened before the HUD could hear it, drained once. */
  takeNotifications(): PendingNotification[] {
    const pending = this.notifications;
    this.notifications = [];
    return pending;
  }

  /** Saves now, whatever the accumulator says: a closing tab has no next frame. */
  persist(): void {
    if (this.destroyed) return;
    this.world.persistCharacter();
    this.sinceSaveMs = 0;
  }

  /** Ends the session. The character stays on disk unless the caller clears it. */
  destroy(): void {
    this.destroyed = true;
    this.world.destroy();
    this.notifications = [];
  }

  // The two ways a world hands the player to the next one. Both are the world
  // refusing to load a zone on purpose (see ZoneWorld's class comment): it says
  // where the player is going and stops, and building that zone is this job.
  private zoneLoadFor(event: WorldEvent): ZoneLoadRequest | null {
    if (event.kind === 'zone-exit') {
      return {
        zoneId: event.to,
        entry: { edge: event.edge, fraction: event.fraction },
        // Carried so crossing a zone line is never a free heal.
        hp: this.world.player.hp,
      };
    }
    if (event.kind === 'death' && event.on === 'player' && event.respawnZone) {
      // No hp: a respawn is the one arrival that is meant to be at full.
      return { zoneId: event.respawnZone };
    }
    return null;
  }

  private buildWorld(request: ZoneLoadRequest): ZoneWorld {
    return new ZoneWorld({
      zone: ZONES[request.zoneId],
      character: this.character,
      events: this.events,
      input: this.input,
      entry: request.entry,
      hp: request.hp,
      rng: this.rng,
    });
  }

  // The accumulator belongs to the session rather than to the world: when it
  // died and was rebuilt with the zone, a player who crossed a zone line every
  // 29 seconds was never autosaved at all.
  private autosave(deltaMs: number): void {
    this.sinceSaveMs += deltaMs;
    if (this.sinceSaveMs < AUTOSAVE_INTERVAL_MS) return;
    this.sinceSaveMs = 0;
    this.world.persistCharacter();
  }

  private collectParkedAfk(): void {
    const resolved = this.world.resolveParkedAfk();
    if (!resolved) return;
    this.notifications.push({ kind: 'offline-afk', report: resolved.report });
    if (resolved.unlocks.length > 0) {
      this.notifications.push({ kind: 'achievements', unlocks: resolved.unlocks });
    }
  }
}

// The one session in play. A module-level slot rather than a parameter because
// the boot flow hands the game over between scenes today and between plain
// modules after the port, and both need somewhere to find it. Everything that
// takes a context takes it as an argument; this is only how the host gets one.
let current: GameContext | null = null;

export function startGame(options: GameContextOptions): GameContext {
  current?.destroy();
  current = new GameContext(options);
  return current;
}

/** The running session, or null before one has been started. */
export function gameContext(): GameContext | null {
  return current;
}

/** Ends the session and forgets it. The save is the caller's business. */
export function endGame(): void {
  current?.destroy();
  current = null;
}

/**
 * Saves on the way out of the page. `pagehide` is the one that fires on iOS,
 * where a backgrounded tab may never see `beforeunload` at all; both are
 * registered because neither alone covers every browser.
 */
export function bindUnloadPersist(context: GameContext, target: Window): () => void {
  const persist = (): void => context.persist();
  target.addEventListener('pagehide', persist);
  target.addEventListener('beforeunload', persist);
  return () => {
    target.removeEventListener('pagehide', persist);
    target.removeEventListener('beforeunload', persist);
  };
}

/** Clears the save and ends the session — the reset the options panel offers. */
export function resetGame(): void {
  saveService.clear();
  endGame();
}
