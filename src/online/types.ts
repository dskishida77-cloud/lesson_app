import type { GameState, PlayerId, Score } from '../core';

/** サーバーの rooms の1行（スネークケースの列を、そのまま写す） */
export interface RoomRow {
  id: string;
  code: string;
  host_id: string;
  guest_id: string | null;
  host_name: string;
  guest_name: string | null;
  /** 先手の席（0 = ホスト, 1 = ゲスト） */
  first_player: 0 | 1;
  /** 打たれた柱の番号（x * 4 + z）を、打った順に並べたもの */
  moves: number[];
  status: 'waiting' | 'playing' | 'won' | 'draw';
  /** 勝者の席 */
  winner: 0 | 1 | null;
  host_wins: number;
  guest_wins: number;
  draws: number;
  updated_at: string;
}

export type RoomErrorCode =
  | 'NOT_CONFIGURED'
  | 'NOT_AUTHENTICATED'
  | 'INVALID_NAME'
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'NOT_A_PLAYER'
  | 'GAME_NOT_PLAYING'
  | 'NOT_YOUR_TURN'
  | 'INVALID_PILLAR'
  | 'PILLAR_FULL'
  | 'GAME_NOT_FINISHED'
  | 'NETWORK'
  | 'UNKNOWN';

/** 通信層が投げるエラー。code で原因を区別する */
export class RoomError extends Error {
  constructor(
    readonly code: RoomErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'RoomError';
  }
}

export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export interface RoomSubscriber {
  onRow(row: RoomRow): void;
  onConnection(state: ConnectionState): void;
}

/** 通信層。Supabase の実装と、テスト用の偽物を、差し替えられる */
export interface RoomApi {
  /** 現在のユーザー ID を返す（匿名セッションがなければ作る） */
  ensureUser(): Promise<string>;
  createRoom(name: string): Promise<RoomRow>;
  joinRoom(code: string, name: string): Promise<RoomRow>;
  playMove(roomId: string, pillarIndex: number): Promise<RoomRow>;
  rematch(roomId: string): Promise<RoomRow>;
  /** 自分が参加しているルームを取得する。見つからない・参加者でない場合は null */
  getRoom(roomId: string): Promise<RoomRow | null>;
  /** ルームの更新を購読する。戻り値の関数で、購読を解除する */
  subscribe(roomId: string, subscriber: RoomSubscriber): () => void;
}

export type OnlinePhase = 'waiting' | 'playing' | 'ended';

/** 画面が使う形（席や先手の違いを吸収したもの） */
export interface OnlineView {
  /** core で、手の履歴を再生した盤面 */
  state: GameState;
  mySeat: 0 | 1;
  /** 自分の駒（0 = 先手） */
  myPlayerId: PlayerId;
  /** PlayerId の順（先手の名前, 後手の名前）。相手が未参加の間は、空文字 */
  names: [string, string];
  /** names と同じ順の、通算成績 */
  score: Score;
  phase: OnlinePhase;
  isMyTurn: boolean;
  code: string;
  roomId: string;
}
