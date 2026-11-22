import { useEffect } from 'react';

interface ConfirmDialogProps {
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ message, confirmLabel, onConfirm, onCancel }: ConfirmDialogProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="overlay">
      <div role="dialog" aria-modal="true" aria-label="確認" className="dialog">
        <p>{message}</p>
        <div className="dialog-actions">
          {/* 誤操作を避けるため、破棄しない側（キャンセル）に最初のフォーカスを置く */}
          <button type="button" autoFocus onClick={onCancel}>キャンセル</button>
          <button type="button" className="primary" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
