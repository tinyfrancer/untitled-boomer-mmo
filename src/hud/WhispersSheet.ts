import { Sheet } from './Sheet';
import { el, emptyLine, sectionHeader } from './dom';
import { npcNameAndTrade } from '../data/npcs';
import {
  whispersJournal,
  type FollowedReader,
  type WhispersState,
} from '../systems/WhispersSystem';
import { THEME } from '../ui/theme';

/**
 * The Whispers journal (D2, decision 132): the rumours heard, each with who
 * told it and whether it has been followed, and the lore found, each a piece
 * of the history; newest first, under counts of how many there are.
 *
 * A rumour never names where it leads before it is followed: the line says as
 * much as its teller did, and the walk is the player's.
 */
export class WhispersSheet extends Sheet {
  constructor() {
    super('Whispers', THEME.panelWidth.whispers);
  }

  update(whispers: WhispersState, reader: FollowedReader): void {
    const journal = whispersJournal(whispers, reader);
    this.body.replaceChildren(
      sectionHeader(
        'Rumours',
        `${journal.rumours.length} / ${journal.rumoursTotal} heard, ${journal.rumoursFollowed} followed`,
      ),
    );
    if (journal.rumours.length === 0) {
      this.body.append(emptyLine('Nothing worth keeping yet. People talk, if you ask them.'));
    }
    for (const { rumour, followed } of journal.rumours) {
      const entry = el('div', 'hud-whisper');
      entry.dataset.rumour = rumour.id;
      entry.classList.toggle('is-followed', followed);
      entry.append(
        el('div', 'hud-whisper__text', `“${rumour.line}”`),
        el(
          'div',
          'hud-whisper__by',
          `${npcNameAndTrade(rumour.teller)} · ${followed ? 'Followed' : 'Not yet followed'}`,
        ),
      );
      this.body.append(entry);
    }

    this.body.append(
      sectionHeader('Lore', `${journal.fragments.length} / ${journal.fragmentsTotal} found`),
    );
    if (journal.fragments.length === 0) {
      this.body.append(emptyLine('Nothing of the old days yet. It turns up where nobody looks.'));
    }
    for (const fragment of journal.fragments) {
      const entry = el('div', 'hud-whisper');
      entry.dataset.fragment = fragment.id;
      entry.append(
        el('div', 'hud-whisper__title', fragment.title),
        el('div', 'hud-whisper__text', fragment.text),
      );
      this.body.append(entry);
    }
  }
}
