import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Group } from 'three';
import type { CellPos, PlayerId } from '../core';
import { PLAYER_COLORS } from './colors';
import { DISC_RADIUS, PILLAR_HEIGHT, cellToWorld } from './layout';

/** 強調表示の種類: 直前の手 / 勝利ライン */
export type DiscHighlight = 'last' | 'win';

interface DiscProps {
  owner: PlayerId;
  cell: CellPos;
  /** 半透明のプレビュー（ゴースト）として描く */
  ghost?: boolean;
  highlight?: DiscHighlight;
  /** true の場合、柱の上端から落下するアニメーションを再生する（表示開始時のみ有効） */
  animate?: boolean;
  onDropFinished?: () => void;
}

/** 落下にかける時間（秒） */
const DROP_SECONDS = 0.55;

export function Disc({ owner, cell, ghost = false, highlight, animate = false, onDropFinished }: DiscProps) {
  const target = cellToWorld(cell);
  const color = PLAYER_COLORS[owner];
  const ref = useRef<Group>(null);
  // 表示開始時の指定だけを見る（後で props が変わっても、再生し直さない）
  const dropping = useRef(animate);
  const elapsed = useRef(0);
  const startY = PILLAR_HEIGHT + 0.6;

  useFrame((_, delta) => {
    const group = ref.current;
    if (!group || !dropping.current) return;
    elapsed.current += delta;
    const t = Math.min(elapsed.current / DROP_SECONDS, 1);
    // 重力による加速（二次曲線）
    group.position.y = startY - (startY - target[1]) * t * t;
    if (t >= 1) {
      dropping.current = false;
      onDropFinished?.();
    }
  });

  return (
    <group ref={ref} position={[target[0], animate ? startY : target[1], target[2]]}>
      <group scale={highlight === 'win' ? 1.12 : 1}>
        {owner === 0 ? (
          <mesh scale={[1, 0.55, 1]} castShadow={!ghost}>
            <sphereGeometry args={[DISC_RADIUS, 32, 16]} />
            <DiscMaterial color={color} ghost={ghost} highlight={highlight} />
          </mesh>
        ) : (
          <FlatDisc color={color} ghost={ghost} highlight={highlight} />
        )}
      </group>
    </group>
  );
}

interface MaterialProps {
  color: string;
  ghost: boolean;
  highlight: DiscHighlight | undefined;
}

/** ゴーストは半透明、直前の手は弱い発光、勝利ラインは強い発光 */
function DiscMaterial({ color, ghost, highlight }: MaterialProps) {
  const glow = highlight === 'win' ? 0.8 : highlight === 'last' ? 0.3 : 0;
  return (
    <meshStandardMaterial
      color={color}
      roughness={0.35}
      transparent={ghost}
      opacity={ghost ? 0.4 : 1}
      emissive={highlight ? color : '#000000'}
      emissiveIntensity={glow}
    />
  );
}

function FlatDisc({ color, ghost, highlight }: MaterialProps) {
  return (
    <>
      <mesh castShadow={!ghost}>
        <cylinderGeometry args={[DISC_RADIUS, DISC_RADIUS, 0.4, 32]} />
        <DiscMaterial color={color} ghost={ghost} highlight={highlight} />
      </mesh>
      {/* 上面のくぼみ（濃い色の輪）で、先手の駒との形の違いを出す */}
      <mesh position={[0, 0.201, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[DISC_RADIUS * 0.45, DISC_RADIUS * 0.7, 32]} />
        <meshStandardMaterial color="#9c7a10" roughness={0.6} />
      </mesh>
    </>
  );
}
