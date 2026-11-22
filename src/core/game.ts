import { BOARD_SIZE, WIN_LINES } from './lines';
import type {
  CellPos,
  Cells,
  GameState,
  GameStatus,
  Move,
  MoveResult,
  PillarPos,
  PlayerId,
} from './types';

const createEmptyCells = (): Cells =>
  Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => Array<PlayerId | null>(BOARD_SIZE).fill(null)),
  );

const isValidIndex = (v: number) => Number.isInteger(v) && v >= 0 && v < BOARD_SIZE;

const isValidPillar = (pillar: PillarPos) => isValidIndex(pillar.x) && isValidIndex(pillar.z);

export function createGame(firstPlayer: PlayerId = 0): GameState {
  return {
    cells: createEmptyCells(),
    current: firstPlayer,
    history: [],
    status: { kind: 'playing' },
  };
}

/** 次に駒が置かれる段（0〜3）。満杯・範囲外は null */
export function getDropHeight(state: GameState, pillar: PillarPos): number | null {
  if (!isValidPillar(pillar)) return null;
  const column = state.cells[pillar.x]![pillar.z]!;
  const y = column.indexOf(null);
  return y === -1 ? null : y;
}

const isSameCell = (a: CellPos, b: CellPos) => a.x === b.x && a.y === b.y && a.z === b.z;

const isFull = (cells: Cells) => cells.every((row) => row.every((column) => column.every((c) => c !== null)));

/** 直近の着手 last を含むラインのみを確認し、勝敗・引き分けを判定する */
export function checkResult(cells: Cells, last: CellPos): GameStatus {
  const player = cells[last.x]![last.z]![last.y];
  if (player === null || player === undefined) return { kind: 'playing' };

  const lines = WIN_LINES.filter(
    (line) =>
      line.some((c) => isSameCell(c, last)) && line.every((c) => cells[c.x]![c.z]![c.y] === player),
  ).map((line) => line.map((c) => ({ ...c })));

  if (lines.length > 0) return { kind: 'won', winner: player, lines };
  return isFull(cells) ? { kind: 'draw' } : { kind: 'playing' };
}

/** 指定した柱に、現在の手番の駒を落とす。状態は書き換えず、新しい状態を返す */
export function applyMove(state: GameState, pillar: PillarPos): MoveResult {
  if (state.status.kind !== 'playing') return { ok: false, error: 'GAME_OVER' };
  if (!isValidPillar(pillar)) return { ok: false, error: 'OUT_OF_RANGE' };
  const y = getDropHeight(state, pillar);
  if (y === null) return { ok: false, error: 'PILLAR_FULL' };

  const player = state.current;
  const cells = state.cells.map((row, x) =>
    row.map((column, z) =>
      x === pillar.x && z === pillar.z ? column.map((c, i) => (i === y ? player : c)) : column.slice(),
    ),
  );
  const move: Move = {
    player,
    pillar: { x: pillar.x, z: pillar.z },
    landed: { x: pillar.x, y, z: pillar.z },
  };
  const status = checkResult(cells, move.landed);
  const next: GameState = {
    cells,
    // 勝敗が決した場合は、勝者の手番のまま据え置く
    current: status.kind === 'won' ? player : player === 0 ? 1 : 0,
    history: [...state.history, move],
    status,
  };
  return { ok: true, state: next, move };
}

/** 直前の1手を取り消す。履歴が空なら、同じ状態を返す */
export function undo(state: GameState): GameState {
  const last = state.history[state.history.length - 1];
  if (!last) return state;
  const { x, y, z } = last.landed;
  const cells = state.cells.map((row, xi) =>
    row.map((column, zi) =>
      xi === x && zi === z ? column.map((c, yi) => (yi === y ? null : c)) : column.slice(),
    ),
  );
  return {
    cells,
    current: last.player,
    history: state.history.slice(0, -1),
    // 着手できたのは「進行中」の状態だけなので、取り消し後は必ず進行中に戻る
    status: { kind: 'playing' },
  };
}
