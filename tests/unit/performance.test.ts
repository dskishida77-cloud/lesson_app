import { describe, expect, it } from 'vitest';
import { applyMove, createGame, undo } from '../../src/core';
import type { GameState, PillarPos } from '../../src/core';
import { DRAW_LAYOUT } from '../fixtures/drawLayout';

/** 要件9.2: 着手から、勝敗判定と手番切り替えが完了するまで、100ms 未満 */
const LIMIT_MS = 100;

const ownerAt = (x: number, y: number, z: number) => (DRAW_LAYOUT[x * 4 + z]![y] === '1' ? 1 : 0);

/** 勝者なしで64手を打ち切る手順（深さ優先探索で求める） */
function fullGame(): PillarPos[] {
  const search = (state: GameState, path: PillarPos[]): PillarPos[] | null => {
    if (state.history.length === 64) return path;
    for (let x = 0; x < 4; x++)
      for (let z = 0; z < 4; z++) {
        const y = state.cells[x]![z]!.indexOf(null);
        if (y === -1 || ownerAt(x, y, z) !== state.current) continue;
        const r = applyMove(state, { x, z });
        if (!r.ok) continue;
        const found = search(r.state, [...path, { x, z }]);
        if (found) return found;
      }
    return null;
  };
  return search(createGame(0), [])!;
}

describe('処理時間（要件9.2）', () => {
  const moves = fullGame();

  it('64手の対局で、1手ごとの applyMove は 100ms 未満（最悪値で確認）', () => {
    let worst = 0;
    for (let round = 0; round < 200; round++) {
      let state = createGame(0);
      for (const m of moves) {
        const t0 = performance.now();
        const r = applyMove(state, m);
        worst = Math.max(worst, performance.now() - t0);
        if (!r.ok) throw new Error(r.error);
        state = r.state;
      }
    }
    console.info(`applyMove の最悪値: ${worst.toFixed(3)} ms（200局 × 64手）`);
    expect(worst).toBeLessThan(LIMIT_MS);
  });

  it('取り消しも 100ms 未満', () => {
    let state = createGame(0);
    for (const m of moves) {
      const r = applyMove(state, m);
      if (!r.ok) throw new Error(r.error);
      state = r.state;
    }
    let worst = 0;
    for (let i = 0; i < 64; i++) {
      const t0 = performance.now();
      state = undo(state);
      worst = Math.max(worst, performance.now() - t0);
    }
    expect(state.history).toHaveLength(0);
    expect(worst).toBeLessThan(LIMIT_MS);
  });
});
