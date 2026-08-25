import Phaser from "phaser";
import { BootScene } from "./game/scenes/BootScene";
import { GameScene } from "./game/scenes/GameScene";
import { MenuScene } from "./game/scenes/MenuScene";
import "./ui/styles.css";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.CANVAS,
  parent: "app",
  backgroundColor: "#15171d",
  fps: {
    target: 60,
    min: 30
  },
  render: {
    antialias: false,
    roundPixels: true
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280,
    height: 720
  },
  scene: [BootScene, MenuScene, GameScene],
  physics: {
    default: "arcade",
    arcade: {
      debug: false
    }
  }
};

new Phaser.Game(config);
