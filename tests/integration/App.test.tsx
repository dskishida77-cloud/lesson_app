import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PillarPos } from '../../src/core';

// 3D 描画は jsdom で動かないため、柱を押せるボタンと、落下完了の通知だけを持つ代用品に差し替える
// （実物は遅延読み込みされるが、テストでは即座に表示される）
vi.mock('../../src/render/lazyBoardScene', () => ({
  preloadBoardScene: () => {},
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

/** 開始して、遅延読み込みされる盤面（代用品）が表示されるまで待つ */
const start = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'ローカル対戦' }));
  fireEvent.click(screen.getByRole('button', { name: 'ゲーム開始' }));
  await screen.findByRole('button', { name: '柱0' });
};
const press = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});
afterEach(cleanup);

describe('App', () => {
  it('開始画面から始めると、盤面と手番が表示される', async () => {
    render(<App />);
    await start();
    expect(screen.getByText(/手番/).textContent).toContain('プレイヤー1');
  });

  it('柱を選ぶと駒が置かれ、着手音が鳴る', async () => {
    render(<App />);
    await start();
    press('柱0');
    expect(screen.getByText(/手数/).textContent).toContain('1');
    expect(audioSpy.playDrop).toHaveBeenCalledTimes(1);
    expect(audioSpy.playWin).not.toHaveBeenCalled();
  });

  it('決着した手では、勝利音も鳴り、結果ダイアログが出る。再戦で閉じる', async () => {
    render(<App />);
    await start();
    for (const name of ['柱0', '柱1', '柱0', '柱1', '柱0', '柱1', '柱0']) press(name);
    expect(audioSpy.playWin).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('dialog', { name: '対局結果' }).textContent).toContain('プレイヤー1の勝ち');
    expect(document.querySelector('.confetti')).not.toBeNull();
    press('もう一度遊ぶ');
    expect(document.querySelector('.confetti')).toBeNull();
    expect(screen.queryByRole('dialog', { name: '対局結果' })).toBeNull();
    expect(screen.getByLabelText('通算成績').textContent).toContain('プレイヤー1 1勝');
  });

  it('効果音の切り替えは、音の設定に反映され、保存される', async () => {
    render(<App />);
    await start();
    expect(audioSpy.setEnabled).toHaveBeenLastCalledWith(true);
    press('効果音: オン');
    expect(audioSpy.setEnabled).toHaveBeenLastCalledWith(false);
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY)!)).toEqual({ soundEnabled: false });
  });

  it('保存された設定（オフ）は、次回起動時に引き継がれる', async () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ soundEnabled: false }));
    render(<App />);
    await start();
    expect(screen.getByRole('button', { name: '効果音: オフ' })).toBeTruthy();
    expect(audioSpy.setEnabled).toHaveBeenLastCalledWith(false);
  });

  it('進行中に「新しいゲーム」を押すと確認が出て、キャンセルすれば盤面は保たれる', async () => {
    render(<App />);
    await start();
    press('柱0');
    press('新しいゲーム');
    expect(screen.getByRole('dialog', { name: '確認' })).toBeTruthy();
    press('キャンセル');
    expect(screen.getByText(/手数/).textContent).toContain('1');
  });

  it('ゲーム進行中に「遊び方」を開閉しても、盤面と手番は変わらない', async () => {
    render(<App />);
    await start();
    press('柱0');
    const before = [screen.getByText(/手番/).textContent, screen.getByText(/手数/).textContent];
    press('遊び方');
    expect(screen.getByRole('dialog', { name: '遊び方' })).toBeTruthy();
    press('閉じる');
    expect(screen.queryByRole('dialog', { name: '遊び方' })).toBeNull();
    expect([screen.getByText(/手番/).textContent, screen.getByText(/手数/).textContent]).toEqual(before);
    // 閉じた後も、続けて打てる
    press('柱1');
    expect(screen.getByText(/手数/).textContent).toContain('2');
  });

  it('モード選択: オンライン対戦は、接続設定がなければ、無効になる', () => {
    render(<App />);
    expect((screen.getByRole('button', { name: 'オンライン対戦' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('ローカルの設定画面から、メニューへ戻れる', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'ローカル対戦' }));
    press('メニューへ戻る');
    expect(screen.getByRole('button', { name: 'ローカル対戦' })).toBeTruthy();
  });

  it('ローカルの対局中に「メニューへ」を押すと、確認が出る。未着手なら、そのまま戻る', async () => {
    render(<App />);
    await start();
    press('メニューへ');
    expect(screen.getByRole('button', { name: 'ローカル対戦' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'ローカル対戦' }));
    fireEvent.click(screen.getByRole('button', { name: 'ゲーム開始' }));
    await screen.findByRole('button', { name: '柱0' });
    press('柱0');
    press('メニューへ');
    expect(screen.getByRole('dialog', { name: '確認' }).textContent).toContain('メニューへ戻りますか');
    press('キャンセル');
    expect(screen.getByText(/手数/).textContent).toContain('1');
    press('メニューへ');
    press('メニューへ戻る');
    expect(screen.getByRole('button', { name: 'オンライン対戦' })).toBeTruthy();
  });
});
