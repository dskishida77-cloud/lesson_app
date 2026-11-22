import type { CellPos } from '../core';

export interface Pattern {
  title: string;
  description: string;
  cells: CellPos[];
}

const seq = [0, 1, 2, 3];

/** 勝利パターンの例。実際の勝利ライン（WIN_LINES）と一致することを、テストで確認している */
export const PATTERNS: Pattern[] = [
  {
    title: '縦（柱の上下）',
    description: '同じ柱に、4段すべて自分の駒を積む。',
    cells: seq.map((y) => ({ x: 1, y, z: 2 })),
  },
  {
    title: '横',
    description: '同じ段の、一列に4つ並べる（左右・奥行きのどちらも同じ）。',
    cells: seq.map((x) => ({ x, y: 0, z: 1 })),
  },
  {
    title: '平面の斜め',
    description: '同じ段の盤面で、斜めに4つ並べる。縦の面での斜め（階段状）も含む。',
    cells: seq.map((i) => ({ x: i, y: 0, z: i })),
  },
  {
    title: '立体の対角線',
    description: '段をまたいで、盤の隅から反対の隅の上段まで、斜めに4つ並べる。',
    cells: seq.map((i) => ({ x: i, y: i, z: i })),
  },
];

const CELL = 18;
const GAP = 2;
const SIZE = 4 * CELL + 3 * GAP;

interface PatternDiagramProps {
  cells: CellPos[];
  title: string;
}

/** 1〜4段目の、上から見た4×4の盤面を並べ、勝利ラインのマスを強調する */
export function PatternDiagram({ cells, title }: PatternDiagramProps) {
  const label = `${title}の例（${cells.map((c) => `${c.y + 1}段目の(${c.x + 1},${c.z + 1})`).join('、')}）`;
  return (
    <div role="img" aria-label={label} className="pattern-levels">
      {seq.map((y) => (
        <figure key={y} className="pattern-level" aria-hidden="true">
          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width="64" height="64">
            {seq.flatMap((z) =>
              seq.map((x) => {
                const hit = cells.some((c) => c.x === x && c.y === y && c.z === z);
                return (
                  <circle
                    key={`${x}-${z}`}
                    cx={x * (CELL + GAP) + CELL / 2}
                    cy={z * (CELL + GAP) + CELL / 2}
                    r={CELL / 2 - 1}
                    data-hit={hit}
                    fill={hit ? '#d6342c' : '#dfe5ef'}
                    stroke={hit ? '#8f1f19' : '#b6c0d1'}
                  />
                );
              }),
            )}
          </svg>
          <figcaption>{y + 1}段目</figcaption>
        </figure>
      ))}
    </div>
  );
}
