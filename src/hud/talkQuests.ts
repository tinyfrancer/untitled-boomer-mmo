import { el, row, sectionHeader } from './dom';
import {
  questsForNpc,
  type QuestCounters,
  type QuestLog,
  type QuestOffer,
} from '../systems/QuestSystem';
import { THEME } from '../ui/theme';
import type { NpcId, QuestId } from '../types/ids';

/** What a giver's rows are drawn from: the log, and the three tallies it counts off. */
export interface QuestPanelState extends QuestCounters {
  quests: QuestLog;
}

export interface QuestHandlers {
  onAccept: (questId: QuestId) => void;
  onTurnIn: (questId: QuestId) => void;
}

/**
 * The work a person has going, drawn in the conversation with them — or
 * nothing, for somebody who gives none.
 *
 * It belongs to the conversation rather than to any counter because a quest is
 * a conversation with the person who gives it. It was a section of the shop's
 * panel while the shopkeeper was the only giver, then something the host put at
 * the top of every counter once a second giver stood behind a different one;
 * the talk panel is what every person has, so a person who starts giving quests
 * shows them without any counter being told.
 */
export function talkQuests(
  npcId: NpcId,
  state: QuestPanelState,
  handlers: QuestHandlers,
): HTMLElement | null {
  const offers = questsForNpc(npcId, state.quests, state).filter((offer) => offer.state !== 'done');
  if (offers.length === 0) return null;

  const section = el('div', 'hud-talk__quests');
  section.dataset.giver = npcId;
  section.append(sectionHeader('Work going'));
  for (const offer of offers) {
    section.append(questRow(offer, handlers));
  }
  return section;
}

/**
 * A quest row says what it wants and how far along it is, so the player never
 * has to open a second panel to decide whether it is worth walking back here.
 *
 * One still behind its chain is drawn rather than left out, carrying the quest
 * it is waiting on where its progress would sit — the same call the shelf
 * makes for a gated row and the world map for a shut zone. What is not offered
 * yet is the reason to come back, and hiding it says nothing at all.
 */
function questRow(offer: QuestOffer, handlers: QuestHandlers): HTMLElement {
  const { definition, state, progress, requirement } = offer;
  const ready = state === 'ready';
  const actionable = ready || state === 'available';
  const entry = row({
    className: 'hud-list-row',
    label: definition.name,
    value:
      state === 'locked'
        ? (requirement ?? '')
        : state === 'available'
          ? 'Accept'
          : ready
            ? 'Hand in'
            : `${progress.have} / ${progress.need}`,
    valueClass: 'hud-list-row__value',
    onClick: () => {
      if (state === 'available') {
        handlers.onAccept(definition.id);
      } else if (ready) {
        handlers.onTurnIn(definition.id);
      }
    },
  });
  entry.root.dataset.quest = definition.id;
  entry.label.style.color = actionable ? THEME.color.levelUp : THEME.color.muted;
  entry.value.style.color = actionable ? THEME.color.levelUp : THEME.color.dim;
  if (state === 'locked') {
    entry.root.dataset.locked = definition.id;
  }
  return entry.root;
}
