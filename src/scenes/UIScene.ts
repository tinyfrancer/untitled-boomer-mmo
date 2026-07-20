import Phaser from 'phaser';
import { TargetFrame } from '../ui/TargetFrame';
import { TARGET_CLEARED_EVENT, TARGET_SELECTED_EVENT } from '../ui/uiEvents';

export class UIScene extends Phaser.Scene {
  private targetFrame!: TargetFrame;

  constructor() {
    super('UI');
  }

  create(): void {
    this.targetFrame = new TargetFrame(this, 16, 16);

    this.game.events.on(TARGET_SELECTED_EVENT, this.handleTargetSelected, this);
    this.game.events.on(TARGET_CLEARED_EVENT, this.handleTargetCleared, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(TARGET_SELECTED_EVENT, this.handleTargetSelected, this);
      this.game.events.off(TARGET_CLEARED_EVENT, this.handleTargetCleared, this);
    });
  }

  private handleTargetSelected = (name: string, hp: number, maxHp: number): void => {
    this.targetFrame.show(name, hp, maxHp);
  };

  private handleTargetCleared = (): void => {
    this.targetFrame.hide();
  };
}
