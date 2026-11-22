import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WIN_LINES } from '../../src/core';
import { HowToPlayDialog } from '../../src/ui/HowToPlayDialog';
import { PATTERNS, PatternDiagram } from '../../src/ui/PatternDiagram';

afterEach(cleanup);

describe('PATTERNS（勝利パターンの例）', () => {
  it('すべて、実際の勝利ライン（WIN_LINES）と一致する', () => {
    const key = (cells: { x: number; y: number; z: number }[]) =>
      cells.map((c) => `${c.x},${c.y},${c.z}`).sort().join('|');
    const valid = new Set(WIN_LINES.map(key));
    for (const pattern of PATTERNS) {
      expect(pattern.cells).toHaveLength(4);
      expect(valid.has(key(pattern.cells))).toBe(true);
    }
  });

  it('縦・横・斜め（平面）・立体対角線を含む', () => {
    expect(PATTERNS.map((p) => p.title)).toEqual(
      expect.arrayContaining(['縦（柱の上下）', '横', '平面の斜め', '立体の対角線']),
    );
  });
});

describe('PatternDiagram', () => {
  it('4段分のグリッドを描き、強調マスは合計4つ', () => {
    const { container } = render(<PatternDiagram cells={PATTERNS[0]!.cells} title="例" />);
    expect(container.querySelectorAll('svg')).toHaveLength(4);
    expect(container.querySelectorAll('[data-hit="true"]')).toHaveLength(4);
  });

  it('図には、代替テキスト（名前）が付く', () => {
    render(<PatternDiagram cells={PATTERNS[3]!.cells} title="立体の対角線" />);
    expect(screen.getByRole('img', { name: /立体の対角線/ })).toBeTruthy();
  });
});

describe('HowToPlayDialog', () => {
  it('盤面・手番・勝利条件を説明し、パターン図を並べる', () => {
    const { container } = render(<HowToPlayDialog onClose={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: '遊び方' });
    expect(dialog.textContent).toContain('4×4');
    expect(dialog.textContent).toContain('交互');
    expect(dialog.textContent).toContain('4つ');
    expect(container.querySelectorAll('[role="img"]')).toHaveLength(PATTERNS.length);
    expect(within(dialog).getByRole('button', { name: '閉じる' })).toBeTruthy();
  });

  it('閉じるボタンと Escape キーで閉じる', () => {
    const onClose = vi.fn();
    render(<HowToPlayDialog onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
