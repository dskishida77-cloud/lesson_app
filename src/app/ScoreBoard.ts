import type { GameStatus, Score } from '../core';

export const emptyScore = (): Score => ({ wins: [0, 0], draws: 0 });

/** 終了した対局の結果を加算する。進行中なら何もしない。通算成績は、ページを開いている間だけ保持する */
export function recordResult(score: Score, status: GameStatus): Score {
  switch (status.kind) {
    case 'won': {
      const wins: [number, number] = [score.wins[0], score.wins[1]];
      wins[status.winner] += 1;
      return { ...score, wins };
    }
    case 'draw':
      return { ...score, draws: score.draws + 1 };
    case 'playing':
      return score;
  }
}

/** 「1手戻す」で終了した対局を取り消したときに、加算した結果を元に戻す */
export function revertResult(score: Score, status: GameStatus): Score {
  switch (status.kind) {
    case 'won': {
      const wins: [number, number] = [score.wins[0], score.wins[1]];
      wins[status.winner] = Math.max(0, wins[status.winner] - 1);
      return { ...score, wins };
    }
    case 'draw':
      return { ...score, draws: Math.max(0, score.draws - 1) };
    case 'playing':
      return score;
  }
}
