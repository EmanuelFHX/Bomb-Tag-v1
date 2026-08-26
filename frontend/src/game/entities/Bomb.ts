import Phaser from "phaser";
import { BOMB } from "../config";
import { Player } from "./Player";

export type BombState = "HELD" | "OUTBOUND" | "RETURNING";

export class Bomb {
  readonly shape: Phaser.GameObjects.Arc;
  readonly fuse: Phaser.GameObjects.Arc;
  readonly directionRing: Phaser.GameObjects.Arc;

  state: BombState = "HELD";
  owner: Player;
  responsible: Player;
  velocity = new Phaser.Math.Vector2();
  launchedAt = 0;
  ricochets = 0;
  canTransferAt = 0;
  speedMultiplier = 1;
  homingTarget: Player | null = null;
  isParryFlaming = false;
  breaksParry = false;

  private readonly scene: Phaser.Scene;
  private readonly trailGraphics: Phaser.GameObjects.Graphics;
  private readonly fireGraphics: Phaser.GameObjects.Graphics;
  private readonly trailPoints: Phaser.Math.Vector2[] = [];
  private nextTrailAt = 0;
  private lastVisualState: BombState | "" = "";

  constructor(scene: Phaser.Scene, owner: Player) {
    this.scene = scene;
    this.owner = owner;
    this.responsible = owner;
    this.shape = scene.add.circle(owner.x, owner.y, BOMB.radius, 0xffd240, 1);
    this.shape.setStrokeStyle(4, 0x1b1d22, 1);
    this.fuse = scene.add.circle(owner.x, owner.y, BOMB.radius + 7, 0xff5d4f, 0.12);
    this.fuse.setStrokeStyle(2, 0xff5d4f, 0.55);
    this.directionRing = scene.add.circle(owner.x, owner.y, BOMB.radius + 12, 0xffffff, 0);
    this.directionRing.setStrokeStyle(2, 0xffd240, 0);
    this.trailGraphics = scene.add.graphics();
    this.trailGraphics.setDepth(2);
    this.fireGraphics = scene.add.graphics();
    this.fireGraphics.setDepth(4);
    this.shape.setDepth(5);
    this.fuse.setDepth(4);
    this.directionRing.setDepth(4);

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
    this.homingTarget = null;
    this.breaksParry = false;
    this.setParryFlaming(false);
    this.syncHeldPosition();
    this.setVisible(true);
  }

  setVisible(isVisible: boolean) {
    this.shape.setVisible(isVisible);
    this.fuse.setVisible(isVisible);
    this.directionRing.setVisible(isVisible);
    this.trailGraphics.setVisible(isVisible);
    this.fireGraphics.setVisible(isVisible);
    if (!isVisible) {
      this.clearTrail();
      this.fireGraphics.clear();
    }
  }

  setIntensity(speedMultiplier: number) {
    this.speedMultiplier = speedMultiplier;
    const color = this.isParryFlaming ? 0xff5d1a : speedMultiplier >= 2 ? 0xff5d4f : speedMultiplier >= 1.5 ? 0xff8f3d : 0xffd240;
    this.shape.setFillStyle(color, 1);
    this.fuse.setStrokeStyle(2, color, speedMultiplier >= 1.5 ? 0.8 : 0.55);
  }

  setParryFlaming(isFlaming: boolean) {
    this.isParryFlaming = isFlaming;
    this.lastVisualState = "";
    this.setIntensity(this.speedMultiplier);
    if (!isFlaming) {
      this.fireGraphics.clear();
    }
    this.applyVisualState();
  }

  setHomingTarget(target: Player | null) {
    this.homingTarget = target;
  }

  launch(direction: Phaser.Math.Vector2, throwSpeedMultiplier = 1, breaksParry = false) {
    if (this.state !== "HELD" || direction.lengthSq() === 0) {
      return false;
    }

    this.state = "OUTBOUND";
    this.responsible = this.owner;
    this.velocity.copy(direction.normalize().scale(BOMB.speed * this.speedMultiplier * throwSpeedMultiplier));
    this.launchedAt = this.scene.time.now;
    this.ricochets = 0;
    this.canTransferAt = this.scene.time.now + BOMB.transferCooldownMs;
    this.homingTarget = null;
    this.breaksParry = breaksParry;
    this.setParryFlaming(false);
    if (breaksParry) {
      this.setParryFlaming(true);
    }
    this.clearTrail();
    this.applyVisualState();
    return true;
  }

  parryToward(parrier: Player, target: Player) {
    const direction = new Phaser.Math.Vector2(target.x - this.x, target.y - this.y);
    if (direction.lengthSq() === 0) {
      return false;
    }

    const currentSpeed = Math.max(this.velocity.length(), BOMB.speed * this.speedMultiplier);
    this.owner = parrier;
    this.responsible = parrier;
    this.state = "OUTBOUND";
    this.velocity.copy(direction.normalize().scale(currentSpeed * 1.08));
    this.launchedAt = this.scene.time.now;
    this.ricochets = 0;
    this.canTransferAt = this.scene.time.now + BOMB.parryTransferCooldownMs;
    this.homingTarget = target;
    this.breaksParry = false;
    this.setParryFlaming(true);
    this.clearTrail();
    this.applyVisualState();
    return true;
  }

  update(
    deltaSeconds: number,
    arena: Phaser.Geom.Rectangle,
    polygon?: Phaser.Geom.Polygon,
    polygonCenter?: Phaser.Math.Vector2
  ) {
    if (this.state === "HELD") {
      this.syncHeldPosition();
      return;
    }

    if (this.state === "OUTBOUND") {
      const flightTime = this.scene.time.now - this.launchedAt;
      if (flightTime > BOMB.maxTravelMs || this.ricochets >= BOMB.maxRicochetsBeforeReturn) {
        this.state = "RETURNING";
        this.applyVisualState();
      }
    }

    if (this.state === "RETURNING") {
      this.steerTowardOwner(deltaSeconds);
    } else if (this.homingTarget?.alive) {
      this.steerTowardTarget(this.homingTarget, deltaSeconds);
    }

    this.shape.x += this.velocity.x * deltaSeconds;
    this.shape.y += this.velocity.y * deltaSeconds;
    this.fuse.setPosition(this.shape.x, this.shape.y);
    this.directionRing.setPosition(this.shape.x, this.shape.y);
    this.resolveWallBounce(arena);
    if (polygon && polygonCenter) {
      this.resolvePolygonBounce(polygon, polygonCenter);
    }
    this.fuse.setPosition(this.shape.x, this.shape.y);
    this.directionRing.setPosition(this.shape.x, this.shape.y);
    this.updateTrail();
    this.updateFire();
  }

  playTransferBurst(isSpecial: boolean) {
    this.scene.tweens.add({
      targets: this.directionRing,
      scale: isSpecial ? 2.1 : 1.65,
      alpha: 0.8,
      duration: 80,
      yoyo: true,
      ease: "Quad.easeOut",
      onComplete: () => {
        this.directionRing.setScale(1);
        this.applyVisualState();
      }
    });
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

  updateRemoteVisuals() {
    if (this.state === "HELD") {
      this.clearTrail();
      this.updateFire();
      this.applyVisualState();
      return;
    }

    this.updateTrail();
    this.updateFire();
    this.applyVisualState();
  }

  private syncHeldPosition() {
    const offset = this.owner.aimDirection.clone().scale(BOMB.heldOffset);
    this.shape.setPosition(this.owner.x + offset.x, this.owner.y + offset.y);
    this.fuse.setPosition(this.shape.x, this.shape.y);
    this.directionRing.setPosition(this.shape.x, this.shape.y);
    this.updateFire();
    this.applyVisualState();
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

  private steerTowardTarget(target: Player, deltaSeconds: number) {
    const desired = new Phaser.Math.Vector2(target.x - this.x, target.y - this.y);
    if (desired.lengthSq() === 0) {
      return;
    }

    const currentSpeed = Math.max(this.velocity.length(), BOMB.speed * this.speedMultiplier);
    desired.normalize().scale(currentSpeed);
    const blend = Phaser.Math.Clamp(BOMB.specialHomingTurnRate * deltaSeconds, 0, 0.09);
    this.velocity.x = Phaser.Math.Linear(this.velocity.x, desired.x, blend);
    this.velocity.y = Phaser.Math.Linear(this.velocity.y, desired.y, blend);

    if (this.velocity.length() > currentSpeed) {
      this.velocity.setLength(currentSpeed);
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
      this.directionRing.setPosition(this.shape.x, this.shape.y);
      this.ricochets += 1;
      this.scene.tweens.add({
        targets: this.fuse,
        scale: 1.55,
        alpha: 0.4,
        duration: 90,
        yoyo: true,
        ease: "Quad.easeOut"
      });
      this.scene.tweens.add({
        targets: this.directionRing,
        scale: 1.45,
        alpha: 0.7,
        duration: 70,
        yoyo: true,
        ease: "Quad.easeOut",
        onComplete: () => {
          this.directionRing.setScale(1);
          this.applyVisualState();
        }
      });
    }
  }

  private resolvePolygonBounce(polygon: Phaser.Geom.Polygon, center: Phaser.Math.Vector2) {
    if (Phaser.Geom.Polygon.Contains(polygon, this.shape.x, this.shape.y)) {
      return;
    }

    const points = polygon.points as Phaser.Geom.Point[];
    let closest = new Phaser.Math.Vector2(this.shape.x, this.shape.y);
    let closestDistance = Number.POSITIVE_INFINITY;

    for (let index = 0; index < points.length; index += 1) {
      const start = points[index];
      const end = points[(index + 1) % points.length];
      const edge = new Phaser.Math.Vector2(end.x - start.x, end.y - start.y);
      const toBomb = new Phaser.Math.Vector2(this.shape.x - start.x, this.shape.y - start.y);
      const edgeLengthSq = Math.max(edge.lengthSq(), 1);
      const amount = Phaser.Math.Clamp(toBomb.dot(edge) / edgeLengthSq, 0, 1);
      const point = new Phaser.Math.Vector2(start.x + edge.x * amount, start.y + edge.y * amount);
      const distance = Phaser.Math.Distance.Squared(this.shape.x, this.shape.y, point.x, point.y);

      if (distance < closestDistance) {
        closestDistance = distance;
        closest = point;
      }
    }

    const inward = center.clone().subtract(closest);
    if (inward.lengthSq() === 0) {
      return;
    }

    inward.normalize();
    closest.add(inward.clone().scale(BOMB.radius + 4));
    this.shape.setPosition(closest.x, closest.y);
    this.fuse.setPosition(this.shape.x, this.shape.y);
    this.directionRing.setPosition(this.shape.x, this.shape.y);

    const dot = this.velocity.dot(inward);
    if (dot < 0) {
      this.velocity.subtract(inward.scale(2 * dot));
    }

    this.ricochets += 1;
    this.scene.tweens.add({
      targets: this.directionRing,
      scale: 1.45,
      alpha: 0.7,
      duration: 70,
      yoyo: true,
      ease: "Quad.easeOut",
      onComplete: () => {
        this.directionRing.setScale(1);
        this.applyVisualState();
      }
    });
  }

  private applyVisualState() {
    if (this.lastVisualState === this.state) {
      return;
    }

    this.lastVisualState = this.state;

    if (this.state === "RETURNING") {
      this.shape.setStrokeStyle(4, 0x86f7ff, 1);
      this.fuse.setStrokeStyle(2, 0x86f7ff, 0.8);
      this.directionRing.setStrokeStyle(2, 0x86f7ff, 0.5);
      return;
    }

    if (this.state === "OUTBOUND") {
      this.shape.setStrokeStyle(4, this.isParryFlaming ? 0xfff0a6 : 0x1b1d22, 1);
      this.fuse.setStrokeStyle(2, this.isParryFlaming ? 0xff5d1a : 0xffd240, this.isParryFlaming ? 0.95 : 0.65);
      this.directionRing.setStrokeStyle(2, this.isParryFlaming ? 0xff8f3d : 0xffd240, this.isParryFlaming ? 0.7 : 0.35);
      return;
    }

    this.directionRing.setStrokeStyle(2, 0xffd240, 0);
  }

  private updateTrail() {
    if (this.state === "HELD" || this.scene.time.now < this.nextTrailAt) {
      return;
    }

    this.nextTrailAt = this.scene.time.now + 20;
    this.trailPoints.push(new Phaser.Math.Vector2(this.shape.x, this.shape.y));
    if (this.trailPoints.length > 18) {
      this.trailPoints.shift();
    }
    this.drawTrail();
  }

  private drawTrail() {
    this.trailGraphics.clear();
    if (this.trailPoints.length < 2) {
      return;
    }

    const isReturning = this.state === "RETURNING";
    const color = this.isParryFlaming ? 0xff5d1a : isReturning ? 0x86f7ff : 0xffd240;
    for (let index = 1; index < this.trailPoints.length; index += 1) {
      const previous = this.trailPoints[index - 1];
      const point = this.trailPoints[index];
      const progress = index / (this.trailPoints.length - 1);
      this.trailGraphics.lineStyle(
        Phaser.Math.Linear(isReturning ? 3 : 4, this.isParryFlaming ? 13 : isReturning ? 8 : 10, progress),
        color,
        Phaser.Math.Linear(0.04, this.isParryFlaming ? 0.74 : isReturning ? 0.5 : 0.58, progress)
      );
      this.trailGraphics.beginPath();
      this.trailGraphics.moveTo(previous.x, previous.y);
      this.trailGraphics.lineTo(point.x, point.y);
      this.trailGraphics.strokePath();

      if (this.isParryFlaming) {
        this.trailGraphics.lineStyle(
          Phaser.Math.Linear(1, 4, progress),
          0xffcf33,
          Phaser.Math.Linear(0.02, 0.46, progress)
        );
        this.trailGraphics.beginPath();
        this.trailGraphics.moveTo(previous.x, previous.y);
        this.trailGraphics.lineTo(point.x, point.y);
        this.trailGraphics.strokePath();
      }
    }
  }

  private updateFire() {
    this.fireGraphics.clear();
    if (!this.isParryFlaming || this.state === "HELD" || !this.shape.visible) {
      return;
    }

    const time = this.scene.time.now * 0.018;
    const speedAngle = this.velocity.lengthSq() > 0 ? this.velocity.angle() : 0;
    for (let index = 0; index < 8; index += 1) {
      const angle = speedAngle + Math.PI + (index - 3.5) * 0.34 + Math.sin(time + index) * 0.08;
      const distance = 13 + Math.sin(time * 1.3 + index) * 5;
      const radius = 7 + Math.sin(time * 1.7 + index * 2) * 2;
      const x = this.shape.x + Math.cos(angle) * distance;
      const y = this.shape.y + Math.sin(angle) * distance;
      this.fireGraphics.fillStyle(index % 2 === 0 ? 0xff5d1a : 0xffcf33, index % 2 === 0 ? 0.42 : 0.34);
      this.fireGraphics.fillCircle(x, y, radius);
    }
  }

  private clearTrail() {
    this.trailPoints.length = 0;
    this.trailGraphics.clear();
  }
}
