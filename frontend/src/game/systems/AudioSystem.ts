import type { BombState } from "../entities/Bomb";
import type { Player } from "../entities/Player";

type HitSoundContext = {
  nextOwner: Player;
  previousOwner: Player;
  bombState: BombState;
  ricochets: number;
  remainingSeconds: number;
  human: Player;
};

type BeepOptions = {
  frequency: number;
  duration: number;
  gain: number;
  type?: OscillatorType;
  delay?: number;
};

export class AudioSystem {
  private context?: AudioContext;
  private master?: GainNode;
  private nextTickAt = 0;
  private tickFlip = false;

  unlock() {
    const context = this.getContext();
    if (context.state === "suspended") {
      void context.resume();
    }
  }

  playHit(context: HitSoundContext) {
    this.unlock();

    if (context.remainingSeconds < 1) {
      this.playPerfectHit();
      return;
    }

    if (context.nextOwner === context.human) {
      this.playYouWereHit();
      return;
    }

    if (context.bombState === "RETURNING") {
      this.playReturnHit();
      return;
    }

    if (context.ricochets > 0) {
      this.playRicochetHit();
      return;
    }

    this.playDirectHit(context.previousOwner === context.human);
  }

  updateTimer(remainingSeconds: number, isActive: boolean) {
    if (!isActive || remainingSeconds > 3 || remainingSeconds <= 0) {
      return;
    }

    const now = performance.now();
    const interval = remainingSeconds < 1 ? 180 : remainingSeconds < 2 ? 280 : 430;
    if (now < this.nextTickAt) {
      return;
    }

    this.nextTickAt = now + interval;
    this.tickFlip = !this.tickFlip;
    this.beep({
      frequency: this.tickFlip ? 520 : 390,
      duration: remainingSeconds < 1 ? 0.055 : 0.045,
      gain: remainingSeconds < 1 ? 0.12 : 0.075,
      type: "square"
    });
  }

  resetTimerTicks() {
    this.nextTickAt = 0;
    this.tickFlip = false;
  }

  playWeaponPickup() {
    this.unlock();
    this.beep({ frequency: 760, duration: 0.045, gain: 0.1, type: "sine" });
    this.beep({ frequency: 1040, duration: 0.06, gain: 0.09, type: "triangle", delay: 0.045 });
  }

  playWeaponShot() {
    this.unlock();
    this.beep({ frequency: 980, duration: 0.04, gain: 0.11, type: "square" });
    this.beep({ frequency: 420, duration: 0.055, gain: 0.07, type: "triangle", delay: 0.025 });
  }

  playShotDamage(isHumanTarget: boolean) {
    this.unlock();
    this.beep({ frequency: isHumanTarget ? 180 : 520, duration: 0.075, gain: 0.13, type: "sawtooth" });
    this.beep({ frequency: isHumanTarget ? 130 : 700, duration: 0.085, gain: 0.09, type: "triangle", delay: 0.055 });
  }

  private playDirectHit(byHuman: boolean) {
    const gain = byHuman ? 0.18 : 0.12;
    this.beep({ frequency: 660, duration: 0.075, gain, type: "triangle" });
    this.beep({ frequency: 880, duration: 0.09, gain: gain * 0.85, type: "triangle", delay: 0.055 });
  }

  private playYouWereHit() {
    this.beep({ frequency: 210, duration: 0.11, gain: 0.17, type: "sawtooth" });
    this.beep({ frequency: 150, duration: 0.13, gain: 0.13, type: "triangle", delay: 0.075 });
  }

  private playRicochetHit() {
    this.playDirectHit(false);
    this.beep({ frequency: 1320, duration: 0.045, gain: 0.12, type: "square", delay: 0.11 });
  }

  private playReturnHit() {
    this.beep({ frequency: 820, duration: 0.09, gain: 0.15, type: "triangle" });
    this.beep({ frequency: 1120, duration: 0.12, gain: 0.11, type: "sine", delay: 0.065 });
  }

  private playPerfectHit() {
    this.beep({ frequency: 520, duration: 0.08, gain: 0.18, type: "square" });
    this.beep({ frequency: 980, duration: 0.095, gain: 0.17, type: "triangle", delay: 0.045 });
    this.beep({ frequency: 1480, duration: 0.08, gain: 0.13, type: "sine", delay: 0.12 });
  }

  private beep(options: BeepOptions) {
    const context = this.getContext();
    const master = this.getMaster();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const startAt = context.currentTime + (options.delay ?? 0);
    const endAt = startAt + options.duration;

    oscillator.type = options.type ?? "sine";
    oscillator.frequency.setValueAtTime(options.frequency, startAt);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(options.gain, startAt + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, endAt);

    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(startAt);
    oscillator.stop(endAt + 0.02);
  }

  private getContext() {
    this.context ??= new AudioContext();
    return this.context;
  }

  private getMaster() {
    const context = this.getContext();

    if (!this.master) {
      this.master = context.createGain();
      this.master.gain.value = 0.22;
      this.master.connect(context.destination);
    }

    return this.master;
  }
}
