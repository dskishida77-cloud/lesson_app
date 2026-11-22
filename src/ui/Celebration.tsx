import type { CSSProperties } from 'react';

export const PARTICLE_COUNT = 40;
const COLORS = ['#d6342c', '#f2c230', '#2f5fb3', '#3aa66b', '#ffffff'];

interface CelebrationProps {
  active: boolean;
  /** 「視覚効果を減らす」設定が有効な場合は、演出を出さない */
  reducedMotion: boolean;
}

/** 勝利時の紙吹雪（CSS アニメーション）。位置・色・速さは、番号から決める（描画のたびに変わらない） */
export function Celebration({ active, reducedMotion }: CelebrationProps) {
  if (!active || reducedMotion) return null;
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: PARTICLE_COUNT }, (_, i) => {
        const style = {
          left: `${(i * 37) % 100}%`,
          background: COLORS[i % COLORS.length],
          animationDelay: `${((i * 13) % 10) / 10}s`,
          animationDuration: `${2.2 + ((i * 7) % 10) / 10}s`,
        } satisfies CSSProperties;
        return <span key={i} className="confetti-piece" style={style} />;
      })}
    </div>
  );
}
