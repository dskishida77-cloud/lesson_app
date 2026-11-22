import { useEffect } from 'react';
import { PATTERNS, PatternDiagram } from './PatternDiagram';

interface HowToPlayDialogProps {
  onClose: () => void;
}

/** 遊び方。表示するだけで、ゲームの状態には一切触れない */
export function HowToPlayDialog({ onClose }: HowToPlayDialogProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="overlay">
      <div role="dialog" aria-modal="true" aria-label="遊び方" className="dialog dialog-wide">
        <h2>遊び方</h2>
        <section>
          <h3>盤面</h3>
          <p>4×4 本の柱があり、それぞれに最大4段まで駒を積めます（全64マス）。駒は重力で、必ず柱の一番下の空きマスに落ちます。</p>
        </section>
        <section>
          <h3>手番</h3>
          <p>2人が交互に、柱を1本選んで駒を1つ落とします。柱をクリック（タップ）すると駒が落ちます。盤面はドラッグで回転できます。</p>
        </section>
        <section>
          <h3>勝ち方</h3>
          <p>縦・横・奥行き・斜めのどれかに、自分の駒を4つ並べたら勝ちです。段をまたぐ立体の斜めも有効です。64マスが埋まって、並んでいなければ引き分けです。</p>
          <ul className="pattern-list">
            {PATTERNS.map((p) => (
              <li key={p.title}>
                <strong>{p.title}</strong>
                <span>{p.description}</span>
                <PatternDiagram cells={p.cells} title={p.title} />
              </li>
            ))}
          </ul>
          <p className="note">図は、各段を真上から見た4×4のマスです。赤い丸が、勝ちとなる4つの駒の位置です。</p>
        </section>
        <div className="dialog-actions">
          <button type="button" className="primary" autoFocus onClick={onClose}>閉じる</button>
        </div>
      </div>
    </div>
  );
}
