import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ControlBar } from '../../src/ui/ControlBar';
import { ModeSelect } from '../../src/ui/ModeSelect';
import { OnlineBar } from '../../src/ui/OnlineBar';
import { OnlineLobby } from '../../src/ui/OnlineLobby';
import { ResultDialog } from '../../src/ui/ResultDialog';
import { WaitingRoom } from '../../src/ui/WaitingRoom';
import { createGame } from '../../src/core';
import type { OnlineView } from '../../src/online/types';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ModeSelect', () => {
  it('ローカルとオンラインを選べる', () => {
    const onLocal = vi.fn();
    const onOnline = vi.fn();
    render(<ModeSelect onlineAvailable onLocal={onLocal} onOnline={onOnline} />);
    fireEvent.click(screen.getByRole('button', { name: 'ローカル対戦' }));
    fireEvent.click(screen.getByRole('button', { name: 'オンライン対戦' }));
    expect(onLocal).toHaveBeenCalledTimes(1);
    expect(onOnline).toHaveBeenCalledTimes(1);
  });

  it('接続設定がなければ、オンラインは無効で、理由を表示する。ローカルは使える', () => {
    const onLocal = vi.fn();
    render(<ModeSelect onlineAvailable={false} onLocal={onLocal} onOnline={vi.fn()} />);
    expect((screen.getByRole('button', { name: 'オンライン対戦' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/設定されていないため/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'ローカル対戦' }));
    expect(onLocal).toHaveBeenCalled();
  });
});

describe('OnlineLobby', () => {
  const setup = (props: Partial<Parameters<typeof OnlineLobby>[0]> = {}) => {
    const handlers = { onCreate: vi.fn(), onJoin: vi.fn(), onBack: vi.fn() };
    render(<OnlineLobby initialCode={null} busy={null} error={null} {...handlers} {...props} />);
    return handlers;
  };

  it('名前を入れて、ルームを作る', () => {
    const h = setup();
    fireEvent.change(screen.getByLabelText('あなたの名前'), { target: { value: 'あや' } });
    fireEvent.click(screen.getByRole('button', { name: 'ルームを作る' }));
    expect(h.onCreate).toHaveBeenCalledWith('あや');
  });

  it('コードを入れて、参加する。コードが空の間は、参加できない', () => {
    const h = setup();
    const join = screen.getByRole('button', { name: '参加する' }) as HTMLButtonElement;
    expect(join.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('あなたの名前'), { target: { value: 'ゆう' } });
    fireEvent.change(screen.getByLabelText('ルームコード'), { target: { value: 'abc234' } });
    expect(join.disabled).toBe(false);
    fireEvent.click(join);
    expect(h.onJoin).toHaveBeenCalledWith('abc234', 'ゆう');
  });

  it('招待リンクから開いたときは、コードが入力済みで、参加が主な操作になる', () => {
    setup({ initialCode: 'ABC234' });
    expect((screen.getByLabelText('ルームコード') as HTMLInputElement).value).toBe('ABC234');
    expect(screen.getByText('招待を受け取りました')).toBeTruthy();
    expect(screen.getByRole('button', { name: '参加する' }).className).toContain('primary');
  });

  it('名前の入力欄は12文字まで。コードは6文字まで', () => {
    setup();
    expect(screen.getByLabelText('あなたの名前').getAttribute('maxlength')).toBe('12');
    expect(screen.getByLabelText('ルームコード').getAttribute('maxlength')).toBe('6');
  });

  it('通信中は、操作を無効にして、状況を表示する', () => {
    setup({ busy: 'joining' });
    expect(screen.getByRole('status').textContent).toContain('参加しています');
    for (const name of ['ルームを作る', 'メニューへ戻る']) {
      expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true);
    }
  });

  it('エラーを、日本語のメッセージで表示する', () => {
    setup({ error: 'ROOM_FULL' });
    expect(screen.getByRole('alert').textContent).toContain('すでに2人が揃っています');
  });

  it('メニューへ戻れる', () => {
    const h = setup();
    fireEvent.click(screen.getByRole('button', { name: 'メニューへ戻る' }));
    expect(h.onBack).toHaveBeenCalled();
  });
});

describe('WaitingRoom', () => {
  const url = 'https://example.com/?room=ABC234';

  it('招待リンクとルームコードを表示する', () => {
    render(<WaitingRoom inviteUrl={url} code="ABC234" onLeave={() => {}} />);
    expect((screen.getByLabelText('招待リンク') as HTMLInputElement).value).toBe(url);
    expect(screen.getByText('ABC234')).toBeTruthy();
    expect(screen.getAllByRole('status')[0]!.textContent).toContain('参加すると、自動で対局が始まります');
  });

  it('「招待リンクをコピー」で、クリップボードにリンクを書き込み、知らせる', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    render(<WaitingRoom inviteUrl={url} code="ABC234" onLeave={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: '招待リンクをコピー' }));
    expect(await screen.findByText(/コピーしました/)).toBeTruthy();
    expect(writeText).toHaveBeenCalledWith(url);
  });

  it('クリップボードが使えなければ、手動でコピーするよう案内する', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    render(<WaitingRoom inviteUrl={url} code="ABC234" onLeave={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: '招待リンクをコピー' }));
    expect(await screen.findByText(/手動でコピー/)).toBeTruthy();
  });

  it('やめるを押すと、通知する', () => {
    const onLeave = vi.fn();
    render(<WaitingRoom inviteUrl={url} code="ABC234" onLeave={onLeave} />);
    fireEvent.click(screen.getByRole('button', { name: 'やめる' }));
    expect(onLeave).toHaveBeenCalled();
  });
});

describe('OnlineBar', () => {
  const view = (patch: Partial<OnlineView> = {}): OnlineView => ({
    state: createGame(0),
    mySeat: 1,
    myPlayerId: 1,
    names: ['あや', 'ゆう'],
    score: { wins: [0, 0], draws: 0 },
    phase: 'playing',
    isMyTurn: false,
    code: 'ABC234',
    roomId: 'r',
    ...patch,
  });

  it('自分と相手の名前を、PlayerId に関係なく、正しく表示する', () => {
    render(<OnlineBar view={view()} connection="connected" />);
    const text = screen.getByLabelText('オンライン対戦の状態').textContent!;
    expect(text).toContain('あなた: ゆう');
    expect(text).toContain('相手: あや');
  });

  it('手番を「あなたの番です / 相手の番です」と表示する。決着後は表示しない', () => {
    const { rerender } = render(<OnlineBar view={view({ isMyTurn: true })} connection="connected" />);
    expect(screen.getByText('あなたの番です')).toBeTruthy();
    rerender(<OnlineBar view={view({ isMyTurn: false })} connection="connected" />);
    expect(screen.getByText('相手の番です')).toBeTruthy();
    rerender(<OnlineBar view={view({ phase: 'ended' })} connection="connected" />);
    expect(screen.queryByText(/の番です/)).toBeNull();
  });

  it('接続状態: 接続済みなら出さず、それ以外は表示する', () => {
    const { rerender } = render(<OnlineBar view={view()} connection="connected" />);
    expect(screen.queryByRole('status')).toBeNull();
    rerender(<OnlineBar view={view()} connection="reconnecting" />);
    expect(screen.getByRole('status').textContent).toContain('再接続中');
    rerender(<OnlineBar view={view()} connection="disconnected" />);
    expect(screen.getByRole('status').textContent).toContain('接続が切れました');
    rerender(<OnlineBar view={view()} connection="connecting" />);
    expect(screen.getByRole('status').textContent).toContain('接続中');
  });

  it('名前は、HTML として解釈されない', () => {
    render(<OnlineBar view={view({ names: ['<img src=x onerror=alert(1)>', 'b'] })} connection="connected" />);
    expect(document.querySelector('img')).toBeNull();
  });
});

describe('ControlBar（オンライン用の構成）', () => {
  it('「1手戻す」「新しいゲーム」は、ハンドラを渡さなければ、表示しない', () => {
    render(<ControlBar onResetCamera={() => {}} soundEnabled onToggleSound={() => {}} onOpenHelp={() => {}} />);
    expect(screen.queryByRole('button', { name: '1手戻す' })).toBeNull();
    expect(screen.queryByRole('button', { name: '新しいゲーム' })).toBeNull();
    expect(screen.getByRole('button', { name: '視点リセット' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'メニューへ' })).toBeNull();
  });

  it('戻るボタンは、ラベルを変えられる', () => {
    const onBack = vi.fn();
    render(
      <ControlBar onResetCamera={() => {}} soundEnabled onToggleSound={() => {}} onOpenHelp={() => {}} onBack={onBack} backLabel="ルームを抜ける" />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'ルームを抜ける' }));
    expect(onBack).toHaveBeenCalled();
  });
});

describe('ResultDialog（オンライン用の構成）', () => {
  it('先手・後手の入れ替えの選択を、隠せる。再戦は、入れ替えなしで通知する（サーバーが自動で入れ替える）', () => {
    const onPlayAgain = vi.fn();
    render(<ResultDialog status={{ kind: 'draw' }} names={['a', 'b']} onPlayAgain={onPlayAgain} showSwapOption={false} />);
    expect(screen.queryByLabelText('先手と後手を入れ替える')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'もう一度遊ぶ' }));
    expect(onPlayAgain).toHaveBeenCalledWith(false);
  });
});
