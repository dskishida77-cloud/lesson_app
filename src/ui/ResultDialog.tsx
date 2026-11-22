import { useState } from 'react';
import type { GameStatus } from '../core';

interface ResultDialogProps {
  status: GameStatus;
  names: [string, string];
  /** swapFirst: true なら、先手と後手を入れ替えて再戦する */
  onPlayAgain: (swapFirst: boolean) => void;
  /** 先手と後手を入れ替えるかを選ばせるか。オンラインでは、サーバーが自動で入れ替えるため、false にする */
  showSwapOption?: boolean;
}

/** 盤面を回して勝ちラインを見られるよう、画面全体は覆わない（下部のパネル） */
export function ResultDialog({ status, names, onPlayAgain, showSwapOption = true }: ResultDialogProps) {
  const [swap, setSwap] = useState(false);
  if (status.kind === 'playing') return null;
  const title = status.kind === 'won' ? `${names[status.winner]}の勝ち！` : '引き分け';

  return (
    <div role="dialog" aria-modal="false" aria-label="対局結果" className="result-dialog">
      <p className="result-title">{title}</p>
      {showSwapOption && (
        <label className="radio">
          <input type="checkbox" checked={swap} onChange={(e) => setSwap(e.target.checked)} />
          先手と後手を入れ替える
        </label>
      )}
      <button type="button" className="primary" onClick={() => onPlayAgain(showSwapOption && swap)}>
        もう一度遊ぶ
      </button>
    </div>
  );
}
