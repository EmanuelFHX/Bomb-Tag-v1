import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { hasFirebaseConfig } from "../online/firebaseClient";
import { LobbyRoomClient } from "../online/LobbyRoomClient";
import type { OnlinePlayerSnapshot, OnlineRoomSnapshot } from "../online/onlineTypes";
import { createPlayerId, GameSettings, loadSettings, saveSettings } from "../settings";

const LOBBY_TEXT = {
  en: {
    title: "ROOM LOBBY",
    subtitleHost: "Share the code and start when everyone is ready.",
    subtitleGuest: "Waiting for the host to start the match.",
    roomCode: "ROOM CODE",
    copy: "COPY",
    copied: "COPIED",
    start: "START MATCH",
    leave: "BACK",
    players: "PLAYERS",
    waiting: "WAITING",
    connecting: "CONNECTING...",
    missingFirebase: "FIREBASE OFF",
    notFound: "ROOM NOT FOUND",
    hostBadge: "HOST",
    youBadge: "YOU"
  },
  pt: {
    title: "LOBBY DA SALA",
    subtitleHost: "Compartilhe o codigo e inicie quando todos estiverem prontos.",
    subtitleGuest: "Aguardando o host iniciar a partida.",
    roomCode: "CODIGO DA SALA",
    copy: "COPIAR",
    copied: "COPIADO",
    start: "INICIAR PARTIDA",
    leave: "VOLTAR",
    players: "JOGADORES",
    waiting: "AGUARDANDO",
    connecting: "CONECTANDO...",
    missingFirebase: "FIREBASE OFF",
    notFound: "SALA NAO ENCONTRADA",
    hostBadge: "HOST",
    youBadge: "VOCE"
  }
} as const;

type ButtonColors = {
  fill: number;
  stroke: number;
  hoverFill: number;
};

export class LobbyScene extends Phaser.Scene {
  private settings: GameSettings = loadSettings();
  private client?: LobbyRoomClient;
  private statusLabel!: Phaser.GameObjects.Text;
  private copyLabel!: Phaser.GameObjects.Text;
  private playerRows: Phaser.GameObjects.Container[] = [];
  private starting = false;
  private leavingForGame = false;
  private currentHostId = "";

  constructor() {
    super("LobbyScene");
  }

  create(settings?: GameSettings) {
    this.settings = settings ?? loadSettings();
    if (!this.settings.online.playerId) {
      this.settings.online.playerId = createPlayerId();
    }

    this.drawBackground();
    this.drawFrame();
    this.createHeader();
    this.createRoomPanel();
    this.createPlayersPanel();
    this.createActions();
    this.connectLobby();

    this.events.once("shutdown", () => {
      if (!this.leavingForGame) {
        this.client?.disconnect();
      }
      this.client = undefined;
    });
  }

  private drawBackground() {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x05070a, 1);
    const graphics = this.add.graphics();
    for (let index = 0; index < 80; index += 1) {
      graphics.fillStyle(index % 5 === 0 ? 0xffbf16 : 0x1b2734, Phaser.Math.FloatBetween(0.04, 0.12));
      graphics.fillRect(
        Phaser.Math.Between(40, GAME_WIDTH - 40),
        Phaser.Math.Between(36, GAME_HEIGHT - 36),
        Phaser.Math.Between(2, 6),
        Phaser.Math.Between(1, 4)
      );
    }
  }

  private drawFrame() {
    const frame = this.add.graphics();
    frame.lineStyle(3, 0xffbf16, 1);
    frame.strokePoints([
      new Phaser.Geom.Point(34, 42),
      new Phaser.Geom.Point(82, 20),
      new Phaser.Geom.Point(1194, 20),
      new Phaser.Geom.Point(1248, 74),
      new Phaser.Geom.Point(1248, 646),
      new Phaser.Geom.Point(1200, 696),
      new Phaser.Geom.Point(82, 696),
      new Phaser.Geom.Point(34, 646)
    ], true, true);
  }

  private createHeader() {
    const dictionary = LOBBY_TEXT[this.settings.language];
    this.add.text(88, 76, dictionary.title, {
      color: "#ffbf16",
      fontFamily: "Impact, Haettenschweiler, Arial Black, sans-serif",
      fontSize: "68px",
      fontStyle: "900",
      stroke: "#05070a",
      strokeThickness: 8
    });
    this.add.text(92, 148, this.settings.online.role === "host" ? dictionary.subtitleHost : dictionary.subtitleGuest, {
      color: "#cbd2df",
      fontFamily: "Arial Black, ui-sans-serif, system-ui",
      fontSize: "18px",
      fontStyle: "900"
    });
  }

  private createRoomPanel() {
    const dictionary = LOBBY_TEXT[this.settings.language];
    this.drawAngledPanel(90, 220, 520, 180, 0x080d13, 0x00d8ff, 0.92, 0.86);
    this.add.text(126, 248, dictionary.roomCode, this.labelStyle("#8994a5", "18px"));
    this.add.text(126, 286, this.settings.online.roomCode || "-----", {
      color: "#00d8ff",
      fontFamily: "Arial Black, ui-sans-serif, system-ui",
      fontSize: "58px",
      fontStyle: "900"
    });

    const copyButton = this.createButton(126, 344, 150, 46, {
      fill: 0x071018,
      stroke: 0x00d8ff,
      hoverFill: 0x102535
    }, () => this.copyCode());
    this.copyLabel = this.add.text(0, 0, dictionary.copy, this.buttonTextStyle("#f7f8ff", "18px")).setOrigin(0.5);
    copyButton.add(this.copyLabel);

    this.statusLabel = this.add.text(316, 354, dictionary.connecting, this.labelStyle("#ffbf16", "18px"));
  }

  private createPlayersPanel() {
    const dictionary = LOBBY_TEXT[this.settings.language];
    this.drawAngledPanel(682, 162, 500, 402, 0x080d13, 0xffbf16, 0.9, 0.86);
    this.add.text(724, 202, dictionary.players, {
      color: "#ffbf16",
      fontFamily: "Arial Black, ui-sans-serif, system-ui",
      fontSize: "28px",
      fontStyle: "900"
    });
  }

  private createActions() {
    const dictionary = LOBBY_TEXT[this.settings.language];
    if (this.settings.online.role === "host") {
      const startButton = this.createButton(90, 448, 370, 72, {
        fill: 0xffbf16,
        stroke: 0xffe07a,
        hoverFill: 0xffd24d
      }, () => this.startMatch());
      startButton.add(this.add.text(0, 0, dictionary.start, this.buttonTextStyle("#071018", "32px")).setOrigin(0.5));
    }

    const backButton = this.createButton(90, 548, 180, 54, {
      fill: 0x0b1219,
      stroke: 0x6f7886,
      hoverFill: 0x151c26
    }, () => this.leaveLobby());
    backButton.add(this.add.text(0, 0, dictionary.leave, this.buttonTextStyle("#f7f8ff", "20px")).setOrigin(0.5));
  }

  private connectLobby() {
    const dictionary = LOBBY_TEXT[this.settings.language];
    if (!hasFirebaseConfig() || !this.settings.online.roomCode) {
      this.statusLabel.setText(dictionary.missingFirebase);
      return;
    }

    this.client = new LobbyRoomClient({
      roomCode: this.settings.online.roomCode,
      playerId: this.settings.online.playerId,
      playerName: this.settings.playerName,
      playerColor: this.settings.online.role === "host" ? 0x3dc8ff : 0xff5d4f,
      isHost: this.settings.online.role === "host",
      onError: () => this.statusLabel.setText(dictionary.missingFirebase)
    });

    void this.client.connect((room) => this.applyRoom(room)).catch(() => {
      this.statusLabel.setText(dictionary.missingFirebase);
    });
  }

  private applyRoom(room: OnlineRoomSnapshot | null) {
    const dictionary = LOBBY_TEXT[this.settings.language];
    if (!room) {
      this.statusLabel.setText(dictionary.notFound);
      this.renderPlayers([]);
      return;
    }

    if (room.status === "playing" && !this.starting) {
      this.starting = true;
      this.leavingForGame = true;
      saveSettings(this.settings);
      this.scene.start("GameScene", this.settings);
      return;
    }

    this.currentHostId = room.hostId;
    const players = Object.values(room.players ?? {})
      .filter(Boolean)
      .sort((left, right) => {
        if (left.id === this.currentHostId) {
          return -1;
        }
        if (right.id === this.currentHostId) {
          return 1;
        }
        return left.name.localeCompare(right.name);
      });
    this.statusLabel.setText(`${dictionary.waiting} ${players.length}/8`);
    this.renderPlayers(players);
  }

  private renderPlayers(players: OnlinePlayerSnapshot[]) {
    const dictionary = LOBBY_TEXT[this.settings.language];
    for (const row of this.playerRows) {
      row.destroy(true);
    }
    this.playerRows = [];

    players.slice(0, 8).forEach((player, index) => {
      const y = 262 + index * 36;
      const row = this.add.container(724, y);
      const isLocal = player.id === this.settings.online.playerId;
      const isHost = player.id === this.currentHostId;
      row.add(this.add.circle(0, 9, 8, player.color || 0x00d8ff, 1));
      row.add(this.add.text(26, -5, isLocal ? this.settings.playerName : player.name, this.labelStyle("#f7f8ff", "18px")));
      row.add(this.add.text(248, -3, isHost ? dictionary.hostBadge : "", this.labelStyle("#ffbf16", "14px")));
      this.playerRows.push(row);
    });
  }

  private copyCode() {
    const dictionary = LOBBY_TEXT[this.settings.language];
    const code = this.settings.online.roomCode;
    if (!code) {
      return;
    }

    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(code).catch(() => undefined);
    }

    this.copyLabel.setText(dictionary.copied);
    this.time.delayedCall(1200, () => this.copyLabel.setText(dictionary.copy));
  }

  private startMatch() {
    if (!this.client || this.starting) {
      return;
    }

    this.starting = true;
    this.leavingForGame = true;
    saveSettings(this.settings);
    if (!this.client.startMatch()) {
      this.starting = false;
      this.statusLabel.setText(LOBBY_TEXT[this.settings.language].missingFirebase);
      return;
    }

    this.scene.start("GameScene", this.settings);
  }

  private leaveLobby() {
    this.client?.disconnect();
    this.settings.online.enabled = false;
    saveSettings(this.settings);
    this.scene.start("MenuScene");
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
  }

  private drawAngledPanel(x: number, y: number, width: number, height: number, fill: number, stroke: number, fillAlpha: number, strokeAlpha: number) {
    const cut = 24;
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
  }

  private labelStyle(color: string, size: string): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      color,
      fontFamily: "Arial Black, ui-sans-serif, system-ui",
      fontSize: size,
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
}
