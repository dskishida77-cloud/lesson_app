import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePrefersReducedMotion } from '../../src/app/usePrefersReducedMotion';
import { Celebration, PARTICLE_COUNT } from '../../src/ui/Celebration';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** matchMedia の代用。change イベントを手動で発火できる */
function stubMatchMedia(matches: boolean) {
  const listeners = new Set<() => void>();
  const mql = {
    matches,
    addEventListener: (_: string, l: () => void) => listeners.add(l),
    removeEventListener: (_: string, l: () => void) => listeners.delete(l),
  };
  vi.stubGlobal('matchMedia', vi.fn(() => mql));
  return {
    set(next: boolean) {
      mql.matches = next;
      listeners.forEach((l) => l());
    },
  };
}

describe('usePrefersReducedMotion', () => {
  it('OS の設定が有効なら true', () => {
    stubMatchMedia(true);
    expect(renderHook(() => usePrefersReducedMotion()).result.current).toBe(true);
  });

  it('無効なら false。設定の変更にも追従する', () => {
    const media = stubMatchMedia(false);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
    act(() => media.set(true));
    expect(result.current).toBe(true);
  });

  it('matchMedia が使えない環境では false', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(renderHook(() => usePrefersReducedMotion()).result.current).toBe(false);
  });
});

describe('Celebration', () => {
  it('有効なとき、紙吹雪を表示する（支援技術には読み上げない）', () => {
    const { container } = render(<Celebration active reducedMotion={false} />);
    expect(container.querySelectorAll('.confetti-piece')).toHaveLength(PARTICLE_COUNT);
    expect(container.querySelector('.confetti')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('無効なときは、何も表示しない', () => {
    const { container } = render(<Celebration active={false} reducedMotion={false} />);
    expect(container.querySelector('.confetti')).toBeNull();
  });

  it('「視覚効果を減らす」設定では、表示しない', () => {
    const { container } = render(<Celebration active reducedMotion />);
    expect(container.querySelector('.confetti')).toBeNull();
    expect(screen.queryByText(/./)).toBeNull();
  });
});
