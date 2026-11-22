import { useRef, useState } from 'react';

interface WaitingRoomProps {
  inviteUrl: string;
  code: string;
  onLeave: () => void;
}

export function WaitingRoom({ inviteUrl, code, onLeave }: WaitingRoomProps) {
  const [copyMessage, setCopyMessage] = useState('');
  const input = useRef<HTMLInputElement>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopyMessage('コピーしました。友人に送ってください。');
    } catch {
      // クリップボードが使えない環境では、リンクを選択して、手動でコピーしてもらう
      input.current?.select();
      setCopyMessage('自動でコピーできませんでした。選択したリンクを、手動でコピーしてください。');
    }
  };

  return (
    <main className="start-screen">
      <h1>相手の参加を待っています</h1>
      <p role="status">招待リンクを友人に送ってください。参加すると、自動で対局が始まります。</p>
      <label className="field">
        <span>招待リンク</span>
        <input ref={input} type="text" readOnly value={inviteUrl} onFocus={(e) => e.currentTarget.select()} />
      </label>
      <button type="button" className="primary" onClick={copy}>招待リンクをコピー</button>
      {copyMessage && <p role="status" className="mode-note">{copyMessage}</p>}
      <p className="mode-note">ルームコード: <strong>{code}</strong>（リンクを使わずに、手入力でも参加できます）</p>
      <button type="button" onClick={onLeave}>やめる</button>
    </main>
  );
}
