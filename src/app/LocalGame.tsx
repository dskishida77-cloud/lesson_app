import { useState } from 'react';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { GameScreen } from '../ui/GameScreen';
import { StartScreen } from '../ui/StartScreen';
import { useGame } from './useGame';
import type { Shell } from './useShell';

interface LocalGameProps {
  shell: Shell;
  /** モード選択へ戻る */
  onExit: () => void;
}

/** ローカル対戦（1台の端末で、2人が交互に操作する） */
export function LocalGame({ shell, onExit }: LocalGameProps) {
  const { state, names, score, isAnimating, startGame, selectPillar, undo, restart, onDropFinished } = useGame();
  const [started, setStarted] = useState(false);
  const [confirm, setConfirm] = useState<'newGame' | 'exit' | null>(null);
  const inProgress = state.history.length > 0 && state.status.kind === 'playing';

  if (!started) {
    return (
      <StartScreen
        onBack={onExit}
        onStart={(settings) => {
          startGame(settings);
          setStarted(true);
        }}
      />
    );
  }

  return (
    <>
      <GameScreen
        shell={shell}
        state={state}
        names={names}
        score={score}
        isAnimating={isAnimating}
        onSelectPillar={(pillar) => {
          if (selectPillar(pillar) === 'PILLAR_FULL') shell.toast.show('この柱は満杯です');
        }}
        onDropFinished={onDropFinished}
        onPlayAgain={restart}
        showSwapOption
        canUndo={state.history.length > 0 && !isAnimating}
        onUndo={undo}
        onNewGame={() => (inProgress ? setConfirm('newGame') : restart(false))}
        onBack={() => (inProgress ? setConfirm('exit') : onExit())}
        backLabel="メニューへ"
      />
      {confirm && (
        <ConfirmDialog
          message={
            confirm === 'newGame'
              ? '進行中のゲームを破棄して、最初から始めますか？'
              : '進行中のゲームを破棄して、メニューへ戻りますか？'
          }
          confirmLabel={confirm === 'newGame' ? '最初から始める' : 'メニューへ戻る'}
          onConfirm={() => {
            const action = confirm;
            setConfirm(null);
            if (action === 'newGame') restart(false);
            else onExit();
          }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
}
