import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { GameSettings, loadSettings, saveSettings } from "../settings";

const MENU_TEXT = {
  en: {
    title: "BOMB TAG",
    subtitle: "8 enter. 1 leaves.",
    start: "Start match",
    language: "Language",
    volume: "Volume",
    debug: "Debug mode",
    on: "ON",
    off: "OFF",
    controlsTitle: "Controls",
    controls: [
      "WASD move",
      "Mouse aim",
      "Left click throw/shoot",
      "Shift/Space dash",
      "R rematch"
    ],
    debugHint: "Enables the 4P skip button in-match."
  },
  pt: {
    title: "BOMB TAG",
    subtitle: "8 entram. 1 sai.",
    start: "Iniciar partida",
    language: "Idioma",
    volume: "Volume",
    debug: "Modo debug",
    on: "ON",
    off: "OFF",
    controlsTitle: "Controles",
    controls: [
      "WASD mover",
      "Mouse mirar",
      "Clique esquerdo lancar/atirar",
      "Shift/Espaco dash",
      "R revanche"
    ],
    debugHint: "Ativa o botao 4P durante a partida."
  }
} as const;

export class MenuScene extends Phaser.Scene {
  private settings: GameSettings = loadSettings();
  private languageValue!: Phaser.GameObjects.Text;
  private volumeValue!: Phaser.GameObjects.Text;
  private debugValue!: Phaser.GameObjects.Text;
  private controlsText!: Phaser.GameObjects.Text;
  private subtitle!: Phaser.GameObjects.Text;
  private startLabel!: Phaser.GameObjects.Text;
  private controlsTitle!: Phaser.GameObjects.Text;
  private debugHint!: Phaser.GameObjects.Text;
  private languageLabel!: Phaser.GameObjects.Text;
  private volumeLabel!: Phaser.GameObjects.Text;
  private debugLabel!: Phaser.GameObjects.Text;

  constructor() {
    super("MenuScene");
  }

  create() {
    this.settings = loadSettings();
    this.drawBackground();
    this.createTitle();
    this.createControls();
    this.refreshText();
  }

  private drawBackground() {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x121017, 1);

    const arena = this.add.graphics();
    arena.fillStyle(0x19120f, 1);
    arena.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    arena.lineStyle(18, 0x704523, 0.88);
    arena.strokePoints([
      new Phaser.Geom.Point(188, 86),
      new Phaser.Geom.Point(1092, 86),
      new Phaser.Geom.Point(1186, 170),
      new Phaser.Geom.Point(1186, 552),
      new Phaser.Geom.Point(1092, 634),
      new Phaser.Geom.Point(188, 634),
      new Phaser.Geom.Point(94, 552),
      new Phaser.Geom.Point(94, 170)
    ], true, true);

    this.add.circle(220, 190, 44, 0xff5d4f, 0.16);
    this.add.circle(1060, 520, 58, 0x86f7ff, 0.12);
  }

  private createTitle() {
    this.add.text(108, 88, "BOMB TAG", {
      color: "#ffcf33",
      fontFamily: "ui-sans-serif, system-ui",
      fontSize: "76px",
      fontStyle: "900",
      stroke: "#0c0f16",
      strokeThickness: 8
    });

    this.subtitle = this.add.text(114, 170, "", {
      color: "#f7f8ff",
      fontFamily: "ui-sans-serif, system-ui",
      fontSize: "23px",
      fontStyle: "800"
    });
  }

  private createControls() {
    const startButton = this.createButton(116, 256, 340, 58, 0xffcf33, () => this.startGame());
    this.startLabel = this.add.text(0, -13, "", {
      color: "#15110b",
      fontFamily: "ui-sans-serif, system-ui",
      fontSize: "23px",
      fontStyle: "900"
    }).setOrigin(0.5, 0);
    startButton.add(this.startLabel);

    this.languageLabel = this.add.text(118, 358, "", this.labelStyle());
    this.languageValue = this.add.text(360, 358, "", this.valueStyle()).setOrigin(0.5, 0);
    this.createButton(512, 344, 74, 38, 0x86f7ff, () => this.toggleLanguage()).add(
      this.add.text(0, -9, "<>", this.valueStyle()).setOrigin(0.5, 0)
    );

    this.volumeLabel = this.add.text(118, 422, "", this.labelStyle());
    this.createButton(318, 410, 44, 36, 0x86f7ff, () => this.changeVolume(-0.1)).add(
      this.add.text(0, -10, "-", this.valueStyle()).setOrigin(0.5, 0)
    );
    this.volumeValue = this.add.text(390, 422, "", this.valueStyle()).setOrigin(0.5, 0);
    this.createButton(462, 410, 44, 36, 0x86f7ff, () => this.changeVolume(0.1)).add(
      this.add.text(0, -10, "+", this.valueStyle()).setOrigin(0.5, 0)
    );

    this.debugLabel = this.add.text(118, 486, "", this.labelStyle());
    this.debugValue = this.add.text(390, 486, "", this.valueStyle()).setOrigin(0.5, 0);
    this.createButton(512, 472, 74, 38, 0xffcf33, () => this.toggleDebug()).add(
      this.add.text(0, -9, "<>", this.valueStyle()).setOrigin(0.5, 0)
    );

    this.controlsTitle = this.add.text(746, 250, "", {
      color: "#ffcf33",
      fontFamily: "ui-sans-serif, system-ui",
      fontSize: "24px",
      fontStyle: "900"
    });
    this.controlsText = this.add.text(746, 300, "", {
      color: "#f7f8ff",
      fontFamily: "ui-sans-serif, system-ui",
      fontSize: "19px",
      fontStyle: "800",
      lineSpacing: 16
    });
    this.debugHint = this.add.text(118, 536, "", {
      color: "#b9bfcd",
      fontFamily: "ui-sans-serif, system-ui",
      fontSize: "14px",
      fontStyle: "700"
    });
  }

  private createButton(x: number, y: number, width: number, height: number, color: number, onClick: () => void) {
    const background = this.add.rectangle(0, 0, width, height, 0x171b24, 0.94);
    background.setStrokeStyle(2, color, 0.78);
    const button = this.add.container(x + width / 2, y + height / 2, [background]);
    button.setSize(width, height);
    button.setInteractive({ useHandCursor: true });
    button.on("pointerover", () => background.setFillStyle(0x202637, 0.98));
    button.on("pointerout", () => background.setFillStyle(0x171b24, 0.94));
    button.on("pointerdown", onClick);
    return button;
  }

  private refreshText() {
    const dictionary = MENU_TEXT[this.settings.language];
    this.subtitle.setText(dictionary.subtitle);
    this.startLabel.setText(dictionary.start);
    this.languageLabel.setText(dictionary.language);
    this.languageValue.setText(this.settings.language === "en" ? "EN" : "PT");
    this.volumeLabel.setText(dictionary.volume);
    this.volumeValue.setText(`${Math.round(this.settings.volume * 100)}%`);
    this.debugLabel.setText(dictionary.debug);
    this.debugValue.setText(this.settings.debugMode ? dictionary.on : dictionary.off);
    this.debugValue.setColor(this.settings.debugMode ? "#ffcf33" : "#f7f8ff");
    this.controlsTitle.setText(dictionary.controlsTitle);
    this.controlsText.setText(dictionary.controls.join("\n"));
    this.debugHint.setText(dictionary.debugHint);
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
    saveSettings(this.settings);
    this.scene.start("GameScene", this.settings);
  }

  private labelStyle(): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      color: "#b9bfcd",
      fontFamily: "ui-sans-serif, system-ui",
      fontSize: "18px",
      fontStyle: "800"
    };
  }

  private valueStyle(): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      color: "#f7f8ff",
      fontFamily: "ui-sans-serif, system-ui",
      fontSize: "18px",
      fontStyle: "900"
    };
  }
}
