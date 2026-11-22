import { RoomError } from './types';
import type { ConnectionState, RoomApi, RoomErrorCode, RoomRow, RoomSubscriber } from './types';

/** supabase-js のうち、使う範囲だけを写した型（テストで、偽物に差し替えられるようにする） */
export interface SupabaseLike {
  auth: {
    getSession(): Promise<{ data: { session: { user: { id: string } } | null }; error?: unknown }>;
    signInAnonymously(): Promise<{ data: { user: { id: string } | null }; error: { message: string } | null }>;
  };
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: PostgrestErrorLike | null }>;
  from(table: 'rooms'): {
    select(columns: '*'): {
      eq(column: 'id', value: string): {
        maybeSingle(): PromiseLike<{ data: unknown; error: PostgrestErrorLike | null }>;
      };
    };
  };
  channel(name: string): ChannelLike;
  removeChannel(channel: ChannelLike): PromiseLike<unknown>;
}

export interface PostgrestErrorLike {
  message: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
}

export interface ChannelLike {
  on(
    type: 'postgres_changes',
    filter: { event: 'UPDATE'; schema: 'public'; table: 'rooms'; filter: string },
    callback: (payload: { new: unknown }) => void,
  ): ChannelLike;
  subscribe(callback: (status: string, err?: unknown) => void): ChannelLike;
}

const SERVER_ERRORS: readonly RoomErrorCode[] = [
  'NOT_AUTHENTICATED',
  'INVALID_NAME',
  'ROOM_NOT_FOUND',
  'ROOM_FULL',
  'NOT_A_PLAYER',
  'GAME_NOT_PLAYING',
  'NOT_YOUR_TURN',
  'INVALID_PILLAR',
  'PILLAR_FULL',
  'GAME_NOT_FINISHED',
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Supabase のエラーを、RoomError に変える。
 * - SQL の `raise exception 'CODE'` は、error.message が CODE そのもの（code は P0001）。
 * - 通信の失敗は、例外ではなく error として返り、code が空になる（message は「TypeError: Failed to fetch」など）。
 */
export function toRoomError(error: PostgrestErrorLike | { message: string }): RoomError {
  const message = (error.message ?? '').trim();
  const known = SERVER_ERRORS.find((c) => message === c || message.includes(c));
  if (known) return new RoomError(known, message);
  const code = 'code' in error ? error.code : undefined;
  if (!code || /fetch|network|timeout|abort|load failed/i.test(message)) return new RoomError('NETWORK', message);
  return new RoomError('UNKNOWN', message);
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** サーバーから届いた値を、RoomRow として検証する（形が違えば、例外） */
export function parseRoomRow(value: unknown): RoomRow {
  const v = Array.isArray(value) ? value[0] : value;
  if (!isObject(v)) throw new RoomError('UNKNOWN', 'invalid room row');
  const str = (k: string) => (typeof v[k] === 'string' ? (v[k] as string) : null);
  const num = (k: string) => (typeof v[k] === 'number' ? (v[k] as number) : null);
  const id = str('id');
  const code = str('code');
  const hostId = str('host_id');
  const hostName = str('host_name');
  const status = str('status');
  const first = num('first_player');
  const moves = v.moves;
  if (
    !id || !code || !hostId || hostName === null ||
    (status !== 'waiting' && status !== 'playing' && status !== 'won' && status !== 'draw') ||
    (first !== 0 && first !== 1) ||
    !Array.isArray(moves) || !moves.every((m) => typeof m === 'number')
  ) {
    throw new RoomError('UNKNOWN', 'invalid room row');
  }
  const winner = v.winner === 0 || v.winner === 1 ? v.winner : null;
  return {
    id,
    code,
    host_id: hostId,
    guest_id: str('guest_id'),
    host_name: hostName,
    guest_name: str('guest_name'),
    first_player: first,
    moves: moves as number[],
    status,
    winner,
    host_wins: num('host_wins') ?? 0,
    guest_wins: num('guest_wins') ?? 0,
    draws: num('draws') ?? 0,
    updated_at: str('updated_at') ?? '',
  };
}

const STATUS_TO_CONNECTION: Record<string, ConnectionState> = {
  SUBSCRIBED: 'connected',
  CHANNEL_ERROR: 'reconnecting',
  TIMED_OUT: 'reconnecting',
  CLOSED: 'disconnected',
};

/** RoomApi の Supabase 実装 */
export class SupabaseRoomApi implements RoomApi {
  private userPromise: Promise<string> | null = null;

  constructor(private readonly client: SupabaseLike) {}

  /** 匿名セッションがあればそのユーザー、なければ作る。同時に呼ばれても、サインインは1回だけ */
  ensureUser(): Promise<string> {
    this.userPromise ??= this.resolveUser().catch((e: unknown) => {
      this.userPromise = null; // 失敗したら、次回やり直せるようにする
      throw e;
    });
    return this.userPromise;
  }

  private async resolveUser(): Promise<string> {
    try {
      const { data } = await this.client.auth.getSession();
      if (data.session?.user.id) return data.session.user.id;
      const { data: signedIn, error } = await this.client.auth.signInAnonymously();
      if (error || !signedIn.user) {
        throw new RoomError('NOT_AUTHENTICATED', error?.message ?? 'anonymous sign-in failed');
      }
      return signedIn.user.id;
    } catch (e) {
      if (e instanceof RoomError) throw e;
      throw new RoomError('NETWORK', e instanceof Error ? e.message : String(e));
    }
  }

  private async rpc(fn: string, args: Record<string, unknown>): Promise<RoomRow> {
    await this.ensureUser();
    let result;
    try {
      result = await this.client.rpc(fn, args);
    } catch (e) {
      throw new RoomError('NETWORK', e instanceof Error ? e.message : String(e));
    }
    if (result.error) throw toRoomError(result.error);
    return parseRoomRow(result.data);
  }

  createRoom(name: string) {
    return this.rpc('create_room', { p_name: name });
  }

  joinRoom(code: string, name: string) {
    return this.rpc('join_room', { p_code: code, p_name: name });
  }

  playMove(roomId: string, pillarIndex: number) {
    return this.rpc('play_move', { p_room_id: roomId, p_pillar: pillarIndex });
  }

  rematch(roomId: string) {
    return this.rpc('rematch', { p_room_id: roomId });
  }

  async getRoom(roomId: string): Promise<RoomRow | null> {
    if (!UUID.test(roomId)) return null;
    await this.ensureUser();
    let result;
    try {
      result = await this.client.from('rooms').select('*').eq('id', roomId).maybeSingle();
    } catch (e) {
      throw new RoomError('NETWORK', e instanceof Error ? e.message : String(e));
    }
    if (result.error) throw toRoomError(result.error);
    // RLS により、参加者でなければ、行は見えない（null）
    return result.data ? parseRoomRow(result.data) : null;
  }

  subscribe(roomId: string, subscriber: RoomSubscriber): () => void {
    // フィルタに値を埋め込むため、UUID 以外は受け付けない
    if (!UUID.test(roomId)) throw new RoomError('UNKNOWN', 'invalid room id');
    let closed = false;
    subscriber.onConnection('connecting');

    const channel = this.client
      .channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (payload) => {
          if (closed) return;
          try {
            subscriber.onRow(parseRoomRow(payload.new));
          } catch {
            // 形の違う通知は無視する（次の通知か、再同期で、最新の状態になる）
          }
        },
      )
      .subscribe((status) => {
        const state = STATUS_TO_CONNECTION[status];
        if (!closed && state) subscriber.onConnection(state);
      });

    return () => {
      closed = true;
      void this.client.removeChannel(channel);
    };
  }
}
