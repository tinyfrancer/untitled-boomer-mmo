import { el, place } from './dom';
import { footprintFill, markerColor, svgEl, terrainRect } from './mapArt';
import { ZONES } from '../data/zones';
import { conColor } from '../systems/EnemySystem';
import {
  MINIMAP_TILES,
  minimapOrigin,
  onMinimapRim,
  zoneMap,
  type MapMarker,
  type ZoneMap,
} from '../systems/MapSystem';
import { MINIMAP_MAP_SIZE, type Rect } from '../ui/layout';
import { THEME, cssColor } from '../ui/theme';
import type { CreatureDot, TilePoint } from '../ui/uiEvents';
import type { ZoneEdge, ZoneId } from '../types/ids';

/** The minimap's pixels to a tile, which every size below is counted in. */
const TILE = THEME.minimap.tile;
const INK = cssColor(THEME.inkLine);

// How big each thing is drawn, in the minimap's own pixels. A node lies on the
// ground and is the smallest; a person is a size up; what moves wears a ring of
// ink, which is what tells a creature from the tree it is standing by when the
// two are the same green; and a boss is the size up again.
const NODE_PX = 2;
const PERSON_PX = 3;
const CREATURE_PX = 3;
const BOSS_PX = 5;
/** How far in from the rim an exit off the window is drawn, in tiles. */
const EXIT_INSET = 1;

/**
 * A box `width` by `height` pixels centred on a point in tiles, held to the
 * minimap's pixels: at four to a tile, a box left where the arithmetic put it
 * is a blur across two.
 */
function box(at: TilePoint, width: number, height: number, fill: string): SVGRectElement {
  return svgEl('rect', {
    x: Math.round(at.x * TILE - width / 2) / TILE,
    y: Math.round(at.y * TILE - height / 2) / TILE,
    width: width / TILE,
    height: height / TILE,
    fill,
  });
}

/** A square with a pixel of ink round it, grouped under what it stands for. */
function ringed(at: TilePoint, size: number, fill: string, kind: string): SVGGElement {
  const group = svgEl('g', { 'data-minimap': kind });
  group.append(box(at, size + 2, size + 2, INK), box(at, size, size, fill));
  return group;
}

// An exit's arrow, pointing north, as runs of pixels a row: [row, first, last]
// from its middle. The fill is a triangle five wide, and the ink a pixel round
// it, which is what keeps a gold arrow off the gold of a person or a creature.
const ARROW_FILL: [number, number, number][] = [
  [-1, 0, 0],
  [0, -1, 1],
  [1, -2, 2],
];
const ARROW_INK: [number, number, number][] = [
  [-2, 0, 0],
  [-1, -1, 1],
  [0, -2, 2],
  [1, -3, 3],
  [2, -3, 3],
];

/**
 * An exit: an arrow pointing off the edge it leaves by, the one question about
 * an exit the minimap has room to answer. The name is on the zone map and in a
 * hover's title.
 */
function arrow(at: TilePoint, edge: ZoneEdge, fill: string): SVGGElement {
  const cx = Math.round(at.x * TILE);
  const cy = Math.round(at.y * TILE);
  // A run along the arrow's width, turned from pointing north to the edge.
  const run = ([row, first, last]: [number, number, number], colour: string): SVGRectElement => {
    const across = last - first + 1;
    const turned: Record<ZoneEdge, [number, number, number, number]> = {
      north: [first, row, across, 1],
      south: [first, -row, across, 1],
      east: [-row, first, 1, across],
      west: [row, -last, 1, across],
    };
    const [x, y, width, height] = turned[edge];
    return svgEl('rect', {
      x: (cx + x) / TILE,
      y: (cy + y) / TILE,
      width: width / TILE,
      height: height / TILE,
      fill: colour,
    });
  };
  const group = svgEl('g', { 'data-minimap': 'exit', 'data-edge': edge });
  group.append(
    ...ARROW_INK.map((row) => run(row, INK)),
    ...ARROW_FILL.map((row) => run(row, fill)),
  );
  return group;
}

/** The player: a cross, the one shape on the minimap nothing else is drawn as. */
function you(at: TilePoint): SVGGElement {
  const group = svgEl('g', { 'data-minimap': 'player' });
  group.append(
    box(at, 3, 7, INK),
    box(at, 7, 3, INK),
    box(at, 1, 5, THEME.color.text),
    box(at, 5, 1, THEME.color.text),
  );
  return group;
}

export interface MinimapOptions {
  /** The character's level, which each creature's colour is worked out against. */
  level: number;
  /** A tap: the zone map, which is where the names are. */
  onOpen: () => void;
}

/**
 * The minimap (decision 115): the zone map's drawing, windowed round the
 * player, with the creatures near them on it as they move.
 *
 * Everything but the creatures and the player is the zone map's own
 * (`zoneMap()`, drawn alike through `mapArt.ts`), so the two cannot disagree
 * about where a tree is. The ground, the buildings, the nodes and the people
 * are drawn once a zone and the window moved over them on each tile crossing,
 * as the map sheet moves its dot; the exits are drawn again with it, since one
 * off the window is drawn on its rim in the direction of the road.
 *
 * The creatures are the one thing on the HUD's side that moves on its own, and
 * they arrive the way the player does, on a tile crossing (`creatures-changed`),
 * only those the window can show. Each is drawn in the colour its name is over
 * its head, worked out here against the character's level, so a level earned
 * mid-fight turns the dots green without the world saying anything.
 *
 * It is a button, and a tap opens the zone map on this zone, where the names
 * are: at four pixels a tile there is no room to write one.
 */
export class Minimap {
  readonly root: HTMLButtonElement;
  private readonly svg: SVGSVGElement;
  private readonly ground: SVGGElement;
  private readonly exits: SVGGElement;
  private readonly creatures: SVGGElement;
  private readonly player: SVGGElement;
  private readonly name: HTMLElement;
  private map: ZoneMap | null = null;
  private tile: TilePoint | null = null;
  private dots: CreatureDot[] = [];
  private level: number;

  constructor(options: MinimapOptions) {
    this.level = options.level;
    this.root = el('button', 'hud-panel hud-minimap');
    this.root.type = 'button';
    this.root.dataset.action = 'open-map';
    this.root.title = 'Open the map';
    this.svg = svgEl('svg', {
      class: 'hud-minimap__map',
      width: MINIMAP_MAP_SIZE,
      height: MINIMAP_MAP_SIZE,
      viewBox: `0 0 ${MINIMAP_TILES} ${MINIMAP_TILES}`,
      'aria-hidden': 'true',
    });
    this.ground = svgEl('g', {});
    this.exits = svgEl('g', {});
    this.creatures = svgEl('g', {});
    this.player = svgEl('g', {});
    this.svg.append(this.ground, this.exits, this.creatures, this.player);
    this.name = el('div', 'hud-minimap__name');
    this.root.append(this.svg, this.name);
    this.root.addEventListener('click', () => options.onOpen());
  }

  layout(rect: Rect): void {
    place(this.root, rect, 'box');
  }

  /** Up or down, as the character's switch in Options says. */
  setShown(shown: boolean): void {
    this.root.classList.toggle('hud-hidden', !shown);
  }

  /** Draws the zone's ground and what stands on it; only a zone change may call this. */
  setZone(zoneId: ZoneId): void {
    if (this.map?.zoneId === zoneId) return;
    const map = zoneMap(zoneId);
    this.map = map;
    this.name.textContent = map.name;
    this.root.setAttribute('aria-label', `${map.name}: open the map`);
    // The last zone's creatures and position are not this one's, and the first
    // frame of the new world says what is.
    this.dots = [];
    this.tile = null;

    const { setting } = ZONES[zoneId];
    const ground: SVGElement[] = map.terrain.map((band) => terrainRect(band, setting));
    for (const building of map.buildings) {
      ground.push(
        svgEl('rect', {
          x: building.x,
          y: building.y,
          width: building.width,
          height: building.height,
          fill: footprintFill(setting),
          'data-minimap': 'building',
        }),
      );
    }
    for (const marker of map.markers) {
      if (marker.kind === 'exit') continue;
      const size = marker.kind === 'node' ? NODE_PX : PERSON_PX;
      const drawn = box(marker, size, size, markerColor(marker));
      drawn.setAttribute('data-minimap', marker.kind);
      ground.push(drawn);
    }
    this.ground.replaceChildren(...ground);
    this.draw();
  }

  setPlayerTile(tile: TilePoint): void {
    this.tile = tile;
    this.draw();
  }

  setCreatures(dots: CreatureDot[]): void {
    this.dots = dots;
    this.drawCreatures();
  }

  /** A level moves every creature's colour against it. */
  setLevel(level: number): void {
    if (level === this.level) return;
    this.level = level;
    this.drawCreatures();
  }

  /**
   * Moves the window to the player and puts them in the middle of it. Nothing
   * is drawn round a player who has not been placed yet: a cross in the corner
   * of the zone would read as a position.
   */
  private draw(): void {
    const { map, tile } = this;
    if (!map || !tile) {
      this.exits.replaceChildren();
      this.player.replaceChildren();
      this.creatures.replaceChildren();
      return;
    }
    const origin = minimapOrigin(tile, TILE);
    this.svg.setAttribute('viewBox', `${origin.x} ${origin.y} ${MINIMAP_TILES} ${MINIMAP_TILES}`);
    this.exits.replaceChildren(
      ...map.markers
        .filter((marker) => marker.kind === 'exit')
        .map((exit) => this.exit(exit, tile)),
    );
    this.player.replaceChildren(you(tile));
    this.drawCreatures();
  }

  private exit(exit: MapMarker, center: TilePoint): SVGGElement {
    const at = onMinimapRim(exit, center, EXIT_INSET);
    const drawn = arrow(at, exit.edge ?? 'north', markerColor(exit));
    if (at.onRim) drawn.setAttribute('data-rim', 'true');
    const title = svgEl('title', {});
    title.textContent = exit.label;
    drawn.append(title);
    return drawn;
  }

  private drawCreatures(): void {
    if (!this.map || !this.tile) return;
    this.creatures.replaceChildren(
      ...this.dots.map((dot) =>
        ringed(
          dot,
          dot.boss ? BOSS_PX : CREATURE_PX,
          conColor(this.level, dot.level),
          dot.boss ? 'boss' : 'creature',
        ),
      ),
    );
  }
}
