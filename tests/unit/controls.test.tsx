import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from '../../src/ui/ConfirmDialog';
import { ControlBar } from '../../src/ui/ControlBar';

afterEach(cleanup);

describe('ControlBar', () => {
  const setup = (canUndo = true) => {
    const handlers = { onUndo: vi.fn(), onNewGame: vi.fn(), onResetCamera: vi.fn(), onToggleSound: vi.fn(), onOpenHelp: vi.fn() };
    render(<ControlBar canUndo={canUndo} soundEnabled {...handlers} />);
    return handlers;
  };

  it('各ボタンが、対応する操作を呼ぶ', () => {
    const h = setup();
    fireEvent.click(screen.getByRole('button', { name: '1手戻す' }));
    fireEvent.click(screen.getByRole('button', { name: '新しいゲーム' }));
    fireEvent.click(screen.getByRole('button', { name: '視点リセット' }));
    fireEvent.click(screen.getByRole('button', { name: '遊び方' }));
    expect(h.onOpenHelp).toHaveBeenCalledTimes(1);
    expect(h.onUndo).toHaveBeenCalledTimes(1);
    expect(h.onNewGame).toHaveBeenCalledTimes(1);
    expect(h.onResetCamera).toHaveBeenCalledTimes(1);
  });

  it('効果音ボタンは、状態を表示し、切り替えを通知する', () => {
    const h = setup();
    const button = screen.getByRole('button', { name: /効果音/ });
    expect(button.textContent).toContain('オン');
    expect(button.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(button);
    expect(h.onToggleSound).toHaveBeenCalledTimes(1);
  });

  it('取り消せない状態では、「1手戻す」が無効になる', () => {
    setup(false);
    expect((screen.getByRole('button', { name: '1手戻す' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('ConfirmDialog', () => {
  it('メッセージを表示し、確定とキャンセルを通知する', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmDialog message="進行中のゲームを破棄しますか？" confirmLabel="破棄する" onConfirm={onConfirm} onCancel={onCancel} />);
    expect(screen.getByRole('dialog').textContent).toContain('進行中のゲームを破棄しますか？');
    fireEvent.click(screen.getByRole('button', { name: '破棄する' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('開いたとき、キャンセルにフォーカスが当たる（キーボード操作で誤って破棄しない）', () => {
    render(<ConfirmDialog message="m" confirmLabel="破棄する" onConfirm={() => {}} onCancel={() => {}} />);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'キャンセル' }));
  });

  it('Escape キーでキャンセルできる', () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog message="m" confirmLabel="OK" onConfirm={() => {}} onCancel={onCancel} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
