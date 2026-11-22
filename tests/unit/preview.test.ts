import { describe, expect, it } from 'vitest';
import { applyMove, createGame } from '../../src/core';
import type { GameState, PillarPos } from '../../src/core';
import { getPreviewCell, isCellInLines } from '../../src/render/preview';

const p = (x: number, z: number): PillarPos => ({ x, z });
const play = (state: GameState, ...pillars: PillarPos[]): GameState =>
  pillars.reduce((s, pillar) => {
    const r = applyMove(s, pillar);
    if (!r.ok) throw new Error(r.error);
    return r.state;
  }, state);

describe('getPreviewCell', () => {
  it('ポインタが柱にない場合は null', () => {
    expect(getPreviewCell(createGame(0), null)).toBeNull();
  });

  it('駒が置かれる位置（最下段の空き）を返す', () => {
    const g = play(createGame(0), p(1, 1), p(1, 1));
    expect(getPreviewCell(g, p(1, 1))).toEqual({ x: 1, y: 2, z: 1 });
    expect(getPreviewCell(g, p(2, 2))).toEqual({ x: 2, y: 0, z: 2 });
  });

  it('満杯の柱では null', () => {
    const g = play(createGame(0), p(0, 0), p(0, 0), p(0, 0), p(0, 0));
    expect(getPreviewCell(g, p(0, 0))).toBeNull();
  });

  it('ゲーム終了後は null', () => {
    const won = play(createGame(0), p(0, 0), p(1, 0), p(0, 0), p(1, 0), p(0, 0), p(1, 0), p(0, 0));
    expect(getPreviewCell(won, p(2, 2))).toBeNull();
  });
});

describe('isCellInLines', () => {
  const lines = [[{ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }]];
  it('いずれかのラインに含まれるか判定する', () => {
    expect(isCellInLines({ x: 0, y: 1, z: 0 }, lines)).toBe(true);
    expect(isCellInLines({ x: 1, y: 1, z: 0 }, lines)).toBe(false);
    expect(isCellInLines({ x: 0, y: 0, z: 0 }, [])).toBe(false);
  });
});
