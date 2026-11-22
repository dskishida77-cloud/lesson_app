import { describe, expect, it } from 'vitest';
import { PILLAR_SPACING, cellToWorld, pillarToWorld } from '../../src/render/layout';

describe('layout', () => {
  it('柱の座標は、盤面の中心(0,0)に対して対称である', () => {
    const a = pillarToWorld({ x: 0, z: 0 });
    const b = pillarToWorld({ x: 3, z: 3 });
    expect(a[0]).toBeCloseTo(-b[0]);
    expect(a[1]).toBeCloseTo(-b[1]);
    expect(b[0] - a[0]).toBeCloseTo(PILLAR_SPACING * 3);
  });

  it('同じ柱の駒は、段が上がるほど高い位置になる', () => {
    const ys = [0, 1, 2, 3].map((y) => cellToWorld({ x: 1, y, z: 2 })[1]);
    expect(ys).toEqual([...ys].sort((p, q) => p - q));
    expect(new Set(ys).size).toBe(4);
  });

  it('駒は土台の上に載る（最下段の高さは0より大きい）', () => {
    expect(cellToWorld({ x: 0, y: 0, z: 0 })[1]).toBeGreaterThan(0);
  });

  it('cellToWorld の x,z は、柱の位置と一致する', () => {
    const [px, pz] = pillarToWorld({ x: 2, z: 1 });
    const [cx, , cz] = cellToWorld({ x: 2, y: 3, z: 1 });
    expect([cx, cz]).toEqual([px, pz]);
  });
});
