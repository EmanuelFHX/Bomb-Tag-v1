import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { hasFirebaseConfig } from "../online/firebaseClient";
import { createPlayerId, GameSettings, loadSettings, normalizePlayerName, saveSettings } from "../settings";

const MENU_TEXT = {
  en: {
    tagline: "8 ENTER. 1 LEAVES.",
    nameLabel: "PLAYER NAME",
    start: "START MATCH",
    multiplayer: "MULTIPLAYER",
    settings: "SETTINGS",
    howToPlay: "HOW TO PLAY",
    howToPlayTitle: "HOW TO PLAY",
    howToPlayLines: [
      "Bomb Tag is an arena survival game: 8 players enter and only 1 leaves.",
      "Hold the bomb, aim with the mouse, and throw it before the timer ends.",
      "The bomb can ricochet, return to the thrower, and become homing in the final round.",
      "Weapons spawn during the match. Pick one up and shoot to remove enemy lives.",
      "Dash gives a short burst of movement and invulnerability. In the final round, dashes recharge.",
      "In the final round, right click to parry. Perfect parry returns the bomb; bad parry gives it to you.",
      "Spin 180 degrees while holding the bomb, then throw to launch it faster. In the final round, spin throws break parries."
    ],
    hostOnline: "HOST ROOM",
    joinOnline: "JOIN ROOM",
    back: "BACK",
    language: "LANGUAGE",
    volume: "VOLUME",
    debug: "DEBUG MODE",
    on: "ON",
    off: "OFF",
    firebaseReady: "ONLINE READY",
    firebaseMissing: "FIREBASE OFF",
    promptName: "Player name",
    promptRoom: "Room code",
    ok: "OK",
    cancel: "CANCEL",
    version: "v0.1.0 DEV BUILD"
  },
  pt: {
    tagline: "8 ENTRAM. 1 SAI.",
    nameLabel: "NOME DO PLAYER",
    start: "INICIAR PARTIDA",
    multiplayer: "MULTIPLAYER",
    settings: "CONFIGURAÇÕES",
    howToPlay: "COMO JOGAR",
    howToPlayTitle: "COMO JOGAR",
    howToPlayLines: [
      "Bomb Tag é um jogo de sobrevivência em arena: 8 jogadores entram e apenas 1 sai.",
      "Segure a bomba, mire com o mouse e lance antes do timer acabar.",
      "A bomba pode ricochetear, voltar para quem lançou e ficar teleguiada na rodada final.",
      "Armas aparecem durante a partida. Pegue uma e atire para tirar vidas dos inimigos.",
      "O dash dá uma corrida curta e invulnerabilidade. Na rodada final, os dashes recarregam.",
      "Na rodada final, use clique direito para dar parry. Parry perfeito devolve a bomba; parry ruim passa a bomba para você.",
      "Gire 180 graus segurando a bomba e lance para jogar mais rápido. Na rodada final, esse giro quebra parries."
    ],
    hostOnline: "CRIAR SALA",
    joinOnline: "ENTRAR NA SALA",
    back: "VOLTAR",
    language: "IDIOMA",
    volume: "VOLUME",
    debug: "MODO DEBUG",
    on: "ON",
    off: "OFF",
    firebaseReady: "ONLINE PRONTO",
    firebaseMissing: "FIREBASE OFF",
    promptName: "Nome do player",
    promptRoom: "Código da sala",
    ok: "OK",
    cancel: "CANCELAR",
    version: "v0.1.0 DEV BUILD"
  }
} as const;

type MenuView = "main" | "multiplayer" | "settings";

type ButtonColors = {
  fill: number;
  stroke: number;
  hoverFill: number;
  text: string;
};

type FakePlayer = {
  body: Phaser.GameObjects.Arc;
  aim: Phaser.GameObjects.Rectangle;
  wake: Phaser.GameObjects.Arc;
  velocity: Phaser.Math.Vector2;
};

type ActiveModal = {
  value: string;
  maxLength: number;
  transform: (value: string) => string;
  submit: (value: string) => void;
};

export class MenuScene extends Phaser.Scene {
  private settings: GameSettings = loadSettings();
  private view: MenuView = "main";
  private viewObjects: Phaser.GameObjects.GameObject[] = [];
  private shellObjects: Phaser.GameObjects.GameObject[] = [];
  private modalObjects: Phaser.GameObjects.GameObject[] = [];
  private fakePlayers: FakePlayer[] = [];
  private fakeBomb!: Phaser.GameObjects.Arc;
  private fakeBombGlow!: Phaser.GameObjects.Arc;
  private fakeBombVelocity = new Phaser.Math.Vector2(270, -185);
  private nameValue!: Phaser.GameObjects.Text;
  private modalValueText?: Phaser.GameObjects.Text;
  private activeModal?: ActiveModal;

  constructor() {
    super("MenuScene");
  }

  create() {
    this.settings = loadSettings();
    this.settings.playerName = normalizePlayerName(this.settings.playerName);
    if (this.startFromUrlParams()) {
      return;
    }

    this.createGameplayBackdrop();
    this.createShell();
    this.showMainMenu();
    this.input.keyboard?.on("keydown", this.handleModalKey, this);
    this.events.once("shutdown", () => {
      this.input.keyboard?.off("keydown", this.handleModalKey, this);
    });
  }

  update(_time: number, delta: number) {
    this.updateGameplayBackdrop(delta / 1000);
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
    this.scene.start("LobbyScene", runtimeSettings);
    return true;
  }

  private createGameplayBackdrop() {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x090b10, 1);

    const arena = this.add.graphics();
    arena.fillStyle(0x14100d, 1);
    arena.fillRoundedRect(82, 74, 1116, 572, 18);
    arena.lineStyle(18, 0x704523, 0.62);
    arena.strokeRoundedRect(82, 74, 1116, 572, 18);
    arena.lineStyle(1, 0xffbf16, 0.055);
    for (let x = 146; x < 1160; x += 92) {
      arena.lineBetween(x, 92, x, 626);
    }
    for (let y = 136; y < 612; y += 92) {
      arena.lineBetween(102, y, 1180, y);
    }

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x05070a, 0.54);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x05070a, 0.18);

    this.fakePlayers = [
      this.createFakePlayer(260, 196, 0xffbf16, 130, 84),
      this.createFakePlayer(1020, 204, 0x27b8f2, -105, 92),
      this.createFakePlayer(960, 500, 0xff5048, -146, -68),
      this.createFakePlayer(374, 520, 0x8e58ff, 120, -104)
    ];

    this.fakeBombGlow = this.add.circle(640, 360, 34, 0xffbf16, 0.16);
    this.fakeBombGlow.setDepth(1);
    this.fakeBomb = this.add.circle(640, 360, 17, 0x101010, 0.88);
    this.fakeBomb.setStrokeStyle(3, 0xffbf16, 0.42);
    this.fakeBomb.setDepth(2);

    const veil = this.add.graphics();
    veil.fillStyle(0x05070a, 0.68);
    veil.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    veil.fillGradientStyle(0x05070a, 0x05070a, 0x05070a, 0x05070a, 0.94, 0.7, 0.36, 0.76);
    veil.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    veil.setDepth(4);
  }

  private createFakePlayer(x: number, y: number, color: number, velocityX: number, velocityY: number): FakePlayer {
    const wake = this.add.circle(x - 10, y + 12, 32, color, 0.08);
    wake.setScale(1.5, 0.8);
    wake.setDepth(1);
    const body = this.add.circle(x, y, 23, color, 0.68);
    body.setStrokeStyle(4, 0xffffff, 0.14);
    body.setDepth(2);
    const aim = this.add.rectangle(x + 30, y, 44, 7, color, 0.38);
    aim.setOrigin(0, 0.5);
    aim.setDepth(2);
    return {
      body,
      aim,
      wake,
      velocity: new Phaser.Math.Vector2(velocityX, velocityY)
    };
  }

  private updateGameplayBackdrop(deltaSeconds: number) {
    const left = 132;
    const right = GAME_WIDTH - 132;
    const top = 116;
    const bottom = GAME_HEIGHT - 116;

    for (const player of this.fakePlayers) {
      player.body.x += player.velocity.x * deltaSeconds;
      player.body.y += player.velocity.y * deltaSeconds;
      if (player.body.x < left || player.body.x > right) {
        player.velocity.x *= -1;
      }
      if (player.body.y < top || player.body.y > bottom) {
        player.velocity.y *= -1;
      }
      player.body.x = Phaser.Math.Clamp(player.body.x, left, right);
      player.body.y = Phaser.Math.Clamp(player.body.y, top, bottom);
      const angle = player.velocity.angle();
      player.aim.setPosition(player.body.x + Math.cos(angle) * 27, player.body.y + Math.sin(angle) * 27);
      player.aim.setRotation(angle);
      player.wake.setPosition(player.body.x - Math.cos(angle) * 18, player.body.y - Math.sin(angle) * 18);
      player.wake.setRotation(angle);
      player.wake.setAlpha(0.06 + Math.sin(this.time.now * 0.004) * 0.025);
    }

    this.fakeBomb.x += this.fakeBombVelocity.x * deltaSeconds;
    this.fakeBomb.y += this.fakeBombVelocity.y * deltaSeconds;
    if (this.fakeBomb.x < left || this.fakeBomb.x > right) {
      this.fakeBombVelocity.x *= -1;
    }
    if (this.fakeBomb.y < top || this.fakeBomb.y > bottom) {
      this.fakeBombVelocity.y *= -1;
    }
    this.fakeBomb.x = Phaser.Math.Clamp(this.fakeBomb.x, left, right);
    this.fakeBomb.y = Phaser.Math.Clamp(this.fakeBomb.y, top, bottom);
    this.fakeBombGlow.setPosition(this.fakeBomb.x, this.fakeBomb.y);
    this.fakeBombGlow.setAlpha(0.14 + Math.sin(this.time.now * 0.008) * 0.05);
  }

  private createShell() {
    for (const object of this.shellObjects) {
      object.destroy();
    }
    this.shellObjects = [];

    const dictionary = MENU_TEXT[this.settings.language];
    this.addShellText(GAME_WIDTH / 2, 82, "BOMB TAG", {
      color: "#ffbf16",
      fontFamily: "Impact, Haettenschweiler, Arial Black, sans-serif",
      fontSize: "86px",
      fontStyle: "900",
      stroke: "#05070a",
      strokeThickness: 9
    }).setOrigin(0.5, 0);

    this.addShellText(GAME_WIDTH / 2, 168, dictionary.tagline, {
      color: "#f7f8ff",
      fontFamily: "Arial Black, ui-sans-serif, system-ui",
      fontSize: "24px",
      fontStyle: "900 italic",
      stroke: "#05070a",
      strokeThickness: 5
    }).setOrigin(0.5);

    this.addShellText(28, 680, dictionary.version, {
      color: "#818a9a",
      fontFamily: "Arial Black, ui-sans-serif, system-ui",
      fontSize: "14px",
      fontStyle: "900"
    });
  }

  private showMainMenu() {
    this.setView("main");
    const dictionary = MENU_TEXT[this.settings.language];
    this.createNameField(442, 220);
    this.createMenuButton(450, 302, 380, 64, dictionary.start, () => this.startGame(), "primary");
    this.createMenuButton(450, 382, 380, 64, dictionary.multiplayer, () => this.showMultiplayerMenu(), "secondary");
    this.createMenuButton(450, 462, 380, 64, dictionary.settings, () => this.showSettingsMenu(), "secondary");
    this.createMenuButton(500, 542, 280, 52, dictionary.howToPlay, () => this.openHowToPlayModal(), "quiet");
  }

  private showMultiplayerMenu() {
    this.setView("multiplayer");
    const dictionary = MENU_TEXT[this.settings.language];
    this.createNameField(442, 220);
    this.createMenuButton(450, 314, 380, 64, dictionary.hostOnline, () => this.hostOnline(), "primary");
    this.createMenuButton(450, 394, 380, 64, dictionary.joinOnline, () => this.joinOnline(), "secondary");
    this.createMenuButton(500, 488, 280, 52, dictionary.back, () => this.showMainMenu(), "quiet");
    this.addViewText(GAME_WIDTH / 2, 570, hasFirebaseConfig() ? dictionary.firebaseReady : dictionary.firebaseMissing, {
      color: hasFirebaseConfig() ? "#00d8ff" : "#ff5d4f",
      fontFamily: "Arial Black, ui-sans-serif, system-ui",
      fontSize: "16px",
      fontStyle: "900"
    }).setOrigin(0.5);
  }

  private showSettingsMenu() {
    this.setView("settings");
    const dictionary = MENU_TEXT[this.settings.language];
    this.createNameField(442, 220);
    this.createSettingRow(450, 314, dictionary.language, this.settings.language === "en" ? "EN" : "PT", () => this.toggleLanguage());
    this.createSettingRow(450, 386, dictionary.volume, `${Math.round(this.settings.volume * 100)}%`, () => this.changeVolume(0.1));
    this.createSettingRow(450, 458, dictionary.debug, this.settings.debugMode ? dictionary.on : dictionary.off, () => this.toggleDebug());
    this.createMenuButton(500, 552, 280, 52, dictionary.back, () => this.showMainMenu(), "quiet");
  }

  private setView(view: MenuView) {
    this.view = view;
    for (const object of this.viewObjects) {
      object.destroy();
    }
    this.viewObjects = [];
  }

  private createNameField(x: number, y: number) {
    const dictionary = MENU_TEXT[this.settings.language];
    this.drawPanel(x, y, 396, 58, 0x071018, 0x00d8ff, 0.8);
    this.addViewText(x + 24, y + 10, dictionary.nameLabel, {
      color: "#8994a5",
      fontFamily: "Arial Black, ui-sans-serif, system-ui",
      fontSize: "12px",
      fontStyle: "900"
    });
    this.nameValue = this.addViewText(x + 24, y + 28, this.settings.playerName, {
      color: "#f7f8ff",
      fontFamily: "Arial Black, ui-sans-serif, system-ui",
      fontSize: "20px",
      fontStyle: "900"
    });
    const hitArea = this.add.zone(x + 198, y + 29, 396, 58);
    hitArea.setDepth(14);
    hitArea.setInteractive({ useHandCursor: true });
    hitArea.on("pointerdown", () => this.editPlayerName());
    this.viewObjects.push(hitArea);
  }

  private createSettingRow(x: number, y: number, label: string, value: string, onClick: () => void) {
    this.drawPanel(x, y, 380, 54, 0x071018, 0x263442, 0.76);
    this.addViewText(x + 24, y + 16, label, {
      color: "#f7f8ff",
      fontFamily: "Arial Black, ui-sans-serif, system-ui",
      fontSize: "18px",
      fontStyle: "900"
    });
    this.addViewText(x + 312, y + 16, value, {
      color: "#ffbf16",
      fontFamily: "Arial Black, ui-sans-serif, system-ui",
      fontSize: "18px",
      fontStyle: "900"
    }).setOrigin(0.5, 0);
    const hitArea = this.add.zone(x + 190, y + 27, 380, 54);
    hitArea.setDepth(14);
    hitArea.setInteractive({ useHandCursor: true });
    hitArea.on("pointerdown", onClick);
    this.viewObjects.push(hitArea);
  }

  private createMenuButton(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    onClick: () => void,
    variant: "primary" | "secondary" | "quiet"
  ) {
    const colors = this.getButtonColors(variant);
    const background = this.add.graphics();
    this.drawButtonShape(background, x, y, width, height, colors.fill, colors.stroke, 0.94);
    background.setDepth(12);
    this.viewObjects.push(background);

    const text = this.addViewText(x + width / 2, y + height / 2, label, {
      color: colors.text,
      fontFamily: "Impact, Arial Black, ui-sans-serif, system-ui",
      fontSize: variant === "primary" ? "36px" : "30px",
      fontStyle: "900 italic",
      stroke: variant === "primary" ? "#ffbf16" : "#05070a",
      strokeThickness: variant === "primary" ? 0 : 4
    }).setOrigin(0.5);
    text.setDepth(13);

    const hitArea = this.add.zone(x + width / 2, y + height / 2, width, height);
    hitArea.setDepth(14);
    hitArea.setInteractive({ useHandCursor: true });
    hitArea.on("pointerover", () => this.drawButtonShape(background, x, y, width, height, colors.hoverFill, colors.stroke, 1));
    hitArea.on("pointerout", () => this.drawButtonShape(background, x, y, width, height, colors.fill, colors.stroke, 0.94));
    hitArea.on("pointerdown", () => {
      background.setAlpha(0.86);
      text.setScale(0.96);
      onClick();
    });
    hitArea.on("pointerup", () => {
      background.setAlpha(1);
      text.setScale(1);
    });
    hitArea.on("pointerupoutside", () => {
      background.setAlpha(1);
      text.setScale(1);
    });
    this.viewObjects.push(hitArea);
  }

  private getButtonColors(variant: "primary" | "secondary" | "quiet"): ButtonColors {
    if (variant === "primary") {
      return {
        fill: 0xffbf16,
        stroke: 0xffe07a,
        hoverFill: 0xffd24d,
        text: "#071018"
      };
    }

    if (variant === "secondary") {
      return {
        fill: 0x071018,
        stroke: 0x00d8ff,
        hoverFill: 0x102535,
        text: "#f7f8ff"
      };
    }

    return {
      fill: 0x090d13,
      stroke: 0x56606f,
      hoverFill: 0x141b25,
      text: "#cbd2df"
    };
  }

  private drawPanel(x: number, y: number, width: number, height: number, fill: number, stroke: number, alpha: number) {
    const panel = this.add.graphics();
    panel.setDepth(11);
    const cut = 16;
    const points = [
      new Phaser.Geom.Point(x + cut, y),
      new Phaser.Geom.Point(x + width - cut, y),
      new Phaser.Geom.Point(x + width, y + cut),
      new Phaser.Geom.Point(x + width - cut, y + height),
      new Phaser.Geom.Point(x + cut, y + height),
      new Phaser.Geom.Point(x, y + height - cut),
      new Phaser.Geom.Point(x, y + cut)
    ];
    panel.fillStyle(fill, alpha);
    panel.fillPoints(points, true);
    panel.lineStyle(2, stroke, 0.72);
    panel.strokePoints(points, true, true);
    this.viewObjects.push(panel);
    return panel;
  }

  private drawButtonShape(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    width: number,
    height: number,
    fill: number,
    stroke: number,
    alpha: number
  ) {
    const cut = Math.min(24, height * 0.44);
    const points = [
      new Phaser.Geom.Point(x + cut, y),
      new Phaser.Geom.Point(x + width - 14, y),
      new Phaser.Geom.Point(x + width, y + 14),
      new Phaser.Geom.Point(x + width - cut, y + height),
      new Phaser.Geom.Point(x + 10, y + height),
      new Phaser.Geom.Point(x, y + height - 14),
      new Phaser.Geom.Point(x + cut, y)
    ];
    graphics.clear();
    graphics.fillStyle(fill, alpha);
    graphics.fillPoints(points, true);
    graphics.lineStyle(2, stroke, 0.95);
    graphics.strokePoints(points, true, true);
  }

  private addShellText(x: number, y: number, text: string, style: Phaser.Types.GameObjects.Text.TextStyle) {
    const object = this.add.text(x, y, text, style);
    object.setDepth(10);
    this.shellObjects.push(object);
    return object;
  }

  private addViewText(x: number, y: number, text: string, style: Phaser.Types.GameObjects.Text.TextStyle) {
    const object = this.add.text(x, y, text, style);
    object.setDepth(13);
    this.viewObjects.push(object);
    return object;
  }

  private editPlayerName() {
    const dictionary = MENU_TEXT[this.settings.language];
    this.openTextModal(dictionary.promptName, this.settings.playerName, 14, (value) => value, (value) => {
      this.settings.playerName = normalizePlayerName(value);
      saveSettings(this.settings);
      this.nameValue.setText(this.settings.playerName);
    });
  }

  private openHowToPlayModal() {
    this.closeModal();
    const dictionary = MENU_TEXT[this.settings.language];
    const blocker = this.add.zone(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT);
    blocker.setDepth(30);
    blocker.setInteractive();
    this.modalObjects.push(blocker);

    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020407, 0.76);
    overlay.setDepth(30);
    this.modalObjects.push(overlay);

    const panel = this.add.graphics();
    panel.setDepth(31);
    this.drawModalPanel(panel, 290, 74, 700, 572);
    this.modalObjects.push(panel);

    this.addModalText(GAME_WIDTH / 2, 108, dictionary.howToPlayTitle, {
      color: "#ffbf16",
      fontFamily: "Arial Black, ui-sans-serif, system-ui",
      fontSize: "30px",
      fontStyle: "900"
    }).setOrigin(0.5);

    const body = dictionary.howToPlayLines.map((line, index) => `${index + 1}. ${line}`).join("\n\n");
    this.addModalText(342, 148, body, {
      color: "#f7f8ff",
      fontFamily: "Arial Black, ui-sans-serif, system-ui",
      fontSize: "13px",
      fontStyle: "900",
      lineSpacing: 4,
      wordWrap: { width: 596 }
    });

    this.createModalButton(GAME_WIDTH / 2 - 90, 584, 180, 44, dictionary.ok, () => this.closeModal(), "primary");
  }

  private openTextModal(
    title: string,
    initialValue: string,
    maxLength: number,
    transform: (value: string) => string,
    submit: (value: string) => void
  ) {
    this.closeModal();
    const dictionary = MENU_TEXT[this.settings.language];
    this.activeModal = {
      value: transform(initialValue).slice(0, maxLength),
      maxLength,
      transform,
      submit
    };

    const blocker = this.add.zone(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT);
    blocker.setDepth(30);
    blocker.setInteractive();
    this.modalObjects.push(blocker);

    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020407, 0.72);
    overlay.setDepth(30);
    this.modalObjects.push(overlay);

    const panel = this.add.graphics();
    panel.setDepth(31);
    this.drawModalPanel(panel, 390, 224, 500, 252);
    this.modalObjects.push(panel);

    this.addModalText(GAME_WIDTH / 2, 254, title.toUpperCase(), {
      color: "#ffbf16",
      fontFamily: "Arial Black, ui-sans-serif, system-ui",
      fontSize: "26px",
      fontStyle: "900"
    }).setOrigin(0.5);

    const field = this.add.rectangle(GAME_WIDTH / 2, 336, 390, 58, 0x071018, 0.96);
    field.setStrokeStyle(2, 0x00d8ff, 0.8);
    field.setDepth(32);
    this.modalObjects.push(field);

    this.modalValueText = this.addModalText(452, 319, this.activeModal.value, {
      color: "#f7f8ff",
      fontFamily: "Arial Black, ui-sans-serif, system-ui",
      fontSize: "24px",
      fontStyle: "900"
    });
    this.refreshModalValue();

    this.createModalButton(440, 398, 150, 46, dictionary.cancel, () => this.closeModal(), "quiet");
    this.createModalButton(690, 398, 150, 46, dictionary.ok, () => this.submitModal(), "primary");
  }

  private handleModalKey(event: KeyboardEvent) {
    if (!this.activeModal) {
      return;
    }

    event.preventDefault();
    if (event.key === "Enter") {
      this.submitModal();
      return;
    }
    if (event.key === "Escape") {
      this.closeModal();
      return;
    }
    if (event.key === "Backspace") {
      this.activeModal.value = this.activeModal.value.slice(0, -1);
      this.refreshModalValue();
      return;
    }
    if (event.key.length !== 1 || this.activeModal.value.length >= this.activeModal.maxLength) {
      return;
    }

    const nextValue = this.activeModal.transform(this.activeModal.value + event.key);
    this.activeModal.value = nextValue.slice(0, this.activeModal.maxLength);
    this.refreshModalValue();
  }

  private refreshModalValue() {
    if (!this.activeModal || !this.modalValueText) {
      return;
    }

    this.modalValueText.setText(this.activeModal.value || "_");
    this.modalValueText.setColor(this.activeModal.value ? "#f7f8ff" : "#56606f");
  }

  private submitModal() {
    if (!this.activeModal) {
      return;
    }

    const value = this.activeModal.value.trim();
    if (!value) {
      this.refreshModalValue();
      return;
    }

    const submit = this.activeModal.submit;
    this.closeModal();
    submit(value);
  }

  private closeModal() {
    for (const object of this.modalObjects) {
      object.destroy();
    }
    this.modalObjects = [];
    this.modalValueText = undefined;
    this.activeModal = undefined;
  }

  private drawModalPanel(graphics: Phaser.GameObjects.Graphics, x: number, y: number, width: number, height: number) {
    const cut = 28;
    const points = [
      new Phaser.Geom.Point(x + cut, y),
      new Phaser.Geom.Point(x + width - 18, y),
      new Phaser.Geom.Point(x + width, y + 18),
      new Phaser.Geom.Point(x + width - cut, y + height),
      new Phaser.Geom.Point(x + 18, y + height),
      new Phaser.Geom.Point(x, y + height - 18),
      new Phaser.Geom.Point(x, y + cut)
    ];
    graphics.fillStyle(0x090d13, 0.96);
    graphics.fillPoints(points, true);
    graphics.lineStyle(3, 0xffbf16, 0.9);
    graphics.strokePoints(points, true, true);
    graphics.lineStyle(1, 0x00d8ff, 0.35);
    graphics.strokePoints(points.map((point) => new Phaser.Geom.Point(point.x + 5, point.y + 5)), true, true);
  }

  private createModalButton(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    onClick: () => void,
    variant: "primary" | "quiet"
  ) {
    const colors = this.getButtonColors(variant);
    const background = this.add.graphics();
    background.setDepth(32);
    this.drawButtonShape(background, x, y, width, height, colors.fill, colors.stroke, 0.96);
    this.modalObjects.push(background);

    this.addModalText(x + width / 2, y + height / 2, label, {
      color: colors.text,
      fontFamily: "Impact, Arial Black, ui-sans-serif, system-ui",
      fontSize: "22px",
      fontStyle: "900 italic"
    }).setOrigin(0.5);

    const hitArea = this.add.zone(x + width / 2, y + height / 2, width, height);
    hitArea.setDepth(34);
    hitArea.setInteractive({ useHandCursor: true });
    hitArea.on("pointerover", () => this.drawButtonShape(background, x, y, width, height, colors.hoverFill, colors.stroke, 1));
    hitArea.on("pointerout", () => this.drawButtonShape(background, x, y, width, height, colors.fill, colors.stroke, 0.96));
    hitArea.on("pointerdown", onClick);
    this.modalObjects.push(hitArea);
  }

  private addModalText(x: number, y: number, text: string, style: Phaser.Types.GameObjects.Text.TextStyle) {
    const object = this.add.text(x, y, text, style);
    object.setDepth(33);
    this.modalObjects.push(object);
    return object;
  }

  private toggleLanguage() {
    this.settings.language = this.settings.language === "en" ? "pt" : "en";
    saveSettings(this.settings);
    this.createShell();
    if (this.view === "settings") {
      this.showSettingsMenu();
      return;
    }
    if (this.view === "multiplayer") {
      this.showMultiplayerMenu();
      return;
    }
    this.showMainMenu();
  }

  private changeVolume(amount: number) {
    const nextVolume = this.settings.volume >= 1 ? 0 : this.settings.volume + amount;
    this.settings.volume = Math.round(Math.min(1, Math.max(0, nextVolume)) * 10) / 10;
    saveSettings(this.settings);
    this.showSettingsMenu();
  }

  private toggleDebug() {
    this.settings.debugMode = !this.settings.debugMode;
    saveSettings(this.settings);
    this.showSettingsMenu();
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
      playerId: createPlayerId()
    };
    saveSettings(this.settings);
    this.scene.start("LobbyScene", this.settings);
  }

  private joinOnline() {
    const dictionary = MENU_TEXT[this.settings.language];
    this.openTextModal(dictionary.promptRoom, "", 5, (value) => (
      value.toUpperCase().replace(/[^A-Z0-9]/g, "")
    ), (code) => {
      this.settings.online = {
        enabled: true,
        role: "guest",
        roomCode: code,
        playerId: createPlayerId()
      };
      saveSettings(this.settings);
      this.scene.start("LobbyScene", this.settings);
    });
  }

  private createRoomCode() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    return Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  }
}
