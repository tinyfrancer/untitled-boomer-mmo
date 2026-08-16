import { THEME } from '../ui/theme';
import { formatCurrency } from './CurrencySystem';

export interface CombatLogEntry {
  text: string;
  color: string;
}

// How many lines the log keeps. Old lines are dropped rather than kept and
// scrolled to: this is a running commentary on the current fight, not a record.
export const COMBAT_LOG_LIMIT = 50;

/**
 * Appends a line, dropping the oldest once the log is full. Returns a new array
 * — the log is rendered off it, so mutating in place would hide changes.
 */
export function appendLogEntry(
  log: CombatLogEntry[],
  entry: CombatLogEntry,
  limit = COMBAT_LOG_LIMIT,
): CombatLogEntry[] {
  const next = [...log, entry];
  return next.length > limit ? next.slice(next.length - limit) : next;
}

/** The most recent `count` lines, oldest first — what a fixed-height log shows. */
export function recentEntries(log: CombatLogEntry[], count: number): CombatLogEntry[] {
  return count >= log.length ? log : log.slice(log.length - count);
}

export function logDamageDealt(targetName: string, damage: number): CombatLogEntry {
  return { text: `You hit ${targetName} for ${damage}.`, color: THEME.color.text };
}

export function logCriticalHit(targetName: string, damage: number): CombatLogEntry {
  return { text: `You hit ${targetName} hard for ${damage}!`, color: THEME.color.equippable };
}

export function logEnemyAvoided(targetName: string): CombatLogEntry {
  return { text: `${targetName} slips your attack.`, color: THEME.color.dim };
}

export function logDamageTaken(sourceName: string, damage: number): CombatLogEntry {
  return { text: `${sourceName} hits you for ${damage}.`, color: THEME.color.playerDamage };
}

export function logAbsorbed(amount: number): CombatLogEntry {
  return { text: `Your shield absorbs ${amount}.`, color: THEME.color.skillUp };
}

export function logDefense(skillName: string, sourceName: string): CombatLogEntry {
  return {
    text: `You ${skillName.toLowerCase()} ${sourceName}'s attack.`,
    color: THEME.color.heal,
  };
}

export function logKill(targetName: string): CombatLogEntry {
  return { text: `You have slain ${targetName}!`, color: THEME.color.levelUp };
}

export function logAbilityUsed(abilityName: string): CombatLogEntry {
  return { text: `You cast ${abilityName}.`, color: THEME.color.muted };
}

export function logEnemyWindUp(sourceName: string, abilityName: string): CombatLogEntry {
  return { text: `${sourceName} winds up ${abilityName}!`, color: THEME.color.playerDamage };
}

export function logEnemyAbilityDodged(abilityName: string): CombatLogEntry {
  return { text: `You step out of ${abilityName}.`, color: THEME.color.heal };
}

export function logCastStarted(abilityName: string): CombatLogEntry {
  return { text: `You begin casting ${abilityName}.`, color: THEME.color.muted };
}

export function logCastInterrupted(abilityName: string): CombatLogEntry {
  return { text: `Your ${abilityName} is interrupted.`, color: THEME.color.playerDamage };
}

export function logSpellFailed(abilityName: string): CombatLogEntry {
  return { text: `Your ${abilityName} fizzles.`, color: THEME.color.dim };
}

// Says what was restored rather than what was asked for, so healing at full
// reads as the wasted cooldown it is instead of as 30 points that went nowhere.
export function logHealed(abilityName: string, amount: number): CombatLogEntry {
  return { text: `${abilityName} restores ${amount} health.`, color: THEME.color.heal };
}

export function logXpGain(amount: number): CombatLogEntry {
  return { text: `You gain ${amount} experience.`, color: THEME.color.levelUp };
}

export function logLevelUp(level: number): CombatLogEntry {
  return { text: `You are now level ${level}!`, color: THEME.color.levelUp };
}

export function logSkillLevelUp(skillName: string, level: number): CombatLogEntry {
  return { text: `${skillName} is now level ${level}.`, color: THEME.color.skillUp };
}

export function logLoot(itemName: string, quantity: number): CombatLogEntry {
  const suffix = quantity > 1 ? ` (${quantity})` : '';
  return { text: `You receive ${itemName}${suffix}.`, color: THEME.color.equippable };
}

export function logCoin(copper: number): CombatLogEntry {
  return { text: `You receive ${formatCurrency(copper)}.`, color: THEME.color.equippable };
}

export function logQuestAccepted(questName: string): CombatLogEntry {
  return { text: `Quest accepted: ${questName}.`, color: THEME.color.skillUp };
}

export function logQuestCompleted(questName: string): CombatLogEntry {
  return { text: `Quest complete: ${questName}!`, color: THEME.color.levelUp };
}

// Named "contract" rather than "quest" throughout, so the log reads as two
// kinds of work rather than as one kind said twice — the board's lines and the
// shopkeeper's are otherwise indistinguishable a hundred lines later.
export function logBountyAccepted(bountyName: string): CombatLogEntry {
  return { text: `Contract taken: ${bountyName}.`, color: THEME.color.skillUp };
}

export function logBountyCompleted(bountyName: string): CombatLogEntry {
  return { text: `Contract paid: ${bountyName}!`, color: THEME.color.levelUp };
}

export function logBountyAbandoned(bountyName: string): CombatLogEntry {
  return { text: `Contract given back: ${bountyName}.`, color: THEME.color.dim };
}

export function logAchievement(achievementName: string): CombatLogEntry {
  return { text: `Achievement earned: ${achievementName}!`, color: THEME.color.levelUp };
}

export function logTitleEarned(titleName: string): CombatLogEntry {
  return { text: `You are now known as ${titleName}.`, color: THEME.color.levelUp };
}

export function logDeathToll(copper: number): CombatLogEntry {
  return { text: `Recovering costs you ${formatCurrency(copper)}.`, color: THEME.color.dim };
}

export function logNotice(message: string): CombatLogEntry {
  return { text: message, color: THEME.color.muted };
}
