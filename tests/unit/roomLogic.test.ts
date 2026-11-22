import { describe, expect, it } from 'vitest';
import { buildInviteUrl, parseInviteCode } from '../../src/online/inviteLink';
import {
  indexToPillar, isNewerRow, isValidCode, normalizeCode, pillarToIndex, playerIdOfSeat, replayMoves, rowToView, seatOf,
} from '../../src/online/roomLogic';
import { ROOM_KEY, RoomStore } from '../../src/online/RoomStore';
import type { RoomRow } from '../../src/online/types';

const HOST = 'host-user';
const GUEST = 'guest-user';

const room = (patch: Partial<RoomRow> = {}): RoomRow => ({
  id: '11111111-1111-4111-8111-111111111111',
  code: 'ABC234',
  host_id: HOST,
  guest_id: GUEST,
  host_name: 'あや',
  guest_name: 'ゆう',
  first_player: 0,
  round: 0,
  moves: [],
  status: 'playing',
  winner: null,
  host_wins: 0,
  guest_wins: 0,
  draws: 0,
  updated_at: '2026-11-22T00:00:00Z',
  ...patch,
});

describe('柱の番号の変換', () => {
  it('x*4+z と、往復で一致する', () => {
    for (let i = 0; i < 16; i++) expect(pillarToIndex(indexToPillar(i))).toBe(i);
    expect(pillarToIndex({ x: 2, z: 3 })).toBe(11);
    expect(indexToPillar(11)).toEqual({ x: 2, z: 3 });
  });
});

describe('ルームコード', () => {
  it('大文字・小文字と、前後の空白を区別しない', () => {
    expect(normalizeCode('  abc234 ')).toBe('ABC234');
  });
  it('形式: 紛らわしい文字を含まない6文字', () => {
    expect(isValidCode('ABC234')).toBe(true);
    for (const bad of ['', 'ABC23', 'ABC2345', 'ABC230', 'ABC231', 'ABCOIL', 'abc234', 'ABC 34']) {
      expect(isValidCode(bad)).toBe(false);
    }
  });
});

describe('席と PlayerId', () => {
  it('席を判定する。参加者でなければ null', () => {
    expect(seatOf(room(), HOST)).toBe(0);
    expect(seatOf(room(), GUEST)).toBe(1);
    expect(seatOf(room(), 'other')).toBeNull();
  });
  it('先手の席が、PlayerId 0 になる', () => {
    expect(playerIdOfSeat(0, 0)).toBe(0);
    expect(playerIdOfSeat(1, 0)).toBe(1);
    expect(playerIdOfSeat(0, 1)).toBe(1);
    expect(playerIdOfSeat(1, 1)).toBe(0);
  });
});

describe('replayMoves', () => {
  it('履歴から盤面を再生する', () => {
    const state = replayMoves([0, 0, 5])!;
    expect(state.history).toHaveLength(3);
    expect(state.cells[0]![0]).toEqual([0, 1, null, null]);
  });
  it('満杯の柱への着手、範囲外・小数の番号は null', () => {
    expect(replayMoves([0, 0, 0, 0, 0])).toBeNull();
    expect(replayMoves([16])).toBeNull();
    expect(replayMoves([-1])).toBeNull();
    expect(replayMoves([1.5])).toBeNull();
  });
  it('決着後にも履歴が続く場合は null', () => {
    expect(replayMoves([0, 1, 0, 1, 0, 1, 0, 2])).toBeNull();
  });
});

describe('rowToView', () => {
  it('ホストが先手: 名前・成績が、先手→後手の順に並ぶ', () => {
    const r = rowToView(room({ host_wins: 2, guest_wins: 1, draws: 3 }), HOST);
    if (!r.ok) throw new Error(r.error);
    expect(r.view.names).toEqual(['あや', 'ゆう']);
    expect(r.view.score).toEqual({ wins: [2, 1], draws: 3 });
    expect(r.view.mySeat).toBe(0);
    expect(r.view.myPlayerId).toBe(0);
    expect(r.view.isMyTurn).toBe(true);
    expect(r.view.phase).toBe('playing');
  });

  it('ゲストが先手（再戦後）: 名前・成績の順が入れ替わり、ホストは後手になる', () => {
    const row = room({ first_player: 1, host_wins: 2, guest_wins: 1 });
    const asHost = rowToView(row, HOST);
    const asGuest = rowToView(row, GUEST);
    if (!asHost.ok || !asGuest.ok) throw new Error('view');
    expect(asHost.view.names).toEqual(['ゆう', 'あや']);
    expect(asHost.view.score.wins).toEqual([1, 2]);
    expect(asHost.view.myPlayerId).toBe(1);
    expect(asHost.view.isMyTurn).toBe(false);
    expect(asGuest.view.myPlayerId).toBe(0);
    expect(asGuest.view.isMyTurn).toBe(true);
  });

  it('手番は、手の数に応じて交代する', () => {
    const row = room({ moves: [3] });
    const host = rowToView(row, HOST);
    const guest = rowToView(row, GUEST);
    if (!host.ok || !guest.ok) throw new Error('view');
    expect(host.view.isMyTurn).toBe(false);
    expect(guest.view.isMyTurn).toBe(true);
  });

  it('待機中: 相手の名前は空。手番はない', () => {
    const r = rowToView(room({ status: 'waiting', guest_id: null, guest_name: null }), HOST);
    if (!r.ok) throw new Error(r.error);
    expect(r.view.phase).toBe('waiting');
    expect(r.view.names).toEqual(['あや', '']);
    expect(r.view.isMyTurn).toBe(false);
  });

  it('決着: phase は ended。手番はなく、core の判定が勝者を示す', () => {
    const r = rowToView(room({ moves: [0, 1, 0, 1, 0, 1, 0], status: 'won', winner: 0 }), GUEST);
    if (!r.ok) throw new Error(r.error);
    expect(r.view.phase).toBe('ended');
    expect(r.view.isMyTurn).toBe(false);
    expect(r.view.state.status.kind).toBe('won');
  });

  it('参加者でなければ NOT_A_PLAYER', () => {
    expect(rowToView(room(), 'other')).toEqual({ ok: false, error: 'NOT_A_PLAYER' });
  });

  it('履歴が不正、またはサーバーの status と core の判定が食い違うと INVALID_HISTORY', () => {
    expect(rowToView(room({ moves: [0, 0, 0, 0, 0] }), HOST)).toEqual({ ok: false, error: 'INVALID_HISTORY' });
    expect(rowToView(room({ moves: [0, 1, 0, 1, 0, 1, 0], status: 'playing' }), HOST)).toEqual({
      ok: false,
      error: 'INVALID_HISTORY',
    });
    expect(rowToView(room({ moves: [0], status: 'won' }), HOST)).toEqual({ ok: false, error: 'INVALID_HISTORY' });
  });
});

describe('isNewerRow（行の新旧）', () => {
  it('round → 手の数 → status の段階の順に比べ、より大きい場合だけ新しい', () => {
    const base = room({ moves: [1, 2], status: 'playing' });
    expect(isNewerRow(room({ moves: [1, 2, 3] }), base)).toBe(true);
    expect(isNewerRow(room({ moves: [1] }), base)).toBe(false);
    expect(isNewerRow(base, base)).toBe(false);
    // 同じ手の数でも、決着（won）は、進行中より新しい
    expect(isNewerRow(room({ moves: [1, 2], status: 'won' }), base)).toBe(true);
    expect(isNewerRow(base, room({ moves: [1, 2], status: 'won' }))).toBe(false);
    // 待機中 → 進行中（参加）
    expect(isNewerRow(room({ moves: [], status: 'playing' }), room({ moves: [], status: 'waiting' }))).toBe(true);
  });
  it('再戦（round が増える）は、手の数が少なくても、新しい', () => {
    const ended = room({ round: 0, moves: [0, 1, 0, 1, 0, 1, 0], status: 'won' });
    const rematch = room({ round: 1, moves: [], status: 'playing', first_player: 1 });
    expect(isNewerRow(rematch, ended)).toBe(true);
    expect(isNewerRow(ended, rematch)).toBe(false);
  });
});

describe('招待リンク', () => {
  it('ルームコードつきのリンクを作る（サブパスは保ち、既存のクエリ・ハッシュは取り除く）', () => {
    expect(buildInviteUrl('https://example.com/', 'abc234')).toBe('https://example.com/?room=ABC234');
    expect(buildInviteUrl('https://example.com/game/?x=1#top', 'ABC234')).toBe('https://example.com/game/?room=ABC234');
  });
  it('リンクから、ルームコードを取り出す（小文字・空白は正規化）', () => {
    expect(parseInviteCode('?room=ABC234')).toBe('ABC234');
    expect(parseInviteCode('?foo=1&room=abc234')).toBe('ABC234');
    expect(parseInviteCode('?room=%20abc234%20')).toBe('ABC234');
  });
  it('ない・不正な値は null', () => {
    expect(parseInviteCode('')).toBeNull();
    expect(parseInviteCode('?room=')).toBeNull();
    expect(parseInviteCode('?room=HELLO')).toBeNull();
    expect(parseInviteCode('?room=<script>')).toBeNull();
  });
  it('作ったリンクを、そのまま解析できる', () => {
    const url = new URL(buildInviteUrl('https://example.com/', 'KMNPQR'));
    expect(parseInviteCode(url.search)).toBe('KMNPQR');
  });
});

describe('RoomStore', () => {
  const memory = () => {
    const data: Record<string, string> = {};
    return {
      data,
      getItem: (k: string) => data[k] ?? null,
      setItem: (k: string, v: string) => void (data[k] = v),
      removeItem: (k: string) => void delete data[k],
    };
  };
  const id = '11111111-1111-4111-8111-111111111111';

  it('保存・読込・削除ができる', () => {
    const storage = memory();
    const store = new RoomStore(storage);
    expect(store.get()).toBeNull();
    store.set(id);
    expect(storage.data[ROOM_KEY]).toBe(id);
    expect(new RoomStore(storage).get()).toBe(id);
    store.clear();
    expect(store.get()).toBeNull();
  });

  it('UUID でない値は、無視する', () => {
    const storage = memory();
    storage.data[ROOM_KEY] = '<script>';
    expect(new RoomStore(storage).get()).toBeNull();
  });

  it('保存先が使えなくても、例外にしない', () => {
    const broken = {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('denied'); },
      removeItem: () => { throw new Error('denied'); },
    };
    const store = new RoomStore(broken);
    expect(store.get()).toBeNull();
    expect(() => store.set(id)).not.toThrow();
    expect(() => store.clear()).not.toThrow();
    const none = new RoomStore(null);
    expect(none.get()).toBeNull();
    expect(() => none.set(id)).not.toThrow();
  });
});
