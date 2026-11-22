import { useEffect, useMemo, useState } from 'react';
import { buildInviteUrl } from '../online/inviteLink';
import { RoomStore } from '../online/RoomStore';
import type { RoomApi } from '../online/types';
import { useOnlineGame } from '../online/useOnlineGame';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { GameScreen } from '../ui/GameScreen';
import { OnlineBar } from '../ui/OnlineBar';
import { OnlineLobby } from '../ui/OnlineLobby';
import { WaitingRoom } from '../ui/WaitingRoom';
import type { Shell } from './useShell';

interface OnlineGameProps {
  api: RoomApi;
  shell: Shell;
  /** 招待リンクから開いたときの、ルームコード */
  initialCode: string | null;
  /** 参加中のルームの保存先（テストで差し替える） */
  store?: RoomStore;
  /** モード選択へ戻る */
  onExit: () => void;
}

/** アドレスバーから、招待リンクのクエリ（?room=…）を取り除く（再読み込みで、同じ招待を再利用しないため） */
function stripInviteFromUrl() {
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has('room')) {
      url.searchParams.delete('room');
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    }
  } catch {
    // アドレスを書き換えられない環境では、何もしない
  }
}

/** オンライン対戦（離れた2人が、それぞれの端末で対戦する） */
export function OnlineGame({ api, shell, initialCode, store, onExit }: OnlineGameProps) {
  const defaultStore = useMemo(() => new RoomStore(), []);
  const game = useOnlineGame({ api, store: store ?? defaultStore, onNotice: shell.toast.show });
  const [confirmLeave, setConfirmLeave] = useState(false);
  const { view, stage } = game;

  useEffect(() => {
    if (stage === 'room') stripInviteFromUrl();
  }, [stage]);

  const leaveToMenu = () => {
    game.leave();
    onExit();
  };

  if (stage === 'fatal') {
    return (
      <main className="start-screen">
        <h1>オンライン対戦</h1>
        <p role="alert" className="form-error">
          対局の情報を読み込めませんでした。ルームを抜けて、やり直してください。
        </p>
        <button type="button" className="primary" onClick={game.leave}>ルームを抜ける</button>
      </main>
    );
  }

  if (!view) {
    return (
      <OnlineLobby
        initialCode={initialCode}
        busy={game.busy}
        error={game.error}
        onCreate={(name) => void game.createRoom(name)}
        onJoin={(code, name) => void game.joinRoom(code, name)}
        onBack={onExit}
      />
    );
  }

  if (view.phase === 'waiting') {
    return (
      <WaitingRoom
        code={view.code}
        inviteUrl={buildInviteUrl(window.location.origin + window.location.pathname, view.code)}
        onLeave={game.leave}
      />
    );
  }

  return (
    <>
      <GameScreen
        shell={shell}
        state={view.state}
        names={view.names}
        score={view.score}
        isAnimating={game.isAnimating}
        onSelectPillar={(pillar) => void game.selectPillar(pillar)}
        onDropFinished={game.dropFinished}
        onPlayAgain={() => void game.rematch()}
        showSwapOption={false}
        onBack={() => (view.phase === 'playing' ? setConfirmLeave(true) : leaveToMenu())}
        backLabel="ルームを抜ける"
        banner={<OnlineBar view={view} connection={game.connection} />}
      />
      {confirmLeave && (
        <ConfirmDialog
          message="対局の途中でルームを抜けますか？ 同じ招待リンクから、また参加できます。"
          confirmLabel="ルームを抜ける"
          onConfirm={() => {
            setConfirmLeave(false);
            leaveToMenu();
          }}
          onCancel={() => setConfirmLeave(false)}
        />
      )}
    </>
  );
}

