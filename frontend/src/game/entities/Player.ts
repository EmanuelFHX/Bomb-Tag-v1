import Phaser from "phaser";
import { BOT, PLAYER } from "../config";

export type PlayerKind = "human" | "bot";

type DashCharge = {
  readyAt: number;
};

export class Player {
  readonly id: string;
  readonly kind: PlayerKind;
  readonly name: string;
  readonly color: number;
  readonly container: Phaser.GameObjects.Container;
  readonly body: Phaser.GameObjects.Arc;
  readonly aim: Phaser.GameObjects.Rectangle;
  readonly label: Phaser.GameObjects.Text;
  readonly bombHalo: Phaser.GameObjects.Arc;
  readonly dashWake: Phaser.GameObjects.Ellipse;

  velocity = new Phaser.Math.Vector2();
  aimDirection = new Phaser.Math.Vector2(1, 0);
  alive = true;

  private readonly scene: Phaser.Scene;
  private readonly charges: DashCharge[];
  private dashUntil = 0;
  private invulnerableUntil = 0;
  private botDirection = new Phaser.Math.Vector2(1, 0);
  private nextBotDecisionAt = 0;
  private readonly afterimages: Phaser.GameObjects.Arc[] = [];
  private afterimageIndex = 0;
  private nextAfterimageAt = 0;

  constructor(
    scene: Phaser.Scene,
    id: string,
    kind: PlayerKind,
    name: string,
    x: number,
    y: number,
    color: number
  ) {
    this.scene = scene;
    this.id = id;
    this.kind = kind;
    this.name = name;
    this.color = color;
    this.charges = Array.from({ length: PLAYER.dashCharges }, () => ({ readyAt: 0 }));

    this.bombHalo = scene.add.circle(0, 0, PLAYER.radius + 8, 0xffcf33, 0.18);
    this.bombHalo.setStrokeStyle(3, 0xffcf33, 0.75);
    this.bombHalo.setVisible(false);

    this.dashWake = scene.add.ellipse(0, 0, PLAYER.radius * 2.9, PLAYER.radius * 1.2, 0x8defff, 0);
    this.dashWake.setVisible(false);

    this.body = scene.add.circle(0, 0, PLAYER.radius, color, 1);
    this.body.setStrokeStyle(3, 0xffffff, kind === "human" ? 0.9 : 0.35);

    this.aim = scene.add.rectangle(PLAYER.radius + 14, 0, 34, 5, 0xffffff, 0.82);
    this.aim.setOrigin(0, 0.5);

    this.label = scene.add.text(0, -38, name, {
      color: "#f7f8ff",
      fontFamily: "ui-sans-serif, system-ui",
      fontSize: "13px",
      fontStyle: kind === "human" ? "700" : "500"
    });
    this.label.setOrigin(0.5);

    this.container = scene.add.container(x, y, [this.dashWake, this.bombHalo, this.body, this.aim, this.label]);

    for (let index = 0; index < 5; index += 1) {
      const afterimage = scene.add.circle(x, y, PLAYER.radius, color, 0);
      afterimage.setDepth(-0.5);
      afterimage.setVisible(false);
      this.afterimages.push(afterimage);
    }
  }

  get x() {
    return this.container.x;
  }

  get y() {
    return this.container.y;
  }

  get isDashing() {
    return this.scene.time.now < this.dashUntil;
  }

  get isInvulnerable() {
    return this.scene.time.now < this.invulnerableUntil;
  }

  get dashChargeCount() {
    const now = this.scene.time.now;
    return this.charges.filter((charge) => charge.readyAt <= now).length;
  }

  setBombHolder(isHolder: boolean) {
    this.bombHalo.setVisible(isHolder);
  }

  setEliminated() {
    this.alive = false;
    this.velocity.set(0, 0);
    this.container.setAlpha(0.2);
    this.container.setScale(0.72);
    this.container.setVisible(false);
  }

  tryDash(direction: Phaser.Math.Vector2) {
    const now = this.scene.time.now;
    const charge = this.charges.find((item) => item.readyAt <= now);

    if (!charge || direction.lengthSq() === 0 || !this.alive) {
      return false;
    }

    charge.readyAt = now + PLAYER.dashCooldownMs;
    this.dashUntil = now + PLAYER.dashDurationMs;
    this.invulnerableUntil = now + PLAYER.dashInvulnerabilityMs;
    this.velocity.copy(direction.normalize().scale(PLAYER.dashSpeed));
    this.dashWake.setRotation(direction.angle());
    this.dashWake.setVisible(true);
    this.dashWake.setAlpha(0.45);
    this.scene.tweens.add({
      targets: this.body,
      scaleX: 1.25,
      scaleY: 0.82,
      duration: 80,
      yoyo: true,
      ease: "Quad.easeOut"
    });
    this.scene.tweens.add({
      targets: this.dashWake,
      scaleX: 1.7,
      scaleY: 0.55,
      alpha: 0,
      duration: PLAYER.dashDurationMs,
      ease: "Quad.easeOut",
      onComplete: () => {
        this.dashWake.setVisible(false);
        this.dashWake.setScale(1);
      }
    });

    return true;
  }

  updateHuman(
    deltaSeconds: number,
    moveDirection: Phaser.Math.Vector2,
    pointerWorld: Phaser.Math.Vector2,
    dashPressed: boolean
  ) {
    if (!this.alive) {
      return;
    }

    this.updateAim(pointerWorld.x - this.x, pointerWorld.y - this.y);

    if (dashPressed) {
      const dashDirection =
        moveDirection.lengthSq() > 0 ? moveDirection.clone() : this.aimDirection.clone();
      this.tryDash(dashDirection);
    }

    if (!this.isDashing) {
      this.applyMovement(deltaSeconds, moveDirection, PLAYER.maxSpeed);
    }

    this.updateVisualState();
  }

  updateBot(
    deltaSeconds: number,
    aimTarget: Phaser.Math.Vector2,
    moveDirection: Phaser.Math.Vector2,
    dashRequested: boolean
  ) {
    if (!this.alive) {
      return;
    }

    const now = this.scene.time.now;
    if (moveDirection.lengthSq() > 0) {
      this.botDirection.copy(moveDirection).normalize();
    } else if (now >= this.nextBotDecisionAt) {
      this.nextBotDecisionAt = now + BOT.directionChangeMs + Phaser.Math.Between(-250, 250);
      this.botDirection.set(Phaser.Math.FloatBetween(-1, 1), Phaser.Math.FloatBetween(-1, 1));
      if (this.botDirection.lengthSq() > 0) {
        this.botDirection.normalize();
      }
    }

    this.updateAim(aimTarget.x - this.x, aimTarget.y - this.y);
    if (dashRequested) {
      this.tryDash(this.botDirection.clone());
    }

    this.applyMovement(deltaSeconds, this.botDirection, BOT.maxSpeed);
    this.updateVisualState();
  }

  keepInside(rect: Phaser.Geom.Rectangle) {
    const minX = rect.left + PLAYER.radius;
    const maxX = rect.right - PLAYER.radius;
    const minY = rect.top + PLAYER.radius;
    const maxY = rect.bottom - PLAYER.radius;
    const nextX = Phaser.Math.Clamp(this.x, minX, maxX);
    const nextY = Phaser.Math.Clamp(this.y, minY, maxY);

    if (nextX !== this.x) {
      this.velocity.x *= -0.35;
    }
    if (nextY !== this.y) {
      this.velocity.y *= -0.35;
    }

    this.container.setPosition(nextX, nextY);
  }

  private applyMovement(deltaSeconds: number, direction: Phaser.Math.Vector2, maxSpeed: number) {
    if (direction.lengthSq() > 0) {
      const acceleration = direction.clone().normalize().scale(PLAYER.acceleration * deltaSeconds);
      this.velocity.add(acceleration);
    } else {
      this.velocity.scale(Math.pow(PLAYER.drag, deltaSeconds * 60));
    }

    if (this.velocity.length() > maxSpeed) {
      this.velocity.setLength(maxSpeed);
    }

    this.container.x += this.velocity.x * deltaSeconds;
    this.container.y += this.velocity.y * deltaSeconds;
    this.spawnDashAfterimage();
  }

  private updateAim(x: number, y: number) {
    if (x === 0 && y === 0) {
      return;
    }

    this.aimDirection.set(x, y).normalize();
    this.aim.rotation = this.aimDirection.angle();
  }

  private updateVisualState() {
    const alpha = this.isInvulnerable ? 0.52 : 1;
    this.body.setAlpha(alpha);
    this.aim.setAlpha(this.kind === "human" ? 0.9 : 0.38);
  }

  private spawnDashAfterimage() {
    if (!this.isDashing || this.scene.time.now < this.nextAfterimageAt) {
      return;
    }

    this.nextAfterimageAt = this.scene.time.now + 28;
    const afterimage = this.afterimages[this.afterimageIndex];
    afterimage.setPosition(this.x, this.y);
    afterimage.setFillStyle(this.color, this.kind === "human" ? 0.28 : 0.16);
    afterimage.setScale(1);
    afterimage.setAlpha(this.kind === "human" ? 0.28 : 0.16);
    afterimage.setVisible(true);
    this.scene.tweens.killTweensOf(afterimage);
    this.scene.tweens.add({
      targets: afterimage,
      scale: 1.6,
      alpha: 0,
      duration: 160,
      ease: "Quad.easeOut"
    });
    this.afterimageIndex = (this.afterimageIndex + 1) % this.afterimages.length;
  }
}
