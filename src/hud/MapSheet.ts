import { Sheet } from './Sheet';
import { el } from './dom';
import { tileColor } from '../data/tiles';
import { zoneMap, type MapMarker, type ZoneMap } from '../systems/MapSystem';
import { THEME, cssColor } from '../ui/theme';
import type { TilePoint } from '../ui/uiEvents';
import type { SkillId, ZoneId } from '../types/ids';

const SVG_NS = 'http://www.w3.org/2000/svg';

// Marker sizes in tiles, since the drawing is done in tile units. A node is
// smaller than the tile it stands on so the terrain still reads under it.
const NODE_RADIUS = 0.45;
const NPC_RADIUS = 0.6;
const PLAYER_RADIUS = 0.7;
const EXIT_SIZE = 1.2;
const LABEL_HEIGHT = 1.4;

/**
 * What each marker is drawn in.
 *
 * A node is coloured by the skill that works it rather than by being a node:
 * at this size the colour is the only thing telling a tree from a fishing spot,
 * and each is a lighter shade of the ground its own kind sits on — a pale green
 * on the grass, a pale blue on the water. The gold pair are the two things that
 * are about a person rather than a resource, and they are told apart by shape.
 */
const NODE_COLOR: Partial<Record<SkillId, string>> = {
  woodcutting: THEME.color.heal,
  fishing: THEME.color.skillUp,
};
const MARKER_COLOR: Record<MapMarker['kind'], string> = {
  node: THEME.color.skillUp,
  npc: THEME.color.levelUp,
  exit: THEME.color.levelUp,
};

function markerColor(marker: MapMarker): string {
  return (marker.skill && NODE_COLOR[marker.skill]) || MARKER_COLOR[marker.kind];
}

/**
 * Which way a label runs from the marker it hangs under.
 *
 * Centred in the middle of the map and turned inward at either end, so a
 * destination name always runs *into* the map: "Bandit Camp" centred on an exit
 * a tile from the east edge is half off the sheet, and the exits are the one
 * thing on here that sit against an edge by definition.
 */
function labelAnchor(x: number, columns: number): string {
  if (x < columns / 3) return 'start';
  if (x > (columns * 2) / 3) return 'end';
  return 'middle';
}

function buildMarker(marker: MapMarker, columns: number): SVGElement[] {
  const color = markerColor(marker);
  if (marker.kind === 'exit') {
    // A square with the name of where it goes under it: on a map, which way out
    // leads where is the whole question.
    const label = svgEl('text', {
      x: marker.x,
      y: marker.y + EXIT_SIZE,
      class: 'hud-map__label',
      'font-size': LABEL_HEIGHT,
      'text-anchor': labelAnchor(marker.x, columns),
      fill: color,
    });
    label.textContent = marker.label;
    return [
      svgEl('rect', {
        x: marker.x - EXIT_SIZE / 2,
        y: marker.y - EXIT_SIZE / 2,
        width: EXIT_SIZE,
        height: EXIT_SIZE,
        fill: color,
        'data-marker': marker.kind,
      }),
      label,
    ];
  }

  const dot = svgEl('circle', {
    cx: marker.x,
    cy: marker.y,
    r: marker.kind === 'npc' ? NPC_RADIUS : NODE_RADIUS,
    fill: color,
    'data-marker': marker.kind,
  });
  // Named for the one player who has a pointer to hover with; a phone reads it
  // off where the dot is and what colour it is.
  const title = svgEl('title', {});
  title.textContent = marker.label;
  dot.append(title);
  return [dot];
}

function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attributes: Record<string, string | number>,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) {
    node.setAttribute(name, String(value));
  }
  return node;
}

/**
 * The zone map, opened from the Menu.
 *
 * Everything on it except the dot is a pure function of the zone's id
 * (`systems/MapSystem.ts`), so the HUD draws it having been told nothing but
 * which zone is running — the terrain, the exits and what is worth walking to
 * all come out of the same tables the world was built from, and the map cannot
 * disagree with where things actually stand.
 *
 * There are no mobs on it, deliberately. They wander, so drawing them means
 * feeding a moving position to the HUD every frame, and a map of where the rats
 * were a second ago is worse than a map with no rats on it. There is no
 * tap-to-travel either: this tells you where things are, and walking there is
 * still the game.
 *
 * The terrain is rebuilt only when the zone changes and the dot is moved on its
 * own — which is why the two arrive as separate events rather than as one
 * position that would redraw four hundred rectangles on every tile crossing.
 */
export class MapSheet extends Sheet {
  private readonly figure: HTMLElement;
  private svg: SVGSVGElement | null = null;
  private dot: SVGCircleElement | null = null;
  private drawn: ZoneId | null = null;
  private map: ZoneMap | null = null;
  private tile: TilePoint | null = null;

  constructor() {
    super('Map', THEME.panelWidth.map, 'hud-sheet--map');
    this.figure = el('div', 'hud-map');
    this.body.append(this.figure);
  }

  /** Rebuilds the whole thing; only a zone change may call this. */
  setZone(zoneId: ZoneId): void {
    if (zoneId === this.drawn) return;
    this.drawn = zoneId;
    this.map = zoneMap(zoneId);
    this.setTitle(this.map.name);
    this.build(this.map);
    // A zone walk puts the player somewhere new, and the dot from the last one
    // is not where they are — but the tile event that says so is published by
    // the same frame, so this only has to not draw a stale one.
    this.moveDot();
  }

  setPlayerTile(tile: TilePoint): void {
    this.tile = tile;
    this.moveDot();
  }

  private build(map: ZoneMap): void {
    const svg = svgEl('svg', {
      viewBox: `0 0 ${map.columns} ${map.rows}`,
      class: 'hud-map__svg',
      // Drawn in tile units, so a tile is one unit and everything on it is
      // sized in fractions of one.
      preserveAspectRatio: 'xMidYMid meet',
    });

    for (const band of map.terrain) {
      svg.append(
        svgEl('rect', {
          x: band.x,
          y: band.y,
          width: band.width,
          height: 1,
          fill: cssColor(tileColor(band.tile)),
        }),
      );
    }

    for (const marker of map.markers) {
      svg.append(...buildMarker(marker, map.columns));
    }

    // Last, so nothing is ever drawn over the one thing that moves. Hidden
    // until a tile actually arrives: a dot parked in the map's corner would
    // read as a position rather than as an absence.
    this.dot = svgEl('circle', {
      cx: 0,
      cy: 0,
      r: PLAYER_RADIUS,
      class: 'hud-map__player',
      fill: THEME.color.text,
      stroke: '#000000',
      'stroke-width': 0.25,
      visibility: 'hidden',
    });
    svg.append(this.dot);

    this.svg = svg;
    this.figure.replaceChildren(svg);
  }

  private moveDot(): void {
    if (!this.dot || !this.tile || !this.svg) return;
    this.dot.setAttribute('cx', String(this.tile.x));
    this.dot.setAttribute('cy', String(this.tile.y));
    this.dot.setAttribute('visibility', 'visible');
  }
}
