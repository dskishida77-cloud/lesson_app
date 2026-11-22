import { useEffect, useMemo, useState } from 'react';
import { AudioService } from '../audio/AudioService';
import type { PillarPos } from '../core';
import { BoardScene } from '../render/BoardScene';
import { Celebration } from '../ui/Celebration';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { ResultDialog } from '../ui/ResultDialog';
import { Toast } from '../ui/Toast';
import { ControlBar } from '../ui/ControlBar';
import { Hud } from '../ui/Hud';
import { StartScreen } from '../ui/StartScreen';
import { SettingsStore } from './SettingsStore';
import { useGame } from './useGame';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';
import { useToast } from './useToast';

export function App() {
  const { state, names, score, isAnimating, startGame, selectPillar, undo, restart, onDropFinished } =
    useGame();
  const [hovered, setHovered] = useState<PillarPos | null>(null);
  const toast = useToast();
  const reducedMotion = usePrefersReducedMotion();
  const [started, setStarted] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const [confirmingNewGame, setConfirmingNewGame] = useState(false);
  const audio = useMemo(() => new AudioService(), []);
  const settings = useMemo(() => new SettingsStore(), []);
  const [soundEnabled, setSoundEnabled] = useState(() => settings.load().soundEnabled);
  useEffect(() => audio.setEnabled(soundEnabled), [audio, soundEnabled]);
  const inProgress = state.history.length > 0 && state.status.kind === 'playing';

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    settings.save({ soundEnabled: next });
  };

  /** 駒が着地したら、着手音を鳴らす。決着した手なら、続けて勝利音を鳴らす */
  const handleDropFinished = () => {
    onDropFinished();
    audio.playDrop();
    if (state.status.kind === 'won') audio.playWin();
  };

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
        soundEnabled={soundEnabled}
        onToggleSound={toggleSound}
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
          reducedMotion={reducedMotion}
          animating={isAnimating}
          onDropFinished={handleDropFinished}
        />
      </main>
      <Celebration active={state.status.kind === 'won' && !isAnimating} reducedMotion={reducedMotion} />
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
