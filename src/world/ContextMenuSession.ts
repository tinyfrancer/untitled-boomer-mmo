import { SKILLS } from '../data/skills';
import { conColor, enemyDisplayName } from '../systems/EnemySystem';
import {
  describeEnemy,
  describeEnemyLoot,
  describeNode,
  describeNpc,
  describeSignpost,
} from '../systems/InspectSystem';
import type { ContextAction, ContextActionId, ContextSubject } from '../ui/uiEvents';
import type { Mob } from './Mob';
import type { ResourceNode } from './ResourceNode';
import type { WorldContext } from './WorldContext';
import type { WorldTap } from './ZoneWorld';
import type { WorldNpc, WorldSignpost } from './zoneEntities';

/** Everything a context menu can be about: a tap's subject, less the ground. */
type Subject = Exclude<WorldTap, { kind: 'ground' }>;

/** Which world action each kind of subject offers. One each, so far. */
const SUBJECT_ACTIONS = {
  mob: 'attack',
  node: 'gather',
  signpost: 'travel',
  npc: 'shop',
} as const satisfies Record<Subject['kind'], ContextActionId>;

export interface ContextMenuDeps {
  /**
   * Do to this what a tap on it would have done.
   *
   * One hook rather than four, and deliberately the *same* one a tap goes
   * through: Attack means what tapping a rat means, down to giving up the
   * gather it interrupts and the camp it ends. A menu is a slower way of saying
   * the same thing, not a second set of rules about attacking and gathering.
   */
  perform: (subject: Subject) => void;
}

/**
 * The long press, and the right click: what is under the pointer, what may be
 * done with it, and the doing of whichever line was chosen.
 *
 * It owns the one piece of state a menu needs and the HUD must not hold — which
 * rat this is. A panel that named the creature itself would be a live reference
 * to a simulated thing sitting in an HTML overlay, outliving the zone it
 * belonged to; the id of an action is all that has to come back, and this
 * resolves it against a subject only the world can still vouch for.
 *
 * Everything a menu *shows* is settled at the moment it opens, out of the data
 * tables (`systems/InspectSystem`), so a card left up while its rat wanders off
 * is not describing a stale rat — it is describing rats.
 */
export class ContextMenuSession {
  private readonly ctx: WorldContext;
  private readonly deps: ContextMenuDeps;
  private subject: Subject | null = null;

  constructor(ctx: WorldContext, deps: ContextMenuDeps) {
    this.ctx = ctx;
    this.deps = deps;
  }

  /**
   * What was pressed, described. `null` for the ground: there is nothing there
   * to ask about, and a menu offering "walk here" for the gesture that is
   * already how you walk somewhere would be a line nobody reads.
   */
  open(target: WorldTap): ContextSubject | null {
    if (target.kind === 'ground') {
      this.subject = null;
      return null;
    }
    this.subject = target;

    switch (target.kind) {
      case 'mob':
        return this.mobMenu(target.mob);
      case 'node':
        return this.nodeMenu(target.node);
      case 'signpost':
        return this.signpostMenu(target.signpost);
      case 'npc':
        return this.npcMenu(target.npc);
    }
  }

  /**
   * The player chose a line. One menu is worth one action, so the subject is
   * spent either way — including when the answer is to do nothing, which is
   * what an action naming something other than what is actually under the
   * pointer gets, and what a rat killed while the menu sat open gets.
   */
  run(actionId: ContextActionId): void {
    const subject = this.subject;
    this.subject = null;
    if (!subject || SUBJECT_ACTIONS[subject.kind] !== actionId) return;
    // The corpse case: a mob may die between the menu opening and a line being
    // chosen, and a walk to attack one would end standing over it.
    if (subject.kind === 'mob' && !subject.mob.isAlive()) return;
    this.deps.perform(subject);
  }

  /** Forgets what was pressed: a death, a zone walk, a teardown. */
  clear(): void {
    this.subject = null;
  }

  private mobMenu(mob: Mob): ContextSubject {
    return {
      title: enemyDisplayName(mob.definition, mob.level),
      titleColor: conColor(this.ctx.character.state.level, mob.level),
      actions: [action('attack', 'Attack')],
      details: describeEnemy(mob.definition, mob.level),
      loot: describeEnemyLoot(mob.definition),
    };
  }

  private nodeMenu(node: ResourceNode): ContextSubject {
    // The skill's own verb rather than a second table of them: "Chop wood" is
    // what the line that announces a gather already says.
    const verb = SKILLS[node.definition.skill].verb;
    return {
      title: node.name,
      actions: [action('gather', verb.charAt(0).toUpperCase() + verb.slice(1))],
      details: describeNode(node.definition),
    };
  }

  private signpostMenu(signpost: WorldSignpost): ContextSubject {
    return {
      title: `${signpost.label} Signpost`,
      actions: [action('travel', `Travel to ${signpost.label}`)],
      details: describeSignpost(signpost.exit),
    };
  }

  private npcMenu(npc: WorldNpc): ContextSubject {
    return {
      title: describeNpc(npc.npcId).title,
      actions: [action('shop', 'Shop')],
      details: describeNpc(npc.npcId),
    };
  }
}

function action(id: ContextActionId, label: string): ContextAction {
  return { id, label };
}
