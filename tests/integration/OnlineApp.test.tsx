import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PillarPos } from '../../src/core';
import { RoomStore } from '../../src/online/RoomStore';
import { FakeRoomServer } from '../helpers/fakeRoomServer';

// 3D 描画は jsdom で動かないため、柱を押せるボタンと、落下完了の通知だけを持つ代用品に差し替える
vi.mock('../../src/render/lazyBoardScene', () => ({
  preloadBoardScene: () => {},
  BoardScene: (props: { onSelect?: (p: PillarPos) => void; animating?: boolean; onDropFinished?: () => void }) => {
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
vi.mock('../../src/audio/AudioService', () => ({
  AudioService: class {
    playDrop() {}
    playWin() {}
    setEnabled() {}
  },
}));

import { App } from '../../src/app/App';

const memoryStorage = () => {
  const data: Record<string, string> = {};
  return {
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => void (data[k] = v),
    removeItem: (k: string) => void delete data[k],
  };
};

let server: FakeRoomServer;
beforeEach(() => {
  server = new FakeRoomServer();
  localStorage.clear();
  window.history.replaceState(null, '', '/');
});
afterEach(cleanup);

/** 1人分のアプリを、独自のサーバー接続・保存先で、画面に出す */
function mount(userId: string, storage = memoryStorage()) {
  const view = render(<App roomApi={server.api(userId)} roomStore={new RoomStore(storage)} />);
  return { ...view, ui: within(view.container), storage };
}
type Client = ReturnType<typeof mount>;

const click = (c: Client, name: string | RegExp) => fireEvent.click(c.ui.getByRole('button', { name }));
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

async function hostCreatesRoom(host: Client, name = 'あや') {
  click(host, 'オンライン対戦');
  fireEvent.change(host.ui.getByLabelText('あなたの名前'), { target: { value: name } });
  click(host, 'ルームを作る');
  await host.ui.findByText('相手の参加を待っています');
  return (host.ui.getByLabelText('招待リンク') as HTMLInputElement).value;
}

/** 招待リンクを開いたゲストとして、参加する */
async function guestJoinsByLink(link: string, name = 'ゆう') {
  const url = new URL(link);
  window.history.replaceState(null, '', url.pathname + url.search);
  const guest = mount('guest');
  fireEvent.change(guest.ui.getByLabelText('あなたの名前'), { target: { value: name } });
  click(guest, '参加する');
  await guest.ui.findByRole('button', { name: '柱0' });
  return guest;
}

async function startedPair() {
  const host = mount('host');
  const link = await hostCreatesRoom(host);
  const guest = await guestJoinsByLink(link);
  await host.ui.findByRole('button', { name: '柱0' }); // ホストの画面も、自動で対局に切り替わる
  return { host, guest, link };
}

const moves = (c: Client) => c.ui.getByText(/手数/).textContent;

describe('オンライン対戦の画面', () => {
  it('接続設定がなければ（roomApi が null）、オンライン対戦は選べない', () => {
    render(<App roomApi={null} />);
    expect((screen.getByRole('button', { name: 'オンライン対戦' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('ホストがルームを作ると、招待リンク（ルームコードつき）が表示される', async () => {
    const host = mount('host');
    const link = await hostCreatesRoom(host);
    const code = server.rooms.values().next().value!.code;
    expect(link).toContain(`?room=${code}`);
    expect(host.ui.getByText(code)).toBeTruthy();
  });

  it('招待リンクから開いたゲストは、コード入力済みで参加でき、ホストの画面は自動で対局に切り替わる', async () => {
    const host = mount('host');
    const link = await hostCreatesRoom(host);
    window.history.replaceState(null, '', new URL(link).pathname + new URL(link).search);
    const guest = mount('guest');
    expect((guest.ui.getByLabelText('ルームコード') as HTMLInputElement).value).toBe(server.rooms.values().next().value!.code);
    expect(guest.ui.getByText('招待を受け取りました')).toBeTruthy();
    fireEvent.change(guest.ui.getByLabelText('あなたの名前'), { target: { value: 'ゆう' } });
    click(guest, '参加する');
    await guest.ui.findByRole('button', { name: '柱0' });
    await host.ui.findByRole('button', { name: '柱0' });
    expect(host.ui.getByLabelText('オンライン対戦の状態').textContent).toContain('あなた: あや');
    expect(host.ui.getByLabelText('オンライン対戦の状態').textContent).toContain('相手: ゆう');
    expect(guest.ui.getByLabelText('オンライン対戦の状態').textContent).toContain('あなた: ゆう');
    // 参加後は、アドレスから招待のクエリが消える
    expect(window.location.search).toBe('');
  });

  it('存在しないコード・満員では、エラーを表示する', async () => {
    const lonely = mount('lonely');
    click(lonely, 'オンライン対戦');
    fireEvent.change(lonely.ui.getByLabelText('あなたの名前'), { target: { value: 'まい' } });
    fireEvent.change(lonely.ui.getByLabelText('ルームコード'), { target: { value: 'ZZZZZZ' } });
    click(lonely, '参加する');
    expect((await lonely.ui.findByRole('alert')).textContent).toContain('ルームが見つかりません');
    cleanup();

    const { link } = await startedPair();
    window.history.replaceState(null, '', new URL(link).pathname + new URL(link).search);
    const third = mount('third');
    fireEvent.change(third.ui.getByLabelText('あなたの名前'), { target: { value: 'まい' } });
    click(third, '参加する');
    expect((await third.ui.findByRole('alert')).textContent).toContain('すでに2人が揃っています');
  });

  it('対局画面には、「1手戻す」「新しいゲーム」がなく、「ルームを抜ける」がある', async () => {
    const { host } = await startedPair();
    expect(host.ui.queryByRole('button', { name: '1手戻す' })).toBeNull();
    expect(host.ui.queryByRole('button', { name: '新しいゲーム' })).toBeNull();
    expect(host.ui.getByRole('button', { name: 'ルームを抜ける' })).toBeTruthy();
    expect(host.ui.getByRole('button', { name: '視点リセット' })).toBeTruthy();
  });
});

describe('対局', () => {
  it('自分の手番で打つと、双方の画面に反映される。相手の手番では、打てず、通知される', async () => {
    const { host, guest } = await startedPair();
    expect(host.ui.getByText('あなたの番です')).toBeTruthy();
    expect(guest.ui.getByText('相手の番です')).toBeTruthy();

    click(guest, '柱0'); // ゲストの手番ではない
    expect((await guest.ui.findByRole('alert')).textContent).toContain('相手の手番です');
    expect(moves(guest)).toContain('0');

    click(host, '柱0');
    await waitFor(() => expect(moves(host)).toContain('1'));
    await waitFor(() => expect(moves(guest)).toContain('1'));
    expect(host.ui.getByText('相手の番です')).toBeTruthy();
    expect(guest.ui.getByText('あなたの番です')).toBeTruthy();
  });

  it('決着すると、双方に結果が出る。再戦で、先手と後手が入れ替わり、成績は保たれる', async () => {
    const { host, guest } = await startedPair();
    const turn = async (who: Client, name: string) => {
      click(who, name);
      await settle();
    };
    await turn(host, '柱0'); await turn(guest, '柱1');
    await turn(host, '柱0'); await turn(guest, '柱1');
    await turn(host, '柱0'); await turn(guest, '柱1');
    await turn(host, '柱0');

    for (const c of [host, guest]) {
      await waitFor(() => expect(c.ui.getByRole('dialog', { name: '対局結果' }).textContent).toContain('あやの勝ち'));
      expect(c.ui.queryByLabelText('先手と後手を入れ替える')).toBeNull(); // サーバーが自動で入れ替える
      expect(c.ui.getByLabelText('通算成績').textContent).toContain('あや 1勝');
    }

    click(guest, 'もう一度遊ぶ');
    await settle();
    for (const c of [host, guest]) {
      await waitFor(() => expect(c.ui.queryByRole('dialog', { name: '対局結果' })).toBeNull());
      expect(moves(c)).toContain('0');
    }
    // 再戦では、ゲストが先手
    expect(guest.ui.getByText('あなたの番です')).toBeTruthy();
    expect(host.ui.getByText('相手の番です')).toBeTruthy();
    expect(host.ui.getByLabelText('通算成績').textContent).toContain('あや 1勝');
  });
});

describe('ルームの出入り・復帰', () => {
  it('対局中に「ルームを抜ける」を押すと確認が出て、承諾するとメニューへ戻る', async () => {
    const { host } = await startedPair();
    click(host, 'ルームを抜ける');
    const dialog = host.ui.getByRole('dialog', { name: '確認' });
    expect(dialog.textContent).toContain('ルームを抜けますか');
    click(host, 'キャンセル');
    expect(host.ui.queryByRole('dialog', { name: '確認' })).toBeNull();
    click(host, 'ルームを抜ける');
    fireEvent.click(within(host.container).getAllByRole('button', { name: 'ルームを抜ける' }).at(-1)!);
    expect(await host.ui.findByRole('button', { name: 'ローカル対戦' })).toBeTruthy();
    expect(host.storage.getItem('connect4-3d:online-room')).toBeNull();
  });

  it('ページを再読み込みしても、参加中の対局に復帰する', async () => {
    const { host } = await startedPair();
    click(host, '柱0');
    await waitFor(() => expect(moves(host)).toContain('1'));
    const storage = host.storage;
    host.unmount();
    const again = mount('host', storage);
    // メニューから、オンライン対戦へ入ると、保存されたルームに復帰する
    click(again, 'オンライン対戦');
    await again.ui.findByRole('button', { name: '柱0' });
    expect(moves(again)).toContain('1');
  });

  it('待機中に「やめる」を押すと、ロビーに戻る', async () => {
    const host = mount('host');
    await hostCreatesRoom(host);
    click(host, 'やめる');
    expect(await host.ui.findByRole('button', { name: 'ルームを作る' })).toBeTruthy();
  });

  it('通信が切れている間は「再接続中」と表示し、復帰すると消える', async () => {
    const { host } = await startedPair();
    act(() => server.setConnection('host', 'reconnecting'));
    const bar = within(host.ui.getByLabelText('オンライン対戦の状態'));
    expect(bar.getByRole('status').textContent).toContain('再接続中');
    act(() => server.setConnection('host', 'connected'));
    await settle();
    expect(host.ui.queryByText(/再接続中/)).toBeNull();
  });

  it('名前に HTML を入れても、実行されず、文字として表示される', async () => {
    const host = mount('host');
    click(host, 'オンライン対戦');
    fireEvent.change(host.ui.getByLabelText('あなたの名前'), { target: { value: '<img src=x onerror=1>' } });
    click(host, 'ルームを作る');
    await host.ui.findByText('相手の参加を待っています');
    const link = (host.ui.getByLabelText('招待リンク') as HTMLInputElement).value;
    await guestJoinsByLink(link);
    await host.ui.findByRole('button', { name: '柱0' });
    expect(document.querySelector('img')).toBeNull();
    // 12文字に切り詰められ、HTML としてではなく、文字として表示される
    expect(host.ui.getByLabelText('オンライン対戦の状態').textContent).toContain('<img src=x o');
  });
});
