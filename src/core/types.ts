/** 0 または 1。先手を 0 とする */
export type PlayerId = 0 | 1;

/** 柱の位置。x, z はそれぞれ 0〜3 */
export interface PillarPos {
  x: number;
  z: number;
}

/** 駒の位置。y は段（0 が最下段、3 が最上段） */
export interface CellPos extends PillarPos {
  y: number;
}

/** 盤面。cells[x][z][y] に、置かれた駒の持ち主（空きは null）を保持する */
export type Cells = (PlayerId | null)[][][];

export interface Move {
  player: PlayerId;
  pillar: PillarPos;
  /** 落ちた先の位置 */
  landed: CellPos;
}

export type GameStatus =
  | { kind: 'playing' }
  | { kind: 'won'; winner: PlayerId; lines: CellPos[][] }
  | { kind: 'draw' };

/** イミュータブルな状態。JSON にシリアライズ可能（将来のオンライン対戦用） */
export interface GameState {
  readonly cells: Cells;
  readonly current: PlayerId;
  readonly history: readonly Move[];
  readonly status: GameStatus;
}

export type MoveError = 'PILLAR_FULL' | 'GAME_OVER' | 'OUT_OF_RANGE';

export type MoveResult =
  | { ok: true; state: GameState; move: Move }
  | { ok: false; error: MoveError };

export interface PlayerSettings {
  names: [string, string];
  firstPlayer: PlayerId;
}

export interface Score {
  wins: [number, number];
  draws: number;
}

export interface PersistedSettings {
  soundEnabled: boolean;
}
