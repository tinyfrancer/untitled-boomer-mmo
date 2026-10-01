import { exhaustive } from '../types/exhaustive';
import type { EnemyId, SpiritBeatId, ZoneId } from '../types/ids';

/**
 * What Wick remembers, and where (`docs/lore/spirit.md`'s table, D4).
 *
 * A beat is a line said once per character, the first time the moment it is
 * keyed to has come and the character is standing where it happened: arriving
 * in a zone, or putting down the boss that knew Wick. Its waking comes first,
 * wherever the character is, and says on its own what every later line waits
 * for: a tap on the light. The rest wait for that tap, Wick glowing and chiming
 * until it is asked (the user's answer, D4).
 *
 * The secrets carry the rest of the story (`data/secrets.ts`): the Lamp Stone's
 * shape, the cell, Hollis's coin, the ring and the dwarves' door are each said
 * on finding the thing itself, so a zone's beat here leads up to its secret and
 * never says it first. Nothing before Part G says what Lorn did.
 */
export interface SpiritBeat {
  id: SpiritBeatId;
  /** Where it is said, and only there. Null for the waking, said wherever the character is. */
  zoneId: ZoneId | null;
  /** What has to have happened: being there is enough, or the boss is down. */
  when: { kind: 'arrive' } | { kind: 'kill'; enemyId: EnemyId };
  /** Wick's line: short, in its voice (`docs/lore/tone.md`), and quieter as it remembers. */
  line: string;
  /**
   * Said without being asked. Only the waking is: it is how a player learns
   * that the light is there to be tapped.
   */
  unbidden: boolean;
}

/** The order the beats are told in when more than one is waiting. */
export const SPIRIT_BEAT_ORDER = exhaustive<SpiritBeatId>()([
  'wake',
  'candle-strand',
  'the-new-cut',
  'the-cellar',
  'old-mill-road',
  'greyford',
  'blackwater-fen',
  'the-deep-cut',
  'orlath',
]);

const arrive = { kind: 'arrive' } as const;

export const SPIRIT_BEATS: Record<SpiritBeatId, SpiritBeat> = {
  // The Wet Boot, the first morning. Lampton's own memory, the waymarker, is
  // the Lamp Stone's line, found in the crossroads.
  wake: {
    id: 'wake',
    zoneId: null,
    when: arrive,
    line: "You were the nearest warm thing, so here I am. Don't take it personally. I'm Wick, and when I glow, tap me: I'll have something to say.",
    unbidden: true,
  },
  'candle-strand': {
    id: 'candle-strand',
    zoneId: 'beach',
    when: arrive,
    line: "I don't like it out there. It's too big, and it's pulling.",
    unbidden: false,
  },
  // The cell itself is the Broken Cell's line, behind the face.
  'the-new-cut': {
    id: 'the-new-cut',
    zoneId: 'quarry',
    when: arrive,
    line: "I came down this hill once, in a hurry. I'd rather not talk about the top of it.",
    unbidden: false,
  },
  // Merrath's face is the strongbox's line.
  'the-cellar': {
    id: 'the-cellar',
    zoneId: 'bandit-hideout',
    when: arrive,
    line: 'This was a tomb before it was a cellar, and somebody kept a lamp lit in it. Nobody has for a long time.',
    unbidden: false,
  },
  // The Warden is not in the game yet, and will not speak while Wick is near
  // when she is: a word from the willows is all of her it gets.
  'old-mill-road': {
    id: 'old-mill-road',
    zoneId: 'old-mill-road',
    when: arrive,
    line: "Somebody in the willows said a word at me. 'Kindled.' Then nothing. What's kindled?",
    unbidden: false,
  },
  // The ring is the back room's line.
  greyford: {
    id: 'greyford',
    zoneId: 'greyford',
    when: arrive,
    line: "Somebody in this yard buys what comes up out of the old graves. I'd like a look. I don't know why.",
    unbidden: false,
  },
  // Maren is not in the game yet. When she is, she says it to Wick's face.
  'blackwater-fen': {
    id: 'blackwater-fen',
    zoneId: 'blackwater-fen',
    when: arrive,
    line: 'Those lights on the posts are kept by people like the ones who put me in the hill. I know it the way you know a burn.',
    unbidden: false,
  },
  // The door is the sealed door's line.
  'the-deep-cut': {
    id: 'the-deep-cut',
    zoneId: 'deep-cut',
    when: arrive,
    line: "Dwarf work, all of it. I know dwarf work. I don't like that I know it.",
    unbidden: false,
  },
  orlath: {
    id: 'orlath',
    zoneId: 'sunken-barrow',
    when: { kind: 'kill', enemyId: 'barrow-king' },
    line: "He knew me. He called me Lorn, and asked if I'd come to tend him. I did tend them, didn't I? The kings' lights.",
    unbidden: false,
  },
};

/**
 * What Wick says when it is tapped with nothing waiting: a line of its own,
 * about where it is, taken in turn. None of them remembers anything; that is
 * what the beats are for.
 */
export const SPIRIT_ASIDES: Record<ZoneId, readonly string[]> = {
  town: [
    "I'm a very good light. You may say so.",
    "Everybody here's in a hurry. I like it. Nobody's in a hurry in the dark.",
  ],
  beach: [
    'Keep to the sand, would you? Not the water. Just the sand.',
    "The crabs don't like me. I don't think they like anybody.",
  ],
  quarry: [
    "They're cutting the hill up for stone. I'd rather they didn't, and I can't say why.",
    "Mind the edges. I can't catch you. I've thought about it.",
  ],
  'bandit-camp': [
    'Good walls. Somebody built them to last, and somebody else hung rags on them.',
    "Red rags. Is that a uniform? It's not a very good uniform.",
  ],
  'bandit-hideout': [
    "It's cold down here, and I don't mean the air.",
    "Quietly. Whoever's at the back is listening for us.",
  ],
  'old-mill-road': [
    "The willows are listening. I'm almost sure of it.",
    'Goblins: small, loud and pleased with themselves. I rather like them, from here.',
  ],
  greyford: [
    'A ford, a fort, and a great many people counting things.',
    "The river talks all night. I don't mind. It's company.",
  ],
  'blackwater-fen': [
    "Don't walk where it's black. I know you can't help it. Try.",
    "Those lights are watching the water. I don't think they want us to.",
  ],
  'deep-cut': [
    "A dwarf's tunnel with a goblin's mess in it.",
    "I can light you this far. Past that, it's your feet and your luck.",
  ],
  'sunken-barrow': [
    'We should be quiet here. Not for us. For them.',
    'The water followed them down. Nobody asked it to.',
  ],
};
