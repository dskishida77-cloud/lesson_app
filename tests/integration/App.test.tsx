import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PillarPos } from '../../src/core';

// 3D 描画は jsdom で動かないため、柱を押せるボタンと、落下完了の通知だけを持つ代用品に差し替える
vi.mock('../../src/render/BoardScene', () => ({
  BoardScene: (props: {
    onSelect?: (p: PillarPos) => void;
    animating?: boolean;
    onDropFinished?: () => void;
  }) => {
    const { animating, onDropFinished } = props;
    useEffect(() => {
      if (animating) onDropFinished?.();
    }, [animating, onDropFinished]);
    return (
      <div>
        {[0, 1].map((x) => (
          <button key={x} type="button" onClick={() => props.onSelect?.({ x, z: 0 })}>
            柱{x}
          </button>
        ))}
      </div>
    );
  },
}));

const audioSpy = vi.hoisted(() => ({ playDrop: vi.fn(), playWin: vi.fn(), setEnabled: vi.fn() }));
vi.mock('../../src/audio/AudioService', () => ({
  AudioService: class {
    playDrop = audioSpy.playDrop;
    playWin = audioSpy.playWin;
    setEnabled = audioSpy.setEnabled;
  },
}));

import { App } from '../../src/app/App';
import { SETTINGS_KEY } from '../../src/app/SettingsStore';

const start = () => fireEvent.click(screen.getByRole('button', { name: 'ゲーム開始' }));
const press = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});
afterEach(cleanup);

describe('App', () => {
  it('開始画面から始めると、盤面と手番が表示される', () => {
    render(<App />);
    start();
    expect(screen.getByText(/手番/).textContent).toContain('プレイヤー1');
  });

  it('柱を選ぶと駒が置かれ、着手音が鳴る', () => {
    render(<App />);
    start();
    press('柱0');
    expect(screen.getByText(/手数/).textContent).toContain('1');
    expect(audioSpy.playDrop).toHaveBeenCalledTimes(1);
    expect(audioSpy.playWin).not.toHaveBeenCalled();
  });

  it('決着した手では、勝利音も鳴り、結果ダイアログが出る。再戦で閉じる', () => {
    render(<App />);
    start();
    for (const name of ['柱0', '柱1', '柱0', '柱1', '柱0', '柱1', '柱0']) press(name);
    expect(audioSpy.playWin).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('dialog', { name: '対局結果' }).textContent).toContain('プレイヤー1の勝ち');
    expect(document.querySelector('.confetti')).not.toBeNull();
    press('もう一度遊ぶ');
    expect(document.querySelector('.confetti')).toBeNull();
    expect(screen.queryByRole('dialog', { name: '対局結果' })).toBeNull();
    expect(screen.getByLabelText('通算成績').textContent).toContain('プレイヤー1 1勝');
  });

  it('効果音の切り替えは、音の設定に反映され、保存される', () => {
    render(<App />);
    start();
    expect(audioSpy.setEnabled).toHaveBeenLastCalledWith(true);
    press('効果音: オン');
    expect(audioSpy.setEnabled).toHaveBeenLastCalledWith(false);
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY)!)).toEqual({ soundEnabled: false });
  });

  it('保存された設定（オフ）は、次回起動時に引き継がれる', () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ soundEnabled: false }));
    render(<App />);
    start();
    expect(screen.getByRole('button', { name: '効果音: オフ' })).toBeTruthy();
    expect(audioSpy.setEnabled).toHaveBeenLastCalledWith(false);
  });

  it('進行中に「新しいゲーム」を押すと確認が出て、キャンセルすれば盤面は保たれる', () => {
    render(<App />);
    start();
    press('柱0');
    press('新しいゲーム');
    expect(screen.getByRole('dialog', { name: '確認' })).toBeTruthy();
    press('キャンセル');
    expect(screen.getByText(/手数/).textContent).toContain('1');
  });
});
