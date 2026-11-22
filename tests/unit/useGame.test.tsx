import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useGame } from '../../src/app/useGame';
import type { PillarPos } from '../../src/core';

const p = (x: number, z: number): PillarPos => ({ x, z });

describe('useGame', () => {
  it('初期状態: 既定名で、先手(プレイヤー1)の手番から始まる', () => {
    const { result } = renderHook(() => useGame());
    expect(result.current.names).toEqual(['プレイヤー1', 'プレイヤー2']);
    expect(result.current.state.current).toBe(0);
    expect(result.current.state.history).toHaveLength(0);
  });

  it('柱を選ぶと駒が置かれ、手番が交代する', () => {
    const { result } = renderHook(() => useGame());
    act(() => {
      result.current.selectPillar(p(0, 0));
    });
    expect(result.current.state.history).toHaveLength(1);
    expect(result.current.state.current).toBe(1);
  });

  it('満杯の柱を選ぶと、エラーを返し、状態は変化しない', () => {
    const { result } = renderHook(() => useGame());
    for (let i = 0; i < 4; i++) {
      act(() => {
        result.current.selectPillar(p(0, 0));
      });
    }
    let error: unknown;
    act(() => {
      error = result.current.selectPillar(p(0, 0));
    });
    expect(error).toBe('PILLAR_FULL');
    expect(result.current.state.history).toHaveLength(4);
  });

  it('着手から勝利までの流れ。勝利後の入力は無視される', () => {
    const { result } = renderHook(() => useGame());
    const moves = [p(0, 0), p(1, 0), p(0, 0), p(1, 0), p(0, 0), p(1, 0), p(0, 0)];
    for (const m of moves) {
      act(() => {
        result.current.selectPillar(m);
      });
    }
    expect(result.current.state.status.kind).toBe('won');
    let error: unknown;
    act(() => {
      error = result.current.selectPillar(p(2, 2));
    });
    expect(error).toBe('GAME_OVER');
    expect(result.current.state.history).toHaveLength(7);
  });

  it('同じ描画内で連続して呼んでも、取りこぼさない', () => {
    const { result } = renderHook(() => useGame());
    act(() => {
      result.current.selectPillar(p(0, 0));
      result.current.selectPillar(p(1, 1));
    });
    expect(result.current.state.history).toHaveLength(2);
  });

  it('startGame で、名前と先手を指定して最初からやり直せる', () => {
    const { result } = renderHook(() => useGame());
    act(() => {
      result.current.selectPillar(p(0, 0));
    });
    act(() => {
      result.current.startGame({ names: ['あや', 'ゆう'], firstPlayer: 1 });
    });
    expect(result.current.names).toEqual(['あや', 'ゆう']);
    expect(result.current.state.current).toBe(1);
    expect(result.current.state.history).toHaveLength(0);
  });
});
