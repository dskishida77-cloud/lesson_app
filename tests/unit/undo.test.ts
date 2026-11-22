import { describe, expect, it } from 'vitest';
import { applyMove, createGame, undo } from '../../src/core';
import type { GameState, PillarPos } from '../../src/core';

const p = (x: number, z: number): PillarPos => ({ x, z });

const play = (state: GameState, ...pillars: PillarPos[]): GameState =>
  pillars.reduce((s, pillar) => {
    const r = applyMove(s, pillar);
    if (!r.ok) throw new Error(r.error);
    return r.state;
  }, state);

describe('undo', () => {
  it('着手して取り消すと、元の状態に戻る', () => {
    const g0 = createGame(0);
    const g1 = play(g0, p(1, 1));
    expect(undo(g1)).toEqual(g0);
  });

  it('連続して最初の状態まで戻れる', () => {
    const g0 = createGame(1);
    let g = play(g0, p(0, 0), p(1, 0), p(2, 0));
    g = undo(undo(undo(g)));
    expect(g).toEqual(g0);
  });

  it('履歴が空なら、同じ状態を返す', () => {
    const g0 = createGame(0);
    expect(undo(g0)).toEqual(g0);
  });

  it('勝敗が決した状態からも戻せ、再び打てる', () => {
    const won = play(createGame(0), p(0, 0), p(1, 0), p(0, 0), p(1, 0), p(0, 0), p(1, 0), p(0, 0));
    expect(won.status.kind).toBe('won');
    const back = undo(won);
    expect(back.status).toEqual({ kind: 'playing' });
    expect(back.current).toBe(0);
    expect(back.history).toHaveLength(6);
    expect(applyMove(back, p(2, 2)).ok).toBe(true);
  });

  it('入力した状態を書き換えない', () => {
    const g = play(createGame(0), p(0, 0), p(1, 1));
    const snapshot = JSON.stringify(g);
    undo(g);
    expect(JSON.stringify(g)).toBe(snapshot);
  });
});
