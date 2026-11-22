/** 使う範囲だけを定義した AudioContext の型（テストで差し替えやすくするため） */
export interface AudioContextLike {
  readonly currentTime: number;
  readonly state: string;
  readonly destination: unknown;
  resume(): Promise<void>;
  createOscillator(): {
    type: string;
    frequency: { setValueAtTime(v: number, t: number): void; exponentialRampToValueAtTime(v: number, t: number): void };
    connect(node: unknown): void;
    start(t: number): void;
    stop(t: number): void;
  };
  createGain(): {
    gain: {
      setValueAtTime(v: number, t: number): void;
      exponentialRampToValueAtTime(v: number, t: number): void;
      linearRampToValueAtTime(v: number, t: number): void;
    };
    connect(node: unknown): void;
  };
}

type ContextFactory = () => AudioContextLike | null;

const defaultFactory: ContextFactory = () => {
  const Ctor =
    (globalThis as { AudioContext?: new () => AudioContextLike }).AudioContext ??
    (globalThis as { webkitAudioContext?: new () => AudioContextLike }).webkitAudioContext;
  return Ctor ? new Ctor() : null;
};

/** Web Audio API で、効果音を合成して鳴らす（音源ファイルは使わない）。失敗してもゲームには影響させない */
export class AudioService {
  private enabled = true;
  private ctx: AudioContextLike | null = null;

  constructor(private readonly createContext: ContextFactory = defaultFactory) {}

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /** 駒が着地した音 */
  playDrop(): void {
    this.play((ctx, t) => this.tone(ctx, 180, 90, t, 0.16, 'triangle', 0.5));
  }

  /** 勝利の音（上昇するアルペジオ） */
  playWin(): void {
    this.play((ctx, t) => {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) =>
        this.tone(ctx, freq, freq, t + 0.12 + i * 0.13, 0.28, 'sine', 0.35),
      );
    });
  }

  private play(fn: (ctx: AudioContextLike, now: number) => void): void {
    if (!this.enabled) return;
    try {
      // 最初のユーザー操作の後に鳴らす時点で作る（ブラウザの自動再生制限への対応）
      this.ctx ??= this.createContext();
      const ctx = this.ctx;
      if (!ctx) return;
      if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
      fn(ctx, ctx.currentTime);
    } catch {
      // 音が鳴らなくても、ゲームの進行は止めない
    }
  }

  private tone(
    ctx: AudioContextLike,
    from: number,
    to: number,
    start: number,
    duration: number,
    type: string,
    volume: number,
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, start);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }
}
