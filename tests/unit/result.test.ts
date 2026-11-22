import { describe, expect, it } from 'vitest';
import { applyMove, checkResult, createGame } from '../../src/core/game';
import { WIN_LINES } from '../../src/core/lines';
import type { CellPos, Cells, GameState, PillarPos, PlayerId } from '../../src/core/types';
import { DRAW_LAYOUT } from '../fixtures/drawLayout';

const emptyCells = (): Cells =>
  Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => Array<PlayerId | null>(4).fill(null)));

const put = (cells: Cells, cell: CellPos, player: PlayerId) => {
  cells[cell.x]![cell.z]![cell.y] = player;
};

const p = (x: number, z: number): PillarPos => ({ x, z });

const play = (state: GameState, ...pillars: PillarPos[]): GameState =>
  pillars.reduce((s, pillar) => {
    const r = applyMove(s, pillar);
    if (!r.ok) throw new Error(`着手に失敗: ${r.error}`);
    return r.state;
  }, state);

describe('checkResult: 全76ラインで勝利になる', () => {
  WIN_LINES.forEach((line, i) => {
    it(`ライン ${i}`, () => {
      const cells = emptyCells();
      line.forEach((c) => put(cells, c, 1));
      for (const last of line) {
        const status = checkResult(cells, last);
        expect(status.kind).toBe('won');
        if (status.kind === 'won') {
          expect(status.winner).toBe(1);
          expect(status.lines).toHaveLength(1);
        }
      }
    });
  });
});

describe('checkResult: 勝ちにならないケース', () => {
  it('3連続では勝ちにならない', () => {
    const cells = emptyCells();
    [0, 1, 2].forEach((x) => put(cells, { x, y: 0, z: 0 }, 0));
    expect(checkResult(cells, { x: 2, y: 0, z: 0 })).toEqual({ kind: 'playing' });
  });

  it('相手の駒が混じるラインは勝ちにならない', () => {
    const cells = emptyCells();
    [0, 1, 3].forEach((x) => put(cells, { x, y: 0, z: 0 }, 0));
    put(cells, { x: 2, y: 0, z: 0 }, 1);
    expect(checkResult(cells, { x: 3, y: 0, z: 0 })).toEqual({ kind: 'playing' });
  });

  it('直近の着手を含まないラインは確認しない', () => {
    const cells = emptyCells();
    [0, 1, 2, 3].forEach((x) => put(cells, { x, y: 0, z: 0 }, 0));
    expect(checkResult(cells, { x: 0, y: 0, z: 3 })).toEqual({ kind: 'playing' });
  });
});

describe('checkResult: 同時成立', () => {
  it('1手で複数のラインが成立したら、すべて返す', () => {
    const cells = emptyCells();
    // (0,0,0) を要とする、x方向とz方向のラインを、残り3マスずつ用意する
    [1, 2, 3].forEach((x) => put(cells, { x, y: 0, z: 0 }, 0));
    [1, 2, 3].forEach((z) => put(cells, { x: 0, y: 0, z }, 0));
    put(cells, { x: 0, y: 0, z: 0 }, 0);
    const status = checkResult(cells, { x: 0, y: 0, z: 0 });
    expect(status.kind).toBe('won');
    if (status.kind === 'won') expect(status.lines).toHaveLength(2);
  });
});


const ownerAt = (x: number, y: number, z: number): PlayerId =>
  (DRAW_LAYOUT[x * 4 + z]![y] === '1' ? 1 : 0);

describe('checkResult: 引き分け', () => {
  it('64マスが勝者なしで埋まったら draw', () => {
    const cells = emptyCells();
    for (let x = 0; x < 4; x++)
      for (let z = 0; z < 4; z++)
        for (let y = 0; y < 4; y++) put(cells, { x, y, z }, ownerAt(x, y, z));
    const anyWin = WIN_LINES.some((line) => {
      const first = cells[line[0]!.x]![line[0]!.z]![line[0]!.y];
      return line.every((c) => cells[c.x]![c.z]![c.y] === first);
    });
    expect(anyWin).toBe(false);
    expect(checkResult(cells, { x: 3, y: 3, z: 3 })).toEqual({ kind: 'draw' });
  });

  it('埋まっていなければ playing のまま', () => {
    const cells = emptyCells();
    put(cells, { x: 0, y: 0, z: 0 }, 0);
    expect(checkResult(cells, { x: 0, y: 0, z: 0 })).toEqual({ kind: 'playing' });
  });
});

describe('applyMove と勝敗', () => {
  it('縦に4つ積むと、その手番のプレイヤーが勝つ', () => {
    // 先手が (0,0) に積み、後手は (1,0) に置く
    const g = play(createGame(0), p(0, 0), p(1, 0), p(0, 0), p(1, 0), p(0, 0), p(1, 0), p(0, 0));
    expect(g.status.kind).toBe('won');
    if (g.status.kind === 'won') {
      expect(g.status.winner).toBe(0);
      expect(g.status.lines[0]).toHaveLength(4);
    }
  });

  it('勝敗が決まった後の着手は GAME_OVER で、状態は変化しない', () => {
    const g = play(createGame(0), p(0, 0), p(1, 0), p(0, 0), p(1, 0), p(0, 0), p(1, 0), p(0, 0));
    const before = JSON.stringify(g);
    expect(applyMove(g, p(2, 2))).toEqual({ ok: false, error: 'GAME_OVER' });
    expect(JSON.stringify(g)).toBe(before);
  });

  it('勝敗が決まった後も、手番は勝者側のまま（交代しない）', () => {
    const g = play(createGame(0), p(0, 0), p(1, 0), p(0, 0), p(1, 0), p(0, 0), p(1, 0), p(0, 0));
    expect(g.current).toBe(0);
  });

  it('64手すべてを勝者なしで打ち切ると draw になる', () => {
    // 各手で「次の段の持ち主が手番のプレイヤー」である柱へ打つ。行き詰まったら戻る（深さ優先探索）
    const dfs = (state: GameState): GameState | null => {
      if (state.history.length === 64) return state;
      for (let x = 0; x < 4; x++) {
        for (let z = 0; z < 4; z++) {
          const y = state.cells[x]![z]!.indexOf(null);
          if (y === -1 || ownerAt(x, y, z) !== state.current) continue;
          const r = applyMove(state, p(x, z));
          if (!r.ok) continue;
          const done = dfs(r.state);
          if (done) return done;
        }
      }
      return null;
    };
    const final = dfs(createGame(0));
    expect(final).not.toBeNull();
    expect(final!.history).toHaveLength(64);
    expect(final!.status).toEqual({ kind: 'draw' });
  });
});
