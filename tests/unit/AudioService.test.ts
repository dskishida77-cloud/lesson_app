import { describe, expect, it, vi } from 'vitest';
import { AudioService } from '../../src/audio/AudioService';
import type { AudioContextLike } from '../../src/audio/AudioService';

/** 生成された発振器の数を数えるだけの、偽の AudioContext */
function fakeContext() {
  const oscillators: { start: ReturnType<typeof vi.fn> }[] = [];
  const param = () => ({
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
  });
  const ctx = {
    currentTime: 0,
    state: 'running',
    destination: {},
    resume: vi.fn(() => Promise.resolve()),
    createOscillator: vi.fn(() => {
      const osc = {
        type: 'sine',
        frequency: param(),
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      oscillators.push(osc);
      return osc;
    }),
    createGain: vi.fn(() => ({ gain: param(), connect: vi.fn() })),
  };
  return { ctx: ctx as unknown as AudioContextLike, oscillators, raw: ctx };
}

describe('AudioService', () => {
  it('有効なとき、着手音と勝利音を鳴らす', () => {
    const { ctx, oscillators } = fakeContext();
    const audio = new AudioService(() => ctx);
    audio.playDrop();
    const afterDrop = oscillators.length;
    expect(afterDrop).toBeGreaterThan(0);
    audio.playWin();
    expect(oscillators.length).toBeGreaterThan(afterDrop);
  });

  it('無効なときは、鳴らさず、AudioContext も作らない', () => {
    const create = vi.fn();
    const audio = new AudioService(create);
    audio.setEnabled(false);
    audio.playDrop();
    audio.playWin();
    expect(create).not.toHaveBeenCalled();
  });

  it('無効から有効に戻すと、再び鳴らせる', () => {
    const { ctx, oscillators } = fakeContext();
    const audio = new AudioService(() => ctx);
    audio.setEnabled(false);
    audio.playDrop();
    expect(oscillators).toHaveLength(0);
    audio.setEnabled(true);
    audio.playDrop();
    expect(oscillators.length).toBeGreaterThan(0);
  });

  it('AudioContext を作れない環境でも、例外にしない', () => {
    const audio = new AudioService(() => null);
    expect(() => audio.playDrop()).not.toThrow();
    expect(() => audio.playWin()).not.toThrow();
  });

  it('AudioContext の生成や再生で例外が出ても、ゲームに影響させない', () => {
    const audio = new AudioService(() => {
      throw new Error('boom');
    });
    expect(() => audio.playDrop()).not.toThrow();
  });

  it('停止中（ブラウザの自動再生制限）なら、再開を試みる', () => {
    const { ctx, raw } = fakeContext();
    raw.state = 'suspended';
    new AudioService(() => ctx).playDrop();
    expect(raw.resume).toHaveBeenCalled();
  });
});
