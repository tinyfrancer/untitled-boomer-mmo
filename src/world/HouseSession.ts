import { BUILDINGS, isInside } from '../data/buildings';
import { HOUSE_BUILDING, HOUSE_UPGRADES, SHUT_UNTIL } from '../data/house';
import { describeItemName } from '../data/items';
import { formatCurrency } from '../systems/CurrencySystem';
import { isBuilt, onStand, ownsHouse } from '../systems/HouseSystem';
import type { HouseUpgradeId, ItemId } from '../types/ids';
import { HOUSE_CHANGED_EVENT, HOUSE_CLOSED_EVENT, HOUSE_OPENED_EVENT } from '../ui/uiEvents';
import type { WorldContext } from './WorldContext';
import type { WorldBuilding, WorldFixture } from './zoneEntities';

/** What standing in the house needs from the rest of the zone, and the whole of it. */
export interface HouseSessionDeps {
  /**
   * Shuts whatever counter is open: one thing is served at a time, and a stand
   * opened with the bank still up would leave two panels each sure it was the
   * one being used.
   */
  closeCounters: () => void;
  /** Puts what a stage builds into the zone being stood in (F2). */
  raise: (upgrade: HouseUpgradeId) => void;
  /** The zone's buildings, which a room shut until it is built is one of. */
  buildings: readonly WorldBuilding[];
}

/**
 * Standing in the house (F1): which stand, the chest or the wall is open, what
 * crosses between it and the bag, and what walking out of the house means.
 *
 * A counter's shape with nobody behind it, as a station is. What is open is
 * gated on being open rather than on a distance, and walking out of the house
 * is what shuts it, since everything in it is a few steps from everything
 * else. Every move goes through `CharacterController`, which refuses as a
 * whole, and is saved as it is made, for the bank's reason: the house is
 * somewhere a player deliberately parts with something.
 *
 * A stand that holds a trophy hands it back on a tap rather than opening
 * anything (F1's answer: displaying is not spending), so only a bare stand,
 * the chest, the wall and the plans ever open a panel. The plans are where
 * the house is built out (F2), a stage at a time, and what a stage builds is
 * put into the zone the moment it is paid for.
 */
export class HouseSession {
  /** What is open while it is; null when nothing is. */
  open: WorldFixture | null = null;

  private readonly ctx: WorldContext;
  private readonly deps: HouseSessionDeps;

  constructor(ctx: WorldContext, deps: HouseSessionDeps) {
    this.ctx = ctx;
    this.deps = deps;
  }

  isOpen(): boolean {
    return this.open !== null;
  }

  /** What a tap on a fixture does once the walk up to it is over. */
  use(fixture: WorldFixture): void {
    const name = BUILDINGS[HOUSE_BUILDING].name;
    if (!ownsHouse(this.ctx.character.state.quests)) {
      this.ctx.notice(`${name} is the Company's, until the quartermaster lets it to you.`);
      return;
    }
    if (fixture.fixture.kind === 'stand') {
      if (onStand(this.ctx.character.state.house, fixture.fixture.stand)) {
        this.takeBack(fixture.fixture.stand);
        return;
      }
    }
    this.deps.closeCounters();
    this.close();
    this.ctx.player.stopMoving();
    this.open = fixture;
    this.ctx.events.emit(HOUSE_OPENED_EVENT, fixture.fixture);
    this.publish();
  }

  /** Sets a trophy from the bag on the bare stand that is open, and shuts it: there is nothing more to choose. */
  display(itemId: ItemId): void {
    const fixture = this.open?.fixture;
    if (fixture?.kind !== 'stand') return;
    const result = this.ctx.character.displayTrophy(fixture.stand, itemId);
    if (!result.ok) {
      this.ctx.notice(result.reason);
      return;
    }
    this.close();
    this.settle();
  }

  /** Builds the next stage off the plans that are open, and puts it on the lot. */
  build(upgrade: HouseUpgradeId): void {
    if (this.open?.fixture.kind !== 'plans') return;
    const result = this.ctx.character.buildUpgrade(upgrade);
    if (!result.ok) {
      this.ctx.notice(result.reason);
      return;
    }
    this.deps.raise(upgrade);
    this.ctx.notice(
      `${HOUSE_UPGRADES[upgrade].name} is built, for ${formatCurrency(result.price)}.`,
    );
    this.ctx.publishCurrency();
    this.settle();
  }

  /**
   * Whether a walk to here is refused because it ends in a room still shut
   * (F2): said once, rather than a walk into a walled-up doorway.
   */
  refusesWalkTo(point: { x: number; y: number }): boolean {
    const { house } = this.ctx.character.state;
    const shut = this.deps.buildings.find((building) => {
      const stage = SHUT_UNTIL[building.definition.id];
      return stage !== undefined && !isBuilt(house, stage) && isInside(building, point);
    });
    if (!shut) return false;
    const stage = SHUT_UNTIL[shut.definition.id] as HouseUpgradeId;
    this.ctx.notice(
      `${shut.definition.name} is shut until it is built: ${HOUSE_UPGRADES[stage].name} is on the plans in ${BUILDINGS[HOUSE_BUILDING].name}.`,
    );
    return true;
  }

  deposit(itemId: ItemId, quantity = 1): void {
    if (this.open?.fixture.kind !== 'chest') return;
    const result = this.ctx.character.chestDeposit(itemId, quantity);
    if (!result.ok) {
      this.ctx.notice(result.reason);
      return;
    }
    this.settle();
  }

  withdraw(itemId: ItemId, quantity = 1): void {
    if (this.open?.fixture.kind !== 'chest') return;
    const result = this.ctx.character.chestWithdraw(itemId, quantity);
    if (!result.ok) {
      this.ctx.notice(result.reason);
      return;
    }
    if (result.left) {
      this.ctx.notice(`Your pack holds ${result.moved}; ${result.left} stay in the chest.`);
    }
    this.settle();
  }

  close(): void {
    if (!this.open) return;
    this.open = null;
    this.ctx.events.emit(HOUSE_CLOSED_EVENT);
  }

  /** The panel's X already took it down; just drop the state. */
  closedByUi(): void {
    this.open = null;
  }

  /** Walking out of the house shuts whatever in it is open. */
  updateRange(): void {
    if (this.open && !isInside(this.open.house, this.ctx.player)) this.close();
  }

  private takeBack(stand: number): void {
    const result = this.ctx.character.takeFromStand(stand);
    if (!result.ok) {
      this.ctx.notice(result.reason);
      return;
    }
    this.ctx.notice(`You take the ${describeItemName(result.itemId)} down.`);
    this.settle();
  }

  private settle(): void {
    this.publish();
    this.ctx.publishInventory();
    this.ctx.persistCharacter();
  }

  private publish(): void {
    const { house } = this.ctx.character.state;
    this.ctx.events.emit(HOUSE_CHANGED_EVENT, {
      stands: [...house.stands],
      chest: { ...house.chest },
      built: [...house.built],
    });
  }
}
