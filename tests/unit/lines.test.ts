import { describe, expect, it } from 'vitest';
import { WIN_LINES } from '../../src/core/lines';
import type { CellPos } from '../../src/core/types';

const key = (c: CellPos) => `${c.x},${c.y},${c.z}`;
const lineKey = (line: CellPos[]) =>
  line.map(key).sort().join('|');

/** 4点が一直線（等間隔）かどうか */
const isStraight = (line: CellPos[]) => {
  const [a, b] = [line[0]!, line[1]!];
  const d = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  return line.every((c, i) =>
    c.x === a.x + d.x * i && c.y === a.y + d.y * i && c.z === a.z + d.z * i);
};

describe('WIN_LINES', () => {
  it('全部で76ラインある', () => {
    expect(WIN_LINES).toHaveLength(76);
  });

  it('各ラインは4マスで、盤面内の一直線である', () => {
    for (const line of WIN_LINES) {
      expect(line).toHaveLength(4);
      for (const c of line) {
        for (const v of [c.x, c.y, c.z]) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(3);
        }
      }
      expect(isStraight(line)).toBe(true);
    }
  });

  it('重複するラインがない（向きが逆のものも同一とみなす）', () => {
    const keys = new Set(WIN_LINES.map(lineKey));
    expect(keys.size).toBe(76);
  });

  it('内訳: 軸方向48・平面上の斜め24・立体対角線4', () => {
    const kinds = { axis: 0, planeDiagonal: 0, spaceDiagonal: 0 };
    for (const line of WIN_LINES) {
      const a = line[0]!;
      const b = line[3]!;
      const changed = [a.x !== b.x, a.y !== b.y, a.z !== b.z].filter(Boolean).length;
      if (changed === 1) kinds.axis++;
      else if (changed === 2) kinds.planeDiagonal++;
      else kinds.spaceDiagonal++;
    }
    expect(kinds).toEqual({ axis: 48, planeDiagonal: 24, spaceDiagonal: 4 });
  });
});
