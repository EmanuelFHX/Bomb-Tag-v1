import Phaser from "phaser";
import { ARENA, BOMB, BOT, GAME_HEIGHT, GAME_WIDTH, PLAYER, ROUND_STAGES } from "../config";
import { Bomb } from "../entities/Bomb";
import { Player } from "../entities/Player";
import { AudioSystem } from "../systems/AudioSystem";
import { InputSystem } from "../systems/InputSystem";

const PLAYER_COLORS = [
  0x59d8ff,
  0xff5d4f,
  0x7cf17c,
  0xffb84d,
  0xb68cff,
  0xff76bd,
  0x66f2cf,
  0xf1f765
];

type BotIntent = {
  aimTarget: Phaser.Math.Vector2;
  moveDirection: Phaser.Math.Vector2;
  shouldDash: boolean;
};

type Language = "en" | "pt";

const TEXT = {
  en: {
    humanName: "YOU",
    bomb: "BOMB",
    players: "PLAYERS",
    stage: "STAGE",
    dash: "DASH",
    opening: "OPENING",
    pressure: "PRESSURE",
    panic: "PANIC",
    special: "SPECIAL",
    finalDuel: "FINAL DUEL",
    playersRemain: (count: number) => `${count} PLAYERS REMAIN`,
    threePlayers: "3 PLAYERS LEFT\nDASH RECHARGES OVER TIME",
    eliminated: (name: string) => `${name} ELIMINATED`,
    wins: (name: string) => `${name} WINS\nR TO REMATCH`,
    controls: "WASD move  |  Mouse aim  |  Left click throw  |  Shift/Space dash  |  R rematch",
    language: "EN"
  },
  pt: {
    humanName: "VOCE",
    bomb: "BOMBA",
    players: "JOGADORES",
    stage: "RODADA",
    dash: "DASH",
    opening: "INICIO",
    pressure: "PRESSAO",
    panic: "PANICO",
    special: "ESPECIAL",
    finalDuel: "DUELO FINAL",
    playersRemain: (count: number) => `${count} JOGADORES RESTANTES`,
    threePlayers: "3 JOGADORES RESTANTES\nDASH RECARREGA COM O TEMPO",
    eliminated: (name: string) => `${name} ELIMINADO`,
    wins: (name: string) => `${name} VENCEU\nR PARA REVANCHE`,
    controls: "WASD mover  |  Mouse mirar  |  Clique esquerdo lancar  |  Shift/Espaco dash  |  R revanche",
    language: "PT"
  }
} as const;

export class GameScene extends Phaser.Scene {
  private inputSystem!: InputSystem;
  private players: Player[] = [];
  private human!: Player;
  private bomb!: Bomb;
  private audio!: AudioSystem;
  private arenaRect!: Phaser.Geom.Rectangle;
  private graphics!: Phaser.GameObjects.Graphics;
  private hudTimer!: Phaser.GameObjects.Text;
  private hudOwner!: Phaser.GameObjects.Text;
  private hudStage!: Phaser.GameObjects.Text;
  private hudPlayers!: Phaser.GameObjects.Text;
  private hudDashLabel!: Phaser.GameObjects.Text;
  private helpText!: Phaser.GameObjects.Text;
  private languageButton!: Phaser.GameObjects.Container;
  private languageLabel!: Phaser.GameObjects.Text;
  private dashSlots: Phaser.GameObjects.Rectangle[] = [];
  private dashSlotFills: Phaser.GameObjects.Rectangle[] = [];
  private dangerOverlay!: Phaser.GameObjects.Rectangle;
  private roundMessagePanel!: Phaser.GameObjects.Rectangle;
  private roundMessage!: Phaser.GameObjects.Text;
  private currentRoundMessageKey: "playersRemain" | "threePlayers" | "finalDuel" | "matchOver" | "" = "";
  private roundEndsAt = 0;
  private roundTimerSeconds: number = BOMB.timerSeconds;
  private roundResolving = false;
  private matchOver = false;
  private nextHudUpdateAt = 0;
  private lastTimerText = "";
  private lastOwnerText = "";
  private lastPlayersText = "";
  private lastStageText = "";
  private lastDashReady = -1;
  private language: Language = "en";
  private winner?: Player;
  private nextCriticalPulseAt = 0;
  private botThrowReadyAt = new Map<string, number>();

  constructor() {
    super("GameScene");
  }

  create() {
    this.inputSystem = new InputSystem(this);
    this.audio = new AudioSystem();
    this.arenaRect = new Phaser.Geom.Rectangle(ARENA.x, ARENA.y, ARENA.width, ARENA.height);
    this.graphics = this.add.graphics();
    this.createArena(BOT.count + 1);
    this.createPlayers();
    this.bomb = new Bomb(this, this.human);
    this.createHud();
    this.startRound(BOT.count + 1);

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.audio.unlock();
      if (pointer.leftButtonDown() && !this.roundResolving && !this.matchOver) {
        this.bomb.launch(this.human.aimDirection.clone());
      }
    });
    this.input.keyboard?.on("keydown", () => this.audio.unlock());
  }

  update(_time: number, delta: number) {
    if (this.matchOver) {
      if (this.inputSystem.consumeRestartPressed()) {
        this.scene.restart();
      }
      return;
    }

    if (this.roundResolving) {
      this.updateHud(false);
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
        const intent = this.getBotIntent(player);
        player.updateBot(deltaSeconds, intent.aimTarget, intent.moveDirection, intent.shouldDash);
      }
      player.keepInside(this.arenaRect);
    }

    this.updateBotThrows();
    this.bomb.update(deltaSeconds, this.arenaRect);
    this.resolveBombHits();
    this.bomb.tryCatchOwner();
    this.resolveCountdown();
    this.updateHud(false);
  }

  private createArena(aliveCount: number) {
    const palette = this.getArenaPalette(aliveCount);
    this.arenaRect = this.getArenaBounds(aliveCount);
    this.graphics.clear();
    this.graphics.fillStyle(palette.outer, 1);
    this.graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    this.graphics.fillStyle(palette.floor, 1);
    this.graphics.fillRoundedRect(this.arenaRect.x, this.arenaRect.y, this.arenaRect.width, this.arenaRect.height, 8);

    this.graphics.lineStyle(ARENA.wallThickness, palette.wall, 1);
    this.graphics.strokeRect(this.arenaRect.x, this.arenaRect.y, this.arenaRect.width, this.arenaRect.height);

    this.graphics.lineStyle(1, palette.grid, 0.08);
    for (let x = this.arenaRect.x + 80; x < this.arenaRect.right; x += 80) {
      this.graphics.lineBetween(x, this.arenaRect.y, x, this.arenaRect.bottom);
    }
    for (let y = this.arenaRect.y + 80; y < this.arenaRect.bottom; y += 80) {
      this.graphics.lineBetween(this.arenaRect.x, y, this.arenaRect.right, y);
    }
  }

  private createPlayers() {
    this.human = new Player(this, "p1", "human", TEXT[this.language].humanName, 270, 360, PLAYER_COLORS[0]);
    this.players.push(this.human);

    const botPositions = [
      [920, 210],
      [990, 510],
      [650, 180],
      [760, 560],
      [450, 535],
      [520, 185],
      [1110, 360]
    ];

    for (let index = 0; index < BOT.count; index += 1) {
      const [x, y] = botPositions[index];
      this.players.push(
        new Player(this, `bot-${index + 1}`, "bot", `BOT ${index + 1}`, x, y, PLAYER_COLORS[index + 1])
      );
    }

    this.human.setBombHolder(false);
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

    this.hudOwner = this.add.text(ARENA.x + 142, 28, "", baseStyle);
    this.hudPlayers = this.add.text(ARENA.x + 320, 28, "", baseStyle);
    this.hudStage = this.add.text(ARENA.x + 500, 28, "", baseStyle);
    this.hudDashLabel = this.add.text(GAME_WIDTH - 332, 28, "", baseStyle);
    this.createDashHud();
    this.helpText = this.add.text(
      ARENA.x,
      GAME_HEIGHT - 34,
      "",
      {
        color: "#b9bfcd",
        fontFamily: "ui-sans-serif, system-ui",
        fontSize: "14px"
      }
    );

    this.dangerOverlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xff2f2f, 0);
    this.dangerOverlay.setDepth(8);

    this.roundMessagePanel = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 660, 136, 0x0c0f16, 0.82);
    this.roundMessagePanel.setStrokeStyle(2, 0xffffff, 0.12);
    this.roundMessagePanel.setDepth(9);
    this.roundMessagePanel.setVisible(false);

    this.roundMessage = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, "", {
        color: "#f7f8ff",
        fontFamily: "ui-sans-serif, system-ui",
        fontSize: "42px",
        fontStyle: "900"
      })
      .setOrigin(0.5)
      .setDepth(10)
      .setVisible(false);

    this.createLanguageButton();
    this.updateHud(true);
  }

  private updateBotThrows() {
    if (this.bomb.state !== "HELD" || this.bomb.owner.kind !== "bot") {
      return;
    }

    const owner = this.bomb.owner;
    const target = this.getNearestOpponent(owner);
    if (!target) {
      return;
    }

    const readyAt = this.botThrowReadyAt.get(owner.id) ?? 0;
    const distanceToTarget = Phaser.Math.Distance.Between(owner.x, owner.y, target.x, target.y);
    const timeLeft = this.roundEndsAt - this.time.now;

    if ((distanceToTarget < BOT.throwRange && this.time.now >= readyAt) || timeLeft < 3500) {
      this.bomb.launch(owner.aimDirection.clone());
      this.botThrowReadyAt.set(owner.id, this.time.now + BOT.throwDelayMs);
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
        const previousOwner = this.bomb.responsible;
        const bombState = this.bomb.state;
        const ricochets = this.bomb.ricochets;
        const remainingSeconds = Math.max(0, (this.roundEndsAt - this.time.now) / 1000);

        this.transferBomb(player);
        this.bomb.playTransferBurst(bombState === "RETURNING" || ricochets > 0 || remainingSeconds < 1);
        this.audio.playHit({
          nextOwner: player,
          previousOwner,
          bombState,
          ricochets,
          remainingSeconds,
          human: this.human
        });
        break;
      }
    }
  }

  private transferBomb(nextOwner: Player) {
    for (const player of this.players) {
      player.setBombHolder(player === nextOwner);
    }

    this.bomb.setOwner(nextOwner);
  }

  private resolveCountdown() {
    const remainingMs = this.roundEndsAt - this.time.now;
    if (remainingMs > 0 || this.roundResolving) {
      return;
    }

    const eliminated = this.bomb.responsible;
    const explosionX = eliminated.x;
    const explosionY = eliminated.y;
    eliminated.setEliminated();
    eliminated.setBombHolder(false);
    this.bomb.setVisible(false);
    this.roundResolving = true;
    this.cameras.main.shake(180, 0.008);
    this.playExplosion(explosionX, explosionY, eliminated.color);
    this.currentRoundMessageKey = "";
    this.showRoundMessage(TEXT[this.language].eliminated(this.getPlayerName(eliminated)), "#ff5d4f", 1100);

    const alivePlayers = this.getAlivePlayers();
    if (alivePlayers.length <= 1) {
      this.time.delayedCall(1300, () => this.endMatch(alivePlayers[0]));
      return;
    }

    this.time.delayedCall(1350, () => {
      this.startRound(alivePlayers.length);
    });
  }

  private updateHud(force: boolean) {
    if (!force && this.time.now < this.nextHudUpdateAt) {
      return;
    }

    this.nextHudUpdateAt = this.time.now + 80;
    const remaining = Math.max(0, (this.roundEndsAt - this.time.now) / 1000);
    const timerText = `${remaining.toFixed(1)}s`;
    const dictionary = TEXT[this.language];
    const ownerText = `${dictionary.bomb}: ${this.getPlayerName(this.bomb.responsible)}`;
    const aliveCount = this.getAlivePlayers().length;
    const playersText = `${dictionary.players}: ${aliveCount}`;
    const stageText = `${dictionary.stage}: ${this.getStageName(aliveCount)}`;

    this.setTextIfChanged(this.hudTimer, "lastTimerText", timerText);
    this.setTextIfChanged(this.hudOwner, "lastOwnerText", ownerText);
    this.setTextIfChanged(this.hudPlayers, "lastPlayersText", playersText);
    this.setTextIfChanged(this.hudStage, "lastStageText", stageText);
    this.hudDashLabel.setText(dictionary.dash);
    this.helpText.setText(dictionary.controls);
    this.languageLabel.setText(dictionary.language);
    this.updateDashHud();

    const pulse = 1 + (1 - remaining / this.roundTimerSeconds) * 0.42;
    this.bomb.fuse.setScale(pulse);
    this.audio.updateTimer(remaining, !this.roundResolving && !this.matchOver);

    if (remaining < 3) {
      this.hudTimer.setColor("#ff766b");
    } else {
      this.hudTimer.setColor("#f7f8ff");
    }

    this.updateCriticalTimerFeedback(remaining);
  }

  private startRound(aliveCountOrMessage: number | string) {
    const alivePlayers = this.getAlivePlayers();
    const stage = this.getRoundStage(alivePlayers.length);
    const nextOwner = Phaser.Utils.Array.GetRandom(alivePlayers);
    const isSpecialRound = alivePlayers.length === 3;
    const message = typeof aliveCountOrMessage === "number"
      ? TEXT[this.language].playersRemain(aliveCountOrMessage)
      : aliveCountOrMessage;
    const roundMessage = alivePlayers.length === 2
      ? TEXT[this.language].finalDuel
      : isSpecialRound
        ? TEXT[this.language].threePlayers
        : message;
    this.currentRoundMessageKey = alivePlayers.length === 2
      ? "finalDuel"
      : isSpecialRound
        ? "threePlayers"
        : "playersRemain";

    this.roundResolving = false;
    this.roundTimerSeconds = stage.timerSeconds;
    this.roundEndsAt = this.time.now + stage.timerSeconds * 1000;
    this.nextCriticalPulseAt = 0;
    this.dangerOverlay.setAlpha(0);
    this.hudTimer.setScale(1);
    this.audio.resetTimerTicks();
    this.createArena(alivePlayers.length);
    for (const player of alivePlayers) {
      player.setDashRechargeEnabled(alivePlayers.length <= 3);
      player.resetDashCharges();
      player.keepInside(this.arenaRect);
    }
    this.bomb.setIntensity(stage.bombSpeedMultiplier);
    this.transferBomb(nextOwner);
    this.updateHud(true);
    this.cameras.main.flash(120, 255, alivePlayers.length <= 2 ? 95 : 210, 64, false);
    this.showRoundMessage(roundMessage, alivePlayers.length <= 3 ? "#ffcf33" : "#f7f8ff", 1000);
  }

  private endMatch(winner: Player) {
    this.matchOver = true;
    this.roundResolving = true;
    this.winner = winner;
    this.currentRoundMessageKey = "matchOver";
    this.bomb.setVisible(false);
    this.showRoundMessage(TEXT[this.language].wins(this.getPlayerName(winner)), "#ffcf33", 999999);
  }

  private showRoundMessage(message: string, color: string, duration: number) {
    const lines = message.split("\n").length;
    this.roundMessagePanel.setSize(lines > 1 ? 760 : 620, lines > 1 ? 154 : 118);
    this.roundMessagePanel.setAlpha(0.82);
    this.roundMessagePanel.setVisible(true);
    this.roundMessage.setText(message);
    this.roundMessage.setColor(color);
    this.roundMessage.setAlpha(1);
    this.roundMessage.setScale(0.92);
    this.roundMessage.setVisible(true);
    this.tweens.killTweensOf(this.roundMessage);
    this.tweens.killTweensOf(this.roundMessagePanel);
    this.tweens.add({
      targets: [this.roundMessage, this.roundMessagePanel],
      scale: 1,
      duration: 120,
      ease: "Quad.easeOut"
    });

    if (duration < 999999) {
      this.tweens.add({
        targets: [this.roundMessage, this.roundMessagePanel],
        alpha: 0,
        delay: duration,
        duration: 260,
        ease: "Quad.easeIn",
        onComplete: () => {
          this.roundMessage.setVisible(false);
          this.roundMessagePanel.setVisible(false);
        }
      });
    }
  }

  private playExplosion(x: number, y: number, color: number) {
    const ring = this.add.circle(x, y, 18, 0xff5d4f, 0);
    ring.setStrokeStyle(5, 0xffcf33, 0.9);
    ring.setDepth(7);
    this.tweens.add({
      targets: ring,
      scale: 4.2,
      alpha: 0,
      duration: 360,
      ease: "Quad.easeOut",
      onComplete: () => ring.destroy()
    });

    for (let index = 0; index < 18; index += 1) {
      const angle = (Math.PI * 2 * index) / 18;
      const distance = Phaser.Math.Between(34, 86);
      const shard = this.add.rectangle(x, y, 10, 4, index % 3 === 0 ? 0xffcf33 : color, 0.95);
      shard.setRotation(angle);
      shard.setDepth(7);
      this.tweens.add({
        targets: shard,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        scaleX: 0.15,
        scaleY: 0.15,
        alpha: 0,
        duration: Phaser.Math.Between(220, 390),
        ease: "Quad.easeOut",
        onComplete: () => shard.destroy()
      });
    }
  }

  private updateCriticalTimerFeedback(remaining: number) {
    if (this.roundResolving || this.matchOver || remaining >= 1 || remaining <= 0) {
      this.dangerOverlay.setAlpha(0);
      this.hudTimer.setScale(1);
      return;
    }

    const pulse = 0.1 + Math.sin(this.time.now * 0.04) * 0.035;
    this.dangerOverlay.setAlpha(pulse);
    this.hudTimer.setScale(1.14);

    if (this.time.now >= this.nextCriticalPulseAt) {
      this.nextCriticalPulseAt = this.time.now + 170;
      this.cameras.main.shake(70, 0.0025);
      this.tweens.add({
        targets: this.hudTimer,
        scale: 1.28,
        duration: 55,
        yoyo: true,
        ease: "Quad.easeOut"
      });
    }
  }

  private getAlivePlayers() {
    return this.players.filter((player) => player.alive);
  }

  private getRoundStage(aliveCount: number) {
    return ROUND_STAGES.find((stage) => aliveCount >= stage.minPlayers) ?? ROUND_STAGES[ROUND_STAGES.length - 1];
  }

  private getStageName(aliveCount: number) {
    const dictionary = TEXT[this.language];
    if (aliveCount <= 2) return dictionary.finalDuel;
    if (aliveCount === 3) return dictionary.special;
    if (aliveCount <= 4) return dictionary.panic;
    if (aliveCount <= 6) return dictionary.pressure;
    return dictionary.opening;
  }

  private getArenaPalette(aliveCount: number) {
    if (aliveCount <= 2) {
      return {
        outer: 0x201317,
        floor: 0x171014,
        wall: 0x6b2832,
        grid: 0xff766b
      };
    }

    if (aliveCount <= 4) {
      return {
        outer: 0x211a13,
        floor: 0x17130f,
        wall: 0x5d3c22,
        grid: 0xffb84d
      };
    }

    if (aliveCount <= 6) {
      return {
        outer: 0x1a1824,
        floor: 0x11121b,
        wall: 0x41375f,
        grid: 0xb68cff
      };
    }

    return {
      outer: 0x1c2029,
      floor: 0x11141b,
      wall: 0x343946,
      grid: 0xffffff
    };
  }

  private getArenaBounds(aliveCount: number) {
    const scale = aliveCount <= 2 ? 0.74 : aliveCount <= 3 ? 0.84 : 1;
    const width = ARENA.width * scale;
    const height = ARENA.height * scale;
    const x = ARENA.x + (ARENA.width - width) / 2;
    const y = ARENA.y + (ARENA.height - height) / 2;

    return new Phaser.Geom.Rectangle(x, y, width, height);
  }

  private setTextIfChanged(
    target: Phaser.GameObjects.Text,
    cacheKey: "lastTimerText" | "lastOwnerText" | "lastPlayersText" | "lastStageText",
    value: string
  ) {
    if (this[cacheKey] === value) {
      return;
    }

    this[cacheKey] = value;
    target.setText(value);
  }

  private createDashHud() {
    const startX = GAME_WIDTH - 238;
    const y = 38;

    for (let index = 0; index < PLAYER.dashCharges; index += 1) {
      const x = startX + index * 48;
      const slot = this.add.rectangle(x, y, 34, 14, 0x222733, 1);
      slot.setStrokeStyle(2, 0x8defff, 0.45);

      const fill = this.add.rectangle(x, y, 26, 8, 0x8defff, 1);
      fill.setAlpha(0.95);

      this.dashSlots.push(slot);
      this.dashSlotFills.push(fill);
    }
  }

  private createLanguageButton() {
    const background = this.add.rectangle(0, 0, 82, 34, 0x171b24, 0.95);
    background.setStrokeStyle(2, 0x8defff, 0.42);

    const icon = this.add.graphics();
    icon.lineStyle(1.6, 0x8defff, 0.86);
    icon.strokeCircle(-22, 0, 9);
    icon.lineBetween(-31, 0, -13, 0);
    icon.strokeEllipse(-22, 0, 8, 18);
    icon.strokeEllipse(-22, 0, 18, 7);

    this.languageLabel = this.add.text(-3, -8, TEXT[this.language].language, {
      color: "#f7f8ff",
      fontFamily: "ui-sans-serif, system-ui",
      fontSize: "14px",
      fontStyle: "800"
    });

    this.languageButton = this.add.container(GAME_WIDTH - 62, 34, [background, icon, this.languageLabel]);
    this.languageButton.setDepth(20);
    this.languageButton.setSize(82, 34);
    this.languageButton.setInteractive({ useHandCursor: true });
    this.languageButton.on("pointerdown", () => this.toggleLanguage());
  }

  private toggleLanguage() {
    this.language = this.language === "en" ? "pt" : "en";
    this.human.label.setText(TEXT[this.language].humanName);
    this.lastOwnerText = "";
    this.lastPlayersText = "";
    this.lastStageText = "";
    this.lastDashReady = -1;
    this.updateHud(true);

    if (this.roundMessage.visible && this.currentRoundMessageKey) {
      this.roundMessage.setText(this.getTranslatedActiveMessage());
    }
  }

  private getTranslatedActiveMessage() {
    const aliveCount = this.getAlivePlayers().length;

    if (this.currentRoundMessageKey === "matchOver" && this.winner) {
      return TEXT[this.language].wins(this.getPlayerName(this.winner));
    }

    if (this.currentRoundMessageKey === "threePlayers") {
      return TEXT[this.language].threePlayers;
    }

    if (this.currentRoundMessageKey === "finalDuel") {
      return TEXT[this.language].finalDuel;
    }

    if (this.currentRoundMessageKey === "playersRemain") {
      return TEXT[this.language].playersRemain(aliveCount);
    }

    return this.roundMessage.text;
  }

  private getPlayerName(player: Player) {
    return player === this.human ? TEXT[this.language].humanName : player.name;
  }

  private updateDashHud() {
    const ready = this.human.dashChargeCount;
    if (ready === this.lastDashReady) {
      return;
    }

    this.lastDashReady = ready;
    for (let index = 0; index < this.dashSlotFills.length; index += 1) {
      const isReady = index < ready;
      this.dashSlotFills[index].setAlpha(isReady ? 0.95 : 0.16);
      this.dashSlotFills[index].setFillStyle(isReady ? 0x8defff : 0x56606f, 1);
      this.dashSlots[index].setStrokeStyle(2, isReady ? 0x8defff : 0x56606f, isReady ? 0.72 : 0.35);
    }
  }

  private getBotIntent(bot: Player): BotIntent {
    const fallbackTarget = this.getNearestOpponent(bot);
    const aimTarget = fallbackTarget
      ? new Phaser.Math.Vector2(fallbackTarget.x, fallbackTarget.y)
      : new Phaser.Math.Vector2(this.human.x, this.human.y);
    const moveDirection = new Phaser.Math.Vector2(0, 0);
    let shouldDash = false;

    if (this.bomb.state === "HELD") {
      if (this.bomb.owner === bot && fallbackTarget) {
        const distance = Phaser.Math.Distance.Between(bot.x, bot.y, fallbackTarget.x, fallbackTarget.y);
        const strafe = this.getPerpendicularTowardCenter(bot, fallbackTarget);
        const pressure = distance < 260
          ? new Phaser.Math.Vector2(bot.x - fallbackTarget.x, bot.y - fallbackTarget.y)
          : new Phaser.Math.Vector2(fallbackTarget.x - bot.x, fallbackTarget.y - bot.y);

        moveDirection.copy(pressure.normalize().scale(0.65).add(strafe.scale(0.35)));
      } else if (this.bomb.owner && this.bomb.owner !== bot) {
        const holder = this.bomb.owner;
        const awayFromHolder = new Phaser.Math.Vector2(bot.x - holder.x, bot.y - holder.y);
        moveDirection.copy(awayFromHolder.lengthSq() > 0 ? awayFromHolder.normalize() : moveDirection);
      }

      return { aimTarget, moveDirection, shouldDash };
    }

    const threat = this.getBombThreat(bot);
    if (threat.risk > 0) {
      moveDirection.copy(threat.escapeDirection);
      shouldDash = threat.risk > 0.78 && bot.dashChargeCount > 0;
      return { aimTarget, moveDirection, shouldDash };
    }

    if (this.bomb.state === "RETURNING" && this.bomb.owner !== bot) {
      const intercept = this.getReturnInterceptIntent(bot);
      if (intercept.lengthSq() > 0) {
        moveDirection.copy(intercept);
      }
    }

    return { aimTarget, moveDirection, shouldDash };
  }

  private getBombThreat(bot: Player) {
    const escapeDirection = new Phaser.Math.Vector2(0, 0);
    if (this.bomb.state === "HELD" || this.bomb.owner === bot || this.bomb.velocity.lengthSq() === 0) {
      return { risk: 0, escapeDirection };
    }

    const fromBombToBot = new Phaser.Math.Vector2(bot.x - this.bomb.x, bot.y - this.bomb.y);
    const bombDirection = this.bomb.velocity.clone().normalize();
    const speed = Math.max(this.bomb.velocity.length(), 1);
    const timeAlongPathMs = (fromBombToBot.dot(bombDirection) / speed) * 1000;

    if (timeAlongPathMs < -120 || timeAlongPathMs > BOT.evadeLookAheadMs) {
      return { risk: 0, escapeDirection };
    }

    const closestPoint = new Phaser.Math.Vector2(this.bomb.x, this.bomb.y).add(
      bombDirection.clone().scale((timeAlongPathMs / 1000) * speed)
    );
    const distanceToPath = Phaser.Math.Distance.Between(bot.x, bot.y, closestPoint.x, closestPoint.y);
    if (distanceToPath > BOT.evadeRadius) {
      return { risk: 0, escapeDirection };
    }

    const side = Math.sign(fromBombToBot.cross(bombDirection)) || 1;
    escapeDirection.set(-bombDirection.y * side, bombDirection.x * side);
    const centerPull = new Phaser.Math.Vector2(
      this.arenaRect.centerX - bot.x,
      this.arenaRect.centerY - bot.y
    ).normalize();
    escapeDirection.scale(0.78).add(centerPull.scale(0.22)).normalize();

    const distanceRisk = 1 - distanceToPath / BOT.evadeRadius;
    const timingRisk = 1 - Math.max(0, timeAlongPathMs) / BOT.evadeLookAheadMs;
    return { risk: Phaser.Math.Clamp(distanceRisk * 0.7 + timingRisk * 0.3, 0, 1), escapeDirection };
  }

  private getReturnInterceptIntent(bot: Player) {
    const owner = this.bomb.owner;
    const bombToOwner = new Phaser.Math.Vector2(owner.x - this.bomb.x, owner.y - this.bomb.y);
    const botToBomb = new Phaser.Math.Vector2(this.bomb.x - bot.x, this.bomb.y - bot.y);

    if (bombToOwner.lengthSq() === 0 || botToBomb.length() > 460) {
      return new Phaser.Math.Vector2(0, 0);
    }

    const returnDirection = bombToOwner.normalize();
    const botProjection = new Phaser.Math.Vector2(bot.x - this.bomb.x, bot.y - this.bomb.y).dot(returnDirection);
    if (botProjection < 0) {
      return new Phaser.Math.Vector2(0, 0);
    }

    const closestPoint = new Phaser.Math.Vector2(this.bomb.x, this.bomb.y).add(returnDirection.scale(botProjection));
    const distanceToReturnPath = Phaser.Math.Distance.Between(bot.x, bot.y, closestPoint.x, closestPoint.y);
    if (distanceToReturnPath > BOT.interceptRadius) {
      return new Phaser.Math.Vector2(0, 0);
    }

    return new Phaser.Math.Vector2(closestPoint.x - bot.x, closestPoint.y - bot.y).normalize();
  }

  private getNearestOpponent(player: Player) {
    return this.getAlivePlayers()
      .filter((candidate) => candidate !== player)
      .sort((a, b) => {
        const distanceA = Phaser.Math.Distance.Squared(player.x, player.y, a.x, a.y);
        const distanceB = Phaser.Math.Distance.Squared(player.x, player.y, b.x, b.y);
        return distanceA - distanceB;
      })[0];
  }

  private getPerpendicularTowardCenter(bot: Player, target: Player) {
    const toTarget = new Phaser.Math.Vector2(target.x - bot.x, target.y - bot.y).normalize();
    const perpendicularA = new Phaser.Math.Vector2(-toTarget.y, toTarget.x);
    const perpendicularB = new Phaser.Math.Vector2(toTarget.y, -toTarget.x);
    const centerDirection = new Phaser.Math.Vector2(
      this.arenaRect.centerX - bot.x,
      this.arenaRect.centerY - bot.y
    ).normalize();

    return perpendicularA.dot(centerDirection) > perpendicularB.dot(centerDirection)
      ? perpendicularA
      : perpendicularB;
  }
}
