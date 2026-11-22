import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { PillarPos } from '../../src/core';
import { RoomStore } from '../../src/online/RoomStore';
import { useOnlineGame } from '../../src/online/useOnlineGame';
import type { UseOnlineGame } from '../../src/online/useOnlineGame';
import { FakeRoomServer } from '../helpers/fakeRoomServer';

const memoryStorage = () => {
  const data: Record<string, string> = {};
  return {
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => void (data[k] = v),
    removeItem: (k: string) => void delete data[k],
  };
};

const p = (x: number, z: number): PillarPos => ({ x, z });
const HOST = 'host';
const GUEST = 'guest';

let server: FakeRoomServer;
beforeEach(() => {
  server = new FakeRoomServer();
});

/** 1人分のフックを、サーバーに接続して作る */
function player(userId: string, storage = memoryStorage()) {
  const notices: string[] = [];
  const store = new RoomStore(storage);
  // 実アプリと同じく、api は、1つのものを使い回す（描画のたびに作り直すと、購読をやり直し続けてしまう）
  const api = server.api(userId);
  const hook = renderHook(() => useOnlineGame({ api, store, onNotice: (m) => notices.push(m) }));
  return { hook, notices, store, storage, get: (): UseOnlineGame => hook.result.current };
}
type Player = ReturnType<typeof player>;

/** 非同期の更新を、すべて反映させる */
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

async function startedGame() {
  const host = player(HOST);
  const guest = player(GUEST);
  await act(async () => host.get().createRoom('あや'));
  const code = host.get().view!.code;
  await act(async () => guest.get().joinRoom(code, 'ゆう'));
  await settle();
  return { host, guest, code };
}

/** 着手して、落下アニメーションの完了まで進める（両者） */
async function move(who: Player, others: Player[], pillar: PillarPos) {
  let result = 'IGNORED';
  await act(async () => { result = await who.get().selectPillar(pillar); });
  await settle();
  for (const pl of [who, ...others]) await act(async () => pl.get().dropFinished());
  return result;
}

describe('ルームの作成と参加', () => {
  it('ルームを作ると、待機中になり、参加中のルームが保存される', async () => {
    const host = player(HOST);
    expect(host.get().stage).toBe('lobby');
    await act(async () => host.get().createRoom('  あや '));
    expect(host.get().stage).toBe('room');
    expect(host.get().view).toMatchObject({ phase: 'waiting', names: ['あや', ''], mySeat: 0, isMyTurn: false });
    expect(host.store.get()).toBe(host.get().view!.roomId);
  });

  it('相手が参加すると、ホストの画面が、自動で対局中に切り替わる', async () => {
    const { host, guest } = await startedGame();
    expect(host.get().view).toMatchObject({ phase: 'playing', names: ['あや', 'ゆう'], myPlayerId: 0, isMyTurn: true });
    expect(guest.get().view).toMatchObject({ phase: 'playing', names: ['あや', 'ゆう'], myPlayerId: 1, isMyTurn: false });
    expect(host.get().connection).toBe('connected');
  });

  it('コードの大文字・小文字と空白は、区別しない', async () => {
    const host = player(HOST);
    const guest = player(GUEST);
    await act(async () => host.get().createRoom('あや'));
    const code = host.get().view!.code;
    await act(async () => guest.get().joinRoom(` ${code.toLowerCase()} `, 'ゆう'));
    expect(guest.get().stage).toBe('room');
  });

  it('不正な入力は、通信せずにエラー。存在しない・満員も、ロビーにエラーを出す', async () => {
    const guest = player(GUEST);
    await act(async () => guest.get().createRoom('   '));
    expect(guest.get().error).toBe('INVALID_NAME');
    await act(async () => guest.get().joinRoom('abc', 'ゆう'));
    expect(guest.get().error).toBe('ROOM_NOT_FOUND');
    await act(async () => guest.get().joinRoom('ABC234', ''));
    expect(guest.get().error).toBe('INVALID_NAME');
    expect(server.calls).not.toContain('joinRoom');

    await act(async () => guest.get().joinRoom('ABC234', 'ゆう'));
    expect(guest.get().error).toBe('ROOM_NOT_FOUND');
    expect(guest.get().stage).toBe('lobby');

    const { code } = await startedGame();
    const third = player('carol');
    await act(async () => third.get().joinRoom(code, 'まい'));
    expect(third.get().error).toBe('ROOM_FULL');
    act(() => third.get().dismissError());
    expect(third.get().error).toBeNull();
  });

  it('通信エラーは、ロビーに NETWORK を出す', async () => {
    const host = player(HOST);
    server.failNext('NETWORK');
    await act(async () => host.get().createRoom('あや'));
    // 最初の呼び出し（ensureUser）が失敗する
    expect(host.get().error).toBe('NETWORK');
    expect(host.get().stage).toBe('lobby');
  });
});

describe('対局', () => {
  it('着手すると、自分と相手の画面に反映され、双方で落下アニメーションになる。完了すると、解除される', async () => {
    const { host, guest } = await startedGame();
    await act(async () => { await host.get().selectPillar(p(1, 2)); });
    await settle();
    expect(host.get().view!.state.history).toHaveLength(1);
    expect(guest.get().view!.state.history).toHaveLength(1);
    expect(host.get().isAnimating).toBe(true);
    expect(guest.get().isAnimating).toBe(true);
    expect(host.get().view!.isMyTurn).toBe(false);
    expect(guest.get().view!.isMyTurn).toBe(true);
    act(() => host.get().dropFinished());
    expect(host.get().isAnimating).toBe(false);
  });

  it('RPC の返り値と Realtime の通知が重複しても、二重には反映されない（アニメーションも1回）', async () => {
    const { host } = await startedGame();
    await act(async () => { await host.get().selectPillar(p(0, 0)); });
    act(() => host.get().dropFinished());
    await settle(); // 遅れて届く通知
    expect(host.get().view!.state.history).toHaveLength(1);
    expect(host.get().isAnimating).toBe(false);
  });

  it('アニメーション中の入力は、無視する', async () => {
    const { host, guest } = await startedGame();
    await act(async () => { await host.get().selectPillar(p(0, 0)); });
    await settle();
    // ゲストの画面は、アニメーション中
    let result = '';
    await act(async () => { result = await guest.get().selectPillar(p(1, 1)); });
    expect(result).toBe('IGNORED');
    expect(server.row(host.get().view!.roomId).moves).toEqual([0]);
  });

  it('相手の手番では、送信せず、通知する', async () => {
    const { guest } = await startedGame();
    const before = server.calls.length;
    let result = '';
    await act(async () => { result = await guest.get().selectPillar(p(0, 0)); });
    expect(result).toBe('NOT_YOUR_TURN');
    expect(guest.notices).toEqual(['相手の手番です。']);
    expect(server.calls.length).toBe(before);
  });

  it('満杯の柱は、送信せず、通知する', async () => {
    const { host, guest } = await startedGame();
    for (const who of [host, guest, host, guest]) await move(who, [host, guest].filter((x) => x !== who), p(3, 3));
    const before = server.calls.length;
    let result = '';
    await act(async () => { result = await host.get().selectPillar(p(3, 3)); });
    expect(result).toBe('PILLAR_FULL');
    expect(host.notices.at(-1)).toBe('この柱は満杯です。');
    expect(server.calls.length).toBe(before);
  });

  it('送信中の二重送信は、無視する', async () => {
    const { host } = await startedGame();
    const results: string[] = [];
    await act(async () => {
      const a = host.get().selectPillar(p(0, 0));
      const b = host.get().selectPillar(p(1, 1));
      results.push(await a, await b);
    });
    expect(results).toEqual(['SENT', 'IGNORED']);
    expect(server.row(host.get().view!.roomId).moves).toEqual([0]);
  });

  it('送信に失敗したら、通知して、盤面は変えない。もう一度選べる', async () => {
    const { host } = await startedGame();
    server.failNext('NETWORK');
    let result = '';
    await act(async () => { result = await host.get().selectPillar(p(0, 0)); });
    expect(result).toBe('FAILED');
    expect(host.notices.at(-1)).toContain('送信に失敗しました');
    expect(host.get().view!.state.history).toHaveLength(0);
    expect(host.get().isAnimating).toBe(false);
    await act(async () => { result = await host.get().selectPillar(p(0, 0)); });
    expect(result).toBe('SENT');
  });

  it('古い行（手の数が少ない）が、遅れて届いても、上書きしない', async () => {
    const { host, guest } = await startedGame();
    const oldRow = { ...server.row(host.get().view!.roomId) };
    await move(host, [guest], p(0, 0));
    await move(guest, [host], p(1, 1));
    act(() => server.deliver(HOST, oldRow.id, oldRow));
    expect(host.get().view!.state.history).toHaveLength(2);
  });

  it('2手以上まとめて進んだ場合は、アニメーションなしで、最新の盤面にする', async () => {
    const { host, guest } = await startedGame();
    const room = server.row(host.get().view!.roomId);
    act(() => server.deliver(GUEST, room.id, { ...room, moves: [0, 1, 2], status: 'playing', round: 0 }));
    expect(guest.get().view!.state.history).toHaveLength(3);
    expect(guest.get().isAnimating).toBe(false);
  });

  it('サーバーの履歴が不正なら、fatal になり、ルームを抜けて復帰できる', async () => {
    const { host } = await startedGame();
    const room = server.row(host.get().view!.roomId);
    act(() => server.deliver(HOST, room.id, { ...room, moves: [0, 0, 0, 0, 0], status: 'playing' }));
    expect(host.get().stage).toBe('fatal');
    act(() => host.get().leave());
    expect(host.get().stage).toBe('lobby');
  });
});

describe('決着と再戦', () => {
  async function wonGame() {
    const g = await startedGame();
    const seq: [Player, PillarPos][] = [
      [g.host, p(0, 0)], [g.guest, p(1, 0)], [g.host, p(0, 0)], [g.guest, p(1, 0)],
      [g.host, p(0, 0)], [g.guest, p(1, 0)], [g.host, p(0, 0)],
    ];
    for (const [who, pillar] of seq) await move(who, [g.host, g.guest].filter((x) => x !== who), pillar);
    return g;
  }

  it('縦に4つ並べると、双方の画面が、決着になる。成績が更新される', async () => {
    const { host, guest } = await wonGame();
    for (const pl of [host, guest]) {
      expect(pl.get().view!.phase).toBe('ended');
      expect(pl.get().view!.state.status).toMatchObject({ kind: 'won', winner: 0 });
      expect(pl.get().view!.score).toEqual({ wins: [1, 0], draws: 0 });
      expect(pl.get().view!.isMyTurn).toBe(false);
    }
    let result = '';
    await act(async () => { result = await guest.get().selectPillar(p(2, 2)); });
    expect(result).toBe('IGNORED');
  });

  it('再戦すると、先手と後手が入れ替わり、双方の盤面が空になる（アニメーションなし）。成績は保持される', async () => {
    const { host, guest } = await wonGame();
    await act(async () => host.get().rematch());
    await settle();
    for (const pl of [host, guest]) {
      expect(pl.get().view!.phase).toBe('playing');
      expect(pl.get().view!.state.history).toHaveLength(0);
      expect(pl.get().isAnimating).toBe(false);
      expect(pl.get().view!.score).toEqual({ wins: [0, 1], draws: 0 }); // 先手がゲストに変わり、順序が入れ替わる
    }
    expect(host.get().view!.isMyTurn).toBe(false);
    expect(guest.get().view!.isMyTurn).toBe(true);
    expect(guest.get().view!.myPlayerId).toBe(0);
  });

  it('双方が同時に再戦を押しても、先手は、1回しか入れ替わらない', async () => {
    const { host, guest } = await wonGame();
    await act(async () => {
      await Promise.all([host.get().rematch(), guest.get().rematch()]);
    });
    await settle();
    expect(server.row(host.get().view!.roomId).first_player).toBe(1);
    expect(host.get().view!.phase).toBe('playing');
    expect(guest.get().view!.phase).toBe('playing');
  });

  it('決着前の再戦は、何もしない', async () => {
    const { host } = await startedGame();
    const before = server.calls.length;
    await act(async () => host.get().rematch());
    expect(server.calls.length).toBe(before);
  });
});

describe('復帰・再接続・退出', () => {
  it('再読み込みしても、保存したルームに復帰する', async () => {
    const { host } = await startedGame();
    const roomId = host.get().view!.roomId;
    host.hook.unmount();
    const again = player(HOST, host.storage);
    expect(again.get().stage).toBe('busy');
    expect(again.get().busy).toBe('restoring');
    await waitFor(() => expect(again.get().stage).toBe('room'));
    expect(again.get().view!.roomId).toBe(roomId);
    expect(again.get().view!.phase).toBe('playing');
  });

  it('参加者でない・見つからないルームは、保存を消して、ロビーに戻る', async () => {
    const { host } = await startedGame();
    const other = player('stranger', memoryStorage());
    other.store.set(host.get().view!.roomId);
    other.hook.unmount();
    const again = player('stranger', other.storage);
    await waitFor(() => expect(again.get().stage).toBe('lobby'));
    expect(again.store.get()).toBeNull();
  });

  it('復帰時に通信できなければ、保存を残して、ロビーに戻る', async () => {
    const { host } = await startedGame();
    host.hook.unmount();
    server.offline = true;
    const again = player(HOST, host.storage);
    await waitFor(() => expect(again.get().stage).toBe('lobby'));
    expect(again.store.get()).not.toBeNull();
    expect(again.notices.at(-1)).toContain('通信に失敗');
  });

  it('切断中に相手が打っても、再接続したときに、最新の盤面に同期される', async () => {
    const { host, guest } = await startedGame();
    act(() => server.setConnection(GUEST, 'reconnecting'));
    expect(guest.get().connection).toBe('reconnecting');
    // ゲストへの通知が届かない間に、ホストが打つ（通知は、公開せずに、サーバーだけを更新する）
    const room = server.row(host.get().view!.roomId);
    const updated = { ...room, moves: [5] };
    server.rooms.set(room.id, updated);
    act(() => server.setConnection(GUEST, 'connected'));
    await settle();
    expect(guest.get().connection).toBe('connected');
    expect(guest.get().view!.state.history).toHaveLength(1);
    expect(guest.get().view!.isMyTurn).toBe(true);
  });

  it('ルームを抜けると、ロビーに戻り、保存と購読が消える', async () => {
    const { host } = await startedGame();
    expect(server.subscriberCount()).toBe(2);
    act(() => host.get().leave());
    expect(host.get().stage).toBe('lobby');
    expect(host.get().view).toBeNull();
    expect(host.store.get()).toBeNull();
    expect(server.subscriberCount()).toBe(1);
  });

  it('ルームが見えなくなったら（再同期で null）、通知して、ロビーに戻る', async () => {
    const { host } = await startedGame();
    server.rooms.delete(host.get().view!.roomId);
    act(() => server.setConnection(HOST, 'connected'));
    await settle();
    expect(host.get().stage).toBe('lobby');
    expect(host.notices.at(-1)).toContain('見つかりません');
  });
});
