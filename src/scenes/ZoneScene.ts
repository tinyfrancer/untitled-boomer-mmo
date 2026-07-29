import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import type { ZoneDefinition } from '../data/zones';
import { PlayerSprite } from '../entities/PlayerSprite';
import { MobSprite } from '../entities/MobSprite';
import { ResourceNodeSprite } from '../entities/ResourceNodeSprite';
import { CampfireSprite } from '../entities/CampfireSprite';
import { Shopkeeper } from '../entities/Shopkeeper';
import { ZoneSignpost } from '../entities/ZoneSignpost';
import { TILESET_KEY } from './generateTextures';
import { LEVEL_UP_EVENT, RESET_CHARACTER_REQUESTED_EVENT } from '../ui/uiEvents';
import { THEME, worldZoom } from '../ui/theme';
import { worldViewportHeight } from '../ui/layout';
import { bindKeyboard } from '../systems/InputState';
import { createNewCharacter } from '../persistence';
import type { CharacterController } from '../systems/CharacterController';
import {
  bindUnloadPersist,
  gameContext,
  resetGame,
  startGame,
  type GameContext,
} from '../world/GameContext';
import { ZoneWorld, type WorldNpc, type WorldSignpost, type WorldTap } from '../world/ZoneWorld';
import type { FloatTone, WorldEvent } from '../world/worldEvents';
import type { Player } from '../world/Player';
import type { Mob } from '../world/Mob';
import type { ResourceNode } from '../world/ResourceNode';
import type { Campfire } from '../world/Campfire';
import type { GatherState } from '../systems/GatherSystem';
import type { Point } from '../systems/MovementSystem';
import type { AchievementUnlock } from '../ui/uiEvents';
import type { AbilityId, EnemyId } from '../types/ids';

const GROUND_DEPTH = -10;
const SELECTION_RING_RADIUS = 36;
const SELECTION_RING_COLOR = 0xffee58;

const FLOAT_COLORS: Record<FloatTone, string> = {
  damage: THEME.color.equippable,
  'player-damage': THEME.color.playerDamage,
  heal: THEME.color.heal,
  reward: THEME.color.levelUp,
  skill: THEME.color.skillUp,
  dim: THEME.color.dim,
};

/**
 * The view onto one ZoneWorld: a tilemap, a camera, a sprite per simulated
 * thing, and the pointer. Everything the game *does* lives in the world; this
 * scene translates taps into world commands and the frame's WorldEvent[] into
 * things you can see.
 *
 * It no longer restarts itself to change zone. The session (GameContext) builds
 * the next world and this rebuilds its view against it — one scene, many worlds,
 * which is what the Three.js view will do with `.dispose()` calls where this has
 * `.destroy()` ones.
 */
export class ZoneScene extends Phaser.Scene {
  private context!: GameContext;
  private playerSprite!: PlayerSprite;
  private mobSprites: MobSprite[] = [];
  private nodeSprites: ResourceNodeSprite[] = [];
  private npcSprites: Shopkeeper[] = [];
  private signpostSprites: ZoneSignpost[] = [];
  private campfireSprite: CampfireSprite | null = null;
  private tilemap: Phaser.Tilemaps.Tilemap | null = null;
  private selectionRing!: Phaser.GameObjects.Graphics;
  // Floating numbers and bolts: scene-owned, short-lived and mid-tween when a
  // zone change takes their world away, so they are tracked rather than left to
  // finish over terrain they were never thrown across.
  private fx!: Phaser.GameObjects.Group;
  private unbindKeyboard: (() => void) | null = null;
  private unbindUnloadPersist: (() => void) | null = null;
  private viewLive = false;

  constructor() {
    super('Zone');
  }

  create(): void {
    // Preload and CharacterCreate both start a session before coming here; the
    // fallback only covers being dropped straight into the zone with no save.
    this.context =
      gameContext() ??
      startGame({
        character: createNewCharacter('Adventurer', 'warrior'),
        events: this.game.events,
      });

    this.buildView();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.applyCameraZoom, this);

    this.input.on('pointerdown', this.handlePointerDown, this);
    this.unbindKeyboard = bindKeyboard(this.context.input, window);
    this.unbindUnloadPersist = bindUnloadPersist(this.context, window);
    this.game.events.on(RESET_CHARACTER_REQUESTED_EVENT, this.resetCharacter, this);
    // Con colors are relative to the player, so every enemy name has to be
    // redrawn when they level.
    this.game.events.on(LEVEL_UP_EVENT, this.refreshMobLabels, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unbindKeyboard?.();
      this.unbindKeyboard = null;
      this.unbindUnloadPersist?.();
      this.unbindUnloadPersist = null;
      this.scale.off(Phaser.Scale.Events.RESIZE, this.applyCameraZoom, this);
      this.game.events.off(RESET_CHARACTER_REQUESTED_EVENT, this.resetCharacter, this);
      this.game.events.off(LEVEL_UP_EVENT, this.refreshMobLabels, this);
      // A backstop: the one path that ends this scene tears the view down
      // first, while the camera and tween managers it needs still exist. By
      // the time this fires they may already be gone — Phaser shuts its
      // plugins down in the order they registered, which is before us.
      this.teardownView();
      // The world is not destroyed here: it belongs to the session, which
      // outlives this scene. Only a reset ends one, and it does it itself.
    });

    // The HUD survives zone changes: launched once on first boot, and left
    // running for every world after it.
    if (!this.scene.isActive('UI')) {
      this.scene.launch('UI');
    }
  }

  private get world(): ZoneWorld {
    return this.context.currentWorld;
  }

  // ---------------------------------------------------------------------------
  // Building and unbuilding the view
  // ---------------------------------------------------------------------------

  private buildView(): void {
    this.viewLive = true;
    this.buildTilemap();
    this.buildSprites();

    this.cameras.main.setBounds(0, 0, this.world.worldWidth, this.world.worldHeight);
    this.cameras.main.startFollow(this.playerSprite, true);
    this.applyCameraZoom();

    // After the sprites, so a target's ring draws over it rather than under.
    this.selectionRing = this.add.graphics();
    this.selectionRing.setVisible(false);
    this.fx = this.add.group();

    // Dev-only handle on the live simulation, for the devtools console and the
    // smoke check. Re-set on every zone change, since each builds a new world.
    if (import.meta.env.DEV) {
      (window as unknown as { world: ZoneWorld }).world = this.world;
    }
  }

  /**
   * Everything `buildView` made, taken back down. Scene restart used to do this
   * for free, which is exactly why the labels over shopkeepers and signposts
   * could be scene-owned and forgotten about: now the sprite that put one there
   * takes it away in its own `destroy()`.
   */
  private teardownView(): void {
    if (!this.viewLive) return;
    this.viewLive = false;
    // Every tween this scene runs is on something built here — a float rising
    // off a corpse, a bolt in flight, the campfire's flicker — so none of them
    // has anywhere to land once the world underneath is gone.
    this.tweens.killAll();
    this.cameras.main.stopFollow();
    this.playerSprite.destroy();
    this.mobSprites.forEach((sprite) => sprite.destroy());
    this.mobSprites = [];
    this.nodeSprites.forEach((sprite) => sprite.destroy());
    this.nodeSprites = [];
    this.npcSprites.forEach((sprite) => sprite.destroy());
    this.npcSprites = [];
    this.signpostSprites.forEach((sprite) => sprite.destroy());
    this.signpostSprites = [];
    this.campfireSprite?.extinguish();
    this.campfireSprite = null;
    this.fx.destroy(true);
    this.selectionRing.destroy();
    this.tilemap?.destroy();
    this.tilemap = null;
  }

  private buildTilemap(): void {
    const tilemap = this.make.tilemap({
      data: this.world.zone.map,
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
    });
    const tileset = tilemap.addTilesetImage(TILESET_KEY, TILESET_KEY, TILE_SIZE, TILE_SIZE, 0, 0);
    if (!tileset) {
      throw new Error(`Failed to register tileset image "${TILESET_KEY}"`);
    }
    const groundLayer = tilemap.createLayer(0, tileset, 0, 0);
    if (!groundLayer) {
      throw new Error('Failed to create ground layer');
    }
    // Below everything, so flat decals drawn onto the terrain (fishing spots)
    // can sit at a negative depth and still be visible above it.
    groundLayer.setDepth(GROUND_DEPTH);
    this.tilemap = tilemap;
  }

  private buildSprites(): void {
    const level = this.world.character.state.level;
    this.playerSprite = new PlayerSprite(this, this.world.player);
    this.mobSprites = this.world.mobs.map((mob) => {
      const sprite = new MobSprite(this, mob, level);
      sprite.setInteractive();
      return sprite;
    });
    this.nodeSprites = this.world.nodes.map((node) => {
      const sprite = new ResourceNodeSprite(this, node);
      sprite.setInteractive();
      return sprite;
    });
    this.npcSprites = this.world.npcs.map((npc) => new Shopkeeper(this, npc));
    this.signpostSprites = this.world.signposts.map((signpost) => new ZoneSignpost(this, signpost));
  }

  update(_time: number, delta: number): void {
    const { events, zoneChanged } = this.context.update(delta);
    if (zoneChanged) {
      // The events belong to a world that has already been torn down — a float
      // over a corpse in the zone being left has nowhere to land.
      this.teardownView();
      this.buildView();
      return;
    }
    this.syncSprites();
    this.updateSelectionRing();
    events.forEach((event) => this.render(event));
  }

  private syncSprites(): void {
    this.playerSprite.sync();
    this.mobSprites.forEach((sprite) => sprite.sync());
    this.nodeSprites.forEach((sprite) => sprite.sync());

    const campfire = this.world.campfire;
    if (campfire && !this.campfireSprite) {
      this.campfireSprite = new CampfireSprite(this, campfire);
    } else if (!campfire && this.campfireSprite) {
      this.campfireSprite.extinguish();
      this.campfireSprite = null;
    }
  }

  private refreshMobLabels(level: number): void {
    this.mobSprites.forEach((sprite) => sprite.refreshLabel(level));
  }

  // ---------------------------------------------------------------------------
  // Drawing what happened
  // ---------------------------------------------------------------------------

  private render(event: WorldEvent): void {
    switch (event.kind) {
      case 'hit': {
        const tone: FloatTone = event.on === 'player' ? 'player-damage' : 'damage';
        if (event.absorbed > 0) {
          this.float(event.at.x, event.at.y - 16, `(${event.absorbed} absorbed)`, 'skill');
        }
        if (event.damage > event.absorbed) {
          const shown = event.on === 'player' ? event.damage - event.absorbed : event.damage;
          this.float(
            event.at.x,
            event.at.y,
            `-${shown}`,
            event.via === 'ability' ? 'reward' : tone,
          );
        }
        return;
      }
      case 'defend':
        this.float(event.at.x, event.at.y, event.skillName, 'heal');
        return;
      case 'heal':
        this.float(event.at.x, event.at.y, `+${event.amount}`, 'heal');
        return;
      case 'float':
        this.float(event.at.x, event.at.y, event.text, event.tone);
        return;
      case 'bolt-cast':
        this.castBolt(event.from, event.to);
        return;
      default:
        // spawn and gather-tick have nothing to draw in 2D: the sprites read the
        // simulation directly, and the 3D view is what they exist for. death and
        // zone-exit belong to the session: a frame that changed zone rebuilds
        // instead of drawing, and dying at home just puts the player back.
        return;
    }
  }

  // A bolt thrown from the caster to the target. Purely cosmetic, but a ranged
  // nuke that produced only a number over the mob read as nothing happening.
  private castBolt(from: { x: number; y: number }, to: { x: number; y: number }): void {
    const bolt = this.add.circle(from.x, from.y, 8, 0xff7043, 1);
    bolt.setStrokeStyle(2, 0xffd54f, 1);
    this.fx.add(bolt);
    this.tweens.add({
      targets: bolt,
      x: to.x,
      y: to.y,
      duration: 180,
      onComplete: () => bolt.destroy(),
    });
  }

  private float(x: number, y: number, message: string, tone: FloatTone): void {
    const text = this.add
      // world-space, so this scales with the camera rather than the ui scale
      .text(x, y - 20, message, {
        fontSize: '20px',
        color: FLOAT_COLORS[tone],
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.fx.add(text);

    this.tweens.add({
      targets: text,
      y: y - 50,
      alpha: 0,
      duration: 600,
      onComplete: () => text.destroy(),
    });
  }

  private updateSelectionRing(): void {
    const target = this.world.target;
    if (!target) {
      this.selectionRing.setVisible(false);
      return;
    }
    this.selectionRing.clear();
    this.selectionRing.lineStyle(2, SELECTION_RING_COLOR, 1);
    this.selectionRing.strokeCircle(target.x, target.y, SELECTION_RING_RADIUS);
    this.selectionRing.setVisible(true);
  }

  /**
   * Fits the world camera into the screen *above* the tab bar.
   *
   * The bar is opaque HUD furniture that eats every tap landing on it, so any
   * world drawn underneath it is unreachable — which is exactly what happened
   * to the south signpost in town, rendering four pixels inside the bar on a
   * portrait phone with no way to tap it. Shrinking the viewport instead of
   * nudging pixels makes "every world object can be tapped" true by
   * construction rather than by luck.
   */
  private applyCameraZoom(): void {
    const height = worldViewportHeight(this.scale.width, this.scale.height);
    this.cameras.main.setViewport(0, 0, this.scale.width, height);
    this.cameras.main.setZoom(
      worldZoom(this.scale.width, height, this.world.worldWidth, this.world.worldHeight),
    );
  }

  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------

  // What world objects are under this pointer, tested explicitly. The
  // currentlyOver list the pointerdown event carries is NOT used: with two
  // active scenes (UI above this one), Phaser 3.90 computes every scene's
  // list into one shared internal array, and on pointerdown this scene's
  // copy is intermittently stale/empty depending on event/frame timing —
  // clicks on mobs and NPCs silently fell through to the ground path. An
  // explicit hit test against our own clickables, with a private output
  // array, is deterministic.
  private hitTestWorld(pointer: Phaser.Input.Pointer): Phaser.GameObjects.GameObject[] {
    const candidates: Phaser.GameObjects.GameObject[] = [
      ...this.nodeSprites,
      ...this.npcSprites,
      ...this.signpostSprites,
      ...this.mobSprites,
    ];
    return this.input.manager.hitTest(pointer, candidates, this.cameras.main, []);
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    // Clicks that land on the HUD belong to it, not the world.
    const ui = this.scene.get('UI');
    if (ui?.input && ui.input.hitTestPointer(pointer).length > 0) {
      return;
    }
    this.world.tap(this.resolveTap(pointer));
  }

  // The one piece of hit testing that has to stay here: what a screen pixel is
  // over is a question about the camera and the sprites, not about the game.
  private resolveTap(pointer: Phaser.Input.Pointer): WorldTap {
    const over = this.hitTestWorld(pointer);

    const node = over.find((obj): obj is ResourceNodeSprite => obj instanceof ResourceNodeSprite);
    if (node) return { kind: 'node', node: node.node };

    const signpost = over.find((obj): obj is ZoneSignpost => obj instanceof ZoneSignpost);
    if (signpost) return { kind: 'signpost', signpost: signpost.signpost };

    const npc = over.find((obj): obj is Shopkeeper => obj instanceof Shopkeeper);
    if (npc) return { kind: 'npc', npc: npc.npc };

    const mob = over.find((obj): obj is MobSprite => obj instanceof MobSprite);
    if (mob) return { kind: 'mob', mob: mob.mob };

    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    return { kind: 'ground', point: { x: worldPoint.x, y: worldPoint.y } };
  }

  // ---------------------------------------------------------------------------
  // Host duties the world refuses
  // ---------------------------------------------------------------------------

  private resetCharacter(): void {
    resetGame();
    // Before the scene stops, while the camera and tween managers this needs
    // are still up: Phaser takes those down ahead of any SHUTDOWN listener we
    // could register.
    this.teardownView();
    this.scene.stop('UI');
    this.scene.start('CharacterCreate');
  }

  // ---------------------------------------------------------------------------
  // Smoke-check surface. `scripts/smoke.mjs` still reaches into the scene for
  // live state; PR 9 of the port retargets it at `window.world` and these go.
  // ---------------------------------------------------------------------------

  get zone(): ZoneDefinition {
    return this.world.zone;
  }
  get player(): Player {
    return this.world.player;
  }
  /** The figure, as opposed to the simulation: the walk cycle lives out here. */
  get figure(): PlayerSprite {
    return this.playerSprite;
  }
  get mobs(): Mob[] {
    return this.world.mobs;
  }
  get nodes(): ResourceNode[] {
    return this.world.nodes;
  }
  get npcs(): WorldNpc[] {
    return this.world.npcs;
  }
  get signposts(): WorldSignpost[] {
    return this.world.signposts;
  }
  get campfire(): Campfire | null {
    return this.world.campfire;
  }
  get character(): CharacterController {
    return this.world.character;
  }
  get spawnPoint(): Point {
    return this.world.spawnPoint;
  }
  get worldWidth(): number {
    return this.world.worldWidth;
  }
  get worldHeight(): number {
    return this.world.worldHeight;
  }
  get gatherState(): GatherState | null {
    return this.world.gatherState;
  }
  get afkActive(): boolean {
    return this.world.afkActive;
  }
  get lastAbilityAt(): Map<AbilityId, number> {
    return this.world.lastAbilityAt;
  }
  get target(): Mob | null {
    return this.world.target;
  }
  set target(mob: Mob | null) {
    this.world.target = mob;
  }
  get shopNpc(): WorldNpc | null {
    return this.world.shopNpc;
  }
  set shopNpc(npc: WorldNpc | null) {
    this.world.shopNpc = npc;
  }

  setTarget(mob: Mob): void {
    this.world.setTarget(mob);
  }
  clearTarget(): void {
    this.world.clearTarget();
  }
  closeShop(): void {
    this.world.closeShop();
  }
  startGathering(node: ResourceNode): void {
    this.world.startGathering(node);
  }
  stopGathering(): void {
    this.world.stopGathering();
  }
  updateShopRange(): void {
    this.world.updateShopRange();
  }
  approachShop(npc: WorldNpc): void {
    this.world.approachShop(npc);
  }
  resolveKill(mob: Mob): void {
    this.world.resolveKill(mob);
  }
  creditKill(enemyId: EnemyId, count = 1): AchievementUnlock[] {
    return this.world.creditKill(enemyId, count);
  }
  handleBuyRequested(itemId: string): void {
    this.world.handleBuyRequested(itemId);
  }
  handleSellRequested(itemId: string): void {
    this.world.handleSellRequested(itemId);
  }
  handleEquipRequested(itemId: string): void {
    this.world.handleEquipRequested(itemId);
  }
  handleEatRequested(itemId: string): void {
    this.world.handleEatRequested(itemId);
  }
  handleCookRequested(itemId?: string): void {
    this.world.handleCookRequested(itemId);
  }
  handleLightFireRequested(): void {
    this.world.handleLightFireRequested();
  }
  handleAbilityRequested(abilityId: AbilityId): void {
    this.world.handleAbilityRequested(abilityId);
  }
}
