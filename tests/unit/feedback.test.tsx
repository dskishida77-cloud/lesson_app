import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useToast } from '../../src/app/useToast';
import { ResultDialog } from '../../src/ui/ResultDialog';
import { Toast } from '../../src/ui/Toast';

afterEach(cleanup);

describe('useToast', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('表示したメッセージは、一定時間後に消える', () => {
    const { result } = renderHook(() => useToast(2000));
    expect(result.current.message).toBeNull();
    act(() => result.current.show('この柱は満杯です'));
    expect(result.current.message).toBe('この柱は満杯です');
    act(() => vi.advanceTimersByTime(1999));
    expect(result.current.message).toBe('この柱は満杯です');
    act(() => vi.advanceTimersByTime(2));
    expect(result.current.message).toBeNull();
  });

  it('連続して表示すると、最後の表示から時間を数え直す', () => {
    const { result } = renderHook(() => useToast(2000));
    act(() => result.current.show('A'));
    act(() => vi.advanceTimersByTime(1500));
    act(() => result.current.show('B'));
    act(() => vi.advanceTimersByTime(1500));
    expect(result.current.message).toBe('B');
    act(() => vi.advanceTimersByTime(600));
    expect(result.current.message).toBeNull();
  });
});

describe('Toast', () => {
  it('メッセージを表示し、null なら何も出さない', () => {
    const { rerender } = render(<Toast message="この柱は満杯です" />);
    expect(screen.getByRole('alert').textContent).toBe('この柱は満杯です');
    rerender(<Toast message={null} />);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('ResultDialog', () => {
  const names: [string, string] = ['あや', 'ゆう'];

  it('勝者名を表示する', () => {
    render(<ResultDialog status={{ kind: 'won', winner: 1, lines: [] }} names={names} onPlayAgain={() => {}} />);
    expect(screen.getByRole('dialog').textContent).toContain('ゆうの勝ち');
  });

  it('引き分けを表示する', () => {
    render(<ResultDialog status={{ kind: 'draw' }} names={names} onPlayAgain={() => {}} />);
    expect(screen.getByRole('dialog').textContent).toContain('引き分け');
  });

  it('進行中は何も表示しない', () => {
    render(<ResultDialog status={{ kind: 'playing' }} names={names} onPlayAgain={() => {}} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('「もう一度遊ぶ」で、既定では先後を入れ替えずに再戦する', () => {
    const onPlayAgain = vi.fn();
    render(<ResultDialog status={{ kind: 'draw' }} names={names} onPlayAgain={onPlayAgain} />);
    fireEvent.click(screen.getByRole('button', { name: 'もう一度遊ぶ' }));
    expect(onPlayAgain).toHaveBeenCalledWith(false);
  });

  it('チェックすると、先手と後手を入れ替えて再戦する', () => {
    const onPlayAgain = vi.fn();
    render(<ResultDialog status={{ kind: 'draw' }} names={names} onPlayAgain={onPlayAgain} />);
    fireEvent.click(screen.getByLabelText('先手と後手を入れ替える'));
    fireEvent.click(screen.getByRole('button', { name: 'もう一度遊ぶ' }));
    expect(onPlayAgain).toHaveBeenCalledWith(true);
  });
});
