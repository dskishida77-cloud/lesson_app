// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WIN_LINES } from '../../../src/core';
import type { CellPos } from '../../../src/core';
import { createDb } from './harness';

let db: PGlite;
beforeAll(async () => {
  db = await createDb();
}, 60_000);
afterAll(async () => {
  await db.close();
});

/** core の CellPos → SQL の添字（0始まりの p*4+y） */
const sqlIndex = (c: CellPos) => (c.x * 4 + c.z) * 4 + c.y;

/** 指定したマスだけを、持ち主 owner にした64マスの配列 */
const cellsWith = (cells: CellPos[], owner: 0 | 1, others: { cell: CellPos; owner: 0 | 1 }[] = []) => {
  const arr = Array<number | null>(64).fill(null);
  for (const c of cells) arr[sqlIndex(c)] = owner;
  for (const o of others) arr[sqlIndex(o.cell)] = o.owner;
  return arr;
};

const isWin = async (cells: (number | null)[], last: CellPos) =>
  (
    await db.query<{ w: boolean }>('select game_private.is_win($1::smallint[], $2::int) as w', [
      `{${cells.map((c) => (c === null ? 'NULL' : c)).join(',')}}`,
      sqlIndex(last),
    ])
  ).rows[0]!.w;

describe('SQL の勝敗判定が、core の全76ラインと一致する', () => {
  it('76ラインが、core と同じ数だけある', () => {
    expect(WIN_LINES).toHaveLength(76);
  });

  it('どのラインも、そのラインのどのマスを直近の着手としても、勝ちになる', async () => {
    for (const line of WIN_LINES) {
      const cells = cellsWith(line, 1);
      for (const last of line) {
        expect(await isWin(cells, last), JSON.stringify(line)).toBe(true);
      }
    }
  }, 120_000);

  it('どのラインも、3マスだけでは、勝ちにならない', async () => {
    for (const line of WIN_LINES) {
      const cells = cellsWith(line.slice(0, 3), 0);
      expect(await isWin(cells, line[2]!), JSON.stringify(line)).toBe(false);
    }
  }, 120_000);

  it('どのラインも、1マスが相手の駒なら、勝ちにならない', async () => {
    for (const line of WIN_LINES) {
      const cells = cellsWith(line.slice(0, 3), 0, [{ cell: line[3]!, owner: 1 }]);
      expect(await isWin(cells, line[0]!), JSON.stringify(line)).toBe(false);
    }
  }, 120_000);

  it('空のマスを直近の着手として渡すと、勝ちにならない', async () => {
    expect(await isWin(Array(64).fill(null), { x: 0, y: 0, z: 0 })).toBe(false);
  });

  it('cells_from_moves が、重力どおりに盤面を作る', async () => {
    const r = await db.query<{ c: (number | null)[] }>(`select game_private.cells_from_moves('{5,5,5,0}'::smallint[]) as c`);
    const c = r.rows[0]!.c;
    // 柱5: y=0,1,2 に、手番 0,1,2 → 持ち主 0,1,0。柱0: y=0 に、手番3 → 持ち主 1
    expect([c[5 * 4], c[5 * 4 + 1], c[5 * 4 + 2], c[5 * 4 + 3]]).toEqual([0, 1, 0, null]);
    expect(c[0]).toBe(1);
    expect(c.filter((v) => v !== null)).toHaveLength(4);
  });
});
