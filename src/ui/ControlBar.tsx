interface ControlBarProps {
  canUndo: boolean;
  onUndo: () => void;
  onNewGame: () => void;
  onResetCamera: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onOpenHelp: () => void;
}

export function ControlBar({ canUndo, onUndo, onNewGame, onResetCamera, soundEnabled, onToggleSound, onOpenHelp }: ControlBarProps) {
  return (
    <nav className="control-bar" aria-label="操作">
      <button type="button" onClick={onUndo} disabled={!canUndo}>1手戻す</button>
      <button type="button" onClick={onNewGame}>新しいゲーム</button>
      <button type="button" onClick={onResetCamera}>視点リセット</button>
      <button type="button" onClick={onToggleSound} aria-pressed={soundEnabled}>
        効果音: {soundEnabled ? 'オン' : 'オフ'}
      </button>
      <button type="button" onClick={onOpenHelp}>遊び方</button>
    </nav>
  );
}
