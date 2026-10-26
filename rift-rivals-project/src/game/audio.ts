import type { Sfx } from "./moves";

class GameAudio {
  private context: AudioContext | null = null;
  enabled = true;

  unlock() {
    if (!this.enabled) return;
    try {
      this.context ??= new AudioContext();
      if (this.context.state === "suspended")
        void this.context.resume().catch(() => {});
    } catch {
      /* Audio is an enhancement; unsupported browsers remain playable. */
    }
  }

  tone(
    frequency: number,
    duration: number,
    type: OscillatorType = "sine",
    volume = 0.08,
    endFrequency?: number,
    delay = 0,
  ) {
    const ctx = this.context;
    if (!this.enabled || !ctx || ctx.state !== "running") return;
    const now = ctx.currentTime + delay;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    if (endFrequency)
      oscillator.frequency.exponentialRampToValueAtTime(
        endFrequency,
        now + duration,
      );
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }

  click() {
    this.tone(600, 0.07, "triangle", 0.035, 900);
  }
  swing(sfx: Sfx = "slash", heavy = false) {
    const v = heavy ? 0.034 : 0.024;
    if (sfx === "blunt") this.tone(120, 0.13, "sawtooth", v, 42);
    else if (sfx === "pierce") this.tone(360, 0.07, "sawtooth", v * 0.9, 150);
    else if (sfx === "punch") this.tone(240, 0.06, "square", v * 0.8, 90);
    else if (sfx === "magic") this.tone(520, 0.16, "sine", v, 180);
    else this.tone(heavy ? 150 : 190, 0.09, "sawtooth", v, 50);
  }
  /** Impact timbre follows the weapon so every move reads by ear. */
  hit(heavy = false, sfx: Sfx = "slash") {
    const body: Record<Sfx, [number, number, OscillatorType]> = {
      slash: [160, 0.11, "square"],
      blunt: [92, 0.2, "sawtooth"],
      pierce: [210, 0.09, "square"],
      punch: [130, 0.1, "square"],
      shot: [240, 0.08, "sawtooth"],
      magic: [180, 0.16, "sine"],
    };
    const [freq, dur, type] = body[sfx];
    this.tone(
      heavy ? freq * 0.65 : freq,
      heavy ? dur * 1.5 : dur,
      type,
      0.055,
      35,
    );
    this.tone(
      sfx === "magic" ? 1040 : 780,
      0.065,
      sfx === "blunt" ? "square" : "triangle",
      0.035,
      160,
    );
  }
  /** Rising pitch as a light-attack chain builds toward its finisher. */
  chain(step: number) {
    this.tone(520 + step * 120, 0.05, "triangle", 0.022, 760 + step * 140);
  }
  spikeLand() {
    this.tone(70, 0.26, "sawtooth", 0.07, 28);
    this.tone(320, 0.1, "square", 0.03, 60);
  }
  swap() {
    this.tone(640, 0.06, "triangle", 0.045, 960);
    this.tone(320, 0.09, "sawtooth", 0.035, 680, 0.03);
  }
  jump() {
    this.tone(180, 0.13, "triangle", 0.025, 440);
  }
  recovery() {
    this.tone(220, 0.22, "sawtooth", 0.035, 800);
    this.tone(620, 0.18, "triangle", 0.025, 1000);
  }
  dodge() {
    this.tone(520, 0.15, "sawtooth", 0.025, 110);
  }
  shot() {
    this.tone(850, 0.12, "sawtooth", 0.025, 160);
  }
  charge() {
    [440, 554, 660].forEach((f, i) =>
      this.tone(f, 0.18, "sine", 0.035, undefined, i * 0.08),
    );
  }
  special() {
    this.tone(100, 0.6, "sawtooth", 0.055, 600);
    this.tone(60, 0.5, "sine", 0.11, 35);
  }
  knockout() {
    this.tone(130, 0.6, "sawtooth", 0.07, 24);
    this.tone(600, 0.25, "triangle", 0.05, 45);
  }
  countdown() {
    this.tone(440, 0.12, "sine", 0.06);
  }
  fight() {
    this.tone(880, 0.3, "square", 0.045);
  }
  finish(won: boolean) {
    (won ? [330, 440, 554, 660] : [330, 294, 220]).forEach((f, i) =>
      this.tone(f, 0.45, "triangle", 0.055, undefined, i * 0.15),
    );
  }
}

export const audio = new GameAudio();
