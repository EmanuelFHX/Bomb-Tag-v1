import Phaser from "phaser";

export class InputSystem {
  readonly keys: Record<"w" | "a" | "s" | "d" | "shift" | "space", Phaser.Input.Keyboard.Key>;
  private wasDashDown = false;

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
      space: Phaser.Input.Keyboard.KeyCodes.SPACE
    }) as Record<"w" | "a" | "s" | "d" | "shift" | "space", Phaser.Input.Keyboard.Key>;
  }

  getMoveDirection() {
    const direction = new Phaser.Math.Vector2(0, 0);

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
    const pressed = isDown && !this.wasDashDown;
    this.wasDashDown = isDown;
    return pressed;
  }
}

