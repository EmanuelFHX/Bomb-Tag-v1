import Phaser from "phaser";

type InputKey = "w" | "a" | "s" | "d" | "shift" | "space" | "r";

export class InputSystem {
  readonly keys: Record<InputKey, Phaser.Input.Keyboard.Key>;
  private wasDashDown = false;
  private wasRestartDown = false;
  private virtualMoveDirection = new Phaser.Math.Vector2(0, 0);
  private virtualDashQueued = false;

  constructor(scene: Phaser.Scene) {
    if (!scene.input.keyboard) {
      throw new Error("Keyboard input is not available.");
    }

    this.keys = scene.input.keyboard.addKeys({
      w: Phaser.Input.Keyboard.KeyCodes.W,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      s: Phaser.Input.Keyboard.KeyCodes.S,
      d: Phaser.Input.Keyboard.KeyCodes.D,
      shift: Phaser.Input.Keyboard.KeyCodes.SHIFT,
      space: Phaser.Input.Keyboard.KeyCodes.SPACE,
      r: Phaser.Input.Keyboard.KeyCodes.R
    }) as Record<InputKey, Phaser.Input.Keyboard.Key>;
  }

  getMoveDirection() {
    const direction = this.virtualMoveDirection.clone();

    if (this.keys.w.isDown) direction.y -= 1;
    if (this.keys.s.isDown) direction.y += 1;
    if (this.keys.a.isDown) direction.x -= 1;
    if (this.keys.d.isDown) direction.x += 1;

    if (direction.lengthSq() > 0) {
      direction.normalize();
    }

    return direction;
  }

  consumeDashPressed() {
    const isDown = this.keys.shift.isDown || this.keys.space.isDown;
    const pressed = (isDown && !this.wasDashDown) || this.virtualDashQueued;
    this.wasDashDown = isDown;
    this.virtualDashQueued = false;
    return pressed;
  }

  consumeRestartPressed() {
    const isDown = this.keys.r.isDown;
    const pressed = isDown && !this.wasRestartDown;
    this.wasRestartDown = isDown;
    return pressed;
  }

  setVirtualMoveDirection(direction: Phaser.Math.Vector2) {
    this.virtualMoveDirection.copy(direction);
  }

  queueVirtualDash() {
    this.virtualDashQueued = true;
  }
}
