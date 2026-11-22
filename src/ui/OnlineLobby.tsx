import { useState } from 'react';
import { MAX_NAME_LENGTH } from '../app/names';
import { roomErrorMessage } from '../online/messages';
import type { RoomErrorCode } from '../online/types';
import type { BusyAction } from '../online/useOnlineGame';

interface OnlineLobbyProps {
  /** 招待リンクから開いたときの、ルームコード */
  initialCode: string | null;
  busy: BusyAction | null;
  error: RoomErrorCode | null;
  onCreate: (name: string) => void;
  onJoin: (code: string, name: string) => void;
  onBack: () => void;
}

const BUSY_LABEL: Record<BusyAction, string> = {
  creating: 'ルームを作っています…',
  joining: '参加しています…',
  restoring: '対局に復帰しています…',
};

export function OnlineLobby({ initialCode, busy, error, onCreate, onJoin, onBack }: OnlineLobbyProps) {
  const [name, setName] = useState('');
  const [code, setCode] = useState(initialCode ?? '');
  const disabled = busy !== null;
  const invited = initialCode !== null;

  const joinSection = (
    <section className="lobby-section" aria-labelledby="join-heading">
      <h2 id="join-heading">{invited ? '招待を受け取りました' : 'ルームに参加する'}</h2>
      <label className="field">
        <span>ルームコード</span>
        <input
          type="text"
          value={code}
          maxLength={6}
          autoCapitalize="characters"
          autoComplete="off"
          placeholder="例: ABC234"
          onChange={(e) => setCode(e.target.value)}
        />
      </label>
      <button
        type="button"
        className={invited ? 'primary' : undefined}
        disabled={disabled || code.trim() === ''}
        onClick={() => onJoin(code, name)}
      >
        参加する
      </button>
    </section>
  );

  const createSection = (
    <section className="lobby-section" aria-labelledby="create-heading">
      <h2 id="create-heading">ルームを作る</h2>
      <p className="mode-note">作ると、友人に送る招待リンクが表示されます。</p>
      <button type="button" className={invited ? undefined : 'primary'} disabled={disabled} onClick={() => onCreate(name)}>
        ルームを作る
      </button>
    </section>
  );

  return (
    <main className="start-screen">
      <h1>オンライン対戦</h1>
      <label className="field">
        <span>あなたの名前</span>
        <input
          type="text"
          value={name}
          maxLength={MAX_NAME_LENGTH}
          autoComplete="nickname"
          placeholder="1〜12文字"
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      {invited ? joinSection : createSection}
      {invited ? createSection : joinSection}
      {busy && <p role="status">{BUSY_LABEL[busy]}</p>}
      {error && <p role="alert" className="form-error">{roomErrorMessage(error)}</p>}
      <button type="button" onClick={onBack} disabled={disabled}>メニューへ戻る</button>
    </main>
  );
}
