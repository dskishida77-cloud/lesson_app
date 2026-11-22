interface ControlBarProps {
  /** 「1手戻す」。指定しなければ、ボタンを出さない（オンライン対戦では、提供しない） */
  onUndo?: () => void;
  canUndo?: boolean;
  /** 「新しいゲーム」。指定しなければ、ボタンを出さない（オンライン対戦では、再戦は結果ダイアログから） */
  onNewGame?: () => void;
  onResetCamera: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onOpenHelp: () => void;
  /** メニュー（モード選択）や、ルームから戻るボタン */
  onBack?: () => void;
  backLabel?: string;
}

export function ControlBar({
  onUndo,
  canUndo = false,
  onNewGame,
  onResetCamera,
  soundEnabled,
  onToggleSound,
  onOpenHelp,
  onBack,
  backLabel = 'メニューへ',
}: ControlBarProps) {
  return (
    <nav className="control-bar" aria-label="操作">
      {onUndo && (
        <button type="button" onClick={onUndo} disabled={!canUndo}>1手戻す</button>
      )}
      {onNewGame && <button type="button" onClick={onNewGame}>新しいゲーム</button>}
      <button type="button" onClick={onResetCamera}>視点リセット</button>
      <button type="button" onClick={onToggleSound} aria-pressed={soundEnabled}>
        効果音: {soundEnabled ? 'オン' : 'オフ'}
      </button>
      <button type="button" onClick={onOpenHelp}>遊び方</button>
      {onBack && <button type="button" onClick={onBack}>{backLabel}</button>}
    </nav>
  );
}
