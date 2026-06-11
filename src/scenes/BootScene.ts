import Phaser from 'phaser';
import { SCENES } from '../config/game-config';

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENES.BOOT);
  }

  create(): void {
    // Two extra pointers: left-thumb joystick + right-thumb drawing simultaneously.
    this.input.addPointer(2);
    this.input.mouse?.disableContextMenu();
    this.scene.start(SCENES.PRELOAD);
  }
}
