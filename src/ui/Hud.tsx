import type { GameState, PlayerId } from '../core';
import { PLAYER_COLORS } from '../render/Disc';

interface HudProps {
  state: GameState;
  names: [string, string];
}

/** 色に加えて形でも区別する（先手: 丸、後手: 輪） */
function PlayerMark({ player }: { player: PlayerId }) {
  return (
    <span
      aria-hidden="true"
      className={player === 0 ? 'mark mark-round' : 'mark mark-ring'}
      style={{ background: PLAYER_COLORS[player] }}
    />
  );
}

function resultText(state: GameState, names: [string, string]): string | null {
  switch (state.status.kind) {
    case 'won':
      return `${names[state.status.winner]}の勝ち！`;
    case 'draw':
      return '引き分け';
    case 'playing':
      return null;
  }
}

export function Hud({ state, names }: HudProps) {
  const result = resultText(state, names);
  return (
    <header className="hud">
      <p className="hud-turn">
        手番: <PlayerMark player={state.current} />
        <strong>{names[state.current]}</strong>
      </p>
      <p className="hud-moves">手数: {state.history.length}</p>
      {/* 結果は読み上げにも伝わるよう、status ロールで表示する */}
      <p role="status" className={result ? 'hud-result' : 'hud-result hud-result-empty'}>
        {result}
      </p>
    </header>
  );
}
