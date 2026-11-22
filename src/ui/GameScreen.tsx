import { Suspense, useState } from 'react';
import type { ReactNode } from 'react';
import type { Shell } from '../app/useShell';
import type { GameState, PillarPos, Score } from '../core';
import { BoardScene } from '../render/lazyBoardScene';
import { Celebration } from './Celebration';
import { ControlBar } from './ControlBar';
import { HowToPlayDialog } from './HowToPlayDialog';
import { Hud } from './Hud';
import { ResultDialog } from './ResultDialog';

interface GameScreenProps {
  shell: Shell;
  state: GameState;
  names: [string, string];
  score: Score;
  isAnimating: boolean;
  onSelectPillar: (pillar: PillarPos) => void;
  onDropFinished: () => void;
  onPlayAgain: (swapFirst: boolean) => void;
  /** 先手と後手を入れ替えるかを選ばせるか（ローカル対戦のみ） */
  showSwapOption: boolean;
  /** 「1手戻す」と「新しいゲーム」。渡さなければ、表示しない（オンライン対戦） */
  onUndo?: () => void;
  canUndo?: boolean;
  onNewGame?: () => void;
  onBack: () => void;
  backLabel: string;
  /** HUD の下に出す、追加の表示（オンライン対戦の状態バー） */
  banner?: ReactNode;
}

/** ローカル対戦とオンライン対戦が、共通で使う対局画面 */
export function GameScreen({
  shell, state, names, score, isAnimating, onSelectPillar, onDropFinished, onPlayAgain, showSwapOption,
  onUndo, canUndo, onNewGame, onBack, backLabel, banner,
}: GameScreenProps) {
  const [hovered, setHovered] = useState<PillarPos | null>(null);
  const [resetSignal, setResetSignal] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);

  /** 駒が着地したら、着手音を鳴らす。決着した手なら、続けて勝利音を鳴らす */
  const handleDropFinished = () => {
    onDropFinished();
    shell.audio.playDrop();
    if (state.status.kind === 'won') shell.audio.playWin();
  };

  return (
    <div className="app">
      <div className="panel">
        <Hud state={state} names={names} showResult={!isAnimating} score={score} />
        {banner}
        <ControlBar
          onUndo={onUndo}
          canUndo={canUndo}
          onNewGame={onNewGame}
          onResetCamera={() => setResetSignal((n) => n + 1)}
          soundEnabled={shell.soundEnabled}
          onToggleSound={shell.toggleSound}
          onOpenHelp={() => setHelpOpen(true)}
          onBack={onBack}
          backLabel={backLabel}
        />
      </div>
      <main className="board">
        <Suspense fallback={<p className="loading" role="status">盤面を読み込み中…</p>}>
          <BoardScene
            state={state}
            onSelect={onSelectPillar}
            onHover={setHovered}
            hovered={hovered}
            resetSignal={resetSignal}
            reducedMotion={shell.reducedMotion}
            animating={isAnimating}
            onDropFinished={handleDropFinished}
          />
        </Suspense>
      </main>
      <Celebration active={state.status.kind === 'won' && !isAnimating} reducedMotion={shell.reducedMotion} />
      {!isAnimating && (
        <ResultDialog status={state.status} names={names} onPlayAgain={onPlayAgain} showSwapOption={showSwapOption} />
      )}
      {helpOpen && <HowToPlayDialog onClose={() => setHelpOpen(false)} />}
    </div>
  );
}
