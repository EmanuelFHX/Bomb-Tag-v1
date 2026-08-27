import Phaser from "phaser";
import { ARENA, BOMB, BOT, GAME_HEIGHT, GAME_WIDTH, PLAYER, ROUND_STAGES, WEAPON } from "../config";
import { Bomb } from "../entities/Bomb";
import { Player } from "../entities/Player";
import { OnlineRoomClient } from "../online/OnlineRoomClient";
import type { OnlineCombatEvent, OnlineCombatEventDraft, OnlineJudgmentOrbState, OnlineMatchPlayerState, OnlineMatchState, OnlineMusicState, OnlinePlayerSnapshot, OnlineRoomSnapshot, OnlineShotState, OnlineWeaponPickupState } from "../online/onlineTypes";
import { GameSettings, Language, loadSettings, saveSettings } from "../settings";
import { AudioSystem, type HitSoundVariant } from "../systems/AudioSystem";
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

const JUDGMENT_ORB = {
  required: 3,
  radius: 12,
  detectRadius: 44,
  spawnEveryMs: 4000,
  firstSpawnDelayMs: 3000,
  maxActive: 1
} as const;

type BotIntent = {
  aimTarget: Phaser.Math.Vector2;
  moveDirection: Phaser.Math.Vector2;
  shouldDash: boolean;
  shouldParry: boolean;
};

type WeaponPickup = {
  id: string;
  shape: Phaser.GameObjects.Arc;
  ring: Phaser.GameObjects.Arc;
};

type JudgmentOrb = {
  id: string;
  shape: Phaser.GameObjects.Arc;
  ring: Phaser.GameObjects.Arc;
};

type Shot = {
  id: string;
  owner: Player;
  shape: Phaser.GameObjects.Rectangle;
  spark: Phaser.GameObjects.Arc;
  velocity: Phaser.Math.Vector2;
  expiresAt: number;
};

type ScoreboardRow = {
  container: Phaser.GameObjects.Container;
  marker: Phaser.GameObjects.Rectangle;
  name: Phaser.GameObjects.Text;
  lives: Phaser.GameObjects.Arc[];
  status: Phaser.GameObjects.Text;
};

type RemoteAvatar = {
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Arc;
  aim: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  weaponBadge: Phaser.GameObjects.Rectangle;
};

type RemotePlayerTarget = {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  aimX: number;
  aimY: number;
  lastSnapshotAt: number;
};

type RemotePlayerSlot = {
  player: Player;
  slotId: string;
};

type SpinThrowTracker = {
  startAngle: number;
  lastAngle: number;
  startedAt: number;
  turnAmount: number;
  readyUntil: number;
};

type OnlineShotVisual = {
  shape: Phaser.GameObjects.Rectangle;
  spark: Phaser.GameObjects.Arc;
  velocity: Phaser.Math.Vector2;
  expiresAt: number;
  lastSnapshotAt: number;
};

type OnlinePickupVisual = {
  shape: Phaser.GameObjects.Arc;
  ring: Phaser.GameObjects.Arc;
};

type MobileControls = {
  container: Phaser.GameObjects.Container;
  joystickBase: Phaser.GameObjects.Arc;
  joystickKnob: Phaser.GameObjects.Arc;
  joystickZone: Phaser.GameObjects.Zone;
  actionButton: Phaser.GameObjects.Arc;
  actionLabel: Phaser.GameObjects.Text;
  actionZone: Phaser.GameObjects.Zone;
  dashButton: Phaser.GameObjects.Arc;
  dashLabel: Phaser.GameObjects.Text;
  dashZone: Phaser.GameObjects.Zone;
  parryButton: Phaser.GameObjects.Arc;
  parryLabel: Phaser.GameObjects.Text;
  parryZone: Phaser.GameObjects.Zone;
  joystickPointerId?: number;
};

type DebugWindow = Window & {
  __bombTagDebug?: unknown;
};

const TEXT = {
  en: {
    humanName: "YOU",
    bomb: "BOMB",
    players: "PLAYERS",
    stage: "STAGE",
    dash: "DASH",
    lives: "LIVES",
    opening: "OPENING",
    pressure: "PRESSURE",
    panic: "PANIC",
    special: "SPECIAL",
    finalDuel: "FINAL DUEL",
    judgment: "JUDGMENT HOUR",
    judgmentDefense: "DEFEND YOUR POSITION",
    playersRemain: (count: number) => `${count} PLAYERS REMAIN`,
    threePlayers: "3 PLAYERS LEFT\n2 RECHARGING DASHES",
    finalCutsceneTitle: "FINAL ROUND",
    finalCutsceneRules: [
      "3 lives restored",
      "2 recharging dashes",
      "+0.5s on 3 players, +1s on final duel",
      "right click parry: perfect returns the bomb",
      "miss the returning catch: -1 life"
    ],
    livesRestored: "LIVES RESTORED\n3 LIVES FOR EACH FINALIST",
    lifeLost: "-1 LIFE",
    skipToFour: "4P",
    eliminated: (name: string) => `${name} ELIMINATED`,
    wins: (name: string) => `${name} WINS\nR TO REMATCH`,
    controls: "WASD move  |  Mouse aim  |  Left click throw/shoot  |  Right click parry  |  Shift/Space dash  |  R rematch",
    language: "EN"
  },
  pt: {
    humanName: "VOCE",
    bomb: "BOMBA",
    players: "JOGADORES",
    stage: "RODADA",
    dash: "DASH",
    lives: "VIDAS",
    opening: "INICIO",
    pressure: "PRESSAO",
    panic: "PANICO",
    special: "ESPECIAL",
    finalDuel: "DUELO FINAL",
    judgment: "HORA DO JULGAMENTO",
    judgmentDefense: "DEFENDA SUA POSIÇÃO",
    playersRemain: (count: number) => `${count} JOGADORES RESTANTES`,
    threePlayers: "3 JOGADORES RESTANTES\n2 DASHES RECARREGAVEIS",
    finalCutsceneTitle: "RODADA FINAL",
    finalCutsceneRules: [
      "3 vidas restauradas",
      "2 dashes recarregaveis",
      "+0,5s com 3 players, +1s no duelo final",
      "clique direito parry: perfeito devolve a bomba",
      "errou a pegada do retorno: -1 vida"
    ],
    livesRestored: "VIDAS RESTAURADAS\n3 VIDAS PARA CADA FINALISTA",
    lifeLost: "-1 VIDA",
    skipToFour: "4J",
    eliminated: (name: string) => `${name} ELIMINADO`,
    wins: (name: string) => `${name} VENCEU\nR PARA REVANCHE`,
    controls: "WASD mover  |  Mouse mirar  |  Clique esquerdo lancar/atirar  |  Clique direito parry  |  Shift/Espaco dash  |  R revanche",
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
  private arenaPolygon?: Phaser.Geom.Polygon;
  private arenaPolygonCenter = new Phaser.Math.Vector2();
  private graphics!: Phaser.GameObjects.Graphics;
  private hudTimer!: Phaser.GameObjects.Text;
  private hudOwner!: Phaser.GameObjects.Text;
  private hudStage!: Phaser.GameObjects.Text;
  private hudPlayers!: Phaser.GameObjects.Text;
  private hudLivesLabel!: Phaser.GameObjects.Text;
  private hudDashLabel!: Phaser.GameObjects.Text;
  private helpText!: Phaser.GameObjects.Text;
  private onlineStatusText!: Phaser.GameObjects.Text;
  private languageButton!: Phaser.GameObjects.Container;
  private languageLabel!: Phaser.GameObjects.Text;
  private skipButton?: Phaser.GameObjects.Container;
  private skipButtonLabel?: Phaser.GameObjects.Text;
  private humanLifeHudPips: Phaser.GameObjects.Arc[] = [];
  private scoreboardPanel!: Phaser.GameObjects.Rectangle;
  private scoreboardTitle!: Phaser.GameObjects.Text;
  private scoreboardRows: ScoreboardRow[] = [];
  private dashSlots: Phaser.GameObjects.Rectangle[] = [];
  private dashSlotFills: Phaser.GameObjects.Rectangle[] = [];
  private dangerOverlay!: Phaser.GameObjects.Rectangle;
  private roundMessagePanel!: Phaser.GameObjects.Rectangle;
  private roundMessage!: Phaser.GameObjects.Text;
  private homingIndicator?: {
    target: Player;
    graphics: Phaser.GameObjects.Graphics;
    expiresAt: number;
  };
  private currentRoundMessageKey: "playersRemain" | "threePlayers" | "livesRestored" | "finalDuel" | "judgmentDefense" | "matchOver" | "" = "";
  private roundEndsAt = 0;
  private roundTimerSeconds: number = BOMB.timerSeconds;
  private roundResolving = false;
  private matchOver = false;
  private nextHudUpdateAt = 0;
  private nextOnlineMatchSyncAt = 0;
  private lastTimerText = "";
  private lastOwnerText = "";
  private lastPlayersText = "";
  private lastStageText = "";
  private lastDashReady = -1;
  private lastDashSlots = -1;
  private settings: GameSettings = loadSettings();
  private language: Language = "en";
  private debugMode = false;
  private winner?: Player;
  private nextCriticalPulseAt = 0;
  private botThrowReadyAt = new Map<string, number>();
  private botShotReadyAt = new Map<string, number>();
  private botParryThinkAt = new Map<string, number>();
  private parryReadyAt = new Map<string, number>();
  private parryActiveUntil = new Map<string, number>();
  private spinThrowTrackers = new Map<string, SpinThrowTracker>();
  private weaponPickups: WeaponPickup[] = [];
  private judgmentOrbs: JudgmentOrb[] = [];
  private shots: Shot[] = [];
  private weaponPickupSequence = 0;
  private judgmentOrbSequence = 0;
  private nextWeaponSpawnAt = 0;
  private nextJudgmentOrbSpawnAt = 0;
  private judgmentOrbCounts = new Map<string, number>();
  private judgmentOrbPips = new Map<string, Phaser.GameObjects.Arc[]>();
  private onlineJudgmentOrbVisuals = new Map<string, JudgmentOrb>();
  private pendingJudgmentDefender?: Player;
  private pendingJudgmentChallenger?: Player;
  private baseBombSpeedMultiplier = 1;
  private specialBombSpeedBonus = 0;
  private specialRoundLivesRestored = false;
  private matchMusic?: HTMLAudioElement;
  private matchMusicStarted = false;
  private finalBattleMusic?: HTMLAudioElement;
  private finalBattleMusicPrimed = false;
  private judgmentMusic?: HTMLAudioElement;
  private judgmentBell?: HTMLAudioElement;
  private onlineClient?: OnlineRoomClient;
  private onlineConnecting = false;
  private onlineHostHeartbeat?: number;
  private remoteAvatars = new Map<string, RemoteAvatar>();
  private remotePlayerSlots = new Map<string, RemotePlayerSlot>();
  private remotePlayerTargets = new Map<string, RemotePlayerTarget>();
  private processedRemoteActions = new Map<string, number>();
  private processedRemoteDashes = new Map<string, number>();
  private pendingOnlineActionSeq = 0;
  private pendingOnlineActionType: OnlinePlayerSnapshot["actionType"];
  private pendingOnlineDashSeq = 0;
  private pendingOnlineDashDirection = new Phaser.Math.Vector2(1, 0);
  private onlineShotVisuals = new Map<string, OnlineShotVisual>();
  private onlinePickupVisuals = new Map<string, OnlinePickupVisual>();
  private latestOnlineMatch?: OnlineMatchState;
  private lastOnlineMatchAt = 0;
  private lastOnlineMatchUpdatedAt = 0;
  private onlineEvents: OnlineCombatEvent[] = [];
  private onlineEventSequence = 0;
  private shotSequence = 0;
  private processedOnlineEvents = new Set<string>();
  private onlineEventsPrimed = false;
  private lastOnlineMusicState: OnlineMusicState = "none";
  private lastOnlineHomingTargetId: string | null = null;
  private onlineKnownLives = new Map<string, number>();
  private lastLifeFeedbackAt = new Map<string, number>();
  private nextDebugSnapshotAt = 0;
  private mobileControls?: MobileControls;
  private mobileControlsEnabled = false;
  private mobileAimDirection = new Phaser.Math.Vector2(1, 0);
  private judgmentPhase = false;
  private judgmentDuelPhase = false;
  private judgmentDefender?: Player;
  private judgmentLastAttacker?: Player;
  private judgmentCenter = new Phaser.Math.Vector2(GAME_WIDTH / 2, GAME_HEIGHT / 2);
  private readonly judgmentOuterRadius = 318;
  private readonly judgmentInnerRadius = 108;

  constructor() {
    super("GameScene");
  }

  init(settings?: Partial<GameSettings>) {
    this.settings = {
      ...loadSettings(),
      ...settings
    };
    this.language = this.settings.language;
    this.debugMode = this.settings.debugMode;
  }

  create() {
    this.inputSystem = new InputSystem(this);
    this.audio = new AudioSystem();
    this.audio.setVolume(this.settings.volume);
    this.input.mouse?.disableContextMenu();
    this.arenaRect = new Phaser.Geom.Rectangle(ARENA.x, ARENA.y, ARENA.width, ARENA.height);
    this.graphics = this.add.graphics();
    this.createArena(BOT.count + 1);
    this.createPlayers();
    this.createJudgmentOrbPips();
    this.bomb = new Bomb(this, this.human);
    this.createHud();
    this.createMobileControls();
    this.startRound(BOT.count + 1);
    this.time.delayedCall(250, () => this.connectOnlineRoom());

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.unlockAudioFromTouch();
      if (this.mobileControlsEnabled) {
        if (!this.isPointerOverMobileControl(pointer)) {
          this.updateMobileAimFromPointer(pointer);
        }
        return;
      }
      if (pointer.rightButtonDown() && !this.roundResolving && !this.matchOver) {
        this.handleHumanParry();
        return;
      }
      if (pointer.leftButtonDown() && !this.roundResolving && !this.matchOver) {
        this.handleHumanAction();
      }
    });
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      this.updateMobilePointer(pointer);
    });
    this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      this.releaseMobilePointer(pointer);
    });
    this.input.keyboard?.on("keydown", () => {
      this.audio.unlock();
      this.startMatchMusic();
      this.primeFinalBattleMusic();
    });
    this.events.once("shutdown", () => {
      this.matchMusic?.pause();
      this.finalBattleMusic?.pause();
      this.judgmentMusic?.pause();
      this.judgmentBell?.pause();
      this.stopOnlineHostHeartbeat();
      this.onlineClient?.disconnect();
    });
  }

  update(_time: number, delta: number) {
    this.updateMobileControlsVisual();
    if (this.isOnlineGuest()) {
      this.updateOnlineGuestInput(delta / 1000);
      this.syncOnlinePlayer();
      this.updateGuestOnlineView(delta / 1000);
      this.updateHomingIndicator();
      this.updateDebugSnapshot();
      return;
    }

    if (this.matchOver) {
      if (this.inputSystem.consumeRestartPressed()) {
        this.scene.restart();
      }
      this.updateDebugSnapshot();
      return;
    }

    if (this.roundResolving) {
      this.updateHud(false);
      return;
    }

    const deltaSeconds = delta / 1000;
    const moveDirection = this.inputSystem.getMoveDirection();
    const pointerWorld = this.getHumanAimTarget(moveDirection);
    let forceOnlineMatchSync = false;

    this.human.updateHuman(
      deltaSeconds,
      moveDirection,
      pointerWorld,
      this.inputSystem.consumeDashPressed()
    );
    this.updateSpinThrowReadiness(this.human);

    for (const player of this.players) {
      if (this.isBotControlledPlayer(player)) {
        const intent = this.getBotIntent(player);
        const previousDashSeq = player.dashVisualSequence;
        if (intent.shouldParry) {
          this.tryParry(player);
        }
        player.updateBot(deltaSeconds, intent.aimTarget, intent.moveDirection, intent.shouldDash);
        this.updateSpinThrowReadiness(player);
        if (player.dashVisualSequence !== previousDashSeq) {
          forceOnlineMatchSync = true;
        }
      } else if (this.isRemoteControlledPlayer(player)) {
        this.updateRemoteControlledSlot(player, deltaSeconds);
        this.updateSpinThrowReadiness(player);
      }
      this.keepPlayerInActiveArena(player);
    }

    this.updateBotThrows();
    this.updateWeapons();
    this.updateJudgmentOrbs();
    this.updateBotWeaponActions();
    this.updateShots(deltaSeconds);
    this.bomb.update(deltaSeconds, this.arenaRect, this.arenaPolygon, this.arenaPolygonCenter);
    this.resolveJudgmentBombBounds();
    this.updateHomingIndicator();
    this.syncOnlinePlayer();
    this.syncOnlineMatchState(forceOnlineMatchSync || (this.shots.length > 0 && this.time.now >= this.nextOnlineMatchSyncAt));
    if (this.shots.length > 0 && this.time.now >= this.nextOnlineMatchSyncAt) {
      this.nextOnlineMatchSyncAt = this.time.now + 45;
    }
    this.resolveActiveParries();
    this.resolveBombHits();
    this.resolveSpecialCatchMiss();
    this.bomb.tryCatchOwner();
    this.resolveCountdown();
    this.updateHud(false);
    this.updateDebugSnapshot();
  }

  private createArena(aliveCount: number) {
    const palette = this.getArenaPalette(aliveCount);
    this.arenaRect = this.getArenaBounds(aliveCount);
    this.arenaPolygon = undefined;
    this.graphics.clear();
    this.graphics.fillStyle(palette.outer, 1);
    this.graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    if (this.isJudgmentDefensePhase()) {
      this.drawJudgmentArena(palette);
      return;
    }

    if (aliveCount <= 3) {
      this.drawOctagonArena(palette);
      return;
    }

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

  private drawOctagonArena(palette: { outer: number; floor: number; wall: number; grid: number }) {
    const points = this.getArenaOctagonPoints(this.arenaRect);
    this.arenaPolygon = new Phaser.Geom.Polygon(points);
    this.arenaPolygonCenter.set(this.arenaRect.centerX, this.arenaRect.centerY);
    this.graphics.fillStyle(palette.floor, 1);
    this.graphics.fillPoints(points, true, true);

    this.graphics.lineStyle(ARENA.wallThickness, palette.wall, 1);
    this.graphics.strokePoints(points, true, true);
  }

  private drawJudgmentArena(palette: { outer: number; floor: number; wall: number; grid: number }) {
    const centerX = this.judgmentCenter.x;
    const centerY = this.judgmentCenter.y;
    this.arenaRect = new Phaser.Geom.Rectangle(
      centerX - this.judgmentOuterRadius,
      centerY - this.judgmentOuterRadius,
      this.judgmentOuterRadius * 2,
      this.judgmentOuterRadius * 2
    );

    this.graphics.fillStyle(palette.floor, 1);
    this.graphics.fillCircle(centerX, centerY, this.judgmentOuterRadius);
    this.graphics.lineStyle(ARENA.wallThickness, palette.wall, 1);
    this.graphics.strokeCircle(centerX, centerY, this.judgmentOuterRadius);

    this.graphics.lineStyle(2, palette.grid, 0.18);
    for (let radius = this.judgmentInnerRadius + 58; radius < this.judgmentOuterRadius; radius += 58) {
      this.graphics.strokeCircle(centerX, centerY, radius);
    }

    this.graphics.fillStyle(0x0d141b, 0.72);
    this.graphics.fillCircle(centerX, centerY, this.judgmentInnerRadius);
    this.graphics.lineStyle(5, 0xffcf33, 0.78);
    this.graphics.strokeCircle(centerX, centerY, this.judgmentInnerRadius);
  }

  private createPlayers() {
    const humanId = this.settings.online.enabled && this.settings.online.playerId
      ? this.settings.online.playerId
      : "p1";
    this.human = new Player(this, humanId, "human", this.settings.playerName, 270, 360, PLAYER_COLORS[0]);
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

  private createJudgmentOrbPips() {
    for (const player of this.players) {
      const pips = Array.from({ length: JUDGMENT_ORB.required }, (_, index) => {
        const pip = this.add.circle(-14 + index * 14, PLAYER.radius + 28, 4, 0xffcf33, 0.18);
        pip.setStrokeStyle(1, 0xfff0a6, 0.35);
        pip.setVisible(false);
        return pip;
      });
      player.container.add(pips);
      this.judgmentOrbPips.set(player.id, pips);
    }
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
    this.hudLivesLabel = this.add.text(ARENA.x + 690, 28, "", baseStyle);
    this.createHumanLivesHud();
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
    this.onlineStatusText = this.add.text(GAME_WIDTH - 332, GAME_HEIGHT - 34, "", {
      color: "#86f7ff",
      fontFamily: "ui-sans-serif, system-ui",
      fontSize: "14px",
      fontStyle: "800"
    });

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
    if (this.debugMode) {
      this.createSkipButton();
    }
    this.createScoreboard();
    this.updateHud(true);
  }

  private createMobileControls() {
    this.mobileControlsEnabled = this.shouldUseMobileControls();
    const container = this.add.container(0, 0);
    container.setDepth(24);
    container.setVisible(this.mobileControlsEnabled);

    const joystickBase = this.add.circle(126, 586, 64, 0x101722, 0.42);
    joystickBase.setStrokeStyle(4, 0x86f7ff, 0.42);
    const joystickKnob = this.add.circle(126, 586, 25, 0x86f7ff, 0.55);
    joystickKnob.setStrokeStyle(3, 0xffffff, 0.45);
    const joystickZone = this.add.zone(126, 586, 156, 156);
    joystickZone.setInteractive();

    const actionButton = this.add.circle(1130, 575, 58, 0xffcf33, 0.58);
    actionButton.setStrokeStyle(5, 0xffffff, 0.32);
    const actionLabel = this.add.text(1130, 575, this.language === "pt" ? "ACAO" : "ACTION", {
      color: "#0c0f16",
      fontFamily: "Arial Black, ui-sans-serif, system-ui",
      fontSize: "18px",
      fontStyle: "900"
    }).setOrigin(0.5);
    const actionZone = this.add.zone(1130, 575, 146, 146);
    actionZone.setInteractive();

    const dashButton = this.add.circle(1018, 620, 42, 0x86f7ff, 0.42);
    dashButton.setStrokeStyle(4, 0xffffff, 0.26);
    const dashLabel = this.add.text(1018, 620, "DASH", {
      color: "#f7f8ff",
      fontFamily: "Arial Black, ui-sans-serif, system-ui",
      fontSize: "14px",
      fontStyle: "900"
    }).setOrigin(0.5);
    const dashZone = this.add.zone(1018, 620, 112, 112);
    dashZone.setInteractive();

    const parryButton = this.add.circle(1210, 460, 43, 0xff5d4f, 0.42);
    parryButton.setStrokeStyle(4, 0xffffff, 0.26);
    const parryLabel = this.add.text(1210, 460, "PARRY", {
      color: "#f7f8ff",
      fontFamily: "Arial Black, ui-sans-serif, system-ui",
      fontSize: "13px",
      fontStyle: "900"
    }).setOrigin(0.5);
    const parryZone = this.add.zone(1210, 460, 114, 114);
    parryZone.setInteractive();

    container.add([
      joystickBase,
      joystickKnob,
      actionButton,
      actionLabel,
      dashButton,
      dashLabel,
      parryButton,
      parryLabel,
      joystickZone,
      actionZone,
      dashZone,
      parryZone
    ]);

    joystickZone.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.mobileControls!.joystickPointerId = pointer.id;
      this.updateMobileJoystick(pointer);
    });
    actionZone.on("pointerdown", () => {
      this.unlockAudioFromTouch();
      if (this.matchOver) {
        this.scene.restart();
        return;
      }
      if (!this.roundResolving) {
        this.handleHumanAction();
      }
    });
    dashZone.on("pointerdown", () => {
      this.unlockAudioFromTouch();
      if (!this.roundResolving && !this.matchOver) {
        this.inputSystem.queueVirtualDash();
      }
    });
    parryZone.on("pointerdown", () => {
      this.unlockAudioFromTouch();
      if (!this.roundResolving && !this.matchOver) {
        this.handleHumanParry();
      }
    });

    this.mobileControls = {
      container,
      joystickBase,
      joystickKnob,
      joystickZone,
      actionButton,
      actionLabel,
      actionZone,
      dashButton,
      dashLabel,
      dashZone,
      parryButton,
      parryLabel,
      parryZone
    };
  }

  private shouldUseMobileControls() {
    const coarsePointer = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
    const compactViewport = typeof window !== "undefined" && (window.innerWidth <= 900 || window.innerHeight <= 560);
    return !!this.sys.game.device.input.touch || coarsePointer || compactViewport;
  }

  private unlockAudioFromTouch() {
    this.audio.unlock();
    this.startMatchMusic();
    this.primeFinalBattleMusic();
    this.requestMobileFullscreen();
  }

  private requestMobileFullscreen() {
    if (!this.mobileControlsEnabled || this.scale.isFullscreen || !this.scale.fullscreen.available) {
      return;
    }

    this.scale.startFullscreen();
    this.time.delayedCall(180, () => {
      this.scale.refresh();
    });
  }

  private updateMobileControlsVisual() {
    if (!this.mobileControls) {
      return;
    }

    this.mobileControlsEnabled = this.shouldUseMobileControls();
    const isVisible = this.mobileControlsEnabled && (!this.roundResolving || this.matchOver);
    this.mobileControls.container.setVisible(isVisible);
    this.mobileControls.actionLabel.setText(this.matchOver
      ? (this.language === "pt" ? "NOVO" : "RETRY")
      : (this.language === "pt" ? "ACAO" : "ACTION"));
    this.mobileControls.actionButton.setAlpha(this.matchOver ? 0.72 : 0.58);
    this.mobileControls.dashButton.setAlpha(this.human.dashChargeCount > 0 ? 0.46 : 0.22);
    this.mobileControls.parryButton.setAlpha(this.isFinalPhase() ? 0.46 : 0.28);
  }

  private updateMobilePointer(pointer: Phaser.Input.Pointer) {
    if (!this.mobileControlsEnabled || !this.mobileControls) {
      return;
    }

    if (this.mobileControls.joystickPointerId === pointer.id) {
      this.updateMobileJoystick(pointer);
      return;
    }

    if (pointer.isDown && !this.isPointerOverMobileControl(pointer)) {
      this.updateMobileAimFromPointer(pointer);
    }
  }

  private updateMobileJoystick(pointer: Phaser.Input.Pointer) {
    if (!this.mobileControls) {
      return;
    }

    const base = this.mobileControls.joystickBase;
    const delta = new Phaser.Math.Vector2(pointer.worldX - base.x, pointer.worldY - base.y);
    const distance = Math.min(delta.length(), 54);
    const direction = delta.lengthSq() > 0 ? delta.normalize() : new Phaser.Math.Vector2(0, 0);
    this.mobileControls.joystickKnob.setPosition(base.x + direction.x * distance, base.y + direction.y * distance);
    this.inputSystem.setVirtualMoveDirection(direction);
    if (direction.lengthSq() > 0.08) {
      this.mobileAimDirection.copy(direction);
    }
  }

  private releaseMobilePointer(pointer: Phaser.Input.Pointer) {
    if (!this.mobileControls || this.mobileControls.joystickPointerId !== pointer.id) {
      return;
    }

    this.mobileControls.joystickPointerId = undefined;
    this.mobileControls.joystickKnob.setPosition(this.mobileControls.joystickBase.x, this.mobileControls.joystickBase.y);
    this.inputSystem.setVirtualMoveDirection(new Phaser.Math.Vector2(0, 0));
  }

  private isPointerOverMobileControl(pointer: Phaser.Input.Pointer) {
    if (!this.mobileControls || !this.mobileControlsEnabled) {
      return false;
    }

    const targets = [
      { x: this.mobileControls.joystickBase.x, y: this.mobileControls.joystickBase.y, radius: 86 },
      { x: this.mobileControls.actionButton.x, y: this.mobileControls.actionButton.y, radius: 76 },
      { x: this.mobileControls.dashButton.x, y: this.mobileControls.dashButton.y, radius: 60 },
      { x: this.mobileControls.parryButton.x, y: this.mobileControls.parryButton.y, radius: 62 }
    ];

    return targets.some((target) => (
      Phaser.Math.Distance.Between(pointer.worldX, pointer.worldY, target.x, target.y) <= target.radius
    ));
  }

  private updateMobileAimFromPointer(pointer: Phaser.Input.Pointer) {
    const direction = new Phaser.Math.Vector2(pointer.worldX - this.human.x, pointer.worldY - this.human.y);
    if (direction.lengthSq() > 0) {
      this.mobileAimDirection.copy(direction.normalize());
    }
  }

  private getHumanAimTarget(moveDirection: Phaser.Math.Vector2) {
    if (this.mobileControlsEnabled) {
      const direction = this.mobileAimDirection.lengthSq() > 0
        ? this.mobileAimDirection
        : moveDirection;
      if (direction.lengthSq() > 0) {
        return new Phaser.Math.Vector2(
          this.human.x + direction.x * 180,
          this.human.y + direction.y * 180
        );
      }
    }

    const pointer = this.input.activePointer;
    return new Phaser.Math.Vector2(pointer.worldX, pointer.worldY);
  }

  private handleHumanAction() {
    this.refreshHumanAimForAction();
    if (this.isOnlineGuest()) {
      this.queueOnlinePlayerAction("primary");
      return;
    }

    if (this.bomb.state === "HELD" && this.bomb.owner === this.human) {
      this.launchBomb(this.human.aimDirection.clone());
      return;
    }

    this.fireWeapon(this.human, this.human.aimDirection.clone());
  }

  private handleHumanParry() {
    this.refreshHumanAimForAction();
    if (this.isOnlineGuest()) {
      this.queueOnlinePlayerAction("parry");
      return;
    }

    this.tryParry(this.human);
  }

  private refreshHumanAimForAction() {
    const moveDirection = this.inputSystem.getMoveDirection();
    this.human.aimAt(this.getHumanAimTarget(moveDirection));
    this.updateSpinThrowReadiness(this.human);
  }

  private queueOnlinePlayerAction(actionType: OnlinePlayerSnapshot["actionType"]) {
    this.pendingOnlineActionSeq += 1;
    this.pendingOnlineActionType = actionType;
    this.syncOnlinePlayer();
  }

  private launchBomb(direction: Phaser.Math.Vector2) {
    const owner = this.bomb.owner;
    const isFinalPhase = this.isFinalPhase();
    const homingTarget = isFinalPhase && !this.isJudgmentDefensePhase()
      ? this.getSpecialBombTarget(owner, direction)
      : null;
    const hasSpinBoost = this.consumeSpinThrowBoost(owner);
    const launched = this.bomb.launch(direction, hasSpinBoost ? BOMB.spinThrowSpeedMultiplier : 1, hasSpinBoost && isFinalPhase);
    if (!launched) {
      return launched;
    }

    if (hasSpinBoost) {
      this.playSpinThrowEffect(owner);
    }
    this.bomb.setHomingTarget(homingTarget);
    if (homingTarget) {
      this.showHomingIndicator(homingTarget);
    } else {
      this.clearHomingIndicator();
    }
    if (!this.isFinalPhase()) {
      return launched;
    }

    this.specialBombSpeedBonus = Math.min(
      BOMB.specialThrowSpeedMaxBonus,
      this.specialBombSpeedBonus + BOMB.specialThrowSpeedStep
    );
    this.bomb.setIntensity(this.baseBombSpeedMultiplier * (1 + this.specialBombSpeedBonus));
    return launched;
  }

  private updateSpinThrowReadiness(player: Player) {
    if (this.bomb.state !== "HELD" || this.bomb.owner !== player || !player.alive) {
      this.spinThrowTrackers.delete(player.id);
      return;
    }

    const now = this.time.now;
    const angle = player.aimDirection.angle();
    const tracker = this.spinThrowTrackers.get(player.id);
    if (!tracker) {
      this.spinThrowTrackers.set(player.id, {
        startAngle: angle,
        lastAngle: angle,
        startedAt: now,
        turnAmount: 0,
        readyUntil: 0
      });
      return;
    }

    const delta = Math.abs(Phaser.Math.Angle.Wrap(angle - tracker.lastAngle));
    if (now - tracker.startedAt > BOMB.spinThrowWindowMs) {
      tracker.startedAt = now;
      tracker.startAngle = angle;
      tracker.turnAmount = 0;
    }

    tracker.lastAngle = angle;
    if (now <= tracker.readyUntil) {
      return;
    }

    tracker.turnAmount = Math.max(tracker.turnAmount + delta, Math.abs(Phaser.Math.Angle.Wrap(angle - tracker.startAngle)));
    if (tracker.turnAmount < BOMB.spinThrowMinRadians) {
      return;
    }

    tracker.startedAt = now;
    tracker.turnAmount = 0;
    tracker.readyUntil = now + BOMB.spinThrowReadyMs;
    this.playSpinReadyEffect(player);
  }

  private consumeSpinThrowBoost(player: Player) {
    const tracker = this.spinThrowTrackers.get(player.id);
    if (!tracker || this.time.now > tracker.readyUntil) {
      this.spinThrowTrackers.delete(player.id);
      return false;
    }

    this.spinThrowTrackers.delete(player.id);
    return true;
  }

  private tryParry(player: Player) {
    if (!this.isFinalPhase() || this.bomb.state === "HELD" || !player.alive || player === this.bomb.owner) {
      return false;
    }

    const readyAt = this.parryReadyAt.get(player.id) ?? 0;
    if (this.time.now < readyAt) {
      return false;
    }

    this.parryReadyAt.set(player.id, this.time.now + BOMB.parryCooldownMs);
    this.parryActiveUntil.set(player.id, this.time.now + BOMB.parryWindowMs);
    this.playParryEffect(player, false, player.x, player.y, true);
    return this.resolveParryWindow(player);
  }

  private resolveActiveParries() {
    if (!this.isFinalPhase() || this.bomb.state === "HELD") {
      this.parryActiveUntil.clear();
      return;
    }

    for (const [playerId, activeUntil] of [...this.parryActiveUntil]) {
      const player = this.players.find((candidate) => candidate.id === playerId);
      if (!player || !player.alive || this.time.now > activeUntil) {
        this.parryActiveUntil.delete(playerId);
        continue;
      }

      this.resolveParryWindow(player);
    }
  }

  private resolveParryWindow(player: Player) {
    if (!this.parryActiveUntil.has(player.id) || this.bomb.state === "HELD" || player === this.bomb.owner) {
      return false;
    }

    const distance = Phaser.Math.Distance.Between(this.bomb.x, this.bomb.y, player.x, player.y);
    const toPlayer = new Phaser.Math.Vector2(player.x - this.bomb.x, player.y - this.bomb.y);
    const movingTowardPlayer = toPlayer.lengthSq() > 0 && this.bomb.velocity.clone().normalize().dot(toPlayer.normalize()) > 0.35;
    if (this.bomb.breaksParry && distance <= BOMB.parryBlockDistance && movingTowardPlayer) {
      return this.completeParry(player, false);
    }

    if (distance <= BOMB.parryPerfectDistance && movingTowardPlayer) {
      return this.completeParry(player, true);
    }

    if (distance <= BOMB.parryBlockDistance && !movingTowardPlayer) {
      return this.completeParry(player, false);
    }

    return false;
  }

  private completeParry(player: Player, perfect: boolean) {
    this.parryActiveUntil.delete(player.id);
    this.playParryEffect(player, perfect);
    this.audio.playParry(perfect);
    this.queueOnlineEvent({
      type: "parry",
      x: Math.round(player.x),
      y: Math.round(player.y),
      color: player.color,
      playerId: player.id,
      perfect
    });

    if (perfect) {
      this.parryReadyAt.set(player.id, this.time.now);
      const target = this.bomb.responsible.alive && this.bomb.responsible !== player
        ? this.bomb.responsible
        : this.getNearestOpponent(player);
      if (!target) {
        return false;
      }
      const redirected = this.bomb.parryToward(player, target);
      if (redirected) {
        this.syncOnlineMatchState(true);
      }
      return redirected;
    }

    this.transferBomb(player);
    this.bomb.playTransferBurst(true);
    this.syncOnlineMatchState(true);
    return true;
  }

  private startFinalBattleMusic() {
    this.stopMatchMusic();
    this.stopJudgmentMusic();
    const music = this.getFinalBattleMusic();
    this.finalBattleMusicPrimed = true;
    music.muted = false;
    music.volume = this.getIntroMusicVolume();
    music.currentTime = 0;
    const fadeIn = () => this.fadeMusic(music, this.getTargetMusicVolume(), 3000);
    void music.play().then(fadeIn).catch(() => {
      const resume = () => {
        music.muted = false;
        music.volume = this.getIntroMusicVolume();
        music.currentTime = 0;
        void music.play().then(fadeIn);
      };
      this.input.once("pointerdown", resume);
      this.input.keyboard?.once("keydown", resume);
    });
  }

  private startMatchMusic() {
    if (this.matchMusicStarted || this.isFinalPhase()) {
      return;
    }

    const music = this.getMatchMusic();
    this.matchMusicStarted = true;
    music.muted = false;
    music.volume = this.getIntroMusicVolume();
    void music.play().then(() => this.fadeMusic(music, this.getTargetMusicVolume(), 3000)).catch(() => {
      this.matchMusicStarted = false;
    });
  }

  private stopMatchMusic() {
    const music = this.matchMusic;
    if (!music || music.paused) {
      return;
    }

    this.fadeMusic(music, 0, 600, () => {
      music.pause();
      music.currentTime = 0;
      this.matchMusicStarted = false;
    });
  }

  private startJudgmentMusic() {
    this.stopMatchMusic();
    this.stopFinalBattleMusic(1000);
    const music = this.getJudgmentMusic();
    music.muted = false;
    music.volume = this.getIntroMusicVolume();
    music.currentTime = 11;
    void music.play().then(() => {
      this.fadeMusic(music, this.getTargetMusicVolume(), 3000);
    }).catch(() => {
      const resume = () => {
        music.muted = false;
        music.volume = this.getIntroMusicVolume();
        music.currentTime = 11;
        void music.play().then(() => this.fadeMusic(music, this.getTargetMusicVolume(), 3000));
      };
      this.input.once("pointerdown", resume);
      this.input.keyboard?.once("keydown", resume);
    });
  }

  private stopJudgmentMusic(durationMs = 600) {
    const music = this.judgmentMusic;
    if (!music || music.paused) {
      return;
    }

    this.fadeMusic(music, 0, durationMs, () => {
      music.pause();
      music.currentTime = 11;
    });
  }

  private fadeMusic(music: HTMLAudioElement, targetVolume: number, durationMs: number, onComplete?: () => void) {
    this.tweens.addCounter({
      from: music.volume,
      to: targetVolume,
      duration: durationMs,
      ease: "Sine.easeInOut",
      onUpdate: (tween) => {
        music.volume = tween.getValue() ?? targetVolume;
      },
      onComplete
    });
  }

  private primeFinalBattleMusic() {
    if (this.finalBattleMusicPrimed) {
      return;
    }

    const music = this.getFinalBattleMusic();
    music.muted = true;
    music.volume = 0;
    music.currentTime = 0;
    void music.play().then(() => {
      this.finalBattleMusicPrimed = true;
    }).catch(() => {
      music.muted = false;
      music.volume = this.getTargetMusicVolume();
    });
  }

  private getIntroMusicVolume() {
    return 0.04 * this.settings.volume;
  }

  private getTargetMusicVolume() {
    return 0.2 * this.settings.volume;
  }

  private getFinalBattleMusic() {
    this.finalBattleMusic ??= new Audio("/audio/final-battle.mp3");
    this.finalBattleMusic.loop = true;
    this.finalBattleMusic.preload = "auto";
    this.finalBattleMusic.crossOrigin = "anonymous";
    return this.finalBattleMusic;
  }

  private getJudgmentMusic() {
    this.judgmentMusic ??= new Audio("/audio/judgment-chase.mp3");
    this.judgmentMusic.loop = true;
    this.judgmentMusic.preload = "auto";
    this.judgmentMusic.crossOrigin = "anonymous";
    return this.judgmentMusic;
  }

  private playJudgmentBellSound() {
    const bell = this.getJudgmentBellSound();
    bell.pause();
    bell.currentTime = 0;
    bell.volume = 0.55 * this.settings.volume;
    void bell.play().catch(() => undefined);
  }

  private getJudgmentBellSound() {
    this.judgmentBell ??= new Audio("/audio/judgment-bell.mp3");
    this.judgmentBell.preload = "auto";
    this.judgmentBell.crossOrigin = "anonymous";
    return this.judgmentBell;
  }

  private getMatchMusic() {
    this.matchMusic ??= new Audio("/audio/match-theme.mp3");
    this.matchMusic.loop = true;
    this.matchMusic.preload = "auto";
    this.matchMusic.crossOrigin = "anonymous";
    return this.matchMusic;
  }

  private connectOnlineRoom() {
    const online = this.settings.online;
    if (!online.enabled || !online.roomCode || this.onlineConnecting || this.onlineClient) {
      this.onlineStatusText.setText("");
      return;
    }

    this.onlineConnecting = true;
    this.onlineStatusText.setText(`ONLINE ${online.roomCode} ...`);
    const client = new OnlineRoomClient({
      roomCode: online.roomCode,
      playerId: online.playerId,
      playerName: this.settings.playerName,
      playerColor: this.human.color,
      isHost: online.role === "host",
      onError: () => {
        this.onlineStatusText.setText("ONLINE OFF");
        this.disableOnlineMode();
      }
    });

    void client.connect((room) => this.applyOnlineRoom(room)).then(() => {
      this.onlineClient = client;
      this.onlineConnecting = false;
      this.onlineStatusText.setText(`ONLINE ${online.roomCode}`);
      this.syncOnlinePlayer();
      this.syncOnlineMatchState(true);
      this.startOnlineHostHeartbeat();
    }).catch(() => {
      this.onlineConnecting = false;
      this.onlineStatusText.setText("ONLINE OFF");
      this.disableOnlineMode();
    });
  }

  private syncOnlinePlayer() {
    if (!this.onlineClient) {
      return;
    }

    const updated = this.onlineClient.updatePlayer({
      x: Math.round(this.human.x),
      y: Math.round(this.human.y),
      velocityX: Math.round(this.human.velocity.x),
      velocityY: Math.round(this.human.velocity.y),
      aimX: Number(this.human.aimDirection.x.toFixed(3)),
      aimY: Number(this.human.aimDirection.y.toFixed(3)),
      alive: this.human.alive,
      hasBomb: this.bomb.owner === this.human,
      hasWeapon: this.human.hasWeapon,
      actionSeq: this.pendingOnlineActionSeq,
      actionType: this.pendingOnlineActionType,
      dashSeq: this.pendingOnlineDashSeq,
      dashX: Number(this.pendingOnlineDashDirection.x.toFixed(3)),
      dashY: Number(this.pendingOnlineDashDirection.y.toFixed(3))
    });
    this.pendingOnlineActionType = undefined;
    if (!updated) {
      this.disableOnlineMode();
    }
  }

  private updateOnlineGuestInput(deltaSeconds: number) {
    if (this.roundResolving || this.matchOver) {
      return;
    }

    const moveDirection = this.inputSystem.getMoveDirection();
    const pointerWorld = this.getHumanAimTarget(moveDirection);
    const dashPressed = this.inputSystem.consumeDashPressed();
    if (dashPressed) {
      const dashDirection = moveDirection.lengthSq() > 0 ? moveDirection.clone() : this.human.aimDirection.clone();
      if (dashDirection.lengthSq() > 0) {
        this.pendingOnlineDashSeq += 1;
        this.pendingOnlineDashDirection.copy(dashDirection.normalize());
      }
    }
    this.human.updateHuman(
      deltaSeconds,
      moveDirection,
      pointerWorld,
      dashPressed
    );
    this.updateSpinThrowReadiness(this.human);
    this.keepPlayerInActiveArena(this.human);
  }

  private syncOnlineMatchState(force = false) {
    if (!this.onlineClient || this.settings.online.role !== "host") {
      return;
    }

    const updated = this.onlineClient.updateMatchState(this.createOnlineMatchState(), force);
    if (!updated) {
      this.disableOnlineMode();
    }
  }

  private getOnlinePlayerSlotId(player: Player) {
    const remoteSlot = this.remotePlayerSlots.get(player.id);
    return remoteSlot?.slotId ?? player.id;
  }

  private createOnlineMatchState(): OnlineMatchState {
    const match: OnlineMatchState = {
      updatedAt: Date.now(),
      music: this.getOnlineMusicState(),
      events: this.onlineEvents,
      players: this.players.map((player) => ({
        id: player.id,
        slotId: this.getOnlinePlayerSlotId(player),
        name: this.getPlayerName(player),
        color: player.color,
        x: Math.round(player.x),
        y: Math.round(player.y),
        velocityX: Math.round(player.velocity.x),
        velocityY: Math.round(player.velocity.y),
        aimX: Number(player.aimDirection.x.toFixed(3)),
        aimY: Number(player.aimDirection.y.toFixed(3)),
        alive: player.alive,
        lives: player.lives,
        hasBomb: this.bomb.owner === player,
        hasWeapon: player.hasWeapon,
        dashSeq: player.dashVisualSequence,
        dashX: Number(player.dashVisualDirection.x.toFixed(3)),
        dashY: Number(player.dashVisualDirection.y.toFixed(3))
      })),
      bomb: {
        x: Math.round(this.bomb.x),
        y: Math.round(this.bomb.y),
        state: this.bomb.state,
        ownerId: this.bomb.owner.id,
        responsibleId: this.bomb.responsible.id,
        velocityX: Math.round(this.bomb.velocity.x),
        velocityY: Math.round(this.bomb.velocity.y),
        speedMultiplier: Number(this.bomb.speedMultiplier.toFixed(3)),
        homingTargetId: this.bomb.homingTarget?.id ?? null,
        visible: this.bomb.shape.visible,
        isParryFlaming: this.bomb.isParryFlaming,
        breaksParry: this.bomb.breaksParry
      },
      arena: {
        aliveCount: this.getAlivePlayers().length,
        shape: this.getAlivePlayers().length <= 3 ? "octagon" : "rectangle",
        x: Math.round(this.arenaRect.x),
        y: Math.round(this.arenaRect.y),
        width: Math.round(this.arenaRect.width),
        height: Math.round(this.arenaRect.height)
      },
      shots: this.shots.map((shot) => this.createOnlineShotState(shot)),
      judgmentOrbs: this.judgmentOrbs.map((orb) => ({
        id: orb.id,
        x: Math.round(orb.shape.x),
        y: Math.round(orb.shape.y)
      })),
      judgmentOrbCounts: Object.fromEntries(this.judgmentOrbCounts),
      round: {
        aliveCount: this.getAlivePlayers().length,
        remainingMs: Math.max(0, Math.round(this.roundEndsAt - this.time.now)),
        timerSeconds: this.roundTimerSeconds,
        resolving: this.roundResolving,
        matchOver: this.matchOver,
        specialLivesRestored: this.specialRoundLivesRestored,
        winnerId: this.winner?.id ?? null
      }
    };

    if (this.weaponPickups.length > 0) {
      match.pickups = this.weaponPickups.map((pickup) => ({
        id: pickup.id,
        x: Math.round(pickup.shape.x),
        y: Math.round(pickup.shape.y)
      }));
    }

    return match;
  }

  private applyOnlineRoom(room: OnlineRoomSnapshot | null) {
    const online = this.settings.online;
    if (!room || !online.enabled) {
      return;
    }

    if (room.match) {
      const match = this.normalizeOnlineMatch(room.match);
      if (online.role === "guest" && match.updatedAt < this.lastOnlineMatchUpdatedAt) {
        return;
      }

      this.lastOnlineMatchUpdatedAt = match.updatedAt;
      this.latestOnlineMatch = match;
      this.lastOnlineMatchAt = this.time.now;
      if (online.role === "guest") {
        this.applyOnlineMusicState(match.music);
        this.applyOnlineEvents(match.events);
      }
    }

    if (online.role === "guest") {
      return;
    }

    if (!room.players) {
      return;
    }

    const seen = new Set<string>();
    for (const snapshot of Object.values(room.players)) {
      if (!snapshot || snapshot.id === online.playerId) {
        continue;
      }

      seen.add(snapshot.id);
      this.updateRemoteControlledPlayer(snapshot);
    }

    for (const [id, slot] of this.remotePlayerSlots) {
      if (seen.has(id)) {
        continue;
      }

      this.remotePlayerSlots.delete(id);
      this.remotePlayerTargets.delete(id);
      this.processedRemoteActions.delete(id);
      this.processedRemoteDashes.delete(id);
      const player = slot.player;
      if (player.alive) {
        player.setEliminated();
        player.setBombHolder(false);
      }
    }

    for (const [id, avatar] of this.remoteAvatars) {
      if (seen.has(id)) {
        continue;
      }

      avatar.container.destroy(true);
      this.remoteAvatars.delete(id);
    }

    this.syncOnlineMatchState(true);
  }

  private updateRemoteControlledPlayer(snapshot: OnlinePlayerSnapshot) {
    const player = this.getRemotePlayerSlot(snapshot);
    if (!player) {
      this.updateRemoteAvatar(snapshot);
      return;
    }

    player.name = snapshot.name;
    player.label.setText(snapshot.name);
    player.aimDirection.set(snapshot.aimX, snapshot.aimY);
    if (player.aimDirection.lengthSq() > 0) {
      player.aimDirection.normalize();
      player.aim.rotation = player.aimDirection.angle();
    }
    this.updateSpinThrowReadiness(player);
    this.remotePlayerTargets.set(snapshot.id, {
      x: snapshot.x,
      y: snapshot.y,
      velocityX: snapshot.velocityX,
      velocityY: snapshot.velocityY,
      aimX: snapshot.aimX,
      aimY: snapshot.aimY,
      lastSnapshotAt: this.time.now
    });
    player.setBombHolder(this.bomb.owner === player);
    this.processRemotePlayerDash(player, snapshot);
    this.processRemotePlayerAction(player, snapshot);
  }

  private updateRemoteControlledSlot(player: Player, deltaSeconds: number) {
    const target = this.remotePlayerTargets.get(player.id);
    if (target) {
      const snapshotAgeSeconds = Phaser.Math.Clamp((this.time.now - target.lastSnapshotAt) / 1000, 0, 0.12);
      const targetX = target.x + target.velocityX * snapshotAgeSeconds;
      const targetY = target.y + target.velocityY * snapshotAgeSeconds;
      const distanceToTarget = Phaser.Math.Distance.Between(player.x, player.y, targetX, targetY);
      const blend = distanceToTarget > 260 ? 1 : 1 - Math.exp(-deltaSeconds * 18);
      player.container.setPosition(
        Phaser.Math.Linear(player.x, targetX, blend),
        Phaser.Math.Linear(player.y, targetY, blend)
      );
      player.velocity.set(target.velocityX, target.velocityY);
      player.aimDirection.set(target.aimX, target.aimY);
      if (player.aimDirection.lengthSq() > 0) {
        player.aimDirection.normalize();
        player.aim.rotation = player.aimDirection.angle();
      }
    } else {
      player.container.x += player.velocity.x * deltaSeconds;
      player.container.y += player.velocity.y * deltaSeconds;
      player.velocity.scale(Math.pow(0.985, deltaSeconds * 60));
    }
    player.setBombHolder(this.bomb.owner === player);
  }

  private getRemotePlayerSlot(snapshot: OnlinePlayerSnapshot) {
    const existing = this.remotePlayerSlots.get(snapshot.id);
    if (existing) {
      return existing.player;
    }

    const slot = this.players.find((player) => (
      player.kind === "bot" &&
      player.alive &&
      !Array.from(this.remotePlayerSlots.values()).some((remoteSlot) => remoteSlot.player === player)
    ));
    if (!slot) {
      return undefined;
    }

    this.botThrowReadyAt.delete(slot.id);
    this.botShotReadyAt.delete(slot.id);
    this.botParryThinkAt.delete(slot.id);
    const slotId = slot.id;
    slot.id = snapshot.id;
    slot.name = snapshot.name;
    slot.label.setText(snapshot.name);
    slot.body.setStrokeStyle(3, 0xffffff, 0.75);
    this.remotePlayerSlots.set(snapshot.id, { player: slot, slotId });
    return slot;
  }

  private processRemotePlayerAction(player: Player, snapshot: OnlinePlayerSnapshot) {
    if (!snapshot.actionSeq || !snapshot.actionType) {
      return;
    }

    const previousSeq = this.processedRemoteActions.get(snapshot.id) ?? 0;
    if (snapshot.actionSeq <= previousSeq || this.roundResolving || this.matchOver) {
      return;
    }

    this.processedRemoteActions.set(snapshot.id, snapshot.actionSeq);
    if (snapshot.actionType === "parry") {
      this.tryParry(player);
      return;
    }

    if (this.bomb.state === "HELD" && this.bomb.owner === player) {
      this.launchBomb(player.aimDirection.clone());
      return;
    }

    this.fireWeapon(player, player.aimDirection.clone());
  }

  private processRemotePlayerDash(player: Player, snapshot: Pick<OnlinePlayerSnapshot, "id" | "dashSeq" | "dashX" | "dashY">) {
    if (!snapshot.dashSeq) {
      return;
    }

    const previousSeq = this.processedRemoteDashes.get(snapshot.id) ?? 0;
    if (snapshot.dashSeq <= previousSeq) {
      return;
    }

    this.processedRemoteDashes.set(snapshot.id, snapshot.dashSeq);
    const direction = new Phaser.Math.Vector2(snapshot.dashX ?? player.aimDirection.x, snapshot.dashY ?? player.aimDirection.y);
    if (direction.lengthSq() === 0) {
      direction.copy(player.aimDirection);
    }
    player.playDashVisual(direction.normalize());
  }

  private isRemoteControlledPlayer(player: Player) {
    return this.remotePlayerSlots.get(player.id)?.player === player;
  }

  private isBotControlledPlayer(player: Player) {
    return player.kind === "bot" && !this.isRemoteControlledPlayer(player);
  }

  private updateRemoteAvatar(snapshot: OnlinePlayerSnapshot) {
    const avatar = this.remoteAvatars.get(snapshot.id) ?? this.createRemoteAvatar(snapshot);
    avatar.container.setPosition(snapshot.x, snapshot.y);
    avatar.container.setVisible(snapshot.alive);
    avatar.container.setAlpha(snapshot.alive ? 0.78 : 0.18);
    avatar.aim.rotation = Math.atan2(snapshot.aimY, snapshot.aimX);
    avatar.label.setText(snapshot.name);
    avatar.body.setFillStyle(snapshot.color, 0.86);
    avatar.body.setStrokeStyle(3, snapshot.hasBomb ? 0xffcf33 : 0x86f7ff, snapshot.hasBomb ? 0.95 : 0.5);
    avatar.weaponBadge.setVisible(snapshot.hasWeapon);
    avatar.weaponBadge.setAlpha(snapshot.hasWeapon ? 0.9 : 0);
  }

  private createRemoteAvatar(snapshot: OnlinePlayerSnapshot) {
    const body = this.add.circle(0, 0, PLAYER.radius, snapshot.color, 0.86);
    body.setStrokeStyle(3, 0x86f7ff, 0.5);
    const aim = this.add.rectangle(PLAYER.radius + 14, 0, 34, 5, 0x86f7ff, 0.68);
    aim.setOrigin(0, 0.5);
    const weaponBadge = this.add.rectangle(0, PLAYER.radius + 13, 26, 6, 0x86f7ff, 0);
    weaponBadge.setStrokeStyle(1, 0xffffff, 0.4);
    const label = this.add.text(0, -38, snapshot.name, {
      color: "#86f7ff",
      fontFamily: "ui-sans-serif, system-ui",
      fontSize: "13px",
      fontStyle: "800"
    });
    label.setOrigin(0.5);
    const container = this.add.container(snapshot.x, snapshot.y, [body, aim, weaponBadge, label]);
    container.setDepth(6);
    const avatar = { container, body, aim, label, weaponBadge };
    this.remoteAvatars.set(snapshot.id, avatar);
    return avatar;
  }

  private normalizeOnlineMatch(match: OnlineMatchState): OnlineMatchState {
    const aliveCount = match.round?.aliveCount ?? match.players?.length ?? BOT.count + 1;
    const arenaRect = this.getArenaBounds(aliveCount);
    return {
      ...match,
      music: match.music ?? "none",
      events: this.toOnlineArray(match.events),
      players: this.toOnlineArray(match.players),
      shots: this.toOnlineArray(match.shots),
      pickups: this.toOnlineArray(match.pickups),
      judgmentOrbs: this.toOnlineArray(match.judgmentOrbs),
      judgmentOrbCounts: match.judgmentOrbCounts ?? {},
      arena: match.arena ?? {
        aliveCount,
        shape: aliveCount <= 3 ? "octagon" : "rectangle",
        x: Math.round(arenaRect.x),
        y: Math.round(arenaRect.y),
        width: Math.round(arenaRect.width),
        height: Math.round(arenaRect.height)
      },
      round: {
        ...match.round,
        specialLivesRestored: match.round?.specialLivesRestored ?? aliveCount <= 3
      }
    };
  }

  private toOnlineArray<T>(value: T[] | Record<string, T> | undefined | null): T[] {
    if (!value) {
      return [];
    }

    return Array.isArray(value)
      ? value.filter(Boolean)
      : Object.values(value).filter(Boolean);
  }

  private updateGuestOnlineView(deltaSeconds: number) {
    this.updateOnlineShotVisuals(deltaSeconds);
    const match = this.latestOnlineMatch;
    if (!match) {
      this.onlineStatusText.setText(`ONLINE ${this.settings.online.roomCode} WAIT`);
      this.updateHud(false);
      return;
    }

    const snapshotAge = this.time.now - this.lastOnlineMatchAt;
    this.onlineStatusText.setText(snapshotAge > 3000
      ? `ONLINE ${this.settings.online.roomCode} STALE`
      : `ONLINE ${this.settings.online.roomCode}`);
    if (!match.round || !match.bomb) {
      this.updateHud(false);
      return;
    }

    this.applyOnlineArena(match.arena);

    const blend = 1 - Math.exp(-deltaSeconds * 12);
    const predictionSeconds = Math.min(0.14, Math.max(0, snapshotAge / 1000));
    for (const snapshot of match.players) {
      const player = this.getOnlineRenderedPlayer(snapshot);
      if (!player) {
        continue;
      }

      const previousLives = this.onlineKnownLives.get(snapshot.id);
      if (previousLives !== undefined && snapshot.lives < previousLives && snapshot.alive) {
        this.showLifeLostFeedback(player, snapshot.x, snapshot.y);
      }
      this.onlineKnownLives.set(snapshot.id, snapshot.lives);
      this.applyOnlinePlayerState(player, snapshot, blend, predictionSeconds);
    }

    const owner = this.players.find((player) => player.id === match.bomb.ownerId) ?? this.human;
    const responsible = this.players.find((player) => player.id === match.bomb.responsibleId) ?? owner;
    this.bomb.owner = owner;
    this.bomb.responsible = responsible;
    this.bomb.state = match.bomb.state;
    this.bomb.velocity.set(match.bomb.velocityX, match.bomb.velocityY);
    this.bomb.setIntensity(match.bomb.speedMultiplier ?? this.baseBombSpeedMultiplier);
    this.bomb.breaksParry = Boolean(match.bomb.breaksParry);
    this.bomb.setParryFlaming(Boolean(match.bomb.isParryFlaming));
    const homingTarget = match.bomb.homingTargetId
      ? this.players.find((player) => player.id === match.bomb.homingTargetId) ?? null
      : null;
    this.bomb.setHomingTarget(homingTarget);
    if (homingTarget && match.bomb.state === "OUTBOUND" && this.lastOnlineHomingTargetId !== homingTarget.id) {
      this.showHomingIndicator(homingTarget);
    } else if (!homingTarget || match.bomb.state === "HELD") {
      this.clearHomingIndicator();
    }
    this.lastOnlineHomingTargetId = homingTarget?.id ?? null;
    this.bomb.setVisible(match.bomb.visible);
    if (this.isOnlineGuest() && owner === this.human && match.bomb.state === "HELD") {
      this.bomb.shape.setPosition(
        this.human.x + this.human.aimDirection.x * BOMB.heldOffset,
        this.human.y + this.human.aimDirection.y * BOMB.heldOffset
      );
      this.bomb.fuse.setPosition(this.bomb.shape.x, this.bomb.shape.y);
      this.bomb.directionRing.setPosition(this.bomb.shape.x, this.bomb.shape.y);
      this.bomb.updateRemoteVisuals();
      this.applyOnlineShots(match.shots ?? [], deltaSeconds);
      this.applyOnlinePickups(match.pickups ?? []);
      this.applyOnlineJudgmentOrbs(match.judgmentOrbs ?? []);
      this.applyOnlineJudgmentOrbCounts(match.judgmentOrbCounts ?? {});
      this.roundResolving = match.round.resolving;
      this.matchOver = match.round.matchOver;
      this.specialRoundLivesRestored = match.round.specialLivesRestored;
      this.roundTimerSeconds = match.round.timerSeconds;
      this.roundEndsAt = this.time.now + match.round.remainingMs;
      this.winner = match.round.winnerId
        ? this.players.find((player) => player.id === match.round.winnerId)
        : undefined;
      this.updateHud(false);
      return;
    }
    const bombTargetX = match.bomb.state === "HELD"
      ? match.bomb.x
      : match.bomb.x + match.bomb.velocityX * predictionSeconds;
    const bombTargetY = match.bomb.state === "HELD"
      ? match.bomb.y
      : match.bomb.y + match.bomb.velocityY * predictionSeconds;
    const bombBlend = 1 - Math.exp(-deltaSeconds * 16);
    const bombX = Phaser.Math.Linear(this.bomb.x, bombTargetX, bombBlend);
    const bombY = Phaser.Math.Linear(this.bomb.y, bombTargetY, bombBlend);
    this.bomb.shape.setPosition(bombX, bombY);
    this.bomb.fuse.setPosition(bombX, bombY);
    this.bomb.directionRing.setPosition(bombX, bombY);
    this.bomb.updateRemoteVisuals();
    this.applyOnlineShots(match.shots ?? [], deltaSeconds);
    this.applyOnlinePickups(match.pickups ?? []);
    this.applyOnlineJudgmentOrbs(match.judgmentOrbs ?? []);
    this.applyOnlineJudgmentOrbCounts(match.judgmentOrbCounts ?? {});

    this.roundResolving = match.round.resolving;
    this.matchOver = match.round.matchOver;
    this.specialRoundLivesRestored = match.round.specialLivesRestored;
    this.roundTimerSeconds = match.round.timerSeconds;
    this.roundEndsAt = this.time.now + match.round.remainingMs;
    this.winner = match.round.winnerId
      ? this.players.find((player) => player.id === match.round.winnerId)
      : undefined;
    this.updateHud(false);
  }

  private applyOnlineArena(arena: OnlineMatchState["arena"]) {
    const needsArenaUpdate =
      !arena ||
      Math.round(this.arenaRect.x) !== arena.x ||
      Math.round(this.arenaRect.y) !== arena.y ||
      Math.round(this.arenaRect.width) !== arena.width ||
      Math.round(this.arenaRect.height) !== arena.height ||
      (arena.shape === "octagon") !== Boolean(this.arenaPolygon);

    if (!needsArenaUpdate) {
      return;
    }

    this.createArena(arena?.aliveCount ?? this.getAlivePlayers().length);
  }

  private applyOnlinePlayerState(player: Player, snapshot: OnlineMatchPlayerState, blend: number, predictionSeconds: number) {
    const previousLives = player.lives;
    const previousWeapon = player.hasWeapon;
    player.alive = snapshot.alive;
    player.setLives(snapshot.lives, snapshot.lives < previousLives);
    player.setWeaponEquipped(snapshot.hasWeapon, snapshot.hasWeapon && !previousWeapon);
    player.container.setVisible(snapshot.alive);
    player.container.setAlpha(snapshot.alive ? 1 : 0.2);
    player.container.setScale(snapshot.alive ? 1 : 0.72);
    if (this.isOnlineGuest() && player === this.human) {
      player.setBombHolder(snapshot.hasBomb);
      return;
    }
    this.processRemotePlayerDash(player, snapshot);
    const targetX = snapshot.x + (snapshot.velocityX ?? 0) * predictionSeconds;
    const targetY = snapshot.y + (snapshot.velocityY ?? 0) * predictionSeconds;
    const distanceToTarget = Phaser.Math.Distance.Between(player.x, player.y, targetX, targetY);
    if (distanceToTarget > 220) {
      player.container.setPosition(targetX, targetY);
    } else {
      player.container.setPosition(
        Phaser.Math.Linear(player.x, targetX, blend),
        Phaser.Math.Linear(player.y, targetY, blend)
      );
    }
    player.velocity.set(0, 0);
    player.aimDirection.set(snapshot.aimX, snapshot.aimY);
    if (player.aimDirection.lengthSq() > 0) {
      player.aimDirection.normalize();
      player.aim.rotation = player.aimDirection.angle();
    }
    player.label.setText(snapshot.name);
    player.body.setFillStyle(snapshot.color, 1);
    player.setBombHolder(snapshot.hasBomb);
  }

  private getOnlineRenderedPlayer(snapshot: OnlineMatchPlayerState) {
    if (snapshot.id === this.settings.online.playerId) {
      return this.human;
    }

    const direct = this.players.find((player) => player.id === snapshot.id);
    if (direct) {
      return direct;
    }

    const existing = this.remotePlayerSlots.get(snapshot.id);
    if (existing) {
      return existing.player;
    }

    const slot = (
      snapshot.slotId ? this.players.find((player) => player.id === snapshot.slotId) : undefined
    ) ?? this.players.find((player) => (
          player !== this.human &&
          player.kind === "bot" &&
          !Array.from(this.remotePlayerSlots.values()).some((remoteSlot) => remoteSlot.player === player)
        ));
    if (!slot) {
      return undefined;
    }

    const slotId = snapshot.slotId ?? slot.id;
    slot.id = snapshot.id;
    slot.name = snapshot.name;
    slot.label.setText(snapshot.name);
    this.remotePlayerSlots.set(snapshot.id, { player: slot, slotId });
    return slot;
  }

  private applyOnlineShots(shots: OnlineShotState[], deltaSeconds: number) {
    const seen = new Set<string>();
    for (const shot of shots) {
      seen.add(shot.id);
      const visual = this.onlineShotVisuals.get(shot.id) ?? this.createOnlineShotVisual(shot);
      visual.velocity.set(shot.velocityX, shot.velocityY);
      visual.expiresAt = this.time.now + shot.remainingMs;
      visual.lastSnapshotAt = this.time.now;
      const blend = 1 - Math.exp(-deltaSeconds * 20);
      visual.shape.setPosition(
        Phaser.Math.Linear(visual.shape.x, shot.x, blend),
        Phaser.Math.Linear(visual.shape.y, shot.y, blend)
      );
      visual.shape.setRotation(shot.rotation);
      visual.shape.setFillStyle(shot.color, 0.95);
      visual.spark.setPosition(visual.shape.x, visual.shape.y);
      visual.spark.setFillStyle(shot.color, 0.22);
      visual.spark.setAlpha(0.12 + Math.sin(this.time.now * 0.035) * 0.06);
    }

    for (const [id, visual] of this.onlineShotVisuals) {
      if (seen.has(id) && this.time.now < visual.expiresAt + 80) {
        continue;
      }

      visual.shape.destroy();
      visual.spark.destroy();
      this.onlineShotVisuals.delete(id);
    }
  }

  private createOnlineShotVisual(shot: OnlineShotState) {
    const shape = this.add.rectangle(shot.x, shot.y, 30, 8, shot.color, 0.95);
    shape.setRotation(shot.rotation);
    shape.setStrokeStyle(1, 0xffffff, 0.45);
    shape.setDepth(4);

    const spark = this.add.circle(shot.x, shot.y, WEAPON.shotRadius + 5, shot.color, 0.22);
    spark.setDepth(3);

    const visual = {
      shape,
      spark,
      velocity: new Phaser.Math.Vector2(shot.velocityX, shot.velocityY),
      expiresAt: this.time.now + shot.remainingMs,
      lastSnapshotAt: this.time.now
    };
    this.onlineShotVisuals.set(shot.id, visual);
    return visual;
  }

  private createOnlineShotState(shot: Shot): OnlineShotState {
    return {
      id: shot.id,
      ownerId: shot.owner.id,
      x: Math.round(shot.shape.x),
      y: Math.round(shot.shape.y),
      rotation: Number(shot.shape.rotation.toFixed(3)),
      color: shot.owner.color,
      velocityX: Math.round(shot.velocity.x),
      velocityY: Math.round(shot.velocity.y),
      remainingMs: Math.max(0, Math.round(shot.expiresAt - this.time.now))
    };
  }

  private applyOnlinePickups(pickups: OnlineWeaponPickupState[]) {
    const seen = new Set<string>();
    for (const pickup of pickups) {
      seen.add(pickup.id);
      const visual = this.onlinePickupVisuals.get(pickup.id) ?? this.createOnlinePickupVisual(pickup);
      visual.shape.setPosition(pickup.x, pickup.y);
      visual.ring.setPosition(pickup.x, pickup.y);
    }

    for (const [id, visual] of this.onlinePickupVisuals) {
      if (seen.has(id)) {
        continue;
      }

      this.tweens.killTweensOf(visual.ring);
      visual.shape.destroy();
      visual.ring.destroy();
      this.onlinePickupVisuals.delete(id);
    }
  }

  private createOnlinePickupVisual(pickup: OnlineWeaponPickupState) {
    const ring = this.add.circle(pickup.x, pickup.y, WEAPON.pickupRadius + 8, 0x86f7ff, 0.08);
    ring.setStrokeStyle(2, 0x86f7ff, 0.55);
    ring.setDepth(1);

    const shape = this.add.circle(pickup.x, pickup.y, WEAPON.pickupRadius, 0x263442, 1);
    shape.setStrokeStyle(3, 0x86f7ff, 0.9);
    shape.setDepth(2);

    this.tweens.add({
      targets: ring,
      scale: 1.28,
      alpha: 0.22,
      duration: 620,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });

    const visual = { shape, ring };
    this.onlinePickupVisuals.set(pickup.id, visual);
    return visual;
  }

  private applyOnlineJudgmentOrbs(orbs: OnlineJudgmentOrbState[]) {
    const seen = new Set<string>();
    for (const orb of orbs) {
      seen.add(orb.id);
      const visual = this.onlineJudgmentOrbVisuals.get(orb.id) ?? this.createOnlineJudgmentOrbVisual(orb);
      visual.shape.setPosition(orb.x, orb.y);
      visual.ring.setPosition(orb.x, orb.y);
    }

    for (const [id, visual] of this.onlineJudgmentOrbVisuals) {
      if (seen.has(id)) {
        continue;
      }

      this.tweens.killTweensOf(visual.ring);
      visual.shape.destroy();
      visual.ring.destroy();
      this.onlineJudgmentOrbVisuals.delete(id);
    }
  }

  private applyOnlineJudgmentOrbCounts(counts: Record<string, number>) {
    this.judgmentOrbCounts.clear();
    for (const [playerId, count] of Object.entries(counts)) {
      this.judgmentOrbCounts.set(playerId, count);
    }
    this.updateJudgmentOrbPips();
  }

  private createOnlineJudgmentOrbVisual(orb: OnlineJudgmentOrbState) {
    const ring = this.add.circle(orb.x, orb.y, JUDGMENT_ORB.radius + 10, 0xffcf33, 0.08);
    ring.setStrokeStyle(3, 0xffcf33, 0.66);
    ring.setDepth(2);
    const shape = this.add.circle(orb.x, orb.y, JUDGMENT_ORB.radius, 0xffcf33, 0.96);
    shape.setStrokeStyle(3, 0xfff0a6, 0.88);
    shape.setDepth(3);

    this.tweens.add({
      targets: ring,
      scale: 1.45,
      alpha: 0.28,
      duration: 540,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });

    const visual = { id: orb.id, shape, ring };
    this.onlineJudgmentOrbVisuals.set(orb.id, visual);
    return visual;
  }

  private clearOnlineJudgmentOrbVisuals() {
    for (const visual of this.onlineJudgmentOrbVisuals.values()) {
      this.tweens.killTweensOf(visual.ring);
      visual.shape.destroy();
      visual.ring.destroy();
    }
    this.onlineJudgmentOrbVisuals.clear();
  }

  private updateOnlineShotVisuals(deltaSeconds: number) {
    const elapsedSeconds = Math.min(0.05, Math.max(0, deltaSeconds));
    for (const [id, visual] of this.onlineShotVisuals) {
      if (this.time.now >= visual.expiresAt + 80) {
        visual.shape.destroy();
        visual.spark.destroy();
        this.onlineShotVisuals.delete(id);
        continue;
      }

      visual.shape.x += visual.velocity.x * elapsedSeconds;
      visual.shape.y += visual.velocity.y * elapsedSeconds;
      visual.spark.setPosition(visual.shape.x, visual.shape.y);
      visual.spark.setAlpha(0.12 + Math.sin(this.time.now * 0.035) * 0.06);
    }
  }

  private updateDebugSnapshot() {
    if (!this.debugMode || this.time.now < this.nextDebugSnapshotAt) {
      return;
    }

    this.nextDebugSnapshotAt = this.time.now + 120;
    const debugSnapshot = {
      online: this.settings.online,
      time: Math.round(this.time.now),
      players: this.players.map((player) => ({
        id: player.id,
        x: Math.round(player.x),
        y: Math.round(player.y),
        alive: player.alive,
        lives: player.lives,
        hasBomb: this.bomb.owner === player,
        hasWeapon: player.hasWeapon
      })),
      bomb: {
        x: Math.round(this.bomb.x),
        y: Math.round(this.bomb.y),
        state: this.bomb.state,
        ownerId: this.bomb.owner.id,
        responsibleId: this.bomb.responsible.id,
        homingTargetId: this.bomb.homingTarget?.id ?? null,
        homingIndicatorVisible: this.homingIndicator?.graphics.visible ?? false,
        isParryFlaming: this.bomb.isParryFlaming,
        breaksParry: this.bomb.breaksParry,
        visible: this.bomb.shape.visible
      },
      arena: {
        x: Math.round(this.arenaRect.x),
        y: Math.round(this.arenaRect.y),
        width: Math.round(this.arenaRect.width),
        height: Math.round(this.arenaRect.height),
        shape: this.arenaPolygon ? "octagon" : "rectangle"
      },
      round: {
        aliveCount: this.getAlivePlayers().length,
        remainingMs: Math.max(0, Math.round(this.roundEndsAt - this.time.now)),
        timerSeconds: this.roundTimerSeconds,
        resolving: this.roundResolving,
        matchOver: this.matchOver,
        specialLivesRestored: this.specialRoundLivesRestored,
        music: this.getOnlineMusicState()
      },
      pickups: this.weaponPickups.map((pickup) => ({
        id: pickup.id,
        x: Math.round(pickup.shape.x),
        y: Math.round(pickup.shape.y)
      })),
      remotePickups: Array.from(this.onlinePickupVisuals, ([id, visual]) => ({
        id,
        x: Math.round(visual.shape.x),
        y: Math.round(visual.shape.y)
      })),
      judgmentOrbs: this.judgmentOrbs.map((orb) => ({
        id: orb.id,
        x: Math.round(orb.shape.x),
        y: Math.round(orb.shape.y)
      })),
      judgmentOrbCounts: Object.fromEntries(this.judgmentOrbCounts),
      shots: this.shots.map((shot) => ({
        id: shot.id,
        x: Math.round(shot.shape.x),
        y: Math.round(shot.shape.y)
      })),
      remoteShots: Array.from(this.onlineShotVisuals, ([id, visual]) => ({
        id,
        x: Math.round(visual.shape.x),
        y: Math.round(visual.shape.y)
      })),
      events: this.onlineEvents.slice(-8).map((event) => ({
        id: event.id,
        type: event.type
      })),
      matchEvents: this.latestOnlineMatch?.events.slice(-8).map((event) => ({
        id: event.id,
        type: event.type
      })) ?? [],
      processedEventCount: this.processedOnlineEvents.size,
      latestMatchAge: this.latestOnlineMatch ? Math.round(this.time.now - this.lastOnlineMatchAt) : null
    };

    (window as DebugWindow).__bombTagDebug = debugSnapshot;
    this.game.canvas.dataset.bombDebug = JSON.stringify(debugSnapshot);
  }

  private isOnlineGuest() {
    return this.settings.online.enabled && this.settings.online.role === "guest";
  }

  private disableOnlineMode() {
    this.stopOnlineHostHeartbeat();
    this.onlineClient?.disconnect();
    this.onlineClient = undefined;
    this.onlineConnecting = false;
    this.settings.online.enabled = false;
    this.latestOnlineMatch = undefined;
    this.lastOnlineMatchUpdatedAt = 0;
    this.onlineEventsPrimed = false;
    this.lastOnlineHomingTargetId = null;
    this.onlineKnownLives.clear();
    this.remotePlayerSlots.clear();
    this.remotePlayerTargets.clear();
    this.processedRemoteActions.clear();
    this.processedRemoteDashes.clear();
    this.botParryThinkAt.clear();
    this.parryActiveUntil.clear();
    this.spinThrowTrackers.clear();
    this.pendingOnlineActionSeq = 0;
    this.pendingOnlineActionType = undefined;
    this.pendingOnlineDashSeq = 0;
    this.clearOnlineShotVisuals();
    this.clearOnlinePickupVisuals();
  }

  private clearOnlineShotVisuals() {
    for (const visual of this.onlineShotVisuals.values()) {
      visual.shape.destroy();
      visual.spark.destroy();
    }

    this.onlineShotVisuals.clear();
  }

  private clearOnlinePickupVisuals() {
    for (const visual of this.onlinePickupVisuals.values()) {
      this.tweens.killTweensOf(visual.ring);
      visual.shape.destroy();
      visual.ring.destroy();
    }

    this.onlinePickupVisuals.clear();
  }

  private queueOnlineEvent(event: OnlineCombatEventDraft) {
    if (!this.settings.online.enabled || this.settings.online.role !== "host") {
      return;
    }

    const id = `${Date.now()}-${this.onlineEventSequence}`;
    this.onlineEventSequence += 1;
    this.onlineEvents = [...this.onlineEvents, { ...event, id } as OnlineCombatEvent].slice(-32);
    this.syncOnlineMatchState(true);
  }

  private applyOnlineEvents(events: OnlineCombatEvent[]) {
    if (!this.onlineEventsPrimed) {
      for (const event of events) {
        this.processedOnlineEvents.add(event.id);
      }
      this.onlineEventsPrimed = true;
      return;
    }

    for (const event of events) {
      if (this.processedOnlineEvents.has(event.id)) {
        continue;
      }

      this.processedOnlineEvents.add(event.id);
      this.applyOnlineEvent(event);
    }

    if (this.processedOnlineEvents.size > 80) {
      this.processedOnlineEvents = new Set(Array.from(this.processedOnlineEvents).slice(-48));
    }
  }

  private applyOnlineEvent(event: OnlineCombatEvent) {
    if (event.type === "bombHit") {
      this.audio.playHitVariant(event.variant as HitSoundVariant, false);
      this.bomb.playTransferBurst(event.isSpecial);
      return;
    }

    if (event.type === "weaponPickup") {
      this.audio.playWeaponPickup();
      return;
    }

    if (event.type === "weaponShot") {
      this.audio.playWeaponShot();
      const visual = this.onlineShotVisuals.get(event.shot.id) ?? this.createOnlineShotVisual(event.shot);
      visual.velocity.set(event.shot.velocityX, event.shot.velocityY);
      visual.expiresAt = this.time.now + event.shot.remainingMs;
      visual.lastSnapshotAt = this.time.now;
      return;
    }

    if (event.type === "shotDamage") {
      this.audio.playShotDamage(event.isHumanTarget);
      this.playShotImpact(event.x, event.y, event.color);
      const target = this.players.find((player) => player.id === event.targetId);
      if (target) {
        this.showLifeLostFeedback(target);
      }
      return;
    }

    if (event.type === "parry") {
      this.audio.playParry(event.perfect);
      const player = this.players.find((candidate) => candidate.id === event.playerId);
      if (player) {
        this.playParryEffect(player, event.perfect, event.x, event.y);
      }
      return;
    }

    if (event.type === "explosion") {
      this.cameras.main.shake(150, 0.006);
      this.playExplosion(event.x, event.y, event.color);
      return;
    }

    if (event.type === "finalTransition") {
      this.playFinalRoundTransition(event.aliveCount, false);
      return;
    }

    if (event.type === "judgmentTransition") {
      const defender = this.players.find((player) => player.id === event.defenderId);
      const challenger = this.players.find((player) => player.id === event.challengerId);
      if (defender) {
        this.playJudgmentTransition(defender, false, challenger);
      }
      return;
    }

    if (event.type === "judgmentOrbComplete") {
      this.playJudgmentBellSound();
      const collector = this.players.find((player) => player.id === event.collectorId);
      if (collector) {
        this.playJudgmentOrbCollectEffect(collector);
      }
      return;
    }

    this.currentRoundMessageKey = event.key;
    this.showRoundMessage(event.message, event.color, event.duration);
  }

  private getOnlineMusicState(): OnlineMusicState {
    if (this.matchOver) {
      return "none";
    }

    if (this.isJudgmentDefensePhase()) {
      return "judgment";
    }

    return this.isFinalPhase() ? "final" : "match";
  }

  private applyOnlineMusicState(state: OnlineMusicState) {
    if (this.lastOnlineMusicState === state) {
      return;
    }

    this.lastOnlineMusicState = state;
    if (state === "judgment") {
      this.startJudgmentMusic();
      return;
    }

    if (state === "final") {
      this.startFinalBattleMusic();
      return;
    }

    if (state === "match") {
      this.stopFinalBattleMusic();
      this.stopJudgmentMusic();
      this.startMatchMusic();
      return;
    }

    this.stopMatchMusic();
    this.stopFinalBattleMusic();
    this.stopJudgmentMusic();
  }

  private stopFinalBattleMusic(durationMs = 600) {
    const music = this.finalBattleMusic;
    if (!music || music.paused) {
      return;
    }

    this.fadeMusic(music, 0, durationMs, () => {
      music.pause();
      music.currentTime = 0;
      this.finalBattleMusicPrimed = false;
    });
  }

  private startOnlineHostHeartbeat() {
    this.stopOnlineHostHeartbeat();
    if (this.settings.online.role !== "host") {
      return;
    }

    this.onlineHostHeartbeat = window.setInterval(() => {
      this.syncOnlinePlayer();
      this.syncOnlineMatchState(true);
    }, 500);
  }

  private stopOnlineHostHeartbeat() {
    if (this.onlineHostHeartbeat === undefined) {
      return;
    }

    window.clearInterval(this.onlineHostHeartbeat);
    this.onlineHostHeartbeat = undefined;
  }

  private updateWeapons() {
    const isFinalPhase = this.isFinalPhase();
    const maxPickups = isFinalPhase ? WEAPON.maxPickupsSpecial : WEAPON.maxPickupsNormal;
    if (this.time.now >= this.nextWeaponSpawnAt) {
      if (this.weaponPickups.length < maxPickups) {
        this.spawnWeaponPickup();
      }
      this.nextWeaponSpawnAt = this.time.now + (isFinalPhase ? WEAPON.specialSpawnEveryMs : WEAPON.spawnEveryMs);
    }

    for (const player of this.getAlivePlayers()) {
      if (this.isJudgmentDefensePhase() && player !== this.judgmentDefender) {
        continue;
      }

      if (player.hasWeapon) {
        continue;
      }

      const pickup = this.weaponPickups.find((item) => (
        Phaser.Math.Distance.Between(player.x, player.y, item.shape.x, item.shape.y) <= WEAPON.pickupDetectRadius
      ));

      if (pickup) {
        player.pickWeapon();
        this.audio.playWeaponPickup();
        this.queueOnlineEvent({
          type: "weaponPickup",
          playerId: player.id
        });
        this.destroyWeaponPickup(pickup);
      }
    }
  }

  private updateJudgmentOrbs() {
    if (!this.isJudgmentOrbPhase()) {
      this.clearJudgmentOrbs();
      this.updateJudgmentOrbPips();
      return;
    }

    if (this.time.now >= this.nextJudgmentOrbSpawnAt) {
      if (this.judgmentOrbs.length < JUDGMENT_ORB.maxActive) {
        this.spawnJudgmentOrb();
      }
      this.nextJudgmentOrbSpawnAt = this.time.now + JUDGMENT_ORB.spawnEveryMs;
    }

    for (const player of this.getAlivePlayers()) {
      const orb = this.judgmentOrbs.find((item) => (
        Phaser.Math.Distance.Between(player.x, player.y, item.shape.x, item.shape.y) <= JUDGMENT_ORB.detectRadius
      ));
      if (!orb) {
        continue;
      }

      this.collectJudgmentOrb(player, orb);
      break;
    }

    this.updateJudgmentOrbPips();
  }

  private spawnJudgmentOrb() {
    const id = `judgment-orb-${this.time.now}-${this.judgmentOrbSequence}`;
    this.judgmentOrbSequence += 1;
    const point = this.getBalancedJudgmentOrbPoint();
    const x = point.x;
    const y = point.y;
    const ring = this.add.circle(x, y, JUDGMENT_ORB.radius + 10, 0xffcf33, 0.08);
    ring.setStrokeStyle(3, 0xffcf33, 0.66);
    ring.setDepth(2);
    const shape = this.add.circle(x, y, JUDGMENT_ORB.radius, 0xffcf33, 0.96);
    shape.setStrokeStyle(3, 0xfff0a6, 0.88);
    shape.setDepth(3);

    this.judgmentOrbs.push({ id, shape, ring });
    this.tweens.add({
      targets: ring,
      scale: 1.45,
      alpha: 0.28,
      duration: 540,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });
    this.syncOnlineMatchState(true);
  }

  private getBalancedJudgmentOrbPoint() {
    const alivePlayers = this.getAlivePlayers();
    const rect = this.arenaRect;
    const fallback = new Phaser.Math.Vector2(rect.centerX, rect.centerY);
    if (alivePlayers.length !== 2) {
      return fallback;
    }

    const [first, second] = alivePlayers;
    const between = new Phaser.Math.Vector2(second.x - first.x, second.y - first.y);
    const midpoint = new Phaser.Math.Vector2((first.x + second.x) / 2, (first.y + second.y) / 2);
    const perpendicular = between.lengthSq() > 0
      ? new Phaser.Math.Vector2(-between.y, between.x).normalize()
      : new Phaser.Math.Vector2(0, 1);
    const centerPull = new Phaser.Math.Vector2(rect.centerX - midpoint.x, rect.centerY - midpoint.y).scale(0.36);

    for (let attempt = 0; attempt < 18; attempt += 1) {
      const side = attempt % 2 === 0 ? 1 : -1;
      const offset = Phaser.Math.Between(18, 112) * side;
      const candidate = midpoint.clone()
        .add(centerPull)
        .add(perpendicular.clone().scale(offset));
      candidate.x = Phaser.Math.Clamp(candidate.x, rect.left + 90, rect.right - 90);
      candidate.y = Phaser.Math.Clamp(candidate.y, rect.top + 90, rect.bottom - 90);
      if (!this.arenaPolygon || Phaser.Geom.Polygon.Contains(this.arenaPolygon, candidate.x, candidate.y)) {
        return candidate;
      }
    }

    return fallback;
  }

  private collectJudgmentOrb(player: Player, orb: JudgmentOrb) {
    this.destroyJudgmentOrb(orb);
    const count = Math.min(JUDGMENT_ORB.required, (this.judgmentOrbCounts.get(player.id) ?? 0) + 1);
    this.judgmentOrbCounts.set(player.id, count);
    this.audio.playWeaponPickup();
    this.playJudgmentOrbCollectEffect(player);
    this.updateJudgmentOrbPips();
    this.syncOnlineMatchState(true);

    if (count >= JUDGMENT_ORB.required) {
      const defender = this.getJudgmentDefenderFromOrbRace(player);
      this.clearJudgmentOrbs();
      this.pendingJudgmentDefender = defender;
      this.pendingJudgmentChallenger = player;
      this.judgmentLastAttacker = player;
      this.playJudgmentBellSound();
      this.queueOnlineEvent({
        type: "judgmentOrbComplete",
        collectorId: player.id,
        defenderId: defender.id
      });
    }
  }

  private getJudgmentDefenderFromOrbRace(collector: Player) {
    const alivePlayers = this.getAlivePlayers();
    const lowestScore = Math.min(...alivePlayers.map((player) => this.judgmentOrbCounts.get(player.id) ?? 0));
    return alivePlayers.find((player) => player !== collector && (this.judgmentOrbCounts.get(player.id) ?? 0) === lowestScore)
      ?? alivePlayers.find((player) => player !== collector)
      ?? collector;
  }

  private playJudgmentOrbCollectEffect(player: Player) {
    const ring = this.add.circle(player.x, player.y, PLAYER.radius + 10, 0xffcf33, 0.08);
    ring.setStrokeStyle(3, 0xffcf33, 0.82);
    ring.setDepth(8);
    this.tweens.add({
      targets: ring,
      scale: 1.8,
      alpha: 0,
      duration: 260,
      ease: "Quad.easeOut",
      onComplete: () => ring.destroy()
    });
  }

  private destroyJudgmentOrb(orb: JudgmentOrb) {
    this.tweens.killTweensOf(orb.ring);
    orb.shape.destroy();
    orb.ring.destroy();
    this.judgmentOrbs = this.judgmentOrbs.filter((item) => item !== orb);
  }

  private clearJudgmentOrbs() {
    for (const orb of [...this.judgmentOrbs]) {
      this.destroyJudgmentOrb(orb);
    }
    this.clearOnlineJudgmentOrbVisuals();
  }

  private spawnWeaponPickup() {
    const id = `pickup-${this.time.now}-${this.weaponPickupSequence}`;
    this.weaponPickupSequence += 1;
    let x = Phaser.Math.Between(
      Math.ceil(this.arenaRect.left + 72),
      Math.floor(this.arenaRect.right - 72)
    );
    let y = Phaser.Math.Between(
      Math.ceil(this.arenaRect.top + 72),
      Math.floor(this.arenaRect.bottom - 72)
    );
    if (this.isJudgmentDefensePhase()) {
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const radius = Phaser.Math.Between(18, this.judgmentInnerRadius - 28);
      x = Math.round(this.judgmentCenter.x + Math.cos(angle) * radius);
      y = Math.round(this.judgmentCenter.y + Math.sin(angle) * radius);
    }
    const ring = this.add.circle(x, y, WEAPON.pickupRadius + 8, 0x86f7ff, 0.08);
    ring.setStrokeStyle(2, 0x86f7ff, 0.55);
    ring.setDepth(1);

    const shape = this.add.circle(x, y, WEAPON.pickupRadius, 0x263442, 1);
    shape.setStrokeStyle(3, 0x86f7ff, 0.9);
    shape.setDepth(2);

    this.weaponPickups.push({ id, shape, ring });
    this.tweens.add({
      targets: ring,
      scale: 1.28,
      alpha: 0.22,
      duration: 620,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });
    this.syncOnlineMatchState(true);
  }

  private updateBotWeaponActions() {
    for (const bot of this.players) {
      if (!this.isBotControlledPlayer(bot) || !bot.alive || !bot.hasWeapon || this.bomb.owner === bot) {
        continue;
      }

      const target = this.getNearestOpponent(bot);
      if (!target) {
        continue;
      }

      const readyAt = this.botShotReadyAt.get(bot.id) ?? 0;
      const distance = Phaser.Math.Distance.Between(bot.x, bot.y, target.x, target.y);
      if (this.time.now < readyAt || distance < WEAPON.botShootMinRange || distance > WEAPON.botShootRange) {
        continue;
      }

      const direction = new Phaser.Math.Vector2(target.x - bot.x, target.y - bot.y);
      if (direction.lengthSq() === 0) {
        continue;
      }

      const aimAlignment = bot.aimDirection.dot(direction.clone().normalize());
      if (aimAlignment < WEAPON.botAimDot) {
        continue;
      }

      this.fireWeapon(bot, direction);
      this.botShotReadyAt.set(bot.id, this.time.now + WEAPON.shotCooldownMs);
    }
  }

  private fireWeapon(owner: Player, direction: Phaser.Math.Vector2) {
    if (this.isJudgmentDefensePhase() && owner !== this.judgmentDefender) {
      return false;
    }

    if (!owner.consumeWeapon() || direction.lengthSq() === 0) {
      return false;
    }

    const normalized = direction.normalize();
    const id = `${owner.id}-${this.time.now}-${this.shotSequence}`;
    this.shotSequence += 1;
    const x = owner.x + normalized.x * (PLAYER.radius + 12);
    const y = owner.y + normalized.y * (PLAYER.radius + 12);
    const shape = this.add.rectangle(x, y, 30, 8, owner.color, 0.95);
    shape.setRotation(normalized.angle());
    shape.setStrokeStyle(1, 0xffffff, owner.kind === "human" ? 0.75 : 0.35);
    shape.setDepth(4);

    const spark = this.add.circle(x, y, WEAPON.shotRadius + 5, owner.color, 0.22);
    spark.setDepth(3);

    const shot = {
      id,
      owner,
      shape,
      spark,
      velocity: normalized.scale(WEAPON.shotSpeed),
      expiresAt: this.time.now + WEAPON.shotLifetimeMs
    };
    this.shots.push(shot);
    this.audio.playWeaponShot();
    this.queueOnlineEvent({
      type: "weaponShot",
      ownerId: owner.id,
      shot: this.createOnlineShotState(shot)
    });
    return true;
  }

  private updateShots(deltaSeconds: number) {
    for (const shot of [...this.shots]) {
      shot.shape.x += shot.velocity.x * deltaSeconds;
      shot.shape.y += shot.velocity.y * deltaSeconds;
      shot.spark.setPosition(shot.shape.x, shot.shape.y);
      shot.spark.setAlpha(0.12 + Math.sin(this.time.now * 0.035) * 0.06);

      if (this.time.now >= shot.expiresAt || !this.arenaRect.contains(shot.shape.x, shot.shape.y)) {
        this.destroyShot(shot);
        continue;
      }

      const target = this.getAlivePlayers().find((player) => {
        if (player === shot.owner || player.isInvulnerable) {
          return false;
        }

        return Phaser.Math.Distance.Between(shot.shape.x, shot.shape.y, player.x, player.y) <= PLAYER.radius + WEAPON.shotRadius;
      });

      if (!target) {
        continue;
      }

      const wasEliminated = target.takeShotDamage();
      this.audio.playShotDamage(target === this.human);
      this.playShotImpact(target.x, target.y, shot.owner.color);
      this.queueOnlineEvent({
        type: "shotDamage",
        x: Math.round(target.x),
        y: Math.round(target.y),
        color: shot.owner.color,
        targetId: target.id,
        isHumanTarget: target === this.human
      });
      this.showLifeLostFeedback(target);
      this.destroyShot(shot);

      if (wasEliminated) {
        this.resolveShotElimination(target);
        return;
      }
    }
  }

  private resolveShotElimination(eliminated: Player) {
    this.roundResolving = true;
    eliminated.setBombHolder(false);
    this.bomb.setVisible(false);
    this.clearWeaponsAndShots();
    this.cameras.main.shake(150, 0.006);
    this.playExplosion(eliminated.x, eliminated.y, eliminated.color);
    this.queueOnlineEvent({
      type: "explosion",
      x: Math.round(eliminated.x),
      y: Math.round(eliminated.y),
      color: eliminated.color
    });
    this.currentRoundMessageKey = "";
    this.showRoundMessage(TEXT[this.language].eliminated(this.getPlayerName(eliminated)), "#86f7ff", 1050);

    const alivePlayers = this.getAlivePlayers();
    if (this.isJudgmentDefensePhase() && eliminated === this.judgmentDefender) {
      const challenger = this.judgmentLastAttacker?.alive
        ? this.judgmentLastAttacker
        : alivePlayers[0];
      this.time.delayedCall(1050, () => this.startJudgmentDuel(challenger, eliminated));
      return;
    }

    if (alivePlayers.length <= 1) {
      this.time.delayedCall(1250, () => this.resolveSingleSurvivor(alivePlayers[0]));
      return;
    }

    if (alivePlayers.length === 3 && !this.specialRoundLivesRestored) {
      this.time.delayedCall(260, () => this.playFinalRoundTransition(alivePlayers.length));
      return;
    }

    this.time.delayedCall(this.isFinalPhase() ? 120 : 1250, () => {
      this.startRound(alivePlayers.length);
    });
  }

  private playShotImpact(x: number, y: number, color: number) {
    for (let index = 0; index < 8; index += 1) {
      const angle = (Math.PI * 2 * index) / 8;
      const shard = this.add.rectangle(x, y, 8, 3, color, 0.9);
      shard.setRotation(angle);
      shard.setDepth(6);
      this.tweens.add({
        targets: shard,
        x: x + Math.cos(angle) * 32,
        y: y + Math.sin(angle) * 32,
        alpha: 0,
        duration: 180,
        ease: "Quad.easeOut",
        onComplete: () => shard.destroy()
      });
    }
  }

  private playParryEffect(player: Player, perfect: boolean, x = player.x, y = player.y, active = false) {
    const color = active ? 0xffcf33 : perfect ? 0x86f7ff : 0xff5d4f;
    const accent = active ? 0x86f7ff : perfect ? 0xffcf33 : 0x341820;
    const ring = this.add.circle(x, y, active ? 48 : perfect ? 40 : 34, color, active ? 0.12 : 0.08);
    ring.setStrokeStyle(active ? 3 : perfect ? 4 : 3, color, active ? 0.82 : perfect ? 0.95 : 0.76);
    ring.setDepth(9);
    const slash = this.add.rectangle(x, y, active ? 74 : perfect ? 82 : 58, active ? 5 : perfect ? 8 : 10, accent, active ? 0.72 : perfect ? 0.95 : 0.82);
    slash.setRotation(player.aimDirection.angle());
    slash.setDepth(10);

    this.tweens.add({
      targets: ring,
      scale: active ? 1.75 : perfect ? 2.2 : 1.45,
      alpha: 0,
      duration: active ? BOMB.parryWindowMs + 90 : perfect ? 340 : 250,
      ease: "Quad.easeOut",
      onComplete: () => ring.destroy()
    });
    this.tweens.add({
      targets: slash,
      scaleX: active ? 0.7 : perfect ? 0.45 : 0.24,
      alpha: 0,
      duration: active ? BOMB.parryWindowMs + 40 : perfect ? 230 : 170,
      ease: "Quad.easeOut",
      onComplete: () => slash.destroy()
    });
    this.tweens.killTweensOf(player.body);
    player.body.setScale(1);
    this.tweens.add({
      targets: player.body,
      scaleX: perfect ? 1.35 : 1.18,
      scaleY: perfect ? 1.35 : 0.86,
      duration: 70,
      yoyo: true,
      ease: "Quad.easeOut",
      onComplete: () => player.body.setScale(1)
    });
  }

  private playSpinReadyEffect(player: Player) {
    const ring = this.add.circle(player.x, player.y, PLAYER.radius + 18, 0xffcf33, 0.08);
    ring.setStrokeStyle(3, 0xffcf33, 0.72);
    ring.setDepth(8);
    this.tweens.add({
      targets: ring,
      scale: 1.9,
      alpha: 0,
      duration: 260,
      ease: "Quad.easeOut",
      onComplete: () => ring.destroy()
    });
  }

  private playSpinThrowEffect(player: Player) {
    const direction = player.aimDirection.clone();
    if (direction.lengthSq() === 0) {
      return;
    }

    direction.normalize();
    const burst = this.add.rectangle(
      player.x + direction.x * 26,
      player.y + direction.y * 26,
      84,
      9,
      0xffcf33,
      0.86
    );
    burst.setRotation(direction.angle());
    burst.setDepth(7);
    this.tweens.add({
      targets: burst,
      scaleX: 0.25,
      alpha: 0,
      duration: 170,
      ease: "Quad.easeOut",
      onComplete: () => burst.destroy()
    });
  }

  private showLifeLostFeedback(target: Player, x = target.x, y = target.y) {
    const lastShownAt = this.lastLifeFeedbackAt.get(target.id) ?? -Infinity;
    if (this.time.now - lastShownAt < 220) {
      return;
    }

    this.lastLifeFeedbackAt.set(target.id, this.time.now);
    const text = this.add
      .text(x, y - 54, TEXT[this.language].lifeLost, {
        color: "#ff5d4f",
        fontFamily: "ui-sans-serif, system-ui",
        fontSize: target === this.human ? "24px" : "18px",
        fontStyle: "900",
        stroke: "#0c0f16",
        strokeThickness: 5
      })
      .setOrigin(0.5)
      .setDepth(12);
    const slash = this.add.rectangle(x, y - 28, 46, 5, 0xff5d4f, 0.95);
    slash.setRotation(-0.18);
    slash.setDepth(11);

    this.tweens.add({
      targets: [text, slash],
      y: "-=34",
      alpha: 0,
      duration: 640,
      ease: "Quad.easeOut",
      onComplete: () => {
        text.destroy();
        slash.destroy();
      }
    });
  }

  private clearWeaponsAndShots() {
    for (const pickup of [...this.weaponPickups]) {
      this.destroyWeaponPickup(pickup);
    }

    for (const shot of [...this.shots]) {
      this.destroyShot(shot);
    }
  }

  private destroyWeaponPickup(pickup: WeaponPickup) {
    this.tweens.killTweensOf(pickup.ring);
    pickup.shape.destroy();
    pickup.ring.destroy();
    this.weaponPickups = this.weaponPickups.filter((item) => item !== pickup);
    this.syncOnlineMatchState(true);
  }

  private destroyShot(shot: Shot) {
    shot.shape.destroy();
    shot.spark.destroy();
    this.shots = this.shots.filter((item) => item !== shot);
  }

  private updateBotThrows() {
    if (this.bomb.state !== "HELD" || !this.isBotControlledPlayer(this.bomb.owner)) {
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
      this.launchBomb(owner.aimDirection.clone());
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
        if (
          this.isJudgmentDefensePhase() &&
          player === this.judgmentDefender &&
          previousOwner !== player &&
          previousOwner.alive
        ) {
          this.judgmentLastAttacker = previousOwner;
        }
        if (this.isFinalPhase() && !this.isJudgmentDefensePhase()) {
          const bonusSeconds = this.getAlivePlayers().length <= 2 ? 1 : 0.5;
          this.roundEndsAt += bonusSeconds * 1000;
          this.roundTimerSeconds += bonusSeconds;
        }
        this.bomb.playTransferBurst(bombState === "RETURNING" || ricochets > 0 || remainingSeconds < 1);
        const hitContext = {
          nextOwner: player,
          previousOwner,
          bombState,
          ricochets,
          remainingSeconds,
          human: this.human
        };
        const variant = this.audio.getHitVariant(hitContext);
        this.queueOnlineEvent({
          type: "bombHit",
          x: Math.round(player.x),
          y: Math.round(player.y),
          color: player.color,
          variant,
          isSpecial: bombState === "RETURNING" || ricochets > 0 || remainingSeconds < 1,
          nextOwnerId: player.id
        });
        this.audio.playHit({
          ...hitContext
        });
        break;
      }
    }
  }

  private transferBomb(nextOwner: Player) {
    for (const player of this.players) {
      player.setBombHolder(player === nextOwner);
    }

    this.clearHomingIndicator();
    this.bomb.setOwner(nextOwner);
  }

  private resolveSpecialCatchMiss() {
    if (!this.isFinalPhase() || this.bomb.state !== "RETURNING") {
      return;
    }

    const owner = this.bomb.owner;
    if (!owner.alive || !owner.isDashing) {
      return;
    }

    const distance = Phaser.Math.Distance.Between(this.bomb.x, this.bomb.y, owner.x, owner.y);
    if (distance > BOMB.specialMissCatchDistance) {
      return;
    }

    const wasEliminated = owner.takeShotDamage(true);
    this.audio.playShotDamage(owner === this.human);
    this.playShotImpact(owner.x, owner.y, 0xffcf33);
    this.queueOnlineEvent({
      type: "shotDamage",
      x: Math.round(owner.x),
      y: Math.round(owner.y),
      color: 0xffcf33,
      targetId: owner.id,
      isHumanTarget: owner === this.human
    });
    this.showLifeLostFeedback(owner);

    if (wasEliminated) {
      this.resolveShotElimination(owner);
      return;
    }

    this.bomb.setOwner(owner);
  }

  private showHomingIndicator(target: Player) {
    if (!this.homingIndicator) {
      const graphics = this.add.graphics();
      graphics.setDepth(7);
      this.homingIndicator = {
        target,
        graphics,
        expiresAt: 0
      };
    }

    this.homingIndicator.target = target;
    this.homingIndicator.expiresAt = this.time.now + 900;
    this.homingIndicator.graphics.setAlpha(1);
    this.homingIndicator.graphics.setVisible(true);
    this.tweens.killTweensOf(this.homingIndicator.graphics);
    this.tweens.add({
      targets: this.homingIndicator.graphics,
      alpha: 0,
      delay: 620,
      duration: 280,
      ease: "Quad.easeIn"
    });
  }

  private updateHomingIndicator() {
    const indicator = this.homingIndicator;
    if (!indicator) {
      return;
    }

    const { graphics, target } = indicator;
    graphics.clear();

    if (this.time.now >= indicator.expiresAt || !target.alive || this.bomb.state === "HELD") {
      graphics.setVisible(false);
      return;
    }

    const progress = 1 - (indicator.expiresAt - this.time.now) / 900;
    const pulse = Math.sin(progress * Math.PI * 5);
    const radius = PLAYER.radius + 14 + pulse * 3;
    const color = target === this.human ? 0xff5d4f : 0xffcf33;

    graphics.lineStyle(3, color, 0.85);
    graphics.strokeCircle(target.x, target.y, radius);
    graphics.lineStyle(1, 0xffffff, 0.75);
    graphics.strokeCircle(target.x, target.y, radius + 7);

    const markerLength = 9;
    graphics.lineStyle(3, color, 0.9);
    graphics.lineBetween(target.x - radius - markerLength, target.y, target.x - radius + 2, target.y);
    graphics.lineBetween(target.x + radius - 2, target.y, target.x + radius + markerLength, target.y);
    graphics.lineBetween(target.x, target.y - radius - markerLength, target.x, target.y - radius + 2);
    graphics.lineBetween(target.x, target.y + radius - 2, target.x, target.y + radius + markerLength);
  }

  private clearHomingIndicator() {
    if (!this.homingIndicator) {
      return;
    }

    this.homingIndicator.graphics.clear();
    this.homingIndicator.graphics.setVisible(false);
  }

  private isFinalPhase() {
    return this.specialRoundLivesRestored || this.getAlivePlayers().length <= 3;
  }

  private isJudgmentDefensePhase() {
    return this.judgmentPhase && !this.judgmentDuelPhase;
  }

  private isJudgmentOrbPhase() {
    return this.isJudgmentOrbDisplayPhase() &&
      !this.roundResolving &&
      !this.hasCompletedJudgmentOrbRace();
  }

  private isJudgmentOrbDisplayPhase() {
    return this.specialRoundLivesRestored &&
      !this.judgmentPhase &&
      this.getAlivePlayers().length === 2 &&
      !this.matchOver;
  }

  private hasCompletedJudgmentOrbRace() {
    return !!this.pendingJudgmentDefender ||
      Array.from(this.judgmentOrbCounts.values()).some((count) => count >= JUDGMENT_ORB.required);
  }

  private resolveCountdown() {
    const remainingMs = this.roundEndsAt - this.time.now;
    if (remainingMs > 0 || this.roundResolving) {
      return;
    }

    if (this.pendingJudgmentDefender) {
      this.roundResolving = true;
      this.clearWeaponsAndShots();
      this.clearHomingIndicator();
      this.bomb.setVisible(false);
      this.playJudgmentTransition(this.pendingJudgmentDefender, true, this.pendingJudgmentChallenger);
      return;
    }

    const eliminated = this.bomb.responsible;
    const explosionX = eliminated.x;
    const explosionY = eliminated.y;
    eliminated.setEliminated();
    eliminated.setBombHolder(false);
    this.bomb.setVisible(false);
    this.clearWeaponsAndShots();
    this.roundResolving = true;
    this.cameras.main.shake(180, 0.008);
    this.playExplosion(explosionX, explosionY, eliminated.color);
    this.queueOnlineEvent({
      type: "explosion",
      x: Math.round(explosionX),
      y: Math.round(explosionY),
      color: eliminated.color
    });
    this.currentRoundMessageKey = "";
    this.showRoundMessage(TEXT[this.language].eliminated(this.getPlayerName(eliminated)), "#ff5d4f", 1100);

    const alivePlayers = this.getAlivePlayers();
    if (this.isJudgmentDefensePhase()) {
      if (eliminated === this.judgmentDefender) {
        const challenger = this.judgmentLastAttacker?.alive
          ? this.judgmentLastAttacker
          : alivePlayers[0];
        this.time.delayedCall(1200, () => this.startJudgmentDuel(challenger, eliminated));
        return;
      }

      const defender = this.judgmentDefender;
      if (defender?.alive) {
        this.time.delayedCall(1200, () => this.endMatch(defender));
      }
      return;
    }

    if (alivePlayers.length <= 1) {
      this.time.delayedCall(1300, () => this.resolveSingleSurvivor(alivePlayers[0]));
      return;
    }

    if (alivePlayers.length === 3 && !this.specialRoundLivesRestored) {
      this.time.delayedCall(320, () => this.playFinalRoundTransition(alivePlayers.length));
      return;
    }

    this.time.delayedCall(this.isFinalPhase() ? 120 : 1350, () => {
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
    this.hudLivesLabel.setText(`${dictionary.lives}:`);
    this.hudDashLabel.setText(dictionary.dash);
    this.helpText.setText(dictionary.controls);
    this.languageLabel.setText(dictionary.language);
    this.updateHumanLivesHud();
    this.updateScoreboard();
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
    const isJudgmentDefense = this.isJudgmentDefensePhase();
    const stage = this.getRoundStage(isJudgmentDefense ? 2 : alivePlayers.length);
    const nextOwner = Phaser.Utils.Array.GetRandom(alivePlayers);
    const isSpecialRound = alivePlayers.length === 3;
    const shouldRestoreSpecialLives = isSpecialRound && !this.specialRoundLivesRestored;
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
    this.nextWeaponSpawnAt = this.time.now + (this.isFinalPhase() ? WEAPON.specialFirstSpawnDelayMs : WEAPON.firstSpawnDelayMs);
    this.nextCriticalPulseAt = 0;
    this.dangerOverlay.setAlpha(0);
    this.hudTimer.setScale(1);
    this.audio.resetTimerTicks();
    this.clearWeaponsAndShots();
    this.clearJudgmentOrbs();
    this.botParryThinkAt.clear();
    this.parryReadyAt.clear();
    this.parryActiveUntil.clear();
    this.spinThrowTrackers.clear();
    this.baseBombSpeedMultiplier = stage.bombSpeedMultiplier;
    this.specialBombSpeedBonus = 0;
    if (alivePlayers.length === 2 && !this.judgmentPhase) {
      this.judgmentOrbCounts.clear();
      this.pendingJudgmentDefender = undefined;
      this.pendingJudgmentChallenger = undefined;
      this.nextJudgmentOrbSpawnAt = this.time.now + JUDGMENT_ORB.firstSpawnDelayMs;
    }
    this.createArena(alivePlayers.length);
    for (const player of alivePlayers) {
      player.configureDash(
        this.isFinalPhase() ? PLAYER.specialDashCharges : PLAYER.normalDashCharges,
        this.isFinalPhase()
      );
      player.resetDashCharges();
      if (shouldRestoreSpecialLives) {
        player.restoreLives();
      }
      player.clearWeapon();
      this.keepPlayerInActiveArena(player);
    }
    if (isSpecialRound) {
      this.specialRoundLivesRestored = true;
    }
    this.bomb.setIntensity(this.baseBombSpeedMultiplier);
    this.transferBomb(nextOwner);
    this.updateHud(true);
    this.cameras.main.flash(shouldRestoreSpecialLives ? 180 : 120, 255, alivePlayers.length <= 2 ? 95 : 210, 64, false);
    if (!shouldRestoreSpecialLives) {
      this.showRoundMessage(roundMessage, alivePlayers.length <= 3 ? "#ffcf33" : "#f7f8ff", isSpecialRound ? 1700 : 1000);
    }
  }

  private playFinalRoundTransition(aliveCount: number, shouldQueueOnlineEvent = true) {
    const dictionary = TEXT[this.language];
    this.startFinalBattleMusic();
    if (shouldQueueOnlineEvent) {
      this.queueOnlineEvent({
        type: "finalTransition",
        aliveCount
      });
    }
    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 1);
    overlay.setDepth(30);
    overlay.setAlpha(0);
    const title = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 128, dictionary.finalCutsceneTitle, {
      color: "#ffcf33",
      fontFamily: "ui-sans-serif, system-ui",
      fontSize: "64px",
      fontStyle: "900",
      stroke: "#0c0f16",
      strokeThickness: 8
    });
    title.setOrigin(0.5);
    title.setDepth(31);
    title.setAlpha(0);
    title.setScale(0.86);

    const ruleCards = dictionary.finalCutsceneRules.map((rule, index) => {
      const accentColor = index % 2 === 0 ? 0xffcf33 : 0x86f7ff;
      const panel = this.add.rectangle(0, 0, 640, 78, 0x111520, 0.92);
      panel.setStrokeStyle(2, accentColor, 0.72);
      const glow = this.add.rectangle(0, 0, 660, 96, accentColor, 0.08);
      const label = this.add.text(0, 0, rule.toUpperCase(), {
        align: "center",
        color: "#f7f8ff",
        fontFamily: "ui-sans-serif, system-ui",
        fontSize: "24px",
        fontStyle: "900",
        lineSpacing: 2,
        stroke: "#0c0f16",
        strokeThickness: 3,
        wordWrap: { width: 560 }
      });
      label.setOrigin(0.5);
      const card = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 6, [glow, panel, label]);
      card.setDepth(31);
      card.setAlpha(0);
      card.setScale(0.72 + index * 0.04);
      const showDelay = 560 + index * 500;
      const targetScale = 1.02 + index * 0.08;
      this.tweens.add({
        targets: card,
        alpha: 1,
        scale: targetScale,
        delay: showDelay,
        duration: 180,
        ease: "Back.easeOut"
      });
      this.tweens.add({
        targets: card,
        scale: targetScale + 0.1,
        delay: showDelay + 180,
        duration: 250,
        ease: "Sine.easeOut"
      });
      this.tweens.add({
        targets: card,
        alpha: 0,
        scale: targetScale + 0.14,
        delay: showDelay + 430,
        duration: 160,
        ease: "Quad.easeIn"
      });
      return card;
    });

    const startText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 138, "3", {
      color: "#86f7ff",
      fontFamily: "ui-sans-serif, system-ui",
      fontSize: "54px",
      fontStyle: "900",
      stroke: "#0c0f16",
      strokeThickness: 7
    });
    startText.setOrigin(0.5);
    startText.setDepth(31);
    startText.setAlpha(0);

    this.tweens.add({
      targets: overlay,
      alpha: 1,
      duration: 220,
      ease: "Quad.easeOut"
    });
    this.tweens.add({
      targets: title,
      alpha: 1,
      scale: 1,
      delay: 240,
      duration: 360,
      ease: "Back.easeOut"
    });
    for (let index = 0; index < 3; index += 1) {
      this.time.delayedCall(index * 1000, () => {
        startText.setText(String(3 - index));
        startText.setScale(0.7);
        startText.setAlpha(1);
        this.tweens.add({
          targets: startText,
          scale: 1.15,
          duration: 220,
          yoyo: true,
          ease: "Back.easeOut"
        });
      });
    }

    this.tweens.add({
      targets: [overlay, title, ...ruleCards, startText],
      alpha: 0,
      delay: 2750,
      duration: 250,
      ease: "Quad.easeIn",
      onComplete: () => {
        overlay.destroy();
        title.destroy();
        ruleCards.forEach((card) => card.destroy());
        startText.destroy();
        this.startRound(aliveCount);
        if (aliveCount === 3) {
          this.currentRoundMessageKey = "livesRestored";
          this.showRoundMessage(TEXT[this.language].livesRestored, "#ffcf33", 1600);
        }
      }
    });
  }

  private resolveSingleSurvivor(winner?: Player) {
    if (!winner) {
      return;
    }

    this.endMatch(winner);
  }

  private playJudgmentTransition(defender: Player, shouldQueueOnlineEvent = true, challenger?: Player) {
    this.roundResolving = true;
    this.clearWeaponsAndShots();
    this.clearHomingIndicator();
    this.bomb.setVisible(false);
    this.playJudgmentBellSound();
    this.startJudgmentMusic();
    if (shouldQueueOnlineEvent) {
      this.queueOnlineEvent({
        type: "judgmentTransition",
        defenderId: defender.id,
        challengerId: challenger?.id
      });
    }

    const dictionary = TEXT[this.language];
    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 1);
    overlay.setDepth(32);

    const title = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 56, dictionary.judgment, {
      color: "#ffcf33",
      fontFamily: "Arial Black, ui-sans-serif, system-ui",
      fontSize: "58px",
      fontStyle: "900",
      stroke: "#5b1515",
      strokeThickness: 8
    });
    title.setOrigin(0.5);
    title.setDepth(33);
    title.setAlpha(0);
    title.setScale(0.72);

    const subtitle = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 42, dictionary.judgmentDefense, {
      color: "#f7f8ff",
      fontFamily: "Arial Black, ui-sans-serif, system-ui",
      fontSize: "36px",
      fontStyle: "900",
      stroke: "#0c0f16",
      strokeThickness: 6
    });
    subtitle.setOrigin(0.5);
    subtitle.setDepth(33);
    subtitle.setAlpha(0);
    subtitle.setScale(0.76);

    const ring = this.add.circle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 118, 0xffcf33, 0);
    ring.setStrokeStyle(6, 0xffcf33, 0.82);
    ring.setDepth(33);
    ring.setAlpha(0);

    this.tweens.add({
      targets: title,
      alpha: 1,
      scale: 1,
      duration: 620,
      ease: "Back.easeOut"
    });
    this.tweens.add({
      targets: ring,
      alpha: 0.7,
      scale: 2.35,
      duration: 1100,
      ease: "Quad.easeOut"
    });
    this.tweens.add({
      targets: subtitle,
      alpha: 1,
      scale: 1,
      delay: 1550,
      duration: 680,
      ease: "Back.easeOut"
    });
    this.tweens.add({
      targets: overlay,
      alpha: 0,
      delay: 4480,
      duration: 520,
      ease: "Quad.easeIn",
      onComplete: () => {
        overlay.destroy();
        title.destroy();
        subtitle.destroy();
        ring.destroy();
        this.startJudgmentRound(defender, challenger);
      }
    });
  }

  private startJudgmentRound(defender: Player, initialAttacker?: Player) {
    this.judgmentPhase = true;
    this.judgmentDuelPhase = false;
    this.judgmentDefender = defender;
    this.judgmentLastAttacker = initialAttacker;
    this.roundResolving = false;
    this.matchOver = false;
    this.specialRoundLivesRestored = true;
    this.roundTimerSeconds = 30;
    this.roundEndsAt = this.time.now + this.roundTimerSeconds * 1000;
    this.nextWeaponSpawnAt = this.time.now + WEAPON.specialFirstSpawnDelayMs;
    this.nextCriticalPulseAt = 0;
    this.clearWeaponsAndShots();
    this.clearJudgmentOrbs();
    this.judgmentOrbCounts.clear();
    this.pendingJudgmentDefender = undefined;
    this.pendingJudgmentChallenger = undefined;
    this.parryReadyAt.clear();
    this.parryActiveUntil.clear();
    this.botParryThinkAt.clear();
    this.spinThrowTrackers.clear();
    this.baseBombSpeedMultiplier = this.getRoundStage(2).bombSpeedMultiplier;
    this.specialBombSpeedBonus = 0;
    this.createArena(2);

    defender.reviveAt(this.judgmentCenter.x, this.judgmentCenter.y);
    defender.configureDash(PLAYER.specialDashCharges, true);
    defender.resetDashCharges();

    const attackers = this.players.filter((player) => player !== defender);
    attackers.forEach((player, index) => {
      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(attackers.length, 1);
      const radius = this.judgmentInnerRadius + 142;
      player.reviveAt(
        this.judgmentCenter.x + Math.cos(angle) * radius,
        this.judgmentCenter.y + Math.sin(angle) * radius
      );
      player.configureDash(PLAYER.specialDashCharges, true);
      player.resetDashCharges();
    });

    const nextOwner = Phaser.Utils.Array.GetRandom(attackers);
    if (!nextOwner) {
      this.endMatch(defender);
      return;
    }

    this.bomb.setIntensity(this.baseBombSpeedMultiplier);
    this.transferBomb(nextOwner);
    this.currentRoundMessageKey = "judgmentDefense";
    this.updateHud(true);
    this.cameras.main.flash(220, 255, 207, 51, false);
    this.showRoundMessage(TEXT[this.language].judgmentDefense, "#ffcf33", 1900);
    this.time.delayedCall(620, () => {
      if (this.isJudgmentDefensePhase() && this.bomb.state === "HELD" && this.bomb.owner === nextOwner) {
        this.launchBomb(new Phaser.Math.Vector2(defender.x - nextOwner.x, defender.y - nextOwner.y));
      }
    });
  }

  private startJudgmentDuel(challenger?: Player, defender?: Player) {
    const duelDefender = defender ?? this.judgmentDefender;
    const duelChallenger = challenger;
    if (!duelDefender || !duelChallenger) {
      this.endMatch(this.judgmentDefender ?? this.human);
      return;
    }

    this.judgmentDuelPhase = true;
    this.startFinalBattleMusic();
    this.clearWeaponsAndShots();
    this.players.forEach((player) => {
      if (player !== duelDefender && player !== duelChallenger) {
        player.setEliminated();
        player.setBombHolder(false);
      }
    });

    duelDefender.reviveAt(this.arenaRect.centerX - 170, this.arenaRect.centerY);
    duelChallenger.reviveAt(this.arenaRect.centerX + 170, this.arenaRect.centerY);
    this.currentRoundMessageKey = "finalDuel";
    this.startRound(TEXT[this.language].finalDuel);
  }

  private endMatch(winner: Player) {
    this.matchOver = true;
    this.roundResolving = true;
    this.winner = winner;
    this.currentRoundMessageKey = "matchOver";
    this.bomb.setVisible(false);
    this.clearJudgmentOrbs();
    this.pendingJudgmentDefender = undefined;
    this.pendingJudgmentChallenger = undefined;
    this.showRoundMessage(TEXT[this.language].wins(this.getPlayerName(winner)), "#ffcf33", 999999);
  }

  private showRoundMessage(message: string, color: string, duration: number) {
    this.queueOnlineEvent({
      type: "roundMessage",
      message,
      color,
      duration,
      key: this.currentRoundMessageKey
    });

    const lines = message.split("\n").length;
    const isSpecialMessage = this.currentRoundMessageKey === "threePlayers" ||
      this.currentRoundMessageKey === "livesRestored" ||
      this.currentRoundMessageKey === "judgmentDefense";
    this.roundMessagePanel.setSize(
      isSpecialMessage ? 860 : lines > 1 ? 760 : 620,
      isSpecialMessage ? 190 : lines > 1 ? 154 : 118
    );
    this.roundMessagePanel.setAlpha(isSpecialMessage ? 0.92 : 0.82);
    this.roundMessagePanel.setStrokeStyle(isSpecialMessage ? 4 : 2, isSpecialMessage ? 0xffcf33 : 0xffffff, isSpecialMessage ? 0.68 : 0.12);
    this.roundMessagePanel.setVisible(true);
    this.roundMessage.setText(message);
    this.roundMessage.setColor(color);
    this.roundMessage.setAlpha(1);
    this.roundMessage.setFontSize(isSpecialMessage ? 50 : 42);
    this.roundMessage.setScale(isSpecialMessage ? 0.78 : 0.92);
    this.roundMessage.setVisible(true);
    this.tweens.killTweensOf(this.roundMessage);
    this.tweens.killTweensOf(this.roundMessagePanel);
    this.tweens.add({
      targets: [this.roundMessage, this.roundMessagePanel],
      scale: 1,
      duration: isSpecialMessage ? 220 : 120,
      ease: "Back.easeOut"
    });
    if (isSpecialMessage) {
      this.cameras.main.flash(180, 255, 207, 51, false);
      this.tweens.add({
        targets: this.roundMessage,
        scale: 1.08,
        delay: 260,
        duration: 180,
        yoyo: true,
        ease: "Sine.easeInOut"
      });
    }

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
    if (this.isJudgmentDefensePhase()) return dictionary.judgment;
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
    const width = ARENA.width * (aliveCount <= 2 ? 0.68 : aliveCount <= 3 ? 0.86 : aliveCount <= 4 ? 0.92 : 1);
    const height = ARENA.height * (aliveCount <= 2 ? 0.8 : aliveCount <= 3 ? 0.82 : aliveCount <= 4 ? 0.92 : 1);
    const x = ARENA.x + (ARENA.width - width) / 2;
    const y = ARENA.y + (ARENA.height - height) / 2;

    return new Phaser.Geom.Rectangle(x, y, width, height);
  }

  private getArenaOctagonPoints(rect: Phaser.Geom.Rectangle) {
    const cutX = rect.width * 0.16;
    const cutY = rect.height * 0.18;

    return [
      new Phaser.Geom.Point(rect.left + cutX, rect.top),
      new Phaser.Geom.Point(rect.right - cutX, rect.top),
      new Phaser.Geom.Point(rect.right, rect.top + cutY),
      new Phaser.Geom.Point(rect.right, rect.bottom - cutY),
      new Phaser.Geom.Point(rect.right - cutX, rect.bottom),
      new Phaser.Geom.Point(rect.left + cutX, rect.bottom),
      new Phaser.Geom.Point(rect.left, rect.bottom - cutY),
      new Phaser.Geom.Point(rect.left, rect.top + cutY)
    ];
  }

  private keepPlayerInActiveArena(player: Player) {
    if (this.isJudgmentDefensePhase()) {
      this.keepPlayerInJudgmentArena(player);
      return;
    }

    player.keepInside(this.arenaRect);
    if (this.arenaPolygon) {
      player.keepInsidePolygon(this.arenaPolygon, this.arenaPolygonCenter);
    }
  }

  private keepPlayerInJudgmentArena(player: Player) {
    const toPlayer = new Phaser.Math.Vector2(player.x - this.judgmentCenter.x, player.y - this.judgmentCenter.y);
    const distance = toPlayer.length();
    const isDefender = player === this.judgmentDefender;
    const maxRadius = (isDefender ? this.judgmentInnerRadius - 12 : this.judgmentOuterRadius) - PLAYER.radius;
    const minRadius = isDefender ? 0 : this.judgmentInnerRadius + PLAYER.radius + 22;

    if (distance === 0) {
      toPlayer.set(1, 0);
    } else {
      toPlayer.normalize();
    }

    const clampedDistance = Phaser.Math.Clamp(distance, minRadius, maxRadius);
    if (Math.abs(clampedDistance - distance) <= 0.5) {
      return;
    }

    player.container.setPosition(
      this.judgmentCenter.x + toPlayer.x * clampedDistance,
      this.judgmentCenter.y + toPlayer.y * clampedDistance
    );
    player.velocity.scale(-0.2);
  }

  private resolveJudgmentBombBounds() {
    if (!this.judgmentPhase || this.judgmentDuelPhase || this.bomb.state === "HELD") {
      return;
    }

    const toBomb = new Phaser.Math.Vector2(this.bomb.x - this.judgmentCenter.x, this.bomb.y - this.judgmentCenter.y);
    const distance = toBomb.length();
    const maxRadius = this.judgmentOuterRadius - BOMB.radius;
    if (distance <= maxRadius) {
      return;
    }

    if (distance === 0) {
      toBomb.set(1, 0);
    } else {
      toBomb.normalize();
    }

    this.bomb.shape.setPosition(
      this.judgmentCenter.x + toBomb.x * maxRadius,
      this.judgmentCenter.y + toBomb.y * maxRadius
    );
    this.bomb.fuse.setPosition(this.bomb.x, this.bomb.y);
    this.bomb.directionRing.setPosition(this.bomb.x, this.bomb.y);

    const dot = this.bomb.velocity.dot(toBomb);
    if (dot > 0) {
      this.bomb.velocity.subtract(toBomb.scale(2 * dot));
    }
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

    for (let index = 0; index < PLAYER.normalDashCharges; index += 1) {
      const x = startX + index * 48;
      const slot = this.add.rectangle(x, y, 34, 14, 0x222733, 1);
      slot.setStrokeStyle(2, 0x8defff, 0.45);

      const fill = this.add.rectangle(x, y, 26, 8, 0x8defff, 1);
      fill.setAlpha(0.95);

      this.dashSlots.push(slot);
      this.dashSlotFills.push(fill);
    }
  }

  private createHumanLivesHud() {
    const startX = ARENA.x + 765;
    const y = 37;

    for (let index = 0; index < PLAYER.maxLives; index += 1) {
      const pip = this.add.circle(startX + index * 24, y, 9, 0xff5d4f, 1);
      pip.setStrokeStyle(2, 0xffffff, 0.62);
      pip.setDepth(5);
      this.humanLifeHudPips.push(pip);
    }
  }

  private createScoreboard() {
    const panelX = ARENA.x + ARENA.width - 88;
    const rowX = ARENA.x + ARENA.width - 151;
    this.scoreboardPanel = this.add.rectangle(panelX, ARENA.y + 98, 150, 184, 0x0c0f16, 0.76);
    this.scoreboardPanel.setStrokeStyle(2, 0xffffff, 0.1);
    this.scoreboardPanel.setDepth(4);

    this.scoreboardTitle = this.add.text(rowX, ARENA.y + 18, "", {
      color: "#f7f8ff",
      fontFamily: "ui-sans-serif, system-ui",
      fontSize: "13px",
      fontStyle: "900"
    });
    this.scoreboardTitle.setDepth(5);

    for (let index = 0; index < BOT.count + 1; index += 1) {
      const y = ARENA.y + 43 + index * 19;
      const marker = this.add.rectangle(0, 0, 8, 8, 0xffffff, 1);
      const name = this.add.text(13, -7, "", {
        color: "#f7f8ff",
        fontFamily: "ui-sans-serif, system-ui",
        fontSize: "11px",
        fontStyle: "800"
      });
      const lives = Array.from({ length: PLAYER.maxLives }, (_, lifeIndex) => {
        const pip = this.add.circle(78 + lifeIndex * 11, 0, 4, 0xff5d4f, 1);
        pip.setStrokeStyle(1, 0xffffff, 0.35);
        return pip;
      });
      const status = this.add.text(116, -7, "", {
        color: "#86f7ff",
        fontFamily: "ui-sans-serif, system-ui",
        fontSize: "11px",
        fontStyle: "900"
      });
      const container = this.add.container(rowX, y, [marker, name, ...lives, status]);
      container.setDepth(5);
      this.scoreboardRows.push({ container, marker, name, lives, status });
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

  private createSkipButton() {
    const background = this.add.rectangle(0, 0, 54, 34, 0x241719, 0.95);
    background.setStrokeStyle(2, 0xffcf33, 0.46);

    this.skipButtonLabel = this.add.text(0, -8, TEXT[this.language].skipToFour, {
      color: "#ffcf33",
      fontFamily: "ui-sans-serif, system-ui",
      fontSize: "14px",
      fontStyle: "900"
    });
    this.skipButtonLabel.setOrigin(0.5, 0);

    this.skipButton = this.add.container(GAME_WIDTH - 140, 34, [background, this.skipButtonLabel]);
    this.skipButton.setDepth(20);
    this.skipButton.setSize(54, 34);
    this.skipButton.setInteractive({ useHandCursor: true });
    this.skipButton.on("pointerdown", () => this.skipToFourPlayers());
  }

  private toggleLanguage() {
    this.language = this.language === "en" ? "pt" : "en";
    this.settings.language = this.language;
    saveSettings(this.settings);
    this.human.label.setText(this.settings.playerName);
    this.lastOwnerText = "";
    this.lastPlayersText = "";
    this.lastStageText = "";
    this.lastDashReady = -1;
    this.lastDashSlots = -1;
    this.skipButtonLabel?.setText(TEXT[this.language].skipToFour);
    this.updateHud(true);

    if (this.roundMessage.visible && this.currentRoundMessageKey) {
      this.roundMessage.setText(this.getTranslatedActiveMessage());
    }
  }

  private skipToFourPlayers() {
    if (this.matchOver || this.getAlivePlayers().length <= 4) {
      return;
    }

    const removableBots = this.players.filter((player) => player.kind === "bot" && player.alive);
    while (this.getAlivePlayers().length > 4 && removableBots.length > 0) {
      const bot = removableBots.pop();
      bot?.setEliminated();
      bot?.setBombHolder(false);
    }

    this.roundResolving = false;
    this.currentRoundMessageKey = "";
    this.clearWeaponsAndShots();
    this.bomb.setVisible(false);
    this.startRound(this.getAlivePlayers().length);
  }

  private getTranslatedActiveMessage() {
    const aliveCount = this.getAlivePlayers().length;

    if (this.currentRoundMessageKey === "matchOver" && this.winner) {
      return TEXT[this.language].wins(this.getPlayerName(this.winner));
    }

    if (this.currentRoundMessageKey === "threePlayers") {
      return TEXT[this.language].threePlayers;
    }

    if (this.currentRoundMessageKey === "livesRestored") {
      return TEXT[this.language].livesRestored;
    }

    if (this.currentRoundMessageKey === "finalDuel") {
      return TEXT[this.language].finalDuel;
    }

    if (this.currentRoundMessageKey === "judgmentDefense") {
      return TEXT[this.language].judgmentDefense;
    }

    if (this.currentRoundMessageKey === "playersRemain") {
      return TEXT[this.language].playersRemain(aliveCount);
    }

    return this.roundMessage.text;
  }

  private getPlayerName(player: Player) {
    return player === this.human ? this.settings.playerName : player.name;
  }

  private updateDashHud() {
    const ready = this.human.dashChargeCount;
    const slots = this.human.dashSlotCount;
    if (ready === this.lastDashReady && slots === this.lastDashSlots) {
      return;
    }

    this.lastDashReady = ready;
    this.lastDashSlots = slots;
    for (let index = 0; index < this.dashSlotFills.length; index += 1) {
      const isActive = index < slots;
      const isReady = index < ready;
      this.dashSlots[index].setVisible(isActive);
      this.dashSlotFills[index].setVisible(isActive);
      if (!isActive) {
        continue;
      }
      this.dashSlotFills[index].setAlpha(isReady ? 0.95 : 0.16);
      this.dashSlotFills[index].setFillStyle(isReady ? 0x8defff : 0x56606f, 1);
      this.dashSlots[index].setStrokeStyle(2, isReady ? 0x8defff : 0x56606f, isReady ? 0.72 : 0.35);
    }
  }

  private updateJudgmentOrbPips() {
    const isVisible = this.isJudgmentOrbDisplayPhase();
    for (const player of this.players) {
      const pips = this.judgmentOrbPips.get(player.id);
      if (!pips) {
        continue;
      }

      const count = this.judgmentOrbCounts.get(player.id) ?? 0;
      for (let index = 0; index < pips.length; index += 1) {
        const pip = pips[index];
        const isFilled = index < count;
        pip.setVisible(isVisible && player.alive);
        pip.setFillStyle(isFilled ? 0xffcf33 : 0x2a2f3a, isFilled ? 1 : 0.55);
        pip.setStrokeStyle(1, isFilled ? 0xfff0a6 : 0x6d7583, isFilled ? 0.92 : 0.35);
        pip.setAlpha(isFilled ? 1 : 0.48);
        pip.setScale(isFilled ? 1.18 : 1);
      }
    }
  }

  private updateHumanLivesHud() {
    const isVisible = this.isFinalPhase();
    this.hudLivesLabel.setVisible(isVisible);
    for (let index = 0; index < this.humanLifeHudPips.length; index += 1) {
      this.humanLifeHudPips[index].setVisible(isVisible);
      if (!isVisible) {
        continue;
      }
      const isActive = index < this.human.lives && this.human.alive;
      const color = isActive ? (this.human.lives <= 1 ? 0xffcf33 : 0xff5d4f) : 0x303643;
      this.humanLifeHudPips[index].setFillStyle(color, isActive ? 1 : 0.85);
      this.humanLifeHudPips[index].setAlpha(isActive ? 1 : 0.34);
      this.humanLifeHudPips[index].setScale(isActive && this.human.lives <= 1 ? 1.15 : 1);
      this.humanLifeHudPips[index].setStrokeStyle(2, isActive ? 0xffffff : 0x56606f, isActive ? 0.68 : 0.3);
    }
  }

  private updateScoreboard() {
    const alivePlayers = this.getAlivePlayers();
    const dictionary = TEXT[this.language];
    const isVisible = this.isFinalPhase();
    this.scoreboardPanel.setVisible(isVisible);
    this.scoreboardTitle.setVisible(isVisible);
    this.scoreboardTitle.setText(dictionary.lives);

    for (let index = 0; index < this.scoreboardRows.length; index += 1) {
      const row = this.scoreboardRows[index];
      const player = alivePlayers[index];

      if (!isVisible || !player) {
        row.container.setVisible(false);
        continue;
      }

      row.container.setVisible(true);
      row.marker.setFillStyle(player.color, 1);
      row.marker.setScale(player === this.human ? 1.25 : 1);
      row.name.setText(this.getPlayerName(player));
      row.name.setColor(player === this.human ? "#ffffff" : "#cfd5e5");

      for (let lifeIndex = 0; lifeIndex < row.lives.length; lifeIndex += 1) {
        const isActive = lifeIndex < player.lives;
        row.lives[lifeIndex].setFillStyle(isActive ? 0xff5d4f : 0x303643, isActive ? 1 : 0.85);
        row.lives[lifeIndex].setAlpha(isActive ? 1 : 0.35);
      }

      const isBombHolder = this.bomb.responsible === player;
      row.status.setText(isBombHolder ? "B" : player.hasWeapon ? "W" : "");
      row.status.setColor(isBombHolder ? "#ffcf33" : "#86f7ff");
    }
  }

  private getBotIntent(bot: Player): BotIntent {
    const isFinalPhase = this.isFinalPhase();
    const fallbackTarget = this.getNearestOpponent(bot);
    const aimTarget = fallbackTarget
      ? new Phaser.Math.Vector2(fallbackTarget.x, fallbackTarget.y)
      : new Phaser.Math.Vector2(this.human.x, this.human.y);
    const moveDirection = new Phaser.Math.Vector2(0, 0);
    let shouldDash = false;
    const shouldParry = this.shouldBotParry(bot);

    if (this.isJudgmentDefensePhase()) {
      return this.getJudgmentBotIntent(bot, aimTarget, shouldParry);
    }

    const shotThreat = this.getShotThreat(bot);
    if (shotThreat.risk > 0) {
      moveDirection.copy(shotThreat.escapeDirection);
      shouldDash = shotThreat.risk > (isFinalPhase ? 0.88 : 0.82) && bot.dashChargeCount > 0;
      return { aimTarget, moveDirection, shouldDash, shouldParry };
    }

    if (this.isJudgmentOrbPhase()) {
      const orb = this.getNearestJudgmentOrb(bot);
      if (orb && this.bomb.owner !== bot) {
        moveDirection.set(orb.shape.x - bot.x, orb.shape.y - bot.y).normalize();
        return { aimTarget, moveDirection, shouldDash, shouldParry };
      }
    }

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
        const pickup = this.getNearestWeaponPickup(bot);
        if (!bot.hasWeapon && pickup) {
          const holderDistance = Phaser.Math.Distance.Between(bot.x, bot.y, holder.x, holder.y);
          if (holderDistance > (isFinalPhase ? 190 : 260)) {
            moveDirection.set(pickup.shape.x - bot.x, pickup.shape.y - bot.y).normalize();
          }
        }
      }

      return { aimTarget, moveDirection, shouldDash, shouldParry };
    }

    const threat = this.getBombThreat(bot);
    if (threat.risk > 0) {
      moveDirection.copy(threat.escapeDirection);
      shouldDash = threat.risk > (isFinalPhase ? 0.86 : 0.78) && bot.dashChargeCount > 0;
      return { aimTarget, moveDirection, shouldDash, shouldParry };
    }

    const armedThreat = this.getArmedOpponentThreat(bot);
    if (armedThreat.risk > 0) {
      moveDirection.copy(armedThreat.escapeDirection);
      shouldDash = armedThreat.risk > (isFinalPhase ? 0.9 : 0.84) && bot.dashChargeCount > 0;
      return { aimTarget, moveDirection, shouldDash, shouldParry };
    }

    const pickup = this.getNearestWeaponPickup(bot);
    if (!bot.hasWeapon && pickup) {
      moveDirection.set(pickup.shape.x - bot.x, pickup.shape.y - bot.y).normalize();
      return { aimTarget, moveDirection, shouldDash, shouldParry };
    }

    if (this.bomb.state === "RETURNING" && this.bomb.owner !== bot) {
      const intercept = this.getReturnInterceptIntent(bot);
      if (intercept.lengthSq() > 0) {
        moveDirection.copy(intercept);
      }
    }

    return { aimTarget, moveDirection, shouldDash, shouldParry };
  }

  private getJudgmentBotIntent(bot: Player, fallbackAimTarget: Phaser.Math.Vector2, shouldParry: boolean): BotIntent {
    const moveDirection = new Phaser.Math.Vector2(0, 0);
    const defender = this.judgmentDefender;
    const aimTarget = defender && defender !== bot
      ? new Phaser.Math.Vector2(defender.x, defender.y)
      : fallbackAimTarget;
    let shouldDash = false;

    const threat = this.getBombThreat(bot);
    if (threat.risk > 0) {
      moveDirection.copy(threat.escapeDirection);
      shouldDash = threat.risk > 0.86 && bot.dashChargeCount > 0;
      return { aimTarget, moveDirection, shouldDash, shouldParry };
    }

    const shotThreat = this.getShotThreat(bot);
    if (shotThreat.risk > 0) {
      moveDirection.copy(shotThreat.escapeDirection);
      shouldDash = shotThreat.risk > 0.88 && bot.dashChargeCount > 0;
      return { aimTarget, moveDirection, shouldDash, shouldParry };
    }

    if (bot === defender) {
      const pickup = this.getNearestWeaponPickup(bot);
      if (!bot.hasWeapon && pickup) {
        moveDirection.set(pickup.shape.x - bot.x, pickup.shape.y - bot.y).normalize();
      } else {
        const away = this.bomb.owner && this.bomb.owner !== bot
          ? new Phaser.Math.Vector2(bot.x - this.bomb.owner.x, bot.y - this.bomb.owner.y)
          : new Phaser.Math.Vector2(this.judgmentCenter.x - bot.x, this.judgmentCenter.y - bot.y);
        moveDirection.copy(away.lengthSq() > 0 ? away.normalize() : moveDirection);
      }
      return { aimTarget, moveDirection, shouldDash, shouldParry };
    }

    const toBot = new Phaser.Math.Vector2(bot.x - this.judgmentCenter.x, bot.y - this.judgmentCenter.y);
    const guardPoint = this.getJudgmentGuardPoint(bot);
    const distanceToGuard = Phaser.Math.Distance.Between(bot.x, bot.y, guardPoint.x, guardPoint.y);
    if (distanceToGuard > 34) {
      moveDirection.set(guardPoint.x - bot.x, guardPoint.y - bot.y).normalize();
    } else if (this.bomb.owner === defender && toBot.lengthSq() > 0) {
      moveDirection.copy(toBot.normalize());
    }

    return { aimTarget, moveDirection, shouldDash, shouldParry };
  }

  private getJudgmentGuardPoint(bot: Player) {
    const attackers = this.players.filter((player) => player !== this.judgmentDefender);
    const index = Math.max(0, attackers.findIndex((player) => player === bot));
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(attackers.length, 1);
    const radius = this.judgmentInnerRadius + 142;
    return new Phaser.Math.Vector2(
      this.judgmentCenter.x + Math.cos(angle) * radius,
      this.judgmentCenter.y + Math.sin(angle) * radius
    );
  }

  private shouldBotParry(bot: Player) {
    if (!this.isFinalPhase() || this.bomb.state === "HELD" || this.bomb.owner === bot || !bot.alive || this.bomb.velocity.lengthSq() === 0) {
      return false;
    }

    const readyAt = this.parryReadyAt.get(bot.id) ?? 0;
    if (this.time.now < readyAt) {
      return false;
    }

    const nextThinkAt = this.botParryThinkAt.get(bot.id) ?? 0;
    if (this.time.now < nextThinkAt) {
      return false;
    }
    this.botParryThinkAt.set(bot.id, this.time.now + Phaser.Math.Between(90, 170));

    const fromBombToBot = new Phaser.Math.Vector2(bot.x - this.bomb.x, bot.y - this.bomb.y);
    const distance = fromBombToBot.length();
    if (distance > BOMB.parryBlockDistance + 135) {
      return false;
    }

    const bombDirection = this.bomb.velocity.clone().normalize();
    const speed = Math.max(this.bomb.velocity.length(), 1);
    const timeAlongPathMs = (fromBombToBot.dot(bombDirection) / speed) * 1000;
    if (timeAlongPathMs < -40 || timeAlongPathMs > BOMB.parryWindowMs + 230) {
      return false;
    }

    const closestPoint = new Phaser.Math.Vector2(this.bomb.x, this.bomb.y).add(
      bombDirection.clone().scale((timeAlongPathMs / 1000) * speed)
    );
    const distanceToPath = Phaser.Math.Distance.Between(bot.x, bot.y, closestPoint.x, closestPoint.y);
    if (distanceToPath > BOMB.parryBlockDistance * 0.82) {
      return false;
    }

    const awareness = this.getBotAwareness(bot);
    const targetBonus = this.bomb.homingTarget === bot ? 0.18 : 0;
    const timingPressure = 1 - Phaser.Math.Clamp(Math.max(0, timeAlongPathMs) / (BOMB.parryWindowMs + 230), 0, 1);
    const chance = Phaser.Math.Clamp(0.18 + awareness * 0.34 + timingPressure * 0.22 + targetBonus, 0, 0.72);
    return Phaser.Math.FloatBetween(0, 1) < chance;
  }

  private getNearestWeaponPickup(player: Player) {
    const seekRadius = this.isFinalPhase() ? WEAPON.botFinalSeekRadius : WEAPON.botSeekRadius;
    return this.weaponPickups
      .filter((pickup) => (
        Phaser.Math.Distance.Squared(player.x, player.y, pickup.shape.x, pickup.shape.y) <= seekRadius ** 2
      ))
      .sort((a, b) => {
        const distanceA = Phaser.Math.Distance.Squared(player.x, player.y, a.shape.x, a.shape.y);
        const distanceB = Phaser.Math.Distance.Squared(player.x, player.y, b.shape.x, b.shape.y);
        return distanceA - distanceB;
      })[0];
  }

  private getNearestJudgmentOrb(player: Player) {
    return this.judgmentOrbs
      .sort((a, b) => {
        const distanceA = Phaser.Math.Distance.Squared(player.x, player.y, a.shape.x, a.shape.y);
        const distanceB = Phaser.Math.Distance.Squared(player.x, player.y, b.shape.x, b.shape.y);
        return distanceA - distanceB;
      })[0];
  }

  private getShotThreat(bot: Player) {
    const escapeDirection = new Phaser.Math.Vector2(0, 0);
    let highestRisk = 0;

    for (const shot of this.shots) {
      if (shot.owner === bot || shot.velocity.lengthSq() === 0) {
        continue;
      }

      const fromShotToBot = new Phaser.Math.Vector2(bot.x - shot.shape.x, bot.y - shot.shape.y);
      const shotDirection = shot.velocity.clone().normalize();
      const speed = Math.max(shot.velocity.length(), 1);
      const timeAlongPathMs = (fromShotToBot.dot(shotDirection) / speed) * 1000;

      if (timeAlongPathMs < -80 || timeAlongPathMs > WEAPON.botShotLookAheadMs) {
        continue;
      }

      const closestPoint = new Phaser.Math.Vector2(shot.shape.x, shot.shape.y).add(
        shotDirection.clone().scale((timeAlongPathMs / 1000) * speed)
      );
      const distanceToPath = Phaser.Math.Distance.Between(bot.x, bot.y, closestPoint.x, closestPoint.y);
      if (distanceToPath > WEAPON.botShotEvadeRadius) {
        continue;
      }

      const side = Math.sign(fromShotToBot.cross(shotDirection)) || 1;
      const candidate = new Phaser.Math.Vector2(-shotDirection.y * side, shotDirection.x * side);
      const centerPull = new Phaser.Math.Vector2(
        this.arenaRect.centerX - bot.x,
        this.arenaRect.centerY - bot.y
      ).normalize();
      candidate.scale(0.82).add(centerPull.scale(0.18)).normalize();

      const distanceRisk = 1 - distanceToPath / WEAPON.botShotEvadeRadius;
      const timingRisk = 1 - Math.max(0, timeAlongPathMs) / WEAPON.botShotLookAheadMs;
      const risk = Phaser.Math.Clamp(distanceRisk * 0.68 + timingRisk * 0.32, 0, 1);
      if (risk > highestRisk) {
        highestRisk = risk;
        escapeDirection.copy(candidate);
      }
    }

    return { risk: highestRisk, escapeDirection };
  }

  private getArmedOpponentThreat(bot: Player) {
    const escapeDirection = new Phaser.Math.Vector2(0, 0);
    let highestRisk = 0;
    const threatRange = this.isFinalPhase() ? WEAPON.botFinalArmedThreatRange : WEAPON.botArmedThreatRange;
    const lineRadius = this.isFinalPhase() ? WEAPON.botFinalArmedLineRadius : WEAPON.botArmedLineRadius;

    for (const opponent of this.getAlivePlayers()) {
      if (opponent === bot || !opponent.hasWeapon) {
        continue;
      }

      const fromOpponentToBot = new Phaser.Math.Vector2(bot.x - opponent.x, bot.y - opponent.y);
      const distance = fromOpponentToBot.length();
      if (distance <= 0 || distance > threatRange) {
        continue;
      }

      const aimDirection = opponent.aimDirection.clone().normalize();
      const projection = fromOpponentToBot.dot(aimDirection);
      if (projection < 0) {
        continue;
      }

      const closestPoint = new Phaser.Math.Vector2(opponent.x, opponent.y).add(aimDirection.clone().scale(projection));
      const distanceToLine = Phaser.Math.Distance.Between(bot.x, bot.y, closestPoint.x, closestPoint.y);
      if (distanceToLine > lineRadius) {
        continue;
      }

      const side = Math.sign(fromOpponentToBot.cross(aimDirection)) || 1;
      const candidate = new Phaser.Math.Vector2(-aimDirection.y * side, aimDirection.x * side);
      const away = fromOpponentToBot.normalize();
      candidate.scale(0.74).add(away.scale(0.26)).normalize();

      const lineRisk = 1 - distanceToLine / lineRadius;
      const rangeRisk = 1 - distance / threatRange;
      const risk = Phaser.Math.Clamp((lineRisk * 0.72 + rangeRisk * 0.28) * this.getBotAwareness(bot), 0, 1);
      if (risk > highestRisk) {
        highestRisk = risk;
        escapeDirection.copy(candidate);
      }
    }

    return { risk: highestRisk, escapeDirection };
  }

  private getBombThreat(bot: Player) {
    const escapeDirection = new Phaser.Math.Vector2(0, 0);
    if (this.bomb.state === "HELD" || this.bomb.owner === bot || this.bomb.velocity.lengthSq() === 0) {
      return { risk: 0, escapeDirection };
    }

    const isFinalHomingTarget = this.isFinalPhase() && this.bomb.homingTarget === bot && this.bomb.state === "OUTBOUND";
    const evadeRadius = isFinalHomingTarget ? BOT.finalHomingEvadeRadius : BOT.evadeRadius;
    const lookAheadMs = isFinalHomingTarget ? BOT.finalHomingLookAheadMs : BOT.evadeLookAheadMs;
    const fromBombToBot = new Phaser.Math.Vector2(bot.x - this.bomb.x, bot.y - this.bomb.y);
    const bombDirection = this.bomb.velocity.clone().normalize();
    const speed = Math.max(this.bomb.velocity.length(), 1);
    const timeAlongPathMs = (fromBombToBot.dot(bombDirection) / speed) * 1000;
    const awareness = this.getBotAwareness(bot);
    const reactionLimitMs = lookAheadMs * awareness;

    if (timeAlongPathMs < -120 || timeAlongPathMs > reactionLimitMs) {
      return { risk: 0, escapeDirection };
    }

    const closestPoint = new Phaser.Math.Vector2(this.bomb.x, this.bomb.y).add(
      bombDirection.clone().scale((timeAlongPathMs / 1000) * speed)
    );
    const distanceToPath = Phaser.Math.Distance.Between(bot.x, bot.y, closestPoint.x, closestPoint.y);
    if (distanceToPath > evadeRadius) {
      return { risk: 0, escapeDirection };
    }

    const side = Math.sign(fromBombToBot.cross(bombDirection)) || 1;
    escapeDirection.set(-bombDirection.y * side, bombDirection.x * side);
    if (isFinalHomingTarget) {
      const awayFromBomb = fromBombToBot.clone().normalize();
      escapeDirection.scale(0.72).add(awayFromBomb.scale(0.28)).normalize();
    }
    const centerPull = new Phaser.Math.Vector2(
      this.arenaRect.centerX - bot.x,
      this.arenaRect.centerY - bot.y
    ).normalize();
    escapeDirection.scale(isFinalHomingTarget ? 0.7 : 0.78).add(centerPull.scale(isFinalHomingTarget ? 0.3 : 0.22)).normalize();

    const distanceRisk = 1 - distanceToPath / evadeRadius;
    const timingRisk = 1 - Math.max(0, timeAlongPathMs) / lookAheadMs;
    const homingPressure = isFinalHomingTarget ? 0.16 : 0;
    return {
      risk: Phaser.Math.Clamp((distanceRisk * 0.66 + timingRisk * 0.34 + homingPressure) * awareness, 0, 1),
      escapeDirection
    };
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

  private getBotAwareness(bot: Player) {
    const seed = bot.id.split("").reduce((total, char) => total + char.charCodeAt(0), 0);
    return 0.82 + (seed % 5) * 0.045;
  }

  private getSpecialBombTarget(owner: Player, direction: Phaser.Math.Vector2) {
    const aimDirection = direction.lengthSq() > 0
      ? direction.clone().normalize()
      : owner.aimDirection.clone().normalize();

    return this.getAlivePlayers()
      .filter((candidate) => candidate !== owner)
      .sort((a, b) => {
        const toA = new Phaser.Math.Vector2(a.x - owner.x, a.y - owner.y);
        const toB = new Phaser.Math.Vector2(b.x - owner.x, b.y - owner.y);
        const distanceA = Math.max(toA.length(), 1);
        const distanceB = Math.max(toB.length(), 1);
        const dotA = aimDirection.dot(toA.normalize());
        const dotB = aimDirection.dot(toB.normalize());
        const scoreA = (1 - dotA) * 420 + distanceA * 0.34;
        const scoreB = (1 - dotB) * 420 + distanceB * 0.34;
        return scoreA - scoreB;
      })[0] ?? null;
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
