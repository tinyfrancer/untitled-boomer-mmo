import { grid, type Recolour, type SpriteDef } from '../format';

/**
 * The HUD's chrome, drawn as data like everything the world is (B8, decision
 * 111): iron and brass round a panel, dark stone for a button, a slab for a
 * row and a pit for a slot. The page cuts each in nine (`border-image`), so a
 * corner is drawn once and an edge is stretched along the side it runs down:
 * every edge here is the same all along its length, which is what lets a
 * frame sixteen pixels square go round a panel of any size.
 *
 * Lit from the top-left, like every sprite: the iron band catches the light on
 * its top and left faces and falls into shade on the bottom and right, and a
 * button is a slab standing up out of the panel, where a slot is sunk into it.
 */

/**
 * The colours a panel's accent or a button's rim comes in, each a ramp the
 * neutral `tier` they are drawn in is swapped for: `frame-panel@gold`. Which
 * counter wears which is the HUD's to say (`FRAME_ACCENT` in `ui/theme.ts`).
 */
export const FRAME_ACCENTS = [
  'gold',
  'arcane',
  'purple',
  'green',
  'fire',
  'yellow',
  'red',
] as const;

export type FrameAccent = (typeof FRAME_ACCENTS)[number];

const ACCENTED: Readonly<Record<string, Recolour>> = Object.fromEntries(
  FRAME_ACCENTS.map((accent) => [accent, { tier: accent }]),
);

/**
 * A panel: an outline of ink, an iron band four pixels wide bevelled like a bar
 * standing proud of the panel (lit on the faces turned up and left, shaded on
 * those turned down and right), a line of the accent inside it, and a brass
 * plate riveted over each corner, its rivet a stone in the accent.
 *
 * The accent is drawn in the neutral `tier` ramp and recoloured per counter
 * (`FRAME_ACCENT` in `ui/theme.ts`), which is how the shop's gold, the bank's
 * blue and the trainer's violet say which counter is up without the title
 * being read, as their borders did before there was a frame to carry the
 * colour. The face is dark stone, the ground every row and button stands on.
 */
export const PANEL: SpriteDef = {
  id: 'frame-panel',
  kind: 'frame',
  width: 24,
  height: 24,
  legend: {
    k: 'ink.0',
    f: 'masonry.0',
    '0': 'metal.0',
    '1': 'metal.1',
    '2': 'metal.2',
    '3': 'metal.3',
    G: 'gold.1',
    g: 'gold.2',
    y: 'gold.3',
    a: 'tier.2',
    A: 'tier.4',
  },
  animations: {
    still: [
      grid(`
        .kkkkkkkkkkkkkkkkkkkkkk.
        kyyyyyGk33333333kyyyyyGk
        kyggggGk22222222kyggggGk
        kygAagGk22222222kygAagGk
        kygaagGk11111111kygaagGk
        kyggggGkkkkkkkkkkyggggGk
        kGGGGGGkaaaaaaaakGGGGGGk
        kkkkkkkkffffffffkkkkkkkk
        k3221kaffffffffffak2110k
        k3221kaffffffffffak2110k
        k3221kaffffffffffak2110k
        k3221kaffffffffffak2110k
        k3221kaffffffffffak2110k
        k3221kaffffffffffak2110k
        k3221kaffffffffffak2110k
        k3221kaffffffffffak2110k
        kkkkkkkkffffffffkkkkkkkk
        kyyyyyGkaaaaaaaakyyyyyGk
        kyggggGkkkkkkkkkkyggggGk
        kygAagGk22222222kygAagGk
        kygaagGk11111111kygaagGk
        kyggggGk11111111kyggggGk
        kGGGGGGk00000000kGGGGGGk
        .kkkkkkkkkkkkkkkkkkkkkk.
      `),
    ],
  },
  variants: ACCENTED,
};

/** A button: a slab of dark stone standing up out of the panel, lit on its top and left. */
export const BUTTON: SpriteDef = {
  id: 'frame-button',
  kind: 'frame',
  width: 8,
  height: 8,
  legend: { k: 'ink.0', '1': 'masonry.1', '2': 'masonry.2', '3': 'masonry.3' },
  animations: {
    still: [
      grid(`
        .kkkkkk.
        k333333k
        k322221k
        k322221k
        k322221k
        k322221k
        k311111k
        .kkkkkk.
      `),
    ],
  },
  // Armed: the stone gone to blood, so a second press is plainly a different
  // thing from the first (Abandon, Reset).
  variants: { armed: { masonry: 'blood' } },
};

/** The same slab pressed in: the light falls on its bottom and right, and its face is a step darker. */
export const BUTTON_DOWN: SpriteDef = {
  id: 'frame-button-down',
  kind: 'frame',
  width: 8,
  height: 8,
  legend: { k: 'ink.0', '0': 'masonry.0', '1': 'masonry.1', '2': 'masonry.2' },
  animations: {
    still: [
      grid(`
        .kkkkkk.
        k000000k
        k011112k
        k011112k
        k011112k
        k011112k
        k022222k
        .kkkkkk.
      `),
    ],
  },
};

/** A button that cannot be pressed: the slab flat and a step darker, catching no light. */
export const BUTTON_OFF: SpriteDef = {
  id: 'frame-button-off',
  kind: 'frame',
  width: 8,
  height: 8,
  legend: { k: 'ink.0', '1': 'masonry.1' },
  animations: {
    still: [
      grid(`
        .kkkkkk.
        k111111k
        k111111k
        k111111k
        k111111k
        k111111k
        k111111k
        .kkkkkk.
      `),
    ],
  },
};

/**
 * A button ringed in the accent rather than in ink: the tab that is open, the
 * Idle tab lit while idle runs, a button that costs something to press. The
 * ring is `tier` and recoloured the way a panel's accent is.
 */
export const BUTTON_RIM: SpriteDef = {
  id: 'frame-button-rim',
  kind: 'frame',
  width: 8,
  height: 8,
  legend: { A: 'tier.3', '1': 'masonry.1', '2': 'masonry.2', '3': 'masonry.3' },
  animations: {
    still: [
      grid(`
        .AAAAAA.
        A333333A
        A322221A
        A322221A
        A322221A
        A322221A
        A311111A
        .AAAAAA.
      `),
    ],
  },
  variants: ACCENTED,
};

/** A row in a list: a lower slab than a button, so a list reads as rows and its buttons as buttons. */
export const ROW: SpriteDef = {
  id: 'frame-row',
  kind: 'frame',
  width: 8,
  height: 8,
  legend: { k: 'ink.0', '1': 'masonry.1', '2': 'masonry.2' },
  animations: {
    still: [
      grid(`
        .222222.
        2111111k
        2111111k
        2111111k
        2111111k
        2111111k
        2111111k
        .kkkkkk.
      `),
    ],
  },
};

/**
 * A slot sunk into the panel: a bag's cell, a counter's side, a bar's trough.
 * Dark as ink, its top and left lost in its own shadow and a lip of light on
 * the bottom and right, where the panel's face turns down into it.
 */
export const SLOT: SpriteDef = {
  id: 'frame-slot',
  kind: 'frame',
  width: 8,
  height: 8,
  legend: { k: 'ink.0', l: 'ink.2' },
  animations: {
    still: [
      grid(`
        kkkkkkk.
        kkkkkkkl
        kkkkkkkl
        kkkkkkkl
        kkkkkkkl
        kkkkkkkl
        kkkkkkkl
        .lllllll
      `),
    ],
  },
};
