import { DirectionalLight, HemisphereLight, Mesh, Object3D, Vector3 } from 'three';

/**
 * Where the sun stands, as the direction light arrives *from*.
 *
 * South-west and a little over halfway up the sky. Sim y is south, so +z is
 * south and the camera's resting place is due south of the player — which is
 * what decides this: a sun behind the camera lights the faces the camera can
 * see and throws shadows away from it, up the screen, where a steeply pitched
 * view shows them off. The old light came from the north-west, so every face
 * anyone looked at was in shade and the fill had to be cranked to 1.5 to make
 * them readable, which is most of why nothing had any shape.
 *
 * It does not follow the camera. A player who drags the view round to the north
 * is looking into the sun and sees the shaded sides of things, which is what a
 * world with a sun in it does and is a good half of why turning the camera is
 * worth doing at all.
 */
const SUN_DIRECTION = new Vector3(-0.5, 0.9, 0.45).normalize();

/**
 * How many texels wide the shadow map is.
 *
 * A zone is 1600 × 1216 world units, so a map framed on the whole of one covers
 * about 2300 corner to corner: this is a little over one unit to the texel, and
 * a tree trunk is twenty of them. Half this was tried first and measured the
 * same on the throttled pass to within noise — the shadow pass here is a few
 * dozen draw calls of depth-only geometry and is nowhere near fill-bound — so
 * what the second doubling actually costs is the sixteen megabytes it holds
 * rather than any of the frame. It buys the straight edge of a shopfront's
 * shadow, which at 1024 was a visible staircase and is the largest, longest
 * edge in the game.
 */
const SHADOW_MAP_PX = 2048;

/**
 * How much further than the zone's own corners the shadow camera reaches.
 *
 * A caster standing at the edge of the map throws its shadow *outward*, and a
 * frustum cut exactly to the zone would clip it off at the boundary — which
 * reads as a shadow with a straight edge sliced through it rather than as
 * nothing at all.
 */
const SHADOW_MARGIN = 160;

/**
 * How far the shadow's depth is nudged along the surface normal before it is
 * compared, in world units.
 *
 * The lever for shadow acne — the self-shadowing stipple a depth map produces
 * where its texels are coarser than the surface it is testing. Along the normal
 * rather than in depth (`shadow.bias`) because that is the one that does not
 * detach a shadow from the thing casting it: everything here stands on flat
 * ground, and a shadow that has slid off its own feet is more obviously wrong
 * than a little acne would be. Under three texels of the map above, which at a
 * fifty-degree sun slides a shadow by about two world units — a third of a
 * pixel at the size any of this is drawn.
 */
const SHADOW_NORMAL_BIAS = 3;

/**
 * The sky and the ground the fill light is the colour of.
 *
 * A hemisphere rather than a flat ambient, which is the thing that makes a face
 * pointing up read differently from one pointing sideways with no sun on it at
 * all: the old `AmbientLight` added the same value to every surface in the
 * world, so the only shape anything had came from the one directional light and
 * everything facing away from it was a silhouette.
 */
const SKY_COLOR = 0xb4d0f0;
const GROUND_COLOR = 0x4a4335;
const FILL_INTENSITY = 1.25;
const SUN_COLOR = 0xfff2d8;
const SUN_INTENSITY = 2.6;

/**
 * The session's lighting: a hemisphere fill, a sun, and the shadow the sun
 * casts.
 *
 * This is what the doc comment on the old two-line `lights()` reversed itself
 * about, and its reason is worth keeping rather than deleting: shadow maps are
 * a GPU resource with a per-frame cost, and there was "nothing yet standing on
 * the ground to cast one". The cost half is still true and is why the map is
 * sized and framed as tightly as it is; the second half stopped being true
 * several zones ago — there are buildings, trees, veins, signposts, creatures
 * and a player, and none of them sat on the ground because none of them had a
 * shadow under it.
 *
 * Lights outlive a zone, like the camera. What does not is the *framing*: the
 * shadow camera is cut to the zone it is over, so a zone change reframes it.
 */
export class Sunlight {
  /** Everything the scene has to hold, including the sun's aim. */
  readonly objects: Object3D[];
  private readonly sun: DirectionalLight;

  constructor() {
    const fill = new HemisphereLight(SKY_COLOR, GROUND_COLOR, FILL_INTENSITY);
    this.sun = new DirectionalLight(SUN_COLOR, SUN_INTENSITY);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(SHADOW_MAP_PX, SHADOW_MAP_PX);
    this.sun.shadow.normalBias = SHADOW_NORMAL_BIAS;
    // A directional light aims at its target's *world* position, so the target
    // has to be in the graph rather than merely referenced.
    this.objects = [fill, this.sun, this.sun.target];
  }

  /**
   * Cuts the shadow camera to a zone, in simulation units.
   *
   * Framed on the zone rather than on what the player's camera can see, which
   * is the opposite of what `docs/interiors_and_light_plan.md` proposed and is
   * a straight consequence of doing the arithmetic. A camera pitched 58° down
   * sees ground from about 150 units in front of itself out to nearly 2000 —
   * from the middle of town you can see both edges of the zone at once — so a
   * frustum cut to what is on screen is *larger* than one cut to the map, not
   * smaller. Cutting to the zone is also the version with no shimmer in it:
   * the map is fixed in the world for as long as the zone is, so a shadow's
   * edge does not crawl as the player walks.
   */
  frameZone(worldWidth: number, worldHeight: number): void {
    const radius = Math.hypot(worldWidth, worldHeight) / 2 + SHADOW_MARGIN;
    // Twice the radius back along the sun's own direction, which puts the whole
    // zone comfortably in front of the near plane whatever angle the sun is at.
    const distance = radius * 2;
    this.sun.target.position.set(worldWidth / 2, 0, worldHeight / 2);
    this.sun.position.copy(this.sun.target.position).addScaledVector(SUN_DIRECTION, distance);

    const camera = this.sun.shadow.camera;
    camera.left = -radius;
    camera.right = radius;
    camera.top = radius;
    camera.bottom = -radius;
    camera.near = 1;
    camera.far = distance * 2;
    camera.updateProjectionMatrix();
  }

  /**
   * The shadow map is a render target the card is holding, so it is the one
   * thing here with anything to hand back — and `renderer.info.memory` counts
   * it, which is what smoke's three zone round trips are watching.
   */
  dispose(): void {
    this.sun.shadow.dispose();
  }
}

/**
 * Marks everything under an object as casting into the shadow map.
 *
 * Called by the builders rather than by the actors, which is what keeps a
 * nameplate, a shop sign, a damage number and a selection ring out of it: those
 * are hung on the actor *around* the body, and a health bar with a shadow under
 * it is a readout pretending to be scenery. It also means the player's figure
 * keeps its shadow across a gear change, which rebuilds the figure and never
 * touches the actor.
 *
 * Only meshes are marked because only meshes are drawn into a shadow map at
 * all — three skips sprites outright, which is the other half of why the text
 * never had to be excluded by name.
 */
export function castsShadow<T extends Object3D>(object: T): T {
  object.traverse((child) => {
    if ((child as Mesh).isMesh) child.castShadow = true;
  });
  return object;
}
