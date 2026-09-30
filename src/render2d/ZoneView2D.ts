import { creatureSprite, npcSprite } from '../art/cast';
import { PLAYER_SPRITE, playerSprite } from '../art/outfit';
import { SETTING_PALETTES, SHARED_RAMPS } from '../art/palette';
import { ART_PIXEL } from '../art/budget';
import { PLACEHOLDERS } from '../art/index';
import { SIGNPOST } from '../art/sprites/props';
import { TILE_SIZE } from '../config/constants';
import { ABILITIES } from '../data/abilities';
import { buildingRect, occupant } from '../data/buildings';
import { npcName } from '../data/npcs';
import { titleName } from '../systems/AchievementSystem';
import { bountyMarker } from '../systems/BountySystem';
import { conColor, enemyDisplayName } from '../systems/EnemySystem';
import { barFill } from '../systems/math';
import { npcMarker, strongerMarker } from '../systems/QuestSystem';
import { GatherBeat } from '../ui/gatherBeat';
import { FLOAT_TONE_COLORS, QUEST_MARKER_STYLE, THEME } from '../ui/theme';
import type { ZoneView } from '../host/zoneView';
import type { Point } from '../systems/MovementSystem';
import type { DrawnCounts, PlayerFigure } from '../types/debugView';
import type { ZoneSetting } from '../types/ids';
import type { Mob } from '../world/Mob';
import type { FloatTone, WorldEvent } from '../world/worldEvents';
import type { WorldTap, ZoneWorld } from '../world/ZoneWorld';
import { Motion, deathPose, frameIndex, playMs, type Pose } from './animation';
import { BuildingSprite } from './buildings';
import { Camera2D } from './camera';
import { CanvasPool } from './canvases';
import { LANTERN, Lantern } from './lantern';
import { pickScene, pickTap } from './picking';
import { SpriteSheet } from './sheet';
import { BakedGround, HAZE } from './terrain';
import { TextCache } from './text';

/** Art pixels between the top of what a thing is drawn as and the plate over it. */
const PLATE_GAP = 2;
/** A health bar over a head, in art pixels, and the player's, which is wider. */
const BAR_WIDTH = 20;
const PLAYER_BAR_WIDTH = 26;
const BAR_HEIGHT = 2;

/** How long a floating number lives and how far it climbs, in art pixels. */
const FLOAT_MS = 600;
const FLOAT_RISE = 16;
/** How long an arrow and a bolt take to cross, the 3D view's numbers. */
const ARROW_MS = 140;
const BOLT_MS = 250;

/** How long a corpse lies after its fall before it is gone, fading as it goes. */
const CORPSE_FADE_MS = 300;

/** A loot pile's last ten seconds, blinking: the 3D view's rule (`docs/decisions.md` 66). */
const PILE_BLINK_FROM_MS = 10_000;
const PILE_BLINK_MS = 250;

/** How dark a contact shadow is laid down. */
const SHADOW_ALPHA = 0.35;

/**
 * How far the corners of the screen fall into shadow, and how far from the
 * middle the falling starts: enough to give a scene weight, not so much that
 * anything tappable goes dark (decision 103).
 */
const VIGNETTE_DARK = 0.5;
const VIGNETTE_FROM = 0.45;

const PROP = PLACEHOLDERS.prop.id;
const EFFECT = PLACEHOLDERS.effect.id;

function css(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

/** A moment being drawn out over the frames after it: a number rising, an arrow flying. */
interface Effect {
  kind: 'float' | 'projectile' | 'burst';
  from: Point;
  to: Point;
  text: string;
  colour: string;
  lift: number;
  lifeMs: number;
  // Null until the first frame that draws it, which is when its clock starts:
  // on a phone taking 150ms a frame an arrow dated to the frame before it was
  // born would be retired without ever being drawn (`rendering.md`).
  bornAt: number | null;
}

/** Something standing, to be drawn in order of where its feet are. */
interface Standing {
  baseY: number;
  draw: () => void;
}

/**
 * The 2D view onto one ZoneWorld: version 2's pixel art, drawn with Canvas 2D
 * at art resolution into a canvas the page scales up by whole device pixels
 * (`docs/decisions.md` 101, `docs/architecture/art.md`).
 *
 * The game's view since phase B3 (decision 106): every zone's ground with its
 * edges, scatter and the lantern underground, the three classes, the
 * shopkeeper, the rat and a building kit drawn for real, and everything else
 * as its kind's placeholder until B4 to B6 draw it.
 *
 * It holds no scene. Every frame is drawn from the world as it stands, in
 * painter's order — the ground, the shadows, everything standing sorted by
 * where its feet are, the moments, then the words — so there is nothing to
 * leak but canvases, which are all made through one pool and counted.
 */
export class ZoneView2D implements ZoneView {
  readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly parent: HTMLElement;
  private readonly camera = new Camera2D();
  private readonly pool = new CanvasPool();
  // The session's, one a setting: the same sheet serves every zone in the same light.
  private readonly sheets = new Map<ZoneSetting, SpriteSheet>();
  private sheet: SpriteSheet | null = null;
  // The player as they are dressed, and what they were dressed in when it was
  // made: compiled again when that changes, and kept across zones, since a
  // person looks the same in every light (only the ground's ramps differ).
  private figure: { wearing: string; sheet: SpriteSheet } | null = null;
  private world: ZoneWorld | null = null;
  private setting: ZoneSetting = 'open';
  private ground: BakedGround | null = null;
  private text: TextCache | null = null;
  private buildings: BuildingSprite[] = [];
  private shadows = new Map<number, HTMLCanvasElement>();
  private ring: HTMLCanvasElement | null = null;
  // Underground only: the light the player carries.
  private lantern: Lantern | null = null;
  // The view's own and the screen's size, made again when the screen changes shape.
  private vignette: HTMLCanvasElement | null = null;
  private readonly playerMotion = new Motion();
  private mobMotions = new Map<Mob, Motion>();
  private effects: Effect[] = [];
  private readonly gatherBeat = new GatherBeat();
  private playerPose: Pose = { animation: 'idle', facing: 'down', index: 0 };
  private readonly startedAt = performance.now();

  constructor(parent: HTMLElement) {
    this.parent = parent;
    this.canvas = document.createElement('canvas');
    const context = this.canvas.getContext('2d');
    if (!context) throw new Error('this browser has no 2D canvas');
    this.context = context;
    // At the parent's corner, so a CSS pixel on the canvas is one on the page,
    // and a hair larger than the screen when the art pixels do not divide it:
    // the overhang is cut off by the page rather than the pixels stretched.
    this.canvas.style.position = 'absolute';
    this.canvas.style.left = '0';
    this.canvas.style.top = '0';
    this.canvas.style.display = 'block';
    this.canvas.style.imageRendering = 'pixelated';
    // The 3D view's policy and for its reasons: a one-finger drag and a double
    // tap are the game's, a two-finger pinch is left to the browser.
    this.canvas.style.touchAction = 'pinch-zoom';
    parent.appendChild(this.canvas);
    this.resize();
  }

  build(world: ZoneWorld): void {
    this.world = world;
    this.setting = world.zone.setting;
    let sheet = this.sheets.get(this.setting);
    if (!sheet) {
      sheet = new SpriteSheet(this.pool, this.setting);
      this.sheets.set(this.setting, sheet);
    }
    this.sheet = sheet;
    // Nothing strewn on a building's footprint, whose floor it would show through.
    const floors = world.buildings.map(buildingRect);
    this.ground = new BakedGround(this.pool, sheet, world.zone.map, this.setting, (x, y, w, h) =>
      floors.some(
        (rect) =>
          (x + w) * ART_PIXEL > rect.left &&
          x * ART_PIXEL < rect.right &&
          (y + h) * ART_PIXEL > rect.top &&
          y * ART_PIXEL < rect.bottom,
      ),
    );
    this.text = new TextCache(this.pool);
    this.buildings = world.buildings.map(
      (building) =>
        new BuildingSprite(building, occupant(building, world.npcs), (picture) =>
          this.pool.fromPixels(picture.width, picture.height, picture.pixels),
        ),
    );
    this.mobMotions = new Map(
      world.mobs.map((mob) => [mob, new Motion((mob.spawnX * 7 + mob.spawnY * 13) % 1000)]),
    );
    this.lantern = this.setting === 'underground' ? new Lantern(this.pool) : null;
    this.camera.follow(world.player);
  }

  teardown(): void {
    this.ground?.release();
    this.ground = null;
    this.text?.clear();
    this.text = null;
    this.buildings.forEach((building) =>
      building.canvases().forEach((canvas) => this.pool.release(canvas)),
    );
    this.buildings = [];
    // The shadows are cut in the setting's shadow colour, so they go with the zone.
    for (const shadow of this.shadows.values()) this.pool.release(shadow);
    this.shadows = new Map();
    this.pool.release(this.ring);
    this.ring = null;
    this.lantern?.release();
    this.lantern = null;
    this.mobMotions = new Map();
    this.effects = [];
    this.gatherBeat.reset();
    this.world = null;
  }

  dispose(): void {
    this.teardown();
    this.pool.release(this.vignette);
    this.vignette = null;
    this.pool.release(this.figure?.sheet.canvas ?? null);
    this.figure = null;
    for (const sheet of this.sheets.values()) this.pool.release(sheet.canvas);
    this.sheets.clear();
    this.sheet = null;
    this.canvas.remove();
  }

  resize(): void {
    this.camera.resize({
      width: this.parent.clientWidth,
      height: this.parent.clientHeight,
      dpr: window.devicePixelRatio || 1,
    });
    this.canvas.width = this.camera.artWidth;
    this.canvas.height = this.camera.artHeight;
    this.canvas.style.width = `${this.camera.artWidth * this.camera.cssPerArt}px`;
    this.canvas.style.height = `${this.camera.artHeight * this.camera.cssPerArt}px`;
    // Resizing a canvas resets its context, smoothing included.
    this.context.imageSmoothingEnabled = false;
    this.pool.release(this.vignette);
    this.vignette = this.shade(this.camera.artWidth, this.camera.artHeight);
  }

  /** A 2D camera never turns: north is always up the screen, and a drag asks for nothing. */
  orbitBy(): void {}

  cameraYaw(): number {
    return 0;
  }

  draw(events: readonly WorldEvent[]): void {
    const world = this.world;
    if (!world) return;
    const now = this.now();
    for (const event of events) {
      switch (event.kind) {
        case 'swing': {
          const by = event.by;
          if (by)
            this.mobMotions.get(by)?.strike(now, event.toward.x - by.x, event.toward.y - by.y);
          else
            this.playerMotion.strike(
              now,
              event.toward.x - world.player.x,
              event.toward.y - world.player.y,
            );
          break;
        }
        case 'shot':
          this.playerMotion.strike(
            now,
            event.to.x - world.player.x,
            event.to.y - world.player.y,
            'shoot',
          );
          this.effect('projectile', event.from, event.to, ARROW_MS);
          break;
        case 'bolt-cast':
          // A creature's throw is already its swing; the player's is a spell.
          if (Object.hasOwn(ABILITIES, event.abilityId)) {
            this.playerMotion.strike(
              now,
              event.to.x - world.player.x,
              event.to.y - world.player.y,
              'cast',
            );
          }
          this.effect('projectile', event.from, event.to, BOLT_MS);
          break;
        case 'hit': {
          if (event.mob) this.mobMotions.get(event.mob)?.flinch(now);
          else if (event.damage > event.absorbed) this.playerMotion.flinch(now);
          if (event.absorbed > 0) this.float(event.at, `(${event.absorbed} absorbed)`, 'skill', 10);
          if (event.damage > event.absorbed) {
            const shown = event.on === 'player' ? event.damage - event.absorbed : event.damage;
            const tone: FloatTone = event.crit
              ? 'crit'
              : event.via === 'ability'
                ? 'reward'
                : event.on === 'player'
                  ? 'player-damage'
                  : 'damage';
            this.float(event.at, event.crit ? `-${shown}!` : `-${shown}`, tone);
          }
          break;
        }
        case 'gather-tick':
          if (this.gatherBeat.beat(event.progress)) {
            this.playerMotion.strike(now, event.at.x - world.player.x, event.at.y - world.player.y);
          }
          break;
        case 'defend':
          this.float(event.at, event.skillName, 'heal');
          break;
        case 'heal':
          this.float(event.at, `+${event.amount}`, 'heal');
          break;
        case 'float':
          this.float(event.at, event.text, event.tone);
          break;
        case 'level-up':
          this.effect('burst', event.at, event.at, playMs(PLACEHOLDERS.effect, 'play'));
          break;
        default:
          break;
      }
    }
  }

  render(): void {
    const context = this.context;
    context.fillStyle = HAZE[this.setting];
    context.fillRect(0, 0, this.canvas.width, this.canvas.height);
    const world = this.world;
    const sheet = this.sheet;
    if (!world || !sheet || !this.ground || !this.text) return;
    const now = this.now();
    const camera = this.camera;
    camera.follow(world.player);
    const { left, top } = camera;
    const at = (x: number, y: number): Point => camera.toCanvas(x, y);

    this.buildings.forEach((building) => building.sync(world.player));
    this.ground.draw(context, camera, now);
    this.buildings.forEach((building) => building.drawFloor(context, left, top));

    // What everything stands on: a shadow under it, and a ring under the target.
    const shadowAt = (x: number, y: number, width: number): void => {
      const shadow = this.shadow(width);
      const p = at(x, y);
      context.globalAlpha = SHADOW_ALPHA;
      context.drawImage(
        shadow,
        p.x - Math.floor(shadow.width / 2),
        p.y - Math.floor(shadow.height / 2) - 1,
      );
      context.globalAlpha = 1;
    };
    const target = world.target;
    if (target?.isAlive()) {
      const ring = this.selectionRing();
      const p = at(target.x, target.y);
      context.drawImage(
        ring,
        p.x - Math.floor(ring.width / 2),
        p.y - Math.floor(ring.height / 2) - 1,
      );
    }

    const standing: Standing[] = [];
    const figure = this.dressed(world);
    const playerDef = figure.def(PLAYER_SPRITE);
    this.playerPose = this.playerMotion.pose(playerDef, now, world.player.vx, world.player.vy);
    shadowAt(world.player.x, world.player.y, 16);
    standing.push({
      baseY: world.player.y,
      draw: () => {
        const p = at(world.player.x, world.player.y);
        figure.draw(context, PLAYER_SPRITE, this.playerPose, p.x, p.y);
      },
    });

    for (const mob of world.mobs) {
      const sprite = creatureSprite(mob.definition.id, mob.definition.shape);
      const def = sheet.def(sprite);
      const motion = this.mobMotions.get(mob);
      if (mob.isAlive()) {
        shadowAt(mob.x, mob.y, def.kind === 'beast' ? 18 : 16);
        const pose = motion ? motion.pose(def, now, mob.vx, mob.vy) : deathPose(def, 0);
        standing.push({
          baseY: mob.y,
          draw: () => {
            const p = at(mob.x, mob.y);
            sheet.draw(context, sprite, pose, p.x, p.y);
          },
        });
        continue;
      }
      // The fall is read off the world's own clock, which respawns it on time
      // with nothing drawing it; how long the body lies is the view's.
      const fallen = mob.deadForMs - playMs(def, 'death');
      const alpha = 1 - Math.max(0, Math.min(1, fallen / CORPSE_FADE_MS));
      if (alpha <= 0) continue;
      const pose = deathPose(def, mob.deadForMs);
      standing.push({
        baseY: mob.y,
        draw: () => {
          const p = at(mob.x, mob.y);
          context.globalAlpha = alpha;
          sheet.draw(context, sprite, pose, p.x, p.y);
          context.globalAlpha = 1;
        },
      });
    }

    world.npcs.forEach((npc, index) => {
      const sprite = npcSprite(npc.npcId);
      const def = sheet.def(sprite);
      shadowAt(npc.x, npc.y, 16);
      const pose: Pose = {
        animation: 'idle',
        facing: 'down',
        index: frameIndex(def, 'idle', now + index * 170),
      };
      standing.push({
        baseY: npc.y,
        draw: () => {
          const p = at(npc.x, npc.y);
          sheet.draw(context, sprite, pose, p.x, p.y);
        },
      });
    });

    const still = (
      x: number,
      y: number,
      animation: 'still' | 'spent' | 'loop',
      alpha = 1,
      sprite = PROP,
    ): Standing => ({
      baseY: y,
      draw: () => {
        const p = at(x, y);
        const pose: Pose = {
          animation,
          facing: null,
          index: animation === 'loop' ? frameIndex(PLACEHOLDERS.prop, 'loop', now) : 0,
        };
        context.globalAlpha = alpha;
        sheet.draw(context, sprite, pose, p.x, p.y);
        context.globalAlpha = 1;
      },
    });
    for (const node of world.nodes) {
      shadowAt(node.x, node.y, 20);
      standing.push(still(node.x, node.y, node.isAvailable() ? 'still' : 'spent'));
    }
    for (const signpost of world.signposts) {
      shadowAt(signpost.x, signpost.y, 20);
      standing.push(still(signpost.x, signpost.y, 'still', 1, SIGNPOST.id));
    }
    for (const station of world.stations) {
      shadowAt(station.x, station.y, 20);
      standing.push(still(station.x, station.y, 'still'));
    }
    for (const pile of world.lootPiles) {
      if (pile.isGone()) continue;
      const left = pile.remainingMs;
      if (left <= PILE_BLINK_FROM_MS && Math.floor(left / PILE_BLINK_MS) % 2 === 1) continue;
      standing.push(still(pile.x, pile.y, 'still'));
    }
    const campfire = world.campfire;
    if (campfire) standing.push(still(campfire.x, campfire.y, 'loop'));

    const player = world.player;
    for (const building of this.buildings) {
      const rect = building.outsideRect();
      const behind =
        player.y < building.baseY &&
        player.x > rect.left &&
        player.x < rect.right &&
        player.y - TILE_SIZE / 2 > rect.top;
      standing.push({
        baseY: building.standingBase,
        draw: () => building.drawStanding(context, left, top, behind),
      });
    }

    standing.sort((a, b) => a.baseY - b.baseY);
    for (const thing of standing) thing.draw();

    this.drawEffects(now);
    if (this.lantern) {
      const flame = at(player.x, player.y);
      this.lantern.draw(
        context,
        flame.x,
        flame.y - LANTERN.height,
        this.canvas.width,
        this.canvas.height,
      );
    }
    // Over the world and under the words, so a name at the edge of the screen
    // reads as well as one in the middle, underground as well.
    if (this.vignette) context.drawImage(this.vignette, 0, 0);
    this.drawWords(world, sheet, figure);
    this.text.endFrame();
  }

  /**
   * The player's figure, put together from their class, their look and what
   * they have on (`art/outfit.ts`), and made again only when one of those
   * changes: a gear change is read off the world each frame, as everything
   * this view draws is, and compared rather than told.
   */
  private dressed(world: ZoneWorld): SpriteSheet {
    const { classId, look } = world.character.state;
    const gear = world.player.currentGear();
    const wearing = JSON.stringify([classId, look, gear]);
    if (this.figure?.wearing === wearing) return this.figure.sheet;
    this.pool.release(this.figure?.sheet.canvas ?? null);
    // A person is drawn only in the shared ramps, so one setting's compile
    // serves every zone.
    const sheet = new SpriteSheet(this.pool, 'open', [playerSprite(classId, look, gear)]);
    this.figure = { wearing, sheet };
    return sheet;
  }

  /** The moments in flight: projectiles, bursts, and the numbers over them. */
  private drawEffects(now: number): void {
    const sheet = this.sheet;
    const text = this.text;
    if (!sheet || !text) return;
    const context = this.context;
    this.effects = this.effects.filter((effect) => {
      effect.bornAt ??= now;
      const progress = (now - effect.bornAt) / effect.lifeMs;
      if (progress >= 1) return false;
      if (effect.kind === 'float') {
        const p = this.camera.toCanvas(effect.from.x, effect.from.y);
        const word = text.get(effect.text, effect.colour);
        context.globalAlpha = 1 - progress;
        context.drawImage(
          word,
          p.x - Math.floor(word.width / 2),
          p.y - 40 - effect.lift - Math.round(FLOAT_RISE * progress),
        );
        context.globalAlpha = 1;
        return true;
      }
      const x = effect.from.x + (effect.to.x - effect.from.x) * progress;
      const y = effect.from.y + (effect.to.y - effect.from.y) * progress;
      const p = this.camera.toCanvas(x, y);
      const pose: Pose =
        effect.kind === 'burst'
          ? {
              animation: 'play',
              facing: null,
              index: frameIndex(PLACEHOLDERS.effect, 'play', now - effect.bornAt),
            }
          : { animation: 'play', facing: null, index: 0 };
      // A projectile flies at chest height, not along the ground.
      sheet.draw(context, EFFECT, pose, p.x, p.y + (effect.kind === 'burst' ? 0 : -8));
      return true;
    });
  }

  /** Every word the world writes: the plates over heads, the signs over doors. */
  private drawWords(world: ZoneWorld, sheet: SpriteSheet, figure: SpriteSheet): void {
    const state = world.character.state;
    for (const building of this.buildings) {
      if (building.isInside) continue;
      const sign = building.signAt();
      this.word(
        building.building.definition.name,
        THEME.color.text,
        sign.x - this.camera.left,
        sign.y - this.camera.top - PLATE_GAP,
      );
    }
    for (const signpost of world.signposts) {
      this.plate(
        signpost.x,
        signpost.y,
        sheet.drawnHeight(SIGNPOST.id),
        signpost.label,
        THEME.color.levelUp,
      );
    }
    for (const npc of world.npcs) {
      const marker = strongerMarker(
        npcMarker(npc.npcId, state.quests, state),
        bountyMarker(npc.npcId, state),
      );
      const style = marker ? QUEST_MARKER_STYLE[marker] : null;
      this.plate(
        npc.x,
        npc.y,
        sheet.drawnHeight(npcSprite(npc.npcId)),
        npcName(npc.npcId),
        THEME.color.levelUp,
        {
          marker: style ?? undefined,
        },
      );
    }
    for (const mob of world.mobs) {
      if (!mob.isAlive()) continue;
      const sprite = creatureSprite(mob.definition.id, mob.definition.shape);
      this.plate(
        mob.x,
        mob.y,
        sheet.drawnHeight(sprite),
        enemyDisplayName(mob.definition, mob.level),
        conColor(state.level, mob.level),
        { health: [mob.hp, mob.maxHp] },
      );
    }
    const player = world.player;
    this.plate(
      player.x,
      player.y,
      figure.drawnHeight(PLAYER_SPRITE),
      player.name,
      THEME.color.text,
      {
        health: [player.hp, player.maxHp],
        mana: player.maxMana > 0 ? [player.mana, player.maxMana] : undefined,
        title: state.activeTitleId ? titleName(state.activeTitleId) : undefined,
        barWidth: PLAYER_BAR_WIDTH,
      },
    );
  }

  /**
   * A plate over a head, stacked up from the bars: the mana under the health,
   * the name over it, and a title or a marker over that. The health bar is the
   * one thing on a plate that must not move, being what is read mid-fight.
   */
  private plate(
    x: number,
    y: number,
    height: number,
    name: string,
    colour: string,
    extra: {
      health?: [number, number];
      mana?: [number, number];
      title?: string;
      marker?: { glyph: string; color: string };
      barWidth?: number;
    } = {},
  ): void {
    const context = this.context;
    const p = this.camera.toCanvas(x, y);
    let bottom = p.y - height - PLATE_GAP;
    const barWidth = extra.barWidth ?? BAR_WIDTH;
    const bar = (value: number, max: number, fill: string): void => {
      const left = p.x - Math.floor(barWidth / 2);
      context.fillStyle = css(SHARED_RAMPS.ink[0]);
      context.fillRect(left - 1, bottom - BAR_HEIGHT - 2, barWidth + 2, BAR_HEIGHT + 2);
      context.fillStyle = fill;
      context.fillRect(
        left,
        bottom - BAR_HEIGHT - 1,
        Math.round(barWidth * barFill(value, max)),
        BAR_HEIGHT,
      );
      bottom -= BAR_HEIGHT + 2;
    };
    if (extra.mana) bar(extra.mana[0], extra.mana[1], css(THEME.manaFill));
    if (extra.health) bar(extra.health[0], extra.health[1], css(THEME.hpFill));
    bottom = this.word(name, colour, p.x, bottom);
    if (extra.title) bottom = this.word(extra.title, THEME.color.levelUp, p.x, bottom);
    if (extra.marker) this.word(extra.marker.glyph, extra.marker.color, p.x, bottom);
  }

  /** A word centred over a point, its bottom at `bottom`; answers where its top is. */
  private word(text: string, colour: string, x: number, bottom: number): number {
    const baked = this.text?.get(text, colour);
    if (!baked) return bottom;
    this.context.drawImage(baked, x - Math.floor(baked.width / 2), bottom - baked.height);
    return bottom - baked.height + 1;
  }

  private float(at: Point, text: string, tone: FloatTone, lift = 0): void {
    this.effects.push({
      kind: 'float',
      from: at,
      to: at,
      text,
      colour: FLOAT_TONE_COLORS[tone],
      lift,
      lifeMs: FLOAT_MS,
      bornAt: null,
    });
  }

  private effect(kind: 'projectile' | 'burst', from: Point, to: Point, lifeMs: number): void {
    this.effects.push({ kind, from, to, text: '', colour: '', lift: 0, lifeMs, bornAt: null });
  }

  /** A flat ellipse `width` art pixels across, in the setting's shadow, hard-edged like everything else. */
  private shadow(width: number): HTMLCanvasElement {
    const cached = this.shadows.get(width);
    if (cached) return cached;
    const canvas = this.ellipse(
      width,
      Math.max(3, Math.round(width / 3)),
      SETTING_PALETTES[this.setting].shadow,
      true,
    );
    this.shadows.set(width, canvas);
    return canvas;
  }

  /**
   * The screen's corners falling into shadow: a light drawn over the scene, as
   * the style guide draws light, so it is smooth where the art is not. Measured
   * from the middle of the screen out to its corners.
   */
  private shade(width: number, height: number): HTMLCanvasElement {
    const { canvas, context } = this.pool.make(width, height);
    const radius = Math.hypot(width, height) / 2;
    const gradient = context.createRadialGradient(
      width / 2,
      height / 2,
      radius * VIGNETTE_FROM,
      width / 2,
      height / 2,
      radius,
    );
    gradient.addColorStop(0, 'rgba(8, 10, 12, 0)');
    gradient.addColorStop(1, `rgba(8, 10, 12, ${VIGNETTE_DARK})`);
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
    return canvas;
  }

  /** The ring under whatever the player is fighting. */
  private selectionRing(): HTMLCanvasElement {
    this.ring ??= this.ellipse(24, 9, Number.parseInt(THEME.color.levelUp.slice(1), 16), false);
    return this.ring;
  }

  private ellipse(
    width: number,
    height: number,
    colour: number,
    filled: boolean,
  ): HTMLCanvasElement {
    const pixels = new Uint8ClampedArray(width * height * 4);
    const inside = (x: number, y: number): boolean => {
      const u = (x + 0.5 - width / 2) / (width / 2);
      const v = (y + 0.5 - height / 2) / (height / 2);
      return u * u + v * v <= 1;
    };
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (!inside(x, y)) continue;
        const edge =
          !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
        if (!filled && !edge) continue;
        const at = (y * width + x) * 4;
        pixels[at] = (colour >> 16) & 0xff;
        pixels[at + 1] = (colour >> 8) & 0xff;
        pixels[at + 2] = colour & 0xff;
        pixels[at + 3] = 0xff;
      }
    }
    return this.pool.fromPixels(width, height, pixels);
  }

  private now(): number {
    return performance.now() - this.startedAt;
  }

  worldToScreen(x: number, y: number): Point {
    return this.camera.toScreen(x, y);
  }

  resolveTap(x: number, y: number): WorldTap | null {
    const world = this.world;
    const sheet = this.sheet;
    if (!world || !sheet) return null;
    return pickTap(
      this.camera.toWorld(x, y),
      pickScene(world, (id) => sheet.drawnHeight(id), this.buildings),
    );
  }

  drawnCounts(): DrawnCounts {
    const world = this.world;
    if (!world) {
      return {
        total: 0,
        ground: 0,
        mobs: 0,
        nodes: 0,
        signposts: 0,
        npcs: 0,
        buildings: 0,
        labels: 0,
        signs: 0,
        markers: 0,
        titles: 0,
        piles: 0,
        fx: 0,
      };
    }
    const state = world.character.state;
    const markers = world.npcs.filter((npc) =>
      strongerMarker(npcMarker(npc.npcId, state.quests, state), bountyMarker(npc.npcId, state)),
    ).length;
    const piles = world.lootPiles.filter((pile) => !pile.isGone()).length;
    const counts = {
      ground: this.ground ? 1 : 0,
      mobs: this.mobMotions.size,
      nodes: world.nodes.length,
      signposts: world.signposts.length,
      npcs: world.npcs.length,
      buildings: this.buildings.length,
      // One name over every creature, person and signpost, and the player.
      labels: 1 + this.mobMotions.size + world.npcs.length + world.signposts.length,
      signs: this.buildings.length,
      markers,
      titles: state.activeTitleId ? 1 : 0,
      piles,
      fx: this.effects.length,
    };
    const total =
      counts.ground +
      1 +
      counts.mobs +
      counts.nodes +
      counts.signposts +
      counts.npcs +
      counts.buildings +
      world.stations.length +
      counts.piles;
    return { total, ...counts };
  }

  playerFigure(): PlayerFigure {
    const player = this.world?.player;
    const { animation, facing, index } = this.playerPose;
    return {
      walking: player?.isMoving() ?? false,
      pose: `${animation}:${facing ?? 'all'}:${index}`,
      wearing: this.figure?.wearing ?? '',
    };
  }

  /** What the view is holding: no geometries, and every canvas it made. */
  gpuMemory(): { geometries: number; textures: number } {
    return { geometries: 0, textures: this.pool.count() };
  }
}
