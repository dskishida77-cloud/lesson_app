import type { PlayerId } from '../core';
import { PLAYER_COLORS } from '../render/colors';

/** 色に加えて形でも区別する（先手: 丸、後手: 輪） */
export function PlayerMark({ player }: { player: PlayerId }) {
  return (
    <span
      aria-hidden="true"
      className={player === 0 ? 'mark mark-round' : 'mark mark-ring'}
      style={{ background: PLAYER_COLORS[player] }}
    />
  );
}
