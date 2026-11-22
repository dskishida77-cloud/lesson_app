interface ModeSelectProps {
  /** Supabase の接続設定があり、オンライン対戦を使えるか */
  onlineAvailable: boolean;
  onLocal: () => void;
  onOnline: () => void;
}

export function ModeSelect({ onlineAvailable, onLocal, onOnline }: ModeSelectProps) {
  return (
    <main className="start-screen">
      <h1>3D コネクト フォー</h1>
      <p className="start-lead">縦・横・奥行き・斜めのどこかに、自分の駒を4つ並べよう。</p>
      <button type="button" className="primary" onClick={onLocal}>ローカル対戦</button>
      <p className="mode-note">1台の端末を、2人で交互に操作します。</p>
      <button type="button" onClick={onOnline} disabled={!onlineAvailable}>オンライン対戦</button>
      <p className="mode-note">
        {onlineAvailable
          ? '離れた友人と、招待リンクで対戦します。'
          : 'オンライン対戦は、この環境では設定されていないため、利用できません。'}
      </p>
    </main>
  );
}
