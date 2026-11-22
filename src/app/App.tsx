import { useState } from 'react';
import type { PillarPos } from '../core';
import { BoardScene } from '../render/BoardScene';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { ResultDialog } from '../ui/ResultDialog';
import { Toast } from '../ui/Toast';
import { ControlBar } from '../ui/ControlBar';
import { Hud } from '../ui/Hud';
import { StartScreen } from '../ui/StartScreen';
import { useGame } from './useGame';
import { useToast } from './useToast';

export function App() {
  const { state, names, score, isAnimating, startGame, selectPillar, undo, restart, onDropFinished } =
    useGame();
  const [hovered, setHovered] = useState<PillarPos | null>(null);
  const toast = useToast();
  const [started, setStarted] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const [confirmingNewGame, setConfirmingNewGame] = useState(false);
  const inProgress = state.history.length > 0 && state.status.kind === 'playing';

  if (!started) {
    return (
      <StartScreen
        onStart={(settings) => {
          startGame(settings);
          setStarted(true);
        }}
      />
    );
  }

  return (
    <div className="app">
      <Hud state={state} names={names} showResult={!isAnimating} score={score} />
      <ControlBar
        canUndo={state.history.length > 0 && !isAnimating}
        onUndo={undo}
        onNewGame={() => (inProgress ? setConfirmingNewGame(true) : restart(false))}
        onResetCamera={() => setResetSignal((n) => n + 1)}
      />
      <main className="board">
        <BoardScene
          state={state}
          onSelect={(pillar) => {
            if (selectPillar(pillar) === 'PILLAR_FULL') toast.show('この柱は満杯です');
          }}
          onHover={setHovered}
          hovered={hovered}
          resetSignal={resetSignal}
          animating={isAnimating}
          onDropFinished={onDropFinished}
        />
      </main>
      <Toast message={toast.message} />
      {!isAnimating && <ResultDialog status={state.status} names={names} onPlayAgain={restart} />}
      {confirmingNewGame && (
        <ConfirmDialog
          message="進行中のゲームを破棄して、最初から始めますか？"
          confirmLabel="最初から始める"
          onConfirm={() => {
            setConfirmingNewGame(false);
            restart(false);
          }}
          onCancel={() => setConfirmingNewGame(false)}
        />
      )}
    </div>
  );
}
