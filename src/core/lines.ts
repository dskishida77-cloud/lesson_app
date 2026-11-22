import type { CellPos } from './types';

export const BOARD_SIZE = 4;
export const LINE_LENGTH = 4;

/** 26方向のうち、逆向きと重複しない13方向（辞書順で正のもの） */
const DIRECTIONS: readonly (readonly [number, number, number])[] = (() => {
  const dirs: [number, number, number][] = [];
  for (const dx of [-1, 0, 1]) {
    for (const dy of [-1, 0, 1]) {
      for (const dz of [-1, 0, 1]) {
        const isZero = dx === 0 && dy === 0 && dz === 0;
        const first = dx !== 0 ? dx : dy !== 0 ? dy : dz;
        if (!isZero && first > 0) dirs.push([dx, dy, dz]);
      }
    }
  }
  return dirs;
})();

const inRange = (v: number) => v >= 0 && v < BOARD_SIZE;

function generateWinLines(): CellPos[][] {
  const lines: CellPos[][] = [];
  for (let x = 0; x < BOARD_SIZE; x++) {
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let z = 0; z < BOARD_SIZE; z++) {
        for (const [dx, dy, dz] of DIRECTIONS) {
          const last = LINE_LENGTH - 1;
          // 盤の大きさとライン長が同じため、始点から終点が盤内に収まるものだけが有効なライン
          if (!inRange(x + dx * last) || !inRange(y + dy * last) || !inRange(z + dz * last)) continue;
          lines.push(
            Array.from({ length: LINE_LENGTH }, (_, i) => ({
              x: x + dx * i,
              y: y + dy * i,
              z: z + dz * i,
            })),
          );
        }
      }
    }
  }
  return lines;
}

/** 勝利となる全76ライン（起動時に1度だけ生成する） */
export const WIN_LINES: readonly CellPos[][] = generateWinLines();
