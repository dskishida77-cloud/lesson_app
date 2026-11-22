import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Hud } from '../../src/ui/Hud';
import { applyMove, createGame } from '../../src/core';
import type { GameState, PillarPos } from '../../src/core';

afterEach(cleanup);

const names: [string, string] = ['あや', 'ゆう'];
const p = (x: number, z: number): PillarPos => ({ x, z });
const play = (state: GameState, ...pillars: PillarPos[]): GameState =>
  pillars.reduce((s, pillar) => {
    const r = applyMove(s, pillar);
    if (!r.ok) throw new Error(r.error);
    return r.state;
  }, state);

describe('Hud', () => {
  it('現在の手番のプレイヤー名と、手数を表示する', () => {
    render(<Hud state={createGame(0)} names={names} />);
    expect(screen.getByText(/手番/).textContent).toContain('あや');
    expect(screen.getByText(/手数/).textContent).toContain('0');
  });

  it('着手後は、手番と手数が更新される', () => {
    render(<Hud state={play(createGame(0), p(0, 0), p(1, 1))} names={names} />);
    expect(screen.getByText(/手番/).textContent).toContain('あや');
    expect(screen.getByText(/手数/).textContent).toContain('2');
    cleanup();
    render(<Hud state={play(createGame(0), p(0, 0))} names={names} />);
    expect(screen.getByText(/手番/).textContent).toContain('ゆう');
  });

  it('勝敗が決まったら、勝者名を表示する', () => {
    const won = play(createGame(0), p(0, 0), p(1, 0), p(0, 0), p(1, 0), p(0, 0), p(1, 0), p(0, 0));
    render(<Hud state={won} names={names} />);
    expect(screen.getByRole('status').textContent).toContain('あやの勝ち');
  });

  it('showResult が false の間は、結果を表示しない', () => {
    const won = play(createGame(0), p(0, 0), p(1, 0), p(0, 0), p(1, 0), p(0, 0), p(1, 0), p(0, 0));
    render(<Hud state={won} names={names} showResult={false} />);
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('引き分けを表示する', () => {
    const draw: GameState = { ...createGame(0), status: { kind: 'draw' } };
    render(<Hud state={draw} names={names} />);
    expect(screen.getByRole('status').textContent).toContain('引き分け');
  });

  it('プレイヤー名は、HTMLとして解釈されない', () => {
    render(<Hud state={createGame(0)} names={['<img src=x onerror=alert(1)>', 'b']} />);
    expect(document.querySelector('img')).toBeNull();
  });
});
