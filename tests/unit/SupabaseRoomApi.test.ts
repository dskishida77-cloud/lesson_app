import { describe, expect, it, vi } from 'vitest';
import { SupabaseRoomApi, parseRoomRow, toRoomError } from '../../src/online/SupabaseRoomApi';
import type { ChannelLike, PostgrestErrorLike, SupabaseLike } from '../../src/online/SupabaseRoomApi';
import { RoomError } from '../../src/online/types';
import type { ConnectionState, RoomRow } from '../../src/online/types';

const ROOM_ID = '11111111-1111-4111-8111-111111111111';

const rawRow = (patch: Record<string, unknown> = {}) => ({
  id: ROOM_ID,
  code: 'ABC234',
  host_id: 'u1',
  guest_id: null,
  host_name: 'あや',
  guest_name: null,
  first_player: 0,
  moves: [],
  status: 'waiting',
  winner: null,
  host_wins: 0,
  guest_wins: 0,
  draws: 0,
  created_at: '2026-11-22T00:00:00Z',
  updated_at: '2026-11-22T00:00:00Z',
  ...patch,
});

type RpcResult = { data: unknown; error: PostgrestErrorLike | null };

function fakeClient(opts: { session?: string | null; rpc?: (fn: string, args: Record<string, unknown>) => RpcResult | Promise<RpcResult> } = {}) {
  const calls = { signIn: 0, rpc: [] as { fn: string; args: Record<string, unknown> }[], removed: [] as unknown[] };
  let onChange: ((p: { new: unknown }) => void) | undefined;
  let onStatus: ((s: string) => void) | undefined;
  let filter: unknown;
  const channel: ChannelLike = {
    on(_t, f, cb) {
      filter = f;
      onChange = cb;
      return channel;
    },
    subscribe(cb) {
      onStatus = cb;
      return channel;
    },
  };
  let maybeSingle: () => Promise<RpcResult> = async () => ({ data: rawRow(), error: null });
  const client: SupabaseLike = {
    auth: {
      getSession: async () => ({ data: { session: opts.session ? { user: { id: opts.session } } : null } }),
      signInAnonymously: async () => {
        calls.signIn++;
        return { data: { user: { id: 'anon-user' } }, error: null };
      },
    },
    rpc: (fn, args) => {
      calls.rpc.push({ fn, args });
      return Promise.resolve(opts.rpc ? opts.rpc(fn, args) : { data: rawRow(), error: null });
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => maybeSingle() }) }) }),
    channel: () => channel,
    removeChannel: async (c) => void calls.removed.push(c),
  };
  return {
    client,
    calls,
    emit: (row: unknown) => onChange?.({ new: row }),
    status: (s: string) => onStatus?.(s),
    getFilter: () => filter,
    setMaybeSingle: (fn: () => Promise<RpcResult>) => void (maybeSingle = fn),
  };
}

describe('toRoomError', () => {
  it('SQL の raise exception のメッセージを、対応するコードにする', () => {
    for (const code of ['ROOM_NOT_FOUND', 'ROOM_FULL', 'NOT_YOUR_TURN', 'PILLAR_FULL', 'INVALID_NAME', 'GAME_NOT_FINISHED']) {
      expect(toRoomError({ message: code, code: 'P0001' }).code).toBe(code);
    }
  });
  it('通信の失敗（code が空、または fetch 系のメッセージ）は NETWORK', () => {
    expect(toRoomError({ message: 'TypeError: Failed to fetch', code: '' }).code).toBe('NETWORK');
    expect(toRoomError({ message: 'Load failed', code: '' }).code).toBe('NETWORK');
    expect(toRoomError({ message: 'network timeout', code: '08006' }).code).toBe('NETWORK');
  });
  it('それ以外は UNKNOWN', () => {
    expect(toRoomError({ message: 'permission denied for table rooms', code: '42501' }).code).toBe('UNKNOWN');
  });
});

describe('parseRoomRow', () => {
  it('正しい行を RoomRow にする（配列で包まれていても可）', () => {
    expect(parseRoomRow(rawRow()).code).toBe('ABC234');
    expect(parseRoomRow([rawRow({ moves: [1, 2] })]).moves).toEqual([1, 2]);
  });
  it('形が違えば例外', () => {
    for (const bad of [null, 'x', {}, rawRow({ status: 'bogus' }), rawRow({ first_player: 2 }), rawRow({ moves: ['a'] }), rawRow({ id: 1 })]) {
      expect(() => parseRoomRow(bad)).toThrow(RoomError);
    }
  });
});

describe('ensureUser', () => {
  it('既存のセッションがあれば、そのユーザーを使い、サインインしない', async () => {
    const f = fakeClient({ session: 'existing' });
    expect(await new SupabaseRoomApi(f.client).ensureUser()).toBe('existing');
    expect(f.calls.signIn).toBe(0);
  });
  it('なければ匿名でサインインする。同時に呼んでも1回だけ', async () => {
    const f = fakeClient();
    const api = new SupabaseRoomApi(f.client);
    const ids = await Promise.all([api.ensureUser(), api.ensureUser(), api.ensureUser()]);
    expect(ids).toEqual(['anon-user', 'anon-user', 'anon-user']);
    expect(f.calls.signIn).toBe(1);
  });
  it('サインインに失敗したら NOT_AUTHENTICATED。次回は、やり直せる', async () => {
    const f = fakeClient();
    let fail = true;
    f.client.auth.signInAnonymously = async () => (fail ? { data: { user: null }, error: { message: 'Anonymous sign-ins are disabled' } } : { data: { user: { id: 'ok' } }, error: null });
    const api = new SupabaseRoomApi(f.client);
    await expect(api.ensureUser()).rejects.toMatchObject({ code: 'NOT_AUTHENTICATED' });
    fail = false;
    expect(await api.ensureUser()).toBe('ok');
  });
  it('通信で例外が出たら NETWORK', async () => {
    const f = fakeClient();
    f.client.auth.getSession = async () => {
      throw new TypeError('Failed to fetch');
    };
    await expect(new SupabaseRoomApi(f.client).ensureUser()).rejects.toMatchObject({ code: 'NETWORK' });
  });
});

describe('RPC', () => {
  it('引数の名前どおりに、RPC を呼び、行を返す', async () => {
    const f = fakeClient({ session: 'u1' });
    const api = new SupabaseRoomApi(f.client);
    await api.createRoom('あや');
    await api.joinRoom('abc234', 'ゆう');
    await api.playMove(ROOM_ID, 7);
    await api.rematch(ROOM_ID);
    expect(f.calls.rpc).toEqual([
      { fn: 'create_room', args: { p_name: 'あや' } },
      { fn: 'join_room', args: { p_code: 'abc234', p_name: 'ゆう' } },
      { fn: 'play_move', args: { p_room_id: ROOM_ID, p_pillar: 7 } },
      { fn: 'rematch', args: { p_room_id: ROOM_ID } },
    ]);
  });
  it('サーバーのエラーを RoomError にする', async () => {
    const f = fakeClient({ session: 'u1', rpc: () => ({ data: null, error: { message: 'NOT_YOUR_TURN', code: 'P0001' } }) });
    await expect(new SupabaseRoomApi(f.client).playMove(ROOM_ID, 1)).rejects.toMatchObject({ code: 'NOT_YOUR_TURN' });
  });
  it('通信エラー（error として返る・例外）は NETWORK', async () => {
    const a = fakeClient({ session: 'u1', rpc: () => ({ data: null, error: { message: 'TypeError: Failed to fetch', code: '' } }) });
    await expect(new SupabaseRoomApi(a.client).playMove(ROOM_ID, 1)).rejects.toMatchObject({ code: 'NETWORK' });
    const b = fakeClient({ session: 'u1' });
    b.client.rpc = () => Promise.reject(new TypeError('Failed to fetch'));
    await expect(new SupabaseRoomApi(b.client).playMove(ROOM_ID, 1)).rejects.toMatchObject({ code: 'NETWORK' });
  });
  it('形の違う返り値は、UNKNOWN', async () => {
    const f = fakeClient({ session: 'u1', rpc: () => ({ data: { nope: true }, error: null }) });
    await expect(new SupabaseRoomApi(f.client).createRoom('a')).rejects.toMatchObject({ code: 'UNKNOWN' });
  });
});

describe('getRoom', () => {
  it('行があれば返し、見えなければ（RLS）null。UUID でなければ、問い合わせずに null', async () => {
    const f = fakeClient({ session: 'u1' });
    const api = new SupabaseRoomApi(f.client);
    expect((await api.getRoom(ROOM_ID))?.id).toBe(ROOM_ID);
    f.setMaybeSingle(async () => ({ data: null, error: null }));
    expect(await api.getRoom(ROOM_ID)).toBeNull();
    expect(await api.getRoom('not-a-uuid')).toBeNull();
  });
  it('エラーは RoomError', async () => {
    const f = fakeClient({ session: 'u1' });
    f.setMaybeSingle(async () => ({ data: null, error: { message: 'Failed to fetch', code: '' } }));
    await expect(new SupabaseRoomApi(f.client).getRoom(ROOM_ID)).rejects.toMatchObject({ code: 'NETWORK' });
  });
});

describe('subscribe', () => {
  const setup = () => {
    const f = fakeClient({ session: 'u1' });
    const rows: RoomRow[] = [];
    const states: ConnectionState[] = [];
    const off = new SupabaseRoomApi(f.client).subscribe(ROOM_ID, { onRow: (r) => rows.push(r), onConnection: (s) => states.push(s) });
    return { f, rows, states, off };
  };

  it('このルームの UPDATE だけを購読する（フィルタに、ルーム ID）', () => {
    const { f } = setup();
    expect(f.getFilter()).toEqual({ event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${ROOM_ID}` });
  });
  it('通知された行を、検証して渡す。形の違う通知は無視する', () => {
    const { f, rows } = setup();
    f.emit(rawRow({ moves: [3], status: 'playing' }));
    f.emit({ broken: true });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.moves).toEqual([3]);
  });
  it('チャンネルの状態を、接続状態に変換する', () => {
    const { f, states } = setup();
    f.status('SUBSCRIBED');
    f.status('CHANNEL_ERROR');
    f.status('TIMED_OUT');
    f.status('SUBSCRIBED');
    f.status('CLOSED');
    f.status('UNKNOWN_STATUS');
    expect(states).toEqual(['connecting', 'connected', 'reconnecting', 'reconnecting', 'connected', 'disconnected']);
  });
  it('解除すると、チャンネルを閉じ、以降の通知は渡さない', () => {
    const { f, rows, states, off } = setup();
    off();
    expect(f.calls.removed).toHaveLength(1);
    f.emit(rawRow({ moves: [1], status: 'playing' }));
    f.status('CLOSED');
    expect(rows).toHaveLength(0);
    expect(states).toEqual(['connecting']);
  });
  it('UUID でないルーム ID は、購読しない（フィルタへの混入を防ぐ）', () => {
    const f = fakeClient({ session: 'u1' });
    const api = new SupabaseRoomApi(f.client);
    expect(() => api.subscribe('x,y=eq.1', { onRow: vi.fn(), onConnection: vi.fn() })).toThrow(RoomError);
  });
});
