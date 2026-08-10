import { describeItemName } from '../data/items';
import { SKILLS } from '../data/skills';
import { titleName } from '../systems/AchievementSystem';
import {
  logAbsorbed,
  logAchievement,
  logCoin,
  logDamageDealt,
  logDamageTaken,
  logDefense,
  logKill,
  logLoot,
  logNotice,
  logTitleEarned,
} from '../systems/CombatLogSystem';
import { isCooldownReady, isInRange, resolveAttack, rollDefense } from '../systems/CombatSystem';
import { formatCurrency } from '../systems/CurrencySystem';
import { rollLootTable } from '../systems/LootSystem';
import { distance } from '../systems/MovementSystem';
import type { EnemyId, LootTableId } from '../types/ids';
import {
  ACHIEVEMENT_UNLOCKED_EVENT,
  KILLS_CHANGED_EVENT,
  TITLE_CHANGED_EVENT,
  type AchievementUnlock,
} from '../ui/uiEvents';
import type { Mob } from './Mob';
import type { Targeting } from './targeting';
import type { WorldContext } from './WorldContext';

// Combat skills are earned a rep at a time — one landed swing, one hit turned
// aside — rather than in the lumps a gather or a kill pays out.
const WEAPON_SKILL_XP_PER_HIT = 1;
const DEFENSE_SKILL_XP_PER_SAVE = 1;

/** What the fight needs from the rest of the zone, and the whole of it. */
export interface CombatDirectorDeps {
  mobs: Mob[];
  targeting: Targeting;
  /** The choke point the camp's XP penalty is applied at. */
  awardXp(reward: number): void;
  /** Being hit breaks a gather channel, whoever was swinging. */
  interruptGather(): void;
  /**
   * Being *hurt* breaks a cast, which is not the same thing.
   *
   * A hit the mana shield eats leaves the cast standing, and that is the second
   * thing the shield is for: without it a caster in melee could never finish a
   * spell, and with it standing your ground is a decision rather than a mistake.
   */
  interruptCast(): void;
  /**
   * Dying stops everything else the session was doing and may hand the player
   * to another zone, so the world takes it from here.
   */
  onPlayerDeath(): void;
}

/**
 * Both directions of a fight, and everything a corpse is worth.
 *
 * The damage rolls themselves are not here — `CombatSystem` owns those, and is
 * pure. What this owns is the cadence: who is in range of whom, whose cooldown
 * has run out, and what happens on the swing that lands last.
 */
export class CombatDirector {
  private readonly ctx: WorldContext;
  private readonly deps: CombatDirectorDeps;
  // The world's clock starts at zero, so "never swung" is -Infinity rather than 0.
  private lastAttackAt = -Infinity;

  constructor(ctx: WorldContext, deps: CombatDirectorDeps) {
    this.ctx = ctx;
    this.deps = deps;
  }

  update(): void {
    this.updatePlayerAttacks();
    this.updateEnemyAttacks();
  }

  /**
   * Everything a corpse is worth, for a mob that has already died this frame.
   * Both the swing path and the ability path end here so a new reward can only
   * ever be added once — the two used to carry their own copy of this, which is
   * how a reward gets wired into melee and silently missed on spellcasting.
   * Safe to read the mob after death: its reward fields are readonly and set in
   * the constructor, so dying does not clear them.
   */
  resolveKill(mob: Mob): void {
    this.ctx.push({ kind: 'death', on: 'mob', mob });
    this.ctx.log(logKill(mob.name));
    this.deps.awardXp(mob.xpReward);
    this.grantLoot(mob.lootTableId);
    this.announceUnlocks(this.creditKill(mob.definition.id));
  }

  /**
   * Credits kills to the slayer chains and reports what they completed. Does
   * not announce anything itself: a live kill can emit, but an offline camp
   * settles up before the HUD is listening, so the caller decides how the news
   * travels.
   */
  creditKill(enemyId: EnemyId, count = 1): AchievementUnlock[] {
    const { character } = this.ctx;
    const worn = character.state.activeTitleId;
    const crossed = character.recordKill(enemyId, count);
    this.ctx.events.emit(KILLS_CHANGED_EVENT, character.state.kills);
    if (crossed.length > 0) {
      this.ctx.persistCharacter();
    }
    return crossed.map((definition) => ({
      achievementId: definition.id,
      name: definition.name,
      titleId: definition.titleId,
      titleWorn:
        definition.titleId !== undefined &&
        worn === null &&
        character.state.activeTitleId === definition.titleId,
    }));
  }

  announceUnlocks(unlocks: AchievementUnlock[]): void {
    for (const unlock of unlocks) {
      this.ctx.log(logAchievement(unlock.name));
      this.ctx.float(unlock.name, 'skill', 60);
      this.ctx.events.emit(ACHIEVEMENT_UNLOCKED_EVENT, unlock);
      if (unlock.titleWorn && unlock.titleId) {
        this.ctx.log(logTitleEarned(titleName(unlock.titleId)));
        this.ctx.events.emit(TITLE_CHANGED_EVENT, unlock.titleId);
      }
    }
  }

  private updatePlayerAttacks(): void {
    const { player, character } = this.ctx;
    const target = this.deps.targeting.target;
    if (!target || !target.isAlive()) return;
    if (!isInRange(distance(player, target), player.attackRange)) return;
    if (!isCooldownReady(this.ctx.now - this.lastAttackAt, player.effectiveAttackCooldownMs())) {
      return;
    }

    this.lastAttackAt = this.ctx.now;
    const weaponSkill = character.activeWeaponSkill();
    const { damage } = resolveAttack({
      attackPower: player.attackPower,
      weaponSkillLevel: character.skillLevelOf(weaponSkill),
    });
    this.ctx.push({
      kind: 'hit',
      on: 'mob',
      via: 'weapon',
      at: { x: target.x, y: target.y },
      damage,
      absorbed: 0,
    });
    this.ctx.log(logDamageDealt(target.name, damage));
    player.markInCombat();
    target.takeDamage(damage);
    // Anything the player hits fights back, whether or not it opens combat itself.
    target.engage();
    this.deps.targeting.publishTarget();
    // Skill comes from swinging, not from killing: a landed hit is the rep.
    this.ctx.awardSkillXp(weaponSkill, WEAPON_SKILL_XP_PER_HIT, { silent: true });
    if (!target.isAlive()) {
      this.resolveKill(target);
    }
  }

  private updateEnemyAttacks(): void {
    const { player, character } = this.ctx;
    if (!player.isAlive()) return;

    for (const mob of this.deps.mobs) {
      if (!mob.isEngaged()) continue;

      if (!isInRange(distance(mob, player), mob.attackRange)) continue;
      if (!isCooldownReady(this.ctx.now - mob.lastAttackAt, mob.attackCooldownMs)) continue;

      mob.lastAttackAt = this.ctx.now;

      // A turned-aside hit trains the skill that turned it aside and stops
      // there — no damage, and nothing to interrupt a gather.
      const defense = rollDefense({
        blockLevel: character.skillLevelOf('block'),
        parryLevel: character.skillLevelOf('parry'),
        hasWeapon: character.state.gear.weapon !== null,
      });
      if (defense.avoided && defense.skillId) {
        this.ctx.push({
          kind: 'defend',
          at: this.ctx.playerPoint(),
          skillName: SKILLS[defense.skillId].name,
        });
        this.ctx.log(logDefense(SKILLS[defense.skillId].name, mob.name));
        this.ctx.awardSkillXp(defense.skillId, DEFENSE_SKILL_XP_PER_SAVE, { silent: true });
        continue;
      }

      const { damage } = resolveAttack({ attackPower: mob.attackPower });
      const absorbed = player.takeDamage(damage);
      this.ctx.push({
        kind: 'hit',
        on: 'player',
        via: 'weapon',
        at: this.ctx.playerPoint(),
        damage,
        absorbed,
      });
      if (absorbed > 0) {
        this.ctx.log(logAbsorbed(absorbed));
      }
      if (damage > absorbed) {
        this.ctx.log(logDamageTaken(mob.name, damage - absorbed));
        this.deps.interruptCast();
      }
      this.deps.interruptGather();

      if (!player.isAlive()) {
        this.deps.onPlayerDeath();
        return;
      }
    }
  }

  private grantLoot(lootTableId?: LootTableId): void {
    if (!lootTableId) return;
    const { character } = this.ctx;
    const { drops, copper } = rollLootTable(lootTableId);

    let took = false;
    drops.forEach((drop) => {
      const name = describeItemName(drop.itemId);
      // A full pack leaves the drop on the corpse rather than silently eating
      // it: the log line is the only way the player would ever know.
      if (!character.tryAddItem(drop.itemId, drop.quantity)) {
        this.ctx.log(logNotice(`Your pack is too full to carry ${name}.`));
        return;
      }
      this.ctx.log(logLoot(name, drop.quantity));
      took = true;
    });
    if (took) {
      this.ctx.publishInventory();
    }
    if (copper > 0) {
      character.addCurrency(copper);
      this.ctx.log(logCoin(copper));
      this.ctx.float(`+${formatCurrency(copper)}`, 'reward', 40);
      this.ctx.publishCurrency();
    }
  }
}
