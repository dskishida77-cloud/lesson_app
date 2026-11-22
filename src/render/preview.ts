import { getDropHeight } from '../core';
import type { CellPos, GameState, PillarPos } from '../core';

/** ポインタを重ねた柱で、駒が置かれる位置。置けない場合は null */
export function getPreviewCell(state: GameState, hovered: PillarPos | null): CellPos | null {
  if (!hovered || state.status.kind !== 'playing') return null;
  const y = getDropHeight(state, hovered);
  return y === null ? null : { x: hovered.x, y, z: hovered.z };
}

export function isCellInLines(cell: CellPos, lines: readonly CellPos[][]): boolean {
  return lines.some((line) => line.some((c) => c.x === cell.x && c.y === cell.y && c.z === cell.z));
}
