import { applyMove, createGame } from '../core';
import type { GameState, PillarPos, PlayerId } from '../core';
import type { OnlinePhase, OnlineView, RoomRow } from './types';

/** ルームコードの形式（紛らわしい 0/O、1/I/L を含まない6文字。SQL の制約と同じ） */
const CODE_PATTERN = /^[A-HJKMNP-Z2-9]{6}$/;

/** 大文字・小文字と、前後の空白を区別しない */
export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export function isValidCode(code: string): boolean {
  return CODE_PATTERN.test(code);
}

/** 柱の位置 → サーバーの柱の番号（x * 4 + z） */
export function pillarToIndex(p: PillarPos): number {
  return p.x * 4 + p.z;
}

export function indexToPillar(index: number): PillarPos {
  return { x: Math.floor(index / 4), z: index % 4 };
}

/** ユーザーの席（0 = ホスト, 1 = ゲスト）。参加者でなければ null */
export function seatOf(row: RoomRow, userId: string): 0 | 1 | null {
  if (row.host_id === userId) return 0;
  if (row.guest_id === userId) return 1;
  return null;
}

/** 席 → core の PlayerId（0 = 先手）。先手の席が、PlayerId 0 になる */
export function playerIdOfSeat(seat: 0 | 1, firstPlayer: 0 | 1): PlayerId {
  return seat === firstPlayer ? 0 : 1;
}

/** 手の履歴を、core で再生して盤面にする。1手でも不正なら、null（サーバーと同じルールで、通常は起きない） */
export function replayMoves(moves: readonly number[]): GameState | null {
  let state = createGame(0);
  for (const index of moves) {
    if (!Number.isInteger(index) || index < 0 || index > 15) return null;
    const result = applyMove(state, indexToPillar(index));
    if (!result.ok) return null;
    state = result.state;
  }
  return state;
}

export type ViewError = 'NOT_A_PLAYER' | 'INVALID_HISTORY';

export type ViewResult = { ok: true; view: OnlineView } | { ok: false; error: ViewError };

const phaseOf = (status: RoomRow['status']): OnlinePhase =>
  status === 'waiting' ? 'waiting' : status === 'playing' ? 'playing' : 'ended';

/** サーバーの行を、画面が使う形に変える */
export function rowToView(row: RoomRow, userId: string): ViewResult {
  const mySeat = seatOf(row, userId);
  if (mySeat === null) return { ok: false, error: 'NOT_A_PLAYER' };

  const state = replayMoves(row.moves);
  if (!state) return { ok: false, error: 'INVALID_HISTORY' };

  // サーバーの判定と、core の判定が食い違う場合は、履歴が壊れているとみなす
  const expected = row.status === 'won' || row.status === 'draw' ? row.status : 'playing';
  const actual = state.status.kind;
  if (row.status !== 'waiting' && actual !== expected) return { ok: false, error: 'INVALID_HISTORY' };

  const first = row.first_player;
  const second: 0 | 1 = first === 0 ? 1 : 0;
  const nameOf = (seat: 0 | 1) => (seat === 0 ? row.host_name : (row.guest_name ?? ''));
  const winsOf = (seat: 0 | 1) => (seat === 0 ? row.host_wins : row.guest_wins);
  const myPlayerId = playerIdOfSeat(mySeat, first);
  const phase = phaseOf(row.status);

  return {
    ok: true,
    view: {
      state,
      mySeat,
      myPlayerId,
      names: [nameOf(first), nameOf(second)],
      score: { wins: [winsOf(first), winsOf(second)], draws: row.draws },
      phase,
      isMyTurn: phase === 'playing' && state.current === myPlayerId,
      code: row.code,
      roomId: row.id,
    },
  };
}

const STAGE: Record<RoomRow['status'], number> = { waiting: 0, playing: 1, won: 2, draw: 2 };

/**
 * next が、current より新しい行か。(round, 手の数, status の段階) を、辞書順で比べる。
 * RPC の返り値と Realtime の通知が、重複したり、順序が逆転したりしても、古い行で上書きしないために使う。
 * （updated_at は、経路によって文字列の形式が違うため、使わない）
 */
export function isNewerRow(next: RoomRow, current: RoomRow): boolean {
  const a = [next.round, next.moves.length, STAGE[next.status]] as const;
  const b = [current.round, current.moves.length, STAGE[current.status]] as const;
  for (let i = 0; i < 3; i++) {
    if (a[i]! !== b[i]!) return a[i]! > b[i]!;
  }
  return false;
}
