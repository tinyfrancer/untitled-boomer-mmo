import { TILE_SIZE } from '../config/constants';
import { isInside } from '../data/buildings';
import { SECRET_REACH, SECRETS } from '../data/secrets';
import { logCoin, logLoot, logSecretFound } from '../systems/CombatLogSystem';
import { describeItemName } from '../data/items';
import type { LootDrop } from '../systems/LootSystem';
import { fragmentsFoundAt } from '../systems/WhispersSystem';
import type { Point } from '../systems/MovementSystem';
import { SECRET_FOUND_EVENT } from '../ui/uiEvents';
import type { WorldContext } from './WorldContext';
import type { WorldSecret } from './zoneEntities';

// Further than any frame walks, even a cheap phone's: a move this long is a
// jump (a respawn, a teleport), and only where it landed was ever stood on.
const LONGEST_STRIDE = TILE_SIZE * 2;

/** What the finder needs from the rest of the zone, and the whole of it. */
export interface SecretFinderDeps {
  secrets: readonly WorldSecret[];
  /** Where a cache the pack could not take is left, as a kill's is. */
  leavePile: (at: Point, drops: LootDrop[]) => void;
  /** Wick says what it is, unasked: a find is the reward, not advice. */
  voice: () => void;
}

/**
 * The zone's secrets, found by walking up to them (decision 117).
 *
 * Measured along the stretch the body walked this frame rather than at where it
 * stopped, so a phone stepping forty pixels a frame finds one it walked past as
 * surely as one it walked up to — the rule every fixed distance here keeps.
 */
export class SecretFinder {
  private readonly ctx: WorldContext;
  private readonly deps: SecretFinderDeps;
  private last: Point | null = null;

  constructor(ctx: WorldContext, deps: SecretFinderDeps) {
    this.ctx = ctx;
    this.deps = deps;
  }

  update(): void {
    const { player, character } = this.ctx;
    const here = { x: player.x, y: player.y };
    const from = this.last && walked(this.last, here) ? this.last : here;
    this.last = here;
    for (const secret of this.deps.secrets) {
      if (character.state.secrets.includes(secret.secretId)) continue;
      const nearest = nearestOnStretch(secret, from, here);
      if (Math.hypot(secret.x - nearest.x, secret.y - nearest.y) > SECRET_REACH) continue;
      if (secret.room && !isInside(secret.room, nearest)) continue;
      this.find(secret);
    }
  }

  private find(secret: WorldSecret): void {
    const { character } = this.ctx;
    if (!character.markSecretFound(secret.secretId)) return;
    const { name, cache } = SECRETS[secret.secretId];
    this.ctx.log(logSecretFound(name));
    character.addCurrency(cache.copper);
    this.ctx.log(logCoin(cache.copper));
    const left: LootDrop[] = [];
    for (const { itemId, quantity } of cache.items) {
      if (character.tryAddItem(itemId, quantity)) {
        this.ctx.log(logLoot(describeItemName(itemId), quantity));
      } else {
        left.push({ itemId, quantity });
      }
    }
    if (left.length > 0) this.deps.leavePile({ x: secret.x, y: secret.y }, left);
    this.ctx.publishInventory();
    this.ctx.publishCurrency();
    this.ctx.events.emit(SECRET_FOUND_EVENT, secret.secretId);
    for (const fragmentId of fragmentsFoundAt({ kind: 'secret', secretId: secret.secretId })) {
      this.ctx.noteWhisper({ kind: 'lore', fragmentId });
    }
    this.deps.voice();
    this.ctx.persistCharacter();
  }
}

function walked(from: Point, to: Point): boolean {
  return Math.hypot(to.x - from.x, to.y - from.y) <= LONGEST_STRIDE;
}

/** Where on the stretch from `a` to `b` comes nearest a point. */
function nearestOnStretch(point: Point, a: Point, b: Point): Point {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = dx * dx + dy * dy;
  const t = length === 0 ? 0 : ((point.x - a.x) * dx + (point.y - a.y) * dy) / length;
  const along = Math.max(0, Math.min(1, t));
  return { x: a.x + dx * along, y: a.y + dy * along };
}
