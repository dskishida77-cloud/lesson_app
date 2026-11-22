interface ControlBarProps {
  canUndo: boolean;
  onUndo: () => void;
  onNewGame: () => void;
  onResetCamera: () => void;
}

export function ControlBar({ canUndo, onUndo, onNewGame, onResetCamera }: ControlBarProps) {
  return (
    <nav className="control-bar" aria-label="操作">
      <button type="button" onClick={onUndo} disabled={!canUndo}>1手戻す</button>
      <button type="button" onClick={onNewGame}>新しいゲーム</button>
      <button type="button" onClick={onResetCamera}>視点リセット</button>
    </nav>
  );
}
