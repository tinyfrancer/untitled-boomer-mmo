import { composed, grid, type Grid, type SpriteDef } from '../format';

/**
 * Pocket, the crow at Greyford (D1b, `docs/lore/peoples.md`): black, glossy
 * where the light catches it (d), a dark beak (e) and an eye that misses
 * nothing (o), on the post by the longhouse door it has made its own. A beast
 * rather than a person, since it is built like a bird; drawn with its post,
 * because it is never anywhere else and a crow alone on the grass is a crow
 * nobody looks at twice.
 *
 * Only standing still is drawn: it is a person in the game's terms, placed and
 * talked to, and never walks or fights. Its idle is a hop, the bird dropped a
 * pixel onto its feet and back, and the post never moves under it.
 */

// Facing you, its beak pointed at whoever is talking.
const CROW_DOWN = grid(`
  ....bbbb....
  ...bccccb...
  ...bocdob...
  ....beeb....
  ...bbeebb...
  ..bccccccb..
  .bcccddcccb.
  .bccddddccb.
  .bcccddcccb.
  ..bccccccb..
  ..bbccccbb..
  ...bbbbbb...
  ....f..f....
`);

// Turned away, the tail down over the post.
const CROW_UP = grid(`
  ....bbbb....
  ...bccccb...
  ...bcddcb...
  ....bccb....
  ...bbccbb...
  ..bccccccb..
  .bccddddccb.
  .bcccddcccb.
  .bccccccccb.
  ..bccccccb..
  ...bccccb...
  ....bccb....
  ....bbbb....
`);

// Side on, the beak out ahead and the tail behind.
const CROW_RIGHT = grid(`
  .....bbbb...
  ....bccccb..
  ....bcoccee.
  .....bccbe..
  ...bbbccbb..
  ..bccccdddb.
  bbcccccdddcb
  bbbcccccccb.
  .bbbbccccb..
  ....bbbbb...
  .....f.f....
`);

// The post: a rough-cut stake, its top darkened where the bird stands.
const POST = grid(`
  xxxxxx
  wyxxyw
  wxyxxw
  wxxyxw
  wxxxyw
  wyxxxw
  wxyxxw
  wxxxyw
  wxxyxw
  wyxxxw
  wxxyxw
  wxyxxw
  wwxxww
`);

const SIZE = 32;
// The post's foot one row up, leaving the clear edge the outline is drawn in.
const POST_TOP = SIZE - 1 - POST.length;

function crowFrame(bird: Grid, hop: number): Grid {
  return composed(SIZE, SIZE, [
    { grid: POST, x: 13, y: POST_TOP },
    { grid: bird, x: 10, y: POST_TOP - bird.length + hop },
  ]);
}

const idle = (bird: Grid): Grid[] => [crowFrame(bird, 0), crowFrame(bird, -1)];

export const CROW: SpriteDef = {
  id: 'crow',
  kind: 'beast',
  width: SIZE,
  height: SIZE,
  legend: {
    b: 'hairBlack.0',
    c: 'hairBlack.1',
    d: 'hairBlack.3',
    e: 'char.3',
    o: 'bone.4',
    f: 'char.2',
    w: 'wood.1',
    x: 'wood.2',
    y: 'wood.3',
  },
  animations: {
    idle: {
      down: idle(CROW_DOWN),
      up: idle(CROW_UP),
      right: idle(CROW_RIGHT),
      left: 'mirror',
    },
  },
};
