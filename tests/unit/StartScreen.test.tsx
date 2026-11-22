import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StartScreen } from '../../src/ui/StartScreen';

afterEach(cleanup);

describe('StartScreen', () => {
  it('入力した名前と先手で、開始を通知する', () => {
    const onStart = vi.fn();
    render(<StartScreen onStart={onStart} />);
    fireEvent.change(screen.getByLabelText('プレイヤー1の名前'), { target: { value: 'あや' } });
    fireEvent.change(screen.getByLabelText('プレイヤー2の名前'), { target: { value: 'ゆう' } });
    fireEvent.click(screen.getByLabelText('プレイヤー2が先手'));
    fireEvent.click(screen.getByRole('button', { name: 'ゲーム開始' }));
    expect(onStart).toHaveBeenCalledWith({ names: ['あや', 'ゆう'], firstPlayer: 1 });
  });

  it('未入力なら既定名で、先手はプレイヤー1', () => {
    const onStart = vi.fn();
    render(<StartScreen onStart={onStart} />);
    fireEvent.click(screen.getByRole('button', { name: 'ゲーム開始' }));
    expect(onStart).toHaveBeenCalledWith({ names: ['プレイヤー1', 'プレイヤー2'], firstPlayer: 0 });
  });

  it('入力欄は12文字を上限にする', () => {
    render(<StartScreen onStart={() => {}} />);
    expect(screen.getByLabelText('プレイヤー1の名前').getAttribute('maxlength')).toBe('12');
  });

  it('長すぎる名前は、通知時に切り詰められる', () => {
    const onStart = vi.fn();
    render(<StartScreen onStart={onStart} />);
    fireEvent.change(screen.getByLabelText('プレイヤー1の名前'), { target: { value: 'あ'.repeat(30) } });
    fireEvent.click(screen.getByRole('button', { name: 'ゲーム開始' }));
    expect(onStart.mock.calls[0]![0].names[0]).toBe('あ'.repeat(12));
  });
});
