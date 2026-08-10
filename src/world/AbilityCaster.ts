import type { AbilityDefinition } from '../data/abilities';
import {
  abilitiesFor,
  abilityById,
  canUseAbility,
  resolveAbilityDamage,
  rollSpellFailure,
  startHaste,
  startManaShield,
} from '../systems/AbilitySystem';
import {
  logAbilityUsed,
  logCastInterrupted,
  logCastStarted,
  logDamageDealt,
  logSpellFailed,
} from '../systems/CombatLogSystem';
import { distance } from '../systems/MovementSystem';
import type { AbilityId } from '../types/ids';
import {
  CHANNEL_ENDED_EVENT,
  CHANNEL_PROGRESS_EVENT,
  CHANNEL_STARTED_EVENT,
  type AbilityState,
} from '../ui/uiEvents';
import type { Mob } from './Mob';
import type { Targeting } from './targeting';
import type { WorldContext } from './WorldContext';

// A cast is worth more than a swing: abilities sit behind long cooldowns, so
// paying a swing's rate would make Destruction unlevellable.
const ABILITY_SKILL_XP_PER_CAST = 3;

/** What the caster needs from the rest of the zone, and the whole of it. */
export interface AbilityCasterDeps {
  targeting: Targeting;
  /** Casting is a choice to stop chopping, the same way swinging is. */
  stopGathering(): void;
  /** The one funnel every reward for a corpse goes through. */
  resolveKill(mob: Mob): void;
  /** The bar's sweep starts the moment a cooldown does, not on the next frame. */
  publishAbilityState(): void;
}

/** A spell part-way through, which is the only thing here that spans frames. */
interface Cast {
  ability: AbilityDefinition;
  elapsedMs: number;
  skillLevel: number;
}

/**
 * The action bar's other half: whether a button may be pressed, and what
 * happens when it is.
 *
 * The world owns this decision rather than the HUD because range and what is
 * selected are the world's to know — the HUD asks and renders whatever comes
 * back. A caster's reach is the spell rather than the class, which is why
 * nothing here consults the weapon.
 *
 * **A spell with a cast time is committed at the press and resolved later.**
 * Mana and cooldown are spent the moment the button goes down, so an interrupted
 * cast costs everything and does nothing — the same bargain the fizzle already
 * makes, and what gives standing still its weight. What is rolled at the *end*
 * is whether it fizzles and whether the target is still there to hit, because
 * both are questions about the moment it lands rather than the moment it began.
 */
export class AbilityCaster {
  /** When each ability was last cast, for the cooldown check and the bar's sweep. */
  readonly lastCastAt = new Map<AbilityId, number>();

  private readonly ctx: WorldContext;
  private readonly deps: AbilityCasterDeps;
  private casting: Cast | null = null;

  constructor(ctx: WorldContext, deps: AbilityCasterDeps) {
    this.ctx = ctx;
    this.deps = deps;
  }

  cast(abilityId: AbilityId): void {
    const { player } = this.ctx;
    if (!player.isAlive()) return;
    const ability = abilityById(abilityId);
    if (ability.classId !== this.ctx.character.state.classId) return;

    const { target } = this.deps.targeting;
    const check = canUseAbility(ability, {
      mana: player.mana,
      elapsedMs: this.elapsedSince(abilityId),
      hasTarget: target !== null && target.isAlive(),
      targetDistance: target ? distance(player, target) : Infinity,
      moving: player.isMoving() || player.hasMoveTarget(),
      casting: this.casting !== null,
    });
    if (!check.ok) {
      this.ctx.notice(check.reason);
      return;
    }

    if (!player.spendMana(ability.manaCost)) return;
    this.lastCastAt.set(abilityId, this.ctx.now);
    this.deps.stopGathering();
    player.markInCombat();
    this.deps.publishAbilityState();

    const skillLevel = ability.skill ? this.ctx.character.skillLevelOf(ability.skill) : 0;
    if (ability.castTimeMs > 0) {
      this.casting = { ability, elapsedMs: 0, skillLevel };
      this.ctx.log(logCastStarted(ability.name));
      this.ctx.events.emit(CHANNEL_STARTED_EVENT, ability.name);
      this.ctx.events.emit(CHANNEL_PROGRESS_EVENT, 0);
      return;
    }
    this.resolve(ability, skillLevel);
  }

  /**
   * Runs a cast's clock, and breaks it if the caster moved.
   *
   * Movement is read off the player rather than pushed in, so every way there is
   * to move — a key, a tap, a walk already under way — breaks a cast without any
   * of them knowing a cast exists.
   */
  update(deltaMs: number): void {
    const cast = this.casting;
    if (!cast) return;
    if (!this.ctx.player.isAlive()) {
      this.clearCast();
      return;
    }
    if (this.ctx.player.isMoving() || this.ctx.player.hasMoveTarget()) {
      this.interrupt();
      return;
    }

    cast.elapsedMs += Math.max(0, deltaMs);
    if (cast.elapsedMs < cast.ability.castTimeMs) {
      this.ctx.events.emit(CHANNEL_PROGRESS_EVENT, cast.elapsedMs / cast.ability.castTimeMs);
      return;
    }
    this.clearCast();
    this.resolve(cast.ability, cast.skillLevel);
  }

  /**
   * Breaks whatever is being cast. The mana and the cooldown are already gone —
   * that is what makes an interrupt worth avoiding rather than an inconvenience.
   */
  interrupt(): void {
    const cast = this.casting;
    if (!cast) return;
    this.clearCast();
    this.ctx.float('Interrupted!', 'player-damage');
    this.ctx.log(logCastInterrupted(cast.ability.name));
  }

  /** Whether something is part-way through, for the world's own decisions. */
  isCasting(): boolean {
    return this.casting !== null;
  }

  private clearCast(): void {
    this.casting = null;
    this.ctx.events.emit(CHANNEL_ENDED_EVENT);
  }

  // Everything that happens the moment a spell goes off, whether it waited or
  // not. A spell that fizzles still costs the mana and the cooldown; that is
  // what makes Destruction worth levelling.
  private resolve(ability: AbilityDefinition, skillLevel: number): void {
    this.ctx.log(logAbilityUsed(ability.name));
    if (ability.skill && rollSpellFailure(ability, skillLevel)) {
      this.ctx.float('Fizzle!', 'dim');
      this.ctx.log(logSpellFailed(ability.name));
      this.ctx.awardSkillXp(ability.skill, ABILITY_SKILL_XP_PER_CAST, { silent: true });
      return;
    }

    this.applyEffect(ability, skillLevel);
    if (ability.skill) {
      this.ctx.awardSkillXp(ability.skill, ABILITY_SKILL_XP_PER_CAST, { silent: true });
    }
  }

  /** What the action bar draws, for the class the player chose. */
  states(): AbilityState[] {
    return abilitiesFor(this.ctx.character.state.classId).map((ability) => {
      const cooldownRemaining = Math.min(
        1,
        Math.max(0, (ability.cooldownMs - this.elapsedSince(ability.id)) / ability.cooldownMs),
      );
      return {
        abilityId: ability.id,
        cooldownRemaining,
        usable: cooldownRemaining === 0 && this.ctx.player.mana >= ability.manaCost,
      };
    });
  }

  // -Infinity rather than 0 for "never cast": the world's clock starts at zero,
  // so a zone's first frame would otherwise read as a cast on its first.
  private elapsedSince(abilityId: AbilityId): number {
    return this.ctx.now - (this.lastCastAt.get(abilityId) ?? -Infinity);
  }

  private applyEffect(ability: AbilityDefinition, skillLevel: number): void {
    const { player } = this.ctx;
    switch (ability.effect.kind) {
      case 'damage': {
        const target = this.deps.targeting.target;
        if (!target?.isAlive()) return;
        // Asked again here rather than only at the press: a cast takes over a
        // second, and a mob that leashed home during it is out of reach of a
        // spell that was in range when it started.
        if (distance(player, target) > ability.range) {
          this.ctx.notice('Your target is too far away.');
          return;
        }
        const damage = resolveAbilityDamage(ability, player.attackPower, skillLevel);
        // A bolt thrown from the caster to the target. Purely cosmetic, but a
        // ranged nuke that produced only a number over the mob read as nothing
        // happening. A melee ability has no flight to draw.
        if (ability.range > 0) {
          this.ctx.push({
            kind: 'bolt-cast',
            abilityId: ability.id,
            from: this.ctx.playerPoint(),
            to: { x: target.x, y: target.y },
          });
        }
        this.ctx.push({
          kind: 'hit',
          on: 'mob',
          via: 'ability',
          at: { x: target.x, y: target.y },
          damage,
          absorbed: 0,
        });
        this.ctx.log(logDamageDealt(target.name, damage));
        target.takeDamage(damage);
        target.engage();
        this.deps.targeting.publishTarget();
        if (!target.isAlive()) {
          this.deps.resolveKill(target);
        }
        return;
      }
      case 'absorb': {
        const shield = startManaShield(ability);
        if (shield) player.applyManaShield(shield);
        this.ctx.float(ability.name, 'skill');
        return;
      }
      case 'haste': {
        const haste = startHaste(ability);
        if (haste) player.applyHaste(haste);
        this.ctx.float(ability.name, 'reward');
        return;
      }
    }
  }
}
