import type { QuestStatus } from '../systems/QuestSystem';
import type { StandingMove } from './factions';
import type { ClassId, FactionRankId, NpcId, QuestId } from '../types/ids';

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
  | { kind: 'asked'; npcId: NpcId; topicId: string }
  // D3's: a rank with a faction stood at or above, and a topic not yet asked,
  // which is how two answers become a choice: each waits on the other unasked,
  // so taking one side takes the other off the table for good.
  | { kind: 'standing'; rankId: FactionRankId }
  | { kind: 'unasked'; npcId: NpcId; topicId: string };

/**
 * What hearing an answer does beyond being heard, the first time it is heard
 * and never again, so a grey topic asked twice pays nothing twice. D3 moves a
 * standing and D2 tells a rumour, each a member here and a case in
 * `TalkSession`.
 */
export type DialogEffect =
  // D3's: standing moved with the factions, once, the first time it is heard.
  { kind: 'standing'; move: StandingMove };

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
const ranked = (rankId: FactionRankId): DialogRequirement => ({ kind: 'standing', rankId });
const unasked = (npcId: NpcId, topicId: string): DialogRequirement => ({
  kind: 'unasked',
  npcId,
  topicId,
});
const standing = (move: StandingMove): DialogEffect => ({ kind: 'standing', move });
const done = (questId: QuestId): DialogRequirement => ({ kind: 'quest', questId, status: 'done' });
const taken = (questId: QuestId): DialogRequirement => ({
  kind: 'quest',
  questId,
  status: 'active',
});

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
          {
            id: 'raiders-guest',
            says: "I hear the fen people let you past these days. My mother would've liked you. She said they never once short-weighted her, which is more than I can say for the Company's scales.",
            requires: [ranked('keepers-guest')],
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
          },
          {
            id: 'gold-hollis',
            says: 'The old gold. I am told you have seen where it came from. I would rather not know, and I have written down that I would rather not know.',
            requires: [done('the-cutthroat')],
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
      {
        says: "Contractor. Your name's in the book in ink now, not pencil. The board's yours first.",
        requires: [ranked('company-contractor')],
      },
      {
        says: "Factor. The Company doesn't hand that word out, and I've never once seen it handed to anybody who didn't sign for it. Sit, if you want. Nobody else does.",
        requires: [ranked('company-factor')],
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
          },
        ],
      },
      // A choice (D3): each side waits on the other unasked, so the first said
      // is the one that stands, and it moves the Company and the Keepers apart.
      {
        id: 'dig',
        ask: "Then I'll help dig them out.",
        follows: 'pans',
        requires: [unasked('quartermaster', 'first')],
        answers: [
          {
            id: 'dig',
            says: "That's the spirit. The Post remembers who picks up a shovel, and so, I'm told, do the fenfolk. Watch your back out there.",
            effects: [standing({ company: 15, keepers: -15 })],
          },
        ],
      },
      {
        id: 'first',
        ask: 'Maybe the fen was theirs first.',
        follows: 'pans',
        requires: [unasked('quartermaster', 'dig')],
        answers: [
          {
            id: 'first',
            says: "Maybe it was. It's ours on paper now, and paper's what the Crown reads. I won't hold it against you. I'll remember it, mind.",
            effects: [standing({ company: -10, keepers: 15 })],
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
        id: 'yard',
        ask: 'How do I stand with Greyford?',
        follows: 'greyford',
        answers: [
          {
            id: 'yard',
            says: "You're a stranger who's handy with a blade. Out here that's a start, not a friendship. Clear the road west and we'll talk.",
          },
          {
            id: 'yard-regular',
            says: "You're a regular. The yard knows your face. And I've a job wants a pick in it, if you've got one.",
            requires: [ranked('greyford-regular')],
          },
          {
            id: 'yard-trader',
            says: "You're one of us, near enough. Near enough is as close as Greyford lets anybody, so don't take it hard.",
            requires: [ranked('greyford-trader')],
          },
          {
            id: 'yard-friend',
            says: "Friend of the yard. Don't let it go to your head. The yard doesn't say it to many, and it's never once said it to the Company.",
            requires: [ranked('greyford-friend')],
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
          {
            id: 'back-trader',
            says: "Trader, are you? Then you'll have been round the back already, and I'll have been told. Don't touch the lantern. It's cracked, it isn't for sale, and it isn't for asking about.",
            requires: [ranked('greyford-trader')],
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
    ],
  },
};
