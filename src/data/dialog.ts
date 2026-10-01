import type { QuestStatus } from '../systems/QuestSystem';
import type { ClassId, LoreFragmentId, NpcId, QuestId, RumourId } from '../types/ids';

/**
 * What has to be true for a line to be said: the character's level, their
 * class, where a quest stands, or something already asked of somebody.
 *
 * A union rather than a bag of optional fields so that what a later phase adds
 * — a standing (D3), a rumour heard (D2) — is a member here and a case in
 * `DialogSystem.holds`, and a member nothing answers is a compile error there.
 */
export type DialogRequirement =
  | { kind: 'level'; atLeast: number }
  | { kind: 'class'; classId: ClassId }
  | { kind: 'quest'; questId: QuestId; status: QuestStatus }
  | { kind: 'asked'; npcId: NpcId; topicId: string };

/**
 * What hearing an answer does beyond being heard, each a member here and a
 * case in `TalkSession`: a rumour told, noted in the Whispers journal, or a
 * piece of the history learned (D2, decision 132). D3 adds a standing moved.
 */
export type DialogEffect =
  { kind: 'rumour'; rumourId: RumourId } | { kind: 'lore'; fragmentId: LoreFragmentId };

/** Something a person says, and when they say it. */
export interface DialogLine {
  says: string;
  /** Every one must hold. None is always. */
  requires?: readonly DialogRequirement[];
}

/**
 * One answer to a topic. A topic can have several, each for a later state of
 * things, and the last whose `requires` hold is the one said, so the newest
 * news is written last.
 *
 * The id is what the character remembers having heard, which is how a topic
 * goes grey once asked and comes back when it gains an answer not yet heard.
 * Unique within the person and never reused, since a save holds it.
 */
export interface DialogAnswer extends DialogLine {
  id: string;
  effects?: readonly DialogEffect[];
}

/** Something the player can ask a person about, as a button in the conversation. */
export interface DialogTopic {
  /** Unique within the person. */
  id: string;
  /** The player's words, on the button. */
  ask: string;
  /**
   * A topic of the same person's that has to have been asked first: how an
   * answer leads to more. A topic with none is there from the start.
   */
  follows?: string;
  /** For the topic to be offered at all. */
  requires?: readonly DialogRequirement[];
  answers: readonly DialogAnswer[];
}

export interface Conversation {
  /** The first line on opening; the last that holds is said, so the first must always hold. */
  greetings: readonly DialogLine[];
  topics: readonly DialogTopic[];
}

const level = (atLeast: number): DialogRequirement => ({ kind: 'level', atLeast });
const done = (questId: QuestId): DialogRequirement => ({ kind: 'quest', questId, status: 'done' });
const taken = (questId: QuestId): DialogRequirement => ({
  kind: 'quest',
  questId,
  status: 'active',
});
const rumour = (rumourId: RumourId): DialogEffect => ({ kind: 'rumour', rumourId });
const lore = (fragmentId: LoreFragmentId): DialogEffect => ({ kind: 'lore', fragmentId });

/**
 * Everybody's conversation, written in `docs/lore/tone.md`'s voice from their
 * entry in `docs/lore/places.md`.
 *
 * Each says what that person believes, which is not always what is true (the
 * fettler on fenweave), and a line names at most one person or place the player
 * may not have met yet (tone rule 8).
 */
export const DIALOG: Record<NpcId, Conversation> = {
  shopkeeper: {
    greetings: [
      { says: "Come in, and mind the rats. They've been at the flour again." },
      {
        says: 'Look who it is. Anything on the shelf is yours at the usual price, which from me is a compliment.',
        requires: [done('the-cutthroat')],
      },
    ],
    topics: [
      {
        id: 'lampton',
        ask: 'What is this place?',
        answers: [
          {
            id: 'lampton',
            says: "Lampton. The Company's town, twenty-nine years old, and I've kept this store for twenty-two of them. Store, bank, the hall, the Post, the Wet Boot, and a smithy with nobody in it.",
            effects: [lore('second-charter')],
          },
        ],
      },
      {
        id: 'stone',
        ask: 'Why is it called Lampton?',
        follows: 'lampton',
        answers: [
          {
            id: 'stone',
            says: "The stone at the crossroads, with the iron cage on top. The first carters took it for a lamp-post. It was here before the town was, mind. Dig round the foot of it if you don't believe me.",
            effects: [rumour('stone-older-than-town')],
          },
        ],
      },
      {
        id: 'smith',
        ask: 'Who keeps the smithy?',
        follows: 'lampton',
        answers: [
          {
            id: 'smith',
            says: "Cobb Harrow, when he's here. He went east to a wedding two years ago. The board at the Post still orders iron for him, as if he's coming back any day now.",
          },
        ],
      },
      {
        id: 'rats',
        ask: 'Where do the rats come from?',
        answers: [
          {
            id: 'rats',
            says: 'Up out of the cellar under the Wet Boot, mostly. The regulars say there is something down there bigger than a rat. They call it His Majesty.',
            effects: [rumour('his-majesty')],
          },
        ],
      },
      {
        id: 'carts',
        ask: 'Who is taking your carts?',
        requires: [done('rat-bones')],
        answers: [
          {
            id: 'carts',
            says: "Hollis Crane's lot, out of the old ruin on the east road. Strips of Company red round their arms, for a joke. Three carts of mine this month, and nobody's laughing.",
          },
          {
            id: 'carts-quiet',
            says: 'The first cart through in a month came in yesterday, and the driver kissed the Lamp Stone. I would have done the same.',
            requires: [done('the-cutthroat')],
          },
        ],
      },
      {
        id: 'raiders',
        ask: 'What about the raiders in the fen?',
        requires: [level(3)],
        answers: [
          {
            id: 'raiders',
            says: 'Raiders, the Company calls them. My mother called them the fen people and bought her eels off them. Draw your own lines.',
          },
        ],
      },
      {
        id: 'quarry',
        ask: "What's happening at the New Cut?",
        answers: [
          {
            id: 'quarry',
            says: "The blasting crew broke into a little stone room behind the face this spring, and sold what was in it to the fettler at Greyford for beer money. Then they drank the money. The room's still there, if you want a look at nothing.",
            effects: [rumour('blasting-crew')],
          },
        ],
      },
      {
        id: 'news',
        ask: 'What do people say about me?',
        answers: [
          {
            id: 'news',
            says: "That you came west on the cart the Red Rags took on the road, and walked in with a rusty sword and no luggage. It's a small town. I hear things.",
          },
          {
            id: 'news-greyford',
            says: 'That Oona Rook asks after you, out at Greyford. When Oona asks after somebody, they have gone up in the world.',
            requires: [level(5)],
          },
        ],
      },
    ],
  },

  banker: {
    greetings: [
      {
        says: "Whatever you leave with me stays exactly where you left it. That's the whole job.",
      },
      {
        says: 'Your account is in order. It always is. I see to it.',
        requires: [level(5)],
      },
    ],
    topics: [
      {
        id: 'vault',
        ask: 'Is it safe here?',
        answers: [
          {
            id: 'vault',
            says: 'You hand it over, I write it down, and it stays. Nobody has ever taken a thing out of that vault that was not written into it first.',
          },
        ],
      },
      {
        id: 'company',
        ask: 'Who do you answer to?',
        answers: [
          {
            id: 'company',
            says: "The Veymarch Company, under the Crown's charter. The Company is not a kind master. It is an exact one, which I prefer.",
          },
        ],
      },
      {
        id: 'cobb',
        ask: 'Is the smith coming back?',
        requires: [{ kind: 'asked', npcId: 'shopkeeper', topicId: 'smith' }],
        answers: [
          {
            id: 'cobb',
            says: "Mr Harrow's account has been dormant for two years. I am not at liberty to say more. I will say that dormant is the word I chose.",
          },
        ],
      },
      {
        id: 'gold',
        ask: 'Seen any strange coin?',
        requires: [level(2)],
        answers: [
          {
            id: 'gold',
            says: 'Twice this year. Old gold, heavier than ours, with a king on it I cannot put a name to. I weighed it, wrote it down and sent it east. Nobody comes by coin like that honestly.',
            effects: [rumour('old-gold')],
          },
          {
            id: 'gold-hollis',
            says: 'The old gold. I am told you have seen where it came from. I would rather not know, and I have written down that I would rather not know.',
            effects: [rumour('old-gold')],
            requires: [done('the-cutthroat')],
          },
        ],
      },
      {
        id: 'mill',
        ask: 'Who kept the Old Mill?',
        requires: [level(3)],
        answers: [
          {
            id: 'mill',
            says: "The first charter's village, seventy years ago. They kept their books at the mill, and when they left they never sent them east. Eleven years of accounts, never audited. I think about it more than I should.",
            effects: [rumour('mill-books')],
          },
        ],
      },
    ],
  },

  trainer: {
    greetings: [{ says: 'Talent is cheap. Knowing what to do with it costs a little more.' }],
    topics: [
      {
        id: 'past',
        ask: 'Where did you learn all this?',
        answers: [
          {
            id: 'past',
            says: 'I was a soldier, then a hedge-wizard, then a poacher. Sacked from all three. You learn more from being sacked than kept, if you are paying attention.',
          },
        ],
      },
      {
        id: 'advice',
        ask: 'What should I know?',
        answers: [
          {
            id: 'advice-warrior',
            says: "Hold your ground and let them come to you. A sword's a short argument. Make it the last one.",
            requires: [{ kind: 'class', classId: 'warrior' }],
          },
          {
            id: 'advice-wizard',
            says: "Fire does what you tell it. That's the good news and the bad news.",
            requires: [{ kind: 'class', classId: 'wizard' }],
          },
          {
            id: 'advice-ranger',
            says: "Every arrow you loose is one you've paid for. Make the first count and you won't need the third.",
            requires: [{ kind: 'class', classId: 'ranger' }],
          },
        ],
      },
      {
        id: 'fen',
        ask: 'Have you been in the fen?',
        follows: 'past',
        answers: [
          {
            id: 'fen',
            says: 'Once, poaching. Lights on posts out over the water, and nobody tending them that I ever saw. I came back with no eels, and I have not been since.',
            effects: [rumour('lights-on-posts')],
          },
        ],
      },
      {
        id: 'strand',
        ask: 'Have you been out on the strand?',
        follows: 'past',
        answers: [
          {
            id: 'strand',
            says: "Once, for a bet. Off the end of the spit there's a way out to the nearest of the Candles, along the top of something under the water. I won the bet. It was cold out there, colder than it had any right to be, and I came straight back.",
            effects: [rumour('walk-to-the-candle')],
          },
        ],
      },
      {
        id: 'climb',
        ask: 'How am I doing?',
        requires: [level(4)],
        answers: [
          {
            id: 'climb',
            says: 'Better than I was at your age, and I was not bad. Go west. Lampton has taught you all it knows.',
          },
          {
            id: 'climb-barrow',
            says: 'You went down into that barrow and came back up. I have nothing left to teach you about being brave. Being careful, now. That I could go on about.',
            requires: [done('the-barrow-king')],
          },
        ],
      },
    ],
  },

  quartermaster: {
    greetings: [
      {
        says: "Always more work than hands. Take something off the board; it goes back up the moment you're paid.",
      },
      {
        says: "You again. Good. Half the board's got your name on it, near enough.",
        requires: [level(4)],
      },
      {
        says: "There you are. The Post doesn't say it often, so I will: the Company's glad of you. Now. The board.",
        requires: [level(7)],
      },
    ],
    topics: [
      {
        id: 'board',
        ask: 'Who posts the work?',
        answers: [
          {
            id: 'board',
            says: 'The Company. Rats, raiders, timber and ore. It wants the Veymarch safe and paying, and on a good day in that order.',
          },
        ],
      },
      {
        id: 'fen',
        ask: "What's under the fen?",
        answers: [
          {
            id: 'fen',
            says: "I don't care what's under the fen. I care what's on the road, and what's on the road is Hollis.",
          },
          {
            id: 'fen-road',
            says: "I don't care what's under the fen. I cared what was on the road, and you saw to that. Now it's the pans.",
            requires: [done('the-cutthroat')],
          },
        ],
      },
      {
        id: 'pans',
        ask: 'What are the pans?',
        follows: 'fen',
        answers: [
          {
            id: 'pans',
            says: 'Salt pans, at the top of the fen. Salt pays for half this town. The fenfolk break them every month, and every month we dig them out again.',
            effects: [lore('salt-pans')],
          },
        ],
      },
      {
        id: 'hollis',
        ask: 'Who is Hollis?',
        follows: 'fen',
        answers: [
          {
            id: 'hollis',
            says: "Hollis Crane. A Company guard, once. Eight years ago he went off the east road with the pay-cart he was paid to guard, and he's been on that road since with a strip of our red round his arm. He's in a hole under the old ruin, and the Company wants him out of it.",
            effects: [rumour('pay-cart')],
          },
          {
            id: 'hollis-done',
            says: "Hollis Crane. Was. The pay-cart's written off and so is he, and I've closed his file, which is the kindest thing anybody at the Company will ever do for him.",
            requires: [done('the-cutthroat')],
            effects: [rumour('pay-cart')],
          },
        ],
      },
      {
        id: 'camp',
        ask: 'Where do the Red Rags sleep?',
        requires: [level(2)],
        answers: [
          {
            id: 'camp',
            says: "In the old ruin up the east road. There's a hall in its far corner where they bed down, and whatever they keep in that wall, they don't keep it in the Company's bank.",
            effects: [rumour('hall-wall')],
          },
        ],
      },
      {
        id: 'cut',
        ask: "What's down the Deep Cut?",
        requires: [level(5)],
        answers: [
          {
            id: 'cut',
            says: "Coal, iron, goblins and paperwork. One of my men came up saying there's a sum cut into the rock down there, past where the goblins have been, with somebody's name on it. The Company would like to know whom it owes, and would prefer not to.",
            effects: [rumour('sum-in-the-rock')],
          },
        ],
      },
      {
        id: 'smith',
        ask: 'Why order iron for a smith who is gone?',
        requires: [{ kind: 'asked', npcId: 'shopkeeper', topicId: 'smith' }],
        answers: [
          {
            id: 'smith',
            says: "Because the order's in the book, and the book's the Company's. If he comes back, he'll want iron. If he doesn't, somebody else will.",
          },
        ],
      },
    ],
  },

  outfitter: {
    greetings: [
      {
        says: "Coin's no use to me out here. Bring me ore and timber and I'll see you properly kitted.",
      },
    ],
    topics: [
      {
        id: 'greyford',
        ask: 'What is Greyford?',
        answers: [
          {
            id: 'greyford',
            says: "The Company's forward post, in name. In fact it's us: traders, a tanner, a fletcher. We pay the Company to keep the road open, and it pays us by leaving us be.",
          },
        ],
      },
      {
        id: 'coin',
        ask: 'Why no coin?',
        follows: 'greyford',
        answers: [
          {
            id: 'coin',
            says: "Nothing to spend it on west of Lampton. Iron I can use. Timber I can use. A purse I can't eat.",
          },
        ],
      },
      {
        id: 'ford',
        ask: 'Who built the ford?',
        answers: [
          {
            id: 'ford',
            says: 'Nobody built it. The stones were here. Dressed square as a ledger, mind, and two of them standing up in the water like they used to hold something up.',
            effects: [rumour('dressed-stones')],
          },
        ],
      },
      {
        id: 'pond',
        ask: "What's in the millpond?",
        answers: [
          {
            id: 'pond',
            says: "Fish, and the last village's coppers. They threw them in the year the winter wouldn't end. On a still day you can see stone down there off the south bank, between two of the willows. Carved. I leave it alone.",
            effects: [rumour('coin-in-the-pond')],
          },
        ],
      },
      {
        id: 'goblins',
        ask: 'What do the goblins want?',
        answers: [
          {
            id: 'goblins',
            says: "Anything shiny. They had the road before the Company came and they've no plans to give it back. Brave in threes. Not in ones.",
          },
          {
            id: 'goblins-road',
            says: 'Fewer of them on the road since you went down it. The carts have started coming this way again. I notice who does that.',
            requires: [done('goblin-road')],
          },
        ],
      },
      {
        id: 'deep',
        ask: 'Where do the goblins dig?',
        follows: 'goblins',
        requires: [level(5)],
        answers: [
          {
            id: 'deep',
            says: "Down the Deep Cut, where the Company's shaft broke through. They stopped at one wall in the hall at the bottom, and won't go near it. Goblins don't stop digging. I'd want to know why before I went looking.",
            effects: [rumour('goblins-stopped')],
          },
        ],
      },
      {
        id: 'fettler',
        ask: 'What about the fettler?',
        answers: [
          {
            id: 'fettler',
            says: "He buys anything old and never asks where it came from. That's all I'll say about him, and I'd thank you to notice I said it.",
            effects: [rumour('fettler-buys')],
          },
        ],
      },
    ],
  },

  fettler: {
    greetings: [
      { says: "I don't make anything. I take what somebody else made and make it yours." },
    ],
    topics: [
      {
        id: 'stock',
        ask: 'Where does your stock come from?',
        answers: [
          {
            id: 'stock',
            says: 'Here and there. Old things turn up out west, and old things want a new owner. Beautiful work, most of it. Nobody wearing it. Seems a waste.',
          },
        ],
      },
      {
        id: 'back',
        ask: "What's in the back?",
        follows: 'stock',
        answers: [
          {
            id: 'back',
            says: 'Stock, waiting on the bench. None of it for sale, and none of it for you to be looking at, round the back or anywhere else.',
          },
        ],
      },
      {
        id: 'raiders',
        ask: 'Who are the fen raiders?',
        requires: [level(4)],
        answers: [
          {
            id: 'raiders',
            says: 'Thieves in good cloth. Fenweave, they call it, and none of it was theirs to begin with, mark me.',
          },
          {
            id: 'raiders-close',
            says: "You've seen them close now. Young, aren't they? Younger than I'd like. Still. A thief is a thief.",
            requires: [done('blackwater-raiders')],
          },
        ],
      },
      {
        id: 'mere',
        ask: 'What do the raiders do with what they take?',
        follows: 'raiders',
        answers: [
          {
            id: 'mere',
            says: "Throw the best of it away. Bowls, coin, the odd ring, into the mere in the west of the fen, off the south shore. I'd fetch it out myself if I could swim, and if they'd let me.",
            effects: [rumour('things-in-the-mere')],
          },
        ],
      },
      {
        id: 'orlath',
        ask: 'Who was Orlath?',
        answers: [
          {
            id: 'orlath',
            says: "A king, under the bottom of the fen. Buried with more than anybody's ever dug up, and older work than any I know. I'd like to see it. I'd like very much to see it.",
            requires: [taken('the-barrow-king')],
          },
          {
            id: 'orlath-seen',
            says: "You've seen him. I won't ask what he said. I will ask what he was wearing.",
            requires: [done('the-barrow-king')],
          },
        ],
      },
      {
        id: 'lantern',
        ask: 'Why is he awake?',
        follows: 'orlath',
        answers: [
          {
            id: 'lantern',
            says: "His lantern burned blue, the fenfolk say, for longer than anybody's counted. It went out this summer, and he's been up and about since. I'd give a good deal to see what he's up and about in.",
            effects: [rumour('blue-lantern')],
          },
        ],
      },
      {
        id: 'walls',
        ask: 'What else is down there?',
        follows: 'orlath',
        answers: [
          {
            id: 'walls',
            says: "Pictures. The old ones carved what they had on the walls, and nobody looks at the walls with a king's gold on the floor. More fool them. Look along the gallery, if you go down.",
            effects: [rumour('walls-of-the-barrow')],
          },
        ],
      },
    ],
  },
};
