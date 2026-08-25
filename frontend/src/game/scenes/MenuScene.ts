import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { hasFirebaseConfig } from "../online/firebaseClient";
import { createPlayerId, GameSettings, loadSettings, saveSettings } from "../settings";

const MENU_TEXT = {
  en: {
    subtitleLead: "8 ENTER.",
    subtitleAccent: "1 LEAVES.",
    start: "START MATCH",
    hostOnline: "HOST ONLINE",
    joinOnline: "JOIN ROOM",
    roomCode: "ROOM CODE",
    noRoom: "--",
    firebaseMissing: "FIREBASE OFF",
    settings: "SETTINGS",
    language: "LANGUAGE",
    volume: "VOLUME",
    debug: "DEBUG MODE",
    on: "ON",
    off: "OFF",
    controlsTitle: "CONTROLS",
    move: "MOVE",
    aim: "AIM",
    throwShoot: "THROW / SHOOT",
    dash: "DASH",
    rematch: "REMATCH",
    debugHint: "Enables the 4P skip button in-match.",
    version: "v0.1.0  -  DEV BUILD",
    promptRoom: "Room code"
  },
  pt: {
    subtitleLead: "8 ENTRAM.",
    subtitleAccent: "1 SAI.",
    start: "INICIAR PARTIDA",
    hostOnline: "CRIAR ONLINE",
    joinOnline: "ENTRAR SALA",
    roomCode: "CODIGO DA SALA",
    noRoom: "--",
    firebaseMissing: "FIREBASE OFF",
    settings: "AJUSTES",
    language: "IDIOMA",
    volume: "VOLUME",
    debug: "MODO DEBUG",
    on: "ON",
    off: "OFF",
    controlsTitle: "CONTROLES",
    move: "MOVER",
    aim: "MIRAR",
    throwShoot: "LANCAR / ATIRAR",
    dash: "DASH",
    rematch: "REVANCHE",
    debugHint: "Ativa o botao 4P durante a partida.",
    version: "v0.1.0  -  DEV BUILD",
    promptRoom: "Codigo da sala"
  }
} as const;

type ButtonColors = {
  fill: number;
  stroke: number;
  hoverFill: number;
};

export class MenuScene extends Phaser.Scene {
  private settings: GameSettings = loadSettings();
  private languageValue!: Phaser.GameObjects.Text;
  private volumeValue!: Phaser.GameObjects.Text;
  private debugValue!: Phaser.GameObjects.Text;
  private subtitleLead!: Phaser.GameObjects.Text;
  private subtitleAccent!: Phaser.GameObjects.Text;
  private startLabel!: Phaser.GameObjects.Text;
  private hostLabel!: Phaser.GameObjects.Text;
  private joinLabel!: Phaser.GameObjects.Text;
  private roomCodeLabel!: Phaser.GameObjects.Text;
  private roomValue!: Phaser.GameObjects.Text;
  private settingsTitle!: Phaser.GameObjects.Text;
  private controlsTitle!: Phaser.GameObjects.Text;
  private debugHint!: Phaser.GameObjects.Text;
  private languageLabel!: Phaser.GameObjects.Text;
  private volumeLabel!: Phaser.GameObjects.Text;
  private debugLabel!: Phaser.GameObjects.Text;
  private moveLabel!: Phaser.GameObjects.Text;
  private aimLabel!: Phaser.GameObjects.Text;
  private throwLabel!: Phaser.GameObjects.Text;
  private dashLabel!: Phaser.GameObjects.Text;
  private rematchLabel!: Phaser.GameObjects.Text;
  private versionText!: Phaser.GameObjects.Text;

  constructor() {
    super("MenuScene");
  }

  create() {
    this.settings = loadSettings();
    if (this.startFromUrlParams()) {
      return;
    }

    this.drawBackground();
    this.drawFrame();
    this.createTitle();
    this.createActionPanel();
    this.createArenaPreview();
    this.createSettingsPanel();
    this.createControlsPanel();
    this.createFooter();
    this.refreshText();
  }

  private startFromUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const role = params.get("onlineRole");
    if (role !== "host" && role !== "guest") {
      return false;
    }

    const roomCode = (params.get("room") || this.createRoomCode()).trim().toUpperCase();
    if (!roomCode) {
      return false;
    }

    const debugFromUrl = params.get("debug") === "1";
    const runtimeSettings = {
      ...this.settings,
      debugMode: debugFromUrl || this.settings.debugMode,
      online: {
        enabled: true,
        role,
        roomCode,
        playerId: createPlayerId()
      }
    };
    this.settings.online = {
      enabled: true,
      role,
      roomCode,
      playerId: runtimeSettings.online.playerId
    };
    if (debugFromUrl) {
      this.settings.debugMode = false;
    }
    saveSettings(this.settings);
    this.scene.start("GameScene", runtimeSettings);
    return true;
  }

  private drawBackground() {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x05070a, 1);

    const noise = this.add.graphics();
    for (let index = 0; index < 120; index += 1) {
      const x = Phaser.Math.Between(30, GAME_WIDTH - 30);
      const y = Phaser.Math.Between(30, GAME_HEIGHT - 30);
      const alpha = Phaser.Math.FloatBetween(0.03, 0.11);
      noise.fillStyle(index % 4 === 0 ? 0xffb000 : 0x253142, alpha);
      noise.fillRect(x, y, Phaser.Math.Between(2, 5), Phaser.Math.Between(1, 4));
    }

    const dots = this.add.graphics();
    for (let row = 0; row < 11; row += 1) {
      for (let column = 0; column < 9; column += 1) {
        dots.fillStyle(0xffb000, 0.05 + column * 0.004);
        dots.fillCircle(56 + column * 20, 54 + row * 18, 6);
      }
    }
  }

  private drawFrame() {
    const frame = this.add.graphics();
    frame.lineStyle(3, 0xffbf16, 1);
    frame.strokePoints([
      new Phaser.Geom.Point(22, 44),
      new Phaser.Geom.Point(66, 16),
      new Phaser.Geom.Point(716, 16),
      new Phaser.Geom.Point(728, 30),
      new Phaser.Geom.Point(1224, 30),
      new Phaser.Geom.Point(1260, 70),
      new Phaser.Geom.Point(1260, 650),
      new Phaser.Geom.Point(1222, 690),
      new Phaser.Geom.Point(672, 690),
      new Phaser.Geom.Point(658, 704),
      new Phaser.Geom.Point(44, 704),
      new Phaser.Geom.Point(22, 684)
    ], true, true);

    frame.lineStyle(8, 0xffbf16, 0.85);
    for (let index = 0; index < 5; index += 1) {
      frame.lineBetween(32 + index * 13, 47 + index * 5, 32 + index * 13, 78 + index * 5);
      frame.lineBetween(1215 + index * 12, 674 - index * 2, 1240 + index * 12, 674 - index * 2);
    }
  }

  private createTitle() {
    this.add.text(72, 74, "BOMB TAG", {
      color: "#ffbf16",
      fontFamily: "Impact, Haettenschweiler, Arial Black, sans-serif",
      fontSize: "88px",
      fontStyle: "900",
      stroke: "#05070a",
      strokeThickness: 10
    });
    this.subtitleLead = this.add.text(146, 180, "", {
      color: "#f8f8f3",
      fontFamily: "Arial Black, ui-sans-serif, system-ui",
      fontSize: "32px",
      fontStyle: "900 italic",
      stroke: "#05070a",
      strokeThickness: 5
    });
    this.subtitleAccent = this.add.text(314, 180, "", {
      color: "#ffbf16",
      fontFamily: "Arial Black, ui-sans-serif, system-ui",
      fontSize: "32px",
      fontStyle: "900 italic",
      stroke: "#05070a",
      strokeThickness: 5
    });
  }

  private createActionPanel() {
    const startButton = this.createButton(62, 262, 540, 84, {
      fill: 0xffbf16,
      stroke: 0xffe07a,
      hoverFill: 0xffd24d
    }, () => this.startGame());
    startButton.add(this.add.text(-230, 1, ">>", this.buttonTextStyle("#071018", "30px")).setOrigin(0.5));
    this.startLabel = this.add.text(0, 0, "", this.buttonTextStyle("#071018", "42px")).setOrigin(0.5);
    startButton.add(this.startLabel);
    startButton.add(this.add.text(230, 1, ">>", this.buttonTextStyle("#071018", "30px")).setOrigin(0.5));

    const hostButton = this.createButton(66, 382, 260, 62, {
      fill: 0x0b1219,
      stroke: 0x00d8ff,
      hoverFill: 0x102535
    }, () => this.hostOnline());
    hostButton.add(this.add.text(-92, -1, "◎", this.iconStyle("#00d8ff", "32px")).setOrigin(0.5));
    this.hostLabel = this.add.text(30, 0, "", this.buttonTextStyle("#f7f8ff", "22px")).setOrigin(0.5);
    hostButton.add(this.hostLabel);

    const joinButton = this.createButton(352, 382, 260, 62, {
      fill: 0x0b1219,
      stroke: 0x00d8ff,
      hoverFill: 0x102535
    }, () => this.joinOnline());
    joinButton.add(this.add.text(-96, -1, "●●●", this.iconStyle("#00d8ff", "18px")).setOrigin(0.5));
    this.joinLabel = this.add.text(32, 0, "", this.buttonTextStyle("#f7f8ff", "22px")).setOrigin(0.5);
    joinButton.add(this.joinLabel);

    this.createCodePanel();
  }

  private createCodePanel() {
    this.drawAngledPanel(62, 462, 540, 62, 0x070b11, 0x303843, 0.92, 0.8);
    this.add.text(92, 484, "●●●", {
      color: "#6f7886",
      fontFamily: "Arial Black, sans-serif",
      fontSize: "16px",
      fontStyle: "900"
    });
    this.roomCodeLabel = this.add.text(124, 482, "", {
      color: "#8c94a3",
      fontFamily: "Arial Black, ui-sans-serif, system-ui",
      fontSize: "20px",
      fontStyle: "900"
    });
    this.roomValue = this.add.text(480, 482, "", {
      color: "#00d8ff",
      fontFamily: "Arial Black, ui-sans-serif, system-ui",
      fontSize: "24px",
      fontStyle: "900"
    }).setOrigin(0.5, 0);
  }

  private createArenaPreview() {
    this.drawAngledPanel(648, 68, 568, 340, 0x0c121a, 0x202a36, 0.86, 0.58);

    const arena = this.add.graphics();
    arena.fillStyle(0x0f1720, 0.92);
    arena.lineStyle(12, 0x1d2732, 1);
    arena.strokePoints([
      new Phaser.Geom.Point(720, 94),
      new Phaser.Geom.Point(1190, 94),
      new Phaser.Geom.Point(1190, 360),
      new Phaser.Geom.Point(1100, 390),
      new Phaser.Geom.Point(710, 390),
      new Phaser.Geom.Point(660, 340),
      new Phaser.Geom.Point(660, 138)
    ], true, true);
    arena.lineStyle(1, 0x263141, 0.42);
    for (let x = 710; x < 1180; x += 42) {
      arena.lineBetween(x, 108, x, 398);
    }
    for (let y = 118; y < 370; y += 42) {
      arena.lineBetween(680, y, 1184, y);
    }

    this.add.circle(940, 276, 64, 0x111820, 0.82);
    this.add.circle(940, 276, 26, 0x202b38, 0.65);
    this.add.circle(915, 276, 16, 0x0a0f14, 0.85);
    this.add.circle(965, 276, 16, 0x0a0f14, 0.85);

    this.drawCrate(1008, 188);
    this.drawCrate(860, 370);
    this.drawCrate(695, 286);
    this.drawBombTrail();
    this.drawPreviewPlayer(784, 200, 0xffbf16, 1.2);
    this.drawPreviewPlayer(1110, 176, 0x2fa8d7, 2.72);
    this.drawPreviewPlayer(1128, 330, 0xff423a, -2.58);
    this.drawPreviewPlayer(768, 374, 0x8a4dcc, 0.45);
    this.drawBombMark(950, 274, 24, 0x101010, 1, true);
  }

  private createSettingsPanel() {
    this.settingsTitle = this.add.text(68, 526, "", {
      color: "#ffbf16",
      fontFamily: "Arial Black, ui-sans-serif, system-ui",
      fontSize: "26px",
      fontStyle: "900"
    });

    this.drawAngledPanel(62, 556, 540, 108, 0x090d13, 0x39414d, 0.9, 0.82);

    this.add.text(100, 572, "◎", this.iconStyle("#f7f8ff", "24px")).setOrigin(0.5);
    this.languageLabel = this.add.text(138, 570, "", this.labelStyle());
    this.languageValue = this.add.text(430, 570, "", this.valueStyle()).setOrigin(0.5, 0);
    this.createSmallButton(520, 560, 54, 30, 0x00d8ff, () => this.toggleLanguage(), "<>");

    this.add.text(100, 607, "◁", this.iconStyle("#f7f8ff", "24px")).setOrigin(0.5);
    this.volumeLabel = this.add.text(138, 605, "", this.labelStyle());
    this.createSmallButton(340, 595, 42, 30, 0x00d8ff, () => this.changeVolume(-0.1), "-");
    this.volumeValue = this.add.text(430, 605, "", this.valueStyle()).setOrigin(0.5, 0);
    this.createSmallButton(520, 595, 42, 30, 0x00d8ff, () => this.changeVolume(0.1), "+");

    this.add.text(100, 642, "✣", this.iconStyle("#f7f8ff", "24px")).setOrigin(0.5);
    this.debugLabel = this.add.text(138, 640, "", this.labelStyle());
    this.debugValue = this.add.text(430, 640, "", this.valueStyle()).setOrigin(0.5, 0);
    this.createSmallButton(520, 630, 54, 30, 0xffbf16, () => this.toggleDebug(), "<>");

    this.debugHint = this.add.text(68, 666, "", {
      color: "#858e9e",
      fontFamily: "ui-sans-serif, system-ui",
      fontSize: "13px",
      fontStyle: "700"
    });
  }

  private createControlsPanel() {
    this.drawAngledPanel(688, 404, 560, 236, 0x090d13, 0xffbf16, 0.88, 0.86);
    this.controlsTitle = this.add.text(760, 428, "", {
      color: "#ffbf16",
      fontFamily: "Arial Black, ui-sans-serif, system-ui",
      fontSize: "25px",
      fontStyle: "900"
    });
    this.add.text(720, 430, "⌖", this.iconStyle("#ffbf16", "30px")).setOrigin(0.5);

    const rows = [
      { y: 470, keys: ["W", "A", "S", "D"], assign: (text: Phaser.GameObjects.Text) => this.moveLabel = text },
      { y: 508, keys: ["◐"], assign: (text: Phaser.GameObjects.Text) => this.aimLabel = text },
      { y: 546, keys: ["◑"], assign: (text: Phaser.GameObjects.Text) => this.throwLabel = text },
      { y: 584, keys: ["SHIFT", "SPACE"], assign: (text: Phaser.GameObjects.Text) => this.dashLabel = text },
      { y: 622, keys: ["R"], assign: (text: Phaser.GameObjects.Text) => this.rematchLabel = text }
    ];

    for (const row of rows) {
      this.drawKeyGroup(720, row.y, row.keys);
      this.add.circle(864, row.y + 8, 3, 0x2f3a48, 1);
      const label = this.add.text(908, row.y - 6, "", {
        color: "#f7f8ff",
        fontFamily: "Arial Black, ui-sans-serif, system-ui",
        fontSize: "22px",
        fontStyle: "900"
      });
      row.assign(label);
    }
  }

  private createFooter() {
    this.versionText = this.add.text(28, 672, "", {
      color: "#6f7886",
      fontFamily: "Arial Black, ui-sans-serif, system-ui",
      fontSize: "14px",
      fontStyle: "900"
    });
    this.drawBombMark(640, 674, 22, 0xffbf16, 1);
  }

  private createButton(x: number, y: number, width: number, height: number, colors: ButtonColors, onClick: () => void) {
    const background = this.add.graphics();
    this.drawButtonShape(background, width, height, colors.fill, colors.stroke, 1);
    const button = this.add.container(x + width / 2, y + height / 2, [background]);
    button.setSize(width, height);
    const hitArea = this.add.zone(x + width / 2, y + height / 2, width, height);
    hitArea.setInteractive({ useHandCursor: true });
    hitArea.on("pointerover", () => this.drawButtonShape(background, width, height, colors.hoverFill, colors.stroke, 1));
    hitArea.on("pointerout", () => {
      button.setScale(1);
      this.drawButtonShape(background, width, height, colors.fill, colors.stroke, 1);
    });
    hitArea.on("pointerdown", () => {
      button.setScale(0.96);
      onClick();
    });
    hitArea.on("pointerup", () => button.setScale(1));
    hitArea.on("pointerupoutside", () => button.setScale(1));
    return button;
  }

  private createSmallButton(x: number, y: number, width: number, height: number, stroke: number, onClick: () => void, label: string) {
    const button = this.createButton(x, y, width, height, {
      fill: 0x070b11,
      stroke,
      hoverFill: 0x13202b
    }, onClick);
    button.add(this.add.text(0, -1, label, {
      color: "#f7f8ff",
      fontFamily: "Arial Black, ui-sans-serif, system-ui",
      fontSize: "18px",
      fontStyle: "900"
    }).setOrigin(0.5));
  }

  private drawButtonShape(graphics: Phaser.GameObjects.Graphics, width: number, height: number, fill: number, stroke: number, alpha: number) {
    const cut = Math.min(22, height * 0.45);
    const points = [
      new Phaser.Geom.Point(-width / 2 + cut, -height / 2),
      new Phaser.Geom.Point(width / 2 - 12, -height / 2),
      new Phaser.Geom.Point(width / 2, -height / 2 + 12),
      new Phaser.Geom.Point(width / 2 - cut, height / 2),
      new Phaser.Geom.Point(-width / 2 + 8, height / 2),
      new Phaser.Geom.Point(-width / 2, height / 2 - 12),
      new Phaser.Geom.Point(-width / 2 + cut, -height / 2)
    ];
    graphics.clear();
    graphics.fillStyle(fill, alpha);
    graphics.fillPoints(points, true);
    graphics.lineStyle(2, stroke, 0.95);
    graphics.strokePoints(points, true, true);
    graphics.lineStyle(1, 0xffffff, 0.2);
    graphics.lineBetween(-width / 2 + cut + 8, -height / 2 + 5, width / 2 - 28, -height / 2 + 5);
  }

  private drawAngledPanel(x: number, y: number, width: number, height: number, fill: number, stroke: number, fillAlpha: number, strokeAlpha: number) {
    const cut = 22;
    const graphics = this.add.graphics();
    const points = [
      new Phaser.Geom.Point(x + cut, y),
      new Phaser.Geom.Point(x + width - 12, y),
      new Phaser.Geom.Point(x + width, y + 12),
      new Phaser.Geom.Point(x + width, y + height - cut),
      new Phaser.Geom.Point(x + width - cut, y + height),
      new Phaser.Geom.Point(x + 12, y + height),
      new Phaser.Geom.Point(x, y + height - 12),
      new Phaser.Geom.Point(x, y + cut)
    ];
    graphics.fillStyle(fill, fillAlpha);
    graphics.fillPoints(points, true);
    graphics.lineStyle(2, stroke, strokeAlpha);
    graphics.strokePoints(points, true, true);
    graphics.lineStyle(1, 0xffffff, 0.08);
    graphics.strokePoints(points.map((point) => new Phaser.Geom.Point(point.x + 3, point.y + 3)), true, true);
    return graphics;
  }

  private drawKeyGroup(x: number, y: number, keys: string[]) {
    let offset = 0;
    for (const key of keys) {
      const width = key.length > 1 ? 58 : 30;
      const box = this.add.rectangle(x + offset, y + 8, width, 30, 0x090d13, 0.92);
      box.setStrokeStyle(2, 0xaeb6c4, 0.65);
      this.add.text(x + offset, y - 4, key, {
        color: "#f7f8ff",
        fontFamily: "Arial Black, ui-sans-serif, system-ui",
        fontSize: key.length > 1 ? "16px" : "20px",
        fontStyle: "900"
      }).setOrigin(0.5, 0);
      offset += width + 6;
    }
  }

  private drawPreviewPlayer(x: number, y: number, color: number, angle: number) {
    this.add.ellipse(x - 8, y + 20, 50, 24, 0x000000, 0.42);
    const body = this.add.circle(x, y, 24, color, 1);
    body.setStrokeStyle(3, 0x111820, 0.95);
    this.add.circle(x - 8, y - 9, 5, 0xffffff, 0.78);
    this.add.circle(x + 12, y - 2, 4, 0x071018, 0.8);
    const aim = this.add.rectangle(x + Math.cos(angle) * 32, y + Math.sin(angle) * 32, 38, 8, color, 0.9);
    aim.setRotation(angle);
  }

  private drawCrate(x: number, y: number) {
    const crate = this.add.rectangle(x, y, 34, 34, 0x2c3541, 1);
    crate.setStrokeStyle(1, 0x596472, 0.9);
    this.add.rectangle(x - 4, y - 4, 34, 34, 0x131a22, 0.25);
  }

  private drawBombTrail() {
    const trail = this.add.graphics();
    const path = [
      new Phaser.Geom.Point(948, 272),
      new Phaser.Geom.Point(1002, 260),
      new Phaser.Geom.Point(1048, 302),
      new Phaser.Geom.Point(1088, 362),
      new Phaser.Geom.Point(1150, 320),
      new Phaser.Geom.Point(1212, 286)
    ];
    trail.lineStyle(6, 0xff5e00, 0.25);
    trail.strokePoints(path, false, false);
    trail.lineStyle(3, 0xffbf16, 0.9);
    trail.strokePoints(path, false, false);
    this.add.circle(1088, 362, 8, 0xffbf16, 1);
    this.add.circle(1212, 286, 7, 0xffbf16, 1);
  }

  private drawBombMark(x: number, y: number, radius: number, color: number, alpha: number, skull = false) {
    this.add.circle(x, y, radius, color, alpha);
    this.add.rectangle(x + radius * 0.35, y - radius * 0.76, radius * 0.68, radius * 0.36, color, alpha).setRotation(0.45);
    this.add.line(x + radius * 0.72, y - radius * 1.08, 0, 0, radius * 0.62, -radius * 0.52, color, alpha).setLineWidth(4);
    if (skull) {
      this.add.circle(x - 7, y - 3, 11, 0xf7f8ff, 1);
      this.add.circle(x - 10, y - 5, 3, 0x05070a, 1);
      this.add.circle(x - 3, y - 5, 3, 0x05070a, 1);
      this.add.rectangle(x - 7, y + 6, 10, 4, 0xf7f8ff, 1);
    }
  }

  private refreshText() {
    const dictionary = MENU_TEXT[this.settings.language];
    this.subtitleLead.setText(dictionary.subtitleLead);
    this.subtitleAccent.setText(dictionary.subtitleAccent);
    this.startLabel.setText(dictionary.start);
    this.hostLabel.setText(dictionary.hostOnline);
    this.joinLabel.setText(dictionary.joinOnline);
    this.roomCodeLabel.setText(dictionary.roomCode);
    this.roomValue.setText(this.getRoomLabel());
    this.settingsTitle.setText(`⚙ ${dictionary.settings}`);
    this.languageLabel.setText(dictionary.language);
    this.languageValue.setText(this.settings.language === "en" ? "EN" : "PT");
    this.volumeLabel.setText(dictionary.volume);
    this.volumeValue.setText(`${Math.round(this.settings.volume * 100)}%`);
    this.debugLabel.setText(dictionary.debug);
    this.debugValue.setText(this.settings.debugMode ? dictionary.on : dictionary.off);
    this.debugValue.setColor(this.settings.debugMode ? "#ffbf16" : "#f7f8ff");
    this.controlsTitle.setText(dictionary.controlsTitle);
    this.moveLabel.setText(dictionary.move);
    this.aimLabel.setText(dictionary.aim);
    this.throwLabel.setText(dictionary.throwShoot);
    this.dashLabel.setText(dictionary.dash);
    this.rematchLabel.setText(dictionary.rematch);
    this.debugHint.setText("");
    this.versionText.setText(dictionary.version);
  }

  private getRoomLabel() {
    const dictionary = MENU_TEXT[this.settings.language];
    if (!hasFirebaseConfig()) {
      return dictionary.firebaseMissing;
    }

    if (!this.settings.online.enabled || !this.settings.online.roomCode) {
      return dictionary.noRoom;
    }

    return this.settings.online.roomCode;
  }

  private toggleLanguage() {
    this.settings.language = this.settings.language === "en" ? "pt" : "en";
    this.saveAndRefresh();
  }

  private changeVolume(amount: number) {
    this.settings.volume = Math.round(Math.min(1, Math.max(0, this.settings.volume + amount)) * 10) / 10;
    this.saveAndRefresh();
  }

  private toggleDebug() {
    this.settings.debugMode = !this.settings.debugMode;
    this.saveAndRefresh();
  }

  private saveAndRefresh() {
    saveSettings(this.settings);
    this.refreshText();
  }

  private startGame() {
    this.settings.online.enabled = false;
    saveSettings(this.settings);
    this.scene.start("GameScene", this.settings);
  }

  private hostOnline() {
    this.settings.online = {
      enabled: true,
      role: "host",
      roomCode: this.createRoomCode(),
      playerId: this.settings.online.playerId || createPlayerId()
    };
    saveSettings(this.settings);
    this.scene.start("LobbyScene", this.settings);
  }

  private joinOnline() {
    const dictionary = MENU_TEXT[this.settings.language];
    const code = window.prompt(dictionary.promptRoom)?.trim().toUpperCase();
    if (!code) {
      return;
    }

    this.settings.online = {
      enabled: true,
      role: "guest",
      roomCode: code,
      playerId: this.settings.online.playerId || createPlayerId()
    };
    saveSettings(this.settings);
    this.scene.start("LobbyScene", this.settings);
  }

  private createRoomCode() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    return Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  }

  private labelStyle(): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      color: "#f7f8ff",
      fontFamily: "Arial Black, ui-sans-serif, system-ui",
      fontSize: "17px",
      fontStyle: "900"
    };
  }

  private valueStyle(): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      color: "#ffbf16",
      fontFamily: "Arial Black, ui-sans-serif, system-ui",
      fontSize: "19px",
      fontStyle: "900"
    };
  }

  private buttonTextStyle(color: string, size: string): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      color,
      fontFamily: "Impact, Arial Black, ui-sans-serif, system-ui",
      fontSize: size,
      fontStyle: "900 italic"
    };
  }

  private iconStyle(color: string, size: string): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      color,
      fontFamily: "Arial Black, ui-sans-serif, system-ui",
      fontSize: size,
      fontStyle: "900"
    };
  }
}
