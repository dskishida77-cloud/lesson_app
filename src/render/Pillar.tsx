import type { ThreeEvent } from '@react-three/fiber';
import type { PillarPos } from '../core';
import { PILLAR_HEIGHT, pillarToWorld } from './layout';
import { isSelectGesture } from './picking';

interface PillarProps {
  pos: PillarPos;
  onSelect?: (pos: PillarPos) => void;
  onHover?: (pos: PillarPos | null) => void;
}

/** 当たり判定の半径。見た目の柱より太くして、タップしやすくする（柱の間隔の半分未満） */
const HIT_RADIUS = 0.6;

export function Pillar({ pos, onSelect, onHover }: PillarProps) {
  const [x, z] = pillarToWorld(pos);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    // ドラッグ（回転操作）の終わりに発生したクリックは、選択として扱わない
    if (isSelectGesture(e.delta)) onSelect?.(pos);
  };

  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, PILLAR_HEIGHT / 2, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.09, PILLAR_HEIGHT, 16]} />
        <meshStandardMaterial color="#c9ced6" metalness={0.3} roughness={0.4} />
      </mesh>
      {/* 透明な当たり判定 */}
      <mesh
        position={[0, PILLAR_HEIGHT / 2, 0]}
        visible={false}
        onClick={handleClick}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover?.(pos);
        }}
        onPointerOut={() => onHover?.(null)}
      >
        <cylinderGeometry args={[HIT_RADIUS, HIT_RADIUS, PILLAR_HEIGHT, 8]} />
        <meshBasicMaterial />
      </mesh>
    </group>
  );
}
