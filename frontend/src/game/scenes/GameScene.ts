import Phaser from "phaser";
import { ARENA, BOMB, BOT, GAME_HEIGHT, GAME_WIDTH, PLAYER } from "../config";
import { Bomb } from "../entities/Bomb";
import { Player } from "../entities/Player";
import { InputSystem } from "../systems/InputSystem";

const PLAYER_COLORS = [0x59d8ff, 0xff5d4f, 0x7cf17c, 0xffb84d, 0xb68cff, 0xff76bd];

export class GameScene extends Phaser.Scene {
  private inputSystem!: InputSystem;
  private players: Player[] = [];
  private human!: Player;
  private bomb!: Bomb;
  private arenaRect!: Phaser.Geom.Rectangle;
  private graphics!: Phaser.GameObjects.Graphics;
  private hudTimer!: Phaser.GameObjects.Text;
  private hudOwner!: Phaser.GameObjects.Text;
  private hudDash!: Phaser.GameObjects.Text;
  private roundEndsAt = 0;
  private gameOver = false;

  constructor() {
    super("GameScene");
  }

  create() {
    this.inputSystem = new InputSystem(this);
    this.arenaRect = new Phaser.Geom.Rectangle(ARENA.x, ARENA.y, ARENA.width, ARENA.height);
    this.graphics = this.add.graphics();
    this.createArena();
    this.createPlayers();
    this.bomb = new Bomb(this, this.human);
    this.roundEndsAt = this.time.now + BOMB.timerSeconds * 1000;
    this.createHud();

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown()) {
        this.bomb.launch(this.human.aimDirection.clone());
      }
    });
  }

  update(_time: number, delta: number) {
    if (this.gameOver) {
      return;
    }

    const deltaSeconds = delta / 1000;
    const pointer = this.input.activePointer;
    const pointerWorld = new Phaser.Math.Vector2(pointer.worldX, pointer.worldY);
    const moveDirection = this.inputSystem.getMoveDirection();

    this.human.updateHuman(
      deltaSeconds,
      moveDirection,
      pointerWorld,
      this.inputSystem.consumeDashPressed()
    );

    for (const player of this.players) {
      if (player.kind === "bot") {
        player.updateBot(deltaSeconds, this.human);
      }
      player.keepInside(this.arenaRect);
    }

    this.updateBotThrows();
    this.bomb.update(deltaSeconds, this.arenaRect);
    this.resolveBombHits();
    this.bomb.tryCatchOwner();
    this.resolveCountdown();
    this.updateHud();
  }

  private createArena() {
    this.graphics.clear();
    this.graphics.fillStyle(0x1c2029, 1);
    this.graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    this.graphics.fillStyle(0x11141b, 1);
    this.graphics.fillRoundedRect(ARENA.x, ARENA.y, ARENA.width, ARENA.height, 8);

    this.graphics.lineStyle(ARENA.wallThickness, 0x343946, 1);
    this.graphics.strokeRect(ARENA.x, ARENA.y, ARENA.width, ARENA.height);

    this.graphics.lineStyle(1, 0xffffff, 0.06);
    for (let x = ARENA.x + 80; x < ARENA.x + ARENA.width; x += 80) {
      this.graphics.lineBetween(x, ARENA.y, x, ARENA.y + ARENA.height);
    }
    for (let y = ARENA.y + 80; y < ARENA.y + ARENA.height; y += 80) {
      this.graphics.lineBetween(ARENA.x, y, ARENA.x + ARENA.width, y);
    }
  }

  private createPlayers() {
    this.human = new Player(this, "p1", "human", "YOU", 270, 360, PLAYER_COLORS[0]);
    this.players.push(this.human);

    const botPositions = [
      [920, 210],
      [990, 510],
      [650, 180],
      [760, 560],
      [450, 535]
    ];

    for (let index = 0; index < BOT.count; index += 1) {
      const [x, y] = botPositions[index];
      this.players.push(
        new Player(this, `bot-${index + 1}`, "bot", `BOT ${index + 1}`, x, y, PLAYER_COLORS[index + 1])
      );
    }

    this.human.setBombHolder(true);
  }

  private createHud() {
    const baseStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      color: "#f7f8ff",
      fontFamily: "ui-sans-serif, system-ui",
      fontSize: "18px",
      fontStyle: "700"
    };

    this.hudTimer = this.add.text(ARENA.x, 18, "10.0s", {
      ...baseStyle,
      fontSize: "28px"
    });
    this.hudTimer.setData("tabular", true);

    this.hudOwner = this.add.text(ARENA.x + 142, 28, "BOMB: YOU", baseStyle);
    this.hudDash = this.add.text(GAME_WIDTH - 245, 28, "DASH: ◆ ◆", baseStyle);
    this.add.text(
      ARENA.x,
      GAME_HEIGHT - 34,
      "WASD move  |  Mouse aim  |  Left click throw  |  Shift/Space dash",
      {
        color: "#b9bfcd",
        fontFamily: "ui-sans-serif, system-ui",
        fontSize: "14px"
      }
    );
  }

  private updateBotThrows() {
    if (this.bomb.state !== "HELD" || this.bomb.owner.kind !== "bot") {
      return;
    }

    const owner = this.bomb.owner;
    const distanceToHuman = Phaser.Math.Distance.Between(owner.x, owner.y, this.human.x, this.human.y);
    const timeLeft = this.roundEndsAt - this.time.now;

    if (distanceToHuman < 700 || timeLeft < 3500) {
      this.bomb.launch(owner.aimDirection.clone());
    }
  }

  private resolveBombHits() {
    if (this.bomb.state === "HELD" || this.time.now < this.bomb.canTransferAt) {
      return;
    }

    for (const player of this.players) {
      if (!player.alive || player === this.bomb.owner || player.isInvulnerable) {
        continue;
      }

      const distance = Phaser.Math.Distance.Between(this.bomb.x, this.bomb.y, player.x, player.y);
      if (distance <= BOMB.radius + PLAYER.radius) {
        this.transferBomb(player);
        break;
      }
    }
  }

  private transferBomb(nextOwner: Player) {
    for (const player of this.players) {
      player.setBombHolder(player === nextOwner);
    }

    this.bomb.setOwner(nextOwner);
    this.cameras.main.flash(80, 255, 210, 64, false);
  }

  private resolveCountdown() {
    const remainingMs = this.roundEndsAt - this.time.now;
    if (remainingMs > 0) {
      return;
    }

    const eliminated = this.bomb.responsible;
    eliminated.setEliminated();
    this.bomb.shape.setVisible(false);
    this.bomb.fuse.setVisible(false);
    this.gameOver = true;

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, `${eliminated.name} ELIMINATED`, {
        color: "#ff5d4f",
        fontFamily: "ui-sans-serif, system-ui",
        fontSize: "42px",
        fontStyle: "900"
      })
      .setOrigin(0.5);
  }

  private updateHud() {
    const remaining = Math.max(0, (this.roundEndsAt - this.time.now) / 1000);
    this.hudTimer.setText(`${remaining.toFixed(1)}s`);
    this.hudOwner.setText(`BOMB: ${this.bomb.responsible.name}`);
    this.hudDash.setText(`DASH: ${this.getDashText()}`);

    const pulse = 1 + (1 - remaining / BOMB.timerSeconds) * 0.42;
    this.bomb.fuse.setScale(pulse);

    if (remaining < 3) {
      this.hudTimer.setColor("#ff766b");
    }
  }

  private getDashText() {
    const ready = this.human.dashChargeCount;
    return Array.from({ length: PLAYER.dashCharges }, (_, index) => (index < ready ? "◆" : "◇")).join(" ");
  }
}
