import { BOARD_SIZE } from './lines';
import type { Cells, GameState, Move, MoveResult, PillarPos, PlayerId } from './types';

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

/** 指定した柱に、現在の手番の駒を落とす。状態は書き換えず、新しい状態を返す */
export function applyMove(state: GameState, pillar: PillarPos): MoveResult {
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
  const next: GameState = {
    cells,
    current: player === 0 ? 1 : 0,
    history: [...state.history, move],
    status: state.status,
  };
  return { ok: true, state: next, move };
}
