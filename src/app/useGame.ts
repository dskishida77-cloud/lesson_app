import { useCallback, useReducer, useRef } from 'react';
import { applyMove, createGame } from '../core';
import type { GameState, MoveError, PillarPos, PlayerSettings } from '../core';

export const DEFAULT_NAMES: [string, string] = ['プレイヤー1', 'プレイヤー2'];

interface GameModel {
  game: GameState;
  names: [string, string];
}

type Action =
  | { type: 'start'; settings: PlayerSettings }
  | { type: 'move'; pillar: PillarPos };

/** 純粋なリデューサ。着手に失敗する場合は、同じモデルを返す */
export function reducer(model: GameModel, action: Action): GameModel {
  switch (action.type) {
    case 'start':
      return { game: createGame(action.settings.firstPlayer), names: action.settings.names };
    case 'move': {
      const result = applyMove(model.game, action.pillar);
      return result.ok ? { ...model, game: result.state } : model;
    }
  }
}

const initialModel = (): GameModel => ({ game: createGame(0), names: DEFAULT_NAMES });

export interface UseGame {
  state: GameState;
  names: [string, string];
  startGame: (settings: PlayerSettings) => void;
  /** 柱へ駒を落とす。失敗した場合はその理由を返し、成功なら null を返す */
  selectPillar: (pillar: PillarPos) => MoveError | null;
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
    (pillar: PillarPos): MoveError | null => {
      const result = applyMove(latest.current.game, pillar);
      if (!result.ok) return result.error;
      send({ type: 'move', pillar });
      return null;
    },
    [send],
  );

  return { state: model.game, names: model.names, startGame, selectPillar };
}
