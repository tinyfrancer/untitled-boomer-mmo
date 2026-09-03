import {
  Color,
  Fog,
  Object3D,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
  type Mesh,
} from 'three';
import {
  BuildingActor,
  CampfireActor,
  MobActor,
  NodeActor,
  NpcActor,
  PlayerActor,
  SignpostActor,
  StationActor,
  type Actor,
} from './actors';
import { occupant } from '../data/buildings';
import { createCamera, fogRange, frameCamera, projectToScreen, resizeCamera } from './camera';
import { simToWorld } from './coords';
import { disposeTree } from './dispose';
import { FxLayer } from './fx';
import { buildGround } from './ground';
import { RoomLight, Sunlight, type RoomLamp } from './lights';
import { applyOcclusion, type Occluder } from './occlusion';
import { normalizeYaw } from './orbit';
import { pickTap, pointerRay } from './picking';
import { SelectionRing } from './selection';
import type { WorldTap, ZoneWorld } from '../world/ZoneWorld';
import type { WorldEvent } from '../world/worldEvents';
import type { DrawnCounts } from '../types/debugView';

/** Dark enough that the world edge reads as sky rather than as a hole. */
const BACKGROUND = 0x1a1a2e;

/**
 * The Three.js view onto one ZoneWorld: a renderer, a scene, a camera that
 * follows the player, and — for now — the ground under them.
 *
 * The split between what is built once and what is built per zone is the whole
 * point of this class. The renderer, the camera and the lights belong to the
 * session; the terrain belongs to the zone and has to be **disposed** when that
 * zone is left. A missed teardown costs GPU memory that is never handed back
 * and is invisible to every state assertion and to the screen, which is why
 * `scripts/smoke.mjs` walks three zone round trips and asserts
 * `renderer.info.memory` came back to where it started.
 */
export class ZoneView3D {
  readonly canvas: HTMLCanvasElement;
  private readonly parent: HTMLElement;
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera: PerspectiveCamera = createCamera();
  private world: ZoneWorld | null = null;
  private ground: Mesh | null = null;
  private player: PlayerActor | null = null;
  private mobActors: MobActor[] = [];
  private nodeActors: NodeActor[] = [];
  private npcActors: NpcActor[] = [];
  private signpostActors: SignpostActor[] = [];
  private stationActors: StationActor[] = [];
  private buildingActors: BuildingActor[] = [];
  // Everything the fade is measured against, gathered once per zone rather than
  // spread each frame: `applyOcclusion` runs from `sync`, and a fresh array
  // there would be one allocation per frame for a list that cannot change.
  private occluders: Occluder[] = [];
  private campfireActor: CampfireActor | null = null;
  // Both outlive a zone, like the camera and the lights: a target belongs to
  // the player and a damage number to the moment it was dealt, and neither is
  // anything the terrain owns. What they hold *is* the zone's, so a teardown
  // empties them without taking them out of the scene.
  private readonly fx = new FxLayer();
  private readonly selection = new SelectionRing();
  // The sun and its fill outlive a zone the way the camera does; what does not
  // is the shadow camera's framing, which is cut to the map it is over.
  private readonly sunlight = new Sunlight();
  // The one light indoors, moved to whichever room the player is standing in.
  // Session-long like the sun for a reason of its own: three keys a material's
  // program on how many lights the scene holds, so a light that came and went
  // with a doorway would recompile every program in the game on the frame it
  // was walked through.
  private readonly roomLight = new RoomLight();
  // Distance-hazed toward the background, so the edge of the world reads as far
  // away rather than as the line where the ground mesh stops. Its range is a
  // function of how far back the camera stands, so it is set on every resize.
  private readonly fog = new Fog(BACKGROUND);
  // Where the camera stands around the player. Owned here rather than by the
  // host because it outlives a zone — a player who has turned the camera to see
  // past a tree does not expect it snapped back north by walking through a
  // signpost.
  private yaw = 0;
  // The level the enemy name colours were drawn against. Con colours are
  // relative to the player, so they go stale on a level-up; asking the
  // character each frame is cheaper than a subscription only one host would own.
  private labelledLevel = 0;
  private readonly startedAt = performance.now();

  constructor(parent: HTMLElement) {
    this.parent = parent;
    this.renderer = new WebGLRenderer({ antialias: true });
    // Capped: a phone's device pixel ratio of 3 is nine times the fragments for
    // a difference nobody can see on placeholder geometry.
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.canvas = this.renderer.domElement;
    // The HUD is an absolutely-positioned overlay in the same box, mounted
    // after this, so it draws over the canvas without either knowing about the
    // other.
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    // `pinch-zoom` and not `none`: a one-finger drag and a double tap are ours,
    // so the pointermove stream an orbit depends on keeps arriving rather than
    // being claimed halfway through by a pan the browser decided to take. A
    // two-finger pinch is deliberately left to the browser, because the canvas
    // is full-bleed under a `pointer-events: none` overlay — whatever it
    // refuses, the page has no other surface to be unzoomed through.
    this.canvas.style.touchAction = 'pinch-zoom';
    parent.appendChild(this.canvas);

    // Soft rather than hard: at a couple of world units to the texel a hard
    // edge is a staircase, and every shadow here is cast by a box.
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;

    this.scene.background = new Color(BACKGROUND);
    this.scene.fog = this.fog;
    this.scene.add(
      ...this.sunlight.objects,
      this.roomLight.object,
      this.fx.object,
      this.selection.object,
    );
    this.resize();
  }

  /** Builds the view of a zone. Whatever was built for the last one is gone. */
  build(world: ZoneWorld): void {
    this.world = world;
    this.ground = buildGround(world.zone.map);
    this.scene.add(this.ground);
    this.sunlight.frameZone(world.worldWidth, world.worldHeight);

    this.labelledLevel = world.character.state.level;
    this.player = new PlayerActor(world.player);
    this.mobActors = world.mobs.map((mob) => new MobActor(mob, this.labelledLevel));
    this.nodeActors = world.nodes.map((node) => new NodeActor(node));
    this.npcActors = world.npcs.map((npc) => new NpcActor(npc));
    this.signpostActors = world.signposts.map((signpost) => new SignpostActor(signpost));
    this.stationActors = world.stations.map((station) => new StationActor(station));
    // Who works out of each one, matched by where they are standing rather than
    // read off a column in the table: a tap on a shopfront is a tap on them, and
    // from outside there is no other way to reach a counter behind a wall.
    this.buildingActors = world.buildings.map(
      (building) => new BuildingActor(building, occupant(building, world.npcs)),
    );
    this.occluders = [...this.nodeActors, ...this.buildingActors];
    this.actors().forEach((actor) => this.scene.add(actor.object));

    this.follow();
    this.sync();
  }

  /**
   * Everything `build` made, taken back down and handed back to the GPU.
   *
   * A geometry and a material are not garbage: dropping the last reference to
   * one leaves its buffers on the card until the context is lost. Nothing in
   * the unit suite can see that, and nothing on screen looks wrong — the only
   * symptom is `renderer.info.memory` climbing zone by zone.
   */
  teardown(): void {
    if (this.ground) {
      disposeTree(this.ground);
      this.ground = null;
    }
    // A number rising off a rat in town has nowhere to land on the beach, and
    // the ring is under a mob that no longer exists.
    this.fx.clear();
    this.selection.follow(null);
    // A room in the zone being left. `sync` answers nothing while there is no
    // world, so a light not put out here would still be burning where that
    // building stood when the next zone is built around it.
    this.roomLight.shine(null);
    this.actors().forEach((actor) => actor.dispose());
    this.player = null;
    this.mobActors = [];
    this.nodeActors = [];
    this.npcActors = [];
    this.signpostActors = [];
    this.stationActors = [];
    this.buildingActors = [];
    this.occluders = [];
    this.campfireActor = null;
    this.world = null;
  }

  /** Ends the session's view: the zone's contents, the context and the canvas. */
  dispose(): void {
    this.teardown();
    this.fx.dispose();
    this.selection.dispose();
    this.sunlight.dispose();
    this.renderer.dispose();
    // `dispose()` frees what three allocated but leaves the WebGL context to be
    // collected whenever the browser gets round to it, and a browser allows
    // only a handful at once. The one path here is a reset, which builds a
    // fresh view straight afterwards, so the old context has to go now rather
    // than eventually.
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }

  /**
   * One drawn frame. The simulation is stepped elsewhere.
   *
   * The camera moves first: the nameplates are billboarded against it and the
   * fade is measured along it, so a frame that framed the camera last would
   * show both of them one frame behind. Nobody could see that while the camera
   * only ever looked north; a camera being dragged round is exactly when a
   * frame of lag reads as a wobble.
   */
  render(): void {
    this.follow();
    this.sync();
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * The frame's `WorldEvent`s, handed to the layer that draws moments.
   *
   * Called from the host's tick rather than from `render`, because that is
   * where they arrive and there is nowhere else to find them: a view that is
   * not handed one has no way to know it happened.
   */
  draw(events: readonly WorldEvent[]): void {
    events.forEach((event) => this.fx.draw(event));
  }

  /** Turns the camera around the player — the drag, in radians. */
  orbitBy(yawDelta: number): void {
    this.yaw = normalizeYaw(this.yaw + yawDelta);
  }

  /** Where the camera stands, which is also which way "forward" is at the keyboard. */
  cameraYaw(): number {
    return this.yaw;
  }

  /**
   * Catches every actor up to the simulation.
   *
   * Called from `render` rather than from the host's tick, which is what keeps
   * `?loop=manual` honest: under the hand crank the game stops advancing but the
   * frame loop keeps drawing, so what is on screen is always this frame's view
   * of whatever the last step left behind.
   */
  private sync(): void {
    const world = this.world;
    if (!world) return;
    const elapsedMs = performance.now() - this.startedAt;

    // Levelling recolours every enemy name at once, since the shades are
    // relative to the player rather than fixed.
    const level = world.character.state.level;
    if (level !== this.labelledLevel) {
      this.labelledLevel = level;
      this.mobActors.forEach((actor) => actor.refreshLabel(level));
    }

    this.player?.sync(elapsedMs, world.character.state.activeTitleId);
    this.mobActors.forEach((actor) => actor.sync(elapsedMs));
    this.nodeActors.forEach((actor) => actor.sync());
    this.npcActors.forEach((actor) => actor.sync(world.character.state));
    this.syncCampfire(world);
    this.campfireActor?.sync(elapsedMs);
    // Every frame, not on a target-changed event: a chased mob is moving, and
    // the ring is under its feet.
    this.selection.follow(world.target);
    this.fx.update(elapsedMs);

    // Whatever the camera has ended up behind — the trees and the buildings.
    // Only the props are asked: a rat standing in front of the player is not
    // something they need to see past, and fading creatures would fight the
    // death fade for the same materials.
    // The room the player is standing in, if they are standing in one. Before
    // the fade rather than after it, because a building being cut away is what
    // decides whether it may also be faded.
    this.buildingActors.forEach((actor) => actor.sync(this.camera.position, world.player));
    // And its light, which is the other half of the cutaway: taking the roof
    // off leaves a room standing in full sun, and the lamp is what still tells
    // it from the grass outside.
    this.roomLight.shine(this.roomLamp());
    applyOcclusion(this.camera.position, world.player, this.occluders);

    // Billboards last, against the camera this frame is about to be drawn with.
    this.player?.faceCamera(this.camera);
    this.mobActors.forEach((actor) => actor.faceCamera(this.camera));
    this.npcActors.forEach((actor) => actor.faceCamera(this.camera));
    this.signpostActors.forEach((actor) => actor.faceCamera(this.camera));
  }

  /**
   * The room the player is standing in, or `null` for one who is outdoors.
   *
   * A loop rather than a `find` over `map`, because this runs every frame and
   * an array per frame for a list that answers `null` almost always is an
   * allocation the occlusion pass already went out of its way to avoid.
   */
  private roomLamp(): RoomLamp | null {
    for (const actor of this.buildingActors) {
      const lamp = actor.roomLamp();
      if (lamp) return lamp;
    }
    return null;
  }

  // A campfire is the one thing that appears and goes out mid-zone, so it is
  // built and disposed against the world's rather than at build time.
  private syncCampfire(world: ZoneWorld): void {
    const campfire = world.campfire;
    if (campfire && !this.campfireActor) {
      this.campfireActor = new CampfireActor(campfire);
      this.scene.add(this.campfireActor.object);
    } else if (!campfire && this.campfireActor) {
      this.campfireActor.dispose();
      this.campfireActor = null;
    }
  }

  private actors(): Actor[] {
    return [
      ...(this.player ? [this.player] : []),
      ...this.mobActors,
      ...this.nodeActors,
      ...this.npcActors,
      ...this.signpostActors,
      ...this.stationActors,
      ...this.buildingActors,
      ...(this.campfireActor ? [this.campfireActor] : []),
    ];
  }

  resize(): void {
    // The parent's box rather than the window's: #app is sized in dvh, which on
    // iOS Safari is the viewport with the toolbars *out* — the discrepancy that
    // once hid the whole tab bar behind the bottom toolbar. The HUD measures
    // itself the same way, so the two agree about where the bottom is.
    const { width, height } = this.viewport();
    // Full-bleed rather than stopping above the tab bar: the bar is an opaque
    // DOM element over the canvas and swallows the taps that land on it by
    // construction. What keeps the world out from under it is the camera
    // framing in camera.ts, not the size of the canvas.
    this.renderer.setSize(width, height, false);
    resizeCamera(this.camera, width, height);
    // The haze is measured in multiples of how far back the camera stands, and
    // that is what a reshaped viewport moves.
    const { near, far } = fogRange(this.camera.aspect);
    this.fog.near = near;
    this.fog.far = far;
  }

  worldToScreen(x: number, y: number): { x: number; y: number } {
    const { width, height } = this.viewport();
    return projectToScreen(this.camera, simToWorld(x, y), width, height);
  }

  /**
   * What a tap at this point on the canvas is on, in the vocabulary the world
   * takes — or `null` for a tap on nothing at all, which is the sky.
   *
   * The one piece of hit testing that has to live in a view: what a screen
   * pixel is over is a question about the camera and what is drawn, not about
   * the game.
   */
  resolveTap(x: number, y: number): WorldTap | null {
    const { width, height } = this.viewport();
    return pickTap(pointerRay(this.camera, x, y, width, height), {
      nodes: this.nodeActors,
      signposts: this.signpostActors,
      npcs: this.npcActors,
      stations: this.stationActors,
      mobs: this.mobActors,
      buildings: this.buildingActors,
    });
  }

  private viewport(): { width: number; height: number } {
    return { width: this.parent.clientWidth, height: this.parent.clientHeight };
  }

  /**
   * What the scene is holding, counted off the graph rather than off this
   * class's own fields — a leak is precisely the object nothing here still
   * references.
   */
  drawnCounts(): DrawnCounts {
    const byKind = new Map<string, number>();
    let total = 0;
    this.scene.traverse((object: Object3D) => {
      if (object === this.scene) return;
      total += 1;
      const kind = object.userData.kind;
      if (typeof kind === 'string') {
        byKind.set(kind, (byKind.get(kind) ?? 0) + 1);
      }
    });
    return {
      total,
      ground: byKind.get('ground') ?? 0,
      mobs: byKind.get('mob') ?? 0,
      nodes: byKind.get('node') ?? 0,
      signposts: byKind.get('signpost') ?? 0,
      npcs: byKind.get('npc') ?? 0,
      buildings: byKind.get('building') ?? 0,
      labels: byKind.get('label') ?? 0,
      signs: byKind.get('sign') ?? 0,
      markers: byKind.get('marker') ?? 0,
      titles: byKind.get('title') ?? 0,
      fx: this.fx.count(),
    };
  }

  /** The player's figure, as opposed to the simulation: its walk cycle. */
  playerFigure(): { walking: boolean; pose: string } {
    return this.player?.figureState() ?? { walking: false, pose: 'none' };
  }

  /** What the card is holding. Flat across a zone walk, or the teardown lies. */
  gpuMemory(): { geometries: number; textures: number } {
    return { ...this.renderer.info.memory };
  }

  private follow(): void {
    if (this.world) {
      frameCamera(this.camera, this.world.player, this.yaw);
    }
  }
}
