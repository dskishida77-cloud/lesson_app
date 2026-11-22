import { useEffect, useMemo, useState } from 'react';
import { parseInviteCode } from '../online/inviteLink';
import type { RoomStore } from '../online/RoomStore';
import { createRoomApi } from '../online/supabaseClient';
import type { RoomApi } from '../online/types';
import { preloadBoardScene } from '../render/lazyBoardScene';
import { ModeSelect } from '../ui/ModeSelect';
import { Toast } from '../ui/Toast';
import { LocalGame } from './LocalGame';
import { OnlineGame } from './OnlineGame';
import { useShell } from './useShell';

type Mode = 'menu' | 'local' | 'online';

interface AppProps {
  /** 通信層。省略すると、環境変数から作る（設定がなければ、オンライン対戦は使えない）。テストで差し替える */
  roomApi?: RoomApi | null;
  /** 参加中のルームの保存先。テストで差し替える */
  roomStore?: RoomStore;
}

export function App({ roomApi, roomStore }: AppProps) {
  const shell = useShell();
  const api = useMemo(() => (roomApi !== undefined ? roomApi : createRoomApi()), [roomApi]);
  // 招待リンク（?room=…）で開いたときは、オンライン対戦の参加画面から始める
  const inviteCode = useMemo(() => parseInviteCode(window.location.search), []);
  const [mode, setMode] = useState<Mode>(inviteCode && api ? 'online' : 'menu');
  useEffect(preloadBoardScene, []);

  const backToMenu = () => setMode('menu');

  return (
    <>
      {mode === 'menu' && (
        <ModeSelect onlineAvailable={api !== null} onLocal={() => setMode('local')} onOnline={() => setMode('online')} />
      )}
      {mode === 'local' && <LocalGame shell={shell} onExit={backToMenu} />}
      {mode === 'online' && api && (
        <OnlineGame api={api} shell={shell} initialCode={inviteCode} store={roomStore} onExit={backToMenu} />
      )}
      <Toast message={shell.toast.message} />
    </>
  );
}
