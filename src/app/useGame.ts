import { useCallback, useReducer, useRef } from 'react';
import { applyMove, createGame } from '../core';
import type { GameState, MoveError, PillarPos, PlayerSettings } from '../core';

export { DEFAULT_NAMES } from './defaults';
import { DEFAULT_NAMES } from './defaults';

interface GameModel {
  game: GameState;
  names: [string, string];
  /** 駒の落下アニメーション中か（中は入力を受け付けない） */
  animating: boolean;
}

type Action =
  | { type: 'start'; settings: PlayerSettings }
  | { type: 'move'; pillar: PillarPos }
  | { type: 'dropFinished' };

export type SelectError = MoveError | 'ANIMATING';

/** 純粋なリデューサ。着手に失敗する場合は、同じモデルを返す */
export function reducer(model: GameModel, action: Action): GameModel {
  switch (action.type) {
    case 'start':
      return {
        game: createGame(action.settings.firstPlayer),
        names: action.settings.names,
        animating: false,
      };
    case 'move': {
      if (model.animating) return model;
      const result = applyMove(model.game, action.pillar);
      return result.ok ? { ...model, game: result.state, animating: true } : model;
    }
    case 'dropFinished':
      return model.animating ? { ...model, animating: false } : model;
  }
}

const initialModel = (): GameModel => ({ game: createGame(0), names: DEFAULT_NAMES, animating: false });

export interface UseGame {
  state: GameState;
  names: [string, string];
  isAnimating: boolean;
  startGame: (settings: PlayerSettings) => void;
  /** 柱へ駒を落とす。失敗した場合はその理由を返し、成功なら null を返す */
  selectPillar: (pillar: PillarPos) => SelectError | null;
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

  const onDropFinished = useCallback(() => send({ type: 'dropFinished' }), [send]);

  return {
    state: model.game,
    names: model.names,
    isAnimating: model.animating,
    startGame,
    selectPillar,
    onDropFinished,
  };
}
