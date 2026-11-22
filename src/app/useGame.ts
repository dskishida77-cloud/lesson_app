import { useCallback, useReducer, useRef } from 'react';
import { applyMove, createGame, undo } from '../core';
import type { GameState, MoveError, PillarPos, PlayerSettings, Score } from '../core';
import { emptyScore, recordResult, revertResult } from './ScoreBoard';

export { DEFAULT_NAMES } from './defaults';
import { DEFAULT_NAMES } from './defaults';

interface GameModel {
  game: GameState;
  names: [string, string];
  score: Score;
  /** 駒の落下アニメーション中か（中は入力を受け付けない） */
  animating: boolean;
}

type Action =
  | { type: 'start'; settings: PlayerSettings }
  | { type: 'move'; pillar: PillarPos }
  | { type: 'undo' }
  | { type: 'restart'; swapFirst: boolean }
  | { type: 'dropFinished' };

export type SelectError = MoveError | 'ANIMATING';

/** 純粋なリデューサ。着手に失敗する場合は、同じモデルを返す */
export function reducer(model: GameModel, action: Action): GameModel {
  switch (action.type) {
    case 'start':
      return {
        game: createGame(action.settings.firstPlayer),
        names: action.settings.names,
        score: emptyScore(),
        animating: false,
      };
    case 'move': {
      if (model.animating) return model;
      const result = applyMove(model.game, action.pillar);
      if (!result.ok) return model;
      // 決着した手のときだけ、成績を加算する（終了後は着手できないので、二重に加算されない）
      return {
        ...model,
        game: result.state,
        score: recordResult(model.score, result.state.status),
        animating: true,
      };
    }
    case 'undo': {
      // 落下中や、取り消す手がない場合は何もしない
      if (model.animating || model.game.history.length === 0) return model;
      return {
        ...model,
        game: undo(model.game),
        // 終了した対局を取り消す場合は、加算済みの成績も元に戻す
        score: revertResult(model.score, model.game.status),
      };
    }
    case 'restart': {
      const first = model.game.history[0]?.player ?? model.game.current;
      const next = action.swapFirst ? (first === 0 ? 1 : 0) : first;
      return { ...model, game: createGame(next), animating: false };
    }
    case 'dropFinished':
      return model.animating ? { ...model, animating: false } : model;
  }
}

const initialModel = (): GameModel => ({ game: createGame(0), names: DEFAULT_NAMES, score: emptyScore(), animating: false });

export interface UseGame {
  state: GameState;
  names: [string, string];
  score: Score;
  isAnimating: boolean;
  startGame: (settings: PlayerSettings) => void;
  /** 柱へ駒を落とす。失敗した場合はその理由を返し、成功なら null を返す */
  selectPillar: (pillar: PillarPos) => SelectError | null;
  /** 直前の1手を取り消す */
  undo: () => void;
  /** 名前と通算成績を保ったまま、盤面を初期化する。swapFirst が true なら先手と後手を入れ替える */
  restart: (swapFirst: boolean) => void;
  /** 落下アニメーションが終わったことを通知する */
  onDropFinished: () => void;
}

export function useGame(): UseGame {
  const [model, dispatch] = useReducer(reducer, undefined, initialModel);
  // 同じ描画内で連続して呼ばれても、最新の状態で判定するための写し
  const latest = useRef(model);
  latest.current = model;

  const send = useCallback((action: Action) => {
    latest.current = reducer(latest.current, action);
    dispatch(action);
  }, []);

  const startGame = useCallback((settings: PlayerSettings) => send({ type: 'start', settings }), [send]);

  const selectPillar = useCallback(
    (pillar: PillarPos): SelectError | null => {
      if (latest.current.animating) return 'ANIMATING';
      const result = applyMove(latest.current.game, pillar);
      if (!result.ok) return result.error;
      send({ type: 'move', pillar });
      return null;
    },
    [send],
  );

  const undoMove = useCallback(() => send({ type: 'undo' }), [send]);
  const restart = useCallback((swapFirst: boolean) => send({ type: 'restart', swapFirst }), [send]);
  const onDropFinished = useCallback(() => send({ type: 'dropFinished' }), [send]);

  return {
    state: model.game,
    names: model.names,
    score: model.score,
    isAnimating: model.animating,
    startGame,
    selectPillar,
    undo: undoMove,
    restart,
    onDropFinished,
  };
}
