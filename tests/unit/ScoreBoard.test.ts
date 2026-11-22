import { describe, expect, it } from 'vitest';
import { emptyScore, recordResult, revertResult } from '../../src/app/ScoreBoard';
import type { GameStatus } from '../../src/core';

const won = (winner: 0 | 1): GameStatus => ({ kind: 'won', winner, lines: [] });

describe('ScoreBoard', () => {
  it('初期値は全て0', () => {
    expect(emptyScore()).toEqual({ wins: [0, 0], draws: 0 });
  });

  it('勝者の勝ち数と、引き分け数を加算する', () => {
    let s = emptyScore();
    s = recordResult(s, won(1));
    s = recordResult(s, won(1));
    s = recordResult(s, won(0));
    s = recordResult(s, { kind: 'draw' });
    expect(s).toEqual({ wins: [1, 2], draws: 1 });
  });

  it('進行中の状態では変化しない', () => {
    const s = emptyScore();
    expect(recordResult(s, { kind: 'playing' })).toEqual(s);
  });

  it('revertResult で、加算を取り消せる（0未満にはならない）', () => {
    const s = recordResult(emptyScore(), won(0));
    expect(revertResult(s, won(0))).toEqual(emptyScore());
    expect(revertResult(emptyScore(), won(0))).toEqual(emptyScore());
    expect(revertResult(emptyScore(), { kind: 'draw' })).toEqual(emptyScore());
  });

  it('入力を書き換えない', () => {
    const s = emptyScore();
    recordResult(s, won(0));
    expect(s).toEqual({ wins: [0, 0], draws: 0 });
  });
});
