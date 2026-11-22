import { describe, expect, it } from 'vitest';
import { applyMove, createGame, getDropHeight } from '../../src/core/game';
import type { GameState, PillarPos } from '../../src/core/types';

const p = (x: number, z: number): PillarPos => ({ x, z });

/** 失敗したら例外にして、成功時の状態を返すテスト用ヘルパー */
const play = (state: GameState, ...pillars: PillarPos[]): GameState =>
  pillars.reduce((s, pillar) => {
    const r = applyMove(s, pillar);
    if (!r.ok) throw new Error(`着手に失敗: ${r.error}`);
    return r.state;
  }, state);

describe('createGame', () => {
  it('空の4x4x4盤面で、指定した先手から始まる', () => {
    const g = createGame(1);
    expect(g.current).toBe(1);
    expect(g.history).toHaveLength(0);
    expect(g.status).toEqual({ kind: 'playing' });
    expect(g.cells).toHaveLength(4);
    expect(g.cells.flat(2)).toHaveLength(64);
    expect(g.cells.flat(2).every((c) => c === null)).toBe(true);
  });
});

describe('applyMove', () => {
  it('駒は最下段から積み上がる', () => {
    const g = play(createGame(0), p(1, 2), p(1, 2), p(1, 2));
    expect(g.cells[1]![2]).toEqual([0, 1, 0, null]);
  });

  it('着手後に手番が交代し、履歴に残る', () => {
    const r = applyMove(createGame(0), p(0, 0));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.current).toBe(1);
    expect(r.state.history).toHaveLength(1);
    expect(r.move).toEqual({ player: 0, pillar: p(0, 0), landed: { x: 0, y: 0, z: 0 } });
  });

  it('入力した状態を書き換えない', () => {
    const before = createGame(0);
    const snapshot = JSON.stringify(before);
    applyMove(before, p(0, 0));
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it('満杯の柱は PILLAR_FULL を返し、状態は変化しない', () => {
    // 同じ柱に4回置くと満杯（勝敗が絡まない柱の使い分けで、4連続を避ける）
    const g = play(createGame(0), p(0, 0), p(0, 0), p(0, 0), p(0, 0));
    expect(applyMove(g, p(0, 0))).toEqual({ ok: false, error: 'PILLAR_FULL' });
    expect(g.history).toHaveLength(4);
  });

  it('範囲外の柱は OUT_OF_RANGE を返す', () => {
    const g = createGame(0);
    for (const bad of [p(-1, 0), p(4, 0), p(0, -1), p(0, 4), p(1.5, 0)]) {
      expect(applyMove(g, bad)).toEqual({ ok: false, error: 'OUT_OF_RANGE' });
    }
  });
});

describe('getDropHeight', () => {
  it('次に駒が置かれる段を返し、満杯は null を返す', () => {
    const g0 = createGame(0);
    expect(getDropHeight(g0, p(2, 2))).toBe(0);
    const g = play(g0, p(2, 2), p(2, 2), p(2, 2), p(2, 2));
    expect(getDropHeight(g, p(2, 2))).toBeNull();
    expect(getDropHeight(play(g0, p(2, 2)), p(2, 2))).toBe(1);
  });

  it('範囲外は null を返す', () => {
    expect(getDropHeight(createGame(0), p(9, 9))).toBeNull();
  });
});
