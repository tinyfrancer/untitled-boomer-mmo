import { Group, Mesh, MeshBasicMaterial, PlaneGeometry, Sprite, type Camera } from 'three';
import { disposeTree } from './dispose';
import { PALETTE } from './palette';
import { buildText } from './text';
import { barFill } from '../systems/math';

const DEFAULT_WIDTH = 56;
const DEFAULT_HEIGHT = 8;

/** How tall the name is drawn, in world units, and where it sits alone. */
const LABEL_HEIGHT = 12;
const LABEL_Y = LABEL_HEIGHT;

/**
 * The worn title, smaller than the name the way the player column's is.
 *
 * It takes roughly the line the name sits on and pushes the name up above it,
 * so what moves when a title is put on is the *name* and never the health bar
 * — the bar is the one thing here read at a glance mid-fight, and a bar that
 * jumped when a title was earned would be worse than no title.
 *
 * Stacking two sprites by half of each of their heights leaves them touching,
 * which at the distance a nameplate is actually read runs the two lines into
 * one block; `LINE_GAP` is what holds them apart, and it is the same gap that
 * keeps the title clear of the bar below it.
 */
const TITLE_HEIGHT = 9;
const LINE_GAP = 2;
const TITLE_Y = LABEL_Y + LINE_GAP;
const TITLED_LABEL_Y = TITLE_Y + (LABEL_HEIGHT + TITLE_HEIGHT) / 2 + LINE_GAP;

/**
 * The player's pool, hung under the health bar.
 *
 * Below rather than above, and thinner: it is the second thing read there, and
 * everything already stacked *over* the plate — the name, the title, the marker
 * — would have to move for a bar inserted between them and the health bar. It
 * is also the only line here that can be absent on a plate that has one, since
 * a warrior has no pool at all.
 */
const MANA_HEIGHT = 4;
const MANA_GAP = 2;

/**
 * The glyph above the name, whose middle sits half of each of the two lines
 * above the name's own — wherever the name has ended up.
 *
 * Twice the name's height rather than a little over it. A single "!" is a thin
 * stroke where a word is a block of them, so a marker sized to match the name
 * beneath it reads as punctuation on the end of it instead of as its own thing.
 */
const MARKER_HEIGHT = 24;

/**
 * Anything drawn over a creature's head: the health bar and the floating name.
 *
 * It is a billboard — turned to face the camera every frame rather than lying
 * flat in the world — because PR 16 makes the camera rotatable and a bar you
 * can read only from due south is worse than no bar. It also ignores depth: a
 * health bar hidden behind the tree you are fighting beside is a bug, not
 * occlusion.
 */
export interface NameplateOptions {
  width?: number;
  height?: number;
  /** A shopkeeper and a signpost carry a name and nothing to lose. */
  healthBar?: boolean;
  /** Only the player has a pool, and only some classes have one at all. */
  manaBar?: boolean;
}

export class Nameplate {
  readonly object = new Group();
  private readonly fill: Mesh | null = null;
  private readonly mana: Group | null = null;
  private readonly manaFill: Mesh | null = null;
  private readonly width: number;
  private label: Sprite | null = null;
  private labelText = '';
  private labelColor = '';
  private marker: Sprite | null = null;
  private markerGlyph: string | null = null;
  private markerColor = '';
  private title: Sprite | null = null;
  private titleText: string | null = null;

  constructor(y: number, options: NameplateOptions = {}) {
    const {
      width = DEFAULT_WIDTH,
      height = DEFAULT_HEIGHT,
      healthBar = true,
      manaBar = false,
    } = options;
    this.width = width;
    this.object.position.y = y;

    if (healthBar) {
      const background = bar(width, height, PALETTE.barBackground, 0.55);
      this.fill = bar(1, 1, PALETTE.barFill, 1);
      this.fill.scale.set(width, height, 1);
      // Just in front of the backing, so the two do not fight over the same pixel.
      this.fill.position.z = 0.05;
      this.object.add(background, this.fill);
    }

    if (manaBar) {
      this.mana = new Group();
      this.mana.position.y = -(height + MANA_HEIGHT) / 2 - MANA_GAP;
      const background = bar(width, MANA_HEIGHT, PALETTE.barBackground, 0.55);
      this.manaFill = bar(1, 1, PALETTE.barMana, 1);
      this.manaFill.scale.set(width, MANA_HEIGHT, 1);
      this.manaFill.position.z = 0.05;
      this.mana.add(background, this.manaFill);
      this.object.add(this.mana);
    }
  }

  setHealth(hp: number, maxHp: number): void {
    this.drain(this.fill, hp, maxHp);
  }

  /** A class with no pool hides the bar outright, as the HUD's column does. */
  setMana(mana: number, maxMana: number): void {
    if (!this.mana) return;
    this.mana.visible = maxMana > 0;
    this.drain(this.manaFill, mana, maxMana);
  }

  private drain(fill: Mesh | null, value: number, max: number): void {
    if (!fill) return;
    const ratio = barFill(value, max);
    fill.scale.x = this.width * ratio;
    // Scaling a centred plane eats both ends; what is missing has to come off
    // the right only, so the bar drains the way every health bar drains.
    fill.position.x = -(this.width * (1 - ratio)) / 2;
    fill.visible = ratio > 0;
  }

  /** Rebuilds the name only when it actually changed: each one bakes a texture. */
  setLabel(text: string, color: string): void {
    if (text === this.labelText && color === this.labelColor) return;
    this.labelText = text;
    this.labelColor = color;
    this.label = this.rehang(this.label, text, color, LABEL_HEIGHT, 'label');
    this.relayout();
  }

  /**
   * The glyph over the name, or `null` for none. Same rebuild-on-change rule as
   * the label, and for the same reason: this is polled once a frame.
   *
   * It is tagged `marker` rather than `label` because `drawnCounts` counts one
   * label per drawn creature and `scripts/smoke.mjs` asserts that total in every
   * zone — a second sprite calling itself a label would break the invariant
   * everywhere. Its own kind keeps that true and gives the marker its own count.
   */
  setMarker(glyph: string | null, color: string): void {
    if (glyph === this.markerGlyph && color === this.markerColor) return;
    this.markerGlyph = glyph;
    this.markerColor = color;
    this.marker = this.rehang(this.marker, glyph, color, MARKER_HEIGHT, 'marker');
    this.relayout();
  }

  /**
   * The worn title under the name, or `null` for none. Tagged `title` for the
   * same reason the marker is tagged `marker`.
   *
   * Putting one on moves the name rather than the bar, so this is the one setter
   * that has to lay the plate out again — which is why all three of them do.
   */
  setTitle(text: string | null, color: string): void {
    if (text === this.titleText) return;
    this.titleText = text;
    this.title = this.rehang(this.title, text, color, TITLE_HEIGHT, 'title');
    this.relayout();
  }

  setVisible(visible: boolean): void {
    this.object.visible = visible;
  }

  /** Turns to face the camera. Called once a frame, by whatever is drawing. */
  faceCamera(camera: Camera): void {
    this.object.quaternion.copy(camera.quaternion);
  }

  dispose(): void {
    disposeTree(this.object);
  }

  /**
   * Swaps one of the three lines for a freshly baked one, handing the old one's
   * texture back. `null` text leaves nothing behind, which is how a marker or a
   * title is taken off.
   */
  private rehang(
    current: Sprite | null,
    text: string | null,
    color: string,
    height: number,
    kind: string,
  ): Sprite | null {
    if (current) disposeTree(current);
    if (!text) return null;
    const sprite = buildText(text, color, height);
    if (!sprite) return null;
    sprite.renderOrder = 11;
    sprite.userData.kind = kind;
    this.object.add(sprite);
    return sprite;
  }

  /**
   * Stacks whatever lines exist. Only the name and the marker move — the title
   * takes the name's own line and the bar never budges, so the thing read at a
   * glance mid-fight stays where the eye already is.
   */
  private relayout(): void {
    const labelY = this.title ? TITLED_LABEL_Y : LABEL_Y;
    if (this.title) this.title.position.y = TITLE_Y;
    if (this.label) this.label.position.y = labelY;
    if (this.marker) {
      this.marker.position.y = labelY + (LABEL_HEIGHT + MARKER_HEIGHT) / 2 + LINE_GAP;
    }
  }
}

function bar(width: number, height: number, color: number, opacity: number): Mesh {
  const mesh = new Mesh(
    new PlaneGeometry(width, height),
    new MeshBasicMaterial({ color, transparent: true, opacity, depthTest: false }),
  );
  mesh.renderOrder = 10;
  return mesh;
}

/**
 * The name over a creature's head is the only text in the 3D client counted as
 * a `label` by `drawnCounts`. A damage number is the same machinery and
 * deliberately not counted, and so are the title and the quest marker: a label
 * is furniture the view owes every creature, and the rest are not.
 */
