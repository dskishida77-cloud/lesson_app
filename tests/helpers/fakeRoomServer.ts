import { applyMove } from '../../src/core';
import { indexToPillar, normalizeCode, replayMoves } from '../../src/online/roomLogic';
import { RoomError } from '../../src/online/types';
import type { ConnectionState, RoomApi, RoomErrorCode, RoomRow, RoomSubscriber } from '../../src/online/types';

interface Subscription {
  userId: string;
  roomId: string;
  subscriber: RoomSubscriber;
}

/**
 * テスト用の偽のサーバー。SQL の関数（create_room / join_room / play_move / rematch）と同じ規則で動く。
 * 2人分の RoomApi（api(userId)）が、同じサーバーを共有する。
 */
export class FakeRoomServer {
  rooms = new Map<string, RoomRow>();
  private subs = new Set<Subscription>();
  private counter = 0;
  /** true の間は、すべての呼び出しが NETWORK エラーになる */
  offline = false;
  /** 次の1回の呼び出しを、指定のエラーで失敗させる */
  private nextFailure: RoomErrorCode | null = null;
  /** 呼び出しの記録（関数名） */
  calls: string[] = [];

  failNext(code: RoomErrorCode) {
    this.nextFailure = code;
  }

  private guard(name: string) {
    this.calls.push(name);
    if (this.offline) throw new RoomError('NETWORK', 'offline');
    if (this.nextFailure) {
      const code = this.nextFailure;
      this.nextFailure = null;
      throw new RoomError(code);
    }
  }

  private save(row: RoomRow, notify = true): RoomRow {
    const saved = { ...row, moves: [...row.moves], updated_at: new Date(++this.counter * 1000).toISOString() };
    this.rooms.set(saved.id, saved);
    if (notify) this.publish(saved);
    return saved;
  }

  /** 参加者の購読者に、行を届ける（非同期。実際の Realtime と同じく、呼び出しの完了後に届く） */
  publish(row: RoomRow) {
    for (const s of this.subs) {
      if (s.roomId !== row.id) continue;
      queueMicrotask(() => s.subscriber.onRow({ ...row, moves: [...row.moves] }));
    }
  }

  /** 購読者への通知を経由せず、任意の行を、特定のユーザーに届ける（古い行・不正な行のテスト用） */
  deliver(userId: string, roomId: string, row: RoomRow) {
    for (const s of this.subs) if (s.userId === userId && s.roomId === roomId) s.subscriber.onRow(row);
  }

  setConnection(userId: string, state: ConnectionState) {
    for (const s of this.subs) if (s.userId === userId) s.subscriber.onConnection(state);
  }

  subscriberCount(): number {
    return this.subs.size;
  }

  /** サーバーの現在の行 */
  row(roomId: string): RoomRow {
    return this.rooms.get(roomId)!;
  }

  api(userId: string): RoomApi {
    const server = this;
    return {
      async ensureUser() {
        server.guard('ensureUser');
        return userId;
      },

      async createRoom(name) {
        server.guard('createRoom');
        const trimmed = name.trim();
        if (!trimmed || trimmed.length > 12) throw new RoomError('INVALID_NAME');
        const id = `00000000-0000-4000-8000-${String(++server.counter).padStart(12, '0')}`;
        const code = `ROOM${String(server.counter).padStart(2, '0')}`.replace(/[01OIL]/g, '2').padEnd(6, '2').slice(0, 6);
        const row: RoomRow = {
          id, code, host_id: userId, guest_id: null, host_name: trimmed, guest_name: null,
          first_player: 0, round: 0, moves: [], status: 'waiting', winner: null,
          host_wins: 0, guest_wins: 0, draws: 0, updated_at: '',
        };
        return server.save(row, false);
      },

      async joinRoom(code, name) {
        server.guard('joinRoom');
        const room = [...server.rooms.values()].find((r) => r.code === normalizeCode(code));
        if (!room) throw new RoomError('ROOM_NOT_FOUND');
        if (room.host_id === userId || room.guest_id === userId) return { ...room };
        if (room.guest_id) throw new RoomError('ROOM_FULL');
        const trimmed = name.trim();
        if (!trimmed || trimmed.length > 12) throw new RoomError('INVALID_NAME');
        return server.save({ ...room, guest_id: userId, guest_name: trimmed, status: 'playing' });
      },

      async playMove(roomId, pillarIndex) {
        server.guard('playMove');
        const room = server.rooms.get(roomId);
        if (!room) throw new RoomError('ROOM_NOT_FOUND');
        const seat = room.host_id === userId ? 0 : room.guest_id === userId ? 1 : null;
        if (seat === null) throw new RoomError('NOT_A_PLAYER');
        if (room.status !== 'playing') throw new RoomError('GAME_NOT_PLAYING');
        if (seat !== (room.first_player + room.moves.length) % 2) throw new RoomError('NOT_YOUR_TURN');
        if (!Number.isInteger(pillarIndex) || pillarIndex < 0 || pillarIndex > 15) throw new RoomError('INVALID_PILLAR');
        const state = replayMoves(room.moves)!;
        const result = applyMove(state, indexToPillar(pillarIndex));
        if (!result.ok) throw new RoomError('PILLAR_FULL');
        const next: RoomRow = { ...room, moves: [...room.moves, pillarIndex] };
        const status = result.state.status;
        if (status.kind === 'won') {
          next.status = 'won';
          next.winner = seat;
          if (seat === 0) next.host_wins++;
          else next.guest_wins++;
        } else if (status.kind === 'draw') {
          next.status = 'draw';
          next.draws++;
        }
        return server.save(next);
      },

      async rematch(roomId) {
        server.guard('rematch');
        const room = server.rooms.get(roomId);
        if (!room) throw new RoomError('ROOM_NOT_FOUND');
        if (room.host_id !== userId && room.guest_id !== userId) throw new RoomError('NOT_A_PLAYER');
        if (room.status !== 'won' && room.status !== 'draw') throw new RoomError('GAME_NOT_FINISHED');
        return server.save({
          ...room, first_player: room.first_player === 0 ? 1 : 0, round: room.round + 1, moves: [], status: 'playing', winner: null,
        });
      },

      async getRoom(roomId) {
        server.guard('getRoom');
        const room = server.rooms.get(roomId);
        // RLS: 参加者でなければ、見えない
        if (!room || (room.host_id !== userId && room.guest_id !== userId)) return null;
        return { ...room, moves: [...room.moves] };
      },

      subscribe(roomId, subscriber) {
        const sub: Subscription = { userId, roomId, subscriber };
        server.subs.add(sub);
        subscriber.onConnection('connecting');
        queueMicrotask(() => {
          if (server.subs.has(sub)) subscriber.onConnection('connected');
        });
        return () => void server.subs.delete(sub);
      },
    };
  }
}
