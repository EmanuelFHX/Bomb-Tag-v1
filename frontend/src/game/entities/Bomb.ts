import Phaser from "phaser";
import { BOMB } from "../config";
import { Player } from "./Player";

export type BombState = "HELD" | "OUTBOUND" | "RETURNING";

export class Bomb {
  readonly shape: Phaser.GameObjects.Arc;
  readonly fuse: Phaser.GameObjects.Arc;

  state: BombState = "HELD";
  owner: Player;
  responsible: Player;
  velocity = new Phaser.Math.Vector2();
  launchedAt = 0;
  ricochets = 0;
  canTransferAt = 0;
  speedMultiplier = 1;

  private readonly scene: Phaser.Scene;

  constructor(scene: Phaser.Scene, owner: Player) {
    this.scene = scene;
    this.owner = owner;
    this.responsible = owner;
    this.shape = scene.add.circle(owner.x, owner.y, BOMB.radius, 0xffd240, 1);
    this.shape.setStrokeStyle(4, 0x1b1d22, 1);
    this.fuse = scene.add.circle(owner.x, owner.y, BOMB.radius + 7, 0xff5d4f, 0.12);
    this.fuse.setStrokeStyle(2, 0xff5d4f, 0.55);
    this.syncHeldPosition();
  }

  get x() {
    return this.shape.x;
  }

  get y() {
    return this.shape.y;
  }

  setOwner(player: Player) {
    this.owner = player;
    this.responsible = player;
    this.state = "HELD";
    this.velocity.set(0, 0);
    this.ricochets = 0;
    this.canTransferAt = this.scene.time.now + BOMB.transferCooldownMs;
    this.syncHeldPosition();
    this.setVisible(true);
  }

  setVisible(isVisible: boolean) {
    this.shape.setVisible(isVisible);
    this.fuse.setVisible(isVisible);
  }

  setIntensity(speedMultiplier: number) {
    this.speedMultiplier = speedMultiplier;
  }

  launch(direction: Phaser.Math.Vector2) {
    if (this.state !== "HELD" || direction.lengthSq() === 0) {
      return false;
    }

    this.state = "OUTBOUND";
    this.responsible = this.owner;
    this.velocity.copy(direction.normalize().scale(BOMB.speed * this.speedMultiplier));
    this.launchedAt = this.scene.time.now;
    this.ricochets = 0;
    this.canTransferAt = this.scene.time.now + BOMB.transferCooldownMs;
    return true;
  }

  update(deltaSeconds: number, arena: Phaser.Geom.Rectangle) {
    if (this.state === "HELD") {
      this.syncHeldPosition();
      return;
    }

    if (this.state === "OUTBOUND") {
      const flightTime = this.scene.time.now - this.launchedAt;
      if (flightTime > BOMB.maxTravelMs || this.ricochets >= BOMB.maxRicochetsBeforeReturn) {
        this.state = "RETURNING";
      }
    }

    if (this.state === "RETURNING") {
      this.steerTowardOwner(deltaSeconds);
    }

    this.shape.x += this.velocity.x * deltaSeconds;
    this.shape.y += this.velocity.y * deltaSeconds;
    this.fuse.setPosition(this.shape.x, this.shape.y);
    this.resolveWallBounce(arena);
  }

  tryCatchOwner() {
    if (this.state !== "RETURNING") {
      return false;
    }

    const distance = Phaser.Math.Distance.Between(this.x, this.y, this.owner.x, this.owner.y);
    if (distance <= BOMB.ownerCatchDistance) {
      this.setOwner(this.owner);
      return true;
    }

    return false;
  }

  private syncHeldPosition() {
    const offset = this.owner.aimDirection.clone().scale(BOMB.heldOffset);
    this.shape.setPosition(this.owner.x + offset.x, this.owner.y + offset.y);
    this.fuse.setPosition(this.shape.x, this.shape.y);
  }

  private steerTowardOwner(deltaSeconds: number) {
    const desired = new Phaser.Math.Vector2(this.owner.x - this.x, this.owner.y - this.y);
    if (desired.lengthSq() === 0) {
      return;
    }

    desired.normalize().scale(BOMB.returnSpeed * this.speedMultiplier);
    const blend = Phaser.Math.Clamp(BOMB.returnTurnRate * deltaSeconds, 0, 0.16);
    this.velocity.x = Phaser.Math.Linear(this.velocity.x, desired.x, blend);
    this.velocity.y = Phaser.Math.Linear(this.velocity.y, desired.y, blend);

    const maxReturnSpeed = BOMB.returnSpeed * this.speedMultiplier;
    if (this.velocity.length() > maxReturnSpeed) {
      this.velocity.setLength(maxReturnSpeed);
    }
  }

  private resolveWallBounce(arena: Phaser.Geom.Rectangle) {
    let bounced = false;
    const minX = arena.left + BOMB.radius;
    const maxX = arena.right - BOMB.radius;
    const minY = arena.top + BOMB.radius;
    const maxY = arena.bottom - BOMB.radius;

    if (this.shape.x <= minX || this.shape.x >= maxX) {
      this.shape.x = Phaser.Math.Clamp(this.shape.x, minX, maxX);
      this.velocity.x *= -1;
      bounced = true;
    }

    if (this.shape.y <= minY || this.shape.y >= maxY) {
      this.shape.y = Phaser.Math.Clamp(this.shape.y, minY, maxY);
      this.velocity.y *= -1;
      bounced = true;
    }

    if (bounced) {
      this.fuse.setPosition(this.shape.x, this.shape.y);
      this.ricochets += 1;
      this.scene.tweens.add({
        targets: this.fuse,
        scale: 1.55,
        alpha: 0.4,
        duration: 90,
        yoyo: true,
        ease: "Quad.easeOut"
      });
    }
  }
}
