import type { QuestStatus } from '../systems/QuestSystem';
import type { ClassId, NpcId, QuestId } from '../types/ids';

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
 * What hearing an answer does beyond being heard. Nothing yet (D1's answer):
 * D2 adds a rumour told and D3 a standing moved, each a member here and a case
 * in `TalkSession`, so the slot is on every answer from the start rather than
 * cut into them later.
 */
export type DialogEffect = never;

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

  /*
   * The lore's people (D1b): four who work no counter, so everything they are
   * is here. Bess keeps the inn the player woke in; Amos fishes the strand this
   * side of the Candles; Pocket is the crow at Greyford, rude and better
   * informed than a crow should be; and Maren is the first of the fenfolk who
   * will talk rather than fight. Tirrow, who leads the raiders, is a name in
   * Maren's lines until Part G gives him a scene.
   */
  innkeeper: {
    greetings: [
      { says: "You're up. Sit anywhere that isn't wet, which is the bench by the fire." },
      {
        says: "The Company's put you in a house, I hear. You'll still drink here. They all say they won't, and they all do.",
        requires: [done('a-roof-in-lampton')],
      },
    ],
    topics: [
      {
        id: 'woke',
        ask: 'How did I get here?',
        answers: [
          {
            id: 'woke',
            says: 'The carter brought you in off the west road with your purse cut and a lump on your head, and you slept a night and a day. The room is on the slate. The Company can pay it; it was their road.',
          },
        ],
      },
      {
        id: 'night',
        ask: 'Did anything odd happen that night?',
        follows: 'woke',
        answers: [
          {
            id: 'night',
            says: "There was a light in your room, the night they carried you up. I took it for a candle. I hadn't left you a candle.",
          },
        ],
      },
      {
        id: 'name',
        ask: 'Why the Wet Boot?',
        answers: [
          {
            id: 'name',
            says: 'The first keeper came in off the strand in the rain, took off one boot and poured the sea out of it on the floor. They had named the place before he got the other one off.',
          },
        ],
      },
      {
        id: 'cellar',
        ask: "What's in your cellar?",
        answers: [
          {
            id: 'cellar',
            says: "Ale, rats, and something the regulars call His Majesty. I haven't been down since spring. I go as far as the hatch and shout.",
          },
        ],
      },
      {
        id: 'cobb',
        ask: 'Did the smith drink here?',
        requires: [{ kind: 'asked', npcId: 'shopkeeper', topicId: 'smith' }],
        answers: [
          {
            id: 'cobb',
            says: "Every night for three years, on the stool by the door. He went east to a wedding and left the stool. I've not let anybody sit on it. I don't know why. Habit.",
          },
        ],
      },
      {
        id: 'hollis',
        ask: 'Who drinks here now?',
        requires: [done('the-cutthroat')],
        answers: [
          {
            id: 'hollis',
            says: 'Carters again, now the east road is quiet. They talk about you. I tell them you paid your slate, which you did not, and that is the nicest thing I have said about anybody this year.',
          },
        ],
      },
    ],
  },

  fisher: {
    greetings: [{ says: 'Mind the line. And mind the crabs. They mind nothing.' }],
    topics: [
      {
        id: 'candles',
        ask: 'What are those stones out in the water?',
        answers: [
          {
            id: 'candles',
            says: "The Candles. Somebody's old wall, gone under, with the stumps of something standing up along it. The young ones fish right out past them. I don't.",
          },
        ],
      },
      {
        id: 'past',
        ask: "Why won't you fish past them?",
        follows: 'candles',
        answers: [
          {
            id: 'past',
            says: "There's a light down there after dark. Far out, and under the water. Not a boat, not the moon. I saw it my first winter here, and I've fished this side of the Candles since.",
          },
        ],
      },
      {
        id: 'strand',
        ask: 'Is the fishing good?',
        answers: [
          {
            id: 'strand',
            says: "Good enough for the Company, which pays by the basket and doesn't ask what's in it. Twenty-eight years I've fished this strand. The fish haven't noticed.",
          },
        ],
      },
      {
        id: 'fenfolk',
        ask: 'Do the fen raiders trouble you?',
        requires: [level(3)],
        answers: [
          {
            id: 'fenfolk',
            says: 'They cut my nets twice last year, and left the fish in them. A thief takes the fish. I never did work out what that was, so I keep my nets out of the fen.',
          },
          {
            id: 'fenfolk-close',
            says: "You've been down there among them. Then you know more than I do. I only know they left the fish.",
            requires: [done('blackwater-raiders')],
          },
        ],
      },
    ],
  },

  crow: {
    greetings: [
      { says: "Oh. It's you." },
      {
        says: 'Another sword. Lovely. Wave it somewhere else.',
        requires: [{ kind: 'class', classId: 'warrior' }],
      },
      {
        says: "Keep that fire to yourself. I'm nothing but feathers.",
        requires: [{ kind: 'class', classId: 'wizard' }],
      },
      {
        says: 'Point that somewhere else. I know what you lot think crows are for.',
        requires: [{ kind: 'class', classId: 'ranger' }],
      },
    ],
    topics: [
      {
        id: 'talk',
        ask: 'How can you talk?',
        answers: [{ id: 'talk', says: 'Not telling.' }],
      },
      {
        id: 'name',
        ask: 'How do you know who I am?',
        follows: 'talk',
        answers: [
          {
            id: 'name',
            says: "Everybody knows who you are. I'm the only one rude enough to say so. Don't ask me how. I won't tell you that either.",
          },
        ],
      },
      {
        id: 'fettler',
        ask: 'What does the fettler keep in the back?',
        answers: [
          {
            id: 'fettler',
            says: "Shiny things. Dead people's shiny things. He thinks I don't look in at the window. I always look in at the window.",
          },
        ],
      },
      {
        id: 'light',
        ask: 'Can you see the light with me?',
        answers: [
          {
            id: 'light',
            says: 'I see it. It sees me. We have agreed not to discuss it.',
          },
        ],
      },
      {
        id: 'ford',
        ask: 'What else do you know?',
        requires: [level(5)],
        answers: [
          {
            id: 'ford',
            says: 'More than you. Less than the stones in that ford, and they say nothing to anybody. Look at them, if you want to be told something.',
          },
          {
            id: 'ford-barrow',
            says: "That you went down into the old king's hole and came out again. Everybody knows that. What they don't know is what came out with you.",
            requires: [done('the-barrow-king')],
          },
        ],
      },
    ],
  },

  keeper: {
    greetings: [
      {
        says: 'Every light you see out there is somebody’s mother. Mind where you put your feet.',
      },
      {
        says: 'You have killed some of our young. I know who you are. Sit anyway, if you will listen.',
        requires: [done('blackwater-raiders')],
      },
    ],
    topics: [
      {
        id: 'lights',
        ask: 'What are the lights?',
        answers: [
          {
            id: 'lights',
            says: 'Lanterns, over the barrows. When one of us dies we go into one, and keep a king asleep who would be better asleep. I keep the third light. It is my mother.',
          },
        ],
      },
      {
        id: 'pans',
        ask: 'Why do your people break the pans?',
        answers: [
          {
            id: 'pans',
            says: 'The Company drains the fen to make salt, and the water goes down off our dead, and the lanterns go out. Our young break the pans for it. Tirrow leads them. He is young, and angry, and he is not wrong.',
          },
        ],
      },
      {
        id: 'grandmother',
        ask: 'What is under the pans?',
        follows: 'pans',
        answers: [
          {
            id: 'grandmother',
            says: 'My grandmother, under the second pan from the east. She always said she would be worth something to the Company one day.',
          },
        ],
      },
      {
        id: 'tirrow',
        ask: 'Will Tirrow talk to me?',
        follows: 'pans',
        answers: [
          {
            id: 'tirrow',
            says: 'He will not talk to me, and I carried him on my back across this fen. He talks to the pans, with a spade. When that changes I will know it first.',
          },
        ],
      },
      {
        id: 'wick',
        ask: 'Do you know what this light is?',
        answers: [
          {
            id: 'wick',
            says: 'We put you in the hill.',
          },
          {
            id: 'wick-named',
            says: 'It has a name again. Then it has begun to remember, and what it remembers is not mine to tell it.',
            requires: [done('the-barrow-king')],
          },
        ],
      },
      {
        id: 'why',
        ask: 'Why would you do that?',
        follows: 'wick',
        answers: [
          {
            id: 'why',
            says: 'Not today. Not to you, with it listening at your shoulder.',
          },
        ],
      },
    ],
  },
};
